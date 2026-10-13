import { redirect } from "next/navigation";
import { exigerUtilisateur } from "@/lib/espace";
import { prisma } from "@/lib/prisma";

/** Entrée de l'espace : le dernier événement, ou sa création s'il n'y en a aucun. */
export default async function PageEspace() {
  const utilisateur = await exigerUtilisateur();
  const dernier = await prisma.evenement.findFirst({
    where: { organisationId: utilisateur.organisationId },
    orderBy: { creeLe: "desc" },
    select: { id: true },
  });
  redirect(dernier ? `/espace/e/${dernier.id}` : "/espace/evenements/nouveau");
}
