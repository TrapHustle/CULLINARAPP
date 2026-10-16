"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { etatPaiementAction, payerAction, voterGratuitAction } from "@/lib/vote-public-saas-actions";
import type { Recu } from "@/lib/vote-public-saas";
import styles from "./v.module.css";

interface Candidat {
  participationId: string;
  nom: string;
  ville: string | null;
  photoUrl: string | null;
  /** `null` quand l'organisateur masque les compteurs. */
  voix: number | null;
}

interface Props {
  slug: string;
  evenement: { nom: string; sousTitre: string | null; afficheUrl: string | null; organisation: string };
  selection: {
    libelle: string;
    lieu: string | null;
    fin: string | null;
    etat: string;
    prixVote: number;
    voixGratuite: boolean;
    compteursVisibles: boolean;
    moyens: string[];
  };
  ouvert: boolean;
  simulation: boolean;
  candidats: Candidat[];
}

const MOYENS: Record<string, { nom: string; couleur: string }> = {
  WAVE: { nom: "Wave", couleur: "#1dc3ff" },
  ORANGE_MONEY: { nom: "Orange Money", couleur: "#ff7900" },
  MTN: { nom: "MTN MoMo", couleur: "#ffcb05" },
  CARD: { nom: "Carte", couleur: "#1768e5" },
};

const QUANTITES = [1, 5, 10, 25, 50, 100];
const nf = (n: number) => n.toLocaleString("fr-FR");
const fcfa = (n: number) => `${nf(n)} FCFA`;
const cleStockage = (slug: string) => `dv-paiement-${slug}`;

function initiales(nom: string) {
  const mots = nom.trim().split(/\s+/);
  return ((mots[0]?.[0] ?? "") + (mots.length > 1 ? mots[mots.length - 1][0] : "")).toUpperCase();
}

function dateFin(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Abidjan" }).format(
    new Date(iso),
  );
}

export function VotePublic({ slug, evenement, selection, ouvert, simulation, candidats }: Props) {
  const router = useRouter();
  const [choisi, setChoisi] = useState<Candidat | null>(null);
  const [recherche, setRecherche] = useState("");
  const [recu, setRecu] = useState<Recu | null>(null);

  // Compteurs en direct : la page se recharge seule tant que le vote est ouvert.
  useEffect(() => {
    if (!ouvert) return;
    const minuterie = setInterval(() => router.refresh(), 20_000);
    return () => clearInterval(minuterie);
  }, [ouvert, router]);

  // Retour de chez l'opérateur : on retrouve le paiement en cours et on suit son statut.
  useEffect(() => {
    let reference: string | null = null;
    try {
      reference = localStorage.getItem(cleStockage(slug));
    } catch {
      return;
    }
    if (!reference) return;
    let essais = 0;
    let arret = false;
    const verifier = async () => {
      const r = await etatPaiementAction(reference!);
      if (arret) return;
      if (!r) {
        try {
          localStorage.removeItem(cleStockage(slug));
        } catch {}
        return;
      }
      setRecu(r);
      if (r.statut !== "PENDING") {
        try {
          localStorage.removeItem(cleStockage(slug));
        } catch {}
        router.refresh();
      } else if (essais++ < 30) {
        setTimeout(verifier, 4000);
      }
    };
    void verifier();
    return () => {
      arret = true;
    };
  }, [slug, router]);

  const classement = useMemo(() => {
    if (!selection.compteursVisibles) return new Map<string, number>();
    const tries = [...candidats].sort((a, b) => (b.voix ?? 0) - (a.voix ?? 0));
    return new Map(tries.filter((c) => (c.voix ?? 0) > 0).map((c, i) => [c.participationId, i + 1]));
  }, [candidats, selection.compteursVisibles]);

  const total = candidats.reduce((s, c) => s + (c.voix ?? 0), 0);
  const leader = Math.max(1, ...candidats.map((c) => c.voix ?? 0));
  const filtres = candidats.filter((c) =>
    `${c.nom} ${c.ville ?? ""}`.toLowerCase().includes(recherche.trim().toLowerCase()),
  );

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        {evenement.afficheUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={evenement.afficheUrl} alt="" className={styles.heroImage} />
        ) : null}
        <div className={styles.heroVoile} />
        <div className={styles.heroContenu}>
          <div className={styles.marque}>
            <span className={styles.marqueSigne}>✓</span>
            <span>
              DIGITALYX<em>-VOTE</em>
            </span>
          </div>
          <p className={styles.surtitre}>{evenement.sousTitre ?? evenement.organisation}</p>
          <h1 className={styles.titre}>{evenement.nom}</h1>
          <p className={styles.selection}>
            {selection.libelle}
            {selection.lieu && !selection.libelle.toLowerCase().includes(selection.lieu.toLowerCase()) ? ` · ${selection.lieu}` : ""}
          </p>
          <div className={styles.statuts}>
            <span className={`${styles.statut} ${ouvert ? styles.statutOuvert : styles.statutFerme}`}>
              <span className={styles.point} />
              {ouvert ? "Vote ouvert" : selection.etat === "CLOTUREE" ? "Vote clôturé" : "Vote fermé"}
            </span>
            {ouvert && selection.fin ? <span className={styles.statut}>Jusqu&rsquo;au {dateFin(selection.fin)}</span> : null}
            {selection.compteursVisibles ? <span className={styles.statut}>{nf(total)} voix</span> : null}
            <span className={styles.statut}>{fcfa(selection.prixVote)} la voix</span>
          </div>
        </div>
      </header>

      <main className={styles.contenu}>
        {simulation && ouvert ? (
          <div className={styles.avis}>
            <strong>Mode démonstration</strong> — aucun paiement n&rsquo;est réellement prélevé.
          </div>
        ) : null}
        {!ouvert ? (
          <div className={styles.avis}>
            {selection.etat === "PREPAREE"
              ? "Le vote n’a pas encore commencé. Revenez à l’ouverture !"
              : selection.etat === "CLOTUREE"
                ? "Le vote est terminé. Merci à toutes celles et ceux qui ont voté."
                : "Le vote est momentanément fermé."}
          </div>
        ) : null}

        <div className={styles.barreOutils}>
          <h2 className={styles.titreSection}>
            Les <em>candidats</em>
          </h2>
          {candidats.length > 6 ? (
            <input
              className={styles.recherche}
              type="search"
              placeholder="Rechercher un candidat"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              aria-label="Rechercher un candidat"
            />
          ) : null}
        </div>

        {candidats.length === 0 ? <p className={styles.vide}>Les candidats seront bientôt présentés.</p> : null}

        <ul className={styles.grille}>
          {filtres.map((c) => {
            const rang = classement.get(c.participationId);
            return (
              <li key={c.participationId} className={styles.carte}>
                <div className={styles.photo}>
                  {c.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.photoUrl} alt={c.nom} />
                  ) : (
                    <span className={styles.initiales}>{initiales(c.nom)}</span>
                  )}
                  {rang && rang <= 3 ? <span className={`${styles.rang} ${styles[`rang${rang}`]}`}>{rang}</span> : null}
                </div>
                <div className={styles.carteCorps}>
                  <h3 className={styles.nom}>{c.nom}</h3>
                  {c.ville ? <p className={styles.ville}>{c.ville}</p> : null}
                  {c.voix !== null ? (
                    <>
                      <div className={styles.compteur}>
                        <strong>{nf(c.voix)}</strong> voix
                        {total > 0 ? <span>{Math.round((c.voix / total) * 1000) / 10} %</span> : null}
                      </div>
                      <div className={styles.piste}>
                        <span style={{ width: `${(c.voix / leader) * 100}%` }} />
                      </div>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className={styles.boutonVoter}
                    disabled={!ouvert}
                    onClick={() => setChoisi(c)}
                  >
                    Voter
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <footer className={styles.pied}>
          Vote organisé par {evenement.organisation} · Plateforme DIGITALYX-VOTE, propulsée par Inovyx Tech
        </footer>
      </main>

      {choisi ? (
        <Fenetre
          slug={slug}
          candidat={choisi}
          selection={selection}
          simulation={simulation}
          onFermer={() => setChoisi(null)}
          onRecu={(r) => {
            setChoisi(null);
            setRecu(r);
            router.refresh();
          }}
        />
      ) : null}

      {recu ? <Recu recu={recu} onFermer={() => setRecu(null)} /> : null}
    </div>
  );
}

function Fenetre({
  slug,
  candidat,
  selection,
  simulation,
  onFermer,
  onRecu,
}: {
  slug: string;
  candidat: Candidat;
  selection: Props["selection"];
  simulation: boolean;
  onFermer: () => void;
  onRecu: (r: Recu) => void;
}) {
  const [onglet, setOnglet] = useState<"payer" | "gratuit">(selection.voixGratuite ? "gratuit" : "payer");
  const [voix, setVoix] = useState(5);
  const [moyen, setMoyen] = useState(selection.moyens[0] ?? "WAVE");
  const [telephone, setTelephone] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [merci, setMerci] = useState<string | null>(null);
  const [envoi, demarrer] = useTransition();

  useEffect(() => {
    const echap = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", echap);
    return () => window.removeEventListener("keydown", echap);
  }, [onFermer]);

  const voterGratuit = () =>
    demarrer(async () => {
      setErreur(null);
      const r = await voterGratuitAction(slug, candidat.participationId, telephone);
      if (r.ok) setMerci(r.message);
      else setErreur(r.erreur);
    });

  const payer = () =>
    demarrer(async () => {
      setErreur(null);
      const r = await payerAction({ slug, participationId: candidat.participationId, voix, moyen, telephone });
      if (!r.ok) return setErreur(r.erreur);
      if (r.type === "confirme") return onRecu(r.recu);
      try {
        localStorage.setItem(cleStockage(slug), r.reference);
      } catch {}
      window.location.href = r.url;
    });

  return (
    <div className={styles.fond} role="dialog" aria-modal="true" aria-label={`Voter pour ${candidat.nom}`} onClick={onFermer}>
      <div className={styles.fenetre} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.fermer} onClick={onFermer} aria-label="Fermer">
          ×
        </button>
        <div className={styles.fenetreTete}>
          <div className={styles.photoPetite}>
            {candidat.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={candidat.photoUrl} alt="" />
            ) : (
              <span className={styles.initiales}>{initiales(candidat.nom)}</span>
            )}
          </div>
          <div>
            <p className={styles.surtitreSombre}>Vous votez pour</p>
            <h2 className={styles.nomGrand}>{candidat.nom}</h2>
            {candidat.ville ? <p className={styles.ville}>{candidat.ville}</p> : null}
          </div>
        </div>

        {merci ? (
          <div className={styles.merci}>
            <span className={styles.coche}>✓</span>
            <p>{merci}</p>
            <button type="button" className={styles.boutonPrincipal} onClick={onFermer}>
              Fermer
            </button>
          </div>
        ) : (
          <>
            {selection.voixGratuite ? (
              <div className={styles.ongletsVote} role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={onglet === "gratuit"}
                  className={onglet === "gratuit" ? styles.ongletActif : undefined}
                  onClick={() => {
                    setOnglet("gratuit");
                    setErreur(null);
                  }}
                >
                  Voix gratuite
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={onglet === "payer"}
                  className={onglet === "payer" ? styles.ongletActif : undefined}
                  onClick={() => {
                    setOnglet("payer");
                    setErreur(null);
                  }}
                >
                  Acheter des voix
                </button>
              </div>
            ) : null}

            {onglet === "payer" ? (
              <>
                <p className={styles.etiquette}>Nombre de voix</p>
                <div className={styles.quantites}>
                  {QUANTITES.map((q) => (
                    <button
                      key={q}
                      type="button"
                      className={voix === q ? styles.quantiteActive : undefined}
                      onClick={() => setVoix(q)}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <div className={styles.compteurVoix}>
                  <button type="button" onClick={() => setVoix((v) => Math.max(1, v - 1))} aria-label="Une voix de moins">
                    −
                  </button>
                  <input
                    inputMode="numeric"
                    value={voix}
                    onChange={(e) => {
                      const n = Number(e.target.value.replace(/\D/g, ""));
                      setVoix(Math.min(1000, Math.max(1, n || 1)));
                    }}
                    aria-label="Nombre de voix"
                  />
                  <button type="button" onClick={() => setVoix((v) => Math.min(1000, v + 1))} aria-label="Une voix de plus">
                    +
                  </button>
                </div>

                <p className={styles.etiquette}>Payer avec</p>
                <div className={styles.moyens}>
                  {selection.moyens.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={moyen === m ? styles.moyenActif : undefined}
                      onClick={() => setMoyen(m)}
                    >
                      <span className={styles.pastilleMoyen} style={{ background: MOYENS[m]?.couleur }} />
                      {MOYENS[m]?.nom ?? m}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className={styles.explication}>
                Une voix offerte par numéro de téléphone. Pour soutenir encore votre candidat, achetez des voix.
              </p>
            )}

            <label className={styles.champ}>
              <span>{onglet === "payer" ? "Numéro qui paie" : "Votre numéro de téléphone"}</span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="07 00 00 00 00"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
              />
              <small>Côte d&rsquo;Ivoire par défaut. Autre pays : commencez par +indicatif.</small>
            </label>

            {erreur ? (
              <p className={styles.erreur} role="alert">
                {erreur}
              </p>
            ) : null}

            {onglet === "payer" ? (
              <button type="button" className={styles.boutonPrincipal} disabled={envoi} onClick={payer}>
                {envoi ? "Un instant…" : `Payer ${fcfa(voix * selection.prixVote)}`}
              </button>
            ) : (
              <button type="button" className={styles.boutonPrincipal} disabled={envoi} onClick={voterGratuit}>
                {envoi ? "Un instant…" : "Voter gratuitement"}
              </button>
            )}
            {onglet === "payer" ? (
              <p className={styles.mention}>
                {voix} voix × {fcfa(selection.prixVote)}.{" "}
                {simulation ? "Démonstration : rien n’est prélevé." : "Vous validerez le paiement chez votre opérateur."}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function Recu({ recu, onFermer }: { recu: Recu; onFermer: () => void }) {
  const titre =
    recu.statut === "CONFIRMED" ? "Merci pour votre vote !" : recu.statut === "FAILED" ? "Paiement non abouti" : "Paiement en cours…";
  return (
    <div className={styles.fond} role="dialog" aria-modal="true" aria-label={titre} onClick={onFermer}>
      <div className={styles.fenetre} onClick={(e) => e.stopPropagation()}>
        <div className={styles.merci}>
          <span className={`${styles.coche} ${recu.statut === "FAILED" ? styles.cocheErreur : ""}`}>
            {recu.statut === "CONFIRMED" ? "✓" : recu.statut === "FAILED" ? "!" : "…"}
          </span>
          <h2 className={styles.nomGrand}>{titre}</h2>
          <p>
            {recu.statut === "CONFIRMED"
              ? `${nf(recu.voix)} voix pour ${recu.candidat} sont comptées.`
              : recu.statut === "FAILED"
                ? "Rien n’a été compté. Vous pouvez réessayer."
                : "Validez le paiement sur votre téléphone : vos voix seront comptées dès la confirmation."}
          </p>
          <dl className={styles.recu}>
            <div>
              <dt>Référence</dt>
              <dd>{recu.reference}</dd>
            </div>
            <div>
              <dt>Montant</dt>
              <dd>{fcfa(recu.montant)}</dd>
            </div>
            <div>
              <dt>Moyen</dt>
              <dd>{MOYENS[recu.moyen]?.nom ?? recu.moyen}</dd>
            </div>
          </dl>
          {recu.simule ? <p className={styles.mention}>Paiement de démonstration : rien n&rsquo;a été prélevé.</p> : null}
          <button type="button" className={styles.boutonPrincipal} onClick={onFermer}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
