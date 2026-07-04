import { OtaProvider } from "../core/provider";
import { UnknownProviderError } from "../core/errors";
import { BookingProvider } from "./booking/BookingProvider";
import { ExpediaProvider } from "./expedia/ExpediaProvider";
import { AirbnbProvider } from "./airbnb/AirbnbProvider";
import { AgodaProvider } from "./agoda/AgodaProvider";

/**
 * The provider registry — the ONE place provider adapters are listed.
 *
 * The rest of the codebase never references a concrete provider class or a
 * hardcoded provider name; it asks the registry for an adapter by code. Adding a
 * new OTA later is: write the adapter, add one line here, done.
 */
const PROVIDERS: OtaProvider[] = [
  new BookingProvider(),
  new ExpediaProvider(),
  new AirbnbProvider(),
  new AgodaProvider(),
];

const byCode = new Map<string, OtaProvider>(PROVIDERS.map((p) => [p.code, p]));

/** All registered adapters (used to seed IntegrationProvider and list providers). */
export function listProviders(): OtaProvider[] {
  return [...PROVIDERS];
}

/** Resolve an adapter by code, or throw UnknownProviderError. */
export function getProvider(code: string): OtaProvider {
  const provider = byCode.get(code);
  if (!provider) throw new UnknownProviderError(code);
  return provider;
}

export function hasProvider(code: string): boolean {
  return byCode.has(code);
}
