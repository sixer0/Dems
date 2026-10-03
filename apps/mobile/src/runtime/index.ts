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
 * | `core-link` | SIMULATED (default, Q-M8) or HEARTBEAT; the `coreLinkSource` preference |
 * | `route-sync`, `session-route-sync` | `resyncTarget` (§3.7 table) and `SessionRouteSync` |
 * | `keep-awake` | `KeepAwakeController` and the `dems-session` tag (§6.6) |
 * | `connection-banner` | Banner logic: offline / resynced / hidden (S7, MA-10) |
 * | `log` | The persistent, privacy-filtered runtime log (`dems.mobile.log.v1`) |
 * | `debug` | Debug builds only: `&scenario=` deep links, `__DEMS_DEBUG__` |
 *
 * Auth (`useAuth().signIn` against the simulator's `auth.ts`, lockout, biometric, idle lock) is
 * provided by `AuthProvider` in `src/auth`, one layer below `SimRuntimeProvider`.
 */
export {
  IDLE_SESSION,
  RUNTIME_IMPLEMENTATION,
  RuntimeContractProvider,
  SIMULATED_ONLINE,
  UNAVAILABLE_AUTH,
  createRuntimeContract,
  initialsFor,
  useActiveSession,
  useAuth,
  useCoreLink,
  useRuntime,
  useRuntimeStatus,
  type ActiveSessionInfo,
  type AuthContract,
  type AuthOperator,
  type CoreLinkInfo,
  type CoreLinkSource,
  type OperatorRole,
  type RuntimeContract,
  type RuntimeContractProviderProps,
  type RuntimeImplementation,
  type RuntimeStatus,
  type SignInFailureReason,
  type SignInResult,
  type SignOutReason,
} from './contract';
export { SimRuntimeProvider, logSimError, selectActiveSessionInfo, type SimRuntimeProviderProps } from './sim-runtime-provider';
export {
  SIM_SNAPSHOT_KEY,
  createAppStateVisibility,
  createAsyncStoragePersistStorage,
  createMobileSim,
  isHiddenAppState,
  type AppStateLike,
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
export { scenarioFromUrl, useDebugHandle, useDebugScenarioLinks, type DemsDebugHandle, type RuntimeDebugSnapshot } from './debug';
