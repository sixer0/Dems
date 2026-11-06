---
task_slug: input_av_core_adapter_plan
date: 2026-10-12
agent: data-analyst
blueprint_row: 3
milestone: M0
type: decision-drafts
tier: T1
status: DRAFT - nothing here is in force until the controller records it in decisions/decisions.md
confidence: HIGH for the quoted wording; MEDIUM for the six driver decisions of section 7
source_blueprint: identification/03_implementation_blueprint.md (row 3, line 126; profile line 293)
last_updated: 2026-10-12 22:40
---

# Row 3: amending decision rows, static-rule amendments and closure lines (DRAFTS)

## 0. Frame (5W1H)

| | |
|---|---|
| **What** | 14 draft texts for the controller to adopt: 7 amending decision rows (AM-2 to AM-8), 4 static-rule amendment rows (SR-1 to SR-4), 3 closure lines (WP-16, WP-17, WP-18). AM-1 is not here: it is drafted by row 87 and written at the lift (`decisions/01_decision_register.md:143`; blueprint row 87, line 210). |
| **Why** | The user accepted the amendments "as far as needed" (U12 A6, `decisions/decisions.md:24`); C4 (`decisions/decisions.md:31`) says their exact wording is the register's and that each takes effect in the package that needs it. The register leaves writing each as a decision row to the controller (`decisions/01_decision_register.md:152`). The static rules turn red when the packages land (review finding P12-F04, `verification/03_plan_review.md:60`); the addendum decided each (`masterplan/04_design_addendum.md:544-557`) and demands "one decision row" per amended rule. Twelve rows of the blueprint cite this text by contract dependency or by the `static-capture` rule "amended by row 3's decision text" (blueprint line 466). |
| **Who** | Drafted by the data-analyst driver of row 3. Adopted, numbered and dated by the controller (U12 B2). Consumers: rows 21, 64, 65, 66, 95, 96, 110 (dependency `3:C`), and rows 26, 49, 80, 105, 107 through the `static-capture` token. The user is not asked: every text stays inside the extent U12 A6 accepted (section 6 shows this per row). |
| **When** | Drafted 2026-10-12. Each row states "takes effect": the package that needs it, not before (C4). |
| **Where** | This file only. `decisions/decisions.md` is not written by this row (driver rule, `delegation_progress/driver_rules.md:20`). No source file is changed. |
| **How** | The register's columns "Amendment proposed" / "What exactly changes" / "What does not change" were copied (`decisions/01_decision_register.md:427-441`), then bounded by what was ruled after the register: C1, C7, C10, C11, C15 and the security check of the addendum (`verification/04_security_addendum.md`). The static rules were read today in `apps/core-server/src/capture/__tests__/static.test.ts` (read-only) so that each draft states the rule as it stands and the exact delta. |

**Method limits.** The task-3 decision file was not opened; the texts of D75, D76, D80, D81, D82 are quoted from row 5's collection (`research/02_collection_rulings.md`) and from the register, as the register itself did. No test was run: this row is documents only. The static test file was read in the working tree, in which another row of this batch has uncommitted edits to a different file (`apps/core-server/src/capture/adapters/__tests__/static.test.ts`); the file quoted here (`apps/core-server/src/capture/__tests__/static.test.ts`) showed no modification in `git status --short` at 22:26.

## 1. How the controller adopts these drafts

1. Each draft row below is written in the five columns of `decisions/decisions.md` (`# | Date | Decision | By | Status`). The `#` cell holds a placeholder (`Cnn (AM-2)` and so on); the controller assigns the number.
2. A draft may be adopted earlier than its "takes effect" line; it binds no package before that line (C4).
3. Adoption is one row per draft. SR-2 may be adopted in the same act as AM-3 (the addendum says "decision row with AM-3", `masterplan/04_design_addendum.md:551`), but it stays a row of its own because WP-19c also uses it.
4. Six points in section 7 are DRIVER DECISIONS: the conservative reading was taken; the controller confirms or changes them at adoption.
5. An amendment wider than a draft's "What changes" is a scope change and goes back to the user (`decisions/01_decision_register.md:152`).

## 2. Count against the Verification cell

| Required | Drafted | Where |
|---|---|---|
| AM rows 7 of 7 | 7: AM-2, AM-3, AM-4, AM-5, AM-6, AM-7, AM-8 | section 3 |
| Static-rule rows 4 of 4, each naming its package | 4: SR-1 (WP-02, WP-08, WP-07a), SR-2 (WP-12, WP-19c), SR-3 (WP-22a, WP-04), SR-4 (WP-08, WP-19b) | section 4 |
| Closure lines 3 of 3, each citing its ruling | 3: WP-16 (U12 A1), WP-17 (U12 A8), WP-18 (U12 A10 with U11 on OQ-3) | section 5 |

## 3. The amending decision rows (AM-2 to AM-8)

Source of every "Ruling today" quotation: `decisions/01_decision_register.md:428-441`, which quotes `research/02_collection_rulings.md` (D75 at line 62, D76 at 58, D80 at 206-210, D81 at 211, D82 at 219).

### AM-2 amends D82 (codec judged from the stream)

| # | Date | Decision | By | Status |
|---|---|---|---|---|
| Cnn (AM-2) | 2026-10-12 | (controller, on U12 A6 and A4; wording of the register, entry AM-2) Task-3 ruling D82 is amended in one clause. D82 today: "codec/profile is judged from the authenticated ONVIF answer (`onvif` package) in this phase". Amended: for a production camera the codec and the profile code are judged from the STREAM, read by the relay in probe mode after the ONVIF half of the connection test has authenticated. The outcome vocabulary of the connection test grows additively; `NOT_H264` stays, for a stream that is neither H.264 nor HEVC. Bound set by the security check (AD-06, which governs by C15): the codec of a minted code is one of a closed set decided by the Core's own parse of the parameter-set bytes with the function the seal uses; no string from the relay, the stream description or an ONVIF answer is ever a part of the code; the probe report is a frame of fixed shape and bounded size. The ONVIF answer remains advice for the screen only. Unchanged in D82: discovery by the Core's own probe; adapters in the Core process; mixed sessions refused; no hand-written RTSP client (the relay uses the pinned libavformat, credential off the argument list, as D82 itself foresaw for the pull path); the worker listens on loopback and never dials out. Conditional clause of the register ("if F-1 is answered B, D82's 'never dials out' is amended as well"): NOT in effect - F-1 is ruled variant A, the relay (U12 A3, C11). It takes effect only if gate RC-1 (row 8) selects branch C, "the worker pulls"; the controller then logs it with that gate and row 9 refines the blueprint. Takes effect: before WP-05 starts (rows 38, 50, 51) | controller, on U12 A6 | draft |

| Aspect | Content |
|---|---|
| Ruling today | D82 (`research/02_collection_rulings.md:219`, `:280`) |
| What changes (register) | "The codec is judged from the stream by the relay in probe mode; the outcome vocabulary grows additively and `NOT_H264` stays for a stream that is neither H.264 nor HEVC. If F-1 is answered B, D82's 'never dials out' is amended as well" (`decisions/01_decision_register.md:428`) |
| Bound added after the register | AD-06 (1) to (3) (`verification/04_security_addendum.md:277-282`); correction "the codec comes from the Core's own parse, from a closed set" (blueprint 11.3, line 645). Design: `masterplan/04_design_addendum.md:442`, `:463-469` |
| Why the amendment is needed | The four bench cameras report H264 over ONVIF and deliver H.265 (`masterplan/04_design_addendum.md:451`); judged from the ONVIF answer, every session of such a camera would carry the sealed notice `STREAM_PROFILE_DIFFERS` |
| Package, rows | WP-05: rows 38 (vocabulary), 50 (stream test), 51 (adoption writes the code). WP-04 row 26 mints no code |
| Blocks | WP-05; through it WP-13 (`decisions/01_decision_register.md:144`) |

### AM-3 amends D80(10) for the camera search (typed-address probe)

| # | Date | Decision | By | Status |
|---|---|---|---|---|
| Cnn (AM-3) | 2026-10-12 | (controller, on U12 A6 and A7; wording of the register, entry AM-3) Task-3 ruling D80(10) is amended for the camera search. D80(10) today: "a camera that does not answer multicast cannot be found and typed-address entry is NOT in scope - recorded as a gap". Amended: the camera search may send one unicast WS-Discovery probe to an address the technician types. The result is built from PROBE-ANSWER data only, so D80(1) stands for the search: no follow-up TCP read of device information, no ARP sweep, no ping, no direct unauthenticated ONVIF check in the search. The typed address passes the one destination rule of S13-11 (row 95) before any packet is built: private ranges only, the camera interface only, no loopback, port and rate bounds. Permission (C10): the permission of today's camera search, web console only. A typed-address candidate is a candidate like any other: nothing is connected, registered or authenticated by it (D76 (1), RG-4 unchanged), and a changed camera address is never followed automatically. Takes effect: when WP-12's live path starts (row 96; the contract row 94 changes a body, not the count) | controller, on U12 A6, A7 | draft |

| Aspect | Content |
|---|---|
| Ruling today | D80(10) (`research/02_collection_rulings.md:210`) |
| What changes (register) | "Typed-address unicast probe allowed; probe-answer data only, so D80(1) stands" (`decisions/01_decision_register.md:429`); answered by U12 A7 (`:341`) |
| What does not change | D80(1) and D80(10) for the search beyond this (`decisions/01_decision_register.md:449`); the plan's "Must NOT" of phase 8 (`masterplan/02_plan.md:456`) |
| Bound added after the register | S13-11 destination rule (`verification/02_security.md:231`; blueprint row 95, line 218); C10 (`decisions/decisions.md:37`) |
| Package, rows | WP-12: rows 94, 96, 97, 98. Static rule: SR-2 |
| Blocks | WP-12 only (`decisions/01_decision_register.md:156`) |

### AM-4 amends D75 (network configuration of a camera; temporary host address)

| # | Date | Decision | By | Status |
|---|---|---|---|---|
| Cnn (AM-4) | 2026-10-12 | (controller, on U12 A6 with U6, U7, U10; wording of the register, entry AM-4) Task-3 ruling D75 is amended in one clause. D75 today: "probes and unauthenticated device information only; no authentication attempt, no credential guessing, no configuration change on any discovered device (NTP, GOP, profiles, PoE stay class C until the user names a camera and its account)". Amended: the product may change a camera's NETWORK configuration (`SetNetworkInterfaces`, `SetNetworkDefaultGateway`, `SystemReboot`) as an operator action with an operator-typed credential, and may add a temporary address to its own camera interface. Nothing else changes: no clock, GOP, profile or PoE setting; no credential guessing and no default list; the agent rule of D76 (4) stands - agents never type a real credential and never run this against a real camera. Bounds ruled since: TECHNICIAN role only (U10); every target address passes the destination rule of S13-11 (row 95), which has no DHCP mode; the temporary address is added and removed only through the privileged helper with its nine self-enforced bounds (S13-08, row 104), installed by the user (U12 B5); each helper call is audited by intent and result (S13-10). Takes effect: before WP-19 starts (rows 104 to 108); it also governs WP-22 (rows 109 to 113) | controller, on U12 A6 | draft |

| Aspect | Content |
|---|---|
| Ruling today | D75 (`research/02_collection_rulings.md:62`) |
| What changes / does not change (register) | `decisions/01_decision_register.md:437`, both columns copied |
| Bound added after the register | U10 (`decisions/decisions.md:20`); S13-08 (`verification/02_security.md:192-203`); S13-11 (`:231`); row 95 "no DHCP mode" (blueprint line 218); U12 B5 |
| Package, rows | WP-19 (104-108), WP-22 (109-113); with them WP-23, WP-25 (`decisions/01_decision_register.md:146`) |
| Stays unproven on this Mac | Everything against a real camera or a real interface: helper double and ONVIF stub only; hardware checks of the package (`9A/H-05`, `H-06`, `H-14`; blueprint line 527, `masterplan/02_plan.md:682`) |

### AM-5 amends D80(1) (the commissioning scan is a separate operation)

| # | Date | Decision | By | Status |
|---|---|---|---|---|
| Cnn (AM-5) | 2026-10-12 | (controller, on U12 A6 with U6, U7; wording of the register, entry AM-5) Task-3 ruling D80(1) is read as follows. D80(1) today: "a search uses PROBE-ANSWER data only - no follow-up TCP read of device information". Ruled: the commissioning scan is a DIFFERENT OPERATION from the search. At the configured factory addresses it may ping, read the neighbour table and make the unauthenticated ONVIF time read over TCP. The camera search (operation 93) stays probe-answer only; none of these three means is carried into it. Bounds ruled since: TECHNICIAN only (U10); the scan result lives in memory only - a device that is not adopted gets no stored row (U11 on OQ-1); device text of a reply reaches no log, audit detail or error; every target passes the destination rule of S13-11; no passive monitoring (U9). Takes effect: before WP-19 starts; consumed by row 107 (WP-19c) | controller, on U12 A6 | draft |

| Aspect | Content |
|---|---|
| Ruling today | D80(1) (`research/02_collection_rulings.md:206`) |
| What changes / does not change (register) | `decisions/01_decision_register.md:438` |
| Bound added after the register | U9, U10, U11 OQ-1 (`decisions/decisions.md:19-22`); row 107's checks (blueprint line 230) |
| Package, rows | WP-19: row 107 (scan), row 95 (destination rule). Static rule: SR-2 for its probe call; G-R13 is kept (the scan does not call `discover`, `masterplan/04_design_addendum.md:554`) |

### AM-6 amends D80(10) for commissioning (stored list plus one typed address)

| # | Date | Decision | By | Status |
|---|---|---|---|---|
| Cnn (AM-6) | 2026-10-12 | (controller, on U12 A6 with U6, U7; wording of the register, entry AM-6) Task-3 ruling D80(10) ("typed-address entry is NOT in scope") is lifted FOR COMMISSIONING: the commissioning scan addresses the stored factory address list plus one address the operator types. For the camera search D80(10) is amended only as AM-3 says. Bounds: the list is data in `capture_network_config` without makers' names (G-R14 kept); a change of it writes `CAPTURE_NETWORK_CONFIG_CHANGED`; every address, listed or typed, passes the destination rule of S13-11. Takes effect: before WP-19 starts; consumed by rows 107 and 108 | controller, on U12 A6 | draft |

| Aspect | Content |
|---|---|
| Ruling today | D80(10) (`research/02_collection_rulings.md:210`) |
| What changes / does not change (register) | `decisions/01_decision_register.md:439` |
| Bound added after the register | G-R14 kept (`masterplan/04_design_addendum.md:555`); audit of the list (addendum 8.1 WP-19d, line 514) |
| Package, rows | WP-19: rows 107, 108; the list's table arrives with schema set B (row 99) |

### AM-7 amends D81 with D80(7) (a fourth credential-carrying operation)

| # | Date | Decision | By | Status |
|---|---|---|---|---|
| Cnn (AM-7) | 2026-10-12 | (controller, on U12 A6; wording of the register, entry AM-7; the choice inside it by C1 and C7) Task-3 rulings D81 and D80(7) are amended in the count. Today: "three credential-carrying operations (89, 95, 96)"; the connect flow "holds the operator's credential in memory for the connection test only". Amended: a FOURTH credential-carrying operation exists, the set-camera-network operation, web console only and Try-it-denied like the three. The choice of the register is closed as (a): the credential is typed by the technician for that one operation on one camera, lives in process memory only until the operation ends (the SetNetworkInterfaces call and its own read-back), and is typed again for adoption; it is never handed on to a later job or to the adoption (C1, C7). Unchanged: the credential is never stored by this operation, never in a log, audit detail, file, argument or environment, never tried from a default list; storage stays with adoption (operation 96) into the sealed, write-only store. Bounds ruled since: the set-network file and the job file import neither the credential reader nor the reveal module (addendum 2.5); the lock-out guard counts this fourth operation; the unauthenticated poll comes first and authenticated reads per job are at most 3 (S13-04). Takes effect: before WP-22 starts (rows 110, 111) | controller, on U12 A6, C1, C7 | draft |

| Aspect | Content |
|---|---|
| Ruling today | D81, D80(7) (`research/02_collection_rulings.md:209`, `:211`); credential rules CR-1 to CR-7 (`:340`) |
| What changes / does not change (register) | `decisions/01_decision_register.md:440` |
| The choice (a) or (b) | Left open by the register (`:447`); decided (a) by C1 (`decisions/decisions.md:28`) and read by C7 (`:34`). This draft records the closure; it decides nothing new |
| Bound added after the register | `masterplan/04_design_addendum.md:239`; row 110 "importers of the reader in this file: 0"; row 111 (blueprint lines 233-234) |
| Package, rows | WP-22: rows 110, 111, 113. The operation count moves in row 102 (WP-23b), not here |

### AM-8 amends D76 (3) (one step before adoption)

| # | Date | Decision | By | Status |
|---|---|---|---|---|
| Cnn (AM-8) | 2026-10-12 | (controller, on U12 A6; wording of the register, entry AM-8) Task-3 ruling D76 (3) is amended in its order. Today: "candidate -> operator action -> credential prompt -> existing write-only credential path (op 89) -> connection test -> only then assignable". Amended: the order gains ONE step before adoption - set network. It is confirmed as inside D76 (2), "every connectivity action is a separate operator action": the step is started by the technician, with the credential typed for it (AM-7). Unchanged: everything after it - a camera is assignable only after adoption and its connection test; every step audited without values; the search still yields a candidate list only. Takes effect: before WP-22 starts (rows 111, 113) | controller, on U12 A6 | draft |

| Aspect | Content |
|---|---|
| Ruling today | D76 (3) (`research/02_collection_rulings.md:58`) |
| What changes / does not change (register) | `decisions/01_decision_register.md:441` |
| Not arising | RG-4 with D76 (1) is not amended: OQ-1 is "not stored" (U11; `decisions/01_decision_register.md:443`) |
| Package, rows | WP-22: rows 111 (job), 113 (screens) |

## 4. The static-rule amendment rows (addendum 8.3)

Rule texts as read today in `apps/core-server/src/capture/__tests__/static.test.ts` (abbreviated `CST`). Paths of new files are NOT stated: the blueprint marks them NEW or "executor declares" (profile lines 311, 354-356, 386, 400), so each draft names the file by its role and the row that creates it. The single writer of `CST` at any time is given by the `static-capture` token: one writer at a time, row 21 first (blueprint line 466). Every amendment is an addition to an exact list; no pattern is loosened and no control test is removed.

### SR-1 amends G-R2 with G-R8 (exact lists of process and file-system importers)

| # | Date | Decision | By | Status |
|---|---|---|---|---|
| Cnn (SR-1) | 2026-10-12 | (controller, on addendum 8.3 and review finding P12-F04) Static rules G-R2 and G-R8 of the capture unit are AMENDED BY LIST, by exactly three entries, each added by the row that creates the file and in the same change set: (1) the production process door of WP-02 (row 21) joins the G-R2 allowlist, the list of files importing the process module and the G-R8 list of files that start a process - it becomes the third process file beside `src/capture/ipc.ts` and the local helper door; (2) the ALSA configuration writer of WP-08 (row 65) joins the G-R2 allowlist and the list of file-system importers, for writing under the Core's run directory only; (3) the card listing reader of WP-07a (row 64) joins the G-R2 allowlist and the list of file-system importers, for reading only. The lists stay exact (`toEqual`), so a fourth file of either kind fails the test until a further decision row admits it. Unchanged: the other three tests of G-R2 (no socket or worker thread under `capture/`; no credential or key file named; the one spawn of `ipc.ts` with no shell and never the server's environment); the timer, time and random lists of G-R8; G-R1 (modules start no process and open no socket - commissioning routes hold routes only). The local helper door is not edited. Takes effect: per entry, with rows 21, 65, 64 | controller | draft |

| Aspect | Content |
|---|---|
| Rule today | G-R2: allowlist of six files `CST:150`; process importers exactly `[local door, ipc.ts]` `CST:156`; file-system importers exactly four files `CST:160`. G-R8: process starters exactly `[local door, ipc.ts]` `CST:220-221` |
| Decision of the addendum | "amended by list: + the production door, + the ALSA configuration writer, + the card listing reader; one decision row" (`masterplan/04_design_addendum.md:549`) |
| Packages named | WP-02 (row 21), WP-08 (row 65), WP-07a (row 64) |
| Check that shows it | rows 21 and 65: "the rule lists ... pass in their amended state" (blueprint lines 144, 188); the control tests of `CST` still find their planted violations |
| Kept beside it | "no socket module under `capture/`" for WP-06c: presence uses the ONVIF time read (`masterplan/04_design_addendum.md:550`; row 49's check "no socket module is imported under the capture folder") |
| Open point | Section 7, point 4: rows 80 and 105 create files that may need a process or file-system import the addendum's list does not hold |

### SR-2 amends G-R9 (one datagram socket, one destination)

| # | Date | Decision | By | Status |
|---|---|---|---|---|
| Cnn (SR-2) | 2026-10-12 | (controller, on addendum 8.3; with AM-3 for the search and AM-5, AM-6 for the commissioning scan) Static rule G-R9 is AMENDED in its destination clause only. Today the one send call site has as destination the multicast group constant or the injected test target, which is refused unless it is the loopback literal. Amended: a third destination is admitted, ONE unicast address that has passed the destination rule function of row 95 (S13-11) before any packet is built. The probe to it is sent from the SAME ONE FILE, the pinned WS-Discovery file; no second file imports the datagram module. Unchanged and still pinned: one importer of the datagram module; one importer of the XML parser with its pinned options; type `udp4` only; TTL 1; no group joined, no shared port, no broadcast, no IPv6; one place that closes the socket and the settle-through-it rule; the handler as one try / catch; the loopback test target named in that one file only; the discovery files log nothing and write no file. The static test must show that the unicast destination can only be a value returned by the rule function (a typed or stored address never reaches the send call directly). Users: WP-12 (row 96, the typed-address probe of the search) and WP-19c (row 107, the scan's own probe call - G-R13 is kept, the scan does not call `discover`). Takes effect: with row 96 | controller | draft |

| Aspect | Content |
|---|---|
| Rule today | `CST:242-335`: importer `CST:286`; one `createSocket`, `udp4`, group constant, TTL `CST:292-297`; one send, "destination = fixture ?? WS_DISCOVERY_GROUP", loopback refusal `CST:299-303`; address literals exact list `CST:305` |
| Decision of the addendum | "amended: the unicast probe to a validated address, in the same one file; decision row with AM-3" (`masterplan/04_design_addendum.md:551`) |
| Packages named | WP-12 (row 96), WP-19c (row 107); the rule function is row 95 |
| Check that shows it | row 96: "a refused address sends 0 packets; the search without a typed address shows 0 changed results" (blueprint line 219) |
| Note for the writer | The pins of the send call site and of the address-literal list (`CST:299-305`) are exact strings: they move with the code of row 96 by delta, in that row's change set. Whether the file keeps one send call site or gains a second is the executor's design inside this bound; "one file, one socket" does not move |

### SR-3 amends G-R10 with G-R11 (one importer of the `onvif` package; five reads)

| # | Date | Decision | By | Status |
|---|---|---|---|---|
| Cnn (SR-3) | 2026-10-12 | (controller, on addendum 8.3; with AM-4 and AM-7) Static rules G-R10 and G-R11 are AMENDED in two places. (1) A SECOND IMPORTER of the `onvif` package is admitted: the set-network file of WP-22a (row 110), importing the client's own file and never the package's main entry. Its calls on the client are an exact list of four, the calls of the set-camera-network operation: `GetNetworkInterfaces`, `SetNetworkInterfaces`, `SetNetworkDefaultGateway`, `SystemReboot` (as the package names them). The type declaration beside the importers declares these four in addition to the five reads and no other member. The set-network file imports neither the credential reader nor the reveal module. (2) The exact export list of the connection file may grow by the names WP-04 needs for the profile and locator reads (row 26); its calls stay the five reads. Unchanged: the connection file keeps "no configuration call" - its call list stays exactly the five reads, so a network call, a clock, GOP or profile set, or a reboot in that file still fails; no socket, TLS or HTTP/2 module anywhere under `capture/`; the HTTP agent imports stay in the connection file as they are, unless row 110 needs the same two for the same purpose, which it then pins by exact string in the same way; the certificate-check exception is not widened without a line in row 110's record and the TLS 1.2 floor beside it; one constructor rule (no automatic connect, address preserved, explicit request limit, no listener) holds for each importer; the client never leaves either file. Takes effect: (2) with row 26, (1) with row 110 | controller | draft |

| Aspect | Content |
|---|---|
| Rule today | `CST:362-440`: importers exactly `[type declaration, connection file]` `CST:404`; five reads `CST:372`, `CST:412-414`; exports exact list `CST:425-426`; agent imports and "no socket, TLS or HTTP/2" `CST:432-434`; certificate exception in one file `CST:436` |
| Decision of the addendum | "amended: a second importer, the set-network file, with its four calls declared; the connection file keeps 'no configuration call'" (`masterplan/04_design_addendum.md:552`) |
| The four calls | Named in `masterplan/01_specs.md:150`; present in package version 0.8.3 (`verification/01_verification.md:174`). `SetNetworkInterfaces` with a manual address only: the destination rule has no DHCP mode (blueprint line 218) |
| Packages named | WP-22a (row 110), WP-04 (row 26) |
| Check that shows it | row 110: "the rule lists G-R10, G-R11 pass in their amended state"; "importers of the reader in this file: 0" (blueprint line 233) |
| Stays unproven | The package's behaviour for the four calls on a real camera: stub only (row 109); hardware check `9A/H-14` (`masterplan/02_plan.md:682`) |

### SR-4 amends G-R12 (helper arguments), with the sentence of AD-07 (2)

| # | Date | Decision | By | Status |
|---|---|---|---|---|
| Cnn (SR-4) | 2026-10-12 | (controller, on addendum 8.3 and on AD-07 (2) of the security check, which governs by C15) Static rule G-R12 is AMENDED NARROWLY, in three places. (1) The format list gains `alsa` (five formats become six). (2) The vertical bar stays a forbidden character of every helper argument EXCEPT exactly one: the channel selection text of the Linux microphone table, made by one table function from an integer 0 to 63; an integer outside that range is refused. Reason: U2 makes the tested `pan` text of input-av the default. (3) The helper's device argument is built by a table function from TWO INTEGERS ONLY (card index, device index). No descriptor string and no card id forms any part of an argument. "Built from the live listing" therefore means: the two integers are read from the live listing; no text of it is passed on. Unchanged: every other argument is a literal of its table or one of the listed computed values; all other forbidden marks stay forbidden everywhere (wildcard address, `::`, `udp`, `listen`, `@`, the other shell marks, the file filter, screen capture); every address is the loopback listener; the rule "no value read from the database reaches an argument" stands and is extended by name to the live listing; the macOS table shows 0 changed results. For the privileged alias helper (WP-19b), if the grant form chosen by row 103 is `sudo`: its arguments are literals plus one address that has passed the destination rule, and the helper enforces its own nine bounds whatever the caller (S13-08). Takes effect: with row 66 (WP-08); the last sentence with row 105 | controller | draft |

| Aspect | Content |
|---|---|
| Rule today | `CST:724-787`: formats exactly five `CST:745`; forbidden pattern holds the vertical bar among the shell marks `CST:746`; ten argument lists `CST:767`; origin rule over literals and computed values `CST:751` |
| Decision of the addendum | "amended narrowly: the format list gains `alsa`; the bar is admitted in exactly one argument made by one table function from an integer 0 to 63. Reason: U2 makes the tested `pan` text the default. `sudo` arguments are literals plus one validated address" (`masterplan/04_design_addendum.md:553`) |
| Sentence the security check requires in this text | AD-07 (2): "The helper's device argument is built by a table function from two integers (card index, device index). No descriptor string and no card id forms any part of an argument. The amendment of static rule G-R12 (addendum 8.3) says so in its text." (`verification/04_security_addendum.md:263`); correction of addendum 4.2 (blueprint line 646) |
| Why the sentence matters | A live listing is text the USB device chose; that is a worse origin than the database, and the kept rule did not see it (`verification/04_security_addendum.md:259`) |
| Packages named | WP-08 (rows 66, 67); WP-19b (row 105) for the last sentence |
| Check that shows it | row 66: "an integer outside 0 to 63 is refused; the macOS table's tests show 0 changed results"; row 67: "no value read from the database and no string of a live listing reaches an argument (static test)" (blueprint lines 189-190); requirement AD-07 traced to rows 66, 67, 155, 156 and to this row for the text (blueprint line 627) |
| Note for the writer | The count "ten argument lists" (`CST:767`) moves by delta with the Linux table's lists, in row 66's change set |

## 5. Closure lines (packages not built)

For the controller's log; each is one line and cites its ruling (plan phase 8, `masterplan/02_plan.md:435-437`, `:450-452`; blueprint 4.1, lines 92-94).

| Package | Closure line | Ruling |
|---|---|---|
| WP-16 | WP-16 (lossless track per microphone) is NOT PLANNED and nothing of it is built: the stored evidence form is the Core's, fMP4 with AAC mono; the audio is not lossless and the standby microphone is not stored; its nine stored-form parameters P-09, P-10, P-29, P-45, P-51, P-52, P-53, P-54, P-55 are recorded as "not carried"; a lossless track is decided separately later. | U12 A1 (`decisions/decisions.md:24`); parameters at `masterplan/01_specs.md:525` |
| WP-17 | WP-17 (several rooms per Core) is NOT PLANNED: one room per Core, as built; each room needs its own Core and its own audio interface; parameter P-32 is recorded as "not carried". | U12 A8 (`decisions/decisions.md:24`); `masterplan/01_specs.md:492`, `:526` |
| WP-18 | WP-18 (gain setting with its audit type, and the three columns of schema set D) is DEFERRED: no gain column, no gain audit type, no screen and no migration of set D are built in this task; gain and A/V offset are stored only together with their function; the pre-session level check is ported in WP-08. | U12 A10 with U11 on OQ-3 (`decisions/decisions.md:22`, `:24`); `masterplan/03_db_schema_extension.md:235`, `:441` |

## 6. Each draft against the extent the user accepted

U12 A6 accepts amendments of "D86 C-5, D82, D75, D80, D81, D76(3) ... as far as the camera/microphone openers and the network functions need" (`decisions/decisions.md:24`).

| Draft | Ruling of task 3 touched | Inside A6? | Wider than the register's column? |
|---|---|---|---|
| AM-2 | D82 | yes | no; narrower by AD-06 |
| AM-3 | D80(10) | yes, with A7 | no; narrower by S13-11, C10 |
| AM-4 | D75 | yes | no; narrower by U10, S13-08, S13-11 |
| AM-5 | D80(1) | yes | no |
| AM-6 | D80(10) | yes | no |
| AM-7 | D81, D80(7) | yes | no; the choice closed on the narrow side (a) |
| AM-8 | D76 (3) | yes | no |
| SR-1 to SR-4 | none: static rules of the code, not user rulings | decided by the addendum, adopted by C14, C15 | no; SR-4 narrower by AD-07 (2) |
| Closure lines | none | restate U12 A1, A8, A10, U11 | no |

Rules of addendum 8.3 that are KEPT and therefore get no row: G-R1; G-R2 with G-R10 for sockets (WP-06c); G-R13; G-R14. The `config.ts` hash and the `app.ts` unit list are "amended per package" by their single writers and need no decision row. Rule A-1 is rewritten at the lift only (row 88, text by row 87).

## 7. Findings and driver decisions (for the controller to confirm)

| # | Point | Evidence | Conservative reading taken here | Recommendation |
|---|---|---|---|---|
| 1 | **AM-7: the choice is already closed.** The register still shows it open. | `decisions/01_decision_register.md:149`, `:447` against C1, C7 (`decisions/decisions.md:28`, `:34`) | The draft records (a) and cites C1 and C7; it decides nothing | Adopt as drafted. Confidence HIGH |
| 2 | **AM-2: the register's wording alone would admit relay-reported text into a sealed code.** The security check corrected the design after the register was written. | `decisions/01_decision_register.md:428` against `verification/04_security_addendum.md:271`, `:278` | The draft keeps the register's sentence and adds AD-06 as its bound (C15: the check governs) | Adopt with the bound; without it rows 50 and 154 would contradict the decision row. Confidence HIGH |
| 3 | **AM-2: the clause on "never dials out" is conditional.** F-1 was ruled A after the register's version 1.0 text. | U12 A3; C11; blueprint 9.1 (lines 531-539) | Written as "not in effect; takes effect only in branch C at gate RC-1" | If row 8 selects branch C, the controller logs the clause then; no new draft is needed. Confidence HIGH |
| 4 | **SR-1 may be one or two entries short.** The addendum's list has three additions. The blueprint also creates a "command runner" under `capture/boot/` (row 80) and a "commissioning door, helper caller" under `capture/` (row 105); both hold the `static-capture` token, and a command runner or a helper caller starts a process. The addendum does not say whether they start it through the production door of row 21 or import the process module themselves. | `masterplan/04_design_addendum.md:549`; blueprint profile rows 80 and 105 (lines 370, 395); `CST:156`, `CST:220-221`; review `verification/03_plan_review.md:104` | SR-1 admits exactly three files. Rows 80 and 105 start processes through the production door of row 21 by injection; a row that cannot do so files one line in `file_requests.md` and the controller adds a decision row naming that one file | Decide before rows 80 and 105 launch (neither is in batch 1). The cheaper route is the production door: no further list entry, one place that starts production programs. Confidence MEDIUM: the two rows' designs were not written yet |
| 5 | **Row 103's first choice may collide with a kept rule.** The security review prefers a root-owned service reached over a local socket to `sudo -n`. A client of a local socket in the Core needs a socket module, and the addendum KEEPS "no socket module under `capture/`" (`CST:434` holds it for `net`, `tls`, `http2`). | `verification/02_security.md:208`; `masterplan/04_design_addendum.md:550`; `CST:432-434` | Nothing decided here; SR-4's last sentence is written to apply only "if the grant form chosen by row 103 is `sudo`" | Row 103 should state the effect of each form on G-R2 and G-R10: the socket form needs a fifth static-rule amendment (one pinned file, one local socket path); the `sudo` form needs none beyond SR-4. HYPOTHESIS, not verified: that no route to a local socket exists in Node without one of the three pinned modules. Confidence MEDIUM |
| 6 | **SR-3 (2): the export list of the connection file.** The addendum names WP-04 in "Hit by" for G-R10, G-R11 but its decision cell speaks of the second importer only. The review says WP-04 adds exports. | `masterplan/04_design_addendum.md:552`; `verification/03_plan_review.md:109`; `CST:425-426` | The exact export list may grow by the names row 26 adds; the five reads do not move | Adopt; it is a list pin that row 26 moves by delta. Confidence HIGH that the pin moves, MEDIUM on the number of names |

Three smaller observations, no decision needed:

- AM-4 names three calls that change a camera; the set-network file makes four, the fourth being the authenticated read `GetNetworkInterfaces` (`masterplan/01_specs.md:150`). SR-3 lists four; AM-4 keeps the register's three because only those change configuration.
- `masterplan/01_specs.md:403` mentions a DHCP form of `SetNetworkInterfaces` as input-av's behaviour; the blueprint's destination rule has "no DHCP mode" (line 218). The drafts follow the blueprint.
- `delegation_progress/file_claims.md` holds the line of row 2 twice (present before this row appended its own); harmless, for the controller's hygiene.

## 8. Alternatives considered

| Alternative | Why not taken |
|---|---|
| One combined decision row for all amendments | C4 already is that row. What the packages need is the exact wording per ruling, so that a gate can check one package against one row and a single amendment can be reverted alone |
| Drafting the register's sentences verbatim with nothing added | Two of them (AM-2, AM-7) would then be weaker or more open than what was ruled afterwards (points 1 and 2 of section 7) |
| Stating proposed file paths in SR-1 to SR-4 | The blueprint marks the files NEW or "executor declares"; a path written here would be invented. The role and the creating row identify each file without it |
| Widening SR-1 now to cover rows 80 and 105 | It would admit process importers the addendum did not decide; the narrower list fails loudly if a fourth file appears, which is what the pin is for |

## 9. Assumptions, gaps, what was not verified

- **Assumption:** the quotations of D75, D76, D80, D81, D82 in `research/02_collection_rulings.md` are exact; the task-3 decision file was not opened by this row (nor by the register).
- **Not verified:** the names of the four network calls as the `onvif` package spells them; `verification/01_verification.md:174` found them present, this row did not re-read the package.
- **Not verified:** that the pins named "moves by delta" in SR-2 and SR-4 are the only exact-string pins the code of rows 96 and 66 touches; the executors re-read `CST` before editing (driver rule 5).
- **Gap:** no draft exists here for AM-1 (row 87), for the privilege form of S13-09 (row 103), or for a fifth static-rule amendment if row 103 chooses the socket form (section 7, point 5).
- **Unproven on this Mac, by design:** everything these amendments permit against a real camera, a real interface or a real USB card is exercised on doubles only (ONVIF stub, helper double, fixture card listings); the real-device checks are in the hardware acceptance test package (`9A/H-05`, `H-06`, `H-08`, `H-14`, `H-17`).

## 10. Sources opened by this row

`delegation_progress/driver_rules.md`; `identification/03_implementation_blueprint.md` lines 61-126, 144-234 (rows named above), 285-476, 514-562, 577-648; `decisions/decisions.md` (all); `decisions/01_decision_register.md` lines 141-156, 419-449; `masterplan/04_design_addendum.md` lines 237-244, 440-480, 493-557; `verification/04_security_addendum.md` lines 34-52, 251-282; `verification/02_security.md` lines 192-208, 231; `verification/03_plan_review.md` lines 60, 93, 104-112; `research/02_collection_rulings.md` lines 53-84, 202-227; `masterplan/01_specs.md` lines 150, 403, 492, 525-527; `masterplan/02_plan.md` lines 435-456, 682; `masterplan/03_db_schema_extension.md` lines 235, 441. Code, read-only: `apps/core-server/src/capture/__tests__/static.test.ts` lines 60-76, 148-335, 362-440, 721-788.

---
*Generated: 2026-10-12 22:40*
*Last Updated: 2026-10-12 22:40*
