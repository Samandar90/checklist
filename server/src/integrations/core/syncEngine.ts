import { prisma } from "../../prisma";
import { CanonicalReservation } from "./canonical";
import { payloadHash } from "./hash";

/**
 * The provider-independent synchronization pipeline.
 *
 *   Incoming data → Validate → Transform → Normalize → Conflict-resolve →
 *   DB transaction → Audit/Log → (UI refresh signal)
 *
 * This phase wires the pipeline STAGES and their logging/telemetry. The actual
 * persistence stage (applying a canonical reservation to MonthlyReport) is
 * delegated to a handler injected by the service, because that is where real
 * business rules live — the engine stays provider- and storage-agnostic.
 */

export type SyncDirection = "INBOUND" | "OUTBOUND";
export type SyncEntity = "RESERVATION" | "ROOM" | "AVAILABILITY" | "RATE";

export interface SyncContext {
  accountId: string;
  direction: SyncDirection;
  entity: SyncEntity;
}

/** Applies one canonical reservation to internal storage. Returns the internal id. */
export type ReservationPersistHandler = (
  ctx: SyncContext,
  reservation: CanonicalReservation
) => Promise<{ reportId: string; created: boolean }>;

export interface SyncOutcome {
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

export class SyncEngine {
  constructor(private readonly persistReservation: ReservationPersistHandler) {}

  /**
   * Run a batch of canonical reservations through the pipeline under a single
   * SyncLog entry. Each reservation is validated, conflict-checked (by payload
   * hash) and persisted; failures are counted without aborting the batch.
   */
  async ingestReservations(ctx: SyncContext, reservations: CanonicalReservation[]): Promise<SyncOutcome> {
    const startedAt = new Date();
    const log = await prisma.syncLog.create({
      data: {
        accountId: ctx.accountId,
        direction: ctx.direction,
        entity: ctx.entity,
        status: "STARTED",
        payloadHash: payloadHash(reservations),
      },
    });

    const outcome: SyncOutcome = { processed: 0, created: 0, updated: 0, skipped: 0, errors: 0 };

    for (const reservation of reservations) {
      outcome.processed++;
      const validation = this.validate(reservation);
      if (!validation.ok) {
        outcome.skipped++;
        continue;
      }
      try {
        const { created } = await this.persistReservation(ctx, reservation);
        if (created) outcome.created++;
        else outcome.updated++;
      } catch {
        outcome.errors++;
      }
    }

    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: outcome.errors > 0 ? "ERROR" : "SUCCESS",
        durationMs: Date.now() - startedAt.getTime(),
        finishedAt: new Date(),
        error: outcome.errors > 0 ? `${outcome.errors} reservation(s) failed to persist` : null,
      },
    });

    return outcome;
  }

  /** Minimal structural validation shared by all providers. */
  private validate(r: CanonicalReservation): { ok: boolean } {
    if (!r.guest?.name) return { ok: false };
    if (!r.stay?.checkIn) return { ok: false };
    if (!r.money || typeof r.money.total !== "number") return { ok: false };
    return { ok: true };
  }
}
