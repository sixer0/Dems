---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-13
agent: data-analyst
blueprint_row: 87
milestone: M6
package: WP-13c
type: decision and erratum texts (the four texts the class-C lift cites)
narrative_tier: 1
status: complete as texts; NOT in force - applied by row 88 after the preconditions of section 1.3 are ticked
confidence: MEDIUM (row 86 has not run; the kill matrix of row 59 has not run; nothing here was run or built)
closes_requirements: S13-17 (text half; the code half is row 88), AD-02 (4), condition L-1 (text half)
supersedes: the draft of this file of 2026-10-12 22:40 WIB (commit 7969f0fa), whose three slots are now settled or turned into preconditions
last_updated: 2026-10-13 15:59 WIB
---

# Row 87: the four texts the class-C lift cites

This row wrote this file and `delegation_progress/row_087.md`. It changed no source file, no specification file, not `decisions/decisions.md`, and nothing in the closed task-3 folder. Row 88 applies the texts; the controller records AM-1 (C4, `decisions/decisions.md:31`).

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `T4` = `docs/2026-10-12_input_av_core_adapter_plan`, `T3` = `docs/2026-10-07_dems_real_capture_sealing`, `CS` = `apps/core-server/src`. A decision id (U15, C60) is a row of `T4/decisions/decisions.md`; its line is given at first use.

## 0. Frame (5W1H), method, limits

| Question | Answer |
|---|---|
| **Subject (what)** | Four texts: (1) decision row AM-1, which amends task-3 ruling D86 C-5 for two adapter kinds; (2) the statement of the new guard for section H.5 of the evidence specification (S13-17), the word "declared" kept; (3) erratum E-A2 for the comment of the credential file; (4) the erratum to design addendum 1.6 #3 (AD-02 (4)). |
| **Why** | Entry condition L-1 of the lift: "the text of decision row AM-1 exists (row 87) and the controller has recorded it" (`T4/identification/03_implementation_blueprint.md:1082`). Row 88 depends on this row by contract (`:224`, `87:C`). S13-17 is a stage-1 gate item (`T4/verification/02_security.md:76,316`). AD-02 (4) orders the erratum of text 4 (`T4/verification/04_security_addendum.md:161`). |
| **Stakeholders (who)** | The user, whose word lifts the rule (U15, `decisions.md:69`). The controller, who records AM-1 (C4, `:31`). Row 86 (security review before the lift), which may change a rule these texts state. Row 88 (the lift), which applies them. Rows 91, 92, 137 (review, gate M6, final security review), which read them. A later reader of a sealed package, for whom text 2 says what the word "declared" means. |
| **When** | Written 2026-10-13 15:59 WIB at commit `0f5d2a8e` plus the uncommitted tree. Row 86 has not run: `T4/verification/086_pre_lift_security.md` does not exist (directory listing, this pass). The kill matrix of row 59 stands at 0 of 35 (`T4/test/059_worker_reverification.md:8`; C88, `decisions.md:124`). Texts 1 and 2 take effect with the commit of row 88, not before (C4: "each takes effect in the work package that needs it"). |
| **Scope (where)** | In: the four texts, their evidence, the preconditions of AM-1. Out: any edit of code or of a specification; stage 2 ("declared fit to record"); the withdrawal of any limit of the task-3 README or specifications (blueprint `:223`, `:1101`); the audit comment at `core/audit-details.ts:301`. The task-3 folder is closed and is not edited (C16 (4), `decisions.md:43`). |
| **How** | Reading only. Nothing was run, built, connected or started. No file under `apps/input-av/data/` and no `.env` was opened. |

**Read in this pass.** In full: the earlier draft of this file; `T4/masterplan/04_design_addendum.md` sections 1 (`:43-163`), 2 (`:166-257`), 6 (`:393-437`), 11 (`:688-704`); `T4/verification/04_security_addendum.md` sections 1, 2, 3.4, 3.5, 5, 8, 9; `T4/verification/02_security.md` section 4 (`:119-166`) and section 9 (`:301-316`); `T3/masterplan/06_evidence_package_spec.md:878-881,1129-1139`; `CS/capture/adapters/registry.ts:1-136`; `CS/capture/adapters/credential.ts:1-60`; `CS/capture/fence/sources.ts:78-132`; `CS/capture/adapters/camera/relay-start.ts:1-30`; `CS/db/migrations/0005_capture_privileges.sql:22-41`; blueprint rows 59, 85 to 92, 141 to 143, 148, 157 and section 9 (`:1066-1103`); decision rows U12, U13, U15 to U21, P10, C4, C9, C15, C16, C20, C27, C34, C36, C38, C39, C45, C46, C50, C51, C55, C56, C59, C60, C63, C65, C66, C70, C71, C76, C82, C85, C88, C89.
**Read in part** (frontmatter, statement, gate and "unproven" sections, not every line): `T4/implementation/143`, `143b`, `143c`, `144`, `145`, `085`, `085b`, `085c`, `085d`, `i09a_integration_pass.md`, `157`; `T4/test/033_selector_21_states.md`, `141_container_e11_relay_state.md`. Where a claim rests on such a record, the line cited was read.
**Not opened:** `T4/implementation/046`, `067`, `048` (one line), `058` (five lines), `179` (two lines), `188`, `200` (status lines only), `T4/test/044`, `059` (status lines only). Claims about them are taken from the decision row that adopted them and say so.

**Limits.** These are texts. No statement in them was proven by a run of this row. Where a text states what the code does after row 88, row 88 re-reads the code it lifts on and the text follows the code; a difference is reported to the controller, not silently reworded.

---

## 1. Text 1: decision row AM-1

### 1.1 The row, ready for `decisions/decisions.md`

Columns as that file has them (`# | Date | Decision | By | Status`). The number and the date are the controller's. The row is written only after every box of section 1.3 is ticked.

> | AM-1 | [date of the commit of row 88] | **AM-1 (amendment of task-3 ruling D86 C-5; STAGE 1 of the class-C lift, IN CODE).** D86 C-5 reads: "no listener and no session start for a source kind without an opener; no all-PRODUCTION package can be produced in this phase". **(1) What is lifted.** For the adapter kinds `ONVIF_RTSP` and `USB_AUDIO`, and for no other kind, an adapter may state an opener, and a session whose four slots resolved to adapters with an opener may start and may have its loopback ingest listener. Both kinds are lifted in one change set (row 88): the two kinds join the opener list, the two stubs are replaced by the built adapters, the boot calls the production registry builder. **(2) On whose word.** The user's: U15, "cabut aturan izin merekam", inside the two stages the user accepted in U12 A5 and the amendments accepted in U12 A6 (C4). Read by the controller as the release of stage 1 (P10 (1), confirmed by U17); the engineering conditions were not waived (P10 (2)). **(3) What stands in front of the two kinds from this commit.** (a) The fence is unchanged: a source of class `PRODUCTION` is assignable and recordable only under `REAL_PRODUCTION`, before and after the lift (C60); `boot.ts` and `operation.ts` of the fence are not edited. (b) New at registration: an adapter that states an opener is refused unless its source class is the class the running operation records (design addendum 1.4 #7). (c) The stored address of a production camera is held to the destination rule at every open, every presence and clock read and every connection test of an adopted camera, before the credential reader is called: loopback, unspecified, link-local, multicast, the host's own addresses and every address outside the configured camera subnet are refused, and with no stored network configuration every address is refused (AD-02; rows 143, 144; C55, C76). (d) Every connection to a stored camera leaves from the camera-interface address the rule names, at every re-open too (rows 143b, 143c; C65, C70). (e) The stored credential is revealed by one reader with a closed list of holders, one audit entry per reveal that carries the session, returned only after its commit; it reaches the relay in the start message on standard input and nowhere else (rows 144, 145). The relay answers a Digest challenge only (U17). (f) Branch B of E-11, final (C89): the worker goes on to the probe, the file and its connect report only after the path the client announced equals the plan's ingest address, which is new for every attempt and track (rows 58, 179). (g) A camera counts as open only when the report of its own relay and the worker's connect report arrive within 5,000 ms of each other; in `REAL_PRODUCTION` a session start without a relay report source is refused (row 48; C34). (h) A microphone is opened by the Core's own helper, which writes a pipe of mode 0600 in a directory of mode 0700; the card is matched by its stored serial, else its stored port (rows 67, 200; C56). No network listener exists for audio. **(4) What is NOT lifted.** The first clause of D86 C-5 stays for every other kind (`SNMP_POE` and any later kind) and for every adapter that states no opener. One session is never of two source classes. The read-back of the four source rows at session start stays. **(5) What this row does not say.** It does not say that any source is fit to record: that is stage 2, the user's ruling on the result of the hardware acceptance test package (U12 A5; U13; blueprint 9.2). It withdraws no limit of the task-3 README or specifications. From this commit the CODE can seal a package whose four sources read `PRODUCTION`; such a package is declared as production by the Core that sealed it and is not evidence of fitness. Agents record nothing from the real devices (U18); the automated full-session test seals from doubles in a temporary directory that is removed with the test (row 89). **(6) Residuals, accepted with the security review (`verification/02_security.md` 4.4; C27).** A process that runs as the Core's own service user can read the ingest address and feed a microphone pipe; that account already holds the database role, the credential store and the signing path. Recording through the worker's gate depends on the wording of one log line of the pinned library and fails closed. On a host that is not Linux the host profile is not asked (C66 (1); U21 (2)). **(7) Conditions.** Ticked by row 88 before this row was written: `decisions/087_lift_texts.md` section 1.3, with the evidence in `implementation/088_class_c_lift.md`. Texts cited by the lift: `decisions/087_lift_texts.md` | user (U15, within U12 A5 and A6); recorded by the controller (C4) | in force from the commit of row 88; reversible by reverting that commit |

Sources of the row, clause by clause:

| Clause | Source |
|---|---|
| D86 C-5, quoted | `T3/decisions/decisions.md:99` (row D86, item C-5), read in this pass; the same words in `T4/decisions/01_decision_register.md:427` |
| (1) kinds, "a listener may exist for a session whose four slots resolved to adapters with an opener" | the register's amendment, `01_decision_register.md:427`; C4 (`decisions.md:31`): "their exact wording is the register's" |
| (1) one change set, its content | blueprint row 88 (`03_implementation_blueprint.md:224`); design addendum 6.4 (`04_design_addendum.md:432,436` "lift both kinds together") |
| (2) | U15 (`decisions.md:69`); U12 A5, A6 (`:24`); C4 (`:31`); P10 (`:70`); U17 (`:72`: "P10 (1) is confirmed") |
| (3)(a) | C60 (`decisions.md:95`), which cites `registry.ts:132`, `fence/index.ts:298,321`, `fence/sources.ts:124-129`; blueprint exit condition 5 (`:1100`); `T4/test/033_selector_21_states.md:18` |
| (3)(b) | `04_design_addendum.md:100`; supported by the security check (`04_security_addendum.md:165`); today's rule `registry.ts:79-82` |
| (3)(c) | `T4/implementation/143_stored_address_rule.md:18-24,60-73`; `144_reader_holders.md:28-41`; `085b_production_composition.md:42`; `i09a_integration_pass.md:20` (item 1); C76 (`decisions.md:111`) |
| (3)(d) | `143b_source_address_bind.md:18-28`; `143c_watch_and_candidate_bind.md:16-23`; C65 (`:100`), C70 (`:105`) |
| (3)(e) | `144_reader_holders.md:43-52`; `145_reader_commit_session.md:27-48`; `CS/capture/adapters/camera/relay-start.ts:7-17`; `apps/capture-worker/src/relay/relay_rtsp.c:9-15`; U17 (`:72`) |
| (3)(f) | C27 (`decisions.md:54`); `T4/implementation/058_wp11b_path_compare.md:16`; C89 (`:125`); row 179 as adopted by C37 and C57 (record not opened beyond two lines) |
| (3)(g) | `T4/implementation/048_sa3_pairing.md:58` (`INGEST_PAIRING_BOUND_MS` 5,000); C34 (`decisions.md:61`); RC-3 (`02_security.md:157`) |
| (3)(h) | `CS/capture/adapters/local/mic-pipe.ts:6,36`; C56 (`decisions.md:90`); RC-6 (`02_security.md:160`) |
| (4) | `01_decision_register.md:427` ("The rule stays for every other kind"); `fence/sources.ts:124-129`; blueprint row 88's check "`SNMP_POE` with an opener" (`:224`) |
| (5) | U12 A5 (`:24`); U13 (`:25`); blueprint `:1101,1103`; U18 (`:73`); blueprint row 89 (`:225`); AD-08 (4) (`04_security_addendum.md:145`) |
| (6) | `02_security.md:164`; C27 (`:54`); C66 (1) (`:101`); U21 (2) (`:123`) |

### 1.2 Conditions already met at the time of drafting, each with its evidence

"Met" means: a record or a decision row says so, and that line was read. It does not mean row 86 has judged it. The blueprint says the same: "Whether each condition HOLDS is judged by row 86 and by gate 92, not by this list" (`:1092`).

| Condition (blueprint 9.2, `:1082-1090`) | State | Evidence |
|---|---|---|
| L-1, text half: the text of AM-1 exists | met | this file, section 1.1 |
| L-2, branch built: branch B (C27) with rows 47, 48, 179, 58, 175 to 178, 142 | met on this Mac's doubles | C88 (`decisions.md:124`): the worker series rc 0, `make e2e` 160 of 160 with the BR-09 cases (row 142: 17 of 17; row 178: 21 of 21), the row-58 gate 12 of 12 three times |
| L-2, the selection confirmed in the container (AD-01 (6), BR-10) | met; branch B is final | C89 (`:125`); `T4/test/141_container_e11_relay_state.md:20-25` |
| L-3: E-12 extended, 0 occurrences | met on doubles | C59 (`:93`): 42 runs, 0 occurrences, the search control found in 42 of 42 |
| L-4, worker half: E-1 and E-2 passed | met | C45 (`:79`). The sealing half is a check of row 89, inside the lift |
| L-5: both adapters exist and a real registry still refuses them; the builder exists and is not called by the boot | met on doubles | `085_production_registry_builder.md:72`; `085d_admit_device.md:51`; C55 (`:89`). The records of rows 46 and 67 exist and were not opened in this pass |
| AD-02 (1), (2): the stored-address rule is built; `src/` holds no permissive value | met on doubles | `143_stored_address_rule.md:60-73`; `144_reader_holders.md:28-41` |
| AD-08 (2), (3): the static rule of row 157 | met, with one provisional entry (SR-10, see P-3) | `157_no_test_seam_rule.md:8` |
| AD-04: gate M2 | passed with named open items | C50 (`:84`); `T4/gateway_check/036_m2_gate.md:12` |
| Condition 7: the relay client is ruled | met | U17 (`:72`) |
| Condition 8: a production session start without a relay report source is refused | met as built | C34 (`:61`); the superseded-report rule of row 188 is `needs-review` (`188_superseded_report_one_notice.md:7`) and is read by row 86 |
| Condition 9: the card identity is stored and matched | met on doubles, `needs-review` | C56 (`:90`); `200_adapter_card_match.md:7` (the stored session row does not hold the two facts yet) |
| The composition of the production dependency bundle; the three network-facts mounts | built, adopted | C60 (`:95`), C63 (`:98`), C70 (`:105`), C76 (`:111`) |

### 1.3 Preconditions NOT met at the time of drafting: the boxes row 88 ticks

None of these is a fact today. Row 88 ticks each with its evidence line in `implementation/088_class_c_lift.md`. A box that cannot be ticked stops the lift and goes to the controller.

- [ ] **P-1. The security review of row 86 has run and its verdict is not a FAIL**; every caution is routed to a row (blueprint `:222`; L-2, `:1083`). Not met: `verification/086_pre_lift_security.md` does not exist. If row 86 changes a rule that sections 1.1 or 2.2 state, the text is changed to follow it before AM-1 is recorded.
- [ ] **P-2. The kill matrix of row 59 reads 35 of 35**, run once inside the next full suite (run c06) by the suite runner (C88, `decisions.md:124`; blueprint `:195`). Not met: 0 of 35 (`test/059_worker_reverification.md:8`). C88 also rules that row 86 does not start before it, so P-2 comes before P-1.
- [ ] **P-3. The provisional static entries are confirmed or reversed by row 86**: SR-10 (`CREDENTIAL_STORE_USERS` gains `src/capture-composition.ts`, C76, `:111`) and SR-11 (the entry hands the host command runner to the composition, C82, `:117`; restated as built in C85, `:120`).
- [ ] **P-4. The items put to row 86 by name have an answer each**: review note N-01 on a simulator profile standing in for the stream's statement (C50, `:84`; C36, `:63`); the camera profile token that passes the CHECK (C61 (1), `:96`); re-identification of a card without re-enabling the input (C56, `:90`); the host profile not asked off Linux (C66 (1)(b), `:101`); the entry file pinned by text and not started by a test (C55, `:89`); the relay's static rule changed to "one pinned bind" (`143b_source_address_bind.md:9`); the library opening `/dev/urandom` (C89, `:125`); the fail-closed pairing, the superseded-report rule, the hardened client and the locator query rule (C34, C37, C39, C24; blueprint `:222`).
- [ ] **P-5. AM-1 is recorded in `decisions/decisions.md`** with its number and date (L-1, second half, `:1082`). The controller writes it (C4); an agent never writes that file (driver rules, "Record and report").
- [ ] **P-6. The three grants of text 4 are re-read on the tree the lift is made on** (`0005_capture_privileges.sql:24-28,35-37,39-40`; `0009_capture_sources_privileges.sql:21`), and no later migration changes them. At drafting, migrations up to `0027` exist and nine of them (`0019` to `0027`) are uncommitted (git status, this pass); nine migration files name `capture_devices` (`0004`, `0005`, `0008`, `0009`, `0010`, `0015`, `0021`, `0022`, `0023`); the only GRANT or REVOKE statements on that table among them are the ones cited (search for `GRANT` and `REVOKE` in those files, this pass).
- [ ] **P-7. The remainder of row 200 is closed or ruled**: the stored session row does not hold the card's two facts yet (`200_adapter_card_match.md:7`). Row 200 is a build dependency of row 88 (`:224`).
- [ ] **P-8. The controller has ruled on the Linux microphone defect of C89 (row 79b)** before both kinds are lifted together. C89 (`:125`): the pinned FFmpeg refuses the helper's argument list ("Option channels not found", 0 of 18; `CS/capture/adapters/local/mic-helper-args.ts:208`), "until then the production microphone path cannot start a helper on Linux". No record of row 79b exists at drafting. Row 79b is not an entry condition of blueprint 9.2; this box is a question, not a rule. If the lift goes first, clause (3)(h) of AM-1 gains the sentence "on Linux the helper cannot start until row 79b lands".
- [ ] **P-9. Row 88's own verification cell holds**: each of the 21 pin rows in its end state; the `REAL_DEVELOPMENT` suites show 0 changed results; refusals 2 of 2, `SNMP_POE` with an opener and `ONVIF_RTSP` with an opener in a development registry (`:224`).
- [ ] **P-10. U18 is still in force at the lift, or the user has changed it in words**: agents search and connection-test only; no recording, no change of a camera's address (`decisions.md:73`). Clause (5) of AM-1 quotes it.

Checked after the lift, not before it (gate 92, blueprint `:1094-1101`): the first full session on doubles (row 89), the session scenarios (row 90), the loopback production row answering 409 with 0 reveals and 0 relay starts (row 148, AD-02 (3)), the session-level security checks (row 151), the code review (row 91). AM-1 does not claim them.

---

## 2. Text 2: the statement of the new guard for section H.5 (S13-17)

**Target:** `T3/masterplan/06_evidence_package_spec.md`, section H.5 (`:1129-1139`), and the report line of section D.1 (`:880`). **The target is not edited**: the statement lives in this task folder (C16 (4), `decisions.md:43`). **Takes effect** with the commit of row 88. **Label:** proposed E-L1; the controller names it.

### 2.1 What H.5 says today (read, not changed)

H.5 already holds guard (4), written for the time before the lift (task-3 erratum PE-128-69): "Guard (4): **the Core itself opened the source** — no listener opens and no session starts for a source kind without an opener (D86 C-5)" (`06_evidence_package_spec.md:1136`). S13-17 asks that H.5 state "the guard 'the Core itself opened the source' and the case of the loopback ingest" at the lift, and that "the report line keeps the word 'declared'" (`T4/verification/02_security.md:316`). So the work at the lift is to state what guard (4) is once two kinds have an opener.

### 2.2 The statement

> **H.5, guard (4), from the commit of row 88 (decision AM-1): the Core itself opened the source.**
>
> **What the guard does.**
> 1. For every source kind without an opener nothing changes: no listener opens and no session starts.
> 2. For a camera of kind `ONVIF_RTSP`: the source of a video track is a relay process that the Core started for that slot. Before it starts the relay, the Core holds the address stored for that camera to its destination rule and refuses loopback, unspecified, link-local and multicast addresses, the host's own addresses, and every address outside the configured camera subnet. Only then is the stored credential revealed, with one audit entry that names the device and the session. The relay connects from the camera-interface address the rule names.
> 3. The case of the loopback ingest: the worker records a push only when the path the client announced equals the ingest address of the plan, which is new for every session attempt and every track. A camera counts as open only when the report of its own relay and the worker's connect report for that port arrive within 5,000 ms of each other. Otherwise the track ends as a capture fault with an audit entry, and nothing of it is sealed as that camera.
> 4. For a microphone of kind `USB_AUDIO`: the Core's own helper process opened the card it found by the stored serial, else the stored port, and writes a pipe of mode 0600 in a directory of mode 0700. No network listener exists for audio.
> 5. At registration an adapter that states an opener is refused unless its source class is the class the running operation records. At session start the four source rows are read back: exactly four, of one class, of the class of the operation.
>
> **What the guard does NOT do.**
> 1. It gives the verifier nothing new. The verifier still cannot tell a package whose manifest says `PRODUCTION` for every source from one that truly came from production devices. The class is a statement of the Core that sealed the package, covered by that Core's signature.
> 2. It does not stop a process that runs as the Core's own service user. Such a process can read the ingest address and can write into a microphone pipe, without the signing key and without a change of code or configuration. The control for that is the host profile, which is checked on the real host and not by the verifier; on a host that is not Linux the host profile is not asked.
> 3. It says which process fed the ingest and which stored address that process dialled. It does not say which device stands at that address: a device that answers there and accepts the stored credential is recorded as that camera.
> 4. It has been shown on doubles and in a container, not on a real camera or a real sound card.
>
> **The word "declared".** The report line of section D.1 stays character for character: "Sources: declared as production devices by the Core that sealed this package." A declaration is the sealing Core's own statement of which adapter kinds it opened. It is not proof that the devices were production devices, and it is not a finding that a source is fit to record. No package is declared fit to record by this guard; that is a separate ruling of the user on the result of the hardware acceptance tests (stage 2).

Sources, line by line:

| Statement | Source |
|---|---|
| does 1 | `06_evidence_package_spec.md:1136`; `01_decision_register.md:427`; `CS/capture/fence/sources.ts:105-107` ("No opener, no row") |
| does 2 | as AM-1 (3)(c), (d), (e): rows 143, 143b, 143c, 144, 145 with the lines cited in section 1.1 |
| does 3 | as AM-1 (3)(f), (g): C27, C89, `058_wp11b_path_compare.md:16`, `048_sa3_pairing.md:58`; RC-3 (`02_security.md:157`) |
| does 4 | as AM-1 (3)(h) |
| does 5 | `04_design_addendum.md:100`; `fence/sources.ts:118-130` |
| does not 1 | `06_evidence_package_spec.md:1133`, repeated on purpose |
| does not 2 | `02_security.md:143,147,164`; C27 (`decisions.md:54`); C66 (1) (`:101`); U21 (2) (`:123`) |
| does not 3 | **HYPOTHESIS of this row.** No review document states it in these words; it follows from what (2) checks (an address and a credential, no identity of the device). The nearest are SEC35-28 on forged probe answers (`T3/decisions/decisions.md:99`) and the fact that the stored address is untrusted (`143_stored_address_rule.md:18`). Row 86 confirms or strikes it (P-1) |
| does not 4 | every record cited is "on doubles" or "container" by its own status line (`143:9`, `143c:9`, `141:14`); the hardware items are listed by C89 (`:125`) |
| "declared" | `06_evidence_package_spec.md:880,1138`; `02_security.md:164,316`; blueprint `:1101,1103` |

### 2.3 The H.5 line "On this computer": a fact beside it, no withdrawal

H.5 says: "In this phase `developmentSources = false` cannot occur: no all-`PRODUCTION` package can be sealed (D86 C-5); check `M7-SEC-SRC-2`" (`06_evidence_package_spec.md:1139`). Stage 1 may withdraw no limit (blueprint `:1101`), so this line is not withdrawn. One fact is put beside it:

> From the commit of row 88 the code no longer makes `developmentSources = false` impossible. A package with that value is one that a `REAL_PRODUCTION` Core sealed from four sources of the two lifted kinds. Agents make such a package only in the automated full-session test, from doubles, in a temporary directory that is removed with the test (row 89); it is not evidence. Nothing is declared fit to record until stage 2.

Source: blueprint rows 88 and 89 (`:224-225`); AD-08 (4) (`04_security_addendum.md:145`); U18 (`decisions.md:73`).

---

## 3. Text 3: erratum E-A2 (the comment of the credential file)

**Label:** E-A2, the addendum's (`T4/masterplan/04_design_addendum.md:693`). **Applied by** row 88 ("the code-comment errata", blueprint `:224`), which re-reads the file first.

**Location:** `apps/core-server/src/capture/adapters/credential.ts:12-14` (working tree at `0f5d2a8e`; the file is unmodified against that commit).

**Original, verbatim:**

> As built, no process takes a credential: recording a real camera is class C-2. So `credentialAtInjection` has no caller in the product yet; a static test holds it to "this file and nothing else reads the two members of a credential".

**Corrected:**

> As built, one process takes a credential: the capture relay, in its start message on standard input. `credentialAtInjection` has exactly one caller in the product, `camera/relay-start.ts`; a static test holds it to that one file and to "this file and nothing else reads the two members of a credential".

Evidence that the corrected sentence is true of the tree: the one call at `CS/capture/adapters/camera/relay-start.ts:107`, stated at `:7-8`; the static rule at `CS/capture/adapters/__tests__/static.test.ts:128-144`.

**What E-A2 does not change.** Lines 5-10 of the same comment ("THE RULE ... Nothing in the Core composes the user-part form of a locator ...") stay word for word, and `T4/masterplan/01_specs.md:226` ("never URL, argument, environment or file") stays as written. The addendum planned E-A2 to name the relay as the one process that composes the user-part form (`04_design_addendum.md:240,693`). That exception was never built: by U17 the relay has its own RTSP client, in which "the account is never part of an address in this program" (`apps/capture-worker/src/relay/relay_core.c:181-182`; `relay.h:191`), and the relay's own record says the erratum is "not needed; `credential.ts:9-10` holds without exception" (`T4/implementation/041_relay_record_mode.md:51`). See contradiction X-1, section 6.

---

## 4. Text 4: erratum to design addendum 1.6 #3 (AD-02 (4))

**Label:** proposed E-A12 (the next free number after E-A11, `04_design_addendum.md:702`); the controller names it. **Target:** `T4/masterplan/04_design_addendum.md:143`, not edited by this row. Where the security check corrects the addendum, the check governs (C15, `decisions.md:42`).

**Location:** `T4/masterplan/04_design_addendum.md:143`, second sentence of item 3.

**Original, verbatim:**

> It can be written only by the database owner, which is what the test does and what a real installation's service user cannot do (`dems_app` has no UPDATE on `adapter_kind`, `CS/db/schema/capture.ts:53-57`).

**Corrected:**

> It can be written with the database credential of the runtime role `dems_app` alone, without the owner role and without the operating-system account of the Core, because that role holds three grants: INSERT on `capture_devices` at table level, where `adapter_kind` is written at INSERT and only its UPDATE is revoked; UPDATE on `capture_devices.address`; and UPDATE on the six selector columns of `capture_config`. The runtime role can therefore insert an `ONVIF_RTSP` row at a loopback address, or move an adopted camera's address there, and assign it; the design does not rely on the row, and holds the stored address to the destination rule at every use (AD-02 (1)).

Evidence for the three grants, read in this pass:

| Grant | Statement | File:line |
|---|---|---|
| INSERT, table level | `GRANT INSERT ON ... capture_devices, capture_device_credentials TO dems_app;` | `apps/core-server/src/db/migrations/0005_capture_privileges.sql:24-28` |
| only the UPDATE of `adapter_kind` is revoked | `REVOKE UPDATE (adapter_kind) ON capture_devices FROM dems_app;` | `0009_capture_sources_privileges.sql:21` |
| written at INSERT | "Written at INSERT and never updated - `dems_app` holds no UPDATE on it (`0009`)" | `apps/core-server/src/db/schema/capture.ts:138-141` |
| UPDATE on `address` | `GRANT UPDATE (transport, model, firmware, address, mac, onvif_uuid, profiles, poe_port, enabled, last_seen_at) ON capture_devices TO dems_app;` | `0005_capture_privileges.sql:39-40` |
| UPDATE on the six selector columns | `GRANT UPDATE (video_01_device_id, video_01_profile, video_02_device_id, video_02_profile, mic_primary_id, mic_standby_id, revision, updated_by, updated_at) ON capture_config TO dems_app;` | `0005_capture_privileges.sql:35-37` |
| no other grant on the table | nine migration files name `capture_devices`; a search of them for `GRANT` and `REVOKE` finds no statement on that table but the ones above | this pass; re-read at the lift (P-6) |

The consequence the security check draws ("whoever holds the runtime role's database credential can insert ... and assign it", `04_security_addendum.md:153`) and its remedy (AD-02 (1) to (3), `:157-160`) are the check's; the corrected sentence cites them and adds nothing.

---

## 5. Check of the verification cell: "four texts present; none withdraws a limit"

| Text | Present | Section |
|---|---|---|
| Decision row AM-1 | yes | 1.1 |
| The statement of the new guard for H.5 (S13-17), "declared" kept | yes | 2.2 |
| Erratum E-A2 for the credential comment | yes | 3 |
| Erratum to addendum 1.6 #3, the three grants | yes | 4 |

| Limit of the task-3 README or specification | Touched? | State |
|---|---|---|
| H.5: the verifier cannot tell a declared production package from a true one (`06:1133`) | repeated | kept |
| D.1: the report line with the word "declared" (`06:880`) | quoted | kept character for character |
| H.5 "On this computer": no all-`PRODUCTION` package can be sealed; check `M7-SEC-SRC-2` (`06:1139`) | a fact is put beside it | not withdrawn (finding F-2) |
| D86 C-5, first clause, for every other kind | restated | kept |
| The task-3 README | not touched | not withdrawn |

Occurrences of "fit to record" in the four texts as a statement that something is so: 0. Each occurrence is in a sentence that says nothing is declared so.

---

## 6. Sources that contradict another source

| # | Source A | Source B | What follows here |
|---|---|---|---|
| **X-1** | Design addendum 2.5 and section 11: E-A2 "names the relay as the one exception", "no process but the relay holds it" (`04_design_addendum.md:240,693`); "never URL" is "not achievable as written" (`:240`) | The relay as built by U17: "the account is never part of an address in this program" (`relay_core.c:181-182`); "not needed; `credential.ts:9-10` holds without exception" (`implementation/041_relay_record_mode.md:51`) | Text 3 corrects lines 12-14 only and leaves the rule and `01_specs.md:226` as written. The addendum's rows E-A2 and HA-7 are moot; the controller strikes or keeps them |
| **X-2** | Addendum 1.6 #3: a loopback production row "can be written only by the database owner" (`04_design_addendum.md:143`) | The security check and the migrations: three grants of the runtime role (`04_security_addendum.md:147-153`; `0005:24-28,35-37,39-40`; `0009:21`) | Text 4. C15 already rules that the check governs |
| **X-3** | The security check cites the grants at `0005_capture_privileges.sql:27-31` and `:38-39` (`04_security_addendum.md:149-150`) | The file as read: `:24-28` and `:39-40` | The statements are the same. Text 4 cites the lines read |
| **X-4** | S13-17: at the lift H.5 "gains the guard 'the Core itself opened the source'" (`02_security.md:316`) | H.5 already holds that guard since task-3 erratum PE-128-69 (`06_evidence_package_spec.md:1136`) | Text 2 states what the existing guard is after the lift. S13-17's check ("states the guard; the word 'declared' stays") is met by it |
| **X-5** | C66 (1): the host profile is left unasked off Linux "because the user's cameras are on this Mac (U16) and the user ordered the lift to record from them (U15)" (`decisions.md:101`); U21 (2): a production Core is allowed on this Mac (`:123`) | The production card listing exists on `linux` only (`CS/capture/fence/production-parts.ts:273,286`; C60, `:95`: "macOS: named `AUDIO_CARD_LISTING_NOT_AVAILABLE`"), and a session needs exactly four slots of one class (`fence/sources.ts:118-130`) | **HYPOTHESIS:** on this Mac a production microphone cannot be registered through the product, so no four-slot production session can be completed here after the lift. Not verified beyond the two lines cited; whether another path registers a microphone on macOS was not searched. Put to the controller; AM-1 claims no recording on this Mac |
| **X-6** | H.5 "On this computer": `developmentSources = false` "cannot occur" (`06:1139`); D86 C-5 second clause | Blueprint exit condition 2: one session from four production-kind sources is sealed (`:1097`), while exit condition 6 withdraws no limit (`:1101`) | Finding F-2: the limit is kept as a rule of use and the code fact is stated beside it (AM-1 (5); section 2.3) |
| **X-7** | Blueprint L-1: "the controller has recorded it in `decisions/decisions.md`" is an ENTRY condition of row 88 (`:1082`); C20: the texts "are adopted only when their three slots are filled" (`decisions.md:47`) | AM-1's status "in force from the commit of row 88", and this row's brief: "the lift row (88) applies the texts" | P-5 keeps the blueprint's order: the controller records AM-1 before row 88 commits; the row's status column carries the commit |
| **X-8** | Blueprint status table: row 87 "done, 7969f0fa" (`:682`); rows 44, 46, 67 held or in flight (`:660-675`) | Later records and decisions: C59 adopts row 44; records 046 and 067 exist; this row was re-issued on 2026-10-13 | The status table is older than the decision log. This file follows the decision log |

---

## 7. Rationale, alternatives, findings

### 7.1 Why the texts are worded this way (evidence chain)

1. **The lift is the user's, the wording is the register's.** U15 releases it; C4 fixes the wording of AM-1 to `01_decision_register.md:427`. So clause (1) of AM-1 is the register's sentence, and the "By" column names the user.
2. **A decision that lifts a protection names what replaces it.** The security review rated AM-1 CAUTION because "the replacement is unproven until RC-1" (`02_security.md:305`). Clause (3) therefore lists what stands in front of the adapters as built, each with its row, and section 1.2 separates "a record says so" from "row 86 judged it".
3. **Unmet conditions are boxes, not sentences.** Row 86 and the kill matrix have not run. Writing them as facts would make AM-1 false on the day it is recorded if either fails. Section 1.3 is the list row 88 ticks; clause (7) of AM-1 points at it.
4. **"Declared" carries the limit.** The accepted residual (a process as the Core's own user) is why the report line keeps the word (`02_security.md:164`). Text 2 says what a declaration is not, so that the lift cannot be read as a fitness statement.
5. **An erratum is a quotation and a correction.** Texts 3 and 4 give the location, the original sentence and the corrected sentence. The evidence sits beside them, outside the corrected text.

### 7.2 Alternatives considered

| Alternative | Not taken because |
|---|---|
| Write AM-1 with rows 86 and 59 as facts ("the security review is not a FAIL") | they have not run; a claim without evidence (global rule 4; brief) |
| Keep the earlier draft's four branch texts for E-11 | branch B is final (C89); three of the four would never apply |
| Write E-A2 as the addendum planned it (the relay is the one exception) | false of the code since U17 (X-1) |
| Say nothing about the code being able to seal an all-`PRODUCTION` package until stage 2 | the decision log and H.5 would contradict the code between stage 1 and stage 2 (X-6) |
| Edit H.5 in the task-3 folder | the folder is closed (C16 (4)) |
| Leave "which device stands at the address" out of text 2 | it is the cautious direction; it is marked as a hypothesis for row 86 instead |

### 7.3 Findings for the controller

| # | Finding | Evidence | What it changes |
|---|---|---|---|
| F-1 | E-A2's planned content is moot; only the stale lines 12-14 of the comment need correcting | X-1 | text 3 |
| F-2 | After row 88 two task-3 sentences are untrue of the code while no limit may be withdrawn. With U21 (2) a person could also seal such a package on this Mac outside a test, if four production sources can be assigned there (see X-5); check `M7-SEC-SRC-2` reads "every package sealed on this Mac in this phase has `developmentSources = true`" (`06:1139`) | X-6; U21 (2) | AM-1 (5) and section 2.3 state the fact. Whether `M7-SEC-SRC-2` still runs over a data directory that such a package can enter is a question for row 86 or gate 92 |
| F-3 | The lift takes both kinds together, but on Linux the microphone helper cannot start until row 79b, and on macOS the card listing is not available | C89; X-5 | P-8; possibly one more sentence in AM-1 (3)(h) |
| F-4 | The statement for H.5 lives only in this task folder; a reader of the closed task-3 specification finds no pointer to it | C16 (4) | the task-4 README and final report should index it beside the specification's path |
| F-5 | P10 (2) and (3) are the controller's reading of U15; only P10 (1) was confirmed in words (U17) | `decisions.md:70,72` | assumption A-1 |

---

## 8. Assumptions, gaps, driver decisions

**Assumptions.**
- A-1. U15 releases stage 1 and leaves stage 2 as U12 A5 and U13 ruled it. This is P10 (3), which the user was asked and did not answer in words; U18 (no recording by agents) is consistent with it.
- A-2. The records read in part are accurate in the lines not read, and the decision rows report their records correctly.
- A-3. The numbers quoted (5,000 ms; modes 0600 and 0700; the refused address classes) are those of the tree at drafting. If row 86 or row 88 finds another value, the text follows the code.

**Gaps.**
- Row 86 has not run; the kill matrix has not run; row 79b has no record. Each is a box of section 1.3.
- The size of the random element of the ingest address as built was not read. RC-2 requires at least 128 bits (`02_security.md:156`); the texts say "new for every attempt and track" and state no size.
- The records of rows 46, 67, 188, 200, 44 and 59 were not read beyond the lines cited.
- The task-3 README was not opened: this row withdraws none of its limits and needed none of its lines.
- Graft was not queried: a documents-only row with every symbol located by a direct read.

**Driver decisions (conservative; for the controller to confirm).**

| # | Decision | Alternative not taken |
|---|---|---|
| D-1 | AM-1's "By" column names the user (U15) with the controller as recorder; the earlier draft named the controller on U12 | the earlier wording, which predates U15 |
| D-2 | E-A2 is narrowed to lines 12-14 of the comment (X-1) | the addendum's wider erratum |
| D-3 | "does not 3" of text 2 is kept and marked as a hypothesis for row 86 | leaving it out |
| D-4 | P-8 (row 79b) is put as a question for the controller, not as an entry condition | adding it to blueprint 9.2, which is not this row's to edit |
| D-5 | The labels E-L1 and E-A12 are proposals; E-A2 is the addendum's own | task-3 style `PE-nn-nn` numbers, which belong to the closed task |
| D-6 | The earlier draft's annex on the audit comment (`audit-details.ts:301`) is dropped: it is not one of the four texts and was not re-verified | carrying it unverified |

**What stays unproven and goes to the hardware package.** Nothing of this row: it is text. What the guard describes is proven on doubles and in a container; on a real host by `9A/H-01` and the items C89 lists.

---
*Generated: 2026-10-12 22:40 WIB (first draft)*
*Last Updated: 2026-10-13 15:59 WIB (rewritten for U15, U17, C89; slots replaced by preconditions)*
