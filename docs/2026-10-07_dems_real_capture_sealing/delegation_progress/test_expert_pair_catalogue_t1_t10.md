---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-09
agent: test-expert
type: documentation-only (test catalogue; no code, no test runs)
tier: 3
status: complete
ordered_by: masterplan/11_audit_errata.md §5.5 / §5.6 OUT-10 (decisions D65-D68)
---

# Test-catalogue changes T-1..T-10 applied to `masterplan/10_test_strategy.md`

Documentation-only validation was performed: no test, build or lint command was run. The only file
edited is `masterplan/10_test_strategy.md`; this file is the only file created. Line numbers below are
those of the strategy file **after** the edit. A pre-edit copy was kept in the session scratch
directory and compared with `diff` (47 changed lines; 609 -> 622 lines).

Sources read for every item: `masterplan/11_audit_errata.md` §5.1 / §5.5,
`delegation_progress/data_analyst_pair_errata_2026_10_09.md` §4 / §6, `decisions/decisions.md` D65-D68
(`:78-81`), `masterplan/05_capture_architecture_spec.md` (§A.2 `:137-142`, §A.4 `:192,212-219`, §A.8
`:339-351`, §B.2 `:427-482`, §C.4 `:557-571`, §F `:682-683`, §G `:703`, §I `:742-751`),
`masterplan/03_api_contract.md` §2.5 (`:325-351`), `delegation_progress/pair_57_navigator.md`
(`:34,38,82,323-345`).

## 1. Per item: line, before, after, source

| # | Line(s) after edit | Before (abridged) | After (abridged) | Source |
|---|---|---|---|---|
| T-1 | `:165` `M3-RTSP-BIND-1` | `lsof -nP -iTCP:<port>` / `netstat -an`: every listener on 8554-8564 on `127.0.0.1` | kept, plus erratum: `lsof -nP -a -p <worker pid> -i`, every socket of the worker process, TCP and UDP, on `127.0.0.1`; `UDP *:5000` / `*:5001` must not appear; negative control = a client that requests RTP over UDP; owning row "M3-W4; widened by row 58" | cap §A.2 W-1 `:137`, §A.4 `:215-219`, §A.8 `:339-340`; PE-111-03; D66 |
| T-2 | `:159` `M3-KC-1` | one assertion, owning "31 §A.4/§B.2 -> rev-2" | one ID, two halves: process half MET at row 57, file half ("fresh playable file") OPEN at row 58; PASS only with both; restart wording true before the first durable fragment and between sessions only | cap §B.2 restart rule `:457-466`; `pair_57_navigator.md:34,82`; PE-57-06; D65(c), D67 |
| T-3 | `:162` `M3-KC-3` | heartbeat timeout restarts with back-off; unstartable worker = `CAPTURE_FAULT` | plus scope of option C (in-session back-off only before the first durable fragment; "`START` acknowledged" = "may be durable") and the sibling case: crash after the durable record -> `FAULTED`, launcher not called again, `CAPTURE_FAULT` once; row 58 owns scope + sibling | cap §B.2 `:457-482`; PE-57-06; D67 |
| T-4 | `:157` `M3-AV-1`, `:158` `M3-AV-2` | analyser bounds only; one drift case "no drift beyond it" | both: fake mics from a separate process; one forbidden mux option kept as a negative control that must FAIL by about 450 ms; first video sample excluded if the pinned flags stay. `M3-AV-2`: present ±200 ppm case keeps "slope = injected value within the 2 ms regression bound"; new row-62 case with drift expressed in the sender reports, the only one that may expect a slope near 0 | cap §A.2 W-5 `:141`, §A.8 `:342-351`, §C.4 `:569-570`, §F `:682`, §J H-10 `:808`; PE-111-01/-02/-05; D66 |
| T-5 | `:156` `M3-WI-1` | two playable fMP4; hash equality; contiguous checkpoints | plus (a) both files grow on disk during the session (size sampled, not only at close), (b) a camera stops and the audio of its file keeps landing on disk, (c) a fatal error exits non-zero; row 58 owns the three | cap §A.2 W-2/W-3/W-4 `:138-140`, §C.2 `:515`; PE-111-04/-07; D66 |
| T-6 | `:164` `M3-SR-2`; `:417` (D.1) | G-R3, G-R4, G-R6 | plus the static rule that forbids `use_editlist=1`, `negative_cts_offsets`, `avoid_negative_ts=disabled` in the worker (beside the AU2-07 rule) | cap §C.4 `:570`; PE-111-02; D66 |
| T-7 | `:163` `M3-SR-1`; `:416` (D.1) | G-R1 with no exception; no word on the P25 pin | G-R1: `node:fs` except the two pinned pre-capture importers `src/plugins/config/connection-file.ts`, `src/plugins/logger/error-log.ts`; P25 pin covers edits 13-14 beside 1-6 / 11-12 and every added line of `app.ts`; edits 7-10 not landed | cap §G `:703`, §I `:742-751`; `apps/core-server/src/capture/__tests__/static.test.ts:208,232-275`; PE-57-07/-08; D65(d), D68(b) |
| T-8 | `:169` NEW row `M3-REC-1` | (no check) | "lossless record path": records handled inline beside `ACK`, never through the lossy queue; sequence gap = `PROTOCOL_VIOLATION`; no record dropped under a flooded lossy queue; completion of sealing not read from `PROGRESS`. Runs **1**; owning row **58** | cap §B.2 `:441,445-455`; `pair_57_navigator.md:323-345`; PE-57-05; D67 |
| T-9 | `:241` `M6-STTCFG-API` | permission, secrecy, `changedFields` "changed field names", 422 `ENDPOINT_NOT_LOOPBACK` | plus stale revision = `409 INVALID_STATE` / `REVISION_CONFLICT` + `currentRevision`; `SECRET` write = `503 NOT_READY` / `CREDENTIAL_STORE_NOT_READY` until row 84; `changedFields` = comma-joined string in the fixed order; op 92 = 503 until row 115, then 200 on a booted server | C3 §2.5 `:326-327,340-351`; PE-113-07/-08/-10; D68 |
| T-10 | `:171-178` note under the A.3 table | (nothing) | one gate line, run once, not a named check: after the lane restart the log shows `capture supervisor booted` after the last boot step and `capture supervisor stopped` on SIGTERM | `pair_57_navigator.md:38` (F-9); strings at `apps/core-server/src/capture/index.ts:67-68` |

Count places re-pinned: section K row 1 (`:573`), section L.5 (`:595-604`), footer (`:622`, new dated
line; the two older footer lines are history and unchanged).

## 2. Design choices made inside the errata wording

| # | Choice | Why |
|---|---|---|
| C-1 | New check ID `M3-REC-1`, runs **1** | M3 naming style (`M3-<family>-<n>`). It is a supervisor / protocol unit on `FakeWorkerProcess` with a fake clock: section B.2 "run once" class (precedent `M5-GAP-1`); it is not a device, browser, spike, DB-backed or worker-crash check |
| C-2 | `M3-KC-1` stays ONE ID with two recorded halves, not two IDs | the source says "record as two halves" and the navigator says row 58 "lists M3-KC-1 again" (`pair_57_navigator.md:34`); blueprint rows 64 and §6 cite `M3-KC-1..4`. So the split does not change a count |
| C-3 | The `M3-KC-3` sibling and the row-62 SR-drift case are cases inside `M3-KC-3` / `M3-AV-2` | the source calls both a "case"; no new ID, no count change |
| C-4 | T-10 is a gate note under the A.3 table, not a named check | the source asks for "one line"; the catalogue schedules no device check at M3 |
| C-5 | New row and note placed after `M3-BC-1` | lines 156-168 keep their numbers, so the `:156-165` citations of `11_audit_errata.md` §5.5 still hold |

## 3. New totals, with arithmetic

Only T-8 adds a check (`M3-REC-1`, runs once).

| Figure | Before | After | Arithmetic |
|---|---|---|---|
| M3 checks | 21 | **22** | 21 + 1 |
| Active | 218 | **219** | 7 + 21 + 29 + 22 + 14 + 13 + 21 + 52 + 18 + 16 + 6 |
| Run once | 127 | **128** | 7 + 3 + 26 + 15 + 11 + 10 + 13 + 9 + 12 + 16 + 6 |
| Run 2+1 | 91 | 91 | unchanged |
| Conditional | 10 | 10 | unchanged (OD-21 fallback cells) |
| Named | 228 | **229** | 219 + 10 |

Other milestones unchanged: M0 7, M1 21, M2 29, M4 14, M5 13, M6 21, M7 52, M8 18, M9 16, X 6.

## 4. Mechanical recount (script over the section-A and section-J tables)

Method: every table row of sections A.0-A.9 and J; grouped rows expanded by their own ID cell
(`*-RG-*` = 7, `+ QA-1` = 1, `P1..P4-0` = 4, `C-S1..S6` = 6, `C-S7..S8` = 2, `P1..P4 x S1..S6` = 24,
`x S7..S8` = 8, `CH-1..4` = 4, ` / ` lists by member); class from the Runs cell (`2+1`, `1`,
`if triggered` = conditional). The same script on the pre-edit copy reproduces the old pins.

```
--- BEFORE (pre-edit copy)
M3 active 21 | 2+1 7 | once 14 | cond 0
TOTAL 2+1 91 once 127 active 218 conditional 10 named 228
--- AFTER
M0 active 7 | 2+1 0 | once 7 | cond 0
M1 active 21 | 2+1 18 | once 3 | cond 0
M2 active 29 | 2+1 3 | once 26 | cond 0
M3 active 22 | 2+1 7 | once 15 | cond 0
M4 active 14 | 2+1 3 | once 11 | cond 0
M5 active 13 | 2+1 3 | once 10 | cond 0
M6 active 21 | 2+1 8 | once 13 | cond 0
M7 active 52 | 2+1 43 | once 9 | cond 10
M8 active 18 | 2+1 6 | once 12 | cond 0
M9 active 16 | 2+1 0 | once 16 | cond 0
X active 6 | 2+1 0 | once 6 | cond 0
TOTAL 2+1 91 once 128 active 219 conditional 10 named 229
```

Self-gate greps of section L re-run after the edit: L.1 execution-count grep = no hits; L.2 loop
phrasing = the same 18 lines as before, shifted, no new hit; L.3 `biometric` = the same 3 lines;
L.4 `grep -c maxWorkers` = 26, unchanged. Table column counts: no row differs from its header.

## 5. Items for the controller

| # | Item | Owner |
|---|---|---|
| O-1 | `M3-REC-1` is not in the M3 gate list of the blueprint (`identification/02_structured.md` row 64 `:227`, §6 M3 `:295`) nor in row 58's Verification | task-architect via the controller |
| O-2 | T-10: the source names "the M3 device gate"; no blueprint row has that name (M3 gate = row 64). The strategy states the line and leaves the owning row open | controller |
| O-3 | Lines below `:168` moved by +10 (and +13 at the end of the file). The citations `:231` (`M6-STTCFG-API`, now `:241`) and `:406` / `:407` (D.1, now `:416` / `:417`) in `11_audit_errata.md` §5.5 and in the data-analyst record are pre-edit positions; neither file was edited here | controller (note only) |
| O-4 | `M6-STTCFG-API` now holds two answers that change later by design: `SECRET` = 503 at the M6 gate and 200 after row 84 (M7); op 92 = 503 until row 115, then 200. Row 84's and row 115's Verification must carry the 200 halves (errata §5.4 has the row-84 sentence) | task-architect via the controller |
| O-5 | No T-item contradicted a spec; none was left unwritten. Not re-measured here: the row-111 figures (450 ms shifts, 28 bytes, UDP sockets) are quoted from the specs | note |

---
*Generated: 2026-10-09*
*Last Updated: 2026-10-09*
