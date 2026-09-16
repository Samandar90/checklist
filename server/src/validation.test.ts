import { describe, it, expect } from "vitest";
import { cashShiftCloseSchema, cashShiftOpenSchema, expenseSchema, reportSchema } from "./validation";

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
