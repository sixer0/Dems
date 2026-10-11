// Static guards of the STT configuration (blueprint row 113; requirement R-8; C3 §2.5; dbc-3
// §B.13; SEC35-14; E-30/E-31). They read production sources as text, with the scaffold's scanner,
// and keep these rules true for every later row:
//
//   1. THE REVEAL FUNCTION HAS ONE CALLER (since row 115; none before it). `dems_stt_credential_reveal()`
//      is granted to the one runtime role (D-DB-07 forbids a fourth), it writes no audit row
//      (no reveal type exists in the contract), so NOTHING in the database narrows who reads the
//      STT credential back. This rule is that narrowing - the only control there is (row 112,
//      residual 3): outside the migration that defines the function, no production source of the
//      server names it, except the files of `STT_REVEAL_CALLERS`. The list is empty until the
//      transcriber key-loader lands (row 115), which adds exactly its one file here.
//   2. THE CREDENTIAL COLUMNS ARE WRITTEN, NEVER READ. In the module, `credential_ref`,
//      `secret_ciphertext` and `nonce` appear in one statement, in its SET list; no statement
//      selects, returns or compares one; no statement is a `SELECT *`.
//   3. THE MODULE REACHES NOTHING OF THE HOST: no outbound connection, no file, no process, no
//      environment. The test of the connection is a provided probe (`seams.ts`).
//   4. A LOG LINE OF THE MODULE NAMES FIELDS, NEVER VALUES: its log calls carry only the keys of
//      a closed list, and none reads the request body.
//   5. THE AUDIT ENTRY HAS ONE BUILDER, AND IT TAKES NO CREDENTIAL.
import { describe, expect, it } from 'vitest';
import { logCalls } from '../../../../test/static/log-calls';
import { SCAN_COVERS, WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, scanCoverage, type SourceFile } from '../../../../test/static/scan';
import { LOCK_STT_CONFIG, READ_STT_CONFIG, UPDATE_STT_CONFIG, UPDATE_STT_CONFIG_WITH_CREDENTIAL } from '../statements';

const FOLDER = 'src/modules/stt-config/';
/** Built from parts, so that this file is not itself an occurrence. */
const REVEAL_FUNCTION = ['dems', 'stt', 'credential', 'reveal'].join('_');
const CREDENTIAL_COLUMNS = ['credential_ref', 'secret_ciphertext', 'nonce'] as const;

/**
 * The production sources that may call the reveal function: ONE file, the reveal caller of the
 * Core's transcription composition (row 115; it reads how the credential is held and hands a
 * REFERENCE to the transcriber's single key-loader, `07_transcript_spec.md` §B.2). A second entry
 * is a second reader of the STT credential and needs a decision, not an edit.
 */
const STT_REVEAL_CALLERS: readonly string[] = ['src/transcription/credential-reveal.ts'];
/** Where the function is defined and described: the migration set, never a caller. */
const DEFINED_IN = 'src/db/migrations/';

const tree = readTree(WORKSPACE);
const production = tree.filter((file) => isProductionSource(file.path));
const productionCode = codeOnly(production);
const moduleSources = production.filter((file) => file.path.startsWith(FOLDER));
const moduleCode = codeOnly(moduleSources);
const places = (files: readonly SourceFile[], pattern: RegExp): string[] => occurrences(files, pattern);

describe('the scan itself', () => {
  it('reads the production sources of the folder, and the migration that defines the function', () => {
    expect(scanCoverage(moduleSources, [FOLDER])).toEqual(SCAN_COVERS);
    expect(moduleCode.every((file) => file.text.length > 100)).toBe(true);
    const defining = production.filter((file) => file.text.includes(REVEAL_FUNCTION)).map((file) => file.path);
    expect(defining).toContain('src/db/migrations/0007_stt_config_privileges.sql');
  });

  it('finds each forbidden text when it is present (positive control)', () => {
    const planted: SourceFile[] = [
      { path: 'src/modules/x/reader.ts', text: `const row = await pool.query('SELECT * FROM public.${REVEAL_FUNCTION}()');` },
      { path: 'src/modules/x/read.ts', text: "const TEXT = 'SELECT secret_ciphertext, nonce FROM public.stt_config';\nfetch('http://127.0.0.1:9000/v1/models');" },
      { path: 'src/modules/x/host.ts', text: "import { readFileSync } from 'node:fs';\nimport http from 'node:http';\nconst key = process.env.KEY;" },
    ];
    expect(places(planted, new RegExp(REVEAL_FUNCTION, 'g'))).toEqual(['src/modules/x/reader.ts:1']);
    expect(places(planted, CREDENTIAL_COLUMN)).toEqual(['src/modules/x/read.ts:1', 'src/modules/x/read.ts:1']);
    expect(places(planted, GLOBAL_FETCH)).toEqual(['src/modules/x/read.ts:2']);
    expect(places(planted, HOST_MODULE)).toEqual(['src/modules/x/host.ts:1', 'src/modules/x/host.ts:2']);
    expect(places(planted, ENVIRONMENT)).toEqual(['src/modules/x/host.ts:3']);
    expect(selectsCredential('SELECT s.enabled, s.nonce FROM public.stt_config s')).toBe(true);
    expect(selectsCredential('UPDATE public.stt_config SET nonce = $1 WHERE singleton RETURNING revision')).toBe(false);
    expect(selectsCredential('UPDATE public.stt_config SET enabled = $1 WHERE singleton RETURNING nonce')).toBe(true);
    expect(selectsCredential('UPDATE public.stt_config SET enabled = $1 WHERE credential_ref = $2')).toBe(true);
    const log = logCalls("request.log.info({ code: 'X', body: request.body }, 'changed');")[0];
    expect(log?.members.map((member) => member.key)).toEqual(['code', 'body']);
  });
});

const CREDENTIAL_COLUMN = new RegExp(`\\b(?:${CREDENTIAL_COLUMNS.join('|')})\\b`, 'g');
const GLOBAL_FETCH = /(?<![.\w$])fetch\s*\(/g;
const HOST_MODULE = /['"](?:node:)?(?:fs|fs\/promises|child_process|net|http|https|http2|dgram|tls|os|worker_threads|undici)['"]/g;
const ENVIRONMENT = /\bprocess\s*\.\s*env\b/g;

/**
 * True when a statement text reads a credential column: names one anywhere outside the SET list
 * of an UPDATE (a select list, a RETURNING clause, a WHERE comparison).
 */
function selectsCredential(text: string): boolean {
  const set = /\bSET\b([\s\S]*?)\bWHERE\b/i.exec(text);
  const outside = set === null ? text : text.replace(set[1] ?? '', ' ');
  return CREDENTIAL_COLUMNS.some((column) => new RegExp(`\\b${column}\\b`).test(outside));
}

describe('rule 1: the reveal function has one caller', () => {
  it('no production source outside the migration set names the function, except the listed caller', () => {
    // Code only: a sentence in a comment that names the function is not a call of it. A call sits
    // in a statement text, and string literals are kept by the scanner.
    const named = places(productionCode, new RegExp(REVEAL_FUNCTION, 'g')).filter((place) => !place.startsWith(DEFINED_IN));
    const callers = [...new Set(named.map((place) => place.replace(/:\d+$/, '')))];
    console.info(`[row113] reveal-function callers outside ${DEFINED_IN}: ${callers.length === 0 ? '(none)' : callers.join(', ')} | allowed: ${STT_REVEAL_CALLERS.join(', ')}`);
    expect(callers).toEqual([...STT_REVEAL_CALLERS]);
    expect(STT_REVEAL_CALLERS.length).toBeLessThanOrEqual(1);
  });

  it('this module is not that caller, now or later: it never names the function', () => {
    expect(STT_REVEAL_CALLERS.filter((path) => path.startsWith(FOLDER))).toEqual([]);
    expect(moduleSources.filter((file) => stripped(file).includes(REVEAL_FUNCTION)).map((file) => file.path)).toEqual([]);
  });
});

/** A source without the one sentence of `statements.ts` that explains the rule in words. */
function stripped(file: SourceFile): string {
  return codeOnly([file])[0]?.text ?? '';
}

describe('rule 2: the credential columns are written, never read', () => {
  it('they appear in one production file of the module, and there in one statement only', () => {
    // The two column names no TypeScript identifier of the module shares (`nonce` is also the name
    // of a member of a sealed envelope, so it is held by the statement texts below instead).
    const named = places(moduleCode, /\b(?:credential_ref|secret_ciphertext)\b/g).map((place) => place.replace(/:\d+$/, ''));
    expect(named).toEqual([`${FOLDER}statements.ts`, `${FOLDER}statements.ts`]);
    // Once each, in the SET list of the one statement that writes a credential.
    for (const column of CREDENTIAL_COLUMNS) {
      expect(UPDATE_STT_CONFIG_WITH_CREDENTIAL.split(column).length - 1, column).toBe(1);
      for (const text of [READ_STT_CONFIG, LOCK_STT_CONFIG, UPDATE_STT_CONFIG]) expect(text, column).not.toContain(column);
    }
  });

  it('no statement selects, returns or compares one, and none is a SELECT *', () => {
    const statements = { READ_STT_CONFIG, LOCK_STT_CONFIG, UPDATE_STT_CONFIG, UPDATE_STT_CONFIG_WITH_CREDENTIAL };
    for (const [name, text] of Object.entries(statements)) {
      expect(selectsCredential(text), name).toBe(false);
      expect(text, name).not.toMatch(/\*/);
      expect(text, name).toContain('public.stt_config');
    }
    expect(UPDATE_STT_CONFIG).toMatch(/RETURNING revision$/);
    expect(UPDATE_STT_CONFIG_WITH_CREDENTIAL).toMatch(/RETURNING revision$/);
    // The columns the reads name are exactly the ones migration 0007 grants (minus `singleton`).
    const selected = [...READ_STT_CONFIG.matchAll(/\bs\.([a-z_]+)/g)].map((match) => match[1]);
    expect(selected).toEqual(['enabled', 'backend', 'endpoint', 'model', 'language', 'diarization', 'credential_kind', 'revision', 'updated_by', 'updated_at', 'singleton']);
  });

  it('every statement of the module is one of those four: no other text names the table', () => {
    const tableUses = places(moduleCode, /public\.stt_config\b/g);
    expect(tableUses.every((place) => place.startsWith(`${FOLDER}statements.ts:`))).toBe(true);
    expect(places(moduleCode, /\.query\s*(?:<[^>]*>)?\s*\(\s*[`'"]/g)).toEqual([]);
  });
});

describe('rule 3: the module reaches nothing of the host', () => {
  it('no outbound connection, no file, no process, no environment, no console', () => {
    expect(places(moduleCode, GLOBAL_FETCH)).toEqual([]);
    expect(places(moduleCode, HOST_MODULE)).toEqual([]);
    expect(places(moduleCode, ENVIRONMENT)).toEqual([]);
    expect(places(moduleCode, /\bconsole\s*\./g)).toEqual([]);
    expect(places(moduleCode, /\bDate\.now\s*\(|\bnew Date\s*\(/g)).toEqual([]);
  });

  it('the whole server still opens no outbound connection: operation 92 added none', () => {
    const runtime = productionCode.filter((file) => !file.path.startsWith('src/db/'));
    expect(places(runtime, GLOBAL_FETCH)).toEqual([]);
  });
});

describe('rule 4: a log line of the module names fields, never values', () => {
  const ALLOWED_KEYS = new Set(['code', 'source', 'changedFields', 'credentialChanged', 'revision', 'appliesFrom', 'backend']);

  it('its log calls carry only the keys of the closed list', () => {
    const calls = moduleCode.flatMap((file) => logCalls(file.text).map((call) => ({ path: file.path, call })));
    expect(calls.length).toBeGreaterThanOrEqual(3);
    const keys = calls.flatMap(({ call }) => call.members.map((member) => member.key));
    // The list above is a SECURITY boundary and stays a list (test/14): a new key is a decision. The message names the key and the rule.
    const outside = calls.flatMap(({ path, call }) => call.members.filter((member) => !ALLOWED_KEYS.has(member.key)).map((member) => `${path}: ${member.key}`));
    expect(outside, 'a log call of the module holds a key outside the closed list. The rule: a log line names fields - a code, a count, a boolean, the name of a changed field - never a value of the configuration and never a text of the request. Add the key to ALLOWED_KEYS only if it is one of those').toEqual([]);
    expect(new Set(keys).has('changedFields')).toBe(true);
  });

  it('the request body is read in two statements of one handler - is a credential there (S99-09), then the hand-over to the unit: never a log call, an error or the error log', () => {
    const reads = places(moduleCode, /\brequest\s*\.\s*body\b/g);
    expect(reads).toHaveLength(2);
    for (const read of reads) expect(read).toMatch(new RegExp(`^${FOLDER}index\\.ts:\\d+$`));
    const index = moduleCode.find((file) => file.path === `${FOLDER}index.ts`)?.text ?? '';
    expect(index).toMatch(/changeSttConfig\(app, actorOf\(request\), request\.body, \{/);
    // S99-09 (batch N): the ONE question asked of the body before the unit is whether it carries a credential at all - no value
    // of it is read - and the answer goes to the guard, BEFORE the hand-over. The guard is handed the request, never the body.
    const asked = 'if (request.body.credential !== undefined) await permissionGuard(app).requireWebConsoleSession(request);';
    expect(index.split(asked)).toHaveLength(2);
    expect(index.indexOf(asked)).toBeLessThan(index.indexOf('changeSttConfig(app, actorOf(request), request.body, {'));
    expect(index.indexOf(asked)).toBeGreaterThan(index.indexOf("...routeOfOperation(registryEntry('updateSttConfig')),"));
    // No refusal text is built from a value: every `new ApiFailure(` of the module has a fixed message.
    for (const file of moduleCode) {
      for (const match of file.text.matchAll(/new ApiFailure\(\s*\d+,\s*[A-Za-z.]+,\s*([^,]+),/g)) expect(match[1]?.trim(), file.path).toMatch(/^'[^'$]*'$/);
    }
  });
});

describe('rule 5: the audit entry has one builder, and it takes no credential', () => {
  it('STT_CONFIG_CHANGED is written in one place of the server, from field names and flags', () => {
    const written = places(productionCode, /type:\s*'STT_CONFIG_CHANGED'/g).filter((place) => !place.startsWith('src/db/fixtures/'));
    expect(written).toHaveLength(1);
    expect(written[0]).toMatch(new RegExp(`^${FOLDER}change\\.ts:\\d+$`));
    const change = moduleCode.find((file) => file.path === `${FOLDER}change.ts`)?.text ?? '';
    const builder = /export function sttConfigChanged\([\s\S]*?\n}\n/.exec(change)?.[0] ?? '';
    expect(builder).toContain('details: sttConfigChangedDetails(input)');
    expect(builder).not.toMatch(/credential(?!Changed)/);
    expect(builder).not.toMatch(/endpoint|model|\bref\b|value/);
  });
});
