"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { connecterAction, inscrireAction, type EtatFormulaire } from "@/lib/comptes-actions";
import { MOT_DE_PASSE_MIN } from "@/lib/comptes-core";
import styles from "./compte.module.css";
import { Icone, type NomIcone } from "./icone";

const initial: EtatFormulaire = {};

function Erreur({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className={styles.erreur}>
      {message}
    </p>
  ) : null;
}

/** Champ à étiquette en capitales, icône à gauche ; œil pour afficher un mot de passe. */
function Champ({
  libelle,
  icone,
  aide,
  ...attributs
}: { libelle: string; icone: NomIcone; aide?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const motDePasse = attributs.type === "password";
  const [visible, setVisible] = useState(false);
  return (
    <label className={styles.champ}>
      <span className={styles.etiquette}>{libelle}</span>
      <span className={styles.saisie}>
        <span className={styles.saisieIcone}>
          <Icone nom={icone} taille={19} />
        </span>
        <input {...attributs} type={motDePasse && visible ? "text" : attributs.type} />
        {motDePasse ? (
          <button
            type="button"
            className={styles.oeil}
            onClick={() => setVisible(!visible)}
            aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            title={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            <Icone nom={visible ? "oeilBarre" : "oeil"} taille={19} />
          </button>
        ) : null}
      </span>
      {aide ? <small className={styles.aide}>{aide}</small> : null}
    </label>
  );
}

export function FormulaireConnexion() {
  const [etat, action, envoi] = useActionState(connecterAction, initial);

  return (
    <form action={action} className={styles.carte}>
      <div className={styles.surtitre}>Espace organisateur</div>
      <h1>Connexion</h1>
      <p className={styles.sousTitre}>Accès réservé aux organisateurs</p>

      <Erreur message={etat.erreur} />

      <Champ
        libelle="Adresse e-mail"
        icone="personne"
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="nom@organisation.com"
        defaultValue={etat.valeurs?.email}
      />
      <Champ
        libelle="Mot de passe"
        icone="cadenas"
        name="motDePasse"
        type="password"
        autoComplete="current-password"
        required
        placeholder="••••••••"
      />

      <button type="submit" className={styles.bouton} disabled={envoi}>
        {envoi ? "Connexion…" : "Ouvrir la session"}
        {envoi ? null : <Icone nom="fleche" taille={18} />}
      </button>

      <p className={styles.bas}>
        Pas encore de compte ? <Link href="/inscription">Créer un compte</Link>
      </p>
    </form>
  );
}

export function FormulaireInscription() {
  const [etat, action, envoi] = useActionState(inscrireAction, initial);

  return (
    <form action={action} className={styles.carte}>
      <div className={styles.surtitre}>Nouveau compte</div>
      <h1>Créer un compte</h1>
      <p className={styles.sousTitre}>Un compte par organisation</p>

      <Erreur message={etat.erreur} />

      <Champ
        libelle="Nom de l’organisation"
        icone="personnes"
        name="organisation"
        autoComplete="organization"
        required
        maxLength={80}
        placeholder="Kabowd Production"
        defaultValue={etat.valeurs?.organisation}
      />
      <Champ
        libelle="Adresse e-mail"
        icone="personne"
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="nom@organisation.com"
        defaultValue={etat.valeurs?.email}
      />
      <Champ
        libelle="Mot de passe"
        icone="cadenas"
        name="motDePasse"
        type="password"
        autoComplete="new-password"
        required
        minLength={MOT_DE_PASSE_MIN}
        aide={`Au moins ${MOT_DE_PASSE_MIN} caractères.`}
      />
      <Champ
        libelle="Confirmez le mot de passe"
        icone="cadenas"
        name="confirmation"
        type="password"
        autoComplete="new-password"
        required
      />

      <button type="submit" className={styles.bouton} disabled={envoi}>
        {envoi ? "Création…" : "Créer mon compte"}
        {envoi ? null : <Icone nom="fleche" taille={18} />}
      </button>

      <p className={styles.bas}>
        Déjà un compte ? <Link href="/connexion">Se connecter</Link>
      </p>
      <div className={styles.rassurance}>
        <span>
          <Icone nom="coche" taille={15} /> Sans installation
        </span>
        <span>
          <Icone nom="coche" taille={15} /> Accompagnement Inovyx Tech
        </span>
      </div>
    </form>
  );
}
