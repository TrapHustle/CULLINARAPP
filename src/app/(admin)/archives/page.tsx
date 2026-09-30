import { prisma } from "@/lib/prisma";

type ArchiveSnapshot = {
  results?: {
    totals?: { votes: number; candidates: number; tables: number };
    ranking?: Array<{ name: string; rank: number | null; finalScore: number | null; voterCount: number }>;
  };
};

function formatDate(date: Date) {
  return date.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
}

export default async function ArchivesPage() {
  const archives = await prisma.voteEventArchive.findMany({ orderBy: { closedAt: "desc" } });

  return (
    <div className="space-y-gutter">
      <div>
        <p className="text-label-sm uppercase tracking-[0.2em] text-primary">Historique</p>
        <h1 className="mt-1 font-serif text-display-lg text-on-surface">Archives des concours</h1>
        <p className="mt-2 max-w-2xl text-body-md text-on-surface-variant">Chaque archive est une copie en lecture seule des résultats au moment de la clôture.</p>
      </div>
      {archives.length === 0 ? (
        <div className="rounded-xl bg-surface-container p-6 text-body-md text-on-surface-variant gold-border">Aucun concours archivé pour le moment.</div>
      ) : (
        <div className="space-y-4">
          {archives.map((archive) => {
            const snapshot = archive.snapshot as ArchiveSnapshot;
            const totals = snapshot.results?.totals;
            const ranking = snapshot.results?.ranking ?? [];
            return (
              <article key={archive.id} className="rounded-xl bg-surface-container p-5 gold-border">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div>
                    <h2 className="font-serif text-headline-md text-primary">{archive.name}</h2>
                    <p className="mt-1 text-label-sm text-on-surface-variant">Concours : {formatDate(archive.eventDate)} · Clôturé : {formatDate(archive.closedAt)}</p>
                  </div>
                  {totals ? <span className="rounded-full bg-primary/15 px-3 py-1 text-label-sm text-primary">{totals.votes} notes · {totals.candidates} candidats · {totals.tables} tables</span> : null}
                </div>
                <ol className="mt-5 divide-y divide-outline-variant/30">
                  {ranking.map((entry) => (
                    <li key={entry.name} className="flex items-center gap-4 py-3 text-body-md">
                      <span className="w-9 text-center font-serif text-headline-sm text-primary">{entry.rank ? `#${entry.rank}` : "—"}</span>
                      <span className="flex-1 text-on-surface">{entry.name}</span>
                      <span className="text-on-surface-variant">{entry.voterCount} note(s)</span>
                      <strong className="text-primary">{entry.finalScore === null ? "Non noté" : entry.finalScore.toFixed(2)}</strong>
                    </li>
                  ))}
                </ol>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
