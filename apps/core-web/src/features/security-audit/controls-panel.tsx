import { memo } from 'react'
import { Chip, ListBox } from '@heroui/react'
import { AnimatePresence, motion } from 'motion/react'
import { CircleHelp, CircleX, ListChecks, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toneChipProps } from '@dems/shared/tokens'
import { useRouteEnterDelay } from '@/components/shell'
import { tween, useMotionPolicy } from '@/motion'
import { cn } from '@/lib/utils'
import { CONTENT_BEAT_MS, CONTROL_STAGGER_MS, PANEL_BEAT_MS } from './choreography'
import type { ControlStatus, ControlView } from './model'
import { Panel } from './panel'
import { CONTROL_TONE, toneClass } from './tones'

/** M-C-21 / M-PG-SEC: the check path draws in 300 ms. */
const CHECK_DRAW_MS = 300

function ControlGlyph({ status, delayMs }: { status: ControlStatus; delayMs: number }) {
  const m = useMotionPolicy()
  if (status === 'OK') {
    return (
      <svg viewBox="0 0 24 24" className="sa-control-glyph" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <circle cx="12" cy="12" r="9.5" strokeOpacity="0.45" />
        <motion.path
          d="M7.5 12.5l3 3 6-6.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={m.reduced ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ ...tween(CHECK_DRAW_MS, 'standard', m.timeScale), delay: m.reduced ? 0 : m.seconds(delayMs) }}
        />
      </svg>
    )
  }
  const Icon = status === 'ATTENTION' ? TriangleAlert : status === 'FAIL' ? CircleX : CircleHelp
  return <Icon className="sa-control-glyph" aria-hidden="true" strokeWidth={2} />
}

export interface ControlsPanelProps {
  controls: readonly ControlView[]
  className?: string
}

/**
 * Controls checklist (01_specs §14.5.7 "Controls checklist": Card, read-only ListBox, Chip;
 * research/04 §5.5 from D1 G and SM N). Nine controls from the design book §12 and §20: TPM 2.0,
 * Secure Boot, key custody, AES-256 encryption, the Ed25519 manifest signature of the DEMO
 * packages (D67), the audit hash chain, the secure timestamp, the enclosure tamper switch and
 * signed firmware. On enter the checks draw one by one, 80 ms apart (M-PG-SEC).
 */
export const ControlsPanel = memo(function ControlsPanel({ controls, className }: ControlsPanelProps) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const routeDelay = useRouteEnterDelay()
  const ok = controls.filter((control) => control.status === 'OK').length
  const allOk = ok === controls.length
  const start = routeDelay + PANEL_BEAT_MS.controls + CONTENT_BEAT_MS

  return (
    <Panel
      id="controls"
      icon={ListChecks}
      title={t('securityAudit.controls.title')}
      className={className}
      action={
        <Chip size="sm" variant="soft" {...toneChipProps(allOk ? 'success' : 'warning')}>
          {t('securityAudit.controls.summary', { ok, total: controls.length })}
        </Chip>
      }
    >
      <ListBox aria-label={t('securityAudit.controls.listLabel')} selectionMode="none" className="sa-controls-list" layout="grid">
        {controls.map((control, index) => {
          const tone = CONTROL_TONE[control.status]
          const label = t(`securityAudit.controls.items.${control.id}.label`)
          const detail =
            control.status === 'OK' || control.status === 'UNKNOWN'
              ? t(`securityAudit.controls.items.${control.id}.ok`, control.params)
              : t(`securityAudit.controls.items.${control.id}.fail`, control.params)
          const statusText = t(`securityAudit.controls.status.${control.status}`)
          return (
            <ListBox.Item
              key={control.id}
              id={control.id}
              textValue={`${label}: ${statusText}`}
              className={cn('sa-control', toneClass(tone))}
              data-control={control.id}
              data-status={control.status}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={control.status}
                  className="grid place-items-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: m.seconds(160) }}
                >
                  <ControlGlyph status={control.status} delayMs={start + index * CONTROL_STAGGER_MS} />
                </motion.span>
              </AnimatePresence>
              <span className="sa-control-text">
                <span className="sa-control-label">{label}</span>
                <span className="sa-control-detail">{detail}</span>
              </span>
              <span className="sa-visually-hidden">{statusText}</span>
            </ListBox.Item>
          )
        })}
      </ListBox>
    </Panel>
  )
})
