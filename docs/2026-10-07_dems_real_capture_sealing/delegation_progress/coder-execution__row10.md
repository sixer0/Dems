---
task_id: 2026-10-07_dems_real_capture_sealing
blueprint_row: 10
agent: coder-execution
agent_type: coder-execution
tier: 3
milestone: M1
date: 2026-10-07
status: COMPLETE
artifact: initialization/02_stt_runtime_install.md
external_queries: 0
installs_performed: 0
last_updated: 2026-10-07 15:32
---

# Row 10 progress - STT/TTS inventory + smoke test (re-scoped by D7)

## Status

COMPLETE. Re-scoped deliverable `initialization/02_stt_runtime_install.md` written
(Tier 3): full inventory table with evidence commands, server smoke test DOWN->UP->DOWN
with the hand-over state restored, STT round trips on both installed models, TTS round
trip with back-transcription, reuse decision matrix, start/stop procedure, memory/rate
notes, `brew upgrade omlx` breakage warning, uninstall record (not executed), and the
row-11 SKIPPED note. No installs, no downloads, no modifications to `omlx-script/`,
`~/.omlx/`, or SMART WMS. Scratch confined to `.cache/spikes/stt-smoke/` (7 files).

## Verification column (re-scoped)

| Criterion | Result | Evidence |
|---|---|---|
| Inventory per component with command + output | PASS | artifact §2 (formula 0.6.4, mlx-audio 0.5.3 patch confirmed by `pip show` + `audio_tts` discovery, espeak-ng 1.52.0, ffmpeg 9.0.2, script folder 20 entries, 4 models with byte-exact safetensors sizes, lab venv deps) |
| Smoke test with hand-over state restored | PASS | `STATUS : DOWN` -> PID 42690 UP on `127.0.0.1:8000` (lsof quoted) -> `stop.sh` -> `DOWN`, pidfile gone, no listener; stale pidfile 65559 anomaly documented |
| STT round trips | PASS with honest defect note | whisper-large-v3-turbo exact transcript (cold 7.42 s, warm 0.56 s); qwen3-asr-1.7b-8bit PASS on OmniVoice audio, 2 word errors on mechanical espeak audio (`uji`->`pagi`, `DEMS`->`VMS`, cold 3.97 s); `duration` JSON field unreliable on both - documented for row 33 |
| TTS round trip | PASS | omnivoice-bfloat16 3.28 s / 157,484 B WAV 24 kHz mono (5.04 s incl. load); back-transcript exact match (qwen3) / punctuation-drift match (whisper); §2.2 normalisation caveats carried forward to row 12 |
| No installs (D7 red line) | PASS | only `brew list --versions`, `pip show`, `ls`, `du`, scripts; no `brew install`/pip/download-model invocations |
| No secrets in artifacts | PASS | `auth.api_key` named by JSON path only; scripts read it internally |

## Key handoffs

- Row 12 (M6): generate the two-voice Indonesian fixture with `tts.sh` + `TTS_REF_AUDIO`
  cloning (guide §2.5); spell out numbers/acronyms (§2.2); assert on normalised tokens,
  not raw string equality.
- Row 33: `omlx-server` backend facts complete (endpoint, ids, auth path, 100 MB cap,
  lazy-load latency, pool memory 5.19 GB logged vs 0.25 GB ps RSS, `duration` caveat);
  `cpu-local` backend still needs the later portable-runtime wave (D229/D230/R-7, Q-INSTALL).
- Standing rules confirmed by evidence: port 8000 belongs to oMLX; do not upgrade omlx
  (TTS reverts to mlx-audio 0.4.3 - re-apply `UPGRADE_mlx_audio.md` + restart); serialise
  STT/TTS calls, never beside a large VLM session.
- `brew install whisper.cpp` did NOT happen in this wave; Q-INSTALL item stays open for the
  Core-side wave, unchanged.
