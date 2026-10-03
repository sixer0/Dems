---
task_id: 2026-09-30_dems_demo_stack_setup
step: 62
agent: security-review
mode: FAST-TRACK (D112), read-only, parallel run
status: complete
verdict: CAUTION
date: 2026-10-01
---

# Delegation progress: security review, step 62 (web build, launcher, web packages)

## Status

**complete.** Verdict **CAUTION**: 0 Critical, 0 High, 2 Medium, 6 Low, plus 5 informational notes. No FAIL.

## Files created

| File | Purpose |
|---|---|
| `verification/02_security.md` | The step-62 security review (Tier 2), with command or file:line evidence for every checklist item |
| `delegation_progress/security_review_step_62.md` | This file |

Not edited, per the parallel-run instruction: `delegation_progress_report.md`, `status_tasks.md`, `masterplan/02_plan.md` and `implementation/99_implementation_report.md`. The controller synthesises them. No repository source, config or release file was changed.

## Findings and owners (for the controller's synthesis)

| ID | Severity | Summary | Owner |
|---|---|---|---|
| F-62-01 | Medium | `THIRD_PARTY_NOTICES.md` (and the copy in all 6 packages) lacks the D74 corrections. Missing: the videos, posters and thumbnails derived from the Pexels photo, the eSpeak NG voice output, and "no macOS voices". The text "never baked into the files" is now inaccurate | **Step 60**, then a packager re-run; otherwise **known issue** |
| F-62-02 | Medium | No npm-dependency or OFL font licence texts ship in the packages (the notices file defers to `node_modules`, which is not distributed) | **Known issue** (post-demo packager change) |
| F-62-03 | Low | Zod 4.6.5 `Function('')` probe: 2 CSP reports per page, cosmetic. Recommend `z.config({ jitless: true })` in `apps/core-web/src/main.tsx`; never `'unsafe-eval'` | **Known issue** |
| F-62-04 | Low (accepted) | `npm audit --omit=dev`: 1 high (nested `undici@7.29.0` via `@scalar/json-magic`), 0 critical, in core-web, mock-core and shared. Not in the shipped bundle and not reachable offline | **Known issue** (post-demo dependency bump) |
| F-62-05 | Low | In the any-OS `Start (macOS).command` and `start-linux.sh`, the `node -e` version check runs before `NODE_OPTIONS` is unset (proved live). The launcher process itself is clean | **Known issue** (packager, `build-web-packages.ts:477-483`) |
| F-62-06 | Low | The Windows SEA exe keeps a dangling Authenticode directory (zeroed bytes) | **Known issue** (packager) |
| F-62-07 | Low | The root `.gitignore` does not ignore `*.p12`, `*.pfx` or `*.key` outside `apps/mobile/` | **Step 66** (append before staging) or known issue |
| F-62-08 | Low | `scripts/release/build-web-packages.ts` changed at 10:48:10, after the 10:43 build. Package content was verified independently | **Step 66** (provenance check); a packager re-run for F-62-01 closes it |

## Key evidence (short)

- **Live launcher run.** macOS arm64 SEA from a copy in the session scratchpad, outside the workspace, always `--no-open`:
  - bound only to `127.0.0.1:4410` (lsof); unreachable on LAN, Tailscale and `::1`;
  - Host allowlist → 421, WS Origin allowlist → 403, 32-client cap → 503;
  - frame limits → close codes 1002, 1003 and 1009;
  - 16 traversal encodings → 404; absolute paths with no dot → the dist `index.html` only;
  - the CSP header is byte-equal to `packagedCsp` (same SHA-256), and all 6 security headers are present;
  - single instance works (exit 0); writes no files; SIGINT exits cleanly; no listener was left afterwards.
- **Provenance.** A fresh nodejs.org `SHASUMS256.txt` equals the cached copy and BUILD-INFO (`c31cbd53…`). All 4 archives and `win-x64/node.exe` match. The Intel `runtime/node` and F1 `node.exe` are byte-identical to the official files, signed by the Node.js Foundation (Apple Developer ID) and the OpenJS Foundation (Authenticode signer). The SEA binaries embed the launcher source byte-for-byte, with fuse `:1` and the marker. The injector is the official Node v26.8.2 `--build-sea`, pinned.
- **Secrets and key material.** None in the tree, `release/`, the packages or the dist. Each scan used a planted positive control (D44). All 16 certificates and 15 signatures are labelled DEMO. No design-book text (0 of 6,952 10-word shingles). No source maps.

## Blockers

None.

## Decisions and incidents

| # | Item |
|---|---|
| 1 | **Live run outside the sandbox.** The live launcher run and the `codesign` checks used a per-command sandbox bypass: local listen is EPERM in the sandbox, and in-sandbox `codesign` reports "Authority=(unavailable)" even for the system Node. Every launch used `--no-open`, and all of my launcher processes were stopped. The listener on :4410 at 11:05 belongs to step 96 (started after my runs) |
| 2 | **Probe run 1.** 5 WS checks "failed" because of half-open sockets from earlier tests (a harness timing issue). Run 2, with a settle wait, passed 10/10. Both are reported in the review |
| 3 | **Blocked brew command (no effect).** One read-only `brew leaves` call, made with `HOMEBREW_NO_INSTALL_FROM_API=1`, tried to tap `homebrew/core`. The sandbox blocked it, and I confirmed the tap directory does not exist, so the host is unchanged |
| 4 | **Keystore password check.** The DEMO keystore password leak check read the values from the git-ignored properties file through process substitution only. The values were never printed or written |
| 5 | **Out of scope.** A listener on `*:3000` belongs to another workspace. It was identified only to rule out DEMS ownership, and was not assessed |

---
*Generated: 2026-10-01 11:16 WIB*
