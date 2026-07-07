/**
 * The Canonical Reservation model.
 *
 * Every provider adapter converts its own reservation shape INTO this model,
 * and the PMS (via the reservation mapper) converts between this model and the
 * existing MonthlyReport. Nothing outside the integration layer should ever see
 * a provider-specific reservation shape or a raw OTA status string.
 *
 * This is a TYPED MAPPING LAYER over the existing reservation storage
 * (MonthlyReport) — it deliberately does NOT introduce a second reservation
 * table, which would duplicate business logic.
 */

/** Provider-independent booking channel. Maps to a BookingSource by name. */
export type CanonicalSource =
  | "Manual"
  | "Reception"
  | "Website"
  | "Phone"
  | "WalkIn"
  | "Booking"
  | "Expedia"
  | "Airbnb"
  | "Agoda"
  | "Other";

/**
 * Provider-independent reservation status. The five persistent internal
 * statuses map 1:1 to MonthlyReport.status; "Modified" is a sync EVENT (an
 * incoming change to an existing reservation), not a stored state — the mapper
 * treats it as "update, keep current status".
 */
export type CanonicalStatus =
  | "Reserved"
  | "CheckedIn"
  | "CheckedOut"
  | "Cancelled"
  | "NoShow"
  | "Modified";

export interface CanonicalGuest {
  name: string;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
}

export interface CanonicalStay {
  /** ISO date (YYYY-MM-DD) — a hotel-local business date, not a UTC instant. */
  checkIn: string;
  checkOut: string | null;
  adults?: number | null;
  children?: number | null;
  /** The provider's room identifier; resolved to an internal room via RoomMapping. */
  externalRoomId?: string | null;
}

export interface CanonicalMoney {
  /** Total price in major units of `currency`. */
  total: number;
  currency: string;
  paidAmount?: number | null;
}

export interface CanonicalReservation {
  /** The provider's reservation id (absent for purely internal reservations). */
  externalId?: string | null;
  /** The raw provider status, kept only for audit — never surfaced in the UI. */
  externalStatus?: string | null;
  source: CanonicalSource;
  status: CanonicalStatus;
  guest: CanonicalGuest;
  stay: CanonicalStay;
  money: CanonicalMoney;
  notes?: string | null;
  /** The untouched provider payload, for debugging and replay. */
  raw?: unknown;
}

// ── Status normalization ─────────────────────────────────────────────────────
// The single source of truth for canonical ↔ internal status translation.

/** Internal MonthlyReport.status values. */
export type InternalStatus = "RESERVED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW";

const CANONICAL_TO_INTERNAL: Record<Exclude<CanonicalStatus, "Modified">, InternalStatus> = {
  Reserved: "RESERVED",
  CheckedIn: "CHECKED_IN",
  CheckedOut: "CHECKED_OUT",
  Cancelled: "CANCELLED",
  NoShow: "NO_SHOW",
};

const INTERNAL_TO_CANONICAL: Record<InternalStatus, CanonicalStatus> = {
  RESERVED: "Reserved",
  CHECKED_IN: "CheckedIn",
  CHECKED_OUT: "CheckedOut",
  CANCELLED: "Cancelled",
  NO_SHOW: "NoShow",
};

/**
 * Canonical → internal status. Returns null for "Modified" because it carries
 * no target state (the caller keeps the reservation's current status).
 */
export function canonicalStatusToInternal(status: CanonicalStatus): InternalStatus | null {
  if (status === "Modified") return null;
  return CANONICAL_TO_INTERNAL[status];
}

export function internalStatusToCanonical(status: string): CanonicalStatus {
  return INTERNAL_TO_CANONICAL[status as InternalStatus] ?? "Reserved";
}

// ── Source normalization ─────────────────────────────────────────────────────
// Canonical channel ↔ BookingSource.name. The service resolves/creates the
// matching BookingSource row at sync time; this map only fixes the naming.

const CANONICAL_SOURCE_TO_BOOKING_SOURCE_NAME: Record<CanonicalSource, string> = {
  Manual: "Manual",
  Reception: "Reception",
  Website: "Website",
  Phone: "Phone",
  WalkIn: "Walk In",
  Booking: "Booking",
  Expedia: "Expedia",
  Airbnb: "Airbnb",
  Agoda: "Agoda",
  Other: "Other",
};

export function canonicalSourceToBookingSourceName(source: CanonicalSource): string {
  return CANONICAL_SOURCE_TO_BOOKING_SOURCE_NAME[source] ?? "Other";
}

/** Best-effort reverse lookup used when exporting an internal reservation. */
export function bookingSourceNameToCanonical(name: string): CanonicalSource {
  const entry = (Object.entries(CANONICAL_SOURCE_TO_BOOKING_SOURCE_NAME) as [CanonicalSource, string][]).find(
    ([, v]) => v.toLowerCase() === name.trim().toLowerCase()
  );
  return entry ? entry[0] : "Other";
}
