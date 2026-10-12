#!/bin/bash
# DEMS Core host profile, part 6: sleep and time (HOST-29 to HOST-32).
# Items of scripts/host/HOST-PROFILE-UBUNTU-24.04.md, section 3.6.
# Print-only by default. --apply (root, Ubuntu 24.04) runs the AUTO steps; the lid file of
# HOST-30 is written only when --with-lid is given as well. UNPROVEN ON LINUX.
set -eu
HP_SCRIPT=60-sleep-time.sh
HP_ITEMS='HOST-29 to HOST-32'
HP_APPLY_SUPPORTED=1
case "$0" in */*) HP_DIR=${0%/*} ;; *) HP_DIR=. ;; esac
# shellcheck source=host-profile-lib.sh
. "$HP_DIR/host-profile-lib.sh"
hp_init "$@"

item HOST-29 AUTO 'The host never sleeps or hibernates'
act systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
check <<'EOF'
systemctl is-enabled sleep.target suspend.target hibernate.target hybrid-sleep.target   -> masked 4 times
EOF
confirm -

item HOST-30 AUTO 'On a host with a lid: closing it does nothing'
if [ "$HP_APPLY" = 1 ] && [ "$HP_WITH_LID" != 1 ]; then
  note <<'EOF'
skipped: --with-lid was not given (a host without a lid needs no file F)
EOF
else
  note <<'EOF'
only on a host with a lid; with --apply this step also needs --with-lid
EOF
  act install -d -o root -g root -m 0755 /etc/systemd/logind.conf.d
  put_file /etc/systemd/logind.conf.d/60-dems-lid.conf 0644 root root <<'EOF'
[Login]
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
EOF
fi
manual <<'EOF'
then a restart of the host (the user's step; not run by this script)
EOF
check <<'EOF'
systemd-analyze cat-config systemd/logind.conf   -> shows the three HandleLidSwitch lines of file F
EOF
confirm '9A/H-01 (only if the host has a lid)'

item HOST-31 AUTO 'The clock of the host is synchronised'
act timedatectl set-ntp true
check <<'EOF'
timedatectl show -p NTPSynchronized --value   -> yes
EOF
confirm '9A/H-01 (the time source at a site without Internet access is the decision of the site; open point 14)'

item HOST-32 AUTO 'The Core starts only after the clock is synchronised'
act systemctl enable systemd-time-wait-sync.service
note <<'EOF'
and After=time-sync.target in the unit of the Core (file G, HOST-33, 70-core-unit.sh)
EOF
check <<'EOF'
systemctl is-enabled systemd-time-wait-sync.service   -> enabled
systemctl show dems-core.service -p After             -> holds time-sync.target
EOF
confirm '9A/H-01 (a host without a reachable time source would then not start the Core; open point 14)'

hp_done
