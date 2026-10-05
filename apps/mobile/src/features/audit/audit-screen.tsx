/**
 * Operator Audit View (04_mobile_specs §4.16; module 13, §21.3 AuditEvent) at `/audit`. Owner:
 * step 87 (P6). The route file `src/app/(app)/(tabs)/audit.tsx` renders `<AuditScreen />`; the
 * root stays `SafeScreen id="audit"` (`screen-audit`, T-M02, MA-04).
 *
 * Regions: A1 header (back on phones, "Audit", chain `StatusChip`) · A2 hash-chain strip (head,
 * entries, Verify) · A3 the EVT-30 discontinuity `Alert` while AUDIT_TAMPER is injected · A4 search,
 * category chips, "More filters" (severity, operator), Live switch · A5 the rows (`FlashList`,
 * newest first). A row opens the entry: a BottomSheet on phones, the detail pane on tablets.
 *
 * | Class | Layout (§2.4 "Sessions, Audit") |
 * |---|---|
 * | compact, compact-landscape | single column; row → BottomSheet |
 * | medium (tablet portrait) | `pane-list` 360 dp \| `pane-detail` |
 * | expanded (tablet landscape) | `pane-list` 40% \| `pane-detail` 60% (filters stay above the list) |
 *
 * Motion (§7.3 "Audit"): chain chip and strip first, then the rows stagger (first 10, 30 ms); a
 * filter change re-reveals; live rows insert (M-C-07); the chain head breathes (one ambient loop);
 * a tamper escalates once and the broken row holds a slow red glow until acknowledged (P7).
 *
 * Live mode (backend task W80; 04_client_integration_spec §7.4): the rows, the chain head and the
 * demo fault's break are the Core server's (the replica); Verify is operation 60 (`chain-strip.tsx`,
 * site S1-7); a failed or locked sign-in names the username typed (`use-audit-data.ts`); while the
 * Core link is down a notice says the rows are the last the Core sent (`chain-live.tsx`).
 */
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useIsFocused, useRouter } from 'expo-router';
import { Button, SkeletonGroup } from 'heroui-native';
import { ArrowLeft } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { AuditRow } from '@dems/shared/sim';
import { fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { SectionCard } from '@/components/kit';
import { Pane, PaneLayout, SafeScreen, useLayoutClass } from '@/layout';
import { enterRise, rowReveal, useMotionSettings } from '@/motion';
import { reportRuntimeIssue, useRuntimeStatus } from '@/runtime';
import { AuditBoundary } from './audit-boundary';
import { AuditEntryDetail } from './audit-entry-detail';
import { AuditFilters } from './audit-filters';
import { DEFAULT_AUDIT_QUERY, chainLinkOf, isFiltered, type AuditQuery } from './audit-model';
import { AuditRowItem } from './audit-row';
import { AuditSheet } from './audit-sheet';
import { AuditLinkNotice } from './chain-live';
import { ChainStatusChip, ChainStrip, TamperAlert } from './chain-strip';
import {
  useAuditFeed,
  useAuditHead,
  useAuditOperators,
  useAuditRingRows,
  useAuditText,
  useAuditTotal,
  useChainBreakSeq,
  type AuditText,
} from './use-audit-data';

/** Medium: a 360 dp list; expanded: list 40% | detail 60% (04 §2.4). */
const MEDIUM_LIST_WIDTH = 360;
/** First-load rows that stagger (M-C-11). */
const REVEAL_ROWS = 10;
/** Within this distance of the top (dp) the list follows new entries. */
const TOP_THRESHOLD = 64;

export function AuditScreen() {
  const { layoutClass, isMultiPane } = useLayoutClass();
  const focused = useIsFocused();
  const status = useRuntimeStatus();
  const operators = useAuditOperators();
  const text = useAuditText(operators.names);
  const head = useAuditHead();
  // The strip always shows the live chain, even while the list holds still (Live off).
  const ring = useAuditRingRows();
  const total = useAuditTotal();
  const breakSeq = useChainBreakSeq();
  const m = useMotionSettings();

  const [query, setQuery] = useState<AuditQuery>(DEFAULT_AUDIT_QUERY);
  const [live, setLive] = useState(true);
  const [selectedSeq, setSelectedSeq] = useState<number | null>(null);
  const [acknowledgedSeq, setAcknowledgedSeq] = useState<number | null>(null);
  // Entries newer than this were written while the view was open (live insertions, M-C-07).
  const [baselineSeq, setBaselineSeq] = useState(total);
  const listRef = useRef<FlashListRef<AuditRow>>(null);

  const feed = useAuditFeed(live, query, text);
  const acknowledged = breakSeq !== null && acknowledgedSeq === breakSeq;

  const changeLive = useCallback(
    (next: boolean) => {
      // Resuming shows the held entries at once; only entries written afterwards enter live.
      if (next) setBaselineSeq(total);
      setLive(next);
    },
    [total],
  );

  const selectedRow = useMemo(
    () => (selectedSeq === null ? null : (feed.source.find((row) => row.seq === selectedSeq) ?? null)),
    [feed.source, selectedSeq],
  );

  const showBrokenEntry = useCallback(() => {
    if (breakSeq === null) return;
    setQuery(DEFAULT_AUDIT_QUERY);
    setSelectedSeq(breakSeq);
    // The full list is newest first, so the entry's index is its distance from the newest row.
    const index = feed.source.length - 1 - feed.source.findIndex((row) => row.seq === breakSeq);
    requestAnimationFrame(() => {
      try {
        if (index >= 0 && index < feed.source.length) listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 });
      } catch (error) {
        reportRuntimeIssue('warn', 'audit.showBrokenEntry', error, { seq: breakSeq });
      }
    });
  }, [breakSeq, feed.source]);

  const list = (
    <View style={styles.column} testID="audit-list-column">
      <AuditBoundary name="chain">
        <Animated.View entering={enterRise(1, m)} style={styles.section}>
          <ChainStrip rows={ring} head={head} total={total} breakSeq={breakSeq} focused={focused} />
        </Animated.View>
        {/* Live mode only, and only while the Core link is down: no element otherwise (W80). */}
        <AuditLinkNotice style={styles.section} />
        {breakSeq !== null ? (
          <View style={styles.section}>
            <TamperAlert seq={breakSeq} acknowledged={acknowledged} onShow={showBrokenEntry} onAcknowledge={() => setAcknowledgedSeq(breakSeq)} />
          </View>
        ) : null}
      </AuditBoundary>
      <View style={styles.section}>
        <AuditFilters
          query={query}
          onQueryChange={setQuery}
          live={live}
          onLiveChange={changeLive}
          pending={feed.pending}
          operatorIds={operators.ids}
          operatorNames={operators.names}
        />
      </View>
      <AuditBoundary name="list">
        {!status.ready ? (
          <SkeletonGroup isLoading style={styles.skeletons} testID="audit-loading">
            {[0, 1, 2, 3, 4].map((i) => (
              <SkeletonGroup.Item key={i} className="h-16 w-full rounded-xl" />
            ))}
          </SkeletonGroup>
        ) : (
          <AuditList
            listRef={listRef}
            rows={feed.rows}
            sourceCount={feed.source.length}
            query={query}
            text={text}
            breakSeq={breakSeq}
            acknowledged={acknowledged}
            selectedSeq={isMultiPane ? selectedSeq : null}
            baselineSeq={live ? baselineSeq : Number.POSITIVE_INFINITY}
            onSelect={setSelectedSeq}
            onClearFilters={() => setQuery(DEFAULT_AUDIT_QUERY)}
          />
        )}
      </AuditBoundary>
    </View>
  );

  return (
    <SafeScreen id="audit">
      <AuditHeader withBack={!isMultiPane} breakSeq={breakSeq} condensed={layoutClass === 'compact-landscape'} />
      {isMultiPane ? (
        <PaneLayout testID="audit-panes" style={styles.panes}>
          <Pane name="list" {...(layoutClass === 'medium' ? { width: MEDIUM_LIST_WIDTH } : { flex: 2, style: styles.flexBasisZero })}>
            {list}
          </Pane>
          <Pane name="detail" flex={3} style={styles.flexBasisZero}>
            <AuditBoundary name="detail">
              {selectedRow ? (
                <ScrollView key={selectedRow.id} contentContainerStyle={styles.paneScroll} testID="audit-detail-pane">
                  <AuditEntryDetail
                    row={selectedRow}
                    chain={chainLinkOf(selectedRow, breakSeq)}
                    label={text.label(selectedRow)}
                    actor={text.actor(selectedRow)}
                    variant="pane"
                  />
                </ScrollView>
              ) : (
                <DetailPlaceholder />
              )}
            </AuditBoundary>
          </Pane>
        </PaneLayout>
      ) : (
        list
      )}
      {isMultiPane ? null : (
        <AuditSheet isOpen={selectedRow !== null} onClose={() => setSelectedSeq(null)} title={selectedRow ? text.label(selectedRow) : ''}>
          {selectedRow ? (
            <AuditEntryDetail
              row={selectedRow}
              chain={chainLinkOf(selectedRow, breakSeq)}
              label={text.label(selectedRow)}
              actor={text.actor(selectedRow)}
              variant="sheet"
            />
          ) : null}
        </AuditSheet>
      )}
    </SafeScreen>
  );
}

function AuditHeader({ withBack, breakSeq, condensed }: { withBack: boolean; breakSeq: number | null; condensed: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const m = useMotionSettings();
  return (
    <Animated.View entering={enterRise(0, m)} style={[styles.header, condensed ? styles.headerCondensed : null, withBack ? null : styles.headerPane]} testID="audit-header">
      {withBack ? (
        <Button
          isIconOnly
          variant="ghost"
          size="md"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/more'))}
          accessibilityLabel={t('features.audit.header.back')}
          testID="audit-back"
        >
          <ArrowLeft size={22} color={palette.gold} />
        </Button>
      ) : null}
      <View style={styles.headerText}>
        <Text maxFontSizeMultiplier={1.2} accessibilityRole="header" style={styles.title}>
          {t('features.audit.header.title')}
        </Text>
        {condensed ? null : (
          <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.subtitle}>
            {t('features.audit.header.subtitle')}
          </Text>
        )}
      </View>
      <ChainStatusChip breakSeq={breakSeq} />
    </Animated.View>
  );
}

interface AuditListProps {
  listRef: React.RefObject<FlashListRef<AuditRow> | null>;
  rows: AuditRow[];
  sourceCount: number;
  query: AuditQuery;
  text: AuditText;
  breakSeq: number | null;
  acknowledged: boolean;
  selectedSeq: number | null;
  baselineSeq: number;
  onSelect: (seq: number) => void;
  onClearFilters: () => void;
}

function AuditList({ listRef, rows, sourceCount, query, text, breakSeq, acknowledged, selectedSeq, baselineSeq, onSelect, onClearFilters }: AuditListProps) {
  const { t } = useTranslation();
  const m = useMotionSettings();
  // A filter change re-reveals the list (the rows stagger again).
  const revealKey = `${query.category}|${query.severity}|${query.operator}`;

  if (rows.length === 0) {
    return (
      <View style={styles.section}>
        <SectionCard
          title={t('features.audit.list.empty')}
          description={t('features.audit.list.emptyBody')}
          testID="audit-empty"
          footer={
            isFiltered(query) ? (
              <Button variant="outline" onPress={onClearFilters} testID="audit-clear-filters">
                <Button.Label>{t('common.actions.clearFilters')}</Button.Label>
              </Button>
            ) : undefined
          }
        />
      </View>
    );
  }

  return (
    <View style={styles.listWrap} accessibilityLabel={t('features.audit.list.label')}>
      <FlashList
        key={revealKey}
        ref={listRef}
        testID="audit-rows"
        data={rows}
        keyExtractor={(row) => row.id}
        extraData={`${selectedSeq}|${breakSeq}|${acknowledged}|${baselineSeq}`}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        // Live rows arrive at the top: a reader at the top sees them (auto-scroll); a reader further
        // down keeps their place (FlashList v2 keeps the visible content by default).
        maintainVisibleContentPosition={{ autoscrollToTopThreshold: TOP_THRESHOLD }}
        renderItem={({ item, index }) => {
          const chain = chainLinkOf(item, breakSeq);
          const row = (
            <AuditRowItem
              row={item}
              label={text.label(item)}
              actor={text.actor(item)}
              secondary={text.secondary(item)}
              chain={chain}
              breathing={chain === 'BROKEN' && !acknowledged}
              selected={item.seq === selectedSeq}
              fresh={item.seq > baselineSeq}
              onPress={onSelect}
            />
          );
          return index < REVEAL_ROWS && item.seq <= baselineSeq ? <Animated.View entering={rowReveal(index, m)}>{row}</Animated.View> : row;
        }}
        ListFooterComponent={
          <Text maxFontSizeMultiplier={1.2} style={styles.count} testID="audit-count">
            {t('features.audit.list.count', { shown: rows.length, total: sourceCount })}
          </Text>
        }
      />
    </View>
  );
}

function DetailPlaceholder() {
  const { t } = useTranslation();
  return (
    <View style={styles.placeholder} testID="audit-detail-empty">
      <SectionCard title={t('features.audit.detail.paneEmptyTitle')} description={t('features.audit.detail.paneEmptyBody')} />
    </View>
  );
}

const styles = StyleSheet.create({
  panes: { paddingRight: spacing[3] },
  // A zero basis keeps the 40 | 60 split after a rotation (step 83 device finding).
  flexBasisZero: { flexBasis: 0 },
  column: { flex: 1 },
  section: { paddingHorizontal: spacing[3], paddingBottom: spacing[1] },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], minHeight: 56, paddingHorizontal: spacing[1], paddingRight: spacing[3] },
  headerCondensed: { minHeight: 48 },
  headerPane: { minHeight: 64, paddingHorizontal: spacing[3] },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontFamily: fontFamily.native.semibold, fontSize: typography.h2.size, lineHeight: typography.h2.lineHeight, color: palette.foreground },
  subtitle: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
  skeletons: { paddingHorizontal: spacing[3], gap: spacing[1] },
  listWrap: { flex: 1 },
  listContent: { paddingHorizontal: spacing[3], paddingBottom: spacing[3] },
  count: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
    textAlign: 'center',
    paddingVertical: spacing[1],
  },
  paneScroll: { paddingTop: spacing[2], paddingBottom: spacing[5], paddingHorizontal: spacing[1] },
  placeholder: { flex: 1, paddingTop: spacing[5], paddingHorizontal: spacing[3] },
});
