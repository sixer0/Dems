---
task: 2026-10-12_input_av_core_adapter_plan
row: 172
milestone: M2 / WP-13a
agent: coder-execution (batch 7, agent R/T/X)
date: 2026-10-13
tier: T3
status: complete
---

# Row 172 - the positional function `micInputOfChannel` is deleted, with a static test that keeps it out

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `SH` = `packages/shared`.

## 1. Before the deletion: no caller left

Search of `apps/` and `packages/` (all file types; `node_modules`, `dist`, `build`, `.expo` excluded) for the name:

| Tree | Non-test files | Test files |
|---|---|---|
| `apps/core-server` | 0 | 0 |
| `apps/core-web` | 0 | 0 |
| `apps/mobile` | 0 | 0 |
| `SH/src` | 1: `sim/audio.ts` (the definition `:84`, two comments `:58`, `:107`) | - |
| `SH/test` | - | 3: `audio.test.ts` (5 lines), `sim-selector-in-force.test.ts` (3), `sim-capture-config.test.ts` (5) |

No production caller in any workspace (row 27 measured 24 non-test files; rows 150, 162 to 165, 167 to 171 moved them). The three test files are the function's own tests and controls; they move with their subject.

## 2. Change set

| File | Change |
|---|---|
| `SH/src/sim/audio.ts` | `micInputOfChannel` deleted with its private line type `MicLine` (`Pick<CaptureConfigMic, 'inputId'>`); the D137 sentence it carried (channel order = line order; the place the two vocabularies meet) moved into the comment of `meterInputOfChannel`; the comment of `DEFAULT_MIC_INPUT_OF_CHANNEL` now says it is a table of the seeded pair and no lookup answers from it. No other function changed |
| `SH/test/audio.test.ts` | import removed; the complete-pair comparison now states the rule itself (`lines[0]`, `lines[1]`); the control "the positional function still answers the constants" removed; the seeded-selector case compares with the built-in table only; NEW block "the positional microphone function stays deleted (static; task 4 row 172)" - 4 cases |
| `SH/test/sim-selector-in-force.test.ts` | two calls now go through `meterInputOfChannel` (the lines in force are a complete pair in both states); expectations unchanged |
| `SH/test/sim-capture-config.test.ts` | the D137 rule case: hand-built lines state their role and go through `meterInputOfChannel`; the last expectation "no line at all: the built-in pair" becomes `[null, null]` (C18 (2): nothing is answered for a missing line) |

## 3. The static test

`SH/test/audio.test.ts`, block "the positional microphone function stays deleted". It walks the four workspaces `apps/core-server`, `apps/core-web`, `apps/mobile`, `packages/shared` (sources and tests, `.ts/.tsx/.js/.jsx/.mjs/.cjs`; build and dependency folders skipped) and holds them to 0 lines that name the function as an identifier, comments included. The name is built from parts so the test file is no occurrence.

| Case | What it holds |
|---|---|
| the scan reads the four trees | more than 200 files per tree; the four files that carried the rule are in the scan |
| 0 files name it | `places` equals `[]` |
| the barrel | `@dems/shared/sim` exports no such member; `micInputOfRole` and `meterInputOfChannel` are functions |
| CONTROL | a planted call, a planted import and a planted comment are each found (3 places); a longer identifier is not |

## 4. Checks (2026-10-13, one run each; the test files had one second run after a failure of my own edit - a local helper name collided with an outer `pair` in `sim-capture-config.test.ts`, renamed `roleLines`)

| Check | Result |
|---|---|
| search for the name over `apps/` and `packages/` after the change | 0 lines |
| `npx tsc --noEmit` in `packages/shared` | exit 0 |
| `npx tsc --noEmit` in `apps/core-server` | exit 0 |
| `npx tsc -b` in `apps/core-web` (its `typecheck` script) | exit 0 |
| `npx tsc --noEmit` in `apps/mobile` | exit 0 |
| `npx vitest run test/audio.test.ts test/sim-selector-in-force.test.ts test/sim-capture-config.test.ts --maxWorkers=2` | `Test Files 3 passed (3)`, `Tests 101 passed (101)` |

## 5. Identifiers

WP-13a site C15 of row 27 closed (the definition); C18 (2) "nothing by position": the function no longer exists. 24 of 24 files: 0.

## 6. Not in this row

The narrowing of `channelOfMicLine` (seam `MicLineRoleUnstated`) and the seam `AudioSliceInState` are done in row 149, as the batch instruction orders. `DEFAULT_MIC_INPUT_OF_CHANNEL` stays exported: `apps/core-web/src/features/devices/audio-input-card.tsx` and two tests read it as the table of the built-in pair.

## 7. Driver decisions

- DD-1: the static test extends `SH/test/audio.test.ts` (the test file of the subject `sim/audio`; the workspace's runner includes only `test/**`), not a new file under `SH/src/sim/`.
- DD-2: comments are held to 0 as well as code (stricter than "0 calls"): the three comments that named it were reworded.
