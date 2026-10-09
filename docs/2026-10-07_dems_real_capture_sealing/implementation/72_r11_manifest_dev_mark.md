---
task_id: 2026-10-07_dems_real_capture_sealing
row: 141
date: 2026-10-09
agent: coder-execution
status: complete (server side); client flows listed for the gate
---

# Row 141 — development-source mark: V-15, the `sources` block, op 41 report members, reset-guard disk side

Tier 3. Paths relative to the repo root.

## 1. What was built

| # | What | Where |
|--:|---|---|
| 1 | **V-15** (15th check, `Source class`): reads the RAW manifest object. (a) MISSING: a track / interval without a class or with a class outside the three values, no track record at all, a missing or non-boolean flag. (b) CORRUPT: flag != "some class is not PRODUCTION"; one mic with two classes. A development class is never a finding. SKIPPED (never PASS) when there is no v2 object, or when the mark looks right in a manifest V-01 refused | `packages/shared/src/evidence-verify/verify.ts` `checkSourceMark`; codes in `types.ts` `VERIFY_FAILURES` (6 new) |
| 2 | **`sources` block** of the result: `{ ok, code, development, report, lines, tracks[], audioIntervals[] }`; `development` recomputed from the classes; stated only from a manifest that passed V-01, V-03, V-09, V-13, V-15 — otherwise `code: NOT_TRUSTWORTHY` (or `UNKNOWN`), `development: null`, empty lists | `verify.ts` `sourcesReport`; `types.ts` `VerifiedSourcesState`, `SOURCES_STATE_REPORT`, `SourcesReport` |
| 3 | **Report lines**, the source line FIRST: `verifyReportLines(result)` — development line + one entry per source, or "Sources: declared as production devices by the Core that sealed this package.", or "Sources: not trustworthy — the manifest was altered"; then `Integrity: PASS` / `FAIL (class)`, the 15 checks, the transcript state | new `packages/shared/src/evidence-verify/report.ts` |
| 4 | `scope: 'MANIFEST'` option: only V-01, V-03, V-09, V-13, V-15 run; the rest `OUT_OF_SCOPE`; never `ok` | `verify.ts`, `types.ts` |
| 5 | **M7-DEVSRC-BUILD-1** compile-time agreement of the Core's kinds and the package mapping (type-only import of the adapter layer; a kind on one side only does not type-check) + `disagreeingKinds` | new `apps/core-server/src/evidence-verify/source-class-agreement.ts` |
| 6 | **Op 41 response schema**: optional `overall`, `interrupted`, `checks[]` (id, name, status, failureClass, skipped, findings[<=64], `findingCount?`), `fragments[<=256]`, `failedFragmentCount`, `transcriptState`, `sources`; one new 200 example `passedDevelopmentSources`. No new named schema (inline): schema-count pins did not move. Totals unchanged 97 / 36 / 61 / 67 | `packages/shared/src/api/evidence.ts`; `openapi.json` regenerated under `npm.lock` (generator answered "unchanged": C1's run at 18:38 had already read this registry) |
| 7 | `contractBodyOf` fills the members; **omits `transcriptOk` for UNAVAILABLE as for DISABLED**; `manifestOk` includes V-15; lists cut at the contract's bounds with their true length beside | `apps/core-server/src/evidence-verify/index.ts` |
| 8 | **Reset guard, disk side (D98(1))**: a folder that would block is cleared only when exactly one EXEMPT row names its session and `readSealedSourceMark` answers signed + development, anchored on the row's `id` and `manifest_hash` (two columns added to the guard's SELECT). The manifest is read by the verify unit; the reset folder still opens no file | `apps/core-server/src/db/reset/real-evidence.ts` (`clearedDevelopmentPackages`, `evaluateRealEvidence` option `clearedOnDisk`, fact `developmentPackagesOnDisk`, one sentence in `developmentPackagesMessage`); `apps/core-server/src/evidence-verify/index.ts` `readSealedSourceMark` |

Real: every package in the tests is bytes on disk, SHA-256, chain, AES-256-GCM, Ed25519 of a throw-away key (row 85's builder, extended with `sessionId`, `evidenceId`, `sourceRows`, `folderName`). Stand-in: no package sealed by the product exists yet (rows 59 / 82); the development rows come from row 136's `buildSessionCaptureSources`, the all-PRODUCTION rows are written by hand (no builder makes them in this phase).

## 2. Which response members the clients draw from (rows 87 / 137 / 138)

| Surface | Member | Rule |
|---|---|---|
| Verify line, first, never collapsed | op 41 `sources.code` (`DEVELOPMENT` / `DECLARED_PRODUCTION` / `NOT_TRUSTWORTHY` / `UNKNOWN`); English line in `sources.report` | word by `code`; `sources` absent = v1 answer = "not recorded (v1 package)" |
| Per-source entries | op 41 `sources.tracks[] { trackId, deviceId, sourceClass }`, `sources.audioIntervals[] { seq, micDeviceId, sourceClass }` (classes PRODUCTION / LOCAL_DEVICE / FAKE) | empty when nothing is stated |
| "development" boolean | op 41 `sources.development` — `true` / `false` / **`null`** | null is never production |
| Failing check and fragment | op 41 `checks[]` (V-15 = `Source class`), `fragments[]`, `failedFragmentCount`, `overall` | |
| Transcript label | op 41 `transcriptState.code` | row 119's seven codes |
| Badge on the item (ops 39 / 40) | `EvidenceItem.developmentSources` — **NOT built here** (C1's member, request filed) | |

## 3. Commands and results (one run each counts, D122; two were made before the rule changed)

| Check | Command | Result |
|---|---|---|
| M7-DEVSRC-SEAL-1, M7-DEVSRC-TAMPER-1, M7-SEC-SRC-2 (verify side), op 41 body | `npx vitest run --root apps/core-server src/evidence-verify` | 5 files, 97 tests pass (22 in `dev-source-mark.test.ts`) |
| M7-DEVSRC-BUILD-1 | same run, `source-class-agreement.test.ts` + `npm run -w @dems/core-server typecheck` | pass; three `@ts-expect-error` controls compile |
| V-15 rule table; value-set parity; M7-SEC-SRC-2 at the contract (no request body / parameter of 97 operations names a source class; positive control on the op 41 answer) | `npx vitest run --root packages/shared` with the 12 evidence / api files | 365 tests pass |
| Reset disk cases + M4-SEC-RESET-1 | `/usr/bin/lockf -k .locks/db-migrate.lock npm run -w @dems/core-server test:db -- src/db/reset/__tests__/m4-sec-reset.db.test.ts` | 16 pass, pin `(5, 'dbc-6')` |
| Reset folder, db project | same with `src/db/reset` | 7 files, 99 pass |
| Sealing, reset unit, static guards, modules/evidence (unit) | `npx vitest run --root apps/core-server --project unit src/evidence-verify src/sealing src/db/reset test/db/set4-rules.test.ts test/static src/credential-store/__tests__/static.test.ts src/capture/__tests__/static.test.ts src/modules/evidence` | 761 pass, 2 fail, neither from this row: `set4-rules` names `src/modules/capture-discovery/adoption.ts:28`; `modules/evidence` MODG route list (baseline) |
| Typecheck / lint | `npm run -w @dems/core-server typecheck`, `lint`; `npm run -w @dems/shared typecheck`, `lint` | core-server 0 / 0; shared lint 0; shared typecheck 1 error in `test/integration-c1.test.ts:144` (C1's file) |

Mutation proof (script in the session scratchpad; each file restored byte-exactly, SHA-256 compared): 15 mutations — 13 red, 2 not:
`V15-9` (dropping "V-15 passed" from the trust condition) survives — equivalent while the strict schema makes V-01 fail whenever V-15 does; `RST-3` (signature not required in `readSealedSourceMark`) is red in the unit test and green in the db test, because `development` is taken from the trusted `sources` block, which itself needs V-09.

## 4. Not proven / limits

- No product-sealed package was verified; fields 127-128 against a `FIRST_VIDEO_SAMPLE` record and the `evidence_items.development_sources` INSERT (rest of M7-DEVSRC-BUILD-1) are rows 82 / 83 / 71.
- M7-SEC-SRC-2's query over the lanes and `dems_demo` (0 v2 rows with the flag false or NULL) is a gate check: no v2 item exists.
- §H.5 holds and is shown by a test: a whole re-signed all-PRODUCTION forgery verifies against its own folder as DECLARED production; only the Core's anchors refuse it.
- The simulator answers no v2 verdict (its dataset is v1); the "v2 answer" is the contract example.
- `readSealedSourceMark` in the reset has no trusted-certificate list; its anchor is the row's `manifest_hash`.

## 5. To wire

- Row 82: call `createRealEvidenceVerification` (unchanged seam); decide the package folder name (three layouts disagree — request filed); remove or keep cleared folders at a reset.
- C1: `EvidenceItem.developmentSources` (ops 39 / 40).
- Row 87: V-15 in `V2_KNOWN_CHECK_IDS`; its two "pending" tests are red by design now.
- SH-24 regeneration: the simulator's verdict gains `files[]` and `sources` (all FAKE).

## 6. Device / browser flows for the gate (not run)

`M7-DEVSRC-EVID-W` (web), `-T` (tablet), `-P` (phone), one scripted flow each: open a sealed development item -> badge on the item -> Verify -> first line is the development line with a PASS verdict; an edited mark reads "not trustworthy"; a v1 item reads "not recorded"; Simulated client mode draws no badge while the verify result still reports the mark.

## 7. Decisions taken

| ID | Decision |
|---|---|
| D-141-1 | `sources.development` is `boolean \| null` (C3 says boolean) and `sources` carries `code` + `report`: an altered manifest must not answer `false`, which reads as production |
| D-141-2 | (a)-violations all carry class MISSING (spec §D), with two codes each (absent / invalid) so a client can name which |
| D-141-3 | V-15 is SKIPPED, not PASS, on a manifest V-01 refused for another reason; this also kept row 119's sealing tests unchanged |
| D-141-4 | No track record at all fails V-15: "no source" is never "all production" |
| D-141-5 | The answer of op 41 also carries `overall`, `interrupted`, `failedFragmentCount`, `findingCount` (row 87's reader already reads the first two); lists are bounded 64 / 256 |
| D-141-6 | Disk exemption needs the row's `manifest_hash` as anchor and exactly one exempt row per session; log details unchanged, one sentence added to the message |
| D-141-7 | Two one-line exemptions in `packages/shared/test/api-examples.test.ts` (shared guard): `transcriptState.code` / `sources.code` are state codes, not pairing codes |
| D-141-8 | One typing fix in `packages/shared/test/evidence-package.test.ts:452` (read-only member assigned; red in typecheck before this row) |
