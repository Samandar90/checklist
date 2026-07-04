import { BaseProvider } from "../common/BaseProvider";

/** Airbnb adapter — ARCHITECTURE ONLY (see BookingProvider for the pattern). */
export class AirbnbProvider extends BaseProvider {
  readonly code = "airbnb";
  readonly name = "Airbnb";
}
