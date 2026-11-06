---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: security-review
blueprint_row: 20 (FIRM)
tier: 1
type: security design review (read-only; documents, not code)
verdict: CAUTION
reviewed: masterplan/01_specs.md (row 15, 03:14), masterplan/03_database_contract.md (row 16, 03:53), masterplan/04_client_integration_spec.md (row 17, 04:02)
yardstick: research/02e_collection_identity_security.md; research/03_analysis.md section 11
not_reviewed: masterplan/02_plan.md (row 18 was writing it in parallel; the file did not exist at 04:20)
last_updated: 2026-10-04 04:25
---

# Security Design Review: DEMS Core server, integrated RBAC and portal-mobile pairing

**VERDICT: CAUTION**

No defect was found that makes the design unsafe inside the stated boundary, so the verdict is not FAIL. Five findings are Medium and must be folded into the plan before the rows that build on them start (SD-01 to SD-05). Eighteen are Low, six are Info. Nothing was implemented, fixed or executed by this row.

| Severity | Count | IDs |
|---|--:|---|
| Critical | 0 | |
| High | 0 | |
| Medium | 5 | SD-01, SD-02, SD-03, SD-04, SD-05 |
| Low | 18 | SD-06 to SD-23 |
| Info | 6 | SD-24 to SD-29 |

**Citation convention.** `[SP:§n]` or `[SP:Lnnn]` is a section or a line of `masterplan/01_specs.md`; `[DB:…]` of `masterplan/03_database_contract.md`; `[CL:…]` of `masterplan/04_client_integration_spec.md`; `[AN:nnn]` a line of `research/03_analysis.md`; `[R10:nnn]` a line of `research/02e_collection_identity_security.md` (the sourced guidance); `[R8:nnn]` of `02c_collection_server_runtime.md`; `[R11:nnn]` of `02f_collection_device_credential_qr.md`; `[DEC:…]` a row of `decisions/decisions.md`; `[RT:nnn]` a line of `identification/01_translated.md`. Code is cited as `path:line` relative to `/Users/gsp-budi/Documents/DEMS/`. A statement that none of these sources carries is labelled **hypothesis** and names the row that can confirm it.

**No credential value appears in this file.** The demo password and the simulator's pairing code are cited by constant name only: `DEMO_OPERATOR_PASSWORD` (`packages/shared/src/sim/dataset.ts:153`), `DEMO_PAIRING_CODE` (`:157`).

---

## 1. Tier 1 frame

### 1.1 Subject

The security design of the three specification files of rows 15, 16 and 17: password storage, the session and token model, lockout, the pairing code and the device credential, biometric unlock, WebSocket authentication, RBAC enforcement, audit immutability, database roles, secrets handling, log redaction, CORS, the content-security policy and response headers, the demo controls, the seed's demo password, the API Reference "Try it" function and the supply chain of the PostgreSQL binaries.

### 1.2 Stakeholders

| Stakeholder | What this file gives them |
|---|---|
| Controller | A verdict, the corrections to record as decisions, the residual risks to accept, a ruling on every point the three files handed to row 20 |
| Row 18 (plan) and row 21 (blueprint refinement) | Section 7: the corrections with their owning row |
| Rows 15, 16, 17 (owners of the three files) | Section 4: the exact text to change, per section |
| Rows 23, 25, 28, 32, 33, 35, 36, 38, 48, 62, 99 | The implementation consequences of each correction |
| Rows 50, 111, 112 (later security reviews) | The list to re-check against code |
| The user | Section 8: what is accepted for a local demo, in plain terms |

### 1.3 Timeline

| When (2026-10-04, WIB) | Event | Source |
|---|---|---|
| 03:14, 03:53, 04:02 | Rows 15, 16, 17 written | file footers; [DEC:D13, D14, D15] |
| 04:03 to 04:25 | This review (row 20), in parallel with row 18 | `date` printed `2026-10-04 04:16 WIB` and `04:20 WIB` during the row |
| Next | Rows 18, 19, 21 fold the corrections; row 50 re-checks the access-control code; rows 111 and 112 re-check the build | blueprint rows 18-21, 50, 111, 112 |

### 1.4 Scope

- **In scope**: the 18 checklist items of the row brief, against the three files, the decision record and the sourced guidance.
- **Boundary accepted by the controller, not reported as defects**: a local demo on one Mac; every listener on 127.0.0.1; plain HTTP on loopback; synthetic data only; no real PKI or mutual TLS; no external identity provider; a hostile local process with the user's own uid; evidence signing simulated and labelled.
- **Out of scope**: code (none exists), `masterplan/02_plan.md` (not yet written), fixing anything.
- **Not done by this row**: no install, no process, no listener, no edit of any file other than the two this row owns.

### 1.5 Rationale and evidence chain

| Step | Fact | Source |
|---|---|---|
| 1 | The design meets the published floors for password hashing, session identifiers, timeouts and one-time codes | [SP:SR-05, SR-09, SR-11, SR-26]; [R10:89, R10:205, R10:219, R10:383] |
| 2 | Its three deliberate deviations (cookie attributes, no identifier renewal on a role change, a published password) follow from the boundary and are stated in the files | [SP:SR-14, SR-18, SR-63]; [AN:849] |
| 3 | The places where the design can fail inside the boundary are not the parameters. They are five rules that the files leave open or state in two ways: which role resets the database, which Origin list a rule uses, what limits denial rows, where a check-then-write runs, and what the request log holds | SD-01 to SD-05 |
| 4 | Each of the five has a small, local correction that needs no host change and no item of U1-U9 | section 10 |
| 5 | Therefore CAUTION: proceed, with the corrections folded into the plan before the rows that depend on them | section 7 |

### 1.6 Method

1. Read `~/.claude/skills/security-review-gate/SKILL.md` and applied its five checks to the design (section 9).
2. Read the three specification files in the sections the brief names, the decision record ([AN] TD-02, TD-05 to TD-08, TD-10, ADQ-6, the Host Impact Register, the gap register, section 11), the sourced guidance ([R10] topics A to E and the parameter table), `decisions/decisions.md` (D1-D15, F1-F24) and U1-U9 [RT:223-231].
3. Checked nine repository facts read-only, where a finding depends on existing code: `packages/shared/src/api/constants.ts:26-29`, `apps/mock-core/src/heartbeat.ts:20,63-66`, `apps/core-web/vite.config.ts:18`, `apps/core-web/src/lib/packaged-csp.ts:52-65`, `apps/core-web/src/features/api-reference/sim-fetch.ts:97-103`, `apps/core-web/src/features/api-reference/scalar-config.ts:25-31`, `packages/shared/src/sim/pairing.ts:44-46`, `packages/shared/src/sim/constants.ts:51-61`, `package.json:36-38`. Commands: `ls`, `grep -n`, `cat -n` with a line range; the three credential constants were printed with their values redacted.
4. For each checklist item: verdict, sections checked, the guidance used, and for CAUTION the correction with the document and section that must change (section 3 and section 4).
5. Computed the guessing probability of the pairing code (section 5.1) and compared the three options for the reset role (section 5.2).

### 1.7 Alternatives considered

| Alternative | Why not |
|---|---|
| FAIL for the superuser reset (GD-02) | Inside the boundary the flag is off by default, the connection is short-lived and the listener is loopback; the correction is cheap, so it is a Medium finding with a required change |
| Require CSRF tokens instead of the Origin guard | The guidance lists Origin verification as a defence [R10:268]; tokens would have to be carried by both clients [AN:397]. The guard is kept and tightened (SD-02, SD-07) |
| Require `Secure` and the `__Host-` prefix on the cookie | Browser behaviour on `http://127.0.0.1` is not confirmed and differs per browser [R10:261, R10:621]; a refused cookie would break the demo and protect nothing on a transport without TLS |
| Require a server-side check of the audit digest (GD-01) | A writer that may insert can also compute a valid digest; the check would catch defects only, which the stored-chain verification already reports [DB:L1229] |
| Require the PostgreSQL store for the lockout counters (G-26) | A lock lasts 60 s; clearing it needs a restart, which needs local access |
| Coalesce repeated denial rows | Success criterion 4 needs one row per refused call [SP:RB-4]; a budget at the throttle keeps that rule (SD-03) |
| A console key injected by the dev proxy, so that a forged Origin alone does not reach the web sign-in (GS-03) | It would raise the bar from "any loopback client" to "a process that reads the user's files". Not required inside the boundary; recorded as an option in section 6 |

### 1.8 Assumptions

| ID | Assumption | Effect if wrong |
|---|---|---|
| RA-1 | The three files are reviewed at the revisions named in the header | A later revision needs a re-check of the cited lines |
| RA-2 | The boundary of section 1.4 holds for the whole task; U4 is not lifted | SD-17 and section 8 name what changes if it is |
| RA-3 | Two loopback ports count as the same site for an IP-literal host. The guidance does not state it [R10:247]; this review takes the unfavourable reading, which makes the Origin guard the primary CSRF control and `SameSite` the secondary one | If ports are cross-site, the design is stronger than assessed |
| RA-4 | Statements about PostgreSQL, V8, browsers and React Native that the research does not carry are hypotheses and are labelled where used | The named row confirms or drops the correction |

### 1.9 Gaps of this review

| ID | Gap | Effect |
|---|---|---|
| RG-1 | `masterplan/02_plan.md` was not available | Corrections owned by row 18 are stated as inputs, not as defects of the plan |
| RG-2 | Nothing was executed: no PostgreSQL, no server, no browser, no emulator [DB:GD-04] | Every behavioural statement is checked by its named row |
| RG-3 | Whether the API Reference renderer keeps request or response history in web storage is not established | SD-16 asks for a test |
| RG-4 | `README.md` was not opened, so that the demo password literal is not reproduced; [DEC:F7] is relied on for its location | None |
| RG-5 | Security fixes between PostgreSQL 18.4 and 18.6 were not collected [AN:G-04] | Residual R-13 |

---

## 2. Is the boundary stated clearly enough?

| Boundary item | Stated in | Clear? |
|---|---|---|
| Local demo, one Mac; every listener on 127.0.0.1, host a constant | [SP:§2.1, SR-01, SR-02]; [AN:829] | Yes |
| Plain HTTP on loopback, no TLS; cookie without `Secure` | [SP:§15.11 L1521; OR-8; SR-18] | Yes |
| Synthetic data only | [SP:SR-62; AC-B-65] | Yes |
| No real PKI or mutual TLS; bearer device credential without proof of possession | [SP:§15.11 L1520]; [AN:840] | Yes |
| No external identity provider; security key only in Simulated mode | [SP:§5.5; §15.11 L1522] | Yes |
| A hostile local process with the user's uid | [SP:§15.11 L1523; §6.9] | Yes |
| Evidence signing simulated and labelled | [SP:§15.11 L1526; §14.1 L1374] | Yes |
| **Other accounts on the same Mac, and apps inside an emulator that reach the host through `adb reverse`** | Not stated | **No (SD-26).** Both reach the loopback listeners without the user's uid. With the published password and a forged Origin they can sign in. The files should say that the boundary is a single-user Mac and that the emulators are part of it |

---

## 3. Checklist: verdict per item

PASS = no change needed. CAUTION = accepted with the named corrections or conditions. FAIL = unsafe inside the boundary (none).

| # | Item | Verdict | Sections checked | Guidance | Result in one paragraph | Findings |
|--:|---|---|---|---|---|---|
| 1 | Password storage | CAUTION (Low) | [SP:§5.1 ID-P10; §5.2 ID-2, ID-3; SR-05 to SR-08; §14.1]; [DB:§4.5; §5.1; §5.2]; [AN:TD-05] | [R10:89, R10:103, R10:110, R10:117, R10:420] | Argon2id with 19,456 KiB, 2 passes, parallelism 1, a 32-byte tag and a 16-byte salt per password equals the OWASP minimum and the RFC 9106 salt length; the floor is also a CHECK in the table [DB:L473-474]. Constant-time comparison, a dummy verification for an unknown user, and a re-hash at the next sign-in are specified. Open: the disabled-operator path, the pepper decision, the source of the salt | SD-21 |
| 2 | Session model | CAUTION (Low) | [SP:§5.1 ID-P4 to ID-P9; §5.2 ID-6 to ID-10; §5.3; §5.4; §4.7; SR-09 to SR-18]; [DB:§4.6; §5.2; §5.3]; [CL:§5.2; §5.3; §9.1]; [AN:TD-06; ADQ-6] | [R10:205, R10:212, R10:219, R10:226, R10:233, R10:254, R10:261] | 256 random bits, stored as SHA-256 only; idle 15 minutes and absolute 8 hours inside the OWASP ranges; a new token at every sign-in; revocation in the same transaction as sign-out, disable, revoke and unpair; no privilege in the session. The cookie attributes are the right ones for plain HTTP on loopback (section 5.3). Open: the cookie name collides between lane instances, the transport of a session is not bound, the cookie is persistent | SD-08, SD-09, SD-24 |
| 3 | CSRF and Origin | CAUTION (Medium) | [SP:§2.3 stage 3; §2.4; §5.2 ID-1; §6.9; §9.2; §14.2 OR-1 to OR-8; SR-18 to SR-21; AC-B-43]; [CL:§4.1 WT-1 to WT-3]; [AN:ADQ-6] | [R10:247, R10:254, R10:268]; [R8:388] | The Origin guard covers every POST and every socket upgrade that carries the cookie, a missing Origin on those is refused, and a cookie is issued only to an allowlisted Origin. With RA-3 the guard is the primary control, and it is sound. Open: the server's own origin and the web origins must be two lists (SD-02); `localhost` is in the allowlist while another project owns `[::1]:5173`; `null` and the comparison rule are not stated; the proxy's pass-through has no negative test. GS-03 is accepted (section 6) | SD-02, SD-07 |
| 4 | Lockout and throttling | CAUTION (Medium) | [SP:§5.1 ID-P1 to ID-P3, ID-P12; §5.2 ID-3 to ID-5; SR-22 to SR-25; §6.1 PR-P4, PR-P5; RB-8]; [DB:DA-05] | [R10:420, R10:427, R10:441] | Threshold, window and duration are defined as OWASP asks; the answer is generic; the key is the console, because every client arrives from 127.0.0.1. One web key means five failures lock every web sign-in for 60 s, the last administrator included: accepted, the lock is short and only a local client can cause it. Unlock is by time, by a success, or by a restart. Open: attempts are not consumed atomically; the throttle key is read before the principal is known | SD-04, SD-12 |
| 5 | Pairing | CAUTION (Medium) | [SP:§6.1 to §6.7; SR-26 to SR-30; AC-B-32 to AC-B-41]; [DB:§4.7; §4.8; §5.1; §5.2]; [CL:§9.4; §10.3] | [R10:376, R10:383, R10:605, R10:629] | Six digits, 300 s, single use, one active code, at most five failed redeems: the chance of guessing an issued code is 5 in 1,000,000 (section 5.1), acceptable for this boundary. The hash only keeps the code out of dumps (GS-09, accepted). An unpaired device reaches health, redeem and a heartbeat-only socket. Single use is backed by a UNIQUE constraint [DB:L563]. Open: the five-attempt bound holds only if the redeem path is atomic | SD-04 |
| 6 | Device credential | CAUTION (Low) | [SP:§6.1 PR-P8; §6.3 T7; §6.6; §6.7; SR-31 to SR-35]; [DB:§4.9; §5.2]; [CL:§9.1; §9.4 MP-8a, MP-10; §9.3 MB-5, MB-6; §17.3] | [R11:156-160]; [R10:341, R10:348] | 256 random bits, SHA-256 on the server, Keystore-backed storage on the device, a session bound to the device and valid only while it is PAIRED, revocation in the same transaction with the sockets closed within 1 s. Storing it without an authentication requirement is needed by the gate and accepted. DEPARTURE-6 is accepted with conditions (section 5.5). Rotation is not called by the app in this task: accepted | SD-18, SD-29 |
| 7 | Biometric unlock | CAUTION (Low) | [SP:§5.6; §7.5 operations 7 to 9; SR-36, SR-37; AC-B-31]; [DB:§4.10]; [CL:§9.3] | [R10:341, R10:397]; [R11:159] | The server never accepts a claim: it accepts a single-use token bound to one device and one operator, issued inside a password session, rotated at each use, with reuse revoking the family. That is the refresh-token pattern of RFC 9700. Open: a reuse does not end the sessions the family issued; the failure report names an operator chosen by the client | SD-10, SD-11 |
| 8 | WebSocket | CAUTION (Low; Medium through SD-02) | [SP:§9.1 to §9.5; §4.7; SR-38 to SR-42]; [CL:§2.2] | [R10:275, R10:390]; [R8:388, R8:418] | Authentication at the upgrade only, from headers only; Origin checked on every handshake; topics by principal; `session.ended` or `device.revoked` then a close within 1 s; re-validation every 5 s (the guidance says 30 minutes is common); message size 65,536 bytes, 30 messages in 10 s, compression off, a slow-consumer close. Open: anonymous sockets share the cap of 16; upgrades are not named in the throttle; the React Native upgrade may carry the server's own Origin | SD-02, SD-12, SD-13 |
| 9 | RBAC enforcement | CAUTION (Low) | [SP:§4.2 to §4.6; §2.3; §8.2 ENG-2; §12.1; SR-43 to SR-47; AC-B-12 to AC-B-22]; [AN:TD-07] | [R10:475, R10:482] | Deny by default (a route without a rule cannot boot), one access rule per operation, the rule evaluated in `onRequest` before the body is read, one any-of rule, role and grants read from PostgreSQL on every request so that a change applies to live sessions at once, client tables as hints only, demo controls behind a permission and a boot-time flag. DEPARTURE-4 is the right call. Open: the last-administrator check must be atomic; the actor scope must be cleared on a throwing action | SD-04, SD-22, SD-28 |
| 10 | Audit | CAUTION (Medium) | [SP:§8.3; §12.3; §12.4; §13; SR-52 to SR-56]; [DB:§6; §7.3; §7.4; §8.5; GD-01] | — | Append-only by privilege and by a trigger; the chain is serialised by a row lock on a single head row and refused by the database when a row does not continue it. GD-01 is accepted (section 6). The reset is acceptable and visible, with one improvement (section 5.6). Open: an operator without a permission can write 600 denial rows a minute; the triggers can be skipped by a superuser session | SD-03, SD-06, SD-19, SD-27 |
| 11 | Database roles | CAUTION (Medium) | [DB:§7.1 to §7.4; §8.4; §8.5; GD-02]; [SP:§2.1 C-5; DC-5; SR-58]; [AN:273] | — | The runtime role is well bounded (no UPDATE, DELETE or TRUNCATE on the audit table, column-level UPDATE elsewhere, boot checks B-4 and B-5). The owner role is the cluster superuser and the server opens a connection as that role for a reset. Recommendation: option (a), a non-superuser owner role (section 5.2) | SD-01 |
| 12 | Secrets handling | CAUTION (Low) | [SP:§14.1; SR-60, SR-61; AC-B-64]; [DB:§7.1; §8.4]; [AN:269-311] | — | The owner password is generated locally from 24 random bytes [AN:295] and its file has mode 0600, `.data/` is ignored before it is created and checked with `git check-ignore`, `initdb` reads the password from a file and not from an argument, no signing secret exists. Open: the mode of `pg.env`, what that file contains, a rule for process arguments, a check that `pg_hba.conf` has no `trust` line | SD-15 |
| 13 | Log redaction | CAUTION (Medium) | [SP:SR-48 to SR-51; AC-B-29; AC-B-42]; [DB:§5.4 NL-1 to NL-8; §5.5]; [CL:CL-6a; §3.4]; [AN:215]; [DEC:F9] | [R10:275]; [R8:412] | By design no token is ever in a URL, and a registry test asserts it. By mistake any token can be: a client that appends `?token=`, and the test of AC-B-42 does exactly that. The default request log would then hold it. The never-log list of the contract is complete for columns and bind parameters | SD-05, SD-23 |
| 14 | CORS, CSP, headers | CAUTION (Low) | [SP:§14.2 OR-5, OR-6; SR-04; §19.5]; [CL:§4.3; AC-C-33, AC-C-35]; [AN:213] | [R10:247] | No CORS plugin and no `Access-Control-Allow-*` header: a cross-origin page cannot read an answer. The packaged policy is untouched and guarded by a diff and a pinned test, so the 0.1.0 packages are not loosened (`apps/core-web/src/lib/packaged-csp.ts:52-65`). Open: the new server has no response-header rule | SD-14 |
| 15 | Demo password | CAUTION (accepted with conditions) | [SP:§5.2 ID-11; SR-63; GS-01, GS-10; §15.11]; [CL:§5.5 WS-9, WS-10; §9.2; GC-07]; [DEC:D4 Q12; F7] | [R10:110] | Ruling in section 5.4: Live mode may show the disclosure, because it tells nothing that `README.md` does not; in Live mode sign-in demonstrates the mechanism and does not protect the data; the acceptance is tied to the loopback boundary | SD-17 |
| 16 | API Reference "Try it" | CAUTION (Low) | [CL:§11 AR-1 to AR-8; GC-09; AC-C-100; §4.3] | — | Requests go only to the page's own origin (`sim-fetch.ts:97-103`), carry the operator's cookie, pass the Origin guard and are audited like any other call; a banner says so. That is equivalent to the console's own buttons. Open: six operations carry or return a secret and must not be callable from the reference page | SD-16 |
| 17 | Supply chain | PASS (notes) | [SP:§2.1 P-1; §10.4]; [AN:TD-02 L231-259, L330-341; G-04, G-05]; [DEC:F13, F21]; `package.json:36-38`; `.npmrc` | — | Exact pins and lockfile integrity, the one install script read before a pinned approval in the form the repository already uses, the wrapper's JavaScript never imported, `npm audit signatures` recorded with a failed signature treated as a failed install. Two records are added | SD-25 |
| 18 | Anything else | CAUTION (Low) | [SP:§7.13; §8.2; §13.2; §15.11]; [CL:§5.6; §10.1; §10.3] | — | Client memory after sign-out, the boundary statement, the cost of the stored-chain check, the unaudited commands | SD-20, SD-26, SD-27, SD-28 |

---

## 4. Findings

Owning row: 15 = server spec, 16 = database contract, 17 = client spec, 18 = plan; other numbers are implementation rows of the blueprint.

### 4.1 Medium

| ID | Item | Evidence | Required correction | Owning row |
|---|--:|---|---|---|
| SD-01 | 11 | `dems_admin` is the role `initdb` creates, the cluster superuser [DB:L1361], and the server opens a connection as that role for a reset when the demo flag is on [SP:DC-5 L1307; DB:GD-02 L1876]. The contract says the trigger binds the owner and that only "to drop or disable the trigger" is left, "a schema change that boot check B-5 detects" [DB:L1235]. For a superuser that is not complete: a session setting can skip ordinary triggers with no schema change (**hypothesis**: `session_replication_role`; general PostgreSQL knowledge; row 28 confirms), so guarantee G-2 [DB:L1224] does not hold against the reset connection. Both `SECURITY DEFINER` functions [DB:L1249-1281] run with superuser rights | Option (a) of section 5.2: a third role `dems_owner` (not a superuser, may create databases) owns the databases and objects and performs migrations, seed, reset and test databases; `dems_admin` is used only at provisioning; the server never reads the superuser's password file. Exact changes in section 5.2 | 16 (§7.1, §7.2, §7.4, §8.4, §8.5, §13.2 GD-02); 15 (§2.1 C-5, §12.4 DC-5, §14.1, SR-58); 18 (rows 23, 28, 29, 48); controller: a decision that amends "two roles" of [AN:273] |
| SD-02 | 3, 8 | OR-1 refuses every Origin outside the web allowlist [SP:L1382]. React Native may send an Origin on a socket upgrade (`packages/shared/src/api/constants.ts:28-29`; the option exists in its constructor, [R8:406]). The fallback of SA-03 adds the server's own origins "for non-cookie requests" [SP:L128]. The pattern the guard is modelled on [AN:397] keeps both kinds in **one** set (`apps/mock-core/src/heartbeat.ts:20`). If the lists are merged, a request whose Origin is the server's own satisfies ID-1(a) [SP:L463] and signs in with no device credential: pairing is no longer mandatory (Q5), without any forging | Decide it now instead of as a fallback. Two constants in the server's configuration: the **web console origins** (used by ID-1(a) and by every cookie-authenticated request) and the **instance's own origin** (accepted only on a request that carries no cookie: a bearer request or an anonymous socket). OR-1, OR-4 and the table of §9.2 are rewritten in those terms. Tests: sign-in with the own origin and no bearer answers 403 `DEVICE_NOT_PAIRED`; a POST with the cookie and the own origin answers 403; an upgrade with a bearer and the own origin is accepted | 15 (§1.8 SA-03, §2.4, §5.2 ID-1, §9.2, §14.2 OR-1 and OR-4, AC-B-32, AC-B-43); rows 32, 36, 38 |
| SD-03 | 10 | Every refusal of an operator writes one `ACCESS_DENIED` row before the answer [SP:RB-4 L412], through the one pipeline, with a delta to every operator socket [SP:ENG-8 L1011]. Every sign-in and redeem attempt writes a row, also during a lock [SP:L466-467; L556]. A request with a retired device credential writes one [SP:RB-6 L414]. The only brake is the throttle: 600 a minute per principal, 30 a minute before authentication [SP:ID-P12 L457]. An operator without a permission can therefore append 600 rows a minute; the ring of 1,000 rows that the pages show [SP:ENG-10; CL:GC-06] is displaced in under two minutes; the table is never pruned [DB:GD-07] | Keep "one row per refused call". Add a **denial budget** at the throttle stage, which runs before the guard [SP:L196-198]: per key at most 20 audited refusals in 60 s (a 403 of the guard, a 423, a failed sign-in or redeem), then 429 `RATE_LIMITED`, which is logged and not audited [SP:GS-07]. State the key of a retired device credential (the pre-authentication bucket). The numbers are proposals. New acceptance test: 100 denied calls in 10 s write at most 20 rows and the rest answer 429 | 15 (§5.1 ID-P12, RB-4, RB-6, SR-24, §16.3); rows 32, 33, 36 |
| SD-04 | 4, 5, 7, 9 | The files give two readings of where a server-native handler runs: "act directly" [SP:L200] and "inside the pipeline" [SP:ENG-8 L1011]; the contract relies on the second ("`FOR UPDATE` is not needed: the pipeline is serial", [DB:L633]). The Argon2 computation cannot run in the pipeline: it would hold the 50 ms tick [SP:ENG-1; AN:378]. With no stated rule, concurrent requests can pass a check before another request's failure is counted: redeem guesses up to the pre-authentication throttle (30 in 60 s, 150 in a code's 300 s) instead of 5; lost updates of `failed_attempts`; two uses of one biometric token; two demotions that leave no administrator [SP:RB-8]. The database backs single use only: `paired_devices_paired_with_code_id_key` [DB:L563] and `biometric_tokens_one_live_key` [DB:L613] | (1) [SP:§2.3, §8.2]: every server-native state change (check, count, transition, audit row) is one unit of work in the serial pipeline; only the hash computation runs outside it. (2) Lockout: one attempt is consumed **before** the verification and cleared on success. (3) [DB:§5.2]: transitions are compare-and-set statements whose row count decides: the code `UPDATE … SET state = 'REDEEMED' WHERE id = $1 AND state = 'ACTIVE' AND expires_at > $2 RETURNING id`; the counter `SET failed_attempts = failed_attempts + 1 … RETURNING failed_attempts`; the biometric token `SET used_at = $2 WHERE token_hash = $1 AND used_at IS NULL AND revoked_at IS NULL RETURNING …`. (4) The check and the update of RB-8 are one unit. (5) Tests: 20 parallel wrong redeems consume exactly five and close the code; two parallel redeems of the right code give one 201; two parallel uses of one biometric token give one session; two parallel demotions of the last two administrators give one 409 | 15 (§2.3, §8.2, §5.2 ID-5, §5.6, §6.4, RB-8); 16 (§4.11, §5.2); rows 32, 35, 36 |
| SD-05 | 13 | SR-49: "No secret travels in a URL, so the request URL that Fastify's default logger writes is safe to log" [SP:L1484]. AC-B-42 sends a token in a URL to prove that it is ignored [SP:L1606]; the default logger then writes it [DEC:F9; AN:212]. AC-B-29 scans only the sign-in, biometric and pairing flows [SP:L1583]. Second path: a malformed JSON body on operations 2, 7, 8 or 18; the parser's message can quote a fragment of the body (**hypothesis**: the wording of V8's `JSON.parse` errors; not in the research; row 32 confirms), and a default error log line would carry it | SR-49 becomes: the request log holds the method, the registry's route pattern (or the path without its query string), the status, the duration, the request ID and a principal reference of NL-7; never the raw URL. SR-48 adds: a parse or validation failure is logged by its code only, never with the parser's message or the input. AC-B-29 is extended: (a) a socket upgrade and a GET with `?token=<marker>`; (b) malformed JSON that contains a marker, on operations 2 and 18; (c) the log of the whole acceptance run. No marker appears | 15 (SR-48, SR-49, AC-B-29); rows 25, 32 |

### 4.2 Low

| ID | Item | Evidence | Required correction | Owning row |
|---|--:|---|---|---|
| SD-06 | 10 | Both audit triggers are created with the default enablement and B-5 expects `tgenabled = 'O'` [DB:L1283-1300; L1432] | In `0002_audit_guards`: `ALTER TABLE public.audit_log ENABLE ALWAYS TRIGGER` for both triggers; B-5 expects `'A'`; the sentence of §6.2 about what is left to the owner is corrected; T-AO-2 gains two cases: as the owner role the session setting is refused with `42501`, as the bootstrap superuser with the setting on, the UPDATE is still refused with `ZA002` (**hypothesis** until row 28 runs it) | 16 (§6.2, §6.3, §6.5, §7.4); row 28 |
| SD-07 | 3 | (a) The allowlist holds `http://localhost` [SP:L216], while another project on this host listens on `[::1]:5173` [SP:L155] and the dev server binds `127.0.0.1` only (`apps/core-web/vite.config.ts:18`): a page of that project can carry an allowlisted Origin. (b) `Origin: null` and the comparison rule are not stated. (c) That the proxy forwards the Origin unchanged is an assumption (SA-02) with no negative test | (a) Allowlist = `http://127.0.0.1` on 5173, 5176, 5177, 5178 only. (b) OR-1: exact string match on the serialised origin; `null` is refused. (c) Row 62: a POST sent **through the dev server** with a foreign Origin is answered 403 by the Core; the proxy block sets no header and rewrites no Origin; if the fallback with CORS [AN:598] is ever triggered it returns to a security review first. Optional: refuse a cookie-authenticated request whose `Sec-Fetch-Site` is present and is not `same-origin` [R10:268]; refuse a `Host` that is not the instance's own (DNS rebinding) | 15 (§2.4, OR-1 to OR-3, AC-B-43); 17 (WT-2, AC-C-33); row 62 |
| SD-08 | 2 | The cookie name is `dems_session` for every instance [SP:ID-P7 L452]; lanes are separate servers and databases behind 5176-5178 [SP:§2.1]; cookies are not isolated by port [R10:254]. A sign-in on a lane replaces the main console's cookie in the same browser profile, and each instance receives the others' tokens | Name the cookie per instance: `dems_session_<backend port>`. No client reads the cookie, so only tests change | 15 (ID-P7, SR-18, AC-B-23); 17 (§5.2 step 2, AC-C-38); 18 (lane model) |
| SD-09 | 2 | §4.1 defines a web operator as "the session cookie; the session has no device" and a device operator as a bearer bound to a PAIRED device [SP:L322-323]; the lookup rule does not look at the transport [DB:L1167]. A request with both a cookie and an `Authorization` header has no rule | `authenticate`: a cookie resolves only a session without a device; a bearer `ses_` only a session with one; a request with a cookie and an `Authorization` header, or with a bearer and a web console Origin, is refused. One credential per request. Cells for these cases in the matrix test | 15 (§4.1, §2.3 stage 5, AC-B-15); 16 (§5.2); row 32 |
| SD-10 | 7 | A reused biometric token revokes its family, writes `AUTH_FAILED` and counts toward the lockout [SP:L518]; the sessions that the family issued stay open until idle or absolute expiry. The reuse rule exists because one of the two presenters is not the owner [R10:341] | On `TOKEN_REUSE`, also end the open sessions of that device and operator whose method is BIOMETRIC, push `session.ended` and close the sockets. Add the value `TOKEN_REUSE` to `SESSION_END_REASON` [DB:L242] and to `session.ended.reason` [SP:L1159] **before** the first migration: the set is a closed CHECK and a later change needs a migration [DB:MG-11] | 15 (§5.4, §5.6 step 6, §9.4); 16 (§2.4); 17 (§6.5) |
| SD-11 | 7, 9 | `reportBiometricFailure` takes `{ operatorId }` from the device and writes `AUTH_FAILED` [SP:L737], while SR-65 says no client-supplied actor is trusted [SP:L1510]. A paired device can write failure rows that name any operator | The row names the operator only when a biometric token of this device and that operator exists (live or last used); otherwise the actor is null and the row carries the device ID. One test | 15 (§7.5 operation 9, SR-37, SR-65); row 32 |
| SD-12 | 4, 9 | Stage 4 (throttle, "keyed by console key or principal") runs before stage 5 (`authenticate`) [SP:L196-197]: the principal is not known yet. A key taken from an unverified bearer value would let a caller mint keys. Socket upgrades are not named in ID-P12 | The throttle key is the **resolved** principal, else one of a fixed set of classes (web console, no Origin); never a client-supplied value. Either resolve the principal first, or keep stage 4 on the classes and add a principal counter after stage 5; update the precedence table of §7.3. A bearer value that does not resolve stays in the class bucket. Upgrades are counted | 15 (§2.3, §7.3, ID-P12); rows 25, 32, 38 |
| SD-13 | 8 | At most 16 connections per instance [SP:RT-P6 L1090]; an upgrade with no credential is accepted as ANONYMOUS [SP:L1111]. Sixteen anonymous sockets from any local client deny the socket to every operator | A separate cap for connections without an operator (for example 6 of 16), or an authenticated upgrade displaces the oldest anonymous connection with 1013 | 15 (RT-P6, SR-42); row 38 |
| SD-14 | 14 | The server specification has no response-header rule; `@fastify/helmet` is left "optional, for row 20 to confirm" [AN:213; SP:L1897]. The launcher sends a policy and six headers [DEC:F9] | New requirement: every answer of the Core server carries `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `Cross-Origin-Resource-Policy: same-origin`, `Referrer-Policy: no-referrer`, and JSON bodies `application/json; charset=utf-8`. Use `@fastify/helmet` 13.1.1 (MIT, pinned in the decision record) plus one `onSend` hook for `Cache-Control`; the option names are confirmed by row 25. One assertion in AC-B-14. Optional: `server.headers` with `X-Frame-Options: DENY` in the dev server block that row 62 already edits | 15 (§14.2, §15.1, AC-B-14); 18 (row 25 dependency list) |
| SD-15 | 12 | (a) `.data/pg.env` has no stated mode [SP:L1367]; SR-60 says "mode 0600" without naming the objects [SP:L1505]; AC-B-64 checks git-ignore only [SP:L1643]. (b) The content of `pg.env` is "connection settings" [SP:L162]. (c) No rule on process arguments. (d) `initdb -A scram-sha-256` [AN:296] is what keeps `trust` out of `pg_hba.conf`; the trial does not check it [AN:330-341]. (e) How the runtime password is generated is not stated | (a) `.data/` 0700; every file in it that holds a secret and the server log 0600; AC-B-64 adds `stat` checks. (b) Discrete fields (host, port, database, user, password); no connection URL with a password anywhere; the server's loader reads the file itself: no `--env-file`, no `source`, no exported `PGPASSWORD`. (c) No secret in a process argument or an npm script; a static check over `scripts/` and the manifests. (d) Trial step T3: no line of `pg_hba.conf` has the method `trust`; a connection with a wrong password is refused. (e) At least 24 bytes from `crypto.randomBytes`, base64url, as for the owner | 15 (§14.1, SR-60, AC-B-64); 16 (§7.1); 18 (row 23 trial) |
| SD-16 | 16 | In Live mode Try-it sends any request under the page's `/api/v1` [CL:AR-3 L1054]. Six operations carry or return a secret [SP:L765]: 2, 7, 8, 15, 18, 23. Through the reference page, operation 18 would hand a device credential to a script-readable viewer (SR-32 keeps it in secure storage only), operation 2 would put a password into the request editor and rotate the console's own session (ID-6), operation 15 would replace the active code and show it outside the rules of [CL:§10.3]. `persistAuth: false` is set (`scalar-config.ts:30`); other persistence is RG-3 | AR-3 gains a deny list: in Live mode Try-it of operations 2, 7, 8, 15, 18 and 23 is rejected before a request, with the message pattern of AR-2. AC-C-100 adds: after Try-it calls no web-storage value holds a request body or an answer; the page's own log prints method, path and status only. The banner of AR-4 stays | 17 (§11, AC-C-100); row 99 |
| SD-17 | 15 | SR-63, GS-01, GS-10 [SP:L1508, L1794, L1803]; WS-9 [CL:L471] | The conditions C1 to C4 of section 5.4 | 15 (SR-63, §15.11); 17 (WS-9, §9.2); 18 (row 101, README) |
| SD-18 | 6 | DEPARTURE-6 [CL:L1460]; MB-5, MB-6 [CL:L844-848] | The conditions of section 5.5 | 17 (§9.3, §17.3); row 79 |
| SD-19 | 10 | The discarded chain is recorded in the new chain's `SCENARIO_LOADED` row and in "one server log line" [SP:DC-7 L1309]. The log line is process output, not a record; after two resets the first chain and the name of who reset it are known nowhere | Recommended, the controller chooses one: (i) a kept table `audit_chain_history` (epoch, previous head sequence and hash, reset time, actor, scenario), INSERT and SELECT for the owner, SELECT for the runtime role, carried across resets like `registry_counters`; or (ii) one JSON line per reset appended to a file under `.data/` with mode 0600. Either makes the lineage durable | 16 (§3.3, §8.5); 15 (DC-7, SR-56); row 48 |
| SD-20 | 18 | On sign-out the replica is cleared [CL:WS-12 L479]. The TanStack Query entries `['core', …]` of the two administration pages [CL:PG-6 L933] and the pairing code held "for the life of the page load" [CL:L1001] are not named; the console is a single-page app, so another operator can sign in on the same page load | On sign-out, on `session.ended`, and on the loss of `USER_ADMIN` or `PAIRING_MANAGE`: remove the `['core', …]` queries and drop the code from memory. One web test | 17 (§5.6 WS-12, §10.1 PG-6, §10.3); rows 62, 76 |
| SD-21 | 1 | (a) ID-2 verifies a dummy hash when the username matches nobody [SP:L464]; the disabled-operator path is not stated, and SR-08 asks for comparable time for all three cases [SP:L1413]. (b) No sentence says whether a pepper is used; Node's function has the parameter [R10:124] and the guidance wants a pepper stored apart from the hashes [R10:103]. (c) The source of the salt is not named | (a) ID-2: the Argon2 computation always runs, for a known, an unknown and a disabled operator, before any branch. (b) §14.1: "No pepper: it would be one more secret under the same `.data/` and the same uid, so it adds no separation, and the password is a published constant." (c) SR-05: the salt comes from `crypto.randomBytes(16)` | 15 (§5.2 ID-2, SR-05, SR-08, §14.1) |
| SD-22 | 9 | ENG-2 sets the engine's `auth` slice to the caller, calls the action and sets it back "in one synchronous turn" [SP:L1000]; a throwing action is the normal refusal path [SP:ENG-7] | ENG-2: the slice is set back in a `finally`. AC-B-53 adds: also after a command that the action refuses by throwing | 15 (ENG-2, AC-B-53); row 37 |
| SD-23 | 13 | AC-C-65 scans AsyncStorage and the runtime log for the three token prefixes only [CL:L1223]; the mobile log is persisted (`dems.mobile.log.v1`, [CL:L346]) | The scan also looks for a marker password and a marker pairing code used by the test; the same for the web's error sink and the reference page's log | 17 (AC-C-65, AC-C-75, §11); rows 79, 81, 99 |

### 4.3 Info

| ID | Item | Evidence | Note or correction | Owning row |
|---|--:|---|---|---|
| SD-24 | 2 | The cookie has `Max-Age` 28,800 s [SP:ID-P7]; a closed tab does not sign out [CL:WS-15]. NIST: bearer session secrets "SHOULD NOT be persistent" [R10:233] | Either drop `Max-Age` (a browser-session cookie) or list the deviation beside G-08 and G-11. The server-side idle limit bounds it either way | 15 (ID-P7, §19) |
| SD-25 | 17 | The script is read before approval [AN:M2]; nothing fixes what was read | The provisioning record stores the SHA-256 of `scripts/hydrate-symlinks.js`, `native/pg-symlinks.json` and the three binaries, and row 105 recomputes them; `npm audit` is recorded in rows 23, 25, 57, 77; any further install script that `npm install-scripts ls` lists goes through the same read-and-approve step, never a blanket approval | 18 (rows 23, 25, 57, 77, 105) |
| SD-26 | boundary | Section 2, last row | Add to [SP:§15.11]: the boundary is a single-user Mac; other accounts on it and apps inside the emulators reach the loopback listeners and are held only by the application's sign-in | 15 (§15.11) |
| SD-27 | 10 | `verifyAuditChain` checks the whole table on every call and needs `AUTHENTICATED` only [SP:L846, L851] | Remember the last verified sequence and hash; verify from there | 15 (§7.13); row 45 |
| SD-28 | 9, 10 | Open point 3 of [SP:§19.5]: the `NONE-P` commands [SP:L1352] | Ruling: keep the parity with the simulator's audit sequence. `acknowledgeAlert` and `updateSettings` change a value that every client sees: write one server log line with the operator ID and the alert ID or the changed keys (a log line, not an audit row) | 15 (§13.2); rows 46, 47 |
| SD-29 | 6 | `rotateDeviceCredential` is registered but called by no client [CL:MP-8a L876]. A holder of a copied credential could rotate it and lock the real device out; the `DEVICE_CREDENTIAL_ROTATED` row shows it, and a revoke ends it | Accepted (R-06). Document that any such row is unexpected in this task | 15 (§6.3 T7) |

---

## 5. Reasoning for the rulings

### 5.1 Pairing code: guessing probability

| Input | Value | Source |
|---|---|---|
| Code space | 10^6, uniform, from `crypto.randomInt` | [SP:PR-P1] |
| Lifetime | 300 s | [SP:PR-P2] |
| Codes active at once | 1 | [SP:PR-P3] |
| Failed redeems before the 60 s lock | 3 | [SP:PR-P4] |
| Failed redeems before the code is closed | 5 | [SP:PR-P5] |
| After a lock ends | A fresh count, as the simulator does (`packages/shared/src/sim/pairing.ts:44-46`) | [SP:PR-P4 source] |

- Guesses available per code: 3, then a 60 s lock, then 2 more; all five fit into the 300 s.
- Chance that five distinct guesses hit one uniform code: 5 / 1,000,000 = **5 × 10^-6 (0.0005 %)** per issued code. The specification states the same bound [SP:L544].
- An attacker cannot issue codes (that needs `PAIRING_MANAGE`). For a 50 % chance about 138,600 issued codes would have to be attacked (ln 0.5 / ln(1 − 5 × 10^-6)). In a demo with ten codes the chance is 5 × 10^-5.
- The guidance asks for at least six decimal digits and at most ten minutes [R10:383] and for a limit on attempts [R10:376]; both are met.
- **The bound depends on SD-04.** If concurrent redeems are not serialised, the brake is the pre-authentication throttle of 30 requests in 60 s [SP:ID-P12]: 150 guesses in 300 s, 1.5 × 10^-4 per code, thirty times the stated bound.
- A successful guess yields a paired device, not a session: a sign-in still follows. In this demo that second step is weak (SD-17), and a local client can reach the web sign-in without pairing at all (GS-03). The pairing code is therefore not the weakest link.

**Acceptable for this boundary**, with SD-04.

### 5.2 GD-02: which role performs a reset

| Option | What it is | For | Against |
|---|---|---|---|
| (a) A non-superuser owner role | `dems_owner` owns the databases and objects and may create databases; the bootstrap superuser is used at provisioning only | The running server never holds superuser credentials. The session setting that skips triggers is not available to it. The two `SECURITY DEFINER` functions run without superuser rights. The reset stays one in-process routine, which is the simplest form of the "most delicate routine of the server" [SP:GS-13] | One more role and one more password file; four sections of the contract change; a few PostgreSQL behaviours to prove in the provisioning trial |
| (b) A separate short-lived reset process | The server closes its pool, starts `db:reset` as a child, waits, reopens | The owner credential is never in the server's address space; one implementation for the operation and the command line [SP:DC-9] | Inside one uid the server can read the password file anyway, so the separation cannot be enforced. A process boundary is added to the reset: exit-code mapping, a child that outlives a crashed parent, the actor passed as an argument, start-up time against the 8,000 ms command time-out [CL:L226]. Alone it leaves a superuser in the path |
| (c) Accept for the demo | No change | No work | G-2 is not true for the role that resets (SD-01); a defect in the reset path would run with superuser rights; the controller's preference is not met |

**Recommendation: (a).** Option (b) may be added on top later; it is not required.

The exact change:

1. [DB:§7.1] Three roles. `dems_admin`: the bootstrap superuser created by `initdb`; used only by `scripts/pg/` at provisioning, to create the two other roles, and at removal; no file under `apps/core-server/` reads its password file (a static test). `dems_owner` (new): `LOGIN NOSUPERUSER CREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`; owns every project database and object; used by `db:create`, `db:migrate`, `db:seed`, `db:reset`, `db:status`, the test helper and the in-server reset connection; its password is generated like the others and kept in its own file under `.data/` with mode 0600. `dems_app`: unchanged, but created at provisioning and no longer by `db:create`.
2. [DB:§7.2 OW-1, OW-2; §8.4; §8.5] The owner is `dems_owner`; `CREATE DATABASE … OWNER dems_owner`. Step R-0 gains a check: the reset connection's role has `rolsuper = false`, otherwise the routine stops with `RESET_ROLE_PRIVILEGED` and nothing was touched.
3. [DB:§7.4] A ninth boot check: `SELECT rolsuper FROM pg_roles WHERE rolname = 'dems_owner'` is false.
4. [SP:§2.1 C-5; §12.4 DC-5; §14.1; SR-58] "the owner role, which is not a superuser"; "the server never reads the bootstrap superuser's password file".
5. Row 23 trial, added to T5, all as `dems_owner` (each a **hypothesis** until run): create a database from `template0` with the contract's options; clone it; rename it inside a transaction (DA-04); drop it; `SET session_replication_role = replica` fails with `42501`; `CREATE ROLE` fails with `42501`. If `DROP DATABASE … WITH (FORCE)` of the test helper [DB:PG-13] is refused for sessions of `dems_app`, the helper closes its own pools first, or `dems_owner` is granted `pg_signal_backend`.
6. Controller: one decision that amends the "two roles" of [AN:273] and closes [DEC:F23] for GD-02.

### 5.3 Cookie on plain-HTTP loopback (G-08)

- `HttpOnly`, `SameSite=Strict`, `Path=/`, no `Domain`: as the guidance states [R10:212].
- No `Secure`, no `__Host-`: **accepted.** An insecure page cannot set a `Secure` cookie except under a localhost exemption that differs per browser; in the one comparison the research found, Chrome accepts `Secure` and refuses `__Host-`, Safari refuses both, and `127.0.0.1` itself is not confirmed [R10:261, R10:621]. Setting either attribute risks a cookie that the browser drops, and gains nothing on a transport that has no TLS to restrict the cookie to.
- The cookie reaches every port of 127.0.0.1 that the browser profile visits [R10:254; AN:600], including another project's server on `127.0.0.1:5174` [SP:L155]. The token is random, revocable, idle-limited to 15 minutes and absolute-limited to 8 hours. Accepted as residual R-02, with the operational note that the demo uses its own browser profile.
- Condition: if any listener ever leaves loopback or TLS is added (U4), `Secure` and `__Host-` become mandatory and this ruling lapses.
- Row 64's live sign-in records the browser and its version, so the "not confirmed" of the research is closed by an observation.

### 5.4 The demo password in Live mode (G-12, SR-63, GS-01, GS-10)

Facts: the seeded operators keep `DEMO_OPERATOR_PASSWORD` by decision Q12 [DEC:D4]; its literal is in `README.md` and a release script [DEC:F7]; the server stores only its Argon2id hash [SP:§14.1]; no operation changes a password [SP:ID-11]; the login screens of both clients show the three usernames and the password hint in Live mode, without role chips, hidden in presentation mode [CL:WS-9; §9.2].

Ruling: **accepted inside the boundary.** Together with GS-03, any client that reaches the loopback listener can sign in as any seeded operator, including the one SUPERVISOR who holds user administration, pairing management and the demo controls. In Live mode the sign-in demonstrates the mechanism; it does not protect the data. That is acceptable only because the listener is loopback (SR-01), the data is synthetic (SR-62) and the machine is the user's own.

What Live mode may show: the disclosure may stay. It tells nothing that `README.md` does not. Conditions:

| ID | Condition |
|---|---|
| C1 | The disclosure and the Live section of `README.md` say in plain words that these are published demo credentials for synthetic accounts on a local demo |
| C2 | No server data is shown before sign-in (no role chip). Already specified [CL:WS-9] |
| C3 | Hidden in presentation mode. Already specified. GC-07 (a fresh tab does not know the server's setting) is accepted: the value is public, so no contract change is required |
| C4 | SR-63 gains: "Live mode with the published password is permitted only while every listener is on loopback. A change under U4 MUST first replace the seeded password and remove the disclosure." The controller records this as a decision, so that a later task cannot inherit the password by accident |

Not required: a seed-time override of the password from a git-ignored file. It is the natural first step if C4 is ever triggered.

### 5.5 DEPARTURE-6 and the device credential without an authentication requirement

Accepted for this task. Live mode exists only in debug builds on emulators [CL:MD-6; SP:§10.3]; there the operating system does not require the biometric check for a protected read anyway [R11:159], and the app's data is within reach of the host user (**hypothesis**: through `adb` on a debug build; general Android knowledge). So storing the biometric token without `requireAuthentication` removes no protection that exists on those devices. The server-side properties are unchanged: single use, rotation, reuse detection, binding to device and operator, revocation [SP:SR-36, SR-37]. The device credential needs no authentication requirement because the gate must read it at start [AN:452].

Conditions (SD-18):

1. The case in use is recorded per AVD (already MB-8 and AC-C-71).
2. Case (c) is allowed only where `isDevice` is false or the build is a debug build. On anything else a failing protected write turns biometric sign-in off; it does not fall back silently. A Live build on a physical device is U4 and needs a new review.
3. With `protected: false` no text on the screen claims that the token is protected by the device's hardware.

### 5.6 The reset and the audit trail (G-10, DC-8, GS-13)

Accepted: the reset is the one deliberate exception to append-only. It is behind a permission and a flag that is off by default and read at boot [SP:DC-1, DC-2]; it is done by the owner role, never by an UPDATE, DELETE or TRUNCATE [DB:§6.6]; the new chain's `SCENARIO_LOADED` row names the operator, the scenario, the row count and the head hash of the discarded chain [SP:§12.4; DB:R-5e]; the old database is dropped only after the new one is complete and verified [DB:R-6 to R-8]. It is visible to every role through the audit page. Two improvements: the role (SD-01) and a durable lineage across more than one reset (SD-19).

---

## 6. Rulings on the points handed to row 20

| Point | Source | Ruling |
|---|---|---|
| G-08 cookie attributes on loopback | [SP:SR-18; OR-8] | Accepted (section 5.3) |
| G-10, DC-8 reset rebuilds the chain | [SP:DC-8] | Accepted (section 5.6), with SD-01 and SD-19 |
| G-11 no identifier renewal on a role change | [SP:SR-14]; [R10:212] | Accepted. The guidance aims at an identifier that carries or predates a privilege level; here the token is issued after authentication, carries no privilege, and the role is read per request [SP:RB-3]. Disable, revoke and unpair do end the session |
| G-12, SR-63 published password | [SP:SR-63] | Accepted with C1 to C4 (section 5.4) |
| GS-01 no password change | [SP:L1794] | Accepted; tied to C4 |
| GS-02 no view permission | [SP:L1795] | Accepted: parity with Simulated mode; the matrix is read-only |
| GS-03 a forged Origin reaches the web sign-in | [SP:§6.9] | Accepted: a hostile local process is outside the boundary, and the file says so plainly. The pairing requirement binds the app, not the network. Option, not required: a console key that the dev proxy injects from a file under `.data/` |
| GS-04 bearer session on mobile | [SP:L1797] | Accepted: proof of possession is the standard answer [R10:348] and is out of scope with PKI |
| GS-05, G-26 lockout counters in memory | [SP:SR-25] | Accepted; the PostgreSQL store is not required |
| GS-06 a server start writes no audit row | [SP:L1799] | Accepted; the server log shows it |
| GS-07 429 and `DEMO_DISABLED` are logged, not audited | [SP:L1800] | Accepted, and relied on by SD-03 |
| GS-08 the `state` topic is not filtered per permission | [SP:RB-10] | Accepted while the matrix is read-only and AC-B-17 holds |
| GS-09 six-digit code hash | [SP:L1802] | Accepted (section 5.1) |
| GD-01 the database checks the link, not the digest | [DB:L1229, L1875] | Accepted: a writer that may insert can compute a valid digest, so the check would catch defects only; B-8 and operation 60 report them |
| GD-02 superuser owner | [DB:L1876] | SD-01, option (a) |
| DEPARTURE-6 | [CL:L1460] | Accepted with conditions (section 5.5) |
| The device credential without an authentication requirement | [CL:§9.1] | Accepted (section 5.5) |
| GC-07 presentation mode before sign-in | [CL:L1395] | Accepted as is (C3) |
| GC-09 Try-it with real commands | [CL:L1397] | Accepted with SD-16 |
| The pairing code in page memory and on screen | [CL:§10.3] | Accepted with SD-20. A code on a projected screen is visible to the room for up to 300 s; it is single use and "Cancel code" closes it |
| `NONE-P` commands | [SP:§19.5 Row 20 #3] | SD-28 |
| Parameters chosen without a source: throttle 30 and 600 a minute, 16 connections, a 30-day biometric token, a 5 s sweep | [SP:§19.5 Row 20 #4] | Accepted. The sweep is far tighter than the 30 minutes the guidance calls common [R10:275]; the 30-day token expires on inactivity as RFC 9700 asks [R10:341]. SD-03 and SD-13 refine the throttle and the cap |
| `@fastify/helmet` | [SP:§19.5 Row 20 #5] | Adopt (SD-14) |

---

## 7. Corrections to fold into the plan before implementation

Ordered by severity, then by the first row that depends on them.

| # | Correction | Finding | Before row |
|--:|---|---|---|
| 1 | A non-superuser owner role `dems_owner`; the superuser only at provisioning; the trial steps of section 5.2 | SD-01 | 23 |
| 2 | Two Origin lists: web console origins for the cookie and for ID-1(a); the instance's own origin only for requests without a cookie | SD-02 | 32 |
| 3 | A denial budget at the throttle stage; the bucket of a retired device credential | SD-03 | 33 |
| 4 | Server-native state changes are atomic: one unit in the pipeline, an attempt consumed before the verification, compare-and-set transitions, the five tests | SD-04 | 28 (contract text), 32, 35, 36 |
| 5 | The request log holds the route pattern, not the URL; parse errors are logged by code; the extended log-capture test | SD-05 | 25 |
| 6 | `ENABLE ALWAYS` on both audit triggers; B-5 expects `'A'` | SD-06 | 28 |
| 7 | Add `TOKEN_REUSE` to the closed set of session end reasons; end the family's sessions on reuse | SD-10 | 28 |
| 8 | The allowlist without `localhost`; exact match; `null` refused; the negative test through the proxy | SD-07 | 32, 62 |
| 9 | The cookie name per instance | SD-08 | 32 |
| 10 | One credential per request; the transport of a session is bound | SD-09 | 32 |
| 11 | The throttle key is the resolved principal or a fixed class; upgrades are counted | SD-12 | 25, 32, 38 |
| 12 | Response headers on the Core server; `@fastify/helmet` 13.1.1 in the dependency list | SD-14 | 25 |
| 13 | Secrets: modes, the content of `pg.env`, no secret in an argument, the `pg_hba.conf` check | SD-15 | 23 |
| 14 | `reportBiometricFailure` names an operator only with an enrolment | SD-11 | 32 |
| 15 | A separate cap for anonymous sockets | SD-13 | 38 |
| 16 | The Try-it deny list for operations 2, 7, 8, 15, 18, 23 | SD-16 | 99 |
| 17 | The demo-password conditions C1 to C4 | SD-17 | 64, 80, 101 |
| 18 | The DEPARTURE-6 conditions | SD-18 | 79 |
| 19 | A durable lineage of discarded chains | SD-19 | 28 or 48 |
| 20 | Clear the administration queries and the code memory on sign-out and on permission loss | SD-20 | 62, 76 |
| 21 | Password details: always compute, the pepper sentence, the salt source | SD-21 | 32 |
| 22 | The actor scope is cleared in a `finally` | SD-22 | 37 |
| 23 | The client log scans include a marker password and a marker code | SD-23 | 79, 81, 99 |
| 24 | Info items: the cookie's `Max-Age`, the supply-chain records, the boundary sentence, the incremental chain check, the log line for the two unaudited commands, the note on operation 23 | SD-24 to SD-29 | as named |

---

## 8. Accepted residual risks for the controller to record

| ID | Residual risk | Why it is accepted |
|---|---|---|
| R-01 | In Live mode any client that reaches the loopback listener can sign in as any seeded operator: the password is published and the Origin can be forged | Loopback only, synthetic data, the user's own Mac. Tied to condition C4 |
| R-02 | The session cookie has no `Secure` attribute and no `__Host-` prefix and is sent to every port of 127.0.0.1 that the same browser profile visits | No TLS inside the boundary; the token is random, revocable and short-lived |
| R-03 | All traffic between the browser, the dev proxy, the server, PostgreSQL and the emulators is cleartext on the loopback interface | Boundary |
| R-04 | The session identifier is not renewed on a role change | No privilege is stored in the session |
| R-05 | The mobile session token and the device credential are bearer secrets with no proof of possession; the device credential has no expiry | PKI is out of scope; revocation is immediate |
| R-06 | The device credential is never rotated in this task; the rotation operation exists and is unused | Revocation ends a copied credential |
| R-07 | On emulators the biometric token may be stored without the operating system's authentication requirement | The emulators do not enforce it anyway; the server-side token rules are unchanged |
| R-08 | A reset discards the audit chain | Behind a permission and a flag that is off by default; the new chain records the old head |
| R-09 | The database checks the chain link, not the digest | A defect is reported by the stored-chain check |
| R-10 | Lockout counters are in memory; a restart clears a lock; the web console has one lockout key, so five failures lock every web sign-in for 60 s | A 60 s lock; only a local client can cause either |
| R-11 | Any local client can lock pairing for 60 s at a time, close the active code with five wrong attempts, or fill the pre-authentication throttle | Denial of service by a local client is outside the boundary |
| R-12 | Every signed-in role reads the audit log, the events and every status page; the `state` topic is not filtered | Parity with Simulated mode; the matrix is read-only |
| R-13 | PostgreSQL 18.4 is two minor releases behind 18.6; the binaries come through a single-maintainer npm package without a recorded provenance attestation | Loopback and password authentication; pinned version, reviewed install script, recorded signatures; the fallback route has 18.6 |
| R-14 | The dev server that serves the console in Live mode sends no content-security policy | Live mode exists only in dev builds; the packaged policy is unchanged; the cookie is `HttpOnly` |
| R-15 | The six `NONE-P` commands write no audit row | Parity with the simulator's audit sequence; two of them get a log line |
| R-16 | No password change, no per-account lockout, no multi-factor sign-in | Demo scope (Q12) |
| R-17 | A pairing code is shown on screen for up to 300 s | Single use, five attempts, a visible cancel action |

---

## 9. Security-review-gate, GDPR and ISO applicability

**Security-review-gate** (level L3: the design covers authentication changes and a destructive reset; the review itself is read-only).

| Check | Result | Details |
|---|---|---|
| Credential leak | CAUTION | No credential value in the three files or in this one. Design: SD-05, SD-15, SD-23 |
| Destructive operation | CAUTION | The reset drops a database after building its replacement; roll-back is the old database until step R-7 [DB:§8.5]. SD-01, SD-19 |
| External call | PASS | The server opens no outbound connection [SP:SR-03]; registry fetches happen only in the install rows [AN:H-09] |
| Injection | PASS | Bind parameters only [SP:SR-67; DB:NL-3]; database names from a closed list [DB:L1563]; one utility statement with an escaped literal, guarded by a pre-check [DB:L1362] |
| Permission escalation | CAUTION | SD-01 (superuser for a reset); SD-02 (an own-origin sign-in would bypass pairing) |
| **Overall** | **CAUTION** | No FAIL; proceed with the corrections of section 7 |

**GDPR.** The data is synthetic by requirement [SP:SR-62; U7], so the regulation is not triggered by the demo dataset. Design observations only: data minimisation holds (no hardware identifier is collected [SP:§6.7]; a typed unknown username is never recorded [SP:ID-4]); there is no erasure, export-of-own-data or retention mechanism and none is needed for synthetic data; they would be needed before any real personal data (U7 forbids it in this task). G-24 and GD-11 (a seeded given name equal to the workspace identity's) stay the controller's call; this review requires nothing there.

**ISO 27001 Annex A, design level.**

| Control | Status | Note |
|---|---|---|
| A.9 Access control | Met with corrections | RBAC, deny by default, lockout, revocation; no multi-factor (R-16); SD-02, SD-04 |
| A.10 Cryptography | Met inside the boundary | Argon2id, SHA-256 of random tokens; no TLS and no encryption at rest by boundary (R-03) |
| A.12.4 Logging and monitoring | Met with corrections | Hash-chained audit, one row per denial; SD-03, SD-05, SD-19 |
| A.12.6 Technical vulnerability management | Partly | Pinned versions and registry signatures; SD-25 adds `npm audit` records; R-13 |
| A.13 Communications security | Met inside the boundary | Loopback only, Origin guard, no CORS |
| A.14 Secure development | Met | Four security review rows in the blueprint (20, 50, 111, 112), acceptance tests per requirement |
| A.16 Incident management, A.18 Compliance | Not applicable | A local demo with synthetic data |

---

## 10. U1 to U9 check

No finding requires an item that is the user's call [RT:223-231].

| Item | Needed by any correction? |
|---|---|
| U1 Docker | No |
| U2 a login or background service, a shell-profile edit | No |
| U3 installing PostgreSQL | No new install: SD-01 adds a role inside the cluster that D5 already covers |
| U4 a listener beyond loopback, cleartext in a release APK | No. SD-17 and section 5.3 name what must happen first if U4 is ever lifted |
| U5 a hosted service or an account | No. SD-14 adds one npm package that the decision record already pinned |
| U6 a remote, a push, publishing | No |
| U7 real personal data | No |
| U8 deleting or renaming | No |
| U9 wiping an emulator, stopping another project | No |

---

## 11. Verification against the row's criteria

| Criterion [blueprint row 20] | Where |
|---|---|
| Verdict stated | Top of the file: CAUTION |
| Every checklist item cites a spec section | Section 3, column "Sections checked" (18 of 18) |
| Each CAUTION or FAIL names the owning row and the expected correction | Section 4 (29 findings, each with a correction and an owning row); section 7 |
| No finding requires a U1-U9 action | Section 10 |
| Tier 1 block | Section 1 (subject, stakeholders, timeline, scope, rationale, method, alternatives, assumptions, gaps) |
| No credential value printed | Constant names only; a search of this file for the two literal values returns no match (the values were read into shell variables and never printed) |

---
*Generated: 2026-10-04 04:25*
*Last Updated: 2026-10-04 04:25*
