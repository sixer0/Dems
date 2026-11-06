---
task_id: 2026-10-04_dems_backend_rbac_pairing
step: 10
agent: data-collector
status: complete
date: 2026-10-04
---

# Progress: blueprint row 10, identity security evidence (Tier 2)

## Status

complete

## Files created

| File | Purpose |
|---|---|
| `docs/2026-10-04_dems_backend_rbac_pairing/research/02e_collection_identity_security.md` | Row 10 deliverable: 56 findings in five topics (password hashing, session versus token, rotation and revocation, lockout and rate limiting, RBAC libraries versus a guard), options tables, excluded register, consolidated source-stated parameters, gaps, query log |
| `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/data_collector_step_10.md` | This file |

No other file was written. `delegation_progress_report.md` and `status_tasks.md` were not touched (parallel run).

## Milestones

1. Read row 10 and the translated task; fixed the five topics and the confidentiality rule.
2. Collected primary guidance (OWASP, NIST SP 800-63B-4, RFC 9106, 9700, 9449, 7009, 8628, 8252, 6265) and Node platform evidence (`crypto.argon2` added v24.7.0, scrypt defaults from Node source).
3. Collected library facts and npm metadata for 34 packages across hashing, session, token, rate limiting, RBAC and one self-hosted auth framework.
4. Marked excluded options (hosted or account-bound, or Docker-first) with evidence.
5. Verification applied by this agent before returning: query-log section grep for design-book and project terms returned none; each topic has an options table with at least two options; every consolidated parameter row carries a URL and the document states the fetch date (2026-10-04) for all fetches.

## Blockers

None. Gaps are listed in the output file under "Not Confirmed and Gaps" (15 items). The ones most likely to matter to later rows:

- Node 26 compatibility is not stated by any fetched source for the third-party libraries (only the built-in `crypto.argon2` is known to precede the host's v26.8.2).
- Secure and `__Host-` cookie behavior on `http://127.0.0.1` (as opposed to `http://localhost`) is not confirmed; the React Native docs say cookie authentication is "currently unstable".
- Official Node docs for `crypto.scrypt` and `crypto.timingSafeEqual` could not be retrieved in full (fetch truncation); scrypt defaults were confirmed from source code.
- The OWASP JWT Java cheat sheet returned HTTP 404; token sidejacking and revocation specifics for JWT rest partly on a search summary.

## Decisions and deviations for the controller to record

1. **npm cache redirect.** The first `npm view` failed with `EPERM` (sandbox blocks the default npm cache). Retried with `--cache $TMPDIR/npmcache` (a sandbox-writable temp path). No install, no workspace file, no sandbox bypass. The first attempt's output was discarded.
2. **Extra `npm view` fields.** Besides `version license time.modified`, the same read-only command class was also run for `engines peerDependencies` on 13 packages. The controller may treat this as within the "metadata lookups" allowance or discard those rows.
3. **`node --version`** was run once (output `v26.8.2`) as a host version check; no other process was started.
4. **WebFetch returns model-written extractions.** All quotes are as returned. The three key OWASP pages were fetched twice (HTML and raw markdown) and agreed. A confidence label (H, M, L) is on each finding. Findings that rest only on web-search summaries are labelled L.
5. **Edit tool unavailable.** Four small text corrections after the first write (counts in the frontmatter and log, one source line) were made with a one-off exact-string Python replacement on the same file. No other file was changed this way.
6. **No recommendation made.** Where a source recommends a parameter, the file says "the source states". The options tables list candidates and facts; the choice is left to row 14.
7. **Excluded under U5 or I4:** Auth0, Clerk, Oso Cloud, Permit.io, Cerbos Hub, Permify Cloud, Auth0/Okta FGA, and the Docker-first run paths of Permify and Oso Dev Server. Clerk and Oso Cloud evidence is partly L.
8. **Hand-built options** (a hand-written permission guard, application-table lockout counters, an opaque token table) appear in the options tables labelled "needs a recorded decision under I1".

## Handoff

Row 14 (data-analyst) consumes `research/02e_collection_identity_security.md` for TD-05 (password hashing), TD-06 (session or token model) and TD-07 (RBAC pattern).
