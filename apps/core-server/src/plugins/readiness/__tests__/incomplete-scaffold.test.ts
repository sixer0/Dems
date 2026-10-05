// A unit that forgets its seam or its stage stops the boot by name (plan row W08; P25). Two
// units are replaced here by plugins that provide nothing, as a careless rewrite of a stub
// would; the factory is the real one.
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../../app';
import { unitTestConfig } from '../../../../test/support/config';

vi.mock('../../../realtime', () => ({ realtimePlugin: async () => {} }));
vi.mock('../../throttle', () => ({ throttlePlugin: async () => {} }));

describe('an incomplete scaffold', () => {
  it('ready() rejects and names every seam and stage that nobody provided', async () => {
    const app = buildApp({ config: unitTestConfig() });
    await expect(app.ready()).rejects.toThrow(
      'the scaffold is incomplete: seam denialBudget, seam publish, request stage throttle not provided',
    );
    await app.close();
  });

  it('a seam that nobody provided names its owner when it is read', async () => {
    const app = buildApp({ config: unitTestConfig() });
    expect(() => app.publish).toThrow('seam "publish" has no provider (expected from src/realtime (W42))');
    await app.close();
  });

  it('replace() fills the gaps, so a test can still run such an app', async () => {
    const app = buildApp({ config: unitTestConfig() });
    app.seams.replace('publish', () => {});
    app.seams.replace('denialBudget', { consume: async () => {} });
    app.stages.replace('throttle', () => {});
    await expect(app.ready()).resolves.toBeDefined();
    await app.close();
  });
});
