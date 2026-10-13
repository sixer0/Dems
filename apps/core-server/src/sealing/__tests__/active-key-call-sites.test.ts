// Task 4 row 225 (package X1-4; GATE SX-09 (a); UD-5): ONE function answers "which signing key is
// active" for the boot checks 4 and 4b, the seal, the transcript revisions and the verify.
//
// THE ONE RESOLVER is `activeSigningKeyId` of `src/capture/signer/host-key.ts`. Its call sites are
// the key-id default of `loadSoftwareSigner` and of `readStoredCertificate` in that same file; every
// taker of the product reaches the store through one of the two WITHOUT a key id:
//
//   boot checks 4, 4b     `storedSigningKeyReaders` (`capture/boot/index.ts`)        -> `loadSoftwareSigner({ dir, now })`
//   the seal              `loadSealingSigner` (`sealing/signing.ts`), taken by `signingNow` (`sealing-host/index.ts`)
//   transcript revisions  `loadCoreSigner` (`modules/transcripts/routes.ts`)         -> `loadSealingSigner`
//   verify                `trustedCertificateSha256` (`sealing-host/index.ts`)       -> `signingNow().certificate`
//
// TWO HALVES. (1) BEHAVIOUR: on one store - without a pointer, with a pointer, with a pointer that
// cannot be taken - the takers that can be called without a database give the SAME key, the one
// the resolver names. (2) A STATIC RULE over every production source of `src/` and `cli/`: no
// file but the store's own reads the pointer, hands a key id to a loader, writes a key id of the
// series, or defines a resolver of its own - and the rule is shown to FAIL on a planted second
// resolver, in a synthetic file and in the real text of each call site.
//
// The transcript and verify takers need a database to be called; here they are held by the rule
// and by the exact text of their one line. Every key is made by the test in a temporary directory
// that `afterAll` removes.
import { lstatSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CAPTURE_PROTOCOL_VERSION } from '@dems/capture-protocol';
import { afterAll, describe, expect, it } from 'vitest';
import { WORKSPACE, isTestFile, readTree, stripComments, type SourceFile } from '../../../test/static/scan';
import { ACTIVE_KEY_POINTER_NAME, SignerError, activateSigningKey, activeSigningKeyId, loadSoftwareSigner, provisionSigningKey, readStoredCertificate } from '../../capture';
import { CAPTURE_WORKER_VERSION, CaptureBootError, CaptureBootRefusal, runCaptureBootChecks, storedSigningKeyReaders, type CaptureBootDeps } from '../../capture/boot';
import { captureOperationDecisionOf } from '../../capture/fence/operation';
import { loadSealingSigner, sealingSignerDir } from '../signing';

const NOW = 1_792_200_000_000;
const SERVER_UID = 501;
const FIRST = 'CORE-KEY-EVSIGN-01';
const SECOND = 'CORE-KEY-EVSIGN-02';

const roots: string[] = [];
function dataDirectory(): string {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'dems-row225-sites-'));
  roots.push(root);
  const dataDir = join(root, 'data');
  mkdirSync(dataDir, { mode: 0o700 });
  return dataDir;
}
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  for (const root of roots) expect(() => lstatSync(root)).toThrow();
});

type Load = NonNullable<Parameters<typeof storedSigningKeyReaders>[0]>;

/** The store's loader with a witness: what it was HANDED and what it loaded. */
function witnessed(): { load: Load; handed: Array<Record<string, unknown>>; loaded: Array<{ keyId: string; sha256: string }> } {
  const handed: Array<Record<string, unknown>> = [];
  const loaded: Array<{ keyId: string; sha256: string }> = [];
  return {
    handed,
    loaded,
    load: (options) => {
      handed.push({ ...options });
      const signer = loadSoftwareSigner(options);
      loaded.push({ keyId: signer.signer.keyId, sha256: signer.certificate.sha256 });
      return signer;
    },
  };
}

/** A REAL_PRODUCTION decision in which every check but 4 and 4b is answered as passing; 4 and 4b are the boot unit's own readers. */
function productionBoot(readers: ReturnType<typeof storedSigningKeyReaders>, directory: string): CaptureBootDeps {
  const directories = [{ ownerUid: 0, mode: 0o755 }, { ownerUid: SERVER_UID, mode: 0o755 }];
  return {
    decision: captureOperationDecisionOf({ captureMode: 'real', demoControls: false, captureDevSources: false, host: '127.0.0.1' }),
    workerProgram: '/opt/dems/capture-worker',
    inspect: () => ({ absolute: true, exists: true, regularFile: true, symbolicLink: false, file: { ownerUid: SERVER_UID, mode: 0o755 }, directoriesAsWritten: directories, directoriesResolved: directories, serverUid: SERVER_UID }),
    probeEvidenceVolume: () => ({ absolute: true, present: true, directory: true, ownerUid: SERVER_UID, mode: 0o700, serverUid: SERVER_UID, exclusiveCreate: true, exclusiveRefusesSecond: true, synced: true, hardLink: true, linkRefusesExisting: true, cleaned: true, totalBytes: 1_000_000_000_000, freeBytes: 400_000_000_000 }),
    signingKeyProblem: () => readers.problem(directory, NOW),
    signingKeyIsDevelopment: () => readers.isDevelopment(directory, NOW),
    demoPasswordOperators: async () => 0,
    handshake: async () => ({ outcome: 'HELLO', protocolVersion: CAPTURE_PROTOCOL_VERSION, workerVersion: CAPTURE_WORKER_VERSION }),
    sinks: { info: () => undefined, warn: () => undefined, error: () => undefined, persist: () => undefined },
  };
}

/** What each taker that needs no database answers on this data directory: the key it got, or the code it was refused with. */
async function answers(dataDir: string): Promise<{ resolver: string; boot: string; bootHandedAKeyId: boolean; seal: string; publicRead: string }> {
  const dir = sealingSignerDir(dataDir);
  const say = (act: () => { keyId: string; sha256: string }): string => {
    try {
      const { keyId, sha256 } = act();
      return `${keyId} ${sha256}`;
    } catch (error) {
      return error instanceof SignerError ? error.code : 'NOT A SIGNER CODE';
    }
  };
  const witness = witnessed();
  const boot = await runCaptureBootChecks(productionBoot(storedSigningKeyReaders(witness.load), dir)).then(
    () => (witness.loaded.length === 1 ? `${witness.loaded[0]?.keyId} ${witness.loaded[0]?.sha256}` : `LOADS=${witness.loaded.length}`),
    (error: unknown) => (error instanceof CaptureBootError && error.code === CaptureBootRefusal.SIGNING_KEY_UNUSABLE ? String(error.reason) : 'ANOTHER REFUSAL'),
  );
  return {
    resolver: say(() => {
      const keyId = activeSigningKeyId({ dir });
      return { keyId, sha256: readStoredCertificate({ dir, keyId }).sha256 };
    }),
    boot,
    bootHandedAKeyId: witness.handed.some((options) => 'keyId' in options),
    seal: say(() => loadSealingSigner({ dataDir, now: NOW }).certificate),
    publicRead: say(() => readStoredCertificate({ dir })),
  };
}

describe('SX-09 (a): the takers of the signing key give the same answer as the one resolver', () => {
  it('without a pointer, with a pointer, and with a pointer that cannot be taken', async () => {
    const dataDir = dataDirectory();
    const dir = sealingSignerDir(dataDir);
    const first = provisionSigningKey({ dir, now: NOW });

    // 1. NO POINTER: the first key, for everyone - today's stores.
    const before = await answers(dataDir);
    expect(before).toEqual({ resolver: `${FIRST} ${first.sha256}`, boot: `${FIRST} ${first.sha256}`, bootHandedAKeyId: false, seal: `${FIRST} ${first.sha256}`, publicRead: `${FIRST} ${first.sha256}` });

    // 2. A POINTER to the second key: the second key, for everyone; nobody answers with the first any more.
    const second = provisionSigningKey({ dir, now: NOW, keyId: SECOND });
    expect((await answers(dataDir)).seal).toBe(`${FIRST} ${first.sha256}`);
    activateSigningKey({ dir, keyId: SECOND, now: NOW });
    const after = await answers(dataDir);
    expect(after).toEqual({ resolver: `${SECOND} ${second.sha256}`, boot: `${SECOND} ${second.sha256}`, bootHandedAKeyId: false, seal: `${SECOND} ${second.sha256}`, publicRead: `${SECOND} ${second.sha256}` });
    expect(second.sha256).not.toBe(first.sha256);

    // 3. A POINTER THAT CANNOT BE TAKEN (group may read it; then: not a key id): the START IS REFUSED by check 4 with the named
    //    code, the seal is refused with the same code, and nobody falls back to a key - both keys are there and would load.
    const pointer = join(dir, ACTIVE_KEY_POINTER_NAME);
    for (const spoil of [(): void => rmSync(pointer), (): void => writeFileSync(pointer, `${SECOND}\n`, { mode: 0o640 }), (): void => writeFileSync(pointer, 'the second one\n', { mode: 0o600 })]) spoil();
    const refused = await answers(dataDir);
    expect(refused).toEqual({ resolver: 'ACTIVE_KEY_POINTER_INVALID', boot: 'ACTIVE_KEY_POINTER_INVALID', bootHandedAKeyId: false, seal: 'ACTIVE_KEY_POINTER_INVALID', publicRead: 'CERTIFICATE_INVALID' });
    for (const keyId of [FIRST, SECOND]) expect(loadSoftwareSigner({ dir, now: NOW, keyId }).signer.keyId).toBe(keyId);
  });
});

/**
 * THE RULE. A finding is `path: what`. `files` are production sources with their comments already
 * removed. The store's own file is the one place where the pointer is read and a key id resolved.
 */
const STORE = 'src/capture/signer/host-key.ts';
/** Where the name of the pointer may stand besides the store: its export. */
const POINTER_NAME_PLACES = [STORE, 'src/capture/signer/index.ts'];
/**
 * The files that may hand a key id to a loader. Each is a host command that must look at ONE NAMED
 * key and says so in its header: the rotation (the new key, before it is active) and the compromise
 * mark (the key to mark). A file of the SERVER is never on this list; row 227 (the retained
 * certificates of the verify) adds its reader here by name when it lands.
 */
const NAMED_KEY_READERS = ['cli/rotate-key-command.ts', 'cli/mark-compromised-command.ts'];
/** The files that may name the constant of the FIRST key id: the store, its two exports, the two provisioning callers. */
const FIRST_KEY_ID_PLACES = [STORE, 'src/capture/signer/index.ts', 'src/capture/signer/types.ts', 'src/sealing/signing.ts', 'cli/production-key-command.ts'];
/** The files that may write a key id of the series in so many words. */
const SERIES_LITERAL_PLACES = [STORE, 'src/capture/signer/types.ts'];
/** The files that may ASK the resolver by name (to print the answer): the two commands. The server asks through the loaders. */
const RESOLVER_CALLERS = [STORE, 'src/capture/signer/index.ts', ...NAMED_KEY_READERS];

const POINTER = ACTIVE_KEY_POINTER_NAME;
const RULES: ReadonlyArray<{ readonly what: string; readonly pattern: RegExp; readonly allowed: readonly string[] }> = [
  { what: 'names the pointer', pattern: /\bACTIVE_KEY_POINTER_NAME\b/, allowed: POINTER_NAME_PLACES },
  { what: 'builds the path of the pointer', pattern: new RegExp(`(?:join|resolve)\\([^()]*['"\`]${POINTER}['"\`]\\s*\\)|[/\\\\]${POINTER}['"\`]`), allowed: [STORE] },
  { what: 'hands a key id to a loader', pattern: /\b(?:loadSoftwareSigner|loadSealingSigner|readStoredCertificate)\s*\(\s*\{[^{}]*\bkeyId\b/, allowed: [STORE, ...NAMED_KEY_READERS] },
  { what: 'names the first key id', pattern: /\bCORE_EVIDENCE_SIGNING_KEY_ID\b/, allowed: FIRST_KEY_ID_PLACES },
  { what: 'writes a key id of the series', pattern: /CORE-KEY-EVSIGN-/, allowed: SERIES_LITERAL_PLACES },
  { what: 'asks the resolver by name', pattern: /\bactiveSigningKeyId\b/, allowed: RESOLVER_CALLERS },
  { what: 'defines a resolver of its own', pattern: /\b(?:function|const|let)\s+\w*(?:[Aa]ctive\w*(?:Signing|Sealing|Evidence)?\w*KeyId|[Ss]igningKeyIdOf|[Cc]urrentSigningKey)\w*/, allowed: [STORE] },
];

function secondResolversIn(files: readonly SourceFile[]): string[] {
  const findings: string[] = [];
  for (const file of files) {
    for (const rule of RULES) {
      if (!rule.allowed.includes(file.path) && rule.pattern.test(file.text)) findings.push(`${file.path}: ${rule.what}`);
    }
  }
  return findings.sort();
}

/** Every production source of the server and of its host commands, without comments. */
function productionSources(): SourceFile[] {
  return readTree(WORKSPACE)
    .filter((file) => /\.[cm]?ts$/.test(file.path) && !isTestFile(file.path) && (file.path.startsWith('src/') || file.path.startsWith('cli/')))
    .map((file) => ({ path: file.path, text: stripComments(file.text) }));
}

describe('SX-09 (a), static: no second resolver of the active key id', () => {
  const sources = productionSources();
  const textOf = (path: string): string => {
    const file = sources.find((entry) => entry.path === path);
    if (file === undefined) throw new Error(`not read: ${path}`);
    return file.text;
  };

  it('no production source of src/ or cli/ reads the pointer, hands a key id to a loader, writes a key id of the series or resolves on its own', () => {
    expect(sources.length).toBeGreaterThan(300);
    expect(sources.some((file) => file.path.startsWith('cli/'))).toBe(true);
    expect(secondResolversIn(sources)).toEqual([]);
    // No file of the server is on a list of exceptions: the named readers are host commands.
    expect(NAMED_KEY_READERS.every((path) => path.startsWith('cli/'))).toBe(true);
  });

  it('each call site is the one line that reaches the store without a key id', () => {
    // The resolver is asked in exactly two places of the store: the default of the loader and of the public read.
    const store = textOf(STORE);
    // Row 226b (count 4 -> 5): the signer the loader returns asks the SAME resolver again before each signature, and only
    // when it was loaded without a key id - a third place of the store, no second resolver.
    // Row 227 (count 5 -> 6): the reader of the retained certificate set asks it for "at or before the active id".
    expect(store.match(/\bactiveSigningKeyId\(/g)).toHaveLength(6);
    expect(store).toContain('const activePlace = signingKeySeriesNumber(activeSigningKeyId({ dir: options.dir, ownerUid })) ?? 0;');
    expect(store).toContain('if (loadedAsActive && activeSigningKeyId({ dir: options.dir, ownerUid }) !== keyId) throw new SignerError(SignerRefusal.ACTIVE_KEY_CHANGED, keyId);');
    expect(store).toContain('const keyId = options.keyId ?? activeSigningKeyId({ dir: options.dir, ownerUid });');
    expect(store).toContain('if (options.keyId === undefined) keyId = activeSigningKeyId({ dir: options.dir, ownerUid });');
    // The pointer is read by ONE function, through the one reader of stored files, and written by one rename.
    expect(store.match(/ACTIVE_KEY_POINTER_NAME/g)).toHaveLength(4);
    expect(store.match(/\brenameSync\(/g)).toHaveLength(1);
    // Boot checks 4 and 4b: the two readers call the handed loader with the directory and the instant, nothing else.
    const boot = textOf('src/capture/boot/index.ts');
    // Row 228 (pin moved by delta, 2 -> 3): check 4b-2 has a THIRD reader over the same load, called the same way - no key id.
    expect(boot.match(/\bload\(\{ dir: directory, now \}\)/g)).toHaveLength(3);
    expect(boot).toContain('export function storedSigningKeyReaders(load: SigningKeyLoad = loadSoftwareSigner)');
    // The seal, the transcript revisions, the verify.
    expect(textOf('src/sealing/signing.ts')).toContain('return loadSoftwareSigner({ dir: sealingSignerDir(options.dataDir), now: options.now });');
    const host = textOf('src/sealing-host/index.ts');
    expect(host.match(/\bloadSealingSigner\(/g)).toHaveLength(1);
    expect(host).toContain('(signing ??= loadSealingSigner({ dataDir: app.config.dataDir, now: now() }))');
    // Row 227 (re-stated, as row 225's information line asks): the verify no longer trusts the ACTIVE certificate alone
    // (`signingNow().certificate.sha256`) but the retained set of the store, which the store reads with its own resolver;
    // the composition hands it the data directory and the operation, never a key id.
    expect(host).not.toContain('signingNow().certificate.sha256');
    expect(host.match(/sealingVerifyTrust\(\{ dataDir: app\.config\.dataDir, production: operation === CaptureOperation\.REAL_PRODUCTION \}\)\.(?:trusted|compromised)/g)).toHaveLength(2);
    expect(textOf('src/sealing/signing.ts')).toContain('retained = readRetainedCertificates({ dir: sealingSignerDir(options.dataDir) });');
    const transcripts = textOf('src/modules/transcripts/routes.ts');
    expect(transcripts.match(/\bloadSealingSigner\(/g)).toHaveLength(1);
    expect(transcripts).toContain('const loadCoreSigner: RevisionSignerLoader = (app, now) => loadSealingSigner({ dataDir: app.config.dataDir, now });');
  });

  it('THE RULE FAILS ON A PLANTED SECOND RESOLVER: in a synthetic file, and in the real text of each call site', () => {
    const planted: Array<[string, string]> = [
      ['names the pointer', "import { ACTIVE_KEY_POINTER_NAME } from '../capture';"],
      ['builds the path of the pointer', `const id = readFileSync(join(dir, '${POINTER}'), 'utf8').trim();`],
      ['builds the path of the pointer', `const id = readFileSync(\`\${dataDir}/signer/${POINTER}\`, 'utf8');`],
      ['hands a key id to a loader', 'const signer = loadSoftwareSigner({ dir, now, keyId: chosen });'],
      ['hands a key id to a loader', 'const signer = loadSealingSigner({\n  dataDir,\n  now,\n  keyId,\n});'],
      ['hands a key id to a loader', 'const certificate = readStoredCertificate({ dir, keyId: configured });'],
      ['names the first key id', 'const keyId = CORE_EVIDENCE_SIGNING_KEY_ID;'],
      ['writes a key id of the series', "const keyId = 'CORE-KEY-" + "EVSIGN-02';"],
      ['asks the resolver by name', 'const keyId = activeSigningKeyId({ dir });'],
      ['defines a resolver of its own', 'export function activeKeyIdOf(dir: string): string { return first; }'],
      ['defines a resolver of its own', 'const currentSigningKey = (dir: string): string => first;'],
    ];
    for (const [what, text] of planted) expect(secondResolversIn([{ path: 'src/planted/second-resolver.ts', text: stripComments(text) }]), text).toContain(`src/planted/second-resolver.ts: ${what}`);
    // A comment that only TALKS about the pointer is not a use of it.
    expect(secondResolversIn([{ path: 'src/planted/talk.ts', text: stripComments(`// the file ${POINTER} of the store and activeSigningKeyId\nexport const one = 1;`) }])).toEqual([]);

    // In the real text of each call site: one planted key id makes the rule fail on that file.
    const plantIn = (path: string, from: string, to: string): string[] => {
      const text = textOf(path);
      expect(text, path).toContain(from);
      return secondResolversIn(sources.map((file) => (file.path === path ? { path, text: text.replace(from, to) } : file)));
    };
    expect(plantIn('src/sealing/signing.ts', 'loadSoftwareSigner({ dir: sealingSignerDir(options.dataDir), now: options.now })', 'loadSoftwareSigner({ dir: sealingSignerDir(options.dataDir), now: options.now, keyId: pinned })')).toEqual(['src/sealing/signing.ts: hands a key id to a loader']);
    expect(plantIn('src/sealing-host/index.ts', 'loadSealingSigner({ dataDir: app.config.dataDir, now: now() })', 'loadSealingSigner({ dataDir: app.config.dataDir, now: now(), keyId: CORE_EVIDENCE_SIGNING_KEY_ID })')).toEqual([
      'src/sealing-host/index.ts: hands a key id to a loader',
      'src/sealing-host/index.ts: names the first key id',
    ]);
    expect(plantIn('src/modules/transcripts/routes.ts', 'loadSealingSigner({ dataDir: app.config.dataDir, now })', 'loadSealingSigner({ dataDir: app.config.dataDir, now, keyId: activeSigningKeyId({ dir }) })')).toEqual([
      'src/modules/transcripts/routes.ts: asks the resolver by name',
      'src/modules/transcripts/routes.ts: hands a key id to a loader',
    ]);
    expect(plantIn('src/capture/boot/index.ts', 'load({ dir: directory, now })', "load({ dir: directory, now, keyId: 'CORE-KEY-" + "EVSIGN-01' })")).toEqual(['src/capture/boot/index.ts: writes a key id of the series']);
  });
});
