// Static guards of the system module (plan row W40; standing rules M2 to M5, M8 and M14 of
// decisions D83 and D87; row rule 3). They read the production sources of `src/modules/system/`
// as text, with the scaffold's scanner, and keep these rules true for every later row that
// touches the folder:
//
//   1. No clock, no timer, nothing of the host: every instant in an answer is the engine's.
//   2. Who may call is stage 6's: no role, permission, session or device is read; no denial row,
//      no refusal and no hook is written here. The principal is handed on to the hosted action,
//      and its operator ID is read in ONE place: the function that builds the log line of SR-82.
//   3. One state: the engine, through the seam. No unit of work of its own, no table, no audit
//      path, no simulator action called directly, nothing published.
//   4. ONE log call in the folder: the line of a settings change, written only when a setting
//      changed, after the unit committed, from the fields the line builder returns. The request
//      body is never near it.
//   5. Routes come from the registry: five, each built from its registry entry.
//
// The patterns and their positive controls are in `static-rules.ts`.
import { describe, expect, it } from 'vitest';
import * as rules from './static-rules';

const FOLDER = 'src/modules/system/';
const { all, code } = rules.moduleSources(FOLDER);
const index = rules.codeOf(code, 'index.ts');
const settings = rules.codeOf(code, 'settings.ts');

describe('the scan itself', () => {
  it('reads the production sources of the folder', () => {
    expect(all.map((file) => file.path)).toEqual(['src/modules/system/index.ts', 'src/modules/system/operations.ts', 'src/modules/system/settings.ts', 'src/modules/system/status.ts']);
    expect(code.every((file) => file.text.length > 100)).toBe(true);
  });

  it('every pattern finds each of its planted texts (positive control)', () => {
    expect(rules.plantedMisses()).toEqual([]);
    expect(rules.PLANTED.length).toBeGreaterThanOrEqual(30);
  });
});

describe('rule 1: no clock, no timer, nothing of the host', () => {
  it('no file reads the system time, sets a timer or reads a clock at all: the engine stamps what is stamped', () => {
    expect(rules.places(code, rules.SYSTEM_TIME)).toEqual([]);
    expect(rules.places(code, rules.TIMER)).toEqual([]);
    expect(rules.places(code, rules.ANY_CLOCK)).toEqual([]);
  });

  it('no file imports a module of the runtime, names the process or the network, uses the console or a random source', () => {
    expect(rules.places(code, rules.HOST_MODULE)).toEqual([]);
    expect(rules.places(code, rules.HOST_STATE)).toEqual([]);
    expect(rules.places(code, rules.CONSOLE)).toEqual([]);
    expect(rules.places(code, rules.RANDOM)).toEqual([]);
  });

  it('the imports of the folder are the contract, types of the shared simulator, Fastify\'s types, the guard\'s route helper, the type of a principal and its own files', () => {
    expect(rules.importSources(code)).toEqual([
      '../../plugins/authenticate',
      '../../plugins/permission-guard',
      './operations',
      './settings',
      './status',
      '@dems/shared/api',
      '@dems/shared/sim',
      'fastify',
      'fastify-type-provider-zod',
    ]);
    // From the simulator and from stage 4: types only. No action, no transition, no function.
    const typeOnly = code.flatMap((file) => [...file.text.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s+from\s+'(@dems\/shared\/sim|\.\.\/\.\.\/plugins\/authenticate)'/g)].map((match) => `${match[1] === undefined ? '' : 'type '}${match[2]?.trim()} from ${match[3]}`));
    expect(typeOnly).toEqual(['type SettingsSlice from @dems/shared/sim', 'type Principal from ../../plugins/authenticate', 'type SimState from @dems/shared/sim']);
  });
});

describe('rule 2 (M3): who may call is stage 6, only', () => {
  it('no file reads a role, a permission, a session or a device, or names a caller that is no operator', () => {
    expect(rules.places(code, rules.ACCESS_CHECK)).toEqual([]);
  });

  it('no file writes a denial row, builds a refusal, takes a place in the denial budget, adds a hook or catches an error', () => {
    expect(rules.places(code, rules.DENIAL)).toEqual([]);
    expect(rules.places(code, rules.HOOK)).toEqual([]);
    expect(rules.places(code, rules.CATCH)).toEqual([]);
    // The one `throw` is for a registry entry that is missing at load time: a defect, not a request's refusal.
    expect(rules.captures(code, /\bthrow\s+new\s+(\w+)/g)).toEqual(['Error']);
  });

  it('the principal of the request is named four times: handed on, as it is, to the three plain commands, and held once for the unit of operation 68', () => {
    expect(rules.count(code, rules.PRINCIPAL)).toBe(4);
    expect(rules.count(code, rules.PRINCIPAL_TO_COMMAND)).toBe(3);
    expect(rules.count(code, rules.PRINCIPAL_AS_CALLER)).toBe(1);
    expect(rules.places(code, rules.PRINCIPAL).every((place) => place.startsWith('src/modules/system/index.ts:'))).toBe(true);
  });

  it('what is held goes to two places and no further: the hosted action, and the builder of the log line', () => {
    expect(rules.count([{ path: 'index.ts', text: index }], rules.CALLER)).toBe(3);
    expect(index).toMatch(/const caller = request\.principal;/);
    expect(index).toMatch(/await scope\.command\(caller, SYSTEM_ACTION_OF_OPERATION\.updateSettings, patch\);/);
    expect(index).toMatch(/settingsChangeLine\(caller, changedKeys\)/);
  });

  it('the operator ID is read in ONE place, for the log line, and nothing is decided by it', () => {
    expect(rules.places(code, rules.OPERATOR_ID)).toHaveLength(1);
    expect(rules.places(code, rules.OPERATOR_KIND)).toHaveLength(1);
    expect(rules.places(code, rules.OPERATOR_ID)[0]).toMatch(/^src\/modules\/system\/settings\.ts:/);
    expect(settings).toMatch(/return \{ operatorId: caller\.kind === 'OPERATOR' \? caller\.operatorId : null, changedKeys \};/);
    // No branch on the caller anywhere: the only conditional of the folder that is not a patch member is "did a setting change".
    expect(rules.captures(code, /\bif\s*\(([^)]*)\)/g)).toEqual([
      'changedKeys.length > 0',
      'operation === undefined',
      'body.presentationMode !== undefined',
      'body.timeFormat !== undefined',
      'body.notifyWarnings !== undefined',
      'body.notifySound !== undefined',
    ]);
  });
});

describe('rule 3 (M4, M5): one state, through the seam', () => {
  it('no unit of work of its own, no table, no statement, no audit writer, no publication', () => {
    expect(rules.places(code, rules.OWN_STORAGE)).toEqual([]);
  });

  it('of the engine it uses `state` for the read, `command` for the three plain commands, and `run` then `slice` for operation 68: nothing else', () => {
    expect(rules.captures(code, rules.ENGINE_USE)).toEqual(['state', 'command', 'command', 'command', 'run', 'slice']);
    expect(rules.places(code, rules.ENGINE_BYPASS)).toEqual([]);
  });

  it('inside the unit of operation 68: the pending settings, ONE hosted action, the pending settings again; the unit\'s own writers are not touched', () => {
    expect(rules.captures(code, rules.SCOPE_USE)).toEqual(['pending', 'command', 'pending']);
    const order = ['const before = scope.pending().settings;', 'await scope.command(caller, SYSTEM_ACTION_OF_OPERATION.updateSettings, patch);', 'return changedSettingsKeys(before, scope.pending().settings);'].map((text) => index.indexOf(text));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('each plain command awaits its hosted action and answers from its outcome; operation 68 answers the committed slice, read after the unit', () => {
    expect(index.match(/await app\.engine\.command\(request\.principal, SYSTEM_ACTION_OF_OPERATION\.(runDiagnostics|restartServices|startSoftwareUpdate)\)/g)).toHaveLength(3);
    const order = ['await app.engine.run(SETTINGS_UNIT_LABEL,', "return app.engine.slice('settings');"].map((text) => index.indexOf(text));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    // The two headers of API-7 are the engine unit's (`src/engine/api-headers.ts`, decision D87): no handler sets either.
    expect(index).not.toMatch(/_HEADER_NAME\b|\.header\s*\(/);
  });

  it('no slot of the scaffold is provided or replaced, and no test file is imported', () => {
    expect(rules.places(code, rules.SLOT_REPLACED)).toEqual([]);
    expect(rules.places(code, rules.TEST_IMPORT)).toEqual([]);
  });
});

describe('rule 4 (SR-82, M14): the one log line', () => {
  it('the folder has ONE log call: level info, on the request\'s logger, with the fields of the line builder and the fixed message', () => {
    expect(rules.places(code, rules.LOG_CALL)).toHaveLength(1);
    expect(rules.places(code, rules.LOG_OTHER)).toEqual([]);
    expect(index).toMatch(/if \(changedKeys\.length > 0\) request\.log\.info\(settingsChangeLine\(caller, changedKeys\), SETTINGS_CHANGED_MESSAGE\);/);
  });

  it('it is written after the unit resolved (the commit) and before the committed slice is read', () => {
    const order = ['await app.engine.run(SETTINGS_UNIT_LABEL,', 'request.log.info(', "app.engine.slice('settings')"].map((text) => index.indexOf(text));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('the line holds two fields, both built from what the unit returned and from the caller: never the body, the patch or a slice', () => {
    expect(settings).toMatch(/export function settingsChangeLine\(caller: Principal, changedKeys: readonly string\[\]\): SettingsChangeLine \{/);
    expect(settings.match(/readonly operatorId: string \| null;\s*readonly changedKeys: readonly string\[\];/)).not.toBeNull();
    // The body is read once, as the argument of the patch builder; the patch goes to the hosted action only.
    expect(index.match(/request\.body/g)).toHaveLength(1);
    expect(index).toMatch(/const patch = settingsPatchOf\(request\.body\);/);
    expect(index.match(/\bpatch\b/g)).toHaveLength(2);
    // The names come from the slice before and after, never from the body.
    expect(settings).toMatch(/\(Object\.keys\(after\) as Array<keyof SettingsSlice>\)\.filter\(\(key\) => before\[key\] !== after\[key\]\)\.sort\(\)/);
  });

  it('no object of the folder holds a member under which an error would be logged (M14)', () => {
    expect(rules.places(code, rules.ERROR_MEMBER)).toEqual([]);
  });
});

describe('rule 5 (M2): routes come from the registry', () => {
  it('five routes, each spread from its registry entry, in registry order; no method shorthand and no literal path', () => {
    expect(rules.count(code, rules.ROUTE_CALL)).toBe(5);
    expect(rules.captures(code, rules.ROUTE_FROM_REGISTRY)).toEqual(['getSystemStatus', 'runDiagnostics', 'restartServices', 'startSoftwareUpdate', 'updateSettings']);
    expect(rules.places(code, rules.ROUTE_SHORTHAND)).toEqual([]);
    expect(rules.places(code, rules.LITERAL_PATH)).toEqual([]);
  });

  it('the plugin keeps the name the frozen app factory imports', () => {
    expect(index).toMatch(/export const systemModule: FastifyPluginAsync = async \(app\) => \{/);
  });

  it('of a request it reads the principal, the validated body and the logger: nothing else', () => {
    expect(rules.captures(code, rules.REQUEST_DATA)).toEqual(['principal', 'principal', 'principal', 'principal', 'body', 'log']);
    // The read takes no request at all.
    expect(index.match(/handler: async \(\): Promise</g)).toHaveLength(1);
  });
});
