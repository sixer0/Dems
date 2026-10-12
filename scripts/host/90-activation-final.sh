#!/bin/bash
# DEMS Core host profile, part 9: camera activation and the final check (HOST-48, HOST-49),
# then the 16 points the profile cannot settle without the host.
# Items of scripts/host/HOST-PROFILE-UBUNTU-24.04.md, sections 3.9 and 5.
# This script only prints: starting the Core is the user's step. UNPROVEN ON LINUX.
set -eu
HP_SCRIPT=90-activation-final.sh
HP_ITEMS='HOST-48 and HOST-49'
HP_APPLY_SUPPORTED=0
case "$0" in */*) HP_DIR=${0%/*} ;; *) HP_DIR=. ;; esac
# shellcheck source=host-profile-lib.sh
. "$HP_DIR/host-profile-lib.sh"
hp_init "$@"

item HOST-48 NONE 'A factory-new camera is activated in its own web page; the web console does not relay the page of a camera'
why <<'EOF'
nothing on the host: an installation step with the camera, from a browser on the Core host or on a laptop plugged into the camera switch
EOF
check <<'EOF'
the page of the camera opens from that browser while the temporary address is in place, and the camera then answers the factory-address scan
EOF
confirm '9A/H-13'

item HOST-49 MANUAL 'The start of the Core names no missing prerequisite of this profile'
manual <<'EOF'
sudo systemctl start dems-core.service   (the user's step, after every other item and after the database and the signing key exist)
EOF
check <<'EOF'
journalctl -u dems-core.service -b --no-pager   -> no line that names a missing host prerequisite
with one prerequisite removed on purpose, the start names exactly that one
EOF
confirm '9A/H-04'

# The open points of section 5 of the profile. No script settles one of them; each is printed
# with the check that does.
open_point() { # open_point <number> <point> <settled by>
  printf '   open %2s : %s\n' "$1" "$2"
  printf '   %-8s: to confirm in %s\n' '' "$3"
}

printf '\n== What these scripts cannot settle without the host (16 open points)\n'
open_point 1 'the sync level on the evidence disk (a weaker level is one CRITICAL alert per session, and a finding)' '9A/H-03'
open_point 2 'FFmpeg 9.0.2 configures and builds on Ubuntu 24.04 with the line of HOST-12, and that feature set carries the capture path' 'the Ubuntu 24.04 container build, then 9A/H-01'
open_point 3 'the worker, the relay and the guard compile and pass their own checks on Linux' 'the container build, then 9A/H-01'
open_point 4 'which FFmpeg version and which arping packages Ubuntu 24.04 really carries' 'the container build; 9A/H-25'
open_point 5 'the conflict check refuses an address that is taken, with the iputils tool' '9A/H-25'
open_point 6 'the short name in the process listing, and the detection of a leftover process after a killed Core' '9A/H-24'
open_point 7 'no child process outlives the Core, and which of the Core and the service manager ended the children' '9A/H-02 and 9A/H-24'
open_point 8 'search answers pass the firewall with the rule of HOST-23, on the camera subnet and from a factory subnet' '9A/H-12 and 9A/H-13'
open_point 9 'the loopback rule beside the firewall, after a restart, and how the start check of the Core can see it' '9A/H-01 and 9A/H-04'
open_point 10 'the real card listing, a stable identity after a re-plug, shared capture on both inputs, no sound server' '9A/H-07 and 9A/H-08'
open_point 11 'the Core records with NoNewPrivileges=yes, an empty capability set and the two groups, and the helper answers from inside that unit' '9A/H-05, 9A/H-06 and 9A/H-17'
open_point 12 'the crash collector and a core pattern that pipes to a program: whether HOST-35 alone is enough, side effects of HOST-37' '9A/H-01'
open_point 13 'the socket of the helper as the service manager creates it: owner, group, mode, refusal of another account' '9A/H-05'
open_point 14 'the time source at the site, and the start of the Core when none is reachable (HOST-32)' '9A/H-01'
open_point 15 'the listener of the worker refuses a push to a wrong path on the library build of this host' 'the container repeat, then 9A/H-01'
open_point 16 'the limits of the relay process (no core file, no new privileges) as observed in the process table during a session' 'the container run, then 9A/H-01'
printf '   %-8s: %s\n' note 'a result from a container is a container result and settles none of them for the host'

hp_done
