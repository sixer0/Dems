/**
 * Support of the acceptance test "role-by-endpoint matrix" (plan row W47; not a test file).
 *
 * Nothing here builds an app, opens a connection or imports Vitest. Two things only:
 *
 *   1. THE SPECIFICATION, READ MECHANICALLY - COMPOSED. `readSpecification()` reads
 *      `docs/2026-10-04_dems_backend_rbac_pairing/masterplan/01_specs.md` as text and takes from
 *      its tables what the matrix needs: the role matrix of section 4.4, the "enforced at" list
 *      of section 4.3, the 75 rows of the operation tables of section 7 (number, operation ID,
 *      method, path, access rule, audit rule), what a retired device may call (section 6.6), the
 *      three export operations of RB-5, the two limits of the throttle (ID-P12, ID-P13), the
 *      reason of the refusal "needs the device's own credential" (section 7.2) and the
 *      denied-cell counts that AC-B-16 states. A table that no longer has the form read here
 *      stops the test with a message that names it: a changed document is never read as "equal".
 *
 *   2. THE EXPECTED ANSWER OF ONE CELL. `expectationOf(operation, caller, grants, demoFlag)`
 *      derives it from the REGISTRY entry of the operation (its access rule, its conditions, its
 *      denial type), from what the specification says about the caller (section 4.1, 4.2, 6.3,
 *      6.6, 7.2, 7.3, 12.1) and from the grants it is given: the stored matrix of the test's own
 *      database.
 *      It holds no list of operations and no expectation per operation.
 *
 * This file does not import the server's decision function, its rule book or any of their
 * constants: the expectation is written from the specification, independently of the code under
 * test.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CORE_API_EXAMPLES,
  CoreApiAccessCondition,
  CoreApiAccessKind,
  coreApiAccessPermissions,
  type CoreApiRegistryOperation,
} from '@dems/shared/api';
import { OperatorRole } from '@dems/shared/sim';

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 1. The specification, read mechanically
// ═══════════════════════════════════════════════════════════════════════════════════════════════

/** `masterplan/01_specs.md` of the task folder, from the workspace root. */
export const SPECIFICATION_FILE = fileURLToPath(
  new URL('../../../../docs/2026-10-04_dems_backend_rbac_pairing/masterplan/01_specs.md', import.meta.url),
);
/**
 * C3, the current API contract (ruling D44 R1): the closed task-2 specification above is never
 * edited; its 75 rows are the BASE. C3 §2.1 (the RBAC rows), §2.2 (the identity table) and §2.5
 * (the STT configuration table) add operations 76 to 92 and the two new permissions;
 * `readApiContract()` transcribes them into
 * `SpecOperation` / `Grant` rows and `readSpecification()` COMPOSES them onto the base.
 */
export const API_CONTRACT_FILE = fileURLToPath(
  new URL('../../../../docs/2026-10-07_dems_real_capture_sealing/masterplan/03_api_contract.md', import.meta.url),
);

/** One row of an operation table of section 7, as the document writes it. */
export interface SpecOperation {
  /** The operation number of the specification (1 to 75). */
  readonly number: number;
  readonly operationId: string;
  readonly method: 'GET' | 'POST';
  readonly path: string;
  /** The marker of section 4.2: `PUBLIC`, `DEVICE`, `AUTHENTICATED`, a permission, or `ANY-OF(A, B)`. */
  readonly access: string;
  /** What the row asks on top of its marker, in the registry's words, sorted. */
  readonly conditions: readonly string[];
  /** The success rule: an audit type, `NONE-R` or `NONE-P`. */
  readonly auditSuccess: string;
  readonly auditDenial: 'ACCESS_DENIED' | 'EXPORT_DENIED';
  /** The code of a refusal for a missing permission: `FORBIDDEN` where the row names it (RB-5). */
  readonly denialCode: 'NOT_PERMITTED' | 'FORBIDDEN';
  /** The subsection that holds the row, for example `7.16`. */
  readonly section: string;
  /** The line of the document, for a message. */
  readonly line: number;
}

export interface Specification {
  readonly revision: string;
  readonly lines: number;
  /** The 75 rows of sections 7.4 to 7.16, in the order of their numbers. */
  readonly operations: readonly SpecOperation[];
  /** Section 4.4, header row: the roles, in the order of the columns. */
  readonly roles: readonly string[];
  /** Section 4.4, first column: the permissions, in the order of the rows. */
  readonly permissions: readonly string[];
  /** Section 4.4: `role` holds `permission`. */
  readonly grants: readonly Grant[];
  /** Section 4.4, the row "Grants": the count the document states per role. */
  readonly statedGrantCounts: Readonly<Record<string, number>>;
  /** Section 4.3: the operation numbers each permission is enforced at. */
  readonly enforcedAt: Readonly<Record<string, readonly number[]>>;
  /** Section 6.6: what the credential of a REVOKED device may still call. */
  readonly retiredDeviceMayCall: readonly string[];
  /** RB-5: the numbers of the three export operations. */
  readonly exportOperations: readonly number[];
  /** Section 5.1, the key table: the operations a DEVICE key counts at the strict limit. */
  readonly deviceStrictOperations: readonly number[];
  /** ID-P12: requests per window at the strict limit (the class keys). */
  readonly strictLimit: number;
  /** ID-P13: audited refusals per key and window. */
  readonly denialBudget: number;
  /** ID-P12 and ID-P13: the window, in milliseconds. */
  readonly windowMs: number;
  /** AC-B-16: the denied cells the document states for two roles. */
  readonly statedDeniedCells: Readonly<Record<string, number>>;
  /**
   * Section 7.2, the line of `DEVICE_NOT_PAIRED`: `details.reason` of the refusal of "an operation
   * that needs the device's own credential, called with a session of the device".
   */
  readonly deviceCredentialReason: string;
  /**
   * C3 §4 (erratum PE-121-08), the row of `NOT_PERMITTED`: `details.reason` of the refusal of "a
   * device-bound session on a credential-carrying operation" (the condition `WEB_CONSOLE_SESSION`).
   */
  readonly webConsoleOnlyReason: string;
}

export interface Grant {
  readonly role: string;
  readonly permission: string;
}

function unreadable(what: string): never {
  throw new Error(`the specification no longer has the form this test reads: ${what} (${SPECIFICATION_FILE})`);
}

/** The cells of a table row: the text between the pipes, trimmed. */
function cellsOf(line: string): string[] {
  return line.split('|').slice(1, -1).map((cell) => cell.trim());
}

/** The text between the first pair of backticks of a cell. */
function firstCode(cell: string | undefined, what: string): string {
  const found = /`([^`]+)`/.exec(cell ?? '');
  if (found?.[1] === undefined) unreadable(what);
  return found[1];
}

const numbersOf = (text: string): number[] => (text.match(/\d+/g) ?? []).map(Number);

/** The lines from the heading that starts with `from` up to the next heading of the same level. */
function sectionOf(lines: readonly string[], from: string): Array<{ text: string; line: number }> {
  const start = lines.findIndex((line) => line.startsWith(from));
  if (start === -1) unreadable(`heading "${from}"`);
  const level = /^#+/.exec(from)?.[0] ?? '###';
  const body: Array<{ text: string; line: number }> = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const text = lines[index] ?? '';
    if (text.startsWith(`${level} `)) break;
    body.push({ text, line: index + 1 });
  }
  return body;
}

function readRoleMatrix(lines: readonly string[]): Pick<Specification, 'roles' | 'permissions' | 'grants' | 'statedGrantCounts'> {
  const section = sectionOf(lines, '### 4.4 ');
  const header = section.find(({ text }) => text.startsWith('| Permission |'));
  if (header === undefined) unreadable('the header row of the role matrix (section 4.4)');
  const roles = cellsOf(header.text).slice(1);
  const permissions: string[] = [];
  const grants: Grant[] = [];
  let statedGrantCounts: Record<string, number> | undefined;
  for (const { text } of section) {
    const cells = cellsOf(text);
    if (text.startsWith('| Grants |')) {
      statedGrantCounts = Object.fromEntries(roles.map((role, index) => [role, Number(cells[index + 1])]));
      continue;
    }
    if (!text.startsWith('| `')) continue;
    const permission = firstCode(cells[0], 'a permission of the role matrix (section 4.4)');
    permissions.push(permission);
    roles.forEach((role, index) => {
      const mark = (cells[index + 1] ?? '').replaceAll('*', '');
      if (mark !== 'yes' && mark !== 'no') unreadable(`the cell ${permission} / ${role} of the role matrix (section 4.4)`);
      if (mark === 'yes') grants.push({ role, permission });
    });
  }
  if (statedGrantCounts === undefined) unreadable('the row "Grants" of the role matrix (section 4.4)');
  return { roles, permissions, grants, statedGrantCounts };
}

function readEnforcedAt(lines: readonly string[]): Record<string, number[]> {
  const enforcedAt: Record<string, number[]> = {};
  for (const { text } of sectionOf(lines, '### 4.3 ')) {
    if (!/^\| +\d+ \| `/.test(text)) continue;
    const cells = cellsOf(text);
    enforcedAt[firstCode(cells[1], 'a permission of the permission list (section 4.3)')] = numbersOf(cells[4] ?? '');
  }
  if (Object.keys(enforcedAt).length === 0) unreadable('the permission list (section 4.3)');
  return enforcedAt;
}

/**
 * The conditions a row of section 7 states, in the registry's words. Four texts are read:
 * "plus ID-1" (the console rule of `signIn`), "must be bound to a device" (operation 7), "needs
 * the device's own credential" (decision D118: any row that says so, whichever operation it is),
 * and the sentence above the table of section 7.16 ("All five need `DEMO_CONTROL` and the
 * server-side demo flag"), which holds for every row of that table.
 */
function conditionsOf(accessCell: string, demoSection: boolean): string[] {
  const conditions: string[] = [];
  if (/plus ID-1/.test(accessCell)) conditions.push(CoreApiAccessCondition.CONSOLE_IDENTITY);
  if (/must be bound to a device/.test(accessCell)) conditions.push(CoreApiAccessCondition.DEVICE_SESSION);
  if (/needs the device's own credential/.test(accessCell)) conditions.push(CoreApiAccessCondition.DEVICE_CREDENTIAL);
  if (demoSection) conditions.push(CoreApiAccessCondition.DEMO_FLAG);
  return conditions.sort();
}

function readOperations(lines: readonly string[]): SpecOperation[] {
  const operations: SpecOperation[] = [];
  let section = '';
  let demoSection = false;
  for (const { text, line } of sectionOf(lines, '## 7. ')) {
    const heading = /^### (7\.\d+) /.exec(text);
    if (heading?.[1] !== undefined) {
      section = heading[1];
      demoSection = false;
      continue;
    }
    if (text.startsWith('All five need `DEMO_CONTROL` **and** the server-side demo flag')) demoSection = true;
    const row = /^\| (\d+) \| `(\w+)` \| (GET|POST) `([^`]+)` \|/.exec(text);
    if (row === null) continue;
    const cells = cellsOf(text);
    const accessCell = cells[3] ?? '';
    const auditCell = cells[4] ?? '';
    operations.push({
      number: Number(row[1]),
      operationId: row[2] ?? '',
      method: row[3] === 'GET' ? 'GET' : 'POST',
      path: row[4] ?? '',
      access: firstCode(accessCell, `the access rule of operation ${row[1]}`),
      conditions: conditionsOf(accessCell, demoSection),
      auditSuccess: firstCode(auditCell, `the audit rule of operation ${row[1]}`),
      auditDenial: /denial `EXPORT_DENIED`/.test(auditCell) ? 'EXPORT_DENIED' : 'ACCESS_DENIED',
      denialCode: /403 `FORBIDDEN`/.test(text) ? 'FORBIDDEN' : 'NOT_PERMITTED',
      section,
      line,
    });
  }
  return operations.sort((a, b) => a.number - b.number);
}

/** The permission names an access marker of the document lists: `PERMISSION X` or `ANY-OF(A, B)`. */
export function markerPermissions(access: string): string[] {
  const decorated = /^PERMISSION +(.+)$/.exec(access);
  if (decorated?.[1] !== undefined) return [decorated[1].trim()];
  const anyOf = /^ANY-OF\(([^)]+)\)$/.exec(access);
  if (anyOf?.[1] !== undefined) return anyOf[1].split(',').map((name) => name.trim()).filter((name) => name.length > 0);
  if (access === 'PUBLIC' || access === 'DEVICE' || access === 'AUTHENTICATED') return [];
  return [access];
}

/**
 * R3 (D44): the denied cells of a role over a set of rows, computed FROM the document tables -
 * the marker's permissions against the composed grant list. A row whose marker names no
 * permission (PUBLIC, DEVICE, AUTHENTICATED) is never a denied operator cell; a row whose marker
 * names permissions the role does not hold is one.
 */
export function deniedCellsFromTable(operations: readonly SpecOperation[], grants: readonly Grant[], roles: readonly string[]): Record<string, number> {
  return Object.fromEntries(roles.map((role) => [
    role,
    operations.filter((operation) => {
      // A row gated by `SESSION_HOLDER` is a denied operator cell on this fixture as well: no
      // role created the (absent) open session, so the condition refuses the web callers before
      // any permission question - the same cell the guard model counts (ACCESS_DENIED with the
      // holder's reason).
      if (operation.conditions.includes(CoreApiAccessCondition.SESSION_HOLDER) && role !== OperatorRole.SUPERVISOR) return true;
      const needed = markerPermissions(operation.access);
      return needed.length > 0 && !needed.every((permission) => grants.some((grant) => grant.role === role && grant.permission === permission));
    }).length,
  ]));
}

interface ApiContractDelta {
  readonly operations: readonly SpecOperation[];
  readonly webConsoleOnlyReason: string;
  readonly newPermissions: readonly string[];
  readonly grants: readonly Grant[];
}

/**
 * The identity tables of C3 that add operations to the closed base, each with the rows it must
 * hold: §2.2 (operations 76 to 89), §2.5 (the STT configuration operations 90 to 92 of task 3
 * row 113; R-8, confirmed as Q-STT-CFG at the second gate, decision D24) and §2.6 (operations 93 to
 * 97 of R-9..R-11; blueprint row 132). The three tables have the same columns.
 */
export const API_CONTRACT_SECTIONS: ReadonlyArray<{ readonly heading: string; readonly section: string; readonly rows: number; readonly what: string }> = [
  { heading: '### 2.2 ', section: 'C3 §2.2', rows: 14, what: 'the fourteen of operations 76 to 89' },
  { heading: '### 2.5 ', section: 'C3 §2.5', rows: 3, what: 'the three of operations 90 to 92' },
  // Task 3 R-9..R-11 (blueprint row 132, decision D106): the camera search, the connection test, the
  // adoption and the local-input re-read. The identity table of §2.6 has the columns of §2.2.
  // Task 4 (blueprint row 63, integration pass I-2): the same table gained the two sound-card
  // operations 98 and 99, in the form of its five rows; no new table, no new permission.
  // Task 4 (blueprint row 194): and the row of operation 100, the operator-confirmed re-address.
  // Task 4 (blueprint row 102): and the seven rows of the commissioning operations 101 to 107.
  // Task 4 (row V3, the third contract step; blueprint row 146): and the row of operation 108, the stored-credential connection test.
  // Task 4 (blueprint row 116, WP-26b): and the two rows of operations 109 and 110, the installation acceptance and its revocation.
  // Task 4 (row RD2; decision C147): and the row of operation 111, the retirement of a device.
  { heading: '### 2.6 ', section: 'C3 §2.6', rows: 19, what: 'the nineteen of operations 93 to 111' },
  { heading: '### 2.7 ', section: 'C3 §2.7', rows: 8, what: 'the eight of operations 112 to 119 (RB-9 as amended, D54; D57)' },
];

/** True for a row the composed table takes from C3, not from the closed task-2 base. */
export const isApiContractSection = (section: string): boolean => API_CONTRACT_SECTIONS.some((entry) => entry.section === section);

/**
 * The audit rule of a C3 row. The table writes a marker or a type in code form; for a command that
 * writes no row it says so in words ("none on success (no state change)", operation 92), which is
 * the registry's marker `NONE-P`: a command whose success writes no audit row.
 */
function auditSuccessOf(auditCell: string, number: string): string {
  if (/^none on success\b/i.test(auditCell.trim())) return 'NONE-P';
  return firstCode(auditCell, `the audit rule of C3 operation ${number}`);
}

/** Operations 76 to 97, the two new permissions and their grants, read from C3 §2.2, §2.5, §2.6, §3.1 and §2.1. */
function readApiContract(): ApiContractDelta {
  const lines = readFileSync(API_CONTRACT_FILE, 'utf8').split('\n');
  const operations: SpecOperation[] = [];
  for (const table of API_CONTRACT_SECTIONS) {
    const before = operations.length;
    readContractTable(lines, table.heading, table.section, operations);
    if (operations.length - before !== table.rows) unreadable(`the identity table of ${table.section} (read ${operations.length - before} rows, expected ${table.what})`);
  }
  // C3 §4: `| \`NOT_PERMITTED\` | 403 | \`WEB_CONSOLE_ONLY\` | 89, 95, 96 | a device-bound session on a credential-carrying operation (\`WEB_CONSOLE_SESSION\`) ...`.
  const webOnlyRow = lines.find((line) => line.startsWith('| `NOT_PERMITTED` | 403 |') && line.includes('`WEB_CONSOLE_SESSION`'));
  const webConsoleOnlyReason = firstCode(cellsOf(webOnlyRow ?? unreadable('the row of NOT_PERMITTED for a device-bound session (C3 §4)'))[2], 'the reason of the condition WEB_CONSOLE_SESSION (C3 §4)');
  return { operations: applyContractChanges(lines, operations), webConsoleOnlyReason, ...readNewPermissions(lines) };
}

/**
 * C3 §3.1 ("Changes made by R-9..R-11", erratum PE-121-07): a row of that table whose "After" cell
 * names the condition `WEB_CONSOLE_SESSION` adds it to an operation an earlier table of C3 already
 * holds. Today that is operation 89 (erratum PE-121-05: "web console only"), whose row of §2.2 was
 * written before the condition existed. The table is read; no operation is named here.
 */
function applyContractChanges(lines: readonly string[], operations: readonly SpecOperation[]): SpecOperation[] {
  const webOnly = new Set<string>();
  for (const { text } of sectionOf(lines, '### 3.1 ')) {
    const row = /^\| (\d+) \| `([A-Za-z]+)` \|/.exec(text);
    if (row === null) continue;
    if (/`WEB_CONSOLE_SESSION`/.test(cellsOf(text)[3] ?? '')) webOnly.add(row[2] ?? '');
  }
  if (webOnly.size === 0) unreadable('the row of C3 §3.1 that makes an operation web console only');
  for (const operationId of webOnly) {
    if (!operations.some((operation) => operation.operationId === operationId)) unreadable(`the operation ${operationId} that C3 §3.1 changes, in the identity tables of C3`);
  }
  return operations.map((operation) =>
    webOnly.has(operation.operationId) && !operation.conditions.includes(CoreApiAccessCondition.WEB_CONSOLE_SESSION)
      ? { ...operation, conditions: [...operation.conditions, CoreApiAccessCondition.WEB_CONSOLE_SESSION].sort() }
      : operation,
  );
}

/** The rows of one identity table of C3, appended to `operations`. */
function readContractTable(lines: readonly string[], heading: string, section: string, operations: SpecOperation[]): void {
  for (const { text, line } of sectionOf(lines, heading)) {
    const row = /^\| (\d+) \| `([A-Za-z]+)` \| (GET|POST) \| `([^`]+)` \|/.exec(text);
    if (row === null) continue;
    const cells = cellsOf(text);
    const accessCell = cells[6] ?? '';
    const auditCell = cells[7] ?? '';
    operations.push({
      number: Number(row[1]),
      operationId: row[2] ?? '',
      method: row[3] === 'GET' ? 'GET' : 'POST',
      path: row[4] ?? '',
      // C3 writes the marker decorated (`PERMISSION X`); the canonical document form is the bare
      // permission name, as the closed §7 table writes it and as describeCoreApiAccess answers.
      access: firstCode(accessCell, `the access marker of C3 operation ${row[1]}`).replace(/^PERMISSION +/, ''),
      // The two conditions a C3 access cell names beside its marker (§2.2 operation 81; §2.6 operations 95, 96).
      conditions: [
        ...(/`SESSION_HOLDER`/.test(accessCell) ? [CoreApiAccessCondition.SESSION_HOLDER] : []),
        ...(/`WEB_CONSOLE_SESSION`/.test(accessCell) ? [CoreApiAccessCondition.WEB_CONSOLE_SESSION] : []),
      ],
      auditSuccess: auditSuccessOf(auditCell, row[1] ?? ''),
      auditDenial: /EXPORT_DENIED/.test(auditCell) ? 'EXPORT_DENIED' : 'ACCESS_DENIED',
      denialCode: 'NOT_PERMITTED',
      section,
      line,
    });
  }
}

/**
 * The new permissions of C3 §2.1 and the roles that hold them: the two of task 3
 * (`CAPTURE_CONFIG`, `TRANSCRIPT_REVISE`) and, since task 4 row 100, `CAPTURE_COMMISSION`.
 */
function readNewPermissions(lines: readonly string[]): Pick<ApiContractDelta, 'newPermissions' | 'grants'> {
  const newPermissions: string[] = [];
  const grants: Grant[] = [];
  for (const { text } of sectionOf(lines, '### 2.1 ')) {
    if (!text.startsWith('| `')) continue;
    const cells = cellsOf(text);
    if (!/\(new/.test(cells[0] ?? '')) continue; // existing permissions restate their holders; not a grant to add
    const permission = firstCode(cells[0], 'a new permission of C3 §2.1');
    if (!newPermissions.includes(permission)) newPermissions.push(permission);
    for (const role of (cells[1] ?? '').split(',').map((name) => name.trim())) {
      if (role.length === 0) continue;
      if (!grants.some((grant) => grant.role === role && grant.permission === permission)) grants.push({ role, permission });
    }
  }
  if (newPermissions.length !== 3) unreadable(`the new permissions of C3 §2.1 (read ${newPermissions.join(', ')})`);
  return { newPermissions, grants };
}

/** Reads the specification. Every member comes from a table or a rule of the document. */
export function readSpecification(): Specification {
  const text = readFileSync(SPECIFICATION_FILE, 'utf8');
  const lines = text.split('\n');
  const one = (pattern: RegExp, what: string): RegExpExecArray => pattern.exec(text) ?? unreadable(what);

  const base = readOperations(lines);
  const delta = readApiContract();
  // R1 (D44): the closed task-2 §7 table is the base; C3 §2.2 composes operations 76 to 89 onto it,
  // and C3 §2.5 the STT configuration operations 90 to 92 (task 3 row 113).
  const operations = [...base, ...delta.operations].sort((a, b) => a.number - b.number);
  const known = new Set(operations.map((operation) => operation.operationId));
  const retiredRow = lines.find((line) => line.startsWith('| Credential of a REVOKED device |')) ?? unreadable('the row of a REVOKED device (section 6.6)');
  const retiredDeviceMayCall = [...(cellsOf(retiredRow)[1] ?? '').matchAll(/`(\w+)`/g)].map((found) => found[1] ?? '').filter((name) => known.has(name));
  const exportRule = one(/\| RB-5 \| For the three export operations \(([\d, ]+)\)/, 'RB-5 (section 4.6)');
  const deviceKey = one(/\| `device:<device ID>` \| A DEVICE principal \| Operations ([\d, and]+) \(/, 'the key table of the throttle (section 5.1)');
  const strict = one(/\| Key \| Who \| Counted at (\d+) per (\d+) s \|/, 'the header of the key table of the throttle (section 5.1)');
  const budget = one(/\| ID-P13 \| Denial budget \| Per throttle key at most \*\*(\d+) audited refusals within (\d+) s\*\*/, 'ID-P13 (section 5.1)');
  const denied = one(/the matrix gives the INVESTIGATOR (\d+) denied cells and the TECHNICIAN (\d+)/, 'AC-B-16 (section 16.3)');
  const ownCredential = one(
    /\| 403 \| `DEVICE_NOT_PAIRED` \|[^\n]*needs the device's own credential[^\n]*\(`details\.reason: (\w+)`\)/,
    'the reason of "needs the device\'s own credential" in the line of DEVICE_NOT_PAIRED (section 7.2)',
  );
  if (strict[2] !== budget[2]) unreadable('one window for the throttle and the denial budget');

  const roleMatrix = readRoleMatrix(lines);
  const permissions = [...roleMatrix.permissions, ...delta.newPermissions];
  const grants = [...roleMatrix.grants, ...delta.grants];
  const statedGrantCounts = Object.fromEntries(roleMatrix.roles.map((role) => [role, grants.filter((grant) => grant.role === role).length]));
  // C3 §2.1/§2.2 also grow the enforcement map: every composed row's marker names its permission
  // at its number (SESSION_START gains operation 81, EVIDENCE_VIEW 84/86/88, EVIDENCE_EXPORT 87).
  const enforcedAt: Record<string, number[]> = { ...readEnforcedAt(lines) };
  for (const operation of delta.operations) {
    for (const permission of markerPermissions(operation.access)) {
      (enforcedAt[permission] ??= []).push(operation.number);
    }
  }
  // A new permission no composed row names yet is enforced at no operation: it is in the map with
  // an empty list, so that the registry's side and the document's side state the same thing.
  for (const permission of delta.newPermissions) enforcedAt[permission] ??= [];
  return {
    revision: one(/^revision: (.+)$/m, 'the revision in the front matter')[1] ?? '',
    lines: lines.length,
    operations,
    roles: roleMatrix.roles,
    permissions,
    grants,
    statedGrantCounts,
    enforcedAt,
    retiredDeviceMayCall,
    exportOperations: numbersOf(exportRule[1] ?? ''),
    deviceStrictOperations: numbersOf(deviceKey[1] ?? ''),
    strictLimit: Number(strict[1]),
    denialBudget: Number(budget[1]),
    windowMs: Number(budget[2]) * 1000,
    statedDeniedCells: { INVESTIGATOR: Number(denied[1]), TECHNICIAN: Number(denied[2]) },
    deviceCredentialReason: ownCredential[1] ?? '',
    webConsoleOnlyReason: delta.webConsoleOnlyReason,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 2. Callers, and the expected answer of one cell
// ═══════════════════════════════════════════════════════════════════════════════════════════════

/** Who the specification says a caller is once stage 4 has looked at its credential (section 4.1). */
export type CallerIdentity =
  /** No credential, or one that resolves to nothing. */
  | { readonly kind: 'ANONYMOUS' }
  /** The credential of a device that is no longer PAIRED: not a principal (RB-6). */
  | { readonly kind: 'RETIRED_DEVICE'; readonly deviceId: string }
  /** A device credential of a PAIRED device, no operator. */
  | { readonly kind: 'DEVICE'; readonly deviceId: string }
  /** An operator's session: on the web console (`deviceId` null) or on a paired device. */
  | { readonly kind: 'OPERATOR'; readonly operatorId: string; readonly role: string; readonly deviceId: string | null };

/** A refusal that stands before the access rule on every operation (section 7.3, lines 3 and 4). */
export interface EarlyRefusal {
  readonly status: number;
  readonly code: string;
  /** `error.details.reason` of the answer, where the specification names one. */
  readonly reason: string | null;
}

/** What the expectation needs to know about a caller. */
export interface CallerFacts {
  readonly identity: CallerIdentity;
  /**
   * ID-1 (a): the request carries a web console `Origin` and no `Authorization` header. Read
   * only for an operation with the condition `CONSOLE_IDENTITY`.
   */
  readonly webConsole: boolean;
  /**
   * D4 OD-09 (SEC35-18; C3 §2.2): the operator who CREATED the open session, or null when none is
   * open. Read only for an operation with the condition `SESSION_HOLDER`. Optional so that the
   * scenarios of the v1 specification (which predates the condition) need not name it.
   */
  readonly sessionCreatorId?: string | null;
  /** Set for a caller the Origin guard or stage 4 refuses whatever the operation. */
  readonly early: EarlyRefusal | null;
}

/** The one audit row a refused call must have written. */
export interface ExpectedRow {
  readonly type: 'ACCESS_DENIED' | 'EXPORT_DENIED';
  readonly actorId: string | null;
  readonly deviceId: string | null;
  /** The members of `details` the row must name. */
  readonly details: Readonly<Record<string, string>>;
}

export type Expectation =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly status: number;
      readonly code: string;
      /** `error.details` of the answer must hold these members. */
      readonly details: Readonly<Record<string, string>>;
      /** Null: the refusal writes no row. */
      readonly row: ExpectedRow | null;
    };

const ALLOWED: Expectation = { allowed: true };

function refused(status: number, code: string, details: Record<string, string> = {}, row: ExpectedRow | null = null): Expectation {
  return { allowed: false, status, code, details, row };
}

/** 401: the rule needs a principal and the request has none. No row: no actor can be named (RB-6). */
const NOT_SIGNED_IN = refused(401, 'NOT_SIGNED_IN');
/** 403, no row: no console identity (ID-1), or a device-only operation called by a web session (section 7.2). */
const DEVICE_NOT_PAIRED = refused(403, 'DEVICE_NOT_PAIRED');
/** 403, no row: a demo operation while the demo flag is off, for a caller who holds the permission (DC-2). */
const DEMO_DISABLED = refused(403, 'DEMO_DISABLED');

/**
 * How a refusal for a missing permission names the permission (decision D83 DN-1): the one
 * permission of the rule, or the alternatives of the any-of in registry order joined with `_OR_`.
 */
export function denialPermissionOf(operation: CoreApiRegistryOperation): string {
  return coreApiAccessPermissions(operation.access).join('_OR_');
}

/** The registry's own example codes of an operation's 403 answers. */
export function exampleCodesOf(operationId: string, status: number): string[] {
  const examples = CORE_API_EXAMPLES[operationId]?.responses[status] ?? {};
  return Object.values(examples)
    .map((example) => (example.value as { error?: { code?: string } } | undefined)?.error?.code)
    .filter((code): code is string => typeof code === 'string');
}

export interface ExpectationInput {
  readonly operation: CoreApiRegistryOperation;
  readonly caller: CallerFacts;
  /** The stored matrix of the database the server runs on. */
  readonly grants: readonly Grant[];
  /** The server's demo flag (DC-2). */
  readonly demoFlag: boolean;
  /** Section 6.6: the operations a retired device may still call. */
  readonly retiredDeviceMayCall: readonly string[];
  /** The code of a refusal for a missing permission on this operation (RB-4, RB-5). */
  readonly denialCode: 'NOT_PERMITTED' | 'FORBIDDEN';
  /** Section 7.2: `details.reason` of the refusal of the condition `DEVICE_CREDENTIAL`. */
  readonly deviceCredentialReason: string;
  /** C3 §4: the reason of the refusal of the condition `WEB_CONSOLE_SESSION`. */
  readonly webConsoleOnlyReason: string;
}

/**
 * The answer the specification gives one caller on one operation. In the order of section 7.3:
 * the early refusals (lines 3 and 4), no principal and a retired device (line 6), the permission,
 * the console and device conditions, then the demo flag (line 7). A condition is looked at only
 * for a caller the marker allows: a web console session on a `DEVICE` operation is refused by the
 * marker (no reason), whatever conditions the operation carries.
 */
export function expectationOf(input: ExpectationInput): Expectation {
  const { operation, caller, grants, demoFlag } = input;
  const { identity } = caller;
  const { access } = operation;

  if (caller.early !== null) {
    return refused(caller.early.status, caller.early.code, caller.early.reason === null ? {} : { reason: caller.early.reason });
  }

  // Section 6.6, RB-6: a retired device is refused with one row that names the device, on
  // everything except what it may still call; there it is an ANONYMOUS caller.
  if (identity.kind === 'RETIRED_DEVICE' && !input.retiredDeviceMayCall.includes(operation.operationId)) {
    return refused(403, 'DEVICE_REVOKED', { reason: 'DEVICE_REVOKED' }, {
      type: 'ACCESS_DENIED',
      actorId: null,
      deviceId: identity.deviceId,
      details: { operationId: operation.operationId, reason: 'DEVICE_REVOKED' },
    });
  }

  // Section 4.2: the principal the marker names.
  switch (access.kind) {
    case CoreApiAccessKind.PUBLIC:
      break;
    case CoreApiAccessKind.DEVICE:
      if (identity.kind === 'OPERATOR' && identity.deviceId === null) return DEVICE_NOT_PAIRED;
      if (identity.kind !== 'DEVICE' && identity.kind !== 'OPERATOR') return NOT_SIGNED_IN;
      break;
    case CoreApiAccessKind.AUTHENTICATED:
      if (identity.kind !== 'OPERATOR') return NOT_SIGNED_IN;
      break;
    case CoreApiAccessKind.PERMISSION:
    case CoreApiAccessKind.ANY_OF: {
      if (identity.kind !== 'OPERATOR') return NOT_SIGNED_IN;
      const needed = coreApiAccessPermissions(access);
      const holdsOne = grants.some((grant) => grant.role === identity.role && (needed as readonly string[]).includes(grant.permission));
      if (!holdsOne) {
        const permission = denialPermissionOf(operation);
        const named = { operationId: operation.operationId, permission, role: identity.role };
        return refused(403, input.denialCode, named, {
          type: operation.audit.denial,
          actorId: identity.operatorId,
          deviceId: identity.deviceId,
          details: named,
        });
      }
      break;
    }
  }

  // The conditions of the rule, for a caller the marker allows (section 7.3 line 7). Whichever
  // operation carries a condition gets its refusal: nothing here names an operation.
  for (const condition of access.conditions ?? []) {
    switch (condition) {
      case CoreApiAccessCondition.CONSOLE_IDENTITY: {
        // ID-1: a web console, or a caller that speaks for a paired device.
        const pairedDevice = identity.kind === 'DEVICE' || (identity.kind === 'OPERATOR' && identity.deviceId !== null);
        if (!caller.webConsole && !pairedDevice) return DEVICE_NOT_PAIRED;
        break;
      }
      case CoreApiAccessCondition.DEVICE_SESSION:
        if (identity.kind !== 'OPERATOR' || identity.deviceId === null) return DEVICE_NOT_PAIRED;
        break;
      case CoreApiAccessCondition.DEVICE_CREDENTIAL:
        // Section 4.2, 6.3 (T7), 7.2; decision D118: only the device itself, with its own
        // credential. The session of an operator who is signed in on the device does not hold
        // it: 403 `DEVICE_NOT_PAIRED` with the reason of section 7.2, no audit row, and so no
        // place in the denial budget. The reason is what tells this refusal from the marker's.
        if (identity.kind !== 'DEVICE') return refused(403, 'DEVICE_NOT_PAIRED', { reason: input.deviceCredentialReason });
        break;
      case CoreApiAccessCondition.DEMO_FLAG:
        if (!demoFlag) return DEMO_DISABLED;
        break;
      case CoreApiAccessCondition.SESSION_HOLDER: {
        // D4 OD-09; SEC35-18; C3 §2.2: the operator who created the open session, or a SUPERVISOR.
        // The permission of the marker has already been checked (the order of this loop); this
        // condition only adds the holder rule. Its refusal is audited NOT_PERMITTED with
        // `details.reason: SESSION_HOLDER` (C3 §5.3) — the one condition whose refusal writes.
        if (identity.kind !== 'OPERATOR') break; // the marker refused others before this loop
        const holds =
          identity.role === OperatorRole.SUPERVISOR || (caller.sessionCreatorId != null && identity.operatorId === caller.sessionCreatorId);
        if (!holds) {
          const permission = denialPermissionOf(operation);
          const named = { operationId: operation.operationId, permission, role: identity.role, reason: CoreApiAccessCondition.SESSION_HOLDER };
          return refused(403, input.denialCode, named, {
            type: operation.audit.denial,
            actorId: identity.operatorId,
            deviceId: identity.deviceId,
            details: named,
          });
        }
        break;
      }
      case CoreApiAccessCondition.WEB_CONSOLE_SESSION: {
        // C3 §0 (erratum PE-121-04), §2.6 access notes, §4; D80(3); SEC35-45 (3): the caller's operator
        // session is not bound to a paired device. A session of a tablet or a phone is refused 403
        // `NOT_PERMITTED` with `details.reason: WEB_CONSOLE_ONLY` and one ACCESS_DENIED row, before the
        // body is used. The permission of the marker was checked before this loop.
        if (identity.kind !== 'OPERATOR') break; // the marker refused others before this loop
        if (identity.deviceId !== null) {
          const permission = denialPermissionOf(operation);
          const named = { operationId: operation.operationId, permission, role: identity.role, reason: input.webConsoleOnlyReason };
          return refused(403, input.denialCode, named, {
            type: operation.audit.denial,
            actorId: identity.operatorId,
            deviceId: identity.deviceId,
            details: named,
          });
        }
        break;
      }
      default: {
        // A condition the registry gained and this file does not know: never read as "allowed".
        const unknown: never = condition;
        throw new Error(`the registry entry of ${operation.operationId} carries the condition ${String(unknown)}, for which this test has no expectation`);
      }
    }
  }
  return ALLOWED;
}

/** One line for a cell of the printed matrix and for a message: what the specification expects. */
export function describeExpectation(expectation: Expectation): string {
  if (expectation.allowed) return 'allowed';
  return `${expectation.status} ${expectation.code}${expectation.row === null ? '' : ` + 1 ${expectation.row.type}`}`;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 3. What a cell sends
// ═══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * How the request of a cell is built. Always from the registry: the path, the example value of
 * its `{id}` and the first request example of the operation.
 *
 *   READ      a GET. It changes nothing (API-2).
 *   EXAMPLE   a POST with the registry's example input: the handler runs for a permitted caller.
 *   ABSENT    a POST with the example input, the digits of the example `{id}` replaced by nines:
 *             an identifier of the same form that names nothing in the fixture, so the handler
 *             of a permitted caller answers its documented 404 and changes nothing.
 *   PROBE     a POST whose body is no JSON: a caller that stage 6 lets through is answered
 *             400 `INVALID_JSON` by stage 7 and no handler runs.
 */
export type CellMode = 'READ' | 'EXAMPLE' | 'ABSENT' | 'PROBE';

/**
 * Success rows of commands whose permitted call would take a CALLER of this matrix away, change
 * who it is, or replace the dataset: a sign-out, an unpair, a credential rotation, a revoke, a
 * disable, a role change, a scenario load or reset. A command with one of these success rows is
 * never executed with its example input by the matrix.
 */
export const DISRUPTIVE_SUCCESS_ROWS: readonly string[] = [
  'AUTH_SIGNED_OUT',
  'UNPAIRED',
  'DEVICE_CREDENTIAL_ROTATED',
  'DEVICE_REVOKED',
  'USER_DISABLED',
  'ROLE_CHANGED',
  'SCENARIO_LOADED',
];

/** The mode of an operation's cells, from its registry entry alone. */
export function cellModeOf(operation: CoreApiRegistryOperation): CellMode {
  if (operation.method === 'get') return 'READ';
  if (!DISRUPTIVE_SUCCESS_ROWS.includes(operation.audit.success)) return 'EXAMPLE';
  return operation.pathParam === undefined ? 'PROBE' : 'ABSENT';
}

/** A body that is no JSON, with the content type of one. */
export const NOT_JSON = { contentType: 'application/json', payload: '{"w47": ' } as const;

export interface CellRequest {
  readonly method: 'GET' | 'POST';
  readonly url: string;
  /** The body as an object, the text of a body that is no JSON, or nothing. */
  readonly body: Record<string, unknown> | typeof NOT_JSON.payload | undefined;
}

/** The request of an operation's cells in a mode: path, `{id}` and body from the registry. */
export function cellRequestOf(operation: CoreApiRegistryOperation, mode: CellMode): CellRequest {
  const examples = CORE_API_EXAMPLES[operation.operationId];
  let url: string = operation.path;
  if (operation.pathParam !== undefined) {
    const example = examples?.pathParams?.[operation.pathParam.name];
    if (example === undefined) throw new Error(`the registry has no example value for the path parameter of ${operation.operationId}`);
    const id = mode === 'ABSENT' ? example.replace(/\d/g, '9') : example;
    if (!operation.pathParam.pattern.test(id)) throw new Error(`${id} does not match the pattern of the path parameter of ${operation.operationId}`);
    url = url.replace(`{${operation.pathParam.name}}`, id);
  }
  if (operation.method === 'get') return { method: 'GET', url, body: undefined };
  if (mode === 'PROBE') return { method: 'POST', url, body: NOT_JSON.payload };
  const first = Object.values(examples?.request ?? {})[0];
  const body = operation.requestBody === undefined || first === undefined ? undefined : (first.value as Record<string, unknown>);
  return { method: 'POST', url, body };
}
