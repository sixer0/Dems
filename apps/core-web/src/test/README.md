# apps/core-web/src/test

Up: [src](../README.md)

## Purpose

Page-level and cross-folder tests of the web console, with their shared helpers and the Vitest setup file. Unit tests of a single folder live in that folder's `__tests__/`; this folder holds the tests that render whole pages, drive the Live data source through a fake transport, or scan many folders at once. Nothing here is imported by production code.

Most files named `live-*.test.tsx` run in jsdom with the page URL `http://127.0.0.1:5178/` (set per file through the `vitest-environment-options` comment), so the Live host rule of [`../runtime/live-host.ts`](../runtime/live-host.ts) accepts the page. They build the page with the harness in [`../runtime/testing/`](../runtime/testing/) (`live-harness.ts`, `fake-time.ts`).

## Files

| File | Role |
|---|---|
| [`api-reference-static.test.tsx`](api-reference-static.test.tsx) | API Reference page in Simulated mode: the seq box of the two Realtime panels and the server strip (W92-19, W92-21). |
| [`box-check.test.ts`](box-check.test.ts) | Each rule of `box-check.ts` (a word broken inside itself, clipped text: CW-01, CW-02, JW-18) against small documents with given geometry. |
| [`box-check.ts`](box-check.ts) | Helper, not a test: the box check of the console (text cut, clipped, broken or overlapping on the page as drawn), evaluated in a real browser at 1920 x 1080. |
| [`demo-words.ts`](demo-words.ts) | Helper: page words without the demonstration marks' own chip, hint and tooltip sentences. |
| [`dev-console-logging.test.tsx`](dev-console-logging.test.tsx) | What error boundaries print in a dev build (root route boundary, Devices panel boundary; W92-5): no token-like value, address or typed input. |
| [`dev-proxy-blanking.test.ts`](dev-proxy-blanking.test.ts) | The dev-server proxy prints an error of a signed path without the path (R93-09). |
| [`evidence-table.test.tsx`](evidence-table.test.tsx) | Evidence table: columns and the row menu stay inside the card (AC-64, JW-10). |
| [`home-page.test.tsx`](home-page.test.tsx) | The Home page (`features/home`). |
| [`integrity-checks.test.ts`](integrity-checks.test.ts) | The SECURE pill and the header naming a critical fault (G75b-07). |
| [`live-api-reference-document.test.tsx`](live-api-reference-document.test.tsx) | API Reference document and Try-it in Simulated mode (AR-2, AC-C-100). |
| [`live-api-reference-page.test.tsx`](live-api-reference-page.test.tsx) | API Reference in Live mode: the document, Try-it, the deny list and web storage (AC-C-100, AC-C-103, AC-C-107). |
| [`live-cf-web-media.test.tsx`](live-cf-web-media.test.tsx) | Live Media tab of an evidence item without a DEMO package (O-RT-1). |
| [`live-d2-client-seams.test.tsx`](live-d2-client-seams.test.tsx) | Development-source badge on Dashboard tiles and the Session Monitor (WB-01, WB-02). |
| [`live-dashboard-devices.test.tsx`](live-dashboard-devices.test.tsx) | Dashboard device commands in Live mode: success and refusal (B-7). |
| [`live-dashboard-page.test.tsx`](live-dashboard-page.test.tsx) | Dashboard page on a Live Core, including the sealed hash. |
| [`live-devices-capture-selector.test.tsx`](live-devices-capture-selector.test.tsx) | Devices capture selector in Live mode: the read and an edit (operations 79, 80). |
| [`live-devices-clip.test.tsx`](live-devices-clip.test.tsx) | Clearing a meter CLIP on Devices in Live mode: success and refusal (B-8). |
| [`live-devices-commands.test.tsx`](live-devices-commands.test.tsx) | Devices page commands in Live mode: success and refusal (B-7). |
| [`live-devices-drawer.test.tsx`](live-devices-drawer.test.tsx) | Device drawer with and without PAIRING_MANAGE (G6). |
| [`live-efix-evidence.test.tsx`](live-efix-evidence.test.tsx) | Evidence integrity card on the Core and the header placeholder when the media lookup fails (E2E-W1-3, W92-11). |
| [`live-evidence-archive.test.tsx`](live-evidence-archive.test.tsx) | Archiving evidence in Live mode: success and refusal (B-1). |
| [`live-evidence-export.test.tsx`](live-evidence-export.test.tsx) | Evidence export in Live mode and the export file of a demonstration item (A5, pass J5). |
| [`live-evidence-media-signout.test.tsx`](live-evidence-media-signout.test.tsx) | No media-reference read after a sign-out (W92-3). |
| [`live-evidence-verify.test.tsx`](live-evidence-verify.test.tsx) | Verifying an evidence item in Live mode (A6, AC-C-61). |
| [`live-gap-indicator-connecting.test.tsx`](live-gap-indicator-connecting.test.tsx) | The CONNECTING instant of the mode indicator. |
| [`live-local-source-on.test.tsx`](live-local-source-on.test.tsx) | Session New pre-check rows and the Session Monitor with a local source on. |
| [`live-login-model.test.tsx`](live-login-model.test.tsx) | Login model: why the operator is on the page, a rejected sign-in, and static rules of the login folder (AC-C-53). |
| [`live-login-page.test.tsx`](live-login-page.test.tsx) | Login page in Live mode: the trust line and the security key (WS-7, WS-8). |
| [`live-login-presentation.test.tsx`](live-login-presentation.test.tsx) | Presentation-mode follow-up: a load that starts inside the shell, installed once (F77-3). |
| [`live-login-signin.test.tsx`](live-login-signin.test.tsx) | Live sign-in: success and the start-up after it (WS-1, AC-C-38, AC-C-44). |
| [`live-meter-clip-reset.test.tsx`](live-meter-clip-reset.test.tsx) | Meter clip reset: success and refusal (the error presenter first). |
| [`live-network-time-page.test.tsx`](live-network-time-page.test.tsx) | Network & Time page on a Live Core. |
| [`live-paired-devices-issue.test.tsx`](live-paired-devices-issue.test.tsx) | Issuing a pairing code: six digits, the QR and the countdown on the Live clock (AC-C-92, AC-C-93). |
| [`live-paired-devices-list.test.tsx`](live-paired-devices-list.test.tsx) | Paired devices list and revoke with a reason (AC-C-98). |
| [`live-paired-devices-memory.test.tsx`](live-paired-devices-memory.test.tsx) | A pairing code is in no web storage, URL or query-cache entry and is dropped at once (AC-C-96, AC-C-106). |
| [`live-pending-control.test.tsx`](live-pending-control.test.tsx) | The pending-control hook: busy at once, spinner late, one command per control. |
| [`live-runtime-boot-failure.test.tsx`](live-runtime-boot-failure.test.tsx) | A start-up that rejects, and a start-up chunk that fails to load (CPW1-7, W92-2). |
| [`live-runtime-bridge.test.tsx`](live-runtime-bridge.test.tsx) | The query bridge: Core query keys, and admin.changed refetching the matching lists (PG-6, PG-6a). |
| [`live-runtime-mode.test.tsx`](live-runtime-mode.test.tsx) | The data-mode resolver (MD-2) and one data source per page load (MD-5). |
| [`live-runtime-sink.test.tsx`](live-runtime-sink.test.tsx) | The web error sink: the page log and the browser console in dev builds. |
| [`live-runtime-startup.test.tsx`](live-runtime-startup.test.tsx) | The Live start-up sequence (spec section 5.1 steps 2 to 5). |
| [`live-runtime-static.test.tsx`](live-runtime-static.test.tsx) | Static scan: the heavy runtime modules have one way in (MD-6). |
| [`live-runtime-storage.test.tsx`](live-runtime-storage.test.tsx) | Owed sign-out storage: the storage port and the storage probe. |
| [`live-runtime-surface.test.tsx`](live-runtime-surface.test.tsx) | The runtime surface: `useWebLive`, the one way a page reaches the Core server. |
| [`live-security-audit-chain.test.tsx`](live-security-audit-chain.test.tsx) | Audit chain verify and lineage in Live mode (A9, AC-C-109). |
| [`live-security-audit-export.test.tsx`](live-security-audit-export.test.tsx) | Audit export in Live mode: success, the file, refusal (A7, AC-C-60). |
| [`live-security-audit-page.test.tsx`](live-security-audit-page.test.tsx) | Security & Audit page: the role matrix and StrictMode behaviour. |
| [`live-security-audit-signout.test.tsx`](live-security-audit-signout.test.tsx) | The audit export walk sends no page after a sign-out. |
| [`live-session-monitor-actions.test.tsx`](live-session-monitor-actions.test.tsx) | Session Monitor actions in Live mode, including the marker (B-2). |
| [`live-session-monitor-audio-source.test.tsx`](live-session-monitor-audio-source.test.tsx) | Session Monitor audio source: no switch control (operation 81 retired) and the pair labels (row 157). |
| [`live-session-monitor-panels.test.tsx`](live-session-monitor-panels.test.tsx) | Session Monitor panels: re-verify and recover (A9, B-3). |
| [`live-session-new-create.test.tsx`](live-session-new-create.test.tsx) | Start Session create flow: createSession, cancel, beginPrecheck order, scanCaseNumber (A3, A4, C-3, D-2, D-3). |
| [`live-session-new-local-notice.test.tsx`](live-session-new-local-notice.test.tsx) | Start Session with a local device in the selector, and a session left in CREATE after a reload (R69-01). |
| [`live-session-new-pending.test.tsx`](live-session-new-pending.test.tsx) | Start Session controls: busy at once, spinner late (AC-C-57, AC-C-58, LB-1). |
| [`live-session-new-precheck.test.tsx`](live-session-new-precheck.test.tsx) | Start Session pre-check: beginPrecheck once per session and acknowledgePrecheckWarnings (B-6). |
| [`live-session-note-role.test.tsx`](live-session-note-role.test.tsx) | The session note drawer follows the signed-in role in Simulated and Live mode. |
| [`live-shell-admin.test.tsx`](live-shell-admin.test.tsx) | Shell administration navigation: the words and which items render (PG-4, PG-10). |
| [`live-shell-indicator.test.tsx`](live-shell-indicator.test.tsx) | The shell mode indicator states, including LIVE RECONNECTING. |
| [`live-shell-notices.test.tsx`](live-shell-notices.test.tsx) | Shell notices: the bell and the link notice (AC-C-26, AC-C-59). |
| [`live-static-ac-c-53.test.ts`](live-static-ac-c-53.test.ts) | Static scan over every folder: no `.actions` read on a `Sim` (AC-C-53), and the fake transport stays out of the pages (TS-15). |
| [`live-storage-page.test.tsx`](live-storage-page.test.tsx) | Storage page on a Live Core and during an outage. |
| [`live-storage-policy.test.tsx`](live-storage-policy.test.tsx) | Storage policy change in Live mode: success and refusal (B-9). |
| [`live-strict-mode-starts.test.tsx`](live-strict-mode-starts.test.tsx) | Effect-started commands run once under StrictMode (Session New resume, B-6). |
| [`live-system-demo.test.tsx`](live-system-demo.test.tsx) | System Demo Control Panel: the gate and the panel (AC-C-52, B-10). |
| [`live-system-export.test.tsx`](live-system-export.test.tsx) | System log export: the reason and success (A8, AC-C-60). |
| [`live-system-maintenance.test.tsx`](live-system-maintenance.test.tsx) | System maintenance: Restart services and Run Diagnostics (A10, A11). |
| [`live-system-panel-setup.test.tsx`](live-system-panel-setup.test.tsx) | Pre-delivery panel setup module of the System page (operations 118, 119); never offered in Simulated mode. |
| [`live-system-settings.test.tsx`](live-system-settings.test.tsx) | System settings: one version per component (operation 64) and the live camera (operation 51). |
| [`live-system-stt-config.test.tsx`](live-system-stt-config.test.tsx) | Speech-to-text configuration: gating and save (operation 91). |
| [`live-system-stt-secret.test.tsx`](live-system-stt-secret.test.tsx) | The speech-to-text SECRET form behind STT_SECRET_FORM_OFFERED. |
| [`live-users-roles-commands.test.tsx`](live-users-roles-commands.test.tsx) | Users & Roles commands: role change (operation 12) and the last administrator (AC-C-87, AC-C-88). |
| [`live-users-roles-model.test.tsx`](live-users-roles-model.test.tsx) | Users & Roles model, the query cache and the body. |
| [`live-users-roles-page.test.tsx`](live-users-roles-page.test.tsx) | Users & Roles page from the fake transport and the system account OPR-000 (AC-C-86, DF-29). |
| [`live-w0-camera-words.test.tsx`](live-w0-camera-words.test.tsx) | Camera words: the procedural OSD line and the picture. |
| [`live-w0-device-log.test.tsx`](live-w0-device-log.test.tsx) | Device drawer Log words in Simulated and Live mode. |
| [`live-w0-evidence-words.test.tsx`](live-w0-evidence-words.test.tsx) | Evidence words in Simulated and Live mode. |
| [`live-w0-page-logs.test.tsx`](live-w0-page-logs.test.tsx) | Page logs: Network & Time writes to the page log; one page-report helper for Dashboard and Devices (F70-5). |
| [`media-token-blanking.test.ts`](media-token-blanking.test.ts) | The media session token is blanked in the web error sink (M8-BLK-1). |
| [`press-outside.test.tsx`](press-outside.test.tsx) | Tests the `press-outside.tsx` helper. |
| [`press-outside.tsx`](press-outside.tsx) | Helper: presses the element behind the top dialog (backdrop of the last open overlay, else the body). |
| [`real-core-bed.tsx`](real-core-bed.tsx) | Helper: a Core in its own capture, with the two statements of the state (contract examples). |
| [`real-core-facts.test.tsx`](real-core-facts.test.tsx) | Dashboard, header checklist, Network & Time and the Monitor of a Core in its own capture (G75b-06). |
| [`routes.test.tsx`](routes.test.tsx) | Every page path renders its page, and the signed-out guard (AC-48, AC-49). |
| [`scalar-config.test.ts`](scalar-config.test.ts) | Scalar API reference configuration: privacy and scope flags, the rendered document, example payloads, no Scalar import outside `features/api-reference` (AC-57, AC-73). |
| [`selector-in-force.test.tsx`](selector-in-force.test.tsx) | Pages of a Core in real capture after a selector change. |
| [`setup.ts`](setup.ts) | Vitest setup: skips Motion animations and adds ResizeObserver, IntersectionObserver and matchMedia stand-ins for jsdom. |
| [`shell-motion.test.tsx`](shell-motion.test.tsx) | Shell motion: route exit animation and MotionPolicyProvider at the root. |
| [`sim-fetch.test.ts`](sim-fetch.test.ts) | simAwareFetch: passthrough in LIVE, simulator answers in SIMULATED. |
| [`static-scan.ts`](static-scan.ts) | Helper: the scan-coverage rule of the static blocks (the scan equals an independent listing of the folder and is not empty). |
| [`visual-audit-45b.test.tsx`](visual-audit-45b.test.tsx) | Ambient registry escalation reserve and the Session Monitor start time zone label (F45-02, F45-04, AC-74). |
## Main exports

Test helpers (no production use):

- `box-check.ts`: `boxCheck` and `boxCheckFailures`; per its header, the dev server serves it so a browser session can run the same check.
- `static-scan.ts`: `expectScanCovers` and `isProductionSource`, the scan-coverage rule used by the static test blocks.
- `press-outside.tsx`: `pressOutside` and `expectPressOutsideDismisses`.
- `real-core-bed.tsx`: `newSim`, `mount`, `realCore`, `useRealCorePages` and fixtures for a Core in its own capture.
- `demo-words.ts`: `withoutDemoMarks` and `demoMarkBlocks`.
- `setup.ts`: Vitest setup for jsdom.

## Core operations, state and shared modules

The tests reach the Core only through fakes: the Live harness of [`../runtime/testing/`](../runtime/testing/) and the simulator of `@dems/shared/sim`. Operations named in test titles include 12 (role change), 51, 64, 79, 80, 81 (retired), 91, 118 and 119. The tests import the pages from [`../features/`](../features/README.md), the shell from [`../components/`](../components/README.md), and helpers from [`../lib/`](../lib/README.md), [`../runtime/`](../runtime/README.md) and [`../motion/`](../motion/README.md).

## Tests

Run with `npm test -w @dems/core-web` from the repository root (Vitest, jsdom). Folder-level tests: the `__tests__/` folder of each folder under [`../features/`](../features/README.md), [`../components/`](../components/README.md), [`../lib/`](../lib/README.md) and [`../motion/`](../motion/README.md).

## Related decisions

None found in decisions.md for this folder.
