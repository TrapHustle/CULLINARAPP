"use client";

import { useMemo, useState } from "react";
import { basculerOrganisationAction, reglerOrganisationAction, supprimerOrganisationAction } from "@/lib/plateforme-actions";
import { BoutonEnvoi, FormulaireAction } from "./formulaire-action";
import { Icone } from "./icone";
import e from "./evenements.module.css";
import o from "./organisations.module.css";
import styles from "./panel.module.css";

export interface CarteOrganisation {
  id: string;
  nom: string;
  actif: boolean;
  mode: "sirap" | "simulation";
  partOrganisateur: number;
  email: string | null;
  selectionsOuvertes: number;
  brut: number;
  reverse: number;
}

type Filtre = "toutes" | "actives" | "reels" | "suspendues";

const FILTRES: { cle: Filtre; libelle: string; garde: (c: CarteOrganisation) => boolean }[] = [
  { cle: "toutes", libelle: "Toutes", garde: () => true },
  { cle: "actives", libelle: "Actives", garde: (c) => c.actif },
  { cle: "reels", libelle: "Paiement réel", garde: (c) => c.mode === "sirap" },
  { cle: "suspendues", libelle: "Suspendues", garde: (c) => !c.actif },
];

const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} F`;

/** Organisations clientes : filtres, recherche, suspension en un clic et réglages dépliables. */
export function ListeOrganisations({ organisations }: { organisations: CarteOrganisation[] }) {
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const [recherche, setRecherche] = useState("");
  const [ouverte, setOuverte] = useState<string | null>(null);

  const visibles = useMemo(() => {
    const garde = FILTRES.find((f) => f.cle === filtre)!.garde;
    const q = recherche.trim().toLowerCase();
    return organisations.filter((c) => garde(c) && (!q || `${c.nom} ${c.email ?? ""} ${c.id}`.toLowerCase().includes(q)));
  }, [organisations, filtre, recherche]);

  return (
    <>
      <div className={o.barre}>
        <nav className={e.onglets} aria-label="Filtrer les organisations" style={{ marginTop: 0, flex: 1 }}>
          {FILTRES.map((f) => (
            <button
              key={f.cle}
              type="button"
              aria-pressed={filtre === f.cle}
              className={`${e.onglet} ${filtre === f.cle ? e.ongletActif : ""}`}
              onClick={() => setFiltre(f.cle)}
            >
              {f.libelle} ({organisations.filter(f.garde).length})
            </button>
          ))}
        </nav>
        <label className={e.recherche}>
          <Icone nom="loupe" taille={17} />
          <input
            type="search"
            value={recherche}
            onChange={(ev) => setRecherche(ev.target.value)}
            placeholder="Nom, e-mail, ID…"
            aria-label="Rechercher une organisation"
          />
        </label>
      </div>

      {visibles.length === 0 ? (
        <div className={e.vide}>
          <strong>{organisations.length === 0 ? "Aucune organisation cliente" : "Aucune organisation ne correspond"}</strong>
          {organisations.length === 0 ? "Elles apparaîtront ici dès leur inscription." : "Changez de filtre ou de recherche."}
        </div>
      ) : (
        <div className={o.liste}>
          {visibles.map((c) => {
            const deplie = ouverte === c.id;
            return (
              <article key={c.id} className={o.carte}>
                <div className={o.ligne}>
                  <div className={`${o.avatar} ${c.actif ? "" : o.avatarEteint}`} aria-hidden="true">
                    {c.nom.trim()[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className={o.identite}>
                    <h2>{c.nom}</h2>
                    <div className={o.meta}>
                      <span className={`${styles.pastille} ${c.actif ? styles.pastilleVerte : styles.pastilleRouge}`}>
                        {c.actif ? "Active" : "Suspendue"}
                      </span>
                      <span>
                        {c.selectionsOuvertes} concours en cours
                      </span>
                    </div>
                  </div>
                  <div className={o.montant}>
                    <span>Encaissé</span>
                    <strong className={o.vert}>{fcfa(c.brut)}</strong>
                  </div>
                  <div className={o.montant}>
                    <span>Reversé</span>
                    <strong className={o.bleu}>{fcfa(c.reverse)}</strong>
                  </div>
                  <div className={o.actions}>
                    <FormulaireAction
                      action={basculerOrganisationAction.bind(null, c.id, !c.actif)}
                      confirmer={c.actif ? `Suspendre « ${c.nom} » ? Plus d'accès à l'espace, pages de vote fermées. Les données restent.` : undefined}
                      discret
                    >
                      <BoutonEnvoi className={o.interrupteur} titre={c.actif ? "Suspendre l'organisation" : "Réactiver l'organisation"}>
                        <Icone nom="sortie" taille={18} />
                      </BoutonEnvoi>
                    </FormulaireAction>
                    <button type="button" className={o.gerer} aria-expanded={deplie} onClick={() => setOuverte(deplie ? null : c.id)}>
                      {deplie ? "Fermer" : "Gérer le compte"}
                    </button>
                  </div>
                </div>

                {deplie ? (
                  <div className={o.reglages}>
                    <p className={o.compte}>
                      Propriétaire : <strong>{c.email ?? "sans compte"}</strong> · ID {c.id}
                    </p>
                    <FormulaireAction action={reglerOrganisationAction.bind(null, c.id)} className={styles.formulaire} bouton="Enregistrer" variante="secondaire">
                      <label className={styles.champ}>
                        <span>Part reversée à l&rsquo;organisation (%)</span>
                        <input name="partOrganisateur" defaultValue={String(c.partOrganisateur).replace(".", ",")} inputMode="decimal" required />
                        <small>La plateforme garde le reste en commission.</small>
                      </label>
                      <label className={styles.champ}>
                        <span>Paiements</span>
                        <select name="mode" defaultValue={c.mode}>
                          <option value="simulation">Simulation (rien n&rsquo;est prélevé)</option>
                          <option value="sirap">Réels (passerelle SIRAP)</option>
                        </select>
                      </label>
                      {/* L'état actif se règle par le bouton marche/arrêt : on le renvoie tel quel. */}
                      {c.actif ? <input type="hidden" name="actif" value="on" /> : null}
                    </FormulaireAction>
                    <FormulaireAction
                      action={supprimerOrganisationAction.bind(null, c.id)}
                      bouton="Supprimer l'organisation"
                      variante="danger"
                      confirmer={`Supprimer définitivement « ${c.nom} » et ses données ?`}
                      style={{ padding: "0 24px 20px" }}
                    />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
