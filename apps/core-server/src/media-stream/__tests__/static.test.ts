// Static rules of the media-stream unit and of the module that registers its routes (blueprint row
// 90; C3 §2.4, §5.1; capture spec §D.4, §G G-R4 / G-R6; SEC35-12, SEC35-13; test strategy "own
// static rule" of the evidence-media folder).
//
//   1. NOTHING IS WRITTEN, AND NO HOST DOOR IS OPENED. No file of the two folders imports the file
//      system, a process, a socket or the OS, reads the environment or names a writing call: the
//      unit has no way to put plaintext on a disk (G-R6). Its bytes come through the package reader
//      of `src/evidence-verify`.
//   2. NO SECOND DECRYPTION PATH. No file names a cipher or the cipher functions of the store: a
//      fragment is opened by `coreFragmentOpener` and by nothing else.
//   3. ONE DOOR TO THE CREDENTIAL STORE, AND A NARROW ONE. `store-door.ts` alone imports the store,
//      and of the store it names the named secrets (for the ONE media-session key), the range plan
//      and two error classes - never a session key, a credential cipher or a key-wrap secret.
//   4. THE TOKEN, THE URL AND THE RANGE ARE NEVER LOGGED OR AUDITED (G-R4, E-31). No log call and
//      no audit entry of the two folders names them, and nothing reads the raw request URL.
//   5. ROUTES ARE REGISTERED BY THE MODULE ONLY; THE MODULE SETS NO HEADER AND DECIDES NOTHING.
//   6. `replaceForTest` IS CALLED BY NO PRODUCTION FILE.
//
// Every rule holds a planted-violation control. Forbidden texts are built from fragments.
import { describe, expect, it } from 'vitest';
import { logCalls } from '../../../test/static/log-calls';
import { SCAN_COVERS, WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, scanCoverage, type SourceFile } from '../../../test/static/scan';

const UNIT = 'src/media-stream/';
const MODULE = 'src/modules/media-stream/';
const DOOR = `${UNIT}store-door.ts`;

const production = codeOnly(readTree(WORKSPACE).filter((file) => isProductionSource(file.path) && file.path.endsWith('.ts')));
const own = production.filter((file) => file.path.startsWith(UNIT) || file.path.startsWith(MODULE));
const files = (found: readonly string[]): string[] => [...new Set(found.map((place) => place.replace(/:\d+$/, '')))].sort();
const join = (...parts: string[]): string => parts.join('');
const planted = (text: string): SourceFile[] => [{ path: 'src/media-stream/planted.ts', text }];

const HOST_DOOR = new RegExp(`['"](?:node:)?(?:${['fs', join('fs', '/promises'), join('child', '_process'), 'net', 'dgram', 'tls', 'http', 'https', 'http2', join('worker', '_threads'), 'os'].join('|')})['"]`, 'g');
const ENVIRONMENT = new RegExp(`\\bprocess\\s*\\.\\s*${'env'}\\b`, 'g');
const WRITING = new RegExp(`\\b(?:${[join('write', 'File'), join('write', 'FileSync'), join('append', 'File'), join('create', 'WriteStream'), join('mk', 'dtemp'), join('mk', 'dir'), join('copy', 'File'), 'rename', 'symlink'].join('|')})(?:Sync)?\\s*\\(`, 'g');
const CIPHER = new RegExp(`\\b(?:${[join('create', 'Decipheriv'), join('create', 'Cipheriv'), join('open', 'Fragment'), join('read', 'DecryptedRange'), join('create', 'FragmentSealer'), join('fragment', 'Aad')].join('|')})\\b|['"]${'aes'}-`, 'g');
const STORE_IMPORT = /from\s+['"](?:\.\.?\/)+(?:[\w-]+\/)*credential-store(?:\/[\w./-]*)?['"]/g;
const STORE_MEMBERS_NOT_FOR_THIS_UNIT = new RegExp(`\\b(?:${[join('session', 'Keys'), join('keyWrap', 'Secrets'), join('credential', 'Keys'), 'stt', 'capture'].join('|')})\\b`, 'g');
const RAW_URL = /\b(?:request|req|raw)\s*\.\s*(?:url|originalUrl)\b/g;
const ROUTE_REGISTRATION = new RegExp(`\\.\\s*${'route'}\\s*\\(`, 'g');
const HEADER_SET = /\breply\s*\.\s*headers?\s*\(/g;
const TEST_HOOK_CALL = new RegExp(`\\.\\s*${join('replace', 'ForTest')}\\s*\\(`, 'g');

/** The names a log call or an audit entry of these folders may never hold: the bearer value and what carries it. */
// (`rangeStart` / `rangeEnd` of an audit row are byte positions the server computed - contract keys; the `Range` VALUE is a header.)
const BEARER_NAMES = /\b(?:token|url|header|headers|authorization|cookie|nonce|mac|presented|expected|params)\b/;

/** Every `{ ... }` literal that follows `append(` (an audit entry) in a text, as text. */
function auditEntries(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(/\bappend\s*\(\s*[A-Z_]+\s*,\s*\{/g)) {
    let depth = 0;
    const start = (match.index ?? 0) + match[0].length - 1;
    for (let index = start; index < text.length; index += 1) {
      if (text[index] === '{') depth += 1;
      if (text[index] === '}') depth -= 1;
      if (depth === 0) {
        found.push(text.slice(start, index + 1));
        break;
      }
    }
  }
  return found;
}

describe('the scan itself', () => {
  it('reads the files of the unit and of the module', () => {
    expect(scanCoverage(own, [UNIT, MODULE])).toEqual(SCAN_COVERS);
  });

  it('finds each forbidden text when it is planted (positive controls)', () => {
    expect(occurrences(planted(`import { ${join('write', 'FileSync')} } from 'node:${'fs'}';\nimport { spawn } from '${join('child', '_process')}';`), HOST_DOOR)).toHaveLength(2);
    expect(occurrences(planted(`const k = process.${'env'}.KEY;`), ENVIRONMENT)).toHaveLength(1);
    expect(occurrences(planted(`${join('write', 'FileSync')}(path, plain);\nawait ${join('write', 'File')}(path, plain);\n${join('create', 'WriteStream')}(path);`), WRITING)).toHaveLength(3);
    expect(occurrences(planted(`const d = ${join('create', 'Decipheriv')}('${'aes'}-256-gcm', key, iv);\n${join('open', 'Fragment')}(key, record, stored);`), CIPHER)).toHaveLength(3);
    expect(occurrences(planted("import { coreCredentialStore } from '../credential-store';"), STORE_IMPORT)).toHaveLength(1);
    expect(occurrences(planted(`opened.store.${join('session', 'Keys')}.open(keyId);`), STORE_MEMBERS_NOT_FOR_THIS_UNIT)).toHaveLength(1);
    expect(occurrences(planted('log.info(request.url);'), RAW_URL)).toHaveLength(1);
    expect(occurrences(planted(`app.${'route'}({ method: 'GET' });`), ROUTE_REGISTRATION)).toHaveLength(1);
    expect(occurrences(planted("reply.header('x', 'y');"), HEADER_SET)).toHaveLength(1);
    expect(occurrences(planted(`mediaStream(app).${join('replace', 'ForTest')}({});`), TEST_HOOK_CALL)).toHaveLength(1);
    const call = logCalls("request.log.info({ code: 'X', token, fileId }, 'served');");
    expect(call).toHaveLength(1);
    expect(call[0]?.members.some((member) => BEARER_NAMES.test(member.key))).toBe(true);
    expect(auditEntries("await append(UNIT, { type: 'X', details: { url: session.url } });")).toEqual(["{ type: 'X', details: { url: session.url } }"]);
  });
});

describe('rule 1: nothing is written, no host door is opened', () => {
  it('no file system, process, socket or OS import; no environment; no writing call', () => {
    expect(occurrences(own, HOST_DOOR)).toEqual([]);
    expect(occurrences(own, ENVIRONMENT)).toEqual([]);
    expect(occurrences(own, WRITING)).toEqual([]);
  });

  it('the node built-ins the unit does import are the three it needs: crypto (HMAC, random, constant-time compare), path (a separator), stream (the answer)', () => {
    const builtins = files(occurrences(own, /from\s+['"]node:[a-z/_]+['"]/g)).length;
    const names = [...new Set(own.flatMap((file) => [...file.text.matchAll(/from\s+['"](node:[a-z/_]+)['"]/g)].map((match) => match[1])))].sort();
    expect(names).toEqual(['node:crypto', 'node:path', 'node:stream']);
    expect(builtins).toBeGreaterThan(0);
  });
});

describe('rule 2: no second decryption path', () => {
  it('no file names a cipher or a cipher function of the store; the opener is the Core\'s, taken in one place', () => {
    expect(occurrences(own, CIPHER)).toEqual([]);
    expect(files(occurrences(own, /\bcoreFragmentOpener\s*\(/g))).toEqual([`${UNIT}index.ts`]);
    // The crypto functions the unit calls are a MAC, a random source and a comparison - nothing that encrypts or decrypts.
    const called = [...new Set(own.flatMap((file) => [...file.text.matchAll(/import\s*\{([^}]*)\}\s*from\s*'node:crypto'/g)].flatMap((match) => (match[1] ?? '').split(',').map((name) => name.trim()))))].sort();
    expect(called).toEqual(['createHmac', 'randomBytes', 'timingSafeEqual']);
  });
});

describe('rule 3: one narrow door to the credential store', () => {
  it('only store-door.ts imports the store, through its index', () => {
    expect(files(occurrences(own, STORE_IMPORT))).toEqual([DOOR]);
    expect(occurrences(own, /from\s+['"](?:\.\.?\/)+(?:[\w-]+\/)*credential-store\/[\w./-]+['"]/g)).toEqual([]);
  });

  it('of the store it takes the named secrets, the range plan and two error classes - no session key, no credential cipher, no key-wrap secret', () => {
    const door = own.find((file) => file.path === DOOR)?.text ?? '';
    const imported = /import\s*\{([^}]*)\}\s*from\s*'\.\.\/credential-store'/.exec(door)?.[1]?.split(',').map((name) => name.trim()).sort();
    expect(imported).toEqual(['CredentialStoreError', 'CredentialStoreFailure', 'FragmentAuthenticationError', 'coreCredentialStore', 'planRangeRead', 'type CredentialStoreHost']);
    expect(occurrences(own, STORE_MEMBERS_NOT_FOR_THIS_UNIT)).toEqual([]);
    expect(door.match(/\.store\.(\w+)/g)).toEqual(['.store.namedSecrets']);
    // The key is used inside the store's callback and never returned or kept: one `use`, whose callback computes the MAC.
    expect(door.match(/secrets\.use\(/g)).toHaveLength(1);
    expect(door).toMatch(/secrets\.use\(name, \(key\) => createHmac\('sha256', key\)\.update\(message\)\.digest\(\)\)/);
  });
});

describe('rule 4 (G-R4, E-31; M8-BLK-1): the token, the URL and the range are never logged or audited', () => {
  it('no log call of the two folders holds a member that names them', () => {
    const calls = own.flatMap((file) => logCalls(file.text).map((call) => ({ path: file.path, call })));
    expect(calls.length).toBeGreaterThanOrEqual(4);
    const leaking = calls.filter(({ call }) => call.members.some((member) => BEARER_NAMES.test(member.key) || BEARER_NAMES.test(member.value ?? '')));
    expect(leaking.map(({ path, call }) => `${path}:${call.line}`)).toEqual([]);
  });

  it('no audit entry and no error-log entry names them; nothing reads the raw request URL', () => {
    const service = own.find((file) => file.path === `${UNIT}service.ts`)?.text ?? '';
    const entries = auditEntries(service);
    expect(entries).toHaveLength(3);
    for (const entry of entries) expect(entry).not.toMatch(BEARER_NAMES);
    for (const match of service.matchAll(/errorLog\.append\(\{[^\n]*\}\);/g)) expect(match[0]).not.toMatch(BEARER_NAMES);
    expect(occurrences(own, RAW_URL)).toEqual([]);
    // The one place the token is put into a text is the answer of operation 88.
    expect(service.match(/\$\{token\}/g)).toHaveLength(1);
    expect(service).toMatch(/return \{ evidenceId: item\.evidenceId, fileId, url: `http:\/\/\$\{app\.config\.host\}:\$\{app\.config\.port\}\$\{MEDIA_ROUTE_PREFIX\}\/\$\{token\}`, expiresAt, ranges: true, \.\.\.\(indexed \? \{ seekIndex: true as const \} : \{\}\) \};/);
  });
});

describe('rule 5: routes are registered by the module only; the module sets no header and decides nothing', () => {
  it('the unit registers no route; the module registers exactly two and holds no header call, no principal and no permission', () => {
    expect(files(occurrences(own, ROUTE_REGISTRATION))).toEqual([`${MODULE}index.ts`]);
    expect(occurrences(own, ROUTE_REGISTRATION)).toHaveLength(2);
    const module = own.filter((file) => file.path.startsWith(MODULE));
    expect(occurrences(module, HEADER_SET)).toEqual([]);
    expect(occurrences(module, /\bprincipal\b|\bPermission\b|\bpermissions\b/g)).toEqual([]);
  });
});

describe('rule 6: the test hook is a test\'s', () => {
  it('no production source of the server calls replaceForTest of this unit', () => {
    const callers = production.filter((file) => /\bmediaStream\s*\(/.test(file.text));
    expect(occurrences(callers, TEST_HOOK_CALL)).toEqual([]);
  });
});
