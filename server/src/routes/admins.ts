import { Router } from "express";
import { prisma } from "../prisma";
import { adminCreateSchema, adminUpdateSchema } from "../validation";
import { requireSuperAdmin } from "../middleware/auth";
import { hashPassword } from "../auth";
import { recordAudit, buildChanges, summarize } from "../audit";

const router = Router();
router.use(requireSuperAdmin);

function serializeAdmin(admin: any) {
  const { user, branches, ...rest } = admin;
  return {
    ...rest,
    username: user?.username ?? null,
    branchIds: (branches ?? []).map((ab: any) => ab.branchId),
    branches: (branches ?? []).map((ab: any) => ab.branch).filter(Boolean),
  };
}

const ADMIN_INCLUDE = { branch: true, user: true, branches: { include: { branch: true } } };

/** Accept legacy payloads that still send a single branchId. */
function normalizeBody(body: any) {
  if (!Array.isArray(body.branchIds) && body.branchId) {
    return { ...body, branchIds: [body.branchId] };
  }
  return body;
}

router.get("/", async (_req, res, next) => {
  try {
    const admins = await prisma.admin.findMany({
      orderBy: { createdAt: "desc" },
      include: ADMIN_INCLUDE,
    });
    res.json(admins.map(serializeAdmin));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { username, password, branchIds, ...data } = adminCreateSchema.parse(normalizeBody(req.body));
    const uniqueBranchIds = [...new Set(branchIds)];

    const admin = await prisma.$transaction(async (tx) => {
      const created = await tx.admin.create({
        data: { ...data, branchId: uniqueBranchIds[0] },
      });
      await tx.adminBranch.createMany({
        data: uniqueBranchIds.map((branchId) => ({ adminId: created.id, branchId })),
      });
      await tx.user.create({
        data: {
          username,
          passwordHash: await hashPassword(password),
          role: "ADMIN",
          adminId: created.id,
        },
      });
      return tx.admin.findUniqueOrThrow({ where: { id: created.id }, include: ADMIN_INCLUDE });
    });

    await recordAudit(req, {
      action: "CREATE",
      entity: "admin",
      entityId: admin.id,
      summary: summarize("CREATE", "admin", [], `${admin.fullName} (${username})`),
    });
    res.status(201).json(serializeAdmin(admin));
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const { username, password, branchIds, ...data } = adminUpdateSchema.parse(normalizeBody(req.body));
    const uniqueBranchIds = [...new Set(branchIds)];

    const existing = await prisma.admin.findUnique({
      where: { id: req.params.id },
      include: { user: true, branches: true },
    });
    if (!existing) {
      return res.status(404).json({ message: "Запись не найдена" });
    }

    const admin = await prisma.$transaction(async (tx) => {
      await tx.admin.update({
        where: { id: req.params.id },
        data: { ...data, branchId: uniqueBranchIds[0] },
      });
      // Пересобираем привязки к филиалам целиком.
      await tx.adminBranch.deleteMany({ where: { adminId: req.params.id } });
      await tx.adminBranch.createMany({
        data: uniqueBranchIds.map((branchId) => ({ adminId: req.params.id, branchId })),
      });

      const userUpdate: { username: string; passwordHash?: string } = { username };
      if (password) {
        userUpdate.passwordHash = await hashPassword(password);
      }
      await tx.user.update({
        where: { adminId: req.params.id },
        data: userUpdate,
      });

      return tx.admin.findUniqueOrThrow({ where: { id: req.params.id }, include: ADMIN_INCLUDE });
    });

    const before = {
      fullName: existing.fullName,
      phone: existing.phone,
      username: existing.user?.username ?? "",
      branches: existing.branches.map((b) => b.branchId).sort().join(","),
    };
    const after = {
      fullName: admin.fullName,
      phone: admin.phone,
      username,
      branches: uniqueBranchIds.slice().sort().join(","),
    };
    const changes = buildChanges(before, after, ["fullName", "phone", "username"]);
    if (before.branches !== after.branches) {
      changes.push({
        field: "branches",
        label: "Филиалы",
        from: String(existing.branches.length),
        to: String(uniqueBranchIds.length),
      });
    }
    if (password) {
      changes.push({ field: "password", label: "Пароль", from: "—", to: "изменён" });
    }
    if (changes.length) {
      await recordAudit(req, {
        action: "UPDATE",
        entity: "admin",
        entityId: admin.id,
        summary: summarize("UPDATE", "admin", changes),
        changes,
      });
    }
    res.json(serializeAdmin(admin));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const existing = await prisma.admin.findUnique({ where: { id: req.params.id } });
    await prisma.admin.delete({ where: { id: req.params.id } });
    await recordAudit(req, {
      action: "DELETE",
      entity: "admin",
      entityId: req.params.id,
      summary: summarize("DELETE", "admin", [], existing?.fullName),
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
