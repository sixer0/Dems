---
task_id: 2026-10-07_dems_real_capture_sealing
row: wave H, reconcile pass R (the evidence ITEM contract between the Core and the two clients; decisions D205, D207)
date: 2026-10-10
agent: coder-execution
brief: delegation_progress/fix_brief_wave_h.md (D200; rules D94 / D122)
tree: f293221 + the working tree of wave H (no commit, no migration: schema 6 / dbc-7 unchanged)
narrative_tier: 2
status: complete
---

# 127 - Wave H, reconcile pass R: one evidence-item contract

## 1. What was wrong (plainly)

BOTH drivers' reports were true, and the tree was broken. The contract (`packages/shared/src/api/evidence.ts`) and the Core
(`src/evidence-facts/index.ts`) say `media.fileIds` and `access.readTranscript`; each client's `MEMBER` table
(`features/evidence/item-facts.ts`) read `media.files` and `access.transcript`. No Core sends those two names.
Effect on a live product: the players fell back to the item's own VIDEO entries (right by luck for most items), and
`access.readTranscript: false` was never seen - a page view by a non-holder still asked operations 84 / 86 and wrote the
audited `ACCESS_DENIED` row (G81-07 not fixed in fact). The clients' tests passed because they hand-wrote the answer of
operation 40 with the client's own names (G94-01's failure mode again). C2's two expected-failing cases would have turned
red-by-passing on C1's example without showing this: they asserted the player only, which the fallback satisfied.

Evidence (red, then green):
- web `wave-h-c2-media.test.tsx` with the old two names put back: 8 of 21 red (`expected null to deeply equal ['VIDEO-01','VIDEO-02']`, `transcript: null` for `true`); restored: 21 passed.
- mobile `wave-h-c2-media` + `wave-h-c2-transcript-access` with the old names: 9 of 31 red; restored: green.

## 2. The member table (contract = Core; the contract is the single source of names)

| Member | Contract + Core | Web (`item-facts.ts`) | Mobile (`item-facts.ts`) |
|---|---|---|---|
| `media.source` | `LIVE_STREAM` / `DEMO_PACKAGE` / `NONE` | read (`mediaSource`) - agreed | read (`media.source`) - agreed |
| `media.packageSuffix` | string or null | read | read |
| camera file ids | **`media.fileIds`** (1 or 2, with LIVE_STREAM) | read `files` -> **fixed to `fileIds`** | read `files` -> **fixed to `fileIds`** |
| `media.reason` | code, with NONE | read - agreed | read - agreed |
| `access.play` | boolean | read - agreed | read - agreed |
| transcript access | **`access.readTranscript`** | read `transcript` -> **fixed to `readTranscript`** | read `transcript` -> **fixed to `readTranscript`** |
| `access.export` | boolean | read - agreed | read - agreed |
| `exports[]` | present only with `access.export` | read - agreed | read - agreed |
| `exports[].exportId / jobId / kind / completedAt` | as named | read - agreed | read - agreed |
| `exports[].exportedBy / archiveBytes / archiveSha256` | as named | NOT read (nothing draws them) | NOT read |
| `interrupted` (item) | the sealed manifest's `timeline.interrupted` | read; since D207 through `interruptedFactOf` (member, else custody entry) | same |
| `interruptedCause` (item) | code of the custody entry `RECORDING_INTERRUPTED`, or null | read; else the custody entry's `detail` | same |
| `signature.developmentKey` | true / false / null | read (true, false, null = not established, absent = not reported) | read (true, false; null and absent = not reported) |
| `audioSourceIntervals[]` | `seq, inputId, role, fromMs, toMs, reason` | read by `item-v2.ts` (existing) - agreed | same |
| `audioSourceIntervals[].sourceClass` | per interval | NOT read (the band draws no class per interval) | NOT read |
| `transcript` on the body's item | the replicated summary | read by `item-v2.ts` - agreed | same |
| `transcript.noSpeech / reason` on op 40 | NOT in the contract, not sent | web `MEMBER` still names them and reads null (dead; "no speech" comes from the op 84 document) | not named |
| `files` (item) | the sealed manifest's camera files | read - agreed | read - agreed |
| `sealedPackage` (item) | `PRESENT` / `NOT_READABLE`, stated for a package sealed on this Core | was NOT read -> **now THE rule** (section 3) | same |
| `manifestVersion` | 1 / 2 | read; never the test of "sealed here" (D-85-1) | same |
| `integritySource` | REAL / DEMO_PACKAGE / SIMULATED | read - agreed | read - agreed |

## 3. Findings

| Finding | Reproduced? | Fix | Test | Status |
|---|---|---|---|---|
| R-1 the clients read `media.files` / `access.transcript`; the Core sends `fileIds` / `readTranscript` | YES (section 1) | the two `MEMBER` entries in each app; nothing renamed in the contract | the real-shape tests below | FIXED |
| R-2 the real-shape cases were expected-failing and too weak | YES | `.fails` / `.failing` removed. Each app now feeds EVERY `getEvidence` 200 example UNMODIFIED: the reader is compared member by member with the example (`fileIds`, `reason`, `access`, `exports`, `sealedPackage`, `interrupted`), then the page is rendered; the press must ask operation 88 for exactly `media.fileIds`. A table `EXPECTED` must name every example (a new example cannot go unread) | web `__tests__/wave-h-c2-media.test.tsx`, mobile `wave-h-c2-media.test.tsx` | FIXED |
| R-3 contract examples for the other kinds | - | ADDITIVE examples of `getEvidence` 200: `productSealedInterrupted`, `productSealedOneCamera`, `noMedia`, `outsideCaseScope`, `seedSealedDemo` (the item of `productSealed` became a constant; its value is unchanged). `withPackage` is the demo item. OpenAPI by the generator, under `.locks/npm.lock` (twice: a foreign change to `DemoFaultRequest` / `FaultTarget` landed between) | `packages/shared/test/sim-evidence-item-kind.test.ts`, `api-*` tests, `test/acceptance/contract.test.ts` | DONE |
| R-4 no client test may hand-write a real item | - | BOTH wave-H beds hold every scripted answer of operation 40 to the contract's STRICT schema (`EvidenceDetailSchema`): a name no Core sends fails the test. The kits' item builders take their defining members from the contract's examples (section 4) | all wave-H tests; mobile: every test on the Live evidence bed (26 suites) | DONE |
| R-5 `sealedPackage`: two spellings of "demo item" | by reading | ONE rule in `packages/shared/src/sim/evidence.ts`: `evidenceItemKindOf` -> `SEALED_HERE` (the Core states `sealedPackage`) / `DEMO` (DEMO_PACKAGE or SIMULATED without it) / `RECORD` (REAL, no sealed package stated) / `UNKNOWN`. Both apps' `isDemoItem` / `isCoreSealedItem` / `hasSealedPackageHere` are that function. Vector `EVIDENCE_ITEM_KIND_VECTORS` | tested once in shared; both apps read the same vector through their own readers | FIXED |
| D205 a seed-sealed demo item cannot be played | YES: with the two rules reverted 3 of 5 route cases red | `media-stream/items.ts` reads three more columns and states `seedSealedDemo` (the row mapping's own four facts); `media-stream/service.ts`: operation 88 and the media route open REAL **or** seed-sealed, the case scope is asked for REAL only; `evidence-facts/index.ts`: such an item answers `LIVE_STREAM` + its `fileIds` (or `NONE` + reason), never `DEMO_PACKAGE` | `modules/evidence/__tests__/wave-h-r-seed-sealed.db.test.ts` (through the routes, the seed generator's own packages): op 40; a TECHNICIAN opens and reads both files, audit rows = 2 x `EVIDENCE_MEDIA_SERVED` and nothing else; NEGATIVE CONTROL REAL keeps `403 EVIDENCE_CASE_SCOPE`; NEGATIVE CONTROL a v1 demo item keeps `DEMO_PACKAGE` and `409 NOT_A_SEALED_PACKAGE`; the tamper demo: VIDEO-01 whole, VIDEO-02 served before and after, a range starting in the altered fragment `409 FRAGMENT_NOT_AUTHENTIC` (`VIDEO-02`, seq 3) | FIXED |
| D207 three statements of "interrupted" | the product's seal cannot make them differ (proved); a hand-made disagreement is decided | ONE reader `interruptedFactOf` (shared): the Core's `interrupted` when stated, else the custody entry; cause = `interruptedCause`, else the entry's `detail`. `interruptedSealOfItem` (driver B's helper, ONE function edited by D207) now gives the same answer, so the list row, the item header, the web seal dialog / Monitor and the mobile Summary / hub name one state | Core `evidence-facts/__tests__/wave-h-r-interrupted-agreement.test.ts` (the REAL sealing pipeline, three ways a seal ends: manifest flag === seal input === the Core's member); shared `sim-evidence-item-kind.test.ts`; clients: two D207 cases each + the `productSealedInterrupted` example | FIXED |

### D207 in one paragraph
`sealing/pipeline/pipeline.ts` writes `timeline.interrupted` (line 712) and `CompleteSealInput.interrupted` (line 841) from the
same checkpointed value `closedTracks.interrupted`; `completeSealTransition` writes the custody entry `RECORDING_INTERRUPTED`
iff that input is true (`session-machine.ts:1425-1428`). So "flag without entry" and "entry without flag" cannot come from the
product's seal. If they ever differ (a hand-edited row, a future writer), THE MANIFEST WINS: it is the signed statement; the
custody entry is a database row. `InterruptedFact.source` says which member spoke.

### D205: the scope line
`masterplan/03_api_contract.md` section 2.4 (line 313): "**REAL-evidence case scope (SEC35-16, provisional).** For an item whose
`integrity_source='REAL'`, op 88 (and the `EVIDENCE_VIEW` reads 84/86) additionally require ..."; section 2.1 (lines 214-216) says
the same. A seed-sealed item is `DEMO_PACKAGE`: outside that sentence. Operation 40's `access` already computed it so (`!real || holdsCase`).

## 4. Wave-H client tests: hand-written items converted
- web `__tests__/wave-h-c2-bed.ts` `asReal`: integrity source, manifest version, signature, `sealedPackage` now TAKEN FROM the contract's `productSealed` example (used by all four web wave-H files); `contractDetail(name)` hands out the examples.
- mobile `testing/wave-h-c2-kit.tsx` `realItem`, `seedSealedDemo`: the same, from `productSealed` / `seedSealedDemo`.
- web + mobile `wave-h-c2-media`: the example block (section 3, R-2); "the reader" case reads the shared vector and the `seedSealedDemo` example instead of a hand-made seed-sealed object.
- hand-written names corrected: `media.files` -> `fileIds` (web media, export-playback; mobile media, exports-playback, transcript-access), `access.transcript` -> `readTranscript` (web transcript, export-playback; mobile transcript-access, exports-playback).
- KEPT hand-written, on purpose, and now schema-held: the small per-case variations (`{ source: 'NONE', reason }`, one `access` flag, a key-class value, an `exports` list). They are not "what a real item looks like" cases; a wrong name in them now fails.
- NOT converted (not wave-H files): `media-session-canary.test.tsx` in both apps builds its own sealed item (`asSealedV2` / `sealedV2`). Mobile's runs on the schema-held bed; the web one uses another bed. Listed for the test owner.

## 5. Limits / not proven
- `RECORD` kind: a REAL item whose answer carries no `sealedPackage` (the one engine unit between a seal and the sealed-facts door; an item that was never sealed). It is never a demo item and never draws bundled media; web `isV2Item` and mobile export sheet / integrity tab treat REAL as before (`|| isRealItem`).
- A `DEMO_PACKAGE` item with a real signature but WITHOUT `sealedPackage` now reads as a bundled demo item (the vector says so on purpose: the Core's member is the test). The Core states `sealedPackage` for every such item in operations 39 / 40 and on the replicated item after the boot step.
- The seed-sealed route test uses the sealing tests' built fragments through a synthesiser double (no helper program): the picture is not the generated test picture; package, cipher, development key and tamper are the generator's own.
- A tampered item still answers `LIVE_STREAM` (the manifest of record is intact); the refusal is per fragment. What the clients' players SHOW for it was not driven here (re-gate).
- Nothing was driven on a device or in a browser.

## 6. Decisions for the controller
1. `interruptedSealOfItem` in `packages/shared/src/sim/capture-session.ts` (driver B's file) was edited - that one function and one import - by D207.
2. The one rule lives in `packages/shared/src/sim/evidence.ts` (my area, already the neutral home of item derivations, exported by `@dems/shared/sim`).
3. `MediaItem.seedSealedDemo` is stated ONLY when true, so the pin of `modules/media-stream/__tests__/media-stream.db.test.ts:119` (exact object of a REAL item) holds unchanged. `READ_MEDIA_ITEM` names nine columns now (was six).
4. Web `MEMBER.transcript*` (`noSpeech`, `reason` on op 40) is dead: the contract has no such member. Left in place (pins may name it); remove with C2's leftovers.
5. Foreign red, not mine: `apps/core-server` typecheck has ONE error in `src/capture-session/__tests__/session-capture.db.test.ts:1409` (another driver's in-flight edit).

## 7. Checks run (once each; a second run only after a fail)
| Command | Result |
|---|---|
| `npm run test -w packages/shared` | 110 files, 2532 passed |
| `npm run test -w apps/core-web -- src/features/evidence/__tests__` | 18 files, 195 passed (no expected-fail left) |
| `npm run test -w apps/mobile -- --maxWorkers=2 --silent src/features/evidence` | 26 suites, 237 passed |
| core-server unit: `npx vitest run --project unit src/modules/evidence src/media-stream src/evidence-facts src/modules/media-stream src/evidence-verify src/engine/__tests__/sealed-facts-doors.test.ts test/static` | 41 files, 572 passed |
| core-server db (lock `db-migrate`, sandbox off): `npx vitest run --project db src/modules/evidence src/modules/media-stream test/acceptance/contract.test.ts` | first run: 144 passed, 1 failed (`openapi.json` != generator: a foreign shared-api change had landed after my generation); regenerated; `contract.test.ts` re-run: 38 passed |
| driver B's interrupted-seal client tests (they read the edited helper) | web 4 passed; mobile 3 suites, 6 passed |
| typecheck + lint, four workspaces | shared, core-web, mobile clean (mobile: the known warning in `src/runtime/log.test.ts:160`; web: 2 fast-refresh warnings in `session-monitor/capture-checkpoints.tsx`, not mine); core-server lint clean, typecheck: the ONE foreign error of decision 5 |

## 8. Checks for the test runner
| Command | Lock | Expected |
|---|---|---|
| `npm run test -w @dems/core-server` ; `/usr/bin/lockf -k .locks/db-migrate.lock npm run test:db -w @dems/core-server` | db-migrate | green; watch `modules/media-stream/**`, `evidence-export/**` (they read `MediaItem` / op 40) and `test/acceptance/demo-seed-v2.test.ts` (the seed-sealed items: op 40 now answers `LIVE_STREAM`, not `DEMO_PACKAGE`) |
| `npm run test -w apps/core-web` ; `npm run test -w apps/mobile -- --maxWorkers=2` | - | green, no expected-failing case |

## 9. Gate checks to re-drive
- G81-07 on web and tablet: a technician outside the case scope opens a REAL item - NO new `ACCESS_DENIED` row (this is the check the name mismatch had left broken).
- M8-PB-W / -T / -P on a one-camera REAL item: one session asked (`media.fileIds`), never two.
- NEW (D205): `EV-...-0005` (tamper demo) and its clean sibling on a lane with the seed-sealed items: the sealed player opens for any role; development marks; NO bundled picture, NO "DEMO media" label; the tampered item's VIDEO-02 stops with the integrity sentence at the altered fragment, VIDEO-01 plays; Hash & Integrity unchanged.
- A v1 demo item (lane 1): bundled media with its label, as before.
- D207: the interrupted item (`EV-20261010-0015`): list row, item header, web seal dialog / Monitor, tablet Summary and hub name the same state and cause.

*Generated: 2026-10-10 17:45 WIB*
