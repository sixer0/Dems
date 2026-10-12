#!/bin/bash
# DEMS Core host profile, part 1: before anything is installed (HOST-01 to HOST-03).
# Items of scripts/host/HOST-PROFILE-UBUNTU-24.04.md, section 3.1.
# This script only prints: the three items have no command. UNPROVEN ON LINUX.
set -eu
HP_SCRIPT=10-preflight.sh
HP_ITEMS='HOST-01 to HOST-03'
HP_APPLY_SUPPORTED=0
case "$0" in */*) HP_DIR=${0%/*} ;; *) HP_DIR=. ;; esac
# shellcheck source=host-profile-lib.sh
. "$HP_DIR/host-profile-lib.sh"
hp_init "$@"

item HOST-01 NONE 'The host runs Ubuntu 24.04 LTS'
why <<'EOF'
a fresh installation; nothing to run
EOF
check <<'EOF'
lsb_release -ds   -> a line that starts with "Ubuntu 24.04"
uname -m          -> recorded
EOF
confirm '9A/H-01 (the processor architecture is not ruled in any design document)'

item HOST-02 NONE 'No input-av installation is on the host'
why <<'EOF'
if one is found, removing it is the user's action before the profile is applied
EOF
check <<'EOF'
systemctl list-unit-files 'dems-nvr*' 'dems-mediamtx*'   -> ends with "0 unit files listed."
sudo ls /usr/local/sbin/dems-netalias /etc/sudoers.d/dems-netalias   -> "No such file or directory" twice
EOF
confirm '9A/H-27 (where input-av wrote its ALSA configuration is named there)'

item HOST-03 NONE 'The host has no interactive account besides its one administrator'
why <<'EOF'
other accounts are removed or locked by the user
EOF
check <<'EOF'
awk -F: '$7 !~ /nologin$/ && $7 !~ /false$/ {print $1}' /etc/passwd   -> root, sync and the one administrator account, nothing else
EOF
confirm '9A/H-01'

hp_done
