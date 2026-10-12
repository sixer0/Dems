# Row 4 - legacy data guard check (Tier 3)

Date: 2026-10-12. Branch: task4/input-av-core-port. Agent: git-specialist.

## Commands and outputs

```
$ git branch --show-current
task4/input-av-core-port

$ git status --short        (before any write)
?? docs/2026-10-12_input_av_core_adapter_plan/

$ git check-ignore -v apps/input-av/README.md
.git/info/exclude:51:apps/input-av/	apps/input-av/README.md      (rc=0)

$ git check-ignore -v apps/input-av/data
.git/info/exclude:51:apps/input-av/	apps/input-av/data           (rc=0)

$ git ls-files apps/input-av | wc -l
0
```

Result: the exclude rule is effective; apps/input-av/ is not listed by git status and no file is tracked. Nothing under apps/input-av/ was read, listed or touched.

## Step B (planning documents commit)

```
$ git add docs/2026-10-12_input_av_core_adapter_plan
$ git diff --cached --stat | tail -3
 .../verification/04_security_addendum.md  | 327 +++++++
 52 files changed, 9857 insertions(+)
$ git diff --cached --name-only | grep -v '^docs/2026-10-12_input_av_core_adapter_plan/' | wc -l
0
$ git log --oneline -1
2307e9dc docs: task 4 - plan to port the input-av hardware input logic into the Core adapters; ...
```

No push. This record file was written after the commit and is committed by a later commit row.
