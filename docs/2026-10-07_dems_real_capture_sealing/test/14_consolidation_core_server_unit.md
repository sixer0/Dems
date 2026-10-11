---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-11
agent: test-expert
step: test-suite consolidation, owner of the core-server UNIT tests (SV-U)
decisions: D233, D238
tree: a5d75ed + the uncommitted consolidation work of this owner
status: complete
---

# Test-suite consolidation: core-server unit tests

Scope: `apps/core-server`, every test file that is not `*.db.test.ts`, plus `test/static/**` and
`test/support/**`. Not touched: `*.db.test.ts`, `test/db/**`, `test/helpers/db/**`,
`test/acceptance/**`, the e2e rigs. Rules: `delegation_progress/consolidation_brief.md`,
`delegation_progress/driver_rules_d94.md`. Work list: `test/13_suite_consolidation_audit.md`
sections 3c, 4, 5 and 7.1 (SV-U1 to SV-U5).

No product file changed (`git status --short apps/core-server | grep '^ M' | grep -v '__tests__/\|/test/'`
prints nothing). No git write, no install, no database test, no lane. No test was deleted.

## 1. Before and after

Command, the one of `test/12_precommit_wave_m.md` row 4, with the JSON reporter added as test/12 did:
`npx vitest run --root apps/core-server --project unit --maxWorkers=4 --reporter=default --reporter=json --outputFile.json=<scratchpad>/x.json`
(outside the command sandbox: the unit project binds loopback).

| | files | tests | result | vitest "Duration" | wall of the command | sum of per-file times |
|---|---|---|---|---|---|---|
| before, run 1 (17:09, load 1.2 at the start) | 356 | 6691 | 6689 passed, **2 failed** | 159.86 s | 160 s | - |
| before, run 2 (17:16, load below 8) | 356 | 6691 | 6691 passed | 73.66 s | 74 s | 153 s |
| after (17:28, load 3.5) | 324 | 6700 | 6700 passed | 66.73 s | 67 s | 145 s |

Run 1 of "before" is not a baseline: other owners started whole suites while it ran and the
1-minute load went from 1.2 to 97 (`uptime` at the end: 102.90). Its two reds were
`src/capture/__tests__/ipc.test.ts` ("the capture worker went down before it acknowledged the
command", a real child process starved of CPU) and `src/sealing/__tests__/pipeline.test.ts`
("Test timed out in 5000ms", a case that takes 3.1 s on a quiet host). I waited for the load to
fall below 8 and ran the suite again before changing any file (rule D122: a second run only after
a fail): 0 failed. Both tests are in the after run and pass. They are sensitive to a starved host;
nothing in this work changes that (no timeout was raised).

Typecheck and lint after the work: `npm run typecheck -w @dems/core-server` exit 0, 0 `error TS`;
`npm run lint -w @dems/core-server` (oxlint) silent.

Wall: 73.66 s to 66.73 s, one run each. The part I can attribute is one file,
`transcription/__tests__/encrypted-credential.test.ts`, 11.9 s to 0.3 s (section 6). The rest of
the difference is inside what one run cannot separate from noise; I did not repeat the runs.

### The 10 slowest files

| # | before (run 2) | s | tests | after | s | tests |
|---|---|---|---|---|---|---|
| 1 | `src/transcription/__tests__/encrypted-credential.test.ts` | 11.9 | 4 | `src/sealing/__tests__/pipeline.test.ts` | 11.5 | 61 |
| 2 | `src/capture/adapters/local/__tests__/mic-helper.generated.test.ts` | 11.3 | 8 | `src/capture/adapters/local/__tests__/mic-helper.generated.test.ts` | 11.3 | 8 |
| 3 | `src/sealing/__tests__/pipeline.test.ts` | 9.8 | 61 | `src/capture/adapters/local/__tests__/no-delivery.test.ts` | 9.5 | 17 |
| 4 | `src/capture/adapters/local/__tests__/no-delivery.test.ts` | 9.5 | 17 | `src/capture/__tests__/ipc.test.ts` | 9.0 | 16 |
| 5 | `src/capture/__tests__/ipc.test.ts` | 9.1 | 16 | `src/capture/adapters/camera/__tests__/ws-discovery.test.ts` | 8.4 | 28 |
| 6 | `src/capture/adapters/camera/__tests__/ws-discovery.test.ts` | 8.4 | 28 | `src/db/mapping/__tests__/round-trip.test.ts` | 7.1 | 43 |
| 7 | `src/sealing/__tests__/finalize-transcript.test.ts` | 7.0 | 30 | `src/sealing/__tests__/finalize-transcript.test.ts` | 6.7 | 31 |
| 8 | `src/db/mapping/__tests__/round-trip.test.ts` | 5.5 | 43 | `test/support/fake-onvif-stub.test.ts` | 5.3 | 38 |
| 9 | `test/support/fake-onvif-stub.test.ts` | 5.3 | 38 | `src/sealing/__tests__/stt-states.test.ts` | 4.5 | 20 |
| 10 | `src/transcription/__tests__/session-run.test.ts` | 5.3 | 21 | `src/sealing/__tests__/stt-states-verify.test.ts` | 4.4 | 57 |

### The count, to the single test

6691 to 6700 = **+9**, all of them the new file `test/static/scan-coverage.test.ts` (the tests of
rule R1, section 3). Checked from the two JSON reports (script `scratchpad/c14u`, last command of
the session): for every file of the after run, tests = its own tests before + the tests of the
files merged into it; the only file that differs is `scan-coverage.test.ts` (expected 0, got 9).
343 run tests moved with their files. 0 tests deleted.

Titles that changed (5, the wording of a converted list pin): "exactly these production files",
"the five production files", "the four production files", "of the folder: one file", "the eight
production sources" lost their number or the word "exactly" (section 3). Three `.each` titles of
`fault-lifecycle.test.ts` print a function's source in the title and therefore show the new
indentation; the cases are the same.

### Files

356 to 324: 41 per-wave files removed, 8 feature-named files created from them, 1 new test file
(`scan-coverage.test.ts`). One new support file that is not a test: `test/static/module-rules.ts`.

## 2. SV-U2: per-wave files merged into their homes

Method: `scratchpad/c14u/merge.mjs` (TypeScript compiler API). The imports of the per-wave file
are merged into the home's; everything else of the file (its head comment, helpers, hooks,
describes) is appended inside ONE `describe`, whose title names the finding and the wave. The
helpers and hooks of the merged file keep the scope they had as a file; nothing collides with the
home. Where no feature-named home existed, the file became the home under a feature name (the
audit's own precedent, W2).

Proof (`snap.mjs`, `checkmerge.mjs`, `diff.mjs` in the scratchpad): for all 4,762 `it` / `test`
call sites of the unit files before, the title and the SHA-1 of the whole call (comments and white
space normalised) were recorded. After: every one of the 272 call sites of the 41 files is found
in its home with the same title and the same hash; every home still holds each of its own call
sites; 4,709 call sites of the workspace are unchanged, and the 53 that changed are exactly the
entries of sections 3, 4, 5 and 6. The 30 home files were run after the merge and again after the
helper de-duplication: 784 passed, 0 failed, both times.

"P" = inside a PROTECTED glob of audit section 7.0 (merged by file, case for case, titles kept).

| from (removed) | tests | to | tests after | P |
|---|---|---|---|---|
| `capture-session/__tests__/wave-h-a-facts-removal.test.ts` | 5 | `capture-session/__tests__/facts-fy.test.ts` | 10 | P (states only facts) |
| `capture/__tests__/review-m3.test.ts` | 28 | `capture/__tests__/supervisor.test.ts` | 61 | |
| `capture/__tests__/wave-h-f.test.ts` | 26 | `capture/__tests__/fault-lifecycle.test.ts` | 42 | |
| `capture/boot/__tests__/wave-h-f-boot.test.ts` | 10 | `capture/boot/__tests__/boot.test.ts` | 18 | |
| `capture/fence/__tests__/wave-h-z1-speech-fixture-format.test.ts` | 18 | `capture/fence/__tests__/fake-mic.test.ts` | 32 | P (fence) |
| `capture/fence/__tests__/wave-i-a2-admit.test.ts` | 4 | `capture/fence/__tests__/fence.test.ts` | 52 | P (fence) |
| `db/reset/__tests__/wave-i-a1-unsealed-fake.test.ts` | 10 | `db/reset/__tests__/package-removal.test.ts` | 22 | |
| `engine/__tests__/pass-j-core-not-running.test.ts` | 4 | `engine/__tests__/rehydrate.test.ts` | 42 | P (restart fault) |
| `engine/__tests__/wave-i-a2-graceful-restart.test.ts` | 4 | `engine/__tests__/rehydrate.test.ts` | | P (graceful restart) |
| `engine/__tests__/wave-k-s1-restart-fault.test.ts` | 7 | `engine/__tests__/rehydrate.test.ts` | | P (restart fault) |
| `engine/__tests__/wave-h-z1-connect-hold.test.ts` | 2 | `engine/__tests__/clock-floor.test.ts` | 33 | |
| `evidence-export/__tests__/wave-h-c1.test.ts` | 5 | `evidence-export/__tests__/jobs.test.ts` | 20 | P (evidence-export) |
| `evidence-facts/__tests__/wave-h-r-interrupted-agreement.test.ts` | 3 | `evidence-facts/__tests__/sealed-facts.test.ts` (new) | 14 | |
| `evidence-facts/__tests__/wave-k-s2-transcript-model.test.ts` | 6 | `evidence-facts/__tests__/sealed-facts.test.ts` | | |
| `evidence-facts/__tests__/wave-l-s-sealed-profile.test.ts` | 5 | `evidence-facts/__tests__/sealed-facts.test.ts` | | |
| `evidence-verify/__tests__/fix-m7-verify.test.ts` | 9 | `evidence-verify/__tests__/development-key.test.ts` | 13 | P (evidence-verify) |
| `evidence-verify/__tests__/fix-m7b-export-notice.test.ts` | 4 | `evidence-verify/__tests__/core-verification.test.ts` | 22 | P |
| `evidence-verify/__tests__/fix-m7c-revision-pending.test.ts` | 7 | `evidence-verify/__tests__/core-verification.test.ts` | | P |
| `evidence-verify/__tests__/wave-k-kr-plain-checked.test.ts` | 3 | `evidence-verify/__tests__/core-verification.test.ts` | | P |
| `media-stream/__tests__/wave-k-z1-seek-index.test.ts` | 30 | `media-stream/__tests__/seek-index.test.ts` (new) | 30 | P (media-stream) |
| `modules/capture-config/__tests__/wave-i-a2-refusal-reasons.test.ts` | 3 | `modules/capture-config/__tests__/routes.test.ts` | 16 | |
| `modules/capture-discovery/__tests__/wave-i-a2-search-ids.test.ts` | 5 | `modules/capture-discovery/__tests__/search-ids.test.ts` (new) | 5 | |
| `modules/capture-discovery/__tests__/wave-l-s-open-session.test.ts` | 4 | `modules/capture-discovery/__tests__/search.test.ts` | 19 | |
| `modules/demo/__tests__/wave-k-kr-reset-device.test.ts` | 2 | `modules/demo/__tests__/routes.test.ts` | 47 | |
| `modules/evidence/__tests__/wave-k-s2-export-default.test.ts` | 4 | `modules/evidence/__tests__/export-request.test.ts` | 40 | |
| `modules/media-stream/__tests__/wave-k-z1-indexed-view.test.ts` | 26 | `modules/media-stream/__tests__/indexed-view.test.ts` (new) | 26 | P (media-stream) |
| `modules/media-stream/__tests__/wave-l-s-cut-socket.test.ts` | 3 | `modules/media-stream/__tests__/routes.test.ts` | 42 | P (media-stream) |
| `modules/transcripts/__tests__/wave-k-s2-from-current.test.ts` | 4 | `modules/transcripts/__tests__/revision-reconcile.test.ts` | 12 | |
| `sealing-host/__tests__/wave-k-s1-stream-profile.test.ts` | 12 | `sealing-host/__tests__/stream-profile.test.ts` (new) | 26 | P (sealing-host) |
| `sealing-host/__tests__/fix-151-declared-profile.test.ts` | 14 | `sealing-host/__tests__/stream-profile.test.ts` | | P |
| `sealing-host/__tests__/wave-h-a-camera-end.test.ts` | 4 | `sealing-host/__tests__/sealing-host.test.ts` | 22 | P (states only facts) |
| `sealing-host/__tests__/wave-h-a-manifest-facts.test.ts` | 5 | `sealing-host/__tests__/sealing-host.test.ts` | | P (states only facts) |
| `sealing-host/__tests__/wave-h-a-session-key-no-reuse.test.ts` | 5 | `sealing-host/__tests__/session-key.test.ts` (new) | 14 | P (session keys) |
| `sealing-host/__tests__/wave-i-a1-session-key.test.ts` | 9 | `sealing-host/__tests__/session-key.test.ts` | | P (session keys) |
| `sealing-host/__tests__/wave-h-z1-installation-identity.test.ts` | 19 | `sealing-host/__tests__/installation-identity.test.ts` (new) | 19 | P |
| `sealing-host/__tests__/wave-i-a1-progress.test.ts` | 4 | `sealing-host/__tests__/progress.test.ts` | 10 | P |
| `sealing-host/__tests__/wave-k-s1-seal-rig.test.ts` | 13 | `sealing-host/__tests__/seal-rig.test.ts` (new) | 13 | P |
| `sealing/__tests__/wave-i-a1-way-out.test.ts` | 7 | `sealing/__tests__/way-out.test.ts` | 31 | P (sealing) |
| `sealing/__tests__/wave-l-s-retry-sentence.test.ts` | 3 | `sealing/__tests__/way-out.test.ts` | | P |
| `sealing/__tests__/wave-l-z-blocked-sentence.test.ts` | 6 | `sealing/__tests__/way-out.test.ts` | | P |
| `sealing/__tests__/wave-k-s1-transcript-eta.test.ts` | 1 | `sealing/__tests__/finalize-transcript.test.ts` | 31 | P |

All paths under `apps/core-server/src/`. Sum: 41 files, 343 run tests.

Homes that differ from the audit's table 3c, and why (the audit found homes by a shared import;
I read the files):

- `review-m3` to `supervisor.test.ts`, not `fault-lifecycle.test.ts`: its own head says "the
  findings ... that are the supervisor's".
- `wave-i-a1-way-out`, `wave-l-s-retry-sentence`, `wave-l-z-blocked-sentence` to
  `sealing/__tests__/way-out.test.ts`: a file of that subject exists; the audit named
  `finalize-transcript.test.ts`.
- `wave-k-s2-transcript-model` and `wave-l-s-sealed-profile` stay in their own folder
  (`evidence-facts`, which had no feature-named test file at all) as `sealed-facts.test.ts`. The
  audit's homes were in `evidence-verify` and in a `.db.test.ts`; the second would have crossed
  into the db owner's files.
- `wave-k-kr-reset-device` to `modules/demo/__tests__/routes.test.ts` (it drives the route through
  the app), not `host.test.ts` (no app).
- The five without a home by import: `wave-h-r-interrupted-agreement` (to `sealed-facts`),
  `wave-l-s-open-session` (to `search.test.ts`, it imports `../search`), `wave-k-z1-indexed-view`
  (becomes `indexed-view.test.ts`), `wave-l-s-cut-socket` (to `routes.test.ts` of the module),
  `wave-k-s1-transcript-eta` (to `finalize-transcript.test.ts`, the step it is about).
- Eight files became a feature-named file instead of joining a large one: `sealing-host.test.ts`
  would have received 76 tests and about 1,500 lines under the audit's table. Largest merged files
  now: `capture/__tests__/supervisor.test.ts` 871 lines, `engine/__tests__/rehydrate.test.ts` 835,
  `modules/media-stream/__tests__/routes.test.ts` 747, `sealing/__tests__/way-out.test.ts` 736.

Duplicate helpers (brief rule 3), `scratchpad/c14u/dedupe.mjs`: a helper of a merged file that is
word for word a top-level helper of the home was removed; one that is word for word in two merged
blocks is declared once at the top level. Only pure helpers (a function, a type, a constant whose
value is a function or a literal), and only when the helper names nothing that stays local to its
block. Removed or hoisted: `supervisor.test.ts` (`SESSION`, `refusalOf`), `rehydrate.test.ts`
(`serverClockOn` three times; `STOP_MS`, `newRows` hoisted), `sealed-facts.test.ts` (`anchorsOf`),
`core-verification.test.ts` (`verify`), `development-key.test.ts` (`EVIDENCE_ID`, `verify`),
`media-stream/routes.test.ts` (`HEADER`, `FRAGMENT`), `progress.test.ts` (`Step`),
`session-key.test.ts` (`plain`, `position`), `stream-profile.test.ts` (`u16`, `u32`, `zeros`,
`box`, `TIMESCALE`). Kept on purpose, they are NOT the same thing although the text is the same:
`recording` in `supervisor.test.ts` (it calls a `setup` that differs), `sourceOf` in
`stream-profile.test.ts`, `start` in `jobs.test.ts`. Left as a known duplicate: `rowsOf` three
times in `rehydrate.test.ts` (the file's top level has another `rowsOf`; hoisting needs a rename,
which would change test bodies). Containers that a hook empties (`apps`, `folders`) were not
shared: two hooks on one array is a behaviour change.

Comments that named a removed file were updated in my files (`fault-lifecycle.test.ts`,
`fake-mic.test.ts`, `stream-profile.test.ts`, `sealing-host.test.ts`, `way-out.test.ts`).

## 3. SV-U1: list pins turned into one rule

Rule R1, `apps/core-server/test/static/scan.ts` (`scanCoverage`, `SCAN_COVERS`): what a guard
scanned EQUALS an independent walk of the folder it names, and the walk is not empty. The walk
shares no code with the scanner: one recursive `readdirSync` of the operating system, no list of
skipped folders, no list of text endings; a production file is a file that is no `*.test.*` and
lies in no `__tests__` and no `node_modules`. The answer names the files: `missing` (in the
folder, not scanned), `unexpected` (scanned, not a production file of the folder), `empty`.

The rule has its own tests, `test/static/scan-coverage.test.ts` (9, on a tree under the system
temporary directory): the whole folder is covered; a file that JOINS is covered at once; a scan
that lost a file is named with the file; a scan that reads a test or another folder is named; an
empty or absent folder is `empty`, never a pass; a folder the scanner skips by name is still
walked and reported; on the real tree the scanner's production TypeScript equals the walk of
`src/`.

Converted: 25 per-folder tests (list replaced by the rule) and 3 workspace-wide guards (rule
added; they had "contains these folders" checks, which stay).

Kind of every converted list: **scan reach**. It answers "which files did this guard read", so
that a rule "no file does X" cannot pass on an empty or narrowed scan. It is not a security
boundary because nothing is allowed or refused by membership in it: every rule of the file is
applied to whatever the scan returns, and a file that joins the folder is now held to all of them
without anybody editing a list (before, the new file was held to them too, and the list went red
only to be extended). What IS a boundary in these files, and stays an explicit list, is in the
right-hand column.

| file (`apps/core-server/`) | what the list was | now | explicit lists that stay (security / architecture) |
|---|---|---|---|
| `src/modules/alerts/__tests__/static.test.ts` | 2 file names | R1 on the folder | the imports of the folder; the one log call |
| `src/modules/system/__tests__/static.test.ts` | 4 | R1 | imports; log fields |
| `src/modules/storage/__tests__/static.test.ts` | 3 | R1 | imports |
| `src/modules/network-time/__tests__/static.test.ts` | 1 ("one file") | R1; the index is still read by name | imports |
| `src/modules/admin/__tests__/static.test.ts` | 4 | R1 | "every exported statement of the store is listed here" |
| `src/modules/demo/__tests__/static.test.ts` | 5 ("the five") | R1 | hosted actions it names |
| `src/modules/devices/__tests__/static.test.ts` | 4 ("the four") | R1; the feed file is still required by name | hosted actions |
| `src/modules/evidence/__tests__/static.test.ts` | 6 | R1 | - |
| `src/modules/security-audit/__tests__/static.test.ts` | 5 | R1 | - |
| `src/modules/sessions/__tests__/static.test.ts` | 8 ("the eight") | R1 | - |
| `src/modules/pairing/__tests__/static.test.ts` | 13 | R1 | statements of the store |
| `src/modules/identity/__tests__/static.test.ts` | 16, two folders | R1 on both folders, the two sub-folders of other rows excluded as before | statements of the store |
| `src/modules/identity/biometric/__tests__/static.test.ts` | 8 | R1 | statements of the store |
| `src/modules/stt-config/__tests__/static.test.ts` | 4 | R1; the defining migration is still required by name | **the closed list of log keys** (section 5) |
| `src/modules/capture-discovery/__tests__/static.test.ts` | 13 | R1 against the file's own walker; the connect flow is still required | - |
| `src/plugins/permission-guard/__tests__/static.test.ts` | 8, two folders | R1 on both | the access rules and the matrix are other tests, untouched |
| `src/core/__tests__/static.test.ts` | 15 | R1 | - |
| `src/realtime/__tests__/static.test.ts` | 9 | R1 | - |
| `src/engine/__tests__/static.test.ts` | 25 names, a count of 25 and 21 `toContain` | R1; "no test file among them" stays | - |
| `src/credential-store/__tests__/static.test.ts` | 6 | R1 | **who may import the key material** (other tests of the file, untouched) |
| `src/media-stream/__tests__/static.test.ts` | 9, unit and module | R1 on both | who may import the token / the store door |
| `src/db/reset/__tests__/static.test.ts` | 11 | R1; "more than 5 tests" stays | - |
| `src/db/store/__tests__/static.test.ts` | 2 files and 2 test-file names | R1; of the tests of the folder it requires this file itself | "no statement is written outside the store" |
| `src/capture/adapters/__tests__/static.test.ts` | 38 | R1; the class-C adapters are still required by name | who imports a class-C adapter (the loader) |
| `src/capture/__tests__/static.test.ts` | 4 lists (signer 6, fence 10, boot 4, the folder 9) | R1 on `src/capture/`; each of the four parts must be present | **the capture fence's statements; the process module and the file system are imported by the allow-list only; the one file that logs; the waived lines of `app.ts` / `config.ts`** - all untouched |
| `test/static/imports.test.ts` | folders contained | + R1 on `src/` (exact) | the import rules |
| `test/static/log-calls.test.ts` | folders contained | + R1 on `src/` (nothing missing) | **`ALLOWED`: what a log call may hold** (empty, explicit, untouched) |
| `test/static/search-path.test.ts` | folders contained | + R1 on `src/`, TypeScript and SQL (nothing missing) | **`ALLOWED`: the files that may name the search path** (untouched) |

Not converted, of the 42 unit tests the audit's title pattern matched:

- Kept, not an exact list: `test/static/credentials.test.ts` ("contains" checks over the whole
  workspace), `capture/__tests__/muxer-safety.test.ts` ("at least 7 sources").
- Kept, a boundary: `capture/adapters/local/__tests__/camera-helper.test.ts:599-617`. `OWN` is the
  list of the files of ONE row inside a folder two rows share (a scope, not a scan of the folder),
  and the two tests hold "ONE file of the folder starts a process or reads the file system": what
  may open a local device. Explicit, untouched. `mic-static.test.ts:108` is already a rule.
- 9 false matches of the pattern (behaviour tests whose title holds "reads the ... file"):
  `fragments.test.ts`, `transcript-model.test.ts` x3, `sealing-host.test.ts`, `last-resort.test.ts`,
  the speech-fixture case, `camera-helper.test.ts` "reads the list, then starts ONE helper", and
  `test/helpers/db/__tests__/credentials.test.ts` (not my file).

Mutation, run once (`scratchpad/c14u/mut/scan-mutation.log`): the scanner made to skip every
`index.ts` (one condition added in `walk` of `scan.ts`), and the own walker of the
capture-discovery test made to skip `limits.ts`. Result: **29 of 29 files red, 119 tests failed**;
every converted test is among them and names the missing files (`alerts` and `system` fail when
the file loads, since their set-up reads `index.ts`). Both files restored from the copies made
before the mutation: `cmp` identical. "A new production file is green" is proven by the rule's own
test "a file that JOINS the folder is covered at once" rather than by adding a file to `src/`
(no product change, and other owners' static scans read the same tree).

## 4. SV-U4: the identical per-folder rules from ONE table

New: `apps/core-server/test/static/module-rules.ts`. `MODULE_RULES` defines a rule once, as the
patterns that must occur in no file of the folder (10 rules: no system time and no timer; no clock
at all; both; nothing of the host; host, console and random; console, random and log; no access
check; no storage of its own; no slot replaced; no error member). `itHoldsNone(rule, rules, code)`
states it for one folder as ONE case; its type refuses a rule table that lacks a pattern the rule
names. The patterns and their planted texts stay where they were
(`modules/system/__tests__/static-rules.ts`, `modules/storage/__tests__/static-rules.ts`).

23 cases of 4 files now come from the table: `alerts` 5, `system` 6, `storage` 7, `network-time`
5. Same assertions (`places(code, PATTERN)` equals `[]`
for each pattern of the rule), same number of tests, the titles of each folder kept (a folder
whose sentence differs passes it as the title). A failure now also says which pattern found it.

Mutation, run once (`scratchpad/c14u/mut4/run.log`): one forbidden text planted per folder in a
file handed to the test (not in `src/`): `alerts` a system-time read, `system` a console call,
`storage` a random source, `network-time` a `new Date()`. Result: the rule of each folder red and
no other rule of the table, each naming the pattern and the planted path (`SYSTEM_TIME: ...
src/modules/alerts/planted.ts:1`, `CONSOLE: ... system/planted.ts:1`, `RANDOM: ...
storage/planted.ts:1`, `SYSTEM_TIME: ... network-time/planted.ts:1`); 7 failed, 72 passed (the
other 3 are the "reads the sources" cases, which hold every file to a minimum length). The four
files restored, `cmp` identical.

NOT done, of SV-U4: the other identical bodies of audit section 3b in
`demo` / `devices`, `evidence` / `security-audit` / `identity`, `identity/biometric` / `pairing`,
`admin` / `devices` / `demo`, `pairing` / `realtime`, `sessions` / `permission-guard` (23
clusters, 47 cases, counted from the body hashes after this work). There the body is the same but the PATTERN is a constant each file declares
for itself. One table for them means first proving the constants equal file by file, then moving
them into a shared module: a change of the rules' definitions, not of their layout, in files 26
notes name. I did not start what I could not finish with a mutation per pair.
`sessions` / `permission-guard` is inside a protected glob and would stay as it is anyway.

## 5. SV-U5: allow-lists

- **The engine log-key allow-list is the db owner's**: `src/engine/__tests__/commands.db.test.ts:731-742`
  (`engineKeys`). Handed over, not touched. It is a security boundary (SR-48: no argument of a
  command in the engine log) and should stay an explicit list; what the brief asks is the message.
  Proposed, for the db owner (the assertion at `:742`):
  `expect(outside, 'a line of the engine holds a key outside the closed list. The rule: a count, a boolean or an id of a declared set, never text of a command. Add the key to engineKeys only if it is one of those').toEqual([])`
  with `outside` = the keys not in `engineKeys`, each with the `msg` of its line. The typed check
  the file already has for `restartFaultEnded` (`:744`, "a flag, never a text") is the model for a
  new key.
- `src/modules/stt-config/__tests__/static.test.ts` "its log calls carry only the keys of the
  closed list": the list stays explicit (it is what a log line may hold); the failure now names
  the file and the key and states the rule ("a code, a count, a boolean, the name of a changed
  field - never a value of the configuration and never a text of the request").
- Kept explicit and untouched, all security or architecture: `test/static/log-calls.test.ts`
  `ALLOWED`, `test/static/search-path.test.ts` `ALLOWED`, the exact key sets of single log lines
  (`origin-guard.test.ts:621`, `readiness.test.ts:116`, `pairing/routes.test.ts:322`,
  `alerts/acknowledge.test.ts:71`, `system/settings.test.ts:123`, `hub.state.test.ts:572`,
  `hub.lifetime.test.ts:305`), the importer allow-lists of `capture/__tests__/static.test.ts` and
  `credential-store/__tests__/static.test.ts`, the store-statement lists of `admin`, `identity`,
  `pairing`, `biometric`, the capture fence's statements.
- `db/fixtures/__tests__/audit-details.test.ts` (the red of run 10): kept as it is, as the audit
  rules (a parity of two producers, and that red was right).
- No pure change-detector among the name allow-lists of the unit files was found beyond the scan
  lists of section 3. The audit's classifier counts 81 LIST and 36 COUNT sites in the per-folder
  static files; I converted the family the audit names (the scan lists) and did not read the other
  sites one by one. That is open.

## 6. Real waits (audit section 5)

| file | finding | action |
|---|---|---|
| `src/transcription/__tests__/encrypted-credential.test.ts` "an engine a killed Core left running is reaped ..." (11.7 s of 11.9 s) | Not a wait the product needs. The stand-in "orphan" was a CHILD of the test process. The guard's reap is synchronous (`apps/transcriber/src/backends/cpu-local.ts:295-316`): it kills, then polls `processStart(pid)` up to `REAP_POLLS` = 200 times 50 ms. A killed child stays a zombie until the event loop collects it, which cannot happen while the reap holds the loop, so the guard polled its whole bound for a dead process. | FIXED in the test, no product change: the stand-in is now a real orphan (a shell starts it in the background, prints its PID and ends) that ignores SIGTERM. Assertions: before, `signalCode === 'SIGKILL'` and the record removed; now a CONTROL (SIGTERM does not end it), then gone after `openSession` (so it was killed by the signal that cannot be refused), and the record removed. File 11.9 s to 0.3 s. Mutation, once: the record made to name another process start, so the guard must leave the process alone: the case is red (`expected true to be false`, the process is alive); restored, `cmp` identical; no stand-in left behind (`pgrep -fl 'sleep 120'` empty). |
| `src/capture/adapters/local/__tests__/no-delivery.test.ts` (SV-U3; five cases of 8.8 to 9.5 s) | The five are `describe.concurrent`: the file's wall is ONE bound, 9.5 s, and it is set by the "control" and the "positive" cases, which the audit itself keeps on the real clock (PROTECTED, local devices). The module does take injected timers, and the bound is already held on manual timers in part 2 of the same file (`:150`, `:201`). | KEPT. Moving the three outcome cases to the manual timers saves 0 s of wall and removes the only proof that the real door stops a real process at the bound. |
| `src/capture/__tests__/ipc.test.ts` (9.0 s; sleeps of 500, 500, 1,500, 2,600, 700 ms) | The file is the supervisor on a REAL child process by design (`supervisor.test.ts:4-5`: "The same supervisor on a REAL child process is `ipc.test.ts`"); the manual-timer cases of the same rules are in `supervisor.test.ts`. Each sleep proves an absence ("longer than any back-off: nothing comes back", "more than four heartbeat timeouts") on a real process. | KEPT. No clock to inject into another process. This file was one of the two load reds of baseline run 1. |
| `mic-helper.generated.test.ts` (11.3 s), `ws-discovery.test.ts` (8.4 s), `fake-onvif-stub.test.ts` (5.3 s) | Real FFmpeg, real datagrams and a real loopback camera stub: what they prove is the real program. PROTECTED (local devices) for the first. | KEPT. |
| `pipeline.test.ts`, `finalize-transcript.test.ts`, `stt-states*.test.ts`, `round-trip.test.ts` | Read the slow cases: computation (a pipeline over generated recordings, two simulated hours of engine ticks), no sleep. | Nothing to move. |

No timeout was raised anywhere.

## 7. Not done from the audit's table 7.1, and why

| action | state |
|---|---|
| SV-U1 | done (section 3); 5 kept and 9 false matches listed there |
| SV-U2 | done (section 2), 41 of 41 files |
| SV-U3 | kept, with the reason (section 6): no wall to gain, and the protected cases set the time |
| SV-U4 | done for the 4 folders that share a rule table (23 cases); the other clusters not done (section 4) |
| SV-U5 | the list is in a db file: handed over with the proposed message (section 5); the unit-side allow-list got its message |
| SV-K | kept: everything of 7.0, the parity test, all positive controls |

## 8. For the other owners and the controller

For the core-server db owner:

1. `engine/__tests__/commands.db.test.ts:731-742`: SV-U5 (section 5).
2. Comments in db files that name a unit file that no longer exists:
   `db/reset/__tests__/wave-i-a1-unsealed-fake.db.test.ts:3` (`wave-i-a1-unsealed-fake.test.ts` is
   now in `package-removal.test.ts`); `engine/__tests__/wave-k-s1-restart-fault.db.test.ts:11`
   (`wave-k-s1-restart-fault.test.ts` is now in `rehydrate.test.ts`, describe "G75c-01: the end of
   the restart fault").
3. Free to rename: `db/store/__tests__/static.test.ts` no longer pins the name
   `write-through.db.test.ts`; the describe title in `capture/__tests__/fault-lifecycle.test.ts` no
   longer names `wave-h-f-boot-clear.db.test.ts`.
4. Seen, not mine: while I ran the capture static guards (17:20), `capture/__tests__/static.test.ts`
   "no file reads the system time" was red on `src/capture/adapters/camera/ws-discovery.ts:254`,
   a busy-wait added to the product file in the working tree (`git diff` showed the one line). It
   was gone a few minutes later and the after run is green. I read it as another owner's mutation
   proof; I did not touch the file. If it was not that, it needs a look.

Needs a product change (comments only; I change no product file):

- `apps/core-server/src/capture/supervisor.ts:64` and `src/capture/boot/checks.ts:265` name
  `wave-h-f.test.ts` in a comment. Those cases are now in
  `src/capture/__tests__/fault-lifecycle.test.ts`, describe "gates 64 / 75 / 89 (D194, D199, D200) ...".

Open:

- The LIST and COUNT sites of the per-folder static files outside the scan-list family were not
  read one by one (section 5, last point).
- SV-U4 for the folders whose patterns are file-local constants (section 4).
- `rowsOf` is declared three times in `engine/__tests__/rehydrate.test.ts` (section 2).
- `ipc.test.ts` and the `pipeline.test.ts` case "every hook point once" fail on a starved host
  (load about 100); they pass at a load below 8. Not changed.
- The implementation notes and gate reports under `docs/` still name the 41 removed files: history,
  left as written.

## 9. Evidence

Scratchpad `c14u/` (not in git): `before.log` / `before.json` (run 1, under foreign load),
`before2.log` / `before2.json` (the baseline), `after.log` / `after.json`, `homes1.log`,
`homes2.log`, `snap-before.json`, `snap-after.json`, `plan.tsv` (the 41 pairs and the wrapper
titles), `merge.mjs`, `dedupe.mjs`, `checkmerge.mjs`, `diff.mjs`, `mut/scan-mutation.log`,
`mut4/run.log`, and the copies every mutation was restored from. `wave/` holds a copy of each of
the 41 removed files and of each home as it was at `a5d75ed`.

---
*Generated: 2026-10-11 17:35 WIB*
