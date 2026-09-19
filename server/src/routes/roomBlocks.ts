import { Router } from "express";
import { prisma } from "../prisma";
import { roomBlockSchema } from "../validation";
import { recordAudit, buildChanges, summarize } from "../audit";
import { resolveBranchId, hasBranchAccess } from "../branchScope";
import { DAY_MS, nightRange } from "../lib/bookings";
import { ROOM_BLOCK_LABELS, isRoomBlockKind, RoomBlockKind } from "../lib/roomBlocks";
import { findRoomConflict, busyMessage, dmy } from "../roomAvailability";

/**
 * Room blocks — the non-booking reasons a room is closed for sale: a temporary
 * hold for a guest who has not confirmed yet, blocked dates, or an out-of-order
 * room. They hold nights exactly like a booking (see ../roomAvailability) but
 * carry no money, so nothing here touches revenue, debt or the cash register.
 * Any admin assigned to the branch may place or lift a block: it is an
 * operational fact about the room, not a personal record like a booking.
 */
const router = Router();

const BLOCK_AUDIT_FIELDS = ["startDate", "endDate", "guestName", "note", "holdUntil"];
const include = { room: true, createdBy: true } as const;

const describe = (kind: string, roomNumber: string, start: Date, end: Date) =>
  `${isRoomBlockKind(kind) ? ROOM_BLOCK_LABELS[kind] : kind}, номер ${roomNumber}, ${dmy(start)}–${dmy(end)}`;

/**
 * Only a hold carries a guest and a deadline; the other kinds never do. The
 * deadline must still be ahead — a hold that has already expired would close
 * nothing and only confuse whoever looks for it on the board.
 */
function holdFields(kind: RoomBlockKind, data: { guestName?: string | null; holdUntil?: string | null }, now: Date) {
  if (kind !== "HOLD") return { guestName: null, holdUntil: null, error: null };
  const holdUntil = data.holdUntil ? new Date(data.holdUntil) : null;
  if (!holdUntil || holdUntil.getTime() <= now.getTime()) {
    return { guestName: null, holdUntil: null, error: "Срок хранения уже истёк — укажите время в будущем" };
  }
  return { guestName: data.guestName || null, holdUntil, error: null };
}

router.post("/", async (req, res, next) => {
  try {
    const body = { ...req.body };
    if (req.user!.role === "ADMIN") {
      if (!req.user!.branchId) {
        return res.status(403).json({ message: "Ваш аккаунт не привязан к филиалу" });
      }
      body.branchId = resolveBranchId(req.user!, body.branchId);
    }
    const data = roomBlockSchema.parse(body);

    // Same guard as for bookings: a stale room list must not close a room of
    // another branch.
    const room = await prisma.room.findUnique({ where: { id: data.roomId } });
    if (!room || room.branchId !== data.branchId) {
      return res.status(400).json({ message: "Номер не принадлежит выбранному филиалу" });
    }

    const now = new Date();
    const hold = holdFields(data.kind, data, now);
    if (hold.error) return res.status(400).json({ message: hold.error });

    const { start, end } = nightRange(new Date(data.startDate), new Date(data.endDate));
    const conflict = await findRoomConflict(data.roomId, start, end, {}, now);
    if (conflict) {
      return res.status(409).json({ message: busyMessage(conflict, "Закрыть номер на эти даты нельзя.") });
    }

    // Просроченные хранения уже ничего не держат и нигде не показываются —
    // подчищаем их попутно, чтобы таблица не росла без дела.
    await prisma.roomBlock.deleteMany({ where: { kind: "HOLD", holdUntil: { lt: new Date(now.getTime() - DAY_MS) } } });

    const block = await prisma.roomBlock.create({
      data: {
        branchId: data.branchId,
        roomId: data.roomId,
        kind: data.kind,
        startDate: start,
        endDate: end,
        guestName: hold.guestName,
        holdUntil: hold.holdUntil,
        note: data.note || null,
        createdByAdminId: req.user!.role === "ADMIN" ? req.user!.adminId : null,
      },
      include,
    });
    await recordAudit(req, {
      action: "CREATE",
      entity: "roomBlock",
      entityId: block.id,
      summary: summarize("CREATE", "roomBlock", [], describe(block.kind, room.roomNumber, start, end)),
    });
    res.status(201).json(block);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const existing = await prisma.roomBlock.findUnique({ where: { id: req.params.id }, include: { room: true } });
    if (!existing) return res.status(404).json({ message: "Блокировка не найдена" });
    if (!hasBranchAccess(req.user!, existing.branchId)) {
      return res.status(403).json({ message: "Этот филиал вам не назначен" });
    }

    // Branch, room and kind are fixed for the life of a block — to change them
    // staff lift the block and place a new one, which keeps the audit trail honest.
    const data = roomBlockSchema.parse({
      ...req.body,
      branchId: existing.branchId,
      roomId: existing.roomId,
      kind: existing.kind,
    });

    const now = new Date();
    const hold = holdFields(data.kind, data, now);
    if (hold.error) return res.status(400).json({ message: hold.error });

    const { start, end } = nightRange(new Date(data.startDate), new Date(data.endDate));
    const conflict = await findRoomConflict(existing.roomId, start, end, { blockId: existing.id }, now);
    if (conflict) {
      return res.status(409).json({ message: busyMessage(conflict, "Изменить блокировку нельзя.") });
    }

    const block = await prisma.roomBlock.update({
      where: { id: existing.id },
      data: {
        startDate: start,
        endDate: end,
        guestName: hold.guestName,
        holdUntil: hold.holdUntil,
        note: data.note || null,
      },
      include,
    });

    const changes = buildChanges(
      existing as unknown as Record<string, unknown>,
      block as unknown as Record<string, unknown>,
      BLOCK_AUDIT_FIELDS
    );
    if (changes.length) {
      await recordAudit(req, {
        action: "UPDATE",
        entity: "roomBlock",
        entityId: block.id,
        summary: `${summarize("UPDATE", "roomBlock", changes)} — номер ${existing.room.roomNumber}`,
        changes,
      });
    }
    res.json(block);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const existing = await prisma.roomBlock.findUnique({ where: { id: req.params.id }, include: { room: true } });
    if (!existing) return res.status(404).json({ message: "Блокировка не найдена" });
    if (!hasBranchAccess(req.user!, existing.branchId)) {
      return res.status(403).json({ message: "Этот филиал вам не назначен" });
    }

    await prisma.roomBlock.delete({ where: { id: existing.id } });
    await recordAudit(req, {
      action: "DELETE",
      entity: "roomBlock",
      entityId: existing.id,
      summary: summarize(
        "DELETE",
        "roomBlock",
        [],
        describe(existing.kind, existing.room.roomNumber, new Date(existing.startDate), new Date(existing.endDate))
      ),
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
