// Static guards of the alerts module (plan row W40; standing rules M2 to M5, M8 and M14 of
// decisions D83 and D87; row rule 3). They read the production sources of `src/modules/alerts/`
// as text, with the scaffold's scanner, and keep these rules true for every later row that
// touches the folder:
//
//   1. No clock, no timer, nothing of the host: every instant in an answer is the engine's.
//   2. Who may call is stage 6's: no role, permission, session or device is read; no denial row,
//      no refusal and no hook is written here. The principal is handed on to the hosted action,
//      and its operator ID is read in ONE place: the function that builds the log line of SR-82.
//   3. One state: the engine, through the seam. No unit of work of its own, no table, no audit
//      path, no simulator action called directly, nothing published. The module raises no alert
//      and writes no audit row for one.
//   4. ONE log call in the folder: the line of an acknowledgement, written only when the alert
//      became acknowledged, after the unit committed, from the fields the line builder returns.
//   5. Routes come from the registry: two, each built from its registry entry.
//
// The patterns and their positive controls are in `../../system/__tests__/static-rules.ts`.
import { describe, expect, it } from 'vitest';
import { MODULE_RULES, itHoldsNone } from '../../../../test/static/module-rules';
import { SCAN_COVERS, scanCoverage } from '../../../../test/static/scan';
import * as rules from '../../system/__tests__/static-rules';

const FOLDER = 'src/modules/alerts/';
const { all, code } = rules.moduleSources(FOLDER);
const index = rules.codeOf(code, 'index.ts');
const acknowledgement = rules.codeOf(code, 'acknowledge.ts');

describe('the scan itself', () => {
  it('reads the production sources of the folder', () => {
    expect(scanCoverage(all, [FOLDER])).toEqual(SCAN_COVERS);
    expect(code.every((file) => file.text.length > 100)).toBe(true);
  });

  it('every pattern finds each of its planted texts (positive control)', () => {
    expect(rules.plantedMisses()).toEqual([]);
  });
});

describe('rule 1: no clock, no timer, nothing of the host', () => {
  itHoldsNone(MODULE_RULES.noTimeAtAll, rules, code);

  itHoldsNone(MODULE_RULES.noHostConsoleRandom, rules, code);

  it('the imports of the folder are the contract, a type of the shared simulator, Fastify\'s types, zod, the guard\'s route helper, the type of a principal and its own file', () => {
    expect(rules.importSources(code)).toEqual(['../../plugins/authenticate', '../../plugins/permission-guard', './acknowledge', '@dems/shared/api', '@dems/shared/sim', 'fastify', 'fastify-type-provider-zod', 'zod']);
    const typeOnly = code.flatMap((file) => [...file.text.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s+from\s+'(@dems\/shared\/sim|\.\.\/\.\.\/plugins\/authenticate)'/g)].map((match) => `${match[1] === undefined ? '' : 'type '}${match[2]?.trim()} from ${match[3]}`));
    expect(typeOnly).toEqual(['type SimAlert from @dems/shared/sim', 'type Principal from ../../plugins/authenticate']);
    // Nothing of the system module, the other folder of the same row: the two modules share no production code.
    expect(rules.importSources(code).some((source) => source.includes('system'))).toBe(false);
  });
});

describe('rule 2 (M3): who may call is stage 6, only', () => {
  itHoldsNone(MODULE_RULES.noAccessCheck, rules, code);

  it('no file writes a denial row, builds a refusal, takes a place in the denial budget, adds a hook or catches an error', () => {
    expect(rules.places(code, rules.DENIAL)).toEqual([]);
    expect(rules.places(code, rules.HOOK)).toEqual([]);
    expect(rules.places(code, rules.CATCH)).toEqual([]);
    // Both `throw`s are for a registry entry that is missing or has no path parameter at load time: a defect, not a request's refusal.
    expect(rules.captures(code, /\bthrow\s+new\s+(\w+)/g)).toEqual(['Error', 'Error']);
  });

  it('the principal of the request is named once: held for the unit of operation 70', () => {
    expect(rules.count(code, rules.PRINCIPAL)).toBe(1);
    expect(rules.count(code, rules.PRINCIPAL_AS_CALLER)).toBe(1);
    expect(rules.count(code, rules.PRINCIPAL_TO_COMMAND)).toBe(0);
  });

  it('what is held goes to two places and no further: the hosted action, and the builder of the log line', () => {
    expect(rules.count([{ path: 'index.ts', text: index }], rules.CALLER)).toBe(3);
    expect(index).toMatch(/await scope\.command\(caller, ACKNOWLEDGE_ACTION, alertId\);/);
    expect(index).toMatch(/acknowledgementLine\(caller, alertId\)/);
  });

  it('the operator ID is read in ONE place, for the log line, and nothing is decided by it', () => {
    expect(rules.places(code, rules.OPERATOR_ID)).toHaveLength(1);
    expect(rules.places(code, rules.OPERATOR_KIND)).toHaveLength(1);
    expect(rules.places(code, rules.OPERATOR_ID)[0]).toMatch(/^src\/modules\/alerts\/acknowledge\.ts:/);
    expect(acknowledgement).toMatch(/return \{ operatorId: caller\.kind === 'OPERATOR' \? caller\.operatorId : null, alertId \};/);
    // No branch on the caller anywhere: the only conditionals are two load-time checks and "did the alert become acknowledged".
    expect(rules.captures(code, /\bif\s*\(([^)]*)\)/g)).toEqual(['operation === undefined', 'operation.pathParam === undefined', 'acknowledged']);
  });
});

describe('rule 3 (M4, M5): one state, through the seam', () => {
  it('no unit of work of its own, no table, no statement, no audit writer, no publication: the module raises no alert and writes no row for one', () => {
    expect(rules.places(code, rules.OWN_STORAGE)).toEqual([]);
    expect(code.some((file) => /FAULT_RAISED|\binject\b|\bclearFault\b/.test(file.text))).toBe(false);
  });

  it('of the engine it uses `slice` for the read and `run` for the command: nothing else', () => {
    expect(rules.captures(code, rules.ENGINE_USE)).toEqual(['slice', 'run']);
    expect(index).toMatch(/\(\{ alerts: app\.engine\.slice\('alerts'\) \}\)/);
    expect(rules.places(code, rules.ENGINE_BYPASS)).toEqual([]);
  });

  it('inside the unit: the pending alerts, ONE hosted action, the pending alerts again; the unit\'s own writers are not touched', () => {
    expect(rules.captures(code, rules.SCOPE_USE)).toEqual(['pending', 'command', 'pending']);
    const order = ['const before = scope.pending().alerts;', 'await scope.command(caller, ACKNOWLEDGE_ACTION, alertId);', 'return becameAcknowledged(before, scope.pending().alerts, alertId);'].map((text) => index.indexOf(text));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(index).toMatch(/export const ACKNOWLEDGE_ACTION = 'acknowledgeAlert';/);
  });

  it('the command answers 204 after the unit; the two headers of API-7 are the engine unit\'s, and the handler sets neither', () => {
    const order = ['await app.engine.run(ACKNOWLEDGE_UNIT_LABEL,', 'return reply.code(204).send();'].map((text) => index.indexOf(text));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    // One hook of `src/engine/api-headers.ts` sets them for every POST that reached its handler (decision D87).
    expect(index).not.toMatch(/_HEADER_NAME\b|\.header\s*\(/);
  });

  itHoldsNone(MODULE_RULES.noSlotReplaced, rules, code);
});

describe('rule 4 (SR-82, M14): the one log line', () => {
  it('the folder has ONE log call: level info, on the request\'s logger, with the fields of the line builder and the fixed message', () => {
    expect(rules.places(code, rules.LOG_CALL)).toHaveLength(1);
    expect(rules.places(code, rules.LOG_OTHER)).toEqual([]);
    expect(index).toMatch(/if \(acknowledged\) request\.log\.info\(acknowledgementLine\(caller, alertId\), ALERT_ACKNOWLEDGED_MESSAGE\);/);
  });

  it('it is written after the unit resolved (the commit) and before the answer', () => {
    const order = ['await app.engine.run(ACKNOWLEDGE_UNIT_LABEL,', 'request.log.info(', '.code(204).send()'].map((text) => index.indexOf(text));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('the line holds two fields: the caller\'s operator ID and the validated `{id}` of the path; nothing of the alert itself', () => {
    expect(acknowledgement).toMatch(/export function acknowledgementLine\(caller: Principal, alertId: string\): AcknowledgementLine \{/);
    expect(acknowledgement.match(/readonly operatorId: string \| null;\s*readonly alertId: string;/)).not.toBeNull();
    expect(index).toMatch(/const alertId = request\.params\.id;/);
    // The alert's own members are read for one decision only: is the alert of that ID acknowledged.
    expect(rules.captures([{ path: 'acknowledge.ts', text: acknowledgement }], /\balert\s*\.\s*([a-zA-Z]+)/g)).toEqual(['id', 'acknowledged']);
  });

  itHoldsNone(MODULE_RULES.noErrorMember, rules, code);
});

describe('rule 5 (M2): routes come from the registry', () => {
  it('two routes, each spread from its registry entry, in registry order; no method shorthand and no literal path', () => {
    expect(rules.count(code, rules.ROUTE_CALL)).toBe(2);
    expect(rules.captures(code, rules.ROUTE_FROM_REGISTRY)).toEqual(['listAlerts', 'acknowledgeAlert']);
    expect(rules.places(code, rules.ROUTE_SHORTHAND)).toEqual([]);
    expect(rules.places(code, rules.LITERAL_PATH)).toEqual([]);
  });

  it('the `{id}` is held to the pattern of the registry entry, not to one written here', () => {
    expect(index).toMatch(/z\.object\(\{ id: z\.string\(\)\.regex\(operation\.pathParam\.pattern\) \}\)/);
    expect(code.some((file) => /ALR-|\\d\{/.test(file.text))).toBe(false);
  });

  it('the plugin keeps the name the frozen app factory imports', () => {
    expect(index).toMatch(/export const alertsModule: FastifyPluginAsync = async \(app\) => \{/);
  });

  it('of a request it reads the principal, the validated `{id}` and the logger: nothing else', () => {
    expect(rules.captures(code, rules.REQUEST_DATA)).toEqual(['principal', 'params', 'log']);
    // The read takes no request at all.
    expect(index.match(/handler: async \(\): Promise</g)).toHaveLength(1);
  });
});
