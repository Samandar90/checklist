import { Router } from "express";
import { prisma } from "../prisma";
import { adminSchema } from "../validation";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const admins = await prisma.admin.findMany({
      orderBy: { createdAt: "desc" },
      include: { branch: true },
    });
    res.json(admins);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const data = adminSchema.parse(req.body);
    const admin = await prisma.admin.create({ data, include: { branch: true } });
    res.status(201).json(admin);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const data = adminSchema.parse(req.body);
    const admin = await prisma.admin.update({
      where: { id: req.params.id },
      data,
      include: { branch: true },
    });
    res.json(admin);
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
