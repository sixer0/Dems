// Fix wave J round two (JW-26 mobile half; contract J2-S 2): operation 64 `components`, read by name. A new module.
import { describe, expect, it } from '@jest/globals';
import { SYSTEM_COMPONENTS_EXAMPLE } from '@dems/shared/api';
import { SOFTWARE_VERSION } from '@dems/shared/sim';
import { coreComponentsOf } from './core-components';

describe('coreComponentsOf', () => {
  it('the contract\'s example, fed unmodified: the three versions by name', () => {
    expect(coreComponentsOf({ components: SYSTEM_COMPONENTS_EXAMPLE })).toEqual({
      coreName: SYSTEM_COMPONENTS_EXAMPLE.core.name,
      core: SYSTEM_COMPONENTS_EXAMPLE.core.version,
      captureWorker: SYSTEM_COMPONENTS_EXAMPLE.captureWorker.version,
      apiContract: SYSTEM_COMPONENTS_EXAMPLE.apiContract.version,
    });
    expect(Object.values(coreComponentsOf({ components: SYSTEM_COMPONENTS_EXAMPLE })!)).not.toContain(SOFTWARE_VERSION);
  });

  it('a Core in SIMULATED capture states no worker: null for it, the rest stays', () => {
    const { captureWorker: _worker, ...simulated } = SYSTEM_COMPONENTS_EXAMPLE;
    expect(coreComponentsOf({ components: simulated })).toMatchObject({ core: '0.2.0', captureWorker: null, apiContract: '0.3.0' });
  });

  it('an older Core (no member), or anything that is no answer: null - nothing is invented', () => {
    expect(coreComponentsOf({ device: { softwareVersion: SOFTWARE_VERSION } })).toBeNull();
    expect(coreComponentsOf(null)).toBeNull();
    expect(coreComponentsOf('x')).toBeNull();
  });
});
