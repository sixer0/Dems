// Row M1 follow-up (decision D164): one `busyState` and one in-button spinner for every pending control
// (04_client_integration_spec §8.1 LB-1; AC-C-57, AC-C-58), beside `usePendingPress` in the runtime.
// Start Session (row W67) and Devices (row W78) each had their own copy; both now take these.
//
//  1. `busyState`: nothing while idle (a control in Simulated mode gets no new prop), the busy state
//     with the control's disabled flag while the command is out.
//  2. `PendingSpinner`: the kit's own `Spinner`, size `sm`, with the colour and test ID it is given and
//     the kit's default colour when none is given.
//  3. One helper in the app: the barrel and Devices' former file hand out this function; neither
//     caller folder defines a copy or writes the busy state or the in-button spinner inline.
import { describe, expect, it } from '@jest/globals';
import { Spinner } from 'heroui-native';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { isValidElement, type ReactElement } from 'react';
import { palette } from '@dems/shared/tokens';
import { busyState as devicesBusyState } from '@/features/devices/busy-state';
import { PendingSpinner as BarrelPendingSpinner, busyState as barrelBusyState } from '@/runtime';
import { PendingSpinner, busyState } from './pending-control';

describe('busyState (LB-1: "the control is marked busy")', () => {
  it('idle: no prop at all, so an idle control keeps exactly the props it had', () => {
    expect(busyState(false)).toEqual({});
    expect(busyState(false, true)).toEqual({});
    expect('accessibilityState' in busyState(false)).toBe(false);
  });

  it('busy: the busy state, with the control\'s disabled flag (false unless given)', () => {
    expect(busyState(true)).toEqual({ accessibilityState: { busy: true, disabled: false } });
    expect(busyState(true, true)).toEqual({ accessibilityState: { busy: true, disabled: true } });
    expect(busyState(true, false)).toEqual({ accessibilityState: { busy: true, disabled: false } });
  });
});

describe('PendingSpinner (LB-1: the kit\'s pending state inside the control, nothing moves)', () => {
  const element = (node: ReturnType<typeof PendingSpinner>): ReactElement<Record<string, unknown>> => {
    expect(isValidElement(node)).toBe(true);
    return node as ReactElement<Record<string, unknown>>;
  };

  it('is the kit\'s Spinner, size sm, with the colour and test ID it is given', () => {
    const spinner = element(PendingSpinner({ color: palette.gold, testID: 'x-spinner' }));
    expect(spinner.type).toBe(Spinner);
    expect(spinner.props).toEqual({ size: 'sm', color: palette.gold, testID: 'x-spinner' });
  });

  it('without a colour it keeps the kit\'s default (no colour prop), and without a test ID none is set', () => {
    const spinner = element(PendingSpinner({}));
    expect(spinner.type).toBe(Spinner);
    expect(spinner.props).toEqual({ size: 'sm' });
  });
});

// ── One helper in the app ────────────────────────────────────────────────────────────────────

const FEATURES = join(__dirname, '..', 'features');
const CALLER_FOLDERS = ['session-new', 'devices'] as const;
const isTest = (path: string): boolean => /\.test\.tsx?$/.test(path) || /(?:^|\/)(?:testing|__tests__)\//.test(path);
const code = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(?<!:)\/\/.*$/gm, '');
function sourceFiles(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}
const production = CALLER_FOLDERS.flatMap((folder) => sourceFiles(join(FEATURES, folder)))
  .map((path) => ({ name: relative(FEATURES, path).split(sep).join('/'), source: readFileSync(path, 'utf8') }))
  .filter((file) => !isTest(file.name))
  .map((file) => ({ ...file, text: code(file.source) }));
const matching = (pattern: RegExp): string[] => production.filter((file) => pattern.test(file.text)).map((file) => file.name).sort();

describe('one helper in the app (row M1 follow-up)', () => {
  it('the barrel and Devices\' former file hand out this very function', () => {
    expect(barrelBusyState).toBe(busyState);
    expect(devicesBusyState).toBe(busyState);
    expect(BarrelPendingSpinner).toBe(PendingSpinner);
  });

  it('the former files are one-line re-exports of the runtime', () => {
    for (const name of ['devices/busy-state.ts', 'devices/use-pending-press.ts', 'session-new/use-pending-press.ts']) {
      const file = production.find((candidate) => candidate.name === name)!;
      expect([name, file.source.trim().split('\n').length]).toEqual([name, 1]);
      expect([name, /^export \{ [^}]+ \} from '@\/runtime';/.test(file.source)]).toEqual([name, true]);
    }
  });

  it('neither caller folder defines its own copy or writes the busy state or the in-button spinner inline', () => {
    const copies = {
      'a busyState of its own': /\bfunction\s+busyState\b|\bconst\s+busyState\s*=/,
      'a PendingSpinner of its own': /\bfunction\s+PendingSpinner\b|\bconst\s+PendingSpinner\s*=/,
      'the busy state written inline': /accessibilityState:\s*\{\s*busy:\s*true/,
      'the kit Spinner behind a pending flag': /[pP]ending\s*\?\s*<Spinner\b/,
    };
    // The matchers find the shapes the two copies had.
    expect(copies['a busyState of its own'].test('function busyState(busy: boolean, disabled: boolean) {')).toBe(true);
    expect(copies['the busy state written inline'].test('{...(retryBusy ? { accessibilityState: { busy: true, disabled: false } } : {})}')).toBe(true);
    expect(copies['the kit Spinner behind a pending flag'].test('{press.pending ? <Spinner size="sm" color={palette.foreground} /> : null}')).toBe(true);
    for (const [what, pattern] of Object.entries(copies)) expect([what, matching(pattern)]).toEqual([what, []]);
  });

  it('every caller takes the helpers from the barrel', () => {
    const users = matching(/\b(?:busyState|PendingSpinner)\b/);
    expect(users).toEqual([
      'devices/busy-state.ts',
      'devices/device-command-dialog.tsx',
      'devices/device-detail.tsx',
      'devices/diagnostics-sheet.tsx',
      'session-new/devices-check-step.tsx',
      'session-new/session-new-screen.tsx',
    ]);
    for (const name of users) {
      const text = production.find((file) => file.name === name)!.text;
      expect([name, /import \{[^}]*\b(?:busyState|PendingSpinner)\b[^}]*\} from '@\/runtime';|export \{ busyState \} from '@\/runtime';/.test(text)]).toEqual([name, true]);
    }
  });
});
