# I-9d integration pass (wave 12, track D) - fixed list of decision C139

Agent I-9d, 2026-10-14. Mechanical. Every change made with the Edit tool on an existing file after re-reading; no whole-file write, no scripted replace; count pins moved by delta (none moved). Claims line appended to `delegation_progress/file_claims.md` first. No throw-away database was created, nothing was left running. Status: complete, item (6) stopped by an import rule (as the brief orders).

## Items

| # | Source | Result |
|---|---|---|
| 1 | request 560 | DONE. `apps/core-server/src/capture/__tests__/static.test.ts` (case "SR-15 (1) at the table", now :1780-1781): `.toEqual([TABLE_FILE, 'src/capture/boot/index.ts', 'src/capture/fence/production-parts.ts'])` plus the comment given. The line's text matched the code. |
| 2 | request 549 | DONE. `config.ts:29` and its pin (`capture/__tests__/static.test.ts:933`) and `config.ts:313` and its pin (`:1023`) now say `DEMS-SITE-21`; four single edits, config line then its pin. Grep of `apps/core-server/src` and `test`: no other file pins the old texts (`sealing-host/installation-identity*.ts` carry `DEMS-IR-01` in other sentences - seed data, untouched). `packages/shared` not touched. |
| 3 | request 551 | DONE. `usb-audio-production.test.ts` case "registered nowhere" (:1077-1082): `expect(importers.map((entry) => entry.file)).toEqual(['src/capture/adapters/audio/usb-audio-macos.ts'])` with the reason (design 06 s4.4; rule A-9). Loader assertions unchanged. |
| 4 | request 561 | DONE. `core/audit-details.ts`: `SYSTEM_BOOT_MICROPHONE_PERMISSION_STATES = ['NOT_KNOWN']`, `SYSTEM_BOOT_MICROPHONE_DETAIL_RULES` (OPTIONAL, form `one of NOT_KNOWN`, accepts only that string), entry `microphonePermission` in `SERVER_AUDIT_OPEN_DETAIL_RULES[SYSTEM_BOOT]` after `addressHelperSocket` (never null), with doc comments. `core/__tests__/writers.test.ts`: key-list pin + `'microphonePermission'`; one case beside the HC case: `NOT_KNOWN` accepted; null, '', 'KNOWN', 'not_known', 1 refused with `AUDIT_DETAIL_VALUE_INVALID`. writers 157/157. |
| 5 | caution C-6 (086, line 81) | DONE. `capture/adapters/__tests__/static.test.ts`: nested `describe('C-6: ...')` inside the A-8 block, two cases: (a) planted control - a door call carrying `onDiagnostics`, a bare `start.onDiagnostics` are both found, a clean call is not; (b) `relay-start.ts` has exactly one `.door(` call with exactly today's argument members and names `onDiagnostics` nowhere. Reason "C-6 / C139" in the comment. Adapters static 35/35. |
| 6 | request 558 (HA files) | STOPPED. Import was applied (`import { CAPTURE_INTERFACE_NAME_PATTERN } from '@dems/shared/api'` in `host-alias/caller.ts` and `facts.ts`), then reverted by single edits (both files are byte-equal to their state before this row in these places). Refused by two import pins: `capture/host-alias/__tests__/caller.test.ts:474-476` (case "imports: the destination rule's types and the protocol file...", expects `caller.ts` -> `['../destination-rule', './protocol']`) and `capture/host-alias/__tests__/lifecycle.test.ts:1033-1035` (expects `facts.ts` -> `['../destination-rule', './caller', './protocol']`); `@dems/shared/api` appeared as a third import. A third red was the same family (3 failed in that run). To do the item, the owner of those two tests adds `'@dems/shared/api'` to both lists in the same step. `boot/program-checks.ts:131` and `fence/production-parts.ts:643` (the other two copies) are not in my list. |

## Item 7 - re-runs, one each

| Case / file | Result line | Attribution |
|---|---|---|
| `src/__tests__/capture-composition.test.ts` ("THE EXIT RULES PER ROW (SM-10)") | green: 76 passed, 1 skipped (the skipped case is "row N7: ... REAL TEXTS of this Mac through the seam", skipped by design) | The earlier red is not reproduced; it was another row's state before its fix. |
| `capture/adapters/camera/__tests__/onvif-network.test.ts` (169.254 source case) | inside the command sandbox: 33 failed, `listen EPERM: operation not permitted 127.0.0.1` (the double binds loopback); outside the sandbox: 33/33 passed, including "a rule that names 169.254.10.20 as the source" | Sandbox, not code. Green. |
| `capture/__tests__/static.test.ts` | 80/80 passed | The pin it needed is item 1 (+ item 2's two pins). |
| `capture/adapters/__tests__/static.test.ts` | 35/35 passed (includes the two new C-6 cases) | - |
| `modules/capture-config/__tests__/static.test.ts` | 17/17 passed | - |

Also run (touched or neighbouring): `usb-audio-production.test.ts` 45/45; `core/__tests__/writers.test.ts` 157/157; `host-alias/__tests__/caller.test.ts` 22/22 and `lifecycle.test.ts` 99/99 (green again after the revert); `src/__tests__/host-alias-socket.test.ts` 19 cases: in the sandbox 14 failed with `listen EPERM` on a unix socket, outside it 95/96 together with capture-composition (1 skipped) - sandbox, not code.

## Typecheck and lint

`npx tsc --noEmit` (apps/core-server): 9 errors, none in a file of this row. By file: `src/capture/adapters/mic-transport.ts` (2: TS1360, TS7053 - agent N13's protocol change), `src/capture/__tests__/fault-lifecycle.test.ts` (1), `forwarder-advisories.test.ts` (1), `forwarder-engine.test.ts` (2), `src/capture/fence/__tests__/development-session.db.test.ts` (2), `test/support/capture.ts:262` (1, TS2739). Same list the brief names. No error from `packages/shared`, `rows.ts`, `credential.ts`, `production-door.ts` at this moment.

`npx oxlint` (apps/core-server): warnings only, none in the files of this row (seen: `macos-helper-lines.test.ts`, `macos-card-listing.test.ts`, `camera-watch.ts`, `boot/__tests__/support.ts`, `capture-composition.test.ts:34` unused import `MacosListingRow` - other rows').

## Mutation honesty

- C-6: the planted control (a door call with `onDiagnostics`, a bare name) is the mutation; the control case was seen RED once during writing (my regex stopped at the nested `{}` of `env: {}`), corrected to `/\.door\s*\([^;]*;/g`, then green. `relay-start.ts` itself was not mutated (not my file).
- Item 4: the key-list pin and the refusal loop fail without the rule entry (removing the entry changes `Object.keys`); I did not run that mutant.
- Items 1-3: pin moves, no new guard.

## Unproven / left

Item 6 only (see above). Nothing for the hardware package.
