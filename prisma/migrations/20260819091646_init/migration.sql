-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'SUDO', 'ADMIN', 'USER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "isWhitelisted" BOOLEAN NOT NULL DEFAULT false,
    "warnings" INTEGER NOT NULL DEFAULT 0,
    "customAutoReply" TEXT,
    "language" TEXT NOT NULL DEFAULT 'fr',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nickname" TEXT,
    "tags" TEXT[],
    "relationship" TEXT,
    "notes" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "customAutoReply" TEXT,
    "lastInteraction" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isAntilink" BOOLEAN NOT NULL DEFAULT false,
    "isAntispam" BOOLEAN NOT NULL DEFAULT false,
    "isAntibot" BOOLEAN NOT NULL DEFAULT false,
    "isAntiflood" BOOLEAN NOT NULL DEFAULT false,
    "isAntimedias" BOOLEAN NOT NULL DEFAULT false,
    "isBadwordFilter" BOOLEAN NOT NULL DEFAULT false,
    "badwords" TEXT[],
    "welcomeMessage" TEXT,
    "goodbyeMessage" TEXT,
    "rules" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_members" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userJid" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "warnings" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "chatJid" TEXT NOT NULL,
    "senderJid" TEXT NOT NULL,
    "content" TEXT,
    "mediaType" TEXT,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "command_usages" (
    "id" TEXT NOT NULL,
    "commandName" TEXT NOT NULL,
    "userJid" TEXT NOT NULL,
    "chatJid" TEXT NOT NULL,
    "executionTimeMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "command_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memories" (
    "id" TEXT NOT NULL,
    "userJid" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "userJid" TEXT NOT NULL,
    "chatJid" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "triggerAt" TIMESTAMP(3) NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" TEXT NOT NULL,
    "groupId" TEXT,
    "userJid" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actionTaken" TEXT NOT NULL,
    "details" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_statistics" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "totalMessages" INTEGER NOT NULL DEFAULT 0,
    "totalSpam" INTEGER NOT NULL DEFAULT 0,
    "totalLinks" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autoreply_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "state" TEXT NOT NULL DEFAULT 'OFF',
    "cooldownHours" DOUBLE PRECISION NOT NULL DEFAULT 6,
    "maxPerHour" INTEGER NOT NULL DEFAULT 20,
    "minDelaySeconds" INTEGER NOT NULL DEFAULT 5,
    "maxDelaySeconds" INTEGER NOT NULL DEFAULT 20,
    "humanActiveWindowMin" INTEGER NOT NULL DEFAULT 15,
    "vacationUntil" TIMESTAMP(3),
    "scheduleDays" TEXT[] DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']::TEXT[],
    "scheduleStart" TEXT,
    "scheduleEnd" TEXT,
    "urgentKeywords" TEXT[] DEFAULT ARRAY['urgent', 'urgence', 'serveur', 'paiement', 'deadline', 'bloquant', 'sos', 'problème critique']::TEXT[],
    "groupsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultTemplate" TEXT NOT NULL DEFAULT 'Salut {firstName} 👋 Je suis actuellement occupé. J''ai bien reçu ton message et je reviens vers toi au plus vite.',
    "busyTemplate" TEXT NOT NULL DEFAULT 'Salut {firstName} ! Je suis actuellement très occupé. J''ai bien noté ton message et je te réponds dès que j''ai un moment 🙏',
    "awayTemplate" TEXT NOT NULL DEFAULT 'Hey {firstName} ! Je suis absent pour l''instant. J''ai bien reçu ton message et je reviendrai vers toi dès que possible.',
    "vacationTemplate" TEXT NOT NULL DEFAULT 'Bonjour {firstName} 👋 Je suis en congés jusqu''au {untilDate}. Je prendrai connaissance de ton message à mon retour !',
    "nightTemplate" TEXT NOT NULL DEFAULT 'Bonsoir {firstName}. Il est un peu tard, je prendrai connaissance de ton message demain matin.',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "autoreply_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autoreply_contacts" (
    "id" TEXT NOT NULL,
    "userJid" TEXT NOT NULL,
    "name" TEXT,
    "category" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "customTemplate" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReplyAt" TIMESTAMP(3),
    "cooldownUntil" TIMESTAMP(3),
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "isAllowed" BOOLEAN NOT NULL DEFAULT false,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "humanActiveUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "autoreply_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autoreply_logs" (
    "id" TEXT NOT NULL,
    "contactJid" TEXT NOT NULL,
    "messageText" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "templateUsed" TEXT,
    "delayAppliedMs" INTEGER,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "autoreply_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "group_members_groupId_userJid_key" ON "group_members"("groupId", "userJid");

-- CreateIndex
CREATE UNIQUE INDEX "group_statistics_groupId_key" ON "group_statistics"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "autoreply_contacts_userJid_key" ON "autoreply_contacts"("userJid");

-- CreateIndex
CREATE INDEX "autoreply_logs_contactJid_sentAt_idx" ON "autoreply_logs"("contactJid", "sentAt");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderJid_fkey" FOREIGN KEY ("senderJid") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "command_usages" ADD CONSTRAINT "command_usages_userJid_fkey" FOREIGN KEY ("userJid") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_userJid_fkey" FOREIGN KEY ("userJid") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_userJid_fkey" FOREIGN KEY ("userJid") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_statistics" ADD CONSTRAINT "group_statistics_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autoreply_logs" ADD CONSTRAINT "autoreply_logs_contactJid_fkey" FOREIGN KEY ("contactJid") REFERENCES "autoreply_contacts"("userJid") ON DELETE CASCADE ON UPDATE CASCADE;
