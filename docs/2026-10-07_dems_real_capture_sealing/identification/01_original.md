---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-07
agent: request-translator
status: original
---

# Original Request: DEMS — real capture devices, sealing v2 and transcript (next phase)

## User Request

> ok sekarang bukatkan kerangka kerjanya yang matang

(Indonesian, verbatim. Literal reading: "ok, now [round off / make] the mature work framework". "bukatkan" is a typo of either "bulatkan" (round off, finalise) or "buatkan" (make for me); both readings ask for the same deliverable.)

## Request Metadata

- **Task Title**: DEMS — real capture devices, sealing v2 and transcript (next phase)
- **Date Received**: 2026-10-07
- **Language**: user writes in Indonesian; working documents under `/docs` are in English (standing practice)
- **History References Provided**: Yes
  - `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/` (closed task 2): `report/report.md`, `report/01_report_inputs.md` §4 (backlog B1-B17, pre-handover A1-A6, user decisions C1-C9), `research/10_next_phase_impact_map.md` (M0-M9, OD-01..OD-21, NM-01..NM-14), `research/11_next_phase_drift_check.md` (31 errata, OD-22..OD-26, environment drift), `decisions/decisions.md` rows D219-D233 and D260
  - `/Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/` (closed task 1)
  - `/Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/decisions/decisions.md` (D1 of this task)

## Raw Context

Conversation immediately before the request (as summarised by the controller):

The controller listed what the next phase can do and when:

- **(A) Can start now:** an M0 spec/blueprint built from the decisions already made; technical spikes with tools already on the machine (a fragmented MP4 writer with a running hash fed by a fake RTSP source through ffmpeg; a microphone switch on one audio timeline with fake audio; the FFmpeg vs GStreamer choice); backlog clean-up that does not depend on new decisions.
- **(B) Waits for user decisions OD-01..OD-26**, for example: retiring the "simulator untouched" rule with baseline `c2c983b`; the audio track ID model; reseeding the demo evidence; Simulated-mode parity; reset vs real evidence; permissions for the mic switch and the selector; the P25 freeze waiver; the CPU STT engine and approval of its install; keeping real recordings out of git; legal acceptance of fragmented MP4; refactor order.
- **(C) Waits for hardware:** camera topology (OD-05), microphone transport (OD-06), PoE control (OD-07), real device adapters (M4), the STT benchmark on the real Core device, physical devices on the LAN (OD-13).

The controller proposed: start the next task with the full workflow, prepare the M0 blueprint, put all B/C decisions to the user at once at the blueprint gate, and run the spikes and backlog in parallel once approved. The user answered with the request above. The controller reads it as: produce the mature framework (structured blueprint and plan skeleton) for the next phase, up to the approval gate.

User decisions that define the scope (verbatim quotes in the predecessor's `decisions/decisions.md` rows D219-D233, D260):

- Device-selector configuration in the Core, controllable from web, tablet and phone (D219)
- Video/audio processing behind the API, in a capture worker (D219)
- No new session until the previous one is sealed; rooms may wait because there are several rooms (D219, D223)
- One active microphone per session, the second is a failover, switched by a manual UI toggle (D220, D221)
- Playback has one synchronous audio source (D220)
- One WHOLE file per camera, no multitrack master (D224, D225)
- Transcript inside the sealed package; local STT on CPU + RAM only; speaker labels mandatory when possible (D222, D223, D226)
- Hardware baseline "at least equal to this PC" (Apple M5 4P+6E, 24 GiB) (D226)
- No STT benchmark on this PC, "just make it work"; benchmark later on the real Core device (D230)
- Whisper large-v3-turbo already on disk (D229)
- Biometric device test skipped (D231)
- Test depth 2 runs + 1 verification; long campaigns only at handover (D232, D233, standing)

Standing rules inherited and recorded in this task's D1: full orchestration protocol, no research or implementation before BLUEPRINT_APPROVAL; test depth 2 + 1; emulator security rule; no git remote or push, local commits only; reports to the user in Indonesian, `/docs` in English.

---
*Generated: 2026-10-07*
