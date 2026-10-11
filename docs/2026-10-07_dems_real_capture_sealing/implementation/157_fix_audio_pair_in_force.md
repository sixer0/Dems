---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: fix wave L, fix 157 - the audio pair in force (packages/shared, apps/core-web, apps/mobile)
date: 2026-10-11
agent: coder-execution
narrative_tier: 2
tree: commit b05106b + fix 151 + wave L (L-S, L-W, L-M, L-Z) in the same working tree; no git write by me
source: implementation/156_fix_wave_l_z.md (item 1, "Open items" first bullet); delegation_progress/fix_brief_wave_k.md "Rules"
status: needs-review
---

# 157 - The audio pair in force

No device, no browser, no lane call, no git write, no install, no migration, no formatter `--write`.
Totals 97 / 36 / 61 / 67 and schema 6 unmoved; no contract member added; OpenAPI not touched. Logs of
the runs: `.cache/gates/fix-157/` (git-ignored).

**Status needs-review** for decisions 1-3 of section 6 (one of them moves three pinned assertions)
and because nothing here was driven on a device or in a browser.

## 1. Cause

`session.audioSource` (which input is active inside `AUDIO-01`, which is the hot standby) is a fact
of ONE session. The replicated `session` slice keeps the last session after its seal, with the pair
that session ended on. The readers took `state.session?.audioSource?.activeInputId` /
`.standbyInputId` whatever the session's state, so after a sealed session and a change of the
selector's microphones they named the old inputs. Same class as G70c-01 (`session.captureConfig`,
note 156 item 1), another member.

## 2. Rule and helper

Added to the ONE helper `packages/shared/src/sim/selector-in-force.ts` (no second helper; exported
through `@dems/shared/sim` by the existing `export *`):

| Name | What it is |
|---|---|
| `openSessionAudioSource(session)` | the OPEN session's own audio-source facts (pair and last switch), else `null` |
| `audioPairOfSelector(mics)` | the pair a selector gives: PRIMARY line = active, STANDBY line = standby; without roles by position (the rule of `audioSourceAtStart`) |
| `audioPairInForce(state)` | the pair in force (table below) |

| The `session` slice | `audioPairInForce` |
|---|---|
| an OPEN session that states its pair | that pair |
| an OPEN session that states none (before the recording starts) | both members `null`: the reader keeps what it read before (the meters' `audio.activeInputId`, then the other line of the selector in force) - unchanged behaviour |
| no session, or a SEALED one | the pair of the CURRENT selector |

OPEN is `sessionIsOpen` of the same file (stated and not `SEALED`). The mobile door
`apps/mobile/src/features/capture-selector/selector-in-force.ts` re-exports the three names.

## 3. Readers of `session.audioSource`

Found with `grep -rnE "session\??\.audioSource\b"` over `packages/shared/src`, `apps/core-web/src`,
`apps/mobile/src` (i18n keys of the same name and test files excluded). Line numbers are those
BEFORE this fix.

### Changed

| Reader | Feeds | Now |
|---|---|---|
| `apps/core-web/src/features/session-monitor/audio-source.ts:138` `selectActiveInputId` | Monitor audio panel: `data-active-input`, the Active / Standby chips, the toggle's "from", the silence warning | `audioPairInForce(s).activeInputId ?? s.audio.activeInputId` |
| `apps/core-web/src/features/session-monitor/audio-source.ts:146` `selectStandbyInputId` | the toggle's "Switch to ...", the confirmation | `audioPairInForce(s).standbyInputId`, then the old fallbacks |
| `apps/core-web/src/features/session-monitor/audio-source.ts:191` `switchedAt` of `useAudioSource` | the view's "last switch" | `openSessionAudioSource(s.session)?.switchedAt` - a sealed session's switch time no longer stands beside the selector's pair |
| `apps/core-web/src/features/dashboard/devices-panel.tsx:48` `selectMic` | Dashboard microphone tile chip | through the helper. Was already gated on `RECORDING`: no visible defect, one spelling less |
| `apps/mobile/src/features/session-live/mic-source-model.ts:147` `selectActiveInputId` | `useMicSource` (Session Live toggle, silence warning), `useMicSourceRole` (the mic cards) | as the web |
| `apps/mobile/src/features/session-live/mic-source-model.ts:155` `selectStandbyInputId` | `useMicSource` | as the web |
| `apps/mobile/src/features/dashboard/use-home-data.ts:263` `useDeviceTiles` | Home microphone tiles' role | through the helper. The role is drawn only while recording: no visible defect, one spelling less |

Mobile Session New reads no pair: `session-new-model.ts:241` reads `micLinesInForce` (roles of the
selector lines), already under the rule since L-M.

### Left, with the reason

| Reader | Why left |
|---|---|
| `packages/shared/src/sim/api.ts:781` `audioSourceIntervalsOf` | a fact OF the given session (operation 82, the summary / evidence band), also of a sealed one. Held by a new test: a sealed session's intervals still name MIC-02 / MIC-01, not the selector's MIC-04 |
| `packages/shared/src/sim/session-machine.ts:967` `applyAudioSourceSwitch` | runs only under a RECORDING session (the transition requires it); reads the pair it is about to move |
| `packages/shared/src/sim/api.ts:1655` operation 81's answer | reads the pair the switch has just written, under the same RECORDING session |
| `packages/shared/src/sim/session-machine.ts:747, 784, 794, 975` | WRITERS of the pair (`audioSourceAtStart`, start, switch) |
| `apps/core-web/src/runtime/testing/live-harness.ts:399` | test harness: the model Core answers operation 82 for its own session |
| `apps/mobile/src/features/session-live/testing/live-monitor-bed.tsx:371` | test bed: answers operation 81 with the pair of its session |
| `audioSourceIntervals` readers (web / mobile `features/evidence/{item-v2.ts,audio-source-band.tsx}`, web `core-queries.ts`, `useAudioSourceIntervals` of the Monitor) | the interval list OF a session (sealed evidence, summary, the Monitor's band by operation 82): the session's facts, not the pair in force |

The three left shared lines are pinned by exact text in the static test: a fourth reader fails it.

## 4. Tests

| Test | What it holds |
|---|---|
| `packages/shared/test/sim-wave-l-z-selector-in-force.test.ts` (+7 cases) | order of the defect: session switched to MIC-02, SEALED, then line 1 becomes MIC-04 -> pair MIC-04 / MIC-02, equal to what `audioSourceAtStart` gives the next recording; CONTROL: the same pair in every open state stays MIC-02 / MIC-01; no session; an open session without a pair; `audioPairOfSelector` by role / by position / one line; intervals of the sealed session left; static: no reader of `session.audioSource` outside the helper except the three named; pattern control |
| `apps/core-web/src/test/wave-l-z-selector-in-force.test.tsx` (+5 cases) | COMPONENT: Session Monitor page of a Live Core, sealed session with the old pair -> panel `data-active-input="MIC-04"`, chip of MIC-04 ACTIVE, MIC-02 STANDBY, no chip for MIC-01; CONTROL: same pair, session open -> MIC-02 ACTIVE, MIC-01 STANDBY; the selectors both ways; static + pattern control |
| NEW `apps/mobile/src/features/session-live/fix-157-audio-pair-in-force.test.tsx` (2 cases) | COMPONENT (probe over `useMicSource` + `useMicInputName` + `useMicSourceRole` in the runtime providers): sealed -> active MIC-04 by id and by name, standby MIC-02, MIC-01 named nowhere; CONTROL recording -> MIC-02 / MIC-01, card 1 "STANDBY" |
| `apps/mobile/src/features/capture-selector/wave-l-m-selector-in-force.test.ts` (+1 case) | static: no product file of `apps/mobile/src` reads `session.audioSource` itself; pattern control |

Pins moved by delta (reason written in place; decision 1):

- `apps/core-web/src/test/wave-l-z-selector-in-force.test.tsx` "the standby of the pair ..." - sealed, meters still on MIC-02: was standby `MIC-04`, now active `MIC-04` / standby `MIC-02`.
- `apps/core-web/src/features/devices/__tests__/mic-input-name.test.tsx` and `apps/mobile/src/features/session-live/mic-source-model.test.ts` - no session, selector MIC-03 PRIMARY / MIC-01 STANDBY, meters on MIC-01: was standby `MIC-03`, now active `MIC-03` / standby `MIC-01`.

### Output lines

| Run | Command (in the workspace) | Result |
|---|---|---|
| shared, the touched file + every `test/sim*` file | `npx vitest run test/sim-wave-l-z-selector-in-force.test.ts <the other test/sim*.test.ts>` | `Test Files  43 passed (43)` / `Tests  549 passed (549)` |
| web, first run | `npx vitest run src/test/wave-l-z-selector-in-force.test.tsx src/features/session-monitor src/features/devices` | `Test Files  1 failed \| 30 passed (31)` / `Tests  2 failed \| 268 passed (270)` |
| mobile, first run | `npx jest src/features/dashboard src/features/capture-selector src/features/session-live src/features/session-new` | `Test Suites: 1 failed, 91 passed, 92 total` / `Tests:       1 failed, 707 passed, 708 total` |

The three reds were MINE and one cause: the static pattern of the new cases
(`/session\??\.audioSource\b/`) also matched the i18n key `t('session.audioSource....')`. Test
fixed (`(?<!['"`])` in front: the expression never follows a quote); product unchanged. Second run
of the red files only:

| File | Result |
|---|---|
| shared `test/sim-wave-l-z-selector-in-force.test.ts` | `Test Files  1 passed (1)` / `Tests  16 passed (16)` |
| web `src/test/wave-l-z-selector-in-force.test.tsx` | `Test Files  1 passed (1)` / `Tests  24 passed (24)` |
| mobile `capture-selector/wave-l-m-selector-in-force.test.ts` | `Test Suites: 1 passed, 1 total` / `Tests:       11 passed, 11 total` |

The web and mobile folders were NOT run whole a second time; every other file of them was green in
the first run.

**Fails without the fix (mutation: `openSessionAudioSource` without its `sessionIsOpen` line, then
restored from a copy):**

| File | Result under the mutation |
|---|---|
| shared | `Tests  1 failed \| 15 passed (16)` (the sealed case) |
| web | `Tests  2 failed \| 22 passed (24)` ("the panel names MIC-04 ...", "the selectors of the pair, both ways") |
| mobile `fix-157-...test.tsx` | `Tests:       1 failed, 1 passed, 2 total` (SEALED red, CONTROL green) |

**Typecheck and lint (after the last edit):** `npm run typecheck` of `@dems/shared`,
`apps/core-web`, `apps/mobile`: exit 0 each. `npm run lint` of the three: exit 0; mobile
`0 errors, 1 warning` (`src/runtime/log.test.ts:160`, the known one).

## 5. Files

EDITED (product): `packages/shared/src/sim/selector-in-force.ts`;
`apps/core-web/src/features/session-monitor/audio-source.ts`,
`apps/core-web/src/features/dashboard/devices-panel.tsx`;
`apps/mobile/src/features/capture-selector/selector-in-force.ts`,
`apps/mobile/src/features/session-live/mic-source-model.ts`,
`apps/mobile/src/features/dashboard/use-home-data.ts`.

NEW (test): `apps/mobile/src/features/session-live/fix-157-audio-pair-in-force.test.tsx`.

EDITED (tests): `packages/shared/test/sim-wave-l-z-selector-in-force.test.ts`,
`apps/core-web/src/test/wave-l-z-selector-in-force.test.tsx`,
`apps/core-web/src/features/devices/__tests__/mic-input-name.test.tsx` (delta),
`apps/mobile/src/features/capture-selector/wave-l-m-selector-in-force.test.ts`,
`apps/mobile/src/features/session-live/mic-source-model.test.ts` (delta).

Docs: this note; one line in `delegation_progress/file_claims.md`. Not written: plan table,
`status_tasks.md`, `99_implementation_report.md` (driver rules, as in note 156).

## 6. Decisions for the controller

1. **With no open session the selector's pair goes BEFORE the meters' `audio.activeInputId`.**
   Before, the meters' member was the first fallback and the standby was "the other line". The
   simulator re-keys the meters on a selector change (`capture-config.ts:231`), a Live Core's audio
   slice is not known to; the selector is the stated fact of what the next recording starts with.
   Three pinned assertions moved for it (section 4). Reverting is one line per selector.
2. **An OPEN session that states no pair keeps the old reading** (meters, then the other line of
   the selector in force). A RECORDING session without the member may have been switched; only the
   meters know. This also keeps the pre-recording states (CREATE / PRECHECK / ARMED) as they were.
3. **`switchedAt` of the web Monitor's view is under the rule too** (`null` for a sealed session).
   Nothing draws it today (the band reads operation 82); it would otherwise be a sealed session's
   switch time beside the selector's pair.

## 7. Open items

- Not proven on a device or in a browser. Re-drive (lane 2, after a restart of its Core): record,
  switch to MIC 2, stop and seal; change the first microphone line in the selector; the web Monitor's
  audio panel marks the new input Active and the second line Standby.
- On mobile the pair is DRAWN only while a session records (toggle, chips, Home tile role), so the
  sealed half is held on the hook (`useMicSource`) by a probe, not on a screen.
- `apps/core-server` was not searched (outside the three named trees). Note 156 states its three
  `captureConfig` sites run under RECORDING only; whether it reads `audioSource` of a closed session
  was not checked.
- A Live Core's `audio.activeInputId` after a seal and a selector change is not known here; with
  decision 1 the clients no longer depend on it when no session is open.
- Whole suites belong to the test runner: `npm test -w @dems/shared`, `-w apps/core-web`,
  `-w apps/mobile` (only the folders of the brief were run).

---
*Generated: 2026-10-11*
