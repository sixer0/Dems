// Static guards of the permission guard and the RBAC module (plan row W28; decision D82). They
// read production sources as text, with the scaffold's scanner, and keep these rules true for
// every later row:
//
//   1. One clock, no timer: nothing here reads the system time (ENG-13).
//   2. The decision never reads request data: no body, no query string, no header, no raw URL;
//      the one path parameter is read in one place (the evidence ID of an export refusal).
//   3. One audit path: nothing here inserts into the audit table or the events table itself.
//   4. The guard cannot be switched off from production code: no production file of the SERVER
//      replaces a stage or a seam, and none imports from a `__tests__` folder (the test support
//      `passScratchRoutes` lives there).
//   5. Every route is registered after the guard is loaded: no file that is loaded before it
//      registers one.
//   6. A module does not check permissions itself: the RBAC module names no permission.
//
// Every forbidden text is built from fragments, so that this file does not contain it.
import { describe, expect, it } from 'vitest';
import { WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, type SourceFile } from '../../../../test/static/scan';

const OWN_FOLDERS = ['src/plugins/permission-guard/', 'src/modules/rbac/'];

const tree = readTree(WORKSPACE);
const production = tree.filter((file) => isProductionSource(file.path));
const own = production.filter((file) => OWN_FOLDERS.some((folder) => file.path.startsWith(folder)));
const ownCode = codeOnly(own);
const serverCode = codeOnly(production);

const places = (pattern: RegExp, where: readonly SourceFile[] = ownCode): string[] => occurrences(where, pattern);
const files = (pattern: RegExp, where: readonly SourceFile[] = ownCode): string[] => [...new Set(places(pattern, where).map((place) => place.replace(/:\d+$/, '')))];

const SYSTEM_TIME = new RegExp([`\\bDate\\s*\\.\\s*${'now'}\\s*\\(`, `\\bnew\\s+Date\\s*\\(`, `\\bperformance\\s*\\.\\s*${'now'}\\b`, `\\bhr${'time'}\\b`].join('|'), 'g');
const TIMER = new RegExp(`\\bset(?:${'Timeout'}|${'Interval'}|${'Immediate'})\\s*\\(`, 'g');
const CONSOLE = new RegExp(`\\b${'console'}\\s*\\.`, 'g');
const ENVIRONMENT = new RegExp(`\\bprocess\\s*\\.\\s*${'env'}\\b|\\.\\s*${'listen'}\\s*\\(`, 'g');
const REQUEST_DATA = new RegExp(`\\brequest\\s*\\.\\s*(?:${'body'}|${'query'}|${'headers'}|${'cookies'}|raw|${'url'}|original${'Url'})\\b`, 'g');
const REQUEST_PARAMS = new RegExp(`\\brequest\\s*\\.\\s*${'params'}\\b`, 'g');
const OWN_AUDIT_INSERT = new RegExp(`\\binsert\\s+into\\s+(?:public\\s*\\.\\s*)?(?:${['audit', 'log'].join('_')}|events)\\b`, 'gi');
const WRITE_STATEMENT = new RegExp(`\\b(?:${'INSERT'}|${'UPDATE'}|${'DELETE'}|${'TRUNCATE'}|${'CREATE'}|${'ALTER'}|${'DROP'})\\s`, 'g');
const SLOT_REPLACED = new RegExp(`\\b(?:stages|seams)\\s*\\.\\s*${'replace'}\\s*\\(`, 'g');
const TEST_IMPORT = new RegExp(`from\\s+['"][^'"]*__${'tests'}__[^'"]*['"]|import\\s*\\(\\s*['"][^'"]*__${'tests'}__`, 'g');
/** A route registration: `.route(`, or a method call whose first argument is a path. */
const ROUTE_REGISTRATION = new RegExp(
  `\\.\\s*${'route'}\\s*\\(|\\.\\s*(?:get|post|put|patch|delete|head|options|all)\\s*\\(\\s*(?:['"\`]\\/|[A-Z][A-Z0-9_]*\\s*,)`,
  'g',
);
const ROLE_NAME = new RegExp(`\\b(?:${'INVESTIGATOR'}|${'SUPERVISOR'}|${'TECHNICIAN'})\\b`, 'g');
const SHARED_TABLE = new RegExp(`\\b${['ROLE', 'PERMISSIONS'].join('_')}\\b`, 'g');
const PERMISSION_NAME = new RegExp(`\\bPermission\\s*\\.\\s*[A-Z_]+\\b|\\b${'permissions'}\\s*\\.\\s*includes\\b|\\b${'role'}Has\\b`, 'g');

describe('the scan itself', () => {
  it('reads the production sources of the two folders', () => {
    expect(own.map((file) => file.path)).toEqual([
      'src/modules/rbac/index.ts',
      'src/plugins/permission-guard/access-rules.ts',
      'src/plugins/permission-guard/decision.ts',
      'src/plugins/permission-guard/denial.ts',
      'src/plugins/permission-guard/index.ts',
      'src/plugins/permission-guard/matrix.ts',
      'src/plugins/permission-guard/router-table.ts',
      // SEC35-18 (row 48; ruling D44 R2): the holder reader of the guard - one parameterless read.
      'src/plugins/permission-guard/session-holder.ts',
    ]);
    expect(production.length).toBeGreaterThan(100);
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
          `const c = request.${'body'};`,
          `const d = request.${'params'};`,
          `await unit.query('insert into public.${['audit', 'log'].join('_')} values ($1)');`,
          `await pool.query('${'UPDATE'} public.roles SET sort_order = 1');`,
          `app.stages.${'replace'}('accessRule', () => {});`,
          `import { x } from '../__${'tests'}__/support';`,
          `app.get('/api/v1/late', handler);`,
          `app.post(SOME_PATH, handler);`,
          `app.${'route'}({ method: 'GET' });`,
          `if (principal.${'permissions'}.includes(Permission.USER_ADMIN)) run();`,
        ].join('\n'),
      },
    ];
    const hits = (pattern: RegExp): number => occurrences(sample, pattern).length;
    expect([SYSTEM_TIME, TIMER, CONSOLE, ENVIRONMENT, REQUEST_DATA, REQUEST_PARAMS, OWN_AUDIT_INSERT, WRITE_STATEMENT, SLOT_REPLACED, TEST_IMPORT].map(hits)).toEqual([
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    ]);
    expect(hits(ROUTE_REGISTRATION)).toBe(3);
    expect(hits(PERMISSION_NAME)).toBe(2);
    // And not what merely looks like it: a map lookup, a seam read.
    const harmless: SourceFile[] = [{ path: 'src/sample.ts', text: `const a = seams.get('clock'); const b = byRoute.get(name); const c = app.stages.get('accessRule');` }];
    expect(occurrences(harmless, ROUTE_REGISTRATION)).toEqual([]);
    expect(occurrences(harmless, SLOT_REPLACED)).toEqual([]);
  });
});

describe('the guard and the RBAC module', () => {
  it('read no system time and start no timer: every instant is app.clock', () => {
    expect(places(SYSTEM_TIME)).toEqual([]);
    expect(places(TIMER)).toEqual([]);
    expect(files(/\bapp\s*\.\s*clock\s*\.\s*now\s*\(/g)).toEqual(['src/plugins/permission-guard/index.ts']);
  });

  it('write nothing to the console, read no environment and never listen', () => {
    expect(places(CONSOLE)).toEqual([]);
    expect(places(ENVIRONMENT)).toEqual([]);
  });

  it('SR-44: read no body, no query string, no header, no cookie and no raw URL of a request', () => {
    expect(places(REQUEST_DATA)).toEqual([]);
  });

  it('read a path parameter in exactly one place: the evidence ID of an export refusal, checked against the registry pattern', () => {
    expect(files(REQUEST_PARAMS)).toEqual(['src/plugins/permission-guard/index.ts']);
    expect(places(REQUEST_PARAMS)).toHaveLength(1);
    const guard = ownCode.find((file) => file.path === 'src/plugins/permission-guard/index.ts')?.text ?? '';
    expect(guard).toMatch(/rule\.idPattern\.test\(id\) \? id : null/);
  });

  it('append the denial row through the unit of work, and take the place in the budget before it', () => {
    expect(places(OWN_AUDIT_INSERT)).toEqual([]);
    const guard = ownCode.find((file) => file.path === 'src/plugins/permission-guard/index.ts')?.text ?? '';
    const consume = guard.indexOf('app.denialBudget.consume(request)');
    const unit = guard.indexOf('app.pipeline.run(DENIAL_UNIT_LABEL');
    const answer = guard.indexOf('throw answer');
    expect(consume).toBeGreaterThan(0);
    expect(unit).toBeGreaterThan(consume);
    expect(answer).toBeGreaterThan(unit);
    expect(guard.match(/app\.denialBudget\.consume\(/g)).toHaveLength(1);
    expect(guard.match(/unit\.audit\.append\(/g)).toHaveLength(1);
  });

  it('send one statement to the database, a read with no parameter: the three tables of the matrix', () => {
    expect(places(WRITE_STATEMENT)).toEqual([]);
    // Ruling D44 R2: `session-holder.ts` joined the list - the SEC35-18 holder read, one SELECT of
    // the open session's creator with no parameter, exactly the idiom of the matrix read. Pass D6
    // (F-D4-3): the column is `created_by`; `started_by` is always NULL and must not be read.
    expect(files(/\bSELECT\b/g).sort()).toEqual(['src/plugins/permission-guard/matrix.ts', 'src/plugins/permission-guard/session-holder.ts']);
    const matrix = own.find((file) => file.path === 'src/plugins/permission-guard/matrix.ts')?.text ?? '';
    for (const table of ['public.roles', 'public.permissions', 'public.role_permissions']) expect(matrix).toContain(table);
    expect(matrix).not.toMatch(/\$\d/);
    const holder = own.find((file) => file.path === 'src/plugins/permission-guard/session-holder.ts')?.text ?? '';
    expect(holder).toContain("'SELECT created_by FROM public.active_session LIMIT 1'");
    expect(holder).not.toMatch(/SELECT\s+started_by/);
    expect(holder).not.toMatch(/\$\d/);
  });

  it('decision D88: the grants the stored matrix is compared with have ONE source, the shared role table, and are typed nowhere in the two folders', () => {
    // The table is imported, in one file, from the package the hosted simulator's own checks read.
    expect(files(SHARED_TABLE)).toEqual(['src/plugins/permission-guard/matrix.ts']);
    const matrix = own.find((file) => file.path === 'src/plugins/permission-guard/matrix.ts')?.text ?? '';
    expect(matrix).toMatch(new RegExp(`import \\{[^}]*\\b${['ROLE', 'PERMISSIONS'].join('_')}\\b[^}]*\\} from '@dems/shared/sim';`));
    // No role is named in the code of the two folders: a table of role and permission cannot be typed without one.
    // Ruling D44 R2: the ONE sanctioned exception is the SESSION_HOLDER case of `decision.ts` - the
    // holder rule names SUPERVISOR as a holder (SEC35-18, OD-09), it is not a grant and joins no
    // table. Every other occurrence of a role name stays forbidden.
    const holderLine = /principal\.role === OperatorRole\.SUPERVISOR/;
    const roleWord = new RegExp(ROLE_NAME.source, 'g'); // ROLE_NAME itself keeps its /g cursor for the scanner
    const namedLines = ownCode.flatMap((file) =>
      file.text
        .split('\n')
        .map((line, index) => ({ line: `${file.path}:${index + 1}`, text: line }))
        .filter((entry) => {
          roleWord.lastIndex = 0;
          return roleWord.test(entry.text) && !holderLine.test(entry.text);
        }),
    );
    expect(namedLines.map((entry) => entry.line)).toEqual([]);
    expect(places(ROLE_NAME).every((place) => place.startsWith('src/plugins/permission-guard/decision.ts:'))).toBe(true);
    // Positive control.
    const sample: SourceFile[] = [{ path: 'src/sample.ts', text: `const GRANTS = { ${'TECHNICIAN'}: ['MAINTENANCE'] }; const t = ${['ROLE', 'PERMISSIONS'].join('_')}.X;` }];
    expect([occurrences(sample, ROLE_NAME).length, occurrences(sample, SHARED_TABLE).length]).toEqual([1, 1]);
  });

  it('the RBAC module names no permission and reads none: who may call is the access rule of the registry', () => {
    const rbac = ownCode.filter((file) => file.path.startsWith('src/modules/rbac/'));
    expect(places(PERMISSION_NAME, rbac)).toEqual([]);
    expect(places(/\brequest\s*\.\s*principal\b/g, rbac)).toEqual([]);
  });
});

describe('the whole server (decision D82)', () => {
  it('no production file replaces a stage or a seam: a test alone can take stage 6 out of the pipeline', () => {
    expect(places(SLOT_REPLACED, serverCode)).toEqual([]);
  });

  it('no production file imports from a __tests__ folder: the test support of the guard cannot reach the server', () => {
    expect(places(TEST_IMPORT, serverCode)).toEqual([]);
  });

  it('no file that is loaded before the guard registers a route: every route of the server is shown to its boot check', () => {
    // `app.ts` registers the units in this order: core, the three other stage plugins, the
    // guard, and only then the engine, the realtime channel and the modules. The entry point
    // adds no route either.
    const early = serverCode.filter(
      (file) => file.path === 'src/app.ts' || file.path === 'src/index.ts' || file.path === 'src/config.ts' || file.path.startsWith('src/core/') || file.path.startsWith('src/plugins/'),
    );
    expect(early.length).toBeGreaterThan(30);
    expect(places(ROUTE_REGISTRATION, early)).toEqual([]);
    const factory = serverCode.find((file) => file.path === 'src/app.ts')?.text ?? '';
    const order = ['plugins/permission-guard', 'engine', 'realtime', 'modules/health', 'modules/rbac'].map((unit) => factory.indexOf(`['${unit}',`));
    expect(order.every((position) => position > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('routes are registered by the modules and nowhere else; the guard is loaded before all of them', () => {
    const registering = files(ROUTE_REGISTRATION, serverCode);
    expect(registering.every((path) => path.startsWith('src/modules/') || path.startsWith('src/realtime/'))).toBe(true);
    expect(registering).toContain('src/modules/rbac/index.ts');
  });
});
