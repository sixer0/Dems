/**
 * Global setup of the self-check project `unreachable`: the real setup of `test:db`, with its
 * reachability probe pointed at a loopback port on which nothing listens. The real server is
 * not touched. The setup must throw, so the run fails and its test file never runs (TI-1).
 */
import type { TestProject } from 'vitest/node';
import { setupDbTestProject } from '../global-setup';
import { findClosedLoopbackPort } from '../testing/closed-port';

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const port = await findClosedLoopbackPort();
  process.stdout.write(`[selfcheck] the probe is pointed at 127.0.0.1:${port}, where nothing listens\n`);
  return setupDbTestProject(project, { probeTarget: { host: '127.0.0.1', port } });
}
