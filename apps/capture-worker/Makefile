# DEMS capture worker (blueprint rows 111, 58 and 59; Q-WORKER answer (a), D24).
# Links the FFmpeg that is already installed; installs nothing. Output goes to build/ (git-ignored).
# Run from the repository root:  make -C apps/capture-worker
#
#   make            static rules (check + their self-test), then build/capture-worker
#   make check      the static rules over src/ (M3-SR-2, row 58 part)
#   make selftest   the same rules over planted sources: each MUST fail (negative controls)
#   make proof      PROOF BUILDS, never installed and never started by the Core:
#                     build/capture-worker-negctl   the pinned flags plus ONE forbidden mux option
#                                                   (the negative control of the AV checks)
#                     build/capture-worker-delaymoov the delay_moov variant measured in part P4
#                     build/capture-worker-norefusal a worker that does NOT recognise the refused
#                                                   transport (fix round 1, F-2: the damage must stay bounded)
#                     build/capture-worker-nocomp    no mic clock compensation: the negative control of the slow-mic check (F-4)
#                     build/capture-worker-writefault        the write of fragment 3 of camera 1 comes back short, then
#                                                            fails (row 59: the file must be back at its last good length)
#                     build/capture-worker-writefault-notrunc the same without the truncation: the negative control
#                                                            (the torn tail stays; the tail validation must flag it)
#   make fixtures   the NM-14 fixture set from test-fixtures/ (fake camera, fake mics, the vendored
#                   row-111 skeleton used as the negative control of the socket check)
#   make e2e        THE capture end-to-end series with one aggregate exit code (test/e2e.py; sandbox
#                   off; outside `npm test`; re-run after any FFmpeg upgrade)
#   make unit       unit checks of the pure parts: the slew limit and the clock telemetry
#                   (test/anchor_test.c; its red run is the same file with -DOLD_SLEW), and the
#                   camera file under kill -9 (test/sink_kill_test.c, 200 kills), the fMP4 writer
#                   (test/writer_test.c: chains re-derived from the file, failed and short writes;
#                   its red run is the same file with -DDEMS_PROOF_KEEP_TORN_TAIL) and the per-source
#                   log quota (test/log_test.c; its red run: -DLOG_SHARED_QUOTA)
CC         := clang
PKG_CONFIG ?= pkg-config
LIBS_PC    := libavformat libavcodec libavfilter libswresample libavutil
CFLAGS     ?= -std=c11 -O2 -g -Wall -Wextra -Werror
CFLAGS     += $(shell $(PKG_CONFIG) --cflags $(LIBS_PC))
LDLIBS     := $(shell $(PKG_CONFIG) --libs $(LIBS_PC)) -lm -lpthread

BUILD := build
BIN   := $(BUILD)/capture-worker
SRC   := src/capture_worker.c src/ipc.c src/sink.c src/ingest.c src/audio.c src/anchor.c
HDR   := src/worker.h src/anchor.h

FIXTURES := $(BUILD)/fake_cam $(BUILD)/fake_mic $(BUILD)/capture-worker-skeleton111 $(BUILD)/writer_replay

.PHONY: all clean check selftest versions proof unit fixtures e2e

all: check selftest unit $(BIN)

$(BIN): $(SRC) $(HDR) Makefile
	@mkdir -p $(BUILD)
	$(CC) $(CFLAGS) -o $@ $(SRC) $(LDLIBS)

check:
	@sh check.sh src

selftest:
	@sh check.sh --selftest

# The ONE occurrence of a forbidden mux option outside the planted sources of the self-test: the
# negative control of M3-AV-1/2 (capture spec C.4). It shifts the whole video track by about
# 450 ms while the file still decodes. check.sh holds this file to exactly this one line.
proof: check
	@mkdir -p $(BUILD)
	$(CC) $(CFLAGS) -DDEMS_PROOF_MUX_EXTRA='"use_editlist=1"' -o $(BUILD)/capture-worker-negctl $(SRC) $(LDLIBS)
	$(CC) $(CFLAGS) -DDEMS_PROOF_MUX_EXTRA='""' -DDEMS_MOVFLAGS='"+frag_keyframe+delay_moov+default_base_moof+skip_trailer"' -o $(BUILD)/capture-worker-delaymoov $(SRC) $(LDLIBS)
	$(CC) $(CFLAGS) -DDEMS_PROOF_MUX_EXTRA='""' -DDEMS_PROOF_NO_REFUSAL_EXIT -o $(BUILD)/capture-worker-norefusal $(SRC) $(LDLIBS)
	$(CC) $(CFLAGS) -DDEMS_PROOF_MUX_EXTRA='""' -DMIC_MAX_PPM=0 -o $(BUILD)/capture-worker-nocomp $(SRC) $(LDLIBS)
	$(CC) $(CFLAGS) -DDEMS_PROOF_MUX_EXTRA='""' -DDEMS_PROOF_WRITE_FAULT=3 -o $(BUILD)/capture-worker-writefault $(SRC) $(LDLIBS)
	$(CC) $(CFLAGS) -DDEMS_PROOF_MUX_EXTRA='""' -DDEMS_PROOF_WRITE_FAULT=3 -DDEMS_PROOF_KEEP_TORN_TAIL -o $(BUILD)/capture-worker-writefault-notrunc $(SRC) $(LDLIBS)

unit:
	@mkdir -p $(BUILD)
	@$(CC) -std=c11 -O1 -Wall -Wextra -Werror -o $(BUILD)/anchor_test test/anchor_test.c src/anchor.c -lm && $(BUILD)/anchor_test
	@$(CC) -std=c11 -O1 -Wall -Wextra -Werror -DOLD_SLEW -o $(BUILD)/anchor_test_old test/anchor_test.c src/anchor.c -lm && { $(BUILD)/anchor_test_old >/dev/null && { echo "anchor_test: the old slew rule passes: the test cannot fail"; exit 1; } || echo "anchor_test: the old slew rule fails it, as required (negative control)"; }
	@$(CC) -std=c11 -O1 -Wall -Wextra -Werror -DNO_TICK -o $(BUILD)/anchor_test_notick test/anchor_test.c src/anchor.c -lm && { $(BUILD)/anchor_test_notick >/dev/null && { echo "anchor_test: without the tick on report-less packets the test passes: the R-1 check cannot fail"; exit 1; } || echo "anchor_test: without the tick on report-less packets it fails, as required (negative control, R-1)"; }
	@$(CC) $(CFLAGS) -o $(BUILD)/sink_kill_test test/sink_kill_test.c src/sink.c $(LDLIBS) && $(BUILD)/sink_kill_test $(BUILD)/sink_kill 200
	@$(CC) $(CFLAGS) -o $(BUILD)/writer_test test/writer_test.c src/sink.c $(LDLIBS) && $(BUILD)/writer_test $(BUILD)/writer_scratch
	@$(CC) $(CFLAGS) -DDEMS_PROOF_KEEP_TORN_TAIL -o $(BUILD)/writer_test_notrunc test/writer_test.c src/sink.c $(LDLIBS) && { $(BUILD)/writer_test_notrunc $(BUILD)/writer_scratch_notrunc > $(BUILD)/writer_test_notrunc.out; rc=$$?; \
	  n=$$(grep -c 'FAILED: .*TRUNCATION' $(BUILD)/writer_test_notrunc.out); o=$$(grep 'FAILED: ' $(BUILD)/writer_test_notrunc.out | grep -vc 'TRUNCATION'); \
	  if [ $$rc -ne 0 ] && [ $$n -ge 2 ] && [ $$o -eq 0 ]; then echo "writer_test: without the truncation it fails on the $$n truncation checks and on nothing else, as required (negative control)"; \
	  else echo "writer_test: the build without truncation gave rc $$rc, $$n truncation failures, $$o other failures: the truncation check cannot fail, or fails for another reason"; cat $(BUILD)/writer_test_notrunc.out; exit 1; fi; }
	@$(CC) $(CFLAGS) -o $(BUILD)/log_test test/log_test.c src/ipc.c $(LDLIBS) && $(BUILD)/log_test $(BUILD)/log_test.jsonl
	@$(CC) $(CFLAGS) -DLOG_SHARED_QUOTA -o $(BUILD)/log_test_shared test/log_test.c src/ipc.c $(LDLIBS) && { $(BUILD)/log_test_shared $(BUILD)/log_test_shared.jsonl >/dev/null && { echo "log_test: with one shared quota the test passes: the per-source check cannot fail"; exit 1; } || echo "log_test: with one shared quota it fails, as required (negative control, R-4)"; }

# NM-14 fixture set (blueprint row 60; capture spec A.8): the fake camera, the fake mics and the
# vendored row-111 skeleton that M3-RTSP-BIND-1 must fail on. Sources in test-fixtures/ only.
fixtures: $(FIXTURES)

$(BUILD)/fake_cam: test-fixtures/fake_cam.c Makefile
	@mkdir -p $(BUILD)
	$(CC) -O2 -Wall -Wextra -o $@ $< $(shell $(PKG_CONFIG) --cflags --libs libavformat libavcodec libavutil) -lm

$(BUILD)/fake_mic: test-fixtures/fake_mic.c Makefile
	@mkdir -p $(BUILD)
	$(CC) -std=c11 -O2 -Wall -Wextra -Werror -o $@ $< -lm

# Row 59: the bytes of a recorded camera file through the writer again (the chain-equality check of the e2e series).
$(BUILD)/writer_replay: test/writer_replay.c src/sink.c $(HDR) Makefile
	@mkdir -p $(BUILD)
	$(CC) $(CFLAGS) -o $@ test/writer_replay.c src/sink.c $(LDLIBS)

$(BUILD)/capture-worker-skeleton111: test-fixtures/negative-control/skeleton111.c Makefile
	@mkdir -p $(BUILD)
	$(CC) -std=c11 -O2 -o $@ $< $(shell $(PKG_CONFIG) --cflags --libs libavformat libavcodec libavfilter libavutil) -lm -lpthread

# THE capture end-to-end target: the whole series on the fixtures, every check and every negative
# control twice, ONE aggregate exit code (0 only when every verdict is the expected one). It binds
# two loopback ports of 8554-8564 (sandbox off), takes about 35 minutes on an idle host, and is
# NOT part of `npm test`. Re-run it after any FFmpeg upgrade. See README.md, "How to run the
# capture e2e". Options go through E2E_ARGS, e.g. make e2e E2E_ARGS="--only av1_ --runs 1".
# It takes the shared heavy-host lock (.locks/heavy-host.lock at the repository root, /usr/bin/lockf,
# waits up to 30 minutes, exit 75 if it cannot be had) so that it never overlaps an STT engine run
# or another series. A caller that already holds the lock passes E2E_NO_LOCK=1.
e2e:
	@E2E_NO_LOCK=$(E2E_NO_LOCK) python3 test/e2e.py $(E2E_ARGS)

versions:
	@$(PKG_CONFIG) --modversion $(LIBS_PC)
	@$(PKG_CONFIG) --variable=libdir libavformat

clean:
	rm -rf $(BUILD)
