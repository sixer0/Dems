---
task_id: 2026-10-21_bare_metal_bench
row: 9 (source Q11)
date: 2026-10-22
agent: data-collector
tier: 2
---
# FFmpeg 9.0.2 release archive, signature and signing key (Q11)

## Result
9.0.2 IS published on ffmpeg.org (https://ffmpeg.org/download.html lists "FFmpeg 9.0.2 Lei", 9.0 branch; the page also lists 8.1.3, dated 2026-09-21, later than 9.0.2 dated 2026-09-18).

| Item | Value | Source |
|---|---|---|
| Archive (.tar.xz) | https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz | download.html (WebFetch 2026-10-22) |
| Detached signature | https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz.asc | download.html; the URL returns "-----BEGIN PGP SIGNATURE-----" |
| Release signing key file | https://ffmpeg.org/ffmpeg-devel.asc | download.html; returns "-----BEGIN PGP PUBLIC KEY BLOCK-----" |
| Release key fingerprint | FCF986EA15E6E293A5644F10B4322F04D67658D8 | download.html; RSA 2048, created 2011-04-26, uid "FFmpeg release signing key <ffmpeg-devel@ffmpeg.org>" |
| Git-tag key (not for tarballs) | DD1EC9E8DE085C629B3E1846B18E8928B3948D64 (EdDSA, git-tag-key.asc) | download.html |
| Post-quantum signatures | 9.0.2 also has .pq.asc files (ML-DSA-87+Ed448, SLH-DSA-256s); GnuPG cannot verify them, page recommends sq 1.4+ | download.html |

Not collected: no SHA-256 from ffmpeg.org (download.html as fetched named none). The repo pins one (below); I did not recompute it.

## Repo pin and expectations (cited)
- Version pin: `ARG FFMPEG_VERSION=9.0.2`, prefix `/opt/dems/ffmpeg-9.0.2` (deploy/docker/Dockerfile:56,59). Library expectation libavformat 63.1.102 (Dockerfile:88; scripts/host/HOST-PROFILE-UBUNTU-24.04.md:69).
- Repo pinned key fingerprint: `FFMPEG_KEY_FINGERPRINT=FCF986EA15E6E293A5644F10B4322F04D67658D8` (Dockerfile:58) - identical to the one published on ffmpeg.org. Pinned `FFMPEG_SHA256=8c3850283eb25fa026482078a04051e0be17347b09ef81a0849bec15a96e002e` (Dockerfile:57; comment lines 54-55: read twice on 2026-10-13, own download plus Homebrew formula).
- Repo fetch and verify flow uses the same three URLs and checks `VALIDSIG <fingerprint>` (Dockerfile:62-69).
- Configure line (HOST-12): `./configure --prefix=<ffmpeg-prefix> --enable-shared --disable-static --disable-doc --enable-indev=alsa`, then `make -j"$(nproc)"`, `sudo make install` (scripts/host/HOST-PROFILE-UBUNTU-24.04.md:69; same in deploy/docker/Dockerfile:73). No --enable-gpl / --enable-nonfree / --enable-version3 flags anywhere in scripts/host, apps/capture-worker or the Dockerfile (grep, no hits), i.e. default (LGPL) configure.
- Licence decision: open. HOST-PROFILE-UBUNTU-24.04.md:69 "the licence of the build is the user's open decision"; :270 "The capture series was verified on another build of the same version; the licence of the build that ships is the user's open decision". scripts/host/90-activation-final.sh:43 lists the same open point. deploy/docker/README.md:37 and Dockerfile:17 mention a separate GPL test-fixture FFmpeg (x264/x265) in the check container, not the shipped build.
- Host step wording: HOST-12 gate says "after the user has compared the archive's checksum with the publisher's" (HOST-PROFILE:69).

## Unknowns
- GPL vs LGPL choice for the shipped build is undecided; the configure line as written yields the default LGPL build.
- ffmpeg.org page gives no archive checksum; independent checksum comparison rests on the 2026-10-13 repo note.
- Fingerprint was read via WebFetch summarisation of download.html; the key block itself was not imported/inspected (no gpg run).
