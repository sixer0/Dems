---
task_slug: input_av_core_adapter_plan
row: 20
date: 2026-10-12
agent: coder-execution
packages: WP-06b, WP-07a
status: complete
tier: T3
---

# Row 20 - the adapter contract, both members at once

## Statement

`apps/core-server/src/capture/adapters/types.ts` gained three things, all additive (43 lines
added, 0 removed, no existing line changed):

| # | What | Where | Source |
|---|---|---|---|
| 1 | `CameraSourceTarget.profile?: string` | `types.ts`, interface `CameraSourceTarget` | design addendum 2.3 "Which contract members change", 4.1 e (P12-F05 a, e) |
| 2 | `AudioStreamHandle.start?(signal?: AbortSignal): Promise<void>` | `types.ts`, interface `AudioStreamHandle` | design addendum 4.1 d (P12-F05 d) |
| 3 | The named refusal of an input beyond the card: the constant `AUDIO_INPUT_BEYOND_CARD` (value `'AUDIO_INPUT_BEYOND_CARD'`) and the class `AudioInputBeyondCardError` (`code`, `deviceId: string \| null`, one fixed sentence as text) | `types.ts`, after `AudioStreamHandle` | specs S3-2 (`masterplan/01_specs.md:158`); design addendum 4.2 "Refusals" |

No signature changed: `openSource` keeps its three parameters, `pullUrl` and `enumerate` are
untouched (addendum 4.1 a, b). No other file was edited. The fake, generated and local adapters
are unchanged and ignore the new members. The security addendum
(`verification/04_security_addendum.md`) carries no correction of these three members (searched
for `CameraSourceTarget`, `AudioStreamHandle`, `types.ts`: 0 hits).

## Evidence

| Check | Command (from `apps/core-server`) | Result |
|---|---|---|
| Adapter unit suites, before the edit | `npx vitest run --project unit --maxWorkers=2 src/capture/adapters/__tests__/{fakes,registry,real,static}.test.ts src/capture-notices/__tests__/notices.test.ts` | `Test Files 5 passed (5)`, `Tests 62 passed (62)` |
| The same, after the edit | same command | `Test Files 5 passed (5)`, `Tests 62 passed (62)` - 0 changed results |
| Workspace typecheck, once, at the end | `npm run typecheck` (`tsc --noEmit`) | exit 0, no output |
| Size of the change | `git diff --stat -- apps/core-server/src/capture/adapters/types.ts` | `1 file changed, 43 insertions(+)` |

No static rule and no pinned export list went red. Static rule A-6 reads `types.ts` and still
matches its codec line.

## Driver decisions (for the controller to confirm)

| # | Decision | Why the conservative one |
|---|---|---|
| DD-1 | `profile` is **optional** in this row | The one production call site, `capture-session/index.ts:1131`, passes `{ ingestUrl }` and belongs to row 47 (`session-file`); so do the test call sites. A required member would leave the tree not compiling. The comment on the member says an adapter that needs a profile refuses an open without one (`PROFILE_UNKNOWN`) and never chooses one. Row 47 passes the plan's value; the member can be made required then (request 2 in `file_requests.md`) |
| DD-2 | The named error is its **own** constant and class, not a sixth member of `AudioInputErrorCode` | The five codes are a closed wire vocabulary: `packages/shared/src/api/capture-discovery.ts:123,487`, the OpenAPI file, the web and mobile clients switch on them, and `capture-notices/probe.ts:52` builds its cause set from `Object.values(AudioInputErrorCode)`. A sixth member would change that set and the answer vocabulary, which this row's "no behaviour changes" forbids. If the controller wants it on the wire (`01_specs.md:102` names `AudioInputDescriptor.errorCode` as the carrier), that is a contract change for the rows that own the shared vocabulary |
| DD-3 | The error lives in `types.ts`, not in `errors.ts` (`CaptureAdapterRefusal`) | The Ownership Area of the row is `types.ts` only. It follows the rule of `errors.ts`: fixed text, a registry ID at most, no card name, number or USB id |
| DD-4 | `start` takes an **optional** signal | It is the type the session already calls with (`capture-session/index.ts:950`) and the type `LocalMicStream.start` declares (`local/mic-helper.ts:96`); the addendum writes `start?(signal)` |

## Requests left (both non-blocking)

`delegation_progress/file_requests.md`: (1) two value exports in the barrel `adapters/index.ts`;
(2) for row 47 in `capture-session/index.ts`: pass `profile` at line 1131, and the cast at line
950 may go.

## What is the double, what stays unproven

Nothing runs in this row: it is types and one error class that nothing raises yet. That a real
camera with two profiles is opened twice by device and profile is row 46 with `9A/H-nn` on
hardware; that an input beyond a real card is refused is row 64 on fixed listings and `9A/H-07`.

## Requirement identifiers

P12-F05 (a), (d), (e): the contract half (blueprint 11.1 gives rows 20, 46, 47 for a and e, 67
for d; the building halves stay with those rows). S3-2: the name exists; row 64 raises it.

---
*Generated: 2026-10-12*
