---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: data-analyst
blueprint_row: 18 (FIRM); revision 2 at the controller's request (decisions D16, D17, D18, D19); revision 2.1 after the masterplan consistency check (decisions D20, D21)
revision: 2.1
tier: 1
type: implementation-plan
confidence: MEDIUM
confidence_note: repository facts are HIGH (read from files and read-only commands, section 1.6). Every technology behaviour is still unexecuted (nothing is installed); each one is tied to the work row that proves it and to a fallback row (section 6). Time boxes are limits set by this plan, not measured durations
based_on: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/research/03_analysis.md
specs: masterplan/01_specs.md (row 15, revision 2), masterplan/03_database_contract.md (row 16, revision 2.1, contract revision dbc-2), masterplan/04_client_integration_spec.md (row 17, revision 2), initialization/02_baseline_gate.md (row 13)
security_review: gateway_check/03_security_design_review.md (row 20, verdict CAUTION; every correction accepted by D16 and assigned to a work row in section 7)
consistency_check: gateway_check/02_masterplan_consistency.md (row 19, verdict PASS-WITH-NOTES, accepted by D21; its findings C-02, C-08, C-09, C-10 and C-13 are applied in revision 2.1)
specs_note: the three specification files are patched in parallel for the findings C-01, C-03 to C-07 and C-11 (specs revision 2.1, contract revision 2.2, D21). D21 records every finding as text-only; this plan cites the specifications by section and by ID, so its citations are not affected
binding_decisions: D1-D21, DR-01, DR-02, DR-03, DR-04, F1-F25 (decisions/decisions.md)
replaces_in_blueprint: provisional rows 23-118 of identification/02_structured.md (row 21 applies section 21); 105 work rows W01-W105
last_updated: 2026-10-04 06:12
---

# Implementation Plan: DEMS Core server (PostgreSQL), integrated RBAC and portal-mobile pairing

## Revision history

Revision 1 was accepted by D17. Revision 2 folds in the accepted security corrections (D16), the controller's rulings on the plan (D17) and on the conflicts of the specifications and of the database contract (D18, D19), and maps the criteria that revision 2 of the three specifications added. **No W-number changed.** Each change is made in the section where it lives; a work row that changed says "Rev 2:" in its title cell. Revision 2 was accepted by D20. Revision 2.1 is a patch after the masterplan consistency check (verdict PASS-WITH-NOTES, D21): wording and traceability. **No W-number, wave, agent or write path changed**; one dependency was added inside wave E2 (W07 on W06). A cell that revision 2.1 extends says "Rev 2.1:".

| Rev | Date | Change | Decision or finding | Sections touched |
|--:|---|---|---|---|
| 1 | 2026-10-04 | First issue: 103 work rows | D17 (accepted) | all |
| 2 | 2026-10-04 | The security findings SD-01 to SD-29 are **accepted** and assigned to work rows; the table "mapped, not accepted" of revision 1 is **REMOVED** (superseded by D16); the reserved rows S1 and S2 were run as rows 20a and 20b, and S3 is this revision | D16 | 7; 1.9 (GP-04); 19 (PR-05); 22 |
| 2 | 2026-10-04 | Three database roles and three credential files; `pg:init` creates both project roles; the trial steps T3-a, T3-b, T5-a to T5-j; the host-authentication check; the superuser trigger check as trial step T5-j at provisioning | SD-01, SD-06, SD-15; DR-03; D16, D19 | 3.4; 6; 7.3; 8.2 (W07, W10, W11); 8.3 (W17, W20, W25, W29, W43); 14.1; 14.2 (H-02, H-15) |
| 2 | 2026-10-04 | Schema counts 30 tables, 98 named CHECKs, 25 foreign keys, 5 functions, 3 triggers; triggers `ENABLE ALWAYS`; `TOKEN_REUSE`; the lineage table `audit_chain_history`, on which the runtime role has SELECT only | SD-06, SD-10, SD-19; D16; D18 (CF-2) | 2.4; 8.3 (W17, W22, W27, W29, W39, W43) |
| 2 | 2026-10-04 | Two Origin lists without `localhost`; the denial budget; throttle keys; one credential per request; the stage order of the pipeline | SD-02, SD-03, SD-07, SD-09, SD-12 | 8.2 (W08, W12); 8.3 (W23, W24, W28, W42); 5.3 |
| 2 | 2026-10-04 | W28 carries the integration tests of pipeline stages 3 to 6 and now depends on W23; W39 now depends on W29 (it returns the lineage) | SD-02, SD-03, SD-12, SD-19 | 8.3 (W28, W39); 9; 10 |
| 2 | 2026-10-04 | Atomic server-native state changes: the unit-of-work queue in W21, compare-and-set in the modules, five concurrency criteria | SD-04; D18 (CF-1, GS-24) | 4.4 (P25); 8.3 (W17, W21, W24, W32, W33, W41) |
| 2 | 2026-10-04 | The request log (route pattern, parse errors by code); response headers with `@fastify/helmet` 13.1.1 in npm slot N1; static guard tests in W08 | SD-05, SD-14; D16, D17 | 3.1; 3.3; 8.2 (W03, W08); 8.3 (W52, W58) |
| 2 | 2026-10-04 | The matrix test stays inside the denial budget | F25; SD-03 | 8.3 (W47); 12; 19 |
| 2 | 2026-10-04 | A cookie name per instance, with no `Max-Age` | SD-08, SD-24; D18 | 5.2; 8.3 (W24, W55) |
| 2 | 2026-10-04 | Biometric: `TOKEN_REUSE` ends the family's sessions; the actor of a failure report; the DEPARTURE-6 conditions | SD-10, SD-11, SD-18 | 5.5 (DP-2); 8.2 (W15); 8.3 (W41, W48, W56) |
| 2 | 2026-10-04 | Clients: the negative proxy test; the console at `127.0.0.1`; the administration queries and the code memory cleared; the wording of a 429 (LB-10); the lineage in the chain panel; the Try-it deny list; the wider log scans; the README sentences | SD-07, SD-16, SD-17, SD-19, SD-20, SD-23; D18; F25 | 8.2 (W05); 8.3 (W44, W50, W51, W54, W55, W57); 8.4 (W59, W75, W77, W81); 8.5 (W84, W86) |
| 2 | 2026-10-04 | Supply-chain records SU-1 to SU-3; `@types/pg` pinned and recorded at install time | SD-25; D17 | 3.1; 8.2 (W03, W07, W13, W14); 8.5 (W90) |
| 2 | 2026-10-04 | Smaller corrections: the salt source (W09), the actor scope in a `finally` (W04, W26), the incremental chain check (W39), the log line for two unaudited commands (W40) | SD-21, SD-22, SD-27, SD-28 | 8.2; 8.3 |
| 2 | 2026-10-04 | **Two checkpoint commit rows W104 and W105** (git-specialist, tier D), from the reserved range; W103 now depends on W105; P23 compares against `acaff20` so that it survives a commit | D17 | 4.1; 4.4; 8.5a; 9; 10; 20; 21 |
| 2 | 2026-10-04 | The new criteria are mapped: SR-68 to SR-82, AC-B-72 to AC-B-93, AC-C-102 to AC-C-110; coverage 93 of 93, 110 of 110, 82 of 82 | D18 | 13; 10.3 |
| 2 | 2026-10-04 | Names reconciled with the database contract: `.data/pg.owner.env`; five keys in each connection file, with `DEMS_PG_DATABASE` as a default that the port rule and `--database` override | [DB:§15.5 N-1]; D18 | 3.4 |
| 2 | 2026-10-04 | Rulings of D17 stated as decided: DP-1; the package-removal rollback is written and not executed; no lane helper script; nothing DEFERRABLE is cut; the notices section; the release-gate test file | D17 | 1.7; 1.9; 5.5; 18; 23 |
| 2 | 2026-10-04 | The gate G-SEC is closed; the token `G-SEC` is **REMOVED** from the "Depends on" cells (the gate was met before this revision) | D16, D18 | 7; 8 |
| 2 | 2026-10-04 | Totals (105 rows), the wave table, the limit check, the collision scan, the Host Impact Register, the blueprint delta | D17 | 9; 10; 14; 21 |
| 2 | 2026-10-04 | **No conflict is open.** The one point this revision first flagged (where the superuser trigger check runs) was ruled by D19 while the revision was written: provisioning trial step T5-j, which is what W07 does | D19; [DB:§15.5 CONFLICT-2, decided] | 7.3; 23 |
| 2.1 | 2026-10-04 | Patch after the consistency check. **C-02:** the test file that W01 fixes inside W71's folder is a declared multi-writer path; W71 rolls it back by R-PRE; its gate, the gate of W84 (the other W01 file) and L-6 compare the two files with W01's state, not with `acaff20`. **C-08:** section 8.7 names one output document per row, 105 distinct paths. **C-09:** W07 now depends on W06, so the port report precedes the first bind; both stay in wave E2. **C-10:** the nine row-and-finding pairs cite the finding and its criterion. **C-13:** the shell variable of `device-session.sh` is `DEMS_CORE_HOST_PORT`; the shared constant keeps the name `CORE_SERVER_PORT`. **Section 21** now agrees with the "Prov." column: provisional row 25 is W03 and W08, row 79 is W15 and W56 | C-02, C-08, C-09, C-10, C-13 of `gateway_check/02_masterplan_consistency.md` §11; D20, D21; the controller's addition on section 21 | 3.4; 4.2; 4.3; 5.2; 5.3; 7.2; 8.1; 8.2 (W01, W06, W07, W08, W10, W13); 8.3 (W24, W25, W45, W50, W54); 8.4 (W71); 8.5 (W84, W99); 8.7 (new); 9; 10.3; 11.3 (L-6); 13.2; 13.3; 14.1; 21; 23.3 (new) |

## 0. Reading guide

| Section | Content | Answers |
|---|---|---|
| 1 | Tier 1 frame: subject, stakeholders, timeline, scope, rationale, method, alternatives, assumptions, gaps | |
| 2 | Current state, target state, changes required | |
| 3 | Pinned versions with licences; pinned names of commands, variables, constants and paths | Controller requirement 12 (no credential value) |
| 4 | **Serial slots**, locks, the port table, the multi-writer paths | **IQ-22** (with section 16) |
| 5 | **Lane model for live checks** (ADQ-10), emulators, load guard, decision points DP-1 to DP-3 | Requirements 4, 8 |
| 6 | Early proofs (a) to (g): what each proves, time box, fallback row | Requirement 2 |
| 7 | **Security-review corrections**: accepted (D16) and assigned to work rows; the reserved numbers | Requirement 9 |
| 8 | **Work rows W01 to W105** (W104 and W105 are the checkpoint commits), the conditional fallback rows, and the output document of each row (8.7) | Requirements 1, 6, 7, 10 |
| 9 | Waves within D6, agent count per wave, critical path | Requirement 11 |
| 10 | **Collision scan** (row, write path, lock, port) | Requirement 3 |
| 11 | The root gate rule, gate commands, expected test counts | Requirement 5 |
| 12 | **Test strategy** | **IQ-24** |
| 13 | Acceptance-criteria coverage: AC-B-01 to 93, AC-C-01 to 110, SR-01 to 82 | |
| 14 | **PostgreSQL provisioning and the Host Impact Register**, a verbatim rollback per host change | **IQ-4** |
| 15 | **PostgreSQL on a demo PC** (four OS targets) | **IQ-5** |
| 16 | **Changing the shared contract without collisions** | **IQ-22** |
| 17 | **Known issues touched** (KI-01, KI-02, KI-07, KI-18) | **IQ-25** |
| 18 | Size, and what is DEFERRABLE | Requirement 11 |
| 19 | Risks and blockers | |
| 20 | Verification approach and rollback considerations | |
| 21 | Blueprint delta for row 21: provisional row to work row | |
| 22 | Next steps | |
| 23 | Decisions for the controller to record | |

**Citation convention.** `[SP:§7.2]`, `[SP:AC-B-22]` are a section or a numbered item of `masterplan/01_specs.md`. The three specification files are cited in their **revision 2**; they are cited by section and by ID, not by line, because revision 2 moved the lines. `[SDR:SD-04]` is a finding of `gateway_check/03_security_design_review.md`. `[CC:C-02]` is a finding of `gateway_check/02_masterplan_consistency.md` (its section 11). `[DB:§8.4]`, `[DB:TI-7]` belong to `masterplan/03_database_contract.md`. `[CS:§7.2]`, `[CS:AC-C-33]` belong to `masterplan/04_client_integration_spec.md`. `[AN:TD-02]`, `[AN:279]` are a record or a line of `research/03_analysis.md`. `[BG:§6]` is `initialization/02_baseline_gate.md`. `[BP:296]` is a line of `identification/02_structured.md` (rev 1); "prov. 41" is its provisional row 41. `[RT:n]` is a line of `identification/01_translated.md`. `[DEC:D11]`, `[DEC:F24]` are rows of `decisions/decisions.md`. Code is cited as `path:line` relative to `/Users/gsp-budi/Documents/DEMS/`. `[cmd]` marks a fact read by a read-only command of this row (section 1.6). A statement without a source is labelled **hypothesis** or carries an assumption ID (PA-n, section 1.8).

**No credential value and no personal data appear in this file.** Secrets are named by constant or by file path only. Operators are named by ID.

---

## 1. Tier 1 frame

### 1.1 Subject

The implementation plan for the DEMS Core server task: 105 work rows that turn the three specifications (75 operations, 30 tables, the Live source in both clients) into code, each with one owner, exact write paths, dependencies, the criteria it implements, one verification and a rollback; the serial resources that keep a run of up to 8 agents collision-free; the order that proves the seven riskiest assumptions first; the host changes with their rollbacks; the test strategy. Revision 2 adds the accepted security corrections and two checkpoint commits.

### 1.2 Stakeholders

| Stakeholder | What this plan gives them |
|---|---|
| The user (demo owner and presenter) | A build order that keeps the Simulated demo and the 0.1.0 packages working at every step [DEC:D9]; a list of what changes on the Mac and the exact command that undoes each change (section 14); a plain statement of what may be cut if time runs short and what may not (section 18) |
| Controller | Rows to delegate as written, the slots and locks to enforce, three decision points with a default each (section 5.5), the gate commands and the test ledger (section 11), the decisions to record (section 23) |
| Row 19 (verifier, consistency check) | The coverage tables of section 13 and the collision scan of section 10; the revision history, which names every section that revision 2 touched |
| Row 20 (security-review), and the later reviews W45, W99, W100 | Section 7: every accepted finding SD-01 to SD-29 with the work rows that build it and the criteria that prove it |
| Row 21 (task-architect) | Section 21: every provisional row mapped to a work row with the action KEEP, SPLIT, MERGE, MOVE, ADD or SKIPPED; the protocol changes of section 4 |
| Implementation, test and verification agents | Section 8: their row, and the pinned names of section 3.4 |
| The owner of the other project on this Mac | Ports `[::1]:5173`, `127.0.0.1:5174`, `[::1]:5175` stay untouched (section 4.2) |

### 1.3 Timeline

| When (2026-10-04, WIB) | Event | Source |
|---|---|---|
| 01:57 | Baseline gate measured (row 13) | [BG:§1] (the run window in its head table) |
| 02:36 | Decision record accepted (row 14) | [DEC:D11] |
| 03:14 | Server specification, revision 1 (row 15) | [DEC:D13] |
| 03:53, 04:02 | Database contract and client integration specification, revision 1 (rows 16, 17) | [DEC:D14, D15] |
| 04:05 to 04:52 | This plan (row 18, wave M3), in parallel with the security design review (row 20) | `date` printed `2026-10-04 04:05 WIB` at the start of the row and `04:47 WIB` when section 8 was complete [cmd] |
| 04:25 | Security design review finished (row 20): verdict CAUTION, 5 Medium, 18 Low and 6 Info findings | `gateway_check/03_security_design_review.md` frontmatter and its summary table [cmd] |
| 05:09 to 05:25 | Revision 2 of the server and client specifications, revision 2 and then 2.1 of the database contract (rows 20a, 20b); security findings accepted (D16); plan revision 1 accepted (D17); conflicts ruled (D18, D19) | [DEC:D16 to D19]; the `last_updated` fields of the three files [cmd] |
| 05:13 to 05:30 | **Revision 2 of this plan** | `date` printed `2026-10-04 05:13 WIB` when the revision started [cmd] |
| Next | Row 19 (consistency check), row 21 (blueprint refinement), row 22 (docs commit: the reference time of SC1), then W01 | [BP:491-493] |

No duration estimate is given for the task [AN:69]. Section 6 sets time boxes for the seven proofs; they are limits after which the fallback is taken, not forecasts.

### 1.4 Scope

- **In scope**: what blueprint row 18 names [BP:291] and the controller's twelve requirements for this row: work rows; pinned versions with licences; serial slots; the port table; waves within D6; the lane model; the Host Impact Register with verbatim rollbacks; the test strategy; the known issues touched.
- **Owned by sibling files, only referenced here**: operations, access rules, security requirements and AC-B (row 15); tables, migrations, reset, seed, test isolation (row 16); the Live source, wiring map and AC-C (row 17); the technology choices (row 14).
- **Out of scope by decision**: real hardware, real PKI, TLS, an external identity provider, iOS, a Live release APK, a live package for another PC, QR scanning on the device, serving media from the server, a git remote [DEC:D4, D11, D13, DR-02].
- **Not done by this row**: no install, no code, no server or emulator process. Two files are written: this plan and the progress file. One read-only registry lookup was tried in revision 1 and failed (section 1.9, GP-01). Revision 2 ran only read-only commands and the check script.

### 1.5 Rationale and evidence chain

| Step | Fact | Source | Consequence in this plan |
|---|---|---|---|
| 1 | The baseline root test command is red on any date other than 2026-10-01 and before about 02:25 WIB, because of two web tests | [BG:§6]; [DEC:F20, D10] | W01 comes first, so every later gate compares against a green baseline |
| 2 | Nothing the design relies on has been executed: PostgreSQL binaries, `drizzle-kit`, the headless simulator, the typed client on Hermes, the dev proxy, secure storage on the AVDs | [AN:G-03]; [DB:GD-04, GD-06]; [SP:SA-01 to SA-05]; [CS:CA-05 to CA-08] | Seven proofs run before the wide waves; each has a time box and a named fallback row (section 6) |
| 3 | A failed proof changes later rows: the keg route changes the host register; a generator client adds a regeneration step to the contract slot; cross-origin transport adds CORS and changes SR-04 | [AN:TD-02, TD-09, ADQ-6] | Proof rows own the real file where the change is small (`vite.config.ts`, `src/client/`), so a pass is not thrown away |
| 4 | The contract registry, the migrations, the lockfile and the Gradle build are single-writer resources | [BP:407-415, 460-465] | Three contract rows in a chain, one migration writer, three npm slots (section 4) |
| 5 | About 30 client rows each need a live check against one Core state | [AN:659-662] | Three lane backends with their own databases; gates and end-to-end rows own port 4420 alone (section 5) |
| 6 | A device credential belongs to one database | [DEC:F24]; [CS:§9.6] | Each emulator is bound to one lane; one emulator is kept unpaired for SC5 (section 5.2) |
| 7 | Root `typecheck`, `lint`, `test` must work with no database | [DEC:D9]; [AN:484] | Database tests sit behind `test:db`; the new workspace's `test` script runs the database-free project only (section 11) |
| 8 | The seed needs a password hash, the engine needs the slice-to-table mapping, sign-in needs the Origin decision | [DB:§9.1, MR-1]; [SP:ID-1] | HB-4 and the mapping are built before the rows that the blueprint put them in (W09, W20); cross-module calls go through decorators that the scaffold declares (W08) |
| 9 | Rows 72, 88, 91 and 95 change no production file; row 41 is not built | [CS:§17.4]; [DEC:D13] | Merged into neighbouring rows; row 41 SKIPPED (section 21) |
| 10 | The security design review found 29 points; all 24 corrections are accepted and are in revision 2 of the specifications | [DEC:D16, D18]; [SDR:§4, §7] | Each finding is built by a row that already existed (section 7); the criteria SR-68 to SR-82, AC-B-72 to AC-B-93 and AC-C-102 to AC-C-110 are mapped (section 13). No new build row is needed |
| 11 | The predecessor lost its closing steps to a session break | [DEC:D17, D2] | Two checkpoint commits, W104 and W105 |

### 1.6 Method

1. Read in full: `decisions/decisions.md`; `research/03_analysis.md`; `initialization/02_baseline_gate.md`; `identification/02_structured.md` (rows 1-118, protocol P1-P22, waves, single-writer scan, tiers). Read the plan-relevant sections of the three specifications: [SP] sections 0-2, 7, 10-19; [DB] sections 0-1, 7-15; [CS] sections 0-4, 7, 9-17.
2. Read-only commands for facts that decide a write path or a command [cmd]:

| Command | Output used |
|---|---|
| `cat package.json` (root) | Scripts `typecheck`, `lint`, `test` = `npm run <x> --workspaces --if-present`; `allowScripts` holds one entry; `probe:ws` ends with ` --` (the pattern for argument forwarding, `package.json:29`) |
| `ls .locks .locks/*.users` | Lock files of the predecessor exist (`npm.lock`, `gradle.lock`, `dems_*.lock`, `mock-core.lock`, `vite.lock`); two stale markers `user-manual-test` [DEC:D9 DN-4] |
| `find release -type f` | 29 files; checksum files `release/web/SHA256SUMS.txt`, `release/android/SHA256SUMS.txt` and one `*.sha256` per archive |
| `sed` on the two failing tests | Both build their simulator with `createSim({ ... })` and no `clock` option (`apps/core-web/src/test/sim-fetch.test.ts:25-38`; `apps/core-web/src/features/storage/__tests__/storage-page.test.tsx:55-66`) |
| `grep createManualClock` | The helper exists (`packages/shared/src/sim/clock.ts:34`), is exported (`packages/shared/src/sim/index.ts:15`) and at least five web test files already use it |
| `grep` in `apps/mobile/scripts/device-session.sh` | Serials and locks per AVD (`:17-19`); a down AVD is booted cold with `-no-snapshot-load -no-snapshot-save` (`:28-30, 218-224`) |
| `git check-ignore -v apps/mobile/android` | Ignored by `apps/mobile/.gitignore:43` |
| `grep include` in the Vitest configs | Shared: `test/**/*.test.ts` (`packages/shared/vitest.config.ts:6`); web: `src/**/*.test.{ts,tsx}` (`apps/core-web/vite.config.ts:30`) |
| `cat apps/mobile/src/i18n/features.ts` | Each mobile feature folder owns its `i18n.ts` (`:1-46`) |
| `ls node_modules/fastify node_modules/@fastify/websocket node_modules/ws` | All three are hoisted to the root `node_modules` |
| `sed -n '1,12p' THIRD_PARTY_NOTICES.md` | The file lists copied-in source items only; "npm dependencies carry their own licence files inside `node_modules` and are not listed here" (`:3`) |
| `ls apps/mobile/android/app/build/outputs/apk/debug` | `app-debug.apk`, 324,503,614 bytes, 2026-10-01 10:41 |

3. Derived the rows from the specifications' own "row" columns ([SP:§16], [CS:§7.2-7.4, §12.3, §13]), then re-cut them by three tests: one owner, one verification, no write path shared with a row that can run at the same time.
4. Checked the result mechanically (a script over the tables of section 8; its output is quoted in sections 10 and 13): every AC-B and AC-C has a row; every dependency exists; any two rows whose write paths overlap are linked by a dependency path; no wave exceeds 6 agents of one type or 8 in flight.
5. **Revision 2**: re-read `decisions/decisions.md` (D16, D17, D18, DR-03, F25), the revision histories and the changed sections of the three specifications (revision 2), and the security design review; changed the rows by ID, never their numbers; re-ran the script of item 4 with the new targets (section 10.3).

### 1.7 Alternatives considered

| Alternative | Why not |
|---|---|
| Keep blueprint rev 1's order (provision, scaffold, contract, schema, ..., client rows last) | Five of the seven unproven assumptions would be met only in waves B4 to C1, after dozens of rows depend on them [BP:494-506]. The typed client and the proxy can be proven on a canned server in the first hour |
| One npm slot per concern (four, as in rev 1) | The controller asks for three. The scaffold's manifest, the shared export subpaths and the PostgreSQL binaries fit one install; the web and the mobile native install stay separate because the second needs Gradle and the emulators |
| One wide contract row (prov. 27) | 75 operations, 28 slice schemas and about 17 bodies in one agent context is the risk GS-15 [SP:§18]. Three rows in a chain keep one owner at a time and unblock identity (A), realtime and the Live source (B), and the domain modules (C) in that order |
| Parallel contract rows on disjoint files | It would relax P17 for one wave of gain; the registry file, the barrel and `openapi.json` would still need one owner. Kept serial |
| Serial ownership of port 4420 for all live checks | About 30 checks of up to 10 minutes inside waves that are otherwise parallel [AN:662] |
| Pair every emulator on demand before each device check | Each check would start at the Pair screen and spend its time box on pairing. Binding an emulator to a lane keeps its credential across `db:reset`, because the reset carries paired devices over [DB:§8.5] |
| Intermediate git commits per wave as rollback points | Not per wave. **D17 adds two checkpoint commits** (after the backend gate and after the web client wave), built here as W104 and W105; the pre-image patch of P23 stays for row-level rollback of a multi-writer file (section 4.4) |
| Let the verifier's clean-state row also uninstall and reinstall the PostgreSQL package | It would rewrite `package.json` and the lockfile in the verification phase, outside an npm slot. The data removal is proven by execution; the package removal stays a verbatim command (GP-02) |

### 1.8 Assumptions

AS-01 to AS-10 [AN:86-97], SA-01 to SA-11 [SP:§1.8], DA-01 to DA-10 [DB:§1.8] and CA-01 to CA-10 [CS:§1.8] stay in force; section 6 names the row that proves each early one. This plan adds:

| ID | Assumption | Effect if wrong | Proven by |
|---|---|---|---|
| PA-01 | One-line placeholder modules (`export {}`) under the four new export subpaths of `packages/shared` break no existing test | W03 drops the placeholders and the subpaths are added by the rows that own the folders, one npm-slot edit later | W03 |
| PA-02 | A debug build is told from the release-signed build on an emulator by the `DEBUGGABLE` package flag and by the signing certificate (general Android knowledge; the release certificate digest is recorded in `docs/2026-09-30_dems_demo_stack_setup/implementation/69_release_apk.md:57`) | W06 pulls the APK and compares its SHA-256 with `release/android/DEMS-Demo-0.1.0.apk.sha256` | W06 |
| PA-03 | `adb install -r` of the rebuilt debug APK succeeds over an installed debug build, because the debug keystore is the same after `expo prebuild` (H-B6 [BP:162]) | W13 returns `needs-review`; DP-1 is asked again for that emulator | W13 |
| PA-04 | The engine proof runs before the backend workspace exists: `node --import tsx` resolves `@dems/shared/sim` from the workspace root, as the row 13 diagnosis did [BG:§10 #11] | W04 moves after W03 | W04 |
| PA-05 | `createManualClock` at the suites' fixed instant makes both date-dependent tests independent of the wall clock without touching a production file | The row derives the identifier and the expected count from simulator state instead [DEC:D10] | W01 |
| PA-06 | Vite's command-line `--port` and `--strictPort` override the port of `vite.config.ts` for a lane (the predecessor ran a lane on 5178: `.locks/vite.5178.log` [cmd]) | The lane port becomes an environment variable read by the config file | W05 |
| PA-07 | Three emulators, PostgreSQL, up to three lane backends, two Metro processes and six agents fit the host (10 cores, 24 GB [BP:442]) | The load guard of section 5.4 | Waves C1 to C4 |
| PA-08 | The seam "module calls module through a decorator declared by the scaffold" is enough for every cross-module call of [SP:§2.2] | A row returns `needs-review`; the controller schedules a scaffold edit as a serial slot | W24, W28, W32, W42 |
| PA-09 | `packages/shared/src/i18n/en/session.ts` is the Session Monitor's file (there is a separate `session-new.ts`) [cmd: `ls`] | The other page's row logs a gap instead of editing it | W65 |
| PA-10 | A lockfile produced by `npm uninstall` followed by the pinned install is byte-identical to the one before | Only matters if the H-01 rollback is ever exercised | Not exercised (GP-02) |
| PA-11 | The denial-budget counter can be advanced or reset by a test, so the matrix test can stay inside the budget [SP:SA-14] | The matrix test paces itself with real waiting, or the budget becomes a test option of the app factory | W23, W47 |

### 1.9 Gaps

| ID | Gap | Effect | Handling |
|---|---|---|---|
| GP-01 | **`@types/pg` has no version in the research** [AN:690]. One read-only lookup in revision 1 (`npm view @types/pg version`) ended with `E502 Bad Gateway` through the sandbox proxy and was not retried outside the sandbox | It is the one dependency without an exact version in this file | **Decided by D17**: W03 installs it with `--save-exact` and records the resolved version and licence. It is a type-only development dependency |
| GP-02 | The package-removal part of the PostgreSQL rollback (H-01) is not executed by any row | "Removable with one command" [DEC:D5] is proven for the data and the process, written but unproven for the package | **Decided by D17**: written, not executed (section 14) |
| GP-03 | Which build each emulator holds, and whether any emulator runs, is unknown [BP:90, F-A20]; [DEC:F2] | Decides how many device lanes exist | W02, W06, DP-1 |
| GP-04 | **Closed.** In revision 1 the security review was read but not ruled on. D16 accepted all 24 corrections; revision 2 of the three specifications holds them; section 7 assigns each finding to a work row | None | Section 7 |
| GP-05 | Licences of already installed tools reused by the new workspace (`tsx`, `typescript`, `oxlint`, `@types/node`) are not in the research [AN:694-695] | None for pinning (they are installed at `acaff20`); the notices row reads them from the packages | W85 |
| GP-06 | Which existing tests pin a permission count or an audit-type count is known only by running them after the vocabulary change [AN:G-19] | W16 may edit a test file by design | W16 names each one in its log |
| GP-07 | No scripted end-to-end run exists (Maestro, KI-02) [AN:G-15] | SC3 to SC5 are evidence-based manual runs | W94 to W96; section 17 |
| GP-08 | No source gives a free-disk threshold, a coverage threshold or a load threshold | The plan sets none for disk and coverage (the rows report the figure); the load guard uses the core count (section 5.4) | W06, W87 |
| GP-09 | **Closed.** While this revision was being written the database contract still granted the runtime role INSERT on `audit_chain_history`; its revision 2.1 (05:25) applies D18: SELECT only [cmd] | None | W17 builds SELECT only and asserts that INSERT is refused |
| GP-10 | **Closed.** Where the check "as the bootstrap superuser" runs was open when this revision started; D19 ruled it: a `scripts/pg/` check at provisioning, trial step T5-j [DB:§7.1] | None | W07; section 7.3 |

---

## 2. Current state, target state, changes required

### 2.1 Current state

| Area | State at `acaff20` | Source |
|---|---|---|
| Backend | `apps/mock-core` serves health and a heartbeat on 4400; nothing else | [BP:81] |
| Data | Each client runs its own simulator; no database on the host | [DEC:F1]; [SP:§1.5] |
| RBAC and pairing | A static client-side table; pairing compares with a constant | [DEC:F12, F14, F15] |
| Contract | 10 operations, one of them live | [DEC:F4] |
| Tests | shared 508, mock-core 19, core-web 438 (2 fail by date), mobile 833 | [BG:§1] |
| Host | No PostgreSQL; emulators and dev servers of the predecessor session are gone | [DEC:F1, F2] |

### 2.2 Target state

One Core server (`apps/core-server`, `127.0.0.1:4420`) on PostgreSQL 18.4 (`127.0.0.1:4432`) is the source of truth in Live mode for 75 operations and one socket channel; the server refuses and audits what a role may not do; a mobile device works in Live mode only after it redeems a portal-issued code, is listed in the portal and loses access on revoke; both clients offer Simulated and Live in development builds and stay Simulated-only in packaged builds; `release/`, `apps/mock-core/` and the simulator's behaviour are unchanged [SP:§2, §10]; [CS:§3].

### 2.3 Changes required

| # | Change | Rows |
|--:|---|---|
| 1 | Green baseline on any date | W01 |
| 2 | Project-local PostgreSQL, lifecycle scripts, roles, databases | W03, W07, W17, W20, W29 |
| 3 | New workspace `@dems/core-server`: scaffold, guards, identity, RBAC, pairing, engine host, realtime, 13 modules | W08, W09, W21, W23, W24, W26, W28, W32 to W37, W39 to W43 |
| 4 | Shared vocabulary and contract for 75 operations | W16, W19, W22, W27, W83 |
| 5 | Shared client layer: typed client, socket client, Live source, settle helper, fake transport | W12, W18, W30, W31, W44 |
| 6 | Web: proxy, mode, shell, Login, nine pages, two new pages, API Reference | W05, W14, W50, W54, W55, W63 to W65, W69 to W71, W75 to W77, W81, W84 |
| 7 | Mobile: native module, runtime, auth, pairing, gate, fourteen screen folders | W13, W15, W51, W56, W57, W59, W60, W66 to W68, W72 to W74, W78 to W80, W82 |
| 8 | Tests, gates, reviews, end-to-end proof, documents, two checkpoint commits, the final commit | W38, W45 to W49, W52, W53, W58, W61, W62, W85 to W105 |

### 2.4 Files to create or modify (summary; the exact paths per row are in section 8)

| Area | Created | Modified | Rows |
|---|---|---|---|
| Root | `scripts/pg/`; `.data/` (the cluster, the log and three credential files), `.cache/` and `.locks/` content (all git-ignored) | `.gitignore`, `package.json`, `package-lock.json`, `README.md`, `THIRD_PARTY_NOTICES.md` | W03, W07, W13, W14, W85, W86 |
| `apps/core-server/` (new workspace) | Everything: manifest and configs, `src/` (entry, plugins, core, engine, realtime, 14 modules, `db/` with schema, migrations, commands, mapping, seed, fixtures, reset), `test/` (helpers, database tests, five acceptance files) | — | W03, W08, W09, W11, W17, W20 to W29, W32 to W37, W39 to W43, W47 to W49, W52, W53, W87 |
| `packages/shared/` | `src/client/`, `src/live/` (light API, `source/`, `testing/`), `src/realtime/live-socket-client.ts`, two i18n namespace files, new tests under `test/` | `package.json` (export subpaths), `src/api/**`, `openapi/openapi.json`, `scripts/gen-openapi.ts`, `src/sim/vocabulary.ts`, `src/sim/auth.ts`, `src/realtime/index.ts`, `src/i18n/index.ts`, up to thirteen existing i18n files under `src/i18n/en/` (each by the row that owns its page), up to six existing test files (by design, L-5) | W03, W12, W16, W18, W19, W22, W27, W30, W31, W44, W50, W54, W55, the web page rows, W83, W84 |
| `apps/core-web/` | `src/runtime/`, `src/lib/core-errors.ts`, `src/routes/_app/admin/`, `src/features/users-roles/`, `src/features/paired-devices/`, `src/test/live-*` | `vite.config.ts`, `package.json`, `src/main.tsx`, `src/router.tsx`, `src/routes/__root.tsx`, `src/routeTree.gen.ts`, `src/lib/core-endpoint.ts`, `src/components/shell/**`, eleven feature folders, two test files (W01) | W01, W05, W14, W50, W54, W55, W63 to W65, W69 to W71, W75 to W77, W81, W84, W87 |
| `apps/mobile/` | `src/runtime/secure-credentials.ts`, `src/runtime/core-errors.ts`, `src/runtime/dev-probes.ts`, new tests | `package.json`, `scripts/device-session.sh`, `jest.setup.ts`, seven files of `src/runtime/`, `src/auth/**`, `src/navigation/**`, two layout files under `src/app/`, sixteen feature folders, `src/features/home/use-health.ts`, `src/i18n/en.mobile.ts`; `android/` is regenerated (git-ignored) | W12, W13, W15, W51, W56, W57, W59, W60, W66 to W68, W72 to W74, W78 to W80, W82, W87 |
| Never written | | `apps/mock-core/**`, `release/**`, `scripts/release/**`, `packages/shared/src/demo-data/**`, `packages/shared/assets/**`, `apps/mobile/app.json`, `apps/core-web/src/lib/packaged-csp.ts`, and `packages/shared/src/sim/**` other than the two files of W16 | section 4.3 |

### 2.5 Dependencies of the run

| Dependency | Needed by |
|---|---|
| The docs commit of row 22 | Every work row: it is the reference time of SC1 and the rollback point of the documents |
| Controller records | Gate G-SEC: **met** (D16 accepted the review; D18 accepted revision 2 of the specifications). DP-1 is decided (D17); its outcome, the list of emulators that hold the debug build, is recorded after W06 and before W12 and W13. DP-2 is decided (D16); DP-3 before W94 |
| Internet | The npm registry for W03, W13, W14 and any fallback row; Maven artefacts during the Gradle build of W13; `npm audit` in W03 and W99. Nothing else leaves the machine [BP:475] |
| A per-command sandbox bypass | Port binding (W05, W07, every live check, the gates), the emulators and `adb` (W02, W06, W12, W13, W15, every device check), Gradle (W13), npm installs (W03, W13, W14), the mock-core suite (W89, W97), the git writes of W104, W105 and W103 [BP:446] |
| A browser (the browser tool first) | The web live checks, W94 to W96, W97 |
| The git identity | W104, W105, W103 |
| The Mac awake with the lid open | Every long wave (KI-26) |
| The baseline commit `acaff20` | Every diff check and every code rollback [DEC:D3] |

---

## 3. Pinned versions and pinned names

### 3.1 New dependencies (every package this task adds to a manifest)

Versions and licences are those of the decision record [AN:669-704]; nothing is installed yet. "Slot" is the npm slot of section 4.1.

| Package | Version | Licence | Workspace | Slot | Source |
|---|---|---|---|---|---|
| `embedded-postgres` | 18.4.0-beta.17 | MIT (wrapper); its README states Apache-2.0 for the binaries' packaging; PostgreSQL itself is under the PostgreSQL License | root (dev) | N1 | [AN:697] |
| `@embedded-postgres/darwin-arm64` (installed by the above; PostgreSQL 18.4) | 18.4.0-beta.17 | as above | root | N1 | [AN:698] |
| `pg` | 8.23.1 | MIT | `@dems/core-server`; root (dev, for `scripts/pg/`) | N1 | [AN:689] |
| `@types/pg` | **resolved at install time** with `--save-exact` and recorded by W03 [DEC:D17]; no version is in the research (GP-01) | recorded by W03 | `@dems/core-server` (dev) | N1 | [AN:690] |
| `drizzle-orm` | 0.45.3 | Apache-2.0 | `@dems/core-server` | N1 | [AN:687] |
| `drizzle-kit` | 0.31.11 | MIT | `@dems/core-server` (dev) | N1 | [AN:688] |
| `@fastify/cookie` | 11.1.2 | MIT | `@dems/core-server` | N1 | [AN:679] |
| `@fastify/rate-limit` | 11.2.0 | MIT | `@dems/core-server` | N1 | [AN:680] |
| `fastify-type-provider-zod` | 7.0.0 | MIT | `@dems/core-server` | N1 | [AN:683] |
| `@fastify/swagger` (peer of the provider; installed, not registered) | 9.9.1 | MIT | `@dems/core-server` | N1 | [AN:684] |
| `openapi-types` (peer of the provider) | 12.1.3 | MIT | `@dems/core-server` | N1 | [AN:685] |
| `rate-limiter-flexible` | 11.2.1 | ISC | `@dems/core-server` | N1 | [AN:691] |
| `@vitest/coverage-v8` | 5.0.3 | MIT | `@dems/core-server` (dev) | N1 | [AN:692] |
| `@fastify/helmet` (response headers, OR-9; added in revision 2) | 13.1.1 | MIT | `@dems/core-server` | N1 | [AN:682]; [DEC:D16]; [SP:SR-76] |
| `expo-secure-store` | 57.0.4 (declared `~57.0.4`, the form Expo's bundled list gives and the app's other Expo modules use, `apps/mobile/package.json:33-40`; the lockfile pins 57.0.4) | MIT | `@dems/mobile` | N3 | [AN:701] |
| `qrcode.react` | 4.2.0 | ISC | `@dems/core-web` | N2 | [AN:699] |

### 3.2 Reused at their installed pins (declared in the new workspace's manifest, already in the lockfile at `acaff20`)

`fastify` 5.12.5 (MIT), `@fastify/websocket` 11.3.1 (MIT; the registry's 11.3.3 is not taken [AN:214]), `ws` 8.22.0 and `@types/ws` 8.18.2 (MIT), `zod` 4.6.5 (MIT), `tsx` 4.23.15, `typescript` 6.0.3, `oxlint` 1.86.0, `@types/node` 26.6.3, `vitest` 5.0.3 (MIT), `@dems/shared` `*` [AN:675-695]; [cmd: `apps/mock-core/package.json`]. The clients reuse `@tanstack/react-query` 5.104.0 and `expo-device` `~57.0.2`, both installed [CS:CA-04, CA-06].

### 3.3 Not installed

| Package | Why | Source |
|---|---|---|
| `@fastify/static` 10.1.5 | Media is not served; prov. 41 is SKIPPED | [DEC:D13]; [SP:MS-4] |
| A second header library, a pepper, a PostgreSQL store for the lockout, a console key for the dev proxy | Not required by the accepted review ([SDR:§6]; [SP:OR-10, GS-21]). `@fastify/helmet` moved to section 3.1 in revision 2 | [DEC:D16] |
| `@fastify/cors` in the new workspace | No CORS plugin [SP:OR-5]; fallback Ff only | [AN:598] |
| `expo-camera`, any QR decoder | QR scanning is deferred; the QR test asserts the payload handed to the component | [DEC:DR-02]; [CS:§17.1 #20] |
| `drizzle-zod`, `drizzle-seed`, Playwright, Detox, Appium, MSW, `supertest` | Rejected by the decision record | [AN:354, 368, 487-488] |
| Fallback pins, installed only by a fallback row of section 8.6 | Homebrew `postgresql@18` 18.6 (PostgreSQL License); `kysely` 0.29.6 with `node-pg-migrate` 9.0.0 (MIT); `@node-rs/argon2` 2.2.1 (MIT); `@hey-api/openapi-ts` 0.99.0 (MIT); `@fastify/cors` 11.3.0 (MIT) | [AN:702] |

### 3.4 Pinned names

The specifications left these as proposals for this row [SP:§2.4, §19.5 Row 18 #2]; [DB:§8.4, §15.4]; [CS:§17.4 Row 18 #1]. They are fixed here; behaviour stays as specified.

| Kind | Name | Meaning |
|---|---|---|
| Workspace scripts (`@dems/core-server`) | `dev`, `start` | `tsx watch src/index.ts`, `tsx src/index.ts`, as mock-core [cmd] |
| | `test` | The Vitest project `unit` only: no database (D9) |
| | `test:db` | The Vitest project `db`: attaches to or starts PostgreSQL; fails, never skips [AN:484] |
| | `db:create`, `db:migrate`, `db:seed`, `db:reset`, `db:status` | As [DB:§8.4]; each takes `-- --database <name>` |
| | `db:generate` | `drizzle-kit generate`; migration writer only |
| | `coverage` | The `db` and `unit` projects with `@vitest/coverage-v8` |
| Root scripts (added by W03; the root manifest is written only in an npm slot) | `pg:init`, `pg:start`, `pg:stop`, `pg:status`, `pg:remove-data`, `pg:remove` | `node scripts/pg/<name>.mjs`. `pg:init` creates the cluster, the three credential files and **both project roles** (RP-1 to RP-6, [DB:§7.1]); `pg:status` also runs the host-authentication check HA-1 to HA-4. `pg:remove-data` stops the server and deletes `.data/`; `pg:remove` does that and uninstalls the binary package (section 14) |
| | `dev:server`, `start:server`, `db:create`, `db:migrate`, `db:seed`, `db:reset`, `db:status`, `test:db` | Aliases of the workspace scripts, each ending with ` --` so that arguments are forwarded (the pattern of `package.json:29`) |
| | `test:pg-scripts` | `node --test scripts/pg/` (Node's built-in runner; no dependency; no database) |
| Server environment | `DEMS_CORE_PORT` | 4420 (default) or 4421 to 4423; any other value stops the boot. **The database follows the port**: 4420 uses `dems_demo`, 442k uses `dems_lane_k`, so one process per database [DB:DA-07] cannot be misconfigured. The port also fixes the cookie name `dems_session_<port>` and the instance's own origins [SP:§2.4] |
| | `DEMS_DEMO_CONTROLS` | `1` turns the demo flag on; read once at boot; off by default [SP:DC-2]. Only with the flag on does the reset routine open `.data/pg.owner.env`, and only for the routine [DB:§7.1 HC-2, HC-3] |
| | `DEMS_LOG_LEVEL` | Default `info` [SP:§2.4] |
| Test environment | `DEMS_TEST_STEP` | Row label in test database names [DB:TI-2] |
| Web environment | `VITE_DEMS_CORE_MODE` | `live` or `simulated`; preselects the mode on a lane [CS:MD-2] |
| | `DEMS_CORE_PROXY_PORT` | 4420 to 4423; read by `vite.config.ts`; any other value stops the dev server [CS:WT-1] |
| Mobile environment | `DEMS_CORE_HOST_PORT` | 4420 to 4423; optional, and unset changes nothing. `device-session.sh` maps device `tcp:4420` to this host port and removes the rule at the end [CS:§9.6]. **Rev 2.1** [CC:C-13]: this is the name row 18 pins for the variable that the client specification proposes as `CORE_SERVER_PORT` and leaves to this row [CS:§9.6; AC-C-84; §17.4 "Row 18" item 1]. It is a shell variable of that one script, distinct from the shared constant `CORE_SERVER_PORT` (below) and from the server's `DEMS_CORE_PORT` (above). On a lane both variables hold the lane port: `DEMS_CORE_PORT` makes the backend listen on it, `DEMS_CORE_HOST_PORT` points the emulator at it |
| Files (git-ignored; `.data/` has mode 0700, each credential file and each log 0600) | `.data/postgres/`, `.data/postgres.log` | The cluster and the server log |
| | `.data/pg.pwfile` | The bootstrap superuser `dems_admin`. Read by `scripts/pg/` only, at provisioning; no file under `apps/` or `packages/` names it |
| | `.data/pg.owner.env` | The owner role `dems_owner`: the keys `DEMS_PG_HOST`, `DEMS_PG_PORT`, `DEMS_PG_DATABASE`, `DEMS_PG_OWNER_ROLE`, `DEMS_PG_OWNER_PASSWORD`. Read by the `db:*` commands and the test helper; by the server only inside a reset with the demo flag on |
| | `.data/pg.env` | The runtime role `dems_app`: the keys `DEMS_PG_HOST`, `DEMS_PG_PORT`, `DEMS_PG_DATABASE`, `DEMS_PG_APP_ROLE`, `DEMS_PG_APP_PASSWORD`. Read by the server's own loader and by the test helper |
| | `DEMS_PG_DATABASE` | A default, not the last word: the server takes its database from `DEMS_CORE_PORT`, a `db:*` command from `--database`. This reconciles the four keys of revision 1 with the five fields of the review [DB:§7.6 CR-1, §15.5 N-1] |
| Server constants | `DB_SCHEMA_VERSION` (1), `AUDIT_DETAIL_FORBIDDEN_KEYS` | [DB:§15.4] |
| Server configuration (values fixed by [SP:§2.4, §5.1]; the constant names are left to W08 and W23) | The web console origins; the instance's own origins; the cookie name; the throttle keys `operator:<id>`, `device:<id>`, `class:web`, `class:local`; the denial budget (20 per key per 60 s) | Constants of the server's configuration module; `WEB_DEV_ORIGINS` is not edited [SP:OR-7] |
| Lock keys | 442001 (reset), 442002 (test clone) | [DB:§8.5, TI-7] |
| Shared constants (additive, beside the existing ones) | `CORE_SERVER_HOST`, `CORE_SERVER_PORT`, `CORE_SERVER_HTTP_ORIGIN`, `CORE_SERVER_WS_URL`, `CORE_SERVER_SERVICE_NAME` | 127.0.0.1, 4420, the origin, the socket URL, `dems-core-server` [SP:§2.4]. `CORE_SERVER_PORT` names this TypeScript constant only (rev 2.1, [CC:C-13]) |
| Client constants | `LIVE_PENDING_REVEAL_MS`, `LIVE_COMMAND_TIMEOUT_MS`, `LIVE_SETTLE_TIMEOUT_MS`, `LIVE_BOOT_TIMEOUT_MS`, `LIVE_TOUCH_INTERVAL_MS`, `LIVE_RESYNCED_NOTICE_MS` | Names and values of [CS:§2.4] |
| Export subpaths of `@dems/shared` | `./client`, `./live`, `./live/source`, `./live/testing` | [CS:§2] |
| Storage keys | Web `dems.core.mode.v1`; secure store `dems.live.device.v1`, `dems.live.bio.v1`, `dems.live.bio.meta.v1`; probe item `dems.live.probe.v1` (W15 only, deleted after the probe) | [CS:MD-1, §9.1] |
| Test layout in the new workspace | `*.db.test.ts` and `test/acceptance/*.test.ts` belong to the project `db`; every other `*.test.ts` to `unit`. A module row keeps its tests in `<its folder>/__tests__/` | [AN:484]; [DEC:D12] |
| New shared tests | In `packages/shared/test/` (the only included folder, `packages/shared/vitest.config.ts:6`), with a prefix per row: `client-`, `live-light-`, `live-testing-`, `live-source-`, `realtime-live-`, `api-` | section 10 |
| New web cross-feature tests | `apps/core-web/src/test/live-<topic>-*.test.tsx`, one topic per row | [DEC:F24] |

---

## 4. Serial slots, locks and the port table

### 4.1 Serial slots

| Slot | Resource | Holders, in order | Mechanism | Rule |
|---|---|---|---|---|
| **npm** (three slots) | Every `package.json`, `package-lock.json`, `npm install`, `npm uninstall` | **N1** W03 (server, shared, PostgreSQL binaries) → **N3** W13 (mobile native) → **N2** W14 (web). A fallback row of section 8.6 takes one more slot only if its proof failed | `/usr/bin/lockf -k -t 3600 .locks/npm.lock <command>`, and a dependency chain W03 → W13 → W14 | No other row edits a manifest or runs an install; a missing package is `needs-review` [BP:407-410] |
| **Gradle** | `expo prebuild`, Gradle, the debug APK | W13 only | `/usr/bin/lockf -k -t 3600 .locks/gradle.lock <command>`; the current debug APK is copied to `.cache/apk-backup/` first (KI-21) | [BP:411-415] |
| **Migration writer** | `apps/core-server/src/db/schema/`, `src/db/migrations/`, `drizzle.config.ts` | W17; later only a controller-scheduled slot for a `SCHEMA-GAP` | Dependency; applying to `dems_demo` runs under `/usr/bin/lockf -k .locks/db-migrate.lock` | [BP:460-462]; [DB:MG-1, MG-9] |
| **Contract owner** | `packages/shared/src/api/`, `packages/shared/openapi/`, `packages/shared/scripts/gen-openapi.ts`, the shared vocabulary | W16 (vocabulary) → W19 (contract A) → W22 (contract B) → W27 (contract C) → W83 (close-out) | A dependency chain; `.locks/contract.lock` for a controller-scheduled extra slot | Section 16 |
| **Backend port 4420** with `dems_demo` | The main instance | W58, W86, W90, W94 → W95 → W96, W98 | `/usr/bin/lockf -k -t 900 .locks/core-server.lock`; the holder starts the server from the current tree, records the PID in `.locks/core-server.pid`, stops it and releases the lock | [BP:466-469]. Backend rows test in-process against their own cloned database and never bind a port |
| **Lane k** (k = 1, 2, 3) | Backend 442k, `dems_lane_k`, Vite 517(5+k), the reverse rule of the lane's emulator | Live checks of the client rows; W05 and W12 (the proof harness uses 4421); W97 (lane 3) | `/usr/bin/lockf -k -t 900 .locks/core-server.lane<k>.lock` | Section 5 |
| **PostgreSQL instance** | One cluster on 4432 with three roles: `dems_admin` (provisioning only), `dems_owner` (commands, tests, reset), `dems_app` (the server) [DEC:DR-03] | Started by W07 and left running. **Exclusive use**: W89 (stops it for the no-database check, starts it again), W90 (removes and rebuilds the data directory) | `.locks/postgres.lock` for start and stop; PID in `.locks/postgres.pid` | [BP:455-459]. No other row stops it |
| **Emulators** | Three AVDs | Device checks | `apps/mobile/scripts/device-session.sh <target> '<commands>'` holds `.locks/dems_<avd>.lock` (`:17-27`) | [BP:416-422] |
| **mock-core tests** | They bind 4410 and 4411 [BG:L145] | W89, then W97 | Dependency (W97 follows W90, which follows W89) | No other row runs the mock-core suite |
| **Git index** | Local commits only; no remote exists | Row 22 → W104 → W105 → W103 | A dependency chain | [BP:559]; [DEC:D17] |

### 4.2 Port table

Every listener binds `127.0.0.1` explicitly [BP:475]; port binding needs the per-command sandbox bypass [BP:446].

| Port | Owner | Lock | Used by |
|---|---|---|---|
| `[::1]:5173`, `127.0.0.1:5174`, `[::1]:5175` | Another project | Never bound; its processes are never stopped [BP:427] | none |
| `127.0.0.1:5173` | DEMS web console on the main instance (IPv4 explicitly) | `.locks/vite.lock` | W86, W94 to W96, W98 |
| `127.0.0.1:5176`, `5177`, `5178` | Vite lanes 1, 2, 3; each proxies `/api/v1` and `/ws` to 4421, 4422, 4423 | The lane lock | W05, the client rows, W84, W97 |
| `127.0.0.1:4400` | mock-core, unchanged | `.locks/mock-core.lock`, reference-counted in `.locks/mock-core.users/` [BP:438] | W97 (HEARTBEAT regression) |
| `127.0.0.1:4410` to `4419` | The packaged 0.1.0 launcher; the mock-core tests bind 4410 and 4411 | Serial by dependency | W89, W97 |
| `127.0.0.1:4420` | Core server, HTTP and `/ws` | `.locks/core-server.lock` | W58, W86, W90, W94 to W96, W98 |
| `127.0.0.1:4421` to `4423` | Lane backends. 4421 is also the proof harness of W05 and W12, before any backend exists | The lane lock | Section 5 |
| `127.0.0.1:4432` | PostgreSQL 18.4, TCP only, Unix socket disabled [AN:269-270] | `.locks/postgres.lock` | W07 onward |
| 8081 to 8086 | Metro lanes; the device side stays 8081 | `device-session.sh` | Device checks; at most two Metro processes [BP:444] |
| 5554, 5556, 5558 | Emulator consoles of `dems_phone`, `dems_tablet`, `dems_phone2` (`device-session.sh:129-130`) | The device locks | W02 |
| Ephemeral loopback ports | Socket tests on a real `ws` client [AN:482] | none | `test:db` runs |

5432 is never used [BP:435]. W06 probes every port of this table before W07 binds the first one: **W07 depends on W06** (rev 2.1, [CC:C-09]). Both rows stay in wave E2, W07 starting after W06, as W86 follows W84 in wave F2. W07 also checks 4432 itself with `lsof -nP -iTCP:4432 -sTCP:LISTEN` immediately before the first start and quotes the empty output [DEC:D11]. W06 needs no booted emulator to finish: it reports an emulator that is not running as such. So a problem in W02 does not hold up provisioning: if W02 ends `blocked`, the controller starts W06 on that state.

### 4.3 Paths with more than one writer

Every other write path of section 8 has exactly one writing row. For the paths below, each writer depends on the one before it, so two never run together; the script check of section 10 confirms it.

| Path | Writers in order |
|---|---|
| `package-lock.json` | W03 → W13 → W14 |
| `packages/shared/src/api/**`, `packages/shared/openapi/**`, `packages/shared/scripts/gen-openapi.ts`, `packages/shared/test/openapi.test.ts`, `schemas.test.ts`, `sim-api-validation.test.ts`, `api-*.test.ts` | W19 → W22 → W27 → W83 |
| `packages/shared/src/i18n/en/common.ts` | W16 (labels of the new permissions and audit types) → W50 (words for refusals, the offline notice, the mode) |
| `packages/shared/src/client/index.ts`, `src/live/index.ts`, `src/live/source/index.ts`, `src/live/testing/index.ts` | W03 (placeholder) → W12, W18, W44, W31 (the owner of the folder) |
| `apps/core-server/src/plugins/<name>/index.ts`, `src/modules/<area>/index.ts`, `src/core/index.ts`, `src/engine/index.ts`, `src/realtime/index.ts` | W08 (stub registered in the app factory) → the row that owns the folder |
| `apps/core-server/src/modules/identity/**` | W08 (stub) → W09 (`password-hash/`) → W24 (the module) → W41 (`biometric/`) |
| `apps/mobile/src/runtime/debug.ts` | W12 (one hook for the debug probes) → W51 (the `core=` parameter, MD-7) |
| `apps/mobile/src/runtime/dev-probes.ts` | W12 (creates it) → W15 (adds the secure-store probe) |
| `.cache/proof-harness/**` (git-ignored) | W05 → W12 |
| `apps/core-web/src/features/users-roles/index.tsx`, `features/paired-devices/index.tsx`, `packages/shared/src/i18n/en/users-roles.ts`, `en/paired-devices.ts` | W54 (stub behind the new routes) → W77, W81 (the page) |
| `apps/core-web/src/features/storage/__tests__/storage-page.test.tsx` | W01 (the fixed clock) → W71 (the folder `features/storage/**`; it does not edit this file) (rev 2.1, [CC:C-02]) |

**The two files of W01** (rev 2.1, [CC:C-02]). `storage-page.test.tsx` lies inside the folder that W71 owns. W71 saves its pre-image before its first edit (P23), does not edit it, and rolls back with R-CO for its paths followed by R-PRE for this file; that restores the state W01 left, not the state of `acaff20`, so the calendar-dependent failure of [DEC:F20] cannot come back through a rollback. Checkpoint commit 1 (W104) treats the file like every path of this table whose later writer has not finished: it leaves it out and names it, and W105 stages it. The other file, `apps/core-web/src/test/sim-fetch.test.ts`, has **no second writer** [cmd]: later rows own only `live-<topic>-*` files in `apps/core-web/src/test/`, and no rollback touches it. It tests the API Reference module (`apps/core-web/src/test/sim-fetch.test.ts:17` imports `@/features/api-reference/sim-fetch`), so the gate of W84 treats it the same way. Both files are compared with W01's state, not with `acaff20` (section 8.1).

Paths that blueprint rev 1 left without an owner [DEC:F22, F24]; [CS:GC-03] now have one: `apps/core-web/vite.config.ts` (W05), `packages/shared/src/sim/auth.ts` (W16), `apps/mobile/scripts/device-session.sh` (W13), `apps/mobile/jest.setup.ts` (W15), `apps/mobile/src/features/home/use-health.ts` (W51), `packages/shared/src/i18n/en/common.ts` (W16, W50), new tests under `apps/core-web/src/test/` (the prefix rule of section 3.4).

No writer exists for `apps/mock-core/**`, `release/**`, `scripts/release/**`, `packages/shared/src/demo-data/**`, `packages/shared/assets/**`, `apps/core-web/src/lib/packaged-csp.ts`, `apps/mobile/app.json`, and any file under `packages/shared/src/sim/` other than `vocabulary.ts` and `auth.ts` [BP:476, 562]; [SP:AC-B-61, AC-B-62]; [CS:WT-7].

### 4.4 Protocol changes for row 21 to write into the blueprint

| Rule | Change |
|---|---|
| P1 | The npm rows are W03, W13, W14 (three slots instead of four) |
| P4 | The port table of section 4.2 (4432 for PostgreSQL; Vite lanes tied to backend lanes) |
| P14 | Replaced: there is no shared Vite server on 5178. Each lane lock owns one Vite port |
| P15 | Test databases are named as [DB:TI-2] and belong to `dems_owner`; nothing in `test:db` connects as `dems_admin`; W89 and W90 are the only rows that stop the instance |
| P19 | The credential files are three: `.data/pg.pwfile`, `.data/pg.owner.env`, `.data/pg.env`. None is printed, staged or passed as an argument [DB:§7.6] |
| P16, P17 | Holders as section 4.1 |
| P18 | Lanes are enabled; the device side of `adb reverse` stays `tcp:4420` [AN:660] |
| **P23 (new) Rollback pre-image** | A row that writes a path of section 4.3 saves, before its first edit, `git diff acaff20 -- <those paths> > .cache/rollback/<row>.pre.patch` (against `acaff20`, not against the index, so that the patch stays right after a checkpoint commit) (`.cache/` is ignored, `.gitignore:47`). Its rollback is `git checkout acaff20 -- <paths>` followed by `git apply .cache/rollback/<row>.pre.patch`, which restores the state the earlier writers left |
| **P24 (new) Test ledger** | Section 11.3: each row reports the tests it added per workspace; gate rows compare the runner totals with the ledger |
| **P25 (new) Decorator seam** | After W08 no row edits `apps/core-server/src/app.ts`, `index.ts` or `config.ts`. A module reaches another through the decorators W08 declares: `deviceResolver`, `originDecision`, `sessionRegistry`, `auditWriter`, `clock`, `pipeline` (the serial unit-of-work queue, built by W21), `engine`, `publish`, `readiness`. A missing seam is `needs-review` |

---

## 5. Lane model for live checks (ADQ-10) and the emulators

### 5.1 Instances

| Instance | Backend | Database | Web | Emulator | Used by |
|---|---|---|---|---|---|
| Main | `127.0.0.1:4420` | `dems_demo` | `127.0.0.1:5173` | The reserved emulator (section 5.2) | Gates and end-to-end rows only: W58, W86, W90, W94 to W96, W98 |
| Lane 1 | 4421 | `dems_lane_1` | 5176 | `dems_phone` (`emulator-5554`) | Live checks of the client rows; the proof harness of W05 and W12 |
| Lane 2 | 4422 | `dems_lane_2` | 5177 | `dems_tablet` (`emulator-5556`) | Live checks; the tablet layout check of the Pair screen (KI-01) in W57 |
| Lane 3 | 4423 | `dems_lane_3` | 5178 | none (web only) | Web live checks first; W97's Simulated-mode walk |

One PostgreSQL instance serves all four databases [AN:660]. Rows that use a lane: W05 and W12 (harness on lane 1), W50, W51, W54 to W57, W59, W60, the page and screen rows W63 to W82, W84, W97 (lane 3) and, if it needs a running server, W99. Rows that use the main instance: W58, W86, W90, W94 to W96, W98. No other row starts a backend. The lane databases are created by `db:reset --database dems_lane_k` when W29 lands [DB:§8.4].

### 5.2 How an emulator is bound to a lane

A device credential belongs to one database: an emulator paired on lane 1 is unknown to lane 2 and to the main instance, and the app then deletes the credential and shows the Pair screen [CS:MP-10, §9.6]; [DEC:F24].

| Rule | Reason |
|---|---|
| An emulator is bound to **one** lane for the whole client phase and pairs there **once** (the first device check on that lane; W57 on lane 2 by design) | `db:reset` before each check keeps `paired_devices`, `device_credentials` and the open sessions [DB:§8.5 R-5], so the credential stays valid across resets |
| The device side is always `tcp:4420`; the host side is the lane port: `adb -s <serial> reverse tcp:4420 tcp:442k`, set and removed by `device-session.sh` through `DEMS_CORE_HOST_PORT=442k` (W13) | The app has one address and no setting for it [CS:WT-5] |
| A row removes only its own reverse rule [BP:421] | Another row may hold the same emulator next |
| **One emulator is kept unpaired** until W94: the reserved emulator (`dems_phone2`, `emulator-5558`, by default). It never runs a lane device check | SC5 needs an app with no device credential; this gives that state with no uninstall (DP-3) |
| The pairing code that a row obtains to pair its lane emulator is typed into the app and written nowhere: not in a log, a progress file or a document [BP:471-474] | P19 |
| Each instance has its own cookie name, `dems_session_<listen port>` [SP:SR-18; AC-B-90], so one browser profile can be signed in to the main console and to the lanes at once. Two operators on the **same** instance still need two browser profiles (W96) | [DEC:D16] (SD-08); built by W24 |
| In Live mode the console is opened at `http://127.0.0.1:<port>`, never at `localhost`: the server holds no `localhost` origin and answers such a sign-in with 403 `ORIGIN_NOT_ALLOWED` [CS:WT-2a] | [DEC:D18, F25] |
| A lane instance accepts as its own origins `http://127.0.0.1:4420` (the address every app uses on its device side) and the origin of its listen port; whether React Native sends either is recorded by W12 [SP:§2.4, GS-23] | [DEC:D16] (SD-02) |

### 5.3 The procedure of one live check (commands not executed by this row)

Run from `/Users/gsp-budi/Documents/DEMS`, inside one `/usr/bin/lockf -k -t 900 .locks/core-server.lane<K>.lock <row script>`:

```sh
K=1; PORT=$((4420 + K)); VITE=$((5175 + K))
npm run db:reset -w @dems/core-server -- --database dems_lane_$K        # lane backend stopped; creates the database if absent
DEMS_CORE_PORT=$PORT npm run start -w @dems/core-server > .locks/core-server.lane$K.log 2>&1 &
echo $! > .locks/core-server.lane$K.pid
curl -s http://127.0.0.1:$PORT/api/v1/health                              # expect service dems-core-server, ready true
# web check
DEMS_CORE_PROXY_PORT=$PORT VITE_DEMS_CORE_MODE=live npm run dev -w @dems/core-web -- --port $VITE --strictPort
# device check (lanes 1 and 2), holds the device lock and sets and removes the reverse rule
DEMS_CORE_HOST_PORT=$PORT apps/mobile/scripts/device-session.sh phone '<commands>'    # tablet for lane 2
# end: stop what this row started
kill "$(cat .locks/core-server.lane$K.pid)"
```

A check lasts at most 10 minutes [BP:469]. The browser is pointed at `http://127.0.0.1:$VITE` (never `localhost`). Each lane backend has its own in-memory throttle and denial-budget counters, so a check on one lane cannot use up the budget of another. A web row takes the first free lane in the order 3, 1, 2 (probe with `lockf -k -t 0`), so lanes 1 and 2 stay free for device checks. `DEMS_DEMO_CONTROLS=1` is added only by the rows whose check needs the demo operations (W76, W82, W96 if it injects a fault). The exact flags of `vite` are PA-06; the PID captured is the `npm` process, and the row stops its child by the port if needed: both details are for W05 to settle and record.

### 5.4 Load guard

| Trigger | Action | Source |
|---|---|---|
| A test that timed out passes when re-run alone, or the 1-minute load average printed by `uptime` stays above 10 (the core count, [BP:442]) | 1. Stop using lane 3. 2. If it repeats: one lane only (serial ownership, as P18 without lanes). 3. If it repeats: 2 agents of one type and 4 in flight | [DEC:D6]; [AN:661] |
| Any gate row (W58, W89) or end-to-end row (W90, W94 to W98) is running | No lane backend runs; at most 4 other agents in flight | this plan |
| Always | Vitest and jest with two workers; one `vite build`; at most two Metro processes; one Gradle build [BP:442-445] | P9 |

### 5.5 Emulator facts and decision points

**Facts.** The three AVDs exist (`~/.android/avd/dems_phone.avd`, `dems_tablet.avd`, `dems_phone2.avd` [cmd]). They are probably not running: the predecessor's host session ended and its PID files date from 2026-10-01 [DEC:F2]; [cmd: `ls -la .locks`]. An emulator is booted cold only, outside the sandbox, the way `device-session.sh:223-224` and `README.md:133` do it:

```sh
~/Library/Android/sdk/emulator/emulator -avd dems_phone  -port 5554 -no-metrics -gpu host -no-boot-anim -no-snapshot-load -no-snapshot-save &
~/Library/Android/sdk/emulator/emulator -avd dems_tablet -port 5556 -no-metrics -gpu host -no-boot-anim -no-snapshot-load -no-snapshot-save &
~/Library/Android/sdk/emulator/emulator -avd dems_phone2 -port 5558 -no-metrics -gpu host -no-boot-anim -no-snapshot-load -no-snapshot-save &
```

`npm run emulator` and `npm run emulator:phone` are not used: they boot from the snapshot (`README.md:140`). No row kills, wipes or snapshot-boots an emulator, and no row uninstalls the DEMS app or clears its data without a recorded controller decision [BP:418-419].

**What W06 reports per emulator.** Running or not; `sys.boot_completed`; whether `com.dems.demo.tablet` (`apps/mobile/app.json:21`) is installed; its build class, one of `DEBUG`, `RELEASE-SIGNED`, `NOT INSTALLED`, from `adb -s <serial> shell dumpsys package com.dems.demo.tablet` (version name, the `DEBUGGABLE` flag) and the signing certificate digest (PA-02); the existing `adb reverse --list`.

| ID | Decision point | When | Options | Controller's default |
|---|---|---|---|---|
| **DP-1** | An emulator holds the release-signed build (a debug APK cannot replace it with `adb install -r`) | After W06, before the install step of W13 | **A** Live checks use only the emulators that hold the debug build; an emulator with the release-signed build is left as it is and serves the Simulated regression walk of W97. **B** Uninstall the DEMS app on one named emulator and install the debug build (that app's local demo state on that emulator is lost; the emulator is untouched). **C** Ask the user | **Decided by D17: A.** Live checks use only the emulators that hold the debug build; an uninstall needs a recorded decision that names the emulator. What stays to record after W06 is the list of those emulators |
| **DP-2** | The secure-store observations of W15 (MB-8) show a second prompt, or a failing protected write or read | After W15, before W56 | **A** Keep `requireAuthentication` (MB-5 case a or b). **B** Store the token without it and keep the existing OS prompt as the gate (MB-5 case c) | **Decided by D16**: DEPARTURE-6 is accepted with its conditions [CS:MB-6a]: B only where `isDevice` is false or the build is a debug build; no silent fallback; no text that claims hardware protection. W15 records the case per AVD |
| **DP-3** | How the "no device credential" state of SC5 is produced | Before W94 | **A** First Live launch of the reserved emulator, which never paired (evidence: the Pair screen, and `listPairedDevices` showing no entry for it). **B** Uninstall and reinstall the DEMS app on one named emulator. **C** Unpair on the device (operation 22), which empties the secure store [CS:AC-C-80, AC-C-81] | **A** (D17 keeps `dems_phone2` unpaired until the pairing end-to-end row). C if no emulator could be reserved. B only as a recorded decision [BP:698] |

**What DP-1 A means for the lanes**, by the number of emulators that hold the debug build:

| Debug-build emulators | Device lanes | Reserved for W94 to W96 | Effect |
|--:|---|---|---|
| 3 | Lane 1 `dems_phone`, lane 2 `dems_tablet` | `dems_phone2` | As section 5.1 |
| 2 | One device lane (the tablet, if it is one of the two, so that KI-01 can be checked) | The other | Mobile device checks queue on one emulator: about ten rows of at most 10 minutes each |
| 1 | One device lane | The same emulator, with DP-3 option C | The SC5 proof starts from "unpaired on the device", not from "never paired" |
| 0 | none | none | Mobile Live work is blocked: W13 returns `needs-review` and the controller decides DP-1 B for one emulator |

---

## 6. Early proofs: time box and fallback

These seven proofs come first because a failure changes later rows [AN:895]. A time box is a limit set by this plan: when it is reached without a pass, the row stops, reports, and the controller schedules the fallback row of section 8.6 after recording the drift.

| # | Proof | Row | What it proves (assumptions closed) | Depends on | Time box | On failure |
|---|---|---|---|---|---|---|
| (a) | The two calendar-dependent web tests pass on any date and at any hour | W01 | F20; PA-05 | Row 22 | 30 min | Inside the row: derive the identifier and the expected count from simulator state [DEC:D10]. If still red: `needs-review`; gates keep accepting exactly these two failures by name |
| (b) | PostgreSQL 18.4 from the npm binaries: install with the reviewed install script, `initdb`, start on 4432, a query through `pg`, a template clone, restart, no service. **Rev 2:** three roles; the host-authentication check and a refused wrong password (T3-a, T3-b); as `dems_owner`: create, clone, rename in a transaction, lock as a template, drop, and the refusal of `SET session_replication_role` and `CREATE ROLE` (T5-a to T5-i); as `dems_admin`, once: the superuser trigger check (T5-j) [DB:§7.1] | W03 (T1, T8), W07 (T2 to T7) | AS-01, AS-09, G-05, G-06 [AN]; DA-06, DA-11, DA-12, PG-13, PG-21 to PG-23, PG-26 to PG-28 [DB] | Row 22 | 45 min for W07 | **Fb**: the Homebrew keg `postgresql@18` [DEC:DR-01]; drift entry; the user is told with the removal block H-12 [DEC:D11] |
| (c) | `drizzle-kit` 0.31.11 and `drizzle-orm` 0.45.3 on PostgreSQL 18.4, Node 26.8.2, TypeScript 6.0.3: named CHECK, partial unique index, composite key, `bytea`, `jsonb`, custom SQL file, file order, `migrate()` twice | W10 | AS-02; DA-03, GD-06, PG-08 [DB]; [DEC:F23] | W07 | 45 min | **Fc**: step 1, the constraint that cannot be generated moves to the hand-written file `0002a_extra_constraints` [DB:§8.2] (no new row; W17's file list grows). Step 2, only if the tool does not run at all: Kysely 0.29.6 with `node-pg-migrate` 9.0.0 [AN:356] |
| (d) | The shared simulator runs headless under Node with a manual clock: the recording scenario for 60 s gives the simulator's audit-type sequence; rehydration from a snapshot; `inject(POWER_FAIL)` moves RECORDING to FAULT; `AUDIT_TAMPER` touches the ring only; the actor scope is cleared after a command, also after one that throws (rev 2) | W04 | AS-03, G-25 [AN]; SA-04, SA-05, SA-10 [SP] | Row 22 | 60 min | **Fd**: ADQ-1 option (C), the pure transition functions with a server-owned loop [AN:522]. W26 changes; the operations and the tables do not |
| (e) | The registry-driven typed client on an Android emulator with the default `expo/fetch`: one GET, one POST with a body and one error envelope validated by zod on the device; which `Origin`, if any, the app sends on `fetch` and on the socket upgrade (rev 2: both outcomes are in the decision tables of [SP:§14.2]); a socket takes an `Authorization` header and reports close code 4403 | W12 | AS-05, G-07 [AN]; SA-03 [SP]; CA-08 [CS]; [DEC:F18] | W03, W05, W06, DP-1 | 90 min | **Fe**: the generator `@hey-api/openapi-ts` 0.99.0 [AN:439]: one npm slot and a regeneration step in every contract row. If only CA-08 fails: no row; W30 learns a revocation from the next REST call [CS:CA-08] |
| (f) | The Vite dev proxy carries `Cookie`, `Set-Cookie`, `Origin`, `x-dems-epoch`, `x-dems-revision`, `retry-after` on HTTP and the cookie and `Origin` on the `/ws` upgrade, and leaves Vite's own socket alone; the proxy block sets no header and rewrites no `Origin` (rev 2) | W05 | AS-07, G-09 [AN]; SA-02 [SP]; CA-05 [CS] | Row 22 | 45 min | **Ff**: ADQ-6 option (B), cross-origin calls with `@fastify/cors` 11.3.0 and credentials [AN:598]. It changes OR-5 and SR-04, so it returns to a security review before it is built [SP:OR-5] |
| (g) | `expo-secure-store` 57.0.4 on each debug-build AVD: unprotected write and read; protected write, protected read, the write after a rotation, and whether each shows a prompt; `isDevice` | W15 | AS-06 [AN]; CA-06, CA-07 [CS]; DEPARTURE-6 | W13, W12 | 60 min after W13 | No new row: MB-5 case (c) by DP-2. If even the unprotected item fails: `needs-review` (no ready-made alternative is bundled for SDK 57, [AN:453]) |

Smaller proofs that ride on an early row, each with a fallback that needs an npm slot or changes one row only:

| Proof | Row | On failure |
|---|---|---|
| SA-01: a refusal in `onRequest` wins over an invalid body [SP:§1.8] | W08 | The guard moves to the earliest hook before validation; error precedence changes for malformed bodies only |
| AS-08: `crypto.argon2` works on Node 26.8.2 [AN:95] | W09 | **Fh**: `@node-rs/argon2` 2.2.1 (one npm slot) |
| TD-12: template clone and its guard [DB:§10] | W11 | Clones stay serialised; if `CREATE DATABASE ... TEMPLATE` fails, T5 of W07 has already failed and Fb applies |
| PG-21: an `ENABLE ALWAYS` trigger fires for a superuser session that set `session_replication_role = replica` [DB:§1.9] (rev 2) | W07 (trial step T5-j, section 7.3) | The row reports it; the guarantee against a superuser session then rests on the rule that nothing connects as `dems_admin` after provisioning [DB:§7.1 HC-1]. Recorded as drift |
| SA-13: `@fastify/helmet` 13.1.1 produces the header set of OR-9 [SP:§1.8] (rev 2) | W08 | The missing or unwanted header is set in the `onSend` hook |
| SA-14: the denial budget as a limiter of `rate-limiter-flexible` that a test can reset [SP:§1.8] (rev 2) | W23 | A counter of a few lines inside the guard would be a new hand-built element: `needs-review` under I1 |
| SA-12: a JSON parse error may quote its input [SP:§1.8] (rev 2) | W24 | None: parse failures are logged by code only in either case |

Proofs that can only run inside their client row, each with a fallback local to that row: CA-03 `router.invalidate()` (W54; fallback: explicit navigation from a route-to-permission map), CA-02 one React commit for a store update and a navigation (W67; fallback in [CS:§8.6 S2-2]), CA-10 inline SVG from `qrcode.react` (W81; fallback: digits only, [AN:470]), SA-06 and CA-01 meter and round-trip timing (W98).

**How W01 fixes the two tests** (test files only, no production file): both suites build their simulator through one local helper (`makeSim`, `mount`) that passes no clock, so the dataset follows the wall clock [BG:§6.2]. The helper gets `clock: createManualClock(<the suites' fixed instant, 2026-10-01 10:00 WIB>)`, the instant the other suites and the demo packages use [AN:569]; [cmd]. That this alone is enough is assumption PA-05. The two files are among the 61 simulator-dependent test files, so their diff is a **recorded change** under D10 for AC-B-59 and AC-C-101 (section 23).

**The proof harness of W05 and W12.** A throw-away Fastify script in `.cache/proof-harness/` (git-ignored), run with `node --import tsx` on `127.0.0.1:4421`. It answers three canned, contract-valid responses from the existing registry and demo examples (GET health, POST `createSession` 201, POST `exportEvidence` 403), sets and reads a probe cookie, echoes the headers it received into its log, and serves `/ws` with a close code on request. `fastify`, `@fastify/websocket` and `ws` resolve from the root `node_modules` [cmd]. It holds no real secret and is deleted by the row that last used it.

---

## 7. Security-review corrections: accepted and assigned (the reserved slot)

> **Status in revision 2.** The slot that revision 1 reserved has been used. Row 20 returned CAUTION (no Critical, no High, 5 Medium, 18 Low, 6 Info); **D16 accepted all 24 corrections**; rows 20a and 20b folded them into revision 2 of the three specifications (the database contract is at revision 2.1), and D18 and D19 accepted those and ruled their conflicts. This section assigns every finding to the work row that builds it. Nothing here is "mapped but not accepted" any more: the rows of section 8 carry the corrections in their scope, their criteria and their verification.

### 7.1 What became of the slot

| Item of revision 1 | State in revision 2 |
|---|---|
| S1: amend the server and client specifications | **Done** as row 20b: `01_specs.md` revision 2 (SR-01 to SR-82, AC-B-01 to AC-B-93) and `04_client_integration_spec.md` revision 2 (AC-C-01 to AC-C-110) [DEC:D18] |
| S2: amend the database contract | **Done** as row 20a: `03_database_contract.md` revision 2, contract revision `dbc-2` (30 tables, three roles). Its revision 2.1 applies the two rulings of D18 and D19: SELECT only for the runtime role on `audit_chain_history`, and the superuser trigger check at provisioning |
| S3: amend this plan | **This revision** |
| Gate G-SEC | **Met.** The token is REMOVED from the "Depends on" cells: every work row starts after row 22, which follows the gate |
| Reserved numbers W104 to W109 | W104 and W105 are the two checkpoint commits that D17 adds (section 8.5a). **W106 to W109 stay reserved** for a finding of a later review (W38, W45, W91 to W93, W99, W100) that needs a row of its own |
| The table "findings mapped, not accepted" | **REMOVED** (superseded by D16); section 7.2 replaces it |

### 7.2 Every finding and the work rows that build it

No finding needed a new build row. "Built by" names the rows whose scope changed; "Criteria" the requirements and acceptance criteria that revision 2 of the specifications added or changed for it; the row that must make a criterion pass is in section 13. **Rev 2.1** [CC:C-10]: every row named under "Built by" cites the finding or one of its criteria in its "Implements" cell (106 pairs, script check of section 10.3). The nine pairs that the consistency check named now cite the finding itself, and with it the requirement or criterion the row contributes to; the acceptance tests stay with the rows of section 13.

| Finding | Severity | Correction [SDR:§4, §7] | Built by | Criteria |
|---|---|---|---|---|
| SD-01 | Medium | Three roles: `dems_admin` at provisioning only; `dems_owner`, not a superuser, owns the databases and does migrate, seed, reset and tests; `dems_app` is the runtime role. The server never reads the superuser's password file | W07 (the roles, three credential files, the trial as `dems_owner`); W10, W11, W20, W25 (run as `dems_owner`); W17 (ownership, boot checks B-4 and B-9); W08 (the loader opens `pg.env` only; the static test); W29 (every reset step as `dems_owner`; the role check of R-0); W43 (the owner file is read only inside a reset with the flag on) | SR-68, SR-58; AC-B-72 |
| SD-02 | Medium | Two Origin lists: the web console origins for the cookie and for web sign-in; the instance's own origins only for a request without a cookie | W23 (both lists); W24 (the console rule ID-1 a); W28 (the HTTP decision table); W42 (the socket decision table); W12 (records what React Native sends) | SR-69, SR-19, SR-21; AC-B-32, AC-B-43, AC-B-73 |
| SD-03 | Medium | A denial budget at the throttle stage: 20 audited refusals per key in 60 s, then 429 without a row | W23 (the limiter); W28 (the guard counts each refusal row); W24, W32 (their refusals count); W47 (the matrix test stays inside the budget, [DEC:F25]); W44, W50, W51, W54, W55, W59 (a 429 is worded as a limit, LB-10) | SR-71, SR-23, SR-45; AC-B-16, AC-B-75; AC-C-110 |
| SD-04 | Medium | Server-native state changes are atomic: one unit of work, the attempt consumed before the verification, compare-and-set transitions, five concurrency tests | W21 (the serial unit-of-work queue); W17 (the statements at database level, T-AT-1 to T-AT-5); W24 (sign-in, AT-C1); W32 (redeem, AT-C2 and AT-C3); W41 (biometric token, AT-C4); W33 (last administrator, AT-C5) | SR-72, SR-27, SR-47; AC-B-76 to AC-B-80 |
| SD-05 | Medium | The request log holds the route pattern, never the raw URL; parse errors are logged by code | W08 (the log line); W24 and W42 (marker tests); W58 (the scan of the acceptance run's log) | SR-48, SR-49; AC-B-29, AC-B-42 |
| SD-06 | Low | Both audit triggers `ENABLE ALWAYS`; boot check B-5 expects `'A'` | W17 (three triggers with `'A'`; T-AO-2a, T-AO-2b, T-AO-2d, T-AO-3); W08 (the static test T-AO-4); W07 (the check as the superuser, trial step T5-j, section 7.3) | SR-52 |
| SD-07 | Low | The allowlist without `localhost`; exact match; `null` refused; the negative test through the dev server; the proxy sets no header | W23, W42 (the lists and the comparison); W05 (the proxy block); W50 (the negative test and the static test of the config); W86 (the README names `127.0.0.1`) | SR-70; AC-B-74; AC-C-102 |
| SD-08 | Low | A cookie name per instance | W24; W55 (its tests) | SR-18; AC-B-23, AC-B-90; AC-C-38 |
| SD-09 | Low | One credential per request; a session is bound to its transport | W24; W47 (the credential-misuse cells) | SR-73; AC-B-15, AC-B-81 |
| SD-10 | Low | `TOKEN_REUSE`: a reused biometric token ends the family's open sessions | W17 (the value in the closed set, before the first migration); W22 (the message); W41 (the session end); W42 and W48 (the socket close); W44, W56 (the clients) | SR-74, SR-36; AC-B-31, AC-B-82; AC-C-108 |
| SD-11 | Low | `reportBiometricFailure` names an operator only where an enrolment exists | W41 | SR-37, SR-65; AC-B-83 |
| SD-12 | Low | The throttle key is the resolved principal or a fixed class; the credential is resolved before the throttle; upgrades are counted | W08 (the stage order); W23 (the keys); W24 (the resolve step); W28, W42 (the tests) | SR-24, SR-75; AC-B-84 |
| SD-13 | Low | A separate cap for anonymous sockets (6 of 16) | W42 | SR-42; AC-B-85 |
| SD-14 | Low | Response headers through `@fastify/helmet` 13.1.1 and `Cache-Control: no-store` | W03 (the package, npm slot N1); W08 (the plugin and the `onSend` hook); W52 (the assertion) | SR-76; AC-B-14 |
| SD-15 | Low | Secret files: modes, five discrete fields, the loader, no secret in an argument, the `pg_hba.conf` check | W07 (files, modes, the check, the static test over `scripts/` and the manifests); W08 (the loader and the static test over `apps/core-server/`); W58, W90 (`stat`) | SR-02, SR-60, SR-77; AC-B-64, AC-B-86 |
| SD-16 | Low | Try-it deny list for operations 2, 7, 8, 15, 18, 23 | W84; W100 re-checks | AC-C-100, AC-C-103 |
| SD-17 | Low | The demo-password conditions C1 to C4 | W55, W59 (the disclosure sentence, no server data before sign-in, hidden in presentation mode); W86 (the README sentences) | SR-63; AC-B-92; AC-C-104 |
| SD-18 | Low | The DEPARTURE-6 conditions | W15 (the wrapper); W56 (the behaviour and the wording); W100 re-checks | AC-C-105 |
| SD-19 | Low | A durable lineage of discarded audit chains: a table that survives every reset [DEC:D16], on which the runtime role has SELECT only [DEC:D18] | W17 (the table, its trigger, the grant); W29 (carry-over and the appended row); W27 (the schema of the answer); W39 (returned by `verifyAuditChain`); W43; W75 (the chain panel) | SR-78, SR-56; AC-B-57, AC-B-87; AC-C-109 |
| SD-20 | Low | The administration queries and the code memory are cleared on sign-out, on a session end and on permission loss | W50 (the bridge); W77, W81 | AC-C-106 |
| SD-21 | Low | The hash is always computed; the salt source; no pepper | W09, W24 | SR-05, SR-08, SR-61; AC-B-24 |
| SD-22 | Low | The actor scope is cleared in a `finally` | W04 (the proof), W26 | SR-79; AC-B-53 |
| SD-23 | Low | Log scans include a marker password and a marker pairing code | W55, W56, W57, W81, W84; W100 re-checks | AC-C-65, AC-C-75, AC-C-107 |
| SD-24 | Info | The cookie has no `Max-Age` [DEC:D18] | W24; W55 records the browser and its version | SR-18; AC-B-23 |
| SD-25 | Info | Supply-chain records SU-1 to SU-3 | W03 (the script hashes, `npm audit`, no blanket approval); W07 (the binaries' hashes); W13, W14 (`npm audit`); W90 (recomputes) | SR-80; AC-B-91 |
| SD-26 | Info | The boundary sentence (a single-user Mac) | No row: text of [SP:§15.11] | none |
| SD-27 | Info | The stored-chain check is incremental | W39 | SR-81; AC-B-88 |
| SD-28 | Info | A log line for `acknowledgeAlert` and `updateSettings`; no audit row | W40 | SR-82; AC-B-89 |
| SD-29 | Info | The note on operation 23 | No build row: text of [SP:§6.3]. The reviews W45 and W99 report a `DEVICE_CREDENTIAL_ROTATED` row outside the server's own tests as unexpected | none |

**Rulings of D18 that the rows follow.** CF-1: the pairing concurrency criterion keeps three counted failures, the 60 s lock, two more, closed at exactly five (W32, AC-B-76). CF-2: SELECT only for the runtime role on the lineage table (W17, AC-B-87). OP-1: `getSignInStatus` stays a GET that needs no console identity (W24, W32, W48; AC-B-32). GS-24: the fifth concurrency test is the concurrent sign-in test (W24, AC-B-80). GS-25: a pairing code cancelled by a reset gets no `PAIRING_CODE_CLOSED` row (W29). LB-10: a 429 has its own wording (W50, W51, W54, W55, W59; AC-C-110). D14's text rule API-13 is built by W19 and tested by W52 (AC-B-93).

**Consequences of the denial budget for the run itself** [DEC:F25]. (1) The matrix test W47 advances the manual clock by 60 s, or resets the counter, after at most 20 denied cells of one key; "no cell is answered 429" is part of its verification. (2) A live check that provokes more than 20 refusals or failed sign-ins of one key within a minute gets 429 on everything except health for up to 60 s; each lane has its own counters (section 5.3), and a row waits out the window instead of treating the 429 as a defect. (3) The key `class:web` is shared by every signed-out web console of one instance: accepted inside the single-machine boundary.

**Rulings that change nothing** [SDR:§6]; [DEC:D16]: accepted as specified are G-08, G-10 and DC-8, G-11, GS-01 to GS-09, GD-01, G-26 and the parameters chosen without a source. So no row gains a PostgreSQL lockout store, a digest CHECK, a view permission, a console key, a pepper or a `Sec-Fetch-Site` check [SP:OR-10, GS-21]. The 17 accepted residual risks are [SDR:§8].

### 7.3 Where the superuser trigger check runs

**Decided by D19** (it was open when this revision started, and this plan's default was the same). No conflict remains.

| Point | Text |
|---|---|
| The correction | A test "as the bootstrap superuser with the setting on": an `ENABLE ALWAYS` trigger must still refuse a change when a superuser session has set `session_replication_role = replica` [SDR:SD-06]; behaviour PG-21 of [DB:§1.9] |
| The ruling | A check of `scripts/pg/`, the one place that may read `.data/pg.pwfile`, **run at provisioning** as trial step T5-j, outside `test:db`. Nothing under `apps/core-server/` reads the superuser's password file [DEC:D19]; [DB:§6.5 T-AO-2c, §7.1] |
| What W07 does | In the trial database, on a scratch table with a refusal trigger of the same text as the audit table's [DB:§6.3]: as `dems_admin`, set the trigger `ENABLE ALWAYS`, `SET session_replication_role = replica`, then UPDATE, DELETE and TRUNCATE: each refused with `ZA002`. Then the trigger in the default mode and the UPDATE again: it succeeds, which shows that `ALWAYS` is what holds. The superuser session is closed before step T5-h; the scratch table goes with the trial database |
| What W17 does | The real triggers do not exist at provisioning. W17 proves in the catalog that the three triggers have `tgenabled = 'A'` (T-AO-2d) and that the owner role cannot switch the session mode (T-AO-2b); boot check B-5 re-checks the mode at every start |
| Consequence for the run | After W07 **no row connects as `dems_admin`**. If T5-j fails, W07 reports it and the protection against a superuser session rests on that rule alone (drift, for the controller) |

### 7.4 Later slots of the same kind

Findings of the access-control checkpoint (W45) and of the foundation review (W38) go back to the owning row before the backend gate W58 [BP:581-584]; findings of the final reviews (W91 to W93, W99, W100) go back to the owning row, and any code change after those reviews started triggers a delta re-check by the same reviewer before W103 [BP:585]. A finding that needs a row of its own takes a number from W106 to W109.

---

## 8. Work rows

### 8.1 How to read the tables

| Column | Meaning |
|---|---|
| ID | W01 to W105. Row 21 gives them their blueprint step numbers (section 21). A row that revision 2 changed says "Rev 2:" in its title cell |
| Prov. | The provisional blueprint row or rows this row replaces [BP:296-391]; "new" if none |
| Agent / tier | A real agent of CLAUDE.md §9. **R** = the session model. **D** = `model="sonnet"`, used only for purely mechanical rows (W02, W14, W85, W103, W104, W105); never for a verification-phase agent (CLAUDE.md §11) |
| Wave | Earliest wave (section 9). A row starts when its dependencies are done and a slot is free |
| Depends on | Direct dependencies. `22` is FIRM row 22 (docs commit). `DP-n` is a decision point of section 5.5. The gate `G-SEC` of revision 1 is met and no longer appears (section 7.1) |
| Owned write paths | Exact, relative to `/Users/gsp-budi/Documents/DEMS/`. `{a,b}` means each of them. A row writes nothing else, except its output document (section 8.7) and its progress file under the task folder. "(none)" means that the row writes no file outside the task folder: its output document is its whole deliverable [DEC:D21] |
| Locks and ports | `npm`, `gradle`, `contract`, `migration` = the serial slot of section 4.1. `pg` = uses the PostgreSQL instance through its own cloned test database. `pg-exclusive` = sole user of the instance. `main` = port 4420 with `dems_demo` under `.locks/core-server.lock`. `lane` = any free lane lock; `lane1`, `lane2`, `lane3` = that lane. `device` = a device lock through `device-session.sh` |
| Implements | Decision, rule and criterion IDs. `AC-B-23..27` means AC-B-23 to AC-B-27 |
| Verification | One command or observable with the expected result. It is applied on top of the gate named below |
| Rollback | A class of the table below, or a line of the Host Impact Register (section 14). Run only on the controller's instruction [BP:616] |

| Gate | Applies to | Content |
|---|---|---|
| **SG** standard gate | Every row that writes code | Typecheck and lint of each workspace it wrote, and its own tests, exit 0 with the runner output quoted [BP:270]; the workspace totals are at or above the ledger of section 11.3 |
| **MODG** module gate | Backend module rows | SG, and: the folder's route list equals the registry operations of its area (both quoted); each operation has a success test, a denial test if it carries a permission and a validation test if it has a body (AC-B-68); tests run in-process against the row's own cloned database (`DEMS_TEST_STEP=<row>`); no port is bound |
| **CLG** client gate | Web page rows and mobile screen rows | SG, and: (a) the folder's existing tests pass and their files are absent from `git diff --stat acaff20` (AC-C-101), except the two files of W01, which are compared with W01's state (below); (b) one Live test, on the fake transport, per settle site named in the row, covering success, the site's refusal with the denied toast (AC-C-48) and an outage; (c) `grep` finds no `useSimActions` and no `.actions` read on a `Sim` in the folder's production files (AC-C-53); (d) one live check of at most 10 minutes on a lane, with a screenshot or a screencap path |

| Rollback class | Action |
|---|---|
| **R-NEW** | The row created its paths: remove them (`git clean -fd -- <paths>`); where a stub or placeholder existed before, restore it by P23 |
| **R-CO** | The row is the only writer of tracked files in this task: `git checkout acaff20 -- <paths>` |
| **R-PRE** | A path of section 4.3: `git checkout acaff20 -- <paths>` then `git apply .cache/rollback/<row>.pre.patch` (P23) |
| **R-NONE** | Read-only row: nothing to undo; its report is deleted if the row is repeated |
| **H-nn** | The verbatim commands of that line in section 14 |

**W01's state** (rev 2.1, [CC:C-02]). W01 changes two existing test files, so these two differ from `acaff20` for the rest of the task: `apps/core-web/src/test/sim-fetch.test.ts` and `apps/core-web/src/features/storage/__tests__/storage-page.test.tsx`. W01's log records the output of `git hash-object <file>` for each. Wherever a gate asks that existing test files are unchanged, these two are compared with that record and not with `acaff20`: `git hash-object <file>` prints the recorded value, which shows that the file holds W01's change and nothing else. It applies to CLG (a) in W71, to the verification of W84 and to L-6 in the gates W89 and W97 (section 11.3). The value depends on the file content only, so a checkpoint commit does not change it.

### 8.2 Early rows: baseline fix, environment, npm slots, proofs (waves E1 to E4)

| ID | Prov. | Title and scope | Agent / tier | Wave | Depends on | Owned write paths | Locks and ports | Implements | Verification | Rollback |
|---|---|---|---|---|---|---|---|---|---|---|
| W01 | new | **Baseline fix slot.** Give the two calendar-dependent web tests a fixed simulator clock (section 6); test files only | coder-execution / R | E1 | 22 | `apps/core-web/src/test/sim-fetch.test.ts`; `apps/core-web/src/features/storage/__tests__/storage-page.test.tsx` | none | D10(a); F20; AC-B-59 (recorded change); precondition of AC-B-58, AC-C-101 | `npm run test -w @dems/core-web -- --maxWorkers=2` prints `Tests  438 passed (438)`, and the two files print `Tests  24 passed (24)` under the shifted-clock preload of [BG:§6.2] at 2026-10-04 00:10 WIB and at 2026-10-02 12:00 WIB. **Rev 2.1:** the row's log records `git hash-object` of each of the two files; the two values are "W01's state" of section 8.1 | R-CO |
| W02 | new | **Emulator cold boot.** Boot the three AVDs with the commands of section 5.5, outside the sandbox; no install, no app start | coder-execution / D | E1 | 22 | `.locks/dems_phone.pid`; `.locks/dems_tablet.pid`; `.locks/dems_phone2.pid` | device (all three) | P3; KI-26 reminder | `adb devices` lists `emulator-5554`, `emulator-5556`, `emulator-5558` as `device`, each `adb -s <serial> shell getprop sys.boot_completed` prints `1`, and the three process command lines contain `-no-snapshot-load -no-snapshot-save` | H-14 |
| W03 | 23, 25, 57 (npm parts) | **npm slot N1.** Add `/.data/` to `.gitignore` first. Create the `@dems/core-server` manifest (version 0.2.0, scripts and pins of section 3), its `tsconfig.json`, its `vitest.config.ts` (projects `unit` and `db`, `maxWorkers: 2`, coverage), one version constant with one test. Add the root dev dependencies and root scripts of section 3.4, the four export subpaths of `@dems/shared` with one-line placeholders. Read the install script of `@embedded-postgres/darwin-arm64`, approve it by exact name, rebuild, run `npm audit signatures` [AN:285-291]. **Rev 2:** `@fastify/helmet` 13.1.1 joins the install [DEC:D16]; `@types/pg` is resolved with `--save-exact` and its version and licence are recorded [DEC:D17]; the SHA-256 of the install script and of `native/pg-symlinks.json` as read, and the `npm audit` output, are recorded (SU-1, SU-2); no blanket approval of install scripts (SU-3) | coder-execution / R | E1 | 22 | `.gitignore`; `package.json`; `package-lock.json`; `apps/core-server/package.json`; `apps/core-server/tsconfig.json`; `apps/core-server/vitest.config.ts`; `apps/core-server/src/version.ts`; `apps/core-server/src/version.test.ts`; `packages/shared/package.json`; `packages/shared/src/client/index.ts`; `packages/shared/src/live/index.ts`; `packages/shared/src/live/source/index.ts`; `packages/shared/src/live/testing/index.ts` | npm | TD-01, TD-03, TD-04, TD-06, TD-12 (pins); F21; trial T1, T8; ADQ-8; SR-60; AC-B-58; GP-01; SR-76 (package), SR-80; AC-B-91; SD-14, SD-25 | `npm install` exits 0; the lockfile diff against `acaff20` holds only the packages of section 3.1 (slot N1) and their transitive dependencies (list quoted, with the resolved `@types/pg`); `npm install-scripts ls` prints no unreviewed script; `npm ls react react-dom --all` shows one copy each; root `npm run typecheck` and `npm run lint` exit 0. The row log holds the two SHA-256 values and the `npm audit` output | H-01 |
| W04 | 37 (first step) | **Proof (d): headless engine.** A script that creates the shared `Sim` under Node with a manual clock, an injected scheduler and memory storage, and checks the five points of section 6 (d). Scratch only. **Rev 2:** point d5 also covers a command that the hosted action refuses by throwing (SD-22) | coder-execution / R | E1 | 22 | `.cache/proof-engine/**` | none | ADQ-1; AS-03; SA-04, SA-05, SA-10; G-25; input to AC-B-52, AC-B-53; SR-79 (input) | `node --import tsx .cache/proof-engine/headless.mts` exits 0 and prints `PROOF d1 PASS` to `PROOF d5 PASS` (audit-type sequence equal to the reference; rehydrated durable state deep-equal; RECORDING to FAULT on `POWER_FAIL`; ring-only tamper detected; `auth` signed out after each command, also after one that throws) | R-NEW |
| W05 | 62 (proxy part) | **Proof (f): Vite dev proxy.** Add the `server.proxy` block for `/api/v1` and `/ws` with `DEMS_CORE_PROXY_PORT` [CS:WT-1 to WT-3]; write the proof harness of section 6; settle the lane start details of section 5.3. **Rev 2:** the proxy block has no `headers` option, no `changeOrigin` and no hook that changes a request header [CS:WT-2, WT-2a] | coder-execution / R | E1 | 22 | `apps/core-web/vite.config.ts`; `.cache/proof-harness/**` | lane1 (ports 4421 and 5176) | ADQ-6; WT-1..3; AS-07; SA-02; CA-05; AC-C-34 (transport); F22; SD-07; AC-C-102 (config) | With the harness on 4421 and the dev server on 5176: `curl -si` through 5176 returns the harness's `Set-Cookie`, `x-dems-epoch`, `x-dems-revision` and `retry-after`; the next request and a `ws` upgrade through 5176 reach the harness with `Cookie` and `Origin` unchanged (harness log quoted); Vite's own socket still connects; `npm run test -w @dems/core-web -- --maxWorkers=2` is unchanged. The proxy block holds no `headers`, no `changeOrigin` and no rewrite hook (quoted) | R-CO; R-NEW |
| W06 | 24 (moved before provisioning) | **Environment check**, read-only: every port of section 4.2 free or owned as stated; the other project's listeners untouched; per emulator the build class of section 5.5; Node and npm versions against [BG:L12]; free disk space (figure only); whether the Maestro CLI starts outside the sandbox (KI-02). Removes the two stale `user-manual-test` markers [DEC:D9 DN-4]. **Rev 2.1:** W07 waits for this row (section 4.2): the port section is written first, and an emulator that is not running is reported as such and does not hold the row | verifier / R | E2 | W02 | `.locks/mock-core.users/user-manual-test`; `.locks/vite.users/user-manual-test` | device (read-only `adb`) | D9 DN-4; H-B6; G-14, G-15; input to DP-1 | Each check is marked PASS or FAIL with its command output quoted; the build class and certificate digest of each emulator are recorded; `node -v` is `v26.8.2` and `npm -v` is `11.19.1`; no process started by the row is left running | H-16 |
| W07 | 23 | **PostgreSQL provisioning and trial.** `scripts/pg/` (init, start, stop, status, remove-data, remove, the host-authentication check, the superuser trigger check; plain `.mjs`, each small, with `node --test` files) [AN:345]. `pg:init` follows RP-1 to RP-6 [DB:§7.1]: `.data/` with mode 0700; **three** passwords into **three** files of mode 0600, created exclusively and never printed (`.data/pg.pwfile` for `dems_admin`, `.data/pg.owner.env` for `dems_owner`, `.data/pg.env` for `dems_app`; the two connection files hold five discrete fields); `initdb -U dems_admin -A scram-sha-256 --pwfile=<path> -E UTF8 --locale=C`; `listen_addresses = '127.0.0.1'`, port 4432, no Unix socket; default logging settings kept; start; as `dems_admin` create **both project roles**, `dems_owner` (not a superuser, `CREATEDB`) and `dems_app`; the checks HA-1 to HA-4 [DB:§7.6]; the trial T2 to T7 [AN:330-339] with the added steps T3-a, T3-b and T5-a to T5-i as `dems_owner` and **T5-j as `dems_admin`** (the superuser trigger check on a scratch table, section 7.3, [DEC:D19]); then the superuser connection is closed for good. The SHA-256 of the three binaries is recorded (SU-1) | coder-execution / R | E2 | W03, W06 | `scripts/pg/**`; `.data/**`; `.locks/postgres.pid`; `.locks/postgres.lock` | port 4432 | TD-02; HB-1; AS-01; DR-03; RP-1 to RP-6; HA-1 to HA-4; CR-1 to CR-7; PG-21 to PG-23, PG-26 to PG-28; AC-B-03 (4432); AC-B-64; AC-B-86 (scripts, manifests, key names); AC-B-91 (binaries); SR-01, SR-02, SR-60, SR-68 (roles), SR-77, SR-80; SD-01, SD-06 (PG-21), SD-15, SD-25; DA-06, DA-11, DA-12 | Trial T2 to T7 with T3-a, T3-b and T5-a to T5-j all PASS with quoted output (T5-h is recorded, not gating): the version string names 18.4; one listener on `127.0.0.1:4432`; `pg_hba.conf` holds only `scram-sha-256` lines for loopback and a wrong password is refused with `28P01`; as `dems_owner` create from `template0`, clone, rename inside a transaction and drop succeed, while `SET session_replication_role = replica` and `CREATE ROLE` fail with `42501`; a row survives stop and start; no process, launchd job or brew service after stop. `pg_roles` shows `dems_owner` with `rolcreatedb` only and `dems_app` with no flag. `git check-ignore -v` matches `.data/postgres` and the three credential files; `stat -f '%Lp'` prints 700 for `.data/` and 600 for the three files and the log. Step T5-j: as `dems_admin` with `session_replication_role = replica`, UPDATE, DELETE and TRUNCATE on the scratch table are refused with `ZA002` while its trigger is `ENABLE ALWAYS`, and the UPDATE succeeds in the default mode (PG-21); no superuser connection stays open afterwards. `npm run test:pg-scripts` exits 0 (T-HA-1, T-CR-1, T-CR-4 for the scripts' loader, the static check for a secret in a process argument or an npm script). **Rev 2.1:** `lsof -nP -iTCP:4432 -sTCP:LISTEN`, run immediately before the first start, is quoted and prints nothing | H-02, H-03 |
| W08 | 25, 49 | **Backend scaffold and health.** App factory with no listen; entry bound to the constant `127.0.0.1`; config loader for `.data/pg.env`, `DEMS_CORE_PORT`, `DEMS_DEMO_CONTROLS`; logger with header redaction and no body logging; error envelope with `details` and `requestId`; pool plugin; readiness; the decorators of P25; one stub per plugin and per module, statically imported; the health operation with `ready` [SP:§2, §7.4]. **Rev 2:** response headers through `@fastify/helmet` 13.1.1 and one `onSend` hook (OR-9, SA-13); the request log holds method, route pattern, status, duration, request ID and a principal reference, never the raw URL, and a parse failure is logged by its code only (SR-48, SR-49); the pipeline stages in the order of [SP:§2.3] (the credential is resolved at stage 4, the throttle and the denial budget run at stage 5); the loader reads `.data/pg.env` itself, stops on a file readable by group or others, and never opens the two other credential files; static tests that guard every later row (T-CR-2, T-AO-4, the server part of AC-B-86) | coder-execution / R | E2 | W03 | `apps/core-server/src/index.ts`; `apps/core-server/src/app.ts`; `apps/core-server/src/config.ts`; `apps/core-server/src/plugins/{config,logger,error-envelope,response-headers,db,readiness}/**`; `apps/core-server/test/static/**`; `apps/core-server/src/plugins/{origin-guard,throttle,authenticate,permission-guard}/index.ts`; `apps/core-server/src/{core,engine,realtime}/index.ts`; `apps/core-server/src/modules/{identity,rbac,admin,pairing,sessions,evidence,devices,storage,network-time,security-audit,system,alerts,demo}/index.ts`; `apps/core-server/src/modules/health/**` | none | TD-01; ADQ-5, ADQ-8; SA-01; SR-01, SR-03, SR-04, SR-48..50, SR-64; AC-B-08, AC-B-58, AC-B-61; SR-68 (loader, static test), SR-75 (stage order), SR-76, SR-77; AC-B-14 (headers, unit), AC-B-86 (server part); SD-05, SD-12, SD-14, SD-15; SA-13; SD-06, SR-52 (the static test T-AO-4) | `npm run test -w @dems/core-server -- --maxWorkers=2` exits 0 with these cases: health validates against `HealthResponseSchema` with `service: dems-core-server` and `version: 0.2.0`; with the pool pointed at a closed port the answer is 200 with `ready.database: false`; a refusal raised in `onRequest` wins over an invalid JSON body; every answer carries the five headers of OR-9 and no `Strict-Transport-Security`; a log capture of a request with `authorization`, `cookie`, a body, a `?token=<marker>` query and malformed JSON holding a marker shows none of those values and no query string; a credential file with mode 0644 stops the loader, which prints no content; the static tests find, under `apps/core-server/`, no name of the superuser's password file, no `PGPASSWORD`, no `--env-file`, no connection URL with a password and no `session_replication_role`. `git diff --stat acaff20 -- apps/mock-core release scripts/release` prints nothing | R-NEW |
| W09 | 32 (hash part) | **HB-4 password-hash wrapper** over `crypto.argon2`: derive, stored parameters, constant-time verify [AN:380-383]. Built before the seed, which needs it. **Rev 2:** the salt comes from `crypto.randomBytes(16)`; no pepper (SD-21) | coder-execution / R | E2 | W03 | `apps/core-server/src/modules/identity/password-hash/**` | none | TD-05; HB-4; AS-08; SR-05, SR-06; AC-B-30 (hash record and vector); SD-21 | `npm run test -w @dems/core-server -- --maxWorkers=2 src/modules/identity/password-hash` exits 0: the Argon2id test vector of RFC 9106 reproduces through `crypto.argon2` on Node 26.8.2 (general knowledge that the RFC carries one; not in the research); a round trip with 19,456 KiB, 2 passes, parallelism 1, a 16-byte salt and a 32-byte tag verifies; a wrong password is rejected | R-NEW |
| W10 | 28 (first step) | **Proof (c): `drizzle-kit` on PostgreSQL 18.4.** A scratch schema with one table of each difficult kind, generated and applied to a scratch database. **Rev 2:** run as `dems_owner` | database-specialist / R | E3 | W07 | `.cache/proof-drizzle/**` | pg | TD-03, TD-04; AS-02; DA-03; GD-06; PG-08; F23; SD-01, SR-68 (the proof runs as `dems_owner`) | In the scratch folder: `drizzle-kit generate --name=probe` and `generate --custom --name=probe_guard` write files whose names and order are quoted; `migrate()` applies them; the catalog shows the named CHECK, the partial unique index with its `WHERE`, the composite key, a `bytea` and a `jsonb` column as declared; a second `migrate()` applies nothing; `tsc --noEmit` passes; the scratch database is dropped | R-NEW |
| W11 | 28 (helper part) | **HB-12 template-clone test helper** and the `globalSetup` of the project `db`: run prefix, three templates, guarded names, serialised clones, cleanup, stale-database sweep [DB:§10]. Tested with an injected one-table migration. **Rev 2:** the helper, the templates and the clones use `dems_owner` (`.data/pg.owner.env`); the code under test uses `dems_app` (`.data/pg.env`); nothing in `test:db` connects as `dems_admin` [DB:TI-4 to TI-6, TI-9, TI-10, TI-17] | database-specialist / R | E3 | W07 | `apps/core-server/test/helpers/db/**`; `apps/core-server/test/global-setup.db.ts` | pg | TD-12; HB-12; TI-1 to TI-17; T-TI-1, T-TI-2; SR-68 (tests); SD-01 | `npm run test:db -w @dems/core-server -- test/helpers/db` exits 0: two files get two clones and see only their own row; no database with the run prefix remains; a request to drop `dems_demo` or a younger database of another run is refused before a statement is sent; the first measured clone time is recorded. The templates and clones are owned by `dems_owner` (`pg_database.datdba` quoted) | R-NEW |
| W12 | 58 (moved early) | **Proof (e): typed client HB-9 and the emulator proof.** The registry-driven client in `src/client/` [CS:CL-1 to CL-6a], written against the registry as it stands (it covers 75 operations when the registry does); a debug-only probe module and its one hook; the harness gains a socket route. **Rev 2:** the harness log records which `Origin` the app sends on `fetch` and on the socket upgrade (SA-03; input to the decision tables of [SP:§14.2] and to GS-23) | coder-execution / R | E3 | W03, W05, W06, DP-1 | `packages/shared/src/client/**`; `packages/shared/test/client-*.test.ts`; `apps/mobile/src/runtime/dev-probes.ts`; `apps/mobile/src/runtime/debug.ts`; `.cache/proof-harness/**` | lane1 (port 4421); device (one debug-build emulator) | TD-09; HB-9; AS-05; SA-03; CA-08; G-07; F18; AC-C-01..05; SD-02 (input) | On one debug-build emulator with `adb reverse tcp:4420 tcp:4421`, `adb logcat -d` shows four probe lines: GET `getServiceHealth` 200 zod-valid; POST `createSession` 201 zod-valid; POST `exportEvidence` 403 parsed as `ApiError`; a socket opened with an `Authorization` header and its close code as the device reports it. The harness log shows which `Origin`, if any, arrived on the REST calls and on the upgrade. `npm run test -w @dems/shared -- --maxWorkers=2` exits 0 with the `client-*` tests | R-NEW; R-PRE (`debug.ts`) |
| W13 | 77 | **npm slot N3, native rebuild, install.** Add `expo-secure-store` (no config plugin; `app.json` untouched); add `tcp:4420` to the `reverse` script; add the optional variable `DEMS_CORE_HOST_PORT` to `device-session.sh` ([CS:§9.6] proposes it as `CORE_SERVER_PORT`; the name is pinned in section 3.4, rev 2.1); copy the current debug APK to `.cache/apk-backup/`; prebuild; build the debug APK; `adb install -r` on the emulators DP-1 names, without wiping data. **Rev 2:** the `npm audit` output is recorded (SU-2) | coder-execution / R | E3 | W03, W06, DP-1 | `apps/mobile/package.json`; `package-lock.json`; `apps/mobile/scripts/device-session.sh`; `apps/mobile/android/**`; `.cache/apk-backup/**` | npm; gradle; device (each named emulator in turn) | TD-10; KI-21; PA-03; AC-C-84, AC-C-85; F22; SR-80; AC-B-91 | `npm run deps:check -w @dems/mobile` and `npm run doctor -w @dems/mobile` outputs are quoted with no new finding; on each named emulator `adb install -r` prints `Success` and the app opens in Simulated mode (screencap); with `DEMS_CORE_HOST_PORT=4421` `adb reverse --list` shows `tcp:4420` during a session and not after it; the merged release manifest has no cleartext attribute and `app.json` lists seven plugins; mobile typecheck, lint and tests exit 0 at or above 833 tests in 72 suites | H-06; R-PRE |
| W14 | 57 (web part) | **npm slot N2.** Add `qrcode.react` 4.2.0 to `@dems/core-web`; nothing else. **Rev 2:** the `npm audit` output is recorded (SU-2) | coder-execution / D | E4 | W13 | `apps/core-web/package.json`; `package-lock.json` | npm | TD-11 (pin); SR-80; AC-B-91 | `npm install` exits 0; the lockfile diff against the pre-image holds only `qrcode.react@4.2.0`; `npm ls react react-dom --all` shows one copy each; `npm run typecheck -w @dems/core-web` exits 0. The `npm audit` output is in the row log | R-PRE |
| W15 | 78, 79 (wrapper and probe) | **Proof (g): secure-store wrapper and the AVD probe.** The one module that imports `expo-secure-store` [CS:MP-1]; jest mocks for it and for `expo-device` [CS:TS-16]; a probe that writes, reads and deletes the probe item, unprotected and protected. **Rev 2:** the wrapper writes the unprotected biometric item only where `isDevice` is false or the build is a debug build (MB-6a; the DEPARTURE-6 conditions of [DEC:D16]) | coder-execution / R | E4 | W13, W12 | `apps/mobile/src/runtime/secure-credentials.ts`; `apps/mobile/src/runtime/secure-credentials.test.ts`; `apps/mobile/src/runtime/secure-store-import.test.ts`; `apps/mobile/jest.setup.ts`; `apps/mobile/src/runtime/dev-probes.ts` | device (each debug-build emulator in turn) | TD-10; MP-1, MP-4; MB-5, MB-6, MB-8; AS-06; CA-06, CA-07; SR-32; AC-C-66, AC-C-71; MB-6a; SD-18; AC-C-105 (wrapper) | The row log holds, for each debug-build AVD, the three observations of MB-8, the value of `isDevice` and the MB-5 case that follows, each with a screencap; the probe item is absent afterwards; `npm run test -w @dems/mobile -- --maxWorkers=2` exits 0 and the static test finds exactly one importer of `expo-secure-store` | R-NEW; R-PRE (`dev-probes.ts`); R-CO (`jest.setup.ts`) |

### 8.3 Backend, contract and shared client layer (waves B1 to B9)

| ID | Prov. | Title and scope | Agent / tier | Wave | Depends on | Owned write paths | Locks and ports | Implements | Verification | Rollback |
|---|---|---|---|---|---|---|---|---|---|---|
| W16 | 26 | **Shared vocabulary.** 3 permissions, 3 SUPERVISOR grants, 9 audit types with their existing categories, English labels [SP:§4.3, §13.1, §19.2]. Additive only. A test that pins a count is edited by design and named in the log (GP-06) | coder-execution / R | B1 | W01 | `packages/shared/src/sim/vocabulary.ts`; `packages/shared/src/sim/auth.ts`; `packages/shared/src/i18n/en/common.ts`; `packages/shared/test/{i18n-vocabulary-sync,auth,sim-contract}.test.ts` | contract | ADQ-9; AC-B-62; input to AC-B-17; MG-11 | `git diff acaff20 -- packages/shared/src/sim` shows additions only, in `vocabulary.ts` and `auth.ts` (12 permissions, 53 audit types, 18 grants: counts quoted), and typecheck plus tests of shared, core-web and mobile exit 0 at or above the ledger | R-CO |
| W17 | 28 | **Schema, migrations, database commands.** The typed schema (**30 tables**, `audit_chain_history` among them) and the four migration files in order (`0000_prelude`, `0001_tables`, `0002_audit_guards`, `0003_privileges`) [DB:§8.2], applied as `dems_owner`; the two audit triggers and the lineage trigger are `ENABLE ALWAYS`; `TOKEN_REUSE` is in the closed set of session end reasons; the runtime role's grant on `audit_chain_history` is **SELECT only** [DEC:D18]; `db:create` (it creates no role and stops with a message naming `pg:init` when a role is missing), `db:migrate`, `db:status`; catalog, guard, privilege and ownership tests; the statement-level concurrency tests T-AT-1 to T-AT-5 [DB:§5.6]; each PG-n of [DB:§1.9] marked confirmed or corrected | database-specialist / R | B1 | W10, W11 | `apps/core-server/drizzle.config.ts`; `apps/core-server/src/db/schema/**`; `apps/core-server/src/db/migrations/**`; `apps/core-server/src/db/commands/**`; `apps/core-server/test/db/**` | migration; pg | TD-03, TD-04; [DB:§2, §4, §5.6, §6.3, §7, §8]; AC-B-01; AC-B-54 (privilege, trigger, guard); AC-B-87 (table, trigger, grant); SR-52..54, SR-67, SR-68 (ownership), SR-72 (statements), SR-78 (table); SD-01, SD-04, SD-06, SD-10, SD-19; CL-01 to CL-20 | `npm run test:db -w @dems/core-server -- test/db` exits 0: migrate on an empty clone, then a second run that applies nothing; the catalog equals [DB:§4] (30 tables, 98 named CHECKs, 25 foreign keys, 5 functions, 3 triggers each with `tgenabled = 'A'`; the diff is quoted and empty); every object belongs to `dems_owner` (T-PV-2); UPDATE, DELETE and TRUNCATE on `audit_log` and on `audit_chain_history` are refused for `dems_app` (`42501`) and for `dems_owner` (`ZA002`), and INSERT on `audit_chain_history` is refused for `dems_app`; a row that does not continue the chain is refused; T-PV-1 equals the matrix of [DB:§7.3]; T-PV-3 stops the boot at B-4 and at B-5; T-AT-1 to T-AT-5 pass | R-NEW |
| W18 | 60 (light part) | **Light Live API and the settle helper (HB-15).** `useCoreActions`, `coreActionsOf`, `settle`, the two error classes, mode helpers and hooks [CS:CL-12, CL-21, CL-25]; no network code | coder-execution / R | B1 | W03 | `packages/shared/src/live/{index,settle,core-actions,errors,mode,hooks}.ts`; `packages/shared/test/live-light-*.test.ts` | none | ADQ-3; HB-15; TS-2, TS-3; AC-C-02, AC-C-06 (identity part), AC-C-09 | `npm run test -w @dems/shared -- --maxWorkers=2` exits 0 with the 508 baseline tests unchanged and the `live-light-*` tests: `useCoreActions()` returns `sim.actions` itself for a simulator; `settle` runs `ok` and `done` before it returns for a plain value, and `fail` and `done` for a synchronous throw | R-NEW |
| W19 | 27 (part A) | **Contract A.** The registry model (`access`, `audit`, `mode`, answering services), the envelope with 15 new codes, additive constants, the widened health schema, the one string rule of SPEC-GAP-1, the builder scope (offline 10, all), and the operations of areas 1, 2, 3 and 13 with their bodies [SP:§7.1-7.7, §7.16, §7.18]; [CS:AR-1]. **Rev 2:** the text rule API-13 (U+0000 and ill-formed UTF-16 refused) on every free-text schema | coder-execution / R | B2 | W16 | `packages/shared/src/api/**`; `packages/shared/openapi/**`; `packages/shared/scripts/gen-openapi.ts`; `packages/shared/test/{openapi,schemas,sim-api-validation}.test.ts`; `packages/shared/test/api-*.test.ts` | contract | TD-09; API-1 to API-12; AC-B-13; SR-64; GC-01; SPEC-GAP-1; API-13 (input to AC-B-93) | `npm run test -w @dems/shared -- --maxWorkers=2` and `node --import tsx packages/shared/scripts/gen-openapi.ts --check` exit 0: 37 operations (10 existing and 27 new), each with `access` and `audit`; the ten existing ones equal their baseline path, method and schemas; the offline scope yields ten, and `npm run test -w @dems/core-web -- --maxWorkers=2 src/test/scalar-config.test.ts` passes with that file unchanged | R-PRE |
| W20 | 29 | **Mapping module and seed.** The one slice-to-table mapping in both directions [DB:MR-1 to MR-9]; the seed program and `db:seed` [DB:§9]; the first build of `dems_demo` (create, migrate, seed). **Rev 2:** the commands and the seed run as `dems_owner`; `audit_chain_history` is empty after a first seed [DB:§9.4] | database-specialist / R | B2 | W16, W17, W09 | `apps/core-server/src/db/mapping/**`; `apps/core-server/src/db/seed/**` | pg; `db-migrate.lock` for `dems_demo` | HB-2; HB-13 (mapping half); ADQ-4; ST-1 to ST-6; AC-B-02, AC-B-17, AC-B-28 (seed dump), AC-B-65; SR-62, SR-63; DA-01, DA-02; SA-09; SD-01 | `npm run test:db -w @dems/core-server -- src/db/seed src/db/mapping` exits 0 (ST-1 to ST-6; `fromRows(toRows(state))` equals the durable slices), and `db:create`, `db:migrate`, `db:seed`, `db:status` for `dems_demo` exit 0 with the row counts of [DB:§9.4] quoted (82 audit rows and 59 events confirmed or corrected against the shared function) | R-NEW; H-15 |
| W21 | 31 | **Core services.** Audit writer on the append protocol, event writer, the transaction helper with the serial unit-of-work queue that the engine pipeline and the server-native modules share [SP:§8.2], the server clock [SP:§8.3, §8.4]; [DB:§6.4]. **Rev 2:** this queue is the serial pipeline in which every server-native state change is one unit of work (ENG-23 to ENG-27) | coder-execution / R | B2 | W17, W08 | `apps/core-server/src/core/**` | pg | AP-1 to AP-7; AC-B-54 (50 writers), AC-B-55 (clock); SR-52..54, SR-65; DA-07; SR-72 (queue); SD-04 | `npm run test:db -w @dems/core-server -- src/core` exits 0: 50 concurrent appends give a chain that `verifyAuditChain` accepts over all rows; a writer that skips the lock is refused with SQLSTATE `ZA001`; every `at` follows the injected clock | R-NEW |
| W22 | 27 (part B) | **Contract B.** The 28 slice schemas and the realtime message union [SP:§3.2, §9.4]; the existing heartbeat member stays. **Rev 2:** `TOKEN_REUSE` is a value of `session.ended.reason` (SD-10) | coder-execution / R | B3 | W19 | `packages/shared/src/api/**`; `packages/shared/openapi/**`; `packages/shared/scripts/gen-openapi.ts`; `packages/shared/test/{openapi,schemas,sim-api-validation}.test.ts`; `packages/shared/test/api-*.test.ts` | contract | API-6; RT messages; AC-B-46 (schema side); SD-10 | The shared tests and `gen-openapi.ts --check` exit 0: each of the 28 slice schemas accepts the matching slice of `createIdleState` at the fixed instant and of the recording scenario; the union accepts one example of every message of [SP:§9.4] and the existing heartbeat | R-PRE |
| W23 | 32, 33 (guards part) | **Request guards.** The Origin guard (HB-6) with **two lists**: the web console origins (`http://127.0.0.1` on 5173, 5176, 5177, 5178; no `localhost`; exact string match; `null` refused) and the instance's own origins (accepted only on a request without a cookie) [SP:§2.4, §14.2]. The throttle with `@fastify/rate-limit`, keyed by the resolved principal or by one of the classes `class:web` and `class:local`, never by a value the caller supplies. The **denial budget**: at most 20 audited refusals per key in 60 s, then 429 without a row, as one more limiter of `rate-limiter-flexible` (SA-14) | coder-execution / R | B3 | W08, W19 | `apps/core-server/src/plugins/origin-guard/**`; `apps/core-server/src/plugins/throttle/**` | none | HB-6; OR-1 to OR-4; ID-P12, ID-P13; SR-04, SR-19..21, SR-24, SR-69, SR-70, SR-71, SR-75; AC-B-14 (429, 413), AC-B-43 (REST, unit), AC-B-74 (POST, unit); SD-02, SD-03, SD-07, SD-12; SA-14 | `npm run test -w @dems/core-server -- --maxWorkers=2 src/plugins/origin-guard src/plugins/throttle` exits 0: every cell of the HTTP decision table of [SP:§14.2] gives the stated answer for the four credential rows (with an injected principal); `http://localhost:5173`, `null`, a trailing slash, an upper-case scheme and port 5174 each answer 403 `ORIGIN_NOT_ALLOWED`; no answer carries an `access-control-allow-` header; the 31st request of one class in 60 s answers 429 with `retry-after`; with the budget at 20 the 21st refusal of one key answers 429 and writes no row, and the test can reset or advance the counter (SA-14) | R-NEW |
| W24 | 32 | **Identity core.** The `authenticate` hook (HB-5) resolves **at most one** credential, before the throttle: a cookie resolves only a session without a device, a bearer only a session with one; two credentials in one request answer 401 with `CREDENTIAL_CONFLICT` (ID-12, ID-13). The session table access; the cookie `dems_session_<listen port>` with no `Max-Age`; lockout with `rate-limiter-flexible`, the attempt consumed before the verification; the Argon2id computation always runs, outside the pipeline; the sweeper; operations 2 to 6 [SP:§5, §7.5]. The device principal comes through the `deviceResolver` decorator (filled by W32) | coder-execution / R | B3 | W19, W20, W21, W09 | `apps/core-server/src/plugins/authenticate/**`; `apps/core-server/src/modules/identity/**` | pg | TD-06; HB-5; SR-05..18, SR-22, SR-23, SR-25, SR-61 (no signing key is introduced), SR-72, SR-73; AC-B-23..30, AC-B-80, AC-B-90; SD-04, SD-08, SD-09, SD-21, SD-24; SA-12; SD-02, SR-69 (the console rule ID-1 a at sign-in); SD-12, SR-75 (the credential is resolved before the throttle) | MODG, and `npm run test:db -w @dems/core-server -- src/modules/identity src/plugins/authenticate` shows: the cookie `dems_session_<port>` with exactly `HttpOnly; SameSite=Strict; Path=/` and no `Max-Age` or `Expires`; two instances on two ports with one cookie jar keep both sessions valid; byte-identical failure bodies for wrong password, unknown user and disabled user, with the Argon2id function invoked exactly once per attempt; 20 concurrent wrong-password sign-ins verify exactly five attempts and answer 423 to the other 15; lock at the fifth failure, release after 60 s on the manual clock; idle expiry at 15 minutes and absolute expiry at 8 hours; a dump and a log capture (with a `?token=<marker>` request and malformed JSON holding a marker) that hold none of the secrets or markers the test used | R-NEW |
| W25 | 30 | **Bulk fixture** at the minimums of [DB:§11], deterministic, test databases only. **DEFERRABLE (reduced)**, section 18. **Rev 2:** loaded as `dems_owner`; the minimums are those of revision 2 of [DB:§11] (30 tables) | database-specialist / R | B3 | W20 | `apps/core-server/src/db/fixtures/**` | pg | BF-1 to BF-6; TI-13; SR-62; SD-01, SR-68 (loaded as `dems_owner`) | `npm run test:db -w @dems/core-server -- src/db/fixtures` exits 0: the loader's printed counts meet every minimum; `verifyAuditChain` passes over all rows; `db:status` of `dems_demo` prints the same counts before and after | R-NEW |
| W26 | 37 | **Engine host (HB-13, host half).** The headless `Sim` with the command pipeline, the actor scope, write-through by reference inequality, rehydration, the restart fault, health snapshots every 60 s, no meter frames stored [SP:§8]. **Rev 2:** the actor scope is cleared in a `finally` (SR-79) | coder-execution / R | B3 | W04, W20, W21 | `apps/core-server/src/engine/**` | pg | ADQ-1, ADQ-4; HB-13; SR-55, SR-59, SR-65; AC-B-07, AC-B-52, AC-B-53, AC-B-55; GD-03; SR-79; SD-22 | `npm run test:db -w @dems/core-server -- src/engine` exits 0: with a fixed seed and a manual clock the audit-type sequence of the recording scenario equals the shared simulator's; after every command the engine's `auth` slice is signed out, also after a command that the action refuses by throwing; a 60 s recording writes zero meter-frame rows; a rehydrated engine equals the state before the stop; a session in RECORDING at the stop is in FAULT after rehydration | R-NEW |
| W27 | 27 (part C) | **Contract C.** The 47 operations of areas 4 to 11 [SP:§7.8-7.15]; the committed `openapi.json` in the scope "all": 75 operations, two security schemes, the server `http://127.0.0.1:4420`, version 0.2.0. **Rev 2:** `AuditChainStatus` gains `lineage` and `lineageTotal` [SP:§7.13, §7.18] | coder-execution / R | B4 | W22 | `packages/shared/src/api/**`; `packages/shared/openapi/**`; `packages/shared/scripts/gen-openapi.ts`; `packages/shared/test/{openapi,schemas,sim-api-validation}.test.ts`; `packages/shared/test/api-*.test.ts` | contract | AC-B-09 (registry side), AC-B-11; AC-C-01 (re-run at 75); SD-19 (schema) | The shared tests and `gen-openapi.ts --check` exit 0: exactly 75 operations (27 GET, 48 POST), each with `access` and `audit`; the document lists 75 operations and two security schemes; the typed client's callable operation count is 75 | R-PRE |
| W28 | 33 | **RBAC guard (HB-7), the matrix read and the pipeline integration.** The boot check, the per-request rule in `onRequest` (stage 6), the denial audit row counted against the denial budget, any-of; operation 10 [SP:§4]. This is the first row in which stages 3 to 6 of [SP:§2.3] exist together, so it carries their integration tests | coder-execution / R | B4 | W24, W23 | `apps/core-server/src/plugins/permission-guard/**`; `apps/core-server/src/modules/rbac/**` | pg | TD-07; HB-7; RB-1 to RB-10; SR-13, SR-43..46, SR-69, SR-71, SR-75; AC-B-12, AC-B-16 (unit form), AC-B-18, AC-B-43, AC-B-73 (HTTP table), AC-B-74, AC-B-75 (one operator), AC-B-84 (REST); SD-02, SD-03, SD-12 | MODG, and: an app with a route that lacks an access rule or an audit rule fails to boot; a denied call answers 403 and writes exactly one `ACCESS_DENIED` row naming actor, operation and permission; an allowed call writes none; the denial is decided before the body is read; every cell of the HTTP decision table of [SP:§14.2] gives the stated answer, among them `signIn` with the instance's own origin and no bearer answers 403 `DEVICE_NOT_PAIRED` and a POST with the cookie and the own origin answers 403; 100 denied calls of one operator within 10 s write exactly 20 rows while the other 80 answer 429, and after 60 s a denial is audited again; 31 requests with 31 different unknown bearer values share one bucket | R-NEW |
| W29 | 48 (routine part) | **Reset routine (HB-3) and `db:reset`.** Steps R-0 to R-9 with the failure table [DB:§8.5], every database step as `dems_owner`; the role check of R-0 (`RESET_ROLE_PRIVILEGED` for a superuser connection); eight kept tables, `audit_chain_history` among them, carried over unchanged; one lineage row appended for the discarded chain (LN-1 to LN-6); an ACTIVE pairing code is written `CANCELLED` with no audit row; the epoch continues. Creates the three lane databases | database-specialist / R | B4 | W20 | `apps/core-server/src/db/reset/**` | pg; `db-migrate.lock`; advisory key 442001 | HB-3; SA-08; DA-04, DA-08; SR-56, SR-58, SR-68 (reset role), SR-78; AC-B-57 (routine), AC-B-72 (role check), AC-B-87 (table level); SD-01, SD-19; T-RS-1 to T-RS-6 | `npm run test:db -w @dems/core-server -- src/db/reset` exits 0 (T-RS-1 to T-RS-6): after two resets `audit_chain_history` holds two rows and the first is byte-equal before and after the second; the sessions the routine opens are `dems_owner` only; a stubbed superuser answer stops the routine with `RESET_ROLE_PRIVILEGED` before R-1; and `db:reset` for `dems_lane_1`, `dems_lane_2`, `dems_lane_3` exits 0 with `db:status` printing the seed counts and the owner `dems_owner` | R-NEW; H-15 |
| W30 | 59 | **Live socket client** beside the heartbeat client: one socket, heartbeat view, close codes, reconnect, resync [CS:CL-7 to CL-11b] | coder-execution / R | B4 | W22, W12 | `packages/shared/src/realtime/live-socket-client.ts`; `packages/shared/src/realtime/index.ts`; `packages/shared/test/realtime-live-*.test.ts` | none | TD-08 (client); AC-C-02, AC-C-15, AC-C-16 | `npm run test -w @dems/shared -- --maxWorkers=2` exits 0: `heartbeat-client.test.ts` passes unchanged; new tests cover 4401, 4403, reconnect on 1001, 1013 and 4408 with the existing backoff constants, and at most one `resync` in 2 s on a revision gap | R-NEW; R-CO (`realtime/index.ts`) |
| W31 | 60 (testing part) | **Fake transport (HB-11)**, contract-checked in both directions, for Vitest and jest [CS:TS-10 to TS-15] | coder-execution / R | B4 | W22, W12 | `packages/shared/src/live/testing/**`; `packages/shared/test/live-testing-*.test.ts` | none | HB-11; AC-C-02, AC-C-17 | `npm run test -w @dems/shared -- --maxWorkers=2` exits 0: a scripted response that violates its schema fails with a named error; a request body that violates the operation's schema fails; the call log holds method, path, headers and body | R-NEW |
| W32 | 36 | **Pairing and the device registry (HB-10).** Operations 15 to 23; the device resolver; code and credential storage as [DB:§5]. **Rev 2:** a redeem is one unit of work with a consuming compare-and-set before the comparison (AT-C2, AT-C3); its refusals count against the denial budget; a retired credential falls into the class bucket; `getSignInStatus` needs no console identity [DEC:D18] | coder-execution / R | B5 | W28 | `apps/core-server/src/modules/pairing/**` | pg | HB-10; [SP:§6]; SR-26..31, SR-33..35; AC-B-29, AC-B-32..38, AC-B-41; SA-07; DA-05; SR-71 (retired credential), SR-72; AC-B-75 (retired credentials), AC-B-76, AC-B-77; SD-03, SD-04 | MODG, and: six digits valid 300 s with only a hash stored; a second redeem and an expired code answer the generic `INVALID_CODE`; lock after three failures, close after five; revoke makes the next call answer 403 `DEVICE_REVOKED`; two-phase rotation; a scan of audit rows, events and the log capture finds no code and no credential. Of 20 concurrent wrong redeems exactly three count and 17 answer 423; a second burst after the lock counts exactly two more and the code closes at five; two concurrent redeems of the right code give one 201 and one 401; 25 calls with five retired device credentials write at most 20 rows | R-NEW |
| W33 | 35 | **User and role administration.** Operations 11 to 14, the last-administrator rule, session end on disable, the change notification through `publish`. **Rev 2:** the check and the update of the last-administrator rule are one unit under a lock (AT-C5) | coder-execution / R | B5 | W28 | `apps/core-server/src/modules/admin/**` | pg | [SP:§7.6]; RB-8; SR-12, SR-47; AC-B-18, AC-B-20 (session and sign-in part), AC-B-21; SR-72; AC-B-79; SD-04 | MODG, and: the same session gets 403 before and 2xx after a role change with no new sign-in; a disabled user's next request answers 401, the next sign-in the generic 401, and `USER_DISABLED` is written; demoting or disabling the last enabled SUPERVISOR answers 409 `LAST_ADMIN` and changes nothing. Two concurrent demotions of the two remaining holders give one 200 and one 409 `LAST_ADMIN` | R-NEW |
| W34 | 39 | **Sessions module.** Operations 24 to 38 | coder-execution / R | B5 | W27, W28, W26 | `apps/core-server/src/modules/sessions/**` | pg | [SP:§7.8]; Q16; AC-B-49, AC-B-50 | MODG, and: two simultaneous creates give one 201 and one 409 `SESSION_ACTIVE`; a stop by another operator with a five-character reason names that operator in `RECORDING_STOPPED`; a shorter reason answers 422 `INVALID_REASON` | R-NEW |
| W35 | 40 | **Evidence module.** Operations 39 to 43 | coder-execution / R | B5 | W27, W28, W26 | `apps/core-server/src/modules/evidence/**` | pg | [SP:§7.9]; I11; SR-59, SR-66; AC-B-69, AC-B-70 | MODG, and: after verify, export, archive and an evidence tamper fault the tracks, track hashes, manifest hash and signature are unchanged; a denied export answers 403 `FORBIDDEN` with one `EXPORT_DENIED` row; every answer that lists audio has exactly AUDIO-01 and AUDIO-02 | R-NEW |
| W36 | 42 | **Devices module.** Operations 44 to 52 | coder-execution / R | B5 | W27, W28, W26 | `apps/core-server/src/modules/devices/**` | pg | [SP:§7.10] | MODG, and: `restartDevice` during a recording answers 409 `RECORDING_ACTIVE`; an unsupported command answers 409 `COMMAND_UNSUPPORTED` | R-NEW |
| W37 | 43, 44 (merged) | **Storage and network-time modules.** Operations 53 to 57 | coder-execution / R | B5 | W27, W28, W26 | `apps/core-server/src/modules/storage/**`; `apps/core-server/src/modules/network-time/**` | pg | [SP:§7.11, §7.12]; Q15 | MODG, and: `setStoragePolicy` is allowed for a holder of either permission and refused for a holder of neither; a policy change is present after an app restart with its `STORAGE_POLICY_CHANGED` row; time values follow the injected clock | R-NEW |
| W38 | 34 | **CHECKPOINT CP-B1.** Review of the backend foundation (W08, W17, W20, W21, W23, W24, W28): structure, duplication, dependency hygiene, error handling, reuse of the contract. A parallel audit | senior-code-reviewer / R | B5 | W28, W23 | (none) | none | I1; D12 (one folder and own tests per hand-built element) | The report lists findings with file:line and severity; each blocker names its owning row; the count of open blockers is stated and is zero before W58 | R-NONE |
| W39 | 45 | **Security-audit module.** Operations 58 to 63; cursor paging. **Rev 2:** `verifyAuditChain` returns the lineage (the newest 20 and `lineageTotal`) and verifies the stored chain incrementally (SR-78, SR-81) | coder-execution / R | B6 | W27, W28, W26, W25, W29 | `apps/core-server/src/modules/security-audit/**` | pg | [SP:§7.13]; API-9; CL-05; SR-78 (read), SR-81; AC-B-87 (operation 60), AC-B-88; SD-19, SD-27 | MODG, and: paging of `listAuditRows` over the bulk fixture (the seed, if W25 is reduced) returns every row once while rows are appended; an export without a reason answers 422 `INVALID_REASON`; `verifyAuditChain` returns `view` and `stored`. After two resets the operation returns both lineage rows, newest first; after one full verification a call that follows k appended rows reads exactly k audit rows (a query spy), and two concurrent calls run one verification | R-NEW |
| W40 | 46, 47 (merged) | **System and alerts modules.** Operations 64 to 70. **Rev 2:** `acknowledgeAlert` and `updateSettings` write no audit row and one log line each (SR-82) | coder-execution / R | B6 | W27, W28, W26 | `apps/core-server/src/modules/system/**`; `apps/core-server/src/modules/alerts/**` | pg | [SP:§7.14, §7.15]; I11; AC-B-71; SR-82; AC-B-89; SD-28 | MODG, and: `restartServices` and `startSoftwareUpdate` during a session answer 409 `SESSION_ACTIVE`; every raised alert has a `FAULT_RAISED` audit row. `acknowledgeAlert` and `updateSettings` each write no audit row and exactly one log line with the operator ID and the alert ID or the names of the changed keys, and none of their values | R-NEW |
| W41 | 32 (biometric part) | **Biometric token.** Operations 7 to 9: server-issued, single use, rotating, bound to device and operator [SP:§5.6]. **Rev 2:** the token is consumed by a compare-and-set (AT-C4); a reused token also ends the open BIOMETRIC sessions of that device and operator with `TOKEN_REUSE`; `reportBiometricFailure` names an operator only where an enrolment exists | coder-execution / R | B6 | W32 | `apps/core-server/src/modules/identity/biometric/**` | pg | Q11; SR-36, SR-37; AC-B-29 (biometric flow), AC-B-31; SR-72, SR-74; AC-B-78, AC-B-82 (session end), AC-B-83; SD-04, SD-10, SD-11 | MODG, and: a valid token signs in with `method: BIOMETRIC` and is replaced; the old token then answers 401, revokes the family and writes `AUTH_FAILED`; no request without a valid token creates a session; enrolment needs a password session bound to a device. Two concurrent uses of one token issue exactly one session; after a reuse the BIOMETRIC session ends with the reason `TOKEN_REUSE` and `session.ended` is published, while a password session of the same operator stays open; a failure report for an operator with no enrolment writes `AUTH_FAILED` with a null actor and the device ID | R-NEW |
| W42 | 38 | **Realtime channel (HB-8).** The `/ws` route, authentication at the upgrade, five topics, snapshot then deltas, the send policy, control events, close codes [SP:§9, §4.7]. **Rev 2:** the upgrade follows the socket decision table of [SP:§14.2]; anonymous sockets are capped at 6 of 16; upgrades count in the throttle; a `?token=` query authenticates nothing | coder-execution / R | B6 | W22, W23, W26, W32, W33 | `apps/core-server/src/realtime/**` | pg; ephemeral loopback ports | TD-08; HB-8; SR-38..42, SR-51; AC-B-19, AC-B-20 (socket), AC-B-42, AC-B-43 (upgrade), AC-B-46, AC-B-48; SR-69, SR-70, SR-74 (socket close), SR-75; AC-B-73 (socket table), AC-B-74 (upgrade), AC-B-84 (upgrades), AC-B-85; SD-02, SD-07, SD-12, SD-13 | `npm run test:db -w @dems/core-server -- src/realtime` exits 0: a socket with no credential gets `hello` and `heartbeat` only, and a `?token=<marker>` query authenticates nothing and leaves no marker in the log; every cell of the socket decision table gives the stated answer (a bearer with the instance's own origin is accepted; `localhost`, `null` and a foreign origin answer 403); with six anonymous sockets open a seventh is closed with 1013 while an operator's upgrade is accepted; after 30 anonymous upgrades in 60 s the next is refused with 429; a role change pushes `session.updated` within 1 s; a disabled user's socket closes with 4401 and a revoked device's with 4403 within 1 s; a stalled client loses meter frames but no state delta, or is closed with 4408; revisions are gap-free | R-NEW |
| W43 | 48 (module part) | **Demo-control module.** Operations 71 to 75 behind `DEMO_CONTROL` and the demo flag; faults; the reset through the routine of W29, for which the server reads `.data/pg.owner.env` only at R-0, only with the flag on, and drops the values at R-9 (HC-1 to HC-4) [SP:§12]; [DB:§7.1] | coder-execution / R | B6 | W27, W28, W26, W29 | `apps/core-server/src/modules/demo/**` | pg | Q14; SR-57..59, SR-68; AC-B-56, AC-B-57, AC-B-72; SD-01, SD-19 | MODG, and: with the flag off the five operations answer 403 `DEMO_DISABLED` for a SUPERVISOR and 403 `NOT_PERMITTED` with an audit row for the other roles, and the server starts and runs while `.data/pg.owner.env` is unreadable; with it on, the pool reports `current_user` `dems_app` and the reset connection `dems_owner` with `rolsuper` false; a fault is raised and cleared with its rows and alert; `AUDIT_TAMPER` breaks `view` and leaves `stored` intact; `resetDemo` returns the domain tables to the seed checksums, keeps sessions, devices, credentials, biometric tokens, settings, pairing codes, the two counters and the chain lineage, writes an ACTIVE code as `CANCELLED`, raises the epoch by exactly 1 and sends a snapshot to every operator socket | R-NEW |
| W44 | 60 (source part) | **Live source (HB-14).** The replica store, delta application with structural sharing, the 42 action bindings, own-command atomicity, error rebuilding, the `touchSession` throttle [CS:§2.3, §2.5]. **Rev 2:** a 429 keeps its status and `retry-after` in `LiveTransportError` (CL-21, LB-10); `session.ended` with `TOKEN_REUSE` is passed on to the clients | coder-execution / R | B6 | W12, W18, W27, W30, W31 | `packages/shared/src/live/source/**`; `packages/shared/test/live-source-*.test.ts` | none | ADQ-2; HB-14; CL-13 to CL-27; CA-04; AC-B-63 (spies); AC-C-02, AC-C-06..08, AC-C-10..15, AC-C-39, AC-C-54; SD-03 (client), SD-10 (client) | `npm run test -w @dems/shared -- --maxWorkers=2` exits 0: in Simulated mode the 508 baseline tests pass unchanged and spies count zero `fetch` calls and zero socket constructions; in Live mode, on the fake transport, a snapshot and the deltas of the recording scenario drive the selectors to the simulator's values; atomicity holds in both arrival orders; the settle time-out sends one `resync` and resolves | R-NEW |
| W45 | 50 | **CHECKPOINT CP-S1.** Security review of the access-control code (W23, W24, W28, W32, W33, W41, W42) against [SP:§15] and the findings of row 20, read-only. **Rev 2:** with the re-check list of [DB:§15.4] (HC-1 to HC-5, what binds which role, T-AO-4, T-CR-2) and GS-22. **Rev 2.1:** a `DEVICE_CREDENTIAL_ROTATED` row outside the server's own tests is reported as unexpected [SP:§6.3] | security-review / R | B7 | W32, W33, W41, W42 | (none) | none | SR-01..82 (met or not met, with file:line); SD-29 (operation 23) | Verdict PASS, CAUTION or FAIL; every security requirement SR-01 to SR-82 that the reviewed code implements is marked met or not met with file:line; each finding names its owning row; zero open FAIL before W58 | R-NONE |
| W46 | 61 | **CHECKPOINT CP-C1.** Review of the shared client layer (W12, W18, W30, W31, W44): platform neutrality, contract reuse, an untouched Simulated path | senior-code-reviewer / R | B7 | W44 | (none) | none | AC-B-62; AC-C-02 | Findings carry file:line and severity; `git diff acaff20 -- packages/shared/src/sim` shows only W16's additions; each blocker names its owning row | R-NONE |
| W47 | 51 | **TEST: role-by-endpoint matrix**, generated from the registry against [SP:§4.4, §7], on the bulk fixture (the seed, if W25 is reduced). The denial budget (20 per key per 60 s) is smaller than the denied cells of two roles (INVESTIGATOR 22, TECHNICIAN 31), so the test advances the manual clock by 60 s or resets the counter after at most 20 denied cells of one key [DEC:F25]. The credential-misuse callers of AC-B-81 are further cells of the same file | test-expert / R | B7 | W32, W33, W34, W35, W36, W37, W39, W40, W41, W42, W43, W25 | `apps/core-server/test/acceptance/rbac-matrix.test.ts` | pg | SC4; AC-B-15, AC-B-16, AC-B-81; SR-73; SD-03, SD-09 | `npm run test:db -w @dems/core-server -- test/acceptance/rbac-matrix.test.ts` exits 0: 75 operations for 5 caller kinds (375 cells), each equal to the specification; each denied operator cell asserts exactly one `ACCESS_DENIED` row (`EXPORT_DENIED` for operations 42, 61, 62); an allowed call wrote none; **no cell is answered 429**; the credential-misuse cells (a cookie with a bearer; a bearer with a web console origin; a device session's token as the cookie; a web session's token as a bearer) answer 401 with `CREDENTIAL_CONFLICT`, 403, 401 and 401 and resolve no principal | R-NEW |
| W48 | 53 | **TEST: pairing lifecycle**. **Rev 2:** an unpaired caller also succeeds on `getSignInStatus`; the reuse of a biometric token closes the socket of the BIOMETRIC session | test-expert / R | B7 | W32, W34, W41, W42 | `apps/core-server/test/acceptance/pairing-lifecycle.test.ts` | pg | SC5; AC-B-28, AC-B-32..39, AC-B-41; AC-B-82 (socket close) | The file passes under `test:db`: each lifecycle step asserts its audit type; a revoked device's REST call answers 403 and its socket closes with 4403; a device revoked while it records leaves the session in RECORDING and another operator stops it; a dump holds no code and no credential the test issued. Presenting a used biometric token again closes that session's socket with 4401 within 1 s | R-NEW |
| W49 | 54 | **TEST: two-client shared state and resync** | test-expert / R | B7 | W34, W42 | `apps/core-server/test/acceptance/shared-state.test.ts` | pg; ephemeral loopback ports | SC3; AC-B-44..47 | The file passes under `test:db`: client B equals client A after start, marker and stop; after a dropped socket B equals a fresh snapshot; every message validates against the union; a store at revision N shows the command's effect | R-NEW |
| W50 | 62 | **Web runtime and mode.** The mode resolver and switch, the Live start-up, the query bridge for `admin.changed`, the Live row of `core-endpoint.ts`, the refusal presenter, shared words [CS:§3, §4.2, §5.1]. **Rev 2:** the query bridge removes every `['core', ...]` entry on sign-out, on `session.ended` and on the loss of `USER_ADMIN` or `PAIRING_MANAGE` (PG-6a, RC-3); the refusal presenter words a 429 as a limit, not as an outage (LB-10); in Live mode the console is opened at `http://127.0.0.1:<port>`, and a page under `localhost` is refused with the cause named in the console record (WT-2a) | coder-execution / R | B7 | W44, W05 | `apps/core-web/src/main.tsx`; `apps/core-web/src/router.tsx`; `apps/core-web/src/routes/__root.tsx`; `apps/core-web/src/runtime/**`; `apps/core-web/src/lib/core-endpoint.ts`; `apps/core-web/src/lib/core-errors.ts`; `apps/core-web/src/lib/__tests__/live-*.test.tsx`; `apps/core-web/src/test/live-runtime-*.test.tsx`; `packages/shared/src/i18n/en/common.ts` | lane | ADQ-2, ADQ-6, ADQ-7; MD-1 to MD-6; AC-C-18..23, AC-C-25, AC-C-33..37, AC-C-40, AC-C-41, AC-C-46, AC-C-101; LB-10; AC-C-102, AC-C-106 (cache); SD-07, SD-20; SD-03, AC-C-110 (the presenter's wording of a 429) | `npm run test -w @dems/core-web -- --maxWorkers=2` exits 0 with `routes.test.tsx`, `core-endpoint.test.tsx` and `packaged-csp.test.ts` absent from `git diff --stat acaff20`; on a lane `curl -si http://127.0.0.1:517x/api/v1/health` answers 200 with `service: dems-core-server` and no `access-control-allow-` header, the socket through the dev server receives `hello` and `heartbeat`, and the console loads in both modes (two screenshots). A POST to sign-in sent through the dev server with a foreign `Origin`, and one with `http://localhost:5173`, each answer 403 `ORIGIN_NOT_ALLOWED`; a static test finds no `headers`, no `changeOrigin` and no rewrite hook in the proxy block; after a sign-out the query cache holds no `['core', ...]` entry | R-CO; R-NEW; R-PRE (`common.ts`) |
| W51 | 78 | **Mobile runtime.** `LIVE` as the third Core link source, the Live source and its adapters, the `pairing` member and its state at start, the refusal presenter, the banner rule, the `core=` debug parameter, the health call of Stack Check [CS:§7.2, MD-3, MD-7, MP-9, MP-10]. **Rev 2:** the mobile refusal presenter words a 429 as a limit (LB-10) | coder-execution / R | B7 | W44, W15 | `apps/mobile/src/runtime/{contract,core-link,sim-adapters,connection-banner,index,debug,core-errors}.ts`; `apps/mobile/src/runtime/sim-runtime-provider.tsx`; `apps/mobile/src/runtime/live-*.test.tsx`; `apps/mobile/src/features/home/use-health.ts`; `apps/mobile/src/i18n/en.mobile.ts` | lane1 or lane2; device | AC-C-28, AC-C-29, AC-C-32, AC-C-49, AC-C-59, AC-C-78, AC-C-79, AC-C-101; FC-6, FC-9; LB-10; SD-03 (client) | `npm run test -w @dems/mobile -- --maxWorkers=2` exits 0 with the existing runtime and provider tests unchanged and new tests for the three sources and the release fallback; on the lane's emulator, opened with `core=LIVE`, the Pair screen shows the chip `LIVE` and Stack Check shows the Core server's health (screencap) | R-CO; R-NEW; R-PRE (`debug.ts`) |
| W52 | 52 | **TEST: contract conformance**. **Rev 2:** the header set of OR-9 on every answer; the text rule API-13 | test-expert / R | B8 | W32, W33, W34, W35, W36, W37, W39, W40, W41, W42, W43 | `apps/core-server/test/acceptance/contract.test.ts` | pg | SC6; AC-B-09, AC-B-10, AC-B-14, AC-B-70; AC-B-93; SR-76 | The file passes under `test:db`: zero undocumented routes and zero unregistered operations (both lists quoted, empty); every response validates with `validateCoreApiResponse`; each of 401, 403, 404, 405, 409, 413, 422, 423 and 429 is produced once or more and parses as `ApiError`; no GET handler writes. Every answer the test produces carries the five headers of OR-9 and no `Strict-Transport-Security`; a body whose free text holds U+0000 or an unpaired surrogate answers 422 `INVALID_INPUT` on `addSessionNote`, `revokeDevice` and `redeemPairingCode` and writes no row | R-NEW |
| W53 | 55 | **TEST: restart and recovery** | test-expert / R | B8 | W26, W32, W33, W34, W37 | `apps/core-server/test/acceptance/restart.test.ts` | pg | SC2; AC-B-04..06; SR-17; DA-09 | The file passes under `test:db`: the per-table checksums of [DB:§9.6] are equal before and after a restart that follows a policy change, a sealed session, a role change and a paired device; a session in RECORDING, and one in FINALIZING, at the stop is in FAULT afterwards and `recoverSession` ends in an INCOMPLETE history entry with the four recovery audit rows | R-NEW |
| W54 | 63, 62 (routes part) | **Web shell, navigation, admin routes.** The mode indicator, the link notice, the role notice, the ADMINISTRATION group, the two route files with guards and page stubs, two i18n namespaces [CS:§3.2, §3.5, §6.3-6.5, §10.1]. **Rev 2:** a 429 shows the limit toast of LB-10, not the link notice | coder-execution / R | B8 | W50 | `apps/core-web/src/components/shell/**`; `apps/core-web/src/routes/_app/admin/**`; `apps/core-web/src/routeTree.gen.ts`; `apps/core-web/src/features/users-roles/index.tsx`; `apps/core-web/src/features/paired-devices/index.tsx`; `packages/shared/src/i18n/index.ts`; `packages/shared/src/i18n/en/{shell,users-roles,paired-devices}.ts`; `apps/core-web/src/test/live-shell-*.test.tsx` | lane | PG-1 to PG-5, PG-10; CA-03, CA-09; AC-C-24, AC-C-26, AC-C-45 (shell), AC-C-49..51, AC-C-59; LB-10; SD-03, AC-C-110 (no link notice and an unchanged indicator on a 429) | `npm run test -w @dems/core-web -- --maxWorkers=2` exits 0 with the existing shell tests absent from `git diff --stat acaff20`; new tests show the indicator at three widths in its three states, the ADMINISTRATION entries only in Live mode and only with their permission, and the leave of `/admin/users` on `session.updated` | R-CO; R-NEW |
| W55 | 64 | **Web Login.** Server sign-in, lockout, the selector, the Live trust line, no security-key button in Live mode, the disclosure without role chips [CS:§5.2-5.6]. **Rev 2:** the disclosure carries the plain sentence of WS-9 (condition C1), with no role chip; a 429 shows the limit toast with the seconds of `retry-after` and keeps the form filled (LB-10) [DEC:D18]; the live check records the browser and its version (GC-22) | coder-execution / R | B8 | W50, W24 | `apps/core-web/src/features/login/**`; `packages/shared/src/i18n/en/login.ts`; `apps/core-web/src/test/live-login-*.test.tsx` | lane | Q11, Q12, Q13; WS-7 to WS-10; SR-16, SR-63; AC-C-23, AC-C-25, AC-C-38..40, AC-C-42..45, AC-C-47; AC-C-104, AC-C-107, AC-C-110; SD-08, SD-17, SD-23, SD-24 | CLG items (a) to (c), and one live sign-in on a lane: `document.cookie` does not show `dems_session_<port>`, no web-storage value starts with `ses_`, `dems.auth` is not written (console output and screenshot); Live tests cover success, a wrong password, the 423 countdown and the absent `login-security-key`. A sign-in with a marker password leaves no marker in the web's error sink; a 429 shows the limit toast and neither the offline notice nor a changed mode indicator | R-CO; R-NEW |
| W56 | 79 | **Mobile sign-in.** Server sign-in on a paired device, server-driven idle, biometric enrolment and unlock with the case DP-2 fixed [CS:§9.2, §9.3]. **Rev 2:** the DEPARTURE-6 conditions (MB-6a): the unprotected item only where `isDevice` is false or the build is a debug build, no silent fallback, no text that claims hardware protection; `session.ended` with `TOKEN_REUSE` signs out, deletes the biometric token and its marker and keeps the device credential | coder-execution / R | B8 | W51, W41 | `apps/mobile/src/auth/**` | lane1 or lane2; device | Q11; MB-1 to MB-9; SR-16; AC-C-65, AC-C-67..71; MB-6a; AC-C-105, AC-C-108; SD-10, SD-18, SD-23 | `npm run test -w @dems/mobile -- --maxWorkers=2` exits 0 with the existing auth tests unchanged; Live tests cover password sign-in, lockout, enrolment only in a password session, biometric sign-in with rotation, a 401 that deletes the token, a failed OS check (operation 9) and a cancelled prompt (no call); AsyncStorage and the runtime log of the storage mocks hold no string starting with `dvc_`, `ses_` or `bio_`. With `isDevice` true in a build that is not a debug build a failing protected write turns biometric sign-in off and stores no token; `TOKEN_REUSE` leads to the Login screen with the Alert of [CS:§6.5]; the scan also finds no marker password and no marker pairing code | R-CO |
| W57 | 81 | **Mobile pairing flow** on the existing Pair screen: redeem, the credential written before the action settles, unpair, re-pairing after a reinstall [CS:§9.4]. **Rev 2:** the tests use a marker code and scan storage and logs for it (SD-23) | coder-execution / R | B8 | W51, W32 | `apps/mobile/src/features/pairing/**` | lane2; device (tablet) | Q8; DR-02; MP-5 to MP-8a; KI-01; AC-C-75..77, AC-C-80, AC-C-81; SD-23 | CLG items (a) to (c), and on the tablet AVD the app pairs with a code issued by the lane backend and both panes of the Pair screen show unclipped in portrait and landscape (screencaps); Live tests cover a correct code, a wrong code, a 423 countdown, cancel before `commitAt` (no request) and unpair while offline (refused). The marker code is in no storage and no log | R-CO |
| W58 | 56 | **GATE: backend.** The gate commands of section 11.2 for `@dems/core-server` and `@dems/shared`; then a smoke run as sole owner of 4420. **Rev 2:** the log of the whole acceptance run is scanned for secrets and markers; the file modes are checked | verifier / R | B9 | W38, W45, W47, W48, W49, W52, W53 | (none) | main; pg | SC2; AC-B-03, AC-B-08, AC-B-58, AC-B-66; SR-01, SR-03; AC-B-29 (the run log), AC-B-64 (modes) | The gate commands exit 0 with output quoted; the smoke steps each PASS with the status quoted (start by the documented command, health, sign-in, one protected call, one denied call with its audit row, the socket heartbeat); `lsof -nP -iTCP:4420 -sTCP:LISTEN` shows one listener on `127.0.0.1` and `lsof -nP -a -p <pid> -i` shows loopback sockets only; the process is stopped and the lock released. The server log of the acceptance run holds no secret, no marker and no query string; `stat -f '%Lp'` prints 700 for `.data/` and 600 for the three credential files and the logs | R-NONE |

### 8.4 Client rows (waves B9 to C4)

Settle-site IDs are those of [CS:§8]; the files that change per folder are those of [CS:§7.3, §7.4]. Every web page row depends on the backend gate W58, the shell W54 and the Login W55; every mobile screen row on W58, the Login W59 and the gate W60 [BP:684].

| ID | Prov. | Title and scope | Agent / tier | Wave | Depends on | Owned write paths | Locks and ports | Implements | Verification | Rollback |
|---|---|---|---|---|---|---|---|---|---|---|
| W59 | 80 | **Mobile Login** in LIVE mode: no pairing-code hint, no role chip, the trust line with the device ID [CS:§9.2]. **Rev 2:** the disclosure sentence of condition C1; a 429 shows the limit wording (LB-10) | coder-execution / R | B9 | W56 | `apps/mobile/src/features/login/**` | lane1 or lane2; device | Q12; SR-63; AC-C-72; AC-C-104, AC-C-110; SD-17 | CLG items (a) to (c), and one device sign-in on the lane's emulator in LIVE mode (screencap) that shows the three points of the title | R-CO |
| W60 | 82 | **Mobile pairing gate.** The `blocked` rule in the root stack, the boot route, the pending link, the return to the Pair screen on revocation [CS:MP-11, MP-12, §6.6] | coder-execution / R | B9 | W56, W57 | `apps/mobile/src/navigation/**`; `apps/mobile/src/app/_layout.tsx`; `apps/mobile/src/app/(app)/_layout.tsx` | lane1 or lane2; device | Q5; GC-02; AC-C-31, AC-C-50, AC-C-73, AC-C-74, AC-C-78, AC-C-79 | `npm run test -w @dems/mobile -- --maxWorkers=2` exits 0 with the existing guard tests unchanged; Live route tests cover unpaired (boot route `/pair`; `/login`, `/home`, `/dev-gallery` not reachable; `/stack-check` reachable), paired and revoked; one device check shows the gate and its release after pairing (two screencaps) | R-CO |
| W61 | 65 | **CHECKPOINT CP-W1.** Review of W50, W54, W55: mode isolation, credential handling in the browser, an unchanged packaged CSP | senior-code-reviewer / R | B9 | W54, W55 | (none) | none | AC-C-35, AC-C-38 | Findings carry file:line and severity; each blocker names its owning row; a `grep` shows no credential in a URL, a log call or web storage | R-NONE |
| W62 | 83 | **CHECKPOINT CP-M1.** Review of W15, W51, W56, W57, W59, W60: mode isolation, credential storage, hook naming under the React Compiler, release-build behaviour | senior-code-reviewer / R | C1 | W59, W60 | (none) | none | AC-C-28, AC-C-65, AC-C-66 | Findings carry file:line and severity; each blocker names its owning row; `git diff --stat acaff20` shows no write of a mobile row under `packages/shared`, `apps/core-web` or `apps/mock-core` | R-NONE |
| W63 | 66 | **Web Dashboard.** Site B-7 | coder-execution / R | C1 | W58, W54, W55 | `apps/core-web/src/features/dashboard/**`; `packages/shared/src/i18n/en/dashboard.ts`; `apps/core-web/src/test/live-dashboard-*.test.tsx` | lane | AC-C-48, AC-C-53, AC-C-101 | CLG | R-CO |
| W64 | 67 | **Web Start New Session.** Sites A3, A4, B-6, C-3, C-4, D-2, D-3; the in-flight marker of the resume effect [CS:FC-7] | coder-execution / R | C1 | W58, W54, W55 | `apps/core-web/src/features/session-new/**`; `packages/shared/src/i18n/en/session-new.ts`; `apps/core-web/src/test/live-session-new-*.test.tsx` | lane | AC-C-57, AC-C-58 | CLG, and the pending test with fake timers: with an answer delayed by 1 s two quick presses send one request, no spinner at 300 ms, the in-button spinner at 500 ms, and no element is added outside the pressed control | R-CO |
| W65 | 68 | **Web Session Monitor.** Sites A9, B-2, B-3, B-4, C-1, C-2; meters from the socket | coder-execution / R | C1 | W58, W54, W55 | `apps/core-web/src/features/session-monitor/**`; `packages/shared/src/i18n/en/session.ts`; `apps/core-web/src/test/live-session-monitor-*.test.tsx` | lane | I8; PA-09 | CLG, with the live check on a running recording: the meters move and a stop with a reason seals the session (screenshot) | R-CO |
| W66 | 84, 85 (merged) | **Mobile Home and More.** Display only: the Core chips read "Simulated" unless the source is LIVE [CS:MD-8, MD-9] | coder-execution / R | C1 | W58, W59, W60 | `apps/mobile/src/features/dashboard/**`; `apps/mobile/src/features/more/**` | lane1 or lane2; device | FC-1; AC-C-30, AC-C-48 | CLG, and jest shows both chips reading "Simulated" in SIMULATED and HEARTBEAT mode and "Live" only in LIVE mode | R-CO |
| W67 | 86 | **Mobile Start Session.** Sites S1-4, S2-2, S4-6, S5-6; the start-recording hand-off | coder-execution / R | C1 | W58, W59, W60 | `apps/mobile/src/features/session-new/**` | lane1 or lane2; device | CA-02; AC-C-50, AC-C-57, AC-C-58, AC-C-62 | CLG, and jest with the fake transport: in both arrival orders the monitor opens and no "session busy" toast shows; the pending test of W64 in its mobile form | R-CO |
| W68 | 87 | **Mobile Session Monitor.** Sites S2-1, S4-2; meters on the UI thread from the socket | coder-execution / R | C1 | W58, W59, W60 | `apps/mobile/src/features/session-live/**` | lane1 or lane2; device | I8 | CLG, with the device check on a running recording (screencap) | R-CO |
| W69 | 69 | **Web Evidence.** Sites A5, A6, B-1, C-5, D-1, D-6; the server's verdict is the record [CS:§14 point 7] | coder-execution / R | C2 | W58, W54, W55 | `apps/core-web/src/features/evidence/**`; `packages/shared/src/i18n/en/evidence.ts`; `apps/core-web/src/test/live-evidence-*.test.tsx` | lane | MS-2, MS-5; AC-C-61 | CLG, and the fake transport's log shows that verification called operation 41 and no demo operation | R-CO |
| W70 | 70 | **Web Devices.** Sites B-7, B-8, D-5; the "Paired devices" row of the drawer [CS:§7.3 note G6] | coder-execution / R | C2 | W58, W54, W55 | `apps/core-web/src/features/devices/**`; `packages/shared/src/i18n/en/devices.ts`; `apps/core-web/src/test/live-devices-*.test.tsx` | lane | GS-16 | CLG | R-CO |
| W71 | 71, 72 (merged) | **Web Storage and Network & Time.** Site B-9. Network & Time changes no production file: tests and the live check only. **Rev 2.1:** the storage folder holds `__tests__/storage-page.test.tsx`, which W01 repaired; this row does not edit that file and saves its pre-image by P23 before its first edit (section 4.3) | coder-execution / R | C2 | W58, W54, W55 | `apps/core-web/src/features/storage/**`; `apps/core-web/src/features/network-time/**`; `packages/shared/src/i18n/en/{storage,network-time}.ts`; `apps/core-web/src/test/live-storage-*.test.tsx` | lane | [CS:§17.4 Row 21 #3] | CLG for both folders. **Rev 2.1:** under (a) the one file `storage-page.test.tsx` may appear in `git diff --stat acaff20`, with W01's change only: it is compared with W01's state, not with `acaff20` (section 8.1); `git diff --stat acaff20 -- apps/core-web/src/features/network-time` lists test files only | R-CO; R-PRE (`storage-page.test.tsx`) |
| W72 | 88, 89, 91 (merged) | **Mobile Finalization, Summary, Sessions hub.** Sites S2-4, S4-4, S4-5. Finalization and the hub change no production file | coder-execution / R | C2 | W58, W59, W60 | `apps/mobile/src/features/{session-finalizing,session-summary,sessions}/**` | lane1 or lane2; device | [CS:§17.4 Row 21 #3] | CLG for the three folders, with one device check that follows a session from stop to the acknowledged summary (screencaps) | R-CO |
| W73 | 90 | **Mobile Recovery.** Sites S2-3, S4-8, S5-2 | coder-execution / R | C2 | W58, W59, W60 | `apps/mobile/src/features/session-recovery/**` | lane1 or lane2; device | E1 | CLG, with a Live test of recovery after a server-side fault | R-CO |
| W74 | 92 | **Mobile Evidence.** Sites S1-5, S1-6, S3-1, S5-1, S5-5 | coder-execution / R | C2 | W58, W59, W60 | `apps/mobile/src/features/evidence/**` | lane1 or lane2; device | AC-C-61, AC-C-63 | CLG, and jest shows the archive dialog's success toast only after the server's 2xx and the danger toast on a refusal | R-CO |
| W75 | 73 | **Web Security & Audit.** Sites A7, A9, B-5, C-6; twelve matrix rows from operation 10 in Live mode, nine in Simulated mode [CS:FC-3]. **Rev 2:** the chain panel shows the stored-chain line and, when `lineage` is not empty, the "Earlier chains" line [CS:§8.2 A9] | coder-execution / R | C3 | W58, W54, W55 | `apps/core-web/src/features/security-audit/**`; `packages/shared/src/i18n/en/security-audit.ts`; `apps/core-web/src/test/live-security-audit-*.test.tsx` | lane | TS-8; AC-C-60; AC-C-109; SD-19 (client) | CLG, and with 450 rows on the fake server the audit export file holds 450 rows, and in Live mode the chain panel lists one entry per discarded chain while the Simulated panel is as today | R-CO |
| W76 | 74 | **Web System and the Demo Control Panel.** Sites A8, A10, A11, B-10, C-7, D-4 | coder-execution / R | C3 | W58, W54, W55 | `apps/core-web/src/features/system/**`; `packages/shared/src/i18n/en/system.ts`; `apps/core-web/src/test/live-system-*.test.tsx` | lane (with `DEMS_DEMO_CONTROLS=1`) | Q14; E14; AC-C-52, AC-C-60 | CLG, and the panel is rendered in Live mode only with `DEMO_CONTROL` and `demoControls`; the log export file is built from all pages of operations 59 and 63 | R-CO |
| W77 | 75 | **Web Users & Roles** (new page) [CS:§10.2]. **Rev 2:** its queries are removed by the bridge of W50 on sign-out and on the loss of `USER_ADMIN` | coder-execution / R | C3 | W58, W54, W55, W33 | `apps/core-web/src/features/users-roles/**`; `packages/shared/src/i18n/en/users-roles.ts`; `apps/core-web/src/test/live-users-roles-*.test.tsx` | lane | Q9; E4; AC-C-86..91; SD-20 | The render tests of AC-C-86 to AC-C-91 pass on the fake transport (test IDs; a role change; 409 `LAST_ADMIN` inline; disable and enable; refetch on `admin.changed`; the five states); one live role change on a lane (screenshot) | R-NEW |
| W78 | 93 | **Mobile Devices.** Sites S2-8, S3-2, S5-4 | coder-execution / R | C3 | W58, W59, W60 | `apps/mobile/src/features/devices/**` | lane1 or lane2; device | AC-C-63 | CLG, and jest shows the device-command dialog's success toast only after the server's 2xx | R-CO |
| W79 | 94, 95 (merged) | **Mobile Storage and Network & Time.** Sites S2-6, S5-3. Network & Time changes no production file | coder-execution / R | C3 | W58, W59, W60 | `apps/mobile/src/features/{storage,network-time}/**` | lane1 or lane2; device | [CS:§17.4 Row 21 #3] | CLG for both folders | R-CO |
| W80 | 96 | **Mobile Operator Audit.** Sites S1-7, S4-3 | coder-execution / R | C3 | W58, W59, W60 | `apps/mobile/src/features/audit/**` | lane1 or lane2; device | [CS:§7.4] | CLG | R-CO |
| W81 | 76 | **Web Paired Devices** (new page): issue with the digits, the QR and the countdown; cancel; list; revoke with a reason [CS:§10.3]. **Rev 2:** the pairing code is dropped from memory on sign-out, on `session.ended` and on the loss of `PAIRING_MANAGE` (PG-6a) | coder-execution / R | C4 | W58, W54, W55, W32, W14 | `apps/core-web/src/features/paired-devices/**`; `packages/shared/src/i18n/en/paired-devices.ts`; `apps/core-web/src/test/live-paired-devices-*.test.tsx` | lane | Q8; TD-11; CA-10; AC-C-92..99; AC-C-106 (code memory), AC-C-107; SD-20, SD-23 | The render tests of AC-C-92 to AC-C-99 pass on the fake transport (the QR component receives exactly the answer's `qrPayload`; the code is in no web-storage value, URL or query-cache entry); one live issue and cancel on a lane (screenshot with the digits masked). After a sign-out the feature holds no code, and a second operator on the same page load sees no digit of the first; the issue of a code leaves no code in the web's error sink | R-NEW |
| W82 | 97 | **Mobile Settings.** Sites S2-7, S5-7; the third segment `LIVE`; the biometric switch; demo controls | coder-execution / R | C4 | W58, W59, W60 | `apps/mobile/src/features/settings/**` | lane1 or lane2 (with `DEMS_DEMO_CONTROLS=1`); device | GC-12; AC-C-31, AC-C-52, AC-C-68, AC-C-83 | CLG, and the existing release-gate test passes unchanged with `settings-core-link-LIVE` disabled in a release build; selecting LIVE shows the dialog, signs out and lands on `/pair` or `/login` | R-CO |

### 8.5 Closing rows (waves F1 to V6)

| ID | Prov. | Title and scope | Agent / tier | Wave | Depends on | Owned write paths | Locks and ports | Implements | Verification | Rollback |
|---|---|---|---|---|---|---|---|---|---|---|
| W83 | 98 | **Contract close-out and OpenAPI.** Apply every `CONTRACT-GAP-n`; correct the stale description of KI-18 in its eight places [AN:762]; regenerate | coder-execution / R | F1 | W63, W64, W65, W66, W67, W68, W69, W70, W71, W72, W73, W74, W75, W76, W77, W78, W79, W80, W81, W82 | `packages/shared/src/api/**`; `packages/shared/openapi/**`; `packages/shared/scripts/gen-openapi.ts`; `packages/shared/test/{openapi,schemas,sim-api-validation}.test.ts`; `packages/shared/test/api-*.test.ts` | contract; pg | SC6; KI-18; AC-B-11, AC-B-13 | A search for `CONTRACT-GAP-` under `apps/` and `packages/` finds nothing; `gen-openapi.ts --check`, the shared tests and `test/acceptance/contract.test.ts` exit 0; the document and the registry both count 75 operations; the stale sentence of KI-18 is gone from the eight places (diff quoted) | R-PRE |
| W84 | 99 | **Web API Reference** in both modes [CS:§11]. **Rev 2:** in Live mode Try-it of operations 2, 7, 8, 15, 18 and 23 is rejected before a request (AR-3a); no request body or answer is kept in web storage; the page's log holds method, path and status only (AR-9) | coder-execution / R | F2 | W83, W54 | `apps/core-web/src/features/api-reference/**`; `packages/shared/src/i18n/en/api-reference.ts`; `apps/core-web/src/test/live-api-reference-*.test.tsx` | lane | SC6; AR-1 to AR-8; AC-C-18, AC-C-100; AC-C-103, AC-C-107; SD-16, SD-23; GC-18 | The existing API Reference tests and `scalar-config.test.ts` pass unchanged (**Rev 2.1:** `apps/core-web/src/test/sim-fetch.test.ts` is one of them and is compared with W01's state, not with `acaff20`, section 8.1); new tests show ten operations in Simulated mode, 75 with the Core-server switch and a Try-it that is rejected without a request, 75 `LIVE` in Live mode, a URL outside `{page origin}/api/v1` rejected, and no second socket; one live Try-it of `getServiceHealth` answers `dems-core-server` (screenshot). Try-it of the six denied operations sends no request (the fake transport's log); after one GET and one POST no web-storage value holds a request body or an answer | R-CO |
| W85 | 100 | **THIRD_PARTY_NOTICES, append-only.** One new section: every package of section 3.1 that was installed (and any fallback package), with version and licence read from the package's own licence file, and the PostgreSQL License text with the note on the binaries' packaging licence [AN:259] | coder-execution / D | F2 | W14 | `THIRD_PARTY_NOTICES.md` | none | D9 DN-2; TD-02 M6; GP-05 | `git diff acaff20 -- THIRD_PARTY_NOTICES.md` shows additions only, and every direct dependency added since `acaff20` (the list from `git diff acaff20 -- '*package.json'`, quoted) has a line in the new section | R-CO |
| W86 | 101 | **README Live-mode run guide.** The exact commands to initialise (`pg:init`: three roles, three credential files), start and stop PostgreSQL; create, migrate, seed, reset; start the backend, the web console in Live mode, `adb reverse` and the mobile app in Live mode; switch modes; ports; remove the data; remove PostgreSQL completely (section 14); troubleshooting. **Rev 2:** in Live mode the console is opened at `http://127.0.0.1:<port>`, never at `localhost` [DEC:D18, F25]; the plain sentences that the seeded accounts use published demo credentials for synthetic accounts on a local demo and that Live mode is for loopback only (conditions C1 and C4 of SR-63). Each command is run once, the full removal excepted | coder-execution / R | F2 | W83, W84 | `README.md` | main; device (a lane emulator, never the reserved one) | SC11; AC-B-67, AC-B-92; SR-63; SD-07, SD-17; WT-2a | A command-to-output table shows one passing run of every new README command; `git diff acaff20 -- README.md` shows additions only; the Live section names `http://127.0.0.1` and not `localhost` as the console address and holds the two sentences of AC-B-92; it prints no credential value that is not already published in the file | R-CO |
| W87 | 102 | **TEST: completion and the test strategy and coverage report.** Add the tests no build row owns (the two static tests of AC-C-53; gaps the operation-to-test table shows); run every suite; write the report | test-expert / R | F3 | W83, W84 | `apps/core-web/src/test/live-static-*.test.ts`; `apps/mobile/src/lib/live-static-*.test.ts`; `apps/core-server/test/acceptance/gap-*.test.ts` | pg | SC7; TD-12; AC-B-68; AC-C-53, AC-C-56, AC-C-101 | Every workspace's run exits 0 at or above the ledger; the report holds the operation-to-test table (75 rows: success, denial where a permission exists, validation where a body exists), the site-to-test table for every site ID of [CS:§8] not marked "no change" or "not reachable", the AC-to-test table, and the backend line coverage from `@vitest/coverage-v8` | R-NEW |
| W88 | 103 | **Implementation report** (Tier 1): each row's status, files changed, deviations from this plan, closed and open gap IDs, host changes with their rollbacks | data-analyst / R | F4 | W85, W86, W87 | (none) | none | SC9 | Every work row appears with its log path and status; every deviation cites a D, DR or F ID or is listed for the controller; the file counts match `git diff --stat acaff20` | R-NONE |
| W89 | 104 | **GATE: root.** Section 11.2 in full, first with PostgreSQL stopped, then `test:db` with it started | verifier / R | F4 | W85, W86, W87, W46, W61, W62 | (none) | pg-exclusive; ports 4410 and 4411 (mock-core tests) | SC7; D9, D10; AC-B-58, AC-B-59; AC-C-101 | With `npm run pg:status` reporting no server: root `npm run typecheck`, `npm run lint` and `npm test` exit 0 and the five per-workspace runs with `-- --maxWorkers=2` are at or above the ledger; then with PostgreSQL started `npm run test:db` exits 0; each failure names its owning row | R-NONE |
| W90 | 105 | **Clean-state rebuild**, following `README.md` literally as the sole user of PostgreSQL and port 4420: stop, `pg:remove-data`, init, start, create, migrate, seed, start the backend, change state, restart, compare. **Rev 2:** the five SHA-256 values of SU-1 are recomputed; the host-authentication check and the file modes are run again; the Live section of the README is read against AC-B-92 | verifier / R | V1 | W89 | (none) | pg-exclusive; main | SC2, SC11; AC-B-01..03, AC-B-67; H-02 and H-03 proven; AC-B-64, AC-B-91, AC-B-92; SR-80; SD-15, SD-25 | Every README command exits 0 as written; `db:status` equals the seed counts recorded by W20; the per-table checksums before and after the restart are equal; `lsof` shows 4432 and 4420 on `127.0.0.1` only. The recomputed SHA-256 of the install script, of `pg-symlinks.json` and of the three binaries equal the values recorded by W03 and W07; `pg:status` reports HA-1 to HA-4 as passing; `stat` shows 700 and 600 | R-NONE |
| W91 | 113 | **Code review: `apps/core-server`** | senior-code-reviewer / R | V1 | W89 | (none) | none | I1; SR-67 | Findings carry file:line and severity; zero open blockers; every hand-built part without a recorded decision is listed | R-NONE |
| W92 | 114 | **Code review: `packages/shared` and `apps/core-web`** | senior-code-reviewer / R | V1 | W89 | (none) | none | AC-C-02 | Findings carry file:line and severity; zero open blockers; `npm ls react react-dom zustand --all` output quoted with one copy each | R-NONE |
| W93 | 115 | **Code review: `apps/mobile`** | senior-code-reviewer / R | V1 | W89 | (none) | none | AC-C-66 | Findings carry file:line and severity; zero open blockers; `git diff --stat acaff20` shows no mobile row wrote outside `apps/mobile` | R-NONE |
| W94 | 108 (now first) | **END TO END: SC5 pairing**, on the main instance, the web console on `127.0.0.1:5173` in Live mode and the reserved emulator (DP-3) | verifier / R | V2 | W90, DP-3 | (none) | main; device (reserved) | SC5; AC-B-40; AC-C-81, AC-C-82 | Five steps, each PASS with a capture and its audit row quoted: (1) the app in LIVE mode with no device credential shows only the Pair screen and Stack Check; (2) the portal issues a code (`PAIRING_CODE_ISSUED`); (3) the app redeems it and reaches Login (`PAIRING_SUCCESS`); (4) Paired Devices lists the device as PAIRED and, after sign-in, with its operator (`AUTH_SUCCESS` naming the device); (5) revoke in the portal returns the app to the Pair screen within 1 s and its next call is refused (`DEVICE_REVOKED`) | R-NONE |
| W95 | 106 | **END TO END: SC3 shared state**, same environment; the emulator pairs again first (a new device ID) | verifier / R | V2 | W94 | (none) | main; device (reserved) | SC3; AC-B-51; AC-C-37, AC-C-64 | A session started on the web console appears on the emulator within 2 s and a stop on the emulator appears on the web console, then the reverse; each step PASS with a screenshot, a screencap and the matching `SESSION_CREATED`, `RECORDING_STARTED` and `RECORDING_STOPPED` rows; the browser's network log shows requests to the page origin only | R-NONE |
| W96 | 107 | **END TO END: SC4 role change**, same environment; a SUPERVISOR in one browser profile, the affected operator in a second profile and on the emulator | verifier / R | V2 | W95 | (none) | main; device (reserved) | SC4; AC-B-22; AC-C-55 | After the role change in Users & Roles the affected operator's control changes on the web console and on the emulator within 1 s without a new sign-in (before and after captures); a now-denied call is refused with 403 and its `ACCESS_DENIED` row; the `ROLE_CHANGED` row is quoted; the role is changed back | R-NONE |
| W97 | 109 | **REGRESSION: SC8.** The 61 simulator-dependent test files; `release/` byte-identical; the macOS launcher self-test; mock-core; the simulator diff; a Simulated-mode walk on the web and on one emulator, and HEARTBEAT mode with mock-core | verifier / R | V2 | W90 | (none) | lane3; device (a lane emulator); ports 4400 and 4410 | SC8; AC-B-59..63; AC-C-27, AC-C-35, AC-C-101; KI-07 | All PASS with output quoted: (1) the 61 files pass and `git diff --stat acaff20` over them lists only the two files of W01 and recorded by-design changes; (2) `shasum -a 256 -c` over `release/web/SHA256SUMS.txt`, `release/android/SHA256SUMS.txt` and every `*.sha256` reports OK for every file; (3) the macOS arm64 launcher, unpacked outside the workspace, prints `"ok": true` for `--self-test`; (4) the 19 mock-core tests pass and `git diff --stat acaff20 -- apps/mock-core scripts/release` is empty; (5) `git diff acaff20 -- packages/shared/src/sim` shows additions only in `vocabulary.ts` and `auth.ts`; (6) with the lane-3 backend running, the Simulated walk on web lane 5178 and on the emulator, and HEARTBEAT mode, leave no request line in its log | R-NONE |
| W98 | 110 | **Performance of the realtime path** (I8). **DEFERRABLE (reduced)**, section 18 | verifier / R | V3 | W96 | (none) | main; device (reserved) | I8; SA-06; CA-01; GD-03; GS-11 | Each measure is recorded with its method and compared with the Simulated-mode value on the same host: web frame rate and long tasks on Session Monitor, mobile frame statistics, backend CPU with three clients, database write rate during a recording (zero meter-frame rows), one list pass on the bulk fixture | R-NONE |
| W99 | 111 | **Security review: backend, database, secrets, host changes**, read-only (Tier 1). **Rev 2:** with the re-check list of [DB:§15.4] (HC-1 to HC-5, what binds which role, GD-13, GD-14, T-AO-4, T-CR-2). **Rev 2.1:** a `DEVICE_CREDENTIAL_ROTATED` row outside the server's own tests is reported as unexpected [SP:§6.3] | security-review / R | V3 | W96 | (none) | lane3 (if a running server is needed) | SC10; SR-01..82; AC-B-66; SD-29 (operation 23) | Verdict PASS, CAUTION or FAIL; every item has command output or file:line evidence; `npm audit` high and critical counts quoted; the PostgreSQL install is limited to the logged steps and each has its rollback; each CAUTION or FAIL names a remediation row | R-NONE |
| W100 | 112 | **Security review: the two clients**, read-only (Tier 1). **Rev 2:** with the DEPARTURE-6 conditions and the Try-it deny list | security-review / R | V3 | W96, W97 | (none) | device (read-only log check) | SC10; AC-C-65; SR-16, SR-32; AC-C-103, AC-C-105 | Verdict PASS, CAUTION or FAIL; every item has command output or file:line evidence; a device log check after pairing, sign-in and enrolment finds no string starting with `dvc_`, `ses_` or `bio_`; the release manifest is unchanged | R-NONE |
| W101 | 116 | **Final verification of SC1 to SC11** | verifier / R | V4 | W90, W91, W92, W93, W94, W95, W96, W97, W98, W99, W100 | (none) | none | SC1..SC11 | Each of SC1 to SC11 is marked PASS, FAIL or CAUTION with a pointer to quoted evidence (SC1: the commit time of row 22 against the log of W01); both security verdicts are PASS or an acknowledged CAUTION; zero open blocker findings | R-NONE |
| W102 | 117 | **Report inputs** (Tier 1): every D, DR and F cross-checked against the row logs; the SC outcome; open items; the host state left behind with its removal commands | data-analyst / R | V5 | W101 | (none) | none | SC9 | Every D-n, DR-n and F-n of `decisions/decisions.md` appears; every decision or drift a row log reports is in that file or listed as missing; the host-state list matches section 14 and the log of W90 | R-NONE |
| W103 | 118 | **Final local commit**, staged by explicit path; never `release/`, `.data/`, `.cache/`, `.locks/`, env files, any credential file, `apps/mobile/signing/` or the design book; no remote, no push | git-specialist / D | V6 | W102, W105 | (none) | git index | SC10; D1 | `git log -1 --stat` is quoted; `git remote -v` is empty; `git status --porcelain --ignored` shows the excluded paths as ignored, not staged; a search of the commit for the contents of the three credential files under `.data/` finds nothing | `git reset --soft HEAD~1` (local only) |

### 8.5a Checkpoint commits (added in revision 2, [DEC:D17])

Two local commits besides the docs commit of row 22 and the final commit W103, so that a session break cannot cost more than one phase. They take the first two of the reserved numbers.

| ID | Prov. | Title and scope | Agent / tier | Wave | Depends on | Owned write paths | Locks and ports | Implements | Verification | Rollback |
|---|---|---|---|---|---|---|---|---|---|---|
| W104 | new (D17) | **CHECKPOINT COMMIT 1: after the backend gate.** A local commit of the owned write paths (section 8) of every row that the controller's tracker shows as complete, and of the task folder under `docs/` as it stands. Staged by explicit path. A path that a row still in flight writes, or a path of section 4.3 whose later writer has not finished, is left out and named in the row log. Never staged: `release/`, `.data/`, `.cache/`, `.locks/`, `apps/mobile/signing/`, the design book, any env or credential file. No remote, no push | git-specialist / D | B9 | W58 | (none) | git index | D17; SC10 | `git log -1 --stat` is quoted; `git remote -v` prints nothing; `git status --porcelain` lists only the paths the row named as left out; `git ls-files release .data apps/mobile/signing` prints nothing | `git reset --soft HEAD~1` (local only) |
| W105 | new (D17) | **CHECKPOINT COMMIT 2: after the web client wave** (the web runtime, shell, Login, the nine page rows and the two new pages). Same rules as W104; the mobile rows that are still in flight are left out and named | git-specialist / D | C4 | W104, W54, W55, W63, W64, W65, W69, W70, W71, W75, W76, W77, W81 | (none) | git index | D17; SC10 | As W104 | `git reset --soft HEAD~1` (local only) |

### 8.6 Conditional fallback rows

Scheduled by the controller only after the proof of section 6 has failed and the drift is recorded. Each takes one extra npm slot where a package changes.

| ID | Triggered by | What it does | Owner / tier | Write paths | Changes to later rows | Verification | Rollback |
|---|---|---|---|---|---|---|---|
| Fb | W03 (T1) or W07 (any of T2 to T7) fails | Removes the npm binaries (H-01), installs the Homebrew keg `postgresql@18` 18.6 with the commands of [AN:315-324], points `scripts/pg/` at its `PGBIN`, repeats T2 to T7 | coder-execution / R | `package.json`; `package-lock.json`; `scripts/pg/**`; `.data/**`; host paths under `/opt/homebrew` | None in the database rows (same major version, [DEC:DR-01]). The Host Impact Register gains H-12; the README names the keg; the user is told [DEC:D11] | T2 to T7 PASS with the keg's binaries; `brew services list` shows no started `postgresql@18` | H-12 |
| Fc | W10 fails | Step 1 (inside W17, no row): the constraint that cannot be generated goes into the hand-written file `0002a_extra_constraints` [DB:§8.2]. Step 2 (only if the tools do not run at all): replace them by `kysely` 0.29.6 and `node-pg-migrate` 9.0.0 and repeat the proof | database-specialist / R | Step 2: `apps/core-server/package.json`; `package-lock.json`; `.cache/proof-drizzle/**` | Step 2 changes W17, W20, W21, W29 and the data access of every module row; the contract's names and definitions do not change [DB:DA-03] | As W10, with the replacement tools | R-PRE |
| Fd | W04 fails on d1, d2 or d5 | Proves ADQ-1 option (C): the pure transition functions with a server-owned loop [AN:522] | coder-execution / R | `.cache/proof-engine/**` | W26 grows (its own action layer and tick loop); operations and tables do not change. A failure of d3 or d4 alone needs no row: W26 writes its own restart transition, or `AUDIT_TAMPER` answers `COMMAND_UNSUPPORTED` in Live mode [SP:SA-05, SA-10], each as recorded drift | As W04 for the loop variant | R-NEW |
| Fe | W12 fails on the REST points | Replaces the hand-built client by the generator `@hey-api/openapi-ts` 0.99.0 [AN:439] and repeats the emulator proof | coder-execution / R | `packages/shared/package.json`; `package-lock.json`; `packages/shared/src/client/**` | W19, W22, W27 and W83 gain a regeneration step and a drift test in the contract slot; HB-9 is dropped from the hand-built list | As W12 | R-PRE |
| Ff | W05 fails | ADQ-6 option (B): the web calls the Core origin with credentials; `@fastify/cors` 11.3.0 joins the new workspace [AN:598] | coder-execution / R | `apps/core-server/package.json`; `package-lock.json`; `apps/core-web/vite.config.ts` | W23 registers CORS for the web console origins; W50 uses the Core origin; OR-5, SR-04, AC-B-43, AC-C-33 and AC-C-102 change. **It returns to a security review before it is built** [SP:OR-5]; [DEC:D16] | A credentialed cross-origin POST and a socket upgrade from 5176 to 4421 carry the cookie; a foreign origin is refused | R-PRE |
| Fh | W09 fails | Replaces the built-in by `@node-rs/argon2` 2.2.1 [AN:382] | coder-execution / R | `apps/core-server/package.json`; `package-lock.json`; `apps/core-server/src/modules/identity/password-hash/**` | None beyond W09 | As W09 | R-PRE |

### 8.7 Output document of each row (added in revision 2.1, [CC:C-08]; [DEC:D21])

Every row writes exactly one output document: its log or its report. The paths are relative to the task folder `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/`. The 105 paths are distinct [cmd], so two rows cannot write the same file. They are the "Expected Output" column of the blueprint in its revision 2 (`identification/02_structured.md`, steps 23 to 127, read at 06:10 while row 21 was writing it [cmd]); if row 21 changes a name there, the blueprint's name is used and this table follows it. For the 24 rows whose "Owned write paths" cell says "(none)" (W38, W45, W46, W58, W61, W62, W88 to W105) this document is the whole deliverable. Beside it a row writes only its progress file under `delegation_progress/` (CLAUDE.md §3, rule 4).

| Row | Output document |
|---|---|
| W01 | `implementation/01_baseline_test_fix.md` |
| W02 | `initialization/05_emulator_cold_boot.md` |
| W03 | `implementation/03_npm_slot_n1_server_shared.md` |
| W04 | `implementation/04_proof_headless_engine.md` |
| W05 | `implementation/05_proof_vite_proxy.md` |
| W06 | `initialization/01_env_check.md` |
| W07 | `initialization/04_postgres_provisioning.md` |
| W08 | `implementation/08_backend_scaffold_health.md` |
| W09 | `implementation/09_password_hash_wrapper.md` |
| W10 | `implementation/10_proof_drizzle_kit.md` |
| W11 | `implementation/11_db_test_helper.md` |
| W12 | `implementation/12_typed_client_emulator_proof.md` |
| W13 | `implementation/13_npm_slot_n3_mobile_native.md` |
| W14 | `implementation/14_npm_slot_n2_web.md` |
| W15 | `implementation/15_secure_store_wrapper_probe.md` |
| W16 | `implementation/16_shared_vocabulary.md` |
| W17 | `implementation/17_db_schema_migrations.md` |
| W18 | `implementation/18_live_light_api_settle.md` |
| W19 | `implementation/19_contract_a.md` |
| W20 | `implementation/20_db_mapping_seed.md` |
| W21 | `implementation/21_core_services.md` |
| W22 | `implementation/22_contract_b.md` |
| W23 | `implementation/23_request_guards.md` |
| W24 | `implementation/24_identity_core.md` |
| W25 | `implementation/25_db_bulk_fixture.md` |
| W26 | `implementation/26_engine_host.md` |
| W27 | `implementation/27_contract_c.md` |
| W28 | `implementation/28_rbac_guard_pipeline.md` |
| W29 | `implementation/29_db_reset_routine.md` |
| W30 | `implementation/30_live_socket_client.md` |
| W31 | `implementation/31_fake_transport.md` |
| W32 | `implementation/32_pairing_device_registry.md` |
| W33 | `implementation/33_user_role_admin.md` |
| W34 | `implementation/34_module_sessions.md` |
| W35 | `implementation/35_module_evidence.md` |
| W36 | `implementation/36_module_devices.md` |
| W37 | `implementation/37_modules_storage_network_time.md` |
| W38 | `gateway_check/04_cp_backend_foundation.md` |
| W39 | `implementation/39_module_security_audit.md` |
| W40 | `implementation/40_modules_system_alerts.md` |
| W41 | `implementation/41_biometric_token.md` |
| W42 | `implementation/42_realtime_channel.md` |
| W43 | `implementation/43_module_demo_controls.md` |
| W44 | `implementation/44_live_source.md` |
| W45 | `gateway_check/05_cp_access_control_security.md` |
| W46 | `gateway_check/07_cp_shared_client.md` |
| W47 | `test/02_rbac_matrix.md` |
| W48 | `test/04_pairing_lifecycle.md` |
| W49 | `test/05_shared_state_realtime.md` |
| W50 | `implementation/50_web_runtime_mode.md` |
| W51 | `implementation/51_mobile_runtime.md` |
| W52 | `test/03_contract_conformance.md` |
| W53 | `test/06_restart_recovery.md` |
| W54 | `implementation/54_web_shell_admin_routes.md` |
| W55 | `implementation/55_web_login.md` |
| W56 | `implementation/56_mobile_sign_in.md` |
| W57 | `implementation/57_mobile_pairing_flow.md` |
| W58 | `gateway_check/06_backend_gate.md` |
| W59 | `implementation/59_mobile_login.md` |
| W60 | `implementation/60_mobile_pairing_gate.md` |
| W61 | `gateway_check/08_cp_web_runtime.md` |
| W62 | `gateway_check/09_cp_mobile_runtime.md` |
| W63 | `implementation/63_web_dashboard.md` |
| W64 | `implementation/64_web_session_new.md` |
| W65 | `implementation/65_web_session_monitor.md` |
| W66 | `implementation/66_mobile_home_more.md` |
| W67 | `implementation/67_mobile_session_new.md` |
| W68 | `implementation/68_mobile_session_live.md` |
| W69 | `implementation/69_web_evidence.md` |
| W70 | `implementation/70_web_devices.md` |
| W71 | `implementation/71_web_storage_network_time.md` |
| W72 | `implementation/72_mobile_finalizing_summary_sessions.md` |
| W73 | `implementation/73_mobile_session_recovery.md` |
| W74 | `implementation/74_mobile_evidence.md` |
| W75 | `implementation/75_web_security_audit.md` |
| W76 | `implementation/76_web_system_demo_panel.md` |
| W77 | `implementation/77_web_users_roles.md` |
| W78 | `implementation/78_mobile_devices.md` |
| W79 | `implementation/79_mobile_storage_network_time.md` |
| W80 | `implementation/80_mobile_audit.md` |
| W81 | `implementation/81_web_paired_devices.md` |
| W82 | `implementation/82_mobile_settings.md` |
| W83 | `implementation/83_contract_close_out_openapi.md` |
| W84 | `implementation/84_web_api_reference.md` |
| W85 | `implementation/85_third_party_notices.md` |
| W86 | `implementation/86_readme_live_mode.md` |
| W87 | `test/01_test_report.md` |
| W88 | `implementation/99_implementation_report.md` |
| W89 | `gateway_check/10_root_gate.md` |
| W90 | `verification/03_clean_state_rebuild.md` |
| W91 | `verification/10_code_review_backend.md` |
| W92 | `verification/11_code_review_shared_web.md` |
| W93 | `verification/12_code_review_mobile.md` |
| W94 | `verification/06_e2e_pairing.md` |
| W95 | `verification/04_e2e_shared_state.md` |
| W96 | `verification/05_e2e_rbac.md` |
| W97 | `verification/07_regression_simulated_release.md` |
| W98 | `verification/08_performance_realtime.md` |
| W99 | `verification/02_security.md` |
| W100 | `verification/09_security_clients.md` |
| W101 | `verification/01_verification.md` |
| W102 | `report/01_report_inputs.md` |
| W103 | `report/02_git_final_commit.md` |
| W104 | `implementation/97_checkpoint_commit_1_backend.md` |
| W105 | `implementation/98_checkpoint_commit_2_web.md` |

A fallback row of section 8.6 has no reserved name. If the controller schedules one, its output document is `implementation/<next free number>_fallback_<id>.md`; this is a proposal of this plan, not a recorded decision.

---

## 9. Waves within D6

Limits: at most 6 agents of one type and 8 in flight [DEC:D6]. A wave is the earliest point at which its rows can start; the controller starts a row when its dependencies are done and a slot is free, and enforces the two limits over everything in flight. The "agents" column is the estimated agent count of the wave: one delegation per row; rework after a failed verification is not counted.

| Wave | Rows | Agents by type | In flight (max) | Serial resources and notes |
|---|---|---|--:|---|
| M4, S0 | Row 20, then rows 20a and 20b (done), this revision, row 19, row 21, row 22 | as the blueprint [BP:491-493] | 2 | The gate G-SEC is met [DEC:D16, D18] |
| E1 | W01, W02, W03, W04, W05 | coder-execution ×5 | 5 | npm (W03); lane 1 with ports 4421 and 5176 (W05); three device locks (W02). A test run of W01 that falls into the install window of W03 is repeated (P11) |
| E2 | W06, then W07; W08, W09 | verifier ×1, coder-execution ×3 | 4 | Port 4432 (W07). **W07 starts after W06** (rev 2.1): the port report comes first. DP-1 is decided after W06 |
| E3 | W10, W11, W12, W13 | database-specialist ×2, coder-execution ×2 | 4 | npm and Gradle (W13); lane 1 port 4421 (W12); W12 and W13 queue on the device locks |
| E4 | W14, W15 | coder-execution ×2 | 2 | npm (W14). DP-2 is decided after W15 |
| B1 | W16, W17, W18 | coder-execution ×2, database-specialist ×1 | 3 | Contract slot (W16); migration writer (W17). B1 may overlap E3 and E4 (7 in flight at most) |
| B2 | W19, W20, W21 | coder-execution ×2, database-specialist ×1 | 3 | Contract slot (W19); first build of `dems_demo` (W20) |
| B3 | W22, W23, W24, W25, W26 | coder-execution ×4, database-specialist ×1 | 5 | Contract slot (W22) |
| B4 | W27, W28, W29, W30, W31 | coder-execution ×4, database-specialist ×1 | 5 | Contract slot (W27); lane databases created (W29) |
| B5 | W32, W33, W34, W35, W36, W37, W38 | coder-execution ×6, senior-code-reviewer ×1 | 7 | Each row tests on its own cloned database |
| B6 | W39, W40, W41, W42, W43, W44 | coder-execution ×6 | 6 | none |
| B7 | W45, W46, W47, W48, W49, W50, W51 | security-review ×1, senior-code-reviewer ×1, test-expert ×3, coder-execution ×2 | 7 | Lanes for the live checks of W50 and W51 |
| B8 | W52, W53, W54, W55, W56, W57 | test-expert ×2, coder-execution ×4 | 6 | Lanes; lane 2 with the tablet (W57) |
| B9 | W58, W59, W60, W61, then W104 | verifier ×1, coder-execution ×2, senior-code-reviewer ×1, git-specialist ×1 | 5 | **W58 owns port 4420 and `dems_demo`.** No lane backend runs while W58 runs (section 5.4): the device checks of W59 and W60 wait for it. **W104 (checkpoint commit 1) follows W58** and holds the git index |
| C1 | W62, W63, W64, W65, W66, W67, W68 | senior-code-reviewer ×1, coder-execution ×6 | 7 | Three lanes; three web and three mobile rows |
| C2 | W69, W70, W71, W72, W73, W74 | coder-execution ×6 | 6 | Same |
| C3 | W75, W76, W77, W78, W79, W80 | coder-execution ×6 | 6 | Same |
| C4 | W81, W82, then W105 | coder-execution ×2, git-specialist ×1 | 3 | W81 and W82 may start with C3 if slots are free (8 in flight at most, 6 coder-execution at most). **W105 (checkpoint commit 2) follows the last web row** and holds the git index |
| F1 | W83 | coder-execution ×1 | 1 | Contract slot |
| F2 | W84, W85, then W86 | coder-execution ×3 | 3 | W86 follows W84 and owns port 4420, port 5173 and one lane emulator |
| F3 | W87 | test-expert ×1 | 1 | none |
| F4 | W88, W89 | data-analyst ×1, verifier ×1 | 2 | **W89 uses PostgreSQL exclusively** and runs the mock-core suite (ports 4410, 4411) |
| V1 | W90, W91, W92, W93 | verifier ×1, senior-code-reviewer ×3 | 4 | **W90 uses PostgreSQL and port 4420 exclusively**; the reviews are read-only |
| V2 | W94, then W95, then W96; beside them W97 | verifier ×2 at a time | 2 | One serial chain on the main instance and the reserved emulator; W97 on lane 3, port 4400, port 4410 and a lane emulator |
| V3 | W98, W99, W100 | verifier ×1, security-review ×2 | 3 | W98 owns port 4420 |
| V4, V5, V6 | W101; W102; W103 | verifier; data-analyst; git-specialist | 1 | Git index (W103, after W105) |

**Limit check** (script output, section 10.3; the same in revision 2.1): no wave exceeds 6 of one type (peak: coder-execution ×6 in B5, B6, C1, C2, C3) or 8 in flight (peak: 7 in B5, B7, C1). The two checkpoint commits add one git-specialist to B9 (5 in flight) and to C4 (3 in flight).

**Total** (script count over section 8 [cmd]): **105 work rows**; by agent: coder-execution 68, verifier 10, senior-code-reviewer 7, test-expert 6, database-specialist 6, security-review 3, git-specialist 3, data-analyst 2; by tier: 99 on R and 6 on D (W02, W14, W85, W103, W104, W105). On top of these: four reserved numbers W106 to W109 and the conditional rows of section 8.6. Revision 1 had 103 rows; blueprint rev 1 had 96 provisional rows [DEC:D7, D17].

**Critical path**: 22 → W03 → W07 → W10 → W17 → W20 → W24 → W28 → W32 → W42 → W47 and W48 → W58 → the page and screen rows → W83 → W84 → W86 and W87 → W89 → W90 → W94 → W95 → W96 → W98, W99 → W101 → W102 → W103. The contract chain W16 → W19 → W22 → W27 feeds it at W24 (needs W19), W42 (needs W22) and W34 to W44 (need W27). Revision 2 leaves it unchanged: W28 gains the dependency W23, which sits one wave earlier, and W39 gains W29, two waves earlier. The checkpoint commits are off the path: W104 follows W58 and W105 follows W81, and only W103 waits for W105. Revision 2.1 puts W06 before W07 inside wave E2, so the path into W07 is the longer of W03 and W02 → W06; neither is measured, and W06 is a read-only check.

**Checkpoints for `checkpoint-resume`** [BP:580]: after E4, B2, B4, B6, W58 with W104, C2, C4 with W105, W89, W96 and W103.

---

## 10. Collision scan

### 10.1 Rule

Two rows "may run together" when neither depends on the other, directly or through other rows. That is stricter than "same wave", because rows of different waves overlap in time. The scan therefore checks every pair of rows, not every wave.

| Resource | What would be a collision | How it is excluded |
|---|---|---|
| Write path | Two rows that may run together own the same file, or one owns a folder that holds the other's file | The paths of section 8 are disjoint for every such pair (10.3). The 41 paths that have more than one writer are ordered by dependency (section 4.3) |
| Lock | Two rows need the same serial slot | A slot is a `lockf` lock that queues, or a dependency chain (section 4.1). A queue is not a collision |
| Fixed port | Two rows bind the same port | Every port of section 4.2 is bound only under its lock. Backend rows bind no port |
| Database | Two rows write the same database | Each test run works on its own cloned databases, named with its row label [DB:TI-2]; `dems_demo` and each lane database are used only under their lock |
| Exclusive use of PostgreSQL | A row stops or rebuilds the instance while another uses it | W89 and W90 can run together only with W88 and with the read-only reviews W91 to W93 (10.3) |

### 10.2 Scan per wave

Write-path roots are shortened; the exact paths are in section 8.

| Wave | Row: write-path roots | Locks held | Fixed ports bound | Shared by two rows of the wave |
|---|---|---|---|---|
| E1 | W01: two web test files. W02: `.locks/dems_*.pid`. W03: root manifest, lockfile, `.gitignore`, the `apps/core-server` skeleton (5 files), `packages/shared/package.json`, four placeholders. W04: `.cache/proof-engine`. W05: `apps/core-web/vite.config.ts`, `.cache/proof-harness` | npm (W03); lane 1 (W05); device ×3 (W02) | 4421, 5176 (W05); emulator consoles (W02) | Nothing |
| E2 | W06: two stale marker files. W07: `scripts/pg`, `.data`, `.locks/postgres.*`. W08: entry, app factory, config, six plugin folders, four plugin stubs, three folder stubs, thirteen module stubs, `modules/health`, `test/static`. W09: `modules/identity/password-hash` | postgres (W07) | 4432 (W07) | Nothing (W08 writes `modules/identity/index.ts`; W09 writes the sub-folder) |
| E3 | W10: `.cache/proof-drizzle`. W11: `apps/core-server/test/helpers/db`, `test/global-setup.db.ts`. W12: `packages/shared/src/client`, `packages/shared/test/client-*`, mobile `runtime/dev-probes.ts` and `runtime/debug.ts`, the harness. W13: `apps/mobile/package.json`, lockfile, `device-session.sh`, `android/`, `.cache/apk-backup` | npm, gradle (W13); lane 1 (W12); device (W12, W13) | 4421 (W12) | The device locks, as a queue |
| E4 | W14: `apps/core-web/package.json`, lockfile. W15: mobile `runtime/secure-credentials*`, `runtime/secure-store-import.test.ts`, `jest.setup.ts`, `runtime/dev-probes.ts` | npm (W14); device (W15) | none | Nothing |
| B1 | W16: `sim/vocabulary.ts`, `sim/auth.ts`, `i18n/en/common.ts`, three shared tests. W17: `apps/core-server/src/db/{schema,migrations,commands}`, `drizzle.config.ts`, `test/db`. W18: six files of `packages/shared/src/live`, `packages/shared/test/live-light-*` | contract (W16); migration (W17) | none | Nothing |
| B2 | W19: the contract paths. W20: `src/db/{mapping,seed}`. W21: `src/core` | contract (W19); `db-migrate.lock` (W20) | none | Nothing |
| B3 | W22: the contract paths. W23: `plugins/{origin-guard,throttle}`. W24: `plugins/authenticate`, `modules/identity`. W25: `src/db/fixtures`. W26: `src/engine` | contract (W22) | none | Nothing |
| B4 | W27: the contract paths. W28: `plugins/permission-guard`, `modules/rbac`. W29: `src/db/reset`. W30: `realtime/live-socket-client.ts`, `realtime/index.ts`, `test/realtime-live-*`. W31: `src/live/testing`, `test/live-testing-*` | contract (W27); `db-migrate.lock`, advisory key 442001 (W29) | none | Nothing |
| B5 | W32: `modules/pairing`. W33: `modules/admin`. W34: `modules/sessions`. W35: `modules/evidence`. W36: `modules/devices`. W37: `modules/storage`, `modules/network-time`. W38: nothing | none | none | Nothing |
| B6 | W39: `modules/security-audit`. W40: `modules/system`, `modules/alerts`. W41: `modules/identity/biometric`. W42: `src/realtime`. W43: `modules/demo`. W44: `packages/shared/src/live/source`, `test/live-source-*` | none | Ephemeral loopback ports (W42 tests) | Nothing |
| B7 | W45, W46: nothing. W47, W48, W49: one acceptance file each. W50: web entry, router, root route, `src/runtime`, two `lib` files, `en/common.ts`, new tests. W51: eight mobile runtime files, `features/home/use-health.ts`, `i18n/en.mobile.ts`, new tests | A lane (W50, W51) | The lane's ports | A lane, as a queue |
| B8 | W52, W53: one acceptance file each. W54: `components/shell`, `routes/_app/admin`, `routeTree.gen.ts`, two page stubs, `i18n/index.ts`, three namespace files. W55: `features/login`, `en/login.ts`. W56: `apps/mobile/src/auth`. W57: mobile `features/pairing` | Lanes (W54 to W57; W57 lane 2) | The lanes' ports | Lanes, as a queue |
| B9 | W58, W61, W104: no file. W59: mobile `features/login`. W60: `navigation`, two layout files | main (W58); lanes (W59, W60); the git index (W104, after W58) | 4420 (W58) | Nothing. W104 stages only the paths of rows that are complete and names what it leaves out |
| C1 | W62: nothing. W63, W64, W65: one web feature folder each, its i18n file, its `live-<topic>-*` tests. W66, W67, W68: mobile feature folders | Lanes | The lanes' ports | Lanes, as a queue |
| C2 | W69, W70, W71: web feature folders (W71 two). W72, W73, W74: mobile feature folders (W72 three) | Lanes | The lanes' ports | Lanes, as a queue |
| C3 | W75, W76, W77: web feature folders. W78, W79, W80: mobile feature folders (W79 two) | Lanes | The lanes' ports | Lanes, as a queue |
| C4 | W81: web `features/paired-devices`. W82: mobile `features/settings`. W105: no file | Lanes; the git index (W105, after W81) | The lanes' ports | Nothing. W105 leaves out the mobile rows still in flight |
| F1 | W83: the contract paths | contract | none | Single row |
| F2 | W84: web `features/api-reference`. W85: `THIRD_PARTY_NOTICES.md`. W86: `README.md` | A lane (W84); main, `vite.lock`, a device (W86) | 4420, 5173 (W86) | Nothing |
| F3 | W87: three groups of new test files | none | none | Single row |
| F4 | W88, W89: nothing | PostgreSQL exclusively (W89) | 4410, 4411 (mock-core tests) | Nothing |
| V1 | W90 to W93: nothing | PostgreSQL exclusively, main (W90) | 4432, 4420 | Nothing |
| V2 | W94 to W97: nothing | main, `vite.lock`, the reserved device (the chain); lane 3, mock-core, a lane emulator (W97) | 4420, 5173; 4423, 5178, 4400, 4410 | Nothing |
| V3 | W98 to W100: nothing | main (W98); lane 3 (W99); a device, read-only (W100) | 4420; 4423 | The reserved device between W98 and W100, as a queue |
| V4 to V6 | W101 to W103: no file | Git index (W103, after W105) | none | Single rows |

### 10.3 Mechanical check

A script parsed the tables of section 8 (105 rows of 11 cells, and the 105 rows of section 8.7) and printed, for revision 2.1 [cmd]:

```
rows parsed: 105 W01 .. W105
missing ids: []
deps in a later wave than the row: []
deps inside the same wave (serial inside the wave): [('W07', 'W06'), ('W86', 'W84'), ('W95', 'W94'), ('W96', 'W95'), ('W104', 'W58'), ('W105', 'W81')]
PATH OVERLAPS BETWEEN ROWS WITH NO DEPENDENCY PATH: 0
paths shared by rows that are ordered by dependency: 41
AC-B: covered 93/93; missing []
AC-C: covered 110/110; missing []
SR: covered 82/82; missing []
W89 co-runnable rows: ['W88', 'W104', 'W105'] | of these, users of PostgreSQL: []
W90 co-runnable rows: ['W88', 'W91', 'W92', 'W93', 'W104', 'W105'] | of these, users of PostgreSQL: []
main: holders ['W58', 'W86', 'W90', 'W94', 'W95', 'W96', 'W98']; pairs not ordered by dependency (serialised by the lock): []
npm: holders ['W03', 'W13', 'W14']; pairs not ordered by dependency (serialised by the lock): []
contract: holders ['W16', 'W19', 'W22', 'W27', 'W83']; pairs not ordered by dependency (serialised by the lock): []
=== REVISION 2.1 CHECKS ===
output documents: rows with exactly one 105/105; distinct paths 105; under an allowed folder 105; rows with "(none)" source paths 24
output documents equal to the blueprint column "Expected Output": 105/105; different: []
finding-to-row pairs of section 7.2: 106; pairs whose row cites neither the finding nor a criterion of it: []
provisional rows with a work row: 95 (23..118); without one (41 is SKIPPED): []; section 21 and the "Prov." column differ in: []
shell variable of device-session.sh: uses with a value under the old name 0 | under the new name 3
storage-page.test.tsx listed in section 4.3: True | W71 rollback: R-CO; R-PRE (`storage-page.test.tsx`)
  W01 file apps/core-web/src/test/sim-fetch.test.ts -> later writers: []
  W01 file apps/core-web/src/features/storage/__tests__/storage-page.test.tsx -> later writers: ['W71']
rows of revision 2: 105 | changed cells by column: {'verif': ['W01', 'W07', 'W13', 'W71', 'W84'], 'title': ['W06', 'W13', 'W45', 'W71', 'W99'], 'deps': ['W07'], 'impl': ['W08', 'W10', 'W24', 'W25', 'W45', 'W50', 'W54', 'W99'], 'rb': ['W71']}
rows changed in all: 14 | agent, wave, write paths, locks or "Prov." changed: []
```

Against revision 2 the first block differs in one place: the pair (W07, W06) joins the dependencies inside a wave [CC:C-09]. The second block holds the checks added for revision 2.1: the output documents of section 8.7 against the blueprint; the finding-to-row citations of section 7.2 (run on revision 2, the same check printed the nine pairs of [CC:C-10]); section 21 against the "Prov." column (on revision 2 it printed rows 25 and 79); the shell variable of [CC:C-13]; the two files of W01; and the cells that differ from revision 2, where no agent, wave, write path, lock or "Prov." cell changed.

W104 and W105 appear beside W89 and W90 because they depend on neither; they hold only the git index and write no file. How it decides an overlap: two paths overlap when they are equal, when one is a folder that contains the other, or when the fixed part of a `*` pattern is a prefix of the other. The script is in the session scratchpad, not in the repository; row 19 can repeat the check by reading section 8. What the script does not check: that an agent stays inside its paths (P6 and the checkpoints do), and the conditional rows of section 8.6, which take a serial slot each.

---

## 11. The gate rule and the expected test counts

### 11.1 Rule

| ID | Rule | Source |
|---|---|---|
| GR-1 | `npm run typecheck`, `npm run lint` and `npm test` at the workspace root need **no database** and no running server. The new workspace's `test` script runs only the database-free project | [DEC:D9 DN-6]; [AN:484] |
| GR-2 | Database-backed tests run through `npm run test:db` (root alias of the workspace script). It attaches to the running PostgreSQL or starts it, and it fails, never skips, when PostgreSQL cannot be reached | [AN:484]; [DB:TI-1, TI-15] |
| GR-3 | Gate rows run tests **per workspace** as `npm run test -w <workspace> -- --maxWorkers=2`, because the root script does not forward the worker limit | [DEC:D10]; [BG:§8 N-2] |
| GR-4 | The mock-core suite needs one sandbox-bypassed command (it binds loopback ports) and is run only by W89 and W97 | [BG:§5.2]; section 4.1 |
| GR-5 | Until W01 is done, a gate accepts exactly the two failures of [BG:§6] by name and nothing else. From W01 on, no failure is accepted | [DEC:D10] |
| GR-6 | A row's own gate (SG) covers the workspaces it wrote. The two full gates are W58 (backend) and W89 (root) | section 8.1 |
| GR-7 | The static guard tests that W08 adds under `apps/core-server/test/static/` (no name of the superuser's password file, no secret in an argument, no statement that removes the audit protection) belong to the database-free project, so they run in every row's gate from wave E2 on | [SP:AC-B-86]; [DB:T-CR-2, T-AO-4] |
| GR-8 | The check "as the bootstrap superuser" is not part of `test:db` and not part of any gate command; it is trial step T5-j of `pg:init`, run once by W07 (section 7.3) | [DB:TI-9]; [DEC:D19] |
| GR-9 | A checkpoint commit follows a gate: W104 after W58, W105 after the web rows. A commit never replaces a gate | [DEC:D17] |

### 11.2 Gate commands

Run from `/Users/gsp-budi/Documents/DEMS`.

```sh
npm run typecheck                                        # root; no database
npm run lint                                             # root; no database
npm run test -w @dems/shared      -- --maxWorkers=2
npm run test -w @dems/mock-core   -- --maxWorkers=2      # W89 and W97 only; one sandbox-bypassed command
npm run test -w @dems/core-web    -- --maxWorkers=2
npm run test -w @dems/mobile      -- --maxWorkers=2
npm run test -w @dems/core-server -- --maxWorkers=2      # project "unit": no database
npm run test:pg-scripts                                  # node --test scripts/pg/ ; no database
npm run test:db                                          # project "db"; needs PostgreSQL; fails, never skips
npm test                                                 # W89 only, with PostgreSQL stopped: the literal check of AC-B-58
```

### 11.3 The test ledger (P24)

Baseline at `acaff20`, measured by row 13 [BG:§1, §5]:

| Workspace | Files or suites | Tests | State |
|---|--:|--:|---|
| `@dems/shared` | 28 | 508 | all pass |
| `@dems/mock-core` | 4 | 19 | all pass (with the sandbox bypass) |
| `@dems/core-web` | 39 | 438 | 436 pass; 2 fail by date: `src/test/sim-fetch.test.ts` ("export as SUPERVISOR: 202 ...") and `features/storage/__tests__/storage-page.test.tsx` ("AC-75 ...") |
| `@dems/mobile` | 72 | 833 | all pass |
| `@dems/core-server` | 0 | 0 | does not exist |

| ID | How new tests are counted |
|---|---|
| L-1 | Every row that adds or changes tests reports, per workspace, in its log: the runner's totals before and after, and the new test files by name. For `@dems/core-server` it reports the projects `unit` and `db` separately |
| L-2 | The controller keeps one ledger line per workspace: **expected total = baseline + the sum of the reported additions**. After W01 the web line reads 438 passed of 438 (the two tests are repaired, not added) |
| L-3 | A gate passes when, per workspace: failed = 0; passed = the runner's total; the total is at or above the ledger's expected total; the number of files or suites is at or above the baseline |
| L-4 | A total above the ledger means a row did not report its tests: the gate notes it and the ledger is corrected. A total below the ledger is a FAIL that names the row which last wrote that workspace |
| L-5 | An existing test may change only by design, and each such change is a recorded decision. The ones this plan already knows: the two files of W01 [DEC:D10]; the count pins that W16 meets (GP-06); the assertions of `packages/shared/test/openapi.test.ts`, `schemas.test.ts` and `sim-api-validation.test.ts` that the contract rows change [DEC:F5]; [SP:§7.19] |
| L-6 | The 61 simulator-dependent test files (28 web, 33 mobile) [SP:AC-B-59] must pass in every client row and in W89 and W97; their diff against `acaff20` may hold only the two files of W01 and changes recorded under L-5. Rev 2.1: each of the two files is in W01's state (section 8.1) |

---

## 12. Test strategy

This section answers impact question 24. The tooling is fixed by TD-12 [AN:475-491]; the isolation of test databases by [DB:§10]; what each client row must prove by [CS:§12.3].

| Layer | What | Runner and isolation | Rows | Criteria |
|---|---|---|---|---|
| T0 Static | Typecheck and lint in every row; static tests: platform neutrality of the shared client layer, no `useSimActions` in feature folders, one importer of `expo-secure-store`, no production import of the fake transport, no secret in a path or query parameter of the registry; rev 2: no name of the superuser's password file, no `PGPASSWORD`, no `--env-file`, no connection URL with a password, no trigger-disabling statement, no header rewrite in the proxy block | `tsc`, oxlint, eslint; Vitest and jest | Every row; W07, W08, W12, W15, W31, W50, W87 | AC-B-86; AC-C-02, AC-C-53, AC-C-66, AC-C-102; SR-49, SR-68, SR-77 |
| T1 Unit, no database | Server: guards with fakes, the boot check of the registry, the password hash, the logger. Shared: typed client, socket client, settle helper, Live source on the fake transport. Web and mobile: Live tests of every settle site on the fake transport; the existing Simulated tests unchanged | Vitest 5.0.3 (project `unit`; shared; web), jest 29.7.0 (mobile); two workers | W08, W09, W12, W18, W23, W30, W31, W44, the client rows | AC-B-12, AC-B-30; AC-C-01 to 101 as section 13 |
| T2 Integration against a real PostgreSQL 18.4 | Each backend module in-process (`app.inject`, `injectWS`, a real `ws` client on an ephemeral port) against one database per test file cloned from a template (`tpl_schema`, `tpl_seed`, `tpl_bulk`); the code under test connects as `dems_app`, the helper as `dems_owner`, nothing as `dems_admin`; a manual clock. Rev 2: the concurrency tests of [SP:AC-B-76 to AC-B-80] and their statement-level twins T-AT-1 to T-AT-5; the decision tables of [SP:§14.2]; the denial budget; two instances with one cookie jar | `npm run test:db`; names `dems_test_<label>_<stamp>_...`; clones serialised; two workers | W11, W17, W20, W21, W24 to W29, W32 to W37, W39 to W43 | AC-B-01, 02, 07, 16 to 21, 23 to 38, 41 to 43, 46, 48 to 50, 52 to 57, 69 to 80, 82 to 90 |
| T3 Acceptance, written by test-expert independently of the module rows | The role-by-endpoint matrix generated from the registry (75 operations, 5 caller kinds, plus the credential-misuse cells), which advances the manual clock or resets the counter so that no caller exceeds the denial budget [DEC:F25]; the pairing lifecycle; two-client shared state and resync; contract conformance against the registry and the OpenAPI document; restart and recovery | `test:db`; the bulk fixture for the matrix and the contract test | W47, W48, W49, W52, W53 | AC-B-04 to 06, 09, 10, 14 to 16, 28, 32 to 39, 41, 44 to 47, 70, 81, 82, 93 |
| T4 Gates | The backend gate with a smoke run on port 4420; the root gate with and without PostgreSQL | section 11.2 | W58, W89 | AC-B-03, 08, 58, 59, 66 |
| T5 Live checks | One check of at most 10 minutes per client row, on a lane backend with its own database, with a screenshot or a screencap | section 5.3 | W50, W51, W54 to W57, W59, W60, W63 to W82, W84 | CLG item (d) |
| T6 End to end across the backend, the web console and one emulator | SC5, then SC3, then SC4, each step with a capture and the audit row | By hand, with the browser tool and `adb`, on the main instance and the canonical seed | W94, W95, W96 | AC-B-22, 40, 51; AC-C-55, 64, 82 |
| T7 Regression | The 61 simulator-dependent files; `release/` checksums; the launcher's `--self-test`; mock-core; the simulator diff; a Simulated walk on the web and one emulator | section 8.5, W97 | W97; L-6 in every client row | AC-B-59 to 63; AC-C-27, 35, 101 |
| T8 Clean state | The README followed literally from an empty data directory; rev 2: the five SHA-256 values of the supply-chain record recomputed, the host-authentication check and the file modes checked again | W90 | W90 | AC-B-01 to 03, 64, 67, 91, 92 |
| T9 Security | Design review; the access-control checkpoint; two final reviews; a dump test and a log-capture test for secrets | Read-only reviews; T2 tests | Row 20, W45, W99, W100; W24, W28, W32, W41, W42, W48, W58 | SR-01 to 82; AC-B-28, 29, 41; AC-C-65 |
| T10 Performance | The realtime path against the Simulated-mode figures on the same host | W98 | W98 | I8; SA-06 |

| Topic | Decision | Source |
|---|---|---|
| Coverage | `@vitest/coverage-v8` 5.0.3 for `@dems/core-server` only; W87 reports the line coverage. No threshold is set, because no source gives one (GP-08). What is binding is the operation-to-test table: every operation has a success test, every operation with a permission a denial test, every operation with a body a validation test | [AN:482]; [SP:AC-B-68] |
| Test data | Synthetic only. Seeds in tests use the fixed instant 2026-10-01 10:00 WIB; the bulk fixture uses generated operator names of the form `fixture.operator.NNN` | [AN:569]; [DB:BF-4] |
| Fakes | One contract-checked fake transport for Vitest and jest; mobile mocks for `expo-secure-store` and `expo-device` in `apps/mobile/jest.setup.ts` | [CS:§12.2] |
| Clock | Tests drive a manual clock; no column takes the database clock | [DB:TI-16] |
| Not used | Transaction rollback per test, schema per worker, PGlite, `pg-mem`, Playwright, Detox, Appium, MSW, oasdiff, Schemathesis, Testcontainers | [AN:488, 438] |
| Scripted device flows | None in this task: Maestro stays a follow-up (KI-02); W06 records whether the CLI starts outside the sandbox | [AN:487]; [DEC:F19] |
| Load | Two workers everywhere; gate rows run with no lane backend; the load guard of section 5.4 | [BP:442-445] |
| Feedback | A failed verification goes back to the same agent with the failing check, the artefact and the expected correction, and is run again | [BP:582-586] |

---

## 13. Acceptance-criteria coverage

Generated from the "Implements" cells of section 8 by the script of section 10.3, in revision 2: **AC-B 93 of 93, AC-C 110 of 110, SR 82 of 82**. A criterion may also appear in a row's Verification cell; the first row listed is the one that must make it pass.

**Through the gates of section 8.1**, not repeated in every row: AC-B-68 (every backend module row, by MODG; the table is in W87); AC-C-48, AC-C-53 and AC-C-101 (every web page row and mobile screen row, W63 to W82, by CLG).

### 13.1 AC-B-01 to AC-B-93 [SP:§16]

AC-B-72 to AC-B-93 are the criteria of revision 2 [SP:§16.10]; thirteen older ones were changed in place and stay with their rows.

| Criteria | Work rows |
|---|---|
| AC-B-01 | W17, W90 |
| AC-B-02 | W20, W90 |
| AC-B-03 | W07, W58, W90 |
| AC-B-04 to 06 | W53 |
| AC-B-07 | W26 |
| AC-B-08 | W08, W58 |
| AC-B-09 | W27, W52 |
| AC-B-10 | W52 |
| AC-B-11 | W27, W83 |
| AC-B-12 | W28 |
| AC-B-13 | W19, W83 |
| AC-B-14 | W08, W23, W52 |
| AC-B-15 | W47 |
| AC-B-16 | W28, W47 |
| AC-B-17 | W16, W20 |
| AC-B-18 | W28, W33 |
| AC-B-19 | W42 |
| AC-B-20 | W33, W42 |
| AC-B-21 | W33 |
| AC-B-22 | W96 |
| AC-B-23 to 27 | W24 |
| AC-B-28 | W20, W24, W48 |
| AC-B-29 | W24, W32, W41, W58 |
| AC-B-30 | W09, W24 |
| AC-B-31 | W41 |
| AC-B-32 to 38 | W32, W48 |
| AC-B-39 | W48 |
| AC-B-40 | W94 |
| AC-B-41 | W32, W48 |
| AC-B-42 | W42 |
| AC-B-43 | W23, W28, W42 |
| AC-B-44 to 45 | W49 |
| AC-B-46 | W22, W42, W49 |
| AC-B-47 | W49 |
| AC-B-48 | W42 |
| AC-B-49 to 50 | W34 |
| AC-B-51 | W95 |
| AC-B-52 to 53 | W04, W26 |
| AC-B-54 | W17, W21 |
| AC-B-55 | W21, W26 |
| AC-B-56 | W43 |
| AC-B-57 | W29, W43 |
| AC-B-58 | W01, W03, W08, W58, W89 |
| AC-B-59 | W01, W89, W97 |
| AC-B-60 | W97 |
| AC-B-61 | W08, W97 |
| AC-B-62 | W16, W46, W97 |
| AC-B-63 | W44, W97 |
| AC-B-64 | W07, W58, W90 |
| AC-B-65 | W20 |
| AC-B-66 | W58, W99 |
| AC-B-67 | W86, W90 |
| AC-B-68 | W87 (and MODG) |
| AC-B-69 | W35 |
| AC-B-70 | W35, W52 |
| AC-B-71 | W40 |
| AC-B-72 | W29, W43 |
| AC-B-73 | W28, W42 |
| AC-B-74 | W23, W28, W42 |
| AC-B-75 | W28, W32 |
| AC-B-76 to 77 | W32 |
| AC-B-78 | W41 |
| AC-B-79 | W33 |
| AC-B-80 | W24 |
| AC-B-81 | W47 |
| AC-B-82 | W41, W48 |
| AC-B-83 | W41 |
| AC-B-84 | W28, W42 |
| AC-B-85 | W42 |
| AC-B-86 | W07, W08 |
| AC-B-87 | W17, W29, W39 |
| AC-B-88 | W39 |
| AC-B-89 | W40 |
| AC-B-90 | W24 |
| AC-B-91 | W03, W07, W13, W14, W90 |
| AC-B-92 | W86, W90 |
| AC-B-93 | W19, W52 |

### 13.2 AC-C-01 to AC-C-110 [CS:§13]

AC-C-102 to AC-C-110 are the criteria of revision 2.

| Criteria | Work rows |
|---|---|
| AC-C-01 | W12, W27 |
| AC-C-02 | W12, W18, W30, W31, W44, W46, W92 |
| AC-C-03 to 05 | W12 |
| AC-C-06 | W18, W44 |
| AC-C-07 to 08 | W44 |
| AC-C-09 | W18 |
| AC-C-10 to 14 | W44 |
| AC-C-15 | W30, W44 |
| AC-C-16 | W30 |
| AC-C-17 | W31 |
| AC-C-18 | W50, W84 |
| AC-C-19 to 22 | W50 |
| AC-C-23 | W50, W55 |
| AC-C-24 | W54 |
| AC-C-25 | W50, W55 |
| AC-C-26 | W54 |
| AC-C-27 | W97 |
| AC-C-28 | W51, W62 |
| AC-C-29 | W51 |
| AC-C-30 | W66 |
| AC-C-31 | W60, W82 |
| AC-C-32 | W51 |
| AC-C-33 | W50 |
| AC-C-34 | W05, W50 |
| AC-C-35 | W50, W61, W97 |
| AC-C-36 | W50 |
| AC-C-37 | W50, W95 |
| AC-C-38 | W55, W61 |
| AC-C-39 | W44, W55 |
| AC-C-40 | W50, W55 |
| AC-C-41 | W50 |
| AC-C-42 to 44 | W55 |
| AC-C-45 | W54, W55 |
| AC-C-46 | W50 |
| AC-C-47 | W55 |
| AC-C-48 | W63, W66 (and CLG in W63 to W82) |
| AC-C-49 | W51, W54 |
| AC-C-50 | W54, W60, W67 |
| AC-C-51 | W54 |
| AC-C-52 | W76, W82 |
| AC-C-53 | W63, W87 (and CLG in W63 to W82) |
| AC-C-54 | W44 |
| AC-C-55 | W96 |
| AC-C-56 | W87 |
| AC-C-57 to 58 | W64, W67 |
| AC-C-59 | W51, W54 |
| AC-C-60 | W75, W76 |
| AC-C-61 | W69, W74 |
| AC-C-62 | W67 |
| AC-C-63 | W74, W78 |
| AC-C-64 | W95 |
| AC-C-65 | W56, W62, W100 |
| AC-C-66 | W15, W62, W93 |
| AC-C-67 | W56 |
| AC-C-68 | W56, W82 |
| AC-C-69 to 70 | W56 |
| AC-C-71 | W15, W56 |
| AC-C-72 | W59 |
| AC-C-73 to 74 | W60 |
| AC-C-75 to 77 | W57 |
| AC-C-78 to 79 | W51, W60 |
| AC-C-80 | W57 |
| AC-C-81 | W57, W94 |
| AC-C-82 | W94 |
| AC-C-83 | W82 |
| AC-C-84 to 85 | W13 |
| AC-C-86 to 91 | W77 |
| AC-C-92 to 99 | W81 |
| AC-C-100 | W84 |
| AC-C-101 | W01, W50, W51, W63, W87, W89, W97 (and CLG in W63 to W82) |
| AC-C-102 | W05, W50 |
| AC-C-103 | W84, W100 |
| AC-C-104 | W55, W59 |
| AC-C-105 | W15, W56, W100 |
| AC-C-106 | W50, W81 |
| AC-C-107 | W55, W81, W84 |
| AC-C-108 | W56 |
| AC-C-109 | W75 |
| AC-C-110 | W50, W54, W55, W59 |

### 13.3 SR-01 to SR-82 [SP:§15]

The two review rows W45 and W99 check all 82; the table names the rows that implement them. SR-68 to SR-82 are the requirements of revision 2 [SP:§15.12].

| Requirements | Work rows | Requirements | Work rows |
|---|---|---|---|
| SR-01 | W07, W08, W58 | SR-56 | W29 |
| SR-02 | W07 | SR-57 | W43 |
| SR-03 | W08, W58 | SR-58 | W29, W43 |
| SR-04 | W08, W23 | SR-59 | W26, W35, W43 |
| SR-05 to 06 | W09, W24 | SR-60 | W03, W07 |
| SR-07 to 11 | W24 | SR-61 | W24 |
| SR-12 | W24, W33 | SR-62 | W20, W25 |
| SR-13 | W24, W28 | SR-63 | W20, W55, W59, W86 |
| SR-14 to 15 | W24 | SR-64 | W08, W19 |
| SR-16 | W24, W55, W56, W100 | SR-65 | W21, W26 |
| SR-17 | W24, W53 | SR-66 | W35 |
| SR-18 | W24 | SR-67 | W17, W91 |
| SR-19 to 21 | W23 | SR-68 | W07, W08, W10, W11, W17, W25, W29, W43 |
| SR-22 to 23 | W24 | SR-69 | W23, W24, W28, W42 |
| SR-24 | W23 | SR-70 | W23, W42 |
| SR-25 | W24 | SR-71 | W23, W28, W32 |
| SR-26 to 31 | W32 | SR-72 | W17, W21, W24, W32, W33, W41 |
| SR-32 | W15, W100 | SR-73 | W24, W47 |
| SR-33 to 35 | W32 | SR-74 | W41, W42 |
| SR-36 to 37 | W41 | SR-75 | W08, W23, W24, W28, W42 |
| SR-38 to 42 | W42 | SR-76 | W03, W08, W52 |
| SR-43 to 46 | W28 | SR-77 | W07, W08 |
| SR-47 | W33 | SR-78 | W17, W29, W39 |
| SR-48 to 50 | W08 | SR-79 | W04, W26 |
| SR-51 | W42 | SR-80 | W03, W07, W13, W14, W90 |
| SR-52 | W08, W17, W21 | SR-81 | W39 |
| SR-53 to 54 | W17, W21 | SR-82 | W40 |
| SR-55 | W26 | | |

SR-14, SR-18, SR-25 and SR-63 are deviations that the security design review accepted [SDR:§6]; [DEC:D16]; the rows build them as specified. SR-55 is also met by every module row.

### 13.4 Success criteria SC1 to SC11 [RT:298-308]

| SC | Proven by | Built by |
|---|---|---|
| SC1 Spec and plan dated before the first implementation log | W101 (the commit time of row 22 against the log of W01) | Rows 15 to 18, 22 |
| SC2 Documented start, migrations from empty, seed, state survives a restart | W53, W58, W90 | W07, W17, W20, W26, W29 |
| SC3 Both clients take data from the backend; an action on one is visible on the other | W49, **W95** | W42, W44, W50, W51, W63 to W82 |
| SC4 Role-by-endpoint test; denial refused and audited; a role change follows on both clients | W47, **W96** | W28, W33, W42, W54, W77 |
| SC5 Pairing gate, listing, revocation, an audit row per step | W48, **W94** | W32, W57, W60, W81 |
| SC6 OpenAPI describes every endpoint; drift test; API Reference shows them as live | W52, W83, W84 | W19, W22, W27 |
| SC7 Existing suites and new backend tests pass | W87, W89 | every row (SG) |
| SC8 Simulated mode and the 0.1.0 packages still work | W97 | W01 (recorded change); the mode isolation of W18, W44, W50, W51 |
| SC9 Decisions, drift and findings recorded | W88, W102 | The controller |
| SC10 No secret committed, no real personal data, nothing sent out | W99, W100, W103 (and the checks of W104 and W105) | W07, W08, W20, W24, W32 |
| SC11 README gives the exact Live-mode commands | W90 | W86 |

### 13.5 Impact questions answered in this plan [RT:237-273]

| IQ | Question (short) | Answer in |
|--:|---|---|
| 4 | How PostgreSQL is installed, started, stopped and removed; which port; where the data directory is and whether it is git-ignored | Section 14 "PostgreSQL provisioning and the Host Impact Register" (14.1 for the answer, 14.2 and 14.3 for the rollbacks); the decision is [AN:TD-02] |
| 5 | How PostgreSQL would reach a demo PC on the four OS targets | Section 15 "PostgreSQL on a demo PC"; the cost record is [AN:TD-13] and [SP:§10.4] |
| 22 | How the shared contract is changed without parallel agents colliding | Section 16 "Changing the shared contract without collisions"; the slot is in section 4.1 |
| 24 | The test strategy | Section 12 "Test strategy"; the gate rule and the ledger are section 11; the criteria are [SP:§16] and [CS:§13] |
| 25 | Which predecessor known issues are touched and must not get worse | Section 17 "Known issues touched (KI-01, KI-02, KI-07, KI-18)" |

---

## 14. PostgreSQL provisioning and the Host Impact Register

This section answers impact question 4.

### 14.1 PostgreSQL on the development host

| Question | Answer | Source |
|---|---|---|
| Installed how | From npm: `embedded-postgres` 18.4.0-beta.17 brings the PostgreSQL 18.4 binaries for macOS arm64 into `node_modules` (W03, npm slot N1). Its one install script is read, approved by exact name in the root `allowScripts`, and `npm audit signatures` is recorded. The package's own lifecycle code is not imported | [DEC:D11 TD-02]; [DEC:F21] |
| Started and stopped how | Only by `npm run pg:start` and `npm run pg:stop` (`scripts/pg/*.mjs`, which call `pg_ctl`). No Docker, no launchd job, no login item, no shell-profile edit. The PID is in `.locks/postgres.pid` | [DEC:D5]; [AN:275] |
| Removed how | `npm run pg:remove-data` stops the server and deletes `.data/`. `npm run pg:remove` does that and uninstalls the binary package: one command for everything this task put on the host for PostgreSQL | [DEC:D5]; H-01, H-02 below |
| Port | `127.0.0.1:4432`, TCP only; the Unix socket is disabled; never 5432. W06 probes it first; W07 depends on W06 and probes it again immediately before the first start (section 4.2) | [DEC:D11]; [AN:269-270] |
| Data directory | `.data/postgres/` inside the project. `/.data/` is added to `.gitignore` by W03 **before** the folder exists, and W07 proves it with `git check-ignore -v` | [AN:271]; [SP:AC-B-64] |
| Credentials | Three files, generated locally by `pg:init` and never printed: `.data/pg.pwfile` (the superuser `dems_admin`, read by `scripts/pg/` only), `.data/pg.owner.env` (`dems_owner`), `.data/pg.env` (`dems_app`). `.data/` has mode 0700, each file 0600; `pg_hba.conf` holds only `scram-sha-256` lines for loopback. All are removed with the cluster | [SP:§14.1]; [DB:§7.6] |
| Roles and databases | Three roles [DEC:DR-03]: `dems_admin` (the bootstrap superuser, **provisioning only**), `dems_owner` (not a superuser; owns the databases; migrate, seed, reset, tests), `dems_app` (the server's runtime role). Both project roles are created by `pg:init`, not by `db:create`. Databases: `dems_demo`, `dems_lane_1` to `dems_lane_3`, `dems_test_*`, all owned by `dems_owner` | [DB:§7.1, §8.4] |
| Fallback | The Homebrew keg `postgresql@18` 18.6, only if the trial fails (row Fb); it writes outside the project and its removal is several commands (H-12) | [DEC:DR-01, D11] |

### 14.2 Register

Revision 2 changes one line of this register: H-02 now holds a third credential file, `.data/pg.owner.env`, and H-15 a second project role. Both are inside the project's `.data/` and go with RB-02. **Nothing else on the host changes**: no new port, no new process, no path outside the project. The two checkpoint commits are local git commits, not host changes.

"Host" is anything outside tracked source files. The rollback column points to the verbatim block of 14.3. "Proven" names the row that executes the rollback; "written only" means no row executes it.

| ID | Change | Where | Row | Persists after the session? | Rollback | Proven |
|---|---|---|---|---|---|---|
| H-01 | npm packages `embedded-postgres`, `@embedded-postgres/darwin-arm64` (about 148 MB [AN:240]) and the root `pg`; one `allowScripts` entry | `node_modules/`; root `package.json`; `package-lock.json` | W03 | Yes, inside the project | RB-01 | Written only (GP-02) |
| H-02 | The PostgreSQL cluster, **three credential files** (`pg.pwfile`, `pg.owner.env`, `pg.env`; revision 2 adds the second), the server log | `.data/` (git-ignored) | W07 | Yes, inside the project | RB-02 | W90 |
| H-03 | A PostgreSQL process listening on `127.0.0.1:4432` | Started by `scripts/pg/`; PID in `.locks/postgres.pid` | W07 onward | No: nothing starts it at login | RB-03 | W89, W90 |
| H-04 | Core server processes on `127.0.0.1:4420` and on 4421 to 4423 | Started by the row that holds the lock | W58 onward; the live checks | No | RB-04 | Every live check |
| H-05 | An `adb reverse tcp:4420` rule on an emulator | Emulator runtime state | W12, W13 onward | Until the emulator restarts | RB-05 | W13 |
| H-06 | The debug APK rebuilt with one more native module, installed with `adb install -r` | The DEMS app on the emulators DP-1 names | W13 | Yes, on the emulator | RB-06 | Written only |
| H-07 | A device credential, a biometric token and a marker in the app's secure storage; one Keystore key | Inside the DEMS app's sandbox on an emulator | W15 (probe item), W57 onward | Until unpair, uninstall or cleared data [AN:451] | RB-07 | W57 (unpair), W94 (revoke) |
| H-08 | A session cookie for host `127.0.0.1`; the key `dems.core.mode.v1` | The browser profile used for the console | W50 onward | The cookie until sign-out or expiry; the key until cleared | RB-08 | W55 (sign-out) |
| H-09 | Network fetches: the npm registry (W03, W13, W14, a fallback row); Maven artefacts for the new Android module (W13); `npm audit` (W03, W99) | npm cache; Gradle cache | as listed | Caches only | None needed | |
| H-10 | AVD camera settings | `~/.android/avd/*/config.ini` | none | **Not changed** [DEC:DR-02] | Not applicable | |
| H-11 | Lock, PID and log files | `.locks/` (git-ignored) | several | Yes, inside the project | RB-11 | Written only |
| H-12 | **Fallback only**: the Homebrew keg `postgresql@18`, its dependency `krb5`, symlink trees, a default cluster under `/opt/homebrew/var` | `/opt/homebrew` | Fb | Yes, **outside the project** | RB-12 | Written only |
| H-13 | A per-command sandbox bypass for port binding, `adb`, the emulator, Gradle, git writes and npm installs | Session permissions | several | No | Not applicable | |
| H-14 | Three emulator processes, booted cold | Host processes; `.locks/dems_*.pid` | W02 | Until the user closes them | RB-14 (the user's action; an agent never kills an emulator, [BP:418]) | Not by an agent |
| H-15 | The roles `dems_owner` and `dems_app` (created by W07); the databases `dems_demo`, `dems_lane_1` to `dems_lane_3`, `dems_test_*` | Inside the cluster of H-02 | W17, W20, W29, every `test:db` run | With the cluster | RB-15 | W90 (with RB-02); every test run drops its own databases |
| H-16 | Two stale zero-byte markers removed | `.locks/mock-core.users/`, `.locks/vite.users/` | W06 | Yes | RB-16 | Written only |
| H-17 | Scratch folders: the proofs, the rollback pre-images, the APK backup | `.cache/` (git-ignored) | W04, W05, W10, W12, W13; P23 | Yes, inside the project | RB-17 | Written only |
| H-18 | Vite and Metro processes of a live check | Started by the row; Metro by `device-session.sh` | client rows | No | The row stops the PIDs it recorded; `device-session.sh` stops its own Metro | Every live check |

Not changed by any row: the shell profile, launchd, Docker or Colima, the macOS firewall, another project's processes or ports, `release/`, the emulators' images and data partitions, the AVD configuration [AN:728]. If macOS shows a firewall prompt for a loopback bind, the row stops and reports (U4).

### 14.3 Rollback commands, verbatim

Run from the workspace root. None of them was executed by this row. They are run only on the controller's or the user's instruction.

```sh
# Variables
ROOT=/Users/gsp-budi/Documents/DEMS
PGBIN="$ROOT/node_modules/@embedded-postgres/darwin-arm64/native/bin"
PGDATA="$ROOT/.data/postgres"

# RB-01  remove the PostgreSQL binary package and the root driver (after RB-02)
/usr/bin/lockf -k -t 3600 "$ROOT/.locks/npm.lock" npm uninstall embedded-postgres pg
npm install-scripts prune            # drops the allowScripts entry of the binary package
# RB-02 followed by RB-01 is what "npm run pg:remove" runs.

# RB-02  remove the cluster, the credentials and the log   (= npm run pg:remove-data)
"$PGBIN/pg_ctl" -D "$PGDATA" -m fast -w stop      # ignore "no server running"
rm -rf "$ROOT/.data"

# RB-03  stop the PostgreSQL process                        (= npm run pg:stop)
"$PGBIN/pg_ctl" -D "$PGDATA" -m fast -w stop
lsof -nP -iTCP:4432 -sTCP:LISTEN                  # expect no output

# RB-04  stop Core server processes this task started
kill "$(cat "$ROOT/.locks/core-server.pid")"
kill "$(cat "$ROOT/.locks/core-server.lane1.pid")"    # likewise lane2, lane3
lsof -nP -iTCP:4420-4423 -sTCP:LISTEN             # expect no output

# RB-05  remove this task's reverse rule (one emulator)
adb -s emulator-5554 reverse --remove tcp:4420    # likewise emulator-5556, emulator-5558

# RB-06  put the predecessor's debug build back on one emulator
adb -s emulator-5554 install -r "$ROOT/.cache/apk-backup/app-debug.apk"

# RB-07  remove the stored device credential and tokens
#   In the portal: Paired Devices -> Revoke.  In the app: Settings -> Pairing -> Unpair.
#   Clearing the app's data ("adb shell pm clear com.dems.demo.tablet") is NOT used without a recorded controller decision.

# RB-08  browser state
#   Sign out. Then, in the developer console of each origin used (http://127.0.0.1:5173, :5176, :5177, :5178):
#   localStorage.removeItem('dems.core.mode.v1')
#   and clear the cookies of host 127.0.0.1 in the browser's site settings.

# RB-11  lock, PID and log files this task created
rm -f "$ROOT"/.locks/postgres.pid "$ROOT"/.locks/postgres.lock "$ROOT"/.locks/db-migrate.lock "$ROOT"/.locks/contract.lock \
      "$ROOT"/.locks/core-server*.pid "$ROOT"/.locks/core-server*.lock "$ROOT"/.locks/core-server*.log

# RB-12  fallback route only: remove the Homebrew keg [AN:315-324]
/opt/homebrew/opt/postgresql@18/bin/pg_ctl -D "$PGDATA" -m fast -w stop; rm -rf "$ROOT/.data"
brew uninstall postgresql@18
rm -rf /opt/homebrew/var/postgresql@18 /opt/homebrew/var/log/postgresql@18.log
brew uninstall krb5                  # only if this task installed it and nothing else uses it
brew cleanup --prune-prefix          # "brew autoremove" is not used: it would remove other formulae

# RB-14  emulators (the user's action, never an agent's): close each emulator window

# RB-15  return one database to the seed state; the databases themselves go with RB-02
npm run db:reset -- --database dems_demo          # as dems_owner; likewise dems_lane_1, dems_lane_2, dems_lane_3

# RB-16  recreate the two markers
mkdir -p "$ROOT/.locks/mock-core.users" "$ROOT/.locks/vite.users"
touch "$ROOT/.locks/mock-core.users/user-manual-test" "$ROOT/.locks/vite.users/user-manual-test"

# RB-17  scratch folders (keep .cache/apk-backup until the task has ended)
rm -rf "$ROOT"/.cache/proof-engine "$ROOT"/.cache/proof-harness "$ROOT"/.cache/proof-drizzle "$ROOT"/.cache/rollback
```

Tracked-source rollback is not a host change: `git checkout acaff20 -- <path>` for a path with one writer, the pre-image of P23 for a path with several, and for the whole task `git checkout acaff20 -- .gitignore package.json package-lock.json packages apps/core-web apps/mobile README.md THIRD_PARTY_NOTICES.md`, removal of the new folders `apps/core-server` and `scripts/pg`, then one `npm install` under the npm lock. It is run only on an explicit request [BP:616]. From W104 on, the two checkpoint commits are further rollback points: `git checkout <checkpoint> -- <path>` for one path, `git reset --soft HEAD~1` to take a checkpoint commit back (local only; no remote exists).

---

## 15. PostgreSQL on a demo PC

This section answers impact question 5. The answer is the decision record's cost study, restated so that the plan is complete; nothing is built.

| Point | Statement | Source |
|---|---|---|
| Decision | **No live package for another PC is built in this task.** The 0.1.0 packages stay the offline edition; Live mode runs on this development host only | [DEC:D11 TD-13, D8 MJ-4]; [SP:§10.4] |
| The four targets | macOS arm64, macOS x64, Windows x64, Linux x64, as the 0.1.0 web packages [cmd: `find release`] | [AN:498] |
| A path without Docker and without an administrator install | Exists on paper for all four: the platform packages of `embedded-postgres` (59 to 148 MB unpacked), or the `theseus-rs` archives (12 to 54 MB compressed, PostgreSQL License). The Homebrew route cannot serve it (no Windows bottle) | [AN:498-499] |
| What a live package would need | A bundled server build (today it runs from source through `tsx`); the binaries beside the launcher with their library links recreated; a first-run `initdb` into a user-writable folder with a generated password and a free-port search; supervision of two processes; licence texts; the console served from the server's origin with an extended packaged CSP; platform trust (quarantine, signing) | [AN:500] |
| What is unproven | Execution on any target; three of the four cannot be exercised on this host (no Rosetta) | [AN:500, 502] |
| What it would not give | A mobile live edition: the release APK allows no cleartext traffic and has no configurable address; that is the user's call (U4) | [AN:501]; [SP:§10.3] |
| What this plan does that keeps the option open | The server version is 0.2.0 and private; nothing under `release/` or `scripts/release/` is written; the Live code is unreachable in a packaged build [CS:MD-6]; `README.md` (W86) states that Live mode is a development-host mode | [SP:§10.2] |
| Follow-up | A separate task after SC1 to SC11 pass, starting with a macOS arm64 trial | [AN:503] |

---

## 16. Changing the shared contract without collisions

This section answers impact question 22.

| ID | Rule | Why |
|---|---|---|
| CO-1 | **One source.** The zod registry in `packages/shared/src/api/` is the only definition of an operation, its schemas, its access rule and its audit rule. `openapi.json` is an output of the repository's own builder. No generated client and no second schema set exists [DEC:D11 TD-09] | Nothing has to be regenerated by a row that only reads the contract; the typed client and the fake transport are generic over the registry |
| CO-2 | **One owner at a time**, as a dependency chain: W16 (vocabulary) → W19 (contract A) → W22 (contract B) → W27 (contract C) → W83 (close-out). The owner writes `packages/shared/src/api/`, `packages/shared/openapi/`, `packages/shared/scripts/gen-openapi.ts`, the three pinned shared tests and its own `api-*` tests | P17 [BP:463-465] |
| CO-3 | **Every step leaves the tree green.** After W19 the registry has 37 operations (the 10 existing ones and the 27 of areas 1, 2, 3 and 13, [SP:§17.5]); after W22 the same 37 plus the slice schemas and the message union; after W27 75. Each step regenerates `openapi.json` and passes `gen-openapi.ts --check` and the drift test. The absolute pins (75 operations, 27 GET, 48 POST, two security schemes) are asserted from W27 on. Revision 2 keeps the count at 75 [DEC:D18] and adds one item to each step: the text rule API-13 (W19), `TOKEN_REUSE` in `session.ended.reason` (W22), `lineage` in `AuditChainStatus` (W27) | [SP:AC-B-09, AC-B-11, AC-B-93] |
| CO-4 | **The offline scope keeps today's ten.** The builder's default call returns the ten operations a client can use without the Core server, so the web test `scalar-config.test.ts:70` and the API Reference page stay as they are until W84 changes the page | [CS:AR-1, GC-01]; [DEC:F24] |
| CO-5 | **Everyone else reads.** A row that needs a contract change logs `CONTRACT-GAP-<n>` and uses a local adapter inside its own folder, or returns `needs-review`. The controller either waits for W83 or schedules one extra contract slot under `.locks/contract.lock` | P12 [BP:448-449] |
| CO-6 | **The vocabulary comes first and needs no migration.** Permissions, audit types and event types are checked by format in the database, so W16's additive values do not touch W17 | [DB:MG-11] |
| CO-7 | **The order serves the consumers.** Contract A unblocks identity, RBAC, pairing and the demo module; contract B the realtime channel, the socket client, the fake transport and the Live source; contract C the domain modules. The typed client (W12) and the light Live API (W18) need no contract row at all | section 9 |
| CO-8 | **Checks that catch a collision or a drift**: the byte-equality drift test of `openapi.json`; `--check`; the conformance test W52 (every route in the registry, every registry operation registered, every response valid); the callable-operation count of the typed client (AC-C-01); the checkpoint W46 (`git diff` over `packages/shared/src/sim`) | [AN:436] |
| CO-9 | If fallback Fe is ever taken, the generator's output becomes a contract-slot artefact: the four contract rows regenerate it and a drift test guards it | section 8.6 |

---

## 17. Known issues touched (KI-01, KI-02, KI-07, KI-18)

This section answers impact question 25. The issue texts are the predecessor's (`docs/2026-09-30_dems_demo_stack_setup/verification/01_verification.md:158, 159, 169, 190`).

| Issue | State at `acaff20` | Touched by | Rule: it must not get worse | How that is verified | State after this task |
|---|---|---|---|---|---|
| **KI-01** Tablet captures and re-checks never ran; among them the Pair screen's tablet layout | Open (deferred) | W57 changes the Pair screen's texts and notices in Live mode; W82 adds a third segment to a Settings control; W66 changes two chips | A Live text must not clip or overflow a pane that fits today; no Simulated layout changes [CS:MD-9, GC-12, GC-13] | W57's device check on the tablet AVD in portrait and landscape (lane 2); W82's device check on the narrow phone. If DP-1 leaves the tablet without the debug build, the tablet check cannot run and KI-01 stays as it is, recorded | The Pair screen's tablet layout is checked on a device for the first time, if the tablet holds the debug build. The other tablet items of KI-01 stay open: they are not in this task's scope |
| **KI-02** No Maestro flows; `apps/mobile/package.json:13` points at a missing folder | Open (deferred) | W13 edits the same manifest (one dependency and the `reverse` script) | The `e2e` script line is not changed, and no row claims a scripted end-to-end run | `git diff acaff20 -- apps/mobile/package.json` in W13's log shows only the dependency and the `reverse` line; W06 records whether the Maestro CLI starts outside the sandbox [DEC:F19] | Open. SC3 to SC5 are proven by W94 to W96 with captures and audit rows. Maestro flows for sign-in and pairing stay a follow-up [BP:687] |
| **KI-07** The mobile app carries 13 `SIM-GAP` IDs (68 markers); some are missing role checks in the simulator | Open (post-demo) | The mobile screen rows W66 to W82 edit files that hold markers | No row adds a `SIM-GAP` marker to mobile code, and no row writes `packages/shared/src/sim/` beyond W16 (a simulator gap is `needs-review`, [BP:452]) | W97 runs `grep -rhoE "SIM-GAP-M[0-9]+-[0-9]+" apps/mobile/src \| sort \| uniq -c` and reports at most 13 IDs and 68 markers | Open in Simulated mode. In Live mode the gaps that were missing permission checks no longer matter: the server decides (for example `recoverSession` needs `SESSION_START`, [SP:§7.8]) |
| **KI-18** The description in `packages/shared/src/api/core-api.ts:427` is stale; the wording repeats in eight places, `openapi.json` among them [DEC:F5] | Open (post-demo) | W19 rewrites the registry around it; W83 corrects it | W19 does not copy the stale sentence into a new entry; the eight places are corrected in one pass by the contract owner, not piecemeal | W83's verification quotes the diff of the eight places [AN:762] | **Closed** by W83 |

Related, not in the row text but touched: **KI-21** (`expo prebuild` wipes `android/`): W13 copies the debug APK to `.cache/apk-backup/` first. **KI-26** (the Mac must stay awake): the user's part, repeated in section 22. **KI-28** (design-book extracts are tracked locally): W103 never stages the design book.

---

## 18. Size, and what is DEFERRABLE

**Size.** 105 work rows against 96 provisional ones: 68 for coder-execution, 37 for the other agents (section 9). The splits and the new early rows add more rows than the merges and the skipped row remove (section 21). The accepted security corrections and rulings changed 54 existing rows and added no row of their own; the two rows that revision 2 adds are the checkpoint commits.

**Never cut**: server-side RBAC enforcement (W23, W24, W28, W33, W47); pairing (W32, W48, W57, W60, W81's issue, list and revoke); PostgreSQL persistence (W07, W17, W20, W21, W26, W53, W90); the three end-to-end rows (W94, W95, W96); the gates (W58, W89); the regression row (W97); the security reviews (W45, W99, W100).

Nothing below is cut by default [DEC:D17]. Each item is cut only by a recorded controller decision, with its consequence reported to the user.

| ID | DEFERRABLE item | Rows affected | What is done instead | Consequence |
|---|---|---|---|---|
| DF-1 | The bulk fixture at full volume | W25 reduced; W39, W47, W52 run on the seed template | A fixture of audit rows, events and evidence only, or none | Paging beyond one page, index use on volume and chain verification over thousands of rows are not proven; the minimums of [DB:§11] are not met; W98's list pass is dropped |
| DF-2 | The performance measurements | W98 reduced | One check that a 60 s recording writes zero meter-frame rows, and one screen recording of the meters on each client | SA-06, GD-03 and GS-11 stay unmeasured; I8 is reported as observed, not measured |
| DF-3 | Reset and scenario load from inside the running server | W43 reduced: operations 72 and 75 answer `DEMO_DISABLED`; faults and status stay. `db:reset` on the command line stays (the lanes need it) | A presenter resets with the server stopped | AC-B-57 loses its reset clause; the web and mobile "reset" buttons are hidden in Live mode. Side effect: the server would never open `.data/pg.owner.env`. SD-01 is answered by the owner role in any case [DEC:D16], so DF-3 is a time-saving option only |
| DF-4 | Biometric unlock on the mobile client in Live mode | W56 and W82 without the biometric parts; the fingerprint button is hidden in LIVE mode. W41 stays, because the matrix test needs all 75 operations registered | Password sign-in only on a paired device | AC-C-68 to AC-C-71 are not met; the mobile half of Q11 is not shown in Live mode (a drift entry) |
| DF-5 | The QR tile | W14 dropped; W81 shows the digits only | Code entry by hand, which is the only input on the device anyway [DEC:DR-02] | "Also shown as a QR" (Q8) is not met (a drift entry); AC-C-92 holds for the digits and the countdown only |
| DF-6 | Two extras of the API Reference page: the "Show Core-server endpoints" switch in Simulated mode, and the Realtime panel in Live mode | W84 reduced | Simulated mode shows ten operations as today; Live mode shows 75 as `LIVE` | AC-C-100 is met for Live mode and for today's Simulated view, not for the Simulated listing of the other 65; SC6 still holds |
| DF-7 | Device checks of the mobile folders that change no production file (Network & Time, Finalization, Sessions hub) | W72, W79 | jest only | Three fewer device captures |
| DF-8 | The tablet layout check of the Pair screen | W57 | A phone check only | KI-01 stays fully open |

---

## 19. Risks and blockers

Risks of the design are in the registers of the specifications [AN:§9]; [SP:§18]; [DB:§13.2]; [CS:§16]. This table holds the risks of executing the plan.

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| PR-01 | An early proof fails | Medium | One fallback row, one extra npm slot, a drift entry | Section 6: every proof has a time box and a named fallback; nothing wide depends on it before it passes |
| PR-02 | No emulator, or only one, holds the debug build | Medium | Fewer device lanes; a weaker "fresh app" state for SC5 | W06 measures it; DP-1 and DP-3 with defaults; the table of section 5.5 |
| PR-03 | Host overload with three lanes, PostgreSQL, emulators and six agents | Medium | Test timeouts | Section 5.4; two workers; gates run without lane backends |
| PR-04 | The contract chain (three serial rows) delays the backend | Medium | Idle slots in B2 to B4 | Contract A is first and unblocks identity; W18, W20, W21, W23, W25, W26 need no contract row or only A |
| PR-05 | **Closed.** The security findings are accepted and in the specifications [DEC:D16, D18]; 54 existing rows changed (section 7.2) | — | The longest rows are W07, W08, W17, W23, W24, W28 and W42 | If one of them does not fit one agent context, the controller splits it with a number from W106 to W109 |
| PR-06 | The decorator seam of P25 is not enough | Low to medium | A row needs to edit `app.ts` | `needs-review`; one serial scaffold slot |
| PR-07 | A lane emulator loses its credential (a reinstall, [CS:MP-4]) | Low | One more pairing on that lane | The next device check pairs again; the code is never written down |
| PR-08 | An agent writes outside its paths | Low to medium | A silent collision | P6; the pre-image of P23; the checkpoints W38, W46, W61, W62; the ownership check of W93 |
| PR-09 | N1 moves a transitive dependency of an existing workspace | Low | A changed lockfile entry that the release inputs pin | W03 quotes the lockfile diff; `save-exact` (`.npmrc`); `npm ls react react-dom --all` |
| PR-10 | Six rows run `test:db` at once | Medium | Slow clones | Clones are serialised by the advisory lock [DB:TI-7]; a pool of at most five connections per app [DB:TI-14] |
| PR-11 | The Mac sleeps during a long run (KI-26) | Medium | Hours lost | The user keeps it awake with the lid open [BP:598] |
| PR-12 | Many sandbox-bypass prompts | High | A slower run | Live checks are batched per row; the user may set `sandbox.network.allowLocalBinding` [BP:686] |
| PR-13 | W90 removes the lane databases, so every lane pairing is gone | Certain | None by then | The client waves are over; W94 to W96 use the reserved emulator; W97 creates lane 3 again with `db:reset` |
| PR-14 | The matrix test, or a live check with many refusals, runs into the denial budget and reads 429 [DEC:F25] | Medium | False failures | W47 advances the clock or resets the counter; lanes have their own counters; a row waits out the 60 s window (section 7.2) |
| PR-15 | **Closed.** The database contract was patched (revision 2.1, 05:25) while this revision was written; the plan was re-read against it | — | None | W17 and W07 follow revision 2.1 |
| PR-16 | A checkpoint commit captures half-finished work of a row in flight | Low to medium | A commit that does not build | W104 and W105 stage by explicit path, only rows marked complete, and leave out any path with a writer in flight (section 8.5a) |
| PR-17 | A console opened at `localhost` cannot sign in in Live mode [CS:GC-19] | Medium | A check reported as a server defect | Section 5.3 and the README name `127.0.0.1`; the console record names the cause |

| Blocker | Solution |
|---|---|
| No PostgreSQL on the host [DEC:F1] | W03 and W07; fallback Fb |
| The emulators are not running [DEC:F2] | W02 boots them cold; they are never booted from a snapshot |
| An emulator holds the release-signed build | DP-1: default A; B only by a recorded decision |
| The emulators' builds are unknown until W06 | DP-1 is decided (A); its outcome is recorded after W06 |
| `@types/pg` has no version in the research (GP-01) | W03 resolves it with `--save-exact` and records it [DEC:D17] |
| Registry lookups fail inside the sandbox [DEC:F10]; this row's lookup ended with E502 | The npm rows run with the per-command sandbox bypass (P10) |

---

## 20. Verification approach and rollback considerations

**Verification approach.** Unit, integration, acceptance, gate, live-check, end-to-end, regression, security and performance expectations are the layers T0 to T10 of section 12; the commands and the counting rule are section 11; each row's own verification is its cell in section 8. A row is not done until its verification has been run and its output is quoted in its log (CLAUDE.md §4); a failed verification returns to the same agent [BP:583].

**Rollback considerations.**

| What | Rollback | Granularity | Note |
|---|---|---|---|
| Documents | The docs commit of row 22 | The whole masterplan | Before row 22 the files are untracked |
| Code of one row | The row's class in section 8.1 (R-NEW, R-CO, R-PRE) | One row | Only on the controller's instruction. P23 makes it exact for the multi-writer paths and, in revision 2, compares against `acaff20` so that it survives a checkpoint commit |
| Code of the whole task | Section 14.3, last paragraph | The task | Only on an explicit request from the user [BP:616] |
| The host | Section 14.3 | Per change | RB-02 and RB-03 are proven by W90; RB-01, RB-06, RB-12 are written only |
| A database | `db:reset` (seed state), or RB-02 (remove) | Per database | A reset keeps sessions and paired devices [DB:§8.5] |
| The schema | Before W17's gate the migration folder may be regenerated; after it, forward migrations only | | [DB:MG-4] |
| An emulator's app | RB-06 | Per emulator | The backup is taken by W13 before the prebuild |
| A checkpoint commit (W104, W105) or the final commit (W103) | `git reset --soft HEAD~1` | Local only | No remote exists [DEC:D1]. A checkpoint is also a rollback point for one path: `git checkout <checkpoint> -- <path>` |
| Leaving Live mode during a demo | Switch the mode to Simulated in the client | Per client | Simulated mode needs no server and stays the default [AN:ADQ-7] |

---

## 21. Blueprint delta for row 21

Actions: **KEEP** (same scope, new number), **SPLIT**, **MERGE**, **MOVE** (other position), **ADD**, **SKIPPED**. Agent, write paths, dependencies, wave and tier of each row are those of section 8.

| Provisional rows | Work rows | Action | Note |
|---|---|---|---|
| — | W01 | ADD | The D10 fix slot [DEC:D10] |
| — | W02 | ADD | Emulator cold boot; row 24 said "without booting" [BP:297] |
| 23 | W03 (npm part), W07 | SPLIT | The install joins npm slot N1 |
| 24 | W06 | MOVE | Before provisioning, so that it probes port 4432 first [DEC:D11]; since revision 2.1 the order is enforced, W07 depends on W06 [CC:C-09]; its "PostgreSQL per row 23" check is the trial of W07 |
| 25 | W03 (manifest), W08 | SPLIT | Rev 2.1: W09 is no longer listed here. Row 25 was the backend scaffold; the hash wrapper HB-4 is the "password-hash verification" of row 32 in `modules/identity/`, as the "Prov." cell of W09 says |
| 26 | W16 | KEEP | Write paths gain `sim/auth.ts` and `i18n/en/common.ts` [DEC:F22] |
| 27 | W19, W22, W27 | SPLIT | GS-15 [SP:§18] |
| 28 | W10 (proof), W11 (HB-12), W17 | SPLIT | [DEC:F23] |
| 29 | W20 | KEEP | Gains the mapping module (half of HB-13) |
| 30 | W25 | KEEP | DEFERRABLE (reduced) |
| 31 | W21 | KEEP | |
| 32 | W09, W23, W24, W41 | SPLIT | Hash wrapper, request guards, identity core, biometric token |
| 33 | W28 (and W23 for the Origin guard) | KEEP | Gains the matrix read (operation 10) |
| 34 | W38 | KEEP | |
| 35, 36 | W33, W32 | KEEP | |
| 37 | W04 (proof), W26 | SPLIT | |
| 38 | W42 | KEEP | |
| 39, 40, 42, 45 | W34, W35, W36, W39 | KEEP | |
| **41** | — | **SKIPPED** | Media is not served by the server [DEC:D13]; [SP:MS-4]. `@fastify/static` is not installed |
| 43, 44 | W37 | MERGE | Five operations |
| 46, 47 | W40 | MERGE | Seven operations |
| 48 | W29 (reset routine, database-specialist), W43 (module) | SPLIT | The lanes need `db:reset` before the module exists |
| 49 | W08 | MERGE | The health operation is part of the scaffold |
| 50, 51, 52, 53, 54, 55, 56 | W45, W47, W52, W48, W49, W53, W58 | KEEP | |
| 57 | W03 (shared export subpaths), W14 (web) | SPLIT | Three npm slots in all |
| 58 | W12 | MOVE | Early: it needs only the registry as it stands |
| 59 | W30 | KEEP | |
| 60 | W18 (HB-15), W31 (HB-11), W44 (HB-14) | SPLIT | |
| 61 | W46 | KEEP | |
| 62 | W05 (proxy), W50 (runtime and mode), W54 (admin routes) | SPLIT | [CS:§17.4 Row 21 #1] |
| 63, 64, 65 | W54, W55, W61 | KEEP | |
| 66 to 70, 73 to 76 | W63, W64, W65, W69, W70, W75, W76, W77, W81 | KEEP | Row 76's check is "the QR component receives the issued payload" [CS:§17.4 Row 21 #2] |
| 71, 72 | W71 | MERGE | Row 72 changes no production file |
| 77 | W13 | KEEP | Gains `device-session.sh`; **`app.json` is not written** (no config plugin, [CS:WT-7]) |
| 78 | W15 (secure-store wrapper), W51 | SPLIT | W51 gains `features/home/use-health.ts` [DEC:F24] |
| 79 | W15 (the AVD probe of the protected item: MB-8, CA-06, CA-07, AC-C-71), W56 | SPLIT | Rev 2.1: W15 added, as its "Prov." cell says. The probe moved early as proof (g); W56 builds the rest of row 79 and uses the case W15 recorded |
| 80, 82, 83 | W59, W60, W62 | KEEP | |
| 81 | W57 | KEEP | `src/app/pair.tsx` is not written: route files do not change [CS:§7.4] |
| 84, 85 | W66 | MERGE | Display-only changes |
| 86, 87, 90, 92, 93, 96, 97 | W67, W68, W73, W74, W78, W80, W82 | KEEP | |
| 88, 89, 91 | W72 | MERGE | Rows 88 and 91 change no production file |
| 94, 95 | W79 | MERGE | Row 95 changes no production file |
| 98 to 105 | W83 to W90 | KEEP | W85 lists direct dependencies (section 23.1, item 13); W89 runs first without PostgreSQL |
| 106, 107, 108 | W95, W96, W94 | MOVE | The order is SC5, SC3, SC4 (DP-3) |
| 109 to 118 | W97, W98, W99, W100, W91, W92, W93, W101, W102, W103 | KEEP | |
| — | W104, W105 | ADD | The two checkpoint commits of D17 (section 8.5a) |
| — | W106 to W109 | reserved | Section 7.1 |
| Rows 20a, 20b (controller rows of the correction slot) | none | Done before row 21 | They were S1 and S2 of revision 1; this revision is S3 |
| — | Fb, Fc, Fd, Fe, Ff, Fh | ADD (conditional) | Section 8.6 |

The script of section 10.3 confirms that every provisional row from 23 to 118 except 41 is named by at least one work row [cmd]. **Rev 2.1:** this table and the "Prov." column of section 8 name the same work rows for each of these 95 provisional rows [cmd]. Revision 2 differed in two: row 25 (this table also named W09) and row 79 (this table did not name W15). In both the "Prov." column was right and this table was corrected; the reasons are in the two notes above and in section 23.3.

---

## 22. Next steps

1. Controller: read the revision history at the top; record the decisions of section 23.3 (revision 2.1; those of section 23.2 are recorded as D20). No conflict is open.
2. Row 19 (consistency check) is done: PASS-WITH-NOTES [DEC:D21]. Its findings for this file are applied in revision 2.1; the owners of the three specification files apply theirs. Where those files cite provisional rows 25 and 79, the mapping is the one of section 21 as corrected (section 23.3, item 7).
3. Row 21: replace provisional rows 23 to 118 by section 21, with the protocol changes of section 4.4. Row 22: the docs commit.
4. Wave E1: W01, W02, W03, W04, W05 in one message.
5. After W06: record which emulators hold the debug build (the outcome of DP-1). Before W94: record DP-3.
6. W104 right after the backend gate W58; W105 right after the last web row.
7. User: keep the Mac awake with the lid open during long runs (KI-26); consider `sandbox.network.allowLocalBinding`.

---

## 23. Decisions for the controller to record

### 23.1 The items of revision 1 and how they were ruled

| # of revision 1 | Item | Ruling |
|--:|---|---|
| 1 | W01 to W103 replace provisional rows 23 to 118; row 41 SKIPPED | Accepted [DEC:D17]. Revision 2: 105 rows |
| 2, 3, 5, 6, 7, 8, 9, 11, 15 | Three npm slots; seven early proofs; the environment check before provisioning; the refinements of D12; the pinned names; the protocol changes; the lanes; the end-to-end order; the gate rule | Accepted [DEC:D17] |
| 4 | W01 edits two of the 61 simulator-dependent test files | Accepted [DEC:D17] |
| 10 | DP-1, DP-2, DP-3 | DP-1 decided: A [DEC:D17]. DP-2 decided: DEPARTURE-6 with its conditions [DEC:D16]. DP-3: default A stands |
| 12 | The package-removal rollback | Written, not executed [DEC:D17] |
| 13 | `THIRD_PARTY_NOTICES.md`: one appended section for the direct new dependencies and the PostgreSQL License text | Accepted [DEC:D17] |
| 14 | `@types/pg` | Pinned at install time by W03 [DEC:D17] |
| 16 | The DEFERRABLE list | Nothing is cut by default [DEC:D17] |
| 17 | A checkpoint commit | **Added, and two of them** [DEC:D17]: W104 and W105 |
| 18 | A lane helper script | Not added [DEC:D17] |
| 19 | Gate G-SEC | Met [DEC:D16, D18] |
| 20 | The release-gate test file; `app.json`; `pair.tsx` | The file stays unchanged and the Live cases go into a new file [DEC:D17]; the two paths are not written |
| 22, 23, 24 | The security findings; the four points left to the controller; the matrix test | All findings accepted; three roles; the lineage as a table; `@fastify/helmet` in npm slot N1; condition C4; no cookie `Max-Age` [DEC:D16, D17, D18]; the matrix test rule is F25 |

### 23.2 New in revision 2

| # | Decision | Section |
|--:|---|---|
| 1 | Plan revision 2: 105 work rows. W104 and W105 (checkpoint commits, git-specialist, tier D) take two of the reserved numbers; W106 to W109 stay reserved; no existing W-number changed | 8.5a; 9 |
| 2 | Where the superuser trigger check runs was open when this revision started and is **decided by D19**: provisioning trial step T5-j on a scratch table, run by W07; the real triggers are proven in the catalog by W17 and by boot check B-5; nothing connects as `dems_admin` after W07. Nothing is left to rule | 7.3 |
| 3 | Three dependencies were added, none moves a wave: W28 on W23, W39 on W29, W103 on W105 (and W105 on W104) | 8; 9 |
| 4 | W28 is the row that proves pipeline stages 3 to 6 together: the HTTP decision table, the denial budget for one operator, the throttle bucket for unknown bearer values | 8.3 |
| 5 | W08 owns one more path, `apps/core-server/test/static/**`: static guard tests that run in every gate from wave E2 on | 8.2; 11.1 |
| 6 | The serial unit-of-work queue that SR-72 needs is built by W21 in `src/core/` and reached through the decorator `pipeline`; the engine host W26 runs its commands on the same queue. So the identity row does not wait for the engine host. The specification names the queue "the engine pipeline" [SP:§2.3 stage 8]; the folder `core/` is already part of HB-13 [SP:§2.2] | 4.4; 8.3 |
| 7 | P23 now compares against `acaff20`. A checkpoint commit stages only the paths of completed rows, leaves out any path with a writer still in flight, and names what it left out | 4.4; 8.5a |
| 8 | Names: each connection file has five keys; `DEMS_PG_DATABASE` is a default that the port rule and `--database` override; the owner-role file is `.data/pg.owner.env`. This closes note N-1 of the database contract | 3.4 |
| 9 | W17 builds the SELECT-only grant of D18 on `audit_chain_history`. The database contract says the same since its revision 2.1 (05:25); this plan was checked against that text | 1.9 (GP-09) |
| 10 | The denial budget during the run: the matrix test stays inside it; each lane has its own counters; a row waits out a 429 window instead of reporting it as a defect | 7.2; 5.3 |
| 11 | Results of the mechanical check in revision 2: 105 rows; 0 write-path overlaps between rows without a dependency path; no wave above 6 of one type or 8 in flight; AC-B 93 of 93, AC-C 110 of 110, SR 82 of 82 | 10.3; 13 |
| 12 | With DF-3 (no reset from inside the server) the server would never open `.data/pg.owner.env`. It stays a time-saving option; it is not needed for SD-01, which the owner role answers | 18 |
| 13 | Findings for the record: (a) [SP:AC-B-91] names the provisional rows 23, 25, 57 and 77 for the supply-chain records; in this plan they are W03, W07, W13 and W14. (b) The loader test T-CR-4 is split: the scripts' loader in W07, the server's loader in W08. (c) The Host Impact Register gains nothing but the third credential file inside `.data/` | 8.2; 14.2 |

### 23.3 New in revision 2.1 (after the consistency check, [DEC:D21])

| # | Decision | Section |
|--:|---|---|
| 1 | **C-02.** `apps/core-web/src/features/storage/__tests__/storage-page.test.tsx` is a declared multi-writer path (W01, then W71). W71's rollback is "R-CO; R-PRE (`storage-page.test.tsx`)", so it restores W01's fix. "W01's state" is defined once: W01's log records `git hash-object` of its two files, and CLG (a), W71, W84 and L-6 compare with that record instead of `acaff20` | 4.3; 8.1; 8.2; 8.4; 8.5; 11.3 |
| 2 | **C-02, the other file.** `apps/core-web/src/test/sim-fetch.test.ts` has no later writer and no rollback touches it. It is an API Reference test, so the verification of W84 names it as the one existing test that differs from `acaff20`. For the blueprint: the log of step 23 (W01) records the two `git hash-object` values | 4.3; 8.5 |
| 3 | **C-08.** Section 8.7 names one output document for each of the 105 rows; the names are the blueprint's "Expected Output" column, and the blueprint's name wins if the two ever differ. A fallback row gets `implementation/<next free number>_fallback_<id>.md` (proposal) | 8.1; 8.7 |
| 4 | **C-09: the option chosen is the dependency.** W07 depends on W03 and W06. No wave moves: both rows stay in E2 and W07 starts after W06, as W86 follows W84. Reasons: revision 1 put the environment check before provisioning so that it probes port 4432 first, and D17 accepted that revision as a whole; the blueprint's step 29 already depends on step 28. W07's own `lsof` probe stays and is now part of its verification. Cost: provisioning waits for W02 and W06 (not measured). If W02 ends `blocked`, the controller starts W06 on that state, so the emulators cannot hold up the backend | 4.2; 8.2; 9; 21 |
| 5 | **C-10.** The nine pairs now cite the finding and a criterion: W10 and W25 (SD-01, SR-68), W24 (SD-02, SR-69; SD-12, SR-75), W50 and W54 (SD-03, AC-C-110), W08 (SD-06, SR-52), W45 and W99 (SD-29, with the sentence on `DEVICE_CREDENTIAL_ROTATED`). The coverage tables name these rows; the totals stay 93 of 93, 110 of 110, 82 of 82 | 7.2; 8; 13 |
| 6 | **C-13.** The shell variable of `device-session.sh` is `DEMS_CORE_HOST_PORT`; the shared constant keeps `CORE_SERVER_PORT`. The client specification still shows the proposed name in [CS:§9.6], in AC-C-84 and in its lists for row 18; this plan's name binds for W13, and the owner of that file may align the text | 3.4; 5.2; 5.3; 8.2 |
| 7 | **Section 21 and the "Prov." column agree** (controller addition). In both differences the "Prov." column was right and section 21 changed. Provisional row 25 is W03 (manifest) and W08; W09 was removed there, because the hash wrapper is part of row 32 only (row 25 of blueprint rev 1 is the scaffold; row 32 names "password-hash verification" in `modules/identity/`). Provisional row 79 is W15 and W56; W15 was added, because it makes the AVD observations that the client specification gives to row 79 (MB-8, CA-06, CA-07, AC-C-71). The specifications cite the earlier mapping and need the same correction: "(W03, W08, W09)" for row 25 and "(W56)" for row 79 | 21 |
| 8 | Result of the mechanical check in revision 2.1: see section 10.3. No W-number, wave, agent or write path changed; one dependency was added (W07 on W06) | 10.3 |

---
*Generated: 2026-10-04 04:20 (revision 1)*
*Last Updated: 2026-10-04 05:30 (revision 2); 2026-10-04 06:12 (revision 2.1)*
