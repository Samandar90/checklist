import { describe, it, expect } from "vitest";
import { holdsRoom, ROOM_HOLDING_STATUSES } from "./bookingStatus";
import { bookingStatuses } from "@/types";

describe("holdsRoom (revenue / occupancy inclusion)", () => {
  it("reserved, checked-in and checked-out hold the room and count as revenue", () => {
    expect(holdsRoom("RESERVED")).toBe(true);
    expect(holdsRoom("CHECKED_IN")).toBe(true);
    expect(holdsRoom("CHECKED_OUT")).toBe(true);
  });

  it("cancellations and no-shows do NOT hold the room or count as revenue", () => {
    expect(holdsRoom("CANCELLED")).toBe(false);
    expect(holdsRoom("NO_SHOW")).toBe(false);
  });

  it("every known status is classified (no status left undecided)", () => {
    for (const s of bookingStatuses) {
      expect(typeof holdsRoom(s)).toBe("boolean");
    }
    // exactly the three holding statuses
    expect([...ROOM_HOLDING_STATUSES].sort()).toEqual(["CHECKED_IN", "CHECKED_OUT", "RESERVED"]);
  });
});
