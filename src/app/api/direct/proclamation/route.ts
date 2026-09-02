import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeResults } from "@/lib/results";

export const dynamic = "force-dynamic";

/** Code de proclamation. Modifiable sans redéploiement par variable d'environnement. */
const PIN = process.env.PROCLAMATION_PIN?.trim() || "4321";

/** Comparaison à temps constant, pour ne rien apprendre de la durée d'un essai. */
function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/** Un palier de la révélation : un rang, et le ou les candidats qui le partagent. */
interface RevealStep {
  rank: number;
  /** Note sur 20, déjà mise en forme française — le client n'a rien à calculer. */
  note: string;
  people: { name: string; photoUrl: string | null }[];
}

/**
 * POST /api/direct/proclamation
 *
 * Rend le classement final à l'écran projeté, **et seulement contre le code**.
 *
 * C'est la raison d'être de cette route. `/api/results` exige une session, ce
 * que la machine du vidéoprojecteur n'a pas ; et `/api/direct` est public mais
 * ne diffuse aucune note, précisément pour qu'un spectateur ne puisse pas lire
 * le classement avant la proclamation.
 *
 * Vérifier le code **ici** plutôt que dans le navigateur est ce qui donne sa
 * valeur au verrou : un code contrôlé côté client serait lisible dans le
 * JavaScript de la page, et surtout laisserait cette route ouverte à tous. Le
 * classement ne quitte donc le serveur qu'après un code juste.
 *
 * Le regroupement des ex æquo et l'ordre de révélation sont faits ici : ce sont
 * des règles du concours, pas de l'affichage, et elles doivent valoir aussi
 * pour les exports.
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

  const [results, candidates] = await Promise.all([
    computeResults(),
    prisma.candidate.findMany({ select: { id: true, photoUrl: true } }),
  ]);

  const photoById = new Map(candidates.map((candidate) => [candidate.id, candidate.photoUrl]));

  // Les candidats sans aucun vote portent un rang `null` : ils ne sont pas
  // comparables aux autres et sont écartés de la cérémonie plutôt que révélés
  // avec un rang inventé.
  const rated = results.ranking.filter(
    (entry): entry is typeof entry & { rank: number; finalOutOf20: number } =>
      entry.rank !== null && entry.finalOutOf20 !== null,
  );

  // Les ex æquo partagent un rang : ils sont révélés ensemble, sur un même
  // palier. Sortir l'un avant l'autre laisserait croire à un départage.
  const byRank = new Map<number, RevealStep>();
  for (const entry of rated) {
    const existing = byRank.get(entry.rank);
    const person = {
      name: entry.name,
      photoUrl: photoById.get(entry.candidateId) ?? null,
    };

    if (existing) {
      existing.people.push(person);
      continue;
    }

    byRank.set(entry.rank, {
      rank: entry.rank,
      note: entry.finalOutOf20.toFixed(2).replace(".", ","),
      people: [person],
    });
  }

  // Du dernier au premier : c'est l'ordre de la cérémonie.
  const steps = [...byRank.values()].sort((a, b) => b.rank - a.rank);

  return Response.json({
    steps,
    unranked: results.ranking.filter((entry) => entry.rank === null).length,
  });
}
