import type { ReactNode } from 'react'
import { Tooltip } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { ChevronRight, CloudDownload, FileText, Stethoscope, Upload, Zap, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Permission, roleHas, selectRole, useSim } from '@dems/shared/sim'
import { motion as tokens } from '@dems/shared/tokens'
import { Spotlight } from '@/components/ui/spotlight'
import { useRouteEnterDelay } from '@/components/shell'
import { useMotionPolicy } from '@/motion'
import { PANEL_BEAT_MS } from './choreography'
import { requiredRoleFor } from './model'
import { SystemPanel } from './panel'

type QuickId = 'runDiagnostics' | 'reviewAudit' | 'exportEvidence' | 'softwareUpdate'

interface QuickSpec {
  id: QuickId
  icon: LucideIcon
  permission: Permission | null
}

/** research/04 §5.6: Run Diagnostics | Review Audit | Export Evidence | Software Update (D1 J reused). */
const QUICK: readonly QuickSpec[] = [
  { id: 'runDiagnostics', icon: Stethoscope, permission: Permission.DIAGNOSTICS_RUN },
  { id: 'reviewAudit', icon: FileText, permission: null },
  { id: 'exportEvidence', icon: Upload, permission: Permission.EVIDENCE_EXPORT },
  { id: 'softwareUpdate', icon: CloudDownload, permission: null },
]

function CardBody({ spec }: { spec: QuickSpec }) {
  const { t } = useTranslation()
  const Icon = spec.icon
  return (
    <span className="sys-qa-inner">
      <span className="sys-qa-icon" aria-hidden="true">
        <Icon size={24} strokeWidth={1.6} />
      </span>
      <span className="sys-qa-text">
        <span className="sys-qa-title">{t(`common.quickActions.${spec.id}.title`)}</span>
        <span className="sys-qa-subtitle">{t(`common.quickActions.${spec.id}.subtitle`)}</span>
      </span>
      <ChevronRight className="sys-qa-chevron" aria-hidden="true" size={16} />
    </span>
  )
}

export interface QuickActionsProps {
  onRunDiagnostics: () => void
  onSoftwareUpdate: () => void
  /**
   * Live mode (plan row W76, LB-1): a diagnostics start is out; the card is marked `aria-busy` and a
   * press sends nothing more (the starter ignores it). Never true in Simulated mode.
   */
  runBusy?: boolean
}

/**
 * Quick actions (01_specs §14.5.8 "reuses J"): four pressable cards with the MP Spotlight (M-C-16).
 * RBAC (S20): a card whose action the role lacks is disabled and a Tooltip names the role.
 */
export function QuickActions({ onRunDiagnostics, onSoftwareUpdate, runBusy = false }: QuickActionsProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const routeDelay = useRouteEnterDelay()
  const role = useSim(selectRole)

  const renderCard = (spec: QuickSpec): ReactNode => {
    const allowed = spec.permission === null || roleHas(role, spec.permission)
    const testId = `system-quick-${spec.id}`
    if (!allowed) {
      const needed = spec.permission ? requiredRoleFor(spec.permission) : null
      const reason = t('common.rbac.requiresRole', { role: needed ? t(`common.roles.${needed}`) : '' })
      return (
        <Tooltip delay={200}>
          <Tooltip.Trigger
            className="sys-qa-card"
            data-enabled="false"
            data-testid={testId}
            aria-disabled="true"
            aria-label={`${t(`common.quickActions.${spec.id}.title`)}: ${reason}`}
          >
            <CardBody spec={spec} />
          </Tooltip.Trigger>
          <Tooltip.Content placement="top">{reason}</Tooltip.Content>
        </Tooltip>
      )
    }
    if (spec.id === 'reviewAudit' || spec.id === 'exportEvidence') {
      return (
        <Link to={spec.id === 'reviewAudit' ? '/security-audit' : '/evidence'} className="sys-qa-card" data-enabled="true" data-testid={testId}>
          <Spotlight size={200} />
          <CardBody spec={spec} />
        </Link>
      )
    }
    return (
      <button
        type="button"
        className="sys-qa-card"
        data-enabled="true"
        data-testid={testId}
        aria-busy={spec.id === 'runDiagnostics' && runBusy ? true : undefined}
        onClick={spec.id === 'runDiagnostics' ? onRunDiagnostics : onSoftwareUpdate}
      >
        <Spotlight size={200} />
        <CardBody spec={spec} />
      </button>
    )
  }

  return (
    <SystemPanel id="quick" icon={Zap} title={t('common.quickActions.title')} bodyClassName="sys-qa-body">
      <nav className="sys-qa-grid" aria-label={t('system.quickActions.label')}>
        {QUICK.map((spec, index) => (
          <motion.div
            key={spec.id}
            className="sys-qa-cell"
            initial={m.reduced ? { opacity: 0 } : { opacity: 0, y: tokens.distance.rise }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...m.transitions.enter, delay: m.reduced ? 0 : m.seconds(routeDelay + PANEL_BEAT_MS.quick + 80 + index * 60) }}
          >
            {renderCard(spec)}
          </motion.div>
        ))}
      </nav>
    </SystemPanel>
  )
}
