import { DISCOVERY_SERVICE, serverName, serverPort } from "@/lib/network";

export const dynamic = "force-dynamic";

/**
 * GET /api/ping
 *
 * Carte de visite du serveur, volontairement minuscule et sans accès à la base.
 *
 * Les tablettes l'appellent pour deux choses : confirmer qu'une adresse trouvée
 * en diffusion Wi-Fi héberge bien ce logiciel, et balayer le sous-réseau en
 * dernier recours si la diffusion est bloquée par le routeur. Ce balayage tape
 * des centaines d'adresses : la réponse doit rester instantanée.
 */
export function GET() {
  return Response.json({
    service: DISCOVERY_SERVICE,
    name: serverName(),
    port: Number(serverPort()),
  });
}
