import { notFound } from "next/navigation";
import { Coque } from "@/components/espace/coque";
import { exigerUtilisateur } from "@/lib/espace";
import { listerEvenements } from "@/lib/evenements";

export default async function LayoutEvenement({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ evenementId: string }>;
}) {
  const { evenementId } = await params;
  const utilisateur = await exigerUtilisateur();
  const evenements = await listerEvenements(utilisateur.organisationId);

  // Un événement d'une autre organisation est introuvable, pas interdit :
  // on ne confirme même pas qu'il existe (RG 0.2).
  const courant = evenements.find((e) => e.id === evenementId);
  if (!courant) notFound();

  return (
    <Coque
      utilisateur={utilisateur}
      evenements={evenements}
      evenementCourant={courant}
      enDirect={courant.selections.some((s) => s.etat === "OUVERTE")}
    >
      {children}
    </Coque>
  );
}
