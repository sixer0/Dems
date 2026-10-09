---
task_slug: dems_real_capture_sealing
date: 2026-10-09
agent: test-expert
scope: row 106 routed pickups G-1, G-3, G-4, G-5 (documentation-only; no code, no test run)
status: complete
---

# Test-expert pickups G-1 / G-3 / G-4 / G-5 — record (Tier 3)

Only file edited: `masterplan/10_test_strategy.md` (597 -> 609 lines).
Source of the edits: `gateway_check/25_rv_spec_reconciliation.md` §3 (ruling) and §4 (rows G-1, G-3, G-4, G-5, lines 145-149).
"Old line" = line number before this edit; "new line" = line number after it.

## 1. Was each pickup still missing? (checked before editing)

| Pickup | Check | Result |
|---|---|---|
| G-3 | `grep -n M3-RTSP-BIND masterplan/10_test_strategy.md` | 0 hits — missing |
| G-4 | `grep -n M8-EV-SCOPE masterplan/10_test_strategy.md` | 0 hits — missing |
| G-5 | old line 217 "CONDITIONAL, pending Q-STT-CFG (D20)"; old lines 219-221 "Not scheduled and not counted as active"; old line 556 "207 active (+18 conditional ...)" | missing |
| G-1 | old line 228 still ended "; v2 verify PASS on server"; `grep -rn M7-STTCFG .` 0 hits outside the gate report | missing |

No pickup had been partly applied.

## 2. Changes

### G-3 — `M3-RTSP-BIND-1` (§A.3)

- Inserted after old line 164 (`M3-SR-2`); new line 165.
- Before: no row.
- After: `| M3-RTSP-BIND-1 | RTSP ingest binds 127.0.0.1 only | start the ingest and assert with lsof -nP -iTCP:<port> / netstat -an that every listener on 8554-8564 is bound to 127.0.0.1 and never 0.0.0.0/*, incl. the NM-14 fixture readers; the static rule G-R4 forbids a wildcard literal in the worker command (added by RV-SPEC G-3) | capture-worker listener snapshot + static guard | 1 | rev-2 M3 W-row M3-W4 | cap §A.4/§A.8; SEC35-23 (sec S7); specs C-N4 |`
- Sources: `masterplan/01_specs.md:244` (C-N4 "RTSP ingest binds `127.0.0.1` only"); `masterplan/09_security_design_review.md:63` and `:243` (SEC35-23, High); `masterplan/02_plan.md:177`, `:376` (plan carries the check); gate report line 147.
- Count effect: M3 20 -> 21; once-per-checkpoint +1.

### G-4 — `M8-EV-SCOPE-1` (§A.8)

- Inserted before `M8-RNG-1` (old line 272); new line 278.
- Before: no row.
- After: `| M8-EV-SCOPE-1 | REAL-evidence case scope on op 88 | op 88 REAL-evidence case scope: an INVESTIGATOR/TECHNICIAN sees only cases they hold; out-of-scope reads refused 403 NOT_PERMITTED and the attempt audited (Q-SEC-1 (a) confirmed, D24; added by RV-SPEC G-4) | agent-browser on lane web + emulator lane | 2+1 | rev-2.1 M8 (row 90, M8-W1) | C3 op 88; SEC35-16 (sec S8); plan F-1 |`
- Sources: `masterplan/09_security_design_review.md:236` (SEC35-16, High); `masterplan/02_plan.md:381`, `:427` (F-1), `:576`; `identification/02_structured.md:253` (row 90), `:257` (row 94 gate list); `decisions/decisions.md:36` (D24, Q-SEC-1 (a)); gate report line 148.
- Count effect: M8 17 -> 18; 2+1 tally +1.

### G-5 — R-8 checks of §A.6a activated

| Old line | New line | Before | After |
|---|---|---|---|
| 217 | 218 | `### A.6a R-8 STT configuration checks — CONDITIONAL, pending Q-STT-CFG (D20)` | `### A.6a R-8 STT configuration checks — ACTIVE (Q-STT-CFG confirmed, D24; opened by D20)` |
| 219-221 | 220-226 | "**Not scheduled and not counted as active** until the user confirms Q-STT-CFG ... If confirmed, the eight checks below become active (M2 1, M6 7); if rejected, they are removed with no other change. Device/browser checks follow the 2+1 rule." | "**Scheduled and counted as active.** The user confirmed Q-STT-CFG (a) — all 13 proposed R-8 defaults — at the second blueprint gate (D24, 2026-10-08; `specs` R-8) ... `M2-STTCFG-DB` counts in the M2 gate set (M2 28 + 1 = 29 ...) and the seven `M6-STTCFG-*` count in the M6 gate set (M6 14 + 7 = 21). The rows stay in this section ... verify clause ... proven at M7 by `M7-STTCFG-VERIFY` (§A.7; CF-12)." |
| 225 | 230 | "(proposed: enabled, `omlx-server` on this Mac)"; owning row "rev-2.1 M2 (if confirmed)" | "(confirmed D24: enabled, `omlx-server` on this Mac)"; owning row "rev-2.1 M2 (row 112)" |

- Rows were not moved between sections (gate report line 149).
- Sources: `decisions/decisions.md:36` (D24: "Q-STT-CFG (a) all 13 proposed R-8 defaults confirmed"); `identification/02_structured.md:294` (milestone map "M2 catalogue + M2-STTCFG-DB"); gate report line 149.
- Count effect: M2 28 -> 29 (once +1); M6 14 -> 21 (once +2: API, NEXT; 2+1 +5: OFF, UNREACH, WEB, TAB, PHONE); conditional 18 -> 10.

### G-1 — CF-12 split of `M6-STTCFG-OFF`

| Old line | New line | Before | After |
|---|---|---|---|
| 228 | 233 | "...seals with `transcript.state = 'DISABLED'` + reason `DISABLED_BY_CONFIGURATION`; v2 verify PASS on server \|" | "...seals with `transcript.state = 'DISABLED'` + reason `DISABLED_BY_CONFIGURATION` (manifest state only; the verify clause is proven at M7 by `M7-STTCFG-VERIFY` beside `M7-VV-SRV`, CF-12) \|" |
| (insert after 255, `M7-VV-SRV`) | 261 | no row | `| M7-STTCFG-VERIFY | v2 verify of transcript states (CF-12 split of M6-STTCFG-OFF/-UNREACH) | a DISABLED package and an unreachable-PARTIAL package verify PASS with the state reported, and tampering transcript.state FAILs (added by RV-SPEC G-1) | core-server db/unit integration (fakes) | 2+1 | rev-2.1 M7 (row 119) | ev §B.7a/§D; C3 op 41 V-checks; specs R-8 AC-5/AC-6; structured CF-12 |` |

- Sources: `identification/02_structured.md:105` (CF-12), `:252` (row 89 M7 gate), `:279` (row 116), `:282` (row 119 verification text, from which the new row's asserts are taken); gate report line 145.
- Count effect: M6 unchanged by G-1; M7 51 -> 52; 2+1 tally +1. The check name `M7-STTCFG-VERIFY` is the gate report's example name ("e.g."); it had no prior use anywhere in the task folder.

## 3. Count re-pin — every occurrence changed

Old totals grepped: `207`, `215`, `225`, `18 conditional`, `84`, `123`, `M3 **20**`, `M6 14`, `M7 51`, `M8 17`, `M2 28`.

| Old line | New line | Section | Before | After |
|---|---|---|---|---|
| 556 | 563 | K, row 1 | M2 28, M3 **20**, M6 14, M7 51 scheduled + 10 conditional, M8 17; "207 active (+18 conditional: 10 OD-21 ... + 8 R-8/Q-STT-CFG ...; 225 named) — 84 run 2+1, 123 run once" | M2 **29**, M3 **21**, M6 **21**, M7 **52** scheduled + 10 conditional, M8 **18**; "218 active (7 + 21 + 29 + 21 + 14 + 13 + 21 + 52 + 18 + 16 + 6) + 10 conditional (the OD-21 fallback-cell checks; 228 named) — 91 run 2+1, 127 run once (91 + 127 = 218)"; second erratum sentence appended keeping the old figures as history |
| 578-581 | 585-592 | L.5 | "84 checks (42 bare ...)"; "once cells sum to 123 (... M2 25, M3 13, ... M6 11 ...)"; "total active 207 + 18 conditional (10 OD-21 fallback + 8 R-8 pending Q-STT-CFG)" | "91 checks (49 bare ...)"; "once cells sum to 127 (... M2 26, M3 14, ... M6 13 ...)"; "total active 91 + 127 = 218, + 10 conditional (OD-21 fallback only ...) = 228 named" |
| 597 | 608-609 | footer | one "Last Updated" line (2026-10-08) | old line kept; second "Last Updated: 2026-10-09" line added naming the four pickups and "218 active + 10 conditional" |

`215` never occurred in the file. Remaining occurrences of the old figures after the edit: only inside the two erratum sentences of new line 563 (deliberate history, "was ...").
Unchanged and still correct: F.2 new lines 497-498 "35 distinct kill checks ... 10 conditional (fallback)"; M new line 600 "the 10 conditional KM cells"; L.4 `grep -c maxWorkers` still 26.

## 4. Arithmetic (sum shown)

- Active: 207 + 1 (G-3) + 1 (G-4) + 8 (G-5) + 1 (G-1) = **218**.
- Conditional: 18 − 8 = **10** (OD-21 fallback cells only).
- Named: 218 + 10 = **228** (was 225; +3 new check IDs).
- By milestone: M0 7 + M1 21 + M2 29 + M3 21 + M4 14 + M5 13 + M6 21 + M7 52 + M8 18 + M9 16 + X 6 = 218.
- By run class: 2+1 = 84 + 5 + 1 + 1 = **91**; once = 123 + 1 + 3 = **127**; 91 + 127 = 218.
- Mechanical recount (script over the check tables of sections A and J, expanding grouped rows) printed:
  `{'M0': 7, 'M1': 21, 'M2': 29, 'M3': 21, 'M4': 14, 'M5': 13, 'M6': 21, 'M7': 52, 'M8': 18, 'M9': 16, 'X': 6} 218 {'once': 127, '2+1': 91} cond 10`

The controller's expected figure of 215 covered G-5 alone (207 + 8). 218 = 215 + G-3 + G-4 + the M7 row that the gate report's G-1 edit adds.

## 5. Not done (outside the one-file scope) — for the controller

- `masterplan/02_plan.md:381`, `:575`, `:576` still say "proposed" for `M8-EV-SCOPE-1` / `M3-RTSP-BIND-1` (gate report marks this tidy optional). The plan's per-milestone figures at `:575-576` (M3 13, M8 11) use a different counting basis and were not reconciled here.
- `masterplan/02_plan.md` and `identification/02_structured.md` do not yet name `M7-STTCFG-VERIFY`; row 89 / row 119 describe the same clause in words ("the verify clause of M6-STTCFG-OFF/UNREACH via row 119").
- `identification/02_structured.md:294` still reads "M2-STTCFG-DB (if R-8 confirmed)".
- G-2 (`masterplan/01_specs.md:231`) and G-6 (`05_capture_architecture_spec.md:389`) belong to data-analyst; G-2's wording refers to "`M7-VV-SRV` / the CF-12 split check" — the split check is now named `M7-STTCFG-VERIFY`.
- The M2 gate was signed off before `M2-STTCFG-DB` became an active catalogue check; whether `gateway_check/07_m2_gate.md` already shows it is not checked here.

---
*Generated: 2026-10-09*
