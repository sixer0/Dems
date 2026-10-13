---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 118
milestone: M10 (derived row)
date: 2026-10-13
agent: coder-execution (agent W2; single writer of apps/core-web in this wave)
tier: T3
status: complete - built and green on the in-app simulator and on contract-shaped answers of the fake transport; NO browser check was made; no Core was asked
---

# Row 118 - web console: the form that records an installation acceptance and its revocation

Paths are relative to `/Users/gsp-budi/Documents/DEMS/apps/core-web`. Built against operations 109
`acceptInstallation` and 110 `revokeInstallationAcceptance`: contract record
`116_acceptance_contract.md`, routes as built `117_acceptance_ops.md` (and its request line to this
row). Built after row 113 was checked and recorded (`113_set_ip_web.md`).

**Plain statement.** No dev server, no browser check, no Core, no database. The answers are the
simulator's or handed in through the fake transport.

## 1. What was built

| File | Content |
|---|---|
| `src/features/commissioning/acceptance-model.ts` (NEW) | operations 109 / 110 in both data modes; `acceptanceRefusal` (pure); `ACCEPTANCE_STEP_IDS`; the form rules; `acceptBodyOf` and `revokeBodyOf` through the contract's own schemas |
| `src/features/commissioning/acceptance.tsx` (NEW) | `AcceptancePanel` (panel `acceptance` of `/admin/commissioning`): the standing sentences, "Record an acceptance", "Revoke the acceptance in force", the answered record |
| `src/features/commissioning/index.tsx` | the panel mounted (one line; behind the page's role gate) |
| `src/i18n-web.ts` | member `web.commissioning.acceptance` |
| `src/features/commissioning/__tests__/commissioning.test.tsx` (EXTENDED) | 5 cases of this row, and the 3 role cases shared with row 113 |

Kit: `@heroui/react` (Alert, Button, Checkbox, TextArea, TextField), react-hook-form with the zod
resolver. No dependency was added.

## 2. Behaviour

| Rule | As built |
|---|---|
| TECHNICIAN only (U10) | the panel is drawn only inside the page's role gate: absent for a role without `CAPTURE_COMMISSION` in Simulated mode (the role sentence, no field, nothing requested) and in Live mode (the route guard leads to the Dashboard) |
| RECORDING IS NOT GATED ON AN ACCEPTANCE | said first in the panel, always: "Recording is not gated on an acceptance: a session starts whether or not an acceptance is in force, and revoking one stops nothing. An acceptance is a record, not a switch." |
| No read exists (C80) | said: "The console cannot read whether an acceptance is in force. The Core says so when you record or revoke one ...". The record shown is the one of the LAST ANSWER of this page; before an answer none is shown |
| What the form sends | `{ siteAddress?, steps }` and nothing else: the site address only when typed (trimmed at its edges, line breaks kept), and every offered step as exactly `id`, `passed`, `detail` (`null` for no note). Built from the closed list and passed through `InstallationAcceptRequestSchema` (strict objects) before it is sent |
| What it cannot send | who, when, the software version, the Core's id / name / room, the diagnostics: no field exists; the panel says the Core records them itself and that the diagnostics must have ended |
| The bounds | site address at most 500 characters, a note at most 200 on one line, a reason 5 to 500 after trimming: refused beside the field, nothing sent; a body outside the schema as a whole (the size rule counted as the database counts) sends nothing |
| A stored acceptance / revocation | the record: in force or revoked, accepted at / by, software version, the Core at acceptance, "n of m met", the diagnostics run, the site address and the revoke reason AS TEXT ONLY (`<bdi>`, no markup, no link) |

## 3. Every refusal with its sentence

| Answer | Sentence |
|---|---|
| `409 INVALID_STATE` + `INSTALLATION_ACCEPTANCE_IN_FORCE`, `..._NOT_IN_FORCE`, `INSTALLATION_DIAGNOSTICS_NOT_COMPLETE`, `INSTALLATION_DIAGNOSTICS_NOT_STORABLE`, `INSTALLATION_SITE_NOT_STORABLE`, `INSTALLATION_ACCEPTANCE_NOT_AVAILABLE` | the contract's own (`INSTALLATION_ACCEPTANCE_REFUSAL_SENTENCES`) |
| `409 CAPTURE_CONFIG_LOCKED` | "An installation acceptance cannot be recorded or revoked while a session is open. Nothing was changed." |
| `403` | "Your role may not record or revoke an installation acceptance. Nothing was changed." |
| `422` | "The request was not accepted as it was written. Nothing was changed." |
| not answered (an outage, a time-out, a 5xx) | "... Whether the record changed is not known. Send it again: a second acceptance is refused while one is in force, and a revocation is refused when none is, so the answer tells you which." (plus the shared presenter's notice) |

Never the answer's text: the tests hand in "Never drawn." and find it nowhere.

## 4. Which answers are simulator-only

| Answer | Whose |
|---|---|
| operation 109: `409 INSTALLATION_ACCEPTANCE_NOT_AVAILABLE` for a body of the right form | the simulator's (it keeps no installation record) - block "row 118, Simulated mode" |
| operation 110: `409 INSTALLATION_ACCEPTANCE_NOT_IN_FORCE` | the simulator's (it never holds an acceptance) - the same block |
| a stored acceptance (200), a revocation (200), the other refusals | contract-shaped answers handed in through the fake transport |

## 5. Checks (2026-10-13, in `apps/core-web`, `--maxWorkers=2`)

The same runs as row 113 (one test file, one typecheck, one lint):

| Command | Result |
|---|---|
| `npx vitest run src/features/commissioning/__tests__/commissioning.test.tsx` + the selector suites, the three API-reference pin files, `live-shell-admin`, `core-queries`, `box-check` | `Test Files 9 passed (9)`, `Tests 299 passed (299)` (the first run of the file alone had 1 failure, in a case of row 113: record 113 section 6) |
| the same file after the last source edit, with the nine suites that walk the source tree | `Test Files 10 passed (10)`, `Tests 270 passed (270)` |
| `npx tsc -b` | exit 0 |
| `npx oxlint` | exit 0, no warning |

The row's verification cell:

| Cell | Evidence |
|---|---|
| the form sends only keys of the key list | `expectKeyListOnly` on the body the simulator received, on the body the fake transport received and on `acceptBodyOf`: members `siteAddress` / `steps` only, each step's keys equal `INSTALLATION_ACCEPTANCE_STEP_KEYS`, the body parses by the contract's strict schema; none of `acceptedBy`, `acceptedAt`, `softwareVersion`, `coreDeviceId`, `siteName`, `room`, `diagnostics`, `code` occurs |
| it is absent for a role without the permission | block "rows 113 and 118: a role without CAPTURE_COMMISSION": SUPERVISOR and INVESTIGATOR in Simulated mode (no panel, no field, no request), SUPERVISOR in Live mode (Dashboard; none of the four operations asked) |

The Try-it pin of operations 109 and 110 (`TRY_IT_DENIED_OPERATIONS`, written by row 112's agent on
request of row 116) was verified, not moved: `deniedTryItOperation('POST', ...)` names both.

## 6. Driver decisions (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| DD-1 | THE STEP LIST IS THE CONSOLE'S: `CAMERA_NETWORK_CONFIGURED`, `CAMERAS_ADDRESSED`, `CAMERAS_REGISTERED`, `CAMERAS_ASSIGNED`, `MICROPHONES_ASSIGNED`, `TEST_RECORDING_CHECKED` | the contract leaves the ids open (record 116 DD-3: chapter 4 of the hardware acceptance names the steps); the two fixture names plus what this area sets up. One constant and six labels to change (request line) |
| DD-2 | Every offered step is sent, met or not | the record states what was checked AND what was not; a step left out would read as "not asked" |
| DD-3 | No custom step and no free id | "only keys of the key list"; an id is a code, never a typed text |
| DD-4 | No confirmation dialog before a revocation | the typed reason of at least 5 characters is the deliberate act; a revocation stops nothing (the record is kept) |
| DD-5 | The form lives on the commissioning page as a fifth panel | the row's ownership area ("commissioning feature of 112"), the same permission, no new route, no navigation pin moved |
| DD-6 | The record view is the last answer of this page, lost when the page is left | no read operation exists (C80); storing it in the browser would show a state the Core may no longer hold |
| DD-7 | The page does not start the diagnostics | `runDiagnostics` is another screen's control; the panel says to run them first, and the Core's refusal says so again |

## 7. Unproven

| Unproven | Check |
|---|---|
| The form in a browser | the scripted browser session of the gate |
| The form against a running Core (the stored record, the one-in-force refusal judged by the database, idle only) | integration pass; the routes' own tests are record 117 |
| Whether the six steps are the procedure's | chapter 4 of the hardware acceptance (row 181) |

## 8. Rules kept

Edit tool only for existing files; new files with Write (`acceptance-model.ts`, `acceptance.tsx`,
the records). Nothing outside `apps/core-web` and the documents was written. No commit, no full
suite, no dev server.

---
*Generated: 2026-10-13*
