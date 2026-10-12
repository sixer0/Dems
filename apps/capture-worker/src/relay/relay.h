/*
 * THE CAPTURE RELAY, RECORD MODE (task 4 blueprint row 41, work package WP-03a; design addendum sections 2.3,
 * 2.5, 5.1; security requirements S13-01, S13-02, RC-6, BR-07, AD-05 (3); plan review finding F10).
 *
 * A SEPARATE PROGRAM, build/capture-relay. It is NOT part of the capture worker and shares no source file with
 * it: the worker listens on loopback and never dials out (its rules: ../../check.sh over the C files and headers of
 * the folder above, a glob that does not reach this folder); the relay dials out twice and listens nowhere (its rules: ../../relay-check.sh
 * over THIS folder). The Makefile names the two source lists apart.
 *
 * What it does, for ONE camera of ONE session attempt:
 *   1. reads ONE line from standard input: the start message of the Core's production process door
 *      (apps/core-server/src/capture/adapters/credential.ts `startMessageBytes`), and overwrites it;
 *   2. PULLS the camera over RTSP on one TCP connection (RTP interleaved on it; a 5 s bound on the connect and
 *      on every wait, the scheme input-av was tested with), with a client of ITS OWN (relay_rtsp.c):
 *      the library's RTSP client is never given the camera, because it answers a Basic challenge with the
 *      password (measured on libavformat 63.1.102; S13-01) and takes an account only inside an address (F10);
 *   3. answers a DIGEST challenge only (MD5 or SHA-256). A challenge that names no Digest scheme ends the
 *      relay with AUTH_SCHEME_NOT_ALLOWED before anything derived from the password was sent;
 *   4. takes the VIDEO only, unchanged (the units of the camera's own encoder: no decode, no encode), holds
 *      back until it has the parameter sets and a keyframe, and
 *   5. PUSHES it to the capture worker's loopback ingest, announcing exactly the address of the start message,
 *      byte for byte and ONCE (the library's RTSP writer, as the worker's verified pushers do).
 *
 * THE CREDENTIAL IN THIS PROCESS (F10, S13-02 (c)). It never stands in an address, an argument, the
 * environment or an output. The line read from standard input is overwritten as soon as it is parsed. The
 * password is overwritten as soon as the first Digest challenge was answered: from then on the process holds
 * the Digest key of that realm (the hash of account, realm and password) and the account name, for the life of
 * the relay. No erasure is claimed beyond these buffers (the kernel's pipe, a swapped page).
 *
 * It ends by itself when its standard input ends (the Core's order to stop, and the Core's death), when the
 * camera or the worker goes away, and on every failure, with ONE code of the list below. It writes nothing to
 * standard output and, to standard error, lines made of these fixed words and of numbers only.
 */
#ifndef DEMS_CAPTURE_RELAY_H
#define DEMS_CAPTURE_RELAY_H

#include <stddef.h>
#include <stdint.h>

/* Bounds of what the relay reads. A value beyond its bound is a refusal, never a cut. */
#define RELAY_LINE_MAX 8192                 /* the start message, with its line feed */
#define RELAY_LOCATOR_CHARS 1024
#define RELAY_INGEST_CHARS 256              /* the worker's bound of an ingest address (announce.h) */
#define RELAY_ACCOUNT_CHARS 256
#define RELAY_SECRET_CHARS 256
#define RELAY_FIELD_CHARS 512               /* realm, nonce, opaque of a challenge */
#define RELAY_PSET_MAX 1024                 /* one parameter set */
#define RELAY_HEAD_MAX 8192                 /* the head of one answer of the camera */
#define RELAY_SDP_MAX 65536                 /* a stream description */
#define RELAY_UNIT_MAX (8 * 1024 * 1024)    /* one picture (access unit) */

/* The ingest ports of the capture protocol (the worker's own range, ../worker.h). */
#define RELAY_INGEST_PORT_MIN 8554
#define RELAY_INGEST_PORT_MAX 8564

#define RELAY_SESSION_CHARS 127             /* the session identifier of an answer */
#define RELAY_SDP_LINES 96                  /* lines of the video section of a description */
#define RELAY_SDP_TYPES 16                  /* payload types of the video section */
#define RELAY_SKIPPED_MAX 8                 /* messages that are not the awaited answer, per answer */

/* THE TIME BOUNDS, microseconds (row 186, review finding H-2). Each is an ABSOLUTE point of the monotonic clock,
 * fixed when its phase begins and looked at on EVERY turn of every loop that reads the camera: bytes that keep
 * arriving (one at a time, or a flood of frames that are dropped) do not move it.
 *   connect                 RELAY_IO_BOUND_US     else CAMERA_UNREACHABLE
 *   one answer              RELAY_IO_BOUND_US     else CAMERA_STALLED      (5 s is input-av's tested value)
 *   DESCRIBE..PLAY in all   RELAY_OPEN_BOUND_US   else CAMERA_STALLED
 *   the first keyframe      RELAY_KEYFRAME_BOUND_US from PLAY, else KEYFRAME_TIMEOUT
 *   playing                 RELAY_IO_BOUND_US without a COMPLETE PICTURE, else CAMERA_STALLED
 *   the order to stop       asked at least every RELAY_STOP_SLICE_US while bytes arrive, every 100 ms while none do
 *   TEARDOWN at the end     RELAY_CLOSE_BOUND_US */
#define RELAY_IO_BOUND_US 5000000LL
#define RELAY_OPEN_BOUND_US 15000000LL
#define RELAY_START_BOUND_US 5000000LL      /* the start message must be complete */
#define RELAY_KEYFRAME_BOUND_US 60000000LL  /* a camera that sends pictures and never a keyframe */
#define RELAY_KEEPALIVE_US 20000000LL       /* at most; half the camera's stated time when that is shorter */
#define RELAY_STOP_SLICE_US 20000LL
#define RELAY_CLOSE_BOUND_US 500000LL
/* Recorded time is the camera's stamps (relay.c, TIME). One step may be ahead of this host's clock by at most
 * RELAY_STEP_TICKS, and the whole stream by that plus one hundredth of the time played (review finding M-3). */
#define RELAY_STEP_TICKS (10 * 90000LL)

/* THE EXIT CODES: the only thing the relay says about a failure. The names are the fixed words of its lines. */
typedef enum RelayCode {
    RELAY_STOPPED = 0,                      /* standard input ended: the Core's order to stop. As the return of a
                                             * function of this program 0 also means "no failure" */
    RELAY_STOP_ASKED = 1,                   /* inside the program only: the order to stop was seen; it leaves as 0 */
    RELAY_USAGE = 2,                        /* it was given an argument: it takes none */
    RELAY_START_MESSAGE_INVALID = 10,
    RELAY_START_MESSAGE_TIMEOUT = 11,
    RELAY_LIBAVFORMAT_VERSION_MISMATCH = 12,
    RELAY_HYGIENE_FAILED = 13,              /* the core-file limit could not be set to 0 */
    RELAY_CAMERA_UNREACHABLE = 20,          /* no TCP connection inside the bound */
    RELAY_CAMERA_PROTOCOL = 21,             /* an answer that is not RTSP, too long, or a status not expected */
    RELAY_AUTH_SCHEME_NOT_ALLOWED = 22,     /* a challenge without a Digest scheme the relay answers (S13-01) */
    RELAY_AUTH_REFUSED = 23,                /* the camera refused the Digest answer */
    RELAY_LOCATOR_NOT_FOUND = 24,           /* the camera has no stream at the path of the locator */
    RELAY_REDIRECT_REFUSED = 25,            /* the camera pointed elsewhere: never followed (AD-05 (3)) */
    RELAY_CONTROL_ADDRESS_REFUSED = 26,     /* the description names another host (AD-05 (3)) */
    RELAY_DESCRIPTION_INVALID = 27,         /* no video section, or not readable */
    RELAY_CODEC_NOT_SUPPORTED = 28,         /* neither H.264 nor HEVC */
    RELAY_TRANSPORT_REFUSED = 29,           /* the camera does not send on the RTSP connection (RC-6: no datagram) */
    RELAY_KEYFRAME_TIMEOUT = 30,
    RELAY_CAMERA_STALLED = 31,              /* a playing camera was silent for the bound */
    RELAY_CAMERA_LOST = 32,                 /* the camera ended the connection */
    RELAY_STREAM_INVALID = 33,              /* a picture beyond the bound, a frame that is not RTP */
    RELAY_INGEST_REFUSED = 40,              /* the worker did not take the push */
    RELAY_INGEST_LOST = 41,                 /* the worker went away */
    RELAY_SOCKET_RULE = 42,                 /* the relay found a socket it must not have (RC-6) */
    RELAY_INTERNAL = 70
} RelayCode;
const char *relay_code_name(RelayCode code);

/* Overwrites memory in a way the compiler may not remove. */
void relay_wipe(void *memory, size_t bytes);

/* ---------------------------------------------------------------- the start message */
typedef struct RelayStart {
    char ingest[RELAY_INGEST_CHARS + 1];    /* announced unchanged */
    int ingest_port;
    char locator[RELAY_LOCATOR_CHARS + 1];  /* rtsp://<IPv4>[:port]/path - never a user part */
    char host[16];
    int port;
    char account[RELAY_ACCOUNT_CHARS + 1];
    char secret[RELAY_SECRET_CHARS + 1];    /* overwritten after the first challenge */
} RelayStart;
/* `line`: `length` bytes that end with the line feed. The line is NOT overwritten here: the caller does it. */
RelayCode relay_start_parse(const char *line, size_t length, RelayStart *out);

/* The end of the authority of an RTSP address when it names `host` and `port` (554 when it names none) and has
 * no user part; NULL otherwise. */
const char *relay_same_authority(const char *address, const char *host, int port);
/* The address of a request made from a control value of the description. `base` is the camera's Content-Base
 * or, when it gave none, the locator. */
RelayCode relay_control_address(const RelayStart *start, const char *base, const char *control, char *out, size_t cap);

/* ---------------------------------------------------------------- Digest (RFC 2617, RFC 7616) */
typedef enum DigestHash { DIGEST_HASH_NONE = 0, DIGEST_HASH_MD5 = 1, DIGEST_HASH_SHA256 = 2 } DigestHash;
typedef struct DigestChallenge {
    DigestHash hash;
    int qop_auth, stale, has_opaque;
    char realm[RELAY_FIELD_CHARS + 1], nonce[RELAY_FIELD_CHARS + 1], opaque[RELAY_FIELD_CHARS + 1];
} DigestChallenge;
/* One value of a WWW-Authenticate header. 1: a Digest challenge the relay answers (filled in). 0: another
 * scheme, or a Digest challenge with a hash or a protection it does not answer. -1: not readable. */
int relay_challenge_parse(const char *value, DigestChallenge *out);
typedef struct DigestKey { DigestHash hash; char realm[RELAY_FIELD_CHARS + 1]; char ha1[65]; } DigestKey;
/* The key of one realm: the hash of account, realm and password. After it the password is not needed. */
int relay_digest_key(DigestHash hash, const char *account, const char *realm, const char *secret, DigestKey *out);
/* The value of an Authorization header for one request. `count` and `client_nonce` are used with qop only. */
int relay_digest_answer(const DigestKey *key, const char *account, const DigestChallenge *challenge, const char *method,
                        const char *address, unsigned count, const char *client_nonce, char *out, size_t cap);

/* ---------------------------------------------------------------- the stream description */
typedef enum RelayCodec { RELAY_CODEC_NONE = 0, RELAY_CODEC_H264 = 1, RELAY_CODEC_HEVC = 2 } RelayCodec;
typedef struct ParamSets {
    uint8_t vps[RELAY_PSET_MAX], sps[RELAY_PSET_MAX], pps[RELAY_PSET_MAX];
    int vps_len, sps_len, pps_len;
} ParamSets;
int relay_sets_complete(RelayCodec codec, const ParamSets *sets);
/* One parameter set as the camera gave it: `kind` 0 = VPS (HEVC only), 1 = SPS, 2 = PPS. 1 when its header says
 * exactly that kind, its forbidden bit is 0 and it is not shorter than such a set can be (review M-1, M-2). */
int relay_set_valid(RelayCodec codec, int kind, const uint8_t *unit, size_t length);
/* Every set the codec needs is there and valid: asked before the library's stream parser sees one (review M-1). */
int relay_sets_valid(RelayCodec codec, const ParamSets *sets);
typedef struct RelayDescription {
    RelayCodec codec;
    int payload_type;
    char control[RELAY_LOCATOR_CHARS + 1];  /* of the video section; empty: none */
    ParamSets sets;                         /* what the description states; may be empty */
} RelayDescription;
RelayCode relay_description_parse(const char *text, size_t length, RelayDescription *out);

/* ---------------------------------------------------------------- pictures out of RTP */
typedef struct RelayPicture {
    RelayCodec codec;
    int payload_type;
    uint8_t *unit;                          /* the picture being collected: its units, each after 00 00 00 01 */
    size_t length, cap;
    int open_fragment;                      /* inside a fragmented unit */
    int keyframe, damaged;
    int have_sequence;
    uint16_t sequence;
    uint32_t stamp;
    ParamSets seen;                         /* parameter sets that came in the stream, the latest of each */
    long gaps, foreign, unsupported;        /* counters: sequence gaps, other payload types, unit forms not taken */
    long units;                             /* start codes the relay wrote into the picture being collected */
    long refused;                           /* units that are not a unit of the codec: forbidden bit, a type that is
                                             * none, a start code inside (review M-2) */
    long dropped;                           /* pictures not handed on: damaged, cut, refused */
} RelayPicture;
int relay_picture_init(RelayPicture *p, RelayCodec codec, int payload_type);
void relay_picture_free(RelayPicture *p);
/* One RTP packet. 1: a picture is complete in p->unit (p->length bytes, p->keyframe; the caller takes it and
 * calls relay_picture_taken). 0: more is needed. Negative: RelayCode * -1. */
int relay_picture_add(RelayPicture *p, const uint8_t *packet, size_t length);
void relay_picture_taken(RelayPicture *p);
/* The parameter sets as the library's writer takes them for its description: each after 00 00 00 01. */
int relay_extradata(RelayCodec codec, const ParamSets *sets, uint8_t *out, size_t cap);
/* Is the time of a picture believable? `step`: its stamp distance to the picture before it; `total`: the muxed
 * time with it; the two times: what this host's clock counted since the picture before it, and since pts 0. */
int relay_step_plausible(int64_t step_ticks, int64_t since_last_us, int64_t total_ticks, int64_t since_first_us);

/* ---------------------------------------------------------------- what the camera sends on the RTSP connection
 * The pure readers of the camera leg (row 186: moved out of the socket code, so that the unit checks and the fuzz
 * build reach them without a socket). relay_rtsp.c owns the bytes; these two say what stands at their front. */
typedef struct RelayAnswer {
    int status;                             /* 100 to 599; 0: a REQUEST of the camera, which is read and dropped */
    long cseq;                              /* -1: none, or not a number */
    int have_digest, other_challenges;
    DigestChallenge digest;                 /* the strongest Digest challenge of the answer */
    char base[RELAY_LOCATOR_CHARS + 1];     /* Content-Base */
    char session[RELAY_SESSION_CHARS + 1];
    int timeout_s;
    int interleaved, rtp_channel, rtcp_channel, datagram;
    size_t body_len;
} RelayAnswer;
/* The head of one message: `length` bytes that end with the empty line. They are CHANGED (each line is ended
 * with a 0). Returns the length of the body the head announces (0 to RELAY_SDP_MAX), or -1: not RTSP, a status
 * line that is none, a 0 byte inside, a body length that is no number, negative, too large or stated twice, a
 * Content-Base or session identifier beyond its bound. */
long relay_head_parse(char *head, size_t length, RelayAnswer *out);
typedef enum RelayFront { RELAY_FRONT_MORE = 0, RELAY_FRONT_FRAME = 1, RELAY_FRONT_MESSAGE = 2 } RelayFront;
typedef struct RelayWire {
    size_t total;                           /* FRAME: its 4 bytes and its payload. MESSAGE: the head with its empty line */
    int channel;                            /* FRAME */
} RelayWire;
/* What stands at the front of `have` bytes of the connection. MORE: not whole yet. FRAME: an interleaved frame
 * (`$`, channel, 16-bit length). MESSAGE: the head of a message, complete. Negative, RelayCode * -1: STREAM_INVALID
 * for a first byte that begins neither; CAMERA_PROTOCOL for a head with no end inside RELAY_HEAD_MAX. */
int relay_wire_front(const uint8_t *bytes, size_t have, RelayWire *out);

/* ---------------------------------------------------------------- the camera leg (relay_rtsp.c) */
typedef struct RelayCamera RelayCamera;
typedef struct RelayCounters { long auth_answers, challenges, keepalives, packets, bytes, frames_dropped; } RelayCounters;
/* `stop`: asked on the turns of every loop (RELAY_STOP_SLICE_US); non-zero ends the call with RELAY_STOP_ASKED. */
typedef int (*RelayStopFn)(void *opaque);
RelayCamera *relay_camera_new(RelayStart *start, RelayStopFn stop, void *opaque);
/* Connect, describe (answering a Digest challenge), set up the video on the connection, play. */
RelayCode relay_camera_open(RelayCamera *camera, RelayDescription *description);
/* The next RTP packet of the video (a pointer into the camera's buffer, valid until the next call). */
RelayCode relay_camera_read(RelayCamera *camera, const uint8_t **packet, size_t *length);
/* A picture was completed: the bound "playing, RELAY_IO_BOUND_US without a complete picture" starts again. */
void relay_camera_progress(RelayCamera *camera);
/* One more absolute bound of the caller (monotonic microseconds; 0: none) and the code of a read that meets it. */
void relay_camera_limit(RelayCamera *camera, int64_t monotonic_us, RelayCode late);
#ifdef RELAY_TEST_HOOKS
/* TEST BUILDS ONLY (never the relay: relay-check.sh holds the Makefile and the binary to it): the camera leg on a
 * descriptor the test made, so that the unit checks and the fuzz build drive the real client with chosen bytes. */
void relay_camera_adopt(RelayCamera *camera, int descriptor);
#endif
/* TEARDOWN (best effort, bounded) and close. */
void relay_camera_close(RelayCamera *camera);
int relay_camera_socket(const RelayCamera *camera);
const RelayCounters *relay_camera_counters(const RelayCamera *camera);

#endif
