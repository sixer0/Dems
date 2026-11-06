---
task_id: 2026-10-07_dems_real_capture_sealing
row: 113 (M6, R-8; STT configuration contract + API, operations 90-92)
role: NAVIGATOR of the row-113 pair (senior-code-reviewer); independent of the driver
date: 2026-10-09
reviewed: working tree on HEAD 9d3a1ef (uncommitted); driver report implementation/52_m6_stt_config_api.md
narrative_tier: 2
status: complete
verdict: ACCEPT-WITH-FINDINGS (0 blocker, 4 major, 12 minor)
---

# Row 113 navigator review

## 0. Verdict

**ACCEPT-WITH-FINDINGS.** The server side is sound: my own canary attack (28 requests + two forced
500 paths) found the credential in no response, log line, error-log entry, audit row or event. The
contract totals, RBAC, loopback rule and suites are as the driver reports. Four majors need a fix
round or a recorded decision before dependent rows (115, 117) build on this: the two client
blanking lists fail open on several ordinary text forms (N-1), the web Try-it deny list lacks
operations 91 and 89 while a registry comment says otherwise (N-2), the two `app.ts` lines are
outside the spec 05 §I list with no recorded waiver (N-3), and C3 §2.5 needs one erratum for five
driver choices and its stale PROPOSED status (N-4).

No production code was edited by me. One scratch test was written, run and deleted
(`git status --short | grep -i nav113` = no output).

## 1. Findings

| # | Sev | Where | Evidence | Suggested fix |
|---|---|---|---|---|
| N-1 | major | `apps/core-web/src/runtime/error-sink.ts:73-77,89-93`; `apps/mobile/src/runtime/log.ts:59-61` (same three regex texts) | Scratch run of the real `redactCredentials` / `createErrorSink` (§3.5). NOT blanked: (a) members in the other order `{"value":"<canary>","kind":"SECRET"}` and `{"ref":..,"kind":"REFERENCE"}`; (b) JSON inside a JSON string (`\"kind\":\"SECRET\",\"value\":\"<canary>\"`); (c) a value holding `"` (`"value":"***"<canary>"` — tail leaks) or `'` (whole value leaks); (d) `"credential":"<canary>"`, `credential=<canary>`, `kind=SECRET&value=<canary>`, `value: <canary>`; (e) `"secret":"two words <canary>"`; (f) `authorization: Basic <canary>` (only the scheme is blanked); (g) web context nested deeper than 4 levels is returned unblanked (`redactValue` depth cut, `error-sink.ts:91`), and a context member named `value` / `ref` outside a `credential` parent is kept. Canonical order `{"kind":"SECRET","value":..}` IS blanked, and a `credential` context key is blanked whole. No client code puts the body in a report today, so this is the second line only — but it is the control the row text names ("both log-blanking lists cover the credential") and it fails open | Blank the value of `value` / `ref` / `credential` whenever the same object text holds `kind: SECRET\|REFERENCE` in either order; match escaped quotes (`\\?["']`) and consume escaped characters inside the value (`(?:\\.\|[^"\\])*`); add bare `credential` to `CREDENTIAL_MEMBER`; blank the whole rest of an `authorization` value; at depth > 4 return `'***'` instead of the raw value. Add each form above as a test case in both workspaces. Must land before row 117 ships the form |
| N-2 | major | `apps/core-web/src/features/api-reference/try-it.ts:35-42`; `packages/shared/src/api/devices.ts:736`; `packages/shared/src/api/transcription.ts:533`; pin `apps/core-web/src/test/live-api-reference-document.test.tsx` ("86 operations that are not denied goes to the network") | `TRY_IT_DENIED_OPERATIONS` holds the six of AR-3a; `updateSttConfig` (91) and `setCaptureDeviceCredential` (89) carry a secret in the request body — AR-3a's own definition — and are not on it. Two registry comments state "the API Reference offers no Try it for this operation": a control that does not exist. The row's re-pin 83 -> 86 now asserts that 91 goes to the network from Try-it | Add both ids to the deny list; pin becomes 92 - 8 = 84; record the AR-3a list growth (6 -> 8) as a decision. Owner: see §5 (c) |
| N-3 | major (process) | `apps/core-server/src/app.ts:101,322`; spec `masterplan/05_capture_architecture_spec.md:598-625` | §I lists edits 1-12 and ends "Any other change to these three files is a `needs-review` against OD-14". The two STT lines are not among them. OD-14's category "module registration" covers the KIND of edit, and OD-14 says "each edit reviewed" — this review is that. But: no decision records it; the header block `app.ts:17-19` ("WAIVED EDITS ... capture spec §I edits 1 to 6") does not name the STT module and says "Registered after the fourteen: the unit `capture` and ... `capture-config`" while `modules/stt-config` now sits between `demo` and `capture`; the P25 pin (`src/capture/__tests__/static.test.ts:207-226`) filters lines by `/capture/i`, so it cannot see the two lines (it passes: unit suite green for that file) and no other test pins them except the count in `test/static/scaffold.test.ts:49,51` | Record a waiver decision (see §5, item 5); add §I edits 13 and 14 by erratum; add one header line in `app.ts` naming the STT module (allowed by §I: "to record the waived edit set"); add a pin of the two lines (exact text) next to the capture pin or in `stt-config/__tests__/static.test.ts` |
| N-4 | major (doc) | `masterplan/03_api_contract.md` §1, §2.5, §4, §5, §8, §10; `masterplan/01_specs.md:214-219,310` | Five driver choices differ from or extend the C3 text, and the section still says PROPOSED although D24 confirmed it. Line list in §6 | One erratum (data-analyst), lines in §6 |
| N-5 | minor | `apps/core-server/src/modules/stt-config/index.ts:233,291`; `change.ts:199,225` | `lastTest` is kept in memory and never cleared: after an update that changes `backend` / `endpoint` / `model` / `credential`, operation 90 still answers the old `lastTest { reachable: true }` for a configuration that was never tested | Clear `control.last` when `changedFields` holds one of those four; one test |
| N-6 | minor | `index.ts:270-271,187-206` | The probe queue is unbounded (each queued test may hold 3 s; a CAPTURE_CONFIG holder can stack requests), and after `ProbeTimedOut` the next probe starts while a probe that ignores its signal may still be running, so "one at a time" depends on the probe honouring `abort` | Cap the queue (e.g. answer `429`/`503` or share the in-flight result); state the abort duty in `seams.ts` and test it in row 115 |
| N-7 | minor | `change.ts:163-178,202` | `sealer.seal()` is awaited inside the serial pipeline unit while the row lock and the transaction are held: a slow or hung credential store stalls every other unit of the pipeline | Seal before entering the unit when the body carries a SECRET, or bound it with a time limit |
| N-8 | minor | `stt-config/__tests__/routes.test.ts:699-709` | The negative control is real for `logs` and `errorLog`; for `responses`, `auditRows` and `events` it appends the secret to the haystack STRING, which proves the counter, not the capture | Plant through the channel (an audit insert through the stand-in, an injected response) or say so in the report |
| N-9 | minor | `stt-config/__tests__/static.test.ts:27-38,90-98` | The single-caller rule for `dems_stt_credential_reveal` is a text match on the literal name over `apps/core-server` production sources only: a name built from parts (as the test itself does) or a caller in another workspace is not seen; `dems_app` keeps EXECUTE and no reveal is audited (row 112 residual 3, F-4). Privileges verified: `stt-config.db.test.ts:97-104,166` assert 42501 for the three columns and `SELECT *`, and the db project passed | Accept as the documented SEC35-02 alternative; row 115 should add a DB-side call counter or log line by fact when it adds its file |
| N-10 | minor | `packages/shared/src/sim/api.ts` (STT_ROUTES) vs server | Sim parity holds for the main cases (role refusal through `capabilityRefusal`, the shared `planSttConfigUpdate` for loopback / language / backend / 409, NEXT_SESSION, no credential kept). Differences: sim accepts a SECRET with 200 `ENCRYPTED` where the server answers 503 `CREDENTIAL_STORE_NOT_READY`; sim operation 92 always answers 200; audit message "Transcription configuration changed" (sim) vs "STT configuration changed" (server, `change.ts:131`); `pendingForNextSession` by session id (sim) vs by timestamps (server) | Align the audit message; note the two service differences in the operation description (the 503 is already described) |
| N-11 | minor | `packages/shared/src/api/transcription.ts:91,104-111,217-233` | Loopback rule vs DB CHECK (§3.4): no input is accepted by the API and refused by the CHECK. The API is stricter in four cases the CHECK accepts: port `:0`, port > 65535, a path with a line break, length > 512. `endpoint` cannot be cleared once set (no null in the body), so a switch to `cpu-local` keeps the old endpoint | None required; consider `endpoint: null` to clear |
| N-12 | minor | `packages/shared/openapi/openapi.json`; `transcription.ts` | The `all` document gained 3 operations and 6 schemas and `offline` went 23 -> 26 with versions unchanged (0.3.0 / 0.2.0). Follows the C3 §8 rule (mode `simulated` = offline), but §8 states pinned counts | Fold into the N-4 erratum; controller decides whether a version step is wanted (nothing was released at 0.3.0 outside this phase) |
| N-13 | minor | RBAC, device sessions | A SUPERVISOR or TECHNICIAN signed in on a tablet/phone may call 91 and 92 (scratch C: 200 / 503-no-probe). C3 §2.5 gates by permission only and `decision.test.ts:126-132` states "the transport changes no permission"; "read-only on tablets/phones" is a UI rule (row 118: "no edit control on mobile") | None; recorded so that row 118 does not assume a server refusal |
| N-14 | minor (for row 115) | `seams.ts`, `index.ts:264-293` | Operation 92 in this row opens no connection (static rule 3 + provided probe), so it is not an SSRF or port-scan surface today. What row 115 inherits: the stored endpoint may name ANY loopback port and path (`http://127.0.0.1:22`, `:5432` accepted, §3.4); `reachable` is then an open/closed oracle for loopback ports to CAPTURE_CONFIG holders (inside the contract: "one loopback request to the configured backend"), and the key-loader would send the oMLX bearer key to whatever listens there | Row 115: `redirect: 'manual'` and treat any 3xx as unreachable; connect `localhost` as `127.0.0.1` (no resolver); report `reachable: true` only for a well-formed model list; send the key only after the endpoint answered as the expected backend, or accept and record the risk |
| N-15 | minor | `change.ts:193,199` | A no-op update while a session is open answers `appliesFrom: NEXT_SESSION` although nothing was stored; `pendingForNextSession` uses `updatedAt >= sessionOpenedAt` (equal instant counts as pending; D-113-9) | Cosmetic; keep, or answer `NOW` for a no-op |
| N-16 | minor | `apps/mobile/src/runtime/log.ts:108-117` | `sanitizeLogContext` drops nested objects and keys matching `credential` / `secret` / `api key` / `authorization`, but keeps a primitive under `value` or `ref` | Covered by the N-1 fix if the text forms are widened; otherwise add `^value$\|^ref$` only when a sibling `kind` is a credential kind |

## 2. Review items 1-10, decided

1. **Contract fidelity — PASS with erratum (N-4).** Methods, paths, tag, mode, access markers, audit markers, shapes and status codes of 90/91/92 equal C3 §2.5 (`transcription.ts:384-471` vs `03_api_contract.md:311-319`). Driver choices:
   - `409 INVALID_STATE` + `REVISION_CONFLICT` + `currentRevision`: C3 :318 points at "the same optimistic-revision refusal as op 78", but op 78 has none (`03_api_contract.md:198` lists only `409 CAPTURE_CONFIG_LOCKED`). Dangling reference; the choice keeps codes at 40. **Erratum** to state it.
   - optional `language` in the body: C3's member list omits it while naming the reason `LANGUAGE_NOT_SUPPORTED`. **Erratum** (additive).
   - `changedFields` comma-joined string: C3 :334 says `string[]`. **Contract drift, erratum needed**; the flat-map rule of audit details is the reason.
   - `credential` as one closed object: the accepted set equals the union's three forms (scratch A: extra member, both members, wrong kind all 422). Wire-compatible; OpenAPI shape differs. Note in the erratum only.
   - `CREDENTIAL_STORE_NOT_READY` (and `STT_CONFIG_NOT_SEEDED`): new `details.reason` values on the existing `NOT_READY`; C3 §4 :412 lists reasons. **Erratum** (additive).
   - offline 23 -> 26: follows the C3 §8 rule; counts in §8/§10 need the erratum (N-12).
2. **Security — PASS on the server; N-1 on the clients.** §3.2/§3.3.
3. **Loopback — PASS.** §3.4; nothing bypassed; `localhost` is allowed by C3 :328.
4. **RBAC — PASS.** INVESTIGATOR 403 `NOT_PERMITTED` on 91 and 92 (web and device), each audited (driver test `routes.test.ts:167`, re-run green; scratch A: 403/403 with the body present, 0 canary hits); anonymous 401 (driver test :147; contract.test STT block); bad Origin 403 `ORIGIN_NOT_ALLOWED` (scratch C). Not re-verified by me with a real cookie and NO Origin header: the unit harness stands in for stage 4, where a POST without Origin answered 200; the real-cookie Origin walk is the db acceptance file, whose STT block passed.
5. **P25 — needs a recorded waiver (N-3).** §5.
6. **Pin sweep — honest.** §3.6.
7. **Sim parity — PASS for the main cases (N-10).**
8. **Driver's open decisions — §5.**
9. **C3 erratum lines — §6.**
10. **Suites — equal to the driver's numbers.** §4.

## 3. Evidence

### 3.1 Scratch test (deleted)

`apps/core-server/src/modules/stt-config/__tests__/zz-nav113-scratch.test.ts`, run with
`npx vitest run --root apps/core-server --project unit <file> --maxWorkers=2 --reporter=verbose </dev/null`
-> 5 passed. Canary `NAVCANARY-7f3a-Zq9Lm2Xw8Rt5-END`, reference canary `navstore:NAVREFCANARY/zz9.key`;
searched as whole values, four fragments, base64 and hex, over responses (status + headers + body),
the log at level `trace`, the error-log file, audit inserts and event inserts.

### 3.2 Server, validation and parse paths (scratch A)

```
[nav113] SECRET no sealer -> [503,"NOT_READY","CREDENTIAL_STORE_NOT_READY"] row.kind=null
[nav113] SECRET with sealer -> 200 {...,"credentialSet":true,"credentialKind":"ENCRYPTED","revision":2,...,"appliesFrom":"NOW"}
[nav113] REFERENCE -> 200 {...,"credentialSet":true,"credentialKind":"REFERENCE","revision":3,...}
[nav113] A | statuses=[503,200,200,400,400,400,400,400,422,422,422,422,422,422,422,422,422,422,422,422,422,413,400,400,409,200,403,403] | bytes={"responses":16558,"logs":12031,"errorLog":0,"auditRows":1561,"events":2} | HITS={}
```

Covered: a bad token directly after the secret (V8 quotes the surroundings of a JSON error — not
echoed: the answer is the fixed `INVALID_JSON` text), truncated JSON, a bare string body, an array
body, the secret as array / object / number-typed members, as `kind`, as an unknown member NAME, as
`revision`, as `backend`, inside the endpoint's user part, with U+0000, 5 kB oversize (422), a 3 MB
body (413), `text/plain` and form content types (400), a stale revision (409, `currentRevision`
only), and two INVESTIGATOR refusals with the secret in the body. Every 4xx body is a fixed text
plus `details.in` / `details.reason`; none quotes input.

### 3.3 Server, 500 paths (scratch B)

A sealer that throws `Error("cannot seal <plaintext>")` with the plaintext also in `detail`, in an
own property and in `cause`; and a pg-style `23514` on the UPDATE whose `detail` is
`Failing row contains (..., <reference>, ...)`:

```
[nav113] B sealer throws -> 500 {"error":{"code":"INTERNAL_ERROR","message":"The server could not complete the request.","requestId":"..."}}
[nav113] B db refuses -> 500 {"error":{"code":"INTERNAL_ERROR","message":"The server could not complete the request.","requestId":"..."}}
[nav113] B | statuses=[500,500] | bytes={"responses":1097,"logs":3202,"errorLog":2162,"auditRows":2,"events":2} | HITS={}
```

The error log holds `errorName`, `code` and stack frames only (`plugins/logger/error-log.ts:157-167`).
Realtime: the module publishes nothing (no slice; `events` haystack 2 bytes = `[]`). OpenAPI
examples: `transcription.ts:531-543` carry `omlx-settings:auth.api_key` (a pointer) and no SECRET
example. Statements: reads name ten columns, none of the three credential columns
(`statements.ts:62,72`); DB privilege 42501 asserted in the db project (passed).

### 3.4 Loopback (scratch D; `checkRegex` = the CHECK's pattern emulated in JS with PostgreSQL's dot-matches-newline)

Refused by API and CHECK: `http://127.0.0.1.evil.example`, `http://localhost.evil.example`,
`http://[::1]`, `http://[::1]:8000`, `http://[::ffff:127.0.0.1]`, `http://2130706433`,
`http://0x7f.1`, `http://127.1`, `http://127.0.0.2`, `http://0.0.0.0`,
`http://127.0.0.1@evil.example`, `http://evil.example@127.0.0.1`, trailing dot (both hosts),
`HTTP://127.0.0.1`, `http://LOCALHOST`, `https://127.0.0.1`, `http://127.0.0.1:8000#@evil.example`,
`http://127.0.0.1?x=1`, `http://127.0.0.1\@evil.example`, `http://127.0.0.1:80@evil.example`,
`:80:80`, leading / trailing space. All `422 INVALID_INPUT` / `ENDPOINT_NOT_LOOPBACK`.

Accepted by both (host stays loopback): `http://127.0.0.1`, `http://localhost`,
`http://localhost:8000/v1`, `:65535`, `/?next=http://evil.example`, `/\@evil.example`, `/a b`,
`/../../x`, a 417-character path, `http://127.0.0.1:22`.

API refuses, CHECK accepts: `http://127.0.0.1:0`, `:65536`, `:99999`, `/a<LF>b`, a 617-character
endpoint. API accepts, CHECK refuses: none found.

Redirects and DNS: not applicable to this row — the module opens no connection (static rule 3;
`index.ts:265-266` answers 503 without a probe). They are duties of row 115 (N-14).

### 3.5 Client blanking (scratch E, the real web functions)

```
ok    {"revision":1,"credential":{"kind":"SECRET","value":"<canary>"}}        => ...,"value":"***"}}
LEAK  {"revision":1,"credential":{"value":"<canary>","kind":"SECRET"}}        => unchanged
ok    {"revision":1,"credential":{"kind":"REFERENCE","ref":"<ref>"}}          => ...,"ref":"***"}}
LEAK  {"revision":1,"credential":{"ref":"<ref>","kind":"REFERENCE"}}          => unchanged
LEAK  "{\"credential\":{\"kind\":\"SECRET\",\"value\":\"<canary>\"}}"        => unchanged
LEAK  {"credential":{"kind":"SECRET","value":"pre\"<canary>"}}                => "value":"***"<canary>"
LEAK  {"credential":{"kind":"SECRET","value":"it's <canary>"}}                => unchanged
LEAK  value: <canary> | body.credential.value=<canary> | credential=<canary> | "credential":"<canary>"
LEAK  "secret":"two words <canary>"                                             => unchanged
LEAK  authorization: Basic <canary>                                             => authorization: *** <canary>
LEAK  kind=SECRET&value=<canary>                                                => unchanged
ok    apiKey: "<canary>" | x-api-key: <canary> | Authorization: Bearer <canary> | { kind: 'SECRET', value: '<canary>' }
sink  context a.b.c.d.e.credential (depth > 4)                                  => kept raw
sink  context request.body.credential                                           => "credential":"***"
sink  context { value, ref, body: { value } }                                   => kept raw
```

### 3.6 Pin sweep

`git diff HEAD -U0` over every changed test file, removed lines read one by one. A keyword scan of
the changed lines for `skip|todo|timeout|.only|toBeGreaterThan|toBeLessThan|retry|expect.any|toBeDefined|toBeTruthy`
returned nothing. Spot-checked pins (old -> new, cause):

| Pin | Old -> new | Cause |
|---|---|---|
| shared `api-registry.test.ts` registry / GET / POST | 89/34/55 -> 92/35/57 | +3 ops (1 GET, 2 POST) |
| shared access counts | [4,5,29,50,1] -> [4,5,30,52,1] | 90 AUTHENTICATED, 91/92 PERMISSION |
| shared Device tag | `3+6+6` -> `3+6+6+3` | 3 ops tagged Device |
| shared schemas | `...+18` -> `...+18+6`; openapi 152 -> 158 | 6 new schemas |
| shared audit types | 62 -> 63 | `STT_CONFIG_CHANGED` |
| shared request bodies / text-rule schemas | 31 -> 32; 134 -> 140 | op 91 body; 6 schemas |
| shared offline / sim routes | 23 -> 26; 22 -> 25 | 3 simulated ops |
| shared `openapi.test.ts` Core-server-only statuses | 22 -> 23 | the 403 of op 90 |
| core-server `decision.test.ts` cells | 801 -> 828 | 92 x 9; title numbers corrected to the re-derived 29/3/34, body unchanged |
| core-server `contract.test.ts` router | 76 -> 79 | 3 routed ops |
| core-server `rbac-matrix.test.ts` delta rows / routed | 14 -> 17; 75 -> 78; denied `stated` -> `stated + routedDelta` with `routedDelta` pinned to `{INVESTIGATOR: 2, SUPERVISOR: 0, TECHNICIAN: 0}` | not a loosening: the delta is pinned |
| core-server `writers.test.ts` / `audit-details.test.ts` | 62 -> 63; 18 -> 19 | 1 type, 1 allow-list entry |
| core-server `scaffold.test.ts` | 21 -> 24 units; 14 -> 16 modules | rows 57 (2) + 113 (1) |
| core-web document / page | 23 -> 26, 89 -> 92, 22 -> 25, 83 -> 86 | +3; **the 86 encodes N-2** |
| mobile | no count pin; +2 blanking tests | — |

No assertion loosened, deleted or skipped; no timeout raised. `credentials.test.ts`,
`imports.test.ts`, `readiness.test.ts` changes are row 57's (capture process channel, seam).

## 4. Re-run numbers (each `--maxWorkers=2 </dev/null`)

| Suite | Result | Driver said | Class |
|---|---|---|---|
| shared | 73 files, **1894 passed**, exit 0 | 1894 | green |
| core-web | 117 files, **1497 passed**, exit 0 | 1497 | green |
| mobile | 194 suites, **1999 passed**, exit 0 | 1999 | green |
| core-server unit (sandbox off) | **3 failed / 4197 passed (4200)**, 2 files failed of 172 | same | the three MODG tests of `modules/sessions` (x2) and `modules/evidence` (x1): the Session / Evidence tag areas hold the unrouted operations 81-88 — items 1-3 of `implementation/66_recon_core_tests.md:91-98`; pre-existing, not STT |
| core-server db (once, under `lockf -k .locks/db-migrate.lock`, sandbox off) | **12 failed / 1848 passed (1860)**, 1 file failed of 128; teardown dropped 8, 0 remain | same | all twelve in `test/acceptance/contract.test.ts`; every failure body names only the 14 unrouted operations 76-89 (`unregistered` list, 404 where 403/405/200 is specified); no failure text names an STT operation or `/transcription/config` |
| typecheck shared, core-server | exit 0, exit 0 | same | green |
| lint shared, core-server | exit 0, exit 0 | same | green |
| `gen-openapi.ts --check` | "up to date (all: 92 operations, 0.3.0; offline: 26 operations, 0.2.0)" | same | green |
| live databases | `dems_demo`, `dems_lane_1..3`: `db:status: OK`; `dems_demo`: "schema version 2; contract revision dbc-3", "migrations 8 file(s); ledger matches" | same | untouched; `git status --short apps/core-server/src/db/migrations` = 0 lines |

P25 pin: `src/capture/__tests__/static.test.ts` is in the green part of the unit run (it cannot see
the STT lines — N-3).

## 5. Recommendations

**Item 5 — `app.ts` lines.** A module registration is inside OD-14's first category, and OD-14
requires "each edit reviewed": reviewed here, the two lines are an import and one `UNITS` entry,
no stage, seam, decorator or boot-order change (the plugin opens no connection, `index.ts:209-212`).
It still needs a RECORDED waiver, because spec 05 §I is an exhaustive list. Controller: (1) add a
decision "OD-14 extended to the registration of `modules/stt-config` (row 113; R-8/D24), edits 13
and 14"; (2) erratum to spec 05 §I (two rows, count 12 -> 14, `app.ts` 6 -> 8); (3) driver fix
round: one header line in `app.ts` and an exact-text pin of the two lines. No user gate: the
category was approved in D4 (OD-14) and R-8 in D24.

**Item 8 (a) — operation 92 answers 503 until row 115.** Acceptable interim: it is C3's own answer
(:319), nothing false is reported, and the server keeps its no-outbound rule. Conditions: row 115's
verification must include "operation 92 answers 200 on a booted server" (i.e. `provideProbe` is
called in production wiring, not only in tests), and N-14.

**Item 8 (b) — the sealer.** No row of 115-119 builds a credential store. The only row that does is
**row 84** (M7-W3, "session key in the Core credential store", SEC35-08/09/10; cap §D.2), and
SEC35-03 (`09_security_design_review.md:225`) asks for exactly that store. Recommendation: row 84
owns `provideCredentialSealer` and the matching opener for the key-loader. That is a **row-text
addition to row 84 (a blueprint change; I read it as MINOR — scope clarification inside an existing
row, no new row, no new requirement — but the controller classifies it)**. A new row would be a
MAJOR blueprint change and a gate. Until row 84: `SECRET` stays 503, which R-8 allows (narrative:
"a secret reference ... or encrypted"; AC-3 does not require the encrypted form); row 115 must
treat a stored `ENCRYPTED` kind as "credential unavailable"; row 117 must offer the reference form
only and show the 503 reason plainly. Record this as a decision so that rows 115 and 117 do not
each invent a store.

**Item 8 (c) — Try-it.** Severity major (N-2). Owner: a fix round of row 113's driver — the gap
for 91 was created by this row, the web pins were re-set here (86), and it is a two-entry change;
fix 89 in the same edit. Row 117 is the fallback owner, but it starts only after 115 and the gap
would stay open meanwhile.

## 6. Item 9 — lines an erratum must change

`masterplan/03_api_contract.md`:

| Line | Now | Change |
|---|---|---|
| 18 (`last_updated`) | "proposed ops 90-92 ... registry stays 89 until confirmed" | confirmed by D24; registry 92 |
| 21 (title) | "operations 76-89" | 76-92 |
| 106 | "New registry total 89 operations; projected 34 GET / 55 POST" | 92; 35 / 57 (or keep 89 for M2 and point to :107) |
| 107 | "Proposed, not counted (R-8, D20) ... pending Q-STT-CFG ... if confirmed" | "Confirmed (D24), counted: 92 (35 GET / 57 POST), audit types 63" |
| 301 | heading "(PROPOSED — pending Q-STT-CFG confirmation at the second gate; R-8, D20)" | "(CONFIRMED — D24; R-8, D20)" |
| 303-307 | "Status: proposed, not counted ... If confirmed ... If rejected: delete this section" | status confirmed; totals as facts; add offline 26 and versions unchanged |
| 317 | op 90 errors "401" | add 403 (`ORIGIN_NOT_ALLOWED` / revoked device, Core server only) |
| 318 | body list without `language`; "409 (the same optimistic-revision refusal as op 78)"; `credential` as a union | add `language?`; "409 `INVALID_STATE` (`details.reason: REVISION_CONFLICT`, `currentRevision`)"; note the closed-object form; add "503 `NOT_READY` (`CREDENTIAL_STORE_NOT_READY`) for a SECRET while the credential store is not mounted" |
| 326 | "The alternative ... is listed under Q-STT-CFG" | closed by D24 |
| 331 | "A `sttConfig` slice is an alternative left to Q-STT-CFG" | closed by D24: no slice |
| 333-334 | "(proposed audit type ...)"; "`changedFields: string[]`" | confirmed; "`changedFields: string` — the field names joined with a comma" |
| 412 (§4, `NOT_READY` reasons) | `CAPTURE_NOT_READY` only | add `TRANSCRIBER_NOT_READY`, `CREDENTIAL_STORE_NOT_READY`, `STT_CONFIG_NOT_SEEDED` |
| 434 (§5) | "bring the total ... to 62" | 63 with `STT_CONFIG_CHANGED` |
| 680-700 (§8) | "Which of the 14 are visible in `offline`"; 13 visible; "75 to 89", "34 GET / 55 POST"; "offline count (23)" | 17 / 16 visible; 92; 35 / 57; offline 26; versions stay (or the decision of N-12) |
| 725, 742 (§10) | "75 + 14 = 89 ... `offline` grows 10 -> 23"; "(88 -> 89), the offline count (22 -> 23), the audit-type count (60 -> 62)" | 92; 26; 63 |
| 748 (footer) | "proposed §2.5 R-8 ops 90-92" | confirmed (D24) |

`masterplan/01_specs.md`: 214 (heading "PROPOSED — pending Q-STT-CFG"), 216-219 ("Status: proposed
... not counted"), the "(proposed)" in "Measurable acceptance criteria (proposed)", 310
("Q-STT-CFG ... pending"). `masterplan/05_capture_architecture_spec.md:598-625`: §I edits 13-14
(item 5).

## 7. Files reviewed

`packages/shared/src/api/transcription.ts`; `packages/shared/src/sim/api.ts` (diff);
`apps/core-server/src/modules/stt-config/{index,change,statements,seams}.ts` and
`__tests__/{support,static,routes,stt-config.db}.test.ts` (routes: outline + secrecy block);
`apps/core-server/src/app.ts`, `src/core/audit-details.ts`, `src/index.ts` (diffs);
`src/db/schema/stt.ts`; `src/db/migrations/0007_stt_config_privileges.sql`;
`src/plugins/logger/error-log.ts`, `src/plugins/error-envelope/index.ts` (the relevant parts);
`src/capture/__tests__/static.test.ts:150-232`; `src/plugins/permission-guard/__tests__/decision.test.ts:100-135`;
`apps/core-web/src/runtime/error-sink.ts`; `apps/core-web/src/features/api-reference/try-it.ts`;
`apps/mobile/src/runtime/log.ts`; every changed test file as `git diff HEAD -U0`;
`masterplan/03_api_contract.md` §1, §2.2-§2.5, §4, §5, §8, §10; `masterplan/01_specs.md` R-8;
`masterplan/05_capture_architecture_spec.md` §I; `masterplan/09_security_design_review.md`
SEC35-02/03/14; `masterplan/10_test_strategy.md` M6-STTCFG-API; blueprint rows 66, 84, 112-119;
`implementation/52_m6_stt_config_api.md`.

Not done: no browser or device run (not in this row's check); the CHECK constraint was compared
through a JS emulation of its pattern plus row 112's own db evidence, not by new statements against
PostgreSQL; `mock-core` suite not re-run (the driver reports it untouched, 19 passed).

---
*Generated: 2026-10-09*

---

# Re-check of fix round 1 (and its continuation) — 2026-10-09

## R.0 Final verdict for row 113

**ACCEPT-WITH-FINDINGS — 0 blocker, 0 major, 4 minor (all inherited, none holds the row).**
Every major of the first review that was in this round's scope is closed and was re-proven by my
own runs: N-1 (all eleven leaking forms of §3.5 are blanked through the functions the two apps
call), N-2 (89 and 91 denied in Try-it by method + path), N-3 (the P25 pin fails on an unwaived
line — three mutations). N-5, N-6, N-7, N-8, N-10, N-16 confirmed. The model-id pattern held
against 59 inputs on server and simulator. Suites equal the driver's numbers.

No production file edited. Scratch tests (three, in core-web, mobile and core-server) deleted:
`git status --short | grep -i "nav113\|zz-"` = no output. `apps/core-server/src/app.ts` was
mutated three times for item 3 and restored from a byte copy: `cmp` = identical, sha256 prefix
`80792ad34a52e73e` before and after.

## R.1 Who inherits what

| # | Sev | Finding | Inherits |
|---|---|---|---|
| R-1 | minor | `packages/shared/src/api/redaction.ts`: residual fail-open forms, none produced by `JSON.stringify` of the op-91 body (§R.2 list B) | **row 117** (the first row that holds the secret in a client): its report calls must carry no field value; optional hardening by the row-113 driver |
| R-2 | minor | `redaction.ts:137-153`: the object walk has no seen-set and no node budget; depth 12 on a self-referencing object costs branching^12 — measured 2 self-refs 1 ms, 3 = 74 ms, 4 = **2089 ms**; 5 would be about 30 s and far more memory. A context that holds a DOM node, a React fibre or a client error object would freeze the tab inside a sink whose rule is "never fail its caller" (`error-sink.ts` try/catch does not catch a hang). Before this round the walk stopped at depth 4. No caller passes such an object today | **row-113 driver** (small: a `WeakSet` of visited objects -> `'***'`, and a node budget) or row 117 before it reports anything from a form |
| R-3 | minor | The declined boundary (bare `value: X`): I agree with the rule, and I see ONE realistic leak through it — a form or validation report such as `{ field: 'credential.value', value: X }` or `{"path":["credential","value"],"received":X}`. Neither the text rule nor the object rule blanks it (the name stands as a VALUE, not as a member name; §R.2). | **row 117**: a test that a failed save / failed validation of the credential field reports no value; do not rely on the blanking list for it |
| R-4 | minor | `STT_MODEL_ID_PATTERN` accepts a trailing dot (`model.` -> file `model..bin` for `cpu-local`): no traversal (no separator can appear), only an odd file name | **row 76** (transcriber mapping), for information |
| N-4 | major (doc), unchanged | C3 / 01_specs erratum (§6 of the first review) | erratum agent |
| N-9, N-14 | minor | reveal-function rule is textual; probe duties (no redirect, `localhost` as `127.0.0.1`, key only to the expected backend, abort honoured) | **row 115** |
| sealer | decision | `provideCredentialSealer` + opener | **row 84** (D68) |
| N-11, N-12 | minor | `endpoint: null` to clear; OpenAPI version step | erratum owner / controller |
| N-13 | note | device sessions may write (permission only) | **row 118** |
| N-15 | kept | cosmetic | — |

## R.2 Item 1 — N-1 re-attack (real `redactCredentials` / `createErrorSink` of core-web; real `redactCredentials` / `sanitizeLogContext` / `toRuntimeLogRecord` of mobile)

**A. My eleven leaking forms of the first report: all blanked, web and mobile.**

```
ok | {"revision":1,"credential":{"value":"<c>","kind":"SECRET"}}   => "value":"***","kind":"SECRET"
ok | {"revision":1,"credential":{"ref":"<r>","kind":"REFERENCE"}}  => "ref":"***"
ok | JSON in a JSON string, and three levels deep                    => \"value\":\"***\"
ok | value with " inside ("pre\"<c>") and with ' inside ("it's <c>") => "value":"***"
ok | body.credential.value=<c> | credential=<c> | "credential":"<c>" => ***
ok | "secret":"two words <c>"                                        => "secret":"***"
ok | authorization: Basic <c>                                        => authorization: ***
ok | kind=SECRET&value=<c>                                           => kind=SECRET&value=***
ok | sink: credential 5 levels deep => "credential":"***"; depth 13 and 30 => "***" (whole); a self-referencing object is cut at depth 12 with "***"
ok | mobile context {kind:SECRET,value} => {"kind":"SECRET"}; {ref,kind:REFERENCE} => {"kind":"REFERENCE"}; nested body => dropped
ok | mobile bounds: a secret straddling the 500-character message cut and the 200-character context cut is blanked before the cut
LEAK (declined, accepted by the controller) | value: <c>
```

Also closed: unterminated value (blanked to the end), arrays of credential objects, `Bearer` in
prose, lower-case `bearer`, `Bearer` across a line break, `?api_key=`, a 100 kB prefix, a 50 kB
value, YAML form, `headers: [["authorization","Bearer <c>"]]`, an `Error` with
`config.headers.Authorization`, key variants `apiKey` / `api_key` / `x-api-key` / `API Key` /
`Authorization` / `clientSecret` / `secret_ciphertext` / `credentialRef`. A pathological text
(200 000 x `bearer ` + 50 000 x `"secret`) took 8 ms: no regex blow-up.

**B. New forms that still leak (R-1).** None is what a JSON body of op 91 looks like.

| Form | Result | Realism |
|---|---|---|
| `Bearer "<c>"`, `BeArEr <c>`, `Bearer abc:<c>`, `Bearer ab%2F<c>` | untouched, or blanked only up to the first character outside `[A-Za-z0-9._~+/=-]` | low-medium; fix: after the scheme (any case) blank to the next white space or quote end |
| `secret=abc,<c>` (unquoted value holding `,` `;` `&` `)` `]` `}`) | tail leaks | low |
| `["authorization","Basic <c>"]` (header as a tuple) | untouched (no `:` / `=` after the name) | low-medium (`Headers` entries) |
| object keys `credentials`, `sttCredential`, `apiKeyValue`, `secretKey`, `token`, `password`, `passphrase`, `key`, `bearer` in a WEB context | kept (`isCredentialKeyName` is exact for `credential*`; the TEXT rule blanks `sttCredential` — the two rules disagree). Mobile drops all but `key` and `bearer` through its own `SENSITIVE_KEY` | medium for row 117 naming; fix: `name.includes('credential')`, add `token` / `password` / `passphrase` |
| text members `"password"`, `"token"`, `?token=`, `?access_token=`, `"credentials"`, `"apiKeyValue"`, `"secretKey"`, `"api key": ..`, `API Key: <c>` | untouched | names outside the STT rule; the web sink never covered them |
| `{"Kind":"SECRET","Value":"<c>"}`, upper-case keys, `"kind":"secret"`, unicode-escaped key or kind (`"value"`) | untouched | very low (the API accepts none of them; `JSON.stringify` does not escape ASCII) |
| URL-encoded body (`credential%5Bvalue%5D=<c>`, `%22value%22%3A%22<c>`) | untouched | low (the API takes JSON only) |
| prose: `the credential <c> was rejected`, `secret is <c>`, `credential -> <c>`, `<secret><c></secret>`, full-width colon, zero-width or NUL inside the name | untouched | cannot be ruled by a list; noted |
| `{ field: 'credential.value', value: <c> }`, `{"path":["credential","value"],"received":<c>}`, `{ name: 'sttCredentialInput', input: <c> }` | untouched, text and object (R-3) | **the realistic one** for a form |

**CPW1-7.** Read both files: `apps/core-web/src/runtime/error-sink.ts:25-26` — the one value
import is `@dems/shared/redaction`, the other is `import type`; `packages/shared/src/api/redaction.ts`
(153 lines) has no `import`, no `require`, no mention of `zod`; `packages/shared/package.json:20`
maps `./redaction` to `./src/api/redaction.ts`. The changed assertion
(`live-runtime-static.test.tsx:125-138`) pins all four facts; the purpose of CPW1-7 is held.

## R.3 Item 2 — N-2

`try-it.ts:39-48` holds eight ids; the check (`deniedTryItOperation`, `:119-128`, called at `:210`
before the body is read and before `networkFetch`) decides by METHOD + PATH against the registry,
never by an operationId the page supplies, and the method is upper-cased at `:199`. My matrix on
the real function: `POST` / `post` / `Post` to `/api/v1/transcription/config`, with a trailing
slash, a doubled slash, in upper case, percent-encoded (`%63onfig`, `config%2F`) and to
`/api/v1/capture/devices/CAM-01/credential` (+ trailing slash, `a%2Fb` id) all answer the denied
operation; `GET` of the config path stays allowed (`getSttConfig`); `.../config/test` stays allowed.
Not denied: `/config;x`, and a path that still holds `?x=1`, `./` or `../` — the caller passes
`URL.pathname`, which never holds a query or dot segments, and `;x` is another path that the
server does not route. The "never reaches the network" half is the driver's tests in
`live-api-reference-document.test.tsx` (re-run green in the 1523); my own fetch-level scratch was
inconclusive (every request was blocked earlier by the origin rule of my harness). Pin 84 and list
length 8 are in the green run.

## R.4 Item 3 — N-3

`git show 9d3a1ef:apps/core-server/src/app.ts | shasum -a 256` =
`3846e1700616410967dae0e251c07e27f98edd866f826fa549bb1a430f375db8` = the constant at
`src/capture/__tests__/static.test.ts:235`. Runs of that file:

| State of `app.ts` | Result |
|---|---|
| as the driver left it | 23 passed |
| + one `UNITS` entry `['modules/nav113', demoModule],` | **1 failed** ("every added line is a waived one") / 22 passed |
| + a comment line at the end | **1 failed** / 22 passed |
| the waived STT line changed by one space | **1 failed** / 22 passed |
| restored (`cmp` identical) | 23 passed |

## R.5 Item 4 — N-5, N-6, N-7, N-8, N-10, N-16

| Finding | Code | My run |
|---|---|---|
| N-5 | `index.ts` op-91 handler clears `control.last` and bumps `control.tested`; `change.ts` answers `lastTest` null for an invalidating change; op 92 keeps its result only if `tested` did not move | scratch: `lastTest` present after a test, kept after a `diarization` change, absent in the op-91 answer of a `model` change and in op 90 after it |
| N-6 | `control.waiting >= STT_TEST_QUEUE_LIMIT` -> 503 before the probe | scratch: 7 concurrent tests on a held probe -> `[200,200,200,200,503,503,503]`, 1 probe call while held, 4 in total; 200 again after the drain |
| N-7 | `sealSecretOf` runs before `app.pipeline.run`; nothing sealed when the preview refuses; `sealed === null` with a sealer -> 409 | read; the three driver tests (`routes.test.ts:696,720,772`) are in the green unit run |
| N-8 | `routes.test.ts:873-895`: log, error log, an audit row through a real unit, an event through `unit.events.append`, a response through a stored endpoint path | read; green |
| N-10 | one constant `STT_CONFIG_CHANGED_MESSAGE` (`transcription.ts:80`) used by `sim/api.ts:1081` and `change.ts:133` | grep; green |
| N-16 | `apps/mobile/src/runtime/log.ts` `sanitizeLogContext` | scratch: `{kind:'SECRET',value}` -> `{"kind":"SECRET"}` |

## R.6 Item 5 — model id (`transcription.ts:125-131`)

59 inputs, each through `isSttModelId`, `SttConfigUpdateRequestSchema`, the server route
(`sttApp`) and the simulator (`createSim().request`): the four agree on every one, 0 differences.
Accepted: `ggml-large-v3-turbo`, `whisper-large-v3-turbo`,
`mlx-community--whisper-large-v3-turbo-asr-fp16`, 1 character, a leading digit, length 128,
`model.`, `model-`, `model.bin.q8`, `model.bin.`, `modelbin`. Refused (server
`422 INVALID_INPUT`, simulator 422): length 129, empty, `../../etc/passwd`, `a/../b`, `..`, `a..b`,
`/`, `\`, NUL (inside and trailing), LF (inside and trailing — the pattern has no `m` flag), CR,
TAB, DEL, space (leading, inner, trailing), NBSP, leading `-`, `--help`, leading `.`, leading `_`,
`.bin` / `.BIN` / `.Bin` / `.bIn`, Cyrillic `а`, full-width `ｇ`, a combining accent, one-dot
leaders, full-width and division slash, zero-width space, RTL override, `:` `%` `~` `$()` back-tick
`;` `|` `"` `*` `@` `+` `,`. Non-strings are refused without a throw. `model` is no longer
trimmed: `"  whisper-large-v3-turbo  "` -> 422 (a client must trim; note for row 117). A stored
model outside the pattern does not block an update that leaves `model` alone
(`transcription.ts:358` checks the body member only). Totals unchanged: `gen-openapi --check`
"92 operations ... offline 26"; registry pins 92 / 35 / 57 / 63 in the green shared suite.

## R.7 Item 6 — `contract-inventory.test.ts:68`

`git diff HEAD` of the file: one expectation changed, from the full heading
`### B.13 \`stt_config\` (proposed T-40)` to the prefix `### B.13 \`stt_config\` (T-40)`; the
document's line 469 now reads `### B.13 \`stt_config\` (T-40) — ... (CONFIRMED — D24 ...)`. What the
test proved is untouched: the same block still asserts `inventory.counts` (40 tables, 419 columns,
166 CHECKs, 39 foreign keys) and `inventory.tables` ids = `T-01`..`T-40`, and the test above it
still compares the parsed document with the inventory. The heading line was and is only the anchor
that §B.13 names T-40. Not a loosening of substance.

## R.8 Item 7 — suites (each `--maxWorkers=2 </dev/null`)

| Suite | Result | Driver | Class |
|---|---|---|---|
| shared | 74 files, **1936 passed** | 1936 | green |
| core-web | 117 files, **1523 passed** | 1523 | green |
| mobile | 194 suites, **2020 passed** | 2020 | green |
| core-server unit (sandbox off) | **3 failed / 4214 passed (4217)** | same | the three baseline MODG tests (sessions x2, evidence x1) |
| core-server db, FULL project once under `lockf -k .locks/db-migrate.lock` (sandbox off) | **12 failed / 1848 passed (1860)**, 1 file of 128; teardown dropped 8, 0 remain | 12 baseline | all twelve in `test/acceptance/contract.test.ts`; in the log the STT operations appear only on passing `[w52]` lines (`getSttConfig ... 403 ORIGIN_NOT_ALLOWED (a session cookie with an Origin that is no web console origin)`, `updateSttConfig ... 403 NOT_PERMITTED`, the U+0000 walk of `backend` / `endpoint` / `language` / `credential.value`: 422) — this also closes the real-cookie Origin point I had left open in item 4 of the first review |
| typecheck + lint, shared and core-server | exit 0 x4 | same | green |
| `gen-openapi.ts --check` | up to date, 92 / 26, 0.3.0 / 0.2.0 | same | green |

Attribution against row 76: no failing test lies under `apps/transcriber` or imports it; the
fifteen red tests are the same fifteen names as in my first run (before row 76's fix round), and
`apps/transcriber` is not a project of any suite above.

---
*Re-check appended: 2026-10-09*
