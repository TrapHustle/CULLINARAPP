"use client";

import { useRef, useState } from "react";
import type { TableBreakdown } from "@/lib/results";

function formatScore(value: number | null) {
  return value === null ? "non noté" : value.toFixed(2).replace(".", ",");
}

/**
 * Les pastilles « par table » du détail d'un candidat, cliquables.
 *
 * Une seule boîte de dialogue est partagée entre toutes les pastilles : elle
 * n'affiche que la table sur laquelle on vient de cliquer. Le `<dialog>` natif
 * gère lui-même le focus et la fermeture au clavier (Échap) — pas de
 * dépendance supplémentaire pour un geste aussi simple.
 */
export function TableVotesList({ tables, maxTotal }: { tables: TableBreakdown[]; maxTotal: number }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<TableBreakdown | null>(null);

  function open(table: TableBreakdown) {
    setSelected(table);
    dialogRef.current?.showModal();
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {tables.map((table) => (
          <button
            key={table.tableId}
            type="button"
            onClick={() => open(table)}
            disabled={table.voterCount === 0}
            className="rounded-full border border-outline-variant/30 bg-surface-container px-3 py-1.5 text-label-sm text-on-surface-variant transition-colors hover:border-primary/50 hover:text-primary disabled:cursor-default disabled:opacity-50 disabled:hover:border-outline-variant/30 disabled:hover:text-on-surface-variant"
          >
            {table.tableName}
            {table.type === "SPECIAL" ? <span className="ml-1 text-primary">×2</span> : null}
            <span className="ml-2 text-on-surface">{formatScore(table.averageRaw)}</span>
            <span className="ml-1 text-outline">
              ({table.voterCount} vote{table.voterCount > 1 ? "s" : ""})
            </span>
          </button>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        onClick={(event) => {
          // Un clic sur le fond (en dehors de la carte) ferme la boîte, comme
          // le fait déjà la touche Échap gérée nativement par `<dialog>`.
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="w-[min(92vw,32rem)] rounded-xl border border-outline-variant/40 bg-surface-container p-0 backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      >
        {selected ? (
          <div className="p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="font-serif text-headline-md text-on-surface">
                  {selected.tableName}
                  {selected.type === "SPECIAL" ? (
                    <span className="ml-2 text-label-sm text-primary">×2 (jury spécial)</span>
                  ) : null}
                </h3>
                <p className="mt-1 text-label-sm text-on-surface-variant">
                  {selected.voterCount} vote{selected.voterCount > 1 ? "s" : ""} · moyenne{" "}
                  {formatScore(selected.averageRaw)}/{maxTotal}
                </p>
              </div>
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-high hover:text-on-surface"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            {selected.votes.length === 0 ? (
              <p className="text-body-md text-on-surface-variant">
                Aucun vote reçu pour cette table.
              </p>
            ) : (
              <div className="custom-scrollbar overflow-x-auto">
                <table className="w-full text-body-md">
                  <thead className="text-left text-label-sm uppercase tracking-wider text-outline">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Juré</th>
                      {selected.votes[0].scores.map((score) => (
                        <th key={score.criterionId} className="py-2 pr-3 font-medium">
                          {score.name}
                        </th>
                      ))}
                      <th className="py-2 pr-3 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {selected.votes.map((vote) => (
                      <tr key={vote.jurorIndex}>
                        <td className="py-2 pr-3 text-on-surface">Juré {vote.jurorIndex}</td>
                        {vote.scores.map((score) => (
                          <td key={score.criterionId} className="py-2 pr-3 text-on-surface-variant">
                            {score.value}/5
                          </td>
                        ))}
                        <td className="py-2 pr-3 text-right font-medium text-on-surface">
                          {vote.total}/{maxTotal}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </dialog>
    </>
  );
}
