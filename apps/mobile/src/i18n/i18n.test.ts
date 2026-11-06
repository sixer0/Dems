// Mobile i18n runtime and resource layering (04_mobile_specs §9; MA-21 missing-key recorder).
import { beforeEach, describe, expect, it } from '@jest/globals';
import { en as sharedEn, SHARED_NAMESPACES } from '@dems/shared/i18n';
import { enMobile } from './en.mobile';
import { FEATURE_RESOURCES } from './features';
import { buildEnResources, getMissingKeys, i18n, mergeResources, resetMissingKeys } from './index';

describe('mergeResources', () => {
  it('deep-merges left to right without mutating the inputs', () => {
    const shared = { status: { ready: 'Ready', offline: 'Offline' }, app: { title: 'DEMS' } };
    const mobile = { status: { offline: 'Core offline' }, mobile: { nav: { home: 'Home' } } };
    const merged = mergeResources([shared, mobile]);
    expect(merged).toEqual({
      status: { ready: 'Ready', offline: 'Core offline' },
      app: { title: 'DEMS' },
      mobile: { nav: { home: 'Home' } },
    });
    expect(shared.status.offline).toBe('Offline');
  });

  it('reports every leaf a later layer overrides', () => {
    const overridden: string[] = [];
    mergeResources([{ a: { b: 'x', c: 'y' } }, { a: { b: 'z' } }, { a: 'flat' }], (path) => overridden.push(path));
    expect(overridden).toEqual(['a.b', 'a']);
  });
});

describe('mobile i18n instance', () => {
  beforeEach(() => resetMissingKeys());

  it('is initialised synchronously in English', () => {
    expect(i18n.isInitialized).toBe(true);
    expect(i18n.language).toBe('en');
    expect(i18n.t('mobile.nav.networkTime')).toBe('Network & Time');
  });

  it('interpolates without HTML escaping', () => {
    expect(i18n.t('mobile.pairing.trustLinePaired', { device: 'DEMS-IR-01' })).toBe(
      'Core: DEMS-IR-01 • paired (simulated)',
    );
    expect(i18n.t('mobile.app.versionFooter', { version: '2.4.1' })).toBe('DEMS EDGE CLIENT · v2.4.1');
  });

  it('keeps the Indonesian subject types verbatim with an English gloss (D28/Q3)', () => {
    expect(i18n.t('mobile.subjectType.Tersangka.label')).toBe('Tersangka');
    expect(i18n.t('mobile.subjectType.Tersangka.gloss')).toBe('Suspect');
    expect(i18n.t('mobile.subjectType.Saksi.gloss')).toBe('Witness');
    expect(i18n.t('mobile.subjectType.Lainnya.gloss')).toBe('Other');
  });

  it('records missing keys in development builds (MA-21)', () => {
    expect(getMissingKeys()).toEqual([]);
    i18n.t('mobile.does.not.exist');
    expect(getMissingKeys()).toEqual(['translation:mobile.does.not.exist']);
    resetMissingKeys();
    expect(getMissingKeys()).toEqual([]);
  });

  // Step 68 asserted the empty registry it handed over; step 70 (the registry's owner, P6) filled
  // it; step 73 put the shared resources underneath. The invariant: three disjoint layers, the
  // feature registry under features.*, and no layer overriding another.
  it('layers shared en, then mobile.*, then features.*, without overrides', () => {
    const overridden: string[] = [];
    const resources = buildEnResources((path) => overridden.push(path));
    expect(resources).toEqual({ ...sharedEn, ...enMobile, features: FEATURE_RESOURCES });
    expect(overridden).toEqual([]);
    expect(Object.keys(resources).sort()).toEqual([...SHARED_NAMESPACES, 'features', 'mobile'].sort());
  });

  it('resolves the shared keys through the app instance (04 §9: web and mobile say the same thing)', () => {
    expect(i18n.t('common.subjectType.TERSANGKA')).toBe('Tersangka');
    expect(i18n.t('common.actions.endSession')).toBe('End Session');
    expect(i18n.t('login.errors.invalid')).toBe('Invalid username or password.');
    expect(i18n.t('login.errors.attemptsRemaining', { count: 1 })).toBe('1 attempt remaining');
    expect(i18n.t('login.errors.attemptsRemaining', { count: 4 })).toBe('4 attempts remaining');
    expect(i18n.t('mobile.idleLock.title')).toBe('Session expired');
    expect(getMissingKeys()).toEqual([]);
  });

  it('never hands i18next the shared object itself (the merge is a copy)', () => {
    const resources = buildEnResources() as { common: unknown };
    expect(resources.common).toEqual(sharedEn.common);
    expect(resources.common).not.toBe(sharedEn.common);
  });
});
