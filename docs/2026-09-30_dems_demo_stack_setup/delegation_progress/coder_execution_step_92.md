---
step: 92
agent: coder-execution
status: complete
started: 2026-10-01T02:49+07:00
---

# Step 92: demo media (progress)

| Time (WIB) | Event |
|---|---|
| 02:49 | Inputs read (row 92, P1–P13, D46, D50, D51, D54, 12_sim_contract §4). `brew list --formula` before: 52 formulae |
| 02:50 | Piper `id_ID-news_tts-medium` licence checked: MODEL_CARD "License: See URL" (a Kaggle Malayalam notebook) and fine-tuned from `lessac` (Blizzard 2013, research-only). Not permissive, so Piper is rejected (D51 order) and eSpeak NG is used |
| 02:53 | Homebrew: 12 missing deps installed explicitly, then `ffmpeg` + `espeak-ng` with `--ignore-dependencies`, so outdated `openssl@3`, `xz` and `ca-certificates` were NOT upgraded. 14 formulae added; 52 pre-existing versions unchanged |
| 02:55 | ffmpeg 9.0.2 has no `drawtext` (no freetype in the slim formula). The OSD is rasterised by the generator from a built-in bitmap font |
| 03:00 | Generator written (`packages/shared/scripts/gen-demo-media.ts`, Node built-ins + ffmpeg + espeak-ng); shared tsc and oxlint exit 0 |
| 03:06 | Preview (scratchpad): OSD legible at 720p and 360p; 0011 timestamps start 09:17:00 WIB as in the dataset |
| 03:08 | Step 32 is editing `src/sim/dataset.ts` concurrently (D54 b): 7 follow-ups today (0017–0023) and the recording scenario moved to 0024. Generator reads `buildHistory()` at run time, so it follows; scripts added for 0017–0024; `--as-of` now takes a WIB date-time (today's sessions are placed before `now`) |
| 03:12 | Budget: bitrates trimmed (CRF 28/29, grain 5, AAC 48k/32k) and publish uses fresh writes (APFS clones kept ffmpeg's over-allocation in `du`). Loop seam SSIM 0.960 = same as in-stream keyframe transitions (0.964/0.967); GOP set to 5 s |
| 03:13:54 | Run 1 (full, into the repo) started |
| 03:21 | Run 1 done (457.6 s): 198 files, 42.13 MiB, `du -sk` 43,492 KB; ffprobe sweep: 56 videos, 56 audio, 28 pairs all OK (max delta 0 s). Frame grabs saved to implementation/assets/92_*.png |
| 03:30 | Run 2 (determinism): same file list and durations; **bytes differed** for the audio of 5 sessions: eSpeak variants `f2`/`f5` use `breath` noise seeded from the wall clock (proved: `f2` differs 1.3 s apart; f4, Annie, Andrea, f1, linda, m2–m7 stable). Female variants switched to f4/Annie/Andrea |
| 03:32 | Run 3 started with the stable variants (finished 03:41, 41.55 MiB) |
| 03:41 | Controller update **D61** received (step 32 landed): cover EV 0007–0013 (already covered: SES 0017–0023 scripts in place), live loop keyed to `RECORDING_SCENARIO.sessionSeq` (already so; now 0024), **join on the evidence number**: layout re-keyed to `evidence/<EV suffix>/` and `mobile/evidence_<EV suffix>_*`, index `joinKey: evidenceSuffix`, `evidence[]` + `live{ sessionSeq, evidenceSuffixWhenSealed: formatSeq(IDLE_COUNTERS.evidence) }`, and an explicit `excerptRule` (p mod excerpt.durationMs). dataset.ts unchanged since 03:02:34 (sha256 d73e24a4…) |
| 03:45 | Run 4 (final, repo) and run 5 (same command, `--out` scratch) started concurrently for the byte-level comparison |
| 03:57 | Runs 4 and 5 done: exit 0; 198 files; 41.55 MiB; `du -sk` 42,876 KB (≤ 61,440); **byte-identical** (198/198 SHA-256, 0 duration mismatches); ffprobe sweep all OK (56 videos, 56 audio, 28 pairs, max delta 0 s) |
| 03:58 | Shared typecheck exit 0 (the earlier failure was P11 noise in step 32's `test/audio.test.ts`), lint exit 0, shared tests 375/375 |
| 03:59 | **INC-92-1:** a negative test `--as-of 2026-13-99` passed the format regex (Date.UTC rollover) and started a full run into the repo; stopped about 2 min in, before publishing; repo re-hashed 198/198 = run 4; temp folder removed; validation fixed (exact round-trip); 5 invalid-argument paths re-tested (exit 1, no output); final script reproduces the published bytes (28/28) |
| 04:05 | Log `implementation/64_demo_media.md` written; 12 frame grabs `implementation/assets/92_*.png` (they replace this step's earlier grabs) |

**Status: complete.** Files: `packages/shared/scripts/gen-demo-media.ts`; `packages/shared/assets/demo-media/**` (198); `implementation/64_demo_media.md`; `implementation/assets/92_*.png` (12); this file. Host: 14 Homebrew formulae (rollback in 64 §2). Not written by step 92: THIRD_PARTY_NOTICES.md (step 37 appended its own section at 03:23:43; no media row due), package.json/lockfiles, src/sim, shared tracking files.
