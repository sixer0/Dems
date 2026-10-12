# Judging session — lane / rig slots (append-only)

| time | judge | lane or rig | state |
|---|---|---|---|
| 22:40 | A1 (tablet) | lane 2 session slot | held by A1 for the whole phase (tablet sessions on FAKE sources) |
| 23:21 | A1 (tablet) | source-rig 2 (unreachable CAM-02, then MIC-01) | in use from 23:21 |
| 23:26 | A1 (tablet) | source-rig 2 | free (OFF, read back) |
| 23:25 | A1 (tablet) | seal-rig 2 (blocked) on SES-20261011-0088 | in use from 23:25 |
| 23:31 | A1 (tablet) | seal-rig 2 | free (released 23:30, status OFF read back; SES-20261011-0088 sealed by retry op 33) |
| 23:48 | A1 (tablet) | lane 2 session slot | free (no session open: SES-20261011-0089 SEALED; rigs OFF; selector CAM-01 / CAM-02 / MIC-01 primary / MIC-02 standby; no active alert; tablet on Login) |
| 23:54 | B1 (web) | lane 2 session slot | held by B1 from 23:54 (web New Session on FAKE sources, one 45-60 s recording; will release) |
| 23:56 | B2 (motion) | lane 1 session slot | held by B2 from 23:56 (phone session on the simulated lane, one 45 s recording + one demo fault; will release) |
| 23:58 | B1 (web) | lane 2 session slot | free (SES-20261011-0090 SEALED as EV-20261011-0060; rigs untouched) |
| 00:06 | B1 (web) | lane 2 session slot + capture selector | held by B1 from 00:06 (selector changes on FAKE devices and back; then source-rig and seal-rig runs, announced separately) |
| 00:08 | B1 (web) | source-rig 2 (unreachable CAM-02) | in use from 00:08 |
| 00:09 | B1 (web) | source-rig 2 | free (released, status OFF read back) |
| 00:09 | B1 (web) | seal-rig 2 (blocked) on SES-20261011-0091 or the session shown by status | in use from 00:09 |
| 00:14 | B1 (web) | seal-rig 2 | free (released, status OFF read back; SES-20261012-0091 sealed by Retry sealing on the web) |
| 00:14 | B1 (web) | lane 2 session slot + selector | free (correction to the line above: the seal completed at 00:14:26 on the second press of Retry sealing; SES-20261012-0091 SEALED as EV-20261012-0061; both rigs OFF; selector CAM-01 / CAM-02 / MIC-01 primary / MIC-02 standby) |
| 00:15 | B2 (motion) | lane 1 session slot | free (SES-20261012-0024 SEALED, summary acknowledged; demo fault STORAGE_FULL cleared, ALR-000001 acknowledged; phone on Login, motion=off form) |
| 00:15 | B2 (motion) | lane 2 session slot | held by B2 from 00:15 (tablet session on FAKE sources CAM-01/CAM-02/MIC-01/MIC-02, 60 s recordings, motion on; no rig; will release) |
| 00:21 | B1 (web) | lane 1 session slot | held by B1 from 00:21 (web session on the simulated lane, demo scenarios and faults, each cleared; will release) |
| 00:27 | B1 (web) | lane 1 session slot | free (no session open; scenario idle, no active fault; note: the demo update on lane 1 was run once as instructed) |
| 00:28 | B1 (web) | lane 1 session slot | held by B1 from 00:28 (one session setup that is discarded, no recording) |
| 00:28 | B1 (web) | lane 1 session slot | free (the setup was discarded; no session open) |
| 00:41 | B2 (motion) | lane 2 session slot | free (SES-20261012-0092 and -0093 SEALED, summaries acknowledged; EV-20261012-0062 EXPORTED as EXP-000047, EV-20261012-0063 SEALED; no rig used; selector CAM-01 / CAM-02 / MIC-01 primary / MIC-02 standby; tablet on Login, motion=off form) |
| 01:00 | J-P (wave J, phone) | lane 1: demo faults / scenarios, session slot when announced | in use by J-P from 01:00 (faults raised and cleared one at a time; a session is announced on its own line) |
| 01:13 | J-P (wave J, phone) | lane 1 session slot | held by J-P from 01:13 (demo scenario 'recording' for the toast proof, then scenario idle) |
| 01:14 | J-P (wave J, phone) | lane 1 session slot | free (scenario idle loaded: seed again, no session, no active fault) |
| 05:33 | J-T (wave J, tablet) | lane 2 session slot | held by J-T from 05:33 (45 s sessions on the FAKE sources CAM-01/CAM-02/MIC-01/MIC-02 through the API helper and on the tablet; seal-rig announced on its own line; will release) |
| 05:39 | J-P (wave J, phone) | lane 1 | free (J-P finished: no session, no active fault, scenario idle; phone on Login, motion=off form, rules tcp:8081 tcp:8081 + tcp:4420 tcp:4421) |
| 05:44 | J-T (wave J, tablet) | seal-rig 2 (blocked) on the next session of lane 2 | in use by J-T from 05:44 (JT-02 proof: blocked -> release -> 'Retry sealing' pressed on the tablet) |
| 05:49 | J-T (wave J, tablet) | seal-rig 2 | free (released, status OFF read back; SES-20261012-0096 was blocked (ALR-000165), sealed as EV-20261012-0066 by 'Retry sealing' pressed on the tablet) |
| 06:01 | J-W (wave J, web) | BOTH LANES | restart of both Cores by J-W starts now (after "JS consistent at 05:58"): lane 2 stop/start --with-camera-stub --speech-mic, NO reset; lane 1 stop/start, no reset. No session open on either lane; both rigs OFF |
| 06:01 | J-W (wave J, web) | BOTH LANES | restarted (lane 2 Core PID 78103, lane 1 Core PID 78217; no reset); rigs OFF; lanes free again except the lines below |
| 06:06 | J-W (wave J, web) | lane 2 session slot + source-rig 2 (unreachable CAM-02) | held by J-W from now: ONE session on the FAKE sources CAM-01/CAM-02/MIC-01/MIC-02 (pre-check with the source rig, release, re-run, 45-60 s recording, seal); will release |
| 08:37 | J-T (wave J, tablet) | lane 2 session slot | free since 05:54 (correction of my 05:4x 'held' line: SES-20261012-0094, -0095, -0096 (rig), -0097 all SEALED; no session of J-T open; rigs OFF; selector on the FAKE defaults). J-T takes it again on its own line. |
| 08:42 | J-W (wave J, web) | lane 2 session slot + source-rig 2 | free (source rig released at 06:07, status OFF read back now; SES-20261012-0098 on the FAKE sources was INTERRUPTED by a capture fault 19 s into the recording while the host load was above 20 and the Core sealed it by itself as EV-20261012-0068 (SEALED, interrupted, CAPTURE_FAULT); selector on the FAKE defaults; seal rig never used) |
| 08:46 | J-W (wave J, web) | lane 1 session slot + demo faults | held by J-W from now: ONE simulated session (pre-check and Monitor DEMO marks), demo fault STORAGE_FULL during it, recovery to INCOMPLETE (JW-01 proof), fault cleared; then the install confirmation (cancelled); will release |
| 08:49 | J-W (wave J, web) | lane 1 session slot + demo faults | free (SES-20261012-0024 INCOMPLETE by the demo fault STORAGE_FULL -> record EV-20261012-0014, never sealed; the fault is cleared, activeFaults []; no session open; scenario idle; the demo update was NOT installed - confirmation cancelled) |
| 09:04 | J-T (wave J, tablet) | lane 2 session slot | held by J-T from 09:04 (ONE 45 s session driven on the tablet, FAKE sources CAM-01/CAM-02/MIC-01/MIC-02; no rig; will release) |
| 09:10 | J-T (wave J, tablet) | lane 2 session slot | free (SES-20261012-0099 SEALED as EV-20261012-0069, summary acknowledged with Done on the tablet; rigs OFF; selector on the FAKE defaults) |
| 09:21 | J-T (wave J, tablet) | lane 2 + tablet | J-T finished: no session open (SES-20261012-0099 SEALED, acknowledged), both rigs OFF, selector CAM-01 / CAM-02 / MIC-01 primary / MIC-02 standby, tablet on Login in the environment form, rules tcp:8081->8081 and tcp:4420->4422, media volume 4, helper signed out |
| 10:17 | J2-M (wave J round two, mobile) | BOTH LANES | restart of both Cores by J2-M starts now (J2-S consistent at 09:51; controller allowed J2-M to restart): lane 2 stop/start --with-camera-stub --speech-mic, NO reset; lane 1 stop/start, no reset. No session open on either lane (lane 2 SES-20261012-0099 SEALED; lane 1 null); both rigs OFF |
| 10:17 | J2-M (wave J round two, mobile) | BOTH LANES | restarted (lane 2 Core PID 4987, lane 1 Core PID 5105; no reset); rigs OFF; J2-M holds both devices and takes the session slots on its own lines |
| 10:29 | J2-M (wave J round two) | lane 2 session slot | held by J2-M from now: sessions driven ON THE TABLET, FAKE sources CAM-01/CAM-02/MIC-01/MIC-02 only (45-60 s each); the seal rig on the second one (announced on its own line) |
| 10:40 | J2-M (wave J round two) | seal-rig 2 (blocked) on the next session of lane 2 | in use by J2-M from now (JT-02 Home entry + JT-01 (a) live: blocked -> Home -> release -> "Retry sealing" pressed on Home); will release |
| 10:47 | J2-M (wave J round two) | seal-rig 2 | free (released, status OFF read back; SES-20261012-0101 was blocked (ALR-000186), sealed by "Retry sealing" pressed ON HOME of the tablet) |
| 10:52 | J2-M (wave J round two) | lane 2 session slot | free: SES-20261012-0100 (EV-0070; ended through the API after the tablet lost its link under host load; 2:25) and SES-20261012-0101 (rig: blocked ALR-000186 -> Retry sealing on Home -> EV-0071) both SEALED and acknowledged; rigs OFF; selector on the FAKE defaults; tablet on Login |
| 10:56 | J2-M (wave J round two) | lane 1 session slot + demo faults | held by J2-M from now: TWO simulated sessions driven on the PHONE (one interrupted by the demo fault POWER_FAIL -> recovery -> INCOMPLETE; one sealed), demo faults MIC_NO_SIGNAL / POWER_FAIL raised and cleared; the install confirmation (cancelled); will release |
| 11:09 | J2-M (wave J round two) | lane 1 session slot + demo faults | free: SES-20261012-0025 INCOMPLETE by the demo fault POWER_FAIL (record EV-20261012-0015, never sealed), SES-20261012-0026 SEALED (EV-20261012-0016, summary acknowledged by "View in Evidence"); faults MIC_NO_SIGNAL and POWER_FAIL cleared, activeFaults []; the demo update was NOT installed (confirmation cancelled); helper signed out. J2-M holds no slot and no rig from now |
