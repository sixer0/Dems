---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 119 (R-8 / CF-12, milestone M7, class B; blueprint rev 2.4) + ruled addition D110 (from D-116-3)
date: 2026-10-09
agent: coder-execution (single driver, no pair reviewer — D88; rules D94, ownership D95)
source_plan: identification/02_structured.md row 119 (:451); masterplan/06_evidence_package_spec.md (ev) §B.7, §B.7a, §D, §D.1 (style); masterplan/10_test_strategy.md `M7-STTCFG-VERIFY`
narrative_tier: 3
status: complete (software); nothing calls the seal step until row 82; the op 41 answer does not carry the new report member yet (request filed)
---

# Row 119 — manifest + verify v2 for the transcript states, and the last-resort seal (D110)

No throughput, speed or duration figure of any engine is in this document, the code or the tests (D230).

## 1. What was built

| Piece | File:line | What it does |
|---|---|---|
| Reason vocabulary of field 121 | `packages/shared/src/evidence-package/manifest.ts:44` (`TRANSCRIPT_UNAVAILABLE_REASON`), `:46` (`TRANSCRIPT_ABSENCE_REASONS`), `:188` | `disabledReason` is an enum of two: `DISABLED_BY_CONFIGURATION`, `TRANSCRIPT_UNAVAILABLE_AT_SEAL` |
| Transcript rules | `manifest.ts:335` (`transcriptRules`) | Four shapes and nothing between (table below) |
| Snapshot model form | `manifest.ts:53` (`MANIFEST_STT_MODEL_PATTERN`), field 123 | `configSnapshot.model` is a model identifier (the op 91 pattern, held equal by a test) |
| "Does the package declare a document" | `manifest.ts:385` (`manifestDeclaresTranscript`) | One rule for the seal, the layout and verify |
| Verify: declared absence | `packages/shared/src/evidence-verify/verify.ts:540` (V-10), `:564` (V-11), `:807` (V-14), `:820` | "No document declared" (disabled OR unavailable) is not a failure; a transcript file in such a package is `UNEXPECTED_FILE` |
| Verify: state report | `evidence-verify/types.ts:206` (`VerifiedTranscriptState`), `:218` (`TRANSCRIPT_STATE_REPORT`), `:228`, `:261` (`PackageVerifyResult.transcriptState`); `verify.ts:674`, `:825` | Seven codes with a fixed line each; the state is repeated only from a manifest that passed V-01, V-03, V-09, V-13 |
| Seal: last resort | `apps/core-server/src/sealing/finalize-transcript/handler.ts:110` (what counts), `:244` (`unavailableCheckpoint`), `:392-409` (count), `:553` (decision); `bounds.ts:54-58`, `:79`; `contract.ts:153`, `:160`, `:234` | See §3 |

### The four shapes of the transcript block (schema, builder and verify V-01)

| State | Document (79-91, 94) | Field 121 | Field 93 `failedChunks` | `snapshot.enabled` | `backendUnreachable` |
|---|---|---|---|---|---|
| `ASSEMBLED` | sealed, all set | null | count | true | false |
| `PARTIAL` | sealed, all set | null | count | true | either |
| `PARTIAL` (D110) | none, all null | `TRANSCRIPT_UNAVAILABLE_AT_SEAL` | planned chunks, or null | true | either |
| `DISABLED` | none, all null | `DISABLED_BY_CONFIGURATION` | null | false | false |

Refused, each by test: READY/PARTIAL without any one document member; DISABLED or unavailable with any one; the unavailable reason with another state or beside a document; a no-document PARTIAL without it; either reason in the other's state; an unknown reason.

## 2. Rows 83 / 79 / 116 against ev §B.7a, field by field

| Field | Before | Result |
|---|---|---|
| 92 `state` incl. `DISABLED` | matched | unchanged |
| 121 `disabledReason` | const, one value | enum of two (D110) |
| 122 `backendUnreachable` | matched; "PARTIAL when unreachable" held | unchanged; allowed in the no-document PARTIAL |
| 123 `configSnapshot` | five strict members; `model` any non-empty text | **fixed:** `model` held to the model-identifier form — an endpoint, path, `store:pointer` reference or key no longer fits. The step's input snapshot is held to the same form (`handler.ts` `SnapshotSchema`) |
| Disabled shape | nulls in 79-91, 93-94; reason set | **fixed:** the reason must be the disabled one (was "not null") |
| Mixed shapes | a reason beside a document was refused; nulls checked per state | one function, four shapes |
| V-10/V-11/V-14 | keyed on `state === 'DISABLED'` | keyed on "no document declared" |

Not changed: the 128-field count (`MANIFEST_V2_FIELDS`), v1 packages, `declaredPackageFiles`.

## 3. D110 — the seal can always be reached

A call that fails AT the waiting limit of the step is counted in its `sealing_jobs` row (`boundFailures`, `lastBoundFailure`; kept across the RUNNING write of the next call). When the count has reached `limits.closeOutAttempts` (default 3, 1..100), or is 1 or more and the caller passes `sealWithoutTranscript: true`, the NEXT call asks the transcriber nothing and is DONE: `PARTIAL`, no document, reason `TRANSCRIPT_UNAVAILABLE_AT_SEAL`, `failedChunks` = chunks planned in the session's rows (null with no row or an unreadable store), `backendUnreachable` = `input.backendUnreachable === true`, no `transcripts` row, item columns `{2, null, null}`, `files: null`. Journal: FAILED -> RUNNING -> DONE with `checkpoint.unavailable { by, failures, lastFailure }`; one persistent `error` entry, code `TRANSCRIPT_UNAVAILABLE_AT_SEAL`, correlation id = session id. A resumed seal reads it back and asks the transcriber nothing.

## 4. Verification

```
$ npx vitest run --root packages/shared test/evidence-package.test.ts test/evidence-verify.test.ts test/evidence-transcript-states.test.ts   (run 1, run 2)
 Test Files  3 passed (3)   Tests  185 passed (185)     # 155 + 7 existing, 23 new
$ npx vitest run --root apps/core-server --project unit src/sealing src/evidence-verify                                   (run 1, run 2)
 Test Files  7 passed (7)   Tests  193 passed (193)     # sealing 50 existing + 15 last-resort + 57 verify; evidence-verify 71 untouched
$ /usr/bin/lockf -k .locks/db-migrate.lock npm run test:db -w @dems/core-server -- src/sealing   (run 1, run 2; outside the sandbox)
 Test Files  3 passed (3)   Tests  25 passed (25)       # 22 existing + 3 new; pin [5, 'dbc-6']; 0 databases left
$ python3 .cache/stt/checks/row119/mutation-red.py      -> 19 of 19 RED, every source restored byte-exactly (sha256 compared)
typecheck: core-server 0 errors in this row's files (2 foreign: capture/adapters/camera/__tests__/onvif-session.test.ts:331, modules/capture-discovery/connect/__tests__/limits.test.ts:183); shared 1 foreign, known since row 85: test/evidence-package.test.ts:453
lint (oxlint) on evidence-package, evidence-verify, src/sealing, the new shared test: 0 findings
static guards core-server: 137 passed, 1 red not this row's — imports.test.ts "every closed unit exists and has an index": src/modules/capture-discovery (row 132, in flight)
```

| Asked | Result |
|---|---|
| `M7-STTCFG-VERIFY`: DISABLED package | PASS, 14 of 14 checks; `transcriptState` = `DISABLED_BY_CONFIGURATION`, "Transcript disabled by configuration" |
| unreachable-PARTIAL package | PASS, 14 of 14 (the PARTIAL document is hashed); "Transcript partial — backend unreachable", `failedChunks` 3 |
| no-document PARTIAL package | PASS, 14 of 14; "Transcript unavailable at seal"; the result text holds no "disabled" |
| Tampered state FAILs, layer 1 | 12 schema-valid edits (state, reason, flag, count, each snapshot member), raw: exactly V-03 TAMPERED. 11 one-member edits that break a rule: V-01 names the member + V-03 |
| Layer 2 | The same 12, re-hashed with `signature.sig` rewritten: exactly V-09 from the package alone; V-03 + V-09 at the Core. Re-signed with another key: V-09. Other key AND its certificate: passes alone (the known limit, SEC35-06, asserted), fails V-03 + V-13 at the Core |
| Layer 3 (state vs files, with a VALID forged signature) | DISABLED on paper + document present: V-14. ASSEMBLED on paper + no document: V-10, V-11, V-14. File planted in the no-document package: V-14. Document removed: V-10, V-14. Item anchor disagrees: V-10 |
| Failed runs never repeat the state | `NOT_TRUSTWORTHY` / `UNKNOWN`, all five state members null |
| Mutation proof | Schema 6, verify 6, handler 7 mutants; each red |

How the packages are made: the real seal step answers the block (real transcriber pipeline, stand-in engines) -> row 83's builder -> a throw-away Ed25519 key through row 83's signer -> real bytes and hashes on disk -> `verifyPackageV2` through `corePorts`. Own support `src/sealing/__tests__/package-support.ts` (the minimum of row 85's builder; that file was not edited or imported).

**Existing tests changed:** one title text in `stt-states.db.test.ts:112` ("4 / dbc-5" -> "5 / dbc-6"; the pin itself was already moved by the database row). No assertion changed or removed.

## 5. Not proven / stand-ins

- The op 41 answer does not carry `transcriptState`, and `contractBodyOf` answers `transcriptOk: true` for the no-document PARTIAL package (nothing was checked). Both are in files of other rows: requests filed.
- `failedChunks` of the last-resort state is the number of chunk rows the Core holds. It is the plan only as far as the transcriber mirrored it; the seam has no question for the plan.
- `backendUnreachable` of that state is what the caller passes; the chunk rows hold no failure code.
- No real STT, no oMLX, no SIGKILL, no device or browser. Media bytes are random; the fragment cipher of the test support is a double.
- A package re-signed with a foreign key and certificate passes without the Core's anchors (row 85's known limit).

## 6. To wire

| When | What |
|---|---|
| Row 82 | Retry the step on a typed failure at the bound; pass `sealWithoutTranscript: true` when it decides to stop sooner than 3 failures; pass `backendUnreachable` from row 115's session state; `BUILD_MANIFEST` takes `transcript.manifest` as it is and copies `transcript/` only when `files !== null` |
| Rows 87 / 141 | Labels from `transcriptState.code`; i18n keys are theirs |
| Owner of `src/evidence-verify`, row 132 / later api change, spec errata | Three lines in `file_requests.md` (row 119) |

## 7. Device / browser checks left for the gate (D89)

One flow beside rows 116's A and B: STT enabled, transcriber stopped so that the close-out fails -> the seal completes after the bounded attempts; the item shows PARTIAL without a transcript; verify (op 41) passes and shows "Transcript unavailable at seal"; fragments contiguous. Needs rows 82, 87, 115.

## 8. Decisions taken (for the controller)

| ID | Decision | Confirm |
|---|---|---|
| D-119-1 | The new reason is a second value of field 121 `transcript.disabledReason`; no field 129, count stays 128. The member's name is historical | yes / new field |
| D-119-2 | Failures counted at the bound: `TRANSCRIPT_CLOSE_OUT_FAILED` AND the refusals of what a close-out handed over (hash mismatch, unreadable file, invalid document, record mismatch, other session, text not committed). Wider than D110's wording; without it a refused closed-out transcript holds the recording for ever. Store and input failures never count. One set, `handler.ts:110`, to narrow | yes / close-out only |
| D-119-3 | The caller's flag needs the bound reached and one counted failure; otherwise it changes nothing | yes |
| D-119-4 | `closeOutAttempts` default 3 (1..100), a proposal like D-116-1 | yes / other |
| D-119-5 | `failedChunks` = chunk rows of the session, null when none; `backendUnreachable` from the caller, false when not stated | yes |
| D-119-6 | Verify reports the state in a NEW result member `transcriptState`; `transcript.state` gained `UNAVAILABLE`. The state is told only from a manifest that passed V-01, V-03, V-09, V-13 | yes |
| D-119-7 | `configSnapshot.model` tightened to the model-identifier form | yes |
| D-119-8 | NOT added: "ASSEMBLED means `failedChunks` 0" in the schema — it turns a V-03-only expectation of row 85's test (`verify-v2.test.ts:247`) into V-01 + V-03 | add with that test, or leave |

No commit. No migration. No lockfile write. oMLX not started. `masterplan/*`, `status_tasks.md`, `delegation_progress_report.md`, `apps/core-server/src/evidence-verify/**`, `packages/shared/src/api/**` not edited.

---
*Generated: 2026-10-09 17:45 (+07:00)*
