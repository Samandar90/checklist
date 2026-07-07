-- CreateTable
CREATE TABLE "_AdminBranches" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_AdminBranches_A_fkey" FOREIGN KEY ("A") REFERENCES "Admin" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_AdminBranches_B_fkey" FOREIGN KEY ("B") REFERENCES "Branch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "_AdminBranches_AB_unique" ON "_AdminBranches"("A", "B");

-- CreateIndex
CREATE INDEX "_AdminBranches_B_index" ON "_AdminBranches"("B");

-- Backfill: every existing admin keeps access to their current (primary) branch,
-- so nothing changes for single-branch admins after this migration.
INSERT INTO "_AdminBranches" ("A", "B")
SELECT "id", "branchId" FROM "Admin";
