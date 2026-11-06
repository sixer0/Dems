---
task_id: 2026-10-12_input_av_core_adapter_plan
row: MM (track D)
date: 2026-10-13
agent: test-expert (agent MM)
type: measurement record (Tier 2)
status: needs-review (measured in full; four findings contradict the design)
decisions_read: U22, U23, U24, C96
source_changed: none (no product file; scripts and number files under `.cache/task4-mm/` only)
devices_opened: the user's USB audio interface only (16 helper starts); the built-in microphone, cameras, aggregate, virtual and network devices: never
settings_changed: none
session: 2026-10-13 17:09 to 17:15 WIB (host `date`)
---

# Row MM: measurement of the macOS microphone path on the USB interface

Words: "the helper" = the pinned capture program; "the USB interface" = the user's one USB audio device. Channels are numbered as the helper numbers them, from 0 (channel k = input k+1). Levels are dBFS of 32-bit float samples. No audio is kept: every capture file was deleted by the stage that made it. Device names, serials, vendor / product numbers and location values are not in this record, in the log or in the number files (checked: 16 device strings, 0 occurrences).

## 0. Frame

| | |
|---|---|
| Program | `/Users/gsp-budi/Documents/DEMS/.data/helpers/ffmpeg`, byte-identical (`cmp`) to `/opt/homebrew/Cellar/ffmpeg/9.0.2/bin/ffmpeg`; version line `ffmpeg version 9.0.2 Copyright (c) 2000-2026 the FFmpeg developers`. Nothing installed or downloaded |
| Script | `.cache/task4-mm/mm.py` (stages `lists`, `name`, `full`, `pan`, `row`, `two`, `stop`, `left`); its log `.cache/task4-mm/session.log`; numbers `.cache/task4-mm/numbers_*.json` |
| Selection rule before EVERY capture | a fresh listing of all three lists; exactly one USB input item in the system list; its name on exactly one device of the USB tree with an audio interface; exactly one helper entry equal to it and none beginning with it; else exit 3. The selected line was printed each time: `[AVFoundation indev @ 0x<ptr>] [0] <USB-AUDIO-1> | transport=usb | system list: inputs=6 rate=96000 | audio entries=2`. No abort of the selection occurred |
| Bounds used | the launching message's: at most 5 s and 20 captures (U24 (1) lifted the 2 s / 12 of SM-26). Used: 16 helper starts, each counted as one capture whether it opened or not; longest 4 s. SM-26 bounds 2, 3, 5, 6, 7 kept: first open by exact name; stated channel count read first; numbers only; no setting touched; sandbox left per command |
| Outside the command sandbox | the `lists` stage (`system_profiler` returns an empty list inside it; `ioreg -a` fails inside it), every capture stage (device access), the process-table checks (`ps`, `pgrep`), the leak check. Everything else inside |

## 1. The three lists

Commands (the `lists` stage, five listings in a row):

```
/usr/sbin/ioreg -r -c IOUSBHostDevice -l -d 2 -a
/usr/sbin/system_profiler SPAudioDataType -json
.data/helpers/ffmpeg -hide_banner -nostdin -f avfoundation -list_devices true -i ''
```

### 1.1 USB tree, property-list form

Raw (forms only): exit 0, 34,693 bytes, 0.02 to 0.03 s, a list of 4 device dictionaries; direct children under the key `IORegistryEntryChildren`.

```
device 0: ifaces(class,sub,num)=[(9, 0, 0)] children=3
device 1: ifaces(class,sub,num)=[(8, 6, 0)] children=3
device 2: ifaces(class,sub,num)=[(2, 6, 0), (10, 0, 1)] children=4
device 3: ifaces(class,sub,num)=[(1, 1, 0), (1, 2, 1), (1, 2, 2), (254, 1, 3)] children=6
device 3 keys: USB Product Name:str(len 4), kUSBProductString:str, USB Vendor Name:str(len 7), kUSBVendorString:str,
  idVendor:int, idProduct:int, locationID:int, IORegistryEntryLocation:str(len 8), IORegistryEntryName:str,
  bDeviceClass:int, bcdDevice:int, iSerialNumber:int, sessionID:int, USB Address:int, ... (39 keys)
  USB Serial Number: ABSENT    kUSBSerialNumberString: ABSENT
  locationID as 8 hex == IORegistryEntryLocation: True
child with an interface: bInterfaceClass, bInterfaceSubClass, bInterfaceNumber, bAlternateSetting (all int),
  plus idVendor, idProduct, locationID, USB Product Name repeated on the child
```

Reading:
- One device with audio interfaces: class 1 / sub-class 1 (control) once, class 1 / sub-class 2 (streaming) twice, and a class 254 interface. The design's rule "audio when a direct child has class 1, sub-class 2" holds in this form. Two of its six children carry no interface key at all (a driver node, a user-client node): a reader must pass over them.
- No serial key (design M7 confirmed). Identity available: vendor, product, location.
- Integers arrive typed (no text to parse) and strings as plist strings: the forgeable text of SM-02 is gone in this form.
- **Contradiction 5 (small):** the property-list form is 34,693 bytes for 4 devices, twice the text form (17,232), against the door's 64 KiB cap - a hub with more devices can exceed it. And **inside the command sandbox the same command fails**: `ioreg: error: can't open file.`, exit 1, 0 bytes, while the text form answers there. A confined Core gets an error from L1, not a list (the design's "empty is not none" covers L2 only).
- The product string is 4 characters. Short names make the helper's prefix match of a name wide; the index form avoids it.

### 1.2 System list

Raw, redacted (1,471 bytes, 0.16 to 0.24 s):

```
"_items" : [
  { "_name" : "<USB-AUDIO-1>", "coreaudio_device_input" : 6, "coreaudio_device_manufacturer" : "<MANUFACTURER>",
    "coreaudio_device_output" : 6, "coreaudio_device_srate" : 96000,
    "coreaudio_device_transport" : "coreaudio_device_type_usb",
    "coreaudio_input_source" : "spaudio_default", "coreaudio_output_source" : "spaudio_default" },
  { "_name" : "<BUILTIN-1>", "coreaudio_default_audio_input_device" : "spaudio_yes", "coreaudio_device_input" : 1,
    "coreaudio_device_srate" : 48000, "coreaudio_device_transport" : "coreaudio_device_type_builtin", ... },
  { "_name" : "<BUILTIN-2>", "coreaudio_default_audio_output_device" : "spaudio_yes", "coreaudio_device_output" : 2,
    "coreaudio_device_srate" : 48000, "coreaudio_device_transport" : "coreaudio_device_type_builtin", ... } ]
```

Counts: USB 1 item (with input: 1); built-in 2 items (with input: 1); virtual, aggregate, network: 0. The default input is the built-in one, not the USB interface.

### 1.3 Helper list

Raw, redacted (exit 251 by design, standard output empty, 556 bytes of diagnostics, 0.18 to 0.27 s):

```
[AVFoundation indev @ 0x<ptr>] AVFoundation video devices:
[AVFoundation indev @ 0x<ptr>] [0] <VIDEO-0>
[AVFoundation indev @ 0x<ptr>] [1] <VIDEO-1>
[AVFoundation indev @ 0x<ptr>] [2] <VIDEO-2>
[AVFoundation indev @ 0x<ptr>] AVFoundation audio devices:
[AVFoundation indev @ 0x<ptr>] [0] <USB-AUDIO-1>
[AVFoundation indev @ 0x<ptr>] [1] <BUILTIN-1>
[in#0 @ 0x<ptr>] Error opening input: Input/output error
Error opening input file .
Error opening input files: Input/output error
```

Reading: an entry is `[<tag>] [<n>] <name>`: index and name only (design M4 confirmed). 3 video entries, 2 audio entries. The audio entries are exactly the system list's input items (2 of 2, same names). The video section comes first with its own indexes from 0: a reader must take indexes only after the audio section line.

### 1.4 Across the three

| Question | Answer |
|---|---|
| Is the name the same string in all three | YES: USB tree product string == system `_name` == helper entry (exact comparison, value not printed) |
| Order over five consecutive listings | STABLE: helper audio order `(USB, built-in)`, indexes `(0, 1)`; system order `(USB, built-in input, built-in output)`; rates `(96000, 48000, 48000)` - identical five times. It also held in all 12 pre-capture listings |
| Cost of one listing of all three | about 0.4 to 0.55 s (0.03 + 0.16..0.24 + 0.18..0.27) |

## 2. Index semantics, and what the helper states

Commands: capture 1 `... -loglevel info -f avfoundation -i none:<exact name> -t 2 -vn -c:a pcm_f32le -f f32le -flush_packets 1 -y <file>`; captures 2 to 4 the same with `-i none:0 -t 3`.

Raw (info level; identical in every open that succeeded, by name and by index):

```
Input #0, avfoundation, from 'none:0':
  Duration: N/A, start: 396415.197563, bitrate: 18432 kb/s
  Stream #0:0: Audio: pcm_f32le, 96000 Hz, 5.1, flt, 18432 kb/s, start 396415.197563
```

At debug level also: `[in#0 @ 0x<ptr>] audio device '<USB-AUDIO-1>' opened` and `Stream #0:0, 1, 1/1000000: Audio: pcm_f32le, 96000 Hz, 5.1, flt, 18432 kb/s, start ...`. At the product's level (`-loglevel warning`, capture 7): **0 bytes** of diagnostics.

Reading:
- `none:0` opens entry `[0]` of the audio list: the stated stream is 6 channels at 96,000 Hz, which is the USB interface's count and rate in the system list (the built-in input is 1 channel at 48,000); the open by exact name states the same line; the debug line names the opened device; channel 0 carries the room's source (section 4). Limit: only index 0 could be opened (index 1 is the built-in microphone, never opened), so "another index opens another device" was not shown by a second device.
- **Contradiction 3:** the helper does NOT state the channel count as a number. It states a LAYOUT NAME, `5.1`, for the 6-channel device. The reader SM-04 (2) asks for ("one anchored pattern for two integers") finds the rate and no count. A reader needs a closed table of layout words; which word other counts produce was not measured (one device).
- The line exists only at info level or above; the reused literal `-loglevel warning` prints nothing (the review's "a log level literal of its own" is confirmed as necessary).
- The stated rate is the DEVICE's rate (96,000), so SM-16's control exists: the helper's own line tells a 96,000 Hz device from a 48,000 Hz one.
- **Contradiction 4:** an open is not reliable. Capture 3 (a single open, nothing else of this row running) ended after 0.40 s, exit 251:

```
[in#0 @ 0x<ptr>] audio device '<USB-AUDIO-1>' opened
[in#0 @ 0x<ptr>] audio format is not supported
[in#0 @ 0x<ptr>] Error opening input: Input/output error
Error opening input file none:0.
```
  1 of 10 single opens. The same command 40 s later opened. Cause not established.

## 3. The rate

| Source | Value |
|---|---|
| System list, now | **96,000 Hz** for the USB interface (every listing of the session) |
| Helper's stream line on open | **96,000 Hz** |
| Required by U23 (2) | 48,000 Hz - **NOT met now**. The user sets it (Audio MIDI Setup); this row changed nothing |

Asked for 48,000 on the device at 96,000 (captures 6, 7: the design's push row, to a file, `-t 3`):

```
... -thread_queue_size 1024 -f avfoundation -i none:0 -af pan=mono|c0=c0 -t 3 -vn -ac 1 -ar 48000 -c:a pcm_f32le -f f32le -flush_packets 1 -y <file>
  Stream #0:0: Audio: pcm_f32le, 96000 Hz, 5.1, flt, 18432 kb/s, start ...      (input)
  Stream #0:0: Audio: pcm_f32le, 48000 Hz, mono, flt, 1536 kb/s                  (output)
```

Reading: the input layer does not resample (it has no rate option and states 96,000); the program's own converter does, without a warning, and at the warning level without a single line. The review's defect (SM-16) is confirmed by measurement.

**Contradiction 1 (the largest): the delivered sample count is less than half of the stated rate.**

| Capture | Stated | Asked for | Frames delivered | Expected | Share | Per second of wall time (fit) |
|---|---|---|---|---|---|---|
| 1 (2 s, 6 ch) | 96,000 | - | 88,064 | 192,000 | 45.9% | 43,858 |
| 2 (3 s, 6 ch) | 96,000 | - | 130,816 | 288,000 | 45.4% | 43,659 |
| 4 (3 s, 6 ch) | 96,000 | - | 131,328 | 288,000 | 45.6% | 43,691 |
| 8 (2 s, 6 ch) | 96,000 | - | 88,064 | 192,000 | 45.9% | 43,733 |
| 6 (3 s, mono) | 96,000 | 48,000 | 64,640 | 144,000 | 44.9% | 21,523 |
| 7 (3 s, mono) | 96,000 | 48,000 | 64,128 | 144,000 | 44.5% | 21,286 |
| 9 (4 s, mono) | 96,000 | 48,000 | 87,792 | 192,000 | 45.7% | 21,878 |

Further numbers: the file grows in steps of 512 frames or multiples (1,024: 106 times, 512: 14, 1,536: 8 in capture 2), median 23.2 ms per 1,024 frames = about 44,100 frames per second of wall time; the helper's own report says `time=00:00:03.00 ... speed=0.992x` and the progress report `out_time_us=3000000`, `drop_frames=0`: by its timestamps nothing is missing. On channel 0 the mean step between neighbouring samples AT every 512-frame boundary is 13 to 20 times the mean step elsewhere (ratios 17.8, 19.0, 13.5 in captures 2, 4, 8): the audio is cut at every packet boundary. So more than half of the sound is lost, with gaps about every 5 ms, and neither the stream line, the progress report nor the exit status says so.

Why it matters: this is F13 / D128 (the development path on the built-in microphone, "about 8/9") seen again on the user's interface, far worse at 96,000 Hz. HYPOTHESIS, not measured (the rate is the user's to set): the input layer hands on about 44,100 frames per second whatever the device's rate, which at 48,000 Hz would be about 92% with the same gaps. The review's gate "built, not fit to record until the delivered rate is right" (SM-16 (5), MH-06) is not met by this build at the present rate, and nothing here promises it at 48,000. A sample COUNT against wall time is the check that sees it; the helper's statements do not.

Time to the first sample in the file: 0.34 to 0.48 s (0.69 s with seven outputs).

## 4. Channels

Count: 6 (system list, helper line `5.1`, file size).

Per channel, RMS / peak in dBFS, all channels from one open each:

| Capture | ch 0 | ch 1 | ch 2 | ch 3 | ch 4 | ch 5 |
|---|---|---|---|---|---|---|
| 2 (3 s, by index) | -69.85 / -57.19 | -110.99 / -97.65 | -79.98 / -69.30 | -110.84 / -97.18 | exact zero | exact zero |
| 4 (3 s, by index) | -70.21 / -57.87 | -111.03 / -98.22 | -80.42 / -67.39 | -110.83 / -98.05 | exact zero | exact zero |
| 5 (3 s, by index) | -69.99 / -57.43 | -111.01 / -98.30 | -77.84 / -64.54 | -110.80 / -97.57 | exact zero | exact zero |
| 8 (2 s, by name) | -30.45 / -15.32 | -91.02 / -78.86 | -82.41 / -70.29 | -110.73 / -97.65 | exact zero | exact zero |
| 1 (2 s, by name, first open) | -6.96 / 0.00 | -6.96 / 0.00 | -6.96 / 0.00 | -6.96 / 0.00 | exact zero | exact zero |

Reading:
- **Channel 0 (input 1) carries the room's source**: -28 to -30 dBFS RMS, peak about -15.5 when the source sounds (captures 6, 8, 9, 13), about -70 between (captures 2, 4, 5). In capture 8 its level moved between -36.4 and -25.7 dBFS over tenths of the capture.
- **Channel 2 (input 3) carries a faint signal**, -78 to -82 dBFS, which did not rise when channel 0 did (correlation with channel 0: -0.04 to -0.10). Whether a microphone is connected there is the user's to say.
- Channels 1 and 3: the noise floor, about -111 dBFS (98% of samples non-zero, about 190 distinct values); channel 1 rose to -91 while channel 0 was loud (crosstalk, hypothesis).
- **Channels 4 and 5: every sample exactly zero** in every capture. Under SM-14 they are `INPUT_SILENT`, rightly. Channels 1 and 3 would PASS the "one non-zero sample" check with nothing connected: the check tells a dead input from a live converter, not a microphone from an empty socket (as the review states).
- For PRIMARY and STANDBY the measurement shows ONE channel that clearly hears the source (0) and one weak candidate (2).
- Order across opens: the same pattern (0 live, 2 faint, 1 and 3 floor, 4 and 5 zero) in four opens with structure numbers (2, 4, 5, 8), by index and by name.
- **Contradiction 7 (unexplained, seen once):** capture 1, the first open of the session, showed four channels at the SAME level to 0.01 dB (-6.96 dBFS RMS, peak 0.00 dBFS), channels 1 and 3 included. No structure numbers were taken for it and the file was deleted, so it cannot be told whether it was a start-up burst of the device, sound in the room, or wrong data. It did not recur in nine later opens.

Channel selection (capture 5: ONE open, one untouched 6-channel output and six outputs `-af pan=mono|c0=c<k>`, 129,536 frames each):

```
pan c0: max|diff| to channel 0..5 = ['0', '0.00134', '0.00155', '0.00135', '0.00134', '0.00134'] -> identical to channel 0
pan c1: ... -> identical to channel 1        pan c2: ... -> identical to channel 2
pan c3: ... -> identical to channel 3        pan c4, c5: identical to channels 4 and 5 (both all zero)
```

`pan=mono|c0=c<k>` delivers channel k sample for sample (maximum difference 0). The helper prints `Pure channel mapping detected: <k>` at info level. Whether channel k is the SOCKET numbered k+1 stays the user's check (a sound at one input).

## 5. Two helpers on one device

Command, twice at once (channels 0 and 2, `-t 4`): the push row of section 3.

| Pair | Start | Helper A (channel 0) | Helper B (channel 2) |
|---|---|---|---|
| captures 9, 10 | 3 ms apart | opened; 87,792 frames; -28.33 / -15.67 dBFS; exit 0 | **refused**: `audio format is not supported`, exit 251 |
| captures 11, 12 | 2 ms apart | **refused** after 0.53 s, exit 251 | **refused** after 0.55 s, exit 251 |
| captures 13, 14 | B 1.5 s after A | opened; 86,528 frames; -28.10 / -16.51 dBFS; exit 0 | **refused** after 0.32 s, exit 251 |

Raw text of every refusal:

```
[in#0 @ 0x<ptr>] audio format is not supported
[in#0 @ 0x<ptr>] Error opening input: Input/output error
Error opening input file none:0.
Error opening input files: Input/output error
```

**Contradiction 2:** in 3 of 3 attempts two helpers did NOT both deliver; a second helper is refused while a first holds the device, and both can be refused when they open together. The design's hypothesis (its section 6: the system serves several clients, no shared capture needed) does not hold with this build on this device. The helper that did open delivered the level and the (deficient) frame count of a lone helper. The design's named fallback is supported by capture 5: ONE helper per device with one output per registered input delivered every channel sample-exact from a single open. An opened helper that started again half a second after another ended (captures 15, 16) opened without error.

## 6. Permission

| Question | Finding |
|---|---|
| Did a prompt appear | NOT OBSERVABLE (no screen). The first open (capture 1) returned samples 0.48 s after start with no error: either the grant already stood or it was answered at once by the user |
| What a capture without permission looks like | NOT OBTAINED: no open was denied. The all-zero form was seen only on channels 4 and 5, beside live channels of the same open, so it is the device's, not a denial. `audio format is not supported` occurred with the grant in place (the same command opened before and after), so it is no sign of a denial |
| Under which process | parent chain of the helper, names only: `ffmpeg <- python3 <- zsh <- claude <- disclaimer <- Claude <- launchd`. The application at the top of the chain is the one that hosts the agents; by SM-15 the grant it holds is standing and covers the built-in microphone too. The review recommends that the user switch it off again when this row closes; no agent changes a privacy setting |

## 7. Stall and end

Command (captures 15, 16): the push row without `-t`, a signal after 2.5 s, a hard kill armed at 5 s (not needed).

```
SIGTERM:  Exiting normally, received signal 15.   exit status 255   gone 47 ms after the signal   last progress: progress=end
SIGINT :  Exiting normally, received signal 2.    exit status 255   gone 50 ms after the signal   last progress: progress=end
```

Reading: the helper ends by itself within 50 ms of either signal, prints its totals line and `progress=end` first, and exits with status 255 - NOT 0 and not "killed by signal". An adapter must treat 255 after its own stop as the ordered end. No stall occurred in any capture (largest gap between file growth steps 25 to 43 ms). Nothing was unplugged; what an unplug does stays the user's check.

## 8. Against the design, in one table

| # | Design / review says | Measured | Consequence |
|---|---|---|---|
| 1 | rate right once the device is at 48,000 (W7 a gate) | 44.5 to 45.9% of the stated 96,000 delivered, cut at every 512-frame packet, unreported | the input layer of the pinned build is not fit to record at this rate; needs the same count at 48,000 after the user sets it; a count against wall time must be a check of the path |
| 2 | two helpers may share one device (hypothesis) | refused in 3 of 3 pairs | one helper per device with one output per input (works, sample-exact) |
| 3 | the helper states rate and channel count as two integers | rate as an integer, channels as the layout word `5.1`; nothing at the warning level | a closed layout table and an info-level literal |
| 4 | an open either works or is refused for a reason | 1 of 10 single opens refused, same command worked 40 s later | a bounded retry rule, or a refusal the operator understands |
| 5 | L1 in property-list form | works outside a sandbox (34.7 KiB for 4 devices); fails inside one | cap margin; a confined Core gets an error |
| 6 | the listing's rate is the control; `-ar 48000` unchanged | device at 96,000 now; the program converts to 48,000 without a word | SM-16 as written; the user sets 48,000 |
| 7 | - | first open: four channels at one identical level, once | unexplained; watch for it at the user's first pre-check |

Confirmed: the list line form; name equal in the three lists; order stable; `none:<n>` opens the indexed entry; the channel selection; the stop behaviour; no serial on this device; list times.

## 9. Not observable, not measured

- The system's prompt, the application it names, and what a denial looks like.
- Any behaviour at 48,000 Hz (the rate was not changed).
- That another index opens another device (one admissible device only); layout words for other channel counts.
- Channel to socket mapping; unplug; reboot; a rate changed during a capture.
- The cause of `audio format is not supported` and of the first open's levels.

## 10. End state (evidence)

```
captures made: 16      raw capture files left: []
.cache/task4-mm/: capture_count.txt  mm.py  session.log  numbers_c_byname.json  numbers_c_bynameR.json  numbers_c_fullA.json
  numbers_c_fullB2.json  numbers_c_pan.json  numbers_c_row_c0_ar48000_info.json  numbers_c_row_c2_ar48000_warning.json
  numbers_c_stop_INT.json  numbers_c_stop_TERM.json  numbers_c_two.json          (13 files; 0 audio files by extension)
pgrep -x ffmpeg: 0 processes        git status --short .cache: 0 lines (git-ignored)
device strings checked against the log and number files: 16, occurrences 0
```

Nothing was committed, sent or copied. No product file, no system setting and no dialog was touched.

---
*Generated: 2026-10-13 17:20*
*Last Updated: 2026-10-13 17:20*
