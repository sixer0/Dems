# Row 1 progress — explore input-av

| Field | Value |
|---|---|
| Row | 1 |
| Agent | explore (reasoning tier, per the Execution Profile) |
| Date | 2026-10-12 17:22 |
| Status | complete |
| Artifact | `research/01_explore_input_av.md` |

## Verification criteria of the row

| Criterion | Result | Where |
|---|---|---|
| Every `.py` file appears once with one label and a `file:line` | 31 files (23 + 8), count by `find nvr -name '*.py' \| wc -l` = 31. `nvr/routers/__init__.py` is empty (0 lines), so it has no line to cite | section 2 |
| "Tested input scheme" holds the nine named groups | TS-1 to TS-9 present, each quoted with `file:line`; plus TS-10 (audio capture argument list) and TS-11 (discovery methods and intervals) | section 4 |
| "Non-recording tools" holds the four tools with module and what each writes | factory-IP scan, set camera IP, gain calibration, doctor | section 5 |

## Limits observed

- Nothing under `apps/input-av/data/` was listed, opened or read.
- No `.env` file was read (`.env.example` was read; it holds no secret).
- input-av was not started, no script was run, no network device was contacted.
- Only two files were written, both inside the task folder.

## Milestones

- Per-file inventory with labels and 38 hardware items (H-01 to H-38) for the verdicts of row 7.
- Exact FFmpeg argument lists for camera and audio, the ALSA configuration template, the `pan` rule, the reconnect rule.
- Gain calibration located: `nvr/audio.py` + `nvr/routers/audio.py` + `nvr/web/index.html:564-660`.

## Decisions and findings for the controller to record

1. Source against P3 (section 6 of the artifact):
   - "Main stream" is a rule (largest pixel area per video source; first profile on the single-camera path; admin may switch to the sub stream).
   - Camera audio is not copied: it is re-encoded to AAC 48 kHz 128k inside the MPEG-TS.
   - 24-bit / 48 kHz is the API default; the card is opened in its native format (S32_LE preferred) at one rate per card.
   - All four bench cameras deliver H.265 while ONVIF reports H264; input-av never tests the codec.
   - MPEG-TS is chosen for an ingest reason (H.265 cameras not sending parameter sets at RTSP start), which touches Q8.
2. Scope of "tested": the camera scheme was recorded on four real H.265 cameras; the audio files of that run were silent; the bit-exact audio proof used the onboard laptop card with virtual H.264 cameras. No physical test on record for reconnect, A/V sync, WAV RF64, camera audio, dual-lens, 8-input interface.
3. `doctor.run_checks()` calls `init_db()` first, so the doctor can create or migrate the database.
4. Camera password and RTSP URL with credentials are stored in plain text in `cameras`.
5. `apps/input-av/` is untracked in the DEMS repository (`?? apps/input-av/`); its own `.gitignore` lists `data/`.
6. Labelling choice: `service.py`, `playback.py`, `storage.py`, `doctor.py` are not labelled HARDWARE_LOGIC as files; their hardware behaviour is carried by H items so row 7 loses nothing.

## Blockers

None.

## Note on instructions

The agent's base instructions say not to write report files; the delegation and the Documentation Contract require this artifact. The delegation was followed.
