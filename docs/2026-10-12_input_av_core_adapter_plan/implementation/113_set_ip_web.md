---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 113
milestone: M10 / WP-22c
date: 2026-10-13
agent: coder-execution (agent W2; single writer of apps/core-web in this wave)
tier: T3
status: complete - built and green on the in-app simulator and on contract-shaped answers of the fake transport; NO browser check was made; no Core was asked
---

# Row 113 - web console: the set-IP screens (target address, MAC of the neighbour table, MAC after authentication)

Paths are relative to `/Users/gsp-budi/Documents/DEMS/apps/core-web`. Built against operations 106
`setCameraNetwork` and 107 `getCameraNetworkJob` AS BUILT by record `111_set_ip_job.md` (and its
request line (a) to (h)), contract `packages/shared/src/api/capture-commissioning.ts`.

**Plain statement.** No dev server was started; ports 5173 / 5178 and the instance on 4423 / 5178
were not touched. No browser check was made (the scripted browser session is part of the gate). No
camera, no Core and no network was asked: the answers are the simulator's or handed in through the
fake transport. The account in the tests is synthetic (`CANARY...`), typed nowhere else.

## 1. What was built

| File | Content |
|---|---|
| `src/features/commissioning/set-ip-model.ts` (NEW) | operations 106 / 107 in both data modes; `setIpRefusal` (pure); the two optional addresses in the contract's form; `setIpBodyOf` through `CameraNetworkSetRequestSchema`; `macVerdict`; the field attributes `SET_IP_FIELD` |
| `src/features/commissioning/set-ip.tsx` (NEW) | `SetIpPanel` (panel `setip`): the chosen camera, the form with the typed account, the job view with its own reads |
| `src/features/commissioning/parts.tsx`, `refusal.ts` (NEW) | the panel card, its error boundary, the retry, the refusal alert and the refusal hooks MOVED out of `index.tsx`, unchanged, so that the two new panels use the same ones; `usePresentUnworded` split out of `useRefused` |
| `src/features/commissioning/index.tsx` | the moved block removed (one Edit); the scan result gains the column "Address change" with one button per row (none on a row with `conflict`); the page holds the chosen camera and "a job runs" in memory; `SetIpPanel` and `AcceptancePanel` mounted |
| `src/features/commissioning/model.ts` | `CommissioningOperation` gains the four ids; `liveFailure` and `simAnswer` exported |
| `src/features/commissioning/commissioning.css` | four small rules (`com-subtitle`, `com-steps`, `com-step`, `com-lines`) |
| `src/i18n-web.ts` | member `web.commissioning.setIp` |
| `src/features/commissioning/__tests__/commissioning.test.tsx` (EXTENDED) | 19 new cases (the file: 10 -> 29): 11 of this row, 5 of row 118, 3 role cases shared by both |

No dependency was added. Kit: `@heroui/react` (Alert, Button, Checkbox, Chip, TextField, Table),
lucide-react, TanStack Router (`useRouter` for the navigation listener).

## 2. What the technician sees

| State | Screen |
|---|---|
| No camera chosen | what the job does; "Scan first, then choose Change address in the row of the camera" (the Core takes `fromAddress` from its last scan only: record 111 D-4) |
| A row of the last scan chosen | THE DEVICE THAT WILL BE RE-ADDRESSED: present address, the hardware address the scan read from the neighbour table (or that it held none), what it announced, the registered-camera note; new address (optional), gateway (optional), user name, password; the tick "This is the camera I mean: the device at A with the hardware address M"; Start (enabled only with the account and the tick), Cancel |
| A job | `Job CNJ-nnnnnn`, the step in words, present address, TARGET address ("not known yet: the Core takes the next free address" while null), the THREE hardware addresses - neighbour table, stated by the camera after sign-in, answering at the target address - and the verdict chip of the first two: "Not compared yet", "Same device", "Not the same device" |
| `MAC_MISMATCH` | the job is FAILED on the screen: both addresses shown, "Not the same device", and "Stopped: ... This may not be the camera you mean. Nothing was set on the camera." (also when the neighbour table held none: record 111 D-5) |
| The other seven failure codes, a job the Core no longer holds (`404`), reads not answered | a sentence each; after 3 unanswered reads the console stops asking and offers the rate-limited retry |
| COMPLETED | "The camera now answers at A with the same hardware address. Scan again before the next address change."; for a registered camera: "confirm its new address on the Devices page" (record 111: the job changes no registry row) |

The console asks for a RUNNING job every 2 s by itself (one read after the last answer, the job's id
only) and offers "Read now". A new scan drops the choice; while a job runs no other camera is offered.
When a job ends the page reads the temporary host address again.

## 3. The refusals of a start (each: nothing was sent to the camera)

| Answer | Sentence |
|---|---|
| `409 COMMISSIONING_NOT_AVAILABLE` | the console's own: "This Core cannot change a camera address: it is not running in production capture operation, or its host does not provide what an address change needs. Nothing was sent to the camera and nothing was changed." The page notice "this Core is not in production capture operation" is NOT raised by this panel: the Core answers the same for a production Core without its host inputs (record 111 section 8) |
| `409` `COMMISSIONING_HELPER_NOT_CONFIGURED`, `..._NOT_CONFIGURED`, `..._JOB_IN_PROGRESS`, `CAMERA_ADDRESS_CONFLICT`, `CAMERA_NEW_ADDRESS_IN_USE`, `CAMERA_NO_FREE_ADDRESS` | the contract's sentence + "Nothing was sent to the camera." |
| `422 COMMISSIONING_ADDRESS_NOT_ALLOWED` | the contract's sentence + "The present address must be one the last scan of this Core listed; the new address and the gateway must lie inside the camera subnet and belong to no other device. Scan again ..." |
| `429 CONNECTION_TEST_LOCKOUT_GUARD` / `CONNECTION_TEST_RATE_LIMITED` | "paused so that the camera does not lock its account" / "too soon after the last attempt" |
| `409 CAPTURE_CONFIG_LOCKED`, `403`, another `422` | the commissioning screen's sentence + "Nothing was sent to the camera." |
| not answered | "Whether a job started is not known: read the temporary host address and scan again before another attempt." |

## 4. The typed camera account: the five assertions and where each is tested

| # | Assertion | How it is built | Test (block "row 113: the typed camera account") |
|--:|---|---|---|
| 1 | never pre-filled, never in component state longer than the request | two plain UNCONTROLLED inputs (no `value`, no `defaultValue`, no form library, no `<form>`); state holds two facts ("this field holds text"); read at the press into two locals, handed to the checks and the ONE call | fields empty and without a `value` attribute; a walk over every hook state and prop of the page's React tree finds neither value while typed - CONTROL: the typed new address IS found there |
| 2 | never in a URL, the router state, local / session storage, a log, a cache | no code path hands it to any of them; a failure holds status and codes only | after a `409`, a `422` naming the member, an outage and an accepted start: neither value in the error sink, the page's log, a console call, a toast, the markup, a component, a query key / entry / error, the mutation cache, any request URL, the router location and its state, `history.state`, the three storages |
| 3 | cleared on submit, on cancel, on unmount and on navigation | emptied at the press BEFORE the request leaves; Cancel; a layout-effect cleanup (job started, another camera, a new scan, the page left); the router's `onBeforeNavigate` (also a navigation that keeps the page mounted) and `pagehide` | the fields read at the instant the Core answers are empty; the held elements are empty after Cancel, after choosing another camera, after a new scan, after a hash navigation (same elements, Start disabled again), after `pagehide`, after leaving for the Dashboard; nothing was sent in that case |
| 4 | never an error boundary's message | the boundary keeps one flag and draws two fixed sentences; its record is a fixed sentence, the panel's name and the error's class | a panel that throws an error whose text holds both values: fallback text fixed, record `{ panel: 'setip', errorName: 'Error' }`, no value in markup or sink (React's own print of a render error to the browser console is not this console's log and is not searched) |
| 5 | the form cannot be submitted from "Try it" | operation 106 is on `TRY_IT_DENIED_OPERATIONS` (unchanged file `features/api-reference/try-it.ts`) | THE PIN verified: every credential-carrying operation of the contract is denied; `setCameraNetwork` is refused in five spellings of its path; 109 and 110 too; CONTROL: the job read stays offered |
| - | NEGATIVE CONTROL | - | the four bodies sent hold `{ fromAddress, credential: { username, secret } }` exactly as typed, the password with its spaces |

Honest limits: a text cannot be overwritten in a JavaScript runtime - "cleared" means the element's
value is empty and no reference of this page holds the text when the handler has returned. A browser
extension or the browser's own autofill store is outside the page. The transport holds the body for
the life of the one request.

## 5. Which answers are simulator-only

| Answer | Whose |
|---|---|
| operation 106: `409 COMMISSIONING_NOT_AVAILABLE` for every start of the right form; the account dropped unread | the simulator's - block "row 113, Simulated mode" |
| operation 107: `404` for every id | the simulator's - never reached by the screen (no job starts); asserted as "no read of a job" |
| every job (its steps, the three hardware addresses, a mismatch, each failure code, a lost job), every other refusal | contract-shaped answers handed in through the fake transport: they prove what the screen does with them, not that a Core gives them |

## 6. Checks (2026-10-13, in `apps/core-web`, `--maxWorkers=2`)

| Command | Result |
|---|---|
| `npx vitest run src/features/commissioning/__tests__/commissioning.test.tsx` | run 1: `Tests 1 failed / 28 passed (29)` - MINE, in my own new negative control (it searched the transport log's printed form, which states a credential body as its length and member names; the body itself is read now) |
| the same file with `selector-microphones`, `capture-selector`, the three API-reference pin files, `live-shell-admin`, `core-queries`, `box-check` | run 2: `Test Files 9 passed (9)`, `Tests 299 passed (299)` |
| the same file after the last source edit, with the nine suites that walk the source tree (`routes`, `live-static-ac-c-53`, `live-runtime-static`, `live-pending-control`, `integrity-checks`, `real-core-facts`, `event-words`, `selector-in-force`, `live-strict-mode-starts`) | run 3: `Test Files 10 passed (10)`, `Tests 270 passed (270)` |
| `npx tsc -b` | exit 0, no line |
| `npx oxlint` (the whole workspace) | exit 0, no warning |

The row's verification cell: "a MAC mismatch stops the job on the screen" - case "a hardware address
mismatch STOPS THE JOB ON THE SCREEN"; "the credential field is never pre-filled and is cleared when
the job ends" - the fields are never pre-filled (assertion 1) and are emptied at the press, so they
are empty before the job exists, while it runs and after it (the job case holds the two elements and
reads them empty; the form is unmounted for the whole job).

## 7. Driver decisions (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| DD-1 | The two account fields are plain inputs with the kit's field classes, not the kit's `TextField` | the kit's field keeps its text in component state; the same choice and markup as the connect dialog of the Devices page (fix F-M4). Everything else is the kit's |
| DD-2 | An address change starts from a ROW OF THE LAST SCAN only; a new scan drops the choice; no button on a row with `conflict` | record 111 D-4 and refusal 7; no free-text "present address" |
| DD-3 | "Not available" is worded by the console for this panel and does not raise the page notice | it is also the answer of a production Core without its host inputs; the contract's sentence names only "a production Core" (request line) |
| DD-4 | The job's id and view live in the page's memory only; reads every 2 s by a timer of the panel, stopped after 3 unanswered reads | a job is data of the operator session and in the Core's memory; nothing of it belongs in a URL or storage. Leaving the page loses the view, not the job - said on the screen |
| DD-5 | Start needs the tick "This is the camera I mean" naming the address and the hardware address | the row's purpose: the technician sees which device is re-addressed |
| DD-6 | No "show password" control | one less place a typed secret is drawn; the connect dialog has one (D86 C-1) - add on request |
| DD-7 | `parts.tsx` / `refusal.ts` were split out of row 112's `index.tsx` | one card, one boundary and one set of refusal hooks for three panel files; behaviour unchanged (row 112's ten cases pass unedited) |
| DD-8 | The account rules are the connect dialog's (`validateConnectForm`, `credentialOf` of `features/devices/camera-connect.ts`), imported | one credential rule in the console (the contract's pair of operation 89) |
| DD-9 | The lock-out sentences name no time | the answer's `retry-after` is not kept in the page's failure shape; "try again later / shortly" |

## 8. Requests left (`delegation_progress/file_requests.md`, three lines `rows 113 / 118 (agent W2) | ...`)

1. The shared-contract writer: the sentence of `COMMISSIONING_NOT_AVAILABLE` and the missing sentences of the `429` for an address change.
2. Row 181 / the controller: the step list of an acceptance (row 118).
3. The owner of the production scan: what the panel cannot show until SR-13 is built.

## 9. Unproven

| Unproven | Check |
|---|---|
| The screens in a browser (layout at the console's widths, the kit's focus order, a password manager's behaviour on the two fields) | the scripted browser session of the gate |
| The panel against a running Core: the real `202`, the job's states over time, `429` with its header | integration pass; `9A/H-13`, `9A/H-14` |
| A real camera: the three hardware addresses equal, a mismatch, the wait of up to 180 s | `9A/H-14`, `9A/H-15` |
| `conflict` and `registeredDeviceId` of a production scan (not built: record 111b) | after SR-13 |

## 10. Rules kept

The claims line was the first act. Edit tool only for every existing file; new files with Write
(`set-ip-model.ts`, `set-ip.tsx`, `parts.tsx`, `refusal.ts`, the records). No scripted replace, no
shell append. Nothing of `packages/shared`, `apps/core-server` or `features/api-reference` was edited.
No commit, no stage, no full suite. No dev server, no port bound.

---
*Generated: 2026-10-13*
