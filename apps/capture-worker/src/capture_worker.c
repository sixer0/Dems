/*
 * DEMS capture worker (blueprint rows 111 and 58; Q-WORKER answer (a), decision D24; register
 * NM-02; capture spec A.2, B.2).
 *
 * A small C program against libavformat / libavcodec / libavfilter of the installed FFmpeg,
 * spawned and supervised by the Core. FFmpeg's own API is the ready-made kit; this is thin glue.
 *
 * HOW IT IS DRIVEN. Only through @dems/capture-protocol on its standard streams:
 *   - it writes HELLO first, then HEARTBEAT at a fixed interval, whatever else it does;
 *   - the session arrives as the plan of START (never in the arguments: nothing of a session can
 *     show in a process listing), and ends with STOP, with the end of standard input (the
 *     supervisor is gone: no orphan) or with SIGTERM;
 *   - it serves ONE session and exits; a second START is refused (SESSION_ALREADY_SERVED);
 *   - its arguments are fixed per installation: where to log, how often to beat.
 * It reads no environment variable: the supervisor starts it with an empty environment.
 *
 * WHAT A SESSION IS. For every camera of the plan one RTSP/TCP listen ingest on 127.0.0.1 whose
 * video is copied into that camera's fMP4; two mic inputs through one selector into ONE AAC
 * encoder whose packets go into every camera file; meters at the plan's rate; a PCM tap.
 *
 * EXIT CODES. 0 = a clean stop, and only that. A fatal error (mux write, encoder, selector, file
 * create, a socket that is not a loopback stream socket) is sticky: it is logged, sent as CRASH
 * after the files were closed as far as they go, and the process exits with EXIT_FATAL.
 */
#include "worker.h"

#include <errno.h>
#include <fcntl.h>
#include <poll.h>
#include <signal.h>
#include <stdarg.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

Session S;
atomic_int g_stop;
atomic_int g_stop_ingest;
int g_listen_timeout_s = 15;
#ifdef DEMS_PROOF_MUX_EXTRA
const char *g_mux_extra = DEMS_PROOF_MUX_EXTRA;     /* PROOF BUILD: the negative control of the AV checks */
#else
const char *g_mux_extra = NULL;
#endif

static atomic_int g_fatal;
static pthread_mutex_t g_fatal_mx = PTHREAD_MUTEX_INITIALIZER;
static char g_fatal_code[64];
static int g_exit_code;

void fatal(const char *source, const char *code, int averror) {
    char b[128];
    logj("error", source, code, "\"av_error\":\"%s\",\"av_code\":%d", errstr(averror, b, sizeof b), averror);
    pthread_mutex_lock(&g_fatal_mx);
    if (!g_fatal_code[0]) snprintf(g_fatal_code, sizeof g_fatal_code, "%s", code);
    pthread_mutex_unlock(&g_fatal_mx);
    atomic_store(&g_fatal, 1);
    atomic_store(&g_stop, 1);
}

int fatal_pending(void) { return atomic_load(&g_fatal); }

void send_record(const char *fmt, ...) {
    char body[512];
    va_list ap;
    va_start(ap, fmt);
    vsnprintf(body, sizeof body, fmt, ap);
    va_end(ap);
    /* The sequence number and the place in the output are taken together: records leave in order. */
    pthread_mutex_lock(&S.record_mx);
    uint64_t seq = atomic_fetch_add(&S.record_seq, 1) + 1;
    ipc_send("\"type\":\"RECORD\",\"sessionId\":\"%s\",\"seq\":%llu,\"record\":{%s}", S.id, (unsigned long long)seq, body);
    pthread_mutex_unlock(&S.record_mx);
}

/* A warning whose condition began. Every subject is a capture device ID of the plan (or null): the
 * vocabulary of the engine, never a track name (decision D72, finding A-1). The conditions this
 * worker reports (a camera that is refused, ends or never connects) do not end inside a session,
 * so it writes no CLEARED; the frame can carry one for the warnings of the mic rows. */
void send_warning(const char *code, const char *subject) {
    if (subject) ipc_send("\"type\":\"WARNING\",\"sessionId\":\"%s\",\"code\":\"%s\",\"state\":\"ACTIVE\",\"subject\":\"%s\"", S.id, code, subject);
    else ipc_send("\"type\":\"WARNING\",\"sessionId\":\"%s\",\"code\":\"%s\",\"state\":\"ACTIVE\",\"subject\":null", S.id, code);
}

static void ack(const char *corr, const char *refusal) {
    if (refusal) ipc_send("\"type\":\"ACK\",\"correlationId\":\"%s\",\"ok\":false,\"code\":\"%s\"", corr, refusal);
    else ipc_send("\"type\":\"ACK\",\"correlationId\":\"%s\",\"ok\":true", corr);
}

static void on_signal(int s) { (void)s; atomic_store(&g_stop, 1); }

/* ---------------------------------------------------------------- the plan */
static int is_count(const JNode *v, long max) { return v && v->t == J_NUM && v->is_int && v->num >= 1 && v->num <= (double)max; }
static int is_path(const JNode *v) { return v && v->t == J_STR && v->str[0] == '/' && strlen(v->str) <= PATH_CHARS; }

/* SEC35-23: rtsp://127.0.0.1:<8554-8564>/<name>, no credentials, no trailing slash (S1 trap). */
static int parse_listen_url(const char *u, int *port) {
    static const char pre[] = "rtsp://127.0.0.1:";
    if (strlen(u) > 256 || strncmp(u, pre, sizeof pre - 1)) return -1;
    char *end;
    const char *digits = u + sizeof pre - 1;
    if (*digits < '1' || *digits > '9') return -1;
    long p = strtol(digits, &end, 10);
    if (p < CAPTURE_MEDIA_PORT_MIN || p > CAPTURE_MEDIA_PORT_MAX || *end != '/' || !end[1]) return -1;
    for (const char *q = end + 1; *q; q++) {
        int ok = (*q >= 'A' && *q <= 'Z') || (*q >= 'a' && *q <= 'z') || (*q >= '0' && *q <= '9') || *q == '.' || *q == '_' || *q == '~' || *q == '-';
        if (*q == '/') { if (q[-1] == '/' || !q[1]) return -1; }
        else if (!ok) return -1;
    }
    *port = (int)p;
    return 0;
}

static int parent_is_directory(const char *path) {
    char dir[PATH_CHARS + 1];
    snprintf(dir, sizeof dir, "%s", path);
    char *slash = strrchr(dir, '/');
    if (!slash) return 0;
    if (slash == dir) slash[1] = 0; else *slash = 0;
    struct stat st;
    return stat(dir, &st) == 0 && S_ISDIR(st.st_mode);
}

/* Fills the session from the plan of START. Returns NULL, or the code the START is refused with. */
static const char *take_plan(Session *s, const JNode *plan) {
    if (!plan || plan->t != J_OBJ || plan->n != 5) return "PLAN_INVALID";
    const JNode *cams = jget(plan, "cameras"), *mics = jget(plan, "mics"), *active = jget(plan, "activeMic"), *tap = jget(plan, "pcmTapPath"), *k = jget(plan, "constants");
    if (!cams || cams->t != J_ARR || cams->n < 1 || cams->n > NCAM || !mics || mics->t != J_ARR || mics->n < 1 || mics->n > NMIC) return "PLAN_INVALID";
    if (!active || active->t != J_STR || !tap || (tap->t != J_NULL && !is_path(tap)) || !k || k->t != J_OBJ || k->n != 6) return "PLAN_INVALID";

    const JNode *rate = jget(k, "audioSampleRateHz"), *channels = jget(k, "audioChannels"), *target = jget(k, "fragmentTargetMs"), *minfrag = jget(k, "minFragDurationMs"),
                *gop = jget(k, "gopFrames"), *meter = jget(k, "meterRateHz");
    if (!is_count(rate, 1000000) || !is_count(channels, 64) || !is_count(target, 600000) || !is_count(minfrag, 600000) || !is_count(gop, 100000) || !is_count(meter, 1000)) return "PLAN_INVALID";
    /* AUDIO-01 is AAC-LC 48 kHz mono (OD-06); the worker records nothing else. */
    if ((int)rate->num != SR || (int)channels->num != 1) return "PLAN_UNSUPPORTED";
    s->fragment_target_ms = (int)target->num;
    s->min_frag_duration_ms = (int)minfrag->num;
    s->gop_frames = (int)gop->num;
    s->meter_rate_hz = (int)meter->num;

    int i = 0;
    for (const JNode *c = cams->child; c; c = c->next, i++) {
        Cam *cam = &s->cam[i];
        const JNode *id = jget(c, "deviceId"), *track = jget(c, "trackId"), *profile = jget(c, "profile"), *url = jget(c, "ingestUrl"), *out = jget(c, "outputPath");
        if (c->t != J_OBJ || c->n != 5 || !id_ok(id, ID_CHARS) || !id_ok(track, ID_CHARS) || !profile || (profile->t != J_NULL && (profile->t != J_STR || !profile->str[0] || strlen(profile->str) > 64))) return "PLAN_INVALID";
        if (!url || url->t != J_STR || parse_listen_url(url->str, &cam->port) || !is_path(out)) return "PLAN_INVALID";
        cam->idx = i;
        cam->present = 1;
        snprintf(cam->device_id, sizeof cam->device_id, "%s", id->str);
        snprintf(cam->track_id, sizeof cam->track_id, "%s", track->str);
        snprintf(cam->url, sizeof cam->url, "%s", url->str);
        sink_init(&cam->sink, out->str);
    }
    if (s->cam[1].present && (s->cam[0].port == s->cam[1].port || !strcmp(s->cam[0].device_id, s->cam[1].device_id) || !strcmp(s->cam[0].track_id, s->cam[1].track_id) || !strcmp(s->cam[0].sink.path, s->cam[1].sink.path))) return "PLAN_INVALID";

    for (const JNode *m = mics->child; m; m = m->next) {
        const JNode *id = jget(m, "deviceId"), *role = jget(m, "role"), *input = jget(m, "input");
        if (m->t != J_OBJ || m->n != 3 || !id_ok(id, ID_CHARS) || !role || role->t != J_STR || !input || input->t != J_OBJ || input->n != 2) return "PLAN_INVALID";
        int at = !strcmp(role->str, "PRIMARY") ? 0 : !strcmp(role->str, "STANDBY") ? 1 : -1;
        const JNode *kind = jget(input, "kind"), *path = jget(input, "path");
        if (at < 0 || s->mic[at].present || !kind || kind->t != J_STR || strcmp(kind->str, "PCM_FIFO") || !is_path(path)) return "PLAN_INVALID";
        s->mic[at].present = 1;
        snprintf(s->mic[at].device_id, sizeof s->mic[at].device_id, "%s", id->str);
        snprintf(s->mic[at].path, sizeof s->mic[at].path, "%s", path->str);
    }
    if (s->mic[0].present && s->mic[1].present && (!strcmp(s->mic[0].device_id, s->mic[1].device_id) || !strcmp(s->mic[0].path, s->mic[1].path))) return "PLAN_INVALID";
    s->active_mic = !strcmp(active->str, "PRIMARY") ? 0 : !strcmp(active->str, "STANDBY") ? 1 : -1;
    if (s->active_mic < 0 || !s->mic[s->active_mic].present) return "PLAN_INVALID";
    if (tap->t == J_STR) snprintf(s->tap_path, sizeof s->tap_path, "%s", tap->str);

    /* What is on the disk. The file is the truth (D67, option C): a path that holds anything is
     * never written to, whatever attempt this is. */
    struct stat st;
    for (i = 0; i < NCAM; i++) {
        if (!s->cam[i].present) continue;
        if (sink_path_occupied(s->cam[i].sink.path)) return "OUTPUT_EXISTS";
        if (!parent_is_directory(s->cam[i].sink.path)) return "OUTPUT_DIR_MISSING";
        if (s->tap_path[0] && !strcmp(s->tap_path, s->cam[i].sink.path)) return "PLAN_INVALID";
    }
    for (i = 0; i < NMIC; i++)
        if (s->mic[i].present && (stat(s->mic[i].path, &st) != 0 || !S_ISFIFO(st.st_mode))) return "MIC_INPUT_NOT_FIFO";
    /* The tap follows the same never-overwrite rule. A file at its path refuses the FIRST worker of
     * a session (the plan is wrong). A restarted worker finds the file its predecessor began: it
     * leaves it alone and records WITHOUT a tap (telemetry says tapActive false), so that a tap can
     * never make every restart fail (finding A-7). */
    if (s->tap_path[0] && stat(s->tap_path, &st) == 0 && !S_ISFIFO(st.st_mode)) {
        if (s->attempt <= 1) return "TAP_PATH_OCCUPIED";
        logj("warn", "main", "pcm_tap_left_alone", "\"attempt\":%d", s->attempt);
        s->tap_path[0] = 0;
    }
    for (i = 0; i < NCAM; i++) {
        int stale = s->cam[i].present ? sink_stale_parts(s->cam[i].sink.path) : 0;
        /* Temporary files of a worker that died while it wrote its first fragment: reported, never reused, never removed. */
        if (stale) logj("warn", "main", "stale_part_files", "\"cam\":%d,\"count\":%d", i + 1, stale);
    }
    return NULL;
}

/* ---------------------------------------------------------------- the session */
static pthread_t audio_th;
static int audio_started, session_served, session_running;

static const char *session_start(const JNode *msg) {
    const JNode *attempt = jget(msg, "attempt");
    if (msg->n != 6 || !is_count(attempt, 1000000)) return "PLAN_INVALID";
    S.attempt = (int)attempt->num;
    const char *refusal = take_plan(&S, jget(msg, "plan"));
    if (refusal) return refusal;
    int r = open_encoder(&S);
    if (r < 0) { fatal("main", "ENCODER_OPEN_FAILED", r); return "ENCODER_OPEN_FAILED"; }
    logj("info", "main", "session_starting", "\"attempt\":%d,\"cameras\":%d,\"port1\":%d,\"port2\":%d,\"mics\":%d,\"tap\":%s,\"lavf\":\"%s\"",
         S.attempt, S.cam[0].present + S.cam[1].present, S.cam[0].port, S.cam[1].port, S.mic[0].present + S.mic[1].present, S.tap_path[0] ? "true" : "false", av_version_info());
    for (int i = 0; i < NCAM; i++) {
        Cam *c = &S.cam[i];
        if (!c->present) continue;
        if (pthread_create(&c->th, NULL, ingest_main, c)) { fatal("main", "THREAD_CREATE_FAILED", AVERROR(EAGAIN)); return "THREAD_CREATE_FAILED"; }
        c->th_started = 1;
    }
    if (pthread_create(&audio_th, NULL, audio_main, &S)) { fatal("main", "THREAD_CREATE_FAILED", AVERROR(EAGAIN)); return "THREAD_CREATE_FAILED"; }
    audio_started = 1;
    session_running = 1;
    return NULL;
}

/* A shutdown that does not finish (a thread that will not end) must not leave a process behind. */
static void *shutdown_watchdog(void *arg) {
    (void)arg;
    for (int i = 0; i < 100; i++) { struct timespec ts = { 0, 100 * 1000 * 1000 }; nanosleep(&ts, NULL); }
    logj("error", "main", "SHUTDOWN_STUCK", "%s", "");
    _exit(EXIT_FATAL);
}

static void session_close(void) {
    int stuck = 0;
    atomic_store(&g_stop, 1);
    if (audio_started) pthread_join(audio_th, NULL);
    atomic_store(&g_stop_ingest, 1);
    /* An ingest thread ends within moments of the stop (its reads are interruptible). One that
     * does not (it never came back from libav) is not waited for: the OTHER camera's file is
     * closed properly first, then the worker leaves with CRASH (finding F-2 (b), (c)). */
    for (int waited = 0; waited < 300; waited++) {
        int alive = 0;
        for (int i = 0; i < NCAM; i++) alive += S.cam[i].th_started && !atomic_load(&S.cam[i].th_done);
        if (!alive) break;
        struct timespec ts = { 0, 10 * 1000 * 1000 };
        nanosleep(&ts, NULL);
    }
    for (int i = 0; i < NCAM; i++) {
        Cam *c = &S.cam[i];
        if (!c->th_started) continue;
        if (atomic_load(&c->th_done)) pthread_join(c->th, NULL);
        else { atomic_store(&c->abandoned, 1); stuck++; logj("error", "main", "ingest_thread_abandoned", "\"cam\":%d", i + 1); }
    }
    for (int i = 0; i < NCAM; i++) {
        Cam *c = &S.cam[i];
        if (!c->present) continue;
        /* What a thread that is still inside libav holds is not touched: it wrote no file. */
        if (c->th_started && !atomic_load(&c->th_done)) continue;
        int r = cam_close(c);
        if (r < 0) fatal("main", "OUTPUT_CLOSE_FAILED", r);
        logj("info", "main", "camera_summary",
             "\"cam\":%d,\"video_packets\":%lld,\"audio_packets\":%lld,\"fragments\":%lld,\"bytes\":%lld,\"dropped_no_pts\":%lld,\"dropped_prearm\":%lld,\"dropped_prestart\":%lld,\"dropped_unanchored\":%lld,\"first_video_pts\":%lld",
             i + 1, (long long)atomic_load(&c->v_written), (long long)atomic_load(&c->a_written), (long long)atomic_load(&c->sink.fragments), (long long)atomic_load(&c->sink.bytes), (long long)atomic_load(&c->v_dropped_no_pts),
             (long long)atomic_load(&c->v_dropped_prearm), (long long)atomic_load(&c->v_dropped_prestart), (long long)atomic_load(&c->v_dropped_unanchored), (long long)(c->started ? c->first_pts : -1));
    }
    if (S.enc) avcodec_free_context(&S.enc);
    session_running = 0;
    if (stuck) fatal("main", "INGEST_THREAD_STUCK", AVERROR(ETIMEDOUT));
}

/* ---------------------------------------------------------------- commands */
static JNode arena[1024];

/* One line of standard input. Returns 0, or -1 when it is no command of the protocol. */
static int on_line(char *line) {
    JNode *msg = json_parse(line, arena, (int)(sizeof arena / sizeof arena[0]));
    if (!msg || msg->t != J_OBJ) return -1;
    const JNode *v = jget(msg, "v"), *type = jget(msg, "type"), *sid = jget(msg, "sessionId"), *corr = jget(msg, "correlationId");
    /* The version is a whole number and exactly ours (2.9 is not 2; finding F-9). */
    if (!v || v->t != J_NUM || !v->is_int || v->num != (double)CAPTURE_PROTOCOL_VERSION || !type || type->t != J_STR || !id_ok(sid, ID_CHARS) || !id_ok(corr, ID_CHARS)) return -1;

    if (!strcmp(type->str, "START")) {
        /* One session per process: the listen ingest refuses a second push (S1 G-1). */
        if (session_served) { ack(corr->str, "SESSION_ALREADY_SERVED"); return 0; }
        session_served = 1;
        snprintf(S.id, sizeof S.id, "%s", sid->str);
        const char *refusal = session_start(msg);
        if (refusal) logj("warn", "main", "start_refused", "\"code\":\"%s\"", refusal);
        ack(corr->str, refusal);
        return 0;
    }
    if (!strcmp(type->str, "STOP")) {
        const JNode *reason = jget(msg, "reason");
        if (msg->n != 5 || !reason || reason->t != J_STR || (strcmp(reason->str, "STOPPED") && strcmp(reason->str, "CRASH") && strcmp(reason->str, "SHUTDOWN"))) return -1;
        if (session_served && strcmp(sid->str, S.id)) { ack(corr->str, "SESSION_MISMATCH"); return 0; }
        logj("info", "main", "stop_received", "\"reason\":\"%s\"", reason->str);
        ack(corr->str, NULL);
        atomic_store(&g_stop, 1);
        return 0;
    }
    if (!strcmp(type->str, "SWITCH_AUDIO_SOURCE")) {
        const JNode *to = jget(msg, "to");
        int at = to && to->t == J_STR ? (!strcmp(to->str, "PRIMARY") ? 0 : !strcmp(to->str, "STANDBY") ? 1 : -1) : -1;
        if (msg->n != 5 || at < 0) return -1;
        if (!session_running || atomic_load(&g_stop)) ack(corr->str, "NOT_RECORDING");
        else if (strcmp(sid->str, S.id)) ack(corr->str, "SESSION_MISMATCH");
        else if (!S.mic[at].present) ack(corr->str, "NO_SUCH_MIC");
        else if (audio_request_switch(at, corr->str)) ack(corr->str, "SWITCH_PENDING");
        /* else: the filtering thread acknowledges it when the switch is real. */
        return 0;
    }
    return -1;
}

static void usage(void) {
    static const char text[] =
        "usage: capture-worker --log <file.jsonl> [--heartbeat-ms <50..10000>] [--listen-timeout-s <1..600>]\n"
        "                      [--audio-manifest <file.jsonl>]   (diagnostic: one line per encoder packet, hashes only)\n"
        "The session is not an argument: it arrives as START on standard input (@dems/capture-protocol).\n";
    if (write(STDERR_FILENO, text, sizeof text - 1) < 0) return;
}

int main(int argc, char **argv) {
    /* A descriptor 0, 1 or 2 that is closed would be handed to the next file this process opens:
     * a log line could then land in an evidence file. Fill the gaps before anything is opened. */
    for (int fd = 0; fd <= 2; fd++)
        if (fcntl(fd, F_GETFD) < 0 && errno == EBADF && open("/dev/null", fd == 0 ? O_RDONLY : O_WRONLY) != fd) return EXIT_USAGE;

    int heartbeat_ms = 500;
    const char *log_path = NULL, *manifest_path = NULL;
    for (int i = 1; i < argc; i++) {
        const char *k = argv[i], *v = i + 1 < argc ? argv[i + 1] : NULL;
        if (!v) { usage(); return EXIT_USAGE; }
        i++;
        if (!strcmp(k, "--log")) log_path = v;
        else if (!strcmp(k, "--heartbeat-ms")) heartbeat_ms = atoi(v);
        else if (!strcmp(k, "--listen-timeout-s")) g_listen_timeout_s = atoi(v);
        else if (!strcmp(k, "--audio-manifest")) manifest_path = v;
        else { usage(); return EXIT_USAGE; }
    }
    if (!log_path || heartbeat_ms < 50 || heartbeat_ms > 10000 || g_listen_timeout_s < 1 || g_listen_timeout_s > 600) { usage(); return EXIT_USAGE; }
    if (log_open(log_path) < 0 || (manifest_path && audio_set_manifest(manifest_path) < 0)) { usage(); return EXIT_USAGE; }

    for (int i = 0; i < NCAM; i++) {
        if (pthread_mutex_init(&S.cam[i].mx, NULL) || pthread_mutex_init(&S.cam[i].trend_mx, NULL)) return EXIT_FATAL;
        atomic_store(&S.cam[i].state, ING_WAITING);
    }
    if (pthread_mutex_init(&S.record_mx, NULL)) return EXIT_FATAL;

    struct sigaction sa;
    memset(&sa, 0, sizeof sa);
    sa.sa_handler = on_signal;
    sigaction(SIGINT, &sa, NULL);
    sigaction(SIGTERM, &sa, NULL);
    signal(SIGPIPE, SIG_IGN);                               /* a broken pipe is a failed write, not a death */
    avformat_network_init();
    ingest_init();
    logj("info", "main", "worker_starting", "\"version\":\"%s\",\"protocol\":%d,\"heartbeat_ms\":%d,\"proof_build\":%s", WORKER_VERSION, CAPTURE_PROTOCOL_VERSION, heartbeat_ms, g_mux_extra ? "true" : "false");
    if (ipc_start(heartbeat_ms) < 0) { logj("error", "main", "THREAD_CREATE_FAILED", "%s", ""); log_close(); return EXIT_FATAL; }

    /* The command loop. Lines are bounded: a frame of the protocol fits 4 bytes per character. */
    static char in[4 * MAX_FRAME_CHARS + 2];
    size_t have = 0;
    int64_t started_at = 0, socket_check_at = 0;
    const char *why = "stop";
    while (!atomic_load(&g_stop)) {
        struct pollfd p = { STDIN_FILENO, POLLIN, 0 };
        int ready = poll(&p, 1, 50);
        if (session_running && !started_at) started_at = mono_us();
        if (session_running) {
            int64_t age = mono_us() - started_at;
            int waiting = 0, connected = 0;
            for (int i = 0; i < NCAM; i++) {
                Cam *c = &S.cam[i];
                if (!c->present) continue;
                /* An ingest still opening long after its listen timeout: THAT camera is given up; the session goes on. */
                if (atomic_load(&c->state) == ING_WAITING && age > (int64_t)(g_listen_timeout_s + 10) * US) ingest_give_up(c);
                waiting += atomic_load(&c->state) == ING_WAITING;
                connected += atomic_load(&c->ever_connected);
            }
            /* Decision D72(k): a session in which NO camera connected within the ingest window is not
             * left running audio-only with nothing durable. It ends here, loudly; no file was created. */
            if (!connected && !waiting && !fatal_pending()) fatal("main", "NO_CAMERA_CONNECTED", AVERROR(ETIMEDOUT));
            /* Once a second: the process owns no datagram socket and no socket off 127.0.0.1 (finding F-11). */
            if (mono_us() - socket_check_at >= US) {
                const char *what = NULL;
                socket_check_at = mono_us();
                if (sockets_violation(&what)) fatal("main", what, AVERROR(EPERM));
            }
        }
        if (ready <= 0) continue;
        ssize_t got = read(STDIN_FILENO, in + have, sizeof in - 1 - have);
        if (got < 0 && errno == EINTR) continue;
        if (got <= 0) { why = "input_ended"; break; }       /* the supervisor closed the pipe, or is gone */
        have += (size_t)got;
        char *line = in, *nl;
        int bad = 0;
        while (!bad && (nl = memchr(line, '\n', have - (size_t)(line - in)))) {
            *nl = 0;
            if (nl > line && nl[-1] == '\r') nl[-1] = 0;
            /* A NUL inside a line would hide what follows it from the reader: such a line is no frame (finding F-9). */
            if (strlen(line) != (size_t)(nl - line) - (nl > line && nl[-1] == 0 && line + strlen(line) == nl - 1 ? 1 : 0)) bad = 1;
            else if (*line && on_line(line) < 0) bad = 1;
            line = nl + 1;
        }
        have -= (size_t)(line - in);
        memmove(in, line, have);
        if (bad || have >= sizeof in - 1) {
            /* What the supervisor wrote is no command: the two sides do not speak the same protocol. */
            logj("error", "main", "PROTOCOL_VIOLATION", "\"line_too_long\":%s", bad ? "false" : "true");
            pthread_mutex_lock(&g_fatal_mx);
            if (!g_fatal_code[0]) snprintf(g_fatal_code, sizeof g_fatal_code, "PROTOCOL_VIOLATION");
            pthread_mutex_unlock(&g_fatal_mx);
            g_exit_code = EXIT_PROTOCOL;
            why = "protocol_violation";
            break;
        }
    }
    if (ipc_broken()) why = "supervisor_gone";
    logj("info", "main", "worker_stopping", "\"why\":\"%s\"", why);
    /* From here the process ends within 10 s whatever a thread or the output pipe does (finding F-13). */
    pthread_t dog;
    if (!pthread_create(&dog, NULL, shutdown_watchdog, NULL)) pthread_detach(dog);
    if (session_served) session_close();
    if (fatal_pending()) g_exit_code = EXIT_FATAL;
    if (g_exit_code) {
        pthread_mutex_lock(&g_fatal_mx);
        if (session_served) ipc_send("\"type\":\"CRASH\",\"sessionId\":\"%s\",\"code\":\"%s\",\"signal\":null,\"exitCode\":%d", S.id, g_fatal_code, g_exit_code);
        else ipc_send("\"type\":\"CRASH\",\"sessionId\":null,\"code\":\"%s\",\"signal\":null,\"exitCode\":%d", g_fatal_code, g_exit_code);
        pthread_mutex_unlock(&g_fatal_mx);
    }
    ipc_stop();
    logj(g_exit_code ? "error" : "info", "main", "worker_exit", "\"rc\":%d,\"code\":\"%s\"", g_exit_code, g_fatal_code);
    log_close();
    return g_exit_code;
}
