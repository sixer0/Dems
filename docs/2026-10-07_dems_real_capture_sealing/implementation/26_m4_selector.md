---
task_id: 2026-10-07_dems_real_capture_sealing
row: 66 (M4-W2) — selector module + API + slices + config lock + CapturePlan builder
date: 2026-10-09
agent: coder-execution
status: needs-review
narrative_tier: 3
base: HEAD 23c8f0b (working tree, not committed)
---

# Row 66 — selector live paths (ops 76-80), config lock, hosted pair of SH-18, `CapturePlan` builder

Status **needs-review**: the code and its automated checks are done; three changes in files this
row does not own are requested (section 6), one contract contradiction needs a ruling (D-66-3),
and operation 89 is deliberately not routed (D-66-4).

## 1. What was built (file:line)

| Part | Where | Real / stand-in |
|---|---|---|
| Ops 76-80 routes | `apps/core-server/src/modules/capture-config/routes.ts:161` (`registerCaptureConfigRoutes`; routes at :188, :195, :202, :215, :224), mounted by `index.ts:122` | real |
| Reads 76/77 | from the engine's committed state (`routes.ts:116` `captureConfigAnswer`; `locked` computed from the open session, never stored) | real |
| Edits 78/79/80 | one engine unit each (`routes.ts:165` `edit`: `app.engine.run` -> lock read -> hosted action `setCaptureConfig` -> commit -> publication) | real |
| `409 CAPTURE_CONFIG_LOCKED` | `routes.ts:97`, thrown inside the unit before the action: no state change, no audit row | real |
| Hosted pair (SH-18) | `packages/shared/src/sim/types.ts:695` (`CaptureConfigChange`), `:1428`, `:1434`; `sim/actions.ts:252-253`; transition `sim/capture-config.ts:80`; contract table `api/sim-actions.ts:100-101`, `:128`; Live bindings `live/source/bindings.ts:574`, `:591` | real. `switchAudioSource` is the ACTION only: operation 81's route is M5 (row 71) |
| Plan builder | `apps/core-server/src/modules/capture-config/plan.ts:198` `buildCapturePlan`, `:120` `assertRecordableSelector`, `:229` `capturePlanSubjects` | real, pure; not called by anything yet (row 71) |
| Adapter-registry seam (rule RG-3) | `index.ts:114` `provideDeviceRegistry`; asked in `routes.ts:141` | seam: nothing provides a registry yet |
| Slice builder order | `slices.ts:113` (mic rows in input order) | real |

Engine counterpart: none needed beyond the table — `engine.command` / `EngineUnit.command` derive
the hosted names from `SIM_ACTION_OPERATIONS` (`engine/hosted-actions.ts`). No `EngineHost` member
was added, so the five engine test doubles are untouched.

`adapter_kind`: this row reads it from NO stored device. The builder asks the adapter registry's
descriptor (`assertRecordable`), which carries `adapterKind` / `sourceClass` / `hasOpener`.

## 2. Behaviour, as verified

| Check | Result |
|---|---|
| Roles | SUPERVISOR / TECHNICIAN edit: 200, one `CAPTURE_CONFIG_CHANGED` row per changed line, details = C3 §5.2 keys incl. `permission`. INVESTIGATOR: 403 `NOT_PERMITTED` + exactly one `ACCESS_DENIED` row per call (`{ operationId, permission: CAPTURE_CONFIG, role }`). Every role reads |
| `M4-LOCK-1` (78/79/80) | open session: 409 for both holder roles on all three, trail length, revision, publications and the slice reference unchanged; reads 200 with `locked: true`; INVESTIGATOR still 403; after `cancel` the edit is accepted (control). Ops 89/95/96 are not built by this row |
| Slices published | each edit = one `EngineStateChange` holding `replace captureConfig` AND its audit append, at the revision of `x-dems-revision`; a no-op edit publishes nothing. Replication: a `delta` with that op parses with `DeltaMessageSchema` and a replica fold yields exactly `captureConfig` (`packages/shared/test/sim-capture-config.test.ts`) |
| Plan builder | seeded configuration -> subjects `CAM-01, CAM-02, MIC-01, MIC-02, PRIMARY, STANDBY`; 0 `VIDEO-0x` subjects (with a control that finds them); passes `CapturePlanSchema` and `StartMessageSchema`. Refused with `SOURCE_KIND_NOT_RECORDABLE`: no opener (`NO_OPENER`), no adapter (`NO_ADAPTER`, every device in `SIMULATED`), mixed classes (`MIXED_SOURCE_CLASSES`), class not the operation's. `M4-LOCAL-PLAN-1` plan half: the four development slots (CAM-03 local, CAM-02 fake, MIC-03 local, MIC-02 fake) build |
| Hosted pair reachable only as contracted | `setCaptureConfig` <- 78/79/80 only; `switchAudioSource` <- 81 only (no route yet); reads and op 89 host nothing (`routes.test.ts`, `hosted-actions.test.ts`) |

## 3. Commands and results

| Command | Result |
|---|---|
| `npx tsc --noEmit -p apps/core-server` / `-p packages/shared` | 0 errors in this row's files. Not mine, in flight: `packages/shared/test/evidence-package.test.ts:453` (row 83); at the last run also `apps/core-server/src/sealing/__tests__/finalize-transcript.db.test.ts:77` (sealing row) — core-server was at 0 errors two runs earlier |
| `npm run lint -w @dems/core-server`, `-w @dems/shared` | 0 warnings, 0 errors |
| `vitest --project unit src/modules/capture-config src/engine/__tests__/hosted-actions.test.ts` | 6 files, 73 passed (plan 10, routes 13); `test/static/imports.test.ts` 17 passed |
| shared: `sim-capture-config`, `live-source-bindings`, `api-domain-operations`, `live-source-platform-neutral`, `sim-api`, `openapi`, `api-registry` | all passed (sim-capture-config 12) |
| `lockf -k .locks/db-migrate.lock npm run test:db -w @dems/core-server -- src/modules/capture-config test/acceptance/contract.test.ts test/acceptance/rbac-matrix.test.ts` (sandbox off) | `capture-config.db.test.ts` 9/9; `rbac-matrix.test.ts` green with ops 76-80 in every walk (83 routed operations); `contract.test.ts` 11 failed / 25 passed |
| core-web / mobile typecheck after the shared change | 0 errors each |

### Acceptance contract walk (`test/acceptance/contract.test.ts`)

Baseline measured in this session with this row's route registration switched off: **12 failed / 23
passed (35)**. After: **11 failed / 25 passed (36)**. Nothing was weakened; one block was added.

| Block | Before -> after |
|---|---|
| `SC6 > the error codes` | red -> **green** |
| new: `the capture selector (operations 76 to 80 ...)` (`:714`) | — -> green (200/401/403/404/422 through the real stages, ledger-validated) |
| `AC-B-09 > the router ... register exactly the registry's routes` | 14 unregistered -> 9 |
| `AC-B-14 > 403: every operation that documents it` | 16 problems -> 11 |
| `AC-B-14 > 404 ... 405` | first failure moved from `/capture/config` to `/session/{id}/audio-source` |
| `AC-B-93` free text | 16 -> 12 |
| `SC6 > every answer validated ...` | 7 contract problems -> 0; now stops at the next assertion (`api7` 76, needs > 80) |
| `SC6 > the coverage` | 178 unproduced statuses -> 161 |
| area 4, area 5, `401 NOT_SIGNED_IN` (71 vs 88), `403 DEMO_DISABLED`, `no GET handler writes` (27 vs 35) | unchanged (pins of ops 81-89) |

## 4. Count pins moved (by delta)

`packages/shared/test/api-domain-operations.test.ts:641` 45->47, `:645` [31,9,1,4]->[33,9,1,4], `:664`
40->42, `:666` 41->45, `:673` 51->47 · `live-source-bindings.test.ts:208` 45->47, `:218` 33->35, `:271`
41->45, `:604` 34->36 · `live-source-platform-neutral.test.ts:266` export list +1 ·
`apps/core-server/src/engine/__tests__/hosted-actions.test.ts:27` 31->33, `:28` 45->47, `:69` 32->36 ·
`test/acceptance/contract.test.ts:137` `LANDED_UNROUTED` 14->9 · `rbac-matrix.test.ts:161`
`DEFERRED_ROUTE` 14->9, `:1127` 78->83, `:1150` INVESTIGATOR 2->5 · `test/static/imports.test.ts:102`
`EXPOSED` +`src/capture/adapters`. Comment counts: `sim-actions.ts:2,10,15`, `bindings.ts:2,15,597`,
`live/source/types.ts:308`, `live-sim.ts:7,14`, `live/source/index.ts:26`, `core-api.ts:34`,
`engine/hosted-actions.ts:5,6,17,33`, `engine/host.ts:631,931`.

## 5. To wire when row N lands

| Row | What |
|---|---|
| 71 | call `assertRecordableSelector` (before any source is opened) and `buildCapturePlan` (before `app.capture.start`); map `CapturePlanError` to `409 INVALID_STATE` (`SOURCE_KIND_NOT_RECORDABLE`) and the pre-check BLOCK item; route op 81 onto the hosted `switchAudioSource` + `supervisor.switchAudioSource`; produce the `409 CAPTURE_CONFIG_LOCKED` of 78/79/80 in area 4 of `contract.test.ts`; `M5-SRC-REC-1` |
| 61 / 71 / 136 | `captureConfigControl(app).provideDeviceRegistry(registry)`: from then on an assignment asks rule RG-3 (`422 INVALID_INPUT`, `DEVELOPMENT_SOURCE_NOT_ALLOWED`) |
| 132 / 136 | `adapter` / `sourceClass` on the two slices; rule RG-2 for the lists of 76/77 needs them |
| 84 / 132 / 142 | operation 89 (sealer; `WEB_CONSOLE_SESSION` is not in the registry yet), then its lock check |
| 129 | mapping mic order (section 6); `capture_config.revision` / `updated_by` are not written by an edit (the mapping holds them constant, `db/mapping/rows.ts` `captureConfigToRow`) — who edited is in the audit row |

## 6. Requests filed (`delegation_progress/file_requests.md`, 10:02Z)

1. `capture/adapters/__tests__/static.test.ts` block A-5 (closed row 65): red by design now — the
   layer IS imported by the capture-config module (three files, through the barrel).
2. `db/mapping/rows.ts` `captureConfigFromRow`: mic rows in input order (see D-66-3).
3. `packages/shared/src/api/state-slices.ts`: the describe text of `mics` + regenerated `openapi.json`.

## 7. Decisions and findings for the controller

| # | Decision / finding |
|---|---|
| D-66-1 | `setCaptureConfig(change)` is ONE action for three operations (as `deviceCommand`); `CaptureConfigChange` = `UPDATE` / `CAMERA_SOURCE` / `PRIMARY_MIC`; table `CAPTURE_CONFIG_CHANGE_OPERATIONS`. The pair is appended at the end of `SimActions` |
| D-66-2 | The simulator's REST facade (`sim/api.ts` ops 78-80) was NOT changed and still has its own inline edit. It differs from the action: a mic line of op 78 is audited with `field: 'DEVICE'` (outside the C3 §5.2 set), no `permission` key, an unknown device in op 78 is accepted, one camera on both tracks with one profile is accepted. Parity gap; suggested fix: the facade calls `setCaptureConfigTransition` |
| D-66-3 | **Contract contradiction.** AC-B-70 (`contract.test.ts`) and the simulator list the mic inputs `MIC-01, MIC-02`; the describe text of `CaptureConfigSliceSchema.mics` and the durable mapping say "PRIMARY first". This row follows AC-B-70 (action, answers, module slice builder). Until request 2 lands, after `setPrimaryMic(MIC-02)` the stored row reads back in the other order (taken out by name in the db test) and after a restart the replicated slice lists MIC-02 first (the REST answers sort; the snapshot does not) |
| D-66-4 | Operation 89 is not routed (row text says 76-80; it needs row 84's sealer and a condition the registry lacks). `DEFERRED_ROUTE` relabelled |
| D-66-5 | A dual-lens selector (one device on both tracks, OD-05) is accepted by the selector but is no `CapturePlan` of protocol v2 ("a camera is named twice"): the builder refuses it (`CAPTURE_PLAN_INVALID`) |
| D-66-6 | A mic line whose `deviceId` differs from its `inputId` is refused (422): the stored row keys the two mics by device and reads the input back as that ID. This collides with capture spec §A.1.1 (MIC-03 as mic 1 in development) — rows 129 / 136 |
| D-66-7 | Order of refusals as the simulator's: 404 (unknown path ID) before 409 (lock). An edit that changes nothing: 200, no row, no publication |
| D-66-8 | `test/static/imports.test.ts` `EXPOSED` gained `src/capture/adapters` (the capture index deliberately does not re-export the adapters) |

Process notes: `packages/shared/src/api/sim-actions.ts` was edited once by a scripted exact-match
replacement instead of the Edit tool (diff checked: only the intended lines); the whole
`@dems/shared` suite was run once (77 files) to find the pins.

Red tests seen that are other rows' in-flight edits (not fixed): `src/capture/__tests__/static.test.ts`
G-R2 / G-R8 and the adapters scan list (`src/capture/adapters/local/*`), `test/static/credentials.test.ts`
(`adapters/local/__tests__/mic-helper.generated.test.ts`), `test/static/log-calls.test.ts`
(`src/transcription/*`), `modules/stt-config/__tests__/static.test.ts` (`src/transcription/credential-reveal.ts`).

## 8. Device / browser checks left for the M4 gate (2 + 1 each; one scripted flow per client)

| Flow | Steps |
|---|---|
| `M4-SEL-W` (agent-browser, lane web on 127.0.0.1) | state the lane's capture operation; SUPERVISOR: make MIC-02 primary -> exactly one `CAPTURE_CONFIG_CHANGED` row with `permission` + changed fields, a second client shows the new selector without reload; swap the cameras (op 78), assign one (op 79); TECHNICIAN the same; INVESTIGATOR: controls refuse, one `ACCESS_DENIED` row; a candidate ID is refused 422; then `M4-LOCK-1` inside the run: open a session -> controls locked, an edit answers 409, no new audit row; cancel -> editable |
| `M4-SEL-T` (`dems2_tablet`, emulator-5556, lane 2) | the same edit visible after refresh; lock while a session is open |
| `M4-SEL-P` (`dems2_phone`, emulator-5554, lane 1) | the same |

---
*Generated: 2026-10-09 17:10 WIB*
