import { Router } from "express";
import { prisma } from "../prisma";
import { reportSchema } from "../validation";
import { requireSuperAdmin } from "../middleware/auth";

const router = Router();

/**
 * Normalize the stored paid amount so debt is always `price - (paidAmount ?? price)`:
 * "Оплачено" → null (fully paid), "Долг" → 0, "Частично" → the entered amount.
 */
function normalizePaid(data: { paymentStatus: string; paidAmount?: number | null; price: number }) {
  if (data.paymentStatus === "Оплачено") return null;
  if (data.paymentStatus === "Долг") return 0;
  return data.paidAmount ?? 0;
}

function buildWhere(query: any, isAdmin: boolean, ownAdminId: string | null) {
  const where: any = {};

  if (isAdmin) {
    where.adminId = ownAdminId ?? "__none__";
  } else {
    if (query.branchId) where.branchId = String(query.branchId);
    if (query.adminId) where.adminId = String(query.adminId);
    if (query.sourceId) where.sourceId = String(query.sourceId);
  }

  const month = query.month ? parseInt(String(query.month), 10) : undefined;
  const year = query.year ? parseInt(String(query.year), 10) : undefined;

  if (year && month) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    where.date = { gte: start, lt: end };
  } else if (year) {
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);
    where.date = { gte: start, lt: end };
  }

  return where;
}

router.get("/", async (req, res, next) => {
  try {
    const isAdmin = req.user!.role === "ADMIN";
    const where = buildWhere(req.query, isAdmin, req.user!.adminId);
    const reports = await prisma.monthlyReport.findMany({
      where,
      orderBy: { date: "desc" },
      include: { branch: true, admin: true, room: true, source: true },
    });
    res.json(reports);
  } catch (err) {
    next(err);
  }
});

router.get("/summary", requireSuperAdmin, async (req, res, next) => {
  try {
    const where = buildWhere(req.query, false, null);
    const reports = await prisma.monthlyReport.findMany({
      where,
      include: { branch: true, admin: true, source: true },
    });

    const totalRevenue = reports.reduce((sum, r) => sum + r.price, 0);

    const byBranch: Record<string, { name: string; total: number; count: number }> = {};
    const byAdmin: Record<string, { name: string; total: number; count: number }> = {};
    const bySource: Record<string, { name: string; total: number; count: number }> = {};

    for (const r of reports) {
      byBranch[r.branchId] ??= { name: r.branch.name, total: 0, count: 0 };
      byBranch[r.branchId].total += r.price;
      byBranch[r.branchId].count += 1;

      byAdmin[r.adminId] ??= { name: r.admin.fullName, total: 0, count: 0 };
      byAdmin[r.adminId].total += r.price;
      byAdmin[r.adminId].count += 1;

      bySource[r.sourceId] ??= { name: r.source.name, total: 0, count: 0 };
      bySource[r.sourceId].total += r.price;
      bySource[r.sourceId].count += 1;
    }

    res.json({
      totalRevenue,
      totalReports: reports.length,
      byBranch: Object.values(byBranch),
      byAdmin: Object.values(byAdmin),
      bySource: Object.values(bySource),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const body = { ...req.body };
    if (req.user!.role === "ADMIN") {
      if (!req.user!.adminId || !req.user!.branchId) {
        return res.status(403).json({ message: "Ваш аккаунт не привязан к администратору филиала" });
      }
      body.adminId = req.user!.adminId;
      body.branchId = req.user!.branchId;
    }

    const data = reportSchema.parse(body);
    const report = await prisma.monthlyReport.create({
      data: { ...data, date: new Date(data.date), paidAmount: normalizePaid(data) },
      include: { branch: true, admin: true, room: true, source: true },
    });
    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    if (req.user!.role === "ADMIN") {
      const existing = await prisma.monthlyReport.findUnique({ where: { id: req.params.id } });
      if (!existing || existing.adminId !== req.user!.adminId) {
        return res.status(403).json({ message: "Недостаточно прав для изменения этого отчёта" });
      }
    }

    const body = { ...req.body };
    if (req.user!.role === "ADMIN") {
      body.adminId = req.user!.adminId;
      body.branchId = req.user!.branchId;
    }

    const data = reportSchema.parse(body);
    const report = await prisma.monthlyReport.update({
      where: { id: req.params.id },
      data: { ...data, date: new Date(data.date), paidAmount: normalizePaid(data) },
      include: { branch: true, admin: true, room: true, source: true },
    });
    res.json(report);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (req.user!.role === "ADMIN") {
      const existing = await prisma.monthlyReport.findUnique({ where: { id: req.params.id } });
      if (!existing || existing.adminId !== req.user!.adminId) {
        return res.status(403).json({ message: "Недостаточно прав для удаления этого отчёта" });
      }
    }

    await prisma.monthlyReport.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
