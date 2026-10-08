---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
blueprint_row: 35-remediation
agent: data-analyst-local
milestone: M0
class: B
tier: 1
status: done
verdict: APPLIED (21) / DEFERRED (2) / REJECTED (0)
source_review: docs/2026-10-07_dems_real_capture_sealing/masterplan/09_security_design_review.md (row 35)
report: docs/2026-10-07_dems_real_capture_sealing/gateway_check/06_security_remediation.md
files_edited:
  - masterplan/03_api_contract.md
  - masterplan/04_database_contract.md
  - masterplan/05_capture_architecture_spec.md
  - masterplan/06_evidence_package_spec.md
  - masterplan/07_transcript_spec.md
  - masterplan/08_client_ux_spec.md (one-line pointers only)
last_updated: 2026-10-07 17:45
---

# data-analyst-local — row 35 remediation (security findings -> owning specs)

## Deliverable

`gateway_check/06_security_remediation.md` — findings disposition table (23), per-APPLIED edits
with verification hooks, operation renumbering record, before/after self-gate counts, gate
confirmations and deferred items.

## Result

Applied the review's mitigations as normative text in the owning spec sections. No gate answer
(D4) weakened. All 4 Highs APPLIED.

| Category | Count |
|---|---|
| APPLIED | 21 |
| DEFERRED | 2 (SEC35-18 -> M2; SEC35-26 -> row 40) |
| REJECTED | 0 |

## Highs

| Finding | Spec | Section |
|---|---|---|
| SEC35-01 | 03_api_contract.md | §1/§2.2/§5.2 (op 89; total 89) |
| SEC35-02 | 04_database_contract.md | §B.3/§D |
| SEC35-16 | 03_api_contract.md | §2.1/§2.4 (provisional; gate flag) |
| SEC35-23 | 05_capture_architecture_spec.md | §A.4/§A.8 |

## Counts after edits

- 03: 89 operations (was 88); 34 GET / 55 POST; offline 23; 40 error codes; 62 audit types.
- 04: forbidden keys 17 -> 25; `transcript_revisions.signature_certificate_sha256` added.
- Counts unchanged: 04 tables 30->39, 05 NM 9/9 + P25 12/12, 06 fields 120 / steps 8 / checks 14,
  07 stages 6/6 + licence 15, 08 P-01..P-16 16/16.

## Gate confirmations requested (second blueprint gate)

- SEC35-16 (REAL-evidence case scope; touches OD-10/OD-15).
- SEC35-09 (no key escrow default; custody policy).
- SEC35-02 (mechanism chosen under the 3-role convention; D-DB-07).
- SEC35-26 (privacy/DPIA; deferred to row 40).

## Red lines honoured

No emoji; English; edited only the allowed spec files + this progress + the report; no
decisions/, status_tasks.md, identification/, research/, test files or source touched; the oMLX API
key and `.data/pg*` referenced by path only.
