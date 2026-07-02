# ADR-001: Multi-Tenancy Data Model

| | |
|---|---|
| **Status** | Proposed (awaiting approval by architecture owner) |
| **Date** | 2026-07-02 |
| **Deciders** | LBL Architecture Owner |
| **Spec chapters affected** | 28 (Multi-Hotel), 40 (Data Platform), 42 (Infrastructure), 45 (DR/Backup), 48 (Multi-Tenant Enterprise), 12 (Backend), 17 (Audit), 23 (Guest CRM) |
| **Review finding resolved** | Blocker #3 / Improvement #3 in PMS-1.2-Architecture-Review.md |

---

## 1. Context

The LBL PMS specification promises tenant isolation "at every architectural layer" (48.4), operational independence of hotels (28.2), data residency options (48.20), per-organization compliance settings (48.21), and scale from 1 hotel to thousands of organizations (28.29, 48.29). It never chooses the mechanism. Every one of those promises resolves to one decision: **how tenant data is partitioned in PostgreSQL and enforced at runtime.**

This is the single most expensive decision in the platform to change retroactively. It must be made before Chapter 13 (Data Architecture) is written, because every table design depends on it.

**Definitions used below:**
- **Tenant** = an *Organization* (the top of the 48.3 hierarchy). Hotels, branches, floors, rooms are *scoping* levels inside a tenant, not tenants themselves.
- **Isolation** = a guarantee that a request executing in the context of Organization A can never read or write Organization B's rows, even in the presence of an application bug.

### Decision drivers

1. **Stage-1 reality (Ch 12):** small team, Express + Prisma + one managed PostgreSQL, low ops budget. Hundreds of small tenants must be nearly free to host.
2. **Security depth:** a single forgotten `WHERE organization_id = ?` must not become a cross-tenant breach. Application-level filtering alone is not acceptable for a system holding passports and payments.
3. **Migration cost:** one `prisma migrate deploy` must update all tenants; per-tenant migration fan-out is unaffordable for this team size.
4. **Per-tenant operations (Ch 45/48):** restore one tenant to a point in time; export a tenant (48.24); migrate a tenant between regions (48.23); delete a tenant completely (GDPR).
5. **Data residency (48.20):** some tenants will contractually require data to stay in a region.
6. **Enterprise sales:** large customers ask for dedicated infrastructure and single-tenant options (review finding Ch 28 #19).
7. **Analytics (Ch 40):** cross-tenant platform analytics and per-tenant BI must both be possible.
8. **Noisy neighbor:** one tenant's heavy report must not degrade another tenant's check-in (28.30, restated honestly as blast-radius reduction).

---

## 2. Options considered

### Option A — Pooled: shared schema, `organization_id` column, application-level filtering only
Every business table carries `organization_id`; every query filters in application code (Prisma middleware).

- ✅ Simplest; zero DB-level complexity; single migration; cheapest per tenant.
- ❌ **One forgotten filter = breach.** The guarantee rests entirely on code review. For a PMS holding identity documents and money, this fails driver #2.
- ❌ No structural support for per-tenant restore/export beyond ad-hoc queries.

**Rejected as the sole mechanism.** Application filtering remains (for query efficiency and UX), but cannot be the enforcement layer.

### Option B — Pooled + PostgreSQL Row-Level Security (RLS)
Same as A, plus `ROW LEVEL SECURITY` policies on every tenant-scoped table. The application sets the tenant context per transaction (`SET LOCAL app.current_org_id = '<uuid>'`); Postgres itself refuses to return or mutate rows of any other tenant. The app connects as a role **without** `BYPASSRLS`, and tables use `FORCE ROW LEVEL SECURITY`.

- ✅ Defense in depth: an application bug degrades to "empty result", not "data breach".
- ✅ One schema, one migration, one connection pool — Stage-1 compatible.
- ✅ Works with Prisma via a client extension that wraps queries in a transaction and issues `SET LOCAL` (established pattern; compatible with PgBouncer in transaction mode because `SET LOCAL` is transaction-scoped).
- ✅ Cross-tenant platform analytics possible via a separate reporting role with explicit, audited policies.
- ⚠️ Small per-query overhead (negligible with correct composite indexes led by `organization_id`).
- ⚠️ Per-tenant restore is procedural, not native: PITR-restore to a side instance, then logically extract one organization (runbook required).
- ❌ Shared failure domain: the database is one blast radius for availability (not for confidentiality).

### Option C — Schema-per-tenant
One PostgreSQL schema per organization; identical tables in each.

- ❌ Migration fan-out: every migration runs N times; a failure mid-fleet leaves tenants on mixed schema versions — operationally unaffordable for this team.
- ❌ Prisma has no first-class multi-schema-per-tenant support; tooling becomes bespoke.
- ❌ Catalog bloat and connection-pool fragmentation at thousands of tenants.
- ✅ Cleaner per-tenant dump/restore than B.

**Rejected.** Worst of both worlds at this team size: pooled's blast radius with siloed's ops burden.

### Option D — Database-per-tenant (for all tenants)
One database (or cluster) per organization.

- ✅ Strongest isolation: confidentiality, blast radius, per-tenant restore, residency all become trivial.
- ❌ Cost and ops scale linearly with tenant count — hundreds of small hotels at Stage 1/2 cannot each pay for a managed Postgres.
- ❌ Cross-tenant analytics requires a separate aggregation pipeline from day one.
- ❌ Migration fan-out, same as C.

**Rejected as the default. Adopted as the premium tier in Option E.**

### Option E — Tiered hybrid (chosen)
Pooled + RLS (Option B) as the **default tier**, with a **dedicated tier** (Option D: separate database, same schema, same codebase) for tenants that need it. A platform-level **tenant directory** maps `organization_id → connection target + region + tier`. At global scale, regional deployments become **cells** (one full stack per region), and tenants are homed to exactly one cell.

---

## 3. Decision

**LBL adopts a tiered tenancy model:**

1. **Default tier — pooled with RLS.** All tenant-scoped tables live in one PostgreSQL schema, carry `organization_id`, and are protected by `FORCE ROW LEVEL SECURITY` policies keyed to `current_setting('app.current_org_id')`. The application role has no `BYPASSRLS`. Application code *additionally* filters by tenant (belt and suspenders), but **RLS is the enforcement layer**.
2. **Dedicated tier — database-per-tenant** for organizations that require it (contractual isolation, residency, or scale triggers below). Identical schema and code; only the connection target differs, resolved through the tenant directory.
3. **Regional cells at Stage 4+ (48.18).** Residency is satisfied by homing a tenant to a regional cell, never by cross-region row-level routing inside one database.
4. **The tenant key is `organization_id` (UUID), denormalized onto every tenant-scoped table** — including tables where it is derivable via joins (reservations, payments, audit records). Rationale: RLS policies and indexes must not depend on join paths.

### 3.1 Schema rules (input to Chapter 13)

- Every tenant-scoped table: `organization_id UUID NOT NULL REFERENCES organizations(id)`, first column of the primary composite indexes: `(organization_id, …)`.
- Every `UNIQUE` constraint on business identity includes the tenant scope, e.g. rooms: `UNIQUE (branch_id, room_number)` where `branch_id` itself is tenant-owned; reservation numbers: `UNIQUE (organization_id, reservation_number)`.
- Cross-tenant foreign keys are **structurally impossible**: FKs between tenant-scoped tables must join on composite keys including `organization_id`, or reference IDs that are globally unique and tenant-checked by RLS on both sides.
- Platform-global tables (no `organization_id`, no RLS): `organizations`, `tenant_directory`, platform staff/users, plans/billing catalog, marketplace registry. Access to these is platform-role gated.
- The double-booking exclusion constraint (review Blocker #2) is tenant-safe by construction: `EXCLUDE USING gist (room_id WITH =, stay_range WITH &&)` — `room_id` is globally unique and RLS-scoped.

### 3.2 Runtime rules

- **Context propagation:** every unit of work (HTTP request, background job, automation execution, event handler) runs inside a transaction that first executes `SET LOCAL app.current_org_id = $1`. A Prisma client extension enforces this; **no query may execute without tenant context or an explicit, logged `PLATFORM_CONTEXT`** (for platform-admin and cross-tenant analytics paths).
- **Background jobs** (outbox relays, channel sync, notifications) carry `organization_id` in the job payload and re-establish context before touching the DB.
- **Connection pooling:** PgBouncer transaction mode is compatible because `SET LOCAL` is transaction-scoped. Session-mode pooling with `SET` (non-LOCAL) is forbidden.

### 3.3 Isolation beyond PostgreSQL (RLS covers only the database)

The same tenant boundary must be enforced in every adjacent store. This checklist is normative:

| Surface | Rule |
|---|---|
| Cache (Redis) | Keys prefixed `org:{organization_id}:…`; no unprefixed tenant data. |
| File/object storage | Per-tenant path prefix; access only via presigned URLs generated under tenant context. |
| Search indexes | Tenant filter mandatory in every query; or index-per-tenant at dedicated tier. |
| AI vector store (39.26) | Namespace-per-tenant; retrieval scoped before ranking. |
| Events / webhooks / logs / metrics / traces | `organization_id` is a mandatory field on every event, log line, and metric label (also required by review findings Ch 28 #13–14). |
| Data warehouse (Ch 40) | Tenant key on every fact/dimension row; row-level security in the semantic layer (40.28). |

### 3.4 Tier assignment and triggers

Default: every new organization starts pooled. Move to the dedicated tier when **any** of:

- Contractual requirement (enterprise deal, data residency in a region without a pooled cell).
- Sustained load: tenant exceeds ~20–25% of pooled-cluster capacity (CPU, IOPS, or storage) for 30 days.
- Compliance: tenant requires customer-managed encryption keys (BYOK) or independent restore SLA.
- Row volume: tenant's hot tables exceed thresholds where pooled index bloat degrades neighbors (set concrete numbers in Chapter 13 capacity planning).

Tenant moves between tiers via the export/import machinery of 48.23–48.24 (logical replication or dump/restore with verification checksums), during a declared maintenance window for that tenant only.

### 3.5 Per-tenant operations (resolves Ch 45 finding #1)

- **Restore one tenant:** PITR-restore the pooled cluster to a side instance at time T, logically extract one `organization_id` slice, validate row counts/checksums, re-import into production under a restore runbook. Target: RTO per 45.10 "Standard Services". Dedicated-tier tenants get native PITR.
- **Export/delete a tenant:** the same slice extractor serves 48.24 export and GDPR-complete deletion (with crypto-shredding of per-tenant encryption keys once ADR for field encryption lands).
- **Backups** remain cluster-level (45.5); the slice extractor is the tenant-granular layer on top. The extractor is a **v1 deliverable**, not tooling debt — restore stories fail without it.

### 3.6 Honest restatement of 28.30

"Failures in one hotel must not affect others" is achievable for *confidentiality* (RLS) and *blast-radius reduction* (per-tenant rate limits, `statement_timeout`, work-queue fairness, per-tenant job quotas), but **not** for *availability* within the pooled tier — a pooled-cluster outage affects all pooled tenants. True availability isolation exists only at the dedicated tier and cell level. Chapter 28.30 must be amended accordingly; the spec must not promise what the architecture does not deliver.

---

## 4. Consequences

**Positive**
- Cross-tenant leakage requires *two* independent failures (app bug **and** RLS policy gap) instead of one.
- One schema, one migration path, one codebase across both tiers; Stage-1 cost profile preserved.
- Enterprise/residency deals are servable without re-architecture (tier flag + directory entry).
- Chapter 13 can now be written; the schema rules in §3.1 are its constraints.

**Negative / accepted costs**
- Prisma + `SET LOCAL` requires wrapping all data access in transactions via a client extension — a nontrivial but one-time infrastructure investment; it must be built **before** feature code multiplies.
- RLS adds per-query planning overhead (single-digit % with correct indexes; measure in CI perf suite).
- Per-tenant restore in the pooled tier is procedural (runbook + extractor), not native.
- Platform-context code paths (analytics, support impersonation) bypass RLS by design and therefore need their own audit and review gate — they are the new most-dangerous code in the system.

**Risks & mitigations**
- *Risk:* a table ships without RLS policy. → **CI structural test:** introspect `pg_policies`; every table with `organization_id` must have a forced policy; build fails otherwise.
- *Risk:* cross-tenant bug in non-DB surfaces (cache, search, files). → §3.3 checklist enforced by the same review gate + cross-tenant invisibility test suite (every integration test class asserts Organization B sees nothing of Organization A — review finding Ch 28 #3).
- *Risk:* pooled hot-spot tenant. → per-tenant quotas + tier-migration triggers (§3.4), monitored via tenant-labeled metrics.

---

## 5. Compliance checks (CI-enforceable)

1. `pg_policies` coverage test — no tenant table without a forced RLS policy.
2. Cross-tenant invisibility suite — two seeded orgs; every API endpoint asserted for zero leakage in both directions.
3. Lint rule — no raw Prisma client import outside the tenancy-wrapped client module.
4. Event/log schema test — `organization_id` present on every emitted event and structured log line.
5. Restore drill — quarterly execution of the tenant slice-extract runbook against staging (feeds 45.25).

---

## 6. Open questions (tracked, not blocking)

1. Per-tenant encryption keys / BYOK — separate ADR (interacts with GDPR crypto-shredding, review Blocker #6).
2. Exact capacity thresholds for tier migration — Chapter 13 capacity planning.
3. Whether the dedicated tier shares the pooled cluster's PgBouncer fleet or gets isolated poolers — Stage-3 infra detail.
4. Global user identity across organizations (same email, two orgs) — Account-model ADR (review Ch 15 finding #6).

## 7. References

- PMS-1.2-Architecture-Review.md §6 Blockers #3, #5; Top-100 items 3, 78.
- PMS-1.2-Architecture-Review-Detailed.md — Chapters 28, 45, 48 findings.
- PostgreSQL docs: Row Security Policies; `FORCE ROW LEVEL SECURITY`; `SET LOCAL`.
