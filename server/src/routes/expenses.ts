import { Router } from "express";
import { prisma } from "../prisma";
import { expenseSchema } from "../validation";
import { requireSuperAdmin } from "../middleware/auth";
import { recordAudit, buildChanges, summarize } from "../audit";

const router = Router();
router.use(requireSuperAdmin);

const EXPENSE_AUDIT_FIELDS = ["date", "category", "amount", "currency", "note"];
const money = (n: number) => n.toLocaleString("ru-RU");

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
    await recordAudit(req, {
      action: "CREATE",
      entity: "expense",
      entityId: expense.id,
      summary: summarize("CREATE", "expense", [], `${expense.category}, ${money(expense.amount)} ${expense.currency}`),
    });
    res.status(201).json(expense);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ message: "Запись не найдена" });
    }

    const data = expenseSchema.parse(req.body);
    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data: { ...data, date: new Date(data.date) },
      include: { branch: true },
    });

    const changes = buildChanges(
      existing as unknown as Record<string, unknown>,
      expense as unknown as Record<string, unknown>,
      EXPENSE_AUDIT_FIELDS
    );
    if (changes.length) {
      await recordAudit(req, {
        action: "UPDATE",
        entity: "expense",
        entityId: expense.id,
        summary: summarize("UPDATE", "expense", changes),
        changes,
      });
    }
    res.json(expense);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ message: "Запись не найдена" });
    }

    await prisma.expense.delete({ where: { id: req.params.id } });
    await recordAudit(req, {
      action: "DELETE",
      entity: "expense",
      entityId: existing.id,
      summary: summarize("DELETE", "expense", [], `${existing.category}, ${money(existing.amount)} ${existing.currency}`),
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
