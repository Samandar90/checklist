# ADR-002: Financial Core — Double-Entry Ledger, Guest Folios, Night Audit

| | |
|---|---|
| **Status** | Proposed (awaiting approval by architecture owner) |
| **Date** | 2026-07-02 |
| **Deciders** | LBL Architecture Owner |
| **Spec chapters affected** | 26 (Finance & Cash Register), 22 (Reservation Engine), 27 (Reports), 35 (Inventory), 36 (Assets), 38 (Accounting Integrations), 46 (Marketplace billing) |
| **Review findings resolved** | Blockers #3 (no ledger) and #4 (no night audit); Top-100 items 4, 5, 45, 49, 50 |
| **Depends on** | ADR-001 (tenancy — all financial tables are tenant-scoped), ADR-003 (outbox — financial events), ADR-007 (business dates — posting date semantics) |

---

## 1. Context

Chapter 26 promises: "Money should never disappear. Every financial operation must be traceable, auditable, reproducible" (26.2), "one financial source of truth" (22.78), "historical reports must never change after closed accounting periods" (26.48), and future integration with QuickBooks/Xero/1C/SAP (26.46). The specified data model — flat transaction records with editable "Manual Adjustment" and "Correction" types (26.9), and closed-shift editing "with permission and approval" (26.21) — **cannot deliver any of those promises**:

- Flat records cannot *prove* balance. "Cash register balance" and "guest owes X" are recomputed aggregates with no structural guarantee they agree with the transactions.
- Editable corrections destroy reproducibility: a report re-run after an edit produces different numbers (violates 26.48 directly).
- Accounting integrations map to *journals and accounts*; without a chart of accounts there is nothing to map (38.10 is unimplementable).
- There is no end-of-day process: no room-charge posting for in-house guests, no automatic no-show marking, no daily journal, no locked business day. Every mature PMS (OPERA, Mews, Cloudbeds) has a night audit; its absence surfaces at the first month-end reconciliation.

Additionally, the payment providers named in the spec (Payme, Click, Uzum Bank) indicate Uzbekistan operations, where fiscal receipt requirements (ОФД) and gapless document numbering are law — the financial core must leave a socket for them.

### Decision drivers

1. Provable correctness: the sum of a guest's folio must *equal* the sum of its postings by construction, not by convention.
2. Immutability with correctability: history never changes; mistakes are corrected by new entries.
3. Reproducibility: any report for a closed period returns identical results forever (26.48).
4. Integration readiness: export to external accounting = journal export + account mapping.
5. Operational fit: reception staff think in "charges and payments on a reservation", not in debits/credits — the ledger must be invisible to them.
6. Jurisdiction fit: fiscalization, gapless invoice numbering, VAT — pluggable per legal regime.
7. Team fit: implementable by a small team on Postgres + Prisma without exotic infrastructure.

---

## 2. Options considered

### Option A — Keep flat transaction records (spec as written)
- ✅ Simplest to build; matches the current spec text.
- ❌ Fails drivers 1–4 (shown above). Fails a financial audit by design (editable closed periods).
- **Rejected.**

### Option B — Double-entry ledger + guest folios + night audit (in-house, Postgres) — **chosen**
Journal of balanced entries as the source of truth; folios as the operational surface; night audit as the daily posting/locking process.
- ✅ Meets all drivers; the pattern is 500 years old and well documented; fits Postgres/Prisma.
- ⚠️ Requires discipline: every money-touching feature posts through one service; no shortcuts.
- ⚠️ More upfront modeling than A (roughly 6 tables and one posting service).

### Option C — Delegate the ledger to an external accounting system (1C/QuickBooks as the book of record)
- ✅ No in-house accounting logic.
- ❌ PMS must operate standalone (offline hotels, trials, SMBs without accounting software); availability/latency coupling to a third party on the check-out path is unacceptable; per-jurisdiction system fragmentation.
- **Rejected.** External systems remain *consumers* of our journal (38.10), never the book of record.

### Option D — Embed an existing OSS ledger library
Surveyed class of options (ledger frameworks, ERP cores). None fit the TS/Prisma/Postgres stack without importing a foreign framework larger than the problem.
- **Rejected**; the schema in §3 is small and fully owned.

---

## 3. Decision

### 3.1 Double-entry ledger (the book of record)

- **`journal_entries`** — header: `id`, `organization_id`, `hotel_id`, `business_date` (per ADR-007), `created_at`, `source_type` + `source_id` (payment, folio_line, night_audit, shift_close, refund, dispute…), `description`, `reversal_of` (nullable self-reference).
- **`journal_lines`** — `entry_id`, `account_id`, `amount_minor` (signed BIGINT), `currency`; **constraint: lines of an entry sum to zero per currency**.
- **Append-only, enforced by the database**: `UPDATE`/`DELETE` revoked on both tables for the application role (same enforcement pattern as ADR-001 RLS). Corrections are **reversing entries** referencing the original via `reversal_of`. Chapter 26.9's "Manual Adjustment/Correction" types and 26.21's closed-shift editing are **amended**: both become reversal+repost operations in the open period.
- One **posting service** is the sole writer. No module inserts journal rows directly (lint + DB grants enforce).

### 3.2 Chart of accounts

Built-in minimal operational chart, org-extensible:

| Account class | Examples |
|---|---|
| Assets | Cash registers (one per register, 26.4), bank/transfer clearing, **gateway settlement clearing** (per provider), accounts receivable (guest ledger, corporate/city ledger) |
| Liabilities | **Deposits held**, taxes payable (per tax type), gift vouchers outstanding |
| Revenue | Accommodation, F&B, laundry, parking, other services (mirrors 26.24 categories) |
| Contra/expense | Refunds, discounts given, chargebacks, operational expenses (26.22 categories) |

External accounting integrations (38.10) are **account-mapping configurations** over this chart plus journal export — nothing more.

### 3.3 Guest folios (the operational surface)

- **`folios`** — belongs to a reservation (or standalone for walk-in POS-type sales); a reservation may have **multiple folios** (guest folio + company folio — this is how 22.28's "different payment methods / company pays room" splits work). Fields: `reservation_id`, `debtor` (guest or company), `status` (open/settled/closed).
- **`folio_lines`** — charge, payment, tax, discount, deposit-application; every line **is backed by exactly one journal entry** (FK to `journal_entries`). Room charges, mini-bar (22.48/22.69), extras, refunds — all are folio lines.
- Reception UI shows folios and lines; debits/credits never appear on screen (driver 5). "Outstanding balance" (22.74) = the folio's AR account balance — derived, never stored.
- Folio operations: **split** (move lines to another folio — with their journal references intact), **transfer** (room move keeps the folio), **settle** (payments cover balance), **close** (at check-out or later for city-ledger billing).

### 3.4 Night audit (end-of-day)

Per hotel, at a configurable **audit hour** (default 04:00 hotel-local; ADR-007 owns date semantics):

1. **Post room charges** for every in-house reservation for the elapsed night (rate snapshot from the reservation, per review finding 22 — nightly rates captured at booking).
2. **Mark no-shows** for reservations past arrival with no check-in (22.26), applying cancellation policy hooks.
3. **Roll the business date** for the hotel.
4. **Generate the daily journal summary** (feeds 26.34–26.40 reports and 27's daily KPIs — reports for closed days read the posted journal, not live recomputation).
5. **Lock the closed business date**: no postings with a `business_date` ≤ last closed date; late corrections post to the *current* date referencing the original entry.

Runs automatically (scheduled job per ADR-003 infrastructure) with a pre-audit checklist surface (pending arrivals/departures needing resolution) and manual re-run safety: **the whole process is idempotent** (re-execution posts nothing twice — enforced by unique `(source_type, source_id, business_date)` on generated entries).

### 3.5 Money representation (platform-wide standard)

- **Integer minor units** (`BIGINT amount_minor`) + ISO-4217 currency code on every monetary field, everywhere (API, DB, events). Per-currency precision from the ISO table (UZS 2, JPY 0…).
- **No floating point for money** — lint rule bans `number` arithmetic on money paths; one `Money` type/util module is the only permitted implementation.
- Rounding: computed at **line level**, banker's rounding default, jurisdiction-overridable (tax law); the rounding remainder account handles unavoidable residue.
- Multi-currency (26.25/22.72): each journal line carries its currency; hotels have a base currency; foreign-currency postings pair with a rate-snapshot attribute (`rate`, `rate_source`, `rate_at`). Full multi-currency revaluation is deferred; the schema does not block it.

### 3.6 Period close

- **Daily lock** = night audit (§3.4).
- **Monthly accounting close** per organization: after close, no postings dated in that month (DB-enforced via the business-date lock table); adjustments post to the open month with reference. This makes 26.48 true *by mechanism*.
- **Shift close (26.8/26.19)** becomes a *reconciliation snapshot*: expected balance read from the register's ledger account, counted balance entered, difference posted to an over/short account with mandatory reason (26.20 preserved). Closed shifts are read-only **forever** — 26.21's edit-with-approval is replaced by reversal entries.

### 3.7 Sockets reserved (separate specs, interfaces fixed now)

- **Fiscalization adapter** interface per jurisdiction (receipt registration on payment lines; UZ ОФД first) — payment posting emits a fiscalization job; failure policy per jurisdiction spec.
- **Gapless legal numbering** service for invoices/fiscal documents (per legal entity + document type; DB-sequence-backed with no-gap allocation at document finalization, not at draft).
- **Disputes/chargebacks**: dispute entity with lifecycle; ledger impact via chargeback clearing account. Full flow in the Payments Orchestration spec (Missing Documents list).
- **Gateway settlement reconciliation**: provider payouts post against the gateway clearing account; a matching job flags unreconciled residue (the online counterpart of cash reconciliation).

---

## 4. Consequences

**Positive**
- 26.2, 22.78, 26.48 become provable properties: balance is a constraint, reproducibility is immutability, single source of truth is the journal.
- Accounting integrations, P&L (26.36), cash flow (26.37), and the Ch 40 finance marts all read one structure.
- Inventory (35) and asset depreciation (36) get their GL socket: consumption/receipt/depreciation post journal entries through the same service.
- Audit story for financial data is inherited from the schema (append-only + reversals), independent of Ch 17's general audit log.

**Negative / accepted costs**
- Every money-touching feature routes through the posting service — a bottleneck by design; its API must be ergonomic or teams will route around it (mitigation: folio-level operations as the public API; journal is internal).
- Night audit introduces the platform's first business-critical scheduled job — it inherits ADR-003's infrastructure requirements and needs monitoring from day one (a silently failed audit = unposted revenue).
- Spec text changes required: 26.9, 26.21 amended (corrections = reversals); 22.20/22.23 recalculation language amended (reprice = reversal + repost with consent).

**Risks & mitigations**
- *Risk:* unbalanced entry bug. → DB constraint (sum-zero per entry per currency) + permanent invariant monitor (global trial balance = 0, alert otherwise).
- *Risk:* night audit failure at 04:00 with no one watching. → dead-man alerting (audit not completed by audit-hour+1h pages on-call); idempotent re-run.
- *Risk:* performance of balance queries. → running balances are *derived* but cacheable per account with event-driven refresh; never stored as editable fields.

---

## 5. Compliance checks (CI-enforceable)

1. DB grants test: application role has no UPDATE/DELETE on `journal_entries`/`journal_lines`.
2. Constraint test: attempted unbalanced entry rejected by the database.
3. Trial-balance property test: after any generated random operation sequence (bookings, payments, refunds, splits, night audits), global debits = credits and every folio balance = its AR account.
4. Idempotency test: night audit executed twice for the same hotel/date posts once.
5. Lint: no float arithmetic on `*_minor` fields; no direct Prisma access to journal tables outside the posting service.
6. Closed-period test: posting into a locked business date / closed month is rejected.

## 6. Open questions (tracked, not blocking)

1. OTA virtual credit cards (Booking.com VCC) settlement flow — Payments Orchestration spec.
2. Multi-currency revaluation and reporting currency for cross-hotel orgs (28.12) — extend after ADR-007 lands.
3. Loyalty points as ledger liability (23.13) — future, schema does not block.
4. Whether marketplace revenue share (46.24) posts into the same ledger (recommended) — decide with the platform-billing spec.

## 7. References

- PMS-1.2-Architecture-Review.md §6 Blockers #3, #4; Top-100 items 4, 5, 29, 45, 49, 50.
- PMS-1.2-Architecture-Review-Detailed.md — Chapter 26 findings (all 20), Chapter 22 findings 1, 8.
- Prior art: hotel folio/night-audit model as implemented industry-wide (OPERA, Mews); double-entry posting pattern (Fowler, *Accounting Patterns*).
