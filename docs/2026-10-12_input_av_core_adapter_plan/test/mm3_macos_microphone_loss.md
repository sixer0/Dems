---
task_id: 2026-10-12_input_av_core_adapter_plan
row: MM3 (track D)
date: 2026-10-13
agent: test-expert (agent MM3)
type: investigation record (Tier 2)
status: needs-review (cause established by measurement; NO lossless arrangement found with the pinned tool; no other capture program on this Mac could be tried)
decisions_read: U24, C104, C106; records of rows MM and MM2
source_changed: none (no product file; scripts and number files under `.cache/task4-mm/` only)
devices_opened: the user's USB audio interface only (37 helper starts); the built-in microphone, cameras: never
settings_changed: none; no dialog answered
session: 2026-10-13 17:51:48 to 18:03:07 WIB (host `date`)
---

# Row MM3: why a tenth of the audio is missing, and whether any arrangement delivers every sample

Words as in rows MM and MM2: "the helper" = `/Users/gsp-budi/Documents/DEMS/.data/helpers/ffmpeg` (`ffmpeg version 9.0.2`); "the USB interface" = the user's one USB audio device, helper audio index 0, six input channels, stated `pcm_f32le, 48000 Hz, 5.1`. "Packet" = one block of 512 sample frames as the helper hands it on. "Read interval" = the time between two consecutive packets leaving the helper's input (measured as the arrival interval of the `ashowinfo` lines). Expected = 48,000 x seconds. No audio is kept. Device names, serials and location values are not in this record, the log or the number files (checked: 16 device strings, 37 files, 0 occurrences).

## 0. Verdict

**LOSSLESS arrangement: NOT FOUND with the pinned tool.** 34 captures ran, in 29 arrangements (1 further start was refused at open, 2 readers ended after one packet); the 31 captures at normal priority delivered 89.4 to 91.8% of the samples (42,966 to 43,943 per second of wall time). No option of the input, no output form, no timestamp handling, no channel-layout word and no process priority raised it. Nothing is "nearest": the arrangements do not differ beyond the run-to-run spread. Two arrangements produce a count of exactly 100.000% of `-t`, and both are false: one takes 11.04 s of wall time to fill 10 s, the other fills the holes with silence.

**Another capture program on this Mac: none exists that could be tried** (section 7). Whether the device and macOS themselves deliver all 48,000 samples per second was therefore NOT measured.

**The cause is the INPUT side of the helper** (section 1): it hands on at most one 512-sample packet per read, and it reads about every 11.9 ms while the device produces a packet every 10.667 ms.

## 1. The cause, as far as established

| Candidate | Finding | Evidence (one line) |
|---|---|---|
| **Input (the helper's reading of the device)** | **THE CAUSE (determined)** | every frame is 512 samples and exactly one leaves per read; delivered rate = 512 / read interval in every capture: 11.9 ms gives 43,300 per second, 44.8 ms gives 12,994, 94 ms gives 6,499, 105 ms gives 5,282 |
| Output (slow sink, back-pressure) | NOT the cause | regular file 90.08%, `/dev/null` 90.67% and 89.39%, named pipe with a fast reader 89.60%, a null output alone 90.45%; stream copy with no decoder, filter or encoder 89.71% |
| Timestamps (samples delivered but dropped later) | NOT the cause | the packets are absent before any filter: stream copy carries the same gaps (97 and 100 per 10 s); `asetpts` and `aresample=async=0` deliver the same 43,490 and 43,507 per second |
| System load | NOT the cause | load average 3.77 to 7.72 across the session; correlation with the delivered rate 0.135 (n = 21) |
| Channel count | not separable, no effect seen | `-ch_layout 6.0`: 90.19%, 92 gaps; the input has no option to open fewer channels (row MM2); the packet is 512 frames at 96,000 Hz too (row MM) |

Determined by measurement:

1. In every capture the timestamps advance by 512 after about 90% of the packets and by 1,024 after the rest; (gaps x 512) equals the missing samples to one packet; the waveform steps at exactly those boundaries (4.6 to 10.8 times the normal step; 0.96 to 1.05 at the other boundaries).
2. The read interval has a median of 11.68 to 12.06 ms in all normal-priority captures. The device period is 512 / 48,000 = 10.667 ms. Predicted share 10.667 / 11.82 (mean interval of capture 1: 10 s / 846 packets) = 90.2%; measured 90.08%.
3. Slowing the helper's reading lowers the delivered count in proportion, with nothing else changed (the helper started through `/usr/sbin/taskpolicy`): read interval 44.77 ms gives 26.99%, 94.05 ms gives 13.44%, 105.20 ms gives 11.01%. Never more than one packet per read: `nb_samples {512: N}` in every capture; a read after 105 ms still returns 512 samples, not the 5,000 that arrived.
4. Two other readers of the same input, which stop at the first "nothing available now", end after exactly ONE packet: the helper's own `amovie` source (512 frames, exit 0 after 0.31 s) and `ffprobe` of the same package (1 packet, exit 0 after 0.32 s). So the input does not wait for the next packet; it answers "nothing now" between packets.
5. Row MM fits the same rule: at 96,000 Hz the packet is still 512 frames (5.33 ms) and about 43,700 per second arrived (45%).

HYPOTHESIS (the source of build 9.0.2 is not on this Mac and was not read; this is the mechanism the numbers fit): the input keeps ONE pending audio packet, a newer one from the system replaces it, and the program's input thread sleeps a fixed interval of about 10 ms (11.9 ms measured) whenever the input answers "nothing now". No option reaches that interval or the single slot.

Not established: why the interval is 11.9 ms and not 10 (`taskpolicy -l 0 -t 0`, the lowest timer-latency tier, left it at 11.81 ms: 90.72%).

## 2. Frame

| | |
|---|---|
| Script | `.cache/task4-mm/mm3.py`, importing `mm.py` and `mm2.py` (lists, selection rule, redaction, statistics). Log `.cache/task4-mm/session3.log`; numbers `.cache/task4-mm/numbers3_*.json` |
| Selection before EVERY start | row MM's rule unchanged (fresh USB tree, system list and helper list; exactly one USB input item; its name on exactly one USB audio device and exactly one helper entry; else exit 3), plus: abort unless the system list states 6 inputs at 48,000. Printed each time: `[AVFoundation indev @ 0x<ptr>] [0] <USB-AUDIO-1> | transport=usb | system list: inputs=6 rate=48000 | audio entries=2`. No abort occurred |
| Bounds | at most 60 s per capture, at most 80 starts: **37 used**; longest `-t 60` (three times). Not counted: listings, `-h demuxer=avfoundation`, `-h muxer=fifo`, `-devices`, one syntax check on a synthetic source |
| Outside the command sandbox | every `mm3.py` run (the three lists and the device), the final process and redaction check. Inside: help texts, the tool search, the synthetic syntax check, reading the repository |
| Measurement form (unless stated) | `ffmpeg -hide_banner -nostdin -nostats -loglevel info -f avfoundation <input options> -i none:0 -t 10 -map 0:a -c:a pcm_f32le -f f32le -flush_packets 1 -y <file> -t 10 -map 0:a -af ashowinfo -f null -` : six channels raw to a file (the sample count), and the helper's per-packet timestamps (the gaps). Continuity: mean step between neighbouring samples of channel 0 at packet boundaries with and without a timestamp gap, against the mean step elsewhere |
| Order of 100% confirmation | no arrangement reached 100.0% of the wall-clock rate, so no 60 s x 3 confirmation of a lossless arrangement took place; 60 s x 3 was run on the product form (section 8) |

## 3. What exists on this Mac (limit e)

| Program | Present | Use |
|---|---|---|
| `.data/helpers/ffmpeg` 9.0.2 | yes | the pinned helper |
| `/opt/homebrew/bin/ffmpeg` | yes, **byte-identical** to the pinned one (`cmp` with `/opt/homebrew/Cellar/ffmpeg/9.0.2/bin/ffmpeg`); the only version in the Cellar | no second version exists: the comparison of item 5 could not be made |
| `/opt/homebrew/bin/ffprobe` 9.0.2 | yes (same package) | one comparison start (section 6) |
| `/usr/bin/afrecord` | **absent** | - |
| `/usr/bin/afplay`, `afconvert`, `afinfo`, `afclip`, `afhash`, `afida`, `afktool`, `afscexpand` | yes | none records from a device |
| `sox`, `rec`, `arecord`, `gst-launch-1.0`, `SwitchAudioSource`, `audiodevice` | absent | - |
| `python3` 3.14.7 and 3.9.6 | yes; modules `sounddevice`, `pyaudio`, `objc`, `AVFoundation`, `CoreAudio`, `numpy`, `soundfile`: none installed | scripts only |
| `swift`, `swiftc`, `clang` | yes | not used: a capture program would have to be BUILT |
| QuickTime Player, Voice Memos | yes (applications with a window) | not tried, section 7 |
| Helper devices (`ffmpeg -devices`) | `avfoundation` (input), `lavfi` (input), `audiotoolbox` (OUTPUT only) | the build has no other audio input |

The development microphone path of the repository (`apps/core-server/src/capture/adapters/local/mic-helper-args.ts`): `QUIET` (line 58: `-hide_banner -nostdin -nostats -loglevel warning`), `-progress pipe:1`, `DEVICE_INPUT` (line 60: `-f avfoundation -i none:<name>`), `OUTPUT` (line 73: `-vn -ac 1 -ar 48000 -c:a pcm_f32le -f f32le -flush_packets 1 -y <pipe>`), assembled at line 142. **It carries no option the measurement rows lacked**: no thread queue size, no real-time buffer, no buffer option of any kind on the macOS input (`-thread_queue_size 1024` is in the Linux `alsa` head only, line 220). It is the same reading of the device and has the same loss (F13 / D128, "about 8/9" on the built-in microphone, is this fault).

## 4. Item 1: the input's own options

`ffmpeg -hide_banner -h demuxer=avfoundation`, the whole list:

```
AVFoundation indev AVOptions:
  -list_devices      <boolean>    .D......... list available devices (default false)
  -video_device_index <int>        .D......... select video device by index for devices with same name (starts at 0) (from -1 to INT_MAX) (default -1)
  -audio_device_index <int>        .D......... select audio device by index for devices with same name (starts at 0) (from -1 to INT_MAX) (default -1)
  -pixel_format      <pix_fmt>    .D......... set pixel format (default yuv420p)
  -framerate         <video_rate> .D......... set frame rate (default "ntsc")
  -video_size        <image_size> .D......... set video size
  -capture_cursor    <boolean>    .D......... capture the screen cursor (default false)
  -capture_mouse_clicks <boolean>    .D......... capture the screen mouse clicks (default false)
  -capture_raw_data  <boolean>    .D......... capture the raw data from device connection (default false)
  -drop_late_frames  <boolean>    .D......... drop frames that are available later than expected (default true)
```

There is NO audio buffer size, queue length or packet size option. `-drop_late_frames` exists; it changed nothing for audio.

| # | Input options (before `-i none:0`) | Received of 480,000 | Share | Gaps (x 512) | Per second of wall | Read interval median ms | Step ratio at gaps / clean | Load avg (1 min) | CPU % |
|---|---|---|---|---|---|---|---|---|---|
| 1 | none (baseline) | 432,384 | 90.080% | 93 | 43,251 | 11.93 | 5.78 / 1.03 | 4.19 | 3.0 |
| 2 | `-thread_queue_size 512` | REFUSED at open, exit 251, `audio format is not supported` (7.09 s after the previous helper ended) | | | | | | 4.29 | |
| 11 | `-thread_queue_size 512` (repeat) | 432,896 | 90.187% | 92 | 43,307 | 12.06 | 8.54 / 0.96 | 7.25 | 2.8 |
| 3 | `-thread_queue_size 4096` | 433,408 | 90.293% | 91 | 43,423 | 11.89 | 4.87 / 0.98 | 4.75 | 3.3 |
| 4 | `-thread_queue_size 16384` | 430,336 | 89.653% | 97 | 43,021 | 12.01 | 7.60 / 1.03 | 4.47 | 2.6 |
| 5 | `-rtbufsize 256M` | 433,920 | 90.400% | 90 | 43,353 | 11.84 | 5.40 / 0.99 | 4.56 | 2.9 |
| 6 | `-probesize 32 -analyzeduration 0` | 429,312 | 89.440% | 99 | 42,966 | 12.00 | 6.53 / 0.97 | 5.00 | 3.2 |
| 7 | `-fflags +genpts` | 436,480 | 90.933% | 86 | 43,591 | 11.90 | 8.61 / 0.99 | 5.07 | 3.0 |
| 8 | `-use_wallclock_as_timestamps 1` | 432,354 | 90.074% | see below | 43,261 | 11.90 | - | 6.23 | 2.9 |
| 9 | `-drop_late_frames 0` | 436,992 | 91.040% | 84 | 43,708 | 11.68 | 10.77 / 0.98 | 5.57 | 2.8 |
| 10 | `-fflags nobuffer -flags low_delay` | 432,640 | 90.133% | 92 | 43,355 | 11.90 | 8.93 / 1.01 | 7.72 | 2.8 |

Capture 8: the timestamps become the times of reading, so every packet is stamped about 601 samples after the previous one (512 + 89 or 90, i.e. the 12.5 ms between reads) and the device's own gap pattern is no longer visible; the count is unchanged. The helper printed, twice only: `Application provided invalid, non monotonically increasing dts to muxer in stream 0: 208907 >= 208907`. That option hides the evidence of the loss and cures nothing.

Reading: the program's queue between its input thread and the rest (`-thread_queue_size`), the real-time buffer and the probing options act AFTER the packet has been taken from the input; the packets are lost BEFORE that.

## 5. Items 2 and 3: the output side and the timestamps

| # | Arrangement (after `-i none:0`; `-t 10` on each output) | Received | Share | Gaps | Per second of wall | Load | CPU % |
|---|---|---|---|---|---|---|---|
| 12 | `-map 0:a -c:a copy -f f32le -flush_packets 1 -y <file>` + `-map 0:a -c:a copy -f framecrc -y <crc file>` (stream copy is accepted; no decoder, filter or encoder) | 430,592 | 89.707% | 97 (841 packets of 12,288 bytes) | 43,025 | 6.67 | 2.5 |
| 13 | the same, raw output to `/dev/null` | 429,056 (packet list) | 89.387% | 100 (838 packets) | - | 6.30 | 2.3 |
| 14 | ONLY `-map 0:a -af ashowinfo -f null -` | 434,176 (frame list) | 90.453% | 91 | - | 6.16 | 2.7 |
| 15 | `-c:a pcm_f32le -f f32le -y /dev/null` + frame list | 435,200 (frame list) | 90.667% | 89 | - | 5.98 | 3.3 |
| 16 | `-c:a pcm_f32le -f f32le -flush_packets 1 -y <named pipe>` read by a fast reader (1,680 reads, longest pause 25 ms) + frame list | 430,080 | 89.600% | 98 | 43,051 | 6.41 | 3.2 |
| 17 | `-af asetpts=N/SR/TB` on the file output | **480,000 = 100.000% of `-t`, in 11.037 s of wall** | 90.6% of wall | 88 in the untouched frame list | 43,490 | 6.57 | 3.1 |
| 18 | `-af aresample=async=0` | 434,944 | 90.613% | 88 | 43,507 | 6.21 | 3.2 |
| 19 | `-af aresample=async=1:first_pts=0` | **480,000 = 100.000% of `-t`, in 10.092 s** | **of which 35,840 samples are inserted silence** (7 runs of exact zero on channel 0) | 78 real gaps (39,936 samples) | 47,562 written | 6.16 | 3.0 |
| 20 | `-copyts`, `-t 10` on the input | 431,872 | 89.973% | 94 | 43,192 | 6.86 | 3.3 |

Reading:
- The sink does not matter: a file, `/dev/null`, a fast pipe and no sink at all lose the same share. It is not back-pressure.
- Stream copy shows the packets missing as they leave the input: 12,288 bytes each (512 x 6 x 4), about one in ten with the next timestamp 1,024 samples on.
- **Two counts of 100.000% are traps.** `asetpts=N/SR/TB` renumbers the packets as if contiguous: `-t 10` is then filled with 10 s worth of samples that took 11.04 s to arrive; the waveform still steps at every former gap (ratio 6.93 against 1.05). `aresample=async=1` pads the holes with zeros in bursts: the count is right and 35,840 samples are silence that was never recorded. A sample count against `-t` alone would call both lossless. Only the count against WALL time (or the timestamps before any filter) tells the truth.

## 6. Items 4 and 5: load, priority, channel layout, other readers

| # | Arrangement | Received of 480,000 | Share | Gaps | Read interval median / p99 / max ms | Load | CPU % |
|---|---|---|---|---|---|---|---|
| 22 | `/usr/sbin/taskpolicy -l 0 -t 0 ffmpeg ...` (lowest timer-latency tier) | 435,456 | 90.720% | 87 | 11.81 / 20.31 / 23.08 | 6.73 | 3.6 |
| 24 | `/usr/sbin/taskpolicy -l 5 -t 5 ffmpeg ...` | 438,016 | 91.253% | 82 | 11.82 / 12.67 / 22.47 | 6.55 | 3.5 |
| 25 | `/usr/bin/nice -n 20 ffmpeg ...` | 433,920 | 90.400% | 89 (one of 1,024) | 11.87 / 20.86 / 36.73 | 6.39 | 3.3 |
| 36 | `/usr/sbin/taskpolicy -c utility ffmpeg ...` | 129,536 | 26.987% | 234 (up to 2,048) | 44.77 / 50.02 / 50.07 | 3.77 | 2.1 |
| 37 | `/usr/sbin/taskpolicy -c maintenance ffmpeg ...` | 64,512 | 13.440% | 121 (up to 5,632) | 94.05 / 109.85 / 109.96 | 3.88 | 3.7 |
| 23 | `/usr/sbin/taskpolicy -b ffmpeg ...` (background) | 52,840 | 11.008% | 104 (up to 9,717) | 105.20 / 131.83 / 166.82 | 6.19 | 2.8 |
| 21 | `-ch_layout 6.0` on the input | 432,896 | 90.187% | 92 | 11.89 / 21.61 / 27.72 | 6.84 | 3.6 |
| 26 | `-f lavfi -i amovie=filename=none\\:0:f=avfoundation` (the helper's filter source reading the same input) | 512, then end, exit 0 after 0.309 s | | | | 6.62 | |
| 27 | COMPARISON, not the pinned helper: `/opt/homebrew/bin/ffprobe -f avfoundation -i none:0 -read_intervals %+10 -show_entries packet=pts,duration,size -of csv` | 1 packet (512), then end, exit 0 after 0.320 s | | | | 6.62 | |
| 28, 29 | `-loglevel debug`, `-t 3`, one file output | 131,200 and 132,224 of 144,000 | 91.11%, 91.82% | 25, 23 | - | 5.10 | 4.5 |

`taskpolicy` and `nice` start one process with a scheduling class; they change no system setting. They are in the record as an experiment on the cause, not as a proposal.

Reading:
- **Load:** the machine could not be made quiet (other work of the session was running): the 1-minute load average was 3.77 to 7.72. Over the 21 normal-priority 10 s captures the delivered rate was 42,982 to 44,052 per second with no relation to the load (correlation 0.135). "Quiet" in the strict sense was NOT measured.
- **Priority:** nothing raises the count; lowering the helper's scheduling class lowers it in proportion to the read interval. A capture helper that is ever put in a background class loses 73 to 89% and still prints nothing.
- **Channel layout:** no effect. A different channel COUNT cannot be asked of this input.
- **Another version of the program:** none on this Mac.
- **Debug level:** in 3 s with 23 packets missing the helper printed 23 lines after start-up, all of them its ordinary end-of-stream lines. No line names a missing packet at any log level.

Refusal seen once (capture 2): `audio format is not supported`, exit 251, **7.09 s after the previous helper had ended**. Row MM2's three refusals all came within 0.7 s of a close; this one did not, so "tied to re-opening soon" does not hold as a rule. 1 of 37 starts; the same command opened 3 minutes later.

## 7. Item 6: another capture program

None was tried, for these reasons:

| Candidate | Why not |
|---|---|
| Apple command-line audio tools | `afrecord` is not installed. The eight `af*` tools present play, convert or inspect files; none opens an input device |
| QuickTime Player, Voice Memos | applications with a window: they cannot be started or driven from the command sandbox (launch services and scripting of other applications are off), the input is chosen in the application or follows the system's default input, and they keep audio. Not tried |
| A second FFmpeg | does not exist here (the Homebrew one is the pinned file) |
| Python | no audio module installed in either interpreter; installing one is outside the limits |
| A small program on the system audio interface (Swift, C) | the compilers are present, but it would have to be BUILT: outside limit (e). Not done |

Consequence: this row cannot say whether a callback-based reader on this Mac receives all 48,000 samples per second from this device. Nothing measured here points at the device or at macOS (the gaps follow the helper's own read interval exactly), but the positive proof is missing.

## 8. The best arrangement in the product's form, and its numbers

No arrangement is better than another in loss. The form below is row MM2's form C: one helper, one output per channel, each behind the helper's own dropping queue so that a stalled reader of one output cannot stop the other. **It is NOT lossless.**

```
-hide_banner -nostdin -nostats -loglevel info -thread_queue_size 1024 -f avfoundation -i none:0
-map 0:a -af pan=mono|c0=c0 -ac 1 -ar 48000 -c:a pcm_f32le -f fifo -fifo_format f32le -drop_pkts_on_overflow 1 -queue_size 32 -format_opts flush_packets=1 -y <pipe PRIMARY>
-map 0:a -af pan=mono|c0=c2 -ac 1 -ar 48000 -c:a pcm_f32le -f fifo -fifo_format f32le -drop_pkts_on_overflow 1 -queue_size 32 -format_opts flush_packets=1 -y <pipe STANDBY>
```

As measured, each output also had `-t 60` (or `-t 12`) and the same helper had two measuring outputs more: channel 0 to a regular file (`-map 0:a -af pan=mono|c0=c0 -ac 1 -ar 48000 -c:a pcm_f32le -f f32le -flush_packets 1 -y <file>`, the reference for what the input delivered) and `-map 0:a -af ashowinfo -f null -` (the gaps). Both pipes were read by fast readers.

### 8.1 Sixty seconds, three times

| # | Expected | PRIMARY pipe | STANDBY pipe | Share | Gaps (x 512 = missing) | Per second of wall | PRIMARY against the reference file | Step ratio at every 512 | Load | CPU % |
|---|---|---|---|---|---|---|---|---|---|---|
| 30 | 2,880,000 | 2,607,104 | 2,607,104 | 90.524% | 533 (272,896) | 43,457 | 0 lost, 2,607,104 samples identical | 1.50 (at gaps 5.87, clean 0.99) | 5.93 | 3.9 |
| 31 | 2,880,000 | 2,594,816 | 2,594,816 | 90.098% | 557 (285,184) | 43,248 | 0 lost, identical | 1.64 | 5.04 | 3.9 |
| 32 | 2,880,000 | 2,601,472 | 2,601,472 | 90.329% | 544 (278,528) | 43,365 | 0 lost, identical | 1.50 | 6.97 | 3.9 |

**In one minute 273,000 to 285,000 samples (5.7 to 5.9 seconds of audio) are missing, in 533 to 557 holes of 10.67 ms.** The longest pause between two reads of the PRIMARY pipe was 23 to 32 ms. The helper's lines: stream line unchanged, `size=N/A time=00:01:00.00 bitrate=N/A speed=   1x`, exit 0.

Not explained: in captures 31 and 32 the first timestamp of the frame list was 512, not 0, and the split of the step statistic into "at a gap" and "clean" did not separate (1.31 against 1.68; 1.19 against 1.53), while the count identity (gaps x 512 = missing, exactly) held. HYPOTHESIS: the file and the frame list differ by one leading packet in those two runs. In captures 30 and 33 to 35 (first timestamp 0) the split is clear.

CPU: 3.9% of one core with the two measuring outputs (row MM2: 4.9% for the two queued outputs alone over 9 s).

### 8.2 A STANDBY reader that stops (three times)

`-t 12`, expected 576,000; the reader of the STANDBY pipe stops 3.0 s after the first data and resumes 3.0 s later; the PRIMARY pipe is read all the time.

| # | PRIMARY pipe | Reference file (what the input delivered) | **PRIMARY lost to the stall** | PRIMARY longest pause | PRIMARY frames per second (12 values) | STANDBY pipe | STANDBY lost | What the helper printed |
|---|---|---|---|---|---|---|---|---|
| 33 | 520,704 (90.400%) | 520,704 | **0; every sample identical** | 23 ms | 43,008 to 44,032 | 392,704 | 128,000 | `[fifo @ 0x<ptr>] FIFO queue full` at 3.699 s; `[fifo @ 0x<ptr>] FIFO queue flushed` at 6.260 s |
| 34 | 521,216 (90.489%) | 521,216 | **0; identical** | 23 ms | 42,496 to 44,032 | 394,240 | 126,976 | the same two lines at 3.751 s and 6.302 s |
| 35 | 523,776 (90.933%) | 523,776 | **0; identical** | 23 ms | 42,496 to 45,056 | 396,800 | 126,976 | the same two lines at 3.723 s and 6.257 s |

Reading: with the queue in front of each output the stalled STANDBY reader costs the PRIMARY nothing (3 of 3, sample for sample against the reference), and the helper names the stalled output's overflow about 0.45 s after the reader stopped and its recovery about 0.26 s after it resumed. Exit 0. The PRIMARY still carries the 9 to 10% input loss. Not measured: a stalled PRIMARY reader, a reader that closes its pipe, other queue sizes. The output format name `fifo` is outside SR-15's closed set.

### 8.3 Does the helper state the input loss

**No.** Not in the stream line, not in the totals line, not in the exit status, not at debug level.

| Where a loss could be read | What it shows |
|---|---|
| `[fifo @ ...] FIFO queue full` / `FIFO queue flushed` | only a stalled READER's overflow, never the input loss |
| the totals line and `-progress` | `time=` follows the timestamps, so it reads 60.00 s for a minute with 5.8 s missing; for a queued output `size=N/A` |
| the per-output line at the end: `[out#0/fifo @ 0x<ptr>] video:0KiB audio:10184KiB ...` | 10,184 KiB / 4 bytes = 2,607,104 samples: the true count, but only once, at the end |
| a third output `-map 0:a -af ashowinfo -f null -` | one line per packet (about 85 per second, 0.9 MB of diagnostics per minute) with `pts` and `nb_samples`; a reader can add `next pts - pts - nb_samples`: this is the only running statement of the loss the helper can be made to give |
| outside the helper | the samples arriving on the pipe counted against the wall clock: 43,300 per second instead of 48,000 shows the loss within a second, without any helper line |

## 9. What the user would have to decide

1. **The macOS microphone path.** With the pinned tool it cannot meet the evidence form at any setting tried. The choices of C106 stand: a different capture program for macOS (none is on this Mac; it would have to be built or installed, which is the user's word), or recording on Linux only.
2. **Whether to allow one further measurement that needs a build:** a minimal reader on the system audio interface, counting samples only, to prove that the device and macOS deliver 48,000 per second. Without it "the device side is whole" is an inference from the read-interval rule, not a measurement.
3. **The device's buffer length** (512 frames now; a setting of the device, not touched): HYPOTHESIS only, that packets longer than the helper's read interval would be picked up whole. The read interval reached 22 to 37 ms at its maximum in these runs, so even 1,024 frames (21.3 ms) would not be safe by these numbers. Not measured; changing it is the user's act.
4. **If the path is kept for development:** that it is labelled as not fit for evidence, and that the Core counts the delivered samples against the wall clock (section 8.3) so that the loss is stated.
5. **Never in an evidence path:** `asetpts=N/SR/TB`, `aresample=async=1`, `-use_wallclock_as_timestamps 1`: each makes the count or the timestamps look whole while the audio is not.
6. **The queued two-output form** (section 8): adopting it adds `fifo` to SR-15's closed set.
7. **The refused open** (1 of 37 here, 7 s after a close): a bounded retry remains the only supported measure; the cause is still unknown.

## 10. Not measured

- A truly quiet machine (load below 3.77 did not occur).
- Any reader other than the pinned program and `ffprobe` of the same package.
- Another device buffer length, another rate, another device.
- A stalled PRIMARY reader; a reader that closes its pipe; queue sizes other than 32.
- The product form without the two measuring outputs over 60 s (row MM2 measured it over 9 s).
- The cause of the 11.9 ms read interval, and of the refused open.

## 11. End state (evidence)

```
helper starts on the device this session: 37 (capture_count3.txt)
capture / FIFO files left: []        find .cache/task4-mm -type p: 0        *.raw, *.crc, *.csv, cap3*, fifo*: 0
.cache/task4-mm/ (73 entries): rows MM and MM2's 34 files; mm3.py, session3.log, state3.json, capture_count3.txt,
  35 numbers3_*.json (one per arrangement; the repeated tags tq512_10 and loglevel_debug hold their second run)     (0 audio files)
pgrep -x ffmpeg: 0        pgrep -x ffprobe: 0        ps ax | grep ffmpeg: no line        git status --short .cache: 0 lines (git-ignored)
device strings checked against session3.log, mm3.py and the 35 number files: 16 strings, 37 files, 0 occurrences
selection after the last capture: still unambiguous, index 0, inputs 6, rate 48000 (no setting changed)
```

Nothing was installed, downloaded, built, committed, sent or copied. No product file, no system setting and no dialog was touched.

---
*Generated: 2026-10-13 18:06*
*Last Updated: 2026-10-13 18:06*
