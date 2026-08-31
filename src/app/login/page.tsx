"use client";

import { useActionState } from "react";
import { loginAction, type ActionState } from "@/lib/actions";

const initialState: ActionState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <main className="flex-1 grid place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div aria-hidden className="mb-3 text-4xl">🍽️</div>
          <h1 className="font-serif text-3xl font-semibold text-[color:var(--gold)]">Concours culinaire</h1>
          <p className="mt-1 text-sm text-slate-500">Espace organisateur</p>
        </div>

        <form action={formAction} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="block text-sm font-medium text-slate-700" htmlFor="username">
            Identifiant
          </label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            required
            className="mt-1 mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          />

          <label className="block text-sm font-medium text-slate-700" htmlFor="password">
            Mot de passe
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          />

          {state.error ? (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-6 w-full rounded-lg bg-amber-600 px-4 py-2.5 font-medium text-white transition hover:bg-amber-700 disabled:opacity-60"
          >
            {pending ? "Connexion…" : "Se connecter"}
          </button>
        </form>
      </div>
    </main>
  );
}
