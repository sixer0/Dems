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

#define AVIO_BUFFER 65536
#define PENDING_AUDIO_LIMIT 4096

#define OPEN_ERROR_LIMIT 4
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
    logj("warn", source, code, "\"port\":%d,\"av_error\":\"%s\",\"video_packets\":%lld", c->port, errstr(averror, b, sizeof b), (long long)atomic_load(&c->v_written));
    send_warning("CAPTURE_FAULT", c->device_id);
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
        ingest_over(c, "ingest", "INGEST_TRANSPORT_REFUSED", AVERROR(EPROTONOSUPPORT));
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

/* Called under the camera's mutex after every mux write. */
void cam_after_write(Cam *c) {
    if (atomic_load(&c->first_reported) || atomic_load(&c->sink.fragments) < 1) return;
    atomic_store(&c->first_reported, 1);
    int64_t bytes = atomic_load(&c->sink.bytes);
    logj("info", "sink", "first_durable_fragment", "\"cam\":%d,\"bytes\":%lld", c->idx + 1, (long long)bytes);
    send_record("\"kind\":\"FIRST_DURABLE_FRAGMENT\",\"deviceId\":\"%s\",\"bytes\":%lld", c->device_id, (long long)bytes);
}

static int open_output(Cam *c) {
    int r = avformat_alloc_output_context2(&c->out, NULL, "mp4", NULL);
    if (r < 0) return r;
    uint8_t *buffer = av_malloc(AVIO_BUFFER);
    if (!buffer) return AVERROR(ENOMEM);
    /* Not seekable: the file is append-only by construction. */
    c->pb = avio_alloc_context(buffer, AVIO_BUFFER, 1, &c->sink, NULL, sink_write, NULL);
    if (!c->pb) { av_free(buffer); return AVERROR(ENOMEM); }
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
    if (r >= 0) { atomic_fetch_add(&c->a_written, 1); cam_after_write(c); }
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
    if (r >= 0) { r = 0; cam_after_write(c); }
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
        int s = sink_close(&c->sink);
        if (r >= 0 && s < 0) r = s;
        if (r >= 0) cam_after_write(c);
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

    int64_t live_after = mono_us() + US;
    AVPacket *p = av_packet_alloc();
    if (!p) { fatal(src, "PACKET_ALLOC_FAILED", AVERROR(ENOMEM)); atomic_store(&c->state, ING_ENDED); return NULL; }
    int end = 0;
    while (!atomic_load(&g_stop_ingest)) {
        r = av_read_frame(c->in, p);
        if (r < 0) { end = r; break; }      /* the listen ingest ends on the client's TEARDOWN: one session by design (S1 G-1) */
        if (p->stream_index != c->vidx) { av_packet_unref(p); continue; }
        /* Before the camera's first sender report a packet has no time: it cannot be placed (counted, finding F-8). */
        if (p->pts == AV_NOPTS_VALUE) { atomic_fetch_add(&c->v_dropped_no_pts, 1); av_packet_unref(p); continue; }
        if (!atomic_load(&S.armed)) { atomic_fetch_add(&c->v_dropped_prearm, 1); av_packet_unref(p); continue; }

        int64_t pts_us = av_rescale_q(p->pts, is->time_base, AV_TIME_BASE_Q);
        /* The camera's wall clock of pts 0, as this packet states it. */
        int64_t seen = AV_NOPTS_VALUE;
        size_t side = 0;
        const uint8_t *sd = av_packet_get_side_data(p, AV_PKT_DATA_PRFT, &side);
        if (sd && side >= sizeof(AVProducerReferenceTime) && ((const AVProducerReferenceTime *)sd)->wallclock > 0)
            seen = ((const AVProducerReferenceTime *)sd)->wallclock - pts_us;
        else if (!c->anchored && c->in->start_time_realtime != AV_NOPTS_VALUE)
            seen = c->in->start_time_realtime;
        if (!c->anchored) {
            if (seen == AV_NOPTS_VALUE) {
                /* No camera wall clock yet (no sender report): the packet cannot be placed. */
                if (atomic_fetch_add(&c->v_dropped_unanchored, 1) == 100) logj("error", src, "no_camera_wall_clock", "\"dropped\":%d", 100);
                av_packet_unref(p);
                continue;
            }
            c->anchored = 1;
            anchor_start(&c->anchor, seen, pts_us);
            logj("info", src, "video_anchored", "\"mode\":\"%s\",\"shift_us\":%lld", sd ? "prft" : "rtcp_sr", (long long)(c->anchor.anchor_us - atomic_load(&S.t0_real_us)));
        } else if (seen != AV_NOPTS_VALUE) {
            anchor_follow(&c->anchor, seen, pts_us);       /* slew-limited; the allowance never accumulates (F-1) */
        }
        /* The packets that waited inside libavformat while it analysed the stream are handed over
         * at once: their arrival says nothing. The trend starts when the ingest is live. */
        if (mono_us() >= live_after) {
            pthread_mutex_lock(&c->trend_mx);
            trend_add(&c->trend, (double)pts_us / US, (double)(real_us() - (c->anchor.anchor_us + pts_us)) / 1000.0);
            pthread_mutex_unlock(&c->trend_mx);
        }

        int64_t shift = av_rescale_q(c->anchor.anchor_us - atomic_load(&S.t0_real_us), AV_TIME_BASE_Q, c->ov->time_base);
        int64_t pts = av_rescale_q(p->pts, is->time_base, c->ov->time_base) + shift;
        if (!c->started) {
            if (!(p->flags & AV_PKT_FLAG_KEY) || pts < 0) { atomic_fetch_add(&c->v_dropped_prestart, 1); av_packet_unref(p); continue; }
            c->started = 1;
            c->first_pts = pts;
            c->last_dts = pts - 1;
            /* The true time of the first video sample of this file, in ticks of the track (the
             * muxer holds the first sample from file time 0 under the pinned flags: spec C.4). */
            logj("info", src, "video_started", "\"first_pts\":%lld,\"time_base_den\":%d", (long long)pts, c->ov->time_base.den);
            if (c->ov->time_base.num == 1)
                send_record("\"kind\":\"FIRST_VIDEO_SAMPLE\",\"deviceId\":\"%s\",\"pts\":%lld,\"timescale\":%d", c->device_id, (long long)pts, c->ov->time_base.den);
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
        pthread_mutex_lock(&c->mx);
        r = av_write_frame(c->out, p);
        if (r >= 0) cam_after_write(c);
        pthread_mutex_unlock(&c->mx);
        av_packet_unref(p);
        if (r < 0) { fatal(src, "VIDEO_MUX_WRITE_FAILED", r); break; }
        atomic_fetch_add(&c->v_written, 1);
        atomic_store(&c->last_video_mono_us, mono_us());
    }
    av_packet_free(&p);
    ingest_over(c, src, "INGEST_ENDED", end);
    return NULL;
}

void ingest_init(void) { av_log_set_callback(av_log_cb); }
