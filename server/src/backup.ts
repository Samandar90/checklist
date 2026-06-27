import fs from "fs";
import path from "path";
import { prisma } from "./prisma";

const DAY_MS = 24 * 60 * 60 * 1000;
const KEEP_SNAPSHOTS = 14;

/** Absolute path to the SQLite database file, derived from DATABASE_URL. */
export function getDbPath(): string {
  const url = process.env.DATABASE_URL || "file:./dev.db";
  const raw = url.replace(/^file:/, "");
  if (path.isAbsolute(raw)) return raw;
  // Relative paths in DATABASE_URL are resolved against the prisma directory.
  return path.resolve(__dirname, "..", "prisma", raw);
}

export function getBackupsDir(): string {
  return path.join(path.dirname(getDbPath()), "backups");
}

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  // Include milliseconds + a short random suffix so two snapshots in the same
  // second never collide on the VACUUM INTO target filename.
  const rand = Math.random().toString(36).slice(2, 6);
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(
    d.getSeconds()
  )}${String(d.getMilliseconds()).padStart(3, "0")}-${rand}`;
}

export interface SnapshotInfo {
  name: string;
  path: string;
  size: number;
  createdAt: string;
}

/**
 * Create a consistent snapshot of the database using SQLite's `VACUUM INTO`,
 * which is safe to run while the database is in use.
 */
export async function createSnapshot(): Promise<SnapshotInfo> {
  const dir = getBackupsDir();
  fs.mkdirSync(dir, { recursive: true });

  const name = `backup-${timestamp()}.db`;
  const target = path.join(dir, name);
  // SQLite accepts forward slashes on all platforms; escape single quotes.
  const sqlitePath = target.replace(/\\/g, "/").replace(/'/g, "''");

  await prisma.$executeRawUnsafe(`VACUUM INTO '${sqlitePath}'`);

  const stat = fs.statSync(target);
  return { name, path: target, size: stat.size, createdAt: new Date().toISOString() };
}

export function listSnapshots(): SnapshotInfo[] {
  const dir = getBackupsDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("backup-") && f.endsWith(".db"))
    .map((name) => {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      return { name, path: full, size: stat.size, createdAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Keep only the newest KEEP_SNAPSHOTS backups. */
function prune(): void {
  const snapshots = listSnapshots();
  for (const old of snapshots.slice(KEEP_SNAPSHOTS)) {
    try {
      fs.unlinkSync(old.path);
    } catch (err) {
      console.error("Не удалось удалить старую копию:", old.name, err);
    }
  }
}

async function runBackup(): Promise<void> {
  try {
    const snap = await createSnapshot();
    prune();
    console.log(`Резервная копия создана: ${snap.name} (${Math.round(snap.size / 1024)} КБ)`);
  } catch (err) {
    console.error("Не удалось создать резервную копию:", err);
  }
}

/** Run one backup on boot, then every 24 hours. */
export function scheduleBackups(): void {
  runBackup();
  setInterval(runBackup, DAY_MS);
}
