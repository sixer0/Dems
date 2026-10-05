#!/usr/bin/env python3
"""Mutation check of row SIM-GAP-1 (implementation/22b_sim_text_cut_fix.md).

Each mutation changes ONE expression of the fix, runs packages/shared/test/sim-text-cut.test.ts and
expects it to FAIL; the file is restored (and its hash checked) after every mutation. The site
mutations put back the expression the fix replaced, so while one is applied the simulator behaves
as it did at acaff20. Run from the repository root: python3 <this file>
"""
import hashlib
import subprocess
import sys

ROOT = '/Users/gsp-budi/Documents/DEMS'
HELPER = f'{ROOT}/packages/shared/src/sim/text-cut.ts'
MACHINE = f'{ROOT}/packages/shared/src/sim/session-machine.ts'
ACTIONS = f'{ROOT}/packages/shared/src/sim/evidence-actions.ts'

GUARD = 'const splitsPair = limit > 0 && isLowSurrogate(text.charCodeAt(limit)) && isHighSurrogate(text.charCodeAt(limit - 1));'
CUT = 'return text.slice(0, splitsPair ? limit - 1 : limit);'

MUTATIONS = [
    ('M01 helper: no step back (the plain slice)', HELPER, CUT, 'return text.slice(0, limit);', 1),
    ('M02 helper: steps back at any low surrogate (repairs a lone low)', HELPER, GUARD,
     'const splitsPair = limit > 0 && isLowSurrogate(text.charCodeAt(limit));', 1),
    ('M03 helper: steps back after any high surrogate (repairs a lone high)', HELPER, GUARD,
     'const splitsPair = limit > 0 && isHighSurrogate(text.charCodeAt(limit - 1));', 1),
    ('M04 helper: steps back two units', HELPER, CUT, 'return text.slice(0, splitsPair ? limit - 2 : limit);', 1),
    ('M05 helper: looks one unit too early', HELPER, GUARD,
     'const splitsPair = limit > 1 && isLowSurrogate(text.charCodeAt(limit - 1)) && isHighSurrogate(text.charCodeAt(limit - 2));', 1),
    # EQUIVALENT: with text.length == limit the next lines read a unit past the end (NaN, not a
    # surrogate) and slice(0, limit) is the whole text. The early return is a fast path only.
    ('M06 helper: the early return misses a text exactly as long as the limit (EQUIVALENT)', HELPER,
     'if (text.length <= limit) return text;', 'if (text.length < limit) return text;', 1),
    ('M07 helper: a non-positive limit cuts nothing', HELPER, 'const limit = maxCodeUnits > 0 ? Math.floor(maxCodeUnits) : 0;',
     'const limit = maxCodeUnits > 0 ? Math.floor(maxCodeUnits) : text.length;', 1),
    ('M08 site: marker label back to slice(0, 80)', MACHINE, 'cutText(label.trim(), 80)', 'label.trim().slice(0, 80)', 1),
    ('M09 site: note line back to slice(0, 139)', MACHINE, 'cutText(body, 139)', 'body.slice(0, 139)', 1),
    ('M10 site: evidence export destination back to slice(0, 120)', ACTIONS,
     "? cutText(request.destination.trim(), 120) // code units; never splits a surrogate pair (SIM-GAP-1)\n      : DEFAULT_EXPORT_DESTINATION;",
     "? request.destination.trim().slice(0, 120)\n      : DEFAULT_EXPORT_DESTINATION;", 1),
    ('M11 site: audit and log export destination back to slice(0, 120)', ACTIONS,
     "? cutText(request.destination.trim(), 120) // code units; never splits a surrogate pair (SIM-GAP-1)\n        : DEFAULT_AUDIT_EXPORT_DESTINATION;",
     "? request.destination.trim().slice(0, 120)\n        : DEFAULT_AUDIT_EXPORT_DESTINATION;", 1),
    ('M12 site: marker limit 80 -> 81 (a limit moved)', MACHINE, 'cutText(label.trim(), 80)', 'cutText(label.trim(), 81)', 1),
    ('M13 site: note limit 139 -> 138 (a limit moved)', MACHINE, 'cutText(body, 139)', 'cutText(body, 138)', 1),
    ('M14 site: destination limit 120 -> 119 at both sites (a limit moved)', ACTIONS,
     'cutText(request.destination.trim(), 120)', 'cutText(request.destination.trim(), 119)', 2),
]


def digest(path: str) -> str:
    with open(path, 'rb') as handle:
        return hashlib.sha256(handle.read()).hexdigest()


def run_tests() -> tuple[int, str]:
    result = subprocess.run(
        ['npx', 'vitest', 'run', '--root', 'packages/shared', 'test/sim-text-cut.test.ts', '--maxWorkers=2'],
        cwd=ROOT, capture_output=True, text=True, check=False,
    )
    lines = [line for line in (result.stdout + result.stderr).splitlines() if 'Tests ' in line or 'Test Files ' in line]
    return result.returncode, ' | '.join(line.strip() for line in lines)


def main() -> int:
    code, summary = run_tests()
    print(f'unmutated: exit {code} | {summary}')
    if code != 0:
        print('the unmutated run must pass')
        return 1
    survived = 0
    for name, path, old, new, count in MUTATIONS:
        with open(path, encoding='utf-8') as handle:
            original = handle.read()
        before = digest(path)
        if original.count(old) != count:
            print(f'{name}: SETUP ERROR, expected {count} occurrence(s), found {original.count(old)}')
            return 1
        try:
            with open(path, 'w', encoding='utf-8') as handle:
                handle.write(original.replace(old, new))
            code, summary = run_tests()
        finally:
            with open(path, 'w', encoding='utf-8') as handle:
                handle.write(original)
        restored = digest(path) == before
        killed = code != 0
        equivalent = '(EQUIVALENT)' in name
        if equivalent and killed:
            print(f'{name}: an equivalent mutation must not change any result')
            return 1
        survived += 0 if killed or equivalent else 1
        verdict = 'KILLED' if killed else 'NO CHANGE, as expected' if equivalent else 'SURVIVED'
        print(f'{name}: {verdict} (exit {code}) | {summary} | restored: {restored}')
        if not restored:
            return 1
    code, summary = run_tests()
    print(f'after restore: exit {code} | {summary}')
    equivalents = sum(1 for mutation in MUTATIONS if '(EQUIVALENT)' in mutation[0])
    real = len(MUTATIONS) - equivalents
    print(f'{real - survived} of {real} behaviour-changing mutations killed; {survived} survived; {equivalents} equivalent mutation(s) changed nothing')
    return 0 if survived == 0 and code == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
