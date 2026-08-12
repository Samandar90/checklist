import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Маршруты /api/auth проверяются без базы и без поднятого сервера: Express-роутер
 * сам по себе — обычная middleware-функция, поэтому его можно вызвать напрямую,
 * подменив prisma, хеширование и журнал аудита.
 *
 * Главное, что здесь закреплено: смена СВОЕГО пароля доступна администратору
 * филиала. Раньше маршрут был закрыт requireSuperAdmin — админ получал 403,
 * хотя кнопка «Сменить пароль» показана всем. Мок middleware ниже сохраняет
 * настоящее поведение requireSuperAdmin, так что если проверку вернут в цепочку,
 * первый же тест снова покажет 403 и упадёт.
 */

const findUnique = vi.fn();
const update = vi.fn();
vi.mock("../prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: any[]) => findUnique(...args),
      update: (...args: any[]) => update(...args),
    },
  },
}));

const comparePassword = vi.fn();
vi.mock("../auth", () => ({
  comparePassword: (...args: any[]) => comparePassword(...args),
  hashPassword: async (password: string) => `hashed:${password}`,
  signToken: () => "token",
}));

const recordAudit = vi.fn();
vi.mock("../audit", () => ({ recordAudit: (...args: any[]) => recordAudit(...args) }));

vi.mock("../middleware/auth", () => ({
  authenticate: (_req: any, _res: any, next: any) => next(),
  requireSuperAdmin: (req: any, res: any, next: any) => {
    if (req.user?.role !== "SUPER_ADMIN") return res.status(403).json({ message: "Недостаточно прав" });
    next();
  },
}));

const router = (await import("./auth")).default;

interface Invocation {
  status: number;
  body: any;
}

/** Прогнать запрос через роутер и дождаться ответа (или ошибки, ушедшей в next). */
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

const changePasswordReq = (user: any, body: any) => ({
  method: "POST",
  url: "/change-password",
  originalUrl: "/api/auth/change-password",
  headers: {},
  body,
  user,
});

const admin = { sub: "u1", role: "ADMIN", adminId: "a1", branchId: "b1" };

beforeEach(() => {
  findUnique.mockReset();
  update.mockReset();
  comparePassword.mockReset();
  recordAudit.mockReset();
  recordAudit.mockResolvedValue(undefined);
});

describe("POST /auth/change-password", () => {
  it("позволяет администратору филиала сменить собственный пароль", async () => {
    findUnique.mockResolvedValue({ id: "u1", username: "admin1", passwordHash: "old" });
    comparePassword.mockResolvedValue(true);
    update.mockResolvedValue({});

    const result = await invoke(changePasswordReq(admin, { currentPassword: "oldpass", newPassword: "newpass" }));

    expect(result.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { passwordHash: "hashed:newpass" },
    });
  });

  it("меняет пароль только вызывающему, кем бы он ни представился в теле запроса", async () => {
    findUnique.mockResolvedValue({ id: "u1", username: "admin1", passwordHash: "old" });
    comparePassword.mockResolvedValue(true);
    update.mockResolvedValue({});

    await invoke(
      changePasswordReq(admin, { currentPassword: "oldpass", newPassword: "newpass", userId: "u2", username: "boss" })
    );

    expect(findUnique).toHaveBeenCalledWith({ where: { id: "u1" } });
    expect(update.mock.calls[0][0].where).toEqual({ id: "u1" });
  });

  it("отклоняет неверный текущий пароль и ничего не меняет", async () => {
    findUnique.mockResolvedValue({ id: "u1", username: "admin1", passwordHash: "old" });
    comparePassword.mockResolvedValue(false);

    const result = await invoke(changePasswordReq(admin, { currentPassword: "wrong", newPassword: "newpass" }));

    expect(result.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("пишет смену пароля в журнал аудита", async () => {
    findUnique.mockResolvedValue({ id: "u1", username: "admin1", passwordHash: "old" });
    comparePassword.mockResolvedValue(true);
    update.mockResolvedValue({});

    await invoke(changePasswordReq(admin, { currentPassword: "oldpass", newPassword: "newpass" }));

    expect(recordAudit).toHaveBeenCalledOnce();
    const entry = recordAudit.mock.calls[0][1];
    expect(entry).toMatchObject({ action: "UPDATE", entity: "user", entityId: "u1" });
    // Пароли в журнал попадать не должны — ни старый, ни новый.
    expect(JSON.stringify(entry)).not.toContain("newpass");
    expect(JSON.stringify(entry)).not.toContain("oldpass");
  });
});
