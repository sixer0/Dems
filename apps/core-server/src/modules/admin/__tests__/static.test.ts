// Static guards of the administration module (plan row W33; standing rules M2, M3, M5, M8 of the
// module rows). They read the production sources of this folder as text, with the scaffold's
// scanner, and keep these rules true for every later row that touches them:
//
//   1. One clock, no timer: every instant is `app.clock` (ENG-13).
//   2. Who may call is stage 6, only (M3): the module checks no permission, no role, no session
//      and no device, writes no denial row, and puts no hook on a route. The caller is read in
//      one place, for the actor of a row.
//   3. Routes come from the registry (M2): every route is built with `routeOfOperation`.
//   4. One unit per change, one audit path, publications after the commit (M5); the engine's
//      mirror is asked for outside any unit.
//   5. The statements: constant texts with bind parameters, every table with its schema, writes
//      only where the privilege matrix grants them, every transition compare-and-set.
//   6. No password handling: the folder names no credential table and no secret column.
//   7. The module reaches other folders only through the seams and the plugins.
//
// Every forbidden text is built from fragments, so that this file does not contain it.
import { describe, expect, it } from 'vitest';
import { WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, type SourceFile } from '../../../../test/static/scan';
import * as statements from '../statements';

const FOLDER = 'src/modules/admin/';

const own = readTree(WORKSPACE).filter((file) => isProductionSource(file.path) && file.path.startsWith(FOLDER));
const code = codeOnly(own);
const textOf = (name: string): string => code.find((file) => file.path === `${FOLDER}${name}`)?.text ?? '';
const places = (pattern: RegExp, where: readonly SourceFile[] = code): string[] => occurrences(where, pattern);
const files = (pattern: RegExp, where: readonly SourceFile[] = code): string[] => [...new Set(places(pattern, where).map((place) => place.replace(/:\d+$/, '')))];
const count = (text: string, pattern: RegExp): number => text.match(pattern)?.length ?? 0;

const SYSTEM_TIME = new RegExp([`\\bDate\\s*\\.\\s*${'now'}\\s*\\(`, `\\bnew\\s+Date\\s*\\(`, `\\bperformance\\s*\\.\\s*${'now'}\\b`, `\\bhr${'time'}\\b`].join('|'), 'g');
const TIMER = new RegExp(`\\bset(?:${'Timeout'}|${'Interval'}|${'Immediate'})\\s*\\(`, 'g');
const CONSOLE = new RegExp(`\\b${'console'}\\s*\\.`, 'g');
const ENVIRONMENT = new RegExp(`\\bprocess\\s*\\.\\s*${'env'}\\b|\\.\\s*${'listen'}\\s*\\(`, 'g');
const REQUEST_TRANSPORT = new RegExp(`\\brequest\\s*\\.\\s*(?:${'headers'}|${'cookies'}|${'query'}|raw|${'url'}|original${'Url'}|ip|hostname)\\b`, 'g');
const COOKIE_WRITE = new RegExp(`\\.\\s*(?:set|clear)${'Cookie'}\\s*\\(|['"\`]set-${'cookie'}['"\`]`, 'gi');
const OWN_AUDIT_INSERT = new RegExp(`\\binsert\\s+into\\s+(?:public\\s*\\.\\s*)?(?:${['audit', 'log'].join('_')}|events)\\b`, 'gi');
const SLOT_REPLACED = new RegExp(`\\b(?:stages|seams)\\s*\\.\\s*${'replace'}\\s*\\(`, 'g');
/** A check of the caller: a permission or a role read off the principal, or a test of a permission list. */
const CALLER_CHECK = new RegExp(
  [`\\b${'permissions'}\\s*\\.\\s*(?:includes|some|every|has)\\b`, `\\bprincipal\\s*\\.\\s*(?:${'permissions'}|${'role'}|${'sessionId'})\\b`, `\\b${'role'}Has\\b`, `\\boperatorSession${'Of'}\\b`, `\\bauthentication${'Of'}\\b`].join('|'),
  'g',
);
const PERMISSION_NAME = new RegExp(`\\bPermission\\s*\\.\\s*[A-Z_]+\\b`, 'g');
const DENIAL = new RegExp(`\\b(?:${['ACCESS', 'DENIED'].join('_')}|${['EXPORT', 'DENIED'].join('_')})\\b|\\bdenial${'Budget'}\\b`, 'g');
const ROUTE_HOOK = new RegExp(`\\b(?:on${'Request'}|pre${'Parsing'}|pre${'Validation'}|pre${'Handler'})\\s*:|\\baddHook\\s*\\(`, 'g');
const ROUTE_REGISTRATION = new RegExp(`\\.\\s*${'route'}\\s*\\(|\\.\\s*(?:get|post|put|patch|delete|head|options|all)\\s*\\(\\s*(?:['"\`]\\/|[A-Z][A-Z0-9_]*\\s*,)`, 'g');
const SECRET_STORE = new RegExp([`${['operator', 'credentials'].join('_')}`, `${['token', 'hash'].join('_')}`, `\\b${'password'}`, `\\bcode_${'hash'}\\b`, `\\bcurrent_${'hash'}\\b`, `\\b${'salt'}\\b`].join('|'), 'gi');
const SQL = /['"`](?:SELECT|INSERT|UPDATE|DELETE)\s/g;

describe('the scan itself', () => {
  it('reads the production sources of the folder', () => {
    expect(own.map((file) => file.path)).toEqual([`${FOLDER}changes.ts`, `${FOLDER}index.ts`, `${FOLDER}rule.ts`, `${FOLDER}statements.ts`]);
  });

  it('finds each forbidden text when it is present (positive control)', () => {
    const sample: SourceFile[] = [
      {
        path: 'src/sample.ts',
        text: [
          `const a = Date.${'now'}();`,
          `set${'Timeout'}(() => {}, 1);`,
          `${'console'}.log(1);`,
          `const b = process.${'env'}.X;`,
          `const c = request.${'headers'}.authorization;`,
          `reply.set${'Cookie'}('a', 'b');`,
          `await unit.query('insert into public.${['audit', 'log'].join('_')} values ($1)');`,
          `app.seams.${'replace'}('publish', () => {});`,
          `if (granted.${'permissions'}.includes(Permission.USER_ADMIN)) run();`,
          `if (principal.${'role'} === 'SUPERVISOR') run();`,
          `const session = operatorSession${'Of'}(request);`,
          `type: '${['ACCESS', 'DENIED'].join('_')}'`,
          `await app.denial${'Budget'}.consume(request);`,
          `routes.route({ on${'Request'}: check, handler });`,
          `app.get('/api/v1/late', handler);`,
          `'SELECT hash FROM public.${['operator', 'credentials'].join('_')}'`,
        ].join('\n'),
      },
    ];
    const hits = (pattern: RegExp): number => occurrences(sample, pattern).length;
    expect([SYSTEM_TIME, TIMER, CONSOLE, ENVIRONMENT, REQUEST_TRANSPORT, COOKIE_WRITE, OWN_AUDIT_INSERT, SLOT_REPLACED].map(hits)).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
    expect(hits(CALLER_CHECK)).toBe(3);
    expect(hits(PERMISSION_NAME)).toBe(1);
    expect(hits(DENIAL)).toBe(2);
    expect(hits(ROUTE_HOOK)).toBe(1);
    expect(hits(ROUTE_REGISTRATION)).toBe(2);
    expect(hits(SECRET_STORE)).toBe(1);
    expect(hits(SQL)).toBe(1);
  });
});

describe('rule 1: one clock', () => {
  it('no file reads the system time or starts a timer; every instant is app.clock, read once per unit', () => {
    expect(places(SYSTEM_TIME)).toEqual([]);
    expect(places(TIMER)).toEqual([]);
    expect(files(/\bapp\s*\.\s*clock\s*\.\s*now\s*\(/g)).toEqual([`${FOLDER}changes.ts`]);
    expect(count(textOf('changes.ts'), /\bapp\.clock\.now\(\)/g)).toBe(3);
  });

  it('writes nothing to the console, reads no environment, never listens, replaces no stage and no seam', () => {
    expect(places(CONSOLE)).toEqual([]);
    expect(places(ENVIRONMENT)).toEqual([]);
    expect(places(SLOT_REPLACED)).toEqual([]);
  });
});

describe('rule 2 (M3): who may call is stage 6, only', () => {
  it('no file checks a permission, a role or a session of the caller', () => {
    expect(places(CALLER_CHECK)).toEqual([]);
  });

  it('the caller is read in one place, for the actor of a row: the operator and the device of the session, and nothing else', () => {
    expect(files(/\brequest\s*\.\s*principal\b|\{\s*principal\s*\}\s*=\s*request\b/g)).toEqual([`${FOLDER}index.ts`]);
    const index = textOf('index.ts');
    expect(count(index, /\{\s*principal\s*\}\s*=\s*request\b/g)).toBe(1);
    expect(index.match(/\bprincipal\s*\.\s*[A-Za-z]+/g)).toEqual(['principal.kind', 'principal.operatorId', 'principal.deviceId']);
    // The one refusal there is the backstop of a caller that is no operator; it reads no rule.
    expect(index).toMatch(/if \(principal\.kind !== 'OPERATOR'\) throw notSignedIn\(\);\s*return \{ operatorId: principal\.operatorId, deviceId: principal\.deviceId \};/);
  });

  it('a permission is named once, as data of the last-administrator rule, and never compared with the caller', () => {
    expect(places(PERMISSION_NAME)).toHaveLength(1);
    expect(files(PERMISSION_NAME)).toEqual([`${FOLDER}changes.ts`]);
    const changes = textOf('changes.ts');
    expect(changes).toMatch(/export const ADMINISTRATION_PERMISSION = Permission\.USER_ADMIN;/);
    // It goes into the statement that reads which roles hold it, and nowhere else.
    expect(changes.match(/\bADMINISTRATION_PERMISSION\b/g)).toHaveLength(3);
    expect(count(changes, /readRolesHolding\(unit, ADMINISTRATION_PERMISSION\)/g)).toBe(2);
  });

  it('writes no denial row and takes no place in the denial budget: neither of its refusals is audited', () => {
    expect(places(DENIAL)).toEqual([]);
  });

  it('puts no hook on a route and adds none to the app', () => {
    expect(places(ROUTE_HOOK)).toEqual([]);
  });
});

describe('rule 3 (M2): routes come from the registry', () => {
  it('four routes, each built from its registry entry, registered in index.ts and nowhere else', () => {
    expect(files(ROUTE_REGISTRATION)).toEqual([`${FOLDER}index.ts`]);
    const index = textOf('index.ts');
    expect(count(index, /\broutes\.route\(\{\s*\.\.\.routeOfOperation\(/g)).toBe(4);
    expect(places(ROUTE_REGISTRATION)).toHaveLength(4);
    // No path is written in the module: method and path are the registry's.
    expect(places(/['"`]\/api\//g)).toEqual([]);
  });

  it('every schema is the contract\'s: the module declares no body or response schema of its own', () => {
    const index = textOf('index.ts');
    expect(index.match(/\b(?:AdminUserListSchema|AdminUserSchema|UserRoleRequestSchema|UserStatusRequestSchema)\b/g)?.length).toBe(4 + 7);
    // Its one own schema is the path parameter, built from the registry's pattern.
    expect(index.match(/\bz\.object\(/g)).toHaveLength(1);
    expect(index).toMatch(/z\.object\(\{ id: z\.string\(\)\.regex\(operation\.pathParam\.pattern\) \}\)/);
  });
});

describe('rule 4 (M5): one unit per change, one audit path, publications after the commit', () => {
  const changes = textOf('changes.ts');

  it('three units, one per write operation, each with one audit row; no event (spec §13.1: audit-only)', () => {
    expect(files(/\bapp\s*\.\s*pipeline\s*\.\s*run\s*\(/g)).toEqual([`${FOLDER}changes.ts`]);
    expect(count(changes, /\bapp\.pipeline\.run\(ADMIN_UNIT_LABEL\.(?:assignUserRole|enableUser|disableUser),/g)).toBe(3);
    expect(count(changes, /\bunit\.audit\.append\(/g)).toBe(3);
    expect(changes.match(/type: '(ROLE_CHANGED|USER_DISABLED|USER_ENABLED)'/g)).toEqual(["type: 'ROLE_CHANGED'", "type: 'USER_DISABLED'", "type: 'USER_ENABLED'"]);
    expect(places(/\bunit\s*\.\s*events\b|\bevents\s*\.\s*append\b/g)).toEqual([]);
    expect(places(OWN_AUDIT_INSERT)).toEqual([]);
  });

  it('the actor of every row is the caller\'s session, and no row carries a time or a request field', () => {
    expect(count(changes, /actorId: actor\.operatorId,\s*deviceId: actor\.deviceId,/g)).toBe(3);
    expect(places(/\bat\s*:/g, [{ path: 'changes.ts', text: changes }])).toEqual([]);
  });

  it('every publication is inside unit.afterCommit, and there are five: two for a role change, two for a disable, one for an enable', () => {
    expect(files(/\bapp\s*\.\s*publish\s*\(/g)).toEqual([`${FOLDER}changes.ts`]);
    expect(count(changes, /\bapp\.publish\(/g)).toBe(5);
    const blocks = [...changes.matchAll(/unit\.afterCommit\(\(\) => \{([\s\S]*?)\n {4}\}\);/g)].map((match) => match[1] ?? '');
    expect(blocks).toHaveLength(3);
    expect(blocks.map((block) => count(block, /\bapp\.publish\(/g))).toEqual([2, 2, 1]);
    expect(blocks.map((block) => block.match(/kind: '([a-z.]+)'/g))).toEqual([
      ["kind: 'session.updated'", "kind: 'admin.changed'"],
      ["kind: 'session.ended'", "kind: 'admin.changed'"],
      ["kind: 'admin.changed'"],
    ]);
  });

  it('a disable ends the sessions through the seam, inside its unit, with the reason USER_DISABLED', () => {
    expect(count(changes, /await app\.sessionRegistry\.endForOperator\(unit, operatorId, 'USER_DISABLED'\)/g)).toBe(1);
    // The module itself has no statement that changes a session row.
    expect(places(/\bUPDATE\s+public\.auth_sessions\b/g)).toEqual([]);
  });

  it('the engine is asked to mirror the operators in one place, outside any unit, and the module runs no hosted action', () => {
    expect(files(/\bapp\s*\.\s*engine\s*\.\s*mirrorOperators\s*\(/g)).toEqual([`${FOLDER}index.ts`]);
    expect(count(textOf('index.ts'), /\bapp\.engine\.mirrorOperators\(\)/g)).toBe(1);
    expect(changes).not.toMatch(/\bapp\s*\.\s*engine\b/);
    expect(places(/\bengine\s*\.\s*(?:command|run|state|slice)\s*\(/g)).toEqual([]);
    // The two headers of API-7 are the engine unit's (`src/engine/api-headers.ts`, decision D87): the folder sets neither.
    expect(places(/_HEADER_NAME\b|\.header\s*\(|\bapp\s*\.\s*engine\s*\.\s*(?:epoch|revision)\b/g)).toEqual([]);
  });

  it('a refusal throws inside the unit, so the unit rolls back: the two refusals are built in one place each', () => {
    expect(count(changes, /throw unknownOperator\(\)/g)).toBe(3);
    expect(count(changes, /throw lastAdministrator\(\)/g)).toBe(2);
    expect(changes).toMatch(/new ApiFailure\(404, ApiErrorCode\.NOT_FOUND,/);
    expect(changes).toMatch(/new ApiFailure\(409, ApiErrorCode\.LAST_ADMIN,/);
    // The rule is asked before the write, on the rows read under the lock.
    for (const unit of changes.split('export function ').slice(1)) {
      const rule = unit.indexOf('leavesNoAdministrator(');
      if (rule === -1) continue;
      expect(unit.indexOf('lockOperators(unit)')).toBeGreaterThan(0);
      expect(rule).toBeGreaterThan(unit.indexOf('lockOperators(unit)'));
      expect(unit.search(/await (?:assignRole|disableOperator)\(unit/)).toBeGreaterThan(rule);
    }
  });
});

describe('rule 5: the statements', () => {
  const list = Object.entries(statements).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  const byName = Object.fromEntries(list);

  it('are constant texts: every exported statement of the store is listed here', () => {
    expect(list.map(([name]) => name).sort()).toEqual([
      'ASSIGN_ROLE',
      'DISABLE_OPERATOR',
      'ENABLE_OPERATOR',
      'LIST_USERS',
      'LOCK_OPERATOR',
      'LOCK_OPERATORS',
      'READ_ROLES_HOLDING',
      'READ_ROLE_PERMISSIONS',
      'READ_USER',
    ]);
  });

  it('no statement is written outside the store', () => {
    expect(files(SQL)).toEqual([`${FOLDER}statements.ts`]);
  });

  it('name every table with its schema, and hold no value: only bind parameters', () => {
    for (const [name, text] of list) {
      const tables = [...text.matchAll(/\b(?:FROM|JOIN|UPDATE|INTO)\s+([a-z_.]+)/g)].map((match) => match[1]);
      expect(tables.length, name).toBeGreaterThan(0);
      expect(tables.filter((table) => !table?.startsWith('public.')), name).toEqual([]);
      // A quoted literal in a statement is one of the fixed words of the schema, never data.
      const literals = [...text.matchAll(/'([^']*)'/g)].map((match) => match[1]);
      expect(literals.filter((word) => word !== 'USER_DISABLED'), name).toEqual([]);
      expect(text, name).not.toMatch(/\$\{/);
    }
    for (const name of ['READ_USER', 'LOCK_OPERATOR', 'READ_ROLES_HOLDING', 'ASSIGN_ROLE', 'DISABLE_OPERATOR', 'ENABLE_OPERATOR', 'READ_ROLE_PERMISSIONS']) {
      expect(byName[name], name).toMatch(/\$1\b/);
    }
  });

  it('the module writes one table with its own statements, operators, by UPDATE only; the biometric tokens are revoked by the one function of identity/biometric (decision D105)', () => {
    const named = new Set(list.flatMap(([, text]) => [...text.matchAll(/\bpublic\.([a-z_]+)/g)].map((match) => match[1])));
    expect([...named].sort()).toEqual(['auth_sessions', 'operators', 'permissions', 'role_permissions']);
    expect(list.filter(([, text]) => /\b(?:INSERT|DELETE|TRUNCATE)\b/.test(text)).map(([name]) => name)).toEqual([]);
    const written = list.filter(([, text]) => text.startsWith('UPDATE ')).map(([name, text]) => `${name} ${/^UPDATE (public\.[a-z_]+)/.exec(text)?.[1]}`);
    expect(written.sort()).toEqual([
      'ASSIGN_ROLE public.operators',
      'DISABLE_OPERATOR public.operators',
      'ENABLE_OPERATOR public.operators',
    ]);
  });

  it('an UPDATE sets only columns the privilege matrix grants the runtime role (database contract §7.3)', () => {
    const granted: Record<string, readonly string[]> = {
      'public.operators': ['role_id', 'enabled', 'last_sign_in_at', 'role_changed_at', 'updated_at'],
      'public.biometric_tokens': ['used_at', 'revoked_at', 'revoke_reason'],
    };
    for (const [name, text] of list) {
      const match = /^UPDATE (public\.[a-z_]+) SET (.*?) WHERE /.exec(text);
      if (match === null) continue;
      const columns = (match[2] ?? '').split(',').map((part) => part.trim().split(/\s*=/)[0] ?? '');
      expect(columns.filter((column) => !granted[match[1] ?? '']?.includes(column)), name).toEqual([]);
    }
    expect(/ SET (.*?) WHERE /.exec(byName['ASSIGN_ROLE'] ?? '')?.[1]).toBe('role_id = $2, role_changed_at = $3, updated_at = $3');
  });

  it('every transition is compare-and-set: the WHERE states the expected state and the returned row decides (AT-3)', () => {
    expect(byName['ASSIGN_ROLE']).toMatch(/WHERE id = \$1 AND role_id = \$4 RETURNING id$/);
    expect(byName['DISABLE_OPERATOR']).toMatch(/SET enabled = false, updated_at = \$2 WHERE id = \$1 AND enabled RETURNING id$/);
    expect(byName['ENABLE_OPERATOR']).toMatch(/SET enabled = true, updated_at = \$2 WHERE id = \$1 AND NOT enabled RETURNING id$/);
  });

  it('the lock point of RB-8 is every operator row, in key order, FOR UPDATE (AT-C5); an enable locks its one row', () => {
    expect(byName['LOCK_OPERATORS']).toBe('SELECT id, role_id, enabled FROM public.operators ORDER BY id FOR UPDATE');
    expect(byName['LOCK_OPERATOR']).toBe('SELECT id, role_id, enabled FROM public.operators WHERE id = $1 FOR UPDATE');
    expect(byName['READ_ROLES_HOLDING']).toBe('SELECT role_id FROM public.role_permissions WHERE permission_id = $1');
    // No other statement takes a row lock, and none takes a table lock.
    expect(list.filter(([, text]) => /\bFOR (?:UPDATE|SHARE|NO KEY UPDATE|KEY SHARE)\b/.test(text)).map(([name]) => name).sort()).toEqual(['LOCK_OPERATOR', 'LOCK_OPERATORS']);
    expect(list.filter(([, text]) => /\bLOCK TABLE\b/i.test(text))).toEqual([]);
  });

  it('the list and the single read select the same columns, and the list is in operator ID order', () => {
    expect(byName['LIST_USERS']).toMatch(/ FROM public\.operators o ORDER BY o\.id$/);
    expect(byName['READ_USER']).toMatch(/ FROM public\.operators o WHERE o\.id = \$1$/);
    expect(byName['LIST_USERS']?.replace(/ ORDER BY o\.id$/, '')).toBe(byName['READ_USER']?.replace(/ WHERE o\.id = \$1$/, ''));
    expect(byName['LIST_USERS']).toMatch(/s\.ended_at IS NULL\) AS active_sessions/);
  });
});

describe('rule 6: no password handling, no secret', () => {
  it('the folder names no credential table, no hash column and no password', () => {
    expect(places(SECRET_STORE)).toEqual([]);
  });

  it('writes no cookie and reads no header, cookie, query string or raw URL of a request', () => {
    expect(places(COOKIE_WRITE)).toEqual([]);
    expect(places(REQUEST_TRANSPORT)).toEqual([]);
  });

  it('reads the body and the path parameter in index.ts only, and a reason reaches a row only through the credential-form check', () => {
    expect(files(/\brequest\s*\.\s*(?:body|params)\b/g)).toEqual([`${FOLDER}index.ts`]);
    const index = textOf('index.ts');
    expect(count(index, /\brequest\.body\.reason\b/g)).toBe(3);
    expect(count(index, /reasonOf\(request\.body\.reason\)/g)).toBe(3);
    expect(index).toMatch(/if \(looksLikeSecret\(reason\)\) throw invalidInput\('body'\);/);
  });

  it('M14: every log call carries a code and a source, or the error under the key err; never an error under another key, never a spread, never its message', () => {
    const calls = code.flatMap((file) => [...file.text.matchAll(/\blog\s*\.\s*(?:trace|debug|info|warn|error|fatal)\(\s*(\{[^}]*\})?/g)].map((match) => match[1] ?? '{}'));
    // One: the mirror that failed. The failed read of operation 11 is the pool plugin's line (`app.db.read`).
    expect(calls).toHaveLength(1);
    expect(count(textOf('index.ts'), /\bapp\.db\.read\(LIST_USERS_SOURCE, /g)).toBe(1);
    expect(code.flatMap((file) => [...file.text.matchAll(/\bapp\s*\.\s*db\s*\.\s*(?:pool|probe)\b/g)])).toHaveLength(0);
    const allowed = new Set(['code', 'source', 'err']);
    for (const call of calls) {
      expect(call).not.toContain('...');
      const keys = call
        .slice(1, -1)
        .split(',')
        .map((part) => part.trim().split(':')[0]?.trim() ?? '')
        .filter((key) => key !== '');
      expect(keys.filter((key) => !allowed.has(key))).toEqual([]);
      expect(keys.filter((key) => ['error', 'cause', 'e', 'reason'].includes(key))).toEqual([]);
    }
    // The mirror's failure is also written to the error log, by its description (name, code, frames).
    expect(count(textOf('index.ts'), /\bapp\.errorLog\.append\(/g)).toBe(1);
    // Never the message of an error: a driver's message can quote a statement and its values.
    expect(places(/\b(?:error|err|cause|e)\s*\.\s*message\b/g)).toEqual([]);
    expect(places(/\bString\(\s*(?:error|err)\s*\)|\$\{\s*(?:error|err)\b/g)).toEqual([]);
  });
});

describe('rule 7: the module reaches other folders only through the seams and the plugins', () => {
  it('imports the contract, the framework, the core, four plugins, its own files and the one revoke function of identity/biometric (decision D105); no other module, not the engine, not the schema', () => {
    const sources = new Set(code.flatMap((file) => [...file.text.matchAll(/\bfrom\s+'([^']+)'/g)].map((match) => match[1] ?? '')));
    expect([...sources].sort()).toEqual([
      '../../core',
      '../../plugins/authenticate',
      '../../plugins/error-envelope',
      '../../plugins/logger',
      '../../plugins/permission-guard',
      '../identity/biometric',
      './changes',
      './rule',
      './statements',
      '@dems/shared/api',
      '@dems/shared/sim',
      'fastify',
      'fastify-type-provider-zod',
      'pg',
      'zod',
    ]);
  });

  it('decision D105: the module has no statement on biometric_tokens; a disable calls the one revoke function of identity/biometric with the scope OPERATOR', () => {
    expect(files(/\bbiometric_tokens\b/g)).toEqual([]);
    // One import of that folder in the whole module, of one name, and one call, inside the unit of a disable.
    const importing = code.filter((file) => file.text.includes("'../identity/biometric'")).map((file) => file.path);
    expect(importing).toEqual([`${FOLDER}changes.ts`]);
    expect(textOf('changes.ts')).toMatch(/import \{ revokeBiometricTokens \} from '\.\.\/identity\/biometric';/);
    const calls = [...textOf('changes.ts').matchAll(/\brevokeBiometricTokens\(([^;]*)\);/g)].map((match) => match[1]);
    expect(calls).toEqual(["unit, { scope: 'OPERATOR', operatorId, reason: 'USER_DISABLED' }, now"]);
  });

  it('the seams it uses are pipeline, clock, sessionRegistry, publish, engine; plus the pool, the log and the error log', () => {
    const used = new Set(code.flatMap((file) => [...file.text.matchAll(/\bapp\s*\.\s*([a-zA-Z]+)\b/g)].map((match) => match[1] ?? '')));
    expect([...used].sort()).toEqual(['clock', 'db', 'engine', 'errorLog', 'pipeline', 'publish', 'sessionRegistry', 'withTypeProvider']);
  });
});
