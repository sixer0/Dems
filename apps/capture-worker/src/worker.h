/*
 * DEMS capture worker (blueprint rows 111, 58 and 59; register NM-02, NM-04, NM-05; capture spec
 * A.2, A.4, A.5, B.2, C.1-C.6, F). Shared declarations of the five translation units:
 *
 *   capture_worker.c  main: the command loop on standard input, the session, shutdown.
 *   ipc.c             the frames of @dems/capture-protocol on standard output, the JSON reader of
 *                     the commands, the structured log.
 *   sink.c            THE fMP4 WRITER of one camera file: created at its first complete fragment,
 *                     never over an existing file, appended one whole fragment at a time, the two
 *                     hash chains, the sync policy, truncation after a failed write, and one
 *                     checkpoint per durable fragment.
 *   ingest.c          one RTSP/TCP listen ingest per camera, video stream copy, PRFT anchoring,
 *                     the fMP4 muxer of the camera file.
 *   audio.c           THE filtering thread: FOUR mic inputs (D61, 2026-11-04; was two): the legacy
 *                     two-role lane still runs two inputs through one selector into ONE AAC encoder
 *                     into every camera file, and every channel that names an outputPath is ALSO
 *                     recorded on its own file through an encoder of its own. Meters, PCM tap, the
 *                     operator's switch and its interval records. The only unit that names libavfilter.
 *   micwatch.c        the microphone warning raiser (silence, disconnect, rate limit): pure.
 *   anchor.c          video anchoring arithmetic and the camera-clock rules: pure.
 *   announce.c        the announced address of an ingest: the expected message and its whole-message
 *                     comparison (task 4 row 58): pure.
 *
 * Thread rules. The filtering thread is the only thread that touches the filter graph (erratum
 * AU2-07; `make check` holds it). Each output muxer is guarded by its camera's mutex. Everything
 * else that crosses threads is an atomic.
 */
#ifndef DEMS_CAPTURE_WORKER_H
#define DEMS_CAPTURE_WORKER_H

#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>

#include "anchor.h"
#include "announce.h"

#include <pthread.h>
#include <stdatomic.h>
#include <stdint.h>
#include <stdio.h>

/* NO LOG LEVEL IS EVER SET (task 4 row 175; BR-04 (1) of verification/05_security_branch_b.md). The callback of
 * ingest.c is handed every level and writes the error level and below; the gate on the announced address reads
 * the trace level without anyone asking the library for it. Naming the function that sets the level, in any unit
 * of the worker (this header is their first include), is a compile error from here on. */
#pragma GCC poison av_log_set_level

/* The protocol this worker speaks: packages/capture-protocol/src/index.ts. A test of the Core
 * server holds these three numbers equal to the package's. */
#define CAPTURE_PROTOCOL_VERSION 5
#define CAPTURE_MEDIA_PORT_MIN 8554
#define CAPTURE_MEDIA_PORT_MAX 8564
#define MAX_FRAME_CHARS 65536
#define WORKER_VERSION "capture-worker/0.6.0"

/* A PROOF BUILD IS ANY BUILD WITH ONE OF ITS SWITCHES (review R63-06; pair-58 F-10). Until fix pass
 * F-M3 the mark of HELLO hung on ONE macro (DEMS_PROOF_MUX_EXTRA): a build with any of the other
 * switches - through the Makefile or through a CFLAGS of the environment - said the release
 * version. Every switch that changes what the worker does is listed here, and HELLO says "-PROOF"
 * when ANY of them is defined (ipc.c). The Core starts no worker that says so (boot check and
 * every HELLO of a session). `check.sh` holds this list complete: a proof switch the sources
 * test that is missing here is refused. THIS HEADER IS THE FIRST INCLUDE of every unit, so the
 * test below sees only what the build line defined (the defaults of MIC_MAX_PPM, DEMS_MOVFLAGS and
 * DEMS_VERIFIED_LAVF_VERSION_INT are defined later, in their units). */
#if defined(DEMS_PROOF_MUX_EXTRA) || defined(DEMS_PROOF_KEEP_TORN_TAIL) || defined(DEMS_PROOF_NO_REFUSAL_EXIT) || defined(DEMS_PROOF_WRITE_FAULT) || \
    defined(DEMS_PROOF_INTERVAL_SKEW) || defined(DEMS_PROOF_NO_CLOCK_FLOOR) || defined(DEMS_PROOF_NO_FRAGMENT_BOUND) || defined(DEMS_PROOF_SILENT_SYNC_FALLBACK) || \
    defined(DEMS_PROOF_RUNTIME_LAVF_VERSION_INT) || defined(MIC_MAX_PPM) || defined(DEMS_MOVFLAGS) || defined(DEMS_VERIFIED_LAVF_VERSION_INT) || \
    defined(DEMS_PROOF_ANNOUNCE_UNSEEN)
#define DEMS_PROOF_BUILD 1
#endif

/* THE NAMED SETTINGS of a worker process (protocol version 4, CAPTURE_WORKER_SETTINGS): what each is
 * when the launcher does not pass its argument. The same Core test holds these four equal to the
 * package's defaults and to the contract constants of @dems/shared/api (capture spec E.1; D84). */
#define DEFAULT_INGEST_OPEN_WINDOW_MS 15000
#define DEFAULT_MIC_SILENCE_DBFS -50
#define DEFAULT_MIC_SILENCE_MS 10000
#define DEFAULT_MIC_DISCONNECT_MS 2000
/* THE FRAGMENT SIZE BOUND (review R63-02; ruling D179): ONE number, the one the seal and the verifier
 * enforce (SEALING_MAX_FRAGMENT_BYTES = VERIFY_MAX_OPEN_FRAGMENT_BYTES, 64 MiB). The Core's launcher
 * passes it (--max-fragment-bytes); this default is held equal to the package's by the same test.
 * The ceiling is only the worker's compiled sanity cap (the most the writer ever holds in memory). */
#define DEFAULT_MAX_FRAGMENT_BYTES 67108864
#define MIN_MAX_FRAGMENT_BYTES 1048576
#define MAX_FRAGMENT_BYTES_CEILING 268435456

#define SR 48000            /* AUDIO-01: AAC-LC 48 kHz mono (OD-06) */
#define QUANTUM 480         /* worker input quantum: 10 ms (AU2-07 bound) */
/* THE SAMPLE ACCOUNT of a gapped microphone (protocol version 5; design 06 sections 7.2a, 8.2 (a)): the three
 * constants of the package, restated; the Core's pin test holds them equal. */
#define CAPTURE_MIC_ACCOUNT_PERIOD_SAMPLES 2880000     /* an account every 60 s of the timeline */
#define CAPTURE_AUDIO_INSERTED_RUN_MIN_SAMPLES 4800    /* 100 ms: a run this long carries its position */
#define CAPTURE_AUDIO_INSERTED_RUNS_MAX 1024           /* runs listed per worker; the rest are counted */
#define AAC_FRAME 1024
/* D60 (2026-11-04): the plan carries up to FOUR camera entries (VIDEO-01..VIDEO-04), was two. NCAM is the
 * compiled sanity cap only - the number a session records is the plan's (`Session.ncam`), and every loop
 * below runs over that. */
#define NCAM 4
/* D61 (2026-11-04): the plan carries FOUR numbered microphone channels at once (MIC-01..MIC-04), was the
 * two-role PRIMARY/STANDBY pair; the failover concept died with the decision. A mic's INDEX is its channel
 * number minus one (channel "MIC-0n" -> index n-1); NMIC is both cap and the plan's count (the protocol
 * holds min = max = 4, mirroring `assertRecordableSelector`). The legacy two-role lane (the camera files'
 * audio track, `SWITCH_AUDIO_SOURCE`) still spans indices 0 and 1 only. */
#define NMIC 4
#define NLANE 2               /* D61 (2026-11-04): the two-role lane's width: channels MIC-01 and MIC-02 feed the selector */
#define US 1000000LL
#define ID_CHARS 128
#define PATH_CHARS 1024

/* Exit codes. 0 is a clean stop and nothing else. */
#define EXIT_USAGE 2
#define EXIT_PROTOCOL 64    /* the supervisor sent what is no command of the protocol */
#define EXIT_FATAL 70       /* a mux, encoder, selector or file error: never looks like a stop */

/* ---------------------------------------------------------------- ipc.c */
typedef enum { J_NULL, J_BOOL, J_NUM, J_STR, J_ARR, J_OBJ } JType;
typedef struct JNode {
    JType t;
    const char *key;        /* member name when the parent is an object */
    const char *str;        /* J_STR */
    double num;             /* J_NUM */
    int is_int, b, n;       /* n: number of children */
    struct JNode *child, *next;
} JNode;

/* Parses one line in place (the buffer is modified). Returns the root or NULL. */
JNode *json_parse(char *text, JNode *arena, int arena_len);
const JNode *jget(const JNode *obj, const char *key);
/* 1 when the value is a string of 1..max characters out of [A-Za-z0-9._:-]. */
int id_ok(const JNode *v, int max);

/* Starts the writer of the frames. `refusal` NULL: HELLO is the first frame and the heartbeat runs.
 * `refusal` a machine code: the worker refuses to start - ONE frame, CRASH with that code and no
 * session, INSTEAD of HELLO, and no heartbeat (review R63-07). */
int ipc_start(int heartbeat_ms, const char *refusal);
void ipc_stop(void);
/* One frame, never dropped. `fmt` produces the members after {"v":N, without braces. */
void ipc_send(const char *fmt, ...) __attribute__((format(printf, 1, 2)));
/* The newest telemetry frame: replaces one that still waits (a level, not a record). */
void ipc_send_level(const char *fmt, ...) __attribute__((format(printf, 1, 2)));
/* 1 once a write to standard output failed: the supervisor is gone. */
int ipc_broken(void);

int log_open(const char *path);
void log_close(void);
void logj(const char *level, const char *source, const char *msg, const char *extra, ...) __attribute__((format(printf, 4, 5)));
const char *errstr(int e, char *b, size_t n);
int64_t mono_us(void);
int64_t real_us(void);

/* ---------------------------------------------------------------- sink.c (the fMP4 writer) */
#define SHA256_BYTES 32
#define SINK_TRACKS 4

/* One fragment that is ON THE DISK AND SYNCED (spec A.5 `FragmentCheckpoint`; C.2, C.3). */
typedef struct Checkpoint {
    uint32_t index;                 /* mfhd.sequence_number: 1, 2, 3 ... without a gap */
    int64_t start, len;             /* the stored-byte range [start, start + len) of moof + mdat */
    uint8_t frag[SHA256_BYTES];     /* SHA-256 of the stored bytes of the fragment */
    uint8_t chain[SHA256_BYTES];    /* SHA-256(chain of the fragment before || frag); chain 0 = SHA-256("") */
    uint8_t prefix[SHA256_BYTES];   /* SHA-256 of the file from byte 0 to the end of this fragment */
    uint8_t plain[SHA256_BYTES];    /* SHA-256 of the fragment before the cipher seam */
    uint8_t plain_chain[SHA256_BYTES];
    int64_t media_start_ms, media_duration_ms;
    int keyframe;                   /* the fragment has video and its first video sample is a sync sample */
    int sealed;                     /* 1 when a cipher sealed the stored bytes: iv and tag are set */
    uint8_t iv[12], tag[16];
    int first;                      /* the fragment the file got its final name with */
    int64_t durable_at_ms;          /* wall clock, taken after the sync that covers this fragment returned */
} Checkpoint;

/* THE CIPHER SEAM (spec D.1; blueprint row 84 builds the AES-256-GCM module). NULL in this row:
 * the stored bytes are the plaintext and both chains carry the same digests. A cipher seals one
 * whole fragment in place (same length, detached tag) after the plaintext hash was taken and
 * before the stored hash is. */
typedef struct FragmentCipher {
    void *ctx;
    char key_id[ID_CHARS + 1];
    int (*seal)(void *ctx, uint32_t index, int64_t byte_offset, uint8_t *bytes, size_t len, uint8_t iv[12], uint8_t tag[16]);
} FragmentCipher;

struct SinkJob;
typedef struct Sink {
    char path[PATH_CHARS + 1];
    char part[PATH_CHARS + 32];     /* the temporary name the first fragment is written under */
    int fd;                         /* -1 until the first complete fragment */
    uint8_t *pend;                  /* bytes the muxer wrote that are not on the disk yet */
    size_t pend_len, pend_cap;
    size_t init_len;                /* length of the init segment (the boxes before the first moof) once known */
    int failed;                     /* an AVERROR once a write, the create or a rule of the writer failed (writing thread) */
    const char *fail_code;          /* which rule: a machine code for the log and the CRASH frame */
    _Atomic int64_t bytes;          /* length of the file: the last good length */
    _Atomic int64_t fragments;      /* complete moof+mdat pairs written to the file */
    _Atomic int64_t durable_fragments; /* of those: covered by a sync that returned */
    _Atomic int64_t last_fragment_mono_us;
    int64_t dropped_tail_bytes;     /* what the muxer left after the last whole fragment at close: never written */
    /* the chains (writing thread only) */
    uint32_t next_index;
    struct AVSHA *prefix_ctx, *work_ctx;
    uint8_t chain[SHA256_BYTES], plain_chain[SHA256_BYTES];
    uint32_t timescale[SINK_TRACKS], track_id[SINK_TRACKS], trex_flags[SINK_TRACKS], trex_duration[SINK_TRACKS];
    int is_video[SINK_TRACKS], n_tracks;
    const FragmentCipher *cipher;
    /* the sync thread: what is written waits here until a sync covered it */
    pthread_t sync_th;
    int sync_started, sync_closing, linked;
    size_t max_fragment_bytes;      /* 0: no bound (a unit test); the worker sets the bound of the session: a larger fragment is never written */
    atomic_int sync_level;          /* SYNC_NOT_YET until the first sync of the file returned; then the level it ACHIEVED */
    pthread_mutex_t sync_mx;
    pthread_cond_t sync_cv;
    struct SinkJob *job_head, *job_tail;
    _Atomic int async_failed;       /* an AVERROR once the sync, the link or the directory sync failed */
    /* called on the sync thread, in fragment order, once per durable fragment; never under a lock of the caller */
    void (*on_durable)(void *opaque, const Checkpoint *cp);
    /* called once when the sync thread failed (code: a machine code) */
    void (*on_sync_failure)(void *opaque, const char *code, int averror);
    void *opaque;
} Sink;

void sink_init(Sink *s, const char *path);
/* AVIO write callback (opaque = Sink). Called under the camera's mutex. */
int sink_write(void *opaque, const uint8_t *buf, int size);
/* Waits for the sync of everything written, and closes the file. Returns 0 or an AVERROR. */
int sink_close(Sink *s);
/* 1 when something is at the path already (any kind of file). */
int sink_path_occupied(const char *path);
int sink_stale_parts(const char *path);
/* THE SYNC LEVEL (review R63-09). What a sync of this file really was: the full sync (through the
 * drive's own cache where the platform has it), or fsync() on a volume that does not know the full
 * one. Decided by the FIRST sync of the file and stated with its first durable fragment; a later
 * sync that cannot reach that level is a failed sync, never a quieter one. */
#define SYNC_NOT_YET 0
#define SYNC_FULL 1
#define SYNC_FSYNC 2
/* The level this file's syncs achieved: "F_FULLFSYNC", "FSYNC", or "NOT_YET" before the first one. */
const char *sink_sync_level(const Sink *s);
/* What the build asks for first: "F_FULLFSYNC" where the platform has it, else "FSYNC". Not a claim about any file. */
const char *sink_sync_wanted(void);
/* TEST SEAM. NULL in the worker (`check.sh` holds that nothing assigns it). A unit test makes the
 * full sync of a descriptor answer as a volume without it does: return 0 for "sync normally", or
 * the errno the full sync fails with (ENOTSUP: the writer falls back to fsync and must SAY so). */
extern int (*sink_full_sync_hook)(int fd);
void sha256_hex(const uint8_t digest[SHA256_BYTES], char out[2 * SHA256_BYTES + 1]);
/* TEST SEAM. NULL in the worker. A unit test, or a proof build, makes the write of one fragment
 * fail: return -1 for "write normally", or the number of bytes that reach the file before the
 * write fails with ENOSPC (0: nothing; less than `len`: a short write, then the failure). */
extern long (*sink_fault_hook)(Sink *s, int64_t fragment_no, size_t len);

/* ---------------------------------------------------------------- the session */
typedef enum { ING_WAITING = 0, ING_CONNECTED = 1, ING_ENDED = 2 } IngestState;

typedef struct Cam {
    int idx, port, present;
    char device_id[ID_CHARS + 1];     /* the capture device (CAM-0x): what every frame names */
    char track_id[ID_CHARS + 1];      /* the output track (VIDEO-0x): a name of the plan only */
    char profile[65];                 /* the dual-lens profile of the plan, "" when null (D60: one device may feed two tracks with DISTINCT profiles, OD-05) */
    char url[257];
    Sink sink;
    AVFormatContext *in, *out;
    /* THE ANNOUNCED ADDRESS (task 4 row 58; ingest.c "the gate"; announce.h). This camera's own state and nothing shared:
     * what the library's messages showed during THIS camera's open (written by the log callback only on the thread that
     * opens this camera and only for this camera's input context; reset before the open), and the flag by which THIS
     * camera's interrupt callback ends an open that can no longer pass. The stop flag of the process is not involved. */
    AnnounceGate announce;
    atomic_int announce_refused;
    AVIOContext *pb;
    AVStream *ov, *oa;
    int vidx;
    pthread_mutex_t mx;             /* guards `out`, `sink`, `out_ready`, the pending audio */
    pthread_t th;
    int th_started;
    atomic_int state;               /* IngestState */
    atomic_int failed;              /* the ingest ended for a reason other than a stop */
    atomic_int out_ready;           /* the muxer header is written: audio may be muxed */
    atomic_int first_reported;      /* FIRST_DURABLE_FRAGMENT was sent */
    /* THE FRAGMENT SIZE BOUND (under `mx`; ingest.c "write_bounded_locked"): what the OPEN fragment holds so far */
    int64_t open_bytes, open_samples, open_seen_fragments;
    int64_t size_cuts;              /* fragments closed at the bound instead of at a keyframe */
    int size_bound_warned;          /* FRAGMENT_SIZE_BOUND_REACHED was sent (once per camera) */
    int open_misaligned;            /* the open fragment began at a cut at the bound, not at a keyframe: the next keyframe begins a new one */
    int64_t realign_cuts;           /* fragments closed so that a keyframe begins the next one again */
    /* observed keyframe interval (ingest thread only; Q-GOP, spec C.1) */
    int64_t gop_last_key_us, gop_last_us, gop_max_us;
    int gop_intervals, gop_warned, gop_reported;
    AVPacket **pending;             /* audio packets from T0 until the camera's muxer exists */
    int n_pending, cap_pending;
    int64_t pending_dropped;
    /* video anchoring (ingest thread only) */
    int anchored, started;
    Anchor anchor;
    int64_t last_dts, first_pts;
    int64_t first_skipped_pts_us;   /* camera time of the first video packet that had a time and was not written */
    /* the untimestamped lead (review R63-13): video packets without a time that came before the first one with a time */
    int64_t lead_packets, lead_first_mono_us, lead_end_mono_us;
    int seen_pts;
    ClockFloor clock_floor;         /* the smallest arrival lag of any packet since the ingest opened (anchor.h) */
    atomic_int th_done;             /* the ingest thread has ended */
    atomic_int abandoned;           /* it did not end when it had to: nobody waits for it any more */
    atomic_int ever_connected;
    _Atomic int64_t last_video_mono_us;
    _Atomic int64_t v_written, a_written, v_dropped_prearm, v_dropped_prestart, v_dropped_unanchored, v_dropped_no_pts;
    _Atomic int64_t v_retimed;      /* video samples whose time the monotonic guard had to move (review R63-11) */
    /* arrival-vs-camera trend: telemetry only, corrects nothing (spec F) */
    pthread_mutex_t trend_mx;
    ClockTrend trend;
} Cam;

typedef struct Mic {
    int present;
    /* Protocol version 5: the input kind is PCM_FIFO_GAPPED - a writer that does not promise every sample. ONE
     * predicate, ONE place that sets it: the plan reader (capture_worker.c, take_plan). It is read in a closed set of
     * places of audio.c (mic_open, mic_read, mic_take, telemetry, audio_main); check.sh holds both. */
    int gapped;
    char device_id[ID_CHARS + 1];
    char path[PATH_CHARS + 1];
    /* D61 (2026-11-04): the numbered CHANNEL of the plan row ("MIC-0n", = index n+1) - the identity the wire
     * carries since the decision replaced the role member. */
    char channel[8];
    /* D61 (2026-11-04): this channel's own audio file, "" when the plan names none: a channel with one is
     * RECORDED SIMULTANEOUSLY with the others (one fMP4 per channel, its own encoder - audio.c). */
    char out_path[PATH_CHARS + 1];
} Mic;

typedef struct Session {
    char id[ID_CHARS + 1];
    int attempt;
    int ncam;                       /* D60 (2026-11-04): the camera entries of THIS plan (1..NCAM); every per-session loop runs over this, never over the cap */
    Cam cam[NCAM];
    Mic mic[NMIC];
    int active_mic;                 /* D61 (2026-11-04): the TRANSCRIBED CHANNEL's index (the plan sends MIC-01 -> 0; the legacy lane may restart on MIC-02 -> 1). Was the failover pair's start role. */
    char tap_path[PATH_CHARS + 1];  /* "" when the plan has no tap */
    int fragment_target_ms, min_frag_duration_ms, gop_frames, meter_rate_hz;
    AVCodecContext *enc;            /* the ONE AAC encoder (H-4) */
    atomic_int armed;               /* T0 is taken: video may be placed on the timeline */
    _Atomic int64_t t0_real_us;
    _Atomic uint64_t record_seq;
    pthread_mutex_t record_mx;
} Session;

extern Session S;
extern atomic_int g_stop;           /* stop recording: flush, close, exit */
extern atomic_int g_stop_ingest;
extern int g_listen_timeout_s;      /* the ingest-open window, in the whole seconds libavformat's listen timeout takes */
extern int g_mic_silence_dbfs, g_mic_silence_ms, g_mic_disconnect_ms;
extern int g_max_fragment_bytes;    /* the fragment size bound of this installation (--max-fragment-bytes) */
extern const char *g_mux_extra;     /* PROOF BUILD ONLY (negative control); NULL in the worker */

/* A fatal error: logs it, remembers the first code, and forces exit code EXIT_FATAL. */
void fatal(const char *source, const char *code, int averror);
int fatal_pending(void);
/* The next record of the session (lossless class). `fmt` produces the members of `record`. */
void send_record(const char *fmt, ...) __attribute__((format(printf, 1, 2)));
/* A warning began (`active` 1) or ended (0). `reason` is one of CaptureWarningReason and belongs to
 * `code`; `subject` is the DEVICE ID of one camera or one microphone of the plan - never NULL and
 * never a role (protocol version 4; D84 R-1, R-2). A call without a subject is a bug of the worker:
 * it is logged and nothing is sent, because the frame would be a protocol violation. */
void send_warning(const char *code, const char *reason, int active, const char *subject);
/* The writer's callbacks of one camera file (sync thread): the records of a durable fragment. */
void cam_fragment_durable(void *cam, const Checkpoint *cp);
void cam_sync_failed(void *cam, const char *code, int averror);

/* ---------------------------------------------------------------- ingest.c */
void ingest_init(void);
/* 0 when every internet socket of the process is a stream socket on 127.0.0.1; else names the violation. */
int sockets_violation(const char **what);
/* An ingest that is still opening long after its listen timeout: that camera is given up, the session goes on. */
void ingest_give_up(Cam *c);
void *ingest_main(void *arg);
int open_encoder(Session *s);
/* One encoder packet into one camera file (waits in memory until the camera's muxer exists). */
int cam_mux_audio(Cam *c, const AVPacket *pkt);
/* Cuts the open fragment of a camera whose video stalled (W-3). */
int cam_cut_if_stalled(Cam *c, int64_t now, int64_t stall_us);
/* Trailer, sink and contexts of one camera. Returns 0 or an AVERROR. */
int cam_close(Cam *c);
/* The mux options of the camera files, as one string (logged at start; the P4 decision). */
extern const char *const MUX_MOVFLAGS;
/* THE libavformat PIN AT RUN TIME (review R63-07). 0 when the library this process RUNS on is the one
 * it was built and verified against; else 1, with the two version numbers. The header pin
 * (_Static_assert in ingest.c) and the build pin (check.sh) cannot see a shared library that was
 * replaced after the build. */
int lavf_runtime_mismatch(unsigned *running, unsigned *verified);

/* ---------------------------------------------------------------- audio.c */
void *audio_main(void *arg);
/* The operator's switch: asked by the command thread, applied by the filtering thread at its next
 * input chunk, which writes the interval record and then acknowledges it. Returns 0 when it was
 * taken, -1 when another one is still waiting. NOTHING ELSE changes the audio source (OD-11). */
int audio_request_switch(int mic_index, const char *correlation_id);
int audio_set_manifest(const char *path);

#endif
