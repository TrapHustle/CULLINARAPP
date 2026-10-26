import type { Metadata } from "next";
import { ListeEvenements } from "@/components/espace/liste-evenements";
import { exigerUtilisateur, peutModifier } from "@/lib/espace";
import { listerCartesEvenements } from "@/lib/evenements";

export const metadata: Metadata = { title: "Mes événements — DIGITALYX-VOTE" };

export default async function PageEvenements() {
  const utilisateur = await exigerUtilisateur();
  const evenements = await listerCartesEvenements(utilisateur.organisationId);

  return (
    <ListeEvenements
      modifiable={peutModifier(utilisateur.role)}
      evenements={evenements.map((ev) => ({ ...ev, date: ev.date ? ev.date.toISOString() : null }))}
    />
  );
}
