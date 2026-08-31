import {
  DISCOVERY_PORT,
  isPubliclyHosted,
  lanAddresses,
  publicUrl,
  serverName,
  serverPort,
} from "@/lib/network";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ConnexionPage() {
  const hosted = isPubliclyHosted();
  const addresses = lanAddresses();
  const tables = await prisma.votingTable.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Connexion des tablettes</h1>
        <p className="mt-1 text-sm text-slate-500">
          {hosted
            ? "Ce serveur est hébergé en ligne : son adresse est embarquée dans l'application, les tablettes s'y connectent dès leur premier lancement."
            : "Aucune adresse à saisir : il suffit que les tablettes soient sur le même Wi-Fi que ce portable. Elles cherchent le serveur toutes seules au lancement, et le retrouvent d'elles-mêmes après une coupure."}
        </p>
      </div>

      {hosted ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 font-semibold">Adresse publique</h2>
          <p className="font-mono text-sm text-slate-700">{publicUrl()}</p>
        </section>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">Ce serveur</h2>
          <dl className="grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Nom annoncé</dt>
              <dd className="font-mono text-sm text-slate-800">{serverName()}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Port web</dt>
              <dd className="font-mono text-sm text-slate-800">{serverPort()}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">
                Port de découverte
              </dt>
              <dd className="font-mono text-sm text-slate-800">UDP {DISCOVERY_PORT}</dd>
            </div>
          </dl>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Réseaux sur lesquels ce portable est visible
            </p>
            {addresses.length === 0 ? (
              <p className="mt-2 text-sm text-amber-800">
                Aucune interface réseau active. Connectez ce portable au routeur Wi-Fi de la
                salle : sans réseau, aucune tablette ne peut le trouver.
              </p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-2">
                {addresses.map((address) => (
                  <li
                    key={address}
                    className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-sm text-slate-700"
                  >
                    {address}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-slate-500">
              Ces adresses sont indiquées pour le diagnostic uniquement — rien à recopier sur les
              tablettes.
            </p>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 font-semibold">Tables disponibles ({tables.length})</h2>
        <p className="mb-4 text-sm text-slate-500">
          Liste proposée à la tablette une fois le serveur trouvé. Une tablette par table.
        </p>

        <ul className="divide-y divide-slate-100">
          {tables.map((table) => (
            <li key={table.id} className="flex items-center gap-3 py-2.5">
              <span className="flex-1 font-medium text-slate-900">{table.name}</span>
              <span className="text-sm text-slate-500">
                {table.type === "SPECIAL" ? "Jury spécial ×2" : "Lambda"} ·{" "}
                {table.expectedJurors} juré{table.expectedJurors > 1 ? "s" : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
        <h2 className="mb-2 font-semibold text-slate-900">
          Si une tablette ne trouve pas le serveur
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          {hosted ? (
            <>
              <li>
                La tablette doit disposer d&apos;une connexion internet (Wi-Fi de la salle ou
                partage de connexion 4G).
              </li>
              <li>
                Si la connexion tombe pendant l&apos;événement, les tablettes continuent de
                fonctionner et conservent les votes. Vérifiez avant la proclamation que le
                compteur « en attente » est à zéro sur chacune.
              </li>
            </>
          ) : (
            <>
              <li>
                Vérifier que la tablette est bien sur le <strong>même réseau Wi-Fi</strong> que ce
                portable, et non sur ses données mobiles.
              </li>
              <li>
                Le pare-feu Windows doit autoriser Node.js sur les <strong>réseaux privés</strong>,
                pour le port web {serverPort()} <em>et</em> pour le port UDP {DISCOVERY_PORT}.
              </li>
              <li>
                Certains routeurs bloquent la diffusion entre appareils (« AP isolation », mode
                invité). Désactiver cette option, ou brancher un routeur dédié à l&apos;événement.
              </li>
              <li>
                À défaut de diffusion, la tablette balaie le sous-réseau : la recherche prend alors
                une dizaine de secondes au lieu d&apos;une.
              </li>
            </>
          )}
          <li>
            Une tablette qui ne trouve rien n&apos;est pas bloquée : elle continue d&apos;enregistrer
            les votes et les enverra dès que le serveur réapparaît.
          </li>
        </ul>
      </section>
    </div>
  );
}
