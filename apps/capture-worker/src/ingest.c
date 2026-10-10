/*
 * RTSP ingest and the camera file (blueprint row 58; register NM-04; capture spec A.2 W-1..W-4,
 * A.4, C.2, C.4, F).
 *
 * One thread per camera: an RTSP LISTEN ingest on 127.0.0.1 (SEC35-23), video stream-copied into
 * the camera's fMP4. The one audio track arrives from the filtering thread (audio.c) through the
 * camera's mutex.
 *
 * NO DATAGRAM SOCKET (W-1). A client that asks for RTP over UDP would make libavformat bind
 * UDP *:5000 / *:5001 on every interface; asking for the TCP transport on a listen ingest does
 * not stop it. The ingest therefore allows the protocol `tcp` and nothing else (`protocol_whitelist`):
 * the datagram socket is never created. THAT is the socket guarantee; it depends on no text.
 * libavformat 9.0.2 then retries the refused open in a loop that never ends and reports every
 * turn as an error. The refusal is taken from that fact alone (fix round 1, finding F-2): the
 * OPEN_ERROR_LIMIT-th error-level report of libav on a thread that is opening its ingest ends
 * that ingest - the client is disconnected, the camera is reported as a fault, the thread ends.
 * No message text is read. Should that exit ever not happen (another libav), the damage is
 * bounded: the log is rate-limited and capped (ipc.c), the camera is given up at its listen
 * timeout + 10 s while the OTHER camera keeps recording, and at the end of the session the files
 * are closed and CRASH is sent before the process leaves the thread that would not end.
 * The process also checks once a second that it owns no datagram socket and no socket outside
 * 127.0.0.1 (a fatal error otherwise).
 *
 * VIDEO TIME (spec F, erratum PE-111-01). Each video packet is placed at
 *     camera wall clock of the packet - T0
 * where the camera wall clock comes from the packet's PRFT side data (libavformat attaches it
 * from the latest RTCP sender report). The anchor (wall clock of pts 0) follows a new sender
 * report through a slew limit, never by a step, and the muxed dts never goes backwards. The
 * difference between arrival time and camera time is fitted as a trend and reported as
 * telemetry only: nothing is corrected from it.
 */
#include "worker.h"

#include <libavformat/version.h>
#include <libavutil/opt.h>
#include <libavutil/time.h>

#include <arpa/inet.h>
#include <netinet/in.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>

/* The mux options of the camera files. Decided in part P4 of row 58 (implementation/20, P4);
 * `make check` holds the default. A proof build may name another set to be measured against it. */
#ifndef DEMS_MOVFLAGS
#define DEMS_MOVFLAGS "+frag_keyframe+empty_moov+default_base_moof+skip_trailer"
#endif
const char *const MUX_MOVFLAGS = DEMS_MOVFLAGS;

/* THE libavformat THIS UNIT WAS VERIFIED AGAINST (blueprint rows 61 and 71; decision D85). The anchoring below
 * rests on behaviour of ONE library version: it attaches the reference time (PRFT) of the latest sender report to
 * every packet, hands the first packet over without a timestamp until that report came, retries a refused
 * transport in a loop, and holds the first sample under the pinned mux flags. `check.sh` refuses another installed
 * version (test/static/libavformat.pin); this refuses another set of HEADERS at compile time, so the two cannot
 * part. A new version is a decision: re-run the capture e2e series on it, then move both. (A test compile names
 * another number through DEMS_VERIFIED_LAVF_VERSION_INT to show that the build stops.) */
#ifndef DEMS_VERIFIED_LAVF_VERSION_INT
#define DEMS_VERIFIED_LAVF_VERSION_INT AV_VERSION_INT(63, 1, 102)       /* FFmpeg 9.0.2 */
#endif
_Static_assert(LIBAVFORMAT_VERSION_INT == DEMS_VERIFIED_LAVF_VERSION_INT, "libavformat is not the version the capture worker was verified against (63.1.102, FFmpeg 9.0.2): see test/static/libavformat.pin");

#define AVIO_BUFFER 65536
#define PENDING_AUDIO_LIMIT 4096

/* Decision D58-16 as accepted by D85: a count of error-level reports during ONE open, not a
 * message text. A normal TCP open reports 0, a listen timeout 1; the refused transport reports
 * about 700,000 a second, so 32 is reached within a millisecond and a legitimate open that logs
 * a handful of errors is not refused. The code is neutral (INGEST_OPEN_REFUSED): the worker
 * knows that the open kept failing, not why. */
#define OPEN_ERROR_LIMIT 32
static _Thread_local Cam *tls_opening;      /* the camera whose ingest this thread is opening */
static _Thread_local int tls_open_errors;   /* error-level reports of libav during that open */

static int interrupt_cb(void *o) { (void)o; return atomic_load(&g_stop_ingest); }

/* ---------------------------------------------------------------- sockets (W-1, SEC35-23) */
/* 0 when every internet socket of the process is a stream socket on 127.0.0.1. */
int sockets_violation(const char **what) {
    int max = getdtablesize();
    for (int fd = 3; fd < max; fd++) {
        struct sockaddr_storage a;
        socklen_t len = sizeof a;
        int type;
        socklen_t tlen = sizeof type;
        if (getsockname(fd, (struct sockaddr *)&a, &len) < 0) continue;
        if (a.ss_family != AF_INET && a.ss_family != AF_INET6) continue;
        if (getsockopt(fd, SOL_SOCKET, SO_TYPE, &type, &tlen) < 0) continue;
        if (type != SOCK_STREAM) { *what = "DATAGRAM_SOCKET_FOUND"; return 1; }
        if (a.ss_family != AF_INET || ((struct sockaddr_in *)&a)->sin_addr.s_addr != htonl(INADDR_LOOPBACK)) { *what = "SOCKET_NOT_LOOPBACK"; return 1; }
    }
    return 0;
}

__attribute__((unused)) static void close_sockets_of_port(int port) {
    int max = getdtablesize();
    for (int fd = 3; fd < max; fd++) {
        struct sockaddr_in a;
        socklen_t len = sizeof a;
        if (getsockname(fd, (struct sockaddr *)&a, &len) < 0 || a.sin_family != AF_INET || ntohs(a.sin_port) != port) continue;
        shutdown(fd, SHUT_RDWR);
        close(fd);
    }
}

static void ingest_over(Cam *c, const char *source, const char *code, int averror) {
    char b[128];
    atomic_store(&c->state, ING_ENDED);
    if (atomic_load(&g_stop_ingest)) return;                /* the session is stopping: not a fault */
    atomic_store(&c->failed, 1);
    /* Which of the causes of CAPTURE_FAULT it is (protocol version 4): the camera's clock was refused, a camera
     * that had connected stopped, or - every other code of this unit - its ingest never delivered a usable stream. */
    const char *reason = !strcmp(code, "CAMERA_CLOCK_OUT_OF_BOUND") ? code : !strcmp(code, "INGEST_ENDED") ? "CAMERA_STREAM_ENDED" : "CAMERA_NOT_CONNECTED";
    logj("warn", source, code, "\"port\":%d,\"av_error\":\"%s\",\"video_packets\":%lld,\"reason\":\"%s\"", c->port, errstr(averror, b, sizeof b), (long long)atomic_load(&c->v_written), reason);
    send_warning("CAPTURE_FAULT", reason, 1, c->device_id);
}

/* libav's messages. Errors go to the worker's log without any address; the refusal of a
 * non-TCP transport ends the ingest thread here (see the header of this file). */
static void av_log_cb(void *avcl, int level, const char *fmt, va_list vl) {
    (void)avcl;
    Cam *c = tls_opening;
#ifndef DEMS_PROOF_NO_REFUSAL_EXIT          /* PROOF BUILD ONLY: the scenario "the refusal is not recognised" (finding F-2) */
    if (c && level <= AV_LOG_ERROR && ++tls_open_errors >= OPEN_ERROR_LIMIT) {
        tls_opening = NULL;
        close_sockets_of_port(c->port);
        /* The context of this ingest is abandoned as it stands: it is in the middle of a call. */
        c->in = NULL;
        ingest_over(c, "ingest", "INGEST_OPEN_REFUSED", AVERROR(EPROTONOSUPPORT));
        atomic_store(&c->th_done, 1);
        pthread_exit(NULL);
    }
#else
    (void)c;
#endif
    if (level > AV_LOG_ERROR) return;
    char msg[256];
    vsnprintf(msg, sizeof msg, fmt, vl);
    for (char *p = msg; *p; p++) if (*p == '"' || *p == '\\' || (unsigned char)*p < 0x20) *p = ' ';
    /* No address in a log line: a message that names one is reduced to its class. */
    if (strstr(msg, "://")) snprintf(msg, sizeof msg, "(message with an address withheld)");
    logj("warn", "libav", "LIBAV_MESSAGE", "\"av_level\":%d,\"text\":\"%s\"", level, msg);
}

/* ---------------------------------------------------------------- the camera file */
int open_encoder(Session *s) {
    const AVCodec *codec = avcodec_find_encoder_by_name("aac");
    if (!codec) return AVERROR_ENCODER_NOT_FOUND;
    AVCodecContext *x = avcodec_alloc_context3(codec);
    if (!x) return AVERROR(ENOMEM);
    x->sample_fmt = AV_SAMPLE_FMT_FLTP;
    x->sample_rate = SR;
    x->bit_rate = 96000;
    x->time_base = (AVRational){ 1, SR };
    x->flags |= AV_CODEC_FLAG_GLOBAL_HEADER;
    av_channel_layout_default(&x->ch_layout, 1);
    s->enc = x;
    return avcodec_open2(x, codec, NULL);
}

/* The writer's sync thread, once per fragment, in fragment order, AFTER the sync that covers the
 * fragment returned (sink.c, "the durability point"). The first fragment of a file also says that
 * the session holds evidence. Takes no lock of the camera. */
void cam_fragment_durable(void *cam, const Checkpoint *cp) {
    Cam *c = cam;
    char frag[65], chain[65], prefix[65], plain[65], plain_chain[65], seal[256];
    if (cp->first && !atomic_exchange(&c->first_reported, 1)) {
        logj("info", "sink", "first_durable_fragment", "\"cam\":%d,\"bytes\":%lld,\"sync\":\"%s\"", c->idx + 1, (long long)(cp->start + cp->len), sink_sync_level());
        send_record("\"kind\":\"FIRST_DURABLE_FRAGMENT\",\"deviceId\":\"%s\",\"bytes\":%lld", c->device_id, (long long)(cp->start + cp->len));
    }
    sha256_hex(cp->frag, frag);
    sha256_hex(cp->chain, chain);
    sha256_hex(cp->prefix, prefix);
    sha256_hex(cp->plain, plain);
    sha256_hex(cp->plain_chain, plain_chain);
    if (cp->sealed && c->sink.cipher) {
        char iv[25], tag[33];
        static const char hex[] = "0123456789abcdef";
        for (int i = 0; i < 12; i++) { iv[2 * i] = hex[cp->iv[i] >> 4]; iv[2 * i + 1] = hex[cp->iv[i] & 15]; }
        for (int i = 0; i < 16; i++) { tag[2 * i] = hex[cp->tag[i] >> 4]; tag[2 * i + 1] = hex[cp->tag[i] & 15]; }
        iv[24] = tag[32] = 0;
        snprintf(seal, sizeof seal, "\"gcmIv\":\"%s\",\"gcmTag\":\"%s\",\"keyId\":\"%s\"", iv, tag, c->sink.cipher->key_id);
    } else snprintf(seal, sizeof seal, "\"gcmIv\":null,\"gcmTag\":null,\"keyId\":null");
    send_record("\"kind\":\"FRAGMENT_CHECKPOINT\",\"deviceId\":\"%s\",\"index\":%u,\"start\":%lld,\"len\":%lld,\"fragSha256\":\"%s\",\"chainSha256\":\"%s\",\"prefixSha256\":\"%s\","
                "\"plaintextSha256\":\"%s\",\"plaintextChainSha256\":\"%s\",\"mediaStartMs\":%lld,\"mediaDurationMs\":%lld,\"keyframe\":%s,\"durableAt\":%lld,%s",
                c->device_id, cp->index, (long long)cp->start, (long long)cp->len, frag, chain, prefix, plain, plain_chain, (long long)cp->media_start_ms, (long long)cp->media_duration_ms,
                cp->keyframe ? "true" : "false", (long long)cp->durable_at_ms, seal);
}

/* A sync, the link to the final name or the directory sync failed: nothing more of this file is claimed durable. */
void cam_sync_failed(void *cam, const char *code, int averror) {
    (void)cam;
    fatal("sink", code, averror);
}

/* ---------------------------------------------------------------- observed keyframe interval (Q-GOP) */
/* Spec C.1 (erratum AU2-08), gate answer Q-GOP (a). On stream copy the CAMERA sets the keyframe
 * interval, and a crash loses the open fragment = one camera GOP. The worker therefore MEASURES
 * the interval on the video samples as it hands them to the muxer (their sync flag and their time
 * in the file: the same samples the first fragments are made of, re-derivable from the `trun`
 * boxes), and says what it saw:
 *   - the moment an interval - complete, or still open - is longer than the target of the plan
 *     (`fragmentTargetMs`, the contract's 2 s) by more than GOP_TOLERANCE_PERMILLE, a WARNING on
 *     the existing capture-warning channel (code CAPTURE_FAULT, subject = the camera; no new
 *     error or audit code), once per camera. Since protocol version 4 its reason is
 *     KEYFRAME_INTERVAL_ABOVE_BOUND - an ADVISORY: the camera records, and the Core can tell this
 *     warning from a camera that is gone (row 71; decision D127 (2));
 *   - ONE record `KEYFRAME_INTERVAL` per camera with the number (lossless: the manifest states
 *     the crash-loss window of the file from it): after GOP_OBSERVE_INTERVALS complete intervals,
 *     or at the first complete interval once the warning was raised, or at the end of the ingest
 *     with what was seen until then.
 * Nothing is cut and nothing is refused here: the loss stays bounded by one camera GOP and is
 * REPORTED (a hard ceiling by `frag_duration` would make fragments without a keyframe, spec C.1). */
#define GOP_OBSERVE_INTERVALS 3
#define GOP_TOLERANCE_PERMILLE 50       /* a 2.000 s camera on a clock a few hundred ppm off is not "too long" */

static void gop_report(Cam *c, const char *src, int complete) {
    if (c->gop_reported || c->gop_last_key_us == AV_NOPTS_VALUE) return;
    c->gop_reported = 1;
    int64_t open_us = c->gop_last_us - c->gop_last_key_us, seen = c->gop_max_us > open_us ? c->gop_max_us : open_us;
    int64_t bound_ms = S.fragment_target_ms, observed_ms = (seen + 500) / 1000;
    int above = seen > bound_ms * (1000 + GOP_TOLERANCE_PERMILLE);
    logj(above ? "warn" : "info", src, "keyframe_interval_observed", "\"cam\":%d,\"observed_ms\":%lld,\"bound_ms\":%lld,\"intervals\":%d,\"complete\":%s,\"above_bound\":%s",
         c->idx + 1, (long long)observed_ms, (long long)bound_ms, c->gop_intervals, complete ? "true" : "false", above ? "true" : "false");
    send_record("\"kind\":\"KEYFRAME_INTERVAL\",\"deviceId\":\"%s\",\"observedMs\":%lld,\"boundMs\":%lld,\"intervals\":%d,\"complete\":%s,\"aboveBound\":%s",
                c->device_id, (long long)observed_ms, (long long)bound_ms, c->gop_intervals, complete ? "true" : "false", above ? "true" : "false");
}

/* One video sample that went into the file: `pts_us` is its time in the file. */
static void gop_observe(Cam *c, const char *src, int key, int64_t pts_us) {
    int64_t bound_us = (int64_t)S.fragment_target_ms * (1000 + GOP_TOLERANCE_PERMILLE);
    if (c->gop_last_key_us == AV_NOPTS_VALUE) { if (key) c->gop_last_key_us = c->gop_last_us = pts_us; return; }
    if (pts_us > c->gop_last_us) c->gop_last_us = pts_us;
    int64_t since = pts_us - c->gop_last_key_us;
    if (since > bound_us && !c->gop_warned) {
        c->gop_warned = 1;
        logj("warn", src, "keyframe_interval_above_bound", "\"cam\":%d,\"since_keyframe_ms\":%lld,\"bound_ms\":%d,\"open\":%s", c->idx + 1, (long long)(since / 1000), S.fragment_target_ms, key ? "false" : "true");
        send_warning("CAPTURE_FAULT", "KEYFRAME_INTERVAL_ABOVE_BOUND", 1, c->device_id);
    }
    if (!key || since <= 0) return;
    if (since > c->gop_max_us) c->gop_max_us = since;
    c->gop_intervals++;
    c->gop_last_key_us = pts_us;
    if (c->gop_intervals >= GOP_OBSERVE_INTERVALS || c->gop_warned) gop_report(c, src, 1);
}

static int open_output(Cam *c) {
    int r = avformat_alloc_output_context2(&c->out, NULL, "mp4", NULL);
    if (r < 0) return r;
    uint8_t *buffer = av_malloc(AVIO_BUFFER);
    if (!buffer) return AVERROR(ENOMEM);
    /* Not seekable: the file is append-only by construction. */
    c->pb = avio_alloc_context(buffer, AVIO_BUFFER, 1, &c->sink, NULL, sink_write, NULL);
    if (!c->pb) { av_free(buffer); return AVERROR(ENOMEM); }
    /* The writer reports each durable fragment and a failed sync through these (its own thread). */
    c->sink.on_durable = cam_fragment_durable;
    c->sink.on_sync_failure = cam_sync_failed;
    c->sink.opaque = c;
    c->out->pb = c->pb;
    c->out->flags |= AVFMT_FLAG_CUSTOM_IO;
    AVStream *is = c->in->streams[c->vidx];
    c->ov = avformat_new_stream(c->out, NULL);
    c->oa = avformat_new_stream(c->out, NULL);
    if (!c->ov || !c->oa) return AVERROR(ENOMEM);
    if ((r = avcodec_parameters_copy(c->ov->codecpar, is->codecpar)) < 0) return r;   /* stream copy */
    c->ov->codecpar->codec_tag = 0;
    c->ov->time_base = is->time_base;
    if ((r = avcodec_parameters_from_context(c->oa->codecpar, S.enc)) < 0) return r;
    c->oa->time_base = (AVRational){ 1, SR };
    AVDictionary *o = NULL;
    av_dict_set(&o, "movflags", MUX_MOVFLAGS, 0);
    av_dict_set(&o, "flush_packets", "1", 0);                                           /* spec C.2, W-2 */
    av_dict_set_int(&o, "min_frag_duration", (int64_t)S.min_frag_duration_ms * 1000, 0);
    if (g_mux_extra && (r = av_dict_parse_string(&o, g_mux_extra, "=", ":", 0)) < 0) { av_dict_free(&o); return r; }
    r = avformat_write_header(c->out, &o);
    int leftover = av_dict_count(o);
    av_dict_free(&o);
    if (r >= 0 && leftover) return AVERROR_OPTION_NOT_FOUND;
    return r;
}

static int mux_audio_locked(Cam *c, AVPacket *q) {
    q->stream_index = c->oa->index;
    av_packet_rescale_ts(q, S.enc->time_base, c->oa->time_base);
    int r = av_write_frame(c->out, q);
    if (r >= 0) atomic_fetch_add(&c->a_written, 1);
    return r;
}

/* One encoder packet into one camera file. Before the camera's muxer exists the packet waits, so
 * that every file carries the audio from T0. Returns 0 or an AVERROR. Called by the filtering thread. */
int cam_mux_audio(Cam *c, const AVPacket *pkt) {
    int r = 0;
    pthread_mutex_lock(&c->mx);
    if (atomic_load(&c->out_ready)) {
        AVPacket *q = av_packet_clone(pkt);
        if (!q) r = AVERROR(ENOMEM);
        else { r = mux_audio_locked(c, q); av_packet_free(&q); }
    } else if (atomic_load(&c->state) != ING_ENDED) {
        if (c->n_pending == PENDING_AUDIO_LIMIT) {
            /* A camera that takes this long (about 87 s of audio) to deliver its first frame: the
             * oldest audio of ITS file is given up, said once; the recording itself goes on. */
            if (!c->pending_dropped++) logj("warn", "fanout", "audio_before_camera_dropped", "\"cam\":%d,\"limit_packets\":%d", c->idx + 1, PENDING_AUDIO_LIMIT);
            av_packet_free(&c->pending[0]);
            memmove(c->pending, c->pending + 1, sizeof *c->pending * (size_t)(c->n_pending - 1));
            c->n_pending--;
        } else if (c->n_pending == c->cap_pending) {
            int cap = c->cap_pending ? c->cap_pending * 2 : 256;
            AVPacket **grown = av_realloc_array(c->pending, (size_t)cap, sizeof *grown);
            if (!grown) r = AVERROR(ENOMEM);
            else { c->pending = grown; c->cap_pending = cap; }
        }
        if (!r && !(c->pending[c->n_pending] = av_packet_clone(pkt))) r = AVERROR(ENOMEM);
        if (!r) c->n_pending++;
    }
    pthread_mutex_unlock(&c->mx);
    return r;
}

static void drop_pending_locked(Cam *c) {
    for (int i = 0; i < c->n_pending; i++) av_packet_free(&c->pending[i]);
    av_freep(&c->pending);
    c->n_pending = c->cap_pending = 0;
}

/* A camera that stalled or ended must not keep the audio of its file in memory (W-3): when no
 * video arrived for `stall_us` and no fragment was cut for as long, the open fragment is cut.
 * A camera whose video still flows is never cut here, whatever its GOP (OP-GOP stays open). */
int cam_cut_if_stalled(Cam *c, int64_t now, int64_t stall_us) {
    int r = 0;
    if (!atomic_load(&c->out_ready)) return 0;
    if (now - atomic_load(&c->last_video_mono_us) < stall_us || now - atomic_load(&c->sink.last_fragment_mono_us) < stall_us) return 0;
    pthread_mutex_lock(&c->mx);
    r = av_write_frame(c->out, NULL);
    /* Cut or not, the next look is one stall time away. */
    atomic_store(&c->sink.last_fragment_mono_us, now);
    if (r >= 0) r = 0;
    pthread_mutex_unlock(&c->mx);
    return r;
}

int cam_close(Cam *c) {
    int r = 0;
    pthread_mutex_lock(&c->mx);
    if (c->out) {
        if (atomic_load(&c->out_ready) && !c->sink.failed) {
            r = av_write_trailer(c->out);                   /* flushes the open fragment */
            if (r >= 0) avio_flush(c->pb);
        }
        atomic_store(&c->out_ready, 0);
        /* Waits for the sync of every written fragment: its checkpoints leave before the file is closed. */
        int s = sink_close(&c->sink);
        if (r >= 0 && s < 0) r = s;
        if (c->sink.fail_code || c->sink.dropped_tail_bytes)
            logj("error", "sink", c->sink.fail_code ? c->sink.fail_code : "tail_not_written", "\"cam\":%d,\"last_good_bytes\":%lld,\"fragments\":%lld,\"durable_fragments\":%lld,\"tail_bytes_not_written\":%lld",
                 c->idx + 1, (long long)atomic_load(&c->sink.bytes), (long long)atomic_load(&c->sink.fragments), (long long)atomic_load(&c->sink.durable_fragments), (long long)c->sink.dropped_tail_bytes);
        if (c->pb) { av_freep(&c->pb->buffer); avio_context_free(&c->pb); }
        avformat_free_context(c->out);
        c->out = NULL;
    }
    drop_pending_locked(c);
    pthread_mutex_unlock(&c->mx);
    if (c->in) avformat_close_input(&c->in);
    return r < 0 ? r : 0;
}

/* ---------------------------------------------------------------- the ingest thread */
void ingest_give_up(Cam *c) {
    if (atomic_exchange(&c->abandoned, 1)) return;
    ingest_over(c, "ingest", "INGEST_OPEN_STUCK", AVERROR(ETIMEDOUT));
}

static void *ingest_body(Cam *c);
void *ingest_main(void *arg) {
    Cam *c = arg;
    void *r = ingest_body(c);
    atomic_store(&c->th_done, 1);
    return r;
}

static void *ingest_body(Cam *c) {
    char src[32];
    snprintf(src, sizeof src, "ingest%d", c->idx + 1);

    AVDictionary *o = NULL;
    av_dict_set(&o, "rtsp_flags", "listen", 0);
    av_dict_set_int(&o, "listen_timeout", g_listen_timeout_s, 0);       /* S1 trap: always explicit */
    av_dict_set(&o, "protocol_whitelist", "tcp", 0);                    /* W-1: no datagram socket */
    c->in = avformat_alloc_context();
    if (!c->in) { av_dict_free(&o); fatal(src, "INGEST_ALLOC_FAILED", AVERROR(ENOMEM)); atomic_store(&c->state, ING_ENDED); return NULL; }
    c->in->interrupt_callback.callback = interrupt_cb;
    tls_open_errors = 0;
    tls_opening = c;
    int r = avformat_open_input(&c->in, c->url, NULL, &o);
    tls_opening = NULL;
    /* Given up while it was opening: the session went on without this camera, and stays so. */
    if (atomic_load(&c->abandoned)) { av_dict_free(&o); return NULL; }
    int leftover = av_dict_count(o);
    av_dict_free(&o);
    /* Two different failures, two codes (the skeleton reported every failed open as the second). */
    if (r < 0) { ingest_over(c, src, "INGEST_OPEN_FAILED", r); return NULL; }
    if (leftover) { fatal(src, "INGEST_OPTION_NOT_CONSUMED", AVERROR_OPTION_NOT_FOUND); atomic_store(&c->state, ING_ENDED); return NULL; }
    const char *what = NULL;
    if (sockets_violation(&what)) { fatal(src, what, AVERROR(EPERM)); atomic_store(&c->state, ING_ENDED); return NULL; }
    if ((r = avformat_find_stream_info(c->in, NULL)) < 0) { ingest_over(c, src, "INGEST_STREAM_INFO_FAILED", r); return NULL; }
    c->vidx = av_find_best_stream(c->in, AVMEDIA_TYPE_VIDEO, -1, -1, NULL, 0);
    if (c->vidx < 0) { ingest_over(c, src, "INGEST_NO_VIDEO", c->vidx); return NULL; }
    AVStream *is = c->in->streams[c->vidx];
    if (!is->codecpar->extradata_size) { ingest_over(c, src, "INGEST_NO_EXTRADATA", AVERROR_INVALIDDATA); return NULL; }   /* S1 SP-6: fail loudly */

    pthread_mutex_lock(&c->mx);
    r = open_output(c);
    for (int i = 0; r >= 0 && i < c->n_pending; i++) r = mux_audio_locked(c, c->pending[i]);
    drop_pending_locked(c);
    if (r >= 0) {
        atomic_store(&c->last_video_mono_us, mono_us());
        atomic_store(&c->sink.last_fragment_mono_us, mono_us());
        atomic_store(&c->out_ready, 1);
    }
    pthread_mutex_unlock(&c->mx);
    if (r < 0) { fatal(src, "OUTPUT_SETUP_FAILED", r); atomic_store(&c->state, ING_ENDED); return NULL; }
    logj("info", src, "ingest_connected", "\"port\":%d,\"codec\":\"%s\",\"width\":%d,\"height\":%d,\"extradata\":%d",
         c->port, avcodec_get_name(is->codecpar->codec_id), is->codecpar->width, is->codecpar->height, is->codecpar->extradata_size);
    atomic_store(&c->ever_connected, 1);
    atomic_store(&c->state, ING_CONNECTED);

    int64_t opened_mono = mono_us();     /* a packet handed over from here on waited at most since now (F-6) */
    int64_t live_after = opened_mono + US;
    c->gop_last_key_us = c->gop_last_us = AV_NOPTS_VALUE;
    c->first_skipped_pts_us = AV_NOPTS_VALUE;
    clock_floor_init(&c->clock_floor);
    int floor_judged = 0;
    AVPacket *p = av_packet_alloc();
    if (!p) { fatal(src, "PACKET_ALLOC_FAILED", AVERROR(ENOMEM)); atomic_store(&c->state, ING_ENDED); return NULL; }
    int end = 0, clock_refused = 0;
    while (!atomic_load(&g_stop_ingest)) {
        r = av_read_frame(c->in, p);
        if (r < 0) { end = r; break; }      /* the listen ingest ends on the client's TEARDOWN: one session by design (S1 G-1) */
        if (p->stream_index != c->vidx) { av_packet_unref(p); continue; }
        /* Before the camera's first sender report a packet has no time: it cannot be placed (counted, finding F-8). */
        if (p->pts == AV_NOPTS_VALUE) { atomic_fetch_add(&c->v_dropped_no_pts, 1); av_packet_unref(p); continue; }

        int64_t pts_us = av_rescale_q(p->pts, is->time_base, AV_TIME_BASE_Q);
        /* The camera's wall clock of pts 0, as this packet states it. */
        int64_t seen = AV_NOPTS_VALUE;
        size_t side = 0;
        const uint8_t *sd = av_packet_get_side_data(p, AV_PKT_DATA_PRFT, &side);
        if (sd && side >= sizeof(AVProducerReferenceTime) && ((const AVProducerReferenceTime *)sd)->wallclock > 0)
            seen = ((const AVProducerReferenceTime *)sd)->wallclock - pts_us;
        else if (!c->anchored && c->in->start_time_realtime != AV_NOPTS_VALUE)
            seen = c->in->start_time_realtime;
        /* THE CLOCK FLOOR (anchor.h; row 71): the arrival lag of EVERY packet that states a camera wall clock,
         * written or not, from the moment the ingest opened - also the ones that come before T0. */
        if (!c->anchored && seen != AV_NOPTS_VALUE) clock_floor_add(&c->clock_floor, (double)(real_us() - (seen + pts_us)) / 1000.0);
        /* Before T0 the audio timeline does not exist: the packet cannot be placed (counted; spec C.4). */
        if (!atomic_load(&S.armed)) {
            if (c->first_skipped_pts_us == AV_NOPTS_VALUE) c->first_skipped_pts_us = pts_us;
            atomic_fetch_add(&c->v_dropped_prearm, 1);
            av_packet_unref(p);
            continue;
        }
        int was_anchored = c->anchored;
        if (!c->anchored) {
            if (seen == AV_NOPTS_VALUE) {
                /* No camera wall clock yet (no sender report): the packet cannot be placed. */
                if (c->first_skipped_pts_us == AV_NOPTS_VALUE) c->first_skipped_pts_us = pts_us;
                if (atomic_fetch_add(&c->v_dropped_unanchored, 1) == 100) logj("error", src, "no_camera_wall_clock", "\"dropped\":%d", 100);
                av_packet_unref(p);
                continue;
            }
            /* F-6: a camera whose wall clock is beyond any delay is not recorded at a wrong time. The
             * packet may have waited inside libavformat since the stream opened: that much is allowed. */
            double lag0 = (double)(real_us() - (seen + pts_us)) / 1000.0;
            if (!clock_lag_sane(lag0, (double)(mono_us() - opened_mono) / 1000.0)) {
                logj("error", src, "camera_clock_out_of_bound", "\"lag_ms\":%.1f,\"bound_ms\":%.0f", lag0, CLOCK_SANITY_MS);
                av_packet_unref(p);
                end = AVERROR(ERANGE);
                clock_refused = 1;
                break;
            }
            c->anchored = 1;
            anchor_start(&c->anchor, seen, pts_us);
            logj("info", src, "video_anchored", "\"mode\":\"%s\",\"shift_us\":%lld", sd ? "prft" : "rtcp_sr", (long long)(c->anchor.anchor_us - atomic_load(&S.t0_real_us)));
        } else if (seen != AV_NOPTS_VALUE) {
            anchor_follow(&c->anchor, seen, pts_us);       /* slew-limited; the allowance never accumulates (F-1) */
        } else {
            anchor_tick(&c->anchor, pts_us);               /* no report on this packet: no allowance from it either (R-1) */
        }
        /* The packets that waited inside libavformat while it analysed the stream are handed over
         * at once: their arrival says nothing. The trend starts when the ingest is live. */
        /* ROW 71, THE RULE OVER SEVERAL PACKETS (D127 (1); anchor.h "the clock floor"). Row 62 proposed a second look
         * at the same bound on the first packet that did not wait; applied alone it gave up a camera that STALLS for a
         * few seconds (`p4_stall_pinned`: lag 3.9 s and 4.1 s on the first live packet, with a correct clock). One
         * packet cannot tell a late delivery from a slow clock; the smallest lag of ALL packets since the ingest
         * opened can: a delay only ever makes a lag larger. On the first packet that did not wait, that floor is held
         * to the bound WITHOUT the allowance of the anchoring: a stalled camera has an early packet that was on time
         * and is kept; a clock behind (or ahead) by more than the bound that the wait at anchoring hid is given up
         * here, at most one second of video after the stream opened. */
        if (was_anchored) clock_floor_add(&c->clock_floor, (double)(real_us() - (c->anchor.anchor_us + pts_us)) / 1000.0);
        if (!floor_judged && mono_us() >= live_after) {
            floor_judged = 1;
            int sane = clock_floor_sane(&c->clock_floor);
            logj(sane ? "info" : "error", src, sane ? "camera_clock_floor" : "camera_clock_out_of_bound", "\"lag_ms\":%.1f,\"bound_ms\":%.0f,\"packets\":%d,\"rule\":\"floor\"", c->clock_floor.min_lag_ms, CLOCK_SANITY_MS, c->clock_floor.packets);
            if (!sane) {
                av_packet_unref(p);
                end = AVERROR(ERANGE);
                clock_refused = 1;
                break;
            }
        }
        if (mono_us() >= live_after) {
            pthread_mutex_lock(&c->trend_mx);
            trend_add(&c->trend, (double)pts_us / US, (double)(real_us() - (c->anchor.anchor_us + pts_us)) / 1000.0);
            pthread_mutex_unlock(&c->trend_mx);
        }

        int64_t shift = av_rescale_q(c->anchor.anchor_us - atomic_load(&S.t0_real_us), AV_TIME_BASE_Q, c->ov->time_base);
        int64_t pts = av_rescale_q(p->pts, is->time_base, c->ov->time_base) + shift;
        if (!c->started) {
            if (!(p->flags & AV_PKT_FLAG_KEY) || pts < 0) {
                /* A file cannot begin with it: not a keyframe, or a keyframe from before T0 (spec C.4). */
                if (c->first_skipped_pts_us == AV_NOPTS_VALUE) c->first_skipped_pts_us = pts_us;
                atomic_fetch_add(&c->v_dropped_prestart, 1);
                av_packet_unref(p);
                continue;
            }
            c->started = 1;
            c->first_pts = pts;
            c->last_dts = pts - 1;
            /* THE START OF A CAMERA FILE (spec C.4, "held first frame - up to one GOP"; row 71, decisions D126, D130).
             * The file begins with the first keyframe that can be placed at or after T0. What the camera delivered
             * before it is NOT in the file - by specification, a stream copy cannot begin anywhere else - and the
             * muxer holds this first sample from file time 0 under the pinned flags. Both amounts are stated in the
             * record, once: `pts` (how long the frame is held, from T0) and what was skipped, by its reason, with the
             * camera time it spans (packets without a timestamp have none and are only counted). */
            long long no_pts = (long long)atomic_load(&c->v_dropped_no_pts), prearm = (long long)atomic_load(&c->v_dropped_prearm),
                      unanchored = (long long)atomic_load(&c->v_dropped_unanchored), prestart = (long long)atomic_load(&c->v_dropped_prestart);
            int64_t span_ms = c->first_skipped_pts_us == AV_NOPTS_VALUE || pts_us <= c->first_skipped_pts_us ? 0 : (pts_us - c->first_skipped_pts_us + 500) / 1000;
            logj("info", src, "video_started", "\"first_pts\":%lld,\"time_base_den\":%d,\"skipped_no_timestamp\":%lld,\"skipped_before_audio_start\":%lld,\"skipped_no_camera_clock\":%lld,\"skipped_before_keyframe\":%lld,\"skipped_span_ms\":%lld",
                 (long long)pts, c->ov->time_base.den, no_pts, prearm, unanchored, prestart, (long long)span_ms);
            if (c->ov->time_base.num == 1)
                send_record("\"kind\":\"FIRST_VIDEO_SAMPLE\",\"deviceId\":\"%s\",\"pts\":%lld,\"timescale\":%d,"
                            "\"skipped\":{\"noTimestamp\":%lld,\"beforeAudioStart\":%lld,\"noCameraClock\":%lld,\"beforeKeyframe\":%lld},\"skippedSpanMs\":%lld",
                            c->device_id, (long long)pts, c->ov->time_base.den, no_pts, prearm, unanchored, prestart, (long long)span_ms);
        }
        int64_t dts = p->dts == AV_NOPTS_VALUE ? pts : av_rescale_q(p->dts, is->time_base, c->ov->time_base) + shift;
        if (dts <= c->last_dts) dts = c->last_dts + 1;      /* the slew never makes the file's time go backwards */
        if (pts < dts) pts = dts;
        c->last_dts = dts;
        p->dts = dts;
        p->pts = pts;
        p->duration = av_rescale_q(p->duration, is->time_base, c->ov->time_base);
        p->pos = -1;
        p->stream_index = c->ov->index;
        int key = (p->flags & AV_PKT_FLAG_KEY) != 0;
        int64_t file_us = av_rescale_q(pts, c->ov->time_base, AV_TIME_BASE_Q);
        pthread_mutex_lock(&c->mx);
        r = av_write_frame(c->out, p);
        pthread_mutex_unlock(&c->mx);
        av_packet_unref(p);
        if (r < 0) { fatal(src, "VIDEO_MUX_WRITE_FAILED", r); break; }
        gop_observe(c, src, key, file_us);
        atomic_fetch_add(&c->v_written, 1);
        atomic_store(&c->last_video_mono_us, mono_us());
    }
    av_packet_free(&p);
    gop_report(c, src, 0);                                  /* what was seen, if the record has not left yet */
    ingest_over(c, src, clock_refused ? "CAMERA_CLOCK_OUT_OF_BOUND" : "INGEST_ENDED", end);
    return NULL;
}

void ingest_init(void) { av_log_set_callback(av_log_cb); }
