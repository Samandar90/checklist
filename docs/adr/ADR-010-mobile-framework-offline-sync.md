# ADR-010: Mobile Framework & Offline Synchronization Protocol

| | |
|---|---|
| **Status** | Proposed (awaiting approval by architecture owner) |
| **Date** | 2026-07-02 |
| **Deciders** | LBL Architecture Owner |
| **Spec chapters affected** | 43 (all — made concrete), 25.11/25.32 (housekeeping mobile, offline promoted to v1), 36.27 (mobile maintenance), 35 (offline counting), 22 (online-only boundary) |
| **Review findings resolved** | Detailed review Ch 43 findings 1 (framework), 1/8 (sync protocol & conflict table), 3 (release engineering), 5 (offline auth lease, offline scope boundary); Top-100 items 64, 65 |
| **Depends on** | ADR-003 (outbox cursors, inbox idempotency), ADR-004 (tokens, secure storage), ADR-006 (server-side transition validation), ADR-008 (permission snapshots) |
| **Depended on by** | Housekeeping/maintenance/inventory mobile implementations; mobile sync API contract |

---

## 1. Context

Chapter 43 declares the mobile app a first-class offline-capable client but leaves undecided: the framework (which determines hiring, storage options, code sharing, and the delivery pipeline), the actual synchronization protocol ("synchronization preserves operation order" is one sentence for one of the hardest problems in the document), the conflict-resolution bindings (43.9 lists five policies, binds none), the offline boundary for financial operations, and offline authorization staleness. Additionally 25.32 defers housekeeping offline to "future" while 43.6 makes it core — hotels have concrete-walled corridors and basements; **offline is the primary environment for the field personas**, so 25.32 is amended: offline housekeeping is v1.

### Decision drivers

1. Team leverage: the platform team is TypeScript/React (Ch 11); a second language stack is a hiring and consistency tax a small team cannot pay.
2. Offline-first for housekeeping, maintenance, inventory counting (43.6/43.17–19) with encrypted local storage (43.7).
3. Operation-order preservation, idempotent server application, and *visible* conflict handling — silent data loss in field operations is unacceptable.
4. Money safety: an offline payment that fails to sync is a lost-money incident — the boundary must be structural, not advisory.
5. Release reality: app-store review cycles vs continuously deployed backend → version-skew tolerance and an emergency-fix path.
6. Device capabilities: camera/QR (43.12–13), push (43.10), biometrics (43.20), MDM compatibility (43.22).

---

## 2. Options considered

### Option A — Native (Swift + Kotlin)
- ✅ Best raw performance and platform integration.
- ❌ Two codebases, two skill sets, zero sharing with the TS platform — triple cost for personas whose UI is lists, checklists, and scanners. **Rejected** (43.25's targets are comfortably achievable without native).

### Option B — Flutter
- ✅ Excellent UI consistency and performance; single codebase.
- ❌ Dart: a new language for a TS team; no type/validation sharing with the API layer; separate hiring profile. **Rejected.**

### Option C — PWA
- ❌ iOS background-sync and storage limits, no reliable MDM story, push limitations — wrong tool for field-staff devices. **Rejected** (the *booking engine* PWA of 31.26 is a separate, appropriate use).

### Option D — React Native + Expo (EAS) — **chosen**
- ✅ TypeScript end-to-end: shared types, shared validation (Zod), shared domain constants with the web app and generated API client (ADR-009's codegen serves both clients).
- ✅ Expo EAS: managed build/signing/submission, **staged rollouts, and OTA updates for the JS layer** — the emergency-fix path app stores can't give natively.
- ✅ Mature ecosystem for every 43.x capability: SQLite (encrypted), MMKV, vision-camera (QR), Notifee/FCM+APNs, biometrics, Sentry RN.
- ⚠️ Native-module edges (SQLCipher, MDM SDKs) require dev-client builds — accepted; EAS handles it.

---

## 3. Decision

### 3.1 Stack

React Native + Expo (EAS builds, dev clients). Local database: **SQLite with SQLCipher encryption**, keys held in Keychain/Android Keystore (43.7 mechanized). Small key-value state in encrypted MMKV. Crash reporting: Sentry RN with release/OTA-version tagging (43.24).

### 3.2 Offline scope boundary (normative — resolves the money question)

| Class | Offline? | Rationale |
|---|---|---|
| Housekeeping tasks, checklists, room status ops | ✅ | primary offline personas (43.17) |
| Maintenance work orders, checklists, parts usage | ✅ | 43.18 |
| Inventory counts, transfers, receiving | ✅ | 43.19; server reconciles |
| Notes, photos (queued upload, EXIF-stripped, compressed) | ✅ | 43.13 |
| **Payments, refunds, deposits, folio operations** | ❌ online-only | lost-money risk; ledger integrity (ADR-002) |
| **Check-in/check-out** | ❌ online-only | financial + state-machine effects (ADR-006); availability integrity |
| User/permission management, settings | ❌ online-only | security surface |

Online-only actions render disabled with an explicit "requires connection" state — a UI contract, enforced by the same capability flags the server sends.

### 3.3 Synchronization protocol (the design 43.8/43.16 was missing)

**Pull (server → device):** delta sync per subscribed scope (my tasks, my floors' rooms, my work orders). Cursor = outbox UUIDv7 id per scope (same ordering spine as ADR-005). `GET /sync/pull?scope=…&cursor=…` returns ordered changes + tombstones for deletes + new cursor. A cursor older than the retention horizon triggers a full scope re-download (the mobile analog of ADR-005's `resync`).

**Push (device → server):** an **append-only operation log**, not state snapshots. Each op: `{op_id (client-generated UUIDv7 — the idempotency key), entity_type, entity_id, op_type, payload, base_version, schema_version, created_at}`. Ops upload in order per entity; the server applies them **through the normal service layer** — the state machine (ADR-006), inventory rules, and permission checks (ADR-008) all run server-side; the client never gets a private write path. Duplicate `op_id`s are no-ops (ADR-003 inbox pattern). Result per op: `applied | rejected{code, reason} | conflict{server_state}`.

**Conflict policy table (binds 43.9 — normative per entity type):**

| Entity/op | Policy |
|---|---|
| Room / task status transitions | Server wins via state machine — an op invalid against current server state is **rejected**, never force-applied |
| Checklist item completion | Client wins (append-only facts) |
| Notes | Merge — both preserved with authorship (never overwrite) |
| Inventory count/movement | Additive ops; server recalculates stock; count conflicts flagged for supervisor review |
| Photos | Append-only, dedup by content hash |

**Rejected/conflicted ops land in a client-visible "needs attention" queue** with re-do affordances — silent drops are forbidden by contract, and the queue's age is a monitored metric.

**Schema evolution of queued ops:** ops carry `schema_version`; on app update, local migrations upgrade queued ops; the server accepts current and previous op-schema versions (N/N−1). If an op can't be migrated, it surfaces in "needs attention" rather than blocking the queue — resolving the review's hardest sync question explicitly.

### 3.4 Offline authorization lease (resolves Ch 43 finding 5)

Offline work runs under a **lease**: the last-issued access context (identity + permission snapshot per ADR-008) is valid offline for a configurable window (**default 24 h**, org policy 41.25 may shorten). Lease expiry → app locks to re-authentication; queued ops are preserved and upload after login. Device revocation (43.21/43.22 MDM) sets a server-side flag that rejects the device's next sync and instructs enterprise-data wipe. Biometric unlock (43.20) gates the *local* app/session; it never extends the lease.

### 3.5 Release engineering (resolves Ch 43 finding 3)

- **Release trains** via EAS: beta channel (internal + pilot hotels) → staged production rollout (10% → 50% → 100%).
- **OTA updates** for JS-only fixes; native changes ride store releases.
- **API skew contract:** the server supports app versions N and N−1 (ADR-004 note generalized); a server-driven `minimum_supported_version` forces upgrade for security fixes with a grace UI.
- App-store signing keys/accounts under documented custody (Ch 43 finding 11) — listed in the security handbook.

### 3.6 Monitoring

Sync success rate, **pending-op age** (p95 — *the* field-operations health metric), needs-attention queue depth, full-resync rate, OTA adoption curve, crash-free-session rate. All tenant-tagged per ADR-001.

---

## 4. Consequences

**Positive**
- One language across web/mobile/backend; shared types and the generated client kill an entire class of contract bugs on the weakest-connectivity client.
- The op-log + server-side application means mobile can never corrupt invariants: every offline action is re-validated by the same services as online actions.
- 43.9's vague policy list becomes a testable table; "needs attention" makes conflict handling a feature instead of a support ticket.

**Negative / accepted costs**
- Expo/RN native edges (SQLCipher, MDM) need dev-client builds and occasional native debugging — accepted; still far cheaper than two native teams.
- Server-side op application makes sync throughput a backend concern (Monday-morning reconnect storms) — mitigated by batched op upload, per-device rate limits, and worker-tier processing (ADR-003 infrastructure).
- N/N−1 op-schema support adds a compatibility test matrix — bounded and automated (§5.4).

**Risks & mitigations**
- *Risk:* long-offline devices produce huge op logs. → op-log size caps with early-upload nudges; lease expiry bounds the window structurally.
- *Risk:* clock skew on devices corrupts ordering. → server assigns authoritative order at application time; client timestamps are informational (UUIDv7 op_ids generated client-side are for identity, not global ordering — per-entity order is preserved by upload sequence).
- *Risk:* photo queues exhaust storage. → size/compression caps, queue quotas, oldest-first eviction with user warning.

---

## 5. Compliance checks (CI-enforceable)

1. Idempotency: every op fixture applied twice → single effect (server inbox test, mobile analog of ADR-003 check 3).
2. Conflict-table conformance: each policy row exercised (stale status transition → rejected + needs-attention; checklist → applied; note collision → both preserved).
3. Offline-boundary test: online-only actions unreachable in offline state (UI capability flags + server rejection both asserted).
4. Skew matrix: op schemas N and N−1 accepted; N−2 rejected with upgrade instruction; queued-op migration executes on fixture upgrade.
5. Lease test: expired lease blocks new ops locally, preserves queue, uploads after re-auth; revoked device's sync rejected server-side.
6. Local-storage audit: no PII outside the encrypted database/MMKV (filesystem scan in E2E harness).

## 6. Open questions (tracked, not blocking)

1. WatermelonDB vs plain OP-SQLite + hand-rolled sync tables — implementation-phase spike (protocol above is storage-agnostic).
2. Push-notification deep-link map (43.11) — with the Notification Center implementation.
3. Tablet/rugged-device support matrix (43.3) — product decision at pilot.
4. Guest-facing mobile app — explicitly out of scope (separate future product, Ch 43 finding 6).

## 7. References

- PMS-1.2-Architecture-Review-Detailed.md — Ch 43 all findings; Ch 25 finding 1; Ch 35 finding 19.
- ADR-003 (cursors/inbox), ADR-004 (secure storage, skew note), ADR-006 (server-side transitions), ADR-008 (permission snapshot).
- Expo EAS documentation; SQLCipher; OWASP MASVS (mobile security baseline).
