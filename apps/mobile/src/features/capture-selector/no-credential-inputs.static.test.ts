// Task 3 row 138 — static guard over the production sources of the mobile app (ux spec §8d.1, §8d.10;
// decision D80(3); check M4-CONN-PTR-T / -P "0 password fields in the view tree; 0 calls of 95 / 96 /
// 89", static half). A camera user name and password are entered on the web console ONLY.
//
//  1. No feature folder holds a password field. The one exception is `features/login`: the operator's
//     own sign-in, which is no camera credential and existed before this task.
//  2. The folders of flows 9-13 (`capture-selector`, `devices`) hold no text-entry component at all:
//     a search has no address, subnet, port or filter field, and there is no connect form.
//  3. No production file of the app names one of the three web-console-only operations (the
//     connection test, the adoption, the camera credential write) or one of their paths.
//
// The texts this file looks for are put together below, so that it does not hold them itself.
import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SRC = join(__dirname, '..', '..');
const FEATURES = join(SRC, 'features');
const isTest = (path: string): boolean => /\.test\.tsx?$/.test(path) || /(?:^|\/)(?:testing|__tests__)\//.test(path);
/** Code without its comments: a comment may say what is NOT built. */
const code = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(?<!:)\/\/.*$/gm, '');

function sourceFiles(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

const production = sourceFiles(SRC)
  .map((path) => ({ name: relative(SRC, path).split(sep).join('/'), text: code(readFileSync(path, 'utf8')) }))
  .filter((file) => !isTest(file.name));
const matching = (pattern: RegExp, files = production): string[] => files.filter((file) => pattern.test(file.text)).map((file) => file.name);
const inFolders = (...folders: string[]) => production.filter((file) => folders.some((folder) => file.name.startsWith(`features/${folder}/`)));

/** Every way this kit and React Native mark a field as a secret one. */
const SECRET_FIELD = new RegExp(
  [
    ['secure', 'Text', 'Entry'].join(''),
    `textContentType\\s*=\\s*["'{]+\\s*["']?(?:new)?${['Pass', 'word'].join('')}`,
    `autoComplete\\s*=\\s*["'{]+\\s*["']?(?:current-|new-)?${['pass', 'word'].join('')}`,
    `type\\s*=\\s*["']${['pass', 'word'].join('')}["']`,
    `keyboardType\\s*=\\s*["']visible-${['pass', 'word'].join('')}["']`,
  ].join('|'),
);
const TEXT_ENTRY = /\b(?:TextField|TextInput|TextArea|InputGroup|InputOTP|SearchField)\b|<Input\b/;
const WEB_ONLY_OPERATIONS = new RegExp(
  [['test', 'CaptureCandidate', 'Connection'].join(''), ['adopt', 'CaptureCandidate'].join(''), ['setCaptureDevice', 'Credential'].join(''), `discovery/${'candidates'}`, `/${'credential'}\\b`].join('|'),
);

describe('no camera credential can be typed on the tablet or the phone (D80(3))', () => {
  it('reads the app: the feature folders exist and the flows 9-13 folders are in the list', () => {
    const folders = readdirSync(FEATURES).filter((name) => statSync(join(FEATURES, name)).isDirectory());
    expect(folders).toEqual(expect.arrayContaining(['capture-selector', 'devices', 'session-new', 'settings', 'login']));
    expect(inFolders('capture-selector').length).toBeGreaterThanOrEqual(10);
    expect(production.length).toBeGreaterThan(200);
  });

  it('the patterns can match (negative control): a field of each kind is found in a sample', () => {
    const secret = ['secure', 'Text', 'Entry'].join('');
    expect(SECRET_FIELD.test(`<TextField ${secret} />`)).toBe(true);
    expect(SECRET_FIELD.test(`<Input type="${['pass', 'word'].join('')}" />`)).toBe(true);
    expect(SECRET_FIELD.test(`<Input autoComplete="current-${['pass', 'word'].join('')}" />`)).toBe(true);
    expect(TEXT_ENTRY.test('<TextField><Input /></TextField>')).toBe(true);
    expect(WEB_ONLY_OPERATIONS.test(`client.call('${['adopt', 'CaptureCandidate'].join('')}')`)).toBe(true);
    expect(WEB_ONLY_OPERATIONS.test(`'/api/v1/capture/devices/CAM-01/${'credential'}'`)).toBe(true);
    // The operator's sign-in is where the app's one secret field lives, so the scan does see such a field.
    expect(matching(SECRET_FIELD).filter((name) => name.startsWith('features/login/')).length).toBeGreaterThanOrEqual(1);
  });

  it('0 password fields in every feature folder but the operator sign-in', () => {
    const features = production.filter((file) => file.name.startsWith('features/') && !file.name.startsWith('features/login/'));
    expect(matching(SECRET_FIELD, features)).toEqual([]);
  });

  it('0 text-entry components in the folders of flows 9-13: no address or filter field, no connect form', () => {
    expect(matching(TEXT_ENTRY, inFolders('capture-selector', 'devices'))).toEqual([]);
  });

  it('0 production files name the connection test, the adoption or the camera credential write, or their paths', () => {
    expect(matching(WEB_ONLY_OPERATIONS)).toEqual([]);
  });

  it('the discovery port has exactly the three operations a device session may call', () => {
    const port = production.find((file) => file.name === 'features/capture-selector/capture-discovery-port.ts')!.text;
    expect([...new Set(port.match(/'(?:start|get|rescan)Capture\w+'/g))].sort()).toEqual(["'getCaptureDiscovery'", "'rescanCaptureInputs'", "'startCaptureDiscovery'"]);
    expect(port.match(/client\.call\(/g)).toHaveLength(1);
  });
});
