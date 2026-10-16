import { Coque } from "@/components/espace/coque";
import { NavPlateforme } from "@/components/espace/nav-laterale";
import { exigerSuperAdmin } from "@/lib/espace";
import { prisma } from "@/lib/prisma";

/** Espace plateforme : réservé au super-admin Inovyx. */
export default async function LayoutPlateforme({ children }: { children: React.ReactNode }) {
  const utilisateur = await exigerSuperAdmin();
  const enDirect = (await prisma.selection.count({ where: { etat: "OUVERTE" } })) > 0;
  return (
    <Coque
      utilisateur={utilisateur}
      evenements={[]}
      evenementCourant={null}
      enDirect={enDirect}
      nav={<NavPlateforme />}
      accueil="/plateforme"
      liensCompte={[{ href: "/plateforme/compte", libelle: "Mon compte" }]}
    >
      {children}
    </Coque>
  );
}
