// The stored-address cases of task 4 row 143 (AD-02 (1)), shared by the three test files that hold
// the production camera adapter, the camera watch and the judgement itself to them. Not a test file.
//
// THE RULE IS THE REAL ONE: `decideDestination` of `src/capture/destination-rule.ts` with the
// purpose `STORED_CAMERA`, bound here to HAND-WRITTEN host facts (no interface of this Mac is
// read): a camera interface 192.168.50.1 in 192.168.50.0/24, an office interface 10.20.0.5 in
// 10.20.0.0/24. Every address below is a text nothing contacts: the doubles of those files have no
// socket.
//
// R-FLEX (row 103, RF-N1, RF-N7): `STORED_CAMERA` is GLOBAL. The facts carry `interfaceSubnets` (NW-C1),
// without which the purpose is refused NOT_CONFIGURED; the source is the on-link interface's address,
// the office interface included. Lifted pins: OUTSIDE_CAMERA_SUBNET -> NO_SOURCE_INTERFACE, and
// OTHER_INTERFACE_SUBNET -> admitted from 10.20.0.5 (`ADMITTED_OFFICE_HOST`).
import { DestinationPurpose, decideDestination, type DestinationContext } from '../../../destination-rule';
import { CaptureAdapterKind } from '../../kinds';
import type { CameraCandidate } from '../../types';
import type { StoredCameraAddressRule } from '../stored-address';

export const HOST_FACTS: DestinationContext = Object.freeze({
  cameraSubnet: { network: '192.168.50.0', prefixLength: 24 },
  cameraAddresses: [{ address: '192.168.50.1', alias: false }],
  otherInterfaceSubnets: [{ network: '10.20.0.0', prefixLength: 24 }],
  interfaceSubnets: [
    { name: 'eth1', address: '192.168.50.1', network: '192.168.50.0', prefixLength: 24 },
    { name: 'eth0', address: '10.20.0.5', network: '10.20.0.0', prefixLength: 24 },
  ],
  hostAddresses: ['10.20.0.5'],
});

/** The product's rule on a stored camera address, as a composition binds it. */
export const REAL_RULE: StoredCameraAddressRule = (host, port) => decideDestination({ purpose: DestinationPurpose.STORED_CAMERA, address: host, ...(port === undefined ? {} : { port }) }, HOST_FACTS);

/** An address the real rule admits on these facts. */
export const ADMITTED_HOST = '192.168.50.20';
/** R-FLEX: an address on the office interface's subnet, admitted with that interface's address as the source. */
export const ADMITTED_OFFICE_HOST = '10.20.0.77';

/** A stored camera at `host`, in the form the composition hands it on: its service address on that host. */
export const storedCameraAt = (host: string, port: number | null = null): CameraCandidate => ({
  adapterKind: CaptureAdapterKind.ONVIF_RTSP,
  host,
  serviceAddress: `http://${host}${port === null ? '' : `:${port}`}/onvif/device_service`,
  endpointRef: null,
  vendor: null,
  model: null,
  name: null,
  testable: true,
  conflict: false,
});

export interface RefusedStoredAddress {
  /** The class of AD-02 (1), or of the brief of row 143, the case stands for. */
  readonly className: string;
  readonly candidate: CameraCandidate;
  /** The code word the judgement must name. */
  readonly refusal: string;
}

/**
 * THE FIVE CLASSES OF THE GATE CONDITION (loopback, unspecified, link-local, multicast, the host's
 * own addresses) and the further ones the brief names (public, on no interface of the host, a name, a port outside the stored list, a service address that is not on the stored host).
 */
export const REFUSED_STORED_ADDRESSES: readonly RefusedStoredAddress[] = Object.freeze([
  { className: 'loopback', candidate: storedCameraAt('127.0.0.1'), refusal: 'LOOPBACK' },
  { className: 'loopback, elsewhere in 127.0.0.0/8', candidate: storedCameraAt('127.8.9.10', 8557), refusal: 'LOOPBACK' },
  { className: 'unspecified', candidate: storedCameraAt('0.0.0.0'), refusal: 'UNSPECIFIED' },
  { className: 'link-local', candidate: storedCameraAt('169.254.10.20'), refusal: 'LINK_LOCAL' },
  { className: 'multicast', candidate: storedCameraAt('224.0.0.251'), refusal: 'MULTICAST' },
  { className: 'the host itself, on the camera interface', candidate: storedCameraAt('192.168.50.1'), refusal: 'HOST_ADDRESS' },
  { className: 'the host itself, on another interface', candidate: storedCameraAt('10.20.0.5'), refusal: 'HOST_ADDRESS' },
  { className: 'public', candidate: storedCameraAt('8.8.8.8'), refusal: 'PUBLIC_ADDRESS' },
  { className: 'private, on no interface of the host (R-FLEX: was OUTSIDE_CAMERA_SUBNET)', candidate: storedCameraAt('192.168.60.20'), refusal: 'NO_SOURCE_INTERFACE' },
  { className: 'a name that would resolve to loopback', candidate: storedCameraAt('localhost'), refusal: 'HOST_NAME' },
  { className: 'a name', candidate: storedCameraAt('camera.room.example'), refusal: 'HOST_NAME' },
  { className: 'the broadcast address of the camera subnet', candidate: storedCameraAt('192.168.50.255'), refusal: 'SUBNET_BROADCAST' },
  { className: 'a port outside the stored list', candidate: storedCameraAt(ADMITTED_HOST, 8080), refusal: 'PORT_NOT_LISTED' },
  { className: 'a service address on another host than the stored one', candidate: { ...storedCameraAt(ADMITTED_HOST), serviceAddress: 'http://127.0.0.1/onvif/device_service' }, refusal: 'STORED_ADDRESS_MALFORMED' },
  { className: 'loopback written another way in the service address', candidate: { ...storedCameraAt(ADMITTED_HOST), serviceAddress: 'http://2130706433/onvif/device_service' }, refusal: 'STORED_ADDRESS_MALFORMED' },
  { className: 'no service address', candidate: { ...storedCameraAt(ADMITTED_HOST), serviceAddress: null }, refusal: 'STORED_ADDRESS_MALFORMED' },
  { className: 'no host', candidate: { ...storedCameraAt(ADMITTED_HOST), host: '' }, refusal: 'STORED_ADDRESS_ABSENT' },
]);

/** The five classes the gate condition of row 143 names, by the `className` of the table. */
export const GATE_CLASSES: readonly string[] = Object.freeze(['loopback', 'unspecified', 'link-local', 'multicast', 'the host itself, on the camera interface']);
