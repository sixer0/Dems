---
task_id: 2026-10-07_dems_real_capture_sealing
row: 31
agent: data-analyst-local
milestone: M0
class: B (GA:OD-03, OD-05, OD-06, OD-11, OD-14, OD-21, OD-25)
tier: 1
status: complete
last_updated: 2026-10-07 09:47
---

# Row 31 — capture architecture spec (progress)

## Status

complete. Deliverable `masterplan/05_capture_architecture_spec.md` written (636 lines). No file
outside this task folder was edited; the repository source tree, `decisions/decisions.md`, the
register and the spike reports were **read-only** inputs. This is a spec: M3 implements it.

## Inputs read (in order)

| # | Input | Used for |
|---|---|---|
| 1 | `identification/02_structured.md` row 31 (line 211, Verification column) + row 15 + §5/§6/§7 | the hard gate, milestone ownership, R-trace |
| 2 | `masterplan/01_specs.md` §E.1/§E.2 (and §D) | mechanism design intent the spec deepens |
| 3 | `research/12_spike_s3_media_engine_pick.md` (row 15) | binding engine pick, R1–R9 residual risks, the nine row-31 carry items |
| 4 | `research/06_spike_s1_fmp4_running_hash.md` (row 7) | four traps, G-1/G-2/G-3, SP-1..SP-8, drop-fragment rule, command shape |
| 5 | `research/07_spike_s2_mic_switch_timeline.md` (row 8) | libavfilter API switch, 21.333 ms bound, interval domain, CLI limitation |
| 6 | `research/08_spike_s4_av_sync_fixture.md` (row 9) | flash+beep fixture seed, −1.333 ms skew, analyser algorithm |
| 7 | `research/03_analysis.md` | register NM/CS/SH rows, errata E-04/E-05/E-12/E-30/E-31, W1-C1/C2, RK-1/RK-15 |
| 8 | `research/02_collection.md` F-44/F-47/F-49..F-53/F-58..F-62/F-91/F-97..F-102; `research/04_collection_stt.md` G-4 | codec, GCM-outside-muxer, C2PA hashing, GPL build, CPU contention |
| 9 | `initialization/01_env_check.md` §3 | the exact FFmpeg 9.0.2 muxer option text and the three confirmed absences |
| 10 | `decisions/decisions.md` D4/D7/D10/D12 | every gate answer and spike finding cited |
| 11 | `apps/core-server/src/engine/host.ts:897-902`, `engine/types.ts:205-209`, `packages/shared/src/api/sim-actions.ts:93` | the INTERNAL `setTabletLink` precedent for the capture seam |
| 12 | `research/01_explore.md` §2.4; `apps/core-server/src/engine/__tests__/static.test.ts` | the 21 static guards and the forbidden-text-from-fragments idiom |

## Output

| File | Content |
|---|---|
| `masterplan/05_capture_architecture_spec.md` | §0 decision inputs; §A nine module interfaces (NM-01..NM-05, NM-09, NM-10, NM-14 + the supervisor seam); §B seam/supervisor/IPC; §C fMP4 writer (quantum, flush/fsync, dual chain, exact 9.0.2 options, crash rule, SP-3); §D OD-03 encryption; §E mic switch + warning raiser; §F audio capture + AV timeline; §G static rules + test-file names; §H OD-25 storage; §I 12 P25 edits by file:line; §J hypotheses; self-gate |

## Key design decisions (with authority)

| Decision | Authority |
|---|---|
| Keyframe-aligned fragments (`frag_keyframe` + `min_frag_duration`), GOP = fragment quantum; the exact pairing is a decision for the M0 spec gate | S1 §6.4/§6.5 (SP-4, G-3); row 15 §3.1/§5 item 4 |
| `-flush_packets 1` for live-growth only; an explicit per-fragment fsync policy is required (fsync choice = HYPOTHESIS) | S1 §4.3, §8 SP-2, §10 gap 2 |
| Two SHA-256 chains: stored bytes (verifiable without the key) + plaintext whole file | OD-03 (D4); RF-6; F-62; S1 §3.1 SP-7 |
| Per-fragment AES-256-GCM wraps the stored fragment bytes outside the muxer; container structure stays clear | F-47/F-50/F-52/F-53; register W1-C2 |
| Mic switch via named `astreamselect` + `avfilter_graph_send_command("map")`; ≤ 1 AAC frame | S2 §3 run3, §6 findings 1/4 |
| `MIC_SILENT` below −50 dBFS for 10 s = warning, never auto-switch; 2 s debounce | OD-11 (D4) |
| Restart-per-session supervisor; one session = one ingest process + one file per camera | S1 §4.5 (G-1), SP-5 |
| Capture layer enters state only through hosted/INTERNAL actions (precedent `setTabletLink`) | `engine/types.ts:205-209`, `host.ts:897-902`, `sim-actions.ts:93` |

## Self-gate results

| Check | Result |
|---|---|
| NM-01..NM-05, NM-09, NM-10, NM-14 each have interface + failure modes + test hook | **9/9** (the 8 module IDs + the `CaptureSupervisor` seam in section B) |
| Every mechanism cites row 7/8/9/15 or is labelled hypothesis | **PASS** (no uncited mechanism; 9 hypotheses in §J) |
| Every P25 edit listed by file:line | **12/12** (6 × `app.ts`, 4 × `config.ts`, 2 × `index.ts`) |
| No non-existent muxer option appears anywhere in the document | **PASS — empty**: a `grep -E` with the bracketed pattern `frag_typ[e]\|default_prf[t]\|frag_start_numbe[r]` on the spec returns no output (exit 1); the three names appear only in that bracketed form (repo idiom, `engine/__tests__/static.test.ts:15`) |
| No emoji; English; tables over prose; no files outside the task folder edited | **PASS** |

## Notes / issues

- **Register re-slicing.** The register (`research/03_analysis.md` §B.6) defines NM-01 as the
  adapter layer, NM-09 as the config store + API and NM-10 as the mic-switch API; the row-31 brief
  re-slices these three by concern (NM-01 registry, NM-09 camera/PoE seams, NM-10 audio seam +
  switch controller). The spec follows the brief and cites the same register rows; the config-store
  and API operations stay owned by rows 29/CS-09 and are referenced, not re-defined.
- **The "9/9" module count.** The brief names eight module IDs (NM-01..NM-05, NM-09, NM-10, NM-14).
  The ninth interface is the `capture` supervisor seam of section B, which is given its own
  interface, failure modes and test hook, making the count 9/9 as the brief's self-gate requires.
- **The muxer-absence gate vs "note the three that do not exist".** The brief asks both to name the
  three absent options and to keep a grep of the file empty. The two are only jointly satisfiable
  if the names are written so they cannot be matched literally; the spec uses the repo's own
  bracketed-fragment idiom (`static.test.ts:15`) and quotes the empty grep. No command, option
  table or interface in the spec uses any of the three.
- **Class-C items stay deferred** (ONVIF, real PoE, real mic transport, real camera pull, OS-level
  fsync): they are HYPOTHESES in §J with the class-C entry pack of `structured` §9 unchanged.
- **No `masterplan/02_plan.md` contribution.** Row 31 writes the capture architecture spec only;
  row 37 owns the plan and row 40 produces the M2-M9 implementation rows (`structured` rows 31, 37,
  40). No implementation plan was created here.

---

*Generated: 2026-10-07 09:47*
