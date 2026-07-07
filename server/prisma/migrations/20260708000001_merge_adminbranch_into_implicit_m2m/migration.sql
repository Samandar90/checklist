-- Two parallel multi-branch implementations existed for a short while:
-- the explicit "AdminBranch" table and Prisma's implicit "_AdminBranches".
-- Keep the implicit one; migrate any assignments made via AdminBranch, then drop it.
INSERT OR IGNORE INTO "_AdminBranches" ("A", "B")
SELECT "adminId", "branchId" FROM "AdminBranch";

DROP TABLE "AdminBranch";
