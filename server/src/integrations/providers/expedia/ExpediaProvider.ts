import { BaseProvider } from "../common/BaseProvider";

/** Expedia adapter — ARCHITECTURE ONLY (see BookingProvider for the pattern). */
export class ExpediaProvider extends BaseProvider {
  readonly code = "expedia";
  readonly name = "Expedia";
}
