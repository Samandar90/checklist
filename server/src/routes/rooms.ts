import { Router } from "express";
import { prisma } from "../prisma";
import { roomSchema } from "../validation";
import { requireSuperAdmin } from "../middleware/auth";
import { recordAudit, buildChanges, summarize } from "../audit";
import { findRoomNumberClash } from "../lib/rooms";

const router = Router();

/**
 * A branch must not hold two rooms with the same number.
 *
 * Without this, "101" could be added twice and the chessboard showed two rows
 * for one physical door. Worse, the double-booking guard keys on roomId: two
 * guests booked into the two copies of 101 for the same night never conflicted,
 * so the invariant that protects the calendar was silently bypassed.
 *
 * SQLite can't take a @@unique([branchId, roomNumber]) retroactively without a
 * migration that would fail on any existing duplicate — and a failed migration
 * on boot takes the deployment down — so the rule is enforced here.
 */
async function roomNumberTaken(branchId: string, roomNumber: string, ignoreId?: string) {
  const siblings = await prisma.room.findMany({
    where: { branchId },
    select: { id: true, roomNumber: true },
  });
  return findRoomNumberClash(siblings, roomNumber, ignoreId);
}

router.get("/", async (req, res, next) => {
  try {
    // A multi-branch admin sees rooms across every branch they're assigned to,
    // not just their primary one — the client filters down to the active branch.
    const allowedBranchIds =
      req.user!.branchIds && req.user!.branchIds.length
        ? req.user!.branchIds
        : req.user!.branchId
          ? [req.user!.branchId]
          : [];
    const where = req.user!.role === "ADMIN" ? { branchId: { in: allowedBranchIds } } : {};
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
    const clash = await roomNumberTaken(data.branchId, data.roomNumber);
    if (clash) {
      return res.status(409).json({ message: `Номер ${clash.roomNumber} уже есть в этом филиале` });
    }
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
    const clash = await roomNumberTaken(data.branchId, data.roomNumber, req.params.id);
    if (clash) {
      return res.status(409).json({ message: `Номер ${clash.roomNumber} уже есть в этом филиале` });
    }
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
