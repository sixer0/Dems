/**
 * The part of `onvif` 0.8.3 that `onvif-session.ts` uses (blueprint row 142; capture spec §A.6.2
 * CT-1, CT-3, CT-4; §G.1 G-R11; SEC35-33 (5), SEC35-49).
 *
 * The package's own types describe every operation of an ONVIF client - clock, network, reboot,
 * factory default, PTZ. This declaration names the module by its file (`lib/cam.js`: the package's
 * main entry would load `lib/discovery.js`, the datagram code that §A.6.1a rejected) and declares
 * the FIVE READS of rule CT-1 and nothing else, so that a sixth call does not compile.
 *
 * TASK 4 ROW 110 (WP-22a; static rules G-R10 / G-R11 as amended by decision text SR-3): the FOUR
 * CALLS of the set-camera-network operation are declared beside the five reads, for the second
 * importer, `onvif-network.ts`, and for no other file. The set of an interface is declared for ONE
 * form only - enabled, IPv4, a manual address with its prefix, `DHCP: false` - so that a request
 * for the DHCP mode, IPv6, a link or an MTU does not compile. Which file may make which call is
 * held by the static test of the capture folder, not by this declaration.
 */
declare module 'onvif/lib/cam.js' {
  interface CamOptions {
    readonly hostname: string;
    readonly port: number;
    readonly path: string;
    readonly useSecure: boolean;
    readonly secureOpts: object;
    /** The idle limit of one request, in milliseconds. */
    readonly timeout: number;
    readonly agent: object;
    readonly autoconnect: false;
    readonly preserveAddress: true;
    readonly useWSSecurity: boolean;
  }
  type CamCallback = (error: unknown, value?: unknown) => void;
  /** The one form of an interface set (row 110): a static IPv4 address. No DHCP mode. */
  interface StaticInterfaceSet {
    readonly interfaceToken: string;
    readonly networkInterface: {
      readonly enabled: true;
      readonly IPv4: { readonly enabled: true; readonly manual: { readonly address: string; readonly prefixLength: number }; readonly DHCP: false };
    };
  }
  class Cam {
    constructor(options: CamOptions);
    getSystemDateAndTime(callback: CamCallback): void;
    getServices(includeCapability: boolean, callback: CamCallback): void;
    getCapabilities(callback: CamCallback): void;
    getProfiles(callback: CamCallback): void;
    getStreamUri(options: { readonly protocol: 'RTSP'; readonly profileToken: string }, callback: CamCallback): void;
    getNetworkInterfaces(callback: CamCallback): void;
    setNetworkInterfaces(options: StaticInterfaceSet, callback: CamCallback): void;
    setNetworkDefaultGateway(options: { readonly IPv4Address: string }, callback: CamCallback): void;
    systemReboot(callback: CamCallback): void;
  }
  const cam: { readonly Cam: typeof Cam };
  export default cam;
}
