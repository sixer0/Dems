/**
 * `apiReference.*`: the API Reference page frame (01_specs §14.9; research/04 §5.9).
 * Copy inside the Scalar renderer comes from the OpenAPI document, not from here.
 */
import type { ResourceTree } from '../resource-tree';

export const apiReference = {
  title: 'API REFERENCE',
  subtitle: 'Core API v1 • OpenAPI • local mock-core {{address}}',
  banner: {
    ONLINE: 'MOCK-CORE ONLINE • v{{version}} • WS 1 Hz',
    ONLINE_NO_VERSION: 'MOCK-CORE ONLINE • WS 1 Hz',
    CONNECTING: 'CONNECTING',
    OFFLINE: 'MOCK-CORE OFFLINE • live try-it unavailable',
    detail: 'LIVE try-it goes to {{address}}; SIMULATED try-it is answered in this browser',
  },

  server: {
    baseUrl: 'Base URL',
    specVersion: 'Spec version',
    download: 'Download openapi.json',
    copyBaseUrl: 'Copy base URL',
    showSimulated: 'Show simulated endpoints',
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
  },

  states: {
    loading: 'Loading API specification…',
    invalidTitle: 'API specification invalid',
    invalidBody: 'The OpenAPI document failed validation.',
    rendererTitle: 'API reference unavailable',
    rendererBody: 'The reference renderer could not start. The endpoints are still listed in openapi.json.',
  },
} as const satisfies ResourceTree;
