# coder-execution - row 142 (credential-gated connect flow, R-9)

Status: **needs-review** (2026-10-09). Note: `implementation/73_r9_connect_flow.md`.

## Files created
- `apps/core-server/src/capture/adapters/camera/onvif-session.ts`
- `apps/core-server/src/capture/adapters/camera/onvif-cam.d.ts`
- `apps/core-server/src/capture/adapters/camera/__tests__/onvif-session.test.ts`
- `apps/core-server/src/modules/capture-discovery/connect/{index,service,limits,statements}.ts`
- `apps/core-server/src/modules/capture-discovery/connect/__tests__/{limits.test,service.test,connect.db.test}.ts`
- `apps/core-server/test/support/onvif-odd-device.ts`
- `docs/2026-10-07_dems_real_capture_sealing/implementation/73_r9_connect_flow.md`

## Shared files edited (small, additive, Edit tool)
- `apps/core-server/src/capture/__tests__/static.test.ts`: constant `ONVIF_SESSION`, the socket exemption of that file, block G-R10 / G-R11
- `apps/core-server/test/static/network.test.ts`: one exemption entry, one control
- `apps/core-server/src/capture/adapters/__tests__/static.test.ts`: two names in the file-list pin

## Requests filed (`file_requests.md`, 10:32Z and 10:46Z)
1. redaction.ts account-name rule (not blocking)
2. row 132: INTERNAL engine action to register an adopted device (blocks the commit of op 96)
3. row 132: barrel export + mount of the routes (blocks the product)
4. row 84 pin: `CREDENTIAL_STORE_USERS` entry (not blocking; its static test is red until then)

## Results
Typecheck 0 errors; lint 0 findings in these files; unit 111 passed; db 16 passed (alone, 5 runs);
1 unexplained failure of two cases in 6 paired runs with the acceptance file.

## Not proven
Routes in the running Core; `publishes captureDevices`; concurrent adoptions; the TLS branch; heap
growth bound; the full search -> test -> adopt -> assign sequence.
