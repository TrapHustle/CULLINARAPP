"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions";

const initialState: ActionState = {};

function defaultEventDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function ArchiveEventForm({
  action,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      className="mt-4 flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        if (!window.confirm("Clôturer et archiver ce concours ? Les résultats seront conservés dans les Archives des concours.")) {
          event.preventDefault();
        }
      }}
    >
      <label className="flex-1 text-label-sm text-on-surface-variant">
        <span className="mb-1 block">Nom du concours</span>
        <input required name="name" maxLength={120} placeholder="Ex. Concours culinaire 2026" className="w-full rounded-lg border border-outline-variant/60 px-3 py-2 text-body-md" />
      </label>
      <label className="text-label-sm text-on-surface-variant">
        <span className="mb-1 block">Date du concours</span>
        <input required type="datetime-local" name="eventDate" defaultValue={defaultEventDate()} className="rounded-lg border border-outline-variant/60 px-3 py-2 text-body-md" />
      </label>
      <button type="submit" disabled={pending} className="flex h-touch items-center justify-center rounded-lg border border-error/50 px-4 text-label-lg text-error transition-colors hover:bg-error-container/20 disabled:opacity-60">
        {pending ? "Archivage…" : "Clôturer et archiver"}
      </button>
      {state.error ? <p role="alert" className="w-full text-label-sm text-error">{state.error}</p> : null}
      {state.success ? <p role="status" className="w-full text-label-sm text-success">{state.success}</p> : null}
    </form>
  );
}
