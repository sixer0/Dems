// Fix wave J round two (JW-26 mobile half; contract J2-S 2): which version a footer shows. A new module: its own test.
import { describe, expect, it } from '@jest/globals';
import { SOFTWARE_VERSION } from '@dems/shared/sim';
import { ownAppVersion, shownVersionOf } from './app-version';

describe('shownVersionOf', () => {
  it('LIVE: the app states its OWN build - never the demonstration model\'s version', () => {
    expect(shownVersionOf({ live: true, appVersion: '0.1.0' })).toEqual({ version: '0.1.0', kind: 'APP' });
    expect(shownVersionOf({ live: true, appVersion: '0.1.0' }).version).not.toBe(SOFTWARE_VERSION);
  });

  it('the Simulated source keeps the model\'s version; so does a build that states no version', () => {
    expect(shownVersionOf({ live: false, appVersion: '0.1.0' })).toEqual({ version: SOFTWARE_VERSION, kind: 'MODEL' });
    expect(shownVersionOf({ live: true, appVersion: null })).toEqual({ version: SOFTWARE_VERSION, kind: 'MODEL' });
  });

  it('the app\'s own version is the build constant (a string or null, never the model\'s)', () => {
    const own = ownAppVersion();
    expect(own === null || (typeof own === 'string' && own !== '')).toBe(true);
    expect(own).not.toBe(SOFTWARE_VERSION);
  });
});
