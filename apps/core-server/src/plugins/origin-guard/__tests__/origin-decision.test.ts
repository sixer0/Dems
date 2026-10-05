// The Origin decision as pure functions (plan row W23; HB-6; spec §2.4, §14.2 OR-1 to OR-4;
// SR-19, SR-69, SR-70; AC-B-73 and AC-B-74 in unit form). The two decision tables of the
// specification are written here as data, cell by cell, and `decideOrigin` must give each cell.
// The upgrade table is the realtime channel's to prove on a real handshake (plan row W42); the
// function it is decided by is this one.
import { describe, expect, it } from 'vitest';
import { WEB_CONSOLE_ORIGINS, ownOriginsFor } from '../../../config';
import {
  OriginCategory,
  OriginRequestKind,
  OriginVerdict,
  UNLOGGABLE_ORIGIN,
  classifyOrigin,
  decideOrigin,
  originForLog,
  requestKindOf,
  type OriginFacts,
  type OriginLists,
} from '../origin-decision';

const MAIN: OriginLists = { webConsoleOrigins: WEB_CONSOLE_ORIGINS, ownOrigins: ownOriginsFor(4420) };
const LANE_2: OriginLists = { webConsoleOrigins: WEB_CONSOLE_ORIGINS, ownOrigins: ownOriginsFor(4422) };

const { ABSENT, WEB_CONSOLE, OWN, OTHER } = OriginCategory;
const { READ, COMMAND, UPGRADE } = OriginRequestKind;
const { ALLOW, REFUSE } = OriginVerdict;

describe('classifyOrigin: exact match against the two lists (OR-1, SR-70)', () => {
  it('no header is ABSENT', () => {
    expect(classifyOrigin(undefined, MAIN)).toBe(ABSENT);
  });

  it.each(['http://127.0.0.1:5173', 'http://127.0.0.1:5176', 'http://127.0.0.1:5177', 'http://127.0.0.1:5178'])(
    '%s is a web console origin',
    (origin) => {
      expect(classifyOrigin(origin, MAIN)).toBe(WEB_CONSOLE);
      expect(classifyOrigin(origin, LANE_2)).toBe(WEB_CONSOLE);
    },
  );

  it('the web console origins are these four and nothing else', () => {
    expect([...WEB_CONSOLE_ORIGINS]).toEqual([
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5176',
      'http://127.0.0.1:5177',
      'http://127.0.0.1:5178',
    ]);
  });

  it('the main instance has one own origin; a lane has that one and its own port', () => {
    expect(classifyOrigin('http://127.0.0.1:4420', MAIN)).toBe(OWN);
    expect(classifyOrigin('http://127.0.0.1:4420', LANE_2)).toBe(OWN);
    expect(classifyOrigin('http://127.0.0.1:4422', LANE_2)).toBe(OWN);
    // Another instance's port is not this instance's own origin.
    expect(classifyOrigin('http://127.0.0.1:4422', MAIN)).toBe(OTHER);
    expect(classifyOrigin('http://127.0.0.1:4421', LANE_2)).toBe(OTHER);
  });

  it('an own origin never counts as a web console, and a web console origin never as own', () => {
    for (const lists of [MAIN, LANE_2]) {
      for (const origin of lists.ownOrigins) expect(lists.webConsoleOrigins).not.toContain(origin);
    }
  });

  // AC-B-74: the five values of the criterion.
  it.each([
    ['a localhost origin', 'http://localhost:5173'],
    ['the literal null', 'null'],
    ['a trailing slash', 'http://127.0.0.1:5173/'],
    ['an upper-case scheme', 'HTTP://127.0.0.1:5173'],
    ['port 5174', 'http://127.0.0.1:5174'],
  ])('AC-B-74: %s is OTHER', (_label, origin) => {
    expect(classifyOrigin(origin, MAIN)).toBe(OTHER);
    expect(classifyOrigin(origin, LANE_2)).toBe(OTHER);
  });

  // Nothing is normalised: each of these is one edit away from a listed origin.
  it.each([
    ['https instead of http', 'https://127.0.0.1:5173'],
    ['no port', 'http://127.0.0.1'],
    ['a leading zero in the port', 'http://127.0.0.1:05173'],
    ['a trailing space', 'http://127.0.0.1:5173 '],
    ['a leading space', ' http://127.0.0.1:5173'],
    ['a trailing dot', 'http://127.0.0.1:5173.'],
    ['an upper-case host', 'http://LOCALHOST:5173'],
    ['a short form of the address', 'http://127.1:5173'],
    ['the IPv6 loopback', 'http://[::1]:5173'],
    ['a path', 'http://127.0.0.1:5173/api'],
    ['a query string', 'http://127.0.0.1:5173?x=1'],
    ['a user part that names a listed origin', 'http://127.0.0.1:5173@evil.example'],
    ['a listed origin as a prefix', 'http://127.0.0.1:51730'],
    ['two listed origins joined, as a repeated header arrives', 'http://127.0.0.1:5173, http://127.0.0.1:5173'],
    ['an empty value', ''],
    ['the word undefined', 'undefined'],
    ['a foreign site', 'http://evil.example'],
    ['a localhost form of the own origin', 'http://localhost:4420'],
    ['a trailing slash on the own origin', 'http://127.0.0.1:4420/'],
  ])('%s is OTHER', (_label, origin) => {
    expect(classifyOrigin(origin, MAIN)).toBe(OTHER);
  });

  it('a header that arrives as a list is OTHER, also when each entry is listed', () => {
    expect(classifyOrigin(['http://127.0.0.1:5173'], MAIN)).toBe(OTHER);
    expect(classifyOrigin(['http://127.0.0.1:5173', 'http://127.0.0.1:5173'], MAIN)).toBe(OTHER);
  });
});

describe('requestKindOf', () => {
  it('a GET is a read, every other method a command', () => {
    expect(requestKindOf('GET', undefined)).toBe(READ);
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'get']) {
      expect(requestKindOf(method, undefined), method).toBe(COMMAND);
    }
  });

  it('an Upgrade header makes the request an upgrade, whatever its value and its method', () => {
    expect(requestKindOf('GET', 'websocket')).toBe(UPGRADE);
    expect(requestKindOf('GET', 'WebSocket')).toBe(UPGRADE);
    expect(requestKindOf('GET', '')).toBe(UPGRADE);
    expect(requestKindOf('GET', 'h2c')).toBe(UPGRADE);
    expect(requestKindOf('POST', 'websocket')).toBe(UPGRADE);
  });
});

// ── The decision tables of spec §14.2, cell by cell ────────────────────────────────────────────

type Row = 'cookie' | 'bearer' | 'none' | 'cookie and bearer';
const CREDENTIALS: Readonly<Record<Row, Pick<OriginFacts, 'hasCookie' | 'hasBearer'>>> = {
  cookie: { hasCookie: true, hasBearer: false },
  bearer: { hasCookie: false, hasBearer: true },
  none: { hasCookie: false, hasBearer: false },
  'cookie and bearer': { hasCookie: true, hasBearer: true },
};

/** `[row, column, kind, what stage 3 does, the cell of the specification]`. */
type Cell = readonly [Row, OriginCategory, OriginRequestKind, OriginVerdict, string];

const HTTP_TABLE: readonly Cell[] = [
  ['cookie', ABSENT, READ, ALLOW, 'GET: accepted (OR-3)'],
  ['cookie', ABSENT, COMMAND, REFUSE, 'POST: 403 (OR-2)'],
  ['cookie', OWN, READ, REFUSE, '403'],
  ['cookie', OWN, COMMAND, REFUSE, '403'],
  ['cookie', WEB_CONSOLE, READ, ALLOW, 'Accepted'],
  ['cookie', WEB_CONSOLE, COMMAND, ALLOW, 'Accepted'],
  ['cookie', OTHER, READ, REFUSE, '403'],
  ['cookie', OTHER, COMMAND, REFUSE, '403'],

  ['bearer', ABSENT, READ, ALLOW, 'Accepted (OR-4)'],
  ['bearer', ABSENT, COMMAND, ALLOW, 'Accepted (OR-4)'],
  ['bearer', OWN, READ, ALLOW, 'Accepted (OR-4)'],
  ['bearer', OWN, COMMAND, ALLOW, 'Accepted (OR-4)'],
  ['bearer', WEB_CONSOLE, READ, REFUSE, '403 (OR-4)'],
  ['bearer', WEB_CONSOLE, COMMAND, REFUSE, '403 (OR-4)'],
  ['bearer', OTHER, READ, REFUSE, '403'],
  ['bearer', OTHER, COMMAND, REFUSE, '403'],

  ['none', ABSENT, READ, ALLOW, 'Accepted as ANONYMOUS'],
  ['none', ABSENT, COMMAND, ALLOW, 'Accepted as ANONYMOUS'],
  ['none', OWN, READ, ALLOW, 'Accepted as ANONYMOUS and not as a web console'],
  ['none', OWN, COMMAND, ALLOW, 'Accepted as ANONYMOUS and not as a web console'],
  ['none', WEB_CONSOLE, READ, ALLOW, 'Accepted as ANONYMOUS; a web console for ID-1 (a)'],
  ['none', WEB_CONSOLE, COMMAND, ALLOW, 'Accepted as ANONYMOUS; a web console for ID-1 (a)'],
  ['none', OTHER, READ, REFUSE, '403'],
  ['none', OTHER, COMMAND, REFUSE, '403'],

  // Where the cell says 401, stage 3 lets the request through and stage 4 refuses it (ID-12).
  ['cookie and bearer', ABSENT, READ, ALLOW, 'GET: 401 CREDENTIAL_CONFLICT (stage 4)'],
  ['cookie and bearer', ABSENT, COMMAND, REFUSE, 'POST: 403'],
  ['cookie and bearer', OWN, READ, REFUSE, '403'],
  ['cookie and bearer', OWN, COMMAND, REFUSE, '403'],
  ['cookie and bearer', WEB_CONSOLE, READ, ALLOW, '401 CREDENTIAL_CONFLICT (stage 4)'],
  ['cookie and bearer', WEB_CONSOLE, COMMAND, ALLOW, '401 CREDENTIAL_CONFLICT (stage 4)'],
  ['cookie and bearer', OTHER, READ, REFUSE, '403'],
  ['cookie and bearer', OTHER, COMMAND, REFUSE, '403'],
];

const UPGRADE_TABLE: readonly Cell[] = [
  ['cookie', ABSENT, UPGRADE, REFUSE, '403: a browser always sends its Origin on an upgrade'],
  ['cookie', OWN, UPGRADE, REFUSE, '403'],
  ['cookie', WEB_CONSOLE, UPGRADE, ALLOW, 'OPERATOR; or ANONYMOUS with SESSION_INVALID'],
  ['cookie', OTHER, UPGRADE, REFUSE, '403'],

  ['bearer', ABSENT, UPGRADE, ALLOW, 'DEVICE or OPERATOR; else closed with 4401 or 4403'],
  ['bearer', OWN, UPGRADE, ALLOW, 'The same'],
  ['bearer', WEB_CONSOLE, UPGRADE, REFUSE, '403'],
  ['bearer', OTHER, UPGRADE, REFUSE, '403'],

  ['none', ABSENT, UPGRADE, ALLOW, 'ANONYMOUS'],
  ['none', OWN, UPGRADE, ALLOW, 'ANONYMOUS'],
  ['none', WEB_CONSOLE, UPGRADE, ALLOW, 'ANONYMOUS'],
  ['none', OTHER, UPGRADE, REFUSE, '403'],

  ['cookie and bearer', ABSENT, UPGRADE, REFUSE, '403'],
  ['cookie and bearer', OWN, UPGRADE, REFUSE, '403'],
  ['cookie and bearer', WEB_CONSOLE, UPGRADE, ALLOW, '401 (stage 4)'],
  ['cookie and bearer', OTHER, UPGRADE, REFUSE, '403'],
];

describe('decideOrigin: the decision table for HTTP requests (spec §14.2)', () => {
  it('covers every cell: four credential rows, four Origin columns, GET and POST', () => {
    expect(HTTP_TABLE).toHaveLength(4 * 4 * 2);
    expect(new Set(HTTP_TABLE.map(([row, column, kind]) => `${row}|${column}|${kind}`)).size).toBe(32);
  });

  it.each(HTTP_TABLE)('%s, Origin %s, %s: %s (%s)', (row, category, kind, verdict) => {
    expect(decideOrigin({ category, ...CREDENTIALS[row] }, kind)).toBe(verdict);
  });
});

describe('decideOrigin: the decision table for the WebSocket upgrade (spec §14.2)', () => {
  it('covers every cell: four credential rows, four Origin columns', () => {
    expect(UPGRADE_TABLE).toHaveLength(4 * 4);
    expect(new Set(UPGRADE_TABLE.map(([row, column]) => `${row}|${column}`)).size).toBe(16);
  });

  it.each(UPGRADE_TABLE)('%s, Origin %s, %s: %s (%s)', (row, category, kind, verdict) => {
    expect(decideOrigin({ category, ...CREDENTIALS[row] }, kind)).toBe(verdict);
  });

  it('an upgrade is decided like a command: only the cookie without an Origin differs from a read', () => {
    for (const [row, category, , verdict] of UPGRADE_TABLE) {
      const facts = { category, ...CREDENTIALS[row] };
      expect(decideOrigin(facts, COMMAND)).toBe(verdict);
      const differs = facts.hasCookie && category === ABSENT;
      expect(decideOrigin(facts, READ) !== verdict).toBe(differs);
    }
  });
});

describe('the rules behind the tables', () => {
  it('OR-1: an origin in neither list is refused whatever the request carries', () => {
    for (const kind of [READ, COMMAND, UPGRADE]) {
      for (const credentials of Object.values(CREDENTIALS)) {
        expect(decideOrigin({ category: OTHER, ...credentials }, kind)).toBe(REFUSE);
      }
    }
  });

  it('OR-1, OR-2: an own origin is accepted only on a request without a cookie', () => {
    for (const kind of [READ, COMMAND, UPGRADE]) {
      expect(decideOrigin({ category: OWN, hasCookie: true, hasBearer: false }, kind)).toBe(REFUSE);
      expect(decideOrigin({ category: OWN, hasCookie: true, hasBearer: true }, kind)).toBe(REFUSE);
      expect(decideOrigin({ category: OWN, hasCookie: false, hasBearer: true }, kind)).toBe(ALLOW);
      expect(decideOrigin({ category: OWN, hasCookie: false, hasBearer: false }, kind)).toBe(ALLOW);
    }
  });

  it('SR-20: the only request a cookie may make without an Origin is a read', () => {
    const facts = { category: ABSENT, hasCookie: true, hasBearer: false };
    expect(decideOrigin(facts, READ)).toBe(ALLOW);
    expect(decideOrigin(facts, COMMAND)).toBe(REFUSE);
    expect(decideOrigin(facts, UPGRADE)).toBe(REFUSE);
  });
});

describe('originForLog: what a log line may hold of the header', () => {
  it('nothing for a request without the header', () => {
    expect(originForLog(undefined)).toBeNull();
  });

  it.each([
    'http://localhost:5176',
    'http://127.0.0.1:5174',
    'HTTP://127.0.0.1:5173',
    'https://example.org',
    'http://[::1]:5173',
    'null',
  ])('%s is written as it is: scheme, host and port only', (origin) => {
    expect(originForLog(origin)).toBe(origin);
  });

  it.each([
    ['a path', 'http://evil.example/secret-path'],
    ['a trailing slash', 'http://127.0.0.1:5173/'],
    ['a query string', 'http://evil.example?token=MARK'],
    ['a fragment', 'http://evil.example#MARK'],
    ['a user part', 'http://user:MARK@evil.example'],
    ['a space', 'http://evil.example MARK'],
    ['a line break', 'http://evil.example\n{"level":50}'],
    ['a joined list', 'http://a.example, http://b.example'],
    ['free text', 'MARK'],
    ['an empty value', ''],
    ['a very long host', `http://${'a'.repeat(300)}.example`],
  ])('%s is replaced by a fixed text', (_label, origin) => {
    expect(originForLog(origin)).toBe(UNLOGGABLE_ORIGIN);
  });

  it('a header that arrives as a list is replaced by the fixed text', () => {
    expect(originForLog(['http://a.example'])).toBe(UNLOGGABLE_ORIGIN);
  });
});
