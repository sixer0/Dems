---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 26
package: WP-04 (milestone M2)
date: 2026-10-12
agent: coder-execution
tier: T3
status: complete
---

# Row 26 - ONVIF session: the stream of each video source, and the locator of a profile

## 1. Statement

`apps/core-server/src/capture/adapters/camera/onvif-session.ts` now

1. names, in a `REACHABLE` connection-test result, **one profile per video source: the one with the largest announced pixel area, the larger picture first**, each with its ONVIF profile token, its video-source token and its announced width and height (`OnvifSessionResult.profiles`);
2. has a second facade, `createOnvifStreamLocator(...).locate(candidate, credential, profileToken, signal)`, that reads **the credential-free locator** of one profile with one `GetStreamUri`; an address with a user part is refused;
3. forms **no profile code** and judges **no codec** beyond what task 3 already did.

Ported logic: input-av H-03 (`apps/input-av/nvr/onvif_client.py:243-249`: group by `SourceToken`, `max` by width x height), H-05 (`:182-190`), H-11 (resolved at each open, stored nowhere). Not ported: `with_credentials` (`:250-256`) - the Core composes no locator with a user part (addendum 2.5).

## 2. Change set

| File | Change |
|---|---|
| `apps/core-server/src/capture/adapters/camera/onvif-session.ts` | (a) `usableProfilesOf` also reads `videoSourceConfiguration.sourceToken` and `videoEncoderConfiguration.resolution`; (b) new `mainProfilesOf` (the selection); (c) new `locatorOf` (the locator rule); (d) the body of the former `test` is now the generic `exchange(limits, timers, candidate, credential, signal, course)`: agent, client, byte cap, connection limit, digest wrapper, `ask`, `authorizedAsk` are **unchanged text**; the steps 1-2 and the `GetStreamUri` step moved to `mediaServiceOf` and `streamAnswerOf`, shared by both courses; (e) new exports `OnvifStreamProfile`, `OnvifLocatorResult`, `OnvifStreamLocator`, `createOnvifStreamLocator`; new reason `STREAM_LOCATOR_FORM`; (f) header comment |
| `apps/core-server/src/capture/adapters/camera/__tests__/onvif-session.test.ts` | the `REACHABLE` case states `profiles`; one new `describe` with 7 cases |
| `apps/core-server/src/capture/__tests__/static.test.ts:427-428` | ONE additive edit: the export pin of the session file gains the four names (G-R10 / G-R11 "amended by row 3's decision text"; the five-reads rule, the one constructor, `return Object.freeze({ test });` and "no configuration call" are **kept** and pass unchanged) |

Cosmetic leftover, on purpose: the body of `exchange` keeps the indentation it had inside `test`, so the diff of the security-relevant lines is small. No formatter is configured (`apps/core-server/package.json:11`, `oxlint` only).

## 3. Rules built

| Rule | Where |
|---|---|
| Profiles are grouped by video source; of a group the largest area, first of equals; groups ordered by area descending, equals in the device's order | `mainProfilesOf` |
| The announced encoding takes no part in the selection (input-av: `encoding` read at `:176`, never branched on) | same; `profiles` is read from every usable profile |
| `profiles` is empty unless `REACHABLE` (the contract's rule for `usableProfiles`, `adapters/types.ts:105`) | `ended` |
| A size is a whole number 1 to 16,384 per side, else both null and area 0 | `isPictureSide`, `PICTURE_SIDE_MAX` |
| A token is `^[A-Za-z0-9_.:-]{1,64}$`, returned unchanged; a video-source token outside it still groups (internal key) and is answered as null | `PROFILE_TOKEN`, `usableProfilesOf` |
| `locate`: token checked before any request (`CAPTURE_PROFILE_UNKNOWN`); reads `GetSystemDateAndTime`, `GetServices` (`GetCapabilities` as fallback), ONE `GetStreamUri`; no `GetProfiles`; at most one request carries the credential, a refusal is final | `createOnvifStreamLocator` |
| A locator leaves the file only if: `rtsp` scheme, no `@` anywhere, host = the candidate's own, visible ASCII, and the injection point's own rule `credentialFreeLocator` (host and path, no query, no fragment, at most 256 characters). The text is the device's, unchanged; a refusal is a reason code | `locatorOf` |
| No stream is opened, nothing is stored, the locator holds no credential | no socket or stream module; static rules G-R10 pass |

## 4. Verification (the row's cell) and evidence

Command, run twice (a second run only after the first failed):
`npx vitest run --project unit --maxWorkers=2 src/capture/adapters/camera/__tests__/onvif-session.test.ts src/capture/__tests__/static.test.ts src/capture/adapters/__tests__/static.test.ts src/capture/adapters/camera/__tests__/loopback-guard.test.ts` (command sandbox off: loopback listeners).

| Run | Result |
|---|---|
| 1 | `Test Files 1 failed | 3 passed (4)`, `Tests 1 failed | 105 passed (106)`: rule A-6 of `adapters/__tests__/static.test.ts:296` found the word "H.265" in this row's new header comment. Fixed: the comment says HEVC |
| 2 | `Test Files 4 passed (4)`, `Tests 106 passed (106)` |

| Verification cell | Test case | Result |
|---|---|---|
| fake device with two video sources: 2 profiles, larger first | "two video sources with several profiles each ..." (5 profiles on 2 sources; controls: reversed list, one source, no source, not reachable) | pass |
| a token with lower-case letters, a dot, a colon and a hyphen is returned unchanged | "a token with lower-case letters ..." (`Main.Stream:0-a`: in `profiles`, in `usableProfiles`, in the `GetStreamUri` request body, accepted by `locate`) | pass |
| a locator with a user part is refused | "a locator with a user part is refused ..." (3 user-part forms give `STREAM_USER_PART`; 8 other forms refused by name; 0 parts of the address in the results) | pass |
| also | untrusted source token and sizes; `locate` on the fake stub: request log `GetSystemDateAndTime:false, GetServices:false, GetStreamUri:false, GetStreamUri:true`, 0 RTSP requests, 0 violations, 0 canary hits; refusals before a request; deadline, unknown profile, no credential | pass |

Typecheck, once: `npx tsc --noEmit` in `apps/core-server`: **1 error, not in this row's files**: `src/db/store/store.ts(306,7)` (`CaptureConfigRow`), caused by the uncommitted change of `src/db/schema/capture.ts` of the schema row in flight. Errors in the three files of this row: 0.

## 5. The double, and what stays unproven

- Double: the fake ONVIF stub (one source, one profile) and the scripted device `test/support/onvif-odd-device.ts` with a profile answer **local to the test file**. The stub was not edited (row 109 is its writer); request left, section 7.
- Unproven, for the hardware package: the tokens, source tokens, sizes and the form of the stream address of the four bench cameras (`9A/H-17`); a dual-lens camera (none on the bench, `README.md:207` of input-av); the media2 path of the package and TLS (never run, as before).
- **Limit found (the package, not this row):** `onvif` 0.8.3 turns the text of a plain number into a number (`lib/utils.js:9,35`), so a profile whose token is e.g. `1` is not a usable profile (task 3 behaviour, now pinned by a control) and a video-source token `7` is answered as null. A token with a leading zero (`007`) stays text. If a bench camera uses plain-number tokens, the fix is to read the token from the raw answer: not built.

## 6. Finding F-DB-1 (profile token against the selector's code form)

- Confirmed by reading: the selector admits `^[A-Z][A-Z0-9_]{0,63}$` (`apps/core-server/src/db/schema/checks.ts:36`); an ONVIF token such as `profile_1` or `Main.Stream:0-a` does not match, and adoption stores `usableProfiles` as the registry's list (`modules/capture-discovery/connect/service.ts:326`).
- What row 26 does: it returns the ONVIF token **unchanged, as a token**, in a member of its own (`profiles[].token`, `videoSourceToken`), and `locate` takes that token. It mints no code and maps nothing.
- What it leaves: the code (row 50, from the stream, AD-06); the place of the token (`capture_device_streams.onvif_profile_token`, schema set A); the selector contract and the code-to-token lookup at the open (rows 28, 46); `usableProfiles` no longer being ONVIF tokens filtered to H.264 (row 50, S1-6). Until row 50, `usableProfiles` and `profiles` can name different profiles (H.264 list in device order against the largest of every source): stated in the type comment.

## 7. Requests and driver decisions

Requests (`delegation_progress/file_requests.md`, both not blocking): a two-source / odd-token mode of the fake stub (row 109); a ruling on `credentialFreeLocator` refusing a stream address with a query.

DRIVER DECISIONS for the controller to confirm:

1. The locator read is a **second facade** (`createOnvifStreamLocator`), not a second member of the tester: the pins `return Object.freeze({ test });` and "the facade has one member" stay true.
2. `profiles` is filled for `REACHABLE` only and from every usable profile; `usableProfiles`, the profile whose address the test compares, and the `NOT_H264` verdict are untouched.
3. Order across video sources: by area descending (the row's "larger first"), not by source name.
4. Picture side bound 16,384; outside it the size is null, the profile stays usable.
5. A video-source token outside the token rule is answered as null and the profile is kept (dropping it would change today's test results).
6. `locate` takes a `CameraCandidate` (so `targetOf` stays the one address rule) and admits a null credential.
7. New reason code `STREAM_LOCATOR_FORM` (additive; the reason list is pinned nowhere outside this file).
8. `locate` applies the injection point's rule as it stands, query refused (request 2).

## 8. Requirement identifiers

Closed for the session half: WP-04; S1-3 (selection, tokens, sizes read), S1-4 (credential-free locator, resolved per call); H-03, H-05, H-11; P12-F05 (a) on this side (the locator is an asynchronous read the adapter calls inside `openSource`); P12-F08 order (no code here); S13-12 (b) for the new device text. Open by design: P12-N02 (two profiles of one camera: `locate` is per token; the keying is row 46); AD-06 (row 50).
