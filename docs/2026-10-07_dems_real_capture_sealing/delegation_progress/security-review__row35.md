---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
blueprint_row: 35
agent: security-review
milestone: M0
class: B
tier: 1
status: done
verdict: PASS-WITH-FINDINGS
findings: {Critical: 0, High: 4, Medium: 15, Low: 4}
surfaces: 10
last_updated: 2026-10-07 17:40
---

# security-review — row 35 (M0)

## Deliverable

`masterplan/09_security_design_review.md` — security design review of the five M0 specs (rows 29-33).

## Result

**PASS-WITH-FINDINGS. 0 Critical open.** 23 findings (4 High, 15 Medium, 4 Low). No surface FAILs.

## Surface verdicts (10/10)

| # | Surface | Verdict |
|--:|---|---|
| S1 | Camera/device credential store | PASS-with-findings (SEC35-01..04) |
| S2 | Signer keys | PASS-with-findings (SEC35-06..07) |
| S3 | Per-fragment GCM encryption keys | PASS-with-findings (SEC35-08..11) |
| S4 | Media streaming auth | PASS-with-findings (SEC35-12..13) |
| S5 | Credential-shaped values across logs/errors/audit | PASS-with-findings (SEC35-14) |
| S6 | Static rules permitting `child_process`/`fs` | PASS-with-findings (SEC35-25) |
| S7 | OD-13 preconditions and network exposure | PASS-with-findings (SEC35-23) |
| S8 | RBAC and audit completeness (13 new ops) | PASS-with-findings (SEC35-16..19) |
| S9 | Transcript revision integrity (OD-15) | PASS-with-findings (SEC35-20..21) |
| S10 | Cross-spec contract consistency | PASS-with-findings (SEC35-01, SEC35-22) |

## Highest-impact findings

- **SEC35-01 (High)** — no API operation and no audit type exist for writing
  `capture_device_credentials`; D §B.3 says "operation 80" but A §2.2 makes op 80 `setPrimaryMic`, and
  `CAPTURE_CREDENTIAL_SET` is absent from A §5.2.
- **SEC35-02 (High)** — `dems_capture_credential_reveal` is `GRANT EXECUTE` to the whole runtime role
  with no application-layer permission or single calling module.
- **SEC35-16 (High)** — pre-existing blanket `EVIDENCE_VIEW` (all three roles) now reaches REAL
  evidence; op 88 streams decrypted footage to any authenticated operator with no case scope.
- **SEC35-23 (High)** — the new RTSP ingest bind address is unpinned; FFmpeg `-listen` defaults to
  `0.0.0.0`, a LAN content-injection gap.

## Self-gate

- 10 surface verdicts (>= 7): yes.
- Every finding severity + mitigation + owning section: 23/23.
- 0 Critical open: yes.
- Both log blanking lists named: yes (A §2.4; P §G.4 = `apps/core-web/src/runtime/error-sink.ts:52`
  and `apps/mobile/src/runtime/log.ts:46`); prefix/insertion missing (SEC35-13).
- RBAC walk for all five requested roles: yes (§4; OPERATOR = principal class, ADMIN = no such role).

## Constraints honoured

- No specification edited by this row; findings route to rows 29-33 or rows 28/34/37/40.
- Writes limited to this file and `masterplan/09_security_design_review.md`.
- No credential value printed (oMLX API key and `.data/pg.*` never reproduced); no external service.

## Blocker

None.
