import type { Metadata } from "next";
import e from "@/components/espace/evenements.module.css";
import { ListeOrganisations } from "@/components/espace/liste-organisations";
import o from "@/components/espace/organisations.module.css";
import styles from "@/components/espace/panel.module.css";
import { exigerSuperAdmin } from "@/lib/espace";
import { nombre } from "@/lib/format-espace";
import { chiffresPlateforme, commissionsParOrganisation, listerOrganisations } from "@/lib/plateforme";

export const metadata: Metadata = { title: "Organisations — Plateforme DIGITALYX-VOTE" };

export default async function PageOrganisations() {
  await exigerSuperAdmin();
  const [organisations, chiffres, commissions] = await Promise.all([
    listerOrganisations(),
    chiffresPlateforme(),
    commissionsParOrganisation(),
  ]);
  const serveurReel = process.env.PAIEMENT_MODE === "sirap";
  const aReverser = commissions.reduce((s, c) => s + c.resteDu, 0);

  return (
    <>
      <div className={e.entete}>
        <div>
          <div className={e.surtitre}>Clients de la plateforme</div>
          <h1 className={e.titre}>
            Organisations<span>.</span>
          </h1>
        </div>
      </div>

      {!serveurReel ? (
        <div className={`${styles.bandeau} ${styles.bandeauInfo}`}>
          <div>
            <strong>Serveur en simulation</strong>
            <span>
              PAIEMENT_MODE n&rsquo;est pas « sirap » sur ce serveur : même une organisation réglée en paiements réels
              reste en simulation.
            </span>
          </div>
        </div>
      ) : null}

      <div className={o.kpis}>
        <div className={o.kpi}>
          <span>Organisations</span>
          <strong>{nombre(chiffres.organisations)}</strong>
          {nombre(chiffres.organisations - chiffres.suspendues)} actives · {nombre(chiffres.suspendues)} suspendue
          {chiffres.suspendues > 1 ? "s" : ""}
        </div>
        <div className={o.kpi}>
          <span>Concours en direct</span>
          <strong>{nombre(chiffres.ouvertes)}</strong>
          sélection{chiffres.ouvertes > 1 ? "s" : ""} ouverte{chiffres.ouvertes > 1 ? "s" : ""} au vote
        </div>
        <div className={o.kpi}>
          <span>Encaissé (réel)</span>
          <strong className={o.vert}>{nombre(chiffres.brut)} F</strong>
          commission plateforme {nombre(chiffres.commission)} F
        </div>
        <div className={`${o.kpi} ${o.kpiFonce}`}>
          <span>À reverser</span>
          <strong>{nombre(aReverser)} F</strong>
          {nombre(chiffres.retraitsAttente.nb)} demande{chiffres.retraitsAttente.nb > 1 ? "s" : ""} de retrait en attente
        </div>
      </div>

      <ListeOrganisations
        organisations={organisations.map((org) => ({
          id: org.id,
          nom: org.nom,
          actif: org.actif,
          mode: org.mode === "sirap" ? "sirap" : "simulation",
          partOrganisateur: org.partOrganisateur,
          email: (org.utilisateurs.find((u) => u.role === "PROPRIETAIRE") ?? org.utilisateurs[0])?.email ?? null,
          selectionsOuvertes: org.selectionsOuvertes,
          brut: org.brut,
          reverse: org.reverse,
        }))}
      />
    </>
  );
}
