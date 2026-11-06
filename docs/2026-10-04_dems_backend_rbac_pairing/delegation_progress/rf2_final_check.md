# RF2 — final independent check of CF2 (verifier)

| Field | Value |
|---|---|
| Status | **needs-review**: 7 / 7 checks PASS on the brief's criteria; 2 new defects (RF2-1 Low, RF2-2 Medium proposed) |
| Window | 2026-10-06 22:15-22:55 WIB |
| Devices | emulator-5554 (phone, lane 1: Core 4421, web 5176) and emulator-5556 (tablet, lane 2: Core 4422, web 5177) only |
| Report | `test/11_final_check_cf2.md` |
| Assets | `test/assets/retest3/` (57 PNG, 2 MP4 at 540 px, 20 text files) |

## Milestones

1. Precheck at 22:17 (load 6.0). Both devices focused on the app; reverse rules 4420 -> 4421 / 4422; Core health ok on 4421 and 4422; web 5176 / 5177 200.
2. Phone: relaunch with `demsdemo:///login?core=LIVE&motion=off`, sign-in, then 6 recorded runs:
   - S1-S3 (web stop after about 30 s): max lag 1.37 / 1.79 / 1.53 s, 0 backward steps, 0 banners;
   - X1-X3 (early web stop): stale monitor 0.74 / 0.63 / 1.86 s;
   - 0 empty frames Ready -> monitor in 6 / 6.
3. Tablet: relaunch, sign-in, then:
   - Evidence E1-E3: all rows drawn;
   - Sessions H1-H3: readable, RF2-1 found;
   - Network & Time N1-N3: full values;
   - sessions T1-T3: Finalizing then Summary, no crash; RF2-2 found.
4. End state verified at 22:55: both devices LIVE, signed out, on Login; last sessions SEALED; browsers closed; reverse rules unchanged.

## Defects

- **RF2-1** (Low): the Sessions hub detail pane breaks two-word subject names inside a word ("Retno W/ulandari", "Siti Rahm/awati").
- **RF2-2** (Medium, proposed): on the tablet, after a web stop about 11 s in, the stale "Recording" monitor stayed 3.19 s (T2) and 6.73 s (T3, after the seal). In T3 the Summary came about 13.6 s after the seal. Host load was 2-4. The cause is not established; there is no socket close in the Core log.

## Deviations

- **D-RF2-1:** an aborted T2 attempt, because the tablet Summary needs scrolling before Done. No session was created and nothing was stopped.
- **D-RF2-2:** one E2 tap re-selected the same row.
- **D-RF2-3:** one invalid `ids` regex on the More screen.

## Decisions

None taken. Severities are proposals for the controller.

## Secret scan

20 text assets: demo password occurrences 0, token-shaped strings 0 (count-only, constant imported, never printed).
