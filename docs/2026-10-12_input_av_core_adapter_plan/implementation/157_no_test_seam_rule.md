---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 157 (+ named entry SR-10, decision C76)
date: 2026-10-13
agent: coder-execution (S1, track D)
tier: T3
requirement: AD-08 (2), (3); gate M6; decisions C46, C50, C55 (DD-1, DD-3), C60, C63, C76
status: complete
---

# Row 157 - the no-test-seam static rule; named entry SR-10

Static rules only. No product file was changed. Both test files were edited with the Edit tool only (additive).

## 1. Files changed

| File | Change |
|---|---|
| `apps/core-server/src/capture/__tests__/static.test.ts` | ONE appended `describe` block (`row 157 / AD-08 ...`, 6 cases: 3 rules, 3 planted controls); 62 -> 68 cases |
| `apps/core-server/src/credential-store/__tests__/static.test.ts` | ONE entry of `CREDENTIAL_STORE_USERS` (`src/capture-composition.ts`, SR-10, PROVISIONAL) and ONE case `SR-10` (purpose + control); 10 -> 11 cases |

## 2. Row 157: what the rule holds

### (a) The mounts keep today's argument members (table `MOUNT_MEMBERS`)

Members are read by a small walker (`argumentMembers`) at every depth of the argument (`sinks.info`), a spread as `...name`, a computed key as `[computed]`; a function body and a type literal are closed (what a function does is not a member). A missing member and a second call are violations too.

| Call | File | Members pinned (verbatim) | Admitted by |
|---|---|---|---|
| `mountCaptureFence(app, {...})` | `src/capture/index.ts:309` | `timers`, `sinks`, `sinks.info`, `sinks.warn`, `sinks.error`, `sinks.persist`, `reloadState` | task 3 row 136 |
| `mountCaptureBootChecks(app, {...})` | `src/capture/index.ts:327` | `timers`, `sinks`, `sinks.info`, `sinks.warn`, `sinks.error`, `sinks.persist` | task 3 row 61 (D138); C55 DD-1: host facts are NOT a member |
| `composeProductionCaptureOf(app, {...})` | `src/index.ts:117` | `platform`, `network` | `platform`: row 85b, C55 / C60; `network`: pass I-9a, C76 (row 108, C60 (4)) |
| `captureBootControl(app).provideHost(captureHostOfProcess({...}, createSystemTimers()))` | `src/index.ts:120` | `platform`, `startArguments`, `nodeOptionsSet`, `userLimits` | row 85, C46, C55 DD-1 |

Also held: each mount is called from one place beside its declaration; the two mount calls are pinned by their literal text (member VALUES: `createSystemTimers()`, the app's log and error log, the engine resync); the composition statement is the literal text of C76.

Control `(a) control`: 10 planted mutations, each named by the rule - `signingKeyIsDevelopment` on the boot-check mount (AD-08's own example), nested `sinks.audit`, a spread `...config`, `[computed]`, `timers.fake` inside a call plus `door` on the fence, `cardPrograms` on the composition, `coreFileLimit` on the host facts, a member taken away, a second call.

### (b) No test key maker under `src/`

The key maker of row 89 does not exist yet (its place is `apps/core-server/test/support/`), so the rule holds it by place and by act:
- no production source imports a specifier of `test/`, `__tests__/`, a `*.test` file or a fixtures folder (static import, side-effect import, dynamic `import()`, `require`);
- the two injectable checks `signingKeyIsDevelopment` / `demoPasswordOperators` are named by `src/capture/boot/checks.ts` and `src/capture/boot/index.ts` only (nobody under `src/` hands one in);
- a key pair is generated in `src/capture/signer/host-key.ts` only; `provisionSigningKey(` is named by that file and `src/sealing/signing.ts` only.

Control `(b) control`: importers by relative path, dynamic import, `__tests__` folder and test file are each seen (4 of 4; `../contest/index` is not); a second generator and a handed-in check are seen.

### (c) The closed list of configuration keys (`CONFIGURATION_KEYS`, 22 names, each with its row)

`DEMS_CAPTURE_ALIAS_SOCKET` (task 4 row 105), `DEMS_CAPTURE_AUDIO_HELPER` (task 4 row 85c, C60 (3), C63 (c)), `DEMS_CAPTURE_DEV_FAKE_MIC` (D198), `DEMS_CAPTURE_DEV_SOURCES` and `DEMS_CAPTURE_HELPER_FFMPEG` (task 3 row 136, OD-14 / D108), `DEMS_CAPTURE_GUARD` and `DEMS_CAPTURE_RELAY` (task 4 row 21), `DEMS_CAPTURE_MODE`, `DEMS_CAPTURE_WORKER`, `DEMS_MEDIA_DIR` (task 3 row 58, OD-14), `DEMS_INSTALLATION_DEVICE_ID`, `DEMS_INSTALLATION_NAME` (D207), `DEMS_CORE_PORT`, `DEMS_DEMO_CONTROLS`, `DEMS_LOG_LEVEL`, `DEMS_PG_HOST`, `DEMS_PG_PORT`, `DEMS_PG_DATABASE`, `DEMS_PG_APP_ROLE`, `DEMS_PG_APP_PASSWORD` (plan row W08), `DEMS_PG_OWNER_ROLE`, `DEMS_PG_OWNER_PASSWORD` (the database commands).

Also held: no name of the list says test (`TEST|E2E|FIXTURE|DOUBLE|STUB|MOCK|SEAM|BYPASS|SKIP|FULL_SESSION|INSECURE|UNSAFE`); no non-TypeScript source of `src/` names a key; the environment is read by `src/index.ts`, `src/db/commands/cli.ts`, `src/db/reset/cli.ts`, `src/db/seed/cli.ts` only; the one variable read by name is `NODE_OPTIONS` in the entry (C46); `process.argv` / `parseArgs(` in `src/db/commands/cli.ts` and `src/sealing/dev-key-cli.ts` only; `process.execArgv` once, in the entry.

Control `(c) control`: `DEMS_CAPTURE_TEST_SIGNING_KEY` and `DEMS_BOOT_CHECKS_SKIP` are seen as unlisted and as saying test; a new environment read and a new command-line read are seen.

## 3. SR-10 (decision C76)

`CREDENTIAL_STORE_USERS` gained `src/capture-composition.ts`; the comment states SR-10, C76, the one purpose `capture.open`, PROVISIONAL until the security review of row 86 confirms or reverses it. The list admits a file, so the purpose is a case of its own: every line of the composing file that touches the store is pinned (5 lines: the one import of `coreCredentialStore`, `const opened = coreCredentialStore(app);`, the two reads of `opened.status`, `return opened.store.capture.open(deviceId, sealed);`), one question to the store, one call on it. Control: 7 planted second uses (a seal, a second question, a destructured store, the store handed on, a named secret, a second imported name) are each seen. If row 86 reverses SR-10: remove the entry and the case together.

## 4. Checks (one run each after the last edit)

| Check | Command | Result |
|---|---|---|
| The two files | `npx vitest run src/capture/__tests__/static.test.ts src/credential-store/__tests__/static.test.ts --maxWorkers=2` | `Test Files 2 passed (2)`, `Tests 79 passed (79)` (first run: 1 red of mine, an ordering of a file list - fixed, second run green) |
| Static set of `apps/core-server` (46 files: every `static.test.ts` and `test/static/*.test.ts`) | `npx vitest run <46 files> --maxWorkers=2` | `Test Files 1 failed | 45 passed (46)`, `Tests 1 failed | 787 passed (788)` |
| Typecheck | `npx tsc --noEmit` | exit 0 |

Red that is not mine: `src/modules/capture-config/__tests__/static.test.ts:175` (R-5, `REVEAL_REASON_WRITERS`): the scan also finds `src/capture/host-alias/journal.ts` and `src/capture/host-alias/lifecycle.ts` (row 106's new files). Not touched.

`src/credential-store/__tests__/static.test.ts:89` (the red of C76 item 4) is green.

## 5. Driver decisions (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| DD-1 | The DECLARED members of `CaptureBootMount` / `CaptureFenceMount` are not pinned; the CALLS under `src/` are | AD-08 (2) names the mounts "in `src/`"; the full-session test boots the real app, which reaches the mounts only through the two calls. An optional member nobody under `src/` hands in cannot serve it. Pinning the declarations would also collide with the boot row in flight (K3) |
| DD-2 | The two mount calls are also pinned by literal text (member values) | a seam can hide in a value (`timers: seam ?? createSystemTimers()`) without a new member name |
| DD-3 | The key maker is held by place and act, not by name | row 89 has not made it; when it exists a name pin can be added as one line |
| DD-4 | Scope is `apps/core-server/src/` as AD-08 says; `cli/` (rule set of agent X4) and `apps/capture-worker` are outside | the row's words |

## 6. Not proven here

The rule is text-based: a key read through a value named other than `process.env` with a name not starting `DEMS_` (for instance inside `loadConfig`) is held by the digest pin of `config.ts` and the frozen loader rules, not by this block. AD-08 (1) and (4) are row 89's.
