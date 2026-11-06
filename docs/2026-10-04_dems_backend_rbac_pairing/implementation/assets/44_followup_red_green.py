"""W44 follow-up after the fix round (decision D84): does each new test FAIL on the code before the follow-up?

The tests of the fix round are run twice:
  BEFORE: on a copy of packages/shared under .cache/w44/before-followup/shared whose src/live/source
          and src/realtime/live-socket-client.ts are the files as they were before the follow-up
          (the pre-images under .cache/rollback/W44-followup), with today's tests;
  AFTER:  on the tree.
A test that is red BEFORE and green AFTER is the evidence of its fix. Nothing in the tree is changed.

Run from /Users/gsp-budi/Documents/DEMS:
  python3 docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/44_followup_red_green.py
"""
import pathlib, re, shutil, subprocess

ROOT = pathlib.Path('/Users/gsp-budi/Documents/DEMS')
PRE = ROOT / '.cache/rollback/W44-followup'
MUT = ROOT / '.cache/w44/mut/shared'
COPY = ROOT / '.cache/w44/before-followup/shared'
TESTS = ['resilience', 'local-end', 'misuse', 'atomicity', 'bindings', 'session', 'react', 'platform-neutral']
FILES = [f'test/live-source-{name}.test.ts' for name in TESTS]

COPY.mkdir(parents=True, exist_ok=True)
for name in ['package.json', 'tsconfig.json', 'vitest.config.ts']:
    shutil.copy(MUT / name, COPY / name)
if not (COPY / 'node_modules').exists():
    (COPY / 'node_modules').symlink_to((MUT / 'node_modules').resolve(), target_is_directory=True)
for folder in ['src', 'test']:
    if (COPY / folder).exists():
        shutil.rmtree(COPY / folder)
shutil.copytree(ROOT / 'packages/shared/src', COPY / 'src')
# The code before the round.
shutil.rmtree(COPY / 'src/live/source')
shutil.copytree(PRE / 'source', COPY / 'src/live/source')
shutil.copy(PRE / 'live-socket-client.ts.pre', COPY / 'src/realtime/live-socket-client.ts')
(COPY / 'test').mkdir()
for file in FILES:
    shutil.copy(ROOT / 'packages/shared' / file, COPY / file)


def run(root):
    out = subprocess.run(['npx', 'vitest', 'run', '--root', str(root), *FILES, '--maxWorkers=2', '--reporter=verbose'], cwd=ROOT, capture_output=True, text=True)
    text = re.sub(r'\x1b\[[0-9;]*m', '', out.stdout + out.stderr)
    results = {}
    for mark, name in re.findall(r'^\s*([✓×✗])\s+(test/live-source-.*?)(?:\s+\d+\s?ms)?$', text, re.M):
        results[name.strip()] = 'green' if mark == '✓' else 'RED'
    summary = re.search(r'^\s*Tests\s+(.*)$', text, re.M)
    return out.returncode, (summary.group(1).strip() if summary else 'no summary'), results


before_code, before_summary, before = run(COPY)
after_code, after_summary, after = run(ROOT / 'packages/shared')
print(f'BEFORE (the code before the follow-up, today\'s tests): exit {before_code} | {before_summary}')
print(f'AFTER  (the tree):                                     exit {after_code} | {after_summary}')
print()
red = [name for name in after if before.get(name) == 'RED']
print(f'## Red before, green after: {len([n for n in red if after[n] == "green"])}')
for name in red:
    print(f'{before[name]:5} -> {after[name]:5} | {name}')
print()
still = [name for name in after if after[name] != 'green']
print(f'## Not green after: {len(still)}')
for name in still:
    print(f'      {name}')
print()
both = [name for name in after if before.get(name) == 'green' and after[name] == 'green']
print(f'## Green before and after (tests that existed, and tests that only guard the new code): {len(both)}')
missing = [name for name in after if name not in before]
print(f'## In the AFTER run only (no result BEFORE): {len(missing)}')
for name in missing:
    print(f'      {name}')
