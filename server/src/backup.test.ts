import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `VACUUM INTO` is stubbed with a real file write: the point of these tests is
 * the retention policy around snapshots, not SQLite itself.
 */
vi.mock("./prisma", () => ({
  prisma: {
    $executeRawUnsafe: vi.fn(async (sql: string) => {
      const target = /VACUUM INTO '(.*)'/.exec(sql)?.[1];
      if (!target) throw new Error(`unexpected sql: ${sql}`);
      fs.writeFileSync(target, "snapshot");
      // Deterministic, strictly increasing mtimes so "newest" is unambiguous —
      // several snapshots in one millisecond would otherwise tie.
      fs.utimesSync(target, clock, clock);
      clock += 60;
    }),
  },
}));

let clock = 1_700_000_000;

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hotel-backup-"));
process.env.DATABASE_URL = `file:${path.join(tmpRoot, "test.db")}`;

const { createSnapshot, getBackupsDir, listSnapshots } = await import("./backup");

beforeEach(() => {
  clock = 1_700_000_000;
  fs.rmSync(getBackupsDir(), { recursive: true, force: true });
});

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe("createSnapshot", () => {
  it("writes a snapshot and reports its real size", async () => {
    const snap = await createSnapshot();
    expect(fs.existsSync(snap.path)).toBe(true);
    expect(snap.size).toBe("snapshot".length);
    expect(snap.name).toMatch(/^backup-\d{8}-\d{9}-[a-z0-9]{4}\.db$/);
  });

  it("keeps at most 14 snapshots, whoever asked for them", async () => {
    // The nightly job used to be the only caller that pruned, so on-demand
    // snapshots (POST /api/backup, and one per GET /api/backup/download) piled
    // up on the same disk as the live database until the next 24h tick.
    for (let i = 0; i < 20; i++) await createSnapshot();
    expect(listSnapshots()).toHaveLength(14);
  });

  it("never prunes the snapshot it just created", async () => {
    for (let i = 0; i < 20; i++) await createSnapshot();
    const last = await createSnapshot();
    expect(fs.existsSync(last.path)).toBe(true);
    expect(listSnapshots()[0].name).toBe(last.name);
  });

  it("drops the oldest snapshots first", async () => {
    const made = [];
    for (let i = 0; i < 16; i++) made.push(await createSnapshot());
    const kept = listSnapshots().map((s) => s.name);
    expect(kept).not.toContain(made[0].name);
    expect(kept).not.toContain(made[1].name);
    expect(kept).toContain(made[2].name);
    expect(kept).toContain(made[15].name);
  });
});

describe("listSnapshots", () => {
  it("is empty when no backup has ever run", () => {
    expect(listSnapshots()).toEqual([]);
  });

  it("ignores files that are not snapshots", async () => {
    await createSnapshot();
    fs.writeFileSync(path.join(getBackupsDir(), "notes.txt"), "x");
    fs.writeFileSync(path.join(getBackupsDir(), "backup-partial.tmp"), "x");
    expect(listSnapshots()).toHaveLength(1);
  });
});
