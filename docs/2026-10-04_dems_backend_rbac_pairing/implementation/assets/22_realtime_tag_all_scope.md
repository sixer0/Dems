<!-- Generated: the description of the Realtime tag in the OpenAPI document of the scope "all" (plan row W22). Command: node --import tsx packages/shared/scripts/gen-openapi.ts --scope all --print -->

**LIVE** WebSocket `ws://127.0.0.1:4400/ws` served by mock-core. OpenAPI 3.1 cannot describe a socket, so it is documented here and shown live in the Realtime panel next to this reference.

- Server to client only: one JSON `Heartbeat` message (see the Heartbeat model) per text frame every 1000 ms, plus one immediately after connecting.
- `seq` counts ticks since the server started. `sessionState` is `null` in this demo phase.
- Upgrades from origins other than the web dev origins and the service's own origins are refused with 403.
- Clients show the link as STALE after 2500 ms without a heartbeat and reconnect after 0.5 s, 1 s, 2 s, 4 s, 8 s (the last delay repeats), plus up to 250 ms of jitter.
- Messages sent by clients are ignored.

Example message:

```json
{
  "type": "heartbeat",
  "v": 1,
  "seq": 5400,
  "serverTime": "2026-10-01T03:00:00.000Z",
  "uptimeMs": 5400012,
  "intervalMs": 1000,
  "clients": 2,
  "sessionState": null
}
```

### Core server

The Core server (`dems-core-server`) serves `/ws` on its own port with the protocol below. mock-core, above, sends the heartbeat only.

**Who a connection is.** Decided once, at the upgrade, from the request headers only: the session cookie of a web console, or `Authorization: Bearer` of a paired device. Nothing in the URL, in a subprotocol or in a message authenticates. The principal stays for the life of the connection, so a client opens a new socket after a sign-in or a sign-out.

| Principal | Receives |
|---|---|
| ANONYMOUS | `hello`, `heartbeat` |
| DEVICE | `hello`, `heartbeat`, `device.revoked` |
| OPERATOR | `hello`, `heartbeat`, `snapshot`, `delta`, `meters`, `session.updated`, `session.ended`, `device.revoked`, `admin.changed` |

**Server to client.** One JSON object per text frame; every message carries `type` and `v: 1`.

| `type` | Topic | Members | Model | Sent to |
|---|---|---|---|---|
| `hello` | none | `connectionId`, `epoch`, `principal`, `reason?`, `topics`, `serverTime`, `heartbeatIntervalMs` | RealtimeHello | Every connection, first. |
| `heartbeat` | heartbeat | `seq`, `serverTime`, `uptimeMs`, `intervalMs`, `clients`, `sessionState` | Heartbeat | Every connection, once a second. `sessionState` is null unless the principal is OPERATOR. |
| `snapshot` | state | `epoch`, `revision`, `serverTime`, `state` | RealtimeSnapshot | OPERATOR: after `hello`, as the answer to `resync`, and when a new epoch starts. |
| `delta` | state | `epoch`, `revision`, `serverTime`, `ops` | RealtimeDelta | OPERATOR, for every change of a replicated slice. |
| `meters` | meters | `at`, `seq`, `audio` | RealtimeMeters | OPERATOR, after `subscribe`. |
| `session.updated` | control | `operator` (`id`, `role`), `permissions`, `reason` | RealtimeSessionUpdated | The sockets of the operator's sessions. |
| `session.ended` | control | `reason` | RealtimeSessionEnded | The sockets of the session, which are then closed with 4401. |
| `device.revoked` | control | `reason` | RealtimeDeviceRevoked | The sockets of the device, signed in or not, which are then closed with 4403. |
| `admin.changed` | admin | `resource` | RealtimeAdminChanged | OPERATOR holding USER_ADMIN (`USERS`) or PAIRING_MANAGE (`DEVICES`, `PAIRING_CODE`). |

**Client to server.** Anything else, or a message from a principal that may not send it, closes the connection with 1008.

| `type` | Members | Allowed for | Effect |
|---|---|---|---|
| `subscribe` | `topic: meters` | OPERATOR | The server starts the `meters` frames. |
| `unsubscribe` | `topic: meters` | OPERATOR | The server stops them. |
| `resync` | none | OPERATOR | The server answers with a new `snapshot`. At most one in 2 s. |

**State.** After `hello` an OPERATOR connection gets one `snapshot` with the 28 replicated slices (the ReplicatedState model). Every later change is a `delta` whose `revision` is the previous one plus 1 within the `epoch`: revisions have no gap, and a state delta is never dropped. A delta holds operations: `replace` carries one whole slice, `append` carries new rows of `audit` (with `head`, `total` and `dropped`) or of `events`. A slice that no operation names did not change. A client that sees a gap, or another epoch, sends `resync` (at most one in 2 s) and gets a new `snapshot`. A demo reset, a scenario load and a server start begin a new epoch. A 2xx answer of a POST carries the same two numbers in `x-dems-epoch` and `x-dems-revision`, so a client knows which delta holds the effect of its command. Not replicated: `clock`, `auth`, `authLockout`, `pairing`, `audio`. The audio frames travel in `meters` only; a client builds the other four itself, from the server time and from the answers of the identity and pairing operations.

**Time.** `heartbeat.serverTime` is an ISO-8601 string, as mock-core writes it. Every other time of the protocol is epoch milliseconds on the server clock.

**Close codes.**

| Code | When | What a client does |
|--:|---|---|
| 1001 | Server shutdown. | Reconnect with the backoff. |
| 1008 | Protocol violation: an unknown message, one the principal may not send, or too many. | Reconnect. |
| 1013 | The connection cap is reached. | Reconnect later. |
| 4401 | The session ended (any reason of `session.ended`), or the bearer value is not valid. | Show the login screen. A web console opens an anonymous socket for the heartbeat. |
| 4403 | The device was revoked or unpaired. | Delete the device credential and show the pairing screen. |
| 4408 | The client did not read fast enough; no state delta is dropped instead. | Reconnect and resynchronise. |

**Never in a message.** A password, a session token, a cookie value, a device credential, a biometric token, a pairing code or a QR payload, or any hash or salt of those; the `enabled` flag or the session list of another operator; the list of paired devices; the lockout state of another console. `admin.changed` names the list that changed and holds no row of it.

**Examples.**

`hello` to a signed-in investigator:

```json
{
  "type": "hello",
  "v": 1,
  "connectionId": "00000000-0000-4000-8000-0000000000a1",
  "epoch": 3,
  "principal": "OPERATOR",
  "topics": [
    "heartbeat",
    "control",
    "state",
    "meters"
  ],
  "serverTime": 1790823600000,
  "heartbeatIntervalMs": 1000
}
```

`hello` to a connection whose cookie no longer resolves to a session:

```json
{
  "type": "hello",
  "v": 1,
  "connectionId": "00000000-0000-4000-8000-0000000000a5",
  "epoch": 3,
  "principal": "ANONYMOUS",
  "reason": "SESSION_INVALID",
  "topics": [
    "heartbeat"
  ],
  "serverTime": 1790823600000,
  "heartbeatIntervalMs": 1000
}
```

`delta`:

```json
{
  "type": "delta",
  "v": 1,
  "epoch": 3,
  "revision": 129,
  "serverTime": 1790823600000,
  "ops": [
    {
      "op": "replace",
      "slice": "tabletLink",
      "value": {
        "state": "CONNECTED",
        "changedAt": 1790823600000
      }
    },
    {
      "op": "append",
      "slice": "events",
      "rows": [
        {
          "id": "LOG-000061",
          "seq": 61,
          "at": 1790823600000,
          "type": "TABLET_CONNECTED",
          "severity": "INFO",
          "message": "Tablet connected",
          "params": {
            "state": "CONNECTED"
          },
          "sessionId": "SES-20261001-0024",
          "deviceId": "TABLET"
        }
      ]
    }
  ]
}
```

`meters`:

```json
{
  "type": "meters",
  "v": 1,
  "at": 1790823600000,
  "seq": 22440,
  "audio": {
    "channels": {
      "AUDIO-01": {
        "seq": 22440,
        "at": 1790823600000,
        "dbfs": -18.4,
        "peak": -12.1,
        "clip": false,
        "noSignal": false
      },
      "AUDIO-02": {
        "seq": 22440,
        "at": 1790823600000,
        "dbfs": -51.7,
        "peak": -50.9,
        "clip": false,
        "noSignal": false
      }
    }
  }
}
```

`session.updated`:

```json
{
  "type": "session.updated",
  "v": 1,
  "operator": {
    "id": "OPR-001",
    "role": "TECHNICIAN"
  },
  "permissions": [
    "EVIDENCE_VIEW",
    "DEVICE_MANAGE",
    "DIAGNOSTICS_RUN",
    "MAINTENANCE"
  ],
  "reason": "ROLE_CHANGED"
}
```

`session.ended`:

```json
{
  "type": "session.ended",
  "v": 1,
  "reason": "TOKEN_REUSE"
}
```

`device.revoked`:

```json
{
  "type": "device.revoked",
  "v": 1,
  "reason": "REVOKED"
}
```

`admin.changed`:

```json
{
  "type": "admin.changed",
  "v": 1,
  "resource": "USERS"
}
```

`subscribe`, sent by a client:

```json
{
  "type": "subscribe",
  "topic": "meters"
}
```

`resync`, sent by a client:

```json
{
  "type": "resync"
}
```
