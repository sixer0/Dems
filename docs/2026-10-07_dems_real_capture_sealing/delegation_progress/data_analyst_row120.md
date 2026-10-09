---
task_id: 2026-10-07_dems_real_capture_sealing
agent: data-analyst
blueprint_row: 120
date: 2026-10-09
status: complete (spec gate row 128 checks it; 10 ambiguities for the controller in section 6)
tier: 3 (working record of a Tier 1 edit)
file_edited: masterplan/01_specs.md (529 -> 676 lines)
last_updated: 2026-10-09 14:25
---

# Row 120 — requirements delta R-9, R-10, R-11 in `masterplan/01_specs.md`

## 1. What was done

One file edited: `masterplan/01_specs.md`. No other spec, no blueprint, no tracker, no decision
file and no code was written by this row. Baseline: the file had no uncommitted change before the
edit (`git diff --stat HEAD -- masterplan/01_specs.md` printed nothing at 14:08), so
`git diff HEAD -- docs/2026-10-07_dems_real_capture_sealing/masterplan/01_specs.md` shows exactly
this row's change: `1 file changed, 155 insertions(+), 8 deletions(-)`.

Sources read: `identification/02_structured.md` rev 2.3 (row 120, rows 121-142, §0.3 "NEW SCOPE
(D73)", G-4, §5, §9, DP-11..DP-13), `decisions/decisions.md` D72-D78, `masterplan/05` §A.1, §A.6,
§A.7, §A.8, H-7, `masterplan/03` §2.2-§2.5, §4, §5, `masterplan/08` §0, §2, §3.5, §8, §8a,
`masterplan/09` S1/S7 and SEC35-23, `masterplan/11` §5 (marker convention), and for facts about
the code: `packages/shared/src/sim/faults.ts:31-66`, `packages/shared/src/api/devices.ts:519`,
`packages/shared/src/sim/api.ts:111`, `.gitignore:70`.

## 2. What was added (line numbers after the edit, from `grep -n`)

| Mark | Lines | Content |
|---|---|---|
| PE-120-00 | 243-378 | New section **B.2** "Requirements delta rev 2.3 — R-9, R-10, R-11" |
| — | 245-264 | Status block with the user's words of D73, D74, D75, D76, D78 verbatim |
| — | 266-279 | B.2.0 5W1H frame of the delta: subject, stakeholders, scope in / out, timeline, rationale with evidence chain, methodology, 8 alternatives considered, 4 assumptions (2 labelled hypotheses), gaps |
| — | 281-302 | **R-9** — narrative, decisions, register rows, **16** acceptance criteria |
| — | 304-316 | **R-10** — narrative, decisions, conventions followed, **6** acceptance criteria |
| — | 318-333 | **R-11** — narrative, decisions, **10** acceptance criteria |
| — | 335-343 | B.2.5 traceability table (requirement -> decisions, constraints, class-C effect, rows) |
| — | 345-361 | B.2.6 open points for rows 121-128 (13) |
| — | 363-376 | B.2.7 ambiguities for the controller (10) |
| PE-120-05 | 396 | Constraint **C-N13** — discovery socket, the SEC35-23 exception with 7 bounds |
| PE-120-06 | 397 | Constraint **C-N14** — development fence |
| PE-120-07 | 398 | Constraint **C-N15** — credential-gated connectivity; agents on the real network |
| PE-120-09 | 586-587, 598 | Class-C table: C-1 and C-2 reworded, paragraph "Moved class-C boundary" |
| PE-120-10 | 669 | Self-gate row for R-9..R-11 |

Cross-references only (no requirement text changed):

| Mark | Line | Where |
|---|---|---|
| — | 17, 676 | front matter `last_updated`, footer |
| PE-120-01 | 142 | R-1 narrative, one sentence appended |
| PE-120-02 | 152 | R-2 narrative, one sentence appended |
| PE-120-03 | 117, 580 | A.2 and G.1 completion line: pointer to `structured` §5 (wording not restated) |
| PE-120-04 | 387 | C-N4: pointer to C-N13 |
| PE-120-08 | 562 | F, row M4: pointer to B.2 and G.2 |

Check on the criteria (script output, 14:22): `R-9 16`, `R-10 6`, `R-11 10`; "ACs lacking a
decision id" = 0 lines (every criterion cites at least one of D72-D78).

## 3. Proof that R-1..R-8 changed by cross-references only

R-1..R-8 occupied lines 138-237 before the edit (140-239 after). All hunk headers of
`git diff -U0 HEAD -- masterplan/01_specs.md`:

```
@@ -17 +17 @@
@@ -116,0 +117,2 @@
@@ -140 +142 @@
@@ -150 +152 @@
@@ -240,0 +243,137 @@
@@ -248 +387 @@
@@ -256,0 +396,3 @@
@@ -420 +562 @@
@@ -437,0 +580,2 @@
@@ -442,2 +586,2 @@
@@ -453,0 +598,2 @@
@@ -522,0 +669 @@
@@ -529 +676 @@
```

Only two hunks fall inside old lines 138-237: `-140` (R-1 narrative) and `-150` (R-2 narrative).
`git diff -U0 --word-diff=plain HEAD -- masterplan/01_specs.md` for those two hunks shows additions
only, no removed word:

```
{+**Cross-reference (PE-120-01; D76):** see R-9 (section B.2) for how a camera found on the network becomes assignable here, and R-11 for development sources.+}
{+**Cross-reference (PE-120-02; D72(k), D73):** see R-10 AC-3 (section B.2) for the session start with no camera connected, and R-11 AC-4 for development sources in front of the unchanged worker.+}
```

R-3, R-4, R-5, R-6, R-7 and R-8: no hunk. The section heading "B. Functional requirements
R-1..R-7" was left as it is.

## 4. Design proposals made by this row (each marked as a proposal in the spec)

| # | Proposal | Where | Confirmed by |
|--:|---|---|---|
| 1 | Searching is allowed while a session is open (read-only, registers nothing, it is the remedy of R-10); every connect step is refused `409 CAPTURE_CONFIG_LOCKED` with no audit row, like ops 78-80 and 89 | R-9 AC-13 | rows 121, 126 |
| 2 | All of search, candidate list and connect need `CAPTURE_CONFIG`; no new permission | R-9 AC-12 | row 121 |
| 3 | Credential entry required on web; proposed also on tablet and phone | R-9 AC-12 | row 125 (126) |
| 4 | A fifth connection-test outcome *unreachable* beside the four of blueprint row 121 | R-9 AC-6 | row 121 |
| 5 | A service address announced by a responder is used only if its host is the address the answer came from (otherwise a rogue responder steers the connection test to a third host) | R-9 AC-10 | row 126 |
| 6 | The failed-test rate limit must stay below a camera's own account lock-out | R-9 AC-11 | rows 121, 126 |
| 7 | Proposed names: `CAPTURE_DISCOVERY_SEARCHED`, `CAPTURE_CANDIDATE_ADOPTED`, `CAPTURE_CONNECTION_TESTED` (audit); `CAPTURE_DISCOVERY_EMPTY`, `CAPTURE_DEVICE_UNREACHABLE` (alerts, WARNING); `CAPTURE_FAULT` with reason `NO_CAMERA_CONNECTED` (CRITICAL) | R-9 AC-9, R-10 AC-1..AC-3 | row 121 |
| 8 | Pre-check start rule mirroring D72(k): both cameras or both mics unreachable blocks; one camera or the standby mic unreachable warns and allows a degraded session | R-10 AC-2 | controller / row 121 |
| 9 | "Search again" for a microphone re-reads the local inputs (`AudioInputAdapter.enumerate()`); no network microphone discovery | R-10 AC-2 | controller |
| 10 | No frame or audio excerpt of a local-device recording goes into `docs/`, not even a small still (tightening of C-N3 for the developer's own face and voice) | R-11 AC-8 | row 126 |
| 11 | A local device that cannot be opened is never silently replaced by a fake source | R-11 AC-5 | row 123 |
| 12 | The discovery socket is not owned by the capture worker (`cap` §A.2 W-1) | C-N13 bound 4 | row 123 |
| 13 | Development-mode results close no class-C item | R-11 AC-10, G.2 C-2 | row 128 |

## 5. Open points for later spec rows (B.2.6 of the spec)

| # | Open point | Row |
|--:|---|---|
| 1 | Operations, shapes, error codes, outcome names | 121 |
| 2 | Operation 89 before the credential sealer of row 84 (M7) while the connect flow is M4; options (a) `503 CREDENTIAL_STORE_NOT_READY`, (b) pull the sealer forward, (c) fixture credentials only — not decided; no second store | 121 (controller for (b)) |
| 3 | Operation 89 addresses a capture device ID; a candidate is not registered — how the path addresses it and how "nothing registered" stays true | 121, 122 |
| 4 | Alert / audit names, severities, detail keys; new fault kind versus reason; how many audit rows an empty search writes | 121 |
| 5 | Schema impact; candidate matching key; fault-kind CHECKs; migration `0008` or "no schema change" | 122 |
| 6 | Adapter and helper design; what is read beyond the ProbeMatch; search window; socket owner; ports 8554-8564; helper error names; development flag; ONVIF package; split of H-7 | 123 |
| 7 | Manifest field of the development mark; verify rule; whether fake-fixture packages carry it | 124 |
| 8 | UX of search, list, prompt, result, notifications, empty state, label | 125 |
| 9 | Which clients may enter a camera credential; what an operator without `CAPTURE_CONFIG` sees after a pre-check search | 125 (126) |
| 10 | Security review of C-N13, the connection test, credential reuse, rate limits, search during a session, the fence, recording privacy | 126 |
| 11 | Named checks for 32 acceptance criteria; totals | 127 |
| 12 | ONVIF dependency licence entry (C.1 not edited) | 123, 96 |
| 13 | Cross-row agreement | 128 |

## 6. Ambiguities in the user's answers (B.2.7 of the spec) — for the controller

1. D75 (controller's reading) allows "unauthenticated device information"; D76 (user) says found
   devices are listed and not connected. A read beyond the ProbeMatch is a TCP connection to the
   camera. The spec relies on probe data only.
2. The pre-check is started by an operator who may lack `CAPTURE_CONFIG`; the search inside it runs
   for that operator.
3. No user statement on which clients may take a camera credential.
4. Searching while a session is open was not asked.
5. D73 says "kamera / mic di network"; microphones are local inputs here (OD-06).
6. D72(k) rules the session start, not the pre-check.
7. "Production configuration" has no written definition.
8. Operation 89 before row 84, and a candidate that is not a device.
9. Whether the development mark covers every fake-fixture package (row 124 says "or fake").
10. A camera that does not answer multicast cannot be found; typed address entry is not offered.

## 7. Facts found on the way

- `grep -rn "setCaptureDeviceCredential" apps/core-server/src` (tests excluded) returns 0 hits on
  2026-10-09: operation 89 exists in the shared contract and the simulator
  (`packages/shared/src/api/devices.ts:519`, `packages/shared/src/sim/api.ts:111,1250`) but has no
  Core-server module yet.
- `08_client_ux_spec.md` has no flow for operation 89 on any client: `grep -n -i "credential" masterplan/08_client_ux_spec.md`
  returns lines 223, 593, 599 and 616 only — the R-8 credential field of §8a (web-only) and two
  blanking rules.
- Two statements in B.2.0 are labelled hypotheses (what a ProbeMatch carries; that
  `GetDeviceInformation` usually needs an account): they come from the analyst's recall of the
  ONVIF / WS-Discovery specifications, not from a file in this repository. Row 123 verifies them.

## 8. Not done, by instruction

- `masterplan/11_audit_errata.md` was not edited: the marks PE-120-00..PE-120-10 follow its §5
  convention but are not listed in its table. Its owner may add a pointer.
- `identification/02_structured.md`, `decisions/decisions.md`, `10_test_strategy.md`, specs 03-09,
  the trackers and all code were not touched. (`git status` shows `decisions/decisions.md` and
  `identification/02_structured.md` as modified; those are earlier uncommitted changes of their
  owners, not of this row.)
- No implementation plan was written: `masterplan/02_plan.md` is not in this row's output.
