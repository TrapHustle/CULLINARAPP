import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ce projet vit dans un dossier qui contient un autre monorepo : sans cette
  // ancre, Turbopack remonte jusqu'au package.json parent et tente de résoudre
  // ses dépendances.
  turbopack: {
    root: import.meta.dirname,
  },

  // Les tablettes interrogent le serveur depuis une autre machine du réseau
  // local. En développement, Next.js bloque par défaut les requêtes provenant
  // d'une origine différente de `localhost` : sans cette liste, l'appairage des
  // tablettes échouerait pendant les répétitions (§10.3).
  allowedDevOrigins: [
    "192.168.0.0/16",
    "10.0.0.0/8",
    "172.16.0.0/12",
    "*.local",
  ],

  // Les portraits des candidats transitent par une action serveur, dont le
  // corps est limité à 1 Mo par défaut — une photo prise au téléphone dépasse
  // systématiquement cette taille. La limite réelle est appliquée dans
  // l'action elle-même (MAX_IMAGE_BYTES), avec un message compréhensible ;
  // celle-ci n'est qu'un plafond de transport, volontairement au-dessus.
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },

  // Le client Postgres ouvre des sockets : il doit rester externe au bundle
  // serveur pour ne pas être transformé par le bundler.
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
};

export default nextConfig;
