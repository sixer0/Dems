---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 50 (phase C, milestone M2, class B; M2-W8; blueprint rev 2.1)
date: 2026-10-08
agent: coder-execution-local
source_plan: identification/02_structured.md rev 2.1 row 50 (:213) + standing invariants (:199); masterplan/03_api_contract.md (C3) §8; masterplan/10_test_strategy.md §C (category-B pin list) + §A.2 (M2-API-1/2, M2-PIN-1); artifact implementation/15_m2_api_contract.md (row 48 registry pinned against)
narrative_tier: 3
status: completed - shared side green at the new pins; shared suite down to ONLY the three row-51a sim-route tests
closes: SH-19, WB-09, CS-25, E-06, W1-C9
depends_on: row 48 (DONE - implementation/15_m2_api_contract.md, shared green at 89 ops)
---

# Row 50 / M2-W8: OpenAPI versions + pinned counts

## 0. Scope and lockfile discipline

This row bumps the two OpenAPI document versions, regenerates `packages/shared/openapi/openapi.json`,
and re-pins the operation/slice/offline counts across the category-B pin files of test strategy §C.
It is the SOLE lockfile writer this turn.

**Anti-hang:** no `timeout` binary exists on this macOS host, so a POSIX shim
(`python3 subprocess.run(timeout=...)`) was installed on PATH; every command ran under
`timeout ... </dev/null`, CI mode, `--maxWorkers=2`, never watch, never stdin.

**Sole lockfile writer:** every `openapi:gen` invocation (the `--check` probe, the write, and the
post-write determinism recheck) ran inside `/usr/bin/lockf -k .locks/npm.lock ... node --import tsx
scripts/gen-openapi.ts`, which holds an exclusive lock on `.locks/npm.lock` for the command's
lifetime and releases it when the command exits. No `npm install` was run; the lock was held only
for the generator steps and released promptly. Row 49 (concurrent) does not touch the lockfile or
`openapi:gen`; there was no collision.

## 1. Verification results (raw command output quoted)

| Check | Command | Result |
|---|---|---|
| **M2-API-1** registry vs regenerated document agree at 89 | `lockf -k .locks/npm.lock timeout 300 node --import tsx packages/shared/scripts/gen-openapi.ts` | `wrote packages/shared/openapi/openapi.json (all (committed): 89 operations, 2 security schemes, version 0.3.0; offline: 23 operations, 0 security schemes, version 0.2.0; 1132176 bytes)` |
| **M2-API-1** drift-free (byte-for-byte) | `... gen-openapi.ts --check` (re-run after write) | `packages/shared/openapi/openapi.json is up to date (all (committed): 89 operations, 2 security schemes, version 0.3.0; offline: 23 operations, 0 security schemes, version 0.2.0)` exit **0** |
| **M2-API-1** recount of the committed file | python over `openapi.json` | version **0.3.0**; paths **85**; ops **89**; GET **34**; POST **55**; components.schemas **152**; securitySchemes `[sessionCookie, bearerAuth]` |
| **M2-API-2** versions | grep of `openapi.ts` constants | `OPENAPI_CORE_SERVER_DOCUMENT_VERSION = '0.3.0'` (was 0.2.1); `OPENAPI_DOCUMENT_VERSION = '0.2.0'` (was 0.1.0); `OPENAPI_VERSION = '3.1.0'` unchanged; offline scope builds at **23 operations, version 0.2.0** |
| **M2-PIN-1** off-by-one stale-pin grep (88 / 54 / 22) | `rg` over `packages/shared/test` | `toHaveLength(88)`/`88 operations` -> **0 hits**; `toHaveLength(54)`/`54 POST` -> **0 hits**; every `22` is the correct simulated-op count (`x-dems-mode==='simulated'` = 22), never an offline count (offline asserts 23) |
| **M2-PIN-1** section-C X-PIN-1 grep | `rg "toHaveLength(75)\|75 operations\|toHaveLength(28)\|28 slices\|dbc-2\|'0.1.0'\|'0.2.1'\|DB_SCHEMA_VERSION = 1"` over the 5 category-B shared files | **0 hits** (exit 1) |
| shared typecheck | `timeout 300 npx tsc --noEmit -p packages/shared </dev/null` | **exit 0** |
| shared lint | `timeout 300 npm run lint -w @dems/shared </dev/null` | **exit 0** |
| **shared suite** | `timeout 1800 env CI=true npm run test -w @dems/shared -- --maxWorkers=2 </dev/null` | **Tests 3 failed / 1864 passed (1867); Test Files 1 failed / 71 passed (72)** - the 3 are ONLY `openapi.test.ts` #16/#17/#18 (row-51a sim routes; see §4) |

Baseline before this row (row 48 close-out): Tests 1849 passed / 18 failed. After this row: 1864
passed / 3 failed. Delta **+15 passing / -15 failing** = exactly the 15 OpenAPI-drift tests this row
turns green (12 in `api-openapi-scope.test.ts` + 3 in `openapi.test.ts` #13/#14/#15).

## 2. Version bump (`packages/shared/src/api/openapi.ts`)

Per C3 §8 the exact edits are the two string literals plus their comments; no other constant changes
(`OPENAPI_VERSION` stays `3.1.0`). Applied:

- `OPENAPI_DOCUMENT_VERSION` `'0.1.0'` -> `'0.2.0'` (offline scope; OD-17 D4 adds the simulated capture ops).
- `OPENAPI_CORE_SERVER_DOCUMENT_VERSION` `'0.2.1'` -> `'0.3.0'` (all scope; C3 §8, capture/transcript ops 76-89).
- Header table (`Operations`, `info.version`, `Badges` rows) and the offline byte-for-byte paragraph
  rewritten to the OD-17 reality (offline 10 -> 23, superseded baseline pin). These are documentation
  lines in the same file whose version literals row 50 owns; they carry no logic and were updated so
  the section-C stale-pin grep returns 0.

`openapi.ts` is the document builder/version holder that C3 §8 assigns to this row ("M2 owns the
edit"); it is NOT the operation registry (`core-api.ts` / `devices.ts` / `sessions.ts` / `evidence.ts`)
that row 48 owns. No registry source was edited.

## 3. Regeneration + count re-pin

`npm run openapi:gen -w @dems/shared` (run as `node --import tsx scripts/gen-openapi.ts` per the D49
sandbox note) rewrote `openapi.json` to the `all` scope at 89 ops / 0.3.0. The builder is
deterministic (constants + zod schemas only), proven by the post-write `--check` returning exit 0.

Category-B shared pin files re-pinned (test strategy §C "B - operation count" + "OpenAPI document
versions" rows; the 5 shared files of the 14-file B family):

| File | Re-pin |
|---|---|
| `test/api-openapi-scope.test.ts` | offline block re-pinned to the OD-17 scope (23 op ids, 39 component names, version 0.2.0; servers/tags/headers stay byte-equal to `acaff20`; the six untouched baseline ops and eight untouched baseline schemas keep their byte-hash guards, the four M2-modified ops / six M2-modified schemas assert they legitimately diverge). all block: AC-B-11 89 ops + version 0.3.0; 89 ops / 85 paths / 34 GET / 55 POST; 22 simulated / 67 live / 67 no-simulated; permission-carrying 41 -> 51; security-shape `[3,1,6,65]` -> `[3,1,6,79]`; summary `75 operations` -> `89 operations`, `66 operations` -> `67 operations`; components 132 -> 152 |
| `test/openapi.test.ts` | `OFFLINE_SCHEMA_NAMES` 18 -> 39; "has 10 operations" -> "has 23 operations" (health LIVE + 22 simulated, nine book §21.2 kept as an independent subset pin, SIMULATED badge 9 -> 22); drift check 75 -> 89; component-per-scope slice check replaced by a registry-order subsequence assertion |
| `test/api-registry.test.ts` | header comment + `describe('routing over 75 operations')` title -> 89 (numeric assertions already reconciled by row 48) |
| `test/api-state-examples.test.ts` | `describe('the examples of all 75 operations')` -> 89 |
| `test/client-types.test.ts` | TS2590 regression comment `(75 operations)` -> 89 |
| `scripts/gen-openapi.ts` | committed-scope header comment 75/0.2.1 -> 89/0.3.0; offline "ten operations" -> "23 operations" |

R-8 operations 90-92 are NOT pinned here (proposed only until Q-STT-CFG; row 113 re-pins in M6, CF-11).

## 4. Residual red - exactly three, all row-51a (not clearable by regen)

The only remaining failures are `openapi.test.ts` #16/#17/#18, which exercise `sim/api.ts` handlers
directly and do NOT read `openapi.json`; regeneration cannot turn them green. They need the simulator
to answer the capture ops and emit the op-44 device-health v2 shape, which lives in
`packages/shared/src/sim/**` (off-limits to this row; owned by the row-51 re-run, "row 51a"):

- #16 `the simulator's route table lists exactly the 9 simulated operations` - `SIM_API_ROUTES` = 9 vs registry-simulated = 22 (the 13 capture ops have no sim route yet).
- #17 `every documented simulated status is produced by the simulator` - simulator `getDeviceHealth` still emits the pre-op-44 shape (no `streamState`, AUDIO-keyed audio), fails validation against the modified schema.
- #18 `the device-health and storage examples equal the idle simulator` - same device-health v2 shape gap.

`api-openapi-scope.test.ts` is fully green (was 12 red). This matches the brief's expected pass/fail
split precisely.

## 5. Boundary respected + integration gap routed

- Did NOT edit `packages/shared/src/api/**` beyond the `openapi.ts` version literals/comments C3 §8
  assigns to this row; did NOT edit `src/sim/**`; did NOT touch `apps/**`, `apps/mock-core`/`release`,
  or controller trackers.
- **App-side category-B pins remain stale (routed to the controller on the board).** The §C B family
  also lists 9 app-side files still at 75/27/48: `apps/core-server/test/acceptance/contract.test.ts`
  (:374-380), `rbac-matrix.test.ts` (:899/:1043/:1304/:1317/:1351), and
  `apps/core-web/src/test/live-api-reference-{document,page}.test.tsx`. C3 §8 names row 50 as owner,
  but this row's hard constraint forbids `apps/**` (row 49 runs concurrently under
  `apps/core-server/src/db/**`). They need an app-side owner (row 50b or the M2 gate) before the full
  M2-PIN-1 sweep and the core-server `M2-API-1` acceptance command go green.
- Two stale COMMENTS remain in row-48-owned registry files this row must not edit:
  `packages/shared/src/api/core-api.ts:52` and `packages/shared/src/api/index.ts:27` ("75 operations").
  Functional pins there are correct (row 48); only prose lags. Flagged for row 48 / the gate.
- False positives of the crude `'0.1.0'` grep, deliberately left unchanged (NOT OpenAPI document
  versions): `src/api/examples.ts:145` and `test/schemas.test.ts:25` hold the mock-core
  `HealthResponse.version` service field.

## 6. Files changed in THIS session

| File | Change type | Note |
|---|---|---|
| `packages/shared/openapi/openapi.json` | regenerate | `all` scope 89 ops / 0.3.0 / 152 components (via `openapi:gen` under npm.lock) |
| `packages/shared/src/api/openapi.ts` | modify | version literals + comments (C3 §8-owned lines only) |
| `packages/shared/scripts/gen-openapi.ts` | modify | committed-scope header comment |
| `packages/shared/test/api-openapi-scope.test.ts` | modify | offline OD-17 re-pin + all-scope count/version re-pin |
| `packages/shared/test/openapi.test.ts` | modify | offline schema/op/badge re-pin + drift 89 |
| `packages/shared/test/api-registry.test.ts` | modify | two stale count strings (file otherwise row-48-owned) |
| `packages/shared/test/api-state-examples.test.ts` | modify | one stale count string |
| `packages/shared/test/client-types.test.ts` | modify | one stale count string |

## 7. Issues & decisions log

- **D-50-1 (interpretation):** editing `openapi.ts` version literals is in-scope for row 50 (C3 §8
  names them; row 48 §5 defers them to row 50). The "do not edit `src/api/**`" constraint protects the
  operation registry, not the document-builder version constants. Disclosed.
- **D-50-2 (OD-17 restructure):** the offline byte-for-byte-to-`acaff20` pin is superseded by OD-17
  (D4; C3 §8). Rather than re-hash dozens of legitimately-changed sections, the offline block now
  pins the OD-17 structure (op ids, component names, version) and keeps byte-guards only on the
  sections the capture work did not touch (servers/tags/headers; six baseline ops; eight baseline
  schemas). This preserves a real regression guard while honouring the supersession.
- **D-50-3 (attribution):** `openapi.test.ts` #16/#17/#18 stay red pending row 51a; recorded so the M2
  gate does not expect row 50 alone to green `openapi.test.ts`.
- **D-50-4 (gap):** app-side category-B pins + two src/api comments left stale by the apps/** and
  registry ownership boundaries; routed to the controller.

## 8. Next steps

- Row 51a (post-row-48 sim re-run): add capture-op sim routes + op-44 device-health v2 shape -> greens
  `openapi.test.ts` #16/#17/#18 and completes M2-RG-SHARED at exit 0.
- App-side owner (row 50b / M2 gate): re-pin the 9 core-server + core-web category-B files to 89/34/55.
- Row 113 (M6): re-pin for R-8 ops 90-92 if Q-STT-CFG confirms (CF-11).

---
*Generated: 2026-10-08 (row 50 completion run)*
