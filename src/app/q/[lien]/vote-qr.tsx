"use client";

import { useState } from "react";
import { noterQrAction, verifierNumeroAction, voterQrAction } from "@/lib/vote-qr-actions";
import styles from "./q.module.css";

interface Candidat {
  id: string;
  nom: string;
  ville: string | null;
  photoUrl: string | null;
}

interface Critere {
  id: string;
  libelle: string;
  bareme: number;
}

interface Props {
  lien: string;
  titre: string;
  selection: string;
  evenement: string;
  restreint: boolean;
  ouvert: boolean;
  /** Critères d'un vote noté ; `null` pour un vote par voix. */
  criteres: Critere[] | null;
  candidats: Candidat[];
}

type Etape =
  | { nom: "numero" }
  | { nom: "choix" }
  | { nom: "merci"; candidat: string }
  | { nom: "notation"; candidat: Candidat; critere: number };

/** Au-delà de ce barème, une note se tape au lieu de se choisir dans une grille de boutons. */
const BAREME_BOUTONS = 20;

const initiales = (nom: string) =>
  nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase())
    .join("");

function Photo({ c }: { c: Candidat }) {
  return c.photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={styles.photo} src={c.photoUrl} alt="" />
  ) : (
    <span className={styles.photo} aria-hidden="true">
      {initiales(c.nom)}
    </span>
  );
}

/**
 * Parcours du votant. Par voix : numéro → candidat → merci. Avec critères :
 * numéro → liste des candidats → un critère après l'autre → retour à la liste.
 * Le serveur revérifie tout à l'enregistrement.
 */
export function VoteQr({ lien, titre, selection, evenement, restreint, ouvert, criteres, candidats }: Props) {
  const [etape, setEtape] = useState<Etape>({ nom: "numero" });
  const [telephone, setTelephone] = useState("");
  const [choisi, setChoisi] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, number>>({});
  const [notesFaites, setNotesFaites] = useState<string[]>([]);
  const [dernier, setDernier] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const avecNotes = criteres !== null;

  async function continuer(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await verifierNumeroAction(lien, telephone);
      if (r.ok) {
        setNotesFaites(r.notes ?? []);
        setEtape({ nom: "choix" });
      } else setErreur(r.erreur);
    } catch {
      setErreur("Connexion impossible. Vérifiez votre réseau et réessayez.");
    } finally {
      setEnvoi(false);
    }
  }

  async function valider() {
    if (!choisi) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await voterQrAction(lien, choisi, telephone);
      if (r.ok) setEtape({ nom: "merci", candidat: r.candidat });
      else setErreur(r.erreur);
    } catch {
      setErreur("Connexion impossible. Votre vote n'est pas enregistré : réessayez.");
    } finally {
      setEnvoi(false);
    }
  }

  function noter(c: Candidat) {
    setNotes({});
    setErreur(null);
    setDernier(null);
    setEtape({ nom: "notation", candidat: c, critere: 0 });
  }

  async function enregistrerNote(c: Candidat) {
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await noterQrAction(lien, c.id, telephone, notes);
      if (r.ok || r.erreur.startsWith("Vous avez déjà noté")) {
        setNotesFaites((l) => (l.includes(c.id) ? l : [...l, c.id]));
        setDernier(r.ok ? r.candidat : null);
        if (!r.ok) setErreur(r.erreur);
        setEtape({ nom: "choix" });
      } else setErreur(r.erreur);
    } catch {
      setErreur("Connexion impossible. Votre note n'est pas enregistrée : réessayez.");
    } finally {
      setEnvoi(false);
    }
  }

  const restants = candidats.filter((c) => !notesFaites.includes(c.id)).length;

  return (
    <main className={styles.page}>
      <div className={styles.carte}>
        <header className={styles.haut}>
          <small>{selection}</small>
          <h1>{titre}</h1>
          <p>
            {evenement} ·{" "}
            {avecNotes ? "une note par candidat" : restreint ? "une voix par invité" : "une voix par personne"}
          </p>
        </header>

        <div className={styles.corps}>
          {!ouvert ? (
            <div className={styles.ferme}>
              <strong>Le vote n&rsquo;est pas ouvert</strong>
              <p>Revenez au moment indiqué par l&rsquo;organisateur.</p>
            </div>
          ) : etape.nom === "numero" ? (
            <form onSubmit={continuer} noValidate>
              <label htmlFor="telephone">Votre numéro de téléphone</label>
              <input
                id="telephone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="07 00 00 00 00"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                aria-invalid={erreur ? true : undefined}
                aria-describedby="aide-telephone"
              />
              <div id="aide-telephone" className={styles.aide}>
                {restreint
                  ? "Le numéro sous lequel vous avez été inscrit."
                  : avecNotes
                    ? "Il sert seulement à vérifier que chacun ne note qu'une fois chaque candidat."
                    : "Il sert seulement à vérifier que chacun ne vote qu'une fois."}
              </div>
              {erreur ? (
                <div role="alert" className={styles.erreur}>
                  {erreur}
                </div>
              ) : null}
              <button type="submit" className={styles.bouton} disabled={envoi || telephone.trim() === ""}>
                {envoi ? "Vérification…" : "Continuer"}
              </button>
            </form>
          ) : etape.nom === "choix" && avecNotes ? (
            <>
              {dernier ? (
                <div className={styles.badge} role="status">
                  ✓ Note enregistrée pour {dernier}
                </div>
              ) : (
                <div className={styles.badge}>✓ Numéro reconnu</div>
              )}
              <div className={styles.consigne}>
                {restants === 0 ? "Vous avez noté tous les candidats. Merci !" : "Touchez un candidat pour le noter"}
              </div>
              {erreur ? (
                <div role="alert" className={styles.erreur}>
                  {erreur}
                </div>
              ) : null}
              {candidats.map((c) => {
                const fait = notesFaites.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`${styles.candidat} ${fait ? styles.fait : ""}`}
                    onClick={() => noter(c)}
                    disabled={fait}
                  >
                    <Photo c={c} />
                    <span className={styles.identite}>
                      <strong>{c.nom}</strong>
                      {c.ville ? <small>{c.ville}</small> : null}
                    </span>
                    <span className={styles.statut}>{fait ? "Noté ✓" : "À noter"}</span>
                  </button>
                );
              })}
            </>
          ) : etape.nom === "choix" ? (
            <>
              <div className={styles.badge}>✓ Numéro reconnu</div>
              <div className={styles.consigne} id="consigne">
                Choisissez votre candidat
              </div>
              <div role="radiogroup" aria-labelledby="consigne">
                {candidats.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={choisi === c.id}
                    className={`${styles.candidat} ${choisi === c.id ? styles.choisi : ""}`}
                    onClick={() => setChoisi(c.id)}
                  >
                    <Photo c={c} />
                    <span className={styles.identite}>
                      <strong>{c.nom}</strong>
                      {c.ville ? <small>{c.ville}</small> : null}
                    </span>
                    <span className={styles.rond} aria-hidden="true" />
                  </button>
                ))}
              </div>
              {erreur ? (
                <div role="alert" className={styles.erreur}>
                  {erreur}
                </div>
              ) : null}
              <button type="button" className={styles.bouton} disabled={!choisi || envoi} onClick={valider}>
                {envoi ? "Envoi…" : "Valider mon vote"}
              </button>
              <div className={styles.aide} style={{ textAlign: "center" }}>
                Votre vote est définitif.
              </div>
            </>
          ) : etape.nom === "notation" && criteres ? (
            <Notation
              candidat={etape.candidat}
              criteres={criteres}
              index={etape.critere}
              notes={notes}
              erreur={erreur}
              envoi={envoi}
              onNote={(id, v) => setNotes((n) => ({ ...n, [id]: v }))}
              onAller={(i) => setEtape({ ...etape, critere: i })}
              onRetour={() => setEtape({ nom: "choix" })}
              onValider={() => enregistrerNote(etape.candidat)}
            />
          ) : etape.nom === "merci" ? (
            <div className={styles.merci} role="status">
              <div className={styles.coche} aria-hidden="true">
                ✓
              </div>
              <h2>Merci !</h2>
              <p>
                Votre voix pour <b>{etape.candidat}</b> est enregistrée.
              </p>
              <p>Ce numéro ne peut plus voter pour ce vote.</p>
            </div>
          ) : null}
        </div>
      </div>
      <p className={styles.marque}>DIGITALYX-VOTE</p>
    </main>
  );
}

/** Notation d'un candidat, un critère par écran, chacun sur son barème. */
function Notation({
  candidat,
  criteres,
  index,
  notes,
  erreur,
  envoi,
  onNote,
  onAller,
  onRetour,
  onValider,
}: {
  candidat: Candidat;
  criteres: Critere[];
  index: number;
  notes: Record<string, number>;
  erreur: string | null;
  envoi: boolean;
  onNote: (critereId: string, valeur: number) => void;
  onAller: (index: number) => void;
  onRetour: () => void;
  onValider: () => void;
}) {
  if (criteres.length === 0) {
    return (
      <div className={styles.ferme}>
        <strong>Pas encore de critères</strong>
        <p>L&rsquo;organisateur n&rsquo;a pas encore défini les critères de ce vote.</p>
      </div>
    );
  }
  const critere = criteres[index];
  const valeur = notes[critere.id];
  const dernier = index === criteres.length - 1;
  const choix = Array.from({ length: critere.bareme + 1 }, (_, i) => i);

  return (
    <>
      <div className={styles.candidatNote}>
        <Photo c={candidat} />
        <span className={styles.identite}>
          <strong>{candidat.nom}</strong>
          <small>
            Critère {index + 1} sur {criteres.length}
          </small>
        </span>
      </div>
      <div className={styles.consigne} id="critere">
        {critere.libelle} <span className={styles.bareme}>sur {critere.bareme}</span>
      </div>
      {critere.bareme <= BAREME_BOUTONS ? (
        <div role="radiogroup" aria-labelledby="critere" className={styles.notes}>
          {choix.map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={valeur === v}
              className={`${styles.note} ${valeur === v ? styles.noteChoisie : ""}`}
              onClick={() => onNote(critere.id, v)}
            >
              {v}
            </button>
          ))}
        </div>
      ) : (
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={critere.bareme}
          aria-labelledby="critere"
          value={valeur ?? ""}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (e.target.value !== "" && Number.isInteger(v) && v >= 0 && v <= critere.bareme) onNote(critere.id, v);
          }}
        />
      )}
      {erreur ? (
        <div role="alert" className={styles.erreur}>
          {erreur}
        </div>
      ) : null}
      <div className={styles.navigation}>
        <button type="button" className={styles.boutonSecondaire} onClick={() => (index === 0 ? onRetour() : onAller(index - 1))}>
          {index === 0 ? "Retour" : "Précédent"}
        </button>
        <button
          type="button"
          className={styles.bouton}
          disabled={valeur === undefined || envoi}
          onClick={() => (dernier ? onValider() : onAller(index + 1))}
        >
          {dernier ? (envoi ? "Envoi…" : "Valider la note") : "Suivant"}
        </button>
      </div>
    </>
  );
}
