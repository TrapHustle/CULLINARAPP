import styles from "./panel.module.css";

/** Deux initiales du nom, pour un candidat sans photo. */
export function initialesNom(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  return ((mots[0]?.[0] ?? "") + (mots.length > 1 ? mots[mots.length - 1][0] : (mots[0]?.[1] ?? ""))).toUpperCase() || "?";
}

export function Portrait({ nom, photoUrl, taille = 44 }: { nom: string; photoUrl: string | null; taille?: number }) {
  const dimension = { width: taille, height: taille };
  return photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photoUrl} alt="" className={styles.portrait} style={dimension} />
  ) : (
    <span className={styles.portrait} style={dimension} aria-hidden="true">
      {initialesNom(nom)}
    </span>
  );
}

/** Champs nom, ville et photo d'un candidat (création ou modification). */
export function ChampsCandidat({ nom = "", ville = "" }: { nom?: string; ville?: string }) {
  return (
    <>
      <label className={styles.champ}>
        <span>Nom</span>
        <input name="nom" defaultValue={nom} required maxLength={80} placeholder="Awa Koné" />
      </label>
      <label className={styles.champ}>
        <span>Ville</span>
        <input name="ville" defaultValue={ville} maxLength={60} placeholder="Bouaké" />
        <small>Facultatif. Affichée sous le nom sur la page de vote.</small>
      </label>
      <label className={styles.champ}>
        <span>Photo</span>
        <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" style={{ height: "auto", padding: 9 }} />
        <small>JPEG, PNG ou WebP, 4 Mo au plus. Portrait carré conseillé.</small>
      </label>
    </>
  );
}
