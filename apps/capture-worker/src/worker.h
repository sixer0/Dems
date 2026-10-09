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
 *   audio.c           THE filtering thread: two mic inputs -> selector -> ONE AAC encoder -> both
 *                     camera files, meters, PCM tap. The only unit that names libavfilter.
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

#include <pthread.h>
#include <stdatomic.h>
#include <stdint.h>
#include <stdio.h>

/* The protocol this worker speaks: packages/capture-protocol/src/index.ts. A test of the Core
 * server holds these three numbers equal to the package's. */
#define CAPTURE_PROTOCOL_VERSION 3
#define CAPTURE_MEDIA_PORT_MIN 8554
#define CAPTURE_MEDIA_PORT_MAX 8564
#define MAX_FRAME_CHARS 65536
#define WORKER_VERSION "capture-worker/0.3.0"

#define SR 48000            /* AUDIO-01: AAC-LC 48 kHz mono (OD-06) */
#define QUANTUM 480         /* worker input quantum: 10 ms (AU2-07 bound) */
#define AAC_FRAME 1024
#define NCAM 2
#define NMIC 2              /* index 0 = role PRIMARY, index 1 = role STANDBY */
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

int ipc_start(int heartbeat_ms);
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
/* How the file data is made durable on this build: "F_FULLFSYNC" or "fsync". */
const char *sink_sync_level(void);
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
    char url[257];
    Sink sink;
    AVFormatContext *in, *out;
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
    atomic_int th_done;             /* the ingest thread has ended */
    atomic_int abandoned;           /* it did not end when it had to: nobody waits for it any more */
    atomic_int ever_connected;
    _Atomic int64_t last_video_mono_us;
    _Atomic int64_t v_written, a_written, v_dropped_prearm, v_dropped_prestart, v_dropped_unanchored, v_dropped_no_pts;
    /* arrival-vs-camera trend: telemetry only, corrects nothing (spec F) */
    pthread_mutex_t trend_mx;
    ClockTrend trend;
} Cam;

typedef struct Mic {
    int present;
    char device_id[ID_CHARS + 1];
    char path[PATH_CHARS + 1];
} Mic;

typedef struct Session {
    char id[ID_CHARS + 1];
    int attempt;
    Cam cam[NCAM];
    Mic mic[NMIC];
    int active_mic;                 /* index of the role that feeds the encoder at the start */
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
extern int g_listen_timeout_s;
extern const char *g_mux_extra;     /* PROOF BUILD ONLY (negative control); NULL in the worker */

/* A fatal error: logs it, remembers the first code, and forces exit code EXIT_FATAL. */
void fatal(const char *source, const char *code, int averror);
int fatal_pending(void);
/* The next record of the session (lossless class). `fmt` produces the members of `record`. */
void send_record(const char *fmt, ...) __attribute__((format(printf, 1, 2)));
void send_warning(const char *code, const char *subject);
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

/* ---------------------------------------------------------------- audio.c */
void *audio_main(void *arg);
/* The operator's switch: asked by the command thread, applied by the filtering thread, which
 * also acknowledges it. Returns 0 when it was taken, -1 when another one is still waiting. */
int audio_request_switch(int mic_index, const char *correlation_id);
int audio_set_manifest(const char *path);

#endif
