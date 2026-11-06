# src/components/composed

Up: [src/components](../README.md)

## Purpose

The custom compositions of the console: the parts that are neither kit components nor page code (the barrel `index.ts` names them "the only non-kit UI besides the AppShell"). Each visual component has a pure `.math.ts` sibling with its layout and number rules, so the maths is tested without rendering.

## Files

| File | Role |
|---|---|
| [`__tests__/`](__tests__/) | Unit tests of the compositions and a shared test helper |
| [`audio-source-band.math.ts`](audio-source-band.math.ts) | Pure layout of the audio-source band: segments and positions of input intervals in media time (ms from the start of the recording); `formatMediaMs` |
| [`audio-source-band.tsx`](audio-source-band.tsx) | `AudioSourceBand`: one colour per input (`MIC-NN` ids sent by the Core, coloured by position) over a recording, read from operation 82 data |
| [`dbfs-meter.math.ts`](dbfs-meter.math.ts) | Pure maths of the dBFS meter: thresholds, segment tone, colour and opacity, lit segments, peak position, value formatting, frame gate |
| [`dbfs-meter.tsx`](dbfs-meter.tsx) | `DbfsMeter`: vertical or horizontal level meter with clip flash, NO SIGNAL fade and a clip reset control |
| [`glow-ring.math.ts`](glow-ring.math.ts) | Pure maths of the SYSTEM READY ring: states and their rank, escalation test, radii, ticks, colours, arc and circle paths |
| [`glow-ring.tsx`](glow-ring.tsx) | `GlowRing`: the system state ring in hero, login and mini sizes |
| [`index.ts`](index.ts) | Barrel export of every composition and its public maths |
| [`session-timeline.math.ts`](session-timeline.math.ts) | Pure node style of a timeline event (`timelineNodeStyle`) |
| [`session-timeline.tsx`](session-timeline.tsx) | `SessionTimeline`: the session's event timeline with line and text reveal, pausing auto-scroll while the user scrolls |
| [`stepper.tsx`](stepper.tsx) | `Stepper` and `StepperStamp`: a step list with connector fill, check draw and a final stamp |

## Main exports

| Export | Used by |
|---|---|
| `GlowRing`, `GlowRingState` | [dashboard](../../features/dashboard/) (system ring panel), [login](../../features/login/), [session-new](../../features/session-new/), [session-monitor](../../features/session-monitor/) (live feed panel) |
| `DbfsMeter`, `formatDbfsValue`, `METER_THRESHOLDS` | dashboard (devices panel), [devices](../../features/devices/) (audio input card), session-monitor (inputs and audio panels), session-new |
| `Stepper`, `StepperStamp` | [evidence](../../features/evidence/), [security-audit](../../features/security-audit/), session-new, [system](../../features/system/), session-monitor (finalization modal) |
| `SessionTimeline` | session-monitor (timeline panel) |
| `AudioSourceBand`, `audioSourceBandSegments`, `formatMediaMs` | evidence, session-monitor (audio-source controls) |

## Core operations, state and shared modules

- `dbfs-meter.tsx` resets a microphone clip through `actions.resetClip` of `@dems/shared/live`: a simulator action in Simulated mode, operation 52 `resetMicClip` in Live mode. A failure is worded by `src/lib/core-errors`.
- `audio-source-band.*` lays out the audio-source intervals of operation 82.
- Shared package modules: `@dems/shared/tokens` (colours, all files), `@dems/shared/brand` (glow ring), `@dems/shared/sim` and `@dems/shared/realtime` (timeline, meter), `@dems/shared/domain` and `@dems/shared/live` (meter).
- Console modules: [src/motion](../../motion/) (motion policy), [media](../media/README.md) (`RecIndicator` inside the glow ring), [ui](../ui/README.md) (`TextEffect`), `src/lib/utils`, `src/runtime`.

## Tests

- [`__tests__/`](__tests__/): `dbfs-meter.test.tsx`, `glow-ring.test.tsx`, `glow-ring-fit.test.tsx`, `session-timeline.test.tsx`, `stepper.test.tsx`, helper `test-utils.ts`.
- Elsewhere: `features/devices/__tests__/mic-input-name.test.tsx` and `features/session-monitor/__tests__/audio-source.test.tsx` (audio-source band maths); in [src/test](../../test/): `live-session-monitor-panels.test.tsx`, `live-w0-evidence-words.test.tsx`, `live-w0-camera-words.test.tsx`, `visual-audit-45b.test.tsx`.

## Related decisions

None found in decisions.md.
