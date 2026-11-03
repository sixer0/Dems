# Row 100 (R2.1) - openapi.json regenerated

Command: `npm run openapi:gen -w @dems/shared` (needed sandbox bypass: tsx IPC socket EPERM). Exit 0.
Output: all 111 operations, 2 security schemes, v0.3.0; offline 45 operations, v0.2.0 (counts unchanged).

Diff vs the row 80 restore point (HEAD + tracked.diff), operations changed (6, all inside the allowed set 93/98-102):
- POST /api/v1/capture/discovery startCaptureDiscovery (93)
- POST /api/v1/capture/audio-cards/search searchCaptureAudioCards (98)
- POST /api/v1/capture/audio-cards/inputs registerCaptureAudioInput (99)
- POST /api/v1/capture/devices/address/confirm confirmCaptureDeviceAddress (100)
- GET  /api/v1/capture/network/config getCaptureNetworkConfig (101)
- POST /api/v1/capture/network/config updateCaptureNetworkConfig (102)
Schemas changed: CaptureAudioCard, CaptureAudioInputRegisterRequest, CaptureAudioInputRegistration, CaptureNetworkConfig, DeviceHealthResponse.
No other operation touched. Pre-R-FLEX task-4 hunks (109 added lines vs HEAD) are retained; R-FLEX hunks are the above (net vs HEAD: +195/-18).

Tests (packages/shared): openapi.test.ts, api-openapi-scope.test.ts, api-registry.test.ts -> Test Files 3 passed, Tests 87 passed.
