/*
  Warnings:

  - A unique constraint covering the columns `[quotationPrefix]` on the table `Company` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('SENT', 'NEGOTIATION', 'SUCCESSFUL', 'LOST', 'EXPIRED');

-- CreateEnum
CREATE TYPE "QuotationSuccessType" AS ENUM ('PO', 'JOB_TICKET');

-- CreateEnum
CREATE TYPE "QuotationWorkflowAction" AS ENUM ('CREATED', 'SENT', 'FOLLOW_UP_SENT', 'NEW_VERSION', 'RESENT', 'SUCCESSFUL', 'LOST', 'EXPIRED');

-- CreateEnum
CREATE TYPE "QuotationFollowUpStatus" AS ENUM ('PENDING', 'SENT', 'SKIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuotationEmailType" AS ENUM ('INITIAL', 'VERSION', 'FOLLOW_UP', 'RESEND');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "quotationPrefix" TEXT;

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "quotationNumber" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" "QuotationStatus" NOT NULL,
    "quotationYear" INTEGER NOT NULL,
    "yearlySequence" INTEGER NOT NULL,
    "expectedPODate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "followUpDays" INTEGER,
    "followUpCount" INTEGER NOT NULL DEFAULT 0,
    "nextFollowUpAt" TIMESTAMP(3),
    "successfulType" "QuotationSuccessType",
    "successfulReference" TEXT,
    "lostRemarks" TEXT,
    "latestVersionNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationVersion" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "documentData" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3),
    "generatedByUserId" TEXT,
    "sentAt" TIMESTAMP(3),
    "sentByUserId" TEXT,
    "googleDriveFileId" TEXT,
    "googleDriveFileName" TEXT,
    "googleDriveWebUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotationVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationWorkflowHistory" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "action" "QuotationWorkflowAction" NOT NULL,
    "fromStatus" "QuotationStatus",
    "toStatus" "QuotationStatus",
    "versionNumber" INTEGER,
    "remarks" TEXT,
    "metadata" JSONB,
    "performedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotationWorkflowHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationFollowUp" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "cycleNumber" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "status" "QuotationFollowUpStatus" NOT NULL DEFAULT 'PENDING',
    "recipientEmail" TEXT,
    "subject" TEXT,
    "body" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotationFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationEmail" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "type" "QuotationEmailType" NOT NULL,
    "toEmail" TEXT NOT NULL,
    "ccEmail" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "sentByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotationEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationSequence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotationSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_quotationNumber_key" ON "Quotation"("quotationNumber");

-- CreateIndex
CREATE INDEX "Quotation_companyId_idx" ON "Quotation"("companyId");

-- CreateIndex
CREATE INDEX "Quotation_createdByUserId_idx" ON "Quotation"("createdByUserId");

-- CreateIndex
CREATE INDEX "Quotation_clientId_idx" ON "Quotation"("clientId");

-- CreateIndex
CREATE INDEX "Quotation_status_idx" ON "Quotation"("status");

-- CreateIndex
CREATE INDEX "Quotation_quotationYear_idx" ON "Quotation"("quotationYear");

-- CreateIndex
CREATE INDEX "Quotation_expiryDate_idx" ON "Quotation"("expiryDate");

-- CreateIndex
CREATE INDEX "Quotation_nextFollowUpAt_idx" ON "Quotation"("nextFollowUpAt");

-- CreateIndex
CREATE INDEX "QuotationVersion_quotationId_idx" ON "QuotationVersion"("quotationId");

-- CreateIndex
CREATE INDEX "QuotationVersion_generatedAt_idx" ON "QuotationVersion"("generatedAt");

-- CreateIndex
CREATE INDEX "QuotationVersion_sentAt_idx" ON "QuotationVersion"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuotationVersion_quotationId_versionNumber_key" ON "QuotationVersion"("quotationId", "versionNumber");

-- CreateIndex
CREATE INDEX "QuotationWorkflowHistory_quotationId_idx" ON "QuotationWorkflowHistory"("quotationId");

-- CreateIndex
CREATE INDEX "QuotationWorkflowHistory_performedByUserId_idx" ON "QuotationWorkflowHistory"("performedByUserId");

-- CreateIndex
CREATE INDEX "QuotationWorkflowHistory_action_idx" ON "QuotationWorkflowHistory"("action");

-- CreateIndex
CREATE INDEX "QuotationWorkflowHistory_createdAt_idx" ON "QuotationWorkflowHistory"("createdAt");

-- CreateIndex
CREATE INDEX "QuotationFollowUp_quotationId_idx" ON "QuotationFollowUp"("quotationId");

-- CreateIndex
CREATE INDEX "QuotationFollowUp_scheduledAt_idx" ON "QuotationFollowUp"("scheduledAt");

-- CreateIndex
CREATE INDEX "QuotationFollowUp_status_idx" ON "QuotationFollowUp"("status");

-- CreateIndex
CREATE UNIQUE INDEX "QuotationFollowUp_quotationId_cycleNumber_key" ON "QuotationFollowUp"("quotationId", "cycleNumber");

-- CreateIndex
CREATE INDEX "QuotationEmail_quotationId_idx" ON "QuotationEmail"("quotationId");

-- CreateIndex
CREATE INDEX "QuotationEmail_sentByUserId_idx" ON "QuotationEmail"("sentByUserId");

-- CreateIndex
CREATE INDEX "QuotationEmail_sentAt_idx" ON "QuotationEmail"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuotationSequence_companyId_userId_year_key" ON "QuotationSequence"("companyId", "userId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Company_quotationPrefix_key" ON "Company"("quotationPrefix");

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationVersion" ADD CONSTRAINT "QuotationVersion_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationVersion" ADD CONSTRAINT "QuotationVersion_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationVersion" ADD CONSTRAINT "QuotationVersion_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationWorkflowHistory" ADD CONSTRAINT "QuotationWorkflowHistory_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationWorkflowHistory" ADD CONSTRAINT "QuotationWorkflowHistory_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationFollowUp" ADD CONSTRAINT "QuotationFollowUp_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationEmail" ADD CONSTRAINT "QuotationEmail_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationEmail" ADD CONSTRAINT "QuotationEmail_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationSequence" ADD CONSTRAINT "QuotationSequence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationSequence" ADD CONSTRAINT "QuotationSequence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
