---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-08
agent: data-analyst-local
blueprint_row: 43
blueprint_rev: 2.1
milestone: M0
class: M0 pickup (GAP-05)
type: doc-sync (Tier 3, single-clause spec refresh)
status: complete - EDIT APPLIED
depends_on: R1, RV
verification: C-N4 contains the loopback-ingest clause; constraint count otherwise unchanged
last_updated: 2026-10-08 02:00
---

# Row 43 [M0 | pickup GAP-05] — C-N4 loopback-ingest clause (progress)

## Status

**COMPLETE — the row required an edit** (it did NOT close as "already satisfied"). One clause was
added inside the existing constraint `C-N4` of `masterplan/01_specs.md`, citing **SEC35-23** and
referencing `cap` §A.4 as the normative home without moving the rule. Constraint count is unchanged
(12 -> 12); the diff is one line.

## Why an edit was required (not "already satisfied")

The row's edit-nothing branch applies only if the RV-SPEC round had already folded the rule into
`C-N4`. It had not. Evidence captured **before** any write:

| Check | Command | Result |
|---|---|---|
| SEC35-23 absent from the spec | `grep -c "SEC35" masterplan/01_specs.md` | **2** hits, both `SEC35-14` (lines 223, 224, R-8 STT-key text); **0** hits for `SEC35-23` |
| No ingest-bind wording in the spec | `grep -n -i "rtsp\|8554\|loopback" masterplan/01_specs.md` | C-N4 (line 244) read only `Listener is loopback-only / SR-01; LAN is class C (C-5); preconditions = ...` — no RTSP/ingest/bind mention |
| Audit already ruled this open | `verification/22_audit_docs_decisions.md:199` (AU3-07) | "Row 43 (C-N4 clause, still absent at `01_specs.md:222`) stays." (line number shifted to 244 by the later RV-SPEC refresh; same row) |
| Remediation deliberately skipped SP | `gateway_check/06_security_remediation.md:248-250` | "The review also routes SP `C-N4`; `01_specs.md` is cross-reference-only ... so SP was not edited. Row 37/40 should fold 'RTSP ingest is loopback' into SP `C-N4` (a doc-sync item, not a gate question)." |
| Gate routed it here | `gateway_check/05_m0_spec_gate.md:218` (GAP-05) | "Add one clause to specs C-N4"; "row 31 §A.4 already carries the normative rule" |
| Blueprint carries it open | `identification/02_structured.md:101` (CF-8) | "row 43 stays (C-N4 clause still absent per AU3-07)" |

## Citation source (SEC35-23) as written in the security review

`masterplan/09_security_design_review.md:243`, finding table row, mitigation column, quoted verbatim:

> Pin the RTSP ingest and the fake-fixture listeners to `127.0.0.1` (ports 8554-8564) with a static
> assertion; update C §A.2/§A.8 and SP C-N4

The clause added to C-N4 reuses that wording (ingest + fake-fixture listeners, `127.0.0.1`, ports
8554-8564, static assertion) so the citation and the finding cannot drift. The review's own listener
summary (`:354`) and S7 narrative (`:168-171`) are the supporting statements.

Normative home untouched: `masterplan/05_capture_architecture_spec.md` §A.4 "Bind address
(SEC35-23)" (`:166`) plus its `M3-RTSP-BIND-1` test hook (`:185-189`, the "Test hook" paragraph
starting at `:184`) and §A.8 fixtures (`:307-309`). That file was **not** edited by this row; C-N4
only points at it.

## File edited (exactly one)

| File | Change |
|---|---|
| `masterplan/01_specs.md` | one clause added inside the existing `C-N4` row (line 244) |
| `delegation_progress/data-analyst-local__row43.md` | this progress file |

No other file was written. Controller-owned trackers (`status_tasks.md`,
`delegation_progress_report.md`, `decisions/decisions.md`) were not touched.

## Final C-N4 line (quoted, `masterplan/01_specs.md:244`)

```
| C-N4 | Listener is loopback-only | SR-01; **RTSP ingest binds `127.0.0.1` only** (normative rule stays in `cap` §A.4 — referenced here, not moved; fixture listeners per `cap` §A.8): FFmpeg `-rtsp_flags listen -listen 1` defaults to `0.0.0.0`, so the ingest URL host literal MUST be `127.0.0.1` and the NM-14 fake-fixture readers likewise (ports 8554-8564, never a wildcard); LAN is class C (C-5); preconditions = replace demo password + B3 (W99-2/W99-3) | OD-13 (D4); register §A E-26; SEC35-23 (pin the RTSP ingest and the fake-fixture listeners to `127.0.0.1` with a static assertion) | Host listener snapshot identical before/after (`env` §1); OD-13 default; static assertion `M3-RTSP-BIND-1` (named in `cap` §A.4, carried by `02_plan.md` M3-W4 and the M3 gate; not yet in the `10_test_strategy.md` catalogue) |
```

Wording choices: the clause text is the blueprint's literal "RTSP ingest binds `127.0.0.1` only"
(bolded, matching the emphasis style already used in C-N1/C-N3/C-N5/C-N8); the existing SR-01 /
class-C / preconditions content, the `OD-13 (D4); register §A E-26` authority pair and the
listener-snapshot verification are preserved verbatim, only extended. `cap` is the short form already
used in this document (`01_specs.md:336`, `:342`, `:350`), so no new citation key was introduced.

## Verification evidence

### 1. C-N4 contains the loopback-ingest clause with the SEC35-23 citation

```
$ grep -n "^| C-N4" masterplan/01_specs.md | grep -c "SEC35-23"
1
$ grep -n "^| C-N4" masterplan/01_specs.md | grep -c 'RTSP ingest binds `127.0.0.1` only'
1
```

Full line quoted above (line 244). Both the clause and the citation are on that line.

### 2. Constraint count unchanged

| Measure | Before (HEAD `0024068`) | After | Delta |
|---|---|---|---|
| `grep -c "^\| C-N"` on `01_specs.md` | **12** | **12** | 0 |
| Constraint IDs present | C-N1..C-N12 | C-N1..C-N12 | none added, none removed, none renumbered |
| `wc -l` | 525 | 525 | 0 |
| Table cells in the C-N4 row (pipe count) | 6 | 6 | 0 (still a 5-column row) |

Before-count reproduced from git without a working-tree copy:
`git show HEAD:docs/.../masterplan/01_specs.md | grep -c "^| C-N"` -> **12**.

### 3. Diff limited to the C-N4 line

```
$ git diff --stat -- docs/.../masterplan/01_specs.md
 1 file changed, 1 insertion(+), 1 deletion(-)
$ git diff -- docs/.../masterplan/01_specs.md
@@ -244 +244 @@
-| C-N4 | Listener is loopback-only | SR-01; LAN is class C (C-5); preconditions = replace demo password + B3 (W99-2/W99-3) | OD-13 (D4); register §A E-26 | Host listener snapshot identical before/after (`env` §1); OD-13 default |
+| C-N4 | Listener is loopback-only | SR-01; **RTSP ingest binds `127.0.0.1` only** (normative rule stays in `cap` §A.4 — referenced here, not moved; fixture listeners per `cap` §A.8): ... | OD-13 (D4); register §A E-26; SEC35-23 (pin the RTSP ingest and the fake-fixture listeners to `127.0.0.1` with a static assertion) | ... |
```

One changed line, no line inserted or deleted anywhere else in the file.
Checksums: before `5ea73353430f36676599dae9173c0634028f86fe88e8850a16320fc8fcf3e7b8`,
after `45fbca8be5448c8093067a4a490caa9bf396af3c1804d18022fda95ba49c523a`.

### 4. Cross-reference integrity (nothing was orphaned by the edit)

| Referent cited in the new clause | Exists? | Where |
|---|---|---|
| `cap` §A.4 bind-address rule | yes | `05_capture_architecture_spec.md:166` ("Bind address (SEC35-23)") |
| `cap` §A.8 fixture listeners | yes | `05_capture_architecture_spec.md:307-309` |
| `M3-RTSP-BIND-1` | yes (as a named check) | `05_capture_architecture_spec.md:185-189`; `02_plan.md:177` (M3-W4), `:376` (M3 gate) |
| SEC35-23 | yes | `09_security_design_review.md:243` (finding), `:63`, `:171`, `:354` |
| FFmpeg default `0.0.0.0` claim | yes, matches spec text | `05_capture_architecture_spec.md:166`; SEC35-23 finding column |

The clause states explicitly that `M3-RTSP-BIND-1` is **not yet in the `10_test_strategy.md`
catalogue** (`grep -n "M3-RTSP-BIND-1" masterplan/10_test_strategy.md` = 0 hits; the catalogue has
only `M3-WI-1`, `M3-KC-1`, `M3-AV-2` for RTSP). Stating the gap avoids implying a check exists in the
test strategy; adding it there is test-expert work (row 36/41 scope), not this row's.

### 5. Standing invariants honoured

| Invariant | Status |
|---|---|
| Touch ONLY `masterplan/01_specs.md` | honoured — `git status --porcelain -- masterplan/` lists `01_specs.md` (mine) and `10_test_strategy.md` (concurrent row 41, test-expert-local; not written by this row) |
| No git push / no remote | honoured — no git write command run; repo has no remote |
| No sudo | honoured |
| Docs in English | honoured |
| No emoji | honoured — the changed line contains only two non-ASCII chars, `§` (U+00A7) and `—` (U+2014); the em dash already appears on 49 lines of this file at HEAD (`git show HEAD:...01_specs.md \| grep -c "—"` -> 49) |
| Loopback-only / RTSP bound `127.0.0.1` invariant | reinforced, not weakened — the clause makes the doc match the invariant in `identification/02_structured.md:199` |
| Controller-owned trackers | untouched |

## Note for the controller / downstream rows

- GAP-05 is now closed in the specs layer. `02_plan.md:123` already carried the same rule
  ("RTSP ingest pinned (SEC35-23)" -> `cap §A.4`), so specs, plan and cap are consistent; the M0
  gate's informational gap can be marked resolved.
- `masterplan/03_api_contract.md:328` (op-88 loopback rule) cites `specs` C-N4 and remains correct —
  C-N4 got stronger, not narrower, so no re-edit is needed there.
- Open follow-up outside this row's scope: `M3-RTSP-BIND-1` still has to enter the
  `10_test_strategy.md` catalogue (test-expert; row 36/41 ownership). This row records the gap
  rather than editing another agent's artifact.

## Blockers

None.
