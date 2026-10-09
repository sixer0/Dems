---
task_id: RECON-B (controller-added reconciliation row, DEMS task 3 M2 gate)
task_slug: recon-core-server
date: 2026-10-08
agent: coder-execution-local
status: needs-review
---

# Implementation Report — RECON-B: bring `apps/core-server` green after M2 shared-shape changes

Scope honoured: edited ONLY `apps/core-server/**`. Did NOT touch `packages/shared/**`, `apps/core-web`,
`apps/mobile`, `apps/mock-core`/`release`, `openapi.json`, the lockfile, or controller trackers.
No assertion deleted/weakened/skipped; no timeout raised. DB work used throwaway DBs under
`/usr/bin/lockf -k .locks/db-migrate.lock`; live `dems_demo`/v1 lanes untouched; host `:5432` untouched;
throwaways dropped; PostgreSQL left RUNNING on `127.0.0.1:4432`.

## Headline

- **tsc `apps/core-server`: exit 0** (was ~25 consumer errors). ✅
- **lint `@dems/core-server` (oxlint): exit 0.** ✅
- **DB project — the three brief-listed files: exit 0, 62/62 pass** (`effects.db`, `cli.db`, `reset-failures.db`). ✅
- **Unit suite: 81 → 64 failing tests** (3938 pass). ❌ NOT green — the residual failures are NOT stale pins; they are core-server SOURCE-BEHAVOUR gaps (B1) and expectations that depend on documents OUTSIDE `apps/core-server` (B2). See Remaining Items.

## Executed Steps

| Step | Task | Status | Notes |
|------|------|--------|-------|
| 1 | Enumerate tsc consumer errors | done | ~25 errors, 4 categories |
| 2 | Enumerate unit suite | done | 81 failed / 3921 passed (29 files) |
| 3 | Fix all tsc consumers → tsc exit 0 | done | audio re-key, sessionCreatorId, op-42 QUEUED, SESSION_HOLDER |
| 4 | Correct brief-enumerated pins | done | writers key-count, §9.4 perms/grants, cli.db seed, reset schema-version |
| 5 | Correct additional clean literal pins | done | registry 75→89, error-code 31→40, meter marker, perms-not-stored regex |
| 6 | Run + verify 3 brief-listed DB files under lockf | done | all pass; throwaways dropped; PG left running |
| 7 | Re-run unit suite | done | 64 remain (B1/B2/spec-entangled) |

## Changes Made (all under `apps/core-server/**`)

| File | Change type | Description |
|------|-------------|-------------|
| src/modules/evidence/index.ts | modify | op-42 accepted status `'EXPORTED'`→`'QUEUED'` (matches landed `EvidenceExportAcceptedSchema`) |
| src/engine/__tests__/ticks.db.test.ts | modify | meters frame `.audio.channels`→`.audio.inputs` (AudioSlice re-key) |
| src/engine/__tests__/write-plan.test.ts | modify | `METER_FRAME_MEMBERS` marker `"channels"`→`"inputs"` (AudioSlice re-key positive control) |
| src/db/mapping/__tests__/to-rows.test.ts | modify | audio slice re-key (test fixture) + §9.4 permission/grant counts |
| src/plugins/permission-guard/__tests__/decision.test.ts | modify | `granted()` satisfies SESSION_HOLDER (creator=self); 13 inline literals get `sessionCreatorId`; cells 675→801 |
| src/plugins/permission-guard/__tests__/denial.test.ts | modify | 3 sites get `sessionCreatorId: null` default before spread |
| src/modules/rbac/__tests__/matrix.db.test.ts | modify | 2 sites get `sessionCreatorId: principal.operatorId`; OPERATOR narrowing |
| test/acceptance/rbac-matrix.support.ts | modify | faithful `SESSION_HOLDER` case (mirrors decision.ts) + `CallerFacts.sessionCreatorId` + `OperatorRole` import |
| src/plugins/permission-guard/__tests__/access-rules.test.ts | modify | operationIds 75→89; kind breakdown; conditions list += switchAudioSource/SESSION_HOLDER |
| src/plugins/permission-guard/__tests__/guard.test.ts | modify | ALL_OPERATIONS 75→89 |
| src/plugins/permission-guard/__tests__/matrix.test.ts | modify | SHARED_GRANTS 18→22; RULES 75→89; extras `3*14-22` |
| src/core/__tests__/writers.test.ts | modify | forbidden-key length 17→28 |
| src/plugins/error-envelope/__tests__/api-failure-code.test.ts | modify | API_ERROR_CODES 31→40 |
| src/modules/rbac/__tests__/routes.test.ts | modify | permissions-not-stored regex extended to landed 14-permission list |
| src/db/reset/__tests__/cli.db.test.ts | modify | first-build total 301→307; SEED_COUNTS permissions 12→14, role_permissions 18→22 |
| src/db/reset/__tests__/reset-failures.db.test.ts | modify | "another schema version" uses 1 (prior) not 2 (now current); message dbc-2→dbc-3, builds version 2 |

## Pin corrections (before → after) and the assertion each satisfies

| File:line | Before | After | Satisfies (landed contract source) |
|-----------|--------|-------|-------------------------------------|
| evidence/index.ts:240 | `status:'EXPORTED'` | `status:'QUEUED'` | `EvidenceExportAcceptedSchema` = `z.literal('QUEUED')` (core-api.ts:568) |
| ticks.db.test.ts:327 | `.audio.channels` | `.audio.inputs` | `AudioSlice` re-keyed to `inputs`+`activeInputId` (sim/types.ts:544) |
| write-plan.test.ts:13 | `'"channels"'` | `'"inputs"'` | same AudioSlice re-key (positive-control marker) |
| to-rows.test.ts:126 | `{channels:{…,'AUDIO-01'}}` | `{…before.audio, inputs:{…,'MIC-01'}}` | same AudioSlice re-key (keeps "changes no row" intent) |
| decision.test.ts granted()+13 literals | no `sessionCreatorId` | granted→operatorId; literals→null | `AccessCaller.sessionCreatorId` required (decision.ts:72); only op-81 carries SESSION_HOLDER |
| denial.test.ts ×3 | base lacks key | `sessionCreatorId:null` before `...caller` | same; fixes `undefined` widening |
| matrix.db.test.ts ×2 | no key | `sessionCreatorId: principal.operatorId` | same; keeps `expected()` (ignores SESSION_HOLDER) valid |
| rbac-matrix.support.ts:449 | SESSION_HOLDER fell to `never` | explicit SESSION_HOLDER case | mirrors decision.ts holder rule |
| writers.test.ts:159 | length 17 | length 28 | `AUDIT_DETAIL_FORBIDDEN_KEYS` landed = 28 (row 112 +credentialRef/credentialValue/apiKey) |
| decision.test.ts:100 | cells 675 | cells 801 | `CORE_API_OPERATIONS.length`=89 × 9 callers |
| access-rules.test.ts:57/59 | 75 | 89 | registry length (shared, green) |
| access-rules.test.ts:70 | AUTH 25 / PERM 40 | AUTH 29 / PERM 50 | computed from landed registry |
| access-rules.test.ts:115 | (no switch entry) | +['switchAudioSource','SESSION_HOLDER'] | registry condition (sessions.ts:570) |
| guard.test.ts:251 | 75 | 89 | registry length |
| matrix.test.ts:34 | 18 | 22 | shared role table grant count |
| matrix.test.ts:35 | 75 | 89 | registry length |
| matrix.test.ts:90 | `3*12-18` | `3*14-22` (=20) | 3 roles × 14 permissions − 22 grants |
| to-rows.test.ts §9.4 | sortOrder[1..12]/18/[4,10,4] | [1..14]/22/[5,12,5] | shared Permission(14)/ROLE_PERMISSIONS(I5,S12,T5) |
| cli.db.test.ts:107 | 301 rows | 307 rows | MEASURED seed output (row 49) |
| cli.db.test.ts SEED_COUNTS | perms 12 / rp 18 | perms 14 / rp 22 | MEASURED seed output |
| reset-failures.db.test.ts:432/437 | set v2, msg "v2(dbc-2)…builds v1" | set v1, msg "v1(dbc-3)…builds v2" | `DB_SCHEMA_VERSION=2`, `DB_CONTRACT_REVISION='dbc-3'` |
| api-failure-code.test.ts:24 | 31 | 40 | `API_ERROR_CODES` from `@dems/shared/api` |
| rbac/routes.test.ts:196 | `…DEMO_CONTROL$` | `…DEMO_CONTROL, CAPTURE_CONFIG, TRANSCRIPT_REVISE$` | shared Permission order (14) |

## Test Results

| Suite | Command | Result |
|-------|---------|--------|
| tsc | `npx tsc --noEmit -p apps/core-server` | **exit 0** |
| lint | `npm run lint -w @dems/core-server` (oxlint) | **exit 0** |
| unit | `npm run test -w @dems/core-server -- --maxWorkers=2 --run` | **exit 1** — 64 failed / 3938 passed (was 81 failed) |
| db (3 brief files) | `test:db effects.db cli.db reset-failures.db` under lockf | **exit 0** — 62/62 pass; teardown dropped 3, 0 remain |

## STOP items — Remaining (NOT fixable as pins within scope)

### B1 — core-server SOURCE-BEHAVIOUR gaps (need implementation, not expectation edits)
- **Realtime/engine replicated-slice persistence (25 tests):** hub.state(17), hub.lifetime(3), hub.control(3), hub.principal-cap(1), messages(1). Root: `DURABLE_SLICE_KEYS` (db/mapping) does not classify `captureConfig`/`captureDevices` as durable, so the engine's committed state omits them while the landed `WsServerMessageSchema` requires them → snapshot ZodError. Needs mapping+rehydrate+write-plan+durable-slice wiring (and their DB storage/seed).
- **engine/delta.test.ts (1):** `[...DURABLE_SLICE_KEYS]` (28) ≠ `REPLICATED_SLICE_NAMES` (30) — same root.
- **db/mapping/to-rows.test.ts "the slices" (1):** 33→35 slices / stored/snapshot/not-mapped counts — same durable-slice classification.
- **db/mapping/round-trip.test.ts (1):** evidence `files[]` + `fragmentChainHead` lost on round-trip → mapping (evidence.ts) does not persist them.
- **db/mapping/changes.test.ts (1):** session update must carry `transcriptStatus` column → mapping gap.
- **db/mapping/static.test.ts (1):** `mapping/slices.ts:91` trips the purity scan (clock/random/process/statement) → source impurity.
- **modules/devices/static.test.ts (1):** `status.ts:156/177` name a permission/role → source violates "stage 6 only".
- **modules/sessions/routes.test.ts (2):** module has NOT registered `switchAudioSource`, `listAudioSourceIntervals`, `getSealingProgress` (routes missing).
- **modules/evidence/routes.test.ts (2):** module has NOT registered `createEvidenceMediaSession`, `createTranscriptRevision`, `getEvidenceExportJob`, `getTranscript`, `listTranscriptRevisions`.
- **db/fixtures/audit-details.test.ts (6) + build.test.ts (2) + writers.test.ts (3):** fixture/server do not write all 62 audit types / the expanded server allow-list (e.g. CAPTURE_CONFIG_CHANGED absent). Pin-only bumps would still fail on the co-located "fixture writes it" assertions.

### B2 — expectations that depend on documents OUTSIDE `apps/core-server` (cannot edit here)
- **test/db/contract-inventory.test.ts (10)** and **test/db/commands.test.ts (1):** compare the drizzle schema (now 40 tables, new columns/constraints/bytea/migrations/value-sets/denied-keys) against the checked-in inventory generated from `docs/2026-10-04_dems_backend_rbac_pairing/masterplan/03_database_contract.md` (still 30). Greening requires editing THAT v1 contract doc + regenerating `contract-inventory.json` — outside the edit scope.
- **test/acceptance/rbac-matrix.test.ts** (via rbac-matrix.support.ts): reads `docs/2026-10-04_.../masterplan/01_specs.md` ("the 75 rows", AC-B-16 counts). The support file now compiles (SESSION_HOLDER case added), but the acceptance test cannot pass until that spec doc reflects the 89-op registry.

### A-spec — literal summary counts that encode v1 spec numbers changed by registry growth (recommend controller ruling)
- **decision.test.ts (1):** AC-B-16 denied cells `INVESTIGATOR 22` → measured 27 (SUPERVISOR/TECHNICIAN need the same re-derivation over 89 ops). Substantive per-operation matrix already passes.
- **denial.test.ts (1):** audited-row formula `73+22+3+31` needs re-derivation for 89 ops + SESSION_HOLDER audited refusals.
- **modules/contract-values.test.ts (1):** device-command count 4→3 — depends on the contract table source; verify before changing.

### Security-intent static scans (recommend security/controller ruling — did NOT widen unilaterally)
- **permission-guard/static.test.ts (3):** two expect `session-holder.ts` in the file/SELECT lists (mechanical add of a real landed file); one flags `decision.ts:205` naming `SUPERVISOR` (the SESSION_HOLDER special-case, not a grant). Loosening the ROLE_NAME guard is a judgment call.
- **test/static/search-path.test.ts (1):** expects the migration allowlist to include `0005_capture_privileges.sql` + `0007_stt_config_privileges.sql` (real landed files following the 0002 pattern).

## Notes / Decisions
- `granted()`/matrix.db callers set `sessionCreatorId` to the caller's own operatorId so SESSION_HOLDER holds — this is what makes the substantive AC-B-16 per-operation matrix pass for INVESTIGATOR on op-81 (switchAudioSource), matching the landed holder rule.
- All count pins were set to values MEASURED from the actual run or READ from the landed shared enum/registry — never guessed.
- The brief's "~25 consumer errors" was accurate for tsc; the unit-suite reality (81) revealed the M2 landing is materially incomplete in core-server source, which is why full green is out of reach for a reconciliation row.

## Next Steps
- Route B1 (durable-slice persistence, module route registration, mapping purity/round-trip/transcriptStatus, audit-fixture coverage) to the owning M2 rows.
- Route B2 (v1 `03_database_contract.md` + `01_specs.md` regeneration) to the doc-owner row; then regenerate `contract-inventory.json`.
- Controller ruling on A-spec summary counts and the two security-intent static scans.

---
*Generated: 2026-10-08 ~09:35Z by coder-execution-local (RECON-B).*
