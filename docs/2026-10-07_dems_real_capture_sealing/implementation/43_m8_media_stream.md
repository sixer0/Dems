---
task_id: 2026-10-07_dems_real_capture_sealing
row: 90
milestone: M8-W1
date: 2026-10-09
agent: coder-execution
status: complete
---

# 43 — M8 media streaming (row 90)

Status: **needs-review**. The server side is built and proven by 92 automated tests of this row (76 core-server, 10 shared, 3 web, 3 mobile); it is **not
mounted in `app.ts`**, because the permission guard has no rule for the registry-external media
route (request filed, blocking for the mount only). No product-sealed package exists yet (row 82):
everything was proven on packages of row 85's test builder sealed with the PRODUCT cipher.

## 1. What was built (paths under `apps/core-server/`)

| Part | Where | What |
|---|---|---|
| Signed media session | `src/media-stream/token.ts:108` (`issueMediaToken`), `:122` (`readMediaToken`), `:87` (`macInput`) | `mts_` + unpadded base64url of `payload ‖ HMAC-SHA-256`. Payload: version, file, `expiresAt`, 8-byte nonce, evidence ID. The operator ID and the auth-session ID are NOT in the token: they come from the principal of the presenting request and enter the MAC. One constant-time comparison; one code for every mismatch |
| Signing key | `src/media-stream/store-door.ts:48` | Named secret `MEDIA_KEY_EVMEDIA_01` (the contract's `MEDIA-KEY-EVMEDIA-01` in the store's name form) of the Core credential store, 32 random bytes, made at first use, HMAC computed inside the store's `use` callback; never held in memory, never the Signer key or a session key |
| Range header | `src/media-stream/ranges.ts:27` | one range: `a-b`, `a-`, `-n`; end cut to the file; start past the end or `-0` = 416; several ranges / other unit / malformed = ignored (200) |
| Package source | `src/media-stream/source.ts:104` (`planMediaFile`), `:178` (`readPlain`) | manifest read through `createPackageReader` of `src/evidence-verify`; believed only if it hashes to its digest AND that digest is `evidence_items.manifest_hash` AND it names the item and session. Range -> `planRangeRead` (row 84) -> only touched fragments are read whole and opened by `coreFragmentOpener` (row 84/85). No cipher, no key, no file write in this unit |
| Item read | `src/media-stream/items.ts:40` | six columns of `evidence_items`, one bind parameter |
| Handlers | `src/media-stream/service.ts:254` (op 88), `:311` (media route), `:198` (`refuse`), `:220` (`holdScope`), `:289` (`recordServed`) | see §2 |
| Composition | `src/media-stream/index.ts:91` (`mediaStream(app)`) | package folder `<mediaStoreDir>/SESSION-<sessionId>` (D133 (2)) |
| Route registration | `src/modules/media-stream/index.ts:41`, `:48` | the ONLY place the two routes are registered (mediation: routes are registered by modules; a module sets no header — so the module registers and the unit serves) |
| Blanking | `packages/shared/src/api/redaction.ts:68`, `:77` | `(ses|dvc|bio)` -> `(ses|dvc|bio|mts)` in the token rule and the scheme look-ahead: the ONE rule set both client lists call (`apps/core-web/src/runtime/error-sink.ts`, `apps/mobile/src/runtime/log.ts`) |
| Pins (by delta) | `test/static/imports.test.ts:76`; `src/credential-store/__tests__/static.test.ts:33` | closed-unit entry; store-user entry (security allowance, §5 D-90-2) |

## 2. Behaviour

Operation 88 `POST /api/v1/evidence/{id}/media-sessions`, optional body `{ "fileId": "VIDEO-01" | "VIDEO-02" }` (none or `{}` = VIDEO-01):
401 / 403 (stage 6) -> 422 body -> 404 -> 409 `MEDIA_NOT_AVAILABLE` (`NOT_A_SEALED_PACKAGE`) -> 403 `NOT_PERMITTED` `EVIDENCE_CASE_SCOPE` + one `ACCESS_DENIED` row -> 503 `NOT_READY` (`CREDENTIAL_STORE_NOT_READY`) -> 409 with a package reason -> 201. One `EVIDENCE_MEDIA_SERVED` row (`fileId, bytesServed: 0, signed, expiresAt`) is committed BEFORE the answer.

Media route `GET /media/:token` (+ optional `Range`):
401 no operator -> 503 -> 403 `MEDIA_SESSION_INVALID` (+ `ACCESS_DENIED` row, denial budget) -> 403 `MEDIA_SESSION_EXPIRED` (no row) -> 403 permission lost / case scope -> 409 -> 416 (`content-range: bytes */size`) -> 200 / 206 with `content-type: video/mp4`, `accept-ranges: bytes`, `content-length`, `content-range`. One `EVIDENCE_MEDIA_SERVED` row per answered range, written when the answer ended, with the bytes actually handed over and `rangeStart` / `rangeEnd`.

**A fragment whose tag fails.** If it is the FIRST piece of the range: nothing is sent, `409 MEDIA_NOT_AVAILABLE`, `details { reason: FRAGMENT_NOT_AUTHENTIC, fileId, seq }`. If it is reached later: status and length are already sent, so the stream stops BEFORE that fragment and the connection is destroyed — the client holds fewer bytes than `content-length` (a media element reports a network error); the same request from that offset then gets the clean 409. In both cases: a `WARNING` `EVIDENCE_MEDIA_SERVED` row ("Media stream stopped: VIDEO-01 fragment 3 (FRAGMENT_NOT_AUTHENTIC)", bytes handed over) and a persistent error-log entry. No byte of a failed fragment is ever sent.

**REAL-evidence scope (SEC35-16, Q-SEC-1 (a)).** `SUPERVISOR`, or `evidence_items.investigator_id == operatorId`; enforced at op 88 and again on every media request. Non-REAL items never reach it (409: clients play bundled media).

## 3. Real vs stand-in

Real: the product fragment cipher and credential store (key files in a throw-away data directory), `coreFragmentOpener`, the HMAC key in the store, manifest schema / hash, the app factory, the real access rule on op 88, the audit writer's detail rules (`auditInputOf`), the shared blanking rule.
Stand-in: media bytes (random, not fMP4), the database (item = a value; `readMediaItem`'s SQL was not run), stage 4 (the test names the principal), the pipeline (records entries), the package folder place, stage 6 on the media route (passed as a scratch route — every refusal there is the handler's own).

## 4. Commands and results (each once; reruns only after a failure)

| Check | Command (repo root) | Result |
|---|---|---|
| M8-RNG-1, binding, scope, tag failure, M8-BLK-1 server side, static rules | `npx vitest run --root apps/core-server --project unit src/media-stream src/modules/media-stream src/credential-store/__tests__/static.test.ts src/plugins/permission-guard/__tests__/static.test.ts test/static` | 20 files, 248 tests passed (76 of them this row's, in 4 files: token + routes 46, ranges + static 30; the rest are the workspace static guards). First runs: 34 red (empty body arrives as `{}`), then 1 red (an array body is the server's 400), then green |
| M8-BLK-1 rule set | `npx vitest run --root packages/shared test/redaction-media-token.test.ts test/redaction.test.ts` | 67 passed (10 of them this row's) |
| M8-BLK-1 list 1 (web) | `npx vitest run --root apps/core-web src/test/media-token-blanking.test.ts` | 3 passed |
| M8-BLK-1 list 2 (mobile) | `npm test -w apps/mobile -- src/runtime/log-media-token.test.ts` | 3 passed |
| Typecheck | `npx tsc --noEmit -p apps/core-server`, `-p packages/shared` | 0 errors in this row's files (other rows' in-flight errors remain: capture tests, `sealing/pipeline/contract.ts`, module supports) |
| Lint | `npx oxlint apps/core-server/src/media-stream apps/core-server/src/modules/media-stream` | 0 findings |
| Mutation proofs | script, one mutant at a time, file restored | 8 of 8 red: session ID out of the MAC (3 tests), operator ID out (3), MAC not compared (6), expiry not checked (2), route binds a fixed session (1), scope always true (2), `mts` out of the blanking rule (8 shared + 1 core), failed first fragment answered empty (2) |

Not proven: a product-sealed package; real fMP4 playback; the stored audit rows and the SQL read on PostgreSQL (no db test written); the real stage 4 (a session that ended); the route under the guard's own rule; behaviour of a real HTTP client on the destroyed connection (asserted in-process only).

## 5. Decisions taken (for the controller)

- **D-90-1** Unit `src/media-stream` + registering module `src/modules/media-stream` (two static rules pull in opposite directions; mediation applied).
- **D-90-2 (security allowance)** `src/media-stream/store-door.ts` added to `CREDENTIAL_STORE_USERS`: the contract puts the media-session key in the store (C3 §2.4). Narrowness is tested: `namedSecrets` only, one `use`, no session key / cipher member.
- **D-90-3** Not mounted: needs a fixed guard rule for `GET /media/:token` (recommended: op 88's rule, EVIDENCE_VIEW).
- **D-90-4** Case holder = `investigator_id`. The spec says "session creator"; that is not stored after a session ends and no migration is allowed. A technician who created a session for an investigator cannot play it.
- **D-90-5** Audit: issue row before the answer; one row per answered range after it ends (true byte counts; a row that cannot be written is logged and persisted, the bytes are already out). A tag failure has no audit type of its own: it is a `WARNING` `EVIDENCE_MEDIA_SERVED` row. A dedicated type would be a contract change (67 -> 68).
- **D-90-6** Binding mismatch and forgery are one answer (`MEDIA_SESSION_INVALID`), audited as `ACCESS_DENIED` under the denial budget; expiry is answered without a row.
- **D-90-7** Request body `{ fileId }` (row 92's request); contract member by D1b.
- **D-90-8** 416 uses the envelope with code `INVALID_INPUT` (`RANGE_NOT_SATISFIABLE`): the vocabulary has no range code.
- **D-90-9** TTL 60 s vs long recordings: an answer in flight is not cut at expiry, but every NEW range request after it is refused, so a player must renew about once a minute. Spec-pinned; flagged as a playback risk for gate 94.
- **D-90-10** Clear bytes of a camera file (container header) carry no tag and are served as stored; their integrity is verify v2 (op 41), not playback.

## 6. To wire

- Guard rule, then the mount lines and pins (`file_requests.md`, 15:23:08Z).
- When row 82 lands: confirm the package root `<mediaStoreDir>/SESSION-<sessionId>` and that `evidence_items.manifest_hash` is the manifest's `manifestSha256`; run the checks of the runner list on a product-sealed package.
- D1b: op 88 request schema and the documented reasons; `modules/evidence/media.ts`: `LIVE_STREAM` for REAL items.

## 7. Device / browser checks left for gate 94

What the server returns for them: op 88 `201 { evidenceId, fileId, url, expiresAt, ranges: true }`; media `206` + `content-range` for every `Range` request, `200` without one, `accept-ranges: bytes`, `content-type: video/mp4`, exact `content-length`, `cache-control: no-store`, `cross-origin-resource-policy: same-origin`.

- **M8-PB-W** (web): open a REAL item, two players (one session per file), play, seek forward / back, play past 60 s (renewal), audio-source band.
- **M8-PB-T / M8-PB-P** (tablet / phone): same with expo-video and the `Authorization` header.
- **M8-EV-SCOPE-1** (lanes): investigator who holds the case plays; another investigator and a technician get 403 and one audit row each; supervisor plays.

## 8. Follow-up (controller ruling D140, 2026-10-09) — the mount

This section supersedes "not mounted" in §§ 0, 3, 5 (D-90-3) and 6. Status of the row: **complete** for its server side; not proven items are listed at the end.

**Built**

| Item | Where |
|---|---|
| Fixed guard rule for `GET /media/:token` = the rule of operation 88 (EVIDENCE_VIEW, `ACCESS_DENIED` / `NOT_PERMITTED`, retired device refused), named `evidenceMediaStream`; derived from the registry's op 88 at book creation; a registry without op 88 gives the route NO rule | `apps/core-server/src/plugins/permission-guard/access-rules.ts` (`EVIDENCE_MEDIA_STREAM_ID`, `EVIDENCE_MEDIA_ROUTE_URL`, `EVIDENCE_MEDIA_SESSION_OPERATION`, `evidenceMediaStreamRuleOf`, two lines each in `ruleAt` / `resolve`); three exports in `plugins/permission-guard/index.ts`. The unit's `MEDIA_ROUTE_URL` IS the guard's constant |
| Mount | `apps/core-server/src/app.ts`: `import { mediaStreamModule } from './modules/media-stream';` and `['modules/media-stream', mediaStreamModule],` |
| Pins by delta | `src/capture/__tests__/static.test.ts` (P25 waived list: my two lines, D140 named), `test/static/scaffold.test.ts` (entry; 27 -> 28, modules 19 -> 20), `src/plugins/permission-guard/__tests__/without-domain-modules.ts` (stub + list entry), `test/acceptance/rbac-matrix.test.ts` (op 88 leaves `DEFERRED_ROUTE`), `test/acceptance/contract.test.ts` (op 88 leaves `LANDED_UNROUTED`, now 5; `EXTERNAL_ROUTES` = channel + media; 98 -> 99; the media rule's marker = op 88's) |
| Tests of the rule | `plugins/permission-guard/__tests__/access-rules.test.ts` (new case: equality with op 88's rule, only that method and path, no rule without op 88, the rule follows the registry), `registered-routes.test.ts` (the route joins the walks of the real app); `modules/media-stream/__tests__/routes.test.ts` (ruling's case) |
| db test | `src/modules/media-stream/__tests__/media-stream.db.test.ts` |

The route tests no longer pass the media route as a scratch route: the REAL stage 6 stands in front of both routes; only stage 4 is a stand-in there, and nothing is a stand-in in the db test except the package folder place and a throw-away credential-store directory.

**Results (each once; the reruns are named)**

| Check | Command (repo root) | Result |
|---|---|---|
| Rule, mount, static guards, row tests | `npx vitest run --root apps/core-server --project unit src/plugins/permission-guard src/media-stream src/modules/media-stream test/static src/realtime/__tests__/plugin.test.ts` | 27 files, 400 tests: 397 passed, 3 failed — 1 mine (the old "permission lost" case asserted the handler's refusal; stage 6 refuses first now — rewritten as the ruling's case, rerun `src/media-stream src/modules/media-stream`: 76 of 76), 2 NOT this row's (below) |
| Caller without EVIDENCE_VIEW is refused before the token is looked at | `routes.test.ts`, "ruling D140" | valid token and garbage get the SAME `403` (`operationId: evidenceMediaStream`, one `rbac.denied` row), nobody gets `401`, no fragment opened; control: with the permission, garbage is the HANDLER's `MEDIA_SESSION_INVALID` and the valid token plays |
| Whole boot with the route mounted | `registered-routes.test.ts` (the real app factory, no stage 6 replaced): `routeProblems()` empty, the router walk equals the rules shown, `checkRouter()` does not throw; its walks ask the media route like every other (401 for nobody; 403 + exactly one row for a role without the permission, handler not reached) | green in the run above |
| db test | `/usr/bin/lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db src/modules/media-stream/__tests__/media-stream.db.test.ts` (outside the command sandbox: loopback PostgreSQL) | 4 of 4, first run: the SQL read as `dems_app` (item, case holder, null, a seeded item is not real); the issue row stored BEFORE the answer and both range rows after it with the exact keys, category EVIDENCE, actor, item, session; API-7 headers on the 201; scope refusal with ONE stored `ACCESS_DENIED` row; a token refused under another operator's real session and under a second sign-in of the same operator, one stored row each; 401 without a credential, no row |
| Typecheck / lint | `npx tsc --noEmit -p apps/core-server`; `npx oxlint` on the three folders | 0 errors / 0 findings in this row's and the guard's files |

**Still red, not this row's (attributed by name)**
- `src/capture/__tests__/static.test.ts` P25 digest: `app.ts` carries row 91's two `evidence-export` lines, which its waived list does not hold. Checked: with those two lines taken out, the file with my two waived lines hashes to the frozen digest.
- `plugins/permission-guard/__tests__/guard.test.ts` "app without the domain modules": `getEvidenceExportJob` — row 91's module is not stubbed in `without-domain-modules.ts`.
- `registered-routes.test.ts` "a role with the permission passes stage 6": `switchAudioSource as INVESTIGATOR: 403` — row 71b's SESSION_HOLDER route.

**Limitations for review row 93**
- **Case holder = `evidence_items.investigator_id`** (accepted, D140 (4)). Consequence: an operator who CREATED the session but is not its investigator — typically a TECHNICIAN who set a session up for an investigator — cannot play that recording; only that investigator and a SUPERVISOR can. The spec's wording "session creator" is not implementable without a stored column (`active_session.started_by` is gone once the session ends).
- A tag failure is a `WARNING` `EVIDENCE_MEDIA_SERVED` row, not a type of its own; range rows are written after the answer ends (a row that cannot be written is logged and persisted; the bytes are out).
- TTL 60 s as the spec has it: renewal is the player's job (row 92).
- A denial at stage 6 names `evidenceMediaStream` as `operationId`; a denial of the handler (token, scope) names `createEvidenceMediaSession`.

**Not proven**: a product-sealed package (row 82) and its real folder place; real fMP4 playback and a real HTTP client on a destroyed connection (gate 94); the acceptance walks (`test/acceptance`) with the moved pins — `contract.test.ts` was red at the baseline and was edited by reading, not run; a session that ENDED (sign-out) against a live token (the second-sign-in case is proven).
