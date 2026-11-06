# Progress — coder-execution-local / row 109 (M1 CPU-only functional STT check)

Status: COMPLETE — all verification clauses PASS
Started: 2026-10-09 ~02:50 local (+07:00)
Finished: 2026-10-09 ~03:10 local (+07:00)

## Final state
- 4 serialised runs (sealed x2, AU-2 x2), all `EXIT=0`, bounded via perl-alarm + `</dev/null` (GNU timeout absent, Homebrew forbidden).
- Sealed fixture: 14 segments covering all 13 scripted sentences, language `id`, timestamps on every segment; run1/run2 JSON byte-identical (`cmp`). No phantom tail (last end inside the audio).
- AU-2 fixture: 6 segments for 6 scripted sentences, language `id`; run3/run4 JSON byte-identical.
- `-ng` in every quoted command; every log shows `use gpu    = 0` + `whisper_backend_init_gpu: no GPU found`; `grep -ci metal` = 0 on all four logs; `system_info` line shows CPU-only flags (VITISAI/COREML/OPENVINO = 0).
- D230: artifact grep-proof 0 matches (throughput pattern AND any "N ms" figure); engine-native timing footer left only in git-ignored raw logs, not reproduced.
- Model sha256 re-verified OK after runs; oMLX never started (pgrep/lsof empty); 0 new tracked git files (2 untracked doc paths); no brew/sudo/remote.
- Artifact: `research/13_stt_cpu_functional_check.md` (Tier 2). Raw evidence: `.cache/stt/checks/`.

## Done so far
- Read sources: `identification/02_structured.md:272` (row 109), `initialization/04_whisper_cpp_cpu_build.md` (row 107), `research/09_spike_stt_model_conversion.md` (row 108), `research/10_spike_stt_functional_check.md` (row 12 sealed fixture), `verification/21_audit_spikes_stt.md` §4.3 (AU-2 fixture), `masterplan/07_transcript_spec.md` §B.3 (command shape).
- Host load checked before the heavy step: `uptime` 2:50 up 14:29, load averages 4.38 4.75 3.89 (then 3.00 4.32 3.77 at 2:50). Host: Mac17,3, 10 physical cores (4P+6E), 24 GiB.
- Solo check: no vitest/jest/cmake/xcodebuild/build processes in flight; only idle DEMS dev servers (0.0% CPU watchers) + IDE helpers. No oMLX process running (never touched).
- Fixtures verified on disk:
  - sealed: `.cache/spikes/stt-check/fixture-two-speaker-id.wav` sha256 `6743181a7d976ca24c03ad8e427d6d7093fbb0b9f72257e6e2f91dcfc0f4fe71` (matches row 12 / §B.6), 65.72 s, 24 kHz mono, 13 scripted sentences.
  - AU-2: `.cache/spikes/au2/stt/au2_two_voice_id.wav` sha256 `1944fd74e04a86bb63168254cce91ee1c4f03f78dfe32bfe16a2f99f1514a388` (matches `1944fd74…1514a388`), 28.03 s, 16 kHz mono, 6 scripted sentences (`script.tsv`).
- Outputs dir created: `.cache/stt/checks/` (git-ignored via `.gitignore:47 .cache/`).
- Anti-hang: GNU `timeout`/`gtimeout` NOT installed on this host and Homebrew installs are forbidden (AU2-02); equivalent bound applied via `perl -e 'alarm …; exec …'` (alarm survives exec, kills the whisper-cli process at the bound) plus `</dev/null`.

## Command form (verbatim per brief + tx §B.3)
`<whisper-cli> -m <ggml.bin> -ng -t 8 -l id -oj -of <out> -f <fixture.wav>`
(`-t 8` on the 4P+6E / 10-core host, leaving 2 cores for OS + idle watchers.)

## Plan
1. Run 4 serialised transcriptions (sealed x2, AU-2 x2) via `.cache/stt/checks/run_row109.sh`, each bounded at 1800 s, no stdin, no wall-time recording (D230).
2. Verify JSON outputs with jq (segments, timestamps, language id), grep logs for Metal/GPU backend absence.
3. Write `research/13_stt_cpu_functional_check.md` with raw-output quotes + no-throughput grep proof.

## Current step
None — row closed. Handover to row 110 (verifier +1): re-run the section-3 command in
`research/13_stt_cpu_functional_check.md` and reuse the byte-identity assertions of its sections 5/6.
