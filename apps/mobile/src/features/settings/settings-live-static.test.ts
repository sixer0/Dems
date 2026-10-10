// Backend task W82, static tests over the production files of `features/settings/` (client gate CLG item
// (c), AC-C-53; gateway_check/09_cp_mobile_runtime §4 answer 3, rules 1 to 9; gateway_check/09b §8 with
// its follow-up F.10; 04_client_integration_spec §3.2, §3.3, §8.6 S2-7, §9.3 MB-6a). The model is W79's
// `features/storage/storage-live-static.test.ts`.
//
//  1. No production file takes the Core's actions from the simulator: no `useSimActions`, and no
//     `.actions` read on a `Sim`. The commands come from `useCoreActions()` and go through `settle`; a
//     Live rejection is handed to the presenter first.
//  2. The pending control is the runtime's: `usePendingPress`, `busyState` and `PendingSpinner` from
//     `@/runtime`, never a copy; the mode dialog holds while busy.
//  3. The folder names no network API, no Core server address, no secure-store package, no Live
//     source module, and no new timer or wall clock (rules 3, 4 and 7).
//  4. One LIVE idiom (rule 5): `useCoreLink().source === 'LIVE'`.
//  5. The copy (rule 8): the LIVE text says nothing about a simulation, no `SIM-GAP` marker was added or
//     removed, and the copy of Simulated mode is unchanged (the LIVE copy is additive).
//
// The texts this file looks for are put together below, so that it does not hold them itself.
import { describe, expect, it } from '@jest/globals';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { enMobile } from '@/i18n/en.mobile';
import { settingsEn } from './i18n';

const FOLDER = __dirname;
const isTest = (path: string): boolean => /\.test\.tsx?$/.test(path) || /(?:^|\/)(?:testing|__tests__)\//.test(path);
/** Code without its comments. */
const code = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(?<!:)\/\/.*$/gm, '');

function sourceFiles(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

const raw = sourceFiles(FOLDER)
  .map((path) => ({ name: relative(FOLDER, path).split(sep).join('/'), source: readFileSync(path, 'utf8') }))
  .sort((a, b) => a.name.localeCompare(b.name));
const production = raw.filter((file) => !isTest(file.name)).map((file) => ({ name: file.name, text: code(file.source) }));
const matching = (pattern: RegExp): string[] => production.filter((file) => pattern.test(file.text)).map((file) => file.name);
const fileText = (name: string): string => production.find((file) => file.name === name)!.text;

const SIM_ACTIONS_HOOK = ['use', 'Sim', 'Actions'].join('');
/** Text inside quotes is no code: `t('common.actions.cancel')` names a translation, not a simulator. */
const unquoted = (text: string): string => text.replace(/'[^'\n]*'|"[^"\n]*"|`[^`\n]*`/g, "''");

function leaves(tree: unknown, path: string[] = []): { key: string; text: string }[] {
  if (typeof tree === 'string') return [{ key: path.join('.'), text: tree }];
  if (typeof tree !== 'object' || tree === null) return [];
  return Object.entries(tree).flatMap(([name, value]) => leaves(value, [...path, name]));
}
const digest = (list: unknown): string => createHash('sha256').update(JSON.stringify(list)).digest('hex');
const SIMULAT = new RegExp(['simul', 'at'].join(''), 'i');

describe('Settings takes the Core through the light Live API (CLG c, AC-C-53)', () => {
  it('reads the folder: every production file, sub-folders included (one new file: the mode switch)', () => {
    expect(production.map((file) => file.name)).toEqual([
      'about-section.tsx',
      'core-link-switch.tsx',
      'i18n.ts',
      'maintenance-section.tsx',
      'notifications-section.tsx',
      'preferences-section.tsx',
      'profile-sheet.tsx',
      'section-body.tsx',
      'security-section.tsx',
      'settings-controls.tsx',
      'settings-list.tsx',
      'settings-model.ts',
      'settings-prefs.ts',
      'settings-screen.tsx',
      'settings-section-screen.tsx',
      'sheet-frame.tsx',
      'use-sheet-presence.tsx',
    ]);
  });

  it("no production file calls the simulator's action hook", () => {
    expect(new RegExp(`\\b${SIM_ACTIONS_HOOK}\\b`).test(`const actions = ${SIM_ACTIONS_HOOK}();`)).toBe(true);
    expect(matching(new RegExp(`\\b${SIM_ACTIONS_HOOK}\\b`))).toEqual([]);
  });

  it('no production file reads `.actions` of a `Sim` (translation keys in quotes are no reads)', () => {
    expect([...unquoted('sim.actions.signIn()').matchAll(/[\w.$\])]*\.actions\b/g)]).toHaveLength(1);
    // `styles.actions` is a StyleSheet key of step 88 (the button row), not a simulator.
    const reads = production.flatMap((file) =>
      [...unquoted(file.text).matchAll(/[\w.$\])]*\.actions\b/g)].filter((match) => match[0] !== 'styles.actions').map((match) => `${file.name}: ${match[0]}`),
    );
    expect(reads).toEqual([]);
  });

  it('S2-7: every command is `useCoreActions` through `settle`, the presenter first in LIVE; the sheet, the toasts and the chip in `ok`', () => {
    const maintenance = fileText('maintenance-section.tsx');
    expect(maintenance).toMatch(/settle\(command, \{/);
    expect(maintenance).toMatch(/if \(live && presentCoreError\(error\)\) \{/);
    expect(unquoted(maintenance).match(/\bactions\.\w+/g)?.sort()).toEqual(
      ['actions.clearFault', 'actions.clearFault', 'actions.inject', 'actions.loadScenario', 'actions.recover', 'actions.resetClip', 'actions.runDiagnostics', 'actions.startSoftwareUpdate'].sort(),
    );
    expect(maintenance).toMatch(/ok: \(\) => setOpen\(true\),\n\s*done: release,/);
    expect(maintenance).toMatch(/ok: \(\) => \{\n\s*setScenario\(name\);/);
    expect(matching(/\buseCoreActions\(\)/)).toEqual(['core-link-switch.tsx', 'maintenance-section.tsx']);
    expect(matching(/\bsettle\(/)).toEqual(['core-link-switch.tsx', 'maintenance-section.tsx']);
  });

  it('§3.3: the switch signs out through the Core action and stores the source in `done`; nothing here navigates', () => {
    const swap = fileText('core-link-switch.tsx');
    expect(swap).toMatch(/settle\(\(\) => actions\.signOut\('USER'\), \{/);
    expect(swap).toMatch(/done: \(\) => \{\n\s*release\(\);\n\s*setTarget\(null\);\n[^\n]*\n\s*setCoreLinkSource\(next\);/);
    expect(swap).toMatch(/if \(!crossesLiveBoundary\(source, next\)\) \{\n\s*core\.setSource\(next\);/);
    expect(matching(/\brouter\.(?:push|replace|navigate)\b|useRouter\(/).filter((name) => name === 'core-link-switch.tsx' || name === 'preferences-section.tsx')).toEqual([]);
    expect(fileText('preferences-section.tsx')).toMatch(/onChange=\{core\.request\}/);
  });
});

describe('the pending control is the runtime\'s (09b §8, F.10; LB-1, S3-1)', () => {
  it('`usePendingPress`, `busyState` and `PendingSpinner` come from `@/runtime`; the folder holds no copy', () => {
    expect(matching(/function usePendingPress\b|LIVE_PENDING_REVEAL_MS|function busyState\b|function PendingSpinner\b/)).toEqual([]);
    expect(matching(/\busePendingPress\(\)/)).toEqual(['core-link-switch.tsx', 'maintenance-section.tsx']);
    for (const name of ['core-link-switch.tsx', 'maintenance-section.tsx']) {
      const text = fileText(name);
      expect(text).toMatch(/import \{[^}]*\bPendingSpinner\b[^}]*\bbusyState\b[^}]*\busePendingPress\b[^}]*\} from '@\/runtime';/s);
    }
  });

  it('the mode dialog holds while the sign-out is out: Cancel disabled, a dismissal ignored, the confirm busy with the spinner late', () => {
    const swap = fileText('core-link-switch.tsx');
    expect(swap).toMatch(/onOpenChange=\{\(open\) => \(open \|\| busy \? undefined : onCancel\(\)\)\}/);
    expect(swap).toMatch(/testID="settings-core-mode-cancel" \{\.\.\.\(busy \? \{ isDisabled: true \} : \{\}\)\}/);
    expect(swap).toMatch(/\{\.\.\.busyState\(busy\)\}/);
    expect(swap).toMatch(/\{pending \? <PendingSpinner [^>]*testID="settings-core-mode-confirm-spinner" \/> : null\}/);
    // Pin moved by delta (wave H closing pass Z2, G70-04): the control that takes the busy state carries its label.
    expect(swap).toMatch(/<Button variant="primary" onPress=\{onConfirm\} testID="settings-core-mode-confirm" accessibilityLabel=\{.+?\} \{\.\.\.busyState\(busy\)\}>/);
  });
});

describe('what belongs to the runtime stays there (rules 3, 4, 7 and 9)', () => {
  it('the folder names no network API, no Core server address, no secure-store package, no Live source module', () => {
    const forbidden: Record<string, RegExp> = {
      'a raw request': new RegExp(`(?<![.\\w$'"\`/-])${['fe', 'tch'].join('')}\\s*\\(`),
      'a socket constructor': new RegExp(`\\bnew\\s+${['Web', 'Socket'].join('')}\\b`),
      'the Core server address': new RegExp(`\\b${['CORE', 'SERVER'].join('_')}_\\w+|(?<![\\w.])${['44', '2'].join('')}[0-9](?!\\w)`),
      'the secure-store package or its wrapper': new RegExp(`${['expo', 'secure', 'store'].join('-')}|${['secure', 'credentials'].join('-')}`),
      'the Live source or the typed client': new RegExp(`@dems/shared/(?:live/source|live/testing|client)|${['create', 'Live', 'Sim'].join('')}|${['create', 'Core', 'Client'].join('')}`),
      'a second Live handle': new RegExp(`\\b${['use', 'Mobile', 'Live'].join('')}\\b|\\b${['mobile', 'Live', 'Of'].join('')}\\b`),
    };
    for (const [what, pattern] of Object.entries(forbidden)) expect({ what, files: matching(pattern) }).toEqual({ what, files: [] });
  });

  it('timers and storage: only the two step-88 files that had them (the preference store, the sheet presence); no new one', () => {
    expect(matching(new RegExp(['Async', 'Storage'].join('')))).toEqual(['settings-prefs.ts']);
    expect(matching(/\bset(?:Timeout|Interval)\s*\(|\bDate\.now\s*\(|\bnew Date\s*\(/)).toEqual(['use-sheet-presence.tsx']);
  });

  it('one LIVE idiom (rule 5): every file that picks the LIVE wording reads `useCoreLink().source === \'LIVE\'`', () => {
    const idiom = /useCoreLink\(\)\.source === 'LIVE'/;
    expect(matching(idiom)).toEqual(['core-link-switch.tsx', 'maintenance-section.tsx', 'security-section.tsx', 'settings-screen.tsx']);
    // No second way to ask "is this LIVE" (the data-mode hooks, the Live handle, the stored preference).
    expect(matching(/\buseCoreMode\b|\bcoreModeOf\b|\buseLive\(|\buseLiveLink\b|\bgetCoreLinkSource\b|\buseCoreLinkSource\(/)).toEqual([]);
  });
});

describe('the copy (rule 8; §3.2; MB-6a (3))', () => {
  const live = leaves(settingsEn.live, ['live']);

  it('the LIVE copy says nothing about a simulation, and the biometric LIVE note claims no hardware protection', () => {
    expect(live.length).toBe(7);
    for (const { key, text } of live) expect({ key, simulated: SIMULAT.test(text) }).toEqual({ key, simulated: false });
    expect(SIMULAT.test(settingsEn.preferences.coreLinkHintLive)).toBe(false);
    const note = enMobile.mobile.biometric.identityNoteLiveProtected;
    expect(/hardware|keystore|secure (?:enclave|element|chip)|protected by|encrypted|simulat/i.test(note)).toBe(false);
    // The simulated binding keeps its words (the auth layer's static test pins it too).
    expect(enMobile.mobile.biometric.identityNote).toBe(['Simulated', 'identity', 'binding'].join(' '));
  });

  it('the copy of Simulated mode is unchanged: the step-88 leaves, byte for byte (the LIVE leaves are additive)', () => {
    const simulated = leaves(settingsEn).filter(({ key }) => !key.startsWith('live.') && !key.startsWith('preferences.coreLinkHintLive'));
    expect(simulated.length).toBe(78);
    // The digest of the 78 leaves of `i18n.ts` at acaff20 (computed from `git show acaff20:…` when this row was written).
    expect(digest(simulated)).toBe('a69eda8e35446aa036a0c1a02838f5485e76b7943fec626ee52692d2bc839d8a');
  });

  it('no SIM-GAP marker was added or removed (KI-07): the two of step 88, as at acaff20', () => {
    const marker = new RegExp(`${['SIM', 'GAP'].join('-')}-M\\d+-\\d+`, 'g');
    const found = raw.filter((file) => !isTest(file.name)).flatMap((file) => file.source.match(marker) ?? []);
    expect(found).toEqual([`${['SIM', 'GAP'].join('-')}-M88-1`, `${['SIM', 'GAP'].join('-')}-M88-1`]);
  });

  it('SIMULATED keeps the former description of the biometric switch; LIVE words it from the view', () => {
    const security = fileText('security-section.tsx');
    expect(security).toMatch(/const description = !live \? `\$\{status\} \$\{t\(biometric\.noteKey\)\}\.` : biometric\.changeBlocked \? t\(biometric\.noteKey\) : `\$\{status\} \$\{t\(biometric\.noteKey\)\}`;/);
    expect(security).toMatch(/live \? \{ changeBlocked: session\.biometric\.changeBlocked, protected: session\.biometric\.protected \} : undefined/);
  });
});
