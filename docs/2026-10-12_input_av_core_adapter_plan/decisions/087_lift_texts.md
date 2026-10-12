---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-12
agent: data-analyst
blueprint_row: 87
milestone: M6
package: WP-13c
type: decision and erratum DRAFTS (the texts the class-C lift cites)
narrative_tier: 1
status: draft - complete as a draft; adopted by the controller, not by this row
confidence: MEDIUM (three slots depend on results that do not exist yet: rows 8, 86, 141)
closes_requirements: S13-17 (text half; the code half is row 88), AD-02 (4)
last_updated: 2026-10-12 22:40 WIB
---

# Row 87: the four texts the class-C lift cites (drafts)

**These are drafts.** This row did not write `decisions/decisions.md`, did not edit `masterplan/04_design_addendum.md`, `masterplan/01_specs.md` or any source file, and did not open the closed task-3 folder for writing. The controller adopts each text, or changes it.

## 0. Frame (5W1H), method, limits

| Question | Answer |
|---|---|
| **What** | Four texts: (1) decision row AM-1, which amends task-3 ruling D86 C-5; (2) an ERRATUM DRAFT for section H.5 of the evidence specification, stating the guard as it stands after the lift (S13-17), the word "declared" kept; (3) erratum E-A2 for the credential rule and its code comment; (4) the erratum to design addendum 1.6 #3 (AD-02 (4)). |
| **Why** | Condition L-1 of the lift: "the text of decision row AM-1 exists (row 87) and the controller has recorded it" (`identification/03_implementation_blueprint.md:545`). Row 88 cites these texts in its change set (`:211`, dependency `87:C`). S13-17 is a stage-1 gate item (`verification/02_security.md:76,316`). |
| **Who** | Drafted by data-analyst. Adopted by the controller (U12 B2; C4 at `decisions/decisions.md:31`). The ruling behind AM-1 is the user's (U12 A5, A6, `decisions/decisions.md:24`). Readers: row 88 (the lift), row 92 (gate M6), row 137 (final security review). |
| **When** | Drafted 2026-10-12 22:40 WIB, before rows 8, 86, 88 and 141 have run. Texts 1 and 2 take effect with the change set of row 88, not before (C4: "each takes effect in the work package that needs it"). |
| **Where** | This file. The task-3 folder `docs/2026-10-07_dems_real_capture_sealing/` is closed and read-only: nothing in it was edited (C16 (4), `decisions/decisions.md:43`). |
| **How** | Reading only. Read: the driver rules; `decisions/decisions.md`; `decisions/01_decision_register.md:286-299,419-429`; `masterplan/04_design_addendum.md` sections 1.6, 2, 6, 9, 11; `masterplan/01_specs.md:226,245-252,254-282,306-312`; `verification/02_security.md` sections 2, 4, 5, 8, 9; `verification/04_security_addendum.md` in full; the blueprint sections 6, 7, 9 and the rows named below. Read-only in the repository: the task-3 evidence specification (`masterplan/06_evidence_package_spec.md:872-884,1129-1141`), task-3 `decisions/decisions.md:99`, task-3 `masterplan/09_security_design_review.md:638`, task-3 `masterplan/05_capture_architecture_spec.md:227`; `apps/core-server/src/capture/adapters/credential.ts:1-25`, `registry.ts:26-38`, `capture/fence/sources.ts:80-130`, `db/migrations/0005_capture_privileges.sql:20-45`, `0009_capture_sources_privileges.sql:1-27`, a name search of migrations `0010` to `0014`, `db/schema/capture.ts:50-58`, `core/audit-details.ts:298-305`. Nothing was run, built or connected. Nothing under `apps/input-av/data/` and no `.env` was opened. Graft was not queried (docs-only row). |

**Limits.** Three results these texts refer to do not exist yet. Each is a marked slot, `[SLOT-n]`, which the controller fills at adoption:

| Slot | What it holds | Comes from |
|---|---|---|
| `[SLOT-1]` | The branch E-11 selected (A; A with the second-connect rule; B; C) | row 8 (gate RC-1), confirmed by row 141 |
| `[SLOT-2]` | The verdict and path of the security review before the lift | row 86, `verification/086_pre_lift_security.md` |
| `[SLOT-3]` | The decision number and date in `decisions/decisions.md` | the controller |

A text with an unfilled slot is not adoptable. If row 86 changes a rule these texts state (the 5,000 ms pairing bound, the address classes refused, the residual), the text follows row 86.

---

## 1. Text 1: decision row AM-1

### 1.1 The row, ready for `decisions/decisions.md`

Columns as that file has them (`# | Date | Decision | By | Status`).

> | `[SLOT-3]` | `[SLOT-3]` | **AM-1 (controller, on U12 A5 and A6; condition L-1 of the class-C lift; STAGE 1, IN CODE ONLY).** Amends task-3 ruling D86 C-5, which reads: "no listener and no session start for a source kind without an opener; no all-PRODUCTION package can be produced in this phase". **(1) What is lifted.** For the adapter kinds `ONVIF_RTSP` and `USB_AUDIO`, and for no other kind, an adapter may state an opener. A session may start, `[SLOT-1: in branches A and B add "and the worker's loopback ingest listener may exist,"]` only when all four slots resolved to adapters with an opener (measure SA-1, `capture/fence/sources.ts`, the line "No opener, no row", unchanged by the lift). Both kinds are lifted in one change set (row 88); neither alone. **(2) What stands in the place of the lifted protection.** (a) `[SLOT-1: the branch text of section 1.2]`. (b) Measure SA-3: a camera counts as open only when the report of its own relay and the worker's connect report for that port arrive within 5,000 ms of each other, in either order; one without the other is a capture fault with an audit entry, and nothing of that track is sealed as that camera. (c) The stored address of a production camera is held to the destination rule at every open, every connection test of an adopted camera and every presence read, before the credential is revealed: loopback, unspecified, link-local, multicast and the host's own addresses are refused (AD-02). (d) An adapter that states an opener is refused at registration unless its source class is the class the running operation records (addendum 1.4 #7). (e) A microphone is opened by the Core's own helper process, which writes a pipe of mode 0600 in a run directory of mode 0700; no network listener exists for audio. **(3) What is NOT lifted.** The first clause of D86 C-5 stays in force for every other kind (`SNMP_POE` and any later kind) and for every adapter that states no opener. The fence files `boot.ts` and `operation.ts` are not edited. One session is never of two source classes. The read-back of the four source rows at session start stays. A production-kind adapter with an opener is refused in a development registry. **(4) The second clause.** "No all-PRODUCTION package can be produced in this phase" ends, with row 88's change set, as a property of the CODE: the code can then seal a package whose four sources read `PRODUCTION`. It does not end as a RULE OF USE. Nothing is declared fit to record. No limit of the task-3 README or of the task-3 specifications is withdrawn by this row. Until stage 2 the only such packages are the ones the automated full-session test seals from doubles in a temporary directory, which is removed with the test (row 89); they are not evidence. Stage 2 ("declared fit to record") is a separate ruling of the user on the result record of the hardware acceptance test package, with S13-03 and S13-15 as its conditions (U13; blueprint 9.2). **(5) Conditions met.** L-2: the selected branch is built, its checks pass, the selection is confirmed in the Ubuntu 24.04 container (row 141), and the security review before the lift is not a FAIL (`[SLOT-2]`). L-3: E-12 extended, 0 occurrences (row 44). L-4: E-1 and E-2 passed for the worker; the sealing half is a check of row 89. L-5: both adapters pass T-1 to T-3 (rows 46, 67) and the registry builder exists (row 85). AD-02 (rows 143, 144), AD-08 (row 157), AD-04 (gate M2). **(6) Residual, accepted with the security review (`verification/02_security.md` 4.4).** A process that runs as the Core's own service user can read the plan and defeat SA-2, and can feed a microphone pipe. That account already holds the database role, the credential store and the signing path. The report line of an all-`PRODUCTION` package therefore keeps the word "declared". Wording of the amendment: `decisions/01_decision_register.md`, entry AM-1. Texts cited by the lift: `decisions/087_lift_texts.md` | controller, on U12 A5, A6 (C4) | in force from the commit of row 88; reversible by reverting that commit |

### 1.2 The branch text for `[SLOT-1]`, one per outcome of E-11

Source of the four outcomes: blueprint 9.1 (`identification/03_implementation_blueprint.md:531-539`).

| Branch | Text for (2)(a) |
|---|---|
| **A** | "Measure SA-2: the ingest address of each camera track carries a random element of 128 bits from the system's random source, new for every session attempt and every track, held in the plan frame and in the relay's start message and nowhere else (RC-2). The pinned library refuses a push addressed to any other path: observed with a paired control and seven near-miss paths (row 8), repeated on the Ubuntu 24.04 build (row 141), and kept as a permanent test of the worker's suite (row 142)." |
| **A with the second-connect rule** | The text of A, plus: "A second connect report on a port is a capture fault that ends the capture (row 48); this is the rule for the case in which a second client on the right path was accepted (E-11, O-2)." |
| **B** | "Measure SA-2: the random element as in RC-2. The worker compares the path the client announced with the plan's, before it probes the stream and before it reports a connection (row 58); the worker's series was run again after that change (row 59); the near-miss test is permanent (row 142)." |
| **C** | "No listener exists: the worker dials the camera itself (the fallback ruled in U12 A3). RC-1 to RC-5 fall away; what the pulling worker keeps of RC-6 is stated by AD-14." In branch C clause (1) reads "A session may start" without the listener words, and the rows after row 9 are refined, so this row's text is re-read against the refined blueprint before it is adopted. |

### 1.3 Why the row is worded this way

| Choice | Reason | Source |
|---|---|---|
| The amendment's core sentence is the register's | C4 rules that "their exact wording is the register's". Register AM-1: "For `ONVIF_RTSP` and `USB_AUDIO`: an opener may be stated and a listener may exist for a session whose four slots resolved to adapters with an opener. The rule stays for every other kind" | `decisions/decisions.md:31`; `decisions/01_decision_register.md:427` |
| "By: controller, on U12 A5, A6" | The user accepted the amendment and the two stages; "the amending decision rows themselves ... the controller writes at the time each line names (AM-1 at the lift)" | `decisions/01_decision_register.md:421`; `decisions/decisions.md:24` |
| Clause (4) splits D86 C-5's second clause into "property of the code" and "rule of use" | D86 C-5 has two clauses. The register's amendment speaks to the first only. After row 88 the second is no longer true of the code (row 89 seals such a package), yet stage 1 may withdraw no limit (blueprint 9.2, exit condition 6). Saying nothing would leave a decision file that contradicts the code. See finding F-2, section 6 | `identification/03_implementation_blueprint.md:555,559` |
| The residual is in the row | The review accepted variant A "with this ACCEPT" and that residual; a decision that lifts a protection names what is left | `verification/02_security.md` 4.4 |
| Reversible | The lift is one change set and one commit (C9 by analogy; blueprint section 5 "every other milestone is one commit that reverts alone") | `identification/03_implementation_blueprint.md:105` |

---

## 2. Text 2: ERRATUM DRAFT for section H.5 of the evidence specification (S13-17)

**Proposed label: E-L1** (lift erratum 1; the label is this row's proposal, the controller names it). **Target:** `docs/2026-10-07_dems_real_capture_sealing/masterplan/06_evidence_package_spec.md`, section H.5 (`:1129-1141`) and the report line of section D.1 (`:880`). **The target is not edited.** The erratum lives in this task folder, as task 3 kept its own errata beside its documents (blueprint section 13, decision 4; C16 (4)). **Takes effect** with the change set of row 88.

### 2.1 What H.5 says today (read, not changed)

H.5 has seven lines. Guard (4) is already there, in the form valid before the lift (task-3 erratum PE-128-69):

> "The worker's loopback ingest is unauthenticated; in `REAL_PRODUCTION` a local process could push into an open listener and be signed as `PRODUCTION` (SEC35-40). Guard (4): **the Core itself opened the source** — no listener opens and no session starts for a source kind without an opener (D86 C-5)" (`06_evidence_package_spec.md:1136`)

So S13-17 ("H.5 gains the guard 'the Core itself opened the source' and the case of the loopback ingest") is, at the lift, a RESTATEMENT of a guard that exists: its present wording is true only while no production kind has an opener. See finding F-1.

### 2.2 The erratum, line by line

| H.5 line | Was | Is, from the change set of row 88 |
|---|---|---|
| The limit, plainly (`:1133`) | The verifier cannot tell a package whose manifest says `PRODUCTION` for every source from one that truly came from production devices | **Unchanged, and repeated here on purpose.** The lift gives the verifier nothing new. The class is still a statement of the sealing Core under its signature |
| What guards it, guards (1) to (3) (`:1134`) | The boot fence; the class written from the adapter kind; the signature | **Unchanged** |
| Guard (4), the case of the loopback ingest (`:1136`) | "the Core itself opened the source — no listener opens and no session starts for a source kind without an opener (D86 C-5)" | **Guard (4): the Core itself opened the source.** (4a) For every kind without an opener, the rule is unchanged: no listener, no session start. (4b) For `ONVIF_RTSP` (decision AM-1): the source of a camera track is a relay process that the Core started for that slot. The relay dials the address stored for that camera; the Core holds that address to its destination rule at every open (not loopback, not unspecified, not link-local, not multicast, not an address of the host itself) and reveals the stored credential only after that, with one audit entry per reveal. `[SLOT-1: the loopback-ingest sentence of section 2.3]` A camera counts as open only when the report of its own relay and the worker's connect report for that port arrive within 5,000 ms of each other; otherwise the track ends as a capture fault and nothing of it is sealed as that camera. (4c) For `USB_AUDIO` (decision AM-1): the Core's own helper process opened the card and writes a pipe of mode 0600 in a run directory of mode 0700; no network listener exists for audio. (4d) An adapter that states an opener is refused at registration unless its source class is the class the running operation records, and the session start reads back the four source rows it wrote |
| What does not guard it (`:1135`) | A person who can change the Core's code or configuration and holds its signing key | **Kept, and one case added.** Guard (4) stops a process of ANOTHER local account. It does not stop a process that runs as the Core's own service user: such a process can read the plan frame and the run directory, so it can push on the right ingest path and can write into a microphone pipe, without the signing key and without a change of code or configuration. That account already holds the database role, the credential store and the signing path; the control is the host profile (a single-purpose host, no other interactive account, a private run directory, the loopback firewall rule), which is checked on the real host and not by the verifier. Guard (4) also says which PROCESS fed the ingest, not which DEVICE stands at the camera's stored address: a device that answers there and accepts the stored credential is recorded as that camera `[to be confirmed or struck by row 86; see D-3]` |
| Defined with the fence (`:1137`) | A production configuration has at least one assigned device of source class `PRODUCTION`, or a listener outside loopback | **Unchanged** |
| Consequence for wording (`:1138`) | A report or a client never states "recorded from production devices" as a verified fact; it states "declared as production devices by the Core that sealed this package" | **Unchanged. The word "declared" stays.** The report line of section D.1 (`:880`) stays character for character: "Sources: declared as production devices by the Core that sealed this package." |
| On this computer (`:1139`) | "In this phase `developmentSources = false` cannot occur: no all-`PRODUCTION` package can be sealed (D86 C-5); check `M7-SEC-SRC-2`" | **Not withdrawn (stage 2).** One statement of fact is put beside it: from the change set of row 88 the code no longer makes `developmentSources = false` impossible. On the development computer the only packages with that value are the ones the automated full-session test seals from doubles in a temporary directory that is removed with the test; they are not evidence and none leaves that directory. Every package in a data directory of the development computer still has `developmentSources = true`, which is what check `M7-SEC-SRC-2` holds. No package is declared fit to record until stage 2. See finding F-2 |

### 2.3 The loopback-ingest sentence for `[SLOT-1]` in line (4b)

| Branch | Sentence |
|---|---|
| A | "The worker's loopback listener for that track accepts a push only on an ingest path that carries a 128-bit random element, new for every session attempt and track and known to the Core, the worker and that one relay only." |
| A with the second-connect rule | The sentence of A, plus: "A second connection on a port ends the capture as a fault." |
| B | The sentence of A, with "the worker compares the announced path before it probes the stream" in place of "accepts a push only on". |
| C | "No loopback listener exists: the recording process dials the camera itself." Line (4b)'s pairing sentence is then replaced by what the refined blueprint builds. |

### 2.4 What this erratum does not do

It does not say that a package is fit to record, does not change manifest fields 124 to 126, check V-15 or any verify result, and does not touch the report line. It does not edit H.5's line "On this computer", the sentence "in this phase nothing is recordable in `REAL_PRODUCTION`" of the capture architecture specification (`05_capture_architecture_spec.md:227`), or the task-3 README. Those are stage 2.

---

## 3. Text 3: erratum E-A2 (the credential rule and its code comment)

**Label: E-A2**, as the addendum names it (`masterplan/04_design_addendum.md:693`). Two places. Neither is edited by this row; the first is superseded without editing (addendum section 11), the second is edited by row 88 ("the code-comment errata").

### 3.1 The specification line

| Place | Was | Is |
|---|---|---|
| `masterplan/01_specs.md:226`, column "Default in the port" | "start message on standard input; never URL, argument, environment or file" | "start message on standard input; never an argument, the environment or a file. Never a URL in the Core: no process but the relay ever holds a locator with a user part, and the Core composes none. The relay composes that form in its own memory, percent-encoding both values, because the pinned RTSP client takes an account in no other form" |

Reason: "never URL" is "not achievable as written: the pinned RTSP client takes an account only as the user part of its URL" (`masterplan/04_design_addendum.md:240`).

### 3.2 The code comment of `apps/core-server/src/capture/adapters/credential.ts`

The comment was read in the working tree at 22:27 WIB. It already differs from the baseline: row 147 added the paragraph on `startMessageBytes` (lines 16-18). Row 88 re-reads the file before it edits; line numbers below are of that reading.

| Lines | Was | Is, at the lift |
|---|---|---|
| 5-10, "THE RULE" | "... Nothing in the Core composes the user-part form of a locator, and the injection result itself keeps the two apart, as §A.6.3 rules." | **Kept word for word.** It stays true: the relay is not a file of the Core, and rule A-2 holds for every file of the Core |
| 12-14 | "As built, no process takes a credential: recording a real camera is class C-2. So `credentialAtInjection` has no caller in the product yet; a static test holds it to "this file and nothing else reads the two members of a credential"." | Replaced by the paragraph below |

Proposed paragraph (file names are the addendum's proposed names, `masterplan/04_design_addendum.md:200-204`; row 88 writes the names as built):

```
 * THE ONE EXCEPTION, AND IT IS OUTSIDE THE CORE (design addendum 2.5, erratum E-A2; decision
 * AM-1). The relay (`apps/capture-worker/src/capture_relay.c`) is the one process that ever holds
 * a locator with a user part: the pinned RTSP client takes an account in no other form. The relay
 * composes it in its own memory from the start message, percent-encoding both values; it never
 * prints it, stores it or passes it on, and it answers a Digest challenge only. The Core composes
 * none.
 *
 * `credentialAtInjection` has exactly ONE caller in the product: the file that starts the relay
 * (`camera/relay-start.ts`). A static test holds it to that one file, and holds "this file and
 * nothing else reads the two members of a credential".
```

The paragraph says what the code does. It does not say that a real camera is recorded or that anything is fit to record.

### 3.3 Annex, not one of the four texts: the audit comment

The addendum also says "the comment 'the supervisor reveal path' (`audit-details.ts:301`) gets an erratum" (`masterplan/04_design_addendum.md:219`). Read at `apps/core-server/src/core/audit-details.ts:301`: "SEC35-02: the supervisor reveal path writes the fact only." Proposed for the row that changes that vocabulary (row 19 or 144, whichever owns the line; it is not row 87's or row 88's to decide): "SEC35-02: a reveal writes the fact only. The reason is one of a closed set, fixed per holder of the reader; a reveal for a session carries the session in the row's session column (security addendum AD-03 (1), (3))."

---

## 4. Text 4: erratum to design addendum 1.6 #3 (AD-02 (4))

**Proposed label: E-A12** (the next free number after E-A11 of addendum section 11; this row's proposal). **Target:** `masterplan/04_design_addendum.md:143`, not edited by this row. Where the security check corrects the addendum, the check governs (C15, `decisions/decisions.md:42`).

**Was** (`masterplan/04_design_addendum.md:143`):

> "3. A production row with a loopback address cannot come out of any product path: adoption refuses it (`service.ts:266-268`), and the two new writers of a camera address (WP-12, WP-22) refuse loopback by the target rule of S13-11. It can be written only by the database owner, which is what the test does and what a real installation's service user cannot do (`dems_app` has no UPDATE on `adapter_kind`, `CS/db/schema/capture.ts:53-57`)."

**Is:**

> "3. A production row with a loopback address does not come out of any product OPERATION: adoption refuses it, and the two new writers of a camera address (WP-12, WP-22) refuse loopback by the destination rule of S13-11. **It can be written with the runtime role's database credential alone**, without the owner role and without the operating-system account of the Core, because the runtime role `dems_app` holds three grants:
> (i) INSERT on `capture_devices` at table level, and `adapter_kind` is written at INSERT; only its UPDATE is revoked;
> (ii) UPDATE on `capture_devices.address`;
> (iii) UPDATE on the six selector columns of `capture_config`.
> Whoever holds that credential can therefore insert an `ONVIF_RTSP` row at `127.0.0.1`, or move an adopted camera's address there, and assign it. The fence classes by adapter kind, so such a selector is "all production". **The design therefore does not rely on the row.** The production camera adapter holds the STORED address to the destination rule at every open, every connection test of an adopted camera and every presence read, before the credential reader is called; loopback, unspecified, link-local, multicast and the host's own addresses are refused by a named code, with no reveal (AD-02 (1); rows 95, 143, 144). The permissive rule the full-session test needs is a value defined under `apps/core-server/test/` and handed in through the builder's dependencies; `src/` holds none (AD-02 (2); row 85). Check: an assigned `ONVIF_RTSP` row at `127.0.0.1` on a Core built without the test value gives session start 409, 0 reveal entries, 0 relay starts (AD-02 (3); row 148)."

**Evidence for the three grants, read by this row:**

| Grant | Statement | File:line (as read 2026-10-12 22:27 WIB) |
|---|---|---|
| (i) INSERT | `GRANT INSERT ON ... capture_devices, capture_device_credentials TO dems_app;` | `apps/core-server/src/db/migrations/0005_capture_privileges.sql:24-28` |
| (i) only UPDATE revoked | `REVOKE UPDATE (adapter_kind) ON capture_devices FROM dems_app;` | `0009_capture_sources_privileges.sql:21` |
| (i) written at INSERT | "Written at INSERT and never updated - `dems_app` holds no UPDATE on it" | `apps/core-server/src/db/schema/capture.ts:53-57` |
| (ii) UPDATE on address | `GRANT UPDATE (transport, model, firmware, address, mac, onvif_uuid, profiles, poe_port, enabled, last_seen_at) ON capture_devices TO dems_app;` | `0005_capture_privileges.sql:39-40` |
| (iii) UPDATE on the six columns | `GRANT UPDATE (video_01_device_id, video_01_profile, video_02_device_id, video_02_profile, mic_primary_id, mic_standby_id, revision, updated_by, updated_at) ON capture_config TO dems_app;` | `0005_capture_privileges.sql:35-37` |
| No later migration changes them | name search for `capture_devices` and `adapter_kind` in `0010` to `0014`: 1 hit, a comment (`0010_credential_replace_privileges.sql:17`); 0 statements | this row; it closes the assumption the security check left open (`verification/04_security_addendum.md:319`) |

Two line references differ from the security check, which cites `0005:27-31` for the INSERT and `0005:38-39` for the address (`verification/04_security_addendum.md:149-150`); the statements are the same, the lines read here are 24-28 and 39-40. The erratum's sentence does not depend on it. Schema set A (row 17) may add migrations after this reading; row 88 re-checks the three grants against the tree it lifts on.

---

## 5. Check of the verification cell: "four texts present; none withdraws a limit"

| Text | Present | Section |
|---|---|---|
| Decision row AM-1 | yes, with 3 slots | 1 |
| The statement of the new guard for H.5 (S13-17), "declared" kept | yes, as erratum draft E-L1 | 2 |
| Erratum E-A2 for the credential comment | yes | 3 |
| Erratum to addendum 1.6 #3, the three grants | yes, as E-A12 | 4 |

| Limit of the task-3 README or specification | Touched by these texts? | State |
|---|---|---|
| H.5: the verifier cannot tell a declared production package from a true one (`06:1133`) | repeated | kept |
| D.1: the report line with the word "declared" (`06:880`) | quoted | kept character for character |
| H.5: "no all-`PRODUCTION` package can be sealed" on this computer, check `M7-SEC-SRC-2` (`06:1139`) | a statement of fact is put beside it | **not withdrawn**; see F-2 |
| Capture architecture specification: "in this phase nothing is recordable in `REAL_PRODUCTION`" (`05:227`) | no | not withdrawn; stage 2 |
| The task-3 README | no | not withdrawn; stage 2 |
| D86 C-5, first clause, for every other kind | restated | kept |

Occurrences of "fit to record" in the four texts as a statement about the product: 0. Each occurrence is in a sentence that says nothing is declared so.

---

## 6. Findings for the controller

| # | Finding | Evidence | What it changes |
|---|---|---|---|
| **F-1** | H.5 already contains guard (4), "the Core itself opened the source", since task-3 erratum PE-128-69. S13-17's sentence "H.5 gains the guard" was taken from SEC35-40's remediation (3), which predates that erratum. At the lift the work is to RESTATE the guard for the two lifted kinds, not to add it | `06_evidence_package_spec.md:1136`; task-3 `09_security_design_review.md:638`; `verification/02_security.md:316` | Text 2 is written as a line-by-line restatement. S13-17's acceptance check ("section H.5 states the guard; the word 'declared' stays") is met by it |
| **F-2** | After row 88, two task-3 sentences are no longer true of the code, although stage 1 may withdraw no limit: D86 C-5's second clause, and H.5's "`developmentSources = false` cannot occur". Row 89 seals exactly such a package (in a temporary directory). Check `M7-SEC-SRC-2` reads "every package sealed on this Mac in this phase has `developmentSources = true`" | blueprint 9.2 exit conditions 2 and 6 (`:555,559`); `06:1139`; task-3 `09:638` | Texts 1 and 2 keep the limit as a rule of use and state the fact beside it. If the controller prefers silence until stage 2, clause (4) of AM-1 and the last line of table 2.2 are struck; the documents then contradict the code between stage 1 and stage 2. Recommended: keep them. A task-3 regression that still runs `M7-SEC-SRC-2` over a data directory is unaffected, because row 89's package never enters one; row 89 should say so in its record |
| **F-3** | The task-3 README lines that `masterplan/01_specs.md:280` names as the limits to withdraw at stage 2 (396, 438, 441-442, 775) are, in the README as it stands, file-list entries (396, 438, 441, 442) and an empty line (775). A search of that README for "recordable" and "class C" returned 0 lines | read 2026-10-12 22:30 WIB | Nothing for stage 1. The stage 2 erratum must locate the README limits again; this row withdraws none, so it needed none |
| **F-4** | `credential.ts` is being changed by row 147 while the lift texts are drafted; its comment already has a new paragraph | `git status` (modified); `credential.ts:16-18` | Text 3 is written against lines 12-14 and leaves row 147's paragraph alone. Row 88 re-reads before editing |
| **F-5** | The erratum for H.5 lives only in this task folder. A reader who opens the closed task-3 specification finds no pointer to it | C16 (4) | The task-4 README and final report should index E-L1 beside the specification's path. Whether the task-3 document gets a one-line pointer is the user's, at stage 2 |

---

## 7. Driver decisions, assumptions, gaps

**DRIVER DECISIONS (conservative; for the controller to confirm).**

| # | Decision | Alternative not taken |
|---|---|---|
| D-1 | AM-1 clause (4) and the last line of table 2.2 keep the limit as a rule and state the code fact beside it (F-2) | Silence until stage 2 |
| D-2 | Labels E-L1 (H.5) and E-A12 (addendum 1.6 #3) are proposals; E-A2 is the addendum's own | Task-3 style `PE-nn-nn` numbers, which belong to the closed task |
| D-3 | The sentence "which PROCESS, not which DEVICE" in table 2.2 is this row's wording of a limit, added in the cautious direction. No review document states it in these words (the nearest are SEC35-28 on forged probe answers and note N-1 on the MAC, `verification/02_security.md:322`). It is marked for row 86 to confirm or strike | Leaving it out |
| D-4 | The annex of 3.3 is offered, not counted among the four texts | Leaving the audit comment to row 88 without a text |

**Assumptions.** The verification documents are accurate where a line was not re-opened. The numeric rules quoted (128 bits, 5,000 ms, seven near-miss paths, the five refused address classes) are the blueprint's as written today (`identification/03_implementation_blueprint.md:170-171,266`; `verification/04_security_addendum.md:228`); if a row builds another value, the text follows the code and the controller is told.

**Gaps.** Rows 8, 86 and 141 have not run: the branch, the review's verdict and the container confirmation are slots. The relay source, the reader and the registry builder do not exist yet: every file name in text 3 is a proposed name. The task-3 decision file was read at one line only (`:99`).

**What stays unproven and goes to the hardware package.** Nothing of this row: it is text. The guard it describes is proven on doubles by rows 89, 90 and 148, and on the real host by `9A/H-01` (the loopback rule, the repeat of E-11 on the host's build).

---
*Generated: 2026-10-12 22:40 WIB*
*Last Updated: 2026-10-12 22:40 WIB*
