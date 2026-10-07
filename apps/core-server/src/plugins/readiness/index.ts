/**
 * Readiness (plan row W08; spec §2.3 stage 2, §7.4, §8.6; database contract §7.4).
 *
 * `app.readiness` is the decorator `readiness` of the seam list (P25). It holds:
 *   - two flags, `database` and `engine`, which the health operation reports as `ready`;
 *   - holds: a named reason to refuse requests although both flags are set (a demo reset, the
 *     shutdown). The two log lines of a hold carry its name under the key `hold`: a name chosen
 *     in the code, never something that was caught (decision D96, ruling 2);
 *   - the boot steps: what must succeed before the entry point opens the listener.
 *
 * Stage 2 of the request pipeline is provided here: while the server is not ready, every
 * operation except `getServiceHealth` answers 503 `NOT_READY`. Health always answers 200.
 *
 * Boot steps. The app factory never touches the database: `buildApp()` followed by
 * `app.inject()` works with no PostgreSQL at all, which every database-free test relies on.
 * Work that needs the database at start (the boot checks B-1 to B-9, the epoch, rehydration)
 * is a boot step: a plugin adds it with `app.readiness.addBootStep()`, and only the entry point
 * (and a database test that wants it) calls `app.readiness.boot()`. Steps run in the order they
 * were added, which is the registration order of the plugins. A step that throws stops the
 * boot: the entry point logs the step's ID and exits without a listener.
 */
import type { FastifyBaseLogger, FastifyPluginAsync } from 'fastify';
import type { RegistryOperationId } from '../../core';
import { notReady } from '../error-envelope';

/** The one operation that answers while the server is not ready (spec §2.3 stage 2). A registry operation ID (W91-5). */
export const READINESS_EXEMPT_OPERATION = 'getServiceHealth' satisfies RegistryOperationId;

export type ReadinessPart = 'database' | 'engine';

/** `ready` of the health answer (spec §7.4). */
export interface ReadinessSnapshot {
  readonly database: boolean;
  readonly engine: boolean;
}

export interface BootStep {
  /** Appears in the log line when the step fails, for example `B-4` or `engine.rehydrate`. */
  readonly id: string;
  run(): Promise<void>;
}

/** Thrown by `boot()`. `stepId` names the step; `cause` is what the step threw. */
export class BootError extends Error {
  readonly stepId: string;

  constructor(stepId: string, cause: unknown) {
    super(`boot step ${stepId} failed`, { cause });
    this.name = 'BootError';
    this.stepId = stepId;
  }
}

export interface Readiness {
  snapshot(): ReadinessSnapshot;
  /** True when both flags are set and no hold is active: stage 2 lets a request through. */
  isReady(): boolean;
  set(part: ReadinessPart, ready: boolean): void;
  /**
   * Refuses requests until the returned function is called (a demo reset, the shutdown). `name`
   * says why, in a word chosen in the code (`shutdown`, `demo-reset`); it is what the two
   * `readiness hold` log lines show. Holds with the same name are counted, and releasing twice
   * is harmless.
   */
  hold(name: string): () => void;
  addBootStep(step: BootStep): void;
  /** Runs the boot steps in order. Rejects with a `BootError` at the first step that throws. */
  boot(): Promise<void>;
}

export function createReadiness(log: FastifyBaseLogger): Readiness {
  const flags: Record<ReadinessPart, boolean> = { database: false, engine: false };
  const holds = new Map<symbol, string>();
  const steps: BootStep[] = [];

  return {
    snapshot: () => ({ database: flags.database, engine: flags.engine }),
    isReady: () => flags.database && flags.engine && holds.size === 0,
    set(part, ready) {
      if (flags[part] === ready) return;
      flags[part] = ready;
      log.info({ part, ready }, 'readiness changed');
    },
    hold(name) {
      const key = Symbol(name);
      holds.set(key, name);
      log.info({ hold: name, held: true }, 'readiness hold');
      return () => {
        if (holds.delete(key)) log.info({ hold: name, held: false }, 'readiness hold');
      };
    },
    addBootStep(step) {
      steps.push(step);
    },
    async boot() {
      for (const step of steps) {
        try {
          await step.run();
        } catch (cause) {
          throw new BootError(step.id, cause);
        }
        log.info({ step: step.id }, 'boot step passed');
      }
    },
  };
}

export const readinessPlugin: FastifyPluginAsync = async (app) => {
  const readiness = createReadiness(app.log);
  app.decorate('readiness', readiness);

  app.stages.provide('readiness', (request) => {
    if (request.routeOptions.config.operationId === READINESS_EXEMPT_OPERATION) return;
    if (!readiness.isReady()) throw notReady();
  });
};
