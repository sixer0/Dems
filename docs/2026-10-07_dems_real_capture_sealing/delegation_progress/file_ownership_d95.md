# File ownership and mediation — parallel wave (decision D95, 2026-10-09)

The controller mediates every overlap. This file is the single map; it
overrides anything looser in a row brief. Rows in flight: 60, 62, 65, 67, 68,
78, 83, 84, 117, 118, 129, 134.

## 1. Exclusive owners — nobody else edits these paths

| Path | Owner row |
|---|---|
| `apps/capture-worker/**` | 60 (rows 62 part C and 134 read-only until row 60 reports complete) |
| `apps/transcriber/**`, `apps/core-server/src/modules/transcript-chunks/**` and new transcript modules | 78 |
| `packages/shared/src/sim/dataset.ts`, `packages/shared/src/api/capture.ts` | 78 |
| `apps/core-server/src/db/schema/**`, `db/migrations/**`, `db/commands/**`, `db/reset/**`, `db/seed/**`, `db/fixtures/**`, `db/mapping/**`, **`db/store/store.ts`** | 129 |
| `apps/core-server/src/capture/adapters/**` except `adapters/local/**` | 65 |
| `apps/core-server/src/capture/adapters/local/**` | 134 |
| `apps/core-server/src/capture/signer/**`, `packages/shared/src/evidence-package/**` | 83 |
| The Core credential store folder row 84 creates, `apps/core-server/src/modules/stt-config/**` | 84 |
| `apps/core-server/src/modules/system/**` | 62 |
| `apps/core-web/src/features/devices/**`, System page shell, router/navigation, `apps/core-web/src/lib/core-queries.ts`, `features/session-new/**` | 67 |
| `apps/core-web` STT settings: its OWN new files only (section component, query factory file, tests) | 117 |
| `apps/mobile` Devices, Settings screen file, Session New, navigation | 68 |
| `apps/mobile` STT status: its OWN new component + test files only | 118 |
| `apps/mobile` session-live / stop path, runtime log call sites there | 62 |

Consequences already ruled:
- Row 65 does NOT edit `db/store/store.ts`: row 129 implements both upsert rules there (`adapter_kind` and `kind` out of every SET list; `mac`, `onvif_uuid`, `profiles`, `last_seen_at` never nulled). Row 65 writes the test in its own folder.
- Row 117 hands row 67 one import + one mount line (see §3); row 118 hands row 68 the same. They do not edit the shell / screen / router / `core-queries.ts` themselves.
- Row 62 does not touch `CORE_SERVICES`; it reads what row 78 adds.

## 2. Shared files — several rows may add to them

`packages/shared/src/i18n/**`, `packages/shared/src/index.ts` and other package
export/index files, `apps/core-server/test/static/*` (count pins, allowlists),
`THIRD_PARTY_NOTICES.md`, workspace `package.json` scripts.

Rules:
1. **Edit tool only, one small additive edit at a time.** Never `Write` the whole file, never rewrite it with `sed`, `python` or a formatter, never reorder or reformat.
2. **Re-read immediately before each edit** and anchor the edit on text you just read. If the edit fails because the anchor changed, re-read and retry — do not force it.
3. **i18n:** add keys only inside your own row's namespace block (web selector `capture.*`, STT `stt.*` / as the UX spec names them, mobile equivalents); never touch another row's keys; no shared key is renamed in this wave.
4. **Count pins** (e.g. the number of units/modules in `scaffold.test.ts`): change the number by your own delta relative to what you just read (not to an absolute value you computed earlier), and add your own name to the list.
5. After your edit, run the typecheck of that workspace once; if it is red in a line you did not write, do not fix it — report it (§3).

## 3. Requests — when you need a change in a file you do not own

Do not edit it. Append ONE line to
`docs/2026-10-07_dems_real_capture_sealing/delegation_progress/file_requests.md`
with a shell append (atomic):

```
echo "| $(date -u +%H:%M:%SZ) | row <N> | <path> | <exact change wanted: text to add / line to change> | <blocking: yes/no> |" >> docs/2026-10-07_dems_real_capture_sealing/delegation_progress/file_requests.md
```

Then continue with the rest of your row behind an explicit seam. The
controller routes the request to the owner (or applies it itself when the owner
has finished) and answers by message. If the request is blocking and you have
nothing else to do, finish your report with status needs-review and name it.

## 4. Controller duties

- Routes every line of `file_requests.md`; rules on any two rows wanting the same lines.
- After each row reports: `git status` / `git diff --stat` against this map; an edit outside the owner's paths is reviewed before the next commit.
- Runs typecheck of all workspaces after each landing; a break is attributed and sent to its author.
- Commits only at points where no shared file is mid-edit.

## 5. Update 2026-10-09 16:35 WIB — row 65 landed; rows 66, 131, 135 start

| Path | Owner row |
|---|---|
| `apps/core-server/src/capture/adapters/**` (root files, `fake/`, `audio/`, `poe/`, `__tests__/static.test.ts` pinned list) | closed row 65 — changes only through the controller |
| `apps/core-server/src/capture/adapters/camera/**` (incl. `ws-discovery.ts`), the adapters static pin line for its own files, `package.json` of core-server + `package-lock.json` (sole lockfile writer of this wave) | 131 |
| `apps/core-server/src/capture/adapters/local/**` — the folder name is `local` (the spec's `local-device` is an erratum) — root files and the camera helper | 134 |
| `apps/core-server/src/capture/adapters/local/` — ONLY its own new microphone files | 135 (changes to `process-door.ts` or other row-134 files: by request) |
| `apps/core-server/src/modules/capture-config/**`, the plan builder, the hosted pair `switchAudioSource` / `setCaptureConfig` in `packages/shared/src/api/sim-actions.ts` and its simulator/engine counterparts | 66 |

Already-applied cross-row edits accepted by the controller (do not revert):
- Row 78 moved the service-count pins 16 -> 17 in `apps/core-server/src/modules/system/__tests__/*`, `apps/core-web/src/features/system/{__tests__/system-page.test.tsx,services-panel.tsx}`, `apps/core-server/src/modules/devices/__tests__/status.test.ts`, shared api examples/slices, `i18n/en/system.ts` (one key `system.services.responsibility.SVC-17`) and regenerated `openapi.json` (the 17th `CORE_SERVICES` entry, SH-09).
- Row 65 removed four lines from the `capture_devices` upsert SET list in `db/store/store.ts` (now row 129's file) and split one pinned list in `src/capture/__tests__/static.test.ts`.

Open requests held by the controller for a later small row (no owner in this wave): one assertion in `apps/core-server/src/capture/__tests__/protocol-pins.test.ts` (`CAPTURE_AAC_FRAME_SAMPLES` held to the worker's `AAC_FRAME` define); `evidence_items.labels_status` in `db/mapping/rows.ts` (decision of rows 79/83).

## 6. Update 2026-10-09 17:35 WIB — row 60 landed; row 59 starts

| Path | Owner row |
|---|---|
| `apps/capture-worker/src/**`, `Makefile`, `check.sh`, `test/static/**`, the worker's unit tests | 59 (after it: row 71) |
| `apps/capture-worker/test-fixtures/**` existing files, `test/m3worker.py`, `test/e2e.py` | closed row 60 — `test/e2e.py` and `m3worker.py` are SHARED now: rows 59 and 62 add their own cases with the Edit tool, additive only, re-read immediately before; nobody rewrites or reorders them |
| New fixture files for the SR-drift camera under `apps/capture-worker/test-fixtures/` | 62 (part C) |
| `apps/core-server/test/support/fake-onvif-stub.ts` (+ test) | closed row 60 — rows 131/142 import it; changes by request |

Routing: the mic lateness bound beyond ±5,000 ppm + out-of-range telemetry in `audio.c` (row 65's request, not built by row 60) goes to row 71, which next owns the worker's audio path. The e2e target takes the heavy-host lock itself (`E2E_NO_LOCK=1` for a caller that already holds it).

## 7. Update 2026-10-09 18:40 WIB — rows 66, 131, 79, 72, 67, 68, 83, 84, 129a landed; rows 132, 133, 142 start

Contract landing rule (decision D106): **row 132 lands the shared contract for ALL five operations 93-97 in one change** — registry entries, schemas, simulator answers, OpenAPI regeneration and every count pin (final totals 97 operations / 36 GET / 61 POST / 67 audit types / offline 31; Try-it deny list 10; access condition `WEB_CONSOLE_SESSION`). Rows 133 and 142 add NO registry, schema, simulator, OpenAPI or count-pin edit: they build server-side behind those entries. Row 132 writes the marker file `docs/2026-10-07_dems_real_capture_sealing/delegation_progress/contract_93_97_landed.md` (one line: done + the totals it measured) the moment that part is in the tree; rows 133 and 142 work on their internals until it exists.

| Path | Owner row |
|---|---|
| `packages/shared/src/api/**` entries for ops 93-97 (+ `sim/**` answers, `openapi/openapi.json`, pins in every workspace), new module `apps/core-server/src/modules/capture-discovery/**` (ops 93, 94: search, candidate store, rate limits, the 409 during RECORDING and its lift), the camera adapter's barrel export | 132 |
| Op 97 route (`rescanCaptureInputs`), the no-device notifier (search empty, pre-check unreachable), the pre-check search hook and the shared `PRECHECK_ORDER` move to the role-keyed mic pair (web + mobile follow by request) | 133 |
| Ops 95, 96 routes and the op 89 route (in `modules/capture-discovery` subfolder `connect/` or `modules/capture-config` — 142 says which and owns the credential path there), `apps/core-server/src/capture/adapters/camera/onvif-session.ts` (the ONLY importer of the `onvif` package), the lock-out guard | 142 |
| `apps/core-server/src/modules/capture-config/**` otherwise | closed row 66 — by request |

Held for the integration pass (one small agent after this wave): static pins naming rows 134/135's files; row 65's static block A-5 (red by design now that the adapter layer is imported); `captureConfigFromRow` mic order in `db/mapping/rows.ts` + the describe text in `state-slices.ts`; `labels_status` / `manifest_version: 2` in the item mapping; `CAPTURE_AAC_FRAME_SAMPLES` pin; the fake ONVIF stub binding distinct loopback addresses for several devices; `captureDurable` in the shared session schema (with row 71).

## 8. Update 2026-10-09 20:45 WIB — rows 132, 133, 142, 136, 135, 119, 116, 115, 73, 72 landed; 137, 138, 141 and integration passes C1, C2 start

Schema is at version 5 / `dbc-6` (42 tables). Shared contract: 97 operations / 36 GET / 61 POST / 67 audit types; `registerCaptureDevice` INTERNAL action; `CaptureDeviceStatusSchema` has optional `adapter` / `sourceClass`.

| Area | Owner row |
|---|---|
| `apps/core-web/src/features/devices/**` (search, candidate list, connect dialog, notifications, development label), Try-it list | 137 |
| `apps/mobile/src/features/devices/**`, `features/capture-selector/**`, mobile notifications for flows 9-13, `apps/mobile/src/runtime/sim-adapters.ts` | 138 |
| verify / finalizing / evidence-verdict feature folders in web and mobile | 87 (in flight) |
| `packages/shared/src/evidence-package/**`, `packages/shared/src/evidence-verify/**`, `apps/core-server/src/evidence-verify/**`, the op 41 response schema in `packages/shared/src/api/**` (members `sources`, `transcriptState`, per-check report) + its simulator answer + OpenAPI regeneration | 141 |
| `packages/shared/src/api/**` otherwise (mic id rule, `captureDurable` in the session schema, `EvidenceItem` members `manifestVersion?` / `labelsStatus?`, describe texts), `apps/core-server/src/modules/capture-config/index.ts` (two registry lines), `apps/core-server/src/modules/capture-discovery/**`, `capture-notices/**`, `capture-inputs/**` for held requests | C1 |
| `apps/core-server/src/capture/adapters/local/**`, `capture/fence/**`, `apps/core-server/test/support/fake-onvif-stub.ts`, the loopback guard of the camera adapter tests | C2 |
| `apps/capture-worker/**`, `packages/capture-protocol/**`, supervisor record handling | 59 (in flight) |

OpenAPI / lockfile: 141 and C1 both regenerate `openapi.json` — each takes `/usr/bin/lockf -k .locks/npm.lock`, re-reads the file first and regenerates from the registry (the generator is deterministic; the second writer simply includes the first one's entries). Count pins move by delta.

## §9 Wave D (decision D133, 2026-10-09, after the pause)

Everything landed before commit `e296ce7` is CLOSED unless listed here. A line you need in a closed or foreign file = a request in `file_requests.md`. Declare your exact paths in `file_claims.md` before the first write.

| Owner | Area |
|---|---|
| row 61 | core-server boot checks and capture-mode boot refusals (`src/boot/**` or where the boot steps live), `src/config.ts` capture keys, the static-rule TESTS for `capture/` and `capture-worker/` (`test/static/**`, `apps/capture-worker/test/static/**`, `check.sh` static part), storage volume check. NOT the worker's C sources (row 71a) |
| row 71a | `apps/capture-worker/src/**` (audio switch, mic lateness report, first-GOP / held-first-frame rule, clock gap), `apps/capture-worker/test/**` except `test/static/**`, `packages/capture-protocol/**`. Writes `delegation_progress/contract_71a_protocol_landed.md` when the protocol part is in |
| row 71b | `apps/core-server/src/modules/sessions/**`, `src/capture/supervisor.ts` + `src/capture/index.ts` consumers, the capture blocks of `src/engine/host.ts` (capture transitions, fault lifecycle, `captureDurable`), `session_capture_sources` writer, op 81 route, audit `AUDIO_SOURCE_SWITCHED` |
| row 82 | `apps/core-server/src/sealing/**`, `src/modules/recording-fragments/**` (mounting), the SEAL blocks of `src/engine/host.ts` (`applySealingProgress` / `completeSeal`), `packages/shared/src/sim/session-machine.ts` (v2 seal), RECOVERY resume, `packages/shared/scripts/gen-demo-evidence.ts` |
| pass D1a | `apps/core-server/src/modules/capture-discovery/**`, `src/capture/adapters/camera/**` + `adapters/__tests__/credential.test.ts`, `src/credential-store/**`, the capture rows of `src/core/audit-details.ts`, `packages/shared/src/redaction/**`, `src/modules/rbac/**` (matrix rows of ops 89 / 95 / 96 only), `test/db/set4-rules.test.ts` |
| pass D1b | `packages/shared/src/api/**` and `src/sim/**` (except `session-machine.ts`), `openapi.json` (generator only), `apps/core-server/src/modules/capture-config/**`, `src/modules/devices/**`, `src/db/reset/**`, `apps/core-server/src/evidence-verify/**` + `packages/shared/src/evidence-verify/**` (layout only), `test/acceptance/contract.test.ts`, `test/db/device-upsert.db.test.ts`, MODG route-list tests |
| pass D2 | `apps/core-web/src/features/devices/**`, `features/dashboard/**`, `features/system/**` (WB-07 link); `apps/mobile/src/features/capture-selector/**`, `features/devices/**`, `features/session-live/**` + `features/dashboard/**` (badge mounts only) |
| pass D3 | `apps/core-server/src/capture/adapters/local/**`, `src/capture/fence/**` |
| row 90 | NEW `apps/core-server/src/modules/media-stream/**` (or the name it claims), op 88 route, `mts_` log-blanking entries |
| row 91 | NEW `apps/core-server/src/modules/evidence-export/**` (or the name it claims), ops 42 / 87 routes, composite |
| row 92 | `apps/core-web/src/features/evidence/**`, `apps/mobile/src/features/evidence/**` (incl. the `verify-v2` tests of row 87), transcript revise UI |

Shared hot files, section rule (re-read immediately before each edit, exact-string Edit, touch only your own block, never reformat): `apps/core-server/src/app.ts` (one mount line per module), `src/engine/host.ts` (71b capture blocks, 82 seal blocks), `packages/shared/src/sim/api.ts` (D1b writer; others request), `packages/shared/src/i18n/en/*.ts` (append-only blocks), `apps/core-server/test/static/*` file-list pins (by delta).
Single-writer resources: OpenAPI generator under `.locks/npm.lock` (D1b; rows 90 / 91 regenerate only if they add response members, same lock); migrations: NONE planned — a row that needs one stops and asks; heavy host lock for any run that starts the worker.
