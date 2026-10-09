/*
 * THE FILTERING THREAD (blueprint row 58; register NM-02; capture spec A.2, E, F; errata AU2-07,
 * PE-111-05, PE-111-06).
 *
 *   mic PRIMARY --\
 *                  >-- astreamselect -- aformat -- ONE AAC encoder --+-- camera file 1
 *   mic STANDBY --/                                   |              +-- camera file 2
 *                                                     +-- PCM tap (the samples that feed the encoder)
 *
 * This is the only translation unit that names libavfilter, and audio_main() is the only thread
 * that runs its functions: the graph pointer is private to this file (pair-111 N-10), and the one
 * call of avfilter_graph_send_command aborts when it is not on the filtering thread (AU2-07).
 * Another thread asks for a switch with audio_request_switch(); it is applied before the next
 * input quantum (10 ms) and acknowledged from here, once it is real.
 *
 * MIC INPUT. Each mic is a named pipe written by ANOTHER PROCESS (a fixture, later an adapter
 * process): 32-bit float PCM, 48 kHz, mono. The worker generates no audio itself, so nothing in
 * it can cancel an error of its own clock (W-5).
 *
 * THE AUDIO TIMELINE. Output sample n was captured at T0 + n/48000 on the host clock, and the
 * recording consumes the mics on the host clock, one quantum every 10 ms.
 *   T0 is the capture instant of the first sample of the mic that feeds the encoder at the
 *   start. A pipe delivers a chunk a little after it was captured, and never before; so T0 is
 *   the EARLIEST of (arrival - samples so far / 48000) over the first 300 ms: scheduling delay
 *   can only make a single arrival late, and the minimum removes it.
 *
 * A MIC HAS ITS OWN CLOCK (fix round 1, finding F-4). Each mic runs through a resampler of the
 * installed FFmpeg (libswresample, its compensation interface: the ready-made async-audio kit)
 * into a short buffer that the host-clock quanta are taken from. The buffer's level says how the
 * mic's clock runs against the host's: a controller holds the level where it stood when the mic
 * started and asks the resampler to stretch or squeeze by at most MIC_MAX_PPM. A slow or fast
 * mic therefore stays audible and in place for the whole session; nothing is dropped for being
 * late. A mic that stops delivers silence (its level in telemetry is null), and when it comes
 * back it is heard again after its buffer refilled (about 50 ms). Outside +-MIC_MAX_PPM the
 * buffer runs empty or over and samples are inserted or dropped, counted in the log.
 * This transport (a named pipe written by another process) is the FIXTURE's: the device adapter
 * rows decide how a real microphone is read; what they inherit is this rule, not the pipe.
 * The file's time 0 is T0 minus the AAC priming under the pinned mux flags (spec F): see
 * CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES in @dems/shared/api.
 */
#include "worker.h"

#include <libavfilter/avfilter.h>
#include <libavfilter/buffersink.h>
#include <libavfilter/buffersrc.h>
#include <libavutil/channel_layout.h>
#include <libavutil/sha.h>
#include <libavutil/time.h>
#include <libswresample/swresample.h>

#include <errno.h>
#include <fcntl.h>
#include <math.h>
#include <poll.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

#define FIFO_CAP (SR * 2)                /* two seconds per mic */
#define LATENCY_US 40000                /* a quantum is consumed this long after it was captured */
#define TARGET_FILL ((int)(LATENCY_US * SR / US))
#define PREBUFFER_US 300000             /* the window T0 is estimated over */
#define MIC_WAIT_US 3000000             /* no mic delivers anything for this long: record silence */
#define MIC_GAP_US 200000               /* nothing for this long: the mic stopped; it is re-placed when it returns */
#ifndef MIC_MAX_PPM
#define MIC_MAX_PPM 5000                /* the clock difference the resampler is asked to absorb */
#endif
#define MIC_CALIBRATE_SAMPLES (SR / 5)  /* the level to hold is learnt over the first 200 ms of a mic */
#define MIC_DEADBAND_SAMPLES 48         /* 1 ms: below it the controller asks for nothing new */

typedef struct MicIn {
    int fd, n_part, no_writer;
    uint8_t part[4];
    struct SwrContext *swr;
    float *fifo;                        /* resampled samples waiting for their quantum */
    int have;
    int64_t received;                   /* samples read from the pipe */
    int has_data, running;
    int64_t best_real, best_mono;       /* the earliest (arrival - received/SR) seen */
    int64_t last_data_mono;
    int64_t lead_silence;               /* silence still owed before its first sample (a mic that started after T0) */
    int64_t run_samples;                /* quanta consumed since it (re)started, in samples */
    double level, target, integral;     /* smoothed buffer level, the level to hold, the controller's memory */
    double sumsq;
    float peak;
    int n_meter;
    int64_t missing, dropped, restarts;
    double ppm;                         /* what the controller asks of the resampler now */
} MicIn;

/* Private to the filtering thread. */
static AVFilterGraph *graph;
static AVFilterContext *src[NMIC], *sink;
static pthread_t filter_tid;
static MicIn mics[NMIC];
static int cur_map;
static FILE *manifest;
static int tap_fd = -1, tap_is_fifo;
static int64_t a_pkts, tap_samples;

/* The switch another thread asked for. */
static pthread_mutex_t sw_mx = PTHREAD_MUTEX_INITIALIZER;
static int sw_pending, sw_map;
static char sw_corr[ID_CHARS + 1];

int audio_request_switch(int mic_index, const char *correlation_id) {
    int r = -1;
    pthread_mutex_lock(&sw_mx);
    if (!sw_pending) {
        sw_pending = 1;
        sw_map = mic_index;
        snprintf(sw_corr, sizeof sw_corr, "%s", correlation_id);
        r = 0;
    }
    pthread_mutex_unlock(&sw_mx);
    return r;
}

int audio_set_manifest(const char *path) { return (manifest = fopen(path, "w")) ? 0 : -1; }

/* ---------------------------------------------------------------- selector (AU2-07) */
/* The ONE call site of avfilter_graph_send_command. Any other thread only fills the request;
 * this function refuses to run anywhere but on the filtering thread. */
static void filter_apply_commands(int64_t next_sample) {
    if (!pthread_equal(pthread_self(), filter_tid)) {
        logj("error", "filter", "send_command_off_filter_thread", "%s", "");
        abort();
    }
    char corr[ID_CHARS + 1];
    pthread_mutex_lock(&sw_mx);
    int pending = sw_pending, want = sw_map;
    memcpy(corr, sw_corr, sizeof corr);
    sw_pending = 0;
    pthread_mutex_unlock(&sw_mx);
    if (!pending) return;
    if (want != cur_map) {
        char m[4];
        snprintf(m, sizeof m, "%d", want);
        int r = avfilter_graph_send_command(graph, "astreamselect@asel", "map", m, NULL, 0, 0);
        if (r < 0) {
            ipc_send("\"type\":\"ACK\",\"correlationId\":\"%s\",\"ok\":false,\"code\":\"SELECTOR_COMMAND_FAILED\"", corr);
            fatal("filter", "SELECTOR_COMMAND_FAILED", r);
            return;
        }
        cur_map = want;
        logj("info", "filter", "selector_switched", "\"map\":%d,\"applied_before_sample\":%lld", want, (long long)next_sample);
    }
    ipc_send("\"type\":\"ACK\",\"correlationId\":\"%s\",\"ok\":true", corr);
}

static int filter_build(int initial_map) {
    char desc[512];
    const char *a = "sample_rate=48000:sample_fmt=flt:channel_layout=mono:time_base=1/48000";
    snprintf(desc, sizeof desc,
             "abuffer@mic1=%s[m1];abuffer@mic2=%s[m2];"
             "[m1][m2]astreamselect@asel=inputs=2:map=%d,"
             "aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=mono,abuffersink@out0", a, a, initial_map);
    graph = avfilter_graph_alloc();
    if (!graph) return AVERROR(ENOMEM);
    AVFilterInOut *in = NULL, *out = NULL;
    int r = avfilter_graph_parse_ptr(graph, desc, &in, &out, NULL);
    avfilter_inout_free(&in);
    avfilter_inout_free(&out);
    if (r < 0) return r;
    if ((r = avfilter_graph_config(graph, NULL)) < 0) return r;
    src[0] = avfilter_graph_get_filter(graph, "abuffer@mic1");
    src[1] = avfilter_graph_get_filter(graph, "abuffer@mic2");
    sink = avfilter_graph_get_filter(graph, "abuffersink@out0");
    if (!src[0] || !src[1] || !sink) return AVERROR_FILTER_NOT_FOUND;
    av_buffersink_set_frame_size(sink, AAC_FRAME);
    cur_map = initial_map;
    return 0;
}

/* ---------------------------------------------------------------- encoder fan-out (H-4) */
/* Every packet of the one encoder goes, byte for byte, into EVERY camera file (the packet is
 * cloned, which shares its buffer; nothing is encoded twice). */
static void fanout(Session *s, AVPacket *pkt) {
    if (manifest) {
        uint8_t dg[32];
        char hex[65];
        struct AVSHA *sha = av_sha_alloc();
        if (sha) {
            av_sha_init(sha, 256);
            av_sha_update(sha, pkt->data, (size_t)pkt->size);
            av_sha_final(sha, dg);
            av_free(sha);
            for (int i = 0; i < 32; i++) snprintf(hex + 2 * i, 3, "%02x", dg[i]);
            fprintf(manifest, "{\"type\":\"apkt\",\"enc\":0,\"index\":%lld,\"pts\":%lld,\"duration\":%lld,\"size\":%d,\"sha256\":\"%s\"}\n",
                    (long long)a_pkts, (long long)pkt->pts, (long long)pkt->duration, pkt->size, hex);
        }
    }
    a_pkts++;
    for (int i = 0; i < NCAM; i++) {
        if (!s->cam[i].present) continue;
        int r = cam_mux_audio(&s->cam[i], pkt);
        if (r < 0) { fatal("fanout", "AUDIO_MUX_WRITE_FAILED", r); return; }
    }
}

static void encode(Session *s, AVFrame *f, AVPacket *pkt) {
    int r = avcodec_send_frame(s->enc, f);
    if (r < 0 && r != AVERROR_EOF) { fatal("encode", "ENCODER_SEND_FAILED", r); return; }
    while ((r = avcodec_receive_packet(s->enc, pkt)) >= 0) {
        fanout(s, pkt);
        av_packet_unref(pkt);
    }
    if (r != AVERROR(EAGAIN) && r != AVERROR_EOF) fatal("encode", "ENCODER_RECEIVE_FAILED", r);
}

/* ---------------------------------------------------------------- PCM tap */
/* The samples that feed the encoder, as signed 16-bit little-endian PCM: tap sample n is output
 * sample n. The tap never holds the recording up: a pipe whose reader is behind is closed (the
 * reader sees the end, never a silent gap), a file is appended to. A tap failure is not a
 * capture failure. */
static void tap_open(Session *s) {
    struct stat st;
    if (!s->tap_path[0]) return;
    if (stat(s->tap_path, &st) == 0 && S_ISFIFO(st.st_mode)) {
        tap_is_fifo = 1;
        tap_fd = open(s->tap_path, O_WRONLY | O_NONBLOCK | O_CLOEXEC);      /* no reader yet: ENXIO, tried again later */
    } else {
        tap_fd = open(s->tap_path, O_WRONLY | O_CREAT | O_EXCL | O_APPEND | O_CLOEXEC, 0600);
        if (tap_fd < 0) logj("warn", "tap", "pcm_tap_open_failed", "\"errno\":%d", errno);
    }
}

static void tap_write(Session *s, const AVFrame *f) {
    if (!s->tap_path[0]) return;
    if (tap_fd < 0) {
        /* A pipe without a reader at the start is joined when the reader comes, but only at
         * sample 0 of the tap: a tap that would start in the middle says nothing true. */
        if (!tap_is_fifo || tap_samples != 0) return;
        tap_fd = open(s->tap_path, O_WRONLY | O_NONBLOCK | O_CLOEXEC);
        if (tap_fd < 0) { tap_samples = -1; logj("warn", "tap", "pcm_tap_no_reader", "%s", ""); return; }
    }
    int16_t pcm[AAC_FRAME];
    const float *x = (const float *)f->data[0];
    int n = f->nb_samples > AAC_FRAME ? AAC_FRAME : f->nb_samples;
    for (int i = 0; i < n; i++) {
        float v = x[i] * 32767.0f;
        pcm[i] = (int16_t)(v > 32767.0f ? 32767 : v < -32768.0f ? -32768 : lrintf(v));
    }
    ssize_t w = write(tap_fd, pcm, (size_t)n * sizeof pcm[0]);
    if (w != (ssize_t)((size_t)n * sizeof pcm[0])) {
        logj("warn", "tap", "pcm_tap_closed", "\"errno\":%d,\"samples_written\":%lld", w < 0 ? errno : 0, (long long)tap_samples);
        close(tap_fd);
        tap_fd = -1;
        tap_samples = -1;
        s->tap_path[0] = 0;
        return;
    }
    tap_samples += n;
}

static void filter_drain(Session *s, AVFrame *o, AVPacket *pkt, int flush) {
    while ((flush || !fatal_pending()) && av_buffersink_get_frame(sink, o) >= 0) {
        tap_write(s, o);
        encode(s, o, pkt);
        av_frame_unref(o);
    }
}

/* ---------------------------------------------------------------- mic inputs */
static int mic_open(MicIn *m, const Mic *plan) {
    memset(m, 0, sizeof *m);
    m->fd = -1;
    m->best_real = INT64_MAX;
    if (!plan->present) return 0;
    if (!(m->fifo = malloc(sizeof(float) * FIFO_CAP))) return AVERROR(ENOMEM);
    AVChannelLayout mono;
    av_channel_layout_default(&mono, 1);
    int r = swr_alloc_set_opts2(&m->swr, &mono, AV_SAMPLE_FMT_FLT, SR, &mono, AV_SAMPLE_FMT_FLT, SR, 0, NULL);
    if (r < 0) return r;
    if ((r = swr_init(m->swr)) < 0) return r;
    /* The resampler runs from the first sample (a compensation of nothing turns it on), so that
     * its delay is the same for the whole session and no step appears when it is first needed. */
    if ((r = swr_set_compensation(m->swr, 0, 0)) < 0) return r;
    m->fd = open(plan->path, O_RDONLY | O_NONBLOCK | O_CLOEXEC);
    if (m->fd < 0) return AVERROR(errno);
    return 0;
}

static void mic_close(MicIn *m) {
    if (m->fd >= 0) close(m->fd);
    if (m->swr) swr_free(&m->swr);
    free(m->fifo);
    m->fifo = NULL;
}

static void fifo_drop_oldest(MicIn *m, int n) {
    if (n <= 0) return;
    if (n > m->have) n = m->have;
    memmove(m->fifo, m->fifo + n, sizeof(float) * (size_t)(m->have - n));
    m->have -= n;
}

/* Reads what the pipe holds, through the resampler, into the mic's buffer. Never blocks. */
static void mic_read(MicIn *m) {
    uint8_t buf[16384];
    if (m->fd < 0) return;
    for (;;) {
        memcpy(buf, m->part, (size_t)m->n_part);
        ssize_t got = read(m->fd, buf + m->n_part, sizeof buf - (size_t)m->n_part);
        if (got <= 0) { m->no_writer = got == 0; return; }      /* no data now, or no writer */
        m->no_writer = 0;
        int64_t now_real = real_us(), now_mono = mono_us();
        size_t bytes = (size_t)got + (size_t)m->n_part, samples = bytes / 4;
        m->n_part = (int)(bytes % 4);
        float in[sizeof buf / 4];
        memcpy(in, buf, samples * 4);
        memcpy(m->part, buf + samples * 4, (size_t)m->n_part);
        for (size_t i = 0; i < samples; i++) if (!isfinite(in[i])) in[i] = 0.f;
        /* Room for what this chunk can become (the resampler may give a few samples more). */
        int room = (int)samples + 64;
        if (m->have + room > FIFO_CAP) { int over = m->have + room - FIFO_CAP; fifo_drop_oldest(m, over); m->dropped += over; }
        const uint8_t *src_data[1] = { (const uint8_t *)in };
        uint8_t *dst_data[1] = { (uint8_t *)(m->fifo + m->have) };
        int made = swr_convert(m->swr, dst_data, room, src_data, (int)samples);
        if (made < 0) { fatal("filter", "MIC_RESAMPLE_FAILED", made); return; }
        m->have += made;
        m->received += (int64_t)samples;
        m->has_data = 1;
        m->last_data_mono = now_mono;
        int64_t cand = now_real - m->received * US / SR;
        if (cand < m->best_real) { m->best_real = cand; m->best_mono = now_mono - m->received * US / SR; }
    }
}

static void mic_start(MicIn *m, int64_t lead_silence) {
    m->running = 1;
    m->lead_silence = lead_silence;
    m->run_samples = 0;
    m->level = m->target = m->integral = m->ppm = 0;
}

/* One quantum of one mic; silence where it delivers nothing. Then the controller: hold the
 * buffer's level by asking the resampler for a little more or a little less. */
static void mic_take(MicIn *m, float *dst, int64_t now_mono, int realtime) {
    int present = 0;
    if (m->running && !m->have && now_mono - m->last_data_mono > MIC_GAP_US) {
        /* The mic stopped. What it sends when it returns is placed anew. */
        m->running = 0;
        logj("warn", "filter", "mic_stopped", "\"mic\":%d,\"received\":%lld", (int)(m - mics) + 1, (long long)m->received);
    }
    if (!m->running && m->has_data && m->fd >= 0 && m->have >= TARGET_FILL + QUANTUM && now_mono - m->last_data_mono < MIC_GAP_US) {
        /* It delivers (again): start from the newest samples, one buffer level behind the present. */
        int over = m->have - (TARGET_FILL + QUANTUM);
        fifo_drop_oldest(m, over);
        mic_start(m, 0);
        m->restarts++;
        logj("info", "filter", "mic_started", "\"mic\":%d,\"restarts\":%lld", (int)(m - mics) + 1, (long long)m->restarts);
    }
    for (int i = 0; i < QUANTUM; i++) {
        float v = 0.f;
        if (m->running) {
            if (m->lead_silence > 0) m->lead_silence--;
            else if (present < m->have) v = m->fifo[present++];
        }
        dst[i] = v;
        m->sumsq += (double)v * v;
        if (fabsf(v) > m->peak) m->peak = fabsf(v);
    }
    fifo_drop_oldest(m, present);
    m->n_meter += present;
    m->missing += QUANTUM - present;
    if (!m->running || !realtime || m->lead_silence > 0) return;
    /* The level right after a quantum was taken, smoothed over about half a second. */
    /* The mic delivers in chunks: between two of them its samples go on being captured. The
     * level is therefore read as "what is buffered plus what the mic has captured since its last
     * chunk", which does not jump when a chunk lands (a chunk period that beats against the 10 ms
     * quantum would otherwise look like a clock that swings). */
    double since = (double)(now_mono - m->last_data_mono) * SR / US, level = m->have + (since < 2 * QUANTUM ? since : 2 * QUANTUM);
    m->run_samples += QUANTUM;
    m->level = m->run_samples == QUANTUM ? level : m->level + (level - m->level) / (m->run_samples <= MIC_CALIBRATE_SAMPLES ? 10.0 : 50.0);
    if (m->run_samples <= MIC_CALIBRATE_SAMPLES) { m->target = m->level; return; }
    if (m->run_samples % (QUANTUM * 10)) return;
    /* Ten times a second. Too low a level: the mic's clock is slow, the resampler is asked for more samples. */
    double err = m->target - m->level, limit = (double)SR * MIC_MAX_PPM / 1e6;
    /* Inside one millisecond of the level to hold nothing new is asked: a mic on the host's own
     * clock is passed through sample for sample, and arrival jitter moves nothing. */
    if (fabs(err) < MIC_DEADBAND_SAMPLES) err = 0;
    m->integral += err * 0.1;
    if (m->integral > limit / 0.25) m->integral = limit / 0.25;
    if (m->integral < -limit / 0.25) m->integral = -limit / 0.25;
    double rate = 1.0 * err + 0.25 * m->integral;               /* samples per second */
    if (rate > limit) rate = limit;
    if (rate < -limit) rate = -limit;
    m->ppm = rate * 1e6 / SR;
    if (m->run_samples % (SR * 5) == 0)
        logj("info", "filter", "mic_clock", "\"mic\":%d,\"level\":%.1f,\"target\":%.1f,\"asked_ppm\":%.1f", (int)(m - mics) + 1, m->level, m->target, m->ppm);
    int r = swr_set_compensation(m->swr, (int)lrint(rate), SR);
    if (r < 0) fatal("filter", "MIC_COMPENSATION_FAILED", r);
}

/* ---------------------------------------------------------------- telemetry */
static void telemetry(Session *s) {
    static const char *const role[NMIC] = { "PRIMARY", "STANDBY" };
    static const char *const state[] = { "WAITING", "CONNECTED", "ENDED" };
    char levels[256] = "", ingest[512] = "", frags[512] = "", clocks[512] = "";
    size_t l = 0, g = 0, f = 0, k = 0;
    for (int i = 0; i < NMIC; i++) {
        MicIn *m = &mics[i];
        if (!s->mic[i].present) continue;
        if (m->n_meter > 0) {
            double db = m->sumsq > 0 ? 10.0 * log10(m->sumsq / m->n_meter) : -120.0;
            if (db > 0) db = 0;
            if (db < -120.0) db = -120.0;
            l += (size_t)snprintf(levels + l, sizeof levels - l, "%s{\"role\":\"%s\",\"dbfs\":%.2f,\"clipped\":%s}", l ? "," : "", role[i], db, m->peak >= 0.999f ? "true" : "false");
        } else {
            l += (size_t)snprintf(levels + l, sizeof levels - l, "%s{\"role\":\"%s\",\"dbfs\":null,\"clipped\":false}", l ? "," : "", role[i]);
        }
        m->sumsq = 0;
        m->peak = 0;
        m->n_meter = 0;
    }
    for (int i = 0; i < NCAM; i++) {
        Cam *c = &s->cam[i];
        if (!c->present) continue;
        g += (size_t)snprintf(ingest + g, sizeof ingest - g, "%s{\"deviceId\":\"%s\",\"state\":\"%s\"}", g ? "," : "", c->device_id, state[atomic_load(&c->state)]);
        f += (size_t)snprintf(frags + f, sizeof frags - f, "%s{\"deviceId\":\"%s\",\"count\":%lld,\"bytes\":%lld}", f ? "," : "", c->device_id,
                              (long long)atomic_load(&c->sink.fragments), (long long)atomic_load(&c->sink.bytes));
        pthread_mutex_lock(&c->trend_mx);
        ClockTrend t = c->trend;
        pthread_mutex_unlock(&c->trend_mx);
        if (t.bucket_index < 0) continue;
        int fitted;
        double trend = trend_ppm(&t, &fitted);
        char ppm[32] = "null";
        if (fitted) snprintf(ppm, sizeof ppm, "%.1f", trend);
        /* lagMs: the best arrival of the last seconds minus camera time (a stall does not move it).
         * nearBound: the camera's clock moved 30 ms or more against the host's since the session's baseline
         * (learnt in its first seconds; a steady delay is not a clock error: R-2). Telemetry only. */
        if (k < sizeof clocks) k += (size_t)snprintf(clocks + k, sizeof clocks - k, "%s{\"deviceId\":\"%s\",\"lagMs\":%.3f,\"trendPpm\":%s,\"nearBound\":%s}", k ? "," : "", c->device_id, trend_window_lag_ms(&t), ppm,
                              trend_near_bound(&t) ? "true" : "false");
    }
    /* A list that did not fit is sent empty rather than cut in the middle of a member (finding F-13). */
    if (l >= sizeof levels) levels[0] = 0;
    if (g >= sizeof ingest) ingest[0] = 0;
    if (f >= sizeof frags) frags[0] = 0;
    if (k >= sizeof clocks) clocks[0] = 0;
    ipc_send_level("\"type\":\"TELEMETRY\",\"sessionId\":\"%s\",\"levels\":[%s],\"ingest\":[%s],\"fragments\":[%s],\"clocks\":[%s],\"tapActive\":%s", s->id, levels, ingest, frags, clocks, tap_fd >= 0 ? "true" : "false");
}

/* ---------------------------------------------------------------- the thread */
/* Waits until a mic delivers or `us` passed, at most 2 ms: an arrival is seen when it happens, so
 * that the estimate of T0 is not blurred by the worker's own polling. */
static void nap(int64_t us) {
    struct pollfd p[NMIC];
    int n = 0;
    if (us <= 0) return;
    if (us > 2000) us = 2000;
    for (int i = 0; i < NMIC; i++)
        if (mics[i].fd >= 0 && !mics[i].no_writer) p[n++] = (struct pollfd){ mics[i].fd, POLLIN, 0 };
    /* A pipe without a writer is always "readable" (end of file): it is not waited on. */
    if (!n || poll(p, (nfds_t)n, (int)((us + 999) / 1000)) < 0) av_usleep((unsigned)us);
}

void *audio_main(void *arg) {
    Session *s = arg;
    filter_tid = pthread_self();
    int r = filter_build(s->active_mic);
    if (r < 0) { fatal("filter", "GRAPH_BUILD_FAILED", r); return NULL; }
    for (int i = 0; i < NMIC; i++)
        if ((r = mic_open(&mics[i], &s->mic[i])) < 0) { fatal("filter", "MIC_INPUT_OPEN_FAILED", r); return NULL; }
    tap_open(s);
    AVFrame *o = av_frame_alloc();
    AVPacket *pkt = av_packet_alloc();
    if (!o || !pkt) { fatal("filter", "FRAME_ALLOC_FAILED", AVERROR(ENOMEM)); return NULL; }

    /* T0: wait for the first samples, then for the estimation window. */
    int64_t began = mono_us(), first_data = 0;
    while (!atomic_load(&g_stop)) {
        for (int i = 0; i < NMIC; i++) mic_read(&mics[i]);
        filter_apply_commands(0);
        int64_t now = mono_us();
        if (!first_data && (mics[0].has_data || mics[1].has_data)) first_data = now;
        if (first_data && now - first_data >= PREBUFFER_US) break;
        if (!first_data && now - began >= MIC_WAIT_US) break;
        nap(2000);
    }
    int master = mics[cur_map].has_data ? cur_map : mics[!cur_map].has_data ? !cur_map : -1;
    int64_t t0_real, t0_mono;
    if (master >= 0) { t0_real = mics[master].best_real; t0_mono = mics[master].best_mono; }
    else { t0_real = real_us(); t0_mono = mono_us(); logj("warn", "filter", "no_mic_delivers_samples", "\"waited_ms\":%d", (int)(MIC_WAIT_US / 1000)); }
    for (int i = 0; i < NMIC; i++) {
        MicIn *m = &mics[i];
        if (!m->has_data) continue;
        /* Sample 0 of the master is output sample 0. Another mic that began a little later owes that much silence first. */
        int64_t off = i == master ? 0 : llround((double)(m->best_real - t0_real) * SR / US);
        if (off < 0) { fifo_drop_oldest(m, (int)(-off > m->have ? m->have : -off)); off = 0; }
        mic_start(m, off);
    }
    atomic_store(&s->t0_real_us, t0_real);
    atomic_store(&s->armed, 1);
    if (manifest) fprintf(manifest, "{\"type\":\"t0\",\"t0_real_us\":%lld,\"master_mic\":%d}\n", (long long)t0_real, master);
    logj("info", "filter", "audio_started", "\"t0_real_us\":%lld,\"encoders\":1,\"quantum_samples\":%d,\"master_mic\":%d,\"movflags\":\"%s\"",
         (long long)t0_real, QUANTUM, master, MUX_MOVFLAGS);

    int64_t n = 0, meter_at = 0, meter_period = SR / (s->meter_rate_hz > 0 ? s->meter_rate_hz : 20);
    int64_t stall_us = (int64_t)s->fragment_target_ms * 1000;
    while (!atomic_load(&g_stop)) {
        /* A device hands a quantum over once it has been captured; it is consumed LATENCY later. */
        int64_t due = t0_mono + (n + QUANTUM) * US / SR + LATENCY_US, now;
        int waited = 0;
        for (;;) {
            for (int i = 0; i < NMIC; i++) mic_read(&mics[i]);
            now = mono_us();
            if (now >= due || atomic_load(&g_stop)) break;
            waited = 1;
            nap(due - now);
        }
        if (atomic_load(&g_stop)) break;
        filter_apply_commands(n);
        for (int i = 0; i < NMIC && !fatal_pending(); i++) {
            AVFrame *f = av_frame_alloc();
            if (!f) { fatal("filter", "FRAME_ALLOC_FAILED", AVERROR(ENOMEM)); break; }
            f->format = AV_SAMPLE_FMT_FLT;
            f->sample_rate = SR;
            f->nb_samples = QUANTUM;
            f->pts = n;
            av_channel_layout_default(&f->ch_layout, 1);
            if ((r = av_frame_get_buffer(f, 0)) < 0) { fatal("filter", "FRAME_ALLOC_FAILED", r); av_frame_free(&f); break; }
            /* `waited`: this quantum was taken on time, so the buffer level is a measurement (not the catch-up after T0). */
            mic_take(&mics[i], (float *)(void *)f->data[0], now, waited);
            r = av_buffersrc_add_frame_flags(src[i], f, AV_BUFFERSRC_FLAG_KEEP_REF);
            av_frame_free(&f);
            if (r < 0) { fatal("filter", "BUFFERSRC_ADD_FAILED", r); break; }
        }
        n += QUANTUM;
        filter_drain(s, o, pkt, 0);
        if (n - meter_at >= meter_period) { meter_at = n; telemetry(s); }
        if (n % (QUANTUM * 10) == 0) {
            for (int i = 0; i < NCAM; i++)
                if (s->cam[i].present && (r = cam_cut_if_stalled(&s->cam[i], now, stall_us)) < 0) fatal("filter", "STALL_CUT_FAILED", r);
        }
    }
    /* Flush: graph EOF -> the last (short) frame -> encoder EOF. Also after a fatal error, as far as it goes. */
    for (int i = 0; i < NMIC; i++)
        if ((r = av_buffersrc_add_frame_flags(src[i], NULL, 0)) < 0 && !fatal_pending()) fatal("filter", "GRAPH_EOF_FAILED", r);
    if (!fatal_pending()) {
        filter_drain(s, o, pkt, 1);
        encode(s, NULL, pkt);
    }
    if (manifest) {
        fprintf(manifest, "{\"type\":\"end\",\"samples_in\":%lld,\"t0_real_us\":%lld,\"encoders\":1,\"apkts0\":%lld,\"missing0\":%lld,\"missing1\":%lld}\n",
                (long long)n, (long long)t0_real, (long long)a_pkts, (long long)mics[0].missing, (long long)mics[1].missing);
        fclose(manifest);
        manifest = NULL;
    }
    for (int i = 0; i < NMIC; i++) {
        if (!s->mic[i].present) continue;
        logj("info", "filter", "mic_summary", "\"mic\":%d,\"received\":%lld,\"missing\":%lld,\"dropped\":%lld,\"restarts\":%lld,\"last_ppm\":%.1f",
             i + 1, (long long)mics[i].received, (long long)mics[i].missing, (long long)mics[i].dropped, (long long)mics[i].restarts, mics[i].ppm);
    }
    logj("info", "filter", "audio_finished", "\"samples_in\":%lld,\"encoder_packets\":%lld,\"tap_samples\":%lld", (long long)n, (long long)a_pkts, (long long)tap_samples);
    if (tap_fd >= 0) close(tap_fd);
    tap_fd = -1;
    for (int i = 0; i < NMIC; i++) mic_close(&mics[i]);
    av_frame_free(&o);
    av_packet_free(&pkt);
    avfilter_graph_free(&graph);
    /* A switch that was still waiting is answered: no command is left without its acknowledgement. */
    pthread_mutex_lock(&sw_mx);
    if (sw_pending) ipc_send("\"type\":\"ACK\",\"correlationId\":\"%s\",\"ok\":false,\"code\":\"NOT_RECORDING\"", sw_corr);
    sw_pending = 0;
    pthread_mutex_unlock(&sw_mx);
    return NULL;
}
