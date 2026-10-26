"use client";

import { useState } from "react";
import { verifierNumeroAction, voterQrAction } from "@/lib/vote-qr-actions";
import styles from "./q.module.css";

interface Candidat {
  id: string;
  nom: string;
  ville: string | null;
  photoUrl: string | null;
}

interface Props {
  lien: string;
  titre: string;
  selection: string;
  evenement: string;
  restreint: boolean;
  ouvert: boolean;
  candidats: Candidat[];
}

type Etape = { nom: "numero" } | { nom: "choix" } | { nom: "merci"; candidat: string };

const initiales = (nom: string) =>
  nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase())
    .join("");

/** Parcours du votant : numéro → candidat → merci. Le serveur revérifie tout au vote. */
export function VoteQr({ lien, titre, selection, evenement, restreint, ouvert, candidats }: Props) {
  const [etape, setEtape] = useState<Etape>({ nom: "numero" });
  const [telephone, setTelephone] = useState("");
  const [choisi, setChoisi] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function continuer(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await verifierNumeroAction(lien, telephone);
      if (r.ok) setEtape({ nom: "choix" });
      else setErreur(r.erreur);
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

  return (
    <main className={styles.page}>
      <div className={styles.carte}>
        <header className={styles.haut}>
          <small>{selection}</small>
          <h1>{titre}</h1>
          <p>
            {evenement} · {restreint ? "une voix par invité" : "une voix par personne"}
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
                {restreint ? "Le numéro sous lequel vous avez été inscrit." : "Il sert seulement à vérifier que chacun ne vote qu'une fois."}
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
                    {c.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className={styles.photo} src={c.photoUrl} alt="" />
                    ) : (
                      <span className={styles.photo} aria-hidden="true">
                        {initiales(c.nom)}
                      </span>
                    )}
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
          ) : (
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
          )}
        </div>
      </div>
      <p className={styles.marque}>DIGITALYX-VOTE</p>
    </main>
  );
}
