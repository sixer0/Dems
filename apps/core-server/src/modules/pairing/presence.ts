/**
 * Which paired devices are online (plan row W32; spec §6.5 `online`, §6.8).
 *
 * A device is online while it has at least one open authenticated socket. The sockets are the
 * realtime channel's (plan row W42); the registry only needs the answer for its list. So the
 * channel tells this counter when an authenticated socket of a device opens and when it closes,
 * and the registry reads it. Memory state, never stored: after a process start no device is
 * online until its socket is back.
 *
 * Until the realtime channel calls it, every device is offline, which is the truth while no
 * socket can be open.
 */

export interface DevicePresence {
  /** An authenticated socket of this device opened. */
  socketOpened(deviceId: string): void;
  /** One of its sockets closed. A call without an open socket changes nothing. */
  socketClosed(deviceId: string): void;
  /** The device has no socket any more: it was revoked or unpaired, and its sockets are being closed. */
  forget(deviceId: string): void;
  /** True while at least one authenticated socket of the device is open. */
  isOnline(deviceId: string): boolean;
  /** The devices that are online, in no particular order. */
  online(): string[];
  /** Forgets every device (a test; the realtime channel when it closes every socket). */
  reset(): void;
}

export function createDevicePresence(): DevicePresence {
  /** Device ID to its number of open authenticated sockets; never an entry with 0. */
  const sockets = new Map<string, number>();
  return {
    socketOpened(deviceId) {
      sockets.set(deviceId, (sockets.get(deviceId) ?? 0) + 1);
    },
    socketClosed(deviceId) {
      const open = sockets.get(deviceId);
      if (open === undefined) return;
      if (open <= 1) sockets.delete(deviceId);
      else sockets.set(deviceId, open - 1);
    },
    forget(deviceId) {
      sockets.delete(deviceId);
    },
    isOnline: (deviceId) => sockets.has(deviceId),
    online: () => [...sockets.keys()],
    reset() {
      sockets.clear();
    },
  };
}
