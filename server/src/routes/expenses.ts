import { Router } from "express";
import { prisma } from "../prisma";
import { expenseSchema } from "../validation";
import { requireSuperAdmin } from "../middleware/auth";

const router = Router();
router.use(requireSuperAdmin);

function buildWhere(query: any) {
  const where: any = {};
  if (query.branchId) where.branchId = String(query.branchId);

  const from = query.from ? new Date(String(query.from)) : undefined;
  const to = query.to ? new Date(String(query.to)) : undefined;
  if (from && !Number.isNaN(from.getTime())) {
    from.setHours(0, 0, 0, 0);
    where.date = { ...(where.date ?? {}), gte: from };
  }
  if (to && !Number.isNaN(to.getTime())) {
    to.setHours(0, 0, 0, 0);
    const end = new Date(to.getTime() + 24 * 60 * 60 * 1000);
    where.date = { ...(where.date ?? {}), lt: end };
  }
  return where;
}

router.get("/", async (req, res, next) => {
  try {
    const expenses = await prisma.expense.findMany({
      where: buildWhere(req.query),
      orderBy: { date: "desc" },
      include: { branch: true },
    });
    res.json(expenses);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const data = expenseSchema.parse(req.body);
    const expense = await prisma.expense.create({
      data: { ...data, date: new Date(data.date) },
      include: { branch: true },
    });
    res.status(201).json(expense);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const data = expenseSchema.parse(req.body);
    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data: { ...data, date: new Date(data.date) },
      include: { branch: true },
    });
    res.json(expense);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await prisma.expense.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
