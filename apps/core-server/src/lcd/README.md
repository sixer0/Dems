# `src/lcd`

Up: [`src`](../README.md)

## Purpose

The Core's side of the LCD front panel: the bridge that posts each channel's state to the LCD backend every 2 seconds, the read of the panel firmware word (operation 114), and the proxy of the vendor-only panel setup (operations 115 and 116). The Core stores no panel setup itself.

## Contents

| File or folder | Role |
|---|---|
| [`backend-python.test.ts`](./backend-python.test.ts) | Tests (co-located with the unit). |
| [`bridge.test.ts`](./bridge.test.ts) | Tests (co-located with the unit). |
| [`bridge.ts`](./bridge.ts) | The LCD bridge: builds each channel's state (CH1 to CH4 = the four video tracks) and posts it to the LCD backend with a 6 s lease. |
| [`index.ts`](./index.ts) | Entry of the unit: `mountLcdBridge` (2 s timer on the engine state) and the re-exports of the panel-info reader and the panel-setup proxy. |
| [`panel-info.test.ts`](./panel-info.test.ts) | Tests (co-located with the unit). |
| [`panel-info.ts`](./panel-info.ts) | Operation 114 `getPanelFirmware`: reads the panel's firmware word and link verdict from the LCD backend, cached for 5 s, never a failure. |
| [`routes.test.ts`](./routes.test.ts) | Tests (co-located with the unit). |
| [`setup.test.ts`](./setup.test.ts) | Tests (co-located with the unit). |
| [`setup.ts`](./setup.ts) | Operations 115 and 116 (`getPanelSetup`, `setPanelSetup`): a proxy to the LCD backend behind the vendor-account gate; the Core stores nothing. |

## Main exports and entry points

Other units import this folder through `index.ts`.

- Exported from `index.ts`: `mountLcdBridge`, `PANEL_FIRMWARE_OPERATION_ID`, `PANEL_INFO_CACHE_MS`, `createPanelFirmwareReader`, `createPanelSetupProxy`, `PANEL_SETUP_OPERATION_IDS`, `LCD_BACKEND_UNREACHABLE`, `vendorGateOf`, `VENDOR_GATE_TEXT`.

## Dependencies

Module-level imports of the production files (tests excluded).

Inbound (who imports this folder):

- [`modules/devices`](../modules/devices/README.md): `index.ts`

Outbound (what this folder imports inside `src`):

- [`capture/fence`](../capture/fence/README.md)
- [`engine`](../engine/README.md)
- [`plugins/error-envelope`](../plugins/error-envelope/README.md)

- Workspace packages: `@dems/shared`
- npm packages: `fastify`, `zod`

## Tests

| Location | Test files | `*.db.test.ts` |
|---|---|---|
| this folder (co-located) | 5 | 0 |

None of these tests needs a database window.

## Related decisions

From the 2026-11-05 audit decisions log:

- D121: deploy of `lcd/bridge.ts`.
- D158: row L3b: the cam lamp lights only on a stated REACHABLE or an open source.
- D234: root fix of the cam lamp in `lcd/bridge.ts`.
