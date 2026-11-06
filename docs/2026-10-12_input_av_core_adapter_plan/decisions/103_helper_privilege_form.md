---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-12
agent: data-analyst
blueprint_row: 103
milestone: M10
type: decision DRAFT (security item S13-09: the form of the privilege grant for the alias helper)
narrative_tier: 1
status: draft - complete as a draft; adopted by the controller, not by this row
confidence: MEDIUM (the form is sound on the documents read; three points about systemd are hypotheses until the Ubuntu 24.04 host or container shows them)
closes_requirements: S13-09 (decision half; built by rows 104, 105, 81; installed by the user through row 127)
last_updated: 2026-10-12 22:50 WIB
---

# Row 103: the form of the privilege grant for the alias helper (S13-09), decision draft

**This is a draft.** This row did not write `decisions/decisions.md` and changed no source file. The controller adopts the row of section 1, or changes it.

## 0. Frame (5W1H), method, limits

| Question | Answer |
|---|---|
| **What** | One decision: by which mechanism the Core's service user causes the root-owned alias helper to run. Options compared, one chosen, the effect on rows 104, 105, 81 and 127 stated per row, and the consequences for the user's installation step. |
| **Why** | Security item S13-09 (Medium): "the `sudo` path forbids `NoNewPrivileges` and a capability bound on the process that holds evidence and keys"; "a decision row before WP-19 closes" (`verification/02_security.md:69,206-208`). Rows 104, 105, 81 and 127 depend on this text by contract (`103:C`). |
| **Who** | Drafted by data-analyst. Decided by the controller: "Controller's row; the user installs either" (`masterplan/04_design_addendum.md:622`). The installation itself is the user's (U12 B5, `decisions/decisions.md:24`; user action UA-3). No agent runs `sudo` (driver rule 3). |
| **When** | Drafted 2026-10-12 22:50 WIB, before rows 104 and 105 start. Changing the form after row 104 is built costs a rewrite of the helper's request reader and of row 105's caller (section 8). |
| **Where** | The production host only: Linux, Ubuntu 24.04 (U12 A2). On the development Mac the real operation answers "not available on this host" (row 105). |
| **How** | Reading only. Read: the driver rules; `decisions/decisions.md`; `verification/02_security.md` sections 2, 5 (5.1 to 5.4), 8; `verification/04_security_addendum.md`; `masterplan/04_design_addendum.md` sections 6, 9, 10; `masterplan/01_specs.md` rules DR-1 to DR-4 and notes SN-1, SN-2 (`:416-419,456-457`); the blueprint rows 76 to 81, 99 to 127 with their profile lines. Read-only reference in `apps/input-av/` (not under `data/`): `scripts/dems-netalias:1-48`, `scripts/install.sh:84-90`, `deploy/dems-nvr.service:1-24`. Two manual pages fetched from man7.org on 2026-10-12: `systemd.exec(5)` (the option `NoNewPrivileges=`) and `systemd.socket(5)` (`Accept=`, `SocketUser=`, `SocketGroup=`, `SocketMode=`, `MaxConnections=`, `MaxConnectionsPerSource=`, `PassCredentials=`). Nothing was run. No `.env`, nothing under `apps/input-av/data/`. |

**Limits.** No Linux host was available. Three statements about systemd are HYPOTHESES (HP-1 to HP-3, section 9). The helper, its caller and the host profile do not exist yet; this row states what they must satisfy, not how they are coded.

---

## 1. The decision row, ready for `decisions/decisions.md`

Columns as that file has them (`# | Date | Decision | By | Status`). `[n]` and the date are the controller's.

> | `C[n]` | `[date]` | **(controller, S13-09) Form of the privilege grant for the alias helper: a root service on a local socket. `sudo` is not used.** The Core's service user reaches the helper through a socket of the init system: a socket unit that listens on a UNIX stream socket (owner root, group a dedicated group whose only member is the Core's service user, mode 0660, in a root-owned directory under `/run`), and a template service that the init system starts as root once per connection, with that connection as the helper's standard input and output. The helper is the same root-owned file of row 104 and enforces the nine bounds of S13-08 by itself, whatever its caller; the request is one line of fixed form (the verb `add` or `del` and one address), the answer one line with a code from a closed set. The helper checks the peer's user from the socket and refuses any other. The Core's own unit sets `NoNewPrivileges=yes` and an empty capability bounding set, and a boot check in `REAL_PRODUCTION` names a Core that runs without the no-new-privileges state. **Reason:** with `sudo` the unit of the process that holds the evidence, the database role and the signing path could set neither (S13-09; the service file of input-av says so itself); with the socket form the Core's process and every child of it, the relay and the capture worker included, can never gain a privilege through an execution, and the root side shrinks to a short-lived process that the init system confines. **`sudo -n` only by a written exception:** a later decision row that names the host, states why a socket unit cannot be used there, states that the Core's unit then runs without `NoNewPrivileges` and without a capability bound, and is confirmed by the user before the installation. No such reason is known for Ubuntu 24.04. S13-08 applies to either form unchanged. **Installation** is the user's (U12 B5), by the ten steps of `verification/02_security.md` 5.4 with step 4 in its "root service" branch. Detail and effect per row: `decisions/103_helper_privilege_form.md` | controller | in force, reversible until row 104 is built without cost; after that at the cost of section 8 |

---

## 2. Facts

| # | Fact | Evidence |
|---|---|---|
| 1 | input-av grants the whole helper through one sudoers line without a password: `$SVC_USER ALL=(root) NOPASSWD: $HELPER`, checked with `visudo -cf`, mode 0440 | `apps/input-av/scripts/install.sh:85-89` |
| 2 | Because of that line, input-av's service unit sets neither option, and says so: "Jangan pasang NoNewPrivileges/CapabilityBoundingSet: helper jaringan dijalankan lewat sudo" | `apps/input-av/deploy/dems-nvr.service:19-20` |
| 3 | `NoNewPrivileges=`: "If true, ensures that the service process and all its children can never gain new privileges through execve() (e.g. via setuid or setgid bits, or filesystem capabilities)". `sudo` is a set-user-ID program, so under this option it cannot become root | `systemd.exec(5)`, man7.org, fetched 2026-10-12; the consequence for `sudo` is this row's reading of that sentence, to be seen on the host (check V-3, section 7) |
| 4 | The same page: the option "has no effect on processes potentially invoked on request of them through tools such as at(1), crontab(1), systemd-run(1), or arbitrary IPC services". A helper started by the init system on a socket connection is such a process: it is not a child of the Core and is not bound by the Core's option | `systemd.exec(5)`, same fetch |
| 5 | A socket unit with `Accept=yes`: "a service instance is spawned for each incoming connection and only the connection socket is passed to it"; a template unit `name@.service` must exist | `systemd.socket(5)`, man7.org, fetched 2026-10-12 |
| 6 | `SocketUser=`, `SocketGroup=`: the socket node is "owned by the specified user and group"; unset, by root. `SocketMode=` sets its access mode, default 0666 | same |
| 7 | `MaxConnections=`: the number of instances run at once with `Accept=yes`, default 64. `MaxConnectionsPerSource=`: for a UNIX socket, per source user; default 0, disabled | same |
| 8 | The security review's first choice: "a root-owned service reached over a local socket (owner root, group the Core's, mode 0660, the peer's user checked), taking the same two verbs, so that the Core's unit keeps `NoNewPrivileges` and an empty capability set. `sudo -n` is acceptable when the row says why the service was not taken; S13-08 applies to either form unchanged" | `verification/02_security.md:208` |
| 9 | The design named `sudo -n` (rule DR-2) and left the alternative undesigned: "a root service activated over a local socket, which lets the Core keep `NoNewPrivileges` (HYPOTHESIS, not designed)" | `masterplan/01_specs.md:417,457` |
| 10 | The helper is the enforcement boundary, not the Core: "whatever runs as the Core's service user can execute `sudo -n <helper> ...` directly", past role, idle rule, wrong-network guard and audit. Nine bounds, among them "(8) writes one line per call to the system journal: calling user, verb, address, result" and "(9) answers with fixed exit codes; its messages contain no text of the caller" | `verification/02_security.md:192-204` |
| 11 | The installation procedure already has both branches in step 4: "if `sudo`: one file under the sudoers include directory ...; If the root service: its unit and socket files, owner root, socket mode 0660 with the Core's group" | `verification/02_security.md:221` |
| 12 | The relay must give up the right to gain privileges by itself (RC-6), and row 141 reads that state from the process table. The Core's unit is to have a core-file limit of 0 (AD-09 (1)); neither requirement names `NoNewPrivileges` for the Core's unit | `verification/02_security.md:160`; `verification/04_security_addendum.md:204`; `identification/03_implementation_blueprint.md:199,264` |
| 13 | The capability `CAP_NET_ADMIN` on the Core is ruled out: it "would let the process that holds evidence and keys change any interface, route or firewall rule, and it bypasses the conflict check" | `masterplan/01_specs.md:457` (SN-2) |
| 14 | If the kernel does not expire the address (hypothesis H-S), "the removal is scheduled by root at the moment of adding (a transient timer of the init system), never by the Core's memory" | `verification/02_security.md:212` (S13-10 (a)) |

---

## 3. Options

| | O-1 Root service on a local socket, one instance per connection | O-2 Root service as a long-running daemon on the socket | O-3 `sudo -n` with one sudoers line (DR-2, as input-av) | O-4 Set-user-ID helper, or file capabilities on the helper | O-5 The init system starts a unit on the Core's request, authorised by a policy rule | O-6 `CAP_NET_ADMIN` on the Core |
|---|---|---|---|---|---|---|
| Core's unit keeps `NoNewPrivileges` and an empty capability set | **yes** (fact 4) | yes | **no** (facts 2, 3) | no: both are gained through an execution, which the option forbids (fact 3) | yes | no: it is the capability |
| Root code alive between calls | none | a daemon, always | none | none | none | the Core itself |
| The root side can be confined | yes, by the template unit (capabilities, file system, time bound) | yes | no: full root for the call | no | yes | - |
| New code beyond the helper | 2 unit files; the helper reads one line from its standard input | a daemon with its own accept loop | 1 sudoers file | none | 1 policy rule file in another language, 1 template unit; the request travels in a unit's instance name | none |
| Who is the caller, for the journal line | the socket's peer | the socket's peer | the variable `sudo` sets | the real user id | the bus caller | - |
| S13-08's nine bounds | unchanged, in the helper | unchanged, moved into the daemon | unchanged | unchanged | unchanged | **bypassed** (fact 13) |
| Testable on doubles on the Mac | yes: the helper is fed a line on standard input; the caller meets a socket double | yes | yes | yes | no: the policy engine and the bus cannot be doubled faithfully | - |
| Verdict | **chosen** | rejected: a permanent root process and more code for no gain | **only by written exception** | rejected: same cost as O-3 | rejected: two more privileged configuration files and a request encoded in a name | rejected by SN-2 |

---

## 4. Recommendation

**O-1: a root service on a local socket, one short-lived instance per connection. `sudo -n` only with a written exception.**

Reasons, in order of weight:

1. **It keeps the control S13-09 is about.** The Core's process holds the evidence files, the database role, the credential store's key and the signing path. With O-1 that process, and every child of it, can be started with `NoNewPrivileges=yes` and no capability at all. With `sudo` it cannot (facts 2, 3). The relay parses camera data with the Core's rights (S13-07); under O-1 a flaw there cannot reach root through any set-user-ID program on the host, not only through the helper.
2. **The reach of the Core's user is the same or smaller.** In both forms the service user can ask for `add` and `del` and nothing else, and the helper refuses by its own nine bounds. Under O-1 the root process itself can be bounded by its unit (network administration and raw sockets only, a read-only file system, a run-time limit), which `sudo` does not offer.
3. **It costs little.** The helper stays one file with the same checks; only the place it reads its request from changes (one line on standard input in place of two arguments). Two small unit files are added. No daemon is written.
4. **It was the security review's first choice** and the installation procedure already carries its branch (facts 8, 11).
5. **It makes S13-10 (a) simple.** A helper started by the init system as root can schedule the removal with a transient timer of the same init system, if hypothesis H-S fails (fact 14).

**What the exception for `sudo -n` must contain,** if it is ever written (a later decision row, confirmed by the user before installation): the host; the concrete reason a socket unit cannot be used there; the statement that the Core's unit then runs without `NoNewPrivileges` and without a capability bound; the sudoers line in the form of 5.4 step 4 (one user, one absolute path, no wildcard, environment reset); and what stands in for the lost control. "It is what input-av did" and "it is simpler" are not reasons. On Ubuntu 24.04, the ruled host (U12 A2), this row knows of none.

**Alternatives considered and not recommended:** O-2 to O-6, table of section 3.

---

## 5. The chosen form, as requirements

Names are proposals (marked *); the rows that build them fix the names.

| # | Requirement | For |
|---|---|---|
| PF-1 | **Socket unit** `dems-netalias.socket`*: one UNIX stream socket at a constant path in a directory under `/run` that is owned by root and not writable by group or others; owner root; group a **dedicated** group* whose only member is the Core's service user (not a shared group such as `audio`); mode 0660; `Accept=yes`; at most 1 instance at a time and 1 per source user; no network address | row 104 (delivers the file), row 127 (installs), row 81 (checks) |
| PF-2 | **Template service** `dems-netalias@.service`*: runs the helper file of row 104 as root, the connection as standard input and output, standard error to the journal; a run-time bound that covers the conflict check; capabilities bounded to what `ip` and the conflict-check tool need; no new privileges; the file system read-only except the helper's state directory under `/run`; it stays in the host's network namespace (it must, to change an interface) | row 104 |
| PF-3 | **Request:** exactly one line, at most 64 bytes, printable ASCII, of the form verb, one space, address, line end; verb `add` or `del`. Anything else, a second line, a longer line, or any command-line argument: refusal by a fixed code, with no text of the caller in the answer or the journal (S13-08 (7), (9)). The interface is never in the request: it is read from the root-owned file (S13-08 (1)) | row 104; row 105 writes it |
| PF-4 | **Answer:** one line with a code from a closed set, then the connection is closed; the same code is the helper's exit status, so that the journal and the answer agree. S13-08 (9) reads "fixed answer codes" in this form | row 104; row 105 reads it |
| PF-5 | **The caller's identity:** the helper reads the peer's user id from the connection and refuses a peer that is not the Core's service user, and writes that id as "calling user" in its journal line (S13-08 (8)). The socket's mode and group are the first line; this check is the second. How the helper obtains the id depends on the language row 104 chooses: see HP-1 | row 104 |
| PF-6 | **No test door in the delivered file** (S13-16 (1)): the socket path, the tool paths and the interface file's path are constants of the delivered files; the test copy is made by the build step; the hash test covers the helper **and** the two unit files | row 104 |
| PF-7 | **The Core's unit:** `NoNewPrivileges=yes`, an empty capability bounding set and no ambient capability; the dedicated group as a supplementary group; UNIX sockets allowed if the unit restricts address families. This is what the decision buys; without it the decision changes nothing | row 76 (profile document); see request R-1 |
| PF-8 | **Boot check** in `REAL_PRODUCTION`: the Core reads its own no-new-privileges state from the process table and names a Core that runs without it. It makes the benefit observable, as AD-09 (1) does for the core-file limit | row 80 or 81; see request R-1 |
| PF-9 | **No sudoers line for the helper exists on the host.** A check of the hardware package, read by the user (the service user cannot read that directory). It extends `9A/H-27`, which already asks for "no input-av ... sudoers line" | rows 125, 127 |
| PF-10 | **A self-test, if row 104 builds one** (5.4 step 5 allows "the helper's self-test verb or a dry mode"), is reached by root directly during installation, never through the socket: the socket's grammar stays the two verbs | row 104, row 127 |

---

## 6. Effect on the rows, per row

### 6.1 The four rows of the verification cell

| Row | Cell today | Effect of the chosen form | Its verification cell |
|---|---|---|---|
| **104** `[WP-19a]` the helper as a file for the user to install (`identification/03_implementation_blueprint.md:227`) | "the nine self-enforced bounds of S13-08, tool paths as constants, the test copy made by a build step" | (a) The helper takes its request from standard input by PF-3 and accepts no argument. (b) It answers by PF-4. (c) It identifies its caller by PF-5. (d) **The deliverable becomes three files:** the helper, the socket unit, the template unit (PF-1, PF-2); all three have constants only and are covered by the hash test (PF-6). (e) Its tests feed a line on standard input; no socket and no init system is needed to test the nine refusals. (f) If H-S fails, the removal timer of S13-10 (a) is scheduled by the helper through the init system | "refusals 9 of 9" stays. Added by the form, as further tests and not as a change of the nine: an argument is refused; a second line is refused; an over-long line is refused; a peer that is not the Core's user is refused. "its hash is recorded" becomes three hashes, or one hash over a stated list |
| **105** `[WP-19b]` the Core's one caller behind a platform seam (`:228`) | "against a helper double: 1 intent and 1 result entry per action; ... with its configuration key" | (a) The caller **connects to the socket**; it starts no process and builds no argument list, so no value from the database or from a device can reach an argument (the stricter reading of the rule AD-07 (2) states for the audio helper). (b) It writes the one line of PF-3, reads the one line of PF-4 under a time bound, and maps the closed set of codes; an unknown answer, a closed connection or a time-out is a named failure and still gets its result audit entry (S13-10 (c)). (c) A missing socket, or a refused connection, is the named refusal "helper not installed", distinct from "not available on this host". (d) The configuration key, if the row keeps one, holds the socket path; this row recommends a constant instead, because a configurable path lets configuration point the Core at another socket (DRIVER DECISION D-2). (e) The helper double of the tests is a UNIX socket server in a temporary directory | unchanged in count: 1 intent and 1 result entry per action; the two refusals as stated |
| **81** `[WP-20]` boot checks of the delivered programs (`:204`) | "helper and grant root-owned and not writable by the service user, the interface file agreeing with the database row; all on fixture outputs" | "The grant" is now: the socket node (owner root, the dedicated group, mode 0660, its directory root-owned and not writable by the service user) and the two unit files (owner root, not writable by group or others). The check reads them through the injected command runner of row 80, on fixture outputs. A socket of mode 0666, a socket owned by the service user, or a unit file the service user can write is a named refusal. The file-against-row check is unchanged. PF-8 (the Core's own no-new-privileges state) is a fifth check if the controller grants request R-1 | "each of the 4 checks has a passing and a failing fixture, 8 tests" stays: the grant is still one of the four. With R-1 granted: 5 checks, 10 tests |
| **127** `[WP-27]` procedure, chapter helper installation (`:250`) | "the ten steps of `verification/02_security.md` section 5.4 as steps for the user, each with its command and the line that shows it took effect, the file's hash printed" | Step 4 is written in its "root service" branch only; the sudoers branch is not written (it would be written with the exception row, if ever). Steps 1, 6, 8 and 9 change with it. Section 7 gives the ten steps. "Steps run by an agent: 0" stays | "steps 10 of 10; the printed hash equals the hash recorded by row 104" stays, with the hashes of the two unit files added |

### 6.2 Other rows touched (not in the verification cell; for the controller to route)

| Row | Effect |
|---|---|
| 76 host profile document | PF-7: the Core's unit names `NoNewPrivileges=yes` and the empty capability set, each with its check line; the dedicated group; the directory under `/run`. The row's cell (`:199`) names the core-file limit but neither of these. **Request R-1** |
| 77 profile scripts | print-only mode shows the group creation and the unit installation as steps for the user; no script runs them |
| 79 container checks | the helper's request parsing can be run in the container against stand-ins, as on the Mac; the socket unit itself needs an init system, which a container build does not have: it stays a check of the hardware package |
| 80 host checks | PF-8 if granted; else unchanged |
| 106 alias lifecycle | unchanged in behaviour; every call goes through row 105's caller, so the boot sweep also uses the socket |
| 119 security review of the commissioning functions | rates the form as built: PF-1 to PF-6, and whether the Core's unit of the profile really sets PF-7 |
| 125 procedure, host chapter (`9A/H-05`, `H-27`) | H-05's steps read "the user installs the helper, the two unit files and the interface file" in place of "the sudoers line" (`masterplan/02_plan.md:547`); PF-9 |
| 128 scripts, host group | a read-only collector prints owner, group and mode of the socket and the unit files, and the Core's no-new-privileges state; it calls no `sudo` |

---

## 7. Consequences for the user's installation step (UA-3; `verification/02_security.md` 5.4)

The user still installs as root, once, after the security review of row 119 (U12 B5). What changes is what is installed. Every command is the user's; names are those of section 5 and are fixed by rows 104 and 127.

| Step of 5.4 | With the chosen form | Line that shows it took effect |
|---|---|---|
| 1 Before installing | The procedure prints three hashes: the helper and the two unit files | the user's own hashes equal the printed ones |
| 2 The helper file | unchanged: owner root, group root, mode 0755, every parent directory root-owned, not a symbolic link | owner, group and mode as stated |
| 3 The interface file | unchanged: one line, root-owned, mode 0644; the user confirms it is not the interface of the default route | the file's one line; the default route's interface differs |
| 4 **The privilege grant** | **No sudoers file.** The user creates the dedicated group and adds the Core's service user to it; copies the two unit files into the system unit directory, owner root, mode 0644; has the init system check them (its verify command stands where the sudoers syntax checker stood); reloads; enables and starts the socket unit | the socket unit is active; the socket node reads owner root, the dedicated group, mode 0660; the group has exactly one member |
| 5 Prerequisites | unchanged: the conflict-check tool present; the helper's dry mode run once by root, directly (PF-10) | the expected text |
| 6 Proof of the bound | The nine refusals of S13-08 are sent **through the socket, as the service user**, with one named client command. Row 127 names it; this row recommends a small read-only script delivered with the hardware package (row 128) over a tool that may not be installed (HP-3). Two more proofs belong here: a connection from another account is refused by the socket's mode; and, as the service user inside the Core's unit, a set-user-ID program gains nothing (V-3) | nine refusal codes; nine journal lines naming the service user; "permission denied" for the other account |
| 7 Firewall | unchanged | as 5.4 |
| 8 The Core's boot check passes | checks the socket node and the unit files (row 81), the interface file against the row, and, if R-1 is granted, the Core's own no-new-privileges state | the boot's check lines |
| 9 Removal | stop and disable the socket unit; remove the two unit files and reload; remove the helper, the interface file and the group; list any marked address left behind | the socket node is gone; the list is empty |
| 10 Record | unchanged: a decision row with the date, the host and the hashes | the row |

**What is easier for the user:** no sudoers file, so no risk of a sudoers syntax error that locks `sudo` on the host. **What is more:** one group, two unit files, three commands of the init system. **What the user gains:** the two option lines on the Core's unit that input-av could not have.

**Checks this decision adds to the hardware package (track H):**

| Check | Proves | Pass criterion |
|---|---|---|
| V-1 | the grant as installed | socket node: owner root, the dedicated group, mode 0660; unit files root-owned, mode 0644; no sudoers line names the helper (PF-9) |
| V-2 | the Core's unit keeps what the decision is for | the init system reports `NoNewPrivileges=yes` and an empty capability bounding set for the Core's unit; the Core's process table entry reads the no-new-privileges state as set |
| V-3 | fact 3 on this host | as the service user under the Core's unit options, a set-user-ID program does not gain root |
| V-4 | the helper still works from inside that unit | one `add` and one `del` through the Core's operation succeed on the camera interface (this is `9A/H-06`, run with V-2 in force) |

---

## 8. Risks, and what a later change costs

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The helper cannot read the peer's user id in the language row 104 chooses (HP-1) | Medium | PF-5's second line of defence is weaker; the journal's "calling user" is missing | Row 104 picks a language or a small wrapper that can read it from the connection; if it cannot, it returns `needs-review` and says so. The socket's mode and group still hold |
| The socket unit is misinstalled with the default mode 0666 (fact 6) | Low | any local account can ask for `add` and `del`; the nine bounds still hold, the role and the audit of the Core do not | The unit file states the mode as a constant under the hash; boot check of row 81 names it; V-1 |
| The service user floods the socket | Low | the init system stops the socket; the commissioning function is unavailable, recording is not affected | PF-1's limits; a stopped socket is the named refusal "helper not installed" and a boot-check line |
| A hardening option of the Core's unit breaks the capture path (audio device, run directory, the relay) | Medium | the Core does not record on the real host | PF-7 asks for two options only; anything more is the profile's (row 76) with its own check. V-4 and `9A/H-17` run with them in force |
| The form is reversed after row 104 is built | Low | the helper's request reader, row 105's caller and step 4 of the procedure are rewritten; the nine bounds are not | The helper keeps "read the request" apart from "validate and act", so that only the first changes |
| The exception path is used casually | Low | S13-09 returns unseen | The exception is a decision row confirmed by the user, with the content of section 4 |

**What stays unproven at the end of track D and goes to the hardware package:** the socket activation itself, the socket node's ownership as the init system creates it, the Core's unit running with PF-7 while it records, the refusal of a foreign account, and V-1 to V-4. On the Mac the proof is: the helper against stand-ins with a line on standard input, and the caller against a socket double.

---

## 9. Hypotheses, driver decisions, request

**Hypotheses** (each to be settled on the Ubuntu 24.04 host or container; none is needed for the choice itself):

| Id | Statement | Settled by |
|---|---|---|
| HP-1 | For a UNIX stream socket with one instance per connection, the init system of Ubuntu 24.04 puts the peer's process id and user id into the instance name, so that even a shell helper could read its caller from a value the init system wrote. This row's recollection of that init system; the manual page fetched does not say it (it names only the option that passes credentials with a message, and a variable that holds the peer's socket path). Until it is shown, PF-5 is met by reading the peer's credentials from the connection itself | row 104's first step, or `9A/H-05` |
| HP-2 | Several sandbox options of a unit that runs as a non-root user turn the no-new-privileges state on by themselves, so that the `sudo` form would cost the Core's unit those options as well. This row's recollection; two reads of `systemd.exec(5)` on 2026-10-12 did not find the sentence, so it is NOT used as a reason in section 4 | reading the manual on the host; row 76 |
| HP-3 | A command that can write one line to a UNIX socket and print the answer is present on a default Ubuntu 24.04 installation | row 127; avoided by delivering a small script |

**DRIVER DECISIONS (conservative; for the controller to confirm).**

| # | Decision | Alternative not taken |
|---|---|---|
| D-1 | One instance per connection (O-1), not a daemon (O-2) | A daemon with its own accept loop |
| D-2 | The socket path is a constant of the delivered files and of the Core, not a configuration key; row 105's "with its configuration key" then applies to what else that row configures | A configurable path |
| D-3 | A dedicated group with one member, not the service user's primary group | "group the Core's" read as the primary group (`verification/02_security.md:208` does not say which) |
| D-4 | The self-test is not a verb of the socket (PF-10) | A third verb |
| D-5 | PF-7 and PF-8 are stated as part of the decision, although no row's cell carries them today: without them the chosen form buys nothing | Leaving the Core's unit options to the host profile's own judgement |

**Request to the controller, R-1** (one line is in `delegation_progress/file_requests.md`): the blueprint has no row that (a) names `NoNewPrivileges=yes` and the empty capability set for the Core's unit in the host profile (row 76's cell names the core-file limit only), (b) checks the Core's own no-new-privileges state at boot (row 80 or 81), or (c) owns the two unit files (this row proposes row 104, beside the helper). Not blocking for rows 104 and 105.

## 10. Verification cell of row 103, checked

| Cell (`identification/03_implementation_blueprint.md:226`) | Result |
|---|---|
| One form chosen with its reason | O-1, a root service on a local socket; section 1 (the row) and section 4 (five reasons) |
| The effect on rows 104, 105, 81 and 127 stated per row | section 6.1, four lines; the installation steps of row 127 in section 7 |
| `sudo -n` only with a written reason | section 1 and section 4: an exception row with stated content, confirmed by the user; none known for Ubuntu 24.04 |

---
*Generated: 2026-10-12 22:50 WIB*
*Last Updated: 2026-10-12 22:50 WIB*
