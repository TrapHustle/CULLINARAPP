"use client";

import { useActionState, useRef } from "react";
import type { ActionState } from "@/lib/actions";

export type Field =
  | { kind: "text"; name: string; label: string; placeholder?: string; required?: boolean }
  | { kind: "number"; name: string; label: string; defaultValue?: number; min?: number; max?: number }
  | { kind: "select"; name: string; label: string; options: { value: string; label: string }[] };

const initialState: ActionState = {};

/**
 * Formulaire de création générique, partagé par les trois sections de la page
 * de configuration (candidats, tables, critères).
 *
 * Le formulaire est réinitialisé après un succès pour permettre des saisies
 * successives sans avoir à effacer les champs à la main.
 */
export function ActionForm({
  action,
  fields,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  fields: Field[];
  submitLabel: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (prevState: ActionState, formData: FormData) => {
      const result = await action(prevState, formData);
      if (result.success) formRef.current?.reset();
      return result;
    },
    initialState,
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      {fields.map((field) => (
        <label key={field.name} className="text-sm text-slate-700">
          <span className="mb-1 block">{field.label}</span>

          {field.kind === "select" ? (
            <select
              name={field.name}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2"
            >
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={field.kind === "number" ? "number" : "text"}
              name={field.name}
              placeholder={field.kind === "text" ? field.placeholder : undefined}
              required={field.kind === "text" ? field.required : undefined}
              defaultValue={field.kind === "number" ? field.defaultValue : undefined}
              min={field.kind === "number" ? field.min : undefined}
              max={field.kind === "number" ? field.max : undefined}
              className={`rounded-lg border border-slate-300 px-3 py-2 ${
                field.kind === "number" ? "w-24" : "w-56"
              }`}
            />
          )}
        </label>
      ))}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-60"
      >
        {pending ? "…" : submitLabel}
      </button>

      {state.error ? (
        <p role="alert" className="w-full text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="w-full text-sm text-green-700">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}
