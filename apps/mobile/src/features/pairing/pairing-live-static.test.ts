// Backend task W57, static tests over the production files of `features/pairing/` and over the
// folder's copy (client gate CLG item (c), AC-C-53; 04_client_integration_spec §3.2; decision D124).
//
//  1. No production file of the folder takes the Core's actions from the simulator: no
//     `useSimActions`, and no `.actions` read on a `Sim`. The actions come from `useCoreActions()`
//     and are consumed through `settle`, in both data modes.
//  2. The folder names no network API, no Core server address and no storage package: the Live
//     source, the typed client and the secure-store wrapper belong to the runtime.
//  3. The copy of LIVE mode never says "simulated" (the rule of §3.2: a screen that says
//     "simulated" shows simulator data). The one exception is the control that switches to the
//     simulator, which has to name it.
//  4. The copy of Simulated mode is what it was: the keys this row found are all still there, with
//     their texts.
//
// The texts this file looks for are put together below, so that it does not hold them itself.
import { describe, expect, it } from '@jest/globals';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pairingEn } from './i18n';

const FOLDER = __dirname;
const isTest = (name: string): boolean => /\.test\.tsx?$/.test(name);
/** Code without its comments. */
const code = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(?<!:)\/\/.*$/gm, '');
const production = readdirSync(FOLDER)
  .filter((name) => /\.tsx?$/.test(name) && !isTest(name))
  .sort()
  .map((name) => ({ name, text: code(readFileSync(join(FOLDER, name), 'utf8')) }));
const matching = (pattern: RegExp): string[] => production.filter((file) => pattern.test(file.text)).map((file) => file.name);

const SIM_ACTIONS_HOOK = ['use', 'Sim', 'Actions'].join('');
const ACTIONS_READ = new RegExp(`\\.${['act', 'ions'].join('')}\\b`);

function leaves(tree: unknown, path: string[] = []): { key: string; text: string }[] {
  if (typeof tree === 'string') return [{ key: path.join('.'), text: tree }];
  if (typeof tree !== 'object' || tree === null) return [];
  return Object.entries(tree).flatMap(([name, value]) => leaves(value, [...path, name]));
}

describe('the pairing folder takes the Core through the light Live API (CLG c, AC-C-53)', () => {
  it('reads the whole folder', () => {
    expect(production.map((file) => file.name)).toEqual([
      'i18n.ts',
      'pairing-code-panel.tsx',
      'pairing-connection.tsx',
      'pairing-live-model.ts',
      'pairing-model.ts',
      'pairing-screen.tsx',
      'unpair-dialog.tsx',
      'use-dialog-presence.ts',
      'use-pairing-flow.ts',
    ]);
  });

  it('the matchers find what they look for, and nothing else', () => {
    expect(new RegExp(`\\b${SIM_ACTIONS_HOOK}\\b`).test(`const actions = ${SIM_ACTIONS_HOOK}();`)).toBe(true);
    expect(ACTIONS_READ.test('sim.actions.pair(code)')).toBe(true);
    expect(ACTIONS_READ.test('test.sim.actions')).toBe(true);
    expect(ACTIONS_READ.test('const actions = useCoreActions();')).toBe(false);
    expect(ACTIONS_READ.test('settle(() => actions.pair(code), handlers)')).toBe(false);
    expect(ACTIONS_READ.test('<View style={styles.actions}>')).toBe(true);
  });

  it('no production file calls the simulator\'s action hook', () => {
    expect(matching(new RegExp(`\\b${SIM_ACTIONS_HOOK}\\b`))).toEqual([]);
  });

  it('no production file reads `.actions` of a `Sim`: the only `.actions` in the folder is a style of two cards', () => {
    // Text inside quotes is no code: `t('common.actions.retry')` names a translation, not a simulator.
    const unquoted = (text: string): string => text.replace(/'[^'\n]*'|"[^"\n]*"/g, "''");
    const reads = production.flatMap((file) => [...unquoted(file.text).matchAll(/[\w.$\])]*\.actions\b/g)].map((match) => `${file.name}: ${match[0]}`));
    expect([...new Set(reads)]).toEqual(['pairing-code-panel.tsx: styles.actions', 'unpair-dialog.tsx: styles.actions']);
  });

  it('the flow hook takes the actions from `useCoreActions` and consumes them through `settle`', () => {
    const flow = production.find((file) => file.name === 'use-pairing-flow.ts')!.text;
    expect(flow).toMatch(/const actions = useCoreActions\(\);/);
    expect(flow.match(/settle\(\(\) => actions\.(pair|unpair)\(/g)).toEqual(['settle(() => actions.pair(', 'settle(() => actions.unpair(']);
    // Nothing else of the actions object is called, and no result is read as a value.
    expect(flow.match(/\bactions\.\w+/g)).toEqual(['actions.pair', 'actions.unpair']);
  });
});

describe('what belongs to the runtime stays there', () => {
  it('the folder names no network API, no Core server address, no storage package and no Live source module', () => {
    const forbidden: Record<string, RegExp> = {
      'a raw request': new RegExp(`(?<![.\\w$'"\`/-])${['fe', 'tch'].join('')}\\s*\\(`),
      'a socket constructor': new RegExp(`\\bnew\\s+${['Web', 'Socket'].join('')}\\b`),
      'the Core server address': new RegExp(`\\b${['CORE', 'SERVER'].join('_')}_\\w+|(?<![\\w.])${['44', '20'].join('')}(?!\\w)`),
      'the secure-store package or its wrapper': new RegExp(`${['expo', 'secure', 'store'].join('-')}|${['secure', 'credentials'].join('-')}`),
      'AsyncStorage': new RegExp(['Async', 'Storage'].join('')),
      'the Live source or the typed client': new RegExp(`@dems/shared/(?:live/source|client)|${['create', 'Live', 'Sim'].join('')}|${['create', 'Core', 'Client'].join('')}`),
      'an operation of the registry by its ID': new RegExp(`['"\`](?:${['redeem', 'Pairing', 'Code'].join('')}|${['unpair', 'Device'].join('')}|${['rotate', 'Device', 'Credential'].join('')})['"\`]`),
    };
    for (const [what, pattern] of Object.entries(forbidden)) expect([what, matching(pattern)]).toEqual([what, []]);
  });
});

describe('the copy (§3.2, decision D124)', () => {
  const live = leaves(pairingEn.live, ['live']);
  const simulated = leaves(pairingEn).filter((leaf) => !leaf.key.startsWith('live.'));

  it('LIVE mode never says "simulated", "demo" or "mock"; the one control that names the simulator is the switch to it', () => {
    expect(live.length).toBeGreaterThan(40);
    const naming = live.filter((leaf) => /simulat|demo\b|mock/i.test(leaf.text)).map((leaf) => leaf.key);
    expect(naming).toEqual(['live.code.useSimulated']);
    expect(pairingEn.live.code.useSimulated).toBe('Use Simulated mode');
  });

  it('LIVE mode names no Core by a fixed name and shows no code: an identity comes from the Core, a code from a supervisor', () => {
    for (const leaf of live) {
      expect([leaf.key, /DEMS-IR|Interview Room|\d{6}/.test(leaf.text)]).toEqual([leaf.key, false]);
    }
  });

  it('a refused code is never explained (SR-29): no text of LIVE mode says expired, used, cancelled or closed', () => {
    const explaining = live.filter((leaf) => /expired|already used|cancell?ed|closed|wrong code|invalid code/i.test(leaf.text)).map((leaf) => leaf.key);
    expect(explaining).toEqual([]);
  });

  it('the copy of Simulated mode is as it was at `acaff20`: 51 texts, every key and every text (one digest)', () => {
    expect(simulated).toHaveLength(51);
    // The digest of the same list built from `git show acaff20:apps/mobile/src/features/pairing/i18n.ts`.
    expect(createHash('sha256').update(JSON.stringify(simulated)).digest('hex')).toBe('08f1738549caecf950c67c42a8ad1088ffc050e4ce65dd9e8a72ecbdd6a84546');
    expect(pairingEn.header.subtitle).toBe('Certificate-bound control link to the Core (book §20.1), simulated in this demo.');
    expect(pairingEn.connection.status.idle).toBe('Ready to pair with {{device}}.');
    expect(pairingEn.connection.status.paired).toBe('Paired with {{device}}. The control link is certificate-bound (simulated).');
    expect(pairingEn.code.description).toBe('Enter the 6-digit pairing code issued by the Core.');
    expect(pairingEn.unpair.body).toBe('The tablet will no longer be bound to {{device}}. You can pair it again with a new code. The action is written to the audit log.');
  });
});
