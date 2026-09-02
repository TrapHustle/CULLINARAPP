import type { NextRequest } from "next/server";
import { getOrCreateSession, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Fréquence de relecture de l'état en base. */
const POLL_INTERVAL_MS = 2000;
/** Un commentaire de maintien de connexion est émis tous les N cycles sans changement. */
const HEARTBEAT_EVERY_TICKS = 7;

interface StatePayload {
  activeCandidateId: string | null;
  votingOpen: boolean;
  timerEnabled: boolean;
  timerSeconds: number;
  /**
   * Tables ayant validé leurs votes pour le candidat en cours.
   *
   * C'est la source de vérité du verrou : la tablette s'aligne dessus, ce qui
   * fait qu'une dévalidation décidée au dashboard rouvre réellement la saisie
   * en salle. Sans cette liste, le verrou vivrait uniquement sur la tablette et
   * une validation prématurée serait définitive.
   */
  validatedTableIds: string[];
}

async function readState(): Promise<StatePayload> {
  const session = await getOrCreateSession();

  const validations = session.activeCandidateId
    ? await prisma.tableValidation.findMany({
        where: { candidateId: session.activeCandidateId },
        select: { tableId: true },
        // Ordre stable : la charge utile est comparée telle quelle d'un cycle à
        // l'autre pour décider s'il faut pousser un événement SSE.
        orderBy: { tableId: "asc" },
      })
    : [];

  return {
    activeCandidateId: session.activeCandidateId,
    votingOpen: session.votingOpen,
    timerEnabled: session.timerEnabled,
    timerSeconds: session.timerSeconds,
    validatedTableIds: validations.map((validation) => validation.tableId),
  };
}

/**
 * GET /api/state
 *
 * Diffuse l'état de la session (candidat actif, votes ouverts, réglage du
 * chronomètre) selon l'en-tête `Accept` :
 *  - `text/event-stream` → flux SSE poussant chaque changement ;
 *  - sinon → réponse JSON ponctuelle, utilisée comme repli en *polling* par la
 *    tablette si le flux SSE échoue (§12).
 *
 * L'état est relu périodiquement en base plutôt que diffusé via un bus
 * d'événements en mémoire : c'est un peu moins immédiat, mais cela reste correct
 * si le serveur est relancé ou exécuté en plusieurs processus.
 */
export async function GET(request: NextRequest) {
  const wantsStream = request.headers.get("accept")?.includes("text/event-stream");

  if (!wantsStream) {
    return Response.json(await readState());
  }

  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const stop = () => {
    closed = true;
    if (timer) clearInterval(timer);
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let lastPayload: string | null = null;
      let ticksWithoutChange = 0;

      const push = async () => {
        if (closed) return;
        try {
          const payload = JSON.stringify(await readState());

          if (payload !== lastPayload) {
            lastPayload = payload;
            ticksWithoutChange = 0;
            controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
            return;
          }

          // Sans changement, on maintient la connexion ouverte à intervalle plus
          // large : certains équipements réseau coupent une connexion inactive.
          ticksWithoutChange += 1;
          if (ticksWithoutChange % HEARTBEAT_EVERY_TICKS === 0) {
            controller.enqueue(encoder.encode(": keep-alive\n\n"));
          }
        } catch {
          // Une erreur de lecture ne doit pas tuer le flux : la tablette
          // continue de fonctionner hors ligne et le prochain cycle réessaiera.
        }
      };

      await push();
      timer = setInterval(push, POLL_INTERVAL_MS);
      request.signal.addEventListener("abort", stop);
    },
    cancel: stop,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Désactive la mise en tampon d'un éventuel proxy intermédiaire.
      "X-Accel-Buffering": "no",
    },
  });
}
