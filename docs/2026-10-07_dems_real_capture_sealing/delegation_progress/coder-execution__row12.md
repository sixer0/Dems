---
task_id: 2026-10-07_dems_real_capture_sealing
blueprint_row: 12
agent: coder-execution
agent_type: coder-execution
tier: 2
milestone: M1
date: 2026-10-07
status: COMPLETE
artifact: research/10_spike_stt_functional_check.md
external_queries: 0
installs_performed: 0
downloads_performed: 0
server_state_final: DOWN
last_updated: 2026-10-07 16:47
---

# Row 12 progress - Functional STT check, two-speaker Indonesian fixture (re-scoped by D7/D10)

## Status

COMPLETE. Acceptance **7/7 PASS** at row level. Deliverable
`research/10_spike_stt_functional_check.md` written (Tier 2). Scratch confined to
`.cache/spikes/stt-check/` (34 files, 7.2 MB, git-ignored); 0 media files in
`git status --porcelain`; no installs, no downloads, no source edits, nothing outside
scratch + the two deliverables written; API key never printed or stored in any file
(secret scan of scratch + artifact: clean).

## What was done

1. Fixture: 13-sentence Indonesian examiner/subject dialogue (>= 6 required), two
   acoustically distinct cloned voices (refs from macOS `say -v Daniel` en_GB male +
   `say -v Damayanti` id_ID female, 7.32 s / 6.93 s wavs kept in `refs/`), synthesised
   per-turn with `tts.sh omnivoice-bfloat16 id` + `TTS_REF_AUDIO/TTS_REF_TEXT` (guide
   §2.5), numbers/acronyms normalised per §2.2 (none present), concatenated to one wav:
   `fixture-two-speaker-id.wav` 3,154,638 B, 65.72 s, 24 kHz mono PCM16 (actual rate
   recorded honestly; sha256 `6743181a...c0f4fe71`).
2. Server: DOWN at hand-over -> `start.sh` (PID 17201, UP, lsof quoted) -> serialised
   TTS+STT traffic, no VLM -> `stop.sh` -> **DOWN**, port 8000 free, pidfile none (PID
   before: 17201; after: none).
3. 3 runs (`stt.sh` + identical-params JSON capture each):
   - Run 1 whisper: non-empty JSON, 17 segments w/ timestamps, lang `id`.
   - Run 2 whisper: byte-identical JSON to run 1 (`jq -S`+`cmp`), 17 segments, lang `id`.
   - Run 3 qwen3: non-empty JSON, lang `id`, ONE segment (0.0-65.72) containing all 13
     turns; granularity criterion fails for it - reported honestly (blueprint criterion
     is "In 2 runs" = the whisper runs).
   Segment counts vs scripted sentences: **17 segments vs 13 scripted sentences** (whisper:
   A5 split 2, A7 split 3, plus one phantom tail segment 65.54-95.52 s). Qualitative: 11-12
   of 13 turns verbatim per engine; mismatches: whisper A5 garble (`kendala`->`dalam`,
   `Anda alami`->`zalami`) + closing split/glue; qwen3 `Anda alami`->`dihadapi`,
   `pemindaian`->`pemindayan`, `anda` case. No accuracy or throughput figures anywhere.
4. Criterion adaptation stated with quoted log lines (MLX/Metal GPU by design; `omlx
   serve --help` has no device/CPU flags; CPU-only constraint stays on the `cpu-local`
   Core path, D229/D230/R-7, Q-INSTALL item 1).

## Handoffs

- Row 33: response-shape facts + optional-confidence problem (qwen3 emits no
  `avg_logprob`/`no_speech_prob`/`tokens`), engine-dependent segment granularity
  (qwen3 = 1 segment/file), `duration` unreliable again (0.0 vs 12.43/10.68 across two
  identical-parameter requests for a 65.72 s file), `end` can exceed media duration
  (clamp + QA-threshold recipe in artifact §8).
- Row 38: +1 recipe in artifact §9.2 - reuse the SEALED fixture (synthesis is
  non-deterministic); whisper two-run JSON byte-identity is reusable as a chain-equality
  assertion (mirrors row 7); scope the segment criterion to whisper.
- Row 12 gate criteria are measurable without any RTF/WER figure (D230 respected; grep
  proof in artifact §9.1).

## Blocker

None.
