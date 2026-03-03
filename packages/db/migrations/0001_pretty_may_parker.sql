CREATE TABLE IF NOT EXISTS "game_registry" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"server_url" varchar(256),
	"version" varchar(16) NOT NULL,
	"status" varchar(16) DEFAULT 'active',
	"builder_address" varchar(42),
	"is_builtin" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "battles" ALTER COLUMN "fee_bps" SET DEFAULT 1000;