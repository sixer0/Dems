# coder-execution - fix 151 (manifest profile = the declared format)

Status: complete. Note: `implementation/151_fix_manifest_profile_declared.md`.

Files changed: `apps/core-server/src/capture/fragments.ts`, `src/sealing-host/session-reader.ts`,
`src/capture-session/facts.ts` (comment), `src/sealing-host/__tests__/wave-k-s1-stream-profile.test.ts`
(pins by delta). New: `src/sealing-host/__tests__/fix-151-declared-profile.test.ts`,
`fix-151-init-segments.ts`. Docs: note 151, `initialization/08_gate_environment_wave_k.md` (appended
section), `delegation_progress/file_claims.md` (one line), this file.

Results: 26 of 26 in the two test files; 118 files / 1742 tests in sealing, sealing-host, capture,
capture-session, evidence-verify and test/static; typecheck and lint of core-server and shared exit 0.
Smoke: `EV-20261011-0026` states `H264_720P30` twice, no notice, verify PASS 15 of 15; `-0025` and
`EV-20261010-0015` PASS. Lane 2 PID 55401, both devices online and paired.

Open: the text of spec erratum PE-WK-16 (docs pass); delivered frames are stated nowhere; HEVC and
streams without timing information declare no rate (note 151 section 7).
