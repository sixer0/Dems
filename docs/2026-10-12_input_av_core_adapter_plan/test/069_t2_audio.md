---
task_slug: input_av_core_adapter_plan
row: 69
work_package: WP-08 (real-code check T-2 for audio, on macOS)
date: 2026-10-13
agent: test-expert (batch 8, agent H)
status: complete on macOS with a generated source; the ALSA half is unproven (9A/H-07, 9A/H-08, row 79)
tier: T2
---

# Row 69: real-code check T-2 for audio on macOS - the production microphone path with a generated 8-channel source

Tier 2: what was found, why it matters, how it was verified, source. A measurement: no product file was changed, nothing was built. No device of this Mac was opened: the only input of any process was `-f lavfi`.

## 1. Result

Five runs, 2026-10-13 02:08 to 02:12 UTC, all PASS on every criterion:

| Run | Kind | MIC-01 / MIC-02 = input of the 8-input card | Outcome |
|---|---|---|---|
| `pipe_a` | the pipe read by the driver | 3 / 6 | **386,048 of 386,048 samples equal** to the driver's own reference of input 3, and the same for input 6; first mismatch: none |
| `pipe_b` | the pipe read by the driver | 6 / 1 | 386,048 of 386,048 for input 6 and for input 1 |
| `worker_a1` | release worker, session of 17 s | 3 (recorded) / 6 | plan accepted; the pre-encode tap and the decoded file hold the 523 Hz tone of input 3 in 15 of 15 judged seconds, no other tone |
| `worker_b1` | release worker, session of 17 s | 6 (recorded) / 3 | the same with the 859 Hz tone of input 6 |
| `worker_a2` | release worker, session of 17 s | 3 (recorded) / 6 | as `worker_a1` |

Row's Verification cell - "a decodable audio file whose content is the selected channel of the source, checked for 2 different channels": **met for inputs 3 and 6** (`worker_a1`, `worker_a2`: `VIDEO-01.mp4`, AAC mono 48,000 Hz, playable, 523 Hz; `worker_b1`: 859 Hz). Sample-exactness is shown at the PIPE for inputs 1, 3 and 6 (the stored audio is resampled and AAC-encoded by design, `mic-transport.ts:31-39`; it cannot be sample-exact).

Facts per question of the delegation:

| Question | Fact |
|---|---|
| The worker accepts the format (32-bit float, 48 kHz, mono) | `START` acknowledged `ok: true` in 3 of 3 (worker `capture-worker/0.6.0`, protocol 4); worker exit 0; 0 `CRASH`; 0 lines that are no frame; record `AUDIO_SOURCE_INTERVAL` for `MIC-01` / `PRIMARY` from sample 0 and `AUDIO_TIMELINE_END` (843,360 / 844,320 / 841,440 samples). The adapter's handle states `F32LE`, 48,000, 1 channel, placement `ARRIVAL`; its `input` went into the plan unchanged |
| The selected channel arrives sample-exact | at the pipe: every sample equals `floor(2^21 sin(2 pi F n / 48000) + 0.5) / 2^23` of the selected input, computed by the driver in Python and passed through 32-bit float; 8.04 s per microphone, 4 microphone streams, 1,544,192 samples, 0 different. Every sample is on the 24-bit grid (value x 2^23 is an integer). Against each of the seven other inputs at most 12,081 of 386,048 samples coincide (zero crossings) |
| Input 3 of 8 with the row-66 table | the adapter built `-af pan=mono|c0=c2` for input 3, `c0=c5` for input 6, `c0=c0` for input 1 (`linuxChannelSelection(inputNumber - 1)`), handed on unchanged |
| Through the worker | tap (`tap.s16`, the encoder's input): amplitude of the selected tone 0.2485 to 0.25 (source 0.25), largest amplitude of any other of the eight tones 0.00014; decoded file: 0.2483 to 0.2501, others at most 0.00014. Telemetry: both microphones heard in every level frame (350 or 351 frames each, 0 without signal, 0 clipped), -15.07 to -15.03 dBFS (a sine of amplitude 0.25 is -15.05 dBFS RMS) |
| Drift report beyond the stated compensation | **none**: 0 warnings `MIC_RATE_AT_LIMIT`; the largest rate the worker's controller asked of its resampler was 1,663.4 ppm (`worker_a1`, the standby), 0.0 (`worker_b1`), 1,033.4 ppm (`worker_a2`, the recorded one) - inside the stated 5,000 ppm (`MIC_CLOCK_COMPENSATION_PPM`). `mic_summary`: missing 0 / 5, 0 / 10, 0 / 0 samples; dropped 0; restarts 0. The recorded tone's frequency against nominal, per second: 0.0 ppm in `worker_a1` and `worker_b1` (tap), mean -12.5 ppm with one second at -81.5 ppm in `worker_a2` |
| Start, stop | `start()` resolved after 1,501 to 1,505 ms (the settle time of 1,500 ms) in 5 of 5; first byte in the pipe 37 to 67 ms after the order to start; `close()` 35 to 38 ms (pipe runs: end of the guard's input, no signal needed), pipes removed, 0 guards alive |

One more fact, asked for by `implementation/067_usb_audio_adapter.md` section 7 point 3 and used by row 184: **when the worker ends, the real helper ends by itself.** In 3 of 3 sessions both helpers ended 22 to 43 ms after the worker's exit (FFmpeg exit status 224: its output pipe has no reader), the guard passed the status on, and the adapter told `AUDIO_HELPER_EXITED` (detail `EXIT_224`) once per microphone through `onSourceLost`; 0 guards alive 2 s later, before any `close()`.

## 2. Why it matters

`067` section 10 lists as unproven: that the helper's vector and the pipe work with the real program, the BUILT guard of row 23 (its invocation form, that the helper's progress report passes through it, that it ends its child), and what a real helper does when the worker goes. Review P12-F13 asks for the real helper, not a stand-in that parses the vector. This row runs the real FFmpeg under the real guard through the real door, started and stopped by the real adapter, into the real worker - with one named substitution for what macOS does not have.

## 3. Which part is real code and which is a stand-in

| Part | Real or stand-in |
|---|---|
| The adapter: `createUsbAudioProductionAdapter` (`apps/core-server/src/capture/adapters/audio/usb-audio-production.ts`) - `open` (the match by stored identity, the facts of the live card, the configuration, the pipe, the vector), `start` (second listing, the guard through the door, settle time, first-sample watch on the progress report), `close`, `onSourceLost` | **real**, imported unchanged by `mic_host.ts` |
| The Linux argument table (`local/mic-helper-args.ts`, row 66): quiet and progress switches, `-af pan=mono|c0=c<k>`, the output line `-vn -ac 1 -ar 48000 -c:a pcm_f32le -f f32le -flush_packets 1 -y <pipe>` | **real and run as built** |
| The INPUT SECTION of that table: `-thread_queue_size 1024 -f alsa -c:a pcm_s24le -channels 8 -sample_rate 48000 -i dems_2_0` (12 arguments) | **built by the real code, NOT run**: a wrapper around the door replaces exactly these 12 arguments by `-re -f lavfi -i <source>` (4 switches of the macOS table's generated input and the source). FFmpeg on macOS has no ALSA input |
| The source | **stand-in**: `aevalsrc`, 8 channels at 48,000 Hz, tones of 313, 419, 523, 631, 743, 859, 977, 1,103 Hz, amplitude 0.25, each sample rounded to the 24-bit grid in the expression. It stands for a card that delivers 24-bit samples; it is not a decoder of `pcm_s24le` |
| The production door (`production-door.ts`), environment `ALSA_CONFIG_PATH` | **real**; the key is handed over, FFmpeg does not read it here |
| The guard | **real**: `apps/capture-worker/build/capture-guard` (SHA-256 `772d9ef0...b083a9`), invoked by the adapter's `guardedArguments` as `<guard> <helper> <vector>`; process rows show guard -> ffmpeg |
| The helper program | **real**: `/opt/homebrew/bin/ffmpeg` 9.0.2 (SHA-256 `c8173e97...e4e1a8`, the bytes of `.data/helpers/ffmpeg`) |
| The named pipe | **real**: made by `/usr/bin/mkfifo -m 600` through the production door at `<runDir>/<sessionId>/MIC-NN.pcm` |
| The shared-capture configuration | **real writer, real text** (`run/alsa/dems-alsa.conf`: `pcm.dems_2_0_shared { type dsnoop ... slave { pcm "hw:CARD=2,DEV=0" channels 8 rate 48000 format S24_3LE period_size 1024 buffer_size 8192 } }`); **read by nothing** on this Mac |
| The card listing | parser **real** (`card-listing.ts`), texts a **stand-in**: one 8-input USB card (index 2, the forms of the adapter's own test file) |
| The program path rule | **stand-in** for the two programs (vouched for: a developer's ffmpeg and a build folder are not system-owned); real for the pipe maker |
| The reader | pipe runs: the driver, opening the pipe for reading without waiting, as the worker does. Worker runs: **the real release worker** `build/capture-worker` (SHA-256 `2c301ae6...8e8795`), driven over its standard streams by the committed harness `apps/capture-worker/test/m3worker.py` (the supervisor's stand-in), with the two committed fake cameras (`build/fake_cam`, 550 pictures each) because a worker does not record without a camera, on 127.0.0.1:8559 and :8561 |
| The Core, the session, the supervisor | **not present**: a node process holds the adapter; the plan is the harness's with the microphone lines replaced by the adapter's `input` |

## 4. What only ALSA on Linux can prove

| Not proven here | Check |
|---|---|
| That FFmpeg accepts `-f alsa -c:a pcm_s24le -channels 8 -sample_rate 48000 -i dems_2_0` and `-thread_queue_size` for the sound device layer | row 79 (container, option parsing); `9A/H-08.4` |
| That the generated configuration is accepted, that the shared capture (`dsnoop`) opens the card at its native format and 48,000 Hz, twice on one card (here two helpers ran side by side, each with its OWN generated source - nothing was shared) | `9A/H-08.1` to `.3` |
| That input 3 of the CARD is channel index 2 of what the device layer delivers (channel order of a real interface), and that it is audible | `9A/H-08.5`, `.6` |
| The conversion of a card's 24-bit integer samples to the pipe's float (here the source is float on the 24-bit grid; the integer decode path did not run). `mic-transport.test.ts` holds the arithmetic for every value | `9A/H-08.2` |
| Period and buffer figures against the worker's placement by arrival; the clock of a real card against the host (here both run on the host's clock and the source is paced by FFmpeg's `-re`, which is not a sample clock) | `9A/H-08.8`; `9A/H-18`, `9A/H-19` |
| Re-identification of a real card after a re-plug; its index and kernel name | `9A/H-07.5`, `.6`, `.8` |
| The first samples after a card is opened (OP-1 of `067`) | `9A/H-08.7` |
| The path rule for the two programs under the service account | `9A/H-08`; host profile |

## 5. What was run

Repository root, command sandbox off (the worker binds two loopback ports), one lock hold per run (11 s a pipe run, about 30 s a worker run):

```
/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock python3 -B .cache/task4-row069/t2_audio.py pipe pipe_a --inputs 3,6
/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock python3 -B .cache/task4-row069/t2_audio.py pipe pipe_b --inputs 6,1
/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock python3 -B .cache/task4-row069/t2_audio.py worker worker_a1 --inputs 3,6
/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock python3 -B .cache/task4-row069/t2_audio.py worker worker_b1 --inputs 6,3
/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock python3 -B .cache/task4-row069/t2_audio.py worker worker_a2 --inputs 3,6
python3 -B .cache/task4-row069/t2_audio.py summary
```

The driver starts `node --import tsx .cache/task4-row069/mic_host.ts <runDir> <sessionId> <inputs> /opt/homebrew/bin/ffmpeg <guard>` (working directory `apps/core-server`, soft core-file limit 0) and speaks to it in words (`start`, `pids`, `close`, `exit`).

- Pipe run: adapter `open` for both microphones; the driver opens both pipes for reading; `start`; 6 s; `close`; compare.
- Worker run: adapter `open`; the worker is started and given `START` with the plan; `start` of the microphones (they define the audio timeline); two fake cameras push 550 pictures (11 s at 50 per second); 1.5 s; `STOP`; the worker exits; 2 s later the adapter is asked for its live guards; `close`.

The helper as it ran (from the door wrapper's record, `result.json` `door_calls`; the pipe path shortened):

```
build/capture-guard /opt/homebrew/bin/ffmpeg -hide_banner -nostdin -nostats -loglevel warning -progress pipe:1
    -re -f lavfi -i aevalsrc=exprs='floor(2097152*sin(2*PI*313*n/48000)+0.5)/8388608|...|...1103...':s=48000
    -af pan=mono|c0=c2 -vn -ac 1 -ar 48000 -c:a pcm_f32le -f f32le -flush_packets 1 -y <runDir>/<sessionId>/MIC-01.pcm
environment: ALSA_CONFIG_PATH
```

Summary as printed:

```
pipe_a       pipe   inputs [3, 6]  PASS  opened_and_started=ok sample_exact=ok differs_from_every_other_input=ok format_f32le_mono_48k=ok closed_nothing_left=ok
pipe_b       pipe   inputs [6, 1]  PASS  opened_and_started=ok sample_exact=ok differs_from_every_other_input=ok format_f32le_mono_48k=ok closed_nothing_left=ok
worker_a1    worker inputs [3, 6]  PASS  worker_accepted_the_format=ok both_microphones_heard=ok tap_is_the_selected_input=ok decoded_file_is_the_selected_input=ok no_rate_report_at_the_limit=ok nothing_left=ok
worker_a2    worker inputs [3, 6]  PASS  worker_accepted_the_format=ok both_microphones_heard=ok tap_is_the_selected_input=ok decoded_file_is_the_selected_input=ok no_rate_report_at_the_limit=ok nothing_left=ok
worker_b1    worker inputs [6, 3]  PASS  worker_accepted_the_format=ok both_microphones_heard=ok tap_is_the_selected_input=ok decoded_file_is_the_selected_input=ok no_rate_report_at_the_limit=ok nothing_left=ok
```

Runs not counted: one first run of `pipe_a` that the driver judged FAIL on its own criterion `format_f32le_mono_48k` while every sample was equal (387,072 of 387,072): the criterion allowed 0.5 s between the seconds of audio received and the wall time, and the source delivers about 0.52 s ahead (8.064 s of audio in 7.557 s). The tolerance was set to 1.0 s and the run repeated. See ambiguity 2.

## 6. How it was verified

- **An independent reference.** The expected samples are computed in the driver (Python, `math.sin`), not by a second FFmpeg; equality is exact, element by element, from the first sample.
- **The check can fail.** The same comparison against the seven other inputs gives at most 3.1 % equal samples; in the worker runs the tone table is computed for all eight tones per second and the selected one must dominate every judged second, with every other below amplitude 0.01 (measured at most 0.00014).
- **Two different channels, exchanged.** Input 3 recorded with input 6 beside it, then input 6 recorded with input 3 beside it: the recorded tone follows the registration (523 Hz, then 859 Hz).
- **How the tones are judged.** A single-bin transform at each of the eight frequencies over each whole second (the frequencies are whole Hz, so a second holds whole periods); the first and the last second are left out; the frequency offset is the phase advance of the selected tone from second to second.
- **Nothing left.** Per run the harness's own check (`m3worker.leftovers`: the processes this run started and their listeners) is empty and the adapter states 0 live guards after `close`, 5 of 5. `pgrep -fl 'task4-row069|mic_host'` printed nothing after the last run. (A wider pattern, `capture-guard|fake_cam|build/capture-worker`, showed one worker of ANOTHER agent's run, `.cache/row043-reopen/...`, and its camera double on 8565, started after this row released the lock; not this row's and not touched.)
- `node scripts/secret-scan/count-only.mjs .cache/task4-row069` -> `TOTAL: 0 in 0 file(s)`.

## 7. What makes it ambiguous

1. **The input section did not run** (section 3). Everything this row shows about channel selection holds for the `pan` filter after ANY 8-channel input; that the ALSA input delivers the card's inputs in that order is a hardware fact.
2. **The source is paced by `-re`, not by a sample clock.** It delivers about 0.5 s of audio ahead at the start (8.04 s received in 7.52 s) and then in steps. The worker's controller answered with up to 1,663 ppm in one run and 0 in another; the committed fake microphone shows the same kind of figure under load (`mic_summary` of earlier runs under `.cache/m3worker/`: `last_ppm` 0.0 in some, 1,132.8 and 1,157.4 with 17 samples missing in another). So "no drift report beyond the compensation" is true here and says nothing about a real card's clock. HYPOTHESIS, not measured: the excursions come from arrival jitter of the generated source and host load (1-minute load 3.5 to 5.4), not from a clock difference - both ends run on the host's clock.
3. **`worker_a2`**: the recorded microphone was stretched by a mean of 12.5 ppm, one second by 81.5 ppm, and the tone's amplitude dipped to 0.2485 in one second. Inside every stated bound; named because the other two runs show 0.0.
4. **Three sessions of 17 s.** Nothing longer was run; drift over a hearing is `9A/H-18`, `9A/H-19`.
5. **`AUDIO_HELPER_EXITED` after an ordinary stop.** With the order "worker `STOP`, then `close()`" the adapter reports each microphone as LOST (exit 224) before it is closed. Whether the session closes its microphones before or after the worker's stop decides whether an ordinary stop produces two loss reports. For the controller and row 68 (microphone loss): either the session closes the microphones first, or a loss that arrives while the session is stopping is not a fault. Not decided here.
6. The stand-in for the path rule means the two programs' real ownership was never judged.

## 8. Driver decisions (for the controller to confirm)

1. **The real adapter was run, with a door wrapper that swaps the 12 input arguments**, rather than a script that calls FFmpeg with a hand-written list: the vector, the guard form, the environment, the settle time and the stop are then the product's.
2. **Sample-exactness is judged at the pipe, the selected channel at the worker's tap and file.** The delegation asks for "sample-exact" and for the worker; the worker resamples by design, so one check cannot be both.
3. **The source is on the 24-bit grid** so that the transport's exactness statement (24 bits in a float) is what is exercised.
4. **Three inputs at the pipe (1, 3, 6), two through the worker (3, 6); three worker sessions.** The row asks for 2 channels and names no run count.
5. **Driver under `.cache/task4-row069/`** (the row's profile is "docs only"): `t2_audio.py` (387 lines, SHA-256 `ffa36978...ac1f78c`), `mic_host.ts` (162 lines, SHA-256 `8c3cbebe...6a516c`), `runs/<name>/result.json` with the worker's log, tap and files (8.2 MB).

## 9. Rules kept

Heavy-host lock per run. Worker listeners 127.0.0.1:8559 and :8561 only; no source was served on a port. No Core instance, no database, no `.env`, no camera or microphone of this Mac, no sound device. Nothing built (the existing `build/` programs ran as they are). No file under `apps/` or `packages/` written. One deviation, stated: one line of this row's OWN new scratch file `mic_host.ts` was corrected with a scripted replace minutes after it was written (four occurrences of one expression); no existing file of the repository was touched that way - `file_claims.md` and the driver's later correction were made with the Edit tool.

---
*Generated: 2026-10-13*
