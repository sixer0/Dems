# `src/evidence-facts`

Up: [`src`](../README.md)

## Purpose

States what the Core knows about an evidence item beyond its stored rows, such as the media state of each kind of item, so that clients do not guess.

## Contents

| File or folder | Role |
|---|---|
| [`index.ts`](./index.ts) | What the Core says of an evidence item beyond its stored rows. |
| [`sealed-facts.ts`](./sealed-facts.ts) | What the sealed manifest of an item says, read from the item's own package. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `SEALED_FACTS_BOOT_STEP`, `SEALED_FACTS_NOT_PUBLISHED`, `SEALED_PACKAGE_NOT_READABLE`, `FACTS_NAMED_IN_A_LINE`, `SEALED_FACTS_CACHE_ENTRIES`, `MEDIA_NOT_SEALED_REASON`, `MEDIA_NO_PACKAGE_REASON`, `MEDIA_DEMONSTRATION_RECORD_REASON`, `streamProfileNoticeOf`, `evidenceFacts`, `readSealedItemFacts`, `SealedFactsAnchors`.
- Types exported from `index.ts`: `EvidenceFactsParts`, `EvidenceFactsControl`, `StreamProfileNoticeTrack`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`modules/evidence`](../modules/evidence/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`capture/fence`](../capture/fence/README.md)
- [`engine`](../engine/README.md)
- [`evidence-export`](../evidence-export/README.md)
- [`evidence-verify`](../evidence-verify/README.md)
- [`media-stream`](../media-stream/README.md)
- [`plugins/logger`](../plugins/logger/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `fastify`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| [`__tests__/`](./__tests__/) | 1 | 0 |

None of these tests needs a database window.

Tests elsewhere that import it (1 folders): `src/modules/evidence/__tests__`.

## Related decisions

No entry of the 2026-11-05 audit decisions log names this folder or its files. Code comments cite earlier design decisions; see the file headers.
