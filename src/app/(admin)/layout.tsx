import Link from "next/link";
import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
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
      <header className="sticky top-0 z-10 border-b border-[color:var(--c-line)] bg-[color:var(--header-bg)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="flex items-center gap-2 font-serif text-lg font-semibold text-[color:var(--gold)]">
            <span aria-hidden className="text-xl">🍽️</span>
            Concours culinaire
          </span>

          <nav className="flex flex-wrap gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-500 transition hover:bg-[color:var(--c-line)] hover:text-[color:var(--gold-soft)]"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg border border-[color:var(--c-line)] px-3 py-1.5 text-sm text-slate-500 transition hover:text-[color:var(--gold-soft)]"
              >
                Déconnexion
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
