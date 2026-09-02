import { z } from "zod";
import { RAW_MAX, RAW_UNSCORED } from "./scoring";

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

export const purgeTabletsSchema = z.object({
  confirmation: z.string().refine((value) => value === PURGE_TABLETS_CONFIRMATION, {
    message: `Saisissez « ${PURGE_TABLETS_CONFIRMATION} » pour confirmer.`,
  }),
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
  confirmation: z.string().refine((value) => value === RELEASE_TABLES_CONFIRMATION, {
    message: `Saisissez « ${RELEASE_TABLES_CONFIRMATION} » pour confirmer.`,
  }),
});

/**
 * Remise à zéro des votes. Le mot de confirmation est exigé à la saisie : la
 * page ne peut pas être déclenchée par un clic isolé, ni par un rechargement.
 */
export const RESET_CONFIRMATION = "EFFACER";

export const resetVotesSchema = z.object({
  confirmation: z.string().refine((value) => value === RESET_CONFIRMATION, {
    message: `Saisissez « ${RESET_CONFIRMATION} » pour confirmer.`,
  }),
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
  confirmation: z.string().refine((value) => value === RESET_EVENT_CONFIRMATION, {
    message: `Saisissez « ${RESET_EVENT_CONFIRMATION} » pour confirmer.`,
  }),
});

export const sessionUpdateSchema = z.object({
  activeCandidateId: z.string().nullish(),
  votingOpen: z.boolean().optional(),
  timerEnabled: z.boolean().optional(),
  timerSeconds: z.coerce.number().int().min(5).max(600).optional(),
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
        rawValue: z.coerce.number().int().min(RAW_UNSCORED).max(RAW_MAX),
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
