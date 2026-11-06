# src/features/security-audit

Up: [src/features](../README.md)

## Purpose

The Security and Audit page of the web console (`/security-audit`): security posture, controls checklist, keys and certificates, the audit hash-chain strip with "Verify chain", the virtualised audit log, authentication events, tamper and integrity, export and chain of custody, and access control (role and permission matrix). It also builds the audit export file in Live mode.

## Files

| File | Role |
|---|---|
| [`__tests__/`](__tests__/) | Page test and the Live test bed of this feature |
| [`audit-context.ts`](audit-context.ts) | `AuditLogContext`, `useAuditLog`: the deferred copy of the audit log handed to the panels |
| [`audit-log-panel.tsx`](audit-log-panel.tsx) | `AuditLogPanel`: the virtualised audit table with filters and focus requests |
| [`auth-panel.tsx`](auth-panel.tsx) | `AuthPanel`: login success, failure and lockout KPIs and the newest auth rows |
| [`chain-core-lines.tsx`](chain-core-lines.tsx) | `CoreChainLines`: in Live mode, what the Core answered for its audit chain (operation 60, `AuditChainStatus`) beside the page's own check |
| [`chain-panel.tsx`](chain-panel.tsx) | `ChainPanel`: the hash-chain strip and "Verify chain" (`verifyAuditChain`), acknowledging a broken-link alert |
| [`choreography.ts`](choreography.ts) | Enter order and timings of the page (M-PG-SEC) |
| [`controls-panel.tsx`](controls-panel.tsx) | `ControlsPanel`: the security controls checklist |
| [`core-verify-rows.ts`](core-verify-rows.ts) | Reads the Core's own verification runs from its audit rows (operation 41 writes one row per run), instead of the demo dataset's constants |
| [`custody-panel.tsx`](custody-panel.tsx) | `CustodyPanel`: newest export rows (EVIDENCE_EXPORTED, EXPORT_DENIED, AUDIT_EXPORTED) with operator, reason and destination |
| [`evidence-verification.ts`](evidence-verification.ts) | `useEvidenceVerificationCounts`: the Core's own count of items with and without a verification of record |
| [`export-audit-dialog.tsx`](export-audit-dialog.tsx) | `ExportAuditDialog`: audit export with a reason (`exportAudit`); in Live mode builds the file from all pages of operation 59 |
| [`export-file.ts`](export-file.ts) | Builds and downloads the audit export file in Live mode from operation 59 `listAuditRows` (200 rows a page) after the Core accepted the export |
| [`feed.tsx`](feed.tsx) | `Feed`: a small row list with the newest-arrival highlight |
| [`index.tsx`](index.tsx) | `SecurityAuditPage`: page layout with a staged mount; root `data-testid="page-security-audit"` |
| [`keys-panel.tsx`](keys-panel.tsx) | `KeysPanel`: device certificate and evidence signing key with expiry chips |
| [`log.ts`](log.ts) | The page's own log (`logSecurityAudit`, correlation IDs) through the console's page reporter |
| [`model.ts`](model.ts) | Pure derivations: `verifyChain` (the hash chain checked row by row), strip blocks, short hashes, fingerprints, audit row views |
| [`panel.tsx`](panel.tsx) | `Panel` card frame and `PanelErrorBoundary` |
| [`posture-panel.tsx`](posture-panel.tsx) | `PosturePanel`: the posture shields; an unknown posture reads "not reported" |
| [`rbac-panel.tsx`](rbac-panel.tsx) | `RbacPanel`: operators with role and last sign-in, and the role and permission matrix; in Live mode the Core's matrix (operation 10 `getRoleMatrix`) |
| [`security-audit.css`](security-audit.css) | Page styles (`sa-*` classes) |
| [`sim-adapter.ts`](sim-adapter.ts) | Reads and writes over the simulator: audit export with a reason (minimum 5 characters), key entries (demo and own-Core), guarded package joins |
| [`status-banner.tsx`](status-banner.tsx) | `SecurityBanner`: header banner; an UNKNOWN platform posture reads "not reported" |
| [`tamper-panel.tsx`](tamper-panel.tsx) | `TamperPanel`: enclosure switch, audit chain and evidence verification tiles |
| [`tones.ts`](tones.ts) | Status to tone maps for posture, controls, severity, category, chain and expiry |
| [`use-newest.ts`](use-newest.ts) | `useNewestArrival`, `useStableRows`: newest-row highlight helpers |
| [`use-security-data.ts`](use-security-data.ts) | Page-level simulator subscriptions: deferred audit, posture, controls, clock, signed-in operator, escalation count |

## Main exports

- `SecurityAuditPage` (`index.tsx`), the route component.
- Panels: `PosturePanel`, `ControlsPanel`, `KeysPanel`, `ChainPanel`, `CoreChainLines`, `AuditLogPanel`, `AuthPanel`, `TamperPanel`, `CustodyPanel`, `RbacPanel`, `ExportAuditDialog`, `SecurityBanner`.
- Model and hooks: `model.ts` (`verifyChain`), `use-security-data.ts`, `useEvidenceVerificationCounts`, `coreVerifyOutcomes`, `export-file.ts` (`buildAuditExportFile`, `downloadAuditFile`).

Routes: `/security-audit` (`src/routes/_app/security-audit.tsx`).

## Core operations, state and shared modules

- Operations: 10 `getRoleMatrix`, 41 (verify run rows), 59 `listAuditRows`, 60 (`AuditChainStatus`), 61 (export accepted); actions `exportAudit`, `verifyAuditChain`, `acknowledgeAlert`.
- `useSim` state: `audit` (read once and deferred), posture, controls, lockout and the signed-in operator.
- Shared modules: `@dems/shared/sim`, `@dems/shared/live`, `@dems/shared/api`, `@dems/shared/realtime`, `@dems/shared/tokens`, `@dems/shared/demo-data`.
- Console folders: [`src/lib`](../../lib/) (page reporter, Core queries), [`src/runtime`](../../runtime/), [`src/components`](../../components/).

## Tests

- [`__tests__/`](__tests__/): `security-audit.test.tsx` and the test bed `live-security-audit-bed.ts`.
- Page-level tests in [`src/test`](../../test/): `live-security-audit-page.test.tsx`, `live-security-audit-signout.test.tsx`, `live-security-audit-chain.test.tsx`, `live-security-audit-export.test.tsx`, `real-core-facts.test.tsx`.

## Related decisions

- D63: audit-record views, including the security audit log, keep the hash-chained record text unchanged.
- D81: the Security and Audit UI gap F-7-04b was moved to M2.
