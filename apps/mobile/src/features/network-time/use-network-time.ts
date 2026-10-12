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
import { isHostClockTime, isOwnCaptureCoreState, selectClockSecond, useSim } from '@dems/shared/sim';
import { useSourceBadgeMode } from '@/features/capture-selector/development-source-badge';
import { useMotionState } from '@/motion';
import { reportRuntimeIssue } from '@/runtime';
import {
  bandwidthWindow,
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

/**
 * Fix wave J (JT-03 / JW-04; truth rules 3c, 3f; THE ONE RULE): the Core this client shows is in its own
 * capture, so the simulator's network model (LAN name and address, gateway, PoE ports and watts, the
 * bandwidth figure) is no fact of it. Live data AND (a Core that states a source class on a capture device,
 * the mark of real capture, D91 R-2) OR the Core's own statement of itself,
 * `isOwnCaptureCoreState` (contract_wave_j.md J-S 7: `time.hostClock` or `security.platformNotReported`).
 * False in Simulated client mode and for a simulated Core: unchanged there.
 */
export function networkNotReported(state: Parameters<typeof isOwnCaptureCoreState>[0] & { readonly captureDevices: { readonly devices: readonly { readonly sourceClass?: string | null | undefined }[] } }, live: boolean): boolean {
  if (!live) return false;
  // A Core whose device list is not there yet states nothing either way: its card is not rewritten on that alone.
  return state.captureDevices.devices.some((device) => device.sourceClass !== undefined && device.sourceClass !== null) || isOwnCaptureCoreState(state);
}

export function useNetworkNotReported(): boolean {
  const { live } = useSourceBadgeMode();
  return useSim((s) => networkNotReported(s, live));
}

/**
 * The sim-clock epoch second shown by the screen. Fix wave J (JA2-34): the READOUT is the true second in
 * every motion mode - under the D43 test switch only the digit animation is held (the card passes the
 * reduced policy to its digits), never the value. It read hh:mm:00 for the whole minute.
 */
export function useDisplaySecond(): number {
  return useSim((s) => selectClockSecond(s));
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
  // Closing pass J (G75b-06): a host system clock is no fall of a time service - no "RTC holdover" toast.
  const hostClock = useSim((s) => isHostClockTime(s.time));
  const previous = useRef<TimeLevel>(level);

  useEffect(() => {
    const from = previous.current;
    previous.current = level;
    if (from === level || hostClock) return;
    try {
      // Fix wave J (JA2-05, J-P's app-wide alert toasts; truth rule 3c - ONE statement per fact): the GNSS loss and
      // the RTC fallback are active alerts, and the app's alert-toast consumer (`features/alerts`) raises their one
      // toast on EVERY screen. This screen raised a second one for the same fact, so it no longer does. The quiet
      // "GNSS lock restored" stays: no alert covers a recovery.
      if (level === 'LOCKED') {
        toast.show({ variant: 'success', label: t('networkTime.toast.restored'), description: t('networkTime.toast.restoredDetail') });
      }
    } catch (error) {
      // The toast is feedback only; the tier row and chips already show the new level.
      reportRuntimeIssue('warn', 'network-time.alerts.toast', error, { from, to: level });
    }
  }, [level, hostClock, t, toast]);
}
