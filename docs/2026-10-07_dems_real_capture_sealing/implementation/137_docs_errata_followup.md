---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-10
agent: coder-execution (documentation errata follow-up)
scope: documents only - three specifications under masterplan/ plus this note; no code, no test, no script, no README, no git write, no lane
status: needs-review
---

# 137 - Documentation errata follow-up (PE-FX-02 correction, pass J members, evidence-spec defects, simulator scope)

Documents only. Edited: `masterplan/03_api_contract.md`, `masterplan/06_evidence_package_spec.md`,
`masterplan/08_client_ux_spec.md`. Created: this note. Nothing under `apps/*/src`, `packages/*/src`,
`scripts/`, any test, the README, `decisions/decisions.md`, `status_tasks.md`, the tracking table of
`02_plan.md`, `delegation_progress/*` or note 136 was edited. No command of the product, no suite, no
lane was run; no git write (only read-only `git diff` / `git status` to check the edits).

Convention continued from note 136: ids unique across the specs (`PE-WI-19` onward), each erratum in
place with its decision and implementation note, a line in the "Errata index (fix passes of
2026-10-10)" of its file, a mention in the file's `last_updated`. No earlier sentence was deleted: a
changed table row keeps its text and gains the erratum; the superseded `PE-FX-02` clause stays
where it stands and is marked superseded by `PE-WI-19`. Every `file:line` below was read in the tree
before it was written.

Sources read: notes 120 (sections 1-3), 135, 136; decision D218 (and D206, D203, D199, D202, D209, D217);
`delegation_progress/file_requests.md` line of 10:20:55Z (wave H driver A to "spec owner"); the code named
in the "Source" column.

## 1. Errata

### `masterplan/03_api_contract.md` (6)

| Erratum | Section | What changed | Source |
|---|---|---|---|
| PE-WI-19 | §2.4, after PE-FX-02; pointer in §5.3 row `RECOVERY_STARTED` | CORRECTS PE-FX-02: the failed-seal retry of operation 33 writes one `RECOVERY_STARTED` row, `details { reason: SEAL_RETRY, cause, step, faultKind }`, actor = the asking operator; none when a run is already under way; still `202` + `FINALIZING`, still no boot recovery. Old clause kept, marked superseded | D218 (4), D186 (8); `sealing-host/index.ts:150-158`, `:308`, `:569-579`; `engine/sealing-notice-doors.ts:34`, `:119-137`; `modules/sessions/routes.ts:306-312`; `modules/sessions/__tests__/recover-failed-seal.db.test.ts:85-89` |
| PE-WI-20 | §6 Realtime slices | `security.platformNotReported?: true`; required members keep placeholders and are not readings where it is present; who sets it; readers still fed by the placeholders | D217 (7), D218 (1); note 135 §0, item 1; `api/state-slices.ts:617`, `:265`; `engine/host.ts:998-1002`; `sim/core-facts.ts:160-195`; `sim/engine.ts:233`; `sim/health.ts:196-197`; `sim/devices.ts:93`; `sim/maintenance.ts:99-102`; `modules/devices/status.ts:271` |
| PE-WI-21 | §6 Realtime slices; new row in §5.3 | `coreNotRunning?: true` on `session.fault` and `faults.active[]`; same key in open maps (alert and event `params`, `FAULT_RAISED` / `FAULT_CLEARED` / `SYSTEM_BOOT` `details`, timeline `params`); kind stays `POWER_FAIL`; member, not cause | D217 (5), D218 (3); note 135 §0, item 2; `api/state-slices.ts:342`, `:936`, `:266`; `sim/faults.ts:282-283`, `:304-327`, `:405-419`, `:531-540`; `sim/session-machine.ts:1666-1680`, `:1692-1701`; `engine/rehydrate.ts:368`; `db/mapping/rows.ts:363` |
| PE-WI-22 | §4, row `NOT_READY` (503) | The start's `details.reason` (the two session-key values of PE-WI-02) is carried to the clients; the old "starting" wording named as the defect; `CAPTURE_HELPERS_LEFT` named as still open | D217, D218; note 135 item 7; `client/core-client.ts:381`; `live/errors.ts:52`, `:63`, `:77`; `live/source/rebuild-error.ts:107`; `sim/start-refused.ts`; `core-web/src/lib/core-errors.ts:149`; `core-web/.../session-new/index.tsx:397`; `mobile/.../session-new/use-session-new.ts:205` |
| PE-WI-23 | §5.3 Changed audit rows (new row) | Simulator integrity rows (`FRAME_HASH`, `WRITE_VERIFIED`, `TIMESTAMP_CONFIRMED`) are held while a start is not durable; written at their scheduled times once it is; none for a failed start | D217, D218; note 135 item 5; `sim/generator.ts:247-252` |
| PE-WI-24 | §2.6, paragraph after the simulator table | Item 4 of the task: the paragraph "The simulator's devices carry `adapter: FAKE`, `sourceClass: DEVELOPMENT`" is TRUE of two things only (op 94 candidates, op 96 device `CAM-03`, in the in-app simulator) and is not general: built-in devices carry neither member, op 97 neither, a SIMULATED Core states none on any operation (op 93 `503`) | D196, D206 (1) (2), D218; `api/capture-discovery.ts:719-764`; `sim/capture-registry.ts:72-73`; `sim/api.ts:1420`, `:1482`; `sim/initial-state.ts:96-154`; `sim/types.ts:688-697`; `core-server/src/modules/devices/__tests__/simulated-no-source-class.db.test.ts` |

### `masterplan/06_evidence_package_spec.md` (8)

Basis: the 10:20:55Z request names the fields and points to note 120 section 3 for the detail; each
statement of built behaviour below was confirmed by reading the named code, not taken from the note.

| Erratum | Section | What changed | Source |
|---|---|---|---|
| PE-WI-25 | §B.2, field 13 | `sealedAt` = the instant BUILD_MANIFEST froze the manifest = `signature.signedAt`; not the end of `STORE_SEALED_PACKAGE` | D203, D218 (5); `sealing/pipeline/pipeline.ts:750`, `:765-770`, `:840`; `sim/session-machine.ts:1455`, `:1479`, `:1520` |
| PE-WI-26 | §B.2, fields 17-19 | `RTC` / `HOST_SYSTEM_CLOCK` / `[]` from the constant `CORE_TIME_SOURCE`; no network-time module; enumeration and schema not widened; `SYSTEM_CLOCK` proposal not adopted; `start_time_source` not the source | D203 (1), D218 (5); `sealing-host/session-reader.ts:39-40`, `:105`, `:380`; `shared/evidence-package/manifest.ts:114-116` |
| PE-WI-27 | §B.3, fields 22 / 23 | Literal `NOT_CONFIGURED` in every package; schema stays not-null text; the open clause of PE-WH-08 closed (pointer added there) | D209, D218 (5); `session-reader.ts:107`, `:382`; `config.ts:60-61`; `manifest.ts:124-125` |
| PE-WI-28 | §B.4, fields 38 / 39 | Model / firmware by the adapter kind of the slot's START row: `FAKE`, `LOCAL_DEVICE`, other (registry row else `NOT_REPORTED`); table | D203, D218 (5); `session-reader.ts:111-114`, `:340-346`; `manifest.ts:146-147` |
| PE-WI-29 | §B.4, field 40 | Worker's measurement, else adapter's report, else 0; integer not null; 0 does not tell "measured 0" from "not measured"; nullable proposal not adopted (open) | D218 (5); `session-reader.ts:81-85`, `:118`, `:351`; `manifest.ts:148` |
| PE-WI-30 | §B.5, field 53 | `audio.codec` is the constant `STAND_INS.audioCodec`, not read from the file or the worker | D218 (5); `session-reader.ts:119`, `:386`; `pipeline.ts:739` |
| PE-WI-31 | §B.6 (field 73) and field 100 of §B.8 | `interrupted` also true on every fragment of a camera-given-up file, per track; `timeline.interrupted` (15) stays the session's; `endedTracks` key of the CLOSE_TRACKS checkpoint; no new field | D202, D203, D218 (5); `pipeline.ts:511-515`, `:636-642`, `:656`, `:691`, `:715`; `session-reader.ts:359-363`, `:392` |
| PE-WI-32 | §B.8 (fields 95-101) | `sealing.steps[]` holds the three steps done before BUILD_MANIFEST, not one per step of §E | D218 (5); `pipeline.ts:645-659`, `:765-770`; `sealing/pipeline/contract.ts:46` |

### `masterplan/08_client_ux_spec.md` (6)

| Erratum | Section | What changed | Source |
|---|---|---|---|
| PE-WI-33 | §4.5 (flow 3), after PE-WI-14 | A blocked seal turns the web pill and the tablet / phone Home status CRITICAL by the Core's alert; pill second line "Sealing is blocked"; checklist row `recording` critical. Removes the LIMIT of PE-WI-14 | D217, D218; note 135 item 4; `core-web/.../shell/integrity-checks.ts:42`, `:46-56`, `:97-98`, `:113-114`; `i18n-web.ts:59-60`; `mobile/.../dashboard/use-home-data.ts:60-62` |
| PE-WI-34 | §8.5 (flow 7) | Label "Core was not running" and its sentence wherever the restart fault is named, web and tablet / phone, from the member; limits not built | D217 (5), D218 (3); note 135 item 2; web `integrity-checks.ts:90-91`, `:108`, `:115`, `status-banner.tsx:32-34`, `timeline-panel.tsx:84`, `security-audit/model.ts:187-188`, `:231`, `audit-log-panel.tsx:432`; mobile `use-home-data.ts:64-73`, `session-recovery-screen.tsx:594-596`, `hub-top.tsx:76`, `:132`, `session-finalizing-screen.tsx:444-446`, `use-audit-data.ts:89-90`, `audit-entry-detail.tsx:49`; `shared/i18n/en/common.ts:1114-1117`; `devices/sim-adapter.ts:181` |
| PE-WI-35 | §8.5 (flow 7) | "Not reported" for TPM / Secure Boot / posture read from the Core's member on web (strip, card, header, Security & Audit, About) and mobile (Home chip, About); replaces the client-side rule of PE-WI-16; the posture column is no longer open; placeholder-fed lists named as open | D217 (7), D218 (1); note 135 item 1; web `status-strip.tsx:39-40`, `:103-104`, `security-panel.tsx:135-169`, `:219-227`, `dashboard-model.ts:171-177`, `integrity-checks.ts:125-136`, `security-audit/status-banner.tsx:16-30`, `:63`, `model.ts:333-380`, `controls-panel.tsx:77-81`, `about-panel.tsx:91-92`; mobile `home-model.ts:413-436`, `use-home-data.ts:197`, `:211`, `about-section.tsx:25`, `:40-41`; `shared/i18n/en/common.ts:1122-1128` |
| PE-WI-36 | §8.5 (flow 7) | Mobile Network & Time names a host clock "Host system clock" (no "RTC (holdover)", no holdover toast); web Storage "session size" = durable bytes of the capture checkpoints, a dash with the label "No durable recording data yet" when none. Closes the two OPEN clauses of PE-WI-16 | D217, D218; note 135 item 3; mobile `network-time-model.ts:154-172`, `time-sync-card.tsx:49-72`, `system-time-card.tsx:46`, `:55`, `use-network-time.ts:83-102`; web `storage/kpi-cards.tsx:37-44`, `:88-94`; `i18n-web.ts:45`; `shared/i18n/en/common.ts:1134-1138` |
| PE-WI-37 | §8.5 (flow 7) | The refused-start sentences (both quoted) under the start-failed title, web and mobile; pre-check not concerned; `CAPTURE_HELPERS_LEFT` still open; the toast itself is not proven by a test | D217, D218; note 135 item 7; `shared/i18n/en/common.ts:1144-1148`; `core-web/.../session-new/index.tsx:397-399`; `mobile/.../use-session-new.ts:205-208`, `:300`; `mobile/.../session-new/i18n.ts:59`; `shared/i18n/en/session-new.ts:179` |
| PE-WI-38 | §14.2 key `common.captureConnect.noPasswordNeeded` (and §8d.3 row) | The shared key now holds the ruled sentence, equal to the web hint; PE-WI-12's open clause closed; the web hint line moved from `:74` to `:76` | D217 (4), D218; note 135 item 6; `shared/i18n/en/common.ts:778`; `core-web/src/i18n-web.ts:76` |

One edit beside the erratum paragraphs: `PE-WH-08` (evidence spec) gained the sentence "Closed since by PE-WI-26
and PE-WI-27" after its "open request line" clause (additive).

## 2. How note 136's open items are closed (note 136 not edited)

| Note 136 open item | Closed by |
|--:|---|
| 2 (evidence spec 13, 17-19, 22 / 23, 38-40, 53, 73, B.8) | PE-WI-25 .. PE-WI-32 (what stays open: section 3, items 5-7) |
| 3 (PE-FX-02 against the code) | PE-WI-19 |
| 4 (C3 §2.6 simulator devices) | PE-WI-24 |
| 5 (`noPasswordNeeded` key) | PE-WI-38 |
| 8 (mobile "RTC (holdover)"; web Storage session size; Security Posture column; `tpm.ok: true`) | PE-WI-36, PE-WI-35, PE-WI-20 (the placeholders are the ruled state; three readers still fed by them: open item 8 below) |
| 6, 7 | not touched by this pass; unchanged (D217 (6), (5)); PE-WI-21 and PE-WI-34 state the `CORE_STOPPED` limits |

## 3. Open items

| # | Item | Why open |
|--:|---|---|
| 1 | Item 3, request line 10:20:55Z, everything confirmable was applied. Not applied, by choice: none of the note-120 PROPOSALS (field 17 value `SYSTEM_CLOCK`; fields 22 / 23, 38 / 39, 40 nullable; field 53 read from the file) | They are schema or code changes, not built behaviour. PE-WI-26 / 27 / 28 / 29 / 30 state them as not adopted. The type columns of the field tables are unchanged |
| 2 | PE-WI-30: "true by the worker's design (OD-06)" is taken from note 120; the worker source was not read for it (only `apps/capture-worker/build/skeleton111.c:48` states AAC-LC 48 kHz mono, a build skeleton) | The erratum states the constant as built; the reason it is true is the worker's, not verified here |
| 3 | PE-WI-25 sources `evidence_items.sealed_at` from the completion input (`session-machine.ts:1455`, `:1479`) | Read in the simulator's transition; the database column mapping (`db/mapping/rows.ts:509`) was seen, the row writer of the real Core was not traced |
| 4 | PE-WI-33: Home status RING turning critical is read from the state key (`use-home-data.ts:60-62`); the component that draws the ring from that state was not read | Client rendering is a gate check; the clients' tests are note 135's |
| 5 | C3 lines 586 and 698 (erratum PE-128-25): "in `SIMULATED` the seeded `FAKE` built-ins are listed as today" | Older than D206 (1); read with PE-WI-24 it means the stored kinds, not a member on the wire. Not edited: a decision on the wording of PE-128-25 belongs to the C3 owner |
| 6 | The old index row of `PE-FX-02` in the C3 index still reads as before | Additive rule: PE-WI-19 has its own index row and says it corrects PE-FX-02. The row was not rewritten |
| 7 | README, `02_plan.md` tracking table, `status_tasks.md`, `99_implementation_report.md`, `decisions/decisions.md`, `file_requests.md` (the 10:20:55Z line is not marked done) | Outside the three documents and this note by the task's rule. The README holds no sentence on `holdover`, `noPasswordNeeded`, `SEAL_RETRY`, the pill or `platformNotReported` (searched), so nothing in it contradicts these errata |
| 8 | Still open as code (named in the errata): readers fed by the platform placeholders (web Devices "other devices" TPM, mobile Devices, self-test line, `getDeviceStatus` `tpmOk`); `CAPTURE_HELPERS_LEFT` shown as "starting"; history entry / interrupted-seal cause for the restart fault; web Devices AC port; no gate has driven any of the client surfaces (re-gates 70 and 75 have not passed) | Notes 135, D217, D218; every client erratum above says "not yet gate-verified" |

## 4. Checks

No validation command applies to markdown; none was run. Checked by reading: every removed diff line
of the three files this pass touched reappears inside an added line (table rows and `last_updated`
lines extended, none deleted: in the evidence spec 11 field rows (13, 17-19, 22, 23, 38-40, 53, 73) and
one `last_updated` line; in the UX spec one row (§14.2) and one `last_updated` line; in the C3 spec
the `NOT_READY` and `RECOVERY_STARTED` rows and one `last_updated` line - the other removed lines in
the working-tree diff are note 136's rows, uncommitted). Every id `PE-WI-19..PE-WI-38` was counted by
`grep`: one index row in the index of its file, and one erratum paragraph or, for PE-WI-22, -23 and
-38, one table row / cell that carries it. No emoji. The contract totals (97 / 36 / 61 / 67, 30
slices) are unchanged and PE-WI-20 / 21 say so.

---
*Generated: 2026-10-10*
