import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { buildScenarioState, createIdleState } from '@dems/shared/sim';
import { pickDurable } from '../db/mapping';
import { createLcdBridge } from './bridge';

it('synchronizes with the imported Python HTTP backend without USB and expires a lost heartbeat', async () => {
  const source = fileURLToPath(new URL('../../../lcd-backend/app/dems_backend.py', import.meta.url));
  const child = spawn('python3', ['-B', '-u', '-c', `
import importlib.util, sys, types, threading
sys.modules['serial'] = types.ModuleType('serial')
spec = importlib.util.spec_from_file_location('lcd', sys.argv[1])
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
server = m.ThreadingHTTPServer(('127.0.0.1', 0), m.H)
threading.Thread(target=m.reaper, daemon=True).start()
print(server.server_address[1], flush=True)
server.serve_forever()
`, source], { env: { DEMS_CH_NAMES: 'CH1,CH2,CH3,CH4', DEMS_REKAM_DIR: '/tmp' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const lines = createInterface({ input: child.stdout });
  let bridge: ReturnType<typeof createLcdBridge> | undefined;
  try {
    const [line] = await Promise.race([
      once(lines, 'line'),
      once(child, 'error').then(([error]) => { throw error; }),
      once(child, 'exit').then(() => { throw new Error('Python LCD fixture exited before listen'); }),
    ]);
    const url = `http://127.0.0.1:${String(line)}`;
    const state = pickDurable(buildScenarioState('recording', createIdleState({ now: Date.now(), seed: 123 })));
    bridge = createLcdBridge({ url, real: false, readState: () => state });
    await bridge.tick();
    expect(bridge.status()).toMatchObject({ reachable: true, panelConnected: false });
    const read = async () => await (await fetch(`${url}/api/dems/status`)).json() as { nrec: number; channels: Array<{ rec: string; file: string }> };
    expect((await read()).nrec).toBe(2);
    await bridge.close();
    expect((await read()).nrec).toBe(0);
    await fetch(`${url}/api/dems/ch/1/status`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rec: 'start', lease: 0.01, cam: true }),
    });
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    expect((await read()).nrec).toBe(0);
  } finally {
    await bridge?.close();
    lines.close();
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      await exited;
    }
  }
}, 10_000);
