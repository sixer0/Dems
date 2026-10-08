---
task_id: 2026-10-07_dems_real_capture_sealing
blueprint_row: 2
date: 2026-10-07
agent: explore (probes 1-11, partial) + controller (closure of the sandbox-blocked probes)
milestone: M0
class: A
tier: 3
scope: host readiness, strictly read-only
status: complete — worker gaps closed by controller probes; before/after listener lists captured and identical
---

# Initialization environment check — host readiness (row 2)

Inputs read: handoff `report/report.md` §7; blueprint `identification/02_structured.md` row 2 (Verification column).
Two passes: worker `explore` (filesystem reads only — its sandbox denied `lsof`, `ps`, `sysctl`, `node`, `npm`, `ffmpeg`, `espeak-ng`, and all output redirection), then the controller ran the blocked probes read-only outside that sandbox. Neither pass started, stopped, installed, killed or reconfigured anything.

## 0. Verdict summary

| # | Probe | Verdict | Evidence |
|---|---|---|---|
| 1 | Listening ports before vs after | **READY — identical lists** | controller `lsof` pair, §1 |
| 2 | PostgreSQL cluster status | **READY — `pg:status: OK, running`**; database names not verified by design (deferred to M2 lane re-creation) | §2 |
| 3 | FFmpeg RTSP-listen / fMP4 / astreamselect / CENC | **READY — capability text captured** | §3 |
| 4 | Free disk / `.git` | **READY** — 498 GiB free, `.git` 1.5 GB | §4 |
| 5 | Whisper model on disk, MLX copy excluded | **READY** — `model.safetensors` 1,613,977,443 B; MLX copy 1.5 GB unused (D229) | §5 |
| 6 | Q-INSTALL binaries | **ABSENT AS EXPECTED** (gst-*, whisper-cli/server, ct2-*, mediamtx, sherpa-onnx) | §6 |
| 7 | Ports 8554-8564 free; SMART WMS untouched | **READY — free**; SMART WMS ports never contacted | §1 |
| 8 | espeak-ng Indonesian voice | **READY** — `5  id  --/M  Indonesian  poz/id` | §7 |
| 9 | Host baseline | **READY** — Apple M5, 10 CPUs (4P+6E), 24 GiB, macOS 27.0.1 (26A434) | §8 |
| 10 | Toolchain + stale lane pids | **READY** — node 26.8.2, npm 11.19.1; stale zero-byte lane pids observed, untouched | §9 |
| 11 | Graft context layer | **READY (non-blocking)** — `graft/` 118 MB, graph mtime 2026-10-07 13:23; already initialised, no `graft init` needed | §10 |
| NEW | Installed STT/TTS engines (D7) | **PRESENT** — oMLX 0.6.4 + mlx-audio 0.5.3, server DOWN on 127.0.0.1:8000, 4 models on disk | §11 |

## 1. Probe 1 / 7 — listener snapshot, before vs after the probe

Command: `lsof -nP -iTCP -sTCP:LISTEN` taken immediately before and immediately after all other probes in this row. The two lists were **identical** (no process started or stopped):

| Process | Listen address (subset) |
|---|---|
| `postgres` | `127.0.0.1:4432` |
| `adb` | `127.0.0.1:5037` |
| `qemu-syst` (3 emulators) | `127.0.0.1:5554/5555/5556` + `[::1]` pairs, plus 5557/5558/5559 and transient ranges |
| `node` | `*:3000`, `127.0.0.1:8091` (other host work, not ours) |
| `kilo`, `claude`, `Code`, `limactl`, `netsimd`, `rapportd`, `ssh`, `ControlCe` | editor/agent/system services |

**Project ports free:** 4420-4423, 5173, 5176-5178, 8081, 4400, **8554-8564** — none present in either snapshot. **oMLX 8000 not listening** (server down). **SMART WMS ports `[::1]:5173`, `127.0.0.1:5174`, `[::1]:5175` absent and never contacted**; host PostgreSQL `*:5432` not contacted (only the project cluster on 4432 is up).

## 2. Probe 2 — project PostgreSQL

| Command | Output |
|---|---|
| `npm run -s pg:status` | `pg:status: OK, running` (it also prints the connection-file **key names only**: `DEMS_PG_HOST, DEMS_PG_PORT, DEMS_PG_DATABASE, DEMS_PG_OWNER_ROLE, DEMS_PG_OWNER_PASSWORD` / `DEMS_PG_APP_*`) |
| `.data/postgres/postmaster.pid` | pid `47413`, data dir `.data/postgres`, port `4432`, host `127.0.0.1`, state `ready` |
| `.data/postgres/postmaster.opts` | `postgres -D …/.data/postgres -c listen_addresses=127.0.0.1 -c port=4432 -c unix_socket_directories=` |
| `postgresql.conf:892-894` | `listen_addresses = '127.0.0.1'` / `port = 4432` / `unix_socket_directories = ''` |
| `.locks/postgres.pid` | `47413` (matches postmaster) |
| `.data/postgres/base/` listing | dirs `1`, `4`, `5`, `16399` → three initdb templates + **exactly one user database** (consistent with only `dems_demo`; lanes `dems_lane_1/2/3` absent) |

**Database name list: NOT collected on purpose** — no read-only path exists that does not touch owner credentials, and the red line forbids printing/using them outside the repo's own scripts. Deferred to the M2 lane re-creation row, which recreates lanes with `scripts/pg` commands.

Secret red lines honoured: `.data/pg.pwfile`, `.data/pg.owner.env`, `.data/pg.env` never printed (only file names/sizes/mode 600 in a directory listing), never passed as arguments; no connection as `dems_admin`; no other connection opened by this row.

## 3. Probe 3 — FFmpeg capabilities (controller capture, real output)

```
ffmpeg version 9.0.2 Copyright (c) 2000-2026 the FFmpeg developers
built with Apple clang version 21.0.0 (clang-2100.3.34.2)
```

| Capability | Real option text from `-h` |
|---|---|
| RTSP demuxer, listen/push | `-rtsp_transport <flags> ED…` with `listen  .D… wait for incoming connections`; `-listen_timeout <int> .D… wait for incoming connections (default -1, imply flag listen)`; `-timeout <int64> .D…` |
| mp4 muxer fragmentation | `-frag_duration <int> E…` · `-frag_size <int> E…` · `-fragment_index <int> E… (from 1 to INT_MAX, default 1)` · `-min_frag_duration <int> E…` |
| `movflags` | `default_base_moof` (`Set the default-base-is-moof flag in tfhd atoms`) · `empty_moov` (`Make the initial moov atom empty`) · `isml` (`Create a live smooth streaming feed`) |
| astreamselect | `Filter astreamselect — Select audio streams`; `inputs <int> ..FVA… number of input streams (from 2 to INT_MAX) (default 2)`; `map <string> ..FVA....T. input indexes to remap to outputs` (the `T` flag = runtime-settable via filter commands) |
| encryption | `-encryption_key <binary>`, `-encryption_kid <binary>`, `-encryption_scheme <string> … allowed values are none, cenc-aes-ctr` — **CTR only, no AEAD** |

**Confirmed absences** (matches row 3 findings F-05/F-14/F-15): no `frag_type`, no `default_prft`, no `frag_start_number` in this build.

## 4. Probe 4 — disk

`df -h /` → `/dev/disk3s1s1 926Gi 13Gi 498Gi 3% 484k 4.3G 0% /` (522,523,824 KiB free = **498.3 GiB**). `du -sh .git` → `1.5G`.

## 5. Probe 5 — models

`ls -la ~/.omlx/models/whisper-large-v3-turbo/` → `model.safetensors 1613977443`, `model.safetensors.index.json 37633`, `tokenizer.json 2710337`, `vocab.json 1036558`, `merges.txt 493869`, `normalizer.json 52666`, `tokenizer_config.json 282843`, `added_tokens.json 34648`, `special_tokens_map.json 2186`, `config.json 1301`, `generation_config.json 3772`, `preprocessor_config.json 340`, `.gitattributes 1519`, `README.md 1057` (all 2026-09-13).
MLX copy: `~/.cache/huggingface/hub/models--mlx-community--whisper-large-v3-turbo-asr-fp16` = 1.5 GB, **unused** (D229 exclusion; verified not read by any command in this row).

## 6. Probe 6 — Q-INSTALL items

`which -a` results: `gst-launch-1.0` absent · `gst-inspect-1.0` absent · `whisper-cli` absent · `whisper-server` absent · `ct2-transformers-converter` absent · `ct2-convert` absent · `mediamtx` absent · `sherpa-onnx-offline` absent. `ls /opt/homebrew/Cellar` → 68 formulae, no `gstreamer`, no `whisper-cpp`, no `matroska`; `Caskroom` empty. Present for contrast: `node`, `npm`, `adb`, `graft`, plus **`espeak` / `espeak-ng` / `ffmpeg` / `omlx`** (the omlx formula is the installed STT/TTS host, §11).

## 7. Probe 8 — espeak-ng Indonesian voice

`which -a espeak-ng` → `/opt/homebrew/bin/espeak-ng` (Cellar `1.52.0`). Controller captured the CLI line: `espeak-ng --voices | grep -i indonesian` → **` 5  id  --/M      Indonesian         poz/id`**. Data files: `share/espeak-ng-data/id_dict`, `lang/poz/id` (`name Indonesian`, `language id`). Hypothesis from the blueprint (AS: espeak-ng has an Indonesian voice) is **confirmed**; it is now a fallback only, since D7 puts the installed TTS in front of it.

## 8. Probe 9 — host baseline

`sysctl -n machdep.cpu.brand_string hw.ncpu hw.memsize hw.perflevel0.physicalcpu hw.perflevel1.physicalcpu` → `Apple M5` `10` `25769803776` `4` `6` (4 performance + 6 efficiency cores, 24 GiB). `sw_vers` → `ProductName: macOS  ProductVersion: 27.0.1  BuildVersion: 26A434`. `uname -a` → `Darwin … 27.0.0 … arm64`. Matches handoff §7 exactly.

## 9. Probe 10 — toolchain and stale locks

| Command | Output |
|---|---|
| `node -v` | `v26.8.2` (matches `package.json` engines `>=26.8.2 <27` and `/usr/local/include/node/node_version.h`) |
| `npm -v` | `11.19.1` (matches `packageManager`) |
| `adb devices -l` (earlier controller check) | `emulator-5554`, `emulator-5556`, `emulator-5558` all `device` |
| `~/.android/avd` | `dems2_phone.avd`, `dems2_tablet.avd`, `dems2_phone2.avd` + legacy `dems_*` |

Stale files observed, **nothing deleted** (red line): `.locks/core-server.lane{1,2,3}.pid` and `.lane{1,2,3}.lock` are 0 bytes with mtime Oct 4-6 (a live lane would have written a pid), `.locks/core-server.lane3.{log,vite.log}` Oct 6, `.locks/dems2_*.pid` 6 bytes Oct 4. Fresh one: `.locks/postgres.pid` = 47413. Cleanup decision belongs to a later row; this row removed nothing.

## 10. Probe 11 — Graft context layer (GRAFT BOOTSTRAP)

`ls graft` → `INDEX.md`, `apps`, `docs`, `packages`, `scripts`, `.graph`, `.cache`; `du -sh graft` → `118M`; `.graph/wiring.json` 19,656,960 B, mtime **2026-10-07 13:23** (fresh, i.e. rebuilt minutes before this row ran). `graft/INDEX.md` records 1,981 per-file wiring cards, 1,777 carrying extracted symbols.
**Verdict: Graft is INITIALIZED at the project root → no `graft init` delegation is required (non-blocking environment note per the controller's GRAFT BOOTSTRAP rule).** `graft check` was deliberately not run because it could rewrite `.graph`/`.cache`.

## 11. Installed STT/TTS engines on this host (D7)

| Item | State |
|---|---|
| Formula | `/opt/homebrew/Cellar/omlx/0.6.4` (oMLX 0.6.4 + mlx-audio 0.5.3) |
| Service | OpenAI-compatible server `http://127.0.0.1:8000` — **DOWN at probe time** (`~/Documents/omlx-script/status.sh` → `STATUS : DOWN`), port 8000 absent from the listener pair in §1 |
| Operator scripts | `~/Documents/omlx-script/`: `status.sh`, `start.sh`, `stop.sh`, `restart.sh`, `stt.sh`, `tts.sh`, `bench.sh`, `list-models.sh`, `download-model.sh`, `remove-model.sh`, `chat.sh`, `vision.sh`, `ui.sh`, `config.env`, `PANDUAN_STT_TTS.md`, `UPGRADE_mlx_audio.md` |
| STT models on disk | `whisper-large-v3-turbo` (default, long-form + word timestamps + realtime WS), `qwen3-asr-1.7b-8bit` (stronger biasing) |
| TTS model on disk | `omnivoice-bfloat16` (Indonesian supported, voice cloning, wav/mp3/opus/flac/pcm) |
| VLM (unused here) | `gemma-4-12b-coder-oq4` |
| Config / key | `config.env` (`OMLX_MODEL_DIR`, `STT_MODEL`, `TTS_MODEL`, `TTS_MAX_CHARS=220`, `TTS_PAUSE_SEC=0.18`); API key in `~/.omlx/settings.json` → `auth.api_key` (**never printed/staged**) |
| Lab venv | `~/mlx-tts-lab/.venv` (sounddevice, websockets) + sample outputs `omlx-tts-id*.wav` |
| Limits | upload 100 MB, first request loads the model (seconds to ~1 min), RSS ≈ 3.8 GB with Whisper+OmniVoice loaded (ceiling 15.9 GB), `brew upgrade omlx` reverts mlx-audio to 0.4.3 and breaks TTS (re-apply `UPGRADE_mlx_audio.md`, then `restart.sh`) |

Starting and stopping this service belongs to the re-scoped row 10 (D7) and is logged there; this row did not start it.

## 12. Readiness conclusion

| Area | Verdict |
|---|---|
| Disk 498 GiB · `.git` 1.5 GB | READY |
| Whisper HF model present, MLX copy excluded | READY |
| FFmpeg 9.0.2 with RTSP listen, fMP4 options, runtime `astreamselect`, CENC-CTR | READY (capability text captured; `frag_type`/`default_prft`/`frag_start_number` do not exist) |
| espeak-ng Indonesian voice | READY (fallback; TTS now preferred per D7) |
| Installed STT/TTS (oMLX) | PRESENT, server down — smoke test in re-scoped row 10 |
| Q-INSTALL binaries (whisper.cpp, GStreamer, MediaMTX, sherpa-onnx, ct2) | ABSENT AS EXPECTED (row 10 re-scoped by D7; install deferred, still covered by Q-INSTALL) |
| Project PostgreSQL 127.0.0.1:4432 | READY, `dems_demo` only; lanes to be recreated at M2 |
| App ports / spike ports 8554-8564 | FREE (listener pair identical) |
| Emulators 5554/5556/5558 | Booted, not used by rows 1-40 |
| Stale `.locks` lane pids | OBSERVED, untouched |
| Host baseline M5 4P+6E / 24 GiB / macOS 27.0.1 | READY |
| Graft | INITIALIZED — no init needed |

**Row 2 PASS.** SMART WMS ports, host PostgreSQL, credential files: never contacted/read.

---
*Generated: 2026-10-07 · Last Updated: 2026-10-07*
