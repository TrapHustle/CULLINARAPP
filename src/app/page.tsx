import type { Metadata } from "next";
import Link from "next/link";
import { IBM_Plex_Sans } from "next/font/google";
import styles from "./accueil.module.css";

/**
 * Page d'accueil de DIGITALYX-VOTE.
 *
 * Provisoire : elle présente la plateforme en attendant le design définitif de
 * la refonte. Volontairement sobre — une police, des aplats de bleu, pas
 * d'ombres ni de dégradés.
 */

const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "DIGITALYX-VOTE — vote en ligne, en salle et jury pour vos concours",
  description:
    "DIGITALYX-VOTE réunit le vote du public en ligne, le vote de la salle et la note du jury dans un seul classement sur 100, calculé en direct.",
};

const CANAUX = [
  {
    titre: "Vote en ligne",
    texte:
      "Le public vote depuis son téléphone, par Wave, Orange Money ou MTN MoMo. Une voix gratuite par personne si vous le souhaitez, puis autant de voix payantes que voulu.",
  },
  {
    titre: "Vote en salle",
    texte:
      "Les invités notent chaque candidat sur des tablettes, avec ou sans grille de critères. Les tablettes continuent de fonctionner sans internet et transmettent les votes au retour du réseau.",
  },
  {
    titre: "Jury d'experts",
    texte:
      "Le jury note sur une grille dont chaque critère a son propre barème : goût sur 20, créativité sur 10… Son poids dans le résultat ne dépend pas du nombre de jurés.",
  },
];

const EXEMPLE = [
  { nom: "Candidat B", ligne: "7,5", salle: "18,0", jury: "36,0", finale: "61,5" },
  { nom: "Candidat A", ligne: "18,0", salle: "15,0", jury: "28,0", finale: "61,0" },
  { nom: "Candidat C", ligne: "4,5", salle: "27,0", jury: "24,0", finale: "55,5" },
];

const MODES = [
  { nom: "Part de voix", texte: "La note suit la part du candidat dans le total des voix." },
  { nom: "Paliers", texte: "Le candidat gagne des points en franchissant des seuils de voix que vous fixez." },
  { nom: "Par leader", texte: "Le premier obtient 100, les autres au prorata de ses voix." },
];

const ORGANISATEUR = [
  "Vous créez votre événement, ses sélections, vos candidats et vos grilles de notation.",
  "Vous ouvrez et fermez les votes, et suivez le classement en direct.",
  "Vous projetez les résultats en salle et proclamez les qualifiés.",
  "Vous suivez vos recettes et demandez leur reversement sur votre numéro mobile.",
  "Chaque sélection clôturée est archivée, avec ses résultats figés.",
];

export default function Accueil() {
  return (
    <div className={`${plex.className} ${styles.page}`}>
      <header className={styles.entete}>
        <div className={styles.cadre}>
          <span className={styles.marque}>
            DIGITALYX-VOTE <span className={styles.editeur}>par Inovyx Tech</span>
          </span>
          <nav className={styles.liens}>
            <Link href="/voter">Voter</Link>
            <Link href="/connexion" className={styles.lienCompte}>
              Espace organisateur
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.cadre}>
            <h1>Le vote de vos concours, en ligne, en salle et par le jury.</h1>
            <p>
              DIGITALYX-VOTE réunit le vote du public sur internet, l&rsquo;avis de la salle et la note du jury
              dans un seul classement sur 100, calculé et affiché en direct.
            </p>
            <div className={styles.actions}>
              <Link href="/inscription" className={styles.boutonClair}>
                Créer un compte
              </Link>
              <Link href="/voter" className={styles.boutonContour}>
                Voir le vote en cours
              </Link>
            </div>
          </div>
        </section>

        <section className={styles.pale}>
          <div className={styles.cadre}>
            <h2>Ce que nous faisons</h2>
            <p className={styles.intro}>
              Trois façons de voter, réunies dans un même résultat. Vous choisissez celles qui servent
              votre concours.
            </p>
            <div className={styles.canaux}>
              {CANAUX.map((canal) => (
                <div key={canal.titre} className={styles.canal}>
                  <h3>{canal.titre}</h3>
                  <p>{canal.texte}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.blanc}>
          <div className={styles.cadre}>
            <h2>Un classement juste, ramené sur 100</h2>
            <p className={styles.intro}>
              Des voix et des notes ne se comparent pas directement. Chaque vote est donc ramené sur 100,
              puis pèse selon la part que vous lui donnez. Exemple avec 30 % en ligne, 30 % en salle et
              40 % pour le jury :
            </p>

            <div className={styles.tableau}>
              <table>
                <thead>
                  <tr>
                    <th>Candidat</th>
                    <th>En ligne</th>
                    <th>Salle</th>
                    <th>Jury</th>
                    <th>Note finale</th>
                  </tr>
                </thead>
                <tbody>
                  {EXEMPLE.map((ligne) => (
                    <tr key={ligne.nom}>
                      <td>{ligne.nom}</td>
                      <td>{ligne.ligne}</td>
                      <td>{ligne.salle}</td>
                      <td>{ligne.jury}</td>
                      <td className={styles.finale}>{ligne.finale}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={styles.note}>
              Le candidat A domine le vote en ligne, mais B l&rsquo;emporte grâce au jury.
            </p>

            <h3 className={styles.sousTitre}>Trois façons de compter le vote en ligne</h3>
            <dl className={styles.modes}>
              {MODES.map((mode) => (
                <div key={mode.nom}>
                  <dt>{mode.nom}</dt>
                  <dd>{mode.texte}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className={styles.pale}>
          <div className={styles.cadre}>
            <h2>Pour l&rsquo;organisateur</h2>
            <ul className={styles.liste}>
              {ORGANISATEUR.map((ligne) => (
                <li key={ligne}>{ligne}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className={styles.appel}>
          <div className={styles.cadre}>
            <h2>Vous préparez un concours ?</h2>
            <p>Créez le compte de votre organisation et paramétrez votre premier événement.</p>
            <Link href="/inscription" className={styles.boutonClair}>
              Créer un compte
            </Link>
          </div>
        </section>
      </main>

      <footer className={styles.pied}>
        <div className={styles.cadre}>
          <span>DIGITALYX-VOTE · Inovyx Tech</span>
          <Link href="/cgu">Conditions générales</Link>
        </div>
      </footer>
    </div>
  );
}
