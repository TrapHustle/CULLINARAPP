/**
 * Écrit les portraits générés dans un dossier, pour les regarder avant de les
 * verser en base.
 *
 *   npx tsx scripts/preview-portraits.mts <dossier>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { makePortraitPng } from "./portrait.mjs";

const target = process.argv[2] ?? "portraits";
mkdirSync(target, { recursive: true });

for (let variant = 0; variant < 6; variant++) {
  const png = makePortraitPng(variant);
  const file = join(target, `portrait-${variant + 1}.png`);
  writeFileSync(file, png);
  console.log(`${file} — ${(png.length / 1024).toFixed(0)} Ko`);
}
