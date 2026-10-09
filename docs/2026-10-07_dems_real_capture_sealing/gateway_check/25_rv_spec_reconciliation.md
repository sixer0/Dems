---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-08
agent: verifier-local
blueprint_row: 106
milestone: M0 pickup (gate that opens M2)
tier: 2
type: spec-reconciliation gate after the revision round RV-SPEC (read-only)
status: complete
verdict: M2 OPEN - 0 blocking gaps
depends_verified: [41, 43]
sources:
  - identification/02_structured.md rev 2.1 row 106 (line 269), checklist, CF-10..CF-12, section 0.1
  - report/report.md section 0 (audit rules 1-8)
  - masterplan/11_audit_errata.md (84 errata rows + 14 R-8 rows, D22)
  - verification/22_audit_docs_decisions.md (AU3-01..AU3-19)
  - verification/21_audit_spikes_stt.md (AU2-01..AU2-08) as the finding source
  - decisions/decisions.md D14/D20/D22/D24/D26
files_written: [gateway_check/25_rv_spec_reconciliation.md, delegation_progress/verifier-local__row106.md]
files_modified: []
---

# Row 106 - RV-SPEC spec-reconciliation gate (opens M2)

## 0. Verdict

**M2 OPEN - 0 blocking gaps.**

| Measure | Count |
|---|---:|
| Checklist items verified PASS with file:line evidence | 9 / 11 |
| Checklist items carrying a routed gap (item 8 CF-12 sub-clause, item 11) | 2 / 11 |
| Routed edits total (G-1 .. G-6), from those items plus the ID sweep | 6 |
| Routed edits that block M2 opening (rows 44/45 and the rest of M2) | 0 |
| Masterplan files inspected | 11 (all) |
| Masterplan/spec files edited by this row | 0 (read-only, enforced) |

Every spec item that a rev-2.1 row cites exists in `masterplan/*`, is stated consistently across the
ten spec files and the plan, and matches the errata ledger's claim. The six routed items are
check-catalogue and cross-reference bookkeeping owned by test-expert (four) plus two wording and
pointer attributions owned by data-analyst; none changes any M2 row's contract (schema v2, lanes,
89-op pins, simulator v2, seeds),
so rows 44/45 and their wave-mates may launch. Each routed item carries an explicit deadline earlier
than the milestone that would otherwise lose the check.

Errata volume cross-checked mechanically: `masterplan/11_audit_errata.md` section 1 = **84 rows**,
section 2 (R-8, D20) = **14 rows**, matching D22 and `report/report.md` section 0 ("84 errata + R-8
sections").

## 1. Method (all read-only)

- `rg -n` sweeps over `masterplan/` for each spec token the checklist names (`-1.333`, `78.667`,
  `0.001 ms`, `packet-grid`, `M3-AV-1`, `M3-AV-2`, `M3-KC-2`, `M3-KC-4`, `M5-GAP-1`, `M5-SW-W`,
  `M3-RTSP-BIND-1`, `SEC35-23`, `stt_config`, `M6-STTCFG-*`, stale phrases `later wave`,
  `already coded`, `Q-INSTALL item 1 (Homebrew`, `GPU disabled`).
- Line-window reads of every hit to classify it as live text versus correction/erratum/withdrawal text.
- A token-diff script over blueprint rows 44-119 (Verification columns) against
  `masterplan/10_test_strategy.md`: **143 distinct check-ID tokens cited; every one resolves into the
  catalogue except three families** (`M3-RTSP-BIND-1`, `M8-EV-SCOPE-1`, and the `*-W<n>` plan W-row
  identifiers which are not checks; `M3-RG-MOB`/`M4-RG-WEB`/`M4-RG-MOB` are members of the `Mx-RG-*`
  family rows at `10_test_strategy.md:155`/`:180`; `M9-CH-2/3/4` are inside the family row at
  `10_test_strategy.md:292`). Script: session scratch `/var/folders/.../kilo/row106/ids.py`.
- Nothing under `masterplan/`, `apps/` or `packages/` was opened for writing; no git write; no command
  that touches oMLX, Homebrew, SMART WMS ports or any listener.

## 2. Item-by-item result

Legend: PASS = confirmed consistent with file:line evidence. ROUTED = gap confirmed, routed to its
owning author with the exact edit (section 4).

| # | Item (expected state) | Where found | file:line | Result |
|---|---|---|---|---|
| 1a | R-5 narrative states the two-engine truth (oMLX = dev on Apple GPU; `cpu-local` built GPU-off and proven on this Mac) | specs R-5 | `masterplan/01_specs.md:183` | PASS |
| 1b | R-5 AC-1 keeps the CPU criterion **and** an honest status "NOT yet met", met only by the `cpu-local` check + `M6-TF-1` on `cpu-local` | specs R-5 AC-1 | `masterplan/01_specs.md:187` | PASS |
| 1c | R-7 AC-3: production CPU-only, Mac `omlx-server` uses Metal by design and is not the shipped engine | specs R-7 AC-3 | `masterplan/01_specs.md:212` | PASS |
| 1d | C-N1 no longer claims row 12 proved "GPU disabled"; verification = `cpu-local` `-ng` 2+1, erratum quoted | specs C-N1 | `masterplan/01_specs.md:241` | PASS |
| 1e | OD-24 keeps the approved D4 value, records D7(b) "not cancelled", states the Homebrew risk and the source-build route at the gate | specs OD-24 | `masterplan/01_specs.md:302` (+ second-gate note `:309`) | PASS |
| 1f | tx section B.3: Nature / Install (source build, `GGML_METAL=OFF`, cmake from venv, zero Homebrew change) / Proof on this Mac / Status today | transcript spec B.3 | `masterplan/07_transcript_spec.md:228`, `:232`, `:234`, `:235`; Dev-vs-Core `:244` | PASS |
| 1g | Adapter row and per-milestone M6 row agree with 1a-1f; plan M6-W1 + M6 note agree | specs E.3/F; plan | `masterplan/01_specs.md:360`, `:418`; `masterplan/02_plan.md:212`, `:217` | PASS |
| 1h | M1-TT-4 marked NOT MET at M1; M6-TF-1 runs both backends with `-ng`; M6-DF-1 on `cpu-local` | test strategy | `masterplan/10_test_strategy.md:107`, `:210`, `:211` | PASS |
| 1i | No surviving contradiction: stale phrases `later wave` / `already coded` / `Q-INSTALL item 1 (Homebrew` / `GPU disabled` = 0 live hits in `masterplan/*` | sweep | 0 hits outside `masterplan/11_audit_errata.md` self-quotes (`:62`, `:63`, `:68`, `:109`, `:159`, `:168-169`) | PASS |
| 2 | `-1.333 ms` never appears as a live measurement; only inside correction text | specs F-M1, plan M1 gate, cap D12 + withdrawal, ev field 51, test M1-S4-1/2 | `masterplan/01_specs.md:413`; `masterplan/02_plan.md:96`; `masterplan/05_capture_architecture_spec.md:54`, `:548-549`; `masterplan/06_evidence_package_spec.md:239`; `masterplan/10_test_strategy.md:102`, `:103` | PASS |
| 3 | `M3-AV-1` carries the 2 ms regression bound (0/+80/-80 ms truths) **separate from** the +/-40 ms product bound; the -80 ms case exists | test A.3; cap F; specs E.1/F; plan M3-W4 | `masterplan/10_test_strategy.md:157`, `:103`; `masterplan/05_capture_architecture_spec.md:545`, `:546`; `masterplan/01_specs.md:342`; `masterplan/02_plan.md:177` | PASS |
| 4a | `M5-SW-W` proves gaplessness by decoded sample count + per-input continuity; packet-grid explicitly not the evidence | test A.5; specs R-3 AC-1; cap E | `masterplan/10_test_strategy.md:196`; `masterplan/01_specs.md:164`; `masterplan/05_capture_architecture_spec.md:518` | PASS |
| 4b | `M5-GAP-1` carries the negative vector (1,000 samples removed) that must FAIL | test A.5 | `masterplan/10_test_strategy.md:199` | PASS |
| 5a | Switch bound is per worker input chunk (+ IPC latency), not "1 AAC frame"; 21.333 ms survives only as the pull-loop qualifier / `AUDIO_FRAME_MS` | cap E, D10, NM-10; specs E.2; C3 op 81; test | `masterplan/05_capture_architecture_spec.md:517`, `:53`, `:261`, `:281`; `masterplan/01_specs.md:350`, `:164`; `masterplan/03_api_contract.md:235`; `masterplan/10_test_strategy.md:100` | PASS |
| 5b | Filtering-thread-only rule for `avfilter_graph_send_command` | cap E thread rule; specs E.2; plan M5-W1 | `masterplan/05_capture_architecture_spec.md:515`; `masterplan/01_specs.md:350`; `masterplan/02_plan.md:201` | PASS |
| 6 | H-10 (camera video clock vs host audio clock) with falsifier `M3-AV-2`, fake camera in a **separate process with its own clock**, injected +/-80 ms + slow drift, analysed per camera file | cap J; test A.3; specs F-M3; plan M3-W4 | `masterplan/05_capture_architecture_spec.md:646`; `masterplan/10_test_strategy.md:158`; `masterplan/01_specs.md:415`; `masterplan/02_plan.md:177` | PASS |
| 7a | RPO = one fragment = one camera GOP; DEMS cannot enforce the GOP on `-c copy`; observed-keyframe check; OP-GOP open | cap C.1; specs E.1; C3 section 7 | `masterplan/05_capture_architecture_spec.md:384`, `:385`, `:386`, `:388`; `masterplan/01_specs.md:336`; `masterplan/03_api_contract.md:634` | PASS |
| 7b | `M3-KC-2` mandatory RECOVERY tail validation by box walk (ffprobe/decoder are not detectors) and `M3-KC-4` long-GOP crash loss | cap C.5; test A.3; plan M3-W3 | `masterplan/05_capture_architecture_spec.md:446`; `masterplan/10_test_strategy.md:160`, `:161`; `masterplan/02_plan.md:176` | PASS |
| 8a | R-8 present and coherent in all seven sibling sections + the security addendum | specs / C3 / dbc-3 / ev / tx / ux / test / sec | `masterplan/01_specs.md:214` (R-8 + 7 proposed ACs); `masterplan/03_api_contract.md:301`, `:311-313` (ops 90/91/92), registry note `:107`; `masterplan/04_database_contract.md:469` (B.13 `stt_config`), kept set `:680`; `masterplan/06_evidence_package_spec.md:316` (B.7a, fields 121-123 at `:325-327`), E.5 extension `:575`; `masterplan/07_transcript_spec.md:264` (B.7); `masterplan/08_client_ux_spec.md:583` (8a Flow 8); `masterplan/10_test_strategy.md:217` (A.6a, 8 checks at `:225-232`); `masterplan/09_security_design_review.md:414` | PASS |
| 8b | CF-12 split of `M6-STTCFG-OFF`: at M6 the check asserts seal state + manifest field; the verify clause belongs to the M7 side | test A.6a; specs R-8 AC-5 | `masterplan/10_test_strategy.md:228` (still "v2 verify PASS on server"); no M7-side check (`DISABLED`/`backendUnreachable` occur only at `:228`/`:229`); mirror wording `masterplan/01_specs.md:231` | **ROUTED (G-1, G-2)** |
| 9 | Row 41 landed: 0 old gate tokens, `07..14` renumber present | test strategy | `rg '06_m2_gate\|13_m9_gate' masterplan/10_test_strategy.md` = **0 hits**; new tokens at `masterplan/10_test_strategy.md:56`, `:120`, `:150`, `:171`, `:190`, `:204`, `:236`, `:264`, `:281` | PASS |
| 10 | Row 43 landed: C-N4 carries the loopback-ingest clause citing SEC35-23 | specs C | `masterplan/01_specs.md:244`; constraint count still 12 (`rg -c '^\| C-N[0-9]+ '` = 12) | PASS |
| 11 | `M3-RTSP-BIND-1` adjudication (SEC35-23 static assertion) | cap A.4/A.8; plan; test catalogue | Named `masterplan/05_capture_architecture_spec.md:166`, `:185-189`, `:307-309`, static guard `:126`; carried `masterplan/02_plan.md:123`, `:177`, `:376`, `:575`; **0 hits** in `masterplan/10_test_strategy.md` | **ROUTED (G-3)** - ruling in section 3 |

## 3. Adjudication of item 11 (`M3-RTSP-BIND-1`)

**Ruling: the finding is a genuine catalogue gap (option (ii) in substance) and is NOT an M2 blocker.
M2 opens; the edit must land before blueprint row 60 (`02_plan.md` M3-W4) executes.**

Reasoning with evidence:

1. **The control itself is normative and complete, so nothing is unimplemented.** The bind rule is
   mandatory text: "`masterplan/05_capture_architecture_spec.md:166`" (`| Bind address (SEC35-23) |
   the **RTSP listen ingest** input URL host literal MUST be **`127.0.0.1`** ... never with a
   wildcard`). It repeats at `:307-309` for the NM-14 fixture readers and is reinforced by the static
   rule family (`:126` forbids "RTSP ingest listener binding to anything other than loopback";
   `:185-189` adds "the static rule G-R4/SEC35-25 also forbids a wildcard literal in the worker
   command").
2. **The check is carried by the plan and by the gate**, so it will run: `masterplan/02_plan.md:177`
   names `M3-RTSP-BIND-1` in the M3-W4 check column; `masterplan/02_plan.md:376` names it in the M3
   gate list ("**M3-RTSP-BIND-1** (sec SEC35-23)"); blueprint rows 60 and 64 and the milestone map
   (`identification/02_structured.md:295`) repeat it; the invariant is restated at
   `masterplan/02_plan.md:123`.
3. **But the catalogue is the counting authority**, and the check is absent from it.
   `rg -n 'M3-RTSP-BIND-1' masterplan/10_test_strategy.md` = 0 hits, while the self-gate pins
   "M3 **20** ... Total named checks: 207 active" (`masterplan/10_test_strategy.md:556`) and L.5
   reproduces the arithmetic (`:578-581`). The M3 gate reports n/n from the catalogue, and the final
   chain reconciles "this strategy's catalogue vs the closed ledger" (`masterplan/10_test_strategy.md:292`,
   `M9-CH-1..4`), so a check that lives only in the plan becomes an unaccounted check exactly at the
   reconciliation AU-3 was written to catch. The remediation document itself records it as a proposal
   never registered: "New check `M3-RTSP-BIND-1` (proposed addition for row 36/37, sibling of
   `M3-WI-1`)" (`masterplan/05_capture_architecture_spec.md:186`; `gateway_check/06_security_remediation.md:245`).
4. **Why it does not gate M2.** Its first execution point is row 60 (M3 fixtures) and its proof point
   is the M3 gate (row 64). No M2 row creates an RTSP listener; M2's own proving set
   (`masterplan/02_plan.md:375`) contains no RTSP-bind check. The exposure the finding addresses
   (SEC35-23, High) is already prevented normatively by the spec rule plus the G-R4 static guard,
   which M3-W1/M3-W2 do build (`masterplan/10_test_strategy.md:163-164`, `M3-SR-1`/`M3-SR-2`).
   Adding one catalogue row plus the count re-pin is a mechanical test-expert edit that can run in
   parallel with the M2 wave.
5. **Same-shape precedent found in this sweep** (section 4, G-4): `M8-EV-SCOPE-1` is carried by
   `masterplan/02_plan.md:381`/`:427`/`:576` and cited by blueprint rows 90/94, and D24 answered
   Q-SEC-1 (a) = confirm, yet it also has 0 hits in the catalogue. Treating item 11 as "adequately
   carried" would silently bless that second gap too; the consistent ruling is therefore "genuine
   catalogue gap, routed, deadline = the owning milestone, M2 unaffected".

## 4. Routed gaps, owners, exact edits

Blocking column: whether M2 opening depends on it.

| ID | Gap | Owner | Exact edit | Deadline | Blocking M2 |
|---|---|---|---|---|---|
| G-1 | `M6-STTCFG-OFF` still asserts "v2 verify PASS on server" although verify v2 lands at M7 (row 85). CF-12 requires the split. `masterplan/10_test_strategy.md:228`. No M7-side check carries the verify clause (`DISABLED` / `backendUnreachable` appear only at `:228`/`:229`) | test-expert-local | In `masterplan/10_test_strategy.md` row `:228`: delete "; v2 verify PASS on server", ending the asserts cell at "`DISABLED_BY_CONFIGURATION`" and adding "(manifest state only; verify clause is `M7-VV-SRV`, CF-12)". Add one M7 catalogue row in section A.7 beside `M7-VV-SRV` (`:255`), e.g. `M7-STTCFG-VERIFY` - "a `DISABLED` package and an unreachable-`PARTIAL` package verify PASS with the state reported, and tampering `transcript.state` FAILs", runs 2+1, owning row rev-2.1 M7 (row 119), cites ev B.7a/section D + C3 op 41 V-checks. Re-pin section K (`:556`) and L.5 (`:578-581`): M6 stays 14, M7 gains 1, active total +1, the 2+1 tally +1 | Before row 116 launches (M6 seal-side work); at the latest before the M6 gate (row 81) | No |
| G-2 | Mirror of G-1 in the requirement text: `masterplan/01_specs.md:231` (R-8 AC-5) attributes the verify clause to `M6-STTCFG-OFF` 2+1 | data-analyst-local | In `masterplan/01_specs.md:231` replace "and v2 verify passes; `M6-STTCFG-OFF` **2 + 1**" with "and v2 verify passes (verify clause proven at M7 by `M7-VV-SRV` / the CF-12 split check, blueprint row 119); seal-state clause `M6-STTCFG-OFF` **2 + 1**". AC count and requirement count unchanged (R-8 stays 7 ACs) | With G-1 (same revision pass) | No |
| G-3 | `M3-RTSP-BIND-1` has no catalogue row (adjudicated in section 3) | test-expert-local | Add one row to `masterplan/10_test_strategy.md` section A.3 (`:148`-`:168`) beside `M3-SR-2` (`:164`): `M3-RTSP-BIND-1` - "start the ingest and assert with `lsof -nP -iTCP:<port>` / `netstat -an` that every listener on 8554-8564 is bound to `127.0.0.1` and never `0.0.0.0`/`*`, incl. the NM-14 fixture readers; the static rule G-R4 forbids a wildcard literal in the worker command", command "capture-worker listener snapshot + static guard", runs 1, owning row "rev-2 M3 W-row M3-W4", cites cap A.4/A.8 + SEC35-23 + specs C-N4. Re-pin section K `:556` (M3 20 -> 21, active 207 -> 208, once-per-checkpoint 123 -> 124) and L.5 (`:578-581`). Optional same-pass tidy: `masterplan/02_plan.md:575` "(incl. proposed `M3-RTSP-BIND-1`)" -> drop "proposed" once catalogued | Before row 60 launches (M3 fixtures); at the latest before the M3 gate (row 64) | No |
| G-4 | Same shape, second instance: `M8-EV-SCOPE-1` has 0 catalogue hits (`rg -n 'EV-SCOPE' masterplan/10_test_strategy.md`) while `masterplan/02_plan.md:381`, `:427`, `:576` carry it and D24 confirmed Q-SEC-1 (a) = the narrowed REAL-evidence view | test-expert-local | Add one M8 row in section A.8: `M8-EV-SCOPE-1` - "op 88 REAL-evidence case scope: an INVESTIGATOR/TECHNICIAN sees only cases they hold; out-of-scope reads refused `403 NOT_PERMITTED` and the attempt audited", 2+1 on web/emulator, cites C3 op 88 + specs SEC35-16 + plan F-1; re-pin K/L.5 (M8 17 -> 18) and mark "proposed" retired in `masterplan/02_plan.md:381`/`:576` (that last file is the plan; if the controller prefers the plan untouched, retire the word in the catalogue only) | Before row 90 launches (M8 playback auth) | No |
| G-5 | Catalogue still treats the confirmed R-8 checks as pending: `masterplan/10_test_strategy.md:219` says "Not scheduled and not counted as active until the user confirms Q-STT-CFG"; D24 answered Q-STT-CFG (a) = all 13 defaults confirmed, so `M2-STTCFG-DB` (`:225`) becomes an active M2 check and the 7 `M6-STTCFG-*` (`:226-232`) become active M6 checks; section K still books them as conditional (`:556`, `:581`) | test-expert-local | Restate the A.6a header (`:217`, `:219-221`) as active (confirmation recorded: D24, Q-STT-CFG (a)) and re-pin K/L.5: active 207 -> 215, conditional 18 -> 10 (the 10 OD-21 fallback cells stay). Align the M2 gate set with the milestone map (`identification/02_structured.md:294` "M2 catalogue + M2-STTCFG-DB"). Do not move rows between sections; the 8 checks stay in A.6a | Before row 112 launches (M2 `stt_config` table) - rows 44/45 unaffected | No |
| G-6 | Cross-document mis-pointer: `masterplan/05_capture_architecture_spec.md:389` sends the reader to "`10_test_strategy.md` §A.4" for `M3-KC-4`, but M3 checks live in test §A.3 (`10_test_strategy.md:148`) and §A.4 is the M4 table (`:169`) | data-analyst-local | In `masterplan/05_capture_architecture_spec.md:389` change "`10_test_strategy.md` §A.4" to "`10_test_strategy.md` §A.3". Same-pass tidy if convenient: `masterplan/10_test_strategy.md:161` cites its own row as "31 §C.1" (correct) so only the cap pointer changes; no count changes anywhere | With G-3, before row 60 | No |

No gap is owned by database-specialist, coder-execution or security-review; the credential, kept-table,
secret-column and loopback-CHECK contracts were checked against `masterplan/04_database_contract.md:469-498`
and `masterplan/09_security_design_review.md:414` and are internally consistent with C3 section 2.5
(`masterplan/03_api_contract.md:301-313`) and R-8 AC-3 (`masterplan/01_specs.md:229`).

## 5. Observations that are not gaps (recorded so the next reader does not re-open them)

| # | Observation | Disposition |
|---|---|---|
| O-1 | The errata ledger's own line citations drift slightly where later rows shifted content: `masterplan/11_audit_errata.md:43` cites `05_capture_architecture_spec.md:380` for the GOP/RPO table, whose rows now sit at `:379`-`:389` (RPO at `:384`); `:44` cites `:446` which is exact. Spec text is correct; only the ledger pointer is approximate | No action required for execution; optional one-line refresh by data-analyst when G-2 is applied. Not routed (does not affect any row or check) |
| O-2 | `research/07_spike_s2_mic_switch_timeline.md` and `research/10_spike_stt_functional_check.md` still carry the pre-erratum facts, and `status_tasks.md:24` / `delegation_progress_report.md:25` quote `-1.333 ms` | Already logged and owned: errata section 4 OUT-2/OUT-3 name the controller as owner. Outside `masterplan/*`, therefore outside row 106's scope. Restated here for the controller |
| O-3 | Two historical lines in the test strategy keep old numbering deliberately: `masterplan/10_test_strategy.md:53` (numbering prose) and `:588` (row-40 changelog "confirm the `gateway_check/06..13` naming") | Correct as history, per the row-41 note in `delegation_progress/test-expert-local__row41.md`. Not a defect |
| O-4 | `21.333 ms` remains in eight places | Correct: it is `AUDIO_FRAME_MS` or the explicit 1024-sample pull-loop qualifier (`masterplan/07_transcript_spec.md:78`, `:132`; `masterplan/03_api_contract.md:651`, `:653`; `masterplan/05_capture_architecture_spec.md:53`, `:517`, `:544`; `masterplan/01_specs.md:342`, `:350`; `masterplan/10_test_strategy.md:100`) |
| O-5 | Every R-8 section still reads "PROPOSED - pending Q-STT-CFG" | Consistent across all seven files (that is what item 8a verifies). The post-D24 status refresh is a controller/doc decision, not an RV-SPEC inconsistency; G-5 covers the only part that changes a check tally inside M2's own milestone |
| O-6 | Blueprint row 106 also names "each gap routed to its owning author ... and re-checked" | Re-check pass is scheduled by the controller after each routed edit lands; this file is the baseline. Rows 44/45 do not depend on any routed edit |

## 6. Invariants honoured

Read-only across `masterplan/`, `apps/`, `packages/` (0 writes, 0 deletes; the only files written are
the two declared in the front matter). No git write of any kind. English throughout. No emoji. No
command touched oMLX, Homebrew, a device, an emulator PIN, a server, or the SMART WMS ports
`[::1]:5173`, `127.0.0.1:5174`, `[::1]:5175`. No secret, key or credential value read or printed.

## 7. Handover

M2 may open now: rows 44 (lane infrastructure + per-lane pairing) and 45 (typed schema v2) and their
wave-mates may launch under the M2 catalogue `masterplan/10_test_strategy.md` §A.2 (`:115`-`:147`) with
the gate artifact `gateway_check/07_m2_gate.md`. Routing for G-1..G-6 goes to test-expert-local
(G-1, G-3, G-4, G-5) and data-analyst-local (G-2, G-6); none of them alters an M2 contract, a pinned
count that M2 must honour
(89 operations, 34 GET / 55 POST per `masterplan/03_api_contract.md:106`, kept set 11 per
`masterplan/04_database_contract.md:680`), or the M2 check set at `masterplan/02_plan.md:375`.

---
*Generated: 2026-10-08 09:16 WIB*
*Last Updated: 2026-10-08 09:16 WIB*
