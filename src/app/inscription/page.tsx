import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CadrePublic } from "@/components/espace/cadre-public";
import { FormulaireInscription } from "@/components/espace/formulaires-compte";
import { utilisateurConnecte } from "@/lib/espace";

export const metadata: Metadata = { title: "Créer un compte — DIGITALYX-VOTE" };

export default async function PageInscription() {
  if (await utilisateurConnecte()) redirect("/espace");
  return (
    <CadrePublic>
      <FormulaireInscription />
    </CadrePublic>
  );
}
