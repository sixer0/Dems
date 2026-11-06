#!/bin/bash
# DEMS Core host profile, addition: the PostgreSQL server of the host (steps DB-01 to DB-07).
# This script only prints and has no apply mode.
#
# WHY IT EXISTS: no PostgreSQL procedure for Ubuntu exists in this repository. The development
# Mac uses PostgreSQL 18.4 from the npm package embedded-postgres (binaries for darwin-arm64),
# provisioned by "npm run pg:init" into .data/ of the product tree. The profile document lists
# the database as outside its scope. The steps below are a DOCUMENTED PROPOSAL with its open
# choices stated; none is a HOST-nn item yet (the request to add them to the profile document
# is filed), none has run anywhere, and every one is TO CONFIRM ON THE HOST.
set -eu
HP_SCRIPT=95-database.sh
HP_ITEMS='DB-01 to DB-07; no item id of the profile yet'
HP_APPLY_SUPPORTED=0
case "$0" in */*) HP_DIR=${0%/*} ;; *) HP_DIR=. ;; esac
# shellcheck source=host-profile-lib.sh
. "$HP_DIR/host-profile-lib.sh"
hp_init "$@"

db_item() { # db_item <id> <title>
  printf '\n== %s  %s\n' "$1" "$2"
  printf '   %-8s: %s\n' class 'MANUAL, PROPOSAL (not an item of the profile document; no mode of this script runs it)'
}
db_confirm() { printf '   %-8s: %s\n' confirm 'to confirm on the host (PREP-04 of the hardware acceptance package; no 9A check names it yet)'; }

db_item DB-01 'Where the PostgreSQL server comes from: OPEN CHOICE of the user'
note <<'EOF'
choice A: the package of the distribution (sudo apt-get install -y postgresql). Its version on Ubuntu 24.04 is NOT read on a host
          (recollection of the author: 16); the product was developed and tested on 18.4 only
choice B: the packages of the PostgreSQL project for Ubuntu 24.04 (version 18). Adds a third-party package source and its
          signing key to the host: a decision of the user, and it needs a network path the room may not have
choice C: the embedded binaries the development uses (npm run pg:init). Not usable as it is: package.json allows the
          install script of the darwin-arm64 binaries only, no linux binary package was ever installed or tried, and
          pg:init writes into .data/ of the product tree, which HOST-05 makes root-owned
EOF
check <<'EOF'
the version the installed server states (psql --version, or SELECT version()) is recorded
EOF
db_confirm

db_item DB-02 'The version: 18.4 is the only one the migrations and the database tests have run on'
note <<'EOF'
a host on another major version runs the product on an untested server: either choice B or C of DB-01, or a ruling that the
database suite is repeated on the version of the host before acceptance
EOF
check <<'EOF'
SHOW server_version   -> recorded in the header of the acceptance record
EOF
db_confirm

db_item DB-03 'The data directory of the server: owned by the account of the server, mode 0700, not inside <install-dir>'
note <<'EOF'
OPEN: on the evidence disk beside <data-dir>, or on the system disk; the default of the distribution package is under /var/lib/postgresql
it holds the audit chain: it is not removed by any step of the profile (as <data-dir>)
EOF
check <<'EOF'
sudo stat -c '%U %a' on the data directory   -> the account of the server, 700
EOF
db_confirm

db_item DB-04 'The server listens on 127.0.0.1 only (HOST-24)'
manual <<'EOF'
in postgresql.conf, by the user: listen_addresses = '127.0.0.1'
OPEN: the port. The development used 4432; the default of the distribution is 5432. The database settings of /etc/dems/core.env (HOST-34) name it
OPEN: whether the local socket of the server stays (the development turned it off: unix_socket_directories = '')
EOF
check <<'EOF'
sudo ss -H -ltn   -> the database port with local address 127.0.0.1 and no other
sudo ufw status   -> no ALLOW line for the database port
EOF
db_confirm

db_item DB-05 'Two roles of the project: an owner role (create, migrate, seed) and a runtime role (the running Core)'
manual <<'EOF'
created by the user; their secrets are set by the user and are never an argument of a command, never printed, never in this script
the runtime settings reach the Core through /etc/dems/core.env (HOST-34: owner root, group <service-user>, mode 0640)
OPEN: where the owner settings live on a host whose product tree is root-owned (the development keeps them in .data/ of the tree)
EOF
check <<'EOF'
the runtime role is not a superuser and does not own the tables (\du and \dt in psql, read by the user)
EOF
db_confirm

db_item DB-06 'The database dems_demo: the name the acceptance procedure expects'
manual <<'EOF'
from <install-dir>, with the owner settings of DB-05:
npm run db:create -- --database dems_demo
npm run db:migrate -- --database dems_demo
npm run db:seed -- --database dems_demo
EOF
note <<'EOF'
the database commands accept a closed list of names; a seeded dems_demo holds the demonstration data set
OPEN (the user): whether the installation goes into service on this database or on a new one after acceptance
EOF
check <<'EOF'
npm run db:status -- --database dems_demo   -> exit code 0; the printed schema version is recorded
EOF
db_confirm

db_item DB-07 'The Core starts after the database server'
note <<'EOF'
OPEN: file G (HOST-33) names no database unit. With a server of the distribution the unit of the Core would gain
After= and Wants= on the unit of that server; its name depends on DB-01 and is not known here
EOF
check <<'EOF'
after a restart of the host, the Core is active without a manual start and its journal names no database connection failure
EOF
db_confirm

hp_done
