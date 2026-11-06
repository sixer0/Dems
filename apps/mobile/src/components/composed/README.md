# `apps/mobile/src/components/composed`

Up: [`src/components/`](../README.md)

## Purpose

The composed components: GlowRing (C-1), DbfsMeter (C-2), SessionTimeline (C-3), Stepper (C-4), the navigation chrome (C-5, in `nav/`) and RollingNumber (C-6), plus the list-row selection glow. Each animated component keeps its maths in a pure `*.math.ts` file that the tests check directly; the animation runs on the UI thread (Reanimated and Skia).

## Contents

| Entry | Role |
|---|---|
| [`nav/`](nav/README.md) | The navigation chrome (C-5): the phone bottom tab bar, the tablet navigation rail, the shared nav item, the travelling indicator and the live mini-bar shown while a session is recording. |
| `dbfs-meter.math.ts` | C-2 DbfsMeter maths. Pure and worklet-safe: the meter evaluates these on the UI thread every frame, and the jest suite tests them directly. |
| `dbfs-meter.test.tsx` | Test: Segment maths; 40 fake audio frames → one meter render. |
| `dbfs-meter.tsx` | C-2 DbfsMeter. Input is UI-thread shared values written by the runtime at 20 Hz. Segment opacity, spring smoothing, peak hold and the 4 Hz readout are worklets and Skia props, so an audio frame causes zero React ... |
| `glow-ring.math.ts` | C-1 GlowRing maths: sizes per mode, ring geometry, the bracket-arc layout, the mount sweep schedule and state tones. Pure; the numeric helpers are worklet-safe. |
| `glow-ring.test.tsx` | Test: C-1 GlowRing: ring sweep maths and the full / reduced motion contract. |
| `glow-ring.tsx` | C-1 GlowRing. Skia layers, all animated on the UI thread: a rotating tick ring, six bracket arcs that trim open (900 ms `luxe`, 120 ms apart), an inner solid ring that sweeps from 12 o'clock with a travelling spark, ... |
| `rolling-number-drawn.test.tsx` | Test: Tests "rollCells: the roll of a React-positioned column". |
| `rolling-number.math.ts` | C-6 RollingNumber maths: deterministic formatting (no `Intl`, H-MB-08), digit extraction for the per-digit columns and the odometer roll plan. Worklet-safe: the columns evaluate these on the UI thread. |
| `rolling-number.test.tsx` | Test: C-6 RollingNumber: deterministic formatting, digit columns and the odometer roll plan. |
| `rolling-number.tsx` | C-6 RollingNumber: slide and roll modes for clocks, timers and counters. |
| `selection-glow.tsx` | The selection glow (e2) of a list row on tablets: Evidence rows, Sessions hub rows, Audit rows and Devices rows. Post-review fix FXR-M moved it from `features/evidence` to the composed kit, since four features use ... |
| `session-timeline.math.ts` | C-3 SessionTimeline maths: ordering, time labels at UTC+07:00 through the shared arithmetic formatter (no `Intl`, H-MB-08), insertion detection and the insertion beat. Pure. |
| `session-timeline.test.tsx` | Test: C-3 SessionTimeline: ordering, UTC+07:00 labels, insertion detection and the rendered rows. |
| `session-timeline.tsx` | C-3 SessionTimeline. RN `View` rail with node dots, kit `Typography`, Reanimated entering and layout transitions. First render: rows fade in with the R1 stagger. Insertion: the previous row's line segment grows ... |
| `stepper-rest-values.test.tsx` | Test: Tests "W93-7: React holds the Stepper rest values (every animation update lost)". |
| `stepper.math.ts` | C-4 Stepper maths: step statuses, connector fills, tones, accessibility labels and the enter stagger. Pure. |
| `stepper.test.tsx` | Test: C-4 Stepper: status derivation, connector fills, labels, and the wizard / pipeline render. |
| `stepper.tsx` | C-4 Stepper. Horizontal wizard or vertical pipeline (finalization, recovery, export, update). |

## Main exports

- Components: `DbfsMeter`, `GlowRing`, `RollingNumber`, `SelectionGlow`, `SessionTimeline`, `Stepper`.

## Tests

7 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

No entry of `decisions.md` (2026-11-05 team update audit) names this folder or its files.
