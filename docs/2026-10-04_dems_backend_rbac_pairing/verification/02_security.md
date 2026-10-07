---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
row: W99 (plan step 111)
date: 2026-10-07
agent: security-review (tier R), read-only
source_plan: docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md (row W99, line 778)
tree: HEAD 057fc17 plus the uncommitted working tree (316 tracked files changed, +6,283 / -2,002; 489 untracked entries, 374 of them under docs/)
status: complete
verdict: CAUTION
---

# W99: security review of the backend, the database, the secrets and the host changes

## Verdict

**CAUTION. No FAIL, no blocker. Findings: 0 Critical, 0 High, 1 Medium, 3 Low, 9 Info.**

| Count | Meaning |
|---|---|
| 0 FAIL | No requirement of SR-01 to SR-82 is unmet in the server. No secret is in any tracked file, in the uncommitted diff, in the commit history, in the evidence logs or in the runtime logs |
| 1 Medium (W99-1) | `npm audit` now reports **99 high and 0 critical** for the whole tree (96 high and 0 critical with `--omit=dev`). At the backend gate it was 50 high (D146). The lockfile has not changed since `b90a3c6`, so the extra entries are new advisories. **None of them is on the Core server's runtime path.** The triage of F29 and D146 F-3 is still open |
| 3 Low (W99-2 to W99-4) | Availability and audit gaps that the plan already accepts for a demo on one loopback computer: the shared class bucket (F76), the socket cap per session and the request rate on paths the router cannot decode (F79 (2) and (3)), and the `DEVICE_CREDENTIAL_REQUIRED` refusal, which writes no audit row (D118 FU-4) |
| 9 Info | Listed in section 9. None needs a change before W101 |

The DEMS backend meets its security specification. Every listener is on loopback. The three database roles are separated as the contract says, and the two audit tables are append-only for every role. The three credential files have mode 600 inside a 700 directory, are git-ignored, and have zero copies anywhere in the work tree or in git history. Every one of the 75 operations has its access rule compiled from the registry. The logs hold no credential, body or query string. The CAUTION covers dependency advisories outside the server's runtime chain and availability limits that the boundary accepts. W101 can take it as an acknowledged CAUTION.

---

## 1. Tier 1 frame

### 1.1 Subject
This is the final security review of the DEMS Core server (`apps/core-server`) and the systems it rests on:
- the contract it serves (`packages/shared/src/api`);
- the project-local PostgreSQL 18.4 (`scripts/pg`, `.data/`);
- the credential files and the `.gitignore` that keeps them out of git;
- every host change the task made;
- every change in the working tree since checkpoint commit `057fc17`.

### 1.2 Stakeholders
| Who | Interest |
|---|---|
| The user (owner of the demo Mac) | No secret is committed, nothing is sent out (SC10), and the host can be cleaned |
| Controller, W101 (final verification) | The verdict, and the remediation named for each CAUTION |
| W100 (client security review, running in parallel) | Items here that belong to the clients (section 9, I-8 and I-9) |
| W102 (report inputs) and W103 (final commit) | The O-1 scan input (section 7.12), the host state and its removal commands (section 4.5) |

### 1.3 Timeline (2026-10-07, WIB)
| Time | Step |
|---|---|
| 08:47 | Brief read. Load average 6.14 |
| 08:48 | Listener check. Read-only `GET /api/v1/health` |
| 08:49 to 08:51 | Count-only secret scans (by value and by pattern) |
| 08:52 to 08:54 | `npm audit` (`--omit=dev` and full), dependency paths |
| 08:55 to 08:57 | Read-only catalog inspection as `dems_owner`; `pg:status`; SU-1 hashes |
| 08:57 to 08:58 | Log hygiene scans (Core logs, PostgreSQL logs) |
| 08:58 to 08:59 | Security unit tests (81 files) and `test:pg-scripts` (57 tests) |
| 09:00 to 09:04 | O-3 experiment, error-log probe, code reading of the diff, the SR table |
| 09:05 | Final listener and load check (load 6.05) |

### 1.4 Scope
| In scope | Out of scope |
|---|---|
| `apps/core-server/**` (source, the uncommitted diff, tests read as evidence) | The web console and the mobile app (W100), apart from the server-side half of the owed sign-out |
| `scripts/pg/**`, `.data/` (modes, ignore rules, `pg_hba.conf`, the server settings, the logs as counts) | Fixing anything. This row is read-only |
| `packages/shared/src/api` (registry, access rules, schema changes in the diff) | The PostgreSQL on `*:5432` and its LaunchDaemon, which this task did not install (F27, D26) |
| `.gitignore`; `npm audit`; the host changes H-01 to H-18 | Another project's processes (`node` on `*:3000`, SMART WMS) |

### 1.5 Rationale and evidence chain
The plan row asks for four things:
1. a verdict, with command output or file:line evidence for every item;
2. the high and critical counts from `npm audit`;
3. proof that the PostgreSQL install stays within the logged steps, each with its rollback;
4. a remediation for each CAUTION or FAIL.

The re-check list of [DB:§15.4] adds HC-1 to HC-5, the role table of §6.2, GD-13, GD-14, T-AO-4 and T-CR-2. Rev 2.1 adds SD-29 (`DEVICE_CREDENTIAL_ROTATED`). D190 adds O-3, F76, F79 and the owed sign-out. The implementation report (`implementation/99_implementation_report.md:528`) adds DN-B2a-3, D123 DN-2, D118 FU-4, D146 F-7 and F-8, D161, F43/O-8 and the three Info items of D113.

Each claim below cites an evidence item of section 2 (E-nn), a file:line, or a decision ID.

### 1.6 Method
1. Read the plan row, [DB:§6.2, §7.1, §7.6, §15.4], [SP:§15] and the decisions named in the brief.
2. Live checks without changing anything:
   - `lsof`;
   - one `GET /api/v1/health`;
   - `ps` (names and the two non-secret values only);
   - `pg:status`;
   - a catalog read as `dems_owner` through the repo's own helper (`readOwnerConnection`, `createOwnerPool`, `verifyOwnerSession` of `apps/core-server/src/db/commands/owner-connection.ts`), inside `BEGIN READ ONLY … ROLLBACK`.
3. Secret scans that print counts and paths, never values:
   - by value: a script reads the three files in memory and searches for the three passwords;
   - by pattern: private keys, cloud and API tokens, URLs with credentials, token-shaped `ses_`/`dvc_`/`bio_` strings.
4. `npm audit --omit=dev` and the full `npm audit`, read-only. `npm ls` was used for the dependency paths.
5. Code reading of every non-test file the uncommitted diff changes in scope (63 files), and of the guards each SR item rests on.
6. Tests that need no database:
   - 81 unit files of the security-relevant folders;
   - `npm run test:pg-scripts`;
   - two in-process probes (O-3 and the error log) whose scripts live in the session scratchpad.

   `test:db` was **not** run. It creates and drops clone databases in the shared cluster, which the read-only rule and the parallel device row rule out. The database-level proofs are cited from W58 (D146), C3 (D244) and FXR-S (D245).

### 1.7 Alternatives considered
| Option | Why not |
|---|---|
| Run `test:db` for the db-level SR proofs | Writes to the cluster (clone databases) while a device row holds `dems_demo` and port 4420. Its last full run is recent: 124 files / 1,751 tests exit 0 (D244, D245) |
| Sign in against the live server to see the cookie | Writes an audit row and a session row into `dems_demo`, which a parallel row is counting. D146 quotes the cookie attributes instead, together with `apps/core-server/src/modules/identity/cookie.ts:25` |
| Grep the README and `dataset.ts` for the demo password | Forbidden by the brief. Only phrase counts were taken |

### 1.8 Assumptions
- The running Core (PID 53551) is the tree on disk. It was started at 08:45:45 by the parallel row from `apps/core-server` (`tsx src/index.ts`).
- The PostgreSQL logs in `.data/postgres/log/` cover the cluster built by W90 at 05:30. Hours 05, 06 and 07 exist.

### 1.9 Gaps: what was not done
- **HC-2 live.** The demo flag is ON in the running server (`DEMS_DEMO_CONTROLS=1`, E-03), so "flag off reads only `pg.env`" was read in the code, not observed (section 5).
- **`client_addr` of the server's two `dems_app` connections.** A non-superuser cannot read it (E-06). `lsof` shows both on `127.0.0.1:4432` (E-02).
- **The shell profile.** It was not read; it belongs to the user, not to the task. The plan states that no row edits it.

---

## 2. Evidence register (commands and quoted output)

**E-01: listeners** (`lsof -nP -iTCP -sTCP:LISTEN`, 08:48 and 09:05):
```
postgres  32434 ... TCP 127.0.0.1:4432 (LISTEN)
node      43299 ... TCP 127.0.0.1:4400 (LISTEN)      cwd apps/mock-core
node      53544 ... TCP 127.0.0.1:5173 (LISTEN)      cwd apps/core-web   (vite --host 127.0.0.1 --port 5173 --strictPort)
node      53551 ... TCP 127.0.0.1:4420 (LISTEN)      cwd apps/core-server (tsx src/index.ts)
node      53574 ... TCP 127.0.0.1:8081 (LISTEN)      cwd apps/mobile     (expo start --localhost --port 8081)
```
Non-loopback listeners on the host belong to other owners: ControlCenter `*:5000`/`*:7000`, `limactl *:53`, `node 36618 *:3000` (cwd `Documents/SMART WMS/smart-wms`), `rapportd`, `ssh *:5433`. None is this task's. Nothing listens on 4421 to 4423.

**E-02: sockets of each process** (`lsof -nP -a -p <pid> -i`):
- Core 53551: `127.0.0.1:4420 (LISTEN)`, three `127.0.0.1:4420->127.0.0.1:*` ESTABLISHED, two `127.0.0.1:* ->127.0.0.1:4432` ESTABLISHED. Nothing else (AC-B-66).
- postgres: `127.0.0.1:4432 (LISTEN)` and two loopback backends.
- Vite: `127.0.0.1:5173` only.
- Metro: `127.0.0.1:8081` plus `UDP *:5353` (mDNS; see I-8).

**E-03: process arguments and environment names** (`ps`; environment printed as variable names only, plus the two non-secret values):
```
32434  .../@embedded-postgres/darwin-arm64/native/bin/postgres -D .../.data/postgres -c listen_addresses=127.0.0.1 -c port=4432 -c unix_socket_directories=
53551  env names matching DEMS|PG|SECRET|PASSWORD|TOKEN|DATABASE|NODE_ENV: CLAUDE_CODE_MESSAGING_TOKEN, DEMS_CORE_PORT, DEMS_DEMO_CONTROLS
       DEMS_CORE_PORT=4420   DEMS_DEMO_CONTROLS=1
```
No `DEMS_PG_*` and no `PG*` variable is in the server's environment (HC-3).

**E-04: health** (`curl -i http://127.0.0.1:4420/api/v1/health`, the one permitted request):
```
HTTP/1.1 200 OK
content-security-policy: default-src 'none'; frame-ancestors 'none'
Cross-Origin-Resource-Policy: same-origin
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
content-type: application/json; charset=utf-8
cache-control: no-store
{"status":"ok","service":"dems-core-server","version":"0.2.0","apiVersion":"v1",...,"ready":{"database":true,"engine":true}}
```
The response has no `Access-Control-Allow-*` header (SR-04) and no `Strict-Transport-Security` header (OR-9). The header set equals OR-9 (`masterplan/01_specs.md:1514`).

**E-05: `npm run pg:status`** (exit 0):
```
settings   listen_addresses = '127.0.0.1', port = 4432, unix_socket_directories = '' (configuration files)
server     RUNNING, PID 32434 (postmaster.pid: 127.0.0.1:4432, status "ready", connect probe: open)
  HA-1 PASS   HA-2 PASS   HA-3 PASS
  HA-4 PASS | a connection as dems_app with a wrong password: SQLSTATE 28P01
file modes  700 .data  700 .data/postgres  600 pg.pwfile  600 pg.owner.env  600 pg.env  600 postgres.log  600 pg-scripts.log
connection files (key names only)
  .data/pg.owner.env: DEMS_PG_HOST, DEMS_PG_PORT, DEMS_PG_DATABASE, DEMS_PG_OWNER_ROLE, DEMS_PG_OWNER_PASSWORD
  .data/pg.env: DEMS_PG_HOST, DEMS_PG_PORT, DEMS_PG_DATABASE, DEMS_PG_APP_ROLE, DEMS_PG_APP_PASSWORD
pg:status: OK, running
```
`pg_hba.conf` has 6 effective lines, every one `scram-sha-256`, addresses `127.0.0.1/32` and `::1/128`, types `local`/`host` only. Two of them are `replication` lines (see I-5).

**E-06: read-only catalog as `dems_owner`** (`BEGIN READ ONLY`, `transaction_read_only = on`, then `ROLLBACK`):
```
session        current_user=dems_owner  database=dems_demo  server 18.4
roles          dems_admin super=t createrole=t createdb=t repl=t bypassrls=t
               dems_owner super=f createrole=f createdb=t repl=f bypassrls=f
               dems_app   super=f createrole=f createdb=f repl=f bypassrls=f
memberships    (none)
databases      dems_demo->dems_owner; postgres, template0, template1 ->dems_admin
triggers       audit_chain_history_append_only A; audit_log_append_only A; audit_log_chain_guard A
object owners  dems_owner: 31 tables, 70 indexes, 1 sequence (schemas public, drizzle); none of dems_admin
functions      5, all dems_owner; the two SECURITY DEFINER ones pin search_path=pg_catalog, public, pg_temp
dems_app       audit_log S+I only; audit_chain_history S only; audit_chain_head S only; UPDATE/DELETE only on
               active_session (contract K-2, 0003_privileges.sql:45); TRUNCATE on nothing; CREATE in public: f;
               CREATE in db: f; TEMPORARY: t (F53, accepted D113)
settings       listen_addresses=127.0.0.1 port=4432 password_encryption=scram-sha-256 ssl=off
               log_statement=none log_min_duration_statement=-1 log_error_verbosity=terse
               log_parameter_max_length_on_error=0 logging_collector=on log_file_mode=0600
               log_rotation_age=60 log_rotation_size=0 log_truncate_on_rotation=on
activity       dems_app / dems-core-server: 2 connections; dems_owner / w99-security-readonly: 1 (this read); no dems_admin
audit_log      92 rows, head seq 92; DEVICE_CREDENTIAL_ROTATED: 0; audit_chain_history: 0 rows
detail keys    caseNumber certificateFingerprint codeId coreDeviceId destination expiresAt exportId fromState kind
               manifestHash method reason sessionsEnded state   (no credential-like key)
auth_sessions  every row absolute_expires_at - issued_at = 28,800,000 ms (8 h); 1 open, idle 24 s
devices        1 REVOKED; device_credentials: 1 row, current_hash 32 bytes, no pending next_hash
schema_meta    schema_version 1, contract_revision dbc-2
```
**E-07: SU-1 hashes** (`shasum -a 256 -c` against the W03/W07 values quoted in `verification/03_clean_state_rebuild.md:148-154`): `hydrate-symlinks.js`, `pg-symlinks.json`, `postgres`, `initdb` and `pg_ctl` are all `OK`, exit 0.

**E-08: modes and ignore rules**:
```
stat -f '%Lp': 700 .data | 600 pg.pwfile | 600 pg.owner.env | 600 pg.env | 700 .data/postgres | 700 .data/postgres/log
               600 current_logfiles | 600 postgresql-05.log, -06.log, -07.log | 600 .data/postgres.log | 600 .data/pg-scripts.log
git check-ignore -v: .gitignore:70:/.data/ matches .data, .data/postgres, .data/pg.pwfile, .data/pg.env, .data/pg.owner.env,
                     .data/postgres.log, .data/pg-scripts.log; .gitignore:47 .cache/; .gitignore:59 .locks/;
                     .gitignore:48 *.log matches apps/core-server/logs/errors.log
git status --porcelain --ignored -- .data  ->  "!! .data/"      git ls-files .data .cache .locks apps/mobile/signing | wc -l -> 0
git diff 057fc17 -- .gitignore -> (empty)
```

**E-09: secret value scan.** The three passwords were read in memory. The output gives counts and paths, never values:
```
key names    pg.pwfile: 1 non-empty line; pg.owner.env and pg.env: the five DEMS_PG_* keys each (CR-1)
shape        each value >= 32 chars, base64url charset (CR-5: >= 24 random bytes); 3 distinct values
tracked files            4,458 files   753 MB    hits 0
untracked, not ignored   5,791 files   1.54 GB   hits 0
ignored docs evidence      815 files   169 MB    hits 0
.data (logs, cluster)    1,462 files   121 MB    hits 0   (the three credential files themselves excluded)
.locks                      39 files             hits 0
.cache (no node_modules) 61,153 files  5.5 GB    hits 0
git diff 057fc17         1.23 MB                 hits 0
git log -p --all         61 MB                   hits 0
```
**E-10: secret pattern scan** (tracked, untracked-not-ignored and the added lines of the diff):
- 0 private keys, AWS, GitHub, Slack, Google, OpenAI/Anthropic keys and JWTs.
- `postgres://user:<8 chars>@` appears 6 times, all under `docs/`: the literal placeholder text of earlier scan descriptions, of length 8, `password`. One of these is in the diff (`decisions.md`, D183). Per E-09 none is a real value.
- `PGPASSWORD`, `DATABASE_URL` and `--env-file` appear only in `docs/` plans and specs.
- Token-shaped literals: `ses_AAAAAAAA…` (test, `upgrade.db.test.ts:328`); `ses_EXAMPLE_…`, `bio_EXAMPLE_…` and `dvc_EXAMPLE_…` (`packages/shared/openapi/openapi.json`, 8 examples).
- The diff's added lines hold 0 token-shaped literals.

**E-11: `npm audit`** (08:52 to 08:54, registry reached, nothing installed):
```
npm audit --omit=dev   ->  124 vulnerabilities (5 low, 23 moderate, 96 high)     critical 0   exit 1
npm audit              ->  132 vulnerabilities (5 low, 28 moderate, 99 high)     critical 0   exit 1
npm audit --omit=dev -w @dems/core-server -> 2 (1 moderate, 1 high): undici under @scalar/json-magic
distinct advisories 17: high 4 (braces GHSA-vfj7-8cjw-p6xm; node-forge GHSA-86w9-cpqp-85rv; undici GHSA-rfgv-xxqx-mfg5,
  GHSA-w293-vg96-wgc3), moderate 9, low 4
git diff --stat 057fc17 -- package-lock.json -> (empty); last lockfile commit b90a3c6
```
**E-12: where the advisory packages sit** (`npm ls <pkg> --all --omit=dev`):
| Package (advisory) | Path | On the Core runtime path? |
|---|---|---|
| braces 3.0.3 (high) | `@dems/mobile` > expo > `@expo/cli` > `@expo/metro-file-map` > micromatch | No. Mobile build tooling |
| node-forge 1.4.0 (high) | `@dems/mobile` > expo > `@expo/cli` (code-signing certificates) | No. Mobile CLI |
| undici 7.29.0 (high, 10 advisories, fix `>=7.29.1`) | `@dems/shared` devDependency `@scalar/openapi-parser` > `@scalar/json-magic`; also `@dems/core-web` > `@scalar/api-reference-react` > … > json-magic | No. The only importers in the backend scope are tests: `packages/shared/test/openapi.test.ts`, `packages/shared/test/api-openapi-scope.test.ts`, `apps/core-server/test/static/network.test.ts`. The workspace audit attributes it to core-server only through the `@dems/shared` link |
| decode-uri-component, uuid, sprintf-js (moderate) | mobile (expo-router, config-plugins, the jest preset) | No |
| esbuild <=0.24.2 (moderate) | `@esbuild-kit/core-utils` (drizzle-kit, dev) | No. Accepted in D27. The runtime copy is `tsx` > esbuild 0.28.2, outside the range |
| @ai-sdk/provider-utils (low) | web (Scalar agent-chat) | No |

**E-13: database re-check, static** (T-CR-2, T-AO-4; `grep -rl` over `apps/`, `packages/`, `scripts/`, every `package.json`):
```
T-CR-2 (a) pg.pwfile in apps/ packages/                                 -> no match
T-CR-2 (b) PGPASSWORD|DATABASE_URL|--env-file|postgres URL with user part in scripts/, apps/core-server/, package.json -> no match
T-CR-2 (c) pg.owner.env / OWNER_FILE_NAME in apps/core-server/src outside db/reset/ and db/commands/
           -> src/modules/demo/__tests__/gate.db.test.ts only (a test; it asserts the name is NOT in the log, :231)
T-AO-4  DISABLE TRIGGER, DROP TRIGGER, CREATE OR REPLACE (anywhere in apps/core-server, scripts) -> no match
        session_replication_role -> scripts/pg/trial.mjs, scripts/pg/check-superuser-trigger.mjs (T5-f, T5-j) and the
                                   two tests that expect its refusal (test/db/audit-guards.db.test.ts, privileges.db.test.ts)
        ALTER SYSTEM -> scripts/pg/trial.mjs (T5-i) and a comment in scripts/pg/server.mjs:26
        DROP DATABASE (production) -> src/db/reset/names.ts:191 (the reset's builder), comments in reset/errors.ts:42
                                   and scripts/pg/db.mjs:23; plus the test helper and test/support/reset.ts (erratum D-2)
```
**E-14: tests that need no database** (08:58 runs, one worker):
```
npx vitest run --project unit --maxWorkers=1 test/static src/plugins src/core src/realtime src/modules/identity
  src/modules/pairing src/db/reset        ->  Test Files 81 passed (81)   Tests 1757 passed (1757)   exit 0
npm run test:pg-scripts                   ->  tests 57  pass 57  fail 0
```
The 57 tests include "the password file of the bootstrap superuser is read by init and by the trigger check only" and "host and port never come from the environment, and 5432 is named only to be refused".

**E-15: access rules of all 75 operations**, compiled by the server's own `compileAccessRule` (`apps/core-server/src/plugins/permission-guard/access-rules.ts:237`) from `CORE_API_OPERATIONS`:
```
operations=75 problems=0 kinds: PUBLIC 4, PERMISSION 40, AUTHENTICATED 25, DEVICE 5, ANY_OF 1
PUBLIC: getServiceHealth, signIn [CONSOLE_IDENTITY], getSignInStatus, redeemPairingCode
DEVICE: signInWithBiometric [DEVICE_CREDENTIAL], reportBiometricFailure, getDeviceRegistration, unpairDevice,
        rotateDeviceCredential [DEVICE_CREDENTIAL]
DEMO_FLAG condition on all five demo operations (71-75); USER_ADMIN on 20-23; PAIRING_MANAGE on 24-26, 28, 29
retired device refused everywhere except getServiceHealth and redeemPairingCode
```
The full per-operation list is in section 4.6.

**E-16: audit rule of every operation** (registry `audit`):
- Every state-changing operation has one success type. Examples: `AUTH_SUCCESS` (signIn, signInWithBiometric), `AUTH_SIGNED_OUT`, `ROLE_CHANGED`, `USER_ENABLED`/`USER_DISABLED`, `PAIRING_CODE_ISSUED`/`CLOSED`, `PAIRING_SUCCESS`, `DEVICE_REVOKED`, `UNPAIRED`, `DEVICE_CREDENTIAL_ROTATED`, `BIOMETRIC_ENROLLMENT_CHANGED`, `SCENARIO_LOADED` (loadScenario, resetDemo), `FAULT_RAISED`/`CLEARED`, `AUDIT_EXPORTED`, `EVIDENCE_EXPORTED`.
- 27 reads are `NONE-R`.
- 8 are `NONE-P` (simulator parity): touchSession, beginPrecheck, retryPrecheck, scanCaseNumber, setActiveCamera, resetMicClip, updateSettings, acknowledgeAlert.
- Refusals write `ACCESS_DENIED` (`EXPORT_DENIED` for the three exports).

**E-17: Core server logs** (counts; every recorded server log: `.cache/manual/*server*.log`, 9 files, plus `.locks/core-server.lane3.log`, 6,159 lines in total; the running server writes to `.cache/manual/main-server-w94.log`):
```
per file: ses_* 0 | dvc_* 0 | bio_* 0 | route with '?' 0 | un-redacted authorization 0 | un-redacted cookie 0 |
          dems_session_<port>=<value> 0 | the word "password" 0 | a "body" member 0 | a 6-digit code member 0
main-server-w94.log keys: level time pid hostname msg reqId method route status durationMs principal connectionId kind code
                          helloReason closedBy (+ boot facts); messages: "request completed" 82, "socket opened" 14, ...
"deprecat" in the three main/lane logs and in the 81-file unit run: 0
```
**E-18: PostgreSQL logs** (counts only):
```
postgresql-05.log  2,485 lines  ERROR 656  STATEMENT 656  DETAIL 0  "Failing row" 0  "Key (" 0  64-hex 0  \x-bytea 0
postgresql-06.log  2,244 lines  ERROR 560  STATEMENT 560  DETAIL 0  ...0
postgresql-07.log      8 lines  FATAL 1 (the HA-4 probe of E-05)
.data/postgres.log 1 line (before the collector started), 0 STATEMENT/DETAIL
```
The STATEMENT lines were classified with every literal masked. All of them are deliberately refused statements of test runs: privilege tests (`UPDATE audit_log SET message = <lit1> WHERE seq = N`, `SET log_statement = <lit3>`, `ALTER SYSTEM SET log_statement = <lit3>`), constraint tests with fixture IDs (`DELETE FROM roles WHERE id = <lit10>`), and application statements with `$n` placeholders. "password" occurs only in `FATAL: password authentication failed for user "dems_app"` (5 times, HA-4 probes) and in a `method = 'PASSWORD'` literal.

**E-19: O-3 probe.** This is the real app factory in process, with stand-ins for the session registry, clock, pipeline and denial budget; nothing was written. Script: `scratchpad/w99/o3_idle_refused_post.mts`.
```
refusedPost   POST /api/v1/admin/users/OPR-001/disable (no USER_ADMIN)  -> 403 NOT_PERMITTED, denial row 1, touches 0
otherPost     POST /api/v1/evidence/EV-NOT-AN-ID/verify (bad input)     -> 422 INVALID_INPUT,  touches 0
control       POST /api/v1/auth/touch                                   -> 200,                touches 1
```
**E-20: error-log probe.** `createErrorLog` to a scratch file, with an error whose message, `detail`, `query`, `parameters` and `cause` carry a marker and a token-shaped string:
```
{"mode":"600","bytes":540,"markerOccurrences":0,"keys":["timestamp","service","level","source","message","errorName","code","stackTrace"]}
```
`apps/core-server/logs/` does not exist (`ls`: no such directory), so the error log has still never been written by a real run (F-7).

**E-21: host checks outside the project**:
- `ls -d /opt/homebrew/opt/postgresql@18 /opt/homebrew/var/postgresql@18`: no such file. The fallback keg Fb (H-12) was never installed.
- `~/Library/LaunchAgents`: 0 names match postgres or dems.
- `/Library/LaunchDaemons/postgresql-18.plist`: dated Sep 12, so it predates this task (2026-10-04). It is the `*:5432` server of F27, not this task's.
- `~/.pgpass`: does not exist.

---

## 3. Security-review-gate: the five checks

| Check | Result | Evidence |
|---|---|---|
| Credential leak | **PASS** | E-09 (0 value hits anywhere, history included), E-10 (placeholders and examples only), E-17, E-18 (logs clean), E-08 (modes and ignore rules) |
| Destructive operation | **PASS** | `DROP DATABASE` exists only in the reset builder, the test helper and the trial (E-13). The reset refuses a superuser at R-0 (`src/db/reset/routine.ts:449-455`) and needs `DEMO_CONTROL` plus the demo flag (E-15). The only DELETE the runtime role holds is on `active_session` (E-06) |
| External call | **PASS** | The Core's sockets are loopback only (E-02, AC-B-66). The static network test passed in E-14 (`test/static/network.test.ts`). The server source has no `child_process` and no environment read outside `src/index.ts` and `src/config.ts` (comments elsewhere) |
| Injection | **PASS** | SR-67: every SQL statement is parameterised (W91, D241). The DDL identifiers are built only from guarded or quoted names: `createEmptyDatabaseStatement` (`src/db/commands/statements.ts`) is reached from `create.ts` after the name guard and from `reset/names.ts` through `quoteDatabase`. Every input passes through zod; strings refuse U+0000 and unpaired surrogates (SR-64) |
| Permission escalation | **PASS** | The roles have the flags the contract requires, with no memberships (E-06). The triggers are `A`. `dems_app` cannot write the lineage table, cannot create objects and cannot TRUNCATE. The server's `replace` seams work only under a test configuration (`src/app.ts:51-62`) |

---

## 4. The items the brief requires

### 4.1 Listener check: PASS
The brief expected 4432 postgres and 4420 Core on `127.0.0.1`, and 5173 Vite and 8081 Metro on `127.0.0.1`. That is what E-01 shows. It also shows mock-core on `127.0.0.1:4400` (the parallel regression row), which is loopback too.
- The Core's listen host is the constant `LISTEN_HOST = '127.0.0.1'` (`src/config.ts:22`), used at `src/index.ts:107`.
- PostgreSQL is pinned three times: on its command line (E-03), in `postgresql.conf:892-894`, and by `pg:status` (E-05).
- Nothing listens on `*:5432` for this task; it was not touched.
- AC-B-03 and AC-B-66 pass.

### 4.2 Secrets: PASS
- **Scope of the scan.** No secret is in a tracked file, in the uncommitted diff, in git history, in the ignored evidence logs, in `.cache`, `.locks` or the `.data` logs (E-09, E-10).
- **Published demo password.** The README states it is published (one line with "published demo", count only). That is SR-63 C1 and expected, not a finding.
- **Count-only checks of the README.** `http://127.0.0.1:5173` appears on 10 lines. `localhost:5173` appears on 2 lines, both of which say never to use it (`README.md:110`, `:417`).
- **The values themselves.** They are at least 32 characters of base64url (CR-5). The connection files hold exactly the five keys (CR-1, AC-B-86).

### 4.3 Credential files: PASS
Modes are 700 and 600 for `.data/`, the three files, the server logs and the script log (E-05, E-08). AC-B-64, CR-3 and T-CR-1 pass. `git check-ignore -v` matches every path, `git ls-files .data` is empty, and `.gitignore` is unchanged since `057fc17` (E-08). CR-7 passes.

### 4.4 `npm audit`: high 99, critical 0 (full); high 96, critical 0 (`--omit=dev`). CAUTION, W99-1
- **Counts.** Quoted in E-11. Since the backend gate (80 entries: 50 high, 0 critical; D146) the count has risen to 132 (99 high). The lockfile is unchanged since `b90a3c6` (E-11), so the cause is new advisories: more `undici` advisories, `sprintf-js`.
- **Distinct advisories.** 17 in total, 4 of them high.
- **Runtime exposure.** None is on the Core server's runtime path (E-12). The server's production dependencies (`apps/core-server/package.json`: fastify 5.12.5, `@fastify/*`, pg 8.23.1, drizzle-orm, zod, rate-limiter-flexible, tsx) carry no advisory. The one entry the workspace audit attributes to core-server is `undici` under a devDependency of `@dems/shared`, imported only by tests.
- **Remediation.** See section 9, W99-1.

### 4.5 PostgreSQL install, limited to the logged steps, each with its rollback: PASS
| Host change (plan §14.2) | Logged in | Present now | Rollback ([PL:§14.3]) | Rollback proven |
|---|---|---|---|---|
| H-01: `embedded-postgres` 18.4.0-beta.17 and `@embedded-postgres/darwin-arm64` in `node_modules`; root `allowScripts` entry `@embedded-postgres/darwin-arm64@18.4.0-beta.17` (`package.json:55-58`) | `implementation/03_npm_slot_n1_server_shared.md` (W03, D27) | Yes. SU-1 hashes equal (E-07) | RB-01: `npm uninstall embedded-postgres pg` + `npm install-scripts prune` (in `npm run pg:remove`) | Written only (GP-02), as planned |
| H-02: cluster, three credential files, server log, script log (D32 (4)) under `.data/` | `initialization/04_postgres_provisioning.md` (W07, D32); rebuilt by W90 | Yes. Modes 700/600 (E-08) | RB-02: `npm run pg:remove-data` | **W90** (D240: `pg:remove-data` deleted `.data/`, `pg:init` rebuilt it) |
| H-03: postgres on `127.0.0.1:4432`, PID in `.locks/postgres.pid` | W07; W89; W90 | Yes. PID 32434, started 05:30:18 by W90 (E-03, E-05) | RB-03: `npm run pg:stop` | W89, W90 |
| H-11: lock, PID and log files in `.locks/` | several rows | Yes, git-ignored (E-08) | RB-11 | Written only |
| H-15: roles `dems_owner` and `dems_app`; database `dems_demo` | W07, W17, W20; W90 | Yes. Exactly these roles and one project database (E-06) | With RB-02 | W90 |
| H-12: fallback Homebrew keg | Not used | **Absent** (E-21) | RB-12 not needed | n/a |
| Not changed (plan §14.2, last paragraph) | — | No launchd job of the task (E-21); no `.pgpass`; the plan says no shell-profile edit (not read, §1.9) | — | — |

There is nothing on the host for PostgreSQL that the register does not list. The pre-existing `/Library/LaunchDaemons/postgresql-18.plist` (Sep 12) and `*:5432` belong to F27 and D26 and are the user's decision (`implementation/99_implementation_report.md`, §8.3).

### 4.6 RBAC enforced at the server for every operation: PASS
**How a rule is attached.** The rule of a route can come only from the registry (`access-rules.ts:5-21`):
- a route that is not a registry operation, or that names an operation on another method or path, stops the boot (`ROUTE_WITHOUT_RULES`, `ROUTE_NOT_THE_OPERATION`, `OPERATION_ID_MISMATCH`, `:42-63`);
- the `onRoute` hook records every route (`plugins/permission-guard/index.ts:235-243`);
- a request whose route has no rule is refused with 500 (`:245-257`).

**When it runs.** The guard is stage 6 of one `onRequest` hook (`src/app.ts:17-30`, `:369-378`), so it runs before the body is read (SR-44). Conditions are evaluated fail-closed: `decision.ts:161-175` has a case for every condition, and the type check fails on a new one (D123).

**What was checked.** All 75 operations compile with 0 problems (E-15). The stored role matrix is checked against the rules at boot (`matrix.ts:142`). The live matrix: INVESTIGATOR 4, SUPERVISOR 10, TECHNICIAN 4 permissions (E-06).

**Proof by test.** The acceptance matrix test covers 1,649 cells (D123 (b); last full `test:db` run green, D244, D245). The guard's unit tests passed in E-14 (`access-rules`, `decision`, `guard`, `registered-routes`, `boot-registry`, `static`).

**Access marker of each operation (E-15):**

| Operations | Rule |
|---|---|
| 1 getServiceHealth; 11 signIn (CONSOLE_IDENTITY); 12 getSignInStatus; 27 redeemPairingCode | PUBLIC |
| 5 to 9, 13, 14, 15, 16 (DEVICE_SESSION), 19, 43, 48, 52 to 54, 56 to 60, 63, 64, 68 to 70 | AUTHENTICATED |
| 17 signInWithBiometric (DEVICE_CREDENTIAL), 18, 30, 31, 32 rotateDeviceCredential (DEVICE_CREDENTIAL) | DEVICE |
| 2, 3, 4, 33 to 38, 42 SESSION_START; 39 to 41 SESSION_NOTE; 10 EVIDENCE_EXPORT; 44 to 46 EVIDENCE_VIEW; 47 EVIDENCE_REVIEW; 49 DEVICE_MANAGE; 50, 51, 65 DIAGNOSTICS_RUN; 61, 62 AUDIT_EXPORT; 66, 67 MAINTENANCE; 20 to 23 USER_ADMIN; 24 to 26, 28, 29 PAIRING_MANAGE; 71 to 75 DEMO_CONTROL + DEMO_FLAG | PERMISSION |
| 55 setStoragePolicy | ANY-OF(EVIDENCE_REVIEW, MAINTENANCE) |

### 4.7 Audit completeness for security events: PASS
**What the registry requires.** Every operation that changes security state names its success row (E-16). The modules write the refusal and failure rows the registry does not list:
- `AUTH_FAILED` and `AUTH_LOCKED` (`modules/identity/activity.ts:95-138`);
- `AUTH_EXPIRED` from the sweeper (`:184-194`);
- `AUTH_SIGNED_OUT` (`:157`);
- `PAIRING_FAILED` and `PAIRING_LOCKED` (`modules/pairing/activity.ts:122-149`);
- `DEVICE_REVOKED` and `UNPAIRED` (`:171-198`);
- `DEVICE_CREDENTIAL_ROTATED` (`:210`).

The guard writes `ACCESS_DENIED`/`EXPORT_DENIED` inside the denial budget (`permission-guard/index.ts:294-313`).

**Proof by test and by data.** W48's acceptance test asserts the whole pairing trail as one sequence of 47 rows (D116). The live `dems_demo` trail carries AUTH, PAIRING and DEVICE rows (E-06). The detail keys hold no credential-like name (E-06). The database refuses 17 credential-like detail keys (contract §5.5) and non-flat maps (`dems_jsonb_is_flat`, E-06).

**Gaps, all by design:**
- the 8 `NONE-P` operations (simulator parity; SR-82 gives two of them a log line);
- requests the throttle refuses with 429 are logged, not audited (SR-24, SR-71);
- the `DEVICE_CREDENTIAL_REQUIRED` refusal writes no row (W99-4).

### 4.8 Rate limits: PASS (with W99-2 and W99-3 as accepted residuals)
| Limit | Value | Where |
|---|---|---|
| Request throttle: class buckets and a device's sign-in entry points | 30 per 60 s | `plugins/throttle/limits.ts:19-21` |
| Request throttle: everything else | 600 per 60 s | `:23` |
| Denial budget | 20 per 60 s per key | `:26-27` (SR-71) |
| Throttle key | the resolved principal, or `WEB`/`LOCAL` by Origin category; never a caller-supplied value | `:70-96` (SR-75) |
| Sign-in lockout | 5 failures in 300 s, 60 s lock; per console; in memory | `modules/identity/limits.ts:10-17` (SR-22, SR-25) |
| Pairing redeem lock | 3 failures in 300 s lock redeeming for 60 s; 5 close the code | `modules/pairing/limits.ts:33-37` (SR-27) |
| Sockets | 16 in total, 6 anonymous, 4 per session, 2 per device; 5 s handshake timeout; 32 pending handshakes; compression off; `maxPayload` set | `realtime/limits.ts:18-57`; `realtime/index.ts:300-301` (SR-42) |
| Body size | 65,536 bytes | `src/config.ts:47`, `src/app.ts:323` (SR-64) |

### 4.9 Session and token handling: PASS
**Timing.**
- Idle expiry is 15 min (`AUTH_IDLE_TIMEOUT_MS = 15 * 60_000`, `packages/shared/src/sim/constants.ts:54`, used at `modules/identity/limits.ts:24`).
- Absolute expiry is 8 h (`:26`). Every stored session has exactly 28,800,000 ms between issue and absolute expiry (E-06).
- The sweeper runs every 5 s (`:31`; `src/core/sweeper.ts`, moved unchanged from identity by FXR-S).
- The expiry statement decides between `ABSOLUTE_EXPIRED` and `IDLE_EXPIRED` on the server clock (`modules/identity/session-store.ts:238`).

**What counts as activity.** Only a POST that reached its handler, at most once a second (`plugins/authenticate/index.ts:281-300`). A GET never extends a session (AC-B-26). O-3 is answered in section 7.1.

**Tokens.** Session, device and biometric tokens are 32 bytes from `crypto.randomBytes`. Only their SHA-256 is stored (`modules/identity/tokens.ts:20-31`, `modules/pairing/secrets.ts:51-62`, `modules/identity/biometric/tokens.ts:29-38`). The pairing code uses `crypto.randomInt`, its hash is bound to the code ID, and it is compared with `timingSafeEqual` (`secrets.ts:26-42`).

**Cookie.** `SESSION_COOKIE_ATTRIBUTES = { httpOnly: true, sameSite: 'strict', path: '/' }` (`modules/identity/cookie.ts:25`). D146 smoke: `Path=/; HttpOnly; SameSite=Strict`.

**Uncommitted changes.** They only add `device.session` publications. These are permission-filtered in the hub: `admin.changed` goes only to operators holding the resource's permission (`realtime/hub.ts:471-482`).

### 4.10 Device credential handling (never logged): PASS
- The device credential is 32 random bytes with the `dvc_` prefix. Only its 32-byte SHA-256 is stored (E-06: `current_hash` 32 bytes, no pending `next_hash`).
- The redeem answer returns it once.
- Rotation needs the device's own credential (DEVICE_CREDENTIAL condition, E-15; CPS1-3 closed by D118 and D123).
- In the logs, `dvc_` occurs 0 times in all ten server logs (E-17) and 0 times in the error-log probe (E-20). The fixture strings in evidence logs are `dvc_FAKE-T…`/`dvc_TEST_F…` (section 7.12).

### 4.11 Log hygiene, and the F-4 note: PASS
**Core server logs.** The logger has four layers (`plugins/logger/logger-options.ts:4-21`):
1. serializers give `req` as method and route pattern, `err` as name, code and frames (no message);
2. every `Error` under any key is replaced;
3. `authorization`, `cookie` and `set-cookie` are redacted (`:38-48`);
4. a quoted path inside a message text is replaced.

No body is logged anywhere. E-17 found no credential, cookie value, query string or body in 6,159 recorded lines. The persistent error log writes name, code and stack frames only, with mode 600 (E-20).

**PostgreSQL logs.** `log_error_verbosity = terse` and `log_parameter_max_length_on_error = 0`, with 0 DETAIL lines and 0 hash-like values (E-06, E-18). CPS1-9 is closed.

**F-4.** Each refused statement still leaves one `STATEMENT:` line holding its SQL text. Application statements carry `$n` placeholders. Test statements carry literal fixture IDs and value-set names (E-18), and no secret. This is acceptable as recorded (D240, D244). It goes to W102 as the errata sentence for NL-1/NL-5 (C2-R3).

---

## 5. The database re-check list ([DB:§15.4])

| Item | Result | Evidence |
|---|---|---|
| **HC-1**: the server never reads `pg.pwfile`, never connects as `dems_admin` | **PASS** | T-CR-2 (a) no match (E-13). The only connections of the server are 2 as `dems_app`; no session of `dems_admin` exists (E-06). `test:pg-scripts` confirms the superuser file is read by `init` and the trigger check only (E-14) |
| **HC-2**: flag off, the server reads only `pg.env` | **PASS (code)** | `loadConfig` opens one file, `pg.env`, and refuses any role but `dems_app` (`plugins/config/load-config.ts:59-68`). With the flag off, the access rule refuses `resetDemo`/`loadScenario` with 403 `DEMO_DISABLED` before any handler runs (`permission-guard/decision.ts:174-175`; E-15), so the owner file is never reached. Not observable live: the flag is on (§1.9). T-CR-3 is in `src/modules/demo/__tests__/gate.db.test.ts` (last run green, D244) |
| **HC-3**: owner credentials held only during one reset | **PASS** | Read at R-0 into a local variable (`src/db/reset/routine.ts:479`). The variable is cleared at the end (`:846-857`) and the owner pool ended (`:325`). Since FXR-S a server-triggered reset no longer touches `process.env`: `driverEnvironment` is passed only by the CLI (`reset/cli.ts:190-192`, `routine.ts:200-207`, `:474-475`). The running server's environment holds no `DEMS_PG_*` or `PG*` name (E-03) |
| **HC-4**: the application pool is `dems_app` at every moment | **PASS** | Boot check B-4 (`src/db/schema/boot-checks.ts:139-165`). The live sessions of the server are `dems_app` (E-06). The configuration refuses another role (`load-config.ts:63-67`) |
| **HC-5**: what a compromised server could do as `dems_owner` | **PASS (residual accepted, D19)** | `dems_owner`: `rolsuper` false, `rolcreaterole` false, `rolreplication` false, `rolbypassrls` false, no memberships (E-06). It cannot change server settings: `ALTER SYSTEM` was refused at the trial, T5-i (E-18 shows the refused `ALTER SYSTEM SET log_statement` in the log) |
| **§6.2**: what binds which role | **PASS** | `dems_app`: `audit_log` SELECT and INSERT; `audit_chain_history` and `audit_chain_head` SELECT only; no UPDATE, DELETE or TRUNCATE on either audit table. All three triggers are `A` (ENABLE ALWAYS). Owner `dems_owner` owns every object, `dems_admin` owns none (E-06). The trial log shows UPDATEs of `audit_log` and `audit_chain_history` refused (E-18) |
| **GD-13**: the owner can remove the protection by a schema change | **PASS (residual)** | No program issues such a statement (T-AO-4, E-13). The functions belong to the owner, and the two SECURITY DEFINER functions pin `search_path` (E-06). The B-5 and B-9 boot checks and the catalog test hold (last `test:db` green, D244) |
| **GD-14**: lineage records, does not prove | **PASS (residual)** | `DROP DATABASE` exists only in the reset builder, the test helper and the trial (E-13; erratum D-2 adds `test/support/reset.ts`). `dems_app` cannot INSERT into `audit_chain_history` (E-06). 0 lineage rows: no reset has run on this cluster since W90 |
| **T-AO-4** | **PASS** | E-13 |
| **T-CR-2** | **PASS** | E-13. The one hit of (c) is a test that asserts the absence of the name |

---

## 6. SD-29: `DEVICE_CREDENTIAL_ROTATED` outside the server's own tests

**PASS. None exists.** `dems_demo`, the only project database (E-06: databases `dems_demo`, `postgres`, `template0`, `template1`), holds 0 rows of type `DEVICE_CREDENTIAL_ROTATED` among its 92 rows. No client calls operation 23 (D118 FU-5), and rotation needs the device's own credential (E-15). Nothing unexpected to report.

---

## 7. Items routed to this review

### 7.1 O-3 (D190): does a refused POST move the Core's idle expiry?
**Answer: no.** The activity write runs in the `preHandler` hook (`plugins/authenticate/index.ts:281-300`). That hook runs after stage 6 (the access rule) and after validation. So neither a POST that the guard refuses (403) nor one that fails validation (422) touches the session.

**Proof:** E-19 (403: 0 touches; 422: 0 touches; accepted POST: 1 touch). The db test `src/modules/identity/__tests__/sessions.db.test.ts:240` proves the 422 case on real rows.

**Nuance for the record.** A POST that passes stages 1 to 7 and is then refused by its handler (409, 422 `INVALID_REASON`, 404) does count as activity. It was an authorised attempt to act. This is consistent with ID-P9.

### 7.2 F76: a revoked device can delay a new pairing
- **Code.** Confirmed: a retired credential is not a principal (`plugins/throttle/limits.ts:70-78`), so its calls count in the `LOCAL` class bucket. That bucket also holds the unpaired app's `redeemPairingCode` and `getSignInStatus` (`:90-96`).
- **Wider than F76.** Any local process without a credential can fill the 30-per-60-s bucket, or the 20-refusal denial budget, and delay pairing for everyone in that class.
- **Impact.** Availability only, bounded to rolling 60 s windows. No code is consumed and no paired device or operator is affected.
- **Ruling.** Accepted for the demo boundary (single-user Mac, SR-63 C4). For use beyond one loopback computer, a bucket per retired device ID and a per-source key would change the specification. See W99-2.

### 7.3 F79 (2) and (3)
1. **The cap is 4 sockets per session, not per operator.** An operator with three sessions can hold 12 places, more than the 10 places that remain after the 6 anonymous ones. Getting there needs three sign-ins with the password, and the password is published (SR-63). Availability only.
2. **Paths the router cannot decode run no pipeline stage and are outside the throttle.** Each such request costs one 400 from the router. Since D120 the sockets on such paths are bounded; the request rate is not. Availability only, local only.

Both are accepted for the demo. See W99-3.

### 7.4 D122 DN-B2a-3: should the server refuse to start when the clock is far behind the stored state?
- **Current behaviour.** The server runs ahead of the stored state with a warning; the clock floor of F74 prevents stranded expiries.
- **Ruling.** Keep it for the demo: refusing to start would make the demo unusable after a clock change, and the floor already keeps every expiry correct.
- **Next phase.** Refuse, or require an operator acknowledgement, when the stored state is more than a set threshold ahead (for example 24 h). That would make a set-back visible. Info I-1.

### 7.5 D123 DN-2: the presenting device on `TOKEN_REUSE` rows
- **Current behaviour.** The `AUTH_FAILED` row names the presenting device. The token's own device is on the ended session rows and the revoked token rows, so both can be recovered.
- **Recommendation for the next phase.** Add a flat detail key such as `tokenDeviceId`, so the trail alone tells a cloned token apart from a replay on the same device. Info I-2. No change now.

### 7.6 D118 FU-4: should the `DEVICE_CREDENTIAL_REQUIRED` refusal write a row?
- **Current behaviour.** It writes no row and takes no budget place. It is logged with `refusedBy` and `audited: false` (`permission-guard/index.ts:276-292`).
- **Why it matters.** No client calls operation 23, and no client sends operation 8 with a session token. An occurrence therefore means a buggy or hostile client holding a session token on the device, which is a security-relevant signal.
- **Recommendation.** An `ACCESS_DENIED` row inside the denial budget, in the next phase. This changes [SP:§6.3] and the matrix test. Low, W99-4.

### 7.7 D146 F-7: `errors.log` never created
Still true: `apps/core-server/logs/` does not exist (E-20). No real run has failed.
- The probe of E-20 shows what the log would hold: name, code and frames, mode 600, 0 marker occurrences out of 7 planted places.
- The rotation is tested by FXR-S (`plugins/logger/__tests__/error-log-rotation.test.ts`, in E-14's 81 files).
- `*.log` is git-ignored (E-08).

Info I-3.

### 7.8 D146 F-8: Fastify `light-my-request` deprecation warning
Not seen: "deprecat" occurs 0 times in the main and lane server logs and in the 81-file unit run (E-17). No server source reads `request.connection`. Info, closed.

### 7.9 D161: a guard that reads the repository root must skip `.locks` and `.data`
Holds. Every static guard reads `WORKSPACE = apps/core-server` (`test/static/scan.ts:14`). No guard reads the repository root. `SKIPPED_DIRECTORIES` holds `.cache` and `.git` (`scan.ts:19-34`). The `scripts/pg` static tests read `scripts/pg` only. Closed.

### 7.10 F43 and O-8: scratch copies
Nothing of the session scratchpads is tracked, or untracked and unignored (E-09: 0 hits; the untracked list holds sources, tests and task documents only). Mutation and rollback copies sit in `.cache/` (git-ignored, E-08). Across 61,153 files they have 0 credential-value hits (E-09). They hold only the published demo constants the sources hold. Closed.

### 7.11 D113: the three Info items for use beyond one loopback computer
These are carried to the final report's open items unchanged:
1. The sign-in lock is per console, and any success clears it.
2. A page on another `127.0.0.1` port can send blind GETs with the operator's cookie (cookies are scoped by host).
3. `AUTH_FAILED` names the operator whose username was typed.

For this boundary, all three are still accepted.

### 7.12 O-1 input for W103 (count-only scan of the ignored evidence logs)
- **Database passwords.** 838 ignored files under `docs/` hold 0 of the three database passwords (E-09).
- **Token-shaped strings.** Only 9, in two files: `implementation/assets/12d_cpc1_red_before.log` and `implementation/assets/31_live_testing_tests_verbose.log`. All are fixtures (`dvc_FAKE-T…`, `dvc_TEST_F…`, `ses_FAKE-T…`, `bio_FAKE-T…`, plus the `Bearer` headers that carry them).
- **Other patterns.** 0 private keys, 0 cookie values.

On this evidence, no evidence log has to stay out of W103's commit for a secret.

### 7.13 The owed sign-out (D177 DN-3, server half)
- **What happens.** When a client cannot send its sign-out (link down at the mode switch), the server session stays open. It ends at the 15-minute idle expiry or the 8-hour absolute expiry, each decided by the sweeper within 5 s (section 4.9). A device session also ends on revoke or unpair (SR-12).
- **Server bound.** It holds.
- **Residual.** For up to 15 minutes a session that the user thinks is ended can still be used by its own browser or device. Only the cookie or token holder can use it, and on this boundary that holder is the user.
- **Client side.** Retrying the owed sign-out at the next link-up belongs to W100. Info I-4.

### 7.14 CPS1-9 recount (C2 note 5)
`.data/postgres/log/*.log`: 0 DETAIL, 0 "Failing row", 0 "Key (", 0 hash-like values (E-18). The old 57 MB `.data/postgres.log` is gone; the new one is 94 bytes. Closed.

---

## 8. Requirement table SR-01 to SR-82

Status values:
- **Met**: shown in this review's evidence or code.
- **Met (cited)**: the db-level proof is a recent green run named in the evidence column.
- **Accepted**: a recorded deviation.
- **Client**: belongs to W100.

| ID | Status | Evidence |
|---|---|---|
| SR-01 | Met | E-01; `src/config.ts:22`; `src/index.ts:107` |
| SR-02 | Met | E-03, E-05 (HA-1 to HA-4), E-06 (`listen_addresses`, scram); the server connects as `dems_app` (E-06) |
| SR-03 | Met | E-02 (loopback-only sockets); `test/static/network.test.ts` (E-14) |
| SR-04 | Met | E-04; `plugins/origin-guard/index.ts:18` |
| SR-05 | Met | `modules/identity/password-hash/password-hash.ts:39-47` (19,456 KiB, 2 passes, parallelism 1); `password-hash.wiring.test.ts` in E-14 |
| SR-06 | Met | `password-hash.ts:268-278` (`timingSafeEqual`); `src/db/schema/rbac.ts:109` |
| SR-07 | Met | `packages/shared/src/api/identity.ts:78` (`passwordMax: 128`); E-17 ("password" 0) |
| SR-08 | Met (cited) | `modules/identity/sign-in.ts:13, :43` (a dummy record when the user is missing); AC-B-24 tests (D78) |
| SR-09 | Met | `modules/identity/tokens.ts:20-31` |
| SR-10 | Met (cited) | `modules/identity/sign-in.ts:3`; ACTIVITY_EXEMPT signIn (`authenticate.test.ts:432-438`, E-14) |
| SR-11 | Met | Section 4.9; E-06 (8 h); `sessions.db.test.ts:179, :261` (D244) |
| SR-12 | Met (cited) | `modules/identity/session-store.ts:3`; `realtime/limits.ts:74` (1 s deadline); D120, D146 |
| SR-13 | Met | `plugins/authenticate/index.ts:3`; the session carries no role (resolved per request) |
| SR-14 | Accepted | Recorded deviation (G-11, R-04, D16) |
| SR-15 | Met | E-17 (0 tokens in the logs); `packages/shared/src/api/realtime-messages.ts:32` |
| SR-16 | Client | W100; the server half (cookie and bearer only) is `plugins/authenticate/credentials.ts` |
| SR-17 | Met (cited) | `test/acceptance/restart.test.ts` (D146 ledger); E-06 (an ended session keeps its `end_reason`) |
| SR-18 | Met | `modules/identity/cookie.ts:8, :25`; D146 smoke |
| SR-19 | Met | `plugins/origin-guard/origin-decision.ts` (exact match; `'null'` handled at `:143`); stage 3 of every request and upgrade (`src/app.ts:17-30`) |
| SR-20 | Met | Every GET in E-16 is `NONE-R`, apart from health; API-2 tests (D115) |
| SR-21 | Met | `plugins/origin-guard/index.ts:3`; CONSOLE_IDENTITY on signIn (E-15) |
| SR-22 | Met | `modules/identity/limits.ts:10-17` |
| SR-23 | Met (cited) | CPS1-6 fixed (D123 (c)); `sign-in.ts:3` |
| SR-24 | Met | Section 4.8; `plugins/throttle/limits.ts:19-23` |
| SR-25 | Accepted | In-memory counters (`modules/identity/lockout.ts`); G-26, R-10 |
| SR-26 | Met | `modules/pairing/secrets.ts:26`; `limits.ts:29-31` |
| SR-27 | Met (cited) | `modules/pairing/limits.ts:33-37`; AC-B-76 (D116) |
| SR-28 | Met | E-17 (no 6-digit code member); `modules/pairing/activity.ts:3`; AC-B-41 (D116) |
| SR-29 | Met (cited) | `modules/pairing/redeem.ts:31` |
| SR-30 | Met | E-15 (PAIRING_MANAGE); E-16; section 4.7 |
| SR-31 | Met | `modules/pairing/secrets.ts:51-62`; E-06 |
| SR-32 | Client | W100 |
| SR-33 | Met (cited) | `modules/pairing/store.ts:3`; E-06 (`next_hash` column, two-phase) |
| SR-34 | Met (cited) | `modules/pairing/devices.ts:15`; E-06 (the revoked device's session ended `DEVICE_REVOKED`) |
| SR-35 | Met (cited) | `modules/pairing/resolver.ts:3`; the retired device is refused (E-15) |
| SR-36 | Met | `modules/identity/biometric/tokens.ts:29-38`; `BIOMETRIC_TOKEN_LIFETIME_MS` 30 days (shared `identity.ts`); CPS1-7 (D123) |
| SR-37 | Met (cited) | `modules/identity/biometric/sign-in.ts:4`; CPS1-8 (D123) |
| SR-38 | Met (cited) | `realtime/admission.ts:3` |
| SR-39 | Met | Stage 3 runs on the upgrade too (`src/app.ts:17-30`; `access-rules.ts:14-18`) |
| SR-40 | Met (cited) | `realtime/messages.ts:77` |
| SR-41 | Met (cited) | `realtime/limits.ts:107`; D120 |
| SR-42 | Met | Section 4.8; `realtime/index.ts:300-301` |
| SR-43 | Met | Section 4.6; E-15 |
| SR-44 | Met | `src/app.ts:17-19`; E-19 (403 before validation) |
| SR-45 | Met | `permission-guard/index.ts:294-313`; E-19 (one denial row) |
| SR-46 | Met | The server decides every call (section 4.6) |
| SR-47 | Met (cited) | `modules/admin/rule.ts:2`; AC-B-79 (D116 ledger) |
| SR-48 | Met | Section 4.11; E-17, E-20 |
| SR-49 | Met | E-17 (route pattern only, 0 query strings) |
| SR-50 | Met | `plugins/error-envelope/api-failure.ts:91-92` (generic `INTERNAL_ERROR`) |
| SR-51 | Met | E-17 (socket lines: id, kind, code only) |
| SR-52 | Met | E-06 (privileges, triggers `A`) |
| SR-53 | Met | E-06 (`audit_log_chain_guard` `A`, `audit_chain_lock`) |
| SR-54 | Met | E-06 (detail keys); `core/audit-details.ts`; DB deny list |
| SR-55 | Met | E-16; section 4.7 |
| SR-56 | Met (cited) | `src/db/reset/routine.ts:3`; lineage SELECT-only (E-06) |
| SR-57 | Met | `src/config.ts:150`; DEMO_FLAG on 71 to 75 (E-15); read at boot (`src/index.ts:50`) |
| SR-58 | Met | Section 5 (HC-3, R-0 role check `routine.ts:449-455`); E-06 (`dems_owner` not super) |
| SR-59 | Met (cited) | `modules/demo/index.ts:28` |
| SR-60 | Met | E-05, E-08, E-09 |
| SR-61 | Met | `password-hash.ts:19` (no pepper, no signing secret) |
| SR-62 | Met (cited) | `src/db/seed/seed.ts:3` (shared synthetic dataset) |
| SR-63 | Accepted | C1: the README phrase is present (count 1). C4: every listener is loopback (E-01). Residual R-01 |
| SR-64 | Met | `src/config.ts:47`; `src/app.ts:333`; `packages/shared/src/api/text.ts` |
| SR-65 | Met (cited) | `src/core/event-writer.ts:90` |
| SR-66 | Met | `modules/evidence/index.ts:2` |
| SR-67 | Met | W91 (D241); section 3 (Injection) |
| SR-68 | Met | Section 5 (HC-1 to HC-4) |
| SR-69 | Met (cited) | `plugins/authenticate/console.ts:3` |
| SR-70 | Met | `src/config.ts:54-59` (four origins, no `localhost`) |
| SR-71 | Met | `plugins/throttle/denial-budget.ts:2`; `limits.ts:26-27` |
| SR-72 | Met (cited) | `src/core/types.ts:207`; T-AT-1 to T-AT-5 (D244 run) |
| SR-73 | Met | `plugins/authenticate/credentials.ts`; `authenticate/index.ts:256-262` |
| SR-74 | Met (cited) | `realtime/index.ts:3`; `endBiometricSessions` (`modules/identity/sessions.ts:303-307`) |
| SR-75 | Met | `plugins/throttle/limits.ts:70-84` |
| SR-76 | Met | E-04 equals OR-9 |
| SR-77 | Met | E-05 (key names), E-13 (T-CR-2), `test/static/credentials.test.ts` (E-14) |
| SR-78 | Met | E-06 (`audit_chain_history` S only, trigger `A`) |
| SR-79 | Met (cited) | `src/engine/actor-scope.ts:2` |
| SR-80 | Met | E-07 (SU-1); E-11 (audit output recorded) |
| SR-81 | Met (cited) | `modules/security-audit/stored-chain.ts:3` |
| SR-82 | Met (cited) | `modules/alerts/acknowledge.ts:3`; E-16 (`NONE-P`) |

**Totals: 82 items.** 77 Met (52 shown in this review, 25 Met (cited)), 3 Accepted (SR-14, SR-25, SR-63), 2 Client (SR-16, SR-32), **0 not met**.

---

## 9. Findings

| ID | Severity | Finding | Location | Remediation (row or final-report item) |
|---|---|---|---|---|
| **W99-1** | **Medium (CAUTION)** | `npm audit`: 132 entries, 99 high, 0 critical (full); 124, 96 high, 0 critical (`--omit=dev`). That is up from 50 high at D146 with an unchanged lockfile, and the triage of F29 and D146 F-3 is still open. No entry is on the Core server's runtime path; the highs are in the mobile CLI and build chain (braces, node-forge), the web Scalar chain and a shared test devDependency (undici 7.29.0, fix `>=7.29.1`) | E-11, E-12 | **Final-report open item (W102):** record the triage "0 in the server runtime; highs in mobile tooling, web Scalar and a shared dev parser". **Proposed reserved row W106 (controller decision; not before W103):** a dependency-refresh slot that raises undici to `>=7.29.1` through the Scalar packages and re-runs the suites. Do not run `npm audit fix` blind: it touches the mobile Expo chain |
| **W99-2** | Low | The shared `LOCAL`/`WEB` class bucket and denial budget let any local caller without a credential, a revoked device included, delay pairing redeem and `getSignInStatus` for up to 60 s per window (F76, generalised) | `plugins/throttle/limits.ts:70-96` | Accepted for the loopback demo (D116). **Final-report item** in the "before any use beyond one loopback computer" list: a bucket per retired device ID and per-source keys (a specification change) |
| **W99-3** | Low | Socket caps are per session, not per operator (12 places with three sign-ins). Requests on paths the router cannot decode are outside the throttle (F79 (2), (3)) | `realtime/limits.ts:30`; router stage 1 | Accepted for the demo (D120). **Final-report item**, same list: an operator-level cap and a throttle on refused paths |
| **W99-4** | Low | The `DEVICE_CREDENTIAL_REQUIRED` refusal (a session token used on operation 23 or 8) writes no audit row, only a log line (D118 FU-4) | `permission-guard/decision.ts:169`; `index.ts:276-292` | **Final-report item (next phase):** an `ACCESS_DENIED` row inside the denial budget; this updates [SP:§6.3] and the matrix test. No change now |
| I-1 | Info | A start behind the stored state runs ahead with a warning (DN-B2a-3) | `engine` clock floor (D122) | Next phase: refuse, or require an acknowledgement, above a threshold |
| I-2 | Info | `TOKEN_REUSE` rows name only the presenting device (D123 DN-2) | `modules/identity/biometric/activity.ts` | Next phase: a `tokenDeviceId` detail key |
| I-3 | Info | `apps/core-server/logs/errors.log` has never been written by a real run (F-7). The probe shows it is clean | E-20 | None. Keep in the final report as "proven in process only" |
| I-4 | Info | Owed sign-out: the server session lives until the 15-minute idle expiry | Section 7.13 | W100 (client retry) |
| I-5 | Info | `pg_hba.conf` keeps the two `initdb` `replication` lines (scram, loopback), and `dems_admin` has `rolreplication` | E-05, E-06 | None for the demo. Next phase: drop the replication lines in `pg:init` |
| I-6 | Info | `dems_app` has `TEMPORARY` on `dems_demo` | E-06 | Accepted (F53, D113) |
| I-7 | Info | The Core started by an agent row inherits the agent's environment, including one harness token name (`CLAUDE_CODE_MESSAGING_TOKEN`). The server never reads or logs its environment beyond three variables (`src/index.ts:46-50`). A user's own terminal start (README) is unaffected | E-03 | Host hygiene note for the controller: agent-started servers could be launched with a minimal environment. No project change |
| I-8 | Info | Metro (8081) also opens `UDP *:5353` (mDNS) | E-02 | W100 (client tooling); not a Core listener |
| I-9 | Info | The uncommitted tree deletes `apps/core-web/src/features/home/use-health.ts` (`git status`: ` D`). This is the FXR-W refactor of W92-9 (health query to `lib/`, D242) | `git status --porcelain` | For W100 and W103 to confirm it was intended. Outside the backend scope |

---

## 10. GDPR and ISO 27001 / 27002 / 27701, as applicable to a synthetic-data loopback demo

| Framework item | Status | Note |
|---|---|---|
| GDPR Art. 5 (minimisation), PII inventory | OK | Synthetic data only (SR-62). Audit details hold no credential-like key (E-06) |
| GDPR Art. 25, 32 (privacy by design, security of processing) | OK | Hashed secrets, role separation, append-only audit, loopback only, redacted logs (sections 4 and 5) |
| GDPR Art. 15, 16, 17, 20, 30, 33, 35 | Not applicable | No real personal data. Password change and erasure are out of scope (GS-01, [SP:§15.11]) |
| ISO A.9 (access control) | OK | Server-side RBAC, deny by default (section 4.6). MFA is out of scope ([SP:§15.11]) |
| ISO A.10 (cryptography) | OK within the boundary | Argon2id, SHA-256, CSPRNG. No TLS on loopback (accepted deviation, SR-18) |
| ISO A.12.4 (logging) | OK | Hash-chained audit trail; redacted logs; terse database log |
| ISO A.12.6 (technical vulnerability management) | **Gap**: W99-1 | Audit triage open |
| ISO A.13 (communications) | OK | Loopback only; Origin guard; headers per OR-9 |
| ISO A.14.2 (secure development) | OK | Static guards, 1,757 unit tests in scope, catalog and db suites (D244) |
| ISO A.16 (incident management) | Not applicable | Demo |
| ISO 27701 (PIMS) | Not applicable | No PII |

---

## 11. Verification against the row's criteria

| Criterion (plan row W99) | Result |
|---|---|
| Verdict PASS, CAUTION or FAIL | **CAUTION** (header) |
| Every item has command output or file:line evidence | Sections 2 to 8 (E-01 to E-21; file:line throughout) |
| `npm audit` high and critical counts quoted | **99 high, 0 critical (full); 96 high, 0 critical (`--omit=dev`)** (E-11) |
| The PostgreSQL install is limited to the logged steps, each with its rollback | Section 4.5 |
| Each CAUTION or FAIL names a remediation row | Section 9: W99-1 goes to W102 (final report) plus the proposed reserved row W106; W99-2 to W99-4 are final-report items |
| SC10; SR-01..82; AC-B-66; SD-29 | SC10: no secret committed (E-09), nothing sent out (E-02); SR table, section 8; AC-B-66 PASS (E-02); SD-29 PASS (section 6) |

## 12. What this row did not change
- **Repository and cluster.** Nothing was changed except this report and `delegation_progress/w99_security_backend.md`.
- **Database.** Read-only: one owner session in `BEGIN READ ONLY`, rolled back. The only side effect is `pg:status`'s wrong-password probe, which adds its designed `FATAL` line to `postgresql-07.log` (E-18).
- **Servers.** None was started or stopped. The one request to the Core was the health GET.
- **Credentials.** No credential was printed or passed as an argument.
- **Tracking files.** `masterplan/02_plan.md` is not updated, by the brief's hard rule. The controller updates the tracker.
- **Scratch scripts.** They live in the session scratchpad (`scratchpad/w99/`), outside the repository.

---
*Generated: 2026-10-07 09:05 WIB*
*Last Updated: 2026-10-07 09:12 WIB*
