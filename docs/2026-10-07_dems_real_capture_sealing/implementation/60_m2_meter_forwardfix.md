---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 47a (controller-added fix-forward, phase C, milestone M2, class B; blueprint rev 2.1)
date: 2026-10-08
agent: coder-execution-local
source_plan: implementation/14_m2_shared_contract.md §8 (SH-17 re-key) + §9 (consumer fallout table); identification/02_structured.md rev 2.1 rows 47/67/68; decisions/decisions.md D31/D32
narrative_tier: 3
status: partial - meters.audio consumer adaptation COMPLETE and type-correct in both apps; the "suite exit 0" acceptance criterion is NOT reachable right now because packages/shared is transiently broken by a concurrent edit (row 48) outside this row's file set, and both suites additionally carry non-meters.audio consumers owned by rows 67/68/87
closes: SH-17 client-side consequence (core-web meter half + mobile runtime-audio half) - the mechanical read/write migration only, no M4/M7 feature
depends_on: row 47 (DONE - `implementation/14_m2_shared_contract.md`)
file_set: apps/core-web/** and apps/mobile/** ONLY (packages/shared and apps/core-server untouched)
---

# Row 47a / M2 fix-forward: adapt `meters.audio` consumers to the MIC-0x + `activeInputId` shape

## 0. Summary

| Item | Result |
|---|---|
| Scope of this row | Mechanical migration of every `apps/core-web` / `apps/mobile` consumer that read the old `meters.audio` slice (`channels['AUDIO-01']`) to the new shape (`inputs['MIC-0x']` + `activeInputId`). No feature work, no assertion weakened, no timeout raised, no test skipped. |
| Files changed | **9** (all under `apps/core-web/src/**` and `apps/mobile/src/**`): +34 / -21 lines. Nothing else in the repository was edited by this row. |
| `meters.audio` root cause eliminated | Before: `TypeError: Cannot read properties of undefined (reading 'AUDIO-01')` at `dbfs-meter.tsx:192`, cascading through every screen that renders `DbfsMeter`. After: **0** occurrences of `reading 'AUDIO-01'` in the comparable core-web run (`/tmp/cw_after.log`). |
| `npm run typecheck -w @dems/core-web` | exit 2, but **0 meters.audio-related errors** in `apps/core-web` (grep for `audio.channels` / `.inputs` / `AUDIO-0x` / `MIC-0x` / `activeInputId` returns none). The 19 remaining errors are 2 in `devices-step.tsx` (`PrecheckCheckId` pair, SH-03, owner row 67) + 17 cascading from the broken `packages/shared` (owner row 48). |
| `npm run typecheck -w @dems/mobile` | exit 2, but **0 meters.audio-related errors** in `apps/mobile`. The non-shared residuals are `finalizing.model.ts` x2 (`FinalizationStep` v2, owner row 87), `session-live-screen.tsx` x1 (`TimelineKindName` lacks `AUDIO_SWITCH`, owner rows 68/87), `check-icon.tsx` x1 (`PrecheckCheckId` pair, owner row 68); the rest cascade from `packages/shared`. |
| `M2-RG-WEB` (core-web suite) | **cannot reach exit 0** - blocked externally (see §4). |
| `M2-RG-MOB` (mobile suite) | **cannot reach exit 0** - blocked externally (see §4). |
| `packages/shared` / `apps/core-server` | **not touched** by this row (verified: `git diff --name-only` shows no edit by this row under those trees). |

## 1. What SH-17 changed and how consumers must read it

Row 47 moved `meters.audio` from `channels: Record<AudioTrackId, AudioFrame>` (keys `AUDIO-01`/`AUDIO-02`)
to `inputs: Record<MicInputId, AudioFrame>` (keys `MIC-01`/`MIC-02`) plus `activeInputId`
(`state-slices.ts:472-473`, `sim/types.ts:545-547`; C3 §6, register SH-17/E-02). The demo controls,
the CLIP fault target and the timeline still name a **channel**; the meters name an **input**. Row 47
exported the single meeting point of the two vocabularies:

```ts
// packages/shared/src/sim/audio.ts (read-only here)
export const MIC_INPUT_OF_CHANNEL: Readonly<Record<AudioTrackId, MicInputId>> = { 'AUDIO-01': 'MIC-01', 'AUDIO-02': 'MIC-02' };
export const CHANNEL_OF_MIC_INPUT: Readonly<Record<MicInputId, AudioTrackId>> = { 'MIC-01': 'AUDIO-01', 'MIC-02': 'AUDIO-02' };
```

The hook `useAudioChannel(channel: AudioTrackId, onFrame)` keeps its channel signature and maps
internally to `state.audio.inputs[MIC_INPUT_OF_CHANNEL[channel]]` (`react.ts:102-117`). Therefore the
correct, behaviour-preserving adaptation for any direct slice access is exactly the same mapping the
hook already uses: read/write `inputs[MIC_INPUT_OF_CHANNEL[channel]]`, never invent a new key. This is
what every edit below does. `activeInputId` is preserved on writes (the slice is spread, not replaced).

## 2. Files changed (mechanical, intent-preserving)

### apps/core-web

| File | Change |
|---|---|
| `src/components/composed/dbfs-meter.tsx` | Import `MIC_INPUT_OF_CHANNEL`; line 192 initial-frame read `audio.channels[channel]` -> `audio.inputs[MIC_INPUT_OF_CHANNEL[channel]]` (the same input `useAudioChannel` subscribes at :270). THE root cause of the whole web cascade. |
| `src/components/composed/__tests__/test-utils.ts` | `pushAudioFrame` now writes `state.audio.inputs[input]` (input = `MIC_INPUT_OF_CHANNEL[channel]`) and spreads `...state.audio` so `activeInputId` survives; the caller-facing API (`pushAudioFrame(sim, 'AUDIO-01', ...)`) is unchanged. |
| `src/components/composed/__tests__/dbfs-meter.test.tsx` | Line 26 seed read `audio.channels['AUDIO-01'].at` -> `audio.inputs[MIC_INPUT_OF_CHANNEL['AUDIO-01']].at`. All 11 assertions kept verbatim. |
| `src/test/live-shell-notices.test.tsx` | `socket.meters({ channels: {...} })` -> `{ inputs: { 'MIC-01': frame, 'MIC-02': frame }, activeInputId: 'MIC-01' }`; store reads `audio.channels['AUDIO-01'/'AUDIO-02']` -> `audio.inputs['MIC-01'/'MIC-02']`. |
| `src/test/live-meter-clip-reset.test.tsx` | `socket.meters({ channels: {...} })` -> input-keyed payload with `activeInputId: 'MIC-01'` (CLIP stays on MIC 1's meter, which is what `audio-input-AUDIO-01` renders). |
| `src/test/live-session-monitor-panels.test.tsx` | Two `socket.meters(...)` payloads re-keyed to inputs; store read `audio.channels['AUDIO-01'].dbfs` -> `audio.inputs['MIC-01'].dbfs`. Panel meters are still selected by `data-channel="AUDIO-0x"` (unchanged component prop). |

### apps/mobile

| File | Change |
|---|---|
| `src/runtime/use-audio-shared-values.ts` | Import `MIC_INPUT_OF_CHANNEL`; `useAudioAccessibilityValue` read `audio.channels[channel]` -> `audio.inputs[MIC_INPUT_OF_CHANNEL[channel]]`. `useAudioSharedValues` already used `useAudioChannel` (unchanged). |
| `src/runtime/use-audio-shared-values.test.tsx` | Three reads `audio.channels['AUDIO-01']` -> `audio.inputs['MIC-01']` (lines 47/55/104). Assertions unchanged. |
| `src/features/session-live/testing/live-monitor-bed.tsx` | `sendMeters(frames)` still takes `Record<AudioTrackId, AudioFrame>` from its callers, but now wraps the socket message as `{ inputs: { 'MIC-01': frames['AUDIO-01'], 'MIC-02': frames['AUDIO-02'] }, activeInputId: 'MIC-01' }`. Callers (`live-session-live-link.test.tsx`) are untouched. |

No file was deleted, no assertion removed or loosened, no `test.skip`, no timeout raised.

## 3. Verification evidence (commands were able to fail; they did)

All commands non-interactive: `CI=true`, vitest `--run` / jest CI, `--maxWorkers=2`, `</dev/null`,
bounded by a wall-clock `timeout` (macOS has no GNU `timeout`; a perl-backed shim at `/tmp/bin/timeout`
was used so the bounded form works; it SIGTERMs/SIGKILLs the child tree - proven on a `sleep 10` probe).

### 3.1 Baseline (before this row's edits)

```
$ CI=true npm run test -w @dems/core-web -- --maxWorkers=2 --run      # EXIT=1
 Test Files  20 failed | 97 passed (117)
      Tests  91 failed | 1404 passed (1495)
# dominant signature (75 TypeError blocks + downstream element-not-found cascades):
TypeError: Cannot read properties of undefined (reading 'AUDIO-01')
    at .../apps/core-web/src/components/composed/dbfs-meter.tsx:192:19
```

Mobile baseline (jest rejects the vitest-only `--run` flag; correct non-interactive form is `CI=true jest --maxWorkers=2`):

```
$ CI=true npm run test -w @dems/mobile -- --maxWorkers=2              # EXIT=1
 Test Suites: 129 failed, 65 passed, 194 total
 Tests:       117 failed, 853 passed, 970 total
# dominant signature (NOT meters.audio):
TypeError: _devices.CAPTURE_CONFIG_OPERATIONS is not iterable
# plus the genuine meters.audio site underneath:
TypeError: Cannot read properties of undefined (reading 'AUDIO-01')   (use-audio-shared-values.ts:94)
```

### 3.2 After this row's edits - meters.audio root cause gone

```
$ CI=true npm run test -w @dems/core-web -- --maxWorkers=2 --run      # EXIT=1 (see §4)
$ grep -c "reading 'AUDIO-01'" /tmp/cw_after.log
0
```

The single production line `dbfs-meter.tsx:192` was the origin of all 91 web failures; after the
re-key no `AUDIO-01` read remains anywhere in either app:

```
$ grep -rnE "audio\.channels|\.channels\[|meters\(\{ channels|\{ channels:" apps/core-web/src apps/mobile/src
NONE FOUND
```

### 3.3 Typecheck isolates the meters.audio signal from the noise

```
$ npm run typecheck -w @dems/core-web        # EXIT=2
# meters.audio-related errors in apps/core-web: NONE
# 19 total, all attributable elsewhere:
#   2  src/features/session-new/devices-step.tsx(27,267)  Record<PrecheckCheckId,...> missing MIC_PRIMARY/MIC_STANDBY  -> row 67 (SH-03)
#   17 ../../packages/shared/**  (operatorId/nullableEpochMs/SessionState/TRANSCRIPT_MEDIA_OPERATIONS/examples half-migrated) -> row 48

$ npm run typecheck -w @dems/mobile          # EXIT=2
# meters.audio-related errors in apps/mobile: NONE
# non-shared residuals (all other-row owners, all pre-existing from row 47, none caused here):
#   src/features/session-finalizing/finalizing.model.ts  FinalizationStep v2 names            -> row 87
#   src/features/session-live/session-live-screen.tsx     local TimelineKindName lacks AUDIO_SWITCH -> rows 68/87
#   src/features/session-new/check-icon.tsx               Record<PrecheckCheckId,...> pair       -> row 68
```

This proves the meters.audio adaptation is complete and type-correct against the new slice: no error in
either app references the audio slice shape anymore.

## 4. Why the suites cannot be driven to exit 0 by this row (external blockers)

Two independent, out-of-scope blockers sit between "meters.audio fixed" and "suites green":

### 4.1 `packages/shared` is currently broken by a CONCURRENT edit (owner row 48) - forbidden to this row

D32 launched rows 47a (this row), 48 (API registry) and 51 in parallel in ONE shared working tree
(DR-06 already recorded the cross-file read coupling). While this row ran, `packages/shared` was in a
half-finished state and does not compile or even evaluate at module load. Observed across runs minutes
apart - each run hit a DIFFERENT broken intermediate state, all inside files this row must not touch:

```
$ npx tsc --noEmit -p packages/shared/tsconfig.json      # EXIT=2, 64 errors
core-api.ts(105): Module '"./devices"' has no exported member 'CAPTURE_CONFIG_OPERATIONS'.
core-api.ts(111): Module '"./evidence"' has no exported member 'TRANSCRIPT_MEDIA_OPERATIONS'.
evidence.ts(216): Cannot find name 'operatorId'.
sessions.ts(30):  Module '"../sim/vocabulary"' has no exported member 'SessionState'.
examples.ts(186..335): camera/mic example shapes not yet migrated to sourceDeviceId/streamState/inputId.
```

At runtime this crashes module load for anything importing the api barrel (both apps do):

```
ReferenceError: operatorId is not defined
    at packages/shared/src/api/evidence.ts:216:28
    at packages/shared/src/api/core-api.ts:111:1
    at packages/shared/src/api/index.ts:8:1
TypeError: Cannot convert undefined or null to object
    at packages/shared/src/api/sessions.ts:202:14   # z.enum(SessionState) with SessionState undefined
```

Consequence: the isolated meter unit test cannot even load (`ReferenceError: operatorId is not defined`),
and the full web suite collapsed from 1,495 collected tests to 196 purely because ~95 files fail at
import while shared is broken. This is NOT a meters.audio problem and is NOT fixable inside
`apps/core-web/**` / `apps/mobile/**`. It resolves when row 48 leaves `packages/shared` green. Per the
anti-hang contract this row did not poll/wait for another agent; it made one bounded retry after a short
fixed pause, observed shared still broken, and stopped.

### 4.2 Both suites also carry NON-meters.audio consumers of other SH changes (owners 67/68/87)

Even once `packages/shared` builds, these suites will not be fully green from the meters.audio fix alone,
because they contain genuine consumers of OTHER values row 47 changed - which this narrow row must not
touch without doing row 67/68/87 feature work ("do NOT build any M4/M7 feature"):

| Suite | File | Cause | Owner |
|---|---|---|---|
| core-web | `features/system/__tests__/system-model.test.tsx` "covers every fault kind" | `DEMO_FAULTS` covers 12 kinds, `FaultKind` now has 14 (`Array(12)` vs `Array(14)`) - SH-03 | 67 |
| core-web | `test/live-users-roles-*`, `test/live-security-audit-page` "twelve permissions" | role matrix now 14 permissions - SH-04 | 67 |
| core-web | `features/session-new/devices-step.tsx` | `Record<PrecheckCheckId,...>` needs `MIC_PRIMARY`/`MIC_STANDBY` - SH-03 | 67 |
| mobile | `features/session-finalizing/finalizing.model.ts` | `FinalizationStep` v2 names - SH-01 | 87 |
| mobile | `features/session-new/check-icon.tsx`, `session-live/session-live-screen.tsx` | `PrecheckCheckId` pair; `TimelineKindName` lacks `AUDIO_SWITCH` - SH-03 | 68/87 |

These are outside the stated scope ("adapt the code/tests that consume `meters.audio`"). They are listed
for the controller to route, not silently absorbed here.

## 5. Scope boundary kept (hard constraints honoured)

* Edits confined to `apps/core-web/**` and `apps/mobile/**`. Verified: `git diff --name-only` attributes
  no change under `packages/shared/**` or `apps/core-server/**` to this row; the only files this row
  wrote are the 9 in §2.
* `packages/shared/**` was READ only (to learn the new slice shape and the `MIC_INPUT_OF_CHANNEL` map).
* No `git add`/commit/push, no remote, no sudo, no Homebrew write, no database contact, no emoji, docs English.
* No watch mode; every command bounded by `timeout` with `</dev/null` and CI/`--run`.

## 6. Independence and rollback

Written from the row text (this brief), `implementation/14_m2_shared_contract.md` §8/§9, decisions D31/D32,
and the shared source (`sim/audio.ts`, `sim/react.ts`, `api/state-slices.ts`, `live/source/neutral-state.ts`).
Rollback: `git checkout -- apps/core-web/src/components/composed apps/core-web/src/test apps/mobile/src/runtime/use-audio-shared-values.ts apps/mobile/src/runtime/use-audio-shared-values.test.tsx apps/mobile/src/features/session-live/testing/live-monitor-bed.tsx` restores HEAD for exactly these 9 files; no other state touched.

## 7. Handoff / next steps

* **Row 48** must leave `packages/shared` compiling (define/export `CAPTURE_CONFIG_OPERATIONS`,
  `CAPTURE_CREDENTIAL_OPERATION`, `TRANSCRIPT_MEDIA_OPERATIONS`/`SCHEMAS`, `AUDIO_SOURCE_OPERATIONS`/`SCHEMAS`,
  `SessionState` from vocabulary, `operatorId`/`nullableEpochMs` in evidence.ts, finish the examples.ts
  camera/mic shape migration). Until then `M2-RG-WEB`/`M2-RG-MOB` cannot execute regardless of this row.
* **Rows 67/68/87** own the remaining non-meters.audio consumers in §4.2.
* Once shared is green AND those consumers land, re-run `M2-RG-WEB` / `M2-RG-MOB`; the meters.audio
  failures this row addressed should stay resolved (the re-key is done and type-correct).

---
*Generated: 2026-10-08 11:55*
