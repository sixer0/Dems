# Row 7 progress - gap analysis (data-analyst)

| Field | Value |
|---|---|
| Row | 7 |
| Agent | data-analyst (reasoning tier) |
| Date | 2026-10-12 17:34 |
| Status | complete |
| Artifact | `research/03_analysis.md` |

## Verification criteria of the row

| Criterion | Result | Where |
|---|---|---|
| Every HARDWARE_LOGIC item has one verdict | 38 of 38: ADOPT 14, ALREADY_IN_CORE 6, NOT_NEEDED 5, BLOCKED_BY_DECISION 13 (line count of the table) | section 5 |
| Every ADOPT names a seam plus a member or worker part | 14 of 14 | section 5, column "Lands on" |
| Every tested-scheme parameter has a status with a Core `file:line` | 63 rows: ACCEPTED_TODAY 19, NEEDS_CHANGE 42, UNPROVEN 2 (line count of the tables) | section 6 |
| All nine mismatches have a resolution or an entry reference | 9 of 9 | section 7 |
| Hypotheses labelled, experiment named, none run | H-A to H-E; E-1 to E-8 | sections 4, 8 |

## Limits observed

- No source file was modified (U3). Only two files were written, both inside the task folder: `research/03_analysis.md` and this file.
- No build, test, worker, FFmpeg or input-av run. No camera contacted.
- Nothing under `apps/input-av/data/` and no `.env` was opened. No input-av file was opened at all by this row; its facts come from row 1.
- Core and worker source lines were opened read-only to re-check row 2 (list in section 10 of the artifact). All matched.
- Graft was present and not queried (reason in section 1 of the artifact).

## Milestones

- Verdict table for H-01 to H-38 with seam and contract member per ADOPT.
- Acceptance table for the tested input scheme, status (fact) separated from target (plan).
- Nine mismatches closed or pointed at Q3, Q6, Q7, Q8, Q9, or the P3 confirmation.

## Findings and decisions for the controller to record

1. The tested camera scheme is a pull with the credential in the URL; the Core worker only listens on loopback and the credential rule forbids that form. The pull part is an undecided class C-2 design (fork F-1: relay in front of the worker, or a pull input in the plan). Variant A re-opens security finding SEC35-40; variant B changes the protocol and the worker.
2. The four bench cameras report H264 over ONVIF while delivering H.265. The Core's H.264-only test may therefore PASS them (hypothesis H-A). The codec has to be read from the stream, not from the ONVIF answer (contradicts the working rule of D82).
3. HEVC through the worker is UNPROVEN. The worker ends an ingest without codec extradata (`apps/capture-worker/src/ingest.c:512`), which is the weakness of H.265 cameras that made input-av choose MPEG-TS. Do not plan it as "remove `NOT_H264`".
4. The Core needs a camera wall clock within 2,000 ms (`ingest.c:557-589`, `anchor.h:21`); input-av never exercised that.
5. Audio capture (all channels, select one input, 24-bit) fits the existing `PCM_FIFO` transport with a helper change only. The stored form does not follow, and Q8 on audio has four parts: lossy, in-file, only the active microphone stored, resampled.
6. A production session needs two production cameras and two production microphones at once (`modules/capture-config/plan.ts:124,146-153`): one hardware milestone for camera and audio together.
7. "Tested" for audio is logic-tested (silent files on the real interface; bit-exact proof on the onboard card).
8. PROPOSED NEW ENTRY, not in the register: NEW-1, discovery fallbacks (ARP sweep, neighbour table, ping, direct ONVIF check) against D80(1) and D80(10). H-25 is blocked by it. Row 9's check expects six open entries; the controller decides whether to add a seventh or decline.
9. For the P3 confirmation line: automatic USB source recommended not carried; camera audio not carried; "main stream" is the largest-area rule; "24-bit" is a capture request, not a stored property.
10. Low-confidence verdicts that row 8 should confirm by reading: H-37 (mid-session disk threshold in `capture-session/index.ts`), H-01 (token time against the camera clock). Unexamined area: HEVC playback in the Core's clients (gap G-3).

## Blockers

None.

## Note on instructions

The agent's base instructions say not to write report files; the delegation and the Documentation Contract require this artifact. The delegation was followed.
