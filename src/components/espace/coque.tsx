import Link from "next/link";
import { deconnecterAction } from "@/lib/comptes-actions";
import { initiales } from "@/lib/espace";
import { dmSans } from "@/lib/police";
import { Icone } from "./icone";
import { NavLaterale } from "./nav-laterale";
import styles from "./panel.module.css";

interface Props {
  utilisateur: { email: string; organisation: { nom: string } };
  evenements: { id: string; nom: string }[];
  evenementCourant: { id: string; nom: string } | null;
  /** Une sélection de l'événement est ouverte au vote. */
  enDirect: boolean;
  children: React.ReactNode;
}

/** Habillage du panneau organisateur : barre du haut, menu latéral, contenu. */
export function Coque({ utilisateur, evenements, evenementCourant, enDirect, children }: Props) {
  return (
    <div className={`${dmSans.className} ${styles.page}`}>
      <header className={styles.barre}>
        <Link href="/espace" className={styles.marque}>
          <span className={styles.marqueSigne}>
            <Icone nom="coche" taille={18} />
          </span>
          <span>DIGITALYX-VOTE</span>
        </Link>

        {evenements.length > 0 ? (
          <details className={styles.deroulant}>
            <summary className={styles.selecteur} aria-label="Changer d'événement">
              <span>{evenementCourant?.nom ?? "Choisir un événement"}</span>
              <Icone nom="chevron" taille={16} />
            </summary>
            <nav className={styles.menu}>
              {evenements.map((e) => (
                <Link
                  key={e.id}
                  href={`/espace/e/${e.id}`}
                  className={e.id === evenementCourant?.id ? styles.courant : undefined}
                >
                  {e.nom}
                </Link>
              ))}
              <Link href="/espace/evenements/nouveau">+ Nouvel événement</Link>
            </nav>
          </details>
        ) : null}

        <div className={styles.profil}>
          <span className={`${styles.point} ${enDirect ? styles.pointActif : ""}`} />
          <span className={styles.profilTexte}>{enDirect ? "En direct" : "Aucun vote ouvert"}</span>
          <details className={styles.deroulant}>
            <summary className={styles.avatar} aria-label="Mon compte">
              {initiales(utilisateur.email)}
            </summary>
            <div className={`${styles.menu} ${styles.menuDroite}`}>
              <div className={styles.menuInfo}>
                <strong>{utilisateur.organisation.nom}</strong>
                {utilisateur.email}
              </div>
              <form action={deconnecterAction}>
                <button type="submit" style={{ width: "100%" }}>
                  Se déconnecter
                </button>
              </form>
            </div>
          </details>
        </div>
      </header>

      <div className={styles.corps}>
        <NavLaterale evenementId={evenementCourant?.id ?? null} />
        <main className={styles.contenu}>
          <div className={styles.largeur}>{children}</div>
        </main>
      </div>
    </div>
  );
}
