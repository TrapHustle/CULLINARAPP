"use client";

import { useFormStatus } from "react-dom";
import { TrashIcon } from "@/components/icons";

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
      aria-label="Supprimer"
      title="Supprimer"
      className="rounded-lg border border-transparent p-2 text-outline transition-colors hover:border-error/30 hover:text-error disabled:opacity-50"
    >
      {pending ? <span className="block h-5 w-5 text-center leading-5">…</span> : <TrashIcon />}
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
