"use client";

import Link from "next/link";
import { useActionState } from "react";
import { connecterAction, inscrireAction, type EtatFormulaire } from "@/lib/comptes-actions";
import { MOT_DE_PASSE_MIN } from "@/lib/comptes-core";
import styles from "./espace.module.css";

const initial: EtatFormulaire = {};

function Erreur({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className={styles.erreur}>
      {message}
    </p>
  ) : null;
}

export function FormulaireConnexion() {
  const [etat, action, envoi] = useActionState(connecterAction, initial);

  return (
    <form action={action} className={styles.carte}>
      <h1>Connexion</h1>
      <p className={styles.sousTitre}>Accédez à l&rsquo;espace de votre organisation.</p>

      <Erreur message={etat.erreur} />

      <label className={styles.champ}>
        <span>Adresse e-mail</span>
        <input name="email" type="email" autoComplete="email" required defaultValue={etat.valeurs?.email} />
      </label>
      <label className={styles.champ}>
        <span>Mot de passe</span>
        <input name="motDePasse" type="password" autoComplete="current-password" required />
      </label>

      <button type="submit" className={styles.bouton} disabled={envoi}>
        {envoi ? "Connexion…" : "Se connecter"}
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
      <h1>Créer un compte</h1>
      <p className={styles.sousTitre}>Un compte par organisation. Vous en serez le propriétaire.</p>

      <Erreur message={etat.erreur} />

      <label className={styles.champ}>
        <span>Nom de l&rsquo;organisation</span>
        <input
          name="organisation"
          autoComplete="organization"
          required
          maxLength={80}
          defaultValue={etat.valeurs?.organisation}
        />
      </label>
      <label className={styles.champ}>
        <span>Adresse e-mail</span>
        <input name="email" type="email" autoComplete="email" required defaultValue={etat.valeurs?.email} />
      </label>
      <label className={styles.champ}>
        <span>Mot de passe</span>
        <input name="motDePasse" type="password" autoComplete="new-password" required minLength={MOT_DE_PASSE_MIN} />
        <small className={styles.aide}>Au moins {MOT_DE_PASSE_MIN} caractères.</small>
      </label>
      <label className={styles.champ}>
        <span>Confirmez le mot de passe</span>
        <input name="confirmation" type="password" autoComplete="new-password" required />
      </label>

      <button type="submit" className={styles.bouton} disabled={envoi}>
        {envoi ? "Création…" : "Créer mon compte"}
      </button>

      <p className={styles.bas}>
        Déjà un compte ? <Link href="/connexion">Se connecter</Link>
      </p>
    </form>
  );
}
