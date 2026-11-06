---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 116 (R-8, milestone M6, class B; blueprint rev 2.4)
date: 2026-10-09
agent: coder-execution (single driver, no pair reviewer — D88; rules D94, ownership D95)
source_plan: identification/02_structured.md row 116 (:448); masterplan/06_evidence_package_spec.md (ev) §B.7a, §E.5; masterplan/07_transcript_spec.md (tx) §B.7; masterplan/10_test_strategy.md §A.6a (`M6-STTCFG-OFF` seal clause, `M6-STTCFG-UNREACH`); decision D-EV-1
narrative_tier: 3
status: complete (software, at the step boundary); one residual case is NOT proven DONE (§4); nothing calls the step until row 82
---

# Row 116 — seal-side transcript states: disabled, and enabled-but-unreachable

No throughput, speed or duration figure of any engine is in this document, the code or the tests (D230). The limits below are bounds, not measurements.

## 1. What was built (all in `apps/core-server/src/sealing/`)

| Piece | File:line | What it does |
|---|---|---|
| The bounds | `finalize-transcript/bounds.ts:45` (`FINALIZE_TRANSCRIPT_LIMITS`), `:55` (`limitsFault`), `:71` (`systemStepTimer`), `:86` (`CLOSE_OUT_CHUNK_CODE`), `:95` (`withinBound`) | Three limits, a timer port, and one bounded question |
| Contract additions | `finalize-transcript/contract.ts:123` (`closeOut` of the transcriber seam, with an abort signal), `:143` (`input.limits`), `:156` (`ports.timer`), `:210` (`waitLimitReached`), `:220` (`remainingWaitMs` of WAITING), `:249` (`TRANSCRIPT_CLOSE_OUT_FAILED`) | Additive; `ports.timer` is the one new REQUIRED member |
| Disabled path | `handler.ts:87` (reason = row 83's `TRANSCRIPT_DISABLED_REASON`, no second copy), `:192` (the block), `:382` (detection) | See §2 |
| Wait accounting | `handler.ts:148` (`WaitStateSchema`), `:395-399` | Waited time kept in the step's `sealing_jobs` row |
| One bounded question | `handler.ts:418` | No answer within `callLimitMs` = "not ready", logged `ASSEMBLE_NO_ANSWER` |
| The bound of the step | `handler.ts:439-453` | Close-out, then the same checks as every assembled transcript |
| Test support | `__tests__/support.ts:191` (`giveUp`), `:116` (`closeOut` of the reference seam), `:244` (`manualClock`) | Close-out on the transcriber's PUBLIC pipeline only |

### The bound (asked: "state the bound and where it is configured")

| Level | Bound | Where |
|---|---|---|
| Per chunk | 1 + `STT_CHUNK_RETRIES` (= 2) attempts, then FAILED | `apps/transcriber/src/pipeline/constants.ts:24` (exists; tx §0.2) |
| Per question to the transcriber seam | `callLimitMs` = 30 000 | `bounds.ts:45` |
| The whole step | `stepLimitMs` = 1 800 000, of which `closeOutLimitMs` = 120 000 is kept for closing out | `bounds.ts:45`; per call through `FinalizeTranscriptInput.limits` |

`config.ts` is frozen (P25) and gains no key. Counted: time inside the step's calls plus the time between calls, a gap counting at most `callLimitMs` — a Core that was down, or a clock that jumped, neither spends nor refills the budget. A failed call does not refill it either (the FAILED row keeps the wait state).

**At the bound** the step asks the seam to close the transcript out: every chunk not committed is given up by the transcriber's own rule (FAILED, no text, code `TIMEOUT`), then the real assembly runs. The answer is checked like any other (hashes, record = document, text guard). Result: DONE, `PARTIAL`, `failedChunks` from the document, `backendUnreachable` by the existing code rule (D-79-5: `UNREACHABLE` on any backend, `TIMEOUT` on `omlx-server` only), `waitLimitReached: true` in the step answer and the journal checkpoint.

## 2. Row 79 against the spec, field by field (disabled)

Row 79's block already matched ev §B.7a: fields 79-91 and 93-94 `null`, 92 `DISABLED`, 121 `DISABLED_BY_CONFIGURATION`, 122 `false`, 123 the five snapshot members; no `transcriptRow`, item columns `{2, null, null}`, `files: null`. Row 83's builder accepts it. Two differences fixed:

1. The reason was a second literal; it is now row 83's constant.
2. Nothing noticed a disabled session that had transcriber work. The step now reads the session's chunk rows once: rows present = persistent `error` entry `DISABLED_SESSION_HAS_CHUNK_ROWS` with the count. The seal stays `DISABLED` and holds no transcript; a failed read is a `warn` and does not stop it.

The label "transcript disabled by configuration" is not a manifest field (the manifest holds the code); verify and the clients show it (rows 119, 117/118).

## 3. Verification

```
$ npx vitest run --root apps/core-server --project unit src/sealing            (run 1, run 2)
 Test Files  2 passed (2)   Tests  50 passed (50)      # 20 new in stt-states.test.ts; 30 of row 79
$ /usr/bin/lockf -k .locks/db-migrate.lock npm run test:db -w @dems/core-server -- src/sealing   (run 1, run 2; outside the sandbox)
 Test Files  2 passed (2)   Tests  22 passed (22)      # 5 new in stt-states.db.test.ts; pin [4, 'dbc-5']; 0 databases left
$ python3 .cache/stt/checks/row116/mutation-red.py     -> 17 of 17 RED (mutation-red.json), sources restored
typecheck core-server: 0 errors in src/sealing (2 elsewhere: plugins/permission-guard/decision.ts, test/acceptance/rbac-matrix.support.ts)
lint (oxlint) core-server: 0 findings in src/sealing
```

| Asked | Result |
|---|---|
| `M6-STTCFG-OFF` seal clause, 2 runs | PASS. Through row 115's `openSessionTranscription` with a disabled write-once snapshot: state `DISABLED`, host / credential / capture not touched, no directory, no engine attempt, no chunk row, no checkpoint; the step is DONE at its first call with one journal write, no timer armed, the block field by field, accepted by row 83's builder. DB: item v2, no hash, no `transcripts` row |
| `M6-STTCFG-UNREACH`, 2 runs | PASS on both backends. Refusing backend: 9 attempts for 3 chunks, step DONE at the first call, `PARTIAL`, `failedChunks` 3 (document and rows), `backendUnreachable` true, zero segments, empty SRT. Backend lost mid-session: only the committed chunk's text. Control: an answering backend gives `ASSEMBLED` |
| DONE within the bound whatever the transcriber does | PASS for: engine hangs on a chunk; transcriber never finishes (default limits); seam never answers; transcriber could not be built (every question fails); backend answers after the bound (same sealed hash, no late word, resumed step reads the same transcript). DB: the wait is in `sealing_jobs` |
| Capture not touched | No production file of `src/sealing` imports capture, a process or a socket; the step has no capture port. Fragment contiguity itself is not measured here |
| Negative controls | bound removed (3 variants) red / "WAITED FOR EVER"; fabricated text at the bound refused `TRANSCRIPT_TEXT_NOT_COMMITTED`; disabled session with work detected (unit + real table) |

**Existing tests changed (row 79's, same folder):** six expectations `checkpoint: null` -> `checkpoint: { committed: false }` (a row that is not committed now holds the wait state; the meaning "nothing committed" is unchanged), one WAITING `toEqual` gained `remainingWaitMs`, the rigs gained `timer`, four stand-in seams gained `closeOut`. No assertion removed.

**Red in the tree, not this row's:** static guards name `src/capture/adapters/local/__tests__/mic-helper.generated.test.ts:176` and `src/capture/adapters/camera/onvif-session.ts:51`.

## 4. Not proven / stand-ins

- **A close-out that itself does not answer, fails or says "not ready" is NOT DONE.** The call ends at the bound with `TRANSCRIPT_CLOSE_OUT_FAILED` (step FAILED, budget kept, the next call closes out again). A `PARTIAL` manifest needs a document (row 83's not-null rules), and the Core does not write one. Decision D-116-3.
- **The production close-out does not exist.** `closeOut` is implemented only in the test support. Until rows 115/82 wire it, a real seal whose transcriber never finishes ends FAILED at the bound, not PARTIAL.
- **A late engine answer rewrites the checkpoint file** (the session's runner saves its in-memory state over the closed-out one). Sealed files and journal are unchanged and the resumed seal passes; a later re-assembly would be refused by hash. Needs an abort in the transcriber (request filed).
- No real STT, no oMLX, no SIGKILL, nothing verified inside a package. "SEALED" is shown only as "the step is DONE"; the session machine is row 82's.

## 5. To wire

| When | What |
|---|---|
| Row 82 | Pass `timer: systemStepTimer`; call the step again no later than `remainingWaitMs` and no slower than `callLimitMs`; treat `TRANSCRIPT_CLOSE_OUT_FAILED` as retriable; state `limits` if the defaults are not confirmed |
| Rows 115 / 82 | The production seam incl. `closeOut` (reference: `support.ts:191`): stop the session's runner, one more runner with a refusing adapter on the same snapshot identity, then `assembleTranscript`. `sttSnapshot` = `manifestSnapshot(sessionId)` of row 115. Note: row 115's snapshot store is still in memory — after a Core restart the seal has no snapshot to hand in |
| Later small row (transcriber) | Abort of an in-flight `runner.step` / `adapter.transcribe` |
| Row 119 | Verify clause `M7-STTCFG-VERIFY` |

Requests filed in `delegation_progress/file_requests.md` (2 lines, row 116).

## 6. Device / browser checks left for the gate (D89)

Flow A (`M6-STTCFG-OFF` +1): STT disabled -> record -> stop -> seal completes without waiting; item shows DISABLED; fragments contiguous. Flow B (`M6-STTCFG-UNREACH` +1): STT enabled, backend stopped before the session -> seal completes, item PARTIAL with the failed-chunk count and the unreachable flag, no text; fragments contiguous. Both need rows 82/83/115.

## 7. Decisions taken (for the controller)

| ID | Decision | Confirm |
|---|---|---|
| D-116-1 | Default limits 30 min / 30 s / 2 min — a proposal; no spec names a value | yes / other values |
| D-116-2 | The budget counts waited time with gaps capped at `callLimitMs`, not wall time since the first start (a restart must not give a transcript up) | yes |
| D-116-3 | Close-out failure = step FAILED at the bound, not DONE. Alternative needs a spec change: a `PARTIAL` without a document (row 83) | choose |
| D-116-4 | A chunk given up at the bound has code `TIMEOUT`: `backendUnreachable` true on `omlx-server`, false on `cpu-local` | yes |
| D-116-5 | A disabled session with chunk rows is logged, never blocks the seal, and nothing of it is sealed | yes |
| D-116-6 | A seam question that fails before the bound stays a typed failure (D-79-9); at the bound the step closes out regardless | yes |

No commit. No migration. No lockfile write. oMLX not started. `masterplan/*`, `status_tasks.md`, `delegation_progress_report.md` not edited.

---
*Generated: 2026-10-09 17:22 (+07:00)*
