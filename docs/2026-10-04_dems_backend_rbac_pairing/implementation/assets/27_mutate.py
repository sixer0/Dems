"""Single-change mutations of contract C, on an isolated copy of the package (never on the tree).
Each change is applied to one source file, the contract tests and the type check are run, and the
file is restored. A change counts as detected when a test fails or the type check fails."""
import subprocess, sys, os, time
ROOT = '/Users/gsp-budi/Documents/DEMS'
PKG = ROOT + '/.cache/W27/mut/packages/shared'
TESTS = ['test/api-domain-operations.test.ts', 'test/api-state-examples.test.ts', 'test/api-registry.test.ts', 'test/api-openapi-scope.test.ts',
         'test/api-examples.test.ts', 'test/api-text-rule.test.ts', 'test/api-envelope.test.ts', 'test/api-schemas.test.ts', 'test/api-state-slices.test.ts',
         'test/api-realtime.test.ts', 'test/openapi.test.ts', 'test/schemas.test.ts', 'test/sim-api-validation.test.ts', 'test/client-core.test.ts']
M = [
 ('M01', 'a wrong path (beginPrecheck)', 'src/api/sessions.ts', "path: `${SESSION_PATH}/{id}/precheck`,", "path: `${SESSION_PATH}/{id}/prechecks`,"),
 ('M02', 'a wrong permission (addSessionNote takes SESSION_START)', 'src/api/sessions.ts', "access: SESSION_NOTE,\n    audit: { success: AuditType.NOTE_ADDED", "access: SESSION_START,\n    audit: { success: AuditType.NOTE_ADDED"),
 ('M03', 'a wrong audit rule (cancelSession writes none)', 'src/api/sessions.ts', "audit: { success: AuditType.SESSION_CANCELLED, ...DENIED },", "audit: { success: CoreApiAuditNone.PARITY, ...DENIED },"),
 ('M04', 'the any-of with a wrong permission', 'src/api/storage.ts', "access: anyOfAccess(Permission.EVIDENCE_REVIEW, Permission.MAINTENANCE),", "access: anyOfAccess(Permission.EVIDENCE_EXPORT, Permission.MAINTENANCE),"),
 ('M05', 'the audit export with ACCESS_DENIED (RB-5)', 'src/api/security-audit.ts', "const EXPORT_AUDIT = { success: AuditType.AUDIT_EXPORTED, denial: AuditType.EXPORT_DENIED } as const;", "const EXPORT_AUDIT = { success: AuditType.AUDIT_EXPORTED, denial: AuditType.ACCESS_DENIED } as const;"),
 ('M06', 'a GET that became a POST (verifyAuditChain)', 'src/api/security-audit.ts', "operationId: 'verifyAuditChain',\n    method: 'get',", "operationId: 'verifyAuditChain',\n    method: 'post',"),
 ('M07', 'a wrong success status (archiveEvidence 200)', 'src/api/evidence.ts', "204: { description: 'The item is archived.' },", "200: { description: 'The item is archived.' },"),
 ('M08', 'a missing specific refusal (testDeviceSignal without 409)', 'src/api/devices.ts', "      409: { description: 'The device accepts no test signal (COMMAND_UNSUPPORTED).', schema: 'ApiError' },\n", ""),
 ('M09', 'a wrong access rule (acknowledgeAlert for a DEVICE)', 'src/api/alerts.ts', "access: AUTHENTICATED_ACCESS,\n    audit: { success: CoreApiAuditNone.PARITY, ...DENIED },", "access: { kind: 'DEVICE' },\n    audit: { success: CoreApiAuditNone.PARITY, ...DENIED },"),
 ('M10', 'the 401 of the reads not marked Core-server-only', 'src/api/core-api.ts', "401: { ...NOT_SIGNED_IN, services: CORE_SERVER_ONLY },", "401: { ...NOT_SIGNED_IN },"),
 ('M11', 'the registry in another order (demo before sessions)', 'src/api/core-api.ts', "  ...SESSION_OPERATIONS,\n  ...EVIDENCE_OPERATIONS,", "  ...DEMO_OPERATIONS,\n  ...SESSION_OPERATIONS,\n  ...EVIDENCE_OPERATIONS,"),
 ('M12', 'the evidence export destination without its bound', 'src/api/core-api.ts', ".refine((value) => value.trim().length <= EXPORT_DESTINATION_MAX_LENGTH, {", ".refine((value) => value.trim().length <= 10_000, {"),
 ('M13', 'the marker label bound at 81', 'src/api/sessions.ts', "markerLabelMax: 80,", "markerLabelMax: 81,"),
 ('M14', 'a bounded text without its code-unit bound', 'src/api/schema-parts.ts', "    .max(max)\n    .refine((value) => value.length <= max, { error: codeUnitBoundMessage(max) });", "    .max(max);"),
 ('M15', 'a page limit up to 500', 'src/api/schema-parts.ts', "    .max(API_PAGE_LIMIT_MAX)\n    .optional()", "    .max(500)\n    .optional()"),
 ('M16', 'a page limit with a default of its own', 'src/api/schema-parts.ts', "    .max(API_PAGE_LIMIT_MAX)\n    .optional()", "    .max(API_PAGE_LIMIT_MAX)\n    .default(API_PAGE_LIMIT_DEFAULT)"),
 ('M17', 'a cursor that may hold an underscore', 'src/api/patterns.ts', "export const LIST_CURSOR_PATTERN = /^[A-Za-z0-9-]{1,128}$/;", "export const LIST_CURSOR_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;"),
 ('M18', 'AuditChainStatus without lineageTotal', 'src/api/security-audit.ts', "    lineageTotal: count().describe('How many chains were discarded in all.'),\n", ""),
 ('M19', 'a lineage of up to 50 entries', 'src/api/security-audit.ts', "export const AUDIT_CHAIN_LINEAGE_MAX = 20;", "export const AUDIT_CHAIN_LINEAGE_MAX = 50;"),
 ('M20', 'a media reference whose source and suffix need not agree', 'src/api/evidence.ts', "(ref.source === EvidenceMediaSource.DEMO_PACKAGE) === (ref.packageSuffix !== null)", "ref.source !== undefined"),
 ('M21', 'a state read that is not strict (DeviceInventory)', 'src/api/devices.ts', "export const DeviceInventorySchema = z\n  .strictObject({", "export const DeviceInventorySchema = z\n  .object({"),
 ('M22', 'retention days up to 4,000', 'src/api/storage.ts', "export const RETENTION_DAYS_RANGE = { min: 1, max: 3_650 } as const;", "export const RETENTION_DAYS_RANGE = { min: 1, max: 4_000 } as const;"),
 ('M23', 'the text rule off for slice text', 'src/api/state-slices.ts', "const text = () => apiText();", "const text = () => z.string();"),
 ('M24', 'info.version 0.1.1 in the all scope', 'src/api/openapi.ts', "export const OPENAPI_CORE_SERVER_DOCUMENT_VERSION = '0.2.0';", "export const OPENAPI_CORE_SERVER_DOCUMENT_VERSION = '0.1.1';"),
 ('M25', 'a DEVICE operation that takes the cookie', 'src/api/openapi.ts', "if (access.kind === CoreApiAccessKind.DEVICE || conditions.includes('DEVICE_SESSION')) return [bearer];", "if (conditions.includes('DEVICE_SESSION')) return [bearer];"),
 ('M26', 'the all scope with the simulator text of the ten', 'src/api/openapi.ts', "description: all ? (operation.coreServerDescription ?? operation.description) : operation.description,", "description: operation.description,"),
 ('M27', 'the offline document with the Core-server-only statuses', 'src/api/openapi.ts', "  for (const status of listCoreApiResponseStatuses(operation, scope)) {\n    const spec", "  for (const status of listCoreApiResponseStatuses(operation)) {\n    const spec"),
 ('M28', 'the committed scope back to offline', 'scripts/gen-openapi.ts', "export const OPENAPI_COMMITTED_SCOPE: CoreApiScope = CoreApiScope.ALL;", "export const OPENAPI_COMMITTED_SCOPE: CoreApiScope = CoreApiScope.OFFLINE;"),
 ('M29', 'an example slice that differs from the simulator', 'src/api/state-examples.ts', "satellites: 11", "satellites: 12"),
 ('M30', 'an action marked server-native that is hosted', 'src/api/sim-actions.ts', "cancel: hosted('cancelSession'),", "cancel: serverNative('cancelSession'),"),
 ('M31', 'SIMULATED badges in the all scope', 'src/api/openapi.ts', "const main = scope === CoreApiScope.ALL || operation.mode === CoreApiMode.LIVE ? API_BADGES.LIVE : API_BADGES.SIMULATED;", "const main = operation.mode === CoreApiMode.LIVE ? API_BADGES.LIVE : API_BADGES.SIMULATED;"),
 ('M32', 'one security scheme only', 'src/api/openapi.ts', "          [OpenApiSecurityScheme.BEARER]: { ...SECURITY_SCHEMES[OpenApiSecurityScheme.BEARER] },\n", ""),
 ('M33', 'the Core server not the first server', 'src/api/openapi.ts', "servers: ALL_SERVERS.map((server) => ({ ...server })),", "servers: [...ALL_SERVERS].reverse().map((server) => ({ ...server })),"),
 ('M34', 'a 404 for an unknown session on the summary acknowledgement', 'src/api/sessions.ts', "      204: { description: 'The summary of that session is acknowledged, or nothing changed.' },\n      401: NOT_SIGNED_IN,", "      204: { description: 'The summary of that session is acknowledged, or nothing changed.' },\n      404: NOT_OPEN_SESSION,\n      401: NOT_SIGNED_IN,"),
 ('M35', 'an export reason of 4 characters', 'src/api/security-audit.ts', "reason: boundedText(AUDIT_EXPORT_LIMITS.reasonMax, AUDIT_EXPORT_LIMITS.reasonMin)", "reason: boundedText(AUDIT_EXPORT_LIMITS.reasonMax, 4)"),
 ('M36', 'a credential-shaped example', 'src/api/sessions.ts', "nextCursor: '1790819100000-SES-20261001-0022'", "nextCursor: '123456'"),
 ('M37', 'the evidence export reason without its upper bound', 'src/api/core-api.ts', ".refine((value) => value.length <= EXPORT_REASON_MAX_LENGTH, {", ".refine((value) => value.length <= 100_000, {"),
 ('M38', 'an audit export whose body is optional', 'src/api/security-audit.ts', "source: backendSource(SECTION, 61),\n    requestBody: { schema: 'AuditExportRequest', required: true },", "source: backendSource(SECTION, 61),\n    requestBody: { schema: 'AuditExportRequest', required: false },"),
]
def run(cmd):
    return subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
def tests():
    r = run([ROOT + '/node_modules/.bin/vitest', 'run', '--root', PKG, '--maxWorkers=2'] + TESTS)
    failed = [l.strip() for l in r.stdout.splitlines() if l.strip().startswith('FAIL') or ' × ' in l]
    return r.returncode, failed
def gen():
    return run(['node', '--import', 'tsx', PKG + '/scripts/gen-openapi.ts'])
def tsc():
    r = run([ROOT + '/node_modules/.bin/tsc', '--noEmit', '-p', PKG + '/tsconfig.json'])
    return r.returncode, [l for l in r.stdout.splitlines() if 'error TS' in l]
REGEN = '--regen' in sys.argv
only = set(a for a in sys.argv[1:] if not a.startswith('--'))
out = []
rc, failed = tests()
print('baseline tests exit', rc, flush=True)
assert rc == 0, failed
detected = 0; total = 0
for mid, what, rel, old, new in M:
    if only and mid not in only: continue
    total += 1
    path = PKG + '/' + rel
    src = open(path, encoding='utf-8').read()
    if src.count(old) != 1:
        print(mid, 'NOT APPLIED: the text occurs', src.count(old), 'times', flush=True); continue
    open(path, 'w', encoding='utf-8').write(src.replace(old, new))
    json_path = PKG + '/openapi/openapi.json'
    json_before = open(json_path, encoding='utf-8').read()
    try:
        if REGEN:
            g = gen()
            if g.returncode != 0:
                print(f"{mid} DETECTED by the generator: {what} [{rel}]", flush=True); detected += 1; continue
        rc, failed = tests()
        by = 'tests' if rc != 0 else None
        errors = []
        if rc == 0:
            trc, errors = tsc()
            if trc != 0: by = 'type check'
        line = f"{mid} {'DETECTED' if by else 'MISSED  '} by {by or '-'}: {what} [{rel}]"
        if by == 'tests': line += f"\n      {len(failed)} failing line(s); first: {failed[0][:170] if failed else ''}"
        if by == 'type check': line += f"\n      {errors[0][:200] if errors else ''}"
        print(line, flush=True)
        if by: detected += 1
    finally:
        open(path, 'w', encoding='utf-8').write(src)
        open(json_path, 'w', encoding='utf-8').write(json_before)
print(f'{detected} of {total} detected', flush=True)
