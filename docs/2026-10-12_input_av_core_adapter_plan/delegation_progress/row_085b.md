# Row 85b - the composition of the production dependency bundle (decision C55)

Paths relative to `/Users/gsp-budi/Documents/DEMS`; `CS` = `apps/core-server`.

## 1. The composing file (first act, written before any code)

**`CS/src/capture-composition.ts`** - a file directly under `src/`, beside `app.ts`, `config.ts` and `host-alias-socket.ts`. It is a file of NO unit: not in the capture unit (`src/capture/`), not in a module (`src/modules/<name>/`).

Why no closed-unit rule is weakened, from the text of the rules:

| Rule | Text | Consequence for the file |
|---|---|---|
| `unitOf` (`CS/test/static/imports.test.ts:183-184`) | "A file directly under `src/` is in no unit": `unitOf('src/app')` and `unitOf('src/config')` are `null` | the file is no unit: `CLOSED_UNITS` (`:55-91`) does not grow, "the one unit that is not closed is the command folder" (`:337-344`) stays true, and no new top folder exists (a folder would have been a unit and a THIRD list entry) |
| Rule 2, deep imports (`:319-322`) | a source of another unit names a closed unit's index or an `EXPOSED` path | the file imports `./capture`, `./capture-session`, `./credential-store`, `./modules/capture-discovery`, `./modules/capture-inputs` through their INDEX; `./capture/fence` is already `EXPOSED` (`:121`). CORRECTED AFTER THE FIRST RUN: it does NOT import `./capture/adapters` - rule A-5 of the adapter layer (`CS/src/capture/adapters/__tests__/static.test.ts:240-262`) holds the importers of that layer to a closed list, which is a third list and was not admitted; what the composition needs of the layer is offered by the fence (a unit of that list) in the new file `CS/src/capture/fence/production-parts.ts`. The one path that is neither is `./modules/capture-config/credential-holders` = SR-7 entry (b), the line row 144 named (`file_requests.md:98`) |
| Rule 4, cycles (`imports.ts:147-152`, `unitEdges`) | an edge is counted only when `from` and `to` are both units | a file of no unit adds no edge: the unit graph is the same graph |
| Rule 5 (`:124`, `:392-395`) | `BELOW_THE_MODULES` = core, engine, realtime, plugins | the file is none of them; nothing below the modules imports a module because of it |
| Rule 5, module to module (`:138`, `:397-400`) | edges between two `src/modules/` units | none added: the composition is what keeps `capture-discovery` from importing `capture-config` |
| R-6 (`CS/src/modules/capture-config/__tests__/static.test.ts:49`, `:178-192`) | the production importers of the wiring equal `CAPTURE_CREDENTIAL_HOLDERS_IMPORTERS`; never the module index, never a commissioning file | SR-7 entry (a): the list holds exactly `src/capture-composition.ts`. R-3 (the reader's importers: the wiring alone) and "no file under `src/capture/` imports the reader, the wiring or the reveal module" (`:194-198`) are untouched - the file is not under `src/capture/` |
| "what is offered beside an index is used" (`imports.test.ts:324-335`) | every `EXPOSED` path is imported from another unit | the new entry has its one user, the composing file |

No other entry of either list moves. `app.ts` is not edited (digest-frozen); the entry point's `buildApp({ config, errorLogFile: DEFAULT_ERROR_LOG_FILE })` is not edited.

## 2. State

Status: **needs-review** (2026-10-13). Record: `implementation/085b_production_composition.md`.

- Built, tested, called by the entry point: the composing file; the ONE binding of the destination rule to its four takers (fail-closed without network facts); the two credential readers at their holders; the relay report hub in the session; the card enumerator (named "not available" where no reader or no program text exists); the stored stream and microphone facts with serial and port; the two fact keys of row 200; the camera bundle complete, the audio bundle and the two watch bundles as far as a file outside the capture unit reaches.
- Not built (the remainder, `file_requests.md`): the network-facts reader (row 108), the runner of the listing program, the audio helper's configuration key, the fault sink of the watches, the wider device read, admission after the boot.
- Checks: unit 22 / 22 (the composition), 405 / 405 (static rule files and the touched unit files), database 4 / 4 (the composition on the real app), typecheck 0 errors. Two schema pins of other rows are red (`fence.db.test.ts:139`, `audio-cards/__tests__/routes.db.test.ts:159`).
- Edit tool only for every existing file; the four new files with Write.
