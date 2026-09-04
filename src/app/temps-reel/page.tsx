import Link from "next/link";
import { redirect } from "next/navigation";
import { computeTimeline } from "@/lib/timeline";
import { isAuthenticated } from "@/lib/session";
import { LiveChart } from "./live-chart";

export const dynamic = "force-dynamic";

/**
 * Classement en temps réel — l'évolution des notes vote après vote.
 *
 * Volontairement **hors du groupe `(admin)`** : cet écran se projette ou se
 * pose sur un second écran pendant le concours, et ne doit pas suivre le thème
 * du dashboard. Ses couleurs sont fixes et claires, quel que soit le réglage
 * clair/sombre de l'organisateur — une salle éclairée, un vidéoprojecteur et un
 * fond noir ne font pas bon ménage.
 *
 * Protégée comme la page Résultats : un classement intermédiaire renseigne
 * autant qu'un classement final.
 */
export default async function TempsReelPage() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  const timeline = await computeTimeline();

  return (
    <main className="min-h-full bg-slate-50 px-6 py-8 text-slate-900 md:px-10">
      <div className="mx-auto max-w-6xl space-y-7">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-700">
              Classement en temps réel
            </p>
            <h1 className="mt-1 font-serif text-3xl font-bold text-slate-900 md:text-4xl">
              La course des candidats
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500">
              Chaque point de la courbe est un vote reçu : la note d&apos;un candidat monte ou
              descend à mesure que les jurés se prononcent. Moyenne pondérée sur {timeline.maxTotal},
              un vote du jury spécial comptant double — le même calcul que le palmarès.
            </p>
          </div>

          <Link
            href="/resultats"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-400 hover:text-slate-900"
          >
            ← Retour aux résultats
          </Link>
        </header>

        <LiveChart initial={timeline} />
      </div>
    </main>
  );
}
