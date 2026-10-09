/*
 * DEMS capture worker (blueprint rows 111 and 58; register NM-02, NM-04; capture spec A.2, A.4,
 * B.2, C.2, C.4, F). Shared declarations of the five translation units:
 *
 *   capture_worker.c  main: the command loop on standard input, the session, shutdown.
 *   ipc.c             the frames of @dems/capture-protocol on standard output, the JSON reader of
 *                     the commands, the structured log.
 *   sink.c            one camera file: created at its first complete fragment, never over an
 *                     existing file, written fragment by fragment.
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
#define CAPTURE_PROTOCOL_VERSION 2
#define CAPTURE_MEDIA_PORT_MIN 8554
#define CAPTURE_MEDIA_PORT_MAX 8564
#define MAX_FRAME_CHARS 65536
#define WORKER_VERSION "capture-worker/0.2.0"

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

/* ---------------------------------------------------------------- sink.c */
typedef struct Sink {
    char path[PATH_CHARS + 1];
    int fd;                         /* -1 until the first complete fragment */
    uint8_t *pend;                  /* bytes the muxer wrote that are not on the disk yet */
    size_t pend_len, pend_cap;
    int failed;                     /* an AVERROR once a write or the create failed */
    _Atomic int64_t bytes;          /* length of the file */
    _Atomic int64_t fragments;      /* complete moof+mdat pairs on the disk */
    _Atomic int64_t last_fragment_mono_us;
} Sink;

void sink_init(Sink *s, const char *path);
/* AVIO write callback (opaque = Sink). Called under the camera's mutex. */
int sink_write(void *opaque, const uint8_t *buf, int size);
/* Writes what is left (the trailer) if the file exists, and closes it. Returns 0 or an AVERROR. */
int sink_close(Sink *s);
/* 1 when something is at the path already (any kind of file). */
int sink_path_occupied(const char *path);
int sink_stale_parts(const char *path);

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
/* Called under the camera's mutex after a write: reports the first durable fragment once. */
void cam_after_write(Cam *c);

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
