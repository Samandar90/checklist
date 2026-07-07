import { Router } from "express";
import { prisma } from "../prisma";
import { cashShiftOpenSchema, cashShiftCloseSchema } from "../validation";
import { recordAudit, summarize } from "../audit";
import { resolveAdminBranch } from "../middleware/auth";

const router = Router();
const money = (n: number) => n.toLocaleString("ru-RU");

/** Cash actually received/spent for an admin's branch within [from, to). */
async function cashFlow(branchId: string, adminId: string, currency: string, from: Date, to: Date) {
  const [reports, expenses] = await Promise.all([
    prisma.monthlyReport.findMany({
      where: { branchId, adminId, currency, paymentMethod: "Наличные", createdAt: { gte: from, lt: to } },
    }),
    prisma.expense.findMany({
      where: { branchId, adminId, currency, createdAt: { gte: from, lt: to } },
    }),
  ]);

  const cashIn = reports.reduce((sum, r) => {
    if (r.paymentStatus === "Долг") return sum;
    if (r.paymentStatus === "Частично") return sum + (r.paidAmount ?? 0);
    return sum + r.price;
  }, 0);
  const cashOut = expenses.reduce((sum, e) => sum + e.amount, 0);

  return { cashIn, cashOut };
}

function buildWhere(query: any, isAdmin: boolean, ownAdminId: string | null) {
  const where: any = {};
  if (isAdmin) {
    where.adminId = ownAdminId ?? "__none__";
  } else {
    if (query.branchId) where.branchId = String(query.branchId);
    if (query.adminId) where.adminId = String(query.adminId);
  }
  if (query.status) where.status = String(query.status);
  return where;
}

router.get("/", async (req, res, next) => {
  try {
    const isAdmin = req.user!.role === "ADMIN";
    const shifts = await prisma.cashShift.findMany({
      where: buildWhere(req.query, isAdmin, req.user!.adminId),
      orderBy: { openedAt: "desc" },
      include: { branch: true, admin: true },
      take: 200,
    });
    res.json(shifts);
  } catch (err) {
    next(err);
  }
});

router.get("/active", async (req, res, next) => {
  try {
    if (req.user!.role !== "ADMIN" || !req.user!.adminId) {
      return res.status(403).json({ message: "Доступно только администраторам филиала" });
    }
    const shift = await prisma.cashShift.findFirst({
      where: { adminId: req.user!.adminId, status: "OPEN" },
      include: { branch: true, admin: true },
      orderBy: { openedAt: "desc" },
    });
    if (!shift) return res.json(null);
    const flow = await cashFlow(shift.branchId, shift.adminId, shift.currency, shift.openedAt, new Date());
    res.json({ ...shift, ...flow, expected: shift.openingAmount + flow.cashIn - flow.cashOut });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    if (req.user!.role !== "ADMIN" || !req.user!.adminId || !req.user!.branchId) {
      return res.status(403).json({ message: "Открыть смену может только администратор филиала" });
    }
    const existing = await prisma.cashShift.findFirst({
      where: { adminId: req.user!.adminId, status: "OPEN" },
    });
    if (existing) {
      return res.status(409).json({ message: "У вас уже есть открытая смена" });
    }

    const data = cashShiftOpenSchema.parse(req.body);
    // Смена открывается в выбранном филиале (из назначенных), по умолчанию — основной.
    const branchId = resolveAdminBranch(req.user!, data.branchId || null);
    if (!branchId) {
      return res.status(403).json({ message: "Этот филиал вам не назначен" });
    }
    const shift = await prisma.cashShift.create({
      data: {
        branchId,
        adminId: req.user!.adminId,
        openingAmount: data.openingAmount,
        currency: data.currency,
        notes: data.notes || null,
      },
      include: { branch: true, admin: true },
    });
    await recordAudit(req, {
      action: "CREATE",
      entity: "cashShift",
      entityId: shift.id,
      summary: summarize("CREATE", "cashShift", [], `смена открыта, остаток ${money(shift.openingAmount)} ${shift.currency}`),
    });
    res.status(201).json(shift);
  } catch (err) {
    next(err);
  }
});

router.put("/:id/close", async (req, res, next) => {
  try {
    const shift = await prisma.cashShift.findUnique({ where: { id: req.params.id } });
    if (!shift) return res.status(404).json({ message: "Смена не найдена" });
    if (req.user!.role === "ADMIN" && shift.adminId !== req.user!.adminId) {
      return res.status(403).json({ message: "Недостаточно прав для закрытия этой смены" });
    }
    if (shift.status === "CLOSED") {
      return res.status(409).json({ message: "Смена уже закрыта" });
    }

    const data = cashShiftCloseSchema.parse(req.body);
    const closedAt = new Date();
    const flow = await cashFlow(shift.branchId, shift.adminId, shift.currency, shift.openedAt, closedAt);
    const expectedAmount = shift.openingAmount + flow.cashIn - flow.cashOut;

    const updated = await prisma.cashShift.update({
      where: { id: shift.id },
      data: {
        status: "CLOSED",
        closedAt,
        closingAmount: data.closingAmount,
        expectedAmount,
        notes: data.notes || shift.notes,
      },
      include: { branch: true, admin: true },
    });

    const diff = data.closingAmount - expectedAmount;
    await recordAudit(req, {
      action: "UPDATE",
      entity: "cashShift",
      entityId: updated.id,
      summary: summarize(
        "UPDATE",
        "cashShift",
        [],
        `смена закрыта, факт ${money(data.closingAmount)} / расчёт ${money(expectedAmount)} ${updated.currency} (разница ${money(diff)})`
      ),
    });
    res.json({ ...updated, ...flow });
  } catch (err) {
    next(err);
  }
});

export default router;
