import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Concours culinaire — Administration",
  description: "Configuration, pilotage des votes et résultats du concours culinaire",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
