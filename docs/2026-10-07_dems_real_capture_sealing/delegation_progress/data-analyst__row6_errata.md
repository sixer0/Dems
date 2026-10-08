# data-analyst — row 6 errata correction (W1-C7 / vitest `--maxWorkers`)

Status: complete

## Scope
- Task: apply ONE evidence-based correction to the errata-applied impact register (blueprint row 6), so the M0 gate (row 39) checks a correct document.
- Edited file (the only file touched): `docs/2026-10-07_dems_real_capture_sealing/research/03_analysis.md`
- Location: section F "Corrections from Wave W1", row `W1-C7` (line 335), found by searching `maxWorkers`.

## The correction (evidence: decision D12(c); row 20 report)
- Old claim: `vitest workspaces do not honour \`--maxWorkers\` — only mobile jest does`
- Corrected claim: vitest 5.0.3 DOES honour `--maxWorkers`; the prescribed substitute `--poolOptions.threads.maxThreads=2` is wrong and moot; all four vitest workspaces plus mobile jest use `--maxWorkers=2`.

Exact old line:
`| W1-C7 | vitest workspaces do not honour \`--maxWorkers\` — only mobile jest does | row 5 §10 step 10; D8 | test rows | 23, 27, 36 |`

Exact new line:
`| W1-C7 | all four vitest workspaces (packages/shared, apps/core-server unit + db projects, apps/core-web) AND apps/mobile (jest) use \`--maxWorkers=2\` for per-workspace runs; vitest 5.0.3 DOES honour \`--maxWorkers\` (verified from \`vitest --help\` and by measurement in core-web: same 6 files 15.55 s at \`--maxWorkers=1\` with exactly one child worker observed vs 7.62 s / 8.05 s at \`--maxWorkers=4\`, identical pass counts); the prescribed substitute \`--poolOptions.threads.maxThreads=2\` rejects with \`CACError: Unknown option\` and core-web's default pool is \`forks\` (\`apps/core-web/vite.config.ts:69-74\`), so the substitute is both wrong and moot | row 5 §10 step 10 (superseded); D12(c); row 20 report \`implementation/05_b10d_live_paired_devices_issue.md\` §5 | test rows | 23, 27, 36 |`

Format preserved: the `W1-C7` ID, the five-column table shape, the register-rows cell (`test rows`) and the blueprint-rows cell (`23, 27, 36`). The prior source (`row 5 §10 step 10`) is kept and marked superseded; the superseding source (D12(c); row 20 report) is added.

## Verification
`grep -n "maxWorkers" docs/2026-10-07_dems_real_capture_sealing/research/03_analysis.md` (one match, line 335):
```
335:| W1-C7 | all four vitest workspaces (packages/shared, apps/core-server unit + db projects, apps/core-web) AND apps/mobile (jest) use `--maxWorkers=2` for per-workspace runs; vitest 5.0.3 DOES honour `--maxWorkers` (verified from `vitest --help` and by measurement in core-web: same 6 files 15.55 s at `--maxWorkers=1` with exactly one child worker observed vs 7.62 s / 8.05 s at `--maxWorkers=4`, identical pass counts); the prescribed substitute `--poolOptions.threads.maxThreads=2` rejects with `CACError: Unknown option` and core-web's default pool is `forks` (`apps/core-web/vite.config.ts:69-74`), so the substitute is both wrong and moot | row 5 §10 step 10 (superseded); D12(c); row 20 report `implementation/05_b10d_live_paired_devices_issue.md` §5 | test rows | 23, 27, 36 |
```

Counts (table-row counting method; `^\| <ID>-NN \|`):
| Measure | Baseline | Post-edit |
|---|---|---|
| Errata rows E-01..E-31 | 31 | 31 |
| SH register rows | 25 | 25 |
| CS register rows | 25 | 25 |
| WB register rows | 11 | 11 |
| MB register rows | 13 | 13 |
| DOC register rows | 6 | 6 |
| NM register rows | 14 | 14 |

## Audit trail
- The document has no errata/changelog section, only a `*Generated:* / *Last Updated:*` footer; per instruction, no changelog entry was added and `Last Updated` was left untouched. The audit trail stays with decision D12(c).
- No other line of the document was changed; no other file was touched.

## Blockers
None.
