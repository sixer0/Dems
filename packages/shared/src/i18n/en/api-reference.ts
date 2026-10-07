/**
 * `apiReference.*`: the API Reference page frame (01_specs §14.9; research/04 §5.9).
 * Copy inside the Scalar renderer comes from the OpenAPI document, not from here.
 * Plan row W84 added the keys of Live mode and of the "Show Core-server endpoints" switch (backend
 * task 04_client_integration_spec §11): `subtitleLive`, `banner.live`, `server.showCoreServer`,
 * `badges.CORE_SERVER`, `tooltips.coreServer`, `tooltips.liveCore`, `tryIt`, `liveWarning`,
 * `realtime.live`.
 */
import type { ResourceTree } from '../resource-tree';

export const apiReference = {
  title: 'API REFERENCE',
  subtitle: 'Core API v1 • OpenAPI • local mock-core {{address}}',
  subtitleLive: 'Core API v1 • OpenAPI • Core server through {{address}}',
  banner: {
    ONLINE: 'MOCK-CORE ONLINE • v{{version}} • WS 1 Hz',
    ONLINE_NO_VERSION: 'MOCK-CORE ONLINE • WS 1 Hz',
    CONNECTING: 'CONNECTING',
    OFFLINE: 'MOCK-CORE OFFLINE • live try-it unavailable',
    detail: 'LIVE try-it goes to {{address}}; SIMULATED try-it is answered in this browser',
    live: {
      ONLINE: 'CORE SERVER ONLINE • {{service}} v{{version}} • {{readiness}}',
      ONLINE_NO_VERSION: 'CORE SERVER ONLINE • WS 1 Hz',
      CONNECTING: 'CONNECTING TO THE CORE SERVER',
      OFFLINE: 'CORE SERVER OFFLINE • try-it unavailable',
      ready: 'READY',
      starting: 'STARTING',
      detail: 'Try it goes to the Core server through {{address}}, as the signed-in operator',
    },
  },

  server: {
    baseUrl: 'Base URL',
    specVersion: 'Spec version',
    download: 'Download openapi.json',
    copyBaseUrl: 'Copy base URL',
    showSimulated: 'Show simulated endpoints',
    showCoreServer: 'Show Core-server endpoints',
    legend: 'Legend',
    copied: 'Base URL copied',
    copyFailed: 'Could not copy the base URL',
    downloaded: 'openapi.json saved',
    downloadFailed: 'Could not create openapi.json',
    operations_one: '{{count}} operation',
    operations_other: '{{count}} operations',
  },

  renderer: {
    title: 'Core API v1 • OpenAPI 3.1',
  },

  badges: {
    LIVE: 'LIVE',
    SIMULATED: 'SIMULATED',
    RBAC_AUDIT: 'RBAC + AUDIT',
    CORE_SERVER: 'CORE SERVER',
  },

  bookGaps: {
    title: 'Not defined in the design book',
    body: 'The design book does not define auth, pairing, metadata, evidence-list, audit-list or verify endpoints, nor a WebSocket schema. They are left out on purpose.',
  },

  tooltips: {
    live: 'Served over the loopback network by mock-core.',
    simulated: 'Simulated in the browser. No network call is made.',
    rbac: 'Checked against the role of the signed-in operator, and audited.',
    offline: 'mock-core unreachable at {{address}}',
    coreServer: 'Answered by the Core server only. Switch to Live mode to try it.',
    liveCore: 'Answered over the network by the Core server, as the signed-in operator.',
  },

  tryIt: {
    coreServerOnly: 'This operation is answered by the Core server. Switch to Live mode to try it.',
    secretDenied: 'This operation carries or returns a secret and cannot be tried from the reference page.',
  },

  liveWarning: {
    body: "Try it sends real requests to the Core server as {{operator}}. Commands change the Core's state and are recorded in the audit log.",
    unknownOperator: 'the signed-in operator',
  },

  realtime: {
    title: 'Realtime',
    endpoint: 'WS /ws',
    url: 'WebSocket URL',
    connection: 'Connection',
    state: {
      ONLINE: 'ONLINE',
      CONNECTING: 'CONNECTING',
      OFFLINE: 'OFFLINE',
    },
    fields: {
      seq: 'Sequence',
      serverTime: 'Server time',
      uptime: 'Uptime',
      clients: 'Clients',
      interval: 'Interval',
      sessionState: 'Session state',
    },
    lastMessages: 'Last {{count}} messages',
    connect: 'Connect',
    disconnect: 'Disconnect',
    none: 'none',
    copyUrl: 'Copy WebSocket URL',
    copied: 'WebSocket URL copied',
    copyFailed: 'Could not copy the WebSocket URL',
    waiting: 'Waiting for the first heartbeat…',
    paused: 'Disconnected. Turn Connect on to resume.',
    reconnecting: 'mock-core unreachable at {{address}}. Reconnecting automatically.',
    originBlocked:
      'The live heartbeat needs the dev origin {{origin}} (mock-core allowlist). This page is served from {{current}}.',
    live: {
      note: "The console's one socket to the Core server. State payloads are not shown.",
      reconnecting: 'Core server unreachable at {{address}}. The console reconnects by itself.',
      epoch: 'Epoch',
      revision: 'Revision',
      meters: 'Meter frames',
      metersRate: '{{rate}} per second',
      metersNone: 'none',
    },
  },

  states: {
    loading: 'Loading API specification…',
    invalidTitle: 'API specification invalid',
    invalidBody: 'The OpenAPI document failed validation.',
    rendererTitle: 'API reference unavailable',
    rendererBody: 'The reference renderer could not start. The endpoints are still listed in openapi.json.',
  },
} as const satisfies ResourceTree;
