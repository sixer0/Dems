---
task_id: 2026-09-30_dems_demo_stack_setup
blueprint_row: 12
agent: coder-execution
narrative_tier: 3
status: complete
date: 2026-10-01
---

# Row 12: JavaScript runtime (verification only)

## Verdict applied

- Source: `research/03_analysis.md` SD-01 (keep system Node 26.8.2) and SD-02 (npm 11.19.1 workspaces); D12 (no version manager, no pnpm).
- Action taken: **no install**. The only file written is the Node version file named by `masterplan/01_specs.md` §1.7.

## Evidence (fresh login shell, 2026-10-01 00:23:41 WIB)

Command: `zsh -l -c 'cd /Users/gsp-budi/Documents/DEMS && node -v; npm -v; which -a node; which -a npm; ...'`

```
node: v26.8.2
npm: 11.19.1
which -a node:
/usr/local/bin/node
which -a npm:
/usr/local/bin/npm
-rwxr-xr-x  1 root  wheel  294194976 Sep  9 22:23 /usr/local/bin/node
lrwxr-xr-x  1 root  wheel         38 Sep 11 21:45 /usr/local/bin/npm -> ../lib/node_modules/npm/bin/npm-cli.js
```

`node -p 'process.versions.node + " " + process.arch + " " + process.execPath'` → `26.8.2 arm64 /usr/local/bin/node`

Version managers and alternative package managers, each checked with `zsh -l -c "command -v <tool>"`:

```
pnpm: (not found)
fnm: (not found)
nvm: (not found)
volta: (not found)
corepack: (not found)
yarn: (not found)
bun: (not found)
```

(`~/Library/pnpm` is on PATH from a pre-existing profile line but the directory is empty; untouched.)

## Checks against the row-12 verification column

| Check | Result |
|---|---|
| `node -v` in a new login shell prints the pinned version | PASS: `v26.8.2` |
| Package manager `-v` prints the pinned version | PASS: `npm 11.19.1` |
| `which -a node` still lists the original system Node | PASS: single entry `/usr/local/bin/node` (root-owned, unmodified) |
| `~/.zshrc` diff (if any) and rollback | N/A: `~/.zshrc` absent before and after (`test -e ~/.zshrc` → absent). `~/.zprofile` unchanged by this row: 21 lines, sha256 `e8543f6d9b06b1d82a5da8e8af185445b0f5e946fa98fe73dded75717e6ac2cd` (the post-row-9 state) |

## File written

| Path | Content | Rollback |
|---|---|---|
| `/Users/gsp-budi/Documents/DEMS/.node-version` | `26.8.2` + newline (`od -c` → `2 6 . 8 . 2 \n`, 7 bytes) | `rm .node-version` |

## Registry access note (feeds rows 14-18)

- `npm_config_cache="$PWD/.cache/npm" npm view react@19.2.3 version` → `19.2.3`, exit 0, **inside the sandbox**. The workspace-local cache (03 HI-8, spec R-4) is already git-ignored by the row-7 rule `.cache/`, so no `.gitignore` change is needed.
- The sandbox prints `ERROR: failed to copy trust settings of system certificate-...` lines on stderr for each TLS connection; they are harmless (the command succeeds).
- npm prints an update notice (npm 12.2.0 available). It is **not** acted on (SD-02 pins npm 11.19.1). Later rows set `npm_config_update_notifier=false`.

---
*Generated: 2026-10-01 00:25 WIB*
