# DEMS capture worker (blueprint rows 111 and 58; Q-WORKER answer (a), D24).
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
#   make unit       unit checks of the pure parts: the slew limit and the clock telemetry
#                   (test/anchor_test.c; its red run is the same file with -DOLD_SLEW), and the
#                   camera file under kill -9 (test/sink_kill_test.c, 200 kills)
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

.PHONY: all clean check selftest versions proof unit

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

unit:
	@mkdir -p $(BUILD)
	@$(CC) -std=c11 -O1 -Wall -Wextra -Werror -o $(BUILD)/anchor_test test/anchor_test.c src/anchor.c -lm && $(BUILD)/anchor_test
	@$(CC) -std=c11 -O1 -Wall -Wextra -Werror -DOLD_SLEW -o $(BUILD)/anchor_test_old test/anchor_test.c src/anchor.c -lm && { $(BUILD)/anchor_test_old >/dev/null && { echo "anchor_test: the old slew rule passes: the test cannot fail"; exit 1; } || echo "anchor_test: the old slew rule fails it, as required (negative control)"; }
	@$(CC) $(CFLAGS) -o $(BUILD)/sink_kill_test test/sink_kill_test.c src/sink.c $(LDLIBS) && $(BUILD)/sink_kill_test $(BUILD)/sink_kill 200

versions:
	@$(PKG_CONFIG) --modversion $(LIBS_PC)
	@$(PKG_CONFIG) --variable=libdir libavformat

clean:
	rm -rf $(BUILD)
