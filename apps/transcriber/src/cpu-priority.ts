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
 * The `cpu-local` engine and the VAD engine are additionally started at a lower scheduling priority
 * (`STT_NICE`), and never at or above the priority of a running capture worker
 * (`engineIsBelowCaptureWorker`).
 */
import { TranscriberError, TranscriberErrorCode } from './types';

/** Physical cores left to capture by the DEFAULT plan (PROPOSAL; calibrated on the Core, class C). */
export const CAPTURE_RESERVED_CORES = 2;
/** How far below the process that starts it the `cpu-local` engine runs: the increment given to `nice -n`. */
export const STT_NICE = 10;

/** The lowest priority both macOS and Linux have. The operating system clamps a niceness there. */
export const LOWEST_NICE = 19;

/**
 * The niceness an engine started through `nice -n STT_NICE` runs at. `nice -n` is RELATIVE: it adds
 * to the niceness of the process that starts it (fix round 2, R-1). A Core that itself runs at 5
 * (a shell background job) gets its engine at 15, not at 10.
 */
export function expectedEngineNice(parentNice: number): number {
  return Math.min(parentNice + STT_NICE, LOWEST_NICE);
}

/**
 * THE RULE OF THE LOWERED ENGINE: its niceness is at least `STT_NICE` above the niceness of the
 * process that started it (or at the floor of the scale). It is a rule about the engine and ITS
 * PARENT. It says nothing about the engine and the capture worker, which is another process with
 * its own niceness: "the engine is lower than the capture worker" is `engineIsBelowCaptureWorker`
 * below (row 77), checked by the engine modules against the OBSERVED niceness of the worker.
 */
export function engineIsLowered(parentNice: number, engineNice: number): boolean {
  return Number.isInteger(parentNice) && Number.isInteger(engineNice) && engineNice >= expectedEngineNice(parentNice);
}

/**
 * THE SIBLING RULE (transcript spec §C "Priority direction"; row 77): the engine runs at a LOWER
 * priority than the capture worker, that is at a strictly HIGHER niceness. It is a rule between two
 * processes that have different parents' histories: the worker is started by the Core's capture
 * supervisor (not lowered there, so it runs at the niceness of the Core), the engine through
 * `nice -n STT_NICE`. Both values are OBSERVED from the operating system, never assumed. A worker
 * that already sits at the floor of the scale leaves no room below it: the rule then fails, and no
 * engine is started (fail closed; such a worker is a host misconfiguration).
 */
export function engineIsBelowCaptureWorker(workerNice: number, engineNice: number): boolean {
  return Number.isInteger(workerNice) && Number.isInteger(engineNice) && engineNice > workerNice;
}

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
