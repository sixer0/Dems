/**
 * CHECK FOR THE TEST RUNNER, not a test file (blueprint row 61; pair-58 F-10): the REAL capture
 * worker builds of `apps/capture-worker/build/` through the boot check's handshake.
 *
 *   build/capture-worker            must say HELLO with a release version: NOT refused
 *   build/capture-worker-*          every proof build must be refused as CAPTURE_WORKER_PROOF_BUILD
 *
 * It STARTS THE WORKER (for its first frame only: no START is sent, no port is bound, no file of
 * evidence is opened), so it runs under the heavy-host lock, from the repository root:
 *
 *   /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock npx tsx apps/core-server/src/capture/boot/__tests__/worker-probe.real.ts
 *
 * Build first: `make -C apps/capture-worker all proof`. Exit 0 only when every verdict is the expected one.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPOSITORY } from '../../../../test/static/scan';
import { createProcessLauncher } from '../../ipc';
import { createSystemTimers } from '../../timers';
import { CaptureBootRefusal, workerVersionRefusalOf } from '../checks';
import { probeWorkerHandshake } from '../worker-probe';

const BUILD = resolve(REPOSITORY, 'apps/capture-worker/build');
const LOG = resolve(REPOSITORY, '.data', 'row61-worker-probe.jsonl');

async function verdictOf(name: string): Promise<string> {
  const launcher = createProcessLauncher({ command: resolve(BUILD, name), args: ['--log', LOG, '--heartbeat-ms', '1000'] });
  const hello = await probeWorkerHandshake({ launcher, timers: createSystemTimers() });
  if (hello.outcome !== 'HELLO') return `NO_HELLO:${hello.failure}`;
  return `${workerVersionRefusalOf(hello) ?? 'ACCEPTED'} (${hello.workerVersion})`;
}

async function main(): Promise<number> {
  if (!existsSync(resolve(BUILD, 'capture-worker'))) {
    console.error('worker-probe.real: build/capture-worker is missing: run make -C apps/capture-worker all proof');
    return 2;
  }
  const proofs = readdirSync(BUILD).filter((name) => /^capture-worker-[a-z-]+$/.test(name) && statSync(resolve(BUILD, name)).isFile() && name !== 'capture-worker-skeleton111');
  let bad = 0;
  const release = await verdictOf('capture-worker');
  console.log(`capture-worker: ${release}`);
  if (!release.startsWith('ACCEPTED')) bad += 1;
  for (const name of proofs) {
    const verdict = await verdictOf(name);
    console.log(`${name}: ${verdict}`);
    if (!verdict.startsWith(CaptureBootRefusal.WORKER_PROOF_BUILD)) bad += 1;
  }
  if (proofs.length < 6) {
    console.error(`worker-probe.real: expected the six proof builds of the Makefile, found ${proofs.length}`);
    bad += 1;
  }
  console.log(bad === 0 ? `worker-probe.real: OK (1 release build accepted, ${proofs.length} proof builds refused)` : `worker-probe.real: ${bad} unexpected verdict(s)`);
  return bad;
}

main().then(
  (code) => process.exit(code === 0 ? 0 : 1),
  () => process.exit(1),
);
