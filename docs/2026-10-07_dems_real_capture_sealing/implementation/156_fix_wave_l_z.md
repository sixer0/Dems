---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: fix wave L, closing pass L-Z (packages/shared, apps/core-server, apps/mobile, apps/core-web where named)
date: 2026-10-11
agent: coder-execution
narrative_tier: 2
tree: commit b05106b + fix 151 + wave L (L-S, L-W, L-M) in the same working tree; no git write by me
source: delegation_progress/fix_brief_wave_l.md, fix_brief_wave_k.md, driver_rules_d94.md, contract_wave_l.md; implementation/153, 154, 155 (their decisions and open items); file_requests.md (the wave L line of L-M)
status: needs-review
---

# 156 - Fix wave L, closing pass L-Z

Run window 11:26 - 12:20 WIB. No device, no browser, no lane call, no lane restart or reset, no
git write, no install, no migration; `.data/pg*.env` not read; no LOCAL_DEVICE source selected,
pre-checked or started (the fixtures that NAME `CAM-03` / `LOCAL_DEVICE` are jsdom / jest states of
a fake Core: nothing is opened). Totals 97 / 36 / 61 / 67 and schema 6 unmoved; no contract member
added; OpenAPI not touched. Logs of the whole-suite runs: `.cache/gates/wave-l-z/` (git-ignored).

**Status needs-review** for the decisions of section 7 (three of them move a bound or a wording
nobody ruled) and because nothing of this pass was driven on a device or in a browser.

## 1. Item 1 - the selector snapshot of a SEALED session (cause of G70c-01)

**Cause.** The replicated `session` slice keeps the LAST session after its seal, with the selector
snapshot that session took. These readers took that snapshot whenever the slice held one:

| Reader (line before this pass) | What it feeds |
|---|---|
| `packages/shared/src/sim/audio.ts:64-65` `captureMicLines` | the meters (`audio.ts:280`), `activeMeterChannel` (`:88`), `useAudioChannel` (`react.ts:111`), health (`health.ts:164`), the API read (`api.ts:363`), the faults (`faults.ts:238, 351, 618`), capture telemetry (`capture-telemetry.ts:49`) |
| `packages/shared/src/sim/capture-notices.ts:383-384` `selectorOf` | `captureReachabilityOf` (the start rule) |
| `packages/shared/src/sim/capture-session.ts:269-270` `sessionCameras` | `camerasNotConnecting`, `advanceCaptureStart` |
| `packages/shared/src/sim/session-machine.ts:511`, `:923`, `:971`; `api.ts:1647` | the pre-check microphone rows; the audio-source switch (always under a RECORDING session: no visible defect, one spelling less) |
| `apps/core-web/src/features/devices/camera-preview.tsx:37` | the "No preview" tile of Dashboard, Devices, Monitor, Session New |
| `apps/core-web/src/features/devices/source-class.ts:141` `usePrecheckDevice` | the source badge of the Session New pre-check rows |
| `apps/core-web/src/features/devices/local-source-gate.ts:194`, `:211` | the local-device notice before a pre-check / a start |
| `apps/core-web/src/features/session-monitor/audio-source.ts:148` `selectStandbyInputId` | the Monitor's microphone pair |

**Change.** ONE helper, `packages/shared/src/sim/selector-in-force.ts` (L-M's file moved to the
shared package, same names, plus `selectorOfSession(session, current)`): a session's snapshot names
the sources only while that session is OPEN (state stated and not `SEALED` - equal to
`isSessionActive` for every state of the machine, held by test); otherwise the current selector.

- shared: `captureMicLines` IS `micLinesInForce` now; `selectorOf`, `sessionCameras` and the four
  inline spellings go through the helper. Exported from `@dems/shared/sim`.
- mobile: `apps/mobile/src/features/capture-selector/selector-in-force.ts` re-exports the shared
  functions (the app's one door; L-M's static test stays as it is and still passes).
- web: the readers of the table use `selectorInForce` / `cameraLinesInForce` /
  `openSessionSnapshot`; `localSourcesInForce(state)` (new, pure) is what `useLocalSources` reads.
  `useTrackDevice` and `useMicInputDevice` (`source-class.ts:91-106`) read the line of the selector
  IN FORCE too: the tile's line and its device were read by two rules (the line from the snapshot,
  the device from the current selector) - found by the control case of the new test.
- NOT under the rule (stated in the helper's header, pinned by test): a fact OF one session. The
  Monitor's "Configured profile" (`session-monitor/sim-adapter.ts:206`, L-W) keeps reading the
  session's OWN snapshot, also when that session is sealed - the card describes that session
  (decision 1). `api.ts:808` (the audio intervals of a session summary) likewise, with no fallback.
- core-server: the three sites that spell the expression (`capture-session/index.ts:617`, `:1183`,
  `engine/capture-session.ts:106`) run only under a RECORDING session: not changed.

**Tests.**

| Test | Result |
|---|---|
| `packages/shared/test/sim-wave-l-z-selector-in-force.test.ts` - the rule; every shared reader in the order of the defect (sealed session, THEN the selector changed) with the open-session control; a static case against a second spelling in `packages/shared/src`; `captureMicLines` is the helper | `Tests 9 passed (9)` |
| the same file with the rule taken out of the helper (mutation, then restored) | `Tests 5 failed | 4 passed (9)` |
| `apps/core-web/src/test/wave-l-z-selector-in-force.test.tsx` - Live pages of a Core in real capture: Dashboard and Devices name `CAM-05` after a sealed session that recorded `CAM-02`; control with the session open (`CAM-02`) on Devices and on the Monitor; `usePrecheckDevice` (Session New rows) both ways; the local-device notice both ways (a selector that names this Mac's camera after a sealed session IS asked about; a sealed session that recorded with it names nothing); the Monitor pair and the meter channel; "Configured profile" keeps the session's own; a static case against a second spelling in `apps/core-web/src` | 19 cases, in `Test Files 20 passed (20) / Tests 227 passed (227)` |
| mobile `capture-selector/wave-l-m-selector-in-force.test.ts` (L-M's, unchanged, now over the shared helper) | passed in the whole run and in `Test Suites: 45 passed / Tests: 403 passed` |

By test only: the Monitor and Session New with a SEALED session in the slice draw no camera tile
(the Monitor of a sealed session shows its summary state; Session New step 2 needs an open
session), so their readers are held at the hook / selector level, not as a page.

## 2. Item 2 - the Core's blocked-seal sentences (G75d-02; decision 3 of note 155)

**Cause.** `apps/core-server/src/sealing/pipeline/way-out.ts:110-130` (ten hints ending "then start
recovery for the session or restart the Core.") and `:95` `sealWaitingNotice` ("... Sealing will be
tried again when the Core starts, or by the recovery action."). No screen has a control of that
name.

**Change.**

| Sentence | Now |
|---|---|
| every restore hint (the alert, the log line) | `<what to check>, then retry the seal: an investigator or a supervisor presses "Retry sealing" on the Session Monitor of the web console, or the Core is restarted.` - the tail is ONE shared constant `SEAL_RETRY_HOW_SENTENCE` (with `SEAL_RETRY_CONTROL_NAME`), `packages/shared/src/sim/seal-blocked.ts` |
| the failed step once the retries are used up (`sealWaitingNotice`) | `<cause> Sealing stopped after 3 automatic retries: the Core now waits and does not run it again by itself.` - `sealStoppedSentence(retries)` of the shared package; the number is the bound of the settings in force |
| a Core that CLOSES before its retries are used up (was the same sentence) | `<cause> Sealing will be tried again when the Core starts.` (`sealClosingNotice`): "stopped after 3 retries" would be untrue there |
| the shared examples `SEAL_BLOCKED_EXAMPLE_ALERT.message`, `SEAL_BLOCKED_EXAMPLE_FINALIZATION.steps[0].detail` | the new words (a Core test holds them equal to the Core's functions) |

The alert carries who / where / the control's name; the step sentence carries what the Core did.
The web dialog draws both, so neither repeats the other. No code, operation or permission name is
in a sentence (held by a pattern over every failure code and cause).

- **The engine door's bound moved: 400 -> 600** (`apps/core-server/src/engine/sealing-notice-doors.ts:119`,
  now `SEAL_BLOCKED_MESSAGE_MAX`). The longest notice is about 450 characters; the old tail was 58
  characters and left 17 free. The column is `text`; the API schema states no length (decision 2).
- **Mobile, the device-side mapping.** L-M's line "The recovery named above is "Retry sealing" on
  the web console ..." is gone (`session-finalizing/i18n.ts`, `seal-attention.tsx`): the Core's own
  alert, drawn as written, says it. What stays under it: `sealStoppedSentence(SEAL_AUTOMATIC_RETRIES)`
  (the SAME shared function as the Core's step sentence - the device draws the alert, not the step),
  who resolves the cause, and "This device has no retry control: the retry is pressed on the web
  console." L-M's test keeps its meaning (3 automatic retries, who retries where, no control on the
  device, never "start recovery"), now read from the Core's sentence.
- **Web.** `web.waveL.sealRetry.action` = "Retry sealing" = `SEAL_RETRY_CONTROL_NAME`;
  "Sealing stopped after 3 automatic retries." / "An investigator or a supervisor can retry."
  agree with the Core's two sentences (held by test). No web string changed.

**Tests.**

| Test | Result |
|---|---|
| NEW `apps/core-server/src/sealing/__tests__/wave-l-z-blocked-sentence.test.ts` (6: every hint of every code and cause; the step sentence; the examples; the number; the door takes the longest notice and refuses a longer one; the closing sentence), with `way-out.test.ts` and `wave-i-a1-way-out.test.ts` moved by delta | `Test Files 68 passed (68) / Tests 831 passed (831)` (`src/sealing src/sealing-host src/engine test/static`) |
| web, "item 2" (3 cases) in the wave L-Z file | in the 227 above |
| mobile `session-finalizing/` | `Test Suites: 9 passed / Tests: 61 passed` |

## 3. Item 3 - mobile leftovers of the one rule (decision 5 of note 155)

| Where (line before) | Was, on a real-capture Core | Now |
|---|---|---|
| `capture-selector/capture-selector.tsx:219`, `capture-selector-model.ts:101` | "USB" under a generated microphone | `statedTransportOf`: no transport word for `adapter: 'FAKE'` |
| `devices/device-detail.tsx:462-470` camera overview | "Dual-lens IP camera DL-2", firmware, "PoE CAM 1", "1080p ... H.265", Mbps | generated source: Status, Device ID, "Source: Generated test source", "Format" = the selector line's profile or "Not reported", recording state |
| `device-detail.tsx:488-504` microphone overview | "Channel 1", "32 dB", "48 V ON", the converter, "read-only in this demo" | generated source: Status, Device ID, Source, the CLIP latch, recording state |
| the same two blocks for a source of ANOTHER adapter; PoE switch, indicator, tablet overviews; the derived health series | model values, unmarked | drawn under the "Synthetic demo values" chip |
| `devices/device-row.tsx:66`, `:89` | the room / "Channel n" under a generated source | "Generated test source" |
| `devices/devices-screen.tsx` "Other devices" section | unmarked | the chip in the section header |
| `devices/registered-device-detail.tsx:34` | "Model: FAKE-CAM-1" of an adopted generated camera | no model row |

One rule, `detailFactsOf(realCapture, adapter)` (`devices/devices-model.ts`): `SIMULATED` (not a
real-capture Core: exactly as before), `GENERATED` (`adapter: 'FAKE'`), `MODEL_VALUES` (everything
else on such a Core: the chip). The chip is the kit's `StatusChip` with the shared sentence of
Settings > About (`system.about.synthetic`) - `SyntheticValuesChip` in the existing
`device-status-chip.tsx`; no new file in `devices/` (its file list and its Simulated copy are
pinned), no new string.

Also on the WEB (remainder R-4 of note 154, the same sentence): `capture-selector-panel.tsx:363`
drew "USB input" for a generated microphone; `micTransportShown` (`own-core-words.ts`) hides it on
a Core in real capture (decision 4).

**Tests.** NEW `apps/mobile/src/features/devices/wave-l-z-one-rule.test.tsx`: the two rules; in
tablet AND phone layout: the selector lines, the camera detail (with and without a stated profile),
the microphone detail, the chip on a camera / microphone of another adapter, on PoE (overview and
health), indicator, tablet, the list; CONTROLS in both layouts: Simulated mode and a Core in
simulated capture are what they were (model values, no chip, "USB"). `Tests: 21 passed, 21 total`.
Web: 3 cases in the wave L-Z file (rule, Devices page, control).

## 4. Item 4 - G94c-02 after the move under `deferEffectStart`

Confirmed by test; **no product change**. L-W's two cases mount without StrictMode; the product
renders under it (`main.tsx`), where the effect is set up, cleaned up (the helper cancels the
start) and set up again. NEW in `features/evidence/__tests__/export-job.test.tsx`, mounted with
`strict: true`: a job that reaches COMPLETE -> operation 40 is read exactly once more and the
page lists `EXP-000032` with no reload; a job that ends FAILED asks once; while it runs nothing is
asked. `Tests 22 passed (22)`. Mutation (the invalidation taken out, then restored): both new cases
red.

## 5. Step 5 - the whole unit suites, once

| Suite | Command | Result |
|---|---|---|
| shared | `npm test -w @dems/shared` | `Test Files 121 passed (121) / Tests 2605 passed (2605)` |
| core-web | `npm test -w apps/core-web` | `Test Files 182 passed (182) / Tests 2197 passed (2197)` (before the three R-4 cases and the R-4 edit; those ran after: 20 files, 227 tests, green) |
| mobile | `npm test -w apps/mobile` | `Test Suites: 4 failed, 306 passed, 310 total / Tests: 5 failed, 2892 passed, 2897 total` |

Web and mobile ran at the same time (load average about 20).

**Every red, with its cause:**

| # | Red | Cause | Ruling |
|---|---|---|---|
| 1 | mobile `session-summary/summary-live-static.test.ts` "reads all three folders" | STALE PIN of L-M: the file list did not hold L-M's new `session-finalizing/open-notice.ts` | pin moved by delta (one line, with the reason): the file is the ruled G75d-01 change (D228 (2); decision 4 of note 155) |
| 2 | mobile `devices/devices-live-static.test.ts` "no SIM-GAP marker was added" (8 -> 9) | MINE: a comment of this pass named a marker | product comment reworded; the pin is unmoved |
| 3, 4 | mobile `session-finalizing/wave-l-m-blocked-who-where.test.tsx`, both layouts | MINE: the assertion I wrote for item 2 asked for an exact text where it meant "contains" | the test fixed (`exact: false`); product unchanged |
| 5 | mobile `session-live/mic-source.test.tsx` "captureDurable false ..." - timeout 20 s | load (two whole suites at once) | no change; the file alone: `PASS`, 4 files `43 passed` |

After the fixes: the four files, then `session-finalizing/` (61 of 61), then `devices/` +
`capture-selector/` + the static list (`45 suites, 403 tests`) - green. The whole mobile suite was
NOT run a second time (section 8).

**The stale pins L-S warned of:** none was red. No web or mobile test pins the notice as exactly
`{ sessionId, cause, at }`, the retry sentence with ": this session cannot be sealed.", or
`files[]` without `profile` (shared 0 red, web 0 red, mobile reds as listed).

**Typecheck and lint (whole workspaces, after the last edit).** `npm run typecheck` of
`@dems/shared`, `@dems/core-server`, `apps/core-web`, `apps/mobile`: exit 0 each. `npm run lint` of
the four: clean; mobile `0 errors, 1 warning` (`src/runtime/log.test.ts:160`, the known one).

## 6. Files

NEW: `packages/shared/src/sim/selector-in-force.ts`; tests
`packages/shared/test/sim-wave-l-z-selector-in-force.test.ts`,
`apps/core-server/src/sealing/__tests__/wave-l-z-blocked-sentence.test.ts`,
`apps/core-web/src/test/wave-l-z-selector-in-force.test.tsx`,
`apps/mobile/src/features/devices/wave-l-z-one-rule.test.tsx`.

EDITED (product):
- shared `src/sim/{audio.ts,capture-notices.ts,capture-session.ts,session-machine.ts,api.ts,seal-blocked.ts,index.ts}`
- core-server `src/sealing/pipeline/way-out.ts`, `src/engine/sealing-notice-doors.ts`
- core-web `src/features/devices/{source-class.ts,camera-preview.tsx,local-source-gate.ts,capture-selector-panel.tsx,own-core-words.ts}`, `src/features/session-monitor/{audio-source.ts,sim-adapter.ts}`
- mobile `src/features/capture-selector/{selector-in-force.ts,capture-selector-model.ts}`, `src/features/devices/{device-detail.tsx,device-row.tsx,devices-screen.tsx,devices-model.ts,device-status-chip.tsx,registered-device-detail.tsx}`, `src/features/session-finalizing/{seal-attention.tsx,i18n.ts}`

EDITED (tests, by delta, each with its reason in place): core-server
`src/sealing/__tests__/{way-out.test.ts,wave-i-a1-way-out.test.ts}`; core-web
`src/features/evidence/__tests__/export-job.test.tsx` (two cases added, one option);
mobile `src/features/session-finalizing/wave-l-m-blocked-who-where.test.tsx`,
`src/features/session-summary/summary-live-static.test.ts`.

Docs: this note; `delegation_progress/coder_execution_fix_wave_l_z.md`; `file_claims.md` (two
lines); `file_requests.md` (the answer to L-M's line); `contract_wave_l.md` (one L-Z block: the
new names and the changed sentences). Not written (driver rules): plan table, `status_tasks.md`,
`99_implementation_report.md`.

## 7. Decisions for the controller

1. **"Configured profile" on the Monitor keeps the SEALED session's own snapshot.** It is a fact of
   the session the card describes (its id, start and evidence stand beside it). The rule of item 1
   is for readers that name what records NOW / NEXT. One line to change if the card should follow
   the selector instead.
2. **The engine door takes a blocked-seal message of up to 600 characters (was 400).** Without it
   the sentence the brief asks for does not fit. The alternative is a shorter alert ("..., then
   retry the seal on the web console.") with who / where left to the clients.
3. **Two sentences, not one.** "Stopped after 3 automatic retries, the Core waits" is on the failed
   step; "who presses Retry sealing where" is in the alert. A client that draws ONLY the alert
   (the mobile Finalizing notice) prints the first from the same shared function.
4. **Web R-4 closed too** ("USB input" of a generated microphone) though item 3 names the mobile
   app: otherwise the two clients differ on one line.
5. **The mobile device rows and detail keep the engine's status words** ("Online", "READY") - L-W's
   D-2 / L-M's "not changed, as ruled" stands; this pass did not touch them.
6. **`sealClosingNotice` is new behaviour of one sentence:** a Core that closes mid-retry no longer
   writes the "retries used up" sentence on the step.
7. **Lane 2 runs the code it booted with (10:38).** The new sentences, the shared rule in the
   Core's own readers and the door's bound are live only after its next restart; an alert stored
   before keeps its old text.

## 8. Open items

- **Same class, another member - NOT changed:** `session.audioSource` (the active / standby pair)
  of a SEALED session is still read whatever its state by the web
  (`session-monitor/audio-source.ts:137, 145`) and the mobile app
  (`session-live/mic-source-model.ts:147, 155`). After a sealed session and a microphone change the
  Monitor's pair can name the old inputs. Not a selector snapshot, so outside item 1.
- **G94c-02 when the wizard is closed before the job ends:** `ExportJobStatus` lives only in the
  wizard; closing it stops the job polling, so nothing asks operation 40 again and the page's list
  stays as read. Older than the move; not changed.
- The whole mobile suite was run ONCE; after its five reds only the red files and the touched
  folders were run again.
- Nothing of this pass is proven on a device or in a browser (section 9, re-drive).
- L-S's open decision 2 (the device slice still SENDS the dataset's `model` / `firmware` /
  `poePort`) is untouched: the clients no longer draw them.

## 9. Checks for the test runner

| Command (repository root) | Lock | Expected | Why |
|---|---|---|---|
| `npm test -w @dems/core-server` (whole unit) | none; loopback outside the sandbox | green | the shared readers the engine hosts changed (`captureMicLines`, `selectorOf`, `sessionCameras`); the sentences and the door's bound |
| `npm run test:db -w @dems/core-server` | `.locks/db-migrate.lock` | green | the alert of a blocked seal is longer (stored row); `sealing-notice-doors` |
| `npm test -w apps/mobile` (whole, second run) | none; alone on the host | 310 suites green | the first run had 5 reds (section 5); only the files were re-run |
| `npm test -w apps/core-web` (whole) | none | 182 files green | three cases and the R-4 edit came after the whole run |
| transcriber, mock-core, capture-protocol unit suites | none | green | mock-core hosts the shared simulator |
| kill matrix | `.locks/heavy-host.lock` + db lock; lane 2 DOWN | 35 of 35 | `way-out.ts`: the WAIT / closing sentences |
| seal e2e | `.locks/heavy-host.lock` + db lock; lane 2 DOWN | 3 of 3 | the same |
| development e2e | as its note says | green | the shared readers |

Re-drive (lane 2, AFTER a restart of its Core): (1) rig `blocked`: the alert on web and devices
reads "... presses "Retry sealing" on the Session Monitor of the web console, or the Core is
restarted."; the step reads "Sealing stopped after 3 automatic retries: the Core now waits ...";
the device shows no "recovery named above". (2) After a sealed session change `VIDEO-02` and the
first microphone line: Dashboard, Devices (web) and the meters name the new sources. (3) Tablet and
phone, Devices: a generated camera / microphone detail without model values; "Synthetic demo
values" on PoE, indicator, tablet, health; no "USB" on the selector lines; web Devices: no "USB
input". (4) One export under the open wizard: the list without a reload.

---
*Generated: 2026-10-11 12:20 WIB*
