#!/bin/bash
# DEMS Core host profile, part 2: service user and directories (HOST-04 to HOST-08).
# Items of scripts/host/HOST-PROFILE-UBUNTU-24.04.md, section 3.2.
# Print-only by default. --apply (root, Ubuntu 24.04) runs the AUTO steps. UNPROVEN ON LINUX.
set -eu
HP_SCRIPT=20-user-dirs.sh
HP_ITEMS='HOST-04 to HOST-08'
HP_APPLY_SUPPORTED=1
case "$0" in */*) HP_DIR=${0%/*} ;; *) HP_DIR=. ;; esac
# shellcheck source=host-profile-lib.sh
. "$HP_DIR/host-profile-lib.sh"
hp_init "$@"
hp_need service-user install-dir data-dir

item HOST-04 AUTO 'A system account for the Core, without a login shell'
if [ "$HP_APPLY" = 1 ] && getent passwd "$HP_SERVICE_USER" >/dev/null 2>&1; then
  note <<'EOF'
the account <service-user> exists already; not created again
EOF
else
  act useradd --system --home-dir "$HP_DATA_DIR" --shell /usr/sbin/nologin "$HP_SERVICE_USER"
fi
check <<'EOF'
getent passwd <service-user>   -> one line that ends with /usr/sbin/nologin
EOF
confirm -

item HOST-05 AUTO 'The product tree belongs to root and is not writable by the service user'
act install -d -o root -g root -m 0755 "$HP_INSTALL_DIR"
manual <<'EOF'
then the tree is copied to <install-dir> as root (the user's step; not run by this script)
EOF
check <<'EOF'
namei -l <install-dir>/apps/capture-worker/build/capture-worker   -> every component: owner root, no w for group or others
EOF
confirm '9A/H-01'

item HOST-06 AUTO 'The data directory and the media store belong to the service user and are owner-only'
act install -d -o "$HP_SERVICE_USER" -g "$HP_SERVICE_USER" -m 0700 \
  "$HP_DATA_DIR" "$HP_DATA_DIR/media" "$HP_DATA_DIR/media/sessions"
check <<'EOF'
sudo stat -c '%U %G %a' <data-dir> <data-dir>/media/sessions   -> "<service-user> <service-user> 700" twice
a real-capture Core that starts does not report CAPTURE_EVIDENCE_STORE_UNUSABLE
EOF
confirm -

item HOST-07 NONE 'The evidence volume supports hard links, exclusive file creation and a durable sync'
why <<'EOF'
a property of the volume: a local Linux file system for <data-dir> (not a network share, not FAT or exFAT)
EOF
check <<'EOF'
findmnt -no FSTYPE,SOURCE --target <data-dir>/media/sessions   -> names the file system
the start of the Core does not report the reasons NO_HARD_LINKS or NO_SYNC
EOF
confirm '9A/H-03 (the sync level the worker states on this disk; open point 1)'

item HOST-08 NONE 'The run directory is mode 0700 and every microphone pipe in it is mode 0600'
why <<'EOF'
the Core creates <data-dir>/run/capture itself; the user provides HOST-06 and UMask=0077 in the unit (HOST-42, 70-core-unit.sh)
EOF
check <<'EOF'
during a running session: sudo find <data-dir>/run -type d ! -perm 700   -> prints nothing
during a running session: sudo find <data-dir>/run -type p ! -perm 600   -> prints nothing
during a running session: sudo find <data-dir>/run -type p               -> at least 1 path
EOF
confirm '9A/H-01'

hp_done
