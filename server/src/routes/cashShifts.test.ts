import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Закрытие смены проверяется без базы: роутер вызывается напрямую, prisma и
 * журнал подменены. Закреплено, что закрытие условное — если к моменту записи
 * смену уже закрыл другой запрос (вторая вкладка, повторная отправка формы),
 * ответ 409, посчитанный факт не перезаписывается и журнал не дублируется.
 */

const shiftFindUnique = vi.fn();
const shiftUpdateMany = vi.fn();
const shiftFindUniqueOrThrow = vi.fn();
vi.mock("../prisma", () => ({
  prisma: {
    cashShift: {
      findUnique: (...args: any[]) => shiftFindUnique(...args),
      updateMany: (...args: any[]) => shiftUpdateMany(...args),
      findUniqueOrThrow: (...args: any[]) => shiftFindUniqueOrThrow(...args),
    },
    monthlyReport: { findMany: async () => [] },
    expense: { findMany: async () => [{ amount: 200 }] },
  },
}));

const recordAudit = vi.fn();
vi.mock("../audit", () => ({ recordAudit: (...args: any[]) => recordAudit(...args) }));

const router = (await import("./cashShifts")).default;

interface Invocation {
  status: number;
  body: any;
}

function invoke(req: any): Promise<Invocation> {
  return new Promise((resolve, reject) => {
    const res: any = { statusCode: 200 };
    res.status = (code: number) => {
      res.statusCode = code;
      return res;
    };
    res.json = (body: any) => {
      resolve({ status: res.statusCode, body });
      return res;
    };
    (router as any)(req, res, (err: any) => (err ? reject(err) : resolve({ status: 404, body: null })));
  });
}

const admin = { sub: "u1", role: "ADMIN", adminId: "a1", branchId: "b1" };
const openShift = {
  id: "s1",
  branchId: "b1",
  adminId: "a1",
  openedAt: new Date("2026-09-16T08:00:00Z"),
  openingAmount: 1000,
  currency: "UZS",
  status: "OPEN",
  notes: null,
};

const closeReq = (body: any) => ({
  method: "PUT",
  url: "/s1/close",
  originalUrl: "/api/cash-shifts/s1/close",
  headers: {},
  params: {},
  body,
  user: admin,
});

beforeEach(() => {
  shiftFindUnique.mockReset();
  shiftUpdateMany.mockReset();
  shiftFindUniqueOrThrow.mockReset();
  recordAudit.mockReset();
  recordAudit.mockResolvedValue(undefined);
});

describe("PUT /cash-shifts/:id/close", () => {
  it("закрывает открытую смену только при условии status OPEN", async () => {
    shiftFindUnique.mockResolvedValue(openShift);
    shiftUpdateMany.mockResolvedValue({ count: 1 });
    shiftFindUniqueOrThrow.mockResolvedValue({ ...openShift, status: "CLOSED", closingAmount: 800, expectedAmount: 800 });

    const result = await invoke(closeReq({ closingAmount: 800 }));

    expect(result.status).toBe(200);
    expect(shiftUpdateMany).toHaveBeenCalledTimes(1);
    const call = shiftUpdateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: "s1", status: "OPEN" });
    expect(call.data).toMatchObject({ status: "CLOSED", closingAmount: 800, expectedAmount: 800 });
    expect(recordAudit).toHaveBeenCalledTimes(1);
  });

  it("отвечает 409 и не пишет журнал, если смену успели закрыть параллельно", async () => {
    // Оба запроса прочитали смену как OPEN, но записать успел только первый.
    shiftFindUnique.mockResolvedValue(openShift);
    shiftUpdateMany.mockResolvedValue({ count: 0 });

    const result = await invoke(closeReq({ closingAmount: 500 }));

    expect(result.status).toBe(409);
    expect(shiftFindUniqueOrThrow).not.toHaveBeenCalled();
    expect(recordAudit).not.toHaveBeenCalled();
  });
});
