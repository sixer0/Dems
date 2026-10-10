# M4 code review — blueprint row 69 (wave F, decision D174)

| Item | Value |
|---|---|
| Reviewer | senior-code-reviewer (read-only; this file is the only file written) |
| Date | 2026-10-10 |
| Tree | commit `abf742f`; diff base `9d3a1ef` (236 files, +43,517 / -97 in the row's paths) |
| Brief | `delegation_progress/review_brief_wave_f.md`; `driver_rules_d94.md` |
| Status | **needs-review** — 3 MAJOR findings open; the row's criterion is "0 Blocker / Major open" |
| Count | **BLOCKER 0 / MAJOR 3 / MINOR 8 / NOTE 5** |

No discovery was run against any network, no camera credential was used, no camera or microphone
was opened, no suite was run. One ad-hoc script was run (a DOM check in the scratchpad, fixture text
only; output quoted under R69-04). Everything else is from reading code and from read-only searches;
each search is quoted with its result.

---

## 1. How far the reading went

The scope is 43,517 added lines. It was not all read. Stated plainly, because a verdict is worth only
what was read for it:

| Depth | Files |
|---|---|
| Read in full | `core-web/.../devices/camera-connect-dialog.tsx`, `camera-connect.ts`; `core-server/.../capture-discovery/connect/service.ts`, `connect/index.ts`, `connect/limits.ts`, `capture-discovery/index.ts`; `capture/adapters/camera/onvif-session.ts`, `probe-answer.ts`, `ws-discovery.ts`; `capture/adapters/credential.ts`, `local/helper-program.ts`; `credential-store/envelope.ts`; `plugins/logger/logger-options.ts`; `shared/src/api/redaction.ts`; `capture/fence/operation.ts`, `fence/index.ts`; `db/seed/demo-helper.ts`, `demo-core.ts` |
| Read in part (the sections a question needed) | `capture/fence/boot.ts`, `fence/sources.ts`; `capture-notices/notifier.ts`, `index.ts`; `camera/discovery-collector.ts`; `capture-discovery/store.ts`; `capture-config/routes.ts`; `modules/devices/source-facts.ts`; `credential-store/index.ts`, `key-store.ts`; `db/mapping/rows.ts`; `core/audit-details.ts`; `shared/src/api/capture-discovery.ts`; `shared/src/client/core-client.ts`; `plugins/permission-guard/index.ts`, `decision.ts`; `core-web/.../devices/source-badge.tsx`; `core-web/.../session-new/index.tsx`, `devices-step.tsx`; `local/device-list.ts`; `node_modules/onvif/lib/cam.js` (0.8.3: `_request`, `_requestPart2`, `_parseUrl`, `getSystemDateAndTime`); `react-dom` 19.2.3 (`updateInput`, `setDefaultValue`); `react-aria` `useTextField` |
| Searched only | every other file of the scope, through the searches quoted below |
| **Not read** | `modules/capture-inputs/**` (operation 97) beyond one search; `capture-notices/precheck.ts`, `probe.ts`, `session-start.ts`; the local helpers (`camera-helper*.ts`, `mic-helper*.ts`, `mic-pipe.ts`, `pipe-files.ts`, `process-door.ts`, `leftover.ts`); `adapters/fake/**`, `fence/generated-sources.ts`, `fence/registration.ts`, `statements.ts`; `capture-config/plan.ts`, `slices.ts`, `store.ts`; `capture-discovery/search.ts`, `routes.ts`, `limits.ts`, `registered.ts`, `adoption.ts`, `session-expiry.ts`; `credential-store/fragment-cipher.ts`; the web search panel, selector panel and notices; the mobile `capture-selector/**` and `devices/**` beyond searches; `db/seed/demo-packages.ts`, `seed.ts`, `cli.ts`; migrations `0008` / `0009` (not in the paths of the task); the 100-odd test files except the ones cited |

Duplication, complexity and naming were judged only where a file was read in full. No graph query was
used: the questions were answered faster by direct search, and each search is quoted.

---

## 2. Verdict per area

| # | Area (row 69) | Verdict | Basis |
|--:|---|---|---|
| 1 | Adapters (credential wrapper, registry seam, ONVIF session) | PASS | read in full; notes R69-13 |
| 2 | Selector module (`capture-config`) | PASS, limited read | only the assignability refusal (`routes.ts:143-160`) was read |
| 3 | Web | PASS WITH FINDINGS | R69-01, R69-04, R69-07, R69-11 |
| 4 | Mobile | PASS WITH FINDINGS | R69-01, R69-02, R69-07 |
| 5 | Discovery (probe, collector, answer reader) | PASS | read in full / in part; anti-steering holds (question 6) |
| 6 | Search API (93, 94, candidate store) | PASS, limited read | ownership by session in `store.ts:144-166`, `240-262`; routes not read |
| 7 | Connect flow (95, 96, 89) | PASS WITH FINDINGS | R69-05, R69-09, R69-11, R69-12 |
| 8 | No-device alerts | PASS, limited read | `notifier.ts`: ids and codes only; pre-check gate not read |
| 9 | The two local source helpers | **not judged** | only the program path rule and the name match were read |
| 10 | The `LOCAL_DEVICE` kind and the fence | PASS WITH FINDINGS | fence sound at three layers; R69-03 (listing), R69-01 (notice) |
| 11 | Migration set 4 (`0008` + `0009`) | **not judged** | not in the task's paths, not read |
| 12 | Web Devices deltas | PASS WITH FINDINGS | R69-07, R69-11 |
| 13 | Mobile Devices deltas | PASS WITH FINDINGS | R69-02, R69-07 |
| — | Logger and shared redaction | PASS | notes R69-14 |
| — | Seed demo files | PASS WITH FINDINGS | R69-06, R69-08 |

**The row's own search: "no code path sends an authenticated ONVIF or RTSP request without an
operator-entered credential" — PASS.** Commands run in `apps/core-server`, tests excluded:

```
grep -rnE "new cam\.Cam|from 'onvif|createOnvifConnectionTester\(|credentialAtInjection\(" src
  src/capture/adapters/credential.ts:122      (definition; no caller)
  src/capture/adapters/camera/onvif-session.ts:52, :280, :342
  src/modules/capture-discovery/index.ts:242  (the one place the tester is built)
grep -rnE "tester\.test\(|\.testConnection\(" src
  src/modules/capture-discovery/connect/service.ts:283   (inside `contact`, the one call)
grep -rnE "usingCredential\(|openSecret\(" src
  onvif-session.ts:374 (arm), fake/camera.ts:92, connect/service.ts:367 (sealFor), credential-store/index.ts:199
grep -rnE "\.capture\.(open|reveal|seal)\(" src
  src/modules/capture-discovery/connect/index.ts:230   (seal only; `capture.open` has no caller)
```

The client object is built without a credential (`onvif-session.ts:342-353`); the two values are put
on it only by `arm` from the `SealedCredential` of the call (`:372-379`), which `contact` receives
from `permitFor` (`service.ts:249-253`), whose only credential input is `operatorCredential` made at
the route edge (`connect/index.ts:169-175`). No stored camera credential is opened anywhere in the
server (`capture.open` has no caller), so none can be sent. A test holds the two call sites
(`connect/__tests__/service.test.ts:196-201`).

---

## 3. Findings

| ID | Sev. | File:line | What is wrong | Fix proposed (owner area) |
|---|---|---|---|---|
| R69-01 | MAJOR | `core-web/src/features/session-new/index.tsx:230-245`, `:252-286`; `mobile/src/features/session-new/use-session-new.ts:164`, `:226`, `:275`; `core-server/src/capture/fence/index.ts:239-246` | A pre-check on a selector that names the local camera opens this Mac's camera, and no client says so before it happens. Step 1 -> 2 sends `createSession` + `beginPrecheck` in one press; the web console also sends `beginPrecheck` by itself for a session left in `CREATE` (a reload); every Retry opens it again. The badge is on the pre-check ROW, which is drawn when the check already runs. The starter needs no `CAPTURE_CONFIG`, and on a tablet is not at the Mac | One sentence on the step that starts the pre-check, on all three clients, drawn from the selector lines whose device has `adapter: LOCAL_DEVICE`: "Starting the check turns on this Mac's camera." (tablet / phone: "Core Mac's"); the web resume effect does not start a pre-check by itself when the selector names a local device — it shows the same sentence and a button. Session New on web and mobile (rows 137 / 138 owners) |
| R69-02 | MAJOR | `mobile/src/features/devices/registered-devices-model.ts:123-128`; mounts only in `registered-device-rows.tsx:77`, `registered-device-detail.tsx:27` | The "is on" state (ux §8f.3: "every client shows a fixed, non-dismissable state" whenever a local device is open, the short pre-check open included) exists on tablet and phone only on the Devices roster. Session New, Session Live and Home draw the badge and never "Core Mac's camera is on". The web console draws it on the pre-check rows, Monitor and Dashboard (`source-badge.tsx:76-77`, used at `devices-step.tsx:302`, `live-feed-panel.tsx:150`, `devices-panel.tsx:312`) | Give the mobile badge components (`development-source-badge.tsx`: `PrecheckSourceBadge`, `TrackSourceBadge`, `MicInputSourceBadge`) the same "is on" line from `sourceOpen`, as the web `SourceMarks` does. Mobile capture-selector owner. Check `M5-SEC-PRIV-2-T/P` is M5's: the reviewer of row 74 should see this finding |
| R69-03 | MAJOR | `core-server/src/capture/fence/sources.ts:137-150`; `core-server/src/db/mapping/rows.ts:863-881` | "In `REAL_PRODUCTION` operations 76 / 77 list 0 development devices" (C3 §2.6; ux §8f.3; R-11 AC-2) is not built. The rule is the member `listed` of `deviceSourceFieldsOf`, and that function has **no caller** in the product; the row-to-slice mapping surfaces every stored non-built-in row with its adapter and class whatever the operation. A database that once booted `REAL_DEVELOPMENT` holds `CAM-03` / `MIC-03` (`LOCAL_DEVICE`); the production boot refuses only ASSIGNED development sources (`boot.ts:129-132`), so with those rows unassigned a production Core lists them and the clients draw "This Mac's camera". The only test of the rule tests the pure function (`fence.test.ts:549-554`); the production database test has no local row (`source-class.db.test.ts:129-136`). Found by reading; not run | Apply `listed` where the `captureDevices` slice is handed to clients (the fact door of `modules/devices/source-facts.ts`, or the slice builder), and add one db test: registered-but-unassigned `LOCAL_DEVICE` rows, production boot, op 77 answers none of them. Row 136 / pass D11 owner. The fence itself is not affected: such a device cannot be assigned (`routes.ts:143-160`) or opened (`fence/index.ts:254-257`) |
| R69-04 | MINOR | `core-web/src/features/devices/camera-connect-dialog.tsx:554-573`, `:160-161`, `:380-462` | The comment says the `value` attribute is removed "in the same task, before anything else can read the document". False for other observers — see question 1 and the script output there. The removal itself hands the text to every observer that asked for old values. The typed text is also held in React state beyond what the form needs (`useWatch` of both fields, `Controller` `field.value`, the `TextField` `value` prop) | Question 1. Web Devices owner (row 137) |
| R69-05 | MINOR | `connect/service.ts:340-374` | `holdsClearSecret` misses a secret under 8 bytes kept in clear beside non-zero bytes (stated in its own comment), and misses any length kept in another encoding. The form check beside it (`>= 33` bytes) is weaker than, and a second copy of, the store's own `isSealedSecret` (`envelope.ts:117-129`: 80 bytes or more, a frame multiple) | Question 2. Connect flow owner (row 142) |
| R69-06 | MINOR | `db/seed/demo-helper.ts:36-51`; `demo-core.ts:60-78` | The seed commands start the helper program after "absolute, regular file, executable"; the server's boot applies owner and write-permission rules to the file and every directory (`helper-program.ts:32-44`). Two rules for one program, and five problem codes that near-copy the door's | Question 5. Pass E3 owner |
| R69-07 | MINOR | `shared/src/i18n/en/common.ts:967-975`; drawn only in `core-web/.../registered-device-drawer.tsx:52`, `:93-94` and `mobile/.../registered-device-detail.tsx` | The local-microphone limit ("Not fit for recording yet …") is shown only behind "View device", not where the microphone is chosen (selector) or checked (pre-check row). The alert body says the Core inserts or drops samples "to hold it in step" under a title that says the correction is at its limit | Question 10. Web / mobile Devices owners |
| R69-08 | MINOR | `core-server/src/sealing-host/demo-seed/index.ts:240`; `capture/adapters/types.ts:110` | The v2 demo seeder hands manifest field 43 the v1 text `'H.264 + AAC-LC'`; erratum PE-D9-03 defines the field as `H264` \| `HEVC`, and the shared schema takes any text (`evidence-package/manifest.ts:184`). `'H265'` in the adapter profile type has no producer and no reader | Question 11. Row 88 (M7) / pass E3 owner for the seeder; adapters owner for the literal |
| R69-09 | MINOR | `credential-store/index.ts:233-241`; `connect/service.ts:501-506`, `:471-473` | `service.ts` says the key of a replaced envelope "is destroyed by the unit that reads the stored references". No such unit exists: `grep -rn "retainOnly(" src` (tests excluded) answers the definition only. Every credential write makes a key file (`index.ts:181-193`); a replaced credential, an adoption whose transaction rolls back after `sealFor`, and an envelope refused by `sealFor` each leave one for good | Call `credentialKeys.retainOnly` from the owner-side read that the comment names, or state in the comment that rotation clean-up is not built and record it as a gap. Row 84 owner |
| R69-10 | MINOR | `core-web/src/features/devices/__tests__/camera-connect-canary.test.tsx:14`, `:159` | The canary's line "no value in any attribute while it is typed" reads the attribute after the remover ran: it cannot fail for the transient write it is about. The same test would pass with the observer deleted only if React stopped mirroring — it proves the end state, not the property in its title | With uncontrolled inputs (question 1) the assertion becomes true at every instant; until then, an observer created before the dialog mounts, asserting it never sees the text (the script under R69-04 is that test) |
| R69-11 | MINOR | `core-web/.../source-badge.tsx:85`, `registered-devices-model.ts:18`; `mobile/.../registered-devices-model.ts:15`; `connect/index.ts:28`, `:32`, `:96`; `camera-connect.ts:82` | Comments that no longer hold and will mislead: "`sourceOpen` … the shared slice does not carry yet" (it does: `state-slices.ts:957`); "the adapter barrel does not export it yet: request filed" and "the contract has no such action yet" (both are wired, `capture-discovery/index.ts:242-243`); "the contract's schema allows 255" (the shared constant is 120, `devices.ts:169`, the ux spec says 255, `08:808`, the contract table says 255, `03:411`) — three numbers for one bound, and the route's own 120 check (`connect/index.ts:171`) is then unreachable | Correct the comments; settle the bound in one place (120 is what the table takes) and correct `03` §2.6 and `08` §8d.3. Owners of each file; spec text to the controller |
| R69-12 | NOTE | `camera-connect-dialog.tsx:334-353`, `:477`; `connect/service.ts:412-420` | The operator confirms the HOST. The port and the scheme of the service address are the responder's choice (accepted, SEC35-32), are not shown anywhere, and the port is stored in `capture_devices.address`. The contract's candidate has no member for them | If the confirmation is to mean "this address", show the port when it is not the default — needs one member in `CaptureCandidate`. A ruling, not a defect |
| R69-13 | NOTE | `onvif-session.ts:464-474`; `connect/limits.ts:178-181` | A camera that offers only Basic, or a Digest hash outside the list, ends as `AUTHENTICATION_FAILED` although nothing was sent; the operator reads "The camera refused this user name or password", and the guard counts one failure (`Math.max(1, …)`). Conservative for the guard, wrong as a statement. The five outcomes are the contract's | Not determinable from the code which outcome the spec wants for this case (`05:864` keeps it as a regression mode only). To the controller |
| R69-14 | NOTE | `logger-options.ts:253-281`; `redaction.ts:115-120` | Limits of layer 5, none of them met by today's calls: message text and the values for `%s` / `%o` are not blanked; child-logger bindings are not (the header says so). The name rule also blanks harmless members: any name holding `credential` (but the three flags), `secret`, or ending in `token` — a future `rejectedCredentialRequests` or `profileToken` would read `***` | Keep; when a count with such a name is logged, name it otherwise |
| R69-15 | NOTE | `local/camera-helper-args.ts:28`; `mic-helper-args.ts:30`; `fence/index.ts:372` | "This Mac's camera" is the literal device name `MacBook Air Camera` / `MacBook Air Microphone`, matched by exact equality (`device-list.ts:69-71` — sound against SEC35-43 (b)). On any other Mac the local device is `NAME_ABSENT`. No configuration key | Record as a limit of the phase, or read the name from configuration |
| R69-16 | NOTE | `shared/src/api/devices.ts:587`; C3 §2.6 access notes | Outside this milestone, stated by the contract itself: operation 91 (the STT API key) carries no `WEB_CONSOLE_SESSION`; its web-only rule is a UI rule | None here |

---

## 4. The carried questions

### 1. D134 / D-137-6 — the `value` attribute of the connect dialog

**What happens.** A controlled input makes React write `node.defaultValue = value` at every update
(`react-dom-client.development.js:1671-1675`, `setDefaultValue` at `:1737-1741`), and `defaultValue`
is the `value` attribute. So every keystroke writes the whole typed text into the attribute, for the
password field too, and `NoValueAttribute` takes it off in a mutation-observer callback.

**Reachable by what.** Shown with a script (jsdom of the repository, fixture text; three observers:
A on `body` created before the remover, B the remover, C on `body` created after it):

```
node <scratchpad>/mo-check.cjs
{"attributeNow":null,
 "ancestorLive":["FIXTURE-not-a-secret",null],
 "ancestorOld":[null,"FIXTURE-not-a-secret"],
 "lateOld":[null,"FIXTURE-not-a-secret"]}
```

1. An observer created **earlier** on any ancestor is called first and reads the live attribute
   (`ancestorLive[0]`). Observers are notified in creation order; a library loaded at page start is
   always earlier than a dialog.
2. An observer that asked for **old values** receives the text in the record of the REMOVAL, whenever
   it was created (`lateOld[1]`). The remover does not hide the text from observers: it publishes it
   once more.
3. Code that runs in the same task after React's write and before the microtask checkpoint (another
   layout effect, a ref callback) reads it directly.
4. A snapshot taken in a later task (a copied element, `outerHTML`, the Elements panel) does not see
   it. That is the one reader the observer protects against.

Who that is today: no session-replay or analytics package is installed
(`grep -n "rrweb\|sentry\|logrocket\|posthog\|hotjar" apps/core-web/package.json` — no match), and
nothing pins their absence. Browser extensions observe the page, but an extension can read
`input.value` itself. So the exposure today is small; the comment's claim is the defect, and the
protection would not hold on the day such a library is added.

**Is "uncontrolled inputs" the right fix?** Yes, with one condition that the recommendation in D134
does not state: **it cannot be done through the kit `TextField`.** `useTextField` always controls
the input (`react-aria/dist/private/textfield/useTextField.mjs:34`, `:38`, `:69`:
`useControlledState(props.value, props.defaultValue || '', …)` and `value: value` in the input's
props), so a `TextField` without a `value` prop still has React write the attribute. The two inputs
must be rendered outside `TextField` — the kit's plain input (`InputGroup.Input`) with `Label`,
`Description` and `FieldError` joined by `aria-labelledby` / `aria-describedby` / `aria-invalid` by
hand — with no `value` and no `defaultValue`. Then:

- the text is read from the element at the press (`passwordRef.current.value`), cleared with
  `ref.value = ''` (after `AUTHENTICATION_FAILED`, after the adoption, at unmount);
- "both fields have text" is two booleans kept from `onInput`, not the text;
- read-only after `REACHABLE` stays the `readOnly` attribute;
- `NoValueAttribute` goes, or stays as a tripwire that reports (a code, never the text) if the
  attribute ever appears.

**What else holds the text longer than the request.**

| Holder | How long | Judgement |
|---|---|---|
| `react-hook-form` values (`:142`) | the life of the dialog body; after `REACHABLE` until Add or Close | by design (ux §8d.3 "kept for two requests"); goes with the fix above |
| `useWatch` of `username` and `password` (`:160-161`) — component state | every render | **more than needed**: only `filled` (`:170`) reads them, and it needs two booleans. Visible in React DevTools as hook state |
| `Controller` `field.value` and the `TextField` `value` prop (`:385`, `:413`) | every render, and one render longer in the fiber's alternate | visible in React DevTools as props; goes with the fix |
| the closure of `send` (`:256-258`, `:271-272`) and the JSON body in `core-client.ts:596-599` | until the answer | the request itself |
| after `UNREACHABLE` / `WRONG_PROFILE` / `NOT_H264` | kept in the fields | by the spec (ux §8d.4 "unchanged") |
| error objects | — | none: `ConnectFailure` holds status, codes and the Core's envelope (`camera-connect.ts:113-127`, `:148-150`); the catch reports the class of the error (`:235-238`); the server's `422` is a fixed text with no issue list (`error-envelope/index.ts:99`) |
| query or mutation cache | — | none: `grep -n "useQuery\|useMutation\|queryClient" camera-connect*.ts*` — no match; the call is `live.client.call` directly |
| simulator (Simulated mode) | — | reads one fact, whether `credential` was sent (`shared/src/sim/api.ts:1381-1382`, `:1413-1414`) |
| form reset on close | — | sound: the body is rendered only while `candidate !== null` and is keyed per opening (`:101-104`), so Close unmounts it at once; Close is disabled while a request is out (`:93-96`, `:284-286`) |

### 2. D134 — `holdsClearSecret` and secrets under 8 bytes

**What it is.** A tripwire against a sealer that stores instead of sealing (`service.ts:354-363`).
For 8 bytes or more it searches the bytes; for fewer it searches the secret followed by zero bytes
up to 8.

**Risk.** Low, and narrower than "under 8 bytes": the real sealer is AES-256-GCM over a padded frame
with a fresh key and nonce per write (`envelope.ts:99-114`, `credential-store/index.ts:181-193`),
so the check only ever fires on a wrong sealer handed to the seam (`provideSealer`, a test double
wired by mistake). What it then misses: a short secret beside non-zero bytes; and, at ANY length, a
secret kept in another encoding (hex, base64, a JSON string). Short passwords are exactly what
cameras ship with, so the uncovered set is the common one. A byte search cannot close this, whatever
the threshold.

**Fix (smallest first).**
1. Replace the local form check by the store's: `isSealedSecret` (already exported,
   `credential-store/index.ts:53`) — 80 bytes or more and a frame multiple, instead of `>= 33`
   written a second time at `service.ts:369-370`. A sealer that returns `secret || padding` of
   another length is then refused by form.
2. Make the answer unforgeable instead of inspected: the store returns a branded object (the
   `OPERATOR_ENTERED` symbol pattern this same file uses at `:170-181`), and `sealFor` accepts only
   that brand. A stand-in sealer then has to be the store's own test double, and "is it really
   sealed" is proven where it can be — in the store's tests, by opening.
3. Keep `holdsClearSecret` as it is, as a second line. Do not lower the 8: the 27 % false refusals
   of D134 come back.

### 3. D135 — message text and the server logger

**No code path of the server formats a secret, or anything dynamic, into a message.** Search over
`apps/core-server/src`, tests excluded:

```
grep -rnE "\.(log|logger)\.(info|warn|error|debug|trace|fatal)\(" src | grep -E '`[^`]*\$\{|\+ *[a-zA-Z]'
  8 lines; in each the template literal is the member `source: \`${SOURCE}.x\`` of the line's OBJECT;
  the message is a constant
grep -rnE "\.log\.(info|warn|error|debug)\([^)]*%[sdoOj]" src            -> no match
grep -rnE "console\.(log|error|warn|info|debug)|process\.std(out|err)\.write" <the row's server paths>  -> no match
```

100 log calls in all; every message is a string constant or a named constant. The connect flow logs
through `host.note`, typed `Record<string, string | number | boolean | null>` (`service.ts:151`).
The credential travels as `SealedCredential`, which prints `[credential]` as text, as JSON and under
inspection (`credential.ts:37-52`); `writtenForm` applies `toJSON` before the name rule
(`logger-options.ts:199-209`). The side effect D135 names (a sealed credential under the key
`credential` reads `***`) is the stricter of two safe answers. Limits: R69-14. Not read: whether
`app.errorLog.append` passes its `context` through the same rule.

### 4. D134 — other audit details or alert params that take free text

**None found in this milestone.** Every audit type of the delta has an exact key list whose rules are
ids, codes, counts, flags, a host literal and the `urn:uuid:` form
(`core/audit-details.ts:318-365`): `CAPTURE_DISCOVERY_SEARCHED`, `CAPTURE_CONNECTION_TESTED`,
`CAPTURE_CANDIDATE_ADOPTED`, `CAPTURE_DEVICE_UNREACHABLE`, `CAPTURE_CREDENTIAL_SET`. The builders
pass nothing else (`shared/src/api/capture-discovery.ts:326-453`). The audit `message` texts are
built from Core values only: an outcome code (`service.ts:304`), a Core-minted device id (`:477`), a
count (`search.ts:164`). The alerts of R-10 carry a code, a registry id, a phase, a cause from a
closed list, a session id, a search id and a count (`capture-notices/notifier.ts:150-185`). The
local helper's error reaches a client as one of five codes.

Where device text DOES go, so that nobody is surprised: the announced `name`, `model`, `vendor` and
`endpointRef` are in the answer of operation 94 (cleaned and cut to 120 characters,
`probe-answer.ts:114-126`, drawn inside `<bdi>` as text); the announced `model` is stored in
`capture_devices.model` at adoption (`service.ts:465`) and is replicated in the `captureDevices`
slice. Not followed further: where a sealed manifest or an export prints a device's `model`.

### 5. D171 / pass E3 — the seed's helper check

**Is the seed a way to run an attacker-writable binary? In the tree as it stands, no; by its rule,
yes.** The seed runs the program of `DEMS_CAPTURE_HELPER_FFMPEG` after three checks: absolute,
regular file, executable (`demo-helper.ts:36-51`). The boot refuses the same path when the file or
any directory on the way (as written and as resolved) is not owned by root or the server's user, or
is writable by group or others (`helper-program.ts:32-44`). So a path the server refuses to start,
the seed starts — with the developer's rights and, from a Terminal, with that Terminal's camera and
microphone permission (SEC35-43 (a)); the argument table names no device, but a replaced program
does not read it.

What limits it: it runs only for a development-capture environment (`demo-core.ts:56-59`); the
child gets an empty environment, no shell and a time limit (`demo-helper.ts:72`, `:82-85`); and the
copy the set-up script makes is private:

```
ls -ld .data/helpers .data/helpers/*
drwx------  gsp-budi staff  .data/helpers
-rwxr-xr-x  gsp-budi admin  .data/helpers/ffmpeg
```

An attacker needs to write there or to set the variable — the preconditions SEC35-43 (a) was written
for.

**Fix.** One rule: `seedHelperProblemOf` asks `helperProgramRefusal(inspectProgram(path))` of
`capture/adapters/local` (both exported, `local/index.ts:27`) and keeps only "not set" and "not
executable" of its own, as `helperProgramProblemOf` does at `fence/boot.ts:113-119` — better, calls
that function. The static rule that lets `src/db/` start a process stays as it is.

### 6. The anti-steering rule

**A device's own answer cannot move the connection test or the stored endpoint to another host, and
cannot change the scheme or the port after the search. What it chooses is the port, the scheme and
the path it announced in the probe answer, on its own address.**

| Step | What decides the target | Evidence |
|---|---|---|
| Candidate host | the kernel's source address of the datagram, never a field of the message | `ws-discovery.ts:250-258`; `discovery-collector.ts:100-106`, `:298` |
| Sources never accepted on a network search | not IPv4; `0/8`, `127/8`, `224/4` and above, all-ones; this host's own addresses; off-link; the segment and broadcast addresses | `discovery-collector.ts:100-116` |
| Service address | the first announced address whose host is an IPv4 literal EQUAL to the source; scheme `http` / `https`, port 1-65535, path of URL-path characters up to 128, no user part, query or fragment; else `testable: false` | `probe-answer.ts:308-335` |
| Checked again at the test | `testable`, no `conflict`, host equal, no `@`, no query, no fragment, path form, port range | `onvif-session.ts:154-173` |
| Requests of the test | every request goes to the constructor's `hostname` and `port`; an answer contributes only a PATH | `node_modules/onvif/lib/cam.js:288-296` (`reqOptions`), `:306` (`useSecure` fixed); `grep -n "url:" lib/cam.js lib/media.js` — no match, so no read passes another URL; `:1281-1286` rewrites a service address of another host or port to the constructor's |
| Redirects | none followed | §11.1 P-10 of the security review; unchanged |
| Stream address of `GetStreamUri` | compared with the candidate's host, then dropped; never stored, never contacted | `onvif-session.ts:256-268`, `:510-517` |
| Stored endpoint | the candidate's host, plus the port of the announced service address | `connect/service.ts:412-420`, `:457`, `:466` |

**The loopback guard is not test-only.** Three production layers: a network search drops a `127/8`
source (`discovery-collector.ts:105`); the kind `FAKE` is given only by the network kind
`LOOPBACK_FIXTURE` (`:298`), which exists only when `loopbackFixture` is passed, and no source file
passes it (`grep -rn "loopbackFixture\|LOOPBACK_FIXTURE" src`, tests excluded: the definitions in
`ws-discovery.ts` and `discovery-collector.ts` only; static rule 2 of
`capture-discovery/__tests__/static.test.ts:102-106`); and the connect flow refuses a loopback host
whose kind is not `FAKE` (`connect/service.ts:238-243`). The stub's ephemeral ports are test support.

Left over, accepted by SEC35-28 / SEC35-32: a forged datagram with the source address of another
on-link machine makes that machine a candidate, and one operator press sends it the unauthenticated
reads and, if it answers a Digest challenge, the digest. The confirmation step shows the host and not
the port (R69-12).

### 7. Lock-out guard, no automatic retry, the five outcomes

**No path retries with a credential and none tries a second credential.**

- Server: `contact` calls the tester once (`service.ts:283`) and never loops. Inside the test, a read
  that may need the credential sends at most one request that carries it; a refusal of that request
  is final (`onvif-session.ts:438-462`). The token form is tried only when the first request
  **carried nothing** and the device asked by a SOAP fault (`:446-456`) — that is the first
  credential-bearing request, not a second one. The clock read runs on a client that holds no
  credential, so the package's own repeat of it (`cam.js:566-584`) attaches none
  (`onvif-session.ts:479`, `:372-379`). `rejectedCredentialRequests` is 0 or 1 per test — inside the
  contract's "at most 2".
- The digest wrapper refuses to answer a challenge while unarmed, after the token form was chosen,
  and for a hash outside MD5 / SHA-256 (`:361-370`).
- Guard: counted per host, never by account, session or candidate; reset only by `REACHABLE`; the
  failure that fills the window is marked (`limits.ts:171-194`); checked before the turn is taken
  (`service.ts:275-277`). Operation 96 goes through the same `contact`.
- Web: one request per press (`camera-connect-dialog.tsx:220-245`, `inFlight`); the password is
  cleared after `AUTHENTICATION_FAILED` (`:260-264`); Test is disabled at 0 attempts left (`:165`,
  `:171`). The shared client has no retry of a request (`core-client.ts`: the only "retry" is the
  `retry-after` header). Mobile has no credential field and names none of the three operations
  (search over `apps/mobile/src`, tests excluded: no match in `capture-selector` or `devices`).
- The five outcomes are each reachable in `steps` (`:477-521`). One of them is reached for a case its
  sentence does not describe: R69-13.

Not covered by the guard, by design and stated in `limits.ts:27-28`: a restart of the Core clears it.

### 8. `WEB_CONSOLE_SESSION` on 89 / 95 / 96

**Enforced before the body is parsed.** The request stages run in one `onRequest` hook
(`app.ts:399-403`); `accessRule` is one of them (`permission-guard/index.ts:327`); the condition
reads the principal only (`decision.ts:232-250`). Fastify parses the body after `onRequest`; the
JSON parser and the `preValidation` hook are later (`error-envelope/json-body.ts:25-44`). The three
routes take their access from the registry (`shared/src/api/capture-discovery.ts:469`,
`devices.ts:587`). Test: `connect/__tests__/connect.db.test.ts:221-237` — a tablet session, also
with a malformed body, answers `403 WEB_CONSOLE_ONLY` with one `ACCESS_DENIED` row and 0 requests to
a device. A validation refusal carries a fixed text, no issue list.

**No device-session path to a camera credential was found.** The credential enters by these three
routes only; no answer shape carries one; no code opens a stored camera credential (`capture.open`
has no caller); `CaptureDevice` has no `credentialSet`. The pre-check search runs under a device
session's id (`capture-notices/index.ts:211`) and sends unauthenticated probes only. The in-app
simulator refuses the three on a device (`shared/src/sim/api.ts:767-774`); Try-it denies them
(`core-web/src/features/api-reference/try-it.ts:49-52`).

### 9. D163 / D-D9-6 — the local camera at pre-check; the fence

**Visible before it happens: no, on no client** — R69-01. During the open the web console says
"This Mac's camera is on" on the pre-check row; tablet and phone do not — R69-02.

**Impossible in `REAL_PRODUCTION` by the fence, not only by the UI: yes, for assigning, opening and
recording.**

1. Flags: one function decides the operation; a refused combination answers `SIMULATED`
   (`fence/operation.ts:72-81`).
2. Boot: a production boot is refused when the selector assigns a development source; local devices
   are registered only in `REAL_DEVELOPMENT` (`fence/boot.ts:129-132`, `:222-224`).
3. Runtime: the production registry holds no adapter (`fence/index.ts:254-257`), so there is no
   object that could open a camera; `probeAdapters()` is null; an assignment is refused
   (`capture-config/routes.ts:143-160`); the local adapters are built only in the development
   branch (`fence/index.ts:377-390`).

What is NOT held in production is the LISTING of a registered local device — R69-03.

### 10. D161 — the local-microphone limit wording

**Accurate: yes against the record, with two reservations.** D128: 427,520 samples in 10.01 s, 42,666
samples/s against 48,000 — 0.8889, which is 8/9; D136: a mislabelled 44.1 kHz device is rejected by
the numbers and the cause is a hypothesis. "about 8/9 … the cause is not proven" says that.
Reservations: (a) the sentence is a fixed text for every `LOCAL_DEVICE` microphone
(`common.ts:973-975`); it states one host's measurement as a property of "this microphone" and stays
when the cause is fixed. (b) The alert beside it says the Core inserts or drops samples "to hold it
in step" under the title "Rate correction at its limit" (`:967-970`). Whether the audio stays in step
at the limit is the worker's behaviour and was not read: not determinable from the files of this
row. If it does not, the sentence should say that the audio may drift against the picture.

**Shown where an operator would choose that microphone: no** — R69-07. It is in "View device" on the
web and in the device detail on mobile. The selector and the pre-check row show the badge and the
kind text only. Proposed: the first sentence ("Not fit for recording yet.") beside the option in the
selector and on the pre-check row of that microphone.

### 11. D163 — three codec vocabularies

| Vocabulary | Where | Meets another? |
|---|---|---|
| `H264` / `HEVC` | manifest field 43 of a recorded session, read from the init segment (`capture/fragments.ts:453-459`; `sealing-host/session-reader.ts:249-255`, `:274`; `sealing-host/index.ts:195-196`) | yes, below |
| `'H264' \| 'H265' \| 'OTHER'` | the profile type of the adapter seam (`capture/adapters/types.ts:110`) | **no.** Three adapters return `'H264'` (`local/camera-adapter.ts:101`, `fake/camera.ts:116`, `fence/generated-sources.ts:82`); nothing returns `'H265'`; nothing reads the member (`grep -rnE "\.codec\b" src`, tests excluded: `session-reader.ts:255`, `modules/devices/status.ts:140` — neither is a profile). The ONVIF test compares the device's own word `H264` to a boolean (`onvif-session.ts:250`). A dead literal: no defect, a trap for the first reader that compares it with `HEVC` |
| `'H.264 + AAC-LC'` (v1) / `'H.264'` (slices) | the v1 demo generator and the simulator's slice shapes (`shared/src/evidence-package/example.ts:69`, `state-slices.ts:424`) | **yes: `sealing-host/demo-seed/index.ts:240`** hands this text as `codec` of the session facts of a **v2** demo package. PE-D9-03 defines field 43 as `H264` \| `HEVC`; the shared manifest schema types it as text (`manifest.ts:184`), so nothing refuses it. A v2 demo item then names its video codec in the v1 vocabulary, with an audio codec in a video track's field |

Defect: the third row — R69-08. Not followed to the end: whether the seeder's facts reach the manifest
unchanged (the product path overrides the member from the init segment; the seeder builds the facts
itself at `:359`). The file is outside this row's paths: for the reviewer of row 88.

---

## 5. Checked and found sound

- The credential is one opaque object from the route edge on, with no enumerable member, and prints a fixed mark (`credential.ts:37-52`; `connect/index.ts:169-175`).
- No locator with a user part is composed anywhere (`credential.ts:78-108`; the only `rtsp://…@` text in `src` is a comment of the export sweep).
- Every refusal of 95 / 96 comes before a request: lock, candidate, `testable`, permit, limits (`service.ts:387-392`, `:424-445`, `:275-277`).
- The audit row of an attempt is written for every outcome, in a unit of its own, with no transaction open during the network attempt (`service.ts:283`, `:322-324`).
- A foreign, expired or unknown candidate id gives one answer; a list is read by its owner session only (`store.ts:144-166`, `:240-250`; `service.ts:231-232`).
- The test's defences against a hostile device: one agent per test without keep-alive, a byte cap, a connect limit, the whole-test deadline, every package callback taken once and never throwing, a closed reason list (`onvif-session.ts:306-339`, `:397-432`).
- The probe answer reader: byte cap before text, declarations refused on bytes, depth counted without recursion, fixed-path reads, device text cleaned (`probe-answer.ts:253-289`, `:98-126`).
- The discovery socket: one, TTL 1, no group joined, closed on every way out (`ws-discovery.ts:176-193`, `:260-288`).
- The envelope: fresh key and nonce per write, context bound as authenticated data, one failure code on open (`envelope.ts:69-158`).
- The key files: created with exclusive create and no-follow, mode 0600 in 0700 directories (`key-store.ts:160-179`).
- A local device is chosen by exact name with a uniqueness check, not by prefix (`device-list.ts:69-71`).
- The helper path rule checks owner and write permission of the file and of both directory chains (`helper-program.ts:32-44`).
- The web dialog: no native form, neutral field names, reveal off by default and back off on blur and on send, Close disabled while a request is out, the body unmounted on close (`camera-connect-dialog.tsx:89-110`, `:223`, `:376`, `:434-450`).
- Mobile holds no credential field and no call of 89 / 95 / 96.

---

## 6. For the controller

1. The row's criterion is not met: three MAJOR findings are open. None is a hole in the credential path or in the fence; two are privacy notices of the development configuration (R69-01, R69-02) and one is a production-listing rule that was specified, tested as a function and never applied (R69-03).
2. R69-03 was found by reading. It should be confirmed by the one db test named in its row before a driver changes the mapping.
3. Rulings wanted: R69-12 (show the port at the confirmation?), R69-13 (which outcome for a camera whose authentication scheme is not answered), and the one bound for the camera user name (R69-11).
4. For other reviewers: R69-02 touches check `M5-SEC-PRIV-2-T/P` (row 74); R69-08 and the open half of question 11 are in `sealing-host` (row 88); R69-09 is the credential store's (row 84 / M7).
5. This review wrote only this file. The plan's status field and the implementation report were not touched, as the brief rules.
