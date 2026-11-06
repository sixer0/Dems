---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: RECON-C (controller-added reconciliation, phase C, milestone M2 gate; blueprint rev 2.1)
date: 2026-10-08
agent: coder-execution-local
source_plan: implementation/60_m2_meter_forwardfix.md §4.2 (remaining non-meter failures); implementation/14_m2_shared_contract.md §9 (consumer fallout); implementation/15_m2_api_contract.md §3 (op-42 QUEUED); identification/02_structured.md rev 2.1 rows 67/68; decisions/decisions.md D31/D38/D41
narrative_tier: 3
status: complete - M2-RG-WEB and M2-RG-MOB both reach exit 0; every M2-attributable shape/count consumer in apps/core-web + apps/mobile adapted; no assertion weakened/skipped/timeout-raised; two STOP items reported for the gate (PrecheckCheckId pair -> rows 67/68; one packages/shared error -> RECON-A lane)
closes: the client-side consequence of SH-03 (FaultKind 12->14), SH-04 (permissions 12->14 / grants 18->22), SH-01 (FinalizationStep v2), SH-03/WB-10 (TimelineKind AUDIO_SWITCH), SH-15/op-42 (export status EXPORTED->QUEUED), and the row-48/50 OpenAPI op-count/version re-pins (75->89 ops, offline 10->23, versions 0.2.1->0.3.0 / 0.1.0->0.2.0)
depends_on: rows 47, 48, 50, 51a all landed (packages/shared typecheck exit 0 verified at start of this row)
file_set: apps/core-web/** and apps/mobile/** ONLY (packages/shared, apps/core-server, mock-core/release, trackers untouched)
---

# RECON-C / M2 gate: adapt the core-web + mobile consumers of M2's shared-shape changes

## 0. Summary

| Item | Result |
|---|---|
| Scope | Fix ONLY the M2-attributable shape/count adaptations in `apps/core-web` + `apps/mobile` so `M2-RG-WEB` and `M2-RG-MOB` go green. No M4/M7 feature built; no assertion deleted/weakened; no `test.skip`; no timeout raised. |
| Files changed | **14** (all under `apps/core-web/src/**` and `apps/mobile/src/**`): +78 / -63 lines. Nothing else in the repository was edited by this row. |
| `M2-RG-WEB` (`npm run test -w @dems/core-web`, CI=true, maxWorkers=2) | **exit 0** - `Test Files 117 passed (117)`, `Tests 1496 passed (1496)` |
| `M2-RG-MOB` (`npm run test -w @dems/mobile`, CI=true, maxWorkers=2) | **exit 0** - `Test Suites 194 passed (194)`, `Tests 1997 passed (1997)` |
| Before this row (enumerated, shared already green) | core-web `10 failed / 107 passed` files, `16 failed / 1450 passed` tests (one file, `shell-motion.test.tsx`, was a false positive of the enumeration invocation - see §4); mobile `6 failed / 188 passed` suites, `9 failed / 1988 passed` tests |
| Real M2-attributable failures fixed | core-web **9 files / 15 tests**; mobile **6 suites / 9 tests** |
| Typecheck of the files this row touched | **0 errors** in every edited file. Residual app typecheck errors are NOT this row's (see §5). |
| STOP items (gate decision) | 2, both listed in §6 with reason; neither is a suite failure. |

## 1. Method and anti-hang

macOS has no GNU `timeout`; a python3-backed shim at `/tmp/bin/timeout` (SIGTERM then SIGKILL to the child group) was used, proven on a `sleep 10` probe (exit 124). Every command was non-interactive: `CI=true`, vitest `--run` / jest CI, `--maxWorkers=2`, `</dev/null`, bounded by `timeout`.

**Invocation correction (important for the gate):** the canonical workspace command is `npm run test -w @dems/<app> -- <files> --maxWorkers=2`, which runs with cwd = the app directory. Running `npx vitest run --root apps/core-web` from the repo root keeps cwd at the repo root and makes `src/test/shell-motion.test.tsx` fail spuriously (it reads `process.cwd()/src/components/shell/shell.css`). That is an invocation artifact, not an M2 failure - see §4.

## 2. What M2 changed and how each consumer was adapted

Every edit below adapts an OLD assertion / field-shape / exhaustive-list to a shared shape that has ALREADY landed (rows 47/48/50/51a). None adds behaviour.

### 2.1 SH-03 FaultKind 12 -> 14 (core-web)

`system-model.test.tsx` "covers every fault kind" asserts `DEMO_FAULTS` (+ the GNSS time-source control) covers every `FaultKind`. Row 47 appended `MIC_SILENT` then `CAPTURE_FAULT`. The client's exhaustive demo-fault list caught up:

- `features/system/model.ts`: appended `spec(FaultKind.MIC_SILENT)` and `spec(FaultKind.CAPTURE_FAULT)` to `DEMO_FAULTS`; added `CAPTURE_FAULT` to the local `CRITICAL` set so its toast tone mirrors the authoritative `FAULT_SEVERITY` map (`CAPTURE_FAULT`=CRITICAL, `MIC_SILENT`=WARNING, per dbc-3 §C.2). Both kinds are injectable through the generic `actions.inject` (the sim's `injectFaultTransition` handles them - row 51), and their presenter labels/descriptions were pre-authored in shared i18n by SH-23. No new UI mechanism; the toggle-render path is unchanged. The failing assertion went from `Array(12) != Array(14)` to equal.

### 2.2 SH-04 permissions 12 -> 14 / grants 18 -> 22 (core-web)

The role-matrix fixtures in these tests derive from the shared `getRoleMatrix` example (already 14/22 after row 47); only hardcoded literals were stale:

- `live-users-roles-model.test.tsx`: `roleDiff(TECHNICIAN -> INVESTIGATOR)` now carries `TRANSCRIPT_REVISE` (gained by INVESTIGATOR) and `CAPTURE_CONFIG` (lost from TECHNICIAN), in matrix permission order.
- `live-users-roles-commands.test.tsx`: the same transition's Gains/Loses listitems gained `Revise transcripts` / `Configure capture devices`.
- `live-users-roles-page.test.tsx`: matrix rows `13 -> 15`, `seeded.permissions 12 -> 14`, granted cells `18 -> 22`.
- `live-security-audit-page.test.tsx`: matrix rows `13 -> 15` (two assertions); the "twelve permissions" title restated to fourteen.

### 2.3 op-42 export status EXPORTED -> QUEUED (SH-15, row 48)

Row 48 re-keyed op 42's 202 body `status` to `QUEUED` (the export is accepted as a queued job; the evidence ITEM's own lifecycle status stays `EXPORTED` - a different field).

- core-web `sim-fetch.test.ts`: the asserted response `status` `EXPORTED -> QUEUED`.
- mobile `features/evidence/testing/live-evidence-bed.tsx`: the fake transport's hand-built op-42 202 answer emitted `status: 'EXPORTED'`, which no longer validates against the landed schema, so the export wizard never reached its Done state. Re-keyed to `'QUEUED'`. This is a TEST BED fix (in `apps/mobile/**`), not a product change; the wizard logic keys off `result.ok`/`exportId`, unchanged.

### 2.4 SH-01 FinalizationStep v2 (mobile)

Row 47 renamed `FINALIZE_TRACKS -> CLOSE_TRACKS` and `CALCULATE_HASHES -> FINALIZE_HASHES`, inserted `FINALIZE_TRANSCRIPT`, and made `ENCRYPT_PAYLOAD` fallback-only; it exported `FINALIZATION_STEPS_V2` (the six normal-path steps) which the simulator emits as its finalization order.

- `features/session-finalizing/finalizing.model.ts`: `FINALIZATION_STEPS` (which still named the removed `FINALIZE_TRACKS`/`CALCULATE_HASHES`, resolving to `undefined` at runtime and producing duplicate step ids) now points at the single shared source `FINALIZATION_STEPS_V2`. This propagates to `finalization-pipeline.tsx` and the model test through the existing import.
- `session-finalizing-screen.test.tsx` and `live-finalizing.test.tsx`: the expected step-label strings follow the v2 names/order (`Close tracks`, `Finalize hashes`, `Finalize transcript`, ...), matching the shared i18n labels SH-23 added.

### 2.5 SH-03 / WB-10 TimelineKind AUDIO_SWITCH (mobile)

Row 47 added `AUDIO_SWITCH` to the shared `TimelineKind`.

- `features/session-live/session-live.math.ts`: the local `TimelineKindName` union (a mirror of `TimelineKind`) gained `AUDIO_SWITCH`, and the exhaustive `KIND_TONE` record gained an entry (`info`, the neutral tone SNAPSHOT also uses - a mic switch is a neutral operator action). This resolves the `readonly TimelineEvent[] -> readonly TimelineEventInput[]` assignability error. Titles come from shared `session.timeline.kind.*` (SH-23), so no other map needed extending. session-live suites re-run green (15 files / 124 tests).

### 2.6 OpenAPI op-count + version re-pins (rows 48 + 50, core-web)

Row 48 registered ops 76-89 (75 -> 89 total; offline scope 10 -> 23) and row 50 regenerated `openapi.json` and bumped versions (`all` 0.2.1 -> 0.3.0, `offline` 0.1.0 -> 0.2.0). The API Reference page derives its document from the registry, so only the pinned expected counts/versions in the tests were stale. Row 50 explicitly flagged these exact app-side files as category-B pins it could not touch (apps/** was off-limits to it) and routed them to an app-side owner. Every number below was confirmed against the actual received values, not hand-derived:

- `scalar-config.test.ts`: offline-scope operations `10 -> 23` (health LIVE + 22 SIMULATED).
- `live-api-reference-document.test.tsx`: default simulated view `10 -> 23`; "Show Core-server endpoints" total `75 -> 89` and `CORE_SERVER_ONLY_OPERATIONS 65 -> 66`; simulated-off+core-on `66 -> 67`; simulated requests `9 -> 22`; live document `75 -> 89` and `info.version 0.2.1 -> 0.3.0`; not-denied network ops `69 -> 83` (deny-list stays the same 6 secret ops).
- `live-api-reference-page.test.tsx`: live document `75 -> 89`, operation-count text `75 -> 89 operations`, spec version `v0.2.1 -> v0.3.0`; simulated `10 -> 23`, `v0.1.0 -> v0.2.0`; core-server toggle on `75 -> 89` with `65 -> 66` CORE SERVER badges, off back to `23`.

## 3. Verification evidence (commands were able to fail; they did)

### 3.1 Baseline before this row (shared already green - row 48 landed)

```
$ npx tsc --noEmit -p packages/shared/tsconfig.json          # EXIT=0  (row 48 landed; row 47a's external blocker cleared)

# core-web (enumeration via --root; see the shell-motion caveat in §4)
$ CI=true npm run test -w @dems/core-web ...                  # EXIT=1
 Test Files  10 failed | 107 passed (117)
      Tests  16 failed | 1450 passed (1466)
#   9 files / 15 tests are genuine M2-attributable (system-model, users-roles x3, security-audit,
#   scalar-config, api-reference-document, api-reference-page, sim-fetch);
#   shell-motion.test.tsx is the --root cwd artifact, not M2.

# mobile (full run, shared green)
$ CI=true npm run test -w @dems/mobile -- --maxWorkers=2      # EXIT=1
 Test Suites: 6 failed, 188 passed, 194 total
 Tests:       9 failed, 1988 passed, 1997 total
```

### 3.2 After this row - targeted per-file runs (canonical cwd)

```
# core-web fast group
$ CI=true npm run test -w @dems/core-web -- system-model.test.tsx sim-fetch.test.ts scalar-config.test.ts live-users-roles-model.test.tsx --maxWorkers=2
 EXIT=0   Test Files 4 passed (4)   Tests 50 passed (50)

# core-web jsdom live group
$ CI=true npm run test -w @dems/core-web -- live-users-roles-page live-users-roles-commands live-security-audit-page live-api-reference-document live-api-reference-page --maxWorkers=2
 EXIT=0   Test Files 5 passed (5)   Tests 176 passed (176)

# mobile affected suites
$ CI=true npm run test -w @dems/mobile -- finalizing.model session-finalizing-screen live-finalizing session-summary-screen live-summary-sites live-evidence-export --maxWorkers=2
 EXIT=0   Test Suites: 6 passed, 6 total   Tests: 59 passed, 59 total
```

### 3.3 After this row - full workspace suites

```
$ CI=true npm run test -w @dems/core-web -- --maxWorkers=2     # EXIT=0
 Test Files  117 passed (117)
      Tests  1496 passed (1496)

$ CI=true npm run test -w @dems/mobile -- --maxWorkers=2       # EXIT=0
 Test Suites: 194 passed, 194 total
 Tests:       1997 passed, 1997 total
```

### 3.4 Typecheck isolates this row's signal from the residual

```
$ npm run typecheck -w @dems/core-web        # EXIT=2
 # 0 errors in any file this row touched. 3 total, none owned here:
 #   src/features/session-new/devices-step.tsx(27,267)  Record<PrecheckCheckId,...> missing MIC_PRIMARY/MIC_STANDBY  -> row 67 (STOP item, §6)
 #   ../../packages/shared/src/sim/api.ts(770)          'state' declared but never read                              -> packages/shared, out of file set (RECON-A lane)

$ npm run typecheck -w @dems/mobile          # EXIT=2
 # 0 errors in any file this row touched. 1 total:
 #   src/features/session-new/check-icon.tsx(9)         Record<PrecheckCheckId,...> missing MIC_PRIMARY/MIC_STANDBY  -> row 68 (STOP item, §6)
```

Before this row the same commands carried the FinalizationStep/AUDIO_SWITCH errors in files this row has now fixed (finalizing.model.ts, session-live.math.ts); those are gone. The remaining errors are the PrecheckCheckId pair (rows 67/68) and one shared error - none is a suite failure and none is in a file this row edited.

## 4. shell-motion.test.tsx - not an M2 failure

`src/test/shell-motion.test.tsx` appeared red ONLY under the `--root apps/core-web` enumeration because it reads `${process.cwd()}/src/components/shell/shell.css` and `--root` leaves cwd at the repo root. Under the canonical `npm run test -w @dems/core-web` (cwd = apps/core-web) it passes: `Tests 30 passed (30)`. It is not caused by any M2 shared-shape change and was left untouched. Flagged so the gate does not miscount it.

## 5. Scope boundary kept (hard constraints honoured)

* Edits confined to `apps/core-web/**` and `apps/mobile/**` (14 files, §0). `git diff --stat` over exactly those paths shows +78/-63; no edit by this row under `packages/shared/**`, `apps/core-server/**`, `apps/mock-core`, `release`, or the controller trackers.
* `packages/shared/**` was READ only (to learn the landed shapes: `domain/enums.ts` FinalizationStep/FINALIZATION_STEPS_V2, `sim/vocabulary.ts` TimelineKind, `sim/faults.ts` severity/target, `i18n/en/*` labels, `api/openapi.ts` versions).
* No `git add`/commit/push, no remote, no sudo, no database contact, no emoji, docs English.
* No watch mode; every command bounded by `timeout` with `</dev/null` and CI/`--run`.
* No assertion deleted or weakened; no `test.skip`; no timeout raised. Count/version/label edits move a pin to the value the landed contract produces; the exhaustive-list edits (DEMO_FAULTS, KIND_TONE, FINALIZATION_STEPS) make a client mapping cover the widened enum without changing what is displayed where the order is unchanged.

## 6. STOP items for the M2 gate (never faked/skipped; reported for routing)

Neither is a suite failure (both suites are exit 0). Both are compile-time consumers whose CORRECT treatment is a design decision owned by another row, so this row did not guess.

| App | File | Symptom | Why this row stopped | Suggested owner |
|---|---|---|---|---|
| core-web | `features/session-new/devices-step.tsx:27,267` | `Record<PrecheckCheckId, LucideIcon>` and the state-source map missing `MIC_PRIMARY`/`MIC_STANDBY` | SH-03 added the mic-role precheck pair; D-c-3 states "Rows 67/68 retire the channel-keyed pair" and row 47a §4.2 assigns devices-step to row 67. The correct icon/state-source mapping (and whether `MIC_1`/`MIC_2` are retired) is row 67's selector design, not a single mechanical value. | **row 67** (M4-W3 web selector) |
| mobile | `features/session-new/check-icon.tsx:9` | `Readonly<Record<PrecheckCheckId, LucideIcon>>` missing `MIC_PRIMARY`/`MIC_STANDBY` | Same pair; row 47a §4.2 / D-c-3 assign check-icon to row 68. | **row 68** (M4-W4 tablet/phone selector) |

Also noted (out of this row's file set, not fixable here): `packages/shared/src/sim/api.ts:770` unused `state` (TS6133) - belongs to the shared API/sim lane (RECON-A / rows 48/51a), surfaced in the core-web program because core-web type-checks the referenced shared sources.

## 7. Independence and rollback

Written from the row brief, `implementation/60_m2_meter_forwardfix.md` §4.2, `14_m2_shared_contract.md` §9, `15_m2_api_contract.md` §3, decisions D31/D38/D41, and the landed shared source. Rollback restores exactly the 14 files in §0 to HEAD:

```
git checkout -- apps/core-web/src/features/system/model.ts \
  apps/core-web/src/test/{sim-fetch,scalar-config,live-users-roles-model,live-users-roles-commands,live-users-roles-page,live-security-audit-page,live-api-reference-document,live-api-reference-page}.test.{ts,tsx} \
  apps/mobile/src/features/session-finalizing/{finalizing.model.ts,session-finalizing-screen.test.tsx,live-finalizing.test.tsx} \
  apps/mobile/src/features/evidence/testing/live-evidence-bed.tsx \
  apps/mobile/src/features/session-live/session-live.math.ts
```

No other state touched.

## 8. Handoff / next steps

* `M2-RG-WEB` and `M2-RG-MOB` are green from this row's adaptations plus the meters.audio re-key already landed in row 47a. The M2 gate can judge them at exit 0.
* Route the two PrecheckCheckId STOP items to rows 67/68 (they will land the real mic-role selector treatment). They do not block the suites but keep root `npm run typecheck` red until done.
* The `packages/shared/src/sim/api.ts:770` unused-var belongs to the shared lane (RECON-A), not to the clients.

---
*Generated: 2026-10-08 08:39*
