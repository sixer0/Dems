-- Custom SQL migration file, put your code below! --
-- 0037_operator_credential_creation (hand-written; decision D56 of 2026-11-03, the principal's
-- "lakukan jangan menunggu" over the pre-delivery procedure run end to end).
--
-- THE GAP. The factory seed (PT GSP ruling of 30 Oct 2026, src/db/seed/factory.ts) deliberately
-- leaves the two vendor accounts WITHOUT a credential row and names `operator:set-password` as
-- "the only writer of a credential" for them. That command, written earlier (task 4 row 215,
-- design X-2 of 12 Oct), could only REPLACE a row: its SELECT found the account, its
-- has_credential test refused with CREDENTIAL_ROW_MISSING, and the runtime role dems_app held
-- column-level UPDATE (0003) and DELETE (0035) on public.operator_credentials but no INSERT.
-- A factory-born account therefore had no path to a password at all: the pre-delivery procedure
-- could not be completed as ruled.
--
-- THE FIX, in two halves. The command's username target now CREATES the credential row when the
-- account exists without one (same policy, same hidden prompt, same unit of work, same
-- OPERATOR_PASSWORD_SET audit row; R-X2-10 still holds - no operator is created, the person must
-- exist first). This file is the other half: the grant PostgreSQL itself was refusing.
-- INSERT is table-level on purpose: every column of the row is written by that one statement.

GRANT INSERT ON public.operator_credentials TO dems_app;
