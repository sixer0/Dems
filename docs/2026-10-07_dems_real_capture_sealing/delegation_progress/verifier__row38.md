---
task_id: 2026-10-07_dems_real_capture_sealing
row: 38
agent: verifier
milestone: M1
tier: 2
status: complete
verdict: M1 GATE PASS — 25/25 criteria PASS, 0 failures routed
last_updated: 2026-10-07 17:35
---

# Row 38 — M1 spike gate (progress)

## Status

complete. Deliverable `gateway_check/04_m1_spike_gate.md` written. Independent +1 re-runs of
S1/S2/S4 and the STT functional check were executed in the verifier's OWN directories
(`.cache/spikes/s1_gate/`, `s2_gate/`, `s4_gate/`, `stt_gate/`); the producers' original
evidence was read-only and is untouched.

## Outputs

| File | Content |
|---|---|
| `gateway_check/04_m1_spike_gate.md` | Verdict table (one row per criterion), overall verdict, failures routed, evidence index, hygiene section |
| `delegation_progress/verifier__row38.md` | this progress record |

## Criteria verified (independent re-run, not report reading)

| Producing row | Criteria | Result | Independent evidence |
|---|---|---|---|
| 7 (S1) | 5 | PASS 5/5 | own capture: mid-write ffprobe; whole-file hash == running prefix == row-7 expected `3c80f46e…c05`; `verify.sh` + shell `dd` re-hash of frags 1/5; `kill -9` → `truncated_no_trailer` 0.018 s, durable prefix `4b41c9ca…0e2ea5f` equal |
| 8 (S2) | 4 | PASS 4/4 | own CLI run: 1 audio stream; 376 packets strictly monotonic; gap 0.001 ms <= 21.333; interval log match error −1.17 ms + independent Goertzel (440→880) and `astats` zero-crossing (440.2/879.8 Hz, 10.46 dB step) |
| 9 (S4) | 3 | PASS 3/3 | own pipeline capture: aligned −1.333 ms, injected 78.667 ms flagged, direct controls 0.0/80.0 ms; 5 fragments; sha256 anchors `58425017…8ea98eb` / `78e88811…ac82b522` equal |
| 12 (STT) | 7 | PASS 7/7 | fixture sha256 `6743181a…c0f4fe71` equal; 17-segment JSON, language id, byte-identical across 2 runs; 13/13 scripted sentences covered; no throughput figure; server DOWN at end |
| 15 (pick memo) | 5 | PASS 5/5 | 12 criteria; 24/24 cells cite resolvable artifacts; 8 GStreamer `Not evaluated on host`; 0 invented numbers; 9 residual risks |
| 38 hygiene | 1 | PASS 1/1 | `git status` media count 0; gate runs changed no source file; ports/processes clean |

**Total: 25/25 PASS.** 0 failures routed.

## Gate discipline applied

- Re-derived hashes independently (shell `dd`/`head`/`shasum`; pure-Python Goertzel; `astats`); the
  producers' tools were reused only with an added independent cross-check and are named as reused.
- Verified against the producers' **recorded expected values** (S1 chain/range, S4 anchors), so the +1 run
  asserts expected-value equality, not self-consistency.
- No benchmark numbers recorded (D230): only two wall-clock latencies, explicitly labelled.
- STT server started only for the STT step and stopped before finishing.

## Notes / issues

- `masterplan/02_plan.md` does not exist (row 37 has not run), so the row-38 tracking-table update could not
  be written there; status is recorded here and in `decisions.md`/the controller summary. No controller-only
  tracker was edited.
- `git ls-files` reports 265 pre-existing tracked media (task-2 evidence + app assets, unmodified); the row-38
  criterion — 0 media in `git status --porcelain` — passes and no spike media is tracked.
- The real `kill -9` again landed on a fragment boundary (deterministic on this host); durable-prefix equality
  is the criterion and it passed, so the synthetic mid-`mdat` partial-tail path was not re-created.
- One Low documentation nit (row 15 §2.1 list omits criterion 3 while the count 8 is correct) is recorded in
  the gate report; it is not a criterion failure and triggers no re-delegation.
- Original evidence untouched (mtimes unchanged); no source file changed by the gate runs. `gateway_check/`
  appeared mid-gate from sibling row 25 — attributed, not touched.

---
*Generated: 2026-10-07 17:35*
