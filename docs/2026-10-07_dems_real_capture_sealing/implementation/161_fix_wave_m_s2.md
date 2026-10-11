---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: fix wave M, follow-up M-S2 (apps/core-server only)
date: 2026-10-11
agent: coder-execution
narrative_tier: 2
source: implementation/158_fix_wave_m_s.md section 10 (hypothesis) and section 11 decision 4; implementation/132_fix_wave_i_a2.md (G70b-01); delegation_progress/fix_brief_wave_m.md
tree: 7b1aded + the uncommitted work of fix wave M (no commit, no migration: schema 6 / dbc-7; totals 97 / 36 / 61 / 67 unchanged; packages/shared not edited)
status: complete
---

# 161 - Fix wave M, follow-up M-S2: a camera adopted during a run and its pre-check

No lane was called, stopped or started (lane 1 stayed up: the db run had its slots). No local-device
source was on a track at any moment; no git write; `.data/` not opened.

## 1. Hypothesis: CONFIRMED on the booted path

Test written first, into the EXISTING booted file of G70b-01,
`apps/core-server/src/modules/capture-discovery/__tests__/wave-i-a2-adopt-assign.db.test.ts`
(real app factory, PostgreSQL as `dems_app`, booted `REAL_DEVELOPMENT`, the lane's camera stub on
loopback): operation 97 once (the first read of the probe in the run) -> search, test, adopt the
stub's candidate (op 96) -> assign it to `VIDEO-02` (op 79) -> new session -> pre-check through
the sessions routes. Run BEFORE any product change:

```
× M-S2: the adopted camera, assigned to a video track, PASSES the next pre-check of the same run ...
AssertionError: expected { id: 'LENS_2', status: 'WARN', …(5) } to match object { status: 'PASS' }
 ❯ src/modules/capture-discovery/__tests__/wave-i-a2-adopt-assign.db.test.ts:245:29
 Test Files  1 failed (1)   Tests  1 failed | 3 passed (4)
```

The control in the same case held (`LENS_1`, the camera that existed at the boot: `PASS`), and the
selector had taken the adopted camera with 200. After the fix: the file is green (section 5).

The order matters and is what a lane does: the fault needs ONE read of the probe before the
adoption (any pre-check, or operation 97 - opening the Devices screen). A Core whose first probe
read came after the adoption did not show it.

## 2. Cause (file:line at 7b1aded + wave M)

| Where | What |
|---|---|
| `src/capture-notices/index.ts:154-167` (before) | `adopted`: the notices unit asked its probe source "until it answers one, then kept (one adapter set per boot)" |
| `src/capture/fence/index.ts:292-295` | `probeAdapters()` answers a frozen COPY of the camera and microphone adapter lists of the moment of the call (`Object.freeze([...cameraAdapters])`) |
| `src/capture/fence/index.ts:264`, `:305-311` | `admit` (G70b-01) registers the adopted camera's adapter in the registry and pushes it into `cameraAdapters` - the next `probeAdapters()` call lists it, the copy the notices unit held did not |
| `src/capture-notices/probe.ts:85-87` | a device no listed adapter serves reads `reachable: false, cause: UNREACHABLE` |

Same class as G70b-01: a view taken once per boot that adoption does not refresh. G70b-01's own
test read `captureFenceControl(app).probeAdapters()` afresh, so it saw the camera; the product's
reader was the notices unit's kept answer.

## 3. Change

`src/capture-notices/index.ts` `probeNow` (`:155-173`): the source is asked at EVERY use and no
answer is kept. The one source of truth for "which capture devices exist and which adapter serves
them" stays the fence's registry (the one G70b-01 made adoption update); a probe is a stateless
view of it for one pre-check run (`precheck.ts:123`) or one input re-read. A source that throws is
reported at that use and answers null, as before. Comments of `provideProbeSource` and of the
wiring in `registerCaptureNotices` say so; the comment of `BuiltCaptureRegistry.probeAdapters`
(`fence/index.ts:164-169`) now states "the list of the moment of the call: ask at each use".
No behaviour of the fence changed. A probe a test PROVIDES (`provideProbe`) still wins.

Cost: one small object and two array copies per pre-check run / input re-read. Nothing is opened
or listed by building it.

## 4. Sweep: boot-time snapshots of the device / adapter list in `apps/core-server/src`

| Reader | file:line | Verdict |
|---|---|---|
| notices unit, the probe of the pre-check and of op 97 | `capture-notices/index.ts:163-173` | **was a snapshot - fixed** |
| fence, `probeAdapters()` | `capture/fence/index.ts:292-304` | a copy PER CALL of lists `admit` adds to: reads live when asked per use (now the rule, in its comment). Its only product caller is `capture-notices/index.ts:286` |
| fence, the registry | `capture/fence/index.ts:284`, `:305-311`; `capture/adapters/registry.ts:79-93` | the source of truth; `admit` registers into it (G70b-01) |
| fence, `input.devices` of the boot (`labelOf`, `firstFakeMicId`) | `capture/fence/index.ts:205`, `:253` | boot-time on purpose: the label of the two local devices and which stored microphone sounds 440 Hz; an adopted camera brings its own label (`:261`). Only cameras are adopted. Not a fault |
| pre-check gate: which devices to ask, their stored state | `capture-notices/precheck.ts:123` (probe per run), `:178` (engine state per run) | reads live |
| selector validation, ops 78 / 79 | `modules/capture-config/index.ts:141-142` | holds the ONE registry object of the boot (not a copy); `assertAssignable` reads its live map - reads live (G70b-01) |
| capture-session start (plan, recordable check) | `capture-session/index.ts:459`, `:615`, `:987` | `ports.registry()` at each use - reads live |
| supervisor | `capture/supervisor.ts` | holds no device or adapter list (it gets the plan of one session) |
| source facts (badge, "is on") | `modules/devices/source-facts.ts:102`, `:113` | `registry().list()` at each hand-over - reads live. It hands over at boot, at an open / close and at session events, not at an adoption; an adopted row carries its adapter itself, which the feed never rewrites (file header) |
| discovery: admission at commit | `modules/capture-discovery/index.ts:254-272` | the writer (G70b-01) |
| source rig (M-S) | `test/support/lane-source-rig.ts:129`, `:177-181` | `generated()` asks `fence.registry().list()` at every call; the switch function is built into an admitted adapter too (`fence/index.ts:259-263`) - reads live, pinned by the new rig case |

**The reverse (a device removed or disabled during a run).** No operation does that: no statement
in `src` deletes a `capture_devices` row or writes its `enabled`
(`grep "DELETE FROM public.capture_devices|capture_devices SET"`: only the adoption's own
`UPDATE ... SET transport, onvif_uuid, profiles, last_seen_at`, `capture-discovery/adoption.ts:28`),
the simulator's registry only appends (`packages/shared/src/sim/capture-registry.ts:80`), and the
adapter registry has no `unregister`. A row changed by hand in the database is not seen by the
running engine either (its state is read at boot). Nothing to fix, nothing to test; if a "remove
camera" operation is ever added it must take the adapter out of the registry in the same place
`admit` adds it.

## 5. Tests (which existing file took each; one run each after its last change)

| Test | File (EXISTING) | Result |
|---|---|---|
| booted path: adopt -> assign -> pre-check, `LENS_2` PASS, device `online: true`, 0 `CAPTURE_DEVICE_UNREACHABLE` alerts and rows; control `LENS_1` | `src/modules/capture-discovery/__tests__/wave-i-a2-adopt-assign.db.test.ts` (new case "M-S2"; the first G70b-01 case now makes op 97 before it adopts and hands the id on; the file keeps its manual timer) | red before the fix (section 1), green after |
| the unit rule: the fence is asked at every use; a camera admitted after the first read is read through its adapter; control before admission | `src/capture-notices/__tests__/probe-wiring.test.ts` - the pin "the probe is kept once it was read" (4 lines of the third case) REPLACED by the case "M-S2" | green |
| the source rig for an adopted camera: answers, UNREACHABLE while named (said once, never "not a fake device" once admitted), answers after release; armed before the adoption = `LANE_SOURCE_RIG_NOT_A_FAKE_DEVICE`; no helper started | `test/support/lane-source-rig.test.ts` (new describe "a camera adopted during the run") | green |

| Check | Command (repository root) | Result |
|---|---|---|
| unit: capture, capture-notices, capture-discovery, capture-config, capture-inputs folders, the rig's file, static guards | `npx vitest run --root apps/core-server --project unit src/capture src/capture-notices src/modules/capture-discovery src/modules/capture-config src/modules/capture-inputs test/support/lane-source-rig.test.ts test/static` (outside the sandbox: loopback) | `Test Files 90 passed (90)  Tests 1366 passed (1366)` |
| db: the files of those modules (16; the worker e2e rigs not included) | `/usr/bin/lockf -k .locks/db-migrate.lock npm run -s test:db -w @dems/core-server -- --maxWorkers=1 src/modules/capture-discovery src/modules/capture-config src/modules/capture-inputs src/capture/__tests__ src/capture/fence/__tests__/development-session.db.test.ts src/capture/fence/__tests__/fence.db.test.ts src/capture/adapters/__tests__/device-upsert.db.test.ts src/capture-notices` | `Test Files 16 passed (16)  Tests 96 passed (96)`; 0 databases left |
| typecheck | `npm run -s typecheck -w @dems/core-server` | exit 0 (a first run: 2 errors in my new test case, `app.engine.idle` -> `engineControl(app).idle()`; then 0) |
| lint | `npm run -s lint -w @dems/core-server` | exit 0 |

## 6. Proven by test versus live

By test only (the booted Core of the db file, with the lane's stub). NOT driven on a lane: lane 2
runs the code it booted with and is the web and mobile drivers'.

## 7. Checks for the test runner

| Command | Lock | Expected |
|---|---|---|
| `npm test -w @dems/core-server` (unit, whole) | none; outside the sandbox | green. A test elsewhere that counts calls of `probeAdapters` on a spy would be a pin to move by delta (none found in the folders run) |
| `npm run test:db -w @dems/core-server` (whole) | `.locks/db-migrate.lock` | green apart from the known baseline; `wave-i-a2-adopt-assign.db.test.ts` has 4 cases now |

## 8. Re-drive list (lane 2)

Product code changed (`capture-notices/index.ts`, saved 15:05:37 WIB): a lane 2 Core started before
that needs a restart. M-W restarted lane 2 at 15:08 WIB (`contract_wave_m.md`), after the save, and
a lane runs from source (`tsx src/...`, no build) - so the running Core most probably has the fix.
That is inferred from the two times, not checked (I call no lane).

1. Only if step 4 reads `UNREACHABLE`: restart lane 2 (`lane.sh stop 2`, `start 2 --with-camera-stub --speech-mic`, no reset) and repeat.
2. Web, Devices: open the screen (op 97), then search, test with the fixture account, "Add as
   camera" for the stub's NEW candidate -> `CAM-NN`.
3. Selector: "Camera for Camera 2" = `CAM-NN`, Save (200) - WITHOUT a restart.
4. New session -> Devices Check from the web: the row of Camera 2 PASSES; 0 banners; no
   `CAPTURE_DEVICE_UNREACHABLE` alert, no such audit row. (Before this fix: WARN "UNREACHABLE".)
5. With the rig: `lane.sh source-rig 2 unreachable CAM-NN` -> Retry: WARN + ONE alert, one warn
   line `LANE_SOURCE_RIG_ON`; `release` -> Retry: 0 banners. End with the rig OFF.
6. Put the selector back.

## 9. Seen, not changed

- `src/capture/fence/__tests__/wave-i-a2-admit.test.ts` and this db file are per-wave file names
  (candidates for the consolidation of D233); the brief names the db file as the place, so the
  case went there.
- The fence keeps two parallel lists beside the registry (`cameraAdapters`, `micAdapters`,
  `fence/index.ts:250-251`); `fakeAdapterOf` pushes into them before `registry.register` runs. They
  agree today (`admit` asks the registry first, `:306`). Deriving the probe's cameras from
  `registry.cameraAdapters()` would remove the second list; not needed for this finding.
- The device tile of an adopted camera reads "online / stream live" before any pre-check asked it
  (G70b-06, open since wave I) - unchanged.

## 10. Files

| File | Change |
|---|---|
| `apps/core-server/src/capture-notices/index.ts` | the fix (`probeNow`), three comments |
| `apps/core-server/src/capture/fence/index.ts` | one comment (`probeAdapters`), no code |
| `apps/core-server/src/modules/capture-discovery/__tests__/wave-i-a2-adopt-assign.db.test.ts` | case "M-S2"; op 97 before the adoption; the timer kept |
| `apps/core-server/src/capture-notices/__tests__/probe-wiring.test.ts` | obsolete pin replaced by case "M-S2" |
| `apps/core-server/test/support/lane-source-rig.test.ts` | one case (the rig for an adopted camera) |
| docs | `delegation_progress/contract_wave_m.md` ("MS2 consistent at 15:10"), `file_claims.md` (one line), this note |

---
*Generated: 2026-10-11 15:12 WIB*
