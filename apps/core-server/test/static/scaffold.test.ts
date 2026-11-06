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
  // Task 3 (OD-14 waiver of P25; capture spec §I edits 1 and 5).
  ['capture', 'captureModule', 'task 3 row 57'],
  ['modules/capture-config', 'captureConfigModule', 'task 3 row 52, registered by row 57'],
  // Task 3 M6, blueprint row 113 (R-8; C3 §2.5): operations 90 to 92.
  ['modules/stt-config', 'sttConfigModule', 'task 3 row 113'],
  // Task 3 R-9, R-10 (decision D114: the OD-14 waiver extended): operations 93, 94 and 97.
  ['modules/capture-discovery', 'captureDiscoveryModule', 'task 3 row 132'],
  ['modules/capture-inputs', 'captureInputsModule', 'task 3 row 133'],
  // Task 3 M8, blueprint row 91 (C3 §3): operation 87; the export jobs are `src/evidence-export`.
  ['modules/evidence-export', 'evidenceExportModule', 'task 3 row 91'],
  // Task 3 M8, blueprint row 90 (C3 §2.4; ruling D140): operation 88 and the evidence media route; what they do is `src/media-stream`.
  ['modules/media-stream', 'mediaStreamModule', 'task 3 row 90'],
  // Task 3 integration pass D4 (C3 §2.2; decision D146): operations 84 to 86, the transcript read and its signed revisions.
  ['modules/transcripts', 'transcriptsModule', 'task 3 integration pass D4'],
  // Task 3 M7, blueprint row 82b (C3 §2.2; ruling D147): operation 83 and the mount of the sealing composition `src/sealing-host`.
  ['modules/sealing', 'sealingModule', 'task 3 row 82b'],
];

/** The plugins of the scaffold itself, which `app.ts` imports as well. */
const OWN_PLUGINS = ['config', 'logger', 'error-envelope', 'response-headers', 'db', 'readiness'];

const files = readTree(WORKSPACE);
const text = (path: string): string => files.find((file) => file.path === path)?.text ?? '';
const factory = codeOnly([{ path: 'src/app.ts', text: text('src/app.ts') }]);

describe('the units of the scaffold', () => {
  it('are four stage plugins, core, engine, realtime, thirteen stubbed modules and health, and the two capture units, the STT configuration module and the two modules of the camera search and the local inputs of task 3', () => {
    expect(UNITS).toHaveLength(30);
    expect(UNITS.filter(([folder]) => folder.startsWith('plugins/'))).toHaveLength(4);
    expect(UNITS.filter(([folder]) => folder.startsWith('modules/'))).toHaveLength(22);
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
