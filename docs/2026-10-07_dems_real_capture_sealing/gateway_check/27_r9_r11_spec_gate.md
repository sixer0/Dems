---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-09
agent: verifier
blueprint_row: 128
type: gateway check (tier 2) — reconciliation gate of the R-9..R-11 spec delta (rows 120-127)
source_plan: /docs/2026-10-07_dems_real_capture_sealing/masterplan/02_plan.md
status: needs-review
verdict: GAPS FOUND — 94 spec edits and 34 blueprint edits listed; rows 129, 131 and 134 may start after the fix pass, on the conditions of section 1
procedure: D89 (one reconciliation table, one consolidated fix pass, the controller checks by grep)
files_edited_by_this_row: this file only
last_updated: 2026-10-09 15:58
---

# Row 128 — reconciliation gate of the R-9..R-11 spec delta

Scope: the eight spec deltas of rows 120-127 (`masterplan/01`, `03`, `04`, `05`, `06`, `08`, `09`, `10`),
their eight records under `delegation_progress/`, the erratum ledger `masterplan/11_audit_errata.md` §5
and the blueprint `identification/02_structured.md` rev 2.3. Nothing but this file was written: no
spec, blueprint, tracker, code or decision file was edited, no test was run, no database was read.

Authority order used for every row (as given with the row): (1) the user's words — D73, D74, D75,
D76, D78, D87, D88; (2) controller rulings D72(g)(h)(k), D80-D86, D89, a later ruling narrowing an
earlier one; (3) the more specific spec over the more general. Every "required text" names the
decision or the more specific spec it rests on. Where no authority decides, the point is in
section 4 and is not decided here.

Short forms: `01` .. `10` = `masterplan/01_specs.md` .. `masterplan/10_test_strategy.md`;
`bp` = `identification/02_structured.md`; `rec-12x` = the record of row 12x under
`delegation_progress/`; `dec` = `decisions/decisions.md`. Line numbers are those of the working
tree at generation time (2026-10-09 15:58; HEAD `4b62350`, with `09` and `10` uncommitted).

## 1. Verdict

**GAPS FOUND. The deltas agree on structure (operations 93-97, the four audit types, the alert
kinds, the five outcomes, the five boot refusals, the schema objects, manifest fields 124-128, V-15,
the check IDs) and disagree where a later ruling was not carried back into an earlier spec.**

| Class | Edits listed | must-fix-before-implementation | should-fix | cosmetic |
|---|--:|--:|--:|--:|
| naming | 23 | 15 | 8 | 0 |
| constant | 9 | 7 | 2 | 0 |
| total | 6 | 3 | 1 | 2 |
| coverage hole | 34 | 26 | 7 | 1 |
| open point | 22 | 8 | 10 | 4 |
| **spec edits (section 2)** | **94** | **59** | **28** | **7** |
| blueprint wording (section 5; for the task-architect) | 34 | — | — | — |

The count is of **edits** (one row of section 2 = one place or one group of places changed for one
reason), not of root causes: one disagreement that lives in three files is three rows. Root causes
are fewer; the ten that produce most rows are listed in section 7.5. Edits per file:
`01` 16, `02` 2, `03` 23, `04` 6, `05` 21, `06` 5, `08` 12, `09` 4, `10` 5.

**May rows 129, 131 and 134 start after the fix pass? Yes, each on these conditions.**

| Row | Fixes that must be in place first (severity must-fix) | Blueprint sentence | Rulings |
|---|---|---|---|
| 129 (migration set 4) | FX-04-01, FX-09-02 | BP-129 | R-1 must be answered before the set is generated: answer B adds a CHECK change to it; with A (recommended) the row is unaffected |
| 131 (WS-Discovery adapter) | FX-03-01, FX-05-04, FX-05-21, FX-05-05, FX-05-11 | BP-131 | none |
| 134 (local camera helper) | FX-01-11, FX-01-12, FX-05-01, FX-05-17, FX-05-18 | BP-134 | none (U-3 is answered: D87(4)) |

"must-fix-before-implementation" in section 2 is relative to the row named in the column
"Blocks": a fix that blocks row 142 or row 141 does not hold up rows 129, 131 or 134. The fix pass
is one pass all the same (D89); the column only tells the controller what to check first.

Rulings needed: **2** (section 4.1). Names minted by this gate that the controller confirms or
renames in one line: **9** (section 4.2). Every other open point of the eight records is closed by an
existing decision (section 7.4).

## 2. Fix list — one row per edit

### 2.1 How to use it

1. Work file by file, top to bottom; within a file the rows are in line order of the most
   important anchor. Line numbers are those of today's file and shift as edits land — use the
   quoted **current text** as the anchor. A quote may be abridged ("..."); the mode-A pattern of a
   row is always an exact string of today's file (counted when this table was generated).
2. "Required text" is the text to end up in the spec. Where it says *append* or *add*, the existing
   sentence stays. Mark each edit with a dated erratum mark `PE-128-NN` (section 6.8 gives the
   number of every row) in the convention of `masterplan/11_audit_errata.md` §5.
3. Re-check: for every row run `grep -c -F -- '<pattern>' <file>` from the task folder. Mode
   **A** = the pattern is present now and must be **absent** after the fix (count 0). Mode **P** =
   the pattern is absent now and must be **present** after the fix (count >= 1). Patterns are fixed
   strings (`-F`), not regular expressions. Section 2.4 holds today's counts, the exact patterns
   in a machine-readable block and one command that re-checks all of them.
4. Do not change any pinned total of section 7.3 unless a row says so (two rows do: FX-08-01 and
   FX-08-11).

### 2.2 The table

| ID | Class | Severity | Blocks row(s) | File and anchor | Current text (short quote) | Required text | Authority | Re-check: mode, pattern |
|---|---|---|---|---|---|---|---|---|
| **FX-01-01** | naming | must-fix-before-implementation | 142, 137 | `masterplan/01_specs.md` :283 (R-9 narrative) | the credential travels only through the existing write-only operation 89 | the credential travels only in the request body of the connection test (operation 95, held in memory for that request) and of the adoption (operation 96, whose credential leg is the operation-89 write inside the adoption transaction); it is stored only in the one Core credential store (D80(7), D81). In this phase a found real camera can be tested, adopted and assigned but not recorded: no listener opens for a source kind without an opener (D82, D86 C-5) | D81; D80(7); D86 C-5 | **A** — `travels only through the existing write-only operation 89` |
| **FX-01-02** | naming | should-fix | 132 | `masterplan/01_specs.md` :288 (R-9 AC-2) | vendor / model / name where the device announces them (scopes) ... the matching key is fixed by rows 121/122 | name and hardware (model) hints from the announced scopes; a vendor hint only when a device announces a non-standard scope (ONVIF has no vendor scope category, `cap` §A.6.1 V-9) ... matched against `capture_devices` by `onvif_uuid` = endpoint reference, else by the whole stored `address` (`dbc-4` §N.5; D83) | D83 (D-DB-15); cap V-9 | **P** — `` else by the whole stored `address` `` |
| **FX-01-03** | naming | must-fix-before-implementation | 142, 137 | `masterplan/01_specs.md` :291 (R-9 AC-5) | the credential is written through operation 89 for that device only -> the connection test runs ... **2 + 1** on each client that row 125 allows | the web console asks the operator for the camera credential (web console only, D80(3)) -> it is sent in the body of operation 95 for the connection test (in memory for that request) -> one named outcome (AC-6) -> operation 96 adopts the candidate and stores the credential in one transaction through the operation-89 write path -> only then can the camera be assigned by operations 78 / 79. ... **2 + 1** on the web console. With a credential the full sequence is provable only after row 84 (`M7-CONN-CRED-1`, `M7-CONN-W-CRED`); from M4 it is proven for a fixture candidate without a credential, and with a credential up to `503 CREDENTIAL_STORE_NOT_READY` | D81; D80(3); D80(7) | **A** — `on each client that row 125 allows` |
| **FX-01-04** | naming | must-fix-before-implementation | 142 | `masterplan/01_specs.md` :293 (R-9 AC-7) | takes its credential from one place only: the operation-89 entry written by an operator for **that same device**. With no such entry the test is refused | takes its credential from one place only: the `credential` member of the request of operation 95 or 96, typed by the operator for that candidate in that request (D80(7), D81). Without it a `PRODUCTION` candidate is refused (`422 CREDENTIAL_REQUIRED`) **before any network request**. A stored credential is never read for a test, so a credential stored for device A can never be offered to device B | D81; D80(7) | **A** — `the operation-89 entry written by an operator` |
| **FX-01-05** | naming | must-fix-before-implementation | 137, 138 | `masterplan/01_specs.md` :298 (R-9 AC-12, "Mobile rule") | on tablet and phone this row **proposes** to allow it as well ... the client set is an **open point for row 125** | Entering the camera credential is **web console only** in this phase (D80(3)); the server enforces it (`WEB_CONSOLE_SESSION` on operations 89, 95, 96 -> `403 NOT_PERMITTED`, `WEB_CONSOLE_ONLY`). On tablet and phone "Connect" is shown disabled with the sentence that points to the web console, never hidden | D80(3) | **A** — `this row **proposes** to allow it as well` |
| **FX-01-06** | coverage hole | must-fix-before-implementation | 132 | `masterplan/01_specs.md` :299 (R-9 AC-13), append | (no statement about RECORDING) | append: "**Narrowed by D86 C-4:** while the session state is `RECORDING`, operation 93 answers `409 INVALID_STATE` (`DISCOVERY_NOT_ALLOWED_WHILE_RECORDING`) until `M4-SEC-DISC-1` and `M4-SEC-DISC-3` are recorded PASS; the lift is checked by `M4-DISC-REC-1`. In every other open state a search is allowed." | D86 C-4 (narrows D80(4)) | **P** — `DISCOVERY_NOT_ALLOWED_WHILE_RECORDING` |
| **FX-01-07** | coverage hole | should-fix | 139, 71 | `masterplan/01_specs.md` :313 (R-10 AC-3), append | (no statement on the state before the first durable fragment) | append: "Until the first durable fragment the session presents 'connecting cameras', never 'recording'. `FAULTED` with nothing durable is a failed start: 0 evidence files, 0 evidence items, no interrupted seal (D84)." | D84; D82(f) | **P** — `connecting cameras` |
| **FX-01-08** | naming | should-fix | 133 | `masterplan/01_specs.md` :315 (R-10 AC-5) | 2 alerts, 2 audit rows, 0 stale banners | 2 alerts and 0 stale banners; audit rows per situation as C3 §5.4 — A: one `CAPTURE_DISCOVERY_SEARCHED` row per search and none for raise or resolve; B and C-degraded: 2 `CAPTURE_DEVICE_UNREACHABLE` rows, none on resolve; C: `FAULT_RAISED` twice and `FAULT_CLEARED` once | D80(8); C3 §5.4 (more specific) | **A** — `2 alerts, 2 audit rows, 0 stale banners` |
| **FX-01-09** | naming | must-fix-before-implementation | 136 | `masterplan/01_specs.md` :325 (R-11 AC-2) | With the flag off, operations 76 / 77 list **0** development sources | In `REAL_PRODUCTION` (capture mode real, development flag off) operations 76 / 77 list **0** development sources ...; in `SIMULATED` every stored kind is inert and the seeded `FAKE` built-ins stay listed as today (D83 O-2) | D83 (O-2) | **P** — `every stored kind is inert` |
| **FX-01-10** | naming | should-fix | 136 | `masterplan/01_specs.md` :326 (R-11 AC-3), append | (no statement on device ids) | append: "The local camera and the local microphone are device rows of their own (the next free `CAM-NN` / `MIC-NN`); `CAM-01`, `CAM-02`, `MIC-01`, `MIC-02` stay `FAKE` and the adapter kind of a row never changes (D83)." | D83 (D-DB-13) | **P** — `device rows of their own` |
| **FX-01-11** | naming | must-fix-before-implementation | 134 | `masterplan/01_specs.md` :327 (R-11 AC-4) | by a listener snapshot showing the helpers on `127.0.0.1` only (C-N4; no helper binds a wildcard address) | by a socket snapshot of each helper showing **0 listening sockets** and one outbound TCP connection to `127.0.0.1` (the worker is the listener and the helper pushes; `cap` §A.6.4, §G.1) | D82(d); cap §A.6.4 (more specific) | **A** — `listener snapshot showing the helpers` |
| **FX-01-12** | coverage hole | must-fix-before-implementation | 134 | `masterplan/01_specs.md` :331 (R-11 AC-8) | no frame or audio excerpt of a local-device recording is copied into `docs/`, not even a small still | from a local-device session no still, no audio excerpt, no waveform or spectrogram, no transcript text and no playback screenshot enters `docs/`; no agent opens local-device media with a viewing tool (D86 C-7); the recordings are deleted only on the user's instruction (D87(5)) | D86 C-7; D87(5); SEC35-44 | **P** — `no waveform or spectrogram` |
| **FX-01-13** | naming | should-fix | 142 | `masterplan/01_specs.md` :398 (C-N15) | the credential travels only through write-only operation 89 into the one Core credential store | the credential travels only in the request bodies of operations 95 and 96 (web console only) and is stored only through the operation-89 write path into the one Core credential store | D81 | **A** — `travels only through write-only operation 89` |
| **FX-01-14** | coverage hole | cosmetic | — | `masterplan/01_specs.md` :396 (C-N13, "How verified") | finding, severity and mitigation by row 126; named check by row 127 | findings SEC35-27..SEC35-30 (`sec` §11.2); checks `M4-DISC-SOCK-1`, `M4-SEC-NET-1`, `M4-DISC-LAN-1` | row 126 / row 127 as gated (D86, D89) | **P** — `M4-DISC-SOCK-1` |
| **FX-01-15** | total | cosmetic | — | `masterplan/01_specs.md` :224 (R-8 status note) | 92 operations (35 GET / 57 POST), 63 audit types, `offline` 26 | keep, and append: "(as built at row 113; targets after R-9..R-11: 97 / 36 / 61, 67 audit types, `offline` 31 — C3 §10.1)" | C3 §10.1 | **P** — `97 / 36 / 61` |
| **FX-01-16** | open point | cosmetic | — | `masterplan/01_specs.md` :345 (B.2.6 heading), one line under it | (open points listed without a status) | add: "**Status after the spec gate (row 128):** items 1-13 and the ambiguities of B.2.7 are closed by rows 121-127, rulings D80-D89 and `gateway_check/27_r9_r11_spec_gate.md`." | D80-D89 | **P** — `27_r9_r11_spec_gate` |
| **FX-03-01** | constant | must-fix-before-implementation | 131, 132 | `masterplan/03_api_contract.md` :1005 (§7) | `CAPTURE_DISCOVERY_WINDOW_MS` \| `5_000` | `CAPTURE_DISCOVERY_WINDOW_MS` \| `3_000` — note cell: "accepted D82(c); `cap` §A.6.1 DS-7 (floor 850 ms + margin)" | D82(c) | **P** — `` `CAPTURE_DISCOVERY_WINDOW_MS` \| `3_000` `` |
| **FX-03-02** | constant | must-fix-before-implementation | 142 | `masterplan/03_api_contract.md` :1010 (§7) | `CAPTURE_CONNECTION_TEST_TIMEOUT_MS` \| `10_000` ... one attempt; then `UNREACHABLE` | `CAPTURE_CONNECTION_TEST_TIMEOUT_MS` \| `15_000` — "the whole test, enforced by destroying the per-test agent; TCP connect 3 s and each request 5 s are sub-bounds (`cap` CT-4; SEC35-33 (1)); then `UNREACHABLE`" | D86 C-8; SEC35-39 (4); cap CT-4 | **P** — `` `CAPTURE_CONNECTION_TEST_TIMEOUT_MS` \| `15_000` `` |
| **FX-03-03** | constant | must-fix-before-implementation | 142 | `masterplan/03_api_contract.md` :1014-1015 (§7) and the hypothesis paragraph :998-1001 | `CAPTURE_CONNECTION_TEST_MAX_FAILURES` \| `3` ... `CAPTURE_CONNECTION_TEST_FAILURE_WINDOW_MS` \| `900_000` | `CAPTURE_CONNECTION_TEST_MAX_FAILURES` \| `2`; `CAPTURE_CONNECTION_TEST_FAILURE_WINDOW_MS` \| `1_800_000`. Replace the hypothesis paragraph by: "The lock-out guard is a conservative default and is not derived from any camera's documentation (D86 C-2). Before the first test against a real camera the user is asked for that model's lock-out rule and the constant is re-pinned (class C-1 entry item). Counted per Core by host; not reset by a new search, another session or another operator; reset by a `REACHABLE` outcome on that host; the re-verification of operation 96 counts; `UNREACHABLE` does not count; held in memory (a Core restart clears it — accepted)." | D86 C-2; SEC35-38 | **P** — `` `CAPTURE_CONNECTION_TEST_FAILURE_WINDOW_MS` \| `1_800_000` `` |
| **FX-03-04** | constant | must-fix-before-implementation | 132, 142 | `masterplan/03_api_contract.md` :1008-1013 (§7), :459 ("Rate limits"), :443 ("Search trigger") | per session at least `CAPTURE_DISCOVERY_MIN_INTERVAL_MS` ... (a pre-check search refused by the limit is skipped ...) | §7: keep `CAPTURE_DISCOVERY_MIN_INTERVAL_MS` = `10_000` (per operator session) and `CAPTURE_DISCOVERY_MAX_PER_MINUTE` = `6` (per Core); add `CAPTURE_DISCOVERY_MIN_INTERVAL_PER_CORE_MS` = `5_000` and `CAPTURE_DISCOVERY_MAX_PER_HOUR` = `30` (per operator session). `CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS` (`5_000`) applies between two tests on one host **and** between two tests of one operator session on any host; one test at a time per Core and at most `CAPTURE_CONNECTION_TEST_MAX_PER_MINUTE` (`6`) per Core. :443 — replace the parenthesis by: "the pre-check search has its own allowance of one per pre-check run, outside the per-minute and per-hour bounds; it stays single-flight (if another search is `RUNNING` it is not started and the pre-check result says so; the pre-check itself is not failed by it)". Constant count of the delta 14 -> 17 (with FX-03-05) | D86 C-8; SEC35-39 (1)-(4) | **P** — `CAPTURE_DISCOVERY_MAX_PER_HOUR` |
| **FX-03-05** | coverage hole | must-fix-before-implementation | 132 | `masterplan/03_api_contract.md` :409 (op 93 errors cell), :457 ("Config lock"), §4 reason table (:618), §7 | **Never `409 CAPTURE_CONFIG_LOCKED`** — a search is allowed while a session is open (D80(4)) | keep, and add: "**409 `INVALID_STATE`** (`DISCOVERY_NOT_ALLOWED_WHILE_RECORDING`): the session state is `RECORDING` and `CAPTURE_DISCOVERY_DURING_RECORDING_ENABLED` is `false` (D86 C-4) — 0 datagrams, no audit row, no alert. The constant becomes `true` only when the gate artifact records `M4-SEC-DISC-1` and `M4-SEC-DISC-3` PASS (check `M4-DISC-REC-1`)". §4: one new row `INVALID_STATE` / 409 / `DISCOVERY_NOT_ALLOWED_WHILE_RECORDING` / 93. §7: `CAPTURE_DISCOVERY_DURING_RECORDING_ENABLED` \| `false` \| boolean. :457: "93 is allowed in every open state except `RECORDING` until the lift; 94 and 97 are allowed while a session is open" | D86 C-4 | **P** — `DISCOVERY_NOT_ALLOWED_WHILE_RECORDING` |
| **FX-03-06** | open point | must-fix-before-implementation | 132, 136, 142 | `masterplan/03_api_contract.md` :409 (op 93 request cell), :447, :479, :411 (op 95), :421 (`adapter`) | (in development mode it also lists the loopback development sources) | delete the three statements that a search lists loopback development sources and write once, in "Not an SSRF or port-scan primitive": "A search lists network responders only. `LOCAL_DEVICE` sources are never candidates: they are registered by row 136 (D83 O-8). A candidate with `adapter: FAKE` exists only when the probe reached the fake ONVIF stub through the loopback target injected by test support (`cap` DS-15); a candidate whose host is a loopback address is always `FAKE`, never `ONVIF_RTSP`, and operation 96 refuses to write `ONVIF_RTSP` for a loopback host (SEC35-41 (a))." :411 "optional for `DEVELOPMENT` (loopback fixtures and local devices)" -> "(loopback fixture candidates)". :421 -> "`ONVIF_RTSP` or `FAKE`" | D83 (O-8); SEC35-41 (a); SEC35-27 (6) | **A** — `it also lists the loopback development sources` |
| **FX-03-07** | naming | must-fix-before-implementation | 132 | `masterplan/03_api_contract.md` :426 (`status`) | by `endpointRef` = `onvif_uuid`, else by `host` = the host of `address` (both existing columns; row 122 confirms the key) | by `endpointRef` = `onvif_uuid`, else by the candidate's service address (host, or host and port, as adoption would store it) = the whole stored `address` (`dbc-4` §N.5; D83) | D83 (D-DB-15) | **A** — `` the host of `address` `` |
| **FX-03-08** | naming | must-fix-before-implementation | 132, 136, 141 | `masterplan/03_api_contract.md` :470-471 ("Device shapes"), :455, :481 | The production value names are fixed by row 123 ... row 124 marks the manifest per track from the same value ... Where the adapter kind is recorded is row 122's decision | :470 — "`adapter` is one of five values (`dbc-4` §N.2, `capture_devices.adapter_kind`): `ONVIF_RTSP`, `USB_AUDIO`, `SNMP_POE` (production kinds) and `FAKE`, `LOCAL_DEVICE` (development kinds)". :471 — "`DEVELOPMENT` exactly when `adapter` is `LOCAL_DEVICE` or `FAKE`. The API class has two values; the manifest class of fields 124 / 125 is a different, three-valued set (`PRODUCTION` \| `LOCAL_DEVICE` \| `FAKE`) derived from the same adapter kind by the mapping of `dbc-4` §N.2. Development configuration = capture operation `REAL_DEVELOPMENT` (`DEMS_CAPTURE_DEV_SOURCES=1`), production configuration = `REAL_PRODUCTION` (`cap` §A.1.2)". :455 and :481 — name the column `capture_devices.adapter_kind` | D83 (D-DB-11); D81; D82(e) | **P** — `` `SNMP_POE` (production kinds) `` |
| **FX-03-09** | naming | must-fix-before-implementation | 136 | `masterplan/03_api_contract.md` :478-479 and :552 (76 / 77) | With the development flag off, ops 76 / 77 list **0** `DEVELOPMENT` devices | In `REAL_PRODUCTION` ops 76 / 77 list **0** `DEVELOPMENT` devices ...; in `SIMULATED` the stored kinds are inert and the seeded `FAKE` built-ins are listed as today (D83 O-2; `dbc-4` §N.9) | D83 (O-2) | **P** — `the stored kinds are inert` |
| **FX-03-10** | coverage hole | must-fix-before-implementation | 132 | `masterplan/03_api_contract.md` :410 (op 93 / 94 shapes), :418-430 (`CaptureCandidate`), :496 (simulator) | (no `conflict`, `addressChanged`, `interfaceCount`) | `CaptureDiscoverySearch` gains `interfaceCount: number` (interfaces probed; a count, never a name or an address). `CaptureCandidate` gains `conflict: boolean` (two answers with one endpoint reference from different source addresses, or two endpoint references from one address: every such row is listed and `testable: false`) and `addressChanged: boolean` (`REGISTERED` by endpoint reference while the answering address differs from the stored one). `testable` is `false` also when no announced service address qualifies (`cap` DS-9: `NO_SERVICE_ADDRESS`, `ADDRESS_MISMATCH`) or the service address fails the form rule of SEC35-32 (2). When more than `CAPTURE_DISCOVERY_MAX_CANDIDATES` answered, already-registered matches are kept first, then arrival order. Simulator: `interfaceCount: 0`, `conflict: false`, `addressChanged: false` | D86 (SEC35-28, SEC35-30, SEC35-32) | **P** — `addressChanged` |
| **FX-03-11** | coverage hole | must-fix-before-implementation | 142 | `masterplan/03_api_contract.md` :411 (op 95 request), :412 (op 96), :221 (op 89) | credential?: { username: text 1..255, secret: text 1..1024 } | `username`: 1..255 printable ASCII without `<`, `>`, `&`, `"`, `'`, backslash; `secret`: 1..1024 printable ASCII; anything else is `422 INVALID_INPUT` before any network request (limit of this phase: a camera with a non-ASCII password cannot be tested). The same rule for the body of operation 89 | D86 (SEC35-35) | **P** — `printable ASCII` |
| **FX-03-12** | coverage hole | must-fix-before-implementation | 132, 142 | `masterplan/03_api_contract.md` :817-831 (`CAPTURE_CONNECTION_TESTED`), :838-847 (`CAPTURE_CANDIDATE_ADOPTED`), :803-815 (`CAPTURE_DISCOVERY_SEARCHED`), :1132 (self-gate) | **Never the username, the secret, a URL or the host.** ... 11 + 8 + 8 + 6 keys; none holds a username, secret, URL, address, endpoint reference, MAC or serial | `CAPTURE_CONNECTION_TESTED`: "**Never the username, the secret or a URL.**" plus three optional keys — `host`? and `endpointRef`? (present for `PRODUCTION` candidates only, D86 C-3), `guardTripped`? (boolean; `true` on the failure that trips the lock-out guard). `CAPTURE_CANDIDATE_ADOPTED`: plus `host`? and `endpointRef`? under the same rule. `CAPTURE_DISCOVERY_SEARCHED`: plus `interfaceCount` (number). The key is named `endpointRef`, never `onvifUuid` (a denied key, `0006_stt_config.sql:33`). Self-gate :1132 -> "12 + 11 + 10 + 6 keys; none holds a username, secret, URL, MAC or serial; `host` and `endpointRef` only in the two types above and only for `PRODUCTION` candidates" | D86 C-3; SEC35-46; SEC35-30 | **A** — `a URL or the host.` |
| **FX-03-13** | naming | should-fix | 142 | `masterplan/03_api_contract.md` :97 (§0), :397-400 (access notes) | with one `ACCESS_DENIED` row, **before the body is read** | "`WEB_CONSOLE_SESSION` is a policy fence that keeps the camera credential off the tablet and phone code paths; it is not an authentication factor. The refusal comes before the body is **used**: nothing of the body reaches a log, an audit row or an error" | D86 (SEC35-45) | **P** — `not an authentication factor` |
| **FX-03-14** | coverage hole | must-fix-before-implementation | 142 | `masterplan/03_api_contract.md` :448 ("Connection test: what it does") | authenticate, list the media profiles, check for a usable H.264 profile | append: "Codec and profile are judged from the authenticated ONVIF answer only; the Core opens no RTSP connection in this phase (D82). The pre-authentication calls carry no credential; the credential is attached for `GetProfiles`; the test stops at the first refusal — at most 2 rejected credential-bearing requests per failed test (SEC35-38). The stream address returned by `GetStreamUri` is compared, never stored and never contacted." | D82; D86 C-2; SEC35-32 (4) | **P** — `opens no RTSP connection` |
| **FX-03-15** | coverage hole | should-fix | 142 | `masterplan/03_api_contract.md` :450 ("Credential in memory"), :452 ("Adoption") | is held in the memory of that one request and is gone when its answer is written | :450 append: "It cannot be erased from memory: the guarantee is request-scoped — one request, never serialised, never persisted, never logged, not reachable from any object that outlives the request (SEC35-34)." :452 append: "The re-verification compares the set of profile tokens with the set the passing test read; a difference answers `409 INVALID_STATE` (`CONNECTION_TEST_FAILED`, `details.cause: DEVICE_CHANGED`). No database transaction is open while the network attempt runs (SEC35-47)." | D86 (SEC35-34, SEC35-47) | **P** — `DEVICE_CHANGED` |
| **FX-03-16** | coverage hole | must-fix-before-implementation | 141 (and 137, 138 at M7) | `masterplan/03_api_contract.md` §3 rows 39, 40, 41 (:514-516) — add three rows to §3.1 (:548) | (no `developmentSources`, no `sources` block in this file) | §3.1 new rows — 39 / 40: "`EvidenceItem` gains `developmentSources: boolean \| null` — the copy of `evidence_items.development_sources` (manifest field 126); `null` = not recorded (v1 or pre-`0008` item), never read as production". 41: "the response gains `sources: { ok: boolean, development: boolean, tracks: [{ trackId, deviceId, sourceClass }], audioIntervals: [{ seq, micDeviceId, sourceClass }] }` with the manifest classes `PRODUCTION` \| `LOCAL_DEVICE` \| `FAKE` (`ev` §D.1, V-15); top-level `ok` is unchanged by the value of the mark". The three operations are already in the modified set: the count stays 26 | D81 (row 124 A-2); D83 (OP-125-3) | **P** — `developmentSources` |
| **FX-03-17** | open point | must-fix-before-implementation | 133 | `masterplan/03_api_contract.md` :559-562 (§3.1 closing paragraph), :550 (start rule) | **Not ruled by D80(6) — put to the controller:** the **primary** microphone unreachable while the standby is reachable | "**Ruled (D83):** the selected ACTIVE (primary) microphone unreachable blocks the start (the existing `PRECHECK_BLOCKED` path). No operation switches at pre-check: the operator cancels the session, sets the primary microphone on Devices (operation 80, idle) and starts again." Add the case to the start-rule cell of :550 | D83 (replaces the D81 mic-toggle ruling) | **A** — `Not ruled by D80(6)` |
| **FX-03-18** | coverage hole | must-fix-before-implementation | 66, 71, 139 | `masterplan/03_api_contract.md` :551 (recording start), §4 reason table | no camera connects within the ingest-open window → the session is FAULTED, nothing claims to record, 0 evidence files | append: "A session presents 'recording' only from the first durable fragment; until then it presents 'connecting cameras' (D84) [member: ruling R-1]. `FAULTED` with nothing durable is a failed start: 0 evidence files, 0 evidence items, no interrupted seal; `FAULTED` with a durable fragment goes to the interrupted seal. The ingest-open window is a named setting passed by the launcher (D84). A start is refused before `app.capture.start` — no listener opens, no source row is written — when an assigned device's adapter kind has no opener in this phase (`ONVIF_RTSP`, `USB_AUDIO`): `409 INVALID_STATE` (`SOURCE_KIND_NOT_RECORDABLE`), also reported as a BLOCK item of the pre-check; a mixed session (production and development sources) is refused the same way (D82, D86 C-5)." §4: one new row `INVALID_STATE` / 409 / `SOURCE_KIND_NOT_RECORDABLE` / recording start. Reason values of the delta 15 -> 17 | D84; D86 C-5; D82 | **P** — `SOURCE_KIND_NOT_RECORDABLE` |
| **FX-03-19** | naming | must-fix-before-implementation | 133, 136 | `masterplan/03_api_contract.md` :413 (op 97 `errorCode`), :858 (`CAPTURE_DEVICE_UNREACHABLE.reason`), :460 | errorCode: 'PERMISSION_DENIED'\|'DEVICE_BUSY'\|'DEVICE_NOT_FOUND'\|null | add `OPEN_FAILED` and `HELPER_EXITED` to op 97 `errorCode` and to the audit `reason` / alert `cause` value set (the five helper error names of `cap` §A.6.4 HL-10). :460 append: "Op 97 reports microphones only. A local camera's named cause reaches the clients as `params.cause` of the situation-B alert of a pre-check (§5.4); no other member carries it (OP-125-4, accepted limit)." | cap §A.6.4 HL-10 (more specific); D83 (OP-125-4) | **P** — `OPEN_FAILED` |
| **FX-03-20** | open point | should-fix | 137 | `masterplan/03_api_contract.md` :464 ("Device shapes"), one sentence | (nothing on `credentialSet` for a registered device) | add: "`CaptureDevice` carries no `credentialSet` member in this phase: the runtime role has no SELECT on `capture_device_credentials` (`dbc-4` §N.7); only the answer of operation 96 states it. Recorded gap (OP-125-2)." | dbc-4 §N.7 (more specific); D83 (OP-125-2) | **P** — `OP-125-2` |
| **FX-03-21** | coverage hole | should-fix | 61 | `masterplan/03_api_contract.md` §5.3 (:862), one new row | (no boot row) | new row: "`SYSTEM_BOOT` (existing type) — gains the key `captureOperation`: `SIMULATED` \| `REAL_PRODUCTION` \| `REAL_DEVELOPMENT`; one row per boot (SEC35-41 (b)). No new audit type: the total stays 67." | D86 (SEC35-41 (b)) | **P** — `captureOperation` |
| **FX-03-22** | coverage hole | must-fix-before-implementation | 137, 138, 140 | `masterplan/03_api_contract.md` :464 ("Device shapes") — one member | (no member says that a local device is open) | `CaptureDevice` gains `sourceOpen: boolean` — `true` while the Core holds an open source of a `LOCAL_DEVICE` device (the short pre-check open included); the data behind the "is on" indicator of `ux` §8f (SEC35-44 (4); check `M5-SEC-PRIV-2-W/T/P`). Always `false` for other kinds | D86 (SEC35-44 (4)) | **P** — `sourceOpen` |
| **FX-03-23** | total | cosmetic | — | `masterplan/03_api_contract.md` :1135-1155 (§10.1), :1169 (open items) | (the table has no row for reason values and constants; the eight open items carry no status) | §10.1: add one line "Document counts of the delta after the spec gate: `details.reason` values 15 -> 17; constants 14 -> 17; audit keys 12 + 11 + 10 + 6. The pinned totals above are unchanged: 97 / 36 / 61, 67, 40, 30, 31, 6, 10." :1169: add "**Closed at the spec gate (row 128):** (1) D81; (2) kept, SEC35-47; (3) reconciled; (4) D83; (5) §7 fixed; (6) D86 C-3; (7) D83 — not shown in Simulated client mode; (8) `dbc-4` §N.2." | D81, D83, D86 | **P** — `Closed at the spec gate (row 128)` |
| **FX-04-01** | open point | must-fix-before-implementation | 129 | `masterplan/04_database_contract.md` :1343 (N.10 "Reset guard"), §E.2 (:729-742), :1466 (O-5) | unchanged: keyed on `integrity_source = 'REAL'`. A package sealed in development mode is `REAL` and therefore blocks every later reset | "**changed (D83 O-5, confirmed by the user, D87(3)):** a sealed `REAL` item blocks the reset unless `development_sources IS TRUE` **and** the cross-check passes — its session has exactly four `session_capture_sources` rows and none of a production kind. `NULL` and `false` block. Shape: `SELECT 1 FROM evidence_items WHERE integrity_source = 'REAL' AND sealed_at IS NOT NULL AND development_sources IS NOT TRUE LIMIT 1;` then the cross-check over the exempted items; any mismatch blocks with the item count. The reset states how many development packages it will erase and proceeds only on the existing confirmation (SEC35-42). Owner: row 129 (`M4-SEC-RESET-1`)." Add the same as an erratum paragraph under §E.2; O-5 -> "closed: D83, D87(3)" | D83 (O-5); D87(3); D86 (SEC35-42); D89(c)(d) | **P** — `development_sources IS NOT TRUE` |
| **FX-04-02** | open point | should-fix | 129, 136 | `masterplan/04_database_contract.md` :1026, :1048-1058, :1431, :1446 (D-DB-13 status) | (and operation 96 if row 128 keeps the local camera as a candidate) ... If the controller rules that the ids of row 123 stand ... | :1026 -> "the local-device registration of row 136 only (D83 O-8)". :1048-1058 -> replace the conditional by "**Ruled (D83):** D-DB-13 is accepted; `cap` §A.1.1 is corrected at row 128." :1431 "Conflicts with row 123's device-id column — for row 128" -> "accepted by D83". :1446 "(D-DB-13, pending row 128)" -> "(D-DB-13, accepted D83)" | D83 | **A** — `if row 128 keeps the local camera as a candidate` |
| **FX-04-03** | open point | should-fix | 66, 71 | `masterplan/04_database_contract.md` :1092 (MR-S1) | in the database transaction that persists the transition to `RECORDING` — before the Core asks the supervisor to start capture | keep, and append: "'`RECORDING`' here is the stored state the session takes when the plan is accepted; the clients present it as 'connecting cameras' until the first durable fragment (D84). A failed start leaves the four rows and no evidence item; a reset removes them." New rule MR-S6: "session start re-reads the four rows it wrote and refuses the start when their class is not the class of the running capture operation (SEC35-40 (4))". New static pin in N.12: "every INSERT into `capture_devices` names `adapter_kind` (SEC35-41 (c))" | D84; D86 (SEC35-40, SEC35-41) | **P** — `A failed start leaves the four rows` |
| **FX-04-04** | coverage hole | should-fix | 142 | `masterplan/04_database_contract.md` :1142-1143 (N.5), :1181 (N.6 key list), :1471 (G-2) | per test one `CAPTURE_CONNECTION_TESTED` row with the candidate id and the outcome, never a host | :1142 -> "...and the outcome; `host` and `endpointRef` only for `PRODUCTION` candidates (D86 C-3)". :1143 -> add "and in those two audit types for `PRODUCTION` candidates (the audit table is in the git-ignored cluster)". :1181 -> add the keys `host`, `endpointRef`, `guardTripped`, `interfaceCount`, `captureOperation` to the inspected list with the note "`username`, `password`, `credential`, `secret` and `onvifUuid` are denied keys already (`0006_stt_config.sql:33-34`); `host` and `endpointRef` are not". G-2 -> "closed: D86 C-3" | D86 C-3 | **A** — `and the outcome, never a host` |
| **FX-04-05** | open point | must-fix-before-implementation | 71, 82, 83 | `masterplan/04_database_contract.md` :337 (§B.5) | `from_media_ms`/`to_media_ms` are **media-pts domain** | append: "Origin: FILE (media) time of the sealed file — file time 0 = T0 − 1024/48000 s (`CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES`), the same origin as the fragment times and as the chunk offsets of row 77 (D81)." | D81; D72(d) | **P** — `CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES` |
| **FX-04-06** | open point | cosmetic | — | `masterplan/04_database_contract.md` :1150-1154, :1332, :1455 (N.15 heading), one status line | For row 128. ... to be widened at row 128 (N.15 O-2) | add under the N.15 heading: "**Status after the spec gate (row 128):** O-1 closed (D83, D-DB-13 accepted); O-2 closed (`cap` §A.1.2 row 1 widened); O-3 stated to the user (D82); O-4 closed (D83, D-DB-15; C3 §2.6 corrected); O-5 closed (D83, D87(3)); O-6 closed (D83, D-DB-17; blueprint wording); O-7 the controller picks the moment (D83); O-8 closed (D83: registration by row 136); F-122-2 -> row 84." | D82, D83, D87 | **P** — `Status after the spec gate (row 128)` |
| **FX-05-01** | naming | must-fix-before-implementation | 134, 135, 136 | `masterplan/05_capture_architecture_spec.md` :166-171 (slot table), :690, :732, :781, :808 | \| Camera 1 \| `CAM-01` -> `VIDEO-01` \| `LOCAL_DEVICE` \| ... \| Mic 1 (primary) \| `MIC-01` \| `LOCAL_DEVICE` | Camera 1: "the local camera's own row — the next free `CAM-NN` (`CAM-03` on a fresh seed) -> `VIDEO-01`"; Camera 2: `CAM-02` (`FAKE`) unchanged; Mic 1: "the local microphone's own row — the next free `MIC-NN` (`MIC-03` on a fresh seed)"; Mic 2: `MIC-02` (`FAKE`) unchanged. Add under the table: "The seeded built-ins `CAM-01`, `CAM-02`, `MIC-01`, `MIC-02` stay `FAKE`; the adapter kind of a row never changes; row 136 registers the two local rows and development mode assigns them in the selector (D83, D-DB-13)." At :690, :732 "naming `CAM-01`" and :808 "naming `MIC-01`" -> "naming the local device's id"; :781 comment -> "the device id of the microphone row" | D83 (D-DB-13) | **A** — `` \| Camera 1 \| `CAM-01` -> `VIDEO-01` \| `LOCAL_DEVICE` `` |
| **FX-05-02** | naming | must-fix-before-implementation | 61, 136 (and safe boot after 130) | `masterplan/05_capture_architecture_spec.md` :203 (§A.1.2 row 1) | none, or production kinds (inert) | any — every stored kind is inert in `SIMULATED` (after set 4 the four development databases hold four assigned `FAKE` devices and must keep booting; `dbc-4` §N.9; D83 O-2) | D83 (O-2) | **A** — `none, or production kinds (inert)` |
| **FX-05-03** | coverage hole | must-fix-before-implementation | 66, 71, 136 | `masterplan/05_capture_architecture_spec.md` :204 (§A.1.2 row 2), :156 (RG-1) | on this Mac nothing is recordable until a real camera is adopted | :204 -> "in this phase nothing is recordable in `REAL_PRODUCTION`: the search, the connection test, adoption and assignment are available, but no listener opens and no session starts for a source kind without an opener (`ONVIF_RTSP`, `USB_AUDIO` today) — the plan builder refuses with `SOURCE_KIND_NOT_RECORDABLE` before `app.capture.start`; no all-`PRODUCTION` package can be sealed (D82, D86 C-5; the pull path is class C-2)". :156 RG-1 append: "The registry states which kinds have an opener. The class of a candidate is decided by how it was found: one reached through the injected loopback target, or whose host is a loopback address, is `FAKE` (SEC35-41 (a))." | D86 C-5; D82; SEC35-40; SEC35-41 | **A** — `nothing is recordable until a real camera is adopted` |
| **FX-05-04** | coverage hole | must-fix-before-implementation | 131 | `masterplan/05_capture_architecture_spec.md` :493-494 (failure modes), :480 (DS-8) | de-duplicated by endpoint reference, the first source address is kept | "two answers with one endpoint reference from the **same** source address are one candidate; from **different** source addresses both are listed with `conflict: true` and neither is testable (the same when two endpoint references come from one address)". DS-8 append: "an answer whose source is an address of this host, the network or broadcast address of the probed interface, or a multicast or unspecified address is dropped and counted; one answer per source address per search (a second is counted, not listed); the 64-responder cap keeps already-registered matches first, then arrival order; when the 256-datagram cap is reached the socket is closed at once; a registered match whose address differs from the stored one is marked `addressChanged`; the result carries the number of interfaces probed" | D86 (SEC35-28, SEC35-30) | **A** — `source address is kept` |
| **FX-05-21** | constant | must-fix-before-implementation | 131 | `masterplan/05_capture_architecture_spec.md` :480 (DS-8) | a non-empty endpoint reference of <= 256 characters | a non-empty endpoint reference of <= 120 characters (the cap of `endpointRef` in C3 §2.6; a valid ONVIF reference is `urn:uuid:` plus 36 characters) | C3 §2.6 `endpointRef: string 1..120` (more specific for the returned shape) | **A** — `endpoint reference of <= 256 characters` |
| **FX-05-05** | coverage hole | must-fix-before-implementation | 131 | `masterplan/05_capture_architecture_spec.md` :529-533 (§A.6.1a, parser paragraph), :1379 (H-14) | **hypothesis H-14:** it rejects entity-expansion input in bounded time | add rule DS-16: "the whole datagram handler is one `try` / `catch` that counts and drops; parser options pinned in the one file — `strict: true`, `explicitArray: true`, `async: false`, no value or attribute processor; the parsed answer is read by fixed paths only (no recursive walk, no serialisation, no clone, never handed to a logger); the 16 KiB cap applies to the byte length before any text is made; a datagram containing `<!DOCTYPE` or `<!ENTITY` is dropped before parsing; bound per search 256 datagrams x 16 KiB; a stored candidate is at most 2 KiB (hint lists capped at 8 entries of 120 characters); device text is sanitised before a candidate exists (control, direction-override and zero-width characters removed, 120 characters; SEC35-48); the socket type literal is `udp4`". H-14 -> "measured on `xml2js` 0.6.0 by row 126 (`sec` §11.1 (b)): entity expansion and prototype pollution are resisted; the risk is our own code in the parse callback. Row 131 repeats the measurement on the pinned version." | D86 (SEC35-29, SEC35-48, SEC35-30) | **P** — `explicitArray: true` |
| **FX-05-06** | naming | must-fix-before-implementation | 142 | `masterplan/05_capture_architecture_spec.md` :556 (§A.6.2 step 6), :605 (CR-6) | \| 6 Persist the credential \| operator action through **operation 89** \| | step 6 -> "6 Persist the credential \| part of step 5: operation 96 carries the credential in its body and stores it in the adoption transaction through the operation-89 write path (D81) \| none \| none \| available once row 84's sealer exists; until then `503 CREDENTIAL_STORE_NOT_READY` ..." (rest of the cell unchanged). CR-6 -> "Not by the test. A credential is stored by operation 96 at adoption (the operation-89 write path) and replaced later by operation 89; available after row 84. No second store, no interim file" | D81 | **A** — `operator action through **operation 89**` |
| **FX-05-07** | coverage hole | must-fix-before-implementation | 142 | `masterplan/05_capture_architecture_spec.md` :571-575 (outcomes), :581 (CT-1), :582 (CT-2), :589-594 (gap paragraph) | + RTSP `DESCRIBE` ... and RTSP `OPTIONS` / `DESCRIBE` ... **Gap for the controller.** The RTSP `DESCRIBE` needs a TCP client in the Core | remove every RTSP half: `UNREACHABLE` = refused or timed-out TCP connection to the service address, or no HTTP answer to `GetSystemDateAndTime` ("<= 1 HTTP attempt"); `AUTHENTICATION_FAILED` without the RTSP clause; `NOT_H264` = "a usable profile exists but no profile's video encoder is H.264 (ONVIF answer)", requests "(none further)"; `REACHABLE` = "authenticated; an H.264 profile; `GetStreamUri` names the candidate's own address" (drop `NO_PARAMETER_SETS_IN_SDP`). CT-1: delete "and RTSP `OPTIONS` / `DESCRIBE`". CT-2 -> "**No RTSP.** The Core opens no RTSP connection in this phase; codec and profile are judged from the authenticated ONVIF answer; the stream address is compared, never stored, never contacted. An RTSP-level test belongs with the pull path (class C-2)." Gap paragraph -> "**Ruled (D82):** no hand-written RTSP client; `rtsp-describe.ts` is not created." | D82; SEC35-27 (4); SEC35-32 (4) | **A** — `` + RTSP `DESCRIBE` `` |
| **FX-05-08** | constant | must-fix-before-implementation | 142 | `masterplan/05_capture_architecture_spec.md` :584 (CT-4), :585 (CT-5) | (proposal: 3 per 10 minutes per candidate; constants by rows 121 / 126) | CT-5 -> "one test at a time per Core; lock-out guard `CAPTURE_CONNECTION_TEST_MAX_FAILURES` = 2 `AUTHENTICATION_FAILED` per host in `CAPTURE_CONNECTION_TEST_FAILURE_WINDOW_MS` = 30 minutes, counted per Core by host (D86 C-2); at most 2 rejected credential-bearing requests per failed test: the pre-authentication calls run on a client object built without a credential (SEC35-38)". CT-4 append: "the 15 s whole-test bound is `CAPTURE_CONNECTION_TEST_TIMEOUT_MS`, enforced by destroying the per-test agent; received bytes are capped at 1 MiB per test (SEC35-33)" | D86 C-2; D86 C-8 | **A** — `3 per 10 minutes per candidate` |
| **FX-05-09** | coverage hole | must-fix-before-implementation | 142 | `masterplan/05_capture_architecture_spec.md` :601-602 (CR-2, CR-3), :604 (CR-5) | `secret.fill(0)` in a `finally` of the route | CR-2 -> "`CameraCredential { username: string; secret: string }` — the package needs a string". CR-3 -> "No zeroing is claimed. The credential is request-scoped on the Core: one request, never serialised, never persisted, never logged, not reachable from any object that outlives the request. It cannot be erased from memory; it stays until the garbage collector frees it. The Core is not started with heap-snapshot or diagnostic-report options in any documented command." CR-5 -> "Only as a digest toward the device service (WS-Security `PasswordDigest` or HTTP Digest): not readable in transit, but the receiving device can test guesses against it, and the account name travels in clear (accepted on the development network, D87(2))" | D86 (SEC35-34, SEC35-31); D87(2) | **A** — `secret.fill(0)` |
| **FX-05-10** | coverage hole | must-fix-before-implementation | 60, 142 | `masterplan/05_capture_architecture_spec.md` :865 (§A.8.1 ST-4) | \| ST-4 \| An RTSP responder that answers `OPTIONS` / `DESCRIBE` only ... | "\| ST-4 \| **removed (D82)** — the stub has no RTSP responder; any RTSP connection from the Core is recorded as a violation by ST-5 \| — \|" | D82 | **A** — `An RTSP responder that answers` |
| **FX-05-11** | coverage hole | must-fix-before-implementation | 142, 131 | `masterplan/05_capture_architecture_spec.md` :1254 (G-R10), :1255 (G-R11), :1253 (G-R9) | `node:net` is imported by **exactly one** file under `src/capture/**`, `adapters/camera/rtsp-describe.ts` | G-R10 -> "no file under `src/capture/**` imports `node:net`; `node:http` / `node:https` are imported only in `adapters/camera/onvif-session.ts` and only for the name `Agent`; no `node:tls`, `node:http2` (D82; SEC35-27)". G-R11 append: "imported as `onvif/lib/cam` so that `lib/discovery.js` is never loaded; the client object never leaves the file — it exports a facade with the five reads (SEC35-33 (5))". G-R9 append: "the server-wide network guard exempts `dgram` in this file only, pinned by name, with a planted-violation control (SEC35-27)" | D82; D86 (SEC35-27, SEC35-33) | **A** — `` `adapters/camera/rtsp-describe.ts`; it contains `` |
| **FX-05-12** | constant | should-fix | 132 | `masterplan/05_capture_architecture_spec.md` :483 (DS-11), :479 (DS-7) | Minimum 5 s between two searches per Core (proposed; rows 121 / 126 fix the constants) | DS-11 -> "limits by name from C3 §7: single-flight per Core; 5 s between starts per Core and 10 s per operator session; 6 per minute per Core; 30 per hour per operator session; the pre-check search has its own allowance". DS-7 -> "(contract constant `CAPTURE_DISCOVERY_WINDOW_MS` = 3,000 ms, C3 §7; accepted D82(c))" | D86 C-8; D82(c) | **A** — `Minimum 5 s between two searches per Core (proposed` |
| **FX-05-13** | coverage hole | should-fix | 71 | `masterplan/05_capture_architecture_spec.md` :697-699 and :720-726 (§A.6.5) | The ingest-open window is the worker's listen timeout (`--listen-timeout-s`, default 15 s | append: "It is a named setting passed by the launcher (row 71; default 15 s). `FAULTED` with `durable: false` (`NO_CAMERA_CONNECTED` included) is a failed start with no evidence item; `FAULTED` with `durable: true` goes to the interrupted seal; a session presents 'recording' only from the first `FIRST_DURABLE_FRAGMENT` (D84)." | D84 | **P** — `named setting passed by the launcher` |
| **FX-05-14** | open point | must-fix-before-implementation | — | `masterplan/05_capture_architecture_spec.md` :1199 (§F "Video anchoring and drift", last sentence) | any correction moves video timestamps only and never resamples the evidentiary audio | keep the cell and append: "**Superseded in part (D72(j), D85):** every microphone passes through libswresample continuously (rate compensation to the Core clock, within ±5,000 ppm; D58-14). The clause 'never resamples the evidentiary audio' no longer holds; video corrections still move video timestamps only." | D85; D72(j) | **P** — `libswresample` |
| **FX-05-15** | open point | should-fix | 136 | `masterplan/05_capture_architecture_spec.md` :1295, :1311-1314, :1320, :1351-1353 (§I) | row 58 (not landed) | edits 7-10 -> "landed by row 58 (`apps/core-server/src/config.ts:43-44`, `:177-181`, `:263-267`, `:294-312`; `implementation/20_m3_worker_engine.md` §5.1)"; the count line -> "P25 edit count: 14, all landed"; delete the "Note for the reader" of :1351-1353; planned edits 15-18: add "the waiver is recorded when row 136 lands them (D82(e))" | D82 (routed); D82(e) | **A** — `row 58 (not landed)` |
| **FX-05-16** | coverage hole | should-fix | 142, 133 | `masterplan/05_capture_architecture_spec.md` §J (:1386, after H-21) | (H-22..H-26 exist only in `sec` §11.11) | add rows H-22..H-26 as written in `09_security_design_review.md:710-714`, and H-27: "enumerating local inputs (operation 97) while a session records does not disturb the capture — not measured; falsified by `M4-MIC-RESCAN-1` run against a fake-worker `RECORDING` session (then operation 97 answers `409` during `RECORDING`)" | D86 (sec §11.11); record 121 §5 (unanswered hand-over) | **P** — `\| H-22 \|` |
| **FX-05-17** | coverage hole | must-fix-before-implementation | 134, 135 | `masterplan/05_capture_architecture_spec.md` :660 (device selection), :689 (HL-10), :802 (ML-1), :211 (row 9), :687 (HL-8), :803 (ML-2) | by **exact name** `MacBook Air Camera`, audio `none`; never by index | add to HL-10 / ML-1: "the device list is read before every open and the helper is started only when exactly one listed entry equals the name (string equality); no argument table contains a screen-capture name or option". Row 9 / HL-2: "the helper program path is resolved; its owner must be root or the Core's user and no directory on the way may be group- or other-writable". ML-2: "both ids are checked against their strict patterns before the pipe path is built and the resolved path must stay under the run directory". HL-8: "at boot in development mode the Core looks for helper processes of an earlier run by the exact program path and refuses to start capture until none is left; it kills nothing it did not start" | D86 (SEC35-43) | **P** — `exactly one listed entry equals` |
| **FX-05-18** | coverage hole | must-fix-before-implementation | 134, 135, 140 | `masterplan/05_capture_architecture_spec.md` :693 (HL-14 Privacy) | no frame or audio excerpt in `docs/` (D80(11); R-11 AC-8) | -> "no still, no audio excerpt, no waveform or spectrogram, no transcript text and no playback screenshot from a local-device session in `docs/`; no agent opens such media with a viewing tool — checks are numeric and local (D86 C-7); test recordings of rows 134, 135 and 140 are at most 10 s; they are deleted only on the user's instruction (D87(5)); while a `LOCAL_DEVICE` source is open the Core reports it (`sourceOpen`) for the 'is on' indicator of the clients (SEC35-44 (4))" | D86 C-7; D87(4)(5); SEC35-44 | **P** — `only on the user's instruction` |
| **FX-05-19** | naming | should-fix | 132 | `masterplan/05_capture_architecture_spec.md` :482 (DS-10), :139-140 | Names are proposals of this row; row 122 fixes the stored spelling and the column, row 124 the manifest value | :139-140 -> "The five kinds are fixed by `dbc-4` §N.2 (D83). `CaptureSourceClass` is the API class (two values); the manifest class has three values (`ev` §B.12)." DS-10 append: "API shape (C3 §2.6 `CaptureCandidate`): `sourceAddress` -> `host`; `connectable` -> `testable`; `nameHint` -> `name`; `hardwareHint` -> `model`; `vendorHint` -> `vendor` (null unless a non-standard scope states it). `serviceAddress`, `types`, `profileHints`, `locationHints`, `macHint` and `serialHint` are not returned by operation 94." | D83; C3 §2.6 | **P** — `` `sourceAddress` -> `host` `` |
| **FX-05-20** | open point | should-fix | 137, 138 | `masterplan/05_capture_architecture_spec.md` :487 (DS-15), append | the target `{ address, port }` is a constructor argument that only the fake registry may set | append: "A booted lane Core used by client checks is started by a test-support launcher (under `apps/core-server/test/support/`) that builds the app with the fake adapter registry and passes the loopback target; no file under `src/` passes it (SEC35-27 (6); G-27)." | cap DS-15 + SEC35-27 (6) (more specific) | **P** — `test-support launcher` |
| **FX-06-01** | naming | must-fix-before-implementation | 141 | `masterplan/06_evidence_package_spec.md` :488-491 (§B.12 "Dependency on row 121") | If row 121 shows a source class on a device shape, it must use these three names. | "**Reconciled at row 128:** the API device shapes carry a two-valued class `PRODUCTION` \| `DEVELOPMENT` (C3 §2.6) and the manifest keeps its three values; both derive from `capture_devices.adapter_kind` by the mapping of `dbc-4` §N.2 (`ONVIF_RTSP`, `USB_AUDIO`, `SNMP_POE` -> `PRODUCTION`; `FAKE` -> `FAKE`; `LOCAL_DEVICE` -> `LOCAL_DEVICE`). The `sources` block of operation 41 uses the manifest values." | D81; D83 (D-DB-11) | **A** — `it must use these three` |
| **FX-06-02** | open point | must-fix-before-implementation | 82, 83 | `masterplan/06_evidence_package_spec.md` :529-534 (§B.12 "Media-time origin") | **Open, not decided by this row:** which origin each `…Ms` media-time field uses | "**Decided (D81):** `audio.sourceIntervals[].fromMs` / `toMs` (fields 58-59; `session_audio_intervals.from_media_ms` / `to_media_ms`) count in FILE (media) time of the sealed file — the origin of fields 66-67 and of row 77's chunk offsets. A value measured from T0 is converted by adding 1024/48000 s." | D81 | **A** — `**Open, not decided` |
| **FX-06-03** | coverage hole | must-fix-before-implementation | 141 | `masterplan/06_evidence_package_spec.md` :867-872 (§H.5) | "Production configuration" has no written definition yet ... `false` is possible here only when every recorded source is a real network device adopted through the R-9 connect flow | add a row "The case the first three guards did not cover": "the worker's loopback ingest is unauthenticated; in `REAL_PRODUCTION` a local process could push into an open listener and be signed as `PRODUCTION` (SEC35-40). Guard (4): **the Core itself opened the source** — no listener opens and no session starts for a source kind without an opener (D86 C-5)". "Open with the fence" -> "Defined: a production configuration has at least one assigned device of source class `PRODUCTION`, or a listener outside loopback (`cap` §A.1.2)". "On this computer" -> "In this phase `developmentSources = false` cannot occur: no all-`PRODUCTION` package can be sealed (D86 C-5); check `M7-SEC-SRC-2`" | D86 C-5; SEC35-40; cap §A.1.2 | **A** — `has no written definition yet` |
| **FX-06-04** | coverage hole | must-fix-before-implementation | 82, 86 | `masterplan/06_evidence_package_spec.md` :703 (§E.4 "Trigger") | the worker/supervisor dies during RECORDING and cannot restart within the back-off budget | append: "**and at least one durable fragment exists** (`durable: true`). A session that ends `FAULTED` with nothing durable is a failed start: no seal runs and no evidence item exists (D84)." | D84; D89(b) | **P** — `failed start` |
| **FX-06-05** | open point | should-fix | 83, 141 | `masterplan/06_evidence_package_spec.md` :439 (§B.12 status), :733 (§E.6 "Input"), :643 (§D.1) | Built by row 141 (fields 124-126 and verify V-15) and row 83 (fields 127-128) ... Where that record lives is for row 122 | :439 -> "Row 83 builds fields 124-128 from its first build (D81); row 141 adds the exhaustive kind -> class mapping check, V-15, the report lines, the `sources` block of operation 41 and the `developmentSources` member of operations 39 / 40." :733 -> "the INSERT-only table `session_capture_sources` (T-41, `dbc-4` §N.3)". :643 -> "carried in C3 §3.1 under these names (row 128)" | D81; D83 (D-DB-14) | **A** — `Where that record lives is for row 122` |
| **FX-08-01** | total | must-fix-before-implementation | 137, 138 | `masterplan/08_client_ux_spec.md` :1099, :1106-1113, :1120, :1194, :1202-1205, :1253-1254, :1284-1285, :1525, :1553, §14.2 key `common.captureNotice.start.useOther` | 6 (G13-G18, flows 9-13) = **18/18** ... = **46** | G18 is removed (D83). :1099 -> "**Blocked.** 'MIC 1 (MIC-01) is the active microphone and is not reachable. Cancel this session, make MIC 2 the primary microphone on Devices, then start again.' No control switches the microphone at pre-check". :1106-1113 -> "**Ruled (D83):** no operation and no control G18; the row is drawn with the blocked sentence above." Delete the G18 rows of :1120 and :1194 and the key `common.captureNotice.start.useOther`; `…start.activeMicrophone` takes the sentence above. Arithmetic: controls 10 + 2 + 5 (G13-G17) = **17/17**; client instances 30 + 2 + 11 (G13: 3, G14: 3, G15: 1, G16: 1, G17: 3) = **43**; gated reads 8/8 unchanged. :1253 drop "(one control, G18, has no operation yet — OP-125-1)"; :1525 "G13-G18" -> "G13-G17"; :1553 -> the text of `10_test_strategy.md:352` | D83 (OP-125-1) | **A** — `6 (G13-G18` |
| **FX-08-02** | coverage hole | must-fix-before-implementation | 137 | `masterplan/08_client_ux_spec.md` :806 (§8d.3), :1507 (§14.3), :1569 (OP-125-6) | This phase also has **no** reveal toggle for the value being typed | "A reveal control for the value being typed is allowed (D86 C-1): off by default; back to hidden on blur, on submit and on close; never for a stored value (none exists); never on in a gate capture." §14.3 password row: "`type=\"password\"` with a reveal button that has an accessible name and state". OP-125-6 -> "closed: D86 C-1" | D86 C-1 | **A** — `**no** reveal toggle` |
| **FX-08-03** | constant | must-fix-before-implementation | 137 | `masterplan/08_client_ux_spec.md` :655, :1548, :1569 | a guard of 3 failures per camera ... three refused passwords | "a guard of 2 failures per camera in 30 minutes" (:655, :1569); `M4-CONN-GUARD-W` (:1548) -> "two refused passwords: ..." as `10_test_strategy.md:347` | D86 C-2 | **A** — `three refused passwords` |
| **FX-08-04** | naming | must-fix-before-implementation | 137, 138 | `masterplan/08_client_ux_spec.md` :1039-1043 (§8f.3 "Simulated mode"), :1570 (OP-125-7) | so in Simulated mode every device, tile and demo package carries the badge. This is kept | "**Simulated client mode (D83):** the badge is NOT shown on devices and demo items — the mode banner says it; the mark stays in the manifest and in the verify result." OP-125-7 -> "closed: (a) 'Core Mac's camera / microphone' on tablet and phone accepted (D83); (b) overruled (D83)" | D83 | **A** — `package carries the badge. This is kept` |
| **FX-08-05** | open point | should-fix | 137, 138 | `masterplan/08_client_ux_spec.md` :728 (§8c.3 "Development source") | ("This Mac's camera" for `LOCAL_DEVICE`, "Test source" for `FAKE`) | "the kind text 'Test source' (`adapter: FAKE`)" and add "A `LOCAL_DEVICE` source is never a candidate: it is a registered device row (D83 O-8); the group appears only when operation 94 lists a `FAKE` candidate" | D83 (O-8) | **A** — `` ("This Mac's camera" for `LOCAL_DEVICE`, "Test source" for `FAKE`) `` |
| **FX-08-06** | coverage hole | must-fix-before-implementation | 137 | `masterplan/08_client_ux_spec.md` :797 (§8d.2 "Surface"), :804-805 (§8d.3), §8c.2 (S3, S4, S7), §8c.3 | (no confirmation step, no conflict rows, no network count) | §8d.2: the dialog header also shows the hardware hint and "This device has not been verified. Its name and model are what it announced."; **Test connection is enabled only after the operator ticks "I have checked that {{address}} is this camera"**. §8d.3 description gains "Sent as a digest: not readable in transit, but a device that receives it can test guesses against it. Use a password that is used for this camera only."; fields gain neutral `name` / `id`, `spellcheck=\"false\"`, `autocapitalize=\"off\"`, `autocorrect=\"off\"`, no native form submission; a field message for the accepted characters. §8c.3: a row with `conflict: true` reads "Two devices announce the same identity. Neither can be connected."; `addressChanged: true` reads "This camera now answers from another address than the registered one."; S4 summary gains "Searched {{count}} network(s)." (`interfaceCount`); S7 is drawn as a warning | D86 (SEC35-28, 30, 31, 35, 37); D87(2) | **P** — `I have checked that` |
| **FX-08-07** | coverage hole | must-fix-before-implementation | 137, 138, 140 | `masterplan/08_client_ux_spec.md` §8f (after :1031), one rule | (no indicator that a local device is open) | "**'Is on' indicator (SEC35-44 (4)).** Whenever a `LOCAL_DEVICE` camera or microphone is open (`sourceOpen: true`; the short pre-check open included) every client shows a fixed, non-dismissable state: 'This Mac's microphone is on' / 'This Mac's camera is on' on the web console, 'Core Mac's …' on tablet and phone. Checks `M5-SEC-PRIV-2-W/T/P`." | D86 (SEC35-44 (4)); D89(c) | **P** — `microphone is on` |
| **FX-08-08** | coverage hole | must-fix-before-implementation | 71, 139, 137, 138 | `masterplan/08_client_ux_spec.md` §8e.2 (:928, situation C) and flow 7 (:576), :1568 (OP-125-5) | (no state between the start and the first durable fragment) | add: "Between the accepted start and the first durable fragment Session Monitor (WB-01) and Session Live (MB-03) read **'Connecting cameras…'** — no recording timer, no recording indicator, no meter presented as recording; 'Recording' appears only from the first durable fragment (D84) [member: ruling R-1]." OP-125-5 -> "closed (D84): after situation C with nothing durable there is no Recovery hand-off — the fault presentation, then the idle state; no evidence item is shown" | D84; D82(f) | **P** — `Connecting cameras` |
| **FX-08-09** | coverage hole | must-fix-before-implementation | 137, 138 | `masterplan/08_client_ux_spec.md` §8c.2 (after S13, :712), :1189 (G13), :929 | G13 ... `CAPTURE_CONFIG`; any session state | new state S14: "Search not available while recording — op 93 `409 INVALID_STATE` (`DISCOVERY_NOT_ALLOWED_WHILE_RECORDING`), or the session state is `RECORDING` before the lift: the Search button is disabled with 'Camera search is not available while a session is recording.' (drawn from the session state; never a toast)". G13 condition -> "`CAPTURE_CONFIG`; any session state except `RECORDING` until the lift of D86 C-4". :929 (C, degraded) action -> "Search again (G13) — disabled with the S14 sentence while the session records, until the lift". States of flow 9: 13 -> 14 | D86 C-4 | **P** — `DISCOVERY_NOT_ALLOWED_WHILE_RECORDING` |
| **FX-08-10** | naming | should-fix | 137, 138, 136 | `masterplan/08_client_ux_spec.md` :1020-1025 (§8f.3 states), §8g.3 (:1094) | (four states: Ready, Permission needed, Busy, Not connected) | fifth state: "Could not be opened \| `OPEN_FAILED` or `HELPER_EXITED` \| chip 'Could not be opened' (warning) \| 'This Mac's camera (microphone) could not be opened. Check its permission on the Mac that runs the Core, then search again.' \| Search again". §8g.3 new row: "An assigned device of a kind that cannot be recorded in this phase \| that row BLOCK \| Blocked \| '{{device}} cannot be recorded by this version of the system.' (`SOURCE_KIND_NOT_RECORDABLE`)". Add to §14.1: "development configuration = capture operation `REAL_DEVELOPMENT`; production configuration = `REAL_PRODUCTION`" | cap HL-10 (more specific); D86 C-5; D82(e) | **P** — `REAL_DEVELOPMENT` |
| **FX-08-11** | total | must-fix-before-implementation | 137, 138 | `masterplan/08_client_ux_spec.md` :1288 (§13.1 keys row), §14.2 | Proposed i18n keys (§14.2) \| — \| — \| 120 \| **120** | §14.2: remove 1 key (`common.captureNotice.start.useOther`) and add the 18 keys of section 2.3 of this gate. §13.1 row -> "120 − 1 + 18 = **137**" (re-count by the row's own rule: table rows starting with `\| \`common.`) | D83; D84; D86 | **P** — `**137**` |
| **FX-08-12** | open point | cosmetic | — | `masterplan/08_client_ux_spec.md` :1560 (§15.3 heading), one status line | (open items without a status) | add: "**Closed at the spec gate (row 128):** OP-125-1 (D83: no operation, no G18); OP-125-2 (not carried in this phase, C3 §2.6); OP-125-3 (carried, C3 §3.1); OP-125-4 (accepted limit: the situation-B alert only); OP-125-5 (D84); OP-125-6 (D86 C-1); OP-125-7 (D83)." | D83, D84, D86 | **P** — `Closed at the spec gate (row 128)` |
| **FX-09-01** | constant | should-fix | 142 | `masterplan/09_security_design_review.md` :672 (SEC35-46, check cell) | three failures -> three rows, the third with `guardTripped: true`; a fourth attempt -> 429 and no row | two failures -> two rows, the second with `guardTripped: true`; a third attempt -> 429 and no row | D86 C-2 (the finding's own SEC35-38) | **A** — `three failures -> three rows` |
| **FX-09-02** | open point | must-fix-before-implementation | 129 | `masterplan/09_security_design_review.md` :605 (SEC35-36 mitigation (3) and owner cell), :693 (§11.10 row 13) | The next swap of the two forbidden-key CHECKs adds `username`, `password`, `credential` | "(3) No CHECK swap is needed: `username`, `password`, `credential` and `secret` are already among the 28 denied top-level keys of `audit_log.details` and `events.params` (`apps/core-server/src/db/migrations/0006_stt_config.sql:33-34`). `host` and `endpointRef` are not denied and are used per C-3; the audit key is never named `onvifUuid` (denied)." Owner cell -> "142 (1, 2, 4)". §11.10 row 13: delete "the forbidden-key additions for the next set" | code fact: 0006_stt_config.sql:33-34; D86 C-3, C-6 | **P** — `0006_stt_config.sql:33` |
| **FX-09-03** | open point | should-fix | 140, 66 | `masterplan/09_security_design_review.md` :638 (SEC35-40, check cell) | `REAL_PRODUCTION` with an adopted fixture camera assigned | `REAL_PRODUCTION` with a registered `ONVIF_RTSP` device row placed by the test set-up and assigned (a loopback candidate is never `ONVIF_RTSP`, SEC35-41 (a)) | consistency inside D86 (SEC35-41 (a)) | **A** — `with an adopted fixture camera assigned` |
| **FX-09-04** | open point | cosmetic | — | `masterplan/09_security_design_review.md` :716 (§11.12), one status line | (U-1..U-4 and C-1..C-8 listed as questions) | add: "**Answered by the user (D87):** U-1 accepted (plain-HTTP exposure on the known development network; the dialog still shows the target address); U-2 confirmed; U-3 no sync — the residual is the user's accepted risk; U-4 recordings are deleted only on the user's instruction. **Recorded by the controller (D86):** C-1..C-8 accepted." | D87; D86 | **P** — `Answered by the user (D87)` |
| **FX-10-01** | total | must-fix-before-implementation | 86 | `masterplan/10_test_strategy.md` :841, :846-852 (§F.1), :872 (§F.2 row label), A.7 assertions of the P1 cells | **Erratum PE-127-12 ... — open point, not decided here.** | "**Ruled (D89(b), following D84):** a kill in phase P1 is a failed start. Expectation of `M7-KM-P1-0`, `M7-KM-P1-S1`..`S6` and of the two conditional P1 cells: after the kill and the next boot the session is closed as a failed start — 0 evidence items, 0 `sealing_jobs` rows for the session, 0 files under a final name, no interrupted seal; no step S1..S8 is entered for that session (the Sx cell asserts that recovery never reaches step Sx); the four `session_capture_sources` rows remain. 'Final hashes equal an uninterrupted run' does not apply to P1. Cell IDs and the counts of section K are unchanged (7 active + 2 conditional cells)." :872 label "P1 interrupted" -> "P1 failed start (D84)" | D89(b); D84 | **A** — `open point, not decided here` |
| **FX-10-02** | open point | should-fix | — | `masterplan/10_test_strategy.md` :496 (G-23), :507 (G-34), §A.4a.11 heading (:466) | **U-2, not yet confirmed by the user** | G-23 -> "U-2 confirmed by the user (D87(3))"; G-34 "not decided here" -> "ruled D89(b)"; under the §A.4a.11 heading add: "**Resolved at the spec gate (row 128):** G-1..G-34 are closed by `gateway_check/27_r9_r11_spec_gate.md` §7.4; the values the checks assume stand, with intermediate pins per row (132: 94 / 36 / 58; 133: 95 / 36 / 59; 142: 97 / 36 / 61)." | D87(3); D89(b)(c) | **A** — `not yet confirmed by the user` |
| **FX-10-03** | open point | should-fix | 140 | `masterplan/10_test_strategy.md` :369 (`M5-SEC-SRC-1`) | in `REAL_PRODUCTION` with an adopted fixture camera assigned | in `REAL_PRODUCTION` with a registered `ONVIF_RTSP` device row placed by the test set-up and assigned | consistency with `M4-SEC-FENCE-1` (10:320) and SEC35-41 (a) | **A** — `with an adopted fixture camera assigned` |
| **FX-10-04** | open point | must-fix-before-implementation | 137, 138 | `masterplan/10_test_strategy.md` :236 (CR-5) | The lane Core runs with the fake ONVIF stub on loopback | append: "It is started by a test-support launcher (under `apps/core-server/test/support/`) that builds the app with the fake adapter registry and passes the loopback probe target as a constructor argument — no environment variable, no configuration key, no file under `src/` (`cap` DS-15; SEC35-27 (6))." | cap DS-15; SEC35-27 (6) | **P** — `builds the app with the fake adapter registry` |
| **FX-10-05** | naming | should-fix | 132 | `masterplan/10_test_strategy.md` :271 (`M4-DISC-REC-1`), :232 (CR-1) | op 93 answers `409 INVALID_STATE`, 0 datagrams | :271 (a) -> "op 93 answers `409 INVALID_STATE` (`DISCOVERY_NOT_ALLOWED_WHILE_RECORDING`), 0 datagrams ..."; (b) -> "the lift is the constant `CAPTURE_DISCOVERY_DURING_RECORDING_ENABLED` ...". :232 "ST-1..ST-5" -> "ST-1..ST-3 and ST-5 (ST-4 removed, D82)" | D86 C-4; D82 | **P** — `DISCOVERY_NOT_ALLOWED_WHILE_RECORDING` |
| **FX-02-01** | total | should-fix | 83, 85 | `masterplan/02_plan.md` :242 (M7-W2), :244 (M7-W4) | 120-field manifest ... Verify v2 (14 checks V-01..V-14) | :242 -> "128-field manifest (fields 124-128 from the first build, D81)". :244 -> "Verify v2 (14 checks V-01..V-14 in this work package; V-15 is added by row 141 — 15 checks at the M7 gate)" | D81 | **P** — `128-field manifest` |
| **FX-02-02** | coverage hole | should-fix | 129-142 | `masterplan/02_plan.md` §C / §D work-package tables (no anchor: 0 lines of this file mention R-9, R-10 or R-11) | (the plan has no work package for rows 129-142) | add a work-package block "Rev 2.3 Part B (AP3 = D78)" listing rows 129-142 with their milestone (M4: 129-138, 142; M5: 139, 140; M7: 141) and the check IDs of section 5 of this gate. Owner: the controller with the task-architect (this file is not a row-128 spec; listed so that the hole is not lost) | D77, D78 | **P** — `R-11` |

### 2.3 The 18 i18n keys of FX-08-11 (to add to `08` §14.2; names are proposals in the style of that table)

| # | Key | Text | Used by | Fix |
|--:|---|---|---|---|
| 1 | `common.captureConnect.reveal.show` | Show password | flow 10, password field | FX-08-02 |
| 2 | `common.captureConnect.reveal.hide` | Hide password | flow 10, password field | FX-08-02 |
| 3 | `common.captureConnect.confirmDevice` | I have checked that {{address}} is this camera | flow 10, before Test connection | FX-08-06 |
| 4 | `common.captureConnect.unverified` | This device has not been verified. Its name and model are what it announced. | flow 10, dialog header | FX-08-06 |
| 5 | `common.captureConnect.digestNote` | Sent as a digest: not readable in transit, but a device that receives it can test guesses against it. Use a password that is used for this camera only. | flow 10, field description | FX-08-06 |
| 6 | `common.captureConnect.charset` | Use letters, digits and common symbols only (printable ASCII). | flow 10, field message for `422` | FX-08-06 |
| 7 | `common.captureSearch.conflict` | Two devices announce the same identity. Neither can be connected. | flow 9, candidate row | FX-08-06 |
| 8 | `common.captureSearch.addressChanged` | This camera now answers from another address than the registered one. | flow 9, candidate row | FX-08-06 |
| 9 | `common.captureSearch.networksSearched` | Searched {{count}} network(s). | flow 9, summary line | FX-08-06 |
| 10 | `common.captureSearch.recordingLocked` | Camera search is not available while a session is recording. | flow 9, state S14 | FX-08-09 |
| 11 | `common.sourceClass.microphoneOn.web` | This Mac's microphone is on | flow 12, indicator (web) | FX-08-07 |
| 12 | `common.sourceClass.cameraOn.web` | This Mac's camera is on | flow 12, indicator (web) | FX-08-07 |
| 13 | `common.sourceClass.microphoneOn.mobile` | Core Mac's microphone is on | flow 12, indicator (tablet, phone) | FX-08-07 |
| 14 | `common.sourceClass.cameraOn.mobile` | Core Mac's camera is on | flow 12, indicator (tablet, phone) | FX-08-07 |
| 15 | `common.session.connectingCameras` | Connecting cameras… | flows 7, 11 | FX-08-08 |
| 16 | `common.localDevice.openFailed.chip` | Could not be opened | flow 12, local-device row | FX-08-10 |
| 17 | `common.localDevice.openFailed.body` | This Mac's camera (microphone) could not be opened. Check its permission on the Mac that runs the Core, then search again. | flow 12, local-device row | FX-08-10 |
| 18 | `common.captureNotice.start.notRecordable` | {{device}} cannot be recorded by this version of the system. | flow 13, pre-check BLOCK row | FX-08-10 |

Arithmetic: 120 (counted today: `awk 'NR>=1355&&NR<=1500' masterplan/08_client_ux_spec.md | grep -c '^| \`common\.'` = 120)
− 1 (`common.captureNotice.start.useOther`, FX-08-01) + 18 = **137**.

### 2.4 Baseline of the re-check patterns (generated, not typed)

Run at 2026-10-09 15:58 over the working tree: 94 patterns, **0 not in the stated "before" state**. Mode A needs a count of 1 or more today; mode P needs 0 today.

| Fix | File | Mode | Count today | Before-state as stated |
|---|---|:-:|--:|:-:|
| FX-01-01 | `01` | A | 1 | yes |
| FX-01-02 | `01` | P | 0 | yes |
| FX-01-03 | `01` | A | 1 | yes |
| FX-01-04 | `01` | A | 1 | yes |
| FX-01-05 | `01` | A | 1 | yes |
| FX-01-06 | `01` | P | 0 | yes |
| FX-01-07 | `01` | P | 0 | yes |
| FX-01-08 | `01` | A | 1 | yes |
| FX-01-09 | `01` | P | 0 | yes |
| FX-01-10 | `01` | P | 0 | yes |
| FX-01-11 | `01` | A | 1 | yes |
| FX-01-12 | `01` | P | 0 | yes |
| FX-01-13 | `01` | A | 1 | yes |
| FX-01-14 | `01` | P | 0 | yes |
| FX-01-15 | `01` | P | 0 | yes |
| FX-01-16 | `01` | P | 0 | yes |
| FX-03-01 | `03` | P | 0 | yes |
| FX-03-02 | `03` | P | 0 | yes |
| FX-03-03 | `03` | P | 0 | yes |
| FX-03-04 | `03` | P | 0 | yes |
| FX-03-05 | `03` | P | 0 | yes |
| FX-03-06 | `03` | A | 1 | yes |
| FX-03-07 | `03` | A | 1 | yes |
| FX-03-08 | `03` | P | 0 | yes |
| FX-03-09 | `03` | P | 0 | yes |
| FX-03-10 | `03` | P | 0 | yes |
| FX-03-11 | `03` | P | 0 | yes |
| FX-03-12 | `03` | A | 1 | yes |
| FX-03-13 | `03` | P | 0 | yes |
| FX-03-14 | `03` | P | 0 | yes |
| FX-03-15 | `03` | P | 0 | yes |
| FX-03-16 | `03` | P | 0 | yes |
| FX-03-17 | `03` | A | 1 | yes |
| FX-03-18 | `03` | P | 0 | yes |
| FX-03-19 | `03` | P | 0 | yes |
| FX-03-20 | `03` | P | 0 | yes |
| FX-03-21 | `03` | P | 0 | yes |
| FX-03-22 | `03` | P | 0 | yes |
| FX-03-23 | `03` | P | 0 | yes |
| FX-04-01 | `04` | P | 0 | yes |
| FX-04-02 | `04` | A | 1 | yes |
| FX-04-03 | `04` | P | 0 | yes |
| FX-04-04 | `04` | A | 1 | yes |
| FX-04-05 | `04` | P | 0 | yes |
| FX-04-06 | `04` | P | 0 | yes |
| FX-05-01 | `05` | A | 1 | yes |
| FX-05-02 | `05` | A | 1 | yes |
| FX-05-03 | `05` | A | 1 | yes |
| FX-05-04 | `05` | A | 1 | yes |
| FX-05-21 | `05` | A | 1 | yes |
| FX-05-05 | `05` | P | 0 | yes |
| FX-05-06 | `05` | A | 1 | yes |
| FX-05-07 | `05` | A | 1 | yes |
| FX-05-08 | `05` | A | 1 | yes |
| FX-05-09 | `05` | A | 1 | yes |
| FX-05-10 | `05` | A | 1 | yes |
| FX-05-11 | `05` | A | 1 | yes |
| FX-05-12 | `05` | A | 1 | yes |
| FX-05-13 | `05` | P | 0 | yes |
| FX-05-14 | `05` | P | 0 | yes |
| FX-05-15 | `05` | A | 4 | yes |
| FX-05-16 | `05` | P | 0 | yes |
| FX-05-17 | `05` | P | 0 | yes |
| FX-05-18 | `05` | P | 0 | yes |
| FX-05-19 | `05` | P | 0 | yes |
| FX-05-20 | `05` | P | 0 | yes |
| FX-06-01 | `06` | A | 1 | yes |
| FX-06-02 | `06` | A | 1 | yes |
| FX-06-03 | `06` | A | 1 | yes |
| FX-06-04 | `06` | P | 0 | yes |
| FX-06-05 | `06` | A | 1 | yes |
| FX-08-01 | `08` | A | 2 | yes |
| FX-08-02 | `08` | A | 1 | yes |
| FX-08-03 | `08` | A | 1 | yes |
| FX-08-04 | `08` | A | 1 | yes |
| FX-08-05 | `08` | A | 1 | yes |
| FX-08-06 | `08` | P | 0 | yes |
| FX-08-07 | `08` | P | 0 | yes |
| FX-08-08 | `08` | P | 0 | yes |
| FX-08-09 | `08` | P | 0 | yes |
| FX-08-10 | `08` | P | 0 | yes |
| FX-08-11 | `08` | P | 0 | yes |
| FX-08-12 | `08` | P | 0 | yes |
| FX-09-01 | `09` | A | 1 | yes |
| FX-09-02 | `09` | P | 0 | yes |
| FX-09-03 | `09` | A | 1 | yes |
| FX-09-04 | `09` | P | 0 | yes |
| FX-10-01 | `10` | A | 1 | yes |
| FX-10-02 | `10` | A | 1 | yes |
| FX-10-03 | `10` | A | 1 | yes |
| FX-10-04 | `10` | P | 0 | yes |
| FX-10-05 | `10` | P | 0 | yes |
| FX-02-01 | `02` | P | 0 | yes |
| FX-02-02 | `02` | P | 0 | yes |

Blueprint patterns of section 5: 34 patterns, **0 not in the stated "before" state** (same rule; counts in the last column of the section-5 table).

**Exact patterns, machine-readable** (tab-separated: id, mode, file, pattern — the table cells above
escape `|` as `\|` and wrap patterns in code spans; this block is the authority). One command re-checks
the **after** state of all of them from the task folder:

```sh
python3 - <<'PY'
t = open('gateway_check/27_r9_r11_spec_gate.md').read()
blk = t.split('```patterns\n')[1].split('\n```')[0]
bad = 0
for line in blk.split('\n'):
    i, m, f, p = line.split('\t', 3)
    n = open(f).read().count(p)
    ok = (n == 0) if m == 'A' else (n >= 1)
    bad += (not ok)
    print('ok  ' if ok else 'FAIL', i, m, n)
print('failing:', bad)
PY
```

```patterns
FX-01-01	A	masterplan/01_specs.md	travels only through the existing write-only operation 89
FX-01-02	P	masterplan/01_specs.md	else by the whole stored `address`
FX-01-03	A	masterplan/01_specs.md	on each client that row 125 allows
FX-01-04	A	masterplan/01_specs.md	the operation-89 entry written by an operator
FX-01-05	A	masterplan/01_specs.md	this row **proposes** to allow it as well
FX-01-06	P	masterplan/01_specs.md	DISCOVERY_NOT_ALLOWED_WHILE_RECORDING
FX-01-07	P	masterplan/01_specs.md	connecting cameras
FX-01-08	A	masterplan/01_specs.md	2 alerts, 2 audit rows, 0 stale banners
FX-01-09	P	masterplan/01_specs.md	every stored kind is inert
FX-01-10	P	masterplan/01_specs.md	device rows of their own
FX-01-11	A	masterplan/01_specs.md	listener snapshot showing the helpers
FX-01-12	P	masterplan/01_specs.md	no waveform or spectrogram
FX-01-13	A	masterplan/01_specs.md	travels only through write-only operation 89
FX-01-14	P	masterplan/01_specs.md	M4-DISC-SOCK-1
FX-01-15	P	masterplan/01_specs.md	97 / 36 / 61
FX-01-16	P	masterplan/01_specs.md	27_r9_r11_spec_gate
FX-03-01	P	masterplan/03_api_contract.md	`CAPTURE_DISCOVERY_WINDOW_MS` | `3_000`
FX-03-02	P	masterplan/03_api_contract.md	`CAPTURE_CONNECTION_TEST_TIMEOUT_MS` | `15_000`
FX-03-03	P	masterplan/03_api_contract.md	`CAPTURE_CONNECTION_TEST_FAILURE_WINDOW_MS` | `1_800_000`
FX-03-04	P	masterplan/03_api_contract.md	CAPTURE_DISCOVERY_MAX_PER_HOUR
FX-03-05	P	masterplan/03_api_contract.md	DISCOVERY_NOT_ALLOWED_WHILE_RECORDING
FX-03-06	A	masterplan/03_api_contract.md	it also lists the loopback development sources
FX-03-07	A	masterplan/03_api_contract.md	the host of `address`
FX-03-08	P	masterplan/03_api_contract.md	`SNMP_POE` (production kinds)
FX-03-09	P	masterplan/03_api_contract.md	the stored kinds are inert
FX-03-10	P	masterplan/03_api_contract.md	addressChanged
FX-03-11	P	masterplan/03_api_contract.md	printable ASCII
FX-03-12	A	masterplan/03_api_contract.md	a URL or the host.
FX-03-13	P	masterplan/03_api_contract.md	not an authentication factor
FX-03-14	P	masterplan/03_api_contract.md	opens no RTSP connection
FX-03-15	P	masterplan/03_api_contract.md	DEVICE_CHANGED
FX-03-16	P	masterplan/03_api_contract.md	developmentSources
FX-03-17	A	masterplan/03_api_contract.md	Not ruled by D80(6)
FX-03-18	P	masterplan/03_api_contract.md	SOURCE_KIND_NOT_RECORDABLE
FX-03-19	P	masterplan/03_api_contract.md	OPEN_FAILED
FX-03-20	P	masterplan/03_api_contract.md	OP-125-2
FX-03-21	P	masterplan/03_api_contract.md	captureOperation
FX-03-22	P	masterplan/03_api_contract.md	sourceOpen
FX-03-23	P	masterplan/03_api_contract.md	Closed at the spec gate (row 128)
FX-04-01	P	masterplan/04_database_contract.md	development_sources IS NOT TRUE
FX-04-02	A	masterplan/04_database_contract.md	if row 128 keeps the local camera as a candidate
FX-04-03	P	masterplan/04_database_contract.md	A failed start leaves the four rows
FX-04-04	A	masterplan/04_database_contract.md	and the outcome, never a host
FX-04-05	P	masterplan/04_database_contract.md	CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES
FX-04-06	P	masterplan/04_database_contract.md	Status after the spec gate (row 128)
FX-05-01	A	masterplan/05_capture_architecture_spec.md	| Camera 1 | `CAM-01` -> `VIDEO-01` | `LOCAL_DEVICE`
FX-05-02	A	masterplan/05_capture_architecture_spec.md	none, or production kinds (inert)
FX-05-03	A	masterplan/05_capture_architecture_spec.md	nothing is recordable until a real camera is adopted
FX-05-04	A	masterplan/05_capture_architecture_spec.md	source address is kept
FX-05-21	A	masterplan/05_capture_architecture_spec.md	endpoint reference of <= 256 characters
FX-05-05	P	masterplan/05_capture_architecture_spec.md	explicitArray: true
FX-05-06	A	masterplan/05_capture_architecture_spec.md	operator action through **operation 89**
FX-05-07	A	masterplan/05_capture_architecture_spec.md	+ RTSP `DESCRIBE`
FX-05-08	A	masterplan/05_capture_architecture_spec.md	3 per 10 minutes per candidate
FX-05-09	A	masterplan/05_capture_architecture_spec.md	secret.fill(0)
FX-05-10	A	masterplan/05_capture_architecture_spec.md	An RTSP responder that answers
FX-05-11	A	masterplan/05_capture_architecture_spec.md	`adapters/camera/rtsp-describe.ts`; it contains
FX-05-12	A	masterplan/05_capture_architecture_spec.md	Minimum 5 s between two searches per Core (proposed
FX-05-13	P	masterplan/05_capture_architecture_spec.md	named setting passed by the launcher
FX-05-14	P	masterplan/05_capture_architecture_spec.md	libswresample
FX-05-15	A	masterplan/05_capture_architecture_spec.md	row 58 (not landed)
FX-05-16	P	masterplan/05_capture_architecture_spec.md	| H-22 |
FX-05-17	P	masterplan/05_capture_architecture_spec.md	exactly one listed entry equals
FX-05-18	P	masterplan/05_capture_architecture_spec.md	only on the user's instruction
FX-05-19	P	masterplan/05_capture_architecture_spec.md	`sourceAddress` -> `host`
FX-05-20	P	masterplan/05_capture_architecture_spec.md	test-support launcher
FX-06-01	A	masterplan/06_evidence_package_spec.md	it must use these three
FX-06-02	A	masterplan/06_evidence_package_spec.md	**Open, not decided
FX-06-03	A	masterplan/06_evidence_package_spec.md	has no written definition yet
FX-06-04	P	masterplan/06_evidence_package_spec.md	failed start
FX-06-05	A	masterplan/06_evidence_package_spec.md	Where that record lives is for row 122
FX-08-01	A	masterplan/08_client_ux_spec.md	6 (G13-G18
FX-08-02	A	masterplan/08_client_ux_spec.md	**no** reveal toggle
FX-08-03	A	masterplan/08_client_ux_spec.md	three refused passwords
FX-08-04	A	masterplan/08_client_ux_spec.md	package carries the badge. This is kept
FX-08-05	A	masterplan/08_client_ux_spec.md	("This Mac's camera" for `LOCAL_DEVICE`, "Test source" for `FAKE`)
FX-08-06	P	masterplan/08_client_ux_spec.md	I have checked that
FX-08-07	P	masterplan/08_client_ux_spec.md	microphone is on
FX-08-08	P	masterplan/08_client_ux_spec.md	Connecting cameras
FX-08-09	P	masterplan/08_client_ux_spec.md	DISCOVERY_NOT_ALLOWED_WHILE_RECORDING
FX-08-10	P	masterplan/08_client_ux_spec.md	REAL_DEVELOPMENT
FX-08-11	P	masterplan/08_client_ux_spec.md	**137**
FX-08-12	P	masterplan/08_client_ux_spec.md	Closed at the spec gate (row 128)
FX-09-01	A	masterplan/09_security_design_review.md	three failures -> three rows
FX-09-02	P	masterplan/09_security_design_review.md	0006_stt_config.sql:33
FX-09-03	A	masterplan/09_security_design_review.md	with an adopted fixture camera assigned
FX-09-04	P	masterplan/09_security_design_review.md	Answered by the user (D87)
FX-10-01	A	masterplan/10_test_strategy.md	open point, not decided here
FX-10-02	A	masterplan/10_test_strategy.md	not yet confirmed by the user
FX-10-03	A	masterplan/10_test_strategy.md	with an adopted fixture camera assigned
FX-10-04	P	masterplan/10_test_strategy.md	builds the app with the fake adapter registry
FX-10-05	P	masterplan/10_test_strategy.md	DISCOVERY_NOT_ALLOWED_WHILE_RECORDING
FX-02-01	P	masterplan/02_plan.md	128-field manifest
FX-02-02	P	masterplan/02_plan.md	R-11
BP-128	A	identification/02_structured.md	each gap routed to its owning author and re-checked
BP-129	P	identification/02_structured.md	`M4-MT-9` (2 runs
BP-130	P	identification/02_structured.md	`M4-DB-APPLY-1` passes
BP-131	A	identification/02_structured.md	plus reading the responders' unauthenticated device information
BP-132	A	identification/02_structured.md	pins equal the C3 totals of row 121
BP-133	P	identification/02_structured.md	`M4-NODEV-A-1` and `M4-NODEV-B-1` 2 runs each
BP-134	A	identification/02_structured.md	the helper's listener is on `127.0.0.1` only
BP-135	P	identification/02_structured.md	`M4-LOCAL-MIC-1` 2 runs
BP-136	P	identification/02_structured.md	`M4-SEC-FENCE-1` (the five boot refusals
BP-137	P	identification/02_structured.md	`M4-CONN-ABANDON-W`
BP-138	A	identification/02_structured.md	the connect flow for the roles and clients row 125 allows
BP-139	P	identification/02_structured.md	`M5-NODEV-C-1` 2 runs on fakes
BP-140	P	identification/02_structured.md	`M5-LOCAL-CLAP-1` once with the user present
BP-141	P	identification/02_structured.md	`M7-DEVSRC-SEAL-1`, `M7-DEVSRC-TAMPER-1` and `M7-SEC-SRC-2` 2 runs
BP-142	A	identification/02_structured.md	takes its credential only from the write-only operation 89
BP-70	P	identification/02_structured.md	the 43 M4 checks
BP-75	P	identification/02_structured.md	the record of `M5-LOCAL-CLAP-1` read, not repeated
BP-89	P	identification/02_structured.md	verify runs 15 checks
BP-60	P	identification/02_structured.md	ST-4 removed
BP-61	P	identification/02_structured.md	only reader of `DEMS_CAPTURE_DEV_SOURCES`
BP-65	P	identification/02_structured.md	`M4-MT-12` (upsert half)
BP-66	P	identification/02_structured.md	with row 71 the four `session_capture_sources` rows
BP-67	P	identification/02_structured.md	`M4-SEL-W` as amended
BP-68	P	identification/02_structured.md	`M4-SEL-T` and `M4-SEL-P` as amended
BP-71	P	identification/02_structured.md	`M5-SRC-REC-1` passes
BP-83	A	identification/02_structured.md	120-field manifest
BP-84	P	identification/02_structured.md	`M7-CONN-CRED-1` passes
BP-85	P	identification/02_structured.md	V-15 and the `sources` block of the result are added by row 141
BP-86	P	identification/02_structured.md	the P1 cells assert a failed start
BP-121	P	identification/02_structured.md	Erratum rev 2.3.1 (D80(7), D81)
BP-125	P	identification/02_structured.md	Erratum rev 2.3.1 (D80(3))
BP-X1	A	identification/02_structured.md	which travels only through the write-only operation 89
BP-X2	A	identification/02_structured.md	migration `0008` if any
BP-X3	A	identification/02_structured.md	the row set of rev 2.3 Part B has not been approved
```

Run today (before the fix pass) the command prints `failing: 128` — every pattern is in its before-state, as it must be. After the fix pass it must print `failing: 0`. If the editor words a required text differently, the controller reads the edit and adjusts the pattern of that row; the pattern is a check on the edit, not the edit itself.

## 3. Coverage matrix — 32 acceptance criteria x 7 documents

Cell = where the criterion is carried (`line` of that file), "n/a" with the reason class, or
**HOLE** with the fix that closes it. Reason classes for n/a: *np* = the document has no part in the
criterion (for example the database in a client-only rule); *proc* = a process or agent rule that
only the test catalogue and the security review carry. The `10` column is the traceability row of
§A.4a.9 first, then the primary check row. Lines were found by a script over the `R-n AC-m`
references of each file and completed by reading the sections for criteria that a document carries
without naming the AC.

### 3.1 The matrix

| AC | `03` contract | `04` database | `05` architecture | `06` evidence | `08` UX | `09` security | `10` tests |
|---|---|---|---|---|---|---|---|
| R-9 AC-1 search trigger | :388, :443 | n/a (np) | :1257 (G-R13), :487 | n/a (np) | :680-690 | :568, :622 | :393 (:264, :280) |
| R-9 AC-2 candidate list from probe data | :415-430 — **HOLE** matching key by host (FX-03-07) | :1147-1154 | :482 (DS-10) | n/a (np) | :714-731 | :567, :674 | :394 (:265) |
| R-9 AC-3 a search connects nothing | :444, :1112 | :1136 | :581, :866 | n/a (np) | :701 | :566 | :395 (:265) |
| R-9 AC-4 candidates are not devices | :444-446 | :1134-1145 | :159 (RG-4), :484 | n/a (np) | :733-743 | :746 | :396 (:266) |
| R-9 AC-5 connect flow order | :452-456 | :1144, :1194 | :549-557 — **HOLE** step 6 says operation 89 (FX-05-06) | n/a (np) | :798, :852-860 | :673 | :397 (:295) |
| R-9 AC-6 five outcomes | :449 | n/a (np) | :566-575 — **HOLE** RTSP half against D82 (FX-05-07) | n/a (np) | :825-831 | :590 | :398 (:293) |
| R-9 AC-7 no default or reused credential | :450-451 | n/a (:1197 sealer only) | :559-564, :1258 | n/a (np) | :805 | :588, :691 | :399 (:292) |
| R-9 AC-8 failed flow leaves nothing | :452 | :1144, :1391 (MT-13) | :159, :584 | n/a (np) | :862-873 | :673 | :400 (:297) |
| R-9 AC-9 audit without values | :795-860 — **HOLE** `host` / `endpointRef` / `guardTripped` (FX-03-12) | :1170-1188 — **HOLE** same keys (FX-04-04) | :554, :484 | n/a (np) | :745-750, :875-882 | :672, :605 | :401 (:282, :304) |
| R-9 AC-10 not SSRF | :447 | n/a (np) | :481 (DS-9), :583 (CT-3) | n/a (np) | :726 | :589 | :402 (:294) |
| R-9 AC-11 rate limits | :459, :1003-1016 — **HOLE** four values (FX-03-01..04) | n/a (:1141 counters in memory) | :483, :585 — **HOLE** (FX-05-08, FX-05-12) | n/a (np) | :710, :837-838 — **HOLE** "3 failures" (FX-08-03) | :621-622 | :403 (:277, :301) |
| R-9 AC-12 roles, web-only credential | :394-402 | n/a (np) | :552 | n/a (np) | :752-757, :780-789, :935-943 | :671 | :404 (:270, :296) |
| R-9 AC-13 config lock, search while open | :457 — **HOLE** D86 C-4 (FX-03-05) | :1333 | :563 | n/a (np) | :839 — **HOLE** no state for the 409 (FX-08-09) | :568 | :405 (:271) |
| R-9 AC-14 suite never on the real network | n/a (proc; :1072-1074 names the stub) | n/a (np) | :487 (DS-15), :855 | n/a (np) | :1535 | :566 item (6) | :406 (:232, :267) — **HOLE** how a lane Core reaches the stub (FX-10-04, FX-05-20) |
| R-9 AC-15 real-LAN check, "not run" | n/a (proc; `state: FAILED` at :409) | n/a (np) | :485 (DS-13), :1264 | n/a (np) | :707 (S8) | :569, :653 | :407 (:269) |
| R-9 AC-16 agent rule, identifying data | n/a (proc) | :1143 | :484 (DS-12), :1260 | n/a (np) | n/a (proc) | :569, :735 (C-7) | :408 (:269, :276) |
| R-10 AC-1 situation A | :907, :915-916 | :1183-1184 | :485, :716 | n/a (np) | :704-705, :926 | n/a (no finding; the rule "no value in an alert" is :605) | :409 (:311) |
| R-10 AC-2 situation B, start rule | :550, :908 — **HOLE** active-microphone case "not ruled" (FX-03-17) | :1183 | :716, :808-809 | n/a (np) | :927, :1089-1100 — **HOLE** G18 against D83 (FX-08-01) | :622 (pre-check search allowance) | :410 (:312, :313) |
| R-10 AC-3 situation C | :551, :909-910 — **HOLE** "connecting cameras", failed start (FX-03-18) | :1184 | :695-726 | :699-708 — **HOLE** §E.4 has no D84 precondition (FX-06-04) | :928-933 — **HOLE** no "connecting cameras" state (FX-08-08) | :638 | :411 (:364) |
| R-10 AC-4 "Search again" | :388, :392 | n/a (np) | :479, :703 | n/a (np) | :941, :710 | n/a (np) | :412 |
| R-10 AC-5 a later success clears | :907-910 | n/a (np) | :718 | n/a (np) | :945-955 | n/a (np) | :413 (:311, :312) |
| R-10 AC-6 raised once, no values | :912-919 | :1184 | :715-717 | n/a (np) | :912-920 | :605 | :414 (:282) |
| R-11 AC-1 boot fence | n/a (boot; :626 the 78 / 79 refusal) | :1305-1334 | :198-217 — **HOLE** row 1 (FX-05-02) | :868 | n/a (boot; result at :1033) | :639 | :415 (:320) |
| R-11 AC-2 never selectable in production | :478-481, :552-553 — **HOLE** SIMULATED case (FX-03-09) | :1331-1332 | :157 (RG-2) | :868 | :1033-1037 | :639 | :416 (:321) |
| R-11 AC-3 which source fills which slot | n/a (np) | :1048-1058, :1355 | :162-171 — **HOLE** ids `CAM-01` / `MIC-01` (FX-05-01) | n/a (np) | :1016-1018 | n/a (np; helpers at :641) | :417 (:322) |
| R-11 AC-4 worker unchanged | n/a (np) | n/a (np) | :629-636, :1256, :1263-1266 | n/a (np) | n/a (np) | :641, :653 | :418 (:323) |
| R-11 AC-5 a local device that cannot be opened | :460, :413 — **HOLE** two of five error names missing (FX-03-19) | n/a (np) | :689-690 (HL-10, HL-11), :160 | n/a (np) | :1020-1031 — **HOLE** fifth state (FX-08-10) | :641 | :419 (:324) |
| R-11 AC-6 visible label | :471, :552 — **HOLE** no member on ops 39 / 40 (FX-03-16) | :1114-1130 | :205 | :648 | :978-1012 — **HOLE** Simulated-mode rule (FX-08-04), "is on" (FX-08-07) | :651 item (4) | :420 (:353) |
| R-11 AC-7 manifest mark | **HOLE** — no `sources` block on op 41 (FX-03-16) | :1060-1130 | :205 | :436-510, :624, :637-648 | :445, :482, :999 | :638, :640 | :421 (:376-379) |
| R-11 AC-8 recordings out of git and docs | n/a (proc; N-6 at :1107) | :1143 | :693, :1261 — **HOLE** wider docs rule (FX-05-18) | n/a (np) | :1045-1047 | :651 | :422 (:326) |
| R-11 AC-9 the permission prompt is the user's | n/a (proc) | n/a (np) | :691 (HL-12) | n/a (np) | :1023 | :651 item (5) | :423 (:326) |
| R-11 AC-10 end to end in development mode | n/a (np) | n/a (np) | :668, :1382 (H-17) | :872 | :1223 | n/a (np) | :424 (:367, :368) |

### 3.2 Every hole, named

| # | Hole | Where it shows | Closed by | Severity |
|--:|---|---|---|---|
| CH-1 | The response members behind the evidence label and the verify line do not exist in the contract (`developmentSources` on ops 39 / 40, `sources` on op 41): 0 matches of `developmentSources` in `03`, while `06:643` requires the block "to be carried there" | R-11 AC-6, AC-7 x `03` | FX-03-16 | must-fix (row 141) |
| CH-2 | D86 C-4 (no search during `RECORDING` until two checks pass) is carried only by `09:568` and `10:271`; `01:299`, `03:409`, `03:457` and `08:1189` still say "any session state"; the reason of the 409 has no name anywhere | R-9 AC-13 x `01`, `03`, `08` | FX-01-06, FX-03-05, FX-08-09, FX-10-05 | must-fix (row 132) |
| CH-3 | D84 ("recording" only from the first durable fragment; nothing durable = failed start, no evidence item) is carried by `05:720-726` and `10:364` only; the contract has no member, the UX no state, `06` §E.4 no precondition, the kill matrix the old expectation | R-10 AC-3 x `03`, `06`, `08`, `10` | FX-03-18, FX-06-04, FX-08-08, FX-10-01, FX-01-07; ruling R-1 | must-fix (rows 71, 139, 86) |
| CH-4 | The findings accepted by D86 that add response members, audit keys and UI elements are in `09` and in the checks of `10` but in no builder's spec: `conflict`, `addressChanged`, `interfaceCount`, `guardTripped`, `host` / `endpointRef` (C-3), the character set of the credential, the confirmation tick, the reveal control, the "is on" indicator, `SOURCE_KIND_NOT_RECORDABLE` | R-9 AC-2, AC-9, AC-11; R-11 AC-6 x `03`, `04`, `05`, `08` | FX-03-10, -11, -12, -18, -22; FX-04-04; FX-05-04, -05; FX-08-02, -06, -07 | must-fix (rows 131, 132, 137, 142) |
| CH-5 | D82 (no RTSP client) is not applied to `05`: outcomes, CT-1, CT-2, ST-4 and G-R10 still specify `rtsp-describe.ts` | R-9 AC-6 x `05` | FX-05-07, -10, -11 | must-fix (rows 142, 60) |
| CH-6 | D83 (the local devices are rows of their own; G18 not built; no badge in Simulated client mode) is not applied to `05` §A.1.1 and `08` §8f.3 / §8g.3 | R-11 AC-3, AC-6; R-10 AC-2 x `05`, `08` | FX-05-01, FX-08-01, FX-08-04 | must-fix (rows 134-138) |
| CH-7 | The helper error set of `05` HL-10 has five names, the contract carries three | R-11 AC-5 x `03`, `08` | FX-03-19, FX-08-10 | must-fix (rows 133, 136) |
| CH-8 | No spec says how a booted lane Core is pointed at the fake stub for the client checks (G-27) | R-9 AC-14 x `10`, `05` | FX-10-04, FX-05-20 | must-fix (rows 137, 138) |
| CH-9 | `09` has no finding on R-10 as such (the six points of row 126 do not name it). Checked: the two security-relevant parts are covered elsewhere — no value in an alert (`09:605`) and the pre-check search of an operator without `CAPTURE_CONFIG` under the rate limit (`09:622`). No edit asked | R-10 AC-1, AC-4, AC-5 x `09` | none (recorded) | — |
| CH-10 | `masterplan/02_plan.md` does not mention R-9, R-10 or R-11 at all (`grep -c "R-9\|R-10\|R-11" masterplan/02_plan.md` = 0): rows 129-142 have no work package in the plan | all 32 x the plan | FX-02-02 (owner: controller / task-architect) | should-fix |

## 4. Rulings needed from the controller

### 4.1 Rulings (2) — neither an existing decision nor a more specific spec decides them

| # | Point | Options | Recommendation | Effect |
|--:|---|---|---|---|
| **R-1** | **How "connecting cameras" is carried (D84).** D84 says a session *shows* "recording" only from the first durable fragment; `05:720-726` says the session machine must *present* "connecting cameras" and that no worker frame or protocol field changes; `04:1092` (MR-S1) writes the four source rows "in the transaction that persists the transition to `RECORDING`"; `10:364` says "its state reads 'connecting cameras'". No spec names the contract member | **A** — the stored state stays `RECORDING` from the accepted plan; the session payload (`getCurrentSession`, the `session` slice) gains one boolean, proposed `captureDurable`, `false` until the first `FIRST_DURABLE_FRAGMENT`; clients draw "Connecting cameras…" while it is `false`. **B** — a new session state between `ARMED` and `RECORDING` | **A.** B changes two closed CHECK lists (`active_session_state_check`, `health_snapshots_states_check`, `apps/core-server/src/db/migrations/0001_tables.sql:256`, `:489`), the session-state enum pins and every client's state switch, and it would have to join migration set 4 — row 129 could not start as specified. A changes one payload member and no schema | With A: FX-03-18 and FX-08-08 name `captureDurable`; FX-04-03 stands as written. With B: a new DDL statement and two CHECK swaps in `0008` / `0009`, `dbc-4` §N.8 and §N.11 re-counted, row 129 re-specified |
| **R-2** | **The development badge when the Core itself runs `SIMULATED` and a live client is connected** (today's lanes and demos). D83 rules "in Simulated **client** mode the badge is not shown on devices and demo items — the mode banner says it". After set 4 the Core's five built-ins are `FAKE`, so ops 76 / 77 answer `sourceClass: DEVELOPMENT` for all of them (`04:1025`, FX-03-09) and a client that draws "from the data" (`08` §8f.1) would badge every device of every demo run. `10:353` tests three cases (`REAL_DEVELOPMENT`, a production configuration, Simulated client mode) and not this one | **A** — the badge is drawn only when the Core is in real capture: the client already knows it from the demo status (op 71 answers `demo: 'DISABLED'` in real-capture mode, `03:533`); with demo controls on (Core `SIMULATED`) no badge on devices and demo items, as in Simulated client mode; on a sealed item the badge follows `developmentSources = true` and `demo = false`. **B** — the badge is drawn from the data everywhere a live client is connected | **A** — the same reason D83 gave (the demo banner already says it) and no new member | A: one sentence added to `08` §8f.3 beside FX-08-04 and one case added to `M4-DEVSRC-LABEL-*` (`10:353`): "live client on a Core in `SIMULATED`: 0 badges on devices and demo items". B: no edit; every lane capture of the client checks shows the badge |

### 4.2 Names minted by this gate (9) — confirm or rename in one line each

The specs and findings describe these things without naming them (or name them in one finding
only). The fix list needs one spelling; a rename changes only the string in the rows named.

| # | Name | What it is | Source of the need | Rows that use it |
|--:|---|---|---|---|
| 1 | `DISCOVERY_NOT_ALLOWED_WHILE_RECORDING` | `details.reason` of the `409 INVALID_STATE` of op 93 during `RECORDING` | D86 C-4; rec-127 §7 item 3 ("no name in the contract") | FX-01-06, FX-03-05, FX-08-09, FX-10-05, BP-132 |
| 2 | `CAPTURE_DISCOVERY_DURING_RECORDING_ENABLED` (`false`) | the one constant whose change is the lift | `10:271` (b) "the lift is one constant" | FX-03-05, FX-10-05 |
| 3 | `CAPTURE_DISCOVERY_MIN_INTERVAL_PER_CORE_MS` (`5_000`), `CAPTURE_DISCOVERY_MAX_PER_HOUR` (`30`) | the two limits SEC35-39 adds | `09:622` | FX-03-04, FX-05-12 |
| 4 | `409 INVALID_STATE` + pre-check BLOCK item for `SOURCE_KIND_NOT_RECORDABLE` | status and place of the refusal (the code name itself is from `09:638`) | D86 C-5 | FX-03-18, FX-08-10, BP-66, BP-136 |
| 5 | `details.cause: DEVICE_CHANGED` | the reason of `CONNECTION_TEST_FAILED` when the profile set changed | `09:673` | FX-03-15 |
| 6 | `sourceOpen` (boolean on `CaptureDevice`) | the Core data behind the "is on" indicator | `09:651` item (4) "from Core data" | FX-03-22, FX-05-18, FX-08-07 |
| 7 | `captureOperation` (key of the existing `SYSTEM_BOOT` audit type) | the boot row that names the capture operation; the type exists (`packages/shared/src/sim/vocabulary.ts:396`), so the audit-type total stays 67 | `09:639` (b) | FX-03-21, FX-04-04, BP-61 |
| 8 | the 18 i18n keys of section 2.3 | texts for the new states | FX-08-02, -06, -07, -08, -09, -10 | FX-08-11 |
| 9 | `captureDurable` | ruling R-1, option A | D84 | FX-03-18, FX-08-08 |

### 4.3 Decisions for the controller to record (no choice left; so that the log holds them)

| # | Decision | Basis |
|--:|---|---|
| 1 | One value per constant, as section 7.2: window 3,000 ms; test deadline 15,000 ms; guard 2 per host in 1,800,000 ms; search spacing 10 s per operator session **and** 5 s per Core; 6 searches per minute per Core and 30 per hour per session; the pre-check search has its own allowance; endpoint reference at most 120 characters | D82(c), D86 C-2, D86 C-8 with SEC35-39 (4) |
| 2 | Totals after the fix pass: every pinned total of `03` §10.1, `04` §N.11, `06` and `10` section K is **unchanged**; `08` moves to 17 gated controls / 43 client instances / 137 keys / 14 states of flow 9; the delta of `03` has 17 reason values and 17 constants | section 7.3 |
| 3 | SEC35-36 item (3) is void: `username`, `password`, `credential` and `secret` are already denied audit keys (`0006_stt_config.sql:33-34`); row 129 carries no CHECK swap. The audit key for C-3 is `endpointRef`, never `onvifUuid` (denied) | code fact read by this row |
| 4 | Operation owners and intermediate pins: row 132 lands ops 93, 94 (94 / 36 / 58; 64 audit types; `offline` 28); row 133 lands op 97 (95 / 36 / 59; 65; 29); row 142 lands ops 95, 96 and the server side of op 89 (97 / 36 / 61; 67; 31; Try-it 10; 6 access conditions). The test record's "95 / 36 / 59 if it lands 93, 94, 97" does not hold once op 97 is row 133's | D89(c) |
| 5 | The local devices never appear as search candidates; a `FAKE` candidate exists only through the loopback target that test support injects; a lane Core for client checks is started by a test-support launcher | D83 (O-8); `05:487`; SEC35-27 (6) |
| 6 | `credentialSet` on a registered camera (OP-125-2) is not carried in this phase — the runtime role cannot read the credential table and no criterion asks for it; the local camera's failure cause (OP-125-4) reaches clients through the situation-B alert only | `04:1196`; `08:1023` |
| 7 | Six P1-Sx kill cells keep their IDs with one common expectation (failed start). They are now equivalent in what they assert; the catalogue total stays 330 + 10. Merging them is a later catalogue decision, not asked here | D89(b) |
| 8 | Operation 97 stays allowed while a session is open (D80(4), D80(5)); the question row 121 put to row 123 — is the enumeration safe during `RECORDING` — was not answered, so it becomes hypothesis H-27 with `M4-MIC-RESCAN-1` as its test | rec-121 §5; FX-05-16 |
| 9 | `gateway_check/` now holds two files with the prefix `27_` (`27_m2_claude_audit.md` and this one, whose name the blueprint fixes at `bp:380`). Nothing was renamed | red line: no rename |

## 5. Blueprint sentences for the task-architect (`identification/02_structured.md`; not edited here)

Starting point: rec-127 §5. Corrected where the authority order says otherwise: the intermediate
pins of rows 132 / 133 (op 97 is row 133's, D89(c)); row 134's "listener" (the helper binds
nothing); row 129 (no CHECK swap; the reset guard is in the row); the P1 clause of rows 86 and 89
(D89(b)); the closed rows 121 and 125 get a dated note instead of a rewritten task. "Unit, static and
contract checks run once per checkpoint; '2 runs' applies to DB-backed, harness, browser and device
checks" (rec-127 §5) holds for every row below. Re-check as in section 2.1, on
`identification/02_structured.md`.

| ID | Row | Cell | Current text (short quote) | Required sentence | Authority | Mode, pattern | Count today |
|---|---|---|---|---|---|---|--:|
| **BP-128** | 128 | Task; Verification | each gap routed to its owning author and re-checked ... 0 open gaps before row 129, 131 or 134 starts | Task: "... (operation names, states, audit types, migration number, check IDs, SEC35-23 exception); the verifier produces the reconciliation table with one fix per gap, one data-analyst applies all fixes in a single pass, the controller checks them against the table, and the task-architect aligns the Verification cells of rows 129-142 and gates 70 / 75 / 89 in the same pass (D89)". Verification: "Item-by-item table with file:line; every fix carries a grep pattern that is absent before and present after (or the reverse); 0 failing patterns before row 129, 131 or 134 starts" | D89 | **A** — `each gap routed to its owning author and re-checked` | 1 |
| **BP-129** | 129 | Task; Depends On; Verification | Migration `0008` per the row-122 delta (generated SQL + privileges in the 0005 pattern); the row is recorded as not needed ... | Task: "Migration set 4 per `dbc-4` §N.8: `0008_capture_sources.sql` (generated) + `0009_capture_sources_privileges.sql` (hand-written), schema version `(3, 'dbc-4')` (D83); also the reset-guard change of `dbc-4` §N.10 — development packages are exempt under the three conditions of SEC35-42 (D87(3), D89(c)); no forbidden-key CHECK swap and no blanket `GRANT SELECT` is part of the set". Depends On: "128". Verification: "`M4-MT-9` (2 runs; +1 at row 70), `M4-MT-10`, `M4-MT-11`, `M4-MT-12`, `M4-MT-14`, `M4-MT-15`, `M4-MT-16`, `M4-PIN-2` and `M4-SEC-RESET-1` (2 runs; +1 at row 70) pass on throw-away databases; live `dems_demo` and the lanes are not migrated by this row" | D83 (D-DB-17); D87(3); D89(c)(d) | **P** — `` `M4-MT-9` (2 runs `` | 0 |
| **BP-130** | 130 | Task; Verification | Apply migration `0008` to the four development databases ... with the seed delta of row 122; drops out with row 129 | Task: "Apply migration set 4 (`0008` + `0009`) to the four development databases (`dems_lane_1..3`, then `dems_demo`) under `/usr/bin/lockf -k .locks/db-migrate.lock`, at the moment the controller picks — every lane Core stopped, no database-using agent in flight (D83, O-7); no reseed and no reset". Verification: "`M4-DB-APPLY-1` passes: the four databases report `3 (dbc-4)`, a second run applies nothing, kept tables and per-lane pairing are intact (run 1 applies, run 2 is the no-op run; +1 at row 70)" | D83 (O-7, D-DB-17) | **P** — `` `M4-DB-APPLY-1` passes `` | 0 |
| **BP-131** | 131 | Task; Verification | probe only — a multicast Probe plus reading the responders' unauthenticated device information and scopes ... the report quoting counts and vendor or model class only | Task: "probe only — two typed multicast Probes; a candidate is built from the probe answer alone (the scopes in the answer; no TCP read of device information, D80(1)); own probe over `node:dgram` in the one pinned file `adapters/camera/ws-discovery.ts`; installs `onvif` 0.8.3 and `xml2js` (exact pins) and does not use the package's `Discovery` (D82(a)) ..." (rest unchanged). Verification: "`M4-DISC-NOLAN-1`, `M4-DISC-SOCK-1`, `M4-SEC-NET-1` (`dgram` half), `M4-SEC-DISC-1`, `M4-SEC-DISC-2`, `M4-SEC-DISC-4`, `M4-SEC-TXT-1`, `M4-SEC-DEP-1` and `M4-SR-1` (G-R9, G-R13) pass on the fake stub with no camera on the LAN; `M4-SEC-DISC-3` 2 runs; `M4-DISC-LAN-1` 2 runs (+1 at row 70) outside the command sandbox, each ending in `FOUND (N)`, `EMPTY` or `NOT RUN (reason)`, the report quoting counts and model class only and the tool output holding no address, MAC or serial (D86 C-7)" | D80(1); D82(a); D86 C-7 | **A** — `plus reading the responders' unauthenticated device information` | 1 |
| **BP-132** | 132 | Task; Depends On; Verification | pins equal the C3 totals of row 121 | Task: add "operations 93 `startCaptureDiscovery` and 94 `getCaptureDiscovery`; while a session is in `RECORDING` operation 93 answers `409 INVALID_STATE` (`DISCOVERY_NOT_ALLOWED_WHILE_RECORDING`) until the lift (D86 C-4)". Depends On: "131, 66, 130". Verification: "`M4-DISC-STUB-1` 2 runs and `M4-DISC-REC-1` 2 runs (+1 each at row 70); `M4-DISC-TRIG-1`, `M4-DISC-LIFE-1`, `M4-DISC-RBAC-1`, `M4-SEC-RATE-1` (search bounds), `M4-AUD-1` (`CAPTURE_DISCOVERY_SEARCHED`) and `M4-LOCK-1` pass; after a search `capture_devices` has 0 new rows; `M4-PIN-1` records the values this row lands (94 operations / 36 GET / 58 POST, 64 audit types, `offline` 28) — the final totals 97 / 36 / 61 / 67 hold after rows 133 and 142; INVESTIGATOR is refused" | D86 C-4; D89(c) (owner of op 97 = row 133) | **A** — `pins equal the C3 totals of row 121` | 1 |
| **BP-133** | 133 | Task; Verification | With the fake stub empty, a search raises exactly one alert and one audit row ... | Task: add "and operation 97 `rescanCaptureInputs` (the local-input re-read; owner per D89(c)); the pre-check search has its own allowance". Verification: "`M4-NODEV-A-1` and `M4-NODEV-B-1` 2 runs each (+1 at row 70); `M4-PRECHK-RULE-1`, `M4-MIC-RESCAN-1` and `M4-AUD-1` (`CAPTURE_DEVICE_UNREACHABLE`) pass; `M4-PIN-1` records the values this row lands (95 / 36 / 59, 65 audit types, `offline` 29 when it lands after row 132 and before row 142)" | D89(c); D80(8); SEC35-39 (3) | **P** — `` `M4-NODEV-A-1` and `M4-NODEV-B-1` 2 runs each `` | 0 |
| **BP-134** | 134 | Task; Verification | -> RTSP over TCP on `127.0.0.1` inside 8554-8564, in front of the worker's unchanged stream-copy ingest ... the helper's listener is on `127.0.0.1` only | Task: "... -> H.264 (videotoolbox) pushed as RTSP over TCP into the worker's listening ingest on `127.0.0.1` (the port of the plan, inside 8554-8564); the helper binds no port; the device is opened only when exactly one listed entry equals its name ..." (rest unchanged). Verification: "`M4-LOCAL-AV-1` 2 runs on a generated input before the camera is opened; then, with the permission granted by the user, `M4-LOCAL-CAM-1` 2 runs (+1 each at row 70); `M4-LOCAL-WORKER-1`, `M4-SEC-HELPER-1` (exact name match) and `M4-SEC-PRIV-1` pass; a socket snapshot of the helper shows 0 listening sockets and one TCP connection to `127.0.0.1`; test recordings are at most 10 s, listed with path and size under `.data/`, opened by no agent with a viewing tool and deleted only on the user's instruction (D86 C-7, D87(5)); 0 media in git" | D82(d); D86 C-7; D87(5); SEC35-43 | **A** — `` the helper's listener is on `127.0.0.1` only `` | 1 |
| **BP-135** | 135 | Verification | With permission granted: 10 s through the worker gives the decoded sample count ... | "With the permission granted by the user, `M4-LOCAL-MIC-1` 2 runs (+1 at row 70); `M4-LOCAL-WORKER-1`, `M4-SEC-HELPER-1` (pipe path) and `M4-SEC-PRIV-1` pass; 0 media in git" | D89 (row 127 record §5) | **P** — `` `M4-LOCAL-MIC-1` 2 runs `` | 0 |
| **BP-136** | 136 | Task; Depends On; Verification | Boot refuses `LOCAL_DEVICE` without the development flag (one refusal test) and the flag with a production configuration (one refusal test) ... | Task: add "the capture operation is `SIMULATED`, `REAL_PRODUCTION` or `REAL_DEVELOPMENT` (flag `DEMS_CAPTURE_DEV_SOURCES`; five boot refusals, `cap` §A.1.2); the local camera and microphone are registered as device rows of their own (the next free `CAM-NN` / `MIC-NN`; the built-ins stay `FAKE`, D83); the registry states which kinds have an opener and the plan builder refuses the others (`SOURCE_KIND_NOT_RECORDABLE`) and a mixed session (D82, D86 C-5)". Depends On: "134, 135, 66, 130". Verification: "`M4-SEC-FENCE-1` (the five boot refusals and the stored `LOCAL_DEVICE` cases), `M4-LOCAL-SEL-1`, `M4-LOCAL-PLAN-1` (four sources; a mixed session and a source kind without an opener refused), `M4-LOCAL-ERR-1`, `M4-SEC-HELPER-1` and `M4-SR-1` (G-R12, G-R14, G-R15) pass" | D82(e); D83; D86 C-5 | **P** — `` `M4-SEC-FENCE-1` (the five boot refusals `` | 0 |
| **BP-137** | 137 | Task; Verification | credential prompt (write-only field, never pre-filled) ... the credential is never rendered | Task: "... credential prompt (never pre-filled; a reveal control for the value being typed per D86 C-1; Test enabled only after the confirmation tick) -> connection-test result, ... the development-source label, the 'connecting cameras' state and the 'is on' indicator of a local device". Verification: "`M4-DISC-W`, `M4-DISC-EMPTY-W`, `M4-DISC-RBAC-W`, `M4-DISC-OWNER-W`, `M4-CONN-W`, `M4-CONN-ABANDON-W`, `M4-CONN-LOCK-W`, `M4-CONN-GUARD-W`, `M4-NODEV-B-W`, `M4-MIC-RESCAN-W`, `M4-MIC-ACTIVE-W`, `M4-DEVSRC-LABEL-W` and `M4-SEC-UI-1` pass 2 runs each via agent-browser on a lane with fixture credentials on the fake stub (+1 at row 70); `M4-CONN-NOCRED-1` (UI half), `M4-DEVSRC-LOCAL`, `M4-UX-UNIT`, `M4-UX-VOC-1` and `M4-UX-A11Y-1` pass; a stored credential is never rendered; INVESTIGATOR sees disabled controls; core-web jest `--maxWorkers=2`; `M7-CONN-W-CRED` is run after row 84" | D86 C-1; D84; D89(a) | **P** — `` `M4-CONN-ABANDON-W` `` | 0 |
| **BP-138** | 138 | Task; Verification | the connect flow for the roles and clients row 125 allows ... the credential is never rendered | Task: "... search, candidate list, from the connect flow only the disabled Connect with the sentence that points to the web console (no password field, no call of operations 95 / 96 / 89 — D80(3)), the empty state ...". Verification: "`M4-DISC-T` / `-P`, `M4-DISC-EMPTY-T` / `-P`, `M4-DISC-RBAC-T` / `-P`, `M4-CONN-PTR-T` / `-P`, `M4-NODEV-B-T` / `-P`, `M4-NODEV-NOCFG-T`, `M4-MIC-RESCAN-T` / `-P`, `M4-MIC-ACTIVE-T` / `-P` and `M4-DEVSRC-LABEL-T` / `-P` pass 2 runs each on the lanes (+1 at row 70); no password field exists on tablet or phone; `M4-DEVSRC-LOCAL`, `M4-UX-UNIT`, `M4-UX-VOC-1` and `M4-UX-A11Y-1` pass; mobile jest `--maxWorkers=2`; no PIN typed by an agent" | D80(3) | **A** — `the connect flow for the roles and clients row 125 allows` | 1 |
| **BP-139** | 139 | Verification | On fakes: with 0 cameras the session ends FAULTED with exactly one alert and one audit row and 0 evidence files ... | "`M5-NODEV-C-1` 2 runs on fakes (+1 at row 75): 0 cameras -> `FAULTED`, a failed start with one alert, one audit row, 0 evidence files and 0 evidence items, and the session never presented 'recording' (D84); 1 camera -> recording with one warning; `M5-NODEV-C-W` / `-T` / `-P` 2 runs each" | D84; D72(k) | **P** — `` `M5-NODEV-C-1` 2 runs on fakes `` | 0 |
| **BP-140** | 140 | Verification | Two playable camera files with the one audio track, AV offset within the ±40 ms product bound, 2 runs (+1 at row 75) ... | "With the permission granted by the user: `M5-LOCAL-E2E-1` 2 runs (+1 at row 75); `M5-LOCAL-CLAP-1` once with the user present, recorded as one table row with no media in `docs/`; `M5-SEC-SRC-1` 2 runs; `M5-SEC-PRIV-2-W` / `-T` / `-P` 2 runs each; `M4-SEC-PRIV-1` passes; recordings only under `.data/`, 0 media in git; a missing permission reads 'blocked: user action', never a fail (D89(e))" | D89(c)(e); D86 C-5 | **P** — `` `M5-LOCAL-CLAP-1` once with the user present `` | 0 |
| **BP-141** | 141 | Task; Verification | A package sealed from a development-mode session verifies PASS with the mark reported; a package whose mark was edited FAILs; 2 runs on the server | Task: add "row 83 already builds manifest fields 124-128 (D81); this row adds the exhaustive adapter-kind -> class mapping check, verify check V-15 (15 checks), the report lines, the `sources` block of operation 41 and the `developmentSources` member of operations 39 / 40". Verification: "`M7-DEVSRC-SEAL-1`, `M7-DEVSRC-TAMPER-1` and `M7-SEC-SRC-2` 2 runs each on the server (+1 at row 89); `M7-DEVSRC-BUILD-1` passes; `M7-DEVSRC-EVID-W` / `-T` / `-P` 2 runs each with rows 137 / 138" | D81; D86 C-5 | **P** — `` `M7-DEVSRC-SEAL-1`, `M7-DEVSRC-TAMPER-1` and `M7-SEC-SRC-2` 2 runs `` | 0 |
| **BP-142** | 142 | Task; Verification | the connection test takes its credential only from the write-only operation 89 for that same device (never a default, a guessed one or one stored for another device) | Task: "... the connection test takes its credential only from the body of its own request (operation 95; operation 96 for the re-verification at adoption), typed by the operator in the web console — never a default, a guessed or a stored one; adoption stores it through the operation-89 write path in one transaction (D81); this row lands operations 95 and 96 and the Core-server side of operation 89 with the access condition `WEB_CONSOLE_SESSION` (D89(c)); the test judges codec and profile from the authenticated ONVIF answer and opens no RTSP connection (D82); the lock-out guard is 2 failures per host in 30 minutes, a conservative default without a source (D86 C-2); ..." (rest unchanged). Verification: "`M4-CONN-ATOM-1` 2 runs (+1 at row 70); `M4-CONN-NOCRED-1`, `M4-CONN-OUT-1`, `M4-CONN-SSRF-1`, `M4-CONN-ORDER-1`, `M4-CONN-WEBONLY-1`, `M4-SEC-CONN-1`..`M4-SEC-CONN-4`, `M4-SEC-CRED-1`, `M4-SEC-CRED-2`, `M4-SEC-AUD-1`, `M4-SEC-ADOPT-1`, `M4-SEC-RATE-1` (test bounds), `M4-SEC-NET-1` (`onvif` half), `M4-SR-1` (G-R10, G-R11), `M4-AUD-1` and `M4-PIN-1` (97 / 36 / 61 / 67, Try-it denied 10) pass on the fake stub; adoption with a credential answers `503 CREDENTIAL_STORE_NOT_READY` until row 84" | D81; D82; D86 C-2; D89(c) | **A** — `takes its credential only from the write-only operation 89` | 1 |
| **BP-70** | 70 (gate) | Verification, append | with AP3: the +1 real-LAN probe ends in "N responders found" or, with N = 0, in the R-10 no-camera notification ... | append: "with AP3 the gate also runs the +1 of the 43 M4 checks of `10_test_strategy.md` §A.4a that run 2+1 and reads the results of the 48 that run once: `M4-DISC-LAN-1` ends in `FOUND (N)`, in `EMPTY` with the R-10 notification shown, or in `NOT RUN (reason)`; `M4-CONN-NOCRED-1` shows 0 outbound requests; `M4-SEC-DISC-1` and `M4-SEC-DISC-3` are recorded PASS before part (c) of `M4-DISC-REC-1` is run; identifying results stay in `.data/`" | D89; D86 C-4 | **P** — `the 43 M4 checks` | 0 |
| **BP-75** | 75 (gate) | Verification, append | with AP3: the +1 local-device session yields two playable files and the 0-camera session ends FAULTED with one alert | replace the AP3 clause by: "with AP3: the +1 of `M5-LOCAL-E2E-1` (two playable files), `M5-NODEV-C-1` (`FAULTED`, one alert, 0 evidence items), `M5-NODEV-C-W` / `-T` / `-P`, `M5-SEC-SRC-1` and `M5-SEC-PRIV-2-W` / `-T` / `-P`; `M5-SRC-REC-1` read; the record of `M5-LOCAL-CLAP-1` read, not repeated" | D89; D84 | **P** — `` the record of `M5-LOCAL-CLAP-1` read, not repeated `` | 0 |
| **BP-89** | 89 (gate) | Verification, append | with AP3: a development-mode package verifies PASS with the development-source mark reported (row 141) | replace the AP3 clause by: "with AP3: the +1 of `M7-DEVSRC-SEAL-1` (PASS with the development line first), `M7-DEVSRC-TAMPER-1`, `M7-SEC-SRC-2`, `M7-DEVSRC-EVID-W` / `-T` / `-P` and `M7-CONN-W-CRED`; `M7-DEVSRC-BUILD-1` and `M7-CONN-CRED-1` read; verify runs 15 checks (V-01..V-15); the P1 kill cells show a failed start (D84)" | D81; D89(b) | **P** — `verify runs 15 checks` | 0 |
| **BP-60** | 60 | Verification, append (row not in the brief; owner of the stub) | — | append: "the fake ONVIF stub provides ST-1..ST-3 and ST-5 of `cap` §A.8.1 (no RTSP responder — ST-4 removed, D82) and the generated-input mode used by `M4-LOCAL-AV-1`" | D82 | **P** — `ST-4 removed` | 0 |
| **BP-61** | 61 | Task; Verification, append | ONE definition of capture mode `real` versus the demo flag (one function reads the other) | Task append: "the one function yields `SIMULATED` / `REAL_PRODUCTION` / `REAL_DEVELOPMENT` and is the only reader of `DEMS_CAPTURE_DEV_SOURCES` (the flag and its two config keys land with row 136); every boot writes one `SYSTEM_BOOT` audit row naming the capture operation; every stored adapter kind is inert in `SIMULATED` (D83 O-2)". Verification append: "the guard-family count gains G-R9..G-R15 of `M4-SR-1` as their rows land" | D82(e); D83 (O-2); SEC35-41 (b) | **P** — `` only reader of `DEMS_CAPTURE_DEV_SOURCES` `` | 0 |
| **BP-65** | 65 | Task; Verification, append | — | Task append: "the adapters are Core-process code under `apps/core-server/src/capture/adapters/` (`cap` §A.1.1, D82(b))". Verification append: "`M4-MT-12` (upsert half): `adapter_kind` and `kind` stay out of the SET list" | D82(b); D83 | **P** — `` `M4-MT-12` (upsert half) `` | 0 |
| **BP-66** | 66 | Verification, append | — | append: "`M4-LOCK-1` as amended (operations 89, 95, 96 locked; 93, 94, 97 not); the plan-builder half of `M4-LOCAL-PLAN-1` (four sources; a mixed session and a source kind without an opener refused with `SOURCE_KIND_NOT_RECORDABLE`, before `app.capture.start`); with row 71 the four `session_capture_sources` rows of `M5-SRC-REC-1`" | D86 C-5; D82; D83 | **P** — `` with row 71 the four `session_capture_sources` rows `` | 0 |
| **BP-67** | 67 | Verification, append | — | append: "`M4-SEL-W` as amended (PE-127-07): an adopted `CAM-NN` is selectable; the search entry of the empty state is built by row 137" | D83; row 127 record | **P** — `` `M4-SEL-W` as amended `` | 0 |
| **BP-68** | 68 | Verification, append | — | append: "`M4-SEL-T` and `M4-SEL-P` as amended (PE-127-07): an adopted `CAM-NN` is selectable; the search entry of the empty state is built by row 138" | D83; row 127 record | **P** — `` `M4-SEL-T` and `M4-SEL-P` as amended `` | 0 |
| **BP-71** | 71 | Task; Verification, append | — | Task append: "a session presents 'recording' only from the first `FIRST_DURABLE_FRAGMENT`; `FAULTED` with `durable: false` (`NO_CAMERA_CONNECTED` included) is a failed start with no evidence item; `FAULTED` with `durable: true` goes to the interrupted seal; the ingest-open window is a named setting passed by the launcher (D84); session start writes the four `session_capture_sources` rows before `app.capture.start`, refuses when their class is not the class of the running capture operation, and closes every source handle on every exit path". Verification append: "`M5-SRC-REC-1` passes; with row 139, `M5-NODEV-C-1`" | D84; D83 (D-DB-14); SEC35-40 (4) | **P** — `` `M5-SRC-REC-1` passes `` | 0 |
| **BP-83** | 83 | Task; Verification, append | 120-field manifest | Task: "128-field manifest (fields 124-128 built from the first build, D81; `audio.sourceIntervals[].fromMs` / `toMs` in FILE time of the sealed file; fields 124 / 125 read from `session_capture_sources` only; the item INSERT writes `development_sources`)". Verification append: "`M7-REF-1` is recorded on that manifest" | D81 | **A** — `120-field manifest` | 1 |
| **BP-84** | 84 | Verification, append | — | append: "`M7-CONN-CRED-1` passes: a credentialed adoption (operation 96) answers 201 and a one-character secret is stored — the sealer frames the plaintext to at least 17 bytes (F-122-2); until this row lands operations 89 and 96 answer `503 CREDENTIAL_STORE_NOT_READY` for a credential" | D80(7); D83 (F-122-2); D89(c) | **P** — `` `M7-CONN-CRED-1` passes `` | 0 |
| **BP-85** | 85 | Task, append | 14 checks V-01..V-14 | keep "14 checks V-01..V-14" and append: "(V-15 and the `sources` block of the result are added by row 141; the result shape leaves room for them)" | D81 | **P** — `` V-15 and the `sources` block of the result are added by row 141 `` | 0 |
| **BP-86** | 86 | Verification | Every cell 2 runs (+1 at row 89); final hashes equal an uninterrupted run | "Every cell 2 runs (+1 at row 89); for the clean and P2-P4 cells the final hashes equal an uninterrupted run; the P1 cells assert a failed start — 0 evidence items, no interrupted seal, no sealing step entered (D84, D89(b)); 0 loop-form executions (test §F.3 respected)" | D89(b); D84 | **P** — `the P1 cells assert a failed start` | 0 |
| **BP-115** | 115 | no change | treats a stored `ENCRYPTED` credential kind as unavailable until row 84 lands | no edit. Checked: the `503 CREDENTIAL_STORE_NOT_READY` rule is shared with operations 89 / 96 and nothing in the row's text moves (`identification/02_structured.md:367`; row 127 record §7 item 11) | D80(7) | — | — |
| **BP-117** | 117 | no change | credential never rendered ... consumes the shared client-side blanking rule set (D68(a)) | no edit. Checked: "credential never rendered" stays true for the STT secret; the shared blanking rule set gains the user-name rule in row 142 (SEC35-36 (1)) and is consumed without a wording change (`identification/02_structured.md:369`) | D86 C-6 | — | — |
| **BP-121** | 121 (closed spec row) | Task, dated note | the credential travels only through the existing write-only operation 89 | append, without rewriting the closed row: "**Erratum rev 2.3.1 (D80(7), D81):** the credential travels in the request bodies of operations 95 and 96 (web console only); storing it is the operation-89 write path inside the adoption transaction." | D81 | **P** — `Erratum rev 2.3.1 (D80(7), D81)` | 0 |
| **BP-125** | 125 (closed spec row) | Task, dated note | which clients may enter a capture credential under `CAPTURE_CONFIG` (web System/Devices and tablet/phone Devices, ...) | append: "**Erratum rev 2.3.1 (D80(3)):** camera credential entry is web console only; tablet and phone show the list, the status and the notifications and point to the web console." | D80(3) | **P** — `Erratum rev 2.3.1 (D80(3))` | 0 |
| **BP-X1** | §0.3 :134, §5 :584 | wording | the credential, which travels only through the write-only operation 89 | both lines: "... the credential, which travels only in the request bodies of operations 95 and 96 (web console only) and is stored through the operation-89 write path (D81)" | D81 | **A** — `which travels only through the write-only operation 89` | 1 |
| **BP-X2** | row 69 (:321), RK-38 (:731) | wording | migration `0008` if any ... Totals pinned from C3 (row 121) by one writer (row 132) | row 69: "migration set 4 (`0008` + `0009`)". RK-38: "... a schema change needs migration set 4 (`0008` + `0009`, version `(3, 'dbc-4')`) on four live development databases" and "totals pinned from C3 §10.1 as each of rows 132, 133 and 142 lands its operations" | D83 (D-DB-17); D89(c) | **A** — `` migration `0008` if any `` | 1 |
| **BP-X3** | DP-11 (:604), DP-13 (:606), DP-14 (:607) | status | **pending** — the design answers are given (D74-D76); the row set of rev 2.3 Part B has not been approved | DP-11: "**approved** (AP3 = D78)". DP-13: "named: `onvif` 0.8.3 (MIT) and `xml2js` (D82(a)); row 131 installs". DP-14: "answered (D80(7), D81): operations 89 and 96 answer `503 CREDENTIAL_STORE_NOT_READY` for a credential until row 84; development sources are adoptable from M4" | D78; D80(7); D82(a) | **A** — `the row set of rev 2.3 Part B has not been approved` | 1 |

Not asked and left as written: `bp:893` (the approval text of rev 2.3, history), `bp:848` (a list of
facts not verified at the time, history).

## 6. Erratum rows to append to `masterplan/11_audit_errata.md` §5

Collected from the seven records whose rows were **not** placed by their authors (PE-121-01..16 are
already in §5.8 and are not repeated). Format of §5.8: ID | spec file:line (after the author's
edit) | old text (abridged) | new text | source | decision. The cell texts are the authors', copied
by script; only the column order (row 126) and the file prefix (rows 125, 127) were normalised, and
for row 120 — whose record lists marks, lines and content but no "old text" — the old-text cell
reads "(addition)" or "(cross-reference added)". De-duplication: one row per mark; no mark occurs in
two records. Proposed subsections: §5.9 row 120, §5.10 row 122, §5.11 row 123, §5.12 row 124, §5.13
row 125, §5.14 row 126, §5.15 row 127, §5.16 row 128 (the fix pass).

**Caution for the editor:** the line numbers are those of each author's edit and are already shifted
by later rows in the same file; after the fix pass re-read them with `grep -n "PE-12[0-7]-" <file>`
before placing the rows.

### 6.1 For §5.9 — row 120, `masterplan/01_specs.md` (PE-120-00..10; source `delegation_progress/data_analyst_row120.md` §2)

| ID | spec file:line (after the edit) | old text (abridged) | new text | source | decision |
|---|---|---|---|---|---|
| **PE-120-00** | `masterplan/01_specs.md:243-378` | (addition) | New section **B.2** "Requirements delta rev 2.3 — R-9, R-10, R-11" | `identification/02_structured.md:372`; `delegation_progress/data_analyst_row120.md` §2 | D73-D78; gated D80 |
| **PE-120-01** | `masterplan/01_specs.md:142` | (cross-reference added; no requirement text changed) | R-1 narrative, one sentence appended | `identification/02_structured.md:372`; `delegation_progress/data_analyst_row120.md` §2 | D73-D78; gated D80 |
| **PE-120-02** | `masterplan/01_specs.md:152` | (cross-reference added; no requirement text changed) | R-2 narrative, one sentence appended | `identification/02_structured.md:372`; `delegation_progress/data_analyst_row120.md` §2 | D73-D78; gated D80 |
| **PE-120-03** | `masterplan/01_specs.md:117,580` | (cross-reference added; no requirement text changed) | A.2 and G.1 completion line: pointer to `structured` §5 (wording not restated) | `identification/02_structured.md:372`; `delegation_progress/data_analyst_row120.md` §2 | D73-D78; gated D80 |
| **PE-120-04** | `masterplan/01_specs.md:387` | (cross-reference added; no requirement text changed) | C-N4: pointer to C-N13 | `identification/02_structured.md:372`; `delegation_progress/data_analyst_row120.md` §2 | D73-D78; gated D80 |
| **PE-120-05** | `masterplan/01_specs.md:396` | (addition) | Constraint **C-N13** — discovery socket, the SEC35-23 exception with 7 bounds | `identification/02_structured.md:372`; `delegation_progress/data_analyst_row120.md` §2 | D73-D78; gated D80 |
| **PE-120-06** | `masterplan/01_specs.md:397` | (addition) | Constraint **C-N14** — development fence | `identification/02_structured.md:372`; `delegation_progress/data_analyst_row120.md` §2 | D73-D78; gated D80 |
| **PE-120-07** | `masterplan/01_specs.md:398` | (addition) | Constraint **C-N15** — credential-gated connectivity; agents on the real network | `identification/02_structured.md:372`; `delegation_progress/data_analyst_row120.md` §2 | D73-D78; gated D80 |
| **PE-120-08** | `masterplan/01_specs.md:562` | (cross-reference added; no requirement text changed) | F, row M4: pointer to B.2 and G.2 | `identification/02_structured.md:372`; `delegation_progress/data_analyst_row120.md` §2 | D73-D78; gated D80 |
| **PE-120-09** | `masterplan/01_specs.md:586-587,598` | (addition) | Class-C table: C-1 and C-2 reworded, paragraph "Moved class-C boundary" | `identification/02_structured.md:372`; `delegation_progress/data_analyst_row120.md` §2 | D73-D78; gated D80 |
| **PE-120-10** | `masterplan/01_specs.md:669` | (addition) | Self-gate row for R-9..R-11 | `identification/02_structured.md:372`; `delegation_progress/data_analyst_row120.md` §2 | D73-D78; gated D80 |

### 6.2 For §5.10 — row 122, `masterplan/04_database_contract.md` (PE-122-01..15)

| ID | spec file:line (after the edit) | old text (abridged) | new text | source | decision |
|---|---|---|---|---|---|
| **PE-122-01** | `masterplan/04_database_contract.md:14,22,33-42,1486` | front matter `contract_revision: dbc-3` only; no note on a later delta | `pending_revision: dbc-4, schema_version 3`; note under the title: sections 0-M are dbc-3, section N is the dbc-4 delta, verdict "schema change — yes", figures of 0-M not restated; footer | `identification/02_structured.md:374` | D73, D78, D80, D81 |
| **PE-122-02** | `04:964-976` (N.1, new) | §B.13 "the DDL joins 0004 (table) and 0005 (privileges)" | as built: `0006` + `0007`; version `(2, 'dbc-3')`; `dems_demo` read 2026-10-09; composed counts 40 / 419 / 166 / 39; next free numbers `0008`, `0009` | `apps/core-server/src/db/migrations/meta/_journal.json`; `0007_stt_config_privileges.sql:61` | D24 (as built by row 112) |
| **PE-122-03** | `04:253-259`, `04:978-1058` (N.2) | `capture_devices`: 12 columns; "discovery only adds/updates" | 13th column `adapter_kind` (closed set of five, `DEFAULT 'FAKE'`, no UPDATE grant), two CHECKs; options (a)/(b)/(c); writers table; a search adds nothing | `masterplan/03_api_contract.md` §2.6 "Device shapes"; `masterplan/05_capture_architecture_spec.md` §A.1.1 | D73, D80(9), D81; D-DB-11..13 |
| **PE-122-04** | `04:358-360`, `04:1060-1112` (N.3) | (no session-start record) | new table `session_capture_sources` (T-41), INSERT-only, four rows per session; rules MR-S1..S5; `session_audio_intervals` gets no column | `masterplan/06_evidence_package_spec.md` §B.12 rule 3, §E.6; `delegation_progress/data_analyst_row124.md` §7 | D81; D-DB-14 |
| **PE-122-05** | `04:481-485`, `04:1114-1130` (N.4) | `evidence_items`: three v2 sealed columns | fourth sealed column `development_sources boolean NULL` (copy of manifest field 126; NULL = not recorded); nothing on `evidence_tracks` | `delegation_progress/data_analyst_row124.md` §7 (b); `masterplan/01_specs.md` R-11 AC-6 | D78(2), D81; D-DB-16 |
| **PE-122-06** | `04:1132-1168` (N.5, new) | (no statement) | candidates: Core memory only, consequences; matching key `onvif_uuid` then whole `address`; partial unique index `capture_devices_onvif_uuid_key`; id minting | `masterplan/03_api_contract.md` §2.6; `apps/core-server/src/db/seed/seed.ts:157-158` | D75, D76(1), D81; D-DB-15 |
| **PE-122-07** | `04:1170-1188` (N.6, new) | (no statement) | CHECK inventory for the four audit types, their categories and keys, and the alerts: no CHECK change | `apps/core-server/src/db/migrations/0001_tables.sql:194-199,216-220,383`; `0004_capture.sql:217,227,228` | D80(8), D81 |
| **PE-122-08** | `04:306-311`, `04:1190-1201` (N.7) | §B.3: written "only through operation 89" | operation 96 writes the row in the adoption transaction through the same store; grants cover it; finding F-122-2 (plaintext framed to 17 bytes or more) | `apps/core-server/src/db/migrations/0005_capture_privileges.sql:17-28,44-45`; `0004_capture.sql:29` | D80(7), D81 |
| **PE-122-09** | `04:1203-1303` (N.8, new) | (no set 4) | files `0008_capture_sources.sql` + `0009_capture_sources_privileges.sql`, statements, matrix, no blanket SELECT, down path none, order of application | dbc-2 MG-2, MG-4, MG-5, MG-6 | D-DB-17 |
| **PE-122-10** | `04:1305-1334` (N.9, new) | B-3 expects `(2, 'dbc-3')` | `(3, 'dbc-4')` after row 129; no B-10; fence = capture boot check with query Q-SRC; refused / ignored / inert rules | `masterplan/05_capture_architecture_spec.md` §A.1.2; `apps/core-server/src/db/schema/boot-checks.ts:36` | D72(l), D73; D-DB-18 |
| **PE-122-11** | `04:723-727`, `04:838-841`, `04:1336-1356` (N.10) | kept set 12; fixture `capture_devices` 8 | kept set 12 unchanged, adopted devices kept; seed 5 built-ins `FAKE`, 0 source rows today; fixture `capture_devices` 12, `session_capture_sources` 1,600, `evidence_items` mix | `apps/core-server/src/db/reset/kept-tables.ts:58-62`; `seed/seed.ts:133-163` | D-DB-08 (kept), D81 |
| **PE-122-12** | `04:1358-1378` (N.11, new) | 40 tables, 419 columns, 166 CHECKs, 39 foreign keys | 41 / 426 / 172 / 40; 41 PKs; 4 unique indexes; 44 value sets; 10 files; `(3, 'dbc-4')` | `apps/core-server/test/db/contract-inventory.test.ts:50-59` | — |
| **PE-122-13** | `04:1380-1423` (N.12, new) | checks MT-1..MT-8 | MT-9..MT-16; the two document pins unchanged; 15 groups of code pins that move with row 129; 2 that stay | `apps/core-server/test/db/*.ts` (file:line in N.12) | — |
| **PE-122-14** | `04:913`, `04:1425-1436` (N.13) | decisions D-DB-01..10 | D-DB-11..18 with rejected alternatives | — | this row |
| **PE-122-15** | `04:1438-1483` (N.14-N.16) | (no hand-over for rev 2.3) | hand-over per row; assumptions A-122-1..3, open points O-1..O-8, gaps G-1..G-2; self-gate | `identification/02_structured.md:374-393` | D73 |

### 6.3 For §5.11 — row 123, `masterplan/05_capture_architecture_spec.md` (PE-123-01..15)

| ID | spec file:line (after the edit) | old text (abridged) | new text | source | decision |
|---|---|---|---|---|---|
| **PE-123-01** | `masterplan/05_capture_architecture_spec.md:60` (§0) | (no row for the new scope) | decision-inputs row: probe-only discovery owned by the Core, credential-gated connectivity, `LOCAL_DEVICE` in front of the unchanged worker, development flag, D72(k) notification | `decisions/decisions.md:85-93` | D72(k), D73-D78, D80 |
| **PE-123-02** | `:115-173` (§A.1.1) | Target `apps/capture-worker/src/adapters/`; no adapter kind | adapters are Core-process code under `apps/core-server/src/capture/adapters/`; `CaptureAdapterKind`, `CaptureSourceClass`; registry rules RG-1..RG-5; development slots | `implementation/20_m3_worker_engine.md` §0; `packages/capture-protocol/src/index.ts:264-265` | D73, D74, D76, D80(9), D80(11) |
| **PE-123-03** | `:175-229` (§A.1.2) | (no development flag) | keys `DEMS_CAPTURE_DEV_SOURCES`, `DEMS_CAPTURE_HELPER_FFMPEG`; `CaptureOperation` = `SIMULATED` / `REAL_PRODUCTION` / `REAL_DEVELOPMENT`; ten-row table; "production configuration" defined | `delegation_progress/pair_58_navigator_a.md:40`; `apps/core-server/src/modules/capture-config/fencing.ts:55-57`; `apps/core-server/src/config.ts:41-45` | D72(l), D73 |
| **PE-123-04** | `:424-494` (§A.6.1) | `discover(): Promise<CameraDescriptor[]>`, real implementation class C | probe-only WS-Discovery: V-1..V-12, message flow, DS-1..DS-15 | WS-Discovery 1.1 §3.1.1, §3.1.3, §5.3, §8.1; ONVIF Core 26.06 §7.1-§7.3.3, §8.3.1 | D74 (1), D75, D76 (1), D80(1), D80(11) |
| **PE-123-05** | `:496-545` (§A.6.1a) | "Q-INSTALL item 6 permits an ONVIF npm" (no package named) | `onvif` 0.8.3 (MIT) named; O-1..O-8; own probe over `node:dgram` for discovery, the package for the connection test only; licence entries for row 96 | `report/report.md:72`; `identification/02_structured.md:606`; `research/02_collection.md:155-157`; package source 0.8.3 `lib/discovery.js`, `lib/cam.js:94`, `:106`, `:121-123` | D4 (Q-INSTALL), D80(1) |
| **PE-123-06** | `:547-594` (§A.6.2) | (no connect sequence) | seven steps; `testConnection` outcomes `UNREACHABLE` / `AUTHENTICATION_FAILED` / `WRONG_PROFILE` / `NOT_H264` / `REACHABLE` by observation; CT-1..CT-7 | `masterplan/01_specs.md:291-297` | D76, D80(4), D80(7), D80(11) |
| **PE-123-07** | `:596-625` (§A.6.3) | "the credential is injected only at the worker spawn point" | CR-1..CR-7; credential as separate fields on standard input of the process that opens the RTSP session; as built no such process exists for a real camera (class C-2 gap) | `packages/capture-protocol/src/index.ts:245`, `:264-265` | D76, D80(7); SEC35-04 |
| **PE-123-08** | `:627-693` (§A.6.4) | (no local-device kind) | camera helper = FFmpeg program pushing RTSP/TCP to the worker's listen ingest; exact argument line; GOP 30 frames at 30 fps; wall-clock options; fake camera of slot 2; HL-1..HL-14 | `apps/capture-worker/src/ingest.c:281`, `:304`, `:335-340`; `apps/capture-worker/test/m3worker.py:777`; probes P-1..P-5 | D73, D74, D80(11) |
| **PE-123-09** | `:695-732` (§A.6.5) | (no session-start rule in this spec) | 0 / 1 / 2 cameras table; who raises what; "connecting cameras" until the first durable fragment | `implementation/20_m3_worker_engine.md` fix round 1; `packages/capture-protocol/src/index.ts:142`; `apps/capture-worker/src/ingest.c:88-94` | D72(g), D72(h), D72(i), D72(k), D80(6), D80(8) |
| **PE-123-10** | `:765-814` (§A.7.1) | `open(inputId): Promise<AudioStreamHandle>` (handle undefined) | handle names the `PCM_FIFO` transport; mic helper line; fake mic of slot 2; ML-1..ML-8 | `packages/capture-protocol/src/index.ts:137`, `:165-172`; `apps/capture-worker/test/fake_mic.c:1-18` | D73, D74, D80(5), D80(11) |
| **PE-123-11** | `:853-872` (§A.8.1) | "`fake-onvif-stub`" (one word) | ST-1..ST-5: unicast probe answers, hostile answers, device service with fixture account, RTSP `DESCRIBE`-only responder, request log | `masterplan/01_specs.md:289`, `:300` | D74 (1), D76 |
| **PE-123-12** | `:1235-1268` (§G.1) | G-R1..G-R8 | SEC35-23 exception stated; G-R9 (`node:dgram` one file), G-R10 (`node:net` one file, no `SETUP` / `PLAY`), G-R11 (`onvif` one file, pinned calls), G-R12 (helpers through `ipc.ts`), G-R13 (`discover` call sites), G-R14 (no credential literal, no fake substitution), G-R15 (flag read once); G-R4 and G-R6 extended | `apps/core-server/src/capture/__tests__/static.test.ts:38`, `:128`, `:134` | D73-D76, D80; SEC35-23, SEC35-25 |
| **PE-123-13** | `:1339-1354` (§I) | "P25 edit count: 14" | planned edits 15-18 in `config.ts` (two capture config keys, OD-14 category 3); 18 planned; no edit of `app.ts` / `index.ts` | `apps/core-server/src/config.ts:41-45` | D73, D72(l); OD-14 |
| **PE-123-14** | `:1371-1372`, `:1376-1386` (§J) | H-7 "ONVIF discovery / profile listing / NTP set work against the target camera ... class C-1" | H-7a (unauthenticated discovery, scheduled) and H-7b (authenticated actions, class C); H-11..H-21 | — | D75, D76, D80(1) |
| **PE-123-15** | `:31`, `:1406`, `:1423` | front matter, self-gate, footer | range PE-123-01..PE-123-15 named; self-gate row | — | D80 |

### 6.4 For §5.12 — row 124, `masterplan/06_evidence_package_spec.md` (PE-124-01..15)

| ID | spec file:line (after the edit) | old text (abridged) | new text | source | decision |
|---|---|---|---|---|---|
| **PE-124-01** | `masterplan/06_evidence_package_spec.md:25-26,76-77` | decisions "(D4, D7, D8, D10, D12)"; §0.1 ends at OD-21 | rev 2.3 decisions named; two §0.1 rows for the development-source mark and for the first video sample / origin | `decisions/decisions.md` D66, D72-D74, D78, D80 | D73, D78, D80 |
| **PE-124-02** | `06:436-502` (§B.12, new) | (no source-class field) | fields 124 `tracks[].sourceClass`, 125 `audio.sourceIntervals[].sourceClass` (enum `PRODUCTION` / `LOCAL_DEVICE` / `FAKE`, not null), 126 `developmentSources` (boolean, derived); 7 rules; dependency on row 121; alternatives | `masterplan/01_specs.md` R-11 AC-7, §B.2.6 item 7; `identification/02_structured.md:376` | D73, D78 (2), D80 (9) |
| **PE-124-03** | `06:181,245,266` | (B.1, B.4, B.5 without pointers) | pointers to fields 126; 124, 127, 128; 125 | — | D73, D80 (9) |
| **PE-124-04** | `06:383-388,390-391,399-409` (§B.10) | canonical body: two exclusions, nothing on new fields; example without them | the two exclusions are the only ones; fields 124-128 are in the signed digest; example extended | `06` §B.10 | D73, D78 (2) |
| **PE-124-05** | `06:329-330,536-544` | "Field count: 120 field definitions ... 120/120"; B.7a "120-field figures ... not restated" | **128** = 120 + 3 (D24) + 3 (source class) + 2 (first video sample) | `06` §B.7a (PE-R8-07) | D24, D73, D66 |
| **PE-124-06** | `06:567` (§C.1) | (no statement) | the mark is covered by the seal signature; editing it fails V-03, or V-09 if the digest is recomputed | `06` §B.10, §D | D78 (2) |
| **PE-124-07** | `06:624,626,637-648` (§D, §D.1 new) | "Verify count: 14 checks" | check V-15 (passes and reports; MISSING / CORRUPT only for a missing or inconsistent mark); count 15; report lines, `sources` block, status unchanged | `masterplan/01_specs.md` R-11 AC-7 | D78 (2), D80 (9) |
| **PE-124-08** | `06:674,708,728-736` (§E.1, §E.4, §E.6 new) | (no statement) | written in `BUILD_MANIFEST` from the session-start record; fails closed; interrupted seal carries it; steps stay 8 | `06` §E.1 | D73, D78 (2) |
| **PE-124-09** | `06:800` (§G.2) | (no statement) | the mark travels with every export | `06` §G | D78 (2) |
| **PE-124-10** | `06:863-872` (§H.5, new) | (no statement) | an all-`PRODUCTION` manifest is not distinguishable from a truly production package; guards: boot fence, Core-written class, signature; "declared" wording | `masterplan/01_specs.md` R-11 AC-1, AC-2, C-N14; `06` §C.3 | D73, D72 (l) |
| **PE-124-11** | `06:648` | (no statement) | display is owned by row 125; the label derives from the manifest or the verify result | `identification/02_structured.md:377` | D73 |
| **PE-124-12** | `06:459-460,512-521` | (no field; `cap §C.4` says "record the true first video pts per camera file in the manifest") | fields 127 `tracks[].firstVideoSamplePts`, 128 `tracks[].firstVideoSampleTimescale`, nullable, from the `FIRST_VIDEO_SAMPLE` record | `packages/capture-protocol/src/index.ts:148-155,427-438`; `masterplan/05_capture_architecture_spec.md:569` | D66 (4b), D72 (d), D72 (e) |
| **PE-124-13** | `06:523-534` | (no statement) | file time 0 = T0 − 1024/48000 s under the pinned flags; origin of the interval fields named as open | `packages/shared/src/api/capture.ts:61-82`; `masterplan/05_capture_architecture_spec.md:683` | D72 (d) |
| **PE-124-14** | `06:504-510` | (no statement) | v2: fields required, absence fails, never read as `PRODUCTION`; no schema or version step; v1 untouched | `grep -rl "dems.evidence-manifest/2" packages apps` = 0 files | D73 |
| **PE-124-15** | `06:880,882,888-889,909-910,915` | self-gate "120/120", "14 checks"; references; footer | 128/128, 15 checks, a self-gate row for row 124, rev 2.3 references | — | D73 |

### 6.5 For §5.13 — row 125, `masterplan/08_client_ux_spec.md` (PE-125-01..19)

| ID | spec file:line (after the edit) | old text (abridged) | new text | source | decision |
|---|---|---|---|---|---|
| **PE-125-01** | `masterplan/08_client_ux_spec.md:28, 50-56, 1575 (front matter, authority note, footer)` | decisions "(D4, D8, D10, D12)"; no rev 2.3 note | rev 2.3 decisions named; paragraph on flows 9-13 and the binding rulings; dates | `identification/02_structured.md:377` | D73, D78, D80, D81 |
| **PE-125-02** | `masterplan/08_client_ux_spec.md:99-111 (§0)` | (no table) | table "Rev 2.3 rulings applied by flows 9-13" (D80(2)-(7), (9)-(11), D81) | `decisions/decisions.md:93-94` | D80, D81 |
| **PE-125-03** | `masterplan/08_client_ux_spec.md:129-134 (§1)` | catalogue ends at flow 7 | rows 8 (restated), 9-13 with operations, slices, audit | `masterplan/03_api_contract.md` §2.5, §2.6, §3.1, §5.4 | D73, D80 |
| **PE-125-04** | `masterplan/08_client_ux_spec.md:160, 197, 198, 209 (flow 1)` | two seeded camera rows; "No capture devices configured"; no development refusal | adopted cameras selectable; badge; the empty state gains "Search for cameras"; `DEVELOPMENT_SOURCE_NOT_ALLOWED` row; "Source options" row | `01_specs.md` R-10 AC-1, R-11 AC-2; `03` §3.1 | D73, D80(9) |
| **PE-125-05** | `masterplan/08_client_ux_spec.md:281 (flow 2 §3.6)` | (no row) | badge on mic meters and tiles | `01_specs.md` R-11 AC-6 | D73 |
| **PE-125-06** | `masterplan/08_client_ux_spec.md:445, 482 (flow 5)` | verify without a source line | "DEVELOPMENT SOURCES — …" first, verdict unchanged; badge on item and files from the manifest or the verify result | `06_evidence_package_spec.md` §B.12, §D.1 | D78(2), D80(9), D81 |
| **PE-125-07** | `masterplan/08_client_ux_spec.md:576, 599, 600 (flow 7)` | "precheck states (existing)" | reachability check, start rule, two new situations | `03` §3.1 | D72(k), D80(6), D81 |
| **PE-125-08** | `masterplan/08_client_ux_spec.md:638-677 (§8b, new)` | — | frame of the delta (5W1H) and the table of existing building blocks per client | client sources read on 2026-10-09 | D73; standing rule "ready-made kit" |
| **PE-125-09** | `masterplan/08_client_ux_spec.md:680-775 (§8c, new)` | — | flow 9 "Search for cameras": 13 states × 3 clients, row content, freshness and ownership, G13 | `03` §2.6 (ops 93, 94) | D74(1), D76, D80(1), D80(4), D80(10) |
| **PE-125-10** | `masterplan/08_client_ux_spec.md:778-907 (§8d, new)` | — | flow 10 "Connect a camera", web console only: prompt rules, five outcomes, refusals incl. the state before row 84, adoption result, abandon / close, tablet and phone pointer, G14-G16 | `03` §2.6 (ops 95, 96), §4 | D76, D80(3), D80(4), D80(7), D81 |
| **PE-125-11** | `masterplan/08_client_ux_spec.md:910-975 (§8e, new)` | — | flow 11: situations A, B, C and C-degraded with placement per client, severity, text keys, action, clearing; the operator without `CAPTURE_CONFIG` | `03` §5.4; `01_specs.md` R-10 | D72(h)(i)(k), D80(2), D80(8) |
| **PE-125-12** | `masterplan/08_client_ux_spec.md:978-1059 (§8f, new)` | — | flow 12: the one badge, 7 surfaces with data sources, sealed-item rules, local-device rows (4 states), production / Simulated-mode / privacy rules | `03` §2.6 "Device shapes"; `06` §B.12, §D.1 | D74(2), D78(2), D80(9), D80(11), D81 |
| **PE-125-13** | `masterplan/08_client_ux_spec.md:1062-1126 (§8g, new)` | — | flow 13: op 97 states, the start rule at pre-check incl. the active-microphone rule, G17, G18 | `03` §2.6, §3.1 | D80(5), D80(6), D81 |
| **PE-125-14** | `masterplan/08_client_ux_spec.md:1138, 1141, 1144, 1147 (§9)` | P-04, P-07, P-10, P-13 without the new flows | one sentence each (one new factory; blanking of `username` / `secret` / `credential`; constant border on the search list; 18 controls + 8 reads) | `drift §2.1` | D73 |
| **PE-125-15** | `masterplan/08_client_ux_spec.md:1187-1194, 1201-1206 (§11)` | inventory ends at G10; "10/10", "6/6" | rows G11-G18; restated 18/18 controls, 46 instances, 8/8 reads (baseline figures kept) | §8a (PE-R8-13) | D24, D73 |
| **PE-125-16** | `masterplan/08_client_ux_spec.md:1223 (§12)` | (no row) | camera search and development sources: this phase vs class C | `01_specs.md` R-11 AC-10 | D80(11) |
| **PE-125-17** | `masterplan/08_client_ux_spec.md:1246-1320 (§13.1, new)` | — | self-gate of the delta; "stored credential shown" 0 of 13; totals with arithmetic; register items touched; list of changed existing text | this row | D73 |
| **PE-125-18** | `masterplan/08_client_ux_spec.md:1330-1512 (§14, new)` | — | vocabulary table; 120 proposed keys with texts; accessibility table | `packages/shared/src/i18n/en/common.ts` (read only) | D73 |
| **PE-125-19** | `masterplan/08_client_ux_spec.md:1516-1570 (§15, new)` | — | hand-over to rows 126, 127, 133, 137, 138, 139 (+128, 141); 20 named check families; open items OP-125-1..7 | `masterplan/10_test_strategy.md:192-194` (naming) | D73 |

### 6.6 For §5.14 — row 126, `masterplan/09_security_design_review.md` (PE-126-01..05)

| ID | spec file:line (after the edit) | old text (abridged) | new text | source | decision |
|---|---|---|---|---|---|
| **PE-126-01** | `masterplan/09_security_design_review.md:27-28` | front matter `last_updated` (status sweep) | row-126 entry prepended; new key `delta_row_126` with the verdict and counts of the delta | blueprint row 126; D73-D84 | D73-D84; gated D86 |
| **PE-126-02** | `masterplan/09_security_design_review.md:40-43` | — | pointer under the row-35 verdict: the new scope is reviewed in §11 with its own verdict; counts not merged | row 126 | D73-D84; gated D86 |
| **PE-126-03** | `masterplan/09_security_design_review.md:368-371` | §6 ended at "The only exposure-shaped gap is the unpinned RTSP ingest bind (SEC35-23)." | pointer: one bounded exception (discovery socket) and the first outbound connections; table in §11.8 | D75; `01_specs.md` C-N13 | D73-D84; gated D86 |
| **PE-126-04** | `masterplan/09_security_design_review.md:438-773` | — | new section 11: frame, evidence, findings SEC35-27..SEC35-49 by the row's six points, socket summary, hand-over, hypotheses H-22..H-26, decisions, GDPR / ISO view, self-gate | rows 120-125; D72-D84 | D73-D84; gated D86 |
| **PE-126-05** | `masterplan/09_security_design_review.md:777` | footer `Last Updated` (status sweep) | row-126 entry prepended | row 126 | D73-D84; gated D86 |

### 6.7 For §5.15 — row 127, `masterplan/10_test_strategy.md` (PE-127-01..18)

| ID | spec file:line (after the edit) | old text (abridged) | new text | source | decision |
|---|---|---|---|---|---|
| **PE-127-01** | `masterplan/10_test_strategy.md:9, 30, 35, 56-63, 1040` | front matter without a delta key; short forms end at `ux`; "There is no third class…" | key `delta_row_127`; short forms `dbc-4`, `sec`; paragraph pointing to §A.4a, the manual check in class `1`, "not run" as a valid outcome; footer | `identification/02_structured.md:379` | D73, D78, D80-D86 |
| **PE-127-02** | `masterplan/10_test_strategy.md:216-382` | (no section) | §A.4a: rules CR-1..CR-7 and eight check tables, 111 checks (M4 91, M5 11, M7 9) | records of rows 120-126; `01_specs.md` §B.2 | D73, D78, D80-D86 |
| **PE-127-03** | `masterplan/10_test_strategy.md:384-436` | (no table) | traceability: 32 acceptance criteria -> named checks with method, depth, owning row, negative control | `01_specs.md:287-333` | D73 |
| **PE-127-04** | `masterplan/10_test_strategy.md:438-526` | (no table) | index of changed existing checks (before / after); the 34 assumed values G-1..G-34 for row 128; count of the section | D80-D86; the seven input specs | D86 C-8 |
| **PE-127-05** | `masterplan/10_test_strategy.md:139, 146, 149, 150, 152, 155` | `M2-LANE-1`, `M2-MT-6`, `M2-API-1`, `M2-API-2`, `M2-PIN-1`, `M2-AUD-1` at the M2 values | dated sentences: schema 3 / `dbc-4` after row 130; reset-guard exemption; targets 97 / 36 / 61, offline 31, 67 types, re-pinned by `M4-PIN-1` / `M4-PIN-2` | `03_api_contract.md` §10.1; `04_database_contract.md` §N.11 | D83, D86 |
| **PE-127-06** | `masterplan/10_test_strategy.md:175, 177` | `M3-SR-1`: G-R1..G-R8; `M3-RTSP-BIND-1`: worker sockets | from M4 the guard file also holds G-R9..G-R15 (`M4-SR-1`); the discovery socket is the Core's (`M4-DISC-SOCK-1`), helpers bind nothing | `05_capture_architecture_spec.md` §G.1 | D75, D82 |
| **PE-127-07** | `masterplan/10_test_strategy.md:201-204, 209-214` | M4 gate set 14; `M4-SEL-W/T/P`, `M4-LOCK-1`, `M4-FAKE-1`, `M4-PC-1` | gate set 14 + 91 = 105; adopted `CAM-NN` selectable; ops 89 / 95 / 96 locked, 93 / 94 / 97 not; adapters in the Core process, discovery no longer class C; controls G13-G17 | `03_api_contract.md` §3.1; `05` §A.1.1 | D80(4), D82, D83, D86 C-4 |
| **PE-127-08** | `masterplan/10_test_strategy.md:533-536` | M5 gate set 13 | 13 + 11 = 24 | `identification/02_structured.md:327` | D78 |
| **PE-127-09** | `masterplan/10_test_strategy.md:595-598, 603, 609` | M7 gate set 52 + 10 conditional; `M7-REF-1`; `M7-VV-SRV` "14 checks" | 61 + 10 conditional; reference on a manifest with fields 124-128; 15 checks from row 141 on | `06_evidence_package_spec.md` §B.12, §D | D81 |
| **PE-127-10** | `masterplan/10_test_strategy.md:746, 755-759` | pin families at the M2 values; X-PIN-1 stale list | one row for the R-9..R-11 pins; the stale list extended | `03` §10.1; `04` §N.12 | D83 |
| **PE-127-11** | `masterplan/10_test_strategy.md:769, 792, 800-807` | (a) guard row of `src/capture` with G-R1..G-R8; (b) "expected at M9" row with an unescaped pipe character (4 cells under a 3-cell header) | (a) G-R9..G-R15 from M4, no new guard file, counts unchanged, the network scanner's two exemptions; (b) the pipe escaped | `05` §G.1; SEC35-27 | D82 |
| **PE-127-12** | `masterplan/10_test_strategy.md:846-852` | P1: "the durable part is sealed" | open-point note: D84 makes that case a failed start with no evidence item; matrix and counts unchanged | `decisions/decisions.md:97` | D84 (ruling pending) |
| **PE-127-13** | `masterplan/10_test_strategy.md:901-904` | exclusions end at "real hardware checks" | four rows: real camera credentials, local-device media, macOS permission, identifiers of devices on the user's network | `01_specs.md:302`, `:331-332` | D74(3), D75, D76(4), D86 C-7 |
| **PE-127-14** | `masterplan/10_test_strategy.md:938, 939, 941` | `X-MEDIA-1`, `X-PIN-1`, `X-SEC-1` | dated sentences: local-device stills / waveforms / transcripts; the new stale values; device-identifying patterns and the canary prefixes | record of row 126 §6 | D86 C-6, C-7 |
| **PE-127-15** | `masterplan/10_test_strategy.md:947, 948` | "M4 14, M5 13, … M7 52 … 219 active … 229 named — 91 run 2+1 … 128 run once" | "M4 105, M5 24, … M7 61 … 330 active … 340 named — 150 run 2+1 … 180 run once" with the erratum sentence carrying the arithmetic; new self-gate row "32/32" | this row | D73, D78, D83 |
| **PE-127-16** | `masterplan/10_test_strategy.md:955, 960-961, 967-969, 972, 975-977, 986-1014` | section L items 1, 2, 4, 5 as of the pair-review re-pin | re-run notes; the row-127 step of the class arithmetic; item 6 = the mechanical recount with its output | this row | — |
| **PE-127-17** | `masterplan/10_test_strategy.md:1028-1033` | section M ends at the second-gate bullet | bullet for row 128 and for the task-architect | this row | — |
| **PE-127-18** | `masterplan/10_test_strategy.md:659-664` | class-C register: "C-2/C-1/C-3/C-4 real adapters and ONVIF/PoE" | unauthenticated discovery and the connection test on fixtures are scheduled; actions on a real camera and the pull path stay class C | `05` §J H-7a / H-7b | D75, D82, D86 C-5 |

Count: 11 + 15 + 15 + 15 + 19 + 5 + 18 = **98** rows
(expected 11 + 15 + 15 + 15 + 19 + 5 + 18 = 98).

### 6.8 For §5.16 — row 128, the fix pass (PE-128-01..94)

One mark per row of section 2, in the order of that table. The editor writes the mark at the edit
and fills the line number after the pass; "old text" and "new text" are the "current" and
"required" cells of section 2 (abridged here to the first 110 characters).

| ID | Fix | spec file | old text (abridged) | new text (abridged) | decision |
|---|---|---|---|---|---|
| **PE-128-01** | FX-01-01 | `masterplan/01_specs.md` | the credential travels only through the existing write-only operation 89 | the credential travels only in the request body of the connection test (operation 95, held in memory for that … | D81; D80(7); D86 C-5 |
| **PE-128-02** | FX-01-02 | `masterplan/01_specs.md` | vendor / model / name where the device announces them (scopes) ... the matching key is fixed by rows 121/122 | name and hardware (model) hints from the announced scopes; a vendor hint only when a device announces a non-st … | D83 (D-DB-15); cap V-9 |
| **PE-128-03** | FX-01-03 | `masterplan/01_specs.md` | the credential is written through operation 89 for that device only -> the connection test runs ... **2 + 1** … | the web console asks the operator for the camera credential (web console only, D80(3)) -> it is sent in the bo … | D81; D80(3); D80(7) |
| **PE-128-04** | FX-01-04 | `masterplan/01_specs.md` | takes its credential from one place only: the operation-89 entry written by an operator for **that same device … | takes its credential from one place only: the `credential` member of the request of operation 95 or 96, typed … | D81; D80(7) |
| **PE-128-05** | FX-01-05 | `masterplan/01_specs.md` | on tablet and phone this row **proposes** to allow it as well ... the client set is an **open point for row 12 … | Entering the camera credential is **web console only** in this phase (D80(3)); the server enforces it (`WEB_CO … | D80(3) |
| **PE-128-06** | FX-01-06 | `masterplan/01_specs.md` | (no statement about RECORDING) | append: "**Narrowed by D86 C-4:** while the session state is `RECORDING`, operation 93 answers `409 INVALID_ST … | D86 C-4 (narrows D80(4)) |
| **PE-128-07** | FX-01-07 | `masterplan/01_specs.md` | (no statement on the state before the first durable fragment) | append: "Until the first durable fragment the session presents 'connecting cameras', never 'recording'. `FAULT … | D84; D82(f) |
| **PE-128-08** | FX-01-08 | `masterplan/01_specs.md` | 2 alerts, 2 audit rows, 0 stale banners | 2 alerts and 0 stale banners; audit rows per situation as C3 §5.4 — A: one `CAPTURE_DISCOVERY_SEARCHED` row pe … | D80(8); C3 §5.4 (more specific) |
| **PE-128-09** | FX-01-09 | `masterplan/01_specs.md` | With the flag off, operations 76 / 77 list **0** development sources | In `REAL_PRODUCTION` (capture mode real, development flag off) operations 76 / 77 list **0** development sourc … | D83 (O-2) |
| **PE-128-10** | FX-01-10 | `masterplan/01_specs.md` | (no statement on device ids) | append: "The local camera and the local microphone are device rows of their own (the next free `CAM-NN` / `MIC … | D83 (D-DB-13) |
| **PE-128-11** | FX-01-11 | `masterplan/01_specs.md` | by a listener snapshot showing the helpers on `127.0.0.1` only (C-N4; no helper binds a wildcard address) | by a socket snapshot of each helper showing **0 listening sockets** and one outbound TCP connection to `127.0. … | D82(d); cap §A.6.4 (more specific) |
| **PE-128-12** | FX-01-12 | `masterplan/01_specs.md` | no frame or audio excerpt of a local-device recording is copied into `docs/`, not even a small still | from a local-device session no still, no audio excerpt, no waveform or spectrogram, no transcript text and no … | D86 C-7; D87(5); SEC35-44 |
| **PE-128-13** | FX-01-13 | `masterplan/01_specs.md` | the credential travels only through write-only operation 89 into the one Core credential store | the credential travels only in the request bodies of operations 95 and 96 (web console only) and is stored onl … | D81 |
| **PE-128-14** | FX-01-14 | `masterplan/01_specs.md` | finding, severity and mitigation by row 126; named check by row 127 | findings SEC35-27..SEC35-30 (`sec` §11.2); checks `M4-DISC-SOCK-1`, `M4-SEC-NET-1`, `M4-DISC-LAN-1` | row 126 / row 127 as gated (D86, D89) |
| **PE-128-15** | FX-01-15 | `masterplan/01_specs.md` | 92 operations (35 GET / 57 POST), 63 audit types, `offline` 26 | keep, and append: "(as built at row 113; targets after R-9..R-11: 97 / 36 / 61, 67 audit types, `offline` 31 — … | C3 §10.1 |
| **PE-128-16** | FX-01-16 | `masterplan/01_specs.md` | (open points listed without a status) | add: "**Status after the spec gate (row 128):** items 1-13 and the ambiguities of B.2.7 are closed by rows 121 … | D80-D89 |
| **PE-128-17** | FX-03-01 | `masterplan/03_api_contract.md` | `CAPTURE_DISCOVERY_WINDOW_MS` \| `5_000` | `CAPTURE_DISCOVERY_WINDOW_MS` \| `3_000` — note cell: "accepted D82(c); `cap` §A.6.1 DS-7 (floor 850 ms + margi … | D82(c) |
| **PE-128-18** | FX-03-02 | `masterplan/03_api_contract.md` | `CAPTURE_CONNECTION_TEST_TIMEOUT_MS` \| `10_000` ... one attempt; then `UNREACHABLE` | `CAPTURE_CONNECTION_TEST_TIMEOUT_MS` \| `15_000` — "the whole test, enforced by destroying the per-test agent; … | D86 C-8; SEC35-39 (4); cap CT-4 |
| **PE-128-19** | FX-03-03 | `masterplan/03_api_contract.md` | `CAPTURE_CONNECTION_TEST_MAX_FAILURES` \| `3` ... `CAPTURE_CONNECTION_TEST_FAILURE_WINDOW_MS` \| `900_000` | `CAPTURE_CONNECTION_TEST_MAX_FAILURES` \| `2`; `CAPTURE_CONNECTION_TEST_FAILURE_WINDOW_MS` \| `1_800_000`. Repla … | D86 C-2; SEC35-38 |
| **PE-128-20** | FX-03-04 | `masterplan/03_api_contract.md` | per session at least `CAPTURE_DISCOVERY_MIN_INTERVAL_MS` ... (a pre-check search refused by the limit is skipp … | §7: keep `CAPTURE_DISCOVERY_MIN_INTERVAL_MS` = `10_000` (per operator session) and `CAPTURE_DISCOVERY_MAX_PER_ … | D86 C-8; SEC35-39 (1)-(4) |
| **PE-128-21** | FX-03-05 | `masterplan/03_api_contract.md` | **Never `409 CAPTURE_CONFIG_LOCKED`** — a search is allowed while a session is open (D80(4)) | keep, and add: "**409 `INVALID_STATE`** (`DISCOVERY_NOT_ALLOWED_WHILE_RECORDING`): the session state is `RECOR … | D86 C-4 |
| **PE-128-22** | FX-03-06 | `masterplan/03_api_contract.md` | (in development mode it also lists the loopback development sources) | delete the three statements that a search lists loopback development sources and write once, in "Not an SSRF o … | D83 (O-8); SEC35-41 (a); SEC35-27 (6) |
| **PE-128-23** | FX-03-07 | `masterplan/03_api_contract.md` | by `endpointRef` = `onvif_uuid`, else by `host` = the host of `address` (both existing columns; row 122 confir … | by `endpointRef` = `onvif_uuid`, else by the candidate's service address (host, or host and port, as adoption … | D83 (D-DB-15) |
| **PE-128-24** | FX-03-08 | `masterplan/03_api_contract.md` | The production value names are fixed by row 123 ... row 124 marks the manifest per track from the same value . … | :470 — "`adapter` is one of five values (`dbc-4` §N.2, `capture_devices.adapter_kind`): `ONVIF_RTSP`, `USB_AUD … | D83 (D-DB-11); D81; D82(e) |
| **PE-128-25** | FX-03-09 | `masterplan/03_api_contract.md` | With the development flag off, ops 76 / 77 list **0** `DEVELOPMENT` devices | In `REAL_PRODUCTION` ops 76 / 77 list **0** `DEVELOPMENT` devices ...; in `SIMULATED` the stored kinds are ine … | D83 (O-2) |
| **PE-128-26** | FX-03-10 | `masterplan/03_api_contract.md` | (no `conflict`, `addressChanged`, `interfaceCount`) | `CaptureDiscoverySearch` gains `interfaceCount: number` (interfaces probed; a count, never a name or an addres … | D86 (SEC35-28, SEC35-30, SEC35-32) |
| **PE-128-27** | FX-03-11 | `masterplan/03_api_contract.md` | credential?: { username: text 1..255, secret: text 1..1024 } | `username`: 1..255 printable ASCII without `<`, `>`, `&`, `"`, `'`, backslash; `secret`: 1..1024 printable ASC … | D86 (SEC35-35) |
| **PE-128-28** | FX-03-12 | `masterplan/03_api_contract.md` | **Never the username, the secret, a URL or the host.** ... 11 + 8 + 8 + 6 keys; none holds a username, secret, … | `CAPTURE_CONNECTION_TESTED`: "**Never the username, the secret or a URL.**" plus three optional keys — `host`? … | D86 C-3; SEC35-46; SEC35-30 |
| **PE-128-29** | FX-03-13 | `masterplan/03_api_contract.md` | with one `ACCESS_DENIED` row, **before the body is read** | "`WEB_CONSOLE_SESSION` is a policy fence that keeps the camera credential off the tablet and phone code paths; … | D86 (SEC35-45) |
| **PE-128-30** | FX-03-14 | `masterplan/03_api_contract.md` | authenticate, list the media profiles, check for a usable H.264 profile | append: "Codec and profile are judged from the authenticated ONVIF answer only; the Core opens no RTSP connect … | D82; D86 C-2; SEC35-32 (4) |
| **PE-128-31** | FX-03-15 | `masterplan/03_api_contract.md` | is held in the memory of that one request and is gone when its answer is written | :450 append: "It cannot be erased from memory: the guarantee is request-scoped — one request, never serialised … | D86 (SEC35-34, SEC35-47) |
| **PE-128-32** | FX-03-16 | `masterplan/03_api_contract.md` | (no `developmentSources`, no `sources` block in this file) | §3.1 new rows — 39 / 40: "`EvidenceItem` gains `developmentSources: boolean \| null` — the copy of `evidence_i … | D81 (row 124 A-2); D83 (OP-125-3) |
| **PE-128-33** | FX-03-17 | `masterplan/03_api_contract.md` | **Not ruled by D80(6) — put to the controller:** the **primary** microphone unreachable while the standby is r … | "**Ruled (D83):** the selected ACTIVE (primary) microphone unreachable blocks the start (the existing `PRECHEC … | D83 (replaces the D81 mic-toggle ruling) |
| **PE-128-34** | FX-03-18 | `masterplan/03_api_contract.md` | no camera connects within the ingest-open window → the session is FAULTED, nothing claims to record, 0 evidenc … | append: "A session presents 'recording' only from the first durable fragment; until then it presents 'connecti … | D84; D86 C-5; D82 |
| **PE-128-35** | FX-03-19 | `masterplan/03_api_contract.md` | errorCode: 'PERMISSION_DENIED'\|'DEVICE_BUSY'\|'DEVICE_NOT_FOUND'\|null | add `OPEN_FAILED` and `HELPER_EXITED` to op 97 `errorCode` and to the audit `reason` / alert `cause` value set … | cap §A.6.4 HL-10 (more specific); D83 (OP-125-4) |
| **PE-128-36** | FX-03-20 | `masterplan/03_api_contract.md` | (nothing on `credentialSet` for a registered device) | add: "`CaptureDevice` carries no `credentialSet` member in this phase: the runtime role has no SELECT on `capt … | dbc-4 §N.7 (more specific); D83 (OP-125-2) |
| **PE-128-37** | FX-03-21 | `masterplan/03_api_contract.md` | (no boot row) | new row: "`SYSTEM_BOOT` (existing type) — gains the key `captureOperation`: `SIMULATED` \| `REAL_PRODUCTION` \ … | D86 (SEC35-41 (b)) |
| **PE-128-38** | FX-03-22 | `masterplan/03_api_contract.md` | (no member says that a local device is open) | `CaptureDevice` gains `sourceOpen: boolean` — `true` while the Core holds an open source of a `LOCAL_DEVICE` d … | D86 (SEC35-44 (4)) |
| **PE-128-39** | FX-03-23 | `masterplan/03_api_contract.md` | (the table has no row for reason values and constants; the eight open items carry no status) | §10.1: add one line "Document counts of the delta after the spec gate: `details.reason` values 15 -> 17; const … | D81, D83, D86 |
| **PE-128-40** | FX-04-01 | `masterplan/04_database_contract.md` | unchanged: keyed on `integrity_source = 'REAL'`. A package sealed in development mode is `REAL` and therefore … | "**changed (D83 O-5, confirmed by the user, D87(3)):** a sealed `REAL` item blocks the reset unless `developme … | D83 (O-5); D87(3); D86 (SEC35-42); D89(c)(d) |
| **PE-128-41** | FX-04-02 | `masterplan/04_database_contract.md` | (and operation 96 if row 128 keeps the local camera as a candidate) ... If the controller rules that the ids o … | :1026 -> "the local-device registration of row 136 only (D83 O-8)". :1048-1058 -> replace the conditional by " … | D83 |
| **PE-128-42** | FX-04-03 | `masterplan/04_database_contract.md` | in the database transaction that persists the transition to `RECORDING` — before the Core asks the supervisor … | keep, and append: "'`RECORDING`' here is the stored state the session takes when the plan is accepted; the cli … | D84; D86 (SEC35-40, SEC35-41) |
| **PE-128-43** | FX-04-04 | `masterplan/04_database_contract.md` | per test one `CAPTURE_CONNECTION_TESTED` row with the candidate id and the outcome, never a host | :1142 -> "...and the outcome; `host` and `endpointRef` only for `PRODUCTION` candidates (D86 C-3)". :1143 -> a … | D86 C-3 |
| **PE-128-44** | FX-04-05 | `masterplan/04_database_contract.md` | `from_media_ms`/`to_media_ms` are **media-pts domain** | append: "Origin: FILE (media) time of the sealed file — file time 0 = T0 − 1024/48000 s (`CAPTURE_MEDIA_TIME_O … | D81; D72(d) |
| **PE-128-45** | FX-04-06 | `masterplan/04_database_contract.md` | For row 128. ... to be widened at row 128 (N.15 O-2) | add under the N.15 heading: "**Status after the spec gate (row 128):** O-1 closed (D83, D-DB-13 accepted); O-2 … | D82, D83, D87 |
| **PE-128-46** | FX-05-01 | `masterplan/05_capture_architecture_spec.md` | \| Camera 1 \| `CAM-01` -> `VIDEO-01` \| `LOCAL_DEVICE` \| ... \| Mic 1 (primary) \| `MIC-01` \| `LOCAL_DEVICE` | Camera 1: "the local camera's own row — the next free `CAM-NN` (`CAM-03` on a fresh seed) -> `VIDEO-01`"; Came … | D83 (D-DB-13) |
| **PE-128-47** | FX-05-02 | `masterplan/05_capture_architecture_spec.md` | none, or production kinds (inert) | any — every stored kind is inert in `SIMULATED` (after set 4 the four development databases hold four assigned … | D83 (O-2) |
| **PE-128-48** | FX-05-03 | `masterplan/05_capture_architecture_spec.md` | on this Mac nothing is recordable until a real camera is adopted | :204 -> "in this phase nothing is recordable in `REAL_PRODUCTION`: the search, the connection test, adoption a … | D86 C-5; D82; SEC35-40; SEC35-41 |
| **PE-128-49** | FX-05-04 | `masterplan/05_capture_architecture_spec.md` | de-duplicated by endpoint reference, the first source address is kept | "two answers with one endpoint reference from the **same** source address are one candidate; from **different* … | D86 (SEC35-28, SEC35-30) |
| **PE-128-50** | FX-05-21 | `masterplan/05_capture_architecture_spec.md` | a non-empty endpoint reference of <= 256 characters | a non-empty endpoint reference of <= 120 characters (the cap of `endpointRef` in C3 §2.6; a valid ONVIF refere … | C3 §2.6 `endpointRef: string 1..120` (more specific for the returned shape) |
| **PE-128-51** | FX-05-05 | `masterplan/05_capture_architecture_spec.md` | **hypothesis H-14:** it rejects entity-expansion input in bounded time | add rule DS-16: "the whole datagram handler is one `try` / `catch` that counts and drops; parser options pinne … | D86 (SEC35-29, SEC35-48, SEC35-30) |
| **PE-128-52** | FX-05-06 | `masterplan/05_capture_architecture_spec.md` | \| 6 Persist the credential \| operator action through **operation 89** \| | step 6 -> "6 Persist the credential \| part of step 5: operation 96 carries the credential in its body and sto … | D81 |
| **PE-128-53** | FX-05-07 | `masterplan/05_capture_architecture_spec.md` | + RTSP `DESCRIBE` ... and RTSP `OPTIONS` / `DESCRIBE` ... **Gap for the controller.** The RTSP `DESCRIBE` need … | remove every RTSP half: `UNREACHABLE` = refused or timed-out TCP connection to the service address, or no HTTP … | D82; SEC35-27 (4); SEC35-32 (4) |
| **PE-128-54** | FX-05-08 | `masterplan/05_capture_architecture_spec.md` | (proposal: 3 per 10 minutes per candidate; constants by rows 121 / 126) | CT-5 -> "one test at a time per Core; lock-out guard `CAPTURE_CONNECTION_TEST_MAX_FAILURES` = 2 `AUTHENTICATIO … | D86 C-2; D86 C-8 |
| **PE-128-55** | FX-05-09 | `masterplan/05_capture_architecture_spec.md` | `secret.fill(0)` in a `finally` of the route | CR-2 -> "`CameraCredential { username: string; secret: string }` — the package needs a string". CR-3 -> "No ze … | D86 (SEC35-34, SEC35-31); D87(2) |
| **PE-128-56** | FX-05-10 | `masterplan/05_capture_architecture_spec.md` | \| ST-4 \| An RTSP responder that answers `OPTIONS` / `DESCRIBE` only ... | "\| ST-4 \| **removed (D82)** — the stub has no RTSP responder; any RTSP connection from the Core is recorded as … | D82 |
| **PE-128-57** | FX-05-11 | `masterplan/05_capture_architecture_spec.md` | `node:net` is imported by **exactly one** file under `src/capture/**`, `adapters/camera/rtsp-describe.ts` | G-R10 -> "no file under `src/capture/**` imports `node:net`; `node:http` / `node:https` are imported only in ` … | D82; D86 (SEC35-27, SEC35-33) |
| **PE-128-58** | FX-05-12 | `masterplan/05_capture_architecture_spec.md` | Minimum 5 s between two searches per Core (proposed; rows 121 / 126 fix the constants) | DS-11 -> "limits by name from C3 §7: single-flight per Core; 5 s between starts per Core and 10 s per operator … | D86 C-8; D82(c) |
| **PE-128-59** | FX-05-13 | `masterplan/05_capture_architecture_spec.md` | The ingest-open window is the worker's listen timeout (`--listen-timeout-s`, default 15 s | append: "It is a named setting passed by the launcher (row 71; default 15 s). `FAULTED` with `durable: false` … | D84 |
| **PE-128-60** | FX-05-14 | `masterplan/05_capture_architecture_spec.md` | any correction moves video timestamps only and never resamples the evidentiary audio | keep the cell and append: "**Superseded in part (D72(j), D85):** every microphone passes through libswresample … | D85; D72(j) |
| **PE-128-61** | FX-05-15 | `masterplan/05_capture_architecture_spec.md` | row 58 (not landed) | edits 7-10 -> "landed by row 58 (`apps/core-server/src/config.ts:43-44`, `:177-181`, `:263-267`, `:294-312`; ` … | D82 (routed); D82(e) |
| **PE-128-62** | FX-05-16 | `masterplan/05_capture_architecture_spec.md` | (H-22..H-26 exist only in `sec` §11.11) | add rows H-22..H-26 as written in `09_security_design_review.md:710-714`, and H-27: "enumerating local inputs … | D86 (sec §11.11); record 121 §5 (unanswered hand-over) |
| **PE-128-63** | FX-05-17 | `masterplan/05_capture_architecture_spec.md` | by **exact name** `MacBook Air Camera`, audio `none`; never by index | add to HL-10 / ML-1: "the device list is read before every open and the helper is started only when exactly on … | D86 (SEC35-43) |
| **PE-128-64** | FX-05-18 | `masterplan/05_capture_architecture_spec.md` | no frame or audio excerpt in `docs/` (D80(11); R-11 AC-8) | -> "no still, no audio excerpt, no waveform or spectrogram, no transcript text and no playback screenshot from … | D86 C-7; D87(4)(5); SEC35-44 |
| **PE-128-65** | FX-05-19 | `masterplan/05_capture_architecture_spec.md` | Names are proposals of this row; row 122 fixes the stored spelling and the column, row 124 the manifest value | :139-140 -> "The five kinds are fixed by `dbc-4` §N.2 (D83). `CaptureSourceClass` is the API class (two values … | D83; C3 §2.6 |
| **PE-128-66** | FX-05-20 | `masterplan/05_capture_architecture_spec.md` | the target `{ address, port }` is a constructor argument that only the fake registry may set | append: "A booted lane Core used by client checks is started by a test-support launcher (under `apps/core-serv … | cap DS-15 + SEC35-27 (6) (more specific) |
| **PE-128-67** | FX-06-01 | `masterplan/06_evidence_package_spec.md` | If row 121 shows a source class on a device shape, it must use these three names. | "**Reconciled at row 128:** the API device shapes carry a two-valued class `PRODUCTION` \| `DEVELOPMENT` (C3 § … | D81; D83 (D-DB-11) |
| **PE-128-68** | FX-06-02 | `masterplan/06_evidence_package_spec.md` | **Open, not decided by this row:** which origin each `…Ms` media-time field uses | "**Decided (D81):** `audio.sourceIntervals[].fromMs` / `toMs` (fields 58-59; `session_audio_intervals.from_med … | D81 |
| **PE-128-69** | FX-06-03 | `masterplan/06_evidence_package_spec.md` | "Production configuration" has no written definition yet ... `false` is possible here only when every recorded … | add a row "The case the first three guards did not cover": "the worker's loopback ingest is unauthenticated; i … | D86 C-5; SEC35-40; cap §A.1.2 |
| **PE-128-70** | FX-06-04 | `masterplan/06_evidence_package_spec.md` | the worker/supervisor dies during RECORDING and cannot restart within the back-off budget | append: "**and at least one durable fragment exists** (`durable: true`). A session that ends `FAULTED` with no … | D84; D89(b) |
| **PE-128-71** | FX-06-05 | `masterplan/06_evidence_package_spec.md` | Built by row 141 (fields 124-126 and verify V-15) and row 83 (fields 127-128) ... Where that record lives is f … | :439 -> "Row 83 builds fields 124-128 from its first build (D81); row 141 adds the exhaustive kind -> class ma … | D81; D83 (D-DB-14) |
| **PE-128-72** | FX-08-01 | `masterplan/08_client_ux_spec.md` | 6 (G13-G18, flows 9-13) = **18/18** ... = **46** | G18 is removed (D83). :1099 -> "**Blocked.** 'MIC 1 (MIC-01) is the active microphone and is not reachable. Ca … | D83 (OP-125-1) |
| **PE-128-73** | FX-08-02 | `masterplan/08_client_ux_spec.md` | This phase also has **no** reveal toggle for the value being typed | "A reveal control for the value being typed is allowed (D86 C-1): off by default; back to hidden on blur, on s … | D86 C-1 |
| **PE-128-74** | FX-08-03 | `masterplan/08_client_ux_spec.md` | a guard of 3 failures per camera ... three refused passwords | "a guard of 2 failures per camera in 30 minutes" (:655, :1569); `M4-CONN-GUARD-W` (:1548) -> "two refused pass … | D86 C-2 |
| **PE-128-75** | FX-08-04 | `masterplan/08_client_ux_spec.md` | so in Simulated mode every device, tile and demo package carries the badge. This is kept | "**Simulated client mode (D83):** the badge is NOT shown on devices and demo items — the mode banner says it; … | D83 |
| **PE-128-76** | FX-08-05 | `masterplan/08_client_ux_spec.md` | ("This Mac's camera" for `LOCAL_DEVICE`, "Test source" for `FAKE`) | "the kind text 'Test source' (`adapter: FAKE`)" and add "A `LOCAL_DEVICE` source is never a candidate: it is a … | D83 (O-8) |
| **PE-128-77** | FX-08-06 | `masterplan/08_client_ux_spec.md` | (no confirmation step, no conflict rows, no network count) | §8d.2: the dialog header also shows the hardware hint and "This device has not been verified. Its name and mod … | D86 (SEC35-28, 30, 31, 35, 37); D87(2) |
| **PE-128-78** | FX-08-07 | `masterplan/08_client_ux_spec.md` | (no indicator that a local device is open) | "**'Is on' indicator (SEC35-44 (4)).** Whenever a `LOCAL_DEVICE` camera or microphone is open (`sourceOpen: tr … | D86 (SEC35-44 (4)); D89(c) |
| **PE-128-79** | FX-08-08 | `masterplan/08_client_ux_spec.md` | (no state between the start and the first durable fragment) | add: "Between the accepted start and the first durable fragment Session Monitor (WB-01) and Session Live (MB-0 … | D84; D82(f) |
| **PE-128-80** | FX-08-09 | `masterplan/08_client_ux_spec.md` | G13 ... `CAPTURE_CONFIG`; any session state | new state S14: "Search not available while recording — op 93 `409 INVALID_STATE` (`DISCOVERY_NOT_ALLOWED_WHILE … | D86 C-4 |
| **PE-128-81** | FX-08-10 | `masterplan/08_client_ux_spec.md` | (four states: Ready, Permission needed, Busy, Not connected) | fifth state: "Could not be opened \| `OPEN_FAILED` or `HELPER_EXITED` \| chip 'Could not be opened' (warning) … | cap HL-10 (more specific); D86 C-5; D82(e) |
| **PE-128-82** | FX-08-11 | `masterplan/08_client_ux_spec.md` | Proposed i18n keys (§14.2) \| — \| — \| 120 \| **120** | §14.2: remove 1 key (`common.captureNotice.start.useOther`) and add the 18 keys of section 2.3 of this gate. § … | D83; D84; D86 |
| **PE-128-83** | FX-08-12 | `masterplan/08_client_ux_spec.md` | (open items without a status) | add: "**Closed at the spec gate (row 128):** OP-125-1 (D83: no operation, no G18); OP-125-2 (not carried in th … | D83, D84, D86 |
| **PE-128-84** | FX-09-01 | `masterplan/09_security_design_review.md` | three failures -> three rows, the third with `guardTripped: true`; a fourth attempt -> 429 and no row | two failures -> two rows, the second with `guardTripped: true`; a third attempt -> 429 and no row | D86 C-2 (the finding's own SEC35-38) |
| **PE-128-85** | FX-09-02 | `masterplan/09_security_design_review.md` | The next swap of the two forbidden-key CHECKs adds `username`, `password`, `credential` | "(3) No CHECK swap is needed: `username`, `password`, `credential` and `secret` are already among the 28 denie … | code fact: 0006_stt_config.sql:33-34; D86 C-3, C-6 |
| **PE-128-86** | FX-09-03 | `masterplan/09_security_design_review.md` | `REAL_PRODUCTION` with an adopted fixture camera assigned | `REAL_PRODUCTION` with a registered `ONVIF_RTSP` device row placed by the test set-up and assigned (a loopback … | consistency inside D86 (SEC35-41 (a)) |
| **PE-128-87** | FX-09-04 | `masterplan/09_security_design_review.md` | (U-1..U-4 and C-1..C-8 listed as questions) | add: "**Answered by the user (D87):** U-1 accepted (plain-HTTP exposure on the known development network; the … | D87; D86 |
| **PE-128-88** | FX-10-01 | `masterplan/10_test_strategy.md` | **Erratum PE-127-12 ... — open point, not decided here.** | "**Ruled (D89(b), following D84):** a kill in phase P1 is a failed start. Expectation of `M7-KM-P1-0`, `M7-KM- … | D89(b); D84 |
| **PE-128-89** | FX-10-02 | `masterplan/10_test_strategy.md` | **U-2, not yet confirmed by the user** | G-23 -> "U-2 confirmed by the user (D87(3))"; G-34 "not decided here" -> "ruled D89(b)"; under the §A.4a.11 he … | D87(3); D89(b)(c) |
| **PE-128-90** | FX-10-03 | `masterplan/10_test_strategy.md` | in `REAL_PRODUCTION` with an adopted fixture camera assigned | in `REAL_PRODUCTION` with a registered `ONVIF_RTSP` device row placed by the test set-up and assigned | consistency with `M4-SEC-FENCE-1` (10:320) and SEC35-41 (a) |
| **PE-128-91** | FX-10-04 | `masterplan/10_test_strategy.md` | The lane Core runs with the fake ONVIF stub on loopback | append: "It is started by a test-support launcher (under `apps/core-server/test/support/`) that builds the app … | cap DS-15; SEC35-27 (6) |
| **PE-128-92** | FX-10-05 | `masterplan/10_test_strategy.md` | op 93 answers `409 INVALID_STATE`, 0 datagrams | :271 (a) -> "op 93 answers `409 INVALID_STATE` (`DISCOVERY_NOT_ALLOWED_WHILE_RECORDING`), 0 datagrams ..."; (b … | D86 C-4; D82 |
| **PE-128-93** | FX-02-01 | `masterplan/02_plan.md` | 120-field manifest ... Verify v2 (14 checks V-01..V-14) | :242 -> "128-field manifest (fields 124-128 from the first build, D81)". :244 -> "Verify v2 (14 checks V-01..V … | D81 |
| **PE-128-94** | FX-02-02 | `masterplan/02_plan.md` | (the plan has no work package for rows 129-142) | add a work-package block "Rev 2.3 Part B (AP3 = D78)" listing rows 129-142 with their milestone (M4: 129-138, … | D77, D78 |

One correction to a ledger sentence already placed: `masterplan/11_audit_errata.md:400` and `:410-411`
(PE-121-08, "15 new `details.reason` values"; "new constants 14") are the figures of row 121 and stay
as history; the §5.16 note states the figures after the gate — 17 reason values, 17 constants.

## 7. Item-by-item reconciliation (the row's verification table)

### 7.1 Names and numbers used in more than one file (item A)

"agree" = the same spelling and value on every side read. Counts in the evidence column are from
one script run over the nine files (`str.count` of the exact token).

| # | Item | Side A | Side B | Verdict | Fix |
|--:|---|---|---|---|---|
| A-1 | Operation ids, numbers, methods, paths (93-97) | `03:388-392` (`startCaptureDiscovery` POST `/api/v1/capture/discovery`; `getCaptureDiscovery` GET same path; `testCaptureCandidateConnection` POST `…/candidates/{id}/test`; `adoptCaptureCandidate` POST `…/adopt`; `rescanCaptureInputs` POST `/api/v1/capture/inputs/rescan`) | `08:130-134`, `08:745-750`, `08:875-882`, `08:1087`; `09:606`; `10:281`; rec-121 §3. The five names occur 12 / 7 / 4 / 4 / 4 times across the files and in no other spelling (regex over `[a-z]+Capture(Discovery\|Candidate\|Inputs\|Connection)…`: 5 distinct names) | agree | — |
| A-2 | Operation 89 extended (web only; 503 before row 84; registered devices only) | `03:194`, `:221`, `:313`, `:554` | `04:306-311`, `:1197`; `05:556`, `:605`; `08:784`, `:846`; `10:296`, `:381` | agree on the rule; **disagree on who carries the credential**: `01:283`, `:291`, `:293`, `:398`, `05:556`, `:605`, `bp:373`, `:394`, `:134`, `:584` still say "only through operation 89" against D81 | FX-01-01, -03, -04, -13; FX-05-06; BP-121, BP-142, BP-X1 |
| A-3 | Access condition `WEB_CONSOLE_SESSION`, refusal `WEB_CONSOLE_ONLY`, on ops 89, 95, 96 | `03:97`, `:397-400`, `:630` | `08:784-786`; `09:671`; `10:296` | agree; wording "before the body is read" too strong (SEC35-45) | FX-03-13 |
| A-4 | Permission (`CAPTURE_CONFIG`, no new permission) | `03:157`, `:394-395` | `01:298`; `08:752-757`, `:1189-1193`; `10:270` | agree | — |
| A-5 | Which clients may enter a camera credential | D80(3): web console only — `03:390-391`, `08:780-789` | `01:298` "this row proposes to allow it as well" (tablet, phone); `bp:377`, `bp:390` | **disagree** | FX-01-05; BP-125, BP-138 |
| A-6 | Status codes of ops 93-97 | `03:409-413` | `08:698-712` (S1-S13), `08:835-850`, `08:1064-1081` | agree (202 / 200 / 201; 403, 404, 409, 422, 429, 503 map one to one) | — |
| A-7 | `details.reason` values (15 of row 121) | `03:616-631` | `08` and `10` use `DISCOVERY_IN_PROGRESS`, `DISCOVERY_RATE_LIMITED`, `DISCOVERY_NOT_READY`, `CANDIDATE_ALREADY_REGISTERED`, `CANDIDATE_NOT_TESTABLE`, `CANDIDATE_NOT_TESTED`, `CONNECTION_TEST_FAILED`, `CONNECTION_TEST_IN_PROGRESS`, `CONNECTION_TEST_RATE_LIMITED`, `CONNECTION_TEST_LOCKOUT_GUARD`, `CREDENTIAL_REQUIRED`, `DEVELOPMENT_SOURCE_NOT_ALLOWED`, `WEB_CONSOLE_ONLY` — script: 0 reason-like tokens of `04`, `05`, `08` that `03` does not define | agree for the 15 | — |
| A-8 | The reason of the 409 of op 93 during `RECORDING` | `09:568` item (6), `10:271`: `409 INVALID_STATE`, no reason named | `03:409`: "Never `409 CAPTURE_CONFIG_LOCKED` — a search is allowed while a session is open"; `03:457`; `01:299`; `08:1189` | **missing in the contract; unnamed** | FX-03-05, FX-01-06, FX-08-09, FX-10-05; name 4.2 #1 |
| A-9 | `SOURCE_KIND_NOT_RECORDABLE` | `09:638`, `10:322`, `10:369` (3 occurrences) | `03`, `04`, `05`, `08`: 0 occurrences | **missing in the builders' specs** | FX-03-18, FX-05-03, FX-08-10 |
| A-10 | `guardTripped`, `conflict`, `addressChanged`, `interfaceCount` | `09:567`, `:569`, `:621`, `:672`; `10:304` | `03`, `04`, `05`, `08`: 0 occurrences each | **missing** | FX-03-10, FX-03-12, FX-04-04, FX-05-04, FX-08-06 |
| A-11 | `CREDENTIAL_STORE_NOT_READY` (503 until row 84) | `03:454`, `:629` | `01:350`; `04:1197`; `05:556`; `08:846`; `10:297`, `:381`; `bp:336` | agree | — |
| A-12 | `NO_CAMERA_CONNECTED` (reason on `CAPTURE_FAULT`, CRITICAL) | `03:551`, `:873`, `:909` | `01:313`; `05:711-714`; `08:928`, `:1101`; `10:364` | agree | — |
| A-13 | Connection-test outcomes (five) | `03:449`: `REACHABLE`, `AUTHENTICATION_FAILED`, `WRONG_PROFILE`, `NOT_H264`, `UNREACHABLE` | `05:571-575`; `08:827-831`; `10:293`; `03:826` (audit) | agree on names; `05` defines three of them partly by RTSP observations (against D82) | FX-05-07 |
| A-14 | Audit types (4) and categories | `03:799`, `:817`, `:833`, `:849`, `:880-882` (`DEVICE`, `SECURITY`, `DEVICE`, `DEVICE`) | `01:295` (names as proposed); `04:1177-1178`; `08:129-134`; `10:282` | agree | — |
| A-15 | Audit key lists | `03:803-860` (11 + 8 + 8 + 6 keys; "never … the host") | D86 C-3 and SEC35-46: `host`, `endpointRef`, `guardTripped`; SEC35-30: `interfaceCount`; `10:304` asserts them; `04:1142` "never a host" | **disagree** | FX-03-12, FX-04-04 |
| A-16 | Alert kinds, reasons, severities | `03:907-910` (`SYSTEM` / WARNING for A, B, C-degraded; `CAPTURE_FAULT` / CRITICAL for C; `params.reason` `CAPTURE_DISCOVERY_EMPTY`, `CAPTURE_DEVICE_UNREACHABLE`, `NO_CAMERA_CONNECTED`) | `08:926-929`; `04:1183-1184`; `05:703-704`; `10:311`, `:364`; `01:311-313` (as proposals) | agree | — |
| A-17 | Adapter-kind value set | `04:1004`, `05:143`: `ONVIF_RTSP`, `USB_AUDIO`, `SNMP_POE`, `FAKE`, `LOCAL_DEVICE` | `03:470`: "Two values are fixed here: `LOCAL_DEVICE` and `FAKE`. The production value names are fixed by row 123" (`ONVIF_RTSP` occurs 0 times in `03`) | **incomplete in the contract** | FX-03-08 |
| A-18 | Source-class value sets and their mapping | API: `PRODUCTION` \| `DEVELOPMENT` — `03:422`, `:471`, `05:144` | manifest: `PRODUCTION` \| `LOCAL_DEVICE` \| `FAKE` — `06:456-457`; mapping `04:1020-1026`. `06:490-491` says a device shape "must use these three names"; `03:471` says the manifest is marked "from the same value" | **two sets under one member name, each spec claiming the other follows it**; both sets stand (D81 accepted both, D83 accepted the mapping table) | FX-03-08, FX-06-01, FX-05-19 |
| A-19 | Capture-operation names | `05:194`: `SIMULATED` / `REAL_PRODUCTION` / `REAL_DEVELOPMENT` | `04:1329-1332`; `09:639`; `10:320-322`. `03` and `08`: 0 occurrences — they say "development flag off / on", "development configuration" | names agree where used; **the contract and the UX never bind their words to them** | FX-03-08, FX-03-09, FX-08-10, FX-01-09 |
| A-20 | Configuration keys | `05:188-189`: `DEMS_CAPTURE_DEV_SOURCES`, `DEMS_CAPTURE_HELPER_FFMPEG` | `09` (1 occurrence of the first); no other file | single source; agree | FX-03-08 names the flag once in the contract |
| A-21 | Boot refusal codes (five) | `05:208-212` | `10:320` | agree (`DEV_SOURCES_NEED_REAL_CAPTURE`, `DEV_SOURCE_WITHOUT_FLAG`, `DEV_FLAG_WITH_PRODUCTION_SOURCE`, `DEV_HELPER_PROGRAM_UNUSABLE`, `DEV_FLAG_WITH_LAN_LISTENER`) | — |
| A-22 | Migration numbers | `04:942-943`, `:1205-1212`: set 4 = `0008` + `0009` | `10:242-243`, `:249`; `bp:381`, `:382`, `:321`, `:731`: "migration `0008`" | specs agree; **blueprint wording** | BP-129, BP-130, BP-X2 |
| A-23 | Schema version / contract revision | `04:1309`: 3 / `dbc-4` | `10:30`, `:249`, `:257` | agree | — |
| A-24 | Table, column, CHECK and index names | `04:1004-1015`, `:1067-1081`, `:1122`, `:1156`, `:1220-1237` | `09:640` (`development_sources`, `session_capture_sources`, `adapter_kind`); `10:249-258`, `:366`; `06:733` ("where that record lives is for row 122") | agree; one stale pointer | FX-06-05 |
| A-25 | Manifest field numbers and names (124-128) | `06:456-460` | `04:1093` (124, 125), `:1122` (126); `08:999`; `10:376-378` | agree | — |
| A-26 | Verify check V-15; 15 checks | `06:624-626` | `10:456`, `:609`; `bp:337` (14, true for row 85); `02:244` (14) | specs agree; blueprint and plan wording | BP-85, BP-89; FX-02-01 |
| A-27 | Candidate member names | adapter: `05:482` (`sourceAddress`, `connectable`, `nameHint`, `hardwareHint`, `vendorHint`, …) | API: `03:418-430` (`host`, `testable`, `name`, `model`, `vendor`) | different layers, **no stated mapping** | FX-05-19 |
| A-28 | Helper error names | `05:689` (HL-10): `DEVICE_NOT_FOUND`, `PERMISSION_DENIED`, `DEVICE_BUSY`, `OPEN_FAILED`, `HELPER_EXITED` | `03:413`, `:858`: three names; `08:1020-1025`: four states | **disagree** (`OPEN_FAILED`, `HELPER_EXITED` occur 0 times in `03`, `08`, `01`) | FX-03-19, FX-08-10 |
| A-29 | "Already registered" matching key | `04:1147-1154`: `onvif_uuid`, else the whole `address` (D83) | `03:426`: "else by `host` = the host of `address`" | **disagree** | FX-03-07, FX-01-02 |
| A-30 | Device ids of the development slots | `04:1048-1058`: rows of their own (D83) | `05:168-171`: `CAM-01`, `MIC-01` | **disagree** | FX-05-01, FX-01-10 |
| A-31 | i18n keys against contract terms | `08:926-929`: `captureNotice.discoveryEmpty.*`, `…unreachable.precheck.*`, `…noCamera.*`, `…unreachable.sessionStart.*` | `03:907-910` reasons and phases | agree (sampled: the four alert families, the five outcome messages `08:827-831`, the lock-out key `08:1422-1423`); one key names a removed control (`…start.useOther`) | FX-08-01 |
| A-32 | Check IDs: catalogue against the UX proposals | `10:339-358` (34 client checks) | `08:1539-1558`: 20 families = 38 IDs | all 38 are in the catalogue under the same names (script: single-ID rows; grouped rows read) | — |
| A-33 | Check IDs: catalogue against the security record | `10:258-369`, `:379` | rec-126 §6: 24 names | 23 used unchanged; `M5-SEC-PRIV-2` split into `-W` / `-T` / `-P` (`10:370`; rec-127 §3) — 26 IDs | — (stated) |
| A-34 | Check IDs: catalogue against the database contract | `10:249-257` (`M4-MT-9`..`-12`, `-14`..`-16`) | `04:1387-1394` (MT-9..MT-16) | agree; MT-13 = `M4-CONN-ATOM-1` (`10:244-245`, `:297`) | — |
| A-35 | Check IDs: catalogue against the blueprint Verification cells | `10` §A.4a: 111 IDs | `bp:381-394`, `:322`, `:327`, `:341`: 0 of the 111 IDs occur (script over the ID families) | **the cells name no check** | BP-129..BP-142, BP-70, BP-75, BP-89 |
| A-36 | Finding IDs SEC35-27..49 | `09:566-675` (23 findings; 4 High, 11 Medium, 8 Low) | references in `10` reach SEC35-49 and no higher; no other spec cites a new finding (highest elsewhere: SEC35-26) | agree; no dangling ID | — |
| A-37 | Hypotheses | `05:1371-1386`: H-7a, H-7b, H-11..H-21 | `09:710-714`: H-22..H-26 "for §J of spec 05 at row 128" — not in `05` | **not carried** | FX-05-16 |
| A-38 | Gated-control ids | `08:1189-1194`: G13..G18 | `10:214`, `:452`: "G13-G17; G18 is not built, D83" | **disagree** | FX-08-01 |
| A-39 | Stub behaviours | `05:862-866`: ST-1..ST-5 | `10:232`, `:293`: ST-1..ST-5 with "0 RTSP connections"; D82 removes the RTSP responder | **disagree** (ST-4) | FX-05-10, FX-10-05, BP-60 |
| A-40 | Static rules G-R9..G-R15 | `05:1253-1259` | `10:280`: "G-R10 as corrected (no file under `src/capture/**` imports `node:net`; D82)" | **disagree** (G-R10) | FX-05-11 |

### 7.2 Constants — one value each (item B)

| # | Constant | Values found | ONE value | Reason | Fix |
|--:|---|---|---|---|---|
| K-1 | Search window `CAPTURE_DISCOVERY_WINDOW_MS` | `03:1005` 5,000 ms; `05:479` 3,000 ms | **3,000 ms** | D82(c) accepts "3,000 ms window" by name; floor 850 ms + margin (`05:479`); 5,000 was the package default, rejected there | FX-03-01, FX-05-12 |
| K-2 | Connection-test deadline `CAPTURE_CONNECTION_TEST_TIMEOUT_MS` | `03:1010` 10,000 ms ("one attempt"); `05:584` 3 s connect, 5 s per request, 15 s whole test | **15,000 ms** for the whole test; 3 s and 5 s stay as sub-bounds of the adapter | SEC35-39 (4) recommends 15 s; SEC35-33 (1) enforces exactly that bound by destroying the per-test agent; four sequential reads at 5 s each do not fit 10 s | FX-03-02, FX-05-08 |
| K-3 | Lock-out guard, count | `03:1014` 3; `05:585` 3; `08:655`, `:1548`, `:1569` 3; `09:672` "three failures" | **2** | D86 C-2 | FX-03-03, FX-05-08, FX-08-03, FX-09-01 |
| K-4 | Lock-out guard, window | `03:1015` 900,000 ms (15 min); `05:585` 10 min | **1,800,000 ms (30 min)** | D86 C-2 | FX-03-03, FX-05-08 |
| K-5 | Lock-out guard, what it counts per | `03:459` per host, per Core; `05:585` per candidate | **per host, per Core** | a candidate id dies with its search, so a per-candidate count resets on "Search again"; SEC35-38 (3) | FX-05-08 |
| K-6 | Rejected credential-bearing requests per failed test | not stated in `03` or `05`; `09:621` at most 2 | **at most 2** | D86 C-2 | FX-03-14, FX-05-08 |
| K-7 | Search spacing | `03:1008` 10 s per session; `05:483` 5 s per Core | **both**: 10 s per operator session and 5 s per Core | SEC35-39 (4) "per session 10 s **and** per Core 5 s" (D86 C-8) | FX-03-04, FX-05-12 |
| K-8 | Search volume | `03:1009` 6 per minute per Core; no long-window bound | **6 per minute per Core and 30 per hour per operator session** | SEC35-39 (2) | FX-03-04 |
| K-9 | Pre-check search under the limit | `03:443` "refused by the limit is skipped"; `09:622` own allowance | **own allowance of one per pre-check run; single-flight still applies** | SEC35-39 (3); `10:277`, `:313` assume it | FX-03-04 |
| K-10 | Tests in parallel and per minute | `03:1013` 6 per minute per Core; `05:585` one at a time per Core | **both hold**; plus the per-host spacing also between two tests of one operator session | rec-127 G-6; SEC35-39 (1) | FX-03-04, FX-05-08 |
| K-11 | Candidate cap | `03:1007` 64; `05:480` 64 responders | 64 — agree; ordering rule added | SEC35-28 (4) | FX-03-10, FX-05-04 |
| K-12 | Endpoint reference length | `03:424` 1..120; `05:480` <= 256 | **120** | one cap, so that an accepted answer always fits the returned shape; a valid ONVIF reference is 45 characters (`05:441`, V-7) | FX-05-21 |
| K-13 | Datagram cap and answer size | `05:480` 256 datagrams, 16 KiB; `09:568` the same | agree (adapter constants; not contract constants) | — | — |
| K-14 | Result lifetime, test validity, test spacing per host, input re-read | `03:1006` 600,000 ms; `:1011` 300,000 ms; `:1012` 5,000 ms; `:1016` 5,000 ms | single source; `08` reads by name (`08:706`, `:740`, `:818`) | — | — |
| K-15 | Ingest-open window | `05:697-699` 15 s (the worker's listen timeout); `01:313`, `10:364` by name | 15 s default; "a named setting passed by the launcher" | D84 | FX-05-13 (the setting's name is row 71's) |
| K-16 | Device text cap | `03:425` 120; `08:724` 120; `09:674` 120 | agree | — | — |
| K-17 | Test recording length; bytes per test | `09:651` at most 10 s; `09:590` 1 MiB | carried into `05` | D86 (SEC35-44, SEC35-33) | FX-05-18, FX-05-08 |

### 7.3 Totals — arithmetic re-done, and every other place that quotes them (item C)

| # | Total | Stated at | Arithmetic re-done | Other places found by grep | Verdict |
|--:|---|---|---|---|---|
| T-1 | Operations 97; GET 36; POST 61 | `03:1142-1144` | 92 + 5 = 97; 35 + 1 = 36; 57 + 4 = 61; 36 + 61 = 97 | `10:281` (97 / 36 / 61), `10:446`, `:756` (92 / 35 / 57 as the stale values); `01:224` (as built); `bp:731` (as built); `11:407` | correct; `01:224` gets a pointer (FX-01-15) |
| T-2 | Audit types 67 | `03:1145` | 63 + 4 = 67; `SYSTEM_BOOT` exists already (FX-03-21), so the boot row adds no type | `10:281`; `11:407` | correct |
| T-3 | Error codes 40 | `03:1146` | 40 + 0 | `10:281` | correct |
| T-4 | `offline` scope 31 | `03:1148` | 26 + 5 = 31; cross-check 97 − 1 − 65 = 31 | `10:281` | correct |
| T-5 | Try-it denied 10; access conditions 6 | `03:1150-1151` | 8 + 2 = 10; 5 + 1 = 6 | `09:702-703`; `10:281` | correct |
| T-6 | Modified operations 26 | `03:1152`, `:557-558` | 24 + 2 = 26; ops 39, 40, 41 of FX-03-16 are already among the 24 | — | correct, unchanged by the fix pass |
| T-7 | Document counts of the `03` delta | `11:400`, `:410-411`: 15 reason values, 14 constants; `03:1132`: 11 + 8 + 8 + 6 audit keys | after the fix pass: 15 + 2 = **17** reason values; 14 + 3 = **17** constants; 12 + 11 + 10 + 6 = **39** keys | — | moves (FX-03-23, FX-03-12) — not pinned totals |
| T-8 | Tables 41; columns 426; CHECKs 172; migration files 10 | `04:1362-1375` | 40 + 1; 419 + 5 + 1 + 1 = 426; 166 + 4 + 2 = 172; 8 + 2 = 10 (hand-written 5 + 1 = 6); FK 39 + 1 = 40; PK 40 + 1 = 41; value sets 42 + 2 = 44 | `10:256`, `:757`; rec-122 §2; `04:942-944` (verdict block: "six new CHECKs") | correct |
| T-9 | Manifest fields 128 | `06:536-543` | 120 + 3 + 3 + 2 = 128; by place 9 + 11 + 14 + 21 + 11 + 17 + 19 + 7 + 10 + 9 = 128 | `06:330`, `:880`; `10:495`; stale: `bp:335`, `02:242` ("120-field manifest"); `02:101` (history) | correct; blueprint and plan wording (BP-83, FX-02-01) |
| T-10 | Verify checks 15 | `06:626` | 14 + 1 | `06:882`; `10:456`, `:609`; `bp:337`, `02:244` (14, true for row 85) | correct (BP-85, BP-89, FX-02-01) |
| T-11 | UX flows 13; client definitions 39 | `08:1282-1283` | 7 + 1 + 5 = 13; 13 x 3 = 39 | `08:1252`, `:1276` | correct |
| T-12 | **Gated controls 18; client instances 46** | `08:1202-1205`, `:1284-1285` | with G18 removed by D83: 10 + 2 + 5 = **17**; 30 + 2 + 11 = **43** | `08:1254`; `10:214`, `:452` already say G13-G17 | **wrong after D83** (FX-08-01) |
| T-13 | Proposed i18n keys 120 | `08:1288` | counted today 120; after the fix pass 120 − 1 + 18 = **137** | — | moves (FX-08-11) |
| T-14 | States of flow 9: 13 | `08:698-712` (S1-S13) | + S14 = **14** | rec-125 PE-125-09 ("13 states x 3 clients") | moves (FX-08-09) |
| T-15 | Catalogue 330 active + 10 conditional = 340 named | `10:947`; rec-127 §4 | 7 + 21 + 29 + 22 + 105 + 24 + 21 + 61 + 18 + 16 + 6 = 330; 150 + 180 = 330; 219 + 111 = 330; 111 = 91 + 11 + 9 = 10 + 19 + 14 + 4 + 10 + 34 + 11 + 9 | `10:220-221`, `:201`, `:453` | correct; unchanged by the fix pass (the P1 cells keep their IDs, D89(b)) |
| T-16 | Findings 23 = 0 / 4 / 11 / 8 | `09` §11; rec-126 | SEC35-27..49 = 23; High 28, 29, 31, 40; Low 30, 35, 39, 43, 45, 47, 48, 49; Medium the other 11 | `dec:99` | correct |
| T-17 | Acceptance criteria 32 | `01:287-333` | 16 + 6 + 10 | `10:948`; `dec:93`, `:102` | correct |
| T-18 | Erratum marks not placed | the seven records | 11 + 15 + 15 + 15 + 19 + 5 + 18 = 98 | section 6 | 98 rows emitted |

### 7.4 Open points left for "row 128" or "the controller" — all of them, with the resolution (item E)

"closed" = an existing decision or the more specific spec decides it; the fix applies the text.

**Record of row 120** (`delegation_progress/data_analyst_row120.md` §5, §6).

| ID | Point | Resolution | Fix / owner |
|---|---|---|---|
| 120-OP-1..13 | the thirteen open points of `01` B.2.6 | closed by rows 121-127 as gated (D80-D86, D89) | FX-01-16 (status line) |
| 120-AMB-1 | probe data only, or also unauthenticated device information | closed: D80(1) — probe answer only | BP-131 |
| 120-AMB-2 | pre-check search for an operator without `CAPTURE_CONFIG` | closed: D80(2) | — (`03:401-402`, `08:935-943`) |
| 120-AMB-3 | which clients take a camera credential | closed: D80(3) — web console only | FX-01-05 |
| 120-AMB-4 | search while a session is open | closed: D80(4), narrowed by D86 C-4 | FX-01-06, FX-03-05 |
| 120-AMB-5 | microphones on the network | closed: D80(5) | — |
| 120-AMB-6 | pre-check start rule | closed: D80(6); active microphone: D83 | FX-03-17 |
| 120-AMB-7 | "production configuration" undefined | closed: defined at `05:214-217` | FX-06-03 |
| 120-AMB-8 | operation 89 before row 84; a candidate is not a device | closed: D80(7), D81 | FX-01-03, FX-01-04 |
| 120-AMB-9 | does the mark cover fake-fixture packages | closed: D80(9), D81 (demo packages carry `FAKE`) | — (`06:479`) |
| 120-AMB-10 | a camera that does not answer multicast | closed as a recorded gap: D80(10) | — (`03:1110`) |

**Record of row 121** (§5, §6).

| ID | Point | Resolution | Fix / owner |
|---|---|---|---|
| 121-1 | credential in the body of ops 95 and 96 | closed: D81 accepts it | FX-01-01, -03, -04, -13; BP-121, BP-142 |
| 121-2 | re-verification inside op 96 | closed: kept (SEC35-47), with the profile comparison | FX-03-15 |
| 121-3 | primary microphone unreachable | closed: D83 | FX-03-17 |
| 121-4 | removing an adopted camera | recorded gap (D81); no design in this phase | — (`03:1113`) |
| 121-5 | all §7 values are proposals | closed: section 7.2 | FX-03-01..04 |
| 121-6 | where the `FAULT_RAISED` key list lives (confidence MEDIUM) | stays a check for rows 133 / 139 before they add the two keys (`03:873`) | rows 133, 139 |
| 121-7 | `info.version` step for five operations | closed: D81 — the versions step once, at the M6 gate (D69) | — |
| 121-8 | the INTERNAL sim-action count moves if rows 133 / 139 add an action | stays a pin for rows 133 / 139 (`03:921-925`, `10:281`) | rows 133, 139 |
| 121-9 | hand-over to row 123, unanswered: is the input enumeration safe during `RECORDING` | hypothesis H-27 with its test; op 97 stays allowed (D80(4), (5)) | FX-05-16 |
| 121-A1 | the server can tell a web console session from a device-bound one | confirmed by reading (`09:671`, `decision.ts:185-188`) | — |
| 121-A2 | loopback development sources listed as candidates | closed: D83 (O-8) — no | FX-03-06, FX-08-05 |
| 121-10 | `host` in the test audit row | closed: D86 C-3 | FX-03-12 |

**Record of row 122** (§5; `04` N.15).

| ID | Point | Resolution | Fix / owner |
|---|---|---|---|
| D-DB-13 / O-1 | device ids of the development slots | closed: D83 accepts D-DB-13 | FX-05-01, FX-04-02 |
| D-DB-15 / O-4 | matching key | closed: D83 | FX-03-07 |
| D-DB-17 / O-6 | "migration `0008`" is two files | closed: D83 | BP-129, BP-130, BP-X2 |
| O-2 | stored kinds inert in `SIMULATED` | closed: D83 routes it here | FX-05-02, FX-03-09, FX-01-09 |
| O-3 | no path from the demo seed to a production recording | stated to the user (D82 "consequence", D83); class C-2 | FX-01-01, FX-05-03 (text) |
| O-5 | reset guard and development packages | closed: D83, confirmed by the user (D87(3)); conditions of SEC35-42 | FX-04-01; BP-129 |
| O-7 | the moment of the version step | closed: the controller picks it (D83) | BP-130 |
| O-8 | how the local camera enters the registry | closed: D83 — row 136's registration | FX-03-06, FX-04-02 |
| F-122-2 | a short password fails the ciphertext CHECK | closed: row 84's sealer frames (D83) | BP-84 |
| A-122-1 | the lanes were not read | checked by row 130 at its step 1 (`04:1295`) | row 130 |
| G-1 | removing an adopted device | recorded gap | — |
| G-2 | `host` is not a denied audit key | closed: D86 C-3 uses it | FX-04-04 |

**Record of row 123** (§8).

| ID | Point | Resolution | Fix / owner |
|---|---|---|---|
| 123-1 | dependency: own probe + `onvif` for the test | closed: D82(a) | BP-131 |
| 123-2 | hand-written RTSP client | closed: D82 — none | FX-05-07, -10, -11 |
| 123-3 | blueprint row 131 text | closed: D80(1), D82 | BP-131 |
| 123-4 | class C-2 gap: nothing records a real camera | stated to the user (D82); made a rule by D86 C-5 | FX-05-03 |
| 123-5 | helper pipeline rests on H-17 | accepted: D82(d); H-17 step 1 is `M4-LOCAL-AV-1` | — |
| 123-6 | mixed configurations | closed: D82 — refused | FX-03-18; BP-136 |
| 123-7 | user actions: permission prompt, clap, runs outside the sandbox | recorded: D89(e) "blocked: user action"; U-3 answered (D87(4)) | BP-134, BP-140 |
| 123-8 | spec §I lists edits 7-10 as not landed | closed: they landed — read in `apps/core-server/src/config.ts:43-44`, `:177-181`, `:263-267`, `:294-312` | FX-05-15 |
| 123-9 | no vendor scope category | closed: `vendor` stays a nullable member | FX-01-02 |
| 123-P25 | planned P25 edits 15-18 | waiver recorded when row 136 lands them (D82(e)) | FX-05-15 |

**Record of row 124** (§5, §6).

| ID | Point | Resolution | Fix / owner |
|---|---|---|---|
| A-1 | adapter-kind names | holds: `04:1020-1026` | FX-06-01 |
| A-2 | `sources` block on op 41 | closed: carried into the contract | FX-03-16 |
| A-3 | a session-start record exists | holds: `session_capture_sources` (D83) | FX-06-05 |
| A-4 | demo packages carry the mark | closed: D81 | — |
| A-5 | a never-selected standby microphone carries no mark | holds (the four source rows still record it; the manifest marks intervals only) | — |
| A-6 | no v2 package without the fields | closed: D81 — row 83 builds 124-128 from its first build | BP-83 |
| 124-1 | "120-field manifest" in row 83 | closed: 128 | BP-83, FX-02-01 |
| 124-2 | "14 checks" in rows 85, 86, 89 | closed: 14 at row 85, 15 from row 141 | BP-85, BP-89 |
| 124-3 | shape of fields 127-128 | closed: D81 names the two fields | — |
| 124-4 | origin of the interval times (21.333 ms) | closed: D81 — FILE time | FX-06-02, FX-04-05; BP-83 |
| 124-5 | "production configuration" | closed: `05:214-217` | FX-06-03 |

**Record of row 125** (§3, §5).

| ID | Point | Resolution | Fix / owner |
|---|---|---|---|
| OP-125-1 | no operation for a microphone toggle at pre-check | closed: D83 — none; G18 not built | FX-08-01, FX-03-17 |
| OP-125-2 | `credentialSet` on a registered camera | closed as a recorded gap: the runtime role has no SELECT on the credential table (`04:1196`); not carried in this phase | FX-03-20 |
| OP-125-3 | package mark on ops 39 / 40, `sources` on op 41 | closed: carried | FX-03-16 |
| OP-125-4 | the local camera's failure cause | closed as an accepted limit: the situation-B alert only (`08:1023`) | FX-03-19 |
| OP-125-5 | the state after situation C with nothing durable | closed: D84 — failed start, no Recovery hand-off | FX-08-08; member: R-1 |
| OP-125-6 | reveal control | closed: D86 C-1 | FX-08-02 |
| OP-125-7 | "Core Mac's …" on tablet and phone; badge in Simulated mode | closed: D83 — (a) accepted, (b) not shown | FX-08-04; live client on a `SIMULATED` Core: R-2 |
| 125-w | wording of `bp` rows 125 / 138 and `01` AC-5 / AC-12 | closed: D80(3) | FX-01-03, FX-01-05; BP-125, BP-138 |
| 125-d1 | the typed values stay in the form for two requests | accepted by SEC35-34 (4) (`09:603`) | — |
| 125-f1 | no "Checking your permissions…" string on the web console today | stays with rows 67 / 137 (shared key `common.rbac.checking`) | rows 67, 137 |

**Record of row 126** (§4, §5, §8).

| ID | Point | Resolution | Fix / owner |
|---|---|---|---|
| U-1 | plain-HTTP exposure of the account name and a digest | accepted by the user (D87(2)) | FX-05-09, FX-08-06 (honest sentence) |
| U-2 | reset-guard narrowing | confirmed by the user (D87(3)) | FX-04-01 |
| U-3 | cloud sync of the folder | answered: none; residual accepted (D87(4)) | — |
| U-4 | when recordings may be deleted | on the user's instruction only (D87(5)) | FX-01-12, FX-05-18; BP-134 |
| U-5 | the target camera's lock-out rule | class C information, before the first real test | class C-1 entry item |
| C-1..C-8 | the eight controller decisions | accepted (D86) | FX-08-02; FX-03-03; FX-03-12; FX-03-05; FX-05-03; FX-09-02; FX-01-12; section 7.2 |
| §5 #1-#15 | the hand-over list | each row has a fix: #1 FX-05-04; #2 FX-05-05; #3 FX-05-07, -08, -10, -11; #4 FX-05-09; #5 FX-05-02, -03; #6 FX-05-17, -11; #7 FX-03-10, -11; #8 FX-03-04, -05, -03; #9 FX-03-12, -13; #10 FX-03-15; #11 FX-01-04, -12, -14; #12 FX-06-03; #13 FX-04-01 (the "forbidden-key additions" are void, FX-09-02); #14 FX-08-02, -06, -07; #15 BP-66, -71, -131, -142 | as listed |
| SEC35-36 (3) | `username` covered by the audit-key CHECK | closed by a code fact: already denied (`0006_stt_config.sql:33-34`); the text-form blanking rule is row 142's | FX-09-02 |
| §8 limits | H-22..H-26 | carried into `05` §J | FX-05-16 |

**Record of row 127** (§6 G-1..G-34, §7).

| ID | Resolution | Fix / owner |
|---|---|---|
| G-1 | 3,000 ms | FX-03-01 |
| G-2 | 15,000 ms | FX-03-02 |
| G-3 | 2 per host in 30 minutes | FX-03-03, FX-05-08, FX-08-03, FX-09-01 |
| G-4, G-5, G-6 | the SEC35-39 set; own allowance for the pre-check search; both test bounds hold | FX-03-04, FX-05-12 |
| G-7 | D86 C-4, reason named | FX-03-05, FX-01-06, FX-08-09, FX-10-05 |
| G-8 | D83; G13-G17 | FX-03-17, FX-08-01 |
| G-9 | D81 | FX-01-03, FX-01-04; BP-121, BP-142 |
| G-10 | D80(3) | FX-01-05; BP-138 |
| G-11 | D80(1) | BP-131 |
| G-12 | D82 | FX-05-07, FX-05-10, FX-05-11 |
| G-13 | D83 | FX-05-01 |
| G-14 | D83 | FX-03-07 |
| G-15 | D83 | BP-129, BP-130, BP-X2 |
| G-16 | D83 | FX-08-04 |
| G-17 | D86 C-1 | FX-08-02 |
| G-18 | D86 C-3 | FX-03-12, FX-04-04 |
| G-19 | D86 C-6; already denied at the database | FX-09-02 |
| G-20 | SEC35-28 | FX-05-04, FX-03-10, FX-08-06 |
| G-21 | 14 at row 85, 15 from row 141 | BP-85, BP-89 |
| G-22 | 128 | BP-83 |
| G-23 | confirmed by the user (D87(3)) | FX-04-01, FX-10-02 |
| G-24 | the four rows are written with the stored transition to `RECORDING`, before `app.capture.start`; a failed start leaves them | FX-04-03; member name: R-1 |
| G-25 | 0 development devices in `REAL_PRODUCTION`; `SIMULATED` lists its `FAKE` devices | FX-01-09, FX-03-09, FX-05-02 |
| G-26 | development sources are never search candidates; situation A is decided on `responderCount = 0` | FX-03-06, FX-08-05 |
| G-27 | a test-support launcher injects the loopback target | FX-10-04, FX-05-20 |
| G-28 | each of rows 132, 133, 142 pins what it lands; final after the last | BP-132, BP-133, BP-142; FX-10-02 |
| G-29 | audit rows per situation, as the contract | FX-01-08 |
| G-30 | `vendor` nullable; no vendor column promised | FX-01-02 |
| G-31 | D86 C-5 | FX-05-03, FX-01-01, FX-06-03 |
| G-32 | the wider docs rule | FX-01-12, FX-05-18 |
| G-33 | op 97 -> row 133; server side of op 89 -> row 142 (D89(c)) | BP-133, BP-142 |
| G-34 | D89(b): P1 = failed start | FX-10-01; BP-86, BP-89 |
| 127-§7 #1, #5, #6, #7, #9, #11, #12 | accepted (D89, D89(a), D89(c), D89(e)) | — |
| 127-§7 #2 | = G-34 | FX-10-01 |
| 127-§7 #3 | reason and constant named | 4.2 #1, #2 |
| 127-§7 #4 | `M4-DISC-LAN-1`: adapter-level runs by row 131, the notification in the gate's +1; the interface-counter method stays H-13 for row 131 | BP-131, BP-70 |
| 127-§7 #8 | U-2 confirmed (D87(3)); `M4-SEC-RESET-1` asserts the exemption (D89(d)) | FX-04-01 |
| 127-§7 #10 | = G-27 | FX-10-04 |
| 127-§7 #13 | the plan's tracking entries are the controller's; the plan has no work package for rows 129-142 | FX-02-02 |

### 7.5 The ten root causes behind most rows

| # | Root cause | Decision | Rows of section 2 |
|--:|---|---|---|
| 1 | The findings of row 126 (accepted after rows 121-125 were written) were never carried into the builders' specs | D86 | FX-03-10..15, -21, -22; FX-04-03, -04; FX-05-04, -05, -09, -16, -17, -18; FX-06-03; FX-08-02, -06, -07 |
| 2 | "Only through operation 89" survived in the requirement text and the architecture spec | D81 | FX-01-01, -03, -04, -13; FX-05-06 |
| 3 | No RTSP client; the architecture spec still specifies one | D82 | FX-05-07, -10, -11; FX-03-14 |
| 4 | Local devices are rows of their own; no toggle control; no badge in Simulated client mode | D83 | FX-05-01; FX-01-10; FX-04-02; FX-03-17; FX-08-01, -04, -05, -11 |
| 5 | "Recording" only from the first durable fragment; nothing durable = failed start | D84, D89(b) | FX-01-07; FX-03-18; FX-04-03; FX-05-13; FX-06-04; FX-08-08; FX-10-01 |
| 6 | No search during `RECORDING` until two checks pass | D86 C-4 | FX-01-06; FX-03-05; FX-08-09; FX-10-05 |
| 7 | Constants proposed twice with different values | D82(c), D86 C-2, C-8 | FX-03-01..04; FX-05-08, -12, -21; FX-08-03; FX-09-01 |
| 8 | Two source-class value sets under one member name; adapter kinds and helper errors half-named in the contract | D81, D83 | FX-03-08, -19; FX-05-19; FX-06-01; FX-08-10 |
| 9 | Stored kinds inert in `SIMULATED`; development sources never candidates; the stub reached through test support only | D83 (O-2, O-8) | FX-01-09; FX-03-06, -09; FX-05-02, -20; FX-08-05; FX-10-04 |
| 10 | Status lines: open points that a later ruling closed still read "open" | D80-D89 | FX-01-16; FX-03-23; FX-04-06; FX-05-15; FX-06-05; FX-08-12; FX-09-04; FX-10-02 |

## 8. Method, limits and self-gate

### 8.1 What was read and run

| Step | What | Evidence |
|---|---|---|
| Decisions | `decisions/decisions.md:85-102` (D72-D89) read whole | quoted by ID throughout |
| Records | the eight records of rows 120-127 read whole | section 7.4 |
| Specs | `01:243-398`; `03:375-562`, `:566-640`, `:795-925`, `:995-1031`, `:1053-1200`; `04:940-1486` and `:253-259`, `:304-311`, `:334-338`, `:729-742`; `05:115-229`, `:404-732`, `:765-814`, `:853-872`, `:1188-1206`, `:1235-1268`, `:1295-1353`, `:1368-1386`; `06:326-330`, `:436-545`, `:608-648`, `:699-708`, `:728-736`, `:863-889`; `08:694-743`, `:780-850`, `:922-955`, `:1014-1047`, `:1089-1125`, `:1184-1206`, `:1278-1298`, `:1355-1500` (key rows), `:1531-1570`; `09:566-569`, `:588-590`, `:603-606`, `:621-622`, `:638-641`, `:651`, `:671-775`; `10:216-238`, the 111 check rows of `:249-382` by script and 20 of them in full, `:384-436`, `:836-880`, `:945-948` | file:line in every table |
| Blueprint | `bp:313-341` (rows 61-89 selected), `:367-394`, and lines 134, 584, 604-607, 731, 848, 893 | section 5 |
| Code facts (read-only) | `apps/core-server/src/config.ts:43-44`, `:177-181`, `:263-267`, `:294-312` (edits 7-10 landed); `apps/core-server/src/db/migrations/0006_stt_config.sql:33-34` (28 denied keys include `username`, `password`, `credential`, `secret`, `onvifUuid`); `apps/core-server/src/db/migrations/0001_tables.sql:256`, `:489` (closed session-state lists); `packages/shared/src/sim/vocabulary.ts:396` (`SYSTEM_BOOT`) | sections 4, 7.4 |
| Scripts (session scratch directory, not in the repository) | (1) a parser of `R-n AC-m` references over seven specs -> the raw coverage matrix; (2) a counter of 27 tokens over nine files (section 7.1); (3) an ID cross-check: catalogue against `08` §15.2, rec-126 §6 and the blueprint; (4) the generator of sections 2, 2.4, 5 and 6, which counts every re-check pattern in today's files | section 2.4: 0 patterns outside their stated before-state |

### 8.2 Limits

| Limit | Consequence |
|---|---|
| Documentation review: no test run, no database read, no network traffic, no device opened | every "required text" is a specification; nothing here is evidence that code behaves so |
| `08` §14.2 (120 keys) and `10` §A.4a were read by script and by sample, not line by line | a wording disagreement inside a key text or a check cell that names no searched token can remain; the tokens of section 7.1 and the constants of 7.2 were searched in full |
| `07_transcript_spec.md` is outside the eight deltas and was not read | the FILE-time rule of D81 is assumed to match its §A.2 "Timeline mapping" (cited by `05:1200`) |
| The line numbers of section 6 are the authors' | to be re-read after the fix pass (stated there) |
| A re-check pattern proves that a string left or entered a file, not that the surrounding sentence is right | the controller's check after the fix pass reads the edit beside running the pattern |
| The names of section 4.2 are this gate's proposals | one line from the controller confirms or renames them |

### 8.3 Self-gate against the row (as amended by D89)

| Requirement of the row | Result | Where |
|---|---|---|
| Item-by-item table with file:line for both sides of every disagreement | done: 40 name items, 17 constants, 18 totals | sections 7.1-7.3 |
| A-G of the brief | A 7.1; B 7.2; C 7.3; D section 3 (32 rows x 7 columns, 10 holes named); E 7.4 and section 4; F section 5; G section 6 | — |
| One fix per gap with the single correct text, the place and the authority | 94 rows (section 2) and 34 blueprint rows (section 5) | sections 2, 5 |
| Every fix re-checkable by grep, absent before and present after or the reverse | 94 + 34 patterns; baseline counted at generation time: 0 outside the stated before-state | sections 2.4, 5 |
| Rulings kept as short as honesty allows | 2 rulings; 9 names to confirm | section 4 |
| "0 open gaps before row 129, 131 or 134 starts" | **not met today** — it is met when the must-fix rows named in section 1 pass their patterns and R-1 is answered | section 1 |
| No spec, blueprint, code or tracker edited | this file is the only write | `git status` |

Status of this row: **needs-review** — the table is complete; the gate closes when the fix pass
has run and the controller has re-checked the patterns.

---
*Generated: 2026-10-09 15:58*
*Last Updated: 2026-10-09 15:58*
