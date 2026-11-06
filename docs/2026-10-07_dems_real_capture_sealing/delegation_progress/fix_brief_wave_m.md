# Fix wave M — common brief (controller, 2026-10-11, decision D236) — the LAST fix wave

Tree: commit `7b1aded`. Wave M fixes what the four final re-checks left:
`gateway_check/09d_m4_final.md`, `10e_m5_final.md`, `12d_m7_final.md`, `13d_m8_final.md`.
Rulings: decisions D232, D234, D235, D236.

## Rules

Everything in `fix_brief_wave_l.md` ("Rules", incl. THE ONE RULE for real-capture screens
and the device rules) and in `fix_brief_wave_k.md` ("Rules") applies unchanged; claims in
`file_claims.md` as "wave M <driver>". In addition:

1. TESTS GO INTO EXISTING FILES (user instruction, D233). The failing-first test of a fix is
   added to the feature's EXISTING test file (the file that already tests that component /
   module); a test your fix makes obsolete is REPLACED, not kept beside the new one. Do NOT
   create a `wave-m-*` / `fix-*` test file. A new test file is allowed only for a NEW
   module, named after the module. Say in your note, per fix, which existing file took the
   test.
2. Scope is closed: only the items in your prompt. Anything else you notice goes into your
   note's "seen, not changed" list.
3. Member names: M-S writes every new or re-used member / option name with its exported
   example into `delegation_progress/contract_wave_m.md` within its first 20 minutes and
   "MS consistent at <time>" when its tests are green.

## Environment during the wave

- Lane 1 is stopped by M-S at its start (database slots) and started again by M-S at its
  end as `initialization/09_gate_environment_wave_l.md` describes.
- Lane 2 (Core 4422, web 5177) stays UP, data KEPT — never reset. M-W drives its web in a
  headless muted browser; M-M drives the tablet `emulator-5556` (`DEV-0001`) and the phone
  `emulator-5554` (`DEV-0002`).
- Lane 2's Core is restarted ONCE, by M-W, after the "MS consistent" line:
  `scripts/lane/lane.sh stop 2`, then `start 2 --with-camera-stub --speech-mic` (never
  piped, no reset); M-W writes "lane 2 restarted at <time>" into `contract_wave_m.md`.
  M-M expects that restart.
- Rigs (`lane.sh seal-rig 2 …`, and the new `lane.sh source-rig 2 …` once M-S has built
  it and it is loaded): announce "rig in use by <driver> from <time>" / "rig free" in
  `contract_wave_m.md`; never two drivers at once; always left OFF.
- Tooling notes of the re-checks are in `initialization/09_gate_environment_wave_l.md` and
  at the end of the four final reports (screenrecord instead of screencap under load; the
  phone's bell popover is not in the view tree; two browser profiles for two lanes; a
  helper session expires 15 minutes after its last POST).

## Deliverables of each driver

Code + tests; a note `implementation/<nn>_fix_wave_m_<driver>.md` (per finding: cause with
file:line, change, the EXISTING test file that took the test + its output line, what was
proven LIVE versus by test, "seen, not changed", "Checks for the test runner", "re-drive
list"); final response with status (complete | blocked | needs-review), files changed,
decisions for the controller, open items, state left.
