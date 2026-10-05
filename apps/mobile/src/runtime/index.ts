/**
 * Mobile runtime (step 73; 04_mobile_specs §3.2, §3.7, §5, §6.6; 05_mobile_plan M-06).
 *
 * The step-68 contract stub is replaced by the shared simulator (`@dems/shared/sim`, D19) running
 * behind mobile platform adapters. The exported names and types of step 68 are kept (members were
 * only added, all optional), so the navigation shell (step 70) and its test fakes are unchanged.
 * `RUNTIME_IMPLEMENTATION` now reads `'simulator'` (steps 62, 63 and 74 check it).
 *
 * | Module | What |
 * |---|---|
 * | `contract` | Contract types, `RuntimeContractProvider`, `createRuntimeContract`, the hooks |
 * | `sim-adapters` | AsyncStorage snapshot storage, AppState visibility, `createMobileSim` (§5.2) |
 * | `sim-runtime-provider` | `SimRuntimeProvider`: simulator + hydration gate + Core link + banner + keep-awake |
 * | `use-audio-shared-values` | The transient 20 Hz meter path into Reanimated shared values (§5.4) |
 * | `core-link` | SIMULATED (default, Q-M8), HEARTBEAT or LIVE; the `coreLinkSource` preference |
 * | `route-sync`, `session-route-sync` | `resyncTarget` (§3.7 table) and `SessionRouteSync` |
 * | `keep-awake` | `KeepAwakeController` and the `dems-session` tag (§6.6) |
 * | `connection-banner` | Banner logic: offline / resynced / hidden (S7, MA-10) |
 * | `log` | The persistent, privacy-filtered runtime log (`dems.mobile.log.v1`) |
 * | `debug` | Debug builds only: `&scenario=` and `core=` deep links, `__DEMS_DEBUG__` |
 * | `core-errors` | The refusal presenter of Live mode: one wording for a denied call, a dead link, a limit |
 *
 * Auth (`useAuth().signIn` against the simulator's `auth.ts`, lockout, biometric, idle lock) is
 * provided by `AuthProvider` in `src/auth`, one layer below `SimRuntimeProvider`.
 *
 * **Live mode** (backend task W51; 04_client_integration_spec §7.2). What a screen imports:
 *
 * | To | Import |
 * |---|---|
 * | Know the source and the link | `useCoreLink()` (`source`: SIMULATED, HEARTBEAT, LIVE); `useCoreMode()` of `@dems/shared/live` for the data mode |
 * | Call a Core action | `useCoreActions()` and `settle` of `@dems/shared/live`, in every mode |
 * | Call an operation that is no simulator action | `useMobileLive()?.client.call(operationId, input)` |
 * | Present a refusal | `useCoreErrorPresenter()`; `describeCoreError(error)` where the refusal is drawn in place |
 * | Read the pairing gate | `usePairing()`, `isPairingBlocked(pairing)` |
 * | React to the end of a session or of the pairing | `useLiveSelector((live: MobileLiveSim | null) => live?.lastSessionEnd ?? null)` of `@dems/shared/live`; `useMobileLive()?.onSessionEnd(listener)` |
 * | Register the biometric token storage (the sign-in row) | `useMobileLiveRuntime()?.setBiometricPort(port)` |
 * | Build a Live source in a test | `createMobileLive({ fetch, socketFactory, now, timers })`, then `<AppProviders sim={mobile.sim}>` |
 */
export {
  IDLE_SESSION,
  PAIRING_CHECKING,
  PAIRING_NOT_REQUIRED,
  RUNTIME_IMPLEMENTATION,
  RuntimeContractProvider,
  SIMULATED_ONLINE,
  UNAVAILABLE_AUTH,
  createRuntimeContract,
  initialsFor,
  isPairingBlocked,
  useActiveSession,
  useAuth,
  useCoreLink,
  usePairing,
  useRuntime,
  useRuntimeStatus,
  type ActiveSessionInfo,
  type AuthContract,
  type AuthOperator,
  type CoreLinkInfo,
  type CoreLinkSource,
  type OperatorRole,
  type PairingGateState,
  type PairingInfo,
  type PairingNotice,
  type RuntimeContract,
  type RuntimeContractProviderProps,
  type RuntimeImplementation,
  type RuntimeStatus,
  type SignInFailureReason,
  type SignInResult,
  type SignOutReason,
} from './contract';
export {
  SimRuntimeProvider,
  decideCoreLinkSource,
  logSimError,
  selectActiveSessionInfo,
  simulatorLinkSource,
  useMobileLive,
  useMobileLiveRuntime,
  type SimRuntimeProviderProps,
} from './sim-runtime-provider';
export {
  DEVICE_CREDENTIAL_OPERATIONS,
  FALLBACK_DEVICE_NAME,
  LIVE_CLIENT_REPORT_INTERVAL_MS,
  MOBILE_SECRETS_BUDGET_MS,
  SIM_SNAPSHOT_KEY,
  createAppStateVisibility,
  createAsyncStoragePersistStorage,
  createDeferredPersistStorage,
  createMobileLive,
  createMobileSim,
  createMobileSocketFactory,
  isHiddenAppState,
  liveDeviceDescription,
  logLiveReport,
  mobileLiveOf,
  pairingNoticeOf,
  type AppStateLike,
  type LiveBiometricPort,
  type MobileCoreClient,
  type MobileLive,
  type MobileLiveOptions,
  type MobileLiveSim,
  type MobileSimOptions,
} from './sim-adapters';
export {
  AUDIO_A11Y_INTERVAL_MS,
  AUDIO_A11Y_MAX,
  AUDIO_A11Y_MIN,
  AUDIO_FLOOR_DBFS,
  audioAccessibilityValue,
  useAudioAccessibilityValue,
  useAudioSharedValues,
  writeAudioFrame,
  type AudioAccessibilityValue,
  type AudioSharedValues,
} from './use-audio-shared-values';
export {
  CORE_LINK_SOURCES,
  DEFAULT_CORE_LINK_SOURCE,
  coreLinkStateFor,
  effectiveCoreLinkSource,
  getCoreLinkSource,
  hydrateCoreLinkSource,
  isCoreLinkSourceAvailable,
  isCoreLinkSourceHydrated,
  parseCoreLinkSource,
  resetCoreLinkPrefsForTests,
  setCoreLinkSource,
  tabletLinkForHeartbeat,
  useCoreLinkSource,
  useCoreLinkSourceSetting,
  type CoreLinkSourceSetting,
} from './core-link';
export { hrefPath, isForcedTransition, resyncNavigation, resyncTarget, type ResyncContext, type ResyncTrigger, type SessionHref } from './route-sync';
export { SessionRouteSync } from './session-route-sync';
export {
  KEEP_AWAKE_STATES,
  KEEP_AWAKE_TAG,
  KeepAwakeController,
  createKeepAwakeManager,
  keepAwakeManager,
  shouldKeepAwake,
  type KeepAwakeApi,
  type KeepAwakeControllerProps,
  type KeepAwakeManager,
} from './keep-awake';
export {
  CONNECTION_BANNER_MESSAGE_KEYS,
  RESYNCED_BANNER_MS,
  bannerKindAfterResync,
  connectionBannerFor,
  nextBannerKind,
  useConnectionBanner,
  type ConnectionBanner,
  type ConnectionBannerKind,
} from './connection-banner';
export { createResyncBus, type ResyncBus } from './resync-bus';
export { useRuntimeInternals, type RuntimeInternals } from './internals';
export {
  LAUNCH_ID,
  RUNTIME_LOG_KEY,
  createRuntimeLog,
  installRuntimeLogSinks,
  newCorrelationId,
  reportRuntimeIssue,
  runtimeLog,
  sanitizeLogContext,
  type RuntimeLog,
  type RuntimeLogLevel,
  type RuntimeLogRecord,
} from './log';
export {
  applyLaunchCoreSource,
  coreSourceFromUrl,
  resetDebugLaunchForTests,
  scenarioFromUrl,
  useDebugHandle,
  useDebugScenarioLinks,
  type DemsDebugHandle,
  type RuntimeDebugSnapshot,
} from './debug';
export {
  CORE_ERROR_COALESCE_MS,
  createCoreErrorCoalescer,
  describeCoreError,
  requiredRoleFor,
  resetCoreErrorPresenterForTests,
  useCoreErrorPresenter,
  type CoreErrorCoalescer,
  type CoreErrorKind,
  type CoreErrorOutcome,
  type CoreErrorPresentation,
  type CoreErrorPresenter,
  type CoreErrorText,
} from './core-errors';
