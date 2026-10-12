# Fix wave J — the findings of the UI judging session (controller, 2026-10-13, decision D243)

User instruction (D150): "…penjurian full feature dengan ui emulator, perbaiki semua
temuannya" — FIX ALL FINDINGS. Tree: commit `035150b`. The four judging reports are your
work list — read the ones that concern your area IN FULL, every finding, not only the
headline ones:

- `report/judging_a1_tablet.md` (JT-nn) — tablet, real capture
- `report/judging_a2_phone.md` (JA2-nn) — phone, simulated lane
- `report/judging_b1_web.md` (JW-nn) — web console, both lanes
- `report/judging_b2_motion_on.md` (JM-nn) — both devices in the NORMAL launch form
- plus `gateway_check/14_wave_m_confirmation.md` GM-01, GM-02 and the carried UI items of
  `implementation/163_row97_blueprint_list.md` section 6 (B8 remainder, RC-7 link).

## What "all" means

Every BLOCKER, MAJOR and MINOR that falls in your area is FIXED, or listed in your note in a
table "not fixed" with the exact reason (needs the user's decision — name it; needs a
contract total to move; needs a native build; not reproducible — with what you tried; is a
dev-lane artefact — why). NOTES: fix the ones that are one-line or plainly wrong; list the
rest. A finding that spans areas: each driver does its half and names the other half's
owner in `delegation_progress/contract_wave_j.md`.

## Rules

Everything in `fix_brief_wave_m.md` ("Rules"), `fix_brief_wave_l.md` (THE ONE RULE for
real-capture screens; device rules) and `fix_brief_wave_k.md` ("Rules") applies: no git
write; claims in `file_claims.md` as "wave J <driver>" BEFORE writing (two mobile drivers
share `apps/mobile`: a file claimed by the other is not yours — write a request line to
`file_requests.md` and continue); contract totals 97 operations / 36 GET / 61 POST / 67
audit types and schema 6 / dbc-7 do NOT move — additive optional members with exported
examples only; a fix has a test that fails without it, and the test goes INTO THE EXISTING
test file of that feature (no per-wave test file); no secrets in notes; nothing played
aloud; no Gradle build; no installs. In addition:

1. LOCAL DEVICES — the user's rule by its letter: no driver SELECTS, pre-checks or starts
   this Mac's camera or microphone (`CAM-03`, `MIC-03`, LOCAL_DEVICE). Not "select only".
2. THE PROOF FORM FOR THE DEVICES IS THE NORMAL LAUNCH (motion ON):
   `am force-stop <package>` then
   `adb -s <serial> shell monkey -p <package> -c android.intent.category.LAUNCHER 1`
   (see `report/judging_b2_motion_on.md` for both forms). `motion=off` is a test switch
   and proves nothing about what an operator sees. Mobile component tests must not rely on
   reduced motion to pass: where a fix concerns animation, test BOTH modes.
3. TRUTH RULES (they decide most findings):
   a. An item / session that is not sealed never shows sealed values, a manifest, a
      signature or a PASS — on ANY lane, the SIMULATED one included: a demonstration may
      be marked as a demonstration, it may not state a falsehood about its own state.
   b. An item whose verification of record FAILED never reads plain "Sealed": its status
      everywhere states the failed verification.
   c. ONE statement of system state per fact, the same on every surface: an active alert,
      a seal being retried or blocked, an unreachable source, a lost Core link each change
      what Home / header / pill / ring say AT ONCE (a lost link within a few seconds:
      "Core offline — state unknown", never "Ready").
   d. A thing the build cannot do is not offered as if it could (Composite export): the
      choice is disabled with its reason, a request for it is refused before any job,
      and nothing logs a success that did not happen.
   e. A destructive or disruptive action (Install update, anything naming a restart /
      reboot) asks for confirmation with what will happen.
   f. The SIMULATED lane says DEMO / SIMULATED wherever it shows a feed, a recording
      state or an integrity statement; the real-capture lane shows no simulator constant
      without the "Synthetic demo values" chip.
4. A ruling reversed: the devices GET the "Retry sealing" control for the roles op 33
   allows (investigator, supervisor) — D228 (1) left a tablet-only operator stuck (JT-02).
5. Member names: J-S writes every new or re-used member with its exported example into
   `delegation_progress/contract_wave_j.md` within its first 30 minutes and
   "JS consistent at <time>" when its tests are green; clients poll that file and read
   members BY NAME.

## Environment during the wave (see `initialization/11_gate_environment_judging.md`)

- Lane 2 (Core 4422, web 5177, REAL_DEVELOPMENT) with the TABLET `emulator-5556`
  (`DEV-0001`): data KEPT — never reset. Lane 1 (Core 4421, web 5176, SIMULATED) with the
  PHONE `emulator-5554` (`DEV-0002` of lane 1): may be reset by J-P only.
- Reverse rules differ per device (`tcp:4420` -> 4422 on the tablet, -> 4421 on the
  phone; `tcp:8081 tcp:8081` on both): a wrong port makes the app delete its pairing —
  read them back after every relaunch.
- Both Cores run the code they booted with. They are restarted ONCE each, by J-W, after
  the "JS consistent" line: lane 2 with `scripts/lane/lane.sh stop 2` then
  `start 2 --with-camera-stub --speech-mic` (never piped, NO reset); lane 1 with
  `stop 1` then its normal start (no reset). J-W writes "lanes restarted at <time>" into
  `contract_wave_j.md`; the mobile drivers expect it (devices reconnect; sign in again).
- J-S needs database slots for its db tests: one worker; if PostgreSQL answers "remaining
  connection slots", J-S announces in `judging_slots.md`, stops lane 1 for the run and
  starts it again at once (J-P expects short outages of lane 1).
- Session slot and rigs: one session per lane; announce in `judging_slots.md` as the
  judges did; rigs OFF at the end. Recordings 45-60 s on the FAKE sources.

## Deliverables of each driver

Code + tests; a note `implementation/<nn>_fix_wave_j_<driver>.md` with: the table of EVERY
finding of your area (id | severity | fixed — how, file:line, test file + line | not fixed
— reason); what was proven LIVE in the normal launch form / in the browser versus by test;
"Checks for the test runner"; the re-drive list for the confirmation judge. Final response:
status (complete | blocked | needs-review), counts (fixed / not fixed per severity), files
changed, decisions for the controller, state left.
