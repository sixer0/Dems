# Row 37: audio access (HOST-26..28; PD-11-05)

Date: 2026-10-22, host .73 (D30). Commands: masterplan/02_plan.md row 37 verbatim.
- HOST-26: `1` (dems-core in `audio`). `alsa-utils: /usr/bin/arecord`.
- HOST-27: card listed by name for dems-core `1`; `lsusb` 3347:2430 `1`; `/proc/asound/cards` USB-Audio BOMGE `1`; `usb_card_index=1`; by-id link `1` -> `controlC1`.
- HOST-28: seat0 sessions `1` - a desktop session is present, so HOST-28 is recorded as "not measurable now: desktop session present" (the executor logs nobody out). For the DEMS card itself: `usb_capture_holders=0`. Per node: `pcmC1D0c 0`, `pcmC2D0c 0`, `pcmC2D2c 0`. Sound-server processes (pipewire|wireplumber|pulseaudio): `3`.
- File written: /etc/group (audio gains dems-core).
