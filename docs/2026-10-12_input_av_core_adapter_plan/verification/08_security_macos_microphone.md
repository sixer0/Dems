---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
row: M2 (track D)
date: 2026-10-13
agent: security-review
type: security review of a design (no code exists yet)
narrative_tier: 1
reviewed: masterplan/06_design_macos_microphone.md (production microphone path on macOS, kind USB_AUDIO)
decisions_read: U12 A1, U15, U16, U18, U21, U22, U23, P11, C56, C63, C89, C90, C92, C94 (decisions/decisions.md:24, :69-75, :90, :98, :123-132)
overall: CAUTION
fail_count: 0
caution_count: 21
pass_count: 7
verdict_final: no - provisional until the measurement row MM (section 9) has run and this review has an addendum on its result
sr_14: TIGHTENED (section 5)
devices_opened: none
source_changed: none
status: complete
---

# Security review: design of the macOS production microphone path

## 1. Verdict

**Overall: CAUTION. FAIL: 0. Nothing in this scope stops for the user.** The design is honest about what it does not know, keeps the identity rule of C56 by the same function, and refuses on doubt. It is accepted as the base for the build rows under 28 requirements (SM-01 to SM-28: 7 PASS, 21 CAUTION, 0 FAIL), of which 5 are gates.

**The verdict is PROVISIONAL.** Five ratings rest on what a helper does when it opens a device, which no file and no listing proves. Decision U23 (4) now allows an agent to open the user's USB interface, so these points are no longer "the user's click only": they are to be MEASURED before the rows that depend on them are cut (section 9). Three results of that measurement would turn a CAUTION into a FAIL; they are named in section 2.

| # | Area | Rating | The one thing that matters most |
|---|---|---|---|
| 1 | Identity, and the step from identity to the index | CAUTION (2 gates) | The reader of the USB tree in its TEXT form can be forged by a device's own product string (SM-02). The index is only as good as the check AFTER the open (SM-04) |
| 2 | Argument origin, SR-14 | CAUTION | SR-14 TIGHTENED, not reversed (section 5) |
| 3 | The three listing programs | CAUTION | A killed `system_profiler` can leave a child; the watch starts three programs every 5 s (SM-10) |
| 4 | Permission | CAUTION (gate) | A denied permission may deliver digital silence. No session may be called recording before one non-zero sample was seen (SM-14). The grant belongs to the LAUNCHING APPLICATION and covers every microphone, the built-in one included (SM-15) |
| 5 | Sample rate | CAUTION (gate) | The helper's output line holds `-ar 48000`: it RESAMPLES by itself. The listing's rate is not a control; the helper's own statement after the open is (SM-16). As designed, U23 (2) is not met |
| 6 | Exclusivity | CAUTION | macOS gives none. The evidence may claim what was delivered, not that nothing else touched the device (SM-17) |
| 7 | What the evidence states | CAUTION | Capture layer, bench form, and that PRIMARY and STANDBY are one device (SM-18, SM-19) |
| 8 | Weakening of a Linux rule; marking | CAUTION | The macOS path must be marked in code and in the evidence as the bench form (SM-20) |
| 9 | Test plan | CAUTION | Fixture cases are missing for exactly the findings above (SM-25); the measurement row (SM-26) |

Why no FAIL: no code exists; every weakness has a requirement that fits a row the design already has; where the tools cannot give certainty (the index, the permission) the requirement is a refusal or a statement in the evidence, never a silent acceptance.

## 2. Rank-1 list: settled before the FIRST line of code

| Rank | What | Who | Gate for |
|---|---|---|---|
| 1 | **Row MM, the bounded measurement** (section 9), and a short addendum of this review on its result. Minimum before any build row: MM-1 (the exact text of the device list), MM-2 (`none:<n>` opens the indexed device), MM-3 (what the helper states about the stream it opened) | controller cuts; an agent runs; the user is at the Mac for the system's question | M3, M6 |
| 2 | **SM-02**: the form of the USB tree row is decided (property-list form, or the text form with the whole-listing refusal). Until then the row L1 of SR-14 (3) has no final words | controller, on MM-0 (no device needed) | M3, M4 |
| 3 | **SR-14 in the tightened words of section 5**, with a number, confirmed provisionally by the controller as SR-10 to SR-12 were | controller | M3 |
| 4 | **SM-14 and SM-16 adopted as gates** in the blueprint: the positive check (non-zero sample) and the rate and channel statement of the helper stand between "the helper lives" and "the microphone records" | task-architect | M6 |
| 5 | **The user is told, in so many words** (SM-15): the microphone grant is given to the application that hosts the shell, it is standing, and it covers the built-in microphone too. With U23 (4) this now includes the application that hosts the agents | controller | row MM |
| 6 | **SM-20**: where the fact "bench form, not the hardened form" lives in code and in the evidence (row P1 is in flight in those files) | controller with row P1 | M8 |

**What would turn a CAUTION into a FAIL** (each is a stop for the user):
- MM-2 shows the pinned program does not open the indexed device, and neither S3 (`-audio_device_index`) does: then only a device NAME can select, AD-07 (2) would be weakened, and that is the user's ruling, not a row's (design 4.1 says the same).
- MM-3 shows the helper states nothing usable about the stream it opened (no rate, no channel count): then nothing after the open can tell a 96,000 Hz device, or another device at the same index, from the registered one. SM-04 and SM-16 would have no control.
- A build that calls a session "recording" on a helper that merely stayed alive (SM-14 skipped).

## 0. Frame (5W1H), method, limits

| | |
|---|---|
| **What** | A rating of the DESIGN `masterplan/06_design_macos_microphone.md` against nine questions of the delegation, as requirements SM-01 to SM-28, each with the row that must meet it; a ruling on the proposed amendment SR-14; an assessment of decision U23 |
| **Why** | U22 (1): design, then its security review, then build rows; no code before the review (`decisions/decisions.md:129`). C13 / C15 precedent: a FAIL stops the work for the user |
| **Who** | Reviewer: security-review. Next reader: the controller and the task-architect. Decision owner: the user |
| **When** | 2026-10-13, written at 16:24 to 16:28 host time (`date`); working tree of branch `task4/input-av-core-port`, uncommitted |
| **Where** | `apps/core-server/src` (`CS`), read-only; this task folder |
| **How** | Reading; four read-only commands to check the FORM of output (section 12). No audio or video device was opened, listed through the capture program, or recorded from. `ffmpeg -f avfoundation -list_devices` was NOT run by this review. No device name, serial number or location value was copied: the commands printed key names, value types and counts |

**Mid-task change.** The controller's broadcast carried decision U23; it was read at `decisions/decisions.md:132` before it was used. The three "recommendations" asked for are therefore given as assessments of decisions taken (section 8).

**Read in full:** the design; `delegation_progress/row_m1.md`; `verification/02_security.md`; `verification/04_security_addendum.md`; the decision rows named in the header; `CS/capture/adapters/audio/usb-audio-production.ts`, `card-listing.ts`; `CS/capture/adapters/local/mic-helper-args.ts`, `device-list.ts`, `mic-helper.ts`, `helper-program.ts`; `CS/capture/adapters/production-door.ts`. **In part:** `CS/capture/__tests__/static.test.ts:990-1299`; `CS/capture/fence/production-parts.ts:255-420`, `sources.ts:130-235`; `CS/capture/boot/host-checks.ts:355-407`; `CS/capture/adapters/audio/mic-loss.ts:120-175`; `apps/capture-worker/src/audio.c` (search hits for the silence warning only). **NOT read:** the implementation records 064, 067, 068, 079b, 085c, 155, 190, 199, 200 (the code they describe was read instead; nothing here cites them); `mic-adapter.ts`, `mic-pipe.ts`, `card-listing-reader.ts`, `alsa-config*.ts`; the registrar module; the web console. A statement about those is not made here.

**Hypotheses.** A statement about how AVFoundation, the privacy system (TCC), CoreAudio or the capture program behave is the reviewer's knowledge and was not run. Each is marked HM-n and names what settles it. Every requirement is written to hold either way.

| Id | Hypothesis | Settled by |
|---|---|---|
| HM-1 | The input layer reads the audio part with a decimal scan: `none:3` is index 3, and so is `none:3abc`; `-audio_device_index n` sets the same value. The list and the open use the same system call, so their order is the same within one moment | MM-2 |
| HM-2 | A process without the microphone grant may be handed buffers of exact digital zero (the system does this to clients of the audio layer), with exit code 0 | MH-03 (the user's; an agent cannot switch a grant off) |
| HM-3 | The system attributes the access to the "responsible" process: the application that hosts the terminal or launcher. The grant is per application, standing, and not per device | MM-4 with the user at the Mac |
| HM-4 | The input layer fixes rate and channel count at the first buffer. If the device's rate is changed afterwards by another program, the helper keeps declaring the first rate: the audio would then be recorded at a wrong speed, or the stream breaks | MH-13 (the user changes the rate; an agent does not change a device setting) |
| HM-5 | `ioreg` prints strings without escaping (the design says so itself, 2.3): a product string that holds a quote and a line break writes lines of its own | MM-0 on a fixture; the requirement SM-02 does not depend on it |
| HM-6 | `system_profiler` does its work in a child process. A kill of the parent at its bound may leave the child | MM-0 (process table after a killed run of a stand-in that forks) |
| HM-7 | A local audio driver (a virtual device) states its own name and its own transport word; it can state "USB" | not settled here; stated as residual in SM-03 |

## 3. Question 1 - IDENTITY, and the step to the index

### 3.1 Is "USB id + serial where stated + location id" as strict as C56?

**Yes, by construction, on one condition.** The match is the unchanged `identifyRegisteredCard` (`usb-audio-production.ts:330-362`): serial equal wins on any port; without a stored serial the unit on the stored port; same model elsewhere is `CARD_CHANGED`; neither stored is `CARD_UNIDENTIFIED`. The macOS reader only has to deliver the same members. Checked against the code: `usb_<8 hex>` passes the card id rule (letters, digits, underscore, 1 to 32, `card-listing.ts:138`); eight hex digits pass the port rule (`:84`); `vvvv:pppp` from two integers passes the USB id rule.

The condition is that the members are TRUE. On Linux the port path is the kernel's own text in a file the device cannot write. On macOS it is read out of a program's text in which the device's own strings stand unescaped. That is SM-02.

**SM-01 (PASS). The identity members and the unchanged match.** Row M4. The build must: (a) write `usbId`, `usbPort` and `cardId` from INTEGERS only, as the design says; (b) never build a card with `usb: false` or `usbId: null` - the branch of the match for a card that is not USB (`:333-337`) finds a card by its card id alone and must be unreachable on `darwin`; a test feeds the macOS enumerator every fixture and asserts `usb === true` and a USB id on every card; (c) a location of 0, or one that is not exactly the header's, refuses the block; (d) state in the README the limit of C56 unchanged (two serial-less units swapped on one socket) and that the location's stability across a reboot is unproven (MH-09).

**SM-02 (CAUTION, GATE, rank 1). The reader of the USB tree must not be forgeable by a device's strings.** Row M4, with M3 for the row's words.
- Finding. The design reads `ioreg ... -l -w 0` as text, line by line, and says a forged property line "can then only spoil its own block" (design 2.3). That is not so. A product string of the form `X"`, line break, `+-o Y@<hex>  <class IOUSBHostDevice ...>`, line break, further lines, writes a NEW HEADER at column 0. Everything the real device prints after its product string then belongs to a block whose location the DEVICE chose; the "key twice" rule does not see it when the real `locationID` line stood before the string. A USB string descriptor holds up to 126 characters, enough for a header and two properties, and a device has three strings.
- Risk. USB id, serial and product are the device's own claims on every platform; the PORT is the one member a hostile or faulty device cannot choose. With a forged header a unit on another socket states the registered socket. That is exactly the case C56 forbids ("a same-model card elsewhere is NOT a match"), re-opened for a device that writes its own descriptor. The actor needs a crafted USB device in the room; the harm is a recording attributed to the registered card.
- Measured in this review (form only, section 12): the property-list form of the same program (`-a`) is typed and escaped - integers are integers, a string is one element whatever it holds; 19,491 bytes for 4 devices, 0.02 s. TWO limits were also measured: at depth 2 that form did NOT carry the interface class of the children on this Mac (0 of the 3 audio interfaces the text form shows), and the program printed nothing and ended with status 1 inside a command sandbox ("can't open file").
- Requirement. (1) The row L1 is the property-list form, read by a strict reader (no entity, no external reference, a size check before the parse, a closed key list, integer types asserted); the build row finds the fixed argument list that carries what is needed and measures its size against the 64 KiB cap with a hub of many devices. (2) If the interface class cannot be had in that form within the cap, "is an audio device" rests on L2's transport word and the name tie, and the design says so; the class is then not claimed. (3) If the text form is kept for any reason, ONE structural doubt refuses the WHOLE listing (not the block): a header count that differs from the count of `locationID` values at device depth, two blocks with one location, a quoted value that does not end its line, a column-0 header whose class part is not the fixed form. (4) In either form: a location stated by two blocks refuses both. (5) Fixtures: the forged header above; a forged header that states the location of another connected unit; a forged child with interface class 1.

### 3.2 From the identity to `none:<n>`

The capture program takes an index or a name prefix and prints neither an identifier nor a serial (design M3, M4). So the opened device is bound to the registered identity by three links: L1 to L2 by name, L2 to L3 by name, L3's index to the helper's own enumeration by position. Each link gets a requirement.

**SM-03 (CAUTION). The name tie is a ONE-TO-ONE map of the whole input list, not uniqueness of one name.** Row M4.
- The design's three rules ask that the device's name is unique in each list. They do not ask that the lists agree about everything else. L2 comes from the audio layer, L3 from the capture layer: if L3 holds an entry L2 does not (or the reverse), the position numbers of L3 are not explained by anything the Core read, and a hidden entry is exactly what shifts an index.
- Requirement. (1) The input items of L2 (channel count 1 or more) and the audio entries of L3 must be the same multiset of names, compared as exact text; else EVERY device of the listing is undecided, with a closed reason word (`LISTS_DISAGREE`). (2) The tied name passes the NAME rule AND holds neither `://` nor `@`: the production door blanks the user part of anything that looks like a locator before the reader sees the text (`production-door.ts:184`), so such a name is not the text the program printed; refuse it, do not compare it. (3) A name is compared, never trimmed, folded or cut. (4) Never registrable as `USB_AUDIO`, each with a fixture: an item whose transport word is anything but the one USB word (built-in, virtual, aggregate, Bluetooth, AirPlay, an unknown word, a missing word); an item of USB transport with no L1 block of that name; an L1 block with no item. (5) A built-in input, an aggregate device or a virtual device that carries the name of the USB unit makes the unit undecided (the design's rule 2 - confirmed; fixture for each). (6) Residual, stated in the README: a locally installed audio driver chooses its own name and transport word (HM-7). If the real unit's audio device is absent and such a driver presents one under its name with the USB word, the tie holds to the wrong device. Installing such a driver needs the administrator's right on this Mac; the control is the host, not the Core.

**SM-04 (CAUTION, GATE). After the open, the helper's OWN statement is checked, and the whole tie is listed again.** Rows M3 (literals), M6.
- The race that remains. The helper enumerates the devices itself when it opens. Between the Core's last listing and that moment the list can change without anyone touching the Mac: a wireless headset connects, a phone offers its microphone, an application creates an aggregate device. The window is the helper's start time. The design's third listing compares L3 before and after and is the right idea. Three gaps: it compares L3 only; nothing the helper itself says is read (the push row runs at log level `warning`, which hides the line that describes the opened stream); and it does not say that "recording" waits for it.
- Requirement. (1) The index is taken from the listing made at `start`, immediately before the door; the listing of `open` only decides whether to go on. (2) The helper's first output is read for what it states about the stream it opened: the sample rate and the channel count. Both must equal the listing's (48,000; the count of L2), else the helper is stopped and the start fails `AUDIO_CARD_MOVED`. This needs the stream line, so a log level literal of its own in the macOS rows (SR-14, section 5); the line is read by ONE anchored pattern for two integers, from the bounded diagnostics, and no other text of it is kept or logged. If MM-3 shows the pinned program prints no such line, see section 2. (3) The third listing is the FULL listing (L1, L2, L3): the same ordered L3 list, the same identity, the same tie, the same rate and count. (4) A microphone is reported open to the session only after (2), (3) and SM-14 hold; until then the handle is "starting". (5) What the channel count is worth, stated: it tells the registered interface from a device with another count (the built-in microphone has 1 input on this Mac, the interface 6: with input 2 or higher registered, a helper that opened the built-in microphone fails at the selection; with input 1 it would not - so the count check of (2) is what protects the built-in microphone, and it is mandatory, not optional). It does not tell two devices of equal count apart. (6) Residual, stated in the README and in SM-18's evidence statement: a device that takes the index inside the helper's start and leaves again before the third listing, with the same channel count and at 48,000 Hz, is not seen. The Linux path has a like window (the kernel can reuse a card index between the listing of `start` and the open) and no third listing; this is not weaker than Linux, it is unproven in a different place.

**SM-05 (PASS). Two same-model devices: both refused while both are connected.** Row M4. Stricter than Linux in what it refuses; a functional limit, told to the user (design Q6). The build must: refuse both with `NAME_SHARED`; answer `AUDIO_CARD_AMBIGUOUS` (not `ABSENT`) for a registered input in that state; a fixture with one unit with and one without a serial (the serial does NOT rescue the tie, because the index is tied by name).

**SM-06 (CAUTION). The loss watch must not stay silent on an undecided or unreadable macOS listing.** Rows M6, M7.
- `mic-loss.ts` raises nothing when a listing cannot be read or the card is undecided (design F15; `MIC_LOSS_LISTING_FAILED`, `MIC_LOSS_CARD_UNDECIDED`). On Linux a broken listing is rare. On macOS it is one of three programs, one of which answers an EMPTY list without an error when the process is confined (M9, confirmed in section 12), and "undecided" is a normal state (a headset connects).
- Requirement. For a microphone whose handle is HELD: a listing that is unreadable, disagrees (SM-03) or leaves the device undecided for two passes in a row raises a named fault on that microphone; it does not stop the helper by itself (the audio may be fine), but the session's record states the interval in which the device could not be confirmed. The stall bound of design section 7 is accepted as designed (a helper whose progress stops for 5,000 ms after its first sample is stopped, `AUDIO_HELPER_EXITED` / `STALLED`).

## 4. Question 2 - ARGUMENT ORIGIN (requirements; the amendment's words are in section 5)

**SM-07 (CAUTION). SR-14 is TIGHTENED.** Row M3. See section 5 for the words. Confirmed in substance: no text of a listing, the database or the configuration reaches an argument; AD-07 (2) keeps its words on both platforms. S2 (the device NAME as the selector) stays forbidden without a ruling of the user that names AD-07 (2).

**SM-08 (CAUTION). The static rule gets a third mode, not a wider second one.** Rows M3, M5 (the pins are served by the list's owner, never guessed - C63).
- `violations(args, linux)` (`static.test.ts:1153`) knows two kinds of list. The macOS production lists must be a kind of their own: (a) in a `darwin` production list the only argument after `-i` is one of the 32 words `none:0` to `none:31`; `none:<name>` (which the development lists admit as a computed value, `:1138`) is a violation there, and `none:<n>` is a violation in every development and Linux list; (b) the 64 selections are admitted after `-af`, once, as in SR-4 (2); (c) the formats of such a list are `avfoundation`, `f32le`, `null` and nothing else - not `lavfi`, not `wav`, not `alsa`; (d) no list of the table holds `-audio_device_index`, `-video_device_index`, `-list_devices` (the list row is the existing one, in its own file) or the word `default`; (e) controls, each seen by the rule: a name in the place of the index, index 32, `none:01`, `none:-1`, `none:1x`, `0:none` (a VIDEO index: the camera of this Mac), a second bar argument, a selection in the pre-check that is not of the 64, a fourth argument in a listing row, a listing program from another file.
- At the ONE caller (the macOS adapter), as SR-4 is held at the Linux adapter (`:1250-1274`): each table function is called once; its members are the index of the located card of THIS listing, the stored input number, the pipe, the registry id.

**SM-09 (PASS). The filter string `pan=mono|c0=c<k>` as an argument assembled from a closed value.** Row M3. It is one of 64 fixed words taken by a whole number 0 to 63 (`linuxChannelSelection`, `mic-helper-args.ts:247-250`); it selects and never mixes; it is the only argument with a bar. Reuse the SAME function (no twin: two functions are two things to pin). The build must refuse k at or above the LIVE channel count before any argument is made (`AUDIO_INPUT_BEYOND_CARD`), as today, and after the open hold the count to the helper's statement (SM-04 (2)): the selection is only right if the stream has the channels the listing said.

## 5. The named amendment: SR-14, TIGHTENED

Confirmed: the shape (three places, additive, AD-07 (2) kept). Tightened in six points; reversed in none. Proposed words for the controller (the number is the controller's):

> NAMED AMENDMENT SR-14. Rule G-R12 as amended by SR-4 and SR-12 gains the places below, all for the production microphone of kind `USB_AUDIO` on `darwin`, in a kind of list of its own (neither a development list nor a Linux list), and loses none.
> (1) A list of the macOS production microphone table holds, directly after `-i` and once, ONE device argument of the CLOSED SET of 32 words `none:0` to `none:31`: the word `none:`, then the decimal form of one whole number 0 to 31 without sign and without a leading zero, made by ONE table function that takes that one number and nothing else. The number is the audio index of the device list read for THIS START, of a device whose tie held in that same listing. The video part is the literal `none` always. No name, product, USB id, serial, location, card id or any other text of a listing, of the database or of the configuration forms any part of it. A device named by text is refused by the rule in every production list.
> (2) A list of that table holds, directly after `-af` and at most once, ONE channel selection of the 64 of SR-4 (2), made by the SAME table function from one whole number 0 to 63 that is below the live channel count. It is the only argument of the list that holds a vertical bar. No other filter text exists in the table.
> (3) The formats of such a list are `avfoundation`, `f32le` and `null`. The table holds no option that selects a device by another way (`-audio_device_index`, `-video_device_index`), no `default`, and no log level but the two literals it names.
> (4) The listing of USB audio devices on `darwin` is THREE FIXED ROWS WITHOUT A PARAMETER: [the USB tree row in the form SM-02 settles, the program the absolute literal `/usr/sbin/ioreg`]; `/usr/sbin/system_profiler SPAudioDataType -json`; and the audio helper program of the configuration with the existing device-list row, unchanged. The first two programs are absolute literals named by the table file alone. Each row is handed to the production door unchanged by its ONE caller in the fence, with an empty environment and no start message, on `darwin` only, and is killed at its own bound (5,000 ms, 10,000 ms, 5,000 ms).
> (5) The pre-check of that table is a list of the table too: it carries the device argument of (1) and the selection of (2) as its only computed values, and what it writes is read by the Core in memory, within a bound, and stored nowhere.
> Kept, unchanged: every other sentence of G-R12, SR-4 and SR-12; the two files that may name `-list_devices` and `avfoundation`; AD-07 (2) in its words on either platform.

What changed against the design's words, and why:

| # | Design | Tightened to | Reason |
|---|---|---|---|
| a | "one integer 0 to 31" | a closed set of 32 words, canonical decimal | HM-1: the program reads a leading number, so `none:1x` and `none:01` would be accepted by it; the rule must not admit them |
| b | "the device list read for this open" | "for this START", tie held in the same listing | the open and the start are two moments (SM-04 (1)) |
| c | a Linux-like admission | a third kind of list | else `none:<name>` of the development lists stays admissible (SM-08 (a)) |
| d | no word on formats and other selectors | (3) | so that S3 cannot enter by a later edit without an amendment |
| e | the row L1 as text, depth 2 | the form SM-02 settles | the forged header |
| f | "if adopted, the row's extra literal is added" (design section 5) | (5) the pre-check row is named now | SM-14 makes it mandatory |

If MM-2 fails for S1 and S3 is taken, (1) and (3) are re-written by a new amendment; that is not a row's decision.

## 6. Question 3 - the three listing programs through the production door

**SM-10 (CAUTION). Bounds, exits, descendants, load.** Rows M5, M6.
1. BOTH streams of every listing program are held to the cap, and the "wrote less than the cap" test is made on the stream that is READ: standard output for L1 and L2, the diagnostics for L3. Today's runner tests the output stream only (`production-parts.ts:361`).
2. Exit rules per row, closed: L1 and L2 must end by themselves with exit code 0. L3 ends with a non-zero code by design; for it the rule is "ended by itself, not by a signal, and the section line of the audio devices is present exactly once"; without that line the list is unreadable, never empty.
3. A program killed at its bound leaves NO descendant (HM-6). `system_profiler` is expected to work through a child; the build row measures it with a stand-in that forks and hangs, and either starts L2 under the guard or kills by a means that is shown to reap the child. Counted like E-7: 0 surviving children.
4. The listing is single-flight per Core and spaced (AD-07 (3), `04_security_addendum.md:264`): a search, an open, a start and a watch pass that fall together share ONE listing in flight; none queues a second. Design section 7 counts three listings of three programs per start per microphone, and the watch adds three programs every 5,000 ms for the whole session: the build row measures program starts per minute during a session with two microphones and states the figure; above a stated limit the watch reads L1 alone for "present" (the design's own fallback, section 7) and the full listing at a longer interval.
5. A hung `system_profiler` at BOOT: the boot never waits for a listing. It checks the path rule of the three programs and states the permission as not known; it does not fail on a listing. A hung one in a SEARCH: the operation answers the named refusal within 10,000 ms plus the kill; in an OPEN or START: `AUDIO_CARD_LISTING_FAILED` with the reason word, the session start is refused, nothing waits longer.
6. The helper program is vouched for by the path rule before EVERY start of L3, as before every helper start (`usb-audio-production.ts:573-578`).

**SM-11 (CAUTION). Strict parsing of the system's JSON.** Row M4.
The design's reader (2.3) is right in shape. The build must add: the byte size is checked before the JSON reader runs; the top is exactly one member, a list of exactly one object, with `_items` a list of at most 32; of an item only the four members are read and each is asserted by TYPE - a channel count or a rate that is not an integer (a float, a string) makes that item unreadable, never rounded; a name that is no string, or two items that are equal in name, are handled by SM-03; an unknown or missing transport word is "not USB". `_items` empty or absent while L1 shows an audio device is the confined case (SM-13), not "no input". Confirmed in section 12: the four members exist with the types the design states.

**SM-12 (CAUTION). Device-chosen text: AD-06 / AD-07 (1) on three new sources.** Rows M4, M6.
1. Every string of the three texts leaves the readers through `cardListingText` (design 2.3 - confirmed), the manufacturer and source members of L2 are never read.
2. No text of a listing is ever a part of a log line, an audit detail, an error message or a detail word. The "undecided" statement carries the USB id, the location and the serial AFTER the rule, and a reason of the closed set (`NAME_SHARED`, `NO_SYSTEM_INPUT`, `NO_CAPTURE_ENTRY`, `LISTS_DISAGREE`, `NAME_NOT_TIEABLE`); never the name that was shared.
3. The diagnostics of L3 and of the helper are the program's free text and hold device names: they are parsed and dropped; nothing of them is kept on a handle, an error or a report.
4. Check, as AD-06 (5): fixtures whose names hold a line break, a quote, a tag mark, a bidirectional mark, a non-ASCII letter, 65 and 300 characters, a locator with a user part, the words `none`, `default`, a leading digit. For each: 0 occurrences of the fixture text in the log sink, the audit table, the device rows and the session rows; the card is listed with the fixed word or not listed; the tie is refused.

**SM-13 (CAUTION). "Empty is not none", made a named state.** Rows M4, M8.
Confirmed by measurement (section 12): inside a command sandbox `system_profiler` answers an empty list with exit code 0 in 0.15 s, and the property-list form of `ioreg` fails. The build must: answer a closed reason (`NO_SYSTEM_INPUT`) for every USB audio device of L1 without an L2 item, never "no card"; make the search screen's count of skipped entries non-zero in that case; state in the boot's entry whether the first listing answered, as a fact. A Core started under a launcher that confines it must be seen as confined, not as a room without microphones.

## 7. Questions 4 to 8

### 7.1 Permission

**SM-14 (CAUTION, GATE). A positive check stands before "recording".** Rows M3 (the pre-check row), M6.
- The worst case is the design's third form (its section 5): the open succeeds, buffers of exact zero arrive, the helper lives, the progress advances, and the Core seals a silent track as the record of a room (HM-2). Nothing in today's path refuses it: the worker's silence warning is a warning by rule and never a switch (`apps/capture-worker/src/audio.c:36`), and the Linux pre-check passes on exit code 0 alone (`usb-audio-production.ts:890`).
- The design proposes a silence statement in the pre-check "to accept or strike". **ACCEPTED, and made a gate, in this form:**
  1. THE PRE-CHECK MUST SHOW, all four: the helper opened the indexed device and ended by itself within its bound; it stated 48,000 Hz and the listing's channel count (SM-04 (2)); at least ONE sample of the SELECTED input differs from zero within the window; the third listing holds. Exact zero throughout is the refusal `AUDIO_HELPER_ENDED_AT_START` with the detail `INPUT_SILENT`, and the pre-check item is BLOCKING. The reason for "exactly zero" and not a level: a converter in a quiet room does not deliver exact zeros, so a quiet room passes; a denied grant, a system mute and an input switched off deliver exact zeros, and all three must stop a session.
  2. The samples of the pre-check are read by the Core in memory (the progress and output streams of the door), counted, and dropped: no file, no pipe left behind, no level value in a log; the answer is a code.
  3. AT A SESSION START the same holds for each microphone before it is reported open: the first non-zero sample within the first-sample bound, counted from the helper's delivery; without it the handle fails like a helper that delivered no sample (`AUDIO_NO_SAMPLE_WITHIN_BOUND`, detail `INPUT_SILENT`). Where the count is made (the adapter from a tap, or the worker's first level frame) is the build's choice, with this rule: a microphone whose level is null or exactly minus infinity since its first sample is not "recording".
  4. DURING a session a run of exact zeros longer than the worker's silence duration on a `darwin` production microphone is a FAULT of that microphone (the existing silent-microphone warning raised to a fault for this path), stated with its interval in the session's record. It does not end the video.
  5. `PERMISSION_DENIED` of the wire vocabulary is used only when MH-03 has given a text or a status that proves a denial; until then silence is `OPEN_FAILED` with `INPUT_SILENT` (the design's reasoning - confirmed).

**SM-15 (CAUTION). Who holds the grant, and who can therefore record.** Rows M8, M10.
- HM-3. The system asks once, names the application at the top of the chain, and remembers the answer for that application. Consequences the user must be told in these words (rank 5):
  1. Core started from a terminal: the TERMINAL APPLICATION holds the grant. Every program ever started from that terminal application can then open every microphone of the Mac, the built-in one included, without a further question. The grant is not per device and not per program.
  2. Core started by a per-user launcher: the program the launcher starts is named; that is the narrower form and the recommended one before a real installation. Core started with no user session (a system service): nobody can be asked; the open is refused or silent - SM-14 catches it.
  3. With U23 (4): the first open made by an agent puts the question to the application that hosts the agent's shell. The user's Allow there is a STANDING grant to that application for every microphone. Rule D163 for the built-in microphone is from then on kept by the agents' discipline and by SM-27, not by the operating system. Recommendation: the user switches that grant off again in System Settings when row MM closes; an agent does not change a privacy setting.
- The build must: state `microphonePermission: NOT_KNOWN` in the boot's entry on `darwin` (design section 8 - confirmed; a fact, not a pass); never read the system's privacy database; state in the README how the Core is to be started and that changing the launching application means a new question.

### 7.2 The sample rate

**SM-16 (CAUTION, GATE). 48,000 Hz is checked by the Core from the helper's own statement, not only from a listing; any other rate refuses; nothing resamples without a word.** Rows M3, M6.
- Finding. The design says "the listing must state 48,000 ... nothing between the device and the pipe may resample without a word" (4.2). But the output line it reuses unchanged holds `-ar 48000` (`mic-helper-args.ts:73`): the helper resamples whatever the device delivers, silently, by itself. On Linux the input is ASKED for 48,000 (`-sample_rate 48000`, `:221`) through a shared capture generated at that rate; the macOS input layer has no such option (design M3). So on macOS the only control in the design is a number in a listing made up to seconds earlier by another program. Any process of the user can change a device's rate at any time. As designed, U23 (2) ("no silent resampling in the evidence path") is NOT met.
- Requirement.
  1. WHO checks, WHEN: the adapter - at the open and at the start from L2 (the design's rule); AFTER THE OPEN from the helper's stated stream (SM-04 (2)): a rate other than 48,000 stops the helper before a microphone is reported open, `AUDIO_CARD_RATE_UNSUPPORTED`; at EVERY WATCH PASS from L2 for a held microphone.
  2. A rate that changes DURING a session: the watch sees it within one interval; the helper of that microphone is stopped (`AUDIO_HELPER_EXITED`, detail `RATE_CHANGED`), the fault is raised, the session's record states the instant. It is NOT resampled and NOT restarted by itself at the new rate. The seconds between the change and the stop are in the evidence at an unknown true rate (HM-4): the fault's interval is the statement of that; it is not repaired.
  3. REFUSAL, not resampling, is the ruling (U23 (2)) and is right against U12 A1: the stored form is AAC mono 48 kHz made by the worker from a 48,000 Hz pipe; a silent conversion in front of it would put an unrecorded processing step into every second of audio.
  4. The `-ar 48000` literal may stay (it is then a no-op and keeps the output line shared); the table's comment and the README say that it is not the control.
  5. F13 / D128 stays a gate of its own: this input layer delivered 8/9 of the declared rate on the built-in microphone, cause unknown. Until MM-6 / MH-06 show the delivered rate right on the user's interface, the path is "built", not "fit to record" (design Q7 - confirmed).

### 7.3 Exclusivity

**SM-17 (CAUTION). The evidence claims what was delivered, never that nothing else touched the device.** Rows M8, M10.
macOS gives no exclusive access: another application can read the same microphone at the same time, and can change its input volume, its mute state and its rate. What the path may claim: "the samples the operating system's audio layer delivered for input k of the device identified as [facts], at a stated rate of 48,000 Hz, while the three checks of SM-04 held". What it may NOT claim: that no other program read the microphone; that the gain was constant; that the device was the same for every sample (only at the listings). What is detected: a rate change (SM-16), a full mute (SM-14 (4)), the loss of the device (the watch, the stall bound). What is NOT detected: a gain change, a second reader. The README and the installer note say so; on a Linux host the shared capture of the Core's own configuration is the hardened counterpart.

### 7.4 What the evidence states

**SM-18 (CAUTION). The source facts and the platform facts of a macOS session.** Rows M6, M8 (after row P1).
1. Source facts of each microphone as the design's section 8 lists them - confirmed against the closed key list (`sources.ts:148`): `model`, `usbId`, `usbSerial` (absent when none), `usbPort` (the location, eight hex digits), `cardId` (`usb_<location>`), `cardDevice` 0, `inputNumber`, `nativeChannels`, `sampleRate` 48000. `sampleBits` is LEFT OUT (the builder drops a value outside 16 / 24 / 32, `:219`): no listing states it and the helper's float stream is not the device's width. The values are those of the listing of the START (the card actually opened), as row 200 did on Linux.
2. The capture layer is a fact of the evidence, not something a reader infers from the form of a card id. Either the key `captureLayer` (`ALSA` / `AVFOUNDATION`) if the build row shows that no stored CHECK and no sealed reader pins the key list (the design left that unverified - it is verified FIRST), or the manifest's platform line of row P1 alone. One of the two is mandatory.
3. SYSTEM_BOOT and the sealed manifest: platform `darwin`; host profile not asked (row P1); `microphonePermission: NOT_KNOWN`; the path-rule result of the three listing programs; and the bench-form word of SM-20.
4. Every fault interval of SM-06, SM-14 (4) and SM-16 (2) is in the session's record that the seal covers.

**SM-19 (CAUTION). PRIMARY and STANDBY as two channels of one device (U23 (1)): nobody may take the standby for an independent microphone.** Rows M6, M10; a contract question for the controller.
- What the Linux precedent says: two inputs of one card are admitted there by design (two helpers on one shared capture; only the SAME input twice is refused, `card-listing.ts:687-705`). So the macOS answer is the same as Linux's, not a new weakness. And U12 A1: the standby is not stored - it is a live source the session can switch to.
- What it protects: one microphone capsule or its cable into the interface. What it does not: the interface, its USB cable, its socket, its driver, the permission, the rate - one fault takes both.
- The build must: (1) state the fact where it is read - both microphone rows of a session carry the same `usbPort` and `cardId` and differ in `inputNumber` only (already so by SM-18 (1)); (2) raise a non-blocking, named notice at assignment and at the pre-check when both roles resolve to one device ("the standby is on the same device as the primary"); if that needs a contract member, the controller decides; the minimum without one is the README, the hardware chapter and the report; (3) never describe the pair as "redundant" in a document or a screen text; (4) prove two helpers on ONE device (MM-5): if the second is refused, the design's fallback (one helper, two pipes) is a new argument row and comes back to this review.

### 7.5 Weakening; marking

**SM-20 (CAUTION). The macOS path is marked as the bench form in code and in the evidence.** Rows M6, M8.
U21 allows production on Linux AND this Mac; it does not make them equal. The design lists ten weaker points (its section 11) - confirmed, with two added by this review: W11, the helper resamples by itself (SM-16); W12, the port member is read from device-influenced text (SM-02). The build must: (1) give the macOS adapter a constant that says it is not the hardened form, and state it in the boot's entry and the sealed manifest beside row P1's members (one closed word, for example `hostForm: BENCH_DARWIN`); (2) keep "fit to record" undeclared for this path until MH-06 has passed on the user's interface (U12 A5 stage 2); (3) state every point W1 to W12 in the README and the installer note.

**SM-21 (PASS). No development source becomes a production source by a flag.** Rows M5, M6, M7.
The design's sharing table (4.4) is accepted as written. The build must hold it by a static rule: the macOS adapter and listing import none of `mic-adapter`, `createMicHelper`, `startHelperProcess`, `LOCAL_MIC_DEVICE_NAME`, `selectLocalDevice`, `parseDeviceList`; the production program key is `DEMS_CAPTURE_AUDIO_HELPER` only; the adapter of the kind is chosen by `process.platform` alone - `linux` the Linux one, `darwin` the macOS one, any other none, never both - and no configuration key, environment variable or test seam in `src/` chooses it (AD-08's rule).

**SM-22 (PASS). The built-in microphone is never a card of this listing and is never opened by this path.** Rows M4, M6. By rule 2 of design 3.3 (USB transport) and SM-03 (4). The build must add the tests: a listing with only the built-in input lists 0 cards; a stored row cannot be made to point at it (`usbId` is mandatory on `darwin`, SM-01 (b)); and SM-04 (5) at the open.

**SM-23 (CAUTION, low). The helper and its libraries.** Row M10. The path rule vouches for the file that is started, not for the libraries it loads; on this Mac those are in a tree of the user's package manager (design W4). The production door hands over an empty environment, so no loader variable reaches the helper (`production-door.ts:51, 189-197`) - confirmed. Stated in the README as a property of a Mac production Core; no further requirement for the bench.

**SM-24 (PASS). The guard and the liveness rule hold on `darwin`.** Row M6. The helper is started by the guard (design 4.2); the guard program is checked on every platform (`host-checks.ts:371`). Unchanged.

## 8. Decision U23, assessed

| Decision | Assessment | What it obliges the build to do |
|---|---|---|
| (1) PRIMARY and STANDBY are two channels of the one interface | Sound, and the same as the Linux precedent. It is a standby against a failed microphone, not against a failed device | SM-19 in full; MM-5 before M6 |
| (2) the user sets 48 kHz; the Core refuses otherwise; no resampling | Right, and it needs more than the design gives: the helper resamples by itself | SM-16 in full; the helper's statement is the control (SM-04 (2)) |
| (3) agents may run the device list | Low risk: it opens nothing and asks nothing (the repository's own recorded statement, `device-list.ts:5-6`). The names are the user's | Names, serials and locations never enter a document, a fixture, a commit or a log: counts and forms only; fixtures stay synthetic (design Q3) |
| (4) agents may open the user's USB interface; D163 lifted for that interface only | Accepted as the user's ruling. Two facts the ruling cannot change: the operating system's grant is per APPLICATION and covers the built-in microphone (SM-15 (3)); and "that interface only" rests on the very index semantics that are unproven until MM-2 | SM-26 (the measurement row and its bounds), SM-27 (hygiene), rank 5 (the user is told) |

**Is the measurement wanted BEFORE the verdict is final? Yes** - for MM-1, MM-2, MM-3 (they decide SR-14's first place and whether SM-04 and SM-16 have a control at all). M4's readers of L1 and L2 and its fixtures do not depend on an open and may start on this verdict once SM-02 is settled.

## 9. Question 9 - the test plan

**SM-25 (CAUTION). Fixtures and stand-ins (agents; no device).** Rows M4, M9.
The design's lists (9.1, 9.2) are accepted. Added, one per finding: the forged header of SM-02 (three variants); two blocks with one location; lists that disagree (an L3 entry with no L2 item; the reverse); a built-in, an aggregate, a virtual and a Bluetooth item under the USB unit's name; an item with USB transport and no L1 block; a rate and a channel count as a float and as a string; L3 with the index shifted between the second and the third listing; a capture stand-in that states 96,000 Hz; one that states another channel count; one that delivers exact zeros (pre-check and session); one that delivers then stalls; a listing stand-in that forks a child and hangs (0 survivors after the bound); an empty `_items` with an audio device in L1; a name with a locator. The static controls of SM-08 (e). Every stand-in checks that its argument list IS the row and exits otherwise (design 9.2 - confirmed).

**SM-26 (CAUTION, GATE). Row MM: the bounded measurement by an agent (U23 (3), (4)).** Before M3 and M6 are cut.

| # | Measures | Opens a device? | Settles |
|---|---|---|---|
| MM-0 | The fixed argument list of the USB tree in property-list form that carries the interface class; its size; `system_profiler` killed at a bound leaves no child (stand-in); run time of L2 and L3 outside a sandbox | no | SM-02, SM-10 |
| MM-1 | The device list, once: the exact line FORM for a USB device; the count of audio entries against the count of L2's input items; ten lists in a row: same order | no | SM-03, design 13 (2), (9) |
| MM-2 | `none:<n>` with n = the interface's index: the helper opens, and states the interface's channel count (not 1) | yes | HM-1; SR-14 (1) |
| MM-3 | What the helper prints about the opened stream at the chosen log level: the line's form, rate and channel count | yes | SM-04 (2), SM-16 |
| MM-4 | Which application the system names at the first open (the user reads it and answers; the agent records the application's NAME as the user states it) | yes | HM-3 |
| MM-5 | Two helpers on the one device at once: both deliver | yes | SM-19 (4) |
| MM-6 | Samples delivered in 2 s against 96,000 expected per channel at 48,000 Hz, three runs; time to the first sample | yes | F13 / D128; design 13 (8), (11) |
| MM-7 | Selection of input i and of input j: the counts of non-zero samples and the peak per selection (numbers only). Whether channel k IS the socket numbered k+1 needs a sound at one input: the USER makes it; the agent reads numbers | yes | design 13 (6) |

Bounds of the row, all mandatory:
1. The user is at the Mac for the first open: the system's question is theirs; an agent never answers it, never scripts it, and never changes a privacy setting. If the open is refused or silent, the row stops and reports; it does not look for another way.
2. Before EVERY open: a fresh list; the built-in microphone's entry is identified; the open goes ahead only when the index to be used is not that entry's and the interface's name is unique. The first open of the row is made by the EXACT NAME (the development form whose rule is proven, `device-list.ts:67-74`), so that the first use of an index is compared with a known-good open. No list of the row ever holds `default`, an empty audio part, a video part other than `none`, or the built-in device.
3. After every open the stated channel count is read FIRST: a count of 1 (the built-in microphone's) ends the row at once with the finding, and the user is told.
4. At most 2 seconds per capture, at most 12 captures in the row, one helper at a time except MM-5; every helper bounded with `-t` and killed at 5 s; none left running (process table checked at the end).
5. Output to the null format, or to one raw file under the git-ignored `.cache/` that the SAME command deletes. Reported: counts, rates, peaks, yes / no. No audio is listened to, transcribed, described, kept, committed or sent; no device name or serial enters a file.
6. The agent changes NO setting of the device (rate, volume, mute) and unplugs nothing: those are the user's checks.
7. A command that must leave the command sandbox does so one command at a time through the permission gate; the sandbox is not switched off for the session.

**SM-27 (CAUTION). Hygiene of any later agent open (row M9 and after).** The bounds 2 to 7 of SM-26 apply to every row that opens the interface. A production Core started by an agent for a real open runs on a spare lane with its own database and media store (P11 (2)); what it seals is test material and is removed with the lane.

**SM-28 (PASS). What only the user can prove.** Row M10 (the hardware chapter). After U23, of the design's twelve checks these remain the USER's own:

| # | Check | Why not an agent |
|---|---|---|
| MH-02 | The system's question at the first open: which application it names; Allow | the answer is the user's consent |
| MH-03 | The pre-check with the grant switched off: which form a refusal takes; `INPUT_SILENT` is raised | a privacy setting is changed |
| MH-04 | Speak into input i only: the level moves on the microphone registered on input i | a sound in the room |
| MH-07, MH-08 | Unplug during a recording; re-plug into the same and another socket | physical |
| MH-09 | Restart the Mac: the location value is the same | physical |
| MH-10 | A second audio device connected between open and start: `AUDIO_CARD_MOVED` | physical |
| MH-11 | The interface left at 96,000 Hz: refused, in words the operator understands | a device setting |
| MH-13 (new) | The rate changed by another program DURING a recording: stopped within one watch interval, fault with its instant, nothing resampled | a device setting; HM-4 |
| MH-14 (new) | Input muted in the system during a recording: the fault of SM-14 (4) | a device setting |
| MH-12 | A sealed session states SM-18 | the first real session is the user's click (U22 (3)) |

MH-01, MH-05 and MH-06 move to row MM (and are repeated by the user on the production Core).

## 10. Requirements by row

| Row | Requirements |
|---|---|
| MM (new, before M3 / M6) | SM-26; feeds SM-02, SM-03, SM-04, SM-10, SM-16, SM-19 |
| M3 (argument table) | SM-07, SM-08, SM-09, SM-14 (the pre-check row), SM-16 (4), SM-04 (2) (the log level literal) |
| M4 (listing) | SM-01, SM-02, SM-03, SM-05, SM-11, SM-12, SM-13, SM-22, SM-25 |
| M5 (platform seam, runner) | SM-08 (pins), SM-10, SM-21 |
| M6 (adapter) | SM-04, SM-06, SM-10 (4, 5), SM-12, SM-14, SM-16, SM-18, SM-19, SM-20, SM-21, SM-22, SM-24 |
| M7 (registry, watch wiring) | SM-06, SM-21 |
| M8 (boot, source facts) | SM-13, SM-15, SM-17, SM-18, SM-20 |
| M9 (stand-ins, session on doubles) | SM-25, SM-27 |
| M10 (documents) | SM-15, SM-17, SM-19, SM-20, SM-23, SM-28 |

**Count: PASS 7 (SM-01, SM-05, SM-09, SM-21, SM-22, SM-24, SM-28); CAUTION 21; FAIL 0.** Gates (5): SM-02, SM-04, SM-14, SM-16, SM-26. Rank-1 without being a gate of a requirement: SM-07 (the amendment adopted), SM-15 (the user is told), SM-20 (where the bench-form fact lives).

## 11. The designer's claims about the specifications, checked against the sources

Row M1 read the security documents by section. Checked here in full:

| Claim of the design | Source | Result |
|---|---|---|
| F9: AD-07 (2), the words | `04_security_addendum.md:263` | exact |
| F5: the identity rule; C56 | `usb-audio-production.ts:300-362`; `decisions.md:90` | exact |
| F7: fixed row, bound 5,000 ms, cap 64 KiB | `production-parts.ts:321-367`; `production-door.ts:41` | exact; and the cap test reads the output stream only (SM-10 (1)) |
| F10: the admissions of SR-4 are tied to the Linux lists | `static.test.ts:1153-1164` | exact |
| F11: the development path uses `none:<name>` and the exact-name rule | `mic-helper-args.ts:117-120`; `device-list.ts:67-74` | exact |
| F14: `sampleBits` outside 16 / 24 / 32 "is stored as null" | `sources.ts:219` | the key is LEFT OUT, not stored as null (SM-18 (1)) |
| Observation: `static.test.ts:1078-1079` still expects `-channels` | `static.test.ts:1193-1194, 1205` | NOT so in the tree read now: the pin holds `-ch_layout` and asserts that no list holds `-channels`. Either fixed since, or misread; nothing to do |
| AD-07 (3), single-flight and spaced card search | `04_security_addendum.md:264` | NOT carried by the design; it is SM-10 (4) |
| AD-06 / S13-12: device text in no log, audit detail or error | `04_security_addendum.md:277-282`; `02_security.md:244` | carried for the listing's strings; not stated for the helper's diagnostics and the undecided statement (SM-12) |
| "the output line ... unchanged; nothing may resample" | `mic-helper-args.ts:73` | the two statements contradict each other (SM-16) |
| 2.3: a forged property line "can only spoil its own block" | by construction | wrong (SM-02) |

## 12. Commands run by this review (form only; no value copied)

| Command | Sandbox | Result |
|---|---|---|
| `/usr/sbin/ioreg -r -c IOUSBHostDevice -l -d 2 -w 0`, piped into a script that prints key names, types and counts | in | 17,232 bytes, 430 lines, longest 180, 0 bytes outside ASCII, ends with a line end; 4 column-0 headers, all of class `IOUSBHostDevice`, 8 hex digits after `@`; `idVendor`, `idProduct`, `locationID`, `bInterfaceClass`, `bInterfaceSubClass` are decimal integers; the header's location equals every `locationID` of its block in 4 of 4. Design M6: confirmed |
| the same with `-a` (property-list form) | in | nothing on standard output, status 1, "can't open file" |
| the same with `-a` | out, once | 19,491 bytes, 706 lines, longest 102; a list of 4 devices; integers typed; children present; NO interface class on the children at depth 2 |
| `/usr/sbin/system_profiler SPAudioDataType -json`, types only | in | 107 bytes, `_items` empty, exit 0, 0.15 s. Design M9: confirmed |
| the same | out, once | 1,471 bytes, 0.16 s; three items; `_name` string, `coreaudio_device_input` and `coreaudio_device_srate` integers, the transport a word. Design M8: confirmed |

## 13. What cannot be known without opening a device

Measurable by an agent now (row MM): that `none:<n>` opens the indexed device; the order of the list between runs; what the helper states about the opened stream; two helpers on one device; the delivered rate; the time to the first sample; the exact text of the list.

Still the user's alone: which application the system asks, and the answer; what a DENIED grant looks like (silence, a refusal, or no buffer); that channel k is the socket numbered k+1; whether the helper ends on unplug and how fast the device leaves the three lists; the location after a reboot; what the helper does when another program changes the rate during a recording.

Not knowable by any test: that no other program read or changed the microphone during a session (SM-17).

## 14. Compliance view (short)

No regulation was identified for this task by the plan. From the files read, and no more:

| Item | Status | Finding |
|---|---|---|
| GDPR Art. 5(1)(c), Art. 25 (minimisation, by design) | Met in the design, with one duty | The pre-check and row MM handle room audio: read in memory, counted, dropped (SM-14 (2), SM-26 (5)) |
| GDPR Art. 5(1)(f), Art. 32 (security of processing) | Gap, stated | No exclusive access; a standing grant to the launching application for every microphone (SM-15, SM-17) |
| GDPR Art. 30, 33, 35 | Not examined | - |
| ISO 27001 A.9 access control | Finding | The access decision is the operating system's and per application (SM-15) |
| ISO 27001 A.12.4 logging | Met with findings | Fault intervals in the session's record (SM-06, SM-14, SM-16); no device text in a log (SM-12) |
| ISO 27001 A.12.6, A.14.2 | Met with findings | Argument origin held by a static rule (SM-08); fixtures for every finding (SM-25) |
| ISO 27001 A.18 / evidence integrity | Finding | The evidence states the bench form and the capture layer (SM-18, SM-20) |

## 15. Assumptions, gaps, alternatives

- **Assumption.** The records 064 to 200 describe the code as it stands; the code was read, the records were not.
- **Gap.** The registrar module (operations 98, 99) was not read: whether its own match (`matchStoredCard`) needs a macOS word is for row M7.
- **Gap.** Whether a stored CHECK or a sealed reader pins the source-fact key list was not verified (as in the design); SM-18 (2) orders it first.
- **Alternative E (a small native program that lists and captures by the device's unique identifier)** removes SM-03, SM-04's residual, SM-05's limit and most of SM-02 at once, and can ask the system for the permission status (SM-15). It is the hardened form for a Mac and the right follow-up if the Mac is ever more than a bench. Not required now: U22's words are "a card listing and a helper row", and the user prefers ready-made parts. Stated so that the residuals above are read as the price of that choice.
- **Alternative rated and not taken: FAIL for the name tie.** Not taken because every doubt is a refusal, the open is checked afterwards by the helper's own statement, and the path is marked as the bench form in the evidence. It becomes a FAIL under the first two conditions of section 2.
- This row changed no source file, did not write `decisions/decisions.md` or a tracking file, and opened no device.

---
*Generated: 2026-10-13 16:24*
*Last Updated: 2026-10-13 16:28*
