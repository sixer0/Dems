CREATE TABLE "installation_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accepted_at" bigint NOT NULL,
	"accepted_by" text NOT NULL,
	"software_version" text NOT NULL,
	"core_device_id" text NOT NULL,
	"site_name" text NOT NULL,
	"room" text NOT NULL,
	"site_address" text,
	"steps" jsonb NOT NULL,
	"diagnostics" jsonb NOT NULL,
	"revoked_at" bigint,
	"revoked_by" text,
	"revoke_reason" text,
	CONSTRAINT "installation_acceptances_software_version_check" CHECK ("installation_acceptances"."software_version" ~ '^[^[:cntrl:]]{1,64}$'),
	CONSTRAINT "installation_acceptances_site_check" CHECK ("installation_acceptances"."core_device_id" ~ '^[^[:cntrl:]]{1,200}$' AND "installation_acceptances"."site_name" ~ '^[^[:cntrl:]]{1,200}$' AND "installation_acceptances"."room" ~ '^[^[:cntrl:]]{1,200}$'),
	CONSTRAINT "installation_acceptances_site_address_check" CHECK ("installation_acceptances"."site_address" IS NULL OR char_length("installation_acceptances"."site_address") BETWEEN 1 AND 500),
	CONSTRAINT "installation_acceptances_steps_check" CHECK (CASE WHEN jsonb_typeof("installation_acceptances"."steps") = 'array' THEN jsonb_array_length("installation_acceptances"."steps") <= 32 AND NOT jsonb_path_exists("installation_acceptances"."steps", 'strict $[*]?(@.type() != "object")') AND NOT jsonb_path_exists("installation_acceptances"."steps", 'strict $.**{3 to last}') ELSE false END),
	CONSTRAINT "installation_acceptances_steps_no_secret_keys_check" CHECK (NOT jsonb_path_exists("installation_acceptances"."steps", 'strict $.**?(@.type() == "object").keyvalue()?(@."key" like_regex "^(password|passwordHash|salt|token|tokenHash|sessionToken|deviceCredential|credential|credentialHash|biometricToken|code|codeHash|pairingCode|qrPayload|username|cookie|authorization|secret|secretCiphertext|ciphertext|nonce|keyRef|onvifUuid|signedUrl|mediaUrl|credentialRef|credentialValue|apiKey)$")')),
	CONSTRAINT "installation_acceptances_steps_bound_check" CHECK (octet_length("installation_acceptances"."steps"::text) <= 8192 AND NOT jsonb_path_exists("installation_acceptances"."steps", 'strict $.**?(@.type() == "string" && !(@ like_regex "^[^[:cntrl:]]{0,200}$"))')),
	CONSTRAINT "installation_acceptances_diagnostics_check" CHECK (CASE WHEN jsonb_typeof("installation_acceptances"."diagnostics") = 'object' THEN NOT jsonb_path_exists("installation_acceptances"."diagnostics", 'strict $.**{5 to last}') ELSE false END),
	CONSTRAINT "installation_acceptances_diagnostics_no_secret_keys_check" CHECK (NOT jsonb_path_exists("installation_acceptances"."diagnostics", 'strict $.**?(@.type() == "object").keyvalue()?(@."key" like_regex "^(password|passwordHash|salt|token|tokenHash|sessionToken|deviceCredential|credential|credentialHash|biometricToken|code|codeHash|pairingCode|qrPayload|username|cookie|authorization|secret|secretCiphertext|ciphertext|nonce|keyRef|onvifUuid|signedUrl|mediaUrl|credentialRef|credentialValue|apiKey)$")')),
	CONSTRAINT "installation_acceptances_diagnostics_bound_check" CHECK (octet_length("installation_acceptances"."diagnostics"::text) <= 16384 AND NOT jsonb_path_exists("installation_acceptances"."diagnostics", 'strict $.**?(@.type() == "string" && !(@ like_regex "^[^[:cntrl:]]{0,200}$"))')),
	CONSTRAINT "installation_acceptances_revoked_at_check" CHECK ("installation_acceptances"."revoked_at" IS NULL OR "installation_acceptances"."revoked_at" >= "installation_acceptances"."accepted_at"),
	CONSTRAINT "installation_acceptances_revoke_check" CHECK ((("installation_acceptances"."revoked_at" IS NULL) = ("installation_acceptances"."revoked_by" IS NULL)) AND (("installation_acceptances"."revoked_at" IS NULL) = ("installation_acceptances"."revoke_reason" IS NULL)) AND ("installation_acceptances"."revoke_reason" IS NULL OR char_length("installation_acceptances"."revoke_reason") BETWEEN 5 AND 500))
);
--> statement-breakpoint
ALTER TABLE "installation_acceptances" ADD CONSTRAINT "installation_acceptances_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "public"."operators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installation_acceptances" ADD CONSTRAINT "installation_acceptances_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "public"."operators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "installation_acceptances_in_force_key" ON "installation_acceptances" USING btree (("revoked_at" IS NULL)) WHERE "installation_acceptances"."revoked_at" IS NULL;