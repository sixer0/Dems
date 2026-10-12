#!/bin/bash
# DEMS Core host profile, part 4: the camera port, the firewall, the loopback rule
# (HOST-18 to HOST-25). Items of scripts/host/HOST-PROFILE-UBUNTU-24.04.md, section 3.4.
# Print-only by default. --apply (root, Ubuntu 24.04) runs the AUTO steps.
# Never run by a script, in any mode: the address of the camera port (HOST-19, the user
# confirms it interactively) and turning the firewall on (HOST-22, it can cut the user's own
# remote administration). UNPROVEN ON LINUX.
set -eu
HP_SCRIPT=40-network-firewall.sh
HP_ITEMS='HOST-18 to HOST-25'
HP_APPLY_SUPPORTED=1
case "$0" in */*) HP_DIR=${0%/*} ;; *) HP_DIR=. ;; esac
# shellcheck source=host-profile-lib.sh
. "$HP_DIR/host-profile-lib.sh"
hp_init "$@"
hp_need service-user camera-interface

item HOST-18 AUTO 'The conflict-check tool is the iputils one; the other package named arping is absent'
act apt-get install -y iputils-arping iproute2
check <<'EOF'
dpkg -S "$(command -v arping)"   -> "iputils-arping: /usr/bin/arping"
dpkg -s arping                   -> "is not installed"
EOF
confirm '9A/H-25 (the two packages give -D different meanings; the path printed; open points 4 and 5)'

item HOST-19 MANUAL 'The cameras are on a dedicated port and switch: one static private /24 address, no gateway, no name server, no DHCP'
show_file '/etc/netplan/60-dems-camera.yaml, owner root, mode 0600 (file B)' <<'EOF'
network:
  version: 2
  ethernets:
    <camera-interface>:
      dhcp4: false
      dhcp6: false
      accept-ra: false
      addresses:
        - <camera-address>/24
EOF
manual <<'EOF'
then: sudo netplan try   (the user confirms at its prompt; a script would change a host address unattended)
EOF
check <<'EOF'
ip -br -4 addr show dev <camera-interface>   -> exactly one address
ip -4 route show default                     -> does not name <camera-interface>
EOF
confirm '9A/H-01 (the netplan renderer of the installation)'

item HOST-20 AUTO 'Forwarding between the camera port and any other port is off'
note <<'EOF'
file C carries the two forwarding lines of this item and the two core lines of HOST-37
EOF
put_file /etc/sysctl.d/60-dems-host.conf 0644 root root <<'EOF'
net.ipv4.ip_forward = 0
net.ipv6.conf.all.forwarding = 0
kernel.core_pattern = |/bin/false
fs.suid_dumpable = 0
EOF
act sysctl --system
check <<'EOF'
sysctl -n net.ipv4.ip_forward net.ipv6.conf.all.forwarding    -> 0 twice
cat /proc/sys/net/ipv4/conf/<camera-interface>/forwarding     -> 0
EOF
confirm -

item HOST-21 NONE 'Nothing on the host turns forwarding back on (no container runtime, no virtual machine bridge, no VPN service)'
why <<'EOF'
such software is not installed on this host
EOF
check <<'EOF'
dpkg -l 'docker*' 'containerd*' 'libvirt*' 'wireguard*'   -> no line that starts with ii
EOF
confirm '9A/H-01'

item HOST-22 MANUAL 'The firewall is on and denies incoming and routed traffic by default'
manual <<'EOF'
sudo ufw default deny incoming
sudo ufw default deny routed
(the user's own remote-administration rule first, if one is used) sudo ufw enable
EOF
check <<'EOF'
sudo ufw status verbose   -> "Status: active" and "Default: deny (incoming), allow (outgoing), deny (routed)"
EOF
confirm '9A/H-01'

item HOST-23 AUTO 'Answers to the camera search arrive: datagrams from source port 3702 are admitted on the camera port'
act ufw allow in on "$HP_CAMERA_INTERFACE" proto udp from any port 3702 comment 'DEMS camera search answers'
check <<'EOF'
sudo ufw status numbered   -> lists the rule with "on <camera-interface>"
the search in the web console lists at least 1 camera
EOF
confirm '9A/H-12 (whether this rule alone suffices) and 9A/H-13 (answers from a factory subnet through a temporary address); open point 8'

item HOST-24 NONE 'The services of the Core are not reachable on the camera port or on any temporary address added to it'
why <<'EOF'
the Core and its database listen on 127.0.0.1 only, and no firewall rule opens their ports
EOF
check <<'EOF'
sudo ss -H -ltnp   -> 127.0.0.1 as the local address of every listener owned by <service-user>
sudo ufw status    -> no ALLOW line for ports 4420 to 4423
EOF
confirm '9A/H-01 (a connection attempt to those ports from a laptop on the camera switch fails)'

item HOST-25 AUTO 'Loopback rule: only <service-user> can open a connection to 127.0.0.1 ports 8554 to 8564'
note <<'EOF'
security items S13-07 (RC-5) and BR-12: this rule is mandatory; the unit of the Core requires it (HOST-41)
EOF
act apt-get install -y nftables
act install -d -o root -g root -m 0755 /etc/dems
put_file /etc/dems/loopback-ingest.nft 0644 root root <<'EOF'
table inet dems_loopback
delete table inet dems_loopback
table inet dems_loopback {
    chain output {
        type filter hook output priority filter; policy accept;
        oifname "lo" ip daddr 127.0.0.1 tcp dport 8554-8564 meta skuid != "<service-user>" counter reject with tcp reset
    }
}
EOF
put_file /etc/systemd/system/dems-loopback-rule.service 0644 root root <<'EOF'
[Unit]
Description=DEMS loopback rule for the camera listeners
Before=dems-core.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/sbin/nft -f /etc/dems/loopback-ingest.nft
ExecStop=/usr/sbin/nft delete table inet dems_loopback

[Install]
WantedBy=multi-user.target
EOF
act systemctl daemon-reload
act systemctl enable --now dems-loopback-rule.service
check <<'EOF'
systemctl is-active dems-loopback-rule.service   -> active
sudo nft list table inet dems_loopback           -> one rule that holds "tcp dport 8554-8564" and "skuid != <service-user>"
after one connection attempt to 127.0.0.1 port 8554 from the administrator account: the "counter packets" figure of the rule has risen by at least 1
EOF
confirm '9A/H-01 (the rule beside the firewall of HOST-22; the rule after a restart; open point 9)'

hp_done
