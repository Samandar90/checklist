# ADR-007: Business Dates & Timezone Doctrine

| | |
|---|---|
| **Status** | Proposed (awaiting approval by architecture owner) |
| **Date** | 2026-07-02 |
| **Deciders** | LBL Architecture Owner |
| **Spec chapters affected** | 48.10 (amended), 22 (Reservations), 20 (Dashboard "today"), 26 (Finance business dates), 27 (period comparison), 40 (date dimension), 33 (scheduling) |
| **Review findings resolved** | Ch 48 weak decision #2 (UTC misapplied to stay dates); Top-100 item 28; prerequisite for ADR-002 night audit |
| **Depends on** | — (foundational) |
| **Depended on by** | ADR-002 (posting dates), ADR-006 (transition guards), Chapter 13 (column types) |

---

## 1. Context

Chapter 48.10 mandates "store timestamps in UTC" universally. That rule is correct for *physical events* and **destructive for *stay semantics***:

- A hotel night is not a 24-hour UTC interval. "Arrival 2026-07-02" is a **calendar date in the hotel's local reality** — it must never shift to 2026-07-01 when an owner in another timezone opens the dashboard.
- The hotel day does not end at midnight. Reception posts a 01:30 bar charge to *the previous* hotel day; the day ends at the **audit hour** (industry standard 03:00–06:00), when the night audit (ADR-002 §3.4) closes it.
- Occupancy, ADR, RevPAR are all *per business date*. Computing them over UTC calendar dates misattributes every late-evening/early-morning transaction and permanently corrupts historical reporting — the class of error that cannot be fixed retroactively.

This is the most common irreversible data-modeling mistake in hospitality systems, and the spec currently mandates it.

### Decision drivers

1. Stay dates must be stable, human-meaning calendar dates — independent of any viewer's or server's timezone.
2. Financial postings must attribute to hotel business dates (ADR-002), which roll at the audit hour, not midnight.
3. Physical events (payment created, login, audit trail) must remain globally comparable instants — UTC is correct *there*.
4. DST must never change the number of nights in a stay or double/skip a business date.
5. Multi-hotel organizations span timezones (28.5 stores per-hotel timezone — the spec already has the ingredient); "today" must be per-hotel.

---

## 2. Options considered

### Option A — Everything UTC `timestamptz` (spec 48.10 as written)
- ❌ Stay boundaries shift with viewer timezone; business-date attribution wrong around midnight; occupancy math corrupted. **Rejected** — this option is the bug.

### Option B — Everything hotel-local naive datetimes
- ❌ Instants become ambiguous (DST overlaps), cross-hotel comparison and log correlation break, migrations between timezones impossible. **Rejected.**

### Option C — Two-class temporal model — **chosen**
Instants in UTC; business dates as timezone-free calendar `DATE`s; an explicit per-hotel **current business date** advanced only by night audit.

---

## 3. Decision

### 3.1 Two temporal classes (normative for Chapter 13 and the API standard)

| Class | Semantics | Storage | API format | Examples |
|---|---|---|---|---|
| **Instant** | A physical moment | `TIMESTAMPTZ` (UTC) | ISO-8601 with `Z` | `payment.created_at`, `login_at`, audit timestamps, `checked_in_at` |
| **Business date** | A hotel-local calendar date | `DATE` | plain `YYYY-MM-DD`, never timezone-converted | `arrival_date`, `departure_date`, `journal_entries.business_date`, occupancy dates |

Naming convention doubles as enforcement: columns/fields ending `_at` are instants; ending `_date` are business dates. **No naive (timezone-less) datetimes exist anywhere in the platform.**

### 3.2 Hotel timezone and audit hour

- Every hotel stores an **IANA timezone** (already in 28.5) and an **audit hour** (default 04:00 local, configurable per hotel).
- Every hotel has a stored **`current_business_date`** — advanced *only* by the night audit run (ADR-002 §3.4), never implicitly by wall clock. If the audit runs late, postings continue onto the still-open date — matching industry behavior and keeping the day's books coherent. The scheduler treats audit-hour+1h without a completed run as a paged incident (ADR-003 dead-man rule).

### 3.3 Stay semantics

- `arrival_date` / `departure_date` are business dates. **`nights = departure_date − arrival_date`** — pure date arithmetic; DST transitions cannot change a stay's night count (driver 4).
- Actual movement events are instants alongside the dates: `checked_in_at`, `checked_out_at`. Early check-in / late check-out (22.21) are relationships between the instant and the date+hotel policy hours — never mutations of the dates themselves.
- The double-booking exclusion constraint (review Blocker #2) operates on `daterange(arrival_date, departure_date)` — date-typed, timezone-free, consistent with this model.

### 3.4 "Today" and reporting

- Dashboard/report "today" (20.4, 26.34, 27.5) = the hotel's `current_business_date`. The global multi-hotel dashboard (28.8) aggregates **each hotel's own** current business date — there is no single global "today."
- The Chapter 40 date dimension is keyed on business date; instants remain available for hour-of-day analytics (27.18 heatmaps use hotel-local hours derived from instant + hotel timezone at query time).
- Period comparisons (27.16) compare business-date ranges; the KPI dictionary must state this in every date-scoped definition.

### 3.5 Scheduling

- Hotel-local schedules (night audit, scheduled notifications 32.17, automation triggers 33.6) are stored as *local time + hotel timezone* and converted to UTC **per occurrence** at enqueue time (ADR-003 cron) — DST-safe by construction. Never store a fixed UTC hour for a local-time intent.

### 3.6 Frontend rule

- Business dates travel as `YYYY-MM-DD` strings end-to-end and are **never passed through `new Date(...)`/`Date.parse`** (which interpret them in a timezone and shift them — the canonical frontend date bug). date-fns pure-date utilities only; lint enforces.

### 3.7 Spec amendment

48.10 is amended to: *"Store instants in UTC. Store stay and accounting dates as hotel-local business dates (`DATE`). The hotel business date rolls at the audit hour via night audit, not at midnight."*

---

## 4. Consequences

**Positive**
- Occupancy/revenue attribution is correct by construction; the irreversible-corruption risk is eliminated before any data exists.
- Night audit (ADR-002), the exclusion constraint, and the calendar grid (Ch 21 columns = business dates) all share one coherent date model.
- DST-related bug class (double-charged/missing nights, shifted arrivals) removed structurally.

**Negative / accepted costs**
- Two temporal types demand developer education — the `_at`/`_date` convention plus lint carries most of the weight.
- The stored `current_business_date` adds one more piece of per-hotel state whose advancement is operationally critical (owned and monitored via ADR-002/003).
- Queries mixing classes (e.g., "charges posted after 22:00 local") need explicit instant→local conversions — acceptable, and rare.

**Risks & mitigations**
- *Risk:* a developer stores an instant where a date belongs (or vice versa). → schema lint on suffix↔type mismatch (CI check 1).
- *Risk:* hotel timezone changed after go-live (rare but real: jurisdiction reform). → timezone changes take effect at the next date roll only; historical business dates never recomputed; documented runbook.

---

## 5. Compliance checks (CI-enforceable)

1. Schema test: every `*_at` column is `TIMESTAMPTZ`; every `*_date` column is `DATE`; no `TIMESTAMP WITHOUT TIME ZONE` exists in the schema.
2. Frontend lint: business-date strings never constructed into `Date` objects; only whitelisted pure-date utilities.
3. Night-audit date-roll tests with fixture hotels in `Asia/Tashkent` (no DST) and `Europe/Berlin` (DST), covering the spring-forward and fall-back nights: night counts and business-date sequences remain gapless and duplicate-free.
4. API contract test: business dates serialize as `YYYY-MM-DD`; instants as ISO-8601 `Z`.
5. Scheduler test: a 04:00-local cron enqueues at correct UTC across a DST transition.

## 6. Open questions (tracked, not blocking)

1. Day-use (hourly) reservations — out of v1 scope (review Ch 22 finding 6); this model does not block them (day-use = same business date + instant pair).
2. Reporting calendar variants (4-4-5 fiscal calendars for enterprise groups) — Chapter 40 concern, date dimension accommodates.

## 7. References

- PMS-1.2-Architecture-Review-Detailed.md — Ch 48 finding 2, Ch 22 findings 1/9, Ch 20 finding 8, Ch 27 finding 8.
- ADR-002 §3.4 (night audit), ADR-003 §3.3 (scheduling).
- IANA tzdb; industry night-audit/business-date practice (OPERA, Mews).
