import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Единая проверка доступности номера: ночь закрыта либо активной бронью, либо
 * блокировкой. Prisma подменена — проверяем правило пересечения полуоткрытых
 * диапазонов, исключения (своя бронь / своё хранение) и то, что просроченные
 * хранения отфильтровываются уже в запросе.
 */

const reportFindMany = vi.fn();
const blockFindMany = vi.fn();
vi.mock("./prisma", () => ({
  prisma: {
    monthlyReport: { findMany: (...args: any[]) => reportFindMany(...args) },
    roomBlock: { findMany: (...args: any[]) => blockFindMany(...args) },
  },
}));

const { findRoomConflict, busyMessage } = await import("./roomAvailability");

const d = (iso: string) => new Date(iso);
const room = { id: "r1", roomNumber: "12" };
const now = d("2026-09-19T12:00:00");

beforeEach(() => {
  reportFindMany.mockReset();
  blockFindMany.mockReset();
  reportFindMany.mockResolvedValue([]);
  blockFindMany.mockResolvedValue([]);
});

describe("findRoomConflict", () => {
  it("свободно, когда выезд предыдущего гостя совпадает с новым заездом", async () => {
    reportFindMany.mockResolvedValue([
      { id: "m1", date: d("2026-09-19T00:00:00"), checkOut: d("2026-09-21T00:00:00"), guestName: "Иванов", room },
    ]);

    const c = await findRoomConflict("r1", d("2026-09-21T00:00:00"), d("2026-09-23T00:00:00"), {}, now);

    expect(c).toBeNull();
  });

  it("называет гостя, чья бронь занимает хотя бы одну ночь", async () => {
    reportFindMany.mockResolvedValue([
      { id: "m1", date: d("2026-09-20T00:00:00"), checkOut: d("2026-09-22T00:00:00"), guestName: "Иванов", room },
    ]);

    const c = await findRoomConflict("r1", d("2026-09-21T00:00:00"), d("2026-09-23T00:00:00"), {}, now);

    expect(c).toMatchObject({ type: "booking", roomNumber: "12", who: "Иванов" });
    expect(busyMessage(c!, "Стоп.")).toBe("Номер 12 уже занят на эти даты (20.09.2026–22.09.2026, Иванов). Стоп.");
  });

  it("своя бронь и своё хранение исключаются из проверки на уровне запроса", async () => {
    await findRoomConflict("r1", d("2026-09-21T00:00:00"), d("2026-09-23T00:00:00"), { bookingId: "m1", blockId: "blk1" }, now);

    expect(reportFindMany.mock.calls[0][0].where).toMatchObject({ roomId: "r1", id: { not: "m1" } });
    expect(blockFindMany.mock.calls[0][0].where).toMatchObject({ roomId: "r1", id: { not: "blk1" } });
  });

  it("просроченные хранения отсекаются уже в запросе, остальные блокировки — нет", async () => {
    await findRoomConflict("r1", d("2026-09-21T00:00:00"), d("2026-09-23T00:00:00"), {}, now);

    expect(blockFindMany.mock.calls[0][0].where.OR).toEqual([
      { kind: { not: "HOLD" } },
      { holdUntil: null },
      { holdUntil: { gt: now } },
    ]);
  });

  it("блокировка закрывает ночи как бронь и описывается своим видом", async () => {
    blockFindMany.mockResolvedValue([
      { id: "blk1", kind: "OUT_OF_ORDER", startDate: d("2026-09-22T00:00:00"), endDate: d("2026-09-25T00:00:00"), guestName: null, holdUntil: null, room },
    ]);

    const c = await findRoomConflict("r1", d("2026-09-21T00:00:00"), d("2026-09-23T00:00:00"), {}, now);

    expect(c).toMatchObject({ type: "block", who: "номер не работает" });
    expect(busyMessage(c!, "Стоп.")).toBe("Номер 12 закрыт на эти даты (22.09.2026–25.09.2026, номер не работает). Стоп.");
  });

  it("блокировка, кончающаяся утром заезда, не мешает", async () => {
    blockFindMany.mockResolvedValue([
      { id: "blk1", kind: "BLOCK", startDate: d("2026-09-19T00:00:00"), endDate: d("2026-09-21T00:00:00"), guestName: null, holdUntil: null, room },
    ]);

    const c = await findRoomConflict("r1", d("2026-09-21T00:00:00"), d("2026-09-23T00:00:00"), {}, now);

    expect(c).toBeNull();
  });
});
