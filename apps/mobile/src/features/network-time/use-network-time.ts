/**
 * Data hooks of the Network & Time screen (04_mobile_specs §4.14; 03_motion_spec M-PG-NET).
 *
 * Every `useSim` selector returns primitives or store-owned references (review 74 F74-13), so the
 * screen re-renders at most once per second (the 1 Hz health tick). Times come from the sim clock
 * (F74-09). Under the D43 test switch (`?motion=off`) the clock and the bandwidth window step once
 * per minute, so uiautomator can reach idle on this screen (the Home header does the same).
 */
import { useToast } from 'heroui-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { selectClockSecond, useSim } from '@dems/shared/sim';
import { useMotionState } from '@/motion';
import { reportRuntimeIssue } from '@/runtime';
import {
  bandwidthWindow,
  heldSecond,
  isTimeEscalation,
  selectNetworkView,
  selectTimeView,
  timeLevel,
  type BandwidthWindow,
  type NetworkView,
  type TimeLevel,
  type TimeView,
} from './network-time-model';

/** The D43 test switch (`?motion=off`). */
export function useTestSwitch(): boolean {
  return useMotionState((s) => s.linkMotion === 'off');
}

export function useTimeView(): TimeView {
  return useSim(selectTimeView);
}

export function useNetworkView(): NetworkView {
  return useSim(selectNetworkView);
}

/** The sim-clock epoch second shown by the screen (held to the minute under the test switch). */
export function useDisplaySecond(): number {
  const testSwitch = useTestSwitch();
  return useSim((s) => heldSecond(selectClockSecond(s), testSwitch));
}

/** The 12 bandwidth bars plus the newest down/up rates (the streaming N2 row). */
export function useBandwidthWindow(): BandwidthWindow {
  const testSwitch = useTestSwitch();
  const history = useSim((s) => s.network.bandwidth.history);
  const downMbps = useSim((s) => s.network.bandwidth.downMbps);
  const upMbps = useSim((s) => s.network.bandwidth.upMbps);
  const endAt = useSim((s) => (testSwitch ? Math.floor(s.clock.now / 60_000) * 60_000 : null));
  return useMemo(() => bandwidthWindow(history, { downMbps, upMbps }, endAt), [history, downMbps, upMbps, endAt]);
}

/**
 * A counter that increases on every escalation of `level` (one R8 pulse per step down the
 * hierarchy). Derived during render: no effect, no extra frame.
 */
export function useTimeEscalationKey(level: TimeLevel): number {
  const [track, setTrack] = useState({ level, key: 0 });
  let current = track;
  if (track.level !== level) {
    current = { level, key: isTimeEscalation(track.level, level) ? track.key + 1 : track.key };
    setTrack(current);
  }
  return current.key;
}

/**
 * M-PG-NET data moments (03M §7 GNSS_LOSS / RTC fallback; P7 calm escalation). A GNSS loss raises
 * one warning toast (the simulator writes the audit row), a further fall to the RTC a second one, and
 * a return to GNSS says so quietly. Nothing fires on mount, only on changes seen while the screen is
 * open. Copy: the shared `networkTime.toast.*` keys, the same words as the web page.
 */
export function useNetworkTimeAlerts(): void {
  const { t } = useTranslation();
  const { toast } = useToast();
  const level = useSim((s) => timeLevel(s.time.source));
  const server = useSim((s) => s.time.ntp.server);
  const previous = useRef<TimeLevel>(level);

  useEffect(() => {
    const from = previous.current;
    previous.current = level;
    if (from === level) return;
    try {
      if (level === 'FALLBACK' && from === 'LOCKED') {
        toast.show({ variant: 'warning', label: t('networkTime.toast.gnssLost'), description: t('networkTime.toast.gnssLostDetail', { server }) });
      } else if (level === 'HOLDOVER') {
        toast.show({ variant: 'warning', label: t('networkTime.toast.rtcHoldover'), description: t('networkTime.toast.rtcHoldoverDetail') });
      } else if (level === 'LOCKED') {
        toast.show({ variant: 'success', label: t('networkTime.toast.restored'), description: t('networkTime.toast.restoredDetail') });
      }
    } catch (error) {
      // The toast is feedback only; the tier row and chips already show the new level.
      reportRuntimeIssue('warn', 'network-time.alerts.toast', error, { from, to: level });
    }
  }, [level, server, t, toast]);
}
