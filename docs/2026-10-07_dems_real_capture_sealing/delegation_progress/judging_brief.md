# UI judging session — common brief (controller, 2026-10-12; decisions D150, D151, D163, D242)

User instruction (D150): "setelah semua selesai langsung lanjutkan dengan penjurian full
feature dengan ui emulator, perbaiki semua temuannya" — a full-feature judging through the
UI on the emulators (tablet and phone) with the web console alongside; every finding is
then fixed. D151: "skip skenario biometrik" — biometric scenarios are skipped and listed as
skipped, never as passed.

Tree: commit `035150b`. Environment: `initialization/11_gate_environment_judging.md` (read
it IN FULL — lanes, devices, sign-in roles, tooling, rigs, stop procedure).

## Who you are

A JUDGE, not a gate verifier. You use the product as its users would — an investigator, a
supervisor, a technician — and judge every screen, every control and every flow you can
reach: does it work, is it true, is it clear, is it consistent, is anything broken, ugly,
slow, confusing, cut off, overlapping, mislabelled, dead, or missing? You are not limited to
earlier findings or spec check ids. You change NO code and fix nothing.

## Hard rules

1. LOCAL DEVICES (the user's rule D163, by its letter): you NEVER select, pre-check or
   start a source that is this Mac's camera or microphone (`CAM-03`, `MIC-03`, anything
   marked "Core Mac's camera / microphone", LOCAL_DEVICE). Not on a selector line, not
   "select only", not to see a notice. If a flow would require it, stop that flow and list
   it as "not judged — local device". You never confirm a local-device privacy notice.
2. BIOMETRICS: skipped. Answer the offer "Enable biometric sign-in?" with "Not now"; never
   `adb emu finger`; never set, change or remove a device lock or PIN; unlock only through
   `script -q /dev/null apps/mobile/scripts/emulator-user-lock.sh unlock <device>`; never
   print the PIN.
3. SECRETS: never write a password, a pairing code, the camera stub's fixture account, a
   token (`mts_`, `exs_`, cookies) or key material into your report, a file name or a
   screenshot name; never copy a browser console line holding a signed path; mask long hex
   runs. On a device check a sign-in field is empty before typing and never print a
   field's content (`.cache/gates/89c/login.sh` shows a safe way).
4. SOUND: nothing is played aloud — media volume 0 by volume-key events before the first
   playback and back as found; browser headless with audio muted.
5. DATA: never reset or restart lane 2 (its items are the judging material); recordings
   only on the FAKE generated sources, 45-60 s each (stop body
   `{"reason":"<5+ characters>"}` where a body is needed); do not adopt more cameras than
   a scenario needs; leave rigs OFF unless your scenario list names one, and announce rig
   use in `delegation_progress/judging_slots.md` ("<judge> uses <rig> from <time>" /
   "free").
6. SESSION SLOT: one session per lane at a time. Each judge owns the lane named in its
   prompt; before recording on a lane that is not yours, write a line into
   `delegation_progress/judging_slots.md` and check nobody holds it.
7. No idle gaps: a helper session expires 15 minutes after its last POST. Tooling notes
   are in note 11 (screenrecord instead of screencap under load; uiautomator hangs on
   Session Live during a recording; tablet rows low on the screen need scrolling; the
   phone's bell popover is not in the view tree).

## How to judge and what to write

- Walk EVERY screen and every control reachable for each role on your surface; for each
  screen: what it is for, what you did, what happened, verdict OK / FINDING.
- Findings get an id `J<surface>-NN`, a severity (BLOCKER: a core flow cannot be completed
  or evidence integrity / truthfulness is at stake; MAJOR: a feature does not work or states
  something false; MINOR: works but wrong, unclear, inconsistent, clumsy or ugly; NOTE:
  polish or a question), the exact steps to reproduce, what you expected and why (the
  spec line if you know it, common sense otherwise), the evidence (screenshot name +
  one-line description, log line, API answer), and — if you can tell — whether it is a
  product defect, a dev-lane artefact (fake sources, emulator), or a known limit.
- KNOWN, do not report again unless it looks worse than described: GM-01 (web Session New:
  the unreachable-camera row cut at 1440x900), GM-02 (tamper tile counts from the newest
  1,000 audit rows), the library "SurfaceMountingManager" warnings in logcat (count only),
  composite export not available (FFmpeg licence decision), login cards print the demo
  password, generated sources are test patterns and a looped synthetic speech fixture,
  engine words "READY" / "ALL DEVICES READY" beside "Not checked", `profileId` label on New
  Session.
- Also judge as a whole: first impression, navigation, wording and tone (English copy),
  consistency between web / tablet / phone for the same fact, empty states, error states,
  loading states, long text and small-screen behaviour, accessibility labels on the
  devices (uiautomator content descriptions), performance you can feel (time from tap to
  response: note anything over about 2 s with the measured time), and what a first-time
  operator would not understand.
- Screenshots under the folder named in your prompt, each read and described in one line
  in the report. Logcat on a device: cleared after sign-in, read at the end of each flow:
  app ERROR lines listed (emulator graphics lines are not the app).
- End state: no session open on your lane, selector on the FAKE defaults (CAM-01, CAM-02,
  MIC-01 primary, MIC-02 standby), rigs OFF, no active alert you raised (acknowledge /
  resolve what you made), devices signed out on Login, media volume as found.

## Report

ONE file, named in your prompt, with: a one-paragraph overall judgement of the surface (as
a juror: would you accept it for a demonstration to a law-enforcement customer today —
yes / yes with reservations / no — and why); the screen-by-screen table; the flows table
(flow | steps | result | time felt); the findings table sorted by severity; what you could
NOT judge and why; the skipped list (biometrics; local devices); the state you left.
Final response: status, the overall judgement, counts by severity, every BLOCKER / MAJOR in
one line, what you could not judge.
