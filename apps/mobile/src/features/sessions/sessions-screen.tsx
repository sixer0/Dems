/**
 * Sessions hub (04_mobile_specs §4.9, derived: the MB tab "Sessions" has no mockup screen) at
 * `/sessions`. Owner: step 82 (P6). The route file `src/app/(app)/(tabs)/sessions/index.tsx`
 * renders `<SessionsScreen selectedId />` and parses `?selected=`; the root stays
 * `SafeScreen id="sessions"` (`screen-sessions`, T-M02, MA-04).
 *
 * Derived from MB 2's Recent Sessions and active-session card and MB 5's Evidence list:
 * header (emblem, "Sessions") · active-session card (REC, timer, "Return to monitor") · "Start New
 * Session" · `SearchField` · `TagGroup` filters (All, Sealed, Incomplete, Today) · `FlashList`
 * rows (ID mono, date, subject + `SubjectTypeChip`, duration, state chip) with pull-to-refresh.
 *
 * Layouts per class (§2.4 "Sessions, Audit" row, §2.5 rule 3):
 *
 * | Class | Layout |
 * |---|---|
 * | compact, compact-landscape | one scrolling list; a row hands off (monitor, summary, evidence, detail) |
 * | medium (tablet portrait) | `pane-list` 360 dp \| `pane-detail` |
 * | expanded (tablet landscape) | `pane-filters` 280 dp \| `pane-list` 360 dp \| `pane-detail` 340 dp, the rest split 2 : 3 |
 *
 * On multi-pane windows the selection lives in `?selected=` (the route hands a deep-linked detail
 * over to it), so rotation keeps it (MA-13); the selected row carries glow e2.
 *
 * Motion (§7.3, "Evidence" pattern): header and controls rise (R1), the first rows stagger 30 ms
 * (M-C-11); a filter change or a finished pull-to-refresh re-reveals the rows. The refresh lasts
 * `REFRESH_MS` on the simulator clock (relay F74-09), shows the gold Android spinner on the warm
 * panel colour and stamps "Updated hh:mm:ss". The only ambient loop is the REC dot (P3 ≤ 4).
 *
 * Live mode (backend task, plan row W72 follow-up, decision D169): the rows are the Core's replicated
 * state, pushed over the socket. While the Core link is down (`useCoreLinkNotice()` of the runtime, the
 * one link rule) a refresh records no "Updated" time, because nothing was received, and a notice above
 * the rows says the list is what this device last received. Outside LIVE `offline` is false and the hub
 * is as before.
 */
import { FlashList } from '@shopify/flash-list';
import { Alert, Button, SearchField, SkeletonGroup, TagGroup } from 'heroui-native';
import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { DATE_PATTERNS, formatDate } from '@dems/shared/realtime';
import { useSim, useSimInstance } from '@dems/shared/sim';
import { derived, fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { SectionCard } from '@/components/kit';
import { Emblem } from '@/components/media';
import { Pane, PaneLayout, SafeScreen, useLayoutClass } from '@/layout';
import { enterRise, rowReveal, triggerHaptic, useMotionSettings } from '@/motion';
import { useCoreLinkNotice, useRuntimeStatus } from '@/runtime';
import { HubTop } from './hub-top';
import { SessionDetail } from './session-detail';
import { SessionRow } from './session-row';
import {
  DEFAULT_HUB_QUERY,
  HUB_FILTERS,
  SEARCH_MAX_LENGTH,
  isFiltered,
  isHubFilter,
  type HubFilter,
  type HubQuery,
  type SessionRow as SessionRowModel,
} from './sessions-model';
import { useOpenSession } from './use-hand-off';
import { useHubRows } from './use-sessions-data';

export interface SessionsScreenProps {
  /** Session selected with `?selected=` (the detail pane on medium and expanded, 04 §2.4), or null. */
  readonly selectedId: string | null;
}

/** Medium: a 360 dp list (04 §2.4, as Evidence) and the detail takes the rest. */
const MEDIUM_LIST_WIDTH = 360;
/**
 * Closing-fix CF-M2, defect R-T-4: the expanded list is never narrower than the medium list. At 1280 dp
 * with the extended rail, 40% was about 283 dp: the rows' text column shrank below 60 dp (re-test
 * `P04_sessions_hub`). At 360 dp the pane row (`session-row.tsx`, `PANE_ROW`) holds every value on one line.
 */
export const LIST_MIN_WIDTH = MEDIUM_LIST_WIDTH;
/**
 * Closing-fix CF2-B, defect RF-T-2 (decision D227): CF-M2 wrote the list as `flex: 2, minWidth: 360` next
 * to a `flex: 3` detail, both on a zero basis. Yoga does not take a minimum out of the split: it raises the
 * list's basis to 360 and then still gives it 2/5 of what is left (React Native's Yoga,
 * `CalculateLayout.cpp`, `distributeFreeSpaceFirstPass`/`SecondPass`: the bounded basis plus the grow
 * share). On the tablet (704 dp for list + detail) that was 360 + 0.4 x 344 = 497.6 dp for the list and
 * 206.4 dp for the detail, exactly the re-test's 995 px | 413 px: labels broken inside words, the subject
 * name not drawn.
 *
 * Now each pane STARTS at the width it needs (list 360 dp, detail 340 dp, no minimum, so Yoga has nothing
 * to raise) and only the space beyond that is split 2 : 3. On the tablet: list about 362 dp, detail about
 * 342 dp; with the rail collapsed the extra space goes 2 : 3 as before. Narrower windows shrink both in
 * proportion to their start widths.
 */
export const DETAIL_MIN_WIDTH = 340;
/** The expanded list pane's flex: a 360 dp start, 2 shares of the extra space. */
export const LIST_PANE_FLEX = { flexGrow: 2, flexShrink: 1, flexBasis: LIST_MIN_WIDTH } as const;
/** The expanded and medium detail pane's flex: a 340 dp start, 3 shares of the extra space. */
export const DETAIL_PANE_FLEX = { flexGrow: 3, flexShrink: 1, flexBasis: DETAIL_MIN_WIDTH } as const;
/** The rows' horizontal padding inside the list (`listContent`). */
export const LIST_PADDING_X = spacing[3];
export const EXPANDED_FILTERS_WIDTH = 280;
/** Pull-to-refresh length on the simulator clock. */
export const REFRESH_MS = 700;

export function SessionsScreen({ selectedId }: SessionsScreenProps) {
  const { layoutClass, isMultiPane } = useLayoutClass();
  const [query, setQuery] = useState<HubQuery>(DEFAULT_HUB_QUERY);
  const expanded = layoutClass === 'expanded';

  const list = (
    <SessionsListColumn
      query={query}
      onQueryChange={setQuery}
      selectedId={isMultiPane ? selectedId : null}
      withControls={!expanded}
    />
  );

  return (
    <SafeScreen id="sessions">
      {isMultiPane ? (
        <PaneLayout testID="sessions-panes" style={styles.panes}>
          {expanded ? (
            <Pane name="filters" width={EXPANDED_FILTERS_WIDTH}>
              <FiltersPane query={query} onQueryChange={setQuery} />
            </Pane>
          ) : null}
          <Pane name="list" {...(expanded ? { style: LIST_PANE_FLEX } : { width: MEDIUM_LIST_WIDTH })}>
            {list}
          </Pane>
          <Pane name="detail" style={expanded ? DETAIL_PANE_FLEX : styles.flexBasisZero}>
            {selectedId ? <SessionDetail key={selectedId} sessionId={selectedId} variant="pane" /> : <DetailPlaceholder />}
          </Pane>
        </PaneLayout>
      ) : (
        list
      )}
    </SafeScreen>
  );
}

// ---------------------------------------------------------------------------------------------
// Refresh (simulator clock)
// ---------------------------------------------------------------------------------------------

interface HubRefresh {
  refreshing: boolean;
  refresh: () => void;
  /** Bumps when a refresh finishes (the rows re-reveal). */
  seq: number;
  /** Simulator time of the last finished refresh, or null. */
  updatedAt: number | null;
}

/**
 * Pull-to-refresh timed on the simulator clock (named `use…`: it calls hooks, D66). `offline` (LIVE, the
 * Core link down): the refresh still runs, but records no "Updated" time — nothing was received (D169).
 */
function useHubRefresh(offline: boolean): HubRefresh {
  const sim = useSimInstance();
  const [from, setFrom] = useState<number | null>(null);
  const [seq, setSeq] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const done = useSim((s) => from !== null && s.clock.now - from >= REFRESH_MS);
  // Adjust state during render when the simulator clock passes the refresh length.
  if (done && from !== null) {
    setFrom(null);
    setSeq(seq + 1);
    if (!offline) setUpdatedAt(from + REFRESH_MS);
  }
  const refresh = useCallback(() => {
    setFrom(sim.store.getState().clock.now);
  }, [sim]);
  return { refreshing: from !== null, refresh, seq, updatedAt };
}

// ---------------------------------------------------------------------------------------------
// List column
// ---------------------------------------------------------------------------------------------

interface SessionsListColumnProps {
  query: HubQuery;
  onQueryChange: (next: HubQuery) => void;
  selectedId: string | null;
  /** Active card, Start, search and filters above the rows (every class but expanded). */
  withControls: boolean;
}

function SessionsListColumn({ query, onQueryChange, selectedId, withControls }: SessionsListColumnProps) {
  const { t } = useTranslation();
  const m = useMotionSettings();
  const status = useRuntimeStatus();
  const { isMultiPane } = useLayoutClass();
  const open = useOpenSession();
  const { rows, total } = useHubRows(query);
  const { offline } = useCoreLinkNotice();
  const { refreshing, refresh, seq, updatedAt } = useHubRefresh(offline);
  const filtered = isFiltered(query);
  // A filter change or a finished refresh re-reveals the rows (they stagger again).
  const revealKey = `${query.filter}|${seq}`;

  const onPress = useCallback((row: SessionRowModel) => open(row), [open]);

  const controls = withControls ? (
    <View style={styles.controls}>
      <HubTop index={1} />
      <Animated.View entering={enterRise(3, m)}>
        <HubSearch query={query} onQueryChange={onQueryChange} />
      </Animated.View>
      <Animated.View entering={enterRise(4, m)}>
        <FilterChips query={query} onQueryChange={onQueryChange} />
      </Animated.View>
    </View>
  ) : null;

  let empty: ReactNode = null;
  if (!status.ready) {
    empty = (
      <SkeletonGroup isLoading style={styles.skeletons} testID="sessions-loading">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonGroup.Item key={i} className="h-20 w-full rounded-xl" />
        ))}
      </SkeletonGroup>
    );
  } else if (rows.length === 0) {
    empty = (
      <SectionCard
        title={t(total === 0 ? 'features.sessions.list.noHistory' : 'features.sessions.list.empty')}
        description={t(total === 0 ? 'features.sessions.list.noHistoryBody' : 'features.sessions.list.emptyBody')}
        testID="sessions-empty"
        footer={
          filtered ? (
            <Button variant="outline" onPress={() => onQueryChange(DEFAULT_HUB_QUERY)} testID="sessions-clear-filters">
              <Button.Label>{t('features.sessions.list.clearFilters')}</Button.Label>
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <View style={styles.column} testID="sessions-list">
      <Animated.View entering={enterRise(0, m)}>
        <ListHeader />
      </Animated.View>
      {offline ? (
        <View style={styles.linkDown}>
          <Alert status="warning" testID="sessions-link-down">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{t('features.sessions.live.linkDownTitle')}</Alert.Title>
              <Alert.Description>{t('features.sessions.live.linkDownBody')}</Alert.Description>
            </Alert.Content>
          </Alert>
        </View>
      ) : null}
      <View style={styles.listWrap} accessibilityLabel={t('features.sessions.list.label')}>
        <FlashList
          testID="sessions-rows"
          data={status.ready ? rows : []}
          keyExtractor={(item) => `${revealKey}:${item.id}`}
          extraData={selectedId}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              testID="sessions-refresh"
              refreshing={refreshing}
              onRefresh={() => {
                triggerHaptic('filterChipSelect');
                refresh();
              }}
              colors={[palette.gold]}
              tintColor={palette.gold}
              progressBackgroundColor={derived.surfaceTertiary}
              accessibilityLabel={refreshing ? t('features.sessions.list.refreshing') : undefined}
            />
          }
          ListHeaderComponent={controls}
          ListEmptyComponent={empty ? <View style={styles.emptyWrap}>{empty}</View> : null}
          renderItem={({ item, index }) => (
            <Animated.View entering={rowReveal(index, m)}>
              <SessionRow row={item} selected={item.id === selectedId} isMultiPane={isMultiPane} onPress={onPress} />
            </Animated.View>
          )}
          ListFooterComponent={
            rows.length > 0 ? (
              <Text maxFontSizeMultiplier={1.2} style={styles.count} testID="sessions-count">
                {t('features.sessions.list.count', { count: rows.length })}
                {updatedAt !== null ? ` · ${t('features.sessions.list.updated', { time: formatDate(updatedAt, DATE_PATTERNS.time) })}` : ''}
              </Text>
            ) : null
          }
        />
      </View>
    </View>
  );
}

/** Emblem (phone) + "Sessions". */
function ListHeader() {
  const { t } = useTranslation();
  const { isMultiPane } = useLayoutClass();
  return (
    <View style={[styles.header, isMultiPane ? styles.headerPane : null]}>
      {isMultiPane ? null : <Emblem size={32} />}
      <Text maxFontSizeMultiplier={1.2} accessibilityRole="header" style={styles.title}>
        {t('features.sessions.header.title')}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Search and filters
// ---------------------------------------------------------------------------------------------

interface QueryProps {
  query: HubQuery;
  onQueryChange: (next: HubQuery) => void;
}

function HubSearch({ query, onQueryChange }: QueryProps) {
  const { t } = useTranslation();
  return (
    <SearchField value={query.query} onChange={(text) => onQueryChange({ ...query, query: text.slice(0, SEARCH_MAX_LENGTH) })}>
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input
          testID="sessions-search"
          placeholder={t('features.sessions.search.placeholder')}
          accessibilityLabel={t('features.sessions.search.label')}
          maxLength={SEARCH_MAX_LENGTH}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        <SearchField.ClearButton testID="sessions-search-clear" />
      </SearchField.Group>
    </SearchField>
  );
}

interface FilterChipsProps extends QueryProps {
  /** Per-filter counts (expanded filter pane); without them the chips show the plain words. */
  counts?: Record<HubFilter, number>;
  vertical?: boolean;
}

function FilterChips({ query, onQueryChange, counts, vertical = false }: FilterChipsProps) {
  const { t } = useTranslation();
  const setFilter = (filter: HubFilter) => {
    if (filter === query.filter) return;
    triggerHaptic('filterChipSelect');
    onQueryChange({ ...query, filter });
  };
  const group = (
    <TagGroup
      selectionMode="single"
      selectedKeys={[query.filter]}
      onSelectionChange={(keys) => {
        const next = [...keys][0];
        if (isHubFilter(next)) setFilter(next);
      }}
      accessibilityLabel={t('features.sessions.filters.label')}
      testID="sessions-filters"
    >
      <TagGroup.List style={vertical ? styles.filtersVertical : styles.filters}>
        {HUB_FILTERS.map((filter) => {
          const word = t(`features.sessions.filters.${filter}`);
          const count = counts?.[filter];
          return (
            <TagGroup.Item
              key={filter}
              id={filter}
              testID={`sessions-filter-${filter}`}
              accessibilityLabel={count === undefined ? word : t('features.sessions.filters.countLabel', { filter: word, count })}
            >
              {count === undefined ? word : t('features.sessions.filters.withCount', { filter: word, count })}
            </TagGroup.Item>
          );
        })}
      </TagGroup.List>
    </TagGroup>
  );
  if (vertical) return group;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll} keyboardShouldPersistTaps="handled">
      {group}
    </ScrollView>
  );
}

/** Expanded: the active card, Start, search and the filters with their counts (§2.4 "Filters | list | detail"). */
function FiltersPane({ query, onQueryChange }: QueryProps) {
  const m = useMotionSettings();
  const { counts } = useHubRows(query);
  return (
    <ScrollView contentContainerStyle={styles.filtersPane} keyboardShouldPersistTaps="handled" testID="sessions-filters-pane">
      <HubTop index={0} />
      <Animated.View entering={enterRise(2, m)}>
        <HubSearch query={query} onQueryChange={onQueryChange} />
      </Animated.View>
      <Animated.View entering={enterRise(3, m)}>
        <FilterChips query={query} onQueryChange={onQueryChange} counts={counts} vertical />
      </Animated.View>
    </ScrollView>
  );
}

function DetailPlaceholder() {
  const { t } = useTranslation();
  return (
    <View style={styles.placeholder} testID="session-detail-empty">
      <SectionCard title={t('features.sessions.pane.emptyTitle')} description={t('features.sessions.pane.emptyBody')} />
    </View>
  );
}

const styles = StyleSheet.create({
  panes: { paddingRight: spacing[3] },
  // A zero basis makes the split depend on the flex ratio alone (step 83's rotation finding).
  flexBasisZero: { flexBasis: 0 },
  column: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], minHeight: 56, paddingHorizontal: spacing[3] },
  headerPane: { minHeight: 64 },
  title: {
    flex: 1,
    fontFamily: fontFamily.native.semibold,
    fontSize: typography.h2.size,
    lineHeight: typography.h2.lineHeight,
    color: palette.foreground,
  },
  controls: { gap: spacing[2], paddingBottom: spacing[2] },
  filtersScroll: { paddingRight: spacing[3] },
  filters: { flexDirection: 'row', flexWrap: 'nowrap', gap: spacing[0] + 2 },
  filtersVertical: { flexDirection: 'column', alignItems: 'flex-start', gap: spacing[1] },
  filtersPane: { paddingLeft: spacing[3], paddingTop: spacing[3], paddingBottom: spacing[4], gap: spacing[2] },
  skeletons: { gap: spacing[1] },
  emptyWrap: { paddingTop: spacing[1] },
  linkDown: { paddingHorizontal: spacing[3], paddingBottom: spacing[2] },
  listWrap: { flex: 1 },
  listContent: { paddingHorizontal: LIST_PADDING_X, paddingBottom: spacing[3] },
  count: {
    fontFamily: fontFamily.native.normal,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.lineHeight,
    color: palette.gray,
    textAlign: 'center',
    paddingVertical: spacing[1],
  },
  placeholder: { flex: 1, paddingTop: spacing[5], paddingHorizontal: spacing[3] },
});
