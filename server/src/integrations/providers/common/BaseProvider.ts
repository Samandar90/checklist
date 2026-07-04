import { CanonicalReservation } from "../../core/canonical";
import { NotImplementedError } from "../../core/errors";
import {
  AvailabilityUpdate,
  ExternalRoom,
  OtaProvider,
  ProviderContext,
  ProviderHealth,
  RateUpdate,
  ValidationResult,
} from "../../core/provider";

/**
 * Shared base for every OTA adapter.
 *
 * It implements the full OtaProvider contract with NotImplementedError defaults,
 * so a concrete adapter only overrides the methods it actually supports and can
 * never accidentally leave a contract method undefined. It also provides small
 * reusable helpers (retry) that real adapters will lean on.
 *
 * There is intentionally NO provider-specific logic here.
 */
export abstract class BaseProvider implements OtaProvider {
  abstract readonly code: string;
  abstract readonly name: string;

  async connect(_ctx: ProviderContext): Promise<void> {
    throw new NotImplementedError(this.code, "connect");
  }
  async disconnect(_ctx: ProviderContext): Promise<void> {
    throw new NotImplementedError(this.code, "disconnect");
  }
  async healthCheck(_ctx: ProviderContext): Promise<ProviderHealth> {
    // A not-yet-implemented provider is reported as DISCONNECTED rather than
    // throwing, so the health dashboard can render it cleanly.
    return { status: "DISCONNECTED", detail: "Adapter not implemented yet", checkedAt: new Date().toISOString() };
  }

  async importReservations(_ctx: ProviderContext): Promise<CanonicalReservation[]> {
    throw new NotImplementedError(this.code, "importReservations");
  }
  async receiveWebhook(
    _ctx: ProviderContext,
    _headers: Record<string, string>,
    _body: unknown
  ): Promise<CanonicalReservation[]> {
    throw new NotImplementedError(this.code, "receiveWebhook");
  }
  validatePayload(_body: unknown): ValidationResult {
    return { ok: false, errors: [`Provider "${this.code}" has no payload validator yet.`] };
  }
  mapReservation(_raw: unknown): CanonicalReservation {
    throw new NotImplementedError(this.code, "mapReservation");
  }

  async updateReservation(_ctx: ProviderContext, _reservation: CanonicalReservation): Promise<void> {
    throw new NotImplementedError(this.code, "updateReservation");
  }
  async cancelReservation(_ctx: ProviderContext, _externalReservationId: string): Promise<void> {
    throw new NotImplementedError(this.code, "cancelReservation");
  }
  async syncRooms(_ctx: ProviderContext, _rooms: ExternalRoom[]): Promise<void> {
    throw new NotImplementedError(this.code, "syncRooms");
  }
  async syncAvailability(_ctx: ProviderContext, _updates: AvailabilityUpdate[]): Promise<void> {
    throw new NotImplementedError(this.code, "syncAvailability");
  }
  async syncRates(_ctx: ProviderContext, _updates: RateUpdate[]): Promise<void> {
    throw new NotImplementedError(this.code, "syncRates");
  }

  /** Generic retry helper with exponential backoff, reusable by real adapters. */
  protected async retry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 500): Promise<T> {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (i < attempts - 1) {
          await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, i)));
        }
      }
    }
    throw lastErr;
  }
}
