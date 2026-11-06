# Row M2 (track D) - security review of the design of the macOS production microphone path

- Agent: security-review. Date: 2026-10-13 16:28 (host `date`).
- Status: **complete**. Verdict of the design: **CAUTION, 0 FAIL - provisional** until the measurement row MM has run and this review has an addendum on it.
- Files written: `verification/08_security_macos_microphone.md` (Tier 1); this file. No source file changed. `decisions/decisions.md` and the tracking files not written.
- Devices: none opened, none listed through the capture program, none recorded from. Decision U23 was read at `decisions/decisions.md:132` after the controller's broadcast; this review itself still opened nothing.

## Result

28 requirements SM-01 to SM-28: PASS 7, CAUTION 21, FAIL 0. Gates (5): SM-02, SM-04, SM-14, SM-16, SM-26.

## Rank-1 list (before the first line of code)

1. Row MM, the bounded measurement by an agent (bounds in SM-26): at least MM-1 (text of the device list), MM-2 (`none:<n>` opens the indexed device), MM-3 (what the helper states about the opened stream); then an addendum of this review.
2. SM-02: the form of the USB tree row. The TEXT form is forgeable by a device's own product string (a forged column-0 header moves the device to a location it chose). Property-list form measured: typed, escaped, 19,491 bytes; but no interface class at depth 2 on this Mac, and it fails inside a command sandbox.
3. SR-14 adopted in the tightened words (report section 5).
4. SM-14 and SM-16 as gates in the blueprint: one non-zero sample, and the helper's own stated rate and channel count, before a microphone is called recording.
5. The user is told: the microphone grant is per launching APPLICATION, standing, and covers the built-in microphone; with U23 (4) that includes the application hosting the agents.
6. SM-20: where the fact "bench form" lives in code and evidence (with row P1).

## SR-14: TIGHTENED (not reversed)

A closed set of 32 words `none:0` to `none:31` in canonical decimal, from the list read for THIS START; a kind of list of its own in the static rule (a device named by text refused in every production list); the same 64 selections by the same function, below the live channel count; formats `avfoundation`, `f32le`, `null` only; no `-audio_device_index`, no `default`; three fixed listing rows with a bound each, the USB tree row in the form SM-02 settles; the pre-check row named now.

## Findings the controller should know at once

- The reused output line holds `-ar 48000` (`mic-helper-args.ts:73`): the helper resamples by itself. The design's "nothing may resample without a word" and U23 (2) are not met by a listing's number alone (SM-16).
- A denied permission may deliver exact digital zero; today nothing refuses that (the worker's silence warning is never a switch; the Linux pre-check passes on exit code 0) (SM-14).
- `system_profiler` in a confined process answers an empty list with exit 0 (confirmed); a killed one may leave a child (unmeasured) (SM-10, SM-13).
- AD-07 (3) (single-flight, spaced listing) is not in the design; the watch would start three programs every 5 s (SM-10).
- Design F14 is inexact: `sampleBits` outside 16 / 24 / 32 is LEFT OUT of the source facts, not stored as null.
- The design's observation about `static.test.ts:1078-1079` (`-channels`) does not hold in the tree read now (`:1193-1194, :1205` pin `-ch_layout`).

## Three results of row MM that would be a FAIL (a stop for the user)

MM-2 fails for both `none:<n>` and `-audio_device_index`; MM-3 shows the helper states nothing about the opened stream; or a build that calls a session recording on a helper that merely stayed alive.

## Commands run (form only, values never printed)

`ioreg -r -c IOUSBHostDevice -l -d 2 -w 0` (in the sandbox); the same with `-a` (in: fails; out, once); `system_profiler SPAudioDataType -json` (in: empty list; out, once). Two runs left the command sandbox, each a command the delegation named for a check of form.

## Not read

The implementation records 064, 067, 068, 079b, 085c, 155, 190, 199, 200 (their code was read instead); `mic-adapter.ts`, `mic-pipe.ts`, `card-listing-reader.ts`, `alsa-config*.ts`; the registrar module; the web console.
