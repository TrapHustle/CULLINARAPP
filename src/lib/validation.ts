import { z } from "zod";
import { RAW_UNSCORED } from "./scoring";

/**
 * Plafond absolu d'une note brute, toutes échelles confondues.
 *
 * `Session.scoreMax` (réglable depuis Configuration → Vote, 5 par défaut) est
 * la vraie borne — mais elle vit en base, pas dans un schéma zod figé au
 * démarrage. Celui-ci n'est qu'un garde-fou grossier avant la vérification
 * dynamique faite dans la route de synchronisation ; un nombre au-delà n'est
 * jamais une note valide, quel que soit le réglage.
 */
const RAW_ABSOLUTE_MAX = 20;

export const tableTypeSchema = z.enum(["LAMBDA", "SPECIAL"]);

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

/**
 * Chemin d'une image servie par ce serveur, de la forme `/api/images/<id>`.
 *
 * Une URL externe est refusée, et ce n'est pas une restriction arbitraire : en
 * réseau local la salle n'a pas d'internet, une photo hébergée ailleurs
 * resterait blanche sur toutes les tablettes. Les octets doivent vivre dans
 * notre base.
 */
export const imagePathSchema = z
  .string()
  .regex(
    /^\/api\/images\/[A-Za-z0-9_-]+$/,
    "La photo doit être une image envoyée à ce serveur, pas une adresse externe.",
  );

/** Types d'images acceptés à l'envoi. */
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Taille maximale d'une photo, en octets. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export const candidateSchema = z.object({
  name: z.string().min(1, "Le nom est obligatoire"),
  photoUrl: imagePathSchema.nullish().or(z.literal("")),
  order: z.coerce.number().int().min(0).default(0),
});

export const candidatePhotoSchema = z.object({
  id: z.string().min(1),
});

export const tableSchema = z.object({
  name: z.string().min(1, "Le nom est obligatoire"),
  type: tableTypeSchema.default("LAMBDA"),
  expectedJurors: z.coerce.number().int().min(1, "Au moins un juré par table").default(1),
});

export const criterionSchema = z.object({
  name: z.string().min(1, "Le nom est obligatoire"),
  order: z.coerce.number().int().min(0).default(0),
});

/**
 * Modification d'un élément existant : mêmes règles que la création, plus
 * l'identifiant de la ligne visée.
 *
 * On réutilise volontairement les schémas de création plutôt que d'en écrire de
 * nouveaux : une règle de validation qui évolue doit s'appliquer aux deux
 * chemins, sans quoi on pourrait contourner une contrainte en modifiant plutôt
 * qu'en créant.
 */
const withId = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  schema.extend({ id: z.string().min(1) });

export const candidateUpdateSchema = withId(candidateSchema);
export const tableUpdateSchema = withId(tableSchema);
export const criterionUpdateSchema = withId(criterionSchema);

/** Dévalidation d'une table pour un candidat (§5, étape 5 — correction d'erreur). */
export const devalidateSchema = z.object({
  tableId: z.string().min(1),
  candidateId: z.string().min(1),
});

/**
 * Purge à distance des bases locales des tablettes.
 *
 * N'efface rien sur le serveur : change seulement le numéro de génération, que
 * chaque tablette compare au sien. Le mot diffère des trois autres pour qu'on
 * ne le saisisse pas par automatisme dans le mauvais champ.
 */
export const PURGE_TABLETS_CONFIRMATION = "PURGER";

/**
 * Champ de confirmation d'un effacement.
 *
 * La comparaison ignore les espaces autour et la casse : le garde-fou est de
 * **recopier le mot**, pas de retrouver la touche Maj. Un « purger » saisi au
 * clavier minuscule était refusé sans que rien ne bouge à l'écran, ce qui se
 * lit comme une panne du bouton plutôt que comme un refus.
 */
function confirmationField(word: string) {
  return z
    .string()
    .transform((value) => value.trim().toUpperCase())
    .refine((value) => value === word, {
      message: `Saisissez « ${word} » pour confirmer.`,
    });
}

export const purgeTabletsSchema = z.object({
  confirmation: confirmationField(PURGE_TABLETS_CONFIRMATION),
});

/**
 * Libération de toutes les tables assignées.
 *
 * Le plus doux des trois effacements : il ne touche à aucune donnée, il rend
 * seulement les tables à la salle pour que chaque tablette rechoisisse la
 * sienne. Il exige quand même un mot, parce qu'il déconnecte en un clic toutes
 * les tablettes en cours de saisie.
 */
export const RELEASE_TABLES_CONFIRMATION = "LIBERER";

export const releaseTablesSchema = z.object({
  confirmation: confirmationField(RELEASE_TABLES_CONFIRMATION),
});

/**
 * Remise à zéro des votes. Le mot de confirmation est exigé à la saisie : la
 * page ne peut pas être déclenchée par un clic isolé, ni par un rechargement.
 */
export const RESET_CONFIRMATION = "EFFACER";

export const resetVotesSchema = z.object({
  confirmation: confirmationField(RESET_CONFIRMATION),
});

/**
 * Réinitialisation complète du bureau de vote — votes et configuration.
 *
 * Le mot diffère volontairement de celui de la remise à zéro : les deux blocs
 * se ressemblent à l'écran, et recopier machinalement le même mot dans le
 * mauvais champ effacerait une configuration qu'on voulait garder.
 */
export const RESET_EVENT_CONFIRMATION = "REINITIALISER";

export const resetEventSchema = z.object({
  confirmation: confirmationField(RESET_EVENT_CONFIRMATION),
});

export const sessionUpdateSchema = z.object({
  activeCandidateId: z.string().nullish(),
  votingOpen: z.boolean().optional(),
  timerEnabled: z.boolean().optional(),
  timerSeconds: z.coerce.number().int().min(5).max(600).optional(),
});

/**
 * Réglages du calcul des votes (Configuration → Vote) : le poids d'un vote
 * selon la table d'où il vient, et les bornes de la note qu'un juré peut
 * saisir sur un critère.
 *
 * `scoreMax` doit rester strictement supérieur à `scoreMin` — Zod ne peut pas
 * l'exprimer entre deux champs indépendants, d'où le `.refine` plutôt qu'une
 * seconde borne sur chaque champ pris isolément.
 */
export const voteSettingsSchema = z
  .object({
    weightPublic: z.coerce.number().min(0).max(10),
    weightSpecial: z.coerce.number().min(0).max(10),
    scoreMin: z.coerce.number().int().min(0).max(RAW_ABSOLUTE_MAX - 1),
    scoreMax: z.coerce.number().int().min(1).max(RAW_ABSOLUTE_MAX),
  })
  .refine((data) => data.scoreMax > data.scoreMin, {
    message: "La note maximale doit être supérieure à la note minimale.",
    path: ["scoreMax"],
  });

/**
 * Un vote tel qu'envoyé par la tablette.
 *
 * La tablette ne transmet que des **notes brutes** : ni total, ni moyenne, ni
 * poids (§0.3). `rawValue` accepte 0, valeur enregistrée pour un critère laissé
 * vide à l'expiration du chronomètre (§11).
 */
export const incomingVoteSchema = z.object({
  id: z.string().uuid("L'identifiant de vote doit être un UUID généré par la tablette"),
  tableId: z.string().min(1),
  candidateId: z.string().min(1),
  jurorIndex: z.coerce.number().int().min(1),
  createdAt: z.coerce.date(),
  scores: z
    .array(
      z.object({
        criterionId: z.string().min(1),
        rawValue: z.coerce.number().int().min(RAW_UNSCORED).max(RAW_ABSOLUTE_MAX),
      }),
    )
    .min(1, "Un vote doit porter au moins un critère"),
});

export const syncVotesSchema = z.object({
  votes: z.array(incomingVoteSchema).max(500, "Trop de votes dans un seul lot"),
});

export const validateTableSchema = z.object({
  candidateId: z.string().min(1),
});

/**
 * Réservation d'une table par une tablette.
 *
 * `deviceId` est tiré par la tablette à son premier lancement et conservé
 * localement. Il n'identifie personne : il ne sert qu'à distinguer deux
 * tablettes entre elles, et à rendre sa table à celle qui redémarre.
 */
export const claimTableSchema = z.object({
  deviceId: z.string().min(8).max(64),
});

export type IncomingVote = z.infer<typeof incomingVoteSchema>;
