import type { MonthlyReport, BookingSource, Room, Branch } from "@prisma/client";
import {
  CanonicalReservation,
  bookingSourceNameToCanonical,
  internalStatusToCanonical,
} from "../core/canonical";

/**
 * The single translation point between the existing PMS reservation storage
 * (MonthlyReport) and the provider-independent CanonicalReservation.
 *
 * Direction OUT (PMS → canonical) is fully implementable now and is used when
 * exporting an internal reservation to an OTA. Direction IN (canonical → PMS
 * write) is deliberately NOT done here: writing a reservation touches
 * double-booking checks, folio/pricing and audit, which live in the reservation
 * service. The sync engine calls that service via a persist handler, so this
 * mapper stays a pure, side-effect-free translator.
 */

type ReportWithRelations = MonthlyReport & {
  source?: BookingSource | null;
  room?: Room | null;
  branch?: Branch | null;
};

/** PMS reservation → canonical model (pure). */
export function reportToCanonical(report: ReportWithRelations): CanonicalReservation {
  const sourceName = report.source?.name ?? "Other";
  return {
    externalId: null,
    externalStatus: null,
    source: bookingSourceNameToCanonical(sourceName),
    status: internalStatusToCanonical(report.status),
    guest: {
      name: report.guestName ?? "",
      email: null,
      phone: null,
      country: null,
    },
    stay: {
      checkIn: toIsoDate(report.date),
      checkOut: report.checkOut ? toIsoDate(report.checkOut) : null,
      externalRoomId: null,
    },
    money: {
      total: report.price,
      currency: report.currency,
      paidAmount: report.paidAmount ?? null,
    },
    notes: report.notes ?? null,
    raw: null,
  };
}

/**
 * Shape a canonical reservation into the plain fields the reservation service
 * needs to create/update a MonthlyReport. Resolving sourceId/roomId/branchId
 * (which requires DB lookups and mapping tables) is the service's job — this
 * returns only the directly translatable fields.
 */
export function canonicalToReportFields(reservation: CanonicalReservation): {
  guestName: string;
  date: string;
  checkOut: string | null;
  price: number;
  currency: string;
  paidAmount: number | null;
  notes: string | null;
} {
  return {
    guestName: reservation.guest.name,
    date: reservation.stay.checkIn,
    checkOut: reservation.stay.checkOut,
    price: reservation.money.total,
    currency: reservation.money.currency,
    paidAmount: reservation.money.paidAmount ?? null,
    notes: reservation.notes ?? null,
  };
}

/** Format a Date as a hotel-local YYYY-MM-DD business date. */
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
