// Trial step T5-j: the superuser trigger check (database contract 6.5 T-AO-2c, 7.1; plan 7.3;
// decision D19; behaviour PG-21).
//
// Question: does a trigger that is ENABLE ALWAYS still refuse a change when a SUPERUSER session
// has set session_replication_role = replica? The real audit triggers do not exist at
// provisioning, so the check uses a scratch table in the trial database, with a refusal trigger
// of the same text as statement group 4 of contract 6.3.
//
// This is the only step of the project that runs as the bootstrap superuser dems_admin after
// the roles exist. It is called by pg:init (through trial.mjs) and by nothing else; it opens one
// session, and closes it before it returns. The scratch table goes with the trial database.

import { PgScriptError, ROLE_ADMIN, main, readPwfile } from './lib.mjs';
import { connect } from './db.mjs';

export const TRIGGER_CHECK_SETUP = Object.freeze([
  'CREATE TABLE public.trial_append_only (id integer PRIMARY KEY, note text NOT NULL)',
  "INSERT INTO public.trial_append_only (id, note) VALUES (1, 'original')",
  `CREATE FUNCTION public.trial_append_only_refuse_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'trial_append_only is append-only: % refused', TG_OP
    USING ERRCODE = 'ZA002';
END
$$`,
  `CREATE TRIGGER trial_append_only_guard
  BEFORE UPDATE OR DELETE OR TRUNCATE ON public.trial_append_only
  FOR EACH STATEMENT EXECUTE FUNCTION public.trial_append_only_refuse_change()`,
  'ALTER TABLE public.trial_append_only ENABLE ALWAYS TRIGGER trial_append_only_guard',
]);

const TRIGGER_MODE = "SELECT tgenabled FROM pg_trigger WHERE tgname = 'trial_append_only_guard'";
const UPDATE = "UPDATE public.trial_append_only SET note = 'changed' WHERE id = 1";
const DELETE = 'DELETE FROM public.trial_append_only WHERE id = 1';
const TRUNCATE = 'TRUNCATE public.trial_append_only';

/** Runs T5-j on `database` and records each sub-step. Returns true when every sub-step passed. */
export async function runSuperuserTriggerCheck(paths, database, rec) {
  const as = `${ROLE_ADMIN}@${database}`;
  const admin = await connect({
    user: ROLE_ADMIN,
    password: readPwfile(paths.pwfile, paths.root),
    database,
    appName: 'dems-pg-trial-t5j',
  });
  let pass = true;
  const mark = (id, action, outcome, good) => {
    rec.add(id, as, action, outcome, good ? 'PASS' : 'FAIL');
    pass = pass && good;
  };
  const refused = async (id, sql) => {
    try {
      await admin.query(sql);
      mark(id, sql, 'accepted, but SQLSTATE ZA002 was expected', false);
    } catch (error) {
      mark(id, sql, `refused, SQLSTATE ${error.code}: ${error.message}`, error.code === 'ZA002');
    }
  };
  try {
    for (const sql of TRIGGER_CHECK_SETUP) await admin.query(sql);
    const always = (await admin.query(TRIGGER_MODE)).rows[0]?.tgenabled;
    mark('T5-j1', 'scratch table, refusal trigger (text of contract 6.3 group 4), ENABLE ALWAYS TRIGGER', `pg_trigger.tgenabled = '${always}'`, always === 'A');

    await admin.query('SET session_replication_role = replica');
    const role = (await admin.query('SHOW session_replication_role')).rows[0].session_replication_role;
    const superuser = (await admin.query('SELECT rolsuper FROM pg_roles WHERE rolname = current_user')).rows[0].rolsuper;
    mark('T5-j2', 'SET session_replication_role = replica', `session_replication_role = ${role}; current_user is superuser = ${superuser}`, role === 'replica' && superuser === true);

    await refused('T5-j3', UPDATE);
    await refused('T5-j4', DELETE);
    await refused('T5-j5', TRUNCATE);

    await admin.query('ALTER TABLE public.trial_append_only ENABLE TRIGGER trial_append_only_guard');
    const origin = (await admin.query(TRIGGER_MODE)).rows[0]?.tgenabled;
    try {
      const r = await admin.query(UPDATE);
      mark('T5-j6', `trigger back in the default mode (tgenabled = '${origin}'), still replica: ${UPDATE}`, `accepted, ${r.rowCount} row changed: the setting skips an ordinary trigger, so ALWAYS is what holds`, origin === 'O' && r.rowCount === 1);
    } catch (error) {
      mark('T5-j6', `trigger back in the default mode (tgenabled = '${origin}'), still replica: ${UPDATE}`, `refused, SQLSTATE ${error.code}: ${error.message}`, false);
    }
  } finally {
    await admin.end().catch(() => {});
  }
  rec.add('T5-j', as, 'the superuser session of T5-j', 'closed; no superuser connection stays open', 'PASS');
  return pass;
}

await main(import.meta.url, 'pg:check-superuser-trigger', async () => {
  throw new PgScriptError(
    'this check is trial step T5-j: it runs inside "npm run pg:init" only, at provisioning ' +
      '(the one time the bootstrap superuser is used). It has no command of its own.',
    2,
  );
});
