import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/images/:id
 *
 * Sert une image stockée en base (portrait d'un candidat, affiche de
 * l'événement).
 *
 * Volontairement non authentifiée, comme `/api/config` : les tablettes n'ont pas
 * de mot de passe (§7) et doivent pouvoir afficher les portraits. Une image ne
 * révèle rien du scrutin.
 *
 * Le cache est agressif — et c'est sans risque : l'identifiant est tiré au sort
 * à l'envoi, donc remplacer une photo produit une nouvelle URL. Une image
 * donnée ne change jamais de contenu, et les tablettes ne la retéléchargent
 * qu'une fois pour toute la soirée.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const image = await prisma.image.findUnique({ where: { id } });
  if (!image) {
    return Response.json({ error: "Image introuvable" }, { status: 404 });
  }

  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.mimeType,
      "Content-Length": String(image.data.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
