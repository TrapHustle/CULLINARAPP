"use client";

import { useEffect, useState } from "react";
import styles from "./proclamation.module.css";

interface Ligne {
  id: string;
  rang: number;
  nom: string;
  ville: string | null;
  photoUrl: string | null;
  note: number;
  qualifie: boolean;
  egalite: boolean;
}

const note = (n: number) => (Math.round(n * 100) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 });

/**
 * Dévoilement du classement, du dernier au premier. Espace, Entrée ou flèche
 * droite : candidat suivant ; flèche gauche : retour.
 */
export function Proclamation({
  evenement,
  selection,
  afficheUrl,
  officiel,
  lignes,
}: {
  evenement: string;
  selection: string;
  afficheUrl: string | null;
  officiel: boolean;
  lignes: Ligne[];
}) {
  // Nombre de candidats dévoilés, en partant du dernier.
  const [devoiles, setDevoiles] = useState(0);
  const total = lignes.length;

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if ([" ", "Enter", "ArrowRight", "PageDown"].includes(e.key)) {
        e.preventDefault();
        setDevoiles((n) => Math.min(total, n + 1));
      }
      if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)) setDevoiles((n) => Math.max(0, n - 1));
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [total]);

  const visibles = lignes.slice(total - devoiles);
  const dernierDevoile = visibles[0];
  const podium = devoiles === total && total > 0;

  return (
    <div className={styles.ecran}>
      {afficheUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={afficheUrl} alt="" className={styles.affiche} />
      ) : null}
      <div className={styles.voile} />

      <header className={styles.tete}>
        <div>
          <p className={styles.surtitre}>{evenement}</p>
          <h1 className={styles.titre}>
            Résultats <em>{selection}</em>
          </h1>
        </div>
        <span className={styles.badge}>{officiel ? "Résultats officiels" : "Classement provisoire"}</span>
      </header>

      <main className={styles.scene}>
        {total === 0 ? (
          <p className={styles.attente}>Aucun candidat noté pour l&rsquo;instant.</p>
        ) : devoiles === 0 ? (
          <div className={styles.attente}>
            <p>{total} candidats</p>
            <button type="button" className={styles.bouton} onClick={() => setDevoiles(1)}>
              Commencer la proclamation
            </button>
          </div>
        ) : (
          <>
            {dernierDevoile ? (
              <div key={dernierDevoile.id} className={`${styles.vedette} ${dernierDevoile.rang === 1 ? styles.vedetteOr : ""}`}>
                <div className={styles.vedettePhoto}>
                  {dernierDevoile.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={dernierDevoile.photoUrl} alt="" />
                  ) : (
                    <span>{dernierDevoile.nom.slice(0, 1)}</span>
                  )}
                </div>
                <div>
                  <p className={styles.vedetteRang}>
                    {dernierDevoile.rang === 1 ? "Vainqueur" : `${dernierDevoile.rang}ᵉ place`}
                    {dernierDevoile.egalite ? " · ex æquo" : ""}
                  </p>
                  <h2 className={styles.vedetteNom}>{dernierDevoile.nom}</h2>
                  <p className={styles.vedetteNote}>
                    {note(dernierDevoile.note)} <small>/ 100</small>
                    {dernierDevoile.ville ? <span> · {dernierDevoile.ville}</span> : null}
                  </p>
                </div>
              </div>
            ) : null}

            <ol className={`${styles.liste} ${podium ? styles.listePodium : ""}`}>
              {visibles.slice(podium ? 0 : 1).map((l) => (
                <li key={l.id} className={l.qualifie ? styles.qualifie : undefined}>
                  <span className={`${styles.rang} ${l.rang <= 3 ? styles[`rang${l.rang}`] : ""}`}>{l.rang}</span>
                  <span className={styles.nom}>{l.nom}</span>
                  {l.qualifie ? <span className={styles.qualifieBadge}>Qualifié</span> : null}
                  <span className={styles.note}>{note(l.note)}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </main>

      <footer className={styles.pied}>
        <span>
          {devoiles} / {total} dévoilés · Espace ou → : suivant · ← : retour
        </span>
        <span>
          <button type="button" onClick={() => setDevoiles((n) => Math.max(0, n - 1))} disabled={devoiles === 0}>
            Retour
          </button>
          <button type="button" onClick={() => setDevoiles((n) => Math.min(total, n + 1))} disabled={devoiles === total}>
            Suivant
          </button>
          <button type="button" onClick={() => setDevoiles(total)} disabled={devoiles === total}>
            Tout afficher
          </button>
        </span>
        <span>DIGITALYX-VOTE</span>
      </footer>
    </div>
  );
}
