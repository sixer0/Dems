# src/components

Up: [src](../README.md)

## Purpose

Components shared by more than one page of the web console. The four subfolders hold the application shell, the custom compositions, the media renderers and the copied-in animation primitives. The files at this level are small cross-page rules: how a component version is written, how "the role may not" is shown, and how a demonstration Core or a block without a data source is marked.

## Files

| File | Role |
|---|---|
| [`component-version-text.ts`](component-version-text.ts) | Hook `useComponentVersionText`: writes one component's version by its name and version, or "Not reported" when the Core has not stated it (finding JW-26) |
| [`component-versions.tsx`](component-versions.tsx) | `ComponentVersionRows`: the component versions as definition rows (used on System > About) |
| [`composed/`](composed/README.md) | Custom compositions: glow ring, dBFS meter, stepper, session timeline, audio-source band |
| [`demo-mark.tsx`](demo-mark.tsx) | `DemoMark`: the DEMO (or "DEMO · SIMULATED") chip drawn on a feed, recording state or integrity statement, only on a demonstration Core (finding JW-07) |
| [`demonstration-core.ts`](demonstration-core.ts) | Hook `useDemonstrationCore`: the one rule for "this Core is the demonstration" (hydrated state and `isOwnCaptureCoreState` false) |
| [`media/`](media/README.md) | Media renderers: camera feed with procedural fallback, REC indicator, demo media, decode budget |
| [`role-reason-text.ts`](role-reason-text.ts) | Pure words of the "role may not" rule: `rolesHolding`, `roleReasonText` |
| [`role-reason.tsx`](role-reason.tsx) | `RoleReason`: the visible sentence under a disabled control naming the roles that may use it (finding JW-14) |
| [`shell/`](shell/README.md) | The application shell: layout, top bar, sidebar, navigation, notifications, mode indicator, route motion |
| [`synthetic-values-chip.tsx`](synthetic-values-chip.tsx) | `NoProducerNotice` and `NoProducerGate`: on a Core in its own capture a block without a producer shows "Not reported" in place of simulator values (audit fix row 104, DF-21) |
| [`ui/`](ui/README.md) | Animation primitives copied in from Magic UI and Motion Primitives |

## Main exports

| Export | File | Used by |
|---|---|---|
| `useComponentVersionText` | `component-version-text.ts` | `component-versions.tsx`, [shell](shell/README.md) (sidebar, top bar), [login](../features/login/), [system](../features/system/) |
| `ComponentVersionRows` | `component-versions.tsx` | [system](../features/system/) |
| `DemoMark` | `demo-mark.tsx` | [media](media/README.md), dashboard, devices, network-time, security-audit, session-monitor, session-new, storage, system |
| `useDemonstrationCore` | `demonstration-core.ts` | `demo-mark.tsx`, [shell](shell/README.md) (mode indicator), session-monitor |
| `RoleReason`, `roleReasonText`, `rolesHolding` | `role-reason.tsx`, `role-reason-text.ts` | dashboard, evidence, system, [shell](shell/README.md) (app layout) |
| `NoProducerNotice`, `NoProducerGate` | `synthetic-values-chip.tsx` | devices, network-time, storage, system |

## Core operations, state and shared modules

- Shared package modules: `@dems/shared/sim` (`isOwnCaptureCoreState`, roles) in `demonstration-core.ts`, `role-reason-text.ts`, `role-reason.tsx`.
- Console modules: `src/lib/product-versions` (component versions, which come from operation 64 in the sidebar), `src/lib/own-capture` (own-capture Core test for `NoProducerGate`), `src/lib/utils`. See [src/lib](../lib/).
- No file at this level calls a Core operation itself.

## Tests

- No test file imports the files at this level directly; each subfolder has its own `__tests__/` (see the subfolder READMEs).
- Page-level tests in [src/test](../test/) render pages that use these components.

## Related decisions

- D25 (N3: on a REAL_PRODUCTION Core anything without a real data source shows "Not reported") and D52 (row 104: own-capture Core shows `system.noProducer` "Not reported" in place of model values): `synthetic-values-chip.tsx`.
