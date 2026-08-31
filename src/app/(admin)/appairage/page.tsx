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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Connexion des tablettes</h1>
        <p className="mt-1 text-sm text-slate-500">
          {hosted
            ? "Adresse embarquée dans l'application : les tablettes se connectent dès leur lancement."
            : "Rien à saisir : sur le même Wi-Fi, les tablettes trouvent le serveur seules."}
        </p>
      </div>

      {hosted ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Adresse publique
          </h2>
          <p className="font-mono text-slate-800">{publicUrl()}</p>
        </section>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Serveur</dt>
              <dd className="font-mono text-slate-800">{serverName()}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Port web</dt>
              <dd className="font-mono text-slate-800">{serverPort()}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Découverte</dt>
              <dd className="font-mono text-slate-800">UDP {DISCOVERY_PORT}</dd>
            </div>
          </dl>

          {addresses.length > 0 ? (
            <p className="mt-4 border-t border-slate-200 pt-3 text-sm text-slate-500">
              Visible sur : {addresses.join("  ·  ")}{" "}
              <span className="text-slate-400">(diagnostic — rien à recopier)</span>
            </p>
          ) : (
            <p className="mt-4 border-t border-slate-200 pt-3 text-sm text-amber-700">
              Aucune interface réseau active — connectez ce portable au Wi-Fi de la salle.
            </p>
          )}
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        <h2 className="mb-2 font-semibold text-slate-900">Si une tablette ne trouve pas le serveur</h2>
        <ul className="list-disc space-y-1 pl-5">
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
          <li>Une tablette hors ligne n&apos;est pas bloquée : elle garde les votes et les envoie au retour.</li>
        </ul>
      </section>
    </div>
  );
}
