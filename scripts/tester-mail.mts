import { config as loadEnv } from "dotenv";
import { mailConfig, sendMail, withdrawalMailTo } from "../src/lib/mail";
import { withdrawalMail } from "../src/lib/withdrawal-mail";

/**
 * Vérifie que le compte d'envoi fonctionne, en expédiant un vrai mail.
 *
 *   npx tsx scripts/tester-mail.mts            -> au compte d'envoi lui-même
 *   npx tsx scripts/tester-mail.mts adresse@…  -> à l'adresse donnée
 *
 * Par défaut le mail part vers le compte d'envoi : la chaîne SMTP est validée
 * sans expédier une fausse demande de retrait au destinataire réel. Le message
 * est celui qu'une vraie demande produirait, précédé de « [TEST] ».
 */

loadEnv();

const config = mailConfig();
if (!config) {
  console.error(
    "Aucun compte d'envoi configuré. Renseignez SMTP_HOST, SMTP_USER et SMTP_PASSWORD dans .env.",
  );
  process.exit(1);
}

const to = process.argv[2]?.trim() || config.user;

console.log(`Serveur    : ${config.host}:${config.port} (TLS direct : ${config.secure})`);
console.log(`Compte     : ${config.user}`);
console.log(`Expéditeur : ${config.from}`);
console.log(`Alertes de retrait vers : ${withdrawalMailTo() ?? "(aucune adresse configurée)"}`);
console.log(`Envoi de ce test vers   : ${to}`);
console.log("");

const mail = withdrawalMail({
  eventName: "TEST — aucun virement à faire",
  amount: 250_000,
  method: "WAVE",
  phone: "07 07 12 34 56",
  note: "Message de test envoyé pendant la mise en place.",
  availableBefore: 466_000,
  createdAt: new Date(),
});

const started = Date.now();
const result = await sendMail({
  to,
  subject: `[TEST] ${mail.subject}`,
  text: mail.text,
  html: mail.html,
});

if (result.ok) {
  console.log(`Mail envoyé en ${Date.now() - started} ms.`);
} else {
  console.error(`Échec après ${Date.now() - started} ms : ${result.error}`);
  process.exitCode = 1;
}
