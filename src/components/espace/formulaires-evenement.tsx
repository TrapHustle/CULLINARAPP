"use client";

import { useActionState, useEffect, useState } from "react";
import {
  changerAfficheAction,
  creerEvenementAction,
  creerSelectionAction,
  deplacerSelectionAction,
  modifierEvenementAction,
  modifierSelectionAction,
  retirerAfficheAction,
  supprimerEvenementAction,
  supprimerSelectionAction,
  type EtatFormulaire,
} from "@/lib/evenements-actions";
import { Icone } from "./icone";
import styles from "./panel.module.css";

const initial: EtatFormulaire = {};

function Messages({ etat }: { etat: EtatFormulaire }) {
  if (etat.erreur) {
    return (
      <p role="alert" className={styles.erreur}>
        {etat.erreur}
      </p>
    );
  }
  if (etat.succes) {
    return (
      <p role="status" className={styles.succes}>
        {etat.succes}
      </p>
    );
  }
  return null;
}

// Événement ---------------------------------------------------------------

export interface ValeursEvenement {
  nom: string;
  edition: string;
  sousTitre: string;
  date: string;
}

export function FormulaireEvenement({ evenementId, valeurs }: { evenementId?: string; valeurs?: ValeursEvenement }) {
  const action = evenementId ? modifierEvenementAction.bind(null, evenementId) : creerEvenementAction;
  const [etat, envoyer, envoi] = useActionState(action, initial);
  const v = { ...valeurs, ...etat.valeurs };

  return (
    <form action={envoyer} className={styles.formulaire}>
      <Messages etat={etat} />
      <label className={`${styles.champ} ${styles.champLarge}`}>
        <span>Nom de l&rsquo;événement</span>
        <input name="nom" required maxLength={120} defaultValue={v.nom} placeholder="Talent Traiteur 2026" />
      </label>
      <label className={styles.champ}>
        <span>Édition</span>
        <input name="edition" inputMode="numeric" maxLength={3} defaultValue={v.edition} placeholder="7" />
        <small>Facultatif. Un nombre : 7 pour la 7ᵉ édition.</small>
      </label>
      <label className={styles.champ}>
        <span>Date</span>
        <input name="date" type="date" defaultValue={v.date} />
        <small>Facultatif.</small>
      </label>
      <label className={`${styles.champ} ${styles.champLarge}`}>
        <span>Sous-titre</span>
        <input
          name="sousTitre"
          maxLength={120}
          defaultValue={v.sousTitre}
          placeholder="Kabowd Production · 7ᵉ édition"
        />
        <small>Facultatif. Affiché au-dessus du titre sur la page de vote.</small>
      </label>
      {evenementId ? null : (
        <div className={`${styles.champ} ${styles.champLarge}`}>
          <span>Image du concours</span>
          <ChoixImage actuelle={null} />
        </div>
      )}
      <div className={styles.actionsFormulaire}>
        <button type="submit" className={`${styles.bouton} ${styles.boutonPrincipal}`} disabled={envoi}>
          {envoi ? "Enregistrement…" : evenementId ? "Enregistrer" : "Créer l’événement"}
        </button>
      </div>
    </form>
  );
}

/** Champ fichier avec aperçu de l'image choisie, ou de l'image actuelle. */
function ChoixImage({ actuelle }: { actuelle: string | null }) {
  const [apercu, setApercu] = useState<string | null>(null);
  useEffect(() => () => (apercu ? URL.revokeObjectURL(apercu) : undefined), [apercu]);
  const image = apercu ?? actuelle;

  return (
    <div className={styles.choixImage}>
      <div className={styles.apercuImage}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" />
        ) : (
          <span>
            <Icone nom="image" taille={26} />
            Aucune image
          </span>
        )}
      </div>
      <div className={styles.choixImageTexte}>
        <input
          name="affiche"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const fichier = e.currentTarget.files?.[0];
            setApercu(fichier ? URL.createObjectURL(fichier) : null);
          }}
        />
        <small>
          JPEG, PNG ou WebP, 4 Mo au plus. Format paysage conseillé (1600 × 900) : c&rsquo;est la bannière de la page de
          vote et la vignette de l&rsquo;événement dans votre espace.
        </small>
      </div>
    </div>
  );
}

export function ImageEvenement({ evenementId, afficheUrl }: { evenementId: string; afficheUrl: string | null }) {
  const [etat, envoyer, envoi] = useActionState(changerAfficheAction.bind(null, evenementId), initial);
  const [etatRetrait, retirer, retrait] = useActionState(retirerAfficheAction.bind(null, evenementId), initial);
  // Seul le message du dernier bouton utilisé s'affiche.
  const [dernier, setDernier] = useState<"envoi" | "retrait">("envoi");

  return (
    <div className={styles.formulaire}>
      <Messages etat={dernier === "retrait" ? etatRetrait : etat} />
      {/* La clé change avec l'image : le champ fichier et l'aperçu repartent à zéro. */}
      <form key={afficheUrl ?? "aucune"} action={envoyer} className={`${styles.champ} ${styles.champLarge}`}>
        <ChoixImage actuelle={afficheUrl} />
        <div className={styles.actionsFormulaire} style={{ marginTop: 12 }}>
          <button
            type="submit"
            onClick={() => setDernier("envoi")}
            className={`${styles.bouton} ${styles.boutonPrincipal}`}
            disabled={envoi}
          >
            {envoi ? "Envoi…" : "Enregistrer l’image"}
          </button>
          {afficheUrl ? (
            <button
              type="submit"
              formAction={retirer}
              formNoValidate
              onClick={() => setDernier("retrait")}
              className={`${styles.bouton} ${styles.boutonSecondaire}`}
              disabled={retrait}
            >
              Retirer l&rsquo;image
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

export function SupprimerEvenement({ evenementId }: { evenementId: string }) {
  const [etat, envoyer, envoi] = useActionState(supprimerEvenementAction.bind(null, evenementId), initial);
  return (
    <form
      action={envoyer}
      onSubmit={(e) => {
        if (!confirm("Supprimer définitivement cet événement et ses sélections ?")) e.preventDefault();
      }}
    >
      {etat.erreur ? (
        <p role="alert" className={styles.erreur} style={{ marginBottom: 10 }}>
          {etat.erreur}
        </p>
      ) : null}
      <button type="submit" className={`${styles.bouton} ${styles.boutonDanger}`} disabled={envoi}>
        <Icone nom="corbeille" taille={16} />
        Supprimer l&rsquo;événement
      </button>
    </form>
  );
}

// Sélection ---------------------------------------------------------------

export interface ValeursSelection {
  libelle: string;
  lieu: string;
  debut: string;
  fin: string;
  nbQualifies: string;
}

export function FormulaireSelection({
  evenementId,
  selectionId,
  valeurs,
}: {
  evenementId: string;
  selectionId?: string;
  valeurs?: ValeursSelection;
}) {
  const action = selectionId
    ? modifierSelectionAction.bind(null, evenementId, selectionId)
    : creerSelectionAction.bind(null, evenementId);
  const [etat, envoyer, envoi] = useActionState(action, initial);
  const v = { ...valeurs, ...etat.valeurs };

  return (
    // En création, la clé change après chaque ajout réussi pour vider les champs.
    <form key={selectionId ? undefined : etat.succes} action={envoyer} className={styles.formulaire}>
      <Messages etat={etat} />
      <label className={`${styles.champ} ${styles.champLarge}`}>
        <span>Nom de la sélection</span>
        <input name="libelle" required maxLength={120} defaultValue={v.libelle} placeholder="1ʳᵉ sélection · Bouaké" />
      </label>
      <label className={styles.champ}>
        <span>Lieu</span>
        <input name="lieu" maxLength={120} defaultValue={v.lieu} placeholder="Bouaké" />
      </label>
      <label className={styles.champ}>
        <span>Nombre de qualifiés</span>
        <input name="nbQualifies" inputMode="numeric" maxLength={4} defaultValue={v.nbQualifies ?? ""} placeholder="0" />
        <small>Candidats retenus pour la sélection suivante.</small>
      </label>
      <label className={styles.champ}>
        <span>Début</span>
        <input name="debut" type="datetime-local" defaultValue={v.debut} />
      </label>
      <label className={styles.champ}>
        <span>Fin du vote en ligne</span>
        <input name="fin" type="datetime-local" defaultValue={v.fin} />
        <small>Heure d&rsquo;Abidjan. Facultatif.</small>
      </label>
      <div className={styles.actionsFormulaire}>
        <button type="submit" className={`${styles.bouton} ${styles.boutonPrincipal}`} disabled={envoi}>
          {selectionId ? (envoi ? "Enregistrement…" : "Enregistrer") : envoi ? "Ajout…" : "Ajouter la sélection"}
        </button>
      </div>
    </form>
  );
}

export function DeplacerSelection({
  evenementId,
  selectionId,
  premiere,
  derniere,
}: {
  evenementId: string;
  selectionId: string;
  premiere: boolean;
  derniere: boolean;
}) {
  return (
    <>
      <form action={deplacerSelectionAction.bind(null, evenementId, selectionId, "haut")}>
        <button
          type="submit"
          className={`${styles.bouton} ${styles.boutonSecondaire} ${styles.boutonIcone}`}
          disabled={premiere}
          aria-label="Monter"
          title="Monter"
        >
          <Icone nom="haut" taille={16} />
        </button>
      </form>
      <form action={deplacerSelectionAction.bind(null, evenementId, selectionId, "bas")}>
        <button
          type="submit"
          className={`${styles.bouton} ${styles.boutonSecondaire} ${styles.boutonIcone}`}
          disabled={derniere}
          aria-label="Descendre"
          title="Descendre"
        >
          <Icone nom="bas" taille={16} />
        </button>
      </form>
    </>
  );
}

export function SupprimerSelection({ evenementId, selectionId }: { evenementId: string; selectionId: string }) {
  const [etat, envoyer, envoi] = useActionState(supprimerSelectionAction.bind(null, evenementId, selectionId), initial);
  return (
    <form
      action={envoyer}
      onSubmit={(e) => {
        if (!confirm("Supprimer définitivement cette sélection ?")) e.preventDefault();
      }}
    >
      {etat.erreur ? (
        <p role="alert" className={styles.erreur} style={{ marginBottom: 10 }}>
          {etat.erreur}
        </p>
      ) : null}
      <button type="submit" className={`${styles.bouton} ${styles.boutonDanger}`} disabled={envoi}>
        <Icone nom="corbeille" taille={16} />
        Supprimer la sélection
      </button>
    </form>
  );
}
