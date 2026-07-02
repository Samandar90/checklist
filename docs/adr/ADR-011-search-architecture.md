# ADR-011: Search Architecture

| | |
|---|---|
| **Status** | Proposed (awaiting approval by architecture owner) |
| **Date** | 2026-07-02 |
| **Deciders** | LBL Architecture Owner |
| **Spec chapters affected** | 14.11 (search standard), 23.14/23.28 (guest search), 26.26 (transaction search), 28.9/28.27 (cross-hotel search), 21.4 (calendar search), 17.16 (log search), 39.13 (AI semantic search — boundary) |
| **Review findings resolved** | Top-100 item 47; Detailed review Ch 23 finding 9 (Cyrillic/Latin duality), Ch 28 finding 5 (scope filtering) |
| **Depends on** | ADR-001 (RLS = tenant safety), ADR-003 (index-sync events for the future engine), ADR-008 (scope filtering of results) |
| **Depended on by** | Guest/reservation/global search implementations; Chapter 13 (normalized columns & indexes) |

---

## 1. Context

The spec demands "instant" search in at least six places — guests by name/phone/passport (23.14), reservations by number (22.12), transactions (26.26), rooms (24.13), cross-hotel global search (28.9), calendar jump-to-reservation (21.4) — and never chooses infrastructure. Two market-specific constraints raise the bar: **Cyrillic/Latin dual-script names** (the same guest is "Алиев" on one visit and "Aliyev" on the next — the primary duplicate-guest source in the CIS market, review Ch 23 finding 9) and phone-first guest identification (E.164 normalization). Meanwhile Stage-1 infrastructure is one PostgreSQL (ADR-003's single-dependency principle), and every search result must respect tenant isolation (ADR-001) and intra-tenant scopes (ADR-008).

### Decision drivers

1. Perceived-instant lookups (target p95 < 150 ms server-side) for prefix and fuzzy name search on realistic corpora (10⁵–10⁶ guests per large org).
2. Exact-match lanes must be *fast paths*: phone, email, reservation/invoice/document numbers are the receptionist's primary keys (18.13).
3. Dual-script equivalence: Latin query finds Cyrillic record and vice versa — a correctness requirement, not a relevance nicety.
4. Tenant safety by construction: search must be incapable of crossing organizations even when buggy.
5. No new Stage-1 infrastructure; an evolution path to a dedicated engine with defined triggers, not vibes.
6. Clear boundary with AI semantic search (39.13/39.26): *this* ADR covers lexical entity lookup; natural-language querying over business data is the AI platform's concern and compiles through the semantic layer (Ch 40 finding 16) — the two must not be conflated.

---

## 2. Options considered

### Option A — `ILIKE '%…%'` on raw columns
- ❌ Unindexable leading-wildcard scans; collapses exactly when the data grows; no fuzziness. **Rejected** (it is also what teams do by default when no ADR exists — this document exists to prevent that).

### Option B — PostgreSQL native: `pg_trgm` + normalized generated columns + FTS — **chosen for Stage 1**
- ✅ Trigram GIN indexes give indexed prefix/fuzzy/similarity search; `tsvector` FTS covers notes/documents; `unaccent` handles diacritics.
- ✅ **RLS applies automatically** — tenant safety inherited from ADR-001 with zero additional discipline; this property alone justifies staying in Postgres as long as possible.
- ✅ Zero new infrastructure, zero index-sync pipeline, transactionally consistent (a created guest is findable in the same millisecond).
- ⚠️ Relevance tooling is primitive (no BM25, no typo-cost model) — sufficient for entity lookup, not for document-corpus ranking.

### Option C — Dedicated engine now (Meilisearch / Typesense / OpenSearch)
- ✅ Superior typo tolerance, ranking, faceting.
- ❌ New 24/7 infrastructure + an index-sync pipeline (outbox consumer) + **tenant filtering becomes discipline instead of structure** (a missing filter = cross-tenant leak — the exact bug class ADR-001 exists to kill) + eventual consistency UX for "just created" records. **Rejected for Stage 1; adopted behind triggers (§3.6).** If/when triggered: Meilisearch or Typesense over Elasticsearch — ops weight matters more than exotic features here.

---

## 3. Decision

### 3.1 Normalized search columns (input to Chapter 13)

Every searchable entity carries **generated/maintained normalized columns**, populated by one shared normalization module at write time:

- `search_name`: lowercased, `unaccent`-ed, whitespace-collapsed full name.
- `search_name_alt`: the **cross-script variant** — a deterministic UZ/RU transliteration table maps Cyrillic→Latin and Latin→Cyrillic (both directions stored; searching either script hits both columns). The transliteration table is a versioned data file with linguist-reviewable rules (х→kh, ш→sh, ў→oʻ→o' variants folded), and re-normalization is re-runnable when the table changes.
- `phone_e164`: normalized at input (Ch 23 finding 9's precondition — also serves duplicate detection 23.15).
- `email_normalized`: lowercased, trimmed.
- Document/reservation/invoice numbers: stored canonically (uppercase, separator-stripped shadow column).

Indexes: GIN `gin_trgm_ops` on `search_name` and `search_name_alt`; B-tree on the exact-lane columns. Notes/long text: `tsvector` GIN with per-language configs (`russian`, `english`, `simple` for Uzbek Latin).

### 3.2 Query strategy (one shared `SearchService` per domain)

1. **Exact lanes first** (18.13's fast path): input classified by shape — digits ⇒ phone (E.164-normalize then exact) and reservation/invoice numbers; `@` ⇒ email; document-number patterns ⇒ documents. Exact hits return immediately.
2. **Name lane**: prefix match (`text_pattern_ops`/trigram) then trigram similarity (threshold 0.3) against **both** `search_name` and `search_name_alt`; rank: exact > prefix > similarity score.
3. Result caps per entity (10 for pickers, 25 for search pages), keyset pagination beyond (Ch 14 cursor standard).
4. **Global search (28.9/28.27)**: parallel per-entity searches merged with type grouping (guests / reservations / rooms / invoices), each **scope-filtered through ADR-008's row-filter derivation** — results indicate origin hotel and are structurally incapable of exceeding the caller's scope; the whole query still runs under ADR-001 RLS (two independent walls, per the platform's defense-in-depth pattern).
5. Frontend behavior per 18.13/ADR-009: 250 ms debounce, request cancellation, 30 s keyed cache.

### 3.3 What stays out of scope here

- **Log/audit search (17.16)** — observability-stack concern (Loki/warehouse), not the product search path.
- **AI semantic search (39.13)** — natural-language → structured query via the semantic layer; it may *call* this search for entity resolution, never bypass its permission filtering.
- **Report/BI exploration (Ch 27/40)** — analytics engines, not lookup.

### 3.4 Performance budget & fixtures

CI perf suite on a fixture corpus (1M guests, dual-script distribution matching the market, 5M reservations): exact lanes p95 < 30 ms; name search p95 < 150 ms. Regression beyond budget fails the build (the concrete numbers 18.24 lacked, applied to this slice).

### 3.5 Duplicate detection alignment (23.15)

Duplicate detection reuses the same normalized columns (`phone_e164`, `email_normalized`, `search_name`+`search_name_alt` trigram similarity, plus DOB) — **one normalization module feeds both features**; they can never disagree about whether two names "look alike."

### 3.6 Evolution triggers (dedicated engine)

Adopt Meilisearch/Typesense (per-domain, starting with guests) when **any** of:
- Name-search p95 > 200 ms sustained on production percentiles after index/threshold tuning;
- A relevance requirement lands that trigram ranking cannot express (typo-cost ranking, cross-field weighting demanded by product);
- Corpus > ~5M guest rows in a pooled cluster with index-bloat pressure on neighbors (ADR-001 §3.4 interplay);
- Search QPS becomes a measurable OLTP load competitor.

Migration path is pre-wired: an outbox consumer (ADR-003) feeds the engine's index; `SearchService` swaps backend per domain behind the same API; **tenant filtering in the engine is namespace-per-org** (mirroring the vector-store rule of Ch 39 finding 5) with the conformance tests of §5 unchanged.

---

## 4. Consequences

**Positive**
- "Instant search" becomes six implemented lanes with budgets instead of an adjective; the dual-script problem — the market's #1 data-quality issue — is solved at write time, once, for search *and* duplicate detection.
- Tenant safety of search is inherited (RLS), not disciplined — the leak class that haunts bolt-on search engines is structurally absent at Stage 1.
- Zero new infrastructure now; a rehearsed, trigger-gated path to a dedicated engine later with the API already stable.

**Negative / accepted costs**
- Normalized shadow columns add write-path work and storage (~3 extra text columns + GIN indexes on hot tables) — accepted; GIN maintenance cost is monitored in the perf suite.
- Trigram relevance is adequate, not delightful — no typo-cost model; accepted until a trigger fires.
- The transliteration table is a curated artifact needing an owner (data-quality governance) — versioned, tested, re-runnable by design.

**Risks & mitigations**
- *Risk:* transliteration table gaps produce unfindable guests. → round-trip test corpus of real name pairs (both scripts) in CI; misses are test cases, not tickets.
- *Risk:* trigram GIN bloat on high-churn tables. → index maintenance in the ops runbook; corpus-size trigger (§3.6) is the escape valve.
- *Risk:* someone builds a bespoke search query outside `SearchService`. → lint: `pg_trgm`/`to_tsquery` usage confined to the search module (same single-door pattern as ADR-002/006/008).

---

## 5. Compliance checks (CI-enforceable)

1. Dual-script round-trip suite: for each fixture pair (Cyrillic, Latin), querying either form returns the record via the other — including mixed-script inputs.
2. Tenant test: search endpoints under Org A fixtures return zero Org B rows (extends ADR-001 cross-tenant suite to every search lane).
3. Scope test: branch-scoped user's global search excludes out-of-scope hotels (ADR-008 conformance applied to search).
4. Perf budget test on the fixture corpus (§3.4 numbers) — build-failing.
5. Normalization consistency: creating/updating an entity through any service yields correctly populated normalized columns (no write path bypasses the module).
6. Lint: search-related SQL/operators confined to `SearchService` modules.

## 6. Open questions (tracked, not blocking)

1. Uzbek Latin FTS dictionary (no stock Postgres config) — `simple` config suffices for v1; evaluate a custom dictionary with the localization workstream (Ch 48).
2. Search analytics (zero-result queries as product signal, 31.30-style) — with the product-telemetry pipeline (Ch 47 finding 1).
3. Phonetic matching (Soundex-class for names) — only if dual-script + trigram measurably misses real duplicates; add to the duplicate-detection evaluation, not to v1.

## 7. References

- PMS-1.2-Architecture-Review.md — Top-100 items 47, 41 (dedup interplay).
- PMS-1.2-Architecture-Review-Detailed.md — Ch 23 findings 4/9/16, Ch 28 findings 4–5, Ch 14 finding 8.
- ADR-001 (RLS), ADR-003 (index-sync path), ADR-008 (row filtering), ADR-009 (debounce/cache client side).
- PostgreSQL: `pg_trgm`, `unaccent`, FTS; Meilisearch/Typesense (trigger-gated candidates).
