import { headers } from "next/headers";
import { AutoRefresh } from "@/components/auto-refresh";
import { ConfirmButton } from "@/components/confirm-button";
import { ArrowRightIcon, ScreenIcon, TrashIcon, VoteIcon, WarningIcon } from "@/components/icons";
import { EventPoster } from "@/components/event-poster";
import { PublicVoteSettingsForm } from "@/components/public-vote-settings";
import { removeEventPosterAction, uploadEventPosterAction } from "@/lib/actions";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/validation";
import { getPublicVoteDashboard } from "@/lib/public-vote";
import {
  clearSimulatedPaymentsAction,
  refreshPendingPaymentsAction,
  resetOnlineVotesAction,
  updatePublicVoteSettingsAction,
} from "@/lib/public-vote-actions";
import { DangerAction } from "@/components/danger-zone";
import { RESET_ONLINE_CONFIRMATION } from "@/lib/validation";
import {
  enabledMethods,
  formatNumber,
  initials,
  isPaymentMethod,
  PAYMENT_METHOD_LABELS,
  toPublicVoteStyle,
  votesLabel,
} from "@/lib/public-vote-core";

export const dynamic = "force-dynamic";

/** Heure d'Abidjan (GMT) : la même pour l'organisateur, le serveur et le public. */
const TIME_ZONE = "Africa/Abidjan";

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "Confirmé",
  PENDING: "En attente",
  FAILED: "Échoué",
};

function paymentTime(date: Date) {
  return date.toLocaleString("fr-FR", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Valeur d'un champ `datetime-local`, à l'heure d'Abidjan (= UTC). */
function toDateTimeInput(date: Date | null) {
  return date ? date.toISOString().slice(0, 16) : "";
}

/**
 * Vote du public : réglages de la page `/voter`, chiffres de la campagne et
 * derniers paiements.
 */
export default async function PublicVoteAdminPage() {
  const [data, requestHeaders] = await Promise.all([getPublicVoteDashboard(), headers()]);
  const { session } = data;
  const maxVotes = Math.max(1, ...data.ranking.map((candidate) => candidate.votes));

  // L'adresse à diffuser : l'URL publique fixée en mode hébergé, sinon celle
  // par laquelle l'organisateur voit le dashboard (le réseau de la salle).
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const publicBase =
    process.env.APP_PUBLIC_URL?.replace(/\/$/, "") || (host ? `${protocol}://${host}` : "");

  return (
    <div className="space-y-gutter">
      {/* Les paiements arrivent sans prévenir : la page suit en direct. */}
      <AutoRefresh intervalMs={5000} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-label-sm uppercase tracking-[0.2em] text-primary">Pendant la campagne</p>
          <h1 className="mt-1 font-serif text-display-lg text-on-surface">Vote du public</h1>
          <p className="mt-2 max-w-2xl text-body-md text-on-surface-variant">
            Chacun achète autant de votes qu&apos;il veut pour son candidat, à{" "}
            <strong className="text-on-surface">{formatNumber(session.publicVotePrice)} FCFA</strong> le
            vote. Un vote ne compte qu&apos;une fois son paiement confirmé.
          </p>
        </div>

        <span
          className={`flex items-center gap-2 rounded-full px-3 py-1 text-label-lg ${
            data.open ? "bg-success/15 text-success" : "bg-error/15 text-error"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
          {data.open ? "Vote ouvert" : "Vote fermé"}
        </span>
      </div>

      {/* Liens de la page publique : le lien à diffuser, et un aperçu de chaque style. */}
      <section className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-container p-4 gold-border">
        <ScreenIcon className="h-5 w-5 text-primary" />
        <span className="text-body-md text-on-surface">
          Page publique :{" "}
          <span className="select-all font-semibold text-primary">{publicBase}/voter</span>
        </span>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <a
            href="/voter"
            target="_blank"
            rel="noopener"
            className="gold-gradient flex h-touch items-center gap-2 rounded-lg px-4 text-label-lg transition hover:brightness-105"
          >
            Ouvrir la page
            <ArrowRightIcon className="h-4 w-4" />
          </a>
          <a
            href="/voter?style=cartes"
            target="_blank"
            rel="noopener"
            className="flex h-touch items-center rounded-lg border border-primary/40 px-4 text-label-lg text-primary transition-colors hover:bg-primary/5"
          >
            Aperçu « Cartes »
          </a>
          <a
            href="/voter?style=menu"
            target="_blank"
            rel="noopener"
            className="flex h-touch items-center rounded-lg border border-primary/40 px-4 text-label-lg text-primary transition-colors hover:bg-primary/5"
          >
            Aperçu « Carte du menu »
          </a>
        </div>
      </section>

      {data.mode === "sirap" ? (
        <section className="flex flex-wrap items-start gap-3 rounded-xl border border-success/40 bg-success/10 p-4">
          <VoteIcon className="mt-0.5 h-5 w-5 text-success" />
          <div className="min-w-[13rem] flex-1 text-body-md text-on-surface-variant">
            <p>
              <strong className="text-on-surface">Paiements réels</strong> par Wave, Orange Money et MTN
              MoMo, via la passerelle SIRAP / INOVYX. Un vote ne compte qu&apos;une fois son paiement
              confirmé par la passerelle.
            </p>
            <p className="mt-1 text-label-sm text-outline">
              {data.pendingPayments > 0
                ? `${formatNumber(data.pendingPayments)} paiement${data.pendingPayments > 1 ? "s" : ""} en attente de confirmation.`
                : "Aucun paiement en attente."}
            </p>
          </div>
          <ConfirmButton
            action={refreshPendingPaymentsAction}
            values={{}}
            label="Vérifier les paiements en attente"
            confirmMessage="Redemander à la passerelle le statut des paiements en attente ?"
          />
        </section>
      ) : null}

      {data.mode === "simulation" || data.simulatedPayments > 0 ? (
        <section className="flex flex-wrap items-start gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4">
          <WarningIcon className="mt-0.5 h-5 w-5 text-primary" />
          {/* Largeur minimale : sur téléphone, le bouton passe à la ligne plutôt
              que d'écraser le texte en une colonne d'un mot. */}
          <div className="min-w-[13rem] flex-1 text-body-md text-on-surface-variant">
            <p>
              <strong className="text-on-surface">Paiements simulés.</strong>{" "}
              {data.mode === "simulation"
                ? "Le serveur n'est pas en mode de paiement réel (réglage PAIEMENT_MODE) : un clic sur « Payer » valide le vote sans rien prélever."
                : "Il reste des paiements simulés d'une répétition."}{" "}
              Ces votes s&apos;affichent ici et sur la page publique, mais{" "}
              <strong className="text-on-surface">ne comptent pas dans les résultats officiels</strong>.
            </p>
            {data.simulatedPayments > 0 ? (
              <p className="mt-1 text-label-sm text-outline">
                {formatNumber(data.simulatedPayments)} paiement{data.simulatedPayments > 1 ? "s" : ""}{" "}
                simulé{data.simulatedPayments > 1 ? "s" : ""} pour {votesLabel(data.simulatedVotes)}.
              </p>
            ) : null}
          </div>
          {data.simulatedPayments > 0 ? (
            <ConfirmButton
              action={clearSimulatedPaymentsAction}
              values={{}}
              label="Effacer les paiements simulés"
              confirmMessage="Effacer tous les paiements simulés ? Les votes correspondants disparaîtront de la page publique. Les paiements réels ne sont pas touchés."
              icon={<TrashIcon className="h-4 w-4" />}
            />
          ) : null}
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Chiffres clés">
        <Tile
          label="Votes en ligne"
          value={formatNumber(data.onlineVotes)}
          detail={
            data.importedVotes > 0
              ? `+ ${votesLabel(data.importedVotes)} de l'ancienne plateforme`
              : "payés sur la page publique"
          }
        />
        <Tile
          label="Recettes"
          value={`${formatNumber(data.revenue)} FCFA`}
          detail={
            data.simulatedRevenue > 0
              ? `dont ${formatNumber(data.simulatedRevenue)} FCFA simulés`
              : "paiements confirmés"
          }
        />
        <Tile
          label="Paiements"
          value={formatNumber(data.payments)}
          detail={data.payments > 0 ? `${formatNumber(Math.round(data.onlineVotes / data.payments))} votes en moyenne` : "aucun pour l'instant"}
        />
      </section>

      <div className="grid items-start gap-gutter lg:grid-cols-12">
        <section className="rounded-xl bg-surface-container gold-border lg:col-span-7">
          <div className="flex items-center gap-3 border-b border-outline-variant/30 px-5 py-4">
            <VoteIcon className="h-5 w-5 text-primary" />
            <h2 className="flex-1 font-serif text-headline-md text-primary">Classement du public</h2>
            <span className="text-label-sm text-outline">{votesLabel(data.importedVotes + data.onlineVotes)}</span>
          </div>

          {data.ranking.length === 0 ? (
            <p className="px-5 py-4 text-label-sm text-on-surface-variant">
              Aucun candidat : ajoutez-les dans Configuration.
            </p>
          ) : (
            <ol className="space-y-4 px-5 py-4">
              {data.ranking.map((candidate) => (
                <li key={candidate.id} className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 sm:grid-cols-[2rem_minmax(0,12rem)_minmax(0,1fr)_auto]">
                  <span className="text-label-lg text-outline">{candidate.rank}</span>
                  <span className="flex min-w-0 items-center gap-2">
                    {candidate.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={candidate.photoUrl} alt="" className="h-8 w-8 flex-none rounded-full object-cover" />
                    ) : (
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-surface-high font-serif text-label-sm text-primary">
                        {initials(candidate.name)}
                      </span>
                    )}
                    <span className="truncate text-body-md text-on-surface">{candidate.name}</span>
                  </span>
                  <span className="col-span-2 h-3 sm:col-span-1" aria-hidden="true">
                    <span
                      className="block h-full rounded-r bg-gold"
                      style={{ width: `${Math.max(1, (candidate.votes / maxVotes) * 100)}%` }}
                    />
                  </span>
                  <span className="col-span-2 text-right text-label-lg text-on-surface sm:col-span-1">
                    {votesLabel(candidate.votes)}
                    {candidate.online > 0 && candidate.imported > 0 ? (
                      <span className="block text-label-sm font-normal text-outline">
                        dont {formatNumber(candidate.online)} en ligne
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rounded-xl bg-surface-container p-5 gold-border lg:col-span-5">
          <h2 className="mb-4 font-serif text-headline-md text-primary">Réglages</h2>
          <EventPoster
            posterUrl={session.eventPhotoUrl}
            uploadAction={uploadEventPosterAction}
            removeAction={removeEventPosterAction}
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
          />
          <PublicVoteSettingsForm
            action={updatePublicVoteSettingsAction}
            values={{
              open: session.publicVoteOpen,
              eventName: session.eventName ?? "",
              tagline: session.publicVoteTagline ?? "",
              subtitle: session.publicVoteSubtitle ?? "",
              price: session.publicVotePrice,
              closesAt: toDateTimeInput(session.publicVoteClosesAt),
              showCounts: session.publicVoteShowCounts,
              style: toPublicVoteStyle(session.publicVoteStyle),
              methods: enabledMethods(session.publicVoteMethods),
            }}
          />
        </section>
      </div>

      <section className="rounded-xl bg-surface-container gold-border">
        <div className="flex items-center gap-3 border-b border-outline-variant/30 px-5 py-4">
          <h2 className="flex-1 font-serif text-headline-md text-primary">Derniers paiements</h2>
          <span className="text-label-sm text-outline">les 10 plus récents</span>
        </div>

        {data.recent.length === 0 ? (
          <p className="px-5 py-4 text-label-sm text-on-surface-variant">
            Aucun paiement pour l&apos;instant. Ils apparaîtront ici dès le premier vote.
          </p>
        ) : (
          <div className="overflow-x-auto px-5 py-2">
            <table className="w-full min-w-[36rem] text-body-md">
              <thead>
                <tr className="text-left text-label-sm text-outline">
                  <th className="py-2 pr-3 font-medium">Heure</th>
                  <th className="py-2 pr-3 font-medium">Candidat</th>
                  <th className="py-2 pr-3 text-right font-medium">Votes</th>
                  <th className="py-2 pr-3 text-right font-medium">Montant</th>
                  <th className="py-2 pr-3 font-medium">Statut</th>
                  <th className="py-2 font-medium">Référence</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((payment) => (
                  <tr key={payment.id} className="border-t border-outline-variant/20 align-top">
                    <td className="py-2 pr-3 text-on-surface-variant">{paymentTime(payment.createdAt)}</td>
                    <td className="py-2 pr-3 text-on-surface">
                      {payment.candidateName}
                      <span className="block text-label-sm text-outline">
                        {isPaymentMethod(payment.method) ? PAYMENT_METHOD_LABELS[payment.method] : payment.method}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right text-on-surface">{formatNumber(payment.votes)}</td>
                    <td className="py-2 pr-3 text-right text-on-surface">{formatNumber(payment.amount)} FCFA</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-label-sm ${
                          payment.simulated
                            ? "bg-surface-high text-on-surface-variant"
                            : payment.status === "CONFIRMED"
                              ? "bg-success/15 text-success"
                              : payment.status === "FAILED"
                                ? "bg-error/15 text-error"
                                : "bg-primary/15 text-primary"
                        }`}
                      >
                        {payment.simulated ? "Simulé" : (STATUS_LABELS[payment.status] ?? payment.status)}
                      </span>
                    </td>
                    <td className="py-2 font-mono text-label-sm text-on-surface-variant">{payment.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-error/40 bg-error-container/10">
        <div className="flex items-center gap-3 border-b border-error/20 px-5 py-4">
          <WarningIcon className="h-5 w-5 text-error" />
          <h2 className="flex-1 font-serif text-headline-md text-error">Remise à zéro des votes en ligne</h2>
        </div>
        <div className="px-5 py-4">
          <DangerAction
            action={resetOnlineVotesAction}
            confirmationWord={RESET_ONLINE_CONFIRMATION}
            title="Effacer tous les votes en ligne"
            badge={`${formatNumber(data.importedVotes + data.onlineVotes + data.simulatedVotes)} votes en ligne`}
            description={
              <>
                Efface <strong className="text-on-surface">tous</strong> les paiements du public en
                ligne — simulés <strong className="text-on-surface">et réels</strong> — et remet à
                zéro les compteurs des candidats. À faire entre une répétition et le vrai événement.
              </>
            }
            warning={
              <p>
                Irréversible. Les paiements réels sont des traces comptables : n&apos;effacez qu&apos;une
                fois sûr de repartir de zéro. Le classement du jury n&apos;est pas touché.
              </p>
            }
            submitLabel="Effacer les votes en ligne"
            pendingLabel="Effacement…"
          />
        </div>
      </section>
    </div>
  );
}

function Tile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl bg-surface-container p-4 gold-border">
      <p className="text-label-sm text-on-surface-variant">{label}</p>
      <p className="mt-1 font-serif text-headline-lg lining-nums tabular-nums text-on-surface">{value}</p>
      <p className="text-label-sm text-outline">{detail}</p>
    </div>
  );
}
