import { Router } from "express";
import { prisma } from "../prisma";
import { reportSchema } from "../validation";
import { requireSuperAdmin } from "../middleware/auth";
import { recordAudit, buildChanges, summarize } from "../audit";

const REPORT_AUDIT_FIELDS = ["date", "checkOut", "guestName", "price", "currency", "paymentMethod", "paymentStatus", "status", "paidAmount", "notes", "roomId"];

const STATUS_LABELS: Record<string, string> = {
  RESERVED: "Забронировано",
  CHECKED_IN: "Заселён",
  CHECKED_OUT: "Выехал",
  CANCELLED: "Отменено",
  NO_SHOW: "Не заехал",
};

const money = (n: number) => n.toLocaleString("ru-RU");
const DAY_MS = 24 * 60 * 60 * 1000;

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

// A room is only freed by a cancellation or a no-show; every other status still holds the nights.
const ROOM_HOLDING_STATUSES = ["RESERVED", "CHECKED_IN", "CHECKED_OUT"];

/** Floor a date to the start of its day so overlap is compared in whole hotel-nights. */
const dayStart = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

/** Half-open night range [start, end) for a booking; a missing checkout means a single night. */
function nightRange(date: Date, checkOut: Date | null) {
  const start = dayStart(date);
  const out = checkOut ? dayStart(checkOut) : null;
  const end = out && out.getTime() > start.getTime() ? out : new Date(start.getTime() + DAY_MS);
  return { start, end };
}

/**
 * Find an active booking that overlaps [start, end) on the same room, or null.
 * Prevents double-booking one room for the same nights (adapted from the review's
 * core invariant; enforced in the app layer because SQLite has no exclusion constraints).
 */
async function findRoomConflict(roomId: string, start: Date, end: Date, excludeId: string | null) {
  const candidates = await prisma.monthlyReport.findMany({
    where: {
      roomId,
      status: { in: ROOM_HOLDING_STATUSES },
      date: { lt: end }, // existing.start < new.end (cheap pre-filter; exact end check below)
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    include: { room: true },
    orderBy: { date: "asc" },
  });
  return (
    candidates.find((r) => {
      const range = nightRange(new Date(r.date), r.checkOut ? new Date(r.checkOut) : null);
      return range.end.getTime() > start.getTime(); // existing.end > new.start
    }) ?? null
  );
}

const dmy = (d: Date) => d.toLocaleDateString("ru-RU");

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

router.get("/debtors", requireSuperAdmin, async (req, res, next) => {
  try {
    const branchId = typeof req.query.branchId === "string" && req.query.branchId ? req.query.branchId : undefined;
    const reports = await prisma.monthlyReport.findMany({
      where: { paymentStatus: { in: ["Частично", "Долг"] }, ...(branchId ? { branchId } : {}) },
      orderBy: { date: "desc" },
      include: { branch: true, admin: true, room: true, source: true },
    });

    const items = reports
      .map((r) => ({ ...r, debt: r.price - (r.paidAmount ?? r.price) }))
      .filter((r) => r.debt > 0);

    const totalDebt = items.reduce((sum, r) => sum + r.debt, 0);

    const byBranch: Record<string, { name: string; total: number; count: number }> = {};
    for (const r of items) {
      byBranch[r.branchId] ??= { name: r.branch.name, total: 0, count: 0 };
      byBranch[r.branchId].total += r.debt;
      byBranch[r.branchId].count += 1;
    }

    res.json({ items, totalDebt, byBranch: Object.values(byBranch).sort((a, b) => b.total - a.total) });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/settle", requireSuperAdmin, async (req, res, next) => {
  try {
    const existing = await prisma.monthlyReport.findUnique({
      where: { id: req.params.id },
      include: { room: true },
    });
    if (!existing) {
      return res.status(404).json({ message: "Запись не найдена" });
    }

    const report = await prisma.monthlyReport.update({
      where: { id: req.params.id },
      data: { paymentStatus: "Оплачено", paidAmount: null },
      include: { branch: true, admin: true, room: true, source: true },
    });

    await recordAudit(req, {
      action: "UPDATE",
      entity: "report",
      entityId: report.id,
      summary: `Погасил долг по отчёту — ${money(existing.price)} ${existing.currency}, номер ${existing.room.roomNumber}`,
      changes: [{ field: "paymentStatus", label: "Статус оплаты", from: existing.paymentStatus, to: "Оплачено" }],
    });

    res.json(report);
  } catch (err) {
    next(err);
  }
});

function canManage(req: any, existing: { adminId: string }) {
  return req.user!.role !== "ADMIN" || existing.adminId === req.user!.adminId;
}

router.patch("/:id/status", async (req, res, next) => {
  try {
    const existing = await prisma.monthlyReport.findUnique({ where: { id: req.params.id }, include: { room: true } });
    if (!existing) return res.status(404).json({ message: "Запись не найдена" });
    if (!canManage(req, existing)) return res.status(403).json({ message: "Недостаточно прав" });

    const status = String(req.body.status);
    if (!STATUS_LABELS[status]) return res.status(400).json({ message: "Неизвестный статус" });

    const report = await prisma.monthlyReport.update({
      where: { id: req.params.id },
      data: { status },
      include: { branch: true, admin: true, room: true, source: true },
    });

    await recordAudit(req, {
      action: "UPDATE",
      entity: "report",
      entityId: report.id,
      summary: `Статус брони изменён: ${STATUS_LABELS[existing.status] ?? existing.status} → ${STATUS_LABELS[status]} — номер ${existing.room.roomNumber}`,
      changes: [{ field: "status", label: "Статус", from: existing.status, to: status }],
    });

    res.json(report);
  } catch (err) {
    next(err);
  }
});

router.post("/bulk", async (req, res, next) => {
  try {
    const ids: string[] = Array.isArray(req.body.ids) ? req.body.ids.map(String) : [];
    const action = String(req.body.action);
    if (ids.length === 0) return res.status(400).json({ message: "Не выбраны записи" });

    const existing = await prisma.monthlyReport.findMany({ where: { id: { in: ids } }, include: { room: true } });
    const allowed = existing.filter((r) => canManage(req, r));
    if (allowed.length === 0) return res.status(403).json({ message: "Недостаточно прав" });
    const allowedIds = allowed.map((r) => r.id);

    if (action === "DELETE") {
      await prisma.monthlyReport.deleteMany({ where: { id: { in: allowedIds } } });
      await recordAudit(req, {
        action: "DELETE",
        entity: "report",
        entityId: null,
        summary: `Массовое удаление: ${allowed.length} бронирований`,
      });
      return res.json({ count: allowed.length });
    }

    if (action === "MOVE_ROOM") {
      const roomId = String(req.body.roomId ?? "");
      if (!roomId) return res.status(400).json({ message: "Укажите номер" });
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (!room) return res.status(404).json({ message: "Номер не найден" });
      await prisma.monthlyReport.updateMany({ where: { id: { in: allowedIds } }, data: { roomId } });
      await recordAudit(req, {
        action: "UPDATE",
        entity: "report",
        entityId: null,
        summary: `Массовый перенос ${allowed.length} бронирований в номер ${room.roomNumber}`,
      });
      return res.json({ count: allowed.length });
    }

    const statusByAction: Record<string, string> = {
      CHECK_IN: "CHECKED_IN",
      CHECK_OUT: "CHECKED_OUT",
      CANCEL: "CANCELLED",
      NO_SHOW: "NO_SHOW",
    };
    const status = statusByAction[action];
    if (!status) return res.status(400).json({ message: "Неизвестное действие" });

    await prisma.monthlyReport.updateMany({ where: { id: { in: allowedIds } }, data: { status } });
    await recordAudit(req, {
      action: "UPDATE",
      entity: "report",
      entityId: null,
      summary: `Массовое изменение статуса (${STATUS_LABELS[status]}): ${allowed.length} бронирований`,
    });
    res.json({ count: allowed.length });
  } catch (err) {
    next(err);
  }
});

router.get("/calendar", async (req, res, next) => {
  try {
    const isAdmin = req.user!.role === "ADMIN";
    const branchId = isAdmin
      ? req.user!.branchId ?? ""
      : typeof req.query.branchId === "string"
        ? req.query.branchId
        : "";
    if (!branchId) {
      return res.status(400).json({ message: "Укажите филиал" });
    }

    const from = new Date(String(req.query.from));
    const to = new Date(String(req.query.to));
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return res.status(400).json({ message: "Укажите корректный период" });
    }
    from.setHours(0, 0, 0, 0);
    to.setHours(0, 0, 0, 0);
    const toExclusive = new Date(to.getTime() + DAY_MS);
    // Bookings can start up to ~31 days before the window and still overlap it.
    const windowStart = new Date(from.getTime() - 31 * DAY_MS);

    const [rooms, candidates] = await Promise.all([
      prisma.room.findMany({ where: { branchId }, orderBy: { createdAt: "asc" } }),
      prisma.monthlyReport.findMany({
        where: { branchId, date: { gte: windowStart, lt: toExclusive } },
        include: { room: true, admin: true, source: true },
        orderBy: { date: "asc" },
      }),
    ]);

    const bookings = candidates.filter((r) => {
      const start = new Date(r.date);
      const end = r.checkOut ? new Date(r.checkOut) : new Date(start.getTime() + DAY_MS);
      return start < toExclusive && end > from;
    });

    res.json({ rooms, bookings });
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

    const { start, end } = nightRange(new Date(data.date), data.checkOut ? new Date(data.checkOut) : null);
    const conflict = await findRoomConflict(data.roomId, start, end, null);
    if (conflict) {
      return res.status(409).json({
        message: `Номер ${conflict.room.roomNumber} уже занят на эти даты (${dmy(new Date(conflict.date))}${
          conflict.checkOut ? `–${dmy(new Date(conflict.checkOut))}` : ""
        }${conflict.guestName ? `, ${conflict.guestName}` : ""}). Выберите другой номер или даты.`,
      });
    }

    const report = await prisma.monthlyReport.create({
      data: {
        ...data,
        date: new Date(data.date),
        checkOut: data.checkOut ? new Date(data.checkOut) : null,
        paidAmount: normalizePaid(data),
      },
      include: { branch: true, admin: true, room: true, source: true },
    });
    await recordAudit(req, {
      action: "CREATE",
      entity: "report",
      entityId: report.id,
      summary: summarize("CREATE", "report", [], `${money(report.price)} ${report.currency}, номер ${report.room.roomNumber}`),
    });
    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const existing = await prisma.monthlyReport.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ message: "Запись не найдена" });
    }
    if (req.user!.role === "ADMIN" && existing.adminId !== req.user!.adminId) {
      return res.status(403).json({ message: "Недостаточно прав для изменения этого отчёта" });
    }

    const body = { ...req.body };
    if (req.user!.role === "ADMIN") {
      body.adminId = req.user!.adminId;
      body.branchId = req.user!.branchId;
    }

    const data = reportSchema.parse(body);

    const { start, end } = nightRange(new Date(data.date), data.checkOut ? new Date(data.checkOut) : null);
    const conflict = await findRoomConflict(data.roomId, start, end, req.params.id);
    if (conflict) {
      return res.status(409).json({
        message: `Номер ${conflict.room.roomNumber} уже занят на эти даты (${dmy(new Date(conflict.date))}${
          conflict.checkOut ? `–${dmy(new Date(conflict.checkOut))}` : ""
        }${conflict.guestName ? `, ${conflict.guestName}` : ""}). Выберите другой номер или даты.`,
      });
    }

    const report = await prisma.monthlyReport.update({
      where: { id: req.params.id },
      data: {
        ...data,
        date: new Date(data.date),
        checkOut: data.checkOut ? new Date(data.checkOut) : null,
        paidAmount: normalizePaid(data),
      },
      include: { branch: true, admin: true, room: true, source: true },
    });

    const changes = buildChanges(
      existing as unknown as Record<string, unknown>,
      report as unknown as Record<string, unknown>,
      REPORT_AUDIT_FIELDS
    );
    if (changes.length) {
      await recordAudit(req, {
        action: "UPDATE",
        entity: "report",
        entityId: report.id,
        summary: summarize("UPDATE", "report", changes),
        changes,
      });
    }
    res.json(report);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const existing = await prisma.monthlyReport.findUnique({
      where: { id: req.params.id },
      include: { room: true },
    });
    if (!existing) {
      return res.status(404).json({ message: "Запись не найдена" });
    }
    if (req.user!.role === "ADMIN" && existing.adminId !== req.user!.adminId) {
      return res.status(403).json({ message: "Недостаточно прав для удаления этого отчёта" });
    }

    await prisma.monthlyReport.delete({ where: { id: req.params.id } });
    await recordAudit(req, {
      action: "DELETE",
      entity: "report",
      entityId: existing.id,
      summary: summarize("DELETE", "report", [], `${money(existing.price)} ${existing.currency}, номер ${existing.room.roomNumber}`),
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
