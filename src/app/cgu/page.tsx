import type { Metadata } from "next";
import Link from "next/link";
import styles from "./cgu.module.css";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation • Digitalyx Vote",
  description: "Conditions générales d'utilisation du vote en ligne Digitalyx Vote (INOVYX TECH).",
};

/**
 * Conditions générales d'utilisation du vote du public, liées depuis chaque
 * bouton « Voter ». Page publique, hors du groupe `(admin)`.
 */
export default function CguPage() {
  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div className={styles.in}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/inovyx-logo.png" alt="Inovyx Tech" />
          <b>Digitalyx Vote</b>
        </div>
      </header>

      <main className={`${styles.in} ${styles.main}`}>
        <h1>Conditions générales d&apos;utilisation</h1>
        <p className={styles.updated}>Dernière mise à jour : 30 septembre 2026</p>

        <section>
          <h2>1. Objet</h2>
          <p>
            Digitalyx Vote est une plateforme de vote en ligne éditée par INOVYX TECH. Elle permet au public de
            voter pour les candidats d&apos;événements organisés par des organisateurs tiers (par exemple un
            concours culinaire). Les présentes conditions encadrent l&apos;utilisation de la plateforme. Voter
            implique leur acceptation sans réserve.
          </p>
        </section>

        <section>
          <h2>2. Rôles</h2>
          <p>
            INOVYX TECH fournit la plateforme technique : affichage des candidats, enregistrement des votes et
            suivi des paiements. L&apos;organisateur de l&apos;événement reste seul responsable du concours : choix
            des candidats, règlement, calendrier, poids du vote du public dans le classement final et remise des
            prix.
          </p>
        </section>

        <section>
          <h2>3. Vote payant</h2>
          <p>
            Chaque vote est payant, au prix affiché sur la page de vote (par exemple 200 FCFA le vote). Il est
            possible d&apos;acheter plusieurs votes, pour un ou plusieurs candidats. Un vote n&apos;est compté
            qu&apos;une fois le paiement confirmé par l&apos;opérateur. Un paiement abandonné, refusé ou non
            confirmé ne donne lieu à aucun vote.
          </p>
        </section>

        <section>
          <h2>4. Paiement</h2>
          <p>
            Les paiements se font par les moyens proposés sur la page (Wave, Orange Money, MTN Mobile Money…), selon
            les conditions de chaque opérateur. Les frais éventuels appliqués par l&apos;opérateur restent à la
            charge du votant. INOVYX TECH ne reçoit ni ne conserve vos codes secrets ou données bancaires.
          </p>
        </section>

        <section>
          <h2>5. Absence de remboursement</h2>
          <p>
            Un vote confirmé est définitif : il ne peut être ni annulé, ni transféré à un autre candidat, ni
            remboursé. Seule une erreur technique avérée de la plateforme (par exemple un paiement débité deux fois
            pour un même vote) peut donner lieu à une régularisation, après vérification.
          </p>
        </section>

        <section>
          <h2>6. Ouverture et clôture</h2>
          <p>
            Le vote n&apos;est possible que pendant la période fixée par l&apos;organisateur. L&apos;heure de clôture
            est affichée sur la page. Un paiement confirmé après la clôture n&apos;est pas compté.
          </p>
        </section>

        <section>
          <h2>7. Loyauté du vote</h2>
          <p>
            Toute manœuvre visant à fausser le vote (robots, scripts, exploitation d&apos;une faille, fraude au
            paiement) est interdite. INOVYX TECH et l&apos;organisateur peuvent annuler les votes concernés sans
            remboursement.
          </p>
        </section>

        <section>
          <h2>8. Données personnelles</h2>
          <p>
            Le numéro de téléphone saisi sert uniquement à effectuer le paiement et à suivre la transaction. Il
            n&apos;est ni affiché publiquement, ni revendu, ni utilisé à des fins publicitaires. Il est conservé le
            temps nécessaire au suivi des paiements et au règlement d&apos;éventuelles réclamations, conformément à
            la loi ivoirienne n° 2013-450 du 19 juin 2013 relative à la protection des données à caractère
            personnel. Vous pouvez demander l&apos;accès à vos données ou leur suppression auprès d&apos;INOVYX TECH.
          </p>
        </section>

        <section>
          <h2>9. Disponibilité</h2>
          <p>
            INOVYX TECH met tout en œuvre pour que la plateforme reste accessible pendant la période de vote, sans
            pouvoir garantir l&apos;absence d&apos;interruption (maintenance, panne d&apos;un opérateur de
            paiement, réseau). Une indisponibilité temporaire ne donne droit à aucune indemnité.
          </p>
        </section>

        <section>
          <h2>10. Droit applicable</h2>
          <p>
            Les présentes conditions sont soumises au droit ivoirien. En cas de litige, une solution amiable sera
            recherchée avant toute action devant les juridictions compétentes d&apos;Abidjan.
          </p>
        </section>

        <p className={styles.back}>
          <Link href="/voter">← Retour au vote</Link>
        </p>
      </main>

      <footer className={styles.foot}>
        <div className={styles.in}>© 2026 INOVYX TECH · Digitalyx Vote</div>
      </footer>
    </div>
  );
}
