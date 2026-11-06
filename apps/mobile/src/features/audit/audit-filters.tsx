/**
 * Audit controls (04_mobile_specs §4.16 "SearchField; TagGroup categories; Switch Live"; brief:
 * filters by category, severity and operator — the web page's three filters, D82). Category is the
 * chip row (MB 5 filter chips); severity and operator sit in one "More filters" `Menu` so the phone
 * keeps a single control row. With Live off, a "N new entries · Resume live" button appears.
 */
import { Button, Label, Menu, SearchField, Switch, TagGroup } from 'heroui-native';
import { SlidersHorizontal } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { triggerHaptic } from '@/motion';
import {
  ALL,
  CATEGORY_FILTERS,
  NO_OPERATOR,
  SEARCH_MAX_LENGTH,
  SEVERITY_FILTERS,
  isCategoryFilter,
  isSeverityFilter,
  menuFilterCount,
  type AuditQuery,
} from './audit-model';

export interface AuditFiltersProps {
  query: AuditQuery;
  onQueryChange: (next: AuditQuery) => void;
  live: boolean;
  onLiveChange: (live: boolean) => void;
  pending: number;
  operatorIds: readonly string[];
  operatorNames: Readonly<Record<string, string>>;
}

export function AuditFilters({ query, onQueryChange, live, onLiveChange, pending, operatorIds, operatorNames }: AuditFiltersProps) {
  const { t } = useTranslation();
  const active = menuFilterCount(query);

  return (
    <View style={styles.wrap} accessibilityLabel={t('features.audit.filters.label')}>
      <SearchField value={query.text} onChange={(text) => onQueryChange({ ...query, text: text.slice(0, SEARCH_MAX_LENGTH) })}>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input
            testID="audit-search"
            placeholder={t('features.audit.filters.searchPlaceholder')}
            accessibilityLabel={t('features.audit.filters.searchLabel')}
            maxLength={SEARCH_MAX_LENGTH}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          <SearchField.ClearButton testID="audit-search-clear" />
        </SearchField.Group>
      </SearchField>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll} keyboardShouldPersistTaps="handled">
        <TagGroup
          selectionMode="single"
          selectedKeys={[query.category]}
          onSelectionChange={(keys) => {
            const next = [...keys][0];
            if (!isCategoryFilter(next) || next === query.category) return;
            triggerHaptic('filterChipSelect');
            onQueryChange({ ...query, category: next });
          }}
          accessibilityLabel={t('features.audit.filters.categories')}
          testID="audit-categories"
        >
          <TagGroup.List style={styles.chips}>
            {CATEGORY_FILTERS.map((category) => (
              <TagGroup.Item key={category} id={category} testID={`audit-category-${category}`}>
                {category === ALL ? t('features.audit.filters.ALL') : t(`common.auditCategory.${category}`)}
              </TagGroup.Item>
            ))}
          </TagGroup.List>
        </TagGroup>
      </ScrollView>

      <View style={styles.controlRow}>
        <Menu>
          <Menu.Trigger asChild>
            <Button size="sm" variant={active > 0 ? 'secondary' : 'ghost'} accessibilityLabel={t('features.audit.filters.menu')} testID="audit-filter-menu">
              <SlidersHorizontal size={16} color={palette.gold} />
              <Button.Label>{active > 0 ? t('features.audit.filters.menuActive', { count: active }) : t('features.audit.filters.menu')}</Button.Label>
            </Button>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Overlay />
            <Menu.Content presentation="popover" width={240} placement="bottom" align="start">
              <Menu.Label>{t('features.audit.filters.severity')}</Menu.Label>
              <Menu.Group
                selectionMode="single"
                selectedKeys={[query.severity]}
                onSelectionChange={(keys) => {
                  const next = [...keys][0];
                  if (isSeverityFilter(next)) onQueryChange({ ...query, severity: next });
                }}
              >
                {SEVERITY_FILTERS.map((severity) => (
                  <Menu.Item key={severity} id={severity} testID={`audit-severity-${severity}`}>
                    <Menu.ItemIndicator />
                    <Menu.ItemTitle>{severity === ALL ? t('securityAudit.audit.allSeverities') : t(`common.severity.${severity}`)}</Menu.ItemTitle>
                  </Menu.Item>
                ))}
              </Menu.Group>
              <Menu.Label>{t('features.audit.filters.operator')}</Menu.Label>
              <Menu.Group
                selectionMode="single"
                selectedKeys={[query.operator]}
                onSelectionChange={(keys) => {
                  const next = [...keys][0];
                  if (typeof next === 'string') onQueryChange({ ...query, operator: next });
                }}
              >
                <Menu.Item id={ALL} testID="audit-operator-ALL">
                  <Menu.ItemIndicator />
                  <Menu.ItemTitle>{t('securityAudit.audit.allOperators')}</Menu.ItemTitle>
                </Menu.Item>
                {operatorIds.map((id) => (
                  <Menu.Item key={id} id={id} testID={`audit-operator-${id}`}>
                    <Menu.ItemIndicator />
                    <Menu.ItemTitle>{operatorNames[id] ?? id}</Menu.ItemTitle>
                  </Menu.Item>
                ))}
                <Menu.Item id={NO_OPERATOR} testID={`audit-operator-${NO_OPERATOR}`}>
                  <Menu.ItemIndicator />
                  <Menu.ItemTitle>{t('features.audit.filters.noOperator')}</Menu.ItemTitle>
                </Menu.Item>
              </Menu.Group>
            </Menu.Content>
          </Menu.Portal>
        </Menu>

        <View style={styles.liveGroup}>
          {!live && pending > 0 ? (
            <Button size="sm" variant="secondary" onPress={() => onLiveChange(true)} testID="audit-resume">
              <Button.Label>{`${t('securityAudit.audit.newEntries', { count: pending })} · ${t('securityAudit.audit.resume')}`}</Button.Label>
            </Button>
          ) : !live ? (
            <Text maxFontSizeMultiplier={1.2} style={styles.paused} testID="audit-paused">
              {t('features.audit.list.paused')}
            </Text>
          ) : null}
          <Label onPress={() => onLiveChange(!live)}>{t('features.audit.filters.live')}</Label>
          <Switch
            testID="audit-live"
            isSelected={live}
            onSelectedChange={(on) => {
              triggerHaptic('switchToggle');
              onLiveChange(on);
            }}
            accessibilityLabel={t('features.audit.filters.live')}
            accessibilityHint={t('features.audit.filters.liveHint')}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[1] },
  chipsScroll: { paddingRight: spacing[3] },
  chips: { flexDirection: 'row', flexWrap: 'nowrap', gap: spacing[1] },
  controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[1], minHeight: 48 },
  liveGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], flexShrink: 1 },
  paused: { fontFamily: fontFamily.native.normal, fontSize: typography.caption.size, lineHeight: typography.caption.lineHeight, color: palette.gray },
});
