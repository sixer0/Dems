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
import { SEAL_UNSEALABLE_PLAIN_SENTENCE, isUnsealableAlert, selectClockSecond, useSim, type SimAlert } from '@dems/shared/sim';
import { fontFamily, palette, toneTextHex, typography, type StatusTone } from '@dems/shared/tokens';
import { useAuthSession } from '@/auth';
import { RollingNumber } from '@/components/composed/rolling-number';
import { StatusChip } from '@/components/kit';
import { Emblem } from '@/components/media/emblem';
import type { LayoutClass } from '@/layout';
import { useMotionPolicy, useMotionSettings, useMotionState } from '@/motion';
import { captureFaultLine, captureNoticeTitle } from '@/features/capture-selector/capture-notices-model';
import { useFailedStart } from '@/features/session-live/capture-start-notice';
import { useConnectingCameras } from '@/features/session-live/rec-indicator';
import { useCoreLinkChip } from '@/features/more/use-core-link-chip';
import { reportRuntimeIssue, useAuth, useCoreErrorPresenter, useCoreLink } from '@/runtime';
import { clockText, displaySecondsOfDay, failedStartAlertLabel, type HomeStatus } from './home-model';
import { HOME_BEATS, homeEnter } from './home-motion';
import { useCanCloseNotice, useOpenNotices } from '@/features/session-finalizing/open-notice';
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

  const connectingCameras = useConnectingCameras();
  const connecting = connectingCameras && status.kind === 'RECORDING';
  // Fix wave L (G75d-01): READY with an open unsealable notice is "OPEN NOTICE" (amber), never plain "READY".
  const noticed = useOpenNotices().length > 0 && status.kind === 'READY';
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
            // Fix wave K (G75c-07; ux 8e.2): before the first durable fragment nothing is recorded - the chip says
            // CONNECTING in a neutral tone, as the System Status card does, never RECORDING.
            tone={connecting ? 'default' : noticed ? 'warning' : status.tone}
            label={connecting ? t('common.session.trackConnecting') : noticed ? t('features.session-finalizing.openNotice.chip') : t(`common.systemState.${status.kind}`)}
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
  // Fix wave L (G75d-01): an open unsealable notice is closed HERE, by the role whose acknowledgement closes it
  // (operation 70; also when somebody already acknowledged it and it stayed open).
  const canCloseNotice = useCanCloseNotice();
  // An open notice somebody acknowledged without closing it still counts on the bell: it is open.
  const openAcknowledged = useOpenNotices().filter((notice) => notice.acknowledged).length;
  const shownCount = count + openAcknowledged;

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
            shownCount > 0
              ? `${t('shell.notifications.button')}, ${t('shell.notifications.count', { count: shownCount })}`
              : t('shell.notifications.button')
          }
          accessibilityHint={t('features.dashboard.header.notificationsHint')}
        >
          <Bell size={24} color={palette.gold} fill={shownCount > 0 ? palette.gold : 'none'} />
          {shownCount > 0 ? (
            <View pointerEvents="none" style={styles.badge}>
              <Chip testID="home-bell-count" size="sm" color="danger" variant="primary">
                <Chip.Label>{shownCount > 9 ? '9+' : String(shownCount)}</Chip.Label>
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
              alerts.map((alert) => {
                const unsealable = isUnsealableAlert(alert);
                const sessionId = alert.params?.['sessionId'];
                const cause = alert.params?.['cause'];
                // G75d-01: the open notice of ITS session, without the code as a sentence; the code is a detail.
                const noticeLabel = unsealable ? t('features.session-finalizing.openNotice.alertLine', { sessionId: typeof sessionId === 'string' ? sessionId : (alert.target ?? ''), sentence: SEAL_UNSEALABLE_PLAIN_SENTENCE }) : null;
                // The supervisor's acknowledgement closes it - offered while it is open, acknowledged before or not.
                const closes = unsealable && canCloseNotice;
                return (
                  <View key={alert.id} testID={`home-alert-${alert.id}`} style={unsealable ? styles.alertNotice : styles.alertRow}>
                    <View style={styles.alertRow}>
                      <View style={[styles.alertDot, { backgroundColor: toneTextHex[unsealable ? 'warning' : SEVERITY_TONE[alert.severity]] }]} />
                      <Text style={styles.alertText} numberOfLines={unsealable ? 5 : 2}>
                        {t('features.dashboard.alerts.line', {
                          // Task 3 row 138 (ux §8e.1): a no-device notice is worded from `params.reason`, with the device's label.
                          label:
                            noticeLabel ??
                            failedStartAlertLabel(t, alert, failedStart) ??
                            captureFaultLine(t, alert) ??
                            captureNoticeTitle(t, alert) ??
                            (alert.kind === 'SYSTEM' ? alert.message : t(`common.faultKind.${alert.kind}`, { defaultValue: alert.message })),
                          time: formatDate(alert.at, 'HH:mm:ss'),
                        })}
                      </Text>
                      {/* Any other alert: its button beside the line, as before. */}
                      {!unsealable && !alert.acknowledged ? (
                        <Button size="sm" variant="ghost" onPress={() => acknowledge(alert.id)} testID={`home-alert-${alert.id}-acknowledge`}>
                          <Button.Label>{t('common.actions.acknowledge')}</Button.Label>
                        </Button>
                      ) : null}
                    </View>
                    {unsealable ? (
                      <Text style={styles.alertDetail} testID={`home-alert-${alert.id}-notice`}>
                        {[typeof cause === 'string' ? t('features.session-finalizing.openNotice.cause', { cause }) : null, closes ? null : t('features.session-finalizing.openNotice.closeBySupervisor')].filter((part): part is string => part !== null).join(' ')}
                      </Text>
                    ) : null}
                    {/* The notice keeps the whole width for its sentence; its button stands under it. */}
                    {unsealable && (closes || !alert.acknowledged) ? (
                      <View style={styles.alertNoticeAction}>
                        <Button size="sm" variant={closes ? 'outline' : 'ghost'} onPress={() => acknowledge(alert.id)} testID={`home-alert-${alert.id}-acknowledge`}>
                          <Button.Label>{closes ? t('features.session-finalizing.openNotice.acknowledge') : t('common.actions.acknowledge')}</Button.Label>
                        </Button>
                      </View>
                    ) : null}
                  </View>
                );
              })
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
  alertNotice: { gap: 4 },
  alertNoticeAction: { flexDirection: 'row', justifyContent: 'flex-end' },
  alertDetail: {
    paddingLeft: 16,
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
  },
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
