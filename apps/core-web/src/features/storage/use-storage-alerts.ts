/**
 * M-PG-STOR data moment: the LOW / FULL thresholds morph the ring colour with one pulse, plus a
 * toast (03_motion_spec §6 M-PG-STOR, §7 STORAGE_LOW / FULL, R8). Escalations only: a recovery is
 * a colour transition with no toast. Nothing fires on mount, only on changes seen while the page
 * is open.
 */
import { useEffect, useRef, useState } from 'react'
import { toast } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { selectStorage, useSim } from '@dems/shared/sim'
import { isEscalation, THRESHOLDS, type StorageLevel } from './model'

/** A counter that increases on every escalation of `level` (a `GlowLayer` `pulseKey`). */
export function useEscalationKey(level: StorageLevel): number {
  const [track, setTrack] = useState({ level, key: 0 })
  let current = track
  if (track.level !== level) {
    // Derived during render (no effect, no extra frame): the new level, plus one pulse on a rise.
    current = { level, key: isEscalation(track.level, level) ? track.key + 1 : track.key }
    setTrack(current)
  }
  return current.key
}

/** Toasts once per escalation of the evidence volume state while the Storage page is mounted. */
export function useStorageAlerts(): void {
  const { t } = useTranslation()
  const level = useSim((s) => selectStorage(s).state) as StorageLevel
  const previous = useRef<StorageLevel>(level)
  useEffect(() => {
    const from = previous.current
    previous.current = level
    if (!isEscalation(from, level)) return
    if (level === 'FULL') {
      toast.danger(t('storage.toast.FULL'), { description: t('storage.toast.FULLDetail'), timeout: 0 })
    } else {
      toast.warning(t('storage.toast.LOW'), {
        description: t('storage.toast.LOWDetail', { percent: THRESHOLDS.low }),
      })
    }
  }, [level, t])
}
