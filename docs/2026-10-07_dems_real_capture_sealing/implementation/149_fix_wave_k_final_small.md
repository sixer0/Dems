---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: fix wave K, closing small fixes (RED 1, RED 2 of test/10_precommit_wave_k.md; PE-WK-46; two stale comments; README sentence)
date: 2026-10-11
agent: coder-execution
tree: 57b80a9 + the working-tree edits of wave K (no commit, no git write)
status: needs-review
---

# 149 - Fix wave K, final small fixes

Status **needs-review**: all five items are done and their targeted checks are green, but one test file
of the mobile evidence folder (`wave-k-m2-operator-export.test.tsx`, not touched here) is flaky (section 4).
No git write, no formatter run, no lane or emulator, no `.data/pg*.env` read, no db test run.

## 1. Per item

### Item 1 - RED 1, `audit-details.test.ts:237` (fixture brought into line)

| What | Where |
|---|---|
| Lines changed | `apps/core-server/src/db/fixtures/recordings.ts:497` (1 line): the details of the `EVIDENCE_VERIFIED` / `EVIDENCE_VERIFY_FAILED` audit row of the `verify` builder gain `operationId: 'verifyEvidence'`, after `eventKind`, as the simulator writes them |
| Why | the shared simulator writes `operationId` on its verify rows (`packages/shared/src/sim/evidence-actions.ts:121`, G89b-04); the Core's own verification writes the same value (`apps/core-server/src/sealing-host/index.ts:737`; contract example `packages/shared/src/api/evidence.ts:648`). The value is `'verifyEvidence'`, read from those three places; the test's rule is unchanged |
| Pinned digests / hashes checked | the audit chain of the fixture is computed at build time by the shared `appendAudit` (`fixtures/build.ts:9-13`, `:143`, `:219`), the fixture `digest` is computed (`build.ts:100`) and tests compare a build to a second build (`build.test.ts:374-396`), `expectedHead` to the loaded head. No literal chain hash or fixture digest is pinned anywhere in `apps/core-server` (searched for 64-hex literals near `fixture|digest|head`: only the SHA-256 of the empty string in `bulk-fixture.db.test.ts:334`, a `chain_hash` check unrelated to audit rows; the demo-package digests are not built from this file). No count moves: the change adds a member, not a row. So the STOP condition did not apply |
| Output | `npx vitest run --root apps/core-server --project unit src/db/fixtures/__tests__/audit-details.test.ts`: `Test Files 1 passed (1)`, `Tests 35 passed (35)`. Whole fixtures folder (unit project, 5 files): `Tests 156 passed (156)`. The db project tests of the fixture (`bulk-fixture.db.test.ts`) were NOT run (db tests only through the project's script; not asked) |

### Item 2 - RED 2, `navigation-units.test.ts:199` (product follows the test's rule)

| What | Where |
|---|---|
| Lines changed | `apps/mobile/src/i18n/features.ts`: the import of `sealedPlayerEn` and the key `'evidence-player'` removed (back to the 20-line tree set of the test's rule). `apps/mobile/src/features/evidence/i18n.ts`: `import { sealedPlayerEn } from './sealed-player-i18n'` and the entry `player: sealedPlayerEn` between `play` and `export`. `apps/mobile/src/features/evidence/sealed-player.tsx:575`: lookup `features.evidence-player.noSeek` -> `features.evidence.player.noSeek`. `apps/mobile/src/features/evidence/sealed-player-i18n.ts`: header comment names the new mount (the file stays: it was not asked to be deleted, and `live-evidence-static.test.ts` lists it as a production file) |
| Why | the test's rule is one i18n tree per feature folder with a screen plus three named extras (`capture-selector`, `navigation`, `transcription`); the player lives in `features/evidence/`, so its sentence belongs under the `evidence` tree. The sentence text is unchanged |
| Consequence in a second test | `live-evidence-static.test.ts` ("the copy of Simulated mode is the copy of `acaff20`", 185 texts, a digest) counts every leaf of `evidenceEn`; the new leaf made it 186. That file already has a documented list of the wave-K sentences added after `acaff20` (`LIVE_KEYS`, lines 51-84). Added `'player.noSeek'` there (2 lines, with a comment), which keeps the Simulated-mode digest as pinned. This is the test's own structure, not an exception to the navigation rule |
| Output | `navigation-units.test.ts` + `live-evidence-static.test.ts`: `Test Suites: 2 passed, 2 total`, `Tests: 52 passed, 52 total` |

### Item 3 - PE-WK-46, mobile reads `plainChecked` by name

| What | Where |
|---|---|
| Lines changed | `apps/mobile/src/features/evidence/verify-v2.ts`: `V2FileRow` gains `readonly plainChecked?: false` (as the web's, `apps/core-web/src/features/evidence/verify-v2.ts:68`); `readFile` copies it only when the value is exactly `false` (`...(value.plainChecked === false ? { plainChecked: false as const } : {})`, as the web `:198`); `v2FilePartOutcome` takes `plainChecked` in its `Pick` and returns `'SKIPPED'` for the part `plain` when `file.plainChecked === false` and the plaintext did not pass (after the `ok` PASS return, before the check-list rule); doc comment extended. Stored and chain parts and the check-list rule are unchanged |
| Why | PE-WK-46 / `148` open item 4: the web reads the member, the tablet and phone did not. `SKIPPED` is the outcome that the report draws as `evidence.verifyV2.outcome.SKIPPED` = "Not run" (`packages/shared/src/i18n/en/evidence.ts:281`), the wording mobile already has; `verify-v2-report.tsx:190` needed no change |
| Test | NEW `apps/mobile/src/features/evidence/wave-k-final-plain-checked.test.ts` (6 tests), importing `VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE` from `@dems/shared/api`: the example holds one row without the member and one with `false`; the reader keeps it by name; the `false` row reads SKIPPED for `plain` with no check list, an empty one and a V-05 `FAIL` list (stored and chain stay FAIL; the word is "Not run"); CONTROLS: a failed row without the member is FAIL (SKIPPED only with a skipped V-05, today's rule); the checked row is PASS and a passing plaintext is PASS whatever the member; `true`, `'false'` and `null` are not read as "not run" |
| Output | `wave-k-final-plain-checked.test.ts` passed in the mobile run below (`PASS src/features/evidence/wave-k-final-plain-checked.test.ts`) |

### Item 4 - stale comments on the renewal rule (comments only)

| File | Change |
|---|---|
| `apps/mobile/src/features/evidence/media-session.ts` (table row of the header, line 20) | "the player renews before it starts or seeks on a stale session, and once after a player error" -> renews ON DEMAND only (before a Play or a seek on a session at its end, 5 s margin), after a player error ONLY on such a session, never a session that has not ended (Z1, G94b-10), and after a renewal resumes at the playhead |
| `apps/mobile/src/features/evidence/sealed-player.tsx` (`StopCause` comment, 92-94) | `PLAYER`: "failed twice at one place on a session that had NOT ended" -> failed on a session that had NOT ended (never renewed by itself, Z1, G94b-10), or failed again at the place of a renewal |

Rule as built, from note 145 section 3.4 / item 1 of its list and `sealed-player.tsx:352-365` (`onPlayerError`): no automatic renewal of a
session that has not ended; after a renewal the player resumes at the playhead. No code line changed in these two files (the typecheck and lint below cover them).

### Item 5 - README

`README.md` (block "Fix wave K: additions and corrections", the bullet at line 646): "The tablet's player cannot seek yet (`PE-WK-24`) ..." replaced by one bullet that says the player seeks on the indexed view (`PE-WK-35`, `PE-WK-37`; supersedes `PE-WK-24` for a session whose answer states an index), asked with the optional `seekIndex` of operation 88, a stream that reports no duration keeps the disabled scrubber and its sentence, proven on the tablet (note 145), phone layout not yet driven, and keeps "Not yet gate-verified". Nothing else in the README was edited by this pass.

## 2. Checks (run once, apart from the repeats named in section 4)

| Check | Command | Result |
|---|---|---|
| core-server unit, red file | `npx vitest run --root apps/core-server --project unit src/db/fixtures/__tests__/audit-details.test.ts` | 1 file, 35 tests passed |
| core-server unit, fixtures folder | the same with `src/db/fixtures` | 5 files, 156 tests passed |
| mobile (red file, evidence folder, i18n, new test) | `npx -w apps/mobile jest src/navigation/__tests__/navigation-units.test.ts src/features/evidence src/i18n --maxWorkers=2` | see section 4 |
| typecheck | `npm run typecheck -w @dems/core-server`, `-w @dems/mobile` | exit 0 and 0 `error TS` in each |
| lint | `npm run lint -w @dems/core-server`, `-w @dems/mobile` | exit 0; core-server (oxlint) silent; mobile 0 errors and the one known warning (`src/runtime/log.test.ts:160:19 array-type`) |

## 3. Files changed

`apps/core-server/src/db/fixtures/recordings.ts`; `apps/mobile/src/i18n/features.ts`; `apps/mobile/src/features/evidence/{i18n.ts, sealed-player-i18n.ts, sealed-player.tsx, media-session.ts, verify-v2.ts, live-evidence-static.test.ts}`; NEW `apps/mobile/src/features/evidence/wave-k-final-plain-checked.test.ts`; `README.md`; this note. (Several of these files already carried other wave K edits; only the lines named above are this pass's.)

## 4. Mobile run and a flake

| Run | Result |
|---|---|
| First run of the set above (before `LIVE_KEYS` was extended) | 34 suites: 33 passed, 1 failed (`live-evidence-static.test.ts`, the 186-vs-185 count of item 2); 363 tests: 362 passed, 1 failed. `navigation-units.test.ts` and the new test: PASS |
| `live-evidence-static.test.ts` + `navigation-units.test.ts` after the `LIVE_KEYS` line | 2 suites, 52 tests, all passed |
| Second run of the whole set | 34 suites: 33 passed, 1 failed (`wave-k-m2-operator-export.test.tsx`: "the job reaches COMPLETE ... evidence-export-job-COMPLETE" not found, the sheet still reads job WAITING); 363 tests: 362 passed, 1 failed |
| That file alone, four more times, unchanged code | failed (2 tests), passed (16), failed (1 test), passed (16): intermittent |

The file is untracked, written by driver M2, and passed in the first run above and in the whole run of `test/10_precommit_wave_k.md`. Nothing in this pass touches export, the job poll or the stepper; the only code this pass changed that the file reaches is `verify-v2.ts` (its verify step reads the recorded PASS body, which has no `plainChecked`, so the reader's output is unchanged), and the i18n tree move. I did NOT prove it flaky on the tree without my edits (no stash, no git write), so this is a reading, not a proof. It is the wait between `submit` and the job poll in `exportThrough` (a `b.elapse(EXPORT_BUILD_MS + 600)` on the fake clock). Owner: M2 (143); needs a look before the next whole run.

---
*Generated: 2026-10-11*
