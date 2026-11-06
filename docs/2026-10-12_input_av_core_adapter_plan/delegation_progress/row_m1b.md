# Row M1b (track D) - revision 2 of the design of the macOS production microphone path

- Agent: data-analyst (designer). Date: 2026-10-13 18:15 (host `date`).
- Status: **needs-review** - the design is revised in place; it goes to an addendum of the security review (row N0 of its section 10) before any build row. Five requirements of the review cannot be met as written (section R.2 of the design); one sentence of decision U25 (3) cannot be met by its letter (below).
- File revised, with the Edit tool only: `masterplan/06_design_macos_microphone.md` (Tier 1; 397 lines before, about 820 after; structure kept, section R lists every replaced statement).
- File written: this one.
- No source file changed. No device opened, no command run on a device. Commands of this row: reads and searches of the working tree, and `date`.

## What the revision settles (section of the design; what it rests on)

| # | Point | Answer | Rests on |
|---|---|---|---|
| 1 | The helper row (4.2, 4.2a, 4.3) | One helper per device: `-loglevel info -thread_queue_size 1024 -f avfoundation -i none:<n>`, one or two outputs, each `-map 0:a -af pan=mono|c0=c<k> -ac 1 -ar 48000 -c:a pcm_f32le -f fifo -fifo_format f32le -drop_pkts_on_overflow 1 -queue_size 32 -format_opts flush_packets=1 -y <pipe>`. Every word fixed or of a closed set (32 device words, 64 selections). A named list of forbidden options. SR-15 restated: two output sections, format `fifo`, log level `info` | MM3 s8, s5; MM2 s5; MM s2; decisions C96 (3), C107 |
| 2 | One process, two microphones (6) | The handles of one device in one session form a group; the first `start` launches the one helper, later starts join it; a handle still starts once; closing one handle leaves the helper for the other; the helper's end tells both. The standby guards a microphone, not the device or the helper: same `usbPort` and `cardId` in both source rows, and the notice `STANDBY_ON_PRIMARY_DEVICE` | MM s5; MM2 s5; MM3 s8.2; `capture-session/index.ts:2075-2086`, `:1666-1711` |
| 3 | The shortfall as a measured fact (7.2, 8.2-8.4) | Measured in the WORKER (the only part the samples pass through): `receivedSamples`, `timelineSamples`, `nonZero` per microphone in the telemetry, the record `MIC_SAMPLE_ACCOUNT`. Notices `MIC_PATH_NOT_SAMPLE_CONTINUOUS` (always, information) and `MIC_SAMPLES_SHORT_ABOVE_BOUND` (above 12.0% in two windows of 10 s in a row). Audit type `CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED` (six closed details). Optional signed member `audio.samplesNotReceived` (fields 139-144), absent on Linux and in development (byte identity to be proven as rows 191c and P1 did) | MM3 s0, s8.1, s8.3, s6; `apps/capture-worker/src/audio.c:436-449`, `:651-655`; decisions U25 (3), C107 |
| 4 | The helper's own statements (4.6) | The stream line read live from standard error: rate exactly 48,000 or refused (`-ar 48000` is then a no-op guard); the layout word through a closed table (`5.1` = 6, the one measured entry); one non-zero sample (pre-check: counted by the Core; session start: the worker's `nonZero`, active microphone within 8,000 ms); a silent standby is the existing warning; `FIFO queue full` / `flushed` become notices | MM s2; MM2 s1, s2, s6; MM3 s8.2 |
| 5 | Unreliable opens (4.7) | A pause of 1,000 ms after a close on the same device, and ONE retry (exit 251 with the fixed refusal line, before any stream line), each reported; inside the one `start` of a handle; the time is inside the restart gap rows 191b / 191c measure and sign | MM s2; MM2 s3; MM3 s6 |
| 6 | The review's rank-1 points | `ioreg` in property-list form (2.3); the bench form is marked in code and in the evidence, and the host part is ALREADY stated by row P1 (8.1); the permission cannot be checked without an open (5) | MM s1.1, s6; decision C97 |
| 7 | Not measured, the user's own (9.3) | unplug, reboot, a rate changed mid-session, the socket-to-channel mapping, a permission denial | MM s9; MM2 s9; MM3 s10 |
| 8 | Work packages (10) | 16 build rows (S 8, M 8) and one review addendum; two contract rows (protocol; shared package) | - |

## What the worker does today with a pipe that delivers fewer samples than real time

Read from `apps/capture-worker/src/audio.c` (no row has run it with such a pipe; the design marks what is predicted):

- The timeline is the host's clock (`:599`); a quantum takes what the buffer holds and the rest is zero (`:436-446`): the track keeps its length and does not drift cumulatively.
- The zeros are counted (`:449`) and told to nobody but one log line at the end (`:651-655`).
- A controller would ask the resampler to stretch the audio by 5,000 parts per million for the whole session and raise `MIC_RATE_AT_LIMIT` (`:464-480`).
- The zeros stand where the worker's buffer ran empty, not where the lost packets were; a fixed displacement of at most the 40 ms the worker waits (`:88`), predicted, not measured.

What must change (row N3 of the design): a second input kind `PCM_FIFO_GAPPED` for which the controller asks nothing, and the counts are reported. The gaps cannot be carried by the track's timestamps: one encoder, one continuous sample counter, packets copied byte for byte into every camera file (`audio.c:250`, `:618`, `:258-279`; `ingest.c:459-475`).

## For the controller

1. **Five requirements of the review cannot be met as written** (design R.2): SM-04 (2) (the channel count is a layout word, not an integer); SM-19 (4) (two helpers on one device: refused 3 of 3); SM-16 (5) / SM-20 (2) (the "fit to record" gate on the delivered rate can never pass with the pinned tool: replaced by U25); SR-15 (3) as adopted in C96 (the format set needs `fifo`); SM-06's stall bound (the measured row has no progress report). Each needs the review's addendum.
2. **Decision U25 (3), "the session's source facts ... state ... by how much it fell short"**: the source facts are written once at the start and the runtime role may not update them (`capture/fence/sources.ts:132-134`; migration `0016`, line 46). The design states THAT in the source facts (two keys, `darwin` only) and HOW MUCH in the audit row and the signed manifest. To confirm.
3. **The production door must hand on standard error as it arrives** (row N5): today it keeps a bounded head for the end only (`production-door.ts:259`), and the stream line and the queue lines are on standard error. A pinned file.
4. **The review's word `hostForm: BENCH_DARWIN` is not added** (design 8.1): row P1's `hostProfileNotAsked` already signs the host. To confirm or reverse in the addendum.
5. **Two measurements disagree** on the property-list form of the USB tree: the review saw 19,491 bytes and no interface class at depth 2; row MM saw 34,693 bytes with the class. Row N6 settles it before the row's words are pinned.
6. **A dependency question** (design Q9): a ready-made property-list parser, or a small strict reader of our own.
7. **Four forms of the helper row were not run by the measurements** (design 4.2): the two-output queued form over 60 s without the measuring outputs; a single queued output; a reader absent at the start or closing its pipe; the pre-check row to standard output. Row N9 runs them on a generated source (no device) before it relies on them.
8. **The option not taken** (decision C107): a small own reader of the system's audio interface; five lines in the design's section 14, not designed.
9. Read by section, not in full: the files listed in the design's section 13 ("Reading of revision 2"). Not read: the supervisor, `sink.c`, `ipc.c`, the registrar, the web console.
