# Row 7 — coder-execution (M1/A): Spike S1 fragmented-MP4 pipeline + running SHA-256 chain

| Item | Value |
|---|---|
| Status | **complete** — 5/5 acceptance criteria PASS in 2 runs + 1 verification run; gaps G-1, G-2, G-3 answered |
| Artifact | `research/06_spike_s1_fmp4_running_hash.md` |
| Media/scratch | `/Users/gsp-budi/Documents/DEMS/.cache/spikes/s1/` (git-ignored; 0 media files in `git status --porcelain`) |
| Host | FFmpeg 9.0.2, port 8554 only (re-checked free before every bind); no repo source edits; no sudo/emulators/installs |

## Result

Pipeline (synthetic lavfi push -> RTSP/TCP listen ingest -> `-c copy -f mp4 -movflags +empty_moov+default_base_moof -frag_duration 1500000 -fragment_index 1 -flush_packets 1`) captured 12 s -> 8 fragments, mfhd seq 1..8 contiguous, traf order [1,2] stable. Chain = SHA-256(chain_{n-1} || frag_sha) over per-fragment stored-byte hashes; independent `verify.sh` (dd/head/shasum/xxd only) re-derived every hash, chain, and prefix and asserted range/sequence contiguity — `VERIFY OK` in run 1, run 3 and on the crashed run 2 file. Graceful close: recorded last prefix == `shasum -a 256 out.mp4` (`3c80f46e…c05`). SIGKILL: truncation detected 10–15 ms after kill; durable prefix (7 fragments, 293,727 B) re-hashes to the recorded prefix (`4b41c9ca…a5f`); partial-tail detector path proven on a mid-mdat truncated copy (mdat declared 41,795 vs 4,236 present; corrupt fragment seq 7 @ byte 251,168 identified as the drop). Growth-visible-while-writing confirmed twice by ffprobe mid-session (173,101 B / 6.061 s; 128,218 B / 4.544 s, writer alive). Runs 1 and 3 produced byte-identical files (same chain) — the row-38 +1 run can compare against stored values.

## Gap answers

- **G-1:** the listen-mode ingest does **not** accept a push after the first session's TEARDOWN — it exits 0 ("Failed reading RTSP data: End of file"); a second push gets `Connection refused`. Restarted listeners do accept (runs 2/3/3b). Supervisor must restart the ingest process per session.
- **G-2:** `empty_moov` does disable auto-BSF (exact debug line captured) but the copy path needs **no workaround**: SDP `sprop-parameter-sets` extradata + movenc's internal AVCC conversion produced a clean-decoding file (`ffmpeg -i … -f null -` exit 0). Residual risk: SDPs without `sprop` — row 31 keeps an extradata presence check.
- **G-3:** plain `frag_duration` cuts at the duration boundary **mid-GOP** (fragments 2..8 start non-keyframe; fragments 5/8 contain no keyframe). `+frag_keyframe -min_frag_duration 1000000` cuts keyframe-aligned exactly on the 2.0 s GOP grid (50 packets/fragment). GOP becomes the fragment quantum when per-fragment self-containment matters.

## Blockers found and fixed during the spike (all documented with exact errors in the artifact §2)

1. `-listen_timeout` default -1 scales to -1000 on the inner TCP context -> `Result too large`; must pass an explicit finite value.
2. Trailing slash in the RTSP URL -> `SETUP …//streamid=0` -> `Unable to find requested track`; bind/push without trailing slash.
3. `-t` before the first `-i` binds only that input (lavfi `sine` ran infinite at 270x, 130 MB); durations must be per lavfi source.
4. Without `-flush_packets 1` the fMP4 stays invisible on disk until writer close (8 MiB buffering) — growth-probing and mid-write hash tapping require it; flush granularity is box-level and is **not** fsync (SP-2 for row 31).

## Left for row 38 / later rows

Six residual gaps listed in the artifact §10 (multi-hour counts, OS-crash/fsync durability, real-camera SDP variants, load-induced cadence jitter, `skip_trailer`/`delay_moov`/`separate_moof` variants, fragment_index resumption). Findings feeding row 31 are numbered SP-1..SP-8 in artifact §9.
