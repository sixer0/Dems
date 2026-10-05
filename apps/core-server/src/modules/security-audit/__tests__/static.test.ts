// Static guards of the security-audit module (plan row W39; decision D83 rules M2 to M5, M8 and
// M14; decision D62 DN-5 / D67 DN-9, rule MR-1; spec §4.6, §8.2). They read the production
// sources of the folder as text, with the scaffold's scanner, and keep these rules true for
// every later row that touches it:
//
//   1. Who may call is stage 6, only: no file reads a member of the principal, names a
//      permission or a role, asks the session registry or the device registry, or adds a hook.
//   2. No denial row and no row at all: nothing here appends an audit row or an event, takes a
//      place in the denial budget, or names the two denial types.
//   3. The engine: three hosted actions through `app.engine.command(request.principal, …)`, two
//      committed slices and the epoch. No simulator action is called directly; no unit is opened.
//   4. The folder writes no row and NO FILE: no statement that changes a row, no insert, update
//      or delete of the query builder; every transaction is read only at REPEATABLE READ.
//   5. ONE chain check (MR-1): the folder holds no hash function and no comparison of a row with
//      its predecessor. It calls `checkStoredChain` with `verifyStoredAuditRows`, once.
//   6. Routes come from the registry: every route is built with `routeOfOperation`.
//   7. No clock, no chance, no environment, no console, no raw URL.
//   8. The log: a code first, numbers and codes after it; never an error under a key of its own.
//
// Every forbidden text is built from fragments, so that this file does not contain it.
import { describe, expect, it } from 'vitest';
import { WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, type SourceFile } from '../../../../test/static/scan';
import { hostedActionsOfOperation } from '../../../engine';
import { SECURITY_AUDIT_MODULE_OPERATIONS } from '../index';

const FOLDER = 'src/modules/security-audit/';

const all = readTree(WORKSPACE).filter((file) => isProductionSource(file.path) && file.path.startsWith(FOLDER));
const code = codeOnly(all);
const count = (pattern: RegExp, where: readonly SourceFile[] = code): number => occurrences(where, pattern).length;
const textOf = (path: string): string => code.find((file) => file.path === path)?.text ?? '';
const places = (pattern: RegExp): string[] => occurrences(code, pattern).map((place) => place.replace(/:\d+$/, ''));

const join = (...parts: string[]): string => parts.join('');

// 1. Who may call.
const PRINCIPAL_MEMBER = new RegExp(`\\b${'principal'}\\s*\\??\\.\\s*[A-Za-z]`, 'g');
const ACCESS_WORDS = new RegExp(
  [
    `\\b${join('Permis', 'sion')}s?\\b`,
    `\\b${join('permis', 'sions')}\\b`,
    `\\b${join('ROLE_', 'PERMISSIONS')}\\b`,
    `\\b${join('role', 'Has')}\\b`,
    `\\b${join('Operator', 'Role')}\\b`,
    `\\.\\s*${'role'}\\b`,
    `\\b${join('session', 'Registry')}\\b`,
    `\\b${join('device', 'Resolver')}\\b`,
    `\\b${join('operator', 'SessionOf')}\\b`,
    `\\b${join('authentication', 'Of')}\\b`,
    `\\b${join('retired', 'DeviceId')}\\b`,
  ].join('|'),
  'g',
);
const HOOKS = new RegExp(`\\b(?:${['onRequest', 'preParsing', 'preValidation', 'preHandler', 'preSerialization', 'onSend', 'onResponse'].join('|')})\\b|\\.\\s*${join('add', 'Hook')}\\s*\\(`, 'g');
// 2. Denial rows, and rows.
const DENIAL = new RegExp(
  [`${join('ACCESS', '_DENIED')}`, `${join('EXPORT', '_DENIED')}`, `\\b${join('denial', 'Budget')}\\b`, `\\b${join('audit', 'Writer')}\\b`, `\\.\\s*${'audit'}\\s*\\.\\s*${'append'}`, `\\.\\s*${'events'}\\s*\\.\\s*${'append'}`, `\\b${join('append', 'Prepared')}\\b`].join('|'),
  'g',
);
// 3. The engine.
const ENGINE_COMMAND_LITERAL = new RegExp(`\\bapp\\s*\\.\\s*engine\\s*\\.\\s*${'command'}\\s*\\(\\s*request\\s*\\.\\s*principal\\s*,\\s*'([A-Za-z]+)'`, 'g');
const ENGINE_COMMAND_NAMED = new RegExp(`\\bapp\\s*\\.\\s*engine\\s*\\.\\s*${'command'}\\s*\\(\\s*request\\s*\\.\\s*principal\\s*,\\s*action\\s*,`, 'g');
const EXPORT_ACTION = new RegExp(`\\brunExport\\(request, reply, '([A-Za-z]+)'`, 'g');
const ENGINE_ANY = new RegExp(`\\bengine\\s*\\.\\s*([A-Za-z]+)`, 'g');
const ENGINE_OTHER = new RegExp(
  [`\\.\\s*${'actions'}\\s*\\.`, `\\b${join('engine', 'Control')}\\b`, `\\.\\s*${'simulator'}\\s*\\(`, `\\.\\s*${'pending'}\\s*\\(`, `\\bengine\\s*\\.\\s*(?:run|state|start|stop|reload|setTabletLink|mirrorOperators)\\s*\\(`, `\\b${'pipeline'}\\b`, `\\bcreate${'Sim'}\\b`].join('|'),
  'g',
);
// 4. Writes.
const STATEMENT_TEXT = new RegExp(`\\b(?:${['INSERT\\s+INTO', 'UPDATE\\s+\\w+\\s+SET', 'DELETE\\s+FROM', 'TRUNCATE', 'ALTER\\s+TABLE', 'DROP\\s+TABLE', 'CREATE\\s+', 'COPY\\s+'].join('|')})\\b`, 'gi');
const BUILDER_WRITE = new RegExp(`\\.\\s*(?:${['insert', 'update', 'delete', 'execute'].join('|')})\\s*\\(`, 'g');
const TRANSACTION = new RegExp(`\\.\\s*${'transaction'}\\s*\\(`, 'g');
const RAW_QUERY = new RegExp(`\\.\\s*${'query'}\\s*[<(]`, 'g');
// 5. One chain check.
const OWN_CHECK = new RegExp(
  [`\\b${join('chain', 'Hash')}\\b`, `\\b${join('audit', 'Body')}\\b`, `\\b${join('canonical', 'JSON')}\\b`, `\\b${join('sha', '256')}`, `\\b${join('create', 'Hash')}\\b`, `\\b${join('verify', 'AuditChain')}\\s*\\(`, `\\b${join('append', 'Audit')}\\b`].join('|'),
  'g',
);
// 6. Routes.
const ROUTE = new RegExp(`\\broutes\\s*\\.\\s*route\\s*\\(\\s*\\{\\s*\\.\\.\\.${join('routeOf', 'Operation')}\\(operations\\.([A-Za-z]+)\\)`, 'g');
const ANY_ROUTE = new RegExp(`\\.\\s*(?:route|get|post|put|patch|delete|head|options|all)\\s*\\(\\s*(?:\\{|['"\`])`, 'g');
// 7. Time, chance, environment, files.
const SYSTEM_TIME = new RegExp([`\\bDate\\s*\\.\\s*${'now'}\\s*\\(`, `\\bnew\\s+Date\\s*\\(`, `\\bperformance\\s*\\.\\s*${'now'}\\b`, `\\bhr${'time'}\\b`, `\\b${'clock'}\\b`].join('|'), 'g');
const TIMER = new RegExp(`\\bset(?:${'Timeout'}|${'Interval'}|${'Immediate'})\\s*\\(`, 'g');
const CHANCE = new RegExp(`['"]node:${'crypto'}['"]|\\bMath\\s*\\.\\s*${'random'}\\b|\\brandom${'UUID'}\\b`, 'g');
const CONSOLE = new RegExp(`\\b${'console'}\\s*\\.`, 'g');
const RAW_URL = new RegExp(`\\brequest\\s*\\.\\s*(?:raw\\s*\\.\\s*)?${'url'}\\b|\\boriginal${'Url'}\\b|\\brequest\\s*\\.\\s*${'headers'}\\b`, 'g');
const ENVIRONMENT = new RegExp(`\\bprocess\\s*\\.\\s*${'env'}\\b|\\.\\s*${'listen'}\\s*\\(`, 'g');
const FILES = new RegExp(
  [`['"]node:(?:${['fs', 'fs/promises', 'path', 'child_process', 'http', 'https', 'net', 'stream', 'zlib'].join('|')})['"]`, `\\b${join('send', 'File')}\\b`, `\\bcreate${join('Read', 'Stream')}\\b`, `\\bcreate${join('Write', 'Stream')}\\b`, `${join('@fastify/', 'static')}`, `\\b${'fetch'}\\s*\\(`, `\\b${join('read', 'File')}`, `\\b${join('write', 'File')}`].join('|'),
  'g',
);
// 8. The log.
const LOG_CALL = new RegExp(`\\blog\\s*\\.\\s*(trace|debug|info|warn|error|fatal)\\s*\\(\\s*(\\{[^}]*\\})\\s*,\\s*([A-Z_]+)\\s*\\)`, 'g');
const ANY_LOG_CALL = new RegExp(`\\blog\\s*\\.\\s*(?:trace|debug|info|warn|error|fatal)\\s*\\(`, 'g');
const ERROR_KEYS = new RegExp(`\\b(?:${['err', 'error', 'cause', 'reason', 'e', 'exception'].join('|')})\\s*[:,}]`);

describe('the scan itself', () => {
  it('reads the production sources of the folder', () => {
    expect(all.map((file) => file.path)).toEqual([
      'src/modules/security-audit/cursor.ts',
      'src/modules/security-audit/export-request.ts',
      'src/modules/security-audit/index.ts',
      'src/modules/security-audit/reads.ts',
      'src/modules/security-audit/stored-chain.ts',
    ]);
  });

  it('finds each forbidden text when it is present (positive control)', () => {
    const planted: SourceFile[] = [
      { path: 'a.ts', text: `if (request.${'principal'}.kind !== 'OPERATOR') throw x; if (!request.${'principal'}?.${join('permis', 'sions')}.includes(${join('Permis', 'sion')}.AUDIT_EXPORT)) throw y; const r = operator.${'role'};` },
      { path: 'b.ts', text: `routes.route({ ...r, ${'onRequest'}: guard, ${'preHandler'}: [check] }); app.${join('add', 'Hook')}('onRequest', guard);` },
      { path: 'c.ts', text: `await app.${join('denial', 'Budget')}.consume(request); await unit.${'audit'}.${'append'}({ type: '${join('EXPORT', '_DENIED')}' }); await unit.${'events'}.${'append'}(e);` },
      { path: 'd.ts', text: `sim.${'actions'}.exportAudit(r); ${join('engine', 'Control')}(app).${'simulator'}(); app.engine.state(); app.engine.run('x', work); await app.${'pipeline'}.run('y', work);` },
      { path: 'e.ts', text: `await tx.${'insert'}(t).values(v); await tx.${'update'}(t).set(v); await tx.${'delete'}(t); await pool.query('UPDATE audit_chain_head SET seq = $1'); await pool.query('insert into exports (id) values ($1)'); await pool.query('COPY audit_log TO stdout');` },
      { path: 'f.ts', text: `const t = Date.${'now'}(); set${'Timeout'}(f, 1); Math.${'random'}(); ${'console'}.log(request.${'url'}, process.${'env'}.X, request.${'headers'}.host); app.${'clock'}.now();` },
      { path: 'g.ts', text: `import { ${join('write', 'File')}Sync } from 'node:${'fs'}'; reply.${join('send', 'File')}(name); ${join('create', 'Write', 'Stream')}(path); await ${'fetch'}(url);` },
      { path: 'h.ts', text: `app.get('/api/v1/audit/file', handler); app.route({ method: 'GET', url: '/x' });` },
      { path: 'i.ts', text: `if (${join('chain', 'Hash')}(row.prevHash, ${join('audit', 'Body')}(row)) !== row.hash) bad(); const r = ${join('verify', 'AuditChain')}(log); import { ${join('create', 'Hash')} } from 'x';` },
      { path: 'j.ts', text: `log.error({ code: 'X', error }, FAILED); log.warn({ cause: failure, code: 'Y' }, FAILED); log.info('free text ' + value);` },
    ];
    expect({
      principalMember: count(PRINCIPAL_MEMBER, planted),
      accessWords: count(ACCESS_WORDS, planted),
      hooks: count(HOOKS, planted),
      denial: count(DENIAL, planted),
      engineOther: count(ENGINE_OTHER, planted),
      builderWrite: count(BUILDER_WRITE, planted),
      statementText: count(STATEMENT_TEXT, planted),
      systemTime: count(SYSTEM_TIME, planted),
      timer: count(TIMER, planted),
      chance: count(CHANCE, planted),
      console: count(CONSOLE, planted),
      rawUrl: count(RAW_URL, planted),
      environment: count(ENVIRONMENT, planted),
      files: count(FILES, planted),
      anyRoute: count(ANY_ROUTE, planted),
      registryRoute: count(ROUTE, planted),
      ownCheck: count(OWN_CHECK, planted),
    }).toEqual({
      principalMember: 2,
      accessWords: 3,
      hooks: 4,
      denial: 4,
      engineOther: 6,
      builderWrite: 3,
      statementText: 3,
      systemTime: 2,
      timer: 1,
      chance: 1,
      console: 1,
      rawUrl: 2,
      environment: 1,
      files: 5,
      anyRoute: 3,
      registryRoute: 0,
      ownCheck: 4,
    });
    const logCalls = planted.flatMap((file) => [...file.text.matchAll(LOG_CALL)]);
    expect(logCalls.map((match) => ERROR_KEYS.test(match[2] ?? ''))).toEqual([true, true]);
    // The third planted log call has no object and a built text: it is not of the one accepted form.
    expect(count(ANY_LOG_CALL, planted) - logCalls.length).toBe(1);
  });
});

describe('rule 1 (M3): who may call is stage 6, only', () => {
  it('no file reads a member of the principal: it is handed to the engine host whole', () => {
    expect(occurrences(code, PRINCIPAL_MEMBER)).toEqual([]);
  });

  it('no file names a permission, a role, the session registry or the device registry', () => {
    expect(occurrences(code, ACCESS_WORDS)).toEqual([]);
  });

  it('no route has a hook of its own, and the module adds none to the app', () => {
    expect(occurrences(code, HOOKS)).toEqual([]);
  });
});

describe('rule 2 (M3, M5, M6): the module writes no denial row and no row at all', () => {
  it('nothing appends an audit row or an event, takes a place in the denial budget, or names a denial type', () => {
    expect(occurrences(code, DENIAL)).toEqual([]);
  });
});

describe('rule 3 (M4): the engine', () => {
  it('the three hosted actions are called through app.engine.command with request.principal, and they are the hosted actions of the module\'s operations', () => {
    const index = textOf(`${FOLDER}index.ts`);
    const literal = [...index.matchAll(ENGINE_COMMAND_LITERAL)].map((match) => match[1]);
    const named = [...index.matchAll(ENGINE_COMMAND_NAMED)];
    const exports = [...index.matchAll(EXPORT_ACTION)].map((match) => match[1]);
    expect(literal).toEqual(['verifyAuditChain']);
    expect(named).toHaveLength(1);
    expect(exports).toEqual(['exportAudit', 'exportLogs']);
    // The one call with a named action sits in `runExport`, whose action is one of those two.
    expect(index).toMatch(/async function runExport\(request: FastifyRequest, reply: FastifyReply, action: 'exportAudit' \| 'exportLogs', /);
    const hosted = SECURITY_AUDIT_MODULE_OPERATIONS.flatMap((operationId) => hostedActionsOfOperation(operationId));
    expect([...literal, ...exports].sort()).toEqual([...hosted].sort());
  });

  it('beside them the folder reads two committed slices and the epoch, in index.ts, and nothing else of the engine', () => {
    const uses = code.flatMap((file) => [...file.text.matchAll(ENGINE_ANY)].map((match) => `${file.path.slice(FOLDER.length)} ${match[1]}`));
    expect(uses.sort()).toEqual(['index.ts command', 'index.ts command', 'index.ts epoch', 'index.ts slice', 'index.ts slice']);
    const slices = [...textOf(`${FOLDER}index.ts`).matchAll(/\bapp\.engine\.slice\('([a-z]+)'\)/g)].map((match) => match[1]);
    expect(slices.sort()).toEqual(['audit', 'security']);
  });

  it('no simulator action is called directly, the engine\'s state is not read, and no unit of work is opened here', () => {
    expect(occurrences(code, ENGINE_OTHER)).toEqual([]);
  });
});

describe('rule 4 (M5; spec §7.13): the folder changes no row and writes no file', () => {
  it('it holds no statement text that changes a row and uses no insert, update or delete of the query builder', () => {
    expect(occurrences(code, STATEMENT_TEXT)).toEqual([]);
    expect(occurrences(code, BUILDER_WRITE)).toEqual([]);
  });

  it('its two transactions of the query builder are the two list reads, both READ ONLY at REPEATABLE READ', () => {
    const reads = textOf(`${FOLDER}reads.ts`);
    expect(places(TRANSACTION)).toEqual([`${FOLDER}reads.ts`, `${FOLDER}reads.ts`]);
    expect(reads).toMatch(/const SNAPSHOT = \{ isolationLevel: 'repeatable read', accessMode: 'read only' \} as const;/);
    expect([...reads.matchAll(/\}, SNAPSHOT\);/g)]).toHaveLength(2);
  });

  it('its statements in text are those of the stored check: the snapshot, the head, the lookup of the remembered row; all read only', () => {
    const stored = textOf(`${FOLDER}stored-chain.ts`);
    expect(stored).toMatch(/const BEGIN_SNAPSHOT = 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY';/);
    expect(stored).toMatch(/const HEAD = 'SELECT seq, hash FROM public\.audit_chain_head';/);
    expect(stored).toMatch(/const POSITION_HOLDS = 'SELECT EXISTS \(SELECT 1 FROM public\.audit_log WHERE seq = \$1 AND hash = \$2\) AS holds';/);
    // Every text handed to `query`: the three constants, COMMIT and ROLLBACK. Only this file sends text.
    expect(places(RAW_QUERY).every((place) => place === `${FOLDER}stored-chain.ts`)).toBe(true);
    const sent = [...stored.matchAll(/\.query(?:<[^>]*>)?\(([^,)]+)/g)].map((match) => match[1]);
    expect(sent.sort()).toEqual(["'COMMIT'", "'ROLLBACK'", 'BEGIN_SNAPSHOT', 'HEAD', 'POSITION_HOLDS']);
  });

  it('the folder imports no file, path, process, stream or network module and serves no file', () => {
    expect(occurrences(code, FILES)).toEqual([]);
  });
});

describe('rule 5 (MR-1): one chain check, and it is not in this folder', () => {
  it('the folder holds no hash function, no digest and no chain check of its own', () => {
    expect(occurrences(code, OWN_CHECK)).toEqual([]);
    expect(occurrences(code, CHANCE)).toEqual([]);
  });

  it('it calls the stored-chain check of the schema with the digest check of the mapping module, once each', () => {
    const stored = textOf(`${FOLDER}stored-chain.ts`);
    expect(stored).toMatch(/import \{ verifyStoredAuditRows, type StoredDigestVerdict \} from '\.\.\/\.\.\/db\/mapping';/);
    expect(stored).toMatch(/import \{ checkStoredChain, type Queryable \} from '\.\.\/\.\.\/db\/schema\/boot-checks';/);
    expect([...stored.matchAll(/\bcheckStoredChain\(/g)]).toHaveLength(1);
    expect([...stored.matchAll(/\bverifyStoredAuditRows\(/g)]).toHaveLength(1);
    expect(count(/\bcheckStoredChain\b|\bverifyStoredAuditRows\b/g, code.filter((file) => file.path !== `${FOLDER}stored-chain.ts`))).toBe(0);
  });

  it('the row a client gets is built by the one mapping: the reads name no member of an audit row or an event beyond the keys and the filters', () => {
    expect(textOf(`${FOLDER}reads.ts`)).toMatch(/import \{ auditRowFromRow, eventFromRow \} from '\.\.\/\.\.\/db\/mapping';/);
    const members = new RegExp(`\\b(?:${['prev_hash', 'actor_id', 'session_id', 'evidence_id', 'device_id', 'details', 'params', 'prevHash', 'deviceId', 'message'].join('|')})\\b`, 'g');
    expect(occurrences(code.filter((file) => file.path === `${FOLDER}reads.ts`), members)).toEqual([]);
    // The stored check reads two members of the rows it is handed, for its bookkeeping: where the pass began and where it ended.
    const bookkeeping = [...textOf(`${FOLDER}stored-chain.ts`).matchAll(/\b(?:first|last)\.(seq|prevHash|hash)\b/g)].map((match) => match[0]);
    expect(bookkeeping.sort()).toEqual(['first.prevHash', 'first.seq', 'last.hash', 'last.seq']);
  });
});

describe('rule 6 (M2): routes come from the registry', () => {
  it('every route is built from its registry entry, in the order of the operations, and there is no other route', () => {
    const routes = [...textOf(`${FOLDER}index.ts`).matchAll(ROUTE)].map((match) => match[1]);
    expect(routes).toEqual([...SECURITY_AUDIT_MODULE_OPERATIONS]);
    expect(count(ANY_ROUTE)).toBe(SECURITY_AUDIT_MODULE_OPERATIONS.length);
  });
});

describe('rule 7 (M8): no clock, no chance, no environment', () => {
  it('no file reads a clock of any kind, sets a timer or draws a random number: every instant of an answer is a stored one', () => {
    expect(occurrences(code, SYSTEM_TIME)).toEqual([]);
    expect(occurrences(code, TIMER)).toEqual([]);
    expect(occurrences(code, CHANCE)).toEqual([]);
  });

  it('no console call, no raw URL, no header, no environment, no listener', () => {
    expect(occurrences(code, CONSOLE)).toEqual([]);
    expect(occurrences(code, RAW_URL)).toEqual([]);
    expect(occurrences(code, ENVIRONMENT)).toEqual([]);
  });

  it('what the folder imports is the contract, the simulator\'s types and constants, the query builder, and the server\'s own seams', () => {
    const imported = new Set<string>();
    for (const file of code) {
      for (const match of file.text.matchAll(/\bfrom\s+'([^']+)'/g)) if (match[1] !== undefined) imported.add(match[1]);
    }
    expect([...imported].sort()).toEqual([
      '../../db/mapping',
      '../../db/schema',
      '../../db/schema/boot-checks',
      '../../plugins/error-envelope',
      '../../plugins/logger',
      '../../plugins/permission-guard',
      './cursor',
      './export-request',
      './reads',
      './stored-chain',
      '@dems/shared/api',
      '@dems/shared/sim',
      'drizzle-orm',
      'drizzle-orm/node-postgres',
      'fastify',
      'fastify-type-provider-zod',
      'pg',
    ]);
  });
});

describe('rule 8 (SR-48, M14): the log', () => {
  it('every log call of the folder is in the stored check, has an object whose first key is a code, and a constant text', () => {
    expect(places(ANY_LOG_CALL).every((place) => place === `${FOLDER}stored-chain.ts`)).toBe(true);
    const calls = [...textOf(`${FOLDER}stored-chain.ts`).matchAll(LOG_CALL)];
    expect(calls).toHaveLength(count(ANY_LOG_CALL));
    expect(calls.map((match) => [match[1], match[3]])).toEqual([
      ['warn', 'LINEAGE_MISMATCH'],
      ['warn', 'VERDICT_UNREADABLE'],
      ['warn', 'POSITION_FORGOTTEN'],
      ['error', 'NOT_VERIFIED'],
    ]);
    for (const match of calls) expect(match[2]).toMatch(/^\{\s*code: '[A-Z_]+'/);
  });

  it('no log call carries an error, under any key: the folder logs sequence numbers, counts and codes', () => {
    for (const match of textOf(`${FOLDER}stored-chain.ts`).matchAll(LOG_CALL)) expect(ERROR_KEYS.test(match[2] ?? ''), match[2]).toBe(false);
    // The failure of a read is logged by the pool's helper, as `{ err }`: index.ts hands it the work, a name and the request.
    const reads = [...textOf(`${FOLDER}index.ts`).matchAll(/\bapp\.db\.read\('(securityAudit\.[A-Za-z]+)'/g)].map((match) => match[1]);
    expect(reads).toEqual([
      'securityAudit.getSecurityStatus',
      'securityAudit.listAuditRows',
      'securityAudit.verifyAuditChain',
      'securityAudit.verifyAuditChain',
      'securityAudit.listEvents',
    ]);
    // Each of the five passes its request, so that the helper's line carries the request ID (fix round B1, finding F-3).
    expect(textOf(`${FOLDER}index.ts`).match(/, request\);/g)).toHaveLength(5);
    expect(count(/\bapp\s*\.\s*db\s*\.\s*pool\b/g)).toBe(0);
  });

  it('an error\'s own message is never read', () => {
    expect(occurrences(code, new RegExp(`\\.\\s*${'message'}\\b`, 'g'))).toEqual([]);
  });
});
