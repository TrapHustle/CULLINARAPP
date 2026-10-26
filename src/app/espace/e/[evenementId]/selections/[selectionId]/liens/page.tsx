import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormulaireAction } from "@/components/espace/formulaire-action";
import { Icone } from "@/components/espace/icone";
import { BoutonCopier, ListeNumeros } from "@/components/espace/liens";
import l from "@/components/espace/liens.module.css";
import styles from "@/components/espace/panel.module.css";
import { exigerUtilisateur } from "@/lib/espace";
import { LIBELLES_ACCES, type Acces } from "@/lib/grille-core";
import { adresseBase, cheminVote, imageQr } from "@/lib/liens-publics";
import { lireLiens, lireNumeros } from "@/lib/vote-qr";
import { ajouterSaisieAction, basculerQrAction, importerAction } from "@/lib/vote-qr-actions";

export const metadata: Metadata = { title: "Liens & QR codes — DIGITALYX-VOTE" };

const nf = (n: number) => n.toLocaleString("fr-FR");

/** Un lien et un QR code par type de vote ; la liste des numéros autorisés d'un vote restreint. */
export default async function PageLiens({
  params,
}: {
  params: Promise<{ evenementId: string; selectionId: string }>;
}) {
  const { evenementId, selectionId } = await params;
  const utilisateur = await exigerUtilisateur();
  const lus = await lireLiens(utilisateur.organisationId, selectionId);
  if (!lus || lus.selection.evenementId !== evenementId) notFound();

  const { selection } = lus;
  const base = await adresseBase();
  const cloturee = selection.etat === "CLOTUREE";
  const avecLien = lus.types.filter((t) => cheminVote(t, selection.slug) !== null);
  const enSalle = lus.types.filter((t) => cheminVote(t, selection.slug) === null);

  const cartes = await Promise.all(
    avecLien.map(async (t) => {
      const url = `${base}${cheminVote(t, selection.slug)}`;
      const numeros = t.canal === "QR" && t.acces === "RESTREINT" ? await lireNumeros(utilisateur.organisationId, t.id) : null;
      return { type: t, url, qr: await imageQr(url), numeros };
    }),
  );

  return (
    <>
      {selection.etat === "PREPAREE" ? (
        <div className={`${styles.bandeau} ${styles.bandeauInfo}`}>
          <Icone nom="horloge" taille={18} />
          <div>
            <strong>Préparez vos QR codes dès maintenant</strong>
            <span>Imprimez-les et partagez-les à l&rsquo;avance : les liens n&rsquo;acceptent des voix qu&rsquo;une fois la sélection ouverte.</span>
          </div>
        </div>
      ) : null}

      {avecLien.length === 0 ? (
        <div className={`${styles.bandeau} ${styles.bandeauAlerte}`}>
          <Icone nom="bouclier" taille={18} />
          <div>
            <strong>Aucun vote par lien dans cette sélection</strong>
            <span>Ajoutez un type « Par QR code » ou « En ligne » dans l&rsquo;onglet Grille de vote.</span>
          </div>
        </div>
      ) : null}

      {cartes.map(({ type, url, qr, numeros }) => {
        const estQr = type.canal === "QR";
        const restreint = estQr && type.acces === "RESTREINT";
        const ouvert = estQr ? type.ouvert : selection.voteEnLigneOuvert;
        const partage = `https://wa.me/?text=${encodeURIComponent(`${selection.evenement.nom} · ${selection.libelle} — ${type.libelle} : votez ici ${url}`)}`;
        const fichier = `qr-${selection.slug}-${type.libelle}`.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, "-");
        return (
          <div key={type.id}>
            <section className={styles.carte}>
              <div className={styles.carteHaut}>
                <div>
                  <h2 className={styles.carteTitre}>{type.libelle}</h2>
                  <div className={styles.pastilles}>
                    <span className={styles.pastille}>{estQr ? "Voix unique" : "Voix payantes"}</span>
                    <span className={`${styles.pastille} ${restreint ? styles.pastilleOrange : styles.pastilleVerte}`}>
                      {estQr ? LIBELLES_ACCES[type.acces as Acces] : LIBELLES_ACCES.OUVERT}
                    </span>
                    <span className={`${styles.pastille} ${ouvert ? styles.pastilleVerte : ""}`}>{ouvert ? "Lien ouvert" : "Lien fermé"}</span>
                  </div>
                </div>
                {estQr && !cloturee ? (
                  <FormulaireAction
                    action={basculerQrAction.bind(null, type.id, !type.ouvert)}
                    bouton={type.ouvert ? "Fermer ce vote" : "Ouvrir ce vote"}
                    variante={type.ouvert ? "secondaire" : "principal"}
                    confirmer={type.ouvert ? `Fermer le vote « ${type.libelle} » ? Plus personne ne pourra voter par ce lien.` : undefined}
                  />
                ) : null}
              </div>
              <div className={styles.carteCorps}>
                <div className={l.qrBloc}>
                  <div className={l.qr}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qr} alt={`QR code du vote « ${type.libelle} »`} />
                  </div>
                  <div>
                    <div className={l.url}>{url}</div>
                    <div className={l.actions}>
                      <BoutonCopier texte={url} />
                      <a className={`${styles.bouton} ${styles.boutonSecondaire} ${styles.boutonPetit}`} href={qr} download={`${fichier}.png`}>
                        Télécharger le QR (PNG)
                      </a>
                      <a
                        className={`${styles.bouton} ${styles.boutonSecondaire} ${styles.boutonPetit}`}
                        href={`/affiche/${type.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Imprimer l&rsquo;affiche
                      </a>
                      <a className={`${styles.bouton} ${styles.boutonPetit} ${l.whatsapp}`} href={partage} target="_blank" rel="noreferrer">
                        Partager sur WhatsApp
                      </a>
                    </div>
                    {restreint ? (
                      <>
                        <div className={l.chiffres}>
                          <div>
                            <strong>{nf(type.autorises)}</strong>numéros autorisés
                          </div>
                          <div>
                            <strong>{nf(type.votants)}</strong>ont voté
                          </div>
                          <div>
                            <strong>{nf(Math.max(0, type.autorises - type.votants))}</strong>n&rsquo;ont pas encore voté
                          </div>
                        </div>
                        <div className={l.jauge} aria-hidden="true">
                          <i style={{ width: `${type.autorises > 0 ? Math.min(100, (type.votants / type.autorises) * 100) : 0}%` }} />
                        </div>
                      </>
                    ) : estQr ? (
                      <div className={l.chiffres}>
                        <div>
                          <strong>{nf(type.votants)}</strong>personnes ont voté
                        </div>
                      </div>
                    ) : (
                      <div className={l.note}>
                        Page publique du vote en ligne : tout le monde peut voter. La voix gratuite reste limitée à une par numéro ;
                        les voix payées ne le sont pas. Elle s&rsquo;ouvre et se ferme depuis l&rsquo;onglet Pilotage.
                      </div>
                    )}
                    {estQr && !restreint ? (
                      <div className={l.note}>Pas de liste : tout le monde peut voter, une seule fois par numéro de téléphone.</div>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            {restreint && numeros ? (
              <section className={styles.carte}>
                <div className={styles.carteHaut}>
                  <div>
                    <h2 className={styles.carteTitre}>Numéros autorisés · {type.libelle}</h2>
                    <p className={styles.carteTexte}>
                      Un numéro absent de cette liste ne peut pas voter. Chaque numéro vote une seule fois.
                    </p>
                  </div>
                </div>
                <div className={styles.carteCorps}>
                  {cloturee ? null : (
                    <div className={l.deuxCol}>
                      <FormulaireAction action={importerAction.bind(null, type.id)} bouton="Importer" variante="secondaire" vider>
                        <div className={l.depot}>
                          <div className={l.depotIcone}>
                            <Icone nom="plus" taille={20} />
                          </div>
                          <div>
                            <strong>Importer un fichier</strong>
                            <small>
                              Excel (.xlsx) ou CSV · une colonne « téléphone », une colonne « nom » facultative. Les doublons et
                              les numéros illisibles sont écartés et signalés.
                            </small>
                            <input type="file" name="fichier" accept=".xlsx,.csv,.txt" required aria-label="Fichier de numéros" />
                          </div>
                        </div>
                      </FormulaireAction>
                      <FormulaireAction action={ajouterSaisieAction.bind(null, type.id)} bouton="Ajouter les numéros" vider>
                        <label className={styles.champ}>
                          <span>Ou tapez les numéros (un par ligne, nom facultatif après « ; »)</span>
                          <textarea
                            name="numeros"
                            className={l.saisie}
                            required
                            placeholder={"07 01 02 03 04 ; Awa Koné\n05 06 07 08 09"}
                          />
                        </label>
                      </FormulaireAction>
                    </div>
                  )}
                  <ListeNumeros
                    typeVoteId={type.id}
                    modifiable={!cloturee}
                    numeros={numeros.map((n) => ({
                      id: n.id,
                      telephone: n.telephone,
                      nom: n.nom,
                      source: n.source,
                      voteLe: n.voteLe ? n.voteLe.toISOString() : null,
                    }))}
                  />
                  <p className={styles.carteTexte} style={{ marginTop: 10 }}>
                    Le candidat choisi n&rsquo;est jamais affiché ici : vous voyez qui a voté, pas pour qui.
                  </p>
                </div>
              </section>
            ) : null}
          </div>
        );
      })}

      {enSalle.length > 0 ? (
        <p className={styles.noteBas}>
          Sans lien public : {enSalle.map((t) => t.libelle).join(", ")} — ces votes se saisissent depuis l&rsquo;onglet Notes du jury.
        </p>
      ) : null}
    </>
  );
}
