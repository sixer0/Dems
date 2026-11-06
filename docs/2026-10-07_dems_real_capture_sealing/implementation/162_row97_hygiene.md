---
task_id: 2026-10-07_dems_real_capture_sealing
row: 97 (M9 hygiene; M9-PIN-1 to zero, M9-HYG-1)
date: 2026-10-11
agent: coder-execution
base_commit: 951c80e (working tree, nothing committed)
status: needs-review
---

# Row 97: repository hygiene (Tier 3)

No behaviour change. Contract totals unchanged: 97 operations (36 GET / 61 POST), 67 audit types,
schema 6 / dbc-7 (the pins that assert them are untouched and green). No git write, no install, no
formatter run, nothing under `.data/` or `.cache/` deleted or moved, no lane started, no local
device opened, `.data/pg*.env` not read.

Status is needs-review, not complete, for three reasons a reader should see first:

1. One removal I made was WRONG and was put back: the two unused seed builders in
   `apps/core-server/src/db/seed/seed.ts` are read as text by a security static test (section 3.2).
2. The blueprint text of row 97 names a predecessor backlog (B8, B12, row-25 F2..F4, row-26 F1..F4,
   the AU1 re-checks). The controller's brief for this row names a different list; the blueprint
   items were NOT done here (section 8).
3. `.gitignore` does not cover models, media or `*.pem` by pattern (section 5.1). Listed, not changed.

## 1. M9-PIN-1 to zero

True numbers, from the code:

- Replicated slices: **30**. `REPLICATED_SLICE_NAMES` (`packages/shared/src/api/state-slices.ts:1192`)
  is the key list of `REPLICATED_SLICE_SCHEMAS`; counted by a script
  (`node --import tsx`, reading the constant): 30, and 5 unreplicated. Pinned by
  `packages/shared/test/api-state-slices.test.ts:443` (`toHaveLength(30)`) and `:432` (the five others).
- Operations: **97**, counted by the same script from `CORE_API_OPERATIONS`; pinned by
  `packages/shared/test/api-registry.test.ts:299` (97), `:330` (36 GET), `:331` (61 POST).
- Offline scope 31 = 1 LIVE + 30 SIMULATED; Core-server-only 66
  (`packages/shared/test/api-openapi-scope.test.ts:171,325`; `apps/core-web/src/test/live-api-reference-document.test.tsx:147`).

Changed (comments and test titles only; no asserted value was touched):

| Stale text | Lines corrected |
|---|---|
| "28 slices" / "28 replicated slices" -> 30 (20 lines) | `apps/core-server/src/realtime/__tests__/hub.lifetime.test.ts:69` (title), `state.db.test.ts:76` (title), `messages.test.ts:67` (title), `first-contact.db.test.ts:368,495`, `apps/core-server/src/engine/__tests__/restart.db.test.ts:302` (a console line), `apps/core-server/test/acceptance/shared-state.support.ts:118,130,230,643,1090,1127` (`:1127` is a failure message), `apps/core-server/src/engine/types.ts:265`, `apps/core-server/src/realtime/messages.ts:8,96`, `packages/shared/src/live/source/live-sim.ts:46`, `packages/shared/src/api/realtime-messages.ts:16,37`, `realtime-examples.ts:11`, `core-api.ts:605` |
| "75 operations" -> 97 (11 lines) | `apps/core-server/src/plugins/permission-guard/__tests__/decision.test.ts:98` (describe title), `apps/core-server/src/modules/rbac/__tests__/matrix.db.test.ts:139` (describe title), `apps/core-server/test/acceptance/rbac-matrix.test.ts:4,14`, `contract.test.ts:2051`, `apps/core-web/src/test/live-api-reference-page.test.tsx:14`, `live-api-reference-document.test.tsx:13`, `apps/core-web/src/features/api-reference/api-document.ts:22,275`, `index.tsx:16`, `packages/shared/src/api/index.ts:27` (now says it held 75 at that row and holds 97) |
| "the 75 operations of the closed base / contract" (2 lines, history, reworded so the number stays and the stale phrase goes) | `apps/core-server/test/acceptance/rbac-matrix.test.ts:1130`, `apps/core-server/src/modules/rbac/__tests__/matrix.db.test.ts:225`. `rbac-matrix.test.ts:1136` `expect(baseOps).toHaveLength(75)` is the closed task-2 base and is unchanged |
| "92 operations" -> 97 (1 line) | `packages/shared/test/openapi.test.ts:14` |
| Three DATED-HISTORY lines that test/16 called correct as written (92 / 35 / 57 at row 113) | Reworded only so the literal grep is silent; each still states 92: `decision.test.ts:111` ("92 x 9 callers"), `packages/shared/src/api/core-api.ts:1058` ("92 in the table"), `packages/shared/test/api-registry.test.ts:171` ("registry 92 (35 GET / 57 POST)"). If the controller prefers the original wording, these three are the lines to put back, and the grep is then 3, not 0 |

Beyond the 34 (found beside them, same kind, outside the row's pattern):
`shared-state.support.ts:118` "a Live store holds 33" -> 35 (30 + 5);
`apps/core-web/src/features/api-reference/api-document.ts:20,21,201`, `index.tsx:16`, `sim-fetch.ts:21`,
`try-it.ts:11,136`: "ten operations" of the offline scope -> 31, "the other 65" -> 66.
`try-it.ts:9` ("ten operations whose body or answer holds a secret") is the Try-it refusal count and is right.

Literal grep, as `scratchpad/r95/pins.sh` scopes it (`apps`, `packages`, `scripts`, `release`, root;
`docs`, `node_modules`, builds, `.data`, `.cache`, `graft`, `ui_design`, lockfile, mobile native folders excluded):

```
rg -n -e '75 operations|\b75 ops\b|28 slices|28 replicated|92 operations|\b92 ops\b' .   ->  0 lines
```

Before: 37 lines (34 stale + 3 dated history). The other patterns of X-PIN-1 (`dbc-2`, `dbc-3`,
`'0.1.0'`, `35 GET`, `57 POST`, `40 tables`, `eight files`) are the deliberate history and fixtures
test/16 section 4 lists; not touched, not zero, by design.

## 2. The five test-support files with wave names

Renamed by content move (`mv`, no `git mv`; git shows 5 deleted + 5 untracked until the commit).

| Old | New | Importers updated | Bytes |
|---|---|---|---|
| `apps/core-server/src/media-stream/__tests__/wave-k-z1-real-tables.ts` | `real-fragment-tables.ts` | `seek-index.test.ts:2,15` | identical, SHA-256 `8a3f0803...` before and after |
| `apps/core-server/src/sealing-host/__tests__/fix-151-init-segments.ts` | `real-init-segments.ts` | `stream-profile.test.ts:21` | identical, `65de45ec...` |
| `apps/core-web/src/features/evidence/__tests__/wave-h-c2-bed.ts` | `real-item-bed.ts` | `transcript.test.tsx:39`, `item-facts.test.tsx:15`, `item-exports.test.tsx:13`, `sealed-player.test.tsx:35`, `export-job.test.tsx:29` | identical, `61e75436...` |
| `apps/transcriber/test/real/wave-h-speech-pipeline-child.ts` | `speech-fixture-pipeline-child.ts` | `wave-h-speech-fixture.real.test.ts:28` | 2 lines changed: its own name in the usage comment and the usage error |
| `apps/transcriber/test/real/row77-pipeline-child.ts` | `sealed-fixture-pipeline-child.ts` | `row77-df1.real.test.ts:32`, `row77-cpu-local.real.test.ts:29` | 2 lines changed, same kind |

The header comments inside the two fixtures still say "fix wave K Z1" / "fix 151": left, because the
brief asks for identical bytes. `rg` for the five old names in `apps`, `packages`, `scripts`: 0.

Left: the six `apps/transcriber/test/real/*.real.test.ts` files with `row77` / `row78` / `wave-h` in
their names. They run only by hand (`vitest.real.config.ts`), and neither the brief nor test/16 asks
for their rename (test/16 section 6(b): "a decision for the controller"). The two children were
renamed and their three callers updated but NOT RUN: real-engine tests are not run by an agent.
Typecheck and lint of the transcriber workspace cover the paths; the `join(import.meta.dirname, ...)`
strings were checked by `rg` only.

## 3. Dead code and leftovers

### 3.1 Removed (unused: the name occurs nowhere else in `apps`, `packages`, `scripts`, tests included)

Method: a script over every tracked and untracked source file counted each exported name as a word;
a name counted once is defined and never used. 165 such names; 47 of them were added in this task
(`git blame` of the line is not an ancestor of `c2c983b`). Of the 47:

| Removed | Where |
|---|---|
| `MEDIA_STORE_TABLE` | `apps/core-server/src/db/commands/media-store-root.ts:28` |
| `CAPTURE_CONNECT_OPERATIONS` | `apps/core-server/src/modules/capture-discovery/connect/index.ts:93` |
| `hex128` (test fixture helper) | `apps/core-server/test/db/fixtures.ts:26` |
| `EMPTY_CONNECT_FORM` | `apps/core-web/src/features/devices/camera-connect.ts:73` |
| `SourcePrecheckId`, `isSourcePrecheckId` | `apps/core-web/src/features/devices/source-class.ts:131` |
| `micInputLabelKey`, and `MIC_INPUT_LABEL_KEY` which only it read | `apps/core-web/src/features/session-monitor/model.ts:411` |
| `SEARCH_GATED_CONTROLS` | `apps/mobile/src/features/capture-selector/camera-search-model.ts:129` |
| `RESCAN_GATED_CONTROLS` | `apps/mobile/src/features/capture-selector/capture-notices-model.ts:292` |
| `SelectorGatedControl` (type) | `apps/mobile/src/features/capture-selector/capture-selector-model.ts:273` |
| i18n `common.sourceClass.notAllowed` | `packages/shared/src/i18n/en/common.ts:868` |
| i18n `evidence.verifyV2Key.detailDevelopment` | `packages/shared/src/i18n/en/evidence.ts:631` |
| i18n `evidence.itemFacts.web.sourcesV1Title` | `packages/shared/src/i18n/en/evidence.ts:723` |

i18n method: of 3,360 leaf keys, 24 have a last segment that occurs nowhere outside the i18n folder;
3 of the 24 were added in this task and are the three above. The check is by last segment, so a key
built from parts at run time would be missed in the other direction only (reported used when it is not).

### 3.2 Removed, then PUT BACK

`captureBuiltInDevices`, `captureBuiltInConfig`, `CAPTURE_SEED_PROFILE` in
`apps/core-server/src/db/seed/seed.ts:145-200`: no caller anywhere, but
`apps/core-server/src/capture/__tests__/static.test.ts:897` (SEC35-41 (c), "the two builders of a typed
row carry it") reads `seed.ts` as text for `adapterKind: 'FAKE',`. My removal turned that test red
(core-server unit: 1 failed / 6699 passed). The file was restored from `HEAD`
(`git show HEAD:... >`, `git diff` of the file is empty) and the suite re-run green. So the seed
holds two builders that nothing calls and that a security guard keeps in place: OPEN for the final
code review (either the guard reads the builder that IS used, or the dead builders go with it).

### 3.3 Left, listed (unused names added in this task)

- Types of the contract and the schema, 28: row types of `apps/core-server/src/db/schema/{capture,core,recording,stt,transcript}.ts`
  (`New...Row`, `CoreMediaStoreRow`, `SttConfigRow`, `SessionSttConfigRow`), message and record types of
  `packages/capture-protocol/src/index.ts` (`StartMessage`, `StopMessage`, `SwitchAudioSourceMessage`,
  `HeartbeatMessage`, `WarningMessage`, `CrashMessage`, three `...Record`), body types of
  `packages/shared/src/api/{capture-discovery,evidence,state-slices}.ts`, `TranscriptAbsenceReason`.
  These are the published surface of a schema or a protocol; an unused type costs nothing at run time.
- Values of the shared contract package, 7: `LEGACY_AUDIO_TRACK_IDS`, `MicInputIdLabel`, `MicRoleLabel`,
  `FALLBACK_ONLY_FINALIZATION_STEPS` (`packages/shared/src/domain/enums.ts:151,163,171,296`),
  `PLATFORM_NOT_REPORTED_CONTROLS` (`sim/core-facts.ts:180`), `CORE_NOT_RUNNING_MEMBER`,
  `CORE_NOT_RUNNING_SENTENCE_KEY` (`sim/core-not-running.ts:30,47`). Left: they are vocabulary of the
  contract package, each documented as the one name of a spec item; removing them is the contract
  owner's call, not a hygiene edit.
- `readFragments` (`apps/transcriber/test/real/fmp4-fragments.ts:133`): real-test support, not run here.
- The 118 unused names that predate this task and the 21 unused i18n keys that predate it: out of scope
  (`git diff c2c983b..HEAD`). Lists: `scratchpad/r97/unused.txt`, `i18n.txt` (session scratch, not in the repo).

No orphan file: 8 non-test files are imported by nothing, and each is a hand-run tool or a harness
child named by its caller (`frames_check.ts`, `tail_check.ts`, `lan-probe.ts`, `print-camera-args.ts`,
two `*.selfcheck.ts`, `capture-session-driver.ts`, `build-web-packages.ts`).

### 3.4 Markers

| Kind | Found | Done |
|---|---|---|
| `TODO` / `FIXME` / `XXX` / `HACK` in `apps`, `packages`, `scripts` | 2, both `apps/core-server/src/capture/adapters/kinds.ts:12,16` (`TODO(row 129)`, `TODO(row 61)`) | Both rows landed. Rewritten as statements of what is there: the kind list is pinned to the same five names by `capture/adapters/__tests__/registry.test.ts:42` and, for the schema's list, by `test/db/set4-rules.test.ts:44`; `captureOperationOf` is `capture/fence/operation.ts:84`. Note: no single test compares the two lists with each other; they meet through two equal literal pins |
| `console.log` / `console.debug` added since `c2c983b` | 20 added lines: 14 are evidence lines of tests (`[row114]`, `[e3]`, `[0013]`, `[wave I A1]`, `[ac-b-16]`, `[test:db]`), 3 are the output of hand-run command-line checks (`worker-probe.real`), 3 are strings inside scanner tests | Left: none is in product code that runs in the Core or a client |
| `debugger`, `DEBUG = true`, `@ts-ignore`, `@ts-nocheck` added | 0 | - |
| `.only`, `fit(`, `fdescribe(` | 0 (`glow-ring.tsx:242 fit()` is a function of the component) | - |
| Development rigs | `.locks/seal-rig.lane2.switch` = `OFF`, `.locks/source-rig.lane2.switch` = `OFF` | Read only |
| Commented-out code blocks | Not swept mechanically; none met in the files read | Stated as not proven |
| Stale comment outside this task's diff | `apps/core-server/src/modules/demo/__tests__/reset-failures.db.test.ts:486-494`: "PENDING ... It fails today ... Remove `.skip`" above a test that has no `.skip` and passes (commit `b90a3c6`, task 2) | Left (out of scope); open item |

### 3.5 Skips

No unconditional `.skip`. Every conditional one, with its reason. The five env-gated describes did
not say in their title why they are skipped; the reason was added to the title (title text only).

Database suite, 7 skipped tests in 3 files:

| File | Tests | Reason, now in the title |
|---|---|---|
| `src/sealing-host/__tests__/e2e/seal-e2e.db.test.ts:238` | 3 | skipped unless `DEMS_SEAL_E2E=1`: needs the built worker and the heavy-host lock |
| `src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts:419` | 2 | skipped unless `DEMS_DEV_SESSION_E2E=1`: same |
| same file `:433` | 1 | skipped unless `DEMS_DEV_SPEECH_SESSION_E2E=1` with the speech fixture and the cpu-local engine on the host |
| same file `:438` | 1 | skipped unless `DEMS_LOCAL_SESSION_ATTENDED=1`, which no agent sets (D163): the user's |
| `src/sealing/__tests__/kill-matrix/kill-matrix.db.test.ts:258` | 0 (the file counts as skipped; it registers a test per asked cell) | skipped unless `DEMS_KILL_MATRIX` names cells |

Transcriber, 3 skipped on this host (each title already states its host condition; unchanged):
`src/__tests__/kill-resume.test.ts:177` ("host hides the process table (a sandbox)"),
`cpu-priority.test.ts:150` and `capture-priority.test.ts:163` ("host forbids it (a sandbox)").
Each has a twin that runs on this host (`:186/:200`, `:136`, `:115`).

Other host-conditional cases that RAN here (not skips on this host; condition in the title or the
`runIf`): `fence.test.ts:303,334,341`, `fence.db.test.ts:280`, `no-delivery.test.ts:275`,
`mic-helper.generated.test.ts:129`, `demo-seed.generated.test.ts:36`, `demo-seed-v2.test.ts:215`,
`probe.test.ts:203`, `session-run.test.ts:180`, `speech-fixture-setup.test.ts:58`,
`real-evidence-m7.test.ts:48` (root user), `mock-core standalone-launcher.test.ts:351` (ports busy).

## 4. Items of the controller's post-gate list

| Item | Found | Done / left |
|---|---|---|
| (a) web player test's hand-typed 409 body | `sealed-player.test.tsx` already imported `MEDIA_FRAGMENT_NOT_AUTHENTIC_EXAMPLE` for the wave-L block, but `ROUTE_REFUSAL` (`:46`) was still a typed copy with another message text (used at `:56,217,270` today) | `ROUTE_REFUSAL = MEDIA_FRAGMENT_NOT_AUTHENTIC_EXAMPLE.body` (`:46-47`); header comment `:19-22` corrected. The two operation-88 bodies in `media-session-canary.test.tsx:309` (web) and `:316` (mobile) are op 88's own 409, a different answer: left |
| (b) R96-1 asset README notes | The notes existed only in the two committed READMEs | New `packages/shared/scripts/demo-readme-notes.ts` holds both notes; `readmeText` of `gen-demo-evidence.ts` and `gen-demo-media.ts` ends with `${...NOTE}` (one import and one line each). The two READMEs: 2 lines each changed by hand (heading without "added by hand", and the sentence that said a regeneration removes the note now says the generator writes it). Assets NOT regenerated. Proof: `packages/shared/test/demo-evidence.test.ts:521`, new block "the asset READMEs end with the notes their generators append (R96-1)", 2 cases: README = text up to the generator's last own line + the note; one note heading in the file; the generator source appends the note after that same line. Negative control run once: one character changed in the media README -> 1 failed / 19 passed; restored. NOT proven: that the part of each README above the note equals a fresh generator run (that needs FFmpeg and writes the assets) |
| (c) checkpoint reader, two copies | Web `features/session-monitor/capture-checkpoints-model.ts:32`, mobile `features/session-live/own-capture.ts`. A third `captureCheckpointsOf` is `apps/core-server/src/engine/capture-checkpoint-doors.ts:56`, the WRITER side with another signature | Left. No shared reader exists in `packages/shared` (it has the type and the schema only) |
| (d) R69-09 credential-envelope sweep | The review offers two ways out; the second ("state in the comment that rotation clean-up is not built and record it as a gap") is already done: `credential-store/index.ts:29-31`, `connect/service.ts:543-544` | The sweep itself (`retainOnly` has no product caller) is new behaviour: OPEN for the final code review |
| (d) R80-10 duplicate rule files | `transcript-model.ts` and `item-v2.ts` are no longer identical between web and mobile: 76 and 74 differing lines after stripping semicolons (261 / 283 and 223 / 241 lines) | Not a pure move any more: OPEN for the final code review |
| (e) two load-sensitive tests | `capture/__tests__/ipc.test.ts` waits on real child processes and a 600 ms heartbeat, by design (its header said so). `sealing/__tests__/pipeline.test.ts:207` "every hook point once" is NOT a wait: computation and file work under the runner's default 5 s | Comment added to each (`ipc.test.ts:15-20`, `pipeline.test.ts:202-206`); no timeout raised. Both passed in this run at a load of 2.7 to 3.6 |

Also done, hygiene: the one standing lint warning, `apps/mobile/src/runtime/log.test.ts:160`
(`ReadonlyArray<T>` -> `readonly T[]`); mobile lint is now silent.

## 5. Repository checks

### 5.1 `.gitignore` (`git check-ignore -v` on a sample path of each)

| Sample | Result |
|---|---|
| `.data/x.bin`, `.data/models/ggml.bin` | ignored, `.gitignore:70 /.data/` |
| `.cache/x.json` | ignored, `:47 .cache/` |
| `.locks/npm.lock` | ignored, `:59 .locks/` |
| `release/x.zip` | ignored, `:64 /release/` |
| `apps/capture-worker/build/x` | ignored, `:16 build/` |
| `certs/dev.key`, `x.p12`, `x.keystore` | ignored, `:37`, `:35`, `:31` (also `*.jks`, `*.pfx`, `apps/mobile/signing/`) |
| `.env`, `.env.local`, `apps/core-server/.env` | ignored, `:40`, `:41` |
| `x.pem` | **NOT ignored** |
| `models/ggml-large.bin`, `x.gguf` | **NOT ignored** |
| `x.mp4`, `recordings/a.mkv`, `a.wav` | **NOT ignored** |

Models, recordings and the session keys are kept out of git by WHERE they are written (`.data/`,
`.cache/`), not by extension. Media cannot be ignored by extension as the tree stands: 265 media files (169 demo assets, 96
recordings in `docs/`) and 14 demo certificates are tracked on purpose. A model file or a `.pem` written outside
`.data/` would be offered to `git add`. Not changed; a pattern for model weights and `*.pem` with a
re-include for `packages/shared/assets/demo-evidence/` is a decision for the controller.

### 5.2 Tracked files (10,283)

- Added by this task with a media, model, archive or key extension: **0**.
- Added by this task above 1 MB: 2, both screenshots:
  `docs/2026-10-07_dems_real_capture_sealing/gateway_check/evidence_08/lane2_tablet_login_core_online.png` (3.1 MB),
  `lane3_phone2_login_core_online.png` (1.6 MB).
- Whole repository by extension: 180 `mp4`, 85 `m4a`, 14 `pem`, 15 `sig`, 1 `zip`; no `bin`, `gguf`,
  `onnx`, `key`, `p12`, `jks`, `apk`. The media are the synthetic demo assets
  (`packages/shared/assets/demo-media/`, `apps/mobile/assets/media/`) and screen recordings in the
  docs of the predecessor task; the `pem` / `sig` / `zip` are the version-1 demo evidence packages.
- Largest tracked files are logs and two HTML galleries of the predecessor's docs (5 files of 17 to
  21.5 MB). Not of this task; listed for the user.

### 5.3 Secret-shaped strings

- Token shapes (GitHub, Anthropic / OpenAI style, AWS, Slack, Google, JWT) outside `docs/`: 0. In `docs/`: 0 files.
- Private-key headers: 1 file, `apps/core-server/src/evidence-export/__tests__/export.test.ts:271,272`:
  the header TEXT as input of the secret sweep's own test. No key.
- `password` / `secret` / `token` / `api key` assigned a literal, outside tests: 46 lines in 31 files,
  read one by one: 45 are enum members, i18n labels, environment-variable NAMES, validation codes or the
  contract examples marked `EXAMPLE_ONLY_NOT_A_REAL_CREDENTIAL` (`packages/shared/openapi/openapi.json`).
  1 is a credential: the published demo operator password, constant `DEMO_OPERATOR_PASSWORD`,
  `packages/shared/src/sim/dataset.ts:153`. Expected.
- Where that published demo value appears: `packages/shared/src/sim/dataset.ts` (1 line), `README.md`
  (4), `scripts/release/build-web-packages.ts` (4), and 42 test files (106 lines). The emulator test
  PIN is in `apps/mobile/scripts/emulator-user-lock.sh` (1 line). The value is not repeated here.
- In test files the same pattern gives 93 lines in 53 files: not read one by one. Not proven clean
  beyond the token-shape and key-header scans above, which cover them.

### 5.4 Licence and attribution

One file: `THIRD_PARTY_NOTICES.md` (root). Sections added by this task: STT engines (row 76), VAD and
diarization model files (row 77), speaker labelling (row 78), ONVIF client and XML parser (row 131),
FFmpeg for the composite (row 91), ZIP writer (row 91), where the Core names `libx264` at run time
(F-M8), and the component register at `f293221` (row 96, six subsections). No `LICENSE` file at the
root or in a workspace. The asset READMEs carry their own provenance sections.

What the capture worker links today, from its build file only (`apps/capture-worker/Makefile:39-45`):
`pkg-config --cflags/--libs` of `libavformat libavcodec libavfilter libswresample libavutil`, plus
`-lm -lpthread`; dynamic linking against whatever FFmpeg the host has installed ("Links the FFmpeg
that is already installed; installs nothing", `:2`). The Makefile names no codec library and no
licence flag: which licence that FFmpeg build is under is a property of the installed build, not of
this file. I did not run `pkg-config` or `ffmpeg -version`. The FFmpeg licence question stays open; it is the user's.

### 5.5 Task folder index

`docs/2026-10-07_dems_real_capture_sealing/README.md` was 14 lines and named four folders. Rewritten
as an index of the folder as it is today, generated from the directory listing (docs only).

## 6. Data candidates for the user (LISTED ONLY; nothing opened, moved or deleted)

`du -sh`, 2026-10-11. `.data` is 5.0 GB in all, `.cache` 13 GB.

| Path | Size | What it is (by name and place only) |
|---|---|---|
| `.data/test-row61-row140e2e-*` (12 folders) | 1.3 GB (three of 420 to 432 MB, one 12 MB, eight 6.7 MB) | scratch of the development-session e2e |
| `.data/test-row61-wavehspeech-*` (5) | 231 MB | scratch of the speech-session e2e |
| `.data/test-row61-row140-*` (35), `-row140d131-*` (31) | 840 KB, 696 KB | test scratch |
| `.data/test-row61-{d10volume,passj_restart,wavehd_stub,waveia2_adopt,waveia2_restart,wavek_s1_restart,row71b}-*` (19, 13, 16, 18, 15, 13, 2) | 304, 204, 320, 356, 240, 312 KB, 0 | test scratch |
| `.data/transcriber/sessions` | 0 B (3 entries) | empty session folders |
| `.data/gate-75b-set-aside/` | 68 MB | set aside at gate 75b |
| `.data/media/dems_lane_2/sessions/.quarantine` (4 entries) | 199 MB | lane 2's four quarantine folders |
| `.data/media/dems_lane_2` in all | 3.2 GB | lane 2's media store (holds the quarantine above); `dems_lane_1` and `sessions` are 0 B |
| `.data/run/capture` | 0 B (48 empty session folders) | run folders |
| `.data/capture-local/runs/*` (3: `l134_cam_r1`, `l134_cam_t1`, `l134_cam_t2`) | 10 MB (464 KB, 5.3 MB, 4.6 MB) | LOCAL-DEVICE recordings. Size only. Never opened |
| `.cache/gates/**` (29 folders) | 2.7 GB (largest: `89b` 1.1 GB, `89c` 403 MB, `94b` 194 MB, `wave-m-m` 192 MB, `75d` 102 MB) | gate session artefacts |
| `.cache/gate-env/**` | 28 MB | gate environment captures |
| Not named in the brief, same kind, for completeness: `.cache/stt` 3.0 GB, `.cache/release` 2.5 GB, `.cache/npm` 1.4 GB, `.cache/m3worker` 1.1 GB, `.cache/apk-backup` 309 MB | | |

## 7. Proof (one run each; 1-minute load below 4 before each)

| Check | Command | Result |
|---|---|---|
| typecheck x 7 | `npm run typecheck -w @dems/<ws>` (shared, core-server, core-web, mobile, capture-protocol, transcriber, mock-core), after the last edit | exit 0 x 7, 0 `error TS` |
| lint x 7 | `npm run lint -w @dems/<ws>`, after the last edit | exit 0 x 7, 0 problems (the standing mobile warning is gone) |
| shared | `npm run test -w @dems/shared` | 101 files, 2614 passed, 0 failed (2612 + the 2 new R96-1 cases) |
| core-server unit, run 1 | `npx vitest run --root apps/core-server --project unit --maxWorkers=4` | RED: 1 failed / 6699 passed, `capture/__tests__/static.test.ts` SEC35-41 (c): my removal in `seed.ts` (section 3.2) |
| core-server unit, run 2 (after the restore) | same | 324 files, 6700 passed, 0 failed, 64 s |
| core-server db | `/usr/bin/lockf -k -t 3600 .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=2` (db tests and a db fixture were touched) | 181 files: 178 passed, 3 skipped; 2430 tests: 2423 passed, 7 skipped, 0 failed, 203 s; teardown 0 databases remain |
| core-web | `npm run test -w @dems/core-web` | 164 files, 2224 passed, 0 failed, 70 s |
| mobile | `npx -w apps/mobile jest --maxWorkers=2` | 272 suites, 2915 passed, 0 failed, 190 s (load was 3.8 at the start, 4.7 over 5 minutes) |
| transcriber | `npm run test -w @dems/transcriber` | 18 files, 564 passed, 3 skipped, 0 failed |
| row grep | section 1 | 0 |

A first attempt of the unit suite inside the command sandbox ran no valid proof (121 failures, all
loopback binds refused by the sandbox); the unit, db, web, mobile and transcriber suites above ran
outside it, as test/16 does. capture-protocol and mock-core: not touched, suites not run.
Not run: seal e2e, development-session e2e, kill matrix (their describe TITLES changed, section 3.5;
the files load and skip in the db suite above, the gated bodies did not execute), the real-engine
transcriber tests, any browser or device check.

## 8. What the blueprint row names that was not done here

Row 97 of `identification/02_structured.md:429` lists: B8 mobile minors + B15 empty frame, B12
RC-2..RC-7 nits, row-25 F2 (`clearToasts()` 350 ms), F3 (`waitForSheetExit`), F4 (20
`jest.setTimeout(30_000)` files), row-26 F1-F4, the re-check of AU1-1 / AU1-2 / AU1-5 / AU1-6
("SEALED-swap fake-clock test green, `:132` scramble deterministic"), and "each hygiene edit a
separate small commit". None of these was worked on: the brief for this run names the list of
sections 1 to 6, and forbids commits. One fact read on the way: `jest.setTimeout(30_000)` is in 22
mobile files today. B5 / B6 / B7 are "not scheduled" by OD-26 and B13 needs a release build, which
was not made: those four no longer apply to this row as written.

## 9. Open items for the final chain

1. `seed.ts` dead builders kept alive by static guard SEC35-41 (c) (3.2).
2. `.gitignore`: no pattern for model weights, `*.pem`, media (5.1).
3. The three dated-history lines reworded for the literal grep (section 1): keep or put back.
4. Blueprint items of row 97 not done (section 8).
5. R69-09 key sweep; R80-10 (files have diverged) (section 4).
6. Unused contract-package values (7) and unused types (28) of this task; 118 unused names and 21
   unused i18n keys that predate it (3.3).
7. Six `test/real` files with row / wave names; two renamed children not run (section 2).
8. Stale "PENDING ... Remove `.skip`" comment, `reset-failures.db.test.ts:486` (3.4).
9. No test compares the adapter-kind list of the capture layer with the schema's directly (3.4).
10. R96-1: the README text above the notes is not compared with a generator run (section 4).
11. Commented-out code: not swept (3.4). Test files: literal credentials not read one by one (5.3).
12. Gated e2e describes whose titles changed were not executed (section 7).
13. FFmpeg licence: the user's, open (5.4). Data clean-up: the user's (section 6).

## Files changed

63 tracked files modified or deleted (117 insertions, 671 deletions, of which 554 deletions are the
five renamed files), 6 new: the five renamed files and `packages/shared/scripts/demo-readme-notes.ts`.
Docs: this note, `README.md` of the task folder, `delegation_progress/coder_execution_row97.md`.
`status_tasks.md`, `delegation_progress_report.md` and `masterplan/02_plan.md` not written (driver rules).

---
*Generated: 2026-10-11*
