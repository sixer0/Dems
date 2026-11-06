---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: closing copy round (decision D184 DQ-7, D185), W83 ledger rows #89 to #95
agent: coder-execution
date: 2026-10-06
window: 04:39 to 05:20 WIB
status: complete (7 of 7; item #90 landed under decision D186, section 12)
tree: 057fc17 plus the uncommitted page-row and W83 work; W84 writing `api-reference` in parallel
---

# Closing copy round: the seven copy merges of the W83 ledger (F items #89 to #95)

## 1. Summary

| # | Ledger | Outcome | One source now | Simulated copy |
|--:|---|---|---|---|
| 1 | #89 `sessionNew.live.*` (D164 DN-5) | **Done** | `sessionNew.live.speakToTest`, `sessionNew.live.scanCaseNumber` (shared), read by web and mobile | unchanged |
| 2 | #90 `devices.live.samples` (D166, D160) | Stopped at 05:10 (section 4); **done at 05:14 under D186, option A** (section 12) | `devices.live.samples` (shared), read by web and mobile | unchanged |
| 3 | #91 `storage.manage.live.applied` (D168 DN-2) | **Done** | W71's shared key, now read by mobile too | unchanged |
| 4 | #92 `system.live.*` (D177 DN-5, F82-3) | **Done** (+ the mobile Devices diagnostics sheet, DC-1) | `system.live.diagnosticsSubtitle`, `.install`, `.startedToast` | unchanged |
| 5 | #93 "(simulated)" in Live (D162 DN-5, F-3) | **Done** | `evidence.live.export.success` (shared) | unchanged |
| 6 | #94 F75-7 (D176 DC-5) | **Done: THE deliberate Simulated change** | `securityAudit.exportAudit.result.reasonNote` (value changed) | **changed, by ruling** |
| 7 | #95 Metadata "No DEMO package" (D165) | **Done** (web) | the header chip's `evidence.live.mediaUnavailable` | unchanged |

Gate (section 7, `assets/08c_copy_final_gate.log`): shared **69 / 1,840**, core-web **100 / 1,381**, mobile **140 / 1,721**,
each exit 0 (ledger 69 / 1,840, 95 / 1,255, 140 / 1,721); typecheck and lint of the three exit 0 with no output;
KI-07 = **62**; the 6 protected web tests and the 72 mobile baseline tests byte-identical (78 SHA-256 values).
Mutations (rule M15, in memory, no tree file written): web 13 of 13, mobile 12 of 14 (the 2 survivors are Simulated
branches this round did not change and that no test pins, section 6).

## 2. 5W1H

| | |
|---|---|
| What | Make web and mobile use one wording for each F item of the W83 ledger, from one source, keeping Simulated copy except #94 |
| Who | This agent. Rulings it rests on: D164 DN-5, D166 (DN-F2), D168 DN-2, D177 DN-5, D162 DN-5, D176 DC-5, D165, D184 DQ-7, D185 |
| When | 2026-10-06 04:39 to 05:10 WIB, after W83 phase 2 (D185), in parallel with W84 |
| Where | `packages/shared/src/i18n/en/{session-new,evidence,security-audit}.ts`; web `features/{session-new,evidence,security-audit}`; mobile `features/{session-new,storage,settings,devices,evidence}` (28 files modified, 3 test files added; list in section 8) |
| Why | Client spec §3.2: "a screen that shows simulator data says 'simulated'; a screen that says 'live' shows server data" (`masterplan/04_client_integration_spec.md:341`) and 04 §9 (web and mobile say the same thing) |
| How | Per item: add the shared key (or reuse the existing one), switch the callers, change only the tests that pin the old key or text (smallest change), remove the mobile key once a grep finds no reader, run the item's tests, run in-memory mutations |

## 3. Per item (strings before / after, files, tests)

### 3.1 Item 1, ledger #89: one pair of Live words in Start Session (D164 DN-5; M1 report `09b:304`)

| Place | Simulated (unchanged) | Live before | Live after |
|---|---|---|---|
| Web step 1, scan button label and tooltip | "Scan case number (simulated)" | "Scan case number (simulated)" (**false in Live**) | "Fill in the next case number" |
| Web step 2, meters' hint | "Speak to test (simulated)" | "Speak to test (simulated)" (**false in Live**) | "Microphone levels from the Core server" |
| Mobile, the same two places | the same two Simulated texts | the same two Live texts from `features.session-new.live.*` | the same texts from `sessionNew.live.*` |

Truth check: in Live the web scan reserves the next number on the Core (operation 32, `apps/core-web/src/features/session-new/sim-adapter.ts:5-8`);
the meters read the Live source's audio channel (`components/composed/dbfs-meter.tsx:192, 270`), the Core's `meters` frames, as on mobile.

Files: `packages/shared/src/i18n/en/session-new.ts` (+2 keys under `live`); web `devices-step.tsx` (Live branch of the
hint), `info-step.tsx` (new optional `live` prop, one `scanLabel` for label and tooltip), `index.tsx` (passes `live`);
mobile `device-previews.tsx`, `session-info-step.tsx` (keys switched), `i18n.ts` (two keys removed).
New test: `apps/core-web/src/features/session-new/__tests__/copy-round-live-words.test.tsx` (5 tests: the pair, Simulated
step 1 and 2 at component level, Live step 1 and 2 on the real router with the Live source; the tooltip is opened by
keyboard focus). Affected tests after the item: web session-new 6 files / 65, mobile session-new 7 suites / 88, mobile
`src/i18n` 1 / 9, shared i18n 2 / 50, all passed.

### 3.2 Item 3, ledger #91: the storage policy toast (D168 DN-2)

| Place | Simulated (unchanged) | Live before | Live after |
|---|---|---|---|
| Mobile Manage Storage, Apply toast | "Storage policy updated (simulated)" | "Storage policy updated" from `features.storage.live.applied` | "Storage policy updated" from W71's shared `storage.manage.live.applied` (the web's key) |

Files: mobile `storage-screen.tsx` (key and the table comment), `i18n.ts` (the `live` block removed; a comment says where
the text is). Affected tests: mobile storage 4 / 39, web storage 4 / 43, passed.

### 3.3 Item 4, ledger #92: Settings' update and diagnostics words (D177 DN-5, W82 F82-3)

| Place (mobile, LIVE) | Before (`features.settings.live.*`) | After (shared, the web's `system.live.*`) |
|---|---|---|
| Settings, diagnostics card subtitle | "Eight health checks on the Core, one after another." | "Eight health checks on the Core server, one after another." |
| Settings, Install button | "Install update" | "Install update" (same text, shared key) |
| Settings, started toast | "Installing v{{version}}" | "Installing v{{version}}" (same text, shared key) |
| **Devices, diagnostics sheet subtitle (DC-1)** | "Eight health checks on the Core, one after another." (`features.devices.live.diagnosticsSubtitle`, W78) | "Eight health checks on the Core server, one after another." |

Simulated words unchanged ("Eight health checks, one after another (simulated).", "Install update (simulated)",
"Installing v… (simulated)"). W82's keys without a web twin stay mobile-local (`permissions`, `permissionsNote`,
`updateNote`, `demoNote`, `demoFlagOff`, `demoNotPermitted`, `biometricFailed`): DN-5 of W82
(`implementation/82_mobile_settings.md:410`) names only the update and diagnostics copy.

Files: mobile `settings/maintenance-section.tsx` (3 keys, header comment), `settings/i18n.ts` (3 keys removed),
`devices/diagnostics-sheet.tsx` (1 key), `devices/i18n.ts` (1 key removed), `devices/device-detail.tsx` (comment only).
Affected tests: mobile settings + devices 13 suites / 137, passed.

### 3.4 Item 5, ledger #93: the shared "(simulated)" export toast in Live (D162 DN-5, W74 F-3)

| Place | Simulated (unchanged) | Live before | Live after |
|---|---|---|---|
| Mobile export sheet, success toast | "Export of {{id}} accepted (simulated)" (`evidence.exportWizard.success`) | "Export of {{id}} accepted by the Core" (`features.evidence.export.successLive`) | the same text from the shared `evidence.live.export.success`, the Live twin beside the Simulated key |

The web never shows `exportWizard.success`: its toast is `evidence.exportWizard.successToast` ("Export of {{id}} recorded in
the chain of custody", `apps/core-web/src/features/evidence/export-wizard.tsx:193`), true in both modes; nothing to switch
there. The destination labels keep "(simulated)" in both modes (D158 DC-4).

Files: `packages/shared/src/i18n/en/evidence.ts` (+1 key), mobile `export-sheet.tsx`, `i18n.ts` (key removed).
Affected tests: mobile evidence 9 / 79, passed.

### 3.5 Item 6, ledger #94: THE deliberate Simulated change (D176 DC-5, finding F75-7)

| Place | Simulated before | Simulated after | Live (unchanged) |
|---|---|---|---|
| Web Security & Audit, audit export result, under the reason | "Shown here only: the demo simulator does not record the export reason yet." | **"Recorded by the simulator in the audit row of the export."** | "Recorded by the Core in the audit row of the export." |

Why: the simulator writes the reason into the export's `AUDIT_EXPORTED` row since step 54 (`packages/shared/src/sim/types.ts:1038-1039`;
`apps/core-web/src/features/security-audit/__tests__/security-audit.test.tsx:216-228`), so the old note is false. The new
note uses the Live note's words with only the recorder changed. This is the one Simulated copy change of the round.

Files: `packages/shared/src/i18n/en/security-audit.ts` (value). New test:
`apps/core-web/src/features/security-audit/__tests__/copy-round-reason-note.test.ts` (2 tests: the note's words and their
parallel with the Live note; the claim is true on a simulator). `live-security-audit-export.test.tsx:455` reads the key
and stays green unchanged. Affected tests: web security-audit 6 files / 65, passed.

### 3.6 Item 7, ledger #95: the web Metadata tab when operation 40 does not answer (D165, `08a:393-395`)

| Case (web, Metadata tab of an item without a package) | Empty-state title | The record's `note` |
|---|---|---|
| Simulated (unchanged) | "No DEMO package for this item" | "SIMULATED record from the in-browser simulator; no DEMO package joins this item." |
| Live, operation 40 answers NONE (unchanged) | "No DEMO package for this item" | "The Core server's record of this item; no DEMO package joins it." |
| Live, operation 40 unanswered, **before** | "No DEMO package for this item" (unknown, so not true) | "… no DEMO package joins it." (same) |
| Live, operation 40 unanswered, **after** | "Media reference unavailable" (the header chip's key `evidence.live.mediaUnavailable`) | "The Core server's record of this item; its media reference is unavailable, so no DEMO package is shown." (DC-2) |

Files: web `metadata-tab.tsx` (optional `mediaUnavailable` prop, honoured in Live only), `detail-page.tsx` (passes
`media.status === 'unavailable'`). New test: `apps/core-web/src/features/evidence/__tests__/copy-round-metadata-media.test.tsx`
(3 tests). Affected tests: web evidence 8 files / 61, passed (incl. `live-w0-evidence-words.test.tsx`, unchanged).

## 4. Item 2, ledger #90: STOPPED, a wording decision is needed (ruled by D186: option A, landed in section 12)

The web's Live health caption is `devices.live.samples_*` = "Last {{count}} samples" (`packages/shared/src/i18n/en/devices.ts:330-331`).
The mobile's, ratified in D166 DN-F2, is "Derived on this device from the Core's data · last {{count}} samples"
(`apps/mobile/src/features/devices/i18n.ts:101-102`). Both lines are derived on the client from the replica
(web `health-chart.tsx` uses `healthSeries()` of the replica once per second), so the web caption should say "derived".

One sentence for both is not mechanical: on the web "this device" names the DEMS device whose drawer is open (the web
copy uses "device" for cameras, microphones and paired tablets, e.g. `paired-devices.ts:100` "Why is this device
revoked?") and the console calls its own client computation "in this browser" (`evidence.ts:213, 334`, `shell.ts:29`).
Copying the mobile sentence onto the web would make a Live web screen say something misleading (§3.2).

| Option | Web Live caption | Mobile LIVE caption | Shared key | Effect |
|---|---|---|---|---|
| **A (recommended)** | "Derived from the Core's data · last N samples" | the same | one `devices.live.samples_*` (value change), mobile switches, its key removed | One true sentence; mobile loses "on this device" (a value change of D166 DN-F2's wording, one W78 pin and one M1b pin change) |
| B | "Derived on this device from the Core's data · last N samples" | unchanged | one shared key with the mobile text | One sentence, but misleading on the web |
| C | "Derived in this browser from the Core's data · last N samples" | unchanged | two keys, a test pins the shared tail equal | Two sentences, each true; not "one wording" |

Nothing of item 2 was written (`devices.ts`, mobile `health-chart.tsx`, `live-devices-health-caption.test.tsx` are
byte-equal to their pre-images). With a ruling it is about 15 minutes: one key value, one mobile caller, the two
mobile pins (`live-devices-health-caption.test.tsx:56-57`, `live-devices-sites.test.tsx:369`), one new web assertion.

## 5. Decisions for the controller

| ID | Decision | Why | Asked |
|---|---|---|---|
| DC-1 | Item 4 also points the mobile **Devices** diagnostics sheet (W78) at `system.live.diagnosticsSubtitle` and removes `features.devices.live.diagnosticsSubtitle` | It is the same sentence on the same Core diagnostics run (operation 65). Moving only Settings would leave mobile with "on the Core" in Devices and "on the Core server" in Settings | Ratify |
| DC-2 | Item 7's record note for the unavailable case is a new code literal: "The Core server's record of this item; its media reference is unavailable, so no DEMO package is shown." | Without it the tab still claims "no DEMO package joins it" in the case #95 is about; built from the existing note and the mobile `media.unavailable` sentence | Ratify the words |
| DC-3 | Item 5 places the Live twin at `evidence.live.export.success`; the web has no call site | The web's success toast never said "(simulated)"; the shared Live twin sits beside every other `evidence.live.*` key | Ratify |
| DC-4 | Three new web test files in the features' `__tests__` folders (10 tests) | The web had no test of the Live words of items 1, 6 and 7; mobile already had them | Ratify |
| DC-5 | Item 4 keeps W82's seven Live keys that have no web twin in the mobile feature file | W82 DN-5 names the update and diagnostics copy only; moving mobile-only text into `system.live.*` merges nothing | Ratify |

## 6. Mutation check (rule M15)

Method of W0 (web) and M1 (mobile): one text replacement in one module, applied in memory by a Vite transform plugin
(web) or a jest transformer around the app's babel-jest (mobile); detected = the runner exits non-zero; the SHA-256 of
every mutated file is equal before and after each batch ("identical" in both logs). Tools and logs:
`assets/08c_copy_mutation_config.mts.txt`, `08c_copy_run_web.py.txt`, `08c_copy_web_mutations.log`,
`08c_copy_jest_mut_config.cjs.txt`, `08c_copy_mutating_transformer.cjs.txt`, `08c_copy_run_mobile.py.txt`,
`08c_copy_mobile_mutations.log`.

| Group | Mutants | Detected | Note |
|---|--:|--:|---|
| Web item 1 (C1W1-C1W6) | 6 | 6 | C1W6 (tooltip keeps the Simulated words) first survived: the tooltip is not in the DOM until opened; the test now opens it by keyboard focus; re-run detected |
| Web item 6 (C6W1-C6W2) | 2 | 2 | C6W1 mutates the shared i18n file in memory |
| Web item 7 (C7W1-C7W5) | 5 | 5 | |
| Mobile item 1 (A1-A4) | 4 | 4 | |
| Mobile item 3 (C1-C2) | 2 | 2 | |
| Mobile item 4 (D1-D6) | 6 | 5 | **D6 not detected**: Settings' SIMULATED subtitle given the Live words. The Simulated branch is unchanged by this round; no test pins Settings' Simulated subtitle (the Simulated Settings test is a baseline file, the Live bed renders LIVE only) |
| Mobile item 5 (E1-E2) | 2 | 1 | **E2 not detected**: the SIMULATED export toast given the Live sentence. Unchanged branch; no test pins the Simulated toast (Live-only bed; the Simulated detail test is a baseline file) |
| **Total** | **27** | **25** | the two survivors are pre-existing coverage gaps of Simulated branches, noted for W100 / W92 |

## 7. Verification (`assets/08c_copy_final_gate.log`)

```
## 2026-10-06 05:02:19 WIB (re-run after the type fix of the new test's form default)  load 3.05 2.47 2.34
typecheck @dems/shared exit=0      lint @dems/shared exit=0
typecheck @dems/core-web exit=0    lint @dems/core-web exit=0
typecheck @dems/mobile exit=0      lint @dems/mobile exit=0
## 05:03:00 $ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  69 passed (69)
      Tests  1840 passed (1840)
exit=0
## 05:03:14 $ npm run test -w @dems/core-web -- --maxWorkers=2
 Test Files  100 passed (100)
      Tests  1381 passed (1381)
exit=0
## 05:05:35 $ npm run test -w @dems/mobile -- --maxWorkers=2
Test Suites: 140 passed, 140 total
Tests:       1721 passed, 1721 total
exit=0
## 05:07:13 KI-07: grep -rhoE "SIM-GAP-M[0-9]+-[0-9]+" apps/mobile/src | wc -l
62
## protected tests (6 web + 72 mobile baseline), sha256 now vs 04:39
identical: 78 files
```

The first typecheck at 05:01 failed once on this round's new test (`profileId: ''` is not a profile id); fixed to
`'STANDARD_1080P25'` and re-run (above). The lint commands print nothing on a clean run (oxlint, eslint).
core-web is 100 / 1,381 against the ledger's 95 / 1,255: this round added 3 files / 10 tests; the rest is W84's
parallel work (`api-reference`). No red test outside this round's files was seen in any run.

One source per merged sentence (same log, test files excluded): each of "Microphone levels from the Core server",
"Fill in the next case number", "Storage policy updated", "Eight health checks on the Core server, one after another.",
"Install update", "Installing v{{version}}", "Export of {{id}} accepted by the Core", "Recorded by the simulator in the
audit row of the export.", "Media reference unavailable" occurs once, in `packages/shared/src/i18n/en/*.ts`; "Eight health
checks on the Core, one after another." and the old audit note occur nowhere as a value (the old note survives only in
the explaining comment). A grep for every removed mobile key (`features.session-new.live.speakToTest`, `.scanCaseNumber`,
`features.storage.live`, `features.settings.live.{diagnosticsSubtitle,install,updateStarted}`,
`features.devices.live.diagnosticsSubtitle`, `features.evidence.export.successLive` and their object paths) finds no reader.

## 8. Files and tests changed by design

Modified (28; full diff `assets/08c_copy_changes.diff.txt`, 843 lines): shared `session-new.ts`, `evidence.ts`,
`security-audit.ts`; web `session-new/{devices-step,info-step,index}.tsx`, `evidence/{metadata-tab,detail-page}.tsx`;
mobile `session-new/{device-previews.tsx,session-info-step.tsx,i18n.ts}`, `storage/{storage-screen.tsx,i18n.ts}`,
`settings/{maintenance-section.tsx,i18n.ts}`, `devices/{diagnostics-sheet.tsx,device-detail.tsx,i18n.ts}`,
`evidence/{export-sheet.tsx,i18n.ts}`, and the 8 tests below. Added (3): the three `copy-round-*.test.ts(x)` of section 3.

Tests that pinned the old key or text, smallest change (none is a baseline file; none of the six protected web files):

| Test | Before | After |
|---|---|---|
| mobile `session-new/live-session-new-followups.test.tsx:233-236` | `sessionNewEn.live.speakToTest`, `.scanCaseNumber`; loop over `sessionNewEn.live` | `en.sessionNew.live.*` (import `en`); loop over both trees |
| mobile `storage/storage-live-static.test.ts:145-151` | `leaves(storageEn.live)`; regex `features\.storage\.live\.applied` | `leaves(en.storage.manage.live)`; + no `live.` leaf in the folder; regex `storage\.manage\.live\.applied` |
| mobile `settings/settings-live-static.test.ts:167` | `live.length` 10 | 7 |
| mobile `settings/live-settings-sites.test.tsx:66` | "…on the Core, one after another." | "…on the Core server, one after another." |
| mobile `devices/live-devices-sites.test.tsx:283` | "…on the Core, one after another." | "…on the Core server, one after another." |
| mobile `devices/devices-live-static.test.ts:139` | `live` 11 leaves | 10 |
| mobile `evidence/live-evidence-export.test.tsx:181` | `evidenceEn.export.successLive` | `en.evidence.live.export.success` (import `en`) |
| mobile `evidence/live-evidence-static.test.ts:51-62, 153-154` | `LIVE_KEYS` with `export.successLive` | without it; + one line: the shared Live sentence says nothing of a simulation |

## 9. Observations (not this round's)

- Mobile Metadata tab: in LIVE with operation 40 unanswered it shows "No DEMO package for this item: the manifest is not on
  this device." (`apps/mobile/src/features/evidence/i18n.ts`, `metadata.notAvailable`): the same class as #95; the
  ledger names the web only.
- The web Demo panel note in Live is `system.demo.note` "Demo only. Injected faults are simulated."; mobile LIVE says
  "Demo only. Faults are injected on the Core server, and every connected console sees them." Two sentences for one panel
  (both arguably true); not a ledger row.
- Mobile's `features.settings.live.updateNote` ("no software is installed") has no web counterpart on the Live update card.

## 10. Deviations

| # | What | Effect |
|---|---|---|
| DV-1 | The brief says never `cd`. During the reading phase (before 04:40) about 17 read-only commands (grep, sed, wc, ls) began with `cd /Users/gsp-budi/Documents/DEMS &&` (count from the session's own command list, approximate); one failed first attempt at saving pre-images ran `mkdir`/`cp` under `.cache/` after a `cd` (it wrote nothing: both directories already existed, and every copy failed with "File name too long"); and the pre-image hashing at 04:40 ran `shasum` inside a subshell `(cd /; …)` | Nothing outside `.cache/` was written by them; every later command used absolute paths without `cd` |
| DV-2 | `apps/mobile/src/features/devices/device-detail.tsx` (a comment) was edited before its pre-image was saved | Its pre-image was taken from the HEAD blob at 05:08; `git diff` showed only this round's hunk, so the blob is the exact pre-image |
| DV-3 | Item 2 not done | Section 4: needs a wording ruling |

## 11. Rollback

Pre-images of all 28 modified files are under `.cache/rollback/COPY/<same path>` (hashes in `PRE_SHA256.txt`). To undo
the round: copy each back over its path, and remove the three new test files
(`apps/core-web/src/features/{session-new,security-audit,evidence}/__tests__/copy-round-*.test.ts(x)`), which only the
controller may decide to delete. Per item, the files of section 3 are independent of each other except the shared
`evidence.ts`, which carries items 5 (one key) and nothing of item 7 (item 7 reuses an existing key).

## 12. #90 (decision D186)

**Ruling (D186):** option A, one sentence for both clients, "Derived from the Core's data · last N samples", as a shared
key read by both apps; SIMULATED unchanged. D186 also accepted DC-1 to DC-5 and ratified the Simulated change of #94.
Window 05:11 to 05:20 WIB. Pre-#90 snapshots of the six files #90 touches (three of them already changed by #92) are under
`.cache/rollback/COPY/pre-90/` (`PRE_SHA256.txt`); #90 alone: `assets/08c_copy_d186_item90.diff.txt` (237 lines).

| Place | Simulated (unchanged) | Live before | Live after |
|---|---|---|---|
| Web, device drawer, Health tab caption | "Simulated · last N samples" (`devices.drawer.health.samples_*`) | "Last N samples" (`devices.live.samples_*`) | **"Derived from the Core's data · last N samples"** (same key, new value) |
| Mobile, device detail, Health caption | "Simulated · last N samples" (same shared key) | "Derived on this device from the Core's data · last N samples" (`features.devices.live.samples_*`) | **"Derived from the Core's data · last N samples"** (the shared `devices.live.samples_*`) |

The one-sample forms follow the same pattern: "Derived from the Core's data · {{count}} sample".

Files: `packages/shared/src/i18n/en/devices.ts` (the two values, plus a comment); mobile `devices/health-chart.tsx` (key and
header comment), `devices/i18n.ts` (`samples_one` and `samples_other` removed, with a comment saying where they went). The
web caller is unchanged (`apps/core-web/src/features/devices/live.ts:36` already read `devices.live.samples`).
New web test (a fourth `copy-round-*` file, made under D186 like the three accepted in DC-4):
`apps/core-web/src/features/devices/__tests__/copy-round-health-caption.test.tsx`. It has 3 tests: the shared sentence
(no "simulat", "this device" or "this browser"), the Simulated chart, and the Live drawer of Camera 1 on the real router.

By-design pin changes (none is a baseline file):

| Test | Before | After |
|---|---|---|
| mobile `devices/live-devices-health-caption.test.tsx` (import, `LIVE_CAPTION`, the "LIVE texts" test, the per-metric expectation and two titles) | `devicesEn.live.samples_*` = "Derived on this device from the Core's data · …"; `/^Derived on this device from the Core's data · last (\d+) samples$/`; "… · last 7 samples" | `en.devices.live.samples_*` = "Derived from the Core's data · …"; `/^Derived from the Core's data · last (\d+) samples$/`; "Derived from the Core's data · last 7 samples" |
| mobile `devices/live-devices-sites.test.tsx:369` | `/^(?:Derived on this device from the Core's data · last \d+ samples\|Collecting samples…)$/` | `/^(?:Derived from the Core's data · last \d+ samples\|Collecting samples…)$/` |
| mobile `devices/devices-live-static.test.ts:139` | `live` 10 leaves (after #92) | 8 |

Affected tests after the item: mobile `devices` + `src/i18n`: 6 suites / 65 passed. Web `features/devices`, `live-devices*`
and `live-dashboard-devices`: 6 files / 73 passed.

Mutations (rule M15, in memory): web C2W1 (the shared value set back to "Last {{count}} samples"), C2W2 (Live takes the
Simulated key), C2W3 (Simulated takes the Live key): 3 of 3 detected. Mobile B1 (LIVE falls back to Simulated) and B2
(SIMULATED takes the Live key): 2 of 2 detected. Mutated files byte-identical before and after. **Round totals:** web
16 of 16, mobile 14 of 16 (D6 and E2 as in section 6).

### 12.1 Final gate after D186 (`assets/08c_copy_final_gate.log`, block "D186 … final gate re-run")

```
## 2026-10-06 05:15:04 WIB  load 4.46 3.74 3.21
typecheck @dems/shared exit=0      lint @dems/shared exit=0
typecheck @dems/core-web exit=0    lint @dems/core-web exit=0
typecheck @dems/mobile exit=0      lint @dems/mobile exit=0
## 05:15:33 $ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  69 passed (69)
      Tests  1840 passed (1840)
exit=0
## 05:15:46 $ npm run test -w @dems/core-web -- --maxWorkers=2
 Test Files  101 passed (101)
      Tests  1384 passed (1384)
exit=0
## 05:18:10 $ npm run test -w @dems/mobile -- --maxWorkers=2
Test Suites: 140 passed, 140 total
Tests:       1721 passed, 1721 total
exit=0
## 05:19:47 KI-07: 62
## protected tests (6 web + 72 mobile baseline), sha256 now vs 04:39: identical: 78 files
## one source for the #90 caption (test files excluded)
apps/mobile/src/features/devices/i18n.ts:100:    // `devices.live.samples`, one sentence for both clients ("Derived from the Core's data · last N samples"):
packages/shared/src/i18n/en/devices.ts:336:    samples_one: "Derived from the Core's data · {{count}} sample",
packages/shared/src/i18n/en/devices.ts:337:    samples_other: "Derived from the Core's data · last {{count}} samples",
## callers of devices.live.samples
apps/core-web/src/features/devices/live.ts:36:    samples: 'devices.live.samples',
apps/mobile/src/features/devices/health-chart.tsx:94:   … t(live ? 'devices.live.samples' : 'devices.drawer.health.samples', …)
## readers of the removed mobile key: none
```

The mobile `i18n.ts:100` hit is a comment (it says "N", not the template). "Derived on this device" and "'Last {{count}}
samples'" are no longer found anywhere. core-web 101 / 1,384: compared with 05:05, +1 file / +3 tests, which is exactly this
test file. W84 is still writing `api-reference` and no red test was seen. No `cd` was used in this phase.

### 12.2 Totals of the round after D186

31 files modified and 4 test files added (full diff `assets/08c_copy_changes.diff.txt`, 1,058 lines; rollback as in
section 11, with `.cache/rollback/COPY/pre-90/` for #90 alone). All seven F items of the ledger are closed: #89, #90, #91,
#92 and #93 are merged into one shared source each; #94 is the one ratified Simulated change; #95 reuses the header chip's key.
