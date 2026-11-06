import type { FastifyInstance } from 'fastify';
import { captureOperationOf } from '../capture/fence';
import { createLcdBridge, LCD_INTERVAL_MS } from './bridge';

/**
 * The unit's second half: the read of what the panel says about itself (operation 114). Offered here
 * because the devices unit imports this index, never a file inside the unit (CPB1-16).
 */
export { PANEL_FIRMWARE_OPERATION_ID, PANEL_INFO_CACHE_MS, createPanelFirmwareReader } from './panel-info';
export { createPanelSetupProxy, PANEL_SETUP_OPERATION_IDS, LCD_BACKEND_UNREACHABLE, vendorGateOf, VENDOR_GATE_TEXT } from './setup';

/** Registered within the existing devices unit; disabled means no timer and no HTTP calls. */
export function mountLcdBridge(app: FastifyInstance) {
  const url = app.config.lcdBackendUrl;
  if (!url) return null;
  const bridge = createLcdBridge({
    // G-R16 (static): the mode is never compared here - the one function is asked (2026-11-04).
    url, real: captureOperationOf(app.config) !== 'SIMULATED',
    readState: () => app.engine.running ? app.engine.state() : null,
  });
  let timer: ReturnType<typeof setInterval> | undefined;
  app.addHook('onReady', async () => {
    timer = setInterval(() => {
      if (app.engine.running) void bridge.tick();
    }, LCD_INTERVAL_MS);
    timer.unref();
  });
  app.addHook('preClose', async () => {
    clearInterval(timer);
    await bridge.close();
  });
  return bridge;
}
