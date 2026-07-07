import { BaseProvider } from "../common/BaseProvider";

/**
 * Booking.com adapter — ARCHITECTURE ONLY.
 *
 * Every method inherits NotImplementedError / DISCONNECTED defaults from
 * BaseProvider. Implementing the real Booking.com connectivity later means
 * overriding the methods in this class only — nothing else in the PMS changes.
 */
export class BookingProvider extends BaseProvider {
  readonly code = "booking";
  readonly name = "Booking.com";
}
