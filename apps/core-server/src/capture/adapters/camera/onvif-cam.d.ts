/**
 * The part of `onvif` 0.8.3 that `onvif-session.ts` uses (blueprint row 142; capture spec §A.6.2
 * CT-1, CT-3, CT-4; §G.1 G-R11; SEC35-33 (5), SEC35-49).
 *
 * The package's own types describe every operation of an ONVIF client - clock, network, reboot,
 * factory default, PTZ. This declaration names the module by its file (`lib/cam.js`: the package's
 * main entry would load `lib/discovery.js`, the datagram code that §A.6.1a rejected) and declares
 * the FIVE READS of rule CT-1 and nothing else, so that a sixth call does not compile.
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
  class Cam {
    constructor(options: CamOptions);
    getSystemDateAndTime(callback: CamCallback): void;
    getServices(includeCapability: boolean, callback: CamCallback): void;
    getCapabilities(callback: CamCallback): void;
    getProfiles(callback: CamCallback): void;
    getStreamUri(options: { readonly protocol: 'RTSP'; readonly profileToken: string }, callback: CamCallback): void;
  }
  const cam: { readonly Cam: typeof Cam };
  export default cam;
}
