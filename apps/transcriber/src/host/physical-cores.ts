/**
 * The number of PHYSICAL cores of this host (transcript spec §C; specs C-N2).
 *
 * Node reports logical processors only. The thread bound of STT is a bound on physical cores, so
 * the count is read from the host: `/proc/cpuinfo` on Linux (the Core), `sysctl hw.physicalcpu` on
 * macOS (this Mac). When neither answers, HALF the logical count is assumed (the conservative
 * reading of a host with two threads per core), never the logical count itself.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { availableParallelism, platform } from 'node:os';

export type PhysicalCoreSource = 'proc-cpuinfo' | 'sysctl' | 'half-of-logical';

export interface PhysicalCores {
  readonly count: number;
  readonly source: PhysicalCoreSource;
}

/** Distinct (`physical id`, `core id`) pairs of a `/proc/cpuinfo` text; 0 when it names none. */
export function countCpuinfoCores(cpuinfo: string): number {
  const cores = new Set<string>();
  for (const block of cpuinfo.split(/\n\s*\n/)) {
    const physical = /^physical id\s*:\s*(\d+)/m.exec(block)?.[1];
    const core = /^core id\s*:\s*(\d+)/m.exec(block)?.[1];
    if (physical !== undefined && core !== undefined) cores.add(`${physical}:${core}`);
  }
  return cores.size;
}

/** The fallback: half the logical processors, at least 1. */
export function halfOfLogical(logical: number): number {
  return Math.max(1, Math.floor(logical / 2));
}

export function detectPhysicalCores(): PhysicalCores {
  const os = platform();
  try {
    if (os === 'linux') {
      const count = countCpuinfoCores(readFileSync('/proc/cpuinfo', 'utf8'));
      if (count > 0) return { count, source: 'proc-cpuinfo' };
    }
    if (os === 'darwin') {
      const count = Number(execFileSync('/usr/sbin/sysctl', ['-n', 'hw.physicalcpu'], { encoding: 'utf8', timeout: 5_000, stdio: ['ignore', 'pipe', 'ignore'] }).trim());
      if (Number.isInteger(count) && count > 0) return { count, source: 'sysctl' };
    }
  } catch {
    // The host would not say: the conservative fallback below applies. Nothing is lost by it.
  }
  return { count: halfOfLogical(availableParallelism()), source: 'half-of-logical' };
}
