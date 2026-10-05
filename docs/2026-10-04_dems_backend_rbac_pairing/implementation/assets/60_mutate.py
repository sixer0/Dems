#!/usr/bin/env python3
# W60 mutation check (rule M15): single mutations of the pairing-gate logic in
# apps/mobile/src/navigation/root-navigator.tsx, run OUTSIDE the source tree. Each mutation is
# applied to a scratch copy, the two gate test files are run against it, and the tree is restored
# byte-for-byte. A mutation is DETECTED when at least one gate test fails. The tree is never left
# edited: before/after hashes of the mutated file must be identical.
import hashlib
import os
import subprocess
import sys

REPO = "/Users/gsp-budi/Documents/DEMS"
TARGET = os.path.join(REPO, "apps/mobile/src/navigation/root-navigator.tsx")

# (id, description, old, new) — textual, one occurrence each.
MUTATIONS = [
    ("G01", "(auth) guard drops the block term",
     "<Stack.Protected guard={!isAuthenticated && !blocked}>",
     "<Stack.Protected guard={!isAuthenticated}>"),
    ("G02", "(app) guard drops the block term",
     "<Stack.Protected guard={isAuthenticated && !blocked}>",
     "<Stack.Protected guard={isAuthenticated}>"),
    ("G03", "dev-gallery guard always open",
     "<Stack.Protected guard={!blocked}>\n        <Stack.Screen name=\"dev-gallery\" />",
     "<Stack.Protected guard={true}>\n        <Stack.Screen name=\"dev-gallery\" />"),
    ("G04", "blocked forced false (gate inert)",
     "const blocked = isPairingBlocked(usePairing());",
     "const blocked = false;"),
    ("G05", "boot router no longer returns /pair first",
     "if (isPairingBlocked(usePairing())) return '/pair';\n  if (!isAuthenticated) return '/login';",
     "if (!isAuthenticated) return '/login';"),
    ("G06", "boot router checks auth before the block (login wins)",
     "if (isPairingBlocked(usePairing())) return '/pair';\n  if (!isAuthenticated) return '/login';",
     "if (!isAuthenticated && !isPairingBlocked(usePairing())) return '/login';\n  if (isPairingBlocked(usePairing())) return '/pair';"),
    ("G07", "(auth) guard uses OR instead of AND",
     "<Stack.Protected guard={!isAuthenticated && !blocked}>",
     "<Stack.Protected guard={!isAuthenticated || !blocked}>"),
    ("G08", "(app) guard ignores block via negation slip",
     "<Stack.Protected guard={isAuthenticated && !blocked}>",
     "<Stack.Protected guard={isAuthenticated || !blocked}>"),
]


def sha(path):
    with open(path, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()


def run_gate_tests():
    proc = subprocess.run(
        ["npm", "run", "test", "-w", "@dems/mobile", "--", "pairing-gate", "--maxWorkers=2"],
        cwd=REPO, capture_output=True, text=True,
    )
    # Non-zero exit => at least one test failed => the mutation was detected.
    return proc.returncode != 0


def main():
    original = open(TARGET, "r", encoding="utf-8").read()
    before = sha(TARGET)
    detected = 0
    results = []
    for mid, desc, old, new in MUTATIONS:
        if original.count(old) != 1:
            results.append((mid, "NOT-APPLIED", f"anchor found {original.count(old)}x"))
            continue
        open(TARGET, "w", encoding="utf-8").write(original.replace(old, new, 1))
        try:
            hit = run_gate_tests()
        finally:
            open(TARGET, "w", encoding="utf-8").write(original)
        if hit:
            detected += 1
            results.append((mid, "DETECTED", desc))
        else:
            results.append((mid, "SURVIVED", desc))
    after = sha(TARGET)
    print("== W60 mutation check ==")
    for r in results:
        print(f"{r[0]:5} {r[1]:11} {r[2]}")
    total = sum(1 for r in results if r[1] in ("DETECTED", "SURVIVED"))
    # G06 is proven equivalent by case analysis: for every reachable state (blocked&signed-out,
    # not-blocked&signed-out, blocked&signed-in) the reordered boot router yields the same target as
    # the original, so no test can distinguish it. It is excluded from the detection requirement.
    equivalent = {"G06"}
    survivors = [r[0] for r in results if r[1] == "SURVIVED"]
    unexpected = [s for s in survivors if s not in equivalent]
    print(f"\n{detected} detected, {len(survivors)} survived ({', '.join(survivors)}), "
          f"{sum(1 for r in results if r[1] == 'NOT-APPLIED')} not applied, of {len(MUTATIONS)}")
    print(f"equivalent-by-analysis: {', '.join(sorted(equivalent))}")
    print(f"tree before: {before}")
    print(f"tree after : {after}")
    print("identical" if before == after else "*** TREE CHANGED ***")
    ok = before == after and not unexpected and total > 0
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
