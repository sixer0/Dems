# Row 2 — explore (M0/A): host readiness probe

| Item | Value |
|---|---|
| Status | **complete** — worker gaps closed by controller probes |
| Agent / model | `explore` (probes from files) + controller (blocked probes, read-only) |
| Artifact | `initialization/01_env_check.md` — worker document saved by controller + controller closure sections §1-§3, §7-§9, §11 |
| Worker session | `ses_eeae3d07bffeCbO0oG3Us31smM` (board ASK answered by this closure) |

## Worker result (filesystem evidence)

Disk 498 GiB free · `.git` 1.5 GB · model `safetensors` 1,613,977,443 B (MLX copy 1.5 GB unused, D229) · Q-INSTALL binaries all absent (`which -a` + Homebrew Cellar 68 formulae) · PostgreSQL pid 47413 `ready` on `127.0.0.1:4432` with exactly one user database OID (lanes absent) · stale zero-byte `.locks/core-server.lane{1,2,3}.pid` observed, nothing deleted · Graft `118M`, graph fresh 13:23 · espeak-ng 1.52.0 has `lang/poz/id`.

## Controller closure (read-only)

Before/after `lsof` pair **identical** — project ports 4420-4423, 5173, 5176-5178, 8081, 4400, **8554-8564 free**; SMART WMS `[::1]:5173/127.0.0.1:5174/[::1]:5175` and host PostgreSQL `:5432` never contacted · `npm run -s pg:status` → **`OK, running`** · FFmpeg 9.0.2 capability text captured (RTSP `listen`, `frag_duration`/`frag_size`/`fragment_index`/`movflags {default_base_moof, empty_moov, isml}`, `astreamselect inputs/map` with runtime `T` flag, `encryption_scheme {none, cenc-aes-ctr}`; **no `frag_type`/`default_prft`/`frag_start_number`**) · espeak-ng Indonesian voice confirmed `5  id  --/M  Indonesian  poz/id` · Apple M5, 10 CPUs (4P+6E), 24 GiB, macOS 27.0.1 · node v26.8.2, npm 11.19.1 · three emulators booted · **installed STT/TTS inventoryed (D7): oMLX 0.6.4, server DOWN on :8000, models `whisper-large-v3-turbo`, `qwen3-asr-1.7b-8bit`, `omnivoice-bfloat16`.**

Database name list deferred to the M2 lane row (no read-only path without owner credentials; red lines held).

## Notes for later rows

`explore` cannot write files or run non-filesystem commands — return text to the controller, or pick an agent type with shell+write. Graft already initialised (no `graft init`). oMLX port 8000 must be left alone by DEMS rows except the re-scoped row 10 (D7).
