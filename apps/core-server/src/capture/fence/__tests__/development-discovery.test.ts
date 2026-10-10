// The admission of a development discovery source (fix wave H, driver D; gate 70 finding B-1;
// decision D196; SEC35-27 (6), SEC35-41 (a)). Pure: every row of the table in
// `development-discovery.ts`, through the ONE decision of the capture operation.
//
// SECURITY CONTROL, so it holds its negative control: the same call that admits a development
// configuration throws for the production one, and the flag that makes the difference is the
// development flag alone.
import { describe, expect, it } from 'vitest';
import { CaptureOperation } from '../../adapters';
import { DEV_CAMERA_STUB_IN_PRODUCTION, DevelopmentDiscoveryError, DevelopmentDiscoveryIgnored, captureOperationDecisionOf, developmentDiscoveryAdmissionOf } from '../index';
import { configOf } from './support';

const DEVELOPMENT = configOf({ captureMode: 'real', demoControls: false, captureDevSources: true });
const PRODUCTION = configOf({ captureMode: 'real', demoControls: false, captureDevSources: false });

describe('the fence admits a development discovery source in REAL_DEVELOPMENT only', () => {
  it('REAL_DEVELOPMENT, asked for: admitted', () => {
    const decision = captureOperationDecisionOf(DEVELOPMENT);
    expect(decision).toMatchObject({ operation: CaptureOperation.REAL_DEVELOPMENT, refusal: null });
    expect(developmentDiscoveryAdmissionOf(decision, true)).toEqual({ admitted: true, operation: 'REAL_DEVELOPMENT' });
  });

  it('NEGATIVE CONTROL - REAL_PRODUCTION, asked for: refused by name; the only difference to the admitted configuration is the development flag', () => {
    const decision = captureOperationDecisionOf(PRODUCTION);
    expect(decision).toMatchObject({ operation: CaptureOperation.REAL_PRODUCTION, refusal: null });
    let thrown: unknown = null;
    try {
      developmentDiscoveryAdmissionOf(decision, true);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(DevelopmentDiscoveryError);
    expect((thrown as DevelopmentDiscoveryError).code).toBe(DEV_CAMERA_STUB_IN_PRODUCTION);
    // The refusal names keys and codes: no path, no address, no value of the environment.
    expect((thrown as Error).message).toMatch(/REAL_PRODUCTION/);
    expect((thrown as Error).message).not.toMatch(/\/|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/);
  });

  it('SIMULATED, with and without demo controls: ignored and named, never admitted, never a throw', () => {
    for (const demoControls of [true, false]) {
      const decision = captureOperationDecisionOf(configOf({ demoControls }));
      expect(developmentDiscoveryAdmissionOf(decision, true)).toEqual({ admitted: false, operation: 'SIMULATED', ignored: DevelopmentDiscoveryIgnored.SIMULATED_HAS_NO_SEARCH });
    }
  });

  it('a flag combination the boot fence refuses (each of the three): ignored, because the boot stops the start itself', () => {
    const refused = [
      configOf({ captureMode: 'simulated', captureDevSources: true }),
      configOf({ captureMode: 'real', demoControls: true, captureDevSources: true }),
      configOf({ captureMode: 'real', demoControls: false, captureDevSources: true, host: '192.0.2.7' }),
    ];
    for (const config of refused) {
      const decision = captureOperationDecisionOf(config);
      expect(decision.refusal).not.toBeNull();
      expect(developmentDiscoveryAdmissionOf(decision, true)).toEqual({ admitted: false, operation: 'SIMULATED', ignored: DevelopmentDiscoveryIgnored.CAPTURE_FENCE_REFUSES_BOOT });
    }
  });

  it('not asked for: never admitted, in any operation, and production does not throw (the product path)', () => {
    for (const config of [DEVELOPMENT, PRODUCTION, configOf()]) {
      const decision = captureOperationDecisionOf(config);
      expect(developmentDiscoveryAdmissionOf(decision, false)).toEqual({ admitted: false, operation: decision.operation, ignored: DevelopmentDiscoveryIgnored.NOT_REQUESTED });
      // Anything but the literal `true` is "not asked for".
      expect(developmentDiscoveryAdmissionOf(decision, 1 as unknown as boolean).admitted).toBe(false);
    }
  });
});
