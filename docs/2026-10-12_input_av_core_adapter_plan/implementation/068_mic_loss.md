---
task_slug: input_av_core_adapter_plan
row: 68
milestone: M4 / WP-07a
date: 2026-10-13
agent: coder-execution (batch 8, agent K/P/N)
status: complete (on doubles; nothing is proven on a sound card)
tier: T3
---

# Row 68 - microphone loss: hot-plug detection, the loss callback, the audit entry

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `AUD` = `apps/core-server/src/capture/adapters/audio`.

## 1. What was built

| File | State | What it is |
|---|---|---|
| `AUD/mic-loss.ts` | NEW | `createMicLossWatch(options)`: the loss watch of the production microphone adapter. Registered nowhere (row 85 composes it) |
| `AUD/__tests__/mic-loss.test.ts` | NEW | 23 cases in 5 blocks |

`AUD/usb-audio-production.ts` is NOT edited: its hook `onSourceLost` (record 067, section 2) is the loss callback of a helper that ended, and the watch's member `sourceLost` has its shape. No other file is touched.

## 2. Behaviour

| Subject | Rule |
|---|---|
| Hot-plug detection | One FRESH card listing per pass serves every watched microphone. The registered card is looked for by the adapter's match (`identifyRegisteredCard`: stored USB id, then kernel name, never a card index). `AUDIO_CARD_ABSENT` and `AUDIO_CARD_CHANGED` are a loss; a found card is "present". A pass runs at `start()` and then every 5,000 ms (`MIC_LOSS_INTERVAL_MS`; never below 1,000 ms), or on `check()` |
| Helper ended | `sourceLost(deviceId, error)` is handed to the adapter as `onSourceLost` (helper exited in a session, or no sample in time) |
| The fault | `CAPTURE_FAULT` with the reason `MIC_DISCONNECTED` about the registry id `MIC-NN` - the EXISTING key of a microphone that stopped delivering. No new vocabulary. One raise per episode, one clear at its end |
| The audit entry | Written by the engine action behind the sink the composition hands in (`raiseCaptureWarning` -> one alert and one `FAULT_RAISED` row; `clearCaptureWarning` -> one `FAULT_CLEARED` row). The watch writes no row and imports no engine. Because the fault key is (kind, reason, device), the capture worker's `MIC_DISCONNECTED` and the watch's word about one microphone are ONE fault and ONE audit entry |
| The loss callback | `onChange({ deviceId, state: LOST or RETURNED, cause })`, once per change; cause `CARD_ABSENT`, `CARD_CHANGED` or `HELPER_ENDED` |
| End of a fault | Card absent: when a later listing shows the registered card (also at another index). Helper ended: when the microphone is no longer held open AND the card is not absent |
| Not a loss | A listing that could not be made, a stored row that cannot be read, two cards with the stored identity, an identity that is the fixed word: nothing raised, nothing cleared, each reported by a code (`MIC_LOSS_LISTING_FAILED`, `_ROW_UNREADABLE`, `_CARD_UNDECIDED`) |
| A sink that throws | Reported (`MIC_LOSS_SINK_FAILED`), asked again at the next pass; the loss is told only once the fault was written |
| Never | It switches no audio source, closes no handle, restarts no helper, opens no card: it holds no reference to anything that could (README "Recording": a warning only) |
| Text | No card name, USB id, port or path is in a fault, a report or a change |

## 3. Driver decisions (for the controller to confirm)

| # | Decision | Reason |
|---|---|---|
| DD-1 | A card that returns WHILE the microphone's handle is still held does not clear a fault that a helper's end opened; it clears when the handle is closed | The adapter starts a handle once and restarts no helper (record 067, section 7): the microphone still delivers nothing. The row's cell ("its return clears it") is met for a card that was absent with no dead helper held. Whether a session re-opens its microphones is rows 184 / 191 |
| DD-2 | The fault is the existing `CAPTURE_FAULT` / `MIC_DISCONNECTED`, not a new reason | "1 fault with 1 audit entry": a second reason would be a second fault beside the worker's own for the same event (key D146). A new reason would also need a member of `packages/shared` (another agent's) |
| DD-3 | The match is HANDED IN (`identify`, `isRow`); the watch does not import the adapter | Static rule A-9 (`adapters/__tests__/static.test.ts`, agent SC's list) and row 67's own case refuse any production importer of the built adapter. The two refusal words are literals held equal to `UsbAudioRefusal` by the test |
| DD-4 | Detection is by polling the listing (5 s), not by a kernel event | The area has no event source; each listing is one start of the listing program on Linux, so the interval is bounded below. The latency of a real unplug is unproven (section 6) |
| DD-5 | Two cards with the stored identity are "undecided", not a loss | The microphone may still deliver; the open of the adapter refuses it by name (`AUDIO_CARD_AMBIGUOUS`) |
| DD-6 | `stop()` raises and clears nothing | A fault that is active stays what it is; the session and the boot clear capture faults in their own places |

## 4. For row 85 (the composition)

```
const watch = createMicLossWatch({
  devices: () => <registered MIC ids>, registered: <the adapter's stored-row reader>,
  identify: identifyRegisteredCard, isRow: isRegisteredAudioInput,
  cards: <the adapter's enumerator>, held: () => adapter.openSources(),
  faults: { raise: (fault) => engine.raiseCaptureWarning(fault), clear: (fault) => engine.clearCaptureWarning(fault) },
  timers, onChange, report: <the capture folder's log> });
adapter option: onSourceLost: watch.sourceLost
```

The sink may add the open session's id to a raise as the session's own notices do; the watch does not know a session. `stop()` belongs to the shutdown.

## 5. Evidence

| Check | Command (from `apps/core-server`) | Result |
|---|---|---|
| The row's test file, first run | `npx vitest run --project unit --maxWorkers=2 src/capture/adapters/audio/__tests__/mic-loss.test.ts` | `Test Files 1 passed (1)`, `Tests 22 passed (22)` |
| The four static files and the audio folder | the same command on `src/capture/__tests__/static.test.ts`, `src/capture/adapters/__tests__/static.test.ts`, `test/static/credentials.test.ts`, `src/capture/adapters/local/__tests__/mic-static.test.ts`, `src/capture/adapters/audio` | first: `2 failed, 266 passed (268)` - rule A-9 and row 67's "registered nowhere", both for the watch's import of the adapter (DD-3) |
| The same, second run after DD-3 | the same | `Test Files 10 passed (10)`, `Tests 269 passed (269)` |
| Typecheck | `npx tsc --noEmit` | 0 errors in the row's files; 2 errors in `src/engine/host.ts:775,802` (`registerCaptureMicrophone` / `nextCaptureMicrophoneId`: agent G's rows 185 / 190, in flight) |
| Lint | `npx oxlint` on the two files | no output |

Verification cell "a card removed from the fixture listing raises 1 fault with 1 audit entry; its return clears it": block 1, first case, on the REAL shared simulator behind the sink - after removal 1 active fault, 1 active alert, audit rows `['FAULT_RAISED MIC_DISCONNECTED']`, unchanged over three more listings; after the return (at card index 5) 0 faults, 0 active alerts, rows `[FAULT_RAISED, FAULT_CLEARED]`; a second removal is a new `FAULT_RAISED`. Same block: the active input is unchanged and no `AUDIO_SOURCE_SWITCHED` row exists; the worker's word plus the watch's word is one row.

## 6. The doubles, and what stays unproven

| Double | What it proves | Not |
|---|---|---|
| The host: the REAL listing parser over fixed texts, changed between passes | the match and every "not a loss" case | what a real interface prints while it is being unplugged |
| The sink in blocks 1 and 4: the REAL shared simulator (`createSim`, capture external), its two internal actions | one fault, one alert, one audit row per episode | the database engine's write of the same action (covered by its own tests, `engine/__tests__/capture-actions.db.test.ts`); the live wiring is row 85 |
| Manual timers, a set of held microphones | the schedule and DD-1 | - |

| Unproven | Proven by |
|---|---|
| How long the kernel takes to drop an unplugged card from the listing, and whether the listing can be read during the removal | `9A/H-07` (unplug and re-plug; "the unplug reported") |
| That a real helper ends when its card is unplugged (so that `onSourceLost` fires) | `9A/H-07`, row 69 |
| The load of one listing every 5 s on the target host | `9A/H-07` |
