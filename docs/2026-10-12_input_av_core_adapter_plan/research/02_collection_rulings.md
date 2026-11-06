---
task_id: 2026-10-12_input_av_core_adapter_plan
date: 2026-10-12
agent: data-collector
row: 5
tier: 2
items_collected: 46
last_updated: 2026-10-12
---

# Collection: rulings of task 3 that bind the input-av to Core adapter plan

Collection only. No analysis, no verdict, no recommendation. Quoted text is cut where marked `[...]`; every cut keeps the identifier and the clause the row asks for.

## 0. Scope, method and read-only statement

- Source folder: `/Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/`. In this file `D<n>` = `decisions/decisions.md` row `D<n>`; `SPEC05` = `masterplan/05_capture_architecture_spec.md`; `SPEC01` = `masterplan/01_specs.md`; `STRUCT` = `identification/02_structured.md`; `ORIG` = `identification/01_original.md`; `README` = `/Users/gsp-budi/Documents/DEMS/README.md`; `ADP` = `/Users/gsp-budi/Documents/DEMS/apps/core-server/src/capture/adapters/`.
- Read-only: only this file and `delegation_progress/row_05_rulings.md` were written. Nothing under `apps/input-av/data/` was opened. No `.env` file was opened.
- Method: `grep -n` / line-numbered `awk` on the large files, then reading only the surrounding lines. Line numbers are of the files as they stand on 2026-10-12 (the git tree has uncommitted changes; `README.md` is modified in the working tree).
- Identifier-numbering notice (fact, not analysis): the label "C-n" is used by four different lists in the source folder.
  1. `STRUCT` section 9 and `SPEC01` G.2 class-C entry pack: C-1 to C-9 (the lists the row means by "classes A, B, C with C-2 and C-4").
  2. `D86` controller decisions C-1 to C-8 (security design review delta); the row's "D86 (C-5)" is this list.
  3. Specs non-functional constraints `C-N8`, `C-N13`, `C-N15` (cited inside D86/SPEC05).
  4. `SPEC01` section C constraint rows (`C-N10` etc.).
  Wherever a bare "C-5" appears below, the list it belongs to is named.

## 1. Index (every identifier the row names)

| Row-5 identifier | Found | Section | Primary source |
|---|---|---|---|
| D76 | yes | 3.1 | `decisions/decisions.md:89` |
| D86 | yes | 3.2 | `decisions/decisions.md:99` |
| D86 C-5 | yes | 3.2 | `decisions/decisions.md:99` |
| OD-06 | yes | 4.1 | `masterplan/01_specs.md:432` |
| Class A / B / C (definitions) | yes | 5.1 | `identification/01_original.md:33-35` |
| Class C entry pack C-1, C-2, C-4, C-5 (STRUCT section 9) | yes | 5.2 | `identification/02_structured.md:550-554` |
| SPEC05 section A.1 | yes | 6.1 | `masterplan/05_capture_architecture_spec.md:102-255` |
| SPEC05 section A.7 | yes | 6.2 | `masterplan/05_capture_architecture_spec.md:761-864` |
| "OD-.. register" | yes | 4 | `masterplan/01_specs.md:419-457` and `identification/02_structured.md:566-601` |
| Later decisions amending any of the above | yes | 7 | see section 7 |
| Rulings on: opener, mic transport, camera codec, evidentiary audio format, sessions/cameras per Core, production host, camera credentials | yes | 8 to 14 | see headings |

Not found: none of the named identifiers. One related item is reported not found in section 15 (a recorded user answer to the Q-HW production-host question after D93).

## 2. Status vocabulary used (as written in the sources)

- "in force" = recorded as accepted/answered in `decisions/decisions.md` with no later row that reverses it.
- "class C" / "not scheduled" = the work is specified but not built (`SPEC01:574-602`, `STRUCT:546-562`).
- "amended by Dn" = a later row names the earlier ruling and changes or narrows it, quoted in section 7.

## 3. The two decisions named by the row

### 3.1 D76 (2026-10-09), `decisions/decisions.md:89`

Text (the user's words, verbatim, then the controller's sharpening):

> User (verbatim): "device yang ketemu boleh di list probe dulu, tidak perlu di koneksikan, jika ada aksi konektifitas, semua di forward ke user untuk input crredential. jadi perlu dibuat mekanismenya"
> R-9 sharpened: (1) a search yields a candidate LIST only; nothing is connected, registered or authenticated by the search; (2) every connectivity action (authenticated ONVIF call, RTSP session, test stream, adoption as a camera) is a separate operator action that hands over to the operator to enter the credential in the product UI; no default, reused or guessed credential, and no credential means no connection attempt; (3) the mechanism is to be built: candidate -> operator action -> credential prompt -> existing write-only credential path (op 89; sealer per D68(c)) -> connection test with a clear result -> only then assignable as a camera; every step audited without values; (4) agent rule on the real network: list and probe only; a test that needs a real connection stops and hands over to the user to type the credential in the UI - agents never type, store or receive a real camera credential. Confirms the bounds of D75.

Status: in force. Referenced as binding by: `SPEC05:615` (A.6.3 heading), `SPEC05:625` (CR-7), `SPEC01:584-589` (G.2 C-1/C-2 entry criteria "the user names the camera and types its credential in the product UI (D76)"), `STRUCT:562`, README `:505` ("Agents never type, store or receive a real camera credential (D76)"). Narrowed in one respect by D80(1) (wording of D80: "D76 wording wins over the wider D75 bound"), see section 7.

Related user ruling D75 (the bound D76 "confirms"), `decisions/decisions.md:88`: agents may run ONVIF WS-Discovery on the network of the Mac; controller bounds "probes and unauthenticated device information only; no authentication attempt, no credential guessing, no configuration change on any discovered device (NTP, GOP, profiles, PoE stay class C until the user names a camera and its account)". Status: in force, narrowed by D80(1).

### 3.2 D86 (2026-10-09), `decisions/decisions.md:99`

Header: "Row 126 gated: security design review delta = CAUTION - 0 Critical, 4 High, 11 Medium, 8 Low (SEC35-27..SEC35-49; `masterplan/09_security_design_review.md` section 11; `delegation_progress/security_review_row126.md`)." The four High findings: SEC35-28 forged probe answers; SEC35-29 a search during RECORDING can end the Core; SEC35-31 credential phishing by a rogue responder; SEC35-40 in `REAL_PRODUCTION` any local process could push into the unauthenticated loopback listener and be recorded and signed as PRODUCTION.

Controller decisions accepted, as written in D86 (all in force):

| D86 id | Text | Used by (file:line) |
|---|---|---|
| C-1 | "a reveal control for the typed password (off by default, hidden on blur/submit/close, never on in a gate capture)" | `decisions.md:99` |
| C-2 | "lock-out guard 2 failures per host in 30 minutes, at most 2 rejected credential-bearing requests per failed test (conservative default without a source)" | `decisions.md:99`; cited in `ADP/camera/onvif-session.ts:4` ("decisions D75, D76, D82, D86 C-2") |
| C-3 | "`host` + `endpointRef` in the two audit types for PRODUCTION candidates (audit table lives in the git-ignored cluster; consistent with D75)" | `decisions.md:99`; amended to key `endpointRef` by D91 |
| C-4 | "searching during RECORDING answers 409 until `M4-SEC-DISC-1` and `M4-SEC-DISC-3` pass - narrows D80(4)" | `decisions.md:99` |
| **C-5** | "**no listener and no session start for a source kind without an opener; no all-PRODUCTION package can be produced in this phase**" | `decisions.md:99`; `SPEC05:227` (A.1.2 row 2, "D82, D86 C-5"); `SPEC05:177` (RG-1 authority); code `ADP/registry.ts:3,8,30`, `ADP/types.ts:16,47,130,208,234`, `ADP/errors.ts:18,24`, `ADP/kinds.ts:70`, `ADP/camera/onvif-rtsp.ts:7`, `ADP/audio/usb-audio.ts:6`, `ADP/camera/onvif-discovery.ts:14` |
| C-6 | "the typed camera username is credential material (redaction covers it)" | `decisions.md:99` |
| C-7 | "agents never open local-device media with a viewing tool and the real-LAN check prints no address/MAC/serial to tool output" | `decisions.md:99` |
| C-8 | "constants reconciled at row 128 (search window 3,000 vs 5,000 ms, test deadline 15 vs 10 s, failure window, search spacing; R-9 AC-7 and row 142 wording vs D81)" | `decisions.md:99`; resolved in D91 |
| (extra) SEC35-42 | "the reset-guard exemption uses `IS TRUE` and cross-checks `session_capture_sources`" | `decisions.md:99` |

User decisions D86 put to the user: U-1 (accept plain-HTTP ONVIF exposure: account name in clear + offline-attackable digest, with confirmation step + per-camera password + dedicated camera network "at class C"), U-2 (reset-guard narrowing, D83), U-3 (cloud sync/backup of `.data/`), U-4 (when local-device test recordings may be deleted). Answers: recorded in D87 (`decisions.md:100`): U-1 accepted ("not an issue on the user's known internal development network; the dialog still shows the target address (design mitigation kept); a dedicated camera network / per-camera passwords remain class-C advice"), U-2 confirmed, U-3 "no sync; any exposure of recordings under `.data/` during development is the user's accepted risk", U-4 "local-device test recordings are deleted on the user's instruction only - no agent deletes them".

Status of D86 C-5: in force; "carried" by code since D96 (`decisions.md:109`: "`hasOpener` + `assertRecordable()` (`SOURCE_KIND_NOT_RECORDABLE`) carries D86 C-5"); by D106 (`decisions.md:119`: plan builder "refuses a source without an opener and a mixed-class selector with `SOURCE_KIND_NOT_RECORDABLE`"); live behaviour recorded in README `:441-442` (see section 8).

## 4. OD-06 and the open-decision (OD) register

### 4.1 OD-06

| Where | file:line | Text |
|---|---|---|
| Register, answered | `masterplan/01_specs.md:432` | "OD-06 \| AAC-LC 48 kHz mono; transport behind `AudioInputAdapter`; USB as working assumption \| D4 \| Small, widely playable audio; transport fixed when mics are known \| M3 (codec), M4 (class C)" |
| Gate answer in force (D4) | `identification/02_structured.md:577` | "OD-06 \| AAC-LC 48 kHz mono behind `AudioInputAdapter`; USB working assumption \| rows 58, 65" |
| Decision row | `decisions/decisions.md:8` (D4) | "OD-06 AAC-LC 48 kHz mono, transport behind `AudioInputAdapter`, USB as working assumption" |
| SPEC05 decision inputs | `masterplan/05_capture_architecture_spec.md:69` | "OD-06 (D4) \| AAC-LC 48 kHz mono; transport behind `AudioInputAdapter`; USB working assumption \| Sections A (NM-10), F" |
| SPEC05 audio design | `masterplan/05_capture_architecture_spec.md:1297-1298` | "Codec / rate \| AAC-LC, 48 kHz, mono \| OD-06 (D4); F-44" and "Transport \| behind `AudioInputAdapter`; USB is the **working assumption** \| OD-06 (D4)" |
| Hypothesis | `masterplan/05_capture_architecture_spec.md:1506` | "H-8 \| USB is the correct microphone transport \| OD-06 'USB working assumption'; transport fixed when mics are known \| C-4 with the real mic shows a different transport" |
| API constants | `masterplan/03_api_contract.md:1418-1419` | `CAPTURE_AUDIO_SAMPLE_RATE_HZ = 48_000` and `CAPTURE_AUDIO_CHANNELS = 1`, authority "OD-06 (D4); AAC-LC 48 kHz mono" |
| Manifest field | `masterplan/06_evidence_package_spec.md:445` | field 53 `audio.codec` string `AAC-LC mono 48 kHz`, not null, authority "OD-06"; erratum PE-WI-30: "as built a constant of the sealing host, not read from the file or the worker" |
| Same field, consequence stated | `masterplan/06_evidence_package_spec.md:460` | "It is true by the worker's design of one AAC encoder at 48 kHz mono (OD-06); a change of that design would make the sealed field false until [...]" |
| Plan row | `masterplan/02_plan.md:420` | class-C row `C-4 \| Real AudioInputAdapter \| mic model/transport known (OD-06) \| M4-W5 \| coder-execution \| USB is the working assumption; needs real mic` |

Status: answered by the user in D4 ("A, semua default", `decisions/decisions.md:8`); the transport part is explicitly a working assumption, not a fixed ruling ("transport fixed when mics are known"); real adapter is class C-4 (section 5.2). No later decision row replaces OD-06 (search in section 7.4). OD-06 is the register's only row that fixes the evidentiary audio format.

### 4.2 Other OD rows that bind the plan's subjects (answered by D4; register at `masterplan/01_specs.md:419-457`)

| OD | Text (register wording) | file:line | Status |
|---|---|---|---|
| OD-05 | "Support both topologies (one dual-lens or two PoE); fakes emulate two cameras" - "Works with either hardware; real model comes with Q-HW" - unlocks "M2 schema, M4 (class C)" | `masterplan/01_specs.md:431`; `identification/02_structured.md:576` | answered (D4), in force; real camera model open (Q-HW) |
| OD-07 | "`PoeController` interface with an SNMP adapter + a fake; real adapter class C" | `masterplan/01_specs.md:433` | answered; class C-3 |
| OD-09 | hot standby, toggle for the session holder with `SESSION_START` + SUPERVISOR | `masterplan/01_specs.md:435` | answered |
| OD-11 | "below -50 dBFS for 10 s -> `MIC_SILENT`; disconnect debounce 2 s; contract constants" | `masterplan/01_specs.md:437` | answered |
| OD-12 | "no live preview of real cameras in this phase" | `masterplan/01_specs.md:438` | answered; class C-6 |
| OD-13 | "keep loopback (emulators); LAN is class C; preconditions E-26" | `masterplan/01_specs.md:439` | answered; class C-5 of STRUCT |
| OD-21 | "fMP4; fallback kept designed; legal confirmation before handover" | `masterplan/01_specs.md:447`; `identification/02_structured.md:` Gate G-1 table ("STILL OPEN (G-3)") | legal confirmation open |
| OD-24 | whisper.cpp CPU; D7 amendment: "portable `cpu-local` whisper.cpp for the x86 Linux Core is **not cancelled**" | `masterplan/01_specs.md:450` | answered; the only register text that names an "x86 Linux Core" |
| Q-HW | "unknown: class C deferred; task completes at the 'done on this Mac with fake devices' line" \| D4 | `masterplan/01_specs.md:455`; `identification/02_structured.md:600` | register text unchanged; D93 amends the state word, see 7.3 |

## 5. Classes A, B, C

### 5.1 Definitions of the three classes (the source of "Class A/B/C definitions")

`identification/02_structured.md:312` says only: "Class A/B/C definitions unchanged (rev 1 section 5)." The rev-1 text is not in `STRUCT`; the definitions as recorded in the folder are in `identification/01_original.md:33-35`:

- "(A) Can start now: an M0 spec/blueprint built from the decisions already made; technical spikes with tools already on the machine [...]; backlog clean-up that does not depend on new decisions." (`01_original.md:33`)
- "(B) Waits for user decisions OD-01..OD-26 [...]" (`01_original.md:34`)
- "(C) Waits for hardware: camera topology (OD-05), microphone transport (OD-06), PoE control (OD-07), real device adapters (M4), the STT benchmark on the real Core device, physical devices on the LAN (OD-13)." (`01_original.md:35`)

Class table of the rev-2.1 blueprint, `identification/02_structured.md:314-318`:

| Class | Rev-2.1 rows |
|---|---|
| A/B scheduled (this Mac) | 41, 43-101, 106-119 (row 42 done) |
| A/B conditional | 102-104 (only on Q-INST-1 = approve); [...] |
| C (hardware / handover) | "NOT scheduled: plan M4-W5 (real adapters, ONVIF incl. camera GOP setting, PoE, real mic), M8-W4 (physical e2e), M9-W5 (Core benchmark, TPM signer, long campaigns, A1-A6 pre-handover). Entry criteria in section 9; activation by row 105" |

The single completion line, `identification/02_structured.md:320`: "DONE ON THIS MAC WITH FAKE DEVICES - the single definition [...] all on fake RTSP, fake audio, a fake ONVIF stub, the simulated driver and emulators. Outside the line: conditional rows 102-104 and the class-C pack (row 105). Rev 2.3, only with AP3: the line also includes the new-scope rows 120-142 [...] the development sources of R-11 (this Mac's camera and microphone) count as non-production devices under this line." Restated in `SPEC01:576-582` (G.1) and `SPEC01:106` (A.2).

Plan placement of class C: `masterplan/02_plan.md:192` (M4-W5), `:257` (M8-W4), `:270` (M9-W5) - "Class C (not scheduled)".

Status: class C is not scheduled; row 105 activates the entry pack (`identification/02_structured.md:546`, heading "Class-C Entry Pack (not scheduled; activated by row 105)").

### 5.2 Class-C entry pack, `identification/02_structured.md:546-562` (mirrored at `masterplan/01_specs.md:584-602`)

Quoted for the four items the row names; the other five are listed with their line.

| Item | Text in STRUCT (`:550-554`) | Entry criteria | Version in SPEC01 G.2 (`:588-592`) | Status |
|---|---|---|---|---|
| **C-1** `STRUCT:550` | "ONVIF discovery, NTP set, profile listing, **GovLength (GOP) set per the Q-GOP answer** on the target camera" | "camera model known (Q-HW), on LAN; OD-05" - W-row on activation M4-W5 (`implementation/29`) - owner coder-execution | `SPEC01:588`: "**Authenticated** ONVIF actions on the target camera: profile listing with an account, NTP set, GOP set (PE-120-09; D75, D76). *Moved out of class C:* the unauthenticated part - the WS-Discovery probe and reading what the responders announce - is scheduled work (R-9; `structured` rows 131, 132) [...] **the user names the camera and types its credential in the product UI** (D76)" | Authenticated half: class C, not built. Unauthenticated half: scheduled and built (rows 131, 132). Boundary moved by "Rev 2.3, only with AP3" at `STRUCT:562` |
| **C-2** `STRUCT:551` | "Real `CameraAdapter` RTSP/TCP pull into the worker; observed-GOP check on real streams" | "C-1 passed; M3 gate passed" - M4-W5 | `SPEC01:589`: "Real `CameraAdapter` RTSP/TCP pull into the worker (PE-120-09: an RTSP session to a real camera is a connectivity action - only with the operator-entered credential, D76; the development sources of R-11 do not close this item)" | class C, not built. `SPEC05:641-644`: "This choice is class C-2 and is not made here; it is recorded as a blueprint gap (no row builds it; H-9 already says a real pull was never exercised)." |
| C-3 `STRUCT:552` | "Real `PoeController` (SNMP RFC 3621)" | switch model + control path known (OD-07); OD-22 | `SPEC01:590` | class C |
| **C-4** `STRUCT:553` | "Real `AudioInputAdapter`" | "mic model + transport known (OD-06)" - M4-W5 - coder-execution | `SPEC01:591` identical | class C, not built |
| **C-5** `STRUCT:554` (STRUCT list, NOT the D86 C-5) | "Physical tablets/phones on the LAN; STT endpoint beyond loopback only if re-decided" | "OD-13 = LAN; demo password replaced; B3 applied; TLS/origin rules specified" - M8-W4 (`implementation/46`) | `SPEC01:592` | class C. Related later fact: D241/D242 `REAL_PRODUCTION` boot refusal on the demo password (section 7.5) |
| C-6 `STRUCT:555` | Live preview of real cameras (OD-12 not "none") | | `SPEC01:593` | class C |
| C-7 `STRUCT:556` | NM-13 STT benchmark on the real Core device | Core device available (Q-HW) | `SPEC01:594` | class C |
| C-8 `STRUCT:557` | TPM/PKCS#11 signer adapter | OD-04 hardware option chosen | `SPEC01:595` | class C |
| C-9 `STRUCT:558` | Long AV-drift run (1-2 h) + repeated kill loops | user announces handover (D233) | `SPEC01:596` | class C |

"Rev 2.3, only with AP3 (D75, D76)", `identification/02_structured.md:562`: "The unauthenticated part of C-1 - WS-Discovery probe and reading the responders' device information and scopes - moves into the scheduled rows 131 and 132. Everything in C-1 and C-2 that authenticates against a real camera or changes it (profile listing with an account, NTP set, GOP set, RTSP pull of a real camera) stays class C until the user names the camera and types its credential into the product UI; the connect flow of row 142 is proven on loopback fixtures only. H-7 is therefore only partly lifted: 'discovery finds the target camera' can be observed on this network, 'profile and NTP work on the target camera' cannot." Mapping line `STRUCT:560`: "H-6/H-7/H-8/H-9 -> C-1..C-4". Moved-boundary paragraph at `SPEC01:598-600` ("The line now runs between asking who is there and logging in").

Hypotheses attached to these items (`masterplan/05_capture_architecture_spec.md`): H-7a `:1504` (scheduled, unauthenticated discovery), H-7b `:1505` ("Class C-1 / C-2 unchanged for every action on a real camera"), H-8 `:1506` (USB is the correct microphone transport; falsified by "C-4 with the real mic shows a different transport"), H-9 `:1507` ("the four S1 command-shape traps are sufficient for a pull camera (S1 used listen/push) | RF-2: pull fixtures need MediaMTX (Q-INSTALL item 4); class C-2").

## 6. Capture architecture spec sections A.1 and A.7

File: `masterplan/05_capture_architecture_spec.md` (1,564 lines). The spec's own status line: "This is the design of the capture layer. It is a spec, not an implementation" (`:58-60`; header `:8` "class: B (GA:OD-03, OD-05, OD-06, OD-11, OD-14, OD-21, OD-25)"). Deltas of 2026-10-09 (row 123) are marked PE-123-nn; fix passes of 2026-10-10 are indexed at `:36-51`.

### 6.1 Section A.1 NM-01 (lines 102-255)

| Part | Lines | Text / content (quoted or reported exactly) | Status |
|---|---|---|---|
| A.1 table | 104-108 | Purpose: "Resolve configured capture devices (`VIDEO-01`, `VIDEO-02`, `MIC-01`, `MIC-02`, PoE port) to concrete adapters; hold the topology choice (OD-05: one dual-lens camera with two profiles **or** two PoE cameras)". Authority: OD-05/OD-06/OD-07/OD-22 (D4); E-12. Target: `apps/capture-worker/src/adapters/` | Target path corrected by A.1.1 (next row) |
| A.1 interface sketch | 110-130 | `CaptureDeviceKind = 'CAMERA' \| 'AUDIO' \| 'POE'`; `CaptureAdapter = CameraAdapter \| AudioInputAdapter \| PoeController`; registry `list/register/resolve` | superseded in kinds by A.1.1 |
| A.1 test hook | 133-135 | "Real adapters are class C and are injected only from the supervisor in `DEMS_CAPTURE_MODE=real`." (failure mode `:131`: "class-C adapters must never load in a test") | in force |
| A.1.1 Delta 2026-10-09 (row 123) | 137-196 | "Where the adapters live": adapters are Core-process TypeScript under `apps/core-server/src/capture/adapters/{registry.ts, camera/, audio/, poe/, local-device/}`; "Nothing of an adapter is compiled into or loaded by the worker" (`:150-153`); alternatives table `:155-160`, chosen "Adapters in the Core process, OS doors pinned file by file (section G.1)" | in force (D82(b)) |
| Kinds and classes | 162-170 | `type CaptureAdapterKind = 'ONVIF_RTSP' \| 'USB_AUDIO' \| 'SNMP_POE' \| 'FAKE' \| 'LOCAL_DEVICE'`; `CaptureSourceClass = 'PRODUCTION' \| 'DEVELOPMENT'`; "PRODUCTION: ONVIF_RTSP, USB_AUDIO, SNMP_POE. DEVELOPMENT: FAKE, LOCAL_DEVICE (D80(9))" | in force; five kinds fixed by `dbc-4` N.2 (D83) |
| RG-1 | 177 | "The registry is built once at boot from the capture operation of A.1.2: in `REAL_PRODUCTION` only `PRODUCTION` kinds are registered; in `REAL_DEVELOPMENT` only `DEVELOPMENT` kinds plus the discovery / connection-test half of `ONVIF_RTSP` [...]; in `SIMULATED` no adapter is registered. The registry states which kinds have an opener." Authority: "D73; R-11 AC-2; C-N14; D86 C-5; SEC35-40" (erratum PE-128-48) | in force |
| RG-2 | 178 | `list()` never returns a DEVELOPMENT descriptor outside `REAL_DEVELOPMENT` | in force |
| RG-3 | 179 | "An assignment to `VIDEO-01` / `VIDEO-02` / a mic role is refused when the device's source class is not the class of the running operation (no mixed configuration: a production camera is never recorded beside a fake microphone)" | in force (D82: "mixed sessions [...] are refused") |
| RG-4 | 180 | A search candidate "is **not** a descriptor and never enters the registry; only a successful connection test followed by the adoption of row 142 creates one" (D76 (1); R-9 AC-4, AC-8) | in force |
| RG-5 | 181 | `resolve()` of an unopenable `LOCAL_DEVICE` returns a named error; "no code path substitutes a `FAKE` adapter for it" (D80(11)) | in force |
| Development slots (D74 (2)) | 183-193 | Camera 1 = `LOCAL_DEVICE` avfoundation "MacBook Air Camera" -> `VIDEO-01`; Camera 2 = `CAM-02` `FAKE`; Mic 1 = `LOCAL_DEVICE` "MacBook Air Microphone"; Mic 2 = `MIC-02` `FAKE`. "Device IDs are the wire subjects (D72(g)); `VIDEO-0x` is the output name only." | in force |
| A.1.2 Delta (row 123): development flag and boot refusals | 198-253 | `captureOperationOf(config)`: `'SIMULATED' \| 'REAL_PRODUCTION' \| 'REAL_DEVELOPMENT'` (`:218-219`); table of 10 rows `:221-231` | in force |
| A.1.2 row 2 (the production operation) | 227 | "`real` \| `0` \| `0` \| production kinds only (or none) \| boots \| `REAL_PRODUCTION` - real devices only; a search and the connect flow are available; in this phase nothing is recordable in `REAL_PRODUCTION`: the search, the connection test, adoption and assignment are available, but no listener opens and no session starts for a source kind without an opener (`ONVIF_RTSP`, `USB_AUDIO` today) - the plan builder refuses with `SOURCE_KIND_NOT_RECORDABLE` before `app.capture.start`; no all-`PRODUCTION` package can be sealed (D82, D86 C-5; the pull path is class C-2)." (erratum PE-128-48) | in force; behaviour confirmed by README `:441` |
| "Production configuration" defined | 238-241 | "A configuration is a production configuration when at least one device assigned in the selector has source class `PRODUCTION`, or when a listener outside loopback is configured." | in force |
| Erratum PE-BN-13 (D241) | 254 | A `REAL_PRODUCTION` Core "does not start while any operator's stored credential still verifies against the published demonstration password of the seed, or while its operators cannot be read": `CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION` (`apps/core-server/src/capture/boot/checks.ts:73`, check 4c `:410-416`) | built since `713d83f`, uncommitted at README time (README `:404`) |

### 6.2 Section A.7 NM-10 (lines 761-864)

| Part | Lines | Text / content | Status |
|---|---|---|---|
| A.7 table | 763-767 (Purpose `:765`) | Purpose: "`AudioInputAdapter` (USB working assumption, AAC-LC 48 kHz mono) and `MicSwitchController` (primary/standby hot standby, switch at the next worker input-quantum boundary on the filtering thread - AU2-07, interval records, silence warning)". Authority: "OD-06/OD-09/OD-11 (D4); S2 [...]; F-44 (21.33 ms frame)". Target: `apps/capture-worker/src/adapters/audio/`, `apps/core-server/src/capture/mic-switch.ts` | Target path for the adapter corrected by A.7.1 |
| Interface | 769-782 | `interface AudioInputAdapter { enumerate(): Promise<AudioInputDescriptor[]>; open(inputId: string): Promise<AudioStreamHandle>; level(inputId: string): Promise<number> /* dBFS */ }` and `MicSwitchController { switchTo(role); intervals() }` | in force |
| Failure modes | 784-790 | no input device; disconnect (2 s debounce, OD-11); sustained silence (< -50 dBFS for 10 s -> `MIC_SILENT`, never auto-switch); switch command not honoured; both inputs down (capture fault) | in force |
| A.7.1 Delta (row 123): where the adapter lives and what it hands over | 792-812 | "the adapter is Core-process code under `apps/core-server/src/capture/adapters/audio/`. `open(inputId)` returns an `AudioStreamHandle` that names a **transport the worker already reads**. One transport exists: the row-58 kind `PCM_FIFO` - a named pipe carrying raw PCM, 32-bit float, little-endian, at the plan's sample rate and channel count (48,000 Hz, mono), written by another process (`packages/capture-protocol/src/index.ts:165-172`; decision D58-6, accepted for the fixture transport, D72(e)). Blueprint row 65 lets the adapter layer replace that transport for real devices (class C-4); **for the development sources this delta keeps it**, because it is the only transport the unchanged worker has." | in force; the real-device transport is class C-4 |
| `AudioStreamHandle` | 806-810 | `{ deviceId; input: { kind: 'PCM_FIFO'; path: string }; close() }` | in force |
| Mic helper pipeline | 814-821 (fake mic `:823`) | `<DEMS_CAPTURE_HELPER_FFMPEG> -hide_banner -nostdin -nostats -loglevel warning -f avfoundation -i "none:MacBook Air Microphone" -vn -ac 1 -ar 48000 -c:a pcm_f32le -f f32le -flush_packets 1 -y <fifo>` | in force for the development kind |
| Erratum PE-WH-10 | 827-849 | `DEMS_CAPTURE_DEV_FAKE_MIC` `tone` \| `speech`; speech fixture held to RIFF/WAVE, integer PCM, mono, 16 bit, 48 kHz | in force; development only |
| ML-1 to ML-8 | 852-859 | ML-3 "Format \| 48 kHz mono float in the pipe; the worker resamples each microphone onto the host clock by itself (D58-14: +-5,000 ppm, D72(j) F-4), so the helper does no clock correction"; ML-4 "The worker places a microphone by **arrival** (D58-6: T0 from the first 300 ms of chunks, 40 ms latency) [...] H-20"; ML-8 "'Search again' for a microphone (D80(5)) re-runs `enumerate()` [...] there is no network microphone discovery in this phase" | in force |

## 7. Later decisions that amend or bind one of the named rulings

7.1 Amendments to D75/D76 (search bound and credential gate)

| Decision | file:line | Text (cut) | Effect on the named ruling, as written |
|---|---|---|---|
| D80 (1) | `decisions.md:93` | "a search uses PROBE-ANSWER data only - no follow-up TCP read of device information (D76 wording wins over the wider D75 bound)" | narrows D75; D76 wording wins |
| D80 (3) | `decisions.md:93` | "credential entry for a camera is WEB CONSOLE ONLY in this phase" | binds the D76 credential prompt |
| D80 (5) | `decisions.md:93` | "microphones are local inputs (OD-06): 'search again' for a mic re-reads local inputs, there is no network microphone discovery" | cites OD-06 |
| D80 (7) | `decisions.md:93` | "the connect flow holds the operator's credential in memory for the connection test only; persisting it goes through op 89, which answers `503 CREDENTIAL_STORE_NOT_READY` until row 84's sealer exists [...] no second credential store" | implements D76 (3) |
| D80 (10) | `decisions.md:93` | "a camera that does not answer multicast cannot be found and typed-address entry is NOT in scope - recorded as a gap" | gap |
| D81 | `decisions.md:94` | "the credential in the op-96 body is ACCEPTED [...] three credential-carrying operations (89, 95, 96), all web-only and Try-it-denied" | implements D76 |
| D82 | `decisions.md:95` | see 7.2 | the C-2 consequence |
| D86 C-4 | `decisions.md:99` | "searching during RECORDING answers 409 until `M4-SEC-DISC-1` and `M4-SEC-DISC-3` pass - narrows D80(4)" | amends D80(4) (not D76) |
| D87 (2) | `decisions.md:100` | U-1 accepted (plain-HTTP ONVIF exposure acceptable on the user's known internal development network) | accepts SEC35-31 residual for the development network; "dedicated camera network / per-camera passwords remain class-C advice" |
| D91 | `decisions.md:104` | R-1 = option A (`captureDurable`, stored state stays RECORDING); R-2 = option A (badge only in real capture); constants fixed: "search window 3,000 ms; test deadline 15,000 ms; lock-out guard 2 per host in 30 min; search spacing 10 s per session and 5 s per Core; 6 searches/min per Core, 30/h per session"; "C-3 audit key = `endpointRef`"; "`credentialSet` on a registered camera not carried this phase" | resolves D86 C-3 and C-8 |

7.2 D82 (2026-10-09), `decisions.md:95` - the ruling that states the C-2 and codec consequence

> (a) discovery = our own probe-only WS-Discovery over `node:dgram` in one pinned file [...] `onvif` 0.8.3 (MIT) used only for the authenticated connection test [...] (b) adapters live in the Core process [...] (d) development sources are FFmpeg processes that PUSH RTSP/TCP into the listening worker and bind no port (camera: avfoundation 1280x720/30 -> `h264_videotoolbox`, GOP 30, no B-frames, wall-clock stamps; mic: avfoundation -> 48 kHz mono into the row-58 named pipe); a local device is never replaced by a fake [...] Rulings: **mixed sessions (production + development sources in one session) are refused**; **connection test: no hand-written RTSP client** - codec/profile is judged from the authenticated ONVIF answer (`onvif` package) in this phase; an RTSP-level test belongs with the real pull path (class C-2), where libavformat does it with the credential off the argument list. [...] **Consequence stated for the user:** recording from a REAL network camera stays class C-2 (the worker only listens on loopback and never dials out; no row builds the pull input) - R-9 lets the operator find, test and adopt a real camera, but a session can record from it only after the class-C pull path is built.

Status: in force. Matching spec text: `SPEC05:606` (CT-2 "No RTSP", erratum PE-128-53) and `SPEC05:636-644` (A.6.3 "As built, no such process exists for a real camera").

7.3 D92 and D93 (class-C pack and hardware state)

- D92 (`decisions.md:105`): deferral of the credential-gated connect flow "until rows 84 and the class-C pull path exist, since a real camera cannot be recorded this phase" - "Offered to the user, not taken".
- D93 (`decisions.md:106`), user verbatim: "1 hubungkan alur kredential harus dibuat workflownya dulu, karena device sudah proses pengadaan, jadi nanti tidak membuat systemnya dari 0 lagi / 2 cointroller boleh kontrol stop emulator jika sedang tidak digunakan". Recorded: "(1) The credential-gated connect flow stays in scope [...] Hardware procurement in progress also means the class-C pack (real pull path C-2, real adapters, row 105 activation) is coming: Q-HW changes from 'unknown' to 'procurement in progress' - to be raised with the user when the remaining plan is re-sequenced."

7.4 Search for amendments of OD-06 and D86 C-5

- Search used: `grep -rn "OD-06"` over the task-3 folder and a Python regex scan of `decisions/decisions.md` for `opener`, `C-5`, `SOURCE_KIND_NOT_RECORDABLE`, `hasOpener`, `no opener`, `H\.265|HEVC`, `AAC`, `Q-HW`. Result: OD-06 occurs in `decisions.md` only at line 8 (D4) and line 93 (D80(5)); no row reverses or replaces it. D86 C-5 is referenced by D96 (`decisions.md:109`) and D106 (`:119`, "refuses a source without an opener") and D123 (`:136`: "`SOURCE_KIND_NOT_RECORDABLE` is the 409 at recording start -> row 71"); no row lifts it.
- The decisions file runs to D247 (last line 260); D241 (`:254`) and D242 (`:255`) are the latest rows that mention `REAL_PRODUCTION` and the demo-password refusal (section 7.5). D163 (`:176`) and D196 (`:209`) concern the local-device checks (README `:437`).

7.5 Rulings after the final chain that bind `REAL_PRODUCTION`

- D241 (2026-10-12), `decisions.md:254`: S99-01 (HIGH) fixed now: "a `REAL_PRODUCTION` Core refuses to start while an operator still has the seed's demo password; provisioning of operators stays a task of its own". Also S99-04 (log blanking of credential-bearing URLs, for example `rtsp://user:password@h...`), S99-07 (`.gitignore` `*.p8`, `*.wrap`, `*.blob`), S99-09. "THE USER'S DECISIONS, not taken by the controller: S99-02 (server-side confirmation before a local device opens), S99-03 (retention of decrypted export archives), SEC35-26 (legal basis, retention, erasure, DPIA [...])".
- D242 (`decisions.md:255`): reports the build of S99-01 (`CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION`).
- README `:794` (Known limit 34): "The published demo password is still the password of every operator, in every capture operation; a `REAL_PRODUCTION` Core now refuses to start while an operator has it."

## 8. Ruling: production camera opener ("has an opener")

| # | Source | file:line | Text | Status |
|---|---|---|---|---|
| 8.1 | D86 C-5 | `decisions.md:99` | "no listener and no session start for a source kind without an opener; no all-PRODUCTION package can be produced in this phase" | in force |
| 8.2 | D82 consequence | `decisions.md:95` | "recording from a REAL network camera stays class C-2 [...] no row builds the pull input" | in force |
| 8.3 | SPEC05 A.1.2 row 2 | `SPEC05:227` | `ONVIF_RTSP`, `USB_AUDIO` "today" have no opener; `SOURCE_KIND_NOT_RECORDABLE` before `app.capture.start` | in force |
| 8.4 | SPEC05 A.6.3 | `SPEC05:636-644` | "Recording a real camera needs either a pull input kind in the plan (a protocol and worker change) or a pull relay in front of the unchanged worker that takes its credential on standard input - the FFmpeg command-line program cannot be that relay, because it takes the URL in its argument list. **This choice is class C-2 and is not made here**" | open; "recorded as a blueprint gap (no row builds it)" |
| 8.5 | Code comment, opener rule | `ADP/registry.ts:29-36` | "The kinds an opener can exist for IN THIS PHASE (D86 C-5; D82): the development kinds. A production camera's recording path and a production microphone's transport are class C (C-2, C-4); an adapter of those kinds that claims an opener is refused at registration [...] Adding a kind here is the decision that lands the class-C path." Value at `ADP/registry.ts:36`: `OPENER_CAPABLE_KINDS = [FAKE, LOCAL_DEVICE]` | as built |
| 8.6 | Code comment, camera stub | `ADP/camera/onvif-rtsp.ts:1-8` | "CLASS C - the production camera adapter, adapter kind `ONVIF_RTSP` (blueprint row 65; register NM-09; capture spec A.6, A.6.0; structured section 9 C-1, C-2). An INTERFACE-COMPLETE STUB [...] It has no opener (D86 C-5): the path that records a real camera is class C-2 and is decided nowhere yet (spec A.6.3)." | as built |
| 8.7 | Code comment, types | `ADP/types.ts:14-19` | "a real camera's recording path, a real microphone's transport, a real PoE switch -> class C. 'HAS AN OPENER' (D86 C-5). A source adapter states `hasOpener`. A kind whose adapter has none gets no listener and no session" | as built |
| 8.8 | Code comment, errors | `ADP/errors.ts:18`, `:24`, `:34` | `ADAPTER_INVALID` "An adapter that says it has an opener for a kind this phase has none for (D86 C-5; class C-2, C-4)"; `SOURCE_KIND_NOT_RECORDABLE` "No listener and no session for a source kind without an opener (D86 C-5)"; `CLASS_C_NOT_BUILT` "specified, not built in this phase (structured section 9 C-1 to C-4)" | as built |
| 8.9 | Code comment, kinds | `ADP/kinds.ts:67-70` | production camera kind is registered in `REAL_DEVELOPMENT` "for its search and connection-test half only: it is never assignable there (rule RG-3) and it has no opener (D86 C-5)" | as built |
| 8.10 | Code comment, discovery adapter | `ADP/camera/onvif-discovery.ts:14` | "it has no opener (D86 C-5) and no device: every device member refuses" | as built |
| 8.11 | Code comment, connection test | `ADP/camera/onvif-session.ts:1-12` | "decisions D75, D76, D82, D86 C-2 [...] No configuration call exists here: no clock, GOP, profile or network set, no reboot, no PTZ, no PoE (class C). No RTSP connection is opened: the stream address a device names is COMPARED and then dropped - never stored, never contacted (D82)." | as built |
| 8.12 | README, state | `README:441` | "A `REAL_PRODUCTION` Core cannot operate in this tree at all: no production source has an opener, no command provisions a production signing key, and since batch N it also refuses to start on the seed's operators" | stated limit |
| 8.13 | README, state | `README:442` | `M5-SEC-SRC-1` (no listener for a source kind without an opener): "its suite part is proven since batch N by a database test (`apps/core-server/src/capture-session/__tests__/session-capture.db.test.ts:432`: 409 `SOURCE_KIND_NOT_RECORDABLE`, no worker started, no source asked to open); its LIVE part (no listener in 8554-8564 on a started `REAL_PRODUCTION` Core) is not proven and cannot be at this tree, because such a Core cannot boot" | stated limit |
| 8.14 | README, state | `README:396`, `:775` (Known limit 15), `:438` | "no real network camera and no real microphone has been through a recorded, sealed session"; limit 15 "Real network cameras and real microphones are proven on doubles and generated sources only"; `:438` "Class-C hardware: real network cameras, PoE, a TPM signer, the real Core device, physical tablets and phones, a real-LAN camera search (`M4-DISC-LAN-1`) \| Not executable on this Mac" | stated limit |

## 9. Ruling: production microphone transport

| # | Source | file:line | Text | Status |
|---|---|---|---|---|
| 9.1 | OD-06 | `SPEC01:432`, `SPEC05:1298` | "transport behind `AudioInputAdapter`; USB working assumption" | working assumption (D4) |
| 9.2 | H-8 | `SPEC05:1506` | "USB is the correct microphone transport" | hypothesis, unproven |
| 9.3 | D58-6 via D72 | `decisions.md:85` (D72 clause before (f)) | "D58-6 for the fixture transport only" | in force; PCM_FIFO is the fixture transport |
| 9.4 | SPEC05 A.7.1 | `SPEC05:794-801` | only transport that exists is `PCM_FIFO` (named pipe, raw PCM float32 LE, 48,000 Hz mono); real-device transport replacement is "class C-4" | in force |
| 9.5 | Code comment | `ADP/mic-transport.ts:1-31` | "One transport exists: the named pipe of raw PCM that row 58 introduced for its fixtures (D58-6). The development sources keep it (spec A.7.1); a transport for a real USB or network microphone is class C-4 and is not built." Also states the clock statement (worker resamples within +-5,000 ppm; `MIC_CLOCK_COMPENSATION_PPM = 5_000` `:38`; `MIC_WORKER_BUFFER_CAP_MS = 2_000` `:40`; `MIC_LATENESS_TARGET_MS = 100` `:42` "not built") and "Until the worker is changed a transport must not be opened for a source whose clock is known to be outside the range." | as built |
| 9.6 | Code comment | `ADP/audio/usb-audio.ts:1-8` | "CLASS C - the production microphone adapter, adapter kind `USB_AUDIO` [...] OD-06 'USB working assumption'; structured section 9 C-4. An INTERFACE-COMPLETE STUB [...] It has no opener (D86 C-5): the transport of a real microphone is class C-4." (`hasOpener: false` `:22`) | as built |
| 9.7 | D85 R-3 | `decisions.md:98` | "Rulings: D58-14 ACCEPTED (bounds 5 ms / 15 ms live in the harness [...])"; "every microphone now passes through libswresample continuously (rate compensation to the Core clock, within +-5,000 ppm)"; D85 R-3 lateness bound change to the C worker is requested (`ADP/mic-transport.ts:25-30`); D96 (`decisions.md:109`) "the lateness bound beyond +-5,000 ppm is a worker change -> request routed to row 60" | in force; worker change status not collected (see section 15) |
| 9.8 | D80(5) | `decisions.md:93` | microphones are local inputs; no network microphone discovery | in force |

## 10. Ruling: camera codec

| # | Source | file:line | Text | Status |
|---|---|---|---|---|
| 10.1 | SPEC01 R-4 | `masterplan/01_specs.md:171-173` | "Two files (`VIDEO-01.mp4`, `VIDEO-02.mp4`), each holding that camera's video plus the single audio track on one timeline, copy-only (no re-encode)." | in force |
| 10.2 | SPEC05 development camera encoder | `SPEC05:681` | "Encoder \| `h264_videotoolbox`, `-realtime 1`, no B-frames (`-bf 0`), profile main \| hardware encoder present (P-2); B-frames would reorder and delay; the worker stream-copies H.264" | development camera helper |
| 10.3 | SPEC05 connection-test outcomes | `SPEC05:598-599` | `NOT_H264` "a usable profile exists but no profile's video encoder is H.264 (ONVIF answer)"; `REACHABLE` "authenticated; an H.264 profile; `GetStreamUri` names the candidate's own address" | in force |
| 10.4 | SPEC01 R-9 AC 6 | `masterplan/01_specs.md:292` | "*reachable* (authenticated, a usable H.264 profile found), *authentication failed*, *wrong profile*, *not H.264*, and *unreachable*" | in force |
| 10.5 | SPEC05 stub behaviours | `SPEC05:914` | stub modes include "H.265-only profile" (outcome `NOT_H264`) | test fixture |
| 10.6 | D82 | `decisions.md:95` | "codec/profile is judged from the authenticated ONVIF answer (`onvif` package) in this phase" | in force |
| 10.7 | D163 | `decisions.md:176` | "`codec` from the init segment's sample entry (`H264` / `HEVC`), unknown entry = `CAMERA_FILE_UNUSABLE`"; "NOTED for review rows: three codec vocabularies (`H264` / `HEVC`, `H265` in the connection test, `H.264 + AAC-LC` from the v1 demo generator)" | in force (D163 is the row naming `HEVC` in the transcript/camera-file reader) |
| 10.8 | Code | `ADP/camera/onvif-session.ts:98`, `:222`, `:491` | `NO_H264_PROFILE` reason; profile entry flag `h264: member(encoder, 'encoding') === 'H264'`; `ConnectionTestOutcome.NOT_H264` when no H.264 profile | as built (cited as codec test location; contents not analysed) |

No ruling in the task-3 folder states H.265/HEVC as supported or as forbidden for a production camera beyond the items above (search: Python regex `HEVC|H\.265|H265` over `decisions/decisions.md` and `SPEC05` and `SPEC01`, hits are the lines listed).

## 11. Ruling: evidentiary audio format

| # | Source | file:line | Text | Status |
|---|---|---|---|---|
| 11.1 | OD-06 | see 4.1 | AAC-LC 48 kHz mono | answered (D4) |
| 11.2 | SPEC05 section F | `SPEC05:1297` | "Codec / rate \| AAC-LC, 48 kHz, mono \| OD-06 (D4); F-44" | in force |
| 11.3 | SPEC05 section F | `SPEC05:1299` | "One session track: `AUDIO-01` is the one session audio track carrying the active mic; `MIC-01`/`MIC-02` are inputs (`MicRole` PRIMARY/STANDBY); `AUDIO-02` legacy v1 only" | in force (OD-01, D4) |
| 11.4 | SPEC01 R-4 / E.2 | `masterplan/01_specs.md:171`, `:492-503` | one audio track per file; embedded libavfilter capture worker: "two `abuffersrc`/device-fed inputs -> `astreamselect` (named instance) -> `aformat` (48 kHz mono) -> native `aac` -> mp4/fMP4" | in force |
| 11.5 | D85 / D72(j) | `decisions.md:98`, `:85` | "**Evidence property changed and stated: every microphone now passes through libswresample continuously (rate compensation to the Core clock, within +-5,000 ppm) - spec 05 section F's sentence 'a correction never resamples the evidentiary audio' is superseded by D72(j); erratum at row 128/63; reported to the user.**" | in force; amends the SPEC05 F statement |
| 11.6 | Manifest field 53 | `masterplan/06_evidence_package_spec.md:445`, `:460` | `audio.codec` `AAC-LC mono 48 kHz` is "a constant of the sealing host, not read from the file or the worker" (PE-WI-30) | as built per the erratum; follow-up `implementation/137_docs_errata_followup.md:88` (row 2: "the worker source was not read for it") |
| 11.7 | Code | `ADP/mic-transport.ts:35` | imports `CAPTURE_AUDIO_CHANNELS, CAPTURE_AUDIO_SAMPLE_RATE_HZ` from `@dems/shared/api` | as built |
| 11.8 | SPEC05 A.7.1 ML-3 | `SPEC05:854` | "48 kHz mono float in the pipe" | in force (transport input format, before AAC) |

No ruling in the folder mentions a 24-bit sample format or multi-input audio for the evidentiary track (search: regex `24-bit|s24|multi-input` over `decisions/decisions.md`: no hits).

## 12. Ruling: number of sessions and cameras per Core

| # | Source | file:line | Text | Status |
|---|---|---|---|---|
| 12.1 | SPEC01 R-6 | `masterplan/01_specs.md:195-196` | "One active session per Core; a new session is blocked until the previous reaches `SEALED` (rooms may wait)." AC 1: "A start request while a session is open is refused; after `SEALED` it succeeds" | in force (D4 OD-08 cited) |
| 12.2 | OD-05 | `SPEC01:431` | "Support both topologies (one dual-lens or two PoE); fakes emulate two cameras" | answered (D4) |
| 12.3 | SPEC05 A.1 | `SPEC05:104-108`, `:111-117` | devices `VIDEO-01`, `VIDEO-02`, `MIC-01`, `MIC-02`, PoE port; "one dual-lens camera with two profiles **or** two PoE cameras" | in force |
| 12.4 | D73 | `decisions.md:86` | "product needs 2 + 2" (two cameras, two microphones); "measured: 1 camera + Desk View + 1 microphone via avfoundation" | in force |
| 12.5 | D72(k) | `decisions.md:85` | "if no camera connects within the ingest-open window the session FAULTS and nothing claims to record [...]; one camera = valid degraded session with a warning" | in force |
| 12.6 | D80(6) | `decisions.md:93` | "both cameras or both mics unreachable blocks, one camera or the standby mic unreachable warns and allows a degraded session" (amended for the active mic by D83 OP-125-1, `decisions.md:96`) | in force |
| 12.7 | D10 row 7 S1 | `SPEC05:74` (decision-inputs table) | "G-1 restart-per-session" | in force |
| 12.8 | README | `README:507` | "A start with one of two cameras missing records with one camera and raises a warning that names the missing one; a start with no camera ends as a failed star[t]" | stated behaviour |
| 12.9 | D4 | `decisions.md:8` | "OD-09 [...] hot standby" (two microphones, one active) | answered |

"Rooms per Core" (Q6 of the current plan): searched for the word "rooms" in `decisions/decisions.md` and `SPEC01`; the only hit is `SPEC01:195` ("rooms may wait") and the installation identity default `DEMS-IR-01 / Interview Room 1` in D209 (`decisions.md:222`). No ruling fixes a number of rooms per Core beyond R-6.

## 13. Ruling: production host

| # | Source | file:line | Text | Status |
|---|---|---|---|---|
| 13.1 | R-7 | `masterplan/01_specs.md:206-207` | "The production hardware baseline is at least this Mac (Apple M5 4P+6E, 24 GiB) and **CPU-only for STT**." | in force (D4 OD-24, Q-HW; D230) |
| 13.2 | OD-24 + D7(b) | `SPEC01:450`; `decisions.md:13` | "portable `cpu-local` whisper.cpp for the x86 Linux Core is **not cancelled**"; D7: "the portable CPU runtime for the shipped x86 Linux Core (OD-24 whisper.cpp) is NOT cancelled" | in force |
| 13.3 | Q-HW | `SPEC01:455`; `STRUCT:600`, `:649` | "unknown: class C deferred" | register word "unknown"; D93 (`decisions.md:106`) changes it to "procurement in progress", to be raised with the user |
| 13.4 | SPEC01 A.3 out of scope | `masterplan/01_specs.md:119-130` | "Production OS image, installer, TLS PKI beyond the dependencies it creates \| `translated` Scope; report section 10" | in force |
| 13.5 | D71 | `decisions.md:84` | "Linux per-thread niceness -> class C" | in force |
| 13.6 | C-7 / C-8 | `STRUCT:556-557` | benchmark "on the real Core device (Q-HW)"; TPM/PKCS#11 "device with TPM" | class C |
| 13.7 | README | `README:633` | manifest states "time source `RTC` / `HOST_SYSTEM_CLOCK` (a Core in its own capture has no time service and never says GNSS)" | as built |

No ruling names Linux as the production host for the capture worker or the capture adapters (search: regex `Linux|production host` over `decisions/decisions.md`: hits only D7 line 13 and D71 line 84). The FFmpeg-based development helpers are macOS `avfoundation` (`SPEC05:814-821`, `D82` clause (d)).

## 14. Ruling: camera credentials

| # | Source | file:line | Text | Status |
|---|---|---|---|---|
| 14.1 | D76 | `decisions.md:89` | see 3.1 | in force |
| 14.2 | D68(c) | `decisions.md:81` | "credential sealer: row 84 (M7-W3 key store, SEC35-03) owns `provideCredentialSealer` + opener [...] until then a SECRET write answers 503" | in force |
| 14.3 | D80(7), D81, D83 | `decisions.md:93`, `:94`, `:96` | op 89 write path; op 95/96 carry the credential; "0 flows show a stored credential"; credential entry web-only; "F-122-2 (credential CHECK needs 33 bytes of ciphertext) -> row 84's sealer pads" | in force |
| 14.4 | D86 C-1, C-2, C-6; SEC35-31 | `decisions.md:99` | see 3.2 | in force |
| 14.5 | D87 (2) | `decisions.md:100` | U-1 accepted | in force |
| 14.6 | SPEC05 CR-1 to CR-7 | `SPEC05:617-625` | lifetime = one call; no cache; never in a log line, audit detail, URL, argument list, env var or file; on the wire "Only as a digest toward the device service (WS-Security `PasswordDigest` or HTTP Digest) [...] the account name travels in clear (accepted on the development network, D87(2))"; persistence only through op 96/89 after row 84; "an agent never types, stores or receives a real camera credential (D76 (4))" | in force |
| 14.7 | SPEC05 A.6.3 | `SPEC05:627-635` | `pullUrl` returns `rtsp://host:port/path` without a credential; "the credential joins it only at the point where the process that opens the RTSP session is started"; travels "as separate fields beside the URL in the start message on that process's standard input [...] never in the argument list, never in the environment, never as `rtsp://user:pass@host`" | in force; the receiving process does not exist (8.4) |
| 14.8 | Code comment | `ADP/credential.ts:1-21` | "A stream locator is the host-and-path form and never carries a user part [...] As built, no process takes a credential: recording a real camera is class C-2. So `credentialAtInjection` has no caller in the product yet" | as built |
| 14.9 | D96 | `decisions.md:109` | "`testConnection` takes a sealed credential; no `user:pass@host` locator is ever composed" | in force |
| 14.10 | D241 (S99-04) | `decisions.md:254` | log blanking of credential-bearing URLs (`rtsp://user:password@h...`) | built in batch N, uncommitted at README time |
| 14.11 | README | `README:505`, `:455`, `:782`, `:797` | Devices paragraph: credentials "typed in the web console only, are write-only and are never shown again"; Known limit 22 "A replaced camera-credential envelope is not cleaned up by the running Core" (D181); limit 37 "No key escrow: losing `<data directory>/credential-store` makes every sealed recording unreadable (SEC35-09)" (D241) | stated limits |
| 14.12 | User scope | D87(3),(4) | `decisions.md:100` | U-3, U-4 answers |

## 15. Gaps, searches reported "not found", and verification notes

- Not found: any user answer after D93 changing Q-HW from "procurement in progress" to a named hardware model (searched `Q-HW` in `decisions/decisions.md`: hits at lines 6, 8, 27, 38, 106 only). `SPEC01:455` and `STRUCT:600` still read "unknown" (the register rows were not edited after D93).
- Not found: the text of rev-1 `STRUCT` section 5 ("Class A/B/C definitions unchanged (rev 1 section 5)", `STRUCT:312`). The rev-1 text is not in the current `02_structured.md`; the only definitions in the folder are `ORIG:33-35` (section 5.1).
- Not found: any ruling that states "24-bit" or multi-input audio, or that approves H.265/HEVC for a production camera (searches in sections 10 and 11).
- Not found: any ruling selecting the pull-input design for class C-2 (`SPEC05:641-644` says "not made here"; `decisions.md:95` and `:105-106` say "no row builds it").
- Not collected (outside the stated target): the contents of `apps/capture-worker/src/audio.c` and the status of the D85 R-3 worker change; `masterplan/09_security_design_review.md` text of SEC35-27 to SEC35-49 (only their D86 summary was collected).
- Verification: every `file:line` above was read from the file on 2026-10-12 with a line-numbered `awk`/`grep -n` call in this run, except the following, which are cited as the sources themselves cite them (not re-opened): `ADP/camera/onvif-session.ts:98,:222,:491` were located by `grep -n` only; `apps/core-server/src/capture/boot/checks.ts:73,:410-416` and `session-capture.db.test.ts:432` are quoted from `SPEC05:254` and `README:442`.
- Nothing under `apps/input-av/data/` was opened; no `.env` file was opened; no camera was contacted; no program was started.

---
*Generated: 2026-10-12*
*Last Updated: 2026-10-12*
