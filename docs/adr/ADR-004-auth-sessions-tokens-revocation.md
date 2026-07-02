# ADR-004: Authentication Sessions — Tokens, Revocation, Storage, MFA

| | |
|---|---|
| **Status** | Proposed (awaiting approval by architecture owner) |
| **Date** | 2026-07-02 |
| **Deciders** | LBL Architecture Owner |
| **Spec chapters affected** | 15 (amended: 15.7/15.8/15.17/15.19/15.21), 29.18–29.23, 41.5–41.6, 12.11, 48.17 (cookie/domain interplay) |
| **Review findings resolved** | Blocker #7 (JWT revocation contradiction, MFA deferred); Top-100 items 7, 24 |
| **Depends on** | ADR-001 (session tenant context) |
| **Depended on by** | ADR-005 (stream authentication), ADR-010 (mobile offline lease), future SSO ADR |

---

## 1. Context

Chapter 15 asserts two properties that pure stateless JWT cannot deliver together: tokens as the session mechanism (15.7) **and** instant invalidation on logout (15.17) / "terminate all sessions" (29.19). It also leaves token storage to "secure architecture" (15.19) without deciding it, defers refresh tokens to "future" (15.8) while requiring expiring, revocable sessions, and defers MFA (15.21) on a system that moves money. Meanwhile 29.18 specifies rich per-session records (device, IP, last activity) — which *is* a server-side session store, contradicting the stateless framing.

### Decision drivers

1. Revocation that actually works: logout, logout-everywhere, admin session termination (29.19), compromised-account response.
2. Low per-request cost: no full DB session lookup on every read at scale.
3. Web storage immune to token exfiltration via XSS; CSRF handled explicitly.
4. Permissions must not go stale inside a long-lived token (role changed → effective quickly; interlocks Ch 29 caching design).
5. One model serving web, mobile (Ch 43), and service accounts / API keys (29.27) without three auth stacks.
6. Future SSO/OAuth/passkeys (15.21, 41.5) pluggable behind one abstraction.
7. White-label custom domains (48.17) constrain cookie strategy — cookies don't cross domains.

---

## 2. Options considered

### Option A — Stateless JWT + revocation denylist
- ❌ A denylist consulted on every request *is* a session store with extra steps; permissions-in-token still go stale; 29.18's session records still need a table. **Rejected** — worst of both.

### Option B — Opaque server-side sessions only (no JWT)
- ✅ Simplest correct model; instant revocation trivially.
- ❌ Every request costs a session lookup (cacheable, but the cache becomes the real mechanism); no self-contained identity for multi-service Stage 3+. **Viable but not chosen.**

### Option C — Short-lived access JWT + server-side refresh sessions with rotation — **chosen**
Industry-standard hybrid: JWT gives cheap request authentication with a **bounded** staleness window; the session store gives real revocation, device management, and refresh rotation.

---

## 3. Decision

### 3.1 Token model

- **Access token:** JWT, TTL **10 minutes**. Claims: `sub` (user id), `sid` (session id), `iat/exp/iss/aud`, `token_version`. **No permissions, roles, or tenant lists in the token** — authorization is resolved server-side per request with caching (Ch 29 design; ADR-001 context still set per request from the *validated* membership, not from token claims). Signing: asymmetric (ES256/EdDSA), keys in the secret store (ADR-012), published via JWKS, rotated on schedule.
- **Refresh token:** opaque 256-bit random value, stored **hashed** in the session store. **Rotation on every use**; the previous token is invalidated and remembered — **reuse of a rotated token revokes the whole session family and raises a security alert** (29.24). TTL: sliding 14 days idle / 90 days absolute (org-policy overridable per 41.25).
- **Session store:** `sessions` table (platform-level; `user_id`, `organization_id` context, hashed refresh token + rotation chain, device/browser/OS/IP per 29.18, `created_at`, `last_used_at`, `expires_at`, `revoked_at`, `revoke_reason`). This *is* the 29.18/29.19 feature — active-session listing and termination read/write this table.

### 3.2 Revocation semantics (the honest contract)

- Logout / terminate-session / terminate-all: revoke session rows → refresh becomes impossible immediately; outstanding access tokens die within ≤10 minutes.
- **Sensitive operations do not accept that window:** endpoints classified sensitive (payments, refunds, user/permission management, data export, break-glass) additionally verify session liveness (`sid` not revoked) against a cached session-state lookup. Result: hard revocation is *instant where it matters*, ≤10 min everywhere else. This bound is documented in the security model — the spec's "instant everywhere" claim (15.17) is amended to this two-tier contract.
- Password change / detected compromise: revoke all user sessions (15.16's rule, now mechanized).

### 3.3 Storage per client class

| Client | Access token | Refresh token | CSRF posture |
|---|---|---|---|
| **Web SPA** | **In memory only** — never localStorage/sessionStorage (XSS-exfiltration ban, lint-enforced) | **httpOnly + Secure + SameSite=Lax cookie**, path-scoped to the refresh endpoint | API calls use `Authorization` header (CSRF-immune); the cookie-bearing refresh endpoint is protected by SameSite + strict `Origin` check |
| **Mobile (Ch 43)** | Memory | OS secure storage (Keychain / Android Keystore) | N/A (no cookies) |
| **Service accounts / API keys (29.27)** | Not JWT sessions: long-lived opaque keys, hashed at rest, permission-scoped with a ceiling ≤ creator's rights, optional IP allowlist, `last_used` tracking | — | N/A |

**Custom domains (48.17):** the refresh cookie is issued by the domain actually serving the tenant (platform or white-label) — no cross-domain cookie sharing, no third-party-cookie dependence. Auth endpoints are served on every tenant domain; the session store is domain-agnostic. This resolves review Ch 15 finding #19.

### 3.4 Account model

**Global user identity + per-organization memberships** (one email = one account; membership grants org/hotel/branch access with roles). Matches 28.18 (employees across hotels, no duplicate accounts) and enables future cross-org SSO. Login flow: identify user → if multiple orgs, org selection → session bound to selected context; hotel switching (28.7) rebinds context *within* the session, re-resolving permissions — no re-login, no new token semantics. Resolves review Ch 15 finding #6.

### 3.5 Credentials & MFA

- **Password hashing: argon2id** (OWASP current first choice; parameters pinned in config: m=19MiB, t=2, p=1 minimum, revisited annually). Any bcrypt hashes migrate transparently on successful login. Password policy amended toward NIST 800-63B: length ≥ 12 + compromised-password screening (haveibeenpwned-style k-anonymity check) **instead of** composition rules (15.5 amended).
- Login throttling: per-identifier and per-IP progressive backoff; lockout after configurable failures with unlock flow; failure responses uniform (15.4's non-enumeration preserved).
- **MFA (TOTP) ships at launch, mandatory-by-default for Owner / General Manager / Finance / System Administrator roles** (org policy may extend/relax within platform floor). 15.21/29.21 amended from "future" for TOTP + recovery codes; WebAuthn/passkeys remain future behind the same MFA interface. **Step-up authentication** socket: approval actions (29.25) may demand fresh MFA (`auth_time` claim + re-challenge) — interface reserved now.
- Password reset: single-use token, 256-bit, TTL 30 min, all sessions revoked on completion (mechanizes 15.16).

### 3.6 Provider abstraction

One `IdentityProvider` interface behind login (password, and later Google/Microsoft/SSO/SAML per 15.21/38.13). External IdP logins produce the **same** session/token model — SSO changes authentication, never session mechanics. Group→role mapping is the future SSO ADR's scope.

---

## 4. Consequences

**Positive**
- The 15.7-vs-15.17 contradiction is resolved with an explicit, testable staleness bound; session management UI (29.19), device trust (29.23), and security alerts (29.24) all gain their backing store.
- No permissions in tokens → role changes propagate at permission-cache speed, not token-expiry speed.
- One model spans web/mobile/API keys; SSO lands later without re-architecture.

**Negative / accepted costs**
- Refresh rotation adds a failure mode (parallel refreshes from multiple tabs) — mitigated by a short grace window for the immediately-previous token (standard practice) while still alarm-revoking on older reuse.
- Sensitive-endpoint liveness checks add a cached lookup on the hot money paths — accepted deliberately; these are exactly the calls that must not run on a dead session.
- In-memory access tokens mean a hard refresh re-authenticates via the cookie — one extra round-trip on page load; acceptable.

**Risks & mitigations**
- *Risk:* XSS still executes API calls in-page (storage choice limits exfiltration, not usage). → CSP + sanitization standards (review Ch 11 finding 5) remain mandatory companions; sensitive ops behind step-up MFA.
- *Risk:* JWKS/key rotation breaks validation. → dual-key overlap window, keys cached with kid-based selection, rotation drill in staging.
- *Risk:* session table hot-spot. → liveness lookups served from cache with short TTL + explicit invalidation on revoke (the only correctness-critical invalidation, kept deliberately tiny).

---

## 5. Compliance checks (CI-enforceable)

1. Lint: no token writes to `localStorage`/`sessionStorage`; no `Authorization` material in persisted state.
2. Cookie test: refresh cookie has `HttpOnly; Secure; SameSite=Lax` and correct path/domain per serving domain fixture.
3. Rotation test: refresh → old token rejected; grace-window token accepted once; older-generation reuse revokes family and emits security event.
4. Revocation test: terminated session → refresh fails immediately; sensitive endpoint rejects within cache-TTL; non-sensitive rejects by access-token expiry.
5. Claims test: issued access tokens contain no role/permission/tenant-list claims.
6. Argon2id parameter floor test; compromised-password screen invoked on set/change.

## 6. Open questions (tracked, not blocking)

1. SSO/SAML group→role mapping — future SSO ADR (with 38.13).
2. Passkey (WebAuthn) rollout order — behind the MFA interface.
3. Mobile offline authorization lease duration — ADR-010 (this ADR provides `sid` + token machinery it will build on).
4. Session-count limits per user/role (Ch 15 finding 8) — product/security policy decision at implementation.

## 7. References

- PMS-1.2-Architecture-Review.md — Blocker #7; Top-100 items 7, 24, 86.
- PMS-1.2-Architecture-Review-Detailed.md — Ch 15 findings 1–6, 19; Ch 29 findings 4–5.
- OWASP ASVS v4 (session management), NIST 800-63B, OAuth BCP (token rotation & reuse detection).
