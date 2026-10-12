---
task: 2026-10-07_dems_real_capture_sealing
row: fix wave J, pass J5 - demo / simulated flags in client-written files (apps/core-web; apps/mobile swept, not changed)
date: 2026-10-12
agent: coder-execution
tree: commit 035150b + the uncommitted fix wave J (J4 included)
status: complete (two premises of the brief corrected in section 1; two kept names are a decision, section 6)
---

# Fix wave J - pass J5: `demo` / `simulated` in the files the clients write

No lane, device, browser or git write. Nothing below was SEEN live: every claim is a test or a
reading of the code, and says which. "Own capture" = `isOwnCaptureCoreState` (the one reader,
`packages/shared/src/sim/core-facts.ts:230`), the same reader the log export uses.

## 1. What the two named files ARE (read before changing)

### 1a. `features/system/diagnostics.tsx:137` - NOT a Live download; cannot occur on any Core

Note 174 decision 2 called it "the diagnostics report of a Live console". It is neither: it is the
LOG export of SIMULATED MODE (the in-browser simulator, no Core at all), inside `exportSimulated`
(`diagnostics.tsx:120`), reached only through `exportLogs` when `live` is false (`:157-160`;
`live` = `useCoreMode() === CoreMode.LIVE`, `features/system/live.ts:17`). On any Core - simulated
or own capture - the same button opens `ExportLogsDialog`, whose file J4 made truthful. There is
no separate diagnostics-report download in either client. NOT CHANGED: its wording is the
simulated lane's, which stays word for word. Already pinned: `test/live-system-export.test.tsx:295`
presses that very button (`system-export-logs`, `:192`) on an own-capture Core and gets ONE file,
the own-capture one.

### 1b. `features/evidence/export-download.ts` - still produced on a real-capture Core, for demonstration items only

- A recording sealed on a Core (and any REAL item): the export is the Core's job (operations 42,
  87) and its signed archive comes from the Core's download route. The console writes no file.
  Until now only the wizard's DRAWING kept it so (`export-wizard.tsx`, `coreArchiveOnly`); the
  builder itself would have written a "DEMO manifest" for any row handed to it.
- A v1 / simulated DEMONSTRATION item (`integritySource` DEMO_PACKAGE or SIMULATED, no
  `sealedPackage`): a REAL_DEVELOPMENT Core is seeded with the dataset
  (`apps/core-server/src/db/seed/demo-core.ts:10-17`), and for these items the Core runs "the
  simulator's export, which completes inside its request" with no archive
  (`apps/core-server/src/evidence-export/service.ts:16-18`). So the console-written manifest IS
  still produced on a real-capture Core - for such an item, and it is all there is.

So it is not only the simulated lane's stand-in: it is the stand-in for DEMONSTRATION ITEMS on
every lane. Both halves were fixed: it can no longer be produced for a real item, and on an
own-capture Core it states what it is.

## 2. Fixes

| # | Fix | Code | Test |
|---|---|---|---|
| F1 | ONE rule "does the console write the export file of this row": Simulated mode yes; Live only for a demonstration item without sealed files - never REAL, sealed-here, with `files[]`, or kind not stated. The wizard draws by it; the builder REFUSES (`ExportFileNotForItemError`) when called in Live for any other item (the wizard's catch logs it and shows the download-error toast). | `export-download.ts:77` (rule), `:84` (error), `:151` (refusal); `export-wizard.tsx:558` (drawing), `:340` (`live` passed) | `features/evidence/__tests__/evidence-export.test.tsx:163` (five refused kinds x both capture forms throw; CONTROL: v1 DEMO_PACKAGE and SIMULATED items allowed, everything allowed in Simulated mode). Drawing already pinned: `export-job.test.tsx:254`, `item-exports.test.tsx:149`. |
| F2 | Export manifest on an own-capture Core: NO `demo` member; `demonstrationItem: true`; notice "Export manifest summary of a demonstration item this DEMS Core server holds, written by the web console from the bundled package of that item [/ from the Core's record of that item]. It is not a recording of this Core and not evidence: the Core makes no export archive for a demonstration item. A recording sealed on this Core is exported by the Core itself, as a signed archive." Without a joined package the three `simulated: true` members become `source: 'core-record'`. Nothing else of the file changes. | `export-download.ts:117` (input), `:121-129` (four notices), `:154` (`unpackaged`), `:223-230`; caller `export-wizard.tsx:341` (`live && isOwnCaptureCoreState(state)`) | Builder: `evidence-export.test.tsx:139` (no `demo`, no `"simulated"`, rest of the file equal to the demo file). LIVE, through the wizard on a Core that states `time.hostClock`: `test/live-evidence-export.test.tsx:207`. |
| F3 | Detail page "Download DEMO manifest summary" for an item WITHOUT a bundled package: on an own-capture Core `{ record: 'CORE', demonstrationItem: true, note, ... }` named `<id>-manifest.core-record.json` instead of `{ simulated: true, ... }` named `<id>-manifest.simulated.json`. | `export-download.ts:251` (`manifestSummaryDownload`), caller `detail-page.tsx:218` | `evidence-export.test.tsx:183` (pure function, both forms). The call site's wiring (`detail-page.tsx:218`) is proven by typecheck and reading only - no UI test presses that menu entry on an own-capture Core. |

Simulated-lane controls that pin the OLD wording, word for word:
- `evidence-export.test.tsx:123`: `demo: true`; "DEMO export manifest built in the browser by the DEMS demo console from the sealed DEMO package. Not evidence."; "DEMO export manifest built in the browser from SIMULATED data (no DEMO package for this item). Not evidence."; the three `simulated: true` members; a Live Core in SIMULATED capture writes byte-for-byte the simulator's file.
- `live-evidence-export.test.tsx:217`: Live on a Core in simulated capture - `demo: true`, the sentence, the file name `EXP-nnnnnn-<id>-export-manifest.demo.json`.
- `evidence-export.test.tsx:183`: `<id>-manifest.simulated.json` and its exact text.
- Existing, untouched: `evidence-export.test.tsx:63` and the wizard case (`json.demo === true`).

## 3. The sweep (both clients, production files; grep `demo: true`, `simulated: true`, `.simulated.`, `synthetic`, `(DEMO)`, plus every `saveBytes` / `downloadJson*` / `downloadBlob` / `downloadText` / clipboard / share call)

Client-written payloads and generated file names that carry the words:

| # | Where (now) | What | On a real-capture Core? | Action |
|---|---|---|---|---|
| 1 | `core-web/src/features/system/diagnostics.tsx:136-138` | Simulated-mode log export: `demo: true`, "DEMO - simulated log export from the DEMS demo stack." | NO - Simulated mode only (section 1a) | none; wording kept |
| 2 | `core-web/src/features/system/live-log-export.ts:153`, `:131` | Live log export: `demo: true`, "(synthetic demo data)" | yes | fixed in J4 (note 174 item 3) |
| 3 | `core-web/src/features/evidence/export-download.ts:223-230` (was `:169-172`) | export manifest: `demo: true`, "DEMS demo console", "SIMULATED data" | YES, for a v1 demonstration item | FIXED (F2); real items refused (F1) |
| 4 | `export-download.ts:161`, `:184`, `:198` (was `:107`, `:130`, `:144`) | `simulated: true` on tracks / session manifest / signature of an item without a joined package | YES (a demonstration item whose package is not joined) | FIXED (F2) |
| 5 | `export-download.ts:169-174` | verification block `label: 'SIMULATED'`, `source: 'simulated'` | NO - only with `verification.simulated`, which the one caller always passes as `null` (`export-wizard.tsx:337`); dead in product use | none |
| 6 | `export-download.ts:68`, `:222` | file name `<exp>-<id>-export-manifest.demo.json`; `schema: 'dems.export-manifest.demo/1'` | YES, for a demonstration item | KEPT - names the item's kind, which the Core states itself (decision 1) |
| 7 | `core-web/src/features/evidence/detail-page.tsx:215` | `<id>-manifest.demo.json`: the bundled DEMO package's own manifest bytes | YES, for a packaged demonstration item | KEPT - the file is the bundled demo package's manifest (decision 1) |
| 8 | `detail-page.tsx:218` -> `export-download.ts:254` (was `detail-page.tsx:216-217`) | `{ simulated: true, ... }`, `<id>-manifest.simulated.json` | YES (a demonstration item without a joined package) | FIXED (F3) |
| 9 | `core-web/src/features/evidence/metadata-tab.tsx:128` | on-screen record JSON: `simulated: true`, "SIMULATED record from the in-browser simulator" (not a download; listed because the grep hits it) | NO - the `live ?` branch above it writes `record: 'CORE'` | none |
| 10 | `mobile/src/features/evidence/metadata-tab.tsx:96` | the same on the devices | NO - same `live ?` branch (`:86`) | none |

Checked and clean (no such word): the audit export file (`security-audit/export-file.ts:71-100`,
no `demo` member in either mode), `openapi.json` download and base-URL copy
(`api-reference/server-strip.tsx:137`, `:152`), the realtime panel copies, the evidence ID / hash
copies (`detail-page.tsx:229`, `integrity-tab.tsx:191`), the prebuilt `EXP-000031.zip` (a shipped
asset, not client-written). `apps/mobile/src` has NO client-written download, share or clipboard
call at all (no `Share`, `expo-sharing`, `expo-clipboard`, `FileSystem` write).

Display text the grep also hits, not payloads and not changed: `manifest-summary.ts:71`
"declared, not applied (DEMO)" and mobile `features/evidence/i18n.ts:101`, `:121`, `:159`,
`features/pairing/i18n.ts:21`, `:27`, `:40` - labels of bundled-package / demo-certificate views;
the "Synthetic demo values" chip family is rule 3f's own instrument.

Count: 10 found / 6 can occur on a real-capture Core (rows 2, 3, 4, 6, 7, 8) / 3 fixed here
(3, 4, 8) + 1 fixed in J4 (2) / 2 kept as true statements about a demonstration item (6, 7).

## 4. Checks run (once each)

| Check | Result |
|---|---|
| `npx -w apps/core-web vitest run src/features/evidence/__tests__/evidence-export.test.tsx` | 12 passed |
| `npx -w apps/core-web vitest run src/test/live-evidence-export.test.tsx` | 10 passed |
| `npm run -s typecheck -w apps/core-web` | exit 0 |
| `npm run -s lint -w apps/core-web` | exit 0 |

apps/mobile: no file touched, nothing run. Contract totals: nothing of the contract moved (three
web-only files).

## 5. Checks for the test runner

| Command | Lock | Expected |
|---|---|---|
| `npm run -s test -w apps/core-web` | - | green; watch the other readers of the detail page and the wizard (`export-job`, `item-exports`, `evidence-media`, `live-efix-evidence`, `lib/__tests__/download.test.ts`) - not edited, not run by me |

Re-drive for the confirmation judge (web, lane 2, supervisor): (1) export a dataset item (e.g.
EV 0001) -> the downloaded JSON has no `demo` member, `demonstrationItem: true`, the new notice;
(2) a recording sealed on lane 2 -> no console download control, the Core's archive only;
(3) detail page of a dataset item without bundled media > More > manifest summary -> file
`...-manifest.core-record.json`, `record: 'CORE'`; (4) lane 1: all three as before (`demo: true`,
`.simulated.json`).

## 6. Decisions for the controller

1. Rows 6 and 7 of the sweep are KEPT: on a real-capture Core the file NAME `...export-manifest.demo.json`
   / `...-manifest.demo.json`, the schema id `dems.export-manifest.demo/1`, the menu label "Download
   DEMO manifest summary" and its toast still say DEMO. They speak of a demonstration ITEM (the Core's
   own `integritySource`), not of the Core, and rule 3a lets a demonstration be marked. If the ruling is
   "no `demo` in any name on an own-capture Core", the change is `exportDownloadPlan` + one label.
2. F2 replaces the machine-readable `demo: true` by `demonstrationItem: true` instead of dropping it
   bare: a not-evidence file of a demonstration item should stay recognisable by a member, not only by
   a sentence. This is one member more than the log export's rule ("no `demo` member").
3. Note 174 decision 2 is corrected by section 1a: `diagnostics.tsx:137` is not a Live download.
4. `export-download.ts:169-174` (row 5) is dead in product use (`simulated` is always `null`); left in place.
5. The file-claims line of this pass was written at its end.

---
*Generated: 2026-10-12 12:05 WIB*
