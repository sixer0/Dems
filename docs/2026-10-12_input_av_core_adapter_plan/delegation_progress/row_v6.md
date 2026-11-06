# Row V6 (agent V6, track D) - status: needs-review

Record: `implementation/v6_commissioning_review_changes.md`.

| Item | State |
|---|---|
| (1) R119-03 | done: `FactoryCamera.deviceCount` (`ONE` / `MORE_THAN_ONE` / `NOT_KNOWN`) in the place of `conflict`; `endpointCount` nullable; the Core's scan answers `NOT_KNOWN` whenever its probe did not count; scan age bound 10 minutes (`CAMERA_SCAN_TOO_OLD`) |
| (2) R119-04 | done: `CameraNetworkSetRequest.scannedMac` required; `CAMERA_HARDWARE_ADDRESS_NOT_BOUND` before a job; `MAC_MISMATCH` before the typed account is used; bound in the `admitHwAddress` hook |
| (3) R119-06 | done at the module: two silent observations, 1 s apart, 8 s in all; the fixed echo row unchanged |
| (4) R119-07 | done: the 27 check ids of the frame, each once, result `PASS` / `FAIL` / `NOT_RUN`; the Core refuses anything else; the web form reads the contract's list |
| (5) R119-08 | done for operation 110 (`INSTALLATION_CLOCK_BEHIND_RECORD`); operation 109 left (driver decision D-3) |
| (6) R119-09 | left: lies in `camera/onvif-network.ts`; request line for agent B1 |
| (7) S-01 | done for operations 44 / 46 / 47 and the readers; the state stream's slice on a real Core is open |
| (8) verdict line | done: notice `HOST_PROFILE_NOT_ASKED` in the shared verifier; one line in the receiver's command |

Counts after: 110 operations (39 GET / 71 POST), 82 audit types, 51 actions. No count pin moved. No schema change.

Requests left: six lines in `file_requests.md` beginning `row V6`.

Driver decisions: D-1 to D-6 of the record, section 6.

Edit tool only for existing files; `openapi.json` by the repository's generator.
