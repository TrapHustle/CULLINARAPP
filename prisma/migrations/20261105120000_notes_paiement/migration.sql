-- Vote en ligne payant noté sur critères : la note choisie par le votant
-- attend la confirmation du paiement, qui crée alors le vote et ses valeurs.
-- Colonne facultative : les paiements existants (voix) n'en ont pas.
ALTER TABLE "Paiement" ADD COLUMN "notes" JSONB;
