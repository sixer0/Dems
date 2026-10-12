---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 147
date: 2026-10-12
agent: coder-execution
tier: T3
requirement: AD-03 point 6 (the part of row 147; zero-fill by the door and the door's errors are row 21)
status: complete
---

# Row 147: the start message becomes bytes in one function; the injection result prints as the mark

## What was built

| File | Change | Description |
|---|---|---|
| `apps/core-server/src/capture/adapters/credential.ts` | modify | `InjectedStreamAccess` is now an opaque, frozen class (was a frozen plain object with enumerable `username` and `secret`, weakness W-2). Its content sits in a module-private `WeakMap`; `toString`, `toJSON` and the inspection hook return `CREDENTIAL_MARK`. `credentialAtInjection(locator, sealed)` keeps its signature and returns that class. New `startMessageBytes(message): Buffer`, types `StartMessage`, `StartMessagePlainMember` |
| `apps/core-server/src/capture/adapters/__tests__/credential.test.ts` | modify | the injection test rewritten for the opaque result; a new block of 5 tests for the serialiser; the injection result added to the log / error-log channel test |

## `startMessageBytes`, as built

- Input: a flat object; each member a string, a finite number, a boolean, `null`, or at most one stream access made by `credentialAtInjection`, under any name.
- Output: one line, `{"name":value,...,"<name>":{"locator":"...","username":"...","secret":"..."}}` followed by one line feed, in the order of the members. Byte-equal to `JSON.stringify` of the same content for the test fixtures.
- No text of the message is made: every text value is copied to bytes of its own and written as a JSON string byte by byte (quote and backslash escaped, a control byte as its six-byte escape, so the message is always one line; bytes of 0x80 and above pass unchanged). Structure and number literals are ASCII literals.
- The result is `Buffer.alloc` memory of its own (offset 0, not a slice of the shared pool), so the door's zero-fill reaches all of it. Every intermediate copy is zero-filled in a `finally`, also on a refusal.
- Refusals (a `CaptureAdapterError` with a code, no cause, no part of the message): a container, `undefined`, a bigint, a non-finite number, a second stream access, an object that is not a stream access of this file (a clone, a look-alike, a `SealedCredential`), a text with an unpaired surrogate.
- The store of stream accesses is read in this function only; the source check in the test file holds that.

## Checks (this Mac; no device, no process, no network)

| Check | Command | Result |
|---|---|---|
| Subject tests | `npx vitest run --project unit src/capture/adapters/__tests__/credential.test.ts --maxWorkers=2` | run 1: 9 passed, 2 failed (both were wrong expectations of the new tests: a control assertion, and the URL member read at the locator check); run 2: `Test Files 1 passed (1)`, `Tests 11 passed (11)` |
| Adapter layer neighbours | same runner, `static.test.ts`, `fakes.test.ts`, `registry.test.ts` of `adapters/__tests__` | `Test Files 3 passed (3)`, `Tests 36 passed (36)` |
| Capture-wide static rules | same runner, `src/capture/__tests__/static.test.ts`, `test/static/credentials.test.ts`, `test/static/guard-family.test.ts` | `Test Files 3 passed (3)`, `Tests 66 passed (66)` |
| Typecheck | `npm run typecheck` in `apps/core-server` | `tsc --noEmit`, no output, exit 0 |
| Lint | `npx oxlint` on the two files | exit 0 |

Verification cell of the row, item by item:

| Item | Where | Result |
|---|---|---|
| `JSON.stringify` gives 0 occurrences of a fixture secret | test "the injection point is where the two meet ..." | `"[credential]"`; as a member `{"type":"start","access":"[credential]"}` |
| `util.inspect` | same | `[credential]`; with `showHidden`, `getters`, and with `customInspect: false`: 0 occurrences |
| `String()` and template interpolation | same | `[credential]` |
| an `Error` whose cause holds it | same, and the channel test (logger, `describeError`) | 0 occurrences in message, stack, inspection, JSON, log text |
| not a plain serialisable object | same | `Reflect.ownKeys` empty, no inherited enumerable member, spread gives `{}`, a structured clone holds nothing |
| the function is the only place that reads both members | last test of the new block | `ACCESS.get(` occurs once, inside `startMessageBytes`; `.username` / `.secret` occur in the seal constructor (the operator's input), in `startMessageBytes`, and as `parsed.username` of a parsed URL in the locator check |

No fixture is a real credential: the existing synthetic canary pair of the file and one pair of placeholder texts with awkward characters. Byte and value comparisons are asserted as booleans, so a failing run prints `false`, not the value.

## Doubles and what stays unproven

- Double: none needed; the function is pure. The process door (row 21) is not built: that the door writes these bytes, zero-fills them and keeps the pipe open is row 21's proof.
- Unproven here: the relay's reading of this line format (row 41); erasure of the credential's own two JavaScript strings is not claimed (CR-3).

## DRIVER DECISIONS (for the controller to confirm)

1. **Line format.** No document fixes the relay's start-message format beyond "one line on standard input". Chosen: one JSON object, the stream access as a nested object of `locator`, `username`, `secret`, one trailing line feed. Row 41 (relay) reads this.
2. **At most one stream access, zero allowed.** WP-02's door is also used by S3 (a helper without a credential), so a message without an access is serialised; two are refused.
3. **Refusal code.** `errors.ts` is outside the ownership area, so a malformed message is refused with the existing `CAPTURE_LOCATOR_INVALID` (the code a forged sealed credential already gets). A dedicated code is requested.
4. **`static.test.ts` not edited**, although the Execution Profile lists this row as a writer of `static-adapters`: the delegation limited writing to `credential.ts` and its test file, and row 13 holds a claim on that file now. The "one reader" check sits in `credential.test.ts`; moving it is requested as optional.
5. **The injection result exposes no member at all**, not even the locator (the earlier object had `locator`). No production file read it (`credentialAtInjection` has no caller yet).
6. **A text with an unpaired surrogate is refused** rather than replaced: replaced, the relay would send another value than the stored one.

## Requests left in `file_requests.md`

Three lines, none blocking: the index export of the new function and types; a dedicated refusal code; the optional move of the source check into rule A-2.

---
*Generated: 2026-10-12*
