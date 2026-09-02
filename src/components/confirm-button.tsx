"use client";

import { useFormStatus } from "react-dom";

function SubmitButton({
  confirmMessage,
  label,
  icon,
  className,
}: {
  confirmMessage: string;
  label: string;
  icon?: React.ReactNode;
  className: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      // Le geste change l'état du vote en salle : on demande confirmation plutôt
      // que de compter sur la vigilance d'un organisateur en plein direct.
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) event.preventDefault();
      }}
      className={className}
    >
      {pending ? "…" : icon}
      {pending ? null : label}
    </button>
  );
}

/**
 * Bouton d'action serveur protégé par une confirmation, pour les gestes qui
 * modifient l'état du vote sans être des suppressions (dévalider une table).
 *
 * Les valeurs à transmettre sont passées en champs cachés plutôt que capturées
 * dans une fermeture : l'action reste une action serveur ordinaire, utilisable
 * même si le JavaScript n'a pas encore été hydraté.
 */
export function ConfirmButton({
  action,
  values,
  label,
  confirmMessage,
  icon,
  className = "flex items-center gap-1.5 rounded-lg border border-outline-variant/40 px-2.5 py-1 text-label-sm text-on-surface-variant transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50",
}: {
  action: (formData: FormData) => Promise<void>;
  values: Record<string, string>;
  label: string;
  confirmMessage: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <form action={action} className="inline">
      {Object.entries(values).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton
        confirmMessage={confirmMessage}
        label={label}
        icon={icon}
        className={className}
      />
    </form>
  );
}
