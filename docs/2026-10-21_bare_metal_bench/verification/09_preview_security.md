# Security Review 09: live camera preview, idle meters, C1-C4

Written by the controller from the security-review agent's report (the agent was read-only). Date 2026-10-23. Scope: uncommitted tree on dems, rows 89a/90P/91c and C1-C4 (D47-D50). Level L3, read-only; test numbers quoted from reports 89-91, not re-run by the reviewer.

## Verdict: CAUTION (High 0, Medium 4, Low 8). No credential leak or injection FAIL.

## Issues

| ID | Sev | Location | Finding | Remediation |
|---|---|---|---|---|
| M1 | Medium | packages/shared/src/api/devices.ts:687,689; sim/auth.ts ROLE_PERMISSIONS | ANY_OF(SESSION_START, CAPTURE_CONFIG, DEVICE_MANAGE) includes TECHNICIAN (no SESSION_START); with M2 a technician can watch an interview while it is recorded. Each token is audited. | User decision: SESSION_START only, or keep ANY_OF but restrict viewing during an active session |
| M2 | Medium | capture-composition.ts:784-786, :709; preview-manager.ts PREVIEW_PAUSE_MAX_MS=60000 | Preview resumes after push-established, becoming a 2nd RTSP client + decode/encode on the Core during recording; camera session limits, bandwidth, CPU contention unproven; in-relay re-open after loss does not yield preview; 60 s pause can end between precheck and start | Keep preview paused from CREATE to end of capture until bench proof, or config switch off by default |
| M3 | Medium | relay-start.ts:148,233-235; production-door.ts:569,722; guard.c | FFmpeg decodes camera-controlled bitstream as the Core uid; guard sets only core limit 0; no NO_NEW_PRIVS/seccomp/uid drop/network isolation (relay itself sets NO_NEW_PRIVS, relay.c:167). Attack-surface increase (hypothesis, no known exploit) | Dedicated unprivileged uid without network, at least PR_SET_NO_NEW_PRIVS + seccomp in the guard child; CVE tracking of FFmpeg 9.0.2 |
| M4 | Medium | idle-meter.ts:219,428-437; camera-preview/service.ts:285-292; devices.ts:689 | holdIdleMeters opens real mics outside a session; any role; lease per operator, not bound to auth session; renewable forever; no audit row. Content not stored (PCM only to level reader; levels via applyCaptureTelemetry). 20 Hz levels reveal room occupancy/speech timing | Audit row on helper start/stop (not per renewal); bind lease to auth session, end at sign-out; visible "microphones live" indicator; DPIA/records of processing |
| L1 | Low | service.ts:303-311 | Token multi-use within 60 s (same operator/session) | Consume on first join or document |
| L2 | Low | preview-manager.ts:65,140-148 | Global caps only; no per-operator cap, no max stream lifetime | Per-operator cap 2; max duration ~10 min |
| L3 | Low | service.ts:350-364; camera-preview/index.ts:54 | Stream re-checks only auth-session end; no permission/role/device re-check; no CLOSED row/duration | Re-check permission each tick; CAMERA_PREVIEW_CLOSED with duration |
| L4 | Low | service.ts:239-246,306 | Evicting oldest token at 256 makes a pending legit token PREVIEW_SESSION_INVALID + ACCESS_DENIED row | Treat evicted as EXPIRED, or per-operator store |
| L5 | Low | audio-cards/service.ts blocks() | C2: PRIMARY+STANDBY on one card = one failure loses both (approved D48) | Precheck WARN when both mics share a card |
| L6 | Low | session-machine.ts:528-531; core-facts.ts:230-231 | C3: CORE offline WARN; predicate server-derived, not forgeable; session can start without tablet | Confirm no consent step depends on the tablet |
| L7 | Low | capture-composition.ts:1112-1116 vs :792-806 | Precheck mic probe does not stand idle meters down; relies on dsnoop + 1 s watch | Call idleMeters.stopAndWait() in the precheck microphones() wrapper |
| L8 | Low | reports 89/90/91 | Security static rules SR-5, G-R16, AD-08 red (LCD row, D28) | Fix or record before any "verified" claim |

## Gates
- Credential leak: PASS (single injection site startMessageOf relay-start.ts:120/:128; relay args [] env {}; encoder literal argv + closed demuxer, env {}, message null; stderr fixed words; reveal audited PREVIEW_OPEN; no token/URL in audit details; request log uses route pattern; redaction adds cps; Vite proxy blanks /preview).
- Destructive operation: PASS (no migration; door kills only its children).
- External call: PASS (judgeStoredCamera before reveal; AUTH_REFUSED/AUTH_SCHEME/22/23 no retry 5 min; restarts capped 3/5 min).
- Injection: CAUTION (closed words, source required, locator_ok, bounded mpjpeg parser, bounded writer, SIGPIPE ignored; M3).
- Permission escalation: CAUTION (rule copies op 112; 32-byte token bound to operator+session+device, constant-time, TTL 60 s; SameSite=Strict; nosniff, no-referrer, CSP default-src 'none'; M1, M4).

## GDPR / ISO
Art. 5(2)/30 GAP (M4, L3); Art. 25 PARTIAL (M1, M4); Art. 32 PARTIAL (M3); Art. 35 DPIA GAP (live video + idle audio levels are new processing). ISO 27001: A.9 PARTIAL, A.12.1 PARTIAL (M2), A.12.4 GAP, A.12.6 PARTIAL, A.13 OK, A.14.2 PARTIAL, A.16 OK.

## C1-C4
C1 no impact; C2 correct input-level exclusivity, residual L5; C3 server-derived predicate, residual L6; C4 read-only SELECT, no impact. Evidence integrity: preview cannot write to the recording (no ingest address in preview mode, separate process, Core reads MJPEG only).

## Priorities
1. Before deploy: user decides M1 and M2; fix M3 (at least NO_NEW_PRIVS + separate uid).
2. Before production personal data: M4, DPIA, L3.
3. Hardening: L1, L2, L4-L8.
