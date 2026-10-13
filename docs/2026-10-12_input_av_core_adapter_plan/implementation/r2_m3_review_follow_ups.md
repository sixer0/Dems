---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: r2_m3_review_follow_ups
date: 2026-10-13
agent: coder-execution (agent R2, track D)
source: verification/060_m3_review.md (F3-02, F3-03, F3-04, F3-06, F3-11); decisions C65, C70, C93
status: complete (on doubles; two user-visible sentences wait for writers this row does not own - section 6)
---

# Row R2 - follow-ups of the phase-3 code review

## 1. What was asked and what was done

| # | Finding | Result |
|---|---------|--------|
| 1 | F3-02: capture static rule SR-2 (2) green by the form of the code | DONE: named entry SR-14 with its control. Code left as it is (not a one-line change) - request line |
| 2 | F3-03: the G-R10 / G-R11 facade pin of the time reader | DONE: named entry SR-5, entry 2, with its control. Code left (the overload's deletion touches a test file of about 12 calls) - request line |
| 3 | F3-04: RC-6's erratum where the rule is defined | DONE in the two documents the brief gives this row; the three documents that define and restate RC-6 are not a driver's - request line |
| 4a | F3-06: `409 CANDIDATE_NOT_TESTABLE` for a missing network configuration | DONE at the Core for operations 95 / 96 with an EXISTING contract reason. The web's sentence and operation 108 are open - two request lines |
| 4b | F3-11, ruling C93: the same device on both video slots | DONE: refused at assignment with an EXISTING word; the plan builder's start rule refuses it too. No sentence in the shared tree yet - request line |

Edit tool only on every existing file; each edit small and additive, made after reading the place. New files: this record and `delegation_progress/row_r2.md`. No scripted replace, no whole-file rewrite. Not touched: `packages/shared`, `apps/core-web`, `onvif-relay.ts`, `camera-watch.ts`, `stored-address.ts`, `onvif-session.ts`, boot and fence, `mic-helper-args.ts`, `relay-check.sh`, every C file.

## 2. Item 1 - named entry SR-14 (F3-02)

File: `apps/core-server/src/capture/__tests__/static.test.ts`, inside the existing case `SR-2: the third destination ...`, at its part (2).

Number: SR-12 is the last amendment ruled (C90); "SR-13" is named in the decisions as an amendment a driver did NOT take (a second WS-Discovery call). SR-14 is used so that no number has two meanings. DRIVER DECISION, for the controller to confirm or renumber.

The entry, verbatim (the comment in the file):

```
NAMED ENTRY SR-14 (decision C93; review `verification/060_m3_review.md` finding F3-02; request line `row 143b` (1)).
  FILE     `src/capture/adapters/camera/stored-address.ts` - the ONE hand-on site of the rule's source address.
  SYMBOLS  `admitted` (the judgement `{ allowed: true, sourceAddress }`) and `storedCameraSourceOf` (the dial's `{ sourceAddress }`).
  ADMITTED the member `sourceAddress`, written by its own name alone (a shorthand member), in the three pinned lines of those two
           places and in no other line: the value is the address the rule answered, read from the rule's decision, held to the
           strict form (`isSourceAddress`) and handed on UNCHANGED. `viaAlias` is not admitted there, nor a member with a value.
  WHY      until this entry the rule was green by the FORM of that file, not by what it does (C60 (1)): the pattern (a) took a
           plainly typed member for a made answer - `sourceAddress: string` matched, because the blank after the colon was given
           back and the look-ahead then stood before it - and (b) did not see a member written by its name alone, so an answer
           composed as `{ sourceAddress, viaAlias }` in any file passed. Both are closed here: the look-ahead stands directly
           behind the colon, and the pattern has a second form for the shorthand member (in an object, between two commas of a list,
           or in a pattern that takes an object apart - it cannot tell them apart and refuses all three outside the pinned lines).
  NOT CHANGED: the rule itself. An answer of the rule is made in the rule's file and nowhere else; every other production file fails.
```

The pattern, before and after:

```
before  /\b(?:sourceAddress|viaAlias)\s*:\s*(?!string\b|boolean\b)/g
after   /\b(?:sourceAddress|viaAlias)\s*:(?!\s*(?:string|boolean)\b)|(?<=[{,]\s*)(?:sourceAddress|viaAlias)(?=\s*[,}])/g
```

The first alternative is the exact fix of request line `row 143b` (1); the second is the shorthand form the review asks for. What the entry pins:

- the three hand-on lines of `stored-address.ts`, in file order and once each: `return Object.freeze({ allowed: true, sourceAddress });`, `const { sourceAddress } = judgement;`, `return isSourceAddress(sourceAddress) ? { sourceAddress } : { refusal: StoredCameraRefusal.SOURCE_ABSENT };` (the review counts "two places": the function `admitted` and the function `storedCameraSourceOf`; the second holds two of the three lines);
- the ONE origin of the value: `admitted(` is called once, with `isSourceAddress(source) ? source : null`; `sourceAddress = source;` is the one assignment; `source` is read from the rule's decision; the file never names `viaAlias`;
- every other production file: 0 lines (`madeOutsideTheRule(production)` is empty; the places of the pattern are exactly the rule's file and the hand-on file).

Control (the entry admits nothing else). Planted and SEEN: an answer composed by shorthand members in the routes file (the former blind spot, two matches); in the hand-on file a member with a value, and a fourth and fifth shorthand line; the entry's own first line in another file; a shorthand between two commas of a call. Planted and NOT seen: a typed member (`sourceAddress: string`, `viaAlias : boolean`), an optional parameter, a read of the member. The replaced pattern is kept as a text and run on the same planted files: it reports the typed member and misses the composed answer - the defect and the blind spot, each shown once.

The code: NOT changed. The plain form means removing the mapped type `SourceNamed<Value>` (`stored-address.ts:98`) - its two uses (:90, :132) and its comment (:92-97) - three places, not one line. Left, with a request line. With SR-14 the plain typed member would pass.

## 3. Item 2 - named entry SR-5, entry 2 (F3-03)

File: the same, block `G-R10 / G-R11`, a new case directly after `the client never leaves the file`. The earlier pin (the two-parameter line by `toMatch`) is not edited.

The entry, verbatim:

```
NAMED ENTRY SR-5, entry 2 (decision C93; review `verification/060_m3_review.md` finding F3-03; request line `row 143b` (2);
SR-5 is the amendment of C48 that admitted the time-read facade).
  FILE     `src/capture/adapters/camera/onvif-session.ts`.
  SYMBOL   `OnvifTimeReader.read`, the facade's one member.
  ADMITTED a THIRD parameter of that member, `fromAddress: string` - the source address the one request is made FROM (S13-11
           point 2; decision C65), a dotted address literal held to its form before any request. The bound signature is the
           form a STORED camera is read by and MUST stand; the two-parameter signature may stand beside it or be deleted.
  WHY      until this entry the pin above held the two-parameter line only, so the source address could reach the facade
           in no other way than as a SECOND signature: the pin was green by that form, and it forced an overload no
           production caller uses (C60 (1)). The entry names the bound signature instead of leaving it beside the pin.
  NOT CHANGED: the facade carries no credential (the exchange is built with the literal `null`, pinned above), no third
           signature, no fourth parameter, no other type of the third. Every production caller hands the address on.
```

What it pins: every member line of `export interface OnvifTimeReader` is one of exactly two texts; the bound one stands exactly once; the two-parameter one at most once. The production callers of `reader.read(` are three (the camera watch, the two fence binders) and each passes three arguments. The implementation is one function whose third parameter is `sourceAddress?: string`.

Control: both forms the entry admits pass (today's two signatures; the bound one alone). Refused: the two-parameter signature alone; a credential as a fourth parameter; a third parameter of another type; an optional third parameter as a signature; the bound signature twice; a second member (`setClock`); a `client` member; a text without the interface.

The code: NOT changed. Deleting the overload needs the interface, the implementation's parameter and about 12 calls of `onvif-session.test.ts` (:977-1123) - not this row's file, not one line. Request line. NOTE for the controller: the review's own "smallest fix" is the deletion; the entry is written so that the deletion needs no further pin edit.

## 4. Item 3 - RC-6's erratum (F3-04)

Where RC-6 is stated, as found:

| Place | What it says |
|-------|--------------|
| `verification/02_security.md:160` | THE DEFINITION: no listening socket, no datagram socket, TCP only, dials only the host of its locator and the loopback ingest port, no file after start |
| `verification/04_security_addendum.md:293, 303`; `masterplan/04_design_addendum.md:636` | restatements |
| `apps/capture-worker/relay-check.sh:42` at commit `3b388746` | the derived source rule `none RC-6 '[^a-z_]bin[d](' "the relay binds nothing"` - the only place the sentence "binds nothing" ever stood |
| `verification/06_security_relay_client.md:128, 172` | uses RC-6 (confinement; the import net), relies on the script |
| `apps/capture-worker/README.md:150` | "the relay ... dials the camera and the ingest and never listens" (still true) |
| `apps/capture-worker/check.sh` | does not quote RC-6 |

Written (appended, dated, original sentences quoted with their locations, the rule as it stands, decision C65):

- `verification/06_security_relay_client.md`: new section 12, "Erratum of 2026-10-13: rule RC-6, the relay's one bind", and one footer line. Nothing above it changed.
- `apps/capture-worker/README.md`: one bullet after the "Confinement" bullet, pointing to that section.

Not written: the three documents that define and restate the rule. Driver rules forbid a driver the verification and masterplan documents; the brief lifts that for the two documents above only. A request line asks their writer for a one-line pointer. DRIVER DECISION: the erratum is in one place and pointed to, not copied into five.

The script's logic: not touched. No C file touched.

## 5. Item 4 - product

### 5a. F3-06: the true cause of the refused candidate test

Closed list read: `CaptureDiscoveryReason` (`packages/shared/src/api/capture-discovery.ts:160-183`) has no member for a missing network configuration. `CaptureCommissioningReason.COMMISSIONING_NOT_CONFIGURED` (`capture-commissioning.ts:259`, "No camera interface or no camera subnet is chosen (operation 102)") is that state's reason, already answered with `409 INVALID_STATE` by the commissioning operations, with the contract's sentence "Choose the camera interface and the camera subnet first." USED. No member was added and none is requested.

`apps/core-server/src/modules/capture-discovery/connect/service.ts`, function `testerOf` (operations 95 and 96, REAL_PRODUCTION only):

| Rule's answer | Before | Now |
|---------------|--------|-----|
| `NOT_CONFIGURED` | `409 INVALID_STATE`, `CANDIDATE_NOT_TESTABLE`, "This device cannot be tested." | `409 INVALID_STATE`, `COMMISSIONING_NOT_CONFIGURED`, "This device cannot be tested yet: the camera network of this Core is not set up. Choose the camera interface and the camera subnet first." |
| any other refusal, or admitted without a source | `409 CANDIDATE_NOT_TESTABLE` | unchanged |
| no rule handed in, tester cannot be bound | `503 DISCOVERY_NOT_READY` | unchanged |

Status, code, order (before the bounds; nothing sent, nothing spent, no audit row) and the log line (`CAPTURE_CANDIDATE_TEST_ADDRESS_REFUSED`, the rule's word, no address) are unchanged. C70 accepted the 409: kept.

Test: `connect/__tests__/service.test.ts`, the existing case "REAL_PRODUCTION, NO network configuration" - THREE expectations pinned the old reason and moved by that delta (listed in section 7); the case now also holds the whole `details` object and the sentence, and that the sentence quotes no address.

Open, not this row's: (1) the web console maps a 409 by `CaptureDiscoveryReason` only, so the new reason is drawn as `devices.search.requestFailed` - no longer misleading, not yet fitting. The shared i18n tree has no sentence for it, so by the brief nothing was changed in the web. (2) Operation 108 (`adopted-test.ts`) answers the same misleading 409; the brief gives this row `connect/service.ts` only. Both are request lines. F3-06 is therefore closed at the Core for a candidate and NOT yet for the operator's eye.

### 5b. F3-11, ruling C93: one camera fills one video slot

Closed list read: the module's words (`CaptureAssignmentRefusal`, `CaptureProfileRefusal` in `routes.ts`) and the simulator's (`packages/shared/src/sim/capture-config.ts:83-92`). The simulator already has `CAPTURE_CONFIG_CAMERA_ON_BOTH_TRACKS = 'CAMERA_ON_BOTH_TRACKS'`, answered today for one camera on both tracks with ONE profile. It is the fitting member ("this device is in the other slot"). USED; no word added. The shared group `common.captureSlotRefusal` has no sentence under that key: requested (one member and its pin); until then the web draws the general sentence followed by the code.

`apps/core-server/src/modules/capture-config/routes.ts`: new `assertOneSlotPerCamera`, called in the unit after the registry's own refusals and BEFORE the profile rule and the action. For operations 78 and 79, when a device registry is provided: a camera line that would leave its device on both video slots is `422 INVALID_INPUT`, `details: { in: 'body', reason: 'CAMERA_ON_BOTH_TRACKS', deviceId, trackId }`, message "One camera fills one video slot: this camera is already assigned to the other video slot." Judged on the selector as the edit would leave it (`unassign`, then the lines), so a swap in one body and a move after a clear pass.

DRIVER DECISIONS, for the controller to confirm:

1. REAL CAPTURE ONLY. The refusal stands where a device registry is provided (REAL_DEVELOPMENT and REAL_PRODUCTION: a worker exists). In Simulated mode the simulator's own rule (two profiles admit it, OD-05) stands: it lives in `packages/shared`, which has no writer in this wave, and no worker can refuse anything there. This is the review's wording ("refuse the selector state on a real Core") and it keeps the two existing tests that pin the simulator's admitted case unedited.
2. A selector that ALREADY holds the state (stored before this rule) is not locked: an edit elsewhere passes; a line that names the camera again is refused; the edit that ends the state passes. The start rule below holds such a selector.

`apps/core-server/src/modules/capture-config/plan.ts`, `assertRecordableSelector` (the start rule, second line of defence): after the shape check and BEFORE the registry is asked, the same device on both tracks is `CAPTURE_PLAN_INVALID` with the EXISTING reason `PROTOCOL_SHAPE` (its own definition: "a camera named twice") and the device ID. Before, the selector passed the start rule and was refused only by `buildCapturePlan`, after the sources were opened, with no device named. No reason was added to `CapturePlanReason`.

Not built, by C93: a camera that offers two streams as ONE device. `onvif-relay.ts` (keyed by device and profile) is R1's file and was not touched; nothing was deleted.

## 6. Requests left in `delegation_progress/file_requests.md` (five lines, `row R2`)

1. Shared writer: the sentence `common.captureSlotRefusal.CAMERA_ON_BOTH_TRACKS` and its pin; and the decision on the simulator's rule. Blocking: no.
2. Web writer: one kind for `409 COMMISSIONING_NOT_CONFIGURED` in `connectRefusal`. Blocking: yes for calling F3-06 closed for the operator.
3. Writer of `adopted-test.ts`: the same reason on operation 108; the contract text of operations 95, 96, 108. Blocking: no.
4. Writers of `onvif-session.ts` and `stored-address.ts`: the plain forms the two entries now admit. Blocking: no.
5. Writers of the three RC-6 documents, then row 86: a one-line pointer to the erratum. Blocking: no.

## 7. Existing tests that pinned the earlier behaviour (edited, by delta)

| File | What moved |
|------|-----------|
| `capture/__tests__/static.test.ts:406-407` | the pattern of SR-2 (2) and its one assertion became the entry SR-14 (the rule is stricter) |
| `connect/__tests__/service.test.ts`, case "NO network configuration" | three expectations `CANDIDATE_NOT_TESTABLE` -> `COMMISSIONING_NOT_CONFIGURED` |
| `capture-config/__tests__/plan.test.ts`, case "a dual-lens camera ..." | `assertRecordableSelector`: 'no refusal' -> refused; `buildCapturePlan`: `deviceId: null` -> `'CAM-01'` |

Every other selector test passes unedited, including the two that pin the simulator's admitted case (`routes.test.ts:225-229`, `capture-config.db.test.ts:144-146`: no registry is provided there).

New cases, each in the existing file of its subject: `static.test.ts` (SR-14 inside the SR-2 case; one new case for SR-5 entry 2: 71 -> 72 cases); `routes.test.ts` (one case, C93); `plan.test.ts` (the dual-lens case widened); `capture-config.db.test.ts` (one case in block 5, on PostgreSQL, REAL_PRODUCTION).

## 8. Checks

| Check | Command (from `apps/core-server`) | Result line |
|-------|-----------------------------------|-------------|
| The capture static file | `npx vitest run --project unit src/capture/__tests__/static.test.ts --maxWorkers=2` | `Test Files 1 passed (1)`, `Tests 72 passed (72)` |
| Unit: capture-config and connect | `... routes.test.ts plan.test.ts connect/__tests__/service.test.ts` | `Test Files 3 passed (3)`, `Tests 66 passed (66)` |
| The whole static set, fence, capture-session (unit) | `npx vitest run --project unit --maxWorkers=2 static test/static src/capture/fence/__tests__/fence.test.ts src/capture-session` | `Test Files 51 passed (51)`, `Tests 966 passed (966)` - no red |
| Database: connect, capture-config, credential reader, the acceptance pair (`.locks/db-migrate.lock`, sandbox off, throw-away databases) | `lockf ... npx vitest run --project db --maxWorkers=2 connect.db.test.ts capture-config.db.test.ts credential-reader.db.test.ts test/acceptance/contract.test.ts test/acceptance/rbac-matrix.test.ts` | `Test Files 1 failed, 4 passed (5)`, `Tests 1 failed, 162 passed (163)`, `0 remain` - RED 1, not this row's, below |
| Database with the real relay: minted code, stream test, adopted-camera test (both locks, one file at a time) | `... --maxWorkers=1 --no-file-parallelism` | run 2: `Test Files 3 passed (3)`, `Tests 33 passed (33)`, `0 remain` |
| Typecheck | `npx tsc --noEmit` | rc 2, 2 errors, not this row's, below |

Reds that are not this row's:

- RED 1: `connect.db.test.ts:276-279` pins the schema version `[12, 'dbc-13']`; the code is at `[13, 'dbc-14']`. Row D3 is the single writer of the schema and its pins in this wave (its claim line and its request line of migration set 14). Not edited.
- Typecheck: `src/sealing/__tests__/production-key-proof.db.test.ts(254,27)` `Cannot find name 'HostProfileStatement'` and `(283,33)` `Cannot find name 'hostProfileNotAskedOf'` - row P1's host-profile work in flight. No error names a file of this row.

A run of this row's own making, stated: the first run of the three relay-backed files went with two workers; the files bind the same fixture ports, so 7 cases failed with `EADDRINUSE 127.0.0.1:8557` / `no "ready" line from the double`. Run again one file at a time (their headers ask for that): 33 of 33. Not a product fault.

Not run: `camera-adapter-open.db.test.ts` (R1 is editing it), the web and shared suites (no file of theirs changed), the full suites (the controller's).

## 9. What stays unproven

- Everything is on doubles and loopback; no real camera, no second interface, no Linux host.
- F3-11 was found "by reading, not run" and stays so: no session start on a real worker was run with one camera on both tracks. What is proven is that neither the selector (real capture) nor the start rule lets that state reach the plan.
- The web console's drawing of the two changed refusals was read, not run in a browser.

---
*Generated: 2026-10-13*
