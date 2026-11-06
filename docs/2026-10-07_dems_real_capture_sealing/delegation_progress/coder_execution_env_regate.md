# coder-execution - gate environment for the re-gates (70 / 75 / 81 / 89 / 94)

- Date: 2026-10-10, 19:03-19:10 WIB. Tree `74fd1f1`. Status: **complete**.
- No product source change, no commit, no git write, no gate check. Nothing refused.

## Files written

| File | What |
|---|---|
| `docs/2026-10-07_dems_real_capture_sealing/initialization/06_gate_environment_regate.md` | the note and the OPERATING SHEET for the re-gates (section 7) |
| `docs/2026-10-07_dems_real_capture_sealing/delegation_progress/coder_execution_env_regate.md` | this file |
| `.cache/gate-env/regate/` (git-ignored scratch) | `reset_{main,1,2,3}.log`, `start_1.log`, `start_2.log` (0600), `phone_lane1.png`, `tablet_lane2.png`, `web_lane1_5176.png`, `web_lane2_5177.png` |

Not written: `status_tasks.md`, `delegation_progress_report.md`, `masterplan/02_plan.md`,
`initialization/05_gate_environment_up.md` (unchanged).

## Left running

Core lane 1 (4421, PID 3547), Core lane 2 with camera stub + speech microphone (4422, PID 3595),
web 5176 (3694), web 5177 (3698), Metro 8081 (3722), `emulator-5554` phone -> lane 1,
`emulator-5556` tablet -> lane 2, PostgreSQL 4432 (untouched).

## Results

- Resets main / 1 / 2 / 3: exit 0 each; lane 2 `2 sealed with the development key`.
- Lane 2 boot: REAL_DEVELOPMENT, `capture-worker/0.5.0`, checks real, `cpu-local` / `vad READY`,
  `DEV_FAKE_MIC_SPEECH`, warn `INSTALLATION_IDENTITY_NOT_CONFIGURED`, 0 error lines.
- Smoke: selector CAM-01 / CAM-02 / MIC-01 / MIC-02; op 93 / 94 = one candidate on 127.0.0.1;
  op 41 clean PASS 15 of 15, tampered TAMPERED (VIDEO-02, 3); op 40 LIVE_STREAM with VIDEO-01 /
  VIDEO-02; lane 1 health, 13 items, demo controls answer.
- Devices: awake, unlocked without any unlock, rules intact, relaunched, Login + Core online +
  paired as DEV-0001 on both; no new pairing.

## For the controller

R-1..R-5 in section 8 of the note: the fixture account is in the sheet and changes at a restart of
lane 2; the smoke left a few audit rows on lanes 1 and 2 (one search `DSC-000001` on lane 2); a
reset keeps `capture_devices` (7 on lane 2, an earlier gate's adopted stub camera - inferred).
