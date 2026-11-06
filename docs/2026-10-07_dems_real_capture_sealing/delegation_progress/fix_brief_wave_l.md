# Fix wave L — common brief (controller, 2026-10-11)

Tree: commit `b05106b` + the uncommitted fix 151 (`implementation/151`, `152`).
Wave L fixes the findings of the four targeted re-checks: `gateway_check/09c_m4_recheck.md`,
`10d_m5_m6_recheck.md`, `12c_m7_recheck.md`, `13c_m8_recheck.md`. Rulings: decisions
D227, D228, D229 and the row after it (re-check 94).

## Rules

Everything in `fix_brief_wave_k.md` section "Rules" applies unchanged (no git write, claims
in `file_claims.md` as "wave L <driver>", totals 97 / 36 / 61 / 67 and schema 6 unmoved,
additive optional members with exported contract examples, targeted tests one run, a test
that fails without the fix, no secrets in notes, never a LOCAL_DEVICE source pre-checked or
started, nothing played aloud, biometrics untouched), plus:

1. ONE RULE for every screen of a Core in its own capture (real-capture lane): it states
   the Core's own fact or "Not reported" / nothing. No sentence, figure, name or status may
   come from the simulator's constants, a bundled demonstration index or a `sim-adapter`
   default. A block that still shows model values carries the "Synthetic demo values" chip.
   The SIMULATED lane is unchanged and stays pinned by tests.
2. Member names: L-S writes every new or re-used member name with its exported example into
   `delegation_progress/contract_wave_l.md` within its first 20 minutes; L-W and L-M poll
   that file, read members BY NAME and import the examples in their tests.
3. On a device: check a sign-in field is empty before typing; never print a field's
   content; biometric offer "Not now"; unlock only through
   `script -q /dev/null apps/mobile/scripts/emulator-user-lock.sh unlock <device>`; no
   lock / PIN / fingerprint change; media volume 0 before playback (volume keys) and back
   as found; no Gradle build.
4. Recordings only where an item needs one: 45 s on the FAKE sources, stop body
   `{"reason":"<5+ characters>"}`.

## Environment during the wave

- Lane 1 is stopped by L-S at its start (database slots) and started again by L-S at its
  end exactly as `initialization/08_gate_environment_wave_k.md` describes.
- Lane 2 (Core 4422, web 5177) stays UP with its data KEPT — never reset. It is shared:
  L-W drives its web console in a headless muted browser; L-M drives the tablet
  `emulator-5556` (`DEV-0001`) and the phone `emulator-5554` (`DEV-0002`), both paired to
  lane 2. Lane 2's Core runs the code it booted with.
- Lane 2's Core is restarted ONCE, by L-W, after the line "LS consistent at <time>" exists
  in `contract_wave_l.md`: `scripts/lane/lane.sh stop 2`, then
  `start 2 --with-camera-stub --speech-mic` (never piped, no reset). L-W writes
  "lane 2 restarted at <time>" into the same file; L-M expects that restart (devices
  reconnect by themselves; sessions are lost — sign in again).
- The seal rig (`lane.sh seal-rig 2 …`) is used only by the driver whose item names it,
  and is left OFF. L-W and L-M announce "rig in use by <driver> from <time>" / "rig free"
  in `contract_wave_l.md` so they never overlap.
- Known state of lane 2: 31+ items, one quarantined session `SES-20261011-0041`, alert
  `ALR-000049` (UNSEALABLE) active, `CAM-04` and `CAM-05` registered on dead ports.

## Deliverables of each driver

Code + tests; a note `implementation/<nn>_fix_wave_l_<driver>.md` (per finding: cause with
file:line, change, test output line, what was proven LIVE (browser / device) versus by
test, "Checks for the test runner", "re-drive list"); final response with status
(complete | blocked | needs-review), files changed, decisions for the controller, open
items, state left.
