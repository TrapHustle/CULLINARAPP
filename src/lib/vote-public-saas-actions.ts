"use server";

import { revalidatePath } from "next/cache";
import { demanderPaiement, etatPaiement, voterGratuit, type Recu, type ResultatPaiement, type ResultatVote } from "./vote-public-saas";

/**
 * Actions de la page publique `/v/<slug>`. Sans authentification : c'est le
 * public. Tout est revérifié côté serveur (vote ouvert, candidat disponible,
 * moyen proposé, quantité bornée, numéro valide) et le montant recalculé.
 */

export async function voterGratuitAction(slug: string, participationId: string, telephone: string): Promise<ResultatVote> {
  const r = await voterGratuit(String(slug), String(participationId), String(telephone ?? ""));
  if (r.ok) revalidatePath(`/v/${slug}`);
  return r;
}

export async function payerAction(input: {
  slug: string;
  participationId: string;
  voix: number;
  moyen: string;
  telephone: string;
}): Promise<ResultatPaiement> {
  const r = await demanderPaiement({
    slug: String(input.slug),
    participationId: String(input.participationId),
    voix: Number(input.voix),
    moyen: String(input.moyen),
    telephone: String(input.telephone ?? ""),
  });
  if (r.ok && r.type === "confirme") revalidatePath(`/v/${input.slug}`);
  return r;
}

export async function etatPaiementAction(reference: string): Promise<Recu | null> {
  return etatPaiement(String(reference));
}
