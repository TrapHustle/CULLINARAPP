import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Concours culinaire — Administration",
  description: "Configuration, pilotage des votes et résultats du concours culinaire",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased" suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        {/*
          Applique le thème AVANT le premier rendu, pour éviter tout
          clignotement clair→sombre. Choix mémorisé, sinon préférence système,
          sinon sombre (le look doré par défaut).
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
