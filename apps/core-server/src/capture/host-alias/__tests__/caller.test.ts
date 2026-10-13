// Task 4 row 105 (WP-19b): the Core's one caller of the address helper, on a transport double.
// No socket, no process and no network command here: the transport is a function of this file that
// answers from a script. The real local-socket transport is tested against a recording socket
// server in `src/__tests__/host-alias-socket.test.ts`.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ALIAS_MINUTES_MAX,
  ALIAS_MINUTES_MIN,
  HELPER_ANSWER_MAX_BYTES,
  HELPER_CODES,
  HELPER_REFUSAL_KINDS,
  HELPER_REQUEST_MAX_BYTES,
  HostAliasTransportFailure,
  addRequestLine,
  aliasQuadOf,
  createHostAliasCaller,
  delRequestLine,
  helperAnswerOf,
  interfaceAgreementRefusal,
  judgeExchange,
  wrongNetworkRefusal,
  type HelperCodeName,
  type HostAliasExchange,
  type HostAliasFacts,
  type HostAliasIntent,
  type HostAliasOutcome,
  type HostAliasResult,
  type HostAliasTransport,
} from '../index';

const HERE = dirname(fileURLToPath(import.meta.url));
const NAMES = Object.keys(HELPER_CODES) as HelperCodeName[];
const ALIAS = '192.168.1.253';
/** A text no outcome, entry or line may ever carry: what a hostile or broken helper could answer. */
const CANARY = 'eth9 /home/dems/.ssh hunter2';

interface Subject {
  readonly operatorId: string;
  readonly reason: string;
}
const SUBJECT: Subject = { operatorId: 'op-technician', reason: 'FACTORY_SCAN' };

const FACTS: HostAliasFacts = {
  storedInterface: 'eth1',
  fileInterface: 'eth1',
  cameraSubnet: { network: '192.168.100.0', prefixLength: 24 },
  cameraAddresses: [{ address: '192.168.100.1', alias: false }],
  otherInterfaceSubnets: [{ network: '10.20.0.0', prefixLength: 24 }],
  hostAddresses: ['10.20.0.5', '192.168.100.1'],
};

type Script = HostAliasExchange | 'throw' | 'never' | unknown;

function bench(options: { answers?: Script[]; preflight?: unknown; facts?: unknown; intentFails?: boolean; resultFails?: boolean } = {}) {
  const events: string[] = [];
  const lines: string[] = [];
  const intents: HostAliasIntent<Subject>[] = [];
  const results: HostAliasResult<Subject, number>[] = [];
  const answers = [...(options.answers ?? [])];
  let factsRead = 0;
  let release: (() => void) | null = null;
  const transport: HostAliasTransport = {
    preflight: async () => {
      events.push('preflight');
      if (options.preflight === 'throw') throw new Error(CANARY);
      return (options.preflight ?? null) as HostAliasTransportFailure | null;
    },
    exchange: async (line) => {
      events.push('exchange');
      lines.push(line);
      const next = answers.shift();
      if (next === 'throw') throw new Error(CANARY);
      if (next === 'never') await new Promise<void>((resolve) => (release = resolve));
      return (next === 'never' ? { kind: 'ANSWER', text: '0 OK\n' } : next) as HostAliasExchange;
    },
  };
  const caller = createHostAliasCaller<Subject, number>({
    transport,
    journal: {
      intent: async (entry) => {
        events.push('intent');
        if (options.intentFails === true) throw new Error(CANARY);
        intents.push(entry);
        return intents.length;
      },
      result: async (entry) => {
        events.push('result');
        if (options.resultFails === true) throw new Error(CANARY);
        results.push(entry);
      },
    },
    facts: async () => {
      factsRead += 1;
      if (options.facts === 'throw') throw new Error(CANARY);
      return ('facts' in options ? options.facts : FACTS) as HostAliasFacts;
    },
  });
  return { caller, events, lines, intents, results, factsRead: () => factsRead, release: () => release?.() };
}

const answer = (text: string): HostAliasExchange => ({ kind: 'ANSWER', text });
const pair = (name: HelperCodeName): HostAliasExchange => answer(`${HELPER_CODES[name]} ${name}\n`);
const nothingHappened = (scene: ReturnType<typeof bench>): void => {
  expect(scene.lines).toEqual([]);
  expect(scene.intents).toEqual([]);
  expect(scene.results).toEqual([]);
};

describe('the request line is made from numbers', () => {
  it('add and del, exactly as the helper reads them', () => {
    const decided = aliasQuadOf(ALIAS);
    expect(decided.ok).toBe(true);
    if (!decided.ok) return;
    expect(addRequestLine(decided.quad, 30)).toBe('add 192.168.1.253/24 30\n');
    expect(delRequestLine(decided.quad)).toBe('del 192.168.1.253/24\n');
    const longest = aliasQuadOf('192.168.254.254');
    if (!longest.ok) throw new Error('fixture');
    expect(Buffer.byteLength(addRequestLine(longest.quad, ALIAS_MINUTES_MAX))).toBeLessThanOrEqual(HELPER_REQUEST_MAX_BYTES);
  });

  it('the caller sends one line per action, built from the validated values and from nothing of the subject', async () => {
    const scene = bench({ answers: [pair('OK'), pair('OK')] });
    await scene.caller.add({ address: ALIAS, minutes: 30, subject: { operatorId: 'x\nadd 10.0.0.1/24 5', reason: '; rm -rf /' } });
    await scene.caller.remove({ address: ALIAS, subject: SUBJECT });
    expect(scene.lines).toEqual(['add 192.168.1.253/24 30\n', 'del 192.168.1.253/24\n']);
  });

  it('minutes: only an integer 5 to 480 of type number; anything else is refused before anything is read or sent', async () => {
    for (const minutes of [ALIAS_MINUTES_MIN - 1, ALIAS_MINUTES_MAX + 1, 0, -30, 30.5, Number.NaN, Number.POSITIVE_INFINITY, '30', '30 0', null, undefined, [30], { valueOf: () => 30 }]) {
      const scene = bench();
      await expect(scene.caller.add({ address: ALIAS, minutes, subject: SUBJECT })).resolves.toEqual({ action: 'ADD', refusal: 'MINUTES_OUT_OF_RANGE', effect: 'NOT_DONE', address: null, attempted: false, helperCode: null, resultRecorded: true });
      nothingHappened(scene);
      expect(scene.events).toEqual([]);
    }
    for (const minutes of [ALIAS_MINUTES_MIN, ALIAS_MINUTES_MAX]) {
      const scene = bench({ answers: [pair('OK')] });
      await scene.caller.add({ address: ALIAS, minutes, subject: SUBJECT });
      expect(scene.lines).toEqual([`add 192.168.1.253/24 ${minutes}\n`]);
    }
  });

  it('address: one strict private dotted quad with host part 1 to 254; every other form is refused by name, for both actions', async () => {
    const table: readonly (readonly [unknown, string])[] = [
      ['192.168.1.253/24', 'ADDRESS_MALFORMED'],
      ['192.168.1.253 ', 'ADDRESS_MALFORMED'],
      ['192.168.1.253\n', 'ADDRESS_MALFORMED'],
      ['192.168.01.253', 'ADDRESS_MALFORMED'],
      ['192.168.1', 'ADDRESS_MALFORMED'],
      ['192.168.1.256', 'ADDRESS_MALFORMED'],
      ['0xc0a801fd', 'ADDRESS_MALFORMED'],
      ['camera.local', 'ADDRESS_MALFORMED'],
      ['eth0 192.168.1.253', 'ADDRESS_MALFORMED'],
      ['-I', 'ADDRESS_MALFORMED'],
      ['::ffff:192.168.1.253', 'ADDRESS_MALFORMED'],
      [3232236029, 'ADDRESS_MALFORMED'],
      [null, 'ADDRESS_MALFORMED'],
      [['192.168.1.253'], 'ADDRESS_MALFORMED'],
      ['8.8.8.8', 'ADDRESS_NOT_PRIVATE'],
      ['127.0.0.1', 'ADDRESS_NOT_PRIVATE'],
      ['169.254.1.5', 'ADDRESS_NOT_PRIVATE'],
      ['224.0.0.1', 'ADDRESS_NOT_PRIVATE'],
      ['172.15.0.5', 'ADDRESS_NOT_PRIVATE'],
      ['172.32.0.5', 'ADDRESS_NOT_PRIVATE'],
      ['192.168.1.0', 'HOST_PART_OUT_OF_RANGE'],
      ['192.168.1.255', 'HOST_PART_OUT_OF_RANGE'],
    ];
    for (const [address, refusal] of table) {
      const scene = bench();
      await expect(scene.caller.add({ address, minutes: 30, subject: SUBJECT }), String(address)).resolves.toMatchObject({ refusal, attempted: false, address: null });
      await expect(scene.caller.remove({ address, subject: SUBJECT }), String(address)).resolves.toMatchObject({ refusal, attempted: false, address: null });
      nothingHappened(scene);
      expect(scene.events).toEqual([]);
    }
    for (const address of ['10.0.0.1', '172.16.0.254', '172.31.255.1', '192.168.0.1']) {
      const scene = bench({ answers: [pair('OK')], facts: { ...FACTS, otherInterfaceSubnets: [], hostAddresses: [], cameraAddresses: [] } });
      await expect(scene.caller.add({ address, minutes: 30, subject: SUBJECT })).resolves.toMatchObject({ refusal: null, address: `${address}/24` });
    }
  });
});

describe('every answer of the helper has one named Core refusal', () => {
  it('the table is the helper\'s: 41 names, distinct numbers, read from the delivered file', () => {
    const helper = readFileSync(join(HERE, '../../../../../../scripts/host/netalias/dems-core-netalias'), 'utf8');
    const block = helper.slice(helper.indexOf('CODES = {'), helper.indexOf('}', helper.indexOf('CODES = {')));
    const delivered = Object.fromEntries([...block.matchAll(/"([A-Z_0-9]+)": (\d+),/g)].map((match) => [match[1], Number(match[2])]));
    expect(delivered).toEqual({ ...HELPER_CODES });
    expect(NAMES).toHaveLength(41);
    expect(new Set(Object.values(HELPER_CODES)).size).toBe(41);
    // Pass I-9b: the five of the helper's R119 fixes, with the helper's numbers and the kind each is acted on as.
    expect([HELPER_CODES.CONFLICT_TOOL_NOT_EXPECTED, HELPER_CODES.INTERFACE_NOT_ARPABLE, HELPER_CODES.INTERFACE_DOWN, HELPER_CODES.INTERFACE_STATE_UNKNOWN, HELPER_CODES.CONFLICT_RESULT_UNKNOWN]).toEqual([38, 46, 47, 48, 55]);
    expect([HELPER_REFUSAL_KINDS.CONFLICT_TOOL_NOT_EXPECTED, HELPER_REFUSAL_KINDS.INTERFACE_NOT_ARPABLE, HELPER_REFUSAL_KINDS.INTERFACE_DOWN, HELPER_REFUSAL_KINDS.INTERFACE_STATE_UNKNOWN, HELPER_REFUSAL_KINDS.CONFLICT_RESULT_UNKNOWN]).toEqual(['INSTALLATION', 'HOST_STATE', 'HOST_STATE', 'HOST_STATE', 'TOOL']);
    expect(Object.keys(HELPER_REFUSAL_KINDS).sort()).toEqual(NAMES.filter((name) => name !== 'OK').sort());
    // The longest pair fits the bound an answer is read under.
    expect(Math.max(...NAMES.map((name) => `${HELPER_CODES[name]} ${name}\n`.length))).toBeLessThanOrEqual(HELPER_ANSWER_MAX_BYTES);
  });

  it('each of the 41, for add and for remove: its own name, the helper\'s number, 1 intent and 1 result entry', async () => {
    const seen = new Set<string>();
    for (const name of NAMES) {
      for (const action of ['ADD', 'REMOVE'] as const) {
        const scene = bench({ answers: [pair(name)] });
        const outcome = action === 'ADD' ? await scene.caller.add({ address: ALIAS, minutes: 30, subject: SUBJECT }) : await scene.caller.remove({ address: ALIAS, subject: SUBJECT });
        const unknown = name === 'ADD_FAILED' || name === 'DEL_FAILED' || name === 'INTERNAL';
        expect(outcome, `${action} ${name}`).toEqual({
          action,
          refusal: name === 'OK' ? null : `HELPER_${name}`,
          effect: name === 'OK' ? 'DONE' : unknown ? 'UNKNOWN' : 'NOT_DONE',
          address: '192.168.1.253/24',
          attempted: true,
          helperCode: HELPER_CODES[name],
          resultRecorded: true,
        });
        expect(scene.intents).toEqual([{ action, address: '192.168.1.253/24', minutes: action === 'ADD' ? 30 : null, subject: SUBJECT }]);
        expect(scene.results).toEqual([{ action, address: '192.168.1.253/24', minutes: action === 'ADD' ? 30 : null, subject: SUBJECT, token: 1, outcome }]);
        expect(scene.lines).toHaveLength(1);
        seen.add(String(outcome.refusal));
      }
    }
    expect(seen.size).toBe(41);
  });

  it('the order of an action that reaches the helper: facts, the check before dialling, intent, the line, result', async () => {
    const scene = bench({ answers: [pair('OK'), pair('NOT_MARKED')] });
    await scene.caller.add({ address: ALIAS, minutes: 30, subject: SUBJECT });
    expect(scene.events).toEqual(['preflight', 'intent', 'exchange', 'result']);
    expect(scene.factsRead()).toBe(1);
    await scene.caller.remove({ address: ALIAS, subject: SUBJECT });
    expect(scene.events).toEqual(['preflight', 'intent', 'exchange', 'result', 'preflight', 'intent', 'exchange', 'result']);
    // Taking an address away never waits for the host's facts.
    expect(scene.factsRead()).toBe(1);
  });
});

describe('an answer that is not a pair of the table', () => {
  const MALFORMED: readonly unknown[] = [
    '',
    '\n',
    '0 OK',
    '0 OK\r\n',
    ' 0 OK\n',
    '0  OK\n',
    '0 ok\n',
    '00 OK\n',
    '1 OK\n',
    '0 ADD_FAILED\n',
    '52 OK\n',
    '99 NOT_A_NAME\n',
    '0 OK\n0 OK\n',
    '0 OK\n\n',
    '0 OK \n',
    'OK\n',
    '0\n',
    '-1 OK\n',
    '0 OK\0\n',
    `0 OK ${CANARY}\n`,
    `44 ADDRESS_IN_USE ${CANARY}\n`,
    `${CANARY}\n`,
    '\u001b[31m0 OK\u001b[0m\n',
    `0 ${'A'.repeat(200)}\n`,
    'x'.repeat(4096),
    0,
    null,
    { toString: () => '0 OK\n' },
  ];

  it('is never read as an answer', () => {
    for (const text of MALFORMED) expect(helperAnswerOf(text), JSON.stringify(text)).toBeNull();
    for (const name of NAMES) expect(helperAnswerOf(`${HELPER_CODES[name]} ${name}\n`)).toBe(name);
  });

  it('is one fixed word with effect UNKNOWN, still gets its result entry, and none of its text reaches an outcome or an entry', async () => {
    for (const text of MALFORMED) {
      const scene = bench({ answers: [{ kind: 'ANSWER', text }] });
      const outcome = await scene.caller.add({ address: ALIAS, minutes: 30, subject: SUBJECT });
      expect(outcome, JSON.stringify(text)).toEqual({ action: 'ADD', refusal: 'HELPER_ANSWER_NOT_UNDERSTOOD', effect: 'UNKNOWN', address: '192.168.1.253/24', attempted: true, helperCode: null, resultRecorded: true });
      expect(scene.intents).toHaveLength(1);
      expect(scene.results).toHaveLength(1);
      const written = JSON.stringify([outcome, scene.intents, scene.results]);
      for (const part of ['eth9', '/home', 'hunter2', '\\u001b', 'AAAA', 'xxxx']) expect(written.includes(part), part).toBe(false);
    }
  });

  it('a transport that hands back something else, or throws, is a named refusal with effect UNKNOWN and a result entry', async () => {
    for (const [script, refusal] of [
      [undefined, 'CALLER_DEFECT'],
      [null, 'CALLER_DEFECT'],
      ['0 OK\n', 'CALLER_DEFECT'],
      [{ kind: 'DONE' }, 'CALLER_DEFECT'],
      [{ kind: 'FAILED', failure: CANARY }, 'CALLER_DEFECT'],
      [{ kind: 'FAILED', failure: 'toString' }, 'CALLER_DEFECT'],
      ['throw', 'HELPER_UNREACHABLE'],
    ] as const) {
      const scene = bench({ answers: [script] });
      const outcome = await scene.caller.remove({ address: ALIAS, subject: SUBJECT });
      expect(outcome).toMatchObject({ refusal, effect: 'UNKNOWN', attempted: true, helperCode: null });
      expect(scene.results).toHaveLength(1);
      expect(JSON.stringify([outcome, scene.results]).includes('hunter2')).toBe(false);
    }
  });
});

describe('the transport\'s words', () => {
  const BEFORE: Readonly<Record<HostAliasTransportFailure, string>> = {
    NOT_AVAILABLE_ON_THIS_PLATFORM: 'NOT_AVAILABLE_ON_THIS_PLATFORM',
    NOT_CONFIGURED: 'HELPER_NOT_CONFIGURED',
    SOCKET_PATH_UNSAFE: 'HELPER_SOCKET_UNSAFE',
    SOCKET_ABSENT: 'HELPER_NOT_INSTALLED',
    SOCKET_NOT_A_SOCKET: 'HELPER_SOCKET_UNSAFE',
    SOCKET_OWNER_OR_MODE: 'HELPER_SOCKET_UNSAFE',
    SOCKET_DIRECTORY_UNSAFE: 'HELPER_SOCKET_UNSAFE',
    REQUEST_NOT_A_LINE: 'CALLER_DEFECT',
    CONNECT_REFUSED: 'HELPER_NOT_INSTALLED',
    CONNECT_NOT_PERMITTED: 'HELPER_NOT_PERMITTED',
    CONNECT_FAILED: 'HELPER_UNREACHABLE',
    TIMED_OUT: 'HELPER_TIMED_OUT',
    CONNECTION_LOST: 'HELPER_CONNECTION_LOST',
    ANSWER_TOO_LONG: 'HELPER_ANSWER_TOO_LONG',
  };

  it('found before dialling: a named refusal, 0 entries, 0 lines (the platform seam\'s "not available" among them)', async () => {
    expect(Object.keys(BEFORE).sort()).toEqual(Object.keys(HostAliasTransportFailure).sort());
    for (const failure of Object.keys(BEFORE) as HostAliasTransportFailure[]) {
      const scene = bench({ preflight: failure });
      await expect(scene.caller.add({ address: ALIAS, minutes: 30, subject: SUBJECT })).resolves.toEqual({ action: 'ADD', refusal: BEFORE[failure], effect: 'NOT_DONE', address: '192.168.1.253/24', attempted: false, helperCode: null, resultRecorded: true });
      nothingHappened(scene);
    }
    for (const [preflight, refusal] of [['throw', 'HELPER_UNREACHABLE'], ['SOMETHING_ELSE', 'CALLER_DEFECT'], [undefined, null]] as const) {
      const scene = bench({ preflight, answers: [pair('OK')] });
      await expect(scene.caller.remove({ address: ALIAS, subject: SUBJECT })).resolves.toMatchObject({ refusal });
    }
  });

  it('found while calling: a named refusal and a result entry; the effect is UNKNOWN once a line may have left', async () => {
    for (const failure of Object.keys(BEFORE) as HostAliasTransportFailure[]) {
      const scene = bench({ answers: [{ kind: 'FAILED', failure }] });
      const outcome = await scene.caller.add({ address: ALIAS, minutes: 30, subject: SUBJECT });
      const unknown = failure === 'TIMED_OUT' || failure === 'CONNECTION_LOST' || failure === 'ANSWER_TOO_LONG';
      expect(outcome, failure).toEqual({ action: 'ADD', refusal: BEFORE[failure], effect: unknown ? 'UNKNOWN' : 'NOT_DONE', address: '192.168.1.253/24', attempted: true, helperCode: null, resultRecorded: true });
      expect(scene.intents).toHaveLength(1);
      expect(scene.results).toEqual([{ ...scene.intents[0], token: 1, outcome }]);
    }
    expect(judgeExchange({ kind: 'FAILED', failure: 'TIMED_OUT' })).toEqual({ refusal: 'HELPER_TIMED_OUT', effect: 'UNKNOWN', helperCode: null });
  });
});

describe('the wrong-network guard (DR-4) and the interface file against the stored row (F-07)', () => {
  const quad = (address: string) => {
    const decided = aliasQuadOf(address);
    if (!decided.ok) throw new Error('fixture');
    return decided.quad;
  };

  it('a target /24 held by another interface is refused before anything is recorded or sent', async () => {
    for (const other of [
      { network: '192.168.1.0', prefixLength: 24 },
      { network: '192.168.1.10', prefixLength: 24 },
      // A wider network over the /24, and a narrower one inside it.
      { network: '192.168.0.0', prefixLength: 16 },
      { network: '192.168.1.128', prefixLength: 25 },
      { network: '192.168.1.253', prefixLength: 32 },
      { network: '0.0.0.0', prefixLength: 0 },
    ]) {
      const scene = bench({ facts: { ...FACTS, otherInterfaceSubnets: [{ network: '10.20.0.0', prefixLength: 24 }, other] } });
      await expect(scene.caller.add({ address: ALIAS, minutes: 30, subject: SUBJECT }), JSON.stringify(other)).resolves.toEqual({ action: 'ADD', refusal: 'OTHER_INTERFACE_HOLDS_SUBNET', effect: 'NOT_DONE', address: '192.168.1.253/24', attempted: false, helperCode: null, resultRecorded: true });
      nothingHappened(scene);
      expect(scene.events).toEqual([]);
    }
    // Another interface in another network does not refuse.
    expect(wrongNetworkRefusal(quad(ALIAS), { ...FACTS, otherInterfaceSubnets: [{ network: '192.168.2.0', prefixLength: 24 }, { network: '10.0.0.0', prefixLength: 8 }] })).toBeNull();
  });

  it('an address the host already holds, and a /24 the camera port already has, need no alias and get none', () => {
    expect(wrongNetworkRefusal(quad(ALIAS), { ...FACTS, hostAddresses: [...FACTS.hostAddresses, ALIAS] })).toBe('HOST_HOLDS_ADDRESS');
    expect(wrongNetworkRefusal(quad(ALIAS), { ...FACTS, cameraAddresses: [{ address: ALIAS, alias: true }] })).toBe('HOST_HOLDS_ADDRESS');
    expect(wrongNetworkRefusal(quad('192.168.100.250'), FACTS)).toBe('CAMERA_INTERFACE_HOLDS_SUBNET');
    expect(wrongNetworkRefusal(quad(ALIAS), { ...FACTS, cameraSubnet: null })).toBeNull();
  });

  it('a host that cannot be seen is never "free"', async () => {
    for (const facts of [
      'throw',
      null,
      { ...FACTS, otherInterfaceSubnets: null },
      { ...FACTS, otherInterfaceSubnets: [{ network: 'eth0', prefixLength: 24 }] },
      { ...FACTS, otherInterfaceSubnets: [{ network: '10.20.0.0', prefixLength: 33 }] },
      { ...FACTS, otherInterfaceSubnets: [{ network: '10.20.0.0' }] },
      { ...FACTS, otherInterfaceSubnets: ['10.20.0.0/24'] },
      { ...FACTS, hostAddresses: ['10.20.0.5', 'fe80::1'] },
      { ...FACTS, hostAddresses: undefined },
      { ...FACTS, cameraAddresses: [{ alias: false }] },
      { ...FACTS, cameraSubnet: { network: '192.168.100.0', prefixLength: '24' } },
    ]) {
      const scene = bench({ facts });
      await expect(scene.caller.add({ address: ALIAS, minutes: 30, subject: SUBJECT }), JSON.stringify(facts)).resolves.toMatchObject({ refusal: 'HOST_FACTS_UNREADABLE', attempted: false });
      nothingHappened(scene);
    }
  });

  it('a file that names another interface than the row is refused by name; no interface name leaves', async () => {
    const table: readonly (readonly [unknown, unknown, string | null])[] = [
      ['eth1', 'eth1', null],
      ['eth1', 'eth0', 'INTERFACE_FILE_DIFFERS_FROM_ROW'],
      ['eth1', 'ETH1', 'INTERFACE_FILE_DIFFERS_FROM_ROW'],
      [null, 'eth1', 'NETWORK_NOT_CONFIGURED'],
      [undefined, 'eth1', 'NETWORK_NOT_CONFIGURED'],
      ['', 'eth1', 'INTERFACE_ROW_UNREADABLE'],
      ['../eth1', 'eth1', 'INTERFACE_ROW_UNREADABLE'],
      [7, 'eth1', 'INTERFACE_ROW_UNREADABLE'],
      ['eth1', null, 'INTERFACE_FILE_UNREADABLE'],
      ['eth1', 'eth1\neth0', 'INTERFACE_FILE_UNREADABLE'],
      ['eth1', '-eth1', 'INTERFACE_FILE_UNREADABLE'],
      ['eth1', 'a-name-of-sixteen', 'INTERFACE_FILE_UNREADABLE'],
    ];
    for (const [storedInterface, fileInterface, refusal] of table) {
      expect(interfaceAgreementRefusal(storedInterface, fileInterface), `${String(storedInterface)} / ${String(fileInterface)}`).toBe(refusal);
    }
    const scene = bench({ facts: { ...FACTS, storedInterface: 'enp3s0', fileInterface: 'enp4s0' } });
    const outcome = await scene.caller.add({ address: ALIAS, minutes: 30, subject: SUBJECT });
    expect(outcome).toEqual({ action: 'ADD', refusal: 'INTERFACE_FILE_DIFFERS_FROM_ROW', effect: 'NOT_DONE', address: '192.168.1.253/24', attempted: false, helperCode: null, resultRecorded: true });
    expect(JSON.stringify(outcome)).not.toMatch(/enp/);
    nothingHappened(scene);
    expect(scene.events).toEqual([]);
    // The disagreement is asked before the guard: a wrong file is named even when the network is also wrong.
    const both = bench({ facts: { ...FACTS, fileInterface: 'eth0', otherInterfaceSubnets: [{ network: '192.168.1.0', prefixLength: 24 }] } });
    await expect(both.caller.add({ address: ALIAS, minutes: 30, subject: SUBJECT })).resolves.toMatchObject({ refusal: 'INTERFACE_FILE_DIFFERS_FROM_ROW' });
  });

  it('a removal is held back by neither: the facts are not even read', async () => {
    const scene = bench({ answers: [pair('OK')], facts: 'throw' });
    await expect(scene.caller.remove({ address: ALIAS, subject: SUBJECT })).resolves.toMatchObject({ refusal: null, effect: 'DONE' });
    expect(scene.factsRead()).toBe(0);
  });
});

describe('intent before, result after (S13-10 (c))', () => {
  it('an intent that cannot be written stops the action: no line is sent', async () => {
    const scene = bench({ intentFails: true, answers: [pair('OK')] });
    await expect(scene.caller.add({ address: ALIAS, minutes: 30, subject: SUBJECT })).resolves.toEqual({ action: 'ADD', refusal: 'INTENT_NOT_RECORDED', effect: 'NOT_DONE', address: '192.168.1.253/24', attempted: false, helperCode: null, resultRecorded: true });
    expect(scene.lines).toEqual([]);
    expect(scene.events).toEqual(['preflight', 'intent']);
  });

  it('a result that cannot be written is said: the outcome stands and the intent stands alone', async () => {
    const scene = bench({ resultFails: true, answers: [pair('OK')] });
    await expect(scene.caller.add({ address: ALIAS, minutes: 30, subject: SUBJECT })).resolves.toEqual({ action: 'ADD', refusal: null, effect: 'DONE', address: '192.168.1.253/24', attempted: true, helperCode: 0, resultRecorded: false });
    expect(scene.intents).toHaveLength(1);
    expect(scene.results).toEqual([]);
  });

  it('one call in flight: a second action meanwhile is refused and writes nothing; the next one after it runs', async () => {
    const scene = bench({ answers: ['never', pair('OK')] });
    const first = scene.caller.add({ address: ALIAS, minutes: 30, subject: SUBJECT });
    await new Promise<void>((resolve) => setImmediate(resolve));
    await expect(scene.caller.remove({ address: ALIAS, subject: SUBJECT })).resolves.toMatchObject({ refusal: 'CALL_IN_PROGRESS', attempted: false });
    await expect(scene.caller.add({ address: '10.0.0.9', minutes: 30, subject: SUBJECT })).resolves.toMatchObject({ refusal: 'CALL_IN_PROGRESS', attempted: false });
    expect(scene.intents).toHaveLength(1);
    scene.release();
    await expect(first).resolves.toMatchObject({ refusal: null });
    await expect(scene.caller.remove({ address: ALIAS, subject: SUBJECT })).resolves.toMatchObject({ refusal: null });
    expect(scene.intents).toHaveLength(2);
    expect(scene.results).toHaveLength(2);
  });
});

describe('static: the caller in the capture area opens nothing itself', () => {
  const strip = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const sources = ['protocol.ts', 'caller.ts', 'index.ts'].map((name) => ({ name, text: strip(readFileSync(join(HERE, '..', name), 'utf8')) }));

  it('imports: the destination rule\'s types and the protocol file; no module of the runtime, no package', () => {
    const imports = sources.map((file) => [file.name, [...file.text.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1])]);
    expect(imports).toEqual([
      ['protocol.ts', []],
      ['caller.ts', ['../destination-rule', './protocol']],
      // Row 106: the barrel also exports the lifecycle's four files (their own imports: `lifecycle.test.ts`).
      // Row 106b: two more export lines - the interface-file source of `facts.ts` and the port of a job (`job-port.ts`).
      ['index.ts', ['./protocol', './caller', './facts', './facts', './job-port', './journal', './lifecycle', './store']],
    ]);
    expect(sources.find((file) => file.name === 'caller.ts')?.text).toMatch(/^import type \{ CameraInterfaceAddress, DestinationSubnet \} from '\.\.\/destination-rule';$/m);
  });

  it('no socket, file system, process, timer, clock, environment or log; no program of the host is named', () => {
    const forbidden = new RegExp(
      [
        'node:',
        'require\\(',
        'import\\(',
        // A call by its bare name: a pattern's own method of that name is not a process start.
        `(?<![.\\w$])(?:${['spawn', 'exec', 'execFile', 'fork'].join('|')})\\s*\\(`,
        `\\b(?:set|clear)(?:${['Timeout', 'Interval', 'Immediate'].join('|')})\\b`,
        `\\bDate\\b`,
        `\\bprocess\\b`,
        `\\bconsole\\b`,
        `\\blog(?:ger)?\\s*\\.`,
        `\\b(?:${['sudo', 'arping', 'ifconfig', 'systemctl'].join('|')})\\b`,
        `['"\`/]ip['"\`\\s]`,
        '/run/',
        '/etc/',
        '/usr/',
      ].join('|'),
    );
    for (const file of sources) expect(forbidden.exec(file.text)?.[0], file.name).toBeUndefined();
  });
});

// A value of the outcome type, so that a change of its members is a compile error here.
const _shape: HostAliasOutcome = { action: 'ADD', refusal: null, effect: 'DONE', address: null, attempted: false, helperCode: null, resultRecorded: true };
void _shape;
