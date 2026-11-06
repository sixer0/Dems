# Row MM (track D) - measurement on the USB audio interface

| | |
|---|---|
| Agent | test-expert (agent MM) |
| Date | 2026-10-13, 17:09 to 17:15 WIB |
| Status | needs-review: measured in full; findings contradict the design in four places |
| Record | `test/mm_macos_microphone_measurement.md` |
| Decisions read | U22, U23, U24, C96 |
| Product files changed | none |
| Paths written | `.cache/task4-mm/` (script `mm.py`, `session.log`, `capture_count.txt`, ten `numbers_*.json`); this file; the record |
| Program | `.data/helpers/ffmpeg` = `/opt/homebrew/Cellar/ffmpeg/9.0.2/bin/ffmpeg` (byte-identical), `ffmpeg version 9.0.2` |
| Device opened | the USB interface only, selected from a fresh listing before each capture; no selection abort |
| Captures | 16 helper starts (12 opened, 4 refused at open), longest 4 s; all files deleted; 0 helper processes left |
| Settings, dialogs | none changed, none answered |
| Sandbox off for | the listing stage, each capture stage, `ps` / `pgrep`, the leak check |

## Findings for the controller

1. Lists: name equal in all three; helper audio list 2 entries (USB index 0, built-in index 1); order stable 5 of 5; `ioreg -a` fails inside the command sandbox.
2. `none:0` opens the USB interface; the helper states `Audio: pcm_f32le, 96000 Hz, 5.1, flt` at info level, nothing at warning level; the channel count is a layout word, not a number.
3. The device runs at 96,000 Hz now, not 48,000 (the user's to set). `-ar 48000` converts without a word. The helper delivers only about 45% of the stated samples, cut at every 512-frame packet, and reports nothing.
4. 6 channels: channel 0 carries the source (about -29 dBFS RMS when it sounds), channel 2 is faint (about -80), 1 and 3 are noise floor (-111), 4 and 5 exact zero. `pan=mono|c0=c<k>` is sample-exact.
5. Two helpers on the one device: refused in 3 of 3 pairs (`audio format is not supported`). One helper with one output per channel works.
6. Permission: no prompt observable, no denial obtained; chain `ffmpeg <- python3 <- zsh <- claude <- disclaimer <- Claude`.
7. Stop: `Exiting normally, received signal 15.` / `2.`, exit status 255, within 50 ms.

## Decisions wanted

- Whether the avfoundation input stays the capture layer for the macOS microphone path given finding 3 (repeat the count once the user has set 48,000 Hz; alternative E of the design otherwise).
- The one-helper-per-device form in place of two helpers (finding 5).
- A retry rule for the open that was refused once in ten single opens.
- For the user: set the interface to 48,000 Hz; say which inputs hold microphones (only channel 0 clearly hears the source); consider switching off the microphone grant of the application that hosts the agents.

## Blockers

None for this row. The security review's addendum can be written on the record.
