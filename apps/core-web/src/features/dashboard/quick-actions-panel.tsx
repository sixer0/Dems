import { Tooltip } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { ChevronRight, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { roleHas, selectRole, useSim, type OperatorRole } from '@dems/shared/sim'
import { motion as tokens } from '@dems/shared/tokens'
import { Spotlight } from '@/components/ui/spotlight'
import { useMotionPolicy } from '@/motion'
import { DashPanel } from './dash-panel'
import { QUICK_ACTIONS, requiredRoleFor, type QuickActionSpec } from './dashboard-model'
import { DASH_BEATS, useBeatDelay } from './dashboard-motion'

function CardBody({ spec }: { spec: QuickActionSpec }) {
  const { t } = useTranslation()
  const Icon = spec.icon
  return (
    <span className="dems-qa-inner">
      <span className="dems-qa-icon" data-micro={spec.micro} aria-hidden="true">
        <Icon size={26} strokeWidth={1.6} />
      </span>
      <span className="flex min-w-0 flex-col pr-2">
        <span className="dems-qa-title">{t(`common.quickActions.${spec.id}.title`)}</span>
        <span className="dems-qa-subtitle">{t(`common.quickActions.${spec.id}.subtitle`)}</span>
      </span>
      <ChevronRight className="dems-qa-chevron" aria-hidden="true" size={16} />
    </span>
  )
}

function QuickActionCard({ spec, role, index, beatMs }: { spec: QuickActionSpec; role: OperatorRole | null; index: number; beatMs: number }) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const allowed = spec.permission === null || roleHas(role, spec.permission)
  const needed = spec.permission ? requiredRoleFor(spec.permission) : null
  const title = t(`common.quickActions.${spec.id}.title`)

  const card = allowed ? (
    <Link to={spec.to} className="dems-qa-card h-full" data-enabled="true" data-testid={`quick-action-${spec.id}`}>
      {/* M-C-16: MP Spotlight (size 200, bronze at 12%) follows the pointer. */}
      <Spotlight size={200} />
      <CardBody spec={spec} />
    </Link>
  ) : (
    <Tooltip delay={200}>
      <Tooltip.Trigger
        className="dems-qa-card h-full"
        data-enabled="false"
        data-testid={`quick-action-${spec.id}`}
        aria-disabled="true"
        aria-label={`${title}: ${t('common.rbac.requiresRole', { role: needed ? t(`common.roles.${needed}`) : '' })}`}
      >
        <CardBody spec={spec} />
      </Tooltip.Trigger>
      <Tooltip.Content placement="top">
        {t('common.rbac.requiresRole', { role: needed ? t(`common.roles.${needed}`) : '' })}
      </Tooltip.Content>
    </Tooltip>
  )

  return (
    <motion.div
      className="min-h-0 min-w-0"
      initial={m.reduced ? { opacity: 0 } : { opacity: 0, y: tokens.distance.rise, scale: tokens.scale.enterFrom }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...m.transitions.enter, delay: m.reduced ? 0 : m.seconds(beatMs + index * DASH_BEATS.stagger) }}
    >
      {card}
    </motion.div>
  )
}

/**
 * Panel J, Quick Actions (01_specs §14.5.1 J; research/04 §3.1 J): four pressable cards that link to
 * System & Maintenance (diagnostics), Security & Audit, Evidence (export) and System & Maintenance.
 *
 * RBAC (S20): a card whose named action the role lacks (Run Diagnostics: DIAGNOSTICS_RUN; Export
 * Evidence: EVIDENCE_EXPORT) is disabled, and a Tooltip names the role. Cards that only open a
 * page every role may view stay enabled; the target page gates its own actions.
 *
 * Motion (M-C-16, M-PG-DASH t = 850): cards stagger in; hover lifts 2 px with the e2 glow layer,
 * press scales 0.98, the MP Spotlight follows the pointer, and each icon has its micro-motion
 * (stethoscope swing, page tilt, export rise, gear 45°). Reduced motion: no micro-motions.
 */
export function QuickActionsPanel() {
  const { t } = useTranslation()
  const role = useSim(selectRole)
  const beatMs = useBeatDelay(DASH_BEATS.row4 + DASH_BEATS.stagger)
  return (
    <DashPanel id="j" beatMs={DASH_BEATS.row4 + DASH_BEATS.stagger} title={t('common.quickActions.title')} icon={Plus}>
      <nav className="dems-qa-grid" aria-label={t('dashboard.quickActions.label')}>
        {QUICK_ACTIONS.map((spec, index) => (
          <QuickActionCard key={spec.id} spec={spec} role={role} index={index} beatMs={beatMs} />
        ))}
      </nav>
    </DashPanel>
  )
}
