"""W44 fix round, finding CPC1-14: is `asSim` checked by the compiler?

A member is added to the simulator's `Sim` interface in two COPIES of packages/shared/src (never
in the tree): one with src/live/source as it was before the round, one as it is now. The member is
optional, so the simulator itself still compiles. Before the round nothing noticed that the Live
source lacks the member (a blind double cast); after it the compiler refuses `asSim`.

Run from /Users/gsp-budi/Documents/DEMS:
  python3 docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/44_fix_assim_probe.py
"""
import pathlib, re, shutil, subprocess

ROOT = pathlib.Path('/Users/gsp-budi/Documents/DEMS')
PRE = ROOT / '.cache/rollback/W44-fix'
BASE = ROOT / '.cache/w44/assim'
MEMBER = "export interface Sim {\n"
ADDED = "export interface Sim {\n  /** Added by the probe: a member the Live source does not have. */\n  readonly probeMember?: number;\n"


def build(name, before):
    copy = BASE / name
    if copy.exists():
        shutil.rmtree(copy)
    copy.mkdir(parents=True)
    shutil.copytree(ROOT / 'packages/shared/src', copy / 'src')
    if before:
        shutil.rmtree(copy / 'src/live/source')
        shutil.copytree(PRE / 'source', copy / 'src/live/source')
        shutil.copy(PRE / 'live/hooks.ts', copy / 'src/live/hooks.ts')
    (copy / 'node_modules').symlink_to(ROOT / 'packages/shared/node_modules', target_is_directory=True)
    (copy / 'tsconfig.json').write_text('{\n  "extends": "%s",\n  "compilerOptions": { "jsx": "react-jsx", "types": ["node"], "noEmit": true },\n  "include": ["src"]\n}\n' % (ROOT / 'tsconfig.base.json'))
    return copy


def tsc(copy):
    out = subprocess.run(['npx', 'tsc', '-p', str(copy / 'tsconfig.json')], cwd=ROOT, capture_output=True, text=True)
    lines = [line for line in (out.stdout + out.stderr).splitlines() if 'error TS' in line]
    return out.returncode, [re.sub(r'^.*?/(src/)', r'\1', line)[:230] for line in lines]


for name, before in [('before', True), ('after', False)]:
    copy = build(name, before)
    code, errors = tsc(copy)
    print(f'{name:6} | Sim as it is              | tsc exit {code} | {len(errors)} errors')
    engine = copy / 'src/sim/engine.ts'
    text = engine.read_text()
    assert text.count(MEMBER) == 1
    engine.write_text(text.replace(MEMBER, ADDED))
    code, errors = tsc(copy)
    print(f'{name:6} | Sim with one member more  | tsc exit {code} | {len(errors)} errors')
    for line in errors:
        print(f'         {line}')
