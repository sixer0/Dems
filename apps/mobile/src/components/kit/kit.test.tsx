// Kit recipes (04_mobile_specs §4.0): StatusChip, SubjectTypeChip, SectionCard, KeyValueList, cn.
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { HeroUINativeProvider } from 'heroui-native';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';
import { toneTextHex } from '@dems/shared/tokens';
import { KeyValueList, SectionCard, StatusChip, SubjectTypeChip, cn, type SubjectType } from '@/components/kit';
import { SubjectTypeCodeTone, toSubjectTypeCode, type SubjectTypeCode } from '@/components/kit/subject-type-chip';
import { i18n } from '@/i18n';

function renderKit(ui: ReactNode) {
  return render(
    <I18nextProvider i18n={i18n}>
      <HeroUINativeProvider>{ui}</HeroUINativeProvider>
    </I18nextProvider>,
  );
}

describe('cn', () => {
  it('keeps a typography size next to a colour (D41(d), S17-1)', () => {
    expect(cn('font-display text-display', 'text-accent')).toBe('font-display text-display text-accent');
  });

  it('resolves real conflicts, last wins, and skips falsy values', () => {
    expect(cn('text-h1', false, undefined, 'text-h2')).toBe('text-h2');
    expect(cn('rounded-3xl', 'rounded-xl')).toBe('rounded-xl');
  });
});

describe('StatusChip', () => {
  it('renders a design badge with its label (SEALED → violet sealed tone)', () => {
    renderKit(<StatusChip badge="SEALED" testID="chip-sealed" />);
    expect(screen.getByTestId('chip-sealed')).toBeTruthy();
    const label = screen.getByText('Sealed');
    // `sealed` has no kit colour: the label takes the token text colour (01S §2.10 recipe).
    expect(StyleSheet.flatten(label.props.style)).toMatchObject({ color: toneTextHex.sealed });
  });

  it('renders a tone chip with a custom label and accessibility label', () => {
    renderKit(<StatusChip tone="success" label="READY" icon="CircleCheck" testID="chip-ready" />);
    expect(screen.getByText('READY')).toBeTruthy();
    expect(screen.getByTestId('chip-ready').props.accessibilityLabel).toBe('READY');
  });

  it('lets a badge label be overridden (i18n copy)', () => {
    renderKit(<StatusChip badge="RECORDING" label="SEDANG MEREKAM" iconFilled />);
    expect(screen.getByText('SEDANG MEREKAM')).toBeTruthy();
    expect(screen.queryByText('Recording')).toBeNull();
  });
});

describe('SubjectTypeChip', () => {
  const glosses: [type: SubjectType, gloss: string][] = [
    ['Tersangka', 'Suspect'],
    ['Saksi', 'Witness'],
    ['Lainnya', 'Other'],
  ];

  it.each(glosses)('%s keeps the verbatim term with the English gloss %s as hint', (type, gloss) => {
    renderKit(<SubjectTypeChip type={type} testID={`subject-${type}`} />);
    expect(screen.getByText(type)).toBeTruthy();
    expect(screen.getByTestId(`subject-${type}`).props.accessibilityHint).toBe(gloss);
  });

  it('colours Saksi with the info recipe text colour', () => {
    renderKit(<SubjectTypeChip type="Saksi" />);
    expect(StyleSheet.flatten(screen.getByText('Saksi').props.style)).toMatchObject({ color: toneTextHex.info });
  });

  // D73 (F74-03, step 78): screens pass the simulator codes straight from simulator objects.
  const codes: [code: SubjectTypeCode, label: string, gloss: string][] = [
    ['TERSANGKA', 'Tersangka', 'Suspect'],
    ['SAKSI', 'Saksi', 'Witness'],
    ['LAINNYA', 'Lainnya', 'Other'],
  ];

  it.each(codes)('accepts the simulator code %s (label %s, hint %s from common.subjectType)', (code, label, gloss) => {
    renderKit(<SubjectTypeChip type={code} testID={`subject-code-${code}`} />);
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByTestId(`subject-code-${code}`).props.accessibilityHint).toBe(gloss);
    expect(i18n.t(`common.subjectType.${code}`)).toBe(label);
  });

  it('colours TERSANGKA with the danger tone and normalises either spelling', () => {
    renderKit(<SubjectTypeChip type="TERSANGKA" />);
    expect(StyleSheet.flatten(screen.getByText('Tersangka').props.style) ?? {}).not.toMatchObject({ color: toneTextHex.info });
    expect(SubjectTypeCodeTone.TERSANGKA).toBe('danger');
    expect(toSubjectTypeCode('Saksi')).toBe('SAKSI');
    expect(toSubjectTypeCode('lainnya')).toBe('LAINNYA');
    expect(toSubjectTypeCode('unknown')).toBe('LAINNYA');
  });
});

describe('SectionCard', () => {
  it('renders title, description, action, body and footer', () => {
    renderKit(
      <SectionCard
        testID="card"
        title="Recent Sessions"
        description="Latest three"
        action={<Text>See All</Text>}
        footer={<Text>footer</Text>}
      >
        <Text>body</Text>
      </SectionCard>,
    );
    expect(screen.getByTestId('card')).toBeTruthy();
    expect(screen.getByRole('header')).toHaveTextContent('Recent Sessions');
    for (const text of ['Latest three', 'See All', 'body', 'footer']) expect(screen.getByText(text)).toBeTruthy();
  });

  it('omits the header when there is no title, description or action', () => {
    renderKit(
      <SectionCard testID="bare">
        <Text>only body</Text>
      </SectionCard>,
    );
    expect(screen.queryByRole('header')).toBeNull();
    expect(screen.getByText('only body')).toBeTruthy();
  });
});

describe('KeyValueList', () => {
  it('renders one row per item; text rows read as "label, value"', () => {
    renderKit(
      <KeyValueList
        testID="kv"
        items={[
          { id: 'case', label: 'Case Number', value: 'LP/2026/1001-0007', mono: true, testID: 'kv-case' },
          { id: 'room', label: 'Room', value: 'Interview Room 1', testID: 'kv-room' },
          { id: 'status', label: 'Status', value: <StatusChip badge="SEALED" />, testID: 'kv-status' },
        ]}
      />,
    );
    expect(screen.getByTestId('kv')).toBeTruthy();
    expect(screen.getByTestId('kv-case').props.accessibilityLabel).toBe('Case Number, LP/2026/1001-0007');
    expect(screen.getByText('Interview Room 1')).toBeTruthy();
    expect(screen.getByTestId('kv-status').props.accessibilityLabel).toBeUndefined();
    expect(screen.getByText('Sealed')).toBeTruthy();
  });
});
