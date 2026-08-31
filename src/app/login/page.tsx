"use client";

import { useActionState } from "react";
import { ArrowRightIcon, ChefHatIcon, LockIcon, UserIcon } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { loginAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = {};

const FIELD_CLASS =
  "w-full rounded-lg border border-outline-variant/60 bg-[color:var(--field)] py-2.5 pl-10 pr-3 text-body-md text-on-surface transition-colors";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <main className="relative flex-1 grid place-items-center px-4 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      {/* Carte d'accès : un « carton d'invitation » centré, posé sur le halo doré. */}
      <div className="relative w-full max-w-sm">
        <div aria-hidden className="gold-halo pointer-events-none absolute -inset-16" />

        <div className="relative rounded-xl bg-surface-container p-8 gold-border shadow-[var(--panel-shadow)]">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-primary/40 text-primary">
              <ChefHatIcon className="h-6 w-6" />
            </div>
            <p className="text-label-sm uppercase tracking-[0.2em] text-primary">Concours culinaire</p>
            <h1 className="mt-2 font-serif text-headline-lg text-on-surface">Espace organisateur</h1>
            <p className="mt-1 text-label-sm text-on-surface-variant">
              Configuration, pilotage et résultats
            </p>
          </div>

          <form action={formAction}>
            <label className="block text-label-sm text-on-surface-variant" htmlFor="username">
              Identifiant
            </label>
            <div className="relative mt-1.5 mb-5">
              <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
              <input
                id="username"
                name="username"
                autoComplete="username"
                required
                className={FIELD_CLASS}
              />
            </div>

            <label className="block text-label-sm text-on-surface-variant" htmlFor="password">
              Mot de passe
            </label>
            <div className="relative mt-1.5">
              <LockIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className={FIELD_CLASS}
              />
            </div>

            {state.error ? (
              <p
                role="alert"
                className="mt-5 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-label-sm text-error"
              >
                {state.error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="gold-gradient mt-7 flex h-touch w-full items-center justify-center gap-2 rounded-lg text-label-lg transition hover:brightness-105 disabled:opacity-60"
            >
              {pending ? "Connexion…" : "Se connecter"}
              {pending ? null : <ArrowRightIcon className="h-4 w-4" />}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
