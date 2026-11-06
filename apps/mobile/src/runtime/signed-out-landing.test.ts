// Row FX-M1, defect E2E-S-1 (decision D201): the pure part of `SignedOutLanding`. The route-level
// proof (the real route tree, the paired Pair view and Stack Check left underneath) is
// `features/pairing/pairing-handoff-routes.test.tsx`.
import { describe, expect, it, jest } from '@jest/globals';
import { resetToBootRouter, signedOutLandingFor, type BootResetRouter } from './signed-out-landing';

describe('signedOutLandingFor: the top screen once (app) is gone', () => {
  it('follows the table of the file header', () => {
    // [top, gate held, step]
    const table: [string | undefined, boolean, 'wait' | 'done' | 'boot'][] = [
      ['(app)', false, 'wait'],
      ['(app)', true, 'wait'],
      [undefined, false, 'done'],
      ['index', false, 'done'],
      ['(auth)', false, 'done'],
      ['pair', true, 'done'],
      ['pair', false, 'boot'], // E2E-S-1: the paired Pair view after Sign Out
      ['stack-check', false, 'boot'],
      ['stack-check', true, 'boot'], // a revocation over Stack Check: the boot router opens Pair
      ['dev-gallery', false, 'boot'],
      ['+not-found', false, 'boot'],
    ];
    for (const [top, held, step] of table) expect([top, held, signedOutLandingFor(top, held)]).toEqual([top, held, step]);
  });
});

describe('resetToBootRouter', () => {
  const routerWith = (canDismiss: boolean) => {
    const calls: string[] = [];
    const router: BootResetRouter = {
      canDismiss: jest.fn(() => canDismiss),
      dismissAll: jest.fn(() => {
        calls.push('dismissAll');
      }),
      replace: jest.fn((href) => {
        calls.push(`replace ${String(href)}`);
      }),
    };
    return { router, calls };
  };

  it('pops to the first screen, then replaces it with `/` (no query): nothing visited before stays underneath', () => {
    const { router, calls } = routerWith(true);
    resetToBootRouter(router);
    expect(calls).toEqual(['dismissAll', 'replace /']);
  });

  it('with one screen only, it replaces it (a pop would be an unhandled action)', () => {
    const { router, calls } = routerWith(false);
    resetToBootRouter(router);
    expect(calls).toEqual(['replace /']);
  });
});
