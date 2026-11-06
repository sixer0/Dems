# `src/media-stream`

Up: [`src`](../README.md)

## Purpose

Media streaming of sealed evidence: the signed media session token, `Range` header handling, the seek index, and reading a camera file of a sealed v2 package as plaintext ranges for `GET /media/:token`.

## Contents

| File or folder | Role |
|---|---|
| [`index.ts`](./index.ts) | Media streaming. |
| [`items.ts`](./items.ts) | What the media-stream unit reads of an evidence item. |
| [`ranges.ts`](./ranges.ts) | The `Range` header of the media route. |
| [`seek-index.ts`](./seek-index.ts) | The indexed view of a sealed camera file. |
| [`service.ts`](./service.ts) | The handlers of the two media routes. |
| [`source.ts`](./source.ts) | The camera file of a sealed v2 package as a source of plaintext byte ranges. |
| [`store-door.ts`](./store-door.ts) | The one file of the media-stream unit that reaches the Core credential store. |
| [`token.ts`](./token.ts) | The signed media session token. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `mediaStream`, `READ_MEDIA_ITEM`, `READ_SESSION_OPEN`, `readMediaItem`, `readSessionOpen`, `MediaItem`, `MediaItemReader`, `contentRangeOf`, `decideRange`, `unsatisfiedRangeOf`, `RangeDecision`, `EVIDENCE_CASE_SCOPE_REASON`, `MEDIA_DENIED_UNIT`, `MEDIA_PLAN_CACHE_ENTRIES`, `MEDIA_ROUTE_PREFIX`, `MEDIA_ROUTE_URL`, `MEDIA_SERVED_UNIT`, `MEDIA_SESSION_CHECK_EVERY_PIECES`, `MEDIA_SESSION_ENDED_REASON`, `MEDIA_SESSION_ISSUED_UNIT`, `MEDIA_STREAM_OPERATIONS`, `MediaSessionRequestSchema`, `NOT_A_SEALED_PACKAGE_REASON`, `MEDIA_STOP_MEMORY_ENTRIES`, `RANGE_NOT_SATISFIABLE_REASON`, `SEEK_INDEX_NOT_AVAILABLE_REASON`, `createMediaStreamService`, `holdsCase`, `MediaStreamOperation`, `MediaStreamParts`, and 40 more.
- Types exported from `index.ts`: `MediaPlayability`, `MediaStreamControl`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`evidence-export`](../evidence-export/README.md): `index.ts`
- [`evidence-facts`](../evidence-facts/README.md): `index.ts`
- [`modules/media-stream`](../modules/media-stream/README.md): `index.ts`
- [`modules/transcripts`](../modules/transcripts/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`core`](../core/README.md)
- [`credential-store`](../credential-store/README.md)
- [`evidence-verify`](../evidence-verify/README.md)
- [`plugins/authenticate`](../plugins/authenticate/README.md)
- [`plugins/error-envelope`](../plugins/error-envelope/README.md)
- [`plugins/logger`](../plugins/logger/README.md)
- [`plugins/permission-guard`](../plugins/permission-guard/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `fastify`, `zod`
- Node built-ins: `node:crypto`, `node:path`, `node:stream`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 5 | 0 |

None of these tests needs a database window.

Tests elsewhere that import it (3 folders): `src/evidence-export/__tests__`, `src/modules/evidence/__tests__`, `src/modules/media-stream/__tests__`.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
