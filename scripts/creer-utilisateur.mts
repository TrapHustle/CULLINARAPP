/**
 * Crée un compte pour une organisation qui existe déjà — typiquement Kabowd
 * Production, créée par la migration sans aucun compte (les anciens mots de
 * passe vivaient dans le .env).
 *
 *   DATABASE_URL=… npx tsx scripts/creer-utilisateur.mts <organisationId> <email> <motDePasse> [role]
 *
 * Exemple : npx tsx scripts/creer-utilisateur.mts org_kabowd contact@kabowd.ci "une phrase longue"
 *
 * Agit sur la base désignée par DATABASE_URL : vérifiez laquelle avant.
 */
import { connexionSchema, MOT_DE_PASSE_MIN, ROLES, type Role } from "../src/lib/comptes-core";
import { hacherMotDePasse } from "../src/lib/mot-de-passe";
import { prisma } from "../src/lib/prisma";

const [organisationId, emailBrut, motDePasse, roleBrut = "PROPRIETAIRE"] = process.argv.slice(2);

if (!organisationId || !emailBrut || !motDePasse) {
  console.error("Usage : npx tsx scripts/creer-utilisateur.mts <organisationId> <email> <motDePasse> [role]");
  process.exit(1);
}
if (motDePasse.length < MOT_DE_PASSE_MIN) {
  console.error(`Le mot de passe doit faire au moins ${MOT_DE_PASSE_MIN} caractères.`);
  process.exit(1);
}
if (!(ROLES as readonly string[]).includes(roleBrut)) {
  console.error(`Rôle inconnu. Rôles possibles : ${ROLES.join(", ")}.`);
  process.exit(1);
}

const { email } = connexionSchema.parse({ email: emailBrut, motDePasse });
const organisation = await prisma.organisation.findUnique({ where: { id: organisationId } });
if (!organisation) {
  console.error(`Organisation introuvable : ${organisationId}`);
  process.exit(1);
}

const utilisateur = await prisma.utilisateur.create({
  data: {
    organisationId,
    email,
    motDePasseHash: await hacherMotDePasse(motDePasse),
    role: roleBrut as Role,
  },
});

console.log(`Compte ${utilisateur.email} (${utilisateur.role}) créé pour ${organisation.nom}.`);
await prisma.$disconnect();
