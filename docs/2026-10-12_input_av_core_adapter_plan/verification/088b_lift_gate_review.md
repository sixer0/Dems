---
task_id: 2026-10-12_input_av_core_adapter_plan
blueprint_row: 88b (gate review of row 88, the class-C lift, stage 1)
date: 2026-10-14
agent: security-review (gate, wave 12)
narrative_tier: 1
reviewed: working tree on top of cb06d42c, lift files only (git diff cb06d42c -- capture, capture-composition.ts, capture-session, connect)
driver_record: implementation/088_class_c_lift.md
status: complete
verdict: CAUTION (FAIL 0) - the lift may be committed as it stands
---

# Row 88b: gate review of the class-C lift (stage 1)

## 0. Verdict

**CAUTION, no FAIL. The lift may be committed.** Nothing has to change before the commit. Six cautions are listed in section 4, each with the row it goes to. One of them (C-4, device retirement) has to be fixed before operation 111 can retire a device. The other five are hardening, tests, comments and one operating note.

I read the code myself (registry, loader, fence, composition, session end paths, relay open order, static pins) instead of relying on the driver's record. I ran one unit file, `src/capture/adapters/__tests__/real.test.ts`, with no database and no port: **8 of 8 passed, 1.30 s** (vitest 5.0.3, this host, 2026-10-14 13:03). It contains the darwin proof, the linux proof and both refusals.

## 1. Frame (5W1H)

- **What:** an independent security gate on row 88. Row 88 adds `ONVIF_RTSP` and `USB_AUDIO` to the opener list, adds the registration class rule, adds the loader branch by platform, and wires the REAL_PRODUCTION boot to the built adapters through the new fence door `provideProductionParts` and `wireProductionRegistry`.
- **Why:** once committed, AM-1 is in force (`decisions.md:172`). From that commit the code can reveal a stored camera credential to the relay and start the Linux microphone helper in a REAL_PRODUCTION session. A FAIL here stops the commit and goes to the user.
- **Requirements checked against:** AM-1 read with erratum C135 (`decisions.md:172,179`); `decisions/087_lift_texts.md` section 1.3 (P-1..P-10); `verification/086_pre_lift_security.md` section 6 ("must not start without" 1-6, "must include" 1-8); the controller's items (1)-(9).
- **Method:** `git diff cb06d42c` of the lift files; reading the call sites (registry, `real.ts`, `fence/index.ts`, `capture-composition.ts`, `capture-session/index.ts`, `camera/onvif-relay.ts`, `camera/camera-watch.ts`, `stored-address.ts`); static pins in both `static.test.ts` files; one unit run.
- **Out of scope:** N13 (worker and protocol v5), N11a (`capture/__tests__/*` literals, `test/support/capture.ts`, `mic-transport.ts`), RD1 (schema, migrations 0032/0033) and RD2 (op 111). Each is named below only where it changes what the lift does. RD1 does (C-4).
- **Limits:** no database test, no full suite and no hardware were run. Section 3 claims made only from the driver's runs are marked as such.

## 2. Items (1) to (9)

| # | Question | Result | Evidence |
|---|---|---|---|
| 1 | Opener list gains exactly `ONVIF_RTSP`, `USB_AUDIO`; no path adds another | **PASS** | `registry.ts:41`: frozen list `FAKE, LOCAL_DEVICE` (the development kinds from before) plus `ONVIF_RTSP, USB_AUDIO`. `registry.ts:89`: any adapter that states an opener, on any seam, of an unlisted kind (so `SNMP_POE` and any later kind) is refused `CAPTURE_ADAPTER_INVALID`. An unknown kind fails `ADAPTER_KIND_NOT_ALLOWED` first (`:87`). No other writer of the list: `adapters/index.ts:108` is a re-export (diff empty). Low weakness: C-1. |
| 2 | Class rule holds in every registry the boot or a later admission can build | **PASS** | `registry.ts:93`: an opener whose `sourceClassOf(kind)` is not the operation's class is refused. Development registry (`fence/index.ts:238`): only LOCAL/generated/FAKE adapters; a later admission takes `FAKE` only (`:347`); a production adapter with an opener would be refused at `:93`, and `real.ts` refuses REAL_DEVELOPMENT before any import. Production registry (`:486`, `wireProductionRegistry` hard-codes REAL_PRODUCTION at `:682`): a development kind is refused by RG-1 (`registrableKindsOf`, `kinds.ts:74`) before the class rule. The later-admission view (`:527`) is registered under the same rules. The fake registry (`adapters/fake/index.ts:72`) is development-class adapters only. Proven by test: `real.test.ts` case "refusals 2 of 2" (ran, green). |
| 3 | PRODUCTION fence C60 unchanged | **PASS** | `git diff cb06d42c --stat` is empty for `fence/boot.ts`, `fence/operation.ts`, `fence/sources.ts`, `boot/checks.ts`, `boot/index.ts`, `src/index.ts`. `assertAssignable` still refuses another source class (`registry.ts:142`). |
| 4 | `admitDevice` before the registry (C70); stored address and destination rule before any credential read (AD-02, S-04 via V7b/C137) | **PASS** | `fence/index.ts:526-527`: `take(entry)` (the adapter's door) comes before `registry.register(view)`. The stored row is read and its kind and adapter kind checked before the door (`:517-519`). `onvif-relay.ts:670-676`: `judgeStoredCamera` and `storedCameraSourceOf` come before `credentials.sessionOpen` (`:681`). The camera watch judges before every read (`camera-watch.ts:446-448`). The S-04 port rule is in `stored-address.ts:28-30,91-92` (C137). Diff empty for `stored-address.ts`, `destination-rule.ts`, `credential-reader.ts`, `relay-start.ts`. |
| 5 | Door `provideProductionParts`: twice, late, development boot, test seam | **PASS** (untested branches: C-2) | `fence/index.ts:883-886` refuses when the operation is not REAL_PRODUCTION, when parts are already held, or when the boot step has run (`bootStepRan = true` is the first statement of `run()`, `:906`). One production caller, pinned (`capture/__tests__/static.test.ts:2274`). `wireProductionRegistry` has one caller, pinned to the REAL_PRODUCTION branch (`:2271-2272`). There is no env variable or runtime key anywhere near the class rule (searched `registry.ts`, `real.ts`, `kinds.ts`, `fence/index.ts`, `capture-composition.ts`). The platform word is `process.platform`, handed in by the entry (`src/index.ts:120`). The composition returns before the door in every other operation (`capture-composition.ts:457`). |
| 6 | Loader platform branch; macOS adapter unimported | **PASS** | `fence/index.ts:668-674` decides `audio` = bundle only on `linux` with both helper and guard configured, otherwise `null`. `real.ts:74`: `null` loads `usb-audio` (`hasOpener: false`, `usb-audio.ts:27`); a bundle loads `usb-audio-production`. `usb-audio-macos.ts` (which does state `hasOpener: true`, `:1036`) is imported by no production file. Static pin A-9 is `[]` (`adapters/__tests__/static.test.ts:495`), with a planted-import control (`:513`). Darwin proof ran green. |
| 7 | E-03 `captureEnded()` at every capture end | **PASS with a gap to prove** (C-3) | `capture-composition.ts:591` subscribes to the session's `STOPPED`, `INTERRUPTED` and `FAILED_START` (`:841-845`). A failed start (`capture-session/index.ts:2279-2283` -> `captureEnded` -> `:1617-1618`) and the session leaving RECORDING (`:1657-1658`) are covered. One branch emits no end event: engine outcome `IGNORED` with nothing durable (`:1580,1607-1618`). Shutdown emits none either (`:2530-2538`), which is harmless because the watch is closed at shutdown. |
| 8 | Driver decisions D-1, D-2, D-4 | **No risk found** | D-1: `usb-audio.ts` states no opener and has no `admitDevice`, so a microphone on darwin is assignable and never recordable, and a later microphone is `NOT_SERVED`. Fail-closed. D-2: `onvif-rtsp.ts` is retired; static A-1 pins that nothing imports it. Deleting it is the controller's call (red line). D-4: on linux without the helper or the guard, the microphone is built without an opener and a warning is persisted (`:671-672`), so no session can start. Fail-closed and stated in the log; acceptable. D-5 (no parts gives the empty registry and a warning in the log only) is safe because the entry always composes. |
| 9 | What the lift makes reachable for the first time | Listed in section 3 | One new path, the boot heartbeats, needs an operating note (C-6). |

Review 086 section 6: I re-checked from the code "must not start without" 5 (darwin) and 6 (S-04), and "must include" 1, 2, 3 and 4 (E-02 at `modules/capture-discovery/connect/index.ts:276`, always stated). Items 1-4 of "must not start without" and 5-8 of "must include" are decision and process facts. I took them from the record and the C-rows and did not re-run them.

## 3. Code paths the lift makes reachable for the first time

| Path | Where | Gates in front of it |
|---|---|---|
| Boot: dynamic import and build of `onvif-relay`, `snmp-poe`, and `usb-audio-production` (linux) or `usb-audio` | `fence/index.ts:687`, `real.ts:72-74` | REAL_PRODUCTION branch of the boot step; door accepted only under REAL_PRODUCTION; registration rules (1), (2) |
| Boot: read of all stored production devices and profiles through `app.db.read('capture.fence.production')` | `fence/index.ts:961-963` | read only; same statements as row 85 |
| **Boot, any platform including darwin: an ONVIF time-read heartbeat to every stored production camera** | `fence/index.ts:717`; `camera-watch.ts:446` | stored-address rule and source bind before each read. **New outbound traffic toward the user's cameras on any REAL_PRODUCTION boot** (C-6) |
| linux: ALSA config writer in `<dataDir>/run/capture`; microphone loss watch that lists cards periodically | `fence/index.ts:673,719-731` | linux, helper and guard configured |
| Session start: **relay start with a revealed stored credential** (start message on stdin) | `onvif-relay.ts:670-690` -> `relay-start.ts` | plan builder: four slots with an opener (fails on darwin); C60 fence; destination rule; source bind; reader audit; C34 relay reports |
| Session start, linux: **the helper's start** (FFmpeg into a 0600 pipe) | `usb-audio-production.ts` open path | four-slot recordable plan; card matched by serial or port |
| **The worker's announce gate (E-11 branch B) on a production plan** | worker (N13, not this lift) | 128-bit per-attempt ingest path; it was already active in development |
| Later admission: a camera admitted after boot gets a heartbeat | `fence/index.ts:706` | stored row decides; `admitDevice` before the registry |

## 4. Cautions (severity, routing)

| # | Sev. | Finding | Location | Remediation | Route |
|---|---|---|---|---|---|
| C-1 | Low | The registration check reads `hasOpener === true` (`statesOpener`), but recordability reads it as truthy (`hasOpenerOf`). An adapter whose `hasOpener` is truthy but not `true` would skip both registration rules and still pass `assertRecordable`. Two layers stay in front of it: `assertAssignable`'s class check and the C60 fence. All in-repo adapters use literal booleans. | `adapters/registry.ts:43,45,89,93,134` | Make `statesOpener` truthy (`Boolean(...)`, still on every seam) or have `hasOpenerOf` use `=== true`. Add one case for a truthy non-boolean. | N10, which edits the registry next (C135 (3)). It can also go into this commit as a one-line change if the controller wants. |
| C-2 | Low | The door's three refusals (second call, call after the boot step, any operation but REAL_PRODUCTION) have no test. Reading the code shows they are correct. | `fence/index.ts:883-886` | Three unit cases on a mounted fence double. | test-expert in row 89 or the next fence test row |
| C-3 | Low (hypothesis) | One end of a capture emits no session event: engine outcome `IGNORED` with nothing durable. In that case `captureEnded()` is not called, and the watch's losses and self-raised faults carry into the next capture. Not proven reachable. | `capture-session/index.ts:1580,1607-1618` | Prove it unreachable, or emit an end event or call the end listener on that branch. | row 90 (session scenarios, with E3) |
| C-4 | **Medium (future)** | RD1 adds `capture_devices.retired_at` (migration 0032). The lift's reads do not filter it: `READ_STORED_DEVICES` (`fence/statements.ts:30`), `READ_STORED_DEVICE_PROFILES`/`_OF` (`fence/production-parts.ts:1051,1053`). Once op 111 can retire a device, the lifted registry would still load it, send it heartbeats, admit it later, and leave it assignable, so its credential could be revealed at an open. | as named | Filter `retired_at IS NULL` in the fence reads (boot and later admission) and refuse a retired device at assignment and at the reader's device gate. | RD2 / the row that wires op 111. **Must land with or before op 111, not after.** It does not block this commit. |
| C-5 | Low (doc) | `fence/index.ts:45` value-imports `usb-audio-production` (two pure functions). The production microphone module is therefore evaluated in every operation and in every test that imports the fence. This contradicts the `real.ts:6-8` header ("for their values, nowhere else in the product"), although A-9 allows the import. The comment at `fence/index.ts:344-345` ("a production kind has no opener in this phase") is stale. | as named | Fix the two comments, or move the two functions to a pure module. | tidy row / stage-2 comment errata |
| C-6 | Ops | After the commit, every REAL_PRODUCTION boot, including this Mac, sends ONVIF time reads to every stored camera at boot. This is a read, allowed under U24 and gated by the destination rule, but it is new. | `fence/index.ts:717` | No agent boots REAL_PRODUCTION against the user's data or cameras without the user's word. Row 89 stays on doubles in a temporary directory. | controller (wave note; B1 condition, 086 s6 item 3) |

## 5. GDPR / ISO 27001 relevance (short)

- **Art. 32 / A.9 / A.10:** the credential is revealed at one place with an audit entry (unchanged), only after the destination rule, and travels on stdin only. Nothing in the lift weakens this.
- **Art. 5(1)(e) / A.8:** C-4. A retired device must stop being a holder of a revealable credential, or retirement does not limit storage and use. Route as above.
- **Art. 25:** fail-closed defaults hold: no parts gives an empty registry, darwin and linux without helpers have no microphone opener, and there are no runtime switches.
- **A.12.4:** each wiring outcome is logged by code (`ProductionWiringCode`). D-5's warning goes to the log only (low).
- **A.14.2:** the static pins hold the single caller and single importer (A-1, A-9, `static.test.ts:2271-2274`). The door refusals have no test (C-2).

## 6. Before the commit

Nothing is mandatory. Optional: the C-1 one-liner. The controller fills AM-1's hash column after the commit and records C-1 to C-6 with their routes.

## 7. Read / not read

Read: the documents and code named in sections 1-4. Not read: credential and key files (none needed); N13/N11a worker and protocol changes beyond what is quoted; database test files. Run: `real.test.ts` once, 8/8. I did not re-run the driver's db sets, full static sets or mutants. Those claims rest on `implementation/088_class_c_lift.md` section 3.

---
*Generated: 2026-10-14 13:10*
