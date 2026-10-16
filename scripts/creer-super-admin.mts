/**
 * Crée (ou réinitialise) le compte super-admin de la plateforme. Il n'existe
 * pas d'inscription pour ce rôle : seul ce script le crée.
 *
 *   DATABASE_URL=… npx tsx scripts/creer-super-admin.mts <email> <motDePasse>
 *
 * Le compte appartient à l'organisation technique « Inovyx Tech — plateforme »
 * (id fixe `org_plateforme`), créée au besoin et absente des listes de clients.
 * Si l'adresse existe déjà, son mot de passe est remplacé et elle devient
 * super-admin. Agit sur la base désignée par DATABASE_URL : vérifiez laquelle.
 */
import { connexionSchema, MOT_DE_PASSE_MIN } from "../src/lib/comptes-core";
import { hacherMotDePasse } from "../src/lib/mot-de-passe";
import { prisma } from "../src/lib/prisma";

const [emailBrut, motDePasse] = process.argv.slice(2);
if (!emailBrut || !motDePasse) {
  console.error("Usage : npx tsx scripts/creer-super-admin.mts <email> <motDePasse>");
  process.exit(1);
}
if (motDePasse.length < MOT_DE_PASSE_MIN) {
  console.error(`Le mot de passe doit faire au moins ${MOT_DE_PASSE_MIN} caractères.`);
  process.exit(1);
}

const { email } = connexionSchema.parse({ email: emailBrut, motDePasse });
await prisma.organisation.upsert({
  where: { id: "org_plateforme" },
  update: {},
  create: { id: "org_plateforme", nom: "Inovyx Tech — plateforme" },
});

const motDePasseHash = await hacherMotDePasse(motDePasse);
const existant = await prisma.utilisateur.findUnique({ where: { email } });
if (existant && existant.organisationId !== "org_plateforme") {
  console.error(`${email} appartient déjà à une organisation cliente : choisissez une autre adresse.`);
  process.exit(1);
}
await prisma.utilisateur.upsert({
  where: { email },
  update: { motDePasseHash, role: "SUPERADMIN" },
  create: { email, motDePasseHash, role: "SUPERADMIN", organisationId: "org_plateforme" },
});
console.log(`Super-admin ${email} prêt. Connexion sur /connexion, puis /plateforme.`);
await prisma.$disconnect();
