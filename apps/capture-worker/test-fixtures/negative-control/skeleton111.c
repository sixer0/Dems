/*
 * DEMS capture worker - SKELETON (blueprint row 111; Q-WORKER answer (a), decision D24).
 *
 * Form: a small C program against libavformat / libavcodec / libavfilter of the installed
 * FFmpeg, built with clang + make, spawned and supervised by the Core (NM-02, capture spec A.2).
 * FFmpeg's own API is the ready-made kit; this file is thin glue.
 *
 * What the skeleton does (and nothing more - meters, PCM tap, IPC, real devices are row 58):
 *   - two RTSP/TCP LISTEN ingests on 127.0.0.1 only (SEC35-23), video stream-copied;
 *   - two mic inputs (deterministic fakes behind mic_fill()) -> astreamselect -> aformat
 *     -> ONE native AAC encoder; every encoder packet is cloned into BOTH camera fMP4 files (H-4);
 *   - one timeline per file: audio pts = host sample count since T0, video pts = camera wall
 *     clock (RTCP sender report, AVFormatContext.start_time_realtime) + RTP pts - T0 (H-10).
 *
 * Threads:
 *   main            argument parsing, output set-up, shutdown.
 *   ingest[0..1]    one per camera: avformat_open_input (listen) + av_read_frame + mux video.
 *   filter (audio)  THE filtering thread. It builds the graph, pushes mic frames, pulls the
 *                   sink, encodes and fans out. It is the only thread that calls any avfilter_*
 *                   function after start (erratum AU2-07).
 *   control         optional (--control-stdin): parses lines and ONLY sets atomics.
 * Each output muxer is guarded by its own mutex (ingest thread + filter thread write to it).
 *
 * Logging: one JSON object per line on stderr and, with --log, appended to a file the supervisor
 * owns. No URL, credential or sample data is ever logged (camera index and port only).
 */
#include <libavcodec/avcodec.h>
#include <libavfilter/avfilter.h>
#include <libavfilter/buffersink.h>
#include <libavfilter/buffersrc.h>
#include <libavformat/avformat.h>
#include <libavutil/channel_layout.h>
#include <libavutil/opt.h>
#include <libavutil/sha.h>
#include <libavutil/time.h>

#include <math.h>
#include <pthread.h>
#include <signal.h>
#include <stdarg.h>
#include <stdatomic.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#define SR 48000            /* AUDIO-01: AAC-LC 48 kHz mono (OD-06) */
#define QUANTUM 480         /* worker input quantum: 10 ms (AU2-07 bound) */
#define AAC_FRAME 1024
#define PORT_MIN 8554       /* capture spec A.8: loopback media ports */
#define PORT_MAX 8564
#define MAX_BEEPS 256
#define NCAM 2
#define US 1000000LL

typedef struct Cam {
    int idx, port, vidx;
    const char *url, *out_path;
    AVFormatContext *in, *out;
    AVStream *ov, *oa;
    pthread_mutex_t mx;
    pthread_t th;
    atomic_int state;               /* 0 opening, 1 opened, -1 failed, 2 ended */
    int anchored, started;
    int64_t anchor_us, shift_us;
    int64_t v_written, v_dropped_prearm, v_dropped_prestart, v_dropped_unanchored, a_written;
} Cam;

typedef struct Worker {
    Cam cam[NCAM];
    double duration_s;
    int listen_timeout_s;
    int allow_arrival_anchor;
    int proof_two_encoders;         /* PROOF ONLY (row 111 negative control); -1 = off */
    int n_enc;
    AVCodecContext *enc[2];
    AVFilterGraph *graph;
    AVFilterContext *src[2], *sink[2];
    pthread_t filter_tid;
    atomic_int filter_tid_set;
    atomic_int armed;               /* outputs ready and T0 taken */
    _Atomic int64_t t0_real_us;
    atomic_int want_map;            /* requested selector input, set by any thread */
    int cur_map;
    int64_t beep_at_us[MAX_BEEPS], beep_onset[MAX_BEEPS];
    int n_beeps;
    FILE *manifest;
    int64_t a_pkts[2], samples_in;
} Worker;

static Worker W;
static volatile sig_atomic_t g_stop = 0;
static atomic_int g_stop_ingest;
static FILE *g_log;
static pthread_mutex_t g_log_mx = PTHREAD_MUTEX_INITIALIZER;

static int64_t mono_us(void) { struct timespec t; clock_gettime(CLOCK_MONOTONIC, &t); return t.tv_sec * US + t.tv_nsec / 1000; }
static int64_t real_us(void) { struct timespec t; clock_gettime(CLOCK_REALTIME, &t); return t.tv_sec * US + t.tv_nsec / 1000; }

/* Structured log line. `extra` is a printf format producing further JSON members (may be ""). */
static void logj(const char *level, const char *source, const char *msg, const char *extra, ...)
    __attribute__((format(printf, 4, 5)));
static void logj(const char *level, const char *source, const char *msg, const char *extra, ...) {
    char buf[1024];
    va_list ap;
    va_start(ap, extra);
    vsnprintf(buf, sizeof buf, extra, ap);
    va_end(ap);
    pthread_mutex_lock(&g_log_mx);
    FILE *dst[2] = { stderr, g_log };
    for (int i = 0; i < 2; i++) {
        if (!dst[i]) continue;
        fprintf(dst[i], "{\"ts_us\":%lld,\"level\":\"%s\",\"source\":\"capture-worker.%s\",\"pid\":%d,\"message\":\"%s\"%s%s}\n",
                (long long)real_us(), level, source, (int)getpid(), msg, buf[0] ? "," : "", buf);
        fflush(dst[i]);
    }
    pthread_mutex_unlock(&g_log_mx);
}

/* libav error text is ASCII without quotes; copy it defensively into a JSON-safe buffer. */
static const char *errstr(int e, char *b, size_t n) {
    av_strerror(e, b, n);
    for (char *p = b; *p; p++) if (*p == '"' || *p == '\\' || (unsigned char)*p < 0x20) *p = ' ';
    return b;
}

static void fatal(const char *source, const char *what, int e) {
    char b[128];
    logj("error", source, what, "\"av_error\":\"%s\",\"code\":%d", errstr(e, b, sizeof b), e);
    g_stop = 1;
    atomic_store(&g_stop_ingest, 1);
}

static void on_signal(int s) { (void)s; g_stop = 1; }
static int interrupt_cb(void *o) { (void)o; return atomic_load(&g_stop_ingest); }

/* ---------------------------------------------------------------- fake mics (seam for row 58) */
/* mic 0: silence + 1 kHz, 0.5 amplitude, 100 ms bursts whose onsets are absolute host instants
 *        (a hard cosine onset, so the first burst sample is 0.5 - sample-exact truth);
 * mic 1: 880 Hz at 0.1 (hot standby, audibly different). n is the absolute sample index. */
static void mic_fill(const Worker *w, int mic, int64_t n, float *dst, int cnt) {
    for (int i = 0; i < cnt; i++) {
        int64_t k = n + i;
        float v = 0.f;
        if (mic == 1) {
            v = (float)(0.1 * sin(2 * M_PI * 880.0 * (double)k / SR));
        } else {
            for (int b = 0; b < w->n_beeps; b++) {
                int64_t d = k - w->beep_onset[b];
                if (w->beep_onset[b] >= 0 && d >= 0 && d < SR / 10) { v = (float)(0.5 * cos(2 * M_PI * 1000.0 * (double)d / SR)); break; }
            }
        }
        dst[i] = v;
    }
}

/* ---------------------------------------------------------------- fan-out (H-4) */
/* Every packet of encoder 0 goes, byte for byte, into BOTH files (av_packet_clone shares the
 * buffer; nothing is re-encoded). With the proof-only two-encoder variant, encoder e feeds only
 * camera e. */
static void fanout(Worker *w, int e, AVPacket *pkt) {
    if (w->manifest) {
        uint8_t dg[32];
        char hex[65];
        struct AVSHA *sha = av_sha_alloc();
        av_sha_init(sha, 256);
        av_sha_update(sha, pkt->data, pkt->size);
        av_sha_final(sha, dg);
        av_free(sha);
        for (int i = 0; i < 32; i++) snprintf(hex + 2 * i, 3, "%02x", dg[i]);
        fprintf(w->manifest, "{\"type\":\"apkt\",\"enc\":%d,\"index\":%lld,\"pts\":%lld,\"duration\":%lld,\"size\":%d,\"sha256\":\"%s\"}\n",
                e, (long long)w->a_pkts[e], (long long)pkt->pts, (long long)pkt->duration, pkt->size, hex);
    }
    w->a_pkts[e]++;
    for (int i = 0; i < NCAM; i++) {
        if (w->n_enc == 2 && i != e) continue;
        Cam *c = &w->cam[i];
        AVPacket *q = av_packet_clone(pkt);
        if (!q) { fatal("fanout", "packet_clone_failed", AVERROR(ENOMEM)); return; }
        q->stream_index = c->oa->index;
        av_packet_rescale_ts(q, w->enc[e]->time_base, c->oa->time_base);
        pthread_mutex_lock(&c->mx);
        int r = av_interleaved_write_frame(c->out, q);
        pthread_mutex_unlock(&c->mx);
        av_packet_free(&q);
        if (r < 0) { fatal("fanout", "audio_mux_write_failed", r); return; }
        c->a_written++;
    }
}

static void encode(Worker *w, int e, AVFrame *f, AVPacket *pkt) {
    int r = avcodec_send_frame(w->enc[e], f);
    if (r < 0 && r != AVERROR_EOF) { fatal("encode", "send_frame_failed", r); return; }
    while ((r = avcodec_receive_packet(w->enc[e], pkt)) >= 0) {
        fanout(w, e, pkt);
        av_packet_unref(pkt);
    }
    if (r != AVERROR(EAGAIN) && r != AVERROR_EOF) fatal("encode", "receive_packet_failed", r);
}

/* ---------------------------------------------------------------- the filtering thread */
/* AU2-07: the ONE call site of avfilter_graph_send_command. Any other thread only stores
 * want_map; this function refuses to run anywhere but on the filtering thread. */
static void filter_apply_commands(Worker *w, int64_t next_sample) {
    if (!pthread_equal(pthread_self(), w->filter_tid)) {
        logj("error", "filter", "send_command_off_filter_thread", "%s", "");
        abort();
    }
    int want = atomic_load(&w->want_map);
    if (want == w->cur_map) return;
    char m[4];
    snprintf(m, sizeof m, "%d", want);
    int r = avfilter_graph_send_command(w->graph, "astreamselect@asel", "map", m, NULL, 0, 0);
    if (r < 0) { fatal("filter", "send_command_failed", r); return; }
    w->cur_map = want;
    logj("info", "filter", "selector_switched", "\"map\":%d,\"applied_before_sample\":%lld", want, (long long)next_sample);
}

static int filter_build(Worker *w) {
    char desc[1024];
    const char *a = "sample_rate=48000:sample_fmt=flt:channel_layout=mono:time_base=1/48000";
    int n = snprintf(desc, sizeof desc,
                     "abuffer@mic1=%s[m1];abuffer@mic2=%s[m2];"
                     "[m1][m2]astreamselect@asel=inputs=2:map=0,"
                     "aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=mono", a, a);
    if (w->n_enc == 1) snprintf(desc + n, sizeof desc - n, ",abuffersink@out0");
    else if (w->proof_two_encoders > 0)
        snprintf(desc + n, sizeof desc - n, ",asplit[a][b];[a]abuffersink@out0;[b]atrim=start_sample=%d,abuffersink@out1", w->proof_two_encoders);
    else snprintf(desc + n, sizeof desc - n, ",asplit[a][b];[a]abuffersink@out0;[b]abuffersink@out1");

    w->graph = avfilter_graph_alloc();
    AVFilterInOut *in = NULL, *out = NULL;
    int r = avfilter_graph_parse_ptr(w->graph, desc, &in, &out, NULL);
    avfilter_inout_free(&in);
    avfilter_inout_free(&out);
    if (r < 0) return r;
    if ((r = avfilter_graph_config(w->graph, NULL)) < 0) return r;
    w->src[0] = avfilter_graph_get_filter(w->graph, "abuffer@mic1");
    w->src[1] = avfilter_graph_get_filter(w->graph, "abuffer@mic2");
    w->sink[0] = avfilter_graph_get_filter(w->graph, "abuffersink@out0");
    w->sink[1] = w->n_enc == 2 ? avfilter_graph_get_filter(w->graph, "abuffersink@out1") : NULL;
    if (!w->src[0] || !w->src[1] || !w->sink[0] || (w->n_enc == 2 && !w->sink[1])) return AVERROR_FILTER_NOT_FOUND;
    for (int e = 0; e < w->n_enc; e++) av_buffersink_set_frame_size(w->sink[e], AAC_FRAME);
    return 0;
}

static void filter_drain(Worker *w, AVFrame *o, AVPacket *pkt) {
    for (int e = 0; e < w->n_enc; e++) {
        while (!g_stop && av_buffersink_get_frame(w->sink[e], o) >= 0) {
            encode(w, e, o, pkt);
            av_frame_unref(o);
        }
    }
}

static void *filter_main(void *arg) {
    Worker *w = arg;
    w->filter_tid = pthread_self();
    atomic_store(&w->filter_tid_set, 1);
    int r = filter_build(w);
    if (r < 0) { fatal("filter", "graph_build_failed", r); atomic_store(&w->armed, 1); return NULL; }

    AVFrame *o = av_frame_alloc();
    AVPacket *pkt = av_packet_alloc();
    int64_t total = (int64_t)(w->duration_s * SR), n = 0;

    /* T0: host instant of audio sample 0. Sample n was captured at T0 + n/SR on the host clock. */
    int64_t t0_mono = mono_us(), t0_real = real_us();
    for (int b = 0; b < w->n_beeps; b++) {
        int64_t d = w->beep_at_us[b] - t0_real;
        w->beep_onset[b] = d < 0 ? -1 : (d * SR + US - 1) / US;      /* ceil: first sample at/after the instant */
        if (w->manifest)
            fprintf(w->manifest, "{\"type\":\"beep\",\"index\":%d,\"at_us\":%lld,\"onset_sample\":%lld}\n",
                    b, (long long)w->beep_at_us[b], (long long)w->beep_onset[b]);
    }
    atomic_store(&w->t0_real_us, t0_real);
    atomic_store(&w->armed, 1);
    logj("info", "filter", "audio_started", "\"t0_real_us\":%lld,\"encoders\":%d,\"quantum_samples\":%d,\"beeps\":%d",
         (long long)t0_real, w->n_enc, QUANTUM, w->n_beeps);

    while (n < total && !g_stop) {
        /* a device hands over a quantum once it has been captured: due = T0 + (n+Q)/SR */
        int64_t wait = t0_mono + (n + QUANTUM) * US / SR - mono_us();
        if (wait > 0) av_usleep((unsigned)wait);
        filter_apply_commands(w, n);
        for (int s = 0; s < 2 && !g_stop; s++) {
            AVFrame *f = av_frame_alloc();
            f->format = AV_SAMPLE_FMT_FLT;
            f->sample_rate = SR;
            f->nb_samples = QUANTUM;
            f->pts = n;
            av_channel_layout_default(&f->ch_layout, 1);
            if ((r = av_frame_get_buffer(f, 0)) < 0) { fatal("filter", "frame_alloc_failed", r); av_frame_free(&f); break; }
            mic_fill(w, s, n, (float *)f->data[0], QUANTUM);
            r = av_buffersrc_add_frame_flags(w->src[s], f, AV_BUFFERSRC_FLAG_KEEP_REF);
            av_frame_free(&f);
            if (r < 0) { fatal("filter", "buffersrc_add_failed", r); break; }
        }
        n += QUANTUM;
        filter_drain(w, o, pkt);
    }
    w->samples_in = n;
    int was_fault = g_stop && n < total;
    /* flush: graph EOF -> last (short) frame -> encoder EOF */
    for (int s = 0; s < 2; s++)
        if ((r = av_buffersrc_add_frame_flags(w->src[s], NULL, 0)) < 0) fatal("filter", "graph_eof_failed", r);
    for (int e = 0; e < w->n_enc; e++) {
        while (av_buffersink_get_frame(w->sink[e], o) >= 0) { encode(w, e, o, pkt); av_frame_unref(o); }
        encode(w, e, NULL, pkt);
    }
    if (w->manifest)
        fprintf(w->manifest, "{\"type\":\"end\",\"samples_in\":%lld,\"t0_real_us\":%lld,\"encoders\":%d,\"apkts0\":%lld,\"apkts1\":%lld}\n",
                (long long)n, (long long)t0_real, w->n_enc, (long long)w->a_pkts[0], (long long)w->a_pkts[1]);
    logj(was_fault ? "warn" : "info", "filter", "audio_finished", "\"samples_in\":%lld,\"wall_ms\":%lld,\"stopped_early\":%s",
         (long long)n, (long long)((mono_us() - t0_mono) / 1000), was_fault ? "true" : "false");
    av_frame_free(&o);
    av_packet_free(&pkt);
    avfilter_graph_free(&w->graph);
    return NULL;
}

/* ---------------------------------------------------------------- RTSP ingest (video copy) */
static void *ingest_main(void *arg) {
    Cam *c = arg;
    Worker *w = &W;
    char src[32];
    snprintf(src, sizeof src, "ingest%d", c->idx + 1);

    AVDictionary *o = NULL;
    av_dict_set(&o, "rtsp_flags", "listen", 0);
    av_dict_set_int(&o, "listen_timeout", w->listen_timeout_s, 0);      /* S1 trap: always explicit */
    c->in = avformat_alloc_context();
    c->in->interrupt_callback.callback = interrupt_cb;
    int r = avformat_open_input(&c->in, c->url, NULL, &o);
    int leftover = av_dict_count(o);
    av_dict_free(&o);
    if (r < 0 || leftover) { fatal(src, leftover ? "ingest_option_not_consumed" : "ingest_open_failed", r); atomic_store(&c->state, -1); return NULL; }
    if ((r = avformat_find_stream_info(c->in, NULL)) < 0) { fatal(src, "stream_info_failed", r); atomic_store(&c->state, -1); return NULL; }
    c->vidx = av_find_best_stream(c->in, AVMEDIA_TYPE_VIDEO, -1, -1, NULL, 0);
    if (c->vidx < 0) { fatal(src, "no_video_stream", c->vidx); atomic_store(&c->state, -1); return NULL; }
    AVStream *is = c->in->streams[c->vidx];
    logj("info", src, "ingest_connected", "\"port\":%d,\"codec\":\"%s\",\"width\":%d,\"height\":%d,\"extradata\":%d",
         c->port, avcodec_get_name(is->codecpar->codec_id), is->codecpar->width, is->codecpar->height, is->codecpar->extradata_size);
    atomic_store(&c->state, 1);

    AVPacket *p = av_packet_alloc();
    while (!atomic_load(&g_stop_ingest)) {
        r = av_read_frame(c->in, p);
        if (r < 0) {
            char b[128];
            /* the listen ingest ends on client TEARDOWN - single session by design (S1 G-1) */
            if (!atomic_load(&g_stop_ingest)) logj("warn", src, "ingest_ended", "\"av_error\":\"%s\"", errstr(r, b, sizeof b));
            break;
        }
        if (p->stream_index != c->vidx || p->pts == AV_NOPTS_VALUE) { av_packet_unref(p); continue; }
        if (!atomic_load(&w->armed)) { c->v_dropped_prearm++; av_packet_unref(p); continue; }
        if (!c->anchored) {
            const char *mode = NULL;
            if (c->in->start_time_realtime != AV_NOPTS_VALUE) {
                /* camera wall clock of pts 0, from the first RTCP sender report (camera clock domain) */
                c->anchor_us = c->in->start_time_realtime;
                mode = "rtcp_sr";
            } else if (w->allow_arrival_anchor) {
                c->anchor_us = real_us() - av_rescale_q(p->pts, is->time_base, AV_TIME_BASE_Q);
                mode = "arrival";
            } else {
                if (c->v_dropped_unanchored++ == 100) logj("error", src, "no_camera_wall_clock", "\"dropped\":%d", 100);
                av_packet_unref(p);
                continue;
            }
            c->anchored = 1;
            c->shift_us = c->anchor_us - atomic_load(&w->t0_real_us);
            logj("info", src, "video_anchored", "\"mode\":\"%s\",\"anchor_us\":%lld,\"shift_us\":%lld", mode, (long long)c->anchor_us, (long long)c->shift_us);
        }
        int64_t shift = av_rescale_q(c->shift_us, AV_TIME_BASE_Q, c->ov->time_base);
        int64_t pts = av_rescale_q(p->pts, is->time_base, c->ov->time_base) + shift;
        if (!c->started) {
            if (!(p->flags & AV_PKT_FLAG_KEY) || pts < 0) { c->v_dropped_prestart++; av_packet_unref(p); continue; }
            c->started = 1;
            logj("info", src, "video_started", "\"first_pts\":%lld,\"time_base_den\":%d", (long long)pts, c->ov->time_base.den);
        }
        p->dts = p->dts == AV_NOPTS_VALUE ? pts : av_rescale_q(p->dts, is->time_base, c->ov->time_base) + shift;
        p->pts = pts;
        p->duration = av_rescale_q(p->duration, is->time_base, c->ov->time_base);
        p->pos = -1;
        p->stream_index = c->ov->index;
        pthread_mutex_lock(&c->mx);
        r = av_interleaved_write_frame(c->out, p);       /* takes ownership of the packet data */
        pthread_mutex_unlock(&c->mx);
        if (r < 0) { fatal(src, "video_mux_write_failed", r); break; }
        c->v_written++;
    }
    av_packet_free(&p);
    atomic_store(&c->state, 2);
    return NULL;
}

/* ---------------------------------------------------------------- control (never touches the graph) */
static void *control_main(void *arg) {
    Worker *w = arg;
    char line[64];
    while (fgets(line, sizeof line, stdin)) {
        int m;
        if (sscanf(line, "switch %d", &m) == 1 && (m == 0 || m == 1)) atomic_store(&w->want_map, m);
        else if (!strncmp(line, "stop", 4)) { g_stop = 1; break; }
        else logj("warn", "control", "unknown_command", "%s", "");
    }
    return NULL;
}

/* ---------------------------------------------------------------- set-up */
/* SEC35-23: the listen URL host literal must be 127.0.0.1, port inside the media range, no
 * credentials, no trailing slash (S1 trap). */
static int parse_listen_url(const char *u, int *port) {
    const char *pre = "rtsp://127.0.0.1:";
    if (strncmp(u, pre, strlen(pre)) || strchr(u, '@')) return -1;
    char *end;
    long p = strtol(u + strlen(pre), &end, 10);
    if (p < PORT_MIN || p > PORT_MAX || *end != '/' || !end[1] || u[strlen(u) - 1] == '/') return -1;
    *port = (int)p;
    return 0;
}

static int open_encoder(Worker *w, int e) {
    const AVCodec *codec = avcodec_find_encoder_by_name("aac");
    if (!codec) return AVERROR_ENCODER_NOT_FOUND;
    AVCodecContext *x = avcodec_alloc_context3(codec);
    x->sample_fmt = AV_SAMPLE_FMT_FLTP;
    x->sample_rate = SR;
    x->bit_rate = 96000;
    x->time_base = (AVRational){ 1, SR };
    x->flags |= AV_CODEC_FLAG_GLOBAL_HEADER;
    av_channel_layout_default(&x->ch_layout, 1);
    w->enc[e] = x;
    return avcodec_open2(x, codec, NULL);
}

static int open_output(Worker *w, Cam *c) {
    int r = avformat_alloc_output_context2(&c->out, NULL, "mp4", c->out_path);
    if (r < 0) return r;
    AVStream *is = c->in->streams[c->vidx];
    c->ov = avformat_new_stream(c->out, NULL);
    c->oa = avformat_new_stream(c->out, NULL);
    if (!c->ov || !c->oa) return AVERROR(ENOMEM);
    if ((r = avcodec_parameters_copy(c->ov->codecpar, is->codecpar)) < 0) return r;   /* stream copy */
    c->ov->codecpar->codec_tag = 0;
    c->ov->time_base = is->time_base;
    if ((r = avcodec_parameters_from_context(c->oa->codecpar, w->enc[w->n_enc == 2 ? c->idx : 0])) < 0) return r;
    c->oa->time_base = (AVRational){ 1, SR };
    if ((r = avio_open(&c->out->pb, c->out_path, AVIO_FLAG_WRITE)) < 0) return r;
    AVDictionary *o = NULL;
    av_dict_set(&o, "movflags", "+frag_keyframe+empty_moov+default_base_moof", 0);     /* S1 section 3 */
    r = avformat_write_header(c->out, &o);
    av_dict_free(&o);
    return r;
}

static void usage(void) {
    fprintf(stderr,
            "usage: capture-worker --cam1 rtsp://127.0.0.1:<8554-8564>/<name> --out1 <file.mp4>\n"
            "                      --cam2 rtsp://127.0.0.1:<8554-8564>/<name> --out2 <file.mp4>\n"
            "                      --duration <seconds> [--listen-timeout <s>] [--log <file.jsonl>]\n"
            "                      [--audio-manifest <file.jsonl>] [--beep-at-us <t1,t2,...>]\n"
            "                      [--control-stdin] [--anchor-arrival-fallback]\n"
            "                      [--proof-two-encoders <skew_samples>]   (row 111 negative control only)\n");
}

int main(int argc, char **argv) {
    Worker *w = &W;
    w->listen_timeout_s = 15;
    w->proof_two_encoders = -1;
    int control = 0;
    const char *manifest_path = NULL;
    for (int i = 0; i < NCAM; i++) { w->cam[i].idx = i; pthread_mutex_init(&w->cam[i].mx, NULL); }
    for (int i = 1; i < argc; i++) {
        const char *k = argv[i], *v = i + 1 < argc ? argv[i + 1] : NULL;
        if (!strcmp(k, "--control-stdin")) { control = 1; continue; }
        if (!strcmp(k, "--anchor-arrival-fallback")) { w->allow_arrival_anchor = 1; continue; }
        if (!v) { usage(); return 2; }
        i++;
        if (!strcmp(k, "--cam1")) w->cam[0].url = v;
        else if (!strcmp(k, "--cam2")) w->cam[1].url = v;
        else if (!strcmp(k, "--out1")) w->cam[0].out_path = v;
        else if (!strcmp(k, "--out2")) w->cam[1].out_path = v;
        else if (!strcmp(k, "--duration")) w->duration_s = atof(v);
        else if (!strcmp(k, "--listen-timeout")) w->listen_timeout_s = atoi(v);
        else if (!strcmp(k, "--log")) g_log = fopen(v, "a");
        else if (!strcmp(k, "--audio-manifest")) manifest_path = v;
        else if (!strcmp(k, "--proof-two-encoders")) w->proof_two_encoders = atoi(v);
        else if (!strcmp(k, "--beep-at-us")) {
            for (const char *s = v; *s && w->n_beeps < MAX_BEEPS;) {
                char *end;
                w->beep_at_us[w->n_beeps++] = strtoll(s, &end, 10);
                s = *end == ',' ? end + 1 : end;
                if (end == s && *s) { usage(); return 2; }
            }
        } else { usage(); return 2; }
    }
    if (!w->cam[0].url || !w->cam[1].url || !w->cam[0].out_path || !w->cam[1].out_path || w->duration_s <= 0 || w->listen_timeout_s <= 0) { usage(); return 2; }
    for (int i = 0; i < NCAM; i++)
        if (parse_listen_url(w->cam[i].url, &w->cam[i].port)) {
            logj("error", "main", "listen_url_refused", "\"cam\":%d,\"rule\":\"rtsp://127.0.0.1:%d-%d/<name>, no credentials, no trailing slash\"", i + 1, PORT_MIN, PORT_MAX);
            return 2;
        }
    if (w->cam[0].port == w->cam[1].port) { logj("error", "main", "listen_ports_collide", "\"port\":%d", w->cam[0].port); return 2; }
    if (manifest_path && !(w->manifest = fopen(manifest_path, "w"))) { logj("error", "main", "manifest_open_failed", "%s", ""); return 1; }
    w->n_enc = w->proof_two_encoders >= 0 ? 2 : 1;

    signal(SIGINT, on_signal);
    signal(SIGTERM, on_signal);
    signal(SIGPIPE, SIG_IGN);
    avformat_network_init();
    logj("info", "main", "worker_starting", "\"lavf\":\"%s\",\"port1\":%d,\"port2\":%d,\"duration_s\":%.3f,\"encoders\":%d",
         av_version_info(), w->cam[0].port, w->cam[1].port, w->duration_s, w->n_enc);

    for (int i = 0; i < NCAM; i++) pthread_create(&w->cam[i].th, NULL, ingest_main, &w->cam[i]);
    int64_t deadline = mono_us() + (w->listen_timeout_s + 10) * US;
    int rc = 0;
    for (;;) {
        int s0 = atomic_load(&w->cam[0].state), s1 = atomic_load(&w->cam[1].state);
        if (s0 < 0 || s1 < 0 || g_stop) { rc = 1; break; }
        if (s0 >= 1 && s1 >= 1) break;
        if (mono_us() > deadline) { logj("error", "main", "ingest_connect_timeout", "%s", ""); rc = 1; break; }
        av_usleep(5000);
    }
    int outputs = 0;
    pthread_t fth, cth;
    if (!rc) {
        int r = 0;
        for (int e = 0; e < w->n_enc && r >= 0; e++) r = open_encoder(w, e);
        for (int i = 0; i < NCAM && r >= 0; i++) r = open_output(w, &w->cam[i]);
        if (r < 0) { fatal("main", "output_setup_failed", r); rc = 1; }
        else outputs = 1;
    }
    if (!rc) {
        if (control) { pthread_create(&cth, NULL, control_main, w); pthread_detach(cth); }
        pthread_create(&fth, NULL, filter_main, w);
        pthread_join(fth, NULL);
        if (g_stop && w->samples_in < (int64_t)(w->duration_s * SR)) rc = w->samples_in ? 0 : 1;
    }
    atomic_store(&g_stop_ingest, 1);
    for (int i = 0; i < NCAM; i++) pthread_join(w->cam[i].th, NULL);
    for (int i = 0; i < NCAM; i++) {
        Cam *c = &w->cam[i];
        if (outputs && c->out) {
            int r = av_write_trailer(c->out);
            if (r < 0) { fatal("main", "trailer_failed", r); rc = 1; }
            avio_closep(&c->out->pb);
            avformat_free_context(c->out);
        }
        if (c->in) avformat_close_input(&c->in);
        logj("info", "main", "camera_summary",
             "\"cam\":%d,\"video_packets\":%lld,\"audio_packets\":%lld,\"dropped_prearm\":%lld,\"dropped_prestart\":%lld,\"dropped_unanchored\":%lld,\"shift_us\":%lld",
             i + 1, (long long)c->v_written, (long long)c->a_written, (long long)c->v_dropped_prearm,
             (long long)c->v_dropped_prestart, (long long)c->v_dropped_unanchored, (long long)c->shift_us);
    }
    for (int e = 0; e < w->n_enc; e++) if (w->enc[e]) avcodec_free_context(&w->enc[e]);
    if (w->manifest) fclose(w->manifest);
    logj(rc ? "error" : "info", "main", "worker_exit", "\"rc\":%d,\"encoders\":%d,\"encoder_packets\":%lld", rc, w->n_enc, (long long)w->a_pkts[0]);
    if (g_log) fclose(g_log);
    return rc;
}
