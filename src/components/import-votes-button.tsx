"use client";

import { useRef, useState } from "react";
import { DownloadIcon } from "@/components/icons";

type ImportVote = {
  id: string;
  tableId: string;
  candidateId: string;
  jurorIndex: number;
  createdAt: string;
  scores: { criterionId: string; rawValue: number }[];
};

type SyncResponse = {
  accepted?: string[];
  rejected?: { id: string; reason: string; retryable: boolean }[];
  error?: string;
};

function normalizeVote(raw: Record<string, unknown>): ImportVote {
  const rawScores = raw.scores;
  const scores = Array.isArray(rawScores)
    ? rawScores
    : Object.entries((rawScores ?? {}) as Record<string, unknown>).map(
        ([criterionId, rawValue]) => ({ criterionId, rawValue: Number(rawValue) }),
      );

  return {
    id: String(raw.id),
    tableId: String(raw.tableId),
    candidateId: String(raw.candidateId),
    jurorIndex: Number(raw.jurorIndex),
    createdAt: String(raw.createdAt),
    scores: scores.map((score) => ({
      criterionId: String(score.criterionId),
      rawValue: Number(score.rawValue),
    })),
  };
}

export function ImportVotesButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function importFile(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      const parsed = JSON.parse(await file.text()) as { votes?: unknown };
      if (!Array.isArray(parsed.votes)) throw new Error("Le fichier ne contient aucun tableau de votes.");

      const votes = parsed.votes.map((vote) => normalizeVote(vote as Record<string, unknown>));
      let accepted = 0;
      let rejected: { reason: string }[] = [];

      for (let index = 0; index < votes.length; index += 500) {
        const response = await fetch("/api/sync/votes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ votes: votes.slice(index, index + 500) }),
        });
        const result = (await response.json()) as SyncResponse;
        if (!response.ok) throw new Error(result.error ?? `Erreur serveur (${response.status})`);
        accepted += result.accepted?.length ?? 0;
        rejected = rejected.concat(result.rejected ?? []);
      }

      setMessage(
        `${accepted} vote(s) ajouté(s), ${rejected.length} rejeté(s)` +
          (rejected[0] ? ` : ${rejected[0].reason}` : "."),
      );
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      setMessage(`Import impossible : ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importFile(file);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="flex h-touch flex-1 items-center justify-center gap-2 rounded-lg border border-primary/50 px-4 text-label-lg text-primary transition-colors hover:bg-primary/10 disabled:cursor-wait disabled:opacity-60 sm:flex-none"
      >
        <DownloadIcon className="h-4 w-4 rotate-180" />
        {busy ? "Ajout en cours…" : "Ajouter des votes JSON"}
      </button>
      {message ? <p className="max-w-xs text-label-sm text-on-surface-variant">{message}</p> : null}
    </div>
  );
}
