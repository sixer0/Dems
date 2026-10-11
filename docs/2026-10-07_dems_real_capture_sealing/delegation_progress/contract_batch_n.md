# Contract note of batch N (driver: coder-execution) — for the docs agent

Written 2026-10-11 21:25 (first entry: item 6, the script names). Later sections are appended
below as they become final; a section is final only when it says "FINAL".

## 1. Package scripts (item 6: R101-05 + T100-03) — FINAL

Root `package.json`. `npm test` is UNCHANGED (it still runs each workspace's `test` script:
core-server `--project unit` only; no db suite, no gated suite, no worker check).
All are run from the repository root. Those marked SANDBOX OFF bind loopback ports and / or use
the project PostgreSQL.

| script | one-line purpose | what it runs | needs |
|---|---|---|---|
| `npm run test:seal-e2e` | The seal end-to-end: the BUILT capture worker records, the composition seals, operation 41 verifies (3 tests: clean, killed mid-recording + recovery, unsealable + quarantine). | sets `DEMS_SEAL_E2E=1`; `seal-e2e.db.test.ts`, db project, `--maxWorkers=1`, under the heavy-host lock and the db lock | built worker, `npm run capture:dev-setup`, PostgreSQL running, SANDBOX OFF; about 1 minute |
| `npm run test:dev-session-e2e` | The development-session end-to-end on GENERATED sources: start, durable, stop, seal; no device is opened. | sets `DEMS_DEV_SESSION_E2E=1` and UNSETS `DEMS_LOCAL_SESSION_ATTENDED` / `DEMS_USER_ATTENDED`; `development-session-e2e.db.test.ts`, same locks, `--maxWorkers=1` (2 tests run; the speech case and the attended case stay skipped) | as above; under half a minute |
| `npm run test:kill-matrix` | The M7 kill matrix: every ACTIVE cell (35) once, in one call; the 10 parked cells are not started. | `scripts/test/kill-matrix.sh` reads the cells from `kill-matrix/run.sh --list` and calls `run.sh --only <id> ...` (which sets `DEMS_KILL_MATRIX`, checks the built worker and the helper, takes both locks) | as above; about 10 minutes |
| `npm run test:capture-worker` | The capture worker's own checks: static rules of the C sources (`check.sh`), their self-test (planted lines), the C unit tests with their negative controls, and the build with the import net. | `make -C apps/capture-worker` | the C toolchain, `pkg-config` and the FFmpeg libraries already on the host (nothing is installed); no port, no lock; under a minute |
| `npm run test:capture-worker-e2e` | The capture worker's end-to-end series on the fixtures (every check and every negative control), one exit code. | `make -C apps/capture-worker e2e` (takes the heavy-host lock itself) | two free loopback ports of 8555, 8557, 8559-8564, SANDBOX OFF; about 35 minutes |
| `npm run test:regression` | The whole regression, strictly one step after another, stopping at the first failure: typecheck, lint, the eight suites (shared, capture-protocol, core-server unit, core-server db, core-web, mobile, transcriber, mock-core), pg-scripts, the worker checks, the three gated suites, the worker e2e series. | `scripts/test/regression.sh` (16 numbered steps, the commands of test/17 Part A) | everything above; about 75 minutes; `DEMS_REGRESSION_SKIP_WORKER_E2E=1` leaves the 35-minute worker series out and says so in its last line |

Text the README paragraph can use ("What `npm test` does not run"):

> `npm test` runs the unit suites only. It does not run the database suite (`npm run test:db`),
> the three scenario suites that drive the built capture worker (`npm run test:seal-e2e`,
> `npm run test:dev-session-e2e`, `npm run test:kill-matrix` — skipped inside the db suite unless
> `DEMS_SEAL_E2E`, `DEMS_DEV_SESSION_E2E`, `DEMS_KILL_MATRIX` are set, which these scripts do), or
> the capture worker's own checks (`npm run test:capture-worker`, `npm run test:capture-worker-e2e`).
> `npm run test:regression` runs all of it, one step after another. None of these opens a camera
> or a microphone.

Status of the scripts at the time of writing: syntax checked; `test:capture-worker` is run once by
the driver (result in implementation/164); the three gated scripts, `test:capture-worker-e2e` and
`test:regression` are NOT run by the driver (test runner).

## 2. New and changed names of batch N — FINAL (2026-10-11 22:12; "BN consistent": every suite below is green)

All additive. Totals unchanged: 97 operations / 36 GET / 61 POST / 67 audit types; schema 6 / dbc-7.
No operation, no audit type, no schema member of a request or a response was added, removed or renamed.

| item | name | where | what it is |
|---|---|---|---|
| S99-01 | boot refusal `CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION` (member `CaptureBootRefusal.DEMO_PASSWORD_IN_PRODUCTION`) | `apps/core-server/src/capture/boot/checks.ts` | boot step `capture.boot`, check 4c, `REAL_PRODUCTION` only. Reason `operators=<count>` or `OPERATORS_UNREADABLE` (fail closed). Log / error-log context: `{ code, operation, reason, operators: <count> }`. No operator id, hash, salt or password in any line |
| S99-04 | rule 1b of the log-blanking rule set | `packages/shared/src/api/redaction.ts` (`URL_USERINFO`) | `scheme://user:password@host` becomes `scheme://***@host`, any scheme; a userinfo without a password stays |
| S99-09 | `STT_CREDENTIAL_WEB_CONSOLE_ONLY`, `STT_CREDENTIAL_WEB_CONSOLE_ONLY_REFUSED`, example `STT_WEB_CONSOLE_ONLY_EXAMPLE` (registry example `updateSttConfig` 403 `webConsoleOnly`) | `packages/shared/src/api/transcription.ts` | description sentence, 403 description part and 403 example of operation 91. The `access` member of operation 91 is UNCHANGED (`CAPTURE_CONFIG`, no condition) |
| S99-09 | `PermissionGuardControl.requireWebConsoleSession(request)` | `apps/core-server/src/plugins/permission-guard/index.ts` | the condition's refusal for a rule that depends on the body |
| V98-13 | report code `CAPTURE_PRECHECK_PROBE_SOURCE_FAILED` (`PrecheckReportCode.PROBE_SOURCE_FAILED`) | `apps/core-server/src/capture-notices/precheck.ts` | log / error-log code only; no new notification cause, no new sentence |
| R101-03 | module `@dems/shared/evidence-rules`: `v2FilePartOutcome`, `V2_FILE_PART_CHECK`, `V2FilePart`, `V2PartOutcome` (`PASS` / `FAIL` / `NOT_RUN`), `V2FilePartFacts`, `readTranscriptModel`, `ItemTranscriptModel`, `TRANSCRIPT_MODEL_MEMBER`, `TRANSCRIPT_MODEL_TEXT_MAX` (256), `readRevisionReason`, `REVISION_REASON_MEMBER`, `REVISION_REASON_MAX` (500) | `packages/shared/src/evidence-rules/index.ts`; export `./evidence-rules` of `packages/shared/package.json` | the one rule set both clients import |
| V98-09 | `SESSION_CAPTURE_CHECKPOINTS_EXAMPLE` | `packages/shared/src/api/state-slices.ts` | contract example of `session.captureCheckpoints` (24 fragments, 34,000,000 bytes, two cameras) |

## 3. Errata the docs agent must write (exact sentences)

**E-BN-1 (S99-01) — capture spec `05` §A.1.2 / §H boot checks, security text, README limits table.**
> A Core whose capture operation is `REAL_PRODUCTION` does not start while any operator's stored
> credential still verifies against the published demonstration password of the seed, or while its
> operators cannot be read: boot step `capture.boot` refuses with
> `CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION` (reason `operators=<count>` or
> `OPERATORS_UNREADABLE`). The check verifies each stored hash set with the product's own verifier
> and logs the count only. `SIMULATED` and `REAL_DEVELOPMENT` are unchanged. There is still no
> operator-provisioning or password-change operation: a seeded database is therefore not a
> production database, and `REAL_PRODUCTION` cannot be started on one. `db:seed` / `db:reset` do
> not refuse a production environment (open, S99-01 (b)), and the sign-in cards of both clients
> still print the demonstration password (open: no Core-stated fact reaches a signed-out client;
> R101-01).

README limits row (if the table has none): "Demonstration password — refused at boot in
`REAL_PRODUCTION` (`CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION`); no provisioning path exists yet".

**E-BN-2 (S99-09) — API contract `03` §2.5 operation 91, access notes §2.6, the access table.**
> Operation 91 `updateSttConfig`: access `CAPTURE_CONFIG` (unchanged). A body that carries
> `credential` (`SECRET`, `REFERENCE` or `CLEAR`) is web console only: a session bound to a paired
> tablet or phone is refused `403 NOT_PERMITTED` with `details.reason: WEB_CONSOLE_ONLY` and one
> `ACCESS_DENIED` row (`details: operationId, permission, role, reason`), before the credential is
> read, sealed or stored. The same session may send every other member. The rule is applied by the
> operation's handler through the permission guard (`requireWebConsoleSession`), not by the access
> member, because the access rule is decided before the body is parsed; the condition
> `WEB_CONSOLE_SESSION` therefore still stands on operations 89, 95 and 96 only. The in-app
> simulator of a tablet or phone answers the same.

**E-BN-3 (S99-04) — C3 §2.5 / the log-blanking list (SEC35-04).**
> The shared log-blanking rule set blanks the userinfo of a URL that carries a password, whatever
> the scheme: `rtsp://user:password@host/...` is kept as `rtsp://***@host/...`. A password with a
> raw `/` is not covered (no URL parser reads it); a userinfo without a password is not blanked.

**E-BN-4 (V98-13) — capture spec `05` (probe at every use), UX `08` §8e.**
> A pre-check whose reachability probe cannot be made (the source of the probe throws) is judged
> with every configured source NOT REACHABLE: a camera with cause `UNREACHABLE`, a microphone with
> cause `OPEN_FAILED` - the causes a failed read of that source already has; no new cause and no
> new sentence. The start rule then blocks or warns as for any unreachable source, and the failure
> is logged once as `CAPTURE_PRECHECK_PROBE_SOURCE_FAILED`. "No adapter is registered" (the source
> answers none) is unchanged: nothing is asked. Operation 97 is unchanged: 503 `CAPTURE_NOT_READY`.

**E-BN-5 (R101-03) — UX `08` verify result (file row), evidence spec, both clients.**
> One part of a camera-file row of operation 41 (stored bytes = V-04, decrypted bytes = V-05,
> fragment chain = V-06) reads PASS when the answer states it; "Not run" - never FAIL - when the
> answer states the check did not run for that part (`files[].plainChecked: false` for the
> decrypted bytes of that file, or the part's check `SKIPPED` in the same result); else FAIL.
> The rule, the reader of `transcriptModel` (text members 1 to 256 characters, as the contract)
> and the reader of a revision's `reason` (trimmed, 1 to 500 characters) are one module of the
> shared package (`@dems/shared/evidence-rules`) that the web console and the mobile apps import.

Changed behaviour to state: on the web console a stored-bytes or fragment-chain part whose check
was SKIPPED read "FAIL" and now reads "Not run"; the web's bound of `transcriptModel.report` was
1,024 characters and the mobile apps' 1,000 / 200 for `name` and `version` - all are now 256;
`quantisation` was 64 on both and is now 256; the web showed a revision reason untrimmed.

**E-BN-6 (V98-08) — `delegation_progress/contract_wave_m.md` lines 39-45 and wherever the table is repeated.**
> The members of this table are members of the STATE SLICE `session` (topic `state`):
> `session.precheck.items[]` there carries `reasonCode` and `params { deviceId, rule }`
> (`PrecheckItemStateSchema`, `packages/shared/src/api/state-slices.ts:210-218`). Operation 27
> `GET /api/v1/session/current` answers the design-book item (`PrecheckItemSchema`,
> `packages/shared/src/api/core-api.ts:285-292`): `id`, `status`, `value`, `reason` and nothing
> else (API-1: the design-book operations keep their response schema). A read of operation 27
> that shows no `params` is the contract. Both clients read the slice.

No code changed for V98-08; a test now pins both shapes (`packages/shared/test/sim-own-capture.test.ts`).

**E-BN-7 (T100-02) — test strategy `10`, row `M5-SEC-SRC-1`.**
> Suite part PROVEN (batch N): `apps/core-server/src/capture-session/__tests__/session-capture.db.test.ts`,
> describe "M5-SEC-SRC-1 (the suite part)": four assigned devices of the kinds ONVIF_RTSP /
> USB_AUDIO in a registry of the production class - 409 `SOURCE_KIND_NOT_RECORDABLE`, 0 workers
> started, 0 sources asked to open, 0 source rows, nothing added to the evidence volume; control:
> the development registry records. The class refusal is `M5-SRC-REC-1` of the same file.
> LIVE PART NOT PROVEN and not provable at HEAD: the socket snapshot "0 listeners in 8554-8564" and
> the local push that finds the port closed need a STARTED `REAL_PRODUCTION` Core with the built
> worker; such a Core cannot boot today (no production signing key can be provisioned, S99-13; the
> seed's operators are refused, S99-01). Its negative control (the push is accepted in
> `REAL_DEVELOPMENT`) is the development-session e2e (`npm run test:dev-session-e2e`).

**E-BN-8 (S99-07) — README / security note.** `.gitignore` ignores `*.p8`, `*.wrap`, `*.blob` by
form; `git ls-files -ci --exclude-standard` prints nothing; no tracked file has these extensions.

**E-BN-9 (suite counts for the trackers)** — see implementation/164, section "Proof".
