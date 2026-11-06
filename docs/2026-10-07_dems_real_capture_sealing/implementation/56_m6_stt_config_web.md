---
task_slug: dems_real_capture_sealing
row: 117
date: 2026-10-09
agent: coder-execution
status: needs-review
---

# Row 117 — Web STT configuration menu (R-8, M6)

Sources: blueprint row 117; ux `08_client_ux_spec.md` §8a (flow 8), §11 (G11, G12); contract
`03_api_contract.md` §2.5 (ops 90-92); check `M6-STTCFG-WEB` (`10_test_strategy.md:581`);
decisions D68, D70, D86, D94, D95.

Status is **needs-review** for one reason only: the mount line is in a file row 67 owns (D95).
The section is built and tested in isolation; see "Mount and leftovers".

## 1. What was built (all under `apps/core-web/src/`)

| File | What | Key lines |
|---|---|---|
| `features/system/stt-config-section.tsx` (new) | `SttSettingsItem` — the whole Settings accordion item, mountable with one import + one line; `SttConfigSection`; the form; `CredentialEditor` | item `:101`; gate state `:146`; save `:188`; credential emptied at send `:204`; test `:243`; credential editor `:513` |
| `features/system/stt-config-model.ts` (new) | Pure rules: validation (field name → message key, never a value), update body (revision + changed members; `model` trimmed, shared `isSttModelId`), refusal classification, `STT_SECRET_FORM_OFFERED = false` | `:47`, `:100`, `:120`, `:168`, `:180` |
| `features/system/stt-config-queries.ts` (new) | The row's own query-factory file: key `['core','stt-config']`, gate (Live, signed in, link up), `sttConfigQueryOptions` (op 90), `updateSttConfig` (op 91), `testSttConnection` (op 92) | `:27`, `:50`, `:65`, `:76`, `:83` |
| `packages/shared/src/i18n/en/system.ts` | Words of the section in the `system.stt.*` block | `:340-412` |
| `features/system/__tests__/stt-config-model.test.ts` (new) | 36 tests | |
| `test/live-system-stt-config.test.tsx` (new) | 34 tests, section rendered in isolation on the contract-checked fake transport | |
| `test/live-system-stt-secret.test.tsx` (new) | 2 tests, SECRET form with the flag mocked on | |

Behaviour, against ux §8a:

| Aspect | Built |
|---|---|
| Content | enabled switch; backend select (`omlx-server` / `cpu-local`); endpoint field (server backend only); model; language shown fixed (Indonesian); speaker labelling switch; credential state ("Set · held as a reference / stored encrypted", "Not set"); last connection test |
| Gate G11/G12 | `CAPTURE_CONFIG`. "Checking your permissions…" with every control disabled until the session is known, the link is up and op 90 answered; then enabled, or disabled with "Read-only: Requires the Supervisor role." Never hidden, never enabled at once |
| Save | op 91 once per press, body = `revision` (of the configuration the edit started from) + changed members only; nothing changed → nothing sent |
| Applies | `appliesFrom: NEXT_SESSION` → banner "Saved — applies to the next session"; `pendingForNextSession` → a waiting note; `NOW` → toast |
| Refusals | 409 `REVISION_CONFLICT` → reload prompt (Save disabled until Reload); 422 `ENDPOINT_NOT_LOOPBACK` → field message "Only a local (loopback) address is allowed" (also checked client-side with the shared rule); 503 `CREDENTIAL_STORE_NOT_READY` → plain sentence next to the credential, not the presenter's "Core server is starting"; other → shared presenter, then own toast + record |
| Test connection | op 92 on the stored configuration; disabled while the form differs; `reachable: false` → inline chip "Not reachable"; 503 `TRANSCRIBER_NOT_READY` → inline notice |
| Credential | write-only; no field until the operator opens it; opens empty always; emptied when the save is sent (whatever the answer), on Close, and when the item is closed (the section unmounts). REFERENCE form only on screen |
| Logging | only `logSystemError` → page reporter → `webErrorSink`, which applies `@dems/shared/redaction`. A record carries operation id, status, code and changed field NAMES. No `useMutation` (no mutation cache holds the body), no web storage, no console |
| Simulated mode | one-line note; nothing is sent |

Try-it deny list: not touched; `updateSttConfig` (op 91) confirmed at
`features/api-reference/try-it.ts:47` and pinned by a static test.

## 2. Real vs stand-in

| Item | State |
|---|---|
| Ops 90, 91 against the Core | Coded to the live contract; exercised here only on the fake transport (contract examples). Not run against a booted Core by this row |
| Op 92 | The Core answers 503 until row 115; the section shows the inline "not ready" notice. The 200 paths are tested on contract examples only |
| SECRET credential | Code present (`CredentialEditor`, `buildSttUpdate`), hidden by `STT_SECRET_FORM_OFFERED = false`; tested with the flag mocked on |
| Simulated mode | No form: a note. The in-app simulator serves ops 90-92, but the web console has no client over it outside the API Reference; not built (decision 3) |

## 3. Commands and results (2026-10-09)

| Command | Result |
|---|---|
| `npm run typecheck -w @dems/core-web` | 0 errors |
| `npm run lint -w @dems/core-web` | no finding in the row's files (3 `react(refs)` warnings in `features/devices/capture-selector-panel.tsx`, row 67) |
| `npm run test -w @dems/core-web -- --maxWorkers=2` on the 3 new files | 72 passed |
| same, plus `live-runtime-static`, `integrity-checks`, `live-system-settings`, `system-page`, `live-runtime-sink`, `core-queries` | all passed |
| `src/test/live-static-ac-c-53.test.ts` | 1 failed — `features/devices/capture-selector.ts: m.actions` (row 67's in-flight file, not fixed here) |
| Mutation check (temporary, reverted): credential text appended to the log context and the clear-at-send removed | 7 tests went red (canary + "field gone after save"), then green again after the revert |

The whole-workspace suite was not run (D94).

## 4. Mount and leftovers (D95)

Before the D95 ownership rule arrived, this row had edited three files it does not own or only
shares. They were not touched again; requests are in `delegation_progress/file_requests.md`
(09:35:01Z, three lines).

| File | What row 117 changed before D95 | Wanted now |
|---|---|---|
| `features/system/settings-panel.tsx` (row 67) | `useState` import; `Mic` import; `import { SttConfigSection }`; `sttOpen` state (+2 comment lines); `onExpandedChange` on the `<Accordion>`; an `<Item id="transcription">` after the `device` item | Replace all six with `import { SttSettingsItem } from './stt-config-section'` + `<SttSettingsItem />` after the `device` item. Do not keep both (same accordion id) |
| `lib/core-queries.ts` (row 67) | doc-table row; `SttConfig` type import; `CORE_QUERY_ROOT` import; `'getSttConfig'` in `CoreReadOperation`; trailing block `STT_CONFIG_QUERY_KEY` / `useSttConfigGate` / `readSttConfig` / `sttConfigQueryOptions` | Remove: unused now (dead exports, harmless if left) |
| `packages/shared/src/i18n/en/system.ts` (shared) | the `stt` block and one key outside it, `settings.transcription`, both by a scripted insert (not the Edit tool) | `settings.transcription` goes when the old `<Item>` goes; `stt.title` was added with the Edit tool |

Today the page works through the pre-D95 Item (same section, same test id); the tests do not
depend on it.

## 5. To wire when another row lands

| Row | What |
|---|---|
| 67 | The mount line above |
| 84 | Set `STT_SECRET_FORM_OFFERED = true` (`stt-config-model.ts:47`) and move the two assertions that pin "reference form only" (`live-system-stt-config.test.tsx`, "never pre-filled"; `stt-config-model.test.ts`, "not offered") |
| 115 | Nothing to change: a 200 of op 92 is already rendered. Check on a booted Core at the gate |

## 6. Browser checks left for the gate — scripted flows (M6-STTCFG-WEB, 2 + 1, agent-browser on a lane)

Entry for all: System → Settings → "Transcription (STT)" (`system-settings-transcription`).

| Flow | Steps | Pass |
|---|---|---|
| F1 TECHNICIAN edit | sign in as TECHNICIAN; open the item; toggle "Speaker labelling"; Save | `stt-config[data-access=allowed]`; one POST op 91; exactly ONE new `STT_CONFIG_CHANGED` audit row (`changedFields: diarization`); toast or banner by session state |
| F2 SUPERVISOR edit while a session is open | open a session; change the model; Save | banner `stt-saved-next`; still one audit row per save; session monitor unchanged |
| F3 Test connection | Save nothing; press "Test connection" | before row 115: `stt-test-not-ready`, no toast; after: `stt-test-result` chip; no audit row |
| F4 INVESTIGATOR | sign in as INVESTIGATOR; open the item (throttle the network to see the first state) | `stt-access` shows "Checking your permissions…", then `data-access=refused` with the role sentence; `stt-save`, `stt-test`, `stt-credential-change` disabled; no POST |
| F5 Credential never rendered | as F1: "Change credential", type a reference, Save; reopen the item; reload the page | field absent after Save and after reopen/reload; page text and DOM hold no typed text; `stt-credential-state` = "Set · held as a reference"; console and network responses hold no reference |
| F6 Refusals | second console saves first, then Save here → `stt-conflict` + Reload; backend "Local server", address `http://192.168.1.9:8000` → field message | as stated |

Not proven by this row: any of F1-F6 in a real browser; the count of audit rows (server side);
visual layout (no screenshot taken; the section uses the panel's existing `sys-*` classes and
utility classes only).

## 7. Decisions taken

1. The item is its own `Accordion.Item` and mounts the form only while open: "cleared on close" holds by unmount, and every opening re-reads op 90.
2. The credential leaves the form state when the save is sent, also on a failed save (ux §8a "sent once"); the operator retypes it.
3. Simulated mode shows a note instead of a simulator-backed form.
4. "Checking your permissions…" is `system.stt.checking`; the web has no shared key for it yet (mobile has its own). Consolidation with row 67's wording is the controller's call.
5. Test connection is disabled while the form is unsaved, because op 92 tests the stored configuration.
6. A local structural type (`SttCallFailure`) replaces the typed client's type: the System folder's static rule (MD-6/TS-15) forbids importing `@dems/shared/client`.
7. The refused-role sentence names the first role holding the permission ("Supervisor"), as the shared presenter does; TECHNICIAN also holds it.
