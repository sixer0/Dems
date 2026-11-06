# W91 — Code review of `apps/core-server` (read-only)

**Plan row:** W91 (step 113) · **Reviewer:** senior-code-reviewer (tier R) · **Date:** 2026-10-07 05:20–05:40 WIB
**Narrative tier:** 2 (what was found, why it matters, how it was verified, source)
**Scope:** `apps/core-server` (`src/`, `test/`, `src/db/`), with the uncommitted delta since `057fc17` in focus:
19 modified files (+198/−73, `git diff --stat 057fc17 -- apps/core-server`) and 3 untracked files
(`src/modules/identity/__tests__/device-session.db.test.ts`, `src/realtime/__tests__/hub.devices-changed.test.ts`,
`test/acceptance/devices-live.test.ts`). The delta is FX-C (D202: `device.session`, debounced `admin.changed DEVICES`)
plus W83 contract close-out rewording.
**Delta that landed during the review (not reviewed here):** at 05:42 `git diff --stat 057fc17 -- apps/core-server` showed 20 files
(+306/−149). The extra file is `test/db/pg-behaviours.db.test.ts` (+184 lines changed), which is W90's C2-R1 adaptation to the terse
cluster (D195). It is outside this review's snapshot. Under plan §622 ("any code change after those reviews started triggers a
delta re-check by the same reviewer before W103"), it needs a W91 delta re-check once W90 closes.
**Mode:** read-only. No source file was changed. No database test was run (W90 owns PostgreSQL); nothing touched `*:5432` or `*:4432`.

---

## 0. Verdict

| Domain | Verdict | Findings |
|---|---|---|
| Correctness of the FX-C delta | PASS | 0 defects; 3 maintainability items (W91-2, W91-3, W91-16) |
| Security (auth, RBAC, audit, input validation, secrets in logs, SR-67) | PASS | 0 |
| Concurrency (engine host, realtime hub, pipeline) | PASS | 0 |
| Error handling | PASS with comments | W91-8 |
| DB access patterns and migrations | PASS | 0 (SR-67 holds; no migration in the delta) |
| Duplication | CAUTION | W91-4, W91-5, W91-6, W91-12 |
| Maintainability, dead code, stale comments | CAUTION | W91-2, W91-3, W91-7, W91-10, W91-11, W91-13, W91-14, W91-16 |
| Test quality | PASS with comments | W91-9, W91-15 |
| Ready-made frameworks (I1) | CAUTION | W91-1 (14 hand-built parts without a recorded decision) |
| Reference integrity | PASS | typecheck 0, lint 0, unit 155 / 3,926 |

**Overall: APPROVED WITH COMMENTS.** Severity counts: **Blocker 0 · Major 1 · Minor 10 · Nit 6** (17 findings).
**Zero open blockers.** The one Major (W91-1) is a governance item, not a runtime defect: the controller ruling on the
hand-built parts that have no HB number (CPB1-20, D190 O-16) is still open. It needs a ruling before W101.

### 0.1 Evidence (commands run, read-only)

```
uptime                                                   load 2.17 at start, peak 4.22 (limit 14: never reached)
git diff --stat 057fc17 -- apps/core-server              19 files changed, 198 insertions(+), 73 deletions(-)
git status --porcelain -- apps/core-server | grep '^??'  3 untracked test files (listed above)
npm run typecheck -w @dems/core-server                   TYPECHECK_EXIT=0
npm run lint -w @dems/core-server                        LINT_EXIT=0 (oxlint, no output)
npx vitest run --project unit --maxWorkers=1             Test Files 155 passed (155) · Tests 3926 passed (3926) · 50.03 s
                                                         (equals the ledger of D239: core-server unit 155 / 3,926)
graft callers publishDeviceSessions -d all               6 direct callers (identity only), see 2.1
graft callers devicesChanged -d all                      3 direct callers inside hub.ts (admit, depart, dispatch)
```

The unit run printed repeated `ERROR: failed to copy trust settings of system certificate` lines. That comes from the
sandbox's certificate store. It did not affect the result (exit 0).

---

## 1. Findings

Severity scale: **Blocker** (must fix before W103) · **Major** (fix or rule before W101) · **Minor** (fix in the post-review
pass or record as accepted) · **Nit** (cosmetic, optional).

### W91-1 — Major — 14 hand-built parts have no recorded decision under I1 (CPB1-20, D190 O-16)

- **Where:** see the register in section 3. The main ones: `src/core/pipeline.ts` and `src/core/unit-of-work.ts`;
  `src/app.ts:167-219` (slot and seam registry); `src/plugins/logger/error-log.ts:147-171` (persistent error log with rotation);
  `src/plugins/permission-guard/router-table.ts` (parser of Fastify's printed route table); `src/db/fixtures/` (3,670 lines);
  `test/static/*.ts` (2,134 lines of hand-built source scanners).
- **What is wrong:** D12 approves HB-1 to HB-15 under rule I1 ("ready-made frameworks are mandatory"). CP-B1 listed eight
  more hand-built parts without an HB number (`gateway_check/04_cp_backend_foundation.md:271`). The ruling was routed to the
  controller (CPB1-20), then to W91 (D190 O-16, `implementation/99_implementation_report.md:597-603`), and no ruling was made.
  Since then, later rows added more: the handshake guard, the device-change debounce of FX-C, the bulk fixture, the static
  scanners, and the environment parser.
- **Why it matters:** the user's standing rule is ready-made frameworks and component kits. W101 must show either a recorded
  reason or a replacement for each one. Most of them have a good reason written in their own header comment, but none of those
  reasons is in `decisions/decisions.md`. Two have a credible ready-made alternative: the error log (a pino transport such as
  `pino-roll`) and the static log-call scanner (an oxlint or ESLint rule, or the TypeScript compiler API, instead of text
  scanning).
- **Fix direction:** one controller decision row that lists the 14 parts. For each, either "accepted as HB-16..HB-29 with the
  reason quoted from its header" or "replace by X in the post-review pass". Section 3 gives a suggested ruling per part.

### W91-2 — Minor — After FX-C, three comments describe publication behaviour that is no longer true

- **Where:**
  - `src/modules/admin/changes.ts:157-158`: "The registry writes no row and publishes nothing". Since FX-C,
    `endForOperator` publishes `device.session` (`src/modules/identity/sessions.ts:282-288`).
  - `src/modules/identity/biometric/index.ts:33-36`: "A biometric sign-in ... publishes nothing". It now publishes
    `device.session` (`src/modules/identity/biometric/sign-in.ts:239`).
  - `src/modules/identity/sessions.ts:97-109`: the `SessionRegistry` interface documents that the caller publishes. It does not
    say that `endForOperator` and `endBiometricSessions` now publish `device.session` themselves while `endForDevice` does not.
    Only the helper comment at `sessions.ts:146-153` mentions this.
- **Why it matters:** responsibility for publishing is now split. The registry publishes `device.session` for two of its three
  end methods, and callers publish `session.ended` and `admin.changed`. A maintainer who trusts the comments at
  `admin/changes.ts:157` could add a second `device.session`, or remove the registry's one as a "duplicate". These are the
  identity and admin modules, which are security-relevant.
- **Verification:** read each site. `graft callers publishDeviceSessions -d all` lists the six call sites
  (`sign-in.ts:244`, `biometric/sign-in.ts:239`, `sessions.ts:211, 286, 298, 335`).
- **Fix direction:** update the three comments, and state the rule once on the interface: "the registry publishes the device
  side (`device.session`); the caller publishes `session.ended` and `admin.changed`; `endForDevice` publishes nothing because its
  callers send `admin.changed DEVICES` at once".

### W91-3 — Minor — The longest wait of the device-change debounce reuses the tablet link's limit

- **Where:** `src/realtime/hub.ts:462`
  (`devicesChange.dueAt = Math.min(now + limits.devicesChangedDebounceMs, devicesChange.firstAt + limits.tabletLinkDebounceMs)`).
  The rationale is in `src/realtime/limits.ts:88-96`.
- **What is wrong:** the upper bound for Paired Devices staleness (5 s) is `TABLET_LINK_DEBOUNCE_MS`, a constant that belongs to
  a different feature (spec §12.4, the Core link). `RealtimeLimits` has no field of its own for it.
- **Why it matters:** if someone retunes the tablet-link debounce, the Paired Devices latency changes silently. The unit test
  hides the coupling because it asserts the "at most once per 5 s" bound against `TABLET_LINK_DEBOUNCE_MS`
  (`hub.devices-changed.test.ts:104-123`, assertion at `:122`).
- **Fix direction:** add `DEVICES_CHANGED_MAX_WAIT_MS = 5_000` and `devicesChangedMaxWaitMs` to `RealtimeLimits`
  (`limits.ts:106-123`) and use it at `hub.ts:462` and in the test.

### W91-4 — Minor — Pairing and biometric constants are restated instead of imported from the contract (W83 ledger rows 11 and 59, `83_contract_closeout.md:333`)

- **Where (server copy → contract value):**
  - `src/modules/pairing/limits.ts:17` `PAIRING_CODE_LIFETIME_MS` → `packages/shared/src/api/pairing.ts:92`
  - `src/modules/pairing/limits.ts:19` `PAIRING_CODE_MAX_FAILED_REDEEMS` → `pairing.ts:94`
  - `src/modules/pairing/limits.ts:21` `PAIRING_QR_PREFIX` → `pairing.ts:96`
  - `src/modules/pairing/limits.ts:36` `DEVICE_CREDENTIAL_PREFIX` → `packages/shared/src/api/patterns.ts:62`
  - `src/core/audit-details.ts:33` `PAIRING_CODE_CLOSE_REASONS`, and the literals `'EXPIRED'`, `'CANCELLED'`, `'EXHAUSTED'` at
    `src/modules/pairing/codes.ts:42, 53, 86`, `redeem.ts:168`, `activity.ts:70` → `PairingCodeCloseReason` (`pairing.ts:101`)
  - `src/modules/identity/biometric/tokens.ts:18, 22` `BIOMETRIC_TOKEN_PREFIX`, `BIOMETRIC_TOKEN_LIFETIME_MS` → `patterns.ts`,
    `packages/shared/src/api/identity.ts:87`
  - `src/modules/identity/biometric/enrolment.ts:45` `PASSWORD_SESSION_REQUIRED` → `PASSWORD_SESSION_REQUIRED_REASON`
    (`packages/shared/src/api/contract-model.ts:121`)
- **Why it matters:** the contract texts that clients read (for example the `expiresAt` description at `pairing.ts:122`) are built
  from the shared values, but the server enforces its own copies. Tests pin the server copies to literals
  (`src/modules/pairing/__tests__/secrets.test.ts:26`) and nothing compares them with the shared values. So a contract change
  would ship with a server that disagrees. The credential prefix is the exception: generated credentials are checked against
  the shared `DEVICE_CREDENTIAL_PATTERN` (`devices.db.test.ts:318, 498`). W83 explicitly left these adoptions to W91.
- **Fix direction:** re-export the shared values in `limits.ts` and `tokens.ts` (keep the local names for callers), and type the
  close reasons from `PairingCodeCloseReason`. The CHECK list in `src/db/schema/value-sets.ts:105` stays a literal by design
  (MG-11).

### W91-5 — Minor — Contract values are typed again (CPB1-18, still open; routed "before W91" to W42/W08/W24/W28)

- **Where:**
  - `src/realtime/publication.ts:12-18`: a local `SessionEndedReason` union, while the contract exports one
    (`packages/shared/src/api/realtime-messages.ts:141-149`).
  - Two texts for 401 `NOT_SIGNED_IN`: `'Sign in first.'` (`src/plugins/authenticate/index.ts:141`) and `'Sign in to continue.'`
    (`src/engine/errors.ts:58`, `:74`).
  - Operation-ID lists typed as plain `string`: `src/plugins/throttle/limits.ts:56` (`HEALTH_OPERATION`), `:59-64`
    (`DEVICE_SIGN_IN_OPERATIONS`), `src/plugins/readiness/index.ts:25`, `src/plugins/permission-guard/access-rules.ts:159`
    (`RETIRED_DEVICE_OPERATIONS`), `:173` (`FORBIDDEN_OPERATION`). Compare `ACTIVITY_EXEMPT_OPERATIONS`, which is typed by
    `RegistryOperationId` (`authenticate/index.ts:159, 176`).
- **Why it matters:** a renamed operation or reason still compiles, so drift is caught only by the tests that tie the lists to
  the registry (where they exist). Two texts for one code means a client sees different messages for the same condition.
- **Fix direction:** import `SessionEndedReason` from `@dems/shared/api`; give the engine backstop the stage's `notSignedIn()`
  (keep the simulator-mapped text at `errors.ts:74` only if it must match the simulator, and say so); type the lists with
  `RegistryOperationId`.

### W91-6 — Minor — Small second copies (CPB1-19, still open; owners W17/W21/W29/W11)

- **Where:** `src/db/schema/boot-checks.ts:52` `GENESIS_HASH = '0'.repeat(64)` beside `packages/shared/src/sim/constants.ts:44`,
  with no test tying them. `src/core/limits.ts:55` `EVENT_COUNTER_NAME = 'event'` is not typed as `EngineCounterName`. The
  `CREATE DATABASE … OWNER … TEMPLATE template0 ENCODING 'UTF8' LOCALE 'C'` statement exists three times:
  `src/db/commands/create.ts:36`, `src/db/reset/names.ts:164`, `test/helpers/db/ddl.ts:231`.
- **Why it matters:** these are low-risk copies, but the CP-B1 fix list scheduled them before W91 and they are still here.
- **Fix direction:** as in CP-B1: import the shared constant, type the name, and use one statement builder in `db/commands`.

### W91-7 — Minor — A request-triggered action mutates `process.env` (CPB1-22, still open; owner W29)

- **Where:** `src/db/reset/routine.ts:466` (`scrubDriverEnvironment(process.env)` at R-0) and `src/db/commands/cli.ts:189`. The
  routine runs inside the server for `loadScenario` and `resetDemo` (`src/modules/demo/reset.ts`). The entry point already scrubs
  the environment once at start (`src/index.ts:46`).
- **Why it matters:** this is a global side effect on the request path. Inside the server it is redundant, because the entry has
  already done it. The static network test exempts `src/db/` (CP-B1: `test/static/network.test.ts:115`), so the pattern is not
  guarded.
- **Fix direction:** let the CLI caller scrub, and have the routine take the environment as a parameter (or skip the scrub when
  `internals.openPool` is given by the server).

### W91-8 — Minor — The persistent error log: synchronous file I/O, an untested rotation, a latent no-op rename (part of W91-1)

- **Where:** `src/plugins/logger/error-log.ts:147-171`.
- **What is wrong:** (a) each `append` makes four synchronous filesystem calls on the event loop (`mkdirSync`, `statSync`,
  `appendFileSync`, `chmodSync`). (b) Rotation keeps one generation, and no test covers it: a search of `src` and `test` test
  files for `ERROR_LOG_ROTATE_BYTES`, `.1.log` and `rotat` finds only unrelated device-credential rotation tests. File mode 0600
  is tested (`log-capture.test.ts:350-351`). (c) `file.replace(/\.log$/, '.1.log')` returns the same name for a path that does not
  end in `.log`. `renameSync(file, file)` then does nothing, so the file is never rotated. The production default ends in `.log`
  (`error-log.ts:24-31`), so this edge is latent.
- **Why it matters:** appends happen on error paths, and the pipeline announces an outage only once (`pipeline.ts:258-266`), so
  the blocking is bounded. Still, this is the only hand-built part on the logging path, and a ready-made transport (pino runs file
  transports in a worker thread) does the same job without blocking.
- **Fix direction:** either rule it as accepted (W91-1) and add a rotation test plus a guard for the non-`.log` path, or replace
  it with a pino file transport that has rotation.

### W91-9 — Minor — Test-support shims are still open (F-B2b-1, F-B2b-2), and the new FX-C test imports the shim

- **Where:** `test/acceptance/devices-live.test.ts:38` imports `../../src/realtime/__tests__/support`. That file is a shim whose own
  header says "Import `test/support/realtime` in new code" (`src/realtime/__tests__/support.ts:1-7`). It is pinned by
  `support.db.test.ts:142-149`. Its importers are `test/acceptance/devices-live.test.ts` (new) and
  `test/acceptance/pairing-lifecycle.test.ts`. F-B2b-2: `src/core/__tests__/support.ts` and `src/engine/__tests__/support.ts` are
  still imported from outside their rows (`src/modules/sessions/__tests__/{journey,operations,concurrency}.db.test.ts`,
  `support.ts`, `memory-engine.ts`; `test/acceptance/restart.test.ts`).
- **Why it matters:** each new importer makes the shim harder to remove. D139 DN-2 routed this to "one small serial slot after the
  helper lands", and that slot has not happened.
- **Fix direction:** retarget the two importers to `test/support/realtime`, then delete the shim and its pin test. Do the same for
  the core and engine importers (`test/support/{core,engine}`).

### W91-10 — Minor — Four production files are above 800 lines (CPB1-26), and FX-C grew one of them

- **Where:** `src/db/reset/routine.ts` 1,076 · `src/engine/host.ts` 963 · `src/db/fixtures/identity.ts` 914 ·
  `src/realtime/hub.ts` 860 (817 at `057fc17`: +43 from FX-C). Measured with `wc -l`.
- **Why it matters:** `hub.ts` holds admission, sending, publications, two debouncers, client messages and three timers in one
  closure of about 700 lines. Each new debounce adds module-level `let` state to the same closure.
- **Fix direction:** after W103 (no split before the gate, CP-B1 §7.7), move the publication handlers and debouncers out of
  `hub.ts`, using the same pattern as `tablet-link.ts` (a small factory with its own state that the hub steps from `pace`). Record
  this as accepted until then.

### W91-11 — Minor — A generic timer helper lives in the identity module and pairing imports it; three timer abstractions

- **Where:** `src/modules/pairing/index.ts:48` imports `createSweeper` from `../identity`. `src/modules/pairing/devices.ts` imports
  `SESSION_IDLE_TIMEOUT_MS` from `../identity`. The generic timers are `src/modules/identity/sweeper.ts` (57 lines),
  `src/engine/timer.ts` (`EngineTimer.every`, 35 lines) and `src/engine/scheduler.ts` (132 lines). The realtime channel uses
  `EngineTimer`.
- **Why it matters:** this is the pattern CPB1-10 removed elsewhere: a generic helper held by a domain module and imported across
  modules. It also gives three ways to "run X every N ms while listening".
- **Fix direction:** move `createSweeper` next to `src/core/windows.ts` (core, already shared by three units per CPB1-16), or build
  it on `EngineTimer`. Pairing would then import from core only.

### W91-12 — Nit — `DEVICE_COMMAND_OF_OPERATION` restates the contract table, which has its own reverse lookup

- **Where:** `src/modules/devices/operations.ts:41-51`. The comment says "Read from the contract's table", but the three entries
  are written out again (computed keys). The contract already exports `deviceCommandOfOperation(operationId)`
  (`packages/shared/src/api/sim-actions.ts:110-112`).
- **Fix direction:** derive the table by inverting `DEVICE_COMMAND_OPERATIONS`, or call the shared helper at
  `src/modules/devices/index.ts:125-127`. The test at `routes.test.ts:160-164` already ties the two.

### W91-13 — Nit — A stale comment names a test file that does not exist (CPB1-25, still open; owner W17)

- **Where:** `src/db/schema/value-sets.ts:7` cites `test/db/vocabulary.db.test.ts`. The test is
  `test/db/contract-inventory.test.ts:241` (`ls test/db/` shows no `vocabulary*` file).

### W91-14 — Nit — Stale test comment, prints of closed gaps, and history markers (W83 ledger row 19)

- **Where:** `test/acceptance/contract.test.ts:938` says "printed, not pinned", but `:943-944` now pins the verdicts. The
  `knownGap` / `ledger.gapVerdicts` machinery (`:936-944`) and 45 `console.info` lines in `contract.test.ts` still print gaps
  that are closed (for example `:513`, `:529`, `:564`). Across the package there are 306 `console.info` calls in 77 test files.
  The `BE-GAP-W36-1` markers are at `src/modules/devices/__tests__/status.test.ts:8, 182, 226` and `src/modules/devices/status.ts:48`.
- **Why it matters:** this is noise in every run log, and new readers see the history markers as open gaps.
- **Fix direction:** fix the comment at `:938`, drop the prints of closed gaps, and reword the markers (W83 left the rewording
  to W91).

### W91-15 — Nit — Test-structure points in the new FX-C tests

- **Where:** `test/acceptance/devices-live.test.ts:111-172`: five `it` blocks share sockets and state across blocks (step 1 opens
  the socket that steps 2 to 4 use). One failure cascades, and a shuffled run would break. `src/realtime/__tests__/hub.devices-changed.test.ts:44-48`:
  "the numbers" asserts `Permission.PAIRING_MANAGE === 'PAIRING_MANAGE'`, which is a tautology. Its title promises "the holder of
  PAIRING_MANAGE only", which that test does not check (the other tests do, through `nobodyElse`).
- **Note:** the behaviour tests themselves are good. They prove the debounce bounds on a manual clock, the single message per
  transition, permission targeting, rollback silence (`device-session.db.test.ts:101-115`) and the order relative to
  `session.ended`.
- **Fix direction:** one journey `it` with labelled steps, or `describe.sequential` plus a comment; drop the tautology.

### W91-16 — Nit — `device.session.deviceIds` is never read by its only consumer

- **Where:** `src/realtime/publication.ts:49` defines `deviceIds`. The hub ignores the payload (`src/realtime/hub.ts:504-506`).
  Only tests read it (`device-session.db.test.ts:62`, `pairing/__tests__/secrets.db.test.ts:260`).
- **Fix direction:** keep it if per-device targeting is planned, and say so on the type. Otherwise document it as a diagnostic
  payload. No code change is required.

### W91-17 — Nit — C2-R2 is still open (outside `apps/core-server`; HB-1)

- **Where:** `scripts/pg/server.mjs:84-88`: a failed `pg:start` prints the last 15 lines of `.data/postgres.log` with no hint that
  errors raised after the log collector starts are in `.data/postgres/log/`.
- **Fix direction:** add one hint line (D195 routed it to "W91 or the runbook", and to W90/W102). The owner is W90 or the runbook.

---

## 2. Review of the FX-C delta (the focus)

### 2.1 Dependency impact

`publishDeviceSessions` (`src/modules/identity/sessions.ts:154-162`) is called from six places, all in the identity module
(`graft callers publishDeviceSessions -d all`):

| Transition | Call site | Registered | Covered by |
|---|---|---|---|
| Password sign-in on a device | `sign-in.ts:244` | `afterCommit`, after the `ROTATED` task | `device-session.db.test.ts:65-73`; `enrolment.db.test.ts:85` |
| Biometric sign-in | `biometric/sign-in.ts:239` | `afterCommit` | `engine.db.test.ts:119` |
| Sign-out | `sessions.ts:335` | after `session.ended` | `device-session.db.test.ts:75-88` |
| Idle/absolute expiry (sweep, stage-4 resolve, touch) | `sessions.ts:211` via `publishExpired` | after the per-reason `session.ended` | `device-session.db.test.ts:90-99`; `sessions.db.test.ts:338-341` |
| Disabled operator | `sessions.ts:286` (`endForOperator`) | inside the caller's unit | `device-session.db.test.ts:101-115` (rollback silence included) |
| Token reuse | `sessions.ts:298` (`endBiometricSessions`) | inside the caller's unit | `engine.db.test.ts:126`; `device-session.db.test.ts:117-125` |
| Revoke / unpair | none by design (`endForDevice`, `sessions.ts:290-293`) | callers publish `device.revoked` then `admin.changed DEVICES` (`pairing/devices.ts:113-114`) | `device-session.db.test.ts:127-131`; `hub.devices-changed.test.ts:125-136` |

The order is correct in every case:
- On a revoke, `device.revoked` closes the sockets first, synchronously (`hub.ts:247-258`, `depart` at `:228-236`). That queues a
  device change. The immediate `admin.changed DEVICES` then clears the pending one (`hub.ts:473`). So the page gets one message,
  and the unit test models production faithfully: `depart` runs inside `close`, not on the peer's close frame.
- On a disable, `device.session` (registered inside `endForOperator`) comes before `session.ended` and `admin.changed USERS`
  (`admin/changes.ts:170-173`). Both end up in one debounced DEVICES message.
- The pairing redeem publishes an immediate `admin.changed DEVICES` (`pairing/redeem.ts:155`). The new device's first socket
  then adds one debounced DEVICES message about 1 s later. That is a harmless second read.

### 2.2 Correctness checks performed

- **Refused or over-cap sockets do not count as device changes.** `present` is set only for an admitted, live socket
  (`hub.ts:736-741`, flag set at `:738`), and `depart` returns early unless `present` is true (`:230`).
- **Shutdown:** `stopped = true` is set before the sockets are closed, so `depart` → `devicesChanged` returns at once
  (`hub.ts:456`, `:811-815`).
- **The debounce is bounded at 1 s quiet and 5 s total:** `hub.ts:455-468`, checked by `hub.devices-changed.test.ts:104-123`
  (40 reconnects in 20 s give 4 messages, each gap at least 5 s). The coupling of the 5 s bound is W91-3.
- **Secrets:** the publication carries device IDs only. Two tests assert the exact keys (`biometric/__tests__/secrets.db.test.ts:268-274`,
  `pairing/__tests__/secrets.db.test.ts:256-265`). The hub never forwards `device.session` to a client, only
  `admin.changed DEVICES` to OPERATOR sockets that hold the resource permission (`hub.ts:475-482`). An investigator console and
  anonymous sockets get nothing (`hub.devices-changed.test.ts:28-31`; `devices-live.test.ts:160-168`).
- **Rotation on a device:** the replaced session is the presented bearer session, and ID-13 binds a bearer session to the same
  device (`plugins/authenticate/index.ts:226-239`; `console.ts:54-60`). So `publishDeviceSessions(app, unit, [issued.session])`
  covers the replaced session's device too.
- **W83 rewording in the delta:** the changes in `devices/operations.ts`, `routes.test.ts`, `commands.db.test.ts`,
  `contract.test.ts`, `contract.support.ts` and `shared-state.test.ts` are comments, titles, and assertions that are now pinned.
  `KNOWN_CODE_GAPS` was emptied (`contract.test.ts:1457`) and the block now proves the close-out. One stale comment is left
  (W91-14). `owner-connection.ts:10-12` corrects CPS1-13's sentence.

---

## 3. Register of hand-built parts without a recorded decision (I1; CPB1-20, O-16) — input to W91-1

"Recorded decision" means an HB number in D12 or another row of `decisions/decisions.md` that accepts the part as hand-built.
Where a decision covers the behaviour but not its hand-built status, that is noted.

| # | Part | Where (lines) | Ready-made alternative considered | Reason in the code (quoted source) | Suggested ruling |
|---|---|---|---|---|---|
| HBX-1 | Serial unit-of-work queue | `src/core/pipeline.ts` (454) | `p-queue` with concurrency 1 covers only the queue | Couples the queue with one transaction, the audit-chain lock, `afterCommit` ordering, the watchdog and re-entrancy refusal (`pipeline.ts:10-38`); planned in `02_plan.md` line 1721 | Accept as HB; the transaction semantics are domain-specific |
| HBX-2 | Unit of work and statement guard | `src/core/unit-of-work.ts` (452) | Drizzle `db.transaction` (no statement guard, no lazy BEGIN) | Lazy transaction, statement guard (CPB1-4), `search_path` pin (D87 F53) | Accept as HB |
| HBX-3 | Slot and seam registry | `src/app.ts:167-219` | Fastify decorators with `fastify-plugin` `dependencies` / `hasDecorator` | Provide-once, test-only `replace`, a boot error that names the missing provider (`app.ts:168-176`) | Accept, or replace with decorators plus a test-only override |
| HBX-4 | Persistent error log with rotation | `src/plugins/logger/error-log.ts:147-171` | pino file transport with `pino-roll` (worker thread) | none recorded beyond "one generation" (`:33`) | **Replace, or accept with a rotation test (W91-8)** |
| HBX-5 | 405 route table | `src/plugins/error-envelope/route-table.ts` (60) | none in Fastify core | Contract needs 405 with `Allow` | Accept as HB |
| HBX-6 | Fixed windows over the server clock | `src/core/windows.ts` (83) | `rate-limiter-flexible` alone cannot take a manual clock | `windows.ts:9-13` | Accept as HB (keeps the two libraries of D12) |
| HBX-7 | Engine scheduler | `src/engine/scheduler.ts` (132) | none fitting the suspend/resume rules of ENG-5 | host header | Accept as HB, part of HB-13 |
| HBX-8 | Reader of Fastify's printed route table | `src/plugins/permission-guard/router-table.ts` (73) | `onRoute` registered first (see the header for why not) | `router-table.ts:5-10`; CPB1-24 behaviour ruled to stay (CP-B1 §7.6) | Accept as HB (fails closed; tied to the router by `guard.test.ts:306-316`) |
| HBX-9 | Migration-ledger hash check over the Drizzle migrator | `src/db/commands/migrations.ts` (270) | Drizzle migrator (used, `:255`) | D38: the migrator does not enforce MG-4 | Accept as HB (behaviour recorded in D38) |
| HBX-10 | Upgrade-socket handshake guard | `src/realtime/handshake.ts` (147) | none in `@fastify/websocket` | CPS1-4 (`handshake.ts:1-30`) | Fold into HB-8, or accept as its own HB |
| HBX-11 | Tablet-link debounce and FX-C device-change debounce | `src/realtime/tablet-link.ts` (132); `src/realtime/hub.ts:455-474` | `lodash.debounce` (cannot use the manual clock) | D127; D202 FXC-2 | Fold into HB-8 (send policy) |
| HBX-12 | Bulk fixture generator | `src/db/fixtures/` (3,670) | `@faker-js/faker` with a seed (values only; the minimums and chain are domain-specific) | W25, deterministic minimums of `[DB:§11]` | Accept as HB |
| HBX-13 | Static source scanners (log calls, imports, network, credentials, …) | `test/static/*.ts` (2,134; e.g. `log-calls.ts:123-167`) | an oxlint/ESLint custom rule, or the TypeScript compiler API, instead of text scanning | none recorded | Accept as test tooling, or move the log-call rule to the TypeScript AST |
| HBX-14 | Environment parsing | `src/config.ts`, `src/plugins/config/load-config.ts` (`parseListenPort`, `parseLogLevel`, `parseDemoControls`) | `zod` (already a dependency), `env-schema` / `@fastify/env` | three variables only (W08, D40) | Accept, or use the zod schema |

Not hand-built, as D12 requires: throttle counts with `@fastify/rate-limit`; lockout, denial budget and redeem lock with
`rate-limiter-flexible`; security headers with `@fastify/helmet`; cookies with `@fastify/cookie`; WebSocket with
`@fastify/websocket`; validation with `fastify-type-provider-zod`; migrations generated and applied by Drizzle. `@fastify/swagger`
and `openapi-types` are installed but not imported. That is recorded as "peer of the provider; installed, not registered"
(`02_plan.md:289-290`). `react` is declared for the hosted simulator (D39).

---

## 4. Routed items: confirmed, open, or not confirmable

| Item | Source | Status at W91 | Evidence |
|---|---|---|---|
| D202 FX-C `device.session` publication | D202 FXC-2 | **Confirmed** | 6 call sites, section 2.1 |
| D202 debounced `admin.changed DEVICES` (1 s quiet, at most 5 s) | D202 FXC-2 | **Confirmed** (coupling: W91-3) | `hub.ts:455-474`; `hub.devices-changed.test.ts` (unit, run green within 155 / 3,926) |
| D202 `recordingActor` from audit rows | D202 | **Confirmed by reading** (shared code; the server hosts it unchanged) | `packages/shared/src/sim/session-machine.ts:841-849`; fallback to `createdBy` per FXC-1 |
| D202 note `authorRole` | D202 FXC-3 | **Confirmed by reading**; no server code path. It persists through the JSON columns of the mapping | `session-machine.ts:1145-1146`; `src/db/mapping/rows.ts:537, 567`. Not re-run: db tests are excluded while W90 runs |
| RESIDUAL-W77-1: no `admin.changed USERS` on sign-in, sign-out or expiry | D172, D202, R-C5 | **Confirmed still present; accepted residual** (not a finding) | `sign-in.ts:238-244`, `sessions.ts:325-337` publish no USERS. Observation: FX-C's debouncer weakens R-C5's cost argument ("every sign-in would notify every USER_ADMIN socket"). A debounced USERS message beside DEVICES would cost one more pending slot in the hub |
| D195 C2-R1 (pg-behaviours on a terse cluster) | D195 | **Not reviewed**: belongs to W90, in flight | — |
| D195 C2-R2 (`pg:start` hint) | D195 | **Open** → W91-17 | `scripts/pg/server.mjs:84-88` |
| D195 C2-R4, C2-R5 | D195 | Not this codebase (W92, W100) | — |
| O-15 F-B2b-1 realtime shim | D139 DN-2 | **Open** → W91-9 | `src/realtime/__tests__/support.ts:1-8`; 2 importers |
| O-15 F-B2b-2 core/engine support decoupling | D139 DN-2 | **Open** → W91-9 | importers listed in W91-9 |
| O-15 CPB1-18 | `04c:78` | **Open** → W91-5 | — |
| O-15 CPB1-19 | `04c:79` | **Open** → W91-6 | — |
| O-15 CPB1-22 | `04c:82` | **Open** → W91-7 | — |
| O-15 CPB1-24 | `04c:83` | **Behaviour ruled** (stays, fails closed); hand-built status listed as HBX-8 | — |
| O-15 CPB1-25 | `04c:84` | **Open** (one of four left) → W91-13 | — |
| O-15 CPB1-26 | `04c:85` | **Open**; the list changed and `hub.ts` grew → W91-10 | — |
| O-16 CPB1-20 | D190 | **Open** → W91-1, register in section 3 | — |
| W83 ledger row 11 (pairing constants) | `83_contract_closeout.md:113` | **Open** → W91-4 | — |
| W83 ledger row 59 (`PAIRING_CODE_CLOSE_REASONS`) | `83:166` | **Open** → W91-4 (the shared name is `PairingCodeCloseReason`) | — |
| W83 row 19 (`BE-GAP-W36-1` markers) | `83:121` | **Open** → W91-14 | — |
| W83 §7.2 optional adoptions (`biometric/tokens.ts`, `enrolment.ts`, `pairing/activity.ts`) | `83:332-333` | **Open** → W91-4 | — |
| SR-67 all SQL parameterised | `01_specs.md:1670` | **PASS** | No value is interpolated into SQL. Interpolated identifiers come only from code constants or the guarded name: `db/reset/kept-tables.ts:86-120` (`KEPT_TABLES`, `:62`), `db/fixtures/load.ts:274` (`ALL_TABLES`), `db/commands/create.ts:36` and `db/reset/names.ts:164` (identifier checked by `IDENTIFIER`, `names.ts:132, 156`). `sql.raw` is used only in schema CHECK builders from code constants (`db/schema/checks.ts:20, 30, 53`) |

---

## 5. Other domains checked with no finding

- **Concurrency.** The hub is single-threaded and synchronous per publication. `publish` is called after each commit in commit
  order (`hub.ts:25-30`). The pipeline's watchdog abandons a unit, and the engine's `undo` restores `before`
  (`engine/host.ts:507-524`) before the next unit starts, because the next unit waits for `setImmediate` (`pipeline.ts:313-317`).
  An abandoned work function cannot write: `assertOpen` refuses (`pipeline.ts:145-157`) and its pending statement rejects when the
  connection is destroyed. `inUnit` checks again, when the unit's turn comes, that the engine was not reloaded meanwhile
  (`host.ts:540`).
- **Secrets in logs.** Pino redacts `authorization`, `cookie` and `set-cookie` at every depth (`plugins/logger/logger-options.ts:37-47, 204`).
  `describeError` reads no message (`error-log.ts:128-145`). The authenticate stage logs presence only (`authenticate/index.ts:259-264`).
- **RBAC.** No route was added in the delta; deny-by-default at boot (D83) is unchanged.
- **Input validation.** The redeem refuses secret-shaped text and the code itself in stored texts (`pairing/redeem.ts:91-95`).
  Schemas come from the registry through `fastify-type-provider-zod`.
- **Audit completeness.** Sign-in, sign-out and expiry write their rows inside the same unit as the session change
  (`sign-in.ts:234-237`, `sessions.ts:333`, `:219`, `:312`). FX-C added publications only, no new audited action.
- **Migrations.** No migration in the delta; `src/db/migrations` is unchanged since `057fc17`.

## 6. Positive findings

- FX-C is small, placed where the sessions end, and covered at three layers: the hub with a manual clock, the identity module
  on a database clone, and a real-socket acceptance journey. The tests include a rollback case that proves nothing is published
  on a rollback.
- Doing `depart` synchronously inside `close` keeps the revoke path at one message without special cases.
- The publication carries no secret, and two existing secrets tests were extended to pin its exact keys instead of being loosened.
- The W83 close-out turned printed-only checks into assertions (`routes.test.ts:487`, `contract.test.ts:943-944`) and emptied
  `KNOWN_CODE_GAPS`, so the block now proves the close-out.
- Typecheck, lint and the 3,926 unit tests are green on the uncommitted tree.

## 7. Files reviewed

Read in full: `src/modules/identity/sessions.ts`, `src/modules/identity/sign-in.ts` (60-289),
`src/plugins/authenticate/index.ts`, `src/plugins/authenticate/console.ts`, `src/realtime/hub.ts`, `src/realtime/index.ts` (120-368),
`src/realtime/limits.ts` (diff), `src/realtime/publication.ts` (1-30 and diff), `src/modules/pairing/redeem.ts`,
`src/modules/pairing/limits.ts`, `src/modules/identity/sweeper.ts`, `src/core/pipeline.ts`, `src/engine/host.ts` (1-140, 478-630),
`src/modules/admin/changes.ts` (90-200), `src/modules/demo/reset.ts` (1-60), `src/index.ts` (40-140), `src/app.ts` (160-230),
`src/plugins/logger/error-log.ts` (20-36, 120-172), `src/plugins/permission-guard/router-table.ts` (1-40),
`src/db/commands/migrations.ts` (1-30), `src/core/windows.ts` (1-25), `src/realtime/handshake.ts` (1-30), the three untracked
test files, and the full `git diff 057fc17 -- apps/core-server`.
Read by search (grep or graft, cited at each finding): the 13 other `src/` files cited in sections 1 to 5, `test/static/`, `test/db/`,
`packages/shared/src/api/{pairing,patterns,identity,contract-model,sim-actions,realtime-messages}.ts`,
`packages/shared/src/sim/{constants,session-machine}.ts`, `scripts/pg/server.mjs` (78-95).
Task documents: `masterplan/02_plan.md` (rows W91, V1, 10.3), `masterplan/01_specs.md:1670`, `decisions/decisions.md`
(D12, D87, D139, D172, D190, D195, D202, D239), `gateway_check/04_cp_backend_foundation.md` (§4.4, §5), `gateway_check/04c_cp_backend_fix_round_b2b.md` (§3-§4, §10),
`implementation/83_contract_closeout.md` (rows 11, 19, 55, 59, §7.2), `implementation/99_implementation_report.md` (§8, §10).
