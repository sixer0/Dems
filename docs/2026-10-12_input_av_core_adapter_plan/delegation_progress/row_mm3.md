# Row MM3 (track D) - investigation of the sample loss on the USB audio interface

| | |
|---|---|
| Agent | test-expert (agent MM3) |
| Date | 2026-10-13, 17:51 to 18:03 WIB |
| Status | needs-review: cause established by measurement (the helper's input side); LOSSLESS arrangement NOT FOUND with the pinned tool; no other capture program on this Mac could be tried |
| Record | `test/mm3_macos_microphone_loss.md` |
| Decisions read | U24, C104, C106; records of rows MM and MM2 |
| Product files changed | none |
| Paths written | `.cache/task4-mm/` (`mm3.py`, `session3.log`, `state3.json`, `capture_count3.txt`, 35 `numbers3_*.json`); this file; the record |
| Program | `.data/helpers/ffmpeg`, `ffmpeg version 9.0.2`; one comparison start with `/opt/homebrew/bin/ffprobe` 9.0.2 (same package) |
| Device opened | the USB interface only (helper audio index 0), selected from a fresh listing before each start; no selection abort |
| Helper starts | 37 of 80 allowed (34 captured, 1 refused with `audio format is not supported`, 2 readers ended after one packet); longest `-t 60` (three times); all capture files and named pipes deleted; 0 helper processes left |
| Settings, dialogs | none changed, none answered; nothing installed, downloaded or built |
| Sandbox off for | every `mm3.py` run (the three lists and the device), the final process and redaction check |
| Deviation | no arrangement reached 100.0%, so the "60 s x 3 confirmation of a lossless arrangement" did not apply; 60 s x 3 was run on the product form. A quiet machine could not be had (load average 3.77 to 7.72). Added beyond the order, as experiments on the cause: the helper started through `taskpolicy` / `nice` (a per-process scheduling class, no system setting) |

## Findings for the controller

1. CAUSE: the INPUT side of the helper. It hands on exactly one 512-sample packet per read and reads about every 11.9 ms (median 11.68 to 12.06 ms) while the device produces a packet every 10.667 ms. Delivered rate = 512 / read interval in every capture: 11.9 ms gives about 43,300 per second (90%); with the helper in a lower scheduling class 44.8 ms gives 12,994 (27.0%), 94 ms gives 6,499 (13.4%), 105 ms gives 5,282 (11.0%). Readers that stop at "nothing available now" (`amovie`, `ffprobe`) end after ONE packet. The mechanism inside the build (one pending packet, a fixed sleep) is a HYPOTHESIS: the source was not read.
2. NOT the cause: the output (file 90.08%, `/dev/null` 90.67% and 89.39%, fast pipe 89.60%, null only 90.45%, stream copy 89.71%); the timestamps (stream copy shows the packets already missing; `asetpts`, `aresample=async=0` deliver the same rate); the load (correlation 0.135, n = 21); the layout word (`-ch_layout 6.0`: 90.19%).
3. The input has no audio buffer, queue or packet-size option (`-h demuxer=avfoundation` quoted in the record). `-thread_queue_size` 512 / 4096 / 16384, `-rtbufsize 256M`, `-probesize 32 -analyzeduration 0`, `-fflags +genpts`, `-use_wallclock_as_timestamps 1`, `-drop_late_frames 0`, `-fflags nobuffer -flags low_delay`: 89.4 to 91.0%, no effect.
4. TRAPS: `asetpts=N/SR/TB` gives 480,000 of 480,000 but takes 11.04 s of wall for 10 s; `aresample=async=1:first_pts=0` gives 480,000 of which 35,840 are inserted zeros; `-use_wallclock_as_timestamps 1` erases the gap pattern. A count against `-t` alone calls them lossless; only the count against wall time does not.
5. Product form (one helper, two outputs, each behind `-f fifo -fifo_format f32le -drop_pkts_on_overflow 1 -queue_size 32 -format_opts flush_packets=1`): 60 s x 3 = 2,607,104 / 2,594,816 / 2,601,472 of 2,880,000 (90.52 / 90.10 / 90.33%), 533 / 557 / 544 gaps, both outputs the same count, PRIMARY identical to the reference, CPU 3.9% (with two measuring outputs).
6. Stalled STANDBY reader, three times: PRIMARY lost 0 samples (identical to the reference: 520,704 / 521,216 / 523,776), longest pause 23 ms; STANDBY lost 128,000 / 126,976 / 126,976; the helper printed `FIFO queue full` (about 0.45 s after the stall began) and `FIFO queue flushed`.
7. The helper NEVER states the input loss (stream line, totals, exit status, debug level: nothing). Readable substitutes: a third output `-af ashowinfo -f null -` (per-packet timestamps), the end line `[out#N/fifo] audio:<KiB>`, or the Core counting samples per second of wall time on the pipe.
8. The development path (`mic-helper-args.ts` lines 58, 60, 73, 142) carries no option the measurement rows lacked; it has the same loss (F13 / D128).
9. On this Mac: no `afrecord`, no `sox`, no second FFmpeg version (the Homebrew binary is the pinned file), no Python audio module; `swift` / `clang` exist but a capture program would have to be built. Whether macOS itself delivers every sample from this device: NOT measured.
10. One refused open 7.09 s after the previous close: row MM2's "within 0.7 s of a close" does not hold as a rule.

## Decisions wanted

- The macOS microphone path cannot meet the evidence form with the pinned tool: a different capture program for macOS (to be built or installed: the user's word), or recording on Linux only (C106).
- Whether one further measurement that needs a BUILD is allowed: a minimal reader on the system audio interface, counting samples only, to prove the device and macOS deliver 48,000 per second.
- If the path stays for development: its label (not fit for evidence) and a sample count against wall time in the Core.
- A rule against `asetpts`, `aresample=async=1` and wall-clock timestamps in any evidence path.
- The queued two-output form: `fifo` added to SR-15's closed set.
- The device's buffer length (a device setting, untouched): hypothesis only, not measured.

## Blockers

None for this row. The row's question is answered in the negative.
