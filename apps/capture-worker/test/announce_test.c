/*
 * Unit check of the announced address of an ingest (src/announce.c; task 4 blueprint row 58, BR-01, BR-02).
 * `make -C apps/capture-worker unit` runs it. Pure: no worker, no port, no library of FFmpeg.
 *
 * The messages are built here the way libavformat 63.1.102 builds them ("Parsing[<length>]: <line>" and a
 * newline, test/007 of task 4), from SYNTHETIC addresses: nothing of a session.
 *
 * The check cannot pass by refusing everything (the right message must PASS, alone, among the other messages
 * of a real open) and cannot pass by accepting everything (each near miss, the absent line, the second line,
 * the cut message and the other camera's line must NOT pass).
 */
#include "../src/announce.h"

#include <stdio.h>
#include <string.h>

static int failed, checks;
#define CHECK(cond, what) do { checks++; if (!(cond)) { failed++; printf("announce_test: FAILED: %s\n", what); } } while (0)

static const char RIGHT[] = "rtsp://127.0.0.1:8559/u58/Tq4mZ8rK1vNc6Lx3";
static const char OTHER_CAMERA[] = "rtsp://127.0.0.1:8561/u58/Bh7dW2sJ9yGf5Pn0";

/* The message the library hands over for one line it read. */
static size_t parsing(char *out, size_t cap, const char *line) {
    return (size_t)snprintf(out, cap, "Parsing[%d]: %s\n", (int)strlen(line), line);
}
static size_t announce_of(char *out, size_t cap, const char *address) {
    char line[ANNOUNCE_MESSAGE_CHARS];
    snprintf(line, sizeof line, "ANNOUNCE %s RTSP/1.0", address);
    return parsing(out, cap, line);
}
static int see(AnnounceGate *g, const char *text) { return announce_gate_observe(g, text, strlen(text), 1); }

/* The messages of an open that are no ANNOUNCE line: they must change nothing. */
static void see_the_rest(AnnounceGate *g, const char *address) {
    char m[ANNOUNCE_MESSAGE_CHARS], line[ANNOUNCE_MESSAGE_CHARS];
    snprintf(line, sizeof line, "OPTIONS %s RTSP/1.0", address);
    parsing(m, sizeof m, line);
    CHECK(see(g, m) == 0, "an OPTIONS line is no ANNOUNCE line");
    CHECK(see(g, "Parsing[7]: CSeq: 1\n") == 0, "a header line is no ANNOUNCE line");
    CHECK(see(g, "Sending response:\nRTSP/1.0 200 OK\r\nCSeq: 1\r\nPublic: ANNOUNCE, PAUSE, SETUP, TEARDOWN, RECORD\r\n\r\n") == 0, "the answer to OPTIONS names the method and is no ANNOUNCE line");
    snprintf(line, sizeof line, "SETUP %s/streamid=0 RTSP/1.0", address);
    parsing(m, sizeof m, line);
    CHECK(see(g, m) == 0, "a SETUP line is no ANNOUNCE line");
}

static int open_with(const char *expected_address, const char *announced_address) {
    AnnounceGate g;
    char m[ANNOUNCE_MESSAGE_CHARS];
    announce_gate_reset(&g, expected_address);
    see_the_rest(&g, announced_address);
    announce_of(m, sizeof m, announced_address);
    see(&g, m);
    see_the_rest(&g, announced_address);
    return announce_gate_passed(&g);
}

int main(void) {
    AnnounceGate g;
    char m[2 * ANNOUNCE_MESSAGE_CHARS], right[ANNOUNCE_MESSAGE_CHARS], near[512];

    /* (1) The right address passes, and only after its line was seen. */
    announce_gate_reset(&g, RIGHT);
    CHECK(!announce_gate_passed(&g), "(1) nothing passes before a line was seen");
    CHECK(g.expected_len == strlen("Parsing[60]: ANNOUNCE  RTSP/1.0\n") + strlen(RIGHT) && strlen(RIGHT) + 18 == 60, "(1) the number in the brackets is the length of the expected line");
    see_the_rest(&g, RIGHT);
    CHECK(!announce_gate_passed(&g), "(1) an open without an ANNOUNCE line does not pass (LINE ABSENT)");
    size_t right_len = announce_of(right, sizeof right, RIGHT);
    CHECK(see(&g, right) == 0 && announce_gate_passed(&g), "(1) the right address passes");
    see_the_rest(&g, RIGHT);
    CHECK(announce_gate_passed(&g), "(1) the other messages of the open leave it passed");
    CHECK(open_with(RIGHT, RIGHT) == 1 && open_with(OTHER_CAMERA, OTHER_CAMERA) == 1, "(1) each camera passes with its own line");

    /* (2) The seven near misses of AD-01 (2), as written on the wire: none passes, each ends the open early. */
    static const char *const kinds[7] = { "last character", "strict prefix", "one more component", "letter case", "trailing slash", "query string", "percent-encoded character" };
    static const char *const misses[7] = {
        "rtsp://127.0.0.1:8559/u58/Tq4mZ8rK1vNc6Lx4", "rtsp://127.0.0.1:8559/u58/Tq4mZ8rK", "rtsp://127.0.0.1:8559/u58/Tq4mZ8rK1vNc6Lx3/x", "rtsp://127.0.0.1:8559/u58/tq4mz8rk1vnc6lx3",
        "rtsp://127.0.0.1:8559/u58/Tq4mZ8rK1vNc6Lx3/", "rtsp://127.0.0.1:8559/u58/Tq4mZ8rK1vNc6Lx3?x=1", "rtsp://127.0.0.1:8559/u58/%54q4mZ8rK1vNc6Lx3" };
    for (int i = 0; i < 7; i++) {
        announce_gate_reset(&g, RIGHT);
        announce_of(m, sizeof m, misses[i]);
        snprintf(near, sizeof near, "(2) near miss '%s' does not pass and ends the open", kinds[i]);
        CHECK(see(&g, m) == 1 && !announce_gate_passed(&g) && g.lines == 1 && g.matches == 0, near);
        snprintf(near, sizeof near, "(2) near miss '%s' among the other messages of an open does not pass", kinds[i]);
        CHECK(open_with(RIGHT, misses[i]) == 0, near);
    }
    CHECK(open_with(RIGHT, "rtsp://localhost:8559/u58/Tq4mZ8rK1vNc6Lx3") == 0, "(2) the host written another way does not pass");

    /* (3) Attribution by content: the other camera's line never passes this camera, in both assignments. */
    CHECK(open_with(RIGHT, OTHER_CAMERA) == 0 && open_with(OTHER_CAMERA, RIGHT) == 0, "(3) the line of one camera does not pass the other");

    /* (4) Exactly one line: a second one refuses, equal or not, before or after. */
    announce_gate_reset(&g, RIGHT);
    see(&g, right);
    CHECK(see(&g, right) == 1 && !announce_gate_passed(&g), "(4) the right line twice does not pass");
    announce_gate_reset(&g, RIGHT);
    see(&g, right);
    announce_of(m, sizeof m, misses[0]);
    CHECK(see(&g, m) == 1 && !announce_gate_passed(&g), "(4) a differing line after the right one does not pass");
    announce_gate_reset(&g, RIGHT);
    see(&g, m);
    CHECK(see(&g, right) == 1 && !announce_gate_passed(&g), "(4) the right line after a differing one does not pass");
    announce_gate_reset(&g, RIGHT);
    see(&g, right);
    snprintf(m, sizeof m, "Parsing[%d]: ANNOUNCE-Extension: x\n", 21);
    CHECK(see(&g, m) == 1 && !announce_gate_passed(&g), "(4) a header line that reads like the method counts as a second line");

    /* (5) The library says it adopted another control address: refused, whatever else was seen. */
    announce_gate_reset(&g, RIGHT);
    see(&g, right);
    CHECK(see(&g, "Updating control URI to rtsp://127.0.0.1:8559/u58/other\n") == 1 && !announce_gate_passed(&g), "(5) an adopted other address does not pass");
    announce_gate_reset(&g, RIGHT);
    see(&g, "Updating control URI to rtsp://127.0.0.1:8559/u58/other\n");
    CHECK(see(&g, right) == 1 && !announce_gate_passed(&g), "(5) the right line after an adopted other address does not pass");

    /* (6) The whole message: no prefix, no part, no other length, no cut. */
    announce_gate_reset(&g, RIGHT);
    CHECK(announce_gate_observe(&g, right, right_len - 1, 1) == 1 && !announce_gate_passed(&g), "(6) the message without its last character does not pass");
    announce_gate_reset(&g, RIGHT);
    snprintf(m, sizeof m, "%s ", right);
    CHECK(see(&g, m) == 1 && !announce_gate_passed(&g), "(6) the message with one character more does not pass");
    announce_gate_reset(&g, RIGHT);
    snprintf(m, sizeof m, "Parsing[61]: ANNOUNCE %s RTSP/1.0\n", RIGHT);
    CHECK(see(&g, m) == 1 && !announce_gate_passed(&g), "(6) the right line under another number does not pass");
    announce_gate_reset(&g, RIGHT);
    snprintf(m, sizeof m, " %s", right);
    CHECK(see(&g, m) == 0 && !announce_gate_passed(&g), "(6) the message inside a longer one is no line at all");
    announce_gate_reset(&g, RIGHT);
    CHECK(announce_gate_observe(&g, right, right_len, 0) == 1 && !announce_gate_passed(&g), "(6) a message that did not fit its buffer does not pass, even with the right bytes");
    announce_gate_reset(&g, RIGHT);
    memset(m, 'x', sizeof m);
    memcpy(m, right, right_len - 1);                       /* the right line, then a tail that runs past the buffer */
    CHECK(announce_gate_observe(&g, m, ANNOUNCE_MESSAGE_CHARS - 1, 0) == 1 && !announce_gate_passed(&g), "(6) a line longer than the formatting buffer does not pass");

    /* (7) No expected message: nothing passes. */
    announce_gate_reset(&g, "");
    CHECK(g.expected_len == 0 && see(&g, "Parsing[18]: ANNOUNCE  RTSP/1.0\n") == 1 && !announce_gate_passed(&g), "(7) an empty address expects nothing");
    announce_gate_reset(&g, NULL);
    CHECK(g.expected_len == 0 && !announce_gate_passed(&g), "(7) no address expects nothing");
    memset(m, 'a', ANNOUNCE_ADDRESS_CHARS + 1);
    m[ANNOUNCE_ADDRESS_CHARS + 1] = 0;
    announce_gate_reset(&g, m);
    CHECK(g.expected_len == 0, "(7) an address longer than a plan's expects nothing");
    m[ANNOUNCE_ADDRESS_CHARS] = 0;
    CHECK(open_with(m, m) == 1, "(7) the longest address of a plan still passes with its own line");

    /* (8) A reset forgets the open before it. */
    announce_gate_reset(&g, RIGHT);
    see(&g, right);
    announce_gate_reset(&g, RIGHT);
    CHECK(!announce_gate_passed(&g) && g.lines == 0 && g.matches == 0 && !g.adopted_other, "(8) what an earlier open showed does not count");

    /* (9) Row 175, BR-04 (3): the NAME of a refusal. "Not seen" only when nothing of an announce was shown; every
     * other open that may not pass is "not matched"; "passed" exactly when the gate passes. */
    announce_gate_reset(&g, RIGHT);
    CHECK(announce_gate_verdict(&g) == ANNOUNCE_NOT_SEEN, "(9) before any message: not seen");
    see_the_rest(&g, RIGHT);
    CHECK(announce_gate_verdict(&g) == ANNOUNCE_NOT_SEEN && !announce_gate_passed(&g), "(9) an open with every message but the ANNOUNCE line: not seen");
    see(&g, right);
    CHECK(announce_gate_verdict(&g) == ANNOUNCE_PASSED && announce_gate_passed(&g), "(9) the right line: passed");
    see(&g, right);
    CHECK(announce_gate_verdict(&g) == ANNOUNCE_NOT_MATCHED, "(9) the right line repeated: not matched");
    for (int i = 0; i < 7; i++) {
        announce_gate_reset(&g, RIGHT);
        announce_of(m, sizeof m, misses[i]);
        see(&g, m);
        snprintf(near, sizeof near, "(9) near miss '%s': not matched (a line was seen)", kinds[i]);
        CHECK(announce_gate_verdict(&g) == ANNOUNCE_NOT_MATCHED, near);
    }
    announce_gate_reset(&g, RIGHT);
    announce_of(m, sizeof m, OTHER_CAMERA);
    see(&g, m);
    CHECK(announce_gate_verdict(&g) == ANNOUNCE_NOT_MATCHED, "(9) the other camera's line: not matched");
    announce_gate_reset(&g, RIGHT);
    see(&g, "Updating control URI to rtsp://127.0.0.1:8559/u58/other\n");
    CHECK(announce_gate_verdict(&g) == ANNOUNCE_NOT_MATCHED, "(9) an adopted other address without a line: not matched (something was announced)");
    announce_gate_reset(&g, RIGHT);
    announce_gate_observe(&g, right, right_len, 0);
    CHECK(announce_gate_verdict(&g) == ANNOUNCE_NOT_MATCHED, "(9) a line that did not fit its buffer: not matched");
    announce_gate_reset(&g, "");
    CHECK(announce_gate_verdict(&g) == ANNOUNCE_NOT_SEEN, "(9) no expected message and no line: not seen");
    see(&g, "Parsing[18]: ANNOUNCE  RTSP/1.0\n");
    CHECK(announce_gate_verdict(&g) == ANNOUNCE_NOT_MATCHED, "(9) no expected message and a line: not matched");
    announce_gate_reset(&g, RIGHT);
    see(&g, right);
    announce_gate_reset(&g, RIGHT);
    CHECK(announce_gate_verdict(&g) == ANNOUNCE_NOT_SEEN, "(9) a reset forgets the verdict of the open before it");

    /* (10) Row 175, BR-04 (2): a text that names the plan's path is recognised (and then withheld from the log),
     * a text that does not is left alone - the check cannot pass by withholding everything. */
#define NAMES(address, text) announce_names_path(address, text, strlen(text))
    CHECK(NAMES(RIGHT, "WARNING: Path /u58/other differs from expected /u58/Tq4mZ8rK1vNc6Lx3\n") == 1, "(10) the whole path as a bare path is named");
    CHECK(NAMES(RIGHT, "Path u58/Tq4mZ8rK1vNc6Lx3") == 1, "(10) the whole path at the end of a text is named");
    CHECK(NAMES(RIGHT, "stream Tq4mZ8rK1vNc6Lx3 gone") == 1, "(10) the long element alone is named");
    CHECK(NAMES(RIGHT, "x/Tq4mZ8rK1vNc6Lx3/streamid=0") == 1, "(10) the long element inside another path is named");
    CHECK(NAMES(RIGHT, "RTSP: Unexpected Command in Idle State 4\n") == 0, "(10) an ordinary error message of the library is not withheld");
    CHECK(NAMES(RIGHT, "method SETUP failed: 461 Unsupported transport\n") == 0, "(10) another ordinary message is not withheld");
    CHECK(NAMES(RIGHT, "u58") == 0 && NAMES(RIGHT, "queue u58 full") == 0, "(10) a short element alone does not withhold a message");
    CHECK(NAMES(RIGHT, "Tq4mZ8rK1vNc6Lx") == 0 && NAMES(RIGHT, "tq4mz8rk1vnc6lx3") == 0, "(10) a part of the element, or the element in another case, is not the plan's text");
    CHECK(NAMES(RIGHT, "127.0.0.1:8559") == 0, "(10) host and port are not the path");
    CHECK(NAMES(OTHER_CAMERA, "expected /u58/Tq4mZ8rK1vNc6Lx3") == 0 && NAMES(OTHER_CAMERA, "expected /u58/Bh7dW2sJ9yGf5Pn0") == 1, "(10) each camera's own path, judged against each address");
    CHECK(NAMES("rtsp://127.0.0.1:8559/a", "a") == 1 && NAMES("rtsp://127.0.0.1:8559/a", "b") == 0, "(10) a whole path is named whatever its length");
    CHECK(NAMES("rtsp://127.0.0.1:8559/S-0001/VIDEO-01/Kq7xR2mV9tLc4Zp1Wd5nH8", "track VIDEO-01") == 1 && NAMES("rtsp://127.0.0.1:8559/S-0001/VIDEO-01/Kq7xR2mV9tLc4Zp1Wd5nH8", "id Kq7xR2mV9tLc4Zp1Wd5nH8.") == 1
          && NAMES("rtsp://127.0.0.1:8559/S-0001/VIDEO-01/Kq7xR2mV9tLc4Zp1Wd5nH8", "S-0001") == 0, "(10) three elements: each long one is named, the short one alone is not");
    CHECK(announce_names_path(RIGHT, "Tq4mZ8rK1vNc6Lx3", 15) == 0 && announce_names_path(RIGHT, "Tq4mZ8rK1vNc6Lx3", 16) == 1, "(10) only the characters handed over are read");
    CHECK(NAMES(NULL, "x") == 0 && NAMES("", "x") == 0 && NAMES("rtsp://127.0.0.1:8559", "8559") == 0 && NAMES("rtsp://127.0.0.1:8559/", "x") == 0 && announce_names_path(RIGHT, NULL, 0) == 0 && NAMES(RIGHT, "") == 0,
          "(10) no address, no path or no text names nothing");
    CHECK(NAMES("u58/Tq4mZ8rK1vNc6Lx3", "see u58/Tq4mZ8rK1vNc6Lx3") == 1, "(10) an address without a scheme is taken whole as the path");
#undef NAMES

    if (failed) { printf("announce_test: %d of %d checks FAILED\n", failed, checks); return 1; }
    printf("announce_test: all %d checks hold (the right ANNOUNCE message passes; 7 near misses, line absent, second line, adopted other address, cut or longer message, the other camera's line: none passes; a refusal is named not-matched or not-seen; a text that names the plan's path is recognised)\n", checks);
    return 0;
}
