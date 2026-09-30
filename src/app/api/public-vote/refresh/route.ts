import { refreshPendingPayments } from "@/lib/public-vote";

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

  const updated = await refreshPendingPayments();
  return Response.json({ updated });
}
