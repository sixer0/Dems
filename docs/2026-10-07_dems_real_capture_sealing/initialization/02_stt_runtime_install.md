---
task_id: 2026-10-07_dems_real_capture_sealing
blueprint_row: 10 (RE-SCOPED by D7: inventory + smoke-test of the already-installed STT/TTS engines; no install)
milestone: M1
date: 2026-10-07
agent: coder-execution
tier: 3
status: complete
source_plan: docs/2026-10-07_dems_real_capture_sealing/masterplan/02_plan.md
external_queries: 0
installs_performed: 0
last_updated: 2026-10-07 15:30 (+07:00)
---

# Row 10 (re-scoped) - STT/TTS engine inventory and smoke test (oMLX stack)

Per D7 the row is not an install task: it inventories what is already on this host
(oMLX + mlx-audio stack installed 2026-09-13 for the SMART WMS project), smoke-tests the
STT and TTS round trips, and records what the DEMS transcript work can reuse.
Nothing was installed, downloaded, or modified outside `.cache/spikes/stt-smoke/`
and the two deliverable files. The only state change was starting and stopping the
oMLX service, restoring the hand-over state (DOWN). The API key in
`~/.omlx/settings.json` (`auth.api_key`) was never printed or read into this
session's output; the omlx scripts consume it internally via `lib/common.sh`.

## 1. Acceptance (re-scoped Verification)

| Check | Result | Evidence |
|---|---|---|
| Inventory with command + output per component | PASS | section 2 |
| Server smoke test with hand-over state restored | PASS | section 3 (DOWN before, UP during, DOWN after; pidfile removed) |
| STT round trip on both STT models | PASS (qwen3 with 2 word errors on mechanical espeak audio, see 3.3) | sections 3.2-3.3 |
| TTS round trip + STT back-verification | PASS | section 3.4 |
| 0 installs, 0 downloads | PASS | no `brew install`, no pip, no `download-model.sh` invoked; mlx-audio version read read-only |
| 0 files written outside `.cache/` (plus this doc + progress file) | PASS | section 5 file list |
| Secrets in artifacts | 0 | API key value appears nowhere; only the JSON path is named |

## 2. Inventory

### 2.1 Packages and paths

| Component | Version | Path | Evidence command | Evidence output |
|---|---|---|---|---|
| oMLX (Homebrew formula) | 0.6.4 | `/opt/homebrew/Cellar/omlx/0.6.4` | `ls -d /opt/homebrew/Cellar/omlx/*` | `/opt/homebrew/Cellar/omlx/0.6.4` (single Cellar entry) |
| oMLX CLI | 0.6.4 | `/opt/homebrew/bin/omlx` | `omlx --version` | `0.6.4` |
| mlx-audio (patched inside oMLX libexec venv) | 0.5.3 | `/opt/homebrew/opt/omlx/libexec/lib/python3.11/site-packages` | `/opt/homebrew/opt/omlx/libexec/bin/python -m pip show mlx-audio` | `Name: mlx-audio` / `Version: 0.5.3` |
| espeak-ng (fallback TTS, not a transcript dependency per D7) | 1.52.0 | `/opt/homebrew/Cellar/espeak-ng/1.52.0/` | `espeak-ng --version`; `espeak-ng --voices=id` | `eSpeak NG text-to-speech: 1.52.0`; voice row `5 id --/M Indonesian poz/id` |
| ffmpeg (used by oMLX to decode video containers) | 9.0.2 | Homebrew prefix | `brew list --versions ffmpeg` | `ffmpeg 9.0.2` |
| Brew versions trio | - | - | `brew list --versions omlx espeak-ng ffmpeg` | `espeak-ng 1.52.0` / `ffmpeg 9.0.2` / `omlx 0.6.4` |

Note: `brew list --versions` reports the Cellar versions; the mlx-audio 0.5.3 in the
libexec venv is the **manually re-applied patch** from `UPGRADE_mlx_audio.md` (Homebrew
pins 0.4.3). `pip show` above confirms the patch is currently in place; the server log
confirms OmniVoice is discovered as `audio_tts` (section 3.1), which only happens with
0.5.3 - the 0.4.3 detection mislabels it as `llm`.

### 2.2 Operator script folder `~/Documents/omlx-script/`

| Item | Size (B) | Mtime | Role |
|---|---|---|---|
| `PANDUAN_STT_TTS.md` | 15,892 | Sep 13 12:21 | Operational guide (STT/TTS endpoints, limits, memory, licence notes) |
| `README.md` | 6,910 | Sep 13 12:21 | Folder readme |
| `UPGRADE_mlx_audio.md` | 6,136 | Sep 13 12:16 | Runbook: mlx-audio 0.5.3 patch + rollback (read in full, section 4.3) |
| `bench.sh` | 1,417 | Sep 13 10:29 | Benchmark script - NOT run (D230: no benchmark numbers on this host) |
| `chat.sh` | 1,082 | Sep 13 10:28 | VLM chat helper - out of scope |
| `config.env` | 1,130 | Sep 13 12:16 | Operational config (read in full, section 2.4) |
| `download-model.sh` | 1,080 | Sep 13 10:28 | Model downloader - NOT run (D7: no downloads) |
| `lib/` (dir, 96) | - | Sep 13 10:28 | `lib/common.sh` shared functions (read in full) |
| `list-models.sh` | 503 | Sep 13 10:28 | Model listing |
| `logs.sh` | 690 | Sep 13 10:30 | Log tail helper |
| `remove-model.sh` | 701 | Sep 13 10:28 | Model removal - NOT run |
| `restart.sh` | 139 | Sep 13 10:28 | stop+start wrapper |
| `start.sh` | 831 | Sep 13 10:28 | Launches `omlx serve` with nohup + pidfile (used, section 3.1) |
| `status.sh` | 778 | Sep 13 10:28 | UP/DOWN probe + model list + RSS table (used 3x) |
| `stop.sh` | 834 | Sep 13 10:28 | Kills pidfile PID, fallback `pkill -f "omlx serve"` (used, section 3.5) |
| `stt.sh` | 1,159 | Sep 13 12:07 | STT client: `./stt.sh <file> [model] [lang] [prompt]` (used 5x) |
| `tts.sh` | 3,806 | Sep 13 12:15 | TTS client with auto sentence-chunking + voice cloning (used 1x) |
| `ui.sh` | 315 | Sep 13 10:28 | Admin UI opener |
| `vision.sh` | 1,256 | Sep 13 10:28 | VLM helper - out of scope |

All scripts are user-owned SMART WMS-era tooling; none were modified (mtimes unchanged,
Sep 13 throughout).

### 2.3 Models on disk `~/.omlx/models/` (four models, per-model weight sizes)

`ls -la ~/.omlx/models/` shows four dirs: `gemma-4-12b-coder-oq4`, `omnivoice-bfloat16`,
`qwen3-asr-1.7b-8bit`, `whisper-large-v3-turbo`. Weights per model (from `ls -la` of each dir):

| Model id | Type | Weight file(s) | Weight size (B) | Dir size (`du -sh`) |
|---|---|---|---|---|
| `whisper-large-v3-turbo` | STT (default) | `model.safetensors` | 1,613,977,443 (~1.5 G) | 1.5 G |
| `qwen3-asr-1.7b-8bit` | STT (biasing) | `model.safetensors` | 2,463,307,541 (~2.3 G) | 2.3 G |
| `omnivoice-bfloat16` | TTS | `model.safetensors` (+ `audio_tokenizer/` subdir) | 1,225,189,510 (~1.2 G) | 1.9 G (incl. tokenizer) |
| `gemma-4-12b-coder-oq4` | VLM (untouched here) | `model-00001-of-00002.safetensors` + `model-00002-of-00002.safetensors` | 5,349,856,222 + 3,510,026,709 | 8.4 G |

`status.sh` model listing additionally shows `omnivoice-bfloat16/audio_tokenizer` as a
discoverable dir. `/v1/models` also returns HF-cache duplicates `mlx-community--OmniVoice-bfloat16`
and `mlx-community--whisper-large-v3-turbo-asr-fp16` (known cosmetic clutter per
`UPGRADE_mlx_audio.md` "Clutter"); DEMS must use the clean ids.

### 2.4 Lab venv and settings

| Item | Path | Evidence | Contents |
|---|---|---|---|
| Lab venv | `~/mlx-tts-lab/.venv` (NOTE: `~/.mlx-tts-lab` with a leading dot does NOT exist; `ls -d` returned only `/Users/gsp-budi/mlx-tts-lab`) | `ls ~/mlx-tts-lab/.venv/bin`, `pip list` | `sounddevice 0.5.6`, `websockets 17.1`, `numpy 2.3.5` (realtime WS client deps per guide Appendix A) |
| Lab artifacts | `~/mlx-tts-lab/` | `ls` | prior test wavs `omlx-tts-id*.wav`, `ref-male.wav` (24 kHz mono clone reference), payloads, `tts-long-id.txt` |
| oMLX settings | `~/.omlx/settings.json` | named only, never read | `auth.api_key` lives here - credential, excluded from all DEMS artifacts |
| Backup | `~/Documents/omlx-script.bak-20260913` | `du -sh` = 13 M | mlx-audio 0.4.3 package backup (rollback source, section 4.3) |

`config.env` values (read in full): `OMLX_MODEL_DIR=$HOME/.omlx/models`,
`OMLX_HOST=127.0.0.1`, `OMLX_PORT=8000`, `DEFAULT_MODEL=gemma-4-12b-coder-oq4`,
`STT_MODEL=whisper-large-v3-turbo`, `TTS_MODEL=omnivoice-bfloat16`,
`TTS_MAX_CHARS=220`, `TTS_PAUSE_SEC=0.18`,
`OMLX_PY=/opt/homebrew/opt/omlx/libexec/bin/python`,
`OMLX_LOG=$HOME/.omlx/logs/omlx-serve.log`, `OMLX_PIDFILE=$HOME/.omlx/omlx-serve.pid`.

## 3. Server smoke test (hand-over state DOWN -> UP -> DOWN)

### 3.1 Start / status / stop

| Step | Command | Quoted output |
|---|---|---|
| Pre-check | `lsof -nP -iTCP:8000 -sTCP:LISTEN` | no listener; pidfile `~/.omlx/omlx-serve.pid` existed with stale pid `65559` (`kill -0 65559` -> not alive; `pgrep -fl "omlx serve"` -> empty) |
| Status before | `cd ~/Documents/omlx-script && ./status.sh` | `STATUS : DOWN (http://127.0.0.1:8000)` |
| Start | `./start.sh` | `Menjalankan omlx serve (model-dir=/Users/gsp-budi/.omlx/models, 127.0.0.1:8000)...` / `PID 42690  |  log: /Users/gsp-budi/.omlx/logs/omlx-serve.log` / `oMLX siap: http://127.0.0.1:8000` |
| Status after | `./status.sh` | `STATUS : UP   http://127.0.0.1:8000` / `PID    : 42690`; models served incl. `omnivoice-bfloat16`, `qwen3-asr-1.7b-8bit`, `whisper-large-v3-turbo`; idle `PID 42690 CPU 0.0% RSS 0.12 GB` |
| Bind proof | `lsof -nP -iTCP:8000 -sTCP:LISTEN` | `Python  42690 gsp-budi  4u IPv4 ... TCP 127.0.0.1:8000 (LISTEN)` |
| Discovery proof | `grep -a "Discovered model" ~/.omlx/logs/omlx-serve.log` | `Discovered model: omnivoice-bfloat16 (type: audio_tts, engine: audio_tts, size: 1.20GB)` (plus whisper/qwen3 as `audio_stt`) |
| Stop | `./stop.sh` | `Menghentikan oMLX (PID 42690)...` / `oMLX berhenti.` |
| Status after stop | `./status.sh`; `lsof` | `STATUS : DOWN (http://127.0.0.1:8000)`; pidfile after: `none`; `port 8000: no listener` |

pid before stop: `42690` (matches pidfile); pid after stop: none (pidfile deleted by
`stop.sh`, process gone). Final server state: **DOWN**, exactly as handed over.
DEMS must never bind port 8000 (D7 standing rule; this test confirms oMLX takes it on start).

### 3.2 Test fixture (espeak-ng Indonesian, mechanical voice)

Command: `espeak-ng -v id -w test-id.wav "Selamat pagi. Ini adalah uji coba transkripsi untuk sistem DEMS."`
`ffprobe` result: `duration=4.653333`, `sample_rate=22050`, `channels=1`, `size=205256`.

### 3.3 STT round trips on `test-id.wav`

| Run | Command | Expected text | Returned text | Meta (`stt.sh` summary line) | Wall clock |
|---|---|---|---|---|---|
| whisper, cold | `./stt.sh test-id.wav whisper-large-v3-turbo id` | Selamat pagi. Ini adalah uji coba transkripsi untuk sistem DEMS. | exact match | `{"language":"id","duration":0.0,"segments":1}` | 7.42 s (first request = model load; log `Loaded model: whisper-large-v3-turbo (actual: 1.58GB, ... total: 1.58GB)`) |
| whisper, warm | same, 2nd run | - | exact match | same shape | 0.56 s |
| qwen3, cold | `./stt.sh test-id.wav qwen3-asr-1.7b-8bit id` | as above | `Selamat pagi. Ini adalah pagi coba transkripsi untuk sistem VMS.` - **2 word errors** (`uji`->`pagi`, `DEMS`->`VMS`) on the mechanical espeak voice | `{"language":"id","duration":2.4875168800354004,"segments":1}` | 3.97 s (log `Loaded model: qwen3-asr-1.7b-8bit (actual: 2.34GB, ... total: 3.99GB)`) |

Verdict: **both engines usable today for Mac-side transcription**. Whisper transcribed
synthetic mechanical speech perfectly; Qwen3's two errors occurred on espeak-ng audio
(not real speech) and its guide-claimed strength is biasing + noisy real speech
(guide §1.7) - a `prompt` biasing argument ("DEMS") is available and was not needed for
Whisper. Latency figures are single smoke timings, not benchmarks (no RTF claims per D230).
Caveat: the server's `duration` field is unreliable on both engines (Whisper returns
`0.0`; Qwen returns 2.49 s for 4.65 s audio) - downstream code should use ffprobe or
segment timestamps, not `duration`.

### 3.4 TTS round trip

| Step | Command | Result |
|---|---|---|
| Synthesize | `./tts.sh "Selamat pagi. Ini adalah uji coba teks ke suara." omnivoice-bfloat16 id .cache/spikes/stt-smoke/tts-out.wav` | `chunks=1` / `durasi=3.3s sample_rate=24000Hz` / `OK: .../tts-out.wav`; `ls -la` = 157,484 B; `ffprobe` = `duration=3.280000`, 24000 Hz, 1 ch; file type `PCM 16 bit, mono 24000 Hz`. Wall clock 5.04 s (first request = OmniVoice load; log `Loaded model: omnivoice-bfloat16 (actual: 1.98GB, ... total: 5.19GB)`) |
| Back-transcribe (whisper) | `./stt.sh tts-out.wav whisper-large-v3-turbo id` | `Selamat pagi, ini adalah uji coba teks ke suara.` - matches the input **modulo punctuation/case normalisation** (period after `pagi` became a comma; `Ini` lower-cased). Warm round trip 0.69 s |
| Back-transcribe (qwen3) | `./stt.sh tts-out.wav qwen3-asr-1.7b-8bit id` | `Selamat pagi. Ini adalah uji coba teks ke suara.` - **exact match** on the OmniVoice voice |

Round-trip verdict: **PASS**. The normalisation caveats from guide §2.2 apply and are
relevant for row 12 fixture scripts: OmniVoice mispronounces raw numbers/acronyms
(`09.30` -> "0.00", `25` -> "wali", `SMART WMS` -> "Smart Wali OMS"); spell them client-side
(`sembilan tiga puluh`, `Wim Es`). Do not compare transcripts for exact string equality -
expect punctuation/case drift; compare normalised text or assert on key tokens.
Evidence that §2.2 is real: Qwen3 back-transcribed the synthetic speech perfectly, so
whisper's comma drift is ASR punctuation, not a TTS defect.

### 3.5 Memory observation

With all three audio models loaded the engine pool logged cumulative `total: 5.19GB`
(1.58 whisper + 2.34 qwen3 + 1.98 omnivoice, actual). Process-level `ps` RSS reported
only ~0.25 GB because MLX Metal buffers are outside the RSS metric - `status.sh`'s RSS
table UNDER-reports real memory. The guide §4 figures (RSS about 3.8 GB loaded, ceiling
15.9 GB, don't run beside a large VLM session, `brew upgrade omlx` breaks TTS) remain the
standing operational rules; the pool log `total:` line is the accurate check.

## 4. Reuse decision matrix

| Requirement (D7 / blueprint) | Met by oMLX TODAY on this Mac? | Evidence / path forward |
|---|---|---|
| Mac-side interview transcription (M1+ dev work) | YES | §3.3 both engines pass; loopback HTTP `POST /v1/audio/transcriptions` on `http://127.0.0.1:8000`; models already on disk |
| Two-voice Indonesian test fixture generation (row 12 / M6) | YES | §3.4 TTS round trip passes; OmniVoice voice cloning via `tts.sh` `TTS_REF_AUDIO`/`TTS_REF_TEXT` is guide §2.5's documented two-profile route (clone mechanism not re-verified here - it was verified 2026-09-13 per `UPGRADE_mlx_audio.md` "Kloning ref_audio via oMLX"); apply §2.2 number-spelling; `ref-male.wav` exists in `~/mlx-tts-lab/` as a usable reference |
| Word timestamps / long-form / realtime WS | YES (by installed feature; not re-exercised here) | guide §1.1/§1.4/§1.6; venv deps present (§2.4) |
| Row 33 `TranscriberAdapter` backend `omlx-server` | FACTS COMPLETE | endpoint, model ids, auth path (`~/.omlx/settings.json` `auth.api_key`), `duration`-field caveat (§3.3), port-8000 exclusion (§3.1) |
| Row 11 HF-to-ggml conversion on this Mac | NOT NEEDED | oMLX loads the safetensors models directly; note below |
| CPU-only STT on the x86 Linux Core (D229/D230/R-7, OD-24) | NO | MLX is Apple-Silicon-only (Metal/GPU); oMLX is a host service, not a shipped engine; portable whisper.cpp (or CT2) install stays required for the Core under Q-INSTALL - later wave, not this row |
| Self-contained offline engine in the DEMS package | NO | same reason; `cpu-local` backend of row 33 still needs its portable runtime |
| espeak-ng as TTS for fixtures | DEPRIORITISED | available (`5 id poz/id`) and used only as §3.2 mechanical probe; D7 moves row 12 to OmniVoice cloned voices |

Licence note for reuse: mlx-audio/Whisper/MIT-side per research/04 already recorded; new
this wave - OmniVoice weights Apache-2.0 **but the HiggsAudio tokenizer is under an
extended licence above 100k MAU** (guide Appendix C / `UPGRADE_mlx_audio.md`): acceptable
for internal dev fixtures, must not ship in the Core product; the portable Core path
(whisper.cpp MIT) is unaffected.

## 5. Startup / shutdown procedure (exact commands, hand-over state DOWN)

```bash
cd ~/Documents/omlx-script
./status.sh            # expect: STATUS : DOWN ...
./start.sh             # writes ~/.omlx/omlx-serve.pid, log ~/.omlx/logs/omlx-serve.log
./status.sh            # expect: STATUS : UP   http://127.0.0.1:8000  (DEMS never binds 8000)
# ... STT: ./stt.sh <file> [model] [lang] [biasing-prompt] ; TTS: ./tts.sh "text" [model] [lang] out.wav
./stop.sh              # kills pidfile PID, deletes pidfile
./status.sh            # expect: STATUS : DOWN  -> restored hand-over state
```

If the server died uncleanly, the pidfile can go stale (observed at start of this wave:
stale pid 65559 while `omlx serve` was not running); `start.sh` overwrites it, `stop.sh`
removes it. API key handling: scripts read `~/.omlx/settings.json` themselves via
`lib/common.sh`; for manual curl the guide exports it from the shell env - never into a
file or log.

Scratch/evidence files written by this wave (all under `.cache/`):
`test-id.wav`, `tts-out.wav`, `stt-whisper-run2.txt`, `stt-qwen-run1.txt`,
`tts-run1.txt`, `stt-roundtrip-whisper.txt`, `stt-roundtrip-qwen.txt`.

## 6. Risks, memory and rate notes

| Note | Detail | Source |
|---|---|---|
| First-request latency | Model loads lazily at first request: observed 3.9-7.4 s for STT loads, 5.0 s for OmniVoice load (page cache warm); guide says "seconds to ~1 min" | §3.3-3.4, guide §4 |
| Memory | Pool total with all 3 audio models: 5.19 GB logged; idle RSS ~0.12 GB; ps RSS under-reports Metal buffers (see §3.5); ceiling 15.9 GB | §3.5, guide §4 |
| Sharing | oMLX is a shared host service (also SMART WMS): serialise STT/TTS calls, never run beside a large VLM session (gemma `is_pinned: false` -> auto-evict) | D7, guide §4 |
| Upload cap | 100 MB max audio upload (`settings.json` `max_audio_upload_size`); video containers decoded via ffmpeg 9.0.2 | guide §1.7/App C |
| TTS text | Auto-chunk at `TTS_MAX_CHARS=220` per sentence with 0.18 s pause; raw numbers/acronyms mispronounced - client-side spelling required; `instructions`/`voice` fields unusable (text is spoken aloud) | guide §2.1-2.3, §2.5 |
| Rate limiting | No server-side rate limit documented; the serialization rule is host etiquette, not enforcement - DEMS adapter must queue its own calls | guide (no rate section), §4 |

## 7. `brew upgrade omlx` breakage warning (for the runbook and for row 33 ops)

`brew upgrade omlx` (or `brew reinstall omlx`) restores **mlx-audio 0.4.3** into the
libexec venv and **breaks TTS**: OmniVoice is then discovered as `type: llm` instead of
`audio_tts` and cannot be served. Recovery is manual and belongs to the user, never to
DEMS (D7 standing rule: DEMS does not upgrade or restart oMLX beyond start/stop):

```bash
# 1) remove the reverted 0.4.3 package (Homebrew strips its RECORD, pip uninstall fails)
SP=/opt/homebrew/Cellar/omlx/0.6.4/libexec/lib/python3.11/site-packages
rm -rf "$SP/mlx_audio" "$SP/mlx_audio-0.4.3.dist-info"
# 2) re-install 0.5.3 without touching dependencies, plus zstandard
PY=/opt/homebrew/opt/omlx/libexec/bin/python
$PY -m pip install --no-deps "mlx-audio @ git+https://github.com/Blaizzy/mlx-audio.git@ee0c65d12d0be748aed5fb8e1587dc7cc8f9e644"
$PY -m pip install zstandard
# 3) restart and verify
cd ~/Documents/omlx-script && ./restart.sh
grep -a "Discovered model" ~/.omlx/logs/omlx-serve.log   # must show omnivoice-bfloat16 (type: audio_tts, ...)
```

Rollback of the patch: restore from `~/Documents/omlx-script.bak-20260913/` per
`UPGRADE_mlx_audio.md` "Rollback" block. Full source: `UPGRADE_mlx_audio.md` (read in full).

## 8. Uninstall / removal commands (record for the log only - NOT executed)

| Item | Removal command | Note |
|---|---|---|
| oMLX formula (server + libexec venv incl. patched mlx-audio) | `brew uninstall omlx` | also drops `/opt/homebrew/Cellar/omlx/0.6.4` |
| espeak-ng | `brew uninstall espeak-ng` | safe; not a current dependency (D7) |
| ffmpeg | `brew uninstall ffmpeg` | CAUTION: shared tool, other projects depend on it; do not remove for DEMS |
| STT/TTS models | `rm -rf ~/.omlx/models/whisper-large-v3-turbo ~/.omlx/models/qwen3-asr-1.7b-8bit ~/.omlx/models/omnivoice-bfloat16` (or `~/Documents/omlx-script/remove-model.sh <id>`) | 5.7 GB total audio-model footprint |
| VLM model (not ours) | `rm -rf ~/.omlx/models/gemma-4-12b-coder-oq4` | SMART WMS asset - never touch |
| oMLX state/logs/settings | `rm -rf ~/.omlx/logs ~/.omlx/omlx-serve.pid` (settings.json holds the user's API key - removal only by the user) | never delete credentials on the user's behalf |
| Operator scripts | `rm -rf ~/Documents/omlx-script` | user's runbook folder; not ours to remove |
| Lab venv + artifacts | `rm -rf ~/mlx-tts-lab/.venv` (or the whole `~/mlx-tts-lab`) | realtime client deps |
| Upgrade backup | `rm -rf ~/Documents/omlx-script.bak-20260913` | rollback source for §7 |

## 9. Row-11 note

**HF-to-ggml conversion SKIPPED on this Mac per D7 (the server loads the model directly)** -
`whisper-large-v3-turbo` is served by oMLX from
`~/.omlx/models/whisper-large-v3-turbo/model.safetensors` (1,613,977,443 B) with no
conversion step; conversion stays relevant only for the later Core-side portable-runtime wave.

## 10. Sources (all local, read-only)

`~/Documents/omlx-script/`: `PANDUAN_STT_TTS.md` (§1 STT, §2.2/§2.3 TTS caveats, §4 ops/memory,
§6 App B/C endpoints+limits), `config.env`, `UPGRADE_mlx_audio.md`, `lib/common.sh`,
`status.sh`, `start.sh`, `stop.sh`, `stt.sh`, `tts.sh`; `~/.omlx/logs/omlx-serve.log`
(load/discovery lines quoted in §3); `decisions/decisions.md` D7-D9;
`initialization/01_env_check.md` §11; `research/04_collection_stt.md` (portable-path facts,
F-01..F-11); this wave's commands are quoted inline in §2-§3.

---
*Generated: 2026-10-07 15:30*
*Last Updated: 2026-10-07 15:30*
