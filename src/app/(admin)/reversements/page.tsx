import { PAYMENT_METHOD_LABELS } from "@/lib/public-vote-core";
import { withdrawalOverview } from "@/lib/withdrawal-actions";
import { formatAmount, formatDateTime, WITHDRAWAL_STATUS_LABELS } from "@/lib/withdrawal-core";
import { WithdrawalCard } from "./withdrawal-card";

/**
 * Reversements : les demandes de retrait de l'organisateur.
 *
 * L'application n'envoie jamais d'argent — la passerelle SIRAP ne sait
 * qu'encaisser. Cette page sert à enregistrer qu'un virement a été fait à la
 * main chez l'opérateur, ou à refuser la demande avec un motif.
 *
 * Contrairement au panneau public de l'organisateur, le numéro est affiché en
 * entier : c'est celui qu'il faut recopier chez l'opérateur.
 */
export default async function ReversementsPage() {
  const { balance, waiting, settled, mailReady } = await withdrawalOverview();

  return (
    <div className="space-y-gutter">
      <div>
        <p className="text-label-sm uppercase tracking-[0.2em] text-primary">Caisse</p>
        <h1 className="mt-1 font-serif text-display-lg text-on-surface">Reversements</h1>
        <p className="mt-2 max-w-2xl text-body-md text-on-surface-variant">
          Demandes de retrait de l&apos;organisateur. Faites le virement chez l&apos;opérateur,
          puis enregistrez-le ici.
        </p>
      </div>

      {mailReady ? null : (
        <p className="rounded-xl border border-error/50 bg-error-container/40 px-4 py-3 text-body-md text-on-surface">
          Aucune adresse d&apos;alerte n&apos;est configurée sur ce serveur
          (<code>WITHDRAWAL_MAIL_TO</code>) : les demandes arrivent bien ici, mais personne
          n&apos;est averti par mail.
        </p>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Chiffres clés">
        <Tile label="En attente" value={String(waiting.length)} tone="pending" detail={waiting.length === 0 ? "rien à traiter" : "à traiter"} />
        <Tile label="Déjà reversé" value={`${formatAmount(balance.paid)} FCFA`} tone="done" detail="virements enregistrés" />
        <Tile label="Solde organisateur" value={`${formatAmount(balance.available)} FCFA`} detail={`sur ${formatAmount(balance.organiser)} FCFA de part`} />
      </section>

      <section className="rounded-xl bg-surface-container gold-border">
        <div className="flex items-center gap-3 border-b border-outline-variant/30 px-5 py-4">
          <h2 className="flex-1 font-serif text-headline-md text-primary">À traiter</h2>
          <span className="text-label-sm text-outline">
            {waiting.length === 0
              ? "aucune demande"
              : `${waiting.length} demande${waiting.length > 1 ? "s" : ""}`}
          </span>
        </div>
        {waiting.length === 0 ? (
          <p className="px-5 py-4 text-body-md text-on-surface-variant">
            Aucune demande en attente.
          </p>
        ) : (
          waiting.map((row) => (
            <WithdrawalCard
              key={row.id}
              row={row}
              after={Math.max(0, balance.organiser - balance.paid - row.amount)}
            />
          ))
        )}
      </section>

      {settled.length > 0 ? (
        <section className="rounded-xl bg-surface-container gold-border">
          <div className="flex items-center gap-3 border-b border-outline-variant/30 px-5 py-4">
            <h2 className="flex-1 font-serif text-headline-md text-primary">Historique</h2>
            <span className="text-label-sm text-outline">
              {settled.length} demande{settled.length > 1 ? "s" : ""} traitée
              {settled.length > 1 ? "s" : ""}
            </span>
          </div>
          {settled.map((row) => (
            <article key={row.id} className="border-b border-outline-variant/30 px-5 py-4 last:border-b-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-serif text-headline-md tabular-nums text-on-surface">
                  {formatAmount(row.amount)} FCFA
                </span>
                <span
                  className={
                    row.status === "PAID"
                      ? "rounded-full border border-success px-2 py-0.5 text-label-sm uppercase tracking-wider text-success"
                      : "rounded-full border border-error px-2 py-0.5 text-label-sm uppercase tracking-wider text-error"
                  }
                >
                  {WITHDRAWAL_STATUS_LABELS[row.status]}
                </span>
                <span className="ml-auto text-label-sm text-outline">
                  Demandée le {formatDateTime(row.createdAt)}
                </span>
              </div>
              <p className="mt-2 text-body-md text-on-surface-variant">
                {PAYMENT_METHOD_LABELS[row.method]} · <span className="tabular-nums">{row.phone}</span>
              </p>
              <p className="mt-1 text-label-sm text-outline">
                {row.status === "PAID" ? "Reversé" : "Refusé"}
                {row.processedAt ? ` le ${formatDateTime(row.processedAt)}` : ""}
                {row.adminNote ? ` — « ${row.adminNote} »` : "."}
              </p>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function Tile({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "pending" | "done";
}) {
  const valueTone =
    tone === "pending" ? "text-gold-soft" : tone === "done" ? "text-success" : "text-on-surface";
  return (
    <div className="rounded-xl bg-surface-container p-4 gold-border">
      <p className="text-label-sm uppercase tracking-wider text-outline">{label}</p>
      <p className={`mt-1 font-serif text-headline-md tabular-nums ${valueTone}`}>{value}</p>
      <p className="mt-1 text-label-sm text-outline">{detail}</p>
    </div>
  );
}
