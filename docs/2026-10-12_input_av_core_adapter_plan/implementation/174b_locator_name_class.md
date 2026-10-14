---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 174b
package: caution C-4 of the security review of row 86 (verification/086_pre_lift_security.md:79), decision C127; builds on row 174 (C24) and row 46
date: 2026-10-14
agent: coder-execution (agent 174b, wave 12, track D)
size: S
status: needs-review (built and green in its own file; ONE case of row 174 in a reserved file is red by design - request line left)
---

# Row 174b - the stream locator's query names refused by substring class

## 1. Statement

`queryAllowed` in `apps/core-server/src/capture/adapters/credential.ts` (the one query rule of the locator read and of the injection point since row 46) compared a parameter name WHOLE against ten words. Caution C-4 named nine common credential parameters it let through: `passwd`, `pw`, `usr`, `login`, `loginuse`, `loginpas`, `account`, `apikey`, `access_token`. The name rule now refuses by the class of a part the name contains. Every other bound of the rule is unchanged.

## 2. The rule as built

A parameter name, letter case folded, is refused when:

| Test | Words | How compared |
|---|---|---|
| `CREDENTIAL_LIKE_PARTS` | `pass pwd token key secret auth user login session` | the name CONTAINS the part, anywhere |
| `CREDENTIAL_LIKE_WHOLE_NAMES` | `pw usr account` | the name IS the word |
| `STREAM_PARAMETER_EXCEPTIONS` | `sessiontimeout` -> value `^[0-9]{1,6}$` | this one name is admitted only with a value of 1 to 6 digits; without a value, with an empty value or any other value it is refused |

Unchanged: whole locator at most 256, query 1 to 128, at most 8 parameters, name 1 to 32 and value 0 to 64 of `A-Z a-z 0-9 . _ ~ -`, no `%`, no empty parameter, no second `=`, no repeated name (case folded), the user-part refusal on the raw text and the parsed form, no fragment, no bare `?`. A value is still not judged, except the exception's. The refusal is still `CAPTURE_LOCATOR_INVALID` naming no part of the input. No export added (the static export pins are untouched).

Code: one new private function `credentialLikeName(name, value)`; `QUERY_PARAMETER` now captures the value as group 2; the two constants are each ONE quoted text that is split (static rule G-R14 reads a quoted account word as a default account; no camera maker is named anywhere, G-R14 VENDOR).

### The stated choice for the short words (DRIVER DECISION 1)

`pw`, `usr`, `account` are refused only as the whole name, as the brief proposed. As parts they stand inside harmless names (`pwm`, `busrate`, `accountancy` are the controls of case 3), and every credential-shaped longer name that holds them already holds a class part (`pwd`, `user`, `passwd`) or is admitted with no evidence of use (`accountid`, `usrid`: HYPOTHESIS, no camera or fixture names a stream so).

### The exception (DRIVER DECISION 2)

`sessiontimeout` contains `session`. The fixture forms of the product model a camera's ONVIF stream address of the form `.../onvif-media/media.amp?profile=...&sessiontimeout=60&streamtype=unicast` (`onvif-session.test.ts:984`, row 174's "forms common cameras name their stream with"). Refusing it would refuse a form the product states as a real camera's - the defect the brief names. It is admitted with digits only (1-6), so the exception carries no text; that is the conservative closing of the hole an exception opens.

## 3. Collisions: every locator the product and its fixtures use, against the new rule

Searched (hosts masked in the search output, none copied here): `apps/core-server/src`, `apps/core-server/test`, `apps/capture-worker`, `packages/`, `scripts/`, `apps/input-av` (read-only reference, `data/` not opened) and every record under `docs/`, for `rtsp://...?...` and for query names (`channel=`, `subtype=`, `profile=`, `sessiontimeout`, `streamtype=`, `transportmode=`, and the class parts after `?`/`&`).

| Source | Query names | Under the class rule |
|---|---|---|
| `camera/__tests__/onvif-session.test.ts:981-987` (row 174's common forms) | `channel subtype unicast proto transportmode profile sessiontimeout streamtype real_stream a.b_c~d-e9` | all admitted; `sessiontimeout=60` admitted by the exception - **COLLISION 1, resolved** |
| `camera/__tests__/onvif-relay.test.ts:54`, `stream-probe.test.ts:49`, `__tests__/credential.test.ts:110` | `channel subtype transportmode profile tcp mode` | admitted |
| row 174's bound cases (`onvif-session.test.ts:998-1081`) | synthetic `a b p0..p7 n.. v mode stream name kind next flag` | admitted (unchanged results) |
| row 174's control `onvif-session.test.ts:1049` | `sessiontimeout keyframe authmode username2 tokens` | `keyframe`, `authmode`, `username2`, `tokens` now REFUSED - **by design** of C-4 (they are synthetic controls of the whole-name rule, not a camera form). The case is red; request line left (section 6) |
| `apps/capture-worker/test/announce_test.c:78` (`?x=1`) | `x` | not judged by the Core rule; admitted anyway |
| `apps/input-av` (reference) | stream URIs from `GetStreamUri` are kept as returned; no query form is written down; `?token=` there is the reference's own HTTP API, not a camera locator | - |
| Real cameras of the user (rows 232, U24) | **no recorded stream address exists**: the locator is stored nowhere and printed nowhere (row 126 D-4; row 232 records outcomes and counts only) | cannot be checked here -> `9A/H-10` criterion 6 ("the query outcome named") |

Collisions with a camera form the product uses: **1** (`sessiontimeout`), resolved by the exception. Collisions with a recorded real-camera answer: **0 found, 0 checkable** (none recorded). Synthetic controls flipped by design: 1 case (4 names).

HYPOTHESIS, not measured (for `9A/H-10`): a camera whose stream address carries a name such as `videokeyframeinterval` / `keyframe` (key), `authmode` (auth) or `userdata` (user) would now be refused, by name (`WRONG_PROFILE / STREAM_LOCATOR_FORM`), at locate. The remedy is one entry of `STREAM_PARAMETER_EXCEPTIONS` with a closed value form, not a widening of the class.

Names still admitted (not in the class, for the reviewer): `sid`, `cred`/`credentials`, `sig`/`signature`, `pin`, `code`, `hash`, `accountid`, `usrid`. Adding a part is one word of `CREDENTIAL_LIKE_PARTS`.

## 4. Tests (`apps/core-server/src/capture/adapters/__tests__/credential.test.ts`, one nested describe, 6 cases appended)

| Case | What it holds |
|---|---|
| 1 | the nine names C-4 lists, each in 6 forms (lower, upper, mixed case; first and later position; without a value) refused; the ten names of row 174 still refused |
| 2 | each of the 9 parts inside a longer name (`x<part>`, `<part>x`, `x_<part>_2`, `<part><part>`: 36 names x 6 forms) refused; 15 device-chosen names (`authorization`, `oauth`, `x-api-key`, `userid`, `sessionid`, `keyframe`, `authmode`, `username2`, `tokens`, ...) refused |
| 3 | `pw`, `usr`, `account` refused whole; controls `pwm`, `busrate`, `accountancy` admitted (the stated choice) |
| 4 | the product's locator forms admitted (`channel/subtype`, `+unicast/proto`, `transportmode/profile`, the `sessiontimeout=60` form, `real_stream`, `SessionTimeout=60`, credential words as VALUES) and written byte for byte into the start message by the injection point |
| 5 | the exception: `sessiontimeout=1` and `=999999` admitted; no value, empty, 7 digits, letters, `6O`, the canary, `sessiontimeouts`, `xsessiontimeout` refused |
| 6 | the other bounds: 128 / 129, 8 / 9 parameters, `%`, repeated name (also the exception twice), `;`, the user part with and without a query |

Every refusal is checked to be `CAPTURE_LOCATOR_INVALID` for the device id and to leak neither canary value.

## 5. Mutations (each applied to `credential.ts` with the Edit tool, the file run once, then reverted with the Edit tool)

| Mutant | Result |
|---|---|
| M1 row 174's rule put back (`new Set(<the ten>).has(name)`, no exception, no whole names) | RED: cases 1, 2, 3, 5 (`4 failed | 14 passed (18)`) |
| M1a the parts compared as whole names (`name === part`) | RED: cases 1, 2, 5 and row 46's case (`PassWord`) (`4 failed | 14 passed (18)`) |
| M2 the whole-name list emptied | RED: cases 1, 3 (`2 failed | 16 passed (18)`) |
| M3 the exception removed | RED: cases 4, 5 (`2 failed | 16 passed (18)`) |
| M4 the exception's value form widened to any value | RED: case 5 (`1 failed | 17 passed (18)`) |

After the revert the function text was read back (`sed -n 118,135p`) and equals the built rule.

## 6. Checks (targeted, `--maxWorkers=2`, one run each unless stated)

| Check | Command | Result |
|---|---|---|
| credential tests | `npx vitest run --project unit --maxWorkers=2 src/capture/adapters/__tests__/credential.test.ts` | `Tests 18 passed (18)` |
| the locator-building tests (sandbox off, under `.locks/heavy-host.lock`) | credential, `camera/__tests__/onvif-session`, `onvif-relay`, `stream-probe`, `__tests__/fakes`, `__tests__/production-door` | `Test Files 1 failed | 5 passed (6)`, `Tests 1 failed | 195 passed (196)`. The one: `onvif-session.test.ts:1049`, row 174's whole-name control - red by design (section 3) |
| static rule sets | `src/capture/__tests__/static.test.ts`, `src/capture/adapters/__tests__/static.test.ts` | `Tests 3 failed | 107 passed (110)`: SR-15 (1), A-9, A-11 - all three name `src/capture/adapters/audio/usb-audio-macos.ts` (N9's new file, in flight). None names `credential.ts` |
| Core typecheck | `npx tsc --noEmit -p .` in `apps/core-server` | 16 errors, 0 in this row's files: `fault-lifecycle.test.ts`, `forwarder-advisories.test.ts`, `forwarder-engine.test.ts` (2), `development-session.db.test.ts` (2), `test/support/capture.ts` (audio level fields, N13), `mic-transport.ts` (2), `adopted-camera-test.db.test.ts`, `camera-adapter-open.db.test.ts` (stored-address decision), `modules/capture-config/network/service.ts` (3) and `packages/shared/src/api/capture-commissioning.ts` (2) (`onvifPorts`, V7b) |
| lint | `npx oxlint src/capture/adapters/credential.ts src/capture/adapters/__tests__/credential.test.ts` | exit 0 |

No device, no network probe, no database, no port of this row's own; the heavy-host lock was taken for the one run that starts the scripted ONVIF devices and released when it ended. Nothing left running.

## 7. Requests and what stays open

- `delegation_progress/file_requests.md`, row 174b: `onvif-session.test.ts:1048-1049` (camera/**, reserved for the lift) - the exact replacement lines; **blocking YES for a green unit suite**, no for this row.
- Open: `9A/H-10` on the real cameras (their stream address's query names against the class; the refusal is by name, so the check sees it).
- Requirement closed on the double: C127 C-4 (the name list). C24 stands with the class rule in place of its ten-word list.

**Ruling C129 (controller, same day):** the request was applied by this row with the Edit tool - `onvif-session.test.ts:1048` comment, `:1049` allowed case (`sessiontimeout=60&pwm=1&busrate=2&accountancy=3`), one refused case after it (7 names). Re-run of the six locator files under the heavy-host lock: `Test Files 6 passed (6)`, `Tests 196 passed (196)`. Status: complete.

## 8. Edit-only statement

`credential.ts`, `credential.test.ts`, `file_claims.md`, `file_requests.md`: changed with the Edit tool only (small additive edits after re-reading; the four mutants and their reverts too). No scripted replace, no shell append, no generated rewrite. New files (this record, `row_174b.md`) with Write. Nothing staged or committed.

## 9. Driver decisions for the controller

1. `pw`, `usr`, `account` whole-name only (section 2).
2. One exception `sessiontimeout`, digits 1-6 only, refused without a value (section 2).
3. The class kept exactly as the brief lists it; the names still admitted are listed in section 3, not added.
