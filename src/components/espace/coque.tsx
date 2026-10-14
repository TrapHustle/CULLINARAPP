import { cookies } from "next/headers";
import Link from "next/link";
import { deconnecterAction } from "@/lib/comptes-actions";
import { initiales } from "@/lib/espace";
import { outfit } from "@/lib/police";
import { BoutonTheme } from "./bouton-theme";
import { Icone } from "./icone";
import { NavLaterale } from "./nav-laterale";
import styles from "./panel.module.css";
import { COOKIE_THEME } from "./theme";

interface Props {
  utilisateur: { email: string; organisation: { nom: string } };
  evenements: { id: string; nom: string }[];
  evenementCourant: { id: string; nom: string } | null;
  /** Une sélection de l'événement est ouverte au vote. */
  enDirect: boolean;
  children: React.ReactNode;
}

/** Habillage du panneau organisateur : barre du haut, menu latéral, contenu. */
export async function Coque({ utilisateur, evenements, evenementCourant, enDirect, children }: Props) {
  const sombre = (await cookies()).get(COOKIE_THEME)?.value === "sombre";
  return (
    <div className={`${outfit.className} ${styles.page} ${sombre ? styles.sombre : ""}`}>
      <header className={styles.barre}>
        <Link href="/espace" className={styles.marque}>
          <span className={styles.marqueSigne}>
            <Icone nom="coche" taille={22} />
          </span>
          <span className={styles.marqueTexte}>
            <strong>DIGITALYX-VOTE</strong>
            <small>Plateforme de vote des concours</small>
          </span>
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
          <BoutonTheme sombreInitial={sombre} />
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
