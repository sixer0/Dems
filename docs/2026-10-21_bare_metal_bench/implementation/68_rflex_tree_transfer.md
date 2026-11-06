# Row 121: the changed tree to a staging folder on the host

Date: 2026-10-22, host .73. The source is on the host itself since the handover (`transfer_20261022.md`), so the "Mac manifest" of the blueprint is the manifest of `~/Desktop/DEMS-source` computed with the same exclusions; the R-FLEX part of it is committed as c1e46f81 (row 120).

- Staging: `/home/gsp-dems/dems-tree-staging-20261022`, `gsp-dems:gsp-dems 0700`, 3898 files.
- Copied with `tar` from `~/Desktop/DEMS-source`, excluding `./.git`, every `node_modules`, `./.data`, `./.locks`, `./docs`, `./apps/input-av` (host-local, git-excluded), `./graft`, `./release`, `.DS_Store`, `.claude`, `._*`.
- Exclusions checked: no `.data`, `node_modules`, `.git` or `docs` under the staging folder (`exclusions_ok`; `node_modules` count 0).
- Manifest (find -type f, `LC_ALL=C sort -z`, `sha256sum` of the sorted per-file list): staging `a6f516e04e543ebf6825ec5128a6dd2836f760a28126a232ba6a33d6643356d2` = source `a6f516e04e543ebf6825ec5128a6dd2836f760a28126a232ba6a33d6643356d2`.
- RB-1 `rflex_only_diff` sha256: the line in `~/Desktop/DEMS-progress-20261022/rflex-restore-20261022/SHA256SUMS` (row 120).
- `~/Desktop/DEMS-source` untouched by this row (read only).
