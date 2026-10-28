import { authentifier } from "@/lib/comptes";
import { connexionSchema, premiereErreur } from "@/lib/comptes-core";
import { prisma } from "@/lib/prisma";
import { checkLogin, clearLoginFailures, noteLoginFailure, realClientIp, waitMessage } from "@/lib/rate-limit";
import { creerJeton } from "@/lib/tablette";

export const dynamic = "force-dynamic";

const LIMITE = "tablette";

/**
 * POST /api/tablette/connexion — { email, motDePasse }
 *
 * Connecte une tablette avec le compte de l'organisateur (ses événements) ou
 * le compte super-admin (tous). Répond un jeton à renvoyer en
 * `Authorization: Bearer …`. Essais limités comme la connexion du site.
 */
export async function POST(request: Request) {
  let corps: unknown;
  try {
    corps = await request.json();
  } catch {
    return Response.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  const analyse = connexionSchema.safeParse(corps);
  if (!analyse.success) return Response.json({ erreur: premiereErreur(analyse.error) }, { status: 400 });

  const ip = realClientIp((nom) => request.headers.get(nom));
  const attente = checkLogin(LIMITE, ip, analyse.data.email);
  if (attente.blocked) return Response.json({ erreur: waitMessage(attente.minutes) }, { status: 429 });

  const resultat = await authentifier(analyse.data);
  if (!resultat.ok) {
    noteLoginFailure(LIMITE, ip, analyse.data.email);
    return Response.json({ erreur: resultat.erreur }, { status: 401 });
  }

  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: resultat.utilisateurId },
    include: { organisation: { select: { nom: true, actif: true } } },
  });
  if (!utilisateur) return Response.json({ erreur: "Compte introuvable." }, { status: 401 });
  const superAdmin = utilisateur.role === "SUPERADMIN";
  if (!superAdmin && !utilisateur.organisation.actif) {
    return Response.json({ erreur: "Ce compte est suspendu : contactez la plateforme." }, { status: 403 });
  }

  clearLoginFailures(LIMITE, ip, analyse.data.email);
  const jeton = await creerJeton({ utilisateurId: utilisateur.id, organisationId: utilisateur.organisationId });
  return Response.json({
    jeton,
    email: utilisateur.email,
    organisation: superAdmin ? null : utilisateur.organisation.nom,
    superAdmin,
  });
}
