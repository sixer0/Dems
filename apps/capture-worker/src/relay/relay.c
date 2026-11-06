/*
 * The capture relay: the program (relay.h has the whole picture; task 4 blueprint row 41, WP-03a).
 *
 *   standard input   ONE line, the start message, then nothing: its end is the order to stop
 *   standard output  at most ONE line, the report of the mode (row 42; relay.h "THE TWO MODES"): in record mode
 *                    "push established" once the worker answered the record request, in probe mode the stream's
 *                    own statement. Made in relay_core.c from numbers and validated bytes; written by `report`.
 *                    In PREVIEW MODE (row 89; relay.h "PREVIEW MODE") the video only, written by `media`; both
 *                    through the one writer `out_bytes`
 *   standard error   lines of fixed words and numbers (say); never a text of the library, of the camera, of
 *                    the start message, an address, a path or an account
 *   arguments        none: an argument is refused (nothing of a session may stand in a process listing)
 *   environment      not read
 *
 * THE PUSH LEG is the library's RTSP writer over TCP, as the worker's verified pushers use it: the address it
 * announces is the `ingest` member of the start message, handed on unchanged and announced by ONE call of
 * avformat_write_header - there is no second attempt, because the worker's gate takes exactly one announce
 * (../announce.h) and its listener takes one connection.
 *
 * TIME. The first forwarded picture is pts 0, and the wall clock of pts 0 (what the worker anchors on, through
 * the writer's sender reports) is THIS host's clock at that moment. Later pictures keep the distance the camera
 * gave them (its 90 kHz stamps). The camera's own wall clock is never used: a camera with a wrong clock records.
 *
 * THE KEYFRAME GATE (design addendum 5.1; review finding F10 a). Nothing is forwarded until the relay holds the
 * parameter sets and a picture that is a keyframe; after a gap in the camera's packet sequence nothing is
 * forwarded until the next keyframe. What is held back is counted.
 *
 * THE RE-OPEN (row 43; relay.h has the rule). Once the push stands, the end of the camera leg does not end the
 * relay: `camera_again` gives the dead connection up, says the loss in ONE line of standard output, and opens the
 * camera again by the retry rule while the push to the worker stays as it is - it is never announced a second
 * time. The gate is closed for the whole of it and opens at the first keyframe of the new leg whose parameter
 * sets are the ones that were announced; that moment is the second line. The first picture after it is placed by
 * this host's clock.
 */
#include "relay.h"

#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavformat/version.h>
#include <libavutil/log.h>

#include <arpa/inet.h>
#include <errno.h>
#include <fcntl.h>
#include <netinet/in.h>
#include <poll.h>
#include <signal.h>
#include <stdarg.h>
#include <stdio.h>
#include <string.h>
#include <sys/mman.h>
#include <sys/resource.h>
#include <sys/socket.h>
#include <time.h>
#include <unistd.h>
#ifdef __linux__
#include <sys/prctl.h>
#endif

/* THE libavformat THE RELAY IS BUILT FOR: the worker's (../ingest.c, test/static/libavformat.pin; finding F10 d).
 * Another set of headers stops the build here; another library at run time stops the start (main). */
_Static_assert(LIBAVFORMAT_VERSION_INT == AV_VERSION_INT(63, 1, 102), "libavformat is not the version the capture worker was verified against (63.1.102, FFmpeg 9.0.2): see test/static/libavformat.pin");

static RelayStart g_start;
static char g_line[RELAY_LINE_MAX + 1];
static volatile sig_atomic_t g_signal;
static int g_stop, g_closing;
static int64_t g_close_deadline_us;
static long g_library_errors, g_pictures, g_held_back;

static int64_t mono_us(void) {
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return (int64_t)t.tv_sec * 1000000LL + t.tv_nsec / 1000;
}
static int64_t real_us(void) {
    struct timespec t;
    clock_gettime(CLOCK_REALTIME, &t);
    return (int64_t)t.tv_sec * 1000000LL + t.tv_nsec / 1000;
}

/* S13-02 (a): the library's messages are counted, never written. They can hold an address. */
static void library_says(void *context, int level, const char *format, va_list arguments) {
    (void)context; (void)format; (void)arguments;
    if (level <= AV_LOG_ERROR) g_library_errors++;
}

/* THE ONE WRITER of the relay's lines. `event` and the code's name are words of this program. */
static void say(const char *event, const char *word, RelayCode code, const RelayPicture *picture, const RelayCounters *camera) {
    char line[512];
    int n = snprintf(line, sizeof line, "{\"relay\":\"%s\",\"code\":\"%s\",\"rc\":%d,\"pictures\":%ld,\"held_back\":%ld,\"gaps\":%ld,\"other_payloads\":%ld,\"forms_not_taken\":%ld,\"answers_with_digest\":%ld,\"challenges\":%ld,\"keepalives\":%ld,\"library_errors\":%ld}\n",
                     event, word, (int)code, g_pictures, g_held_back, picture ? picture->gaps : 0L, picture ? picture->foreign : 0L, picture ? picture->unsupported + picture->refused : 0L,
                     camera ? camera->auth_answers : 0L, camera ? camera->challenges : 0L, camera ? camera->keepalives : 0L, g_library_errors);
    if (n > 0 && (size_t)n < sizeof line) { ssize_t w = write(STDERR_FILENO, line, (size_t)n); (void)w; }
}

/* THE ONE WRITER of standard output (row 42; AD-06 (3); row 89): `n` bytes, whole or not at all as far as this
 * program can tell. The write is bounded (RELAY_IO_BOUND_US): a reader that does not take them cannot hold the relay.
 * Its two callers are `report` (one line of relay_core.c) and `media` (the video of preview mode). `gone` is the code
 * when the reader is gone (EPIPE): for a report line the same as any failed write, for the video the order to stop. */
static RelayCode out_bytes(const void *bytes, size_t n, RelayCode gone) {
    int64_t deadline = mono_us() + RELAY_IO_BOUND_US;
    int flags = fcntl(STDOUT_FILENO, F_GETFL);
    if (flags < 0 || fcntl(STDOUT_FILENO, F_SETFL, flags | O_NONBLOCK) < 0) return RELAY_REPORT_NOT_WRITTEN;
    for (size_t at = 0; at < n;) {
        ssize_t w = write(STDOUT_FILENO, (const uint8_t *)bytes + at, n - at);
        if (w > 0) { at += (size_t)w; continue; }
        if (w < 0 && (errno == EPIPE || errno == ECONNRESET)) return gone;
        if (w < 0 && errno != EAGAIN && errno != EINTR) return RELAY_REPORT_NOT_WRITTEN;
        if (mono_us() > deadline) return RELAY_REPORT_NOT_WRITTEN;
        struct pollfd p = { STDOUT_FILENO, POLLOUT, 0 };
        poll(&p, 1, 20);
    }
    return RELAY_STOPPED;
}

/* ONE report line (row 42). `line` and `n` come straight from relay_established_line, relay_probe_line,
 * relay_loss_line or relay_reopened_line (relay_core.c): numbers and validated parameter-set bytes, never a text
 * that was read from outside. */
static RelayCode report(const char *line, int n) {
    if (n <= 0 || n > RELAY_REPORT_MAX) return RELAY_INTERNAL;
    return out_bytes(line, (size_t)n, RELAY_REPORT_NOT_WRITTEN);
}

/* PREVIEW MODE (row 89; relay.h "PREVIEW MODE"): bytes of the video, through the one writer. Its reader gone (the
 * decoder ended) is the order to stop: the relay ends with STOPPED. */
static RelayCode media(const uint8_t *bytes, size_t n) { return out_bytes(bytes, n, RELAY_STOP_ASKED); }

static void on_signal(int number) { (void)number; g_signal = 1; }

/* Has the Core ordered the stop? Standard input ended (the Core closed it, or the Core is gone), or a signal. */
static int stop_asked(void *unused) {
    (void)unused;
    if (g_stop) return 1;
    if (g_signal) { g_stop = 1; return 1; }
    struct pollfd p = { STDIN_FILENO, POLLIN, 0 };
    if (poll(&p, 1, 0) > 0) {
        if (p.revents & POLLIN) {
            char more[256];
            ssize_t got = read(STDIN_FILENO, more, sizeof more);       /* nothing is expected after the start message */
            relay_wipe(more, sizeof more);
            if (got == 0 || (got < 0 && errno != EINTR && errno != EAGAIN)) g_stop = 1;
        } else if (p.revents & (POLLHUP | POLLERR | POLLNVAL)) g_stop = 1;
    }
    return g_stop;
}

/* Ends a blocking call of the library. While the push is being ANNOUNCED: on the order to stop. While a picture is
 * written or the push is closed (g_closing: "bounded"): only at a bound. A picture is never cut in the middle by
 * the order to stop - the library's writer does not report such a cut, the picture would be counted as forwarded
 * and never arrive (seen in the first run of this row); the order is seen between two pictures instead
 * (relay_camera_read asks on the turns of its loop, at least every RELAY_STOP_SLICE_US, also while the camera
 * floods it: row 186). */
static int interrupt(void *unused) {
    if (g_closing) return mono_us() > g_close_deadline_us;
    return stop_asked(unused);
}

/* S13-02 (c), RC-6: no core file; on Linux not dumpable and no new privileges; nothing inherited stays open. */
static int hygiene(void) {
    struct rlimit none = { 0, 0 }, now;
    if (setrlimit(RLIMIT_CORE, &none) || getrlimit(RLIMIT_CORE, &now) || now.rlim_cur != 0 || now.rlim_max != 0) return -1;
    /* RC-6 (row 153), the portable part of the confinement: this process cannot make a regular file grow, whatever
     * a descriptor of it is (its three streams are the door's pipes; SIGXFSZ is ignored, such a write just fails). */
    if (setrlimit(RLIMIT_FSIZE, &none)) return -1;
#ifdef __linux__
    if (prctl(PR_SET_DUMPABLE, 0, 0, 0, 0) || prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0)) return -1;
#endif
    int max = getdtablesize();
    for (int fd = 3; fd < max; fd++) close(fd);
    /* Best effort: the pages that hold the start message and the account are kept out of the swap. */
    mlock(&g_start, sizeof g_start);
    mlock(g_line, sizeof g_line);
    return 0;
}

/* The start message: one line, complete inside the bound, nothing after it. */
static RelayCode read_start(void) {
    size_t have = 0;
    int64_t deadline = mono_us() + RELAY_START_BOUND_US;
    RelayCode code = RELAY_START_MESSAGE_INVALID;
    for (;;) {
        char *end = memchr(g_line, '\n', have);
        if (end) {
            if ((size_t)(end - g_line) + 1 == have) code = relay_start_parse(g_line, have, &g_start);
            break;
        }
        if (have >= RELAY_LINE_MAX) break;
        struct pollfd p = { STDIN_FILENO, POLLIN, 0 };
        int r = poll(&p, 1, 100);
        if (g_signal) { g_stop = 1; break; }
        if (r == 0 || (r < 0 && errno == EINTR)) { if (mono_us() > deadline) { code = RELAY_START_MESSAGE_TIMEOUT; break; } continue; }
        if (r < 0) break;
        ssize_t got = read(STDIN_FILENO, g_line + have, RELAY_LINE_MAX - have);
        if (got < 0 && (errno == EINTR || errno == EAGAIN)) continue;
        if (got <= 0) break;
        have += (size_t)got;
    }
    relay_wipe(g_line, sizeof g_line);
    return code;
}

/* RC-6, checked by the relay itself once both legs stand: every internet socket of the process is a connected
 * stream socket to the camera of the locator or to the loopback ingest port, and none listens. Row 143b: and the
 * socket to the camera has, as its own end, the source address of the start message (relay.h "THE SOURCE ADDRESS"). */
static int sockets_break_the_rule(void) {
    int max = getdtablesize();
    for (int fd = 3; fd < max; fd++) {
        struct sockaddr_storage own, peer;
        socklen_t length = sizeof own, peer_length = sizeof peer, n = sizeof(int);
        int type = 0, listening = 0;
        if (getsockname(fd, (struct sockaddr *)&own, &length) < 0) continue;
        if (own.ss_family != AF_INET && own.ss_family != AF_INET6) continue;
        if (own.ss_family != AF_INET) return 1;
        if (getsockopt(fd, SOL_SOCKET, SO_TYPE, &type, &n) < 0 || type != SOCK_STREAM) return 1;
        n = sizeof(int);
        if (getsockopt(fd, SOL_SOCKET, SO_ACCEPTCONN, &listening, &n) == 0 && listening) return 1;
        if (getpeername(fd, (struct sockaddr *)&peer, &peer_length) < 0 || peer.ss_family != AF_INET) return 1;
        const struct sockaddr_in *to = (const struct sockaddr_in *)&peer;
        struct in_addr camera;
        if (inet_pton(AF_INET, g_start.host, &camera) != 1) return 1;
        int to_camera = to->sin_addr.s_addr == camera.s_addr && ntohs(to->sin_port) == g_start.port;
        int to_ingest = to->sin_addr.s_addr == htonl(INADDR_LOOPBACK) && ntohs(to->sin_port) == g_start.ingest_port;
        if (!to_camera && !to_ingest) return 1;
        /* Row 143b: the camera socket's OWN end is the source address of the start message, when it states one. */
        if (to_camera && g_start.source[0]) {
            struct in_addr source;
            if (inet_pton(AF_INET, g_start.source, &source) != 1) return 1;
            if (((const struct sockaddr_in *)&own)->sin_addr.s_addr != source.s_addr) return 1;
        }
    }
    return 0;
}

/* ---------------------------------------------------------------- the push leg */
typedef struct Push {
    AVFormatContext *out;
    AVStream *stream;
    AVPacket *packet;
    int open;
    uint32_t last_stamp;
    int64_t ticks, last_ticks;
    int64_t first_us, last_us;              /* this host's monotonic clock at pts 0 and at the picture before */
    RelayCodec codec;                       /* what was ANNOUNCED to the worker: a later leg must bring the same (row 43) */
    ParamSets sets;
    int placed_by_clock;                    /* the next picture is the first of a new leg (row 43, TIME) */
} Push;

/* The picture size, which the library's writer asks for before it announces. It is READ, by the library's stream
 * parser, from the parameter sets and the first keyframe: nothing is decoded. 0 when it could not be read. */
static int picture_size(enum AVCodecID id, const uint8_t *extra, int n, const RelayPicture *picture, int *width, int *height) {
    AVCodecParserContext *parser = av_parser_init(id);
    AVCodecContext *context = avcodec_alloc_context3(NULL);
    size_t length = (size_t)n + picture->length;
    uint8_t *both = av_mallocz(length + AV_INPUT_BUFFER_PADDING_SIZE), *out = NULL;
    int out_size = 0, ok = 0;
    if (parser && context && both && length < INT32_MAX) {
        memcpy(both, extra, (size_t)n);
        memcpy(both + n, picture->unit, picture->length);
        parser->flags |= PARSER_FLAG_COMPLETE_FRAMES;
        av_parser_parse2(parser, context, &out, &out_size, both, (int)length, AV_NOPTS_VALUE, AV_NOPTS_VALUE, 0);
        if (parser->width > 0 && parser->height > 0 && parser->width <= 16384 && parser->height <= 16384) { *width = parser->width; *height = parser->height; ok = 1; }
    }
    av_free(both);
    avcodec_free_context(&context);
    if (parser) av_parser_close(parser);
    return ok;
}

/* WHAT THE STREAM SAYS ABOUT ITSELF, read the same way in both modes (row 42): the parameter sets as the
 * library's writer takes them (`extra`, `*n` bytes) and the picture size. */
static RelayCode stream_facts(RelayCodec codec, const ParamSets *sets, const RelayPicture *first, uint8_t *extra, size_t cap, int *n, int *width, int *height) {
    *n = relay_extradata(codec, sets, extra, cap);
    if (*n <= 0) return RELAY_INTERNAL;
    /* What the library's stream parser is about to read came from the camera (review M-1). Each parameter set is
     * held to its kind, its forbidden bit and a least length before that; the keyframe is units of the codec, each
     * after a start code of the relay's own and none inside (relay_core.c). What stays: the parser reads those
     * bytes, in this process, which holds the Digest key. */
    if (!relay_sets_valid(codec, sets)) return RELAY_STREAM_INVALID;
    if (!picture_size(codec == RELAY_CODEC_H264 ? AV_CODEC_ID_H264 : AV_CODEC_ID_HEVC, extra, *n, first, width, height)) return RELAY_STREAM_INVALID;
    return RELAY_STOPPED;
}

/* PROBE MODE (row 42): the camera was opened exactly as for a recording and the gate holds the parameter sets and
 * a keyframe. Nothing is pushed: the stream's statement goes out as the one report line. */
static RelayCode probe_report(const RelayDescription *description, const ParamSets *sets, const RelayPicture *first) {
    static char line[RELAY_REPORT_MAX + 1];
    uint8_t extra[3 * (RELAY_PSET_MAX + 4)];
    RelayProbe probe = { g_start.attempt, description->codec, 0, 0, description->rate_milli,
                         relay_sets_complete(description->codec, &description->sets), relay_sets_complete(description->codec, &first->seen), sets };
    RelayCode code;
    int n = 0;
    if ((code = stream_facts(description->codec, sets, first, extra, sizeof extra, &n, &probe.width, &probe.height))) return code;
    if (sockets_break_the_rule()) return RELAY_SOCKET_RULE;
    return report(line, relay_probe_line(&probe, line, sizeof line));
}

/* PREVIEW MODE (row 89): the gate opens. The stream's facts are read as in the two other modes (each parameter set
 * held to its kind before the library's stream parser sees it), the socket rule is asked (one socket: the camera's),
 * and the parameter sets go out first, as relay_extradata made them. The pictures follow (main). */
static RelayCode preview_sets(RelayCodec codec, const ParamSets *sets, const RelayPicture *keyframe) {
    uint8_t extra[3 * (RELAY_PSET_MAX + 4)];
    int width = 0, height = 0, n = 0;
    RelayCode code = stream_facts(codec, sets, keyframe, extra, sizeof extra, &n, &width, &height);
    if (code) return code;
    if (sockets_break_the_rule()) return RELAY_SOCKET_RULE;
    return media(extra, (size_t)n);
}

static RelayCode push_open(Push *p, RelayCodec codec, const ParamSets *sets, const RelayPicture *first) {
    uint8_t extra[3 * (RELAY_PSET_MAX + 4)];
    uint32_t first_stamp = first->stamp;
    int width = 0, height = 0, n = 0;
    RelayCode facts = stream_facts(codec, sets, first, extra, sizeof extra, &n, &width, &height);
    if (facts) return facts;
    if (avformat_alloc_output_context2(&p->out, NULL, "rtsp", g_start.ingest) < 0 || !p->out) return RELAY_INTERNAL;
    p->out->interrupt_callback.callback = interrupt;
    p->stream = avformat_new_stream(p->out, NULL);
    p->packet = av_packet_alloc();
    if (!p->stream || !p->packet) return RELAY_INTERNAL;
    AVCodecParameters *par = p->stream->codecpar;
    par->codec_type = AVMEDIA_TYPE_VIDEO;
    par->codec_id = codec == RELAY_CODEC_H264 ? AV_CODEC_ID_H264 : AV_CODEC_ID_HEVC;
    par->extradata = av_mallocz((size_t)n + AV_INPUT_BUFFER_PADDING_SIZE);
    if (!par->extradata) return RELAY_INTERNAL;
    memcpy(par->extradata, extra, (size_t)n);
    par->extradata_size = n;
    par->width = width;
    par->height = height;
    p->stream->time_base = (AVRational){ 1, 90000 };
    p->out->start_time_realtime = real_us();        /* this host's clock for pts 0 */
    p->last_stamp = first_stamp;
    p->ticks = 0;
    p->last_ticks = -1;
    p->first_us = p->last_us = mono_us();
    AVDictionary *options = NULL;
    av_dict_set(&options, "rtsp_transport", "tcp", 0);              /* RC-6: no datagram socket on this leg either */
    int r = avformat_write_header(p->out, &options);                /* THE announce: once */
    int unread = av_dict_count(options);
    av_dict_free(&options);
    if (r < 0) return g_stop ? RELAY_STOP_ASKED : RELAY_INGEST_REFUSED;
    p->codec = codec;
    p->sets = *sets;
    p->open = 1;
    return unread ? RELAY_INTERNAL : RELAY_STOPPED;
}

static RelayCode push_write(Push *p, const RelayPicture *picture) {
    AVPacket *k = p->packet;
    int64_t now = mono_us(), step = (int32_t)(picture->stamp - p->last_stamp);
    /* Row 43: the first picture of a new leg. The camera's stamps began anew, so their distance to the picture
     * before the loss says nothing: the picture is placed as far after that one as THIS host's clock counted
     * (9 ticks in 100 microseconds) - the gap is a step in time inside the one track, as long as the gap was.
     * Such a step is believable by construction (the rule below holds for it). */
    if (p->placed_by_clock) {
        step = (now - p->last_us) / 100 * 9;
        if (step < 1) step = 1;
        p->placed_by_clock = 0;
    }
    /* Recorded time is the camera's stamps, so the camera may not run it ahead of this host's clock (review M-3):
     * one step by at most RELAY_STEP_TICKS more than the time that passed, the whole by that and a hundredth. */
    if (!relay_step_plausible(step, now - p->last_us, p->ticks + step, now - p->first_us)) return RELAY_STREAM_INVALID;
    p->ticks += step;
    p->last_stamp = picture->stamp;
    p->last_us = now;
    if (p->ticks <= p->last_ticks) p->ticks = p->last_ticks + 1;    /* the muxed time never goes backwards */
    p->last_ticks = p->ticks;
    if (av_new_packet(k, (int)picture->length) < 0) return RELAY_INTERNAL;
    memcpy(k->data, picture->unit, picture->length);
    k->stream_index = 0;
    k->pts = k->dts = av_rescale_q(p->ticks, (AVRational){ 1, 90000 }, p->stream->time_base);
    k->flags = picture->keyframe ? AV_PKT_FLAG_KEY : 0;
    g_closing = 1;                                  /* bounded, not cut by the order to stop (interrupt) */
    g_close_deadline_us = mono_us() + RELAY_IO_BOUND_US;
    int r = av_write_frame(p->out, k);
    g_closing = 0;
    av_packet_unref(k);
    if (r < 0 || mono_us() > g_close_deadline_us) return RELAY_INGEST_LOST;
    return RELAY_STOPPED;
}

/* Ends the push the way the worker's pushers do (TEARDOWN), bounded: a worker that is gone cannot hold the relay. */
static void push_close(Push *p) {
    if (p->out) {
        if (p->open) {
            g_closing = 1;
            g_close_deadline_us = mono_us() + 2000000;
            av_write_trailer(p->out);
        }
        avformat_free_context(p->out);
        p->out = NULL;
    }
    av_packet_free(&p->packet);
}

/* ---------------------------------------------------------------- the re-open (row 43; relay.h "THE RE-OPEN") */
typedef struct Again {
    long losses, refusals;                  /* of the relay's life, once the push stood */
    int pending;                            /* a loss was said and no picture was forwarded since */
    int tries;                              /* of the loss that is pending */
    int64_t lost_us;
    long held_at_loss;
} Again;

/* Waits, and sees the order to stop within a twentieth of a second. */
static RelayCode pause_for(int64_t us) {
    int64_t until = mono_us() + us;
    while (mono_us() < until) {
        if (stop_asked(NULL)) return RELAY_STOP_ASKED;
        poll(NULL, 0, 50);
    }
    return RELAY_STOPPED;
}

/* The camera leg ended with `lost` while the push stands. Returns RELAY_STOPPED when a new leg plays (the caller
 * closes the gate and waits for its keyframe); else the code the relay ends with. The push is not touched. */
static RelayCode camera_again(RelayCamera *camera, RelayDescription *description, Again *a, RelayCode lost, const RelayPicture *picture) {
    static char line[RELAY_REPORT_MAX + 1];
    RelayCode code;
    int kind = relay_loss_kind(lost);
    if (kind == RELAY_LOSS_ENDS) return lost;
    relay_camera_drop(camera);              /* at once: no TEARDOWN, and during the waits the push is the only socket */
    if (!a->pending) {
        a->pending = 1;
        a->tries = 0;
        a->lost_us = mono_us();
        a->held_at_loss = g_held_back;
        if (a->losses < RELAY_COUNT_MAX) a->losses++;
        if ((code = report(line, relay_loss_line(g_start.attempt, a->losses, lost, line, sizeof line)))) return code;
        say("camera_lost", relay_code_name(lost), lost, picture, relay_camera_counters(camera));
    }
    for (;;) {
        /* A refused answer is counted for the relay's life: the camera is not hammered (design addendum 2.4). */
        if (kind == RELAY_LOSS_REFUSAL && ++a->refusals >= RELAY_AUTH_REFUSALS) return RELAY_AUTH_REFUSED;
        int64_t wait = relay_retry_wait_us(a->tries);
        if (!wait) return lost;             /* the tries are used up: the code of the last one */
        a->tries++;
        if ((code = pause_for(wait))) return code;
        lost = relay_camera_open(camera, description);
        if (!lost) return sockets_break_the_rule() ? RELAY_SOCKET_RULE : RELAY_STOPPED;
        relay_camera_drop(camera);
        if ((kind = relay_loss_kind(lost)) == RELAY_LOSS_ENDS) return lost;
    }
}

int main(int argc, char **argv) {
    RelayCamera *camera = NULL;
    RelayDescription description;
    RelayPicture picture;
    Push push;
    Again again;
    RelayCode code;
    int have_picture = 0, gate = 0, probed = 0, waiting = 1, previewing = 0;
    long losses_seen = 0;
    struct sigaction ignore, stop;
    (void)argv;
    memset(&push, 0, sizeof push);
    memset(&picture, 0, sizeof picture);
    memset(&again, 0, sizeof again);
    /* sigaction, not signal (review L-7): the same on every platform - the handler stays, and a wait that a
     * signal interrupts is NOT started again by the system, so the order to stop is seen at once. */
    memset(&ignore, 0, sizeof ignore);
    memset(&stop, 0, sizeof stop);
    ignore.sa_handler = SIG_IGN;
    stop.sa_handler = on_signal;
    sigemptyset(&ignore.sa_mask);
    sigemptyset(&stop.sa_mask);
    sigaction(SIGPIPE, &ignore, NULL);
    sigaction(SIGXFSZ, &ignore, NULL);
    sigaction(SIGTERM, &stop, NULL);
    sigaction(SIGINT, &stop, NULL);

    if (hygiene()) { code = RELAY_HYGIENE_FAILED; goto done; }
    if (argc != 1) { code = RELAY_USAGE; goto done; }
    if (avformat_version() != (unsigned)LIBAVFORMAT_VERSION_INT) { code = RELAY_LIBAVFORMAT_VERSION_MISMATCH; goto done; }
    av_log_set_callback(library_says);
    avformat_network_init();

    if ((code = read_start())) { if (g_stop) code = RELAY_STOP_ASKED; goto done; }
    if (!(camera = relay_camera_new(&g_start, stop_asked, NULL))) { code = RELAY_INTERNAL; goto done; }
    code = relay_camera_open(camera, &description);
    relay_wipe(g_start.secret, sizeof g_start.secret);      /* whatever happened: the password is not needed again */
    if (code) goto done;
    if (relay_picture_init(&picture, description.codec, description.payload_type)) { code = RELAY_INTERNAL; goto done; }
    have_picture = 1;
    say("camera_playing", "RUNNING", RELAY_STOPPED, &picture, relay_camera_counters(camera));

    /* ONE TURN OF THIS LOOP PER LEG of the camera: the first open, and every re-open while the push stands (row 43). */
    for (;;) {
    /* The first keyframe of a leg has its bound from here. The camera leg asks for it on every turn of its read
     * loop, so a camera that sends no video packet at all, or only what is dropped, meets it too (review H-2). */
    int64_t keyframe_deadline = mono_us() + RELAY_KEYFRAME_BOUND_US;
    relay_camera_limit(camera, keyframe_deadline, RELAY_KEYFRAME_TIMEOUT);
    for (;;) {
        const uint8_t *packet;
        size_t length;
        int r;
        if ((code = relay_camera_read(camera, &packet, &length))) break;
        do {
            r = relay_picture_add(&picture, packet, length);
            if (r < 0) { code = (RelayCode)-r; break; }
            if (r == 0) break;
            /* A picture. After a gap in the camera's sequence, or a picture that was not handed on (damaged,
             * refused), the pictures that follow lean on what was lost. */
            if (picture.gaps + picture.dropped != losses_seen) { losses_seen = picture.gaps + picture.dropped; gate = 0; }
            if (!gate) {
                const ParamSets *sets = relay_sets_complete(description.codec, &picture.seen) ? &picture.seen : &description.sets;
                /* A keyframe opens the gate when the parameter sets are held: of the stream or its description on
                 * the first leg and on EVERY later one (row 43); inside a leg, after a gap, the announced ones. */
                if (picture.keyframe && ((push.open && !again.pending) || relay_sets_complete(description.codec, sets))) {
                    if (g_start.mode == RELAY_MODE_PROBE) {
                        /* The same open, the same gate, and here the two modes part: a probe reports and ends. */
                        if (!(code = probe_report(&description, sets, &picture))) { probed = 1; say("probe_reported", "RUNNING", RELAY_STOPPED, &picture, relay_camera_counters(camera)); }
                        break;
                    }
                    if (g_start.mode == RELAY_MODE_PREVIEW) {
                        /* Row 89: the same open, the same gate; the parameter sets go out first, then every picture. */
                        if ((code = preview_sets(description.codec, sets, &picture))) break;
                        if (!previewing) { previewing = 1; say("preview_streaming", "RUNNING", RELAY_STOPPED, &picture, relay_camera_counters(camera)); }
                    } else if (!push.open) {
                        static char line[RELAY_REPORT_MAX + 1];
                        if ((code = push_open(&push, description.codec, sets, &picture))) break;
                        if (sockets_break_the_rule()) { code = RELAY_SOCKET_RULE; break; }
                        /* "Push established" (S13-06, RC-3 (i)): the worker answered the record request with success. */
                        if ((code = report(line, relay_established_line(g_start.attempt, line, sizeof line)))) break;
                        say("push_open", "RUNNING", RELAY_STOPPED, &picture, relay_camera_counters(camera));
                    } else if (again.pending) {
                        /* THE GATE AFTER A RE-OPEN (row 43): the keyframe of the new leg, and its parameter sets are
                         * the ones the worker was told when the push was announced - a stream that came back as
                         * another one is not forwarded into the file of the first. The loss ends here. */
                        static char line[RELAY_REPORT_MAX + 1];
                        int64_t gap_ms = (mono_us() - again.lost_us) / 1000;
                        if (!relay_same_stream(push.codec, &push.sets, description.codec, sets)) { code = RELAY_STREAM_INVALID; break; }
                        if ((code = report(line, relay_reopened_line(g_start.attempt, again.losses, again.tries, g_held_back - again.held_at_loss, gap_ms > RELAY_COUNT_MAX ? RELAY_COUNT_MAX : gap_ms, line, sizeof line)))) break;
                        say("camera_reopened", "RUNNING", RELAY_STOPPED, &picture, relay_camera_counters(camera));
                        again.pending = again.tries = 0;
                        push.placed_by_clock = 1;
                    }
                    if (waiting) { relay_camera_limit(camera, 0, RELAY_STOPPED); waiting = 0; }     /* the keyframe came */
                    gate = 1;
                }
            }
            if (gate) {
                if (g_start.mode == RELAY_MODE_PREVIEW) { if ((code = media(picture.unit, picture.length))) break; }
                else if ((code = push_write(&push, &picture))) break;
                g_pictures++;
            } else g_held_back++;
            relay_picture_taken(&picture);
            relay_camera_progress(camera);          /* a complete picture: the bound of a playing camera starts again */
        } while (r == 2);
        if (code || probed) break;
        if (waiting && mono_us() > keyframe_deadline) { code = RELAY_KEYFRAME_TIMEOUT; break; }
    }
    /* THE LEG ENDED. Before the push stands, in probe mode, in preview mode (row 89), and with every code that is no
     * loss of the camera, the relay ends as it always did. Else the camera is opened again and the push stays (row 43). */
    if (probed || !push.open || g_start.mode != RELAY_MODE_RECORD) break;
    if ((code = camera_again(camera, &description, &again, code, &picture))) break;
    if (description.codec != push.codec) { code = RELAY_STREAM_INVALID; break; }
    {
        /* The collector begins anew with the new leg (nothing of a half picture of the old one is kept); what it
         * counted goes on. The gate is closed. */
        long gaps = picture.gaps, foreign = picture.foreign, unsupported = picture.unsupported, refused = picture.refused, dropped = picture.dropped;
        relay_picture_free(&picture);
        if (relay_picture_init(&picture, description.codec, description.payload_type)) { code = RELAY_INTERNAL; break; }
        picture.gaps = gaps; picture.foreign = foreign; picture.unsupported = unsupported; picture.refused = refused; picture.dropped = dropped;
        losses_seen = picture.gaps + picture.dropped;
        gate = 0;
        waiting = 1;
    }
    }

done:
    {
        RelayCounters counters = { 0, 0, 0, 0, 0, 0 };
        if (camera) counters = *relay_camera_counters(camera);
        /* After a refused answer no request leaves, not even the TEARDOWN of the end (it would carry one). */
        if (camera && code == RELAY_AUTH_REFUSED) relay_camera_drop(camera);
        push_close(&push);
        relay_camera_close(camera);
        relay_wipe(&g_start, sizeof g_start);
        relay_wipe(g_line, sizeof g_line);
        if (code == RELAY_STOP_ASKED) code = RELAY_STOPPED;
        say("exit", relay_code_name(code), code, have_picture ? &picture : NULL, &counters);
        if (have_picture) relay_picture_free(&picture);
    }
    return (int)code;
}
