"use client";

import { useActionState, useRef } from "react";
import type { ActionState } from "@/lib/actions";

const initialState: ActionState = {};

/** Affiche de l'événement : fond de l'en-tête de la page /voter (style clair). */
export function EventPoster({
  posterUrl,
  uploadAction,
  removeAction,
  accept,
}: {
  posterUrl: string | null;
  uploadAction: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  removeAction: () => Promise<void>;
  accept: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(uploadAction, initialState);

  return (
    <div className="mb-5 space-y-2">
      <span className="block text-label-sm text-on-surface-variant">Affiche (fond de l&apos;en-tête)</span>
      <div className="flex items-center gap-3">
        <form ref={formRef} action={formAction}>
          <label
            title={posterUrl ? "Remplacer l'affiche" : "Ajouter une affiche"}
            className="relative block h-20 w-16 cursor-pointer overflow-hidden rounded-lg border border-outline-variant/60 bg-surface-high transition-colors hover:border-primary"
          >
            {posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={posterUrl} alt="Affiche de l'événement" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-label-sm text-outline">+</span>
            )}
            {pending ? (
              <span className="absolute inset-0 grid place-items-center bg-surface/80 text-label-sm text-primary">…</span>
            ) : null}
            <input
              type="file"
              name="photo"
              accept={accept}
              className="sr-only"
              onChange={() => formRef.current?.requestSubmit()}
            />
          </label>
        </form>
        <div className="space-y-1 text-label-sm text-on-surface-variant">
          <p>Cliquez la vignette pour {posterUrl ? "remplacer" : "ajouter"} l&apos;affiche (JPEG, PNG ou WebP, 4 Mo max).</p>
          {posterUrl ? (
            <form action={removeAction}>
              <button type="submit" className="text-error hover:underline">
                Retirer l&apos;affiche
              </button>
            </form>
          ) : null}
          {state.error ? (
            <p role="alert" className="text-error">
              {state.error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
