/**
 * Security & Audit page (step 51; masterplan/01_specs.md §14.5.7; research/04 §5.5; design book
 * §12, §19.3, §20, §21.3, SYS-012; 03_motion_spec M-PG-SEC). Replaces the step-38 stub and keeps
 * its contract: export `SecurityAuditPage` and `data-testid="page-security-audit"` (AC-48).
 *
 * Layout (12 columns; DR-51-1): posture 3 | controls 5 | keys 4; the hash-chain strip; the audit
 * log; authentication | tamper | custody (4 each); access control. One ambient loop on the page
 * (the chain head, §9.4), plus the held red breath of a broken link until it is acknowledged.
 *
 * Staged mount (§9 "performance is luxury", DR-51-6): the first commit renders the header, the
 * first row and the chain strip; the audit table and then the lenses and access control follow
 * in two React transitions, one task apart. Transition renders yield to the browser, so the route
 * enter never becomes one long task; placeholders reserve the space, so nothing shifts.
 */
import { startTransition, useCallback, useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/shell/page-header'
import { usePlatformNotReported } from '@/lib/own-capture'
import { AuditLogPanel, type FocusRequest } from './audit-log-panel'
import { AuthPanel } from './auth-panel'
import { ChainPanel } from './chain-panel'
import { ControlsPanel } from './controls-panel'
import { CustodyPanel } from './custody-panel'
import { KeysPanel } from './keys-panel'
import { PosturePanel } from './posture-panel'
import { RbacPanel } from './rbac-panel'
import { SecurityBanner } from './status-banner'
import { TamperPanel } from './tamper-panel'
import { AuditLogContext } from './audit-context'
import { useControls, useDeferredAudit, usePosture } from './use-security-data'
import './security-audit.css'

/** Mount stages: 0 = header, first row, chain; 1 = + audit log; 2 = + lenses and access control. */
const FINAL_STAGE = 2

export function SecurityAuditPage() {
  const { t } = useTranslation()
  const { audit, chain } = useDeferredAudit()
  const posture = usePosture(chain.ok)
  const platformNotReported = usePlatformNotReported()
  const controls = useControls(chain)
  const controlsOk = controls.filter((control) => control.status === 'OK').length
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null)
  const showEntry = useCallback((seq: number) => {
    setFocusRequest((current) => ({ seq, nonce: (current?.nonce ?? 0) + 1 }))
  }, [])
  const [stage, setStage] = useState(0)
  useEffect(() => {
    if (stage >= FINAL_STAGE) return undefined
    const timer = setTimeout(() => startTransition(() => setStage((current) => current + 1)), 0)
    return () => clearTimeout(timer)
  }, [stage])

  return (
    <AuditLogContext.Provider value={audit}>
    <div className="dems-page sa-page" data-testid="page-security-audit">
      <PageHeader
        icon={ShieldCheck}
        title={t('securityAudit.title')}
        subtitle={t('securityAudit.subtitle')}
        status={
          <SecurityBanner
            posture={posture}
            controlsOk={controlsOk}
            controlsTotal={controls.length}
            chainOk={chain.ok}
            breakSeq={chain.breakSeq}
            platformNotReported={platformNotReported}
            controlsNotReported={controls.filter((control) => control.notReported === true).length}
          />
        }
      />
      <div className="sa-grid">
        <PosturePanel
          className="sa-span-3"
          posture={posture}
          controlsOk={controlsOk}
          controlsTotal={controls.length}
          chainOk={chain.ok}
          entries={chain.total + chain.dropped}
          platformNotReported={platformNotReported}
        />
        <ControlsPanel className="sa-span-5" controls={controls} />
        <KeysPanel className="sa-span-4" />
        <ChainPanel className="sa-span-12" chain={chain} onShowEntry={showEntry} />
        {stage >= 1 ? (
          <AuditLogPanel className="sa-span-12" chain={chain} focusRequest={focusRequest} />
        ) : (
          <div className="sa-span-12 sa-placeholder sa-placeholder-audit" aria-hidden="true" />
        )}
      </div>
      {stage >= 2 ? (
        <>
          <div className="sa-grid sa-lenses">
            <AuthPanel className="sa-span-4" />
            <TamperPanel className="sa-span-4" chainOk={chain.ok} />
            <CustodyPanel className="sa-span-4" />
          </div>
          <div className="sa-grid">
            <RbacPanel className="sa-span-12" />
          </div>
        </>
      ) : (
        <div className="sa-placeholder sa-placeholder-lower" aria-hidden="true" />
      )}
    </div>
    </AuditLogContext.Provider>
  )
}
