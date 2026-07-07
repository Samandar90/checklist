-- CreateTable
CREATE TABLE "AdminBranch" (
    "adminId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,

    PRIMARY KEY ("adminId", "branchId"),
    CONSTRAINT "AdminBranch_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AdminBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    CONSTRAINT "MonthlyReport_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MonthlyReport_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MonthlyReport_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "BookingSource" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MonthlyReport" ("adminId", "branchId", "checkOut", "createdAt", "currency", "date", "guestName", "id", "notes", "paidAmount", "paymentMethod", "paymentStatus", "price", "roomId", "sourceId", "status", "updatedAt") SELECT "adminId", "branchId", "checkOut", "createdAt", "currency", "date", "guestName", "id", "notes", "paidAmount", "paymentMethod", "paymentStatus", "price", "roomId", "sourceId", "status", "updatedAt" FROM "MonthlyReport";
DROP TABLE "MonthlyReport";
ALTER TABLE "new_MonthlyReport" RENAME TO "MonthlyReport";
CREATE INDEX "MonthlyReport_branchId_date_idx" ON "MonthlyReport"("branchId", "date");
CREATE INDEX "MonthlyReport_roomId_date_idx" ON "MonthlyReport"("roomId", "date");
CREATE INDEX "MonthlyReport_adminId_idx" ON "MonthlyReport"("adminId");
CREATE INDEX "MonthlyReport_status_idx" ON "MonthlyReport"("status");
CREATE INDEX "MonthlyReport_paymentStatus_idx" ON "MonthlyReport"("paymentStatus");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AdminBranch_branchId_idx" ON "AdminBranch"("branchId");

-- Backfill: каждый существующий админ получает свой основной филиал в AdminBranch
INSERT INTO "AdminBranch" ("adminId", "branchId")
SELECT "id", "branchId" FROM "Admin";

-- CreateIndex
CREATE INDEX "Expense_branchId_date_idx" ON "Expense"("branchId", "date");

-- CreateIndex
CREATE INDEX "Expense_adminId_idx" ON "Expense"("adminId");
