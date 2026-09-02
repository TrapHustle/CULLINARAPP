/**
 * Génère des portraits de candidats pour les répétitions.
 *
 * Aucune dépendance : l'encodeur PNG tient dans ce fichier, au-dessus du `zlib`
 * de Node. C'est volontaire — le seul autre moyen serait d'aller chercher des
 * visages sur un service en ligne, or ce projet doit rester utilisable sur le
 * portable de l'organisateur sans internet, et coller de vrais visages de
 * personnes réelles sur de faux candidats est une mauvaise idée même en test.
 *
 * Les portraits produits sont des silhouettes stylisées, sans visage : on voit
 * immédiatement que ce sont des images de remplacement, et elles suffisent pour
 * vérifier ce qu'on veut vérifier — cadrage, poids, mise en cache, rendu sur
 * les tablettes et sur l'écran projeté.
 */
import { deflateSync } from "node:zlib";

/* ------------------------------------------------------------------ */
/* Encodeur PNG                                                        */
/* ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));

  return Buffer.concat([length, typed, crc]);
}

/** Encode un buffer RGB (3 octets par pixel) en PNG truecolor 8 bits. */
function encodePng(rgb: Uint8Array, width: number, height: number): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // profondeur
  header[9] = 2; // truecolor RGB
  header[10] = 0; // compression
  header[11] = 0; // filtrage
  header[12] = 0; // pas d'entrelacement

  // Chaque ligne est précédée de son octet de filtre, ici toujours 0 (aucun) :
  // les aplats compressent déjà très bien, un filtrage adaptatif n'apporterait
  // que de la complexité.
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const target = y * (1 + width * 3);
    raw[target] = 0;
    rgb.subarray(y * width * 3, (y + 1) * width * 3).forEach((value, index) => {
      raw[target + 1 + index] = value;
    });
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------ */
/* Toile de dessin                                                     */
/* ------------------------------------------------------------------ */

type Rgb = [number, number, number];

class Canvas {
  readonly pixels: Float32Array;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.pixels = new Float32Array(width * height * 3);
  }

  /** Mélange une couleur au pixel, `alpha` valant 1 pour un aplat opaque. */
  blend(x: number, y: number, color: Rgb, alpha: number) {
    if (alpha <= 0 || x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const index = (y * this.width + x) * 3;
    for (let channel = 0; channel < 3; channel++) {
      this.pixels[index + channel] =
        this.pixels[index + channel] * (1 - alpha) + color[channel] * alpha;
    }
  }

  /** Dégradé vertical de fond. */
  verticalGradient(top: Rgb, bottom: Rgb) {
    for (let y = 0; y < this.height; y++) {
      const t = y / (this.height - 1);
      const color: Rgb = [
        top[0] + (bottom[0] - top[0]) * t,
        top[1] + (bottom[1] - top[1]) * t,
        top[2] + (bottom[2] - top[2]) * t,
      ];
      for (let x = 0; x < this.width; x++) this.blend(x, y, color, 1);
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, color: Rgb, alpha = 1) {
    const minX = Math.max(0, Math.floor(cx - rx));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + rx));
    const minY = Math.max(0, Math.floor(cy - ry));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + ry));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.blend(x, y, color, alpha);
      }
    }
  }

  roundRect(x0: number, y0: number, w: number, h: number, radius: number, color: Rgb, alpha = 1) {
    const r = Math.min(radius, w / 2, h / 2);
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(this.height, y0 + h); y++) {
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(this.width, x0 + w); x++) {
        const dx = Math.max(x0 + r - x, 0, x - (x0 + w - r));
        const dy = Math.max(y0 + r - y, 0, y - (y0 + h - r));
        if (dx * dx + dy * dy <= r * r) this.blend(x, y, color, alpha);
      }
    }
  }

  /** Halo doux, pour détacher le sujet du fond. */
  glow(cx: number, cy: number, radius: number, color: Rgb, strength: number) {
    const minX = Math.max(0, Math.floor(cx - radius));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + radius));
    const minY = Math.max(0, Math.floor(cy - radius));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + radius));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / radius;
        if (distance >= 1) continue;
        const falloff = (1 - distance) * (1 - distance);
        this.blend(x, y, color, falloff * strength);
      }
    }
  }

  /**
   * Réduit la toile d'un facteur entier en moyennant les pixels.
   *
   * C'est tout l'intérêt de dessiner en plus grand : les contours obliques du
   * chapeau et des épaules ressortent lissés, sans code d'anticrénelage.
   */
  downsample(factor: number): { rgb: Uint8Array; width: number; height: number } {
    const width = Math.floor(this.width / factor);
    const height = Math.floor(this.height / factor);
    const out = new Uint8Array(width * height * 3);
    const samples = factor * factor;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const sum = [0, 0, 0];
        for (let sy = 0; sy < factor; sy++) {
          for (let sx = 0; sx < factor; sx++) {
            const index = ((y * factor + sy) * this.width + (x * factor + sx)) * 3;
            sum[0] += this.pixels[index];
            sum[1] += this.pixels[index + 1];
            sum[2] += this.pixels[index + 2];
          }
        }
        const target = (y * width + x) * 3;
        for (let channel = 0; channel < 3; channel++) {
          out[target + channel] = Math.max(0, Math.min(255, Math.round(sum[channel] / samples)));
        }
      }
    }

    return { rgb: out, width, height };
  }
}

/* ------------------------------------------------------------------ */
/* Le portrait                                                         */
/* ------------------------------------------------------------------ */

/** Teintes de peau, du plus clair au plus foncé. */
const SKIN_TONES: Rgb[] = [
  [242, 203, 168],
  [226, 178, 138],
  [198, 145, 106],
  [163, 111, 74],
  [124, 82, 54],
  [88, 58, 40],
];

/** Fonds colorés, assez sourds pour ne pas concurrencer le sujet. */
const BACKDROPS: [Rgb, Rgb][] = [
  [
    [58, 42, 18],
    [23, 19, 14],
  ],
  [
    [30, 45, 52],
    [15, 20, 24],
  ],
  [
    [52, 30, 34],
    [24, 16, 18],
  ],
  [
    [34, 46, 32],
    [17, 22, 17],
  ],
  [
    [44, 36, 56],
    [20, 17, 26],
  ],
  [
    [56, 46, 24],
    [24, 21, 14],
  ],
];

const JACKET: Rgb = [243, 240, 233];
const JACKET_SHADE: Rgb = [214, 208, 196];
const TOQUE: Rgb = [250, 249, 245];
const GOLD: Rgb = [212, 175, 55];

/** Portrait carré-portrait (4:5), rendu en 2× puis réduit. */
export function makePortraitPng(variant: number, width = 480): Buffer {
  const height = Math.round((width * 5) / 4);
  const scale = 2;
  const canvas = new Canvas(width * scale, height * scale);

  const w = canvas.width;
  const h = canvas.height;

  const skin = SKIN_TONES[variant % SKIN_TONES.length];
  const [top, bottom] = BACKDROPS[variant % BACKDROPS.length];

  canvas.verticalGradient(top, bottom);

  const centerX = w / 2;

  // Halo doré derrière la tête : c'est lui qui détache la silhouette du fond.
  canvas.glow(centerX, h * 0.42, w * 0.52, GOLD, 0.16);

  // Buste : une ellipse très large dont on ne voit que le haut.
  canvas.ellipse(centerX, h * 1.06, w * 0.46, h * 0.42, JACKET);
  // Ombre du col, pour que la veste ne soit pas un aplat mort.
  canvas.ellipse(centerX, h * 1.04, w * 0.3, h * 0.34, JACKET_SHADE, 0.5);

  // Col croisé de la veste de cuisine.
  canvas.ellipse(centerX, h * 0.94, w * 0.15, h * 0.12, JACKET);

  // Cou.
  canvas.roundRect(centerX - w * 0.09, h * 0.62, w * 0.18, h * 0.18, w * 0.05, [
    skin[0] * 0.82,
    skin[1] * 0.82,
    skin[2] * 0.82,
  ]);

  // Oreilles, puis tête par-dessus pour masquer la jonction.
  canvas.ellipse(centerX - w * 0.21, h * 0.47, w * 0.045, h * 0.045, skin);
  canvas.ellipse(centerX + w * 0.21, h * 0.47, w * 0.045, h * 0.045, skin);
  canvas.ellipse(centerX, h * 0.45, w * 0.2, h * 0.19, skin);

  // Toque : le bandeau, puis trois bouffants qui débordent.
  canvas.roundRect(centerX - w * 0.21, h * 0.255, w * 0.42, h * 0.075, w * 0.02, TOQUE);
  canvas.ellipse(centerX, h * 0.2, w * 0.19, h * 0.1, TOQUE);
  canvas.ellipse(centerX - w * 0.15, h * 0.225, w * 0.12, h * 0.075, TOQUE);
  canvas.ellipse(centerX + w * 0.15, h * 0.225, w * 0.12, h * 0.075, TOQUE);

  // Liseré doré sous le bandeau, clin d'œil à l'identité de l'application.
  canvas.roundRect(centerX - w * 0.21, h * 0.325, w * 0.42, h * 0.008, w * 0.004, GOLD, 0.8);

  // Vignettage : assombrit les bords et ramène l'œil au centre.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - w / 2) / (w / 2);
      const dy = (y - h / 2) / (h / 2);
      const distance = Math.min(1, Math.hypot(dx, dy) / 1.25);
      canvas.blend(x, y, [0, 0, 0], distance * distance * 0.45);
    }
  }

  const reduced = canvas.downsample(scale);
  return encodePng(reduced.rgb, reduced.width, reduced.height);
}
