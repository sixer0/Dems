---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 47 (phase C, milestone M2, class B; M2-W6; blueprint rev 2.1)
date: 2026-10-08
agent: coder-execution
source_plan: identification/02_structured.md rev 2.1 row 47 (:210) + standing invariants (:199); masterplan/03_api_contract.md (C3) §0, §2.1, §6; masterplan/04_database_contract.md (dbc-3) §B; masterplan/01_specs.md §D; masterplan/02_plan.md §B.1 M2-W6
narrative_tier: 3
status: completed - shared workspace green (typecheck, lint, suite); consumer adaptation outside this row's file set is listed in §9 with its owning rows
closes: CS-15 (contract half), SH-01, SH-02, SH-03, SH-04, SH-05, SH-16, SH-17, SH-23, SH-25 (wire half), E-02, E-04, decision D-b
depends_on: row 45 (DONE - `implementation/10_m2_schema_check.md`)
---

# Row 47 / M2-W6: shared domain and contract foundation in `packages/shared`

## 0. Summary

| Item | Result |
|---|---|
| `M2-RG-SHARED` (`npm run test -w @dems/shared -- --maxWorkers=2 --run`, `CI=true`) | **exit 0** — `Test Files 71 passed (71)`, `Tests 1857 passed (1857)`; floor 71 / 1,851 (register E-06) → **+6 assertions** |
| Baseline before this row (same command) | exit 0 — 71 files / 1,851 tests |
| `@dems/shared` typecheck (`tsc --noEmit`) | exit **0** |
| `@dems/shared` lint (`oxlint`) | exit **0**, 0 warnings |
| `M2-API-3` slice-count clause | **30** replicated slices (`captureConfig` = 29, `captureDevices` = 30) |
| CL-12 equality (D-b) | shared `FaultKind` (14) **equals** `value-sets.ts` `FAULT_KIND` (14) element by element, same order |
| E-04 grep | 0 executable uses of `AdminResource.DEVICE[S]` for capture; the registry still holds exactly `USERS`, `DEVICES`, `PAIRING_CODE` |
| `@dems/mock-core` (read-only workspace, run only) | exit 0 — 4 files / 19 tests (its floor 4/19) |
| Root `npm run typecheck` | exit 2: `@dems/shared` and `@dems/mock-core` clean; 24 errors in `@dems/core-server`, 16 in `@dems/core-web`, 9 in `@dems/mobile` — every one of them a consumer of a value this row was told to change, listed with its owning row in §9 |
| Files touched | 48 under `packages/shared/**` only: 26 src (+985/-80), 21 test (+119/-74), `openapi/openapi.json` regenerated (+618/-34). Nothing else in the repository was edited |

## 1. Scope gate (what this row did not do)

* Every edit is under `packages/shared/**`. `git status --porcelain` for this row shows only
  `packages/shared/src/**`, `packages/shared/test/**` and `packages/shared/openapi/openapi.json`.
* `apps/core-server/**` untouched — rows 45/46 own it (row 46 runs there in parallel); the two DB
  files this row *reads* for the CL-12 proof (`src/db/schema/value-sets.ts`) were read, not written.
* `apps/mock-core/**`, `release/**`, and the controller trackers (`status_tasks.md`,
  `delegation_progress_report.md`) untouched.
* No `git push`, no remote, no sudo, no Homebrew write. No database was contacted by this row at all.
* `openapi:gen` ran under `/usr/bin/lockf -k .locks/npm.lock` (the README lock convention). It wrote
  **no** version change: the document stays `all 0.2.1` / `offline 0.1.0` with 75 operations — the
  bumps and the re-pins are row 50 (M2-W8). Only schema bodies moved (new components, widened enums).
* Test runs were non-interactive: `CI=true` plus vitest `run` mode and `--maxWorkers=2`
  (standing invariant :199; test strategy §B.4). No watch mode, nothing waiting on stdin.

## 2. Files changed

| Area | Files | Content |
|---|---|---|
| SH-01 enums | `src/domain/enums.ts` | Mic-input track model (`MicInputId`, `MicRole`, `MicInputIdLabel`, `MicRoleLabel`, `SESSION_AUDIO_TRACK_ID`, `LEGACY_AUDIO_TRACK_IDS`); `FinalizationStep` v2 + `FINALIZATION_STEPS_V2` + `FALLBACK_ONLY_FINALIZATION_STEPS` |
| SH-02 entities | `src/domain/entities.ts` | 7 new entities (`EvidenceFile`, `AudioSourceInterval`, `FragmentCheckpoint`, `Transcript`, `TranscriptRevision`, `CaptureConfig`, `CaptureDevice`); `ENTITY_NAMES` 24 → 31 as one appended group; `EntityByName` + the compile-time proof follow |
| SH-03 vocabulary | `src/sim/vocabulary.ts`, `src/sim/faults.ts` | `Permission` +2; `FaultKind` +2 in contract order; `FaultEvt`, `FAULT_EVENT_CATEGORY`, `FAULT_EVENT_KIND`, `FAULT_SEVERITY` completed; `PrecheckCheckId` +`MIC_PRIMARY`/`MIC_STANDBY`; `TimelineKind` +`AUDIO_SWITCH`; `IntegritySource` +`REAL`; new `CaptureDeviceKind`, `CaptureStreamState` |
| SH-04 RBAC | `src/sim/auth.ts` | `CAPTURE_CONFIG` → SUPERVISOR + TECHNICIAN; `TRANSCRIPT_REVISE` → INVESTIGATOR (inherited by SUPERVISOR). 14 permissions, 22 grants (5/12/5) |
| SH-05 sim types | `src/sim/types.ts`, `src/sim/initial-state.ts`, `src/sim/store.ts`, `src/sim/session-machine.ts` | Step `progress`/`etaMs`/`detail`/`attempt`; session `captureConfig`/`audioSource`/`transcript`; `MicStatus.micRole`; `AudioSlice` re-key; slices 29/30 in `SimState`, the idle baseline and `SNAPSHOT_KEYS`; `FINALIZATION_ORDER` = the v2 six |
| SH-16 slices | `src/api/state-slices.ts`, `src/api/realtime-messages.ts`, `src/api/state-examples.ts` | `CaptureConfigSliceSchema`, `CaptureDevicesSliceSchema` (+ row schemas), delivery/registry/`STATE_SCHEMAS` entries, two `DeltaReplaceOpSchema` members, slice examples |
| SH-17/SH-25 realtime | `src/api/state-slices.ts`, `src/api/realtime-messages.ts`, `src/api/realtime-examples.ts`, `src/live/source/neutral-state.ts`, `src/live/source/live-sim.ts`, `src/sim/{audio,faults,health,react,api}.ts` | `meters.audio` keyed by `MIC-01`/`MIC-02` with `activeInputId`; the five call sites adapted |
| SH-23 i18n | `src/i18n/en/{common,security-audit,session-new,session,system}.ts` | Labels for both permissions, both fault kinds, both precheck ids, `AUDIO_SWITCH`, and the v2 finalization step names |
| Examples the registry serves | `src/api/administration.ts`, `src/api/identity.ts` | Role matrix 14 permissions / 22 grants; session examples carry their role's v2 grant list |
| Generated | `openapi/openapi.json` | Regenerated at unchanged versions (75 ops, 0.2.1 / 0.1.0) |
| Tests | 21 files under `test/` | Count pins, audio keys, step names, label maps, proof maps refreshed |

## 3. SH-01 — enums (`domain/enums.ts`)

Track model per OD-01 ruling T1: `AUDIO-01` is documented as **the one session audio track**,
`AUDIO-02` as **legacy v1 only**, with `SESSION_AUDIO_TRACK_ID` and `LEGACY_AUDIO_TRACK_IDS` naming
that split explicitly instead of leaving it to a comment. New closed sets:

```ts
export const MicInputId = { MIC_01: 'MIC-01', MIC_02: 'MIC-02' } as const;      // devices, not tracks
export const MicRole = { PRIMARY: 'PRIMARY', STANDBY: 'STANDBY' } as const;     // role inside AUDIO-01
```

`FinalizationStep` v2 (`06_evidence_package_spec.md` §E, cited by `dbc-3 §B.4` as the closed set the
vocabulary pins and the DB never CHECKs):

```ts
CLOSE_TRACKS · FINALIZE_HASHES · FINALIZE_TRANSCRIPT · BUILD_MANIFEST · SIGN_MANIFEST · STORE_SEALED_PACKAGE
+ CONCATENATE_SEGMENTS · ENCRYPT_PAYLOAD            // OD-21 fallback path only
FINALIZATION_STEPS_V2 = the six above, in pipeline order   // single source; session-machine imports it
```

`FINALIZE_TRACKS` and `CALCULATE_HASHES` are gone (renamed by the contract); `ENCRYPT_PAYLOAD`
survives as a fallback-only member because v2 encrypts while recording.

## 4. SH-02 — entities (`domain/entities.ts`)

Seven interfaces, each carrying only what `dbc-3 §B` and `C3 §2.3` fix: `EvidenceFile` (both hashes,
fragment chain head, `kind: 'FILE'`), `AudioSourceInterval` (media-pts `fromMediaMs`/`toMediaMs` plus
the UTC-ms pair, `reason: START|MANUAL|STOP`), `FragmentCheckpoint`, `Transcript`, `TranscriptRevision`
(with `signatureCertificateSha256` per SEC35-20 and **no** `baseRevision` column, SEC35-21),
`CaptureConfig` (optimistic `revision`), `CaptureDevice` (**no credential member**, RK-12).
The book's 24 names stay an exact prefix; the seven are appended as one group so generic code that
walked the book's list is unaffected. The `Exact<EntityName, keyof EntityByName>` proof still holds.

## 5. SH-03 — vocabulary, and decision D-b (binding)

`FaultKind` grew by appending `MIC_SILENT` then `CAPTURE_FAULT` **in the order `dbc-3 §C.1` writes
them**, exactly as D-b requires, so CL-12 / M2-MT-8 compare two equal *ordered* lists:

```
shared FaultKind (14): ["CAMERA_LOSS","MIC_NO_SIGNAL","MIC_CLIP","STORAGE_LOW","STORAGE_FULL","GNSS_LOSS","TAMPER","FAN_STALL","POWER_FAIL","TPM_FAILURE","SECURITY_FAULT","AUDIT_TAMPER","MIC_SILENT","CAPTURE_FAULT"]
db FAULT_KIND   (14): ["CAMERA_LOSS","MIC_NO_SIGNAL","MIC_CLIP","STORAGE_LOW","STORAGE_FULL","GNSS_LOSS","TAMPER","FAN_STALL","POWER_FAIL","TPM_FAILURE","SECURITY_FAULT","AUDIT_TAMPER","MIC_SILENT","CAPTURE_FAULT"]
PASS | shared FaultKind has 14 values | 14
PASS | db FAULT_KIND has 14 values | 14
PASS | CL-12: the two lists are equal in order
PASS | MIC_SILENT is at index 12 in both
PASS | CAPTURE_FAULT is at index 13 in both
PASS | the first twelve keep the book order
```

Harness: `.cache/row47/cl12-faultkind.ts` (git-ignored path, exits 1 on any miss; run
`npx tsx .cache/row47/cl12-faultkind.ts`, exit 0). It also proves `IntegritySource`
(`DEMO_PACKAGE`, `SIMULATED`, `REAL`) equals `INTEGRITY_SOURCE` in the same order — `REAL` was added
here because `dbc-3 §B.11` puts it in the DB set and the mapping (row 49) must be able to name it.

Four exhaustive maps over `FaultKind` had to grow with it (`FaultEvt`, `FAULT_EVENT_CATEGORY` in
vocabulary; `FAULT_EVENT_KIND`, `FAULT_SEVERITY` in `sim/faults.ts`). Severities follow `dbc-3 §C.2`:
`MIC_SILENT` = WARNING, `CAPTURE_FAULT` = CRITICAL. Neither joins `CRITICAL_FAULTS`: whether a
stalled file moves the session machine to FAULT is SH-06 behaviour (row 51), not a vocabulary call.

**EVT IDs.** The book's EVT table stops at `EVT-30`, so the two new kinds are keyed to the authority
that created them — `MIC_SILENT: 'OD-11'`, `CAPTURE_FAULT: 'NM-07'` — rather than an invented EVT ID.
Recorded as decision D-c-1 in §10.

Other SH-03 additions: `TimelineKind.AUDIO_SWITCH` (WB-10), `CaptureDeviceKind`
(`CAMERA`/`MIC`/`POE`, the DB set — see D-c-2), `CaptureStreamState` (`LIVE`/`LOST`, op 44).

**Precheck pair.** `MIC_PRIMARY`/`MIC_STANDBY` were **added**, and `MIC_1`/`MIC_2` were **kept**, so
`PRECHECK_ORDER` still lists the book's eight. A rename would have broken `Record<PrecheckCheckId, …>`
maps in `apps/core-web` and `apps/mobile` that no M2 row owns (rows 67/68 do). See D-c-3.

## 6. SH-04 — RBAC (`sim/auth.ts`)

```
INVESTIGATOR 5: SESSION_START, SESSION_NOTE, EVIDENCE_VIEW, DIAGNOSTICS_RUN, TRANSCRIPT_REVISE
SUPERVISOR  12: (the five above) + EVIDENCE_REVIEW, EVIDENCE_EXPORT, AUDIT_EXPORT, PAIRING_MANAGE, USER_ADMIN, DEMO_CONTROL, CAPTURE_CONFIG
TECHNICIAN   5: EVIDENCE_VIEW, DEVICE_MANAGE, DIAGNOSTICS_RUN, MAINTENANCE, CAPTURE_CONFIG
```

14 permissions, 22 grants — the numbers `dbc-3 §E.3` says the v2 seed writes ("SUPERVISOR 12,
INVESTIGATOR 5, TECHNICIAN 5"), which keeps the D88 boot equality `rbac.matrix` checks (specs C-N9,
verified end-to-end by row 52). `test/auth.test.ts` now pins 14/22 and asserts each new permission's
holders; the i18n sync test pins 14 labelled values; the served role-matrix example
(`api/administration.ts`) and the two session examples (`api/identity.ts`) were moved to the same
numbers so the contract examples do not contradict the matrix.

## 7. SH-16 — replicated slices 28 → 30, with their own kind (E-04)

`captureConfig` (29) and `captureDevices` (30) were added to `STATE_SLICE_DELIVERY`,
`REPLICATED_SLICE_SCHEMAS`, `REPLICATED_SLICE_NAMES`, `ReplicatedStateSchema`, `STATE_SCHEMAS` and the
`DeltaReplaceOpSchema` union — appended after `settings`, so the v1 order stays a prefix. Shapes are
`C3 §6`: selector cameras `{trackId, deviceId, profile, online, streamState}`, mics
`{inputId, deviceId, role, transport, online}`, `locked`, `updatedAt`; devices
`{id, kind, model, firmware, host, poePort, online, streamState, capabilities}` — the field list of
`C3 §2.3`, which contains **no credential member** (RK-12) and whose `host` is a host only, never a
`user:password@` URL (C-N8).

Proof (`npx tsx .cache/row47/slice-count.ts`, exit 0):

```
REPLICATED_SLICE_NAMES (30): ["meta","device", … ,"update","settings","captureConfig","captureDevices"]
PASS | M2-API-3: the replicated slice count is 30 | 30
PASS | slice 29 is captureConfig
PASS | slice 30 is captureDevices
PASS | both are classified replicated
PASS | both have a schema
PASS | a delta `replace` of `captureConfig` parses with its own slice literal
PASS | a delta `replace` of `captureDevices` parses with its own slice literal
AdminResource: ["USERS","DEVICES","PAIRING_CODE"]
PASS | AdminResource still holds exactly USERS, DEVICES, PAIRING_CODE
PASS | no capture value joined AdminResource
```

**E-04 grep proof.** Every non-comment reference to `AdminResource.*` in `packages/shared`:

```
src/api/realtime-messages.ts:161  [AdminResource.USERS]: Permission.USER_ADMIN,
src/api/realtime-messages.ts:162  [AdminResource.DEVICES]: Permission.PAIRING_MANAGE,
src/api/realtime-messages.ts:163  [AdminResource.PAIRING_CODE]: Permission.PAIRING_MANAGE,
src/api/realtime-messages.ts:390  resource: z.enum(AdminResource),
```

All four are the pre-existing paired-client registry (`ADMIN_RESOURCE_PERMISSION` and the
`admin.changed` message), none is capture code, and `git diff` shows no `+`/`-` line touching the
`AdminResource` definition itself — the only added line mentioning it is the comment in
`realtime-messages.ts:301` stating the rule. Capture travels as a `delta` `replace` of its own two
slice literals; no `CaptureResource` notification kind was invented (none is needed, `C3 §6`).

Both slices also exist in the simulator (`SimState`, the idle baseline, `SNAPSHOT_KEYS`, listed in
`ADDED_SNAPSHOT_KEYS` so a stored pre-v2 snapshot still hydrates), because the module invariant is
"the wire form is the simulator's own JSON" and `test/api-state-slices.test.ts` proves it per slice.
The idle defaults mirror the five built-in `capture_devices` rows `dbc-3 §E.3` seeds
(`CAM-01`, `CAM-02`, `MIC-01`, `MIC-02`, `POE-SWITCH`), with loopback hosts only (`127.0.0.1:8554/55`,
inside the M3 fake-source range) — no LAN address, per the standing invariant.

## 8. SH-17 / SH-25 — `meters.audio` re-key (E-02)

`AudioSliceSchema` and `SimState['audio']` moved from `channels: Record<AudioTrackId, AudioFrame>` to
`inputs: Record<MicInputId, AudioFrame>` plus `activeInputId` (`C3 §6`, ux §1, register SH-17). The
refusal cases are pinned in `test/api-state-slices.test.ts`: one input only, a third input, a missing
`activeInputId`, and the old `channels` key are all rejected; the frame bounds stay [-90, 0].

Five call sites plus their neighbours were adapted: `sim/audio.ts` (writes frames under the input the
channel feeds), `sim/faults.ts` (`setAudioFrame`), `sim/health.ts` (the 1 Hz mic sample),
`sim/react.ts` (`useAudioChannel`), `live/source/neutral-state.ts` (`silentAudio`, `isSilentAudio`),
and `live/source/live-sim.ts` (`onMeters` — the fifth site E-02 names). Two exported maps,
`MIC_INPUT_OF_CHANNEL` and `CHANNEL_OF_MIC_INPUT`, are the single meeting point of the two
vocabularies: the demo controls, the CLIP fault target and the timeline still name a **channel**
(re-keying those is SH-08, row 51), while the meters name an **input**. Keeping
`useAudioChannel(channel: AudioTrackId)` on its old signature — mapped internally — is deliberate:
register SH-22 retypes it, and its five client call sites belong to rows 67/68.

`sim/api.ts` (`GET /api/v1/audio/status`) keeps its v1-shaped `channels[]` response and only looks up
the frame through the map; op 45's own re-key is SH-15 (row 48).

## 9. Verification

| Check | Command | Result |
|---|---|---|
| M2-RG-SHARED | `CI=true npm run test -w @dems/shared -- --maxWorkers=2 --run` | **exit 0**; `Test Files 71 passed (71)`, `Tests 1857 passed (1857)` — floor 71/1,851 met and exceeded |
| Shared typecheck | `npx tsc --noEmit -p packages/shared/tsconfig.json` | exit 0 |
| Shared lint | `npm run lint -w @dems/shared` | exit 0, no findings |
| M2-API-3 (slice clause) | `npx tsx .cache/row47/slice-count.ts` | exit 0, 30 slices (§7 output) |
| CL-12 (D-b) | `npx tsx .cache/row47/cl12-faultkind.ts` | exit 0, both 14-value lists quoted (§5 output) |
| E-04 | `rg -n "AdminResource\.(DEVICES\|DEVICE\b\|USERS\|PAIRING_CODE)" src test` minus comment lines | 4 hits, all pre-existing paired-client code (§7) |
| OpenAPI drift | `/usr/bin/lockf -k .locks/npm.lock npm run openapi:gen -w @dems/shared` then the suite | `openapi.test.ts` and `api-openapi-scope.test.ts` green at 0.2.1/0.1.0, 75 ops |
| mock-core (run only) | `CI=true npm run test -w @dems/mock-core -- --maxWorkers=2 --run` | exit 0, 4 files / 19 tests |

Pins this row moved (each is a number the blueprint told it to move, not a loosening):
replicated slices 28 → 30 and state slices 33 → 35 (`api-state-slices`, `api-realtime`,
`live-source-replica`, `realtime-live-socket` comments); `STATE_SCHEMAS` 37 → 39 and the registry
totals 130 → 132 / `50+39+11+32` (`api-registry`, `api-openapi-scope`); API-13 schema count 112 → 114
(`api-text-rule`); permissions 12 → 14 and grants 18 → 22 (`auth`, `i18n-vocabulary-sync`,
`api-examples`); fault kinds 12 → 14 (`api-schemas`); offline baseline-widened list
`WIDENED = ['HealthResponse','ApiError','PrecheckItem','SessionResource']` (`api-openapi-scope`,
title restated to "14 of its 18 components are byte-equal").

### Expected red outside this row's file set (root `npm run typecheck`, exit 2)

`@dems/shared` and `@dems/mock-core` are clean. The remaining 49 errors are consumers of the four
value changes this row was instructed to make; none is fixable inside `packages/shared/**`:

| Workspace | File | Cause | Owning row |
|---|---|---|---|
| core-server | `src/db/fixtures/operations.ts:73` | severity map missing the 2 new fault kinds (was 7 errors here, now 1: the vocabulary half is fixed) | **49** |
| core-server | `src/db/mapping/rows.ts:389/427/490/510`, `src/db/mapping/__tests__/to-rows.test.ts:126` | v2 mapping columns + the audio key | **49** |
| core-server | `src/db/mapping/slices.ts:86` | compile-time proof: slices 29/30 need a durable/unmapped classification | **49** |
| core-server | `src/modules/devices/status.ts:105` + `__tests__/{status,effects.db,routes}`, `src/engine/__tests__/ticks.db.test.ts:327` | `meters.audio` re-key (SH-17/CS-15 server half) | **51** (parity) / **52** (status feed) |
| core-web | `src/components/composed/dbfs-meter.tsx:192` (+`:317` cascade), `__tests__/dbfs-meter.test.tsx`, `__tests__/test-utils.ts`, `src/test/live-{shell-notices,session-monitor-panels,meter-clip-reset}.test.tsx` | `meters.audio` re-key | **67** (M4-W3 web) |
| core-web | `src/features/session-new/devices-step.tsx:27`, `:267` | `Record<PrecheckCheckId, …>` needs the two new ids | **67** |
| mobile | `src/features/session-finalizing/finalizing.model.ts:12/13` | `FinalizationStep` v2 names | **87** (M7-W6) |
| mobile | `src/runtime/use-audio-shared-values.{ts,test.tsx}`, `src/features/session-live/testing/live-monitor-bed.tsx` | `meters.audio` re-key | **87** / SH-22 owner |
| mobile | `src/features/session-new/check-icon.tsx:9`, `src/features/session-live/session-live-screen.tsx:152` | `PrecheckCheckId` pair; local `TimelineKindName` lacks `AUDIO_SWITCH` | **68** (M4-W4), **87** |

Row 45 left root typecheck red for the same reason (14 errors, rows 47/49 named); this row removes
the vocabulary-caused half of the core-server set and adds the client-side consequence of SH-17,
which has no M2 owner because the client rows sit in M4/M5/M7. **The controller should route that
consequence** — either by pulling the meter re-key adaptations of rows 67/68/87 forward or by
accepting red `M2-RG-WEB`/`M2-RG-MOB` until they run (see D-c-4).

Measured consequence on the web workspace (run for evidence, not fixed here):

```
$ CI=true npm run test -w @dems/core-web -- --maxWorkers=2 --run
 Test Files  20 failed | 97 passed (117)
      Tests  91 failed | 1404 passed (1495)          # floor 117 / 1,495

$ CI=true npm run test -w @dems/core-web -- src/components/composed/__tests__/dbfs-meter.test.tsx --maxWorkers=2
EXIT=1
     26|   t0 = sim.store.getState().audio.channels['AUDIO-01'].at   # the SH-17 key change
 Test Files  1 failed (1) / Tests 11 failed (11)
```

Every one of the 20 failing files is in the table above (meter components, meter test helpers, and
the live-mode screens that render them); none is a behaviour regression of the simulated engine.

## 10. Decisions taken here, to route

| ID | Decision | Why |
|---|---|---|
| D-c-1 | `MIC_SILENT`/`CAPTURE_FAULT` carry `OD-11`/`NM-07` in `FaultEvt` instead of an EVT ID | The book's EVT table ends at `EVT-30`; inventing `EVT-31/32` would put a fake traceability ID into audit rows and alert copy. Refresh the EVT table when the test set is extended |
| D-c-2 | `CaptureDeviceKind` = `CAMERA`/`MIC`/`POE` (the `dbc-3 §B.2` set), not `C3 §6`'s "MICROPHONE" | The DB CHECK is normative and enforced; `MICROPHONE` could not represent `POE-SWITCH` at all. `C3 §6` marks its payload column a shape summary. **Erratum for C3 §6** |
| D-c-3 | `MIC_PRIMARY`/`MIC_STANDBY` added alongside `MIC_1`/`MIC_2`; `PRECHECK_ORDER` unchanged at eight | Register SH-03 names the values; renaming them breaks exhaustive maps in two clients that no M2 row owns. Rows 67/68 retire the channel-keyed pair |
| D-c-4 | SH-17 was done on the wire **and** on the sim slice, leaving the demo-control/timeline/fault-target vocabulary channel-keyed | `state-slices.ts` proves schema ≡ simulator type per slice, so a wire-only change cannot be green; the behavioural re-key (switch, silence warning, scenarios) stays SH-08/row 51. Consequence: client suites are red until rows 67/68/87 |
| D-c-5 | `openapi.json` regenerated without version or operation-count changes | The committed document must not drift from the builder (`openapi.test.ts` AC-B-11). Versions and the 89-op pins are row 50's, and it will regenerate again |
| D-c-6 | `CAPTURE_CONFIG`/`TRANSCRIPT_REVISE` are recorded in `api-registry.test.ts` `ENFORCED_AT` with empty operation lists | No operation of the current 75 names them; ops 78/79/80/89 and 85 arrive with row 48, which must replace both empties. The pin states that openly instead of dropping the guard |

## 11. Independence and rollback

Written from the row text (`structured` :210, invariants :199), C3 §0/§2.1/§6, dbc-3 §B/§C.1/§E.3,
specs §D, `06_evidence_package_spec.md` §E, `08_client_ux_spec.md` §1/§3, the row-45 artifact
(`implementation/10_m2_schema_check.md`, including D-b), and the shared source itself. No other
agent's intermediate output was relied on.

Rollback (the plan's own M2-W6 line): `git checkout -- packages/shared/src packages/shared/test
packages/shared/openapi` restores HEAD; the two harnesses live under the git-ignored `.cache/row47/`.
No database, media, lane, or tracker state was touched.

## 12. Handoff

* **Row 48 (M2-W7)** — `CAPTURE_CONFIG` at ops 78/79/80/89 and `TRANSCRIPT_REVISE` at op 85, then the
  `ENFORCED_AT` empties in `test/api-registry.test.ts`; the 9 audit types (SH-03's audit half was left
  here deliberately); `CaptureConfigSlice`/`CaptureDevicesSlice` become the answers of ops 76/77
  (examples already exist in `EXAMPLE_SLICES`); op 45's `channels[]` re-key in `sim/api.ts`.
* **Row 49 (M2-W4)** — `db/mapping/{rows,slices}.ts` v2 shapes (4 + 1 errors), `fixtures/operations.ts`
  severity map, and the 22-grant seed that must equal `ROLE_PERMISSIONS` (D88).
* **Row 50 (M2-W8)** — regenerate at 0.3.0/0.2.0; the slice pin it carries is already 30 here.
* **Row 51 (M2-W9)** — SH-08 behavioural re-key (fault targets, timeline channel, health, scenarios),
  the silence-warning path, and the server-side meter publication parity.
* **Rows 67/68/87** — the client consequences listed in §9.

---
*Generated: 2026-10-08 11:10*
