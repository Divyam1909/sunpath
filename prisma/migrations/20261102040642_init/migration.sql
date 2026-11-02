-- CreateEnum
CREATE TYPE "Role" AS ENUM ('HOMEOWNER', 'SALES', 'ADMIN');

-- CreateEnum
CREATE TYPE "Ownership" AS ENUM ('OWNER', 'TENANT');

-- CreateEnum
CREATE TYPE "RoofType" AS ENUM ('RCC_FLAT', 'METAL_SHEET', 'TILED', 'OTHER');

-- CreateEnum
CREATE TYPE "Shading" AS ENUM ('NONE', 'PARTIAL', 'HEAVY');

-- CreateEnum
CREATE TYPE "Score" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "NextAction" AS ENUM ('SURVEY_VISIT', 'QUALIFICATION_CALL');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('NEW', 'SCORED', 'SURVEY_BOOKED', 'SURVEYED', 'QUOTED', 'WON', 'CLOSED');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('PENDING', 'READ', 'POOR_PHOTO', 'UNAVAILABLE', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "ProjectStage" AS ENUM ('ADVANCE_RECEIVED', 'DOCUMENTS', 'INSTALLATION_SCHEDULED', 'INSTALLED', 'NET_METERING_APPLIED', 'NET_METER_INSTALLED', 'SUBSIDY_APPLIED', 'SUBSIDY_CREDITED');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('WHATSAPP', 'SMS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "ownership" "Ownership" NOT NULL,
    "roofType" "RoofType" NOT NULL,
    "roofAreaSqm" DOUBLE PRECISION NOT NULL,
    "monthlyBill" INTEGER NOT NULL,
    "pincode" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "consentAt" TIMESTAMP(3) NOT NULL,
    "consentPurpose" TEXT NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
    "score" "Score",
    "scorePoints" INTEGER,
    "scoreReasons" JSONB,
    "nextAction" "NextAction",
    "recommendedKw" DOUBLE PRECISION,
    "sizingReasons" JSONB,
    "scoredAt" TIMESTAMP(3),
    "callLoggedAt" TIMESTAMP(3),
    "callNotes" TEXT,
    "closedReason" TEXT,
    "surveyBookedFor" TIMESTAMP(3),
    "surveyedAt" TIMESTAMP(3),
    "surveyQualified" BOOLEAN,
    "surveyRoofSqm" DOUBLE PRECISION,
    "surveyShading" "Shading",
    "surveyNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillReading" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'PENDING',
    "reader" TEXT,
    "model" TEXT,
    "poorReason" TEXT,
    "ai" JSONB,
    "confirmed" JSONB,
    "editedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubsidyRule" (
    "id" TEXT NOT NULL,
    "schemeName" TEXT NOT NULL,
    "segment" TEXT NOT NULL DEFAULT 'RESIDENTIAL',
    "slabs" JSONB NOT NULL,
    "capAmount" INTEGER NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "sourceNote" TEXT NOT NULL,
    "verifyBeforeLaunch" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubsidyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "segment" TEXT NOT NULL DEFAULT 'RESIDENTIAL',
    "bands" JSONB NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "quoteDate" DATE NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "inputs" JSONB NOT NULL,
    "options" JSONB NOT NULL,
    "selectedKw" DOUBLE PRECISION NOT NULL,
    "snapshot" JSONB NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "systemKw" DOUBLE PRECISION NOT NULL,
    "netCost" INTEGER NOT NULL,
    "advanceAmount" INTEGER NOT NULL,
    "advanceReference" TEXT NOT NULL,
    "stage" "ProjectStage" NOT NULL DEFAULT 'ADVANCE_RECEIVED',
    "stageEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusViews" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fromStage" "ProjectStage",
    "toStage" "ProjectStage" NOT NULL,
    "actorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDocument" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageOutbox" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "projectId" TEXT,
    "channel" "Channel" NOT NULL DEFAULT 'WHATSAPP',
    "toPhone" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT_MOCK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key","windowStart")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_login_key" ON "User"("login");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_code_key" ON "Lead"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_accessToken_key" ON "Lead"("accessToken");

-- CreateIndex
CREATE INDEX "Lead_stage_score_idx" ON "Lead"("stage", "score");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE INDEX "BillReading_leadId_createdAt_idx" ON "BillReading"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "SubsidyRule_segment_effectiveFrom_idx" ON "SubsidyRule"("segment", "effectiveFrom");

-- CreateIndex
CREATE INDEX "PriceRule_segment_effectiveFrom_idx" ON "PriceRule"("segment", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_token_key" ON "Quote"("token");

-- CreateIndex
CREATE INDEX "Quote_leadId_idx" ON "Quote"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Project_token_key" ON "Project"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Project_leadId_key" ON "Project"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_quoteId_key" ON "Project"("quoteId");

-- CreateIndex
CREATE INDEX "Project_stage_idx" ON "Project"("stage");

-- CreateIndex
CREATE INDEX "ProjectEvent_projectId_createdAt_idx" ON "ProjectEvent"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectDocument_projectId_idx" ON "ProjectDocument"("projectId");

-- CreateIndex
CREATE INDEX "MessageOutbox_createdAt_idx" ON "MessageOutbox"("createdAt");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillReading" ADD CONSTRAINT "BillReading_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEvent" ADD CONSTRAINT "ProjectEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEvent" ADD CONSTRAINT "ProjectEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageOutbox" ADD CONSTRAINT "MessageOutbox_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageOutbox" ADD CONSTRAINT "MessageOutbox_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
