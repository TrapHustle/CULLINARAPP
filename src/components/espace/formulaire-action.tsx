"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { EtatFormulaire } from "@/lib/evenements-actions";
import styles from "./panel.module.css";

type Action = (etat: EtatFormulaire, form: FormData) => Promise<EtatFormulaire>;

interface Props {
  /** Action serveur, ses arguments fixes déjà liés par la page. */
  action: Action;
  children?: React.ReactNode;
  /** Libellé du bouton d'envoi. Sans libellé, aucun bouton n'est ajouté. */
  bouton?: string;
  /** Libellé pendant l'envoi. */
  boutonEnvoi?: string;
  variante?: "principal" | "secondaire" | "danger" | "lien";
  /** Question posée avant l'envoi. */
  confirmer?: string;
  /** Vider les champs après un envoi réussi (formulaires d'ajout). */
  vider?: boolean;
  className?: string;
  /** Cacher le message de succès (petites actions répétées). */
  discret?: boolean;
  style?: React.CSSProperties;
  ariaLabel?: string;
}

const VARIANTES = {
  principal: `${styles.bouton} ${styles.boutonPrincipal}`,
  secondaire: `${styles.bouton} ${styles.boutonSecondaire}`,
  danger: `${styles.bouton} ${styles.boutonDanger}`,
  lien: styles.boutonLien,
};

/**
 * Formulaire branché sur une action serveur du panneau : message d'erreur ou
 * de succès, bouton désactivé pendant l'envoi, confirmation facultative.
 */
export function FormulaireAction({
  action,
  children,
  bouton,
  boutonEnvoi,
  variante = "principal",
  confirmer,
  vider,
  className,
  discret,
  style,
  ariaLabel,
}: Props) {
  const [etat, envoyer, envoi] = useActionState(action, {});

  return (
    <form
      // La clé change après un ajout réussi : les champs repartent vides.
      key={vider ? etat.succes : undefined}
      action={envoyer}
      className={className}
      style={style}
      aria-label={ariaLabel}
      onSubmit={(e) => {
        if (confirmer && !confirm(confirmer)) e.preventDefault();
      }}
    >
      {etat.erreur ? (
        <p role="alert" className={styles.erreur}>
          {etat.erreur}
        </p>
      ) : etat.succes && !discret ? (
        <p role="status" className={styles.succes}>
          {etat.succes}
        </p>
      ) : null}
      {children}
      {bouton ? (
        <div className={styles.actionsFormulaire}>
          <button type="submit" className={VARIANTES[variante]} disabled={envoi}>
            {envoi ? (boutonEnvoi ?? "Envoi…") : bouton}
          </button>
        </div>
      ) : null}
    </form>
  );
}

/** Bouton d'envoi à placer soi-même dans un `FormulaireAction` (icône, position…). */
export function BoutonEnvoi({
  children,
  className,
  titre,
}: {
  children: React.ReactNode;
  className?: string;
  titre?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} title={titre} aria-label={titre} disabled={pending}>
      {children}
    </button>
  );
}
