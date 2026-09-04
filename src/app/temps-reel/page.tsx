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
 * du dashboard. Ses couleurs sont fixes, quel que soit le réglage clair/sombre
 * de l'organisateur.
 *
 * Le fond est sombre comme le reste de ce qui se montre en salle : la courbe
 * s'ouvre depuis l'écran projeté, et passer du noir au blanc au milieu d'une
 * soirée éblouit une assemblée dont les yeux se sont faits à la pénombre.
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
    <main className="min-h-full bg-[#17130d] px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-6xl space-y-7">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d4af37]">
              Classement en temps réel
            </p>
            <h1 className="mt-1 font-serif text-3xl font-bold text-white md:text-4xl">
              La course des candidats
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/70">
              Chaque point de la courbe est un vote reçu : la note d&apos;un candidat monte ou
              descend à mesure que les jurés se prononcent. Moyenne pondérée sur {timeline.maxTotal},
              un vote du jury spécial comptant double — le même calcul que le palmarès.
            </p>
          </div>

          <Link
            href="/resultats"
            className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/70 transition hover:border-[#d4af37]/60 hover:text-[#f2ca50]"
          >
            ← Retour aux résultats
          </Link>
        </header>

        <LiveChart initial={timeline} placement="cote" />
      </div>
    </main>
  );
}
