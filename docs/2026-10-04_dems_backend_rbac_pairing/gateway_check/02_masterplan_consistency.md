VERDICT: PASS-WITH-NOTES

---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: verifier
blueprint_row: 19 (FIRM)
tier: 2
type: masterplan coverage and cross-consistency check (read-only; documents, not code)
verdict: PASS-WITH-NOTES
checked: masterplan/01_specs.md rev 2 (270,122 bytes, 05:09); masterplan/02_plan.md rev 2 (249,133 bytes, 05:31); masterplan/03_database_contract.md rev 2.1 (293,840 bytes, 05:23); masterplan/04_client_integration_spec.md rev 2 (227,441 bytes, 05:09)
checked_against: identification/01_translated.md; decisions/decisions.md (D1-D20, DR-01..DR-04, F1-F25); gateway_check/03_security_design_review.md (lines 1-352); identification/02_structured.md (row 19 text only)
last_updated: 2026-10-04 05:52 WIB
---

# Masterplan coverage and cross-consistency check (row 19)

## 0. Result in one screen

| Question of the row | Result | Evidence |
|---|---|---|
| 13 feature areas, 25 impact questions, 11 success criteria, 16 defaults covered | 65 of 65 PASS | section 2 |
| U1-U9: does any document REQUIRE one | No (9 of 9 PASS) | section 2.5 |
| Operations without an access rule or an audit rule | 0 of 75 | section 3 |
| Stored entities without a table (and tables without an entity) | 0 of 26 (0 of 30) | section 4 |
| AC-B, AC-C, SR without a plan row | 0 of 93, 0 of 110, 0 of 82 | section 5 |
| Plan rows with a defect in agent, dependency, verification or rollback | 0 of 105; 81 rows name write paths, 24 read-only rows state "(none)" (finding C-08) | section 6 |
| Write-path overlaps between rows with no dependency path | 0 | section 6.3 |
| Waves above 6 of one type or 8 in flight | 0 (peak 7 in flight; coder-execution x6) | section 6.4 |
| Security findings SD-01..SD-29 reflected in a spec and in a plan row | 27 of 27 that need a row; SD-26 and SD-29 are specification text, as the plan states | section 7 |
| Two documents state different rules that an implementer would act on | None found | sections 8, 9 |
| Open markers left in the four files | 01_specs.md: yes, all on points D18 has ruled (finding C-01). The three other files: none | section 10 |
| Credential values, real personal data | 0 occurrences in all four files | section 10.3 |

Findings: **0 Blocker, 2 Major, 11 Minor** (section 11). No criterion, operation, entity or plan row is uncovered, and no two documents contradict each other on a rule; hence PASS-WITH-NOTES and not FAIL. The two Major findings are stale or incomplete text that can mislead an implementer or a rollback, each with an exact correction and an owning row.

**Severity scale used here.** Blocker: something is uncovered, or two documents state different rules for the same thing. Major: one document carries a marker or a row attribute that, taken literally, stops an implementer or produces a wrong result, while the binding rule is stated unambiguously elsewhere. Minor: stale wording, counts or references with no effect on what is built.

**Citations.** `[SP:...]` = masterplan/01_specs.md, `[PL:...]` = 02_plan.md, `[DB:...]` = 03_database_contract.md, `[CL:...]` = 04_client_integration_spec.md, `[RT:...]` = identification/01_translated.md, `[DEC:...]` = decisions/decisions.md, `[SDR:...]` = gateway_check/03_security_design_review.md. Sections and rule IDs are cited, not line numbers, as the brief asks. Paths are relative to the workspace root.

**No credential value appears in this file.** The demo password and the pairing code were read from `packages/shared/src/sim/dataset.ts` into variables and searched for; only counts are reported.

---

## 1. Method (how this was verified)

Nothing was executed against the product: no test, no server, no database, no install. The only commands were read-only text processing over the Markdown files and three source files.

| # | Check | How | Kept where |
|--:|---|---|---|
| 1 | Operations | A script parsed the 13 operation tables of [SP:§7.4-§7.16] (header `# / operationId / Method and path / Access / Audit`), counted rows, IDs, methods, the access marker of each row and the audit cell, and grouped the operations by permission | scratch `row19/ops.py` |
| 2 | Audit vocabulary | The keys of `AUDIT_TYPE_CATEGORY` in `packages/shared/src/sim/vocabulary.ts` (44) plus the nine types of [SP:§13.1] were compared with every audit type named in the operation tables and in [SP:§4.7, §5.4, §6.2, §6.3, §13.2] | inline script |
| 3 | Simulator actions | The 42 callable members of `SimActions` in `packages/shared/src/sim/types.ts` (lines 985-1094) were compared by name with the 42 rows of [SP:§7.17] | inline script |
| 4 | Entities and tables | The E-nn rows of [SP:§3.3] against the map of [DB:§3.1]; the table inventory [DB:§3.3] against the section headings [DB:§4.1-§4.30] and the privilege matrix [DB:§7.3] | scratch `row19/ent.py` |
| 5 | Plan rows | A script parsed the five work-row tables of [PL:§8.2-§8.5a] (11 columns, 105 rows, 0 rows with a wrong cell count) and checked agent, tier, wave, dependencies (existence, cycles, transitive closure), locks, verification and rollback | scratch `row19/plan.py`, `plan2.py`, `plan3.py` |
| 6 | Criteria coverage | Recomputed from the "Implements" cells only (ranges `..` and `to` expanded), not from the plan's own tables; then the plan's tables [PL:§13.1-§13.3] were compared with the recomputation | scratch `row19/cov.py`, `cov2.py` |
| 7 | Collision scan | Every pair of the 105 rows: backticked paths, `{a,b}` expanded, `**` and `*` matched as globs; a pair counts as a collision only when neither row is an ancestor of the other in the dependency graph | scratch `row19/coll.py` |
| 8 | Names and numbers | Regular-expression tabulation, per file, of ports, npm script names, `.data/` paths, role and database names, environment variables, cookie names, lock files, storage keys, package versions, and the security parameters | inline scripts |
| 9 | Decisions and leftovers | Search of the four files for the superseded statements the brief names and for open markers; each hit read in context | inline scripts |
| 10 | By reading | [SP] revision history, §2-§7, §8.2, §10-§19 in full; [PL] revision history, §3, §4, §5.5, §7, §8.1, §8.6, §9, §13.4, §13.5, §14, §18 and the cells of 36 work rows; [DB] revision history, §3, §4.30, §7, §8.4, §9.4, §10, §15.5, §15.6 and the rules and tests of §5.6; [CL] front matter, §3, §4, §5.1-§5.2, §7, §9, §15, §17 (long lines of §7, §15 and §17 cut at about 400 characters) | — |

The agent list used for "a real agent" is the content of `~/.claude/agents/` (28 files). The files were not modified during the check (sizes and times above were read before and after).

---

## 2. Coverage matrix

### 2.1 The 13 feature areas [RT: "Feature areas that all features covers"]

The operation count per area is the script's count of the rows of each table; the sum is 75.

| # | Feature area | Server spec | Operations | Client spec | Plan rows (server; web; mobile; test) | Result |
|--:|---|---|--:|---|---|---|
| 1 | Identity and sign-in | [SP:§5; §7.5] | 8 (2-9) | [CL:§5; §9.2; §9.3; §7.3 G8; §7.4 `auth`, `features/login`] | W24, W41; W55; W56, W59 | PASS |
| 2 | RBAC | [SP:§4; §7.6] | 5 (10-14) | [CL:§6; §10.2] | W28, W33; W54, W77; (gates in every mobile row); W47 | PASS |
| 3 | Pairing and device registry | [SP:§6; §7.7] | 9 (15-23) | [CL:§9.4; §10.3] | W32; W81; W57, W60; W48 | PASS |
| 4 | Sessions and recording lifecycle | [SP:§7.8] | 15 (24-38) | [CL:§7.3 G5, G11, G12; §7.4 `session-*`; §8] | W34; W63, W64, W65; W67, W68, W72, W73; W49 | PASS |
| 5 | Evidence | [SP:§7.9; §11] | 5 (39-43) | [CL:§7.3 G7; §7.4 `features/evidence`] | W35; W69; W74 | PASS |
| 6 | Devices and inputs | [SP:§7.10] | 9 (44-52) | [CL:§7.3 G6; §7.4 `features/devices`] | W36; W70; W78 | PASS |
| 7 | Storage | [SP:§7.11] | 3 (53-55) | [CL:§7.3 G13; §7.4 `features/storage`] | W37; W71; W79 | PASS |
| 8 | Network and time | [SP:§7.12] | 2 (56-57) | [CL:§7.3 G9; §7.4 `features/network-time`] | W37; W71; W79 | PASS |
| 9 | Security and audit | [SP:§7.13; §13] | 6 (58-63) | [CL:§7.3 G10; §7.4 `features/audit`] | W39; W75; W80 | PASS |
| 10 | System and maintenance | [SP:§7.14] | 5 (64-68) | [CL:§7.3 G14; §7.4 `features/settings`] | W40; W76; W82 | PASS |
| 11 | Realtime status | [SP:§7.15; §9] | 2 (69-70) and the channel `/ws` | [CL:§2.2; §2.3] | W22, W42; W30, W44 (shared layer); W49 | PASS |
| 12 | Service health and the API reference | [SP:§7.4] | 1 (1) | [CL:§11; §7.3 G4] | W08; W83, W84; W51 (`use-health.ts`) | PASS |
| 13 | Demo controls | [SP:§7.16; §12] | 5 (71-75) | [CL:§7.3 G14; §7.4 `features/settings`] | W43; W76; W82 | PASS |

Wiring map: 18 web groups G1-G18 [CL:§7.3] and 21 mobile groups [CL:§7.4] are present, plus the two new portal pages and two folders outside the inventories; each group that changes a file has a plan row (section 6.5).

### 2.2 The 25 impact questions [RT: "Impact Questions for the Architect"]

Each anchor heading was confirmed to exist and to hold content (script: heading found, table rows counted).

| IQ | Question (short) | Answered in | Result |
|--:|---|---|---|
| 1 | Live and Simulated coexistence; what the UI shows | [SP:§10.1 "Mode contract (server side)"]; [CL:§3 "Mode switch per build type and the mode indicator"] | PASS |
| 2 | 0.1.0 untouched; versioning of a live edition | [SP:§10.2 "Released artefacts and versioning"] | PASS |
| 3 | How a release APK reaches a backend | [SP:§10.3 "Client reachability and its limits"] (it does not, without U4) | PASS |
| 4 | Install, start, stop, remove PostgreSQL; port; data directory | [PL:§14 "PostgreSQL provisioning and the Host Impact Register"] | PASS |
| 5 | PostgreSQL on a demo PC, four OS targets | [PL:§15 "PostgreSQL on a demo PC"]; [SP:§10.4] | PASS |
| 6 | Test database and its isolation | [DB:§10 "Test-database isolation"] | PASS |
| 7 | Dataset migration; date-relative seeding | [DB:§9 "Seed mapping and seed clock rule"]; [SP:§8.5] | PASS |
| 8 | Where demo media live; who serves them | [SP:§11 "Media and evidence package files"] | PASS |
| 9 | Reset to the seed state | [SP:§12.4]; [DB:§8.5 "Reset and carry-over routine"] | PASS |
| 10 | A session recording when the backend stops | [SP:§8.6 "Engine: restart and recovery"] | PASS |
| 11 | Hashing, session model, expiry, revocation, credential storage | [SP:§5; §15.2]; [CL:§9.1 "Credential storage per client"; §5.3] | PASS |
| 12 | Lockout and rate limiting | [SP:§5.1; §6.1; §15.4] | PASS |
| 13 | Socket authentication; what an unpaired or signed-out client receives | [SP:§9.2 "Realtime protocol: authentication and visibility"] | PASS |
| 14 | Audit: append-only, chain, which actions write a row | [SP:§13; §8.3]; [DB:§6 "Audit table: append-only and chain serialisation"] | PASS |
| 15 | Secrets | [SP:§14.1 "Secrets handling"]; [DB:§7.6] | PASS |
| 16 | CORS and the packaged content-security policy | [SP:§14.2]; [CL:§4 "Web transport: the dev proxy"] | PASS |
| 17 | Biometric and security-key sign-in | [SP:§5.5; §5.6]; [CL:§9.3] | PASS |
| 18 | Permission list and role matrix | [SP:§4 "RBAC model: permissions and role matrix"] | PASS |
| 19 | How clients learn of a permission or pairing change | [SP:§4.7]; [CL:§6 "Reacting to a role change and to a revocation"] | PASS |
| 20 | Pairing lifecycle, device identity, re-pairing | [SP:§6]; [CL:§9.4 "Pairing flow and the pairing-required gate"] | PASS |
| 21 | Endpoint list, realtime schema, resync | [SP:§7 "API contract: operation tables"; §9.4] | PASS |
| 22 | Changing the shared contract without collisions | [PL:§16 "Changing the shared contract without collisions"; §4.1 contract slot] | PASS |
| 23 | The API Reference page when every operation is live | [CL:§11 "API Reference page in both modes"] | PASS |
| 24 | Test strategy | [PL:§12 "Test strategy"; §11]; criteria [SP:§16], [CL:§13] | PASS |
| 25 | Predecessor known issues touched | [PL:§17 "Known issues touched (KI-01, KI-02, KI-07, KI-18)"] | PASS |

### 2.3 Success criteria SC1-SC11 [RT: "Success Criteria"]

| SC | Covered in the specs | Proven by (plan) | Result |
|---|---|---|---|
| SC1 | [SP:§17.1] | [PL:§13.4]: W101 compares the commit time of row 22 with the log of W01 | PASS |
| SC2 | [SP:§17.1]: AC-B-01..08, 52, 57, 72, 87, 93 | W53, W58, W90 (built by W07, W17, W20, W26, W29) | PASS |
| SC3 | [SP:§17.1]; [CL:§15.2] | W49, W95 | PASS |
| SC4 | [SP:§17.1]; [CL:§15.2] | W47, W96 | PASS |
| SC5 | [SP:§17.1]; [CL:§15.2] | W48, W94 | PASS |
| SC6 | [SP:§17.1]; [CL:§11; §15.2] | W52, W83, W84 | PASS |
| SC7 | [SP:§17.1]: AC-B-58, 68; [CL:§15.2] | W87, W89 | PASS |
| SC8 | [SP:§10; §17.1]: AC-B-59..63; [CL:§3; §12.1] | W97 | PASS |
| SC9 | [SP:§19]; [CL:§17]; [PL:§23] | W88, W102, the controller | PASS |
| SC10 | [SP:§14; §15; §17.1]; [CL:§15.2] | W99, W100, W103 (and W104, W105) | PASS |
| SC11 | [SP:§17.1]: AC-B-67, 92; [CL:§15.2]: AC-C-84 | W86 (writes), W90 (follows the README literally) | PASS |

### 2.4 Defaults Q1-Q16 [RT: "Open Questions With Recommended Defaults"; DEC:D4]

| Q | Default adopted | Where it is honoured | Result |
|---|---|---|---|
| Q1 | Simulated mode stays beside Live | [SP:§10.1]; [CL:§3.1] (default Simulated in every build) | PASS |
| Q2 | New backend app; mock-core unchanged | [SP:§2.1 P-2, P-4]; [PL:§4.3 "No writer exists for apps/mock-core/**"] | PASS |
| Q3 | PostgreSQL provisioning per D5 | [SP:§2.1 P-1]; [PL:§14.1] | PASS |
| Q4 | Store records and periodic health snapshots; stream meter frames | [SP:§3.1; §3.2]; [DB:§3.2] | PASS |
| Q5 | Pairing mandatory for mobile in Live mode | [SP:ID-1; §6.6; §14.2]; [CL:§9.4 MP-11] | PASS |
| Q6 | Mobile through `adb reverse` on loopback | [SP:§2.1 P-6; §10.3]; [CL:§9.6]; [PL: W13] | PASS |
| Q7 | 0.1.0 stays the offline edition; live package costed, not built | [SP:§10.2; §10.4]; [PL:§15] | PASS |
| Q8 | Portal-issued one-time code, also a QR; code entry; device-bound credential | [SP:§6]; [CL:§9.4; §10.3]; scanning deferred by DR-02 | PASS |
| Q9 | Read-only matrix; user list with role assignment and enable/disable | [SP:§4; §7.6]; [CL:§10.2] | PASS |
| Q10 | Three roles; new permissions | [SP:§4.3; §4.4] | PASS |
| Q11 | Biometric unlocks a credential on a paired device; security key only in Simulated mode | [SP:§5.5; §5.6]; [CL:§9.3 MB-9; WS-8] | PASS |
| Q12 | Seeded operators keep the demo password, stored as a hash | [SP:ID-11; SR-63]; [CL:WS-9; §9.2] | PASS |
| Q13 | The portal does not pair; truthful trust line | [SP:§6.9]; [CL:§5.5 WS-7] | PASS |
| Q14 | Demo controls behind a permission and a demo flag | [SP:§12]; [PL:§3.4 `DEMS_DEMO_CONTROLS`] | PASS |
| Q15 | The server clock is authoritative | [SP:§8.4] | PASS |
| Q16 | One active session; any operator with the session permission may stop it | [SP:§7.8]; AC-B-49, AC-B-50 | PASS |

### 2.5 U1-U9: no document requires one [RT: "Items That Remain the User's Call"]

| U | Item | What the documents say | Result |
|---|---|---|---|
| U1 | Docker | [PL:§14.1] "No Docker"; [PL:§14.2] "Not changed by any row: ... Docker or Colima"; [SP:§17.6] | PASS (not required) |
| U2 | Login or background service; shell profile | [PL:§14.1] "no launchd job, no login item, no shell-profile edit"; W07 verification "no process, launchd job or brew service after stop" | PASS |
| U3 | Installing PostgreSQL on the host | Decided by D5 and D11: npm binaries inside the project [PL:§14.1; H-01, H-02]. The Homebrew keg is the conditional fallback row Fb [PL:§8.6], scheduled only after a failed trial and a recorded drift, and "the user is told" | PASS (no host install on the planned route) |
| U4 | A listener off loopback; cleartext in a release APK; firewall prompts | [SP:SR-01; §10.3]; [PL:§4.2] "Every listener binds 127.0.0.1"; [CL:WT-7] cleartext in the debug manifests only; [PL:§14.2] a firewall prompt stops the row | PASS |
| U5 | Hosted database, hosted auth, cloud build, third-party account | [SP:SR-03]; [PL:H-09] lists registry and Maven fetches only | PASS |
| U6 | Git remote, push, publishing | W103, W104, W105: "No remote, no push"; verification `git remote -v` prints nothing | PASS |
| U7 | Real personal data | [SP:SR-62; AC-B-65]; [DB:§9]; section 10.3 below (0 occurrences) | PASS |
| U8 | Deleting or renaming mock-core, the simulator, `release/`, stored keys | [PL:§4.3] no writer for `apps/mock-core/**`, `release/**`, `scripts/release/**`, `packages/shared/src/sim/` other than two additive files; [SP:MC-5; AC-B-60..62]; [CL:§3.4]. W06 removes two stale `.locks` markers that D9 DN-4 ruled are the controller's own (rollback RB-16) | PASS |
| U9 | Wiping emulator data; stopping another project's servers | [PL:§5.5] "No row kills, wipes or snapshot-boots an emulator, and no row uninstalls the DEMS app or clears its data without a recorded controller decision"; [PL:§14.3 RB-07] `pm clear` is not used; DP-1 option B and DP-3 option B exist only as options that need a recorded decision | PASS |

---

## 3. Operations [SP:§7]

| Check | Result (script) |
|---|---|
| Operations in the 13 tables | 75 numbered rows (1-75, no gap, no duplicate) and one row for the channel `/ws`; 75 distinct `operationId`; no duplicate method and path |
| Methods | 27 GET, 48 POST (equals AC-B-09) |
| Exactly one access rule per operation | 75 of 75: `PUBLIC` 4, `DEVICE` 5, `AUTHENTICATED` 25, one permission 40, `ANY-OF` 1 (equals [SP:§19.1] and D13) |
| An audit rule per operation | 75 of 75 have a non-empty audit cell: an audit type, `NONE-R` (read) or `NONE-P` (parity with the simulator) |
| Every permission used exists in the list [SP:§4.3] and the matrix [SP:§4.4] | 12 permissions used, 12 listed, 12 matrix rows. The "Enforced at" column of §4.3 equals the tables for all 12 (for example `SESSION_START`: 24, 25, 26, 28-33, 37; `DEMO_CONTROL`: 71-75) |
| Matrix totals | INVESTIGATOR 4, SUPERVISOR 10, TECHNICIAN 4 = 18 grants. Denied cells: INVESTIGATOR 22, TECHNICIAN 31 (recomputed; equals GS-20 and F25) |
| Every audit type used exists in the vocabulary | The 33 existing types named in the operation tables, and 4 more named in [SP:§4.7, §5.4, §6.3, §13.2] (`AUTH_EXPIRED`, `TABLET_LINK_CHANGED`, `SESSION_INCOMPLETE`, `RECOVERY_COMPLETED`), are all keys of `AUDIT_TYPE_CATEGORY` (44 keys); the new types named are among the 9 of [SP:§13.1]; 44 + 9 = 53. `PRECHECK_STARTED` is named as an event and `AUDIT_TAMPER` as a fault kind, both correctly |
| The 42 simulator actions | 42 members in code = 42 rows in [SP:§7.17], same names; 40 map to 41 distinct operations, 2 are recorded exclusions (`signInWithSecurityKey` X-1, `setTabletLink` X-2) |
| Area totals | 8, 5, 9, 15, 5, 9, 3, 2, 6, 5, 2, 1, 5 = 75 (equals [SP:§17.5]) |
| Every operation has an owning server row | 1: W08; 2-6: W24; 7-9: W41; 10: W28; 11-14: W33; 15-23: W32; 24-38: W34; 39-43: W35; 44-52: W36; 53-57: W37; 58-63: W39; 64-70: W40; 71-75: W43 (75 of 75). Contract rows: W19 (areas 1, 2, 3, 13 and health), W27 (the 47 operations of areas 4-11) |

Zero operations without an access rule or an audit type.

---

## 4. Entities, tables and roles

| Check | Result |
|---|---|
| Stored entities of [SP:§3.3] | E-01 to E-26 (26) |
| Entity map of [DB:§3.1] | 26 entities, each once; none missing, none extra |
| Tables | 30 in the inventory [DB:§3.3] = 30 section headings [DB:§4.1-§4.30] = 30 in the entity map (29 for the 26 entities plus `schema_meta`) = 30 in the privilege matrix [DB:§7.3]; same names |
| Tables that carry no E-nn | `audit_chain_head` (mechanism table of E-10) and `schema_meta` (contract), both explained in [DB:§3.1] |
| "29 tables" still stated as current | No: the 6 occurrences in the four files are history notes (revision 1, D14) |
| Lineage entry | The columns of `audit_chain_history` are mapped one by one to the members of `AuditChainLineageEntry` in [DB:§4.30]; `first_seq` and `last_seq` are stored and not returned, as [SP:§19.6 choice 13] states (the third open point of GS-28 is thereby settled) |

**Roles.** Three roles in all three documents: [SP:§2.1 C-4 to C-6; SR-58; SR-68], [DB:§7.1], [PL:§3.4; §4.1; §14.1].

| Rule | Spec | Contract | Plan | Agree |
|---|---|---|---|---|
| `dems_app` has SELECT only on `audit_chain_history` | E-26, DC-6, SR-78, AC-B-87 | §7.3 matrix; B-5; §15.5 CONFLICT-1 DECIDED | W17 title and verification; §7.2 SD-19 | Yes |
| `dems_app` has no UPDATE, DELETE, TRUNCATE on `audit_log`; triggers `ENABLE ALWAYS` | SR-52; §13.3 | §7.3; §7.4 B-5 (`'A'`, three triggers) | W17 | Yes |
| Nothing connects as `dems_admin` after provisioning | SR-68 ("never holds"); but §2.1 C-6 and §14.1 also name "removal" (finding C-03) | §7.1 RP-6; "Removal needs no connection" | §7.3; P15; W07 | Yes on the rule; one stale phrase in the spec |
| `dems_owner` only for migrate, seed, reset, status, tests; in the server only inside a reset with the demo flag on | §2.1 C-5; DC-5 | §7.1; HC-1 to HC-4; §7.6 process table | §3.4; §4.1; W11, W17, W20, W29, W43 | Yes |
| Three credential files and five key names per connection file | §14.1 | §7.6 inventory | §3.4 | Yes (same ten key names in [DB:§7.6] and [PL:§3.4]) |

Zero entities without a table.

---

## 5. Criteria coverage (recomputed from the "Implements" cells)

| Family | Defined in the spec | Covered by at least one plan row | Uncovered | Cited by a plan row but not defined |
|---|--:|--:|---|---|
| AC-B-01..93 [SP:§16] | 93 | 93 | none | none |
| AC-C-01..110 [CL:§13] | 110 | 110 | none | none |
| SR-01..82 [SP:§15] | 82 | 82 | none | none |

| Further check | Result |
|---|---|
| The plan's own tables [PL:§13.1-§13.3] against the recomputation | Equal for AC-B and SR. For AC-C the table also names W63-W82 for AC-C-48, 53 and 101, which those rows carry through the client gate CLG, as [PL:§13] says |
| Criteria carried only by a verification row | AC-B-22 (W96), AC-B-40 (W94), AC-B-51 (W95), AC-B-60 (W97), AC-B-66 (W58, W99); AC-C-27 (W97), AC-C-55 (W96), AC-C-64 (W95), AC-C-82 (W94). All nine are two-client or host observations that the specs word as "Observable"; no build row can prove them. Not a gap |
| SR covered only by the two review rows W45, W99 | None: all 82 are also in a build or test row |
| Other IDs cited in "Implements" (350 IDs in 56 further families, for example TD-, ADQ-, HB-, RB-, OR-, MD-, MB-, PG-, TI-, T-RS-) | Every one occurs in at least one source document (the three specifications, the analysis, the decision record, the review, the translated task, the baseline gate, or the blueprint outside its rows 23-118), except GP-01, GP-05, PA-03, PA-09, which are the plan's own gap and assumption IDs [PL:§1.8, §1.9]. This is a check that the ID exists, not that its text matches the row |

Zero AC without a plan row.

---

## 6. Plan rows [PL:§8]

### 6.1 Row attributes

| Check | Result |
|---|---|
| Rows | 105 (W01-W105), no gap, no duplicate; 0 rows with a wrong cell count |
| Owner agent is a real agent | 105 of 105. coder-execution 68, verifier 10, senior-code-reviewer 7, test-expert 6, database-specialist 6, security-review 3, git-specialist 3, data-analyst 2 (equals D20) |
| Tier | 99 R, 6 D (W02, W14, W85, W103, W104, W105); no verification-phase agent on tier D |
| Owned write paths | 81 rows name paths. 24 rows state "(none)": W38, W45, W46, W58, W61, W62, W88-W105 (reviews, gates, verifications, reports, commits). Finding C-08 |
| Dependencies exist | All. Non-row tokens: `22` (FIRM row 22) on W01-W05, `DP-1` on W12 and W13, `DP-3` on W94 |
| Acyclic | Yes. One reference to a higher number, W103 on W105, which D20 records |
| One verification | 105 of 105 non-empty |
| A rollback | 105 of 105 non-empty (a class of [PL:§8.1], a register line H-nn, or `git reset --soft HEAD~1` for the three commit rows) |

### 6.2 Serial resources (one writer at a time)

| Resource | Holders | Enforced by | Result |
|---|---|---|---|
| npm, lockfile | W03, W13, W14 | Dependency chain W03 → W13 → W14 and `.locks/npm.lock` | PASS |
| Gradle | W13 | Single holder | PASS |
| Migration writer | W17 (schema and migrations); W20 and W29 apply under `db-migrate.lock` | Chain W17 → W20 → W29 | PASS |
| Contract owner | W16, W19, W22, W27, W83 | Chain W16 → W19 → W22 → W27; W83 after every client row | PASS |
| Backend port 4420 (`main`) | W58, W86, W90, W94, W95, W96, W98 | No two share a wave without a dependency path (W94 → W95 → W96 is a chain) and `.locks/core-server.lock` | PASS |
| PostgreSQL instance | Started by W07; exclusive use by W89 and W90; every other row attaches through its own cloned test database | W89 and W90 sit in different waves; the other rows of those waves use no database | PASS |
| Lanes | Web rows take any free lane; mobile rows state "lane1 or lane2" (three mobile rows per wave for two device lanes) | Lane lock files, as a queue [PL:§5] | PASS (by lock, not by dependency) |
| Git index | Row 22 → W104 → W105 → W103 | Dependency chain | PASS |

### 6.3 Collision scan (recomputed)

37 pairs of rows share a path; in every pair one row is an ancestor of the other. **0 overlaps between rows with no dependency path.** 43 paths have more than one writer; 42 of them are the paths of [PL:§4.3]. The one that §4.3 does not list is `apps/core-web/src/features/storage/__tests__/storage-page.test.tsx` (W01, then W71 through its folder glob): finding C-02.

### 6.4 Waves [DEC:D6]

| Check | Result |
|---|---|
| Largest wave | 7 rows (B5, B7, C1) |
| Largest number of one agent type in a wave | coder-execution x6 (B5, B6, C1, C2, C3) |
| A wave above 6 of one type or 8 in flight | None |
| A row placed in a wave earlier than a dependency | None. Five rows share a wave with a dependency (W86 after W84; W95 after W94; W96 after W95; W104 after W58; W105 after W81); [PL:§9] words each as "then" |

### 6.5 Folder ownership

Every server folder of [SP:§2.2] has an owning row (script over the write paths): `plugins/*` W08, W23, W24, W28; `core` W21; `engine` W26; `realtime` W42; the 13 module folders W24, W28, W32-W37, W39-W41, W43; `modules/health` W08; `db/schema`, `db/migrations`, `db/commands` W17; `db/mapping`, `db/seed` W20; `db/fixtures` W25; `db/reset` W29. Every web group and mobile group of the wiring map that changes a file has a row: web W50, W54, W55, W63-W65, W69-W71, W75-W77, W81, W84; mobile W51, W56, W57, W59, W60, W66-W68, W72-W74, W78-W80, W82. Every one of the 95 provisional blueprint rows 23-118 other than 41 (SKIPPED) is named by a work row [PL:§21].

---

## 7. Security corrections SD-01..SD-29 [SDR:§4, §7; DEC:D16]

"Plan rows" are the rows whose "Implements" cell cites the finding (script). The five Medium findings were also checked by reading the rule text.

| Finding | Sev. | In the specs | Plan rows | Result |
|---|---|---|---|---|
| SD-01 three roles | Medium | [SP:§2.1; DC-5; SR-58; SR-68; AC-B-72]; [DB:§7.1; §7.4 B-4, B-9] | W07, W11, W17, W20, W29, W43 | PASS. Read: "It never holds `dems_admin`" [SP:§2.1]; "From here on nothing connects as `dems_admin`" [DB:RP-6] |
| SD-02 two Origin lists | Medium | [SP:§2.4; OR-1 to OR-4; the two decision tables; ID-1; SR-69; AC-B-73] | W12, W23, W28, W42 | PASS. Read: the instance's own origins are "accepted only on a request that carries no cookie" and "never satisfy ID-1 (a)" |
| SD-03 denial budget | Medium | [SP:ID-P13; RB-4; RB-6; SR-71; AC-B-75]; [CL:LB-10] | W23, W28, W32, W44, W47, W51 | PASS. Read: "at most 20 audited refusals within 60 s ... answered 429 ... without a further audit row" |
| SD-04 atomic server-native state changes | Medium | [SP:ENG-23 to ENG-27; SR-72; AC-B-76..80]; [DB:§5.6 AT-1 to AT-6, AT-C1 to AT-C5] | W17, W21, W24, W32, W33, W41 | PASS. Read: one unit of work, attempt consumed before verification, compare-and-set. AC-B-76 still carries a stale marker (finding C-01) |
| SD-05 route pattern in the log | Medium | [SP:SR-48; SR-49; AC-B-29; AC-B-42] | W08 (W24, W42, W58 through AC-B-29 and AC-B-42) | PASS. Read: "The request log never holds the raw URL" |
| SD-06 | Low | [DB:§6.3; B-5]; [SP:SR-52] | W07, W17 | PASS |
| SD-07 | Low | [SP:OR-1; OR-7; SR-70; AC-B-74]; [CL:WT-2, WT-2a; AC-C-102] | W05, W23, W42, W50, W86 | PASS |
| SD-08 | Low | [SP:ID-P7; SR-18; AC-B-90]; [CL:§5.2] | W24, W55 | PASS |
| SD-09 | Low | [SP:ID-12; ID-13; SR-73; AC-B-81]; [DB:§5.2] | W24, W47 | PASS |
| SD-10 | Low | [SP:§5.4; §5.6 step 6; SR-74; AC-B-82]; [DB:§2.4]; [CL:§6.5] | W17, W22, W41, W44, W56 | PASS |
| SD-11 | Low | [SP:SR-37; SR-65; AC-B-83] | W41 | PASS |
| SD-12 | Low | [SP:§2.3 stages 4, 5; ID-P12; SR-75; AC-B-84] | W08, W23, W28, W42 | PASS |
| SD-13 | Low | [SP:SR-42; AC-B-85] | W42 | PASS |
| SD-14 | Low | [SP:OR-9; SR-76; AC-B-14]; [CL:§4.3] | W03, W08 | PASS |
| SD-15 | Low | [SP:§14.1 rules 1-7; SR-60; SR-77; AC-B-64; AC-B-86]; [DB:§7.6] | W07, W08, W90 | PASS |
| SD-16 | Low | [CL:AR-3a; AC-C-103]; [SP:§7.7] | W84 | PASS |
| SD-17 | Low | [SP:SR-63 C1-C4; AC-B-92]; [CL:WS-9; §9.2; AC-C-104] | W55, W59, W86 | PASS |
| SD-18 | Low | [CL:MB-6a; AC-C-105] | W15, W56 | PASS |
| SD-19 | Low | [SP:E-26; DC-7; SR-78; AC-B-87]; [DB:§4.30]; [CL:AC-C-109] | W17, W27, W29, W39, W43, W75 | PASS |
| SD-20 | Low | [CL:WS-12; PG-6a; AC-C-106] | W50, W77, W81 | PASS |
| SD-21 | Low | [SP:ID-2; SR-05; SR-08; SR-61] | W09, W24 | PASS |
| SD-22 | Low | [SP:ENG-2; SR-79; AC-B-53] | W26 (proof in W04) | PASS |
| SD-23 | Low | [CL:AC-C-65; AC-C-75; AC-C-107] | W55, W56, W57, W81, W84 | PASS |
| SD-24 | Info | [SP:ID-P7; SR-18; AC-B-23] | W24, W55 | PASS |
| SD-25 | Info | [SP:§14.3 SU-1 to SU-3; SR-80; AC-B-91] | W03, W07, W90 | PASS |
| SD-26 | Info | [SP:§15.11] "The boundary is a single-user Mac" | none (specification text, as [PL:§7.2] states) | PASS |
| SD-27 | Info | [SP:§7.13; SR-81; AC-B-88] | W39 | PASS |
| SD-28 | Info | [SP:§13.2; SR-82; AC-B-89] | W40 | PASS |
| SD-29 | Info | [SP:§6.3 "Operation 23 in this task"]; [CL:MP-8a] | none (specification text, as [PL:§7.2] states) | PASS |

Traceability note: [PL:§7.2] names nine row-and-finding pairs whose rows carry neither the finding ID nor one of its criteria in their own cells (finding C-10).

---

## 8. Names and numbers across the four files

| Item | Value | Files that state it | Agree |
|---|---|---|---|
| Backend port | 4420 | SP, PL, DB, CL | Yes |
| Lane backends | 4421-4423 | SP, PL, DB, CL | Yes |
| PostgreSQL | 4432, TCP, Unix socket disabled; 5432 never used | SP, PL, DB | Yes |
| mock-core | 4400 | SP, PL, CL | Yes |
| Packaged launcher | 4410-4419 (mock-core tests bind 4410, 4411) | SP, PL | Yes |
| Vite | 127.0.0.1:5173; lanes 5176-5178; another project owns [::1]:5173, 5174, 5175 | SP, PL, CL | Yes |
| Web console origins | `http://127.0.0.1` on 5173, 5176, 5177, 5178; no `localhost` | SP §2.4, OR-7; PL W23; CL WT-2a | Yes |
| Credential files | `.data/pg.pwfile`, `.data/pg.owner.env`, `.data/pg.env`; `.data/` 0700, files 0600 | SP §14.1; PL §3.4; DB §7.6 | Yes |
| Connection keys | `DEMS_PG_HOST`, `_PORT`, `_DATABASE`, `_OWNER_ROLE` / `_APP_ROLE`, `_OWNER_PASSWORD` / `_APP_PASSWORD` | PL §3.4; DB §7.6 | Yes |
| Commands | `pg:init`, `pg:start`, `pg:stop`, `pg:status`, `pg:remove-data`, `pg:remove`; `db:create`, `db:migrate`, `db:seed`, `db:reset`, `db:status`; `test:db`; `test:pg-scripts` | PL §3.4; DB §8.4; SP (`test:db`) | Yes; no other `pg:` or `db:` name occurs |
| Roles | `dems_admin`, `dems_owner`, `dems_app` | SP, PL, DB | Yes; no fourth role name |
| Databases | `dems_demo`, `dems_lane_1..3`, `dems_test_*` | SP, PL, DB | Yes |
| Table count and names | 30; `audit_chain_history` | SP §3.3; PL W17; DB | Yes |
| Cookie | `dems_session_<listen port>`; `HttpOnly; SameSite=Strict; Path=/`; no `Secure`, no `Domain`, no `Max-Age`, no `Expires` | SP ID-P7, SR-18, AC-B-23; PL W24; CL §5.2 | Yes; the bare name `dems_session` occurs nowhere |
| Pairing code | 6 digits; 300 s; one active; lock after 3 failures for 60 s; closed at 5 | SP PR-P1 to PR-P5, SR-26, SR-27; DB §4.7 (`failed_attempts BETWEEN 0 AND 5`, `issued_at` plus 300 s), AT-6; CL §9.4 (six slots) | Yes |
| Sign-in lockout | 5 failures in 300 s, 60 s lock | SP ID-P1, ID-P2, SR-22; DB AT-6; PL W24 | Yes |
| Session timings | idle 15 minutes; absolute 8 hours; sweep at most 5 s | SP ID-P4, ID-P5, SR-11; DB §4.6; PL W24 | Yes |
| Argon2id | 19,456 KiB, 2 passes, parallelism 1, 16-byte salt, 32-byte tag | SP SR-05, AC-B-30; DB CHECK `memory_kib >= 19456 AND passes >= 2 AND parallelism >= 1`; PL W09 | Yes |
| Denial budget; throttle | 20 per key per 60 s; 30 and 600 per 60 s | SP ID-P12, ID-P13; PL §3.4, W23; DB; CL | Yes |
| Sockets | 16 connections, 6 anonymous; close codes 4401, 4403, 4408 | SP SR-42; PL W42; CL CL-11 | Yes |
| Session end reasons | 8 values, `TOKEN_REUSE` included | SP §5.4; DB §2.4 | Yes |
| Seed counts | 3 operators, 3 roles, 12 permissions, 18 grants, 13 evidence items, 52 tracks, 13 history entries, 82 audit rows, 59 events | SP AC-B-02; DB §9.4; PL W20 | Yes |
| Storage keys | `dems.core.mode.v1`; `dems.live.device.v1`, `dems.live.bio.v1`, `dems.live.bio.meta.v1` | PL §3.4; CL §3.1, §9.1 | Yes |
| Environment variables | `DEMS_CORE_PORT`, `DEMS_DEMO_CONTROLS`, `DEMS_LOG_LEVEL`, `DEMS_TEST_STEP`, `VITE_DEMS_CORE_MODE`, `DEMS_CORE_PROXY_PORT`, `CORE_SERVER_PORT` | PL §3.4; DB (`DEMS_TEST_STEP`); CL | Yes (see finding C-13 on `CORE_SERVER_PORT`) |

**Pinned versions.** 35 package or runtime names were tabulated with every version that follows them in the four files. None carries two versions. The pins of [PL:§3.1, §3.2] equal D11 for every package D11 names (Fastify 5.12.5, `@fastify/websocket` 11.3.1, `@fastify/cookie` 11.1.2, `@fastify/rate-limit` 11.2.0, `fastify-type-provider-zod` 7.0.0, `embedded-postgres` 18.4.0-beta.17, `drizzle-orm` 0.45.3, `pg` 8.23.1, `drizzle-kit` 0.31.11, `rate-limiter-flexible` 11.2.1, `ws` 8.22.0, `expo-secure-store` 57.0.4, `qrcode.react` 4.2.0, Vitest 5.0.3, and the fallbacks Kysely 0.29.6, `@node-rs/argon2` 2.2.1, `@hey-api/openapi-ts` 0.99.0) and D16 (`@fastify/helmet` 13.1.1). PostgreSQL is 18.4 everywhere; 18.6 occurs only for the fallback keg `postgresql@18`. `@types/pg` is the one package without a version, by D17.

---

## 9. Rulings of D11 and D13-D20 visible in the documents

| Ruling | Visible in | A document still states the superseded rule |
|---|---|---|
| D11: technology pins; fallback keg `postgresql@18` (DR-01) | PL §3; `postgresql@17` occurs in none of the four files | No |
| D11 TD-11: QR scanning on the device deferred (DR-02) | SP §6; CL §9.4; PL §3.3 (`expo-camera` not installed) | No: no rule requires a scan |
| D13: 75 operations; DEPARTURE-3, DEPARTURE-4; the fifteen open choices | SP §7; RB-5; §2.3; §19.3; §19.4 ("DECIDED") | No |
| D14: SPEC-GAP-1..7; reset order; one snapshot row with a column per slice | DB §13.1, §15.2 ("DECIDED"); SP API-13, §12.4, E-23, E-24, E-25 | No |
| D15: DEPARTURE-5, DEPARTURE-6; the Core chips; two portal pages; no `rotateDeviceCredential` call | CL §17.1-§17.3 ("DECIDED"); MD-8; §10.1; MP-8a | No |
| D16 and DR-03: three roles | SP, DB, PL (section 4). "Two roles" occurs only as the amended wording of the analysis and as revision-1 history | No |
| D16: `ENABLE ALWAYS`; `TOKEN_REUSE`; no `localhost` origin; cookie name per instance; Try-it deny list; lineage table; demo-password conditions | Section 7 above | No |
| D17: `@types/pg` at install time; checkpoint commits; release-gate test file unchanged; notices section; DP-1 = A | PL §3.1; §8.5a; §23.1 item 20; W85; §5.5 | One table cell of CL §9.5 words the release-gate test the old way (finding C-05) |
| D18: CF-1, CF-2, OP-1, GS-24, GS-25, LB-10 | PL §7.2 "Rulings of D18 that the rows follow"; DB §15.5; CL LB-10 | **The spec still marks all five as open** (finding C-01); the rules it states equal the rulings |
| D19: 30 tables, B-1..B-9, PG-01..PG-28, 98 CHECKs, 25 foreign keys; CONFLICT-1, CONFLICT-2; trial step T5-j | DB revision history, §7.1, §15.5, §15.6; PL W07, W17, §7.3 | No (DB §15.3 quotes the D14 counts as superseded) |
| D20: 105 rows; W28 → W23, W39 → W29, W103 → W105; five keys; W21 builds the queue; P23 against `acaff20`; nothing connects as `dems_admin` after W07 | PL §8, §9, §3.4, §4.4 | SP §2.1 C-6 and §14.1 still name "removal" for the superuser (finding C-03) |

The brief's five examples: two database roles (not stated as current anywhere); INSERT for `dems_app` on the lineage table (not stated; DB B-5 expects it false); QR scanning on the device (not required); `postgresql@17` (0 occurrences); 29 tables (history only).

---

## 10. Leftovers

### 10.1 Open markers

| File | "CONFLICT — needs controller decision" | "OPEN — needs controller decision" | "DEPARTURE — needs controller decision" | Other open wording | TODO / TBD / FIXME |
|---|--:|--:|--:|---|--:|
| 01_specs.md | 3 (§1.6, AC-B-76, §19.6) | 2 (§1.6, §19.6) | 1 (§1.6, describing the convention; §19.3 says no departure is open) | "needs the controller's decision" in the revision history row of GS-29 and in ID-1; "Needs controller decision" at GS-29; "Controller (confirm)" at GS-24 and GS-25; "To confirm" in §19.6; "depends on the ruling on CF-2" in AC-B-87; "the two files disagree until the controller rules" in §19.6 | 0 |
| 02_plan.md | 0 | 0 | 0 | none ("No conflict is open") | 0 |
| 03_database_contract.md | 0 | 0 | 0 | none (SPEC-GAP-1..7 and CONFLICT-1, CONFLICT-2 are marked DECIDED) | 0 |
| 04_client_integration_spec.md | 1 ("none in this file") | 0 | 1 (describing the convention) | FC-13 and §17.5 still speak of OP-1 as open (finding C-06) | 0 |

Every open marker in 01_specs.md is on a point that D18 ruled after the file was written: CF-1, CF-2, OP-1, GS-24, GS-25. Finding C-01.

### 10.2 Stale references to another file's earlier revision

| Where | Statement | Now |
|---|---|---|
| [SP] front matter | "03_database_contract.md (row 16, revision 2 in progress)"; binding decisions D1-D16 | The contract is at revision 2.1; D17-D20 exist |
| [CL] front matter | binding decisions D1-D16; contract "(row 16)" | Same |
| [DB:CR-1; §15.4; §15.5 NOTE-1] | "The plan's name table lists four keys for `pg.env`"; "the plan's W17 says `db:create` (with the role `dems_app`)" | The plan's revision 2 lists five keys and W17 creates no role (finding C-07) |
| [CL:§9.6] | "No row owns this script" (`device-session.sh`) | W13 owns it [PL:§4.3] |

### 10.3 Credential values and personal data (counts only)

| File | Demo password literal | Pairing-code literal | Git user name | Git user e-mail | E-mail-like strings | Dataset operator names | Database URL with a password | Token-like value |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| 01_specs.md | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 02_plan.md | 0 | 0 | 0 | 0 | 1 (a Homebrew log file name, not an address) | 0 | 0 | 0 |
| 03_database_contract.md | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 04_client_integration_spec.md | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

The two constants were read from `packages/shared/src/sim/dataset.ts` (both found; lengths 9 and 6) and never printed. The account folder in the absolute workspace path was masked before the name search.

---

## 11. Findings

For each finding: what was found, why it matters, how it was verified, the source, the owning row and the exact correction.

| ID | Severity | What was found | Where | Why it matters | How verified | Owning row | Exact correction |
|---|---|---|---|---|---|---|---|
| C-01 | Major | The server spec still marks five points as open although D18 ruled them: CF-1, CF-2, OP-1, GS-24, GS-25. The markers sit inside rules an implementer reads: ID-1 ("a default that needs the controller's decision"), AC-B-76 ("CONFLICT — needs controller decision"), AC-B-87 ("this last clause depends on the ruling on CF-2"). §19.6 also says "The database contract's revision 2 grants the INSERT, so the two files disagree until the controller rules", which is no longer true: the contract's revision 2.1 gives SELECT only | [SP: revision history row "getSignInStatus"; §1.6 item on conflicts; ID-1; AC-B-76; AC-B-87; GS-24; GS-25; GS-28; GS-29; §19.6 CF-1, CF-2, OP-1, "To confirm"] | A row that builds or tests these (W17, W24, W32, W48) can stop on a marker that says the rule is unsettled, or drop the INSERT clause of AC-B-87. The rules themselves are right: in each case the text the spec "states meanwhile" is what D18 ruled | Marker search over the four files; each hit read; compared with [DEC:D18], [DB:§7.3, §15.5], [PL:§7.2 "Rulings of D18"] | 15 | Replace each marker by "DECIDED [DEC:D18]". CF-1: AC-B-76 keeps three counted failures, the 60 s lock, two more, closed at exactly five; delete the bold marker. CF-2: SELECT only; delete "(this last clause depends on the ruling on CF-2)" from AC-B-87 and the sentence "The database contract's revision 2 grants the INSERT ... until the controller rules" from §19.6. OP-1 and GS-29: `getSignInStatus` stays a GET that needs no console identity; delete the last sentence of ID-1. GS-24, GS-25: "confirmed [DEC:D18]". GS-28: "settled: CF-2 and CONFLICT-2 by D18 and D19; the lineage members by [DB:§4.30]". Front matter: binding decisions D1-D20; the contract at revision 2.1 |
| C-02 | Major | W71 owns `apps/core-web/src/features/storage/**`, which contains `__tests__/storage-page.test.tsx`, a file W01 edits (D10 a). Three consequences: (1) [PL:§4.3] does not list the file and says every other path has exactly one writer; (2) W71's rollback class is R-CO, "`git checkout acaff20 -- <paths>`", which would also undo W01's fix; (3) the client gate CLG (a) asks that the folder's existing test files be absent from `git diff --stat acaff20`, which cannot hold for that file once W01 has run | [PL:§4.3; §8.1 CLG and R-CO; W01; W71] | A rollback of W71 as written brings back the calendar-dependent failure of F20; and W71 would report a gate failure that is not one. It is not a collision: W71 depends on W01 through W58 | Collision script (the only multi-writer path missing from §4.3); the dependency closure; the cells of W01 and W71 read | 18 | §4.3: add the row "`apps/core-web/src/features/storage/__tests__/storage-page.test.tsx` — W01 (fixed clock) → W71 (the folder)". W71 rollback: "R-CO; R-PRE (`storage-page.test.tsx`)". W71 verification: "CLG for both folders; under (a) the one file `storage-page.test.tsx` may appear, with W01's change only" |
| C-03 | Minor | The spec lets the superuser role be used "at removal": C-6 lists "removing the cluster" under the `dems_admin` connection and §14.1 says the superuser's password file is read "at provisioning and at removal". The contract says "Removal needs no connection" and "No use of the superuser remains after provisioning"; the plan and D20 say the same | [SP:§2.1 C-6; §14.1 first row] against [DB:§7.1; RP-6], [PL:§3.4; §7.3], [DEC:D19, D20] | The wording comes from the review [SDR:§5.2 item 1] and was superseded. W07 follows the plan (`pg:remove-data` stops the server and deletes `.data/`), so nothing wrong is built | Read; search for `dems_admin` in the four files | 15 | C-6: "... `initdb`, creating the two other roles, and trial step T5-j". §14.1: "Read only by `scripts/pg/`, at provisioning. Removal needs no connection" |
| C-04 | Minor | [SP:§2.2] says each hand-built element "lives in exactly one folder" and places HB-3 (reset) in `modules/demo/`. The plan builds HB-3 in `src/db/reset/` (W29) and HB-13 in two folders (`db/mapping/` W20, `engine/` W26), which D17 accepted; §2.2 also lacks `db/commands/`, `db/mapping/`, `db/reset/` | [SP:§2.2] against [PL: W20, W26, W29, W43], [DEC:D17] | The plan's write paths bind, so the build is right; the spec's folder table is stale | The folder-owner table of section 6.5 | 15 | §2.2: `modules/demo/` "calls the reset routine"; add the row "`db/commands/`, `db/mapping/`, `db/reset/` — HB-13 (mapping half), HB-3"; amend the sentence to "one folder, except HB-13 in two [DEC:D17]" |
| C-05 | Minor | [CL:§9.5], row "Release build": "the existing release-gate test gains the LIVE cases". AC-C-83 in the same file says "the existing release-gate test passes unchanged"; D17 ruled that the file stays unchanged and the Live cases go into a new file; W82 follows D17 | [CL:§9.5] against [CL:AC-C-83], [PL:§23.1 item 20; W82], [DEC:D17] | Read literally the cell asks for an edit of a file that the gate CLG (a) forbids to change | Search for "release-gate" in the four files | 17 | "HEARTBEAT and LIVE disabled (MD-3); the existing release-gate test passes unchanged and the LIVE cases are a new test file beside it [DEC:D17]" |
| C-06 | Minor | The client spec still treats OP-1 as open: FC-13 ("If the controller chooses the alternative ...") and the last paragraph of §17.5 ("One open point of the server specification, OP-1") | [CL:§17.2 FC-13; §17.5] | D18 ruled it; no client change follows either way | Read against [DEC:D18] | 17 | FC-13: "DECIDED [DEC:D18]: operation 3 stays a GET; no client change". §17.5: "CF-1, CF-2 and OP-1 are ruled by D18" |
| C-07 | Minor | The contract still describes the plan's revision 1: "the plan's name table lists four keys for `pg.env`" and "the plan's W17 says `db:create` (with the role `dems_app`)"; it "leaves the reconciliation to row 19" | [DB:CR-1; §15.4 row for the plan; §15.5 NOTE-1] | Reconciliation asked of this row: the plan's revision 2 lists the same five keys per file as the contract (ten names equal) and W17 creates no role. The files agree; only the remark is stale | Key names compared by script; W17 read | 16 | CR-1 and NOTE-1: "the plan's revision 2 lists the same five keys [PL:§3.4]; reconciled (row 19)". §15.4: delete the remark on W17 |
| C-08 | Minor | 24 rows state "(none)" under "Owned write paths": W38, W45, W46, W58, W61, W62, W88 to W105. They are review, gate, verification, report and commit rows. Their output document is not named in the plan; only the general rule of §8.1 ("its own log and its progress file under the task folder") covers it | [PL:§8.3-§8.5a] | The row's verification asks that every plan row has owned write paths. For these rows "none" is the true statement about source files, but the document each one delivers (for example the implementation report of W88, the verification file of W101) has no stated path, so two of them could write the same file | Script over the write-path cells | 18 (and row 21 for the blueprint's Output column) | Either name the report path in the cell (for example "`docs/<task>/gateway_check/<nn>_<name>.md`" for W38, W45, W46, W58, W61, W62, W89; "`implementation/99_implementation_report.md`" for W88; "`verification/01_verification.md`" for W101), or state in §8.1 that the output path of a read-only row is the blueprint's Output column, which row 21 fills with one distinct path per row |
| C-09 | Minor | [PL:§4.2] says "W06 probes every port of this table before W07 binds the first one" and §21 moves row 24 "before provisioning". W07 depends only on W03 and shares wave E2 with W06, so the order is not enforced | [PL:§4.2 last paragraph; §21 row 24; W06; W07] | D11's condition "port 4432 if the probe finds it free" still holds, because W07 probes 4432 itself with `lsof` before the first start | Dependency cells of W06 and W07 | 18 | Preferred, because no wave moves: reword §4.2 and §21 to "W07 probes 4432 itself before the first start; W06 reports the state of every port". Alternative: add W06 to W07's "Depends on", which moves W07 and the rows that depend on it one wave later |
| C-10 | Minor | [PL:§7.2] names rows as builders of a finding whose own cells carry neither the finding ID nor one of its criteria: SD-01 (W10, W25), SD-02 (W24), SD-03 (W50, W54), SD-06 (W08), SD-12 (W24), SD-29 (W45, W99). For SD-29 the table says W45 and W99 "treat any `DEVICE_CREDENTIAL_ROTATED` row as unexpected", and neither row says so | [PL:§7.2] against the "Implements" cells | Traceability only: every finding has at least one row that cites it (section 7), and the scope text of W08, W24, W50 and W54 does hold the correction | Script: built-by rows against Implements | 18 | Add the finding ID to the "Implements" cell of the nine pairs; add to W45 and W99: "a `DEVICE_CREDENTIAL_ROTATED` row outside the server's own tests is reported as unexpected [SP:§6.3]" |
| C-11 | Minor | Front matter of the two specs: binding decisions "D1-D16"; the server spec calls the contract's revision 2 "in progress" | [SP], [CL] front matter | A reader takes D17-D20 as not binding for the file | Read | 15, 17 | "binding_decisions: D1-D20"; "03_database_contract.md (row 16, revision 2.1)" |
| C-12 | Minor | The specs cite provisional blueprint rows (for example "row 23", "row 62", "row 101", "verification row 105"), the plan uses W-numbers. Every cited provisional row maps to a work row through the "Prov." column and [PL:§21] (36 cited in SP, 21 in DB, 34 in CL; none unmapped; 41 is SKIPPED) | [SP], [DB], [CL] throughout; [PL:§21] | After row 21 renumbers the blueprint, a reader needs the mapping to follow these citations. [CL:§9.6] "No row owns this script" is one such stale remark (W13 owns it) | Script over "row NN" citations | 21 (blueprint), no change in the specs | Row 21 keeps the mapping table of [PL:§21] in the blueprint, with the provisional number beside each new step |
| C-13 | Minor | The name `CORE_SERVER_PORT` is pinned twice: as a shell environment variable of `device-session.sh` (4420-4423, the host side of `adb reverse`) and as a shared TypeScript constant (4420) | [PL:§3.4 "Mobile environment" and "Shared constants"]; [CL:§9.6] | Two meanings for one name; no behaviour depends on it | Name tabulation | 18 | Optional: rename the environment variable (for example `DEMS_CORE_HOST_PORT`), or add one sentence to §3.4 that the two are distinct |

---

## 12. Checks that could not be done, and why

| # | Not done | Reason | Effect |
|--:|---|---|---|
| 1 | Rows 23-118 of `identification/02_structured.md` were not used | The blueprint is being revised by row 21 at the same time (brief) | The mapping of [PL:§21] was checked against the plan only, not against the refined blueprint |
| 2 | Nothing was executed | Read-only row: no code, no process, no install | Every behaviour the documents label "hypothesis" (PG-01 to PG-28, SA-n, CA-n, PA-n) stays unproven; the rollback commands of [PL:§14.3] were read, not run |
| 3 | Whether each row's verification really proves each criterion it cites | Coverage was computed from ID citations. The cells were read for 36 of the 105 rows, with the longest cells cut at about 1,000 characters (W01, W02, W04-W08, W10, W11, W13, W17, W20, W23-W25, W28, W29, W38, W43, W45, W50, W51, W54, W58, W71, W86, W87, W89, W90, W94, W97, W99-W101, W103, W104); for the other 69 rows only the title, agent, wave, dependencies, locks, write paths and rollback were read | A weak verification in an unread row would not be seen here |
| 4 | Sections checked by script only (IDs, names, numbers, markers), not read line by line | Size: about 1.04 MB in four files. Not read in full: [SP:§1, §8.1, §8.3-§8.7, §9]; [DB:§1, §2, §4.1-§4.29, §5.1-§5.5, §6, §8.1-§8.3, §8.5, §9.1-§9.3, §11-§14]; [CL:§1, §2, §5.3-§6, §8, §10-§14, §16]; [PL:§1, §2, §5.1-§5.4, §6, §10-§12, §15-§17, §19-§23] | A contradiction worded without a shared ID, name or number could remain in those sections |
| 5 | Line citations inside the files | The brief says they may point at earlier revisions | None |
| 6 | Whether every new mobile string has an owned file | `apps/mobile/src/i18n/en.mobile.ts` (the `mobile.*` strings, including `mobile.pairing`, `mobile.biometric`) is owned by W51 only; later mobile rows own their feature folders, each with its own `i18n.ts`. Whether W56 (`src/auth/**`, which has no i18n file of its own) or W57 and W59 need a key in `en.mobile.ts` depends on implementation choices | If one does, the row returns `needs-review`; the controller may give W51 the strings up front |
| 7 | `research/03_analysis.md` and the security review §8-§10 were not read in full | Used for ID existence only; the review was read to the end of §7 | The count of 17 residual risks was taken from [SP:§18.2] (R-01 to R-17) and D16 |
| 8 | The count "70 synchronous sites" of [CL:§8] | The site IDs were not enumerated one by one; the rows W63-W82 cite site IDs that exist in [CL:§8], and W87 produces the site-to-test table | A missing site would surface in W87's table |

---
*Generated: 2026-10-04 05:52 WIB*
*Last Updated: 2026-10-04 05:52 WIB*
