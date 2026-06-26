import { Router } from "express";
import { prisma } from "../prisma";
import { branchSchema } from "../validation";
import { requireSuperAdmin } from "../middleware/auth";

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
    res.status(201).json(branch);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const data = branchSchema.parse(req.body);
    const branch = await prisma.branch.update({
      where: { id: req.params.id },
      data,
    });
    res.json(branch);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await prisma.branch.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
