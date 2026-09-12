import { describe, expect, it } from "vitest";
import { findRoomNumberClash, sameRoomNumber } from "./rooms";

/**
 * One physical door must map to exactly one Room row inside a branch: the
 * double-booking guard keys on roomId, so a duplicated number would let two
 * guests take the same room for the same night without ever conflicting.
 */

const rooms = [
  { id: "r1", roomNumber: "101" },
  { id: "r2", roomNumber: "102" },
  { id: "r3", roomNumber: "Lux-1" },
];

describe("sameRoomNumber", () => {
  it("treats surrounding whitespace as noise", () => {
    expect(sameRoomNumber("101", " 101 ")).toBe(true);
  });

  it("ignores case", () => {
    expect(sameRoomNumber("Lux-1", "lux-1")).toBe(true);
  });

  it("keeps genuinely different numbers apart", () => {
    expect(sameRoomNumber("101", "1011")).toBe(false);
    expect(sameRoomNumber("101", "102")).toBe(false);
  });
});

describe("findRoomNumberClash", () => {
  it("finds the room already holding the number", () => {
    expect(findRoomNumberClash(rooms, "102")?.id).toBe("r2");
  });

  it("catches a duplicate typed with different spacing or case", () => {
    expect(findRoomNumberClash(rooms, " 101")?.id).toBe("r1");
    expect(findRoomNumberClash(rooms, "LUX-1")?.id).toBe("r3");
  });

  it("allows a free number", () => {
    expect(findRoomNumberClash(rooms, "205")).toBeUndefined();
  });

  it("does not let a room clash with itself when edited", () => {
    expect(findRoomNumberClash(rooms, "101", "r1")).toBeUndefined();
  });

  it("still blocks an edit onto another room's number", () => {
    expect(findRoomNumberClash(rooms, "102", "r1")?.id).toBe("r2");
  });

  it("accepts any number in an empty branch", () => {
    expect(findRoomNumberClash([], "101")).toBeUndefined();
  });
});
