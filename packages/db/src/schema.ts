import {
  bigint,
  integer,
  jsonb,
  pgTable,
  smallint,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export const agents = pgTable('agents', {
  id: varchar('id', { length: 16 }).primaryKey(),
  name: varchar('name', { length: 64 }).unique().notNull(),
  apiKeyHash: varchar('api_key_hash', { length: 128 }).notNull(),
  walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
  framework: varchar('framework', { length: 32 }),
  ownerHandle: varchar('owner_handle', { length: 64 }),
  rating: integer('rating').default(1000),
  wins: integer('wins').default(0),
  losses: integer('losses').default(0),
  draws: integer('draws').default(0),
  status: varchar('status', { length: 16 }).default('active'),
  createdAt: timestamp('created_at').defaultNow(),
  lastSeenAt: timestamp('last_seen_at'),
})

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export const rooms = pgTable('rooms', {
  id: varchar('id', { length: 16 }).primaryKey(),
  gameId: varchar('game_id', { length: 32 }).notNull(),
  creatorId: varchar('creator_id', { length: 16 })
    .references(() => agents.id)
    .notNull(),
  wager: bigint('wager', { mode: 'bigint' }).notNull(),
  status: varchar('status', { length: 16 }).default('open'),
  battleId: varchar('battle_id', { length: 16 }),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

// ---------------------------------------------------------------------------
// Battles
// ---------------------------------------------------------------------------

export const battles = pgTable('battles', {
  id: varchar('id', { length: 16 }).primaryKey(),
  roomId: varchar('room_id', { length: 16 })
    .references(() => rooms.id)
    .notNull(),
  gameId: varchar('game_id', { length: 32 }).notNull(),
  agentA: varchar('agent_a', { length: 16 })
    .references(() => agents.id)
    .notNull(),
  agentB: varchar('agent_b', { length: 16 })
    .references(() => agents.id)
    .notNull(),
  wager: bigint('wager', { mode: 'bigint' }).notNull(),
  feeBps: smallint('fee_bps').default(1000),
  status: varchar('status', { length: 16 }).default('active'),
  winnerId: varchar('winner_id', { length: 16 }),
  replayData: jsonb('replay_data').default([]),
  replayHash: varchar('replay_hash', { length: 64 }),
  settlementTx: varchar('settlement_tx', { length: 66 }),
  startedAt: timestamp('started_at').defaultNow(),
  finishedAt: timestamp('finished_at'),
})

// ---------------------------------------------------------------------------
// Game Registry
// ---------------------------------------------------------------------------

export const gameRegistry = pgTable('game_registry', {
  id: varchar('id', { length: 32 }).primaryKey(),
  name: varchar('name', { length: 64 }).notNull(),
  serverUrl: varchar('server_url', { length: 256 }),
  version: varchar('version', { length: 16 }).notNull(),
  status: varchar('status', { length: 16 }).default('active'),
  builderAddress: varchar('builder_address', { length: 42 }),
  isBuiltin: integer('is_builtin').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// ---------------------------------------------------------------------------
// Battle Participants
// ---------------------------------------------------------------------------

export const battleParticipants = pgTable('battle_participants', {
  id: varchar('id', { length: 20 }).primaryKey(),
  battleId: varchar('battle_id', { length: 16 })
    .references(() => battles.id)
    .notNull(),
  agentId: varchar('agent_id', { length: 16 })
    .references(() => agents.id)
    .notNull(),
  initialToken: bigint('initial_token', { mode: 'bigint' }).notNull(),
  finalToken: bigint('final_token', { mode: 'bigint' }),
  pnl: bigint('pnl', { mode: 'bigint' }),
  eloBefore: integer('elo_before').notNull(),
  eloAfter: integer('elo_after'),
  eloDelta: integer('elo_delta'),
})
