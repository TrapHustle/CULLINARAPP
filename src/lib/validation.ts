import { z } from "zod";
import { RAW_MAX, RAW_UNSCORED } from "./scoring";

export const tableTypeSchema = z.enum(["LAMBDA", "SPECIAL"]);

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const candidateSchema = z.object({
  name: z.string().min(1, "Le nom est obligatoire"),
  photoUrl: z.string().url().nullish().or(z.literal("")),
  order: z.coerce.number().int().min(0).default(0),
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

export type IncomingVote = z.infer<typeof incomingVoteSchema>;
