/*
  Warnings:

  - You are about to drop the column `googleDriveFileId` on the `QuotationVersion` table. All the data in the column will be lost.
  - You are about to drop the column `googleDriveFileName` on the `QuotationVersion` table. All the data in the column will be lost.
  - You are about to drop the column `googleDriveWebUrl` on the `QuotationVersion` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "QuotationVersion" DROP COLUMN "googleDriveFileId",
DROP COLUMN "googleDriveFileName",
DROP COLUMN "googleDriveWebUrl",
ADD COLUMN     "documentUrl" TEXT;
