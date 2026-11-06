CREATE TABLE "session_capture_sources" (
	"session_id" text NOT NULL,
	"slot" text NOT NULL,
	"device_id" text NOT NULL,
	"adapter_kind" text NOT NULL,
	"recorded_at" bigint NOT NULL,
	CONSTRAINT "session_capture_sources_pkey" PRIMARY KEY("session_id","slot"),
	CONSTRAINT "session_capture_sources_session_check" CHECK ("session_capture_sources"."session_id" ~ '^SES-[0-9]{8}-[0-9]{4}$'),
	CONSTRAINT "session_capture_sources_slot_check" CHECK ("session_capture_sources"."slot" IN ('VIDEO-01', 'VIDEO-02', 'MIC-PRIMARY', 'MIC-STANDBY')),
	CONSTRAINT "session_capture_sources_adapter_kind_check" CHECK ("session_capture_sources"."adapter_kind" IN ('ONVIF_RTSP', 'USB_AUDIO', 'SNMP_POE', 'FAKE', 'LOCAL_DEVICE')),
	CONSTRAINT "session_capture_sources_pairing_check" CHECK (("session_capture_sources"."slot" IN ('VIDEO-01', 'VIDEO-02') AND "session_capture_sources"."adapter_kind" IN ('ONVIF_RTSP', 'FAKE', 'LOCAL_DEVICE')) OR ("session_capture_sources"."slot" IN ('MIC-PRIMARY', 'MIC-STANDBY') AND "session_capture_sources"."adapter_kind" IN ('USB_AUDIO', 'FAKE', 'LOCAL_DEVICE')))
);
--> statement-breakpoint
ALTER TABLE "evidence_items" ADD COLUMN "development_sources" boolean;--> statement-breakpoint
ALTER TABLE "capture_devices" ADD COLUMN "adapter_kind" text DEFAULT 'FAKE' NOT NULL;--> statement-breakpoint
ALTER TABLE "session_capture_sources" ADD CONSTRAINT "session_capture_sources_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."capture_devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "capture_devices_onvif_uuid_key" ON "capture_devices" USING btree ("onvif_uuid") WHERE "capture_devices"."onvif_uuid" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "capture_devices" ADD CONSTRAINT "capture_devices_adapter_kind_check" CHECK ("capture_devices"."adapter_kind" IN ('ONVIF_RTSP', 'USB_AUDIO', 'SNMP_POE', 'FAKE', 'LOCAL_DEVICE'));--> statement-breakpoint
ALTER TABLE "capture_devices" ADD CONSTRAINT "capture_devices_adapter_pairing_check" CHECK (("capture_devices"."kind" = 'CAMERA' AND "capture_devices"."adapter_kind" IN ('ONVIF_RTSP', 'FAKE', 'LOCAL_DEVICE')) OR ("capture_devices"."kind" = 'MIC' AND "capture_devices"."adapter_kind" IN ('USB_AUDIO', 'FAKE', 'LOCAL_DEVICE')) OR ("capture_devices"."kind" = 'POE' AND "capture_devices"."adapter_kind" IN ('SNMP_POE', 'FAKE')));