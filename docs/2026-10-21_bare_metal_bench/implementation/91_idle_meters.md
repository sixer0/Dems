---
task_id: 2026-10-21_bare_metal_bench
task_slug: bare_metal_bench
row: 91c (idle microphone meters, part c; decisions D51/D53; T15)
date: 2026-10-23
agent: coder-execution
source_plan: controller brief (part c of the approved idle-meter plan)
status: complete
---

# Implementation Report: idle microphone meters (part c) and the T15 CLIP-latch reset

## Executed Steps
| Step | Task | Status | Notes |
|---|---|---|---|
| 1 | Claim paths in `delegation_progress/file_claims.md` | complete | lines `row 91c ...` (13 paths) |
| 2 | New Linux table list `linuxMicLevelArguments` + literal `LEVEL_OUTPUT` | complete | `mic-helper-args.ts:311-328`, table `literals` + `levelOutput` |
| 3 | New pure `idle-level.ts` (worker math over 50 ms windows) | complete | constants pinned against `apps/capture-worker/src/audio.c` by test |
| 4 | New `idle-meter.ts` with `createIdleMeters(deps)` | complete | lease, max 2 helpers, production door, re-identification, stopAndWait/resume/close |
| 5 | T15: CLIP latch released at SEALED | complete | `packages/shared/src/sim/session-machine.ts` both seal paths |
| 6 | Narrow static allowlist updates (A-9, production adapter importer pin) | complete | one entry each |
| 7 | Tests + typecheck core-server and shared | complete | see Test Results |

## Changes Made
| File | Change Type | Description |
|---|---|---|
| apps/core-server/src/capture/adapters/audio/idle-level.ts | add | `windowLevel(sumsq, n, peak)` (dbfs = sumsq>0 ? 10*log10(sumsq/n) : -120, clamp -120..0; clipped = peak >= fround(0.999)); `createIdleLevelReader({channelCount, inputs, onWindow, windowFrames?})` over interleaved f32le, 2,400 frames (50 ms @ 48 kHz) per window, chunk cuts carried |
| apps/core-server/src/capture/adapters/audio/idle-meter.ts | add | `createIdleMeters(deps: IdleMetersDeps): IdleMeters` (`:183`), deps `:114`, seam `:144` |
| apps/core-server/src/capture/adapters/local/mic-helper-args.ts | modify | `LEVEL_OUTPUT = ['-vn','-c:a','pcm_f32le','-f','f32le','-flush_packets','1','pipe:1']` (`:318`), `linuxMicLevelArguments(card)` (`:326`) = QUIET + `linuxInputArguments(card)` + LEVEL_OUTPUT; `MIC_LINUX_HELPER_TABLE.literals` includes it, new member `levelOutput` |
| packages/shared/src/sim/session-machine.ts | modify | module-private `releaseClipLatches(mics)` (`:1244`), applied in `seal()` (`:1282`) and `completeSealTransition` (`:1638`); unchanged array when no latch |
| apps/core-server/src/capture/adapters/audio/__tests__/idle-level.test.ts | add | 11 tests |
| apps/core-server/src/capture/adapters/audio/__tests__/idle-meter.test.ts | add | 21 tests |
| apps/core-server/src/capture/adapters/local/__tests__/mic-helper-args.test.ts | modify | +1 case: level list exact words (bench card 1, 4C), same input part as pre-check, no `-af/-progress/-y/-t`, literals only, refusals |
| apps/core-server/src/capture/adapters/local/__tests__/mic-static.test.ts | modify | +1 describe (2 cases): SR-4 argument origin at the one caller `idle-meter.ts` (one table call with 3 integers, one door call verbatim, guard vector, no process/fs/log/timer/time), with planted control |
| apps/core-server/src/capture/adapters/__tests__/static.test.ts | modify | A-9: `audio/idle-meter.ts` added to the allowed importers of `usb-audio-production` (one entry + comment) |
| apps/core-server/src/capture/adapters/audio/__tests__/usb-audio-production.test.ts | modify | importer pin: `idle-meter.ts` added (one entry + comment) |
| packages/shared/test/session-machine.test.ts | modify | +2 T15 cases (simulator seal; Core-driven `completeSealTransition`) |

## The seam (for agent b)
```ts
export function createIdleMeters(deps: IdleMetersDeps): IdleMeters;
export interface IdleMeters {
  hold(operatorId: string): { expiresAt: number };
  stopAndWait(): Promise<void>;
  resume(): void;
  close(): Promise<void>;
}
export interface IdleMetersDeps {
  readonly selection: () => Promise<readonly IdleMeterInput[]>;      // {deviceId: 'MIC-NN', role: 'PRIMARY'|'STANDBY'}
  readonly registered: (deviceId: string) => Promise<RegisteredAudioInput | null>; // the production adapter's reader
  readonly cards: CardEnumerator;
  readonly configWriter: AlsaConfigWriter;                            // the production adapter's writer
  readonly helperProgram: string;
  readonly guardProgram: string;
  readonly runDir: string;
  readonly timers: CaptureTimers;
  readonly now: () => number;
  readonly sessionActive: () => boolean;
  readonly publish: (levels: readonly IdleMeterLevel[]) => void;     // {deviceId, role, dbfs: number, clipped: boolean}
  readonly onNotice?: (notice: IdleMeterNotice) => void;             // {code, deviceId|null, detail word} - wire to the durable log
  readonly door?: ProductionDoor;                                     // default startProductionProcess
  readonly inspect?: ProgramInspector;
  readonly limits?: Partial<IdleMeterLimits>;                         // stopGraceMs 3000, killGraceMs 2000
}
```
Constants: `IDLE_METER_LEASE_MS = 30_000`, `IDLE_METER_HELPERS_MAX = 2`.

## Test Results
| Test Type | Command | Result | Notes |
|---|---|---|---|
| unit (new) | `npm test -w @dems/core-server -- src/capture/adapters/audio/__tests__/idle-level.test.ts src/capture/adapters/audio/__tests__/idle-meter.test.ts --maxWorkers=2` | `Test Files 2 passed (2)`, `Tests 32 passed (32)` | |
| unit + static | same, plus `local/__tests__/mic-helper-args.test.ts local/__tests__/mic-static.test.ts adapters/__tests__/static.test.ts audio/__tests__/usb-audio-production.test.ts capture/__tests__/static.test.ts` | `Test Files 1 failed | 6 passed (7)`, `Tests 4 failed | 282 passed (286)` | the 4 red are ALL in `src/capture/__tests__/static.test.ts` and caused by files not mine (see Persistent Issues) |
| shared | `npx vitest run test/session-machine.test.ts test/sim-capture-telemetry.test.ts test/sim-faults-scenarios.test.ts test/sim-gap-closure.test.ts test/audio.test.ts test/sim-core-driven-seal.test.ts test/sim-capture-fault.test.ts --maxWorkers=2` | all files green (session-machine re-run after a test fix: `Tests 30 passed (30)`) | |
| control | T15 tests with `mics: releaseClipLatches(state.mics)` temporarily replaced by `mics: state.mics` | `Tests 2 failed` | fix restored; `grep -c releaseClipLatches` = 3 |
| typecheck | `flock .data/locks/heavy-host.lock npm run typecheck -w @dems/shared` | exit 0, 0 `error TS` | after one fix in my test (CompleteSealInput type) |
| typecheck | `NODE_OPTIONS=--max-old-space-size=6144 flock .data/locks/heavy-host.lock npm run typecheck -w @dems/core-server` | exit 0, 0 `error TS` | |

No `*.db.test.ts` was run; PostgreSQL was not started.

## Verification
- Same math as the worker: `idle-level.test.ts` reads `audio.c` and pins `10.0 * log10(m->sumsq / m->n_meter) : -120.0`, `if (db < -120.0) db = -120.0;`, `if (db > 0) db = 0;`, `m->peak >= 0.999f`, `sumsq += (double)v * v;`, `fabsf(v) > m->peak` (with a planted control).
- Known vectors: square full scale 0 dBFS + clip, half scale -6.0206, unit sine -3.0103, 0.1 -20; silence and below-floor -120; NaN/Inf counted as silence; chunk cut every 3 bytes yields identical windows.
- Lease 30 s, renew moves it, expiry stops the helper by end of input; two operators; bad id takes no lease.
- One helper per card (PRIMARY+STANDBY on the bench card = one helper, input 1 -> MIC-03 PRIMARY, input 2 -> MIC-04 STANDBY, inputs 3/4 not published); two cards = two helpers; 3 cards / TERTIARY role -> max 2, only PRIMARY/STANDBY.
- Door call: `command = guard`, `args = [helper, ...linuxMicLevelArguments(card)]`, `env = { ALSA_CONFIG_PATH: <runDir>/alsa/dems-alsa.conf }`, `message: null`; config text equals `alsaConfigText([sharedCaptureOfCard(card, 48000)])` (same entry/IPC key as a session).
- Re-identification via `identifyRegisteredCard` (moved index read at new index; another serial = `AUDIO_CARD_CHANGED`, absent = `AUDIO_CARD_ABSENT`, no door call, no write, no retry timer; next hold re-lists).
- `stopAndWait` resolves only after the helper ended (end of input, SIGTERM at 3 s, SIGKILL at 5 s), waits for a start in flight which then starts nothing; `resume` restarts only with a lease; `sessionActive()` blocks start and publish; selector move replaces the helper; `close` is final.
- T15: latch on AUDIO-02 survives STOPPING/FINALIZING, gone at SEALED (both seal paths), next pre-check has MIC items and none `CLIP`.

## Persistent Issues
| Issue | Attempts | Root Cause | Current Status | Blocking? |
|---|---|---|---|---|
| 4 red cases in `apps/core-server/src/capture/__tests__/static.test.ts` (SR-5 entry 2: extra caller `src/lcd/bridge.ts 1`; P25 config.ts; G-R16: `src/lcd/index.ts compares the capture mode itself`; row 157/AD-08: `src/config.ts names the key DEMS_LCD_BACKEND_URL`) | 0 (not mine, rule 8) | untracked `apps/core-server/src/lcd/` and the `DEMS_LCD_BACKEND_URL` key in `src/config.ts` of another row | open, reported | no for this row |

## Issues & Decisions
| Step | Issue / Decision | Resolution |
|---|---|---|
| 4 | `idle-meter.ts` must import `identifyRegisteredCard`, `isRegisteredAudioInput`, `guardedArguments` from `usb-audio-production.ts`, which rule A-9 and the adapter's own importer pin forbid | narrow allowlist entry in both tests (as the brief allows); the alternative (handing the match in) would force `capture-composition.ts` itself to import the adapter, which A-9 also forbids |
| 4 | Each `hold` re-reads selection + stored rows + one card listing (so a missing card is retried "at the next hold"); a running helper with the same card/inputs signature is kept, a changed one is replaced | by design; cost = one listing per hold |
| 4 | A missing/changed card publishes nothing (the meter's hold timeout shows NO SIGNAL) rather than `dbfs: null` | matches "no level"; agent b may publish null if it wants an immediate NO SIGNAL |
| 4 | The unit does not log (capture-folder convention, as `usb-audio-production.ts`); failures go to `onNotice` as code + detail word | agent b must wire `onNotice` to the durable error log |
| 4 | `sessionActive` is a required dep; if it throws, a session is assumed active (never read beside one) | fail-safe |
| 4 | The config file is shared with the production adapter's writer; there is no cross-writer lock, ordering relies on `stopAndWait` before session CREATE/pre-check (which awaits an in-flight write) | stated in the file header |
| 5 | T15 placed in `session-machine.ts` (not `devices.ts`/i18n, which are agent b's); helper kept module-private (no new sim export) | |

## Next Steps
- Agent b: wire `createIdleMeters` into `capture-composition.ts` (deps above), the lease route to `hold`, `publish` to `applyCaptureTelemetry`, `onNotice` to the durable log; call `stopAndWait` on session CREATE and before the pre-check, `resume` after SEALED, `close` at shutdown.
- UNVERIFIED: not run against the real HANMUS BOMGE (ALSA card 1, 4 x S32_LE @ 48 kHz) - the pinned FFmpeg reading the shared dsnoop to `pipe:1` and coexisting with a later session open of the same card is a hardware check. Review recommended (scope: idle-meter.ts, the two allowlist edits).
