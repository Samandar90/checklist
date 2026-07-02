# Chapter 13 — Data Architecture & Persistence

| | |
|---|---|
| **Status** | Draft (the missing chapter; fills the Ch 13 gap in PMS 1.2) |
| **Date** | 2026-07-02 |
| **Consolidates** | ADR-001 (tenancy), ADR-002 (ledger/folio/night-audit), ADR-003 (outbox), ADR-006 (state machine), ADR-007 (temporal), ADR-008 (authz), ADR-011 (search), ADR-012 (encryption) |
| **Review finding** | Document defect D-2 (Ch 13 absent) and Blocker #1 (no data architecture); Top-100 item 1 |
| **Prerequisite for** | Every feature module; the schema rules here are normative constraints on all table design |

> This chapter is the **contract for the database**. It does not restate the ADRs' reasoning — it turns their decisions into rules a developer can follow when adding a table, and rules CI can enforce. Where a rule originates in an ADR, the ADR is cited; the ADR remains the "why," this chapter is the "how."

---

## 13.1 Purpose & scope

Every reservation, folio, room-night, and audit record in LBL is a row governed by the rules below. This chapter defines: the persistence stack, the tenancy enforcement contract, identifier and temporal and money standards, the aggregate/bounded-context map, the core relational model (with the invariants that make the platform's promises true), indexing standards, migration discipline, and the CI checks that keep all of it honest.

It is deliberately **schema-shape, not full DDL** — column-level DDL lives in the Prisma schema and migrations; this chapter is what reviewers check that schema *against*.

---

## 13.2 Persistence stack (normative)

- **PostgreSQL 16+ in every environment** — production, staging, CI, and local (Docker Compose). **SQLite is prohibited** (ADR — Ch 12 dev/prod parity finding); the double-booking, RLS, range-type, and isolation semantics the platform depends on do not exist in SQLite, so "works locally" would mean nothing.
- **Prisma** as the ORM/migration tool, wrapped by a tenancy-enforcing client (13.3). Raw SQL is permitted only for: range/exclusion constraints, RLS policies, `pg_trgm`/FTS search (ADR-011), and measured hot-path queries — each behind a reviewed repository method, never scattered.
- Required extensions: `btree_gist` (exclusion constraints), `pg_trgm` + `unaccent` (search), `pgcrypto` (digest/UUID helpers where needed). Enabled via migration, asserted in CI.
- Connection pooling: **PgBouncer in transaction mode** from Stage 1 (ADR-001 confirms `SET LOCAL` compatibility). Prisma configured for a pooler.

---

## 13.3 Tenancy enforcement (the wall) — from ADR-001

Rules every tenant-scoped table obeys; violation is a CI failure, not a review note.

1. **`organization_id UUID NOT NULL`** on every tenant-scoped table, denormalized even where derivable (ADR-001 §3.1). It is the **first column of the primary composite indexes**.
2. **Forced RLS**: `ALTER TABLE … ENABLE ROW LEVEL SECURITY; FORCE ROW LEVEL SECURITY;` with a policy keyed to `current_setting('app.current_org_id')`. The application role has **no `BYPASSRLS`**.
3. **Tenant context per unit of work**: every request/job/handler opens a transaction and issues `SET LOCAL app.current_org_id = $1` before any query, via the tenancy-wrapped Prisma client (the only permitted client import).
4. **Platform-global tables** (no `organization_id`, no RLS): `organizations`, `tenant_directory`, platform users/staff, plan catalog, marketplace registry, KMS key metadata. Access is platform-role gated and separately audited.
5. **Cross-tenant FKs are impossible by construction**: foreign keys between tenant tables carry `organization_id` in the composite reference or reference globally-unique ids that RLS re-checks on both sides.
6. Application-level `where organization_id` filters remain (query efficiency, clarity) but are **not** the enforcement layer — RLS is. Two independent walls (ADR-001 defense-in-depth).

**Beyond Postgres** (cache/files/search/vectors/events/logs): tenant key mandatory everywhere per ADR-001 §3.3 — restated in the relevant sections below.

---

## 13.4 Identifier standard

- **Primary keys: UUIDv7** (`id UUID`) — time-ordered (index locality of a serial, global uniqueness, non-enumerable externally). UUIDv7 also serves as the ordering spine for the outbox (ADR-003) and sync cursors (ADR-005/010).
- **No externally-sequential public ids** (Ch 12 "never expose internal IDs" + enumeration defense).
- **Human-facing business numbers** are separate, typed columns, never the PK:
  - Reservation number: `UNIQUE (organization_id, reservation_number)`; format = per-hotel prefix + zero-padded sequence; stable forever (22.12).
  - Invoice/fiscal numbers: **gapless legal sequences** per legal entity + document type, allocated at finalization not draft (ADR-002 §3.7). These are the one place a strict monotonic sequence is a legal requirement.
- Search shadow columns for numbers: uppercase, separator-stripped (ADR-011 §3.1).

---

## 13.5 Temporal standard — from ADR-007

- **Two classes, enforced by column suffix ↔ type:**
  - `*_at` → `TIMESTAMPTZ` (UTC instant): `created_at`, `checked_in_at`, `paid_at`, all audit/log times.
  - `*_date` → `DATE` (hotel-local business date, timezone-free): `arrival_date`, `departure_date`, `business_date`, occupancy/reporting dates.
- **`TIMESTAMP WITHOUT TIME ZONE` is prohibited** (no naive datetimes anywhere) — CI schema check.
- Each hotel stores an **IANA timezone** + **audit hour** + a **`current_business_date`** advanced only by night audit (ADR-002 §3.4, ADR-007 §3.2).
- `nights = departure_date − arrival_date` (pure date arithmetic — DST-immune).

---

## 13.6 Money standard — from ADR-002 §3.5

- Every monetary value: **`amount_minor BIGINT` (signed) + `currency CHAR(3)` (ISO-4217)**. Never `float`/`numeric`-as-float, never a bare number.
- Per-currency precision from the ISO table; line-level rounding, banker's default, jurisdiction-overridable; a rounding-remainder account absorbs residue.
- One `Money` type in code is the only permitted representation; float arithmetic on `*_minor` is lint-banned.

---

## 13.7 Soft delete, audit & encryption columns

- **Soft delete** (12.15) via `deleted_at TIMESTAMPTZ NULL` on business entities that must never hard-delete (guests, reservations, financial records); partial indexes exclude soft-deleted rows; RLS + `deleted_at IS NULL` is the default read scope in repositories.
- **Audit** is *not* a column concern — it is same-transaction append-only inserts into `audit_records` (ADR-002 pattern generalized; ADR-003 §3.1). Business tables do **not** carry `updated_by` as the audit mechanism; they may carry it for convenience, but the audit trail is the source of truth.
- **Encrypted-at-rest fields** (identity documents, integration secrets) store ciphertext + wrapped-data-key reference (ADR-012 §3.2), never plaintext; typed as `bytea`/`text` ciphertext with a schema annotation driving the encryption module.

---

## 13.8 Bounded contexts & aggregate map

The modular monolith's module boundaries (Ch 12 finding) are also the **aggregate boundaries**. Cross-module references are by **id only**; **no cross-module table joins** (lint-enforced) — this is what keeps the 50.11 evolution to services possible.

| Context (module) | Aggregate root(s) | Owns tables (illustrative) |
|---|---|---|
| **Identity & Access** | User, Organization, Role | organizations, users, memberships, roles, role_permissions, assignments, denies, sessions |
| **Property** | Hotel, Branch, Room, RoomType | hotels, branches, floors, room_types, rooms, room_status, amenities |
| **Reservation** | Reservation | reservations, reservation_guests, reservation_nights (rate snapshot), holds |
| **Guest CRM** | GuestProfile | guests, guest_documents, guest_contacts, guest_preferences, guest_stats |
| **Finance** | Folio, JournalEntry, CashRegister | folios, folio_lines, journal_entries, journal_lines, accounts, payments, cash_registers, shifts |
| **Housekeeping** | HousekeepingTask | tasks, inspections, checklists, lost_found |
| **Maintenance** | WorkOrder, Asset | assets, work_orders, wo_checklists, maintenance_schedules |
| **Inventory** | Item, PurchaseOrder | items, warehouses, stock_movements, suppliers, purchase_orders |
| **Channel/Booking** | ChannelMapping, external refs | channel_connections, room_mappings, rate_mappings, sync_jobs |
| **Platform** | Outbox, Audit, Notification | outbox_events, consumer_inbox, audit_records, notifications, tenant_secrets |

**Aggregate rule:** invariants hold *within* an aggregate in one transaction; *across* aggregates, consistency is eventual via the outbox (ADR-003). Example: creating a reservation + committing inventory + posting a deposit are one transaction (one Finance+Reservation boundary crossing is acceptable because they co-commit); notifying the guest and syncing channels are outbox-driven.

---

## 13.9 The core invariant: no double-booking — from Blocker #2

This is the platform's defining guarantee and it lives in the **database**, not application code.

```sql
-- rooms occupancy: a physical room cannot hold two overlapping active stays
ALTER TABLE reservation_room_assignments
  ADD CONSTRAINT no_overlap
  EXCLUDE USING gist (
    room_id           WITH =,
    daterange(arrival_date, departure_date, '[)') WITH &&
  )
  WHERE (status_active);   -- cancelled/no-show excluded via partial predicate
```

- `daterange` uses `[)` (half-open): departure day is free for the next arrival — the correct hotel-night semantics.
- `status_active` partial predicate: only reservations in occupancy-holding states (per ADR-006 matrix) participate; cancelled/no-show release the slot automatically.
- Dates are business dates (13.5) — timezone-free, so the constraint means the same thing regardless of who queries.
- **Virtual/connected rooms** (24.22–23): a booking of a combined suite writes assignment rows for its component rooms, so the same constraint prevents component double-sale — no special-case code.
- **Room-type-level availability** (ADR-011/Ch 24/30 finding) is a *derived* count layered above physical assignment (for OTA/booking-engine sell), not a competing source of truth.

**Holds** (ADR-006 T1, review Ch 22 finding): `holds(room_id or room_type_id, date_range, expires_at, session_ref)` participate in availability computation with TTL; a background sweep (ADR-003) expires them. The exclusion constraint is the last line; holds prevent the race from getting that far during the wizard/checkout.

Concurrency behavior: overlapping inserts → one commits, the other gets a constraint violation mapped to the stable `RESERVATION_ROOM_CONFLICT` error (Ch 16 registry). The state machine's optimistic version check (ADR-006 §3.3) handles the edit races; this constraint handles the create races. Both are covered by the mandatory concurrency test suite (13.14).

---

## 13.10 Financial schema shape — from ADR-002

- **`journal_entries`** (header) + **`journal_lines`** (balanced legs): a deferred constraint / trigger enforces **Σ lines = 0 per entry per currency**; both tables **append-only** (UPDATE/DELETE revoked for the app role). Corrections = reversing entries (`reversal_of`).
- **`accounts`**: the chart of accounts (assets/liabilities/revenue/contra), org-extensible; cash registers, guest AR, deposits-held, taxes-payable, gateway-clearing each map to accounts.
- **`folios`** + **`folio_lines`**: the operational surface; every folio line references exactly one journal entry (FK). Outstanding balance = the folio's AR account balance, **derived** (never a stored editable field).
- **`night_audit_runs`**: `(hotel_id, business_date)` unique; idempotent; records posting summary; advances `current_business_date`; feeds locked-day reporting.
- **Period locks**: `accounting_periods(organization_id, period, status)` — postings with `business_date` in a closed period are rejected (trigger). Makes 26.48 reproducibility true by mechanism.

---

## 13.11 State & status columns — from ADR-006

- `reservations.status` (and room/task/work-order/shift status) is a typed enum; **only the state-machine module writes it** (lint + a trigger rejecting status changes without the executor's transaction GUC).
- Every row carries `version INT` for optimistic concurrency (ADR-006 §3.3); mismatched version on write → `CONFLICT` (409).
- `reservation_nights` stores the **priced rate per night, snapshotted at booking** (ADR-002 / review Ch 22 rate-snapshot rule) — room moves/extends reprice only with explicit consent, never implicitly.

---

## 13.12 Outbox, inbox, audit tables — from ADR-003

- **`outbox_events`**: `id UUIDv7`, `organization_id`, `aggregate_type/id`, `event_type`, `event_version`, `payload JSONB`, `occurred_at`, `published_at?`, `attempts`. Written in the business transaction; relayed with `FOR UPDATE SKIP LOCKED`; archived/partitioned on retention.
- **`consumer_inbox`**: `(consumer_name, event_id)` unique — the idempotency ledger; duplicate delivery is a no-op.
- **`audit_records`**: append-only, immutable (grants revoked), `(organization_id, entity_type, entity_id, action, before JSONB, after JSONB, actor, occurred_at, ip)`; GDPR reconciliation via crypto-shredding of PII payloads (ADR-012), not deletion.

---

## 13.13 Indexing standards

- **Composite indexes lead with `organization_id`** (13.3), then the selective predicate — matches RLS and the common `WHERE org AND …` shape.
- **Range/exclusion**: GiST for the no-overlap constraint (13.9); btree_gist for mixed equality+range.
- **Search**: GIN `gin_trgm_ops` on normalized name columns + FTS `tsvector` GIN (ADR-011 §3.1); exact-lane btree on `phone_e164`, `email_normalized`, number shadow columns.
- **Foreign keys indexed** (Postgres does not auto-index them) — a standing review-checklist item.
- **Partial indexes** for soft-delete (`WHERE deleted_at IS NULL`) and active-status hot paths.
- **Hot-path budget**: new queries touching reservation/folio/journal hot tables require an `EXPLAIN` review and must meet the perf-suite budgets (ADR-011 §3.4 numbers for search; per-endpoint P95 from the NFR sheet for the rest). No unbounded-offset pagination — keyset/cursor per Ch 14 standard.

---

## 13.14 Migration discipline

- **Expand/contract only** (Ch 42 finding): additive migration → deploy code using both → backfill → contract in a later migration. **No destructive change in the same deploy that stops using a column.**
- Every migration is **backward-compatible with the currently-running version** (zero-downtime; supports rolling deploys and the N/N−1 API skew of ADR-004/010).
- Migrations are forward-only in production; "rollback" = a new compensating migration (never `migrate reset`).
- RLS policies, exclusion constraints, and the append-only grants are **created in migrations** and asserted in CI — they are schema, not setup scripts.
- Large backfills run as jobs (ADR-003), batched, resumable, tenant-aware — never inline in a migration transaction.

---

## 13.15 CI-enforceable checks (the schema contract, automated)

1. **Tenancy**: every table with `organization_id` has a forced RLS policy (`pg_policies` introspection); app role lacks `BYPASSRLS` and lacks UPDATE/DELETE on `journal_*` and `audit_records`.
2. **Temporal**: no `TIMESTAMP WITHOUT TIME ZONE`; `*_at`↔`TIMESTAMPTZ` and `*_date`↔`DATE` suffix/type match.
3. **Money**: no float columns for monetary values; every amount column has a paired currency; lint bans float math on `*_minor`.
4. **Identity**: PKs are UUID; no serial/bigserial exposed as public identifiers.
5. **Invariant**: the no-overlap exclusion constraint exists and rejects overlapping active stays (concurrency test: parallel bookings on one room → exactly one succeeds).
6. **Ledger**: unbalanced journal entry rejected; global trial balance = 0 after randomized operation sequences (ADR-002 check).
7. **Boundaries**: no cross-module table joins (static analysis on query ASTs / repository layering); Prisma client imported only via the tenancy wrapper.
8. **FK indexing**: every FK column is indexed.
9. **Migration**: CI applies migrations forward on a prod-shaped snapshot and asserts backward compatibility (previous app version boots against the new schema).

---

## 13.16 Diagrams to produce (tracked deliverables)

These are required artifacts (review defect D-7), authored alongside implementation, kept in `docs/architecture/diagrams/`:

1. **ERD per bounded context** (13.8) + the cross-context id-reference map.
2. **Reservation lifecycle state diagram** (ADR-006 matrix rendered).
3. **Availability / no-overlap** illustration (date-range half-open semantics).
4. **Folio ↔ journal posting** flow (a charge → folio line → balanced entry → account balances).
5. **Night-audit sequence** (post → mark no-show → roll date → lock).
6. **Outbox → relay → consumers / SSE** sequence.
7. **Tenancy model** (pooled + RLS, dedicated tier, cells) — from ADR-001.

---

## 13.17 Open items handed to other specs

- Full column-level DDL → the Prisma schema + migrations (this chapter is its acceptance criteria).
- Capacity thresholds / partition sizes → the Capacity Planning doc (Missing Documents #20); referenced by ADR-001 §3.4 tier triggers.
- PII field inventory & retention schedule → the Privacy Engineering spec (Blocker #6); drives 13.7 encryption annotations.
- Warehouse dimensional model → Chapter 40 rework (separate from this OLTP chapter).

## 13.18 References

- ADR-001…015 (this chapter is their persistence consolidation).
- PMS-1.2-Architecture-Review.md — Blocker #1 (data architecture), #2 (double-booking), #4 (ledger); defects D-2, D-7; Top-100 items 1, 2, 4, 39.
- PostgreSQL 16 docs: exclusion constraints, RLS, range types, `btree_gist`, `pg_trgm`.
