import { Router } from "express";
import { prisma } from "../prisma";
import { roomSchema } from "../validation";
import { requireSuperAdmin, allowedBranchIds } from "../middleware/auth";
import { recordAudit, buildChanges, summarize } from "../audit";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const where = req.user!.role === "ADMIN" ? { branchId: { in: allowedBranchIds(req.user!) } } : {};
    const rooms = await prisma.room.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { branch: true },
    });
    res.json(rooms);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireSuperAdmin, async (req, res, next) => {
  try {
    const data = roomSchema.parse(req.body);
    const room = await prisma.room.create({ data, include: { branch: true } });
    await recordAudit(req, {
      action: "CREATE",
      entity: "room",
      entityId: room.id,
      summary: summarize("CREATE", "room", [], `${room.roomNumber} (${room.branch.name})`),
    });
    res.status(201).json(room);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireSuperAdmin, async (req, res, next) => {
  try {
    const existing = await prisma.room.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ message: "Запись не найдена" });
    }
    const data = roomSchema.parse(req.body);
    const room = await prisma.room.update({
      where: { id: req.params.id },
      data,
      include: { branch: true },
    });
    const changes = buildChanges(existing, room, ["roomNumber", "type"]);
    if (changes.length) {
      await recordAudit(req, {
        action: "UPDATE",
        entity: "room",
        entityId: room.id,
        summary: summarize("UPDATE", "room", changes),
        changes,
      });
    }
    res.json(room);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireSuperAdmin, async (req, res, next) => {
  try {
    const existing = await prisma.room.findUnique({ where: { id: req.params.id } });
    await prisma.room.delete({ where: { id: req.params.id } });
    await recordAudit(req, {
      action: "DELETE",
      entity: "room",
      entityId: req.params.id,
      summary: summarize("DELETE", "room", [], existing?.roomNumber),
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
