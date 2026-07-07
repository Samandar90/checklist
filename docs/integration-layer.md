# OTA Integration Layer — Architecture

**Status:** Phase 1 — architecture only. No OTA is connected; every adapter method
throws `NotImplementedError` (or reports `DISCONNECTED`). Adding a real OTA later
means implementing **one adapter class** and registering it — nothing else in the
PMS changes.

This document covers what was built, the deliberate scope decisions, and the exact
seams where the Booking.com / Expedia / Airbnb / Agoda adapters plug in.

---

## 1. Scope decisions (why this differs from a textbook build)

The brief assumed PostgreSQL + Redis + BullMQ and ~11 new tables. This repo's
reality drove three production-grade adaptations:

1. **SQLite, not PostgreSQL.** The app ships as a single Docker container on
   Render with a 1 GB disk. Enums/native-JSON aren't used (SQLite); status/kind
   fields are `String` with documented allowed values and JSON is stored as
   `String` — matching the existing `MonthlyReport.status` / `AuditLog.changes`
   conventions.
2. **No Redis → DB-backed queue.** Introducing Redis/BullMQ into a single-container
   SQLite app would be over-engineering. The queue is an **abstraction**
   (`core/queue.ts` → `Queue` interface) with a durable `SyncJob`-table default
   (`DbQueue`). A `BullMqQueue` implementing the same interface drops in later with
   zero caller changes. This is the seam the brief asked to "prepare as an
   abstraction".
3. **Canonical reservation = mapping layer, not a second table.** A reservation
   already lives in `MonthlyReport` (+ `BookingSource` + a `status` enum that is
   already exactly Reserved/CheckedIn/CheckedOut/Cancelled/NoShow). The
   `CanonicalReservation` is a typed translation layer over it. A parallel
   reservation table would duplicate business logic — explicitly forbidden.

Table collapses vs. the brief (documented, not accidental):
`integration_hotels` → `IntegrationAccount.branchId` (a "hotel" here is a Branch);
`sync_errors` → fields on `SyncLog`; `provider_settings` → `IntegrationAccount.settings`.
Result: 7 focused tables instead of 11.

---

## 2. Folder tree

```
server/src/integrations/
  core/
    canonical.ts     Canonical model + status/source normalization (single source of truth)
    provider.ts      OtaProvider — the universal provider contract
    errors.ts        IntegrationError / NotImplementedError / MappingError / UnknownProviderError
    queue.ts         Queue abstraction + DbQueue (SyncJob-backed) default
    syncEngine.ts    Provider-independent pipeline (validate→normalize→persist→log)
    hash.ts          Stable payload hashing (change detection / fingerprints)
  providers/
    common/
      BaseProvider.ts  Abstract base: full contract with NotImplemented defaults + retry()
    booking/BookingProvider.ts   stub (code "booking")
    expedia/ExpediaProvider.ts   stub (code "expedia")
    airbnb/AirbnbProvider.ts     stub (code "airbnb")
    agoda/AgodaProvider.ts       stub (code "agoda")
    registry.ts      The ONE place adapters are registered; resolve-by-code, never by name
  mappers/
    reservationMapper.ts  MonthlyReport ↔ CanonicalReservation (pure)
  repositories/
    integrationRepo.ts    Prisma access for the integration tables
  services/
    integrationService.ts Thin orchestration used by the router
  seed.ts            Idempotent: mirrors code registry → IntegrationProvider table

server/src/routes/
  integrations.ts    /api/integrations/*  (super-admin gated)
  webhooks.ts        /api/webhooks/:providerCode  (unauth, rate-limited, provider-gated)
```

---

## 3. Database (text diagram)

New tables (all additive; existing tables only gained back-relations):

```
IntegrationProvider (registry: code unique, name, enabled)
        │ 1
        │ n
IntegrationAccount ──── n:1 ──── Branch            (one account per provider per branch)
   status, externalHotelId, settings(JSON), lastSyncAt/lastError
        │
        ├── RoomMapping ──── n:1 ──── Room          (unique per (account,externalRoomId) AND (account,roomId))
        ├── ReservationMapping ─ n:1 ─ MonthlyReport (unique per (account,externalReservationId))
        ├── SyncJob         (kind, status, payload, attempts, runAt, lastError)   ← the DB queue
        ├── SyncLog         (direction, entity, status, durationMs, payloadHash, error)
        └── WebhookLog      (providerCode, signatureOk, status, payloadHash)  [accountId SET NULL]
```

All FKs indexed; audit timestamps on every table; unique constraints enforce the
one-external-↔-one-internal room rule and one-account-per-provider-per-branch.

Migration: `prisma/migrations/20260704111556_add_integration_layer/` — pure
`CREATE TABLE` / `CREATE INDEX`, no changes to existing rows.

---

## 4. Reservation flow (all sources funnel through canonical)

```
Booking / Expedia / Airbnb / Agoda   Reception / Website / Phone / Walk-in / Manual
        (adapter.mapReservation)                  (already MonthlyReport)
                    │                                        │
                    ▼                                        ▼
             CanonicalReservation  ◄──────  reportToCanonical()  (for export)
                    │
        SyncEngine.ingestReservations()  (validate → normalize → conflict-check → persist → SyncLog)
                    │
             persist handler → reservation service → MonthlyReport (double-booking, audit, pricing)
```

The rest of the PMS (calendar, reports, rooms) keeps working only with
`MonthlyReport` — it never sees a provider shape or a raw OTA status.

---

## 5. Where the Booking.com / Expedia / Airbnb / Agoda adapters plug in

Each future adapter extends `BaseProvider` and overrides only what it supports:

- **`connect()` / `disconnect()` / `healthCheck()`** — auth + connectivity to the OTA.
- **`importReservations()`** — pull bookings → return `CanonicalReservation[]` (via `mapReservation`).
- **`receiveWebhook()` + `validatePayload()`** — verify signature, map push events. The
  generic ingress (`routes/webhooks.ts`) already logs + enqueues; the adapter turns
  the queued payload into canonical reservations.
- **`updateReservation()` / `cancelReservation()`** — push PMS changes back to the OTA.
- **`syncRooms()` / `syncAvailability()` / `syncRates()`** — outbound ARI sync, using
  `RoomMapping` to translate internal Room ↔ external room id.

Registration is one line in `providers/registry.ts`. The DB registry
(`IntegrationProvider`) auto-syncs from code on boot (`seedIntegrationProviders`).

Secrets: **not** stored in these tables. When an adapter is implemented, real
credentials belong in a secret store (see ADR-012); `IntegrationAccount.settings`
holds only non-secret config.

---

## 6. API surface (Phase 1)

Super-admin gated, under `/api/integrations`:

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | List accounts (+ provider, branch, mapping counts) |
| POST | `/` | Create account (branch↔provider; **no OTA auth**, status DISCONNECTED) |
| DELETE | `/:accountId` | Remove account (cascades mappings/jobs/logs) |
| GET | `/providers` | Registered provider catalog |
| GET | `/:accountId/mappings` | Room mappings for an account |
| POST | `/:accountId/room-mapping` | Create a room mapping (duplicate → 409) |
| GET | `/:accountId/logs` | Sync + webhook logs |
| GET | `/:accountId/health` | Provider health + queue backlog |
| POST | `/:accountId/sync` | Enqueue a manual sync job (202; **does not call any OTA**) |

Webhook ingress (unauthenticated, rate-limited, provider-gated):

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/webhooks/:providerCode` | Log receipt + enqueue WEBHOOK job; unknown provider → 404 |

---

## 7. Admin UI (prepared, not built)

Per the brief, no admin UI was implemented this phase. The API above is the
contract a future **Settings → Integrations** section consumes: provider cards
(from `/providers`), connection status + last sync (from `/` and `/:id/health`),
manual sync button (`POST /:id/sync`), logs (`/:id/logs`), mapped rooms
(`/:id/mappings`).

---

## 8. Verification performed

Existing endpoints unaffected (reports/branches/rooms/**calendar** all return
normally). New layer boots, auto-seeds 4 providers, and the full flow was
exercised over HTTP: create account → health (DISCONNECTED, clean) → room mapping
→ duplicate rejected (409) → manual sync enqueued (202, durable `SyncJob`) →
webhook received (202, `WebhookLog` + WEBHOOK job) → unknown provider (404) →
unauth (401) → cascade delete. Server + all code type-check clean.

---

## 9. Recommendations before implementing the Booking.com adapter

1. **Secret storage** — implement per-account credential storage in a real secret
   store (ADR-012) before `connect()`; never put OTA keys in `settings`.
2. **Queue worker** — add a small poller (`queue.claim()` loop) or, at Redis time,
   a `BullMqQueue`. Until a worker exists, enqueued jobs simply wait (safe).
3. **Signature verification** — add `verifySignature()` to the provider contract
   when the first webhook-capable adapter lands; `WebhookLog.signatureOk` is ready.
4. **Reservation persist handler** — wire `SyncEngine`'s persist handler to the
   existing reservation-create path so imported bookings go through double-booking
   checks and audit (do not bypass them).
5. **Room-type vs physical-room** — OTAs sell room *types*; `RoomMapping` maps
   physical rooms today. Add a type-level availability view when the first channel
   manager adapter needs it (flagged in the architecture review, Ch 24/30).
