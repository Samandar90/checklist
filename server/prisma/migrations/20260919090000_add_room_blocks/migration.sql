-- CreateTable
CREATE TABLE "RoomBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branchId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "guestName" TEXT,
    "note" TEXT,
    "holdUntil" DATETIME,
    "createdByAdminId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    CONSTRAINT "RoomBlock_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoomBlock_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoomBlock_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "Admin" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RoomBlock_roomId_startDate_idx" ON "RoomBlock"("roomId", "startDate");

-- CreateIndex
CREATE INDEX "RoomBlock_branchId_startDate_idx" ON "RoomBlock"("branchId", "startDate");

