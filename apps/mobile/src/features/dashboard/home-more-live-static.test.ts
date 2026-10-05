// Backend task W66, static tests over the production files of `features/dashboard/` and
// `features/more/` (client gate CLG item (c), AC-C-53; gateway_check/09_cp_mobile_runtime §4 answer 3,
// rules 1, 3, 4, 5 and 8; 04_client_integration_spec §3.2). The model is `pairing-live-static.test.ts`.
//
//  1. No production file takes the Core's actions from the simulator: no `useSimActions`, and no
//     `.actions` read on a `Sim`. Home's one call (acknowledge an alert) comes from `useCoreActions()`
//     and goes through `settle`.
//  2. The folders name no network API, no Core server address, no storage package, no Live source
//     module: those belong to the runtime (rules 3 and 4).
//  3. One LIVE idiom (rule 5): a file that picks a LIVE wording reads `useCoreLink().source`; nothing
//     re-derives the mode from a preference or the data-mode hook.
//  4. The copy (rule 8): the LIVE text says nothing about a simulation, no `SIM-GAP` marker was added,
//     and the copy of Simulated mode is what it was at `acaff20`.
//
// The texts this file looks for are put together below, so that it does not hold them itself.
import { describe, expect, it } from '@jest/globals';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { moreEn } from '../more/i18n';
import { dashboardEn } from './i18n';

const FEATURES = join(__dirname, '..');
const FOLDERS = ['dashboard', 'more'] as const;
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

const raw = FOLDERS.flatMap((folder) => sourceFiles(join(FEATURES, folder)))
  .map((path) => ({ name: relative(FEATURES, path).split(sep).join('/'), source: readFileSync(path, 'utf8') }))
  .filter((file) => !isTest(file.name))
  .sort((a, b) => a.name.localeCompare(b.name));
const production = raw.map((file) => ({ name: file.name, text: code(file.source) }));
const matching = (pattern: RegExp): string[] => production.filter((file) => pattern.test(file.text)).map((file) => file.name);
const fileText = (name: string): string => production.find((file) => file.name === name)!.text;

const SIM_ACTIONS_HOOK = ['use', 'Sim', 'Actions'].join('');
/** Text inside quotes is no code: `t('common.actions.retry')` names a translation, not a simulator. */
const unquoted = (text: string): string => text.replace(/'[^'\n]*'|"[^"\n]*"|`[^`\n]*`/g, "''");

function leaves(tree: unknown, path: string[] = []): { key: string; text: string }[] {
  if (typeof tree === 'string') return [{ key: path.join('.'), text: tree }];
  if (typeof tree !== 'object' || tree === null) return [];
  return Object.entries(tree).flatMap(([name, value]) => leaves(value, [...path, name]));
}
const digest = (list: unknown): string => createHash('sha256').update(JSON.stringify(list)).digest('hex');

describe('Home and More take the Core through the light Live API (CLG c, AC-C-53)', () => {
  it('reads both folders: every production file, sub-folders included', () => {
    expect(production.map((file) => file.name)).toEqual([
      'dashboard/dashboard-screen.tsx',
      'dashboard/device-tiles.tsx',
      'dashboard/home-header.tsx',
      'dashboard/home-model.ts',
      'dashboard/home-motion.ts',
      'dashboard/i18n.ts',
      'dashboard/panel-boundary.tsx',
      'dashboard/quick-actions.tsx',
      'dashboard/recent-sessions.tsx',
      'dashboard/status-chip-row.tsx',
      'dashboard/status-tiles.tsx',
      'dashboard/system-status-card.tsx',
      'dashboard/use-held-value.ts',
      'dashboard/use-home-data.ts',
      'more/console-tiles.tsx',
      'more/i18n.ts',
      'more/more-boundary.tsx',
      'more/more-links.tsx',
      'more/more-model.ts',
      'more/more-screen.tsx',
      'more/operator-card.tsx',
      'more/use-core-link-chip.ts',
      'more/use-more-navigate.ts',
    ]);
  });

  it('no production file calls the simulator\'s action hook', () => {
    expect(new RegExp(`\\b${SIM_ACTIONS_HOOK}\\b`).test(`const actions = ${SIM_ACTIONS_HOOK}();`)).toBe(true);
    expect(matching(new RegExp(`\\b${SIM_ACTIONS_HOOK}\\b`))).toEqual([]);
  });

  it('no production file reads `.actions` of a `Sim`: every `.actions` left is a style or a motion beat', () => {
    const reads = production.flatMap((file) => [...unquoted(file.text).matchAll(/[\w.$\])]*\.actions\b/g)].map((match) => `${file.name}: ${match[0]}`));
    expect([...new Set(reads)]).toEqual([
      'dashboard/home-header.tsx: styles.actions',
      'dashboard/quick-actions.tsx: HOME_BEATS.actions',
      'more/operator-card.tsx: styles.actions',
    ]);
  });

  it('Home\'s one Core call: `useCoreActions`, through `settle`, its rejection handed to the presenter first', () => {
    const header = fileText('dashboard/home-header.tsx');
    expect(header).toMatch(/const actions = useCoreActions\(\);/);
    expect(unquoted(header).match(/\bactions\.\w+/g)).toEqual(['actions.acknowledgeAlert']);
    expect(header).toMatch(/settle\(\(\) => actions\.acknowledgeAlert\(id\), \{/);
    expect(header).toMatch(/if \(presentCoreError\(error\)\) return;/);
    // No other file of the two folders takes the actions at all.
    expect(matching(/\buseCoreActions\b/)).toEqual(['dashboard/home-header.tsx']);
  });
});

describe('what belongs to the runtime stays there (rules 3 and 4)', () => {
  it('the folders name no network API, no Core server address, no storage package and no Live source module', () => {
    const forbidden: Record<string, RegExp> = {
      'a raw request': new RegExp(`(?<![.\\w$'"\`/-])${['fe', 'tch'].join('')}\\s*\\(`),
      'a socket constructor': new RegExp(`\\bnew\\s+${['Web', 'Socket'].join('')}\\b`),
      'the Core server address': new RegExp(`\\b${['CORE', 'SERVER'].join('_')}_\\w+|(?<![\\w.])${['44', '2'].join('')}[0-9](?!\\w)`),
      'the secure-store package or its wrapper': new RegExp(`${['expo', 'secure', 'store'].join('-')}|${['secure', 'credentials'].join('-')}`),
      'AsyncStorage': new RegExp(['Async', 'Storage'].join('')),
      'the Live source or the typed client': new RegExp(`@dems/shared/(?:live/source|client)|${['create', 'Live', 'Sim'].join('')}|${['create', 'Core', 'Client'].join('')}`),
    };
    for (const [what, pattern] of Object.entries(forbidden)) expect([what, matching(pattern)]).toEqual([what, []]);
    // Through the barrel only (rule 9). The one older import is step 77's pure route helper `resyncTarget`
    // (`home-model.ts`, unchanged since `acaff20`), which carries nothing of the Live surface.
    expect(matching(/from '@\/runtime\/[^']+'/)).toEqual(['dashboard/home-model.ts']);
    expect(fileText('dashboard/home-model.ts').match(/from '@\/runtime\/[^']+'/g)).toEqual(["from '@/runtime/route-sync'"]);
  });
});

describe('one LIVE idiom (rule 5)', () => {
  it('the LIVE wording is picked from `useCoreLink().source`, never from a preference or the data-mode hook', () => {
    expect(matching(/\b(?:useCoreMode|getCoreLinkSource|useCoreLinkSource|useCoreLinkSourceSetting|coreLinkSource)\b/)).toEqual([]);
    expect(matching(/useCoreLink\(\)\.source === 'LIVE'/)).toEqual(['dashboard/home-header.tsx', 'dashboard/recent-sessions.tsx']);
    expect(fileText('more/use-core-link-chip.ts')).toMatch(/live: link\.source === 'LIVE'/);
    // The chip's LIVE "Offline" is the runtime's rule (rows M0, M1) in one call (row M2): no ref, no effect, no timer.
    const chip = fileText('more/use-core-link-chip.ts');
    expect(chip).toMatch(/const \{ offline \} = useCoreLinkNotice\(\);/);
    expect(chip).not.toMatch(/\buse(?:Ref|Effect|LayoutEffect)\b|setTimeout|setInterval|Date\.now/);
  });
});

describe('the copy (rule 8; §3.2)', () => {
  it('the text LIVE mode adds says nothing about a simulation; the one it replaces did', () => {
    expect(moreEn.footer.liveNote).toBe('Data from the Core server');
    expect(/simulat|demo\b|mock/i.test(moreEn.footer.liveNote)).toBe(false);
    expect(/simulat/i.test(moreEn.footer.demoNote)).toBe(true);
  });

  it('no `SIM-GAP` marker in either folder (KI-07 stays 13 IDs / 62 markers); the one contract gap is marked for W83', () => {
    const marker = ['SIM', 'GAP'].join('-');
    expect(raw.filter((file) => file.source.includes(marker)).map((file) => file.name)).toEqual([]);
    const gap = ['CONTRACT', 'GAP', 'W66', '1'].join('-');
    expect(raw.filter((file) => file.source.includes(gap)).map((file) => file.name)).toEqual(['dashboard/recent-sessions.tsx']);
  });

  it('the copy of Simulated mode is as it was at `acaff20`: Home 79 texts, More 43 texts plus the one LIVE note (one digest each)', () => {
    // The digests of the same lists built from `git show acaff20:apps/mobile/src/features/{dashboard,more}/i18n.ts`.
    const home = leaves(dashboardEn);
    expect(home).toHaveLength(79);
    expect(digest(home)).toBe('500fccbf255276c7fae9d57a7fa71d933c4eead624719321bfd6d639d0386611');
    const more = leaves(moreEn).filter((leaf) => leaf.key !== 'footer.liveNote');
    expect(more).toHaveLength(43);
    expect(digest(more)).toBe('54af2d74bf4cab3ac91a9e5a61fb88bb9f14b7b85ae0760c3e1bf42779b275e1');
    expect(dashboardEn.header.coreLink).toBe('Core {{state}}');
    expect(moreEn.footer.coreLinkLabel).toBe('Core link: {{state}} ({{source}})');
  });
});
