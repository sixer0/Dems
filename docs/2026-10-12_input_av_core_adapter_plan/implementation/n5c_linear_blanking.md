# Row N5c - linear blanking of foreign text (wave 12, track D, 2026-10-14)

Decision C138. Answers request line 559 of `delegation_progress/file_requests.md` (row N5b, record n5b section 4). Blocking before row 88 and before any macOS listing in use. Edit tool only on existing files; no device, no port bound by this row's own code, nothing left running.

Status: complete. Request line 559 (row N5b) is answered by this row.

## 1. What was changed

| File | Change |
|---|---|
| `apps/core-server/src/capture/adapters/credential.ts` (`USER_PART`, :336 before) | `/([a-z][a-z0-9+.-]*:\/\/)[^/\s'"<>@]*@/gi` -> `/(?<![a-z0-9+.-])([0-9+.-]*[a-z][a-z0-9+.-]*:\/\/)[^/\s'"<>@]*@/gi` (the request's form, verbatim); replacement unchanged `$1${CREDENTIAL_MARK}@`; comment naming N5c / C138 and the measurements |
| `apps/core-server/src/capture/adapters/production-door.ts` (`LOCATOR_OPEN_AT_CUT`, :276 before) | the same construction anchored at the end: `/(?<![a-z0-9+.-])([0-9+.-]*[a-z][a-z0-9+.-]*:\/\/)[^/\s'"<>@]*$/i`; the take-off is now the exported function `takeOffLocatorOpenAtCut(text)` (one line: `text.replace(LOCATOR_OPEN_AT_CUT, '$1')`), called by the observer at the same place (:360 before) - exported for its own test only |
| `apps/core-server/src/capture/adapters/__tests__/credential.test.ts` | ONE appended block, 3 cases (section 4) |
| `apps/core-server/src/capture/adapters/__tests__/production-door.test.ts` | ONE appended block, 1 case (section 4); `takeOffLocatorOpenAtCut` is taken by a dynamic import inside the case, so the file's import lists are untouched |

Why the new form gives the same output (reading, then fuzz): the old form is tried at every position; inside a run of scheme characters `[a-z0-9+.-]` only a letter can start it, and from any letter of the run the greedy `[a-z0-9+.-]*` must reach the run's end before `:` (a `:` is not in the class), so every start in one run meets the same `://` and the leftmost successful start is the run's FIRST letter. The new form starts only at the run's first character (look-behind) and lets `[0-9+.-]*` take the digits and signs before that first letter into the group; the replacement writes the group back, so the text before the first letter is kept exactly as the old form left it in front of its match, and the tail (`[^/\s'"<>@]*@` or `...$`) is the same from the same `://`. After a `USER_PART` match the next character follows an `@`, which is not a scheme character, so the look-behind sees the same thing the old scan did. Cost: per start, the run is passed once; starts are run starts only; each `://` belongs to one run; so each character is passed a bounded number of times.

## 2. Verification of the request (measured on this Mac, node v26.8.2, scripts in the session scratchpad, median of 3-5 runs)

(a) Old `USER_PART`, `blankCredentialLocators` of letters (load average about 6.7 during the run, another session's e2e on the host): 16 KiB 398.9 ms, 32 KiB 1,749.6 ms, 64 KiB 4,381.5 ms - quadratic confirmed (N5b measured 211 / 628 / 2,505 ms on a quieter host). A mutant run inside vitest: 64 KiB 1,712.5 ms.

(b) Differential fuzz, old vs new, BOTH patterns on every text:

| Set | Seed | Texts | `USER_PART` differences (texts the old form changed) | `LOCATOR_OPEN_AT_CUT` differences (texts changed) |
|---|---|---|---|---|
| the request's alphabet `aZ19+.-:/@ <x"'\n`, pieces `://` `rtsp://` `u:p@` `1x`, length 0-47 symbols | 12345 | 250,000 | **0** (92,978) | **0** (16,528) |
| wider: `aZz09+.-:/@ <>x"'\n\r\t\?#%` plus `é` `Ä`, pieces + `RTSP://` `-1.a+://` `http://h/` `@@` `9+://` `:/` `a1b2` | 777 | 250,000 | **0** (68,183) | **0** (10,332) |

Total 500,000 texts, 0 differences for either pattern.

(c) New `USER_PART`: 1 MiB of letters 7.1 ms; 1 MiB of `x1` 8.5 ms; 64 KiB of letters 0.5 ms.

## 3. Audit of every other regular expression on device- or program-supplied text (64 KiB adversarial input built for each, median of 5)

| # | File:pattern | Input reaches it | Adversarial 64 KiB input | Time | Verdict |
|---|---|---|---|---|---|
| 1 | credential.ts `QUERY_PARAMETER` `/^([A-Za-z0-9._~-]{1,32})(?:=([A-Za-z0-9._~-]{0,64}))?$/` | parameters of a locator, after the 256-character locator bound | 64 KiB name characters; 32 + `=` + 64 KiB value + `!`; 64 KiB of `a=` | 0.01 / 0.01 / 0.01 ms | linear (anchored, bounded counts) |
| 2 | credential.ts `/^[0-9]{1,6}$/` (`sessiontimeout` value) | one parameter value | 64 KiB digits | 0.01 ms | linear |
| 3 | credential.ts `/[\s\\]/` | the locator, after its length check | 64 KiB without a match | 0.00 ms | linear (one class) |
| 4 | credential.ts `/^\/+/` (`streamLocator`'s path) | a stored or device path | 64 KiB of `/` + `x`; 64 KiB of `x` | 0.02 / 0.00 ms | linear (anchored at the start) |
| 5 | production-door.ts `LOCATOR_OPEN_AT_CUT` (old form) | a CUT stderr line, at most `PRODUCTION_DIAGNOSTICS_LINE_CHARS` = 512 characters | 64 KiB letters; 512 letters; 64 KiB of `a://x@` | **2,736.0** / 0.21 / 0.18 ms | QUADRATIC in a run of letters - FIXED (above 50 ms at 64 KiB; reachable only at 512 characters today, 0.2 ms, so a defence in depth: the form no longer depends on the line bound) |

New forms on inputs built against THEM (look-behind passing often, many `://`, long tails without `@`), 64 KiB each: `LOCATOR_OPEN_AT_CUT` new - letters 0.30, `x1` 0.29, `a://x@` 0.50, ` a:` 0.41, `1-`+letter 0.37 ms; `USER_PART` new - `a://` repeated 0.52, `a://` + 64 KiB `x` without `@` 0.40, ` a://x` 0.51, `1-` runs 0.37, ` 1a:` 0.44, `a://b:` 0.61, `-a:` 0.38 ms. All linear.

No other regular expression runs in either file (`split(' ')` of constants and `split('&')` of a bounded query are string splits). The door's line handling (`push`, `lineEndFrom`, the `HARMLESS` table) uses `indexOf` and a table lookup, no pattern.

Fixed: 1 other pattern (`LOCATOR_OPEN_AT_CUT`): old 64 KiB letters 2,736 ms -> new 0.30 ms, 1 MiB letters under 10 ms; differential fuzz 500,000 texts, 0 differences (section 2 (b)).

## 4. Tests added, and the mutations they were seen RED on

credential.test.ts, block "row N5c: the blanking of foreign text is linear, and its output is the output of before":
- 64 KiB of letters < 100 ms, then 1 MiB of letters, 1 MiB of `x1`, 1 MiB of `Zq9-` < 250 ms each and unchanged; 1 MiB of letters + ` rtsp://u:p@192.0.2.10/s` < 250 ms with the user part blanked. (The 64 KiB step first, so that the old form fails in about 2-4 s instead of running about 10 minutes on 1 MiB.)
- the cases of before (leading digits and signs, upper case scheme, two locators, quotes and brackets, digits-only scheme unchanged, letters without a locator unchanged) give the literal expected text, and the form before (kept in the test only as the reference) gives the same.
- 20,000 seeded random short texts (request alphabet + `RTSP://`, `-1.a+://`): 0 differences from the form before; at least 2,000 of them carry a user part.

production-door.test.ts, block "row N5c: the take-off of a locator left open at the cut is linear ...": one case - 64 KiB letters < 100 ms, 1 MiB letters and 1 MiB `x1` < 250 ms unchanged; 6 literal cases (with the form before giving the same); 20,000 seeded texts, 0 differences, at least 1,000 changed.

Mutations, applied IN MEMORY at transform time with row N5b's `.cache/task4-n5b/mutant.vitest.config.ts` (read-only use; no tree file written):

| Mutation | Result |
|---|---|
| M1 credential.ts back to the form before (`(?<![a-z0-9+.-])([0-9+.-]*[a-z]` -> `([a-z]`) | RED: time case, `expected 1712.517333 to be less than 100`; `Tests 1 failed / 20 passed (21)` |
| M2 production-door.ts back to the form before (same replacement) | RED: `expected 1825.560417 to be less than 100`; `Tests 1 failed / 23 skipped (24)`. Control (an identity replacement through the same config): `1 passed / 23 skipped` |
| M3 credential.ts linear but WITHOUT the leading digits and signs (`(?<![a-z0-9+.-])([a-z]...`): the trap - `1rtsp://u:p@h` would keep its user part | RED: `expected '1rtsp://u:p@h' to be '1rtsp://[credential]@h'`; fuzz `expected [ …(4626) ] to deeply equal []`; `Tests 2 failed / 1 passed` |
| M4 the same trap in production-door.ts | RED: `expected 'failed at 9rtsp://user' to be 'failed at 9rtsp://'` |

## 5. Doubles and what stays unproven

No double needed: the patterns are pure text functions; the door's existing cases (stand-in programs `/bin/sh`, this runtime's `node -e`) carry the cut path. Stays unproven (hardware package 9A/H): a real device's error text and a real macOS USB tree through the door at the 512 KiB cap - the time bound is proven for the worst text form, not observed on the device.

## 6. Checks (result lines)

- credential.test.ts alone: `Test Files 1 passed (1)`, `Tests 21 passed (21)`.
- the six locator test files (credential, camera onvif-session, onvif-relay, stream-probe, `__tests__/fakes`, `__tests__/production-door`; sandbox off, under `.locks/heavy-host.lock`, 900 s alarm): `Test Files 6 passed (6)`, `Tests 205 passed (205)` (196 at row 174b + N5b's door cases + this row's 4).
- audio listing tests through the door (usb-audio-macos, usb-audio-production, alsa-config, macos-card-listing, card-listing; under the lock, 900 s alarm): `Test Files 5 passed (5)`, `Tests 216 passed (216)`.
- static rule sets: `src/capture/adapters/__tests__/static.test.ts` + `src/capture/__tests__/static.test.ts` `Test Files 2 passed (2)`, `Tests 115 passed (115)`; `test/static/credentials.test.ts` `Tests 14 passed (14)`.
- `tsc --noEmit -p .` (apps/core-server): 9 errors, none in this row's files - the known N13 protocol change: TS2739 meter fields at `capture/__tests__/fault-lifecycle.test.ts:205`, `forwarder-advisories.test.ts:47`, `forwarder-engine.test.ts:77`, `:78`, `fence/__tests__/development-session.db.test.ts:396`, `:397`, `test/support/capture.ts:262`; `capture/adapters/mic-transport.ts:88` (TS1360), `:91` (TS7053).
- oxlint on the 4 touched files: no diagnostic, exit 0 (control on `capture-composition.test.ts` prints its known warning, so the run is live).

## 7. Driver decisions

- DRIVER DECISION 1: `LOCATOR_OPEN_AT_CUT` is fixed although its reachable input is 512 characters (0.2 ms before), because the brief's rule is "above 50 ms on 64 KiB"; and it is reached through a new exported function `takeOffLocatorOpenAtCut` so that a test can hold its bound (a 512-character line cannot make the form before RED). The function has one caller, the observer.
- DRIVER DECISION 2: the test bounds are 100 ms for 64 KiB (the step that makes the form before fail fast) and 250 ms for 1 MiB (the brief's example), against measured 0.5 ms / 7-9 ms.
- Observation, not changed (same output before and after): a user part with a raw space or a second raw `@` (`rtsp://u p@h`, `rtsp://u@v@h`) is blanked only up to the first stop character - the pattern's rule since row 65, which a URL-encoded credential does not meet.
