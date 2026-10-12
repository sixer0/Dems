# Row 8 progress: target design of the port (data-analyst)

| Field | Value |
|---|---|
| Row | 8 |
| Agent | data-analyst (reasoning tier, per the Execution Profile) |
| Date | 2026-10-12 17:52 |
| Status | complete (sections on Q8, Q9, Q10 stay "proposed", as the blueprint allows) |
| Artifact | `masterplan/01_specs.md` |

## Verification criteria of the row

| Criterion | Result | Where |
|---|---|---|
| Each ADOPT item and each NEEDS_CHANGE parameter in exactly one WP that names a seam | 14 of 14 and 42 of 42; checked by a grep over the WP table rows (each identifier found once); the two UNPROVEN parameters are in WP-01 and WP-08 | section 9 |
| Every pin of the opener rule has a lift condition | every match of row 2 section 3, plus the loader, the stub literals and the comments | section 6.3 |
| Both stored-form variants costed per seam, one recommendation | variants C and I across S1-S6 and outside; a third variant M; recommendation C | fork F-3 |
| Indonesian summary at the top | present | head |

## Limits observed

- No source file modified (U3). No build, test, worker or FFmpeg run. Nothing under `apps/input-av/data/` and no `.env` opened.
- Files written: `masterplan/01_specs.md` and this file. Nothing outside the task folder.
- Core and worker lines opened read-only are listed in section 13 of the artifact.
- Graft was not queried: its graph refreshes before a query, which writes outside the task folder.

## Milestones

- Mapping of 14 adopted items and 44 parameters onto S1-S6; change items per seam with today's file:line.
- Eight forks, each led by a recommendation: F-1 camera pull, F-2 HEVC, F-3 stored form (Q8), F-4 tools (Q10), F-5 discovery fallbacks (NEW-1), F-6 Linux host (Q7), F-7 rooms (Q6), F-8 legacy data (Q3).
- 21 work packages WP-01 to WP-21 with seam, size, dependencies, blocking decision, host and verification.
- Pin table of the class-C rule with six lift conditions and a two-stage order.

## Decisions and findings for the controller to record

1. F-1 recommendation: pull relay in front of the unchanged worker (variant A), CONDITIONAL on row 13 accepting the proposed answer to SEC35-40 (measures SA-1 to SA-3). Fallback is variant B, never the FFmpeg command line.
2. F-2: H.265 stays the target but is unproven; WP-01 (development host, fakes, no blocking decision) should run first. No-code fallback: cameras set to H.264 by hand.
3. F-3 (Q8) recommendation: the Core's stored form. The user must accept knowingly that the standby microphone is not stored and audio is not lossless. A third variant M (lossless side track per microphone) is offered; row 9 should list it.
4. F-4 (Q10) recommendation: no tool kept as an input-av tool; host checks and the pre-session level check move into the Core; the two network-changing tools are dropped from the product.
5. NEW-1 is treated as a seventh open entry in this design (fork F-5, WP-12). Row 9's check expects six: the controller decides.
6. Rulings the design would amend, each needing a decision row: D86 C-5 (lift), D82 (codec judged from the stream, not the ONVIF answer), D80(10) if NEW-1 is granted.
7. External dependencies outside the port: a production signing-key command (X-1) and operators without the demonstration password (X-2). Without them the hardware milestone WP-15 cannot end in a sealed session.
8. Five departures from the tested scheme for the P3 confirmation line: credential mechanism, no camera audio, no automatic USB source, no ARP/ping discovery fallbacks, reconnect as a gap in the same track.
9. H-37 (disk protection) is NOT confirmed as present: a search found no writer of the storage faults in real capture. Reported as a Core gap outside U1, with no work package (hypothesis H-P).
10. Hypothesis H-K for Q7: on Linux the worker would state sync level FSYNC, which the capture session treats as critical in REAL_PRODUCTION.
11. Identifier clash between rows 6 and 7 (both use G-n): this document writes A/G-n and M/G-n.

## Blockers

None.

## Not verified

Any behaviour of the FFmpeg libraries or of a browser (hypotheses H-F to H-R, each with an experiment); the full text of SEC35-40; the audit detail-key lists; the mobile player.

## Note on instructions

The agent's base instructions say not to write report files; the delegation and the Documentation Contract require these two artifacts. The delegation was followed.
