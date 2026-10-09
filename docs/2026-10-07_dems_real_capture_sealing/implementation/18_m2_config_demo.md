---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 52 (phase C, milestone M2, class B; M2-W10; blueprint rev 2.1)
date: 2026-10-08
agent: coder-execution-local
source_plan: identification/02_structured.md rev 2.1 row 52 (:215) + standing invariants (:199); masterplan/03_api_contract.md (C3) §2.4, §3, §6; masterplan/01_specs.md §E.6 (:392); decisions/decisions.md D38-D40; artifacts implementation/14_m2_shared_contract.md (row 47), 15_m2_api_contract.md (row 48), 51_m2_stt_config_schema.md (row 112)
narrative_tier: 3
status: completed - capture-config module (store/slices/boot) + devices v2 status feed + real-mode demo fencing + rbac.matrix boot equality; targeted unit run exit 0 (5 files / 102 tests); row-scope typecheck clean (0 errors under capture-config/ or devices/)
closes: NM-09, CS-23, CS-06 (read half), SH-04, E-04 (OD-10, OD-18); C3 §2.4, §3, §6; specs §E.6
depends_on: row 48 (DONE - implementation/15_m2_api_contract.md)
deferred_to_checkpoint_55: effects.db.test.ts (db-project device-effects verification); the live 409 RESET_BLOCKED_REAL_EVIDENCE refusal path (row 54's DB+disk guard); workspace-wide tsc green (the consolidated RECON wave, D38 RECON-1..5)
---

# Row 52 / M2-W10: capture-config module, devices v2 status feed, real-mode demo fencing

## 0. Context — this row RECONCILED an interrupted attempt

A prior attempt at this exact row was cancelled mid-run (D39: "Row 52 was cancelled by
the user mid-run ... left PARTIAL, UNVERIFIED edits with NO artifact"). The on-disk state
was inspected first (`git status --porcelain -- apps/core-server/src/modules`) and found to
contain a **complete and internally coherent** set of edits: the new `modules/capture-config/`
directory (store/slices/boot/fencing/index + three test files) and the schema-v2 re-key of
`modules/devices/{index,operations,status}.ts` plus their tests. Per the brief ("keep what is
correct; do not blindly redo"), this run **verified the source against C3/specs rather than
trusting the file's presence**, confirmed every cross-row dependency resolves, and proved the
row with a targeted non-db run. No source line needed rewriting; the reconciliation was
verification + documentation + the honest separation of what this row can prove from what it
defers.

**Anti-hang:** no `timeout`/`gtimeout` binary exists on this macOS host (confirmed: `command -v
timeout` -> NEITHER). Every long command ran through the tracked background-process monitor,
which enforces a wall-time cap and returns as the process exits; vitest ran with `CI=true`,
`--run`, `--maxWorkers=2`, `--project unit`, stdin closed (`< /dev/null`), never watch mode.
The `unit` project structurally excludes `*.db.test.ts` (`vitest.config.ts` `DB_TEST_FILES`), so
`effects.db.test.ts` cannot enter this row's run. `.locks/db-migrate.lock` was never taken
(row 54 is this turn's sole db-runner).

## 1. Verification results (raw command output quoted)

| Check | Command | Result |
|---|---|---|
| **M2-RG-CSU** (targeted, non-db) | `env CI=true npx vitest run --project unit --maxWorkers=2 --run src/modules/capture-config src/modules/devices/__tests__/status.test.ts src/modules/devices/__tests__/routes.test.ts </dev/null` | **Test Files 5 passed (5) / Tests 102 passed (102)**, process exited 0 |
| **rbac.matrix boot EQUAL to seeded grants** (fake boot) | verbose run, `rbac-boot-equality.test.ts` console line | `[row52] rbac.matrix boot equality \| stored=22 shared=22 equal=true` (§3) |
| rbac negative control | drop `SUPERVISOR CAPTURE_CONFIG`, same boot | refuses with `STORED_GRANTS_MISMATCH` naming `missing grant: SUPERVISOR CAPTURE_CONFIG`; last matrix stays null |
| **fencing 403 DEMO_DISABLED** (real mode) | `fencing.test.ts` (real `buildApp`, no DB, real stage 6, SUPERVISOR, flag off) | `injectFault` -> **403 DEMO_DISABLED** before the body; engine commands `[]`; audit rows `[]`; positive control flag ON -> **204** reaches the hosted action |
| fencing 409 RESET_BLOCKED_REAL_EVIDENCE | `fencing.test.ts` registry/data assertion | code exists in `ApiErrorCode`; `resetDemo` documents `responses['409']`; fencing data names both refusals. Live DB+disk refusal = row 54 (deferred, §5) |
| **M2-API-3 slice-count clause** | `slices.test.ts` | `REPLICATED_SLICE_NAMES` length **30**; `[28]='captureConfig'`, `[29]='captureDevices'` |
| M2-MT-7 seed-count clause (in-memory) | `slices.test.ts` reading `rbacRows()` at the seed source | permissions **14**, grants **22** (INV 5 / SUP 12 / TECH 5), equal to `ROLE_PERMISSIONS`; capture baseline 1 selector / 5 devices / 0 credentials |
| **row-scope typecheck** | `npx tsc --noEmit` filtered to `modules/capture-config` + `modules/devices` | **0 errors** in this row's files |
| workspace typecheck (context only) | `npx tsc --noEmit` (whole core-server) | exit 2, **25 errors across 7 files, none in this row's scope** — pre-existing RECON-wave residuals (§5) |

## 2. What the row required and where it landed

### 2.1 Capture-config store + slices + boot (NM-09) — `modules/capture-config/*`
- `store.ts` — the in-memory holder of slices 29/30, loaded once from the two KEPT tables
  (`capture_config`, `capture_devices`) plus the open-session fact, in **one statement**
  (`READ_CAPTURE_STATE`), following the permission-guard stored-matrix idiom. The statement reads
  `public.capture_config`, `public.capture_devices`, `public.active_session` and **never**
  `capture_device_credentials` (RK-12; asserted). Server-native slices (classified `S` by row 49),
  so this store is their only runtime reader.
- `slices.ts` — two pure builders `captureConfigSliceOf` / `captureDevicesSliceOf` turning table
  rows into the wire-form slices, each parsed through its own zod schema before it leaves (fail
  closed). `locked` is a caller fact about the open session, never a column (OD-10); mics travel
  PRIMARY then STANDBY; `capabilities` are empty until supervisor telemetry lands (row 57, SH-18);
  the built-in baseline answers an unseeded table (decision D-52-3). Own slice kind, never
  `AdminResource.DEVICE[S]` (E-04).
- `boot.ts` — the readiness step `capture.config`: loads the store before the listener opens. A row
  set that cannot form a valid slice stops the start (logged + persisted with its code, then
  thrown). The one named exception is the EMPTY selector table: it loads the built-in baseline and
  says so loudly in both the warn log and the persistent error log (`CAPTURE_CONFIG_BASELINE`),
  marking the snapshot `builtInBaseline` so the gate sees the seed wiring is still open (row 49 §6
  routed the production seed insert here; the runtime role has no INSERT, so the baseline can never
  be silently edited into existence).
- `index.ts` — the Fastify plugin + `captureConfigControl(app)` accessor (the `permissionGuard(app)`
  idiom, keyed on the stage registry). It opens no DB connection and registers no route: ops 76-80/89
  answer from this store when their live paths land (row 66) and telemetry updates it when the seam
  lands (row 57). `app.ts` is frozen under P25; the row that adds the registration owns that edit.

### 2.2 Devices v2 status feed (CS-06 read half) — `modules/devices/status.ts`
Schema-v2 shapes of C3 §3 ops 44-47, all additive with defaults so existing callers keep working:
- `videoTracksOf` gains `sourceDeviceId` (the selector slot's device, == `deviceId` on the built-in
  topology, moved by op 79) and `streamState` (slot's when present, else LIVE/LOST from online).
- `audioChannelsOf` re-keys the entry from track `AUDIO-0x` to mic INPUT `MIC-0x` via the shared
  `MIC_INPUT_OF_CHANNEL`, and carries the selector's PRIMARY/STANDBY `role`.
- `activeInputOf` (new, exported) names the input feeding `AUDIO-01`: the frame's when the engine
  produced one, else the selector PRIMARY, else the mic whose own role is PRIMARY.
- `audioStatusOf` / `deviceHealthOf` gain `activeInputId`; `deviceInventoryOf` (op 47) gains the
  `captureConfig` snapshot (its own slice, never the paired-client registry, never a credential).
- The meter frame is read as `frame.audio.inputs[inputId]` + `activeInputId` (SH-17/SH-25, E-02).
- `operations.ts` — `DEVICE_COMMAND_OF_OPERATION` excludes `POE_CYCLE` by decision (E-12; C3 §0/§3
  op 48): operation 48 decides RESTART versus PoE cycle server-side from the body + stream state;
  the hosted `deviceCommand` action still carries exactly three commands. The PoE-cycle audit value
  is written by the server-side cycle path (`details.command: POE_CYCLE`, C3 §5.3), not this map.

### 2.3 Real-mode demo fencing (CS-23; OD-18/OD-19) — `modules/devices/../capture-config/fencing.ts`
Names the two modes (`SIMULATED` / `REAL_CAPTURE`) from the demo flag (config.ts DC-2: read once at
start, never changeable through the API) and states what each refuses, pinning the two machine codes
to the contract vocabulary (`ApiErrorCode.DEMO_DISABLED`, `ApiErrorCode.RESET_BLOCKED_REAL_EVIDENCE`).
It adds **no second gate**: enforcement stays where it lives — stage 6 refuses ops 71-74 with
`403 DEMO_DISABLED` for a `DEMO_CONTROL` holder while the flag is off (before the body, no audit row,
DC-1/DC-2), and row 54's DB+disk guard raises the `409 RESET_BLOCKED_REAL_EVIDENCE` reset refusal.

## 3. rbac.matrix boot equality (quoted comparison)

The boot step of `modules/rbac` is `checkRouter()` then `reloadMatrix()`. The test builds the real
app factory with **no PostgreSQL**: the pool answers the guard's ONE matrix statement
(`READ_STORED_MATRIX`) with the rows `rbacRows()` of `db/mapping` produces — the very function
`db:seed` hands to `writeRbacRows` — so the equality is proven against the seeded grants at their
source, not a hand-typed copy. Quoted from the run:

```
[row52] rbac.matrix boot equality | stored=22 shared=22 equal=true
[row52] stored grants: INVESTIGATOR: DIAGNOSTICS_RUN | INVESTIGATOR: EVIDENCE_VIEW |
  INVESTIGATOR: SESSION_NOTE | INVESTIGATOR: SESSION_START | INVESTIGATOR: TRANSCRIPT_REVISE |
  SUPERVISOR: AUDIT_EXPORT | SUPERVISOR: CAPTURE_CONFIG | SUPERVISOR: DEMO_CONTROL |
  SUPERVISOR: DIAGNOSTICS_RUN | SUPERVISOR: EVIDENCE_EXPORT | SUPERVISOR: EVIDENCE_REVIEW |
  SUPERVISOR: EVIDENCE_VIEW | SUPERVISOR: PAIRING_MANAGE | SUPERVISOR: SESSION_NOTE |
  SUPERVISOR: SESSION_START | SUPERVISOR: TRANSCRIPT_REVISE | SUPERVISOR: USER_ADMIN |
  TECHNICIAN: CAPTURE_CONFIG | TECHNICIAN: DEVICE_MANAGE | TECHNICIAN: DIAGNOSTICS_RUN |
  TECHNICIAN: EVIDENCE_VIEW | TECHNICIAN: MAINTENANCE
```

`stored` (as the boot read them) equals `shared` (`ROLE_PERMISSIONS`) member by member; the four
new grants (`SUPERVISOR/TECHNICIAN CAPTURE_CONFIG`, `INVESTIGATOR/SUPERVISOR TRANSCRIPT_REVISE`)
are inside it (SH-04). The negative control drops `SUPERVISOR CAPTURE_CONFIG` and the SAME boot
refuses with `STORED_GRANTS_MISMATCH` naming it, proving the equality bites on the new permission
rows (what M2-API-3 asks). A third case confirms every permission the new operations name
(`CAPTURE_CONFIG`, `SESSION_START`) is already in the 14-member stored vocabulary, so row 66 will
not hit `PERMISSION_NOT_STORED` when it registers the routes.

## 4. Fencing proof (403 end-to-end; 409 at the contract level)

The `403 DEMO_DISABLED` half is proven end to end against the real pipeline with no database:
flag OFF + a SUPERVISOR (a `DEMO_CONTROL` holder) posting `/api/v1/demo/faults` returns
`403 DEMO_DISABLED` before the body is read, the engine records no command, and the pool writes no
audit row (DC-2). Scenario load, fault clear and the status read take the identical refusal; the
reset route is fenced the same way at stage 6. The positive control turns the flag ON and the same
caller reaches the hosted action (`204`, one `inject CAMERA_LOSS` command), proving the refusal came
from the mode, not the permission. A caller without `DEMO_CONTROL` is refused `NOT_PERMITTED` first
(audited, RB-4), and an unauthenticated caller gets `401` before either (RB-6) — the order of the
refusals is the order of their rules.

The `409 RESET_BLOCKED_REAL_EVIDENCE` half is proven at the level this row can see without a
database: the code is a member of `ApiErrorCode`, the registry documents `responses['409']` on
`resetDemo`, and the fencing data names both refusals. The live refusal needs a real sealed package
on disk and in the DB — that is row 54's guard, verified at checkpoint 55 (§5).

## 5. Deferred to checkpoint 55 (and why)

| Item | Why deferred | Owner / point |
|---|---|---|
| `effects.db.test.ts` (device-effects over the v2 meter re-key) | a db-project test; this turn forbids any db-project run and `.locks/db-migrate.lock` (row 54 is the sole db-runner). The file's edits were reconciled in-scope (AUDIO->MIC re-key, exhaustive `URL_OF` incl. `POE_CYCLE` mapped to `restart` but never posted) but not executed here | checkpoint 55 / row 56 gate |
| live `409 RESET_BLOCKED_REAL_EVIDENCE` refusal | needs a REAL sealed package present (DB + disk); row 54 owns the guard | row 54, verified at checkpoint 55 |
| workspace-wide `tsc --noEmit` green | 25 residual errors in 7 **unmodified** files (`to-rows.test.ts`, `ticks.db.test.ts`, `evidence/index.ts`, `rbac/matrix.db.test.ts`, `permission-guard/{decision,denial}.test.ts`, `test/acceptance/rbac-matrix.support.ts`), all consumers of shared-shape changes made by rows 47/48/49/51 (`AudioSlice.channels`->inputs, `AccessCaller.sessionCreatorId`, op-42 `QUEUED`, `CoreApiAccessCondition.SESSION_HOLDER`). None reference `capture-config`; none are in this row's editable scope. This is the consolidated pre-gate RECON wave recorded in D38 (RECON-1..5) and independently flagged by rows 47/47a/50/51 on the board | RECON wave before checkpoint 55 |

## 6. Files changed (this row's scope only)

New — `apps/core-server/src/modules/capture-config/`:
`index.ts`, `boot.ts`, `store.ts`, `slices.ts`, `fencing.ts`,
`__tests__/slices.test.ts`, `__tests__/rbac-boot-equality.test.ts`, `__tests__/fencing.test.ts`.

Modified — `apps/core-server/src/modules/devices/`:
`index.ts` (export `activeInputOf`, `CaptureSlots`), `operations.ts` (`POE_CYCLE` filter),
`status.ts` (v2 shapes), `__tests__/status.test.ts`, `__tests__/routes.test.ts`,
`__tests__/effects.db.test.ts` (reconciled, verification deferred to 55).

Boundary honoured: edited only `modules/capture-config/**` and `modules/devices/**`. Did NOT touch
`packages/shared/**`, `apps/core-web`/`apps/mobile`, `apps/mock-core`/`release`, migrations,
`openapi.json`, the lockfile, or the controller trackers (`status_tasks.md`,
`delegation_progress_report.md`). No git push/remote; no sudo; no `.locks/db-migrate.lock`.

## 7. Decisions taken during reconciliation
- **D-52-1** Kept the prior partial edits verbatim after verifying them against C3 §2.4/§3/§6 and
  specs §E.6; they were complete and coherent, so the reconciliation added no source change.
- **D-52-2** Ran the whole row through the background-process monitor as the macOS substitute for
  `timeout` (no `timeout`/`gtimeout` on this host), preserving CI/`--run`/`--maxWorkers=2`/stdin-closed.
- **D-52-3** The built-in baseline keeps the simulator's own capability codes and five devices;
  `capabilities` map to `[]` for table rows until supervisor telemetry lands (row 57, SH-18).
- **D-52-4** The empty-selector exception logs AND persists a `CAPTURE_CONFIG_BASELINE` warn rather
  than silently serving, because the production seed insert was routed here by row 49 §6 while this
  row's file set closes `src/db/seed/**` (controller owns the reassignment).
