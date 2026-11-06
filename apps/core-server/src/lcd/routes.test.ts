import { afterEach, expect, it, vi } from 'vitest';
import { DeviceHealthResponseSchema } from '@dems/shared/api';
import { unitApp, operatorOf, HEALTH } from '../modules/devices/__tests__/support';

const apps: Awaited<ReturnType<typeof unitApp>>[] = [];
afterEach(async () => { for (const built of apps.splice(0)) await built.app.close(); vi.restoreAllMocks(); });

it('keeps the existing health authentication and exposes startup config only when enabled', async () => {
  const built = await unitApp(undefined, { lcdBackendUrl: 'http://127.0.0.1:8090' });
  apps.push(built);
  expect((await built.app.inject({ url: HEALTH })).statusCode).toBe(401);
  built.actAs(operatorOf('TECHNICIAN'));
  const response = await built.app.inject({ url: HEALTH });
  expect(response.statusCode).toBe(200);
  const body = DeviceHealthResponseSchema.parse(response.json());
  expect(body.lcd).toMatchObject({ backendUrl: 'http://127.0.0.1:8090', reachable: false, panelConnected: null, lastSyncAt: null, channels: [] });
});

it('does not schedule network traffic or change the health shape while disabled', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch');
  const built = await unitApp();
  apps.push(built);
  built.actAs(operatorOf('TECHNICIAN'));
  const response = await built.app.inject({ url: HEALTH });
  expect(response.json()).not.toHaveProperty('lcd');
  expect(fetcher).not.toHaveBeenCalled();
});
