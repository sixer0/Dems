# Contract of fix wave J (producer: J-S; consumers: J-W, J-T, J-P)

Written by J-S at its start (2026-10-12, 00:55 WIB). Totals unmoved: 97 operations (36 GET /
61 POST), 67 audit types, schema 6 / dbc-7, no migration. Everything below is an ADDITIVE
OPTIONAL member, a new VALUE of an open code set, or a rule over members that exist. Read
members BY NAME; every example named here is exported from `@dems/shared/api` or
`@dems/shared/sim` (import it in your test).

**STATUS LINE: see the END of this file - `JS consistent at 05:58` (12 Oct, host clock). Names are final.**
Until the lanes are restarted by J-W the two running Cores answer the OLD way: build against the
examples.

---

## J-S 1. An item that was never sealed carries no sealed value (truth rule 3a; JA2-01 / JW-01)

THE RULE (one for every surface): **`evidence.sealedAt === null` = the item was never sealed.**
Shared reader: `hasSealedValues(item)` (`@dems/shared/sim`; takes `unknown`, never throws; false
for `sealedAt: null` and for anything that is no item). When it is false a client shows NO track
hash, NO manifest hash, NO signature, NO key, NO "Sealed" label, NO Verify control and NO
verification verdict - it says "Not sealed: nothing to verify" (wording is the client's).

What the Core / simulator now sends for such an item (ops 39, 40, slice `evidence`; BOTH lanes,
also for the rows already stored in a kept database - the Core applies the shape when it reads):

| Member | Value on a never-sealed item |
|---|---|
| `sealedAt` | `null` |
| `status` | `RECORDED` |
| `tracks` | `[]` (no track, no hash) |
| `manifestHash` | `EVIDENCE_NOT_SEALED_DIGEST` = 64 zeros - the required member's placeholder, the digest of nothing |
| `signature` | `EVIDENCE_NOT_SEALED_SIGNATURE` = `{ value: <64 zeros>, keyId: 'NOT-SEALED', algorithm: 'SIMULATED-SHA256', simulated: true }` - placeholder of the required member; never shown |
| `files`, `fragmentChainHead`, `transcriptSha256`, `transcript` | absent |
| `verification` | `{ status: 'NOT_RUN', at: null }` - always (a stored PASS of an old row is not answered) |

(`manifestHash` and `signature` are REQUIRED by the closed item shape and by the table; they
cannot be left out without moving the contract, so they hold the null digest. Never draw them.)

Example: `EVIDENCE_NOT_SEALED_ITEM_EXAMPLE` (`@dems/shared/api`).

**Operation 41 `verifyEvidence` for such an item: `409 NOT_SEALED`**, `details.simCode:
'UNSEALED_EVIDENCE'`, message "This item was never sealed: there is nothing sealed to verify."
No audit row, no custody entry, the item is unchanged. (The refusal operations 42 and 43 already
give a RECORDED item; operation 41 had none and answered PASS.) Contract example: operation
`verifyEvidence`, response `409`, example `notSealed`. In the in-app simulator (`sim.verify`) the
same item throws `SimTransitionError` with `code: SimErrorCode.UNSEALED_EVIDENCE`; the Live
binding rebuilds the 409 as that same error (`rebuild-error.ts` maps `NOT_SEALED`).

Other non-sealed states the simulator can produce: a cancelled session, a failed start and a
session that never recorded make NO item; RECORDING / STOPPING / FINALIZING / FAULT / RECOVERY
have no item until the seal or the recovery ends. The only never-sealed ITEM is the RECORDED one
of an INCOMPLETE session (and the seed's one). Owner of the screens: J-W (web item page, list,
Hash & Integrity), J-T (mobile evidence), J-P (Home "Recent Sessions").

## J-S 2. A session sealed on a SIMULATED Core is a demonstration RECORD WITHOUT MEDIA (JA2-02)

CHOICE: the simulated lane records no media, and the 14 bundled DEMO packages belong to the seed
items only (they join by evidence / session / case number and subject) - so a freshly sealed
simulated session CANNOT have a player. It says so plainly, the same on every surface:

| Surface | Member | Value |
|---|---|---|
| item, list, slice | `evidence.integritySource` | `SIMULATED` (exists) |
| item (op 40) | `media` | `{ source: 'NONE', packageSuffix: null, reason: 'DEMONSTRATION_RECORD' }` - NEW VALUE of the open code set `media.reason` (was `NOT_A_SEALED_PACKAGE`, which a client worded "No sealed package of this item is in the evidence store") |
| Verify (op 41) | `demonstration: true` - NEW optional member of `EvidenceVerifyResult` | present on EVERY verdict the simulator computed (a `SIMULATED` item and a v1 `DEMO_PACKAGE` item): the hashes of a demonstration record were compared, no stored media was read. ABSENT on a verdict of a real sealed package |
| Summary / Finalizing | finalization step ids are unchanged | the step `STORE_SEALED_PACKAGE` of a SIMULATED Core is a demonstration step: word it with the DEMO mark of J-S 7 |

Client wording rule: for `reason: 'DEMONSTRATION_RECORD'` say "Demonstration record of a
simulated session: no media was recorded" (not "no sealed package ... in the evidence store");
with `demonstration: true` the verdict reads "PASS (demonstration)" / carries the DEMO chip -
never a bare "Verified by the Core". Example: `VERIFY_PASSED` now carries `demonstration: true`
(`verifyEvidence` 200 `passed`, `failed`); `VERIFY_PASSED_DEVELOPMENT` (a real package) does not.
Shared wording, ONE for the three clients: `common.truth.*` in
`packages/shared/src/i18n/en/common.ts` (`notSealed`, `notSealedDetail`, `demonstrationRecord`,
`demonstrationVerdict`, `demonstrationChip`, `simulatedCore`, `simulatedCoreDetail`,
`sealedVerificationFailed`, `exportKindUnavailable`, `exportRequested`, `manifestInExport`,
`levelNotMeasured`, `levelNotMeasuredDetail`, `updaterNotAvailable`, `notReportedByCore`,
`securityNotReported`, `incompleteSession.{QUARANTINED,RECORDED_NOT_SEALED,NEVER_RECORDED}`,
`neverVerified`). Use them, or your own app wording - but the same fact, the same words.

## J-S 3. Composite export: stated, and refused before any job (truth rule 3d; JA2-03 / JW-03)

- **Capability, NEW optional member of operation 40 (`EvidenceDetail`): `exportKinds`** -
  `[{ kind: 'PACKAGE', available: true }, { kind: 'COMPOSITE', available: false, reason: 'COMPOSITE_ENCODER_NOT_SELECTED' }]`
  on both lanes today (no encoder is selected in this build: licence gate). `reason` is a code,
  present exactly when `available` is false. Example: `EXPORT_KINDS_EXAMPLE`. Client rule: a kind
  is offered ENABLED only when its entry says `available: true`; `available: false` = the choice
  is drawn disabled with its reason ("Composite video is not available in this build." -
  `evidence.export.compositeUnavailable` exists); member ABSENT (in-app simulator, an old Core) =
  only PACKAGE is offered.
- **Operation 42 with `kind: COMPOSITE` while it is not available: `409 COMMAND_UNSUPPORTED`,
  `details.reason: 'COMPOSITE_ENCODER_NOT_SELECTED'`**, decided after 401 / 403 / 404 and BEFORE
  the hosted action: no export id, no job, no `EVIDENCE_EXPORTED` row, no event, nothing in
  Storage. Both lanes (the simulated lane no longer delivers "Package" for it). Contract example:
  `exportEvidence` 409 `compositeUnavailable`. In the in-app simulator `exportEvidence` with
  `kind: 'COMPOSITE'` throws `SimTransitionError` (`code: COMMAND_UNSUPPORTED`, `reason:
  'COMPOSITE_ENCODER_NOT_SELECTED'`), and the LIVE source now THROWS the same error for the
  Core's 409 (it used to answer every other 409 as `{ ok: false, reason: 'NOT_SEALED' }`):
  an export call that names COMPOSITE needs a `catch` - or simply never sends the kind while
  `exportKinds` says it is not available.
- **"Evidence exported" for a request that did not complete:** the request row of a JOB keeps
  its audit type (`EVIDENCE_EXPORTED`, no new type) but its EVENT now carries
  `params.exportPhase: 'REQUESTED'`; the completion event carries `params.exportPhase:
  'COMPLETED'`. A client's activity list (Storage, Network & Time, Recent Events) words
  `REQUESTED` as "Export requested" and only `COMPLETED` / absent as "Evidence exported".
  Reader: `exportPhaseOfEvent(event)` (`@dems/shared/sim`): `'REQUESTED' | 'COMPLETED' | null`.

## J-S 4. "Download manifest" of a real item (JW-02)

NO operation returns the signed manifest of an item by itself, and none may be added. The signed
`manifest.json` and its signature leave the Core only inside the PACKAGE export archive
(operation 42 `kind: PACKAGE`, then operation 87 + the download path).
**J-W: remove "Download manifest" for an item that is sealed on this Core
(`isSealedOnThisCore(item)`, i.e. `sealedPackage` stated) and point to Export ("The signed
manifest is part of the export package"). For a DEMO item (`isBundledDemoItem`) the console's own
summary may stay ONLY under its DEMO name; for a never-sealed item (J-S 1) there is no manifest
at all.** J-T / J-P: same rule (the devices already say "not available"; hide or disable with
that reason).

## J-S 5. Security / platform facts of a real-capture Core (truth rule 3c; JW-04 / JT-03)

The one statement stays `security.platformNotReported: true` (reader `isPlatformNotReported`).
NEW: every answer of the Core that used to state a PASS over hardware it does not read now says
"not reported" itself:

| Where | Member | Value on a Core that states `platformNotReported` |
|---|---|---|
| pre-check row (`session.precheck.items[]`, id `SECURITY`) | `status`, `value`, `params.rule` | `status: 'WARN'`, `value: 'NOT_REPORTED'`, `reasonCode: null`, `params: { rule: 'SECURITY_PLATFORM_NOT_REPORTED' }`. It is a pre-check NOTE (`isPrecheckNote(item)` is true, like the host-clock TIME row): not a warning, never acknowledged, never counted; the outcome of a run with only notes is PASS. Draw it as "Not reported", never "READY PASS". A security FAULT still BLOCKs |
| diagnostics rows (`diagnostics.checks[]`, ids `STORAGE`, `FAN`, `NETWORK`, `SECURITY`) | `status`, `params.rule` | `status: 'WARN'`, `detail: 'Not reported by this Core'`, `params: { rule: 'NOT_REPORTED' }`. Reader `isDiagnosticNotReported(check)`. Draw "Not reported"; do not count it as a warning. `CPU`, `CAMERA`, `AUDIO`, `TIME` are unchanged |
| operation 44 `getDeviceHealth` (`GET /api/v1/device/health`; the brief's "getDeviceStatus") | `security.platformNotReported` | `true` (NEW optional member beside `tpmOk` / `secureBoot` / `posture`, which stay placeholders) |
| platform device list (`selectPlatformDevices` / `platformDevices`) | row `TPM` | `status: 'NOT_REPORTED'`, `online: false` (was `OK`, `true`). Read `status` first |
| device slice readers of the simulator (`sim/devices.ts`, `sim/maintenance.ts`) | - | the three readers wave I left now read the member |

Examples: `PRECHECK_SECURITY_NOT_REPORTED_EXAMPLE`, `DIAGNOSTIC_NOT_REPORTED_EXAMPLE` (`@dems/shared/api`).
Client rule (J-W pill + pre-check + diagnostics; J-P Home ring / chips / diagnostics sheet; J-T
none): **where `isPlatformNotReported(state.security)` is true no surface says SECURE, PASS, OK,
Verified or Enabled about TPM, Secure Boot, the posture, SMART, the fan or PoE.** The pill's word
for "nothing wrong is known" must not be "SECURE" on such a Core.

## J-S 6. Microphone level at rest (JW-08)

NEW optional member of an audio frame (`audio.inputs[<MIC-NN>]`, message `meters`):
**`notMeasured: true`** - the Core measures a level only while a capture is open (session state
RECORDING). On a real-capture Core with no capture open every frame carries `notMeasured: true`,
`noSignal: false` and the floor value in `dbfs` / `peak` (placeholders of the required members).
Reader: `isLevelNotMeasured(frame)`. Client rule: `notMeasured` -> draw "Not measured" (no bars,
no number, no "NO SIGNAL"); `noSignal: true` keeps its meaning - an OPEN capture delivers no
samples (a fault). The simulated lane generates levels at all times and never sets the member.
The same optional member `notMeasured: true` is on each entry of `audio[]` of operation 44
`getDeviceHealth` and `channels[]` of operation 45 `getAudioStatus`.
Example: `AUDIO_FRAME_NOT_MEASURED_EXAMPLE`.

## J-S 7. What says "this is a demonstration" on a SIMULATED Core (truth rule 3f; JW-07)

No new member. The rule, as ONE shared reader: **`isOwnCaptureCoreState(state)`
(`@dems/shared/sim`) = `state.time.hostClock === true || state.security.platformNotReported ===
true`.** A Core in its own capture states both at every start and every second; a SIMULATED Core
and the in-app simulator state neither. So in Live mode: `!isOwnCaptureCoreState(state)` = the
Core is SIMULATED: every feed, recording state, integrity statement, network / storage / platform
card is a DEMONSTRATION and carries the DEMO / SIMULATED word (web: chip "Simulated Core" in the
header instead of a bare "LIVE"; "Synthetic demo values" on the cards as lane 2 has them).
Finer members that exist: a capture device's `adapter` / `sourceClass` (absent in simulated
capture; `DEVELOPMENT` for FAKE / LOCAL_DEVICE on a real-capture Core), an item's
`integritySource` (`SIMULATED`, `DEMO_PACKAGE`, `REAL`), `signature.simulated`, and
`demonstration: true` on a verdict (J-S 2).

## J-S 8. The verification of record FAILED (truth rule 3b; JT-04 / JW-09)

The member exists on the list entry AND the item: **`evidence.verification.status === 'FAIL'`**
(`{ status: 'NOT_RUN' | 'PASS' | 'FAIL', at }`, required member of `EvidenceItem`: operation 39
`items[]`, operation 40 `evidence`, slice `evidence`). The Core's own verification of a real
package records it there (`recordEvidenceVerification`). Reader: `verificationOfRecordFailed(item)`.
Client rule: when true the status chip / list row / header / lifecycle never read plain "Sealed":
they read "Sealed - verification FAILED" (danger tone). Nothing is added.

## J-S 9. Items with / without a verification of record (GM-02)

NEW optional member of operation `getSecurityStatus` (the answer the Security & Audit page reads):
**`evidenceVerification: { sealed, passed, failed, neverVerified }`** - counts over EVERY item of
the Core by its verification of record (`sealed` = items with `sealedAt !== null`; `passed` +
`failed` + `neverVerified` = `sealed`; never-sealed items are not counted). Example:
`SECURITY_STATUS_EVIDENCE_VERIFICATION_EXAMPLE`. J-W: the tamper tile reads these four numbers
and drops the count over the newest 1,000 audit rows.

## J-S 10. Finding INCOMPLETE / quarantined sessions (JW-22)

Existing: **operation 38 `listSessionHistory`** (`GET /api/v1/session/history`, every role;
slice `sessionHistory`) - what the devices' Sessions hub reads. Each entry has `outcome`
(`SEALED` | `INCOMPLETE`), `faultKind` (the cause that ended it, or null), `evidenceId`,
`startedAt`. Reader over those members, no new one: `incompleteSessionFactOf(entry)`
(`@dems/shared/sim`) ->

| `kind` | when | say |
|---|---|---|
| `QUARANTINED` | `INCOMPLETE`, `startedAt !== null`, `evidenceId === null` | recorded, could not be sealed: no evidence item; its recordings are kept in the Core's quarantine folder (the installation's administrator recovers them) |
| `RECORDED_NOT_SEALED` | `INCOMPLETE`, `evidenceId !== null` | interrupted; its item is a never-sealed record (J-S 1) |
| `NEVER_RECORDED` | `INCOMPLETE`, `startedAt === null` | ended before a recording started |
| `null` | `SEALED` | - |

`cause` = `faultKind`. The code WHY a seal was unsealable (e.g. a missing key) is on the audit row
`SESSION_INCOMPLETE` (`details.reason: 'UNSEALABLE'`, `details.cause`) - filter operation
`listAuditRows` by `sessionId`; it is not on the list entry (it would need a column).

## J-S 11. "Install update" on a real-capture Core (JT-06 / JW-06)

NEW optional member of the `update` slice: **`updaterNotAvailable: true`** - stated by a Core in
its own capture (it has no updater). Reader `isUpdaterNotAvailable(update)`. Client rule: the
update card says "Software update is not available on this Core" and offers no Install control;
`currentVersion` / `availableVersion` / `steps` are then not readings and are not drawn.
**Operation 67 on such a Core: `409 COMMAND_UNSUPPORTED`, `details.reason:
'UPDATER_NOT_AVAILABLE'`**, nothing started, no row. Example: `UPDATE_NOT_AVAILABLE_EXAMPLE`;
contract example `startSoftwareUpdate` 409 `updaterNotAvailable`. The SIMULATED lane keeps the
demonstration update unchanged: there the clients add the confirmation (truth rule 3e) and the
DEMO word.

## J-S 13. ONE statement of system state (truth rule 3c; JT-01, JW-05, JA2-04) - shared reader, no new member

`systemTruthOf(state, { coreLinkLost? })` (`@dems/shared/sim`, new module `sim/system-truth.ts`) is
the reader for every surface that says the system state at a glance (web ring + pill; devices'
Home, header, ring). It returns `{ state, severity, flags, facts, allOperational }`:

- `flags` are `systemStatus(state).flags`, unchanged (no flag id was added: your wording tables
  keyed by `SystemFlagId` are untouched).
- `facts` are what the Core states beyond the flags: every ACTIVE alert of kind `SYSTEM` with
  severity WARNING or CRITICAL (`id` = its `params.reason`: `SEAL_BLOCKED`, `UNSEALABLE`,
  `CAPTURE_DEVICE_UNREACHABLE`, `CAPTURE_DISCOVERY_EMPTY`, `EVIDENCE_VOLUME_SYNC_NOT_FULL`, ...;
  `message` = the Core's sentence; `target`; `alertId`; `blocksRecording`), plus `SEAL_RETRYING`
  (a seal that failed and is run again: from the open session's finalization, no alert exists).
- `state`: `CRITICAL` with a critical flag or a critical fact that blocks (a blocked seal);
  `ATTENTION` with any other flag or fact (an unreachable source, a retried seal, an
  unacknowledged unsealable recording); `RECORDING` while recording without a critical;
  `READY` only with no flag and no fact; **`UNKNOWN` when the client passes `coreLinkLost: true`**
  (fact `CORE_LINK_LOST`, sentence `CORE_LINK_LOST_SENTENCE` = "Core offline — state unknown").
- **`allOperational` is true exactly when a surface may write "All systems operational".**

Client rule: Home / header / pill / ring read THIS (the clients decide when the link counts as
lost: a few seconds, truth rule 3c). The web's own seal-retry derivation says the same for the
seal; the unreachable source and the lost link were said by no surface.

## J-S 12. Other

- Shared sentences: specification ids removed from operator copy in `packages/shared/src/i18n/en`
  ("(SYS-008)", "section 19.1", "design book section ...", "EVT-nn" in SHARED keys); "tablet" ->
  "device" in SHARED sentences that the phone shows. Key NAMES do not change; only texts. The
  list is in `implementation/167_fix_wave_j_s.md`. A sentence that lives in `apps/*` is its
  driver's.
- JW-14 (RBAC shapes): the server answers every refused call the same way already
  (`403 NOT_PERMITTED` / `FORBIDDEN` with `details { operationId, permission, role }`); what
  differs is client-side. For the pre-emptive form J-W / J-T need no new member: operation 40
  `access { play, readTranscript, export }` exists - disable Play / Export from it WITH the reason.

---
- JA2-24: the refusal of the camera that already feeds the other track now names its reason -
  `422 INVALID_INPUT`, `details.reason: 'CAMERA_ON_BOTH_TRACKS'` (`MIC_ON_BOTH_INPUTS` for the
  microphone pair); in the in-app simulator `SimTransitionError.reason`. Word the refusal from it.
- SHARED TEXTS CHANGED UNDER UNCHANGED KEYS - a client test that pins the old sentence fails in
  its own workspace: `common.events/audit` titles "Tablet paired / unpaired / link changed /
  connected / disconnected" -> "Device ..."; `devices.tabletControl` "Operator device",
  `devices.tabletOfflineTitle/Body`, `devices...tablet` "Operator device";
  `networkTime.tablet` "Operator device link", `tabletDetail`, `tabletOffline` (two keys);
  `shell...tablet` "Operator device link"; `system.tabletAppVersion` "DEMS device app";
  `sessionNew` no-paired-device sentence; `session...incomplete` without "(SYS-008)";
  `evidence.manifestTitle`, `evidence...verifyLead`, `login.trustTooltip`,
  `securityAudit...rule`, `storage.roleSource/subtitle/formulaLabel`, `system.tableLabel /
  pipelineLabel / partitionsTitle / identityTitle / sbomTitle / timeSourceTitle` and the two
  fault notes, `networkTime...derived`, `devices.noPreview` - all without their specification
  ids; `common...v1` "Sources: not recorded for this demonstration item"; camera search
  `unavailable` without "yet".

---

**JS consistent at 05:58** (12 Oct 2026, host clock). Proof: shared whole suite, core-server unit
whole suite, db suite through the project's script, typecheck and lint of both workspaces - green
(detail: `implementation/167_fix_wave_j_s.md` section 3). OpenAPI regenerated: 97 operations
(36 GET / 61 POST). J-W may restart the two lanes now (lane 2: `stop 2`, then
`start 2 --with-camera-stub --speech-mic`, NO reset; lane 1: `stop 1`, normal start, no reset).
After the restart: rows of a kept database with `sealed_at` NULL are answered in the never-sealed
shape; lane 2's `update` slice states `updaterNotAvailable`; its microphones read `notMeasured`
at rest.

**lanes restarted at 06:01** (12 Oct 2026, host clock) by J-W: lane 2 `stop 2` then `start 2 --with-camera-stub --speech-mic` (not piped, NO reset; new Core PID 78103; the camera stub has a NEW fixture account), lane 1 `stop 1` then `start 1` (no reset; new Core PID 78217). Both web consoles (5176 / 5177) kept running. No session was open on either lane and both rigs read OFF before the stop. Devices: sign in again; read your reverse rules back.

---

# J2-S — ROUND TWO (producer: J2-S; consumers: J2-M now, the next web pass)

Written by J2-S on 12 Oct 2026 (host clock 09:3x). Totals unmoved: 97 operations (36 GET / 61 POST),
67 audit types, schema 6 / dbc-7, NO migration. Everything is an additive optional member, a
description, or a reader over members that exist. Examples are exported from `@dems/shared/api`,
readers from `@dems/shared/sim`. **Both Cores answer the OLD way until the controller has them
restarted (server code changed): build against the examples.**

## J2-S 1. Markers, notes and the form's note ON THE ITEM (JT-11 / JW-13 / JA2-08)

**No new member: the Core already holds and sends them.** `EvidenceItem.markers` and
`EvidenceItem.notes` (operation 39 `items[]`, operation 40 `evidence`, slice `evidence`) are
written when the item is made, from the session the Core held, into the item's own row
(`evidence_items.markers` / `.notes`), on BOTH lanes, for a sealed item and a never-sealed one.
A session nobody annotated has two EMPTY lists (that is what the first round read as "absent").

| Member | Shape | Source |
|---|---|---|
| `evidence.markers[]` | `{ id, at, index, label }` | the session's MARKER timeline items (same ids, instants, labels) |
| `evidence.notes[]` | `{ id, at, authorId, text, origin? }` | the notes written during the recording, whole |
| NEW optional `notes[].origin: 'SESSION_FORM'` | on ONE note at most, the first: `id: 'NOTE-FORM'`, `at` = creation of the session, `authorId` = who created it, `text` = the form's "Notes (Optional)" field, trimmed | `session.input.notes` at the moment the item is made (an empty field adds no note) |

Example: `EVIDENCE_SESSION_ANNOTATIONS_EXAMPLE`. Constants: `SESSION_FORM_NOTE_ID`,
`SESSION_FORM_NOTE_ORIGIN`; builder `itemNotesOf(session)` (`@dems/shared/sim`).
Client rule: draw `markers` and `notes` of the item BY NAME (the web block
`features/evidence/session-annotations.tsx` already does); a note with `origin: 'SESSION_FORM'`
is titled "Note from the session form" (not "Note written at hh:mm:ss": its `at` is the creation
of the session); empty lists draw nothing. **A snapshot has no member and no picture: it is a mark
on the open session's timeline and an audit row (`SNAPSHOT_TAKEN`-class) only. Do not offer
"snapshots" on an item.** Items sealed BEFORE this change keep what they stored: markers and
in-session notes yes, the form's note no (it was never stored with them).
Scope: the lists travel with the item to every caller that may read the item (EVIDENCE_VIEW);
they are NOT narrowed by the case-scope rule that holds for play / transcript / export
(`access`). Decision for the controller, see note 172.

## J2-S 2. ONE version per component (JW-26 / JA2-30; truth rule 3f)

NEW optional member of operation 64 `getSystemStatus` (`GET /api/v1/system/status`, every signed-in
role): **`components`** — example `SYSTEM_COMPONENTS_EXAMPLE`:

```
components: {
  core:          { name: 'dems-core-server', version: '0.2.0' },   // = operation 1 `service` / `version`; = `device.softwareVersion` of a sealed manifest
  captureWorker: { version: 'capture-worker/0.5.0' },              // ABSENT on a Core in SIMULATED capture (it starts no worker)
  apiContract:   { version: '0.3.0' },                             // `info.version` of the OpenAPI document
}
```

| Component | The ONE place it is defined | Held equal by |
|---|---|---|
| Core server | `apps/core-server/src/version.ts` `CORE_SERVER_VERSION` | `version.test.ts` (= the workspace manifest) |
| capture worker | `apps/core-server/src/capture/boot/checks.ts` `CAPTURE_WORKER_VERSION` | `protocol-pins.test.ts`, `fault-lifecycle.test.ts` (= `apps/capture-worker/src/worker.h`) |
| API contract | `packages/shared/src/api/openapi.ts` `OPENAPI_CORE_SERVER_DOCUMENT_VERSION` | the OpenAPI tests |
| web console | `apps/core-web/package.json` `version` (0.1.0) | — the console states its OWN build |
| mobile app | `apps/mobile/app.json` `expo.version` (0.1.0) = `Constants.expoConfig.version`; it is what the app sends as `appVersion` at pairing and what Paired Devices lists | — |
| the DEMONSTRATION device model | `packages/shared/src/sim/dataset.ts` `SOFTWARE_VERSION` (2.4.1), `UPDATE_VERSION` (2.5.0) | a model value, never a version of a real component |

**CLIENT RULE ("About" on web and mobile, Login footer, sidebar / rail footer, System page):**
1. The Core's version is `components.core.version` (or operation 1 `version`, the same constant —
   the Login strip already reads it). The worker's is `components.captureWorker.version`, shown
   only when present. The contract's is `components.apiContract.version`.
2. The client's own version is its own build's: the web console its package version, the app
   `Constants.expoConfig.version`. Label each for what it is ("Core server", "Capture worker",
   "API contract", "Web console", "Mobile app") — never a bare "v…" that could be any of them.
3. **On a Core in its own capture (`isOwnCaptureCoreState(state)`) NOTHING shows
   `SOFTWARE_VERSION`, `UPDATE_VERSION`, `device.softwareVersion`,
   `device.identity.coreSoftwareVersion`, `device.identity.tabletAppVersion`,
   `update.currentVersion` / `availableVersion` or the `SIGNED_FIRMWARE` control's detail as a
   version of the real thing**: those are the hosted model's values (they stay in the slices as
   placeholders of required members). They may be drawn only under the "Synthetic demo values" chip.
4. On the SIMULATED lane and in the in-app simulator the model's v2.4.1 / v2.5.0 stay, under the
   DEMO mark of J-S 7.
5. `components` absent (in-app simulator, an older Core): show the client's own version and, in
   Live mode, operation 1's `version`.

## J2-S 3. `online` of a capture device is the registry flag, not reachability (JW-23)

No shape change; the member's meaning is now in its description (contract + OpenAPI):
`captureConfig.cameras[].online`, `captureConfig.cameras[].streamState`,
`captureConfig.mics[].online`, `captureDevices.devices[].online` / `.streamState` (operations 76,
77 and the two slices). On a Core in its own capture they come from ONE stored column,
`capture_devices.enabled`: true from the registration, changed only when a pre-check, a session
start or a microphone re-scan has asked the source. The selector's `streamState` is derived from
the same flag (`LIVE` for true). So `CAM-04` / `CAM-05` / `CAM-06` on dead ports read
`online: true, streamState: 'LIVE'` until a pre-check asks them. **Client rule (unchanged from
round one, now backed by the contract text): at rest say "Not checked"; never "Online", "Ready"
or "Live" from these members alone.**

## J2-S 4. Why a seal was given up, on the session list (JW-22 remainder)

NEW optional member of an entry of operation 38 `listSessionHistory`:
**`unsealableCause`** (a code, e.g. `SIGNING_KEY_UNAVAILABLE`, `NOTHING_SEALABLE`; open set) — on
an INCOMPLETE entry that recorded and has no evidence item (`incompleteSessionFactOf(entry).kind
=== 'QUARANTINED'`). Read at each call from the session's audit row `SESSION_INCOMPLETE`
(`details.reason: 'UNSEALABLE'`, `details.cause`); absent when the trail holds none. Example:
`SESSION_HISTORY_UNSEALABLE_ENTRY_EXAMPLE` (contract example `listSessionHistory` 200 `unsealable`).
The replicated `sessionHistory` SLICE does not carry it (no column). For a reader of the slices:
**`unsealableCauseOf(entry, state.alerts)`** (`@dems/shared/sim`) → the entry's own member, else
`params.cause` of the alert whose `target` is the session and `params.reason` is `UNSEALABLE`,
else null (the alert list is a ring of 100: an old session reads null there and still has its
cause on operation 38). `faultKind` stays what it was: the fault that ended the RECORDING, not
the reason the seal failed.

**J2-S consistent at: see the last line of this file.**

**J2-S consistent at 09:51** (12 Oct 2026, host clock). Proof: shared whole suite 102 files / 2683 tests, core-server unit whole suite 324 files, the db files touched (7 files / 133 tests) through the project script, typecheck + lint of both workspaces, core-web typecheck - green (detail: `implementation/172_fix_wave_j2_s.md` section 7). OpenAPI regenerated: 97 operations (36 GET / 61 POST). Names are final. **The lanes are NOT restarted: the controller decides when (J2-M is on both devices); until then both Cores answer the old way.**

**lanes restarted at 10:17 by J2-M** (12 Oct 2026, host clock): lane 2 `stop 2` then `start 2 --with-camera-stub --speech-mic` (not piped, NO reset; new Core PID 4987; the camera stub has a NEW fixture account), lane 1 `stop 1` then `start 1` (no reset; new Core PID 5105). No session was open on either lane and both rigs read OFF before the stop. Both web consoles kept running. Both Cores now run the J2-S code.
