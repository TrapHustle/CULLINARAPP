import type { Metadata } from "next";
import Link from "next/link";
import { Icone } from "@/components/espace/icone";
import styles from "@/components/espace/panel.module.css";
import { exigerSuperAdmin } from "@/lib/espace";
import { nombre, salutation } from "@/lib/format-espace";
import { chiffresPlateforme, listerRetraitsPlateforme } from "@/lib/plateforme";

export const metadata: Metadata = { title: "Plateforme — DIGITALYX-VOTE" };

const fcfa = (n: number) => `${nombre(n)} FCFA`;

export default async function PagePlateforme() {
  await exigerSuperAdmin();
  const [c, retraits] = await Promise.all([chiffresPlateforme(), listerRetraitsPlateforme()]);
  const aTraiter = retraits.filter((r) => r.statut === "PENDING");

  return (
    <>
      <div className={styles.entete}>
        <div>
          <div className={styles.surtitre}>Console plateforme</div>
          <h1 className={styles.titre}>
            {salutation()}, <em>Inovyx</em>
          </h1>
          <p className={styles.sousTitre}>
            {c.ouvertes > 0 ? `${c.ouvertes} sélection${c.ouvertes > 1 ? "s" : ""} ouverte${c.ouvertes > 1 ? "s" : ""} au vote en ce moment.` : "Aucun vote ouvert en ce moment."}
          </p>
        </div>
      </div>

      <div className={styles.chiffres}>
        <div className={styles.chiffre}>
          <div className={`${styles.chiffreIcone} ${styles.bleu}`}>
            <Icone nom="globe" taille={20} />
          </div>
          <span className={styles.chiffreLibelle}>Organisations clientes</span>
          <strong className={styles.chiffreValeur}>{nombre(c.organisations)}</strong>
          <span className={styles.chiffreDetail}>
            {c.suspendues > 0 ? `${c.suspendues} suspendue${c.suspendues > 1 ? "s" : ""} · ` : ""}
            {nombre(c.evenements)} événement{c.evenements > 1 ? "s" : ""}
          </span>
        </div>
        <div className={styles.chiffre}>
          <div className={`${styles.chiffreIcone} ${styles.vert}`}>
            <Icone nom="billet" taille={20} />
          </div>
          <span className={styles.chiffreLibelle}>Encaissé (votes réels)</span>
          <strong className={styles.chiffreValeur}>{fcfa(c.brut)}</strong>
          <span className={styles.chiffreDetail}>
            {nombre(c.paiements)} paiement{c.paiements > 1 ? "s" : ""} · {nombre(c.simules)} simulé{c.simules > 1 ? "s" : ""}
          </span>
        </div>
        <div className={styles.chiffre}>
          <div className={`${styles.chiffreIcone} ${styles.violet}`}>
            <Icone nom="trophee" taille={20} />
          </div>
          <span className={styles.chiffreLibelle}>Commission plateforme</span>
          <strong className={styles.chiffreValeur}>{fcfa(c.commission)}</strong>
          <span className={styles.chiffreDetail}>Déjà reversé aux clients : {fcfa(c.reverse)}</span>
        </div>
      </div>

      <section className={styles.carte}>
        <div className={styles.carteHaut}>
          <div>
            <h2 className={styles.carteTitre}>Retraits à traiter</h2>
            <p className={styles.carteTexte}>
              {aTraiter.length === 0
                ? "Aucune demande en attente."
                : `${aTraiter.length} demande${aTraiter.length > 1 ? "s" : ""} · ${fcfa(c.retraitsAttente.montant)} à virer.`}
            </p>
          </div>
          <Link href="/plateforme/reversements" className={`${styles.bouton} ${styles.boutonSecondaire}`}>
            Ouvrir les reversements
          </Link>
        </div>
        {aTraiter.length > 0 ? (
          <ul className={styles.lignes}>
            {aTraiter.slice(0, 5).map((r) => (
              <li key={r.id} className={styles.ligne}>
                <div className={styles.ligneTexte}>
                  <span className={styles.ligneTitre}>{r.organisation.nom}</span>
                  <div className={styles.ligneMeta}>
                    <span>{r.moyen}</span>
                    <span>{r.telephone}</span>
                  </div>
                </div>
                <strong>{fcfa(r.montant)}</strong>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </>
  );
}
