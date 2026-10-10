// Static guards of the evidence module (plan row W35; decision D83 rules M2 to M5 and M8;
// spec §4.6, §8.2, §11; SR-48, SR-65, SR-66). They read the production sources of the folder as
// text, with the scaffold's scanner, and keep these rules true for every later row that touches
// it:
//
//   1. Who may call is stage 6, only: no file reads a member of the principal, names a
//      permission or a role, asks the session registry or the device registry, or adds a hook.
//   2. No denial row and no row at all: nothing here appends an audit row or an event, takes a
//      place in the denial budget, or names the two denial types.
//   3. A command is `app.engine.command(request.principal, <action>, …)` and nothing else: no
//      simulator action is called directly, the engine's state is not read, no unit is opened.
//   4. The folder writes no row: no statement text, no insert, update or delete of the query
//      builder; its one kind of transaction is read only.
//   5. Routes come from the registry: every route is built with `routeOfOperation`.
//   6. One clock and no chance, no environment, no console, no raw URL.
//   7. No file access and nothing outbound: a request value can never become a path (SR-66).
//   8. One log call, with a code and an operation ID.
//
// Every forbidden text is built from fragments, so that this file does not contain it.
import { describe, expect, it } from 'vitest';
import { WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, type SourceFile } from '../../../../test/static/scan';
import { hostedActionsOfOperation } from '../../../engine';
import { EVIDENCE_MODULE_OPERATIONS } from '../index';

const FOLDER = 'src/modules/evidence/';

const all = readTree(WORKSPACE).filter((file) => isProductionSource(file.path) && file.path.startsWith(FOLDER));
const code = codeOnly(all);
const count = (pattern: RegExp, where: readonly SourceFile[] = code): number => occurrences(where, pattern).length;
const textOf = (path: string): string => code.find((file) => file.path === path)?.text ?? '';

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
const ENGINE_COMMAND = new RegExp(`\\bapp\\s*\\.\\s*engine\\s*\\.\\s*${'command'}\\s*\\(\\s*request\\s*\\.\\s*principal\\s*,\\s*'([A-Za-z]+)'`, 'g');
const ENGINE_ANY = new RegExp(`\\bengine\\s*\\.\\s*[A-Za-z]+`, 'g');
const ENGINE_OTHER = new RegExp(
  [`\\.\\s*${'actions'}\\s*\\.`, `\\b${join('engine', 'Control')}\\b`, `\\.\\s*${'simulator'}\\s*\\(`, `\\.\\s*${'pending'}\\s*\\(`, `\\bengine\\s*\\.\\s*(?:run|state|slice|start|stop|reload)\\s*\\(`, `\\b${'pipeline'}\\b`, `\\bcreate${'Sim'}\\b`].join('|'),
  'g',
);
// 4. Writes.
const STATEMENT_TEXT = new RegExp(`\\b(?:${['INSERT\\s+INTO', 'UPDATE\\s+\\w+\\s+SET', 'DELETE\\s+FROM', 'TRUNCATE', 'ALTER\\s+TABLE', 'DROP\\s+TABLE'].join('|')})\\b`, 'gi');
const BUILDER_WRITE = new RegExp(`\\.\\s*(?:${['insert', 'update', 'delete', 'execute'].join('|')})\\s*\\(`, 'g');
const TRANSACTION = new RegExp(`\\.\\s*${'transaction'}\\s*\\(`, 'g');
// 5. Routes.
const ROUTE = new RegExp(`\\broutes\\s*\\.\\s*route\\s*\\(\\s*\\{\\s*\\.\\.\\.${join('routeOf', 'Operation')}\\(operations\\.([A-Za-z]+)\\)`, 'g');
const ANY_ROUTE = new RegExp(`\\.\\s*(?:route|get|post|put|patch|delete|head|options|all)\\s*\\(\\s*(?:\\{|['"\`])`, 'g');
// 6. Time, chance, environment.
const SYSTEM_TIME = new RegExp([`\\bDate\\s*\\.\\s*${'now'}\\s*\\(`, `\\bnew\\s+Date\\s*\\(`, `\\bperformance\\s*\\.\\s*${'now'}\\b`, `\\bhr${'time'}\\b`].join('|'), 'g');
const TIMER = new RegExp(`\\bset(?:${'Timeout'}|${'Interval'}|${'Immediate'})\\s*\\(`, 'g');
const CHANCE = new RegExp(`['"]node:${'crypto'}['"]|\\bMath\\s*\\.\\s*${'random'}\\b|\\brandom${'UUID'}\\b`, 'g');
const CONSOLE = new RegExp(`\\b${'console'}\\s*\\.`, 'g');
const RAW_URL = new RegExp(`\\brequest\\s*\\.\\s*(?:raw\\s*\\.\\s*)?${'url'}\\b|\\boriginal${'Url'}\\b|\\brequest\\s*\\.\\s*${'headers'}\\b`, 'g');
const ENVIRONMENT = new RegExp(`\\bprocess\\s*\\.\\s*${'env'}\\b|\\.\\s*${'listen'}\\s*\\(`, 'g');
// 7. Files and the network.
const FILES = new RegExp(
  [`['"]node:(?:${['fs', 'fs/promises', 'path', 'child_process', 'http', 'https', 'net', 'stream'].join('|')})['"]`, `\\b${join('send', 'File')}\\b`, `\\bcreate${join('Read', 'Stream')}\\b`, `${join('@fastify/', 'static')}`, `\\b${'fetch'}\\s*\\(`, `\\b${join('read', 'File')}`].join('|'),
  'g',
);
// 8. The log.
const LOG_CALL = new RegExp(`\\blog\\s*\\.\\s*(?:trace|debug|info|warn|error|fatal)\\s*\\(\\s*(\\{[^}]*\\})`, 'g');

describe('the scan itself', () => {
  it('reads the production sources of the folder', () => {
    expect(all.map((file) => file.path)).toEqual([
      'src/modules/evidence/cursor.ts',
      'src/modules/evidence/export-request.ts',
      'src/modules/evidence/index.ts',
      'src/modules/evidence/media.ts',
      'src/modules/evidence/reads.ts',
      'src/modules/evidence/real-verification.ts',
    ]);
  });

  it('finds each forbidden text when it is present (positive control)', () => {
    const planted: SourceFile[] = [
      { path: 'a.ts', text: `if (request.${'principal'}.kind !== 'OPERATOR') throw x; if (!request.${'principal'}?.${join('permis', 'sions')}.includes(${join('Permis', 'sion')}.EVIDENCE_VIEW)) throw y; const r = operator.${'role'};` },
      { path: 'b.ts', text: `routes.route({ ...r, ${'onRequest'}: guard, ${'preHandler'}: [check] }); app.${join('add', 'Hook')}('onRequest', guard);` },
      { path: 'c.ts', text: `await app.${join('denial', 'Budget')}.consume(request); await unit.${'audit'}.${'append'}({ type: '${join('EXPORT', '_DENIED')}' }); await unit.${'events'}.${'append'}(e);` },
      { path: 'd.ts', text: `sim.${'actions'}.verify(id); ${join('engine', 'Control')}(app).${'simulator'}(); app.engine.state(); app.engine.run('x', work); await app.${'pipeline'}.run('y', work);` },
      { path: 'e.ts', text: `await tx.${'insert'}(t).values(v); await tx.${'update'}(t).set(v); await tx.${'delete'}(t); await pool.query('UPDATE evidence_items SET status = $1'); await pool.query('insert into evidence_custody (seq) values ($1)');` },
      { path: 'f.ts', text: `const t = Date.${'now'}(); set${'Timeout'}(f, 1); Math.${'random'}(); ${'console'}.log(request.${'url'}, process.${'env'}.X, request.${'headers'}.host);` },
      { path: 'g.ts', text: `import { ${join('read', 'File')}Sync } from 'node:${'fs'}'; reply.${join('send', 'File')}(request.params.id); ${join('create', 'Read', 'Stream')}(path); await ${'fetch'}(url);` },
      { path: 'h.ts', text: `app.get('/api/v1/evidence/:id/media', handler); app.route({ method: 'GET', url: '/x' });` },
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
    }).toEqual({
      principalMember: 2,
      accessWords: 3,
      hooks: 4,
      denial: 4,
      engineOther: 6,
      builderWrite: 3,
      statementText: 2,
      systemTime: 1,
      timer: 1,
      chance: 1,
      console: 1,
      rawUrl: 2,
      environment: 1,
      files: 5,
      anyRoute: 3,
      registryRoute: 0,
    });
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

describe('rule 3 (M4): a command is one call of the engine host', () => {
  it('the three commands call app.engine.command with request.principal and the hosted action of their operation', () => {
    const commands = [...textOf(`${FOLDER}index.ts`).matchAll(ENGINE_COMMAND)].map((match) => match[1]);
    expect(commands).toEqual(['verify', 'exportEvidence', 'archiveEvidence']);
    const hosted = EVIDENCE_MODULE_OPERATIONS.flatMap((operationId) => hostedActionsOfOperation(operationId));
    expect(commands).toEqual(hosted);
    // Nothing else of the engine is used, anywhere in the folder.
    expect(count(ENGINE_ANY)).toBe(commands.length);
    expect(occurrences(code, ENGINE_ANY).every((place) => place.startsWith(`${FOLDER}index.ts:`))).toBe(true);
  });

  it('no simulator action is called directly, the engine\'s state is not read, and no unit of work is opened here', () => {
    expect(occurrences(code, ENGINE_OTHER)).toEqual([]);
  });
});

describe('rule 3a (task 3 row 85): operation 41 asks the provided verification first, and verifies nothing itself', () => {
  it('the handler of verifyEvidence awaits the provided verification before the hosted action, with the principal whole', () => {
    const index = textOf(`${FOLDER}index.ts`);
    const asks = index.indexOf('realVerification.current()?.verify(request.principal, request.params.id)');
    const hosted = index.indexOf("app.engine.command(request.principal, 'verify', request.params.id)");
    expect(asks).toBeGreaterThan(0);
    expect(hosted).toBeGreaterThan(asks);
    expect(index.slice(asks, hosted)).toMatch(/if \(real !== null\) return real;/);
    // One place asks, and the control is the app's own.
    expect(index.match(/realVerification\./g)).toHaveLength(1);
    expect(index).toMatch(/const realVerification = evidenceVerification\(app\);/);
  });

  it('the seam file holds a type and a registry: it imports types only, and no package or signer code is named in the folder', () => {
    const seam = textOf(`${FOLDER}real-verification.ts`);
    expect([...seam.matchAll(/^import\s+(type\s+)?/gm)].map((match) => match[1]?.trim())).toEqual(['type', 'type']);
    expect(code.filter((file) => /evidence-verify|evidence-package|verifyPackageV2|credential-store|capture\/signer/.test(file.text)).map((file) => file.path)).toEqual([]);
  });
});

describe('rule 4 (M5): the folder changes no row', () => {
  it('it holds no statement text that changes a row and uses no insert, update or delete of the query builder', () => {
    expect(occurrences(code, STATEMENT_TEXT)).toEqual([]);
    expect(occurrences(code, BUILDER_WRITE)).toEqual([]);
  });

  it('its two transactions are the two reads, and both are opened READ ONLY at REPEATABLE READ', () => {
    const reads = textOf(`${FOLDER}reads.ts`);
    expect(occurrences(code, TRANSACTION).map((place) => place.replace(/:\d+$/, ''))).toEqual([`${FOLDER}reads.ts`, `${FOLDER}reads.ts`]);
    expect(reads).toMatch(/const SNAPSHOT = \{ isolationLevel: 'repeatable read', accessMode: 'read only' \} as const;/);
    // Each transaction is closed with that option object.
    expect([...reads.matchAll(/\}, SNAPSHOT\);/g)]).toHaveLength(2);
  });

  it('the row-to-item mapping is the one mapping module\'s: the folder builds no item from columns itself', () => {
    expect(textOf(`${FOLDER}reads.ts`)).toMatch(/import \{ evidenceItemFromRows \} from '\.\.\/\.\.\/db\/mapping';/);
    const columns = new RegExp(`\\b(?:${['manifestHash', 'signatureValue', 'signatureKeyId', 'sha256', 'manifest_hash', 'signature_value'].join('|')})\\b`, 'g');
    expect(occurrences(code, columns)).toEqual([]);
  });
});

describe('rule 5 (M2): routes come from the registry', () => {
  it('every route is built from its registry entry, in the order of the operations, and there is no other route', () => {
    const routes = [...textOf(`${FOLDER}index.ts`).matchAll(ROUTE)].map((match) => match[1]);
    expect(routes).toEqual([...EVIDENCE_MODULE_OPERATIONS]);
    expect(count(ANY_ROUTE)).toBe(EVIDENCE_MODULE_OPERATIONS.length);
  });
});

describe('rule 6 (M8): one clock, no chance, no environment', () => {
  it('no file reads the system time, sets a timer or draws a random number', () => {
    expect(occurrences(code, SYSTEM_TIME)).toEqual([]);
    expect(occurrences(code, TIMER)).toEqual([]);
    expect(occurrences(code, CHANCE)).toEqual([]);
  });

  it('no console call, no raw URL, no header, no environment, no listener', () => {
    expect(occurrences(code, CONSOLE)).toEqual([]);
    expect(occurrences(code, RAW_URL)).toEqual([]);
    expect(occurrences(code, ENVIRONMENT)).toEqual([]);
  });
});

describe('rule 7 (SR-66, MS-1 to MS-4): no file is read, sent or fetched', () => {
  it('the folder imports no file, path, process, stream or network module and serves no static file', () => {
    expect(occurrences(code, FILES)).toEqual([]);
  });

  it('what it imports is the contract, the simulator\'s types and join, the query builder, and the server\'s own seams', () => {
    const imported = new Set<string>();
    for (const file of code) {
      for (const match of file.text.matchAll(/\bfrom\s+'([^']+)'/g)) if (match[1] !== undefined) imported.add(match[1]);
    }
    expect([...imported].sort()).toEqual([
      '../../db/mapping',
      '../../db/schema',
      '../../engine',
      // Task 3 row 91: the seam of operation 42 to the export jobs (`evidenceExport(app)`, the kind of a body, one text). The module itself still opens no file.
      '../../evidence-export',
      '../../plugins/error-envelope',
      '../../plugins/permission-guard',
      './cursor',
      './export-request',
      './media',
      './reads',
      './real-verification',
      '@dems/shared/api',
      '@dems/shared/demo-data',
      '@dems/shared/sim',
      'drizzle-orm',
      'drizzle-orm/node-postgres',
      'drizzle-orm/pg-core',
      'fastify',
      'fastify-type-provider-zod',
      'pg',
      'zod',
    ]);
  });
});

describe('rule 8 (SR-48): the log', () => {
  it('the folder has no log call of its own: a failed read is logged by the pool plugin\'s helper, which gets the work, a name and the request', () => {
    const calls = code.flatMap((file) => [...file.text.matchAll(LOG_CALL)].map((match) => match[1] ?? ''));
    expect(calls).toHaveLength(0);
    const index = textOf(`${FOLDER}index.ts`);
    expect(index.match(/\bapp\.db\.read\(/g)).toHaveLength(1);
    expect(index).toMatch(/await app\.db\.read\(\s*`evidence\.\$\{operationId\}`,/);
    expect(index).not.toMatch(/\bapp\s*\.\s*db\s*\.\s*(?:pool|probe)\b/);
  });

  it('an error\'s own message is never read', () => {
    expect(occurrences(code, new RegExp(`\\.\\s*${'message'}\\b`, 'g'))).toEqual([]);
  });
});
