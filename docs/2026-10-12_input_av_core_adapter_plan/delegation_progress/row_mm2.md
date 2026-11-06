# Row MM2 (track D) - second measurement on the USB audio interface, device at 48,000 Hz

| | |
|---|---|
| Agent | test-expert (agent MM2) |
| Date | 2026-10-13, 17:39 to 17:43 WIB |
| Status | needs-review: measured within the 40-start bound; the loss remains (about 10%); a stalled output stops the other in the plain two-output form |
| Record | `test/mm2_macos_microphone_48k.md` |
| Decisions read | U23, U24, C96, C104; record of row MM |
| Product files changed | none |
| Paths written | `.cache/task4-mm/` (`mm2.py`, `session2.log`, `session2_dry.log`, `state2.json`, `capture_count2.txt`, sixteen `numbers2_*.json`); this file; the record |
| Program | `.data/helpers/ffmpeg`, `ffmpeg version 9.0.2` |
| Device opened | the USB interface only (helper audio index 0), selected from a fresh listing before each capture; no selection abort |
| Helper starts | 40 of 40 allowed (35 opened, 3 refused with `audio format is not supported`, 2 refused for a tried input option); longest `-t 10`; all capture files and both named pipes deleted; 0 helper processes left |
| Settings, dialogs | none changed, none answered |
| Sandbox off for | the rate listing, each capture stage, the final process / privacy check |
| Deviation | the order's counts exceed 40 starts: "with / without `-ar`" measured as outputs of one helper; 12 paused opens instead of 20; the second open of point 4 is the first capture of point 2 |

## Findings for the controller

1. Rate: system list 48,000; helper line `Stream #0:0: Audio: pcm_f32le, 48000 Hz, 5.1, flt, 9216 kb/s`. The USB interface is now also the system's default input (not changed by this row).
2. Loss: 131,200 / 130,688 / 130,688 of 144,000; 214,912 / 217,472 / 216,448 of 240,000; 432,896 / 433,408 / 432,384 of 480,000 (89.5 to 91.5%). Identical with and without `-ar 48000`. Whole 512-sample packets missing about 9 times per second, proven by the helper's frame timestamps and by the waveform step at those boundaries (5.4 to 8.3 times; 1.0 elsewhere).
3. Refusals: 3 of 38 opens (`audio format is not supported`, exit 251); paused series 0 of 12, no-pause series 1 of 10; all three within 0.7 s of a previous close; immediate retry opened 3 of 3. Tied to re-opening soon: suggested, not established.
4. First open: four different levels (-29.78 / -93.48 / -80.66 / -115.56 dBFS, channels 4 and 5 zero); the identical -6.96 dBFS did not recur in 32 opens with levels.
5. Two outputs from one helper: `-map 0:a -af pan=mono|c0=c<k> -ac 1 -ar 48000 -c:a pcm_f32le -f f32le -flush_packets 1 -y <out>` twice; same count, difference 0 against the 6-channel reference; 4.8% of one core. A reader of one output that stops for 3 s stops the OTHER output for 2.77 s (275,328 of about 388,000 frames), no message, exit 0. With `-f fifo -fifo_format f32le -drop_pkts_on_overflow 1 -queue_size 32` per output the other output continues (388,480) and the helper prints `FIFO queue full` / `FIFO queue flushed`.
6. Layout word `5.1` at 48,000 too. `-channels 2`: unrecognized option. `-ch_layout stereo`: refused, "has 2 channels, but input has 6 channels". `-ch_layout 6.0`: accepted, the line then says `6.0`.
7. Levels: channel 0 carries the source (-29.78 / -9.58 dBFS; RMS -25 to -32); channel 2 faint (-80.66, follows channel 0); channel 1 floor -93.5; channel 3 floor -115.6; channels 4 and 5 exact zero. One audible microphone. Channel 0 reaches 0.00 dBFS at the source's loud moments.

## Decisions wanted

- Whether the avfoundation input stays the capture layer: at the required rate it still loses about a tenth of the audio (alternative E of the design otherwise).
- How the one-helper form keeps a stalled STANDBY consumer from stopping the PRIMARY: the queued output form (adds the format name `fifo` to SR-15's closed set; measured once) or another means.
- A bounded retry on `audio format is not supported` (an immediate retry opened 3 of 3).
- The stated channel count: a closed layout-word table, or the integer from another line.
- For the user: a second microphone is not visible on any channel; the input gain lets channel 0 clip at loud moments.

## Blockers

None for this row.
