#!/bin/bash
# DEMS Core host profile, part 5: audio access (HOST-26 to HOST-28).
# Items of scripts/host/HOST-PROFILE-UBUNTU-24.04.md, section 3.5.
# Print-only by default. --apply (root, Ubuntu 24.04) runs the AUTO step. UNPROVEN ON LINUX:
# ALSA does not exist on the development machine (open point 10).
set -eu
HP_SCRIPT=50-audio.sh
HP_ITEMS='HOST-26 to HOST-28'
HP_APPLY_SUPPORTED=1
case "$0" in */*) HP_DIR=${0%/*} ;; *) HP_DIR=. ;; esac
# shellcheck source=host-profile-lib.sh
. "$HP_DIR/host-profile-lib.sh"
hp_init "$@"
hp_need service-user

item HOST-26 AUTO 'ALSA tools present; the service user may open the sound devices without a desktop login'
act apt-get install -y alsa-utils
act usermod -aG audio "$HP_SERVICE_USER"
check <<'EOF'
id -nG <service-user>   -> holds audio
with the interface connected: sudo runuser -u <service-user> -- arecord -l   -> lists it as a card
EOF
confirm '9A/H-07 (the listing on the real interface)'

item HOST-27 NONE 'The audio interface is USB Audio Class (no vendor driver)'
why <<'EOF'
a property of the device
EOF
check <<'EOF'
lsusb                    -> lists the interface
cat /proc/asound/cards   -> names it with the driver USB-Audio
EOF
confirm '9A/H-07'

item HOST-28 NONE 'No sound server holds the interface, so that ALSA shared capture can open it'
why <<'EOF'
nothing to do on a server installation; on a desktop installation the user keeps the session sound server away from this card
EOF
check <<'EOF'
with no session running: sudo fuser -v /dev/snd/pcmC*D*c   -> prints no process
EOF
confirm '9A/H-08 (shared capture opening on both inputs)'

hp_done
