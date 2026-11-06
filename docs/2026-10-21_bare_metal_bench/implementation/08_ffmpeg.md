# Row 28: FFmpeg 9.0.2 LGPL into /opt/dems/ffmpeg-9.0.2 (HOST-12, -13)

Date: 2026-10-22, host .73 (D30). Commands: masterplan/02_plan.md row 28 verbatim.
- Pre: root_used_pct=9. Signature: VALIDSIG FCF986EA15E6E293A5644F10B4322F04D67658D8 count `1`; `ffmpeg-9.0.2.tar.xz: OK` (register sha256 8c385028...e002e).
- Build unit `dems-host-build-row28` (User=gsp-dems): exit `0`. Install log `/var/log/dems-host-build-row28-install.log`.
- Checks: `ffmpeg version 9.0.2 ...`; libavformat 63.1.102 `1`; alsa input device `1`; LGPL `1`; ldconfig resolves libavformat.so.63 to the prefix `1`; group/other-writable or non-root in prefix `0`; file A `/etc/ld.so.conf.d/dems-ffmpeg.conf` `root:root 644`. All as expected.
