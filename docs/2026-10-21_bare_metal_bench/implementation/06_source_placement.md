# Row 26: the changed tree placed from tree_staging_dir (OI-7)

Date: 2026-10-22, host .73 (D30). Commands: masterplan/02_plan.md row 26 verbatim.

- staging `/home/gsp-dems/dems-tree-staging-20261022`; `data_before=dems-core:dems-core 700` = `data_after`; `/opt/dems/core` `root:root 755`; logs `dems-core:dems-core 700`.
- `manifest_staging` = `manifest_install` = `a6f516e04e543ebf6825ec5128a6dd2836f760a28126a232ba6a33d6643356d2`; non-root or group/other-writable entries: `0`.
- OI-7 record: source HEAD c1e46f815d170de90ee78efb81845f7f48beab3e (the R-FLEX commit, row 120, on the user's word D33) plus the uncommitted task-4 work; RB-1 `rflex_only_diff` sha256 a2dbc8a11861d4cb329c0a8acd7d29cba42fe2fda53e519549f48026eaa4ca86; manifests above.

## Deviation found and corrected (controller error in row 121)
Row 121 extracted the staging copy under `umask 077`, so its members were 0700/0600; row 26's `--no-same-permissions` kept those modes. The first `namei -l` of `apps/core-server/src/index.ts` showed `drwx------ root root` for `apps`, `core-server`, `src` and `-rw------- root root` for the file: the service accounts could not have read the tree. The row's own checks (`! -user root -o -perm /022`) do not catch an unreadable tree.
Correction (no chown, no rm, `.data` and `apps/core-server/logs` excluded): `find <R> \( -path <R>/.data -o -path <R>/apps/core-server/logs \) -prune -o ! -type l -exec chmod u=rwX,go=rX {} +` on `/opt/dems/core` and on the staging folder (folder itself back to 0700).
After: `namei -l` all `drwxr-xr-x root root`, file `-rw-r--r-- root root`; executable files 40 in the source and 40 in `/opt/dems/core`, sets equal; 0 entries not world-readable; 0 non-root or group/other-writable; `sudo -u dems-core test -r .../index.ts` succeeds; manifest unchanged (content only).
