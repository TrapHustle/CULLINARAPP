#!/bin/bash
# Sauvegarde planifiee de la base du serveur de vote (VPS).
# Lecture seule cote base : aucun impact sur les votes en cours.
#
#   sauvegarde-base.sh                  sauvegarde puis purge
#   sauvegarde-base.sh --purge-seulement   purge sans sauvegarder
#   sauvegarde-base.sh --essai             montre ce que la purge supprimerait,
#                                          sans rien supprimer
set -euo pipefail

PRIVE="/var/www/clients/client0/web3/private"
APP="$PRIVE/serveur_vote"
DEST="$PRIVE/sauvegardes"
PGDUMP="/usr/lib/postgresql/14/bin/pg_dump"

# Conservation en deux etages. Une sauvegarde par heure sur 14 jours ferait 336
# fichiers : a ~10 Mo piece, plus de 3 Go pour des dumps presque identiques.
# On garde donc le detail horaire sur les deux derniers jours - la fenetre ou
# l'on veut pouvoir revenir heure par heure apres une fausse manoeuvre - puis
# une seule sauvegarde par jour au-dela.
GARDE_HORAIRE_HEURES=48
RETENTION_JOURS=14

# Permet de surcharger les chemins en test. En production, rien n'est passe.
MODE="${1:-}"
DEST="${SAUVEGARDE_DEST:-$DEST}"

mkdir -p "$DEST"

# --------------------------------------------------------------------------
# Purge
# --------------------------------------------------------------------------

# Supprime un fichier, ou l'annonce seulement en mode --essai.
retirer() {
  if [ "$MODE" = "--essai" ]; then
    echo "  supprimerait $(basename "$1")"
  else
    rm -f "$1"
  fi
}

purger() {
  # 1. Au-dela de la retention longue, plus rien n'est garde.
  #    `-mtime +N` compte en tranches de 24 h : +14 vise bien les fichiers de
  #    plus de 15 jours, d'ou le `-mtime +$((RETENTION_JOURS - 1))`.
  while IFS= read -r vieux; do
    [ -n "$vieux" ] && retirer "$vieux"
  done < <(find "$DEST" -maxdepth 1 -name 'concours-*.sql.gz' -mtime "+$((RETENTION_JOURS - 1))")

  # 2. Hors de la fenetre horaire, on ne garde qu'une sauvegarde par jour.
  #    La date est lue dans le NOM du fichier, pas dans sa date de
  #    modification : un `cp` ou un `touch` ne doit pas pouvoir fausser la
  #    purge et faire disparaitre la sauvegarde d'une journee entiere.
  local seuil jour_garde="" nom horodatage jour
  seuil="$(date -d "$GARDE_HORAIRE_HEURES hours ago" +%Y%m%d%H%M)"

  # Du plus recent au plus ancien : la premiere sauvegarde rencontree pour une
  # journee est la plus recente de cette journee, c'est celle qu'on garde.
  while IFS= read -r nom; do
    horodatage="${nom#concours-}"
    horodatage="${horodatage%.sql.gz}"   # AAAAMMJJ-HHMM
    jour="${horodatage%%-*}"             # AAAAMMJJ

    # Dans les dernieres 48 h : on garde tout, sans toucher a jour_garde —
    # sinon la journee en cours serait comptee comme deja servie et la
    # premiere sauvegarde hors fenetre du meme jour serait supprimee a tort.
    if [ "${horodatage/-/}" -ge "$seuil" ]; then
      continue
    fi

    if [ "$jour" = "$jour_garde" ]; then
      retirer "$DEST/$nom"
    else
      jour_garde="$jour"
    fi
  done < <(find "$DEST" -maxdepth 1 -name 'concours-*.sql.gz' -printf '%f\n' | sort -r)

  # 3. Dumps interrompus : un fichier temporaire de plus d'un jour ne sera
  #    jamais termine.
  while IFS= read -r reste; do
    [ -n "$reste" ] && retirer "$reste"
  done < <(find "$DEST" -maxdepth 1 -name '.en-cours-*.sql.gz' -mtime +1)
}

if [ "$MODE" = "--purge-seulement" ] || [ "$MODE" = "--essai" ]; then
  purger
  echo "$(date -Is) purge $MODE : $(ls -1 "$DEST"/concours-*.sql.gz 2>/dev/null | wc -l) sauvegarde(s) restante(s)"
  exit 0
fi

# --------------------------------------------------------------------------
# Sauvegarde
# --------------------------------------------------------------------------

# L'adresse de connexion est lue dans le .env : aucun mot de passe en dur ici.
URL="$(grep '^DATABASE_URL' "$APP/.env" | cut -d'"' -f2)"
if [ -z "$URL" ]; then
  echo "$(date -Is) ERREUR DATABASE_URL introuvable dans $APP/.env" >&2
  exit 1
fi

HORO="$(date +%Y%m%d-%H%M)"
TMP="$DEST/.en-cours-$HORO.sql.gz"
FINAL="$DEST/concours-$HORO.sql.gz"

# On ecrit d'abord sous un nom temporaire, puis on verifie l'archive, puis on
# renomme : un dump interrompu ne peut donc jamais passer pour une sauvegarde.
"$PGDUMP" "$URL" --no-owner --no-acl | gzip > "$TMP"
gunzip -t "$TMP"
mv "$TMP" "$FINAL"

# La purge vient apres une sauvegarde reussie : si le dump echoue, le script
# s'arrete avant et l'historique existant reste intact.
purger

echo "$(date -Is) OK $(basename "$FINAL") $(stat -c%s "$FINAL") octets" >> "$DEST/journal.log"
