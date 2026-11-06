#!/bin/bash
# DEMS database server, first initialisation only (task 4 row DK). Run by the official postgres image's entrypoint
# from /docker-entrypoint-initdb.d, as the postgres account, ONCE: when the data volume is empty.
#
# The same state scripts/pg/init.mjs gives the development server (database contract 7.1, RP-2 and RP-3):
#   - two roles of the project besides the bootstrap superuser dems_admin (POSTGRES_USER):
#       dems_owner  LOGIN NOSUPERUSER CREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS  (create, migrate, seed)
#       dems_app    LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS (the running Core)
#     with the passwords of the secret files the operator made; psql reads them itself (backquote), so no value
#     is an argument, an environment variable or a line of output; the server stores SCRAM-SHA-256 verifiers;
#   - listen on 127.0.0.1 port 4432 only, no Unix socket after this initialisation, terse error lines;
#   - host authentication: loopback IPv4, scram-sha-256, nothing else (rules HA-1 to HA-3 of scripts/pg/check-hba.mjs).
set -euo pipefail

for name in dems_pg_owner_password dems_pg_app_password; do
  [ -s "/run/secrets/$name" ] || { echo "10-dems-roles: secret $name is missing or empty; nothing was created" >&2; exit 1; }
done

psql -v ON_ERROR_STOP=1 -q --no-psqlrc --username "$POSTGRES_USER" --dbname postgres <<'SQL'
SET log_min_error_statement = panic;
SET log_statement = 'none';
SET password_encryption = 'scram-sha-256';
\set owner_pw `cat /run/secrets/dems_pg_owner_password`
\set app_pw `cat /run/secrets/dems_pg_app_password`
CREATE ROLE dems_owner LOGIN NOSUPERUSER CREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'owner_pw';
CREATE ROLE dems_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'app_pw';
\unset owner_pw
\unset app_pw
SQL
echo "10-dems-roles: roles dems_owner and dems_app created (passwords given as SCRAM-SHA-256, not printed)"

cat >> "$PGDATA/postgresql.conf" <<'CONF'

# --- DEMS settings (deploy/docker/postgres-init/10-dems-roles.sh; as scripts/pg/init.mjs CONF_BLOCK) ---
# Loopback IPv4 only, the project port, no Unix socket. Never the default port 5432.
listen_addresses = '127.0.0.1'
port = 4432
unix_socket_directories = ''
# Terse error lines: no DETAIL, HINT, QUERY or CONTEXT line (security ruling 14 of the development).
log_error_verbosity = terse
CONF

cat > "$PGDATA/pg_hba.conf" <<'HBA'
# DEMS (deploy/docker/postgres-init/10-dems-roles.sh): loopback IPv4 only, SCRAM-SHA-256 on every line, no trust.
# TYPE  DATABASE  USER  ADDRESS       METHOD
host    all       all   127.0.0.1/32  scram-sha-256
HBA
echo "10-dems-roles: postgresql.conf (127.0.0.1:4432, no Unix socket) and pg_hba.conf (loopback, scram-sha-256) written"
