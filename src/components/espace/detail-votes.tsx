"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { DetailVotes as Detail, PaiementDetaille, TypeDetaille, VoteDetaille } from "@/lib/detail-votes";
import { Portrait } from "./candidat";
import styles from "./panel.module.css";
import r from "./resultats.module.css";

export interface CandidatDetail {
  participationId: string;
  nom: string;
  photoUrl: string | null;
  rang: number | null;
  note: number | null;
  types: { typeVoteId: string; note: number | null; volume: number }[];
}

const FUSEAU = "Africa/Abidjan";
const heure = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: FUSEAU });
const decimal = (n: number, chiffres = 2) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: chiffres, maximumFractionDigits: chiffres });
const entier = (n: number) => n.toLocaleString("fr-FR");
const quand = (iso: string) => heure.format(new Date(iso)).replace(" ", " · ");

const MOYENS: Record<string, string> = { WAVE: "Wave", ORANGE_MONEY: "Orange Money", MTN: "MTN MoMo", CARD: "Carte" };

/**
 * Tiroir du détail des votes. La page Résultats reste rendue par le serveur :
 * tout élément portant `data-detail-candidat` (une note, « Détails ») l'ouvre,
 * sur l'onglet `data-detail-type` s'il est donné.
 */
export function DetailVotes({
  selectionId,
  essai,
  types,
  candidats,
}: {
  selectionId: string;
  essai: boolean;
  types: { id: string; libelle: string; part: number; canal: string }[];
  candidats: CandidatDetail[];
}) {
  const dialogue = useRef<HTMLDialogElement>(null);
  const [ouvert, setOuvert] = useState<{ participationId: string; typeId: string } | null>(null);
  const [details, setDetails] = useState<Record<string, Detail | "erreur">>({});

  useEffect(() => {
    const surClic = (e: MouseEvent) => {
      const cible = (e.target as Element | null)?.closest<HTMLElement>("[data-detail-candidat]");
      if (!cible) return;
      e.preventDefault();
      setOuvert({ participationId: cible.dataset.detailCandidat!, typeId: cible.dataset.detailType ?? types[0]?.id ?? "" });
      dialogue.current?.showModal();
    };
    document.addEventListener("click", surClic);
    return () => document.removeEventListener("click", surClic);
  }, [types]);

  const participationId = ouvert?.participationId;
  useEffect(() => {
    if (!participationId || details[participationId]) return;
    const url = `/api/espace/resultats/${selectionId}/detail?participation=${encodeURIComponent(participationId)}${essai ? "&essai=1" : ""}`;
    fetch(url, { cache: "no-store" })
      .then((reponse) => (reponse.ok ? reponse.json() : Promise.reject(reponse.status)))
      .then((detail: Detail) => setDetails((d) => ({ ...d, [participationId]: detail })))
      .catch(() => setDetails((d) => ({ ...d, [participationId]: "erreur" })));
  }, [participationId, details, selectionId, essai]);

  const candidat = candidats.find((c) => c.participationId === participationId);
  const detail = participationId ? details[participationId] : undefined;
  const type = types.find((t) => t.id === ouvert?.typeId);
  const typeDetail = detail && detail !== "erreur" ? detail.types.find((t) => t.typeVoteId === ouvert?.typeId) : undefined;
  const noteDuType = (id: string) => candidat?.types.find((t) => t.typeVoteId === id);

  const fermer = () => {
    dialogue.current?.close();
  };

  return (
    <dialog
      ref={dialogue}
      className={r.tiroir}
      aria-labelledby="detail-votes-titre"
      onClose={() => setOuvert(null)}
      onClick={(e) => {
        // Un clic sur le fond ferme le tiroir, comme la touche Échap.
        if (e.target === dialogue.current) fermer();
      }}
    >
      {candidat ? (
        <>
          <div className={r.tiroirTete}>
            <div className={r.tiroirLigne}>
              <Portrait nom={candidat.nom} photoUrl={candidat.photoUrl} taille={52} />
              <div className={r.tiroirTitre}>
                <small>
                  {candidat.rang ? `${candidat.rang}ᵉ · ` : ""}
                  {candidat.note === null ? "non noté" : `${decimal(candidat.note)} / 100`} · Détail des votes
                </small>
                <h2 id="detail-votes-titre">{candidat.nom}</h2>
              </div>
              <button type="button" className={r.tiroirFermer} onClick={fermer} aria-label="Fermer">
                ✕
              </button>
            </div>
            <div className={r.tiroirOnglets} role="tablist">
              {types.map((t) => {
                const n = noteDuType(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={t.id === ouvert?.typeId}
                    className={r.tiroirOnglet}
                    onClick={() => setOuvert((o) => (o ? { ...o, typeId: t.id } : o))}
                  >
                    {t.libelle}
                    <b>{n?.note == null ? "—" : decimal(n.note)}</b>
                  </button>
                );
              })}
            </div>
          </div>
          <div className={r.tiroirCorps}>
            {detail === undefined ? (
              <p className={styles.vide}>Chargement des votes…</p>
            ) : detail === "erreur" ? (
              <p className={styles.vide}>Impossible de charger les votes. Réessayez dans un instant.</p>
            ) : typeDetail && type ? (
              <CorpsType
                type={typeDetail}
                note={noteDuType(type.id)?.note ?? null}
                prixVote={detail.prixVote}
                participationId={candidat.participationId}
              />
            ) : (
              <p className={styles.vide}>Ce type de vote n’existe plus.</p>
            )}
          </div>
        </>
      ) : null}
    </dialog>
  );
}

function CorpsType({ type, note, prixVote, participationId }: { type: TypeDetaille; note: number | null; prixVote: number; participationId: string }) {
  if (type.paiements) return <CorpsPaiements type={type} note={note} prixVote={prixVote} participationId={participationId} />;
  if (type.avecCriteres) return <CorpsCriteres type={type} note={note} />;
  return <CorpsVoix type={type} note={note} />;
}

function Calcul({ note, children }: { note: number | null; children: ReactNode }) {
  return (
    <div className={r.calcul}>
      <div className={r.calculNote}>
        {note === null ? "—" : decimal(note)}
        <span> / 100</span>
      </div>
      <p>{children}</p>
    </div>
  );
}

/** Vote avec critères : moyenne des totaux, ramenée sur 100. */
function CorpsCriteres({ type, note }: { type: TypeDetaille; note: number | null }) {
  const comptes = type.votes.filter((v) => !v.annuleLe);
  const annules = type.votes.length - comptes.length;
  if (type.votes.length === 0) return <div className={styles.vide}>Aucun vote {type.libelle} pour ce candidat.</div>;
  const moyenne = comptes.length ? comptes.reduce((s, v) => s + (v.total ?? 0), 0) / comptes.length : 0;
  const parCritere = type.criteres.map((_, i) => (comptes.length ? comptes.reduce((s, v) => s + (v.valeurs?.[i] ?? 0), 0) / comptes.length : 0));

  return (
    <>
      <Calcul note={note}>
        Moyenne des {comptes.length} vote{comptes.length > 1 ? "s" : ""} :{" "}
        <b>
          {decimal(moyenne)} / {type.baremeTotal}
        </b>{" "}
        points, ramenée sur 100.
        <small>
          {decimal(moyenne)} ÷ {type.baremeTotal} × 100 = {decimal(type.baremeTotal ? (moyenne / type.baremeTotal) * 100 : 0)} · compte pour{" "}
          {entier(type.part)} % de la note finale
          {annules ? ` · ${annules} vote${annules > 1 ? "s" : ""} annulé${annules > 1 ? "s" : ""} ou corrigé${annules > 1 ? "s" : ""}, non compté${annules > 1 ? "s" : ""}` : ""}
        </small>
      </Calcul>

      <h3 className={r.tiroirSousTitre}>Moyenne par critère</h3>
      <div className={r.criteresMoyens}>
        {type.criteres.map((c, i) => (
          <div key={c.libelle} className={r.critereMoyen}>
            <span>{c.libelle}</span>
            <span className={r.pisteCritere}>
              <i style={{ width: `${c.bareme ? Math.min(100, (parCritere[i] / c.bareme) * 100) : 0}%` }} />
            </span>
            <b>
              {decimal(parCritere[i], 1)} / {c.bareme}
            </b>
          </div>
        ))}
      </div>

      <h3 className={r.tiroirSousTitre}>Chaque vote</h3>
      <div className={r.detailBoite}>
        <table className={`${styles.tableau} ${r.detailTableau}`}>
          <thead>
            <tr>
              <th>Votant</th>
              <th>Provenance</th>
              {type.criteres.map((c) => (
                <th key={c.libelle} className={r.nombre}>
                  {c.libelle} /{c.bareme}
                </th>
              ))}
              <th className={r.nombre}>Total /{type.baremeTotal}</th>
              <th className={r.nombre}>Heure</th>
            </tr>
          </thead>
          <tbody>
            {type.votes.map((v) => (
              <tr key={v.id} className={v.annuleLe ? r.annule : undefined}>
                <td>
                  <EtiquetteVotant vote={v} />
                </td>
                <td className={r.doux}>{v.provenance}</td>
                {(v.valeurs ?? []).map((x, i) => (
                  <td key={i} className={`${r.nombre} ${r.barre}`}>
                    {x}
                  </td>
                ))}
                <td className={`${r.nombre} ${r.barre}`}>
                  <b>{v.total}</b>
                </td>
                <td className={`${r.nombre} ${r.doux}`}>{quand(v.creeLe)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>
                Moyenne ({comptes.length} vote{comptes.length > 1 ? "s" : ""} compté{comptes.length > 1 ? "s" : ""})
              </td>
              {parCritere.map((m, i) => (
                <td key={i} className={r.nombre}>
                  {decimal(m, 1)}
                </td>
              ))}
              <td className={r.nombre}>{decimal(moyenne)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className={r.votesCartes}>
        {type.votes.map((v) => (
          <div key={v.id} className={`${r.voteCarte} ${v.annuleLe ? r.annule : ""}`}>
            <div className={r.voteL1}>
              <EtiquetteVotant vote={v} />
              <span>{v.annuleLe ? <s>{v.total}</s> : v.total} / {type.baremeTotal}</span>
            </div>
            <div className={r.voteL2}>
              <span>{type.criteres.map((c, i) => `${c.libelle} ${v.valeurs?.[i] ?? 0}`).join(" · ")}</span>
              <span>
                {v.provenance} · {quand(v.creeLe)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function EtiquetteVotant({ vote }: { vote: VoteDetaille }) {
  return (
    <span>
      {vote.votant}
      {vote.annuleLe ? (
        <span className={`${styles.pastille} ${r.pastilleDetail}`}>{`annulé ${quand(vote.annuleLe)}`}</span>
      ) : vote.correction ? (
        <span className={`${styles.pastille} ${styles.pastilleVerte} ${r.pastilleDetail}`}>correction</span>
      ) : null}
    </span>
  );
}

/** Vote par voix (QR, gratuit, salle sans critère) : part des voix. */
function CorpsVoix({ type, note }: { type: TypeDetaille; note: number | null }) {
  const comptes = type.votes.filter((v) => !v.annuleLe);
  const voix = comptes.reduce((s, v) => s + v.poids, 0);
  if (type.votes.length === 0) return <div className={styles.vide}>Aucune voix {type.libelle} pour ce candidat.</div>;
  return (
    <>
      <Calcul note={note}>
        <b>
          {entier(voix)} voix
        </b>{" "}
        sur les {entier(type.voixSelection)} voix de la sélection pour ce vote.
        <small>
          {entier(voix)} ÷ {entier(type.voixSelection)} × 100 = {decimal(type.voixSelection ? (voix / type.voixSelection) * 100 : 0)} · compte pour{" "}
          {entier(type.part)} %
        </small>
      </Calcul>
      <h3 className={r.tiroirSousTitre}>Chaque voix</h3>
      <div className={r.detailBoite}>
        <table className={`${styles.tableau} ${r.detailTableau}`}>
          <thead>
            <tr>
              <th>Votant</th>
              <th>Provenance</th>
              <th className={r.nombre}>Voix</th>
              <th className={r.nombre}>Heure</th>
            </tr>
          </thead>
          <tbody>
            {type.votes.map((v) => (
              <tr key={v.id} className={v.annuleLe ? r.annule : undefined}>
                <td>
                  <EtiquetteVotant vote={v} />
                </td>
                <td className={r.doux}>{v.provenance}</td>
                <td className={`${r.nombre} ${r.barre}`}>{entier(v.poids)}</td>
                <td className={`${r.nombre} ${r.doux}`}>{quand(v.creeLe)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={r.votesCartes}>
        {type.votes.map((v) => (
          <div key={v.id} className={`${r.voteCarte} ${v.annuleLe ? r.annule : ""}`}>
            <div className={r.voteL1}>
              <EtiquetteVotant vote={v} />
              <span>{entier(v.poids)} voix</span>
            </div>
            <div className={r.voteL2}>
              <span>{v.provenance}</span>
              <span>{quand(v.creeLe)}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

const STATUTS: Record<string, [string, string]> = {
  CONFIRMED: ["confirmé", styles.pastilleVerte],
  PENDING: ["en attente", styles.pastilleOrange],
  FAILED: ["échoué", styles.pastilleRouge],
};

function Statut({ p }: { p: PaiementDetaille }) {
  if (p.simule) return <span className={styles.pastille}>{p.compte ? "simulé · compté (essai)" : "simulé · non compté"}</span>;
  const [texte, classe] = STATUTS[p.statut] ?? [p.statut, ""];
  return <span className={`${styles.pastille} ${classe}`}>{texte}</span>;
}

/** Vote en ligne payant : un paiement par ligne, et le calcul selon le mode. */
function CorpsPaiements({ type, note, prixVote, participationId }: { type: TypeDetaille; note: number | null; prixVote: number; participationId: string }) {
  const [filtre, setFiltre] = useState<"tous" | "comptes" | "autres">("tous");
  const paiements = (type.paiements ?? []).filter((p) => p.participationId === participationId);
  const comptes = paiements.filter((p) => p.compte);
  const voix = comptes.reduce((s, p) => s + p.voix, 0);
  const montant = comptes.reduce((s, p) => s + p.montant, 0);
  const visibles = paiements.filter((p) => filtre === "tous" || (filtre === "comptes") === p.compte);

  return (
    <>
      <Calcul note={note}>
        <b>{entier(voix)} voix</b>
        {type.mode === "A"
          ? ` sur les ${entier(type.voixSelection)} voix confirmées de la sélection.`
          : type.mode === "B"
            ? " : la note suit les paliers réglés dans le vote en ligne."
            : " : la note est rapportée au candidat qui a le plus de voix (100)."}
        <small>
          {type.mode === "A"
            ? `${entier(voix)} ÷ ${entier(type.voixSelection)} × 100 = ${decimal(type.voixSelection ? (voix / type.voixSelection) * 100 : 0)} · `
            : ""}
          {comptes.length} paiement{comptes.length > 1 ? "s" : ""} · {entier(montant)} FCFA · {entier(prixVote)} FCFA la voix · compte pour{" "}
          {entier(type.part)} %
        </small>
      </Calcul>

      <h3 className={r.tiroirSousTitre}>Paiements</h3>
      {paiements.length === 0 ? (
        <div className={styles.vide}>Aucun paiement pour ce candidat.</div>
      ) : (
        <>
          <div className={r.filtres}>
            {(
              [
                ["tous", `Tous · ${paiements.length}`],
                ["comptes", `Comptés · ${comptes.length}`],
                ["autres", `Non comptés · ${paiements.length - comptes.length}`],
              ] as const
            ).map(([cle, libelle]) => (
              <button key={cle} type="button" className={r.filtre} aria-pressed={filtre === cle} onClick={() => setFiltre(cle)}>
                {libelle}
              </button>
            ))}
          </div>
          <div className={r.detailBoite}>
            <table className={`${styles.tableau} ${r.detailTableau}`}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Référence</th>
                  <th>Moyen</th>
                  <th>Téléphone</th>
                  <th className={r.nombre}>Voix</th>
                  <th className={r.nombre}>Montant</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((p) => (
                  <tr key={p.id} className={p.compte ? undefined : r.annule}>
                    <td className={r.doux}>{quand(p.creeLe)}</td>
                    <td>{p.reference}</td>
                    <td>{MOYENS[p.moyen] ?? p.moyen}</td>
                    <td>{p.telephone}</td>
                    <td className={`${r.nombre} ${r.barre}`}>
                      <b>{entier(p.voix)}</b>
                    </td>
                    <td className={r.nombre}>{entier(p.montant)} F</td>
                    <td>
                      <Statut p={p} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>Total compté</td>
                  <td className={r.nombre}>{entier(voix)}</td>
                  <td className={r.nombre}>{entier(montant)} F</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <div className={r.votesCartes}>
            {visibles.map((p) => (
              <div key={p.id} className={`${r.voteCarte} ${p.compte ? "" : r.annule}`}>
                <div className={r.voteL1}>
                  <span>
                    {entier(p.voix)} voix · {entier(p.montant)} F
                  </span>
                  <Statut p={p} />
                </div>
                <div className={r.voteL2}>
                  <span>
                    {MOYENS[p.moyen] ?? p.moyen} · {p.telephone}
                  </span>
                  <span>
                    {quand(p.creeLe)} · {p.reference}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {type.votes.length > 0 ? (
        <p className={r.doux} style={{ marginTop: 12 }}>
          + {entier(type.votes.filter((v) => !v.annuleLe).reduce((s, v) => s + v.poids, 0))} voix sans paiement (gratuites, saisies ou importées), comptées aussi.
        </p>
      ) : null}
    </>
  );
}
