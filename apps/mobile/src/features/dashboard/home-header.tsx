/**
 * H1 header (04_mobile_specs §4.3; §2.3 "Header" row).
 *
 * - `compact` (phone portrait, MB 2 (355–590, 40–78)): Emblem (32 dp) + two-line wordmark on the
 *   left; bell and avatar on the right.
 * - `compact-landscape`: the condensed 48 dp header (emblem 24 dp, one-line wordmark).
 * - `medium` / `expanded`: the 64 dp content-column header: title (Inter SemiBold 20) and status
 *   chips on the right; `expanded` adds the Core link chip and the clock (C-6 RollingNumber).
 *
 * The bell opens the open alerts and the avatar (initials "BS", 04 §9 #29) the account actions
 * (Settings and profile, Lock console, Sign out) - both as a kit sheet (`SheetFrame`) in EVERY layout
 * class since the closing pass of fix wave J (the kit `Popover` / `Menu` put no node of their content
 * into the Android accessibility tree). Sign-out never touches a recording (§3.3).
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
import { Avatar, Button, Chip, LinkButton } from 'heroui-native';
import { Bell } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { formatDate, formatUtcOffset } from '@dems/shared/realtime';
import { settle, useCoreActions } from '@dems/shared/live';
import { isUnsealableAlert, selectClockSecond, useSim, type SimAlert } from '@dems/shared/sim';
import { fontFamily, palette, toneTextHex, typography, type StatusTone } from '@dems/shared/tokens';
import { useAuthSession } from '@/auth';
import { RollingNumber } from '@/components/composed/rolling-number';
import { StatusChip } from '@/components/kit';
import { Emblem } from '@/components/media/emblem';
import type { LayoutClass } from '@/layout';
import { useMotionPolicy, useMotionSettings, useMotionState } from '@/motion';
import { alertLabel } from '@/features/alerts/alert-label';
import { useFailedStart } from '@/features/session-live/capture-start-notice';
import { useCoreLinkChip } from '@/features/more/use-core-link-chip';
import { reportRuntimeIssue, useAuth, useCoreErrorPresenter, useCoreLink } from '@/runtime';
import { clockText, displaySecondsOfDay, homeChipKey, type HomeStatus } from './home-model';
import { HOME_BEATS, homeEnter } from './home-motion';
import { useCanCloseNotice, useOpenNotices } from '@/features/session-finalizing/open-notice';
import { useAlertSummary } from './use-home-data';
// Round two, ruling (a) (JA2-16): the Settings sheets' frame is the one whose content IS in the Android accessibility tree
// (read with `uiautomator dump` on the phone: every element under its own name) and that Android Back closes.
import { SheetFrame } from '@/features/settings/sheet-frame';

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
            // Fix wave K (G75c-07; ux 8e.2): before the first durable fragment nothing is recorded - the chip says
            // "Connecting" in a neutral tone, as the System Status card does, never RECORDING.
            // Fix wave J (JA2-04 / JT-01; truth rule 3c): the chip is the card's statement (`homeStatusOf`) - OFFLINE
            // while the Core link is down, ATTENTION from the first failed step of a seal, never READY beside either.
            tone={status.tone}
            label={t(homeChipKey(status))}
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

/**
 * Bell with the unacknowledged count; opens the open alerts.
 *
 * Round two, ruling (a) (JA2-16 remainder): on the PHONE the list is a bottom sheet - a scrolling surface is a
 * sheet in both motion modes (the JM-08 ruling) - whose rows, buttons and link are separate, labelled nodes of
 * the accessibility tree, and Android Back closes it without leaving the app. The kit `Popover` of round one
 * put no node of its content into that tree.
 *
 * Fix wave J closing pass (J4, item 5; note 171 decision 2, "JA2-16 on the tablet"): the TABLET takes the same
 * sheet - it kept the anchored `Popover`, whose content a screen reader could not reach. One form for every
 * layout class; the popover branch is gone.
 */
function AlertsBell() {
  const { t } = useTranslation();
  const router = useRouter();
  const actions = useCoreActions();
  const presentCoreError = useCoreErrorPresenter();
  const { count, alerts, total } = useAlertSummary();
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

  const bellLabel = shownCount > 0 ? `${t('shell.notifications.button')}, ${t('shell.notifications.count', { count: shownCount })}` : t('shell.notifications.button');
  const bellFace = (
    <>
      <Bell size={24} color={palette.gold} fill={shownCount > 0 ? palette.gold : 'none'} />
      {shownCount > 0 ? (
        <View pointerEvents="none" style={styles.badge}>
          <Chip testID="home-bell-count" size="sm" color="danger" variant="primary">
            <Chip.Label>{shownCount > 9 ? '9+' : String(shownCount)}</Chip.Label>
          </Chip>
        </View>
      ) : null}
    </>
  );
  const empty = t('shell.notifications.empty');
  const more = total > alerts.length ? t('features.dashboard.alerts.more', { shown: alerts.length, total }) : null;
  const rows = (
    <View testID="home-alerts" style={styles.alertList}>
      {alerts.map((alert) => {
        const unsealable = isUnsealableAlert(alert);
        const cause = alert.params?.['cause'];
        // The supervisor's acknowledgement closes it - offered while it is open, acknowledged before or not.
        const closes = unsealable && canCloseNotice;
        // ONE wording for the bell and the alert's toast (`alertLabel`; fix wave J, JA2-05).
        const line = `${t('features.dashboard.alerts.line', { label: alertLabel(t, alert, failedStart), time: formatDate(alert.at, 'HH:mm:ss') })}${alert.active ? '' : ` · ${t('features.dashboard.alerts.resolved')}`}`;
        const acknowledgeLabel = closes ? t('features.session-finalizing.openNotice.acknowledge') : t('common.actions.acknowledge');
        return (
          <View key={alert.id} testID={`home-alert-${alert.id}`} style={unsealable ? styles.alertNotice : styles.alertRow}>
            <View style={styles.alertRow}>
              <View style={[styles.alertDot, { backgroundColor: toneTextHex[unsealable ? 'warning' : SEVERITY_TONE[alert.severity]] }]} />
              {/* JT-12: the sentence is never cut after two lines - the cause is in its second half. */}
              <Text style={styles.alertText} numberOfLines={unsealable ? 5 : 4}>
                {line}
              </Text>
              {/* Any other alert: its button beside the line, as before. */}
              {!unsealable && !alert.acknowledged ? (
                <Button size="sm" variant="ghost" onPress={() => acknowledge(alert.id)} testID={`home-alert-${alert.id}-acknowledge`} accessibilityLabel={`${acknowledgeLabel}: ${line}`}>
                  <Button.Label>{acknowledgeLabel}</Button.Label>
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
                <Button size="sm" variant={closes ? 'outline' : 'ghost'} onPress={() => acknowledge(alert.id)} testID={`home-alert-${alert.id}-acknowledge`} accessibilityLabel={`${acknowledgeLabel}: ${line}`}>
                  <Button.Label>{acknowledgeLabel}</Button.Label>
                </Button>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
  const viewAll = () => {
    setOpen(false);
    router.push('/audit');
  };

  return (
    <>
      <Button testID="home-bell" isIconOnly size="lg" variant="ghost" accessibilityLabel={bellLabel} accessibilityHint={t('features.dashboard.header.notificationsHint')} onPress={() => setOpen(true)}>
        {bellFace}
      </Button>
      <SheetFrame isOpen={open} onClose={() => setOpen(false)} title={t('shell.notifications.title')} testID="home-alerts-sheet">
        {alerts.length === 0 ? (
          <Text style={styles.sheetText} testID="home-alerts-empty">
            {empty}
          </Text>
        ) : (
          // JA2-25: the list scrolls - every open alert can be reached and acknowledged.
          // A plain scroll view of a capped height inside the content-sized sheet: the sheet library's own scroll view
          // left the sheet parked at the bottom edge of the phone (seen live; the Settings frame's note says the same).
          <ScrollView testID="home-alerts-scroll" nestedScrollEnabled style={styles.alertSheetScroll} contentContainerStyle={styles.alertList}>
            {rows}
          </ScrollView>
        )}
        {more !== null ? (
          <Text style={styles.sheetText} testID="home-alerts-more">
            {more}
          </Text>
        ) : null}
        <LinkButton testID="home-alerts-view-all" onPress={viewAll}>
          {t('shell.notifications.viewAll')}
        </LinkButton>
      </SheetFrame>
    </>
  );
}

/**
 * Avatar → Settings and profile, Lock console, Sign out.
 * Round two, ruling (a): on the PHONE the three actions are a bottom sheet of labelled buttons (see `AlertsBell`).
 * Closing pass J4, item 5: the same sheet on the TABLET (it kept the kit `Menu`, whose items were not in the
 * accessibility tree).
 */
function AccountMenu() {
  const { t } = useTranslation();
  const router = useRouter();
  const auth = useAuth();
  const session = useAuthSession();
  const [open, setOpen] = useState(false);
  const operator = auth.operator;
  if (!operator) return null;
  const roleLine = t('shell.userMenu.role', { role: t(`common.roles.${operator.role}`) });
  const avatar = (
    <Avatar size="md" color="accent" variant="soft" alt={operator.displayName}>
      <Avatar.Fallback>{operator.initials}</Avatar.Fallback>
    </Avatar>
  );
  const accountLabel = t('features.dashboard.header.accountLabel', { name: operator.displayName });

  // The actions run AFTER the sheet is asked to close: a sign-out unmounts this header with the sheet.
  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };
  return (
    <>
      <Button testID="home-avatar" isIconOnly size="lg" variant="ghost" accessibilityLabel={accountLabel} accessibilityHint={t('features.dashboard.header.accountHint')} onPress={() => setOpen(true)}>
        {avatar}
      </Button>
      <SheetFrame isOpen={open} onClose={() => setOpen(false)} title={operator.displayName} description={roleLine} testID="home-account-sheet">
        <Button testID="home-menu-profile" variant="outline" onPress={run(() => router.push('/settings'))} accessibilityLabel={t('features.dashboard.header.menuSettings')}>
          <Button.Label>{t('features.dashboard.header.menuSettings')}</Button.Label>
        </Button>
        <Button testID="home-menu-lock" variant="outline" onPress={run(() => session.lockConsole())} accessibilityLabel={t('shell.userMenu.lockConsole')} accessibilityHint={t('features.dashboard.header.lockHint')}>
          <Button.Label>{t('shell.userMenu.lockConsole')}</Button.Label>
        </Button>
        <Text style={styles.sheetText} testID="home-menu-lock-note">
          {t('features.dashboard.header.lockHint')}
        </Text>
        <Button testID="home-menu-sign-out" variant="danger-soft" onPress={run(() => auth.signOut('USER'))} accessibilityLabel={t('shell.userMenu.signOut')}>
          <Button.Label>{t('shell.userMenu.signOut')}</Button.Label>
        </Button>
      </SheetFrame>
    </>
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
  alertSheetScroll: { maxHeight: 420 },
  sheetText: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
  },
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
});
