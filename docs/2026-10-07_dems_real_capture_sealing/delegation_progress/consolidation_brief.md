# Test-suite consolidation — common brief (controller, 2026-10-11; decisions D233, D238)

User instruction: "setelah recheck selesai, lakukan konsolidasi test suite".
Basis: the measured audit `test/13_suite_consolidation_audit.md` (read it IN FULL: sections
3c, 4, 5, 7 are your work list; section 7 has the table for YOUR workspace). Tree: commit
`a5d75ed`.

## What the audit found (so nobody chases the wrong thing)

- Copy-paste is under 1 % of test bodies; two thirds of the suite predate this task; the
  test COUNT will stay about the same. The work is: fewer FILES (165 per-wave files merged
  into their homes), no more stale-pin reds (list pins -> rules), no leak, no flake, less
  real waiting.
- Every red of the last four pre-commit runs was a stale pin or a test race, never a
  product defect.

## Rules

1. You change TESTS and test support only. NO product code. If an action needs a product
   change (e.g. an injectable clock that does not exist), stop on that action and list it.
2. One owner per workspace; you touch only your workspace's tests. No git write of any
   kind (no `git mv`: move content by editing; no stash). No formatter `--write` over
   files you did not change.
3. MERGE = move the `describe` / `it` blocks of a per-wave file into the home file the
   audit names (section 3c), delete the per-wave file, keep every assertion. Proof: the
   test count of the workspace is unchanged by the merge, and the normalised body hashes
   of the moved tests are found in the home file (the audit's scripts are in the scratchpad
   `audit13/`; you may copy `dup.mjs` / `collect.mjs` logic into your own scratch script).
   Names: drop the wave / pass / fix prefix from the `describe` title; keep the finding id
   (e.g. `G94d-01`) in the test title so history stays searchable. Shared helpers of a
   merged file move to the home file's existing helper or a `testing/` module — no
   duplicate helper.
4. PROTECTED (assertions never dropped, never weakened; merge by file only, case for
   case): sealing, sealing-host, evidence-verify, evidence-export, media-stream, session
   keys, audit chain, capture fence and REAL_PRODUCTION refusals, RBAC matrix and
   `test/acceptance`, contract-example tests, OpenAPI / registry totals, kill matrix, seal
   and development e2e, security static rules, privacy rules for local devices — and, as
   the audit's section 6 argues, the booted-order scenarios (adopt then assign then
   pre-check, restart fault, graceful restart), the "real capture states only facts" tests
   and the web player's stall-watch cases.
5. DELETE only what the audit's section 7 lists as deletable for your workspace, and only
   with the covering test named in your note and the mutation proof run ONCE (apply the
   mutation the audit names, see the covering test go red, restore the file from a copy
   you made — never from git — and confirm it is byte-identical with `cmp`).
6. LIST PINS -> RULES: replace "the scan reads exactly these files" lists by the rule the
   audit gives (the scan equals an independent directory walk and is not empty; the
   forbidden thing appears in none). A rule of the form "no file does X" stays as it is.
   Allow-lists that are SECURITY boundaries (what a log line may hold, what may import a
   key module, what may open a local device) stay explicit lists.
7. FLAKE / LEAK / WAITS: use the mechanism the workspace already has (the manual timer 20
   db files inject; fake timers; `gcTime` on the shared test provider). No blanket longer
   timeouts.
8. Ruling on the audit's question M6: the 9 mobile tests that pin copy or file lists "as it
   was at `acaff20`" fence a plan row of the first task that is closed, and later waves
   changed that copy on purpose — they are deleted and listed (no covering test exists or
   is needed: they assert history, not behaviour).
9. Whole unit suite of YOUR workspace green before you start (record the counts) and after
   you finish (one run each); typecheck and lint of your workspace clean. Never run two
   workspaces' whole suites yourself. Database tests only through the project's script and
   only by the core-server db owner. No lane is started; lanes are stopped during this
   work.

## Deliverable of each owner

`test/14_consolidation_<workspace>.md`: before / after (files, tests, wall time of the
whole run), every file merged (from -> to, tests moved), every test deleted (with its
covering test and the mutation result), every list pin turned into a rule, the leak /
flake / wait fixes, what you did NOT do from the audit's table and why, anything that
needs a product change. Final response: status (complete | blocked | needs-review), the
before / after numbers, files removed, open items.
