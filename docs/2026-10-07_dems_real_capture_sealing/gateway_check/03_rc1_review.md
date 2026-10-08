# Row 26 — Senior code review: RC-1 diff of row 22

> **Superseded in part (2026-10-08, audit D19/D21):** see `implementation/09_rv_code_audit_fixes.md` — the `:132` failure site of `live-paired-devices-issue` is now deterministic, and the row-22 after-stop hold was replaced by ruling D19(b) (the Core's recorded duration wins once the stop is known).


Task: `2026-10-07_dems_real_capture_sealing`, row 26 (class A, M0, tier 2).
Blueprint verification gate (hard): "Verdict; forward-only rule (DEC-FXR-M-2) checked with file:line; findings routed to row 22" (`identification/02_structured.md:206`).
Producer artifact reviewed: `implementation/07_rc1_recording_elapsed_monotonic.md` (row 22).
Review mode: read-only. No file outside this task folder's two contract outputs was edited.

---

## Verdict

**PASS-with-findings.**

The fix is correct, minimal and honest: one production file (`apps/mobile/src/runtime/recording-elapsed.ts`, +46/−7, six hunks) plus one untracked fake-clock test, and it genuinely closes the RC-1 step-back at a late stop by freezing the shared ticker at the largest second drawn instead of collapsing the ticker half to 0. Every requested path (a)-(f) was traced to file:line and holds on the row's mandate; the protected file `use-monitor.ts` has an empty diff; the diff and the test contain zero wall-clock reads; the new test was independently re-run here 3/3 GREEN and the pre-fix RED is reproduced by the mechanism and quoted by row 22. No Blocker and no Major finding. The residual findings are coverage and citation issues (the session-boundary case and the SEALED→history transition are not covered by the new test; the report cites a non-existent `session-machine.ts` path and slightly overstates D255's acceptance of the SEALED→history data-source change), all routed to row 22.

---

## Hunk-by-hunk table

Diff: `git diff -- apps/mobile/src/runtime/recording-elapsed.ts` (`1 file changed, 46 insertions(+), 7 deletions(-)`; blob `9ba1468..4da7cd7`).

| Hunk (diff header) | Post-fix file:line | What it does | Verdict | Note |
|---|---|---|---|---|
| `@@ -10,7 +10,9 @@` | `recording-elapsed.ts:12-15` | Header comment now states the stop-hold (D255) and scopes "never steps back" to the lagging `stoppedAt` render | correct | Comment matches the code; the phrase "never steps back" is qualified to the stop render, so the SEALED boundary caveat (F4) is not contradicted by the header itself |
| `@@ -51,6 +53,13 @@` | `recording-elapsed.ts:53-63` | `ElapsedTicker` gains a required `freeze(): void` | correct | Source-compatible for consumers; the only producer is `createElapsedTicker` (grep across `apps/mobile/src`; re-exported `use-monitor.ts:97`, `runtime/index.ts:222,227`). No mock implementer exists (residual R2 accepted) |
| `@@ -64,10 +73,12 @@` | `recording-elapsed.ts:76,81` | `let stopped = false`; `tick()` returns early when stopped | correct | Freeze is fail-closed: no clock read and no listener notification after stop |
| `@@ -81,7 +92,7 @@` | `recording-elapsed.ts:95` | `finally` re-arm guarded by `!stopped` | correct | A frozen ticker never re-arms; interacts cleanly with W93-12's throw/re-arm path (`:91-100`) |
| `@@ -93,7 +104,7 @@` | `recording-elapsed.ts:107,117-124` | `subscribe` arms only `if (!stopped && handle === null)`; `freeze()` sets `stopped`, clears the pending timer, drops the handle; idempotent | correct | Idempotency guard at `:118`; clears `handle` so `core.pending()` is 0 after freeze (asserted by test 2) |
| `@@ -103,34 +114,62 @@` | `recording-elapsed.ts:128-176` | Cache entry gains `sessionId`; new `heldAfterStop(clock, sessionId)` (`:149-155`); `useRecordingTickerSeconds` routes the not-RECORDING branch through it (`:172`) | correct | Same-session guard at `:152` (`cached.sessionId !== sessionId` → null) prevents cross-session bleed; `sharedTicker` replaces the cache entry for a new key (`:131-137`) |

No hunk is questionable or wrong. The logic at `:172` is the only behaviour-changing line: `coreClock === null ? null : startedAt !== null ? sharedTicker(...) : heldAfterStop(...)`. Between RECORDING and STOPPING/FINALIZING the same ticker object is returned, so `useSyncExternalStore` sees stable `subscribe`/`getSnapshot` and does not resubscribe.

---

## Forward-only (DEC-FXR-M-2) compliance

Rule text located: `docs/2026-10-04_dems_backend_rbac_pairing/gateway_check/15c_fxr_mobile.md:67` — "Timers and clocks roll forward only (`rollsForward`: duration, clock); other formats roll the shorter way". Restated for this phase in `docs/2026-10-04_dems_backend_rbac_pairing/research/11_next_phase_drift_check.md:115` ("progress must be forward-only (DEC-FXR-M-2)").

Wall-clock grep on the diff: `git diff -- apps/mobile/src/runtime/recording-elapsed.ts | rg -n "Date\.now|performance\.now|new Date|Math\.random"` returned nothing (exit 1). Wall-clock grep on the test: `rg -n "new Promise|Date\.now|performance\.now|jest\.setTimeout|sleep|wait\(|setTimeout\(" live-rc1-elapsed-stop-hold.test.tsx` returned nothing (exit 1). The only `setTimeout` token is the virtual-timer member definition at test `:39`. Both hold.

| Path | Verdict | file:line evidence |
|---|---|---|
| (a) Late-stop (the bug) | PASS | `recording-elapsed.ts:149-155` freezes and returns the shared ticker; `:172` uses it once `startedAt` leaves RECORDING; `use-sessions-data.ts:141` draws `Math.max(fromStore, ticked)` = held. New test 1 asserts `drawn() >= ticked` (`live-rc1-elapsed-stop-hold.test.tsx:114`) |
| (b) Normal on-time stop | PASS | Same path; held value ≈ `fromStore` at `stoppedAt`, so `Math.max` is monotone; freeze prevents any post-stop growth (`:81,95,107`) |
| (c) New session after a stop (no bleed) | PASS (code) / GAP (test) | `heldAfterStop:150,152` returns null unless `cached.sessionId === sessionId`; `sharedTicker:132-137` creates and caches a new ticker for the new `sessionId|startedAt` key. `session-machine.ts` has no transition back to RECORDING (`:657` only entry; `:705` STOPPING; `:767` FINALIZING; `:879` SEALED). Not covered by the new test — finding F2 |
| (d) SIMULATED (`coreClockOf = null`) | PASS | Diff `:172` keeps `coreClock === null ? null`; `coreClockOf` returns null for a simulator (`core-clock.ts:104-106`); hook returns `zeroSeconds` (`:157-158,175`). Test 3 asserts the store-only draw (`live-rc1-elapsed-stop-hold.test.tsx:143-159`) |
| (e) SEALED → history row | PASS (scoped) / CAVEAT | From RECORDING through STOPPING/FINALIZING the held value persists (`:172`, sessionId unchanged). At SEALED `s.session` stays the sealed session (`packages/shared/src/sim/session-machine.ts:879`), but the hub's active row returns null (`sessions-model.ts:111-114,117-119`) and the sealed row becomes a history row whose `durationMs` is `endedAt − startedAt` (`session-machine.ts:802,886`), which can be δ below the held value. See F4 and residual R1 |
| (f) Clock reads earlier at the source | PASS | Ticker `:86` `Math.max(seconds, elapsedSecondsAt(...))`; `core-clock.ts:87` `Math.max(liveNow, localNow + offset)` never moves backwards. Covered by the pre-existing unit test `elapsed-ticker.test.ts:75-87` (still green post-fix) |

Compliance result: 6/6 paths checked; 5 PASS and 1 PASS-with-caveat (path (e), the SEALED row-data-source boundary, which is a display-only artifact outside row 22's single-file mandate).

---

## Findings

| ID | Severity | file:line | What | Why | Remediation | Routed to |
|---|---|---|---|---|---|---|
| F1 | Minor | `implementation/07_rc1_recording_elapsed_monotonic.md:44` (and task brief) vs `packages/shared/src/sim/session-machine.ts:705` | The report cites `apps/core-server/src/engine/session-machine.ts:705` for `stoppedAt: now`; that path does not exist. The real file is `packages/shared/src/sim/session-machine.ts` (line 705 is exactly `stoppedAt: now`) | A wrong file:line in the mechanism section weakens traceability of the root cause even though the code claim is correct | Correct the citation to `packages/shared/src/sim/session-machine.ts:705` (and `:657` RECORDING, `:767` FINALIZING, `:879` SEALED) | row 22 |
| F2 | Minor | `live-rc1-elapsed-stop-hold.test.tsx:95-159` | The new suite has no case for the session boundary: session A stops (frozen ticker cached), then session B starts — the held value must not bleed into B | The guard exists (`recording-elapsed.ts:150,152`) but is untested; a future refactor of the `sessionId` guard or the cache key could regress silently. Only SIMULATED (path d) and the same-session stop paths are covered | Add a 4th case: stop A, start B, assert B draws 0 then grows from its own start and never inherits A's held second | row 22 |
| F3 | Minor | `live-rc1-elapsed-stop-hold.test.tsx:117-141`; residual R2 (`07_…:179`) | No direct unit test of `freeze()` on `createElapsedTicker`; freeze behaviour is only exercised through the hook | The neighbour unit suite (`elapsed-ticker.test.ts:45-117`) unit-tests every other ticker method; freeze is the new public member and has no unit-level contract test | Optional: add a `createElapsedTicker` unit case in `elapsed-ticker.test.ts` that calls `freeze()`, asserts snapshot holds and `pending()` is 0 | row 22 |
| F4 | Minor | residual R1 (`implementation/07_rc1_recording_elapsed_monotonic.md:178`); `sessions-model.ts:111-114,117-119`; `session-machine.ts:802,886` | The report says D255 "explicitly accepted" the SEALED→history data-source change. D255 (`decisions.md:261`) accepted RC-1 as "a known display correction for this demo" and ruled "keep the larger of drawn and stored value per session"; it did not explicitly rule on the SEALED→history row transition | The claim overstates the record. The residual is real: the hub can step back by δ once more when the active row is replaced by the history row (held 1129 → Core 1122). It is display-only and outside row 22's scope, but should be recorded as a known limitation, not as an accepted ruling | Reword to "consistent with D255's demo display tolerance; not explicitly ruled"; add "hub row: no step-back across the SEALED→history swap" as a follow-up (would be a `use-sessions-data` change) | row 22 |
| F5 | Nit | `recording-elapsed.ts:172` → `heldAfterStop:153` | `freeze()` is called during render (inside `useMemo`) | Idempotent and safe (no React concurrent mode in use; the state machine has no return to RECORDING), but a side effect in render is a maintainability smell | Accept, or freeze in an effect keyed on the not-RECORDING transition | row 22 |
| F6 | Nit | `recording-elapsed.ts:149-155` | `freeze()` is irreversible; if the same `sessionId|startedAt` key ever returned to RECORDING, `sharedTicker:134` would hand back the frozen ticker | Not reachable today (`session-machine.ts` has no re-entry), but the coupling is implicit | Add a one-line comment noting the invariant, or reset `stopped` on cache replacement | row 22 |

Blocker: 0. Major: 0. Minor: 4 (F1-F4). Nit: 2 (F5, F6).

---

## Regression test assessment

| Question | Answer |
|---|---|
| Reproduces the RC-1 symptom (00:00:19 → 00:00:11 class)? | Yes. It models the store clock holding while the ticker leads by 7 s, then the late stop at the lagging `stoppedAt` (`live-rc1-elapsed-stop-hold.test.tsx:71-115`). The pre-fix RED is `Expected: >= 1129 / Received: 1122` (report §4, `07_…:96-103`), exactly the δ step-back |
| Fake-clock (no real sleeps)? | Yes. Virtual `manualCoreClock` (`:31-61`) with in-registry `timers`; grep for `new Promise/Date.now/performance.now/jest.setTimeout/sleep/wait(` returns nothing (exit 1). The report's §3 grep claim is reproduced |
| Meaningful assertions? | Yes as a suite. Test 1 (`>= ticked`) rejects the pre-fix drop-to-0. A naive "keep the ticker alive" `Math.max` regression would pass test 1 but fail test 2 (`:133-140`: value must stay exactly equal and `core.pending() === 0`), so the freeze design is genuinely guarded. Test 3 pins the SIMULATED no-op. Independently re-run here: 3/3 passed, exit 0 (`npm run test -w @dems/mobile -- src/features/session-live/live-rc1-elapsed-stop-hold --maxWorkers=2`) |
| Session-boundary coverage? | **Gap.** No LIVE "new session after a stop" case (path c). Only the SIMULATED guard (path d) and same-session stop are covered — finding F2 |

---

## Side-effect spot-check (report §5, residual R4)

| Consumer | file:line | Assessment |
|---|---|---|
| Monitor | `use-monitor.ts:92-94` delegates to `useRecordingElapsedSeconds`; `:97` re-exports the ticker | No breakage; held value is the intended generalization (DEC-FXR-M-2). Protected region diff empty |
| Home System Status | `use-home-data.ts:97-100` `Math.max(fromStore, useRecordingTickerSeconds())` | Unchanged shape; on stop the RecRow unmounts (`system-status-card`), so no visible move |
| Mini-bar | `live-mini-bar.tsx:61-63` via `useRecordingElapsedSeconds` | Unmounts at stop; no visible move |
| Sessions hub | `use-sessions-data.ts:139-142` | The only display that stays mounted at the stop; this is the fixed path |
| `ElapsedTicker` producers | `rg` across `apps/mobile/src` — only `createElapsedTicker` | Interface widening (R2) breaks no implementer; `elapsed-ticker.test.ts` does not construct a mock |

Neighbour suites (report §5: `elapsed-ticker|live-mini-bar-core-clock|live-monitor-timer-core-clock|features/sessions/live-sessions`, 19/19) were not re-run (one-command budget spent on the new file). The call-site reading above shows no contract change to those suites; `elapsed-ticker.test.ts` is source-compatible with the new required member.

---

## Residuals adjudication

| # | Residual (report §7) | Adjudication | Reason |
|---|---|---|---|
| R1 | SEALED→history data-source change | Needs-follow-up | Real and confirmed (`sessions-model.ts:111-119`; `session-machine.ts:802,886`). Display-only and outside scope, but the report's "explicitly accepted by D255" is an overstatement — see F4 |
| R2 | `ElapsedTicker.freeze()` member widening | Accept | Only producer is `createElapsedTicker`; no other implementer or mock exists (grep). Source-compatible for consumers |
| R3 | Accepted δ overshoot of the held value | Accept | Matches D255 ("keep the larger of drawn and stored value"); the audit/history keeps the Core's truth (`session-machine.ts:802`). Display-truth trade-off is intentional |
| R4 | Wider effect (monitor/mini-bar/Home) | Accept | Correct generalization of the one rule; those displays unmount/replace at the stop; call sites read clean |
| R5 | A4 device half stays pre-handover | Accept | Explicitly out of scope for row 22 (no emulators/devices per the row constraint); matches D255 routing the device check to pre-handover |
| R6 | Test depends on the manual-clock convention | Accept | Matches the module's existing convention (`elapsed-ticker.test.ts`, `live-mini-bar-core-clock.test.tsx`); note the re-verification trigger if a later row converts to `jest.useFakeTimers` |

---

## Positive findings

- Minimal, correctly-scoped fix: one production file, +46/−7, matching the blueprint's stated fix point (`identification/02_structured.md:202`, `recording-elapsed.ts:129`).
- The freeze design is genuinely tested: test 2 rejects a naive non-freezing `Math.max` (value must not grow past the stop; `pending()` = 0).
- The pre-existing ticker already enforces forward-only (`:86`) and the Core clock never moves backwards (`core-clock.ts:87`); the fix extends the same rule to the hook boundary rather than introducing a new clock.
- The cache key includes `sessionId` and `heldAfterStop` guards on it (`:129,150,152`), preventing cross-session bleed by construction.
- Fake-clock discipline holds: no wall-clock reads in the diff or the test; no real waits.

---

## Scope proof

Protected file diff (must be empty):

```
$ git diff -- apps/mobile/src/features/session-live/use-monitor.ts | wc -l
0
```

Changed files under the gated trees:

```
$ git diff --name-only -- apps/ packages/ scripts/ release/
apps/core-web/src/test/live-paired-devices-issue.test.tsx
apps/mobile/src/features/devices/devices-screen.test.tsx
apps/mobile/src/features/evidence/evidence-detail.test.tsx
apps/mobile/src/features/evidence/evidence-more-menu-title.test.tsx
apps/mobile/src/features/evidence/play-sheet.test.tsx
apps/mobile/src/features/more/more-live.test.tsx
apps/mobile/src/features/session-live/live-session-live-link.test.tsx
apps/mobile/src/features/session-new/live-session-new-followups.test.tsx
apps/mobile/src/features/settings/live-settings-boundary.test.tsx
apps/mobile/src/features/storage/storage-screen.test.tsx
apps/mobile/src/navigation/__tests__/chrome-lost-updates.test.tsx
apps/mobile/src/runtime/recording-elapsed.ts

$ git ls-files --others --exclude-standard -- apps/
apps/mobile/src/features/session-live/live-rc1-elapsed-stop-hold.test.tsx
```

Attribution: the 11 modified `.test.tsx` files are the gated siblings of rows 17-21 (row 20 `live-paired-devices-issue`; row 17 `live-settings-boundary`; row 18 `live-session-live-link`; row 21 `chrome-lost-updates`; row 19's seven RC-8 files). Row 22's production change is exactly one file — `recording-elapsed.ts` — plus its one untracked test. No config, no lockfile, no other production file. `git diff --name-only | rg -i "lock|\.json$|config|tsconfig|jest"` returned nothing (exit 1). The only other modified entries in `git status --porcelain` are controller-owned docs (`decisions.md`, `delegation_progress_report.md`, `status_tasks.md`) that pre-date this row.

---

## Files reviewed

- `apps/mobile/src/runtime/recording-elapsed.ts` (modified, full)
- `apps/mobile/src/features/session-live/live-rc1-elapsed-stop-hold.test.tsx` (new, full)
- `apps/mobile/src/runtime/core-clock.ts`
- `apps/mobile/src/features/session-live/use-monitor.ts` (90-169; re-export)
- `apps/mobile/src/features/session-live/elapsed-ticker.test.ts`
- `apps/mobile/src/features/sessions/use-sessions-data.ts`
- `apps/mobile/src/features/sessions/sessions-model.ts`
- `apps/mobile/src/features/dashboard/use-home-data.ts`
- `packages/shared/src/sim/session-machine.ts` (650-935)
- `docs/2026-10-04_dems_backend_rbac_pairing/gateway_check/15c_fxr_mobile.md:67` (DEC-FXR-M-2)
- `docs/2026-10-04_dems_backend_rbac_pairing/verification/13_post_review_recheck.md:109` (RC-1)
- `docs/2026-10-04_dems_backend_rbac_pairing/decisions/decisions.md:261` (D255)
- `docs/2026-10-04_dems_backend_rbac_pairing/research/11_next_phase_drift_check.md:115` (P-01)
- `docs/2026-10-07_dems_real_capture_sealing/decisions/decisions.md` (D8, D10, D12)
- `docs/2026-10-07_dems_real_capture_sealing/implementation/07_rc1_recording_elapsed_monotonic.md`
- `docs/2026-10-07_dems_real_capture_sealing/identification/02_structured.md` (rows 22, 26)

Confirmatory command (one, `--maxWorkers=2`): `npm run test -w @dems/mobile -- src/features/session-live/live-rc1-elapsed-stop-hold --maxWorkers=2` → `Test Suites: 1 passed, 1 total; Tests: 3 passed, 3 total`, exit 0.
