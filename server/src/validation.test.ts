import { describe, it, expect } from "vitest";
import {
  adminCreateSchema,
  adminUpdateSchema,
  cashShiftCloseSchema,
  cashShiftOpenSchema,
  changePasswordSchema,
  expenseSchema,
  reportSchema,
  roomBlockSchema,
} from "./validation";

/**
 * Schema-level guards for the money- and date-critical inputs. These run before
 * anything reaches Prisma, so a bad payload must fail here with a 400-shaped
 * ZodError rather than blowing up inside the query layer.
 */

const validExpense = {
  date: "2026-07-27",
  category: "Аренда" as const,
  amount: 1500,
  currency: "UZS",
};

describe("expenseSchema", () => {
  it("accepts a well-formed expense", () => {
    expect(expenseSchema.safeParse(validExpense).success).toBe(true);
  });

  it("rejects an unparseable date instead of passing Invalid Date to Prisma", () => {
    const result = expenseSchema.safeParse({ ...validExpense, date: "31.02.2026 не дата" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty date", () => {
    expect(expenseSchema.safeParse({ ...validExpense, date: "" }).success).toBe(false);
  });

  it("rejects a zero or negative amount", () => {
    expect(expenseSchema.safeParse({ ...validExpense, amount: 0 }).success).toBe(false);
    expect(expenseSchema.safeParse({ ...validExpense, amount: -100 }).success).toBe(false);
  });

  it("rejects an unknown category", () => {
    expect(expenseSchema.safeParse({ ...validExpense, category: "Взятка" }).success).toBe(false);
  });
});

const validReport = {
  date: "2026-07-27",
  branchId: "b1",
  adminId: "a1",
  roomId: "r1",
  sourceId: "s1",
  price: 1000,
  currency: "UZS",
  paymentMethod: "Наличные" as const,
};

describe("reportSchema", () => {
  it("accepts a minimal fully-paid booking", () => {
    const result = reportSchema.safeParse(validReport);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.paymentStatus).toBe("Оплачено");
      expect(result.data.status).toBe("RESERVED");
    }
  });

  it("rejects a checkout that is not after check-in", () => {
    expect(reportSchema.safeParse({ ...validReport, checkOut: "2026-07-27" }).success).toBe(false);
    expect(reportSchema.safeParse({ ...validReport, checkOut: "2026-07-26" }).success).toBe(false);
  });

  it("accepts a checkout after check-in", () => {
    expect(reportSchema.safeParse({ ...validReport, checkOut: "2026-07-29" }).success).toBe(true);
  });

  it("requires a partial payment to be above zero and below the price", () => {
    const partial = { ...validReport, paymentStatus: "Частично" as const };
    expect(reportSchema.safeParse(partial).success).toBe(false);
    expect(reportSchema.safeParse({ ...partial, paidAmount: 0 }).success).toBe(false);
    expect(reportSchema.safeParse({ ...partial, paidAmount: 1000 }).success).toBe(false);
    expect(reportSchema.safeParse({ ...partial, paidAmount: 400 }).success).toBe(true);
  });

  it("rejects a non-positive price", () => {
    expect(reportSchema.safeParse({ ...validReport, price: 0 }).success).toBe(false);
  });
});

describe("money fields reject non-finite amounts", () => {
  // JSON.parse("1e400") === Infinity, so this arrives from a plain JSON body.
  const inf = JSON.parse('{"n": 1e400}').n as number;

  it("rejects Infinity in report price and paid amount", () => {
    expect(reportSchema.safeParse({ ...validReport, price: inf }).success).toBe(false);
    expect(
      reportSchema.safeParse({ ...validReport, paymentStatus: "Частично", paidAmount: inf }).success
    ).toBe(false);
  });

  it("rejects Infinity in an expense amount", () => {
    expect(expenseSchema.safeParse({ ...validExpense, amount: inf }).success).toBe(false);
  });

  it("rejects Infinity in cash shift opening and closing amounts", () => {
    expect(cashShiftOpenSchema.safeParse({ openingAmount: inf, currency: "UZS" }).success).toBe(false);
    expect(cashShiftCloseSchema.safeParse({ closingAmount: inf }).success).toBe(false);
    expect(cashShiftOpenSchema.safeParse({ openingAmount: 0, currency: "UZS" }).success).toBe(true);
  });
});

describe("passwords stay within bcrypt's 72-byte limit", () => {
  const admin = { fullName: "Ali", phone: "+998", branchId: "b1", username: "ali" };

  it("accepts 72 ASCII bytes and rejects 73", () => {
    expect(adminCreateSchema.safeParse({ ...admin, password: "a".repeat(72) }).success).toBe(true);
    expect(adminCreateSchema.safeParse({ ...admin, password: "a".repeat(73) }).success).toBe(false);
  });

  it("counts Cyrillic as two bytes per character", () => {
    expect(changePasswordSchema.safeParse({ currentPassword: "x", newPassword: "п".repeat(36) }).success).toBe(true);
    expect(changePasswordSchema.safeParse({ currentPassword: "x", newPassword: "п".repeat(37) }).success).toBe(false);
  });

  it("still lets an admin update keep the password blank", () => {
    expect(adminUpdateSchema.safeParse({ ...admin, password: "" }).success).toBe(true);
  });
});

describe("free-text fields are length-capped", () => {
  const expense = { date: "2026-07-01", category: "Прочее", amount: 1, currency: "UZS" };

  it("rejects an oversized note", () => {
    expect(expenseSchema.safeParse({ ...expense, note: "x".repeat(2000) }).success).toBe(true);
    expect(expenseSchema.safeParse({ ...expense, note: "x".repeat(2001) }).success).toBe(false);
  });

  it("rejects a bogus currency code", () => {
    expect(cashShiftOpenSchema.safeParse({ openingAmount: 0, currency: "X".repeat(11) }).success).toBe(false);
  });
});

describe("roomBlockSchema (hold / blocked dates / out of order)", () => {
  const valid = { branchId: "b1", roomId: "r1", kind: "BLOCK" as const, startDate: "2026-09-21", endDate: "2026-09-22" };

  it("accepts a one-night block", () => {
    expect(roomBlockSchema.parse(valid).kind).toBe("BLOCK");
  });

  it("rejects an end date that is not after the start (a block closes whole nights)", () => {
    expect(() => roomBlockSchema.parse({ ...valid, endDate: "2026-09-21" })).toThrow();
    expect(() => roomBlockSchema.parse({ ...valid, endDate: "2026-09-20" })).toThrow();
  });

  it("rejects an unknown kind and an unparsable date", () => {
    expect(() => roomBlockSchema.parse({ ...valid, kind: "MAINTENANCE" })).toThrow();
    expect(() => roomBlockSchema.parse({ ...valid, startDate: "not-a-date" })).toThrow();
  });

  it("requires a deadline for a hold, but not for the other kinds", () => {
    expect(() => roomBlockSchema.parse({ ...valid, kind: "HOLD" })).toThrow();
    expect(roomBlockSchema.parse({ ...valid, kind: "HOLD", holdUntil: "2026-09-20T18:00" }).holdUntil).toBe("2026-09-20T18:00");
    expect(roomBlockSchema.parse({ ...valid, kind: "OUT_OF_ORDER" }).holdUntil).toBeUndefined();
  });
});
