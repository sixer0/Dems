// Backend task W56, static tests over the production files of `apps/mobile/src/auth`
// (04_client_integration_spec AC-C-53, MD-6, MP-2, MB-6a; the copy of §6.4, §6.5, §9.3, WS-14).
// They read source text: what a file names, not what it does at run time.
import { beforeEach, describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildEnResources, getMissingKeys, i18n, resetMissingKeys } from '@/i18n';
import { authEn } from './i18n';
import { AUTH_I18N_PREFIX, registerAuthResources } from './i18n-bundle';
import { expectScanIsTheFolder } from '@/runtime/testing/static-scan';

const FOLDER = __dirname;
const production = readdirSync(FOLDER)
  .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
  .sort();
const source = (name: string): string => readFileSync(join(FOLDER, name), 'utf8');
const linesNaming = (name: string, text: string): string[] => source(name).split('\n').filter((line) => line.includes(text));

/** The one file that touches the secure-store wrapper; a debug build alone loads it. */
const TOKEN_STORE = 'live-biometric.ts';

describe('the production files of the auth layer', () => {
  it('are the ones this test reads', () => {
    // Rule R1 (`@/runtime/testing/static-scan`): the scan is the folder's production sources, by a second walk; not a list.
    expectScanIsTheFolder(production, FOLDER);
  });

  it('take the Core`s actions from `useCoreActions()`: no `useSimActions`, no `.actions` read on a source (AC-C-53)', () => {
    const onSource = /\b(?:sim|live|source|mobile|runtime)(?:\.live|\.sim)?\.actions\b/;
    for (const name of production) {
      const text = source(name);
      expect({ name, useSimActions: text.includes('useSimActions'), actionsOnSource: onSource.test(text) }).toEqual({
        name,
        useSimActions: false,
        actionsOnSource: false,
      });
    }
    // The matcher finds what it looks for.
    for (const naming of ['sim.actions.signIn(a, b)', 'live.actions.touch()', 'mobile.live.actions.pair(code)', 'auth: sim.actions,']) expect(onSource.test(naming)).toBe(true);
    expect(onSource.test('<View style={styles.actions}>')).toBe(false);
    expect(source('auth-provider.tsx')).toContain('useCoreActions()');
    expect(source('live-auth-provider.tsx')).toContain('useCoreActions()');
  });

  it('never import the fake transport or a test helper', () => {
    for (const name of production) {
      expect({ name, testing: /live\/testing|\/testing\/|@jest\/globals/.test(source(name)) }).toEqual({ name, testing: false });
    }
  });
});

describe('what a release bundle holds of it (MD-6)', () => {
  it('the secure-store wrapper is imported by the token storage alone; every other file names it as a type only', () => {
    for (const name of production.filter((file) => file !== TOKEN_STORE)) {
      for (const line of linesNaming(name, 'secure-credentials')) {
        const code = line.trim();
        // A type-only import is erased; a comment names the file and loads nothing.
        expect({ name, line: code, loads: !(code.startsWith('import type ') || code.startsWith('*') || code.startsWith('//')) }).toEqual({ name, line: code, loads: false });
      }
    }
    expect(linesNaming(TOKEN_STORE, "from '@/runtime/secure-credentials'")).toHaveLength(1);
  });

  it('the token storage is loaded in ONE place, behind a literal `__DEV__` test; elsewhere it is a type', () => {
    const naming = production.flatMap((name) => linesNaming(name, "'./live-biometric'").map((line) => ({ name, line: line.trim() })));
    const loading = naming.filter(({ line }) => !line.startsWith('import type '));
    expect(loading).toHaveLength(1);
    expect(loading[0]!.name).toBe('live-auth-provider.tsx');
    expect(loading[0]!.line).toContain("require('./live-biometric') as typeof import('./live-biometric')");

    // The `require` stands inside `if (__DEV__) { … }` of `biometricStoreOf`, and the function ends with `return null`.
    const text = source('live-auth-provider.tsx');
    const start = text.indexOf('function biometricStoreOf(');
    const body = text.slice(start, text.indexOf('\n}\n', start));
    const gate = body.indexOf('if (__DEV__) {');
    const load = body.indexOf("require('./live-biometric')");
    const close = body.lastIndexOf('\n  }\n');
    expect(gate).toBeGreaterThan(0);
    expect(load).toBeGreaterThan(gate);
    expect(load).toBeLessThan(close);
    expect(body.slice(close).trim()).toBe('}\n  return null;'.trim());
  });

  it('the Live source, the typed client and `expo-device` are loaded by no file that is part of every bundle', () => {
    for (const name of production.filter((file) => file !== TOKEN_STORE)) {
      const text = source(name);
      const loads = text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => /from '(?:@dems\/shared\/live\/source|@dems\/shared\/client|expo-device)'/.test(line) && !line.startsWith('import type '));
      expect({ name, loads }).toEqual({ name, loads: [] });
    }
    expect(linesNaming(TOKEN_STORE, "from 'expo-device'")).toHaveLength(1);
  });
});

describe('where the layer may keep anything (MP-2, SR-16)', () => {
  it('AsyncStorage is named by the simulated binding alone (`auth-prefs.ts`): no LIVE file imports it', () => {
    const importers = production.filter((name) => /from '@react-native-async-storage\/async-storage'/.test(source(name)));
    expect(importers).toEqual(['auth-prefs.ts']);
    // And the LIVE provider does not go through the simulated binding.
    for (const name of ['live-auth-provider.tsx', 'live-auth-model.ts', TOKEN_STORE, 'auth-notice.tsx', 'auth-session.tsx']) {
      expect({ name, prefs: /from '\.\/auth-prefs'/.test(source(name)) }).toEqual({ name, prefs: false });
    }
  });
});

describe('the copy (`features.auth.*`)', () => {
  beforeEach(() => resetMissingKeys());

  const leaves = (tree: object, prefix: string): [string, string][] =>
    Object.entries(tree).flatMap(([key, value]) => (typeof value === 'string' ? [[`${prefix}.${key}`, value] as [string, string]] : leaves(value as object, `${prefix}.${key}`)));
  const copy = leaves(authEn, AUTH_I18N_PREFIX);

  it('holds the sentences of the specification, word for word', () => {
    expect(authEn.notice.tokenReuse).toBe('Biometric sign-in was turned off on this tablet because its token was used a second time. Sign in with your password.');
    expect(authEn.notice.biometricInvalid).toBe('Biometric sign-in is no longer valid on this tablet. Sign in with your password to enable it again.');
    expect(authEn.notice.userDisabled).toBe('This account was disabled by an administrator.');
    expect(authEn.notice.absoluteExpired).toBe('Your session reached its 8-hour limit. Sign in again.');
    expect(authEn.biometric.screenLockNote).toBe("Biometric sign-in asks for this device's screen-lock check.");
    expect(authEn.biometric.passwordSessionRequired).toBe('Sign in with your password to change biometric sign-in.');
  });

  it('resolves through the app`s i18n instance, and registering it twice changes nothing', () => {
    registerAuthResources();
    expect(copy.length).toBe(7);
    for (const [key, text] of copy) expect(i18n.t(key)).toBe(text);
    expect(getMissingKeys()).toEqual([]);
  });

  it('adds no layer to the resource registry: its three layers and their top-level keys are as they were', () => {
    const resources = buildEnResources() as { features: Record<string, unknown> };
    expect(resources.features).not.toHaveProperty('auth');
    expect(i18n.t('mobile.biometric.identityNote')).toBe('Simulated identity binding');
  });

  it('no sentence says or implies that the token is protected by the device`s hardware, and none speaks of a simulation (MB-6a, AC-C-105)', () => {
    const claims = /hardware|keystore|secure (?:enclave|element|chip)|protected by|encrypted|simulat/i;
    for (const [key, text] of copy) expect({ key, claims: claims.test(text) }).toEqual({ key, claims: false });
    expect(claims.test('Protected by the device hardware')).toBe(true);
  });
});
