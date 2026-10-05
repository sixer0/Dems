# W0 — one consolidation round over the landed web page folders

**Row**: W0 (controller-added; decisions D153 ruling 5, D154 DN-3 and DN-4, D155 (3), D156 (4), D158 DC-2 and
DC-4). The web twin of M0 (`gateway_check/09a_m0_link_rule.md`). Agent: coder-execution.
**Time**: 2026-10-05 23:42 to 2026-10-06 00:42 WIB.
**Status**: **complete**, with one part of item 7 stopped for a decision (the text burnt into the bundled
video frames, §8.2) and one item (3) that the brief's condition rules out (no code, §4).

Code is cited `path:line` relative to `apps/core-web/src/` unless the path starts otherwise; "pre" is the
pre-image in `.cache/rollback/W0/` (taken before the first edit of each file), "now" is the tree after W0.
Assets: `assets/08a_w0_final_gate.log`, `assets/08a_w0_mutations.log`, `assets/08a_w0_mutation_config.mts.txt`,
`assets/08a_w0_mutation_runner.py.txt`, `assets/08a_w0_changes.diff.txt` (every change against its pre-image,
3,468 lines), `assets/08a_w0_item1_red_before_fix.log`, `assets/08a_w0_item1_green.log`,
`assets/08a_w0_item2_affected_run.log`.

---

## 1. Outcome per item

| # | Item | Outcome | Visible change | Evidence |
|---|---|---|---|---|
| 1 | StrictMode double-send (F69-1) | **Done.** One helper `deferEffectStart` (`lib/effect-start.ts:32`); the three effect-started commands of the landed folders are on it; a static guard with controls fails the workspace for a new one. **One real defect found beyond W69's two**: Session New's B-6 resume effect sent `beginPrecheck` twice under StrictMode in **Simulated** mode (red test: 2 calls) | None in production; in a dev build the Simulated resume no longer shows a spurious "pre-check failed" toast | §2; `live-strict-mode-starts.test.tsx` 11 tests |
| 2 | One pending-control hook (D153 r5) | **Done.** `usePendingControl()` + `usePendingReveal()` in `lib/pending-control.ts`; 10 caller files point at it; 2 files removed (pre-images), 1 kept as a one-line re-export; W64's pending test and every other existing test unchanged and green | None | §3; `live-pending-control.test.tsx` 20 tests |
| 2b | D154 DN-4 (A9 at the press?) | **Decided: keep DV-2** (A9 sends after its 700 ms in both modes) | None | §3.5 |
| 3 | Busy mark through the kit's `Button` (F63-2) | **Not possible as a one-line change**: there is no `Button` in `components/ui/**`; the pages' `Button` is `@heroui/react` over React Aria's `Button`, whose `filterDOMProps` allow-list has no `aria-busy`. Containers left as they are; the shared hook keeps W64's `ref` mark (D153 r1). A probe test pins the kit's behaviour | None | §4 |
| 4 | `dbfs-meter.tsx` clip reset (D154 DN-3) | **Done.** Through `settle`, the presenter first, the meter's own branch for what it leaves; Live test | Live only: a refused reset now shows the presenter's words (before: nothing, and an unhandled rejection) | §5; `live-meter-clip-reset.test.tsx` 5 tests |
| 5 | `network-time/log.ts` (F71-3, D155) | **Done.** The page's own sink, fixed sentence, the error's name only | None (dev-console line now comes from the sink) | §6; `live-w0-page-logs.test.tsx` "item 5" 3 tests |
| 6 | F70-1 Identify label (D156) | **Done.** An Identify row reads "Identify (blink)" in both modes. **The one deliberate change of a Simulated screen in this round** | Simulated and Live: the drawer Log's Identify row | §7; `live-w0-device-log.test.tsx` 2 tests |
| 7 | F70-4 camera overlay "DEMO" in Live (D156) | **Partly done, partly STOPPED.** Done: every word the component itself writes says what is true in Live mode (procedural OSD line, the picture's accessible name, the Devices tile's name). **Stopped**: the "… LIVE \| DEMO" line in the screenshots is burnt into the frames of the bundled MP4 loops (a frozen asset, P13) — a decision for the controller | Live only | §8; `live-w0-camera-words.test.tsx` 6 tests |
| 8 | F70-5 report helper (D156) | **Done.** One helper `createPageReporter(prefix)` (`features/dashboard/report.ts:47`); `features/devices/report.ts` binds its prefix to it; callers unchanged | None | §9; `live-w0-page-logs.test.tsx` "item 8" 4 tests |
| 9 | Two "simulated" labels on Live items without a package (D158) | **Done.** Metadata tab and preview card say "Core record" / "the Core server's record only" in Live mode; Simulated unchanged; destinations and the signature line untouched (DC-4) | Live only | §10; `live-w0-evidence-words.test.tsx` 3 tests |

**Whole web suite: 78 files / 1,012 tests, exit 0** (floor 71 / 958; +7 files, +54 tests, no existing test
file edited). Typecheck and lint of `@dems/core-web` exit 0 (oxlint: no warning, no error). `@dems/shared`
68 / 1,814 exit 0, its typecheck and lint exit 0. The six protected test files byte-equal (sha256 and git
hashes, §12). **Mutation run (M15, in memory): 48 mutations, 48 detected** after one test was added for the
first survivor (§11).

## 2. Item 1 — StrictMode double-send (F69-1)

### 2.1 The helper

`lib/effect-start.ts:32-35` (new):

```ts
export function deferEffectStart(start: () => void): () => void {
  const handle = setTimeout(start, 0)
  return () => clearTimeout(handle)
}
```

Returned by the effect, it moves the start one task later; StrictMode's simulated clean-up runs before
that task and cancels the first start, so only the second set-up's start is sent. A dependency change in
that task cancels and reschedules, so an in-flight marker is checked and set inside `start`. Production
builds (no double run) start one task later than before — invisible. Why not a ref guard: in Simulated mode
the simulator answers inside the first set-up (`settle` runs a plain value's handlers before it returns,
CL-25), so a marker cleared in `done` is already clear when the second set-up runs — exactly the defect of
§2.3, case 1. Why `lib/`: it already holds the console's cross-page helpers (`utils.ts`, `tone-icons.ts`, and a
hook in `core-errors.ts`); it is not `runtime/**` and not one of rule 9's four files.

### 2.2 The three sites, before and after

| Site | Pre | Now |
|---|---|---|
| Session New, B-6 resume effect | `features/session-new/index.tsx:227-242`: marker set and `settle(() => actions.beginPrecheck(), …)` in the set-up | `index.tsx:230-248`: conditions, then `return deferEffectStart(() => { if (precheckInFlight.current === id) return; precheckInFlight.current = id; settle(…) })` (`:234`) |
| Evidence detail, the list's Verify hand-off | `features/evidence/detail-page.tsx:108-112`: hand-rolled `setTimeout(…, 0)` + `clearTimeout` (W69) | `detail-page.tsx:109-112`: `return deferEffectStart(() => void runRef.current())` (`:111`) |
| Evidence wizard, the source check | `features/evidence/export-wizard.tsx:621-624`: the same hand-rolled pair | `export-wizard.tsx:623`: `useEffect(() => deferEffectStart(() => void runRef.current()), [])` |

### 2.3 Every effect of the seven folders (the full audit)

Method: every `useEffect` / `useLayoutEffect` call under `features/{dashboard,session-new,session-monitor,
evidence,devices,storage,network-time}/**` read with its body (54 sites at the start), plus every Core call
site of those folders (`settle(`, `actions.x(`, `client.call(`, query refreshes) traced to its caller (event
handler, timer or effect), plus mount callbacks (`onAnimationComplete`, ref callbacks,
`useSyncExternalStore`, store subscriptions). Line numbers are pre (= now where a file was not edited).

**Effects that start a Core call**

| # | Where | What it starts | Under StrictMode | Result |
|---|---|---|---|---|
| 1 | `session-new/index.tsx:227` (pre) | `settle(() => actions.beginPrecheck())` for a session left in CREATE, page opened at step 2 | **Live: safe** — the FC-7 marker is set in the first set-up and the answer is asynchronous, so the second set-up returns (W64's StrictMode test: 1 request). **Simulated: NOT idempotent** — the simulator answers inside the first set-up, `done` clears the marker, the second set-up (same closure, state still CREATE) calls `beginPrecheck` again; the simulator refuses it (session already PRECHECK) and the page shows `sessionNew.errors.precheck` and writes a record. The simulator persists its state (`dems.sim.v1`), so a reload or Back to `?step=2` reaches it in every dev build | **Fixed** (helper). Red before: `assets/08a_w0_item1_red_before_fix.log` (`expected 1, received 2`); green after: "Session New resume, Simulated" (1 call, no toast, no record) + W64's Live test unchanged |
| 2 | `evidence/detail-page.tsx:108` (pre) | the list's Verify hand-off → `verification.run()` → operation 41 | Safe since W69 (hand-rolled deferral) | **Moved to the helper**; W69's StrictMode test unchanged (1 request) |
| 3 | `evidence/export-wizard.tsx:621` (pre) | the wizard's source check → operation 41 | Safe since W69 | **Moved to the helper**; W69's StrictMode test unchanged (1 request per source) |
| 4 | `devices/device-drawer.tsx:393` | `queryClient.invalidateQueries(pairedDevices)` when `tabletLink.changedAt` changes (CONTRACT-GAP-W70-1) | **Safe**: the ref starts at the mount value, so the mount run and StrictMode's second run send nothing; a change runs once (no remount) | Kept; in the guard's `ALLOWED` list with its reason; proven by "the device drawer: operation 19 … ONCE" |
| 5 | `system/sim-adapter.ts:93` (W76's folder, not landed, outside this audit) | `actions.updateSettings(stored)` from `useSimActions()` — the simulator's local console preferences | Ref-guarded seed, local only | Not edited (outside the write set); in `ALLOWED` with a note for W76 |

**Commands reached from an effect indirectly**

| Where | What | Result |
|---|---|---|
| `session-new/index.tsx:374` (pre; now `:380`) | the 3-2-1 countdown effect calls `startNow()` → `settle(startRecording)` | Safe: never at mount (the countdown starts `null`), and its timer has a clean-up (a set-up/clean-up/set-up leaves one timer). The guard does not see it (a local function call) |

**Reads started on mount (hooks, not effects)**

| Where | What | Result |
|---|---|---|
| `evidence/use-evidence-media.ts:74` | operation 40 in `useQuery` | Safe: TanStack Query shares one fetch between the two mounts. Proven: "Evidence detail: operation 40 … ONCE" |
| `devices/device-drawer.tsx:381` | operation 19 in `useQuery` | Safe, same. Proven: "the device drawer: operation 19 … ONCE" |

**Effects that start no Core call** (safe; listed for completeness; a toast effect keeps its own ref so the
second run says nothing): dashboard `devices-panel.tsx:75` (reveal timer, now removed), `panel-boundary.tsx:82`
(cooldown interval), `hero-panel.tsx:57,69` (animation), `dashboard-motion.ts:87,116,157,167` (timers),
`sealed-today-panel.tsx:54` (toast, ref), `status-bits.tsx:40,74` (animation); session-new `index.tsx:203`
(URL guard: navigation and a toast behind the `leaving`/`resumed` refs), `use-pending-control.ts:47,56,60`
(now in `lib/`); session-monitor `action-bar.tsx:560` (clean-up), `finalization-modal.tsx:289` (dynamic import of
the demo data, `active` flag), `integrity-panel.tsx:63` (clean-up; A9 itself starts from a press),
`index.tsx:206,210` (title shimmer), `scroll-edges.ts:25` (observers), `sim-adapter.ts:50` (store subscription),
`storage-panel.tsx:35` (timer), `timeline-panel.tsx:34` (scroll), `use-pending-press.ts:51` (removed); evidence
`detail-page.tsx:104,118` (ref sync, header flight), `export-wizard.tsx:616,626` (ref sync, `onState` to the
parent's state), `integrity-tab.tsx:68` (interval), `media-tab.tsx:111,118` (local `<audio>`/`<video>` play on
a token, pause on unmount), `use-retry-cooldown.ts:30`, `use-row-motion.ts:31,35`, `use-verification.ts:217,221`
(ref sync, unmount clean-up), `use-pending-action.ts:51,60` (removed); devices `health-chart.tsx:50`,
`index.tsx:92,99` (timers), `live.ts:65` (removed); storage `choreography.ts:92,115`, `manage-drawer.tsx:47`
(removed), `use-storage-alerts.ts:30` (toast, ref); network-time `use-network-time-alerts.ts:37,52` (toasts,
refs). Mount callbacks: `session-monitor/flight-layer.tsx:91` (`onAnimationComplete` → the flight's `onLand`, a
visual), `evidence/media-tab.tsx:235` (ref callback), `devices/context.ts:64` (`useSyncExternalStore` of the mic
sampler) — no Core call.

### 2.4 The static guard (`src/test/live-strict-mode-starts.test.tsx`)

Reads the code (comments and quoted strings blanked, line numbers kept) of every production `.ts`/`.tsx`
under `src/features/**` (all page folders, the future W75–W81 folders included; `__tests__` and `testing`
excluded), finds every `useEffect`, `useLayoutEffect`, `useInsertionEffect` callback (its dependency list
removed) and fails when it names a Core call **outside the argument of `deferEffectStart(...)`**, or names one
only inside it **without returning the helper**. A Core call is: `settle(`, `actions.x(`, `client.call(`,
`invalidateQueries|refetchQueries|resetQueries|fetchQuery|prefetchQuery|ensureQueryData|refetch|mutate|mutateAsync(`,
a bare `fetch(`, a call through a ref (`xRef.current(`), or `actions` handed to a helper (`f(actions, …)`).
Exceptions: the `ALLOWED` list, by file and token, each with a reason (two entries, §2.3 rows 4 and 5).
Noise measured before it was written: 5 hits in all of `features/**`, all real (§2.3 rows 1–5).

Controls in the test: positive — the pre-W0 Session New shape, W69's hand-rolled deferral (safe, but not
the one way), a `useLayoutEffect` with `client.call`, `refetch`, `invalidateQueries`, an `actions.x(` in a
named function, `actions` handed to a helper (first and last argument), `fetch(`, a helper that is not
returned, a command beside a returned helper; negative — the helper returned (both shapes), a timer effect, a
toast effect with an i18n key, a comment and a string that name a call, a dependency list naming `actions`, a
call in an event handler. The allow-list check is tested on two made-up files.

**What it cannot see** (review items for the page rows' checkpoints): a command reached through a local
function (`startNow()`, `exportOne(…)`), a command started from a module function that receives something
other than `actions` (a client, a store), a callback prop called in an effect (`onReady()`), effects written
through a custom wrapper hook, and anything outside `features/`. The runtime proof for those is a StrictMode
test of the page (`mount: { strict: true }`).

## 3. Item 2 — one pending-control hook (D153 ruling 5)

### 3.1 The copies found

| Copy | Pre | Shape |
|---|---|---|
| W64 | `features/session-new/use-pending-control.ts` (97 lines) | `run(start(release))`, `busy`, `pending`, `ref` (writes `aria-busy` on the button) |
| W65 | `features/session-monitor/use-pending-press.ts` (95 lines) | `run(action, handlers)` with `settle` inside, `onWait`, `busy`, `revealed` |
| W69 | `features/evidence/use-pending-action.ts` (96 lines) | `run(start(release), key)`, `busy`, `pending`, `key` |
| W63 inline | `features/dashboard/devices-panel.tsx:68-84` (`usePendingReveal`), `:110-147` (`inFlight` ref + `busy` state) | press guard + effect reveal |
| W71 inline | `features/storage/manage-drawer.tsx:40-56`, `:84-117` | the same |
| W70 | `features/devices/live.ts:55-72` (`usePendingReveal`), `audio-input-card.tsx:55-86` (inline guard), `index.tsx:108-149` (a **keyed** set: one command per device, several devices at once) | effect reveal; keyed guard |

### 3.2 The one hook (`lib/pending-control.ts`, new)

`usePendingControl()` → `{ busy, pending, key, run, settle, ref }` (`:87`) and `usePendingReveal(busy)` (`:72`):
- **Press guard** (`:102`): a press while a command is out returns `false` and starts nothing.
- **Reveal** (`:72-85`): `pending` only after `LIVE_PENDING_REVEAL_MS × timeScale` (`:74`), cleared with the
  command in the same commit; one implementation, also used alone by the Devices page's keyed list.
- **No state for a command settled in the press** (`:120-127`): no phase, no key, no `onWait` — Simulated
  screens are identical.
- **Two ways in, one state**: `run(start, key?)` (`:131`) keeps rule 1's literal `settle(() => actions.x(…),
  { …, done: release })` at the call site — required, because the static rules of W63
  (`live-dashboard-page.test.tsx:216`), W69 (`live-evidence-archive.test.tsx:245-249`) and W71
  (`live-storage-page.test.tsx:252`) look for that text; `settle(action, handlers)` (`:133`) is the same on this
  control plus `onWait` (LB-4), `done` after the release.
- **Busy mark** (`:93-99`): `aria-busy="true"` on the element of `ref` from the press to the answer (§4).

Why `lib/`: the hook is used by six page folders; `lib/` already holds cross-page helpers and one hook
(`useCoreErrorPresenter`); `runtime/**` and `components/shell/**` are excluded by the brief, and a `hooks/`
folder would be a new top-level convention for one file.

### 3.3 The callers now (every one imports `@/lib/pending-control`)

| File | Change |
|---|---|
| `features/session-new/index.tsx:80` | import moved; the five controls' call bodies unchanged (`run`, `pending`, `busy`, `ref` have the same names) |
| `features/session-new/use-pending-control.ts` | one line: `export { usePendingControl, type PendingControl } from '@/lib/pending-control'` — kept because W64's folder test reads the file list (`live-session-new-pending.test.tsx:304`) |
| `features/session-monitor/action-bar.tsx`, `index.tsx`, `live-feed-panel.tsx` | `usePendingPress()` → `usePendingControl()`; `.run(action, handlers)` → `.settle(action, handlers)` (6 sites); `.revealed` → `.pending` (10 reads) |
| `features/evidence/use-archive.ts`, `export-wizard.tsx` | `usePendingAction()` → `usePendingControl()`; type `PendingAction` → `PendingControl`; call bodies unchanged |
| `features/dashboard/devices-panel.tsx:68-84, :110-147` (pre) | local `usePendingReveal` and `inFlight`/`busy` removed; `const { busy, pending: showPending, run } = usePendingControl()`, the command inside `run((release) => settle(…, { …, done: release }))` |
| `features/storage/manage-drawer.tsx:40-56, :84-117` (pre) | the same |
| `features/devices/audio-input-card.tsx:55-86` (pre) | the clip reset on `usePendingControl()` |
| `features/devices/device-menu.tsx:9` | `usePendingReveal` imported from `@/lib/pending-control` |
| `features/devices/live.ts:55-72` (pre) | its `usePendingReveal` removed (the page keeps its keyed in-flight set in `index.tsx`) |

### 3.4 Tests

Existing pending tests unchanged and green: W64's fake-timer test (two presses → one request, no spinner at
300 ms, the in-button spinner at 500 ms, nothing added outside the control; no spinner for a 50 ms answer;
LB-1 on Next, Re-run, Start, Discard), W65's, W69's, W63's, W70's, W71's. All seven folders after item 2: 32
files / 351 tests (`assets/08a_w0_item2_affected_run.log`). New: `live-pending-control.test.tsx`, 20 tests
(settled in the press, the press guard, the reveal at 300/419/420 ms, a 50 ms answer, proof mode ×2 = 840 ms,
the reveal alone, the spinner leaving in the same commit, the busy mark, the settle entry with `onWait` and
`done` order, a Live refusal, `key`, a throwing start, an unmount, the kit probe of item 3, one copy).

### 3.5 D154 DN-4 — can A9 send at the press?

**Decision: no; A9 keeps DV-2 (the request leaves when the Spinner's 700 ms are over), in both modes.**
`session-monitor/integrity-panel.tsx:73-90` shows its own Spinner **from the press** (LB-2: the old duration is
the minimum) — not "busy at once, spinner late", so the shared hook's reveal does not apply; its guard is
`verify.phase === 'running'`. Sending at the press cannot keep Simulated identical: the simulator would check
the chain 700 ms earlier, so a row that lands in that window (an autosave, a marker, an injected tamper)
changes "PASS • n rows", and its synchronous answer would need a separate 700 ms hold. A Live-only branch
(send at the press, show the result after max(700 ms, the answer)) is possible but is a design change of the
panel, not consolidation. No code changed.

## 4. Item 3 — the busy mark (F63-2)

There is no `Button` in `apps/core-web/src/components/ui/**` (15 files, all motion primitives). The pages'
`Button` is `@heroui/react`'s (`node_modules/@heroui/react/dist/components/button/button.js`), which spreads its
props into React Aria's `Button`; that renders `filterDOMProps(props, { global: true })`
(`react-aria-components/dist/private/Button.mjs:82-84`), whose allow-list is `id`, the labelling props, five
global attributes, the event props and `data-*` (`react-aria/dist/private/utils/filterDOMProps.mjs`): no
`aria-busy`. So no one-line change in `components/ui/**` can forward it, and editing `node_modules` is no
change of the tree. **Containers left as they are** (W63, W69, W70, W71 marks unchanged); the shared hook keeps
W64's way — `ref` writes the attribute on the pressed button (D153 ruling 1). The probe test "the kit's `Button`
… drops an `aria-busy` prop; a `data-*` prop and the ref reach the element" fails the day an upgrade forwards
it, which is the signal to switch the hook to a prop.

## 5. Item 4 — the meter's clip reset (D154 DN-3)

| | Pre | Now |
|---|---|---|
| Actions | `components/composed/dbfs-meter.tsx:14, :143` `useSimActions()` | `:186` `useCoreActions()` — the same object at run time (`coreActionsOf(sim)` returns `sim.actions`), the one way of rule 1 |
| Press | `:360` `onPress={() => actions.resetClip(channel)}` — result ignored; a Live refusal showed nothing and left an unhandled rejection | `:404` `onPress={() => resetClip(actions, channel, presentCoreError, t)}`; `resetClip` (`:85-110`): `settle(() => actions.resetClip(channel), { fail })`, the presenter first (`:93`); what it leaves (a 400/422) → one record in `webErrorSink` (source `components/composed.DbfsMeter.resetClip`, fixed message, `errorName`/`code`/`status`) and `toast.danger(t('common.errors.generic'))` (`:107`) |

The simulator never refuses a reset (`packages/shared/src/sim/faults.ts:391-398`), so Simulated mode is
unchanged (the meter's own test, which asserts the latch clears in the press, is unchanged and green).
Words: `common.errors.generic`, an existing key (item 4 has no i18n grant). No press guard was added to the
CLIP chip (not asked). Live test (`live-meter-clip-reset.test.tsx`, Devices page, the Core's `meters` frame
lights the latch): success (one `resetMicClip` with the channel, nothing worded), 403 FORBIDDEN (the denied
toast, no record), `originNotAllowed` (the address to open), outage (the offline sentence), 422 (the generic
sentence and one record, no text).

## 6. Item 5 — `network-time/log.ts` (F71-3, D155)

Pre (`features/network-time/log.ts:6-16`): `console.error('[core-web] network-time', { …, message: error.message,
stack, … })` in dev builds only. Now (`:30-42`): `sink.report({ level: 'error', source: 'NetworkTime.<step>',
message: 'Network & Time: the step "<step>" did not complete.', at, context: { …caller's context, errorName,
correlationId: 'nt-…' } })` into `webErrorSink` (kept in memory in every build, printed in dev) — the discipline
of `storage/log.ts` and `session-monitor/log.ts`. The only caller (`panel.tsx:75`, the panel boundary) is
unchanged. Tests: the record's fields and no text, the default sink, a static check (no console, no
`error.message`, `String(error)`, `error.stack`, `import.meta.env.DEV`).

## 7. Item 6 — the Identify label (F70-1, D156) — the one deliberate Simulated change

Pre (`features/devices/device-drawer.tsx:526`): `row.details.command === 'TEST_SIGNAL' ? t(words.testSignal) :
t(words.restart)` — an Identify row read "Restart (simulated)" / "Restart". Now (`:529-531`): TEST_SIGNAL → the
mode's test-signal word; **IDENTIFY → `common.deviceMenu.identify` ("Identify (blink)", the menu's own word, the
same in both modes)**; anything else → the mode's restart word. No new key. Tests: Simulated (the
simulator's own TEST_SIGNAL, IDENTIFY, RESTART rows of CAM-01 → "Identify (blink)" once, the two others keep
"Test signal (simulated)" / "Restart (simulated)"); Live (the Core's Identify row → "Identify (blink)", no
"Restart", no "simulat").

## 8. Item 7 — the camera overlay in Live mode (F70-4, D156)

### 8.1 What the component itself says — changed in Live mode only

| Word | Pre | Now, Live mode (Simulated unchanged) |
|---|---|---|
| Procedural fallback OSD line | `components/media/camera-feed.math.ts:92-95` `CAM-0n \| VIDEO-0n \| LIVE \| DEMO`; painted at `procedural-feed.ts:191` | `camera-feed.math.ts:97-100` `osdLabel(cameraId, liveData)` → `CAM-0n \| VIDEO-0n \| BUNDLED DEMO` (keeps P13's DEMO marking, drops LIVE: the picture is the bundled still, not the Core's camera); `procedural-feed.ts:143, :193` |
| The picture's default accessible name | `camera-feed.tsx:318` "Camera 1 · LIVE SESSION FEED" | `camera-feed.tsx:332` "Camera 1 · Bundled demo picture" (`session.feed.bundledPicture`, new key) |
| The Devices tile's own name | `features/devices/camera-tile.tsx:94` "Live preview, Camera 1" | `camera-tile.tsx:97` through the page's word table (`devices/live.ts` `feedAria`): "Camera 1, bundled demo picture" (`devices.live.feedAria`, new key) |

The mode comes from the simulator in the context (`camera-feed.tsx:142`: `coreModeOf(sim) === LIVE`; no context →
Simulated words, as the component galleries and isolated tests need). Tests: the line per mode, the painter
writing the line of its mode on a recording 2D context, the accessible name per mode (a simulator, no
provider, the Live source), the Devices tile per mode, a caller's own name kept.

### 8.2 STOPPED: the line burnt into the bundled video frames

The text in `implementation/assets/70_devices_live_supervisor.png` ("CAM-01 | VIDEO-01 | LIVE | DEMO" on Camera 1)
is **pixels of the bundled MP4 live loops**, not a component overlay: the predecessor's media row records "Live
loops: 'CAM-0n | VIDEO-0n | LIVE | DEMO', bottom centre" (`docs/2026-09-30_dems_demo_stack_setup/implementation/
64_demo_media.md:165`); the packages and loops are frozen (P13) and `packages/shared/assets/**` is outside this
round's write set. Three ways, each a decision:

| Option | What | Cost |
|---|---|---|
| A (recommended) | Accept: "DEMO" on the picture is true (MS-1: the picture is the bundled loop) and P13 wants it visible; the component's own words now say "bundled demo picture"; the burnt-in "LIVE" names the loop type | none |
| B | A Live-only band over the burnt-in OSD with truthful words | a visible design change of every Live camera picture; conflicts with D152 ruling (2) ("no caption"); hides P13's DEMO marking; alignment depends on each tile's crop |
| C | Regenerate the live loops with "DEMO" only | an asset change against P13, outside this task |

## 9. Item 8 — one page-report helper (F70-5, D156)

Pre: `features/devices/report.ts` (59 lines) was `features/dashboard/report.ts` (58 lines) with `dash` → `dev` and
a `level` parameter. Now: `features/dashboard/report.ts:47-68` `createPageReporter(prefix)` → `{ newCorrelationId,
report(source, error, message, context?, level = 'error', sink?) }`; the Dashboard binds `'dash'` (`:70`) and
keeps `reportDashboardError` / `newDashboardCorrelationId` with their signatures; `features/devices/report.ts:10`
binds `'dev'` and exports `reportDevicesError = devices.report`, `newDevicesCorrelationId` — the same signatures as
before, so no caller changed. Record shape unchanged (level, source, fixed message, `at`, context with
`errorName`, `code`, `status`, `correlationId`). Why in the Dashboard's file: the brief granted two new shared
files (items 1 and 2); W63's file is the original. A neutral `lib/page-report.ts` would be the better home
(decision §13 DC-7). Tests: both record shapes, `warn`, the default sink, independent counters, one copy.

## 10. Item 9 — the two "simulated" labels (D158)

| Place | Pre | Now, Live mode (Simulated unchanged) |
|---|---|---|
| Metadata tab, the record's label | `features/evidence/metadata-tab.tsx:110` `evidence.metadata.simulatedRecord` ("Simulated evidence record"); container `data-package="simulated"` (`:105`) | `:115` `evidence.live.coreRecord` ("Core record", W69's key); `data-package="core"` (`:110`) |
| Metadata tab, the record's first members | `:82-86` `simulated: true`, "SIMULATED record from the in-browser simulator; no DEMO package joins this item." | `:87-90` `record: 'CORE'`, "The Core server's record of this item; no DEMO package joins it." (the Simulated members and their order unchanged) |
| Preview card, the package line | `features/evidence/preview-card.tsx:109-112` `evidence.preview.noPackage` ("… simulated data only."), `data-package="simulated"` | `:112-115` `evidence.live.noPackage` ("No DEMO package for this item: the Core server's record only.", new key), `data-package="core"` |

The record's `signature` member stays the Core's own value (`algorithm: 'SIMULATED-SHA256'`, `simulated: true`,
`packages/shared/src/sim/types.ts:670-675`) — truthful by D158 DC-4, like the destinations and the signature
line, which were not touched. Tests: Simulated (label, members, line), Live Metadata tab on the detail page
(operation 40 answers NONE: "Core record", `record: CORE`, no `simulated` member, no "simulat" outside the
signature member and outside the record), Live preview line.

## 11. Mutation run (rule M15: no file of the tree is modified)

W64's method: one text replacement in one module, applied in memory by a Vite transform plugin
(`assets/08a_w0_mutation_config.mts.txt`); a marker under `$TMPDIR` proves it ran; detected = Vitest exit ≠ 0;
the SHA-256 of every mutated file is taken before and after each batch (all "identical"). Runner
`assets/08a_w0_mutation_runner.py.txt`; log `assets/08a_w0_mutations.log`. Baselines green before each batch.

| Class (the brief's words) | Mutants | Detected |
|---|---|--:|
| **Item 1 helper** | E01 starts at once; E02 the clean-up does not cancel | 2 / 2 |
| Item 1 sites | E03 Session New starts in the set-up (pre-W0); E04 hand-off in the set-up; E05 source check in the set-up | 3 / 3 |
| **Item 1 guard** (the test file mutated in memory) | G01 `useLayoutEffect` not scanned; G02 an unreturned helper passes; G03 the helper's argument not set apart; G04 comments kept; G05 the dependency list scanned; G06 the allow-list allows any file; G07 ref calls not Core calls; G08 query refreshes not Core calls | 8 / 8 |
| **Item 2 press guard** | H01 guard removed; H06 a settled command still marks busy; H07 release does not clear busy; H11 a throwing start leaves it busy | 4 / 4 |
| **Item 2 reveal delay** | H02 delay 0; H03 time scale ignored; H12 the reveal outlives busy by one commit; H13 the timer not cleared early | 4 / 4 |
| **Item 2 busy mark** | H04 never written; H05 never removed | 2 / 2 |
| Item 2 settle entry and key | H08 `onWait` for a settled command; H09 `done` before the release; H10 key not kept | 3 / 3 |
| Item 2 call sites | S01 Dashboard, S02 Storage, S03 Devices clip: `done` no longer releases; S04 Session Monitor marker loses `onWait` | 4 / 4 |
| Items 4–9 | M01 presenter skipped; M02 result ignored (pre-W0); M03 no record; N01 the error's text as message; N02 no record; L01 Identify → Restart; C01 Live OSD keeps LIVE; C02 Live name "live feed"; C03 mode never Live; C04 painter ignores the mode; C05 tile "Live preview"; R01 one prefix for all; R02 level always error; R03 code/status dropped; V01 Live label simulated; V02 Live body simulated; V03 Live preview simulated; V04 Simulated body takes Live words | 18 / 18 |
| **Total** | | **48 / 48** |

H12 first **survived** (`return busy && revealed` → `return revealed`: the spinner stays one extra commit after
the answer). A test was added ("the spinner leaves in the same commit as the command: no committed state is
pending without being busy"); H12 re-run: detected. The guard's whole-tree check reads the files on disk, so an
in-memory mutation of a production file cannot exercise it; its strength is the controls of §2.4 and the
mutations of the guard itself (G01–G08).

## 12. Verification (commands from the repository root; `assets/08a_w0_final_gate.log`)

```
## 2026-10-06 00:38:07 WIB  0:38  2 users, load averages: 1.91 2.30 2.91
## $ npm run test -w @dems/core-web -- --maxWorkers=2
 Test Files  78 passed (78)
      Tests  1012 passed (1012)
exit=0
## 00:39:50 $ npm run typecheck -w @dems/core-web
exit=0
## 00:40:00 $ npm run lint -w @dems/core-web
exit=0
## 00:40:00 $ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  68 passed (68)
      Tests  1814 passed (1814)
exit=0
## 00:40:08 $ npm run typecheck -w @dems/shared && npm run lint -w @dems/shared
typecheck exit=0
lint exit=0
## protected test files (sha256 recorded at 23:43 before any edit)
apps/core-web/src/test/routes.test.tsx: OK
apps/core-web/src/test/sim-fetch.test.ts: OK
apps/core-web/src/features/storage/__tests__/storage-page.test.tsx: OK
apps/core-web/src/lib/__tests__/core-endpoint.test.tsx: OK
apps/core-web/src/lib/__tests__/packaged-csp.test.ts: OK
apps/core-web/src/features/dashboard/__tests__/dashboard.test.tsx: OK
71f6f0337f2339d8e8d66ef232d7334dc0b67d1d features/storage/__tests__/storage-page.test.tsx
1ab07579e928b9b545003899ec3265d4b8b6c762 features/dashboard/__tests__/dashboard.test.tsx
```

`uptime` before each whole suite: 1-minute load 1.9–2.9 (below 10). `git status --porcelain` over `runtime/**`,
`components/shell/**`, `routes/**`, `routeTree.gen.ts`, `vite.config.ts`, `main.tsx`, rule 9's four `lib/` files and
`packages/shared/src/{api,live,client,realtime,sim}/**`: empty. It lists `apps/core-server/test/static/scan.ts` (M)
and `scan-skips.test.ts` (??): written by the parallel row of `gateway_check/04d_static_scan_cache.md`, not by W0.
Every file W0 wrote is in §14; no existing test file was edited (a `find -newer` over `apps/core-web/src` and
`packages/shared/src` lists only W0's files). No lane check was run (none required); no Docker, no git write.

## 13. Decisions for the controller

| # | Decision | Recommendation |
|---|---|---|
| DC-1 | Item 1: `lib/effect-start.ts` and the guard's `ALLOWED` list (2 entries: the device drawer's ref-guarded refresh; W76's `system/sim-adapter.ts:93`, with a note for W76) | Ratify; put §15 into W75–W81's briefs and W76's in particular |
| DC-2 | F69-1 also existed in Session New in **Simulated** mode (a second, refused `beginPrecheck` and a "pre-check failed" toast in dev builds); fixed with the helper | Note for the ledger and for W83's list of F69-1 cases |
| DC-3 | Item 2: `lib/pending-control.ts`; two entry points (`run` keeps rule 1's literal at the call site, which the static rules of W63, W69, W71 read; `settle` for `onWait`); the Devices page keeps its keyed set with the shared reveal; two files removed, one kept as a re-export | Ratify |
| DC-4 | D154 DN-4: A9 keeps DV-2 (§3.5) | Ratify |
| DC-5 | Item 3: no code; containers kept; the probe test pins the kit (§4) | Ratify |
| DC-6 | Item 4: the meter's own branch says `common.errors.generic` and writes one record; `useSimActions` → `useCoreActions`; no press guard on the CLIP chip | Ratify; a press guard on the chip, if wanted, to W83/W88 |
| DC-7 | Item 8: the one helper lives in `features/dashboard/report.ts` (only two new shared files were granted) | Grant a one-file move to `lib/page-report.ts` (two import lines) before W75–W81 log through it — **granted and done (D165, §17)** |
| DC-8 | Item 7 §8.2: the burnt-in "LIVE \| DEMO" of the bundled loops | Option A |
| DC-9 | Item 9: the record's own members also say "CORE" in Live mode (otherwise the Live screen kept "SIMULATED record from the in-browser simulator"); the signature member stays (DC-4) | Ratify |
| DC-10 | Ledger: `@dems/core-web` 71 / 958 → **78 / 1,012** (+7 files, +54 tests); the new files are `test/live-{strict-mode-starts,pending-control,meter-clip-reset,w0-page-logs,w0-device-log,w0-camera-words,w0-evidence-words}.test.tsx` | Move the floor |

Observations, not this round's to fix:
- Live, operation 40 unanswered: the Metadata tab's empty state still says "No DEMO package for this item"
  although whether one belongs is unknown (the header chip says "Media reference unavailable",
  `detail-page.tsx:188-189`). The tab receives only the row. For W83/W88.
- `session-monitor/integrity-panel.tsx` (A9) keeps its own press guard (`verify.phase === 'running'`) by §3.5.
- The two placeholder lines my own scripted edits wrote for a moment (`@@IMPORT@@` in
  `dashboard/devices-panel.tsx:1`, `@@CHECK@@` in `devices/audio-input-card.tsx:1`) were replaced within the
  same minute, before any test or typecheck ran; both files' final diffs are in `08a_w0_changes.diff.txt`.
- Deviation (the brief's "never `cd`"): two read-only commands contained a `cd` — the first command of the session (`cd` into the repository before an `ls`) and one line-number lookup (`cd /dev/null`, which failed). Neither wrote anything; the shell's directory is reset between commands.

## 14. Files

**Created (9)**: `apps/core-web/src/lib/effect-start.ts`, `apps/core-web/src/lib/pending-control.ts`,
`apps/core-web/src/test/live-strict-mode-starts.test.tsx`, `apps/core-web/src/test/live-pending-control.test.tsx`,
`apps/core-web/src/test/live-meter-clip-reset.test.tsx`, `apps/core-web/src/test/live-w0-page-logs.test.tsx`,
`apps/core-web/src/test/live-w0-device-log.test.tsx`, `apps/core-web/src/test/live-w0-camera-words.test.tsx`,
`apps/core-web/src/test/live-w0-evidence-words.test.tsx`.

**Updated (27)**: `apps/core-web/src/components/composed/dbfs-meter.tsx`;
`apps/core-web/src/components/media/{camera-feed.tsx,camera-feed.math.ts,procedural-feed.ts}`;
`apps/core-web/src/features/dashboard/{devices-panel.tsx,report.ts}`;
`apps/core-web/src/features/devices/{audio-input-card.tsx,camera-tile.tsx,device-drawer.tsx,device-menu.tsx,live.ts,report.ts}`;
`apps/core-web/src/features/evidence/{detail-page.tsx,export-wizard.tsx,metadata-tab.tsx,preview-card.tsx,use-archive.ts}`;
`apps/core-web/src/features/network-time/log.ts`;
`apps/core-web/src/features/session-monitor/{action-bar.tsx,index.tsx,live-feed-panel.tsx}`;
`apps/core-web/src/features/session-new/{index.tsx,use-pending-control.ts}`;
`apps/core-web/src/features/storage/manage-drawer.tsx`;
`packages/shared/src/i18n/en/{session.ts,devices.ts,evidence.ts}` (additive: `session.feed.bundledPicture`,
`devices.live.feedAria`, `evidence.live.noPackage`).

**Files removed (2)** — no importer left after item 2; pre-image first:

| File | Pre-image | SHA-256 (first 16) |
|---|---|---|
| `apps/core-web/src/features/session-monitor/use-pending-press.ts` | `.cache/rollback/W0/apps/core-web/src/features/session-monitor/use-pending-press.ts` | `8dc510b522038433` |
| `apps/core-web/src/features/evidence/use-pending-action.ts` | `.cache/rollback/W0/apps/core-web/src/features/evidence/use-pending-action.ts` | `6f9588ab7496e825` |

Documents: this file, `assets/08a_w0_*` (8 files), `delegation_progress/coder_execution_w0.md`.

## 15. What the web page rows W75–W81 must call (paste into their briefs; amended by the follow-up, decision D165)

> **Pending controls, effect-started commands, the busy mark (row W0).** A control that sends a command uses
> the one hook `usePendingControl()` from `@/lib/pending-control` — never a press guard, a reveal timer or
> `LIVE_PENDING_REVEAL_MS` of your own (`live-pending-control.test.tsx` fails if a landed folder reads the
> constant). Keep rule 1's shape at the call site: `const control = usePendingControl();
> control.run((release) => settle(() => actions.x(…), { ok, fail: (error) => { if (presentCoreError(error) !== null) return; … }, done: release }), key?)`
> — or `control.settle(() => actions.x(…), { ok, fail, done?, onWait? })` when an optimistic visual that changes
> no record must start while a Live answer is out (LB-4). A press while a command is out returns `false` and
> sends nothing; a command that settles in the press (every Simulated command) changes no state, so Simulated
> screens stay identical. Show `control.pending` as the kit's own pending state (`isPending`, the `Spinner` in
> place of the icon; nothing moves), disable with `control.busy`, mark a row with `control.key`. **The busy
> mark**: attach `ref={control.ref}` to the pressed kit `Button` — the hook writes `aria-busy="true"` on it from
> the press to the answer (the kit's `Button` drops an `aria-busy` prop; a probe test pins this); a control
> that is no button marks its nearest plain container with `aria-busy={control.busy || undefined}`. A list
> whose controls may each have one command out at once keeps a keyed in-flight set and takes the late reveal
> from `usePendingReveal(busy)` of the same module. **A command or a query refresh started from an effect**
> (a mount, a hand-off, a state change) is RETURNED through `deferEffectStart` from `@/lib/effect-start`:
> `useEffect(() => { if (!wanted) return undefined; return deferEffectStart(() => { /* check and set an in-flight marker here */ settle(() => actions.x(…), { … }) }) }, [wanted])`.
> The console renders under StrictMode and Live mode exists only in dev builds, so a direct call in the
> set-up is sent twice in every Live session (F69-1), and a ref marker does not help in Simulated mode, where
> the simulator answers inside the first set-up. `src/test/live-strict-mode-starts.test.tsx` fails the
> workspace when an effect under `features/` names `settle(`, `actions.x(`, `client.call(`, a query refresh,
> `fetch(`, a call through a ref or hands `actions` to a helper outside the helper's argument, or calls the
> helper without returning it; a real exception goes into its `ALLOWED` list with a reason the reviewer
> reads. Reads belong in `useQuery` under `CORE_QUERY_KEYS` (one fetch under StrictMode). Prove each
> effect-started command with a StrictMode test (W50's harness, `mount: { strict: true }`): one request, not two.
> **A page's own log reporter** is `createPageReporter('<prefix>')` from `@/lib/page-report`, bound once in the
> page's own module (`const page = createPageReporter('usr'); export const reportUsersError = page.report`) and
> called only for the branch the presenter left to the page: `report(source, error, fixedSentence, context?,
> level?)` writes one record to `webErrorSink` with the caller's fixed sentence as the message, the cause by
> its class, code and status (never its text, never a stack), non-secret facts in `context` and a
> `<prefix>-…` correlation ID — never `console.*`, never a copy of the helper.

## 16. Rollback (not executed)

1. Copy each pre-image back: for every file under `.cache/rollback/W0/` (29: the 27 updated and the 2 removed),
   `cp -p .cache/rollback/W0/<path> <path>` from the repository root.
2. Delete the 9 created files of §14.
3. Re-run `npm run test -w @dems/core-web -- --maxWorkers=2` (expected 71 / 958 on this tree), typecheck and
   lint. The diff to undo is `assets/08a_w0_changes.diff.txt`.

## 17. Follow-up: the reporter in `lib/` (decision D165)

Granted by the controller at the W0 gate (D165), done 00:49 to 00:53 WIB before the web page rows start.
Assets: `assets/08a_w0b_gate.log`, `assets/08a_w0b_changes.diff.txt` (226 lines); the three reporter mutants
are in `assets/08a_w0_mutations.log` (batch of 00:51). Pre-images: `.cache/rollback/W0b/` (the two report
files, the test file, this document and the progress file, before their first W0b edit).

| File | Before (W0) | Now |
|---|---|---|
| `apps/core-web/src/lib/page-report.ts` (new) | — | `createPageReporter(prefix)` (`:53`), `PageReporter`, the private `causeFacts` — moved verbatim from the Dashboard's file, with a header saying how a page binds its prefix |
| `features/dashboard/report.ts` | held `createPageReporter` (`:47-68`) and bound `'dash'` | imports it from `@/lib/page-report` (`:8`), binds `'dash'` (`:11`); `reportDashboardError` and `newDashboardCorrelationId` keep their signatures. It keeps `webErrorSink` as the default sink of `reportDashboardError`, which W63's static rule reads in this file (`live-dashboard-page.test.tsx:231-234`) |
| `features/devices/report.ts` | `import { createPageReporter } from '@/features/dashboard/report'` | `import { createPageReporter } from '@/lib/page-report'` (`:9`); binds `'dev'` (`:11`); `reportDevicesError` and `newDevicesCorrelationId` unchanged |
| `src/test/live-w0-page-logs.test.tsx` (W0's own test) | "one copy" read `dashboard/report.ts` as the helper | imports `createPageReporter` from `@/lib/page-report`; "one copy" now requires `lib/page-report.ts` to hold the helper and both page files to import it and bind their prefix without a copy |

No caller of `reportDashboardError` / `reportDevicesError` changed; nothing was deleted or renamed;
`createPageReporter` is not re-exported from the Dashboard's file, so a page row finds one import path.

```
## 2026-10-06 00:50:28 WIB $ npm run typecheck -w @dems/core-web
exit=0
## 00:50:46 $ npm run lint -w @dems/core-web
exit=0
## $ npm run test -w @dems/core-web -- --maxWorkers=2 src/features/dashboard src/features/devices src/test/live-dashboard src/test/live-devices src/test/live-w0-page-logs.test.tsx src/test/live-w0-device-log.test.tsx src/test/live-meter-clip-reset.test.tsx
 Test Files  11 passed (11)
      Tests  126 passed (126)
exit=0
## 2026-10-06 00:52:01 WIB  0:52  2 users, load averages: 9.11 6.22 4.41
## $ npm run test -w @dems/core-web -- --maxWorkers=2
 Test Files  78 passed (78)
      Tests  1012 passed (1012)
exit=0
## protected test files: sha256 OK (all six; dashboard 1ab07579, storage 71f6f033)
## files of apps/core-web/src and packages/shared/src modified since 00:49:
apps/core-web/src/features/dashboard/report.ts
apps/core-web/src/features/devices/report.ts
apps/core-web/src/lib/page-report.ts
apps/core-web/src/test/live-w0-page-logs.test.tsx
```

Mutation (M15, in memory): R01b one prefix for every page, R02b the level always `error`, R03b the cause's code
and status dropped — **3 of 3 detected** against `lib/page-report.ts`; the file identical before and after. The
1-minute load at the start of the whole suite was 9.11 (below 10; the parallel mobile rows were running).
Ledger unchanged: **78 / 1,012**. Rollback of the follow-up: copy the three code files back from
`.cache/rollback/W0b/` and delete `apps/core-web/src/lib/page-report.ts`. The paragraph of §15 now names
`@/lib/page-report`.

## 18. Follow-up 2: shared test fixes (decision D172)

Granted by the controller (D172) for W0's owner, done 01:52 to 02:00 WIB. Assets: `assets/08a_w0c_gate.log`,
`assets/08a_w0c_changes.diff.txt`. Pre-images: `.cache/rollback/W0c/` (the harness, the hook test, this
document and the progress file, before their first W0c edit). Not touched, as ruled:
`test/live-devices-drawer.test.tsx` and `features/{security-audit,system,users-roles,paired-devices}/**`.

| # | File | Before | After |
|---|---|---|---|
| 1 | `apps/core-web/src/runtime/testing/live-harness.ts` (W50's harness, granted for this item) | `:368` the only administration read with a default answer: `answered('listUsers', () => (core.alive() ? fake.example('listUsers', 200, 'seeded') : fake.example('listUsers', 401, 'notSignedIn')))` | `:369-374` added beside it, in the same form: `answered('getRoleMatrix', … 200, 'seeded' … 401, 'notSignedIn')`, `answered('listPairedDevices', … 200, 'registry' … 401, 'notSignedIn')`, `answered('getPairingCodeStatus', … 200, 'none' … 401, 'notSignedIn')`, with a three-line comment (F77-1) |
| 2 | `apps/core-web/src/test/live-pending-control.test.tsx` (W0's own test) | `:421` `expect(callers).toEqual([ … 10 files … ])` — an exact list | `:421-433` `expect(callers).toEqual(expect.arrayContaining([ … the same 10 files … ]))` — a minimum (F77-2); the import check (`:434`, every caller imports `@/lib/pending-control`) unchanged |

**The example names** (from `packages/shared/src/api/`): `getRoleMatrix` 200 has one example, `seeded` ("3 roles,
12 permissions, 18 grants", `administration.ts:347`); `listPairedDevices` 200 has one, `registry` ("One paired
tablet, online", `pairing.ts:611`) — the only success example, so an idle Core's registry is this one tablet;
`getPairingCodeStatus` 200 has two, `active` and `none` (`pairing.ts:546-559`) — **`none`** ("No code is active") is
the one that fits an idle seeded Core. All three have 401 `notSignedIn`. Nothing missing to report. A test's own
`fake.answer(…)` replaces the harness's repeating answer and one-shot answers go first (the fake transport's
contract, `packages/shared/src/live/testing/fake-transport.ts:130-134`), so every test that scripts these
operations itself is unaffected.

```
## 2026-10-06 01:53:31 WIB $ npm run test -w @dems/core-web -- --maxWorkers=2 src/test/live-shell-admin.test.tsx
 Test Files  1 passed (1)
      Tests  40 passed (40)
exit=0
## 01:53:43 $ npm run test -w @dems/core-web -- --maxWorkers=2 src/test/live-pending-control.test.tsx
 Test Files  1 passed (1)
      Tests  20 passed (20)
exit=0
## 01:53:46 $ npm run test -w @dems/core-web -- --maxWorkers=2 src/test/live-runtime-   (the harness's own tests, W50)
 Test Files  7 passed (7)
      Tests  121 passed (121)
exit=0
## 01:55 (load 9.25 7.57 6.60) $ npm run test -w @dems/core-web -- --maxWorkers=2
 Test Files  93 passed (93)
      Tests  1238 passed (1238)
exit=0
## 01:59:02 $ npm run test -w @dems/core-web -- --maxWorkers=2 src/test/live-devices-drawer.test.tsx   (not edited; W70's file, last written 22:59:59)
 Test Files  1 passed (1)
      Tests  13 passed (13)
exit=0
## $ npm run typecheck -w @dems/core-web   → exit=2, ONE error:
src/test/live-system-demo.test.tsx(408,11): error TS6133: 'bed' is declared but its value is never read.
## $ npm run lint -w @dems/core-web   → exit=0, ONE warning (the same line):
src/test/live-system-demo.test.tsx:408:13: warning eslint(no-unused-vars): Variable 'bed' is declared but never used.
```

**The whole web suite has no red file** (93 / 1,238 at 01:55, including the in-flight rows' new test files);
`live-devices-drawer.test.tsx`, expected red from W81, is green at 01:59 (13 / 13) with the harness's new default
answer for `listPairedDevices`. **Typecheck exits 2** on one line of `src/test/live-system-demo.test.tsx` — an
untracked file of **W76** (System and the Demo Control Panel, in flight; `test/live-system-*.test.tsx` is in its
write set), last written 01:46:04, before this round's first edit (01:52). Neither W0c file appears in the
typecheck output; the error is W76's to fix (remove or use `bed` at `:408`). Lint exits 0 with that one warning.
Files of `apps/core-web/src` and `packages/shared/src` changed since the round began: the two W0c files, and
`test/live-paired-devices-list.test.tsx` (W81) and `test/live-system-export.test.tsx` (W76), written by those rows
while this round ran. Ledger after the round: the suite counts the in-flight rows' files (93 / 1,238); W0's own
share is unchanged (78 / 1,012 at the W0 gate). Rollback: copy the two files back from `.cache/rollback/W0c/`.
