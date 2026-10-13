# The announce-line probe of experiment E-11b, carried into the hardware acceptance package

**Status: UNPROVEN ON LINUX.** The probe has run on the development Mac only (Homebrew libavformat 63.1.102, 18 runs, `docs/2026-10-12_input_av_core_adapter_plan/test/007_e11b_announced_path.md`). On the acceptance host it is run by the user, through `collect-h01.sh --announce`, as step `9A/H-01.10` of chapter 2. No agent is needed for any line below.

## Ringkasan (Bahasa Indonesia)

Berkas `probe.c` adalah program uji kecil dari eksperimen E-11b. Program ini membuka pendengar RTSP dengan cara yang sama seperti worker perekam, lalu mencetak setiap pesan log pustaka media. Worker hanya menerima kamera bila pustaka memancarkan tepat satu baris `Parsing[<n>]: ANNOUNCE <alamat> RTSP/1.0` (level 56) selama pembukaan. Apakah pustaka hasil build di host Ubuntu memancarkan baris yang sama belum pernah dibuktikan; pemeriksaan `9A/H-01` langkah `.10` membuktikannya dengan program ini. Bila baris itu tidak ada atau berbeda, tidak ada kamera yang dapat direkam di host tersebut dan cabang C berlaku. Program ini hanya mendengarkan di `127.0.0.1`, tidak mengubah apa pun di host, dan dijalankan oleh pengguna.

## Why this file is here

| | |
|---|---|
| What | `probe.c`: the source of the E-11b probe, 166 lines, byte for byte the text printed in the appendix of `test/007_e11b_announced_path.md` (SHA-256 `6ed2cbdaf1bf2b428831c260d1e42bb2a9c40c6898c9d13ff2ee79697bf7bf1b`, the hash that record states) |
| Why here | Until now the source lay only under the git-ignored `.cache/e11b-probe/` and in that appendix. Step `9A/H-01.10` needs it on the host. Its first comment line still says "git-ignored": the text was not edited, so that the hash stays the one of the record |
| Who runs it | The user, on the acceptance host, after `HOST-12` (the pinned FFmpeg under `<ffmpeg-prefix>`) |
| What it decides | Nothing. `collect-h01.sh --announce` prints observations; chapter 2, `9A/H-01`, criterion 4 is held against them by the user |

## Build line for the host

`collect-h01.sh --announce` builds it by itself into a work folder inside the evidence folder and removes that folder at the end. By hand, from the product tree, as an ordinary account:

```
PKG_CONFIG_PATH=<ffmpeg-prefix>/lib/pkgconfig \
  cc -std=c11 -O2 -o <evidence-folder>/probe scripts/hardware-acceptance/e11b-announce-probe/probe.c \
  $(PKG_CONFIG_PATH=<ffmpeg-prefix>/lib/pkgconfig pkg-config --cflags --libs libavformat libavcodec libavutil) -lm -lpthread
LD_LIBRARY_PATH=<ffmpeg-prefix>/lib ldd <evidence-folder>/probe     # libavformat.so.63 must resolve under <ffmpeg-prefix>/lib
```

On the Mac it was built with `clang -std=c11 -O2 -g -Wall -Wextra -Werror`. The host line leaves `-Werror` out: a warning of another compiler must not stop the acceptance; a build that fails is recorded as "probe did not build" and criterion 4 is then not met.

## Running it (step `9A/H-01.10`)

```
bash scripts/hardware-acceptance/collect-h01.sh --announce --evidence <evidence-folder> --ffmpeg-prefix <ffmpeg-prefix>
```

It runs the probe six times in `observe` mode on `127.0.0.1` port 18563 (`--port` changes it; ports 8554 to 8564 are refused, the loopback rule of `HOST-25` guards them), three times with a pusher that announces the listener's own path and three times with the last-character near miss. By hand, one run:

```
LD_LIBRARY_PATH=<ffmpeg-prefix>/lib <evidence-folder>/probe 18563 e11b/Hs3kP9wQ2nVb7Xc5 observe 12 Hs3kP9wQ2nVb7Xc2 > run.probe &
<ffmpeg-prefix>/bin/ffmpeg -hide_banner -nostdin -loglevel trace -re -f lavfi -i testsrc2=size=320x240:rate=25 \
  -frames:v 100 -an -pix_fmt yuv420p -g 25 -bf 0 -c:v mpeg4 -f rtsp -rtsp_transport tcp \
  rtsp://127.0.0.1:18563/e11b/Hs3kP9wQ2nVb7Xc5 > run.push 2>&1          # the near miss ends in ...Xc2
```

The two path texts are synthetic and of this package only. The collector prints them as `<right>` and `<wrong>`.

**The pusher.** The development pushed with `libx264`. The configure line of `HOST-12` builds no H.264 or H.265 encoder (open point B of chapter 2). The collector therefore pushes with the encoder `mpeg4`, which FFmpeg carries itself, and a generated test picture. The announce line is produced while the `ANNOUNCE` request is read, before any media, so the codec does not bear on it; that this pusher completes the handshake and delivers 25 packets on the host's build is itself unproven. `--codec libx264 --pusher <path>` uses another FFmpeg if the site has one.

## What to read (the announce-gate repeat of BR-10)

Gate BR-10 (`verification/05_security_branch_b.md`): on the Ubuntu build "the line has the same text, level and instant". The collector prints per run, and chapter 2 expects:

| Reading | Expected in all 6 runs | On the Mac (test/007) |
|---|---|---|
| lines `Parsing[<n>]: ANNOUNCE <address> RTSP/1.0` | exactly 1 | 1 in 18 of 18 |
| its level | 56 | 56 |
| `<n>` equals the length of the request line | yes | yes (60 or 61) |
| the request line equals what the pusher sent | yes | yes, nothing normalised |
| inside `avformat_open_input`, before the answer to `ANNOUNCE` | yes | 0.0 to 0.2 ms before the answer |
| lines `Updating control URI to` | 1 in the 3 wrong-path runs, 0 in the 3 right-path runs | 12 of 12 and 0 of 6 |
| statuses the pusher read | 200 four times | 200 four times |
| packets the probe read | 25 | 25 |

If the line is missing or differs: chapter 2, `9A/H-01`, "If not met", criterion 4. The worker then refuses every push on this host, the right one too; branch C applies without a further security review. If the library refuses a wrong-path push by itself with an RTSP error status, that is recorded as seen and is not a fail of the criterion.

**What the probe does not show.** The worker's gate compares the whole message, its ending newline included, in constant time (`apps/capture-worker/src/announce.c`); the probe strips line ends before it prints. That the worker itself accepts the right push and refuses the others on this host is shown only by the worker's own series, steps `9A/H-01.9` and `.11`.

## The E-11 near-miss observations to repeat (test/006)

On the Mac library the listener accepted a push to another path: 18 of 21 near-miss pushes were recorded, 3 (trailing slash) ended at `SETUP` without a status, none was refused with an RTSP error status. The seven near misses, each derived from the listener's own path:

| # | Near miss | Mac outcome without the gate |
|---|---|---|
| 1 | last character changed | accepted, recorded |
| 2 | strict prefix (the last 8 characters dropped) | accepted, recorded |
| 3 | one more path component | accepted, recorded |
| 4 | letter case changed | accepted, recorded |
| 5 | trailing slash | connection closed at `SETUP`, nothing recorded, no error status |
| 6 | query string added | accepted, recorded |
| 7 | first character percent-encoded | accepted, recorded |

Since the worker's gate was built (row 58), each of the seven must be **refused by the worker** (no connect report, 0 bytes) while the control camera of the same session records. On the host this is step `9A/H-01.9`: `make -C apps/capture-worker e2e`, whose output is saved to a file and read by `collect-h01.sh --series` (step `.11`). The collector prints the result line of every permanent case of the gate, the count of unexpected verdicts, the aggregate exit code, and the count of lines of the worker's log and output that hold a stream address (expected 0).

Two further facts of test/006 and test/007 that a reader of the host's result should know: a listener takes one connection and does not listen again (a second client is turned away below RTSP); and a client that completes the handshake through `RECORD` with parameter sets, sends no media and closes ended the whole worker with exit code 70 before row 176 changed that. Neither is repeated by this probe.

## Open for the host (to the frame chapter's owner)

1. The worker's series (`make e2e`) and its fixtures push with `libx264`; the host's FFmpeg of `HOST-12` has none. Until a pusher for the series is named, steps `.9` and `.11` may be "not run", and criterion 5 is then not met.
2. The names of the permanent cases in the series are fixed by the rows that add them; `collect-h01.sh --series` selects them by words in the name and says so in its output.
