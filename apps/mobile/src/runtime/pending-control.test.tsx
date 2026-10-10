// Row M1 follow-up (decision D164): one `busyState` and one in-button spinner for every pending control
// (04_client_integration_spec §8.1 LB-1; AC-C-57, AC-C-58), beside `usePendingPress` in the runtime.
// Start Session (row W67) and Devices (row W78) each had their own copy; both now take these.
//
//  1. `busyState`: `busy: false` stated while idle (wave H closing pass Z2, G70-04: Android takes the
//     busy word back only from a state that holds the key), the busy state with the control's disabled
//     flag while the command is out.
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
  // DELIBERATE PIN CHANGE (wave H closing pass Z2; gate 70 finding G70-04, the app-wide cause). This case
  // asked for NO prop while idle. React Native on Android rewrites a view's content description - where
  // ", busy" is appended - only when the new accessibility state HOLDS the key `busy`, so a control that
  // went from `{ busy: true }` back to nothing kept announcing "busy". An idle control now says so.
  it('idle: `busy: false` is STATED, so Android takes the busy word back; `disabled` only when the caller gave it', () => {
    expect(busyState(false)).toEqual({ accessibilityState: { busy: false } });
    expect(busyState(false, true)).toEqual({ accessibilityState: { busy: false, disabled: true } });
    expect(busyState(false, false)).toEqual({ accessibilityState: { busy: false, disabled: false } });
    // The key is there, with the value false - never absent.
    expect(Object.prototype.hasOwnProperty.call(busyState(false).accessibilityState, 'busy')).toBe(true);
    // Not given: the kit's own `disabled` (from `isDisabled`) is not overwritten by a guess.
    expect('disabled' in busyState(false).accessibilityState).toBe(false);
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

// ── Wave H closing pass Z2 (G70-04): the state needs a label to attach to ────────────────────

/**
 * Android appends the state words ("busy") to the view's OWN content description and leaves a view
 * without one alone: a button that had no `accessibilityLabel` read only "busy" while its command
 * was out, and kept the word afterwards, because the rewrite with `busy: false` is skipped when
 * there is nothing to write. So every control of the app that takes the busy state carries a label.
 * Static: read from the sources of every screen (the evidence folders included - read only).
 */
describe('every control that takes the busy state carries an accessibilityLabel (G70-04)', () => {
  const SRC = join(__dirname, '..');
  const all = sourceFiles(SRC)
    .map((path) => ({ name: relative(SRC, path).split(sep).join('/'), source: readFileSync(path, 'utf8') }))
    .filter((file) => !isTest(file.name) && file.name !== 'runtime/pending-control.tsx')
    .map((file) => ({ ...file, text: code(file.source) }));
  /** The JSX opening tags that spread the busy state (`{...busyState(`) or merge it into `accessibilityState={{`. */
  function tagsOf(text: string): string[] {
    const tags: string[] = [];
    const use = /\{\s*\.\.\.(?:busyState|settledBusyState|controlState)\(|accessibilityState=\{\{[^}]*busyState\(/g;
    for (let match = use.exec(text); match !== null; match = use.exec(text)) {
      const opens = [...text.slice(0, match.index).matchAll(/<[A-Z][A-Za-z.]*\b/g)];
      const start = opens.at(-1)?.index ?? 0;
      const rest = text.slice(match.index);
      const end = rest.search(/>\s*\n/);
      tags.push(text.slice(start, match.index + (end === -1 ? rest.length : end + 1)));
    }
    return tags;
  }

  it('the matcher finds a tag and reads its props (control)', () => {
    const tags = tagsOf('<View>\n  <Button testID="a" onPress={go} {...busyState(busy)}>\n    <Button.Label>Go</Button.Label>\n  </Button>\n</View>');
    expect(tags).toHaveLength(1);
    expect(tags[0]).toContain('testID="a"');
    expect(tags[0]).not.toContain('accessibilityLabel');
    expect(tagsOf('<Button\n  accessibilityLabel={x}\n  {...busyState(busy)}\n>\n')[0]).toContain('accessibilityLabel');
  });

  it('no control spreads the busy state without a label', () => {
    const unlabelled = all.flatMap((file) =>
      tagsOf(file.text)
        .filter((tag) => !/\baccessibilityLabel=/.test(tag))
        .map((tag) => `${file.name}: ${/testID=(?:"([^"]+)"|\{`([^`]+)`\})/.exec(tag)?.slice(1).find(Boolean) ?? tag.slice(0, 40)}`),
    );
    expect(unlabelled).toEqual([]);
    // The scan does see the controls (26 at the time of writing; the floor guards against a blind matcher).
    expect(all.flatMap((file) => tagsOf(file.text)).length).toBeGreaterThanOrEqual(20);
  });
});
