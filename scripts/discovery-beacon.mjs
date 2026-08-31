import dgram from "node:dgram";
import os from "node:os";

/**
 * Balise de découverte Wi-Fi.
 *
 * Les tablettes ne connaissent plus l'adresse du serveur : elles crient sur le
 * réseau Wi-Fi « qui héberge le concours ? » et cette balise répond. L'adresse
 * IP du portable peut donc changer d'une salle à l'autre, ou au redémarrage du
 * routeur, sans qu'aucune tablette ait à être ré-appairée.
 *
 * La réponse ne contient pas l'adresse du serveur : la tablette la déduit de
 * l'expéditeur du paquet. C'est ce qui rend la balise indifférente au nombre
 * d'interfaces réseau du portable — Wi-Fi et Ethernet répondent chacune avec
 * l'adresse par laquelle la tablette est effectivement capable de la joindre.
 */

export const DISCOVERY_PORT = 45678;
export const DISCOVERY_PROBE = "CONCOURS_VOTE_DISCOVER?";
export const DISCOVERY_SERVICE = "concours-vote";

export function startBeacon({ port = 3000, name = os.hostname() } = {}) {
  const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

  const reply = Buffer.from(
    JSON.stringify({
      service: DISCOVERY_SERVICE,
      name,
      port: Number(port),
      publicUrl: process.env.APP_PUBLIC_URL?.trim() || null,
    }),
  );

  socket.on("message", (message, sender) => {
    // On ignore tout ce qui n'est pas notre sonde : le port peut être partagé
    // avec un autre logiciel sur le poste de l'organisateur.
    if (!message.toString("utf8").startsWith(DISCOVERY_PROBE)) return;

    socket.send(reply, sender.port, sender.address, (error) => {
      if (error) console.error("[balise] réponse impossible :", error.message);
    });
  });

  socket.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      // Cas courant : deux instances du serveur lancées par mégarde. La
      // première balise suffit, on n'empêche pas le serveur web de tourner.
      console.error(
        `[balise] le port ${DISCOVERY_PORT} est déjà pris — une autre instance ` +
          "du serveur tourne-t-elle déjà ? Les tablettes utiliseront le balayage " +
          "réseau, plus lent.",
      );
    } else {
      console.error("[balise] erreur :", error.message);
    }
    socket.close();
  });

  socket.bind(DISCOVERY_PORT, () => {
    try {
      socket.setBroadcast(true);
    } catch {
      // Sans droit de diffusion la balise répond quand même en unicast.
    }
    console.log(
      `[balise] à l'écoute sur le port UDP ${DISCOVERY_PORT} — les tablettes ` +
        `trouveront « ${name} » toutes seules sur le Wi-Fi.`,
    );
  });

  return socket;
}

// Lancement direct : `node scripts/discovery-beacon.mjs`
if (process.argv[1]?.endsWith("discovery-beacon.mjs")) {
  startBeacon({ port: process.env.PORT ?? 3000, name: process.env.SERVER_NAME });
}
