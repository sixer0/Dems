// Static guards of the biometric token (plan row W41; standing rules M1 to M15 of the module
// rows). They read the production sources of this row's folder as text, with the scaffold's
// scanner, and keep its rules true for every later row that touches them:
//
//   1. Who may call is stage 6 only: no permission, role, session or device check here, no
//      denial row of the guard, no route hook (M3).
//   2. Who ACTS is read from what stage 4 resolved; the one operator a request names is never an
//      actor until the store has said that the device has that operator's enrolment (SR-37, SR-65).
//   3. Server-native only: no simulator action, no hosted command, no engine state (M4); every
//      state change is a unit of the pipeline; a publication leaves after the commit (M5).
//   4. One clock, no timer of its own (M8).
//   5. One random source and one hash: only `tokens.ts` names the crypto module; no token and no
//      hash is ever compared in this process.
//   6. No cookie: no answer of this folder sets or clears one (M8; decision D69).
//   7. Logging: no file of the folder logs at all, so no token can reach a log line from here
//      (M14; SR-48).
//   8. Statements: constant texts with bind parameters, every table with its schema, every
//      transition a compare-and-set, and the hash column in no SELECT list and no RETURNING
//      (SR-67; NL-1, NL-3).
//   9. One audit path: nothing here inserts into the audit table or the events table itself (M5).
//
// Every forbidden text is built from fragments, so that this file does not contain it.
import { describe, expect, it } from 'vitest';
import { WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, type SourceFile } from '../../../../../test/static/scan';
import * as store from '../store';

const OWN_FOLDER = 'src/modules/identity/biometric/';

const all = readTree(WORKSPACE).filter((file) => isProductionSource(file.path) && file.path.startsWith(OWN_FOLDER));
const code = codeOnly(all);
const files = (pattern: RegExp, where: readonly SourceFile[] = code): string[] => [
  ...new Set(occurrences(where, pattern).map((place) => place.replace(/:\d+$/, ''))),
];
const textOf = (name: string): string => code.find((file) => file.path === `${OWN_FOLDER}${name}`)?.text ?? '';

const ACCESS_CHECK = new RegExp(
  [
    `\\b${'permissions'}\\s*\\.\\s*(?:includes|some|every|indexOf|has)\\b`,
    `\\.\\s*${'role'}\\s*(?:===|!==|==|!=)`,
    `\\b${'ROLE'}_${'PERMISSIONS'}\\b`,
    `\\bprincipal\\s*\\.\\s*${'kind'}\\b`,
    `\\b${'retired'}${'DeviceId'}\\b`,
    `\\bPermission\\s*\\.\\s*[A-Z_]+\\b`,
    `\\b${'decide'}${'Access'}\\b`,
  ].join('|'),
  'g',
);
const DENIAL_ROW = new RegExp([`\\b${'ACCESS'}_${'DENIED'}\\b`, `\\b${'EXPORT'}_${'DENIED'}\\b`, `\\b${'NOT'}_${'PERMITTED'}\\b`].join('|'), 'g');
const ROUTE_HOOK = new RegExp(`\\b(?:on${'Request'}|pre${'Handler'}|pre${'Validation'}|pre${'Parsing'}|pre${'Serialization'}|attach${'Validation'})\\s*:`, 'g');
const RAW_ROUTE = new RegExp(`\\b(?:app|routes|instance)\\s*\\.\\s*(?:get|post|put|delete|patch)\\s*\\(`, 'g');
const SIMULATOR = new RegExp([`\\bbiometric${'SignIn'}\\b`, `\\bbiometric${'Failure'}\\b`, `\\bengine\\s*\\.\\s*(?:command|run|state|slice)\\b`, `\\bcreate${'Sim'}\\b`, `\\brecord${'Biometric'}Failure\\b`].join('|'), 'g');
const SYSTEM_TIME = new RegExp([`\\bDate\\s*\\.\\s*${'now'}\\s*\\(`, `\\bnew\\s+Date\\s*\\(`, `\\bperformance\\s*\\.\\s*${'now'}\\b`, `\\bhr${'time'}\\b`].join('|'), 'g');
const TIMER = new RegExp(`\\bset(?:${'Timeout'}|${'Interval'}|${'Immediate'})\\s*\\(`, 'g');
const CRYPTO = new RegExp(`['"]node:${'crypto'}['"]|\\bMath\\s*\\.\\s*${'random'}\\b`, 'g');
const COOKIE = new RegExp(`\\b(?:set|clear)${'Cookie'}\\b|\\b(?:set|clear)Session${'Cookie'}\\b|['"\`]set-${'cookie'}['"\`]|\\bcookies\\b`, 'gi');
const LOG_CALL = new RegExp(`\\blog\\s*\\.\\s*(?:trace|debug|info|warn|error|fatal)\\s*\\(|\\b${'console'}\\s*\\.|\\berror${'Log'}\\b`, 'g');
const REQUEST_DATA = new RegExp(`\\brequest\\s*\\.\\s*(?:raw\\s*\\.\\s*)?${'url'}\\b|\\boriginal${'Url'}\\b|\\brequest\\s*\\.\\s*${'headers'}\\b|\\brequest\\s*\\.\\s*${'query'}\\b|\\brequest\\s*\\.\\s*${'params'}\\b`, 'g');
const ENVIRONMENT = new RegExp(`\\bprocess\\s*\\.\\s*${'env'}\\b|\\.\\s*${'listen'}\\s*\\(`, 'g');
const SIGNING = new RegExp([`\\bcreate${'Hmac'}\\b`, `\\bjson${'webtoken'}\\b`, `\\b${'jwt'}\\b`, `\\b${'pepper'}\\b`].join('|'), 'gi');
const OWN_AUDIT_INSERT = new RegExp(`\\binsert\\s+into\\s+(?:public\\s*\\.\\s*)?(?:${['audit', 'log'].join('_')}|events)\\b`, 'gi');
const STAGE_OR_SEAM_REPLACED = new RegExp(`\\b(?:stages|seams)\\s*\\.\\s*${'replace'}\\s*\\(`, 'g');
const OWN_POOL = new RegExp(`\\bdb\\s*\\.\\s*${'pool'}\\b|\\bnew\\s+${'Pool'}\\b|\\bunit\\s*\\.\\s*db\\b`, 'g');

describe('the scan itself', () => {
  it('reads the production sources of the folder', () => {
    expect(all.map((file) => file.path)).toEqual([
      'src/modules/identity/biometric/activity.ts',
      'src/modules/identity/biometric/enrolment.ts',
      'src/modules/identity/biometric/failure.ts',
      'src/modules/identity/biometric/index.ts',
      'src/modules/identity/biometric/routes.ts',
      'src/modules/identity/biometric/sign-in.ts',
      'src/modules/identity/biometric/store.ts',
      'src/modules/identity/biometric/tokens.ts',
    ]);
  });

  it('finds each forbidden text when it is present (positive control)', () => {
    const planted: SourceFile[] = [
      { path: 'a.ts', text: `if (!request.principal.${'permissions'}.includes(x)) throw y; if (session.operator.${'role'} === 'SUPERVISOR') z(); if (request.principal.${'kind'} === 'DEVICE') w(); const r = principal.${'retired'}${'DeviceId'}; const p = Permission.USER_ADMIN;` },
      { path: 'b.ts', text: `await unit.audit.append({ type: '${'ACCESS'}_${'DENIED'}' }); throw new ApiFailure(403, '${'NOT'}_${'PERMITTED'}', '');` },
      { path: 'c.ts', text: `routes.route({ on${'Request'}: async () => {}, pre${'Handler'}: check, attach${'Validation'}: true, handler }); app.get('/x', h); routes.post('/y', h);` },
      { path: 'd.ts', text: `biometric${'SignIn'}(state, now, id); await app.engine.command(p, 'signInWithBiometric'); app.engine.state();` },
      { path: 'e.ts', text: `const t = Date.${'now'}(); const d = new Date(); set${'Timeout'}(() => {}, 1); set${'Interval'}(tick, 5);` },
      { path: 'f.ts', text: `import { randomBytes } from 'node:${'crypto'}'; const r = Math.${'random'}();` },
      { path: 'g.ts', text: `reply.set${'Cookie'}('a', 'b'); reply.header('Set-${'Cookie'}', 'a=b'); clearSession${'Cookie'}(reply, n);` },
      { path: 'h.ts', text: `request.log.warn({ token }, 'x'); app.log.error({ err }, 'y'); ${'console'}.log(1); app.error${'Log'}.append(e);` },
      { path: 'i.ts', text: `f(request.${'url'}, request.raw.${'url'}, request.${'headers'}, request.${'query'}, request.${'params'}, process.${'env'}.X); app.${'listen'}({ port: 1 });` },
      { path: 'j.ts', text: `await unit.query('INSERT INTO public.${['audit', 'log'].join('_')} (seq) VALUES ($1)'); await unit.query('insert into events (seq) values ($1)');` },
      { path: 'k.ts', text: `app.stages.${'replace'}('accessRule', () => {}); app.seams.${'replace'}('publish', f); create${'Hmac'}('sha256', k); app.db.${'pool'}.query(x); unit.db.select();` },
    ];
    expect(occurrences(planted, ACCESS_CHECK)).toHaveLength(5);
    expect(occurrences(planted, DENIAL_ROW)).toHaveLength(2);
    expect(occurrences(planted, ROUTE_HOOK)).toHaveLength(3);
    expect(occurrences(planted, RAW_ROUTE)).toHaveLength(2);
    expect(occurrences(planted, SIMULATOR)).toHaveLength(3);
    expect(occurrences(planted, SYSTEM_TIME)).toHaveLength(2);
    expect(occurrences(planted, TIMER)).toHaveLength(2);
    expect(occurrences(planted, CRYPTO)).toHaveLength(2);
    expect(occurrences(planted, COOKIE)).toHaveLength(3);
    expect(occurrences(planted, LOG_CALL)).toHaveLength(4);
    expect(occurrences(planted, REQUEST_DATA)).toHaveLength(5);
    expect(occurrences(planted, ENVIRONMENT)).toHaveLength(2);
    expect(occurrences(planted, OWN_AUDIT_INSERT)).toHaveLength(2);
    expect(occurrences(planted, STAGE_OR_SEAM_REPLACED)).toHaveLength(2);
    expect(occurrences(planted, SIGNING)).toHaveLength(1);
    expect(occurrences(planted, OWN_POOL)).toHaveLength(2);
  });
});

describe('rule 1 (M3): who may call is stage 6, only', () => {
  it('no file checks a permission, compares a role, reads the kind of the principal or a retired device', () => {
    expect(occurrences(code, ACCESS_CHECK)).toEqual([]);
    // The one role that is read is the operator's who just signed in, to answer the permissions of the new session.
    expect(occurrences(code, /\.\s*role\b/g)).toHaveLength(1);
    expect(textOf('sign-in.ts')).toMatch(/const permissions = await readRolePermissions\(unit, operator\.role\);/);
  });

  it('no file writes or answers a denial of the guard', () => {
    expect(occurrences(code, DENIAL_ROW)).toEqual([]);
  });

  it('no route carries a hook, every route is built from its registry entry, and nothing replaces a stage or a seam', () => {
    expect(occurrences(code, ROUTE_HOOK)).toEqual([]);
    expect(occurrences(code, RAW_ROUTE)).toEqual([]);
    expect(occurrences(code, STAGE_OR_SEAM_REPLACED)).toEqual([]);
    const routes = textOf('routes.ts');
    expect(routes.match(/routes\.route\(\{/g)).toHaveLength(3);
    expect(routes.match(/\.\.\.routeOfOperation\(operationOf\('[A-Za-z]+'\)\),/g)).toHaveLength(3);
    expect(files(/\.route\(/g)).toEqual(['src/modules/identity/biometric/routes.ts']);
  });

  it('the session that turning biometric sign-in ON needs is stated by the issuing statement, not checked by a handler', () => {
    // No file compares the method of a session before the unit; the one comparison is the unit's own "why" after the statement returned no row.
    expect(occurrences(code, /\.\s*method\s*(?:===|!==)/g).map((place) => place.replace(/:\d+$/, ''))).toEqual(['src/modules/identity/biometric/enrolment.ts']);
    expect(textOf('enrolment.ts')).toMatch(/if \(session\.method !== 'PASSWORD'\) return passwordSessionRequired\(\);/);
    expect(textOf('enrolment.ts')).toMatch(/if \(enrolled === null\) throw enrolmentRefusal\(await readEnrolmentSession\(unit, sessionId\)\);/);
    expect(store.ENROL_TOKEN).toMatch(/WHERE s\.id = \$3 AND s\.ended_at IS NULL AND s\.method = 'PASSWORD' AND o\.enabled AND d\.state = 'PAIRED' RETURNING/);
  });
});

describe('rule 2 (SR-37, SR-65): who acts is what stage 4 resolved', () => {
  it('the readers of stage 4 are called in the routes and nowhere else: the sign-in reads no session of the request, because none is presented with it (the registry\'s condition DEVICE_CREDENTIAL on operation 8, decision D118)', () => {
    const readers = /\b(?:operatorSessionOf|pairedDeviceOf|authenticationOf)\(/g;
    expect(files(readers)).toEqual(['src/modules/identity/biometric/routes.ts']);
    // The unit of the sign-in ends no session of its own accord: the branch that ended a presented
    // session as ROTATED is gone. The sessions of a reuse are ended through the registry.
    expect(textOf('sign-in.ts')).not.toMatch(/\bendSession\b|\bpresentedSession\b|ROTATED/);
    expect(files(/\bendSession\b|'ROTATED'/g)).toEqual([]);
  });

  it('a handler reads three members of a body, each once, and no header, query string, path parameter or raw URL', () => {
    expect([...textOf('routes.ts').matchAll(/\brequest\s*\.\s*body\s*\.\s*([A-Za-z]+)/g)].map((match) => match[1])).toEqual(['enabled', 'token', 'operatorId']);
    expect(files(/\brequest\s*\.\s*body\b/g)).toEqual(['src/modules/identity/biometric/routes.ts']);
    expect(occurrences(code, REQUEST_DATA)).toEqual([]);
  });

  it('the operator a failure report names becomes the actor of its row only behind the enrolment lookup', () => {
    const failure = textOf('failure.ts');
    expect(failure).toMatch(/const enrolled = await hasEnrolment\(unit, deviceId, believedOperatorId \?\? NO_OPERATOR\);/);
    expect(failure).toMatch(/await appendActivity\(unit, rowFor\(enrolled \? believedOperatorId : null\)\);/);
    // Named in the signature, in the lookup and in that one expression: three times, and never handed to a builder directly.
    expect(failure.match(/\bbelievedOperatorId\b/g)).toHaveLength(3);
    expect(failure).not.toMatch(/operatorId:\s*believedOperatorId/);
  });

  it('the sign-in names no operator of the request: the operator of a session is the claimed token\'s, and the device is the request\'s credential', () => {
    const signIn = textOf('sign-in.ts');
    expect(signIn).toMatch(/const claimed = await claimToken\(unit, tokenHash, deviceId, now\);/);
    expect(signIn).toMatch(/await markSignedIn\(unit, claimed\.operatorId, now\)/);
    expect(signIn).toMatch(/issueSession\(unit, \{ operatorId: operator\.id, deviceId, method: AuthMethod\.BIOMETRIC, now \}\)/);
    // The presented token goes to the hash and nowhere else.
    expect(signIn.match(/\bpresentedToken\b/g)).toHaveLength(2);
    expect(signIn).toMatch(/const tokenHash = biometricTokenHash\(presentedToken\);/);
  });
});

describe('rule 3 (M4, M5): server-native only, in units, with publications after the commit', () => {
  it('no simulator action, no hosted command, no engine state: the code of the folder does not name the engine, and sets no header of API-7', () => {
    expect(occurrences(code, SIMULATOR)).toEqual([]);
    // The two headers of API-7 are the engine unit's (`src/engine/api-headers.ts`, decision D87).
    expect(files(/\bengine\b/g)).toEqual([]);
    expect(files(/_HEADER_NAME\b|\.header\s*\(/g)).toEqual([]);
  });

  it('every state change is a unit of the pipeline, with a label of its own; nothing reads or writes outside a unit', () => {
    expect(code.flatMap((file) => [...file.text.matchAll(/pipeline\.run\(([A-Z_a-z.]+),/g)].map((match) => match[1] ?? '')).sort()).toEqual([
      'ENROLMENT_UNIT_LABEL.disable',
      'ENROLMENT_UNIT_LABEL.enrol',
      'FAILURE_UNIT_LABEL',
      'SIGN_IN_UNIT_LABEL',
    ]);
    expect(code.flatMap((file) => [...file.text.matchAll(/'(identity\.biometric\.[A-Za-z]+)'/g)].map((match) => match[1])).sort()).toEqual([
      'identity.biometric.disable',
      'identity.biometric.enrol',
      'identity.biometric.failure',
      'identity.biometric.signIn',
    ]);
    expect(occurrences(code, OWN_POOL)).toEqual([]);
  });

  it('a publication leaves only after the commit of its unit: every `app.publish` of the folder is inside an `afterCommit` task', () => {
    expect(files(/\bapp\.publish\(/g)).toEqual(['src/modules/identity/biometric/sign-in.ts']);
    const signIn = textOf('sign-in.ts');
    // One publication in the folder: the reuse, and the task is the publication itself.
    expect(signIn.match(/\bapp\.publish\(/g)).toHaveLength(1);
    expect(signIn).toMatch(/if \(sessionIds\.length > 0\) unit\.afterCommit\(\(\) => app\.publish\(\{ kind: 'session\.ended', sessionIds, reason: 'TOKEN_REUSE' \}\)\);/);
    // The success publishes nothing (no session is presented with a biometric sign-in, so none is
    // ended: decision D118); its task clears the device's count, after the commit.
    expect(signIn).toMatch(/unit\.afterCommit\(\(\) => lockout\.succeed\(deviceId\)\);/);
    expect(signIn.match(/\bunit\.afterCommit\(/g)).toHaveLength(2);
  });

  it('the sessions of a reuse are ended through the registry, and with the device and the operator of the TOKEN', () => {
    expect(textOf('sign-in.ts')).toMatch(/const sessionIds = await app\.sessionRegistry\.endBiometricSessions\(unit, tokenDevice, tokenOperator\);/);
    // No statement of this folder updates a session.
    for (const text of Object.values(store).flatMap((value) => (typeof value === 'string' ? [value] : typeof value === 'object' && value !== null ? Object.values(value).map(String) : []))) {
      expect(text).not.toMatch(/UPDATE public\.auth_sessions/);
    }
  });

  it('the attempt is taken as the first step of a unit, before the claim and before any statement', () => {
    const signIn = textOf('sign-in.ts');
    expect(signIn.indexOf('await lockout.take(deviceId, now)')).toBeGreaterThan(signIn.indexOf('app.pipeline.run(SIGN_IN_UNIT_LABEL'));
    expect(signIn.indexOf('await lockout.take(deviceId, now)')).toBeLessThan(signIn.indexOf('await claimToken('));
    const failure = textOf('failure.ts');
    expect(failure.indexOf('await lockout.take(deviceId, now)')).toBeLessThan(failure.indexOf('await hasEnrolment('));
    // One place where a token is claimed, in the whole folder.
    expect(code.flatMap((file) => file.text.match(/\bclaimToken\(/g) ?? [])).toHaveLength(2);
    expect(files(/\bclaimToken\(/g)).toEqual(['src/modules/identity/biometric/sign-in.ts', 'src/modules/identity/biometric/store.ts']);
  });

  it('the place in the denial budget is taken before each refusal row, inside the unit, and the 429 is thrown after it', () => {
    for (const name of ['sign-in.ts', 'failure.ts']) {
      const text = textOf(name);
      expect(text.match(/await app\.denialBudget\.consume\(request\);/g), name).toHaveLength(1);
      expect(text, name).toMatch(/if \(outcome\.limited !== null\) throw outcome\.limited;/);
    }
    expect(files(/\bdenialBudget\b/g)).toEqual(['src/modules/identity/biometric/failure.ts', 'src/modules/identity/biometric/sign-in.ts']);
    expect(textOf('sign-in.ts')).toMatch(/if \(limited === null \|\| refused\.changed\) \{\s*await appendActivity\(/);
    expect(textOf('failure.ts')).toMatch(/if \(limited === null\) await appendActivity\(/);
  });
});

describe('rule 4 (M8): one clock, no timer of its own', () => {
  it('no file reads the system time, starts a timer, reads the environment or listens', () => {
    expect(occurrences(code, SYSTEM_TIME)).toEqual([]);
    expect(occurrences(code, TIMER)).toEqual([]);
    expect(occurrences(code, ENVIRONMENT)).toEqual([]);
    expect(files(/\bapp\.clock\.now\(\)/g)).toEqual([
      'src/modules/identity/biometric/enrolment.ts',
      'src/modules/identity/biometric/failure.ts',
      'src/modules/identity/biometric/sign-in.ts',
    ]);
  });
});

describe('rule 5: one random source, one hash, no comparison', () => {
  it('only tokens.ts names the crypto module, and nothing uses a weak random source', () => {
    expect(files(CRYPTO)).toEqual(['src/modules/identity/biometric/tokens.ts']);
  });

  it('the token is drawn with randomBytes, the family with randomUUID, the hash is SHA-256 over the whole value', () => {
    const tokens = textOf('tokens.ts');
    expect(tokens).toMatch(/import \{ createHash, randomBytes, randomUUID \} from 'node:crypto';/);
    expect(tokens).toMatch(/newBiometricToken\(random: \(size: number\) => Buffer = randomBytes\)/);
    expect(tokens).toMatch(/createHash\('sha256'\)\.update\(token, 'utf8'\)\.digest\(\)/);
    expect(tokens).toMatch(/return randomUUID\(\);/);
  });

  it('no token and no hash is compared in this process: a presented value is found by its hash, by the database', () => {
    expect(occurrences(code, /\b(?:token|tokenHash|token_hash|presentedToken|biometricToken)\s*(?:===|!==|==|!=)/g)).toEqual([]);
    expect(occurrences(code, /\.equals\(|\btimingSafeEqual\b|\.compare\(/g)).toEqual([]);
  });

  it('SR-61: no signing secret and no pepper', () => {
    expect(occurrences(code, SIGNING)).toEqual([]);
  });
});

describe('rule 6 (M8, decision D69): no cookie', () => {
  it('no file sets, clears or reads a cookie', () => {
    expect(occurrences(code, COOKIE)).toEqual([]);
  });
});

describe('rule 7 (M14, SR-48): logging', () => {
  it('no file of the folder logs: no log call, no console call, no entry of the persistent error log', () => {
    // Nothing here catches an error to log it: a failed unit is logged by the core and the
    // error envelope, as `{ err }`, and a refusal puts its code on the request line.
    expect(occurrences(code, LOG_CALL)).toEqual([]);
    expect(occurrences(code, /\berror\s*\.\s*message\b|\.\s*message\s*\}/g)).toEqual([]);
  });

  it('the only errors caught are the denial budget\'s 429, handed on unchanged', () => {
    expect(code.flatMap((file) => [...file.text.matchAll(/\bcatch\s*\((\w+)\)\s*\{\s*return \1;\s*\}/g)].map(() => file.path))).toEqual([
      'src/modules/identity/biometric/failure.ts',
      'src/modules/identity/biometric/sign-in.ts',
    ]);
    expect(code.flatMap((file) => file.text.match(/\bcatch\b/g) ?? [])).toHaveLength(2);
  });

  it('no answer of a refusal is built from a value: every text of an ApiFailure is a constant', () => {
    const failures = code.flatMap((file) => [...file.text.matchAll(/new ApiFailure\(\s*(\d{3}),\s*ApiErrorCode\.([A-Z_]+),\s*'([^']+)'/g)].map((match) => `${match[1]} ${match[2]}: ${match[3]}`));
    expect(failures.sort()).toEqual([
      '401 INVALID_CREDENTIALS: Biometric sign-in was not accepted. Sign in with the password.',
      '403 DEVICE_NOT_PAIRED: Biometric sign-in is set up on a paired device.',
      '403 DEVICE_NOT_PAIRED: Sign in with your password to turn biometric sign-in on.',
    ]);
    expect(code.flatMap((file) => file.text.match(/new ApiFailure\(/g) ?? [])).toHaveLength(3);
  });
});

describe('rule 8: the statements', () => {
  const statements = Object.entries(store)
    .flatMap(([name, value]): Array<[string, string]> => {
      if (typeof value === 'string') return [[name, value]];
      if (typeof value === 'object' && value !== null) return Object.entries(value).map(([key, text]) => [`${name}.${key}`, String(text)]);
      return [];
    })
    .sort(([a], [b]) => a.localeCompare(b));
  const textOfStatement = (name: string): string => statements.find(([candidate]) => candidate === name)?.[1] ?? '';

  it('are constant texts: every exported statement of the store is listed here', () => {
    expect(statements.map(([name]) => name)).toEqual([
      'CLAIM_TOKEN',
      'ENROL_TOKEN',
      'FIND_ENROLMENT',
      'INSERT_TOKEN',
      'READ_ENROLMENT_SESSION',
      'READ_TOKEN_STATE',
      'REVOKE_TOKENS.DEVICE',
      'REVOKE_TOKENS.ENROLMENT',
      'REVOKE_TOKENS.FAMILY',
      'REVOKE_TOKENS.OPERATOR',
    ]);
  });

  it('name every table with its schema, hold no value (only bind parameters and two fixed words of the schema), and are single statements', () => {
    for (const [name, text] of statements) {
      const tables = [...text.matchAll(/\b(?:FROM|JOIN|UPDATE|INTO)\s+([a-z_.]+)/g)].map((match) => match[1]);
      expect(tables.length, name).toBeGreaterThan(0);
      expect(tables.filter((table) => !table?.startsWith('public.')), name).toEqual([]);
      const literals = [...text.matchAll(/'([^']*)'/g)].map((match) => match[1]);
      expect(literals.filter((word) => !['PASSWORD', 'PAIRED'].includes(word ?? '')), name).toEqual([]);
      expect(text.includes(';'), name).toBe(false);
      expect(text.includes('${'), name).toBe(false);
      expect(text, name).toMatch(/\$1\b/);
    }
    // The only tables written are the tokens; three others are read.
    const written = new Set(statements.flatMap(([, text]) => [...text.matchAll(/\b(?:UPDATE|INSERT INTO)\s+public\.([a-z_]+)/g)].map((match) => match[1])));
    expect([...written]).toEqual(['biometric_tokens']);
    const named = new Set(statements.flatMap(([, text]) => [...text.matchAll(/\bpublic\.([a-z_]+)/g)].map((match) => match[1])));
    expect([...named].sort()).toEqual(['auth_sessions', 'biometric_tokens', 'operators', 'paired_devices']);
  });

  it('THE CLAIM is one compare-and-set: it states the hash, the device, not used, not revoked and not expired, and returns what it changed (AT-C4)', () => {
    expect(textOfStatement('CLAIM_TOKEN')).toBe(
      'UPDATE public.biometric_tokens SET used_at = $2 WHERE token_hash = $1 AND device_id = $3 AND used_at IS NULL AND revoked_at IS NULL AND expires_at > $2 RETURNING id, family_id, operator_id',
    );
    // It is the only statement that sets `used_at`.
    expect(statements.filter(([, text]) => /\bSET\b[^W]*\bused_at\s*=/.test(text)).map(([name]) => name)).toEqual(['CLAIM_TOKEN']);
  });

  it('every revocation is a compare-and-set on `revoked_at IS NULL`; the two scopes for other modules revoke live tokens only', () => {
    const where: Record<string, RegExp> = {
      'REVOKE_TOKENS.FAMILY': /WHERE family_id = \$3 AND revoked_at IS NULL RETURNING id$/,
      'REVOKE_TOKENS.ENROLMENT': /WHERE device_id = \$3 AND operator_id = \$4 AND revoked_at IS NULL RETURNING id$/,
      'REVOKE_TOKENS.DEVICE': /WHERE device_id = \$3 AND used_at IS NULL AND revoked_at IS NULL RETURNING id$/,
      'REVOKE_TOKENS.OPERATOR': /WHERE operator_id = \$3 AND used_at IS NULL AND revoked_at IS NULL RETURNING id$/,
    };
    for (const [name, pattern] of Object.entries(where)) {
      expect(textOfStatement(name), name).toMatch(/^UPDATE public\.biometric_tokens SET revoked_at = \$1, revoke_reason = \$2 WHERE /);
      expect(textOfStatement(name), name).toMatch(pattern);
    }
    // Every UPDATE of the store is the claim or a revocation: the three columns the runtime role may write.
    expect(statements.filter(([, text]) => text.startsWith('UPDATE ')).map(([name]) => name)).toEqual(['CLAIM_TOKEN', ...Object.keys(where).sort()]);
    for (const [name, text] of statements.filter(([, candidate]) => candidate.startsWith('UPDATE '))) {
      const assigned = [...(/\bSET\s+(.*?)\s+WHERE\b/.exec(text)?.[1] ?? '').matchAll(/([a-z_]+)\s*=/g)].map((match) => match[1]);
      expect(assigned.filter((column) => !['used_at', 'revoked_at', 'revoke_reason'].includes(column ?? '')), name).toEqual([]);
    }
  });

  it('a token is inserted by two statements: the rotation, and the enrolment, which takes the device and the operator from the open password session', () => {
    expect(statements.filter(([, text]) => text.startsWith('INSERT ')).map(([name]) => name)).toEqual(['ENROL_TOKEN', 'INSERT_TOKEN']);
    expect(textOfStatement('ENROL_TOKEN')).toMatch(/SELECT \$1::bytea, \$2::uuid, s\.device_id, s\.operator_id, \$4::bigint, \$5::bigint FROM public\.auth_sessions s /);
    expect(textOfStatement('INSERT_TOKEN')).toMatch(/VALUES \(\$1, \$2, \$3, \$4, \$5, \$6\) RETURNING id$/);
  });

  it('the hash is written by the two inserts and is a WHERE parameter of two statements; it is never selected and never returned', () => {
    const hash = ['token', 'hash'].join('_');
    expect(statements.filter(([, text]) => text.includes(hash)).map(([name]) => name)).toEqual(['CLAIM_TOKEN', 'ENROL_TOKEN', 'INSERT_TOKEN', 'READ_TOKEN_STATE']);
    for (const [name, text] of statements) {
      const returned = /\bRETURNING\s+(.*)$/s.exec(text)?.[1] ?? '';
      const selected = /^SELECT\s+(.*?)\s+FROM\s+public\./s.exec(text)?.[1] ?? '';
      expect(returned.includes(hash), name).toBe(false);
      expect(selected.includes(hash), name).toBe(false);
      expect(/SELECT\s+\*/i.test(text), name).toBe(false);
    }
    // Outside the store nothing names the column at all, and no row type of the store has a member for it.
    expect(files(new RegExp(hash, 'g'))).toEqual(['src/modules/identity/biometric/store.ts']);
    expect(textOf('store.ts')).not.toMatch(/token_hash\s*:/);
  });

  it('the enrolment lookup of a failure report asks for the device and the operator together, for a token that was not revoked, and for an operator who is enabled (CPS1-8)', () => {
    expect(textOfStatement('FIND_ENROLMENT')).toBe(
      'SELECT 1 AS found FROM public.biometric_tokens t JOIN public.operators o ON o.id = t.operator_id ' +
        'WHERE t.device_id = $1 AND t.operator_id = $2 AND t.revoked_at IS NULL AND o.enabled LIMIT 1',
    );
    // It reads; it returns no column of either table.
    expect(textOfStatement('FIND_ENROLMENT')).toMatch(/^SELECT 1 AS found FROM /);
  });

  it('no statement is written outside the store', () => {
    const sql = /['"`](?:SELECT|INSERT|UPDATE|DELETE)\s/g;
    expect(files(sql)).toEqual(['src/modules/identity/biometric/store.ts']);
    expect(occurrences(code, /\bDELETE\s+FROM\b/gi)).toEqual([]);
  });
});

describe('rule 9 (M5): one audit path', () => {
  it('nothing here inserts into the audit table or the events table itself: the rows go through the unit\'s writers', () => {
    expect(occurrences(code, OWN_AUDIT_INSERT)).toEqual([]);
    // The enrolment's row is audit-only and is appended in its unit; the three sign-in types go through the identity module's `appendActivity`.
    expect(files(/\bunit\.audit\.append\(/g)).toEqual(['src/modules/identity/biometric/enrolment.ts']);
    expect(files(/\bunit\.events\.append\(/g)).toEqual([]);
    expect(files(/\bappendActivity\(unit,/g)).toEqual(['src/modules/identity/biometric/failure.ts', 'src/modules/identity/biometric/sign-in.ts']);
  });

  it('no builder of a row takes a secret: none has a parameter for a token, a hash or a family', () => {
    const activity = textOf('activity.ts');
    expect(activity).not.toMatch(/\b(?:token|tokenHash|hash|biometricToken|sessionToken|credential|familyId)\s*[?]?:\s*(?:string|Buffer)/);
    expect([...new Set([...activity.matchAll(/type: '([A-Z_]+)'/g)].map((match) => match[1]))]).toEqual(['BIOMETRIC_ENROLLMENT_CHANGED']);
    // The three sign-in types are the identity module's builders, called with the method BIOMETRIC.
    expect(activity).toMatch(/import \{ attemptFailed, attemptLocked, signedIn, type Activity \} from '\.\.\/activity';/);
    expect(activity.match(/method: BIOMETRIC/g)).toHaveLength(4);
  });
});
