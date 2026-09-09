/*
  Warnings:

  - A unique constraint covering the columns `[userPrefix]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userPrefix` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "userPrefix" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_userPrefix_key" ON "User"("userPrefix");
