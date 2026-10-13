import { Coque } from "@/components/espace/coque";
import { exigerUtilisateur } from "@/lib/espace";
import { listerEvenements } from "@/lib/evenements";

export default async function LayoutEvenements({ children }: { children: React.ReactNode }) {
  const utilisateur = await exigerUtilisateur();
  const evenements = await listerEvenements(utilisateur.organisationId);
  const enDirect = evenements.some((e) => e.selections.some((s) => s.etat === "OUVERTE"));

  return (
    <Coque utilisateur={utilisateur} evenements={evenements} evenementCourant={null} enDirect={enDirect}>
      {children}
    </Coque>
  );
}
