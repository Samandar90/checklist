# ADR-008: Authorization Policy Engine (RBAC + ABAC Evaluation)

| | |
|---|---|
| **Status** | Proposed (awaiting approval by architecture owner) |
| **Date** | 2026-07-02 |
| **Deciders** | LBL Architecture Owner |
| **Spec chapters affected** | 29 (all), 41.7 (ABAC), 15.11, 27.33 (report filtering), 39.7 (AI permission awareness), 46.8 (plugin permissions) |
| **Review findings resolved** | Top-100 item 25; Detailed review Ch 29 findings 1, 3, 4 |
| **Depends on** | ADR-001 (scopes are tenant hierarchy), ADR-003 (invalidation events), ADR-004 (identity, no permissions in tokens) |
| **Depended on by** | ADR-006 (`allowed_actions`), every module's enforcement, future SSO ADR (group→role mapping) |

---

## 1. Context

Chapter 29 specifies an unusually rich authorization model: multi-role RBAC with deterministic conflict resolution (deny → allow → inherited → no access, 29.12), hierarchical scopes (org → hotel → branch → department → resource, 29.10), temporary permissions with auto-expiry (29.13), delegation (29.14), org-defined custom roles (29.17), and a visual permission matrix (29.16). Chapter 41.7 layers ABAC on top (time, location, device trust, risk score, ownership). **No chapter chooses the evaluation machinery.** The review's warning stands: implemented as scattered TypeScript conditionals, this model *will* diverge from the matrix, and authorization bugs in a system holding money and passports are breach-class bugs.

### Decision drivers

1. **Exact 29.12 semantics**, provable by property tests — not approximated by a third-party engine's different precedence model.
2. **Per-request cost ~0**: authorization runs on every API call; with ADR-004 keeping permissions out of tokens, evaluation must be cached aggressively with correct invalidation.
3. **Single source of truth**: roles, memberships, grants already live in Postgres under ADR-001 tenancy — the engine must not require replicating this data into a second store.
4. **One engine, many enforcement points**: API middleware, service-layer asserts on money paths, `allowed_actions` projection (ADR-006), UI visibility (15.20), report row filtering (27.33), AI context gating (39.7), plugin scopes (46.8).
5. **Executable matrix**: 29.16 must be generated from the same data the engine evaluates — matrix and reality cannot drift.
6. **ABAC as extension, not rewrite** (41.7 arrives incrementally; risk scoring 41.23 doesn't exist yet).

---

## 2. Options considered

### Option A — OPA (Open Policy Agent, Rego)
- ✅ Battle-tested, expressive, sidecar or WASM-embedded.
- ❌ All role/membership/grant data must be synced into OPA's data documents — a second authorization database with its own staleness; Rego precedence must be hand-built to match 29.12 anyway; Rego skill is scarce in a small TS team.
- **Rejected for application authz.** OPA remains the right tool later for *infrastructure* policy (Terraform/K8s admission — Ch 42 finding).

### Option B — Cedar (AWS)
- ✅ Purpose-built policy language, formally verified core, good deny semantics.
- ❌ Same data-sync problem as OPA; Node bindings younger; entity-hierarchy modeling duplicates what our Postgres schema already encodes.
- **Rejected** — the cost is the data mirror, and it buys us a language we don't need (our policies are structured data, not free-form rules).

### Option C — Casbin (node-casbin)
- ✅ Mature, adapters for Postgres.
- ❌ Its model/matcher formalism becomes contorted expressing scope inheritance + explicit deny + temporal validity + delegation together; debugging generated matchers is worse than owning the evaluator.
- **Rejected.**

### Option D — Specified in-house evaluator over the native schema — **chosen**
The insight: **LBL's authorization "policies" are relational data, not rule text.** Roles, permissions, scoped assignments, denies, temporal windows, and delegations are rows we already own. The hard parts are (a) formal evaluation semantics, (b) caching with correct invalidation, (c) conformance testing — none of which an external engine provides for free once data-sync is accounted for. The review's warning targeted *hand-rolled ad-hoc conditionals*; the remedy is a **single specified evaluator**, not an imported language.

---

## 3. Decision

### 3.1 Permission model (normative data model, input to Chapter 13)

- **Permission identifier standard:** `module.action` (`reservations.create`, `finance.approve_refund`, `reports.export`) — the 29.8 × 29.9 grid as strings; the registry of valid identifiers is a versioned, PR-reviewed seed file (resolves Ch 29 finding 9).
- **Tables:** `roles` (platform-defined + org-custom, 29.17), `role_permissions` (role → permission), `user_role_assignments` (user, role, **scope**: org / hotel / branch, `valid_from` / `valid_to` for temporary grants 29.13, `delegated_by` for 29.14 — delegations are time-boxed assignments, not a separate mechanism), `user_permission_denies` (explicit deny at scope, 29.12's top precedence).
- **Role-granting is itself permissioned by a grant matrix** (which roles may assign which roles — resolves the privilege-escalation finding Ch 29 #5): `role_grant_rules(granter_role, grantable_role)`. API keys receive permission subsets with a ceiling ≤ creator's effective set (ADR-004 §3.3).

### 3.2 Evaluation semantics (the formal contract)

Effective decision for `(user, permission, scope-target)`:

1. Collect assignments active now (`valid_from ≤ now < valid_to`), expand to `(permission, granted-scope)` pairs.
2. A grant at a scope covers that node and all descendants (org grant ⇒ every hotel/branch); resource-level checks additionally verify entity ownership lineage (the entity's `organization_id/hotel_id/branch_id` chain — ADR-001 columns make this a pure attribute read).
3. Apply explicit denies: **deny at any covering scope wins over any allow** (29.12).
4. No matching allow ⇒ no access (default deny — now explicit, resolving Ch 29 finding 8).

The evaluator is one pure function over an immutable snapshot `(assignments, denies, role_permissions)` — property-tested (§5), no I/O inside.

### 3.3 Caching & invalidation

- The **effective permission set** per `(user, organization)` is computed once and cached (in-process + shared cache when Redis arrives) with a **version stamp**. All request-time checks are set lookups — O(1), no DB.
- Any mutation of roles/assignments/denies emits `authz.changed` via the outbox (ADR-003); consumers bump the version → next request recomputes. Staleness bound: seconds. **Sensitive endpoints** (ADR-004 §3.2 class) recompute-on-miss with a forced version check — permission revocation on money paths is effectively immediate.
- UI receives the same effective set at login and on `authz.changed` (thin event via ADR-005) — 15.20's "hide what you can't do" and ADR-006's `allowed_actions` both project from the *server-computed* set; the client never evaluates rules.

### 3.4 Enforcement points (one engine, declared requirements)

- **API middleware:** every route *declares* its required permission in route metadata (`{ permission: "reservations.create", scopeFrom: "body.branchId" }`); the middleware resolves and enforces. **Inline permission checks in controllers are banned** (lint) — undeclared routes fail CI (resolves "permission checks scattered" risk structurally).
- **Service-layer asserts** duplicate enforcement on money/PII paths (defense in depth, same evaluator).
- **Row filtering** (27.33, 40.28): list endpoints derive scope predicates (`hotel_id IN (…)`) from the effective set — one derivation helper, used by all list queries, layered *on top of* ADR-001 RLS (RLS = tenant wall; this = intra-tenant scoping).
- **Plugins (46.8)** and **AI context (39.7)** consume the same effective-set API with their own principals (plugin installation grants = permission subset; AI requests evaluate as the acting user).

### 3.5 ABAC layer (41.7)

Conditions optionally attached to assignments, evaluated **after** the RBAC pass from request context attributes: v1 ships `time_window` and `ip_range`; `device_trust` and `risk_score` activate when 29.23/41.23 land. Condition vocabulary is closed and versioned (no free-form expressions — auditable, testable). A failed condition behaves as "assignment not active," never as deny (preserves 29.12's precedence purity).

### 3.6 Decision audit

Every **deny** is logged with the evaluation trace (which rule matched / nothing matched) — feeds 17.14 and the "why can't I…" support flow (Ch 29 finding 14). **Allows are logged for the sensitive class only** (volume control). Denied-burst alerting per 29.24.

---

## 4. Consequences

**Positive**
- 29.12 semantics are code + property tests, not convention; the 29.16 matrix is generated from seed data and *asserted against the live API* in CI — matrix drift becomes a build failure.
- Zero external data-sync; authorization data inherits ADR-001 tenancy, backups, and audit for free.
- Route-declared permissions make the authorization surface greppable and reviewable — the security review gate (Ch 41) gets a machine-readable inventory.

**Negative / accepted costs**
- We own the evaluator's correctness — accepted deliberately; the property-test suite (§5) and the closed ABAC vocabulary are the containment.
- Custom roles across orgs (29.17 "reusable across hotels") mean org-scoped role definitions must be provisioned/templated — provisioning surface added to ADR-001's tenant-creation flow.
- Scope inheritance requires the entity-lineage columns everywhere — already mandated by ADR-001 §3.1; this ADR is a second consumer, reinforcing that schema rule.

**Risks & mitigations**
- *Risk:* evaluator edge-case divergence from spec intent. → executable spec: the 29.12 precedence table, temporal boundaries, and delegation expiry are QuickCheck-style property tests written *before* the evaluator (test-first mandated for this module).
- *Risk:* cache invalidation bug leaves revoked access live. → version-stamp protocol tested with chaos test (revoke → assert denial within bound); sensitive class force-checks.
- *Risk:* route metadata forgotten on new endpoints. → CI fails any route without a declared permission or an explicit `public: true` annotation (the dangerous default is impossible).

---

## 5. Compliance checks (CI-enforceable)

1. **Matrix conformance suite:** generated from `role_permissions` seed — every (role × permission × scope fixture) asserted against the real API (allow and deny directions). The review's core demand, automated.
2. Property tests: deny-wins at every scope combination; grant-at-ancestor ⇒ allow-at-descendant; expiry boundary (`valid_to` exact-second) ⇒ deny; delegation expiry ⇒ deny; no-assignment ⇒ deny.
3. Route inventory test: no route without declared permission or explicit `public: true`.
4. Lint: no imports of role/permission constants outside the engine + route metadata; no string comparison against role names in business code.
5. Invalidation test: role revoked → sensitive endpoint denies immediately; standard endpoint denies within the staleness bound.
6. Plugin/API-key ceiling test: granted subset can never exceed grantor's effective set.

## 6. Open questions (tracked, not blocking)

1. Department scope (29.10 lists it) — activate when an HR/department model exists; the scope hierarchy is extensible by design.
2. SoD rules (approver ≠ requester) — declarative constraints in the approval workflow spec, consuming this engine.
3. Shared-cache topology when Redis arrives — mechanical swap of the cache layer, protocol unchanged.

## 7. References

- PMS-1.2-Architecture-Review.md — Top-100 items 25, 40.
- PMS-1.2-Architecture-Review-Detailed.md — Ch 29 all findings; Ch 15 finding 4; Ch 27 finding "Security".
- ADR-001 §3.1 (lineage columns), ADR-003 (`authz.changed`), ADR-004 (no permissions in tokens), ADR-006 (`allowed_actions`).
