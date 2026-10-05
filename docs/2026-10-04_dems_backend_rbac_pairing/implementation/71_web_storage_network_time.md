---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: W71 (plan step 93; provisional rows 71 and 72, merged)
agent: coder-execution
date: 2026-10-05
source_plan: masterplan/02_plan.md (row W71; gate CLG of section 11, rev 2.1 rule for storage-page.test.tsx)
status: complete
---

# W71 — Web Storage (settle site B-9) and Network & Time in Live mode

Tier 2 record: what was built, why, and how it was verified. Code is cited as `path:line` relative to the
repository root; `[CS:…]` is `masterplan/04_client_integration_spec.md`, `[CP:§8 rule n]` is
`gateway_check/08_cp_web_runtime.md` section 8 with the amendments of its section 30, `[DEC:…]` is
`decisions/decisions.md`. No credential value appears in this file or in the assets: the lane driver reads the
demo password from the seed source and never prints it (a scan of every `71_*` asset found nothing, section 6.5).

## 1. Result

| Gate item | Result | Evidence |
|---|---|---|
| SG: typecheck and lint of `@dems/core-web` | exit 0, exit 0 (23:15) | section 6.1 |
| SG: typecheck and lint of `@dems/shared` (one i18n file) | exit 0, exit 0 (23:15) | section 6.1 |
| SG: `@dems/core-web` suite | **71 files / 956 tests, exit 0** (23:12:33–23:14:35), above the floor 62 / 853 | section 6.1 |
| SG: `@dems/shared` suite | **68 files / 1,814 tests, exit 0** (23:14:42) | section 6.1 |
| CLG (a) Storage: existing tests pass; `storage-page.test.tsx` holds W01's state | `storage-model.test.tsx` absent from `git diff --stat acaff20`; `storage-page.test.tsx` = `71f6f033…` (W01's recorded hash), never edited; both pass (13 + 9) | section 6.2 |
| CLG (a) Network & Time: existing tests pass; `git diff --stat acaff20 -- …/network-time` lists test files only | the diff lists **no file at all** (no production file and no test file changed); both tests pass (4 + 4) | section 6.2 |
| CLG (b) Storage, site B-9: success, refusal with the denied toast, outage | 3 success, 3 refusal (403 by `fake.example('setStoragePolicy', 403, 'notPermitted')`, 403 in the Core's own spelling, 422), 3 outage/limit, 1 pending; plus 2 Simulated control tests | section 4.1 |
| CLG (b) Network & Time: the page shows the server's data and claims no simulation | 7 Live tests: the Core's values, deltas, outage, static rules | section 4.3 |
| CLG (c) both folders | `grep` finds no `useSimActions` and no `.actions` read on a `Sim`; static tests hold it | section 6.3 |
| CLG (d) one live check on a lane, at most 10 minutes, with screenshots | lane 3, 23:10:35–23:11:34 (59 s); 7 screenshots; the policy set back and equal to before; ports free | section 5 |
| M15 mutation check (in memory, no tree file changed) | 28 mutations: 28 detected, 0 survived | section 7 |

## 2. What was built

### 2.1 Site B-9: Apply policy in the Manage Storage drawer (`apps/core-web/src/features/storage/manage-drawer.tsx`)

| Part | Where | What and why |
|---|---|---|
| Words by mode | `manage-drawer.tsx:30-33` (`APPLIED_WORDS`) | Simulated mode keeps "Storage policy updated (simulated)" (`storage.manage.applied`); Live mode uses `storage.manage.live.applied`, "Storage policy updated": the Core server applied the change ([CS:§3.2]) |
| LB-1, spinner late | `manage-drawer.tsx:45-56` (`usePendingReveal`) | The pending look appears only after `LIVE_PENDING_REVEAL_MS` × the motion policy's time scale ([CS:§8.1 LB-1]); same shape as the gated Dashboard site |
| The command | `manage-drawer.tsx:83-118` (`useApplyPolicy`) | Actions from `useCoreActions()` (`:85`); the call inside `settle` (`:99`) [CP:§8 rule 1]; success toast and drawer close in `ok` (`:100-103`), so both follow the Core's answer (LB-3, B-9 "the drawer closes and the toast shows in `ok`"); `fail` hands the error to the presenter first (`:105`) [CP:§8 rule 2]; what the presenter leaves to the page (the Core's 422 rebuilt as `SimTransitionError` with `POLICY_RANGE`, binding `packages/shared/src/live/source/bindings.ts:462-467`) keeps the predecessor's toast `storage.manage.failed` and writes one record (`:106-107`) ([CS:§8.3 B-9]). On every refusal the drawer stays open with the draft |
| LB-1, busy at once | `manage-drawer.tsx:96`, `:221` | A ref answers a second press at once (`:96`); the drawer footer carries `aria-busy` while a Live command is out (`:221`), because the kit's `Button` drops `aria-busy` (F63-2). Apply is NOT disabled at the press: LB-1 says the look does not change for the first `LIVE_PENDING_REVEAL_MS` |
| Pending look | `manage-drawer.tsx:228-233` | After the reveal time: `isPending` and the kit's `Spinner` inside Apply (as `features/login/auth-card.tsx:361-371`); nothing is added outside the pressed control |
| The gate | unchanged | `selectCanManage` (EVIDENCE_REVIEW or MAINTENANCE) reads the replica's permissions in Live mode, so an INVESTIGATOR sees Apply disabled with "Requires the Supervisor / Technician role", as before |

In Simulated mode `settle` runs `ok` or `fail` and `done` before it returns ([CS:§2.5 CL-25]), so `busy` goes
true and false inside one press and React renders neither: the look never changes and the outcome (store,
synchronous audit row, "(simulated)" toast, closing drawer) is the predecessor's. The protected folder test
(`storage-page.test.tsx:250-280`) and two control tests pin it (section 4.2).

### 2.2 The page's own record (`apps/core-web/src/features/storage/log.ts`, rewritten)

`logStorageError(source, error, context, sink?)` (`log.ts:48-63`) now writes one record of level `error` to
`webErrorSink` of `@/runtime` (in memory in every build, printed in a dev build, never sent, never stored —
[CS] runtime decisions D3, D4, D41(g)) instead of `console.error` with the error's text and stack. Discipline of
CPW1-8 / D144(1), as W63's `report.ts` and W64's `log.ts`: the message is a fixed sentence naming the step
(`:58`); the cause is named by `errorName`, `code`, `status` (`:28-35`); the stack keeps its frames without the
first line, which repeats the message (`:38-42`); a correlation ID `stor-<time>-<n>` (`:22-25`, `:61`). The
signature is unchanged, so the panel boundary (`panel.tsx:76`) uses it as before; only its docblock changed
(`panel.tsx:62-66`).

### 2.3 The SMART footnote (`apps/core-web/src/features/storage/volumes-panel.tsx`)

`DERIVED_NOTE` (`volumes-panel.tsx:17-26`), read at `:38`: Simulated mode keeps "SMART values are demo values
derived by the console until the simulator models them"; Live mode says "SMART values are demo values derived
by the console: the Core server does not report them". Why: the Core reports no SMART counters
(CONTRACT-GAP-W71-1, section 8); the counters are derived in the browser by `driveHealth`
(`packages/shared/src/sim/views.ts:206-221`), and a Live screen never names a simulator ([CS:§3.2]).

### 2.4 Words (`packages/shared/src/i18n/en/storage.ts`, additive)

`storage.volumes.live.derivedNote` (`storage.ts:119-122`), `storage.manage.live.applied` (`storage.ts:209-212`),
one header comment line. No key was changed or removed:
`git diff acaff20 -- packages/shared/src/i18n/en/storage.ts | grep -c "^-[^-]"` prints `0`.
`network-time.ts` is unchanged.

### 2.5 Network & Time: no production change

[CS:§7.3] G9 ("Operations in Live mode: none", "No change") and [CS:§17.4] Row 21 #3 hold: the page reads
`time`, `network`, `ports`, `tabletLink`, `events`, `faults` and the clock, all replicated slices
(`packages/shared/src/api/state-slices.ts:794-823`), and needs no change to be truthful in Live mode — proven by
the Live tests (section 4.3) and the lane (section 5). Nothing to report as `needs-review`.

### 2.6 Tests (new)

| File | Tests | What |
|---|---:|---|
| `apps/core-web/src/test/live-storage-policy.test.tsx` | 12 | Site B-9 on the fake transport (4.1) and the Simulated control group (4.2) |
| `apps/core-web/src/test/live-storage-page.test.tsx` | 9 | The Storage page on the Core's data, a delta, an outage, the page's record, the static rules of the folder (4.1) |
| `apps/core-web/src/test/live-network-time-page.test.tsx` | 7 | The Network & Time page on the Core's data, deltas, an outage, the static rules of the folder (4.3) |

All three carry the page address `http://127.0.0.1:5178/` in the docblock, call `clearToasts()` after each test
and query toasts inside `[data-slot="toast"]` [CP:§8 rule 5]. Health comes from the bed (no global-`fetch` stub;
rule 5 as amended in section 30). The 403 is named by its example:
`bed.fake.example('setStoragePolicy', 403, 'notPermitted')` (`live-storage-policy.test.tsx:232`).

## 3. What each page reads in Live mode

| Page / panel | Source in Live mode | Gap? |
|---|---|---|
| Storage: banner, capacity ring, policy scale | `storage` (replicated), thresholds of the shared engine | None |
| Storage: KPI cards | `storage.writeBytesPerSec`, `session`, `storagePolicy`; the 8.2 GB/h caption is the engine constant `RECORDING_BYTES_PER_HOUR` (`kpi-cards.tsx:21`), the same engine the Core runs | None |
| Storage: usage over 24 h, sealed per hour | `storage.history`, `evidence`, the Live clock | None |
| Storage: volumes & health | `storage.volumes`, `health` temperatures, `meta.createdAt`; SMART counters derived in the browser | **CONTRACT-GAP-W71-1** (footnote says so) |
| Storage: recent activity | `events` filtered to storage | None |
| Storage: retention calculator | operator inputs, `storagePolicy`, `storage` capacity | None (a calculator, labelled "Demo defaults") |
| Network & Time: all six panels | `time`, `network`, `ports`, `tabletLink`, `events`, `faults`, the Live clock | None. The A/V sync strip is derived from the time lock and already says "Derived for the demo" in both modes (F71-5) |

## 4. Live tests

### 4.1 Storage on the fake transport

`live-storage-policy.test.tsx` (site B-9):

| Test (line) | Covers | Asserted |
|---|---|---|
| `:167` SUPERVISOR success | B-9 success, LB-3, CL-16, §3.2 | one `POST /api/v1/storage/policy` with `{ retentionPolicy: 'YEAR_1', autoArchive }`; toast "Storage policy updated" after the answer (delta first); no "simulat" word; drawer closed; the page shows the Core's policy ("1 year", "365days"); no record; no missing i18n key |
| `:197` TECHNICIAN success | the other half of the any-of | Apply enabled; auto-archive off sent as chosen |
| `:217` INVESTIGATOR | the gate on the Core's session | "Requires the Supervisor / Technician role"; Apply disabled; no request |
| `:230` 403 `notPermitted` | AC-C-48, LB-5, F64 | denied toast "Not permitted", one danger toast; no role of the wrong kind named; no success or friendly toast; drawer open with "1 year"; footer not busy; Apply idle; no page record |
| `:256` 403 in the Core's spelling | F64, D88 | envelope `permission: EVIDENCE_REVIEW_OR_MAINTENANCE` (as the lane's Core sends it, section 5) reads the same |
| `:276` 422 | B-9 "422 → POLICY_RANGE → storage.manage.failed" | friendly toast; no denied or outage toast; one record: fixed message, `retentionPolicy`, `errorName: SimTransitionError`, `code: POLICY_RANGE`, `stor-` correlation ID, no error text; drawer open with the draft |
| `:301` outage of the request | LB-6 | "Core server unreachable. Nothing was changed."; drawer open with the draft; no record |
| `:316` link down | CL-22, AC-C-59 shape | five presses, one toast, **no request** |
| `:333` 429 | LB-10 | "…Try again in 12 s."; no outage sentence; link ONLINE; indicator without OFFLINE; drawer keeps "1 year" |
| `:350` pending | LB-1, AC-C-58 shape | `aria-busy` on the footer at once, Apply neither pending nor disabled, no element added; a second press sends nothing; spinner (`data-pending`) after the reveal time with nothing added outside Apply; toast and closing only after `held.release()` |

`live-storage-page.test.tsx`:

| Test (line) | Covers | Asserted |
|---|---|---|
| `:128` the Core's data | G13, §3.2 | a Core at 90 % LOW, "Until case closure", no auto-archive: banner LOW, policy, scale tone, KPI "3,650days" and "auto-archive off", one card per Core volume, "90% used", the Live footnote; no "simulat" word anywhere; no storage operation called by the page |
| `:152` a delta | G13, M-PG-STOR | policy DAYS_30 and a LOW fill arrive by delta: policy, banner, KPI follow; the page's own LOW toast |
| `:171` an outage | §21.2 of W54 | the page keeps the Core's last data; no "unreachable" text and no alert inside the page |
| `:186`, `:203` the page's record | error logging, CPW1-8 | fixed sentence, class, code, status, correlation ID, no error text; the panel boundary writes one such record |
| `:236`–`:268` static rules | CLG (c), AC-C-53, MD-6 | no `useSimActions`, no `.actions`, no `SimContext`/`live.source`; exactly one `actions.setStoragePolicy(` inside `settle(() => …)`; the presenter before the record and the toast; no client, Live source, socket or test double; no `console.*`; `log.ts` writes to the sink and never `error.message` |

### 4.2 Simulated control group (`live-storage-policy.test.tsx`)

| Test (line) | Asserted |
|---|---|
| `:439` TECHNICIAN apply | the store holds YEAR_1 and its STORAGE_POLICY_CHANGED audit row right after the press (synchronous); footer never busy, Apply never pending; "(simulated)" toast; drawer closes |
| `:455` volumes footnote | the Simulated words, not the Live ones |

### 4.3 Network & Time on the fake transport (`live-network-time-page.test.tsx`)

| Test (line) | Asserted |
|---|---|
| `:135` the Core's data | a Core with its own address and LAN name, 9 satellites, one PoE port down: Live clock at UTC+07:00, source, GNSS active, "9 SV", last sync, "192.168.10.77 · Core LAN B", "1/2 ports", tablet, events, the offset history length; no "simulat" word; `getTimeStatus` and `getNetworkStatus` never called, and no call beyond session and health |
| `:169` GNSS loss by delta | active tier NTP, "NTP fallback", warning tone, orbit unlocked, the page's warning toast; recovery by delta and its toast |
| `:186` tablet link offline by delta | "Offline", "Recording continues on the Core", Management "Degraded", the toast |
| `:200` an outage | last data kept; no page notice; no "simulat" word |
| `:226`–`:240` static rules | no `useSimActions`/`useCoreActions`, no `.actions`, no `SimContext`/`live.source`, no client, Live source, socket, `useWebLive` or test double |

## 5. Live check on lane 3 (CLG (d))

W50's lane, lock and ports through W63's script, adapted to the lane number only (`K="${W71_LANE:-3}"`, ports
`4420+K`, `5175+K`, `9395+K`), the paths, step 4 and the log greps. Lane 1 was tried first at 23:09:26 because
lane 3 was then held by another row (`lockf` held by pid 89769, listeners 4423 and 5178); lane 1's lock was held
too (`lockf: .locks/core-server.lane1.lock: already locked`, exit 75 after 60 s, `assets/71_lane_run_1_lock_busy.log`;
nothing was started). At 23:10:30 lane 3 was free:

`/usr/bin/lockf -k -t 60 .locks/core-server.lane3.lock env W71_LANE=3 /bin/sh .cache/w71/lane/run_lane.sh`
(sandbox bypass for port binding and the browser). Backend `127.0.0.1:4423` on `dems_lane_3` (not reset; demo flag
off), Vite `127.0.0.1:5178`, HeadlessChrome/153.0.8010.12 over CDP at 1920×1080. Scripts:
`assets/71_lane_run_lane.sh.txt`, `assets/71_lane_cdp_driver.mjs.txt`; log `assets/71_lane_run_3.log`; browser
record `assets/71_lane_browser_3.json`. Run time 23:10:35 – 23:11:34 (driver 56 s).

| Step | Observed | Screenshot |
|---|---|---|
| Login page | `data-core-mode="LIVE"` | |
| Seeded SUPERVISOR through the form, `/storage` | sign-in 200; socket `ws://127.0.0.1:5178/ws` 101 with the cookie (`hello`, `snapshot`, `heartbeat`, `meters`, `delta`); indicator LIVE; eight panels; banner READY "3.2 TB free · about 389h 45m of recording left"; "90 days"; volumes `NVME-SYS`, `HDD-EVIDENCE`; footnote "…derived by the console: the Core server does not report them"; **`saysSimulated: false`**; no console error or warning. The Core's policy read by a page request: `DAYS_90 / 90 / true` | `71_storage_live_supervisor.png` |
| B-9 through the drawer: "1 year" → Apply | `POST /api/v1/storage/policy` **200**; toast "Storage policy updated"; drawer closed; policy "1 year"; first activity row "Storage policy changed · 365 days · auto-archive on"; the Core holds `YEAR_1 / 365 / true`; `saysSimulated: false` | `71_storage_live_b9_applied_drawer.png` (before Apply), `71_storage_live_b9_applied.png` |
| **Set back**: "90 days" → Apply | `POST` **200**; toast; the Core holds `DAYS_90 / 90 / true`, **equal to before** (`equalsOriginal: true`; no exact-days repair was needed) | |
| `/network-time`, same operator | six panels; LIVE; clock 23:11:02; "GPS (GNSS stratum 1)"; GNSS active; "13 SV"; LAN "192.168.10.21 · Interview LAN · 1 Gbps"; PoE 2/2; **tablet link Offline** with "Recording continues on the Core…", Management "Degraded" (the Core's truth: no tablet on the lane, F71-6); 6 log rows; 120 offset points; **`saysSimulated: false`**; the only request `GET /api/v1/auth/session` | `71_network_time_live.png` |
| Sign-out (204); seeded INVESTIGATOR through the form; `/storage` drawer | "Requires the Supervisor / Technician role"; Apply disabled ("No change to apply") | `71_storage_live_investigator_drawer.png` |
| The Core's answer to this INVESTIGATOR for operation 55 (a page request; the UI does not offer it) | `403`, `NOT_PERMITTED`, `details: { operationId: setStoragePolicy, permission: EVIDENCE_REVIEW_OR_MAINTENANCE, role: INVESTIGATOR }` — the spelling of F64 / CONTRACT-GAP-5; the policy unchanged | |
| Simulated (stored `SIMULATED`) | login `data-core-mode="SIMULATED"`, Sign In disabled (mock-core offline, F63-3), so the simulator's stored sign-in `dems.auth` (operator ID and time, no credential) was used; Storage: indicator SIMULATED, the simulator's dataset, the Simulated footnote; Network & Time: tablet Connected; **0 requests to `/api/v1`, 0 sockets to `ws://127.0.0.1:5178/ws`** | `71_storage_simulated.png`, `71_network_time_simulated.png` |

The lane database before and after (`npm run db:status -w @dems/core-server -- --database dems_lane_3`):
audit head seq 122 → 129 (two sign-ins, two sign-outs, two STORAGE_POLICY_CHANGED, one ACCESS_DENIED),
`auth_sessions` 14 → 16, `events` 89 → 95. **The storage policy was changed once and set back to what it was**
(`DAYS_90`, 90 days, auto-archive on); the audit rows of both changes stay (the trail is append-only). The
backend's log had 0 lines of level error or fatal; its route lines: `/api/v1/storage/policy` 200 ×2, 403 ×1;
`/api/v1/storage/detail` 200 ×4 (the driver's reads).

Stop, quoted from `71_lane_run_3.log`:

```
== 23:11:34 stop what this check started
chrome stopped
vite: npm exit status 143
backend: npm exit status 0
== 23:11:34 listeners left on 4423, 5178, 9398 (expect none):
lsof exit 1 (1 with no output: no listener)
```

At 23:12:28 `lsof -nP -iTCP:4423 -iTCP:5178 -iTCP:9398 -sTCP:LISTEN` printed nothing (`lsof exit 1`). Ports
4432 (used by the backend only), 5432, 5173 to 5175, 4400, 4421/5176 and 4422/5177 were not touched.

## 6. Verification (commands and the last lines of their output)

### 6.1 Suites, typecheck, lint

`uptime` before each whole suite: 23:12 load 6.05 (below 10).

```
$ npm run test -w @dems/core-web -- --maxWorkers=2        (23:12:33 – 23:14:35 WIB)
 Test Files  71 passed (71)
      Tests  956 passed (956)
   Duration  120.85s
core-web suite exit=0
  per file (JSON report): live-storage-policy 12/12, live-storage-page 9/9, live-network-time-page 7/7,
  features/storage/__tests__/storage-model 13/13, storage-page 9/9,
  features/network-time/__tests__/network-time-model 4/4, network-time-page 4/4

$ npm run test -w @dems/shared -- --maxWorkers=2          (23:14:42 WIB)
 Test Files  68 passed (68)
      Tests  1814 passed (1814)
shared suite exit=0

$ npm run typecheck -w @dems/core-web    > tsc -b      exit=0
$ npm run lint -w @dems/core-web         > oxlint      exit=0
$ npm run typecheck -w @dems/shared      > tsc --noEmit exit=0
$ npm run lint -w @dems/shared           > oxlint      exit=0
```

No red file in the run, so no other row's file to name. The whole gate output is `assets/71_gate.log`.

### 6.2 CLG (a)

Before the first edit (22:53:39) and after it (22:55:34), the folders' own tests:
`npm run test -w @dems/core-web -- --maxWorkers=2 src/features/storage src/features/network-time` →
`Test Files  4 passed (4)`, `Tests  30 passed (30)` both times.

```
$ git diff --stat acaff20 -- apps/core-web/src/features/storage/__tests__
 .../src/features/storage/__tests__/storage-page.test.tsx    | 13 ++++++++++++-
 1 file changed, 12 insertions(+), 1 deletion(-)
$ git hash-object apps/core-web/src/features/storage/__tests__/storage-page.test.tsx
71f6f0337f2339d8e8d66ef232d7334dc0b67d1d          (W01's state, implementation/01 §1)
$ git diff --stat acaff20 -- apps/core-web/src/features/storage/__tests__/storage-model.test.tsx | wc -l
       0
$ git diff --stat acaff20 -- apps/core-web/src/features/network-time
(no output: 0 lines — no file of the folder changed, production or test)
$ git status --porcelain -- apps/core-web/src/features/network-time
(no output)
```

The one file in the Storage diff is W01's, compared with its recorded hash as the rev 2.1 rule directs; this
row never edited it (pre-image `.cache/rollback/W71/storage-page.test.tsx.pre`, saved before the first edit;
`.cache/rollback/W71.pre.patch` holds W01's diff against `acaff20`, 46 lines).

### 6.3 CLG (c)

```
$ grep -rn --include='*.ts' --include='*.tsx' -e useSimActions -e '\.actions\b' apps/core-web/src/features/storage --exclude-dir=__tests__ | grep -v 'common\.actions\.'
grep exit=1 (1 = nothing found)
$ grep -rn --include='*.ts' --include='*.tsx' -e useSimActions -e '\.actions\b' apps/core-web/src/features/network-time --exclude-dir=__tests__ | grep -v 'common\.actions\.'
grep exit=1 (1 = nothing found)
$ grep -n "useCoreActions()\|settle(() => actions.setStoragePolicy" apps/core-web/src/features/storage/manage-drawer.tsx
85:  const actions = useCoreActions()
99:      settle(() => actions.setStoragePolicy({ retentionPolicy: policy.retentionPolicy, autoArchive: policy.autoArchive }), {
```

The static tests `live-storage-page.test.tsx:241` and `live-network-time-page.test.tsx:231` hold the same rules.

### 6.4 Write paths and protected paths

```
$ git status --short -- apps/core-web/src/features/storage apps/core-web/src/features/network-time packages/shared/src/i18n/en/storage.ts packages/shared/src/i18n/en/network-time.ts 'apps/core-web/src/test/live-storage-*' 'apps/core-web/src/test/live-network-time-*'
 M apps/core-web/src/features/storage/log.ts
 M apps/core-web/src/features/storage/manage-drawer.tsx
 M apps/core-web/src/features/storage/panel.tsx
 M apps/core-web/src/features/storage/volumes-panel.tsx
 M packages/shared/src/i18n/en/storage.ts
?? apps/core-web/src/test/live-network-time-page.test.tsx
?? apps/core-web/src/test/live-storage-page.test.tsx
?? apps/core-web/src/test/live-storage-policy.test.tsx
$ git status --short -- apps/core-web/src/runtime apps/core-web/src/lib apps/core-web/src/components/shell apps/core-web/src/routes apps/core-web/vite.config.ts apps/core-web/src/test/routes.test.tsx apps/core-web/src/test/sim-fetch.test.ts apps/core-web/src/features/storage/__tests__/storage-page.test.tsx
(no output)
```

### 6.5 No secret in the evidence

`grep -l <the seed password constant> docs/…/implementation/assets/71_* .cache/w71/lane/out/*` → exit 1 (not
found); the pattern was non-empty (the constant has 9 characters; the value was never printed).

## 7. Mutation check (M15)

W63's pattern: one text replacement in one module, applied in memory by a Vite transform plugin; a marker under
`$TMPDIR` proves it ran. Runner `assets/71_mutations_runner.py.txt`, config `assets/71_mutations_config.mts.txt`,
log `assets/71_mutations.log`.

```
## 2026-10-05 23:04:19 WIB baseline: the three test files of the row, no mutation
baseline exit=0 Test Files  3 passed (3) | Tests  28 passed (28) (7.0 s)
…
## 2026-10-05 23:08:57 WIB 27 mutations: 27 detected, 0 survived [], 0 not applied []
D17 DETECTED    exit=1 manage-drawer.tsx: the success toast is shown at the press (optimistic), before the answer […]
## 2026-10-05 23:09:12 WIB 1 mutations: 1 detected, 0 survived [], 0 not applied []
```

Detected: the presenter skipped (D01); the success toast dropped (D02; the label in the log says "optimistic",
the replacement only removes the toast — D17 is the real optimistic case, added and detected); the drawer
closes at the press (D03) or on a refusal (D14); Simulated words in Live (D04, V01); never busy (D05); spinner
never or at once (D06, D07); no return to idle (D08); the in-flight flag dropped (D09); no page record (D10); the
any-of gate dropped (D11); no `aria-busy` (D12); the live policy sent instead of the draft (D13); the command
fired and forgotten (D15); the friendly toast dropped (D16); the record quoting the error, losing its correlation
ID or code, keeping the message line of the stack (L01–L04); a panel crash not recorded (B01). For Network &
Time — no production change, so these show that the Live tests read the Core's data: a fixed address (N01),
a fixed satellite count (N02), no GNSS warning (N03), a fixed PoE count (N04), the tablet link ignoring the
replica (N05).

The tree was not changed by the run: the snapshot of `git status --porcelain` plus the SHA-256 of both folders'
files, the three test files, the folder tests, `routeTree.gen.ts` and `storage.ts`, taken before and after,
differ only by new untracked files of other rows (W69's two Live tests, two mobile tests, W70's assets).

## 8. Contract gaps found

| ID | Where | What | Effect here |
|---|---|---|---|
| **CONTRACT-GAP-W71-1** | `packages/shared/src/sim/types.ts:496-511` (`StorageSlice`: volumes, write rate, history, last verify — no SMART member); `packages/shared/src/sim/views.ts:206-221` (`driveHealth` derives SMART status, wear, spare, errors, reallocated and pending sectors, power-on hours in the browser) | The Core reports no SMART counters for its two drives. The Storage page shows them in Live mode as the browser derives them from the Core's temperatures and `meta.createdAt` | Not invented and not hidden: the Live footnote says "SMART values are demo values derived by the console: the Core server does not report them" (`volumes-panel.tsx:17-26`). For W83 or the backlog: SMART fields in the `storage` slice, or a stated exemption |
| CONTRACT-GAP-5 / F64 (existing, confirmed) | example `packages/shared/src/api/storage.ts:174-181` (`ANY-OF(EVIDENCE_REVIEW, MAINTENANCE)`); server `apps/core-server/src/plugins/permission-guard/access-rules.ts:176-190` (`EVIDENCE_REVIEW_OR_MAINTENANCE`, seen on the lane); client `packages/shared/src/live/source/rebuild-error.ts:129,135` passes `details.permission` on, `apps/core-web/src/lib/core-errors.ts:120-126` splits on `\|` only | Three spellings of the any-of; the presenter finds a role for none of the two that reach it, so the denied toast of B-9 names no role | Per [DEC:F64] the page shows the generic denial until W83 decides one mapping; tested for both spellings (section 4.1). Not given a new ID: it is W28's CONTRACT-GAP-5 |

No other data gap: every other value both pages show in Live mode comes from the replica (section 3).

## 9. Findings

| # | Finding | Evidence | For |
|---|---|---|---|
| F71-1 | F64 confirmed on the real Core: an INVESTIGATOR's `POST /api/v1/storage/policy` answers 403 with `details.permission: EVIDENCE_REVIEW_OR_MAINTENANCE`; neither this nor the contract example's `ANY-OF(…)` gives the presenter a role, so AC-C-48's "names the required role" is met for B-9 only in its generic form ("Not permitted"). The smallest shared fix (not made here, outside the write path): in `rebuild-error.ts:129` normalise the label before it reaches the error, e.g. `named.replace(/^ANY-OF\((.*)\)$/, '$1').split(/_OR_\|,\s*/).join(' \| ')` (no permission name holds `_OR_`, `access-rules.ts:186`); the presenter would then name the Supervisor, and this row's tests stay green (they forbid only a wrong role) | lane step 4; `live-storage-policy.test.tsx:230-274` | W83 (decision 1) |
| F71-2 | The KPI "Retention days" in `71_storage_live_b9_applied.png` reads mid-count (the browser runs full motion; the AnimatedNumber was still counting 90 → 365 when the shot was taken 0.9 s after the toast; the record's text reads "364days" and later "91days" during the set-back). Not a defect | browser record step 2 | none (stated) |
| F71-3 | `apps/core-web/src/features/network-time/log.ts:6-15` still writes `error.message` and `error.stack` to the dev console (CPW1-8 not applied, only call site the panel boundary `panel.tsx:75`). This row may change no production file of that folder; the change is the one made to `storage/log.ts` (section 2.2) | source | a later row (W88) or the controller (decision 3) |
| F71-4 | The activity panel shows times without a date: in Live mode the Core's events of the previous day ("11:11:52 Evidence sealed", 2026-10-04) stand next to today's ("23:10:53 Storage policy changed"). The Simulated page has the same design; only a long-running Core makes it visible | `71_storage_live_b9_applied.png` | controller (note) |
| F71-5 | The A/V sync strip of Network & Time is derived in the browser from the time lock (`selectAvSync`); its own caption "Derived for the demo; the book leaves the A/V limits TBD (§22.2)" already says so in both modes, so it is not a contract gap | `network-time.ts:57`; `71_network_time_live.png` | none (stated) |
| F71-6 | On the lane the Core's tablet link is OFFLINE (no paired tablet connected): Network & Time in Live mode shows "Tablet link Offline", Management "Degraded", and the shell's ATTENTION chip; the Simulated page shows Connected. This supports F63-6's hypothesis for the ring's "1 issue" | lane step 3 | none (stated) |
| F71-7 | Lane step 1's record holds two sockets: the driver loads `/storage` by a full page load after the sign-in landed on the Dashboard; the first page's socket ended with that page (CDP reports no close event for an unloaded page). One socket per page, as W63 saw | `71_lane_browser_3.json` | none (stated) |

## 10. Deviations

| # | Deviation | Why |
|---|---|---|
| DV-1 | The busy mark `aria-busy` is on the drawer footer, not on Apply | F63-2: the kit's `Button` drops it |
| DV-2 | Files beyond the one call-site file of [CS:§7.3] G13 (`manage-drawer.tsx`): `log.ts` (sink, CPW1-8), `volumes-panel.tsx` (Live footnote, §3.2), `panel.tsx` (docblock only), `storage.ts` i18n | All inside the row's write path; none changes the Simulated look |
| DV-3 | In Simulated mode a `SimPermissionError` from Apply would now show the presenter's denied toast instead of "could not be updated" (presenter first, [CP:§8 rule 2]) | Unreachable: Apply is disabled without EVIDENCE_REVIEW or MAINTENANCE |
| DV-4 | The Storage page's error record changed destination and shape (the sink, a fixed sentence, no error text) | Error-logging rule and CPW1-8, as W63 DV-6 |
| DV-5 | The lane check signed in the seeded INVESTIGATOR too and sent one page request as that role (one ACCESS_DENIED row) | To show the Core's own refusal of operation 55, which the UI does not offer to that role (W63 DV-1, decision 4 of row W63) |
| DV-6 | The Simulated screenshots use the simulator's stored sign-in `dems.auth`, not the form | F63-3 |
| DV-7 | The Network & Time Live tests live in `apps/core-web/src/test/live-network-time-page.test.tsx`, none inside the folder | The brief's path for them; it keeps `git diff --stat acaff20 -- …/network-time` empty |

## 11. Decisions for the controller

1. **F64 / F71-1**: keep the generic denial for B-9 until W83 (the default, as F64 rules), and hand W83 the
   proposed normalisation in `rebuild-error.ts` (one line; it fixes web and mobile alike).
2. **CONTRACT-GAP-W71-1**: accept the Live footnote on the browser-derived SMART values (the default), or ask
   W83 / the backlog for SMART fields in the Core's `storage` slice.
3. **F71-3**: route the CPW1-8 change of `features/network-time/log.ts` to a row that may change it (W88), or
   accept it (dev-console only; one call site, the panel boundary).
4. Record DV-5 (the INVESTIGATOR sign-in and one refused page request on lane 3) as accepted.
5. Note for the remaining page rows: a Live-mode check of a drawer's Select works by script through
   `[data-testid="…"] button` and `[role="option"]` (lane step 2), and `lockf -t 60` on a busy lane exits 75
   without starting anything (section 5).

## 12. Rollback (not executed)

R-CO for the tracked files, R-NEW for the new ones, then R-PRE for `storage-page.test.tsx` as the plan names it
(plan section 4.3); the file was never edited, so R-PRE leaves it at W01's state `71f6f033…`:

```
git checkout acaff20 -- apps/core-web/src/features/storage/manage-drawer.tsx \
  apps/core-web/src/features/storage/log.ts apps/core-web/src/features/storage/volumes-panel.tsx \
  apps/core-web/src/features/storage/panel.tsx packages/shared/src/i18n/en/storage.ts
git clean -f -- apps/core-web/src/test/live-storage-policy.test.tsx \
  apps/core-web/src/test/live-storage-page.test.tsx apps/core-web/src/test/live-network-time-page.test.tsx
git checkout acaff20 -- apps/core-web/src/features/storage/__tests__/storage-page.test.tsx
git apply .cache/rollback/W71.pre.patch
```

Pre-images of every production file of the folder and of both i18n files are in `.cache/rollback/W71/`
(`SHA256SUMS`); the five edited files equal their blobs at `acaff20` (`git rev-parse acaff20:<path>` =
`git hash-object` before the edit: `manage-drawer.tsx` `2ece4997…`, `log.ts` `3b120a35…`, `volumes-panel.tsx`
`6d8265e1…`, `panel.tsx` `415320da…`, `storage.ts` `3e882232…`). The lane rows the check added (section 5) are not
rolled back (the trail is append-only and lanes are not reset by rows); the policy itself is already back.

## 13. Files of this row

| File | Change |
|---|---|
| `apps/core-web/src/features/storage/manage-drawer.tsx` | modified (site B-9) |
| `apps/core-web/src/features/storage/log.ts` | modified (record to the sink) |
| `apps/core-web/src/features/storage/volumes-panel.tsx` | modified (Live footnote) |
| `apps/core-web/src/features/storage/panel.tsx` | modified (docblock) |
| `packages/shared/src/i18n/en/storage.ts` | modified, additive |
| `apps/core-web/src/test/live-storage-policy.test.tsx` | new |
| `apps/core-web/src/test/live-storage-page.test.tsx` | new |
| `apps/core-web/src/test/live-network-time-page.test.tsx` | new |
| `docs/…/implementation/71_web_storage_network_time.md` | this file |
| `docs/…/implementation/assets/71_*` (7 screenshots, lane run logs ×2, browser record, lane script and driver, gate log, mutation log, runner, config) | new |
| `docs/…/delegation_progress/coder_execution_step_93.md` | progress file |

---
*Generated: 2026-10-05 23:20 WIB*
