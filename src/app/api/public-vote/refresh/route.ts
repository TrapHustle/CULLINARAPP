import { refreshPendingPayments } from "@/lib/public-vote";
import { rafraichirPaiementsSaas } from "@/lib/vote-public-saas";

export const dynamic = "force-dynamic";

/**
 * GET /api/public-vote/refresh
 *
 * Redemande à la passerelle le statut des paiements en attente — pour le
 * visiteur qui a payé puis fermé son navigateur sans revenir sur la page.
 * Appelée par une tâche planifiée (Vercel Cron), qui envoie
 * `Authorization: Bearer <CRON_SECRET>`.
 *
 * Sans `CRON_SECRET` configuré, la route reste fermée : elle ne doit pas
 * pouvoir être déclenchée en boucle par n'importe qui pour marteler la
 * passerelle.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Accès refusé" }, { status: 401 });
  }

  // L'ancienne page `/voter` et les pages des sélections du SaaS (`/v/…`).
  const updated = await refreshPendingPayments();
  const saas = await rafraichirPaiementsSaas();
  return Response.json({ updated, saas });
}
