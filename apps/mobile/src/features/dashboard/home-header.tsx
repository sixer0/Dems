/**
 * H1 header (04_mobile_specs §4.3; §2.3 "Header" row).
 *
 * - `compact` (phone portrait, MB 2 (355–590, 40–78)): Emblem (32 dp) + two-line wordmark on the
 *   left; bell and avatar on the right.
 * - `compact-landscape`: the condensed 48 dp header (emblem 24 dp, one-line wordmark).
 * - `medium` / `expanded`: the 64 dp content-column header: title (Inter SemiBold 20) and status
 *   chips on the right; `expanded` adds the Core link chip and the clock (C-6 RollingNumber).
 *
 * The bell opens a kit `Popover` with the latest alerts; the avatar (initials "BS", 04 §9 #29)
 * opens a kit `Menu`: Profile, Lock console, Sign out. Sign-out never touches a recording (§3.3).
 *
 * Backend task W66 (04_client_integration_spec §3.2, MD-8, MD-9, §7.4):
 * - The Core link chip takes the one rule of `features/more/use-core-link-chip.ts` (More's footer
 *   takes the same): "Simulated" in SIMULATED and HEARTBEAT mode, "Live" only in LIVE mode, and in
 *   LIVE "Offline" by the runtime's no-flicker rule (row M0).
 * - MD-9: in LIVE mode the chip is in the header of every layout class; in SIMULATED and HEARTBEAT
 *   mode it stays on the expanded header only, so no Simulated layout changes.
 * - Acknowledging an alert (operation 70) is fire-and-forget: the actions come from
 *   `useCoreActions()` in both modes (AC-C-53), and a rejection goes to the refusal presenter first
 *   (a denial or an outage gets the app's one toast), then to the runtime log.
 */
import { useRouter } from 'expo-router';
import { Avatar, Button, Chip, LinkButton, Menu, Popover } from 'heroui-native';
import { Bell } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { formatDate, formatUtcOffset } from '@dems/shared/realtime';
import { settle, useCoreActions } from '@dems/shared/live';
import { selectClockSecond, useSim, type SimAlert } from '@dems/shared/sim';
import { fontFamily, palette, toneTextHex, typography, type StatusTone } from '@dems/shared/tokens';
import { useAuthSession } from '@/auth';
import { RollingNumber } from '@/components/composed/rolling-number';
import { StatusChip } from '@/components/kit';
import { Emblem } from '@/components/media/emblem';
import type { LayoutClass } from '@/layout';
import { useMotionPolicy, useMotionSettings, useMotionState } from '@/motion';
import { captureNoticeTitle } from '@/features/capture-selector/capture-notices-model';
import { useFailedStart } from '@/features/session-live/capture-start-notice';
import { useCoreLinkChip } from '@/features/more/use-core-link-chip';
import { reportRuntimeIssue, useAuth, useCoreErrorPresenter, useCoreLink } from '@/runtime';
import { clockText, displaySecondsOfDay, failedStartAlertLabel, type HomeStatus } from './home-model';
import { HOME_BEATS, homeEnter } from './home-motion';
import { useAlertSummary } from './use-home-data';

export interface HomeHeaderProps {
  layoutClass: LayoutClass;
  status: HomeStatus;
}

export function HomeHeader({ layoutClass, status }: HomeHeaderProps) {
  const { t } = useTranslation();
  const settings = useMotionSettings();
  const tablet = layoutClass === 'medium' || layoutClass === 'expanded';
  const condensed = layoutClass === 'compact-landscape';
  // MD-9: in LIVE the Core link chip is in every layout class; otherwise on the expanded header only.
  const live = useCoreLink().source === 'LIVE';

  return (
    <Animated.View
      testID="home-header"
      entering={homeEnter(HOME_BEATS.header, settings)}
      style={[styles.row, tablet ? styles.tablet : condensed ? styles.condensed : styles.compact]}
    >
      {tablet ? (
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} style={styles.title}>
          {t('features.dashboard.title')}
        </Text>
      ) : (
        <Brand condensed={condensed} />
      )}
      <View style={styles.actions}>
        {tablet ? (
          <StatusChip
            testID="home-header-state"
            className="self-center"
            tone={status.tone}
            label={t(`common.systemState.${status.kind}`)}
            icon={null}
            size="sm"
          />
        ) : null}
        {layoutClass === 'expanded' || live ? <CoreLinkChip /> : null}
        {layoutClass === 'expanded' ? <HeaderClock /> : null}
        <AlertsBell />
        <AccountMenu />
      </View>
    </Animated.View>
  );
}

/** Emblem + wordmark (MB 2: gold "DEMS" over "EDGE CLIENT"; condensed: one line). */
function Brand({ condensed }: { condensed: boolean }) {
  const { t } = useTranslation();
  return (
    <View
      testID="home-brand"
      accessible
      accessibilityRole="header"
      accessibilityLabel={t('common.brand.name')}
      style={styles.brand}
    >
      <Emblem size={condensed ? 24 : 32} />
      {condensed ? (
        <Text maxFontSizeMultiplier={1.2} style={styles.wordmarkInline}>
          {t('common.brand.wordmark')}
        </Text>
      ) : (
        <View>
          <Text maxFontSizeMultiplier={1.2} style={styles.wordmarkTop}>
            {t('features.dashboard.header.wordmarkTop')}
          </Text>
          <Text maxFontSizeMultiplier={1.2} style={styles.wordmarkBottom}>
            {t('features.dashboard.header.wordmarkBottom')}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * Core link chip (§2.3; W66 MD-8): Simulated (default, Q-M8; also with the mock-core heartbeat),
 * Live (LIVE mode only) or Offline. The word, tone and icon are `useCoreLinkChip()`'s.
 */
function CoreLinkChip() {
  const { t } = useTranslation();
  const chip = useCoreLinkChip();
  const word = t(`common.status.${chip.word}`);
  return (
    <StatusChip
      testID="home-core-link"
      tone={chip.tone}
      label={t('features.dashboard.header.coreLink', { state: word })}
      accessibilityLabel={t('features.dashboard.header.coreLinkLabel', {
        state: word,
        source: t(`mobile.coreLink.source.${chip.source}`),
      })}
      icon={chip.icon}
      size="sm"
      className="self-center"
    />
  );
}

/**
 * The simulator clock at UTC+07:00, rolling once per second (C-6 `slide`, 04 §7.4 M-C-02). Under
 * the D43 test switch (`?motion=off`) it steps once per minute, so uiautomator can reach idle on
 * this screen (MA-12); OS reduce-motion keeps the seconds (the digits then jump, 03M §8).
 */
function HeaderClock() {
  const { t } = useTranslation();
  const policy = useMotionPolicy();
  const testSwitch = useMotionState((s) => s.linkMotion === 'off');
  const second = useSim((s) => (testSwitch ? Math.floor(selectClockSecond(s) / 60) * 60 : selectClockSecond(s)));
  const secondsOfDay = displaySecondsOfDay(second);
  return (
    <View
      testID="home-clock"
      accessible
      accessibilityLabel={t('features.dashboard.header.clockLabel', { time: clockText(secondsOfDay), offset: formatUtcOffset() })}
    >
      <RollingNumber value={secondsOfDay} mode="slide" format={{ kind: 'clock' }} motion={policy} size="h3" face="mono" color={palette.gold} />
    </View>
  );
}

const SEVERITY_TONE: Record<SimAlert['severity'], StatusTone> = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  CRITICAL: 'danger',
};

/** Bell with the unacknowledged count; opens the latest alerts (kit Popover, H1). */
function AlertsBell() {
  const { t } = useTranslation();
  const router = useRouter();
  const actions = useCoreActions();
  const presentCoreError = useCoreErrorPresenter();
  const { count, alerts } = useAlertSummary();
  // Pass D7 item 3: the failed start of the open session (the generic sentence needs it; "no camera" is read from the alert).
  const failedStart = useFailedStart();
  const [open, setOpen] = useState(false);

  // Fire-and-forget (§7.4; CL-24): nothing reads the result. A refusal or an outage of the Core
  // server is worded by the presenter (AC-C-48: a denial names the role when the operation has one);
  // anything else is logged, as before.
  const acknowledge = (id: string) => {
    settle(() => actions.acknowledgeAlert(id), {
      fail: (error) => {
        if (presentCoreError(error)) return;
        reportRuntimeIssue('warn', 'dashboard.alerts.acknowledge', error, { alertId: id });
      },
    });
  };

  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          testID="home-bell"
          isIconOnly
          size="lg"
          variant="ghost"
          accessibilityLabel={
            count > 0
              ? `${t('shell.notifications.button')}, ${t('shell.notifications.count', { count })}`
              : t('shell.notifications.button')
          }
          accessibilityHint={t('features.dashboard.header.notificationsHint')}
        >
          <Bell size={24} color={palette.gold} fill={count > 0 ? palette.gold : 'none'} />
          {count > 0 ? (
            <View pointerEvents="none" style={styles.badge}>
              <Chip testID="home-bell-count" size="sm" color="danger" variant="primary">
                <Chip.Label>{count > 9 ? '9+' : String(count)}</Chip.Label>
              </Chip>
            </View>
          ) : null}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Overlay />
        <Popover.Content presentation="popover" width={300} placement="bottom" align="end" className="gap-2 rounded-xl px-4 py-3">
          <Popover.Title>{t('shell.notifications.title')}</Popover.Title>
          <View testID="home-alerts" style={styles.alertList}>
            {alerts.length === 0 ? (
              <Popover.Description>{t('shell.notifications.empty')}</Popover.Description>
            ) : (
              alerts.map((alert) => (
                <View key={alert.id} testID={`home-alert-${alert.id}`} style={styles.alertRow}>
                  <View style={[styles.alertDot, { backgroundColor: toneTextHex[SEVERITY_TONE[alert.severity]] }]} />
                  <Text style={styles.alertText} numberOfLines={2}>
                    {t('features.dashboard.alerts.line', {
                      // Task 3 row 138 (ux §8e.1): a no-device notice is worded from `params.reason`, with the device's label.
                      label: failedStartAlertLabel(t, alert, failedStart) ?? captureNoticeTitle(t, alert) ?? (alert.kind === 'SYSTEM' ? alert.message : t(`common.faultKind.${alert.kind}`, { defaultValue: alert.message })),
                      time: formatDate(alert.at, 'HH:mm:ss'),
                    })}
                  </Text>
                  {!alert.acknowledged ? (
                    <Button size="sm" variant="ghost" onPress={() => acknowledge(alert.id)}>
                      <Button.Label>{t('common.actions.acknowledge')}</Button.Label>
                    </Button>
                  ) : null}
                </View>
              ))
            )}
          </View>
          <LinkButton
            testID="home-alerts-view-all"
            onPress={() => {
              setOpen(false);
              router.push('/audit');
            }}
          >
            {t('shell.notifications.viewAll')}
          </LinkButton>
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  );
}

/** Avatar → Profile, Lock console, Sign out (kit Menu, H1). */
function AccountMenu() {
  const { t } = useTranslation();
  const router = useRouter();
  const auth = useAuth();
  const session = useAuthSession();
  const operator = auth.operator;
  if (!operator) return null;

  return (
    <Menu>
      <Menu.Trigger asChild>
        <Button
          testID="home-avatar"
          isIconOnly
          size="lg"
          variant="ghost"
          accessibilityLabel={t('features.dashboard.header.accountLabel', { name: operator.displayName })}
          accessibilityHint={t('features.dashboard.header.accountHint')}
        >
          <Avatar size="md" color="accent" variant="soft" alt={operator.displayName}>
            <Avatar.Fallback>{operator.initials}</Avatar.Fallback>
          </Avatar>
        </Button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Overlay />
        <Menu.Content presentation="popover" width={240} placement="bottom" align="end">
          <Menu.Label>{operator.displayName}</Menu.Label>
          <Text style={styles.menuRole}>
            {t('shell.userMenu.role', { role: t(`common.roles.${operator.role}`) })}
          </Text>
          <Menu.Item testID="home-menu-profile" onPress={() => router.push('/settings')}>
            <Menu.ItemTitle>{t('shell.userMenu.profile')}</Menu.ItemTitle>
          </Menu.Item>
          <Menu.Item testID="home-menu-lock" onPress={() => session.lockConsole()}>
            <Menu.ItemTitle>{t('shell.userMenu.lockConsole')}</Menu.ItemTitle>
          </Menu.Item>
          <Menu.Item testID="home-menu-sign-out" variant="danger" onPress={() => auth.signOut('USER')}>
            <Menu.ItemTitle>{t('shell.userMenu.signOut')}</Menu.ItemTitle>
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  compact: { minHeight: 56, paddingHorizontal: 16, paddingTop: 4 },
  condensed: { height: 48, paddingHorizontal: 16 },
  tablet: { height: 64, paddingHorizontal: 24 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  wordmarkTop: {
    fontFamily: fontFamily.native.display,
    fontSize: 22,
    lineHeight: 24,
    letterSpacing: 1,
    color: palette.gold,
  },
  wordmarkBottom: {
    fontFamily: fontFamily.native.display,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    color: palette.gold,
  },
  wordmarkInline: {
    fontFamily: fontFamily.native.display,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 1,
    color: palette.gold,
  },
  title: {
    fontFamily: fontFamily.native.semibold,
    fontSize: typography.h2.size,
    lineHeight: typography.h2.lineHeight,
    color: palette.foreground,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badge: { position: 'absolute', top: 2, right: 0 },
  alertList: { gap: 8 },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  alertDot: { width: 8, height: 8, borderRadius: 4 },
  alertText: {
    flex: 1,
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.foreground,
  },
  menuRole: {
    paddingHorizontal: 12,
    paddingBottom: 6,
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
  },
});
