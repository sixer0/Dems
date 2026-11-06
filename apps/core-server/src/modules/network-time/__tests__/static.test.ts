// Static guards of the network-time module (plan row W37; standing rules M2 to M5 and M8 of
// decision D83; row rule 3: "nothing reads the system time or the host's network state"). They
// read the production sources of `src/modules/network-time/` as text, with the scaffold's
// scanner, and keep these rules true for every later row that touches the folder:
//
//   1. No clock at all, no timer: every instant in an answer is the engine's (Q15, ENG-13).
//   2. Nothing of the host: no module of the runtime, no interface, no address, no name lookup,
//      no socket. The `network` slice is the simulated LAN of the Core device.
//   3. Who may call is stage 6's: nothing of the caller is read; no row, no refusal, no hook.
//   4. One state: the engine's committed state through the seam, read only. The area has no
//      command: no hosted action, no unit of work, no table.
//   5. Routes come from the registry: two, each built from its registry entry.
//   6. Nothing of a request is read at all.
//
// The patterns and their positive controls are this row's, in the storage folder's
// `static-rules.ts`.
import { describe, expect, it } from 'vitest';
import { MODULE_RULES, itHoldsNone } from '../../../../test/static/module-rules';
import { SCAN_COVERS, scanCoverage } from '../../../../test/static/scan';
import * as rules from '../../storage/__tests__/static-rules';

const FOLDER = 'src/modules/network-time/';
const { all, code } = rules.moduleSources(FOLDER);
const index = code.find((file) => file.path.endsWith('/index.ts'))?.text ?? '';

describe('the scan itself', () => {
  it('reads the production sources of the folder, its index among them', () => {
    expect(scanCoverage(all, [FOLDER])).toEqual(SCAN_COVERS);
    expect(index.length).toBeGreaterThan(500);
  });

  it('every pattern finds each of its planted texts (positive control)', () => {
    expect(rules.plantedMisses()).toEqual([]);
  });
});

describe('rule 1 (Q15, ENG-13): no clock, no timer', () => {
  itHoldsNone(MODULE_RULES.noSystemTimeNoTimer, rules, code, 'the folder does not read the system time and sets no timer');

  itHoldsNone(MODULE_RULES.noClockAtAll, rules, code, 'the folder reads no clock at all, not even the server clock: the engine stamps what is stamped');
});

describe('rule 2: nothing of the host', () => {
  it('no module of the runtime is imported: no os, no dns, no net, no other', () => {
    expect(rules.places(code, rules.HOST_MODULE)).toEqual([]);
    expect(rules.importSources(code)).toEqual(['../../plugins/permission-guard', '@dems/shared/api', 'fastify', 'fastify-type-provider-zod']);
  });

  it('no interface, address, host name, lookup, socket, process or listener of the server is named', () => {
    expect(rules.places(code, rules.HOST_STATE)).toEqual([]);
  });

  itHoldsNone(MODULE_RULES.noConsoleRandomLog, rules, code);
});

describe('rule 3 (M3): who may call is stage 6, only', () => {
  it('nothing of the caller is read: no role, permission, session, device, kind, and not the principal either', () => {
    expect(rules.places(code, rules.ACCESS_CHECK)).toEqual([]);
    expect(rules.places(code, rules.PRINCIPAL)).toEqual([]);
  });

  it('no denial row, no refusal, no place in the denial budget, no hook, no caught error', () => {
    expect(rules.places(code, rules.DENIAL)).toEqual([]);
    expect(rules.places(code, rules.HOOK)).toEqual([]);
    expect(rules.places(code, rules.CATCH)).toEqual([]);
    expect([...index.matchAll(/\bthrow\s+new\s+(\w+)/g)].map((match) => match[1])).toEqual(['Error']);
  });
});

describe('rule 4 (M4, M5): the committed state, read only', () => {
  it('of the engine it uses `state()` and `slice()`: no command, no unit, nothing that changes the state', () => {
    const used = [...index.matchAll(rules.ENGINE_USE)].map((match) => match[1]);
    expect(used).toEqual(['state', 'slice']);
    expect(rules.places(code, rules.ENGINE_BYPASS)).toEqual([]);
    expect(index).not.toMatch(/\bcommand\b|\bsetTabletLink\b|\bawait\b/);
  });

  itHoldsNone(MODULE_RULES.noOwnStorage, rules, code);

  it('nothing is assigned into a slice: the answers hold the engine\'s own objects under their slice names', () => {
    expect(index).toMatch(/const \{ network, tabletLink \} = app\.engine\.state\(\);\s*return \{ network, tabletLink \};/);
    expect(index).toMatch(/\(\{ time: app\.engine\.slice\('time'\) \}\)/);
    expect(index).not.toMatch(/\.\s*(?:push|splice|sort|reverse|fill|shift|unshift|pop)\s*\(|\bObject\s*\.\s*assign\b|\bdelete\s/);
  });

  itHoldsNone(MODULE_RULES.noSlotReplaced, rules, code);
});

describe('rule 5 (M2): routes come from the registry', () => {
  it('two routes, each spread from its registry entry; no method shorthand and no literal path', () => {
    expect(rules.count(code, rules.ROUTE_CALL)).toBe(2);
    expect([...index.matchAll(rules.ROUTE_FROM_REGISTRY)].map((match) => match[1])).toEqual(['getNetworkStatus', 'getTimeStatus']);
    expect(rules.places(code, rules.ROUTE_SHORTHAND)).toEqual([]);
    expect(rules.places(code, rules.LITERAL_PATH)).toEqual([]);
  });

  it('the plugin keeps the name the frozen app factory imports', () => {
    const source = all.find((file) => file.path.endsWith('/index.ts'))?.text ?? '';
    expect(source).toMatch(/export const networkTimeModule: FastifyPluginAsync = async \(app\) => \{/);
  });
});

describe('rule 6: nothing of a request is read', () => {
  it('no handler takes the request or the reply: no body, query, header, parameter, address or URL can reach an answer', () => {
    expect([...index.matchAll(rules.REQUEST_DATA)]).toEqual([]);
    expect(index).not.toMatch(/\brequest\b|\breply\b/);
    expect(index.match(/handler: async \(\): Promise</g)).toHaveLength(2);
  });
});
