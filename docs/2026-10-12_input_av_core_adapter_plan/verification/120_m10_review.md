---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-14
agent: senior-code-reviewer
blueprint_row: 120
milestone: M10
type: code review of phases 8 and 10 (rows 94 to 118 and 194 to 198) AS COMMITTED
narrative_tier: 1
baseline: branch task4/input-av-core-port, head 1fbeada7 (checkpoint commits f20c9b39 and 1fbeada7 on 0f5d2a8e)
verdict: CHANGES REQUESTED (narrow)
blocking_findings: 1
follow_ups: 15
tests_surviving_a_mutation: 11 (8 measured on the helper's suite, 3 by reading)
status: needs-review (the review is PARTIAL: section 9 says exactly what was not read)
---

# Row 120: code review of phases 8 and 10

## 1. Verdict

**CHANGES REQUESTED, narrowly. BLOCKING findings: 1. Follow-ups: 15. No defect was found in a
delivered product file that changes what a caller can do.**

The one blocking finding is in a TEST file. The helper's own suite, the only thing this row was
allowed to run and the executable evidence behind the statement of row 119b (decision C101), is
RED at the head on this host, and the tests that are meant to hold caution R119-02 do not test
it there. The fix touches `test_dems_core_netalias.py` only: the helper's hash does not move.

| | Count |
|---|---|
| Blocking | 1 (B-1) |
| Follow-ups | 15 (F-1 to F-15): 6 medium, 9 low |
| Tests that survive a mutation | 11, named in section 6 |

**How far this verdict reaches.** This is not a full review of rows 94 to 118 and 194 to 198. The
helper, its unit files, its suite, the Core's helper client, caller, lifecycle, journal and store,
the thirteen migration files and the acceptance operations were read in full. The set-IP job, the
scan, the network operations, the destination rule, the re-address chain and most of the Core's
test files were NOT read (section 9). "No further blocking finding" is a statement about what was
read. The status is `needs-review` for that reason, not `complete`.

## 0. Frame (5W1H), method, limits

| Question | Answer |
|---|---|
| **What** | The code-quality view of the commissioning functions as committed: the root helper as Python and its 80 tests; the Core's client, caller and lifecycle; the two contract files against the tables; migrations 0017 to 0029; the Core-side tests; the web screens; duplication, dead exports, test-only seams and the named static entries |
| **Why** | Blueprint row 120 (`identification/03_implementation_blueprint.md:256`): "blocking findings 0, or each routed and re-checked", a gate of M10 |
| **Who** | senior-code-reviewer, read-only on source. A parallel row (60e) hunts credential exits and refusal paths in the set-IP job and the scan; those two modules were left to it |
| **When** | 2026-10-14 08:50 WIB, on head 1fbeada7 |
| **Where** | `/Users/gsp-budi/Documents/DEMS`. `CS/` = `apps/core-server/src/`; `HP` = `scripts/host/netalias/dems-core-netalias`; `HT` = `scripts/host/netalias/test_dems_core_netalias.py` |
| **How** | Reading, each claim with file:line. Three things were RUN, all on doubles: the helper's suite on the committed files (twice), and the same suite on two SCRATCH COPIES of the folder carrying planted mutations (section 8). The copies lay in the session's scratch folder and are deleted. No suite of the Core, no database, no port, no container, no network command; nothing installed; no credential or key file opened |

**Limits.** Nothing is proven on Linux or under systemd. No Core test was run: every statement
about a Core or web test is from its text. Graft was not queried (the same reason record 8b
gives: it refreshes its graph before a query); duplication and use counts come from `grep -rlw`
over `apps/core-server`, named where used. Line numbers are of head 1fbeada7. The in-scope paths
had no uncommitted change when read (`git status --short` on them: empty); `apps/core-web` had
uncommitted edits in OTHER features, so the commissioning screens were read with `git show 1fbeada7:`.

## 2. The blocking finding

### B-1. The helper's suite is red by host uptime, and its stale-mark controls are vacuous in the same window

| | |
|---|---|
| **Where** | `HT:181-183` (`Bench.mark`), `HT:795-803` (the failing case), `HT:772-781`, `HT:850-857`, `HT:866-874` (the controls that pass for another reason); against `HP:170` (`MARK_LINE`, the clock field is `[0-9]{1,12}`) and `HP:675-677` |
| **Measured** | `python3 -I -B scripts/host/netalias/test_dems_core_netalias.py` at head: `Ran 80 tests`, `FAILED (failures=2)`: `test_a_mark_inside_its_lifetime_and_its_grace_still_removes_its_own_address`, subtests `age=1799` and `age=1830`, `'NOT_MARKED' != 'OK'`. The host's monotonic clock read 1,148 s at the first run and 1,778 s at the last (`time.monotonic()`, `mach_absolute_time`) |
| **Cause** | `Bench.mark` writes the mark's clock as `int(time.monotonic()) - age`. When the host has been up for less than `age` seconds that number is NEGATIVE; `MARK_LINE` takes digits only, so `read_mark` answers "no mark" and the helper refuses. The helper is right (a mark from before this boot is no mark); the fixture cannot make an old mark on a young host |
| **Why it matters** | (1) Row 119b ran this suite as its evidence ("Ran 75 tests ... OK") and C101 rests on it; the same file is red whenever it is run within 31 minutes of a boot, which is exactly when a host check after a restart runs it. (2) Worse than red: the cases that are meant to show "a mark past its lifetime is no mark" (caution R119-02) pass on a young host because the mark is UNREADABLE, not because it is old. MEASURED: with the age rule removed from a scratch copy of the helper (`HP:676`, `age > mark[2] * 60 + MARK_GRACE_S` deleted) the two mark classes give the SAME two failures and nothing else (`Ran 21 tests`, `failures=2`, monotonic 1,778 s). On this host no test holds the age rule |
| **Producing row** | H2 (the R119-02 tests), carried by I-9b |
| **Smallest fix** | In `HT` only; the helper and `SHA256SUMS` do not change. (a) The mark fixtures use the shortest lifetime the helper takes, `minutes=5`, so the ages become 0, 150, 299, 330 (inside lifetime and grace) and 361 (past them): a host up for six minutes can run them. (b) `Bench.mark` fails the test with a stated reason when `int(time.monotonic()) - age < 0`, instead of writing a text the helper cannot read. (c) The 9-hour case keeps its age behind `skipUnless(time.monotonic() > 9 * 3600)`, or is dropped: with the lifetime `FOREVER` beside it, it is refused twice over already |
| **Re-check** | The suite once on a host up for less than 30 minutes and once on one up for more; then the age mutation again on a scratch copy: the stale-mark case must FAIL with the rule removed |

## 3. Follow-ups

Severity is this review's. Each has its producing row and the smallest change.

| # | Sev. | Finding | Where | Why it matters | Row | Smallest fix |
|---|---|---|---|---|---|---|
| F-1 | Medium | The helper's `del` answers `0 OK note=already-absent` for an address that is still on the host, on ANOTHER interface | `HP:758-765`: when the mark does not stand, only `on_camera_interface` is asked. A mark written for interface A does not stand once the interface file names B (`HP:673`); the address is still on A | The Core reads `0 OK` as "gone": it closes the row and writes `HOST_ALIAS_REMOVED` (`CS/capture/host-alias/journal.ts:225-229`) while the address stays for up to 480 minutes. 119b accepts the residual ("ends by its kernel lifetime") but not the false "removed". Needs root to change the file while an alias is up | H2 (next helper change, with R119b-01; the hash moves) | Before "already-absent", refuse (`NOT_MARKED`) when ANY interface holds the address: `any(held == quad for _, held, _, _ in addresses)`; one test |
| F-2 | Medium | Seven behaviours of the helper have no behavioural test (measured, section 6) | `HP:232`, `HP:379-380`, `HP:464`, `HP:630`, `HP:748`, `HP:292-293`, `HP:794` | Two of them are sentences rows 119 and 119b rate on: "an unanswered add keeps its mark" (`HP:745-749`) and "nothing after the line" (`HP:377-380`). Only the hash pin sees a change | H2 / test-only, no hash change | Six cases on the double: an `ip addr add` that does not answer inside the bound (the double sleeps): the mark stays; a second line sent after a pause; a mark file planted as a link at write time; the group listed twice; the account listed twice; the double records its standard input |
| F-3 | Medium | The strict dotted-quad parser exists six times; twelve address patterns in all | The same regex at `CS/capture/destination-rule.ts:192`, `CS/capture/host-alias/protocol.ts:112`, `CS/capture/adapters/local/mic-helper-args.ts:403`, `CS/modules/capture-config/factory-scan/service.ts:404`, `network/facts.ts:58`, `camera-network/service.ts:373`. `parseDottedQuad`, `networkOf`, `formatAddress` (`destination-rule.ts:205-221`) are copied as `quad`, `networkOf`, `dotted` (`network/facts.ts:61-75`); `firstThreeOf` twice, word for word (`factory-scan/service.ts:407-412`, `camera-network/service.ts:376-381`); "is private" three ways (`destination-rule.ts:231`, `protocol.ts:125`, `mic-helper-args.ts:417`) | They agree today (checked by reading: all strict, all refuse over 255). The rule S13-11 asks for is "ONE pure function"; the parse under it is six. The next change to one (IPv4-mapped forms, a leading zero) drifts silently | 95, 105, 107, 108, 111, 111b; an integration-pass item | Export the parse once (`quadOf` of `protocol.ts:116` is already exported and pure) and call it from the other five; where a static import rule forbids the path, state the rule's entry rather than copy |
| F-4 | Medium | An interface name has two forms, and two comments each say the other side is equal | Upper case ADMITTED: `HP:163`, `CS/capture/host-alias/caller.ts:256`, `facts.ts:79`. Lower case ONLY: migration `0017:13,34`, `packages/shared/src/api/capture-commissioning.ts:108`. `caller.ts:255` says "the CHECK of the stored column"; `capture-commissioning.ts:104-106` says "the alias helper's own rule" | A port the kernel names with a capital (the predictable form with a PCI domain, `enP2p1s0`) cannot be stored: operation 102 answers `422` with no named reason, on a host where the helper itself would work. Not the Ubuntu 24.04 bench (its names are lower case) | 99, 102, 105 | Now: correct the two comments. Then a ruling: keep lower case and say so in the screen's hint, or widen table and contract in one schema step |
| F-5 | Medium | The contract carries a second builder of the root helper's request line, used by nothing, and says it is the only one | `capture-commissioning.ts:195-209` (`hostAliasAddLine`, `hostAliasDelLine`); `:165-166` "The Core's one caller builds the line with the two functions below and with nothing else". The caller uses `addRequestLine` / `delRequestLine` (`CS/capture/host-alias/protocol.ts:156-163`, `caller.ts:440`). `grep -rlw`: the contract's two are named by its own test only | Two builders of a line a root service parses; a reader of the contract is told the wrong one is in use | 102, 105 | Delete the two from the contract with their test cases and re-word the sentence; or make `protocol.ts` call them. Not both kept |
| F-6 | Medium | The demo reset still keeps thirteen tables: none of the five new ones | `CS/db/reset/kept-tables.ts:76-88`; design `masterplan/03_db_schema_extension.md` 3.3 ("Otherwise a reset would keep a camera and lose its streams"; 2.5: "an alias that a reset forgot would stay on the interface with no owner"); decision C61 (5) routed it to the integration pass | Not in 1fbeada7. After a reset a kept camera has no stream row, and an open alias row is gone while its address is up | the reset's owner, integration pass (C61 (5)) | The five `kept(...)` lines in the design's order and modes, the count in `reset/__tests__/kept-tables.test.ts` |
| F-7 | Medium | A stored acceptance can be answered only while its step ids are in TODAY's list | `packages/shared/src/api/installation-acceptance.ts:439-444` (`storedSteps`: today's enum, or the legacy code form, which a `9A/H-nn` id is not); `INSTALLATION_ACCEPTANCE_STEP_LIST_VERSION` (`:105`) is stored nowhere and read by descriptions and tests only; the route holds its answer to the schema (`CS/modules/capture-config/installation-acceptance/routes.ts:59,66`) | Latent: the day a check is renamed or removed, operation 110 commits the revocation and its audit entry and then cannot answer (`500`). The header says "a changed list is a new version"; nothing reads a version | 116 (V6) | The ANSWER takes any id of the form `INSTALLATION_ACCEPTANCE_CHECK_ID_PATTERN` (`:137`, used by a test only today); the request keeps the closed list |
| F-8 | Low | Operation 109 can answer a reason the contract does not list | `CS/modules/capture-config/installation-acceptance/service.ts:221-223` (`INSTALLATION_STEPS_NOT_THE_LIST`); not in `InstallationAcceptanceReason` (`installation-acceptance.ts:341-363`). Unreachable through the route (its schema answers first) | A code that lives in one module; beside it `:225-242` is eighteen lines of history around an alias constant | 117 (V6, V6b) | Name the reason in the contract, or drop `details.reason`; replace `ACCEPT_CLOCK_BEHIND_REASON` by the member |
| F-9 | Low | The sub-case of R119-05 is still open | `CS/capture/host-alias/lifecycle.ts:352`: a row whose removal the helper answers `NOT_MARKED` closes `ADD_UNCONFIRMED`; the review asked `NOT_ADDED`. Stated as NOT BUILT in `implementation/d3_alias_removal_reason_further.md:61` | A reason that is not exact, known and stated; no row holds it | D3 | A ruling that it stands as stated, or the result entry choosing the reason from the helper's answer |
| F-10 | Low | The undo statements of sets 9, 12, 13 and 14 exist only inside test files | `UNDO_SET_n` "kept in the test" (`implementation/099_schema_set_b.md:77`, `114_schema_set_c.md:80`, `d2_...:139`, `d3_...:159`); the data step `0021` has no undo and writes no audit entry (accepted, C61 (1)) | A production undo would be copied out of a test by hand | 99, 114, D2, D3 | One document that carries the statements, the tests reading them from it |
| F-11 | Low | Re-typed codes of another unit, one of five pinned | `CS/modules/capture-config/host-alias/service.ts:82-87`: `'SESSION_IS_OPEN'`, `'NOT_AVAILABLE_ON_THIS_PLATFORM'`, `'HELPER_NOT_CONFIGURED'`, `'HELPER_NOT_INSTALLED'`, `'HELPER_SOCKET_UNSAFE'`. Only the first is compared with its source (`__tests__/service.test.ts:79`) | A rename in the capture unit turns "helper not configured" into "removal failed" with no red test | 106b | The test compares all five with `HostAliasCoreRefusal` / `HostAliasLifecycleRefusal` |
| F-12 | Low | Dead exports | No importer at all: `HOST_ALIAS_WRITES` (`store.ts:76`, "for the tests of the folder": no test names it), `INSTALLATION_ACCEPTANCE_LEGACY_STEP_KEYS` (`installation-acceptance.ts:84`). Named by a test only: `HELPER_REFUSAL_KINDS` with `HostAliasRefusalKind` (`caller.ts:137-194`: forty rows of "who has to act" that no route or screen reads), `LOCAL_SOCKET_FAILURES`, `INSTALLATION_ACCEPTANCE_CHECK_ID_PATTERN`. Re-exported by `host-alias/index.ts` and imported by nothing outside the folder: the five statement constants, the two labels, `NEVER_ADDED_CLOSES_AS`, `HostAliasFactsUnknownError`, `HostAliasJobRefusal`, `helperRefusalOf`, `HostAliasEffect`, `AliasAddressProblem` | Surface that reads as used | 105, 106, 116 | Remove, or give `HELPER_REFUSAL_KINDS` its reader (the screen could say "installation" against "host state") |
| F-13 | Low | Members under `src/` that only a test hands in (the family of AD-08) | `createLocalSocketTransport` with `trustedOwnerUid` and `boundMs` (`CS/host-alias-socket.ts:97-107`); `door`, `neighbourProgram`, `echoProgram`, `neighbourBoundMs`, `echoBoundMs` of the commissioning inputs (named as "a test's" by `CS/capture/__tests__/static.test.ts:1371-1376`); `aliasTransport`, `aliasInterfaceFile` (accepted, C82 (3)); `HostAliasLifecycleDeps.store` (`lifecycle.ts:166`); `installationAcceptanceControl` ("its test control", `installation-acceptance/__tests__/service.test.ts:742-751`) | Each of the first eight is held by a static pin on the text of the one production call. The last two were not checked for a pin | 105, 106, 111b, 117 | One list of them in one static file, the last two added to it |
| F-14 | Low | The named entries are narrow; two of the rules around them are held by form | `CLOCK_FLOOR_ENTRY` (`installation-acceptance/__tests__/service.test.ts:697-709`): word for word, with six planted controls - narrow. But "no read in the folder" counts the WORD `SELECT` (`:728-729`): a `TABLE ...`, a `WITH ... RETURNING` or a no-op `UPDATE ... RETURNING` reads without it. And "recording is not gated" leaves all of `src/db/` out of its scan (`:734-735`): a reader placed there and imported under a name without "installation acceptance" passes both scans. SR-10: narrow, every store line pinned (`CS/credential-store/__tests__/static.test.ts:104-112`). SR-12: narrow; the test's own shape pattern (`mic-helper-args.ts:435`) admits octets over 255, the function does not | A rule that is green because of how today's code is spelled | 117 (V6b), 111b | Count statements that name the table and are not the two writes; scan `src/db/` outside `schema/` and `migrations/` |
| F-15 | Low | Stale words | "PROVISIONAL" for SR-10 (`credential-store/__tests__/static.test.ts:30,99`) and "PROPOSED" for SR-12 (`capture/__tests__/static.test.ts:1322`): both confirmed by C94. `installation-acceptance.ts:13-15`: "No Core route ... and no screen ... exists yet". Web test titles: `commissioning.test.tsx:1224` ("`id`, `passed`, `detail`"), `:1281` and `acceptance-model.ts:77` ("six reasons": seven). `HP:714`: the parameter `call` of `add` is not used | A reader is told a state that is over | 86, 111b, 116, 118 | One text pass |

## 4. The six angles, each answered

**(1) The helper as code.** Good, and tighter than its size suggests. One place starts a program
(`run_tool`, `HP:459-476`): a fixed argument list, no shell, `cwd=/`, two environment entries, a
time bound, standard input from nowhere; every vector begins with one of two constants. The
request reader (`HP:360-381`) bounds bytes and time and takes one line; the parser (`HP:424-445`)
sets the journal's fields only from checked values. Every "cannot tell" in `add` is a refusal
(re-read against 119b section 4.3: agreed). Marks: written `O_EXCL | O_NOFOLLOW` before the add,
in a root-only folder; a second instance cannot exist while the socket unit admits one
connection - the helper holds no lock of its own (119b note N-2 stands). What a second connection
sees: the service manager closes it at once; the Core reads no byte, calls it `CONNECTION_LOST`
with effect UNKNOWN (`CS/host-alias-socket.ts:165-167`, `caller.ts:375`) and, after an add, asks
a removal at once. That is the safe reading; whether the boot sweep's consecutive calls meet it
is `9A/H-05`. The dpkg check trusts two root-owned records and starts nothing: sound as
identification. The five new codes are in the Core's table, compared with the helper's file by a
real read (`CS/capture/host-alias/__tests__/caller.test.ts:186-190`): R119b-03 is closed.
Findings: F-1, F-2. Unit files against the host profile: the lines the profile names (HOST-43 to
HOST-47, `HOST-PROFILE-UBUNTU-24.04.md:123-127`) are met. HYPOTHESIS, not measured:
`ProtectKernelTunables=yes` and a `SystemCallFilter` would be tolerated (the helper reads `/sys`
and writes nothing there); they move the hash and need the host, so they belong with the next
helper change, not here.

**(2) The contracts.** All fifteen commissioning reasons and all seven acceptance reasons are
named by a product file of the Core (`grep -rlw` per reason over `CS/`, tests left out). Bounds
against the tables: `alias_host` 2-254, `alias_minutes` 5-480, `camera_ip_start` 2-250, the
subnet prefix 16-30, at most 32 factory addresses, the alias address and its host part 1-254 are
equal on both sides. The contract is NARROWER than the table, by intent and stated, for the
subnet (private only) and the factory list (strict private host addresses against the table's
loose pattern; note N-5 of the plan review). The acceptance contract counts bytes as `jsonb`
prints them (`installation-acceptance.ts:306-329`): 27 steps with full ASCII notes are at most
6,858 bytes (computed), inside 8,192; with two-byte letters they are not, and the form then says
only "not accepted". Findings: F-4, F-5, F-7, F-8.

**(3) The migrations.** Read as SQL. The data step 0021 is the negation of the CHECK of 0022,
letter for letter, and touches one column; it can violate no other CHECK of the table (none
names `profiles` but the two it serves). The three value-set steps (0019, 0026, 0028) only widen
a list, so no stored row can fail them. `host_network_aliases_one_open_key` holds "one open row"
as `store.ts` says; `..._open_address_key` beside it is implied by it (kept on purpose, record
099:50). Privileges: no DELETE on any new table, UPDATE by column. Findings: F-6, F-10.

**(4) The Core's tests.** SAMPLED, not reviewed (section 9). What was read holds: the acceptance
unit cases run on a store written in the test (`service.test.ts:112-134`), and the real statement
is proven on a database beside them (`routes.db.test.ts:372`, `:450`, `:475`); the code table is
compared with the helper's file. No test in scope listens on a fixed port: the socket tests use
a node in a temporary folder (`CS/__tests__/host-alias-socket.test.ts:64,134`); `grep "listen("`
over the other in-scope test files: no line.

**(5) The web screens.** The typed account is in two uncontrolled inputs read at the press
(`set-ip.tsx:222-224`), emptied before the request leaves (`:233-234`) and on unmount, router
navigation and `pagehide` (`:187-207`). The five assertions are real: the values are read from
element references kept across the unmount, the "empty before the request" case reads the fields
from inside the transport (`commissioning.test.tsx:1034-1042`), and each "found nowhere" search
has a control that finds something. The acceptance form reads the contract's list and has none of
its own (`acceptance-model.ts:103`, pinned by `toBe` at `commissioning.test.tsx:1226`). One
survivor: section 6, W-1.

**(6) Duplication and drift.** Three parsers of a dotted address: six, F-3. Three ways to ask "is
a session open": ONE - `isSessionActive(app.engine.state().session)`, written out in six mounts
(`host-alias/index.ts:109`, `camera-network/index.ts:137`, `installation-acceptance/index.ts:105`,
`factory-scan/index.ts:180`, `network/index.ts:192`, `capture-composition.ts:651`) and three times
as `scope.pending().session` inside a unit. The same lambda nine times, one predicate. Small
repeats inside the alias folder: `literalOf`, `NOT_MARKED` and the code pattern in both
`lifecycle.ts:175-177` and `journal.ts:144-148`.

## 5. Notes, no row asked

- N-1. The scan and the set-IP job ask "is a session open" before their work and not again inside
  a unit, unlike the alias journal and the acceptance. Left to row 60e (its angle).
- N-2. `caller.ts` reads a connection the service manager dropped as "effect unknown". Correct and
  conservative; if `9A/H-05` shows drops between the sweep's calls, the sweep wants one bounded
  retry on `CONNECTION_LOST` before it records a failure.
- N-3. `INSTALLATION_ACCEPTANCE_LIMITS` says "no looser and no stricter" than the table; the
  contract counts a text's length in UTF-16 units and the table in characters, so the contract is
  stricter for characters outside the basic plane. The safe side.

## 6. Tests that would survive a mutation, named

**Measured** = the mutation was planted in a scratch copy of `scripts/host/netalias` and the suite
was run on it. The hash pin (`test_the_delivered_files_have_the_recorded_hashes`) fails for any
change of the helper, as it must; "survives" means no BEHAVIOURAL test fails.

| # | Test (file) | Mutation | Result |
|---|---|---|---|
| H-1 | `Bound6DelOnlyWhatWasMarked.test_a_mark_past_its_lifetime_does_not_remove_an_address_somebody_else_set`, `test_a_stale_mark_does_not_count_and_does_not_stay_at_the_next_add`, `test_del_of_one_marked_address_drops_every_other_stale_mark` (`HT:772`, `:850`, `:866`) | the age rule of a mark removed (`HP:676`) | MEASURED: survives on a host up for less than 1,861 s (B-1). **The worst: it is the rule R119-02 was closed on** |
| H-2 | `Bound5MarkAndLifetime.test_an_add_the_tool_refuses_leaves_no_mark` (`HT:709`) | an add whose tool did not answer drops its mark too (`HP:748`, the condition removed) | MEASURED: survives. No case has a tool that does not answer |
| H-3 | `TheFormOfTheCall.test_a_second_line_is_refused` (`HT:1079`) | the look for bytes after the line removed (`HP:379-380`) | MEASURED: survives. Every case sends both lines in one write, which `HP:377` catches |
| H-4 | `Bound5MarkAndLifetime.test_marks_folder_others_can_write_or_with_a_foreign_entry` (`HT:716`) | `write_mark` without `O_EXCL` and `O_NOFOLLOW` (`HP:630`) | MEASURED: survives |
| H-5 | the same case and `Bound1Interface.test_interface_file_writable_by_group_or_others_a_link_or_missing` (`HT:336`) | `_read_small` follows links (`HP:232`) | MEASURED: survives (the `lstat` before it refuses first) |
| H-6 | `TheFormOfTheCall.test_the_service_user_is_the_one_member_of_the_group_or_nobody` (`HT:1111`) | a group listed twice is not refused (`HP:292-293`) | MEASURED: survives |
| H-7 | `Bound5MarkAndLifetime.test_the_mark_and_the_lifetime_of_the_shortest_and_the_longest_request` (`HT:693`, asserts mode 0644) | `os.umask(0o022)` removed (`HP:794`) | MEASURED: survives (the test's own umask gives the mode) |
| H-8 | `Bound7NoInjectionPoint.test_a_hostile_environment_changes_nothing` (`HT:897`) | the tool inherits the helper's standard input, the connection (`HP:464` removed) | MEASURED: survives. The double records arguments, environment and folder, not its input |
| C-1 | `modules/capture-config/host-alias/__tests__/service.test.ts:103` (the table of refusals) | `HELPER_NOT_INSTALLED` renamed in `capture/host-alias/caller.ts:120` | BY READING: survives; the test types the word itself (F-11) |
| C-2 | `installation-acceptance/__tests__/service.test.ts:338` and `:488` | `INSERT_CLOCK_FLOOR` taken out of the statement (`store.ts:88-92`) | BY READING: both stay green - the bench's store decides (`:117-118`). Not a hole: `routes.db.test.ts:475` and the word-for-word entry (`service.test.ts:771`) hold it. Named because the unit cases assert on their own fixture |
| W-1 | `commissioning.test.tsx:1080`, the CANCEL part | `clearAccount()` removed from `cancel` (`set-ip.tsx:215-219`) | BY READING: survives; the unmount that follows empties the fields. The behaviour holds, the line is not tested |

H-2 to H-8 were planted together: `Ran 80 tests`, `FAILED (failures=3)` - the hash pin and the two
subtests of B-1, which fail on the committed file too.

## 7. What was done well

- The helper keeps every path and number in one constants block and has no door for a test; the
  test copy is a build step that replaces that block and nothing else (`make_test_copy.py`).
- The Core's copy of the helper's codes is checked against the helper's text, not against itself.
- The acceptance operations never ask "is one in force" before they write; the index and the row
  count answer. The clock guard is a condition of the one statement.
- Refusals of the routes carry a reason of a closed set and a fixed sentence; nothing read here
  quotes an input.
- The web credential tests carry controls that would fail if the search were blind.

## 8. Evidence

| Check | Command | Output |
|---|---|---|
| The helper is the hashed one | `shasum -a 256 scripts/host/netalias/dems-core-netalias` | `1e758a24...15b1`, equal to `SHA256SUMS` line 1 and to row 119b |
| The suite at head | `python3 -I -B scripts/host/netalias/test_dems_core_netalias.py` (twice) | `Ran 80 tests in 31.879s`, `FAILED (failures=2)`; the two subtests of B-1 |
| The host's clock | `python3 -I -c "import time;print(time.monotonic())"`; `uptime` | `1148.2`, later `1778`; `mach_absolute_time()` |
| Seven mutations together (H-2 to H-8), scratch copy | the same suite in the copy | `Ran 80 tests in 47.558s`, `FAILED (failures=3)`: the hash pin and the two of B-1 |
| The age rule removed (H-1), scratch copy | `... test_dems_core_netalias.py Bound6DelOnlyWhatWasMarked Bound3OtherInterfaceAndLimit` | `Ran 21 tests in 7.908s`, `FAILED (failures=2)`: the two of B-1, no other |
| The scratch copies are gone; the source folder is untouched | `rm -rf` of the copies; `git status --short scripts/host` | one line, `INSTALLER-NOTE-FIRST-PRODUCTION-BOOT.md` (another agent's; not opened by this row) |
| In-scope paths as committed | `git status --short` on the helper folder, `CS/capture/host-alias`, `CS/modules/capture-config`, `packages/shared/src/api`, the web commissioning folder, `CS/db` | empty, before reading |
| The parser, six times | `grep -rnE` for the octet patterns over `CS/`, `packages/shared/src`, `apps/core-web/src`, tests left out | the six lines of F-3 and six other dialects |
| Reasons with a producer | `grep -rlw <reason>` over `CS/` per reason, tests left out | fifteen of fifteen named by at least one file |

## 9. Read in full, read in part, not read

| | Files |
|---|---|
| **Read in full** | `scripts/host/netalias/dems-core-netalias`, `dems-core-netalias.socket`, `dems-core-netalias@.service`, `make_test_copy.py`, `test_dems_core_netalias.py`; `CS/host-alias-socket.ts`; `CS/capture/host-alias/protocol.ts`, `caller.ts`, `lifecycle.ts`, `journal.ts`, `store.ts`, `facts.ts`, `index.ts`; migrations `0017`, `0018`, `0019`, `0021`, `0022`, `0024`, `0026`, `0028`; `CS/modules/capture-config/installation-acceptance/service.ts`; `apps/core-web/src/features/commissioning/acceptance-model.ts`; `verification/119_commissioning_security.md`, `119b_helper_statement.md` |
| **Read in part** | migrations `0020`, `0023`, `0025`, `0027`, `0029` (their statements, not their comments); `packages/shared/src/api/installation-acceptance.ts` (1-135, 200-682); `capture-commissioning.ts` (74-208, 284-533); `CS/capture/host-alias/job-port.ts` (30-103); `installation-acceptance/store.ts` (30-208), `routes.ts` (two lines); its `__tests__/service.test.ts` (58-202, 640-789, every title), `routes.db.test.ts` (titles); `CS/modules/capture-config/host-alias/service.ts` (30-115); `CS/capture/destination-rule.ts` (186-232); `mic-helper-args.ts` (396-440); `factory-scan/service.ts` (398-420); `network/facts.ts` (52-75); `camera-network/service.ts` (366-392); `CS/modules/capture-discovery/readdress-route.ts` (1-60 and its refusal lines); `CS/capture/__tests__/static.test.ts` (1322-1424, the SR-12 block; the SR-11 lines by search); `CS/credential-store/__tests__/static.test.ts` (20-42, 92-112); `capture/host-alias/__tests__/lifecycle.test.ts` (titles), `caller.test.ts` (five lines); web `set-ip.tsx` (1-60, 140-400), `commissioning.test.tsx` (969-1150, 1224-1295, every title); `masterplan/01_specs.md` (408-462), `03_db_schema_extension.md` (1-420), `verification/02_security.md` (190-259), the seventeen named decision rows (the first 2,300 characters of each; C49 by its first lines), `HOST-PROFILE-UBUNTU-24.04.md` (the helper items and the Core's unit), records `099`, `114`, `d2`, `d3` (their rollback lines and, for `d3`, the lines on the two reasons), `CS/db/reset/kept-tables.ts` (60-88) |
| **NOT read** | Every implementation record but the four above (095, 096, 097, 102, 104, 105, 106, 106b, 106c, 107, 108, 110, 111, 111b, 112, 113, 116, 117, 118, 194 to 198, h2, v6, v6b). The set-IP job and the scan: `camera-network/*` and `factory-scan/*` but the lines named, `CS/capture/adapters/camera/onvif-network.ts`, `stored-address.ts`, `stream-probe.ts`, `CS/capture/fence/production-parts.ts`, `CS/capture-composition.ts`. The network operations `network/service.ts`, `routes.ts`, `index.ts`. The re-address chain: `readdress.ts`, the engine door, `camera-readdress-dialog.tsx`, `camera-readdress.ts`, their three test files. The commissioning permission (row 100) and the RBAC tests. The typed-address probe and its contract (rows 94, 96, 98). Web: `index.tsx`, `model.ts`, `parts.tsx`, `refusal.ts`, `report.ts`, `set-ip-model.ts`, `acceptance.tsx`. Core tests: the bodies of `lifecycle.test.ts`, `caller.test.ts`, `lifecycle.db.test.ts`, `host-alias-socket.test.ts`, the scan, job and network tests, `set10` to `set14.db.test.ts`, the two acceptance walkers, the shared contract tests. The typed schema (`db/schema/*.ts`), the snapshots, the twenty-one captured files, the hardware chapters |

Why: the scope is about 20,000 lines of source and tests beside 28 records, and this pass put its
reading where the brief named code no other row reads line by line (the root helper, the
migrations, the contracts' bounds). The set-IP job and the scan were left to row 60e by the brief.
The rest is unread because the pass ran out of room, not because it was judged sound.

## 10. Assumptions, gaps, alternatives

- **Assumption:** `time.monotonic()` on the host the user runs the suite on starts near zero at
  boot, as on this Mac and on Linux. B-1 then appears there in the first 31 minutes after a boot.
- **Gap (the largest):** angle (4) of the brief asked the mutation questions of every Core test
  of the rows in scope. Three were answered by reading; the rest were not asked. A second pass
  over `lifecycle.test.ts`, `caller.test.ts`, the scan and job tests and `set10` to `set14` is
  needed before the gate's "0, or each routed and re-checked" can be said for the tests.
- **Gap:** F-1 is read from the code and not run. It needs a mark for another interface than the
  file names and the address held by a third entry of the listing: one case on the double.
- **Gap:** F-7's "commits, then cannot answer" is inferred from the route's response schema
  (`routes.ts:66`); the order of commit and answer was not traced through the plugin.
- **Alternative considered for B-1: a follow-up, not blocking.** Not taken. The fix is small, but
  the finding is that the one runnable proof of a root program's bound is red and, where green,
  partly empty; a gate that reads "suite OK" would be reading a number that depends on when the
  machine was started.
- **Alternative considered for F-1: blocking.** Not taken. It needs root to change the interface
  file while an alias is up, the address still ends by the kernel lifetime, and the fix moves the
  helper's hash, which C101 (C-4) binds to a re-read: it belongs in the next helper change.
- **Alternative considered for the verdict: APPROVED WITH COMMENTS.** Not taken while B-1 stands
  and while section 9 is as long as it is.

## 11. Verification cell of row 120, checked

| Cell | Result |
|---|---|
| Blocking findings 0, or each routed and re-checked | 1 blocking (B-1), routed to H2 with its re-check stated; NOT yet re-checked |
| The named list of tests that would survive a mutation | section 6: 11 (8 measured, 3 by reading) |
| The table read in full / in part / not read | section 9 |
| Follow-ups and notes apart from findings | sections 3 and 5 |

---
*Generated: 2026-10-14 08:50 WIB*
*Last Updated: 2026-10-14 08:50 WIB*
