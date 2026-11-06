/**
 * Evidence list (04_mobile_specs §4.10, MB 5) at `/evidence`. Owner: step 83 (P6). The route file
 * `src/app/(app)/(tabs)/evidence/index.tsx` renders `<EvidenceListScreen selectedId />` and parses
 * `?selected=`; the root stays `SafeScreen id="evidence"` (`screen-evidence`, T-M02, MA-04).
 *
 * Regions in MB 5 order: E1 header (emblem, "Evidence", the list-options `Menu`: sort and density) ·
 * E2 `SearchField` · E3 status `TagGroup` (All, Recorded, Sealed, Exported, Under Review; the fifth
 * scrolls into view) · E4 the rows (`FlashList`) · E5 the tab bar (the shell's).
 *
 * Layouts per class (§2.4 "Evidence" row, §2.5 rule 3):
 *
 * | Class | Layout |
 * |---|---|
 * | compact (phone portrait) | MB 5 list; a row pushes `/evidence/<id>` (MB 6) |
 * | compact-landscape | list in 2 columns; a row pushes the detail (hero 40% \| tabs 60%) |
 * | medium (tablet portrait) | `pane-list` 360 dp \| `pane-detail` |
 * | expanded (tablet landscape) | `pane-list` 40% \| `pane-detail` 60% |
 *
 * On multi-pane windows the selection lives in `?selected=` (the route hands a deep-linked detail
 * over to it), so rotation and split-screen keep it (MA-13). The selected row carries glow e2.
 * Motion (§7.3 "Evidence"): search and filters, then the first 8 rows stagger 30 ms; a filter or
 * sort change re-reveals the list; no ambient loops.
 *
 * Backend task W74: the archive of the row kebab is site S3-1 (`archive-dialog.tsx`). The action
 * comes from `useCoreActions()` in both modes; its result is handed to the dialog, which settles it.
 */
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useRouter, type Href } from 'expo-router';
import { Button, Menu, SearchField, SkeletonGroup, TagGroup } from 'heroui-native';
import { List } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useCoreActions } from '@dems/shared/live';
import { fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { SectionCard } from '@/components/kit';
import { Emblem } from '@/components/media';
import { Pane, PaneLayout, SafeScreen, useLayoutClass } from '@/layout';
import { LIST_KEEP_POSITION, useTopOnQueryChange } from '@/lib/list-position';
import { enterRise, rowReveal, triggerHaptic, useMotionSettings } from '@/motion';
import { reportRuntimeIssue, useRuntimeStatus } from '@/runtime';
import { ArchiveDialog } from './archive-dialog';
import { requestDetailIntent } from './detail-intent';
import { EvidenceDetail } from './evidence-detail';
import {
  DEFAULT_EVIDENCE_QUERY,
  EVIDENCE_FILTERS,
  SEARCH_MAX_LENGTH,
  isEvidenceFilter,
  isFiltered,
  type EvidenceDensity,
  type EvidenceFilter,
  type EvidenceQuery,
  type EvidenceSort,
} from './evidence-model';
import { EvidenceRow, type EvidenceRowAction } from './evidence-row';
import { ExportSheet } from './export-sheet';
import { useCanArchive, useEvidenceRows } from './use-evidence-data';

export interface EvidenceListScreenProps {
  /** Evidence selected with `?selected=` (the detail pane on medium and expanded, 04 §2.5 rule 3), or null. */
  readonly selectedId: string | null;
}

/** Medium: a 360 dp list; expanded: list 40% | detail 60% (04 §2.4). */
const MEDIUM_LIST_WIDTH = 360;

export function EvidenceListScreen({ selectedId }: EvidenceListScreenProps) {
  const router = useRouter();
  const actions = useCoreActions();
  const { layoutClass, isMultiPane } = useLayoutClass();
  const [query, setQuery] = useState<EvidenceQuery>(DEFAULT_EVIDENCE_QUERY);
  const [density, setDensity] = useState<EvidenceDensity>('comfortable');
  const [exportId, setExportId] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);

  // JT-20: only a FILTERED list can hide the selection (an unfiltered one that does not hold the id yet is still loading).
  const paneRows = useEvidenceRows(query);
  const selectedHidden = isMultiPane && selectedId !== null && isFiltered(query) && !paneRows.some((row) => row.id === selectedId);

  const select = useCallback(
    (id: string) => {
      if (isMultiPane) router.setParams({ selected: id });
      else router.push(`/evidence/${id}` as Href);
    },
    [isMultiPane, router],
  );

  const onAction = useCallback(
    (id: string, action: EvidenceRowAction) => {
      switch (action) {
        case 'view':
          select(id);
          return;
        case 'verify':
          requestDetailIntent(id, 'integrity', true);
          select(id);
          return;
        case 'export':
          setExportId(id);
          return;
        case 'archive':
          setArchiveId(id);
          return;
      }
    },
    [select],
  );

  const list = (
    <EvidenceListColumn
      query={query}
      onQueryChange={setQuery}
      density={density}
      onDensityChange={setDensity}
      selectedId={isMultiPane ? selectedId : null}
      columns={layoutClass === 'compact-landscape' ? 2 : 1}
      onSelect={select}
      onAction={onAction}
    />
  );

  return (
    <SafeScreen id="evidence">
      {isMultiPane ? (
        <PaneLayout testID="evidence-panes" style={styles.panes}>
          <Pane
            name="list"
            {...(layoutClass === 'medium' ? { width: MEDIUM_LIST_WIDTH } : { flex: 2, style: styles.flexBasisZero })}
          >
            {list}
          </Pane>
          <Pane name="detail" flex={3} style={styles.flexBasisZero}>
            {/* Round two (JT-20): the pane follows the list - an item the filter or the search removed is not kept open. */}
            {selectedId && !selectedHidden ? (
              <EvidenceDetail key={selectedId} evidenceId={selectedId} variant="pane" />
            ) : selectedId ? (
              <FilteredOutPlaceholder id={selectedId} onClear={() => setQuery(DEFAULT_EVIDENCE_QUERY)} />
            ) : (
              <DetailPlaceholder />
            )}
          </Pane>
        </PaneLayout>
      ) : (
        list
      )}
      {exportId ? <ExportSheet isOpen onClose={() => setExportId(null)} evidenceId={exportId} /> : null}
      <ArchiveDialog
        evidenceId={archiveId}
        onOpenChange={(open) => (open ? undefined : setArchiveId(null))}
        archive={(id) => {
          try {
            return actions.archiveEvidence(id);
          } catch (error) {
            reportRuntimeIssue('warn', 'evidence.archive.list', error, { evidenceId: id });
            throw error;
          }
        }}
      />
    </SafeScreen>
  );
}

interface EvidenceListColumnProps {
  query: EvidenceQuery;
  onQueryChange: (next: EvidenceQuery) => void;
  density: EvidenceDensity;
  onDensityChange: (next: EvidenceDensity) => void;
  selectedId: string | null;
  columns: 1 | 2;
  onSelect: (id: string) => void;
  onAction: (id: string, action: EvidenceRowAction) => void;
}

function EvidenceListColumn({ query, onQueryChange, density, onDensityChange, selectedId, columns, onSelect, onAction }: EvidenceListColumnProps) {
  const { t } = useTranslation();
  const m = useMotionSettings();
  const status = useRuntimeStatus();
  const rows = useEvidenceRows(query);
  const canArchive = useCanArchive();
  const filtered = isFiltered(query);
  // A filter or sort change re-reveals the list (the rows stagger again).
  const revealKey = `${query.filter}|${query.sort}|${density}|${columns}`;
  // Fix wave Q: the answer to a new search is read from the top (a filter or sort change remounts the list anyway).
  const listRef = useTopOnQueryChange<FlashListRef<(typeof rows)[number]>>(query.query, rows.length);

  const setFilter = (filter: EvidenceFilter) => {
    if (filter === query.filter) return;
    triggerHaptic('filterChipSelect');
    onQueryChange({ ...query, filter });
  };

  return (
    <View style={styles.column} testID="evidence-list">
      <Animated.View entering={enterRise(0, m)}>
        <ListHeader
          sort={query.sort}
          density={density}
          onSort={(sort) => onQueryChange({ ...query, sort })}
          onDensity={onDensityChange}
        />
      </Animated.View>
      <Animated.View entering={enterRise(1, m)} style={styles.controls}>
        <SearchField value={query.query} onChange={(text) => onQueryChange({ ...query, query: text.slice(0, SEARCH_MAX_LENGTH) })}>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input
              testID="evidence-search"
              placeholder={t('features.evidence.search.placeholder')}
              accessibilityLabel={t('features.evidence.search.label')}
              maxLength={SEARCH_MAX_LENGTH}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            <SearchField.ClearButton testID="evidence-search-clear" />
          </SearchField.Group>
        </SearchField>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
          <TagGroup
            selectionMode="single"
            selectedKeys={[query.filter]}
            onSelectionChange={(keys) => {
              const next = [...keys][0];
              if (isEvidenceFilter(next)) setFilter(next);
            }}
            accessibilityLabel={t('features.evidence.filters.label')}
            testID="evidence-filters"
          >
            <TagGroup.List style={styles.filters}>
              {EVIDENCE_FILTERS.map((filter) => (
                <TagGroup.Item key={filter} id={filter} testID={`evidence-filter-${filter}`}>
                  {t(`features.evidence.filters.${filter}`)}
                </TagGroup.Item>
              ))}
            </TagGroup.List>
          </TagGroup>
        </ScrollView>
      </Animated.View>

      {!status.ready ? (
        <SkeletonGroup isLoading style={styles.skeletons} testID="evidence-loading">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonGroup.Item key={i} className="h-24 w-full rounded-xl" />
          ))}
        </SkeletonGroup>
      ) : rows.length === 0 ? (
        <View style={styles.emptyWrap}>
          <SectionCard
            title={t('features.evidence.list.empty')}
            description={t('features.evidence.list.emptyBody')}
            testID="evidence-empty"
            footer={
              filtered ? (
                <Button variant="outline" onPress={() => onQueryChange({ ...query, filter: 'ALL', query: '' })} testID="evidence-clear-filters">
                  <Button.Label>{t('features.evidence.list.clearFilters')}</Button.Label>
                </Button>
              ) : undefined
            }
          />
        </View>
      ) : (
        <View style={styles.listWrap} accessibilityLabel={t('features.evidence.list.label')}>
          <FlashList
            key={revealKey}
            ref={listRef}
            testID="evidence-rows"
            data={rows}
            numColumns={columns}
            keyExtractor={(item) => item.id}
            // JM-03 (wave J: a just-sealed item was in the data ONE ROW ABOVE the viewport) and CP-01 / CT-02 (wave Q:
            // with the keeping DISABLED the first opening after a sign-in and a filter change laid the rows out
            // wrong): the position is kept, and a reader at the top is taken to a new first row. `@/lib/list-position`.
            maintainVisibleContentPosition={LIST_KEEP_POSITION}
            extraData={selectedId}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item, index }) => (
              <Animated.View entering={rowReveal(index, m)} style={columns === 2 ? styles.gridCell : undefined}>
                <EvidenceRow
                  item={item}
                  selected={item.id === selectedId}
                  density={density}
                  canArchive={canArchive}
                  onPress={onSelect}
                  onAction={onAction}
                />
              </Animated.View>
            )}
            ListFooterComponent={
              <Text maxFontSizeMultiplier={1.2} style={styles.count} testID="evidence-count">
                {t('features.evidence.list.count', { count: rows.length })}
              </Text>
            }
          />
        </View>
      )}
    </View>
  );
}

interface ListHeaderProps {
  sort: EvidenceSort;
  density: EvidenceDensity;
  onSort: (sort: EvidenceSort) => void;
  onDensity: (density: EvidenceDensity) => void;
}

/** E1: emblem + "Evidence"; the `List` icon opens Sort and Density (the icon's meaning is a hypothesis, 04 §4.10). */
function ListHeader({ sort, density, onSort, onDensity }: ListHeaderProps) {
  const { t } = useTranslation();
  const { isMultiPane } = useLayoutClass();
  return (
    <View style={[styles.header, isMultiPane ? styles.headerPane : null]}>
      {isMultiPane ? null : <Emblem size={32} />}
      <Text maxFontSizeMultiplier={1.2} accessibilityRole="header" style={styles.title}>
        {t('features.evidence.header.title')}
      </Text>
      <Menu>
        <Menu.Trigger asChild>
          <Button isIconOnly variant="ghost" size="md" accessibilityLabel={t('features.evidence.header.viewOptions')} testID="evidence-options">
            <List size={22} color={palette.gold} />
          </Button>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Overlay />
          <Menu.Content presentation="popover" width={220} placement="bottom" align="end">
            <Menu.Label>{t('features.evidence.menu.sortTitle')}</Menu.Label>
            <Menu.Group selectionMode="single" selectedKeys={[sort]} onSelectionChange={(keys) => {
              const next = [...keys][0];
              if (next === 'newest' || next === 'oldest') onSort(next);
            }}>
              <Menu.Item id="newest" testID="evidence-sort-newest">
                <Menu.ItemIndicator />
                <Menu.ItemTitle>{t('features.evidence.menu.newest')}</Menu.ItemTitle>
              </Menu.Item>
              <Menu.Item id="oldest" testID="evidence-sort-oldest">
                <Menu.ItemIndicator />
                <Menu.ItemTitle>{t('features.evidence.menu.oldest')}</Menu.ItemTitle>
              </Menu.Item>
            </Menu.Group>
            <Menu.Label>{t('features.evidence.menu.densityTitle')}</Menu.Label>
            <Menu.Group selectionMode="single" selectedKeys={[density]} onSelectionChange={(keys) => {
              const next = [...keys][0];
              if (next === 'comfortable' || next === 'compact') onDensity(next);
            }}>
              <Menu.Item id="comfortable" testID="evidence-density-comfortable">
                <Menu.ItemIndicator />
                <Menu.ItemTitle>{t('features.evidence.menu.comfortable')}</Menu.ItemTitle>
              </Menu.Item>
              <Menu.Item id="compact" testID="evidence-density-compact">
                <Menu.ItemIndicator />
                <Menu.ItemTitle>{t('features.evidence.menu.compact')}</Menu.ItemTitle>
              </Menu.Item>
            </Menu.Group>
          </Menu.Content>
        </Menu.Portal>
      </Menu>
    </View>
  );
}

function FilteredOutPlaceholder({ id, onClear }: { id: string; onClear: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.placeholder} testID="evidence-detail-filtered-out">
      <SectionCard title={t('features.evidence.paneFiltered.title', { id })} description={t('features.evidence.paneFiltered.body')}>
        <Button variant="outline" onPress={onClear} testID="evidence-detail-filtered-out-clear">
          <Button.Label>{t('features.evidence.paneFiltered.clear')}</Button.Label>
        </Button>
      </SectionCard>
    </View>
  );
}

function DetailPlaceholder() {
  const { t } = useTranslation();
  return (
    <View style={styles.placeholder} testID="evidence-detail-empty">
      <SectionCard title={t('features.evidence.pane.emptyTitle')} description={t('features.evidence.pane.emptyBody')} />
    </View>
  );
}

const styles = StyleSheet.create({
  panes: { paddingRight: spacing[3] },
  // Device finding (step 83): `flex: n` keeps an automatic basis, so after a rotation the list's
  // FlashList (still sized for the 360 dp portrait pane) skewed the 40 | 60 split to about 60 | 40.
  // A zero basis makes the split depend on the flex ratio alone.
  flexBasisZero: { flexBasis: 0 },
  column: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], minHeight: 56, paddingHorizontal: spacing[3] },
  headerPane: { minHeight: 64 },
  title: { flex: 1, fontFamily: fontFamily.native.semibold, fontSize: typography.h2.size, lineHeight: typography.h2.lineHeight, color: palette.foreground },
  controls: { paddingHorizontal: spacing[3], gap: spacing[2], paddingBottom: spacing[2] },
  filtersScroll: { paddingRight: spacing[3] },
  filters: { flexDirection: 'row', flexWrap: 'nowrap', gap: spacing[1] },
  skeletons: { paddingHorizontal: spacing[3], gap: spacing[1] },
  emptyWrap: { paddingHorizontal: spacing[3] },
  listWrap: { flex: 1 },
  listContent: { paddingHorizontal: spacing[3], paddingBottom: spacing[3] },
  gridCell: { flex: 1, paddingHorizontal: spacing[0] },
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
