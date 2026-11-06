---
task_slug: dems_real_capture_sealing
date: 2026-10-09
agent: coder-execution (integration pass D1a, security seams of camera discovery / connect)
baseline: e296ce7
status: complete (item 7 is a finding, no code by this pass)
---

# Integration pass D1a

No commit, no migration, no new dependency. ONVIF stub on 127.0.0.1 only; no real credential.

## Items

| # | Result | What and where |
|---|--------|----------------|
| 1 | done | `endpointRef` is never operator-typed (ops 89 / 95 / 96 take `candidateId` + credential only) but IS device text: `capture/adapters/camera/probe-answer.ts:218-220` keeps any announced `EndpointReference/Address` of 1..120 non-space characters, and `connect/service.ts` wrote it into both audit rows; the old rule (`core/audit-details.ts`) was "1..120, no `@`, no `://`" = free text. Now: the rule takes only `urn:uuid:<UUID>` (the form ONVIF defines, cap V-7; the example of C3 §5.2); `connect/service.ts` `auditEndpointRef()` leaves any other announced text OUT of the row (the row is still written, with `host`), so a strange device cannot fail the audit write either. `credential.test.ts:176` green: canary secret, canary user, the user-part URL and `[credential]` are all refused. |
| 2 | done — the TEST was wrong, the server is right | C3 §2.6 access column (ops 89 / 95 / 96): `PERMISSION CAPTURE_CONFIG` + `WEB_CONSOLE_SESSION`; C3 §4: `CAPTURE_CONFIG` = SUPERVISOR, TECHNICIAN. The red cells were the `(session device DEV-0001)` runs: a device session, which the spec refuses for every role. The test's own derivation `expected()` (`matrix.db.test.ts`) did not know the condition; it now reads it from the registry entry. New case pins all 18 cells: web session SUPERVISOR / TECHNICIAN ALLOW, INVESTIGATOR NOT_PERMITTED; device session NOT_PERMITTED for all (`WEB_CONSOLE_ONLY` for the two holders); control: op 93 (same permission, no condition) is allowed from the device session. No production change. |
| 3 | done — a real defect | The throw: `connect/service.ts` `sealFor` refused an envelope when `ciphertext.includes(secret bytes)`. For a ONE-byte secret that is chance: 80 random bytes hold a given byte in about 27 % of writes -> `SealedCameraSecretRefused` -> 500 (this is also row 142's "1 of 8, unexplained", D117). `:576` only counted the row that `:474` did not write. Fix: `holdsClearSecret()` never searches for fewer than 8 bytes; a shorter secret is searched for as it stands in a clear zero-padded frame. The error class carries a fixed text and no byte (unchanged). Unit proof: 10,000 random envelopes, 0 refusals for 1-3 character secrets, while bare containment is hit > 1,000 times (the defect, as control); a clear frame is still found for short and long secrets. |
| 4 | done — the RULE was too wide, adoption is right | `adoption.ts:28` sets `transport, onvif_uuid, profiles, last_seen_at` of the row the engine has just INSERTed (with `adapter_kind`, dbc-4 §N / row 142); `kind` appears only in its `WHERE ... AND kind = 'CAMERA'`. The rule's pattern ran past `WHERE`. It now reads the SET list only; controls: three assigning statements found (also one that filters on `kind` AND assigns `adapter_kind`), two filtering statements not found, and the adoption statement's SET columns pinned to those four. No allowance by file name, no production change. |
| 5 | done | `capture-discovery.db.test.ts`: `guard.restore()` removed; the flow now asserts the guard saw new connections, all to 127.0.0.1, none refused. Green with the guard on. |
| 6 | done (shared); server = finding | `packages/shared/src/api/redaction.ts` (what `@dems/shared/redaction` resolves to): a naming member (`field`, `name`, `key`, `path`, `param`, `parameter`, `property`) whose text is a credential name (`credential.password`, `credential.username`, `apiKey`, ...) blanks the `value` / `ref` beside it, in an object at any depth and in a text (JSON escaped up to 3 times, log line, query string). Controls: an ordinary field, `username` alone, a flag, prose, no naming member -> unchanged. Server: `plugins/logger/logger-options.ts:38-48` is three header paths only; it has NO member-name rule at all, so neither this form nor `{ password: X }` would be blanked there — the server relies on "no body is logged", the sealed credential object and the static log-call test. Not changed (not this pass's file). |
| 7 | finding, no code | See below. |

## Item 7 — D-137-6, the transient `value` attribute (for review row 69)

`camera-connect-dialog.tsx:561-573`: React 19.2.3 writes the typed text into the `value` attribute at each commit; a `MutationObserver` on that one attribute removes it. Observer callbacks run at the microtask checkpoint of the SAME task, so no later task (timer, event, network callback, paint, CSS selector matching at render) sees the attribute. It is reachable only by:
1. code that runs synchronously in the same task after React's commit (another component's layout effect / ref callback reading `outerHTML` or `getAttribute('value')`) — none in production source (`grep` of `apps/core-web/src` + `packages/shared/src`: no `outerHTML` / `innerHTML` / `XMLSerializer` / `cloneNode` / `getAttribute('value')`);
2. ANOTHER MutationObserver on an ancestor: one created earlier reads the attribute before it is removed, and ANY observer with `attributeOldValue: true` gets the typed text in the record of the removal itself. Production source has two other observers (`features/evidence/use-row-motion.ts:93`, the kit's scroll shadow per `session-monitor/scroll-edges.ts`); neither is on this dialog's subtree for `value`. A session-replay or DOM-snapshot library would be exactly such an observer.
Same-origin script can read `input.value` anyway, so the attribute adds exposure only to DOM serialisers and observers. Verdict: not reachable by anything in the app today; it is a property of "no observer / serialiser library is ever added", which nothing pins. Options for row 69 / pass D2: (a) a static test in core-web that forbids `MutationObserver` with `attributeOldValue` / `subtree` and DOM serialisation outside a named list; or (b) make the two inputs uncontrolled (read through the ref) so React never writes the attribute and the observer is not needed.

## Files

- `apps/core-server/src/core/audit-details.ts` (the `endpointRef` rule; unused import removed)
- `apps/core-server/src/modules/capture-discovery/connect/service.ts` (`auditEndpointRef`, `holdsClearSecret`, `CLEAR_SECRET_PROOF_BYTES`)
- `apps/core-server/src/modules/capture-discovery/connect/__tests__/service.test.ts` (+3 cases)
- `apps/core-server/src/capture/adapters/__tests__/credential.test.ts`
- `apps/core-server/src/modules/rbac/__tests__/matrix.db.test.ts`
- `apps/core-server/test/db/set4-rules.test.ts`
- `apps/core-server/src/modules/capture-discovery/__tests__/capture-discovery.db.test.ts`
- `packages/shared/src/api/redaction.ts`, `packages/shared/test/redaction.test.ts` (+3 cases)

## Results (one run each; repeats only where stated)

| Check | Result |
|-------|--------|
| unit: `capture-discovery/**`, `capture/adapters/camera/**`, `credential.test.ts`, `rbac/**`, `set4-rules.test.ts`, `core/__tests__/writers.test.ts`, `test/static/**` (sandbox off for loopback) | 29 files, 434 passed |
| the 3 files re-run after the import removal | 116 passed |
| db under `.locks/db-migrate.lock`: `matrix.db`, `connect.db`, `capture-discovery.db` | 3 files, 61 passed |
| `connect.db.test.ts` before the fix | run 1 red at :474 / :576, run 2 (diagnostic print, restored) green: the 27 % chance, shown deterministically by the unit case |
| shared `test/redaction.test.ts` | 57 passed |
| typecheck + lint `@dems/shared` | exit 0 / 0 errors (1 warning, `sim/types.ts:20`, D1b's file) |
| lint `@dems/core-server` | 0 errors; no warning in a file of this pass |
| typecheck `@dems/core-server` | exit 2: 21 errors in 13 files, NONE of this pass (`capture/supervisor.ts`, `capture/__tests__/{records,forwarder-engine,supervisor}.test.ts`, `test/support/capture.ts`, `modules/{capture-config,capture-inputs,demo,devices,storage,system}/__tests__/support.ts`, `modules/sessions/__tests__/memory-engine.ts`, `recording-fragments.db.test.ts`) — in-flight protocol / engine-host edits of rows 71a / 71b / 82 |

Changed assertion to report: `credential.test.ts` had a second assertion hidden behind the red one — "no capture audit key is NAMED like credential material" — which `credentialSet` (C3 §5.2, a boolean, added by row 132) fails. It now requires that such a key takes ONLY `true` / `false`, and pins the list to `CAPTURE_CANDIDATE_ADOPTED.credentialSet`.

## Decisions for the controller

1. Spec erratum for C3 §5.2 (and dbc-4 §N audit note): `endpointRef?` of the two audit types is `urn:uuid:<UUID>`, not "string 1..120"; a device that announces another form is audited with `host` only. A device announcing `uuid:...` without `urn:` loses the reference in the audit row (it stays in `capture_devices.onvif_uuid`). Accept, or widen the closed form.
2. To D1b (owner of `packages/shared/src/api/**`, `sim/**`): `productionIdentity()` in `api/capture-discovery.ts:362` should drop a non-URN `endpointRef` itself, so the simulator and any future caller cannot build a row the server refuses.
3. To the owner of `src/core/__tests__/writers.test.ts`: add a free-text `endpointRef` to its `invalid` table (today only a URL and an over-long text).
4. Server log: decide whether `plugins/logger` gets a member-name rule (it has none); today a hand-logged `{ password }` or `{ field, value }` object would be written in clear.
5. Row 69: item 7 options (a) / (b); and `holdsClearSecret` does not find a short (< 8 bytes) secret kept in clear with non-zero neighbours.
6. `capture-discovery.db.test.ts:724` still takes the guard off in another test ("the guard's work is done") — not in this pass's list; same removal is probably possible.
7. The claim wording of §9 (`packages/shared/src/redaction/**`) names a folder that does not exist; the file is `src/api/redaction.ts` (claimed in `file_claims.md`).

## Checks for the test runner

| ID | Command | Lock | Expected |
|----|---------|------|----------|
| D1a-1 | `npx vitest run --root apps/core-server --project unit --maxWorkers=4` (sandbox off) | none | `credential.test.ts` and `set4-rules.test.ts` no longer in the red list |
| D1a-2 | `npx vitest run --root apps/core-server --project db --maxWorkers=2` | `/usr/bin/lockf -k -t 3600 .locks/db-migrate.lock` | `matrix.db.test.ts`, `connect.db.test.ts` green; `capture-discovery.db.test.ts` green |
| D1a-3 | `npm run test -w @dems/shared` | none | green (redaction 57) |
| D1a-4 | `npm run test -w @dems/core-web -- --maxWorkers=4` and `npx -w apps/mobile jest --maxWorkers=2` | none | no new red from the redaction rule (both client log sinks call it; their canary tests record D-137-7 as a negative control that may now need to flip — goes to D2) |

## Follow-up (controller ruling D134) — 2026-10-09

**Spec erratum (accepted, D134), C3 §5.2 `endpointRef?` of `CAPTURE_CONNECTION_TESTED` and `CAPTURE_CANDIDATE_ADOPTED`:** the audit `endpointRef` is `urn:uuid:<UUID>` only; a device announcing `uuid:…` without `urn:` loses the reference in the audit row (it stays in `capture_devices.onvif_uuid`).

| # | Result | What |
|---|--------|------|
| F1 | done | `plugins/logger/logger-options.ts`: layer 5, `blankCredentialMembers()`, runs in `formatters.log` after `safeLogObject`: the object of every line (except `req` / `res` / `err`, left to their serializers) goes through `redactCredentialValue` of `@dems/shared/redaction` — no second list. Objects with their own JSON form (a date, a sealed credential's mark) are judged as written. The three header paths (`REDACT_PATHS`, 9 entries) are untouched. NEW `__tests__/member-blanking.test.ts` through `buildLoggerOptions` + pino: `password`, `secret`, `token`, `{ field: 'credential.password' / 'credential.username', value }`, nested, in a list, inside a text, a sealed credential -> 0 canary in the output; negative control: the canary under `outcome` / `value` beside `field: 'label'` / `username` alone IS written (3 times), headers still `[redacted]`. |
| F2 | done | `capture-discovery.db.test.ts:724`: the second `guard.restore()` removed; the real-listener test is green with the guard on. |
| F3 | done | `core/__tests__/writers.test.ts`: two lines in the invalid table (free text; `uuid:` without `urn:`). |

**Changed existing assertion (forced by F1, please confirm):** `plugins/logger/__tests__/log-capture.test.ts` positive control "finds a deliberate leak end to end" expected `token in line 1` and the authorization marker in a careless line. Layer 5 now blanks the member named `token` and every `ses_` / `bio_` token inside a text, so that entry and marker are gone; the test now expects the two leaks the logger cannot know (the second cookie value, the body's free text) and `ses_***`. It is still a positive control.

**Side effect to know:** every text member of a server log line now passes the shared text rule: a `ses_…` / `dvc_…` / `bio_…` token and a `Bearer` value are written blanked wherever they stand; a member named `credential`, `…token`, `…secret`, `apiKey` is written `***` (a sealed credential under the key `credential` reads `***` instead of its mark). The message text (`msg`) is not judged by this layer. Cost: one bounded copy per line.

Results (one run each): unit `src/plugins`, `src/core`, adapters, `capture-discovery`, identity, pairing, admin, capture-config, credential-store, capture-notices, `test/static`: 95 files, 1868 passed, 4 failed — all four are pins broken by other rows' new folders (`test/static/imports.test.ts:328` and `permission-guard/static.test.ts:210`: `src/media-stream`, `src/evidence-export`; `credential-store/static.test.ts:83`: `src/media-stream/store-door.ts`; adapters `static.test.ts:187` A-5, known), none about log content. Logger folder + writers after the last edit: green. db under the lock (`capture-discovery.db`, `connect.db`, `logger/error-keys.db`): 3 files, 43 passed. core-server lint 0 errors; typecheck: no error in a file of this pass (the other rows' errors remain).

Checks for the test runner, added: D1a-5 the whole unit and db projects once more — any test that asserted a clear `ses_` / token / `credential` member in LOG output would now be red and comes back to this pass.

Files of the follow-up: `apps/core-server/src/plugins/logger/logger-options.ts`; `apps/core-server/src/plugins/logger/__tests__/member-blanking.test.ts` (new); `apps/core-server/src/plugins/logger/__tests__/log-capture.test.ts` (one block); `apps/core-server/src/modules/capture-discovery/__tests__/capture-discovery.db.test.ts`; `apps/core-server/src/core/__tests__/writers.test.ts`.

## Follow-up 2 (controller ruling D144; row 71b's request) — 2026-10-09

`core/audit-details.ts`: `fromInput` / `toInput` of `AUDIO_SOURCE_SWITCHED` now take the shared `MIC_INPUT_ID_PATTERN` (`MIC-NN`, imported from `@dems/shared/api`, no second regex); `fromMs`, `toMs`, `sendingDeviceId` unchanged. `core/__tests__/writers.test.ts`: valid `MIC-03` (as from and as to); invalid `MIC-3`, `CAM-01`, free text, lower case, trailing space, empty, a number -> `AUDIT_DETAIL_VALUE_INVALID`. One run: 94 passed; no lint or typecheck finding in the two files. NOT changed (not asked): `inputId` of `CAPTURE_CONFIG_CHANGED` (`audit-details.ts:231`) and of `MIC_SILENT` (`:268`) are still `MIC-01` / `MIC-02` only — the same widening is probably needed there for a third microphone.

## Follow-up 3 (controller ruling D145) — 2026-10-09

`core/audit-details.ts`: `inputId` of `CAPTURE_CONFIG_CHANGED` (optional) and of `MIC_SILENT` (required) now take the shared `MIC_INPUT_ID_PATTERN`, as `fromInput` / `toInput` of `AUDIO_SOURCE_SWITCHED` do. Those were the only two remaining `MIC-01 | MIC-02` literals in a detail rule: the file now holds none (grep count 0; the one other mention is the wording of the hardware device id form, `:80`, which is a pattern already). `writers.test.ts`: for both types `MIC-03` is written; `MIC-3`, `CAM-01`, free text, lower case, trailing space, empty and a number are refused (`AUDIT_DETAIL_VALUE_INVALID`). One run: 94 passed; no lint or typecheck finding in the two files.
