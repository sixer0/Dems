# Row M2b (track D) - addendum to the security review of the macOS production microphone path

- Agent: security-review. Date: 2026-10-13 18:42 (host `date`).
- Status: **complete**.
- Verdict on revision 2 of the design: **CAUTION, 0 FAIL, FINAL for the design.** Two sentences of SR-15 (the pre-check list, the one-section push list) stay provisional until one run on a generated source, no device.
- File written: `verification/08b_security_macos_microphone_addendum.md` (Tier 1). File written: this one.
- No source file changed. No device opened; no command that asks the system for microphone or camera access. `decisions/decisions.md` and the tracking files were not written.
- Commands of this row: reads and searches of the working tree, `date`, and two in-place corrections of this row's own addendum (the time stamp; five line numbers of `apps/capture-worker/src/audio.c`).

## Counts

40 requirements (SM-01 to SM-40): PASS 9, CAUTION 31, FAIL 0. Gates (8): SM-02, SM-04, SM-14, SM-16 (kept); SM-29, SM-30, SM-33, SM-36 (new). SM-26 (the measurement row) is closed as met. New: SM-29 to SM-40.

## Rank-1 list (addendum section 2)

1. The addendum adopted; SR-15 in the words of its section 8 confirmed. Gate of every build row.
2. The design amended in place with the contract words of SM-29, SM-30, SM-34 (3), SM-36. Gate of N1 and N2.
3. The worker's baseline (binary hashes, the BR-11 series, the kill matrix, the comparison outputs) taken BEFORE the first edit. Gate of N3.
4. The four forms of the helper row no measurement ran, run on a generated source before N4's pins close.
5. Two rows the design lacks are cut: verdict lines and export (SM-37); transcript (SM-38). Before N15.
6. The user is told: the signed record says a tenth of the sound is missing; the "standby" ends with the primary's capture program; the application that hosts the agents holds a standing microphone grant.

## Findings the controller should not miss

1. **A package of this path could be sealed with no shortfall statement** (the member comes from audit rows only). The seal must anchor on the source-fact key written at the start and write a record with null numbers where the row is missing; no member, no `REAL` seal (SM-36).
2. **The account as designed leaves zeros and discards outside it**, read in `apps/capture-worker/src/audio.c`: silence before a microphone's first sample and a start on silence after 3,000 ms (`:91`, `:439`, `:570`); received samples discarded at `:396` (counted, only logged), `:431` and `:582` (uncounted); a non-finite sample made zero at `:393` (uncounted). The worker is started before the helpers (`apps/core-server/src/capture-session/index.ts:2217`, `:2228`) and the macOS launch with its pause and retry can pass 3,000 ms (SM-29).
3. **The resampler stays in the path** of a gapped microphone (`audio.c:356-358`, `:399`); "the controller asks for nothing" does not remove it. Shown transparent by a marker, or bypassed (SM-31). Hypothesis, not run.
4. **"The silences are near the holes" is not supported by the code** (design 7.2, 8.5): the zero runs follow the beat of the worker's 10 ms quantum against the helper's 11.9 ms read, and a lost packet leaves no trace in the arrival times. The sentence must not reach a document, a notice or the evidence (SM-30 (5)). Hypothesis read from the code, not run; row N3's marker stand-in settles it.
5. **Counts are not enough for long runs**: every inserted run of 100 ms or more on the feeding microphone carries its position under the signature; the track's own total is stated (SM-30).
6. **The design's W17 is not accepted for a helper group that delivers nothing**: it is stopped after 5,000 ms, read from the worker's received count (SM-06 restated).
7. **The account record is sent for a gapped microphone only**: a Linux session gets no new record kind (SM-33 (4)).
8. Not read by this row: the sealing pipeline, the forwarder, the supervisor, the transcriber's sources, `micwatch.c` beyond its function names. SM-36 to SM-38 say what must hold, not where.

## Blockers

None. Decisions for the controller: the rank-1 list; SM-30 (6) (a hashed side file with every inserted run - recommended, not required, the user's to take); the option of the addendum's section 11 (a counting-only measurement of the system's audio interface is recommended even if the own reader is never built).
