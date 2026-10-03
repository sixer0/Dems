---
task_id: 2026-09-30_dems_demo_stack_setup
step: 63 (mobile security review incl. release APK; FAST-TRACK D112, parallel run)
agent: security-review
status: complete
verdict: CAUTION (0 FAIL; 0 high or critical in the APK; 6 low-risk CAUTION items with owners)
date: 2026-10-01
---

# Step 63 progress: mobile security review

## Timeline (WIB)

| Time | Activity |
|---|---|
| 10:50-10:53 | Read row 63 (rev 6); 06_packaging_spec §2.2, §2.6, §2.9, §2.10 and §6.2; decisions D44, D45, D47, D50, D94-D117; implementation/69 |
| 10:53-10:56 | Checked the APK SHA-256 (matches 0009f33d…5ecd). Unzipped it into the session scratchpad. Ran `aapt2` xmltree, permissions and badging; `apksigner` (JDK 17); `zipalign` |
| 10:56-10:59 | Signing folder: permissions, `git check-ignore`, `git ls-files`. Property names only, values redacted. AC-PK-A8 password greps with positive controls over docs/, release/, the APK, git (index, untracked, all revisions) and the workspace (62 s) |
| 10:57-11:01 | Hermes bytecode disassembly (`hermesc -b -dump-bytecode`). Enumerated URL strings. Proved in bytecode that the `__DEMS_DEBUG__`, `&scenario=` and Heartbeat `__DEV__` gates compile to constant false. Found the ungated `?debug=1` overlay |
| 11:01-11:05 | Source review: AsyncStorage keys, log privacy filter, sim snapshot partialize, demo credentials and presentation mode, biometric options, secret-pattern scans (source, APK, docs), DEMO evidence certificates, expo-updates/EAS absence, telemetry endpoints |
| 11:05-11:08 | `device-session.sh` signal paths; Maestro footprint (`analytics.json` enabled=false); `npm audit --omit=dev -w @dems/mobile`; dependency paths; install guide; THIRD_PARTY_NOTICES; design-book shingle check; step-94 Gradle daemon log password grep (0) |
| 11:08-11:09 | `npx jest --ci` on 5 security-relevant suites → 57/57 PASS |
| 11:09-11:13 | Wrote verification/09_mobile_security.md and this file |

## Result

- **Verdict:** CAUTION. Nothing blocks step 96 or the demo.
- **AC-PK-A8:** PASS. The keystore password was found nowhere outside `apps/mobile/signing/`. That includes docs/, release/, the APK, git history and the step-94 Gradle daemon log. Every grep ran with a positive control.
- **Release APK:**
  - signature: v2-only, one signer, DEMO DN, certificate equals the keystore;
  - manifest: not debuggable, no cleartext, `allowBackup=false`, the 3 blocked permissions absent, 2 expected exported components;
  - no expo-updates, EAS or projectId;
  - loopback is the only network target;
  - debug handle, `&scenario=` and Heartbeat are inert in release (proven in bytecode).
- **npm audit (mobile, prod):** 0 critical, 1 high, 41 moderate.
  - The high (undici) sits under `@dems/shared → @scalar` and is not in the APK; it is a D45 web-only item for step 62.
  - Only `decode-uri-component` (moderate) reaches the runtime bundle (F63-04).

## Findings and owners

| ID | Finding | Owner |
|---|---|---|
| F63-01 | The install guide turns on the global Unknown sources switch (Android 7) and USB debugging, with no "turn it off again" step | Step 96 doc touch-up; else known issue |
| F63-02 | The `?debug=1` deep link turns on the performance overlay in release (not `__DEV__`-gated) | Known issue |
| F63-03 | No licence or notices files ship with the APK. The fonts are OFL-1.1, and the About screen points to the repository | Step 96 (release `licenses/`); else known issue |
| F63-04 | decode-uri-component GHSA-vcc3-ghjq-m6fr is in the runtime bundle (local DoS through a deep link); no fix available | Known issue |
| F63-05 | The build script runs `expo prebuild`, which can clear `android/` (DR-94-1); there is no automatic debug-APK backup | Known issue (D117); step 96 if it rebuilds |
| F63-06 | The Maestro `e2e` npm script lacks `MAESTRO_DISABLE_UPDATE_CHECK` and an output dir (D47) | Known issue / README step 60 |

Informational notes I-01 to I-10 (host paths in the native libraries, the loopback heartbeat in release, the untested fail-fast branch, the single ignore rule for the properties file, the public `/stack-check` route, event-bound biometric, checksum vs authenticity, PGID reuse, the web-only undici, no `FLAG_SECURE`) are listed in the report §4.2.

## Files created

- `verification/09_mobile_security.md` (Tier 2; verdict, checklist evidence, findings, GDPR and ISO tables)
- `delegation_progress/security_review_step_63.md` (this file)

**Not written (parallel isolation):** delegation_progress_report.md, status_tasks.md, masterplan/02_plan.md and implementation/99_implementation_report.md. These are shared files; the controller synthesises them.

## Decisions and notes for the controller

- **Read-only.** No device session, no build and no server. On-device behaviour comes from implementation/69 §5 plus the bytecode proofs.
- **Scratch files.** All scratch artefacts (the unzipped APK, the disassembly, the audit JSON) are in the session scratchpad, outside the repo.
- **Outside-workspace reads.** Three, all read-only:
  - `~/.maestro/analytics.json` and `~/Library/Logs/maestro`: the D47 footprint;
  - `~/.zprofile`: a count of the word maestro only;
  - `~/.gradle/daemon/9.3.1/daemon-26732.out.log`: the step-94 build log, password count only.
- **Network.** One external request: `npm audit` to registry.npmjs.org, which sends dependency names and versions, as the task asked.
