"use client";

import { useFormStatus } from "react-dom";

function SubmitButton({ confirmMessage }: { confirmMessage: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      // La suppression est en cascade (les votes liés partent avec l'élément) :
      // une confirmation explicite évite un geste irréversible en plein événement.
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) event.preventDefault();
      }}
      className="rounded-lg px-2.5 py-1.5 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-50"
    >
      {pending ? "…" : "Supprimer"}
    </button>
  );
}

export function DeleteButton({
  action,
  id,
  confirmMessage,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  confirmMessage: string;
}) {
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <SubmitButton confirmMessage={confirmMessage} />
    </form>
  );
}
