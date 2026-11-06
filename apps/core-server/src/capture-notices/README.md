# `src/capture-notices`

Up: [`src`](../README.md)

## Purpose

The no-device notices of the Core. A closed unit that owns the notifier (raises and resolves the alerts of the three no-device situations through the engine's internal warning actions), the reachability probe seam, and the pre-check gate.

## Contents

| File or folder | Role |
|---|---|
| [`index.ts`](./index.ts) | The no-device notices of the Core. |
| [`notifier.ts`](./notifier.ts) | The no-device notifier. |
| [`precheck.ts`](./precheck.ts) | The pre-check gate: what a run of `beginPrecheck` / `retryPrecheck` does before the hosted action. |
| [`probe.ts`](./probe.ts) | The reachability probe: how the pre-check and operation 97 ask the adapter layer whether a registered camera or microphone answers. |
| [`session-start.ts`](./session-start.ts) | Situation C at a session start. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `PRECHECK_REACH_UNIT`, `captureNotices`, `registerCaptureNotices`, `NoticeReportCode`, `createNoDeviceNotifier`, `ClosedSearch`, `NoDeviceNotifier`, `NoDeviceNotifierOptions`, `NoticeEngine`, `NoticeReport`, `UnreachableDevice`, `PrecheckReportCode`, `createPrecheckGate`, `PrecheckGate`, `PrecheckGateOptions`, `PrecheckGateOutcome`, `PrecheckGateState`, `PrecheckRun`, `PrecheckSearchOwner`, `PrecheckSearchSeam`, `PrecheckReachReading`, `// audit fix row 128b`, `CAPTURE_PRECHECK_PROBE_TIMEOUT_MS`, `causeOfProbeError`, `probeOfAdapters`, `AdapterProbeOptions`, `CaptureReachabilityProbe`, `DeviceReading`, `InputReading`, `MicrophoneReading`, and 8 more.
- Types exported from `index.ts`: `CaptureNotices`, `CaptureNoticesApp`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`capture-composition.ts`](../capture-composition.ts): `index.ts`
- [`modules/capture-discovery`](../modules/capture-discovery/README.md): `index.ts`
- [`modules/capture-inputs`](../modules/capture-inputs/README.md): `index.ts`
- [`modules/sessions`](../modules/sessions/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`capture-session`](../capture-session/README.md)
- [`capture/adapters`](../capture/adapters/README.md)
- [`capture/fence`](../capture/fence/README.md)
- [`engine`](../engine/README.md)
- [`plugins/authenticate`](../plugins/authenticate/README.md)
- [`plugins/logger`](../plugins/logger/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `fastify`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 6 | 2 |

2 test file(s) end in `.db.test.ts`: they need a PostgreSQL test database and run only in a DB window, not in the plain unit run.

Tests elsewhere that import it (3 folders): `src/capture-session/__tests__`, `src/capture/fence/__tests__`, `src/modules/capture-inputs/__tests__`.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
