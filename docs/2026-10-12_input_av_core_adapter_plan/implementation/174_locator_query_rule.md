---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 174
package: WP-04 (milestone M3), decision C24
date: 2026-10-13
agent: coder-execution
tier: T3
status: complete
---

# Row 174 - ONVIF stream locator with a query, under a closed rule

## 1. Statement

`createOnvifStreamLocator(...).locate` in `apps/core-server/src/capture/adapters/camera/onvif-session.ts` now answers a stream locator that carries a query, when the query is inside the closed rule below. A user part is refused as before (`STREAM_USER_PART`, wherever an `@` stands in the text), a fragment is refused, the refusal code stays `STREAM_LOCATOR_FORM`, and the file still writes the locator to no log and stores it nowhere (it has no logger and no store; the locator is a member of the frozen answer only). The connection test (`test`) is untouched: it compares the address and drops it.

## 2. The rule as built (`queryAllowed`, `locatorOf`)

| Bound | Value | Refused example |
|---|---|---|
| Whole locator | at most 256 characters (the injection point's own bound), visible ASCII, no `#` | 257 characters; `...#part` |
| Part before the `?` | the injection point's rule `credentialFreeLocator`, unchanged: `rtsp`, host, path without a trailing slash | `/cam/?channel=1` |
| Query (after the first `?`) | 1 to 128 characters | `?`; 129 characters |
| Parameters | at most 8, joined by `&`; each `name` or `name=value`; no empty parameter, no second `=` | `a=1&&b=2`, `a=1=2`, 9 parameters |
| Characters | name 1 to 32, value 0 to 64, of `A-Z a-z 0-9 . _ ~ -` only | `%`, `+`, `;`, `/`, `:`, `,`, a second `?`, non-ASCII |
| Names | no name equal, in any letter case, to one of: user, username, pass, password, pwd, auth, token, key, secret, session | `?Token=1`, `?channel=1&PWD=1`, `?secret` |
| Repeats | no name twice (letter case ignored) | `?channel=1&Channel=2` |

Judged on the device's own text: nothing is decoded and no parser decides. A value is not judged (`mode=password` is a locator). The list is compared with the whole name (`sessiontimeout`, `keyframe` are locators). The locator is returned unchanged.

## 3. Change set

| File | Change |
|---|---|
| `apps/core-server/src/capture/adapters/camera/onvif-session.ts` | new `queryAllowed` with five constants (none exported: the export pin of the static rules is unchanged); `locatorOf` splits at the first `?`, holds the first part to `credentialFreeLocator` and the rest to the query rule; three comments (header, reason, answer member) |
| `apps/core-server/src/capture/adapters/camera/__tests__/onvif-session.test.ts` | one nested `describe` with 10 cases; ONE line of a row 26 case changed (section 5) |

## 4. Verification (the row's cell) and evidence

Command (command sandbox off: loopback listeners): `npx vitest run --project unit --maxWorkers=2 src/capture/adapters/camera/__tests__/onvif-session.test.ts src/capture/__tests__/static.test.ts src/capture/adapters/__tests__/static.test.ts src/capture/adapters/camera/__tests__/loopback-guard.test.ts`

| Run | Result |
|---|---|
| 1 (three files) | session file: `Tests 45 passed (45)`. The two static suites did not load: `ReferenceError: SIM_TYPED_ADDRESS_CANDIDATE_ID is not defined` at `packages/shared/src/api/capture-discovery.ts:629`, another row's edit in flight (not this row) |
| 2 (static suites, after that edit settled) | `Tests 3 failed | 69 passed (72)`. One failure was this row's: G-R14 read the quoted fourth name of the list as a default account (`onvif-session.ts:384`). Fixed: the list is one text that is split |
| 3 (four files) | `Test Files 1 failed | 3 passed (4)`, `Tests 2 failed | 115 passed (117)`. The 2 failures are G-R2 and G-R8 naming `src/capture/adapters/production-door.ts`, the new file of row 21 in flight (row 21 writes those lists). Failures naming a file of this row: 0 |

| Verification cell | Test case (block "task 4 row 174 (C24)") | Result |
|---|---|---|
| a locator with an allowed query is returned unchanged | "an allowed query is returned unchanged" (6 forms, whole answer compared; control without a query; `test` holds no part of the query) | pass |
| an over-long query is refused | "over-length" (query 128 / 129, locator 256 / 257, parameters 8 / 9, name 32 / 33, value 64 / 65) | pass |
| a character outside the set is refused | "a character outside the closed set" (21 characters, each in a value and in a name; 8 shapes) | pass |
| each of the 10 names in two letter cases is refused | "each of the 10 credential-like parameter names" (lower, upper, mixed; first and later position; without a value: 6 forms x 10 names; control of longer names) | pass |
| a locator with a user part is still refused | "a user part stays refused beside a query" (3 forms `STREAM_USER_PART`; foreign host and scheme keep their reasons) | pass |
| named cases of the delegation | percent-encoded names (7 forms, encoded once, twice, encoded separator, encoded value); repeated parameters (4); an empty value (allowed for a plain name, refused for a listed one); a fragment (5, with an empty one); credential-like by value only (allowed) | pass |

Every refusal is compared as a WHOLE answer (`toEqual`): outcome, reason, `locator: null`, reads, two counts. So no part of an address is in a refusal.

Typecheck, once: `npx tsc --noEmit -p .` in `apps/core-server`: 6 errors, all in `packages/shared/src/sim/` (`api.ts:444,1950`, `audio.ts:90,375`, `session-machine.ts:982,995`: `string | null`), the selector widening of row 28 in flight. Errors in this row's two files: 0.

## 5. "The cases of row 26 show 0 changed results": one line changed, by the ruling

Row 26's case "a locator with a user part is refused; so is every address that is not the host-and-path form" held the line `/main?channel=someone -> STREAM_LOCATOR_FORM`. That is the refusal C24 lifts, so it cannot stay. The line now reads `/main?token=someone` (still refused, same reason, same "no part answered" assertion). Every other case and line of row 26 and of task 3 in the file: unchanged and green (35 cases before this row's 10).

## 6. The double, and what stays unproven

- Double: the scripted device `test/support/onvif-odd-device.ts` with the Digest camera of row 26's block. The fake stub names its streams without a query (`fakeOnvifProfileStreamUri`), so no case of this row runs on it; its existing cases (locators without a query, `profileSet: 'TWO_SOURCES'`) pass unchanged. No stub change asked.
- Unproven, for the hardware package (`9A/H-10`, recorded through `9A/H-17`): the query form of the bench cameras. A camera is refused if its query uses a percent-encoding, a `/` `:` `,` or `+` in a value, more than 8 parameters, a name longer than 32, or a path with a trailing slash before the `?`. The refusal is by name (`WRONG_PROFILE / STREAM_LOCATOR_FORM`), so the check sees it.
- NOT BUILT, outside the area: the injection point. `credentialAtInjection` (`adapters/credential.ts:125`) still refuses a locator with a query, so a camera with one is located and cannot be opened until that file admits the same rule. Request left, blocking for row 46 on such a camera.

## 7. For the security acceptance (row 86)

- The list of C24 is closed and compared with whole names. Names it does not hold and that are therefore admitted: `passwd`, `pw`, `authorization`, `access_token`, `apikey`, `sid`, `login`, `credentials`. HYPOTHESIS, not measured: no bench camera names its stream so. Widening is one line of the constant.
- The value of a parameter is device text that reaches the start message of the opening process. It is bounded (64) and of a 66-character set with no separator, quote, slash or control character.
- The protection against a credential in the locator remains the user-part rule; the query rule adds that a device cannot make the Core carry a parameter the operator would read as a credential.

## 8. Requests and driver decisions

Requests in `delegation_progress/file_requests.md`: (1) the injection point admits the same rule (blocking for row 46, not for this row); (2) a note on G-R14 and the form of the list constant (no change asked).

DRIVER DECISIONS for the controller to confirm:

1. Bounds: locator 256, query 128, 8 parameters, name 32, value 64.
2. Character set `A-Z a-z 0-9 . _ ~ -` with `=` and `&` as the only structure. No percent-encoding at all, so a percent-encoded name is refused by the set and nothing is decoded.
3. A repeated name is refused (two readers could take different ones).
4. An empty value and a parameter without `=` are allowed; an empty query, an empty parameter and a second `=` are refused.
5. Names are compared whole, letter case ignored; values are not judged.
6. Tightened beside the query: a bare trailing `?` and a bare trailing `#` were admitted by the injection point's rule (the parser reports them empty) and are now refused by `locate`. No case of row 26 covered them.
7. The rule lives in `onvif-session.ts` (the row's area), built on the injection point's rule for the part before the `?`; the request proposes moving it to the injection point as the one copy.
8. One line of a row 26 case changed (section 5).

## 9. Requirement identifiers

Closed on the double: C24 (locate half); WP-04 for the query form; S13-12 (b) for the new device text (bounded, held to a character rule, a refusal is a code). Open: C24 at the injection point (request 1); `9A/H-10` on real cameras; review by row 86.
