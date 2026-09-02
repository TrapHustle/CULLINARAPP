"use client";

import { useActionState } from "react";
import { WarningIcon } from "@/components/icons";
import type { ActionState } from "@/lib/actions";

const initialState: ActionState = {};

/**
 * Un effacement, protégé par un mot à recopier.
 *
 * Une simple confirmation ne suffirait pas ici : ces deux blocs vivent sur la
 * page que l'organisateur ouvre le plus souvent avant l'événement, et le geste
 * est irréversible. Recopier un mot demande une intention, pas un réflexe.
 */
function DangerAction({
  action,
  confirmationWord,
  title,
  description,
  warning,
  submitLabel,
  pendingLabel,
  badge,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  confirmationWord: string;
  title: string;
  description: React.ReactNode;
  warning: React.ReactNode;
  submitLabel: string;
  pendingLabel: string;
  badge: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <div className="rounded-xl border border-error/40 bg-error-container/10">
      <div className="flex items-center gap-3 border-b border-error/20 px-5 py-4">
        <WarningIcon className="h-5 w-5 text-error" />
        <h3 className="flex-1 font-serif text-headline-md text-error">{title}</h3>
        <span className="text-label-sm text-outline">{badge}</span>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="max-w-2xl text-body-md text-on-surface-variant">{description}</div>
        <div className="text-label-sm text-error">{warning}</div>

        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <label className="text-label-sm text-on-surface-variant">
            <span className="mb-1 block">
              Saisissez <strong className="text-error">{confirmationWord}</strong> pour confirmer
            </span>
            <input
              type="text"
              name="confirmation"
              autoComplete="off"
              placeholder={confirmationWord}
              className="w-56 rounded-lg border border-error/40 px-3 py-2 text-body-md"
            />
          </label>

          <button
            type="submit"
            disabled={pending}
            className="h-touch rounded-lg border border-error/50 px-4 text-label-lg text-error transition-colors hover:bg-error/10 disabled:opacity-60"
          >
            {pending ? pendingLabel : submitLabel}
          </button>

          {state.error ? (
            <p role="alert" className="w-full text-label-sm text-error">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p role="status" className="w-full text-label-sm text-success">
              {state.success}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}

/**
 * Les deux effacements, du plus courant au plus radical.
 *
 * Ils sont côte à côte parce qu'on les cherche au même endroit, mais leurs mots
 * de confirmation diffèrent : recopier machinalement le même dans le mauvais
 * champ détruirait une configuration qu'on voulait garder.
 */
export function DangerZone({
  resetVotesAction,
  resetVotesWord,
  resetEventAction,
  resetEventWord,
  voteCount,
  candidateCount,
  tableCount,
  criterionCount,
}: {
  resetVotesAction: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  resetVotesWord: string;
  resetEventAction: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  resetEventWord: string;
  voteCount: number;
  candidateCount: number;
  tableCount: number;
  criterionCount: number;
}) {
  return (
    <div className="space-y-gutter">
      <DangerAction
        action={resetVotesAction}
        confirmationWord={resetVotesWord}
        title="Remise à zéro des votes"
        badge={`${voteCount} vote${voteCount > 1 ? "s" : ""} en base`}
        description={
          <>
            Efface <strong className="text-on-surface">tous les votes</strong> et toutes les
            validations de table, puis referme les votes. Les candidats, les tables et les critères
            sont conservés. C&apos;est ce qui sépare la répétition du jour J.
          </>
        }
        warning={
          <>
            <p>Irréversible. Les votes déjà envoyés ne seront pas renvoyés par les tablettes.</p>
            <p className="mt-2 text-on-surface-variant">
              Avant d&apos;effacer, vérifiez que chaque tablette affiche{" "}
              <strong className="text-on-surface">0 vote en attente</strong> (Réglages →
              Synchronisation). Un vote de répétition resté en file partirait sinon à la réouverture
              du candidat et viendrait se mêler aux vrais résultats.
            </p>
          </>
        }
        submitLabel="Effacer tous les votes"
        pendingLabel="Effacement…"
      />

      <DangerAction
        action={resetEventAction}
        confirmationWord={resetEventWord}
        title="Réinitialiser le bureau de vote"
        badge={`${candidateCount} candidats · ${tableCount} tables · ${criterionCount} critères`}
        description={
          <>
            Efface <strong className="text-on-surface">tout</strong> : les votes, mais aussi les
            candidats, les tables, les critères et les photos. Le serveur repart d&apos;une page
            blanche, prêt pour un autre événement.
          </>
        }
        warning={
          <>
            <p>
              Irréversible, et bien plus large que la remise à zéro ci-dessus. Il n&apos;y a aucune
              raison d&apos;y toucher pendant un concours.
            </p>
            <p className="mt-2 text-on-surface-variant">
              Les tablettes garderont en cache l&apos;ancienne configuration jusqu&apos;à leur
              prochain contact avec le serveur, et leur table sélectionnée n&apos;existera plus : il
              faudra la choisir à nouveau sur chacune.
            </p>
          </>
        }
        submitLabel="Tout réinitialiser"
        pendingLabel="Réinitialisation…"
      />
    </div>
  );
}
