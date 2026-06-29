-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MonthlyReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "checkOut" DATETIME,
    "guestName" TEXT,
    "branchId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "currency" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'Наличные',
    "paymentStatus" TEXT NOT NULL DEFAULT 'Оплачено',
    "status" TEXT NOT NULL DEFAULT 'RESERVED',
    "paidAmount" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    CONSTRAINT "MonthlyReport_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MonthlyReport_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MonthlyReport_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MonthlyReport_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "BookingSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MonthlyReport" ("adminId", "branchId", "checkOut", "createdAt", "currency", "date", "guestName", "id", "notes", "paidAmount", "paymentMethod", "paymentStatus", "price", "roomId", "sourceId", "updatedAt") SELECT "adminId", "branchId", "checkOut", "createdAt", "currency", "date", "guestName", "id", "notes", "paidAmount", "paymentMethod", "paymentStatus", "price", "roomId", "sourceId", "updatedAt" FROM "MonthlyReport";
DROP TABLE "MonthlyReport";
ALTER TABLE "new_MonthlyReport" RENAME TO "MonthlyReport";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
