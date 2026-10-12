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
 * THE ANNOUNCED ADDRESS (task 4 blueprint row 58, WP-11b; decisions C26, C27; BR-01 to BR-03 of
 * verification/05_security_branch_b.md; the rule and its reasons: announce.h). The listener of this
 * libavformat takes a push to ANY path. So an ingest goes on - to the probe, to the file, to
 * `ingest_connected` - ONLY when during its open the library handed the log callback exactly one
 * ANNOUNCE line and that message equals, as a whole, the one the plan's address gives ("the gate",
 * in ingest_body between avformat_open_input and avformat_find_stream_info). This is the one place
 * where the worker reads a message text of the library, and it reads it as a NECESSARY condition of
 * recording: no such message, another wording, another level, a longer or a second line all end
 * THAT camera as a fault before a byte of media is read. The gate has no switch: no argument, no
 * plan member, no environment variable and no compile switch turns it off (a proof build can only
 * make the callback see nothing, so that every push is refused: DEMS_PROOF_ANNOUNCE_UNSEEN).
 * ATTRIBUTION: a message counts for a camera only on the thread that is opening that camera
 * (`tls_opening`) AND when the library hands it over with that camera's input context; what it
 * showed lives in the camera's own state (worker.h). An open that can no longer pass is ended early
 * through THAT camera's interrupt callback; the early end is a courtesy, the gate is the check.
 * No address and no path is written anywhere by this.
 * LOG HYGIENE OF THE GATE (task 4 row 175; BR-04): no log level is ever set (a call of av_log_set_level
 * does not compile, worker.h) and nothing above the error level is written; a message of the library that
 * names an address or the path of a camera of this session is withheld whatever its level (av_log_cb);
 * a refusal of the gate has one of two codes, INGEST_ANNOUNCE_NOT_MATCHED (a differing or repeated line)
 * and INGEST_ANNOUNCE_NOT_SEEN (no line: a library change), neither with any text of an address.
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

/* THE SAME PIN WHEN THE PROGRAM RUNS (review R63-07). The worker links the shared library of the installed
 * FFmpeg: after an upgrade within the same major version the SAME binary would run on another libavformat, and
 * neither the header pin above nor check.sh sees it. main() asks this before it says HELLO and refuses to start
 * (CRASH LIBAVFORMAT_VERSION_MISMATCH instead of HELLO, exit 70). A proof build names another number through
 * DEMS_PROOF_RUNTIME_LAVF_VERSION_INT to show the refusal (`make unit`). */
#ifdef DEMS_PROOF_RUNTIME_LAVF_VERSION_INT
#define RUNTIME_LAVF_VERSION_INT DEMS_PROOF_RUNTIME_LAVF_VERSION_INT
#else
#define RUNTIME_LAVF_VERSION_INT LIBAVFORMAT_VERSION_INT
#endif
int lavf_runtime_mismatch(unsigned *running, unsigned *verified) {
    *running = avformat_version();
    *verified = (unsigned)RUNTIME_LAVF_VERSION_INT;
    return *running != *verified;
}

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

/* Ends a blocking call of libavformat for ONE camera: the session is stopping (read here, set by main only), or
 * THIS camera's open can no longer pass the gate (BR-03: the camera is the callback's argument; a refusal of one
 * camera sets its own flag and never the stop flag of the process, so the other camera goes on). */
static int interrupt_cb(void *o) {
    Cam *c = o;
    return atomic_load(&g_stop_ingest) || (c && atomic_load(&c->announce_refused));
}

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
    /* THE ANNOUNCED ADDRESS (row 58; BR-02, BR-03): what the library shows of the request lines it reads, at EVERY
     * level (the callback is handed all of them; no level is set anywhere), counted for a camera only when this
     * thread is opening that camera AND the message comes with that camera's input context. The message is formatted
     * whole (one that does not fit can only count against the open) and judged by announce.c; nothing of it is kept,
     * logged or sent. PROOF BUILD ONLY: with DEMS_PROOF_ANNOUNCE_UNSEEN the callback sees nothing - "the library no
     * longer says the line" - and the gate, which no switch touches, must then refuse every push. */
    int observed = 0;
#ifndef DEMS_PROOF_ANNOUNCE_UNSEEN
    observed = c && avcl && avcl == (void *)c->in;
#endif
    /* Nothing above the error level is ever written (BR-04 (1)); such a message is only formatted when the gate
     * has to see it. No level is set anywhere: av_log_set_level cannot be called in this program (worker.h). */
    if (!observed && level > AV_LOG_ERROR) return;
    char whole[ANNOUNCE_MESSAGE_CHARS];
    va_list seen;
    va_copy(seen, vl);
    int n = vsnprintf(whole, sizeof whole, fmt, seen);
    va_end(seen);
    if (n < 0) whole[0] = 0;
    int fits = n >= 0 && (size_t)n < sizeof whole;
    size_t have = n < 0 ? 0 : fits ? (size_t)n : sizeof whole - 1;
    if (observed && announce_gate_observe(&c->announce, whole, have, fits)) atomic_store(&c->announce_refused, 1);
    if (level > AV_LOG_ERROR) return;
    /* LOG HYGIENE (task 4 row 175; BR-04 (2)). What is written of a message of the library is judged on the WHOLE
     * message as formatted above (up to 4,095 characters), not on the 255 that are written: an address or a path
     * that the cut would leave in part is seen whole here. Withheld, and reduced to its class:
     *   - a message that names an address (as before);
     *   - a message that names the path of ANY camera of this session's plan - the whole path or one of its long
     *     elements (announce.h) - whichever thread and whichever context it came from: the path of an ingest
     *     address is the session's secret, and a bare path has no "://" to be caught by.
     * The plan's addresses are written once, before any ingest thread exists, and only read here. */
    const char *withheld = strstr(whole, "://") ? "(message with an address withheld)" : NULL;
    for (int i = 0; i < NCAM && !withheld; i++)
        if (S.cam[i].present && announce_names_path(S.cam[i].url, whole, have)) withheld = "(message naming a session path withheld)";
    char msg[256];
    snprintf(msg, sizeof msg, "%s", withheld ? withheld : whole);
    for (char *p = msg; *p; p++) if (*p == '"' || *p == '\\' || (unsigned char)*p < 0x20) *p = ' ';
    logj("warn", "libav", "LIBAV_MESSAGE", "\"av_level\":%d,\"text\":\"%s\"", level, msg);
}

/* The name of a gate refusal in the worker's log (task 4 row 175; BR-04 (3)): TWO codes, so that "a client
 * announced something else, or twice" is told from "the library showed no line at all" (a library change: the
 * right push is refused too, and no camera of any session will connect until the pin is moved by decision).
 * Neither carries an address, a path or a text of the library; both end THAT camera with the same frame
 * (CAPTURE_FAULT, CAMERA_NOT_CONNECTED - the protocol has no member that tells them apart). */
static const char *announce_refusal_code(const AnnounceGate *g) {
    return announce_gate_verdict(g) == ANNOUNCE_NOT_SEEN ? "INGEST_ANNOUNCE_NOT_SEEN" : "INGEST_ANNOUNCE_NOT_MATCHED";
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
        /* The level the sync of THIS file achieved (R63-09), never the one the build would like: a volume without the full sync says FSYNC. */
        const char *level = sink_sync_level(&c->sink);
        logj(strcmp(level, sink_sync_wanted()) ? "warn" : "info", "sink", "first_durable_fragment", "\"cam\":%d,\"bytes\":%lld,\"sync\":\"%s\",\"sync_wanted\":\"%s\"", c->idx + 1, (long long)(cp->start + cp->len), level, sink_sync_wanted());
        send_record("\"kind\":\"FIRST_DURABLE_FRAGMENT\",\"deviceId\":\"%s\",\"bytes\":%lld,\"syncLevel\":\"%s\"", c->device_id, (long long)(cp->start + cp->len), level);
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
 * REPORTED (a hard ceiling by `frag_duration` would make fragments without a keyframe, spec C.1).
 * The SIZE of a fragment is another matter and IS held: see "the fragment size bound" below. */
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

/* ---------------------------------------------------------------- the fragment size bound (R63-02) */
/* Review R63-02, ruling D179. On stream copy a fragment is one camera GOP, and nothing bounded its BYTES: a
 * camera with a long keyframe interval at a high bitrate made fragments of 98 to 108 MiB (decision D167), the
 * worker wrote, synced and checkpointed them, and the session failed only at its seal - the seal and the
 * verifier open ONE fragment in memory and refuse one above 64 MiB. THE RULE: no fragment the worker makes
 * durable is larger than the bound it was started with (`g_max_fragment_bytes`: ONE number, the seal's, passed
 * by the Core's launcher). When the sample at hand would take the OPEN fragment past it, the fragment is
 * CLOSED there (the muxer's own flush, as the stall cut W-3 uses it) and the sample begins the next one.
 *   - NO SAMPLE IS LOST: the cut is between two samples; both fragments are whole `moof` + `mdat` pairs.
 *   - The fragment after such a cut does not start on a keyframe. That is legal fMP4 and it is SAID: its
 *     checkpoint carries `keyframe: false` (the writer reads the first video sample's sync flag from the
 *     `trun`), the manifest states it per fragment (field 72) and per track (`keyframeAligned`, field 50).
 *     The spec does not forbid it: capture spec C.1 rejects mid-GOP fragments "for the default" and names a
 *     hard ceiling that accepts them as an open option (05_capture_architecture_spec.md:1003, :1019); the
 *     default stays - every fragment of a camera under the bound starts on a keyframe.
 *   - THE NEXT KEYFRAME BEGINS A FRAGMENT AGAIN. Left to itself the muxer would not cut at the keyframe that
 *     follows such a cut (its fragment is younger than `min_frag_duration`), and with a GOP of several bounds
 *     hardly any fragment of the file would start on a keyframe. So the fragment that began at the bound is
 *     closed when the next keyframe arrives: every camera GOP starts a fragment, as in a file without a cut.
 *   - The warning CAPTURE_FAULT / FRAGMENT_SIZE_BOUND_REACHED, once per camera (an advisory: it records).
 * THE ESTIMATE. The muxer holds the open fragment; the worker counts what it handed it since the last
 * fragment left (the writer's count of fragments says when one did - also for the muxer's own cut at a
 * keyframe and for the stall cut). A sample costs its bytes, plus what the muxer may add: its `trun` entry
 * (16 bytes), a start code that becomes a length (1 byte per NAL unit), covered by 64 bytes per sample and
 * one sixty-fourth of the payload; the boxes of the fragment by FRAGMENT_BOX_ALLOWANCE. The estimate is
 * therefore above the true size, and the cut comes a little early (about 1.6 %), never late. Should it ever
 * be wrong the other way, the writer refuses the fragment before a byte of it is written (sink.c,
 * WRITER_FRAGMENT_TOO_LARGE): fatal, with the durable prefix intact - never an oversized fragment on the disk.
 * A SINGLE sample that alone is above the bound cannot be put into any fragment: SAMPLE_ABOVE_FRAGMENT_BOUND. */
#define FRAGMENT_BOX_ALLOWANCE 4096
#define SAMPLE_ALLOWANCE 64

__attribute__((unused)) static int64_t fragment_cost(int64_t payload, int64_t samples) { return FRAGMENT_BOX_ALLOWANCE + payload + payload / 64 + samples * SAMPLE_ALLOWANCE; }

/* One packet into the camera's muxer, under the size bound. Called under `c->mx`. Returns 0 or an AVERROR. */
static int write_bounded_locked(Cam *c, AVPacket *p) {
    int64_t size = p->size, seen = atomic_load(&c->sink.fragments);
    if (seen != c->open_seen_fragments) { c->open_seen_fragments = seen; c->open_bytes = c->open_samples = 0; }   /* a fragment left since (the stall cut) */
#ifndef DEMS_PROOF_NO_FRAGMENT_BOUND        /* PROOF BUILD ONLY: the negative control (the rule off) */
    if (fragment_cost(size, 1) > g_max_fragment_bytes) {
        logj("error", "sink", "SAMPLE_ABOVE_FRAGMENT_BOUND", "\"cam\":%d,\"sample_bytes\":%lld,\"bound_bytes\":%d", c->idx + 1, (long long)size, g_max_fragment_bytes);
        return AVERROR(EFBIG);
    }
    if (c->open_misaligned && c->open_samples > 0 && p->stream_index == c->ov->index && (p->flags & AV_PKT_FLAG_KEY)) {
        int r = av_write_frame(c->out, NULL);               /* the fragment that began at the bound ends; this keyframe begins the next */
        if (r < 0) return r;
        c->realign_cuts++;
        c->open_misaligned = 0;
        c->open_seen_fragments = atomic_load(&c->sink.fragments);
        c->open_bytes = c->open_samples = 0;
    }
    if (c->open_samples > 0 && fragment_cost(c->open_bytes + size, c->open_samples + 1) > g_max_fragment_bytes) {
        int r = av_write_frame(c->out, NULL);               /* the open fragment is closed HERE; this sample begins the next */
        if (r < 0) return r;
        c->size_cuts++;
        c->open_misaligned = 1;
        logj("warn", "sink", "fragment_closed_at_size_bound", "\"cam\":%d,\"open_bytes\":%lld,\"open_samples\":%lld,\"bound_bytes\":%d,\"cuts\":%lld",
             c->idx + 1, (long long)c->open_bytes, (long long)c->open_samples, g_max_fragment_bytes, (long long)c->size_cuts);
        if (!c->size_bound_warned) {
            c->size_bound_warned = 1;
            send_warning("CAPTURE_FAULT", "FRAGMENT_SIZE_BOUND_REACHED", 1, c->device_id);
        }
        c->open_seen_fragments = atomic_load(&c->sink.fragments);
        c->open_bytes = c->open_samples = 0;
    }
#endif
    int64_t before = atomic_load(&c->sink.fragments);
    int r = av_write_frame(c->out, p);
    if (r < 0) return r;
    int64_t after = atomic_load(&c->sink.fragments);
    /* The muxer closed the fragment before it took this sample (a keyframe): the sample is the first of the next. */
    if (after != before) { c->open_seen_fragments = after; c->open_bytes = c->open_samples = 0; c->open_misaligned = 0; }
    c->open_bytes += size;
    c->open_samples++;
    return 0;
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
    int r = write_bounded_locked(c, q);
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
    c->in->interrupt_callback.opaque = c;
    /* The gate's state of THIS open: nothing an earlier open showed counts (BR-03). */
    atomic_store(&c->announce_refused, 0);
    announce_gate_reset(&c->announce, c->url);
    tls_open_errors = 0;
    tls_opening = c;
    int r = avformat_open_input(&c->in, c->url, NULL, &o);
    tls_opening = NULL;
    /* THE REFERENCE OF THE ANCHORING ALLOWANCE (review R63-10). From here on libavformat holds the stream: the
     * probe below reads its first packets and keeps them until the first av_read_frame. A packet handed over
     * later waited INSIDE the receiver at most since this instant - not since the probe ENDED, which is where the
     * reference stood until fix pass F-M3 (a camera with a correct clock whose probe took more than the bound was
     * refused). The allowance is generous for a camera that connects early and sends late; what it can hide - a
     * clock BEHIND by up to the wait - is what the clock floor judges without allowance, one second into the stream. */
    int64_t opened_mono = mono_us();
    /* Given up while it was opening: the session went on without this camera, and stays so. */
    if (atomic_load(&c->abandoned)) { av_dict_free(&o); return NULL; }
    int leftover = av_dict_count(o);
    av_dict_free(&o);
    /* Two different failures, two codes (the skeleton reported every failed open as the second). */
    /* An open the gate itself ended early (a differing or a second ANNOUNCE line, another control address) is named
     * as the gate's refusal (by what the gate saw: announce_refusal_code; an early end always saw a line or an
     * adopted address, so it is INGEST_ANNOUNCE_NOT_MATCHED); every other failed open keeps its code. */
    if (r < 0) { ingest_over(c, src, atomic_load(&c->announce_refused) ? announce_refusal_code(&c->announce) : "INGEST_OPEN_FAILED", r); return NULL; }
    /* THE GATE (row 58; BR-01). The open returned: the handshake is over, nothing of the stream was read, no file
     * exists, `ingest_connected` was not said. From here the ingest goes on ONLY after the positive match of
     * announce.h, recorded during this open for this camera. No `if` of the preprocessor, no argument and no plan
     * member stands around this test. Otherwise the input is closed (the flag first, so that the close cannot wait
     * on the client) and THIS camera ends as a fault; the session and the other camera go on. The refusal has one
     * of two names (row 175): a line that does not let the open pass, or no line at all. */
    if (!announce_gate_passed(&c->announce)) {
        atomic_store(&c->announce_refused, 1);
        avformat_close_input(&c->in);
        ingest_over(c, src, announce_refusal_code(&c->announce), AVERROR(EACCES));
        return NULL;
    }
    if (leftover) { fatal(src, "INGEST_OPTION_NOT_CONSUMED", AVERROR_OPTION_NOT_FOUND); atomic_store(&c->state, ING_ENDED); return NULL; }
    const char *what = NULL;
    if (sockets_violation(&what)) { fatal(src, what, AVERROR(EPERM)); atomic_store(&c->state, ING_ENDED); return NULL; }
    if ((r = avformat_find_stream_info(c->in, NULL)) < 0) { ingest_over(c, src, "INGEST_STREAM_INFO_FAILED", r); return NULL; }
    c->vidx = av_find_best_stream(c->in, AVMEDIA_TYPE_VIDEO, -1, -1, NULL, 0);
    if (c->vidx < 0) { ingest_over(c, src, "INGEST_NO_VIDEO", c->vidx); return NULL; }
    AVStream *is = c->in->streams[c->vidx];
    if (!is->codecpar->extradata_size) { ingest_over(c, src, "INGEST_NO_EXTRADATA", AVERROR_INVALIDDATA); return NULL; }   /* S1 SP-6: fail loudly */
    /* NO PICTURE ARRIVED (task 4 row 176; BR-05 of verification/05_security_branch_b.md). A client that completed
     * the handshake through RECORD with the parameter sets in its description and then sent no media (it closed, it
     * died, the camera behind a relay stalled) leaves a stream that HAS extradata and has NO picture size: the size
     * of a copied stream is only known from a picture the probe read. Until this row that stream went on to the
     * muxer, whose header refused it ("dimensions not set"), and that refusal was a fatal error of the WORKER
     * (OUTPUT_SETUP_FAILED, exit 70): one client without media ended the other camera's recording and the audio.
     * It is a stream this camera never delivered, like the missing parameter sets one line above: THIS camera ends
     * as a fault, under its own code, before any output exists (no context, no file, no byte); the session, the
     * other camera and the audio go on. ONLY this condition was taken out of the fatal path: it is judged on the
     * INPUT, before open_output is called. Whatever open_output itself refuses for a stream that HAS a picture
     * size - the context, the header, a mux option, the audio that waited - is still OUTPUT_SETUP_FAILED and still
     * ends the worker (below), and every error of the writer stays fatal where it was.
     * A camera the session had already given up (INGEST_OPEN_STUCK, said once) is not reported a second time. */
    if (is->codecpar->width <= 0 || is->codecpar->height <= 0) {
        if (atomic_load(&c->abandoned)) {
            logj("warn", src, "INGEST_NO_PICTURE_SIZE", "\"port\":%d,\"extradata\":%d,\"already_given_up\":true", c->port, is->codecpar->extradata_size);
            atomic_store(&c->state, ING_ENDED);
            return NULL;
        }
        ingest_over(c, src, "INGEST_NO_PICTURE_SIZE", AVERROR_INVALIDDATA);
        return NULL;
    }

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

    int64_t live_after = mono_us() + US; /* the packets of the probe are handed over at once: the ingest is live a second after it */
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
        if (p->pts == AV_NOPTS_VALUE) {
            /* The untimestamped LEAD (R63-13): the ones that come before the first packet with a time are part of
             * what the file does not hold; their span is taken from the host's clock and their count. */
            if (!c->seen_pts) { if (!c->lead_packets++) c->lead_first_mono_us = mono_us(); }
            atomic_fetch_add(&c->v_dropped_no_pts, 1);
            av_packet_unref(p);
            continue;
        }
        if (!c->seen_pts) { c->seen_pts = 1; c->lead_end_mono_us = mono_us(); }

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
#ifndef DEMS_PROOF_NO_CLOCK_FLOOR          /* PROOF BUILD ONLY: the negative control of the floor's WIRING (review R63-12): judged, logged, not acted on */
            if (!sane) {
                av_packet_unref(p);
                end = AVERROR(ERANGE);
                clock_refused = 1;
                break;
            }
#endif
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
            /* The span (R63-13): camera time from the first skipped packet that had a time, PLUS the untimestamped lead
             * before it (anchor.c, skipped_span_ms): until fix pass F-M3 the lead was counted and not spanned. */
            int64_t camera_span_us = c->first_skipped_pts_us == AV_NOPTS_VALUE || pts_us <= c->first_skipped_pts_us ? 0 : pts_us - c->first_skipped_pts_us;
            AVRational rate = is->avg_frame_rate.num > 0 && is->avg_frame_rate.den > 0 ? is->avg_frame_rate : is->r_frame_rate;
            int64_t period_us = rate.num > 0 && rate.den > 0 ? av_rescale(US, rate.den, rate.num) : 0, lead_arrival_us = c->lead_packets ? c->lead_end_mono_us - c->lead_first_mono_us : 0;
            int64_t span_ms = skipped_span_ms(camera_span_us, c->lead_packets, lead_arrival_us, period_us);
            logj("info", src, "video_started", "\"first_pts\":%lld,\"time_base_den\":%d,\"skipped_no_timestamp\":%lld,\"skipped_before_audio_start\":%lld,\"skipped_no_camera_clock\":%lld,\"skipped_before_keyframe\":%lld,\"skipped_span_ms\":%lld,"
                 "\"span_camera_ms\":%lld,\"lead_packets\":%lld,\"lead_arrival_ms\":%lld,\"frame_period_us\":%lld",
                 (long long)pts, c->ov->time_base.den, no_pts, prearm, unanchored, prestart, (long long)span_ms, (long long)(camera_span_us / 1000), (long long)c->lead_packets, (long long)(lead_arrival_us / 1000), (long long)period_us);
            if (c->ov->time_base.num == 1)
                send_record("\"kind\":\"FIRST_VIDEO_SAMPLE\",\"deviceId\":\"%s\",\"pts\":%lld,\"timescale\":%d,"
                            "\"skipped\":{\"noTimestamp\":%lld,\"beforeAudioStart\":%lld,\"noCameraClock\":%lld,\"beforeKeyframe\":%lld},\"skippedSpanMs\":%lld",
                            c->device_id, (long long)pts, c->ov->time_base.den, no_pts, prearm, unanchored, prestart, (long long)span_ms);
        }
        int64_t dts = p->dts == AV_NOPTS_VALUE ? pts : av_rescale_q(p->dts, is->time_base, c->ov->time_base) + shift;
        /* THE MONOTONIC GUARD, SAID (review R63-11). The slew never makes the file's time go backwards; neither may
         * a camera that repeats a timestamp or delivers one out of order (B-frames whose dts the receiver does not
         * supply). The guard moves such a sample forward - and until fix pass F-M3 said nothing. Every sample it
         * moved is counted (`retimed` of camera_summary) and the first is logged with its numbers: a file whose
         * count is not 0 holds presentation times the camera did not state. */
        int64_t dts_in = dts, pts_in = pts;
        if (dts <= c->last_dts) dts = c->last_dts + 1;
        if (pts < dts) pts = dts;
        if ((dts != dts_in || pts != pts_in) && !atomic_fetch_add(&c->v_retimed, 1))
            logj("warn", src, "video_timestamp_moved", "\"dts_in\":%lld,\"dts\":%lld,\"pts_in\":%lld,\"pts\":%lld,\"time_base_den\":%d,\"video_packets\":%lld",
                 (long long)dts_in, (long long)dts, (long long)pts_in, (long long)pts, c->ov->time_base.den, (long long)atomic_load(&c->v_written));
        c->last_dts = dts;
        p->dts = dts;
        p->pts = pts;
        p->duration = av_rescale_q(p->duration, is->time_base, c->ov->time_base);
        p->pos = -1;
        p->stream_index = c->ov->index;
        int key = (p->flags & AV_PKT_FLAG_KEY) != 0;
        int64_t file_us = av_rescale_q(pts, c->ov->time_base, AV_TIME_BASE_Q);
        pthread_mutex_lock(&c->mx);
        r = write_bounded_locked(c, p);
        pthread_mutex_unlock(&c->mx);
        av_packet_unref(p);
        if (r < 0) { fatal(src, r == AVERROR(EFBIG) ? "SAMPLE_ABOVE_FRAGMENT_BOUND" : "VIDEO_MUX_WRITE_FAILED", r); break; }
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
