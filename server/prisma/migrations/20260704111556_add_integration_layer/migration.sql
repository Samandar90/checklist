-- CreateTable
CREATE TABLE "IntegrationProvider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IntegrationAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "externalHotelId" TEXT,
    "settings" TEXT,
    "lastSyncAt" DATETIME,
    "lastErrorAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IntegrationAccount_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "IntegrationProvider" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IntegrationAccount_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoomMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "externalRoomId" TEXT NOT NULL,
    "externalName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RoomMapping_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "IntegrationAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoomMapping_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReservationMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "externalReservationId" TEXT NOT NULL,
    "externalStatus" TEXT,
    "lastSyncedHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReservationMapping_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "IntegrationAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReservationMapping_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "MonthlyReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payload" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "runAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SyncJob_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "IntegrationAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT,
    "direction" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "durationMs" INTEGER,
    "payloadHash" TEXT,
    "error" TEXT,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "SyncLog_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "IntegrationAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebhookLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT,
    "providerCode" TEXT NOT NULL,
    "signatureOk" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "payloadHash" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookLog_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "IntegrationAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationProvider_code_key" ON "IntegrationProvider"("code");

-- CreateIndex
CREATE INDEX "IntegrationAccount_branchId_idx" ON "IntegrationAccount"("branchId");

-- CreateIndex
CREATE INDEX "IntegrationAccount_status_idx" ON "IntegrationAccount"("status");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationAccount_providerId_branchId_key" ON "IntegrationAccount"("providerId", "branchId");

-- CreateIndex
CREATE INDEX "RoomMapping_accountId_idx" ON "RoomMapping"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomMapping_accountId_externalRoomId_key" ON "RoomMapping"("accountId", "externalRoomId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomMapping_accountId_roomId_key" ON "RoomMapping"("accountId", "roomId");

-- CreateIndex
CREATE INDEX "ReservationMapping_accountId_idx" ON "ReservationMapping"("accountId");

-- CreateIndex
CREATE INDEX "ReservationMapping_reportId_idx" ON "ReservationMapping"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationMapping_accountId_externalReservationId_key" ON "ReservationMapping"("accountId", "externalReservationId");

-- CreateIndex
CREATE INDEX "SyncJob_status_runAt_idx" ON "SyncJob"("status", "runAt");

-- CreateIndex
CREATE INDEX "SyncJob_accountId_idx" ON "SyncJob"("accountId");

-- CreateIndex
CREATE INDEX "SyncLog_accountId_idx" ON "SyncLog"("accountId");

-- CreateIndex
CREATE INDEX "SyncLog_entity_idx" ON "SyncLog"("entity");

-- CreateIndex
CREATE INDEX "SyncLog_startedAt_idx" ON "SyncLog"("startedAt");

-- CreateIndex
CREATE INDEX "WebhookLog_providerCode_idx" ON "WebhookLog"("providerCode");

-- CreateIndex
CREATE INDEX "WebhookLog_createdAt_idx" ON "WebhookLog"("createdAt");

