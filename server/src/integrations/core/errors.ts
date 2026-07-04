/** Base class for all integration-layer errors. */
export class IntegrationError extends Error {
  constructor(
    message: string,
    /** Stable machine-readable code for logs/API. */
    public readonly code: string = "INTEGRATION_ERROR",
    /** HTTP status a controller should map this to. */
    public readonly httpStatus: number = 500
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Thrown by provider adapter methods that are architecture-only (no OTA logic yet). */
export class NotImplementedError extends IntegrationError {
  constructor(providerCode: string, method: string) {
    super(
      `Provider "${providerCode}" has not implemented "${method}" yet.`,
      "NOT_IMPLEMENTED",
      501
    );
  }
}

/** Thrown when a provider code has no registered adapter. */
export class UnknownProviderError extends IntegrationError {
  constructor(providerCode: string) {
    super(`No adapter registered for provider "${providerCode}".`, "UNKNOWN_PROVIDER", 404);
  }
}

/** Thrown for room/reservation mapping violations (e.g. duplicate mapping). */
export class MappingError extends IntegrationError {
  constructor(message: string) {
    super(message, "MAPPING_ERROR", 409);
  }
}
