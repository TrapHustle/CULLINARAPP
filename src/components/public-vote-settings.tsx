"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions";
import {
  MAX_VOTE_PRICE,
  MIN_VOTE_PRICE,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  PUBLIC_VOTE_STYLE_LABELS,
  PUBLIC_VOTE_STYLES,
  type PaymentMethod,
  type PublicVoteStyle,
} from "@/lib/public-vote-core";

export interface PublicVoteSettingsValues {
  open: boolean;
  eventName: string;
  tagline: string;
  subtitle: string;
  price: number;
  /** « 2026-10-01T22:00 », à l'heure d'Abidjan (GMT), ou vide. */
  closesAt: string;
  showCounts: boolean;
  style: PublicVoteStyle;
  methods: PaymentMethod[];
}

const initialState: ActionState = {};

const fieldClass =
  "w-full rounded-lg border border-outline-variant/60 px-3 py-2 text-body-md text-on-surface";
const checkboxClass = "h-4 w-4 rounded border-outline-variant accent-[color:var(--gold)]";

/**
 * Réglages de la page `/voter`.
 *
 * Tout s'applique à l'enregistrement : la page publique se met à jour d'elle-même
 * chez les visiteurs à sa prochaine actualisation (15 s au plus).
 */
export function PublicVoteSettingsForm({
  action,
  values,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  values: PublicVoteSettingsValues;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <label className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-body-md text-on-surface">
        <input type="checkbox" name="publicVoteOpen" defaultChecked={values.open} className={checkboxClass} />
        <span>
          <strong className="font-semibold">Vote ouvert au public</strong>
          <span className="block text-label-sm text-on-surface-variant">
            Fermé, la page reste visible mais n&apos;accepte aucun paiement.
          </span>
        </span>
      </label>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-label-lg text-primary">Textes de la page</legend>
        <label className="block text-label-sm text-on-surface-variant">
          <span className="mb-1 block">Ligne du haut</span>
          <input
            name="publicVoteTagline"
            defaultValue={values.tagline}
            placeholder="Kabowd Production · 7ᵉ édition"
            maxLength={120}
            className={fieldClass}
          />
        </label>
        <label className="block text-label-sm text-on-surface-variant">
          <span className="mb-1 block">Titre</span>
          <input
            name="eventName"
            defaultValue={values.eventName}
            placeholder="Talent Traiteur 2026"
            maxLength={120}
            className={fieldClass}
          />
        </label>
        <label className="block text-label-sm text-on-surface-variant">
          <span className="mb-1 block">Sous-titre</span>
          <input
            name="publicVoteSubtitle"
            defaultValue={values.subtitle}
            placeholder="1ʳᵉ sélection · Bouaké"
            maxLength={120}
            className={fieldClass}
          />
        </label>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-label-sm text-on-surface-variant">
          <span className="mb-1 block">Prix d&apos;un vote (FCFA)</span>
          <input
            type="number"
            name="publicVotePrice"
            required
            min={MIN_VOTE_PRICE}
            max={MAX_VOTE_PRICE}
            step={25}
            defaultValue={values.price}
            className={fieldClass}
          />
        </label>
        <label className="block text-label-sm text-on-surface-variant">
          <span className="mb-1 block">Clôture (heure d&apos;Abidjan)</span>
          <input
            type="datetime-local"
            name="publicVoteClosesAt"
            defaultValue={values.closesAt}
            className={fieldClass}
          />
        </label>
      </div>
      <p className="-mt-2 text-label-sm text-outline">
        Sans heure de clôture, seul l&apos;interrupteur ci-dessus ouvre ou ferme le vote.
      </p>

      <label className="flex items-center gap-3 text-body-md text-on-surface">
        <input
          type="checkbox"
          name="publicVoteShowCounts"
          defaultChecked={values.showCounts}
          className={checkboxClass}
        />
        <span>
          Montrer les votes au public
          <span className="block text-label-sm text-on-surface-variant">
            Masqués, la page suit l&apos;ordre de passage et ne dévoile pas le classement.
          </span>
        </span>
      </label>

      <fieldset>
        <legend className="mb-2 text-label-lg text-primary">Style de la page</legend>
        <div className="flex flex-wrap gap-2">
          {PUBLIC_VOTE_STYLES.map((style) => (
            <label
              key={style}
              className="flex items-center gap-2 rounded-lg border border-outline-variant/50 px-3 py-2 text-body-md text-on-surface has-[:checked]:border-primary has-[:checked]:bg-primary/10"
            >
              <input
                type="radio"
                name="publicVoteStyle"
                value={style}
                defaultChecked={values.style === style}
                className="accent-[color:var(--gold)]"
              />
              {PUBLIC_VOTE_STYLE_LABELS[style]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-label-lg text-primary">Moyens de paiement</legend>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.map((method) => (
            <label
              key={method}
              className="flex items-center gap-2 rounded-lg border border-outline-variant/50 px-3 py-2 text-body-md text-on-surface has-[:checked]:border-primary has-[:checked]:bg-primary/10"
            >
              <input
                type="checkbox"
                name="publicVoteMethods"
                value={method}
                defaultChecked={values.methods.includes(method)}
                className={checkboxClass}
              />
              {PAYMENT_METHOD_LABELS[method]}
            </label>
          ))}
        </div>
        <p className="mt-2 text-label-sm text-outline">
          La carte bancaire est en maintenance chez le prestataire : ne la cochez qu&apos;à son retour.
        </p>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="gold-gradient flex h-touch items-center justify-center rounded-lg px-5 text-label-lg transition hover:brightness-105 disabled:opacity-60"
        >
          {pending ? "Enregistrement…" : "Enregistrer les réglages"}
        </button>
        {state.error ? (
          <p role="alert" className="text-label-sm text-error">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p role="status" className="text-label-sm text-success">
            {state.success}
          </p>
        ) : null}
      </div>
    </form>
  );
}
