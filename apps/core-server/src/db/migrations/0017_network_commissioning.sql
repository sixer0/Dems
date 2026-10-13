CREATE TABLE "capture_network_config" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"interface_name" text,
	"camera_subnet" text,
	"factory_addresses" jsonb DEFAULT '["192.168.1.64","192.168.1.108","192.168.0.90","192.168.1.13"]'::jsonb NOT NULL,
	"alias_host" smallint DEFAULT 253 NOT NULL,
	"alias_minutes" smallint DEFAULT 30 NOT NULL,
	"camera_ip_start" smallint DEFAULT 101 NOT NULL,
	"revision" bigint DEFAULT 1 NOT NULL,
	"updated_by" text,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "capture_network_config_singleton_check" CHECK ("capture_network_config"."singleton"),
	CONSTRAINT "capture_network_config_interface_name_check" CHECK ("capture_network_config"."interface_name" IS NULL OR "capture_network_config"."interface_name" ~ '^[a-z0-9][a-z0-9._-]{0,14}$'),
	CONSTRAINT "capture_network_config_camera_subnet_check" CHECK ("capture_network_config"."camera_subnet" IS NULL OR "capture_network_config"."camera_subnet" ~ '^(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])([.](25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])){3}/(1[6-9]|2[0-9]|30)$'),
	CONSTRAINT "capture_network_config_factory_addresses_check" CHECK (CASE WHEN jsonb_typeof("capture_network_config"."factory_addresses") = 'array' THEN jsonb_array_length("capture_network_config"."factory_addresses") <= 32 AND NOT jsonb_path_exists("capture_network_config"."factory_addresses", 'strict $[*]?(@.type() != "string" || !(@ like_regex "^[0-9]{1,3}([.][0-9]{1,3}){3}$"))') ELSE false END),
	CONSTRAINT "capture_network_config_alias_host_check" CHECK ("capture_network_config"."alias_host" BETWEEN 2 AND 254),
	CONSTRAINT "capture_network_config_alias_minutes_check" CHECK ("capture_network_config"."alias_minutes" BETWEEN 5 AND 480),
	CONSTRAINT "capture_network_config_camera_ip_start_check" CHECK ("capture_network_config"."camera_ip_start" BETWEEN 2 AND 250),
	CONSTRAINT "capture_network_config_revision_check" CHECK ("capture_network_config"."revision" >= 1)
);
--> statement-breakpoint
CREATE TABLE "host_network_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interface_name" text NOT NULL,
	"address" text NOT NULL,
	"reason" text NOT NULL,
	"added_at" bigint NOT NULL,
	"added_by" text NOT NULL,
	"expires_at" bigint NOT NULL,
	"removed_at" bigint,
	"remove_reason" text,
	"removed_by" text,
	"remove_error" text,
	CONSTRAINT "host_network_aliases_interface_name_check" CHECK ("host_network_aliases"."interface_name" ~ '^[a-z0-9][a-z0-9._-]{0,14}$'),
	CONSTRAINT "host_network_aliases_address_check" CHECK ("host_network_aliases"."address" ~ '^(10[.](25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])[.](25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])|172[.](1[6-9]|2[0-9]|3[01])[.](25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])|192[.]168[.](25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9]))[.](25[0-4]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]?)/24$'),
	CONSTRAINT "host_network_aliases_reason_check" CHECK ("host_network_aliases"."reason" IN ('FACTORY_SCAN', 'SET_CAMERA_ADDRESS')),
	CONSTRAINT "host_network_aliases_expires_at_check" CHECK ("host_network_aliases"."expires_at" > "host_network_aliases"."added_at"),
	CONSTRAINT "host_network_aliases_removed_at_check" CHECK ("host_network_aliases"."removed_at" IS NULL OR "host_network_aliases"."removed_at" >= "host_network_aliases"."added_at"),
	CONSTRAINT "host_network_aliases_remove_reason_check" CHECK ((("host_network_aliases"."remove_reason" IS NULL) = ("host_network_aliases"."removed_at" IS NULL)) AND ("host_network_aliases"."remove_reason" IS NULL OR "host_network_aliases"."remove_reason" IN ('EXPIRED', 'MANUAL', 'JOB_DONE', 'BOOT_SWEEP'))),
	CONSTRAINT "host_network_aliases_removed_by_check" CHECK ("host_network_aliases"."removed_by" IS NULL OR "host_network_aliases"."removed_at" IS NOT NULL),
	CONSTRAINT "host_network_aliases_remove_error_check" CHECK ("host_network_aliases"."remove_error" IS NULL OR "host_network_aliases"."remove_error" ~ '^[A-Z][A-Z0-9_]{0,63}$')
);
--> statement-breakpoint
ALTER TABLE "capture_audio_inputs" ADD COLUMN "usb_serial" text;--> statement-breakpoint
ALTER TABLE "capture_audio_inputs" ADD COLUMN "usb_port" text;--> statement-breakpoint
ALTER TABLE "capture_network_config" ADD CONSTRAINT "capture_network_config_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."operators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_network_aliases" ADD CONSTRAINT "host_network_aliases_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."operators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_network_aliases" ADD CONSTRAINT "host_network_aliases_removed_by_fkey" FOREIGN KEY ("removed_by") REFERENCES "public"."operators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "host_network_aliases_open_address_key" ON "host_network_aliases" USING btree ("interface_name","address") WHERE "host_network_aliases"."removed_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "host_network_aliases_one_open_key" ON "host_network_aliases" USING btree (("removed_at" IS NULL)) WHERE "host_network_aliases"."removed_at" IS NULL;--> statement-breakpoint
ALTER TABLE "capture_audio_inputs" ADD CONSTRAINT "capture_audio_inputs_usb_serial_check" CHECK ("capture_audio_inputs"."usb_serial" IS NULL OR "capture_audio_inputs"."usb_serial" ~ '^[A-Za-z0-9:._-]{1,64}$');--> statement-breakpoint
ALTER TABLE "capture_audio_inputs" ADD CONSTRAINT "capture_audio_inputs_usb_port_check" CHECK ("capture_audio_inputs"."usb_port" IS NULL OR "capture_audio_inputs"."usb_port" ~ '^[A-Za-z0-9:._-]{1,64}$');