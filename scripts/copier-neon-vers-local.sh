#!/usr/bin/env bash
# Recopie la base Neon (hebergee) dans le Postgres local, a l'identique.
#
# A lancer la veille de l'evenement : le Postgres local devient alors un filet
# a jour, utilisable si internet manque en salle. C'est un instantane, pas une
# synchronisation : les deux bases divergent des la premiere modification.
#
# ECRASE INTEGRALEMENT la base locale.
#
#   bash scripts/copier-neon-vers-local.sh
set -euo pipefail

PG="/c/Program Files/PostgreSQL/18/bin"
NEON=$(grep -E '^DATABASE_URL=' .env | sed -E 's/^DATABASE_URL="?//; s/"?$//')
LOCAL=$(grep -E '^# ?DATABASE_URL="postgresql://postgres' .env | sed -E 's/^# ?DATABASE_URL="?//; s/"?$//')

if [ -z "$LOCAL" ]; then
  echo "Adresse de la base locale introuvable dans .env (ligne commentee)." >&2
  exit 1
fi

echo "source : ${NEON%%\?*}"
echo "cible  : $LOCAL"

"$PG/pg_dump" --clean --if-exists --no-owner --no-acl "$NEON" > /tmp/neon.sql
"$PG/psql" --quiet --set ON_ERROR_STOP=on "$LOCAL" -f /tmp/neon.sql
rm -f /tmp/neon.sql

echo "Base locale alignee sur Neon."
