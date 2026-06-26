import { Router } from "express";
import { prisma } from "../prisma";
import { roomSchema } from "../validation";
import { requireSuperAdmin } from "../middleware/auth";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const where = req.user!.role === "ADMIN" ? { branchId: req.user!.branchId ?? "" } : {};
    const rooms = await prisma.room.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { branch: true },
    });
    res.json(rooms);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireSuperAdmin, async (req, res, next) => {
  try {
    const data = roomSchema.parse(req.body);
    const room = await prisma.room.create({ data, include: { branch: true } });
    res.status(201).json(room);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireSuperAdmin, async (req, res, next) => {
  try {
    const data = roomSchema.parse(req.body);
    const room = await prisma.room.update({
      where: { id: req.params.id },
      data,
      include: { branch: true },
    });
    res.json(room);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireSuperAdmin, async (req, res, next) => {
  try {
    await prisma.room.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
