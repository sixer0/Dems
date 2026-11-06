#!/usr/bin/env python3
"""Mutation checks of the follow-up D113 (W27): a condition for operation 23.

Every mutation is applied to a COPY of the changed shared package (never to the tree), the
registry and document tests are run on that copy, and the mutation counts as detected when
the named check fails. Usage: python3 mutate.py  (run from the repository root).
"""
import pathlib, subprocess, sys

ROOT = pathlib.Path('/Users/gsp-budi/Documents/DEMS')
W = ROOT / '.cache/W27c'
WORK = W / 'verify1/packages/shared'  # a fresh copy of the tree with the delivered patch applied
MUT = W / 'mut/packages/shared'
TESTS = ['test/api-registry.test.ts', 'test/api-openapi-scope.test.ts', 'test/api-examples.test.ts', 'test/openapi.test.ts']

def sh(cmd):
    done = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    return done.returncode, done.stdout + done.stderr

def fresh():
    (W / 'mut/packages').mkdir(parents=True, exist_ok=True)
    code, out = sh(['rsync', '-a', '--delete', '--exclude', 'node_modules', '--exclude', '.vitest', '--exclude', 'assets', f'{WORK}/', f'{MUT}/'])
    assert code == 0, out
    for name in ('node_modules', 'assets'):
        link = MUT / name
        if not link.exists():
            link.symlink_to(ROOT / 'packages/shared' / name)
    base = W / 'mut/tsconfig.base.json'
    if not base.exists():
        base.write_text((ROOT / 'tsconfig.base.json').read_text())
    apps = W / 'mut/apps'
    if not apps.exists():
        apps.symlink_to(ROOT / 'apps')

def edit(rel, old, new, count=1):
    path = MUT / rel
    text = path.read_text()
    assert text.count(old) == count, (rel, old[:60], text.count(old))
    path.write_text(text.replace(old, new))

def regen():
    code, out = sh(['node', '--import', 'tsx', str(MUT / 'scripts/gen-openapi.ts')])
    assert code == 0, out

def tests():
    code, out = sh([str(ROOT / 'node_modules/.bin/vitest'), 'run', '--root', str(MUT), '--maxWorkers=2', *TESTS])
    failed = sorted({line.split(' > ')[0].replace(' FAIL ', '').strip() for line in out.splitlines() if line.startswith(' FAIL ')})
    count = sum(1 for line in out.splitlines() if line.startswith(' FAIL '))
    return code, f'{count} failing test(s) in {", ".join(failed) if failed else "no file"}'

def typecheck():
    code, out = sh([str(ROOT / 'node_modules/.bin/tsc'), '--noEmit', '-p', str(MUT / 'tsconfig.json')])
    errors = [line for line in out.splitlines() if 'error TS' in line]
    return code, f'{len(errors)} type error(s)' + (f': {errors[0][:150]}' if errors else '')

def check_document():
    code, out = sh(['node', '--import', 'tsx', str(MUT / 'scripts/gen-openapi.ts'), '--check'])
    return code, out.strip().splitlines()[-1][:160] if out.strip() else ''

OP23_ACCESS = "access: { ...DEVICE_ACCESS, conditions: [CoreApiAccessCondition.DEVICE_CREDENTIAL] },"
REASON = "export const DEVICE_CREDENTIAL_REQUIRED_REASON = 'DEVICE_CREDENTIAL_REQUIRED';"

def m1():
    edit('src/api/pairing.ts', OP23_ACCESS, 'access: DEVICE_ACCESS,'); regen()
def m2():
    edit('src/api/pairing.ts', OP23_ACCESS, 'access: DEVICE_ACCESS,')
def m3():
    edit('src/api/pairing.ts', "    access: DEVICE_ACCESS,\n    audit: { success: AuditType.UNPAIRED,", "    access: { ...DEVICE_ACCESS, conditions: [CoreApiAccessCondition.DEVICE_CREDENTIAL] },\n    audit: { success: AuditType.UNPAIRED,"); regen()
def m4():
    edit('src/api/identity.ts', "    access: DEVICE_ACCESS,\n    audit: { success: AuditType.AUTH_SUCCESS,", "    access: { ...DEVICE_ACCESS, conditions: [CoreApiAccessCondition.DEVICE_CREDENTIAL] },\n    audit: { success: AuditType.AUTH_SUCCESS,"); regen()
def m5():
    edit('src/api/identity.ts', "access: { ...AUTHENTICATED_ACCESS, conditions: [CoreApiAccessCondition.DEVICE_SESSION] },", "access: { ...AUTHENTICATED_ACCESS, conditions: [CoreApiAccessCondition.DEVICE_CREDENTIAL] },"); regen()
def m6():
    edit('src/api/contract-model.ts', "  DEVICE_CREDENTIAL: 'DEVICE_CREDENTIAL',\n", '')
def m7():
    edit('src/api/contract-model.ts', "  DEVICE_CREDENTIAL: 'DEVICE_CREDENTIAL',", "  DEVICE_CREDENTIAL: 'DEVICE_OWN_CREDENTIAL',"); regen()
def m8():
    edit('src/api/contract-model.ts', REASON, "export const DEVICE_CREDENTIAL_REQUIRED_REASON = 'CREDENTIAL_REQUIRED';"); regen()
def m9():
    edit('src/api/example-parts.ts', "value: apiErrorExample('DEVICE_NOT_PAIRED', \"This operation needs the device's own credential.\", {", "value: apiErrorExample('NOT_PERMITTED', \"This operation needs the device's own credential.\", {"); regen()
def m10():
    edit('src/api/pairing.ts', "      403: { deviceCredentialRequired: ERROR_EXAMPLES.deviceCredentialRequired, ...BASIC_403 },", "      403: BASIC_403,"); regen()
def m11():
    edit('src/api/example-parts.ts', "      reason: DEVICE_CREDENTIAL_REQUIRED_REASON,\n", ''); regen()
def m12():
    path = MUT / 'src/api/pairing.ts'
    text = path.read_text()
    start = text.index("      403: forbidden(\n        `the request presented the session token")
    end = text.index("      ),\n", start) + len("      ),\n")
    path.write_text(text[:start] + "      403: forbidden(),\n" + text[end:]); regen()
def m13():
    path = MUT / 'src/api/pairing.ts'
    text = path.read_text()
    start = text.index("      `The request must present the device credential itself.")
    end = text.index("\n", start) + 1
    path.write_text(text[:start] + text[end:]); regen()
def m14():
    # The registry changes and the committed document is NOT regenerated.
    edit('src/api/pairing.ts', "a session ends by itself, and it must not be able", "a session ends, and it must not be able")
def m15():
    edit('src/api/pairing.ts', "      403: { deviceCredentialRequired: ERROR_EXAMPLES.deviceCredentialRequired, ...BASIC_403 },", "      403: { ...BASIC_403, deviceCredentialRequired: ERROR_EXAMPLES.deviceCredentialRequired },"); regen()

MUTATIONS = [
    ('F1', 'operation 23 loses the condition (document regenerated)', m1, tests),
    ('F2', 'operation 23 loses the condition and the committed document is left as it was', m2, check_document),
    ('F3', 'unpairDevice (22) carries the condition too', m3, tests),
    ('F4', 'signInWithBiometric (8) carries the condition too', m4, tests),
    ('F5', 'the condition stands on an AUTHENTICATED operation (7) in place of DEVICE_SESSION', m5, tests),
    ('F6', 'the vocabulary loses DEVICE_CREDENTIAL', m6, typecheck),
    ('F7', 'the value of the condition is renamed', m7, tests),
    ('F8', 'the reason of the refusal is renamed', m8, tests),
    ('F9', 'the example of the refusal carries another error code', m9, tests),
    ('F10', 'operation 23 has no example of the refusal', m10, tests),
    ('F11', 'the example of the refusal carries no details.reason', m11, tests),
    ('F12', 'the 403 text of operation 23 does not name the refusal', m12, tests),
    ('F13', 'the description of operation 23 does not name the refusal', m13, tests),
    ('F14', 'a text of operation 23 changes and the committed document is not regenerated', m14, check_document),
    ('F15', 'the example of the refusal is not the first of its status', m15, tests),
]

def main():
    wanted = set(sys.argv[1:])
    missed = 0
    for ident, what, mutate, check in MUTATIONS:
        if wanted and ident not in wanted:
            continue
        fresh()
        mutate()
        code, note = check()
        detected = code != 0
        missed += 0 if detected else 1
        print(f'{ident} | {what} | {check.__name__} | {"DETECTED" if detected else "NOT DETECTED"} | {note}', flush=True)
    fresh()
    code, note = tests()
    print(f'control | the copy without a mutation | tests | {"green" if code == 0 else "RED"} | {note}', flush=True)
    code, note = check_document()
    print(f'control | the copy without a mutation | check_document | {"exit 0" if code == 0 else "NOT 0"} | {note}', flush=True)
    print(f'{len(MUTATIONS) if not wanted else len(wanted)} mutation(s), {missed} not detected')
    return 1 if missed else 0

if __name__ == '__main__':
    sys.exit(main())
