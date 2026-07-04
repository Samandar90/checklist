import { BaseProvider } from "../common/BaseProvider";

/** Agoda adapter — ARCHITECTURE ONLY (see BookingProvider for the pattern). */
export class AgodaProvider extends BaseProvider {
  readonly code = "agoda";
  readonly name = "Agoda";
}
