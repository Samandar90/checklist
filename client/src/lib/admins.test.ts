import { describe, it, expect } from "vitest";
import { worksInBranch, adminsForBranch, adminOptionLabel } from "./admins";
import { Admin } from "@/types";

const mk = (over: Partial<Admin> & { id: string; fullName: string; branchId: string }): Admin => ({
  phone: "",
  createdAt: "",
  ...over,
});

const A = "branch-a";
const B = "branch-b";

const petr = mk({ id: "1", fullName: "Пётр", branchId: A, branch: { id: A, name: "Kamilovs", createdAt: "" } });
const john = mk({ id: "2", fullName: "John", branchId: B, branch: { id: B, name: "Old city", createdAt: "" } });
// Мульти-филиальный: основной A, но работает и в B.
const multi = mk({
  id: "3",
  fullName: "Мульти",
  branchId: A,
  branchIds: [A, B],
  branch: { id: A, name: "Kamilovs", createdAt: "" },
});

describe("worksInBranch", () => {
  it("матчит основной филиал", () => {
    expect(worksInBranch(petr, A)).toBe(true);
    expect(worksInBranch(petr, B)).toBe(false);
  });

  it("учитывает дополнительные филиалы из branchIds", () => {
    expect(worksInBranch(multi, B)).toBe(true);
  });

  it("падает обратно на branches, если branchIds не пришёл с сервера", () => {
    const viaBranches = mk({
      id: "4",
      fullName: "Без branchIds",
      branchId: A,
      branches: [
        { id: A, name: "Kamilovs", createdAt: "" },
        { id: B, name: "Old city", createdAt: "" },
      ],
    });
    expect(worksInBranch(viaBranches, B)).toBe(true);
  });

  it("без филиала подходит любой", () => {
    expect(worksInBranch(john, undefined)).toBe(true);
    expect(worksInBranch(john, null)).toBe(true);
  });
});

describe("adminsForBranch", () => {
  it("НИКОГО не выбрасывает — главный аккаунт может выбрать любого", () => {
    const res = adminsForBranch([petr, john, multi], B);
    expect(res).toHaveLength(3);
    expect(res.map((a) => a.id).sort()).toEqual(["1", "2", "3"]);
  });

  it("работающих в этом филиале ставит первыми", () => {
    const res = adminsForBranch([petr, john, multi], B);
    // john (основной B) и multi (доп. B) — впереди; petr (только A) — после.
    expect(res.slice(0, 2).map((a) => a.id).sort()).toEqual(["2", "3"]);
    expect(res[2].id).toBe("1");
  });

  it("не падает на пустом списке", () => {
    expect(adminsForBranch([], A)).toEqual([]);
  });
});

describe("adminOptionLabel", () => {
  it("для своего — просто имя", () => {
    expect(adminOptionLabel(petr, A)).toBe("Пётр");
  });

  it("для чужого — имя с его филиалом, чтобы выбор был осознанным", () => {
    expect(adminOptionLabel(john, A)).toBe("John · Old city");
  });

  it("мульти-филиальному в его же филиале не приписывает основной филиал", () => {
    expect(adminOptionLabel(multi, B)).toBe("Мульти");
  });
});
