import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/lib/actions";
import { isAuthenticated } from "@/lib/session";

const NAV_LINKS = [
  { href: "/", label: "Pilotage" },
  { href: "/configuration", label: "Configuration" },
  { href: "/appairage", label: "Connexion" },
  { href: "/resultats", label: "Résultats" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Garde d'accès unique pour toutes les pages d'administration.
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="font-semibold text-slate-900">Concours culinaire</span>

          <nav className="flex flex-wrap gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <form action={logoutAction} className="ml-auto">
            <button
              type="submit"
              className="rounded-lg px-3 py-1.5 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Déconnexion
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
