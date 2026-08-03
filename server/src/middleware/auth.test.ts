import { describe, it, expect, vi, beforeEach } from "vitest";

// The middleware talks to the DB only to re-check the admin; stub that away so
// the authorization rules can be tested without SQLite or Express running.
const findUnique = vi.fn();
vi.mock("../prisma", () => ({ prisma: { admin: { findUnique: (...args: any[]) => findUnique(...args) } } }));

const verifyToken = vi.fn();
vi.mock("../auth", () => ({ verifyToken: (token: string) => verifyToken(token) }));

const { authenticate, requireSuperAdmin } = await import("./auth");

function makeRes() {
  const res: any = { statusCode: 0, body: null };
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body: any) => {
    res.body = body;
    return res;
  };
  return res;
}

const req = (payload: any) => ({ headers: { authorization: "Bearer t" }, user: undefined }) as any;

beforeEach(() => {
  findUnique.mockReset();
  verifyToken.mockReset();
});

describe("authenticate", () => {
  it("rejects a request without a Bearer header", async () => {
    const res = makeRes();
    const next = vi.fn();
    await authenticate({ headers: {} } as any, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects an unverifiable token", async () => {
    verifyToken.mockImplementation(() => {
      throw new Error("bad token");
    });
    const res = makeRes();
    const next = vi.fn();
    await authenticate(req(null), res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("revokes a still-valid token once the admin has been deleted", async () => {
    // The dismissed employee's JWT stays cryptographically valid for 7 days;
    // only the missing Admin row tells us the account is gone.
    verifyToken.mockReturnValue({ sub: "u1", role: "ADMIN", adminId: "a1", branchId: "b1", branchIds: ["b1"] });
    findUnique.mockResolvedValue(null);

    const res = makeRes();
    const next = vi.fn();
    await authenticate(req(null), res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects an ADMIN token that carries no adminId", async () => {
    verifyToken.mockReturnValue({ sub: "u1", role: "ADMIN", adminId: null, branchId: null });
    const res = makeRes();
    const next = vi.fn();
    await authenticate(req(null), res, next);
    expect(res.statusCode).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("refreshes branch assignments from the DB for a live admin", async () => {
    verifyToken.mockReturnValue({ sub: "u1", role: "ADMIN", adminId: "a1", branchId: "old", branchIds: ["old"] });
    findUnique.mockResolvedValue({ branchId: "b1", branches: [{ id: "b2" }] });

    const r = req(null);
    const res = makeRes();
    const next = vi.fn();
    await authenticate(r, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(r.user.branchId).toBe("b1");
    // The primary branch is always included, even when it is missing from the join table.
    expect(r.user.branchIds).toEqual(["b1", "b2"]);
  });

  it("lets a SUPER_ADMIN through without touching the admin table", async () => {
    verifyToken.mockReturnValue({ sub: "u1", role: "SUPER_ADMIN", adminId: null, branchId: null });
    const res = makeRes();
    const next = vi.fn();
    await authenticate(req(null), res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(findUnique).not.toHaveBeenCalled();
  });
});

describe("requireSuperAdmin", () => {
  it("refuses an ADMIN", () => {
    const res = makeRes();
    const next = vi.fn();
    requireSuperAdmin({ user: { role: "ADMIN" } } as any, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows a SUPER_ADMIN", () => {
    const res = makeRes();
    const next = vi.fn();
    requireSuperAdmin({ user: { role: "SUPER_ADMIN" } } as any, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
