-- Modèle SaaS multi-organisations (docs/modele-de-donnees.md).
-- 1) Nouvelles tables : rien n'est supprimé ni modifié dans les anciennes, sauf
--    une colonne ajoutée à Image. 2) Reprise des données existantes.

-- AlterTable
ALTER TABLE "Image" ADD COLUMN     "organisationId" TEXT;

-- CreateTable
CREATE TABLE "Organisation" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "logoUrl" TEXT,
    "paiementConfig" JSONB,
    "partOrganisateur" DOUBLE PRECISION NOT NULL DEFAULT 90,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Utilisateur" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "motDePasseHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ORGANISATEUR',
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evenement" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "edition" INTEGER,
    "sousTitre" TEXT,
    "date" TIMESTAMP(3),
    "afficheUrl" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evenement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Selection" (
    "id" TEXT NOT NULL,
    "evenementId" TEXT NOT NULL,
    "rang" INTEGER NOT NULL DEFAULT 1,
    "libelle" TEXT NOT NULL,
    "lieu" TEXT,
    "debut" TIMESTAMP(3),
    "fin" TIMESTAMP(3),
    "etat" TEXT NOT NULL DEFAULT 'PREPAREE',
    "nbQualifies" INTEGER NOT NULL DEFAULT 0,
    "slug" TEXT NOT NULL,
    "voteEnLigneOuvert" BOOLEAN NOT NULL DEFAULT false,
    "prixVote" INTEGER NOT NULL DEFAULT 200,
    "voixGratuite" BOOLEAN NOT NULL DEFAULT false,
    "modeEnLigne" TEXT NOT NULL DEFAULT 'A',
    "compteursVisibles" BOOLEAN NOT NULL DEFAULT true,
    "stylePage" TEXT NOT NULL DEFAULT 'MENU',
    "moyensPaiement" TEXT[] DEFAULT ARRAY['WAVE', 'ORANGE_MONEY', 'MTN']::TEXT[],
    "voteSalleOuvert" BOOLEAN NOT NULL DEFAULT false,
    "participationActiveId" TEXT,
    "chronoActif" BOOLEAN NOT NULL DEFAULT true,
    "chronoSecondes" INTEGER NOT NULL DEFAULT 30,
    "noteMin" INTEGER NOT NULL DEFAULT 1,
    "noteMax" INTEGER NOT NULL DEFAULT 5,
    "generationDonnees" TEXT NOT NULL DEFAULT '1',
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Selection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Palier" (
    "id" TEXT NOT NULL,
    "selectionId" TEXT NOT NULL,
    "voixMax" INTEGER NOT NULL,
    "points" DOUBLE PRECISION NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Palier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TypeVoteModele" (
    "id" TEXT NOT NULL,
    "evenementId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "payant" BOOLEAN NOT NULL DEFAULT false,
    "avecCriteres" BOOLEAN NOT NULL DEFAULT true,
    "part" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deroule" TEXT NOT NULL DEFAULT 'BY_CANDIDATE',
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TypeVoteModele_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CritereModele" (
    "id" TEXT NOT NULL,
    "typeVoteId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "bareme" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "CritereModele_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TypeVote" (
    "id" TEXT NOT NULL,
    "selectionId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "payant" BOOLEAN NOT NULL DEFAULT false,
    "avecCriteres" BOOLEAN NOT NULL DEFAULT true,
    "part" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deroule" TEXT NOT NULL DEFAULT 'BY_CANDIDATE',
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TypeVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Critere" (
    "id" TEXT NOT NULL,
    "typeVoteId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "bareme" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "Critere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidat" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "ville" TEXT,
    "photoUrl" TEXT,

    CONSTRAINT "Candidat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participation" (
    "id" TEXT NOT NULL,
    "selectionId" TEXT NOT NULL,
    "candidatId" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "ouverteLe" TIMESTAMP(3),
    "qualifie" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Participation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suffrage" (
    "id" TEXT NOT NULL,
    "participationId" TEXT NOT NULL,
    "typeVoteId" TEXT NOT NULL,
    "poids" INTEGER NOT NULL DEFAULT 1,
    "origine" TEXT NOT NULL,
    "tableId" TEXT,
    "jureIndex" INTEGER,
    "paiementId" TEXT,
    "votantId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synchroLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "annuleLe" TIMESTAMP(3),

    CONSTRAINT "Suffrage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Valeur" (
    "id" TEXT NOT NULL,
    "suffrageId" TEXT NOT NULL,
    "critereId" TEXT NOT NULL,
    "valeur" INTEGER NOT NULL,

    CONSTRAINT "Valeur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Votant" (
    "id" TEXT NOT NULL,
    "selectionId" TEXT NOT NULL,
    "identifiant" TEXT NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Votant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paiement" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "selectionId" TEXT,
    "participationId" TEXT,
    "reference" TEXT NOT NULL,
    "candidatNom" TEXT NOT NULL,
    "voix" INTEGER NOT NULL,
    "prixUnitaire" INTEGER NOT NULL,
    "montant" INTEGER NOT NULL,
    "moyen" TEXT NOT NULL,
    "telephone" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'PENDING',
    "simule" BOOLEAN NOT NULL DEFAULT false,
    "refPrestataire" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmeLe" TIMESTAMP(3),

    CONSTRAINT "Paiement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableJury" (
    "id" TEXT NOT NULL,
    "selectionId" TEXT NOT NULL,
    "typeVoteId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "juresAttendus" INTEGER NOT NULL DEFAULT 1,
    "deviceId" TEXT,
    "assigneeLe" TIMESTAMP(3),

    CONSTRAINT "TableJury_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationTable" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "participationId" TEXT NOT NULL,
    "valideeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidationTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchiveSelection" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "selectionId" TEXT,
    "nom" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "clotureLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "ArchiveSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandeRetrait" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "montant" INTEGER NOT NULL,
    "telephone" TEXT NOT NULL,
    "moyen" TEXT NOT NULL,
    "note" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'PENDING',
    "noteAdmin" TEXT,
    "notifieLe" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "traiteeLe" TIMESTAMP(3),

    CONSTRAINT "DemandeRetrait_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_email_key" ON "Utilisateur"("email");

-- CreateIndex
CREATE INDEX "Utilisateur_organisationId_idx" ON "Utilisateur"("organisationId");

-- CreateIndex
CREATE INDEX "Evenement_organisationId_idx" ON "Evenement"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "Selection_slug_key" ON "Selection"("slug");

-- CreateIndex
CREATE INDEX "Selection_evenementId_rang_idx" ON "Selection"("evenementId", "rang");

-- CreateIndex
CREATE INDEX "Palier_selectionId_idx" ON "Palier"("selectionId");

-- CreateIndex
CREATE INDEX "TypeVoteModele_evenementId_idx" ON "TypeVoteModele"("evenementId");

-- CreateIndex
CREATE INDEX "CritereModele_typeVoteId_idx" ON "CritereModele"("typeVoteId");

-- CreateIndex
CREATE INDEX "TypeVote_selectionId_idx" ON "TypeVote"("selectionId");

-- CreateIndex
CREATE INDEX "Critere_typeVoteId_idx" ON "Critere"("typeVoteId");

-- CreateIndex
CREATE INDEX "Candidat_organisationId_idx" ON "Candidat"("organisationId");

-- CreateIndex
CREATE INDEX "Participation_selectionId_ordre_idx" ON "Participation"("selectionId", "ordre");

-- CreateIndex
CREATE UNIQUE INDEX "Participation_selectionId_candidatId_key" ON "Participation"("selectionId", "candidatId");

-- CreateIndex
CREATE UNIQUE INDEX "Suffrage_paiementId_key" ON "Suffrage"("paiementId");

-- CreateIndex
CREATE UNIQUE INDEX "Suffrage_votantId_key" ON "Suffrage"("votantId");

-- CreateIndex
CREATE INDEX "Suffrage_participationId_typeVoteId_idx" ON "Suffrage"("participationId", "typeVoteId");

-- CreateIndex
CREATE UNIQUE INDEX "Suffrage_tableId_participationId_jureIndex_key" ON "Suffrage"("tableId", "participationId", "jureIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Valeur_suffrageId_critereId_key" ON "Valeur"("suffrageId", "critereId");

-- CreateIndex
CREATE UNIQUE INDEX "Votant_selectionId_identifiant_key" ON "Votant"("selectionId", "identifiant");

-- CreateIndex
CREATE UNIQUE INDEX "Paiement_reference_key" ON "Paiement"("reference");

-- CreateIndex
CREATE INDEX "Paiement_participationId_statut_idx" ON "Paiement"("participationId", "statut");

-- CreateIndex
CREATE INDEX "Paiement_creeLe_idx" ON "Paiement"("creeLe");

-- CreateIndex
CREATE INDEX "Paiement_telephone_creeLe_idx" ON "Paiement"("telephone", "creeLe");

-- CreateIndex
CREATE INDEX "TableJury_selectionId_idx" ON "TableJury"("selectionId");

-- CreateIndex
CREATE UNIQUE INDEX "ValidationTable_tableId_participationId_key" ON "ValidationTable"("tableId", "participationId");

-- CreateIndex
CREATE INDEX "ArchiveSelection_organisationId_clotureLe_idx" ON "ArchiveSelection"("organisationId", "clotureLe");

-- CreateIndex
CREATE INDEX "DemandeRetrait_organisationId_statut_creeLe_idx" ON "DemandeRetrait"("organisationId", "statut", "creeLe");

-- CreateIndex
CREATE INDEX "Image_organisationId_idx" ON "Image"("organisationId");

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Utilisateur" ADD CONSTRAINT "Utilisateur_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evenement" ADD CONSTRAINT "Evenement_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Selection" ADD CONSTRAINT "Selection_evenementId_fkey" FOREIGN KEY ("evenementId") REFERENCES "Evenement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Palier" ADD CONSTRAINT "Palier_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "Selection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TypeVoteModele" ADD CONSTRAINT "TypeVoteModele_evenementId_fkey" FOREIGN KEY ("evenementId") REFERENCES "Evenement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CritereModele" ADD CONSTRAINT "CritereModele_typeVoteId_fkey" FOREIGN KEY ("typeVoteId") REFERENCES "TypeVoteModele"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TypeVote" ADD CONSTRAINT "TypeVote_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "Selection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Critere" ADD CONSTRAINT "Critere_typeVoteId_fkey" FOREIGN KEY ("typeVoteId") REFERENCES "TypeVote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidat" ADD CONSTRAINT "Candidat_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participation" ADD CONSTRAINT "Participation_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "Selection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participation" ADD CONSTRAINT "Participation_candidatId_fkey" FOREIGN KEY ("candidatId") REFERENCES "Candidat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suffrage" ADD CONSTRAINT "Suffrage_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "Participation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suffrage" ADD CONSTRAINT "Suffrage_typeVoteId_fkey" FOREIGN KEY ("typeVoteId") REFERENCES "TypeVote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suffrage" ADD CONSTRAINT "Suffrage_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "TableJury"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suffrage" ADD CONSTRAINT "Suffrage_paiementId_fkey" FOREIGN KEY ("paiementId") REFERENCES "Paiement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suffrage" ADD CONSTRAINT "Suffrage_votantId_fkey" FOREIGN KEY ("votantId") REFERENCES "Votant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Valeur" ADD CONSTRAINT "Valeur_suffrageId_fkey" FOREIGN KEY ("suffrageId") REFERENCES "Suffrage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Valeur" ADD CONSTRAINT "Valeur_critereId_fkey" FOREIGN KEY ("critereId") REFERENCES "Critere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Votant" ADD CONSTRAINT "Votant_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "Selection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "Selection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "Participation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableJury" ADD CONSTRAINT "TableJury_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "Selection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableJury" ADD CONSTRAINT "TableJury_typeVoteId_fkey" FOREIGN KEY ("typeVoteId") REFERENCES "TypeVote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationTable" ADD CONSTRAINT "ValidationTable_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "TableJury"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationTable" ADD CONSTRAINT "ValidationTable_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "Participation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchiveSelection" ADD CONSTRAINT "ArchiveSelection_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchiveSelection" ADD CONSTRAINT "ArchiveSelection_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "Selection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeRetrait" ADD CONSTRAINT "DemandeRetrait_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Reprise des données existantes dans le modèle SaaS
-- ============================================================================
--
-- Rien n'est supprimé ni modifié dans les anciennes tables : on copie. Les
-- anciennes tables restent en place jusqu'à la validation de la nouvelle
-- version en production.
--
-- Une base neuve (aucune donnée) n'obtient rien : on ne crée pas d'organisation
-- « Kabowd Production » fantôme chez un futur client.
--
-- Identifiants : ceux des anciennes lignes sont conservés quand une tablette
-- peut les connaître (votes, tables) ou quand ils servent de trace (paiements,
-- retraits, archives). Les lignes créées par la migration ont des
-- identifiants fixes et lisibles (`org_kabowd`, `sel_talent_traiteur`…).

DO $$
BEGIN
  IF NOT (
    EXISTS (SELECT 1 FROM "Session")
    OR EXISTS (SELECT 1 FROM "Candidate")
    OR EXISTS (SELECT 1 FROM "PublicVotePayment")
    OR EXISTS (SELECT 1 FROM "WithdrawalRequest")
    OR EXISTS (SELECT 1 FROM "VoteEventArchive")
  ) THEN
    RETURN;
  END IF;

  -- Organisation ----------------------------------------------------------
  INSERT INTO "Organisation" ("id", "nom", "partOrganisateur")
  VALUES ('org_kabowd', 'Kabowd Production', 90);

  UPDATE "Image" SET "organisationId" = 'org_kabowd' WHERE "organisationId" IS NULL;

  -- Événement et sélection (depuis la ligne Session) ------------------------
  -- La jointure à gauche sur une ligne fixe garde des valeurs par défaut
  -- quand la ligne Session n'existe pas encore.
  INSERT INTO "Evenement" ("id", "organisationId", "nom", "sousTitre", "date", "afficheUrl")
  SELECT 'evt_talent_traiteur', 'org_kabowd',
         COALESCE(NULLIF(s."eventName", ''), 'Talent Traiteur'),
         s."publicVoteTagline", s."eventDate", s."eventPhotoUrl"
  FROM (SELECT 1) AS un
  LEFT JOIN "Session" s ON s."id" = 'singleton';

  INSERT INTO "Selection" (
    "id", "evenementId", "rang", "libelle", "debut", "fin", "etat", "slug",
    "voteEnLigneOuvert", "prixVote", "voixGratuite", "modeEnLigne",
    "compteursVisibles", "stylePage", "moyensPaiement",
    "voteSalleOuvert", "participationActiveId", "chronoActif", "chronoSecondes",
    "noteMin", "noteMax", "generationDonnees"
  )
  SELECT 'sel_talent_traiteur', 'evt_talent_traiteur', 1,
         COALESCE(NULLIF(s."publicVoteSubtitle", ''), 'Sélection 1'),
         s."eventDate", s."publicVoteClosesAt",
         CASE WHEN COALESCE(s."votingOpen", false) OR COALESCE(s."publicVoteOpen", false)
              THEN 'OUVERTE' ELSE 'PREPAREE' END,
         'talent-traiteur-vote-en-ligne',
         COALESCE(s."publicVoteOpen", false),
         COALESCE(s."publicVotePrice", 200),
         false,
         -- L'ancien moteur calcule la part de voix relative : c'est le mode A.
         'A',
         COALESCE(s."publicVoteShowCounts", true),
         COALESCE(s."publicVoteStyle", 'MENU'),
         COALESCE(s."publicVoteMethods", ARRAY['WAVE', 'ORANGE_MONEY', 'MTN']),
         COALESCE(s."votingOpen", false),
         CASE WHEN s."activeCandidateId" IS NOT NULL
                   AND EXISTS (SELECT 1 FROM "Candidate" c WHERE c."id" = s."activeCandidateId")
              THEN 'p_' || s."activeCandidateId" END,
         COALESCE(s."timerEnabled", true),
         COALESCE(s."timerSeconds", 30),
         COALESCE(s."scoreMin", 1),
         COALESCE(s."scoreMax", 5),
         COALESCE(s."dataGeneration", '1')
  FROM (SELECT 1) AS un
  LEFT JOIN "Session" s ON s."id" = 'singleton';

  -- Types de vote : les trois catégories de l'ancien moteur -----------------
  INSERT INTO "TypeVote" ("id", "selectionId", "libelle", "canal", "payant", "avecCriteres", "part", "deroule", "ordre")
  SELECT 'tv_jury', 'sel_talent_traiteur', 'Jury spécial', 'SALLE', false, true,
         COALESCE(s."shareSpecial", 60), COALESCE(s."voteModeSpecial", 'BY_CANDIDATE'), 1
  FROM (SELECT 1) AS un LEFT JOIN "Session" s ON s."id" = 'singleton'
  UNION ALL
  SELECT 'tv_salle', 'sel_talent_traiteur', 'Public en salle', 'SALLE', false, true,
         COALESCE(s."sharePublic", 20), COALESCE(s."voteModePublic", 'BY_CANDIDATE'), 2
  FROM (SELECT 1) AS un LEFT JOIN "Session" s ON s."id" = 'singleton'
  UNION ALL
  SELECT 'tv_en_ligne', 'sel_talent_traiteur', 'Vote en ligne', 'EN_LIGNE', true, false,
         COALESCE(s."shareOnline", 20), 'BY_CANDIDATE', 3
  FROM (SELECT 1) AS un LEFT JOIN "Session" s ON s."id" = 'singleton';

  -- Le jury et la salle partageaient la même grille : elle est copiée sur
  -- chacun des deux types. Le suffixe dit à quel type appartient la copie.
  INSERT INTO "Critere" ("id", "typeVoteId", "libelle", "ordre", "bareme")
  SELECT c."id" || '_jury', 'tv_jury', c."name", c."order", c."maxPoints" FROM "Criterion" c
  UNION ALL
  SELECT c."id" || '_salle', 'tv_salle', c."name", c."order", c."maxPoints" FROM "Criterion" c;

  -- La même grille devient le modèle de l'événement (RG 3.1).
  INSERT INTO "TypeVoteModele" ("id", "evenementId", "libelle", "canal", "payant", "avecCriteres", "part", "deroule", "ordre")
  SELECT 'm_' || t."id", 'evt_talent_traiteur', t."libelle", t."canal", t."payant", t."avecCriteres", t."part", t."deroule", t."ordre"
  FROM "TypeVote" t WHERE t."selectionId" = 'sel_talent_traiteur';

  INSERT INTO "CritereModele" ("id", "typeVoteId", "libelle", "ordre", "bareme")
  SELECT 'm_' || c."id", 'm_' || c."typeVoteId", c."libelle", c."ordre", c."bareme"
  FROM "Critere" c JOIN "TypeVote" t ON t."id" = c."typeVoteId"
  WHERE t."selectionId" = 'sel_talent_traiteur';

  -- Candidats et participations ----------------------------------------------
  INSERT INTO "Candidat" ("id", "organisationId", "nom", "ville", "photoUrl")
  SELECT c."id", 'org_kabowd', c."name", c."city", c."photoUrl" FROM "Candidate" c;

  INSERT INTO "Participation" ("id", "selectionId", "candidatId", "ordre", "disponible", "ouverteLe")
  SELECT 'p_' || c."id", 'sel_talent_traiteur', c."id", c."order", true, c."openedAt" FROM "Candidate" c;

  -- Tables de jury --------------------------------------------------------------
  INSERT INTO "TableJury" ("id", "selectionId", "typeVoteId", "nom", "juresAttendus", "deviceId", "assigneeLe")
  SELECT t."id", 'sel_talent_traiteur',
         CASE WHEN t."type" = 'SPECIAL' THEN 'tv_jury' ELSE 'tv_salle' END,
         t."name", t."expectedJurors", t."assignedDeviceId", t."assignedAt"
  FROM "VotingTable" t;

  INSERT INTO "ValidationTable" ("id", "tableId", "participationId", "valideeLe")
  SELECT v."id", v."tableId", 'p_' || v."candidateId", v."validatedAt" FROM "TableValidation" v;

  -- Votes des tablettes : même identifiant, poids 1 -----------------------------
  INSERT INTO "Suffrage" ("id", "participationId", "typeVoteId", "poids", "origine", "tableId", "jureIndex", "creeLe", "synchroLe")
  SELECT v."id", 'p_' || v."candidateId",
         CASE WHEN t."type" = 'SPECIAL' THEN 'tv_jury' ELSE 'tv_salle' END,
         1, 'TABLETTE', v."tableId", v."jurorIndex", v."createdAt", v."syncedAt"
  FROM "Vote" v JOIN "VotingTable" t ON t."id" = v."tableId";

  INSERT INTO "Valeur" ("id", "suffrageId", "critereId", "valeur")
  SELECT s."id", s."voteId",
         s."criterionId" || CASE WHEN t."type" = 'SPECIAL' THEN '_jury' ELSE '_salle' END,
         s."rawValue"
  FROM "VoteScore" s
  JOIN "Vote" v ON v."id" = s."voteId"
  JOIN "VotingTable" t ON t."id" = v."tableId";

  -- Paiements, et une voix pondérée pour chaque paiement confirmé ----------------
  INSERT INTO "Paiement" (
    "id", "organisationId", "selectionId", "participationId", "reference", "candidatNom",
    "voix", "prixUnitaire", "montant", "moyen", "telephone", "statut", "simule",
    "refPrestataire", "creeLe", "confirmeLe"
  )
  SELECT p."id", 'org_kabowd', 'sel_talent_traiteur',
         CASE WHEN p."candidateId" IS NOT NULL THEN 'p_' || p."candidateId" END,
         p."reference", p."candidateName", p."votes", p."unitPrice", p."amount", p."method",
         p."phone", p."status", p."simulated", p."providerReference", p."createdAt", p."confirmedAt"
  FROM "PublicVotePayment" p;

  -- Comme l'ancien moteur : seul un paiement confirmé, encore rattaché à un
  -- candidat, porte des voix. Le paiement simulé garde sa marque sur la ligne
  -- PAIEMENT et reste hors des résultats officiels.
  INSERT INTO "Suffrage" ("id", "participationId", "typeVoteId", "poids", "origine", "paiementId", "creeLe", "synchroLe")
  SELECT 'pay_' || p."id", 'p_' || p."candidateId", 'tv_en_ligne', p."votes", 'PAIEMENT', p."id",
         COALESCE(p."confirmedAt", p."createdAt"), COALESCE(p."confirmedAt", p."createdAt")
  FROM "PublicVotePayment" p
  WHERE p."status" = 'CONFIRMED' AND p."candidateId" IS NOT NULL;

  -- Voix importées d'un scrutin externe : une ligne par candidat.
  INSERT INTO "Suffrage" ("id", "participationId", "typeVoteId", "poids", "origine")
  SELECT 'imp_' || c."id", 'p_' || c."id", 'tv_en_ligne', c."publicVoteCount", 'IMPORT'
  FROM "Candidate" c
  WHERE c."publicVoteCount" > 0;

  -- Archives et retraits ---------------------------------------------------------
  INSERT INTO "ArchiveSelection" ("id", "organisationId", "nom", "date", "clotureLe", "snapshot")
  SELECT a."id", 'org_kabowd', a."name", a."eventDate", a."closedAt", a."snapshot" FROM "VoteEventArchive" a;

  INSERT INTO "DemandeRetrait" (
    "id", "organisationId", "montant", "telephone", "moyen", "note", "statut",
    "noteAdmin", "notifieLe", "creeLe", "traiteeLe"
  )
  SELECT w."id", 'org_kabowd', w."amount", w."phone", w."method", w."note", w."status",
         w."adminNote", w."notifiedAt", w."createdAt", w."processedAt"
  FROM "WithdrawalRequest" w;
END
$$;
