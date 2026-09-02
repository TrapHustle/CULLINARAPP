"use client";

import { useActionState, useState } from "react";
import { FieldInput, type Field } from "@/components/action-form";
import { CloseIcon, PencilIcon } from "@/components/icons";
import type { ActionState } from "@/lib/actions";

const initialState: ActionState = {};

/**
 * Ligne de configuration modifiable sur place.
 *
 * Tant qu'on ne clique pas le crayon, la ligne reste en lecture : l'organisateur
 * qui parcourt sa configuration en plein événement ne doit pas pouvoir modifier
 * un nom par simple frôlement. Le formulaire n'apparaît qu'à la demande, et se
 * referme dès que le serveur a confirmé — laisser le champ ouvert donnerait à
 * croire que l'enregistrement reste à faire.
 */
export function RowEditor({
  action,
  id,
  fields,
  children,
  editLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  id: string;
  fields: Field[];
  children: React.ReactNode;
  editLabel: string;
}) {
  const [editing, setEditing] = useState(false);

  const [state, formAction, pending] = useActionState(
    async (prevState: ActionState, formData: FormData) => {
      const result = await action(prevState, formData);
      if (result.success) setEditing(false);
      return result;
    },
    initialState,
  );

  if (!editing) {
    return (
      <div className="flex flex-1 items-center gap-3">
        {children}
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={editLabel}
          title={editLabel}
          className="rounded-lg border border-transparent p-2 text-outline transition-colors hover:border-primary/30 hover:text-primary"
        >
          <PencilIcon />
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-1 flex-wrap items-end gap-3">
      <input type="hidden" name="id" value={id} />

      {fields.map((field) => (
        <label key={field.name} className="text-label-sm text-on-surface-variant">
          <span className="mb-1 block">{field.label}</span>
          <FieldInput field={field} />
        </label>
      ))}

      <button
        type="submit"
        disabled={pending}
        className="h-touch rounded-lg border border-primary/40 px-4 text-label-lg text-primary transition-colors hover:bg-primary/5 disabled:opacity-60"
      >
        {pending ? "…" : "Enregistrer"}
      </button>

      <button
        type="button"
        onClick={() => setEditing(false)}
        aria-label="Annuler la modification"
        title="Annuler"
        className="h-touch rounded-lg border border-transparent px-2 text-outline transition-colors hover:border-outline-variant hover:text-on-surface-variant"
      >
        <CloseIcon />
      </button>

      {state.error ? (
        <p role="alert" className="w-full text-label-sm text-error">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
