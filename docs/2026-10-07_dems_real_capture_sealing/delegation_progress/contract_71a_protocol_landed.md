# Contract marker — capture protocol version 4 (row 71a) is in the tree

Status: **PROTOCOL PACKAGE LANDED** 2026-10-09 22:06 WIB — `packages/capture-protocol/src/index.ts`
(`CAPTURE_PROTOCOL_VERSION = 4`), tests `packages/capture-protocol/test/protocol.test.ts` 29 / 29,
typecheck 0, lint 0. The C worker that speaks it follows in the same row (see the last section for
its state); row 71b builds against the package, not against the worker.

Everything below is exported by `@dems/capture-protocol`. Nothing was removed from version 3;
a version-3 frame does not decode (`v` is a literal).

## 1. Commands (supervisor -> worker)

| Command | Members | Change |
|---|---|---|
| `START`, `STOP` | unchanged | only `v: 4` |
| `SWITCH_AUDIO_SOURCE` | `v`, `sessionId`, `correlationId`, `to: 'PRIMARY' \| 'STANDBY'` | members unchanged. `to` stays a ROLE of the plan (the place a microphone holds), never a device ID |

Switch answer: `ACK ok=true` once the selector is switched (on the filtering thread, at the next
10 ms input chunk). **The `AUDIO_SOURCE_INTERVAL` record of that switch is written BEFORE its
`ACK`** — when `switchAudioSource()` resolves, the record has already been handled.
A switch to the role that already feeds the track: `ACK ok=true`, **no record** (nothing changed).
Refusals (`ACK ok=false`, no record, source unchanged) — `SWITCH_REFUSAL_CODES`:
`NOT_RECORDING`, `SESSION_MISMATCH`, `NO_SUCH_MIC`, `SWITCH_PENDING` (the switch before it is not
realised yet, at most one chunk: ask again), `SELECTOR_COMMAND_FAILED` (the worker then ends `CRASH`).

## 2. `WARNING` (changed)

`{ v, type, sessionId, code, reason, state, subject }`

| Member | Rule |
|---|---|
| `code` | unchanged: `MIC_SILENT` \| `CAPTURE_FAULT` (the pinned two) |
| `reason` | **NEW, required** — `CaptureWarningReason`; must belong to the code (`WARNING_REASONS_OF`) |
| `state` | `ACTIVE` \| `CLEARED`; a `CLEARED` carries the same code, reason and subject as its `ACTIVE` |
| `subject` | **device ID of the plan, never null, never a role word** (`PRIMARY` / `STANDBY` are refused by the schema) — D84 R-1, R-2 |

| code | reason | subject | raised / cleared by the worker |
|---|---|---|---|
| `MIC_SILENT` | `MIC_LEVEL_BELOW_THRESHOLD` | mic id | level of DELIVERED samples <= `micSilenceDbfs` for `micSilenceDurationMs`; `CLEARED` when above again; a later episode is a new `ACTIVE`. Never a switch |
| `CAPTURE_FAULT` | `MIC_DISCONNECTED` | mic id | no sample for `micDisconnectDebounceMs`; `CLEARED` when it delivers again |
| `CAPTURE_FAULT` | `MIC_RATE_AT_LIMIT` | mic id | rate controller held at +-5,000 ppm (D85); `CLEARED` when inside again |
| `CAPTURE_FAULT` | `CAMERA_NOT_CONNECTED` | camera id | ingest refused / not opened within the window / no usable stream. No `CLEARED` inside a session |
| `CAPTURE_FAULT` | `CAMERA_STREAM_ENDED` | camera id | a camera that delivered stopped. No `CLEARED` |
| `CAPTURE_FAULT` | `CAMERA_CLOCK_OUT_OF_BOUND` | camera id | camera wall clock beyond 2 s. No `CLEARED` |
| `CAPTURE_FAULT` | `KEYFRAME_INTERVAL_ABOVE_BOUND` | camera id | **ADVISORY** (`ADVISORY_WARNING_REASONS`): the camera RECORDS; show the number of the `KEYFRAME_INTERVAL` record, not a camera fault (D127 (2)). No `CLEARED` |

`MIC_WARNING_REASONS` = the three whose subject is a microphone.
A microphone can hold up to three ACTIVE warnings at once (silent, disconnected, rate): the fault
key on the Core side is `(code, reason, subject)`, not `(code, subject)`.
Events the supervisor makes itself (`source: 'supervisor'`, subject null) are not wire frames: their
shape is 71b's.

## 3. Records (lossless class)

`CaptureRecordKind` = `FIRST_VIDEO_SAMPLE`, `FIRST_DURABLE_FRAGMENT`, `FRAGMENT_CHECKPOINT`,
`KEYFRAME_INTERVAL`, **`AUDIO_SOURCE_INTERVAL`**, **`AUDIO_TIMELINE_END`**, `SEAL_COMPLETE`.
Whose `deviceId` a record carries: `CAMERA_RECORD_KINDS` (4), `MIC_RECORD_KINDS`
(`AUDIO_SOURCE_INTERVAL`), `SESSION_RECORD_KINDS` (`AUDIO_TIMELINE_END`, `SEAL_COMPLETE`: no
`deviceId`). **`supervisor.ts:666` refuses today every record whose `deviceId` is not a camera
(`RECORD_SUBJECT_UNKNOWN`): it must take a microphone ID for `MIC_RECORD_KINDS` and no ID for
`SESSION_RECORD_KINDS`, or the first record of every version-4 session ends the worker.**

### `AUDIO_SOURCE_INTERVAL` (new) -> `session_audio_intervals`

| Member | Type | Meaning |
|---|---|---|
| `deviceId` | device ID | the microphone that feeds `AUDIO-01` from `fromSample` on (`mic_device_id`) |
| `role` | `PRIMARY` \| `STANDBY` | the role it holds in the plan |
| `index` | int >= 1 | 1, 2, 3 ... per worker, no gap (`seq`) |
| `fromSample` | int >= 0 | first sample of this source, counted from T0 (= index in the PCM tap). Multiple of `CAPTURE_AUDIO_INPUT_QUANTUM_SAMPLES` (480). **File time = `fromSample + CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES` (1,024) samples** — `from_media_ms = floor((fromSample + 1024) * 1000 / sampleRateHz)` |
| `sampleRateHz` | int | 48,000 |
| `capturedAtMs` | epoch ms | capture instant of `fromSample` on the host clock (`from_at`) |
| `reason` | `SESSION_START` \| `OPERATOR_SWITCH` | `AudioSourceIntervalReason`; there is no third value |
| `correlationId` | id \| null | the correlation ID of the `SWITCH_AUDIO_SOURCE` it realises; null for the start |
| `appliedDelayUs` | int \| null | worker-measured: command read -> selector switched; null for the start. Bound `CAPTURE_SWITCH_BOUND_US` = 21,333 |

Schema rules: start <=> `index 1` <=> `fromSample 0` <=> `correlationId null` <=> `appliedDelayUs null`.
An interval ends where the next begins; the last one at `AUDIO_TIMELINE_END.samples`. The interval
of the start is written when T0 is taken (before any camera record can exist). `switched_by` and the
audit `AUDIO_SOURCE_SWITCHED` (sending device ID) are the Core's: join by `correlationId`.

### `AUDIO_TIMELINE_END` (new)

`{ kind, samples, sampleRateHz, intervals }` — written once when the filtering thread ends:
`samples` fed to the one encoder since T0 (decoded sample count of `AUDIO-01` = `samples` + 1,024
priming, +- the encoder's last partial frame), `intervals` = number of interval records written.
Absent after a kill: nothing may be decided from its absence.

### `FIRST_VIDEO_SAMPLE` (changed: two new required members)

`{ kind, deviceId, pts, timescale, skipped: { noTimestamp, beforeAudioStart, noCameraClock, beforeKeyframe }, skippedSpanMs }`

`skipped` counts the video packets the camera delivered before the first written sample, by the
reason each could not be written; `skippedSpanMs` = camera time from the first skipped packet that
had a timestamp to the first written sample. This is the specified start-up of a stream copy
(spec §C.4: the file starts with the first keyframe that can be placed at or after T0 — up to one
camera GOP), reported so that the manifest can carry it. `pts / timescale` stays "how long the
first frame is held from T0".

### `KEYFRAME_INTERVAL`, `FRAGMENT_CHECKPOINT`, `FIRST_DURABLE_FRAGMENT`, `SEAL_COMPLETE`

Unchanged.

## 4. `TELEMETRY` (changed)

`levels[]` entry: `{ deviceId, role, dbfs, clipped, ratePpm }` — **`deviceId` (new, required)** names
the microphone; `role` stays; **`ratePpm` (new, required, number in [-5000, 5000] or null)** = what
the rate controller asks now (null while the microphone does not run). Other members unchanged.

## 5. Plan (changed rule, same members)

`CapturePlanSchema` members and `CapturePlanConstantsSchema` (six keys) are unchanged. Two more
refusals: a device named like a role word, and a camera and a microphone with the same ID.

## 6. Named settings of the worker process (new)

Per-installation arguments, not plan members — `CAPTURE_WORKER_SETTINGS`,
`CAPTURE_WORKER_SETTING_DEFAULTS`, `captureWorkerSettingArguments(partial?) -> string[]`:

| Setting | Argument | Default | Range / step |
|---|---|---|---|
| `ingestOpenWindowMs` (D84) | `--ingest-open-window-ms` | 15000 | 1000..600000, whole seconds |
| `micSilenceDbfs` | `--mic-silence-dbfs` | -50 | -120..0 |
| `micSilenceDurationMs` | `--mic-silence-ms` | 10000 | 100..600000, step 100 |
| `micDisconnectDebounceMs` | `--mic-disconnect-ms` | 2000 | 100..600000, step 100 |

The launcher (`apps/core-server/src/capture/index.ts:110`) appends
`...captureWorkerSettingArguments({ ingestOpenWindowMs, micSilenceDbfs: MIC_SILENCE_DBFS, micSilenceDurationMs: MIC_SILENCE_DURATION_MS, micDisconnectDebounceMs: MIC_DISCONNECT_DEBOUNCE_MS })`
to the worker's arguments. A worker started without them uses the same defaults (pinned).
`M5-NODEV-C-1` shortens `ingestOpenWindowMs` through this setting.

## 7. Other new exports

`CAPTURE_AUDIO_INPUT_QUANTUM_SAMPLES` (480), `CAPTURE_SWITCH_BOUND_US` (21,333),
`AudioSourceIntervalReason`, `SWITCH_REFUSAL_CODES`, types `AudioSourceIntervalRecord`,
`AudioTimelineEndRecord`, `FirstVideoSampleRecord`, `CaptureWorkerSettings`.

## 8. What breaks on the Core side until 71b adapts (expected; not edited by 71a)

- `supervisor.ts`: record subject rule (section 3); `subjects` set should hold device IDs only
  (`:833` adds the two roles — a role can no longer arrive); once-per-camera rule unchanged.
- Every test fixture that builds a `WARNING` without `reason`, a `levels[]` entry without
  `deviceId` / `ratePpm`, or a `FIRST_VIDEO_SAMPLE` without `skipped` / `skippedSpanMs` no longer
  decodes (`apps/core-server/test/support/capture.ts`, `src/capture/__tests__/*`).
- 71a edits only the pin file `apps/core-server/src/capture/__tests__/protocol-pins.test.ts`
  (version, record kinds the worker writes, the new defines).

## 9. Worker state

**WORKER LANDED** 2026-10-09 22:45 WIB: `capture-worker/0.4.0` speaks version 4 (every output line of
three recorded sessions decodes with `decodeWorkerLine`: 444 of 444 in the switch session). Record
order observed in a session: `AUDIO_SOURCE_INTERVAL` (start) is `seq 1`, before any camera record.
One correction to section 8: `recording-fragments.db.test.ts:212-213` also builds
`FIRST_VIDEO_SAMPLE` without the new members (request filed).
