// Static guards of the storage module (plan row W37; standing rules M2 to M5 and M8 of decision
// D83; row rule 3). They read the production sources of `src/modules/storage/` as text, with the
// scaffold's scanner, and keep these rules true for every later row that touches the folder:
//
//   1. No clock at all, no timer, nothing of the host: every instant in an answer is the engine's.
//   2. Who may call is stage 6's: no role, permission, session or device is read; no denial row,
//      no refusal and no hook is written here; the principal is only handed on to the hosted command.
//   3. One state: the engine, through the seam. No unit of work, no table, no audit path, no
//      simulator action called directly, nothing published.
//   4. Routes come from the registry: three, each built from its registry entry.
//   5. Of a request only the validated body is read, in one place.
//
// The patterns and their positive controls are in `static-rules.ts`.
import { describe, expect, it } from 'vitest';
import { MODULE_RULES, itHoldsNone } from '../../../../test/static/module-rules';
import { SCAN_COVERS, scanCoverage } from '../../../../test/static/scan';
import * as rules from './static-rules';

const FOLDER = 'src/modules/storage/';
const { all, code } = rules.moduleSources(FOLDER);

describe('the scan itself', () => {
  it('reads the production sources of the folder', () => {
    expect(scanCoverage(all, [FOLDER])).toEqual(SCAN_COVERS);
    expect(code.every((file) => file.text.length > 100)).toBe(true);
  });

  it('every pattern finds each of its planted texts (positive control)', () => {
    expect(rules.plantedMisses()).toEqual([]);
    expect(rules.PLANTED.length).toBeGreaterThanOrEqual(20);
  });
});

describe('rule 1: no clock, no timer, nothing of the host', () => {
  itHoldsNone(MODULE_RULES.noSystemTimeNoTimer, rules, code);

  itHoldsNone(MODULE_RULES.noClockAtAll, rules, code);

  itHoldsNone(MODULE_RULES.noHost, rules, code);

  it('the imports of the folder are the contract, the shared simulator\'s selector and types, Fastify\'s types, the guard\'s route helper and its own files', () => {
    expect(rules.importSources(code)).toEqual([
      '../../plugins/permission-guard',
      './policy',
      './status',
      '@dems/shared/api',
      '@dems/shared/sim',
      'fastify',
      'fastify-type-provider-zod',
    ]);
    // From the simulator: one selector (a pure function) and types. No action, no transition.
    const fromSim = code.flatMap((file) => [...file.text.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s+from\s+'@dems\/shared\/sim'/g)].map((match) => `${match[1] === undefined ? '' : 'type '}${match[2]?.trim()}`));
    expect(fromSim).toEqual(['type StoragePolicy', 'storageSummary, type SimState']);
  });

  itHoldsNone(MODULE_RULES.noConsoleRandomLog, rules, code, 'no console, no environment, no random source, no log line of its own');
});

describe('rule 2 (M3): who may call is stage 6, only', () => {
  itHoldsNone(MODULE_RULES.noAccessCheck, rules, code, 'no file reads a role, a permission, a session, a device or the kind of the caller');

  it('no file writes a denial row, builds a refusal, takes a place in the denial budget or adds a hook', () => {
    expect(rules.places(code, rules.DENIAL)).toEqual([]);
    expect(rules.places(code, rules.HOOK)).toEqual([]);
  });

  it('the principal of the request is named once: handed on, as it is, as the first argument of the hosted command', () => {
    expect(rules.places(code, rules.PRINCIPAL)).toEqual(rules.places(code, rules.PRINCIPAL_HANDED_ON));
    expect(rules.count(code, rules.PRINCIPAL_HANDED_ON)).toBe(1);
  });

  it('no error is caught: what the engine host or the simulator refuses is left to propagate', () => {
    expect(rules.places(code, rules.CATCH)).toEqual([]);
    // The one `throw` is for a registry entry that is missing at load time: a defect, not a request's refusal.
    expect(code.flatMap((file) => [...file.text.matchAll(/\bthrow\s+new\s+(\w+)/g)].map((match) => match[1]))).toEqual(['Error']);
  });
});

describe('rule 3 (M4, M5): one state, through the seam', () => {
  itHoldsNone(MODULE_RULES.noOwnStorage, rules, code);

  it('of the engine it uses `state()` for the reads, and `command` then `slice` for the command: nothing else', () => {
    const used = code.flatMap((file) => [...file.text.matchAll(rules.ENGINE_USE)].map((match) => match[1]));
    expect(used).toEqual(['state', 'state', 'command', 'slice']);
    expect(rules.places(code, rules.ENGINE_BYPASS)).toEqual([]);
  });

  it('the command awaits the hosted action, then answers the committed slice, read after it; the two headers of API-7 are the engine unit\'s, and the handler sets neither', () => {
    const index = code.find((file) => file.path.endsWith('/index.ts'))?.text ?? '';
    const order = ['await app.engine.command(', "return app.engine.slice('storagePolicy');"].map((text) => index.indexOf(text));
    // One hook of `src/engine/api-headers.ts` sets them for every POST that reached its handler (decision D87).
    expect(index).not.toMatch(/_HEADER_NAME\b|\.header\s*\(/);
    expect(order.every((position) => position >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(index).toMatch(/\n\s+await app\.engine\.command\(request\.principal, STORAGE_POLICY_ACTION, policyPatchOf\(request\.body\)\);/);
    expect(index).toMatch(/export const STORAGE_POLICY_ACTION = 'setStoragePolicy';/);
  });

  itHoldsNone(MODULE_RULES.noSlotReplaced, rules, code);
});

describe('rule 4 (M2): routes come from the registry', () => {
  it('three routes, each spread from its registry entry; no method shorthand and no literal path', () => {
    expect(rules.count(code, rules.ROUTE_CALL)).toBe(3);
    const built = code.flatMap((file) => [...file.text.matchAll(rules.ROUTE_FROM_REGISTRY)].map((match) => match[1]));
    expect(built).toEqual(['getStorageStatus', 'getStorageDetail', 'setStoragePolicy']);
    expect(rules.places(code, rules.ROUTE_SHORTHAND)).toEqual([]);
    expect(rules.places(code, rules.LITERAL_PATH)).toEqual([]);
  });

  it('the plugin keeps the name the frozen app factory imports', () => {
    const index = all.find((file) => file.path.endsWith('/index.ts'))?.text ?? '';
    expect(index).toMatch(/export const storageModule: FastifyPluginAsync = async \(app\) => \{/);
  });
});

describe('rule 5: what of a request is read', () => {
  it('the validated body, once, as the argument of the patch builder; the principal, once; nothing else', () => {
    const read = code.flatMap((file) => [...file.text.matchAll(rules.REQUEST_DATA)].map((match) => match[1]));
    expect(read).toEqual(['principal', 'body']);
    expect(code.find((file) => file.path.endsWith('/index.ts'))?.text).toMatch(/policyPatchOf\(request\.body\)/);
    // The two reads take no request at all.
    const index = code.find((file) => file.path.endsWith('/index.ts'))?.text ?? '';
    expect(index.match(/handler: async \(\): Promise</g)).toHaveLength(2);
    expect(index.match(/handler: async \(request\): Promise</g)).toHaveLength(1);
  });
});
