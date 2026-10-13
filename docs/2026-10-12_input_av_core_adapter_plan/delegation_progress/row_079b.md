# Row 79b - progress (driver, track D)

Status: **complete**. Record: `implementation/079b_mic_helper_argument_row.md`.

- Defect (C89; test/079 section 5): the Linux microphone helper's list was refused by the pinned FFmpeg 9.0.2, `Option channels not found`, 0 of 18.
- Row before: `[..., '-c:a', 'pcm_s24le', '-channels']` + one of 64 words `'1'`..`'64'`.
- Row after: `[..., '-c:a', 'pcm_s24le', '-ch_layout']` + one of 64 words `'1C'`..`'64C'` (`LINUX_CHANNEL_LAYOUTS`, taken by the card's live channel count; no computed text).
- Development rows: NOT changed. They never had an input-side channel option (`avfoundation`, `lavfi`, `wav`); only the shared output line says `-ac 1`.

Checks:
- Container (Ubuntu 24.04.5, image `b914f7078f7b`, pinned 9.0.2, ALSA `null` / `file`), the product's own lists: the 18 cases of test/079 **18 of 18 accepted**; counts 1 to 64 **64 of 64**; selection through ALSA `file` 5 of 5 (only the selected channel's constant in the pipe); controls refused 3 of 3.
- macOS (pinned 9.0.2): raw-input stand-in for the device layer 130 of 130 lists accepted and selected; old word refused (exit 8). Generated microphone: `Tests 53 passed (53)` (adapter + generated-tone test); scripted capture `PASS`, 217,088 samples, 48,009 samples/s, float 32 mono, peak -18.1 dBFS, RMS -21.1 dBFS.
- Unit / static: `Tests 163 passed (163)` on the final tree (first run 1 failed of 230: one more pin of the old row, moved; second run 52 of 52). `tsc --noEmit` exit 0.

Files: `mic-helper-args.ts`, `local/__tests__/mic-helper-args.test.ts`, `capture/__tests__/static.test.ts` (the SR-4 pin of this row), `audio/__tests__/usb-audio-production.test.ts` (the lines spelling the row), `apps/capture-worker/README.md` (one passage), one line each in `file_claims.md`, `file_requests.md`.

Request left: `scripts/hardware-acceptance/collect-h08.sh` and its test do not know `-ch_layout` (blocking for the reading of `9A/H-08.6`, not for this row).

Unproven until hardware: `9A/H-07`, `9A/H-08` (shared capture of a real card with this layout, the heard input, a real card's channel map), `9A/H-01` (amd64 build).

Driver decisions: capital-C layout word over `-ac` / small c; the adapter test's row lines edited; `channelLayouts` exported on the table; "level frames" shown by the scripted capture, not by a whole Core-and-worker session.

Containers left: none (`docker ps -a --filter label=dems.agent=row079b`: 0 rows). Edit tool only for existing repository files: kept.
