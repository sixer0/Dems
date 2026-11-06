---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-09
agent: data-analyst
blueprint_row: 121
type: requirements (API contract delta, record of the row)
tier: 1
status: needs-review
confidence: HIGH for the operation set, access rules, key lists, totals arithmetic and the "no CHECK change" finding (checked against the code named below); MEDIUM for the request/response shape summaries, the proposed constants and the `FAULT_RAISED` key change; the lock-out figure is a hypothesis
source_structured_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/identification/02_structured.md (row 121, line 373)
source_spec: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/masterplan/01_specs.md (§B.2)
decisions: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/decisions/decisions.md (D72-D78, D80)
last_updated: 2026-10-09
---

# Row 121 — API contract delta for R-9, R-10, R-11 (record)

## 1. What was done

`masterplan/03_api_contract.md` now carries the contract for camera search, the candidate list, the
connection test, adoption, the local-input re-read and the three no-device notifications. Sixteen
marks `PE-121-01..16`; listed in `masterplan/11_audit_errata.md` §5.8. No other file was edited.
Nothing of this is built: the registry holds 92 operations until rows 132 / 142 land.

Status is **needs-review**, not complete, for one reason: item 1 of section 6 (the credential in
the body of the adoption) departs from the literal wording of blueprint row 121 and needs the
controller's confirmation.

## 2. 5W1H (short)

| Axis | Content |
|---|---|
| Subject | The API side of R-9 (discovery, credential-gated connect flow), R-10 (no-device notifications), R-11 (development sources in the device shapes) |
| Stakeholders | The user (D73-D78); the controller (rulings D80); rows 122-128 (sibling specs and the spec gate); rows 132, 133, 136, 139, 142 (builders) |
| Timeline | Spec row of 2026-10-09; built in M4 (132, 133, 136, 142) and M5 (139); the credential leg waits for row 84 (M7) |
| Scope — in | Operations 93-97; changes to 76-79, 89 and the pre-check; reason values; four audit types; alert rules; constants; simulator answers; totals |
| Scope — out | Schema (row 122), adapter and helper design (123), manifest mark (124), screens (125), security findings (126), named checks (127); typed-address entry, network microphone discovery, removing an adopted device |
| Rationale | D73 -> D76 (list first, connect only with an operator-entered credential) -> `01_specs.md` §B.2 -> D80 rulings on the ambiguities -> this contract |
| Methodology | Read the contract whole, §B.2, D72-D80; checked each claim about the code against the working tree (HEAD `101ce62`): `packages/shared/src/api/devices.ts:149-156,365-369,518-543`, `contract-model.ts:89-120`, `sim/vocabulary.ts:218-235`, `sim/faults.ts:31-68`, `sim/types.ts:1012-1025`, `sim/capture-telemetry.ts:149-195`, `apps/core-server/src/db/migrations/0001_tables.sql:370-384`, `0004_capture.sql:34-52,217,227,228`, `apps/core-web/src/features/api-reference/try-it.ts:30-48`, `apps/core-server/src/modules/capture-config/index.ts`, `fencing.ts`. Edits applied by a script with asserted single-match anchors; table column counts checked (0 bad rows); pre-edit copies kept in the session scratch directory |
| Assumptions | A-1: an operator session bound to a paired device can be told apart from a web console session by the server (the existing `DEVICE_SESSION` condition does the opposite test, `contract-model.ts:93`). A-2: in development mode the loopback sources can be listed by a search as candidates (row 123 / 136 design it). A-3: cameras lock an account after about five failed logins — **hypothesis**, no source in the repository |
| Gaps | Section 6 |

## 3. Operations

| # | operationId | Method | Path | Access | Carries a credential | Audit | Mode |
|--:|---|---|---|---|---|---|---|
| 93 | `startCaptureDiscovery` | POST | `/api/v1/capture/discovery` | `CAPTURE_CONFIG`; web, tablet, phone; allowed while a session is open | no | `CAPTURE_DISCOVERY_SEARCHED` | simulated |
| 94 | `getCaptureDiscovery` | GET | `/api/v1/capture/discovery` | `CAPTURE_CONFIG`; owner session only | no | none (read) | simulated |
| 95 | `testCaptureCandidateConnection` | POST | `/api/v1/capture/discovery/candidates/{id}/test` | `CAPTURE_CONFIG` + `WEB_CONSOLE_SESSION`; idle only | **yes** (request body, in memory for that request) | `CAPTURE_CONNECTION_TESTED` | simulated |
| 96 | `adoptCaptureCandidate` | POST | `/api/v1/capture/discovery/candidates/{id}/adopt` | `CAPTURE_CONFIG` + `WEB_CONSOLE_SESSION`; idle only | **yes** (request body; stored only through the op-89 write) | `CAPTURE_CANDIDATE_ADOPTED` (+ `CAPTURE_CONNECTION_TESTED`, + `CAPTURE_CREDENTIAL_SET`) | simulated |
| 97 | `rescanCaptureInputs` | POST | `/api/v1/capture/inputs/rescan` | `CAPTURE_CONFIG`; web, tablet, phone | no | `CAPTURE_DISCOVERY_SEARCHED` (`scope: MIC_LOCAL`) | simulated |

Extended: 76 / 77 (device shapes gain `adapter`, `sourceClass`), 78 / 79 (any registered device;
refuse a development source with the flag off), 89 (web console only; `503
CREDENTIAL_STORE_NOT_READY` until row 84; registered devices only), `beginPrecheck` /
`retryPrecheck` (reachability, start rule, one search).

Main decisions of this row:

1. **A `capture_devices` row comes into being only in the commit of op 96**, in one transaction with
   the credential row and the audit rows. Searches, tests and every refused or abandoned step write
   no row; there is no pending state. Op 89 is unchanged in path and body and never addresses a
   candidate (its path pattern is `HARDWARE_DEVICE_ID_PATTERN`; a candidate id is `CND-...`).
2. **Candidates live in Core memory, owned by one operator session**; no table, no slice. Nobody
   reads another session's list (404 for a foreign id). Lifetime: window + 10 minutes (proposed),
   sign-out, session expiry, Core restart, or the owner's next search.
3. **The connection test has no address member** — the target is a candidate id of the caller's own
   live search. Development sources on loopback are reached as candidates too.
4. **A production candidate is never contacted without a credential**; development candidates may
   be tested and adopted without one. Hence from M4: search, list, all five test outcomes, adoption
   of development sources without a credential; adoption with a credential after row 84.
5. **No new error code** (15 new `details.reason` values on existing codes) and **no new fault
   kind**: alerts use `SYSTEM` (WARNING) and `CAPTURE_FAULT` (CRITICAL) with `params.reason`.
6. **Web console only is enforced by the server** through a new access condition, not only by the UI.

## 4. Totals (stated once in the contract, §10.1)

| Total | Today | Delta | Target |
|---|--:|--:|--:|
| Operations | 92 | + 5 | 97 |
| GET / POST | 35 / 57 | + 1 / + 4 | 36 / 61 |
| Audit types | 63 | + 4 | 67 |
| Error codes | 40 | 0 | 40 |
| Replicated slices | 30 | 0 | 30 |
| `offline` scope | 26 | + 5 | 31 |
| `FaultKind` / fault-kind CHECKs | 14 / 3 | 0 | unchanged |
| `CoreApiAccessCondition` | 5 | + 1 | 6 |
| Web Try-it denied operations | 8 | + 2 | 10 |

Not in the table and still to pin: an added INTERNAL sim action for the `SYSTEM`-kind alerts would
move the "internal 4" count of `packages/shared/src/api/sim-actions.ts:13`.

**Schema change implied?** By this contract: **no CHECK change and no new table** (no new fault
kind; `capture_devices.kind` keeps `CAMERA|MIC|POE`; candidates are not stored; the "already
registered" match uses the existing columns `onvif_uuid` and `address`). One point may need a
column: where the adapter kind of a device is recorded — row 122 decides.

## 5. Hand-over

**Row 122 (database contract).**
- Decide where the adapter kind is stored (new column on `capture_devices`, written at INSERT and
  never updated like `kind`, or a derivation from existing columns). `transport` already means
  `RTSP` / `USB` (`seed.ts:157,159`) and should not be reused.
- Confirm "no CHECK change": `FaultKind` stays 14; the alerts use `kind = 'SYSTEM'`, which
  `alerts_kind_check` already admits.
- Confirm the matching key (`onvif_uuid`, then the host of `address`) and how two concurrent
  adoptions of one endpoint yield one row (serialised adoption in the module, or a unique index —
  the second is a migration).
- Check the runtime role's grants for the adoption transaction: INSERT on `capture_devices` and on
  `capture_device_credentials` (D72(f) showed that a missing grant stays invisible until used).
- Id minting `CAM-NN` (highest + 1, never reused) against `capture_devices_id_check`.
- How the development-mode microphone and camera rows (`adapter: LOCAL_DEVICE` / `FAKE`) get into
  the registry when no adoption exists for microphones (seed or boot step of row 136).
- State "migration `0008`: yes / no" so that row 130 can drop out or not.

**Row 123 (capture architecture).**
- Name the production adapter-kind values (the contract fixes only `LOCAL_DEVICE` and `FAKE`).
- Confirm `CAPTURE_DISCOVERY_WINDOW_MS` (5 s proposed) and that the candidate fields come from the
  probe answer alone (D80(1)).
- Design how a search lists the loopback development sources as candidates in development mode,
  and that it lists none with the flag off.
- The connection test and the re-verification: read-only, one attempt, the credential handed to
  any helper process by a channel that is not the command line or the environment.
- Whether `AudioInputAdapter.enumerate()` (op 97) is safe while a capture is running; if not, say
  so and the contract restricts op 97 during RECORDING.
- The INTERNAL raise / resolve path for `SYSTEM`-kind alerts and the optional reason on the
  `CAPTURE_FAULT` raise.
- The interface sketch `discover()` / `profiles()` must fit: candidates carry no device id until
  adopted.

**Row 125 (client UX).**
- Web: search, list, credential prompt, test result (five outcomes plus the refusals of §4), adopt;
  the prompt may need the credential for two requests (95, then 96) — decide whether the form keeps
  it until the dialog closes or asks again; it is never pre-filled and never stored.
- Tablet and phone: search, list, status, notifications; "Connect" disabled with the sentence that
  points to the web console (the server refuses 95 / 96 / 89 there with `WEB_CONSOLE_ONLY`).
- Alert copy keyed by `params.reason` (`CAPTURE_DISCOVERY_EMPTY`, `CAPTURE_DEVICE_UNREACHABLE` with
  `phase`, `NO_CAMERA_CONNECTED`); the `SYSTEM` kind has no fault icon of its own.
- The candidate texts `vendor` / `model` / `name` are untrusted device text: draw as text only.
- Polling of op 94 while `RUNNING` (not faster than once per second; no client countdown).
- Before row 84: adoption with a credential answers `503 CREDENTIAL_STORE_NOT_READY` — show the
  reason plainly, as §8a does for the STT secret.
- Whether Simulated mode shows the "development source" label on the simulator's `FAKE` devices;
  whether an empty-search state is wanted in Simulated mode (the simulator always answers two
  candidates).
- An operator without `CAPTURE_CONFIG` after a pre-check search: the alert only (op 94 answers 403).

**Row 126 (security review).**
- Open item 1: the credential in the body of 95 and of 96 (three credential-carrying operations
  with 89) against "only through operation 89" — accept or require another shape.
- The re-verification inside op 96: keep or drop.
- The non-SSRF argument: candidate id only, owner session only, announced host = answering host,
  one 404 for unknown / expired / foreign.
- The limits of §7, above all `CAPTURE_CONNECTION_TEST_MAX_FAILURES = 3` per host in 15 minutes
  (hypothesis about camera lock-outs) and the fact that the in-memory counter resets at a Core
  restart.
- Whether `host` belongs in the `CAPTURE_CONNECTION_TESTED` detail (forensics against D75).
- The new condition `WEB_CONSOLE_SESSION`: how the server tells a web console session from a
  device-bound one, and that the refusal comes before the body is read.
- Request-body logging: the member names `username` / `secret` are those of op 89, so the shared
  redaction (`packages/shared/src/api/redaction.ts`) must cover the nested `credential` object.
- Searching and the microphone re-read while a session is open (D80(4)).

**Row 127 (test strategy).**
- Checks for: 0 probes before a trigger; N stub devices -> N candidates; 0 rows after a search;
  expiry, sign-out and restart discard the list (fake clock); another session's candidate -> 404
  with 0 outbound requests; each of the five outcomes once on fixtures; `CREDENTIAL_REQUIRED` with 0
  outbound requests; every rate limit; `CAPTURE_CONFIG_LOCKED` on 95 / 96 / 89 and not on 93 / 94 /
  97; `WEB_CONSOLE_ONLY` for a device-bound session; adoption atomicity (a failure injected inside
  the transaction leaves 0 rows in both tables); two concurrent adoptions -> one row; key-list rule
  test for the four audit types with 0 secret keys; one alert for five empty searches; Try-it
  denial of 95 / 96; pins equal to §10.1.
- R-9 AC-5's full sequence **with a credential** is provable only after row 84; before it the check
  ends at `503 CREDENTIAL_STORE_NOT_READY` — give it two depths or two check ids.
- R-10 AC-5 says "2 alerts, 2 audit rows" for raise, clear, raise: with this contract that is 2
  `CAPTURE_DEVICE_UNREACHABLE` rows for the `SYSTEM` alerts (resolving writes none), but for
  situation C the existing fault path also writes `FAULT_CLEARED` — word the check per situation.
- States the simulator never reaches (409 in progress, 429, 503, the four failing outcomes) are
  Core-server tests on the stub; parity tests compare the fixed simulator answers of §2.6.

**For the controller / row 128.** `01_specs.md` R-9 AC-5 and AC-7 and blueprint rows 121 and 142
still say the test takes its credential from operation 89; D80(7) overrides — reconcile the
wording. Rows 132 / 142 also inherit: the pin moves of §10.1, the widened description of
`CAPTURE_DEVICE_PARAM`, the new access condition in `contract-model.ts`, and the Try-it list.

## 6. Open items and decisions for the controller

1. **Needs confirmation:** the credential is in the body of op 95 (ruled, D80(7)) and of op 96
   (this row). Op 96's credential leg is the op-89 write inside the adoption transaction. Reason:
   op 89 cannot name an unregistered device, and "adopt, then op 89" would leave a camera
   registered without a credential when the second step fails. Alternative not chosen: op 89's
   path accepting a candidate id.
2. Re-verification in op 96 is an addition of this row.
3. D80(6) does not rule the **primary** microphone unreachable while the standby is reachable;
   proposal in the contract §3.1: blocked.
4. Removing or unregistering an adopted camera is not designed (gap).
5. All §7 values are proposals; the lock-out figure is a hypothesis.
6. The `FAULT_RAISED` detail keys `reason` / `evidenceFiles`: this analyst did not find that type
   in `SERVER_AUDIT_DETAIL_RULES` and could not confirm where its key list lives (MEDIUM).
7. No `info.version` step is assumed for the five operations (the open item of pair-113 N-12).

## 7. Files

- Updated: `/Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/masterplan/03_api_contract.md` (771 -> 1205 lines)
- Updated (subsection §5.8 and the footer line only): `/Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/masterplan/11_audit_errata.md`
- Created: `/Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/delegation_progress/data_analyst_row121.md`

---
*Generated: 2026-10-09*
*Last Updated: 2026-10-09*
