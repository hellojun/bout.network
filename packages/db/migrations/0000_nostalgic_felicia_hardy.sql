CREATE TABLE IF NOT EXISTS "agents" (
	"id" varchar(16) PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"api_key_hash" varchar(128) NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"framework" varchar(32),
	"owner_handle" varchar(64),
	"rating" integer DEFAULT 1000,
	"wins" integer DEFAULT 0,
	"losses" integer DEFAULT 0,
	"draws" integer DEFAULT 0,
	"status" varchar(16) DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"last_seen_at" timestamp,
	CONSTRAINT "agents_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "battle_participants" (
	"id" varchar(20) PRIMARY KEY NOT NULL,
	"battle_id" varchar(16) NOT NULL,
	"agent_id" varchar(16) NOT NULL,
	"initial_token" bigint NOT NULL,
	"final_token" bigint,
	"pnl" bigint,
	"elo_before" integer NOT NULL,
	"elo_after" integer,
	"elo_delta" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "battles" (
	"id" varchar(16) PRIMARY KEY NOT NULL,
	"room_id" varchar(16) NOT NULL,
	"game_id" varchar(32) NOT NULL,
	"agent_a" varchar(16) NOT NULL,
	"agent_b" varchar(16) NOT NULL,
	"wager" bigint NOT NULL,
	"fee_bps" smallint DEFAULT 300,
	"status" varchar(16) DEFAULT 'active',
	"winner_id" varchar(16),
	"replay_data" jsonb DEFAULT '[]'::jsonb,
	"replay_hash" varchar(64),
	"settlement_tx" varchar(66),
	"started_at" timestamp DEFAULT now(),
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rooms" (
	"id" varchar(16) PRIMARY KEY NOT NULL,
	"game_id" varchar(32) NOT NULL,
	"creator_id" varchar(16) NOT NULL,
	"wager" bigint NOT NULL,
	"status" varchar(16) DEFAULT 'open',
	"battle_id" varchar(16),
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "battle_participants" ADD CONSTRAINT "battle_participants_battle_id_battles_id_fk" FOREIGN KEY ("battle_id") REFERENCES "public"."battles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "battle_participants" ADD CONSTRAINT "battle_participants_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "battles" ADD CONSTRAINT "battles_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "battles" ADD CONSTRAINT "battles_agent_a_agents_id_fk" FOREIGN KEY ("agent_a") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "battles" ADD CONSTRAINT "battles_agent_b_agents_id_fk" FOREIGN KEY ("agent_b") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rooms" ADD CONSTRAINT "rooms_creator_id_agents_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
