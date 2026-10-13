---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-13
agent: security-review
blueprint_row: 119
milestone: M10
type: security review of the commissioning functions AS BUILT (helper, caller, lifecycle, destination rule, scan, set-IP job, acceptance record)
narrative_tier: 1
baseline: head 0f5d2a8e, branch task4/input-av-core-port; the work reviewed is UNCOMMITTED in the working tree (559 changed paths)
verdict: CAUTION
fail_count: 0
caution_count: 12
requirements_rated: 48 (PASS 35, CAUTION 12, ONLY A HOST CAN SHOW 1)
helper_statement: REFUSED for the delivered hash 62c0b726...; conditions to make it in section 2
status: complete
---

# Row 119: security review of the commissioning functions as built

## 1. Verdict

**Overall: CAUTION. FAIL: 0. The work does not stop for the user.**

Nothing found lets a caller leave the bounds the design set. The helper refuses what it must refuse on an Ethernet camera port, the Core dials only what the one destination rule admits, the typed camera account is in one closure and in no record, and no device text reaches a log, an audit detail, an error or a stored row. Twelve cautions remain. Each has a concrete change and a row. Three of them are gates:

| Gate | Caution | Before |
|---|---|---|
| G-1 | R119-01 (the helper takes a conflict tool that did not ask as "free") | the user's installation of the helper (UA-3); it moves the helper's hash |
| G-2 | R119-03, R119-04 (the scan says "one device, no conflict" without having counted; the hardware address the technician saw is not bound to the job) | the first set-IP run on hardware (`9A/H-13` to `H-15`) |
| G-3 | the endpoint count (amendment SR-13 or an equal source) built and `9A/H-15` passed | a real installation with more than one factory-address camera |

**The statement of the cell is REFUSED** for the helper as delivered today (section 2). It is refused narrowly: one bound of nine, and a change of a few lines.

What would turn a CAUTION into a FAIL: installing the helper of today's hash on an installation and using it there before R119-01; a set-IP run on a site with several factory cameras powered at once before G-3.

## 0. Frame (5W1H), method, limits

| Question | Answer |
|---|---|
| **What** | The commissioning functions as built: the root address helper with its two unit files; the Core's socket client, caller, journal, lifecycle and job port; the destination rule and its binders; the commissioning scan (operation 103); the alias operations (104, 105); the set-IP job (106, 107) with the set-network file; the two commissioning rows of the helper table; the installation acceptance (109, 110); the web form of set-IP |
| **Why** | Blueprint row 119: "verdict PASS or CAUTION with each caution routed to a row; a FAIL stops the work for the user; the statement 'S13-08 to S13-10 are closed in the helper as delivered' is made or refused". Step 1 of the helper's installation procedure (`verification/02_security.md` 5.4) waits for it; decision C49 (1) makes the helper part of every production start |
| **Who** | security-review, read-only on source. Rulings asked by name by the controller: C53 (4), C74, C82, C85, C90 |
| **When** | 2026-10-13 16:11 WIB, after rows 104 to 118 and 111b, before any hardware run |
| **Where** | `/Users/gsp-budi/Documents/DEMS`, working tree. Paths below are relative to it; `CS/` = `apps/core-server/src/` |
| **How** | Reading the code named in section 9, each requirement rated against a file and a symbol. ONE check was run: the helper's own unit suite on doubles (section 9). No suite, no database, no port, no `ip`, `ping` or `arping`; nothing installed; no credential or key file opened |

**Limits, stated plainly.**

- Nothing here is proven on Linux, on systemd or on a camera. Section 8 lists what only a host can show, by check name.
- Read in full: the helper, the two unit files, `make_test_copy.py`, `CS/host-alias-socket.ts`, all of `CS/capture/host-alias/`, `destination-rule.ts`, `stored-address.ts`, `onvif-network.ts`, the commissioning parts of `fence/production-parts.ts` (`:104-245`, `:379-677`), `factory-scan/service.ts` and `routes.ts`, `camera-network/service.ts`, `routes.ts` and the mount, `installation-acceptance/service.ts`, `host-alias/service.ts`, the commissioning rows of `mic-helper-args.ts` (`:329-436`) with their static rule (`capture/__tests__/static.test.ts:1180-1269`), `capture-composition.ts:330-773`.
- Read by search only (named lines, not the whole file): `network/*` (operations 101, 102), the ONVIF time reader behind the unauthenticated poll, `capture/boot/host-checks.ts` and `program-checks.ts`, the two contract files, the web form `set-ip.tsx` (header and submit path `:1-36`, `:150-262`), the acceptance store, the records 096, 099, 102, 106b, 106c, 108, 109, 112, 114, 116. A statement that rests on a search says so.
- The static suite was not run. Where a row says "held by static rule", it is the rule's text that was read, not a green run.

## 2. The statement: "S13-08 to S13-10 are closed in the helper as delivered"

**REFUSED** for `scripts/host/netalias/dems-core-netalias`, SHA-256 `62c0b7260a743224de455892ddb12c7cee8ce0c1907c1e9f89291ff35c2ee5fb` (the three hashes of `SHA256SUMS` equal the files in the tree: `shasum -a 256`, 2026-10-13).

| Item | State in the helper as delivered |
|---|---|
| S13-08 bounds 1, 2, 3, 5, 7, 8, 9 | closed (section 3, rows 1 to 9) |
| **S13-08 bound 4** | **not closed: R119-01** |
| S13-08 bound 6 | closed for the caller S13-08 names; one hardening, R119-02, rides the same change |
| S13-09 | closed as a form: PF-1 to PF-6 of `decisions/103` are in the three delivered files; PF-7 and PF-8 are in the host profile and the boot checks |
| S13-10 (a) | conditional by its own text ("if H-S fails"). The helper relies on the kernel lifetime alone (`:545-550`); no timer of the service manager is built. Closed by `9A/H-06` passing, or by a further helper change if it fails |
| S13-10 (b), (c) | closed in the Core (rows 14, 15) |

**Why bound 4 is not closed.** S13-08 (4) reads "runs the conflict check always and refuses when the tool is missing"; it exists because input-av skipped the check "without a word" (B-3). The helper starts `arping -D -q` and reads only its exit status (`dems-core-netalias:537-544`): 1 is "in use", 0 is "free". The container run of row 79 measured that the packaged tool answers **0 without asking** on an interface that cannot be asked: "`arping -D -c 1 -w 1 -I lo 192.0.2.1` prints `Interface "lo" is not ARPable` and ends 0 ... the exit code alone does not tell 'free' from 'this interface cannot be asked'" (`test/079_linux_container_checks.md:91`; "Request line filed"). The Core's echo row was corrected for exactly this finding (C90: "judged by its STATED result"); the helper was not, and nothing in it reads the interface's flags (`grep -n "ARPable\|NOARP\|flags" scripts/host/netalias/*`: no line). On an interface with the loopback or no-ARP flag the helper therefore adds the address with no conflict check and says `0 OK`.

Reach: the interface is named by a root-owned file, so the service user cannot cause this; it needs a wrong line in that file (`lo` passes the name pattern, exists under `/sys/class/net` and carries no default route). It is a fail-open on a tool that did not do its work, in the one program that runs as root, and the cheapest moment to fix it is before the user installs a hash.

**The statement is made when:**

1. R119-01 is in the helper: an interface whose kernel flags say loopback or no-ARP, or that is not up, is a named refusal before the conflict tool is started; one test per case on the double.
2. R119-02 is in the same change (recommended, not a condition).
3. `SHA256SUMS`, record 104 and the procedure chapter of row 127 carry the new hash.
4. The procedure states S13-10 (a) as it is: closed only when `9A/H-06` shows the kernel removing the address with the Core killed; if it fails, the helper changes again and the function is not used (S13-10 (d)).

A re-read of the changed helper by this agent type is enough; the other 45 rows of section 3 do not need to be repeated.

## 3. Requirements rated against the built code

PASS 35, CAUTION 12, only a host can show 1. `HP` = `scripts/host/netalias/dems-core-netalias`.

### 3.1 The helper as delivered

| # | Requirement | Built at | Rating |
|---|---|---|---|
| 1 | S13-08 (1): verb and one address; interface from the root-owned file, pattern, kernel list, not the default route | `HP` `parse_request:348`, `configured_interface:235` (folder and file by `lstat`, owner 0, no group or other write, `O_NOFOLLOW`, first character alphanumeric, `\Z`), `default_route_interfaces:416`, `installation:508`. The lifetime is a third token, bounded 5 to 480 (record 104 D-3): accepted | PASS |
| 2 | S13-08 (2): RFC 1918, `/24`, host part 1 to 254 | `checked_address:324`; leading zeros refused (`parse_quad:308`) | PASS |
| 3 | S13-08 (3): refusal on another interface's subnet; a limit of marked addresses | `add:531` with `overlaps_slash24:453` (the shorter prefix decides, so a `/8` on another port refuses its whole range); `MAX_MARKED = 1`, narrower than the 2 asked | PASS |
| 4 | S13-08 (4): the conflict check always runs | `add:537-544`: started always, tool missing refuses (`:513`); **exit 0 of a tool that did not ask is read as "free"** | **CAUTION R119-01** |
| 5 | S13-08 (5): marked as its own, lifetime bounded by itself | `write_mark:479` (`O_EXCL`, before the add), `valid_lft` / `preferred_lft` `:548`; a refused add drops its mark, an unanswered one keeps it `:551-557`. That the kernel expires it: `9A/H-06` | PASS |
| 6 | S13-08 (6): `del` removes only an address it marked | `delete:560`: the mark, then the address on the camera interface with `/24`. A mark outlives the address it marked until the next `add`, a `del` or a reboot; its two stored numbers (when, how long) are never read | **CAUTION R119-02** (low) |
| 7 | S13-08 (7): absolute tools, own search path, nothing from the environment, no evaluation | constants block `:58-74`; `run_tool:383` (no shell, two fixed variables, `cwd=/`); interpreter `-I -S -B`; no read of `os.environ`. Suite `Bound7NoInjectionPoint` | PASS |
| 8 | S13-08 (8): one journal line per call: caller, verb, address, result | `main:595-614`; the address is printed only after `checked_address`; the line is written after the act (a unit killed at its 30 s leaves the service manager's own line). Seen in a journal: `9A/H-05` | PASS |
| 9 | S13-08 (9): fixed codes, no text of the caller | `CODES:94` (36), `Refusal:145`, `os._exit(code)`; the Core's copy `CS/capture/host-alias/protocol.ts:22` is equal name by name | PASS |
| 10 | S13-09, the form (C19; PF-1 to PF-6) | `.socket`: root, group `dems-netalias`, 0660, `Accept=yes`, `MaxConnections=1`, per source 1. `@.service`: no arguments, capabilities bound to two, no new privileges, read-only system, 30 s. Peer by `getsockopt` on descriptor 0 `HP:256`, expected user = the ONE member of the group, never root `:207-232`. Test copy by a build step, hash test | PASS |
| 11 | S13-09, what the form buys (PF-7, PF-8) | `scripts/host/HOST-PROFILE-UBUNTU-24.04.md:111-112,240-241` (`NoNewPrivileges=yes`, empty capability set); boot check `CS/capture/boot/host-checks.ts:203-209` (`NoNewPrivs`), `:277-285` (socket node). By search | PASS |
| 12 | C53 (4c): a production start refuses a configured socket path that is not the constant | not built: the client dials `app.config.captureAliasSocketPath` (`CS/capture-composition.ts:640`), the boot check asks the constant (`host-checks.ts:180`). Bounded today by the client's own check: root-owned node, mode 0660, root-only folder (`CS/host-alias-socket.ts:111-127`) | **CAUTION R119-10** (low) |
| 13 | S13-10 (a): removal scheduled by root if H-S fails | not built; conditional. `9A/H-06` | **ONLY A HOST** |
| 14 | S13-10 (b): the boot sweep | `CS/capture/host-alias/lifecycle.ts:369-406`: every open row, every alias-class address the camera port holds, every address the configuration can produce, each with `BOOT_SWEEP` and its two entries. Residual of C74 accepted (item (c), section 4) | PASS |
| 15 | S13-10 (c): intent before, result after | `caller.ts:421-444` (no intent, no line: `INTENT_NOT_RECORDED`); `journal.ts:156-242`; the row is opened with the intent, so a Core that dies leaves an open row | PASS |
| 16 | S13-16 (1): no test door in the delivered file | `make_test_copy.py` (target outside the folder, exactly eleven names, each once); the suite ran today: `Ran 58 tests in 18.445s`, `OK` | PASS |

### 3.2 The caller, the lifecycle, the destination rule

| # | Requirement | Built at | Rating |
|---|---|---|---|
| 17 | Nothing free-form reaches the helper; an answer is a pair of the table or one fixed word | `protocol.ts:147-173`; `host-alias-socket.ts:87,130` (the line is checked again before it is dialled); `caller.ts:384-397` | PASS |
| 18 | DR-4 and the file-against-row agreement, before any line | `caller.ts:253` (`interfaceAgreementRefusal`), `:283` (`wrongNetworkRefusal`): an unreadable fact refuses | PASS |
| 19 | DR-1: an `add` and the technician's removal only while idle | `lifecycle.ts:68,321,360`; again inside the unit of the intent `journal.ts:165,181`; a state that cannot be read is "not idle" `:230-237` | PASS |
| 20 | The removal reason of a row is true | two call sites are not: item (d), section 4 | **CAUTION R119-05** (low) |
| 21 | S13-11 (1): literal only, private, none of the special classes, not the host's | `destination-rule.ts:249-260` (`classify`), `:352`; names, mapped and abbreviated forms have their own refusal `:234-246` | PASS |
| 22 | S13-11 (2): not another interface's subnet; made FROM the source the rule names; no fallback | `:353-366`; the source is bound at each dial: `onvif-network.ts:359` (`localAddress`), `production-parts.ts:168,207` (the poll and the probe refuse a target without a source) | PASS |
| 23 | S13-11 (3): port from the stored list; path fixed; bounded answer | `destination-rule.ts:326-334`; `stored-address.ts:144`; `onvif-network.ts:68-75`. Redirects and bounds of the time reader: by its row's own review, not re-read here | PASS |
| 24 | S13-11 (4): one job and one scan at a time, 32 plus 1, spacing | one shared turn: `camera-network/service.ts:549` claims the scan's gate; `factory-scan/service.ts:292-315,552,570`; a clock that went back is refused for the whole interval | PASS |
| 25 | S13-11 (5): named fields only, no raw body, no link from device text | `factory-scan/service.ts:498-509`; what a probe throws is never read `:510-512` | PASS |
| 26 | S13-11, set-IP: new address inside the camera subnet, not the Core's, the gateway's or a registered camera's; prefix from the configuration; no DHCP; reboot only when asked | `destination-rule.ts:411-450`; `onvif-network.ts:534` (`DHCP: false` literal), `:558` | PASS |
| 27 | AD-02: the stored address through the same rule at every use; no permissive value in `src/` | `stored-address.ts:176-209`; binder `production-parts.ts:61-75`; `STORED_CAMERA` never takes an alias as its source (`destination-rule.ts:104,363`) | PASS |
| 28 | The two commissioning rows carry literals and ONE address made from four integers (SR-12) | `mic-helper-args.ts:411-429`; one caller, `production-parts.ts:635,644`, after `admitted()` `:604-615` | PASS (item (b)) |
| 29 | "Nothing answers at the new address" is known, not guessed | `production-parts.ts:663-673`: unknown refuses; but one request and one second, and an entry still being resolved counts as silence: item (f) | **CAUTION R119-06** (low) |

### 3.3 The scan, the set-IP job, the credential

| # | Requirement | Built at | Rating |
|---|---|---|---|
| 30 | DR-6: the conflict flag is enforced by the Core | the refusal exists (`camera-network/service.ts:605-607`) and has no production input: the production probe answers two members (`production-parts.ts:161-171`), so `endpointCountOf(undefined)` is 1 and `conflict` is `false` for every device (`factory-scan/service.ts:364-368,495-503`). **The answer states a count nobody made** | **CAUTION R119-03** |
| 31 | S13-12 (a): no device text in a log, an audit detail or an error | scan: one audit entry of counts `:650-663`, log of counts `:664-677`; job: `:692-698,927-942`; alias: `journal.ts` (one IPv4 literal, codes, minutes); `onvif-network.ts:228-239` reduces every failure to a word of a closed list | PASS |
| 32 | S13-12 (b): every device string bounded, held to a character rule, stripped | `announcedTextOf` `factory-scan/service.ts:339-362` (no production input today); hardware addresses by one pattern `:380`, `camera-network/service.ts:341`, `production-parts.ts:445,482`, `onvif-network.ts:268` | PASS |
| 33 | S13-12 (c): parse and exception guards; a token with markup never written back | `onvif-network.ts:203,529` (token form or no set request), `:353-387` (one agent, watched sockets, byte cap), `:454-474` (callback once), `:566` | PASS |
| 34 | S13-12 (d): the technician sees the neighbour table's hardware address BEFORE typing; the device's own after sign-in; a mismatch stops | after sign-in: held (`camera-network/service.ts:842-845`, no set request). Before typing: the form shows the SCAN's address, the job reads the table again and pins what it finds then (`:818`); the two are never compared, and a row without a hardware address may still be confirmed (`set-ip.tsx:416`, `confirmNoMac`) | **CAUTION R119-04** |
| 35 | C1, C7, DR-8: typed for one job, one closure, never written, logged, argued or reused | `camera-network/routes.ts:58-60` (one read, sealed, taken off the body); `service.ts:501-513` (`holdTypedAccount`), `:556` (every refusal drops it), `:831-855` (one call), `:911`; nothing typed goes to the new address `:879-897` | PASS |
| 36 | "When the call ends the two values are taken off the client object" | true on every path but one: item (e), section 4 | **CAUTION R119-09** (low) |
| 37 | S13-04: the unauthenticated poll first; this job spends from the ONE lock-out count | `service.ts:805`, `:609-617,670-672`, `:862-868` (an answer of no form counts as a refused sign-in) | PASS |
| 38 | The web form keeps the account in two uncontrolled inputs, emptied on every way out | `apps/core-web/src/features/commissioning/set-ip.tsx:160-262`; names and `autocomplete` `set-ip-model.ts:52-54`. By its header and submit path | PASS |
| 39 | U10, DR-9: TECHNICIAN only, web console only, checked on the server | `packages/shared/src/sim/auth.ts:74-84` (the one role); `capture-commissioning.ts:478` (`CAPTURE_COMMISSION_ACCESS`); each route by `routeOfOperation` | PASS |
| 40 | DR-11: one chain, intent and result for a network set | `service.ts:692-698` (`REQUESTED` before anything is asked), `:927-942` | PASS |

### 3.4 The acceptance record, the amendments, the procedure

| # | Requirement | Built at | Rating |
|---|---|---|---|
| 41 | S13-13: closed key lists, the denied names, size bounds | `packages/shared/src/api/installation-acceptance.ts:82,290,307,331` (strict at every level); the table's CHECKs behind it (record 117: 23514 by name) | PASS |
| 42 | The step list of an acceptance has a stated source | none: item (h) | **CAUTION R119-07** |
| 43 | Nothing is gated on an acceptance | `installation-acceptance/service.ts:42-43`; the folder has no reader (record 117 DD-7) | PASS |
| 44 | A clock that went back is a named answer | `500`: item (i) | **CAUTION R119-08** (low) |
| 45 | SR-10 | `capture-composition.ts:735-742`; `credential-store/__tests__/static.test.ts:27-32,99-104` | PASS, confirmed |
| 46 | SR-11 | `CS/index.ts:120`; `capture-composition.ts:634-636`; `static.test.ts:1541-1605` | PASS, confirmed |
| 47 | The procedure text for two cameras on one address | "ONE factory-address camera is connected at a time" is not enough by itself: item (a) | **CAUTION R119-11** |
| 48 | C49 (1): the helper is part of every production start | built as ruled; the side is questioned: item (j) | **CAUTION R119-12** |

## 4. The items put by name

### (a) The conflict flag (C90) - the first question

**Facts.** The case the functions exist for is several factory cameras on one default address. The production scan asks each address once by a unicast clock read and states `endpointCount: 1`, `conflict: false` for whatever answers (row 30). The job refuses on `conflict` and never meets one. The driver's reasoning that a unicast question cannot count is sound and was not measured: frames go to the one hardware address the neighbour table holds. A multicast WS-Discovery probe sent from the alias address is the source that can count (each device answers with its own endpoint reference); that is amendment SR-13, not built.

**What the scan must state when it cannot tell.** "Not known", never "one". Today's answer is a statement of fact the Core did not observe, on the screen and in the memory the job reads. The contract gains the unknown value (`endpointCount` and `conflict` nullable, or one member that says whether the count was made); the scan answers it whenever its probe did not count; the screen says in words that the Core cannot tell whether more than one camera answers at this address.

**May set-IP proceed on the hardware-address checks alone?** Yes, under three conditions; it need not be refused until the flag is real.

Why it may: follow two cameras A and B on one address. The table holds one hardware address, say A's. The job polls, reads A's address from the table, signs in to whatever holds the address, and makes no set request unless the device itself states the address the table held (`service.ts:842-845`). It then waits for THAT address at the new place. If the table flips to B between the interface read and the set (two connections), B is moved, A's address never appears at the new place, and the job ends `NOT_FOUND_AT_NEW_ADDRESS` with the address that did answer in its audit entry. The worst end is: a factory camera other than the one meant now holds the new address, and the Core says the job FAILED. No registry row is written by the job (`deviceId` is always null; operation 100 confirms with the operator), nothing is recorded, no session is open. The harm is bounded and stated, and refusing would withhold the function the user ruled is needed (U6).

The conditions:

1. **R119-03**: the scan says "not known" (above), and the job's answer and its audit entry say that the count was not made.
2. **R119-04**: the hardware address the technician saw is BOUND to the job. Operation 106 takes the address the scan showed; the job refuses with `MAC_MISMATCH`, before the account is used, when the table now holds another; a row without a hardware address cannot be started. Today the form shows one reading and the job pins a later one. This is also the first observable sign of two devices on one address: a table entry that changes between two readings.
3. **R119-11**: the procedure (below). And the last scan must be recent: `lastScanOf` has no age (`factory-scan/index.ts:147-149`), so a scan made before the second camera was plugged in still admits the job. A bound of a few minutes belongs to R119-03.

**What the procedure must say, and whether it is enough.** "One factory-address camera connected at a time" is a rule a person keeps, on the day cameras arrive in a box and a PoE switch powers all of them at once. It is enough for the bench test this task ends in (U20 (5)) together with conditions 1 and 2. It is NOT enough for a real installation: there the count must be real (gate G-3). The text, as steps:

- power ONE camera that still has a factory address; the others unpowered (on a PoE switch: their ports off), not merely unplugged from the Core;
- scan; compare the hardware address on the screen with the label on the camera BEFORE typing the account; do not start when the screen shows none;
- after the job, scan again: the factory address must be silent before the next camera is powered;
- the screen states that the Core cannot tell two cameras on one address apart; a job that ends `MAC_MISMATCH` or `NOT_FOUND_AT_NEW_ADDRESS` means: stop, power everything off but one;
- two refused sign-ins at one factory address close the guard for that ADDRESS for 30 minutes, whichever camera was meant (the guard is keyed by address: the safe side, and the technician must know it).

**SR-13** is supported by this review as an amendment to take: one more discovery call, sent from the alias address only, used only to count distinct endpoint references for addresses of the scan, bounded in size and time, keeping no device text. It is the controller's to rule.

### (b) The named amendments

| Amendment | Verdict | Basis |
|---|---|---|
| **SR-10** (`capture-composition.ts` among the credential store's users, for `capture.open`) | **CONFIRMED** | The one use is `opened.store.capture.open(deviceId, sealed)` (`:735-742`), for the stored credential of an adopted camera. The commissioning functions do not touch the store: the typed account never enters it. The purpose test holds a second use (`static.test.ts:99-104`) |
| **SR-11** (the entry hands a host command runner of the same maker to the composition, to read the helper's interface file) | **CONFIRMED** | Two runners of one maker is the stricter form (C85). One use, one fixed row (`/usr/bin/cat /etc/dems/netalias-interface`), `linux` only; a second use fails the rule's control. The answer is held to one interface name (`facts.ts:89-97`) and only compared |
| **SR-12** (the two commissioning rows may carry one validated dotted address) | **CONFIRMED** | The argument is written from four integers by one table function, after the destination rule returned the address; it cannot begin with a dash, carry a separator or be a name; no interface is an argument; one caller. The static rule pins both door calls and plants six controls |

None is reversed. SR-10 and SR-11 were also put to row 86; this is the commissioning half.

### (c) Driver decisions of rows 105 and 106

| Decision | Verdict |
|---|---|
| 105 D-5 (C53): a removal skips the destination guard and the file-against-row agreement | **Confirmed.** The helper removes only what it marked on the interface of its own file; holding a removal back can only leave an address up |
| 105 D-8: the 35 s bound | **Confirmed.** The helper's longest path is 28 s (5 + 5 + 5 + 8 + 5) inside the unit's 30 s; the Core waits past it and reads the answer only when the peer closed |
| 105 D-4: no audit entry for a refusal before the call | **Confirmed** for S13-10 (c): nothing was done, so there is no act to bracket. Note N-1: a TYPED address the rule refuses is the one refusal worth a log line with its code and no address; today it is a `422` and nothing else |
| 105 D-1, D-3, D-6, D-7, D-9, D-10, D-11 | Confirmed as recorded. D-9 is the conservative reading of the helper (a refused `ip` add is in fact "not done"; treating it as unknown costs one extra removal) |
| 105 D-2: a configuration key, not the constant | Accepted with C53 (4c), which is not built yet: R119-10 |
| 106 D-1 (C74): system removals run while a session is open | **Confirmed.** A stored camera is never dialled from an alias (`destination-rule.ts:104`), so taking the alias away cannot cut a recording |
| 106, the boot sweep cannot list the helper's marks | **Residual accepted.** A marked address in place on the camera port is in the interface table and is swept, with or without a row; what escapes is a mark on another interface than the row names, which needs file and row to disagree, and is ended by the kernel lifetime (at most 480 minutes) and reported at the next `add`. Note N-2: the sweep writes two audit entries per candidate at every boot (eight with the default list); a count in one entry would say the same |

### (d) The removal reasons

The six members do not cover the two call sites truthfully.

| Site | What happens | What is written | What is true |
|---|---|---|---|
| `lifecycle.ts:345` | a removal at once after an `add` whose effect is not known | `JOB_DONE` | no job ran. If the helper answers `NOT_MARKED`, nothing was ever added: `NOT_ADDED` (an existing member). If it answers `OK`, the address may or may not have been there: **a further value is needed** (proposed `ADD_UNCONFIRMED`) |
| `lifecycle.ts:259` | the timer fires and the clock reads earlier than the stored end | `JOB_DONE` | two cases, neither needs a new value. The retry of a FAILED removal re-computes the reason and loses it (a technician's `MANUAL` becomes `JOB_DONE` with no actor): the retry must carry the reason and the actor of the removal it repeats. The lifetime timer itself, read on a clock that went back: `EXPIRED` |

So: **one further value**, and two corrections that use existing members. The audit entries beside the row already tell the story (`HOST_ALIAS_ADD_FAILED` with its code); the row alone does not. R119-05, with the next schema value-set step.

### (e) The typed credential of the set-IP job

| Point | Finding |
|---|---|
| The closure | One variable, emptied by `take` and `drop` (`service.ts:501-513`); the job record has no member for it (`:387-405`) |
| Every path | Every refusal before the job (`:554-559`), the end of the set call (`:851-854`), the job's `finally` (`:911`); the route takes it off the body (`routes.ts:59`). The texts themselves cannot be overwritten in this runtime: the file says so, correctly |
| Digest only | Held: never clear, never Basic. Two digest forms, decided by the device's challenge: HTTP Digest (MD5 or SHA-256, `onvif-network.ts:208,244-248`) and the WS-Security token with a password digest (`:484-494`). A refusal is final: at most one rejected request carries it |
| The unauthenticated poll | One clock read, nothing typed in its reach (`production-parts.ts:200-210`); nothing typed is ever sent to the new address |
| The lock-out guard | The fourth spender, from the same count; asked before anything is sent and again in the turn it is taken |
| The web form | Two uncontrolled inputs, emptied at the press, on cancel, on unmount, on navigation and on `pagehide`; no form element; neutral field names |
| **R119-09** (low) | After a cut (deadline or byte cap) during the gateway step with a reboot asked, `steps()` goes on to `authorizedAsk('SystemReboot')`, which arms the client again (`onvif-network.ts:478`, `armed` was cleared by `finish`), and `finish` does not run a second time. No request can leave (`ask` answers at once when settled `:463-466`; the agent is destroyed), so nothing is exposed; the two values sit on a dead object until it is collected, and the header's sentence is not true on that path. `authorizedAsk` should answer before arming when the call is settled |

One point for the record: the first request with the account (`GetNetworkInterfaces`) goes to whatever answers at the address, before the device's own hardware address can be checked; that is the order ONVIF forces and note SN-4 accepted it. R119-04 puts the technician's comparison in front of it.

### (f) "Free address" by `ping` plus the neighbour entry

Sufficient in kind, weak in count. A host that drops echo requests still answers the address question, or it could not use the address: the kernel then holds its hardware address, and the reader calls the address taken (`production-parts.ts:668`). That is what `arping` would have learnt, without a packet socket in the Core's unit, which is the right trade. What no check finds is a device that is off; the one case that matters, a registered camera that is offline, is refused by the rule itself (`REGISTERED_CAMERA_ADDRESS`).

The weakness: one request, one second, and an entry in state `INCOMPLETE` (still being asked) counts as silence. The helper's own conflict check asks twice over three seconds. A device that is slow to answer its first address question reads as free. **R119-06**: "free" needs the entry in state `FAILED` (the kernel's own three questions), or silence on two attempts; `INCOMPLETE` after one is "not known". `9A/H-14` gains the case of a host that drops echo requests.

### (g) Device text (AD-06, S13-12)

Nothing a device chooses reaches a log, an audit detail, an error or a stored row unsanitised (rows 31 to 33). The scan's three texts have no production input today and would pass `announcedTextOf` on their way to the answer only. The job handles no device text at all: codes, counts and hardware addresses of one form. The interface token is the one device string written back into a request, and only in the token form. Note N-3: `announcedTextOf` drops controls, direction and invisible marks but not U+00AD, U+061C or the tag block; to align when the texts get a real source (with SR-13).

### (h) The acceptance record

**Where the step list must come from: the contract, not a screen.** Today the Core stores whatever codes a client sends: any id of the code form, 0 to 32 of them, each `passed` as the client says (`service.ts:219`; `installation-acceptance.ts:291,299-304`). The web form's six codes are "this console's" by its own header (`acceptance-model.ts:25,94`). A request with `steps: []` from a technician session stores a record that reads "installation accepted", permanently, with an audit entry.

Is such a record acceptable? As the technician's own signed note, yes: it names who and when, and the diagnostics beside it are the Core's own copy. As the step list of an installation acceptance, no. **R119-07**: the list is a closed, versioned set in `packages/shared` taken from the checks of the hardware acceptance package; the Core refuses an id outside it, a missing id, a repeated id and an empty list; the record states the list's version; a step the Core can judge itself (network configured, cameras assigned, the diagnostics run) is stated by the Core, and what a person attests is marked as attested.

The denied key names: held twice (strict schemas; the table's CHECKs). Nothing is gated on an acceptance: held, and it should stay so until R119-07 lands, because the record cannot carry weight before then.

### (i) Row 117: a clock that went back answers 500

Not bending the instant is right: a stored time that is not the clock's would be a false record, and nothing is stored. `500` is the wrong class for a state the Core can name: it reads as a defect and tells the technician nothing. **R119-08**: a named `409` with a reason and no value. Until then it fails closed, which is acceptable. For the record, the alias table takes the other way (`removed_at = GREATEST(now, added_at)`, `store.ts:70`): defensible there, because a row that cannot be closed blocks every later `add`; the audit entry carries the real time.

### (j) The helper is mandatory for every production start (C49 (1))

After seeing it built: **not the right side for steady state.** Two reasons.

1. Least privilege. The helper is a root service the service user can reach at any hour, and the alias functions are used on the days cameras are commissioned or replaced. Its bounds are tight, so the standing risk is small; it is not nothing (a root process that parses a caller's line, and an address the service user can put on the camera port during a recording, which the helper cannot know about).
2. The wrong coupling. A production start is refused when the socket node is absent or not as delivered (`host-checks.ts:277-285`). Recording examinations then depends on a tool recording does not use: a socket unit that failed after an update, or a technician who stopped it on purpose after commissioning, stops the Core from recording.

**R119-12, recommended for a ruling:** present and not exactly as delivered (owner, group, mode, hash, unit files) stays a refused start - a wrong root path is a real threat. ABSENT becomes a stated fact: the start goes on, the boot's audit entry says the helper is absent, every commissioning function answers its named refusal. The procedure then ends commissioning with "stop and disable the socket unit" and opens it again for a camera replacement. It is one more state, as C49 says; it is an explicit and audited one. Until ruled, C49 (1) stands and gate G-1 applies as C49 already states.

## 5. Cautions, each routed

| Id | Severity | Caution | Change | Row |
|---|---|---|---|---|
| R119-01 | Medium, gate G-1 | The helper reads exit 0 of a conflict tool that did not ask as "free" | Refuse an interface with the loopback or no-ARP flag, or not up, before the tool is started; tests; new hashes | a follow-up of row 104 (proposed 104b), then rows 127 and 81 for the hash and the text |
| R119-02 | Low | A mark outlives its address; `del` would honour it for an address someone else set later | `del` and `add` treat a mark past its recorded lifetime as no mark | the same change as R119-01 |
| R119-03 | Medium, gate G-2 | The scan states "one device, no conflict" without counting; the last scan has no age | "Not known" in the contract, the scan, the job's answer and audit entry, the screen; an age bound on the last scan | rows 102 (contract step), 107, 111, 112 |
| R119-04 | Medium, gate G-2 | The hardware address the technician saw is not bound to the job; a row without one may be confirmed | Operation 106 takes it; the job refuses on a difference before the account is used; no start without one | rows 102, 111, 113 |
| R119-05 | Low | Two removals are recorded `JOB_DONE` that were not | One further value; `NOT_MARKED` closes as `NOT_ADDED`; a retry keeps its reason and actor; the lifetime timer writes `EXPIRED` | the next schema value-set step (after d2), with row 106 |
| R119-06 | Low | "Free" after one request; an entry still being asked counts as silence | `FAILED` or two attempts | a follow-up of row 111b |
| R119-07 | Medium | The steps of an acceptance are whatever a client sends | A closed, versioned list in the contract; the Core refuses unknown, missing, repeated, empty | rows 116, 117, 118; the list itself from the hardware acceptance chapters |
| R119-08 | Low | A clock behind the record answers `500` | A named `409` | rows 116, 117 (one contract step) |
| R119-09 | Low | The set-network file arms the client again after a cut on one path | `authorizedAsk` answers before arming when settled; one test | a follow-up of row 110 |
| R119-10 | Low | C53 (4c) not built | A production start refuses a configured socket path that is not the constant | the host-checks follow-up row of C49 (2) |
| R119-11 | Medium | The procedure text for two cameras on one address | The five steps of item (a); the guard keyed by address; SR-13 as gate G-3 | rows 125 and 127 (procedure), row 128 (collectors); SR-13: the controller's ruling, then a new row |
| R119-12 | Medium, a ruling | The helper is a condition of every production start | Absent = a stated fact; present and wrong = refused | the controller (it re-reads C49 (1)); then the host-checks follow-up row |

Notes, no row asked: N-1 (a log line for a refused typed address), N-2 (the sweep's audit entries per boot), N-3 (three more invisible characters).

## 6. Risks of acting on this review

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| R119-01 changes the helper and a second change follows if `9A/H-06` fails | Medium | two hashes for the user to compare | state it in the procedure now (section 2, point 4); nothing is installed yet |
| R119-03 and R119-04 are contract changes across server, shared and web | High | one more contract step, pins move | one change set, as V4 was |
| SR-13 is ruled out | Low | gate G-3 stays closed: one camera at a time on every installation | the procedure of item (a) is then the permanent rule and the screen says why |
| R119-12 is not taken | Medium | the root service stays reachable for the life of the installation | accepted by C49 (1); the helper's bounds hold |

## 7. Compliance view (short)

| Control | Assessment | Finding |
|---|---|---|
| GDPR Art. 5 (1) (c), (e) | Met | The functions store operator ids, addresses and codes; no camera account, no device text. Free texts of the acceptance (`detail`, `siteAddress`, `revokeReason`) are typed by staff and kept permanently: a note for the records of processing, no finding |
| GDPR Art. 25, Art. 32 | Met with findings | The typed account in memory for one call; R119-09 |
| ISO 27001 A.9 access control | Met with findings | TECHNICIAN only, web console only, the peer checked by the helper; least privilege in steady state R119-12 |
| ISO 27001 A.10 cryptography | Accepted limit | ONVIF over plain HTTP on the camera network, digest forms only (note SN-4) |
| ISO 27001 A.12.4 logging | Met with findings | Intent and result in one chain, the helper's own journal; R119-05 (a reason that is not true), N-1 |
| ISO 27001 A.13 communications | Met | One destination rule, source-bound dials; R119-06 |
| ISO 27001 A.14.2 development, acceptance | Findings | R119-01 (a known container finding not carried into the helper), R119-07 (the acceptance record) |

## 8. What only a host can show, by check name

| Check | What it shows |
|---|---|
| `9A/H-05` | Socket activation; the node as the service manager makes it (root, `dems-netalias`, 0660); the peer credential with the Linux numbers (level 1, option 17); the nine refusals sent through the socket as the service user with a journal line each; another account refused by the mode. To add: several calls one after another (the boot sweep) each get an answer under `MaxConnections=1`; `check` answers 35 until a first connection; the unit's options (`MemoryDenyWriteExecute`, `ProtectSystem=strict`, the nested runtime directory) do not stop the interpreter or the two tools; a refusal's exit status leaves no failed unit behind |
| `9A/H-06` (E-13) | Hypothesis H-S: the kernel removes the address after its lifetime with the Core killed. Closes or re-opens S13-10 (a). Also: one `add` and one `del` from inside the Core's unit with `NoNewPrivileges` in force (V-4) |
| `9A/H-13`, `9A/H-14` | The paths `/usr/sbin/ip` and `/usr/bin/ping`; that the echo program may open its socket as the service user inside the unit; the exact forms both programs print; with R119-06, a host that drops echo requests reads as taken |
| `9A/H-15` (E-15) | Two cameras on one factory address: what the scan states and that the job changes nothing it did not name. Gate G-3 |
| `9A/H-25` | The conflict tool is the iputils one; a taken alias address is refused; with R119-01, a no-ARP interface is refused by name |
| `9A/H-27`, V-1 | No sudoers line names the helper; the unit files root-owned |
| V-2, V-3 (HOST-38, HOST-39) | The Core's unit reports no new privileges and an empty capability set; a set-user-ID program gains nothing inside it |
| `9A/H-16`, HOST firewall items | The Core's own services are not reachable on the camera port or on an alias address (note SN-5) |

## 9. Evidence

| Check | Command | Output |
|---|---|---|
| The delivered files are the hashed ones | `shasum -a 256 dems-core-netalias dems-core-netalias.socket dems-core-netalias@.service` in `scripts/host/netalias/` | `62c0b726...2ee5fb`, `8623c1cd...ffdbcb`, `7e40f25e...38dd60a`: equal to `SHA256SUMS` line by line |
| The helper's own suite, on doubles (no real tool, no privilege) | `python3 -I -B scripts/host/netalias/test_dems_core_netalias.py` | `Ran 58 tests in 18.445s`, `OK`, exit 0 |
| The helper reads no interface flag | `grep -n "ARPable\|NOARP\|flags\|not ARP" scripts/host/netalias/*` | no line |
| The conflict tool's exit 0 without asking | `test/079_linux_container_checks.md:91` (measured by row 79 in the Ubuntu 24.04 container) | quoted in section 2 |
| The role grant | `packages/shared/src/sim/auth.ts:74-84` | `CAPTURE_COMMISSION` under `TECHNICIAN` only |
| C53 (4c) not built | `grep -n "ALIAS_SOCKET\|captureAliasSocketPath"` over `CS/capture/boot/`, `CS/config.ts`, `CS/capture-composition.ts` | the constant in `host-checks.ts:180`; the configured path in `capture-composition.ts:640`; no comparison of the two |

## 10. Assumptions, gaps, alternatives

- **Assumption:** the iputils tool behaves on the host as in the container of row 79. If its exit status differs there, R119-01 is still right (the helper should not depend on it).
- **Assumption:** in the two-camera walk of item (a), a camera answers the address question with its own hardware address and ignores frames for another. Not measured; it is what `9A/H-15` shows.
- **Gap:** operations 101 and 102 (`network/*`) were rated through the contract and the rule that consumes their values, not by reading the module. The time reader behind the unauthenticated poll was reviewed with the camera watch (row 86), not here.
- **Gap:** no static or unit suite of the Core was run; "held by a static rule" means the rule's text.
- **Alternative considered for (a):** refuse set-IP until the count is real. Not recommended: it withholds a ruled function for a harm that the hardware-address checks bound to "the wrong factory camera was moved, and the Core said so".
- **Alternative considered for R119-01:** judge the conflict tool by its printed text, as the Core's echo row does. Not recommended for root code: reading the interface's flags from the kernel is shorter and does not depend on a tool's wording.
- **Alternative considered for the statement:** make it "with one exception". Refused instead, because the procedure prints a hash beside the statement and the hash is known to change.

## 11. Verification cell of row 119, checked

| Cell | Result |
|---|---|
| Verdict PASS or CAUTION | CAUTION (section 1) |
| Each caution routed to a row | section 5: twelve cautions, twelve routes; two of them are rulings of the controller before a row exists (SR-13 in R119-11, and R119-12) |
| A FAIL stops the work for the user | no FAIL |
| The statement made or refused | REFUSED, with the four conditions to make it (section 2) |

---
*Generated: 2026-10-13 16:11 WIB*
*Last Updated: 2026-10-13 16:11 WIB*
