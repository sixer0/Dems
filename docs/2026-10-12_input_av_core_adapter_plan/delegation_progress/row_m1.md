# Row M1 (track D) - design of the macOS production microphone path

- Agent: data-analyst (designer). Date: 2026-10-13 16:14 (host `date`).
- Status: **needs-review** - the design is written; it goes to the security review (U22 (1)); seven questions are the user's; eleven points cannot be proven without opening a device.
- File written: `masterplan/06_design_macos_microphone.md` (Tier 1). This file. No source file changed. No device opened, listed through the capture program, or recorded from.

## Commands run (all read-only; values redacted at the source: key names, types, counts, yes/no only)

| Command | Sandbox | Purpose |
|---|---|---|
| `sw_vers`, `uname -m` | in | platform |
| pinned FFmpeg `-version`, `-h demuxer=avfoundation` | in | version; the options of the input (help text; opens nothing) |
| `strings -a` on the pinned `libavdevice` | in | the fixed texts of the device list line |
| `ioreg -p IOUSB -l -w 0`; `ioreg -r -c IOUSBHostDevice -l [-d 2] -w 0`; `ioreg -r -c AppleUSBAudioControlNub [-t] [-l]` | in (one joined run out) | size and form of the USB tree |
| `system_profiler SPAudioDataType -json` | in: empty list; out: the real form (two runs outside the sandbox, as the task allowed this command) | form of the audio facts; the finding that a confined process gets an empty list |
| NOT run | - | `ffmpeg -f avfoundation -list_devices`, any open of a device |

One web fetch: the capture program's public `avfoundation.m` (main branch), read through a summarising tool; its claims are marked unverified where the pinned build was not checked (two of them were contradicted by the pinned build and are not used).

## Recommendations (sections of the design)

1. Listing: three fixed rows without a parameter - `/usr/sbin/ioreg -r -c IOUSBHostDevice -l -d 2 -w 0`, `/usr/sbin/system_profiler SPAudioDataType -json`, the audio helper's existing device-list row.
2. Identity: USB id from two integers, serial where stated, the location id as the port path; the existing match function unchanged; the tie to the capture program's index by name uniqueness in all three lists, verified at open, at start and after the settle time; any doubt refused.
3. Capture: `-f avfoundation -i none:<n>` (one integer), `-af pan=mono|c0=c<k>`, the existing output line; 48,000 Hz required of the device; named amendment SR-14 (words in section 4.3).
4. Permission: not checkable without an open; stated as not known at boot; the user's first pre-check answers the system's question; a silence statement in the pre-check proposed.
5. Two inputs: as on Linux - two registered inputs, of two devices or of one multi-channel device.
6. Loss and restart: same paths; no shared-capture configuration; a stall bound and a third listing are new on macOS.

## Work packages

8 build rows (S 4, M 4) plus the security review; no contract member, no schema change.

## For the controller

- Observation outside this row: `CS/capture/__tests__/static.test.ts:1078-1079` expects `-channels` while `CS/capture/adapters/local/mic-helper-args.ts:220` builds `-ch_layout` (row 79b's pin).
- "SR-13" was named and not taken in C90; the amendment is proposed as SR-14, the number is the controller's.
- The Mac currently shows one USB audio input device with 6 input channels at 96,000 Hz and no serial number: questions Q1 and Q2 of the design.
- The specifications, the addendum and the records were read by section and by search, not all in full; the design says which (its section 13).
