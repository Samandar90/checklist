import { describe, it, expect } from "vitest";
import { activeBlockWhere, blockIsActive, blockRange, describeBlock, isRoomBlockKind } from "./roomBlocks";

const d = (iso: string) => new Date(iso);
const now = d("2026-09-19T12:00:00");

describe("blockIsActive (a hold releases itself, the other kinds never do)", () => {
  it("keeps a hold while holdUntil is in the future", () => {
    expect(blockIsActive({ kind: "HOLD", holdUntil: d("2026-09-19T12:00:01") }, now)).toBe(true);
  });

  it("drops a hold the moment holdUntil passes", () => {
    expect(blockIsActive({ kind: "HOLD", holdUntil: d("2026-09-19T12:00:00") }, now)).toBe(false);
    expect(blockIsActive({ kind: "HOLD", holdUntil: d("2026-09-01T00:00:00") }, now)).toBe(false);
  });

  it("treats a hold without a deadline as still active", () => {
    expect(blockIsActive({ kind: "HOLD", holdUntil: null }, now)).toBe(true);
  });

  it("never expires blocked dates or an out-of-order room, even with a stale holdUntil", () => {
    expect(blockIsActive({ kind: "BLOCK", holdUntil: d("2020-01-01") }, now)).toBe(true);
    expect(blockIsActive({ kind: "OUT_OF_ORDER", holdUntil: null }, now)).toBe(true);
  });

  it("activeBlockWhere mirrors the same rule for the database", () => {
    expect(activeBlockWhere(now)).toEqual({
      OR: [{ kind: { not: "HOLD" } }, { holdUntil: null }, { holdUntil: { gt: now } }],
    });
  });
});

describe("blockRange", () => {
  it("closes the half-open range [startDate, endDate) in whole nights", () => {
    const r = blockRange({ startDate: d("2026-09-21T09:30:00"), endDate: d("2026-09-23T00:00:00") });
    expect(r.start.getDate()).toBe(21);
    expect(r.end.getDate()).toBe(23);
  });

  it("falls back to one night when the end is not after the start", () => {
    const r = blockRange({ startDate: d("2026-09-21T00:00:00"), endDate: d("2026-09-21T00:00:00") });
    expect(r.end.getTime() - r.start.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

describe("isRoomBlockKind / describeBlock", () => {
  it("accepts only the three kinds", () => {
    expect(isRoomBlockKind("HOLD")).toBe(true);
    expect(isRoomBlockKind("OUT_OF_ORDER")).toBe(true);
    expect(isRoomBlockKind("constructor")).toBe(false);
    expect(isRoomBlockKind(undefined)).toBe(false);
  });

  it("names the block and the guest it is held for", () => {
    expect(describeBlock({ kind: "HOLD", guestName: "Иванов" })).toBe("временное хранение, Иванов");
    expect(describeBlock({ kind: "OUT_OF_ORDER" })).toBe("номер не работает");
    expect(describeBlock({ kind: "BLOCK", guestName: null })).toBe("даты заблокированы");
  });
});
