import { Router } from "express";
import { prisma } from "../prisma";
import { requireSuperAdmin } from "../middleware/auth";

const router = Router();
router.use(requireSuperAdmin);

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Parse a YYYY-MM-DD string into a local Date at midnight, or undefined. */
function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : startOfDay(d);
}

function dayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface Bucket {
  name: string;
  total: number;
  count: number;
}

function topFrom(map: Record<string, Bucket>, limit?: number): Bucket[] {
  const arr = Object.values(map).sort((a, b) => b.total - a.total);
  return limit ? arr.slice(0, limit) : arr;
}

router.get("/", async (req, res, next) => {
  try {
    const branchId = typeof req.query.branchId === "string" && req.query.branchId ? req.query.branchId : undefined;

    // Resolve the requested range. Defaults to the last 30 days (inclusive).
    const today = startOfDay(new Date());
    const to = parseDate(req.query.to) ?? today;
    const from = parseDate(req.query.from) ?? new Date(to.getTime() - 29 * DAY_MS);

    // Exclusive upper bound = the day after `to`.
    const toExclusive = new Date(startOfDay(to).getTime() + DAY_MS);
    const fromInclusive = startOfDay(from);

    // Previous period of equal length, immediately before the current one.
    const rangeDays = Math.max(1, Math.round((toExclusive.getTime() - fromInclusive.getTime()) / DAY_MS));
    const prevFrom = new Date(fromInclusive.getTime() - rangeDays * DAY_MS);
    const prevToExclusive = fromInclusive;

    const reportWhere = {
      ...(branchId ? { branchId } : {}),
      date: { gte: fromInclusive, lt: toExclusive },
    };

    const [totalBranches, totalAdmins, totalRooms, roomsInScope, reports, expenses, prevAgg, todayAgg] =
      await Promise.all([
        prisma.branch.count(),
        prisma.admin.count(),
        prisma.room.count(),
        branchId ? prisma.room.count({ where: { branchId } }) : prisma.room.count(),
        prisma.monthlyReport.findMany({
          where: reportWhere,
          include: { branch: true, admin: true, source: true },
        }),
        prisma.expense.findMany({
          where: { ...(branchId ? { branchId } : {}), date: { gte: fromInclusive, lt: toExclusive } },
        }),
        prisma.monthlyReport.aggregate({
          _sum: { price: true },
          _count: true,
          where: { ...(branchId ? { branchId } : {}), date: { gte: prevFrom, lt: prevToExclusive } },
        }),
        prisma.monthlyReport.aggregate({
          _sum: { price: true },
          _count: true,
          where: { ...(branchId ? { branchId } : {}), date: { gte: today, lt: new Date(today.getTime() + DAY_MS) } },
        }),
      ]);

    const revenue = reports.reduce((sum, r) => sum + r.price, 0);
    const count = reports.length;
    const avgCheck = count > 0 ? revenue / count : 0;

    // Debt: paidAmount === null means fully paid.
    const totalDebt = reports.reduce((sum, r) => sum + (r.price - (r.paidAmount ?? r.price)), 0);

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = revenue - totalExpenses;

    // Occupancy: count occupied room-nights within the window using check-in/out.
    let occupiedNights = 0;
    for (const r of reports) {
      const start = new Date(r.date);
      const end = r.checkOut ? new Date(r.checkOut) : new Date(start.getTime() + DAY_MS);
      const clampedEnd = Math.min(end.getTime(), toExclusive.getTime());
      const nights = Math.round((clampedEnd - start.getTime()) / DAY_MS);
      occupiedNights += Math.max(1, nights);
    }
    const capacity = roomsInScope * rangeDays;
    const occupancy = capacity > 0 ? Math.min(100, (occupiedNights / capacity) * 100) : 0;

    const byExpense: Record<string, Bucket> = {};
    for (const e of expenses) {
      byExpense[e.category] ??= { name: e.category, total: 0, count: 0 };
      byExpense[e.category].total += e.amount;
      byExpense[e.category].count += 1;
    }

    const prevRevenue = prevAgg._sum.price ?? 0;
    const deltaPct = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null;

    // Time series — one bucket per day across the whole range, gaps filled with 0.
    const series: Record<string, { date: string; total: number; count: number }> = {};
    for (let t = fromInclusive.getTime(); t < toExclusive.getTime(); t += DAY_MS) {
      const key = dayKey(new Date(t));
      series[key] = { date: key, total: 0, count: 0 };
    }

    const byBranch: Record<string, Bucket> = {};
    const byAdmin: Record<string, Bucket> = {};
    const bySource: Record<string, Bucket> = {};
    const byPayment: Record<string, Bucket> = {};

    for (const r of reports) {
      const key = dayKey(new Date(r.date));
      (series[key] ??= { date: key, total: 0, count: 0 });
      series[key].total += r.price;
      series[key].count += 1;

      byBranch[r.branchId] ??= { name: r.branch.name, total: 0, count: 0 };
      byBranch[r.branchId].total += r.price;
      byBranch[r.branchId].count += 1;

      byAdmin[r.adminId] ??= { name: r.admin.fullName, total: 0, count: 0 };
      byAdmin[r.adminId].total += r.price;
      byAdmin[r.adminId].count += 1;

      bySource[r.sourceId] ??= { name: r.source.name, total: 0, count: 0 };
      bySource[r.sourceId].total += r.price;
      bySource[r.sourceId].count += 1;

      byPayment[r.paymentMethod] ??= { name: r.paymentMethod, total: 0, count: 0 };
      byPayment[r.paymentMethod].total += r.price;
      byPayment[r.paymentMethod].count += 1;
    }

    res.json({
      totals: { branches: totalBranches, admins: totalAdmins, rooms: totalRooms },
      range: { from: dayKey(fromInclusive), to: dayKey(to) },
      revenue,
      reports: count,
      avgCheck,
      totalExpenses,
      netProfit,
      totalDebt,
      occupancy,
      today: { revenue: todayAgg._sum.price ?? 0, reports: todayAgg._count },
      previous: { revenue: prevRevenue, deltaPct },
      timeSeries: Object.values(series).sort((a, b) => a.date.localeCompare(b.date)),
      byBranch: topFrom(byBranch),
      byAdmin: topFrom(byAdmin, 5),
      bySource: topFrom(bySource),
      byPayment: topFrom(byPayment),
      byExpense: topFrom(byExpense),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
