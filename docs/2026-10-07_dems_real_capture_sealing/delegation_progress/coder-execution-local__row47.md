# coder-execution-local - row 47 (M2-W6 shared domain/contract foundation, tier 3)

Status: **COMPLETE** (shared workspace green: typecheck, lint, suite at/above floor; all four named
proofs quoted in the artifact). Date: 2026-10-08. Blueprint rev 2.1 row 47; dependency row 45 verified
satisfied before start (its artifact `implementation/10_m2_schema_check.md` read, including D-b).

Deliverable: `docs/2026-10-07_dems_real_capture_sealing/implementation/14_m2_shared_contract.md`
(Tier 3) plus this note. Edits are confined to `packages/shared/**`. No file under
`apps/core-server/**`, `apps/mock-core/**`, `release/**`, or any controller tracker was touched. No
commit, no push, no database contact, no sudo, no Homebrew write.

## Result summary

| Measure | Before | After |
|---|---|---|
| `M2-RG-SHARED` (`CI=true npm run test -w @dems/shared -- --maxWorkers=2 --run`) | exit 0, 71 files / 1,851 tests | **exit 0**, `Test Files 71 passed (71)`, `Tests 1857 passed (1857)` (floor 71/1,851) |
| Shared `FaultKind` (CL-12 side) | 12 values | **14**, `MIC_SILENT` + `CAPTURE_FAULT` appended in contract order (D-b) |
| Replicated slices (`M2-API-3` clause) | 28 | **30** (`captureConfig` 29, `captureDevices` 30) |
| Permissions / grants in `sim/auth.ts` | 12 / 18 (4+10+4) | **14 / 22** (INVESTIGATOR 5, SUPERVISOR 12, TECHNICIAN 5 = `dbc-3 §E.3`) |
| Domain entities | 24 | **31** (7 new per SH-02, book order kept as a prefix) |
| `meters.audio` key | `channels{AUDIO-01,AUDIO-02}` | **`inputs{MIC-01,MIC-02}` + `activeInputId`** (SH-17/E-02) |
| `@dems/shared` typecheck / lint | 0 / 0 | **0 / 0** |
| `@dems/mock-core` (read-only, run only) | 4/19 | **4/19**, exit 0 |
| Files changed under `packages/shared` | - | 48: 26 src (+985/-80), 21 test (+119/-74), `openapi.json` regenerated (+618/-34) at unchanged 0.2.1 / 0.1.0 and 75 ops |

## Proofs (must be able to fail; both harnesses exit 1 on any miss)

* **CL-12 / D-b** - `npx tsx .cache/row47/cl12-faultkind.ts` -> exit 0. Both lists printed and equal
  element by element: `["CAMERA_LOSS","MIC_NO_SIGNAL","MIC_CLIP","STORAGE_LOW","STORAGE_FULL",
  "GNSS_LOSS","TAMPER","FAN_STALL","POWER_FAIL","TPM_FAILURE","SECURITY_FAULT","AUDIT_TAMPER",
  "MIC_SILENT","CAPTURE_FAULT"]` for shared `FaultKind` and for `value-sets.ts` `FAULT_KIND`;
  `IntegritySource` (3, incl. `REAL`) equals `INTEGRITY_SOURCE` too.
* **M2-API-3 slice clause** - `npx tsx .cache/row47/slice-count.ts` -> exit 0: 30 names, index 28 =
  `captureConfig`, index 29 = `captureDevices`, both classified replicated, each parses its own
  `delta replace` literal.
* **E-04** - the only non-comment `AdminResource.*` references in `packages/shared` are the four
  pre-existing paired-client lines (`realtime-messages.ts:161/162/163/390`); `git diff` shows no
  `+`/`-` line touching the `AdminResource` definition; the harness asserts the enum still holds
  exactly `USERS`, `DEVICES`, `PAIRING_CODE` and that no capture value joined it.

## Scope boundary kept

SH-03's audit-type half (the 9 new types, 53 -> 62) was **left to row 48**, which names it
explicitly; SH-08's behavioural re-key (fault targets, timeline channel, health, scenarios, the
silence-warning path) was **left to row 51**; op 45's response re-key and the API constants module
were **left to rows 48/50**. This row did the vocabulary, entities, RBAC, sim types, the two slices,
the meters wire+slice re-key, and the i18n copy.

## Routed to the controller (detail in §9/§10 of the artifact)

* **Client-side consequence of SH-17 (needs routing).** Re-keying `meters.audio` breaks consumers no
  M2 row owns. Root `npm run typecheck` exits 2 with `@dems/shared` and `@dems/mock-core` clean and
  24 errors in `@dems/core-server` (rows 49/51/52 own those files), 16 in `@dems/core-web` (row 67),
  9 in `@dems/mobile` (rows 68/87). Measured web fallout:
  `Test Files 20 failed | 97 passed (117)` / `Tests 91 failed | 1404 passed (1495)`, and a single-file
  run (`src/components/composed/__tests__/dbfs-meter.test.tsx`) exits 1 at
  `sim.store.getState().audio.channels['AUDIO-01']`. So `M2-RG-WEB` / `M2-RG-MOB` cannot be green at
  the M2 gate unless the meter adaptations of rows 67/68/87 are pulled forward, or the gate accepts
  them red with cause. The alternative - keeping the v1 key - would have left E-02 uncorrected.
* **Six decisions recorded (D-c-1..D-c-6):** authority anchors instead of invented EVT IDs for the two
  new fault kinds; `CaptureDeviceKind` follows the DB set `CAMERA/MIC/POE` rather than C3 §6's
  "MICROPHONE" (an erratum for C3 §6 - the shape summary cannot represent `POE-SWITCH`); the precheck
  pair added alongside `MIC_1`/`MIC_2` instead of renaming them; `openapi.json` regenerated without
  version changes; the two new permissions pinned with empty operation lists until row 48 wires ops
  78/79/80/89 and 85.
* **Row 45's D-b is now closed:** the shared side of the CL-12 pin is true on this machine, so row 46's
  catalog comparison has both halves available.

## Anti-hang compliance

Every suite ran non-interactively: `CI=true` + vitest `run` mode + `--maxWorkers=2`, output redirected
to a log, exit code captured from the command itself. No watch mode, no stdin wait, no polling loop.
The one long external observation (the web workspace, run for fallout evidence only) was a tracked
background process, not a blocking wait.
