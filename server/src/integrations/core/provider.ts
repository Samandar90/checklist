import { CanonicalReservation } from "./canonical";

/** Health snapshot a provider reports for monitoring. */
export type ProviderHealthStatus =
  | "CONNECTED"
  | "DISCONNECTED"
  | "AUTH_FAILED"
  | "SYNC_DELAYED"
  | "WEBHOOK_FAILED"
  | "QUEUE_BACKLOG"
  | "DISABLED";

export interface ProviderHealth {
  status: ProviderHealthStatus;
  detail?: string;
  checkedAt: string; // ISO timestamp
}

/** Minimal, provider-independent room descriptor exchanged during syncRooms(). */
export interface ExternalRoom {
  externalRoomId: string;
  name: string;
  capacity?: number | null;
}

/** Availability update for one room over a date range. */
export interface AvailabilityUpdate {
  externalRoomId: string;
  date: string; // ISO date
  available: number;
}

/** Rate update for one room/date. */
export interface RateUpdate {
  externalRoomId: string;
  date: string; // ISO date
  price: number;
  currency: string;
}

/** Result of validating a raw webhook/import payload. */
export interface ValidationResult {
  ok: boolean;
  errors?: string[];
}

/** Context handed to a provider for a single operation (account-scoped). */
export interface ProviderContext {
  accountId: string;
  branchId: string;
  externalHotelId: string | null;
  /** Non-secret settings JSON already parsed. Secrets are resolved elsewhere. */
  settings: Record<string, unknown>;
}

/**
 * THE UNIVERSAL PROVIDER CONTRACT.
 *
 * Every OTA adapter (Booking, Expedia, Airbnb, Agoda, …) implements exactly this
 * interface. The PMS/sync-engine only ever depends on this contract — never on a
 * concrete provider — so adding a new OTA later means implementing one adapter
 * and registering it, with zero changes to the rest of the system.
 *
 * NOTE: this phase defines the contract only. Concrete adapters throw
 * NotImplementedError from every method.
 */
export interface OtaProvider {
  /** Stable provider code, e.g. "booking". Must match IntegrationProvider.code. */
  readonly code: string;
  /** Human-readable name, e.g. "Booking.com". */
  readonly name: string;

  // ── Connection lifecycle ──
  connect(ctx: ProviderContext): Promise<void>;
  disconnect(ctx: ProviderContext): Promise<void>;
  healthCheck(ctx: ProviderContext): Promise<ProviderHealth>;

  // ── Inbound (OTA → PMS) ──
  importReservations(ctx: ProviderContext): Promise<CanonicalReservation[]>;
  /** Verify and normalize a raw inbound webhook body into canonical reservations. */
  receiveWebhook(ctx: ProviderContext, headers: Record<string, string>, body: unknown): Promise<CanonicalReservation[]>;
  validatePayload(body: unknown): ValidationResult;
  /** Map ONE raw provider reservation object into the canonical model. */
  mapReservation(raw: unknown): CanonicalReservation;

  // ── Outbound (PMS → OTA) ──
  updateReservation(ctx: ProviderContext, reservation: CanonicalReservation): Promise<void>;
  cancelReservation(ctx: ProviderContext, externalReservationId: string): Promise<void>;
  syncRooms(ctx: ProviderContext, rooms: ExternalRoom[]): Promise<void>;
  syncAvailability(ctx: ProviderContext, updates: AvailabilityUpdate[]): Promise<void>;
  syncRates(ctx: ProviderContext, updates: RateUpdate[]): Promise<void>;
}
