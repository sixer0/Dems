// Static guards of the pairing module (plan row W32; standing rules M1 to M14 of the module
// rows). They read the production sources of this row's folder as text, with the scaffold's
// scanner, and keep its rules true for every later row that touches them:
//
//   1. Who may call is stage 6 only: no permission, role, session or device check here, no
//      denial row, no route hook (M3).
//   2. Server-native only: no simulator action, no hosted command, no engine state (M4).
//   3. One clock, no timer of its own (M8).
//   4. One random source and one hash: only `secrets.ts` names the crypto module.
//   5. No cookie: no answer of this module sets or clears one (M8; decision D69).
//   6. Logging: an error is logged as `{ err }` and under no other key; no console, no raw URL,
//      no body, no header (M14; SR-48).
//   7. Statements: constant texts with bind parameters, every table with its schema, every
//      transition a compare-and-set, and no hash column in an answer path (SR-67; NL-1, NL-3).
//   8. One audit path: nothing here inserts into the audit table or the events table itself (M5).
//
// Every forbidden text is built from fragments, so that this file does not contain it.
import { describe, expect, it } from 'vitest';
import { WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, type SourceFile } from '../../../../test/static/scan';
import * as store from '../store';

const OWN_FOLDER = 'src/modules/pairing/';

const all = readTree(WORKSPACE).filter((file) => isProductionSource(file.path) && file.path.startsWith(OWN_FOLDER));
const code = codeOnly(all);
const files = (pattern: RegExp, where: readonly SourceFile[] = code): string[] => [
  ...new Set(occurrences(where, pattern).map((place) => place.replace(/:\d+$/, ''))),
];
const textOf = (name: string): string => code.find((file) => file.path === `${OWN_FOLDER}${name}`)?.text ?? '';

const ACCESS_CHECK = new RegExp(
  [
    `\\b${'permissions'}\\b`,
    `\\.\\s*${'role'}\\b`,
    `\\b${'ROLE'}_${'PERMISSIONS'}\\b`,
    `\\bprincipal\\s*\\.\\s*${'kind'}\\b`,
    `\\b${'retired'}${'DeviceId'}\\b`,
    `\\b${'PAIRING'}_${'MANAGE'}\\b`,
    `\\b${'decide'}${'Access'}\\b`,
  ].join('|'),
  'g',
);
const DENIAL_ROW = new RegExp([`\\b${'ACCESS'}_${'DENIED'}\\b`, `\\b${'EXPORT'}_${'DENIED'}\\b`, `\\b${'NOT'}_${'PERMITTED'}\\b`].join('|'), 'g');
const ROUTE_HOOK = new RegExp(`\\b(?:on${'Request'}|pre${'Handler'}|pre${'Validation'}|pre${'Parsing'}|pre${'Serialization'})\\s*:`, 'g');
const RAW_ROUTE = new RegExp(`\\b(?:app|routes|instance)\\s*\\.\\s*(?:get|post|put|delete|patch)\\s*\\(`, 'g');
const SIMULATOR = new RegExp([`\\bpair${'Transition'}\\b`, `\\bunpair${'Transition'}\\b`, `\\bengine\\s*\\.\\s*(?:command|run|state|slice)\\b`, `\\bcreate${'Sim'}\\b`, `\\b${'DEMO'}_${'PAIRING'}_${'CODE'}\\b`].join('|'), 'g');
const SYSTEM_TIME = new RegExp([`\\bDate\\s*\\.\\s*${'now'}\\s*\\(`, `\\bnew\\s+Date\\s*\\(`, `\\bperformance\\s*\\.\\s*${'now'}\\b`, `\\bhr${'time'}\\b`].join('|'), 'g');
const TIMER = new RegExp(`\\bset(?:${'Timeout'}|${'Interval'}|${'Immediate'})\\s*\\(`, 'g');
const CRYPTO = new RegExp(`['"]node:${'crypto'}['"]|\\bMath\\s*\\.\\s*${'random'}\\b`, 'g');
const COOKIE = new RegExp(`\\b(?:set|clear)${'Cookie'}\\b|\\b(?:set|clear)Session${'Cookie'}\\b|['"\`]set-${'cookie'}['"\`]|\\bcookies\\b`, 'gi');
const CONSOLE = new RegExp(`\\b${'console'}\\s*\\.`, 'g');
const REQUEST_DATA_IN_LOG = new RegExp(`\\brequest\\s*\\.\\s*(?:raw\\s*\\.\\s*)?${'url'}\\b|\\boriginal${'Url'}\\b|\\brequest\\s*\\.\\s*${'headers'}\\b`, 'g');
const ENVIRONMENT = new RegExp(`\\bprocess\\s*\\.\\s*${'env'}\\b|\\.\\s*${'listen'}\\s*\\(`, 'g');
const SIGNING = new RegExp([`\\bcreate${'Hmac'}\\b`, `\\bjson${'webtoken'}\\b`, `\\b${'jwt'}\\b`, `\\b${'pepper'}\\b`].join('|'), 'gi');
const OWN_AUDIT_INSERT = new RegExp(`\\binsert\\s+into\\s+(?:public\\s*\\.\\s*)?(?:${['audit', 'log'].join('_')}|events)\\b`, 'gi');
const STAGE_OR_SEAM_REPLACED = new RegExp(`\\b(?:stages|seams)\\s*\\.\\s*${'replace'}\\s*\\(`, 'g');

describe('the scan itself', () => {
  it('reads the production sources of the folder', () => {
    expect(all.map((file) => file.path)).toEqual([
      'src/modules/pairing/activity.ts',
      'src/modules/pairing/codes.ts',
      'src/modules/pairing/database.ts',
      'src/modules/pairing/devices.ts',
      'src/modules/pairing/index.ts',
      'src/modules/pairing/limits.ts',
      'src/modules/pairing/presence.ts',
      'src/modules/pairing/redeem-lock.ts',
      'src/modules/pairing/redeem.ts',
      'src/modules/pairing/resolver.ts',
      'src/modules/pairing/routes.ts',
      'src/modules/pairing/secrets.ts',
      'src/modules/pairing/store.ts',
    ]);
  });

  it('finds each forbidden text when it is present (positive control)', () => {
    const planted: SourceFile[] = [
      { path: 'a.ts', text: `if (!request.principal.${'permissions'}.includes(x)) throw y; if (session.${'role'} === 'SUPERVISOR') z(); if (request.principal.${'kind'} === 'DEVICE') w(); const r = principal.${'retired'}${'DeviceId'};` },
      { path: 'b.ts', text: `await unit.audit.append({ type: '${'ACCESS'}_${'DENIED'}' }); throw new ApiFailure(403, '${'NOT'}_${'PERMITTED'}', '');` },
      { path: 'c.ts', text: `routes.route({ on${'Request'}: async () => {}, pre${'Handler'}: check, handler }); app.get('/x', h); routes.post('/y', h);` },
      { path: 'd.ts', text: `pair${'Transition'}(state, now, code); await app.engine.command(p, 'pair'); app.engine.state();` },
      { path: 'e.ts', text: `const t = Date.${'now'}(); const d = new Date(); set${'Timeout'}(() => {}, 1); set${'Interval'}(tick, 5);` },
      { path: 'f.ts', text: `import { randomBytes } from 'node:${'crypto'}'; const r = Math.${'random'}();` },
      { path: 'g.ts', text: `reply.set${'Cookie'}('a', 'b'); reply.header('Set-${'Cookie'}', 'a=b'); clearSession${'Cookie'}(reply, n);` },
      { path: 'h.ts', text: `${'console'}.log(request.${'url'}, request.raw.${'url'}, request.${'headers'}, process.${'env'}.X); app.${'listen'}({ port: 1 });` },
      { path: 'i.ts', text: `await unit.query('INSERT INTO public.${['audit', 'log'].join('_')} (seq) VALUES ($1)'); await unit.query('insert into events (seq) values ($1)');` },
      { path: 'j.ts', text: `app.stages.${'replace'}('accessRule', () => {}); app.seams.${'replace'}('publish', f); create${'Hmac'}('sha256', k);` },
    ];
    expect(occurrences(planted, ACCESS_CHECK)).toHaveLength(4);
    expect(occurrences(planted, DENIAL_ROW)).toHaveLength(2);
    expect(occurrences(planted, ROUTE_HOOK)).toHaveLength(2);
    expect(occurrences(planted, RAW_ROUTE)).toHaveLength(2);
    expect(occurrences(planted, SIMULATOR)).toHaveLength(3);
    expect(occurrences(planted, SYSTEM_TIME)).toHaveLength(2);
    expect(occurrences(planted, TIMER)).toHaveLength(2);
    expect(occurrences(planted, CRYPTO)).toHaveLength(2);
    expect(occurrences(planted, COOKIE)).toHaveLength(3);
    expect(occurrences(planted, CONSOLE)).toHaveLength(1);
    expect(occurrences(planted, REQUEST_DATA_IN_LOG)).toHaveLength(3);
    expect(occurrences(planted, ENVIRONMENT)).toHaveLength(2);
    expect(occurrences(planted, OWN_AUDIT_INSERT)).toHaveLength(2);
    expect(occurrences(planted, STAGE_OR_SEAM_REPLACED)).toHaveLength(2);
    expect(occurrences(planted, SIGNING)).toHaveLength(1);
  });
});

describe('rule 1 (M3): who may call is stage 6, only', () => {
  it('no file reads a permission, a role, the kind of the principal or a retired device', () => {
    expect(occurrences(code, ACCESS_CHECK)).toEqual([]);
  });

  it('no file writes or answers a denial of the guard', () => {
    expect(occurrences(code, DENIAL_ROW)).toEqual([]);
  });

  it('no route carries a hook, every route is built from its registry entry, and nothing replaces a stage or a seam', () => {
    expect(occurrences(code, ROUTE_HOOK)).toEqual([]);
    expect(occurrences(code, RAW_ROUTE)).toEqual([]);
    expect(occurrences(code, STAGE_OR_SEAM_REPLACED)).toEqual([]);
    const routes = textOf('routes.ts');
    expect(routes.match(/routes\.route\(\{/g)).toHaveLength(9);
    expect(routes.match(/\.\.\.routeOfOperation\(operationOf\('[A-Za-z]+'\)\),/g)).toHaveLength(9);
  });

  it('who ACTS is read from what stage 4 resolved, in three places of the routes and one of the redeem, and from nothing a caller sends', () => {
    const readers = /\b(?:operatorSessionOf|pairedDeviceOf|authenticationOf)\(/g;
    expect(files(readers)).toEqual(['src/modules/pairing/redeem.ts', 'src/modules/pairing/routes.ts']);
    // No actor comes from a body, a query string or a path: the one member of a body that a
    // handler reads is the revoke's reason, and the one path parameter is the device to revoke.
    expect(occurrences(code, /\brequest\s*\.\s*body\s*\.\s*(?!reason\b)[A-Za-z]+/g)).toEqual([]);
    expect(occurrences(code, /\brequest\s*\.\s*query\b/g)).toEqual([]);
    expect(occurrences(code, /\b(?:operatorId|actorId)\s*:\s*request\s*\.\s*(?:body|query|params)\b/g)).toEqual([]);
    expect(files(/\brequest\s*\.\s*params\b/g)).toEqual(['src/modules/pairing/routes.ts']);
    expect(textOf('redeem.ts')).toMatch(/const caller = \{ operatorId: authenticationOf\(request\)\.session\?\.operatorId \?\? null, deviceId: pairedDeviceOf\(request\) \};/);
  });
});

describe('rule 2 (M4): server-native only', () => {
  it('no simulator action, no hosted command, no engine state: the code of the folder does not name the engine, and sets no header of API-7', () => {
    expect(occurrences(code, SIMULATOR)).toEqual([]);
    // The two headers of API-7 are the engine unit's (`src/engine/api-headers.ts`, decision D87).
    expect(files(/\bengine\b/g)).toEqual([]);
    expect(files(/_HEADER_NAME\b|\.header\s*\(/g)).toEqual([]);
  });

  it('every state change is a unit of the pipeline, with a label of its own', () => {
    const labels = code.flatMap((file) => [...file.text.matchAll(/pipeline\.run\('([^']+)'/g)].map((match) => match[1] ?? '')).sort();
    expect(labels).toEqual([
      'pairing.cancelCode',
      'pairing.deviceSeen',
      'pairing.issueCode',
      'pairing.promoteCredential',
      'pairing.redeem',
      'pairing.revokeDevice',
      'pairing.rotateCredential',
      'pairing.sweepCodes',
      'pairing.unpairDevice',
    ]);
  });

  it('a publication leaves only after the commit of its unit: every `app.publish` of the folder is inside an `afterCommit` task', () => {
    const publishes = (text: string): number => text.match(/\bapp\.publish\(/g)?.length ?? 0;
    expect(files(/\bapp\.publish\(/g)).toEqual(['src/modules/pairing/codes.ts', 'src/modules/pairing/devices.ts', 'src/modules/pairing/redeem.ts']);

    // codes.ts: one call, the task itself.
    const codes = textOf('codes.ts');
    expect(publishes(codes)).toBe(1);
    expect(codes).toMatch(/unit\.afterCommit\(\(\) => app\.publish\(\{ kind: 'admin\.changed', resource: 'PAIRING_CODE' \}\)\)/);

    // redeem.ts: two in the task of a success, one as the task of a failure.
    const redeem = textOf('redeem.ts');
    const successTask = /unit\.afterCommit\(\(\) => \{([\s\S]*?)\n\s*\}\);/.exec(redeem)?.[1] ?? '';
    expect(publishes(redeem)).toBe(3);
    expect(publishes(successTask)).toBe(2);
    expect(successTask).toMatch(/lock\.succeed\(\);/);
    expect(redeem.match(/unit\.afterCommit\(\(\) => app\.publish\(/g)).toHaveLength(1);

    // devices.ts: two in the helper that only tasks call, one as a task.
    const devices = textOf('devices.ts');
    const helper = /function publishRetired\([^)]*\)[^{]*\{([\s\S]*?)\n\}/.exec(devices)?.[1] ?? '';
    expect(publishes(devices)).toBe(3);
    expect(publishes(helper)).toBe(2);
    expect(devices.match(/\bpublishRetired\(/g)).toHaveLength(3);
    expect(devices.match(/unit\.afterCommit\(\(\) => publishRetired\(/g)).toHaveLength(2);
    expect(devices.match(/unit\.afterCommit\(\(\) => app\.publish\(/g)).toHaveLength(1);
  });
});

describe('rule 3 (M8): one clock, no timer of its own', () => {
  it('no file reads the system time or starts a timer; the sweep runs on the core\'s sweeper (W91-11)', () => {
    expect(occurrences(code, SYSTEM_TIME)).toEqual([]);
    expect(occurrences(code, TIMER)).toEqual([]);
    const index = textOf('index.ts');
    expect(index).toContain("import { createSweeper, type Sweeper } from '../../core';");
    expect(index).toMatch(/addHook\('onListen', async \(\) => \{\s*sweeper\.start\(\);/);
    expect(index).toMatch(/addHook\('preClose', async \(\) => \{\s*sweeper\.stop\(\);/);
    expect(index.match(/sweeper\.start\(/g)).toHaveLength(1);
  });

  it('no file reads the environment or listens', () => {
    expect(occurrences(code, ENVIRONMENT)).toEqual([]);
  });
});

describe('rule 4: one random source, one hash, one comparison', () => {
  it('only secrets.ts names the crypto module, and nothing uses a weak random source', () => {
    expect(files(CRYPTO)).toEqual(['src/modules/pairing/secrets.ts']);
  });

  it('the code is drawn with randomInt, the credential with randomBytes, and the code is compared with timingSafeEqual', () => {
    const secrets = textOf('secrets.ts');
    expect(secrets).toMatch(/import \{ createHash, randomBytes, randomInt, timingSafeEqual \} from 'node:crypto';/);
    expect(secrets).toMatch(/newPairingCode\(random: \(min: number, max: number\) => number = randomInt\)/);
    expect(secrets).toMatch(/newDeviceCredential\(random: \(size: number\) => Buffer = randomBytes\)/);
    expect(secrets).toMatch(/storedHash\.length === presented\.length && timingSafeEqual\(storedHash, presented\)/);
    // No comparison of a code or a hash with `===` anywhere else in the folder.
    expect(occurrences(code, /\b(?:codeHash|code_hash)\s*(?:===|!==|==|!=)/g)).toEqual([]);
    expect(occurrences(code, /\.equals\(/g)).toEqual([]);
  });

  it('SR-61: no signing secret and no pepper', () => {
    expect(occurrences(code, SIGNING)).toEqual([]);
  });
});

describe('rule 5 (M8, decision D69): no cookie', () => {
  it('no file sets, clears or reads a cookie', () => {
    expect(occurrences(code, COOKIE)).toEqual([]);
  });
});

describe('rule 6 (M14, SR-48): logging', () => {
  /** The keys of the object a log call is given, for every log call of the folder. */
  function loggedKeys(): Array<{ path: string; keys: string[] }> {
    const calls: Array<{ path: string; keys: string[] }> = [];
    for (const file of code) {
      for (const match of file.text.matchAll(/\blog\s*\.\s*(?:trace|debug|info|warn|error|fatal)\(\s*(\{[^}]*\})?/g)) {
        const body = match[1] ?? '{}';
        const keys = body
          .slice(1, -1)
          .split(',')
          .map((part) => part.trim().split(':')[0]?.trim() ?? '')
          .filter((key) => key !== '');
        calls.push({ path: file.path, keys });
      }
    }
    return calls;
  }

  it('every log call logs an error as `err`, with identifiers beside it and nothing else', () => {
    const calls = loggedKeys();
    expect(calls.map((call) => [call.path, call.keys])).toEqual([
      ['src/modules/pairing/index.ts', ['err']],
      ['src/modules/pairing/resolver.ts', ['err', 'deviceId']],
    ]);
    for (const call of calls) expect(call.keys.filter((key) => ['error', 'cause', 'e', 'reason'].includes(key)), call.path).toEqual([]);
  });

  it('no error message is read, no error is spread into a log object, and no log text is built from a value', () => {
    expect(occurrences(code, /\berror\s*\.\s*message\b|\.\s*message\s*\}/g)).toEqual([]);
    expect(occurrences(code, /\blog\s*\.\s*(?:trace|debug|info|warn|error|fatal)\(\s*\{[^}]*\.\.\./g)).toEqual([]);
    expect(occurrences(code, /\blog\s*\.\s*(?:trace|debug|info|warn|error|fatal)\([^)]*`/g)).toEqual([]);
  });

  it('no console call, no raw URL, no header', () => {
    expect(occurrences(code, CONSOLE)).toEqual([]);
    expect(occurrences(code, REQUEST_DATA_IN_LOG)).toEqual([]);
  });
});

describe('rule 7: the statements', () => {
  const statements = Object.entries(store)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .sort(([a], [b]) => a.localeCompare(b));
  const textOfStatement = (name: string): string => statements.find(([candidate]) => candidate === name)?.[1] ?? '';

  it('are constant texts: every exported statement of the store is listed here', () => {
    expect(statements.map(([name]) => name)).toEqual([
      'ANY_EXPIRED_CODE',
      'CANCEL_ACTIVE_CODE',
      'CONSUME_REDEEM_ATTEMPT',
      'EXHAUST_CODE',
      'EXPIRE_ACTIVE_CODE',
      'FIND_DEVICE',
      'FIND_DEVICE_BY_CREDENTIAL',
      'INSERT_CODE',
      'INSERT_DEVICE',
      'INSERT_DEVICE_CREDENTIAL',
      'MARK_DEVICE_SEEN',
      'NEXT_REGISTRY_NUMBER',
      'PROMOTE_CREDENTIAL',
      'READ_ACTIVE_CODE',
      'READ_CORE_IDENTITY',
      'READ_DEVICE_STATE',
      'READ_REGISTRATION',
      'READ_REGISTRY',
      'READ_REGISTRY_DEVICE',
      'REDEEM_CODE',
      'REVOKE_DEVICE',
      'SET_NEXT_CREDENTIAL',
      'UNPAIR_DEVICE',
    ]);
  });

  it('name every table with its schema, hold no value (only bind parameters and the fixed state names), and are single statements', () => {
    const words = ['ACTIVE', 'REDEEMED', 'CANCELLED', 'EXPIRED', 'EXHAUSTED', 'PAIRED', 'REVOKED', 'UNPAIRED'];
    for (const [name, text] of statements) {
      const tables = [...text.matchAll(/\b(?:FROM|JOIN|UPDATE|INTO)\s+([a-z_.]+)/g)].map((match) => match[1]);
      expect(tables.length, name).toBeGreaterThan(0);
      expect(tables.filter((table) => !table?.startsWith('public.')), name).toEqual([]);
      const literals = [...text.matchAll(/'([^']*)'/g)].map((match) => match[1]);
      expect(literals.filter((word) => !words.includes(word ?? '')), name).toEqual([]);
      expect(text.includes(';'), name).toBe(false);
      expect(text.includes('${'), name).toBe(false);
      if (name !== 'READ_CORE_IDENTITY') expect(text, name).toMatch(/\$1\b/);
    }
  });

  it('every transition is one compare-and-set: the UPDATE states the expected state and returns what it changed (AT-3)', () => {
    const transitions: Record<string, RegExp> = {
      EXPIRE_ACTIVE_CODE: /WHERE state = 'ACTIVE' AND expires_at <= \$1 RETURNING id$/,
      CANCEL_ACTIVE_CODE: /WHERE state = 'ACTIVE' RETURNING id$/,
      CONSUME_REDEEM_ATTEMPT: /WHERE state = 'ACTIVE' AND expires_at > \$1 AND failed_attempts < \$2 RETURNING id, code_hash, failed_attempts$/,
      EXHAUST_CODE: /WHERE id = \$2 AND state = 'ACTIVE' AND failed_attempts = \$3 RETURNING id$/,
      REDEEM_CODE: /WHERE id = \$2 AND state = 'ACTIVE' AND expires_at > \$1 RETURNING id$/,
      REVOKE_DEVICE: /WHERE id = \$1 AND state = 'PAIRED' RETURNING id$/,
      UNPAIR_DEVICE: /WHERE id = \$1 AND state = 'PAIRED' RETURNING id$/,
      SET_NEXT_CREDENTIAL: /WHERE c\.device_id = \$1 AND d\.id = c\.device_id AND d\.state = 'PAIRED' RETURNING c\.device_id$/,
      PROMOTE_CREDENTIAL: /WHERE device_id = \$2 AND next_hash = \$1 RETURNING device_id$/,
      MARK_DEVICE_SEEN: /WHERE id = \$1 AND state = 'PAIRED' AND last_seen_at <= \$3 RETURNING id$/,
    };
    for (const [name, where] of Object.entries(transitions)) {
      const text = textOfStatement(name);
      expect(text, name).toMatch(/^UPDATE public\./);
      expect(text, name).toMatch(where);
    }
    // Every UPDATE of the store is in the list above or is the counter (AT-5).
    expect(statements.filter(([, text]) => text.startsWith('UPDATE ')).map(([name]) => name).sort()).toEqual([...Object.keys(transitions), 'NEXT_REGISTRY_NUMBER'].sort());
    expect(textOfStatement('NEXT_REGISTRY_NUMBER')).toBe('UPDATE public.registry_counters SET next_value = next_value + 1 WHERE name = $1 RETURNING next_value - 1 AS number');
  });

  it('decision D105: the store has no statement on biometric_tokens; a revoke and an unpair call the one revoke function of identity/biometric with the scope DEVICE', () => {
    expect(statements.filter(([, text]) => text.includes('biometric_tokens')).map(([name]) => name)).toEqual([]);
    // One import of that folder in the whole module, of one name, and two calls, each inside its unit.
    const importing = code.filter((file) => file.text.includes("'../identity/biometric'")).map((file) => file.path);
    expect(importing).toEqual([`${OWN_FOLDER}devices.ts`]);
    expect(textOf('devices.ts')).toMatch(/import \{ revokeBiometricTokens \} from '\.\.\/identity\/biometric';/);
    const calls = [...textOf('devices.ts').matchAll(/\brevokeBiometricTokens\(([^;]*)\);/g)].map((match) => match[1]);
    expect(calls).toEqual([
      "unit, { scope: 'DEVICE', deviceId, reason: 'DEVICE_REVOKED' }, now",
      "unit, { scope: 'DEVICE', deviceId, reason: 'DEVICE_UNPAIRED' }, now",
    ]);
  });

  it('the consuming statement takes the attempt and the redeeming statement gives it back (AT-C2, AT-C3)', () => {
    expect(textOfStatement('CONSUME_REDEEM_ATTEMPT')).toMatch(/^UPDATE public\.pairing_codes SET failed_attempts = failed_attempts \+ 1 WHERE /);
    expect(textOfStatement('REDEEM_CODE')).toMatch(/^UPDATE public\.pairing_codes SET state = 'REDEEMED', closed_at = \$1, failed_attempts = failed_attempts - 1 WHERE /);
  });

  it('the code hash is written by the insert and handed out by the consuming statement alone; no credential hash is ever selected or returned', () => {
    const codeHash = ['code', 'hash'].join('_');
    expect(statements.filter(([, text]) => text.includes(codeHash)).map(([name]) => name)).toEqual(['CONSUME_REDEEM_ATTEMPT', 'INSERT_CODE']);
    const credentialHash = new RegExp(`\\b(?:${['current', 'hash'].join('_')}|${['next', 'hash'].join('_')})\\b`);
    expect(statements.filter(([, text]) => credentialHash.test(text)).map(([name]) => name)).toEqual([
      'FIND_DEVICE_BY_CREDENTIAL',
      'INSERT_DEVICE_CREDENTIAL',
      'PROMOTE_CREDENTIAL',
      'SET_NEXT_CREDENTIAL',
    ]);
    for (const [name, text] of statements) {
      const returned = /\bRETURNING\s+(.*)$/s.exec(text)?.[1] ?? '';
      expect(credentialHash.test(returned), name).toBe(false);
      if (name !== 'CONSUME_REDEEM_ATTEMPT') expect(returned.includes(codeHash), name).toBe(false);
      // An output column of a SELECT is never a hash. The one mention in a select list is the
      // comparison with the presented hash, which yields true or false.
      const selected = /^SELECT\s+(.*?)\s+FROM\s+public\./s.exec(text)?.[1] ?? '';
      const outputs = selected.replace('(c.next_hash IS NOT NULL AND c.next_hash = $1) AS pending', 'pending');
      expect(credentialHash.test(outputs) || outputs.includes(codeHash), name).toBe(false);
    }
    // Outside the store and the secrets file nothing names a hash column at all.
    expect(files(new RegExp(`${codeHash}|${credentialHash.source}`, 'g'))).toEqual(['src/modules/pairing/store.ts']);
  });

  it('no statement is written outside the store, and no `SELECT *`', () => {
    const sql = /['"`](?:SELECT|INSERT|UPDATE|DELETE)\s/g;
    expect(files(sql)).toEqual(['src/modules/pairing/store.ts']);
    expect(occurrences(code, /SELECT\s+\*/gi)).toEqual([]);
    expect(occurrences(code, /\bunit\s*\.\s*db\b/g)).toEqual([]);
  });
});

describe('rule 8 (M5): one audit path', () => {
  it('nothing here inserts into the audit table or the events table itself: the rows go through the unit\'s writers, in one place', () => {
    expect(occurrences(code, OWN_AUDIT_INSERT)).toEqual([]);
    expect(files(/\bunit\.(?:audit|events)\.append\(/g)).toEqual(['src/modules/pairing/activity.ts']);
  });

  it('no builder of a row takes a secret: none has a parameter for a code, a credential or a hash', () => {
    const activity = textOf('activity.ts');
    expect(activity).not.toMatch(/\b(?:code|credential|codeHash|hash|qrPayload|deviceCredential)\s*[?]?:\s*(?:string|Buffer)/);
    // The eight types, and no other.
    expect([...new Set([...activity.matchAll(/type: '([A-Z_]+)'/g)].map((match) => match[1]))].sort()).toEqual([
      'DEVICE_CREDENTIAL_ROTATED',
      'DEVICE_REVOKED',
      'PAIRED',
      'PAIRING_CODE_CLOSED',
      'PAIRING_CODE_ISSUED',
      'PAIRING_FAILED',
      'PAIRING_LOCKED',
      'PAIRING_SUCCESS',
      'UNPAIRED',
    ]);
  });
});
