"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { StatutEvenement } from "@/lib/evenements-core";
import { nouvelleEditionAction } from "@/lib/evenements-actions";
import { BoutonEnvoi, FormulaireAction } from "./formulaire-action";
import { Icone } from "./icone";
import e from "./evenements.module.css";

export interface CarteEvenement {
  id: string;
  nom: string;
  edition: number | null;
  afficheUrl: string | null;
  organisation: string;
  statut: StatutEvenement;
  lieu: string | null;
  /** Date ISO, ou `null`. */
  date: string | null;
  candidats: number;
  voix: number;
}

const ONGLETS: { cle: StatutEvenement; libelle: string }[] = [
  { cle: "EN_COURS", libelle: "En cours" },
  { cle: "A_VENIR", libelle: "À venir" },
  { cle: "PASSE", libelle: "Événements passés" },
];

const BADGES: Record<StatutEvenement, { texte: string; classe: string }> = {
  EN_COURS: { texte: "En direct", classe: e.badgeDirect },
  A_VENIR: { texte: "À venir", classe: e.badgeVenir },
  PASSE: { texte: "Terminé", classe: e.badgePasse },
};

const nf = (n: number) => n.toLocaleString("fr-FR");
const jour = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Africa/Abidjan" });
const edition = (n: number | null) => (n === null ? null : `${n}${n === 1 ? "re" : "e"} édition`);

/** Onglets, recherche et cartes de la page « Mes événements ». */
export function ListeEvenements({ evenements, modifiable }: { evenements: CarteEvenement[]; modifiable: boolean }) {
  // Premier onglet non vide, pour ne pas ouvrir la page sur une liste vide.
  const [onglet, setOnglet] = useState<StatutEvenement>(
    () => ONGLETS.find((o) => evenements.some((ev) => ev.statut === o.cle))?.cle ?? "EN_COURS",
  );
  const [recherche, setRecherche] = useState("");

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return evenements.filter(
      (ev) => ev.statut === onglet && (!q || `${ev.nom} ${ev.lieu ?? ""} ${edition(ev.edition) ?? ""}`.toLowerCase().includes(q)),
    );
  }, [evenements, onglet, recherche]);

  return (
    <>
      <div className={e.entete}>
        <div>
          <div className={e.surtitre}>Centre de contrôle</div>
          <h1 className={e.titre}>
            Mes événements<span>.</span>
          </h1>
        </div>
        <div className={e.outils}>
          <label className={e.recherche}>
            <Icone nom="loupe" taille={17} />
            <input
              type="search"
              value={recherche}
              onChange={(ev) => setRecherche(ev.target.value)}
              placeholder="Rechercher un concours…"
              aria-label="Rechercher un concours"
            />
          </label>
          {modifiable && evenements.length > 0 ? (
            <details className={e.edition}>
              <summary className={`${e.bouton} ${e.boutonBleu}`}>+ Nouvelle édition</summary>
              <div className={e.menu}>
                <p>Reprendre le nom, l&rsquo;affiche et la grille d&rsquo;un concours pour sa prochaine édition :</p>
                {evenements.map((ev) => (
                  <FormulaireAction key={ev.id} action={nouvelleEditionAction.bind(null, ev.id)} discret>
                    <BoutonEnvoi className={e.choixEdition}>
                      <strong>{ev.nom}</strong>
                      <span>{edition(ev.edition) ?? "sans numéro"} → {ev.edition === null ? "copie" : edition(ev.edition + 1)}</span>
                    </BoutonEnvoi>
                  </FormulaireAction>
                ))}
              </div>
            </details>
          ) : null}
          {modifiable ? (
            <Link href="/espace/evenements/nouveau" className={`${e.bouton} ${e.boutonNoir}`}>
              + Créer
            </Link>
          ) : null}
        </div>
      </div>

      <nav className={e.onglets} aria-label="Filtrer les événements">
        {ONGLETS.map((o) => (
          <button
            key={o.cle}
            type="button"
            aria-pressed={onglet === o.cle}
            className={`${e.onglet} ${onglet === o.cle ? e.ongletActif : ""}`}
            onClick={() => setOnglet(o.cle)}
          >
            {o.libelle} ({evenements.filter((ev) => ev.statut === o.cle).length})
          </button>
        ))}
      </nav>

      {evenements.length === 0 ? (
        <div className={e.vide}>
          <strong>Aucun événement pour l&rsquo;instant</strong>
          Créez votre premier concours pour commencer.
          {modifiable ? (
            <div>
              <Link href="/espace/evenements/nouveau" className={`${e.bouton} ${e.boutonBleu}`}>
                Créer un événement
              </Link>
            </div>
          ) : null}
        </div>
      ) : visibles.length === 0 ? (
        <div className={e.vide}>
          <strong>Aucun concours ici</strong>
          Changez d&rsquo;onglet ou de recherche.
        </div>
      ) : (
        <div className={e.grille}>
          {visibles.map((ev) => {
            const badge = BADGES[ev.statut];
            const ed = edition(ev.edition);
            return (
              <Link key={ev.id} href={`/espace/e/${ev.id}`} className={e.carte}>
                <div className={e.visuel}>
                  {ev.afficheUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ev.afficheUrl} alt="" />
                  ) : null}
                  <span className={`${e.badge} ${badge.classe}`}>{badge.texte}</span>
                  <span className={e.accroche}>{ev.nom}</span>
                </div>
                <div className={e.corps}>
                  <div className={e.organisation}>
                    <Icone nom="personne" taille={13} />
                    {ev.organisation}
                  </div>
                  {ev.lieu || ev.date ? (
                    <div className={e.lieu}>{[ev.lieu, ev.date ? jour(ev.date) : null].filter(Boolean).join(" • ")}</div>
                  ) : null}
                  <h2 className={e.nom}>
                    {ev.nom} {ed ? <span>{ed}</span> : null}
                  </h2>
                  <div className={e.chiffres}>
                    {nf(ev.candidats)} candidat{ev.candidats > 1 ? "s" : ""} · <strong>{nf(ev.voix)} voix</strong>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
