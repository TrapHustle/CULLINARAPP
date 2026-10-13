import Link from "next/link";
import styles from "@/components/espace/compte.module.css";
import { CadrePublic } from "@/components/espace/cadre-public";

export default function Introuvable() {
  return (
    <CadrePublic>
      <div className={styles.carte} style={{ textAlign: "center" }}>
        <div className={styles.surtitre}>Erreur 404</div>
        <h1>Cette page n&rsquo;existe pas.</h1>
        <p className={styles.sousTitre}>
          L&rsquo;adresse est peut-être incomplète, ou la page ne fait pas partie de votre espace.
        </p>
        <Link href="/" className={styles.bouton} style={{ textDecoration: "none" }}>
          Retour à l&rsquo;accueil
        </Link>
        <p className={styles.bas}>
          Organisateur ? <Link href="/espace">Ouvrir mon espace</Link>
        </p>
      </div>
    </CadrePublic>
  );
}
