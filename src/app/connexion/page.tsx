import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CadrePublic } from "@/components/espace/cadre-public";
import { FormulaireConnexion } from "@/components/espace/formulaires-compte";
import { utilisateurConnecte } from "@/lib/espace";

export const metadata: Metadata = { title: "Connexion — DIGITALYX-VOTE" };

export default async function PageConnexion() {
  if (await utilisateurConnecte()) redirect("/espace");
  return (
    <CadrePublic>
      <FormulaireConnexion />
    </CadrePublic>
  );
}
