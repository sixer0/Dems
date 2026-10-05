// Static guard: the shape of the scaffold (plan row W08; P25; decision record ADQ-8).
//
// The app factory imports every unit statically and registers it by name; there is no autoload
// and no dynamic import. A later row replaces a unit's `index.ts` and must keep the export the
// factory imports. This test names what breaks when one of them is renamed or dropped, before
// the type checker does.
import { describe, expect, it } from 'vitest';
import { WORKSPACE, codeOnly, occurrences, readTree } from './scan';

/** Folder under `src/`, the export `app.ts` imports from it, and the plan row that owns it. */
const UNITS: ReadonlyArray<readonly [folder: string, exportName: string, row: string]> = [
  ['plugins/origin-guard', 'originGuardPlugin', 'W23'],
  ['plugins/throttle', 'throttlePlugin', 'W23'],
  ['plugins/authenticate', 'authenticatePlugin', 'W24'],
  ['plugins/permission-guard', 'permissionGuardPlugin', 'W28'],
  ['core', 'corePlugin', 'W21'],
  ['engine', 'enginePlugin', 'W26'],
  ['realtime', 'realtimePlugin', 'W42'],
  ['modules/identity', 'identityModule', 'W24'],
  ['modules/rbac', 'rbacModule', 'W28'],
  ['modules/admin', 'adminModule', 'W33'],
  ['modules/pairing', 'pairingModule', 'W32'],
  ['modules/sessions', 'sessionsModule', 'W34'],
  ['modules/evidence', 'evidenceModule', 'W35'],
  ['modules/devices', 'devicesModule', 'W36'],
  ['modules/storage', 'storageModule', 'W37'],
  ['modules/network-time', 'networkTimeModule', 'W37'],
  ['modules/security-audit', 'securityAuditModule', 'W39'],
  ['modules/system', 'systemModule', 'W40'],
  ['modules/alerts', 'alertsModule', 'W40'],
  ['modules/demo', 'demoModule', 'W43'],
  ['modules/health', 'healthModule', 'W08'],
];

/** The plugins of the scaffold itself, which `app.ts` imports as well. */
const OWN_PLUGINS = ['config', 'logger', 'error-envelope', 'response-headers', 'db', 'readiness'];

const files = readTree(WORKSPACE);
const text = (path: string): string => files.find((file) => file.path === path)?.text ?? '';
const factory = codeOnly([{ path: 'src/app.ts', text: text('src/app.ts') }]);

describe('the units of the scaffold', () => {
  it('are four stage plugins, core, engine, realtime, thirteen stubbed modules and health', () => {
    expect(UNITS).toHaveLength(21);
    expect(UNITS.filter(([folder]) => folder.startsWith('plugins/'))).toHaveLength(4);
    expect(UNITS.filter(([folder]) => folder.startsWith('modules/'))).toHaveLength(14);
  });

  it.each(UNITS)('src/%s/index.ts exports %s (owner %s)', (folder, exportName) => {
    const source = text(`src/${folder}/index.ts`);
    expect(source, `src/${folder}/index.ts is missing`).not.toBe('');
    expect(source).toMatch(new RegExp(`export const ${exportName}\\b`));
  });

  it.each(UNITS)('app.ts imports src/%s statically and registers %s', (folder, exportName) => {
    const source = factory[0]?.text ?? '';
    expect(source).toMatch(new RegExp(`import \\{[^}]*\\b${exportName}\\b[^}]*\\} from '\\./${folder}';`));
    expect(source).toMatch(new RegExp(`\\['${folder}', ${exportName}\\]`));
  });

  it.each(OWN_PLUGINS)('src/plugins/%s has an index.ts', (name) => {
    expect(text(`src/plugins/${name}/index.ts`)).not.toBe('');
  });

  it('the factory loads nothing dynamically', () => {
    expect(occurrences(factory, /\bimport\s*\(/g)).toEqual([]);
    expect(occurrences(factory, /\brequire\s*\(/g)).toEqual([]);
    expect(occurrences(factory, /autoload/gi)).toEqual([]);
  });

  it('the factory does not listen and reads no environment', () => {
    expect(occurrences(factory, /\.listen\s*\(/g)).toEqual([]);
    expect(occurrences(factory, /\bprocess\s*\.\s*env\b/g)).toEqual([]);
  });
});
