import { createHash } from "crypto";

/**
 * Stable SHA-256 hash of any JSON-serializable value. Used to detect whether an
 * incoming payload actually changed (to skip redundant writes) and to store a
 * fingerprint on SyncLog/ReservationMapping without persisting full payloads.
 */
export function payloadHash(value: unknown): string {
  const json = stableStringify(value);
  return createHash("sha256").update(json).digest("hex");
}

/** JSON.stringify with deterministically ordered object keys. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
    .join(",")}}`;
}
