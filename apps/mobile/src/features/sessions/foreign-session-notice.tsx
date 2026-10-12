/**
 * "This session was set up by another operator" (fix wave J round two, ruling (d); finding JM-09).
 *
 * After a sign-in the device opens on whatever the Core's open session is, whoever made it: the Ready step of
 * a session another operator armed, or that operator's unacknowledged Summary. Nothing said so. This is the
 * ONE sentence, the same in both layouts: whose session it is, and what THIS operator can do with it.
 *
 * What an operator can do is the Core's rule, not a guess: start, end, cancel and acknowledge need
 * `SESSION_START` (investigator, supervisor) and are not bound to the creator; only the microphone switch is
 * (operation 81, its own sentence on the monitor). A role without `SESSION_START` can do nothing with it.
 * Nothing is drawn for the operator's own session, without a session, or while the role is unknown.
 */
import { Alert } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import { OperatorRole, Permission, roleHas, selectOperator, selectOperatorById, useSim } from '@dems/shared/sim';

export type ForeignSessionSurface = 'setup' | 'summary';
export type ForeignSessionCan = 'ACT' | 'NOTHING';

/** Pure: null = no notice (own session, nobody signed in, no creator known). */
export function foreignSessionOf(input: { readonly operatorId: string | null; readonly role: OperatorRole | null; readonly createdBy: string | null }): ForeignSessionCan | null {
  if (input.operatorId === null || input.role === null || input.createdBy === null) return null;
  if (input.operatorId === input.createdBy) return null;
  return roleHas(input.role, Permission.SESSION_START) ? 'ACT' : 'NOTHING';
}

export interface ForeignSessionNoticeProps {
  surface: ForeignSessionSurface;
  /** The operator who created the session (`session.createdBy`), or null. */
  createdBy: string | null;
  testID?: string;
}

export function ForeignSessionNotice({ surface, createdBy, testID = 'foreign-session-notice' }: ForeignSessionNoticeProps) {
  const { t } = useTranslation();
  const operator = useSim(selectOperator);
  const creatorName = useSim((s) => selectOperatorById(s, createdBy)?.displayName ?? null);
  const can = foreignSessionOf({ operatorId: operator?.id ?? null, role: operator?.role ?? null, createdBy });
  if (can === null || createdBy === null || operator === null) return null;
  const who = creatorName === null ? createdBy : `${creatorName} (${createdBy})`;
  const sentence =
    can === 'NOTHING'
      ? t('features.sessions.foreign.nothing', { who, role: t(`common.roles.${operator.role}`) })
      : t(`features.sessions.foreign.${surface}`, { who });
  return (
    <Alert status="default" testID={testID} accessibilityLiveRegion="polite">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description testID={`${testID}-sentence`}>{sentence}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
