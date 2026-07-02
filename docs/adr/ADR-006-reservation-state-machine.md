# ADR-006: Reservation State Machine

| | |
|---|---|
| **Status** | Proposed (awaiting approval by architecture owner) |
| **Date** | 2026-07-02 |
| **Deciders** | LBL Architecture Owner |
| **Spec chapters affected** | 22.3 (amended), 27.19 (aligned), 21 (calendar actions), 24 (room status interplay), 30 (OTA-driven transitions), 31 (booking engine) |
| **Review findings resolved** | Blocker #12 (partially); Top-100 item 12; Detailed review Ch 22 finding 1 |
| **Depends on** | ADR-002 (no-show at night audit, folio settlement), ADR-003 (transition events), ADR-007 (date guards) |
| **Depended on by** | Chapter 13 (status enum + constraints), ADR-006 pattern reused by room/housekeeping/work-order state machines |

---

## 1. Context

Chapter 22.3 lists reservation states; no chapter defines **which transitions are legal, who may perform them, what guards apply, and what side effects fire**. The spec even disagrees with itself: 22.3's lifecycle contains both "Checked In" and "In House" as separate stages, while 27.19's funnel omits "In House" entirely. Without a canonical transition matrix, every module (calendar drag, drawer quick actions 21.51, context menu 21.54, OTA imports 30.9, booking engine 31.17, night audit) will implement its own subset of rules, and every invalid-transition bug in production will trace back to this gap.

### Decision drivers

1. One canonical state set and transition matrix — the single source both code and documentation render from.
2. Exactly one code path may change reservation status (22.3's own rule "always in exactly one state" is only enforceable with a single executor).
3. Guards must compose the platform's other invariants: availability (exclusion constraint), business dates (ADR-007), payment policy, permissions (Ch 29).
4. Every transition is an auditable business event (Ch 17) and an outbox event (ADR-003) — automations, notifications, channel sync, and read models all key off transitions.
5. Concurrency safety: two staff members (or OTA webhook + staff) racing on one reservation must resolve deterministically (21.72).
6. The pattern must be reusable: rooms (24.25), housekeeping tasks (25.10), work orders (36.9), cash-register shifts (26.6) all need the same machinery.

---

## 2. Options considered

### Option A — Status as a plain column, transitions in ad-hoc service code (implicit spec status quo)
- ❌ Rules drift across modules; the 22.3/27.19 inconsistency becomes runtime behavior. **Rejected.**

### Option B — Heavy workflow engine (BPMN-class) for reservation lifecycle
- ❌ Order-of-magnitude more machinery than the problem; couples core domain to an engine; wrong tool (this is an entity lifecycle, not a long-running process). **Rejected.**

### Option C — Declarative transition table + single in-code executor — **chosen**
The matrix lives as data (a versioned table in code); one `ReservationStateMachine` service interprets it; the same executor pattern is reused platform-wide.

---

## 3. Decision

### 3.1 Canonical states (amends 22.3, aligns 27.19)

`INQUIRY → PENDING → CONFIRMED → CHECKED_IN → CHECKED_OUT → COMPLETED`, plus `CANCELLED` and `NO_SHOW`.

- **"In House" is removed as a state** — it is the same condition as `CHECKED_IN` (22.3 amended). UI may display "In house" as a label; the machine has one state.
- **`CHECKED_OUT` vs `COMPLETED`:** `CHECKED_OUT` = guest departed, folio may still be open (city-ledger billing, pending charges). `COMPLETED` = all folios settled and closed (ADR-002 §3.3). This distinction is what makes "checked out with outstanding balance" (26.38) representable instead of exceptional.
- `CANCELLED` and `NO_SHOW` are terminal-with-exception: the only exit is the audited Reopen transition (22.27).

### 3.2 Transition matrix (normative)

| # | From → To | Trigger | Guards | Key side effects |
|---|---|---|---|---|
| T1 | INQUIRY → PENDING | staff/booking engine | required fields (22.6) | hold created (TTL) |
| T2 | PENDING → CONFIRMED | confirm / payment per policy | availability (DB exclusion constraint), policy deposit rules | inventory committed; channel sync job; confirmation notification |
| T3 | INQUIRY/PENDING → CANCELLED | staff, guest (31.21), OTA, hold expiry | reason mandatory | hold/inventory released |
| T4 | CONFIRMED → CHECKED_IN | check-in (22.39) | `current_business_date ≥ arrival_date` (early-arrival flag otherwise); room vacant+clean or override; guest identity per jurisdiction; not already checked in | room → occupied; `checked_in_at` instant; registration job (gov reporting) |
| T5 | CONFIRMED → CANCELLED | staff/guest/OTA | cancellation policy applied (fees → folio per ADR-002) | inventory released; channel sync; refund flow if due |
| T6 | CONFIRMED → NO_SHOW | **night audit auto** (ADR-002 §3.4.2) or manual | `current_business_date > arrival_date`; no check-in | no-show fee per policy; inventory released; channel sync |
| T7 | CHECKED_IN → CHECKED_OUT | check-out (22.50) | open charges resolved or explicitly moved to city ledger; warnings surfaced (22.50) | room → dirty; housekeeping task; `checked_out_at`; revenue/occupancy updates |
| T8 | CHECKED_OUT → COMPLETED | folio settlement (auto when last folio closes) | all folios settled & closed | guest stats update (23.9/23.25) |
| T9 | CANCELLED/NO_SHOW → PENDING | Reopen (22.27) | availability revalidated; within reopen window (org-configurable); permission `reservation.reopen` | original history preserved; channel sync |
| T10 | CHECKED_IN → CHECKED_IN (room move / extend) | not a state change | availability for new room/dates; repricing consent (ADR-002/review 22 rate-snapshot rule) | move/extension events |

Anything not in the table is **illegal** and rejected with a stable error code (Ch 16 registry). Dates in guards are business dates (ADR-007). Forced transitions (manager override of a guard) exist only where the matrix marks a guard overridable, require permission `reservation.force_transition` + mandatory reason, and are audited as overrides.

### 3.3 Single executor

- One `ReservationStateMachine` service is the **only** writer of `reservations.status`. Enforcement: lint (no direct status assignment outside the module) + DB trigger rejecting status changes not accompanied by the executor's transition context (session GUC, same mechanism family as ADR-001).
- Executor responsibilities per transition, in one transaction: validate guards → apply state + entity changes → append audit record (Ch 17) → write outbox event `reservation.<transition>` (ADR-003) → return the new state with its **legal next actions**.
- **Optimistic concurrency:** transitions carry the expected row `version`; a lost race returns a conflict (409 + current state) — the deterministic resolution 21.72 requires. OTA-driven transitions (30.9/30.20) go through the same executor with a channel principal.

### 3.4 Legal-actions projection (API contract)

Every reservation read returns `allowed_actions` computed from the matrix + current user's permissions (e.g., `["check_in","cancel","move"]`). Clients (calendar context menu 21.54, drawer 21.51, mobile, public API 37) render from it and **never reimplement transition rules** — resolving review Ch 22 finding 18.

### 3.5 Platform pattern

The executor + declarative-table pattern is the platform standard for stateful entities: room occupancy & housekeeping axes (24.7 two-axis finding), cleaning tasks (25.10), work orders (36.9), shifts (26.6), tenant lifecycle (48.28). Each defines its own matrix; the machinery, enforcement, and testing approach are shared. This ADR authorizes one shared implementation, not per-module forks.

---

## 4. Consequences

**Positive**
- 22.3/27.19 inconsistency resolved at the source; funnel, calendar, drawer, OTA, and night audit share one rulebook.
- The matrix is executable documentation: tests, API `allowed_actions`, and the ops training handbook (review Ch 22 finding 20) all generate from the same table.
- Invalid-transition bugs become impossible-by-construction rather than review-caught.

**Negative / accepted costs**
- The executor is a chokepoint by design; its transaction does more work (audit + outbox + side-effect orchestration) — acceptable, and consistent with ADR-002/003 write paths.
- Matrix changes are now governed changes (spec + code + tests move together) — slower than ad-hoc edits, which is the point.

**Risks & mitigations**
- *Risk:* side-effect creep bloats transitions (everything wants to hook check-in). → direct side effects limited to state-consistency essentials (room status, folio, audit, outbox); everything else consumes the outbox event (notifications, automations, sync) — the boundary rule is part of this ADR.
- *Risk:* group reservations (22.30) perform bulk transitions with partial failures. → bulk = per-reservation transitions with an explicit partial-failure report; no "group state" exists in v1.

---

## 5. Compliance checks (CI-enforceable)

1. Exhaustive matrix test: generated from the table — every legal transition succeeds from fixture state; every `(state, trigger)` pair *not* in the table is rejected with the stable error code.
2. Concurrency test: two racing transitions on one reservation — exactly one succeeds, the other receives 409 with current state (extends the ADR-001/Blocker-#2 concurrency suite).
3. Lint: `status` field assignable only inside the state-machine module.
4. Event/audit test: every executed transition produced exactly one audit record and one outbox event with matching transition metadata.
5. Contract test: `allowed_actions` for each (state × role) fixture matches the matrix ∩ permission set.

## 6. Open questions (tracked, not blocking)

1. Cancellation-policy engine (fees/deadlines per rate plan) — its own spec (review Top-100 #20); T5/T6 consume it via the policy interface.
2. Reopen-window default and per-org bounds — product decision at implementation.
3. Day-use stays (same-day arrival/departure) — matrix-compatible; blocked on the Ch 22 domain decision, not on this ADR.

## 7. References

- PMS-1.2-Architecture-Review.md — Blocker #12, Top-100 item 12.
- PMS-1.2-Architecture-Review-Detailed.md — Ch 22 findings 1/8/12/18, Ch 21 finding 8, Ch 24 finding 1.
- ADR-002 (night audit, folios), ADR-003 (outbox), ADR-007 (business-date guards).
