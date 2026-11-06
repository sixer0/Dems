/**
 * The Alert of `useAuthSession().notice` (backend task W56; 04_client_integration_spec §6.4, §6.5,
 * MB-3, WS-14): what LIVE mode has to say on the Login screen beyond the three existing notices
 * ("signed out", "console locked", "session expired").
 *
 * | Notice | Sentence | Status |
 * |---|---|---|
 * | `token-reuse` | "Biometric sign-in was turned off on this device because its token was used a second time. Sign in with your password." | danger |
 * | `biometric-invalid` | "Biometric sign-in is no longer valid on this device. Sign in with your password to enable it again." | danger |
 * | `user-disabled` | "This account was disabled by an administrator." | danger |
 * | `absolute-expired` | "Your session reached its 8-hour limit. Sign in again." | accent |
 *
 * One sentence in the Alert's title, as the Login card's own notices are drawn. It renders nothing
 * while there is no notice (signed in, SIMULATED or HEARTBEAT mode, outside `AuthProvider`). The
 * Login screen places it; a screen that draws its own Alert reads `notice.textKey` instead.
 */
import { Alert } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import { useAuthSession } from './auth-session';
import './i18n-bundle';

export interface AuthNoticeAlertProps {
  /** Default: `auth-notice-<kind>`. */
  testID?: string;
}

export function AuthNoticeAlert({ testID }: AuthNoticeAlertProps) {
  const { t } = useTranslation();
  const { notice } = useAuthSession();
  if (notice === null) return null;
  return (
    <Alert status={notice.status} testID={testID ?? `auth-notice-${notice.kind}`}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{t(notice.textKey)}</Alert.Title>
      </Alert.Content>
    </Alert>
  );
}
