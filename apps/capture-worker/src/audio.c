/*
 * THE FILTERING THREAD (blueprint row 58; register NM-02; capture spec A.2, E, F; errata AU2-07,
 * PE-111-05, PE-111-06).
 *
 * D61 (2026-11-04): the plan carries FOUR numbered microphone channels recorded SIMULTANEOUSLY (was two
 * roles with a failover selector). The thread keeps the legacy two-role lane below (channels 1 and 2 ->
 * selector -> ONE AAC encoder -> every camera file: the audio track of the video files and the transcribed
 * plane of `AUDIO-01`) and ADDS, for every channel whose plan row names an `outputPath`, a recording of
 * its own: that channel's quantum -> ITS OWN AAC encoder -> its own fMP4 file (one encoder instance per
 * file - four channels are four different streams, nothing can be shared; the lane's encoder plus up to
 * four channel encoders is the honest count, stated in the `audio_started` log). Channels without an
 * outputPath are read, metered, warned for and accounted - but not yet written anywhere (the Core wires
 * the four outputs in its own D61 wave).
 *
 *   mic MIC-01 --\
 *                 >-- astreamselect -- aformat -- ONE AAC encoder --+-- camera file 1 .. N (D60)
 *   mic MIC-02 --/                                    |             +-- PCM tap (lane samples -> encoder)
 *                                                     +
 *   mic MIC-03 ---------- own encoder -------------------------------- own fMP4 file   \
 *   mic MIC-04 ---------- own encoder -------------------------------- own fMP4 file   / D61, per outputPath
 *
 * This is the only translation unit that names libavfilter, and audio_main() is the only thread
 * that runs its functions: the graph pointer is private to this file (pair-111 N-10), and the one
 * call of avfilter_graph_send_command aborts when it is not on the filtering thread (AU2-07).
 * Another thread asks for a switch with audio_request_switch(); it is applied before the next
 * input quantum (10 ms) and acknowledged from here, once it is real.
 *
 * THE SWITCH (blueprint row 71; capture spec E; OD-09, OD-11; errata AU2-05, AU2-07).
 *   - WHO: the operator's command, and nothing else. `cur_map` is written in filter_build() and
 *     in filter_apply_commands(); the warning raiser (micwatch.c) has no way to reach either.
 *   - WHEN: at the next input quantum after the command was read. Every frame the graph was given
 *     before the command is already through the selector (the graph is drained after every
 *     quantum, and the selector emits a frame as soon as both inputs hold it), so the first sample
 *     of the new source is EXACTLY the first sample of that quantum: `fromSample` of the record.
 *     The bound is one quantum (10 ms) plus the time the command waited in the pipe; the record
 *     states what it was (`appliedDelayUs`) and a check holds it to 21,333 us.
 *   - HOW: a HARD CUT (gate answer Q-CLICK, the default): no crossfade, no sample inserted and
 *     none dropped - both inputs run on the same sample counter, and the selector passes one of
 *     them. The cut is audible as a click when the two signals differ at that sample (AU2-07:
 *     a step of 0.42 to 0.71 against 0.02 to 0.03 per sample); a crossfade would mix both
 *     microphones for its length, which "one active microphone" (OD-09) does not allow without
 *     a decision.
 *   - THE RECORD: one AUDIO_SOURCE_INTERVAL when T0 is taken and one per realised switch, written
 *     BEFORE the ACK of that switch; AUDIO_TIMELINE_END when the thread ends. Media time, counted
 *     here from the sample counter of the encoder's input; never from the operator's clock.
 *   A switch that arrives before T0 is refused (NOT_RECORDING): there is no timeline to place it on.
 *
 * WARNINGS, NEVER A SWITCH (spec E.1; micwatch.h). Per microphone, by its DEVICE ID: MIC_SILENT
 * (delivered samples at or below the silence level for the silence duration), CAPTURE_FAULT /
 * MIC_DISCONNECTED (no sample for the debounce) and CAPTURE_FAULT / MIC_RATE_AT_LIMIT (the rate
 * controller held at +-MIC_MAX_PPM: D85 R-3 - such a microphone was degrading without a word).
 * Each is raised and cleared; the source that feeds the encoder stays what the operator chose.
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
 *
 * A GAPPED MICROPHONE (protocol version 5; design 06 sections 7.2a, 8.2; decisions C107, C110 (2), (5)). The
 * input kind PCM_FIFO_GAPPED is the same bytes from a writer that does NOT promise every sample (the bench form
 * of the macOS path loses about one packet of 512 in ten). For such a microphone the worker:
 *   - makes NO resampler and asks for NO compensation: what it reads is COPIED into its buffer, value for value;
 *     no rate controller runs, so MIC_RATE_AT_LIMIT cannot arise and `ratePpm` is null (mic_open, mic_read,
 *     mic_take, telemetry: the only places besides audio_main that read the flag);
 *   - inserts zeros where its buffer runs empty, as for every microphone, and ACCOUNTS FOR EVERY SAMPLE, from
 *     sample 0 of the timeline: received, inserted, discarded (the full buffer, the re-placement, the trim
 *     before sample 0, and the buffer's rest at the end), buffered, not finite. Before it writes an account it
 *     checks  timeline = received - discarded - buffered + inserted  and writes NO account when that fails;
 *   - follows the RUNS of inserted samples on the TRACK (what the one encoder is fed): one AUDIO_INSERTED_RUN per
 *     run of CAPTURE_AUDIO_INSERTED_RUN_MIN_SAMPLES or more, and a MIC_SAMPLE_ACCOUNT every
 *     CAPTURE_MIC_ACCOUNT_PERIOD_SAMPLES and once more, closing, before AUDIO_TIMELINE_END.
 * A microphone of kind PCM_FIFO is not changed by any of this: every line of its path is the line it was. The
 * counts the account needs are kept for every microphone (they change nothing a microphone does) and are
 * reported, beside the four telemetry members every microphone states, for a gapped one only.
 */
#include "worker.h"
#include "micwatch.h"

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
    MicWatch watch;                     /* silence, disconnect, rate at its limit (micwatch.h): says, never switches */
    int taken;                          /* samples it delivered into the last quantum */
    double taken_sumsq;                 /* the sum of their squares */
    /* Protocol version 5: the account (kept for every microphone, reported for a gapped one). */
    const Mic *plan;                    /* its microphone of the plan: whether it is gapped */
    int head;                           /* zeros at the HEAD of the last quantum (owed lead, or all of it while it does not run) */
    int nonzero;                        /* one sample, as read, was finite and not zero */
    int64_t discarded;                  /* received and never put on the timeline */
    int64_t nonfinite;                  /* received as not a finite number (on the timeline as a zero, not inserted) */
    int64_t fed, fed_inserted;          /* track samples while it fed the encoder; of those, inserted */
    int64_t fed_runs, fed_longest;      /* runs of inserted track samples that BEGAN while it fed; the longest (closed) */
    int64_t listed, not_listed, not_listed_samples;   /* of the long ones: written; not written (the bound), their sum */
    /* D61 (2026-11-04): the channel's OWN audio file (the plan row's `outputPath`): its own AAC encoder and its
     * own fMP4 writer over the same sink.c durability machine. ONE ENCODER INSTANCE PER FILE is the honest count:
     * the four channels are four different streams (a shared encoder cannot encode four signals), and every file
     * needs the packets of its own stream. The filtering thread is the only writer; the sink's sync thread reports. */
    struct AVCodecContext *enc;
    AVFormatContext *out;
    AVIOContext *pb;
    Sink sink;
    int recording;                      /* 1 once the file's muxer header is written */
    int64_t rec_pkts;                   /* encoder packets muxed into the channel file */
    AVFrame *conv;                      /* the encoder frame as FLTP: the AAC encoder's input format (mono: ONE plane; the lane's graph reaches that form through aformat) */
    float stage[AAC_FRAME];             /* D61: the channel file's encoder takes WHOLE 1024-sample frames (the lane's graph sizes them so with av_buffersink_set_frame_size); the quanta are staged here */
    int staged;                         /* samples in `stage` now (0..AAC_FRAME-1) */
    int64_t rec_pts;                    /* the sample index the next encoder frame starts at */
    int64_t cut_mono;                   /* D61: the instant the channel file's open fragment began (the cut rule of W-3, applied per min_frag_duration - the muxer cuts no audio-only fragment of its own) */
} MicIn;

/* Private to the filtering thread. */
static AVFilterGraph *graph;
static AVFilterContext *src[NMIC], *sink;
static pthread_t filter_tid;
static MicIn mics[NMIC];
static int cur_map;                     /* the input the selector passes: written by filter_build and filter_apply_commands only */
static int intervals;                   /* AUDIO_SOURCE_INTERVAL records written */
static FILE *manifest;
static int tap_fd = -1, tap_is_fifo;
static int64_t a_pkts, tap_samples;
/* Version 5: the run of inserted samples on the TRACK that is open now (first sample, length; -1: none), the
 * microphone that fed at its first sample, and the AUDIO_INSERTED_RUN records written so far (the last index). */
static int64_t run_from = -1, run_len;
static int run_owner, runs_listed;

/* The switch another thread asked for. */
static pthread_mutex_t sw_mx = PTHREAD_MUTEX_INITIALIZER;
static int sw_pending, sw_map;
static int64_t sw_asked_mono;
static char sw_corr[ID_CHARS + 1];

int audio_request_switch(int mic_index, const char *correlation_id) {
    int r = -1;
    pthread_mutex_lock(&sw_mx);
    if (!sw_pending) {
        sw_pending = 1;
        sw_map = mic_index;
        sw_asked_mono = mono_us();
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
/* D61 (2026-11-04): the LEGACY two-role lane's word for a channel: PRIMARY names channel 1, STANDBY every other
 * row. The wire's `role` member survives on the telemetry level and the interval / account / inserted-run records
 * (the plan itself keys its rows by `channel` now); retiring this lane is a later wave. */
static const char *role_word(int i) { return i == 0 ? "PRIMARY" : "STANDBY"; }

/* One AUDIO_SOURCE_INTERVAL record: the microphone `cur_map` feeds the encoder from `from_sample` on.
 * `corr` NULL: the interval of the start. */
static void interval_record(Session *s, int64_t from_sample, int64_t t0_real, const char *corr, int64_t delay_us) {
    int64_t at_ms = (t0_real + from_sample * US / SR) / 1000;
    intervals++;
    if (corr)
        send_record("\"kind\":\"AUDIO_SOURCE_INTERVAL\",\"deviceId\":\"%s\",\"role\":\"%s\",\"index\":%d,\"fromSample\":%lld,\"sampleRateHz\":%d,\"capturedAtMs\":%lld,\"reason\":\"OPERATOR_SWITCH\",\"correlationId\":\"%s\",\"appliedDelayUs\":%lld",
                    s->mic[cur_map].device_id, role_word(cur_map), intervals, (long long)from_sample, SR, (long long)at_ms, corr, (long long)(delay_us < 0 ? 0 : delay_us));
    else
        send_record("\"kind\":\"AUDIO_SOURCE_INTERVAL\",\"deviceId\":\"%s\",\"role\":\"%s\",\"index\":%d,\"fromSample\":%lld,\"sampleRateHz\":%d,\"capturedAtMs\":%lld,\"reason\":\"SESSION_START\",\"correlationId\":null,\"appliedDelayUs\":null",
                    s->mic[cur_map].device_id, role_word(cur_map), intervals, (long long)from_sample, SR, (long long)at_ms);
}

/* `next_sample`: the first sample of the quantum that is pushed next, or -1 before T0 (no timeline
 * yet: a switch is refused). `t0_real`: the wall clock of sample 0. */
static void filter_apply_commands(Session *s, int64_t next_sample, int64_t t0_real) {
    if (!pthread_equal(pthread_self(), filter_tid)) {
        logj("error", "filter", "send_command_off_filter_thread", "%s", "");
        abort();
    }
    char corr[ID_CHARS + 1];
    pthread_mutex_lock(&sw_mx);
    int pending = sw_pending, want = sw_map;
    int64_t asked = sw_asked_mono;
    memcpy(corr, sw_corr, sizeof corr);
    sw_pending = 0;
    pthread_mutex_unlock(&sw_mx);
    if (!pending) return;
    if (next_sample < 0) {
        ipc_send("\"type\":\"ACK\",\"correlationId\":\"%s\",\"ok\":false,\"code\":\"NOT_RECORDING\"", corr);
        logj("warn", "filter", "switch_refused_before_t0", "\"map\":%d", want);
        return;
    }
    if (want != cur_map) {
        char m[4];
        snprintf(m, sizeof m, "%d", want);
        int r = avfilter_graph_send_command(graph, "astreamselect@asel", "map", m, NULL, 0, 0);
        int64_t delay = mono_us() - asked;
        if (r < 0) {
            ipc_send("\"type\":\"ACK\",\"correlationId\":\"%s\",\"ok\":false,\"code\":\"SELECTOR_COMMAND_FAILED\"", corr);
            fatal("filter", "SELECTOR_COMMAND_FAILED", r);
            return;
        }
        cur_map = want;
        logj("info", "filter", "selector_switched", "\"map\":%d,\"applied_before_sample\":%lld,\"applied_delay_us\":%lld,\"edge\":\"hard_cut\"", want, (long long)next_sample, (long long)delay);
        /* The record first, then the acknowledgement: who waits for the ACK has the interval already. */
#ifdef DEMS_PROOF_INTERVAL_SKEW             /* PROOF BUILD ONLY: the record names another sample than the one the selector switched at */
        interval_record(s, next_sample + DEMS_PROOF_INTERVAL_SKEW, t0_real, corr, delay);
#else
        interval_record(s, next_sample, t0_real, corr, delay);
#endif
    }
    /* A switch to the source that already feeds the encoder changed nothing: acknowledged, no record. */
    ipc_send("\"type\":\"ACK\",\"correlationId\":\"%s\",\"ok\":true", corr);
}

/* What the raiser saw begin or end on one microphone, as warnings by its device ID. */
static void mic_warn(Session *s, int i, int events) {
    static const struct { int began, ended; const char *code, *reason; } w[] = {
        { MW_SILENT_BEGAN, MW_SILENT_ENDED, "MIC_SILENT", "MIC_LEVEL_BELOW_THRESHOLD" },
        { MW_DISCONNECT_BEGAN, MW_DISCONNECT_ENDED, "CAPTURE_FAULT", "MIC_DISCONNECTED" },
        { MW_RATE_LIMIT_BEGAN, MW_RATE_LIMIT_ENDED, "CAPTURE_FAULT", "MIC_RATE_AT_LIMIT" },
    };
    for (unsigned k = 0; events && k < sizeof w / sizeof w[0]; k++) {
        if (!(events & (w[k].began | w[k].ended))) continue;
        int active = (events & w[k].began) != 0;
        logj("warn", "filter", active ? "mic_warning_raised" : "mic_warning_cleared", "\"mic\":%d,\"reason\":\"%s\",\"active_input\":%d,\"received\":%lld,\"asked_ppm\":%.1f",
             i + 1, w[k].reason, cur_map + 1, (long long)mics[i].received, mics[i].ppm);
        send_warning(w[k].code, w[k].reason, active, s->mic[i].device_id);
    }
}

static int filter_build(int initial_map) {
    /* D61 (2026-11-04): the graph stays the legacy two-role lane's (NLANE inputs): it feeds the camera files'
     * audio track and the transcribed plane. Channels 3 and 4 are recorded outside the graph (mic_rec_*). */
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
    for (int i = 0; i < s->ncam; i++) {      /* D60 (2026-11-04): the ONE encoder feeds every camera file of the plan */
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

/* ---------------------------------------------------------------- the channel files (D61, 2026-11-04) */
/* ONE fMP4 AUDIO FILE PER MICROPHONE CHANNEL that names an `outputPath`: the microphone twin of a camera
 * file. Each file gets ITS OWN AAC encoder instance - four channels are four different signals, and one
 * encoder encodes one stream - so a session with four recorded channels runs five encoders in total
 * (the legacy lane's `S->enc` for the camera files' audio track plus four). The writer is the same
 * sink.c machine: created only with its init segment plus one whole fragment, never over an existing
 * file (take_plan refused that path), append-only, synced per fragment.
 *   FRAGMENT RECORDS: none on the wire yet. FRAGMENT_CHECKPOINT names a CAMERA of the plan and the Core
 * validates its subject against the plan's cameras; a mic-keyed checkpoint is a later wave (decision D61
 * task list). The file itself carries both hash chains (sink.c), and the box walk of spec §C.5 re-derives
 * them at RECOVERY: the absence of a record says nothing, as ever. */
#define MIC_AIO_BUFFER 65536                  /* the muxer's AVIO buffer, as ingest.c sizes the camera files' */

static void mic_fragment_durable(void *opaque, const Checkpoint *cp) {
    MicIn *m = opaque;
    logj("info", "micfile", "fragment_durable", "\"mic\":%d,\"index\":%u,\"bytes\":%lld,\"sync\":\"%s\"", (int)(m - mics) + 1, cp->index,
         (long long)(cp->start + cp->len), sink_sync_level(&m->sink));
}

static void mic_sync_failed(void *opaque, const char *code, int averror) { (void)opaque; fatal("micfile", code, averror); }

/* Open channel `m`'s encoder, sink and muxer, and write the init segment. 0 or an AVERROR. */
static int mic_rec_open(MicIn *m, Session *s) {
    const AVCodec *codec = avcodec_find_encoder_by_name("aac");
    if (!codec) return AVERROR_ENCODER_NOT_FOUND;
    m->enc = avcodec_alloc_context3(codec);
    if (!m->enc) return AVERROR(ENOMEM);
    m->enc->sample_fmt = AV_SAMPLE_FMT_FLTP;
    m->enc->sample_rate = SR;
    m->enc->bit_rate = 96000;
    m->enc->time_base = (AVRational){ 1, SR };
    m->enc->flags |= AV_CODEC_FLAG_GLOBAL_HEADER;
    av_channel_layout_default(&m->enc->ch_layout, 1);
    int r = avcodec_open2(m->enc, codec, NULL);
    if (r < 0) return r;
    sink_init(&m->sink, s->mic[m - mics].out_path);
    m->sink.max_fragment_bytes = (size_t)g_max_fragment_bytes;
    m->sink.on_durable = mic_fragment_durable;
    m->sink.on_sync_failure = mic_sync_failed;
    m->sink.opaque = m;
    if ((r = avformat_alloc_output_context2(&m->out, NULL, "mp4", NULL)) < 0) return r;
    uint8_t *buffer = av_malloc(MIC_AIO_BUFFER);
    if (!buffer) return AVERROR(ENOMEM);
    /* Not seekable: the file is append-only by construction (the camera files' rule, inherited). */
    m->pb = avio_alloc_context(buffer, MIC_AIO_BUFFER, 1, &m->sink, NULL, sink_write, NULL);
    if (!m->pb) { av_free(buffer); return AVERROR(ENOMEM); }
    m->out->pb = m->pb;
    m->out->flags |= AVFMT_FLAG_CUSTOM_IO;
    AVStream *st = avformat_new_stream(m->out, NULL);
    if (!st) return AVERROR(ENOMEM);
    if ((r = avcodec_parameters_from_context(st->codecpar, m->enc)) < 0) return r;
    st->time_base = (AVRational){ 1, SR };
    AVDictionary *o = NULL;
    av_dict_set(&o, "movflags", MUX_MOVFLAGS, 0);
    av_dict_set(&o, "flush_packets", "1", 0);                                       /* spec §C.2, W-2 */
    av_dict_set_int(&o, "min_frag_duration", (int64_t)s->min_frag_duration_ms * 1000, 0);
    r = avformat_write_header(m->out, &o);
    int leftover = av_dict_count(o);
    av_dict_free(&o);
    if (r >= 0 && leftover) return AVERROR_OPTION_NOT_FOUND;
    if (r < 0) return r;
    m->cut_mono = mono_us();
    m->conv = av_frame_alloc();
    if (!m->conv) return AVERROR(ENOMEM);
    m->conv->format = AV_SAMPLE_FMT_FLTP;
    m->conv->sample_rate = SR;
    m->conv->nb_samples = AAC_FRAME;
    av_channel_layout_default(&m->conv->ch_layout, 1);
    if ((r = av_frame_get_buffer(m->conv, 0)) < 0) return r;
    m->recording = 1;
    return 0;
}

/* One quantum frame of the channel: packed FLT becomes planar FLTP (mono: one plane), and the AAC encoder
 * takes WHOLE 1024-sample frames (the lane's graph sizes them so with av_buffersink_set_frame_size; FFmpeg 9
 * refuses a short one with EINVAL). The quanta are therefore STAGED and handed on in whole frames; the rest
 * waits for the next quantum - no sample is dropped and the timeline is the encoder's own. */
static void mic_rec_send(MicIn *m, int n) {                                      /* n == AAC_FRAME, or padded at the flush */
    m->conv->nb_samples = n;
    m->conv->pts = m->rec_pts;
    memcpy(m->conv->extended_data[0], m->stage, (size_t)n * sizeof(float));
    m->rec_pts += n;
    int r = avcodec_send_frame(m->enc, m->conv);
    if (r < 0 && r != AVERROR_EOF) { fatal("micfile", "ENCODER_SEND_FAILED", r); return; }
    AVPacket *pkt = av_packet_alloc();
    if (!pkt) { fatal("micfile", "FRAME_ALLOC_FAILED", AVERROR(ENOMEM)); return; }
    while ((r = avcodec_receive_packet(m->enc, pkt)) >= 0) {
        pkt->stream_index = 0;
        av_packet_rescale_ts(pkt, m->enc->time_base, m->out->streams[0]->time_base);
        if ((r = av_write_frame(m->out, pkt)) < 0) { fatal("micfile", "AUDIO_MUX_WRITE_FAILED", r); break; }
        m->rec_pkts++;
        av_packet_unref(pkt);
    }
    av_packet_free(&pkt);
}

static void mic_rec_write(MicIn *m, AVFrame *f) {
    /* Fill to a whole frame, send, continue with the rest: 480 does not divide 1024, so a frame spans three quanta. */
    const float *x = (const float *)f->extended_data[0];
    int n = f->nb_samples;
    while (n > 0) {
        int take = AAC_FRAME - m->staged;
        if (take > n) take = n;
        memcpy(m->stage + m->staged, x, (size_t)take * sizeof(float));
        m->staged += take;
        x += take;
        n -= take;
        if (m->staged == AAC_FRAME) { mic_rec_send(m, AAC_FRAME); m->staged = 0; }
    }
}

/* Flush the encoder, end the file, wait for the last sync. Returns 0 or an AVERROR. */
static int mic_rec_close(MicIn *m) {
    if (!m->recording) return 0;
    m->recording = 0;
    if (m->staged) {                                                            /* the closing rest: zero-padded to one frame (at most 21 ms of tail silence, SAID by the padding rule) */
        memset(m->stage + m->staged, 0, (size_t)(AAC_FRAME - m->staged) * sizeof(float));
        mic_rec_send(m, AAC_FRAME);
        m->staged = 0;
    }
    int r = avcodec_send_frame(m->enc, NULL);
    if (r < 0 && r != AVERROR_EOF) return r;
    AVPacket *pkt = av_packet_alloc();
    while (pkt && avcodec_receive_packet(m->enc, pkt) >= 0) {
        pkt->stream_index = 0;
        av_packet_rescale_ts(pkt, m->enc->time_base, m->out->streams[0]->time_base);
        if ((r = av_write_frame(m->out, pkt)) < 0) { av_packet_free(&pkt); return r; }
        m->rec_pkts++;
        av_packet_unref(pkt);
    }
    av_packet_free(&pkt);
    av_frame_free(&m->conv);
    int t = av_write_trailer(m->out);                              /* flushes the open fragment (skip_trailer: the fragments are the file) */
    if (t >= 0) avio_flush(m->pb);
    r = sink_close(&m->sink);                                      /* waits for the last sync; its log line left before */
    if (m->pb) { av_freep(&m->pb->buffer); avio_context_free(&m->pb); }   /* the camera files' close order: trailer, flush, sink, then the muxer */
    avformat_free_context(m->out); m->out = NULL;
    avcodec_free_context(&m->enc);
    return r < 0 ? r : t;
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
    m->plan = plan;
    if (!plan->present) return 0;
    if (!(m->fifo = malloc(sizeof(float) * FIFO_CAP))) return AVERROR(ENOMEM);
    /* 7.2a place 1: a gapped microphone gets NO resampler (the member stays null; mic_close allows that). */
    if (!plan->gapped) {
        AVChannelLayout mono;
        av_channel_layout_default(&mono, 1);
        int r = swr_alloc_set_opts2(&m->swr, &mono, AV_SAMPLE_FMT_FLT, SR, &mono, AV_SAMPLE_FMT_FLT, SR, 0, NULL);
        if (r < 0) return r;
        if ((r = swr_init(m->swr)) < 0) return r;
        /* The resampler runs from the first sample (a compensation of nothing turns it on), so that
         * its delay is the same for the whole session and no step appears when it is first needed. */
        if ((r = swr_set_compensation(m->swr, 0, 0)) < 0) return r;
    }
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

/* Returns how many samples it removed (version 5: what the account counts as discarded, never the number asked for). */
static int fifo_drop_oldest(MicIn *m, int n) {
    if (n <= 0) return 0;
    if (n > m->have) n = m->have;
    memmove(m->fifo, m->fifo + n, sizeof(float) * (size_t)(m->have - n));
    m->have -= n;
    return n;
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
        /* 7.2a place 2: a sample that is not a finite number becomes zero, and is COUNTED; `nonzero` is decided on
         * the sample AS READ, before the replacement. */
        for (size_t i = 0; i < samples; i++) {
            if (in[i] != 0.f && isfinite(in[i])) m->nonzero = 1;
            if (!isfinite(in[i])) { in[i] = 0.f; m->nonfinite++; }
        }
        /* Room for what this chunk can become (the resampler may give a few samples more; place 3: a gapped
         * microphone has no resampler, its room is the chunk exactly). */
        int room = (int)samples + (m->plan->gapped ? 0 : 64);
        if (m->have + room > FIFO_CAP) { int over = m->have + room - FIFO_CAP; m->discarded += fifo_drop_oldest(m, over); m->dropped += over; }
        int made;
        if (m->plan->gapped) {
            /* 7.2a place 4: COPIED, value for value and in order - what enters the buffer is exactly what was read. */
            memcpy(m->fifo + m->have, in, samples * sizeof(float));
            made = (int)samples;
        } else {
            const uint8_t *src_data[1] = { (const uint8_t *)in };
            uint8_t *dst_data[1] = { (uint8_t *)(m->fifo + m->have) };
            made = swr_convert(m->swr, dst_data, room, src_data, (int)samples);
            if (made < 0) { fatal("filter", "MIC_RESAMPLE_FAILED", made); return; }
        }
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
/* Returns the MW_ bits of the rate controller's limit (micwatch.h); the quantum's own level is left in `taken`. */
static int mic_take(MicIn *m, float *dst, int64_t now_mono, int realtime) {
    int present = 0, head = 0;
    double sumsq = 0;
    if (m->running && !m->have && now_mono - m->last_data_mono > MIC_GAP_US) {
        /* The mic stopped. What it sends when it returns is placed anew. */
        m->running = 0;
        logj("warn", "filter", "mic_stopped", "\"mic\":%d,\"received\":%lld", (int)(m - mics) + 1, (long long)m->received);
    }
    if (!m->running && m->has_data && m->fd >= 0 && m->have >= TARGET_FILL + QUANTUM && now_mono - m->last_data_mono < MIC_GAP_US) {
        /* It delivers (again): start from the newest samples, one buffer level behind the present. */
        int over = m->have - (TARGET_FILL + QUANTUM);
        m->discarded += fifo_drop_oldest(m, over);          /* 7.2a place 6: the re-placement, counted */
        mic_start(m, 0);
        m->restarts++;
        logj("info", "filter", "mic_started", "\"mic\":%d,\"restarts\":%lld", (int)(m - mics) + 1, (long long)m->restarts);
    }
    for (int i = 0; i < QUANTUM; i++) {
        float v = 0.f;
        if (m->running) {
            if (m->lead_silence > 0) { m->lead_silence--; head++; }
            else if (present < m->have) v = m->fifo[present++];
        }
        dst[i] = v;
        sumsq += (double)v * v;
        if (fabsf(v) > m->peak) m->peak = fabsf(v);
    }
    fifo_drop_oldest(m, present);
    m->sumsq += sumsq;
    m->n_meter += present;
    m->missing += QUANTUM - present;
    m->taken = present;
    m->taken_sumsq = sumsq;
    /* Version 5, the shape of this quantum for the run tracker: `head` zeros, `present` samples, the rest zeros. A
     * quantum without a sample is zeros only, wherever its owed lead ended. */
    m->head = present ? head : QUANTUM;
    /* 7.2a place 8: a gapped microphone RETURNS here - no level is followed, no compensation is asked, no rate limit
     * is judged (it has no resampler: check.sh holds that nothing below can be reached for it). */
    if (m->plan->gapped) return 0;
    if (!m->running || !realtime || m->lead_silence > 0) return 0;
    /* The level right after a quantum was taken, smoothed over about half a second. */
    /* The mic delivers in chunks: between two of them its samples go on being captured. The
     * level is therefore read as "what is buffered plus what the mic has captured since its last
     * chunk", which does not jump when a chunk lands (a chunk period that beats against the 10 ms
     * quantum would otherwise look like a clock that swings). */
    double since = (double)(now_mono - m->last_data_mono) * SR / US, level = m->have + (since < 2 * QUANTUM ? since : 2 * QUANTUM);
    m->run_samples += QUANTUM;
    m->level = m->run_samples == QUANTUM ? level : m->level + (level - m->level) / (m->run_samples <= MIC_CALIBRATE_SAMPLES ? 10.0 : 50.0);
    if (m->run_samples <= MIC_CALIBRATE_SAMPLES) { m->target = m->level; return 0; }
    if (m->run_samples % (QUANTUM * 10)) return 0;
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
    /* D85 R-3: a controller that stays at its limit means the clock difference is beyond what it absorbs. */
    return micwatch_rate(&m->watch, m->ppm, (double)MIC_MAX_PPM);
}

/* ---------------------------------------------------------------- telemetry */
static void telemetry(Session *s, int64_t timeline) {
    static const char *const state[] = { "WAITING", "CONNECTED", "ENDED" };
    /* 768 held two mic entries of the longest device ID (128) with every count at one day (10 digits): 625 characters.
     * D61 (2026-11-04): the microphone list carries FOUR entries - the levels buffer grows to hold four of those
     * (1250 characters); the per-camera lists stay as D60 sized them. A list that still does not fit is sent empty
     * (F-13), never cut. The `role` member of an entry is the legacy two-role lane's word (`role_word`). */
    char levels[1536] = "", ingest[768] = "", frags[768] = "", clocks[768] = "";
    size_t l = 0, g = 0, f = 0, k = 0;
    for (int i = 0; i < NMIC; i++) {
        MicIn *m = &mics[i];
        if (!s->mic[i].present) continue;
        /* The microphone by its device ID (protocol version 4), and what its rate controller asks now (place 9: none
         * runs for a gapped microphone - always null). */
        char rate[32] = "null";
        if (m->running && !s->mic[i].gapped) snprintf(rate, sizeof rate, "%.1f", m->ppm > MIC_MAX_PPM ? (double)MIC_MAX_PPM : m->ppm < -MIC_MAX_PPM ? (double)-MIC_MAX_PPM : m->ppm);
        /* Version 5, for every microphone of every kind: its account so far, cumulative from sample 0 (`missing` IS the inserted count). */
        char account[160];
        snprintf(account, sizeof account, ",\"timelineSamples\":%lld,\"receivedSamples\":%lld,\"insertedSamples\":%lld,\"nonZero\":%s", (long long)timeline, (long long)m->received, (long long)m->missing,
                 m->nonzero ? "true" : "false");
        if (l >= sizeof levels) continue;
        if (m->n_meter > 0) {
            double db = m->sumsq > 0 ? 10.0 * log10(m->sumsq / m->n_meter) : -120.0;
            if (db > 0) db = 0;
            if (db < -120.0) db = -120.0;
            l += (size_t)snprintf(levels + l, sizeof levels - l, "%s{\"deviceId\":\"%s\",\"role\":\"%s\",\"dbfs\":%.2f,\"clipped\":%s,\"ratePpm\":%s%s}", l ? "," : "", s->mic[i].device_id, role_word(i), db, m->peak >= 0.999f ? "true" : "false", rate, account);
        } else {
            l += (size_t)snprintf(levels + l, sizeof levels - l, "%s{\"deviceId\":\"%s\",\"role\":\"%s\",\"dbfs\":null,\"clipped\":false,\"ratePpm\":%s%s}", l ? "," : "", s->mic[i].device_id, role_word(i), rate, account);
        }
        m->sumsq = 0;
        m->peak = 0;
        m->n_meter = 0;
    }
    for (int i = 0; i < s->ncam; i++) {     /* D60 (2026-11-04): one entry per camera of the plan */
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

/* ---------------------------------------------------------------- the sample account (protocol version 5) */
/* THE RUNS (design 06 section 8.2, "what a run is"). A run is a maximal row of consecutive TRACK samples that are
 * zeros inserted for a gapped microphone that fed the encoder. It may cross a quantum's edge and a switch from one
 * gapped microphone to the other; it belongs to the microphone that fed at its first sample. A sample fed by a
 * PCM_FIFO microphone ends a run, and so does a received sample (a non-finite one too: it is no inserted zero).
 * These functions are handed what audio_main knows; none of them reads the input kind. */
static void run_end(Session *s) {
    if (run_from < 0) return;
    MicIn *m = &mics[run_owner];
    if (run_len > m->fed_longest) m->fed_longest = run_len;
    if (run_len >= CAPTURE_AUDIO_INSERTED_RUN_MIN_SAMPLES) {
        if (runs_listed < CAPTURE_AUDIO_INSERTED_RUNS_MAX) {
            /* The FIRST runs in timeline order are the listed ones; the list is never cut silently (SM-30 (2)). */
            runs_listed++;
            m->listed++;
            send_record("\"kind\":\"AUDIO_INSERTED_RUN\",\"deviceId\":\"%s\",\"role\":\"%s\",\"index\":%d,\"fromSample\":%lld,\"samples\":%lld,\"sampleRateHz\":%d",
                        s->mic[run_owner].device_id, role_word(run_owner), runs_listed, (long long)run_from, (long long)run_len, SR);
        } else {
            m->not_listed++;
            m->not_listed_samples += run_len;
        }
    }
    run_from = -1;
    run_len = 0;
}

static void run_insert(int owner, int64_t at, int64_t count) {
    if (count <= 0) return;
    if (run_from < 0) {
        run_from = at;
        run_len = 0;
        run_owner = owner;
        mics[owner].fed_runs++;
    }
    run_len += count;
}

/* Quantum `n` of the track, fed by microphone `f`, which is gapped: `head` zeros, `taken` samples, the rest zeros. */
static void run_feed(Session *s, int f, int64_t n) {
    MicIn *m = &mics[f];
    m->fed += QUANTUM;
    m->fed_inserted += QUANTUM - m->taken;
    run_insert(f, n, m->head);
    if (!m->taken) return;
    run_end(s);
    run_insert(f, n + m->head + m->taken, QUANTUM - m->head - m->taken);
}

/* One MIC_SAMPLE_ACCOUNT of microphone `i` at timeline sample `timeline`. The identity is checked FIRST: an account that
 * does not add up is not written (the Core then states "not measured"); the error goes to the worker's log. */
static void account(Session *s, int i, int64_t timeline, int closing) {
    MicIn *m = &mics[i];
    int owns_run = run_from >= 0 && run_owner == i;
    int64_t longest = owns_run && run_len > m->fed_longest ? run_len : m->fed_longest;
    char open_from[24] = "null";
    if (owns_run && run_len >= CAPTURE_AUDIO_INSERTED_RUN_MIN_SAMPLES) snprintf(open_from, sizeof open_from, "%lld", (long long)run_from);
    if (timeline != m->received - m->discarded - m->have + m->missing || (closing && (m->have || owns_run))) {
        logj("error", "filter", "mic_account_does_not_add_up", "\"mic\":%d,\"closing\":%d,\"timeline\":%lld,\"received\":%lld,\"discarded\":%lld,\"buffered\":%d,\"inserted\":%lld",
             i + 1, closing, (long long)timeline, (long long)m->received, (long long)m->discarded, m->have, (long long)m->missing);
        return;
    }
    send_record("\"kind\":\"MIC_SAMPLE_ACCOUNT\",\"deviceId\":\"%s\",\"role\":\"%s\",\"closing\":%s,\"sampleRateHz\":%d,\"timelineSamples\":%lld,\"receivedSamples\":%lld,"
                "\"insertedSamples\":%lld,\"discardedSamples\":%lld,\"bufferedSamples\":%d,\"nonFiniteSamples\":%lld,\"fedSamples\":%lld,\"fedInsertedSamples\":%lld,"
                "\"fedRuns\":%lld,\"fedLongestRunSamples\":%lld,\"listedRuns\":%lld,\"runsNotListed\":%lld,\"runsNotListedSamples\":%lld,\"openRunFromSample\":%s",
                s->mic[i].device_id, role_word(i), closing ? "true" : "false", SR, (long long)timeline, (long long)m->received, (long long)m->missing, (long long)m->discarded, m->have,
                (long long)m->nonfinite, (long long)m->fed, (long long)m->fed_inserted, (long long)m->fed_runs, (long long)longest, (long long)m->listed, (long long)m->not_listed,
                (long long)m->not_listed_samples, open_from);
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
    /* D61 (2026-11-04): every channel whose plan row names an outputPath gets its own file: one encoder
     * instance per file (the honest count - four channels are four streams), opened before T0 so the file
     * holds audio from sample 0 like a camera file does. A channel without one records nothing of its own. */
    int n_enc = 1;                                            /* the legacy lane's S->enc (camera files' audio track) */
    for (int i = 0; i < NMIC; i++) {
        if (!s->mic[i].present || !s->mic[i].out_path[0]) continue;
        if ((r = mic_rec_open(&mics[i], s)) < 0) { fatal("filter", "MIC_OUTPUT_OPEN_FAILED", r); return NULL; }
        n_enc++;
    }
    tap_open(s);
    AVFrame *o = av_frame_alloc();
    AVPacket *pkt = av_packet_alloc();
    if (!o || !pkt) { fatal("filter", "FRAME_ALLOC_FAILED", AVERROR(ENOMEM)); return NULL; }

    /* T0: wait for the first samples, then for the estimation window. */
    int64_t began = mono_us(), first_data = 0;
    while (!atomic_load(&g_stop)) {
        for (int i = 0; i < NMIC; i++) mic_read(&mics[i]);
        filter_apply_commands(s, -1, 0);                    /* no timeline yet: a switch is refused */
        int64_t now = mono_us();
        /* D61 (2026-11-04): any of the FOUR channels says "a device is delivering" (was the role pair). */
        if (!first_data) for (int i = 0; i < NMIC; i++) if (mics[i].has_data) { first_data = now; break; }
        if (first_data && now - first_data >= PREBUFFER_US) break;
        if (!first_data && now - began >= MIC_WAIT_US) break;
        nap(2000);
    }
    /* The master defines sample 0: the lane's source if it delivers, else the first channel that does
     * (D61: was the fixed pair `cur_map` / `!cur_map`). */
    int master = mics[cur_map].has_data ? cur_map : -1;
    if (master < 0) for (int i = 0; i < NMIC; i++) if (mics[i].has_data) { master = i; break; }
    int64_t t0_real, t0_mono;
    if (master >= 0) { t0_real = mics[master].best_real; t0_mono = mics[master].best_mono; }
    else { t0_real = real_us(); t0_mono = mono_us(); logj("warn", "filter", "no_mic_delivers_samples", "\"waited_ms\":%d", (int)(MIC_WAIT_US / 1000)); }
    for (int i = 0; i < NMIC; i++) {
        MicIn *m = &mics[i];
        if (!m->has_data) continue;
        /* Sample 0 of the master is output sample 0. Another mic that began a little later owes that much silence first. */
        int64_t off = i == master ? 0 : llround((double)(m->best_real - t0_real) * SR / US);
        if (off < 0) { m->discarded += fifo_drop_oldest(m, (int)(-off > m->have ? m->have : -off)); off = 0; }    /* 7.2a place 11: the trim, counted */
        mic_start(m, off);
    }
    for (int i = 0; i < NMIC; i++) micwatch_init(&mics[i].watch, (double)g_mic_silence_dbfs, g_mic_silence_ms, g_mic_disconnect_ms, SR);
    atomic_store(&s->t0_real_us, t0_real);
    /* The interval of the start: which microphone feeds the one audio track from sample 0. Written before T0 is
     * published, so it precedes every record of a camera (no video is placed before `armed`). */
    if (!atomic_load(&g_stop)) interval_record(s, 0, t0_real, NULL, 0);
    atomic_store(&s->armed, 1);
    if (manifest) fprintf(manifest, "{\"type\":\"t0\",\"t0_real_us\":%lld,\"master_mic\":%d}\n", (long long)t0_real, master);
    logj("info", "filter", "audio_started", "\"t0_real_us\":%lld,\"encoders\":%d,\"quantum_samples\":%d,\"master_mic\":%d,\"movflags\":\"%s\"",
         (long long)t0_real, n_enc, QUANTUM, master, MUX_MOVFLAGS);      /* D61 (2026-11-04): the honest encoder count: the lane's one plus one per channel file */

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
        /* The operator's switch, at this quantum's boundary. Sample 0 belongs to the interval of the start: a
         * command that is already waiting then is applied one quantum later. */
        if (n > 0) filter_apply_commands(s, n, t0_real);
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
            int events = mic_take(&mics[i], (float *)(void *)f->data[0], now, waited);
            /* D61 (2026-11-04): the channel's own file takes EVERY quantum of its channel from sample 0 -
             * silence included - exactly as the lane's inputs do (a gap would be a lost timeline). */
            if (mics[i].recording) mic_rec_write(&mics[i], f);
            /* The selector graph spans the legacy two-role lane only (channels 1 and 2; D61): a third or
             * fourth channel is read, metered, warned for and recorded - it joins no graph. */
            if (i < NLANE) {
                r = av_buffersrc_add_frame_flags(src[i], f, AV_BUFFERSRC_FLAG_KEEP_REF);
                if (r < 0) { av_frame_free(&f); fatal("filter", "BUFFERSRC_ADD_FAILED", r); break; }
            }
            av_frame_free(&f);
            /* The warning raiser, on the timeline's own clock: what this microphone delivered into this quantum.
             * It says; it never switches (OD-11). */
            if (s->mic[i].present) mic_warn(s, i, events | micwatch_chunk(&mics[i].watch, QUANTUM, mics[i].taken, mics[i].taken_sumsq));
        }
        /* Version 5: the runs of inserted samples on the TRACK - this quantum is what `cur_map` fed. A PCM_FIFO
         * microphone feeding ends a run and starts none. */
        if (s->mic[cur_map].gapped) run_feed(s, cur_map, n);
        else run_end(s);
        n += QUANTUM;
        filter_drain(s, o, pkt, 0);
        /* Version 5: a periodic account of every gapped microphone, so that a worker that is killed leaves a statement. */
        if (n % CAPTURE_MIC_ACCOUNT_PERIOD_SAMPLES == 0)
            for (int i = 0; i < NMIC; i++)
                if (s->mic[i].present && s->mic[i].gapped) account(s, i, n, 0);
        if (n - meter_at >= meter_period) { meter_at = n; telemetry(s, n); }
        if (n % (QUANTUM * 10) == 0) {
            for (int i = 0; i < s->ncam; i++)      /* D60 (2026-11-04): the plan's cameras */
                if (s->cam[i].present && (r = cam_cut_if_stalled(&s->cam[i], now, stall_us)) < 0) fatal("filter", "STALL_CUT_FAILED", r);
            /* D61 (2026-11-04): the channel files are audio-only, and the muxer cuts no audio-only fragment of its
             * own (the camera files get theirs from video keyframes or from the W-3 stall cut). The rule here is
             * the plan's: one fragment per `minFragDurationMs`, made the same way the stall cut makes one -
             * `av_write_frame(out, NULL)` - so durability and checkpoints arrive at that cadence too. */
            for (int i = 0; i < NMIC; i++) {
                MicIn *m = &mics[i];
                if (!m->recording || now - m->cut_mono < (int64_t)s->min_frag_duration_ms * 1000) continue;
                if ((r = av_write_frame(m->out, NULL)) < 0) fatal("micfile", "FRAGMENT_CUT_FAILED", r);
                m->cut_mono = now;
            }
        }
    }
    /* Flush: graph EOF -> the last (short) frame -> encoder EOF. Also after a fatal error, as far as it goes.
     * D61 (2026-11-04): the graph spans the lane's two inputs; every channel file is flushed and closed here too
     * (as far as it goes: a file whose write failed keeps what is durable, sink.c truncation rules unchanged). */
    for (int i = 0; i < NLANE; i++)
        if ((r = av_buffersrc_add_frame_flags(src[i], NULL, 0)) < 0 && !fatal_pending()) fatal("filter", "GRAPH_EOF_FAILED", r);
    if (!fatal_pending()) {
        filter_drain(s, o, pkt, 1);
        encode(s, NULL, pkt);
    }
    for (int i = 0; i < NMIC; i++)
        if (mics[i].recording || mics[i].out) {
            int cr = mic_rec_close(&mics[i]);
            if (cr < 0) logj("error", "micfile", "channel_file_close_failed", "\"mic\":%d,\"av_code\":%d", i + 1, cr);
        }
    if (manifest) {
        fprintf(manifest, "{\"type\":\"end\",\"samples_in\":%lld,\"t0_real_us\":%lld,\"encoders\":%d,\"apkts0\":%lld,\"missing0\":%lld,\"missing1\":%lld}\n",
                (long long)n, (long long)t0_real, n_enc, (long long)a_pkts, (long long)mics[0].missing, (long long)mics[1].missing);   /* D61: the honest count - the lane's encoder plus one per channel file */
        fclose(manifest);
        manifest = NULL;
    }
    for (int i = 0; i < NMIC; i++) {
        if (!s->mic[i].present) continue;
        logj("info", "filter", "mic_summary", "\"mic\":%d,\"received\":%lld,\"missing\":%lld,\"dropped\":%lld,\"restarts\":%lld,\"last_ppm\":%.1f",
             i + 1, (long long)mics[i].received, (long long)mics[i].missing, (long long)mics[i].dropped, (long long)mics[i].restarts, mics[i].ppm);
    }
    logj("info", "filter", "audio_finished", "\"samples_in\":%lld,\"encoder_packets\":%lld,\"tap_samples\":%lld,\"intervals\":%d", (long long)n, (long long)a_pkts, (long long)tap_samples, intervals);
    /* Version 5, 7.2a place 12: the timeline ends - a run still open ends with it; what a gapped microphone's buffer
     * still holds was received and never put on the timeline (discarded); then its CLOSING account, before the end. */
    if (intervals) {
        run_end(s);
        for (int i = 0; i < NMIC; i++) {
            if (!s->mic[i].present || !s->mic[i].gapped) continue;
            mics[i].discarded += fifo_drop_oldest(&mics[i], mics[i].have);
            account(s, i, n, 1);
        }
    }
    /* The end of the audio timeline closes the last interval (lossless; absent only when the worker was killed). */
    if (intervals) send_record("\"kind\":\"AUDIO_TIMELINE_END\",\"samples\":%lld,\"sampleRateHz\":%d,\"intervals\":%d", (long long)n, SR, intervals);
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
