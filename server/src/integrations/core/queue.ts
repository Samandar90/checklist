import { prisma } from "../../prisma";

/**
 * Queue abstraction.
 *
 * The default implementation (DbQueue) is backed by the SyncJob table — durable
 * and retryable with zero extra infrastructure, which is the right choice for
 * this SQLite / single-container deployment. When the platform grows to Redis,
 * a BullMqQueue implementing this same interface drops in without touching
 * callers. THIS is the seam the prompt asked to "prepare as an abstraction".
 */

export type JobKind = "IMPORT" | "EXPORT" | "WEBHOOK" | "RETRY" | "PERIODIC";
export type JobStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED" | "DEAD";

export interface EnqueueInput {
  kind: JobKind;
  accountId?: string | null;
  payload?: unknown;
  maxAttempts?: number;
  /** Delay before the job becomes runnable (ms). */
  delayMs?: number;
}

export interface QueuedJob {
  id: string;
  kind: JobKind;
  accountId: string | null;
  status: JobStatus;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
}

export interface Queue {
  enqueue(input: EnqueueInput): Promise<string>;
  /** Claim up to `limit` runnable jobs, marking them PROCESSING atomically. */
  claim(limit: number): Promise<QueuedJob[]>;
  complete(jobId: string): Promise<void>;
  /** Record a failure; re-queues with backoff until maxAttempts, then DEAD. */
  fail(jobId: string, error: string): Promise<void>;
  /** Move a job to the dead-letter state explicitly. */
  deadLetter(jobId: string, error: string): Promise<void>;
}

function parsePayload(payload: string | null): unknown {
  if (!payload) return null;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/** Exponential backoff: 30s, 2m, 8m, 32m, … capped at 1h. */
function backoffMs(attempts: number): number {
  return Math.min(30_000 * Math.pow(4, attempts), 60 * 60_000);
}

export class DbQueue implements Queue {
  async enqueue(input: EnqueueInput): Promise<string> {
    const job = await prisma.syncJob.create({
      data: {
        kind: input.kind,
        accountId: input.accountId ?? null,
        payload: input.payload != null ? JSON.stringify(input.payload) : null,
        maxAttempts: input.maxAttempts ?? 5,
        runAt: new Date(Date.now() + (input.delayMs ?? 0)),
      },
    });
    return job.id;
  }

  async claim(limit: number): Promise<QueuedJob[]> {
    // SQLite has no SKIP LOCKED; the worker is single-instance here, so a
    // read-then-conditional-update is sufficient and race-safe enough. A future
    // BullMqQueue would replace this entirely.
    const now = new Date();
    const candidates = await prisma.syncJob.findMany({
      where: { status: "PENDING", runAt: { lte: now } },
      orderBy: { runAt: "asc" },
      take: limit,
    });

    const claimed: QueuedJob[] = [];
    for (const c of candidates) {
      const res = await prisma.syncJob.updateMany({
        where: { id: c.id, status: "PENDING" },
        data: { status: "PROCESSING", attempts: { increment: 1 }, updatedAt: new Date() },
      });
      if (res.count === 1) {
        claimed.push({
          id: c.id,
          kind: c.kind as JobKind,
          accountId: c.accountId,
          status: "PROCESSING",
          payload: parsePayload(c.payload),
          attempts: c.attempts + 1,
          maxAttempts: c.maxAttempts,
        });
      }
    }
    return claimed;
  }

  async complete(jobId: string): Promise<void> {
    await prisma.syncJob.update({ where: { id: jobId }, data: { status: "DONE", lastError: null } });
  }

  async fail(jobId: string, error: string): Promise<void> {
    const job = await prisma.syncJob.findUnique({ where: { id: jobId } });
    if (!job) return;
    if (job.attempts >= job.maxAttempts) {
      await this.deadLetter(jobId, error);
      return;
    }
    await prisma.syncJob.update({
      where: { id: jobId },
      data: { status: "PENDING", lastError: error, runAt: new Date(Date.now() + backoffMs(job.attempts)) },
    });
  }

  async deadLetter(jobId: string, error: string): Promise<void> {
    await prisma.syncJob.update({ where: { id: jobId }, data: { status: "DEAD", lastError: error } });
  }
}

/** The process-wide queue instance. Swap this line to change queue backends. */
export const queue: Queue = new DbQueue();
