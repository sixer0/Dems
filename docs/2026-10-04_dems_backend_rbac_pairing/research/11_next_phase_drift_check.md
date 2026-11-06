---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-07
agent: data-analyst
type: mixed (drift check of a gated pre-planning artefact against the current tree)
tier: 2
confidence: HIGH for reference integrity (mechanical: every reference resolved and diffed against the pre-edit copies the later rows left in `.cache/rollback/`); MEDIUM for size/risk re-estimates (analyst judgement)
document_under_review: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/research/10_next_phase_impact_map.md (gated D228, written 2026-10-06 17:48 WIB)
repository_state: HEAD c2c983b (parent 0a9e317), working tree clean at session start
source_translated_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/identification/01_translated.md
source_structured_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/identification/02_structured.md
status: complete (read-only; the impact map is NOT edited; corrections are the errata in section 6)
last_updated: 2026-10-07 12:40 WIB
---

# Drift check: next-phase impact map (D228) against the repository at c2c983b

## 0. Verdict in one table

| Item | Result |
|---|---|
| Is the map still usable as the next task's starting input? | **Yes, with the errata in section 6.** Its core findings still hold: the shared simulator is untouched since the map (`packages/shared/src/sim/**` has no file modified after 2026-10-06 17:48), `app.ts`, `config.ts` and `src/index.ts` of the Core server are untouched (P25 freeze held), the 21 static guards under `apps/core-server/src/**/__tests__` are the same, the registry is still 75 operations / OpenAPI 0.2.1, and F-01 "no real ingest" re-checked with the same grep returned 0 non-test hits |
| Reference integrity (sections 2-7, 471 references) | 413 still valid on untouched files; 15 still valid on changed files (same lines); 14 file-level references to changed files (claim re-checked, holds); **6 line drifts**; **5 content changes inside a cited range** (claim holds, range adjusted); 0 moved/renamed; **0 gone**; 12 proposed new paths (none exists yet, as expected); 6 glob/pattern references (re-evaluated) |
| Main changes since the map | (1) D229/D230: STT model already on disk, no benchmark on this Mac — M1, M6, NM-13 and the CPU-contention risk change; (2) D232/D233: 2 + 1 test depth, long campaigns only at handover — section 7.3 and the AV-drift test change; (3) W90 (D240): lane databases gone, only `dems_demo` exists, devices re-paired to the main instance — every "lanes 4420-4423 as today" step needs a lane re-creation step first; (4) post-review fix rows added reusable patterns the next task must follow (Core clock + shared recording-elapsed source on mobile, contract constants imported by the server, web query factories, constant-border selection glow, "Checking your permissions..." rule); (5) four omissions of the map surfaced (section 6, E-01..E-04) |
| Errata rows | 31 (section 6) |
| New open decisions proposed | OD-22..OD-26 (section 3.4) |

---

## 1. Reference integrity

### 1.1 Method (how it was verified)

1. Extracted every back-quoted path token of sections 2-7 of the map (lines 81-431), with its line ranges and the continuation ranges in the same cell (`:461-464` after a file) — 471 tokens. Bare file names were resolved against `git ls-files` using the section's workspace (3.1 shared, 3.2 core-server, 3.3 core-web, 3.4 mobile) and the directory of the previous file in the same cell; 5 remaining ambiguities were resolved by hand.
2. Listed every source file modified after the map's timestamp: `find apps packages scripts -newermt '2026-10-06 17:48'` (node_modules and build output excluded) = **235 files**. They match the file lists of the post-map rows CF2-A, CF2-B, C3, FXR-S, FXR-W, FXR-M, T1, T2 and PT (rollback folders `.cache/rollback/<row>/`).
3. For each cited file that changed, diffed the earliest pre-edit copy (CF2-A, CF2-B, C3, FXR-S, FXR-W, FXR-M, T1, T2, PT, in that order) against the current file with a line-level sequence match, and mapped each cited line: same number, new number (drift), or not matched (content changed).
4. Printed the current first line of every cited range and read the list (448 lines) to confirm the content still matches the map's claim.
5. Section 7.2 lists test names without a path extension; every named test file was checked for existence (automatic match plus a targeted check of the 30 the parser could not match): **0 missing**; all 13 static-rule folders named in list S still have their static test.

Unique files referenced: about 225; 28 of them were modified after the map.

### 1.2 Counts by section

| Map section | Valid (file untouched) | Valid (file changed, same lines) | File-level ref, file changed | Line drift | Content changed in range | Proposed path | Glob/pattern |
|---|--:|--:|--:|--:|--:|--:|--:|
| 2 Current-state facts | 103 | 2 | 0 | 0 | 1 | 0 | 1 |
| 3.1 shared | 105 | 2 | 0 | 1 | 0 | 0 | 0 |
| 3.2 core-server | 64 | 5 | 5 | 0 | 3 | 2 | 0 |
| 3.3 core-web | 48 | 2 | 3 | 2 | 1 | 0 | 0 |
| 3.4 mobile | 44 | 3 | 6 | 3 | 0 | 0 | 1 |
| 3.5 docs | 16 | 0 | 0 | 0 | 0 | 0 | 0 |
| 4 New modules | 4 | 0 | 0 | 0 | 0 | 8 | 1 |
| 5 Contract | 13 | 0 | 0 | 0 | 0 | 0 | 0 |
| 6 Database | 15 | 1 | 0 | 0 | 0 | 2 | 0 |
| 7 Tests | 1 | 0 | 0 | 0 | 0 | 0 | 3 |
| **Total (471)** | **413** | **15** | **14** | **6** | **5** | **12** | **6** |

Moved/renamed: **0** (the one move of the period, `apps/core-web/src/features/home/use-health.ts` -> `apps/core-web/src/lib/health-query.ts` (D242/D247), is not cited by the map). Gone: **0**.

### 1.3 Line drifts (6)

| Map row | Map reference | Current location | Changed by | What moved it |
|---|---|---|---|---|
| SH-20 | `packages/shared/src/api/examples.ts:267` ('Audio Capture Service' in the service list) | `:268` | FXR-W (W92-25) | Comment of the health example grew by one line (`examples.ts:154-156`) |
| WB-02 | `apps/core-web/src/features/dashboard/devices-panel.tsx:23-42` | `:24-43` | FXR-W (W92-14) | Import of `useDeviceCommandGate` from `lib/device-command-gate.ts` |
| WB-02 | `devices-panel.tsx:260` (mic clip state) | `:258` | FXR-W (W92-14) | Local `selectCan` selectors replaced by the shared gate |
| MB-03 | `apps/mobile/src/features/session-live/session-live-screen.tsx:231-256` (`onClipReset`, `MicCard`) | `:236-261` | CF2-A (RF-PH-1/-3) | In-place monitor hand-off and Core-clock timer wiring |
| MB-03 | `apps/mobile/src/features/session-live/use-monitor.ts:148` (`resetClip` in `MonitorHandlers`) | `:165` | CF2-A, FXR-M | `useMonitorElapsedSeconds` (`:92-94`) now reads the shared recording-elapsed source |
| MB-03 | `use-monitor.ts:227` (`resetClip` handler) | `:244` | CF2-A, FXR-M | Same |

### 1.4 Content changed inside a cited range (5; the map's claim still holds)

| Map row | Map reference | Current range | Changed by | Change |
|---|---|---|---|---|
| F-18, CS-06 (2 refs) | `apps/core-server/src/modules/devices/operations.ts:5-33` | `:5-33` (table unchanged; `:20` import became `import type`) | FXR-S (W91-12) | `DEVICE_COMMAND_OF_OPERATION` (`:42-52`) is now DERIVED by inverting the contract's `DEVICE_COMMAND_OPERATIONS`, not restated. A new device command (e.g. a PoE cycle or an AV flash+beep test) now needs only the contract table entry |
| CS-14 | `apps/core-server/src/core/audit-details.ts:1-133` | `:1-140` | FXR-S (W91-4) | `PAIRING_CODE_CLOSE_REASONS` built from the contract's `PairingCodeCloseReason` (`:19`, `:32-40`). Pattern for new server-written capture audit types: import the value sets from `@dems/shared/api` |
| CS-15 | `apps/core-server/src/realtime/publication.ts:1-22` | `:1-22` | FXR-S (CPB1-18, W91-5, W91-16) | `SessionEndedReason` re-exported from the contract (`:8`, `:12-16`); the header rule is unchanged: "a kind may be added, an existing one is not changed"; `deviceIds` documented as a diagnostic payload |
| WB-04 | `apps/core-web/src/features/evidence/integrity-tab.tsx:52-286` | `:52-295` | FXR-W (W92-10) | The stored-verdict line is pinned per run while a Verify runs (`:93-101`); the v2 integrity view must keep this rule |

### 1.5 Files the map cites without a line that later rows changed (14; re-checked, claims hold)

| Map row | File | Row | Relevance for the next task |
|---|---|---|---|
| CS-06 | `apps/core-server/src/modules/devices/status.ts` | FXR-S | Comment only (`audioChannelsOf` fallback, D89) |
| CS-12 | `apps/core-server/src/plugins/permission-guard/access-rules.ts` | FXR-S | `RETIRED_DEVICE_OPERATIONS`, `FORBIDDEN_OPERATION` typed as registry IDs (W91-5): new operations 76-88 are type-checked there |
| CS-15 | `apps/core-server/src/realtime/limits.ts` | FXR-S | Own `DEVICES_CHANGED_MAX_WAIT_MS = 5_000` (`:102`, W91-3) |
| CS-21 | `apps/core-server/src/db/reset/routine.ts` | FXR-S | A request-triggered reset no longer mutates `process.env` (DN-FXR-S-3) |
| CS-22 | `apps/core-server/src/db/schema/boot-checks.ts` | FXR-S | `GENESIS_HASH` imported from the simulator (W91-6) |
| WB-04 | `apps/core-web/src/features/evidence/use-evidence-media.ts` | FXR-W | Query gated on `useCoreSignedIn()` (W92-3) — a future media-stream query must keep the gate |
| WB-04 | `apps/core-web/src/features/evidence/export-download.ts` | FXR-W | Uses `lib/download.ts` (W92-7, revoke delay >= 1 s) — the real package download (NM-12) should reuse it |
| WB-09 | `apps/core-web/src/test/live-api-reference-document.test.tsx` | FXR-W | Still pins 75 operations (category B) |
| MB-01 | `apps/mobile/src/features/dashboard/use-home-data.ts` | FXR-M | `useElapsedSeconds` = max(store, `useRecordingTickerSeconds()`) (`:97-100`) |
| MB-04 | `apps/mobile/src/features/session-finalizing/finalization-pipeline.tsx` | FXR-M | Stepper rest values held in React (W93-7) |
| MB-04 | `apps/mobile/src/features/session-finalizing/session-finalizing-screen.tsx` (441 -> 464 lines) | CF2-A | 'Evidence sealed' card replaced by the in-place Summary (`summary-handoff.ts`, D236) |
| MB-05 | `apps/mobile/src/features/session-summary/session-summary-screen.tsx` (706 -> 718 lines) | CF2-A | In-place hand-off target |
| MB-07 | `apps/mobile/src/features/evidence/export-sheet.tsx` (567 -> 570 lines) | FXR-M | 'Verified by the Core' no longer shown under FAIL (W93-5) |
| MB-08 | `apps/mobile/src/features/devices/device-row.tsx` | FXR-M | Constant 1 dp border + `components/composed/selection-glow.tsx` (W93-2/-4) |

The 15 "valid, file changed, same lines" references are in `value-sets.ts` (F-05, F-14, CS-16, §6), `modules/evidence/index.ts` (CS-08 `:38`, `:73`, `:150-210`), `realtime/hub.ts:380-400`, `i18n/en/common.ts:293-298` and `:475-486`, `device-drawer.tsx:57-60` and `:183-236`, `session-live-screen.tsx:63`, `use-monitor.ts:27`, `evidence-model.ts:282-313`.

### 1.6 Proposed paths and patterns

- 12 proposed paths (`0004_capture.sql`, `0005_capture_privileges.sql` (x2 each), `core-server/src/capture/{fragments,keys,sealing}.ts`, `packages/shared/src/api/capture.ts`, package files `manifest.json`, `transcript.json/.srt/.vtt`, `fragments-VIDEO-0x.json`, `audit-session-extract.jsonl`): none exists (checked `apps/core-server/src/capture`, `modules/capture-config`, `modules/evidence-media`, `packages/shared/src/evidence-package`, `packages/shared/src/api/capture.ts`: all absent). No workspace `apps/capture-worker`, `apps/transcriber` or `packages/capture-protocol` exists (`ls -d apps/* packages/*` = core-server, core-web, mobile, mock-core, shared).
- Patterns: `static*.test.ts` under `apps/core-server/src/**/__tests__` = 21 (unchanged); `features/*/testing/*.tsx` exist; the §7.1 `find` now returns **664** test files (was 630) — section 2.6.

---

## 2. Plan content drift (what later rows already did or changed)

### 2.1 Items later rows made easier, partly did, or constrained

| # | Change after the map (row, decision) | Evidence | Map rows affected | Effect |
|---|---|---|---|---|
| P-01 | Mobile recording time now comes from ONE source: `runtime/recording-elapsed.ts` (shared ticker per Core clock and session; draws max(store clock, ticker); forward-only) on top of `runtime/core-clock.ts` (Live clock corrected for late heartbeats) (CF2-A D236, FXR-M D246, DEC-FXR-M-1/-2) | `recording-elapsed.ts:1-21`, `:128-144`; `core-clock.ts:1-21`; `graft callers useRecordingElapsedSeconds -d all` -> `live-mini-bar.tsx:61-63`, `use-monitor.ts:92-94`, `rec-indicator.tsx:82-86`; `graft callers useRecordingTickerSeconds` -> `use-home-data.ts:97-100`, `use-sessions-data.ts:139-142` | SH-06, MB-01, MB-03, MB-04, R-6 (sealing progress/ETA) | Easier: sealing progress and any "since" display on mobile must derive from Core instants through `coreClockOf`, not a new local timer; progress must be forward-only (DEC-FXR-M-2). RC-1 (`recording-elapsed.ts:129`, D255) is fixed in the same module — merge it into MB-04/MB-01 work |
| P-02 | Server imports contract constants instead of copies; `modules/__tests__/contract-values.test.ts` compares server names with contract names by identity (FXR-S D245) | `contract-values.test.ts:1-8`; `audit-details.ts:19`, `:32-40`; `publication.ts:8` | CS-07, CS-14, NM-03, NM-09, NM-10, §5.7 | Rule for the next task: new error codes, thresholds (OD-11), audit detail value sets and capture enums live in `@dems/shared/api` and are imported; extend `contract-values.test.ts` (new row CS-25) |
| P-03 | Device command map derived from the contract (W91-12) | `operations.ts:42-52` | CS-06, NM-01, §5.2 op 48/49 | Easier: PoE cycle / AV test = contract table entry + module route |
| P-04 | Web: one query factory per shared Core key with its gates (`lib/core-queries.ts`; `useCoreSignedIn`, `retryCoreQuery`), `lib/health-query.ts`, `lib/download.ts`, `lib/device-command-gate.ts`, `components/shell/root-error.tsx` (FXR-W D247, D242 W92-8/9) | `core-queries.ts:1-21` | WB-04, WB-05, WB-07, NM-12 | New reads used by more than one page (capture config, capture devices, transcript, export job) get a factory there (new row WB-11); export download reuses `lib/download.ts`; the PoE-cycle menu reuses the device-command gate |
| P-05 | Dashboard and Devices page disable Restart while recording (DN-W, W92-14) | `devices-panel.tsx` header (`lib/device-command-gate.ts`) | CS-06, WB-02, WB-05 | Constraint: "`restartDevice(CAM-0x)` -> PoE cycle" during RECORDING is refused by the UI gate — a camera recovery mid-recording needs a decision (OD-22) |
| P-06 | `admin.changed DEVICES` is the PAIRED-CLIENT registry event (FX-C D202; debounce constant FXR-S) | `packages/shared/src/api/realtime-messages.ts:156` (`AdminResource.DEVICES`); `realtime/limits.ts:93-102` | CS-15, NM-09, §5.5 | Naming collision risk: capture devices must not reuse `AdminResource.DEVICES`; the map's plan (replicated slices `captureConfig`, `captureDevices` through the engine) avoids it — keep it that way |
| P-07 | Mobile app log blanks `ses_`/`dvc_`/`bio_` values (PT D254, W100-1); web error sink the same (D251) | `apps/mobile/src/runtime/log.ts:24` | NM-11, MB-07, §9 "fallback short-lived signed URL" | If the next task introduces a new credential-shaped value (signed media URL, export token), both blanking lists must add its prefix |
| P-08 | Mobile jest: `testTimeout: 20000`, `maxWorkers: '50%'` (T1 D247, T2 D256); four wall-clock tests still flaky (D256) | `apps/mobile/jest.config.js:9-12` | §7.3 all layers | New timing tests (ETA, switch latency, sealing steps) must use fake clocks; do not add wall-clock waits (B10) |
| P-09 | Static guards added outside `src/**/__tests__`: `apps/core-server/test/static/test-support-imports.test.ts` (tests import `test/support/{core,engine,realtime}`, not the old shims), `apps/mobile/src/runtime/dems-live-console-static.test.ts` (`[DEMS-LIVE]` behind `__DEV__ && !IN_JEST`); 9 static tests edited | changed-file list; `test-support-imports.test.ts:1-9` | F-03, §7 S | F-03's "21 static guards" is unchanged for the capture host modules; new tests of `capture/` must follow the test-support rule. HBX-13 (static scanners -> lint rules / compiler API) is routed to the next phase (D241) — it would change the form of this blocker |
| P-10 | `components/composed/selection-glow.tsx`: always-mounted glow, constant border (CF2-B D235, FXR-M D246) | `selection-glow.tsx:1-20` | MB-08, MB-09, MB-12 | Any new tablet list row (selector device list, audio intervals, transcript revisions) uses this pattern — the Reanimated lost-update family (RF-T-1) |
| P-11 | In-place hand-offs Starting -> monitor and Finalizing -> Summary (`monitor-handoff.ts`, `summary-handoff.ts`); `animation: 'none'` on `finalizing` and `summary/[sessionId]` (CF2-A, FXR-M) | `apps/mobile/src/navigation/stacks.tsx:59` | MB-03, MB-04, MB-05, MB-06 | A "resumed after restart" sealing state and RECOVERY -> SEALED (MB-06) must enter these hand-offs, not new routes |
| P-12 | `runtime/session-diagnostics.ts`: quiet session-window records (socket counters, 250 ms JS-lag sampler) (FXR-M, W93-28) | `session-diagnostics.ts:1-18` | §7.3 device e2e, M5, M7 | Ready-made instrument for "sealing progress on all clients" and mic-switch latency checks on the tablet (RF2-2 family) |
| P-13 | "Checking your permissions..." on every gated control while the role is unknown (W93-11 ruling, DEC-FXR-M-3); web role matrix waits for the link (DN-W) | D243, D246, D247 | MB-03 (toggle), MB-08/MB-09 (selector), WB-01, WB-05 | New gated controls follow the same rule; one more test per control |
| P-14 | `src/core/sweeper.ts` (moved from identity, W91-11): a core timer that never keeps the process alive and is not started by the app factory | `sweeper.ts:1-15` | NM-03 | Template for the supervisor heartbeat / telemetry timers |
| P-15 | `src/db/commands/statements.ts`: the one `CREATE DATABASE` text for `db:create`, the reset staging database and the test template (W91-6) | `statements.ts:1-9` | CS-17, CS-21, section 4 lanes | Lane re-creation and migration 0004/0005 testing reuse it; no change needed |
| P-16 | W92-10 pinned verdict during Verify (web) and W93-5 FAIL wording (mobile) | §1.4, §1.5 | WB-04, MB-07 | Keep in the v2 integrity view |

### 2.2 Size and risk estimates that changed

| Map row | Before | After | Reason |
|---|---|---|---|
| SH-21 Live source | M / Medium | M / **Medium-High** | The map omits `packages/shared/src/live/source/live-sim.ts:902-905` (`onMeters` commits `meters.audio` as `AudioSlice`), which the meters shape change (SH-17) must touch; the 2,683-line `createLiveSim` closure split is deferred (DR-1, D242) |
| CS-06 Devices module | M / Medium | M / Medium (easier) | Command map derived from the contract (P-03) |
| CS-17 Migrations | M / High | M / **Medium** | "applied on 4 live databases (4420-4423)" -> only `dems_demo` exists (D240); lanes are recreated fresh and receive 0004/0005 through `db:migrate` |
| MB-01 Home | S / Low | S / **Low-Medium** | Fold in D249 observation "tablet Home mic tiles 'No signal' while recording" (B15) — the mic tiles are rewritten anyway |
| MB-04 Finalizing | M / Medium | M / **High** | Reanimated history concentrates here: Stepper rest values (W93-7), ~104 'Unable to find SurfaceMountingManager' warnings per stop at the Finalizing hand-over (FXR-DEV-2, D249), late learning of the stop on the tablet (RF2-2, D252); a v2 progress/ETA view animates per step |
| MB-03 Session Live | L / High | L / High | Unchanged; the timer path (`use-monitor.ts:92-160`) must stay untouched when adding the toggle |
| WB-04 Evidence | L / High | L / High (slightly easier) | `lib/download.ts`, signed-in gate, pinned verdict already exist |
| NM-06 Transcript | L / High | L / High | Model on disk saves the download (D229); CPU runtime install + model conversion needs the user's approval (D230, report C9) |
| NM-13 Benchmark harness | S / Medium, gate of M1/M6 | **Deferred** to the real Core device (D230); replaced in M6 by a functional check (S / Low) | D230: "no benchmark milestone on this machine" |
| new WB-11 | – | S / Low | Query factories in `apps/core-web/src/lib/core-queries.ts` for capture config/devices, transcript, export job |
| new CS-25 | – | S / Low | Capture constants in `@dems/shared/api` + `contract-values.test.ts` extension |
| new SH-25 | – | S / Medium | `live-sim.ts:902-905` meters commit (E-02) |

### 2.3 Test baseline and test-impact counts (F-32, §7.1)

| Suite | Map (F-32) | Now (D247, D254, D256) |
|---|---|---|
| shared | 70 files / 1,848 | 71 / 1,851 |
| core-server unit | 155 / 3,926 | 160 / 3,954 |
| core-server db | 124 / 1,751 | 124 / 1,751 |
| core-web | 111 / 1,436 | 117 / 1,495 |
| mobile | 170 / 1,894 | 192 suites / 1,988 |
| mock-core / pg-scripts | – | 19 / 57 |
| Test files in the §7.1 `find` | 630 | **664** (shared 71, core-server 284, core-web 117, mobile 192) |

Re-count of the §7.1 categories with the map's abridged patterns, reconstructed (approximate, because the map printed the patterns abridged): A 103, B 14, C 16, D 27, S 21 (src) — union 159 (shared 29, core-server 69, core-web 29, mobile 32). The map's 165 stays a fair upper bound. 10 changing-fact test files were edited by later rows (e.g. `test/acceptance/contract.test.ts`, `live-api-reference-document.test.tsx`, `session-finalizing-screen.test.tsx`), so their pins must be re-read, not assumed.

---

## 3. Decision drift (D229-D259)

### 3.1 Milestones

| Map milestone | Change | Decision |
|---|---|---|
| M1 | Benchmark REMOVED. M1 = technical spikes: fMP4 writer + running hash + crash truncation + AV ±40 ms on a fake source (host FFmpeg 9.0.2); GStreamer vs FFmpeg pick; ONVIF against the target camera if available; **CPU STT runtime install with the user's approval** and conversion of the local Whisper large-v3-turbo (HF format, `~/.omlx/models/whisper-large-v3-turbo`, 1.5 GB) to a CPU runtime (whisper.cpp ggml or CTranslate2 int8). The MLX copy is excluded: Apple GPU only, conflicts with D222 and an x86 Core. Gate: "STT runs and produces a transcript", no RTF figure | D229, D230 |
| M6 | Gate "WER sample; label accuracy" -> functional check: transcript produced, sealed, verified, labelled when possible on a short Indonesian sample (D230). Keep "no dropped capture fragment while STT runs" as a correctness check (one 2 + 1 run), not a throughput measurement | D230, D233 |
| M9 | "benchmark re-run on the chosen Core hardware" becomes THE benchmark (RTF, RAM, WER, labelling accuracy) on the real Core device; NM-13 built there | D226 as superseded by D230 |
| M9 / handover | If the next task ends in the handover, M9 also hosts the pre-handover release-build items A1-A6 (section 3.3) | D250, D233 |
| All | Each device/browser check: 2 runs + 1 verification; loops >= 10 runs only when the user asks or announces handover | D232, D233 |

### 3.2 Testing approach (§7.3)

| §7.3 layer | Correction |
|---|---|
| Worker integration, AV sync | 2 + 1 per check. The "AV ±40 ms at start and after 1-2 h" mitigation in §9 is a long campaign: schedule it for the handover session or ask the user (D233) |
| Crash and resume | The kill matrix (each recording phase x each sealing step) is a set of DISTINCT checks, not a loop — allowed, each 2 + 1; repeated kill loops only at handover |
| STT benchmark harness | Removed from this Mac (D230) — see M6 |
| Contract / DB | "migration 0004/0005 on a copy of each lane DB" -> on `dems_demo` (copy via a throw-away database, as W98 did) plus fresh lanes |
| Device e2e | "Lanes 4420-4423 as today" -> lanes must be recreated first (section 4); biometric device steps are out (D231); pairing hand-off recordings start only after the redeem call has returned (D258 rule); tablet results under host load need the W98 diagnostics (P-12), release build preferred for timing criteria (D250) |
| All jest layers | Fake clocks; no wall-clock waits (D256, B10); mobile jest config T1/T2 |

### 3.3 Items routed to the next phase or pre-handover that belong in the next task's backlog

| ID (report) | Item | Source | Suggested placement |
|---|---|---|---|
| B2 | Dependency refresh (`npm audit` 99 high; `undici` >= 7.29.1; proposed row W106) | D248, D251 | **M0**, before the capture work adds dependencies (ONVIF client etc.); `package-lock.json` unchanged since 2026-10-04 |
| B3 | W99-2 shared pairing bucket (F76), W99-3 socket cap per session (F79) | D248 | Precondition of OD-13 (LAN listener) |
| B4 | W99-4 `DEVICE_CREDENTIAL_REQUIRED` refusal writes no audit row | D248 | With §5.4 audit design (credential refusals of camera credentials audited) |
| B5 | DR-1 `live-sim.ts` split (+ W92-6/-12/-15/-17, W92-27) | D242 | Decide order vs SH-21/SH-25 (OD-26) |
| B6, B7 | W91-10 file splits, W91-17 runbook; HBX-13 static scanners -> lint rules | D241, D245 | Separate hygiene rows; HBX-13 before adding 3 new static rules (OD-26) |
| B8, B9, B15 | W93-10/-18/-19/-26/-27; FXR-DEV-2 Reanimated warnings at Finalizing hand-over; D249 observations (tablet Home mic tiles 'No signal' while recording, audit rows of phone-sent session commands without a device ID) | D246, D249 | FXR-DEV-2 with MB-04; mic tiles with MB-01; device ID in audit with §5.4 (`AUDIO_SOURCE_SWITCHED` should carry the sending device) |
| B10 | Wall-clock-independent tests (`live-gap-read-only-dialog`, `live-settings-boundary`, `live-session-live-link`, `live-paired-devices-issue`); RC-8; `chrome-lost-updates` first test | D255, D256 | M2 test hygiene row |
| B11 / A3 | RF2-2: exact wait point of the late stop on the tablet | D243, D252 | Before M5/M7 tablet gates |
| B12 / A4 | RC-1 Sessions hub duration steps back once; RC-2..RC-7 nits | D255 | RC-1 with MB-04/MB-01 (same module) |
| B13 | W100-4 `localhost` in packaged CSP / mock-core origins; `release/web/BUILD-INPUTS.txt:168` old path | D247, D251 | Next packaging |
| B16 | Errata owed to `masterplan/03_database_contract.md` (terse logging, C2-R3 sentences, F-4/F-6/F-7, hour-change path) | D244, report | With DOC-03 (`dbc-3`) |
| B17 / C5 | F69: web-only Live demo cannot record without a paired tablet | report | Interacts with R-3 (who may switch the mic from the web) |
| A1, A2, A5, A6 | Release-build revoke-to-Pair < 1 s, timer lag/stale monitor on release, biometric device test (skipped), long campaigns | D218, D236, D231, D250 | Pre-handover session (M9 if the next task leads to handover) |

### 3.4 Open decisions OD-01..OD-21: status after D229-D259

| OD | Status |
|---|---|
| OD-20 STT model download and licences; language set | **Partly answered.** D229: the first candidate (Whisper large-v3-turbo, multilingual) is already on disk, so no download is needed for it; language Indonesian (D226). Still open: the CPU runtime install and model conversion (needs the user's approval, D230, report C9 iii); licence entries for DOC-05 |
| OD-13 Physical tablets/phones reaching the Core | Not answered; **more preconditions**: replace the published demo password before any exposure (report C9 i), W99-2/W99-3 hardening "before any use beyond one loopback computer" (D248) |
| OD-14 P25 waiver | Not answered; still needed — verified that no later row edited `app.ts`, `config.ts` or `src/index.ts` (none is in the 235-file list) |
| OD-17 Simulated-mode parity | Not answered; **interacts with this task's SC8 rule** (AC-B-59..62, DR-14: "nothing under `packages/shared/src/sim/` is written", additions only, 61 simulator-dependent test files diffed against `acaff20`). The next task must retire or re-baseline it (OD-23) |
| OD-01..OD-12, OD-15, OD-16, OD-18, OD-19, OD-21 | No later decision answers them. OD-19 is slightly easier: only `dems_demo` holds data now |

Proposed new open decisions:

| ID | Decision | Why now |
|---|---|---|
| OD-22 | May an operator PoE-cycle a camera during RECORDING? The web gate disables Restart while recording (DN-W, W92-14) | Conflicts with "`restartDevice(CAM-0x)` -> PoE cycle" as the recovery path of a lost stream |
| OD-23 | Retire or re-baseline the SC8 "simulator untouched / additions only" rule and the `acaff20` diff gate; new baseline `c2c983b` | SH-05..SH-08 rewrite simulator code; DR-14 already needed an exception for FX-C |
| OD-24 | CPU STT runtime (whisper.cpp ggml vs CTranslate2 int8) and approval of the install + model conversion | D229, D230; host has no `whisper-cli`, `ctranslate2`, `faster_whisper`, `torch`, `transformers` (probe) |
| OD-25 | Policy for real recordings and large media in `docs/` and git | `.git` is 1.5 GB (D259); 2 x 9 Mbit/s is about 8 GB/h (map §9 arithmetic); only `.data/` is guaranteed ignored |
| OD-26 | Order of the deferred refactors (DR-1 `live-sim.ts` split, HBX-13 lint conversion) relative to SH-21/SH-25 and the three new static rules | Both touch exactly the areas the capture work edits |

---

## 4. Environment drift (what the next task finds on the host)

| Item | State now | Evidence | Consequence for the plan |
|---|---|---|---|
| PostgreSQL | Running, `127.0.0.1:4432` (pid 47413, `postmaster.pid` written 11:38) | `lsof -nP -iTCP -sTCP:LISTEN` | Ready for M2 DB work |
| Cluster settings | Rebuilt by W90 with CPS1-9 (`log_error_verbosity` terse, collector, log files mode 600) | D240, D244 | DB tests that read error logs see one `STATEMENT:` line, no DETAIL; `pg-behaviours.db.test.ts` pins terse |
| Databases | Only `dems_demo` (+ `postgres`, `template0/1`); `dems_lane_1..3` gone | D240 (not re-queried here: listing needs credentials) | Every lane-based step (§7.3 device e2e, CS-17 "4 live databases", OD-02 L2 "all four databases") needs **lane re-creation first**: per lane `db:create`, `db:migrate` (under `.locks/db-migrate.lock`), `db:seed` (`README.md:260-266`), then start Core 4421-4423 and Vite 5176-5178 |
| Paired devices | phone DEV-0003, tablet DEV-0004, phone2 DEV-0005 paired to the MAIN instance; DEV-0002 revoked | D249, D252, report §5 | Pairing is per database: lane work needs a fresh pairing on each lane; the device-session helper maps `tcp:4420` to the lane port (`README.md:141`) |
| Emulators, adb | Three emulators listening on 5554/5556/5558, adb server 5037 | `lsof` probe | Booted and idle; Metro must start before the debug app can load (D238) |
| Core / Vite / Metro / mock-core | **Nothing listening** on 4400, 4420-4423, 5173, 5176-5178, 8081 | `lsof` probe (`ps` is blocked by this sandbox) | Start the stack per README before any e2e |
| adb reverse | `tcp:8081` and `tcp:4420` on each emulator; 4400 rule removed | report §5, D253 (not re-probed) | Lane runs re-map per session |
| `.gitignore` | + `docs/**/rec/*_frames/`, + `!docs/**/assets/*.log`, + two named logs | `git diff 057fc17 HEAD -- .gitignore` | Evidence logs are committed by default after a secret scan; real recordings need OD-25 |
| Repository size | `.git` 1.5 GB; working tree 29 GB (node_modules 14 GB, `.cache` 5.6 GB, `docs` 2.4 GB, `.data` 117 MB) | `du -sh` | `.cache` holds the rollback copies used by this check; keep until the user decides (report C8) |
| STT assets | `~/.omlx/models/whisper-large-v3-turbo/` 1.5 GB HF safetensors; no whisper.cpp / CTranslate2 / faster-whisper / torch / transformers / mlx in the system `python3` | `ls`, `du`, python `find_spec` probe | M1 needs OD-24 approval |
| Host tools | FFmpeg at `/opt/homebrew/bin/ffmpeg`; no GStreamer, no Maestro on PATH | `which` | F-29 unchanged |
| Test ledger | shared 71/1,851; core-web 117/1,495; mobile 192/1,988; core-server unit 160/3,954; db 124/1,751; mock-core 19; pg-scripts 57; root `npm test` = acknowledged CAUTION (load flakes) | D247, D254, D256 | New baseline for §7 |
| Commit baseline | HEAD `c2c983b`, local only, no remote | D259, git log | Next task's diff baseline |

---

## 5. Verdict

The map remains a sound starting input. No reference is gone, none moved, the architectural facts it rests on (sim, engine host, frozen files, static guards, contract counts, DB CHECKs) are untouched since it was written, and the 11 drifted or changed references all still support their claims. What changed is around the map: the STT and benchmark decisions, the test-depth rule, the lost lane environment, the patterns the fix rows introduced, and four omissions that only show up against the current code. Apply the errata below when the next task's task-architect writes the blueprint.

### Top risks that changed

| # | Risk | Change | Mitigation |
|---|---|---|---|
| 1 | STT starves capture | Likelihood now **unknown until the Core device** (D230 removed the measurement on this Mac) | Capture at higher priority, STT bounded threads, configurable model size; "no dropped fragment while STT runs" functional check in M6; benchmark on the Core device |
| 2 | Parallel device work blocked | **New**: lanes and lane pairings gone (D240) | Lane re-creation row at the start of M2/M4 |
| 3 | Tablet learns state late under load | **New evidence** (RF2-2, FXR-DEV-1: 2.3-21.2 s, D249/D252) | Session diagnostics on, release build for timing gates, quiet host |
| 4 | Reanimated lost updates in Finalizing/Stepper | **Raised** (FXR-DEV-2, W93-7) | MB-04 at High; Stepper rest-value and selection-glow patterns |
| 5 | Repository growth from real media | **New** (.git 1.5 GB) | OD-25 before the first real recording |
| 6 | Dependency debt before adding capture dependencies | **New** (W99-1) | B2 in M0 |
| 7 | SC8 rule blocks simulator edits | **New** (AC-B-59..62, DR-14) | OD-23 at M0 |
| 8 | `live-sim.ts` closure touched while its split is deferred | **New** (E-02, DR-1) | OD-26; minimal edit or split first |

---

## 6. Errata table (map section/row -> correction)

| # | Map location | Correction |
|---|---|---|
| E-01 | F-14, §5.8, §6 row `alerts, session_history` | Add the third CHECK: `health_snapshots_cause_check` at `apps/core-server/src/db/migrations/0001_tables.sql:488` also lists every fault kind (`health_snapshots.fault_kind`, column at `:474`). Migration 0004 must update three CHECKs, not two |
| E-02 | SH-21 (and SH-17 dependency) | Add `packages/shared/src/live/source/live-sim.ts:902-905` (`onMeters` commits `meters.audio` as `AudioSlice`) — new row SH-25, S / Medium; coordinate with DR-1 (OD-26) |
| E-03 | §1.4 / process blockers (§0 row "Process blockers") | Add this task's SC8 rule (AC-B-59..62 in `masterplan/01_specs.md:1816-1819`, DR-14): simulator additions only, 61 simulator-dependent tests diffed against `acaff20` — must be retired or re-baselined (OD-23) |
| E-04 | CS-15, §5.5 | `AdminResource.DEVICES` (`realtime-messages.ts:156`) is the paired-client registry event; capture devices must use their own slice/kind, never this one |
| E-05 | F-27 | `index.ts:16` means `apps/core-server/src/index.ts:16` (not `packages/shared/src/index.ts`) |
| E-06 | F-32, §7.1 | Baselines: shared 71/1,851; core-server unit 160/3,954; db 124/1,751; core-web 117/1,495; mobile 192/1,988; test files 664 (was 630) |
| E-07 | SH-20 | `examples.ts:267` -> `:268` |
| E-08 | WB-02 | `devices-panel.tsx:23-42` -> `:24-43`; `:260` -> `:258`; the panel now uses `lib/device-command-gate.ts` |
| E-09 | MB-03 | `session-live-screen.tsx:231-256` -> `:236-261`; `use-monitor.ts:148` -> `:165`, `:227` -> `:244`; the timer path (`use-monitor.ts:92-160`) reads `runtime/recording-elapsed.ts` |
| E-10 | CS-14 | `audit-details.ts:1-133` -> `:1-140`; value sets imported from `@dems/shared/api` |
| E-11 | WB-04 | `integrity-tab.tsx:52-286` -> `:52-295`; keep the per-run pinned verdict (W92-10); export download via `lib/download.ts`; media query gated on `useCoreSignedIn` |
| E-12 | F-18, CS-06 | `DEVICE_COMMAND_OF_OPERATION` is derived from the contract (`operations.ts:42-52`); a new device command is a contract entry |
| E-13 | MB-04, MB-05, MB-06 | Use the in-place hand-offs (`monitor-handoff.ts`, `summary-handoff.ts`) and `animation: 'none'` routes (`navigation/stacks.tsx:59`, route `summary/[sessionId]`); progress forward-only, from Core instants via `coreClockOf`; MB-04 risk -> High; MB-04 file sizes 441 -> 464 lines (screen) |
| E-14 | MB-01 | Fold in B15 (tablet Home mic tiles 'No signal' while recording) and RC-1 (`recording-elapsed.ts:129`); risk Low -> Low-Medium |
| E-15 | MB-08, MB-09, MB-12 | New tablet list rows use `components/composed/selection-glow.tsx` with a constant border |
| E-16 | MB-03, MB-08, MB-09, WB-01, WB-05 | New gated controls follow "Checking your permissions..." (W93-11, DEC-FXR-M-3) and the web "waits for the link" rule (DN-W) |
| E-17 | §3.3 (new row WB-11) | Query factories for capture config, capture devices, transcript, export job in `apps/core-web/src/lib/core-queries.ts` (S / Low) |
| E-18 | §3.2 (new row CS-25) | Capture constants in `@dems/shared/api`; extend `apps/core-server/src/modules/__tests__/contract-values.test.ts` (S / Low) |
| E-19 | CS-17 | "applied on 4 live databases (4420-4423)" -> `dems_demo` only; lanes recreated fresh; risk High -> Medium |
| E-20 | §5.9 OD-02 L2 "Risk" | "DB reseed/reset on all four databases" and "live sessions recorded on the lanes are lost" -> one database (`dems_demo`); lanes no longer exist |
| E-21 | G-1 (§1.4) | "no model was downloaded" -> Whisper large-v3-turbo is on disk (`~/.omlx/models/whisper-large-v3-turbo`, HF format, 1.5 GB; MLX copy excluded) (D229) |
| E-22 | R-7, §8.1 M1, M6, M9, NM-13, §7.3 "STT benchmark harness" | Per D230: no benchmark on this Mac; M1 = spikes + CPU STT runtime install with approval; M6 = functional check (+ no dropped fragment while STT runs); benchmark and NM-13 on the real Core device |
| E-23 | §7.3 all layers, §9 clock-drift mitigation | 2 + 1 per check (D232/D233); the 1-2 h AV-drift run and repeated kill loops only at handover or on the user's request; no biometric device steps (D231) |
| E-24 | §7.3 "Contract / DB", "Device e2e" | Lane re-creation (db:create/migrate/seed per lane), per-lane pairing, pairing recordings only after redeem returns (D258) |
| E-25 | §8.2 OD-20 | Partly answered by D229/D230 (see §3.4) |
| E-26 | §8.2 OD-13 | Add preconditions: demo password replaced (report C9 i), W99-2/W99-3 hardening (D248) |
| E-27 | §8.2 (new) | Add OD-22..OD-26 (§3.4) |
| E-28 | §8.1 M0 | Add backlog rows: B2 dependency refresh (before new dependencies), B10 wall-clock tests, B11 RF2-2 wait point, B16 database-contract errata (with DOC-03) |
| E-29 | §8.1 M9 | If the next task leads to handover, host A1-A6 (release-build revoke-to-Pair, timer lag on release, biometric if the user wants, long campaigns) (D250) |
| E-30 | §5.4 audit types | Credential refusals of camera credentials write an audit row (W99-4 lesson); `AUDIO_SOURCE_SWITCHED` carries the sending device ID (B15 observation) |
| E-31 | §9 risk "Mobile streaming of large files" | If the fallback "short-lived signed URL" is chosen, add its prefix to the web error sink and mobile `runtime/log.ts` blanking (P-07) |

---

## 7. Evidence log (read-only commands)

| Purpose | Command (abridged) | Result |
|---|---|---|
| Files changed after the map | `find apps packages scripts -newermt '2026-10-06 17:48'` (node_modules, build output excluded) | 235 files; none under `packages/shared/src/sim`; no `app.ts`/`config.ts`/`src/index.ts` |
| Pre-edit copies | `.cache/rollback/{CF2-A,CF2-B,C3,FXR-S,FXR-W,FXR-M,T1,T2,PT}` and their `NEW_FILES`/`created` lists | Line mapping in §1.3-§1.5 |
| Reference extraction and mapping | Python over map lines 81-431 + `git ls-files` + `difflib.SequenceMatcher` per changed file | §1.2 counts |
| F-01 re-check | `/usr/bin/grep -rliE "rtsp\|onvif\|child_process\|spawn\(\|ffmpeg\|gstreamer\|whisper" apps/core-server/src` minus `__tests__` | 0 files |
| FAULT_KIND CHECKs | `grep -n fault_kind 0001_tables.sql` | `:281`, `:382`, `:488` (E-01) |
| live-sim meters | `grep -n meters packages/shared/src/live/source/live-sim.ts` | `:902-905` (E-02) |
| Graft | `graft callers useRecordingElapsedSeconds -d all`; `graft callers useRecordingTickerSeconds`; `graft callers coreClockOf` | P-01 call sites |
| Test counts | `find ... -name '*.test.ts*'` (664) + `/usr/bin/grep -lE` per reconstructed pattern | §2.3 |
| Host | `lsof -nP -iTCP -sTCP:LISTEN`; `du -sh`; `which`; python `find_spec`; `git diff 057fc17 HEAD -- .gitignore` | §4 (`ps` blocked by the sandbox) |
| Decisions | `decisions/decisions.md:225-265` (D219-D259); `report/report.md` §3-§5; `report/01_report_inputs.md` §4 | §3 |

Not done (by rule): no server, emulator or test suite started; no database queried; `README.md` and `packages/shared/src/sim/dataset.ts` were not searched for credential lines; the impact map was not edited.

---
*Generated: 2026-10-07 12:40 WIB*
*Last Updated: 2026-10-07 12:40 WIB*
