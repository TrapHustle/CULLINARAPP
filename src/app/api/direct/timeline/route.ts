import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { computeTimeline } from "@/lib/timeline";

export const dynamic = "force-dynamic";

/** Même code que la proclamation : un seul secret à retenir le jour J. */
const PIN = process.env.PROCLAMATION_PIN?.trim() || "4321";

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * POST /api/direct/timeline
 *
 * Rend la course des candidats à l'écran projeté, **contre le code**.
 *
 * `/api/results/timeline` exige une session, que la machine du vidéoprojecteur
 * n'a pas — et lui en donner une reviendrait à laisser le dashboard entier
 * ouvert dans la salle. Cette route rend la même donnée, gardée par le même
 * code que la proclamation.
 *
 * Le contrôle est fait ici et non dans le navigateur : un code vérifié côté
 * client serait lisible dans le JavaScript de la page, et la route resterait
 * ouverte à quiconque connaît son adresse. Or un classement intermédiaire
 * renseigne autant qu'un classement final.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête JSON invalide" }, { status: 400 });
  }

  const pin = (body as { pin?: unknown })?.pin;
  if (typeof pin !== "string" || !safeEqual(pin, PIN)) {
    return Response.json({ error: "Code incorrect" }, { status: 401 });
  }

  return Response.json(await computeTimeline());
}
