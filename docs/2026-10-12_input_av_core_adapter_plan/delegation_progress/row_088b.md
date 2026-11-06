# Row 88b - gate review of the class-C lift (row 88), wave 12

Status: complete. Report: `verification/088b_lift_gate_review.md`. Read only; no file changed except these two.

- VERDICT: CAUTION, FAIL 0. The lift may be committed as it stands; nothing must change before the commit (C-1 is an optional one-liner).
- (1)-(6) PASS: the opener list gains exactly ONVIF_RTSP and USB_AUDIO; the class rule holds in development, production, later-admission and fake registries; the C60 files have an empty diff; admitDevice comes before register and the destination rule before the credential reveal; the door refuses a second call, a late call and any non-production operation, is pinned to one caller and has no runtime key; the linux-only microphone opener and the macOS adapter unimported (A-9 `[]`).
- (7) PASS with gap C-3; (8) no risk in D-1, D-2, D-4 (fail-closed); (9) new paths in section 3; boot heartbeats need an operating note (C-6).
- Run: `src/capture/adapters/__tests__/real.test.ts` 8/8 (1.30 s), no database or port.
- Cautions: C-1 opener truthiness mismatch -> N10; C-2 door refusals untested -> test-expert / row 89; C-3 IGNORED-and-not-durable end emits no event -> row 90; C-4 RD1 `retired_at` not filtered by fence reads -> RD2 / the op 111 row, before op 111 can retire; C-5 stale comments plus the fence value-import of the production microphone module -> tidy; C-6 REAL_PRODUCTION boot sends heartbeats to stored cameras -> controller note.
