---
task_id: 2026-10-21_bare_metal_bench
task_slug: bare_metal_bench
row: 90P (part b of the D53 plan: live preview core + API, idle-meter wiring)
date: 2026-10-23
agent: coder-execution
source_plan: controller plan zany-hugging-hippo.md (D53); decisions D51, D53
status: needs-review
---

# Implementation Report: live camera preview (core + API) and idle-meter wiring

Status is `needs-review`, not `complete`. The code is written, typechecked and unit-tested. Three things still need the controller: the web test that pins the old aria text, the parts that were only shown with doubles (see Persistent Issues), and a review (recommended).

## Executed Steps
| Step | Task | Status | Notes |
|---|---|---|---|
| 1 | Shared contract: ops 112 `createCameraPreviewSession`, 113 `holdIdleMeters`, schemas, AuditType `CAMERA_PREVIEW_OPENED`, `cps_` prefix + redaction, i18n | done | openapi.json regenerated with `npm run openapi:gen -w @dems/shared` |
| 2 | Credential reader: third holder `CAMERA_PREVIEW` / `previewOpen(deviceId, operatorId)`, reason `PREVIEW_OPEN` | done | the holders file takes it once |
| 3 | `preview-pipeline.ts` (the steps of openSource) | done | starter is injected; bound to agent (a)'s `startCameraPreview` in the composition |
| 4 | `preview-manager.ts` (bounds, linger, yield/resume, restart limit, auth stop, mpjpeg parser) | done | logs nothing itself |
| 5 | `src/camera-preview` unit + `modules/camera-preview` (op 112, op 113, `GET /preview/:token`) | done | registered in app.ts |
| 6 | Access rule entry 5 `CAMERA_PREVIEW_ROUTE_URL` (rule of op 112) | done | |
| 7 | Composition: manager, yield/resume hooks, idle meters (agent c), the API provision | done | |
| 8 | vite proxy `/preview` with the same blanking of signed paths | done | |
| 9 | Pin tests moved by delta, new tests | done | |

## Changes Made
| File | Change Type | Description |
|---|---|---|
| packages/shared/src/api/devices.ts | modify | `CAPTURE_PREVIEW_OPERATIONS` (112, 113), `CameraPreviewSessionSchema`, `IdleMeterLeaseSchema`, `CAPTURE_PREVIEW_SCHEMAS`, reasons `PREVIEW_LIMIT` / `PREVIEW_NOT_AVAILABLE` / `IDLE_METERS_NOT_AVAILABLE`, `CAMERA_PREVIEW_LIMITS`, `CAMERA_PREVIEW_PICTURE`, examples; the op 77 sentence (a source is asked only at pre-check/start/re-scan) updated |
| packages/shared/src/api/core-api.ts | modify | appends ops 112-113 and their two schemas (111 -> 113 ops, 39 GET / 74 POST) |
| packages/shared/src/api/capture.ts | modify | `CAMERA_PREVIEW_TOKEN_PREFIX = 'cps_'`, `CAMERA_PREVIEW_SESSION_TTL_MS = 60000`, `IDLE_METER_LEASE_MS = 30000` |
| packages/shared/src/api/redaction.ts | modify | `cps` added to the token and Bearer rules |
| packages/shared/src/sim/vocabulary.ts | modify | AuditType `CAMERA_PREVIEW_OPENED` (86 -> 87), category DEVICE |
| packages/shared/src/i18n/en/common.ts | modify | label of the new audit type |
| packages/shared/src/i18n/en/devices.ts | modify | `devices.preview.{connecting,live,pausedForRecording,unavailable,limit,aria}`, `devices.audio.{idleLevel,idleUnavailable}`; OD-12 texts (selector doc comment, `selector.noPreview`, `noPreview.aria`) no longer say there is no live preview (`noPreview.title` kept 'No preview') |
| packages/shared/openapi/openapi.json | regenerate | 113 operations |
| packages/shared/test/{api-registry,api-capture-commissioning,api-capture-discovery,api-domain-operations,api-examples,api-installation-acceptance,api-openapi-scope,api-stt-config,api-text-rule,i18n-vocabulary-sync,openapi}.test.ts | modify | pins moved by delta (+2 ops, +2 POST, +2 schemas, +1 audit type, +2 any-of, +2 paths) |
| packages/shared/test/redaction-preview-token.test.ts | add | `cps_` blanking + schema form |
| apps/core-server/src/capture/adapters/camera/preview-pipeline.ts | add | `createPreviewOpener` |
| apps/core-server/src/capture/adapters/camera/preview-manager.ts | add | `createPreviewManager`, `createMpjpegParser` |
| apps/core-server/src/capture/adapters/camera/__tests__/preview-{pipeline,manager}.test.ts | add | unit tests |
| apps/core-server/src/capture/fence/index.ts | modify (additive) | re-exports the preview, the idle meters, `startCameraPreview`, `startProductionPipeline`, `createAlsaConfigWriter`, `CAPTURE_RUN_SUBPATH` for the composition |
| apps/core-server/src/capture-composition.ts | modify | preview manager (12), idle meters (13), API provision (14); camera bundle `stream` yields first; audio bundle `registered` stands the idle meters down while a session is active; relay hub push -> resume; capture end -> resumeAll; pre-check probe wrapper; 1 s session-edge watch; `productPreviewStarterOf` |
| apps/core-server/src/camera-preview/{service,index}.ts | add | handlers, in-process token map, stream, `cameraPreview(app)` control |
| apps/core-server/src/modules/camera-preview/index.ts, __tests__/routes.test.ts | add | route registration + route tests |
| apps/core-server/src/app.ts | modify | registers `modules/camera-preview` |
| apps/core-server/src/modules/capture-config/credential-reader.ts, credential-holders.ts | modify | third holder |
| apps/core-server/src/core/audit-details.ts | modify | reason `PREVIEW_OPEN`; detail list of `CAMERA_PREVIEW_OPENED` (deviceId, expiresAt, operationId, permission?) |
| apps/core-server/src/plugins/permission-guard/access-rules.ts, index.ts | modify | entry 5: `CAMERA_PREVIEW_ROUTE_URL = '/preview/:token'`, `CAMERA_PREVIEW_STREAM_ID`, `cameraPreviewStreamRuleOf` |
| apps/core-server/src/db/fixtures/operations.ts | modify | one `CAMERA_PREVIEW_OPENED` row (each audit type needs a fixture row) |
| apps/core-server tests: writers, audit-details fixture, credential-reader, capture-config static (R-5/R-6), access-rules, decision, guard, matrix, registered-routes, without-domain-modules, test/static/imports (closes `src/camera-preview`), capture static (app.ts waived lines), adapters static (A-9 entries, A-10 (c)/(d) entries for preview-pipeline), capture-composition (+2 cases), devices routes area pin | modify | pins by delta + new cases |
| apps/core-web/vite.config.ts, src/test/dev-proxy-blanking.test.ts, src/test/live-runtime-static.test.tsx | modify | `/preview` proxy entry with `blankSignedPathOnProxyError`; tests |

No DB migration: `audit_log_type_check` is a pattern (`code(t.type)`, `db/schema/audit.ts:75`), not a list of allowed values.

## Test Results
| Test Type | Command | Result | Notes |
|---|---|---|---|
| typecheck shared | `npm run typecheck -w @dems/shared` | 0 errors | |
| typecheck core-server | `flock .data/locks/heavy-host.lock npm run typecheck -w @dems/core-server` (NODE_OPTIONS 6144) | 0 errors | |
| typecheck core-web | `npm run typecheck -w @dems/core-web` | 0 errors | |
| shared contract | `npx vitest run test/api- test/openapi test/i18n test/redaction test/live-source` | Test Files 35 passed (35) | |
| core-server own + pins | `npx vitest run --project unit` on 18 paths (own tests, statics, guard, writers, fixture, composition, media, devices) | passed 962, failed 6, total 969 | before the devices pin fix; the devices pin was fixed afterwards, then 1 passed (1) |
| core-server own files | 7 files (preview-manager 16, preview-pipeline 11, routes 10, credential-reader 23, access-rules 38, writers 165, composition) | Test Files 7 passed (7); Tests 345 passed, 1 skipped (346) | |
| core-web | `npx vitest run src/test/dev-proxy-blanking.test.ts src/test/live-runtime-static.test.tsx` | 2 passed | |
| core-web tile | `src/features/devices/__tests__/camera-no-preview.test.tsx` | 5 failed | pins the old aria sentence 'This build shows no live preview.' (see Persistent Issues) |
| db tests | not run | - | brief: never run `*.db.test.ts` |

## Verification
- Ops 112/113 in the registry, the openapi file and the typed client: the shared suite and api-openapi-scope AC-B-11 (byte-equal openapi.json) pass.
- The order in which a preview open is refused (no starter, no stream, stream read fails, address refused, no rule, all before the reveal; then reader, locator, starter, `started`, first end): preview-pipeline.test.ts.
- The credential never appears in the handle, in an error or in the starter's printed request: preview-pipeline.test.ts.
- Bounds 1/2/4/8, 429 limit, the 5 s linger, yield resolves only after stop+reap, resume, 60 s pause cap, 3 restarts in 5 min, AUTH_REFUSED ends at once and is refused again within the window, the parser on parts split at every byte: preview-manager.test.ts.
- Token bound to operator + sign-in session; 60 s expiry; ANY_OF on the operation and on the route; 429; the stream is cut when the sign-in session ends (10 s check); the token is never logged: routes.test.ts.
- Rule entry 5 of the rule book: access-rules.test.ts.

## Persistent Issues
| Issue | Attempts | Root Cause | Current Status | Blocking? |
|---|---|---|---|---|
| `apps/core-web/src/features/devices/__tests__/camera-no-preview.test.tsx:66` expects 'This build shows no live preview.' | 0 (not my file) | intended text change `devices.noPreview.aria` -> '{{name}}. The live preview is not open. {{state}}' | open: the web UI owner should change the expected sentence (or the controller does) | no for the core |
| `src/capture/__tests__/static.test.ts` 744, 1112, 2102, 2677 red | 0 | pre-existing LCD work (D28), per the controller | left red | no |
| `src/db/fixtures/__tests__/audit-details.test.ts:247` (DIAGNOSTICS_COMPLETED severities) red | 0 | it was already red in my first run, before I edited the fixture; root cause not examined | open | unknown |
| Not shown on real hardware | - | unit tests use doubles only | the real starter `startCameraPreview`, ffmpeg mpjpeg on the bench, idle meters with a card, and two RTSP clients on one camera during a recording are not proven | yes, for the live test |

## Issues & Decisions
| Step | Issue / Decision | Resolution |
|---|---|---|
| 1 | `holdIdleMeters` has no row, but a POST may not use NONE-R (registry rule API-2) | used `NONE-P`; the NONE-P pin now lists it with a comment. Controller may prefer another marker |
| 1 | 429 is an envelope-level answer in this contract | `429 RATE_LIMITED` with `details.reason: PREVIEW_LIMIT` (no new error code: 40 codes unchanged) |
| 1 | op 113 answers 200 `{expiresAt}` (the brief allowed 204 or that) | 200 |
| 3 | The preview's stored profile | the camera's smallest stored stream (`ORDER BY width ASC NULLS LAST`), with its stored codec |
| 4 | AUTH_REFUSED followed by a new viewer | refused for the 5 min window (`wouldRefuse` -> AUTH_REFUSED, op 112 answers 409 `cause: AUTH_REFUSED`), so a viewer cannot feed the camera's lock-out |
| 7 | The pre-check hook | the composition provides a probe through `captureNotices(app).provideProbe` that yields the camera, then calls the fence's probe of that moment. Difference: before the fence boot step this probe answers "unreachable" instead of "no probe" (no request is served then) |
| 7 | Session CREATE / SEALED for the idle meters | no event exists, so a 1 s watch of `isSessionActive(engine.state().session)` calls `stopAndWait` on idle->active and `resume` (plus `preview.resumeAll`) on active->idle. The audio bundle's `registered` also calls `stopAndWait` while a session is active (before the session's audio opens a card) |
| 7 | Resume of the preview during a recording | on the hub's established push (a report without `leg`), as specified, so the preview runs beside the recording as a second RTSP client |
| 5 | Preview state for the UI | `PreviewManager.states()` exists, but no route reads it yet (not in the brief). The UI sees CONNECTING until the first frame and the stream ends on UNAVAILABLE |
| - | Files outside the listed ownership that I had to touch | fence/index.ts (re-exports), credential-holders.ts, app.ts, db/fixtures/operations.ts, the permission-guard test helper, and the static pin tests (with additive entries; the controller said I am now the single writer of the adapters static test) |

## Next Steps
- Controller: decide on the web test pin; review recommended (security: token map, the stream cut, the credential reader's third holder, the pre-check probe wrapper).
- Live test on the bench: open op 112 and the stream through `/preview`, run a recording beside it, check the yield (stop+reap before openSource) and the resume after PUSH_ESTABLISHED.
