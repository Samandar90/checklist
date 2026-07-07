import { Router } from "express";
import { prisma } from "../prisma";
import { expenseSchema } from "../validation";
import { recordAudit, buildChanges, summarize } from "../audit";
import { resolveAdminBranch } from "../middleware/auth";

const router = Router();

const EXPENSE_AUDIT_FIELDS = ["date", "category", "amount", "currency", "note"];
const money = (n: number) => n.toLocaleString("ru-RU");

function buildWhere(query: any, isAdmin: boolean, ownAdminId: string | null) {
  const where: any = {};

  if (isAdmin) {
    where.adminId = ownAdminId ?? "__none__";
  } else {
    if (query.branchId) where.branchId = String(query.branchId);
    if (query.adminId) where.adminId = String(query.adminId);
  }

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
    const isAdmin = req.user!.role === "ADMIN";
    const expenses = await prisma.expense.findMany({
      where: buildWhere(req.query, isAdmin, req.user!.adminId),
      orderBy: { date: "desc" },
      include: { branch: true, admin: true },
    });
    res.json(expenses);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const isAdmin = req.user!.role === "ADMIN";
    if (isAdmin && (!req.user!.adminId || !req.user!.branchId)) {
      return res.status(403).json({ message: "Ваш аккаунт не привязан к администратору филиала" });
    }

    const data = expenseSchema.parse(req.body);
    if (!isAdmin && !data.branchId) {
      return res.status(400).json({
        message: "Ошибка валидации",
        errors: [{ path: "branchId", message: "Филиал обязателен" }],
      });
    }
    const branchId = isAdmin ? resolveAdminBranch(req.user!, data.branchId || null) : data.branchId!;
    if (!branchId) {
      return res.status(403).json({ message: "Этот филиал вам не назначен" });
    }
    const adminId = isAdmin ? req.user!.adminId! : null;

    const expense = await prisma.expense.create({
      data: { ...data, branchId, adminId, date: new Date(data.date) },
      include: { branch: true, admin: true },
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
    const isAdmin = req.user!.role === "ADMIN";
    const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ message: "Запись не найдена" });
    }
    if (isAdmin && existing.adminId !== req.user!.adminId) {
      return res.status(403).json({ message: "Недостаточно прав для изменения этого расхода" });
    }

    const data = expenseSchema.parse(req.body);
    if (!isAdmin && !data.branchId) {
      return res.status(400).json({
        message: "Ошибка валидации",
        errors: [{ path: "branchId", message: "Филиал обязателен" }],
      });
    }
    const branchId = isAdmin ? resolveAdminBranch(req.user!, data.branchId || null) ?? existing.branchId : data.branchId!;

    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data: { ...data, branchId, date: new Date(data.date) },
      include: { branch: true, admin: true },
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
    const isAdmin = req.user!.role === "ADMIN";
    const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ message: "Запись не найдена" });
    }
    if (isAdmin && existing.adminId !== req.user!.adminId) {
      return res.status(403).json({ message: "Недостаточно прав для удаления этого расхода" });
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
