# Row 80 - R-FLEX restore point (Mac working tree)

Date: 2026-10-22. Tier 3. Git state not changed (read-only git commands only).

## State
- HEAD: e05a156711c046fc524d23a53a8539a95e6b0bf5, branch task4/input-av-core-port
- porcelain sha256 BEFORE: 3f5024aea2ce568349e0aabaabb40aeae6516234fa8ebafbbd830671774c16c4
- porcelain sha256 AFTER:  3f5024aea2ce568349e0aabaabb40aeae6516234fa8ebafbbd830671774c16c4 (equal)
- Snapshot folder git-ignored: `.gitignore:71:/.data/` (git check-ignore confirmed)

## Snapshot: /Users/gsp-budi/Documents/DEMS/.data/rflex-restore-20261022/
| File | sha256 |
|---|---|
| head.txt | 32993f558753a6a00babc1482745795b9d3c8969f1112c06364a475d9bf23a79 |
| porcelain.txt | 3f5024aea2ce568349e0aabaabb40aeae6516234fa8ebafbbd830671774c16c4 |
| tracked.diff (git diff HEAD --binary, 22 files, +334/-21) | ec4896961a7e25db0b7729367d4cfbfca97362d0b02946c18417a6ed91d48501 |
| untracked.tar.gz (54 files, equals `git ls-files -o --exclude-standard` count) | 74d4115a53c24895fb97fa611320cd139e21e67f41c5be212f05e71d55678d48 |
| SHA256SUMS | lists the four above |

## Row 7 comparison
tracked.diff sha256 equals row 7's ec4896...8501: no tracked change since row 7. Untracked: 54 files now vs 34 in row 7 (docs under this task's folder grew; row 7 noted docs-only differences). Archive hash is the tar.gz hash above (gzip embeds mtime, so it is not reproducible; the member contents are what matter).

## Restore commands (NOT run)
```
cd /Users/gsp-budi/Documents/DEMS
S=.data/rflex-restore-20261022
git apply --binary $S/tracked.diff      # on a clean tree at HEAD e05a1567
tar -xzf $S/untracked.tar.gz            # restores untracked files at repo root
shasum -a 256 -c $S/SHA256SUMS          # verify snapshot integrity first
```
