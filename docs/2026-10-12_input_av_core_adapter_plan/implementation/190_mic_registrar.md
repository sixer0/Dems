---
task_slug: input_av_core_adapter_plan
row: 190
milestone: M4 / WP-07c
date: 2026-10-13
agent: coder-execution (batch 8, agent G)
tier: T3
status: needs-review
---

# Row 190 - the server registrar of a microphone

Status is `needs-review` for ONE reason: a ruling on acceptance rule AC-B-70 (section 4, request 1). The registrar is built, handed in by the product and proven on PostgreSQL.

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server`, `AC` = `CS/src/modules/capture-inputs/audio-cards`.

## 1. What was built

| File | State | What it is |
|---|---|---|
| `CS/src/engine/internal-actions.ts` | MOD | `registerCaptureMicrophoneIn(unit, { deviceId, model })`; one member of `InternalActions` |
| `CS/src/engine/host.ts` | MOD | `registerCaptureMicrophoneInScope`: the steps of the camera's door; bound in `engineUnitOf` |
| `CS/src/engine/index.ts` | MOD | the export |
| `AC/registrar.ts` | NEW | `createEngineMicrophoneRegistrar()`, `SET_REGISTERED_MICROPHONE_COLUMNS`, `MicrophoneRegistryRowMissing` |
| `AC/index.ts` | MOD | THE COMPOSITION: the plugin calls `control.provideRegistrar(createEngineMicrophoneRegistrar())` itself, on every Core; a test may take the registrar away (`registrar: null`) |
| `AC/store.ts` | MOD | `cardIdentityValuesOf(input)`: the one place the card identity values of an input row are bound |
| `AC/service.ts` | MOD | header comment only |
| `AC/__tests__/routes.db.test.ts` | MOD | every registration runs the product's registrar; four cases extended, the STATED GAP case turned |
| `CS/test/acceptance/contract.test.ts` | MOD | comment only (why the stand-in stays there, section 4) |

NOT touched: `app.ts`, `modules/capture-inputs/index.ts`, `db/**`, every static-rule list, `capture/**`, `AC/statements.ts`, `AC/__tests__/fixtures.ts` (its `standInRegistrar` is still used by `contract.test.ts`).

How the registrar works, inside the unit of operation 99 (`app.engine.run`, opened by `AC/index.ts`):
1. `registerCaptureMicrophoneIn(unit.scope, ...)` runs row 185's action; the engine's typed writer inserts the `capture_devices` row (class `MIC`, adapter kind `USB_AUDIO`, next free `MIC-nn`: all the action's) and the slice `captureDevices` is published with the commit. Re-enable runs the same action with the id.
2. ONE statement, `UPDATE ... SET transport = 'USB', enabled = true, last_seen_at = $2 WHERE id = $1 AND kind = 'MIC' AND adapter_kind = 'USB_AUDIO'`; anything but one row throws and rolls the unit back. No statement of the module inserts into the registry (SEC35-41 (c) green, unchanged).
3. The module then writes `capture_audio_inputs` and the ONE `CAPTURE_AUDIO_INPUT_CHANGED` entry, as row 70 built it.

The serial and the port path (row 192, not committed): built against the committed columns. They go in ONE function, `cardIdentityValuesOf` of `AC/store.ts` (today `[input.usbId]`), plus their two columns in `INSERT_AUDIO_INPUT` / `REFRESH_AUDIO_INPUT`.

## 2. Evidence (database runs: sandbox off, `/usr/bin/lockf -k -t 1800 .locks/db-migrate.lock`, throw-away databases, "0 remain")

| Check | Command (from `CS`) | Result |
|---|---|---|
| Routes of row 70 on the REAL registrar | `npx vitest run --project db --maxWorkers=2 src/modules/capture-inputs/audio-cards/__tests__/routes.db.test.ts` | `Tests 1 failed | 16 passed (17)`; the one red is the schema-version pin `[7, 'dbc-8']` at `:159` (the code says `[8, 'dbc-9']`: agent D's pin, request 2). One run |
| Acceptance, product's registrar in the block | `... --project db test/acceptance/contract.test.ts test/acceptance/rbac-matrix.test.ts` | run 1: `Tests 1 failed | 77 passed (78)`: AC-B-70 (section 4) |
| Acceptance, as left | same | run 2: `Test Files 2 passed (2)`, `Tests 78 passed (78)` |
| Unit and static | `npx vitest run --project unit --maxWorkers=2 src/engine/__tests__/hosted-actions.test.ts src/modules/capture-inputs src/capture/__tests__/static.test.ts src/capture/adapters/__tests__/static.test.ts test/static src/modules/capture-discovery/__tests__/static.test.ts` | `Tests 3 failed | 319 passed (322)`; the three reds are in files of other rows (request 5); P25, A-5, SEC35-41 (c), imports: green |
| Typecheck | `npm run -s typecheck` (`CS`, and the five other workspaces of row 185's record) | exit 0 |
| Lint | `npx oxlint src/modules/capture-inputs src/engine/internal-actions.ts src/engine/host.ts` | exit 0 |

Verification cell, on a clone database with the real registrar (`routes.db.test.ts`):
- operation 99 stores (201) and the RUNNING engine's `captureDevices` slice holds `MIC-03` exactly as the action registered it; the selector slice and `capture_config` are untouched;
- registering one input twice yields 1 device, in the table and in the engine (200 REENABLED; 200 CARD_CHANGED);
- a failed input write rolls the registry row back with it: no row, no audit entry, nothing admitted, the ENGINE holds no `MIC-04`, and the next registration takes that id;
- the turned case: both microphones are in the engine and the stored rows read `USB` / `USB_AUDIO` / enabled;
- the composition: with only an enumerator put in, `registrable()` is true and a second `provideRegistrar` is refused; CONTROL: with the registrar taken away, 503.
- KEPT: `assertRecordable` refuses the registered microphone (`SOURCE_KIND_NOT_RECORDABLE`), and an adapter of the kind that claims an opener is refused.

Documented responses of `implementation/063`'s contract for operation 99, on the real registrar: 201, 200 (REENABLED, CARD_CHANGED), 400, 401, 403 (two), 404, 409 (locked, beyond the card, in progress), 422, 500 on a failed write, 503.

## 3. Operation 99 and the 503

The 503 for want of a registrar is gone: every Core has one. Operation 99 still answers 503 where NO ENUMERATOR was handed in - by design on a `SIMULATED` and a `REAL_DEVELOPMENT` Core, and on a production Core until row 85 calls `provideEnumerator` (request 4). No test of this row boots a `REAL_PRODUCTION` Core.

## 4. Requests (`delegation_progress/file_requests.md`, five lines)

1. Controller, a ruling: with the product's registrar in `contract.test.ts`, rule AC-B-70 refuses the answer of operation 77 (`["MIC-01","MIC-02","MIC-03"]`). Proposed: the device registry is exempt, as the interval lists are; then remove `registrar: standInRegistrar` from one line. Until then that block keeps the stand-in.
2. Agent D: the schema-version pin of `routes.db.test.ts:157-159`.
3. Agent D / row 192: where the two new values go.
4. Row 85: only the enumerator remains to be handed in.
5. Controller: three static reds in files of other rows (`log-calls.test.ts:163`, `search-path.test.ts:94`, adapters `static.test.ts:313`).

## 5. Driver decisions

| # | Decision | Why |
|---|---|---|
| DD-1 | The registrar is handed in by the audio-cards plugin itself, not by `app.ts` or the parent module | `app.ts` is frozen (P25); the registrar needs nothing but the unit; no `app-units` resource is touched |
| DD-2 | The registrar's statement also sets `enabled = true` | the engine writes `enabled` only when ITS state changes; a row that is off while the engine holds it online would stay off. The statement makes the stored row equal to what the action states |
| DD-3 | Transport `USB`, a literal of the statement | the transport of the built-in pair; the slice models no transport, so the mapping inserts the neutral code and never overwrites this one |
| DD-4 | `contract.test.ts` keeps the stand-in (request 1) | changing an acceptance rule is not this row's |
| DD-5 | `replaceForTest` accepts `registrar: null` | the control "no registrar = 503" stays measurable |
| DD-6 | The first block of `routes.db.test.ts` restores the registrar with `createEngineMicrophoneRegistrar()` after its control | the factory is stateless; the plugin's own instance is measured before it is replaced |

## 6. The double, and what stays unproven

The Core of every test is SIMULATED with an enumerator over fixed listing texts put in by `replaceForTest`; the adapter registry is a class-C stand-in. Unproven: a booted `REAL_PRODUCTION` Core (row 85); re-enabling a microphone the ENGINE holds offline, on a database (the transition is proven in row 185's unit table; the database case turns a row off behind the engine); a real card (`9A/H-07`); recording from a registered input (`9A/H-08`).

---
*Generated: 2026-10-13*
