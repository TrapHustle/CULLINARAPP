"use client";

import { useActionState, useRef } from "react";
import { ChefHatIcon, CloseIcon } from "@/components/icons";
import type { ActionState } from "@/lib/actions";

const initialState: ActionState = {};

/**
 * Portrait d'un candidat : aperçu, remplacement, retrait.
 *
 * L'aperçu **est** le bouton d'envoi — on clique la vignette, on choisit un
 * fichier, l'envoi part tout seul. Un bouton « Parcourir » puis un bouton
 * « Envoyer » ajouterait deux gestes à une opération qu'on répète pour chaque
 * candidat, la veille de l'événement, souvent au dernier moment.
 */
export function CandidatePhoto({
  candidateId,
  name,
  photoUrl,
  uploadAction,
  removeAction,
  accept,
}: {
  candidateId: string;
  name: string;
  photoUrl: string | null;
  uploadAction: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  removeAction: (formData: FormData) => Promise<void>;
  accept: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(uploadAction, initialState);

  return (
    <div className="flex items-center gap-2">
      <form ref={formRef} action={formAction}>
        <input type="hidden" name="id" value={candidateId} />

        <label
          title={photoUrl ? `Remplacer la photo de ${name}` : `Ajouter une photo à ${name}`}
          className="group relative block h-12 w-12 cursor-pointer overflow-hidden rounded-full border border-outline-variant/60 bg-surface-high transition-colors hover:border-primary"
        >
          {photoUrl ? (
            // Une balise <img> nue plutôt que next/image : l'optimiseur d'images
            // de Next a besoin d'écrire un cache sur disque, ce dont on ne veut
            // pas dépendre sur le portable de l'organisateur.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={`Portrait de ${name}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-outline transition-colors group-hover:text-primary">
              <ChefHatIcon className="h-5 w-5" />
            </span>
          )}

          {pending ? (
            <span className="absolute inset-0 grid place-items-center bg-surface/80 text-label-sm text-primary">
              …
            </span>
          ) : null}

          <input
            type="file"
            name="photo"
            accept={accept}
            className="sr-only"
            // L'envoi part au choix du fichier : c'est le geste que l'on vient
            // de faire, il n'y a rien à confirmer derrière.
            onChange={() => formRef.current?.requestSubmit()}
          />
        </label>
      </form>

      {photoUrl ? (
        <form action={removeAction} className="inline">
          <input type="hidden" name="id" value={candidateId} />
          <button
            type="submit"
            aria-label={`Retirer la photo de ${name}`}
            title="Retirer la photo"
            className="rounded-lg border border-transparent p-1 text-outline transition-colors hover:border-error/30 hover:text-error"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </form>
      ) : null}

      {state.error ? (
        <p role="alert" className="max-w-[14rem] text-label-sm text-error">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
