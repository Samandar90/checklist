import { Router } from "express";
import { prisma } from "../prisma";
import { sourceSchema } from "../validation";
import { requireSuperAdmin } from "../middleware/auth";
import { recordAudit, buildChanges, summarize } from "../audit";

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

router.post("/", requireSuperAdmin, async (req, res, next) => {
  try {
    const data = sourceSchema.parse(req.body);
    const source = await prisma.bookingSource.create({ data });
    await recordAudit(req, {
      action: "CREATE",
      entity: "source",
      entityId: source.id,
      summary: summarize("CREATE", "source", [], source.name),
    });
    res.status(201).json(source);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireSuperAdmin, async (req, res, next) => {
  try {
    const existing = await prisma.bookingSource.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ message: "Запись не найдена" });
    }
    const data = sourceSchema.parse(req.body);
    const source = await prisma.bookingSource.update({
      where: { id: req.params.id },
      data,
    });
    const changes = buildChanges(existing, source, ["name"]);
    if (changes.length) {
      await recordAudit(req, {
        action: "UPDATE",
        entity: "source",
        entityId: source.id,
        summary: summarize("UPDATE", "source", changes),
        changes,
      });
    }
    res.json(source);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireSuperAdmin, async (req, res, next) => {
  try {
    const existing = await prisma.bookingSource.findUnique({ where: { id: req.params.id } });
    await prisma.bookingSource.delete({ where: { id: req.params.id } });
    await recordAudit(req, {
      action: "DELETE",
      entity: "source",
      entityId: req.params.id,
      summary: summarize("DELETE", "source", [], existing?.name),
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
