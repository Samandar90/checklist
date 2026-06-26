import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const [totalBranches, totalAdmins, totalRooms, totalReports, revenue] = await Promise.all([
      prisma.branch.count(),
      prisma.admin.count(),
      prisma.room.count(),
      prisma.monthlyReport.count(),
      prisma.monthlyReport.aggregate({ _sum: { price: true } }),
    ]);

    res.json({
      totalBranches,
      totalAdmins,
      totalRooms,
      totalReports,
      totalRevenue: revenue._sum.price ?? 0,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
