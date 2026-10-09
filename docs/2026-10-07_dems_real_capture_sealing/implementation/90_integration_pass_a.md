# 90 — Integration pass A (decision D109)

Date 2026-10-09. Agent: coder-execution. Scope: six cross-row seams whose owner rows are finished. No commit.

## What was built

| # | Seam | Where | State |
|---|---|---|---|
| 1 | `ENCRYPTED` STT credential through an opener | `apps/transcriber/src/key-loader.ts:122` (`openCredential`), `:146` (`credentialOf`), `:160` (`releaseCredential`); `probe.ts:54/90/107`, `adapter.ts:49/71` (`encryptedCredential` on both deps). Core: new `apps/core-server/src/transcription/credential-opener.ts` (`coreSttEnvelopeOpener`), `probe.ts:169-201`, `session.ts:197-241`, mount `index.ts:215` | real |
| 2 | `createEngineGuard` exported and in the mount | `apps/transcriber/src/index.ts:21,26` (+ `EngineGuard`, `ENGINE_RECORD_FILE`); `apps/core-server/src/transcription/index.ts:322` | real |
| 3 | `modules/system` reads the transcriber's state | `apps/core-server/src/modules/system/index.ts:117` — `options.transcriber ?? transcriptionServiceSource(app)`. No frozen-file edit; `app.ts` unchanged | real |
| 4 | `@dems/transcriber` is a dependency of core-server | `apps/core-server/package.json`; `package-lock.json` (2-line move, under `.locks/npm.lock`, no cache fallback needed) | done |
| 5 | Verifier's fragment opener | new `apps/core-server/src/evidence-verify/fragment-opener.ts` (`coreFragmentOpener(app)`, exported by the unit's index); `CREDENTIAL_STORE_USERS` entry at `credential-store/__tests__/static.test.ts:29` | real opener; the unit itself is still called by nothing in production (row 85's other "to wire" items) |
| 6 | `CAPTURE_AAC_FRAME_SAMPLES` held to `AAC_FRAME` | `apps/core-server/src/capture/__tests__/protocol-pins.test.ts:67` (one assertion, in the origin test; row 59's pins untouched) | done |
| 7 | Nothing else dropped or renamed | `log` / `transcriberLog` alias kept; memory snapshot store kept | — |

How the opener works: the transcriber imports no store. The composition states "the stored credential is encrypted" by handing in `{ open }`; the key-loader calls `open` and puts the text straight into its opaque holder. No opener, an opener that throws, an empty or non-text answer: `CREDENTIAL_UNAVAILABLE`, no connection; a thrown message is never read (only a code-shaped `code` is kept). In the probe the holder is emptied when its one request ends. In the Core the opener is `store.stt.open(sealed)` over the envelope the one reveal caller read; the store is asked when a credential is opened, never at mount.

## Tests (red before / mutation)

New: `apps/transcriber/src/__tests__/key-loader.test.ts` (5 cases appended); `apps/core-server/src/transcription/__tests__/encrypted-credential.test.ts` (4), `dependencies.test.ts` (1, red before the move); `modules/system/__tests__/routes.test.ts` (1 case, real `mountTranscription`); `evidence-verify/__tests__/real-fragment-cipher.test.ts` (4; `support.ts` gained the option `sealer`).

- Canary, op-92 probe path, ENCRYPTED sealed by the REAL credential store (key file in a temp data directory), loopback fake oMLX: 2 runs OK, header seen by the fake = 2, **0 hits** of the key (plain, base64, URL form, `Bearer `) in log lines, persisted error entries, results, the control object and the statements; also after a 401 and an unreachable endpoint. Flipped envelope byte / destroyed key / kind changed: `CREDENTIAL_UNAVAILABLE`, 0 requests.
- Session adapter: transcribes with the opened key, 1 reveal, key in no output; key destroyed: `UNAVAILABLE`, 0 requests.
- Engine guard: a recorded stand-in process is killed (SIGKILL) at `openSession` and its record removed.
- Verifier with the product cipher: 14 of 14 PASS; one flipped byte fails exactly `VIDEO-02 fragment 3`; relocated ciphertext fails exactly V-02; key destroyed fails exactly V-05 (`SESSION_KEY_UNAVAILABLE`). Control: the double's opener does not open the product-sealed package.
- Mutations, 9 of 9 red and restored: no opener to the probe / to the session; no engine guard; opener failure swallowed; system default back to not-mounted; fragment opener returns stored bytes; AAC pin pointed at `SR`; probe does not release the key; verifier entry removed from the user list.

## Results (final run)

| Command | Result |
|---|---|
| `npm run test -w @dems/transcriber` | 20 files, 555 passed, 3 skipped |
| typecheck + lint, transcriber | clean |
| core unit: `src/transcription src/modules/system src/evidence-verify src/credential-store protocol-pins test/static` (+ `src/modules/stt-config` as regression) | 524 passed, 4 failed — none in this pass's files (below) |
| core db under `.locks/db-migrate.lock`: `src/modules/system` + `stt-config/op92-booted.db.test.ts` | 3 files, 44 passed; no schema pin moved |
| typecheck core-server | 4 errors, all other rows' files (below) |
| lint core-server | 0 warnings in this pass's files |

Reds attributed by file name (not fixed): `test/static/credentials.test.ts` x2 -> `src/capture/adapters/local/__tests__/mic-helper.generated.test.ts:176`; `test/static/imports.test.ts` -> `src/modules/capture-discovery` has no index (earlier in the session also `src/capture-notices`, `src/capture/fence/sources.ts:23`, a `src/capture` <-> `capture-config` cycle, `onvif-session.ts:51` in `network.test.ts`: gone or changed by the end); `stt-config/__tests__/routes.test.ts` MODG registry totals (ops 93-97 landed). Typecheck: `onvif-session.test.ts(331)`, `capture-discovery/connect/__tests__/limits.test.ts(183)`, `permission-guard/decision.ts(223)` and `test/acceptance/rbac-matrix.support.ts(623)` (`WEB_CONSOLE_SESSION`). `verify-v2.test.ts` "V-03 ... source class" was red once (17:27) while `packages/shared/src/evidence-package/manifest.ts` and `evidence-verify/verify.ts` were being edited by another row; green in the final run.

## Decisions for the controller

1. **Two entries in `CREDENTIAL_STORE_USERS`, not one.** The brief allowed one (the verifier). Item 1 asks for the wiring inside `src/transcription`, and the only other way is an edit of `modules/stt-config/index.ts` (not in this pass's paths). Row 84's note names this second user. If the list must stay at one new entry: hand `openEncrypted` to `mountTranscription` from stt-config (the option exists) and delete `credential-opener.ts`.
2. `modules/system` now imports `../../transcription` by value; its own import pin was extended by that one line.

## Not done / outside the list

- `credentialKeys.retainOnly('STT_API_KEY', [ref])` after a reveal (row 115's rotation hook) is not called: keys of replaced envelopes stay in the store.
- The audit row of operation 92 is written by `modules/stt-config`; the canary sweep covers what the probe returns to it, not a booted route with an ENCRYPTED row (that db test file is not in this pass's paths).
- The session adapter keeps the opened key for its lifetime, as it does for a reference; only the probe is request-scoped.
- `coreFragmentOpener` opens the key file once per fragment (no key is cached). Fine for verification; the export / Range rows should look at it for large packages.
- `modules/system/status.ts:25-33` still says the transcriber is "not mounted yet" (comment only).
- `transcription/__tests__/probe.test.ts` "(the seam)" case now stands for "no opener handed in"; its title is unchanged.
- Device/browser checks for the gate: System page / mobile STT status show `Transcription Service` RUNNING / STOPPED / DEGRADED on a real-capture Core; Settings -> STT with a typed secret -> Test connection answers OK.
