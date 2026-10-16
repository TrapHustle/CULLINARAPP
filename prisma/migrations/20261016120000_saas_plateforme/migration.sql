-- SaaS : une organisation peut être suspendue par la plateforme (super-admin).
-- Additive : les organisations existantes restent actives.
ALTER TABLE "Organisation" ADD COLUMN "actif" BOOLEAN NOT NULL DEFAULT true;
