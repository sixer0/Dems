// Integration pass E3 item 6 (d): which items have a sealed v2 package in THIS Core's store, and so
// go to the REAL verifier of operation 41 (`findItem` of the sealing composition) - and which never do.
import { describe, expect, it } from 'vitest';
import { hasSealedPackageHere, isSeedSealedDemoItem } from '../index';

const SIGNED = { algorithm: 'Ed25519', simulated: false };
const STAND_IN = { algorithm: 'SIMULATED-SHA256', simulated: true };
const seedSealed = { integritySource: 'DEMO_PACKAGE', manifestVersion: 2, developmentSources: true, signature: SIGNED };

describe('a seed-sealed demo item, and nothing that only resembles one', () => {
  it('DEMO_PACKAGE, version 2, development sources, really signed: all four', () => {
    expect(isSeedSealedDemoItem(seedSealed)).toBe(true);
    expect(hasSealedPackageHere(seedSealed)).toBe(true);
  });

  it('each fact taken away refuses it - above all a frozen v1 demo item that the mapping reads as version 2 (it binds a transcript hash) keeps the hosted verify', () => {
    const not = [
      { ...seedSealed, signature: STAND_IN },
      { ...seedSealed, signature: { algorithm: 'Ed25519', simulated: true } },
      { ...seedSealed, signature: { algorithm: 'SIMULATED-SHA256', simulated: false } },
      { ...seedSealed, developmentSources: false },
      { ...seedSealed, developmentSources: undefined },
      { ...seedSealed, manifestVersion: 1 },
      { ...seedSealed, manifestVersion: undefined },
      { ...seedSealed, integritySource: 'SIMULATED' },
      { integritySource: 'DEMO_PACKAGE', manifestVersion: 2, signature: STAND_IN },
    ];
    for (const item of not) {
      expect(isSeedSealedDemoItem(item), JSON.stringify(item)).toBe(false);
      expect(hasSealedPackageHere(item), JSON.stringify(item)).toBe(false);
    }
  });

  it('a REAL item of version 2 has its package here, as before; a REAL row of version 1 does not', () => {
    expect(hasSealedPackageHere({ integritySource: 'REAL', manifestVersion: 2, signature: SIGNED })).toBe(true);
    expect(isSeedSealedDemoItem({ integritySource: 'REAL', manifestVersion: 2, developmentSources: true, signature: SIGNED })).toBe(false);
    expect(hasSealedPackageHere({ integritySource: 'REAL', manifestVersion: 1, signature: SIGNED })).toBe(false);
  });
});
