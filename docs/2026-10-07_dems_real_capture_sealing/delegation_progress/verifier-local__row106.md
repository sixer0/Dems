# verifier-local - row 106 (M0 pickup rev 2.1 / spec-reconciliation after RV-SPEC, tier 2)

Status: COMPLETE - verdict **M2 OPEN - 0 blocking gaps**. Date: 2026-10-08. Session: verifier-local subagent (row 106 delegation, phase C, blueprint rev 2.1; dependencies 41 and 43 verified satisfied before start).

Deliverable: `docs/2026-10-07_dems_real_capture_sealing/gateway_check/25_rv_spec_reconciliation.md` (Tier 2) plus this note. No masterplan, spec, plan, code or tracker file was modified.

## Result summary

| Measure | Count |
|---|---:|
| Checklist items PASS with file:line evidence | 9 / 11 |
| Checklist items carrying a routed gap (item 8 CF-12 sub-clause, item 11) | 2 / 11 |
| Routed edits (G-1 .. G-6) | 6 |
| Blocking M2 opening | 0 |
| Owned by test-expert-local | 4 (G-1, G-3, G-4, G-5) |
| Owned by data-analyst-local | 2 (G-2, G-6) |

Items 1-7, 8a, 9 and 10 verified as consistent across `masterplan/*`: CPU-STT consistency (AU3-03),
`-1.333 ms` confined to correction text (AU2-03), `M3-AV-1` 2 ms regression bound separated from the
+/-40 ms product bound with the -80 ms case (AU2-04), `M5-GAP-1` negative vector plus sample-count /
continuity inside `M5-SW-W` (AU2-05), per-input-chunk switch bound plus the filtering-thread-only rule
(AU2-07), H-10 / `M3-AV-2` separate-process two-clock fake camera (AU2-06), RPO = one camera GOP plus
`M3-KC-2` / `M3-KC-4` box-walk tail validation (AU2-08), and all seven R-8 sibling sections plus the
security addendum. Errata volume re-counted mechanically: 84 rows in section 1, 14 in section 2, as D22
claims. Row 41 confirmed landed (0 old gate tokens, `07..14` present on 9 lines). Row 43 confirmed
landed (`masterplan/01_specs.md:244`, constraint count still 12).

## Item 11 adjudication (the routed finding from row 43)

`M3-RTSP-BIND-1` - **genuine catalogue gap in substance, NOT an M2 blocker**. The control is normative
and complete in `masterplan/05_capture_architecture_spec.md:166` (bind MUST be `127.0.0.1`), restated at
`:307-309` for the fixture readers and enforced by the static rule family (`:126`, `:189` G-R4/SEC35-25);
the check is named at `:185-189` and carried by `masterplan/02_plan.md:123`, `:177`, `:376`, so it will be
run and gated at M3. But it has **0 hits** in `masterplan/10_test_strategy.md`, which is the counting
authority pinned at "M3 **20** ... 207 active" (`:556`) and reconciled by `M9-CH-1..4` (`:292`) - so a
plan-only check becomes unaccounted at the final chain. Its first execution point is row 60 and its proof
point row 64; no M2 row creates an RTSP listener and the exposure is already blocked normatively, so M2
opens with the edit deadline set at "before row 60". Ruling recorded in section 3 of the gate report.

## Routed gaps (owners, exact edits in the gate report section 4)

- G-1 test-expert-local - `masterplan/10_test_strategy.md:228` still asserts "v2 verify PASS on server"
  inside `M6-STTCFG-OFF` while verify v2 lands at M7 (row 85); CF-12 requires the split, and no M7-side
  check carries that clause. Before row 116 / the M6 gate.
- G-2 data-analyst-local - the same attribution appears in `masterplan/01_specs.md:231` (R-8 AC-5);
  re-point the verify clause to the M7 verify check. With G-1.
- G-3 test-expert-local - add `M3-RTSP-BIND-1` to the M3 catalogue (§A.3, beside `M3-SR-2` at `:164`)
  and re-pin K (`:556`) / L.5 (`:578-581`). Before row 60.
- G-4 test-expert-local - `M8-EV-SCOPE-1` found by the ID sweep: 0 catalogue hits, yet
  `masterplan/02_plan.md:381`/`:427`/`:576` carry it and D24 confirmed Q-SEC-1 (a). Same class as G-3.
  Before row 90.
- G-5 test-expert-local - §A.6a still says "Not scheduled and not counted as active until the user
  confirms Q-STT-CFG" (`masterplan/10_test_strategy.md:219`) although D24 answered Q-STT-CFG (a); activate
  the 8 checks (`M2-STTCFG-DB` becomes an active M2 check) and re-pin active 207 -> 215, conditional
  18 -> 10. Before row 112.
- G-6 data-analyst-local - `masterplan/05_capture_architecture_spec.md:389` points at
  "`10_test_strategy.md` §A.4" for `M3-KC-4`; the M3 table is §A.3. With G-3.

Six non-gaps recorded as observations (errata-ledger pointer drift at `11_audit_errata.md:43`; the
already-owned OUT-2/OUT-3 controller items; the two deliberately historical numbering lines; the eight
legitimate `21.333 ms` uses; the uniform post-D24 "PROPOSED" wording; the scheduled re-check pass).

## Evidence method (all read-only)

`rg -n` sweeps per spec token across `masterplan/` with every hit opened in a line window to classify it
as live versus correction text; a token-diff script over blueprint rows 44-119 against the test-strategy
catalogue (143 distinct check tokens; only `M3-RTSP-BIND-1` and `M8-EV-SCOPE-1` unresolved, the rest
covered directly or by their `Mx-RG-*` / `M9-CH-1..4` / `*-W<n>` family rows); mechanical re-count of the
errata ledger. Scratch script: `/var/folders/rn/.../T/kilo/row106/ids.py`.

## Invariants honoured

0 writes under `masterplan/`, `apps/`, `packages/`; no git write; no emoji; English output. Nothing
touched oMLX, Homebrew, devices, emulators, servers or the SMART WMS ports `[::1]:5173`,
`127.0.0.1:5174`, `[::1]:5175`. No secret read or printed.

Files written: `gateway_check/25_rv_spec_reconciliation.md`, `delegation_progress/verifier-local__row106.md`.
Blockers: none. Rows 44, 45 and their M2 wave-mates may launch; rows 107/108 (parallel CPU-STT track) are
unaffected by anything routed here.
