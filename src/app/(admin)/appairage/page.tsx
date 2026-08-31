import { WifiIcon } from "@/components/icons";
import {
  DISCOVERY_PORT,
  isPubliclyHosted,
  lanAddresses,
  publicUrl,
  serverName,
  serverPort,
} from "@/lib/network";

export const dynamic = "force-dynamic";

export default async function ConnexionPage() {
  const hosted = isPubliclyHosted();
  const addresses = lanAddresses();

  return (
    <div className="space-y-gutter">
      <div>
        <p className="text-label-sm uppercase tracking-[0.2em] text-primary">Salle</p>
        <h1 className="mt-1 font-serif text-display-lg text-on-surface">Connexion des tablettes</h1>
        <p className="mt-2 max-w-2xl text-body-md text-on-surface-variant">
          {hosted
            ? "Adresse embarquée dans l'application : les tablettes se connectent dès leur lancement."
            : "Rien à saisir : sur le même Wi-Fi, les tablettes trouvent le serveur seules."}
        </p>
      </div>

      {hosted ? (
        <section className="rounded-xl bg-surface-container p-6 gold-border">
          <h2 className="mb-2 text-label-sm uppercase tracking-wider text-outline">
            Adresse publique
          </h2>
          <p className="font-mono text-headline-md text-primary">{publicUrl()}</p>
        </section>
      ) : (
        <section className="relative overflow-hidden rounded-xl bg-surface-container p-6 gold-border">
          <div aria-hidden className="gold-halo pointer-events-none absolute inset-0" />

          <div className="relative flex items-center gap-3 text-primary">
            <WifiIcon className="h-6 w-6" />
            <h2 className="font-serif text-headline-md">Balise de découverte active</h2>
          </div>

          <dl className="relative mt-6 grid gap-6 sm:grid-cols-3">
            <div>
              <dt className="text-label-sm uppercase tracking-wider text-outline">Serveur</dt>
              <dd className="mt-1 font-mono text-body-lg text-on-surface">{serverName()}</dd>
            </div>
            <div>
              <dt className="text-label-sm uppercase tracking-wider text-outline">Port web</dt>
              <dd className="mt-1 font-mono text-body-lg text-on-surface">{serverPort()}</dd>
            </div>
            <div>
              <dt className="text-label-sm uppercase tracking-wider text-outline">Découverte</dt>
              <dd className="mt-1 font-mono text-body-lg text-on-surface">UDP {DISCOVERY_PORT}</dd>
            </div>
          </dl>

          {addresses.length > 0 ? (
            <p className="relative mt-6 border-t border-outline-variant/30 pt-4 text-label-sm text-on-surface-variant">
              Visible sur : {addresses.join("  ·  ")}{" "}
              <span className="text-outline">(diagnostic — rien à recopier)</span>
            </p>
          ) : (
            <p className="relative mt-6 border-t border-outline-variant/30 pt-4 text-label-sm text-error">
              Aucune interface réseau active — connectez ce portable au Wi-Fi de la salle.
            </p>
          )}
        </section>
      )}

      <section className="rounded-xl bg-surface-container p-6 gold-border">
        <h2 className="mb-3 font-serif text-headline-md text-primary">
          Si une tablette ne trouve pas le serveur
        </h2>
        <ul className="list-disc space-y-1.5 pl-5 text-body-md text-on-surface-variant marker:text-primary">
          {hosted ? (
            <li>La tablette a besoin d&apos;une connexion internet (Wi-Fi de la salle ou 4G).</li>
          ) : (
            <>
              <li>Même réseau Wi-Fi que ce portable (pas de données mobiles).</li>
              <li>
                Pare-feu Windows : autoriser Node.js en réseau privé (port {serverPort()} et UDP{" "}
                {DISCOVERY_PORT}).
              </li>
            </>
          )}
          <li>
            Une tablette hors ligne n&apos;est pas bloquée : elle garde les votes et les envoie au
            retour.
          </li>
        </ul>
      </section>
    </div>
  );
}
