import { redirect } from "next/navigation";
import { ChefHatIcon, ScreenIcon } from "@/components/icons";
import { MainNav } from "@/components/main-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { logoutAction } from "@/lib/actions";
import { isAuthenticated } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Garde d'accès unique pour toutes les pages d'administration.
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[color:var(--c-line)] bg-[color:var(--header-bg)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center gap-x-8 gap-y-3 px-6 py-3 lg:px-12">
          <span className="flex items-center gap-2 font-serif text-headline-md text-primary">
            <ChefHatIcon className="h-6 w-6" />
            Concours culinaire
          </span>

          <MainNav />

          <div className="ml-auto flex items-center gap-3">
            {/* Ouvre l'écran suivi par la salle dans un onglet séparé : le
                dashboard reste affiché sur le portable pendant que la
                projection vit de son côté, sur le second écran. */}
            <a
              href="/direct"
              target="_blank"
              rel="noopener"
              title="Ouvrir l'écran public dans un nouvel onglet"
              className="flex items-center gap-2 rounded-lg border border-primary/40 px-3 py-1.5 text-label-sm text-primary transition-colors hover:border-primary hover:text-gold-soft"
            >
              <ScreenIcon className="h-4 w-4" />
              Écran public
            </a>

            <ThemeToggle />
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg px-2 py-1.5 text-label-sm text-primary transition-colors hover:text-gold-soft"
              >
                Déconnexion
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-gutter lg:px-12">{children}</main>

      <footer className="mx-auto w-full max-w-[1440px] px-6 py-6 text-label-sm text-outline lg:px-12">
        Concours culinaire — espace organisateur.
      </footer>
    </>
  );
}
