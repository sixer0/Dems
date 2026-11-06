# verifier-local - row 110 (M1 CPU-STT gate addendum, +1 independent verification, tier 2)

Status: COMPLETE - verdict **STT-5 CPU clause CLOSED**. Date: 2026-10-09. Session: verifier-local subagent (row 110 delegation, DEMS task 3 phase C, blueprint rev 2.1; dependency row 109 verified DONE before start). Ran solo: no test/build job in flight at any point; two serialised single-process transcriptions.

Deliverable: `docs/2026-10-07_dems_real_capture_sealing/gateway_check/26_m1_cpu_stt_addendum.md` (Tier 2) plus this note. No masterplan, spec, plan, code, tracker, `packages/shared`, `apps/**`, migration, `openapi.json` or lockfile file was modified. Nothing staged or committed; no push; no remote; no sudo; no Homebrew write; oMLX never touched.

## Result summary

| Clause | Requirement | Result |
|---|---|---|
| 1 | Own CPU re-run on the sealed two-voice Indonesian fixture with the row-107 binary + row-108 model, `-ng -t 8 -l id -oj`, output under `.cache/stt/checks/` | CONFIRMED — exit 0, 3,717 B JSON, 14 segments, all with timestamps + offsets, `params.language="id"` / `result.language="id"` |
| 1b | >= 1 segment per scripted sentence | CONFIRMED — own checker (`coverage_row110.py`), 13/13 sentences covered in turn order |
| 2 | `otool -L`: no Metal framework, no `/opt/homebrew` library | CONFIRMED — only `libSystem.B.dylib` + `libc++.1.dylib`; `grep -ci metal` 0; `grep -c /opt/homebrew` 0 |
| 2b | Run log shows `use gpu = 0` / `no GPU found` | CONFIRMED — plus `devices = 1`, `backends = 1`, zero `metal` hits in my log |
| 2c | `brew list --formula --versions` unchanged vs row-107 recorded state | CONFIRMED — sha256 `a3fcd57f…b55e5`, 66 formulas, `DIFF_EXIT=0` both before and after my runs |
| 3 | No throughput / RTF / WER figure in row 109's artefact (D230) | CONFIRMED — row 109's own grep 0 matches; my broader rate grep 0 matches; all four time-flavoured numbers classified as input metadata / alarm bound |

Nothing was routed back to rows 107/108/109: no discrepancy found between their claims and the measured state.

## Independent evidence added beyond rows 107/109

1. **Cross-agent determinism**: my JSON is **byte-identical** to row-109 run1 and run2 (sha256 `6039a944…cab94439` for all three). The log diff vs run1 is 16 lines only — the output-path line plus the engine's own `whisper_print_timings` footer.
2. **Symbol-level proof**: zero Metal symbols, zero undefined ObjC references, only `_ggml_backend_cpu_reg` as a backend registration symbol, compile DB defines only `GGML_USE_CPU` / `GGML_USE_CPU_REPACK`.
3. **Runtime library trace**: re-ran with `DYLD_PRINT_LIBRARIES=1`; all 81 loaded images are `whisper-cli` or `/usr/lib/**` — no Metal/CoreML/Accelerate/IOKit/`/opt/homebrew`/`/usr/local` image at runtime, which also discharges the `ggml_backend_load_all()` dlopen probe path (`examples/cli/cli.cpp:1059`).
4. **Live cmake cache** read from the build tree (not row 107's transcription): `GGML_METAL/BLAS/ACCELERATE/CUDA/VULKAN/HIP/COREML/OPENVINO = OFF`, `BUILD_SHARED_LIBS=OFF`, zero `.dylib` in the tree.
5. **Own mechanical coverage check** instead of reusing row 109's mapping table.

## Disclosed imperfections (recorded, not hidden)

- The binary contains exactly one case-insensitive `metal` string: the dlopen filename argument `ggml_backend_load_best("metal", …)` at `ggml/src/ggml-backend-reg.cpp:590`. Proven inert (no such library on disk anywhere reachable; nothing loaded at runtime). Row 109's "zero metal hits" claim was scoped to run logs, where it holds.
- `A5` renders `Anda alami` as `yanza alami` (similarity 0.98) — same defect class the GPU run showed. Described in prose; not scored, because WER is forbidden by D230.
- `A7` splits across segments 12+13 (segmentation boundary, coverage still satisfied).
- Run B's JSON differs from run A only in the echoed `params.model` string because I passed `-m` relatively there; transcript body identical.
- Host load was 7.0 on 10 cores at the first `uptime`; attributed via `top` (73% idle, nothing above 0.0% CPU) and a `ps` grep before launching. GNU `timeout`/`gtimeout` are absent and may not be installed (AU2-02), so the anti-hang bound uses `perl -e 'alarm shift @ARGV; exec @ARGV' 1800 …` with `</dev/null`.
- AU-2's independent fixture was not re-run: out of scope per the row-110 brief (sealed fixture only); row 109 covers it twice.

## Evidence location

Raw artefacts (git-ignored, `.gitignore:47:.cache/`): `.cache/stt/checks/run_row110.sh`, `coverage_row110.py`, `exit_codes_row110.txt`, `row110_sealed_fixture.{json,log}`, `row110_dyld_probe.{json,log}`; formula snapshots `.cache/stt/brew_list_row110.txt` and `brew_list_row110_after.txt`. Inputs re-verified unmodified after the runs: `whisper-cli` sha256 `2429de42…086a3db` + mtime `Oct 8 09:06:26`, model `shasum -c` OK, sealed fixture `6743181a…c0f4fe71`.

## Next step for the controller

Gate-04 STT-5 CPU clause (`gateway_check/04_m1_spike_gate.md:35`) can be marked CLOSED on `cpu-local`. Row 76 (`TranscriberAdapter` `cpu-local` backend) and row 77 / `M6-DF-1` may proceed against this build with `-ng` retained; benchmark classes (RTF/RAM/WER) remain class C-7 on the Core device.
