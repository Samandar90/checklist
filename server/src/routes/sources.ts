import { Router } from "express";
import { prisma } from "../prisma";
import { sourceSchema } from "../validation";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const sources = await prisma.bookingSource.findMany({
      orderBy: { createdAt: "asc" },
    });
    res.json(sources);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const data = sourceSchema.parse(req.body);
    const source = await prisma.bookingSource.create({ data });
    res.status(201).json(source);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const data = sourceSchema.parse(req.body);
    const source = await prisma.bookingSource.update({
      where: { id: req.params.id },
      data,
    });
    res.json(source);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await prisma.bookingSource.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
