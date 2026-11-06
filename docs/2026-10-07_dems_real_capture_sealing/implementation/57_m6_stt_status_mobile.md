# Row 118 — Tablet/phone STT status, read-only (R-8, D20; ux §8a)

Status: complete for the code and the automated tests; device flows left for the gate. Driver: coder-execution, 2026-10-09.

## Built (all under `apps/mobile/src/features/transcription/`)
| File | What |
|---|---|
| `stt-status-model.ts` | Pure view: enabled, backend, model, labelling, `credentialSet` flag, last test outcome (`NEVER`/`READY`/`MODEL_MISSING`/`UNREACHABLE`) + time, pending flag. No member for endpoint, credential kind, revision (`sttStatusOf` :39). `selectSttAuditMark` :57 = seq of the newest `STT_CONFIG_CHANGED` audit row. |
| `use-stt-config.ts` | `useSttConfig` :44. Op 90 `getSttConfig`: LIVE through `live.client.call` (as `features/home/use-health.ts`); SIMULATED/HEARTBEAT through `sim.request` + `SttConfigSchema`. Refresh = (a) change of the audit mark (a web save appends one `STT_CONFIG_CHANGED` row, which reaches the device in the replicated `audit` slice), (b) `onResync` RESYNCED, (c) every mount, (d) 30 s query backstop. Every new failure -> one `reportRuntimeIssue` record. |
| `stt-status-section.tsx` | `SttStatusBlock` :53 (self-contained, embeddable in row 68's capture section) and `TranscriptionSection` :41 (hint + block). Kit only: `SectionCard`, `KeyValueList`, `StatusChip`, `Alert`, `SkeletonGroup`. Error card with rate-limited retry (3/6/12 s countdown, max 3, as `RecoveryBoundary`); stale-data note; pending note "applies to the next session". The only pressable is the retry of a failed read. |
| `i18n.ts` | `features.transcription.*`; registered in `src/i18n/features.ts` (2 additive lines). Shared words: `common.status.enabled/disabled`, `common.actions.retry/retryIn`. |
| tests | `stt-status-model.test.ts` (5), `stt-status-section.test.tsx` (11: phone + tablet, web-edit follow, credential never shown, error/retry, signed-out, LIVE over the fake transport incl. an audit delta), `stt-status-static.test.ts` (4: only `getSttConfig` named, no control kit part, one `onPress` = `retry.run`, no endpoint/credential reads). |

## Real vs stand-in
Real: op 90 in both sources (simulator handler and typed Live client); the refresh path is the replicated audit slice. Not real: the test-connection result only reaches a device on the next read (op 92 writes no audit row) — bounded by the 30 s backstop, said plainly.

## Results (commands from repo root)
- `npm -w apps/mobile exec -- jest --maxWorkers=2 --silent src/features/transcription src/i18n` -> 4 suites, 29 tests passed.
- Negative controls: the affordance counter finds a Switch/TextInput/Pressable (test 1); removing the audit-mark refetch makes 3 tests fail (run, then restored).
- `npm -w apps/mobile run typecheck` -> clean at the time of the run. `eslint src/features/transcription src/i18n/features.ts` -> clean.
- Red tests caused by the section being added (not mine to edit, requests filed in `file_requests.md`): `navigation-units.test.ts` registry test (needs `'transcription'`), `settings-model.test.ts` System rows (+`transcription`), `more-screen.test.tsx:121` section count.

## Edits outside my folder — disclosed (D95)
Before the D95 ruling reached me I edited three row-68 files with the Edit tool (small, additive): `navigation/params.ts:32` (+`'transcription'` in `SETTINGS_SECTIONS`), `features/settings/settings-model.ts` (+`'transcription'` in `SettingsIcon`, a `SETTINGS_ROWS` row between network-time and maintenance, `SECTION_TITLE_KEYS.transcription`), `features/settings/settings-controls.tsx` (+`Mic` import, `SETTINGS_ICONS.transcription`). I did not touch them again. Row 68 has since added the `case 'transcription'` in `section-body.tsx` (I did not write it). `src/i18n/features.ts`: 2 additive lines.

## Left for the gate (scripted flows, D89)
- M6-STTCFG-TAB (`dems2_tablet`, lane 2) and M6-STTCFG-PHONE (`dems2_phone`, lane 1), 2 runs each: Settings -> Transcription status; enabled/backend/model/labelling/credential/last test visible; 0 operable controls; a web save (TECHNICIAN) shows on the device without leaving the screen; INVESTIGATOR sees the same read-only view. No PIN typed by an agent.
- Not run here: any emulator, adb, build.

## To wire when row N lands
- Row 68: if the capture section embeds the block instead of the separate section, use `<SttStatusBlock />` and drop the separate row. Row 117/113: nothing needed; row 84: `credentialKind` stays unused on mobile.
