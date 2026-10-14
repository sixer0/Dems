# Row N5b - the door's per-call cap and process-group kill (decision C131 (2), (3))

Status: complete (one blocking request left for the hardware stage, section 4). Wave 12, track D, 2026-10-14. Edit tool only for existing files; new files with Write. Nothing committed.

## 1. What was built

| Item | Where | As built |
|---|---|---|
| Per-call cap | `capture/adapters/production-door.ts` | Option `outputCapBytes`; default `PRODUCTION_OUTPUT_CAP_BYTES` = 65,536, unchanged for every caller that names none. New bound `PRODUCTION_OUTPUT_CAP_MAX_BYTES` = 1,048,576. A cap that is not a safe integer from 1 to the bound starts nothing: new refusal `OUTPUT_CAP_NOT_ALLOWED` (`PRODUCTION_OUTPUT_CAP_NOT_ALLOWED`, fixed sentence). `boundedText(capBytes)` keeps that many bytes of each stream. The observer's bounds are untouched. |
| Process group | same file | Option `processGroup`; only `=== true` counts. Then `spawn(..., { detached: inOwnGroup })` (new session, group ID = child PID) and the one signalling function sends `process.kill(-pid, signal)` while the child is not over (PID a safe integer > 1; ESRCH swallowed). This covers all three kills: `kill()`, the kill of a refused start, the kill at server exit. Without the option the line of before (`running.kill(signal)`) runs. |
| USB tree cap | `capture/adapters/audio/macos-plist.ts` + `capture/fence/production-parts.ts` | ONE constant `MACOS_USB_TREE_TEXT_BYTES = 512 * 1024` in the reader's file (an adapter file may not import the fence; the fence imports the reader's file). `MACOS_PLIST_LIMITS.textCharacters` = it; `MACOS_LISTING_ROW_LIMITS.USB_TREE.capBytes` = it. Other two rows keep 32 KiB. |
| Runner's door call | `production-parts.ts` (the macOS runner only) | `door({ command: program, args, env: {}, message: null, timers, outputCapBytes: capBytes, processGroup: true })` for all three rows: the door keeps each row's own cap (32 KiB rows: the runner's refusal at `>= cap` is the same outcome as before) and starts each row's program in its own group. |

DRIVER DECISION (for the controller): `MACOS_PLIST_LIMITS.nodes` 8,192 -> 65,536 in step with the text bound (the same one element per 8 characters). Reason: the measured density is about 32 characters per element, so the old count would have refused a tree of about 260 KB, making the 512 KiB cap a fiction. Bytes vs characters: the runner admits a text of fewer than 524,288 BYTES, so it has fewer characters than the reader's bound.

## 2. Every caller of the production door - none changes behaviour

Product calls of the door (grep `door(` / `.door(` over `src/`, tests excluded): `camera/relay-start.ts:112` (relay and stream probe; `stream-probe.ts`, `onvif-relay.ts` and `modules/capture-discovery/index.ts:298` reach the door only through it), `audio/usb-audio-production.ts:643, :776, :853`, `audio/usb-audio-macos.ts:542, :590` (N9), `fence/production-parts.ts:374` (Linux card listing), `:826`, `:835` (neighbour and echo rows). None names `outputCapBytes` or `processGroup`: default 64 KiB, `detached: false`, own-child signalling - byte for byte the path of before. The ONE caller that passes them is the macOS listing runner (`production-parts.ts`, `macosListingRowText`). `boot/host-checks.ts`, `local/*` use the local door, not this one.

## 3. Proofs (doubles: this runtime's `node -e` writer, `/bin/sh`, `/bin/sleep`; no device, no network, no port)

- Cap: default 200,000 bytes written -> 65,536 kept per stream; 512 KiB asked, 600,000 written -> 524,288; 1 MiB asked, 1,300,000 written -> 1,048,576; 1 byte -> 1; 300,000 under a 512 KiB cap -> 300,000 whole. Asks of 1 MiB + 1, 64 MiB, 0, -1, 1.5, NaN, Infinity, a string -> pid null, `OUTPUT_CAP_NOT_ALLOWED`, `ended` = spawnFailed.
- Group kill (`production-door.test.ts`, block "row N5b ... processGroup"): a stand-in `/bin/sh -c '/bin/sleep 30 & echo "$!"; exec /bin/sleep 30'`. WITHOUT the option: after `kill('SIGKILL')` and 300 ms the forked child is alive (1 of 1 survives) and `alive()` is still true (the door's end waits for the holder of the pipe); cleaned up in `finally`. WITH it: `ended` arrives with `SIGKILL` well under 5 s and 0 of 2 (leader, forked child) survive; an unrelated `/bin/sleep 30` in the server's group AND another door child in a group of its own are both alive afterwards (4 of 4 checks true), then ended. A child ending by itself has the same exit with and without the option; a kill after its end signals nothing.
- Through the runner (`capture-composition.test.ts`, case "A ROW THAT DOES NOT END", moved): the forked child of the stand-in is gone after the kill at the 400 ms bound - the residual SM-10 (3) pinned there by row N7 is closed. Through the real door, a 600,000-byte tree is `OUTPUT_TOO_LONG`, a 300,000-byte one (over the old 64 KiB) is the row's text, whole.
- No process left: `ps` after the runs shows no `/bin/sleep 30` and no stand-in.

## 4. The reader's cost, and the blanking cost found on the way

Property-list reader (`parseMacosPlist`), synthetic tree of the fixture's device repeated, median of 5 runs on this Mac: 128,941 characters 1.16 ms, 520,149 characters 4.55 ms (x3.9 for x4.0 the size): LINEAR. Read of the loop: one cursor `at` that only moves forward; each `leaf` is one `indexOf('<')` from the cursor; `decoded` stops at the first `;` within 5 characters or refuses; `members` is a map. The appended case holds the 512 KiB tree readable and the time ratio under 9 (quadratic would be about 16).

FOUND, NOT MINE (request line in file_requests.md, blocking for hardware): the door's `blankCredentialLocators` (credential.ts `USER_PART`) is QUADRATIC in a run of scheme characters: 16 KiB of letters 211 ms, 32 KiB 628 ms, 64 KiB 2,505 ms - already reachable at today's 64 KiB default; 512 KiB projected about 160 s. A realistic 520 KB tree costs 4.8 ms, 512 KiB of 126-letter strings 89 ms; a device-chosen base64 `<data>` run is the reachable bad case. The exact linear regex is in the request (fuzzed: 0 differences in 200,000 texts; 1 MiB in 9 ms). My door test writes `<`/`>` bytes for this reason (said in its comment).

## 5. Mutations seen RED (in memory, `.cache/task4-n5b/mutant.vitest.config.ts`, no tree file written)

| Mutation | Red |
|---|---|
| M1 default cap -> `PRODUCTION_OUTPUT_CAP_MAX_BYTES` | door "without a cap named ..." 1 failed |
| M2 asks above 1 MiB admitted (`> MAX * 64`) | door "a cap above 1 MiB ..." 1 failed |
| M3 `inOwnGroup = false` (option ignored) | door "WITH the option ..." (30,002 ms not < 5,000) and composition "A ROW THAT DOES NOT END" (timeout) - 2 failed |
| M4 `textCharacters: 65_536` (reader out of step) | plist case "row N5b: the reader's bound IS the USB tree row's cap" 1 failed |

## 6. Pins moved by delta (each with a comment naming C131 / N5b)

- `capture/__tests__/static.test.ts`: `detached: false,` -> `detached: inOwnGroup,` + `const inOwnGroup = options.processGroup === true;` (door case); the runner's door call in the row 111b (c) list and in the case "row N7" (+ `outputCapBytes: capBytes, processGroup: true`).
- `capture/adapters/__tests__/static.test.ts` (A-8): `chunk.subarray(0, capBytes - size)` + the default line `const capBytes = options.outputCapBytes ?? PRODUCTION_OUTPUT_CAP_BYTES;`. TEXT_MAKERS count (2), timer count (3), `env:` count (1) unchanged.
- `capture-composition.test.ts`: tree caps 64 KiB -> 512 KiB (:815, :816), `MACOS_LISTING_ROW_LIMITS` pin 65,536 -> 524,288, flood 70,000 -> 600,000 + the between case, the "A ROW THAT DOES NOT END" residual -> 0 survive.
- `audio/__tests__/macos-card-listing.test.ts` (the reader's tests; there is no macos-plist.test.ts): size pin 65,536 -> 524,288; the enumerator case's tree-over-bound entry built from the reader's bound (it was padded to the listing's 65,537 and now reads FOOT); one appended case (section 4).

Controller additions done in this row: C134 (N9's request line 550: SR-15 (1) admits `usb-audio-macos.ts` for `macMicPushArguments` / `macMicPrecheckArguments`, one call site each, device word still table-only, planted second sites counted 2/2) and C136 (S06's request line 556: `"from './stored-address'"` in the set-network import list, with its comment).

## 7. Checks (result lines)

- Door + plist/listing + composition unit: `Tests 142 passed | 1 skipped` with 1 failed before the enumerator pin moved; after: macos-card-listing + both static sets `Tests 1 failed | 156 passed (157)` - the one red is `capture/__tests__/static.test.ts:1780` (SR-15 (1)'s LISTING-name pin now also finds `src/capture/boot/index.ts:68, :607` `SYSTEM_LISTING_PROGRAMS` - row NB's file in flight, not N5b's). With NB's file added to that expectation IN MEMORY the case is `1 passed` (my C134 lines included).
- Composition db: `Tests 15 passed (15)` (throw-away databases, db-migrate lock).
- Real-text run (sandbox off, read-only, no device opened; `DEMS_N7_REAL_LISTING=1`): 2/2 listings ok, 328 ms and 237 ms, ONE card (6 channels, 96,000 Hz stated, no serial, port EIGHT_HEX), 1 passed over, 2 capture entries, 0 refused; operation 98 schema-valid, 1 card, 1 audit entry.
- `tsc --noEmit -p .` in apps/core-server: 9 errors, none in N5b's files: meter fields (TS2739) at `capture/__tests__/fault-lifecycle.test.ts:205`, `forwarder-advisories.test.ts:47`, `forwarder-engine.test.ts:77-78`, `fence/__tests__/development-session.db.test.ts:396-397`, `test/support/capture.ts:262`, and `capture/adapters/mic-transport.ts:88, :91` - the protocol change of row N13 (capture-protocol) in flight.
- oxlint on the 8 touched files: 0 errors, 2 warnings on lines N5b did not write (`capture-composition.test.ts:34` unused `MacosListingRow`, `macos-card-listing.test.ts:71`).

## 8. Stays unproven (hardware package)

A real listing program that forks (system_profiler forks one child; N7 measured 0 survivors 7/7 without the group) is now ended as a group - not re-measured against a hanging real program. A descendant that leaves the group itself (its own `setsid`) is outside the reach of a group kill; after the leader is reaped, a group signal is still sent while a stream is open (POSIX keeps a group ID unused while a member lives; a group emptied while an outside process holds the pipe is the residual). A Core killed with SIGKILL leaves grouped children to end by themselves (listing programs end within their seconds). The blanking cost above on a hostile USB device.
