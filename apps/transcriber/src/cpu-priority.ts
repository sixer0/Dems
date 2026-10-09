/**
 * The CPU priority rule: capture outranks STT (transcript spec §C; specs C-N2, R-7 AC-4; RK-1).
 *
 * Three bounds, all of them configuration rules that a test can assert (M6-CP-1). None of them is
 * a measurement and none records a speed (D230):
 *
 *   1. THREAD PRODUCT. `threads * processors` of one engine run is at most the physical cores of
 *      the host. A plan that asks for more is REFUSED at configuration time; it is not silently
 *      shrunk at run time, so a session never runs with another bound than the one it was given.
 *   2. HEADROOM. The default leaves `CAPTURE_RESERVED_CORES` physical cores to capture (PROPOSAL).
 *   3. ONE AT A TIME. Every engine call of an adapter passes one queue (`SerialQueue`): one chunk
 *      is decoded at a time, and calls to the shared oMLX server are serialised (D7(d)).
 *
 * The `cpu-local` engine is additionally started at a lower scheduling priority (`STT_NICE`).
 */
import { TranscriberError, TranscriberErrorCode } from './types';

/** Physical cores left to capture by the DEFAULT plan (PROPOSAL; calibrated on the Core, class C). */
export const CAPTURE_RESERVED_CORES = 2;
/** The niceness of the `cpu-local` engine process: below the capture worker, which runs at 0. */
export const STT_NICE = 10;

export interface SttThreadPlan {
  /** `whisper-cli -t`. */
  readonly threads: number;
  /** `whisper-cli -p`. 1 = the flag is not passed. */
  readonly processors: number;
  readonly physicalCores: number;
}

function positiveInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 1;
}

/** The default: one processor, and every physical core but the ones reserved for capture. */
export function defaultSttThreadPlan(physicalCores: number): SttThreadPlan {
  if (!positiveInteger(physicalCores)) {
    throw new TranscriberError(TranscriberErrorCode.CONFIG_INVALID, 'the physical core count must be a positive integer', { physicalCores });
  }
  return { threads: Math.max(1, physicalCores - CAPTURE_RESERVED_CORES), processors: 1, physicalCores };
}

/**
 * Checks a requested plan. Refuses (`CONFIG_INVALID`, reason `THREAD_PRODUCT_EXCEEDS_CORES`) when
 * `threads * processors` is more than the physical cores.
 */
export function planSttThreads(request: { threads?: number; processors?: number; physicalCores: number }): SttThreadPlan {
  const fallback = defaultSttThreadPlan(request.physicalCores);
  const processors = request.processors ?? 1;
  const threads = request.threads ?? Math.max(1, Math.floor(fallback.threads / (positiveInteger(processors) ? processors : 1)));
  if (!positiveInteger(threads) || !positiveInteger(processors)) {
    throw new TranscriberError(TranscriberErrorCode.CONFIG_INVALID, 'threads and processors must be positive integers', {
      reason: 'THREAD_BOUND_NOT_A_POSITIVE_INTEGER',
    });
  }
  if (threads * processors > request.physicalCores) {
    throw new TranscriberError(TranscriberErrorCode.CONFIG_INVALID, 'the STT thread product is more than the physical cores of this host', {
      reason: 'THREAD_PRODUCT_EXCEEDS_CORES',
      threads,
      processors,
      physicalCores: request.physicalCores,
    });
  }
  return { threads, processors, physicalCores: request.physicalCores };
}

/** True when a plan holds the bound. The engine re-checks it before every run. */
export function threadPlanHolds(plan: SttThreadPlan): boolean {
  return positiveInteger(plan.threads) && positiveInteger(plan.processors) && plan.threads * plan.processors <= plan.physicalCores;
}

/**
 * Runs tasks one at a time, in the order they were added. A failed task does not stop the queue.
 * `maxObserved` is the highest number of tasks that were ever inside at once: 1, or the queue is
 * broken (M6-CP-1 asserts it).
 */
export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private inside = 0;
  private highest = 0;
  private waiting = 0;

  get maxObserved(): number {
    return this.highest;
  }

  get pending(): number {
    return this.waiting;
  }

  run<T>(task: () => Promise<T>): Promise<T> {
    this.waiting += 1;
    const result = this.tail.then(async () => {
      this.waiting -= 1;
      this.inside += 1;
      this.highest = Math.max(this.highest, this.inside);
      try {
        return await task();
      } finally {
        this.inside -= 1;
      }
    });
    this.tail = result.catch(() => undefined);
    return result;
  }
}
