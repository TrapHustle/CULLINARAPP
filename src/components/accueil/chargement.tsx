import styles from "./chargement.module.css";

/**
 * Écran de chargement affiché par-dessus la page d'accueil, à la première
 * visite de la session seulement.
 *
 * La page est rendue normalement dessous (rien ne change pour le
 * référencement) et l'écran s'efface seul, en CSS. Le petit script, exécuté
 * avant que l'écran ne soit peint, le masque d'emblée s'il a déjà été vu.
 */
export function Chargement() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var k='dv-chargement';if(sessionStorage.getItem(k)){document.documentElement.setAttribute('data-chargement','vu');}else{sessionStorage.setItem(k,'1');}}catch(e){}})();`,
        }}
      />
      <div className={styles.ecran} aria-hidden="true">
        <div className={`${styles.halo} ${styles.haloUn}`} />
        <div className={`${styles.halo} ${styles.haloDeux}`} />
        <div className={styles.centre}>
          <span className={styles.logo}>
            <svg
              width="46"
              height="46"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path className={styles.coche} d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <div className={styles.texte}>
            <div className={styles.nom}>DIGITALYX-VOTE</div>
            <div className={styles.slogan}>Concours et votes, en direct</div>
          </div>
          <div className={styles.piste}>
            <div className={styles.barre} />
          </div>
        </div>
      </div>
    </>
  );
}
