---
task_id: 2026-10-12_input_av_core_adapter_plan
design_row: N10 (masterplan/06_design_macos_microphone.md rev 3, rows at :1135 and :1184)
date: 2026-10-14
agent: coder-execution (driver N10, wave 12, track D)
narrative_tier: 3
status: complete (NOT committed; the controller's gate)
requirements: SM-06 (wiring half; the sealed half is a request line), SM-21; caution C-1 of verification/088b
decisions: C135 (3), C118 (1); request lines 552 and 553 (1) of file_requests.md
---

# Row N10: the registry by platform

Tree: `task4/input-av-core-port`, head `d9df31ac` + in-flight RD1 / RD2 / MH1 edits (not mine). Edit tool only on existing files; new files: this record and `delegation_progress/row_n10.md`. Nothing committed. No device, no REAL_PRODUCTION Core against the user's data, no listing program run; doubles and throw-away databases only. Paths under `apps/core-server/`.

## 1. What changed

| # | Change | Where |
|---|---|---|
| 1 | THE ADMISSION: `export const MACOS_MICROPHONE_OPENER_ADMITTED = false;` (C135 (3); flipped only by the M2b gate row: a decision row and a one-line commit; no env, flag or key). `MACOS_MICROPHONE_OPENER_PLATFORM = 'darwin'`. Test-only third argument `ProductionWiringAdmission { admitMacosMicrophoneOpener: true }` of `wireProductionRegistry` | `src/capture/fence/index.ts` |
| 2 | BY PLATFORM, NEVER BOTH (SM-21): `linux` -> Linux bundle (unchanged); `darwin` AND admitted AND both programs AND a tied listing -> macOS bundle (`macosMicrophoneOf`: parts' reader, the tied listing, programs, run dir, timers, THE PRODUCT'S PIPE KEEPER, notices said by code); else neither. Not admitted on `darwin`: the same branch and log line as at d9df31ac | `fence/index.ts` `wireProductionRegistry` step 1 |
| 3 | The loader: optional `macosAudio` bundle; `audio` AND `macosAudio` both stated, or `macosAudio` not an object -> `CAPTURE_ADAPTER_INVALID` before any import; `macosAudio` -> dynamic `import('./audio/usb-audio-macos')`; neither -> the stub without an opener (unchanged). Reads no platform | `src/capture/adapters/real.ts` |
| 4 | THE LOSS WATCH ON `darwin` (admitted only; none unadmitted, D-7 of row 88 kept): the watch reads the TIED listing (`listTied`) and matches with the adapter's own match `identifyMacosRegisteredCard` (an undecided device = `AUDIO_CARD_AMBIGUOUS`, never "absent"). SM-06: for a HELD microphone, 2 passes without a confirming pass (listing unreadable / not read / undecided incl. `LISTS_DISAGREE`) -> `CAPTURE_PRODUCTION_MIC_NOT_CONFIRMED` once (log + persistent error log; deviceId, passes, closed detail word); a confirming pass (present, absent, replaced) or the closed handle -> `CAPTURE_PRODUCTION_MIC_CONFIRMATION_ENDED` (`CONFIRMED` / `NOT_HELD`). Nothing is stopped. No `catch` in the fence (G-R14): the failed reading goes on to the watch through a two-argument `then` | `fence/index.ts` `macosLossMatchOf` (exported for its test) |
| 5 | C-1: `hasOpenerOf` reads `hasOpener === true`, as registration does | `src/capture/adapters/registry.ts:43-44` |
| 6 | THE PIPE KEEPER (request 552): `createPipeKeeper(timers)`: `hold` = `openSync(path, O_RDONLY \| O_NONBLOCK)`, reads nothing; `drain` = one turn now, then one per 20 ms on `timers.after`, up to 16 reads of 64 KiB into one scratch buffer, dropped; `release` = cancel + `closeSync`; drain/release never throw, each once | `src/capture/adapters/local/pipe-files.ts` |
| 7 | Request 553 (1): `MACOS_MIC_PIPE_KIND` and its cast removed; `MACOS_MIC_TRANSPORT = micTransportOf(CaptureMicInputKind.PCM_FIFO_GAPPED)` (same values: F32LE, 48,000, 1 channel, ARRIVAL, 0 ppm, 2,000 ms, false). Head line "registered nowhere" corrected. DRIVER DECISION D-1: one exported pure function `identifyMacosRegisteredCard` + type `MacosWatchedListing` (reuses `undecidedOf`, no twin; SM-09's rule) | `src/capture/adapters/audio/usb-audio-macos.ts` |
| 8 | Pins moved / added: adapters A-9 (`usb-audio-macos` named by loader + fence; control re-planted on the composing file), A-1 (loader names the macOS adapter by type + ONE dynamic import), A-12 (the transport line, no constant, no cast); mic-static G-R2 (8 imported names; the ONE open pinned by text; control: write flags, blocking open, a write); capture static G-R2 comment; NEW capture static case "row N10" (constant line and its one read, option named only by its declaration and read, every production call of the wiring with exactly 2 arguments; control with 4 plants + bracket counter) | the static files |

Not touched: `fence/boot.ts`, `operation.ts`, `sources.ts` (C60), packages, db, capture-session, `capture-composition.ts`.

## 2. Proofs

- DARWIN UNCHANGED (constant false): `real.test.ts` "row N10: darwin, NOT ADMITTED" - with the tied listing AND both programs configured: openerKinds `[ONVIF_RTSP]`, MIC-11/12 `hasOpener:false`, `SOURCE_KIND_NOT_RECORDABLE`, four-slot admission refused, only the camera watch, the one log line `..._MIC_OPENER_NOT_ON_THIS_PLATFORM`, 0 listings, 0 persisted, no door call. Row 88's darwin case unchanged and green. Real app on this Mac's platform word: `capture-composition.db.test.ts` (platform `darwin`, REAL_PRODUCTION) green.
- LINUX UNCHANGED: row 88's three linux cases unchanged and green; with the test admission linux still builds the Linux adapter (no capture group), ADMITTED; `win32` with it builds none.
- DARWIN ADMITTED (test): macOS adapter (`groupOf`), openerKinds `[ONVIF_RTSP, USB_AUDIO]`, ADMITTED, watches CAMERA then MIC, no door call; the watch on the tied listing raises nothing for an undecided device and `MIC_DISCONNECTED:MIC-11` for an absent one; helper missing -> `MIC_PROGRAM_NOT_CONFIGURED`, untied listing -> `MIC_LISTING_NOT_TIED`.

## 3. Mutations seen RED (each reverted, final runs green)

| Rule | Mutant | Red |
|---|---|---|
| C-1 | `hasOpenerOf` truthy again | registry.test C-1 case |
| keeper drains | `DRAIN_READS_PER_TURN = 0` | mic-pipe "reads NOTHING while held ..." |
| keeper closes | `closeSync` removed | mic-pipe cases 1 and 2 (ENXIO / EPIPE) |
| keeper open flags | `O_NONBLOCK` dropped (static only, never run) | mic-static G-R2 pin |
| macOS match | `undecidedOf` not read | usb-audio-macos "row N10" case |
| watch wiring | darwin watch given `identifyRegisteredCard` | real.test watch case + SM-06 case |
| constant | `= true` | real.test darwin cases + capture static "row N10" |
| admission | read inverted (`admission === undefined`) | 5 real.test cases |
| never both | both-bundles check removed | real.test loader case |
| SM-06 count | `MACOS_MIC_UNCONFIRMED_PASSES = 1` | real.test SM-06 case |
| call sites | third argument at the boot step's call | capture static "row N10" (both cases) |

## 4. Checks (run 2026-10-14, this host)

| Check | Result |
|---|---|
| Unit set: adapters `__tests__` (7 files), audio mic-loss / usb-audio-production / macos-card-listing, local mic-static / mic-pipe, fence `__tests__` (unit), capture static, `src/__tests__/capture-composition.test.ts` | 17 files: 598 passed, 1 skipped, 1 failed = `credential.test.ts:471` (RD2's new `CAPTURE_DEVICE_RETIRED.credentialDestroyed` key, not N10's; request line) |
| `usb-audio-macos.test.ts` (incl. block 6, stand-in processes) | 27/27. NOTE: run WITHOUT the heavy-host lock (my slip; stand-ins only, nothing left running) |
| `test/static` | 17 files, 210/210 |
| db (`db-migrate.lock`, throw-away DBs, sandbox off): `capture-composition.db`, `fence.db` / `development-session.db` | 64/64; 5/5 |
| Core `tsc --noEmit` | rc 0 (RD2's in-flight packages/shared compile clean today) |
| `oxlint` on the 12 changed files | rc 0, no finding |

## 5. Driver decisions (for the controller)

| # | Decision | Why |
|---|---|---|
| D-1 | `usb-audio-macos.ts` gains ONE exported pure match (`identifyMacosRegisteredCard`) beyond the two lines of (4) | the watch's macOS match needs `undecidedOf`; a copy in the fence would be a twin (SM-09) |
| D-2 | "BUILT but opener not admitted" read as: the loader's darwin branch exists and is built only when admitted; unadmitted, the stub without an opener is built | constructing the macOS adapter unadmitted would expose its pre-check (which runs the helper on the device) and `enumerate`; "exactly as at d9df31ac" |
| D-3 | SM-06's named fault is a pair of wiring codes in the log + persistent error log, not a fault of the sink | no reason word exists; sharing `MIC_DISCONNECTED` would let the watch and this clear each other (request line) |
| D-4 | The macOS adapter's notices are said by `CAPTURE_PRODUCTION_MACOS_AUDIO_NOTICE` (warn + persisted) | the composition hands no observer; dropped notices would be silent errors |

Unproven (hardware package 9A/H): the keeper on the pinned helper and a real device (row N15); an unplug on macOS (9A/H-07).
