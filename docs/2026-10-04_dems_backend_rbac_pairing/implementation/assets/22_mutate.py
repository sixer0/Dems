#!/usr/bin/env python3
"""Single-change mutation run for plan row W22 (contract B).

Works on an isolated copy of packages/shared under .cache/W22/mut, never on the tree: each change is
made to one source file of the copy, the type check and the contract tests run there, and the file
is copied back from the tree. A change is detected when the type check or a test fails.
"""
import shutil
import subprocess
import sys

ROOT = '/Users/gsp-budi/Documents/DEMS'
REAL = f'{ROOT}/packages/shared'
COPY = f'{ROOT}/.cache/W22/mut/packages/shared'
API = 'src/api'

SLICES = f'{API}/state-slices.ts'
RT = f'{API}/realtime-messages.ts'
EX = f'{API}/realtime-examples.ts'
OA = f'{API}/openapi.ts'
CONST = f'{API}/constants.ts'

MUTATIONS = [
    ('M01 the operator of the slice is not strict', SLICES, 'OperatorSchema.strict().describe(', 'OperatorSchema.describe('),
    ('M02 the snapshot state is not strict', SLICES, '''export const ReplicatedStateSchema = z
  .strictObject(REPLICATED_SLICE_SCHEMAS)''', '''export const ReplicatedStateSchema = z
  .object(REPLICATED_SLICE_SCHEMAS)'''),
    ('M03 a slice is missing from the replicated set', SLICES, '''  update: UpdateSliceSchema,
  settings: SettingsSliceSchema,
} as const;
export type ReplicatedSliceName''', '''  update: UpdateSliceSchema,
} as const;
export type ReplicatedSliceName'''),
    ('M04 a time is any number', SLICES, '''    state: z.enum(TabletLinkState),
    changedAt: epochMs(),''', '''    state: z.enum(TabletLinkState),
    changedAt: z.number(),'''),
    ('M05 an event row is not strict', SLICES, '''export const SimEventSchema = z
  .strictObject({''', '''export const SimEventSchema = z
  .object({'''),
    ('M06 free text of a slice refuses ill-formed text', SLICES, 'const text = () => z.string();', "const text = () => z.string().refine((value) => !/[\\ud800-\\udfff\\u0000]/.test(value));"),
    ('M07 a hash is any string', SLICES, 'const sha256 = () => z.string().regex(SHA256_HEX_PATTERN);', 'const sha256 = () => z.string();'),
    ('M08 a member with the wrong type', SLICES, '    fanOk: z.boolean(),', '    fanOk: z.string(),'),
    ('M09 an optional member made required', SLICES, "simulatedFillBytes: count().optional()", "simulatedFillBytes: count()"),
    ('M10 an optional member forgotten', SLICES, '    tamperedTrackId: z.enum(TrackId).nullable().optional(),\n', ''),
    ('M11 an audio level without bounds', SLICES, "dbfs: z.number().min(-90).max(0).describe('Ballistic level", "dbfs: z.number().describe('Ballistic level"),
    ('M12 an open map takes nested values', SLICES, 'const details = () => z.record(text(), z.union([text(), z.number(), z.boolean(), z.null()]));', 'const details = () => z.record(text(), z.unknown());'),
    ('M13 pairing classified as replicated', SLICES, '  pairing: StateSliceDelivery.CLIENT,', '  pairing: StateSliceDelivery.REPLICATED,'),
    ('M14 the session input is not strict', SLICES, '''    input: z
      .strictObject({''', '''    input: z
      .object({'''),
    ('M15 an audit row may name any actor', SLICES, "actorId: operatorId().nullable().describe('Operator ID, or null for the system.", "actorId: text().nullable().describe('Operator ID, or null for the system."),
    ('M39 an optional member the simulator does not have', SLICES, "    notifySound: z.boolean(),\n  })", "    notifySound: z.boolean(),\n    theme: z.string().optional(),\n  })"),
    ('M40 a nested optional member forgotten', SLICES, "        params: details().optional(),\n        resolvesAt: nullableEpochMs().optional(),", "        params: details().optional(),"),
    ('M16 TOKEN_REUSE is not a reason', RT, "  USER_DISABLED: 'USER_DISABLED',\n  TOKEN_REUSE: 'TOKEN_REUSE',\n", "  USER_DISABLED: 'USER_DISABLED',\n"),
    ('M17 session.ended is not strict', RT, '''export const SessionEndedMessageSchema = z
  .strictObject({''', '''export const SessionEndedMessageSchema = z
  .object({'''),
    ('M18 device.revoked is not strict', RT, '''export const DeviceRevokedMessageSchema = z
  .strictObject({''', '''export const DeviceRevokedMessageSchema = z
  .object({'''),
    ('M19 hello without the topic rule', RT, "  .refine((message) => topicsFit(message.principal, message.topics), { error: TOPIC_RULE_MESSAGE, path: ['topics'] })\n", ''),
    ('M20 hello without the reason rule', RT, "message.reason === undefined || message.principal === RealtimePrincipal.ANONYMOUS", "true"),
    ('M21 a connection ID may hold an underscore', RT, 'REALTIME_CONNECTION_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/', 'REALTIME_CONNECTION_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/'),
    ('M22 the heartbeat time as epoch milliseconds', RT, '  serverTime: z.iso.datetime(),', '  serverTime: z.int().nonnegative(),'),
    ('M23 admin.changed is not in the union', RT, '  DeviceRevokedMessageSchema,\n  AdminChangedMessageSchema,\n]);', '  DeviceRevokedMessageSchema,\n]);'),
    ('M24 a client may subscribe to any topic', RT, 'const meterTopic = () => z.literal(RealtimeTopic.METERS);', 'const meterTopic = () => z.enum(RealtimeTopic);'),
    ('M25 an append without rows', RT, '    rows: z.array(SimEventSchema).min(1),', '    rows: z.array(SimEventSchema),'),
    ('M26 device.revoked not sent to a DEVICE', RT, "    principals: [RealtimePrincipal.DEVICE, RealtimePrincipal.OPERATOR],", "    principals: OPERATOR_ONLY,"),
    ('M27 a snapshot may reach an ANONYMOUS connection', RT, """    type: 'snapshot',
    topic: RealtimeTopic.STATE,
    principals: OPERATOR_ONLY,""", """    type: 'snapshot',
    topic: RealtimeTopic.STATE,
    principals: EVERY_PRINCIPAL,"""),
    ('M28 a wrong close code', RT, '  DEVICE_REVOKED: 4403,', '  DEVICE_REVOKED: 4404,'),
    ('M29 the wrong permission for the users list', RT, '  [AdminResource.USERS]: Permission.USER_ADMIN,', '  [AdminResource.USERS]: Permission.PAIRING_MANAGE,'),
    ('M30 session.updated carries the whole operator', RT, "operator: z.strictObject({ id: operatorId(), role: z.enum(OperatorRole) })", "operator: z.object({ id: operatorId(), role: z.enum(OperatorRole) })"),
    ('M31 a delta may be empty', RT, "ops: z.array(DeltaOpSchema).min(1)", "ops: z.array(DeltaOpSchema)"),
    ('M32 the audit append without its head', RT, "    head: z.string().regex(SHA256_HEX_PATTERN).describe('Hash of the newest row after the append.'),\n", ''),
    ('M33 a client message with a version member', RT, "  .strictObject({ type: z.literal('resync') })", "  .strictObject({ type: z.literal('resync'), v: z.literal(1).optional() })"),
    ('M34 the Core server text in the offline document', OA, "      if (scope === CoreApiScope.ALL) object.description =", "      object.description ="),
    ('M35 an example with a bearer-shaped connection ID', EX, "value: hello('00000000-0000-4000-8000-0000000000a4', { principal: 'ANONYMOUS', topics: ['heartbeat'] }),", "value: hello('ses_EXAMPLE_ONLY_NOT_A_REAL_CREDENTIAL000000000', { principal: 'ANONYMOUS', topics: ['heartbeat'] }),"),
    ('M36 an example whose permissions are not the role\'s', EX, "permissions: ['EVIDENCE_VIEW', 'DEVICE_MANAGE', 'DIAGNOSTICS_RUN', 'MAINTENANCE'],", "permissions: ['EVIDENCE_VIEW', 'DEVICE_MANAGE', 'DIAGNOSTICS_RUN', 'USER_ADMIN'],"),
    ('M37 resync allowed every second', CONST, 'REALTIME_RESYNC_MIN_INTERVAL_MS = 2_000', 'REALTIME_RESYNC_MIN_INTERVAL_MS = 1_000'),
    ('M38 an anonymous connection may be given the state topic', RT, "  [RealtimePrincipal.ANONYMOUS]: [RealtimeTopic.HEARTBEAT],", "  [RealtimePrincipal.ANONYMOUS]: [RealtimeTopic.HEARTBEAT, RealtimeTopic.STATE],"),
]


def run(cmd):
    result = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    return result.returncode, result.stdout + result.stderr


def check():
    tsc_code, tsc_out = run(['npx', 'tsc', '--noEmit', '-p', f'{COPY}/tsconfig.json'])
    test_code, test_out = run(['npx', 'vitest', 'run', '--root', COPY, '--maxWorkers=2'])
    failed = sorted({line.split(' > ')[0].replace('FAIL', '').strip() for line in test_out.splitlines() if line.strip().startswith('FAIL')})
    tsc_errors = [line for line in tsc_out.splitlines() if 'error TS' in line]
    return tsc_code, len(tsc_errors), test_code, failed


def main():
    only = set(sys.argv[1:])
    code, errors, test_code, failed = check()
    print(f'control (no change): tsc exit {code}, tests exit {test_code}')
    if code != 0 or test_code != 0:
        print('the copy is not green; stop')
        return 1
    detected = 0
    total = 0
    for name, path, find, replace in MUTATIONS:
        if only and name.split()[0] not in only:
            continue
        total += 1
        source = open(f'{REAL}/{path}').read()
        if source.count(find) != 1:
            print(f'{name}: the text to change occurs {source.count(find)} times; NOT RUN')
            continue
        open(f'{COPY}/{path}', 'w').write(source.replace(find, replace))
        try:
            code, errors, test_code, failed = check()
        finally:
            shutil.copyfile(f'{REAL}/{path}', f'{COPY}/{path}')
        caught = code != 0 or test_code != 0
        detected += 1 if caught else 0
        by = []
        if code != 0:
            by.append(f'type check ({errors} errors)')
        if test_code != 0:
            by.append('tests: ' + ', '.join(failed))
        print(f'{name}: {"DETECTED by " + "; ".join(by) if caught else "NOT DETECTED"}')
        sys.stdout.flush()
    print(f'{detected} of {total} detected')
    return 0


if __name__ == '__main__':
    sys.exit(main())
