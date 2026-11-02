-- AlterTable
ALTER TABLE "BillReading" ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'INTAKE';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "blockers" JSONB,
ADD COLUMN     "roofOutline" JSONB;

-- CreateTable
CREATE TABLE "TariffRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "segment" TEXT NOT NULL DEFAULT 'RESIDENTIAL',
    "slabs" JSONB NOT NULL,
    "fixedSinglePhase" DOUBLE PRECISION NOT NULL,
    "fixedThreePhase" DOUBLE PRECISION NOT NULL,
    "wheelingPerUnit" DOUBLE PRECISION NOT NULL,
    "dutyPercent" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "sourceNote" TEXT NOT NULL,
    "verifyBeforeLaunch" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TariffRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsCheck" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "billAmount" INTEGER NOT NULL,
    "importUnits" INTEGER,
    "exportUnits" INTEGER,
    "bankedUnits" INTEGER,
    "billedUnits" INTEGER,
    "beforeBill" INTEGER NOT NULL,
    "promisedBill" INTEGER NOT NULL,
    "promisedSaving" INTEGER NOT NULL,
    "actualSaving" INTEGER NOT NULL,
    "ratio" DOUBLE PRECISION NOT NULL,
    "verdict" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavingsCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TariffRule_segment_effectiveFrom_idx" ON "TariffRule"("segment", "effectiveFrom");

-- CreateIndex
CREATE INDEX "SavingsCheck_verdict_idx" ON "SavingsCheck"("verdict");

-- CreateIndex
CREATE UNIQUE INDEX "SavingsCheck_projectId_month_key" ON "SavingsCheck"("projectId", "month");

-- AddForeignKey
ALTER TABLE "SavingsCheck" ADD CONSTRAINT "SavingsCheck_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
