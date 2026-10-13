import type { Metadata } from "next";
import Link from "next/link";
import { Marque } from "@/components/accueil/marque";
import { Navigation } from "@/components/accueil/navigation";
import { Icone, type NomIcone } from "@/components/espace/icone";
import { dmSans } from "@/lib/police";
import styles from "./accueil.module.css";

/**
 * Page d'accueil — design de la refonte (Figma Make, « Landing page design »),
 * avec le contenu de DIGITALYX-VOTE.
 */

export const metadata: Metadata = {
  title: "DIGITALYX-VOTE — le vote de vos concours, en ligne, en salle et par le jury",
  description:
    "Vote du public en ligne, vote en salle et note du jury réunis dans un seul classement sur 100, calculé en direct.",
};

const c = (...noms: string[]) => noms.map((n) => styles[n]).join(" ");

/** Aperçu du panneau organisateur, avec l'exemple chiffré du document de calcul. */
function Apercu() {
  const classement = [
    { nom: "Candidat B", note: "61,5", largeur: "61.5%", barre: "bar-blue" },
    { nom: "Candidat A", note: "61,0", largeur: "61%", barre: "bar-navy" },
    { nom: "Candidat C", note: "55,5", largeur: "55.5%", barre: "bar-gray" },
  ];

  return (
    <div className={c("dashboard-shell")} aria-hidden="true">
      <div className={c("dashboard-topbar")}>
        <div className={c("brand")}>
          <span className={c("brand-mark")}>
            <Icone nom="coche" taille={15} />
          </span>
          <span>DIGITALYX-VOTE</span>
        </div>
        <div className={c("event-switcher")}>
          Talent Traiteur 2026
          <Icone nom="chevron" taille={14} />
        </div>
        <div className={c("profile")}>
          <span className={c("status-dot")} />
          En direct
          <span className={c("avatar")}>KP</span>
        </div>
      </div>
      <div className={c("dashboard-body")}>
        <aside className={c("sidebar")}>
          <div className={c("side-label")}>ÉVÉNEMENT</div>
          <div className={c("side-link", "active")}>
            <span className={c("side-icon")}><Icone nom="etincelle" taille={16} /></span>Vue d’ensemble
          </div>
          <div className={c("side-link")}>
            <span className={c("side-icon")}><Icone nom="calendrier" taille={16} /></span>Sélections
          </div>
          <div className={c("side-link")}>
            <span className={c("side-icon")}><Icone nom="personnes" taille={16} /></span>Candidats
          </div>
          <div className={c("side-link")}>
            <span className={c("side-icon")}><Icone nom="trophee" taille={16} /></span>Résultats
          </div>
          <div className={c("side-help")}>
            <span className={c("help-icon")}>?</span>
            <div>
              <strong>Besoin d’aide ?</strong>
              <small>L’équipe Inovyx Tech vous répond.</small>
            </div>
          </div>
        </aside>
        <div className={c("dash-content")}>
          <div className={c("dash-heading")}>
            <div>
              <div className={c("eyebrow")}>TABLEAU DE BORD</div>
              <div className={c("dash-title")}>Bonjour, Kabowd Production.</div>
              <div className={c("dash-subtitle")}>La finale est ouverte au vote.</div>
            </div>
            <span className={c("button", "button-secondary")}>
              <Icone nom="lecture" taille={16} /> Écran de proclamation
            </span>
          </div>
          <div className={c("stat-grid")}>
            <div className={c("stat-card")}>
              <div className={c("stat-icon", "blue")}><Icone nom="personnes" taille={18} /></div>
              <span className={c("stat-label")}>Candidats en lice</span>
              <strong className={c("stat-value")}>3</strong>
              <span className={c("stat-detail")}>Finale</span>
            </div>
            <div className={c("stat-card")}>
              <div className={c("stat-icon", "purple")}><Icone nom="urne" taille={18} /></div>
              <span className={c("stat-label")}>Voix en ligne</span>
              <strong className={c("stat-value")}>1 000</strong>
              <span className={c("stat-detail", "positive")}>Paiements confirmés</span>
            </div>
            <div className={c("stat-card")}>
              <div className={c("stat-icon", "green")}><Icone nom="bouclier" taille={18} /></div>
              <span className={c("stat-label")}>Pondération</span>
              <strong className={c("stat-value")}>30 · 30 · 40</strong>
              <span className={c("stat-detail")}>En ligne · Salle · Jury</span>
            </div>
          </div>
          <div className={c("live-card")}>
            <div className={c("live-top")}>
              <div>
                <div className={c("live-kicker")}><span className={c("pulse")} /> VOTE EN COURS</div>
                <div className={c("live-title")}>Finale · Abidjan</div>
                <div className={c("live-question")}>Classement provisoire, ramené sur 100</div>
              </div>
              <div className={c("timer")}><Icone nom="horloge" taille={17} /> En direct</div>
            </div>
            <div className={c("results")}>
              {classement.map((ligne) => (
                <div key={ligne.nom}>
                  <div className={c("result-meta")}>
                    <span>{ligne.nom}</span>
                    <strong>{ligne.note} / 100</strong>
                  </div>
                  <div className={c("track")}>
                    <span className={c("bar", ligne.barre)} style={{ width: ligne.largeur }} />
                  </div>
                </div>
              ))}
            </div>
            <div className={c("live-footer")}>
              <span><Icone nom="cadenas" taille={14} /> Calcul pondéré, recalculé à chaque vote</span>
              <strong>3 canaux de vote</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const ATOUTS: { icone: NomIcone; titre: string; texte: string }[] = [
  {
    icone: "etincelle",
    titre: "Préparez sans complexité",
    texte:
      "Créez votre événement et ses sélections jusqu’à la finale, ajoutez vos candidats et réglez votre grille de notation, critère par critère.",
  },
  {
    icone: "urne",
    titre: "Votez, partout",
    texte:
      "Le public vote en ligne par Wave, Orange Money ou MTN MoMo. La salle et le jury notent sur tablette, même sans internet.",
  },
  {
    icone: "bouclier",
    titre: "Proclamez en confiance",
    texte:
      "Chaque canal est ramené sur 100 puis pondéré selon vos règles. Le classement se met à jour en direct, et les égalités vous sont signalées.",
  },
];

const FORMULES = [
  {
    nom: "Essentiel",
    description: "Pour un premier concours.",
    prix: "150 000",
    devise: "FCFA",
    note: "par événement",
    points: ["Une sélection", "Vote en ligne payant", "Classement en direct", "Support par e-mail"],
    action: "Choisir Essentiel",
  },
  {
    nom: "Professionnel",
    description: "Pour les concours jusqu’à la finale.",
    prix: "450 000",
    devise: "FCFA",
    note: "par événement",
    points: [
      "Sélections jusqu’à la finale",
      "En ligne, en salle et jury",
      "Tablettes utilisables hors ligne",
      "Qualification et proclamation",
      "Assistance le jour J",
    ],
    action: "Choisir Professionnel",
    vedette: true,
  },
  {
    nom: "Sur mesure",
    description: "Pour les grandes organisations.",
    prix: "Sur devis",
    note: "selon votre besoin",
    points: [
      "Plusieurs événements par an",
      "Grille et pondération sur mesure",
      "Équipe technique sur place",
      "Page de vote à vos couleurs",
    ],
    action: "Nous contacter",
  },
];

export default function Accueil() {
  return (
    <div className={`${dmSans.className} ${c("page")}`}>
      <Navigation />

      <main>
        <section className={c("hero")}>
          <div className={c("hero-orb", "orb-one")} />
          <div className={c("hero-orb", "orb-two")} />
          <div className={c("hero-copy")}>
            <div className={c("pill")}>
              <span className={c("pill-dot")} /> Concours, sélections, finales
            </div>
            <h1 className={c("display")}>
              Chaque voix compte.
              <br />
              <span>Chaque talent se révèle.</span>
            </h1>
            <p className={c("hero-text")}>
              La plateforme tout-en-un pour vos concours : vote du public en ligne, vote en salle et note du
              jury, réunis dans un seul classement calculé en direct.
            </p>
            <div className={c("hero-actions")}>
              <Link href="/inscription" className={c("button", "button-primary")}>
                Organiser mon concours <Icone nom="fleche" taille={17} />
              </Link>
              <a href="#fonctionnement" className={c("button", "button-secondary")}>
                <span className={c("play-circle")}><Icone nom="lecture" taille={13} /></span> Voir comment ça marche
              </a>
            </div>
            <div className={c("reassurance")}>
              <span><Icone nom="coche" taille={15} /> Sans installation</span>
              <span><Icone nom="coche" taille={15} /> Wave, Orange Money, MTN</span>
              <span><Icone nom="coche" taille={15} /> Accompagnement Inovyx Tech</span>
            </div>
          </div>
          <div className={c("dashboard-stage")}>
            <div className={c("floating-toast")} aria-hidden="true">
              <span className={c("toast-icon")}><Icone nom="coche" taille={16} /></span>
              <div>
                <strong>Paiement confirmé</strong>
                <small>+20 voix pour le candidat A</small>
              </div>
            </div>
            <Apercu />
          </div>
        </section>

        <section className={c("trust")}>
          <p>Ils organisent leurs concours avec DIGITALYX-VOTE</p>
          <div className={c("logos")}>
            <span>Kabowd Production</span>
            <span className={c("logo-serif")}>Talent Traiteur</span>
          </div>
        </section>

        <section className={c("feature-section")} id="solution">
          <div className={c("section-heading")}>
            <div className={c("eyebrow", "blue-text")}>UNE SEULE PLATEFORME</div>
            <h2 className={c("section-title")}>
              Du premier candidat
              <br />
              au vainqueur.
            </h2>
            <p>DIGITALYX-VOTE vous accompagne à chaque étape de votre concours, sans alourdir votre organisation.</p>
          </div>
          <div className={c("feature-grid")}>
            {ATOUTS.map((atout, index) => (
              <article className={c("feature-card")} key={atout.titre}>
                <div className={c("feature-number")}>0{index + 1}</div>
                <div className={c("feature-icon")}><Icone nom={atout.icone} taille={23} /></div>
                <h3 className={c("feature-title")}>{atout.titre}</h3>
                <p>{atout.texte}</p>
                <a href="#fonctionnement" className={c("en-savoir")}>
                  En savoir plus <Icone nom="fleche" taille={15} />
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className={c("security-section")} id="securite">
          <div className={c("security-card")}>
            <div className={c("security-visual")} aria-hidden="true">
              <div className={c("rings", "ring-one")} />
              <div className={c("rings", "ring-two")} />
              <div className={c("rings", "ring-three")} />
              <div className={c("shield-center")}><Icone nom="bouclier" taille={38} /></div>
              <span className={c("secure-chip", "chip-top")}><Icone nom="cadenas" taille={14} /> Paiements vérifiés</span>
              <span className={c("secure-chip", "chip-bottom")}><Icone nom="coche" taille={14} /> Votes horodatés</span>
            </div>
            <div className={c("security-copy")}>
              <div className={c("eyebrow", "light")}>LA CONFIANCE, PAR DESIGN</div>
              <h2 className={c("section-title", "light-title")}>
                Un résultat
                <br />
                que personne ne conteste.
              </h2>
              <p>
                Des règles de calcul connues d’avance, des votes qui ne se modifient pas et des paiements vérifiés
                avant d’être comptés : vous gardez le contrôle, du début à la proclamation.
              </p>
              <div className={c("security-list")}>
                <span><Icone nom="coche" taille={17} /> Une voix payée ne compte qu’une fois le paiement confirmé</span>
                <span><Icone nom="coche" taille={17} /> Chaque vote est horodaté et ne peut plus être modifié</span>
                <span><Icone nom="coche" taille={17} /> Chaque organisation ne voit que ses propres données</span>
              </div>
            </div>
          </div>
        </section>

        <section className={c("steps-section")} id="fonctionnement">
          <div className={c("section-heading")}>
            <div className={c("eyebrow", "blue-text")}>SIMPLE, VRAIMENT</div>
            <h2 className={c("section-title")}>Prêt à voter en trois étapes.</h2>
          </div>
          <div className={c("steps")}>
            <div className={c("step")}>
              <span>1</span>
              <strong>Configurez</strong>
              <p>Créez votre événement, vos sélections, vos candidats et votre grille de notation.</p>
            </div>
            <div className={c("step-line")} />
            <div className={c("step")}>
              <span>2</span>
              <strong>Ouvrez le vote</strong>
              <p>Partagez le lien de vote au public et installez les tablettes en salle.</p>
            </div>
            <div className={c("step-line")} />
            <div className={c("step")}>
              <span>3</span>
              <strong>Proclamez</strong>
              <p>Suivez le classement en direct, validez les qualifiés et projetez les résultats.</p>
            </div>
          </div>
        </section>

        <section className={c("pricing-section")} id="tarifs">
          <div className={c("section-heading")}>
            <div className={c("eyebrow", "blue-text")}>DES TARIFS TRANSPARENTS</div>
            <h2 className={c("section-title")}>Une formule pour chaque concours.</h2>
            <p>Choisissez l’accompagnement adapté à votre événement. Chaque formule inclut une plateforme prête à l’emploi.</p>
          </div>
          <div className={c("pricing-grid")}>
            {FORMULES.map((formule) => (
              <article className={`${c("pricing-card")} ${formule.vedette ? c("featured") : ""}`} key={formule.nom}>
                {formule.vedette ? <div className={c("popular-badge")}>Le plus choisi</div> : null}
                <h3 className={c("plan-name")}>{formule.nom}</h3>
                <p className={c("plan-description")}>{formule.description}</p>
                <div className={c("plan-price")}>
                  <strong>{formule.prix}</strong>
                  {formule.devise ? <span>{formule.devise}</span> : null}
                </div>
                <div className={c("plan-note")}>{formule.note}</div>
                <div className={c("plan-features")}>
                  {formule.points.map((point) => (
                    <span key={point}><Icone nom="coche" taille={17} /> {point}</span>
                  ))}
                </div>
                <Link
                  href="/inscription"
                  className={c("button", formule.vedette ? "button-secondary" : "button-primary")}
                >
                  {formule.action}
                </Link>
              </article>
            ))}
          </div>
          <p className={c("pricing-footnote")}>
            Besoin d’un format particulier ? Nous construisons une solution adaptée à votre règlement et à vos
            contraintes.
          </p>
        </section>

        <section className={c("cta-section")} id="contact">
          <div className={c("cta-card")}>
            <div className={c("cta-shape", "shape-left")} />
            <div className={c("cta-shape", "shape-right")} />
            <div className={c("eyebrow", "light")}>VOTRE PROCHAIN CONCOURS COMMENCE ICI</div>
            <h2 className={c("cta-title")}>
              Prêt à lancer
              <br />
              votre concours ?
            </h2>
            <p>Créez le compte de votre organisation et paramétrez votre premier événement.</p>
            <div className={c("cta-actions")}>
              <Link href="/inscription" className={c("button", "button-primary")}>
                Créer mon compte <Icone nom="fleche" taille={17} />
              </Link>
              <span>Votre espace est prêt en une minute.</span>
            </div>
          </div>
        </section>
      </main>

      <footer className={c("pied")}>
        <Marque />
        <p>La plateforme de vote de vos concours.</p>
        <div className={c("footer-links")}>
          <Link href="/cgu">Conditions générales</Link>
          <Link href="/voter">Voter</Link>
          <Link href="/connexion">Se connecter</Link>
        </div>
        <small>© 2026 DIGITALYX-VOTE · Inovyx Tech. Tous droits réservés.</small>
      </footer>
    </div>
  );
}
