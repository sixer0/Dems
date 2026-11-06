---
task_slug: input_av_core_adapter_plan
row: 67
milestone: M4 / WP-08
date: 2026-10-13
agent: coder-execution (batch 7, agent Z)
status: complete (on doubles; nothing is proven on a sound card)
tier: T3
---

# Row 67 - the production microphone adapter (`USB_AUDIO`), in a new file beside the stub, registered nowhere

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server`, `AD` = `CS/src/capture/adapters`, `AUD` = `AD/audio`, `IAV` = `apps/input-av/nvr` (read only: `audio.py`, `recorder.py`, `service.py:36-61`, `docs/SERAH-TERIMA.md:160-200`; nothing under `apps/input-av/data/` and no `.env` was opened).

## 1. What was built

| File | State | What it is |
|---|---|---|
| `AUD/usb-audio-production.ts` | NEW | `createUsbAudioProductionAdapter(options)`: an `AudioInputAdapter` of kind `USB_AUDIO` with `hasOpener: true`; `identifyRegisteredCard(listing, stored)` (the match); `isRegisteredAudioInput`; `guardedArguments`; the refusal vocabulary `UsbAudioRefusal` with `UsbAudioError`; the notices `UsbAudioNoticeCode` |
| `AUD/__tests__/usb-audio-production.test.ts` | NEW | 33 cases in 7 blocks: T-1 with a door double (blocks 1 to 5), T-3 and the static half (block 6), real processes through the real production door (block 7) |

Not touched: `AUD/usb-audio.ts` (the class-C stub stays the registered adapter and the loader `real.ts` still names it), `card-listing*.ts`, `alsa-config*.ts`, `local/mic-helper-args.ts`, `production-door.ts`, `mic-transport.ts`, `types.ts`, `registry.ts`, `index.ts`, every static-rule list, `capture-session/`, the worker.

Every external is handed in: the stored row (`registered(deviceId)`), the card enumerator, the configuration writer, the two program paths (helper, guard), the run directory, the timers, the production door, the program inspector, the pipe files, the level reading, the two observers.

## 2. What an `open` does, in order

| Step | What | From | Refusal |
|---|---|---|---|
| 1 | The two programs are vouched for by the path rule (`helperProgramRefusal`) | `local/helper-program.ts` | `AUDIO_PROGRAM_REFUSED`, detail `HELPER_<rule>` or `GUARD_<rule>` |
| 2 | The stored row is read and held to its shape | injected reader (`capture_audio_inputs`, `implementation/017`) | `AUDIO_INPUT_NOT_REGISTERED` |
| 3 | The cards are listed FRESH; nothing of a listing is kept | `card-listing.ts` (`implementation/064`, `155`) | `AUDIO_CARD_LISTING_FAILED` |
| 4 | The card is re-identified by its stored identity (section 3) | `identifyRegisteredCard` | `AUDIO_CARD_ABSENT`, `AUDIO_CARD_CHANGED`, `AUDIO_CARD_AMBIGUOUS`, `AUDIO_CARD_UNIDENTIFIED` |
| 5 | Facts of the live card: a guessed channel count is refused; the input number against the LIVE channel count; the one rate of the card | `sharedCaptureOfCard(card, 48000)` | `AUDIO_CARD_FACTS_UNKNOWN`; `AUDIO_INPUT_BEYOND_CARD` (`AudioInputBeyondCardError`, with the registry id); `AUDIO_CARD_RATE_UNSUPPORTED` |
| 6 | ONE configuration for the cards of every input the adapter holds, one entry per card and device, written one writer at a time | `alsa-config.ts`, the injected writer (`implementation/065`) | `AUDIO_SHARED_CAPTURE_REFUSED` |
| 7 | The named pipe `<runDir>/<sessionId>/<MIC-NN>.pcm`, by `preparePipe` with the PRODUCTION door in the place of the local one | `local/mic-pipe.ts`, `mic-transport.ts` | `AUDIO_PIPE_REFUSED` |
| 8 | The helper's vector from the Linux table (`implementation/066`): `cardIndex`, `deviceIndex`, `channelCount` of THIS listing, the registered input number, the pipe path | `linuxMicPushArguments` | `AUDIO_HELPER_ARGUMENT_REFUSED` |

`open` starts no helper. The handle states `input` (`PCM_FIFO`, the path), `transport` (`MIC_TRANSPORTS.PCM_FIFO`: 32-bit float, 48,000 Hz, mono - the worker refuses anything else), the vector (`helperArguments`) and the card facts (`card`).

`start(signal?)` (contract `AudioStreamHandle.start?`, `implementation/020`): lists the cards ONCE MORE and refuses `AUDIO_CARD_MOVED` when the card index, device index, channel count, input number, rate or format differ from the open (a card index is the number of one listing; the helper must not open whatever sits at the old index). Then both programs are vouched for again and the GUARD is started through the production door: `command` = the guard path, `args` = `[helper program, ...vector]`, `env` = `{ ALSA_CONFIG_PATH: <runDir>/alsa/dems-alsa.conf }` (the door's one closed key), no start message. It resolves when the helper has lived for the settle time (1,500 ms); it rejects with `AUDIO_HELPER_NOT_STARTED` (the door's code as the detail word), `AUDIO_HELPER_ENDED_AT_START` (detail `EXIT_<n>` or the signal) or `AUDIO_OPEN_ABORTED`. A helper that reports no sample within 8 s is stopped and told as lost with `AUDIO_NO_SAMPLE_WITHIN_BOUND`; one that ends during the session is told ONCE with `AUDIO_HELPER_EXITED` (`onLost` of the handle, `onSourceLost` of the adapter: the hook of row 68).

`close()`: the end of the guard's input first (its order to end its child), SIGTERM after 3,000 ms and SIGKILL after 2,000 more only when that was not obeyed (each escalation is a notice, `AUDIO_HELPER_SIGNALLED`); waits for the end; removes the pipe; frees the input. Twice is once. `closeAll()` is the shutdown hook; `livePids()` gives the guards for the leftover check (row 24).

`level(inputId)`: the injected telemetry reading (the worker's, as for the local adapter: the helper has no meter), at most 0 dBFS; `null` for none or a value that is no number. `precheck(inputId, signal?)`: steps 1 to 6, then ONE short open under the guard with `linuxMicPrecheckArguments` (all channels, nothing selected, nothing written, `-t 0.2`), bounded at 5,000 ms and stopped through the guard's input; answers `null` or the named refusal; holds nothing open. `enumerate()`: one listing for all registered microphones, each `present` or named with its wire cause; starts nothing. `sourceFacts(inputId)`: section 6.

Every refusal carries a code, the cause of the closed wire vocabulary it is shown as (`wireCode`, one of the five of `AudioInputErrorCode`), a registry id and a DETAIL WORD (`^[A-Z][A-Z0-9_]{0,47}$`: the short code of the step that failed). No card name, USB id, path or program output is ever in a message; the diagnostics of a helper are not read at all (no pattern of an ALSA failure text has been observed, so none is guessed).

## 3. The match: stored identity, never the card index

`identifyRegisteredCard` reads the TEXT of one listing (USB id, card id) and the device index. It reads no card index.

| Stored row | Listing | Answer |
|---|---|---|
| USB id | exactly one entry of the stored device index carries it | that card, whatever its index; `renamed` when its kernel name differs (notice `AUDIO_CARD_RENAMED`) |
| USB id | none carries it, an entry carries the stored card id | `AUDIO_CARD_CHANGED`: another card under the registered card's name |
| USB id | none carries it, none carries the name | `AUDIO_CARD_ABSENT`, also while other USB cards are connected |
| USB id | more than one carries it | `AUDIO_CARD_AMBIGUOUS` |
| no USB id (not a USB card) | one entry with the stored card id that is not USB | that card |
| no USB id | a USB card under that name | `AUDIO_CARD_CHANGED` |
| the fixed word `0000:0000` | anything | `AUDIO_CARD_UNIDENTIFIED` |

A channel count that differs from the stored one is told (`AUDIO_CARD_CHANNELS_DIFFER`) and the LIVE count opens the card; the input number is held to the live count. No path returns "a" card: the generic source of input-av (`audio.py:99-112`), which moved "Mic #1" and "Mic #2" to a swapped card without a word (`SERAH-TERIMA.md` item 15), is not ported.

**The residual (FINDING, filed in `file_requests.md`).** `capture_audio_inputs` stores no port and no serial number. Two units of ONE product cannot be told apart: two connected ones are refused as ambiguous, and one unit swapped for another unit of the same product is matched silently. AD-07 (4) ("USB id and the port path where the system offers one") is therefore closed for the USB id only; the port half needs a column and one more line in the match.

## 4. Argument origin (the row's static half)

"No value read from the database and no string of a live listing reaches an argument":

- the vector is made by the two table functions of row 66 and by nothing else; the adapter composes no argument text (no template, no join);
- of the listing, three INTEGERS reach the table: card index, device index, channel count;
- of the stored row, ONE INTEGER reaches the table: the input number, as the index of one of the table's 64 selections, held to the live channel count first. READING (driver decision DD-1): the input number is not in any listing, it is what the registration chose; the rule is read as "no TEXT of the stored row, and no number of it but the input number through the table function";
- the stored sample rate and sample bits are NOT read: the configuration is asked for the transport's 48,000 Hz, the vector is the table's fixed `pcm_s24le` / `48000`;
- the guard's vector is `[helper program, ...vector]`: a configured absolute path, then the list UNCHANGED.

Held by the test file (block 6): the member texts of the two table calls, the three `args` handed to the door, the body of `guardedArguments`, no `'alsa'`, `hw:`, `plughw` or `CARD=` in the file, and a planted-value case (a card with a marker card id, product, USB id, port and format: none of the markers is in any argument, environment value or line of the configuration).

## 5. Static-rule lists (not edited: agents Y and B are their writers in this batch)

Measured with the new file in the tree, 05:44 and 05:54 WIB: `capture/__tests__/static.test.ts`, `adapters/__tests__/static.test.ts`, `test/static/credentials.test.ts`, `local/__tests__/mic-static.test.ts` are green; the file turns NO rule red. (At 05:44 one case was red, A-2 "the injection point has no caller", for `camera/relay-start.ts` of agent Y, in flight; green at 05:54.)

| List | Entry | Needed for green |
|---|---|---|
| `adapters/__tests__/static.test.ts` (Y) | a constant of built-but-unregistered adapters with `audio/usb-audio-production`: no production file imports it, the loader does not name it; `CLASS_C` unchanged | no - held by block 6 "registered nowhere" until then |
| `test/static/credentials.test.ts` (Y) | none: the adapter imports no process module | - |
| `capture/__tests__/static.test.ts` (B), SR-1 for WP-08 | none new: the writer is row 65's entry; the adapter imports neither the file system nor the process module, and does not name the pipe-making program (G-R12's last line) | - |
| the same, SR-4 (G-R12) | one additive assertion: the two table calls with their member texts, the three `args` of the door, `guardedArguments`; the count of argument lists stays 13 | no - held by block 6 "argument origin" |

One rule of ANOTHER row's test met the file: `AUD/__tests__/card-listing.test.ts:650` ("no card is chosen by the code") searches every production file of the area, comments included, for the name of input-av's generic source. The header comment of the new file used that word; it was reworded. The rule holds for the new file from now on.

## 6. Row 71's request, served

`sourceFacts(inputId)` answers, for an OPEN input and from what its open found (no listing, no process, no file), `{ product, usbId, cardId, cardDevice, inputNumber, nativeChannels, sampleRateHz, sampleBits }`; `null` for an input that is not open. `sampleBits` is the card's native width, at most the 24 bits the helper captures (DD-6). The member is not declared on `AudioInputAdapter` (`types.ts` is not this row's); the fence finds it by name.

## 7. For row 184: what the adapter does when a session re-opens its sources after a worker restart

Facts of the adapter as built; nothing of row 184 is solved here.

1. **A handle starts once.** `start` on a handle whose helper was launched before, also one that has ended, is refused `AUDIO_INPUT_ALREADY_OPEN`. The adapter never restarts a helper by itself.
2. **An input is held by one handle.** A second `open` of a microphone whose handle is not closed is refused `AUDIO_INPUT_ALREADY_OPEN` (wire `DEVICE_BUSY`), for the same or another session.
3. **What a worker's end does to a running helper is not decided by the adapter.** The helper writes into a pipe whose reader is gone; the program then ends by itself or blocks, and the guard follows it. When it ends, the handle tells `AUDIO_HELPER_EXITED` ONCE through `onLost` / `onSourceLost`. The adapter does not learn of a worker restart in any other way. UNPROVEN with the real helper and guard (row 22 measured: with the consumer gone the FFmpeg helper ends in 0.05 to 0.11 s).
4. **The only way to feed a later worker is `close()` then `open()` then `start()`.** `close` ends guard and helper and removes the pipe; the new `open` reads the stored row and a fresh listing again (so the card is re-identified, and a card that moved or was swapped meanwhile is refused by name), writes the configuration again and makes the pipe again AT THE SAME PATH (`<runDir>/<sessionId>/<MIC-NN>.pcm` is a function of session and device), so the plan of a later worker of the same session names the same path. Measured on doubles: block 4 "the input can be opened again, for the same session", and 20 cycles of open, start, close with real processes (block 7).
5. **Cost of a re-open:** two listings (open and start; each starts the listing program once), one configuration write, one pipe, and the settle time of 1,500 ms before `start` resolves; samples between the old helper's end and the new helper's first sample do not exist. The other handles of the same card are not touched: the configuration keeps the entry of every held input and is replaced whole by rename.
6. **Order that row 184 must hold if it re-opens:** the old handle is closed BEFORE the new open (else point 2), and the pipe exists before the new worker is given its plan (as today: `open` before `supervisor.start`).

## 8. The first samples after a card is opened (SERAH-TERIMA item 13)

The adapter does NOTHING to them. The pipe carries what the card delivers from the helper's first sample: the vector is the table's (no trim filter exists in it, and adding one is a change of row 66's table and of rule G-R12), and the worker places a microphone by arrival, so the writer must not hold or cut samples (ML-4). The full-scale sample input-av saw twice (sample 6, 0.125 ms after the start, value -1.0, in the first recording after the EVO 8 was plugged in; the two sources that started 8 and 19 s later on the same shared capture were clean) would enter the evidence audio as it is.

NAMED OPEN POINT OP-1 for the hardware check `9A/H-08.7` (peak of the first 1,000 ms of S1 against the following 4,000 ms): (a) whether it occurs on the target interface; (b) whether it belongs to the first open after plug-in or to every opening of the hardware (the shared capture closes the hardware when its last reader ends); (c) whether the operator's pre-check, which IS a short open of the card that writes nothing, takes it out of the session that follows. If (a) is yes, the remedy is a decision (an open-and-discard before the session's helpers, or a trim in the table), not this row's.

## 9. Evidence

| Check | Command (from `CS`) | Result |
|---|---|---|
| The four static files with the new adapter in the tree (before its test file existed) | `npx vitest run --project unit --maxWorkers=2` on `src/capture/__tests__/static.test.ts`, `src/capture/adapters/__tests__/static.test.ts`, `test/static/credentials.test.ts`, `src/capture/adapters/local/__tests__/mic-static.test.ts` | `Test Files 1 failed \| 3 passed (4)`, `Tests 1 failed \| 96 passed (97)`; the failure is A-2 for `camera/relay-start.ts` (agent Y) |
| The row's test file, first run | the same command on `src/capture/adapters/audio/__tests__/usb-audio-production.test.ts` | `Test Files 1 passed (1)`, `Tests 33 passed (33)`, 6.67 s |
| The audio folder, the four static files, `mic-helper-args.test.ts` (after one lint fix) | the same command on those paths | `Test Files 1 failed \| 9 passed (10)`, `Tests 1 failed \| 296 passed (297)`: `card-listing.test.ts:650`, the comment word of section 5 |
| Second run after that failure: the audio folder and the four static files | the same command | `Test Files 9 passed (9)`, `Tests 246 passed (246)` |
| Typecheck | `npx tsc --noEmit` | exit 0, no output (run after the last code edit; one comment line changed after it) |
| Lint | `npx oxlint` on the two new files | first: 1 warning (a needless array copy), removed; then no output |
| Leftovers | the 20-cycle case | 20 guards and 20 helpers started, 0 alive, 0 pipes left, 0 signals needed |

The process tests ran inside the command sandbox (no port is bound; the pipe maker and the stand-in programs are short processes below the temporary directory); no heavy-host lock was taken (no worker, relay, media process or port).

Verification cell: "T-1 unit with a door double passes" - blocks 1 to 5. "No value read from the database and no string of a live listing reaches an argument (static test)" - block 6, section 4. "T-3 the adapter handed to a real registry is refused" - block 6: `CAPTURE_ADAPTER_INVALID` in `REAL_PRODUCTION` (and `CAPTURE_ADAPTER_KIND_NOT_ALLOWED` in `REAL_DEVELOPMENT`); the registry lists nothing afterwards.

Cases the delegation named: a registered input on a 2-input card and input 3 of 8 (block 1); the card re-plugged at another index, found by identity, the new index used (blocks 1, 3, 4); the card absent; another card in its place; the input beyond the card (block 2); two inputs of one card by two handles, one configuration, two helpers (block 1 on the door double, block 7 for real); close ends helper and guard, no process after 20 cycles (block 7); the pipe carries the selected channel only (block 7: the pipe is compared sample for sample with the selected channel of the generated source and found different from every other channel).

## 10. The doubles, and what stays unproven

| Double | What it is | What it proves |
|---|---|---|
| The listing | the REAL parser over fixed texts in the forms of a Linux host; a test changes the texts between calls | the match and the refusals; not what a real interface prints |
| The configuration writer | the REAL writer, below the temporary directory | the file the helper is pointed at exists with the generated text |
| The pipe | a REAL named pipe, made through the REAL production door | the transport's path and its removal |
| The door (blocks 1 to 5) | a scripted door that starts nothing | order, vectors, the stop sequence |
| The guard (block 7) | a stand-in program: starts its first argument with the rest, hands it its output and environment, ends it when its own input ends | that the adapter's stop reaches a grandchild through the input's end. NOT the guard of row 23 |
| The helper (block 7) | a stand-in that PARSES the vector option by option (an unknown option, a second value or a value of another form ends it with its own status), looks its device up in the configuration its environment names (name, shared block, channel count, rate), generates a source of as many channels as it opens, selects the channel of its filter and writes 32-bit float mono into the pipe | that the vector is self-consistent with the configuration and that the selected channel is what the pipe carries. A control case shows the stand-in refuses eight bent vectors. NOT that FFmpeg accepts the vector (review P12-F13: the container check of row 79 and T-2 of row 69) |

| Unproven | Proven by |
|---|---|
| That the pinned helper accepts the vector for the sound device layer; that `pan` selects the input that is heard | row 79 (container, option parsing); row 69 (T-2, the real helper with a generated source, the built guard, the release worker); `9A/H-08.4`, `.5`, `.6` |
| That the shared capture opens, twice on one card, at the card's native format and 48,000 Hz; the period and buffer figures against the worker's placement by arrival; audible level (the bench recordings of this scheme were silent) | `9A/H-08.1` to `.8` |
| A native 32-bit card: the helper captures 24 bits through the conversion layer of the sound library (the low 8 bits are dropped there); the transport's exactness statement covers 24 bits | `9A/H-08.2` (the format the card reports), a decision if it is 32 |
| That a card index is the same between the start's listing and the helper's own open (milliseconds), and what a real re-plug does to index and kernel name | `9A/H-07.5`, `.6`, `.8` |
| OP-1, the first samples (section 8) | `9A/H-08.7` |
| The BUILT guard of row 23: its invocation form (the adapter assumes `<guard> <program> <arguments...>`), that the child's output passes through it (the first-sample watch reads the helper's progress report there), that it ends its child on the end of its input and on SIGTERM. A guard killed by SIGKILL can leave its helper behind: that case is row 24's leftover check | row 25 (E-7 final), row 69; request line to agent W |
| What a real helper does when the worker's end closes the pipe (section 7 point 3) | row 69 / row 184 |
| Loss, reconnect and timing against the picture | row 68 (hot-plug); `9A/H-18`, `9A/H-19` (claps) |
| The program paths under the service account against the path rule; the run directory on the target's file system | `9A/H-08`; the host profile |

## 11. Driver decisions (for the controller to confirm)

| # | Decision | Why the conservative one |
|---|---|---|
| DD-1 | The registered input number reaches the table function; no other member of the stored row reaches anything (section 4) | The input number exists nowhere else; it is an integer held to the live channel count and to the table's 64 words |
| DD-2 | `start` lists the cards again and refuses `AUDIO_CARD_MOVED` instead of re-building the vector for the new index | "Never record from another device silently"; a moved card needs a new open, which re-writes the configuration too. Cost: one more listing per start |
| DD-3 | A card that does not offer 48,000 Hz is refused (`AUDIO_CARD_RATE_UNSUPPORTED`) | Otherwise the sound library resamples evidence audio in an untested layer. The stored `sample_rate` is not read |
| DD-4 | Two connected cards with the stored USB id are refused; an unreadable stored USB id is refused; a card found under another kernel name is used and told | Section 3; the stored row has no port and no serial |
| DD-5 | A channel count that differs from the stored one is a notice, not a refusal, while the input exists on the live card | The row's cell: the vector is built from the live listing; the refusal it names is the input beyond the card |
| DD-6 | `sourceFacts.sampleBits` = min(native width, 24); `nativeChannels` = the live count | What reaches the pipe; the stored bits are not read |
| DD-7 | The pipe is made through the PRODUCTION door (`preparePipe` of `local/` with the door handed in); the path rule, the pipe files and the delivery watch of `local/` are reused | Rule G-R8 admits three process starters; the local door is development code and is not reused. No second pipe maker is written |
| DD-8 | The guard is REQUIRED (`guardProgram` is no optional member) and is always stopped by the end of its input first; the pre-check runs under it too | Row 22: the helper survives its parent without a guard |
| DD-9 | The helper's diagnostics are not classified into `PERMISSION_DENIED` / `DEVICE_BUSY` | No such text has been observed for the sound device layer; an unknown failure is not guessed into another code |
| DD-10 | Twenty refusal codes of the adapter's own, each mapped to one of the five wire causes; four notice codes. None is added to a shared vocabulary | The wire vocabulary is closed (C3 op 97); rows 68 / 85 decide what is audited or shown |

## 12. Identifiers

Closed on doubles: WP-08 (opener part); S3-2 (refusal of an input beyond the card at the open), S3-4 (the configuration handed over by the one environment key), S3-5 (the Linux vector under the guard); addendum 4.1 d (`start`), 4.2 "arguments of the helper", 6.3 T-1 and T-3; AD-07 (2); AD-07 (4) for the USB id (the port half is the finding of section 3); AD-09 (3) for the helper (stopped and waited for; 0 left after 20 cycles); P12-F13 as far as a stand-in goes. Open: `9A/H-07`, `9A/H-08`, rows 69 and 79, OP-1, row 184.

---
*Generated: 2026-10-13 05:58 WIB*
