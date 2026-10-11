# Test-suite consolidation: closing pass (stale names in comments, one failure message)

Date: 2026-10-11. Tree: commit `a5d75ed` plus the uncommitted test-only work of the five consolidation owners (reports `14_consolidation_*.md`). Scope: comment text of 5 product files and 3 test files, one failure message in one db test file. No test merged, deleted or rewritten. No git write. No lane started. No `.data/pg*.env` read. No formatter run.

## 1. Stale names in comments: every mention fixed (8)

Eight comment lines, one line each. In each file the only changed lines are the two shown (one removed, one added); no code token changed.

| # | file:line | old name | new name | kind |
|---|---|---|---|---|
| 1 | `packages/shared/src/sim/selector-in-force.ts:28` | `test/sim-wave-l-z-selector-in-force.test.ts` | `test/sim-selector-in-force.test.ts` | product comment |
| 2 | `apps/core-server/src/capture/supervisor.ts:64` | `wave-h-f.test.ts` | `capture/__tests__/fault-lifecycle.test.ts` | product comment |
| 3 | `apps/core-server/src/capture/boot/checks.ts:265` | `wave-h-f.test.ts` | `fault-lifecycle.test.ts` | product comment |
| 4 | `apps/mobile/src/features/capture-selector/source-state.ts:140` | `wave-i-c-source-state.test.ts` | `source-state.test.ts` | product comment |
| 5 | `apps/mobile/src/features/capture-selector/selector-in-force.ts:23` | `wave-l-m-selector-in-force.test.ts` | `selector-in-force.test.ts` | product comment |
| 6 | `apps/core-server/src/capture-notices/__tests__/probe-wiring.test.ts:113` | `modules/capture-discovery/__tests__/wave-i-a2-adopt-assign.db.test.ts` | `modules/capture-discovery/__tests__/capture-discovery.booted.db.test.ts` | test comment |
| 7 | `apps/core-server/src/modules/evidence/__tests__/export-request.test.ts:169` | `wave-k-s2-sending-device.db.test.ts` | `modules/evidence/__tests__/commands.db.test.ts` | test comment |
| 8 | `apps/core-web/src/test/api-reference-static.test.tsx:4` | `packages/shared/test/fxr-w-nits.test.ts` | `packages/shared/test/api-closeout.test.ts` | test comment |

The new home of each name was checked against the file system and, for rows 2 and 3, against the content: `fault-lifecycle.test.ts:336` reads `supervisor.ts` as source (the "no second literal" rule, `:529`) and `:395` holds `WORKER_VERSION` of `worker.h` equal to `CAPTURE_WORKER_VERSION`. `protocol-pins.test.ts` named beside it in row 3 still exists at `capture/__tests__/protocol-pins.test.ts`.

The diff lines of the five product files (`git diff -U0`):

```
packages/shared/src/sim/selector-in-force.ts            (2 changed lines: 1 removed, 1 added)
- * `packages/shared/src` may spell the expression itself (`test/sim-wave-l-z-selector-in-force.test.ts`).
+ * `packages/shared/src` may spell the expression itself (`test/sim-selector-in-force.test.ts`).

apps/core-server/src/capture/supervisor.ts              (2)
- * other literal for it (`wave-h-f.test.ts` reads the source), so a new refusal is a new member, and
+ * other literal for it (`capture/__tests__/fault-lifecycle.test.ts` reads the source), so a new refusal is a new member, and

apps/core-server/src/capture/boot/checks.ts             (2)
- * `protocol-pins.test.ts` and `wave-h-f.test.ts` hold the two EQUAL, so a worker release without
+ * `protocol-pins.test.ts` and `fault-lifecycle.test.ts` hold the two EQUAL, so a worker release without

apps/mobile/src/features/capture-selector/source-state.ts   (2)
- * `@/features/devices/camera-preview` (held equal on vectors by `wave-i-c-source-state.test.ts`); it
+ * `@/features/devices/camera-preview` (held equal on vectors by `source-state.test.ts`); it

apps/mobile/src/features/capture-selector/selector-in-force.ts   (2)
- * `wave-l-m-selector-in-force.test.ts` fails on a second one.
+ * `selector-in-force.test.ts` fails on a second one.
```

Non-comment changed lines in the five product files: 0 (each changed line starts with ` *`). Row 2 became longer than its neighbours (one line, 125 characters); it was not re-wrapped, so the diff stays one line.

The two db-file comments the unit owner lists (`db/reset/__tests__/wave-i-a1-unsealed-fake.db.test.ts:3` and `engine/__tests__/wave-k-s1-restart-fault.db.test.ts:11`) were already corrected by the db owner when it moved those files: the text now reads `package-removal.test.ts` in `db/reset/__tests__/real-evidence-m7.db.test.ts:81` and `rehydrate.test.ts` in `engine/__tests__/restart.db.test.ts:1150`. Nothing to do; verified by reading both.

## 2. The sweep

Method. The list of removed files is `git status --short` entries ` D` / `D ` (172 deleted paths; no rename entries, a rename shows as a delete plus a new file), reduced to 161 distinct stems (base name without `.test.ts` / `.test.tsx` / `.db.test.ts` / `.tsx`). It is the union of the "files removed" tables of the five reports (shared 25 + transcriber 2, core-server unit 41, core-server db, core-web 30, mobile) as far as those files were tracked at `a5d75ed`. Search: `rg` over `apps/` and `packages/` (excluding `node_modules`, build output, logs), pattern "stem not preceded by `[A-Za-z0-9-]` and not followed by `[A-Za-z0-9_-]`", so that `wave-h-f` does not match `wave-h-f-boot`. The same pattern was run over `scripts/`, `src/`, `release/`, `package.json` and `README.md`: no hit.

Result of the first run: 66 hits.

| group | count | decision |
|---|---|---|
| Provenance notes the owners wrote on purpose: "Moved here from `<old file>` (test-suite consolidation, D233)" | 54 lines in 40 files | kept: they say where a block came from; they are not stale |
| Stale names in comments (section 1) | 8 | fixed |
| Provenance in other words: `capture-discovery.booted.db.test.ts:2` ("This file was `wave-i-a2-adopt-assign.db.test.ts`"), `real-item-kit.tsx:3` ("this file was `wave-h-c2-kit.tsx` until the consolidation"), `sources-known-gate.test.tsx:176` ("which were `wave-h-sources-known-gate.test.tsx`") | 3 | kept: history, correct as written |
| A string in code that looks like a name | 1 | see section 3 |

Second run after the edits (same pattern, `Moved here from` lines filtered out): 4 lines, the three history notes above and the one string of section 3. No stale comment remains.

## 3. Mentions in code

Imports of a removed test file: none. Path strings that a test reads and that name a removed test file: none. `EXEMPT` / skip lists naming a removed file: none.

One string that matches a removed stem: `apps/core-server/src/capture/boot/__tests__/boot.test.ts:174`, `realBootFixture('wave-h-f')` (and `mkdtempSync(... 'dems-wave-h-f-volume-')` beside it). It is a LABEL: `realBootFixture(label)` (`capture/boot/__tests__/support.ts:51`) uses it to name a stand-in folder, not to open a test file. Not a defect of the consolidation; not changed. A rename of the label to a subject name would be the tidy completion, and is a test change that was not asked for.

## 4. The engine log-key allow-list

`apps/core-server/src/engine/__tests__/commands.db.test.ts`, the assertion after the `engineKeys` set (line 743). The list `engineKeys` (lines 732-738) is unchanged and explicit. Only the failure message changed; the file had no other uncommitted change before this pass, and `git diff` shows only these lines:

```
-    expect([...new Set(engineLines.flatMap((line) => Object.keys(line).filter((key) => !engineKeys.has(key))))]).toEqual([]);
+    const keysOutsideTheList = [...new Set(engineLines.flatMap((line) => Object.keys(line).filter((key) => !engineKeys.has(key))))];
+    expect(
+      keysOutsideTheList,
+      `the engine log line holds the key(s) [${keysOutsideTheList.join(', ')}], which are not in engineKeys. The rule: a log key must carry a count or a boolean, never text - add it to the list only after checking its value`,
+    ).toEqual([]);
```

The checked value is the same array, compared with the same `toEqual([])`; a new key now fails with a sentence that names the key and the rule. The message is built from the array, so it is correct for one key or several. The typed check for `restartFaultEnded` below it and everything after are unchanged.

## 5. Check results

| check | command | result |
|---|---|---|
| typecheck shared | `npm run typecheck -w @dems/shared` | exit 0 |
| lint shared | `npm run lint -w @dems/shared` | exit 0 |
| typecheck core-server | `npm run typecheck -w @dems/core-server` | exit 0 |
| lint core-server | `npm run lint -w @dems/core-server` | exit 0 |
| typecheck core-web | `npm run typecheck -w @dems/core-web` | exit 0 |
| lint core-web | `npm run lint -w @dems/core-web` | exit 0 |
| typecheck mobile | `npm run typecheck -w @dems/mobile` | exit 0 |
| lint mobile | `npm run lint -w @dems/mobile` | exit 0, 0 errors, 1 warning (below) |
| the db file of section 4 | `/usr/bin/lockf -k -t 3600 .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=2 src/engine/__tests__/commands.db.test.ts` | 1 file, 20 passed, 0 failed (7.5 s); teardown "dropped 2 database(s) ... 0 remain" |

The db run was first tried inside the command sandbox and stopped at the helper's own check (`POSTGRES_UNREACHABLE`, EPERM on 127.0.0.1:4432, "the database tests did NOT run"); it was then run outside the sandbox, as `test/12_precommit_wave_m.md` does for every db row. The first attempt ran no test.

Mobile lint warning: `apps/mobile/src/runtime/log.test.ts:160:19`, `@typescript-eslint/array-type` ("Array type using 'ReadonlyArray<T>' is forbidden"). The file is not in `git status` (unchanged since `a5d75ed`); not touched here.

`git status --short`, filtered to exclude test files, test-support folders (`testing/`) and `docs/`: exactly five entries, the five product files of section 1 (`M`). For each, `git diff -U0` shows 2 changed lines (1 removed, 1 added), all comment lines, 0 code lines.

## 6. Files changed by this pass

Product (comment text only): `packages/shared/src/sim/selector-in-force.ts`, `apps/core-server/src/capture/supervisor.ts`, `apps/core-server/src/capture/boot/checks.ts`, `apps/mobile/src/features/capture-selector/source-state.ts`, `apps/mobile/src/features/capture-selector/selector-in-force.ts`.

Test (comment text only): `apps/core-server/src/capture-notices/__tests__/probe-wiring.test.ts`, `apps/core-server/src/modules/evidence/__tests__/export-request.test.ts`, `apps/core-web/src/test/api-reference-static.test.tsx`.

Test (failure message only): `apps/core-server/src/engine/__tests__/commands.db.test.ts`.

Document: this file.

## 7. Left as it is

- The implementation notes and gate reports under `docs/` still name the removed files: history, as the five reports say.
- The label of section 3.
- The open items of the five reports that are not names (wall times, `rowsOf` declared three times in `rehydrate.test.ts`, the pending haptic timers, the W4 collapse, the 6 `SIM-GAP` marker tests): not part of this pass.

---
*Generated: 2026-10-11*
