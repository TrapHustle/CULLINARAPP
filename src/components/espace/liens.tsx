"use client";

import { useMemo, useState } from "react";
import { retirerNumeroAction } from "@/lib/vote-qr-actions";
import { telephoneLisible } from "@/lib/vote-qr-core";
import { BoutonEnvoi, FormulaireAction } from "./formulaire-action";
import { Icone } from "./icone";
import styles from "./panel.module.css";
import l from "./liens.module.css";

/** Copie le lien dans le presse-papiers et le dit. */
export function BoutonCopier({ texte }: { texte: string }) {
  const [copie, setCopie] = useState(false);
  return (
    <button
      type="button"
      className={`${styles.bouton} ${styles.boutonSecondaire} ${styles.boutonPetit}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texte);
          setCopie(true);
          setTimeout(() => setCopie(false), 2000);
        } catch {
          window.prompt("Copiez le lien :", texte);
        }
      }}
    >
      {copie ? "Lien copié ✓" : "Copier le lien"}
    </button>
  );
}

export interface NumeroLigne {
  id: string;
  telephone: string;
  nom: string | null;
  source: string;
  /** Heure du vote (ISO), ou `null` si ce numéro n'a pas encore voté. */
  voteLe: string | null;
}

type Filtre = "tous" | "vote" | "attente";

const heure = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });

/** Liste des numéros autorisés : recherche, filtre « a voté / pas encore », retrait. */
export function ListeNumeros({ typeVoteId, numeros, modifiable }: { typeVoteId: string; numeros: NumeroLigne[]; modifiable: boolean }) {
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("tous");

  const ontVote = numeros.filter((n) => n.voteLe).length;
  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const chiffres = q.replace(/\D/g, "");
    return numeros.filter((n) => {
      if (filtre === "vote" && !n.voteLe) return false;
      if (filtre === "attente" && n.voteLe) return false;
      if (!q) return true;
      return (n.nom ?? "").toLowerCase().includes(q) || (chiffres !== "" && n.telephone.replace(/\D/g, "").includes(chiffres));
    });
  }, [numeros, recherche, filtre]);

  if (numeros.length === 0) {
    return (
      <div className={styles.vide}>
        <strong>Aucun numéro pour l&rsquo;instant</strong>
        Tant que la liste est vide, personne ne peut voter par ce lien.
      </div>
    );
  }

  const filtres: { cle: Filtre; libelle: string }[] = [
    { cle: "tous", libelle: `Tous (${numeros.length})` },
    { cle: "vote", libelle: `Ont voté (${ontVote})` },
    { cle: "attente", libelle: `Pas encore (${numeros.length - ontVote})` },
  ];

  return (
    <>
      <div className={l.filtres}>
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un numéro ou un nom"
          aria-label="Rechercher un numéro ou un nom"
        />
        {filtres.map((f) => (
          <button
            key={f.cle}
            type="button"
            aria-pressed={filtre === f.cle}
            className={`${styles.pastille} ${l.filtre} ${filtre === f.cle ? styles.pastilleBleue : ""}`}
            onClick={() => setFiltre(f.cle)}
          >
            {f.libelle}
          </button>
        ))}
        <a className={`${styles.bouton} ${styles.boutonSecondaire} ${styles.boutonPetit} ${l.exporter}`} href={`/espace/numeros/${typeVoteId}`}>
          Exporter (CSV)
        </a>
      </div>
      <div className={styles.tableauBoite}>
        <table className={styles.tableau}>
          <thead>
            <tr>
              <th>Téléphone</th>
              <th>Nom</th>
              <th>Statut</th>
              <th>Ajouté par</th>
              {modifiable ? <th aria-label="Actions" /> : null}
            </tr>
          </thead>
          <tbody>
            {visibles.slice(0, 500).map((n) => (
              <tr key={n.id}>
                <td className={l.numero}>{telephoneLisible(n.telephone)}</td>
                <td>{n.nom ?? "—"}</td>
                <td>
                  {n.voteLe ? (
                    <span className={`${styles.pastille} ${styles.pastilleVerte}`}>A voté · {heure(n.voteLe)}</span>
                  ) : (
                    <span className={styles.pastille}>Pas encore voté</span>
                  )}
                </td>
                <td>{n.source === "SAISIE" ? "Saisie" : n.source}</td>
                {modifiable ? (
                  <td>
                    {n.voteLe ? null : (
                      <FormulaireAction action={retirerNumeroAction.bind(null, typeVoteId, n.id)} confirmer={`Retirer ${telephoneLisible(n.telephone)} de la liste ?`} discret>
                        <BoutonEnvoi className={`${styles.bouton} ${styles.boutonSecondaire} ${styles.boutonIcone}`} titre="Retirer ce numéro">
                          <Icone nom="corbeille" taille={15} />
                        </BoutonEnvoi>
                      </FormulaireAction>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visibles.length > 500 ? (
        <p className={styles.carteTexte}>500 premiers numéros affichés sur {visibles.length} : affinez la recherche, ou exportez la liste.</p>
      ) : visibles.length === 0 ? (
        <p className={styles.carteTexte}>Aucun numéro ne correspond.</p>
      ) : null}
    </>
  );
}
