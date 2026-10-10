# coder-execution - fix wave H, driver E (2026-10-10)

- Status: **needs-review** (code and fast proofs done; the session case and the full set-up command are handed to the test runner; six decisions for the controller).
- Note: `implementation/125_fix_wave_h_e.md`.
- No commit, no migration, no lockfile write, no dependency. The speech server on 127.0.0.1:8000 was never called; no STT speed figure anywhere; no camera or microphone opened; the audio handled is synthetic, under `.data/` and `.cache/`, never played.

## Files

| File | Change |
|---|---|
| `apps/core-server/src/capture/fence/fake-mic.ts` | NEW: `fakeMicDecisionOf`, the one reader of the setting; two refusals |
| `apps/core-server/src/capture/fence/boot.ts` | own block: the two refusal codes and texts, one call, `fakeMic` in the outcome, one log line |
| `apps/core-server/src/capture/fence/generated-sources.ts` | microphone half: option `speechFixture` |
| `apps/core-server/src/capture/fence/index.ts` | own lines: header line, one export line, `speechFixturePath` of the registry input and its wiring |
| `apps/core-server/src/capture/adapters/local/mic-helper-args.ts` | source kind `FIXTURE`, its input literals, the path shape |
| `apps/core-server/src/capture/adapters/local/mic-helper.ts` | the fixture held to the path rule at prepare and start |
| `apps/core-server/src/capture/adapters/local/errors.ts` | ONE reason `FIXTURE_REFUSED` |
| `apps/core-server/src/capture/adapters/local/index.ts` | the microphone export line |
| `apps/core-server/src/config.ts`, `src/plugins/config/load-config.ts` | WAIVED lines: the key `DEMS_CAPTURE_DEV_FAKE_MIC` |
| `apps/core-server/src/capture/__tests__/static.test.ts` | pins by delta: `WAIVED_CONFIG`, the `ENV_` list, the fence file list + `fake-mic.ts` |
| `apps/core-server/src/capture/fence/__tests__/fake-mic.test.ts` | NEW, 14 tests |
| `apps/core-server/src/capture/adapters/local/__tests__/{mic-helper-args,mic-helper}.test.ts` | + 5 and + 3 tests |
| `apps/core-server/src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts` | mode `SPEECH` + one describe; NOT run |
| `scripts/capture/speech-fixture.mjs` | NEW: the fixture step |
| `scripts/capture/dev-setup.mjs` | calls it; options `--no-speech-fixture`, `--renew-speech-fixture` |
| `apps/transcriber/test/real/{wave-h-speech-fixture.real.test.ts,wave-h-speech-pipeline-child.ts}` | NEW: the one engine run |
| `apps/transcriber/test/real/real-support.ts` | one `RunKind` member, four constants |
| `apps/core-web/src/features/system/{stt-config-model.ts,stt-config-section.tsx}` | G81-03: the hint names every role of the access rule |
| `apps/core-web/src/test/live-system-stt-config.test.tsx` | one expectation |
| `delegation_progress/{file_claims.md,file_requests.md}` | three claim lines; two request lines |

Git-ignored artefacts left in place: `.data/dev-fixtures/speech-mic/{dialogue.wav,dialogue.reference.json}`, `.cache/wave-h-e/probe/`, `.cache/stt/checks/wave-h-e/runs/20261010T095642543Z-84699-wave-h-speech-fixture/`.

## Requests filed (`file_requests.md`, 10:04:00Z)

1. Driver D, `scripts/lane/lane.sh`: the option `--speech-mic` for the development lane, and `-u DEMS_CAPTURE_DEV_FAKE_MIC` in `lane_env` for every lane.
2. Docs owner, `README.md`: the setting and the fixture, three boot codes, and the four limits of the transcript step as named settings (no speed figure).

## Blockers

None. Foreign red at the time of my runs (not fixed, by rule): the fence file-list pin lacks driver D's `development-discovery.ts`; `test/static` names driver C1's `receiver-cli.ts` and the new unit `src/evidence-facts`; typecheck stops on `packages/shared/src/sim/generator.ts(27,15)` and on other drivers' in-flight files.
