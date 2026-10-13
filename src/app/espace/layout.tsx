import { exigerUtilisateur } from "@/lib/espace";

/**
 * Garde d'accès unique de l'espace des organisations. L'habillage (barre du
 * haut, menu latéral) est posé par chaque section, qui seule sait quel
 * événement est affiché.
 */
export default async function LayoutEspace({ children }: { children: React.ReactNode }) {
  await exigerUtilisateur();
  return children;
}
