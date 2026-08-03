import { describe, it, expect } from "vitest";
import { cashInFromBookings } from "./cash";

const booking = (over: Partial<Parameters<typeof cashInFromBookings>[0][number]> = {}) => ({
  status: "CHECKED_IN",
  paymentStatus: "Оплачено",
  price: 100,
  paidAmount: null,
  ...over,
});

describe("cashInFromBookings", () => {
  it("counts the full price of a paid booking", () => {
    expect(cashInFromBookings([booking()])).toBe(100);
  });

  it("counts only the paid part of a partial payment", () => {
    expect(cashInFromBookings([booking({ paymentStatus: "Частично", paidAmount: 40 })])).toBe(40);
  });

  it("treats a partial payment with no amount as nothing received", () => {
    expect(cashInFromBookings([booking({ paymentStatus: "Частично", paidAmount: null })])).toBe(0);
  });

  it("counts nothing for a booking left on debt", () => {
    expect(cashInFromBookings([booking({ paymentStatus: "Долг" })])).toBe(0);
  });

  it("ignores a cancelled booking even when it is marked paid", () => {
    expect(cashInFromBookings([booking({ status: "CANCELLED" })])).toBe(0);
  });

  it("ignores a no-show booking even when it is marked paid", () => {
    expect(cashInFromBookings([booking({ status: "NO_SHOW" })])).toBe(0);
  });

  it("ignores a cancelled partial payment too", () => {
    expect(cashInFromBookings([booking({ status: "CANCELLED", paymentStatus: "Частично", paidAmount: 40 })])).toBe(0);
  });

  it("counts every status that still holds the room", () => {
    const rooms = ["RESERVED", "CHECKED_IN", "CHECKED_OUT"].map((status) => booking({ status }));
    expect(cashInFromBookings(rooms)).toBe(300);
  });

  it("sums a mixed shift, skipping what never reached the drawer", () => {
    expect(
      cashInFromBookings([
        booking({ price: 250 }), // paid in full
        booking({ paymentStatus: "Частично", paidAmount: 60, price: 200 }), // 60 received
        booking({ paymentStatus: "Долг", price: 300 }), // nothing yet
        booking({ status: "CANCELLED", price: 500 }), // cancelled — no money
      ])
    ).toBe(310);
  });

  it("is zero for an empty shift", () => {
    expect(cashInFromBookings([])).toBe(0);
  });
});
