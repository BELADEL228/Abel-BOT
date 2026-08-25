/*
  Warnings:

  - A unique constraint covering the columns `[userJid,key]` on the table `memories` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "isAutoReplyIgnored" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "chatJid" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatMessage_chatJid_idx" ON "ChatMessage"("chatJid");

-- CreateIndex
CREATE INDEX "ChatMessage_timestamp_idx" ON "ChatMessage"("timestamp");

-- CreateIndex
CREATE INDEX "ChatMessage_chatJid_timestamp_idx" ON "ChatMessage"("chatJid", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "memories_userJid_key_key" ON "memories"("userJid", "key");
