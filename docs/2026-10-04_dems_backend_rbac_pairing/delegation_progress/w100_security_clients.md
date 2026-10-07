# W100 security review (two clients: core-web, mobile, shared live/api) - progress

- Agent: security-review (tier R), read-only
- Started: 2026-10-07 09:48 WIB (load 4.09 at start)
- Output: verification/09_security_clients.md
- Status: complete

## Log
- 09:48 read plan row W100 (02_plan.md:779), SR-16/SR-32 (01_specs.md:1579, :1610), AC-C-65/103/105 (04_client_integration_spec.md:1269, :1336, :1338), MB-6a (:891), W99 sections 9 (W99-1, I-4, I-8, I-9), decisions D203, D242, D243, D246, D247
- 09:49-09:52 static review: web storage keys, core client credential modes, cookie attributes (server half), owed sign-out record, error sink + redaction, login report, API Reference log, Try-it deny list, live-host pinning, packaged CSP, mobile secure-store wrapper (MB-6a), runtime log filter, console mirrors, deep links (+native-intent, debug.ts), cleartext manifests, auth wording
- 09:52 release manifest: android SHA256SUMS.txt 8/8 OK, web SHA256SUMS.txt 6/6 OK + 6 per-file .sha256 OK; newest file under release/ (besides .DS_Store) 2026-10-01 11:48
- 09:53 web targeted vitest (1 worker): 6 files / 72 tests pass
- 09:53 mobile targeted jest (1 worker): 8 suites / 124 tests pass
- 09:54 adb (sandbox blocked tcp:5037 and ps; re-run unsandboxed, read-only): existing adb server PID 83893; emulator-5554/5556/5558 attached; listeners 4400/4420/5173/8081 on 127.0.0.1 only
- 09:55 emulator-5554 `adb logcat -d` (329,236 lines; app com.dems.demo.tablet PID 2681): dvc_/ses_/bio_ = 0/0/0 whole buffer, app PID, ReactNativeJS. The buffer holds pairing/redeem 201 (08:56:56), auth/sign-in 200 (08:59:19), auth/sign-out 204 (09:37:23); no biometric call -> no fresh sign-in needed, UI not driven
- 09:55 AsyncStorage RKStorage copied via run-as (read-only) to the scratchpad: keys dems.mobile.log.v1 / prefs.v1 / sim.v1; dvc_/ses_/bio_ = 0 in every value and byte-level over the file; 'password' only as simulator audit labels in dems.sim.v1; scratch copies deleted 09:57
- 09:56 two GETs via dev proxy: Origin 127.0.0.1:5173 -> 200, localhost:5173 -> 403; health CSP default-src 'none', cache-control no-store
- 09:58 report written: verification/09_security_clients.md

## Result
- Status: complete
- Verdict: CAUTION (0 Critical, 0 High, 1 Medium carried over from W99-1 (not re-triaged), 1 Low, 7 Info; 0 FAIL; 0 blocker)
- W100-1 Low: mobile runtime log has key-only filtering, no value-level ses_/dvc_/bio_ redaction (web sink has it) -> tidy-up or W106-W109 (controller)
- W100-2..W100-8 Info: owed sign-out not retried on mobile (W99 I-4); no CSP on dev page; localhost in packaged CSP / mock-core constants (Simulated paths, frozen release); [DEMS-LIVE] not __DEV__-gated (effectively dev-only); device check had no enrolment / no marker scan (jest covers); W99 I-8 cited; W99 I-9 confirmed intended
- Release manifest unchanged: android 8/8 OK, web 6/6 OK + 6 per-file OK
- Files written: verification/09_security_clients.md; delegation_progress/w100_security_clients.md (nothing else changed)
