/**
 * N4 System Time (04_mobile_specs §4.14; MB 9 (945–1190, 910–975)): clock ring icon, the date in
 * gold ("Thu, 1 Oct 2026"), the C-6 RollingNumber `slide` clock in the Orbitron readout (32/40) and a
 * `StatusChip` "Synchronized" while a disciplined source (GNSS or NTP) holds the clock ("Free-running"
 * on the RTC, warning, P7). DR-86-3: the chip sits in the card header, not right of the clock as in
 * MB 9: the Orbitron clock is ~170 dp wide, so ring + clock + chip overflowed a phone card and a
 * tablet pane (device check, tablet 3-pane).
 *
 * All times are the sim clock at UTC+07:00 through the shared arithmetic formatters (`formatDate`,
 * `formatClock`; D28/Q2, H-MB-08). The digits roll once per second (03M M-C-02); under the D43 test
 * switch they step once per minute (uiautomator idle).
 */
import { Clock3 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { DATE_PATTERNS, formatClock, formatDate, formatUtcOffset } from '@dems/shared/realtime';
import { fontFamily, palette, typography } from '@dems/shared/tokens';
import { RollingNumber } from '@/components/composed/rolling-number';
import { SectionCard, StatusChip } from '@/components/kit';
import { withAlpha } from '@/components/media';
import { useMotionPolicy } from '@/motion';
import { displaySecondsOfDay } from './network-time-model';
import { useDisplaySecond } from './use-network-time';

const CLOCK_FORMAT = { kind: 'clock' } as const;
const RING = 56;

export interface SystemTimeCardProps {
  /** A disciplined source (GNSS or NTP) holds the clock. */
  synchronized: boolean;
  /** Closing pass J (G75b-06): the time is the host system clock - the chip names it; it is neither "Synchronized" nor "Free-running". */
  hostClock?: boolean;
  /** `hero` (tablet): a little more air around the readout. */
  variant?: 'card' | 'hero';
}

export function SystemTimeCard({ synchronized, hostClock = false, variant = 'card' }: SystemTimeCardProps) {
  const { t } = useTranslation();
  const policy = useMotionPolicy();
  // Subscribed here, not in the screen, so only this card re-renders on the 1 Hz clock (R8).
  const second = useDisplaySecond();
  const ms = second * 1_000;
  const date = formatDate(ms, DATE_PATTERNS.weekdayDate);
  const clock = formatClock(ms);
  const zone = t('networkTime.systemTime.zone', { offset: formatUtcOffset() });
  const chipLabel = hostClock ? t('common.hostClockTime.value') : synchronized ? t('features.network-time.systemTime.synchronized') : t('features.network-time.systemTime.freeRunning');

  return (
    <SectionCard
      testID="network-time-system-time"
      title={t('networkTime.systemTime.title')}
      action={
        <StatusChip
          testID="network-time-system-chip"
          tone={hostClock ? 'default' : synchronized ? 'success' : 'warning'}
          label={chipLabel}
          icon="Circle"
          iconFilled
          size="sm"
        />
      }
    >
      <View style={[styles.row, variant === 'hero' ? styles.rowHero : null]}>
        <View style={styles.ring}>
          <Clock3 size={28} color={palette.foreground} strokeWidth={1.5} />
        </View>
        <View
          testID="network-time-clock"
          accessible
          accessibilityLabel={t('features.network-time.systemTime.clockLabel', { time: clock, zone, date })}
          style={styles.readout}
        >
          <Text testID="network-time-date" maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.date}>
            {date}
          </Text>
          <RollingNumber
            testID="network-time-clock-digits"
            value={displaySecondsOfDay(second)}
            mode="slide"
            format={CLOCK_FORMAT}
            motion={policy}
            size="display"
            face="display"
            accessibilityLabel={clock}
          />
        </View>
      </View>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowHero: { paddingVertical: 8 },
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: withAlpha(palette.gold, 0.45),
    backgroundColor: withAlpha(palette.gold, 0.05),
  },
  readout: { flex: 1, minWidth: 0, gap: 2 },
  date: {
    fontFamily: fontFamily.native.medium,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
    color: palette.gold,
  },
});
