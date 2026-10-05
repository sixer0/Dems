/**
 * Throttle and denial budget: stage 5 of the request pipeline and the seam `denialBudget` (plan
 * row W23; spec §2.3, §5.1 ID-P12 and ID-P13; SR-24, SR-71, SR-75; decision D40).
 *
 * Stage 5, for every request that matched a route and passed stages 2 to 4, before the body is
 * read:
 *   1. THE REQUEST THROTTLE. One request is counted with `@fastify/rate-limit` under the
 *      caller's key: the principal that stage 4 resolved (`operator:<id>`, `device:<id>`), else
 *      one of two fixed classes chosen by the Origin category of stage 3 (`class:web`,
 *      `class:local`). Never a value the caller supplies: a made-up bearer value, a cookie that
 *      does not resolve and a retired device credential all count in the class bucket. Limits:
 *      `limits.ts`. Socket upgrades pass this stage and are counted like any request.
 *   2. THE DENIAL BUDGET of the same key. While the key holds 20 audited refusals within 60 s,
 *      every REST request of the key except health is answered here, without an audit row.
 *      Upgrades are not blocked by it.
 * Both refuse with 429 `RATE_LIMITED` and `retry-after` (whole seconds until the key's window
 * ends). A throttled request is logged, never audited (GS-07).
 *
 * `@fastify/rate-limit` is registered with `global: false`, so it adds its hook to no route: a
 * hook of its own would run after all five stages. The stage asks it to count through
 * `app.createRateLimit()`, which returns the outcome instead of answering, so the refusal is
 * the envelope's and no `x-ratelimit-*` header is sent (OR-9 lists the headers of an answer).
 *
 * Time: both libraries measure windows with the system time; the window a request counts in is
 * decided by the server clock (`app.clock`) and named in the counter's key (`core/windows.ts`).
 *
 * THE SEAM `denialBudget`, for the rows that write an audited refusal (`ACCESS_DENIED`,
 * `EXPORT_DENIED`, `AUTH_FAILED`, `AUTH_LOCKED`, `PAIRING_FAILED`, `PAIRING_LOCKED`):
 *
 *     await app.denialBudget.consume(request);      // BEFORE the audit row is written
 *     await writeTheRefusalRow();
 *     throw new ApiFailure(403, 'NOT_PERMITTED', '...');
 *
 * `consume` takes one of the 20 places of the key of the request that caused the refusal. It
 * resolves when a place was taken: write the row and refuse. It throws the 429 when no place is
 * left: let it propagate, write no row. Called once per refusal row, never for a 401 that
 * writes no row and never for an allowed call.
 *
 * CONTRACT with the scaffold (P25): the exports `throttlePlugin` and `DenialBudget` keep the
 * shape the scaffold declared. `ThrottleControl` is what this plugin provides behind the seam;
 * tests reach it with `throttleControl(app)`.
 */
import { ApiErrorCode, RETRY_AFTER_HEADER_NAME } from '@dems/shared/api';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import { ApiFailure } from '../error-envelope';
import { describeError, routeOf } from '../logger';
import { OriginRequestKind, requestKindOf } from '../origin-guard';
import { createDenialBudget, type BudgetRefusal, type DenialBudgetSnapshot } from './denial-budget';
import {
  DENIAL_BUDGET_MAX,
  HEALTH_OPERATION,
  THROTTLE_BUCKET_MAX,
  THROTTLE_WINDOW_MS,
  ThrottleBucket,
  bucketOf,
  classKeyOf,
  principalKeyOf,
  type ThrottleKey,
} from './limits';
import { counterName, createFixedWindows, retryAfterSeconds, type FixedWindows } from '../../core';

export { createDenialBudget, type BudgetRefusal, type DenialBudgetSnapshot, type KeyedDenialBudget } from './denial-budget';
export {
  DENIAL_BUDGET_MAX,
  DENIAL_BUDGET_WINDOW_MS,
  DEVICE_SIGN_IN_OPERATIONS,
  HEALTH_OPERATION,
  THROTTLE_BUCKET_MAX,
  THROTTLE_STRICT_MAX,
  THROTTLE_WIDE_MAX,
  THROTTLE_WINDOW_MS,
  ThrottleBucket,
  ThrottleClass,
  bucketOf,
  classKeyOf,
  principalKeyOf,
  type ThrottleKey,
} from './limits';

export interface DenialBudget {
  /**
   * Takes one of the 20 places of the throttle key of the request that caused a refusal
   * (ID-P13). Call it BEFORE the refusal's audit row is written, once per row.
   *
   *   - Resolves: a place was taken. Write the row, then refuse.
   *   - Throws an `ApiFailure` 429 `RATE_LIMITED` with `retry-after`: the key already holds 20
   *     refusals in its window. Let it propagate: no row is written, and the caller gets 429.
   *
   * It throws nothing else. If the budget itself fails, the failure is logged and the call
   * resolves: a refusal is never lost because its counter broke.
   */
  consume(request: FastifyRequest): Promise<void>;
}

/** What this plugin provides behind the seam: the budget, and what a test needs to steer it. */
export interface ThrottleControl extends DenialBudget {
  /** The key stage 5 counts a request under: its principal, or its class. */
  keyOf(request: FastifyRequest): ThrottleKey;
  /** The denial budget of one key at the server clock's time. */
  inspect(key: ThrottleKey): Promise<DenialBudgetSnapshot>;
  /**
   * Closes the open windows of one key, or of every key: the request throttle and the denial
   * budget start counting afresh. The other way to get there is to advance the server clock by
   * the window (60 s).
   */
  reset(key?: ThrottleKey): void;
}

function isThrottleControl(budget: DenialBudget): budget is ThrottleControl {
  return 'keyOf' in budget && 'inspect' in budget && 'reset' in budget;
}

/** The throttle's controls of an app. Throws when a test put another object behind the seam. */
export function throttleControl(app: FastifyInstance): ThrottleControl {
  const budget = app.denialBudget;
  if (!isThrottleControl(budget)) {
    throw new Error('app.denialBudget is not the budget of plugins/throttle: the seam was replaced');
  }
  return budget;
}

/**
 * The answer of both limiters. `retryAfter` is in whole seconds. The text is fixed and says
 * nothing about the key or the count.
 */
export function rateLimited(retryAfter: number): ApiFailure {
  return new ApiFailure(429, ApiErrorCode.RATE_LIMITED, 'Too many requests. Try again shortly.', {
    headers: { [RETRY_AFTER_HEADER_NAME]: String(retryAfter) },
  });
}

const BUDGET_FAILED = 'the denial budget could not be counted; the refusal is audited without it';

export const throttlePlugin: FastifyPluginAsync = async (app) => {
  // Counters only: no route gets a hook from the plugin, and it answers nothing by itself.
  await app.register(rateLimit, { global: false });

  /** The counter name of the request that is being counted; read by the plugin's key generator. */
  const counting = new WeakMap<FastifyRequest, string>();
  const keyGenerator = (request: FastifyRequest): string => {
    const name = counting.get(request);
    if (name === undefined) throw new Error('the throttle was asked to count a request it did not prepare');
    return name;
  };

  // One counter set and one set of windows per bucket: a key's strict and wide counts are apart.
  const bucket = (max: number): { count: ReturnType<typeof app.createRateLimit>; windows: FixedWindows } => ({
    count: app.createRateLimit({ max, timeWindow: THROTTLE_WINDOW_MS, keyGenerator }),
    windows: createFixedWindows(THROTTLE_WINDOW_MS),
  });
  const buckets = {
    [ThrottleBucket.STRICT]: bucket(THROTTLE_BUCKET_MAX.STRICT),
    [ThrottleBucket.WIDE]: bucket(THROTTLE_BUCKET_MAX.WIDE),
  };
  const budget = createDenialBudget();

  const keyOf = (request: FastifyRequest): ThrottleKey =>
    principalKeyOf(request.principal) ?? classKeyOf(app.originDecision(request).category);

  /** One line per key and window, when its limit is first reached: the request line of each 429 has the rest. */
  function logLimitReached(request: FastifyRequest, limiter: 'throttle' | 'denial-budget', key: ThrottleKey, limit: number): void {
    request.log.warn(
      { code: ApiErrorCode.RATE_LIMITED, route: routeOf(request), limiter, key, limit },
      'rate limit reached',
    );
  }

  function refuseByBudget(request: FastifyRequest, key: ThrottleKey, refusal: BudgetRefusal): never {
    if (refusal.first) logLimitReached(request, 'denial-budget', key, DENIAL_BUDGET_MAX);
    throw rateLimited(refusal.retryAfterSeconds);
  }

  /** Null when a place was taken or the budget failed; otherwise the refusal and its key. */
  async function takePlace(request: FastifyRequest): Promise<{ key: ThrottleKey; refusal: BudgetRefusal } | null> {
    try {
      const key = keyOf(request);
      const refusal = await budget.take(key, app.clock.now());
      return refusal === null ? null : { key, refusal };
    } catch (error) {
      const requestId: unknown = (request as Partial<FastifyRequest> | undefined)?.id;
      const context = { requestId: typeof requestId === 'string' ? requestId : null };
      app.log.error({ err: error, ...context }, BUDGET_FAILED);
      app.errorLog.append({
        level: 'error',
        source: 'throttle.denialBudget.consume',
        message: BUDGET_FAILED,
        ...describeError(error),
        context,
      });
      return null;
    }
  }

  const control: ThrottleControl = {
    async consume(request) {
      const refused = await takePlace(request);
      if (refused !== null) refuseByBudget(request, refused.key, refused.refusal);
    },
    keyOf,
    inspect: (key) => budget.inspect(key, app.clock.now()),
    reset(key) {
      buckets.STRICT.windows.forget(key);
      buckets.WIDE.windows.forget(key);
      budget.reset(key);
    },
  };
  app.seams.provide('denialBudget', control);

  app.stages.provide('throttle', async (request) => {
    const now = app.clock.now();
    const key = keyOf(request);
    const operationId = request.routeOptions.config.operationId;

    // 1. The request throttle (ID-P12).
    const bucketName = bucketOf(key, operationId);
    const { count, windows } = buckets[bucketName];
    const window = windows.open(key, now);
    counting.set(request, counterName(key, window));
    const counted = await count(request);
    if (!counted.isAllowed && counted.isExceeded) {
      if (!window.announced) {
        window.announced = true;
        logLimitReached(request, 'throttle', key, THROTTLE_BUCKET_MAX[bucketName]);
      }
      throw rateLimited(retryAfterSeconds(window, now));
    }

    // 2. The denial budget of the same key (ID-P13). Health is never blocked by it, and a socket
    //    upgrade writes no denial row, so it is not blocked either.
    if (operationId === HEALTH_OPERATION) return;
    if (requestKindOf(request.method, request.headers.upgrade) === OriginRequestKind.UPGRADE) return;
    const refusal = await budget.check(key, now);
    if (refusal !== null) refuseByBudget(request, key, refusal);
  });
};
