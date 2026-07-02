# ADR-015: Evolution Stages & Transition Triggers

| | |
|---|---|
| **Status** | Proposed (awaiting approval by architecture owner) |
| **Date** | 2026-07-02 |
| **Deciders** | LBL Architecture Owner |
| **Spec chapters affected** | 50.11 (made operational), 12 vs 42 (contradiction D-5 resolved), 28.29/48.29 (scale claims staged), every enterprise-tier chapter (37–49) gains a stage tag |
| **Review findings resolved** | Document-level defect D-5 (two unbridged architectures); Blocker #10; Top-100 item on stage triggers |
| **Depends on** | All prior ADRs (each contributes its own triggers, consolidated here) |
| **Depended on by** | Infrastructure Guide per stage (Missing Documents #9), roadmap planning, every "when do we adopt X" debate |

---

## 1. Context

The specification contains two truthful descriptions of two different systems: Chapter 12's Express monolith on managed hosting, and Chapters 37–48's Kubernetes, multi-region, marketplace-bearing global platform. Chapter 50.11 names five evolution stages but gives **no entry criteria, no triggers, no cost model** — so every team debate ("should we adopt K8s? Redis? a broker?") has no arbiter, and the failure modes are both over-engineering the MVP and painting the monolith into a corner. This ADR is the bridge: it defines the stages operationally and consolidates the trigger clauses already written into ADRs 001–014.

### Decision drivers

1. Every infrastructure adoption must have a **measurable trigger** — "we feel ready" is not criteria.
2. Reversibility bias: prefer additions that keep the previous stage's exit open (managed services over self-hosted, interfaces over implementations — the pattern every prior ADR followed).
3. Spec honesty: enterprise chapters must be readable as "Stage N capability," not as v1 requirements (28.30/48.29-class claims get staged, per ADR-001 §3.6's precedent).
4. Cost consciousness: each stage states its rough standing-cost class so triggers are economic decisions, not just technical ones.

---

## 2. Decision — the staged model

**Rules:** (R1) Components may not skip a stage without an ADR. (R2) A trigger firing *opens* a transition project; owners plan it — nothing auto-migrates. (R3) Stage tags are added to spec chapters (docs task); no spec text may present a Stage-3+ capability as a v1 requirement. (R4) Triggers are reviewed annually (50.17's governance) and whenever one fires.

### Stage 1 — Modular Monolith on managed hosting *(current target; "small team, first paying hotels")*

**Composition:** one web app + one worker process (ADR-003 §3.3) on managed hosting; managed PostgreSQL (pooled tenancy, ADR-001); managed edge (ADR-013 §3.1); SSE via LISTEN/NOTIFY (ADR-005); Postgres-based search (ADR-011), rate counters (ADR-013), and queues (ADR-003); KMS + host secret store (ADR-012). Enforced module boundaries inside the monolith (Ch 12 finding 1) — **the "modular" is what makes every later stage possible.**
**Standing cost class:** hundreds of $/month.
**Definition of done for the stage itself:** the review's Before-MVP roadmap items (exclusion constraint, ledger v1, night audit, outbox, sessions, state machine, concurrency suite green).

### Stage 2 — Hardened single-region *(triggered by real commercial load)*

**Adds:** containerized deploys with IaC (Terraform — 42.5) on managed container hosting; staging environment parity; Postgres read replica; **Redis** (first firing of: ADR-005 pub/sub trigger, ADR-008 shared permission cache, ADR-013 precise commercial quotas, 18.19 cache); managed secret store (ADR-012 §3.1); synthetic monitoring + on-call rotation formalized (Ch 42 finding 10).
**Triggers (any):** ≥ ~20 paying properties; first contractual SLA; sustained p95 SLO breaches attributable to single-instance limits; deploy-frequency pain (queued releases); the Redis-trigger clauses in ADRs 5/8/13 firing.

### Stage 3 — Kubernetes & first extracted services *(triggered by team and workload shape, not fashion)*

**Adds:** K8s + GitOps (42.7/42.16) — the Ch 42 chapter becomes *current* here, not before; first extractions along the seams already built: **channel-sync workers, then notification delivery** (natural per ADR-003's worker isolation and Ch 30 finding 19); message broker behind the outbox relay (ADR-003 §3.6 triggers); gateway product at ingress (ADR-013 §3.3 triggers); **dedicated-tier tenants** (ADR-001 §3.4 triggers); dedicated search engine if ADR-011 §3.6 fired; CDC-based warehouse ingestion (Ch 40) if analytics demands it.
**Triggers (any):** >2 engineering squads needing independent deploys; worker fleet scaling exceeding single-host economics; outbox volume trigger (ADR-003: ~500 evt/s or relay-lag SLO breach); ≥ ~100 organizations; first dedicated-tier contract.
**Cost class:** platform team becomes a real budget line — the trigger review must say so out loud.

### Stage 4 — Multi-region cells *(triggered by contracts, not latency vanity)*

**Adds:** regional cells — full stack per region, tenants homed to exactly one cell (ADR-001 §3 decision 3); data-residency routing (48.18/48.20); cross-region DR posture upgrade (Ch 45 tiers become per-region); regional inference routing for AI (Ch 39 finding); warehouse regionalization (Ch 40 finding 19).
**Triggers (any):** first signed data-residency requirement; a second geographic market with sovereignty rules; measured latency loss of deals (documented, not anecdotal).

### Stage 5 — Distributed enterprise platform *(the 50.11 endpoint)*

**Adds:** public marketplace GA (ADR-014 sequencing stage 3–4); event streaming for enterprise consumers (37.29); cell-based availability isolation as a sellable tier; the 28.29/48.29 scale claims become honest.
**Triggers:** commercial — marketplace partner pipeline, enterprise-group deals demanding it.

### 2.1 Consolidated trigger index (single place to check)

| Adoption | Trigger source | Stage |
|---|---|---|
| Redis | ADR-005 §3.6, ADR-008 §3.3, ADR-013 §3.2, 18.19 | 2 |
| Message broker | ADR-003 §3.6 | 3 |
| Dedicated search engine | ADR-011 §3.6 | 3 |
| Gateway product | ADR-013 §3.3 | 3 |
| Dedicated-tier tenant DBs | ADR-001 §3.4 | 3 |
| K8s/GitOps | this ADR, Stage-3 triggers | 3 |
| WebSocket transport | ADR-005 §3.6 (bidirectional feature) | feature-gated |
| Temporal-class workflow engine | ADR-003 §3.5 / Ch 33 spec | feature-gated |
| Regional cells / residency | this ADR, Stage-4 triggers | 4 |
| Hosted extension execution (WASM) | ADR-014 §3.5 | 5 (own ADR) |

---

## 3. Consequences

**Positive** — D-5 is resolved: both spec architectures are true *at their stage*; every "should we adopt X" debate has a written arbiter; prior ADRs' scattered trigger clauses live in one index; over-engineering and corner-painting both get a named guard (R1/R3).
**Negative / accepted** — triggers are estimates; annual review (R4) is the correction loop. Stage tags add a docs maintenance duty on the spec (assigned with the spec-in-git editorial fix, D-1).
**Risks** — *trigger gaming* ("we really want K8s"): transitions require the trigger evidence in the ADR that opens them — reviewed, not self-certified. *Stage-1 lingering too long*: the Stage-2 triggers include commercial signals precisely so the platform hardens when money shows up, not when engineers get bored.

## 4. Compliance checks

1. Docs check: every spec chapter 37–49 carries a stage tag after the editorial pass; CI greps for untagged enterprise chapters.
2. ADR discipline: any infrastructure addition PR must reference the trigger clause it satisfies (PR template field).
3. Annual trigger-review calendar entry owned by architecture governance (50.17).

## 5. Open questions

1. Hosting/cloud vendor selection at Stage 2 (drives ADR-012 KMS choice) — procurement decision when Stage-2 triggers approach.
2. Which squad boundaries define "extraction seams" beyond channel-sync/notifications — revisit at Stage-3 opening with the module map.

## 6. References
PMS-1.2-Architecture-Review.md — defect D-5, Blocker #10, roadmap §4; Ch 50 findings 1/7/19. All prior ADRs' trigger clauses (indexed in §2.1).
