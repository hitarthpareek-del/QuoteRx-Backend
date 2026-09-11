-- DropForeignKey
ALTER TABLE "QuotationWorkflowHistory" DROP CONSTRAINT "QuotationWorkflowHistory_performedByUserId_fkey";

-- AlterTable
ALTER TABLE "QuotationWorkflowHistory" ALTER COLUMN "performedByUserId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "QuotationWorkflowHistory" ADD CONSTRAINT "QuotationWorkflowHistory_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
