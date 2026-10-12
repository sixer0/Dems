# Row 13: security assessment (progress file of the parallel run)

- **Agent:** security-review
- **Date:** 2026-10-12
- **Status:** complete
- **Artifact:** `verification/02_security.md` (Tier 1)
- **Files created:** `verification/02_security.md`, `delegation_progress/row_13_security.md`
- **Files modified:** none. `masterplan/02_plan.md` was not touched (hard limit of the row); the controller records the result in the plan's tracking table and log.

## Result

- **Overall verdict:** CAUTION. FAIL: 0. CAUTION: 17 (6 high, 9 medium, 2 low). Notes: 6.
- **Relay, fork F-1 variant A:** ACCEPT, on conditions RC-1 to RC-6. The ruled fallback (worker pulls) applies only if RC-1 cannot be met.
- **No security FAIL**, so the autonomous work is not stopped by this row (U12 B2).

## Ranked findings

| Rank | Id | Severity | One line | Work package |
|---|---|---|---|---|
| 1 | S13-14 | High | Legacy `data/` protected by one line of an untracked ignore file; `git stash -u` / `git clean -fd` remove it; folder is group-accessible | Phase 0, before the baseline commit; WP-21 brought forward |
| 2 | S13-01 | High | Relay has no "Digest only" rule on RTSP; a Basic challenge would expose the password (hypothesis HS-1) | WP-03, WP-05 |
| 3 | S13-05 | High | SA-2 unproven: E-11 not run (RC-1, RC-2) | WP-01, WP-06 |
| 4 | S13-08 | High | Helper must enforce its own limits; the service user can call it past role, idle rule and audit | WP-19 |
| 5 | S13-11 | High | No destination rule for scan, set-IP and typed probe | WP-19, WP-22, WP-12 |
| 6 | S13-15 | High | Cameras registered in input-av keep a plain-text password copy; change before adoption | WP-27, WP-15 |
| 7 | S13-02 | Medium | Relay process hygiene (library log text, dumps, program path) | WP-02, WP-03 |
| 8 | S13-06 | Medium | SA-3 "established" undefined; resumed push (RC-3, RC-4) | WP-06, WP-11 |
| 9 | S13-07 | Medium | Loopback port open to other local users; relay confinement (RC-5, RC-6) | WP-14, WP-03, WP-20 |
| 10 | S13-09 | Medium | `sudo` path forbids `NoNewPrivileges`; decide against a root service | WP-14, WP-19 |
| 11 | S13-10 | Medium | Alias cleanup on crash; orphan sweep; intent audit | WP-19, WP-23 |
| 12 | S13-12 | Medium | Untrusted device text in the ported calls | WP-19, WP-22 |
| 13 | S13-03 | Medium | Digest on a clear camera LAN accepted for development only | WP-14; decision row |
| 14 | S13-04 | Medium | Set-IP job sends credential to the new address; lock-out guard coverage | WP-22, WP-05 |
| 15 | S13-16 | Medium | Helper test seam, fixtures, secret scan needles, acceptance scripts | WP-19, WP-03, WP-27, phase 0 |
| 16 | S13-13 | Low | Free JSON in `installation_acceptances`; device text in `source_facts` | WP-24, WP-26 |
| 17 | S13-17 | Low | Evidence specification H.5 guard at the lift | WP-13 |

## Decisions and blockers for the controller

1. S13-14 (a) to (c) must be in force before the first git write of phase 0; (d) is a question to the user (move `data/` out of the repository now), which does not stop the work.
2. RC-1 is a gate: E-11 runs before WP-03 starts.
3. S13-01 (c): if the pinned library cannot refuse Basic, the user decides; not a controller matter.
4. S13-09 needs a decision row (root service against `sudo`) before WP-19 closes.
5. S13-03 needs the user's acceptance row before stage 2.
6. Section 5.4 of the report is the content list for the helper's installation procedure (UA-3).

## Limits observed

Read-only. Nothing run, nothing bound to a port, no network. Nothing under `apps/input-av/data/` and no `.env` opened, listed or read; one `ls -ld` on the directory entry itself. No secret value printed. Three statements about the FFmpeg libraries are hypotheses (HS-1 to HS-3), not verified.
