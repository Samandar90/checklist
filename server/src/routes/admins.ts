import { Router } from "express";
import { prisma } from "../prisma";
import { adminCreateSchema, adminUpdateSchema } from "../validation";
import { requireSuperAdmin } from "../middleware/auth";
import { hashPassword } from "../auth";

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
      include: { branch: true, user: true },
    });
    res.json(admins.map(serializeAdmin));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { username, password, ...data } = adminCreateSchema.parse(req.body);

    const admin = await prisma.$transaction(async (tx) => {
      const created = await tx.admin.create({ data, include: { branch: true } });
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

    res.status(201).json({ ...admin, username });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const { username, password, ...data } = adminUpdateSchema.parse(req.body);

    const admin = await prisma.$transaction(async (tx) => {
      const updated = await tx.admin.update({
        where: { id: req.params.id },
        data,
        include: { branch: true },
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

    res.json({ ...admin, username });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await prisma.admin.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
