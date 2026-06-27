import { Router } from "express";
import { prisma } from "../prisma";
import { branchSchema } from "../validation";
import { requireSuperAdmin } from "../middleware/auth";
import { recordAudit, buildChanges, summarize } from "../audit";

const router = Router();
router.use(requireSuperAdmin);

router.get("/", async (_req, res, next) => {
  try {
    const branches = await prisma.branch.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { admins: true, rooms: true, reports: true } },
      },
    });
    res.json(branches);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const data = branchSchema.parse(req.body);
    const branch = await prisma.branch.create({ data });
    await recordAudit(req, {
      action: "CREATE",
      entity: "branch",
      entityId: branch.id,
      summary: summarize("CREATE", "branch", [], branch.name),
    });
    res.status(201).json(branch);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const existing = await prisma.branch.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ message: "Запись не найдена" });
    }
    const data = branchSchema.parse(req.body);
    const branch = await prisma.branch.update({
      where: { id: req.params.id },
      data,
    });
    const changes = buildChanges(existing, branch, ["name"]);
    if (changes.length) {
      await recordAudit(req, {
        action: "UPDATE",
        entity: "branch",
        entityId: branch.id,
        summary: summarize("UPDATE", "branch", changes),
        changes,
      });
    }
    res.json(branch);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const existing = await prisma.branch.findUnique({ where: { id: req.params.id } });
    await prisma.branch.delete({ where: { id: req.params.id } });
    await recordAudit(req, {
      action: "DELETE",
      entity: "branch",
      entityId: req.params.id,
      summary: summarize("DELETE", "branch", [], existing?.name),
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
