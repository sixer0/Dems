-- Custom SQL migration file, put your code below! --
-- 0035_operator_administration_privileges (hand-written; RB-9 as amended by the principal of
-- PT GSP on 2026-11-02). Contract revision of the amendment: area 2 of the Core API grows from
-- five operations to eight — createUser, updateUser and deleteUser, each narrowed to the vendor
-- `root` account inside apps/core-server/src/modules/admin.
--
-- WHY A MIGRATION IS NEEDED AT ALL. The runtime role `dems_app` holds SELECT on every column of
-- public.operators and UPDATE on (enabled, last_sign_in_at, role_changed_at, role_id, updated_at)
-- nothing else. It has never had INSERT or DELETE on that table, because until this amendment no
-- operation created or deleted a user and the database contract (§7.3) said so out loud. The three
-- new operations therefore cannot run on the old grants: PostgreSQL itself refuses them, with or
-- without the application's blessing. This file is where that refusal is lifted, and it is the
-- only place the widening happens.
--
-- WHAT STAYS CLOSED. No grant here reaches the role matrix: role_permissions keeps its read-only
-- rule (RB-9 unchanged for the matrix), and no GRANT of REFERENCES, TRUNCATE or REFERENCES is made.
-- The profile UPDATE names four columns and no more: `username`, `role_id` and `enabled` are NOT
-- reachable by updateUser — the role moves only through assignUserRole and the state only through
-- enableUser and disableUser, each with its own audit row and its own RB-8 check.

-- 1. THE CREATE. One INSERT of a whole operator row by createUser. Table-level: a column list of
-- an INSERT would have to be rewritten every time the table gains a column, and the statement of
-- the module names its columns explicitly anyway.
GRANT INSERT ON public.operators TO dems_app;
--> statement-breakpoint
-- 2. THE PROFILE. Only the four columns updateUser writes, and it never sends a role, a username
-- or the enabled flag.
GRANT UPDATE (name, display_name, initials, rank) ON public.operators TO dems_app;
--> statement-breakpoint
-- 3. THE DELETE. The account row itself. The audit chain is untouched by this grant: audit_log has
-- no DELETE anywhere, so a deleted operator keeps every row it wrote and the chain stays verifiable
-- (the property whose loss once made the Core refuse to boot with STORED_CHAIN_NOT_VERIFIED).
GRANT DELETE ON public.operators TO dems_app;
--> statement-breakpoint
-- 4. THE CREDENTIAL OF A DELETED ACCOUNT. The host command `operator:set-password` already writes
-- this table as dems_app (0010) and keeps that right: nothing here widens how a password is
-- written. What is added is DELETE of one's own row only, because the credential's foreign key
-- would otherwise keep the operator alive forever. No INSERT or UPDATE is granted by this file, so
-- the administration module still cannot put a secret into the database: a created account is born
-- without a credential and cannot sign in until the host command gives it one (decision U19).
GRANT DELETE ON public.operator_credentials TO dems_app;
