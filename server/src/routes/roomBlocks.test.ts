import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Блокировки номера (хранение / закрытые даты / номер не работает) проверяются
 * без базы: роутер вызывается напрямую, prisma и журнал подменены. Закреплено
 * главное — блокировка проходит ту же проверку пересечений, что и бронь
 * (и с бронями, и с другими активными блокировками), хранение не принимается с
 * истёкшим сроком, а чужой филиал для администратора закрыт.
 */

const roomFindUnique = vi.fn();
const blockFindMany = vi.fn();
const blockFindUnique = vi.fn();
const blockCreate = vi.fn();
const blockDelete = vi.fn();
const blockDeleteMany = vi.fn();
const reportFindMany = vi.fn();
vi.mock("../prisma", () => ({
  prisma: {
    room: { findUnique: (...args: any[]) => roomFindUnique(...args) },
    roomBlock: {
      findMany: (...args: any[]) => blockFindMany(...args),
      findUnique: (...args: any[]) => blockFindUnique(...args),
      create: (...args: any[]) => blockCreate(...args),
      delete: (...args: any[]) => blockDelete(...args),
      deleteMany: (...args: any[]) => blockDeleteMany(...args),
    },
    monthlyReport: { findMany: (...args: any[]) => reportFindMany(...args) },
  },
}));

const recordAudit = vi.fn();
vi.mock("../audit", async () => {
  const actual = await vi.importActual<typeof import("../audit")>("../audit");
  return { ...actual, recordAudit: (...args: any[]) => recordAudit(...args) };
});

const router = (await import("./roomBlocks")).default;

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
    res.send = (body?: any) => {
      resolve({ status: res.statusCode, body: body ?? null });
      return res;
    };
    (router as any)(req, res, (err: any) => (err ? reject(err) : resolve({ status: 404, body: null })));
  });
}

const admin = { sub: "u1", role: "ADMIN", adminId: "a1", branchId: "b1" };
const room = { id: "r1", roomNumber: "12", type: "DBL", branchId: "b1" };

const postReq = (body: any, user: any = admin) => ({
  method: "POST",
  url: "/",
  originalUrl: "/api/room-blocks",
  headers: {},
  params: {},
  body,
  user,
});

const deleteReq = (id: string, user: any = admin) => ({
  method: "DELETE",
  url: `/${id}`,
  originalUrl: `/api/room-blocks/${id}`,
  headers: {},
  params: {},
  body: {},
  user,
});

const block = { branchId: "b1", roomId: "r1", kind: "BLOCK", startDate: "2026-09-21", endDate: "2026-09-23" };
const inAnHour = () => new Date(Date.now() + 60 * 60 * 1000);

beforeEach(() => {
  for (const fn of [roomFindUnique, blockFindMany, blockFindUnique, blockCreate, blockDelete, blockDeleteMany, reportFindMany, recordAudit]) {
    fn.mockReset();
  }
  roomFindUnique.mockResolvedValue(room);
  reportFindMany.mockResolvedValue([]);
  blockFindMany.mockResolvedValue([]);
  blockDeleteMany.mockResolvedValue({ count: 0 });
  blockCreate.mockImplementation(async ({ data }: any) => ({ id: "blk1", ...data, room, createdBy: null }));
  recordAudit.mockResolvedValue(undefined);
});

describe("POST /room-blocks", () => {
  it("закрывает свободный номер на выбранные ночи и пишет журнал", async () => {
    const result = await invoke(postReq(block));

    expect(result.status).toBe(201);
    expect(blockCreate).toHaveBeenCalledTimes(1);
    const data = blockCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({ branchId: "b1", roomId: "r1", kind: "BLOCK", guestName: null, holdUntil: null, createdByAdminId: "a1" });
    expect(data.startDate).toBeInstanceOf(Date);
    expect(data.endDate.getTime() - data.startDate.getTime()).toBe(2 * 24 * 60 * 60 * 1000);
    expect(recordAudit).toHaveBeenCalledTimes(1);
    expect(recordAudit.mock.calls[0][1]).toMatchObject({ action: "CREATE", entity: "roomBlock", entityId: "blk1" });
  });

  it("отвечает 409, если на эти ночи уже есть бронь", async () => {
    reportFindMany.mockResolvedValue([
      { id: "m1", roomId: "r1", status: "RESERVED", date: new Date("2026-09-22T00:00:00"), checkOut: new Date("2026-09-24T00:00:00"), guestName: "Иванов", room },
    ]);

    const result = await invoke(postReq(block));

    expect(result.status).toBe(409);
    expect(result.body.message).toContain("уже занят");
    expect(result.body.message).toContain("Иванов");
    expect(blockCreate).not.toHaveBeenCalled();
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("отвечает 409, если ночи уже закрыты другой блокировкой", async () => {
    blockFindMany.mockResolvedValue([
      { id: "blk0", roomId: "r1", kind: "HOLD", startDate: new Date("2026-09-20T00:00:00"), endDate: new Date("2026-09-22T00:00:00"), guestName: "Петров", holdUntil: inAnHour(), room },
    ]);

    const result = await invoke(postReq(block));

    expect(result.status).toBe(409);
    expect(result.body.message).toContain("закрыт");
    expect(result.body.message).toContain("временное хранение, Петров");
    expect(blockCreate).not.toHaveBeenCalled();
  });

  it("не принимает хранение с уже истёкшим сроком", async () => {
    const result = await invoke(postReq({ ...block, kind: "HOLD", holdUntil: "2020-01-01T10:00:00Z" }));

    expect(result.status).toBe(400);
    expect(blockFindMany).not.toHaveBeenCalled();
    expect(blockCreate).not.toHaveBeenCalled();
  });

  it("хранение запоминает гостя и срок; у остальных видов их нет", async () => {
    const until = inAnHour();
    const result = await invoke(postReq({ ...block, kind: "HOLD", guestName: "  Сидоров ", holdUntil: until.toISOString() }));

    expect(result.status).toBe(201);
    const data = blockCreate.mock.calls[0][0].data;
    expect(data.guestName).toBe("Сидоров");
    expect(data.holdUntil.getTime()).toBe(until.getTime());
  });

  it("администратор не может закрыть номер чужого филиала — филиал берётся из его доступа", async () => {
    roomFindUnique.mockResolvedValue({ ...room, id: "r2", branchId: "b2" });

    const result = await invoke(postReq({ ...block, roomId: "r2", branchId: "b2" }));

    expect(result.status).toBe(400);
    expect(blockCreate).not.toHaveBeenCalled();
  });

  it("отклоняет окончание не позже начала ещё на валидации", async () => {
    await expect(invoke(postReq({ ...block, endDate: "2026-09-21" }))).rejects.toMatchObject({ name: "ZodError" });
    expect(blockCreate).not.toHaveBeenCalled();
  });
});

describe("DELETE /room-blocks/:id", () => {
  const existing = { id: "blk1", branchId: "b1", roomId: "r1", kind: "OUT_OF_ORDER", startDate: new Date("2026-09-21T00:00:00"), endDate: new Date("2026-09-23T00:00:00"), guestName: null, holdUntil: null, room };

  it("снимает блокировку своего филиала и пишет журнал", async () => {
    blockFindUnique.mockResolvedValue(existing);
    blockDelete.mockResolvedValue(existing);

    const result = await invoke(deleteReq("blk1"));

    expect(result.status).toBe(204);
    expect(blockDelete).toHaveBeenCalledWith({ where: { id: "blk1" } });
    expect(recordAudit.mock.calls[0][1]).toMatchObject({ action: "DELETE", entity: "roomBlock", entityId: "blk1" });
    expect(recordAudit.mock.calls[0][1].summary).toContain("номер не работает");
  });

  it("отвечает 403 администратору чужого филиала и 404, если блокировки нет", async () => {
    blockFindUnique.mockResolvedValue({ ...existing, branchId: "b2" });
    expect((await invoke(deleteReq("blk1"))).status).toBe(403);

    blockFindUnique.mockResolvedValue(null);
    expect((await invoke(deleteReq("nope"))).status).toBe(404);

    expect(blockDelete).not.toHaveBeenCalled();
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("главный аккаунт снимает блокировку любого филиала", async () => {
    blockFindUnique.mockResolvedValue({ ...existing, branchId: "b2" });
    blockDelete.mockResolvedValue(existing);

    const result = await invoke(deleteReq("blk1", { sub: "u0", role: "SUPER_ADMIN", adminId: null, branchId: null }));

    expect(result.status).toBe(204);
  });
});
