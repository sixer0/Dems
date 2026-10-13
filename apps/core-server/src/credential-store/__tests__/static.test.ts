// Static guards of the Core credential store (blueprint row 84; SEC35-03, SEC35-08; D80(7); capture
// spec §D.2 "access is limited", §G G-R4). They read production sources as text, with the
// scaffold's scanner, and keep these rules true for every later row:
//
//   1. ONE STORE. One file of the server makes key files (`key-store.ts`), one place builds a key
//      store (`index.ts`), and the units that import this folder are the pinned list
//      `CREDENTIAL_STORE_USERS`. A new user is a decision: it adds exactly its one file here.
//   2. KEY BYTES STAY INSIDE. The one function that reads the bytes of a key is named by the two
//      ciphers and the file that defines it, and the folder's index exports neither it nor the
//      function that wraps raw bytes.
//   3. THE FOLDER REACHES ONLY ITS OWN DIRECTORY: the file system in one file; no process, no
//      socket, no environment, no connection file of the data directory.
//   4. NOTHING HERE LOGS, and no failure is built from a value.
//
// Every forbidden text is built from fragments, so that this file does not contain it.
import { describe, expect, it } from 'vitest';
import { logCalls } from '../../../test/static/log-calls';
import { SCAN_COVERS, WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, scanCoverage, type SourceFile } from '../../../test/static/scan';

const FOLDER = 'src/credential-store/';
/**
 * The production files outside the folder that import it. Today: the STT configuration module
 * (the sealer of operation 91). To come, one file each: the capture credential path (row 142, op
 * 89 / 96), the transcriber key-loader mount (row 115), the sealing pipeline and the Range reader
 * (rows 82, 87), the signer (row 83, if it keeps its key here).
 */
const CREDENTIAL_STORE_USERS: readonly string[] = [
  // Task 4 NAMED ENTRY SR-10 (decision C76; the composing file of row 85b, decisions C55 and C60): the ONE file above the
  // modules that hands the store to the capture credential reader, for the ONE purpose `capture.open` (never `seal`, never
  // a named secret, a session key or a fragment). PROVISIONAL: put by name to the security review of row 86, which
  // confirms or reverses it before the lift. What the file does with the store is pinned line by line in the case
  // 'SR-10' below (`COMPOSITION_STORE_LINES`): a second use from that file fails there.
  'src/capture-composition.ts',
  // Integration pass A (D109), row 85's request: the fragment opener of verify v2 (`sessionKeys` + `openFragment`).
  'src/evidence-verify/fragment-opener.ts',
  // Row 90 (C3 §2.4, SEC35-12: the media-session signing key is "held in the Core credential store"): `namedSecrets` for
  // that ONE key (HMAC inside `use`) and the pure `planRangeRead`; never a session key, never `openFragment` - held by
  // `src/media-stream/__tests__/static.test.ts`.
  'src/media-stream/store-door.ts',
  // Row 142 (decision D114): the connect flow seals a camera credential (`capture.seal` only: never `open`, never a reveal).
  'src/modules/capture-discovery/connect/index.ts',
  'src/modules/stt-config/index.ts',
  // Row 82b (ruling D147 (A), (E)): the seal-time cipher - the session key `KID-<sessionId>` (`sessionKeys` create / open) and `createFragmentSealer`; never `openFragment` (the opener is evidence-verify's).
  'src/sealing-host/session-key.ts',
  // Integration pass A (D109), row 115's mount: the opener of an `ENCRYPTED` STT credential, handed to the transcriber's key-loader.
  'src/transcription/credential-opener.ts',
];

const tree = readTree(WORKSPACE);
const production = codeOnly(tree.filter((file) => isProductionSource(file.path) && file.path.endsWith('.ts')));
const folder = production.filter((file) => file.path.startsWith(FOLDER));
const files = (found: readonly string[]): string[] => [...new Set(found.map((place) => place.replace(/:\d+$/, '')))].sort();

const join = (...parts: string[]): string => parts.join('');
const FILE_SYSTEM = /['"](?:node:)?fs(?:\/promises)?['"]/g;
const HOST_DOOR = new RegExp(`['"](?:node:)?(?:${[join('child', '_process'), 'net', 'dgram', 'tls', 'http', 'https', 'http2', join('worker', '_threads'), 'os'].join('|')})['"]`, 'g');
const ENVIRONMENT = new RegExp(`\\bprocess\\s*\\.\\s*${'env'}\\b`, 'g');
const CONSOLE = /\bconsole\s*\./g;
const CONNECTION_FILE = new RegExp([`\\bpg\\.(?:owner\\.)?${'env'}\\b`, `\\b${'pw'}file\\b`, `\\.${'omlx'}\\b`].join('|'), 'g');
const KEY_BYTES_READER = new RegExp(`\\b${join('using', 'KeyBytes')}\\b`, 'g');
const RAW_KEY_WRAPPER = new RegExp(`\\b${join('keyMaterial', 'Of')}\\b`, 'g');
const KEY_STORE_BUILDER = new RegExp(`\\b${join('createFile', 'KeyStore')}\\s*\\(`, 'g');
const IMPORT_OF_FOLDER = /from\s+['"](?:\.\.?\/)+(?:[\w-]+\/)*credential-store(?:\/[\w./-]*)?['"]/g;

describe('the scan itself', () => {
  it('reads the production sources of the folder', () => {
    expect(scanCoverage(folder, [FOLDER])).toEqual(SCAN_COVERS);
    expect(folder.every((file) => file.text.length > 300)).toBe(true);
  });

  it('finds each forbidden text when it is present (positive control)', () => {
    const planted: SourceFile[] = [
      { path: 'src/modules/x/a.ts', text: `import { coreCredentialStore } from '../../credential-store';\nimport { ${join('using', 'KeyBytes')} } from '../../credential-store/key-material';` },
      { path: 'src/x/b.ts', text: `import { writeFileSync } from 'node:${'fs'}';\nimport { spawn } from 'node:${join('child', '_process')}';\nconst k = process.${'env'}.KEY;\nconsole.log(key);` },
      { path: 'src/x/c.ts', text: `const keys = ${join('createFile', 'KeyStore')}({ root });\nread('.data/pg.${'env'}');\nconst k = ${join('keyMaterial', 'Of')}(bytes);` },
    ];
    expect(occurrences(planted, IMPORT_OF_FOLDER)).toEqual(['src/modules/x/a.ts:1', 'src/modules/x/a.ts:2']);
    expect(occurrences(planted, KEY_BYTES_READER)).toEqual(['src/modules/x/a.ts:2']);
    expect(occurrences(planted, FILE_SYSTEM)).toEqual(['src/x/b.ts:1']);
    expect(occurrences(planted, HOST_DOOR)).toEqual(['src/x/b.ts:2']);
    expect(occurrences(planted, ENVIRONMENT)).toEqual(['src/x/b.ts:3']);
    expect(occurrences(planted, CONSOLE)).toEqual(['src/x/b.ts:4']);
    expect(occurrences(planted, KEY_STORE_BUILDER)).toEqual(['src/x/c.ts:1']);
    expect(occurrences(planted, CONNECTION_FILE)).toEqual(['src/x/c.ts:2']);
    expect(occurrences(planted, RAW_KEY_WRAPPER)).toEqual(['src/x/c.ts:3']);
    expect(logCalls("app.log.info({ code: 'X', keyRef }, 'sealed');")).toHaveLength(1);
  });
});

describe('rule 1: one store', () => {
  it('the units that import the folder are the pinned list, and each through its index', () => {
    const outside = production.filter((file) => !file.path.startsWith(FOLDER));
    const imports = occurrences(outside, IMPORT_OF_FOLDER);
    console.info(`[row84] credential-store users: ${files(imports).join(', ') || '(none)'}`);
    expect(files(imports)).toEqual([...CREDENTIAL_STORE_USERS]);
    expect(occurrences(outside, /from\s+['"](?:\.\.?\/)+(?:[\w-]+\/)*credential-store\/[\w./-]+['"]/g)).toEqual([]);
  });

  // Task 4 named entry SR-10 (decision C76), PROVISIONAL until the security review of row 86 confirms or reverses it.
  // The entry of `CREDENTIAL_STORE_USERS` admits the FILE; this case holds the PURPOSE: the composing file imports the one
  // name `coreCredentialStore`, asks the store in one place, reads its status and calls `capture.open` - nothing else.
  // Every line of the file that touches the store is pinned; a second use (a seal, a named secret, a session key, the
  // store handed on, a second import) is a line that is not of the list.
  it('SR-10: the composing file of production capture uses the store for capture.open and for nothing else (control: a second use is seen)', () => {
    const COMPOSITION = 'src/capture-composition.ts';
    const STORE_TOUCH = /credential-store|\bcoreCredentialStore\b|\bopened\b|\bstore\s*\??\.|\.\s*store\b|\b(?:namedSecrets|sessionKeys|openFragment|createFragmentSealer)\b/;
    const COMPOSITION_STORE_LINES: readonly string[] = [
      "import { coreCredentialStore } from './credential-store';",
      'const opened = coreCredentialStore(app);',
      "if (opened.status !== 'READY') {",
      "report('error', CaptureCompositionCode.CREDENTIAL_STORE_NOT_READY, { deviceId, store: opened.status });",
      'return opened.store.capture.open(deviceId, sealed);',
    ];
    const storeLines = (text: string): string[] => text.split('\n').map((line) => line.trim()).filter((line) => STORE_TOUCH.test(line));
    const second = (text: string): string[] => storeLines(text).filter((line) => !COMPOSITION_STORE_LINES.includes(line));
    // Control: each planted second use is a line outside the list; the pinned lines alone are not.
    expect(second(COMPOSITION_STORE_LINES.join('\n'))).toEqual([]);
    const planted = [
      'const again = opened.store.capture.seal(deviceId, secret);',
      'const key = coreCredentialStore(app);',
      'const { store } = coreCredentialStore(app);',
      'return store.capture.open(otherDevice, sealed);',
      'handOn(opened.store);',
      'const secrets = held?.store.namedSecrets;',
      "import { coreCredentialStore, CredentialPurpose } from './credential-store';",
    ];
    expect(second([...COMPOSITION_STORE_LINES, ...planted].join('\n'))).toEqual(planted);
    const text = production.find((file) => file.path === COMPOSITION)?.text ?? '';
    expect(storeLines(text)).toEqual([...COMPOSITION_STORE_LINES]);
    // The one purpose, counted: one question to the store, one call on it, and that call is `capture.open`.
    expect(text.match(/\bcoreCredentialStore\s*\(/g)).toHaveLength(1);
    expect(text.match(/\.\s*store\s*\.\s*[\w.]+\s*\(/g)).toEqual(['.store.capture.open(']);
  });

  it('a key store is built in one place, and no other production source of the server builds one', () => {
    expect(files(occurrences(production, KEY_STORE_BUILDER))).toEqual([`${FOLDER}index.ts`, `${FOLDER}key-store.ts`]);
    // In `index.ts`: the default of `createCredentialStore`, the store of an app, and - fix pass F-M7c, ruling D180 - the folder of that app's own session keys.
    expect(occurrences(production, KEY_STORE_BUILDER).filter((place) => place.startsWith(`${FOLDER}index.ts:`))).toHaveLength(3);
    expect(files(occurrences(production, /\bcreateCredentialStore\s*\(/g))).toEqual([`${FOLDER}index.ts`]);
  });
});

describe('rule 2: key bytes stay inside', () => {
  it('the reader of key bytes is named by the two ciphers and its own file only', () => {
    expect(files(occurrences(production, KEY_BYTES_READER))).toEqual([`${FOLDER}envelope.ts`, `${FOLDER}fragment-cipher.ts`, `${FOLDER}key-material.ts`]);
  });

  it('the index exports neither the reader nor the wrapper of raw bytes, nor the key store itself', () => {
    const index = folder.find((file) => file.path === `${FOLDER}index.ts`)?.text ?? '';
    expect(index).not.toMatch(KEY_BYTES_READER);
    expect(index).not.toMatch(RAW_KEY_WRAPPER);
    const exported = [...index.matchAll(/export\s*\{([^}]*)\}\s*from\s*'\.\/key-(?:material|store)'/g)].map((match) => match[1]?.replace(/\s+/g, ' ').trim());
    expect(exported).toEqual(['KEY_MARK, KeyMaterial']);
    expect(files(occurrences(production, RAW_KEY_WRAPPER))).toEqual([`${FOLDER}key-material.ts`, `${FOLDER}key-store.ts`]);
  });
});

describe('rule 3: the folder reaches only its own directory', () => {
  it('one file imports the file system; none opens a process, a socket, the environment or a connection file', () => {
    expect(files(occurrences(folder, FILE_SYSTEM))).toEqual([`${FOLDER}key-store.ts`]);
    expect(occurrences(folder, HOST_DOOR)).toEqual([]);
    expect(occurrences(folder, ENVIRONMENT)).toEqual([]);
    expect(occurrences(folder, CONNECTION_FILE)).toEqual([]);
    expect(occurrences(folder, /(?<![.\w$])fetch\s*\(/g)).toEqual([]);
  });

  it('the folder imports no other unit of the server: nothing above it can pull a secret through it', () => {
    expect(occurrences(folder, /from\s+['"]\.\.\//g)).toEqual([]);
    expect(occurrences(folder, /from\s+['"]@dems\//g)).toEqual([]);
  });
});

describe('rule 4: nothing here logs, and no failure is built from a value', () => {
  it('no log call and no console in the folder', () => {
    expect(folder.flatMap((file) => logCalls(file.text))).toEqual([]);
    expect(occurrences(folder, CONSOLE)).toEqual([]);
  });

  it('every failure is a code: no error of the folder takes a message, a cause or a template', () => {
    const made = folder.flatMap((file) => [...file.text.matchAll(/new (?:CredentialStoreError|FragmentAuthenticationError)\(([^)]*)\)/g)].map((match) => `${file.path}: ${match[1]}`));
    expect(made.length).toBeGreaterThan(20);
    for (const call of made) expect(call).not.toMatch(/`|\bmessage\b|\bcause\b|\+/);
    expect(occurrences(folder, /new Error\(/g)).toEqual([]);
  });
});
