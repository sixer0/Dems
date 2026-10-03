/**
 * M-PG-STOR data moment (04_mobile_specs §7.3 "Storage"; 03_motion_spec M-PG-STOR, §7 STORAGE_LOW /
 * FULL, R8): a rise of the evidence volume state (READY → LOW → FULL) morphs the ring colour with
 * ONE pulse, raises one toast and one haptic (`storageLow` warning, `criticalFault` error, §7.6).
 * Calm escalation: nothing loops, nothing fires on mount, a recovery only morphs the colour, and
 * the card's inline Alert carries the state for as long as it lasts (so the FULL toast need not
 * persist). Only while the screen is focused.
 */
import { useIsFocused } from 'expo-router';
import { useToast } from 'heroui-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StorageState } from '@dems/shared/domain';
import { triggerHaptic } from '@/motion';
import { THRESHOLDS, isEscalation } from './storage-model';

/** Toast durations (ms): LOW is a notice, FULL stays longer; the inline Alert remains either way. */
export const TOAST_MS = { LOW: 5_000, FULL: 10_000 } as const;

/** A counter that increases on every escalation of `level` (the ring's `pulseKey`). */
export function useEscalationKey(level: StorageState): number {
  const [track, setTrack] = useState({ level, key: 0 });
  let current = track;
  if (track.level !== level) {
    // Derived during render (no effect, no extra frame): the new level, plus one pulse on a rise.
    current = { level, key: isEscalation(track.level, level) ? track.key + 1 : track.key };
    setTrack(current);
  }
  return current.key;
}

/** One toast and one haptic per escalation seen while the screen is focused. */
export function useStorageAlerts(level: StorageState): void {
  const { t } = useTranslation();
  const { toast } = useToast();
  const focused = useIsFocused();
  const previous = useRef<StorageState>(level);

  useEffect(() => {
    const from = previous.current;
    previous.current = level;
    if (!focused || !isEscalation(from, level)) return;
    if (level === 'FULL') {
      triggerHaptic('criticalFault');
      toast.show({ variant: 'danger', label: t('storage.toast.FULL'), description: t('storage.toast.FULLDetail'), duration: TOAST_MS.FULL });
    } else {
      triggerHaptic('storageLow');
      toast.show({
        variant: 'warning',
        label: t('storage.toast.LOW'),
        description: t('storage.toast.LOWDetail', { percent: THRESHOLDS.low }),
        duration: TOAST_MS.LOW,
      });
    }
  }, [level, focused, toast, t]);
}
