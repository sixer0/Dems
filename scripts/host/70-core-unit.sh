#!/bin/bash
# DEMS Core host profile, part 7: the service unit of the Core (HOST-33 to HOST-42).
# Items of scripts/host/HOST-PROFILE-UBUNTU-24.04.md, section 3.7.
# Print-only by default. --apply (root, Ubuntu 24.04) runs ONE step: it turns the crash
# collector off (HOST-37). The unit file (file G) and the environment file are never written
# by a script: the start command of a production Core is not settled (9A/H-16), and the values
# of the environment file are the user's and are printed nowhere. UNPROVEN ON LINUX: the unit
# has never run (open point 11).
set -eu
HP_SCRIPT=70-core-unit.sh
HP_ITEMS='HOST-33 to HOST-42'
HP_APPLY_SUPPORTED=1
case "$0" in */*) HP_DIR=${0%/*} ;; *) HP_DIR=. ;; esac
# shellcheck source=host-profile-lib.sh
. "$HP_DIR/host-profile-lib.sh"
hp_init "$@"

item HOST-33 MANUAL 'The unit file, owned by root'
show_file '/etc/systemd/system/dems-core.service, owner root, mode 0644 (file G)' <<'EOF'
[Unit]
Description=DEMS Core
After=network-online.target time-sync.target dems-loopback-rule.service
Wants=network-online.target
Requires=dems-loopback-rule.service

[Service]
User=<service-user>
Group=<service-user>
SupplementaryGroups=audio <helper-group>
WorkingDirectory=<install-dir>
EnvironmentFile=/etc/dems/core.env
ExecStart=<absolute path of node> <start arguments of the Core, to confirm in 9A/H-16>
UMask=0077
LimitCORE=0
NoNewPrivileges=yes
CapabilityBoundingSet=
AmbientCapabilities=
TimeoutStopSec=60

[Install]
WantedBy=multi-user.target
EOF
manual <<'EOF'
then: sudo systemctl daemon-reload
EOF
note <<'EOF'
ExecStart is NOT settled: an absolute path, none of the switches of HOST-36. No further hardening option is set on purpose
EOF
check <<'EOF'
sudo systemd-analyze verify /etc/systemd/system/dems-core.service   -> no error
stat -c '%U %G %a' /etc/systemd/system/dems-core.service            -> root root 644
EOF
confirm '9A/H-16 (the start command of a production Core)'

item HOST-34 MANUAL 'The environment file: owner root, readable by the group of the service user, no development switch in it'
manual <<'EOF'
/etc/dems/core.env, owner root, group <service-user>, mode 0640, written by the user
it sets DEMS_CAPTURE_MODE=real, DEMS_CAPTURE_WORKER (the absolute path of HOST-14), DEMS_MEDIA_DIR and the database settings
its values are the user's: this script never reads, asks for or prints one
EOF
check <<'EOF'
sudo stat -c '%U %G %a' /etc/dems/core.env   -> root <service-user> 640
sudo grep -c -E '^(DEMS_CAPTURE_DEV_SOURCES|DEMS_DEMO_CONTROLS|NODE_OPTIONS)=' /etc/dems/core.env   -> 0
EOF
confirm '9A/H-16'

item HOST-35 NONE 'Core-file limit of the Core is 0'
why <<'EOF'
a line of file G (HOST-33): LimitCORE=0   (security item AD-09 (1))
EOF
check <<'EOF'
systemctl show dems-core.service -p LimitCORE              -> LimitCORE=0
sudo grep 'Max core file size' /proc/<core-pid>/limits     -> 0 in both limit columns
EOF
confirm -

item HOST-36 NONE 'The Core is started without a diagnostic-report switch, a heap-snapshot switch or a debugger switch'
why <<'EOF'
a property of the ExecStart line and of the environment file; they hold none of:
--report-on-fatalerror --report-uncaught-exception --report-on-signal --report-compact --diagnostic-dir
--heapsnapshot-signal --heapsnapshot-near-heap-limit --heap-prof --inspect, and no NODE_OPTIONS
EOF
check <<'EOF'
sudo tr '\0' '\n' < /proc/<core-pid>/cmdline   -> no line that starts with --report, --diagnostic, --heap or --inspect
sudo tr '\0' '\n' < /proc/<core-pid>/environ   -> no line that starts with NODE_OPTIONS=
EOF
confirm '9A/H-01 (the switch list against the installed Node.js version)'

item HOST-37 AUTO 'The crash collector of the system does not take a memory image of the Core'
act systemctl disable --now apport.service
note <<'EOF'
the two core lines (kernel.core_pattern, fs.suid_dumpable) are in file C, written by 40-network-firewall.sh under HOST-20
EOF
check <<'EOF'
systemctl is-enabled apport.service   -> disabled or masked
sysctl -n kernel.core_pattern         -> the value of file C
sysctl -n fs.suid_dumpable            -> 0
ls /var/crash                         -> prints nothing
EOF
confirm '9A/H-01 (whether HOST-35 alone is enough is a recollection of the author, not read on a host; open point 12)'

item HOST-38 NONE 'The Core cannot gain privileges'
why <<'EOF'
a line of file G (HOST-33): NoNewPrivileges=yes   (decision C19)
EOF
check <<'EOF'
systemctl show dems-core.service -p NoNewPrivileges   -> NoNewPrivileges=yes
sudo grep NoNewPrivs /proc/<core-pid>/status          -> "NoNewPrivs:" then 1
EOF
confirm '9A/H-06 (the helper still works from inside this unit)'

item HOST-39 NONE 'The Core has an empty capability bounding set and no ambient capability'
why <<'EOF'
two lines of file G (HOST-33): CapabilityBoundingSet= and AmbientCapabilities=, both with nothing after the equals sign
EOF
check <<'EOF'
sudo grep -E '^Cap(Prm|Eff|Bnd|Amb)' /proc/<core-pid>/status   -> 4 lines, each ending in 0000000000000000
EOF
confirm '9A/H-17 (a session records with this in force)'

item HOST-40 NONE 'The Core runs with the audio group and the group of the helper, and no other supplementary group'
why <<'EOF'
a line of file G (HOST-33): SupplementaryGroups=audio <helper-group>
EOF
check <<'EOF'
sudo grep '^Groups:' /proc/<core-pid>/status   -> exactly the two group numbers that "getent group audio <helper-group>" prints
EOF
confirm '9A/H-05'

item HOST-41 NONE 'The Core starts only with the loopback rule in place'
why <<'EOF'
two lines of file G (HOST-33): Requires=dems-loopback-rule.service and After=dems-loopback-rule.service
EOF
check <<'EOF'
systemctl show dems-core.service -p Requires   -> holds dems-loopback-rule.service
after "sudo systemctl stop dems-loopback-rule.service" the Core is stopped too (then both are started again)
EOF
confirm '9A/H-04'

item HOST-42 NONE 'Files the Core creates are owner-only by default'
why <<'EOF'
a line of file G (HOST-33): UMask=0077
EOF
check <<'EOF'
sudo grep '^Umask:' /proc/<core-pid>/status   -> "Umask:" then 0077
EOF
confirm -

hp_done
