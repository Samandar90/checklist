import { Router } from "express";
import { prisma } from "../prisma";
import { requireSuperAdmin } from "../middleware/auth";

const router = Router();
router.use(requireSuperAdmin);

const DAY_MS = 24 * 60 * 60 * 1000;

router.get("/", async (req, res, next) => {
  try {
    const where: any = {};
    if (typeof req.query.entity === "string" && req.query.entity) where.entity = req.query.entity;
    if (typeof req.query.action === "string" && req.query.action) where.action = req.query.action;
    if (typeof req.query.entityId === "string" && req.query.entityId) where.entityId = req.query.entityId;

    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    if (from && !Number.isNaN(from.getTime())) {
      from.setHours(0, 0, 0, 0);
      where.createdAt = { ...(where.createdAt ?? {}), gte: from };
    }
    if (to && !Number.isNaN(to.getTime())) {
      to.setHours(0, 0, 0, 0);
      where.createdAt = { ...(where.createdAt ?? {}), lt: new Date(to.getTime() + DAY_MS) };
    }

    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const pageSize = 20;

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ items, total, page, pageSize });
  } catch (err) {
    next(err);
  }
});

export default router;
