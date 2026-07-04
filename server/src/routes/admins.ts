import { Router } from "express";
import { prisma } from "../prisma";
import { adminCreateSchema, adminUpdateSchema } from "../validation";
import { requireSuperAdmin } from "../middleware/auth";
import { hashPassword } from "../auth";
import { recordAudit, buildChanges, summarize } from "../audit";

const router = Router();
router.use(requireSuperAdmin);

function serializeAdmin(admin: any) {
  const { user, ...rest } = admin;
  return { ...rest, username: user?.username ?? null };
}

router.get("/", async (_req, res, next) => {
  try {
    const admins = await prisma.admin.findMany({
      orderBy: { createdAt: "desc" },
      include: { branch: true, branches: true, user: true },
    });
    res.json(admins.map(serializeAdmin));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { username, password, branchIds, ...data } = adminCreateSchema.parse(req.body);
    // Always include the primary branch, even if the caller forgot to list it.
    const uniqueBranchIds = Array.from(new Set([data.branchId, ...(branchIds ?? [])]));

    const admin = await prisma.$transaction(async (tx) => {
      const created = await tx.admin.create({
        data: { ...data, branches: { connect: uniqueBranchIds.map((id) => ({ id })) } },
        include: { branch: true, branches: true },
      });
      await tx.user.create({
        data: {
          username,
          passwordHash: await hashPassword(password),
          role: "ADMIN",
          adminId: created.id,
        },
      });
      return created;
    });

    await recordAudit(req, {
      action: "CREATE",
      entity: "admin",
      entityId: admin.id,
      summary: summarize("CREATE", "admin", [], `${admin.fullName} (${username})`),
    });
    res.status(201).json({ ...admin, username });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const { username, password, branchIds, ...data } = adminUpdateSchema.parse(req.body);
    const uniqueBranchIds = Array.from(new Set([data.branchId, ...(branchIds ?? [])]));

    const existing = await prisma.admin.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });
    if (!existing) {
      return res.status(404).json({ message: "Запись не найдена" });
    }

    const admin = await prisma.$transaction(async (tx) => {
      const updated = await tx.admin.update({
        where: { id: req.params.id },
        data: { ...data, branches: { set: uniqueBranchIds.map((id) => ({ id })) } },
        include: { branch: true, branches: true },
      });

      const userUpdate: { username: string; passwordHash?: string } = { username };
      if (password) {
        userUpdate.passwordHash = await hashPassword(password);
      }

      await tx.user.update({
        where: { adminId: req.params.id },
        data: userUpdate,
      });

      return updated;
    });

    const before = { fullName: existing.fullName, phone: existing.phone, username: existing.user?.username ?? "" };
    const after = { fullName: admin.fullName, phone: admin.phone, username };
    const changes = buildChanges(before, after, ["fullName", "phone", "username"]);
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
    res.json({ ...admin, username });
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
