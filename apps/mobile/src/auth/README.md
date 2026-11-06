# `apps/mobile/src/auth`

Up: [`src/`](../README.md)

## Purpose

The sign-in layer of the app, one level below the runtime provider. `AuthProvider` serves the simulator's auth and hands over to `LiveAuthProvider` when the runtime runs the Live source; both give the screens one auth session (`useAuthSession()`): sign-in, sign-out, lockout, the idle lock and the biometric offer. Biometric sign-in in Live mode uses a single-use token kept by `live-biometric.ts`; it is off in release builds (D199, residual R174-G5). The `dems.mobile.auth.v1` preferences hold only `lastOperatorId` and `biometricEnabled`.

## Contents

| Entry | Role |
|---|---|
| `auth-dialogs.tsx` | The two global auth dialogs, rendered once by `AuthProvider` so they survive the route change a sign-in or an expiry causes: - `IdleLockDialog` |
| `auth-notice.tsx` | The Alert that shows `useAuthSession().notice`. |
| `auth-prefs.ts` | Biometric preferences. Holds exactly `{ lastOperatorId, biometricEnabled }` |
| `auth-provider.test.tsx` | Test: AuthProvider: the simulator auth behind `useAuth()`, the §6.1 lockout, the heartbeat-mode Core-offline gate, the idle lock, Lock console, and the biometric offer / sign-in. |
| `auth-provider.tsx` | `AuthProvider`: the auth session over the simulator's auth. |
| `auth-session.tsx` | What the two auth providers share: the auth session the screens read (`useAuthSession()`), the pure mappings of a sign-in, the activity throttle of the idle lock, and the frame both providers render. ... |
| `biometric.test.ts` | Test: The biometric sign-in branches — success, user_cancel, lockout, not_enrolled, authentication_failed — against the expo-local-authentication jest mock (jest.setup.ts) and the real simulator auth. |
| `biometric.ts` | Biometric sign-in service. Flow of the Login fingerprint button: 1. |
| `i18n-bundle.ts` | Mounts the auth layer's copy (`./i18n.ts`) at `features.auth.*` of the app's i18n instance. The registry of feature resources is `src/i18n/features.ts`, which this row may not write. So the tree is added to the ... |
| `i18n.ts` | English copy of the auth layer in LIVE mode, mounted at `features.auth.*` (`./i18n-bundle.ts`). |
| `index.ts` | Public surface of the auth layer (re-exports). |
| `live-auth-model.test.ts` | Test: The pure rules of the auth layer in LIVE mode (`./live-auth-model.ts`) |
| `live-auth-model.ts` | The rules of the auth layer in LIVE mode, as pure functions. Nothing here calls the Core, a storage or React. It imports the light Live API (the error classes) and types only, so it is part of every build; the ... |
| `live-auth-provider.tsx` | `LiveAuthProvider`: the auth session over the Core in Live mode, including biometric enrolment (`setBiometricEnrollment`). |
| `live-auth-static.test.ts` | Test: Tests "the production files of the auth layer". |
| `live-auth.test.tsx` | Test: The auth layer in LIVE mode (`LiveAuthProvider`), mounted by the real `AppProviders` over the app's Live source and the contract-checked fake transport. The Core server is a small model the fake's ... |
| `live-biometric.test.ts` | Test: The biometric token storage of LIVE mode (`./live-biometric.ts`) on the secure-store mock of `jest.setup.ts`. |
| `live-biometric.ts` | The biometric token storage of LIVE mode. In LIVE mode the Core never takes "the fingerprint matched" as a sign-in. It takes a single-use token: issued once at enrolment (operation 7), sent with operation 8, replaced ... |
| `operators.ts` | Simulator operators → the contract's `AuthOperator`. |

## Main exports

- Public surface (`index.ts`): `AuthProvider`, `ACTIVITY_THROTTLE_MS`, `isSignInBlocked`, `lockoutInfoOf`, `toContractSignInResult`, `useAuthSession`, `BiometricOfferDialog`, `IdleLockDialog`, `AuthNoticeAlert`, `DEFAULT_AUTH_PREFS`, `MOBILE_AUTH_KEY`, `getAuthPrefs`, `hydrateAuthPrefs`, `parseAuthPrefs`, `readAuthPrefs`, `resetAuthPrefsForTests`, `setAuthPrefs`, `useAuthPrefs`, `writeAuthPrefs`, `applyBiometricOutcome`, `biometricPromptOptions`, `biometricSignIn`, `fromFailure`, `getBiometricAvailability`, `promptBiometric`, `promptOutcomeFor`, `authEn`, `authNotice`, `biometricPromptPlan`, `biometricTokenFate`, `errorOfCallFailure`, `expiryOf`, `noticeOfSessionEnd`, `rejectedSignIn`, `signOutReasonOf`, `findAuthOperator`, `toAuthOperator`.
- Hooks: `useAuthPrefs`, `useAuthSession`, `useActivityTouch`.
- Components: `IdleLockDialog`, `BiometricOfferDialog`, `AuthNoticeAlert`, `AuthProvider`, `AuthFrame`, `LiveAuthProvider`.

## Tests

6 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

From `decisions.md` of the 2026-11-05 team update audit:

- D199: row 174: biometric sign-in stays off in release builds (residual R174-G5).
- D211: row 224: live-auth-provider comments, owed sign-out after an offline sign-out.
