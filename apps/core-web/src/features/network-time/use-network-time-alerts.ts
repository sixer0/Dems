/**
 * M-PG-NET data moments (03_motion_spec §6 M-PG-NET, §7 GNSS_LOSS / RTC fallback, R8, P7).
 *
 * On GNSS loss the page raises one warning toast (the simulator writes the audit row), a further
 * fall to the RTC raises a second one, and a return to GNSS says so quietly. A tablet link loss
 * reminds the operator that recording continues on the Core (FMEA §23.1). Nothing fires on mount,
 * only on changes seen while the page is open.
 */
import { useEffect, useRef, useState } from 'react'
import { toast } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { useSim } from '@dems/shared/sim'
import { isOwnCaptureCore } from '@/lib/own-capture'
import { isTimeEscalation, timeLevel, type TimeLevel } from './model'

/** A counter that increases on every escalation of `level` (a `GlowLayer` `pulseKey`, R8). */
export function useTimeEscalationKey(level: TimeLevel): number {
  const [track, setTrack] = useState({ level, key: 0 })
  let current = track
  if (track.level !== level) {
    // Derived during render (no effect, no extra frame): the new level, plus one pulse on a rise.
    current = { level, key: isTimeEscalation(track.level, level) ? track.key + 1 : track.key }
    setTrack(current)
  }
  return current.key
}

export function useNetworkTimeAlerts(): void {
  const { t } = useTranslation()
  const view = useSim((s) => ({
    level: timeLevel(s.time.source),
    // G75b-06: a host system clock never fell back from anything - no "RTC holdover" toast.
    hostClock: isOwnCaptureCore(s),
    server: s.time.ntp.server,
    tablet: s.tabletLink.state,
  }))
  const previousLevel = useRef<TimeLevel>(view.level)
  const previousTablet = useRef(view.tablet)

  useEffect(() => {
    const from = previousLevel.current
    previousLevel.current = view.level
    if (from === view.level || view.hostClock) return
    if (view.level === 'FALLBACK' && from === 'LOCKED') {
      toast.warning(t('networkTime.toast.gnssLost'), {
        description: t('networkTime.toast.gnssLostDetail', { server: view.server }),
      })
    } else if (view.level === 'HOLDOVER') {
      toast.warning(t('networkTime.toast.rtcHoldover'), { description: t('networkTime.toast.rtcHoldoverDetail') })
    } else if (view.level === 'LOCKED') {
      toast.success(t('networkTime.toast.restored'), { description: t('networkTime.toast.restoredDetail') })
    }
  }, [view.level, view.hostClock, view.server, t])

  useEffect(() => {
    const from = previousTablet.current
    previousTablet.current = view.tablet
    if (from !== 'OFFLINE' && view.tablet === 'OFFLINE') {
      toast.warning(t('networkTime.toast.tabletOffline'), { description: t('networkTime.toast.tabletOfflineDetail') })
    }
  }, [view.tablet, t])
}
