#!/bin/bash
# DEMS Core host profile, part 8: the address helper AS INSTALLED (HOST-43 to HOST-47).
# Items of scripts/host/HOST-PROFILE-UBUNTU-24.04.md, section 3.8.
# This script only prints. It installs NOTHING of the helper and has no apply mode: the helper
# (scripts/host/netalias/) is installed by the user, as root, after its security review, by the
# helper installation chapter of the hardware acceptance package, which prints the hashes to
# compare, the steps and the proofs of refusal. The lines below are the state that chapter
# must leave. UNPROVEN ON LINUX: socket activation has not run (open point 13).
set -eu
HP_SCRIPT=80-helper-state.sh
HP_ITEMS='HOST-43 to HOST-47'
HP_APPLY_SUPPORTED=0
case "$0" in */*) HP_DIR=${0%/*} ;; *) HP_DIR=. ;; esac
# shellcheck source=host-profile-lib.sh
. "$HP_DIR/host-profile-lib.sh"
hp_init "$@"

item HOST-43 MANUAL 'A dedicated group whose only member is the service user'
manual <<'EOF'
by the helper installation chapter, not by this script:
sudo groupadd --system <helper-group>
sudo usermod -aG <helper-group> <service-user>
EOF
check <<'EOF'
getent group <helper-group>   -> one line whose member list is exactly <service-user>
EOF
confirm '9A/H-05'

item HOST-44 MANUAL 'The socket unit and the template service unit, owned by root; the socket active'
manual <<'EOF'
by the helper installation chapter, not by this script:
dems-core-netalias.socket and dems-core-netalias@.service copied to /etc/systemd/system/, owner root, mode 0644
sudo systemd-analyze verify on both; sudo systemctl daemon-reload; sudo systemctl enable --now dems-core-netalias.socket
EOF
check <<'EOF'
systemctl is-active dems-core-netalias.socket   -> active
stat -c '%U %G %a' /run/dems-core-netalias/socket   -> root <helper-group> 660
stat -c '%U %G %a' on both unit files               -> root root 644
EOF
confirm '9A/H-05 (the socket as the service manager creates it; open point 13)'

item HOST-45 MANUAL 'The helper file: owner root, group root, mode 0755, not a symbolic link, every parent directory root-owned'
manual <<'EOF'
as the helper installation chapter states (/usr/local/sbin/dems-core-netalias); not by this script
EOF
check <<'EOF'
namei -l /usr/local/sbin/dems-core-netalias    -> owner root, no w for group or others on every component, no l type
sha256sum /usr/local/sbin/dems-core-netalias   -> equals the hash the chapter prints (scripts/host/netalias/SHA256SUMS)
EOF
confirm '9A/H-05'

item HOST-46 MANUAL 'The interface file: one line that names <camera-interface>, owner root, mode 0644; not the port of the default route'
manual <<'EOF'
as the helper installation chapter states (/etc/dems/netalias-interface); not by this script
EOF
check <<'EOF'
cat /etc/dems/netalias-interface            -> one line
ip -4 route show default                    -> names another interface
stat -c '%U %a' /etc/dems/netalias-interface   -> root 644
EOF
confirm '9A/H-05'

item HOST-47 NONE 'No sudoers line names the helper'
why <<'EOF'
nothing is written (decision C19: a root service on a local socket, one group, two unit files, no sudoers file)
EOF
check <<'EOF'
sudo grep -r -c netalias /etc/sudoers /etc/sudoers.d   -> 0 after every file name
EOF
confirm '9A/H-27'

hp_done
