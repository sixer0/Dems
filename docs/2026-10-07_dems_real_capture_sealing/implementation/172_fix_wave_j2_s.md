---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: fix wave J, ROUND TWO - driver J2-S (packages/shared, apps/core-server; README one sentence; no web file needed)
date: 2026-10-12
agent: coder-execution
source_brief: delegation_progress/fix_brief_wave_j.md (decisions D243, D244); first round: implementation/167, 168
tree: 035150b + the uncommitted first round of wave J + this round (no git write)
status: complete - items 1, 3, 4a, 4b, 5 done; item 2 done for server / shared and the contract, the client readers listed (not a one-file change)
---

# Fix wave J, round two, driver J2-S

Contract for the clients: `delegation_progress/contract_wave_j.md`, sections **J2-S 1 to J2-S 4**.
Totals unmoved: **97 operations (36 GET / 61 POST), 67 audit types, schema 6 / dbc-7, no migration**
(the generator printed `97 operations`; counted from the regenerated document: 97 / 36 / 61). What
was added: three optional members, one optional member value, descriptions, two shared readers.

**THE LANES NEED A RESTART to load this round: server code and shared code changed** (operation 64
`components`, operation 38 `unsealableCause`, the form's note on a new item). Until then both Cores
answer the old way. I restarted nothing and called no lane.

## 1. JW-13 / JT-11 / JA2-08 - markers, notes, snapshots after the seal

### What I found (the question of the brief: where do they live after the seal?)

| What the operator adds | While the session is open | After the seal | Under the signature? |
|---|---|---|---|
| Marker | `active_session.timeline` (a `MARKER` item: `packages/shared/src/sim/session-machine.ts`, `addMarkerTransition`), `marker_count` | **`evidence_items.markers`** (jsonb, NOT NULL; `apps/core-server/src/db/schema/evidence.ts:94`) - written when the item is made, `markers: sessionMarkers(session)` in all three builders (simulated seal, REAL seal `completeSealTransition`, never-sealed record). Also the audit row `MARKER_ADDED` (`details { label, index }`) | The item's column: NO. The audit row: YES - it is one line of `audit-session-extract.jsonl` inside the sealed package (`apps/core-server/src/sealing-host/session-reader.ts:367-369`) |
| Note written during the recording | `active_session.notes` + a `NOTE` timeline item | **`evidence_items.notes`** (jsonb) - the whole text. Audit row `NOTE_ADDED` holds `noteId` and `length` only ("the note text stays in the session record") | The TEXT: NO (the item's row only). That a note was added, by whom and how long: yes (the extract) |
| Snapshot | a `SNAPSHOT` timeline item, `snapshot_count`, an audit row | **nothing on the item**: no member, and no picture exists anywhere - a "snapshot" is a mark, not an image. The audit row is in the extract | the audit row only |
| The session form's "Notes (Optional)" | `active_session.input_notes` (`apps/core-server/src/db/schema/sessions.ts:52`) | **nowhere before this round**: not on the item, not in the history row, not in an audit row (`SESSION_CREATED` details hold the case number and the subject type), not in the manifest. The singleton session row is replaced by the next session: the text was LOST | - |

**So the Core does hold and send the markers and the in-session notes of a sealed item, real capture
included.** `rows.ts:664-665` returns both lists for every item; operation 40 (`evidence-facts/index.ts`,
`detail`) and the list pass them on unchanged; the schema has them (`state-slices.ts`,
`EvidenceItemSchema.markers` / `.notes`). The first round's reading "the Core does not send them"
(note 168, section 6) came from an item whose session had none: `EV-20261012-0068` was the 19-second
interrupted session, with no marker and no note - two EMPTY lists, for which the web block draws
nothing. The judge's item `EV-20261011-0060` (marker "Judge B1 marker", note "Judge B1 session note")
was read before the web block existed. I could not read either item on lane 2 (I call no lane):
**the live confirmation is one step for the confirmation judge** (section 6).

### What changed

- No new member for markers / notes: `EvidenceItem.markers`, `.notes` are the members, and the web
  block `apps/core-web/src/features/evidence/session-annotations.tsx:16-17` reads exactly those
  names. **No web file was touched.**
- THE FORM'S NOTE IS NOW KEPT, without a column: `itemNotesOf(session)`
  (`packages/shared/src/sim/session-machine.ts`, beside `sessionMarkers`) puts the form's text as
  the FIRST note of the item's existing list - `{ id: 'NOTE-FORM', at: <session created>, authorId:
  <who created it>, text, origin: 'SESSION_FORM' }` - at the moment the item is made, in all three
  builders. An empty field adds nothing. New optional member `origin: 'SESSION_FORM'` of a note
  (`SessionNoteSchema`, `state-slices.ts`; type `SessionNote`, `sim/types.ts`). Exported example
  `EVIDENCE_SESSION_ANNOTATIONS_EXAMPLE` (`api/evidence.ts`), constants `SESSION_FORM_NOTE_ID`,
  `SESSION_FORM_NOTE_ORIGIN`.
- Items sealed before this round keep what they stored (their form note was never stored: it is gone).

### Tests (existing files)

- shared `test/sim-core-driven-seal.test.ts`: "fix wave J round two (JW-13): what the operator added
  is ON the sealed item" (the REAL seal: markers = the session's timeline items, notes = the
  session's notes, the form's note first, no snapshot member) and "JW-13: the form's note" (with a
  CONTROL: an empty field adds none; an unknown `origin` is refused by the schema).
- core-server `src/db/mapping/__tests__/from-rows.test.ts`: the two lists are stored in the item's
  row and come back whole, sealed and never-sealed.
- core-server `src/modules/evidence/__tests__/reads.db.test.ts` (db): a session with a form note, a
  marker, a note and a snapshot is sealed; the stored row, operation 40 for each of the three roles
  and operation 39 state the same lists; CONTROL: an un-annotated item has two empty lists.

### For the next task

- **Evidence completeness, for the controller (not a code defect of this wave):** the note TEXT and
  the form's note are facts of the item's ROW, not of the signed package. A marker's label is under
  the signature (audit extract); a note's text is not. Putting the note text under the signature
  means a manifest / package-format change (schema of the package, not of the database).
- **Scope:** the two lists travel with the item to every caller that may read the item
  (`EVIDENCE_VIEW`: operations 39, 40 and the replicated `evidence` slice). The case-scope rule
  (`holdsCase`, SEC35-16) narrows play / transcript / export only. I did NOT narrow the notes on
  operation 40 alone: the same text is in the list and in the replicated slice every client
  holds, so a filter on one answer would be a false assurance. Narrowing all three is a ruling
  (and a change of the slice for a role).
- Web (next pass, one file + its i18n key): title a note with `origin: 'SESSION_FORM'` "Note from
  the session form".

## 2. JW-26 / JA2-30 - the version statements

### Every version the product states

| # | Value | What it really is | Defined (the one place) | Shown / stated |
|---|---|---|---|---|
| 1 | `0.2.0` | the Core server | `apps/core-server/src/version.ts:7` `CORE_SERVER_VERSION` (= `apps/core-server/package.json:3`, held by `src/version.test.ts`) | operation 1 `version` (`modules/health/index.ts:72`) -> web Login strip "dems-core-server 0.2.0"; a sealed manifest's `device.softwareVersion` (`sealing-host/session-reader.ts`, field 24); NEW: operation 64 `components.core` |
| 2 | `capture-worker/0.5.0` | the capture worker | `apps/core-server/src/capture/boot/checks.ts:285` `CAPTURE_WORKER_VERSION` (= `apps/capture-worker/src/worker.h:43`, held by `protocol-pins.test.ts`, `fault-lifecycle.test.ts`) | the boot handshake; NEW: operation 64 `components.captureWorker` (own capture only) |
| 3 | `0.3.0` | the API contract document | `packages/shared/src/api/openapi.ts:115` `OPENAPI_CORE_SERVER_DOCUMENT_VERSION` | the web API Reference "v0.3.0"; NEW: operation 64 `components.apiContract` |
| 4 | `v1` | the API path version | `packages/shared/src/api/constants.ts:32` `API_VERSION` | operation 1 `apiVersion`; every path |
| 5 | `0.1.0` | the web console build | `apps/core-web/package.json:4` | not shown anywhere today |
| 6 | `0.1.0` | the mobile app build | `apps/mobile/app.json:5` (= `apps/mobile/package.json:3`) | sent as `appVersion` at pairing (`apps/mobile/src/runtime/sim-adapters.ts:711`), listed by Paired Devices ("android - 0.1.0", `apps/core-web/src/features/paired-devices/devices-panel.tsx:239`), mobile About "app build" (`features/settings/about-section.tsx:32`) |
| 7 | `2.4.1` | the DEMONSTRATION device model | `packages/shared/src/sim/dataset.ts:51` `SOFTWARE_VERSION` | slice `device.softwareVersion`, `identity.coreSoftwareVersion`, `identity.tabletAppVersion` (`dataset.ts:83-84`), `update.currentVersion`, the `SIGNED_FIRMWARE` control; web Login footer (`features/login/index.tsx:186`), sidebar (`components/shell/sidebar.tsx:287`), top bar (`top-bar.tsx:222`), About (`features/system/about-panel.tsx:54`), settings panel, device drawer, LCD; mobile Login card (`login-card.tsx:386`), rail footer (`nav-rail.tsx:22`), More footer (`more-links.tsx:141,163`), About (`about-section.tsx:36-37`); operation 44 `device.softwareVersion` (`modules/devices/status.ts:256`) |
| 8 | `2.5.0` | the DEMONSTRATION update | `dataset.ts:52` `UPDATE_VERSION` | slice `update.availableVersion`; "Installed v2.5.0 - slot B" after the demo update |
| 9 | `0.1.0` | workspace manifests (root, shared, capture-protocol, transcriber, mock-core) | their `package.json` | nowhere |

The "five numbers" of the finding are 7, 8, 1, 3 and 6. The cause is ONE: **the clients show the
model's constant (7) as the product's version on every lane** - 15 places read `SOFTWARE_VERSION`
or `device.softwareVersion`.

### What changed (server / shared)

- Operation 64 `getSystemStatus` gains the optional member **`components`**: `{ core { name,
  version }, captureWorker? { version }, apiContract { version } }` - `SystemStatusSchema`
  (`packages/shared/src/api/system.ts`), example `SYSTEM_COMPONENTS_EXAMPLE`, contract example
  `getSystemStatus` 200 `ownCapture`. Built by `systemComponentsOf` (`apps/core-server/src/modules/
  system/status.ts`) from the three constants of rows 1-3 and nothing else; `captureWorker` is absent
  on a Core in SIMULATED capture (`modules/system/index.ts`, `captureOperationOf(app.config)`).
- No constant was duplicated or moved: rows 1 and 2 are each already ONE constant held to its second
  spelling by a test; the new member derives from them. The literals `2.4.1` / `2.5.0` in
  `api/state-examples.ts` and `api/examples.ts` are examples of the MODEL's slices (seen, not
  changed: the example files do not import the simulator).
- The client rule is in the contract (J2-S 2): which member is whose version, and that the model's
  values are never shown as a version of the real thing on a Core in its own capture.

### Tests

core-server `src/modules/system/__tests__/routes.test.ts`: block "64 getSystemStatus: ONE version
per component" (the Core's version equals the health answer's and is NOT the model's; no worker on
a SIMULATED Core; the own-capture answer equals the exported example; CONTROLS: a proof-build word
and a `v2.4.1` under the Core's name fail the contract); the three existing equality cases now
include the member; `static.test.ts` import pin (+ `../../capture/fence`, `../../config`,
`../../version`); db: `system.db.test.ts`, `effects.db.test.ts` (the member is there, the Core's
version). shared: `test/api-domain-operations.test.ts` (type parity without the member).

### For the next web pass (NOT a one-file change: no client calls operation 64 today)

1. A binding for operation 64 (or use operation 1's `version`, which the Login strip already
   reads) and an "About" that lists: Core server `components.core.version`, Capture worker (when
   present), API contract, Web console (its own package version, e.g. a build-time define).
2. On a Core in its own capture replace `SOFTWARE_VERSION` / `device.softwareVersion` in:
   `features/login/index.tsx:186`, `components/shell/sidebar.tsx:287`, `top-bar.tsx:222`,
   `features/system/about-panel.tsx:54` (+ the drift check at :48), `settings-panel.tsx:39`,
   `features/devices/device-drawer.tsx:525`, `lcd-display.tsx:80`, the log / diagnostics export
   headers (`export-logs-dialog.tsx:111`, `diagnostics.tsx:141`), `security-audit/use-security-data.ts:51`.
3. Mobile (J2-M / next pass): `login-card.tsx:386`, `nav-rail.tsx:22`, `more-links.tsx:141,163`,
   `about-section.tsx:36-37` - the app's own `Constants.expoConfig.version` under the name
   "Mobile app", the Core's under "Core server".
4. Decision for the user, unchanged: whether the web console and the app should carry the SAME
   number as the Core (a release train) - today they are 0.1.0 and 0.2.0 by their manifests.

## 3. JW-23 - "online" of a camera on a dead port

- The members: `captureConfig.cameras[].online` and `.streamState` (operation 76 and the slice)
  are DERIVED from the registry row's `enabled` column - `apps/core-server/src/modules/
  capture-config/slices.ts:105` and `db/mapping/rows.ts:917` (`online: device.enabled`,
  `streamState: device.enabled ? 'LIVE' : 'LOST'`); `captureDevices.devices[].online` is that
  column itself (`rows.ts:861`, `:876`).
- Who changes the column: a pre-check (`capture-notices/precheck.ts:216-233`), a session start
  (`capture-notices/session-start.ts:126`, `notifier.ts:180`) and the microphone re-scan
  (`modules/capture-inputs/routes.ts:141`). Nothing else. Saving the selector does not ask the
  source. `CAM-04` / `CAM-05` / `CAM-06` are registered `enabled: true` and nobody has asked them:
  the Core answers `online: true, streamState: LIVE`.
- **So the server stated something a reader takes as false.** The value is correct as "registered,
  not found unreachable at the last check"; the NAME says reachability. Shape unchanged (the brief);
  the meaning is now written on each of the five members (`packages/shared/src/api/state-slices.ts`:
  `CaptureConfigCameraSchema.online`, `.streamState`, `CaptureConfigMicSchema.online`,
  `CaptureDeviceStatusSchema.online`, `.streamState`) and on operation 77
  (`api/devices.ts`); the OpenAPI document carries the texts. Proof: the OpenAPI byte-for-byte
  tests; no behaviour changed, so no behaviour test.
- For the next task (a contract change, the tri-state the first round named): a member that says
  WHEN the source last answered (`lastCheckedAt`, null = never) needs a column on `capture_devices`.

## 4. From note 167's not-fixed list

### 4a. The unsealable CAUSE on the session list - BUILT, no column

- Stored structures that hold it: the audit row `SESSION_INCOMPLETE` (`details { reason:
  'UNSEALABLE', cause, faultKind, quarantinedFiles? }`, `session-machine.ts`
  `endUnsealableTransition`) - append-only, kept for ever, indexed by `(session_id, seq)`; and the
  CRITICAL alert of the session (`target` = the session, `params.reason: 'UNSEALABLE'`,
  `params.cause`) - in a ring of 100. The quarantine folder has no record of its own that the Core
  reads back.
- Operation 38: `readHistoryPage` (`apps/core-server/src/modules/sessions/history.ts`) now reads,
  for the quarantined entries of the page only, the cause from the audit trail
  (`readUnsealableCauses`: one statement, none for a page without such an entry) and states it as
  the optional member **`unsealableCause`** (`SessionHistoryEntrySchema`). Example
  `SESSION_HISTORY_UNSEALABLE_ENTRY_EXAMPLE`; contract example `listSessionHistory` 200 `unsealable`.
- For a reader of the replicated slices (the web Sessions page reads the slice): shared reader
  `unsealableCauseOf(entry, alerts)` (`packages/shared/src/sim/evidence.ts`).
- Tests: shared `test/sim-seal-blocked-unsealable.test.ts` (the reader, with four controls);
  core-server db `src/engine/__tests__/unsealable-doors.db.test.ts` (the session ended through the
  real door: operation 38's page states the cause as `dems_app`, validates against the contract, no
  other entry has the member, an unknown session gets none, the read writes nothing).
- What still needs a column: the cause IN THE SLICE (`session_history.unsealable_cause text NULL`
  with the cause-code CHECK) - only if the clients must not depend on the alert ring.

### 4b. The session form's NOTES on the item - BUILT, no column

It is part of item 1: the text was stored with the open session only and is now copied onto the
item's existing `notes` list (`origin: 'SESSION_FORM'`). A column would be needed only to keep it
for a session that ends WITHOUT an item (a quarantined or never-recorded session):
`session_history.input_notes text NOT NULL DEFAULT ''`. Listed for the next task.

## 5. JW-29 - the README

`README.md:51` said the Login has a button "Use security key (simulated)". At HEAD the button is
drawn only outside Live data mode (`apps/core-web/src/features/login/auth-card.tsx:283-284`,
`isLive ? null : ...`, WS-8: the Core has no such operation). The table row now says: Simulated
data mode only; in Live data mode (both lanes) the Login has no such button. One edit; line 208
(the Simulated walk-through, port 5173) is true as it stands and was not touched.

## 6. Proof, and what is not proven

See section 7 for the commands and counts. By TEST only - nothing was driven live (I call no lane,
restart none). For the confirmation judge, after the restart:

1. Lane 2: a 45-60 s recording on the FAKE sources with a form note, one marker, one note and one
   snapshot; open the item: the block "Markers and notes of the session" shows the marker, the
   note and the form's note. Also open `EV-20261011-0060` (sealed before this round): its marker
   and its in-session note are expected to show (they were stored), its form note not.
2. Lane 2: `GET /api/v1/system/status` -> `components` = Core 0.2.0, `capture-worker/0.5.0`, API
   0.3.0; lane 1: the same without `captureWorker`.
3. Lane 2: `GET /api/v1/session/history` -> the four quarantined sessions of the Sessions page each
   carry `unsealableCause`.

## 7. Checks and counts

One run each; a second run only of what failed. 1-minute load read before each whole suite.

| Check | Command | Result |
|---|---|---|
| shared, whole suite | `npm test -w @dems/shared` | first run (load 6.16 at its start - above the bound, my lapse): 101 files passed, 1 failed (2682 / 2683): `test/api-text-rule.test.ts`, API-13 named my new member `SystemStatus.components.core.name` (a free string). Fixed (the name is a code pattern). Second run (load 5.47): **102 files, 2683 tests passed** |
| OpenAPI | `/usr/bin/lockf -k .locks/npm.lock npm run -s openapi:gen -w @dems/shared` (outside the command sandbox: `tsx` opens a pipe) | `wrote openapi/openapi.json (all (committed): 97 operations, 2 security schemes, version 0.3.0; ...)`; counted from the file: **97 / 36 GET / 61 POST**. Regenerated twice (after the name pattern). The two byte-for-byte tests: green |
| core-server unit, whole suite | `npm test -w @dems/core-server` (load 5.97) | in the command sandbox: 312 files passed, 12 failed (6610 passed, 121 failed, 1 skipped). 11 files are the ones that BIND a loopback port (the same 11 as in note 167; EPERM in the sandbox): outside the sandbox **11 files, 249 tests passed**. The twelfth was mine: `src/modules/sessions/__tests__/static.test.ts` pins the number of read statements of the module (2 -> 3 with the cause read); pin updated with its reason and a no-write check, re-run: 20 passed. Whole: **324 files green** |
| db files touched (+ three neighbours) | `/usr/bin/lockf -k .locks/db-migrate.lock npm run -s test:db -w @dems/core-server -- src/modules/evidence/__tests__/reads.db.test.ts src/engine/__tests__/unsealable-doors.db.test.ts src/modules/system/__tests__/system.db.test.ts src/modules/system/__tests__/effects.db.test.ts src/modules/sessions/__tests__/history.db.test.ts src/modules/sessions/__tests__/journey.db.test.ts test/acceptance/contract.test.ts` (load 5.98) | **7 files, 133 tests passed**; teardown `0 remain`. No "remaining connection slots": lane 1 was NOT stopped |
| typecheck | `npx tsc --noEmit -p packages/shared`; `npm run -s typecheck -w @dems/core-server`; `npm run -s typecheck -w apps/core-web` (consumer check; no web file is mine) | clean, all three |
| lint | `npm run -s lint -w @dems/shared`; `npm run -s lint -w @dems/core-server` | clean |

Not run by me: the whole db suite (the brief: the files touched), the core-web and mobile suites,
`test:regression`. **Checks for the test runner:** the whole db suite once
(`/usr/bin/lockf -k .locks/db-migrate.lock npm run -s test:db -w @dems/core-server`) - a session
created with a form note now seals an item with one more note, and I found no db test that pins
that by grep, but only the whole run proves it; `npm test -w apps/core-web` and the mobile suite
after their drivers (they consume `SessionNote.origin` and `SystemStatus.components` as optional
members; the web typecheck is clean).

## 8. Files changed (this round)

- shared src: `api/system.ts` (`components`, example), `api/state-slices.ts` (`unsealableCause`,
  `origin`, the five `online` / `streamState` descriptions), `api/sessions.ts` (example),
  `api/evidence.ts` (example), `api/devices.ts` (operation 77 text), `sim/session-machine.ts`
  (`itemNotesOf`, constants), `sim/evidence.ts` (`unsealableCauseOf`), `sim/types.ts`
  (`SessionNote.origin`, `SessionHistoryEntry.unsealableCause`); `openapi/openapi.json` (generated).
- shared tests: `test/sim-core-driven-seal.test.ts`, `test/sim-seal-blocked-unsealable.test.ts`,
  `test/api-domain-operations.test.ts`.
- core-server src: `modules/system/status.ts`, `modules/system/index.ts`, `modules/sessions/history.ts`.
- core-server tests: `modules/system/__tests__/{routes.test.ts,static.test.ts,system.db.test.ts,
  effects.db.test.ts}`, `modules/sessions/__tests__/static.test.ts`,
  `modules/evidence/__tests__/reads.db.test.ts`, `engine/__tests__/unsealable-doors.db.test.ts`,
  `db/mapping/__tests__/from-rows.test.ts`.
- `README.md` (one table row). No file of `apps/core-web` or `apps/mobile`.
- docs: this note; `delegation_progress/contract_wave_j.md` (section J2-S); one claim line in
  `file_claims.md`; `delegation_progress/coder-execution_wave_j2_s.md`.

## 9. Decisions for the controller

1. **Restart both lanes** (lane 2 `stop 2`, `start 2 --with-camera-stub --speech-mic`, NO reset;
   lane 1 `stop 1`, normal start): server and shared code changed. J2-M has both devices on them.
2. JW-13 was half a misreading: the Core sent the lists all along (two empty lists for an
   un-annotated session). What WAS lost is the form's note - now kept on new items.
3. The form's note is carried as a NOTE of the item (`origin: 'SESSION_FORM'`), not as a new item
   member: no column, and one list for the clients. If a separate member is wanted, that is a column.
4. Notes and the form's note are NOT under the signature (item row only); markers are (audit
   extract). Whether note text must be sealed is an evidence-format ruling.
5. Markers / notes are not narrowed by case scope (they ride on the item, the list and the
   replicated slice). Ruling needed before anything is filtered.
6. `online` keeps its name and shape; its meaning is in the contract. A real "last checked" member
   needs a column on `capture_devices`.
7. Operation 64's `components` is the server's statement; the clients still show the model's
   v2.4.1 in about 15 places until the next web / mobile pass (list in section 2).
8. Two test pins were moved because the product changed, not weakened: the system module's import
   list (+3 sources of constants) and the sessions module's count of read statements (2 -> 3, with
   a new "no write statement" check). Two bare test apps of `system/routes.test.ts` got a `config`
   (the route now reads the capture operation).
9. The first whole shared run started at load 6.16 (bound: below 6).

## 10. State left

No lane called, none restarted, lane 1 not stopped, no rig, no device, no git write. Both Cores run
the code they booted with at 06:01.

---
*Generated: 2026-10-12 09:5x WIB*
