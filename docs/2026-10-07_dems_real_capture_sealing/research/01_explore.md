---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-07
agent: explore
persisted_by: controller (worker had no write tool; document saved from its final message, commands and outputs preserved)
blueprint_row: 1
milestone: M0
class: A
type: read-only re-verification of repository facts
tier: 2
repository_state: branch main, HEAD 2a4f4ea063d1a7c72d3fb70d4951fa63029e57a8; phase code baseline c2c983b
confidence: HIGH — every claim is a command with its real output, or a file:line read
status: complete (all 10 facts PASS, no delta)
---

# Row 1 re-verification: impact-map repository facts against the current tree

## 0. Verdict table

| # | Fact | Expected | Actual | Verdict |
|---|---|---|---|---|
| 1 | HEAD, branch, working tree | `2a4f4ea`, clean | `2a4f4ea063d1a7c72d3fb70d4951fa63029e57a8`, `ref: refs/heads/main`; 0 source changes | PASS (see 2.1 for the two controller-doc modifications) |
| 2 | Source files under apps/ packages/ scripts/ changed after 2026-10-07 12:40 | 0 or listed with map rows | **0** | PASS |
| 3 | F-01 "no real ingest": non-test hits in `apps/core-server/src` | 0 | **0 code hits** (1 comment, tests only otherwise) | PASS |
| 4 | Static guards | 21 | **21** `static.test.ts` under `apps/core-server/src/**/__tests__` | PASS |
| 5 | Registry operations | 75 | **75** unique operation IDs (source and committed openapi.json agree) | PASS |
| 6 | `chrome-lost-updates` path + workspace | stated | `apps/mobile/src/navigation/__tests__/chrome-lost-updates.test.tsx`, workspace `apps/mobile` (jest) | PASS |
| 7 | Three FAULT_KIND CHECKs (E-01) + signature CHECK (D228) | :281, :382, :488, :336 | confirmed at exactly those four lines | PASS |
| 8 | Migration files | 0000..0003 only | 0000_prelude, 0001_tables, 0002_audit_guards, 0003_privileges | PASS |
| 9 | Read-only zones `apps/mock-core`, `release` untouched | untouched | `git diff --stat c2c983b..HEAD -- apps/mock-core release` empty | PASS |
| 10 | Test-file inventory vs ledger | 71/117/192 + 160/124 + mock-core | shared 71, core-web 117, mobile 192, core-server 284 = unit 160 + db 124, mock-core 4 | PASS at file level (test counts owned by row 27) |

**Bottom line for row 6 (register) and row 39 (M0 gate): no delta to fold in.** The impact map plus its 31 errata still describe the tree at `2a4f4ea`.

## 1. Method and worker tool limits

| Item | Detail |
|---|---|
| Commands used by the worker | `git rev-parse`, `git log`, `git status`, `git diff`, `rg` (ripgrep 15.2.0), `ls`, `wc`, `date` |
| Denied in the worker sandbox | `find *`, `sed`, `node -e`, `git worktree list`, `git -C <dir> …`, chained `git … && …`, output redirection (`*>*`) |
| Consequence | The blueprint's mtime scan (`find -newermt`) could not run; fact 2 proven from git content + untracked-file check (stronger for tracked files). No file could be written by the worker — hence controller persistence |
| Reads | handoff §6/§8, blueprint row 1, impact map + drift check (E-01..E-06, §1.6, §2.3, §7) |

## 2. Fact-by-fact evidence

### 2.1 Fact 1 — HEAD, branch, working tree

| Command | Output |
|---|---|
| `git rev-parse HEAD` | `2a4f4ea063d1a7c72d3fb70d4951fa63029e57a8` |
| `git log --oneline -5` | `2a4f4ea docs: task 3 blueprint (approved, all defaults) and handoff to Kilo` · `85c0fb5 docs: next-phase drift check and decision D260` · `c2c983b docs: final report, W103 commit record and decision log D259` · `0a9e317 feat: PostgreSQL backend, RBAC and pairing — end-to-end Live round…` · `057fc17 feat: Live mode for the web console and mobile app pages…` |
| `git log -3 --format="%h %ad %s" --date=iso-local` | `2a4f4ea 2026-10-07 13:22:34 +0700` · `85c0fb5 2026-10-07 12:42:50 +0700` · `c2c983b 2026-10-07 12:26:19 +0700` |
| `git status --porcelain` | ` M docs/2026-10-07_dems_real_capture_sealing/decisions/decisions.md`<br>` M docs/2026-10-07_dems_real_capture_sealing/status_tasks.md` |
| `.git/HEAD` | `ref: refs/heads/main` |

Verdict: HEAD equals expected `2a4f4ea` on `main`, code baseline `c2c983b` two commits back. The only dirty files are two controller-owned trackers written during wave A — not project source.

### 2.2 Fact 2 — source changes after 2026-10-07 12:40

| Command | Output |
|---|---|
| `git diff --name-only c2c983b..HEAD -- apps packages scripts` | *(no output)* |
| `git log --since="2026-10-07 12:40" --name-only --oneline` | `2a4f4ea` + 8 paths under `docs/2026-10-07_dems_real_capture_sealing/`; `85c0fb5` + 4 paths under `docs/2026-10-04_dems_backend_rbac_pairing/` — docs only |
| `git diff --name-only c2c983b..HEAD` | 12 paths, all under `docs/` |
| `git status --porcelain -uall` | the same two tracker lines; **no `??` entry** |

**Count = 0.** No impact-map row (SH/CS/WB/MB/DOC/NM) is hit by any change between `c2c983b` and HEAD.

### 2.3 Fact 3 — F-01 "no real ingest exists"

| Command | Output | Classification |
|---|---|---|
| `rg -n -i -w "rtsp\|onvif\|live555\|gstreamer\|ffmpeg\|whisper\|mediamtx\|libav" apps/core-server/src` | *(no output)* | 0 hits |
| `rg -n -i -w "rtp\|h264\|lavfi\|coreaudio\|avfoundation\|dshow\|v4l2\|sounddevice\|pyaudio" apps/core-server/src` | *(no output)* | 0 hits |
| `rg -c "child_process\|spawn(" apps/core-server/src` | 8 files / 9 lines, all in `__tests__` static guards (engine, security-audit, db/fixtures, db/mapping, db/reset, evidence, system, + storage static-rules) | test-side only |
| `rg -li -e "microphone" -e "getUserMedia" -e "mediaDevices" -e "audio[-_ ]?capture" apps/core-server/src` | `modules/devices/index.ts:3` (file-header comment) + 3 db test files | 1 comment, no API call |

**Non-test ingest hits = 0.** `apps/core-server/src/modules` lists no `capture-config` or `evidence-media`; `packages/shared/src/api` has no `capture.ts`.

### 2.4 Fact 4 — static-guard count

| Command | Output |
|---|---|
| `rg --files apps/core-server/src -g "static.test.ts" \| wc -l` | **21** |
| `rg --files apps/core-server -g "*static*"` | 24 = 21 src guards + 2 rule libraries (`modules/system/__tests__/static-rules.ts`, `modules/storage/__tests__/static-rules.ts`) + 1 outside src (`test/helpers/db/__tests__/static.test.ts`) |

The 21 folders: core, db/fixtures, db/mapping, db/reset, db/store, engine, realtime, modules/{identity/biometric, identity, devices, network-time, pairing, sessions, storage, system, admin, alerts, evidence, security-audit}, plugins/permission-guard. Rules located at `modules/system/__tests__/static-rules.ts:63-66` (HOST_MODULE regex over node built-ins incl. `child_process`, `fs`), `engine/__tests__/static.test.ts:29` (OUTSIDE_WORLD), `security-audit/__tests__/static.test.ts:90`, `evidence/__tests__/static.test.ts:81`, `db/fixtures/__tests__/static.test.ts:36` (DRIVER_IMPORT), `db/mapping/__tests__/static.test.ts:122`.

Outside that glob (disclose to row 6 so it does not double-count): `apps/core-server/test/static/` holds 13 `*.test.ts` scanners + helpers `scan.ts`, `imports.ts`, `log-calls.ts` — drift-check P-09 / HBX-13 still true, deferred by OD-26.

### 2.5 Fact 5 — registry operation count

| Command | Output |
|---|---|
| `rg -o "operationId: '[A-Za-z0-9_]+'" packages/shared/src/api --no-filename \| sort -u \| wc -l` | **75** |
| duplicate check | only `setStoragePolicy` twice — the second is an `apiErrorExample` payload (`storage.ts:180`), not a registry entry |
| structure | 10 inline entries in `core-api.ts:601-811` + 65 from the 12 module arrays spread at `core-api.ts:884-895` = 75 |
| `rg -o "\"operationId\": \"[A-Za-z0-9]+\"" --no-filename packages/shared/openapi/openapi.json \| sort -u \| wc -l` | **75** (committed document agrees) |

Where 75 is pinned: `apps/core-server/test/acceptance/contract.test.ts:374-378` (`toHaveLength(75)`, 27 GET / 48 POST, unique-ID), `:424`, `:433`; `apps/core-server/test/acceptance/rbac-matrix.test.ts:897-901`, `:1043`, `:1058`; `apps/core-web/src/test/live-api-reference-document.test.tsx:143`, `:232`, `:234`; `apps/core-web/src/test/live-api-reference-page.test.tsx:128`, `:132`, `:135`, `:302`, `:303`.

OpenAPI versions (for row 29): `openapi.ts:100` `OPENAPI_VERSION = '3.1.0'`; `:102` `OPENAPI_DOCUMENT_VERSION = '0.1.0'` (**offline scope still 0.1.0** — OD-17/row 29 must name both); `:106` `OPENAPI_CORE_SERVER_DOCUMENT_VERSION = '0.2.1'` (all scope); `packages/shared/openapi/openapi.json:5` `"version": "0.2.1"`.

### 2.6 Fact 6 — `chrome-lost-updates` (feeds row 21)

| Item | Value |
|---|---|
| Path | `apps/mobile/src/navigation/__tests__/chrome-lost-updates.test.tsx` |
| Workspace | `apps/mobile`, **jest** (`jest.config.js:9-10` `testTimeout: 20000` per D239/D246, `:11-12` `maxWorkers: '50%'`) |
| Tests | 4 (`rg -c "^\s+it("`) |
| Wall-clock waits | helper `async function wait(ms)` at `:123`, awaited at `:150`, `:162`, `:181` (`MOTION_OVER_MS`) |
| D246 residual | first `it()` at `:140` (Evidence gold / Sessions grey pill) — no per-test timeout |

B10 target paths all confirmed: `apps/mobile/src/features/session-live/live-gap-read-only-dialog.test.tsx` (row 16), `apps/mobile/src/features/settings/live-settings-boundary.test.tsx` (17), `apps/mobile/src/features/session-live/live-session-live-link.test.tsx` (18), `apps/core-web/src/test/live-paired-devices-issue.test.tsx` (20). Row 22 anchor intact: `apps/mobile/src/runtime/recording-elapsed.ts:128` `export function useRecordingTickerSeconds`, `:129` first line.

### 2.7 Fact 7 — CHECK sites

`rg -n "session_history_outcome_check\|alerts_kind_check\|health_snapshots_cause_check\|evidence_items_signature_check" apps/core-server/src/db/migrations/0001_tables.sql`:

| Expected | Actual | Content |
|---|---|---|
| `:281` | `:281` | `session_history_outcome_check` — `outcome IN ('SEALED','INCOMPLETE') AND (fault_kind IS NULL OR (outcome='INCOMPLETE' AND fault_kind IN (…12 kinds…)))` |
| `:382` | `:382` | `alerts_kind_check` — `severity IN (…) AND (kind='SYSTEM' OR kind IN (…same 12…))` |
| `:488` | `:488` | `health_snapshots_cause_check` — `cause IN (…) AND (cause='INTERVAL')=(fault_kind IS NULL) AND (fault_kind IS NULL OR fault_kind IN (…same 12…))` |
| `:336` | `:336` | `evidence_items_signature_check` — `signature_algorithm = 'SIMULATED-SHA256' AND signature_simulated` |

Columns: `session_history.fault_kind` `:277`, `health_snapshots.fault_kind` `:474`. All three CHECKs enumerate the same 12 kinds → migration 0004 touches three sites (E-01 confirmed).

**Citation nuance for row 30:** blueprint cites `:335-336`; `:335` is `evidence_items_hashes_check` (`manifest_hash ~ '^[0-9a-f]{64}$' AND signature_value ~ '^[0-9a-f]{64}$'`) and only `:336` is the signature CHECK. A real Ed25519 value is not 64 hex chars, so both lines matter — attribute each separately.

### 2.8 Fact 8 — migrations present

`ls apps/core-server/src/db/migrations/` = `0000_prelude.sql`, `0001_tables.sql` (557 lines), `0002_audit_guards.sql`, `0003_privileges.sql`. No `0004`/`0005` anywhere under `apps/core-server/src/db/` — free numbers for row 30.

### 2.9 Fact 9 — read-only zones

| Command | Output |
|---|---|
| `git diff --stat c2c983b..HEAD -- apps/mock-core release` | *(empty)* |
| `ls apps` | `core-server core-web mobile mock-core` (no new workspace) |
| `ls packages` | `shared` (no `capture-protocol`) |
| `ls release` | `RUN-ON-ANOTHER-PC.md android web` |

### 2.10 Fact 10 — test-file inventory

| Workspace | Files | Ledger | Cross-check |
|---|---|---|---|
| packages/shared | 71 | 71 / 1,851 | match |
| apps/core-web | 117 | 117 / 1,495 | match |
| apps/mobile | 192 | 192 / 1,988 | match |
| apps/core-server | 284 = unit 160 + db 124 (118 `*.db.test.ts` + 6 `test/acceptance/**`, overlap 0) | 160 / 3,954 + 124 / 1,751 | match (split per `vitest.config.ts:15-19`, `:31-51`, `maxWorkers: 2` at `:23`) |
| apps/mock-core | 4 files (`ws-origin`, `health`, `heartbeat`, `standalone-launcher`) | 4 / 19 | match (ledger's "19" is the test count) |
| scripts/ | 7 files | 57 node tests | file vs test count |
| apps + packages total | 668 | 664 (drift check) | 668 − 4 (mock-core) = 664 |

Test **counts** (1,851 etc.) not re-executed: row 27 owns that evidence.

## 3. Non-blocking records

| Item | Evidence | Consequence |
|---|---|---|
| Graft already initialised at project root | `graft/` with `INDEX.md`, `apps`, `docs`, `packages`, `scripts`; `graft/INDEX.md:14` records 1,981 wiring cards, 1,777 with symbols | No `graft init` needed by any row (GRAFT BOOTSTRAP satisfied, recorded in `initialization/01_env_check.md`) |
| Idle Kilo worktree `.kilo/worktrees/immense-slime` | `.git/worktrees/immense-slime/HEAD` = same commit `2a4f4ea`; `git worktree list` / `git -C` refused in the worker sandbox; controller re-confirmed earlier: clean, same commit | Not divergent work; do not edit or clean it up |
| TypeScript files under apps+packages+scripts | 1,906 | no new workspace/module/migration appeared |

## 4. Consequences for dependent rows

| Row | What changes |
|---|---|
| 6 | No delta to fold in; add three citations: offline OpenAPI constant still `0.1.0` (`openapi.ts:102`); `:335` hashes CHECK vs `:336` signature CHECK; 21 src guards sit beside a 13-file static suite in `test/static/` |
| 16-21 | All five B10 files exist at the named paths; row 21's workspace is `apps/mobile`; waits to remove are the three `wait(MOTION_OVER_MS)` awaits behind `:123` |
| 22 | Anchor code intact at `recording-elapsed.ts:128-129` |
| 27 | File-level floors confirmed; test counts pending |
| 30 | Only 0000-0003 exist; CHECK sites `:281/:382/:488`, signature `:336` (hashes `:335`) |
| 39 | Baseline intact at `2a4f4ea`; deviations limited to the wording items above |

## 5. Attestation

No file under `apps/`, `packages/`, `scripts/`, `release/` was created, edited, deleted or renamed by this row. No suite, server, emulator or database was started. No credential file (`.data/pg.pwfile`, `.data/pg.owner.env`, `.data/pg.env`) was printed, staged or passed as an argument; no repository content left the machine.

---
*Generated: 2026-10-07 (worker) · persisted: 2026-10-07 (controller)*
*Last Updated: 2026-10-07*
