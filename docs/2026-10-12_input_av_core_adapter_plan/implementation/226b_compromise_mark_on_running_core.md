---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 226b
package: M11 | X1-4
date: 2026-10-13
agent: coder-execution (agent K2)
tier: T3
requirements: decision C69 (1) (the finding of rows 225 / 226); SX-09 (the mark must hold)
status: complete
---

# Row 226b - a key marked compromised signs nothing in a Core that is RUNNING

## The finding

`sealing-host/index.ts` loads the signer once per process (`signingNow`) and keeps it. The commands `evidence:mark-compromised` and `evidence:rotate-key` touch no database and see no process. So a Core that ran while a key was marked kept sealing with that key until it was restarted.

## The choice, and why

**Chosen: the sign step re-asks the store before EACH signature.** Not chosen: the commands refusing while a Core is connected.

| Source | What it says | Consequence |
|---|---|---|
| `masterplan/05_design_x1_x2.md` A2 (`host-key.ts` header) | "`<keyId>.compromised` = signs nothing" | the mark is a property of the KEY, not of the moment a process loaded it: the signer itself must hold it |
| design 2.5 ("It needs no database, no network and no Core"); C69 ("neither touches the database nor sees a running Core") | the host commands are database-free by design | the second remedy (refuse while a Core is connected) would give the commands a database connection they must not have, and C71 C-8 already says that "Core stopped" is known from connections only |
| design 2.7 (3) (`SYSTEM_BOOT` states the key the Core STARTED with; "a change of key between two boots is visible in the chain"); design 2.10 (checks 4, 4b judge the key at the start); row 228 (check 4b-2, the installation binding, a boot check) | the key of a running Core is the one its boot judged and its boot entry names | **no switch without a restart**: after a rotation the running Core does not go over to the new key - a key no boot check judged and no `SYSTEM_BOOT` names. It signs nothing, by a named reason, until it is started again (the rotation command already ends with "Start the Core again") |

## What was built (paths relative to `apps/core-server/`)

| File | Change |
|---|---|
| `src/capture/signer/host-key.ts` | `loadSoftwareSigner` hands `softwareSigner` a question `stillSigns`, asked before every `sign`: (1) the store directory as at a load (absent `KEY_ABSENT`; link / foreign owner / reachable by others: the load's codes); (2) `<keyId>.compromised` present: `KEY_COMPROMISED`; (3) only for a signer loaded WITHOUT a key id (as the active key - the only form the product uses): the pointer through the one resolver `activeSigningKeyId` - cannot be taken `ACTIVE_KEY_POINTER_INVALID`, another id `ACTIVE_KEY_CHANGED`. Header paragraph "A LOADED SIGNER ASKS THE STORE AGAIN" |
| `src/capture/signer/types.ts` | one refusal code, `ACTIVE_KEY_CHANGED` |
| `src/capture/signer/seal.ts` | `signManifest`: a `SignerError` the signer threw keeps its code (it was folded into `SIGNATURE_FAILED`, which hid the reason); any other throw is `SIGNATURE_FAILED` as before |
| `src/sealing-host/index.ts` | comment at `signingNow` only: why the kept signer is safe to keep. No code line |
| `src/capture/signer/__tests__/sign-time-guard.test.ts` | new, 5 cases |
| `src/sealing/__tests__/seal-after-mark.test.ts` | new, 3 cases |
| `src/sealing/__tests__/active-key-call-sites.test.ts` | ONE re-stated expectation (below) |

How a refusal reaches the operator, with existing codes only:

- the seal: `SIGN_MANIFEST` fails `SIGNER_FAILED` (retriable; context `signerCode: KEY_COMPROMISED` or `ACTIVE_KEY_CHANGED` in the persistent error log). No manifest, no signature, no item. The recording stays and is sealed after the rotation and a restart (`resume()`);
- a transcript revision: the route loads the signer per request - refused at the load (`SIGNING_KEY_UNAVAILABLE`); a signature that fails is the same refusal;
- an export: `SIGNATURE_FAILED` of the export manifest (its existing catch).

Cost per signature: one `lstat` of the directory, one of the mark, one open-and-read of the pointer (when there is one).

## Checks

| Check | Command (from `apps/core-server`) | Result |
|---|---|---|
| New guard cases | `npx vitest run --project unit src/capture/signer/__tests__/sign-time-guard.test.ts --maxWorkers=2` | first run: `Tests 5 passed (5)` |
| New seal cases | `... src/sealing/__tests__/seal-after-mark.test.ts` | run 1: `2 failed, 1 passed` - my own assertion on the logged cause found that `signManifest` folded the named code into `SIGNATURE_FAILED` (fixed in `seal.ts`); run 2: `Tests 3 passed (3)` |
| Every database-free suite that loads or uses a key, the static rules | `npx vitest run --project unit src/capture/signer src/sealing src/capture/boot src/evidence-verify src/sealing-host src/modules/transcripts src/evidence-export src/capture/fence src/capture/__tests__/static.test.ts test/static test/cli --maxWorkers=2` | `Test Files 5 failed, 80 passed (85)`; `Tests 22 failed, 1421 passed (1443)`. One of the 22 was mine (the pinned count below, re-stated). The other 21 are NOT of this row - see "Reds of other rows" |
| Database suites that sign with a stored key, throw-away clones | `/usr/bin/lockf -k -t 1800 ../../.locks/db-migrate.lock npx vitest run --project db --maxWorkers=2` on `transcript-routes.db`, `transcripts.db`, `finalize-transcript.db`, `last-resort.db`, `stt-states.db` | `Test Files 5 passed (5)`, `Tests 82 passed (82)`; `0 remain with the run prefix` |
| Typecheck | `npx tsc --noEmit` | no error |

The task's three tests:

| Asked | Case |
|---|---|
| a seal after a mark on a running signer host is refused | `seal-after-mark.test.ts` case 1: ONE signer object held across two seals (what `signingNow` holds); the seal before the mark is SEALED, the seal after it `FAILED / SIGN_MANIFEST / SIGNER_FAILED`, cause `KEY_COMPROMISED` in the error log, no manifest, no signature, no item, the retry refused again |
| a transcript revision likewise | case 2: the loader a revision request calls (`loadSealingSigner`) refuses the marked key; a signer taken before the mark refuses the digest; the route's load-per-request line and its refusal of a failed signature are held by their text |
| nothing already sealed is touched | case 1: every file of the package sealed before the mark, byte for byte; `sign-time-guard.test.ts` case 1: the store gains ONE entry (the mark), every other entry byte-identical, an earlier signature still verifies |
| (the pointer) | `sign-time-guard.test.ts` cases 3 and 4, `seal-after-mark.test.ts` case 3: after a rotation the running signer answers `ACTIVE_KEY_CHANGED`; a new load seals under `-02`; a pointer that cannot be taken refuses, never a fall-back |

## Expectations of existing tests changed: ONE

`src/sealing/__tests__/active-key-call-sites.test.ts`, case "each call site is the one line": the count of `activeSigningKeyId(` in the store, 4 -> 5, with the new line pinned by its text. The third place is the sign-time question; it asks the same resolver. Every other existing signer, sealing, transcript, verify and export test ran unedited.

## Reds of other rows (not edited, reported)

| File | What | Likely owner |
|---|---|---|
| `src/capture/boot/__tests__/boot.test.ts` (17 cases), `src/sealing/__tests__/production-key.test.ts` (1) | `CAPTURE_SIGNING_KEY_INSTALLATION_MISMATCH` / `installationId is not a function` | row 228 (agent K3), in flight in `capture/boot/*` |
| `src/sealing/__tests__/active-key-call-sites.test.ts:221` | `boot/index.ts` now has three `load({ dir: directory, now })`, the pin says two | row 228 (information line left) |
| `test/static/search-path.test.ts`, `src/capture/__tests__/static.test.ts` SR-2 | lists of places (`src/core/unit-of-work.ts`, `src/capture/destination-rule.ts`) | other rows of this wave |

`src/sealing-host/index.ts` also carries two lines of row 228 (`captureBootControl(app).provideInstallationId(...)` and its import) that I did not write; left as found.

## Doubles and what stays unproven

- "A running Core" is one kept signer object and the pipeline harness, not a started Core with a session; the route of a transcript revision is held by its text plus the unedited database suite, not by a database case of its own.
- The mark is asked BEFORE the signature: a mark set in the same instant is seen by the next signature (stated in the file header).
- A session whose seal was refused waits, recorded and unsealed in plaintext, until rotation and restart - the state the boot text already names.
- Linux: macOS only here (X-G; 9A/H-nn of the installation chapter).

## DRIVER DECISIONS (for the controller)

1. **No switch without a restart** (`ACTIVE_KEY_CHANGED`), by the design lines cited above.
2. **A signer loaded BY a key id is held to the mark, not to the pointer**: the two host commands load a new key by its id before it is active.
3. **An absent store directory refuses the signature** (`KEY_ABSENT`, fail closed) - no existing test signs after removing its store.
4. **`signManifest` lets a `SignerError` of the signer through**, so the named code is the logged cause.
5. One new signer code. No audit type, no contract change.

## Files

Changed with the Edit tool: `host-key.ts`, `types.ts`, `seal.ts`, `sealing-host/index.ts` (comment), `active-key-call-sites.test.ts`, `delegation_progress/file_claims.md`, `file_requests.md`. New with Write: the two test files, this record, `delegation_progress/row_226b.md`.

---
*Generated: 2026-10-13*
