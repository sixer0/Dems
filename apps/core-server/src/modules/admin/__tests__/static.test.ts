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
//   6. No password handling: the folder names no secret column and no password, and it touches the
//      credential table with one DELETE of the account's own row and nothing else (RB-9 as amended
//      by the principal, PT GSP, 02-11-2026; decision U19 keeps every writer of a password outside
//      this module).
//   7. The module reaches other folders only through the seams and the plugins.
//
// Every forbidden text is built from fragments, so that this file does not contain it.
import { describe, expect, it } from 'vitest';
import { SCAN_COVERS, WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, scanCoverage, type SourceFile } from '../../../../test/static/scan';
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
// REVISED 2026-11-02 (principal): RB-9 amended — the two forbidden things are now apart. A SECRET
// VALUE (a password, any hash, a salt) may never be named here at all; the CREDENTIAL TABLE is
// named by exactly one statement, the DELETE that removes the row of an account that is deleted.
// The forms of a CREDENTIAL secret. Not the bare word `hash`: the audit chain has a hash of its own
// (`prev_hash`, the genesis hash, `chainHash`) and the re-seal of migration 0036 has to name it to
// do its work. What stays forbidden here is a password, the hash of one, the salt of one and the
// parameters that make one — the columns of the credential table (decision U19).
// REVISED 2026-11-02 (principal): RB-9 amended, twice over — the amendment of the morning kept the
// rule, the purge of the afternoon moved the module onto the chain's own hash, and this is where the
// two meet: the list names the credential's members by name, so a new one cannot slip in under a word.
const SECRET_VALUE = new RegExp([`${['token', 'hash'].join('_')}`, `\\b${'password'}`, `\\bcode_${'hash'}\\b`, `\\bcurrent_${'hash'}\\b`, `\\b${'salt'}\\b`, `\\bargon2\\w*\\b`, `\\bmemory_kib\\b`, `\\bparallelism\\b`, `\\bhashed_at\\b`].join('|'), 'gi');
const CREDENTIAL_TABLE = new RegExp(`${['operator', 'credentials'].join('_')}`, 'gi');
const SQL = /['"`](?:SELECT|INSERT|UPDATE|DELETE)\s/g;

describe('the scan itself', () => {
  it('reads the production sources of the folder', () => {
    expect(scanCoverage(own, [FOLDER])).toEqual(SCAN_COVERS);
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
          `'SELECT ${['token', 'hash'].join('_')} FROM public.${['operator', 'credentials'].join('_')}'`,
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
    expect(hits(SECRET_VALUE)).toBe(1);
    expect(hits(CREDENTIAL_TABLE)).toBe(1);
    expect(hits(SQL)).toBe(1);
  });
});

describe('rule 1: one clock', () => {
  it('no file reads the system time or starts a timer; every instant is app.clock, read once per unit', () => {
    expect(places(SYSTEM_TIME)).toEqual([]);
    expect(places(TIMER)).toEqual([]);
    expect(files(/\bapp\s*\.\s*clock\s*\.\s*now\s*\(/g)).toEqual([`${FOLDER}changes.ts`]);
    // REVISED 2026-11-02 (principal): RB-9 amended — six units, one instant each.
    expect(count(textOf('changes.ts'), /\bapp\.clock\.now\(\)/g)).toBe(6);
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
    // REVISED 2026-11-02 (principal): RB-9 amended — the declaration and one use in each unit that
    // can take a holder of the permission away: the role change, the disable, the delete.
    expect(changes.match(/\bADMINISTRATION_PERMISSION\b/g)).toHaveLength(4);
    expect(count(changes, /readRolesHolding\(unit, ADMINISTRATION_PERMISSION\)/g)).toBe(3);
  });

  it('writes no denial row and takes no place in the denial budget: neither of its refusals is audited', () => {
    expect(places(DENIAL)).toEqual([]);
  });

  // REVISED 2026-11-02 (principal): RB-9 amended — the amendment adds the ONE thing the registry's
  // access rule cannot express: an identity, the vendor `root` account, which stage 6 cannot tell
  // from a client's supervisor because both hold the same USER_ADMIN. It is allowed as a check of
  // the caller's USERNAME only, read inside the unit on the row the unit holds locked, built in one
  // place, and it writes no denial row (the guard's 403 is stage 6's; this one is the unit's).
  // Everything else about who may call stays stage 6's alone.
  it('the one identity the module may read of its caller is the vendor root username, in one place', () => {
    expect(files(/\bisVendorRoot\b/g)).toEqual([`${FOLDER}changes.ts`, `${FOLDER}rule.ts`]);
    expect(count(textOf('changes.ts'), /\bisVendorRoot\(/g)).toBe(1);
    expect(count(textOf('changes.ts'), /\brequireVendorRoot\(/g)).toBe(4);
    // Read by one statement, of one column, of the caller's own row; no other column of operators is.
    expect(files(/\breadUsername\b/g)).toEqual([`${FOLDER}changes.ts`, `${FOLDER}statements.ts`]);
    expect(textOf('statements.ts')).toMatch(/export const READ_USERNAME = 'SELECT username FROM public\.operators WHERE id = \$1';/);
    // The identity is a constant - and since D55 (2026-11-03) it lives in `@dems/shared/sim`, the
    // one place that knows what the username means (RB-9 narrows by it, D55 grants by it). The
    // module re-exports it and may not define its own copy; the test of it stays one comparison.
    const rule = textOf('rule.ts');
    expect(rule).toMatch(/import \{ isVendorRoot, VENDOR_ROOT_USERNAME \} from '@dems\/shared\/sim';/);
    expect(count(rule, /\bVENDOR_ROOT_USERNAME\b/g)).toBe(2);
    expect(rule).toMatch(/export \{ VENDOR_ROOT_USERNAME, isVendorRoot \};/);
    expect(rule).not.toMatch(/= 'root'/);
    // No permission, role, session or device of the caller is read anywhere in the folder, and the
    // narrowed refusal names the account that may act, never the caller who did not.
    expect(places(/\bprincipal\s*\.\s*(?:username|name)\b/g)).toEqual([]);
    expect(textOf('changes.ts')).toMatch(/new ApiFailure\(403, ApiErrorCode\.NOT_PERMITTED, `Only the \$\{VENDOR_ROOT_USERNAME\} account/);
  });

  it('puts no hook on a route and adds none to the app', () => {
    expect(places(ROUTE_HOOK)).toEqual([]);
  });
});

describe('rule 3 (M2): routes come from the registry', () => {
  // REVISED 2026-11-02 (principal): RB-9 amended — area 2 gains createUser/updateUser/deleteUser
  // (operations 15-17), all narrowed to the vendor root account inside the unit: seven routes now.
  it('seven routes, each built from its registry entry, registered in index.ts and nowhere else', () => {
    expect(files(ROUTE_REGISTRATION)).toEqual([`${FOLDER}index.ts`]);
    const index = textOf('index.ts');
    expect(count(index, /\broutes\.route\(\{\s*\.\.\.routeOfOperation\(/g)).toBe(7);
    expect(places(ROUTE_REGISTRATION)).toHaveLength(7);
    // No path is written in the module: method and path are the registry's.
    expect(places(/['"`]\/api\//g)).toEqual([]);
  });

  it('every schema is the contract\'s: the module declares no body or response schema of its own', () => {
    const index = textOf('index.ts');
    // REVISED 2026-11-02 (principal): RB-9 amended — eight contract schemas: 8 imports, 7 responses
    // (one per route) and 6 bodies (one per command; the read of operation 11 has none).
    expect(index.match(/\b(?:AdminUserListSchema|AdminUserSchema|UserRoleRequestSchema|UserStatusRequestSchema|CreateUserRequestSchema|UpdateUserRequestSchema|DeleteUserRequestSchema|DeletedUserSchema)\b/g)?.length).toBe(8 + 7 + 6);
    // Its one own schema is the path parameter, built from the registry's pattern.
    expect(index.match(/\bz\.object\(/g)).toHaveLength(1);
    expect(index).toMatch(/z\.object\(\{ id: z\.string\(\)\.regex\(operation\.pathParam\.pattern\) \}\)/);
  });
});

describe('rule 4 (M5): one unit per change, one audit path, publications after the commit', () => {
  const changes = textOf('changes.ts');

  // REVISED 2026-11-02 (principal): RB-9 amended — six write operations, six units, six audit rows.
  it('six units, one per write operation, each with one audit row; no event (spec §13.1: audit-only)', () => {
    expect(files(/\bapp\s*\.\s*pipeline\s*\.\s*run\s*\(/g)).toEqual([`${FOLDER}changes.ts`]);
    expect(count(changes, /\bapp\.pipeline\.run\(ADMIN_UNIT_LABEL\.(?:assignUserRole|enableUser|disableUser|createUser|updateUser|deleteUser),/g)).toBe(6);
    expect(count(changes, /\bunit\.audit\.append\(/g)).toBe(6);
    expect(changes.match(/type: '(ROLE_CHANGED|USER_DISABLED|USER_ENABLED|USER_CREATED|USER_UPDATED|USER_DELETED)'/g)).toEqual(["type: 'ROLE_CHANGED'", "type: 'USER_DISABLED'", "type: 'USER_ENABLED'", "type: 'USER_CREATED'", "type: 'USER_UPDATED'", "type: 'USER_DELETED'"]);
    expect(places(/\bunit\s*\.\s*events\b|\bevents\s*\.\s*append\b/g)).toEqual([]);
    expect(places(OWN_AUDIT_INSERT)).toEqual([]);
  });

  it('the actor of every row is the caller\'s session, and no row carries a time or a request field', () => {
    // REVISED 2026-11-02 (principal): RB-9 amended — six rows, every one of them the caller's session.
    expect(count(changes, /actorId: actor\.operatorId,\s*deviceId: actor\.deviceId,/g)).toBe(6);
    expect(places(/\bat\s*:/g, [{ path: 'changes.ts', text: changes }])).toEqual([]);
  });

  // REVISED 2026-11-02 (principal): RB-9 amended — three units more, each publishing after its own
  // commit: the create and the edit with `admin.changed USERS`, the delete also with `session.ended`.
  it('every publication is inside unit.afterCommit, and there are nine: two for a role change, two for a disable, one for an enable, one for a create, one for an edit, two for a delete', () => {
    expect(files(/\bapp\s*\.\s*publish\s*\(/g)).toEqual([`${FOLDER}changes.ts`]);
    expect(count(changes, /\bapp\.publish\(/g)).toBe(9);
    const blocks = [...changes.matchAll(/unit\.afterCommit\(\(\) => \{([\s\S]*?)\n {4}\}\);/g)].map((match) => match[1] ?? '');
    expect(blocks).toHaveLength(6);
    expect(blocks.map((block) => count(block, /\bapp\.publish\(/g))).toEqual([2, 2, 1, 1, 1, 2]);
    expect(blocks.map((block) => block.match(/kind: '([a-z.]+)'/g))).toEqual([
      ["kind: 'session.updated'", "kind: 'admin.changed'"],
      ["kind: 'session.ended'", "kind: 'admin.changed'"],
      ["kind: 'admin.changed'"],
      ["kind: 'admin.changed'"],
      ["kind: 'admin.changed'"],
      ["kind: 'session.ended'", "kind: 'admin.changed'"],
    ]);
  });

  // REVISED 2026-11-02 (principal): RB-9 amended — a delete ends the sessions the same way, in its
  // own unit: the seam is called twice, once by the disable and once by the delete.
  it('a disable and a delete end the sessions through the seam, inside their unit, with the reason USER_DISABLED', () => {
    expect(count(changes, /await app\.sessionRegistry\.endForOperator\(unit, operatorId, 'USER_DISABLED'\)/g)).toBe(2);
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

  it('a refusal throws inside the unit, so the unit rolls back: every refusal is built in one place each', () => {
    // REVISED 2026-11-02 (principal): RB-9 amended — four units can lose their target (404), three
    // can be refused by RB-8 (409 LAST_ADMIN), and the narrowed trio adds three refusals of its own:
    // the root identity (403), the taken username (422) and the unconfirmed or still-referenced
    // delete (409 INVALID_STATE). Each is built in exactly one place, and each throws inside a unit.
    expect(count(changes, /throw unknownOperator\(\)/g)).toBe(5);
    expect(count(changes, /throw lastAdministrator\(\)/g)).toBe(3);
    expect(changes).toMatch(/new ApiFailure\(404, ApiErrorCode\.NOT_FOUND,/);
    expect(changes).toMatch(/new ApiFailure\(409, ApiErrorCode\.LAST_ADMIN,/);
    expect(count(changes, /throw notVendorRoot\(\)/g)).toBe(1);
    expect(count(changes, /throw usernameTakenFailure\(\)/g)).toBe(1);
    expect(count(changes, /throw deleteNotConfirmed\(\)/g)).toBe(1);
    // REVISED again 2026-11-02 (backend move of 15:01): a reference no longer refuses the delete —
    // the unit counts them, announces them and purges. The builder is gone, so is its throw.
    expect(count(changes, /throw operatorStillReferenced\(/g)).toBe(0);
    expect(count(changes, /new ApiFailure\(409, ApiErrorCode\.INVALID_STATE,/g)).toBe(1);
    expect(changes).toMatch(/new ApiFailure\(403, ApiErrorCode\.NOT_PERMITTED,/);
    expect(changes).toMatch(/new ApiFailure\(422, ApiErrorCode\.INVALID_INPUT,/);
    // The identity half of the narrowed rule is read on the caller's own row, inside the unit.
    expect(count(changes, /if \(!isVendorRoot\(await readUsername\(unit, operatorId\)\)\) throw notVendorRoot\(\);/g)).toBe(1);
    expect(count(changes, /await requireVendorRoot\(unit, actor\.operatorId\);/g)).toBe(3);
    // The rule is asked before the write, on the rows read under the lock.
    for (const unit of changes.split('export function ').slice(1)) {
      const rule = unit.indexOf('leavesNoAdministrator(');
      if (rule === -1) continue;
      expect(unit.indexOf('lockOperators(unit)')).toBeGreaterThan(0);
      expect(rule).toBeGreaterThan(unit.indexOf('lockOperators(unit)'));
      // REVISED 2026-11-02 (principal): RB-9 amended — the delete's write is `deleteOperator`.
      // REVISED 2026-11-02 (principal): RB-9 amended — the delete's write is `purgeOperator`, the
      // erasure of the account (which since the move of 15:01 replaces the plain DELETE).
      expect(unit.search(/await (?:assignRole|disableOperator|purgeOperator)\(unit/)).toBeGreaterThan(rule);
    }
  });
});

describe('rule 5: the statements', () => {
  const list = Object.entries(statements).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  const byName = Object.fromEntries(list);

  it('are constant texts: every exported statement of the store is listed here', () => {
    // REVISED 2026-11-02 (principal): RB-9 amended — the eight of the read and the three transitions,
    // plus the nine the vendor-only trio needs: the caller's username, the ID allocation, the taken
    // name, the insert, the profile update, the open sessions, the credential delete and the delete.
    expect(list.map(([name]) => name).sort()).toEqual([
      'ASSIGN_ROLE',
      'COUNT_OPEN_SESSIONS',
      'DELETE_CREDENTIAL',
      'DELETE_OPERATOR',
      'DISABLE_OPERATOR',
      'ENABLE_OPERATOR',
      'INSERT_OPERATOR',
      'LIST_USERS',
      'LOCK_OPERATOR',
      'LOCK_OPERATORS',
      'NEXT_OPERATOR_ID',
      'PURGE_FORECAST',
      'PURGE_OPERATOR',
      'READ_ROLES_HOLDING',
      'READ_ROLE_PERMISSIONS',
      'READ_USER',
      'READ_USERNAME',
      'REFERENCED_BY',
      'RESEAL',
      'UPDATE_PROFILE',
      'USERNAME_TAKEN',
    ]);
  });

  it('no statement is written outside the store', () => {
    expect(files(SQL)).toEqual([`${FOLDER}statements.ts`]);
  });

  it('name every table with its schema, and hold no value: only bind parameters', () => {
    for (const [name, text] of list) {
      // A relation this statement names, with its schema. A function it calls counts the same way:
      // `SELECT public.audit_purge_operator(...)` is as much a named object of the schema as a table.
      const tables = [...text.matchAll(/\b(?:FROM|JOIN|UPDATE|INTO)\s+([a-z_.]+)/g)].map((match) => match[1]);
      const calls = [...text.matchAll(/\b(public\.[a-z_]+)\s*\(/g)].map((match) => match[1]);
      expect(tables.length + calls.length, name).toBeGreaterThan(0);
      expect(tables.filter((table) => !table?.startsWith('public.')), name).toEqual([]);
      // A quoted literal in a statement is one of the fixed words of the schema, never data.
      // REVISED 2026-11-02 (principal): RB-9 amended — two more kinds are allowed, both fixed words of
      // the schema and neither a value that came from a request (SR-67): the FORM of an operator key
      // (`'OPR-'` and the padding `'0'` of `lpad`), and the NAME OF A TABLE the statement itself
      // reads, which is what `REFERENCED_BY` labels each of its counts with.
      const literals = [...text.matchAll(/'([^']*)'/g)].map((match) => match[1]);
      expect(
        literals.filter((word) => !['USER_DISABLED', 'OPR-', '0'].includes(word ?? '') && !(word !== undefined && text.includes(`public.${word}`))),
        name,
      ).toEqual([]);
      expect(text, name).not.toMatch(/\$\{/);
    }
    for (const name of ['READ_USER', 'LOCK_OPERATOR', 'READ_ROLES_HOLDING', 'ASSIGN_ROLE', 'DISABLE_OPERATOR', 'ENABLE_OPERATOR', 'READ_ROLE_PERMISSIONS', 'READ_USERNAME', 'USERNAME_TAKEN', 'INSERT_OPERATOR', 'UPDATE_PROFILE', 'COUNT_OPEN_SESSIONS', 'DELETE_CREDENTIAL', 'DELETE_OPERATOR']) {
      expect(byName[name], name).toMatch(/\$1\b/);
    }
  });

  // REVISED 2026-11-02 (principal): RB-9 amended — the module no longer writes operators by UPDATE
  // only: operations 15 to 17 INSERT, UPDATE and DELETE that table, and a delete takes the account's
  // own credential row with it. What does NOT move is the reach: one table of its own (operators),
  // the credential table by DELETE of that account's row and nothing else, and no write of this
  // module on the audit chain or the event log (AT-2: the chain has no writer here).
  it('the module writes operators with its own statements, by INSERT, UPDATE and DELETE, and names the credential table to delete and to count it; the biometric tokens are revoked by the one function of identity/biometric (decision D105)', () => {
    const named = new Set(list.flatMap(([, text]) => [...text.matchAll(/\bpublic\.([a-z_]+)/g)].map((match) => match[1])));
    // REVISED 2026-11-02 (principal): RB-9 amended — the reach is now split in two. What the module
    // WRITES is its own table plus the credential row of a deleted account; everything else is a
    // READ, and the only statement that reads beyond the module's five tables is `REFERENCED_BY`,
    // which counts the foreign keys that hold an operator in place so that a refused delete says so.
    const writtenTables = [...new Set(list.flatMap(([, text]) => [...text.matchAll(/\b(?:INSERT INTO|UPDATE|DELETE FROM)\s+public\.([a-z_]+)/g)].map((match) => match[1] ?? '')))].sort();
    expect(writtenTables).toEqual(['operator_credentials', 'operators']);
    const readOnly = [...named].filter((table): table is string =>
      table !== undefined && !writtenTables.includes(table) && !table.startsWith('audit_purge_')).sort();
    expect(readOnly).toEqual([
      'active_session',
      'audit_chain_history',
      'audit_log',
      'auth_sessions',
      'biometric_tokens',
      'capture_audio_inputs',
      'capture_config',
      'capture_devices',
      'capture_network_config',
      'evidence_custody',
      'evidence_items',
      'exports',
      'host_network_aliases',
      'installation_acceptances',
      'paired_devices',
      'pairing_codes',
      'permissions',
      'role_permissions',
      'session_audio_intervals',
      'session_history',
      'stt_config',
      'transcript_revisions',
    ]);
    // Every one of those reads belongs to `REFERENCED_BY` or to `PURGE_FORECAST`, except the five the
    // module always read. REVISED 2026-11-02: the forecast of the purge counts the same records.
    const own = ['auth_sessions', 'operators', 'permissions', 'role_permissions', 'operator_credentials'];
    expect(
      list
        .filter(([name, text]) => !['REFERENCED_BY', 'PURGE_FORECAST'].includes(name) && [...text.matchAll(/\bpublic\.([a-z_]+)\b(?!\s*\()/g)].some((match) => !own.includes(match[1] ?? '')))
        .map(([name]) => name),
    ).toEqual([]);
    // The two functions of migration 0036 are the only route this module has to the chain, and both
    // are named by exactly one statement each. The module holds no DELETE of `audit_log` as text: the
    // erasure is a SECURITY DEFINER function of the schema, which is what the principal chose on
    // 02-11-2026 when the delete became a purge (see the note at the top of `vendor-root.test.ts`).
    const through = list.filter(([, text]) => /\bpublic\.audit_purge_\w+\s*\(/.test(text)).map(([name]) => name);
    expect(through.sort()).toEqual(['PURGE_OPERATOR', 'RESEAL']);
    expect(byName['PURGE_OPERATOR']).toBe('SELECT public.audit_purge_operator($1, $2, $3) AS counts');
    expect(byName['RESEAL']).toBe('SELECT public.audit_purge_reseal($1, $2::jsonb) AS seal');
    // The chain and the event log are never WRITTEN here. `REFERENCED_BY` reads `audit_log` to say
    // how many rows of the chain hold the operator that a delete is about — reading the chain to
    // explain a refusal is allowed, changing it is not (AT-2, and the append-only rule the principal
    // kept when amending RB-9).
    expect(list.filter(([, text]) => /^\s*(?:UPDATE|DELETE FROM|INSERT INTO)\s+(?:public\.)?(?:audit_log|events)\b/m.test(text)).map(([name]) => name)).toEqual([]);
    // No statement of this module appends to the chain either: the append is the writer's, through
    // `unit.audit.append`, and nothing here names it as SQL.
    expect(places(OWN_AUDIT_INSERT)).toEqual([]);
    expect(places(OWN_AUDIT_INSERT)).toEqual([]);
    const changed = list
      .filter(([, text]) => /\b(?:INSERT INTO|DELETE FROM|TRUNCATE)\b/.test(text))
      .map(([name, text]) => `${name} ${/^(?:INSERT INTO|DELETE FROM|TRUNCATE)\s+(public\.[a-z_]+)/.exec(text)?.[1]}`);
    expect(changed.sort()).toEqual([
      'DELETE_CREDENTIAL public.operator_credentials',
      'DELETE_OPERATOR public.operators',
      'INSERT_OPERATOR public.operators',
    ]);
    const written = list.filter(([, text]) => text.startsWith('UPDATE ')).map(([name, text]) => `${name} ${/^UPDATE (public\.[a-z_]+)/.exec(text)?.[1]}`);
    expect(written.sort()).toEqual([
      'ASSIGN_ROLE public.operators',
      'DISABLE_OPERATOR public.operators',
      'ENABLE_OPERATOR public.operators',
      'UPDATE_PROFILE public.operators',
    ]);
    // The credential table is only ever REMOVED from: no SELECT, no INSERT, no UPDATE of it, and no
    // column of it named. That is the half of decision U19 this module keeps: it destroys a
    // credential with its account and never reads or writes the value of one.
    for (const [name, text] of list) {
      if (!/operator_credentials/.test(text)) continue;
      // Two forms are allowed and no other: the removal of the account's own row, and the count of
      // the purge forecast that announces it. Both name the OPERATOR and no column of the credential.
      expect(['DELETE_CREDENTIAL', 'PURGE_FORECAST'], name).toContain(name);
      if (name === 'DELETE_CREDENTIAL') expect(text, name).toMatch(/^DELETE FROM public\.operator_credentials WHERE operator_id = \$1 RETURNING operator_id$/);
    }
    expect(list.filter(([, text]) => /\b(?:INSERT INTO|UPDATE)\s+public\.operator_credentials\b/.test(text))).toEqual([]);
    expect(list.filter(([, text]) => /operator_credentials\s*\./.test(text))).toEqual([]);
  });

  it('an UPDATE sets only columns the privilege matrix grants the runtime role (database contract §7.3)', () => {
    // REVISED 2026-11-02 (principal): RB-9 amended — migration 0035 adds the four profile columns
    // (`GRANT UPDATE (name, display_name, initials, rank) ON public.operators`) besides the five the
    // role always had. Nothing else: `username` stays outside the grant, so no operation of the
    // module can rename an account.
    const granted: Record<string, readonly string[]> = {
      'public.operators': ['role_id', 'enabled', 'last_sign_in_at', 'role_changed_at', 'updated_at', 'name', 'display_name', 'initials', 'rank'],
      'public.biometric_tokens': ['used_at', 'revoked_at', 'revoke_reason'],
    };
    // A column list split on the commas of the SET clause only: `COALESCE($2, name)` holds one.
    const setColumns = (assignment: string): string[] => {
      const parts: string[] = [];
      let depth = 0;
      let current = '';
      for (const character of assignment) {
        if (character === '(') depth += 1;
        if (character === ')') depth -= 1;
        if (character === ',' && depth === 0) {
          parts.push(current);
          current = '';
          continue;
        }
        current += character;
      }
      parts.push(current);
      return parts.map((part) => (part.trim().split(/\s*=/)[0] ?? '').trim());
    };
    for (const [name, text] of list) {
      const match = /^UPDATE (public\.[a-z_]+) SET (.*?) WHERE /.exec(text);
      if (match === null) continue;
      const columns = setColumns(match[2] ?? '');
      expect(columns.filter((column) => !granted[match[1] ?? '']?.includes(column)), name).toEqual([]);
    }
    expect(/ SET (.*?) WHERE /.exec(byName['ASSIGN_ROLE'] ?? '')?.[1]).toBe('role_id = $2, role_changed_at = $3, updated_at = $3');
    expect(setColumns(/ SET (.*?) WHERE /.exec(byName['UPDATE_PROFILE'] ?? '')?.[1] ?? '')).toEqual(['name', 'display_name', 'initials', 'rank', 'updated_at']);
    // The columns an INSERT may give a new account, and the one table a DELETE may empty.
    const inserted = /^INSERT INTO public\.operators \(([^)]*)\)/.exec(byName['INSERT_OPERATOR'] ?? '')?.[1] ?? '';
    expect(inserted.split(', ').sort()).toEqual(['created_at', 'display_name', 'enabled', 'id', 'initials', 'name', 'rank', 'role_changed_at', 'role_id', 'updated_at', 'username'].sort());
    expect(byName['DELETE_OPERATOR']).toMatch(/^DELETE FROM public\.operators WHERE id = \$1/);
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
  // REVISED 2026-11-02 (principal): RB-9 amended — the module still holds no password and no hash,
  // and now also proves the one thing the amendment allows: the credential table appears exactly
  // once in the folder, in the DELETE of the deleted account's own row, naming no column of it.
  it('the folder names no hash column and no password, and touches the credential table with a DELETE and a count only', () => {
    expect(places(SECRET_VALUE)).toEqual([]);
    expect(files(CREDENTIAL_TABLE)).toEqual([`${FOLDER}statements.ts`]);
    // REVISED 2026-11-02 (backend move of 15:01): the table is named twice now — the DELETE of the
    // account's own row, and the COUNT of the purge forecast that announces what goes with it. Both
    // name the OPERATOR, never a column of the credential. Decision U19 is unchanged: no INSERT, no
    // UPDATE, no read of a value, and no password primitive anywhere in this folder.
    expect(places(CREDENTIAL_TABLE)).toHaveLength(2);
    expect(statements.DELETE_CREDENTIAL).toBe('DELETE FROM public.operator_credentials WHERE operator_id = $1 RETURNING operator_id');
    expect((statements.PURGE_FORECAST.match(/public\.operator_credentials[^\n]*/g) ?? []).map((line) => line.replace(/\s+/g, ' '))).toEqual([
      'public.operator_credentials WHERE operator_id = $1) AS "credentialsRemoved",',
    ]);
    // Never written, never read as a row: only removed, and counted by the operator ID of the account.
    expect(places(/\b(?:INSERT INTO|UPDATE)\s+public\.operator_credentials\b/gi)).toEqual([]);
    expect(places(/operator_credentials\s*\.\s*[a-z_]+/gi)).toEqual([]);
    // What is read of that table is a count and nothing else: the two forms above are the whole of it,
    // each named by its exact text, and no column of it is ever selected or written.
    // The module imports no password primitive of the identity folder, and no name of its hash file.
    expect(places(/\b(?:argon|verifyPassword|hashPassword|passwordHash)\w*\b/gi)).toEqual([]);
    expect(code.flatMap((file) => [...file.text.matchAll(/\bfrom\s+'([^']*password[^']*)'/g)].map((match) => match[1] ?? ''))).toEqual([]);
  });

  it('writes no cookie and reads no header, cookie, query string or raw URL of a request', () => {
    expect(places(COOKIE_WRITE)).toEqual([]);
    expect(places(REQUEST_TRANSPORT)).toEqual([]);
  });

  it('reads the body and the path parameter in index.ts only, and a reason reaches a row only through the credential-form check', () => {
    expect(files(/\brequest\s*\.\s*(?:body|params)\b/g)).toEqual([`${FOLDER}index.ts`]);
    const index = textOf('index.ts');
    // REVISED 2026-11-02 (principal): RB-9 amended — six commands, each with its reason.
    expect(count(index, /\brequest\.body\.reason\b/g)).toBe(6);
    expect(count(index, /reasonOf\(request\.body\.reason\)/g)).toBe(6);
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
  // REVISED 2026-11-02 (principal): RB-9 amended — the narrowed trio throws the core's own error type
  // for a purge that answered in a form it cannot use, so `../../core/errors` joins the list. The
  // list stays CLOSED: no other module, not the engine, not the schema, not the mapping.
  it('imports the contract, the framework, the core and its errors, four plugins, its own files and the one revoke function of identity/biometric (decision D105); no other module, not the engine, not the schema', () => {
    const sources = new Set(code.flatMap((file) => [...file.text.matchAll(/\bfrom\s+'([^']+)'/g)].map((match) => match[1] ?? '')));
    expect([...sources].sort()).toEqual([
      '../../core',
      '../../core/errors',
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
    // Still not the schema and not the mapping: the re-seal reads its rows through the store's own
    // connection, so no file of this folder may name those two folders (decision CPB1-16).
    expect(code.flatMap((file) => [...file.text.matchAll(/\bfrom\s+'\.\.\/\.\.\/db\/(?:schema|mapping|store|seed)'/g)].map((match) => match[0]))).toEqual([]);
  });

  // REVISED 2026-11-02 (principal): RB-9 amended — a delete revokes them the same way: two calls now.
  // REVISED 2026-11-02 (principal): RB-9 amended — the name of the table may now be READ (it is one
  // of the sources `REFERENCED_BY` counts to explain a refused delete). What D105 keeps is that no
  // statement of this module WRITES it: the only revoke is the one function of identity/biometric.
  it('decision D105: the module writes no statement on biometric_tokens; a disable and a delete call the one revoke function of identity/biometric with the scope OPERATOR', () => {
    const texts = Object.entries(statements).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
    expect(texts.filter(([, text]) => /^\s*(?:UPDATE|DELETE FROM|INSERT INTO)\s+public\.biometric_tokens\b/m.test(text)).map(([name]) => name)).toEqual([]);
    // The name appears in one statement only, the read that explains a refused delete, twice in it:
    // once as the label of its count and once as the table it counts in.
    expect(files(/\bbiometric_tokens\b/g)).toEqual([`${FOLDER}statements.ts`]);
    expect(texts.filter(([, text]) => /\bbiometric_tokens\b/.test(text)).map(([name]) => name).sort()).toEqual(['PURGE_FORECAST', 'REFERENCED_BY']);
    // One import of that folder in the whole module, of one name, and one call, inside the unit of a disable.
    const importing = code.filter((file) => file.text.includes("'../identity/biometric'")).map((file) => file.path);
    expect(importing).toEqual([`${FOLDER}changes.ts`]);
    expect(textOf('changes.ts')).toMatch(/import \{ revokeBiometricTokens \} from '\.\.\/identity\/biometric';/);
    const calls = [...textOf('changes.ts').matchAll(/\brevokeBiometricTokens\(([^;]*)\);/g)].map((match) => match[1]);
    expect(calls).toEqual(["unit, { scope: 'OPERATOR', operatorId, reason: 'USER_DISABLED' }, now", "unit, { scope: 'OPERATOR', operatorId, reason: 'USER_DISABLED' }, now"]);
  });

  it('the seams it uses are pipeline, clock, sessionRegistry, publish, engine; plus the pool, the log and the error log', () => {
    const used = new Set(code.flatMap((file) => [...file.text.matchAll(/\bapp\s*\.\s*([a-zA-Z]+)\b/g)].map((match) => match[1] ?? '')));
    expect([...used].sort()).toEqual(['clock', 'db', 'engine', 'errorLog', 'pipeline', 'publish', 'sessionRegistry', 'withTypeProvider']);
  });
});
