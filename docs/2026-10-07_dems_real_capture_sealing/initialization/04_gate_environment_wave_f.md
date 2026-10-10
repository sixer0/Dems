---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: environment preparation for the milestone gates (wave F, decision D174)
date: 2026-10-10
agent: coder-execution (rules D94 / D122 / D163)
narrative_tier: 3
status: needs-review - everything asked is done and smoked; two decisions to rule (F-1 host file, F-2 dems_demo stays SIMULATED)
---

# 04 - Gate environment, wave F

Tree `abf742f` (schema 6 / `dbc-7`). No commit, no product source edited, no emulator, no adb, no
browser, no gate check. `.data/pg*.env` and the pwfile were not read by me; every database command
went through the project's npm scripts under `/usr/bin/lockf -k .locks/db-migrate.lock`. No local
device was selected, pre-checked or started; neither attendance variable was set. Everything is
stopped at the end (only PostgreSQL 127.0.0.1:4432 listens).

## 1. State found

`lsof -nP -iTCP -sTCP:LISTEN | grep -E ':(442[0-3]|44[0-9]{2})\b'` at the start: only
`postgres 127.0.0.1:4432`. No Core, no lane Vite, no Metro, no capture worker, no emulator process.
Nothing was stopped.

## 2. Databases - migration 0013 / 0014

Order: lanes first, `dems_demo` last. Each: `db:status`, `db:migrate` (under the lock), `db:status`.

| Database | Before | Migrate | After |
|---|---|---|---|
| `dems_lane_1` | `5; dbc-6`, 13 applied + 2 pending, ledger matches, 42 tables | applied 0013, 0014 | `6; contract revision dbc-7; this code expects 6 (dbc-7)`, `15 file(s); ledger matches`, 43 tables, `core_media_store 0`, `db:status: OK` |
| `dems_lane_2` | same | same | same |
| `dems_lane_3` | same | same | same |
| `dems_demo` | same (5 paired devices) | same | same |

No refusal, no ledger mismatch, nothing dropped or recreated. Audit heads and row counts were
unchanged by the migration (lane 1 seq 102, lane 2 104, lane 3 111, demo 83 before and after).

## 3. Once per machine

| Item | Result |
|---|---|
| Helper copy | `.data/helpers/ffmpeg` was present (0755 in a 0700 directory, owner the user), runs `ffmpeg version 9.0.2`; NOT re-copied. The Core's own rule accepted it at the lane-2 boot (`capture fence passed`) |
| Development signing key | `npm run evidence:dev-key -w @dems/core-server` -> `OK, a DEVELOPMENT signing key was provisioned (not for production)`, directory `.data/signer`, key id `CORE-KEY-EVSIGN-01`, subject `CN=CORE-KEY-EVSIGN-01,OU=DEVELOPMENT KEY - NOT FOR PRODUCTION,O=DEMS Core`, certificate sha256 `8350f180...78fb157d`. The data directory is ONE for every Core (`DEFAULT_DATA_DIR`, no variable changes it), so `.data/signer` serves all lanes. No key material printed |
| Capture worker | `apps/capture-worker/build/capture-worker` is newer than every file of `src/` and the Makefile: not rebuilt. Boot handshake: `capture-worker/0.4.0` |
| Transcriber host file (FOUND, decision F-1) | The first lane-2 boot stopped: `"check":"transcriber.config"`, `TRANSCRIBER_CONFIG_UNRESOLVABLE`. Cause: the seeded `stt_config` is enabled + `cpu-local` (`apps/core-server/src/db/seed/seed.ts:120`), and `.data/transcriber/host.json` did not exist (`transcription/host.ts`: no file = `CPU_LOCAL_RUNTIME_MISSING`). Written, declared in `file_claims.md` first: `version 1`, `cpuLocal.binaryPath = <repo>/.cache/stt/whisper.cpp/build/bin/whisper-cli`, `cpuLocal.modelDir = <repo>/.cache/stt/models` - paths only, both exist. NOT stated: `cpuLocal.modelVersions` and `vad` |

## 4. Lane plan

The project has NO lane script or env file: a lane is a command form (README "Core server" section,
`implementation/09_m2_lane_recreation.md` section 2, `gateway_check/08_m2_gate_device.md` section 1).
No parallel mechanism was created; the plan is the environment of each command below. `R` = the
repository root (absolute), set once per shell: `R=/Users/gsp-budi/Documents/DEMS`.

| Lane | Core port / database | Capture operation | Demo controls | Media root (`DEMS_MEDIA_DIR`) | Dataset after reseed | AVD (M2 gate map) |
|---|---|---|---|---|---|---|
| 1 | 4421 / `dems_lane_1` | `SIMULATED` | ON (`DEMS_DEMO_CONTROLS=1`) | `$R/.data/media/dems_lane_1/sessions` | 13 v1 items | `dems2_phone` |
| 2 | 4422 / `dems_lane_2` | `REAL_DEVELOPMENT` | UNSET | `$R/.data/media/dems_lane_2/sessions` | 11 v1 + 2 v2 items (`EV-20261008-0001` clean, `EV-20261009-0005` tampered) | `dems2_tablet` |
| 3 | 4423 / `dems_lane_3` | `SIMULATED` (label `SIMULATED_WITHOUT_DEMO_CONTROLS`), as the earlier gates | UNSET | `$R/.data/media/dems_lane_3/sessions` | 13 v1 items | `dems2_phone2` |
| main | 4420 / `dems_demo` | `SIMULATED` (decision F-2) | ON for the demo | `$R/.data/media/dems_demo/sessions` | 13 v1 items | none (5 earlier pairings kept) |

Lane 2 selector after the reseed and the boot (`GET /api/v1/capture/config`): cameras `CAM-01`,
`CAM-02`; microphones `MIC-01` (PRIMARY), `MIC-02` (STANDBY) - all four `adapter: FAKE`. The boot
registered `CAM-03` (MacBook Air Camera) and `MIC-03` (MacBook Air Microphone) as `LOCAL_DEVICE`
rows (the fence does that at every development boot); they are in the device list and in NO
selector. A gate session never selects, pre-checks or starts them (D163).

`dems_demo`: both cannot hold. The documented demo start is `DEMS_DEMO_CONTROLS=1 npm run
start:server` (scenarios, faults, reset from the console); real capture with demo controls is refused
at boot (`REAL_CAPTURE_WITH_DEMO_CONTROLS`). It was kept SIMULATED. To make it the development Core
instead, run the lane-2 reset and start forms with `--database dems_demo` / no `DEMS_CORE_PORT` and
its own root.

## 5. Reseed (`db:reset`, each with its `DEMS_MEDIA_DIR`)

| Database | Command environment | Outcome |
|---|---|---|
| `dems_lane_1` | `DEMS_MEDIA_DIR` only | exit 0; `v2 demo packages: NOT generated (NOT_A_DEVELOPMENT_CAPTURE_CORE)`; 13 v1 items; 1 paired device kept |
| `dems_lane_3` | `DEMS_MEDIA_DIR` only | exit 0; same; 1 paired device kept |
| `dems_demo` | `DEMS_MEDIA_DIR` only | exit 0; same; 5 paired devices kept |
| `dems_lane_2` | the five real-development variables | exit 0; `media store root the real-evidence guard judges: .../dems_lane_2/sessions`; `v2 demo packages: 2 sealed with the development key from generated sources: EV-20261009-0005 (SES-20261009-0015, one fragment altered after the seal); EV-20261008-0001 (SES-20261008-0011, clean)`; `in the evidence store: SESSION-SES-20261009-0015, SESSION-SES-20261008-0011`; 8 `session_capture_sources` rows; 1 paired device kept |

Lane 2 was reset a SECOND time after its smoke (the two op 41 calls had recorded verdicts): the
guard read `DEMS_MEDIA_DIR ... equal to the root the Core recorded`, replaced the 2 seed-sealed
records, removed their 2 folders, sealed again. Lane 2 is at the pristine seed (audit head seq 83).
Lanes 1, 3 and `dems_demo` carry the smoke's sign-in / sign-out (audit head seq 86).

No guard refusal anywhere. The old shared root `.data/media/sessions`: 0 entries, 0 bytes, left in
place. `.data/media/dems_lane_2/sessions`: 2 package folders, 16 MB. The roots of the simulated
Cores are recorded in `core_media_store` but do not exist on disk (a simulated Core writes nothing
there). `.data/capture-local/**` and `.data/test-row61-*` untouched.

## 6. Smoke per lane (no emulator, no browser; each Core started, read, stopped)

Sign-in: the seeded supervisor through `POST /api/v1/auth/sign-in` with the lane's web origin; the
password is the shared constant `DEMO_OPERATOR_PASSWORD`, imported by name by a scratch script
(outside the repository) and never printed. Capture operation read from the boot log line
`capture fence passed`.

| Core | `/api/v1/health` | Operation (boot log) | Evidence items | Errors / warnings in the log |
|---|---|---|---|---|
| lane 1, 4421 | 200, `ready {database:true, engine:true}` | `SIMULATED`, `demoControls: true` | 13 | 0 / 0 |
| lane 2, 4422 | 200, ready | `REAL_DEVELOPMENT`, `checks: real`, `workerVersion capture-worker/0.4.0`, transcriber `RESOLVED cpu-local, vad NOT_STATED` | 13 (2 with package version 2) | 0 / 0 |
| lane 3, 4423 | 200, ready | `SIMULATED`, label `SIMULATED_WITHOUT_DEMO_CONTROLS` | 13 | 0 / 0 |
| main, 4420 | 200, ready | `SIMULATED`, `demoControls: true` | 13 | 0 / 0 |

Lane 2, op 41 (`POST /api/v1/evidence/{id}/verify`):

| Item | Answer |
|---|---|
| `EV-20261008-0001` | 200; `overall PASS`; 15 checks, 15 PASS; `sources.development: true` (tracks `CAM-01`, `CAM-02`, interval `MIC-01`, all `FAKE`); `signature.developmentKey: true` |
| `EV-20261009-0005` | 200; `overall TAMPERED`; 15 checks: 11 PASS, 3 FAIL, 1 SKIPPED; fragments exactly `[(VIDEO-02, seq 3, TAMPERED)]`; development marks as above |

After each stop: the port is free; no capture worker or helper process left.

## 7. Start / stop commands for the gate sessions

Run from the repository root, outside the sandbox, `R=/Users/gsp-budi/Documents/DEMS`. PostgreSQL
first (`npm run pg:status`, `npm run pg:start`). Web console address: `http://127.0.0.1:517N/`,
never `localhost`. Never ports 5173-5175 for a lane.

| Lane | Core start | Web dev server | Device rules (`adb -s <serial>`) | AVD |
|---|---|---|---|---|
| 1 | `DEMS_CORE_PORT=4421 DEMS_DEMO_CONTROLS=1 DEMS_MEDIA_DIR="$R/.data/media/dems_lane_1/sessions" npm run start:server` | `DEMS_CORE_PROXY_PORT=4421 VITE_DEMS_CORE_MODE=live npm run dev -w @dems/core-web -- --port 5176 --strictPort --host 127.0.0.1` | `reverse tcp:8081 tcp:8081`; `reverse tcp:4420 tcp:4421` | `dems2_phone` |
| 2 | `DEMS_CORE_PORT=4422 DEMS_CAPTURE_MODE=real DEMS_CAPTURE_DEV_SOURCES=1 DEMS_CAPTURE_HELPER_FFMPEG="$R/.data/helpers/ffmpeg" DEMS_CAPTURE_WORKER="$R/apps/capture-worker/build/capture-worker" DEMS_MEDIA_DIR="$R/.data/media/dems_lane_2/sessions" npm run start:server` (`DEMS_DEMO_CONTROLS` unset) | `DEMS_CORE_PROXY_PORT=4422 VITE_DEMS_CORE_MODE=live npm run dev -w @dems/core-web -- --port 5177 --strictPort --host 127.0.0.1` | `reverse tcp:8081 tcp:8081`; `reverse tcp:4420 tcp:4422` | `dems2_tablet` |
| 3 | `DEMS_CORE_PORT=4423 DEMS_MEDIA_DIR="$R/.data/media/dems_lane_3/sessions" npm run start:server` | `DEMS_CORE_PROXY_PORT=4423 VITE_DEMS_CORE_MODE=live npm run dev -w @dems/core-web -- --port 5178 --strictPort --host 127.0.0.1` | `reverse tcp:8081 tcp:8081`; `reverse tcp:4420 tcp:4423` | `dems2_phone2` |
| main | `DEMS_DEMO_CONTROLS=1 DEMS_MEDIA_DIR="$R/.data/media/dems_demo/sessions" npm run start:server` | `DEMS_CORE_PROXY_PORT=4420 VITE_DEMS_CORE_MODE=live npm run dev:web` (5173) | `npm run mobile:reverse` | - |

- Metro, one for the three lanes: `npm run dev:mobile` (8081). Scripted sessions:
  `METRO_PORT=808N DEMS_CORE_HOST_PORT=442N apps/mobile/scripts/device-session.sh phone|tablet|phone2 '<commands>'`
  (it maps `tcp:8081`, `tcp:4400`, `tcp:4420 -> 442N` and removes them at the end).
- Ready: `curl -s http://127.0.0.1:442N/api/v1/health` -> `"status":"ok"`, `"ready":{"database":true,"engine":true}`.
- Stop a Core or a Vite: `kill -TERM $(lsof -nP -t -iTCP:<port> -sTCP:LISTEN)` (README; no stop
  script exists). Device rules: `adb -s <serial> reverse --remove tcp:4420` (and `tcp:8081`).
- Serials: read the lane of a device with `adb -s <serial> emu avd name`; at the M2 gate the two
  phone AVDs sat on swapped ports (5558 = `dems2_phone`, 5554 = `dems2_phone2`) against
  `device-session.sh` (phone = 5554, phone2 = 5558). A cold boot on the standard ports is still open
  (`08_m2_gate_device.md` section 5).
- Reseed a lane (its Core stopped), simulated lanes:
  `DEMS_MEDIA_DIR="$R/.data/media/dems_lane_N/sessions" /usr/bin/lockf -k .locks/db-migrate.lock npm run db:reset -w @dems/core-server -- --database dems_lane_N`;
  lane 2: the same with the four other variables of its Core start in front (without
  `DEMS_CORE_PORT`).
- A start or a reset with ANOTHER `DEMS_MEDIA_DIR` than the table shows: the Core re-records its
  root, and the next reset answers `RESET_STORE_ROOT_CONFLICT`. A plain `npm run start:server`
  (no `DEMS_MEDIA_DIR`) on 4420 would record the old shared root `.data/media/sessions` again.

## 8. Decisions for the controller

| ID | Decision taken | Alternative |
|---|---|---|
| F-1 | `.data/transcriber/host.json` written with the two CPU-engine paths only, because no real-mode Core boots on the seeded `cpu-local` selection without it. Consequences as it stands: (a) no `modelVersions` entry - a `cpu-local` session seals `PARTIAL` without a transcript document, `MODEL_VERSION_NOT_STATED` (pass D8); the version is a statement of whoever put the model file there, not mine; (b) no `vad` member - boot says `vad NOT_STATED`; the engine `whisper-vad-speech-segments` and `models/ggml-silero-v6.2.0.bin` exist on this host. Both to state before the M6 gate | remove the file and set lane 2's STT to disabled or `omlx-server` through op 91 |
| F-2 | `dems_demo` kept SIMULATED with its own root (section 4) | make it the development Core: the gates do not need it |
| F-3 | Lane 3 without demo controls, as the M2 gate started it | add `DEMS_DEMO_CONTROLS=1` if a gate flow needs faults on the phone lane |
| F-4 | Lane 2 reset twice (second time to drop the smoke's verdict records) | keep the verified state |
| F-5 | README.md not edited, although its plain start forms now lack `DEMS_MEDIA_DIR` and the real-mode keys | a README row for the documentation owner |

## 9. Not proven / limits

- No device, emulator or browser was used: pairings are counted from `db:status` only (kept by the
  resets: lanes 1 each, `dems_demo` 5); no socket was opened.
- The web dev servers and Metro were not started; their forms are those of the M2 gate.
- No session was started on any lane: the worker was only asked for its `HELLO` by the boot check;
  the generated sources ran only inside the seed (ffmpeg, about a second per reset).
- The transcriber engine was resolved at boot (files present, CPU-only build), not run.
- The model identifier `ggml-large-v3-turbo` resolves to `.cache/stt/models/ggml-large-v3-turbo.bin`
  by the boot check; its content was not judged.

## 10. Follow-up (controller decision D175)

Rulings applied: F-2 accepted; F-1 kept and completed. Same rules; everything stopped at the end
(only PostgreSQL 4432 listens; `lane.sh status`: four `stopped`).

### 10.1 `scripts/lane/lane.sh` (new, mode 0755)

Placed as the root helper scripts are (`scripts/<area>/`: `scripts/pg`, `scripts/capture`,
`scripts/release`); POSIX `sh` like `apps/mobile/scripts/device-session.sh`. It replaces the
command forms of section 7 for the Cores: `start|stop|reset <main|1|2|3>`, `status`.

- One table inside the script (port, database, operation, demo controls, media root) - the table
  of section 4. The lane environment is built with `env`, which also UNSETS any capture, demo,
  port or attendance variable inherited from the caller's shell.
- It reads no connection file and no key (it calls `npm run start:server` and
  `npm run db:reset -w @dems/core-server`); it names no port outside 4420-4423; `stop` sends TERM
  to the listener of that lane's port only.
- `start` prints the plan and the media root, the FAKE-sources reminder for lane 2, refuses a port
  that already has a listener (69), waits for `"ready":{"database":true,"engine":true}`, and on a
  failed boot check prints the check and the code from the log (70). Log:
  `.locks/core-server.{demo,lane1,lane2,lane3}.log`.
- `reset` refuses while that lane's Core runs (69) and runs under `/usr/bin/lockf -k .locks/db-migrate.lock`.
- Unknown lane or verb: exit 64. `main` is started with `DEMS_CORE_PORT=4420` stated (equal to unset).

| Proof | Result |
|---|---|
| `lane.sh status`, everything stopped | four lines `stopped`, each with its plan and root |
| `lane.sh start 9`; `lane.sh bogus` | `unknown lane '9'`, exit 64; usage, exit 64 |
| `lane.sh start 2` | plan + root + reminder printed; `lane 2 is ready on 127.0.0.1:4422`; `GET /api/v1/health` 200, ready |
| second `start 2` while running | `port 4422 already has a listener ...: not started` |
| `lane.sh reset 2` while running | `the Core of lane 2 is running ...: stop it first; nothing was reset` |
| `lane.sh stop 2` | `lane 2 stopped ...; port 4422 is free`; no worker / helper / engine process left |
| `lane.sh reset 2` (stopped) | exit 0; guard root `equal to the root the Core recorded`; `replaces 2 seed-sealed demo package record(s)`; `removed 2 development-source package folder(s)`; `v2 demo packages: 2 sealed with the development key ...` (`EV-20261009-0005` altered, `EV-20261008-0001` clean); 13 items, 8 source rows, audit head seq 83 (the boot's audit row is gone: pristine seed) |
| `node --test scripts/pg/static.test.mjs` (scans all of `scripts/`) | 6 pass, 0 fail |

Not run through the script: `start` / `stop` / `reset` of `main`, 1 and 3 (their forms are the ones
smoked in section 6; the script's code path is the same as lane 2's minus four variables).

README.md: step "3. Core server" of "Live mode" now starts with the script, one table of the four
instances with their media roots, three bullets, and the bare forms kept below with their limit.
+21 / -2 lines; nothing else touched (docs row 96 does the rest).

### 10.2 `.data/transcriber/host.json` - what is declared and where each value was read

| Member | Value | Read from |
|---|---|---|
| `cpuLocal.binaryPath` | `<repo>/.cache/stt/whisper.cpp/build/bin/whisper-cli` | the file on disk; `initialization/04_whisper_cpp_cpu_build.md:29` |
| `cpuLocal.modelDir` | `<repo>/.cache/stt/models` | the directory holding `ggml-large-v3-turbo.bin` (the seeded model identifier, `seed.ts:122`) |
| `cpuLocal.modelVersions["ggml-large-v3-turbo"]` | `large-v3-turbo` | DECLARED from the model file's own name, `.cache/stt/models/ggml-large-v3-turbo.bin`, without the container prefix `ggml-`; consistent with the engine's own reading of that file in `.cache/stt/load_proof.txt` (`type = 5 (large v3)`). Nothing else on disk states a version: `download_progress.log` holds no address or revision, and no release tag of the weights is recorded. It is the model's version NAME, not a revision of the file - the file itself is pinned by its SHA-256 |
| `vad.binaryPath` | `<repo>/.cache/stt/whisper.cpp/build/bin/whisper-vad-speech-segments` | the file on disk (built with `whisper-cli`) |
| `vad.modelDir`, `vad.model` | `<repo>/.cache/stt/models`, `ggml-silero-v6.2.0` | the file `ggml-silero-v6.2.0.bin` there; row 77's note `implementation/34_m6_vad_stt.md:205` (source address, size, SHA-256) |

Not stated: `threads`, `processors`, `omlxServer`. The STT server on port 8000 was not called; no
model was downloaded; nothing below `~/.omlx` was read (one earlier log, `.cache/stt/convert_run.log`,
names that folder - I read only its first lines and used nothing of it).

Lane 2 boot with the completed file (`.locks/core-server.lane2.log`):

```
"code":"TRANSCRIBER_RESOLVED","outcome":"RESOLVED","backend":"cpu-local","vad":"READY"
"step":"transcriber.config","msg":"boot step passed"
"code":"CAPTURE_FENCE_PASSED","operation":"REAL_DEVELOPMENT","registered":"","local":"CAM-03,MIC-03"
"code":"CAPTURE_BOOT_CHECKS_PASSED","operation":"REAL_DEVELOPMENT","checks":"real","workerVersion":"capture-worker/0.4.0"
"step":"transcripts.heads","msg":"boot step passed"
```

No warning, no error line. Provenance readiness is not a boot line; the product's own provider
(`createModelProvenanceProvider` over `readTranscriberHost('.data')`, called once from a scratch
script, no engine run) answers for the seeded model, complete:
`{ name: ggml-large-v3-turbo, version: large-v3-turbo, quantisation: f16, sha256: 1fc70f77...e2bc69 }`
- the SHA-256 equals `.cache/stt/ggml_expected.sha256`. So a `cpu-local` session on lane 2 is no
longer bound to `MODEL_VERSION_NOT_STATED`; whether it seals ASSEMBLED is the M6 gate's to show.
No speed figure was measured or written.

### 10.3 The phone AVDs "on swapped ports"

Not a mapping error of the script, and the script is NOT edited. `device-session.sh:182-183` and
`emulator-user-lock.sh:123` agree with each other and with the first lane build
(`09_m2_lane_recreation.md:38`): `phone = dems2_phone = 5554`, `phone2 = dems2_phone2 = 5558`,
`tablet = dems2_tablet = 5556`; the script boots a down AVD with `-port $(port_of ...)`
(`device-session.sh:323`).

What is swapped: at the restart of row 53 the emulators were booted WITHOUT `-port`
(`50_m2_lane_v2_completion.md:301`: "serials are boot-order"), so the console ports followed the
boot order: `dems2_phone2` took 5554 and `dems2_phone` took 5558; the tablet kept 5556. The root
`package.json` scripts `emulator` and `emulator:phone` carry no `-port` either, and there is none
for `dems2_phone2`. The script's port guard then refuses the two phone targets (exit 69) and
`emulator-user-lock.sh` addresses the wrong device. The pairings are not affected (a pairing
belongs to the AVD's data and the lane database, not to the serial).

Fix, in the boot order, one line per device (all three down first; the user's or the gate
session's action, not done here - no emulator was booted):

```
NO_METRO=1 apps/mobile/scripts/device-session.sh phone 'true'     # boots dems2_phone  on 5554
NO_METRO=1 apps/mobile/scripts/device-session.sh tablet 'true'    # boots dems2_tablet on 5556
NO_METRO=1 apps/mobile/scripts/device-session.sh phone2 'true'    # boots dems2_phone2 on 5558
```

or by hand `emulator -avd dems2_phone -port 5554 ...`, `-avd dems2_tablet -port 5556`,
`-avd dems2_phone2 -port 5558`. Lane map afterwards: 5554 -> lane 1 (4421), 5556 -> lane 2 (4422),
5558 -> lane 3 (4423). Proposal, not done (a manifest edit outside this row): add `-port 5556` /
`-port 5554` to the two root `emulator*` scripts and an `emulator:phone2` with `-port 5558`.
Not tested: no emulator was started.

### 10.4 Decisions of the follow-up

| ID | Decision | Alternative |
|---|---|---|
| F-6 | The model version is declared as `large-v3-turbo` (the name in the file name). If the controller wants a revision of the weights instead, nothing on this disk gives one | leave it out: PARTIAL, `MODEL_VERSION_NOT_STATED` |
| F-7 | `scripts/lane/lane.sh`, not `scripts/lane.sh`: the root scripts live in area folders | move it one level up |
| F-8 | `lane.sh start main` turns demo controls ON (the plan); the bare form stays in the README for a Core without them | a fifth target |
| F-9 | `device-session.sh` left unchanged; the fix is the boot order | make the script find a target by AVD name instead of by port (a larger change) |

---
*Generated: 2026-10-10*
