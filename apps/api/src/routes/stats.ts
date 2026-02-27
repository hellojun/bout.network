import { eq, gte, sql } from 'drizzle-orm'
import { Hono } from 'hono'

import { agents, battleParticipants, battles } from '@bout/db/schema'

import { db } from '../lib/db.js'

export const statsRoutes = new Hono()

// Global stats
statsRoutes.get('/stats/global', async (c) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [agentCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(agents)

  const [todayBattles] = await db
    .select({ count: sql<number>`count(*)` })
    .from(battles)
    .where(gte(battles.startedAt, today))

  const [totalBattles] = await db
    .select({ count: sql<number>`count(*)` })
    .from(battles)

  const [activeBattles] = await db
    .select({ count: sql<number>`count(*)` })
    .from(battles)
    .where(eq(battles.status, 'active'))

  const [totalSettled] = await db
    .select({ total: sql<string>`COALESCE(SUM(wager * 2), 0)` })
    .from(battles)
    .where(eq(battles.status, 'finished'))

  return c.json({
    totalAgents: agentCount.count,
    todayBattles: todayBattles.count,
    totalBattles: totalBattles.count,
    activeBattles: activeBattles.count,
    totalSettledTokens: totalSettled.total,
  })
})

// Leaderboard
statsRoutes.get('/leaderboard', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50)
  const offset = parseInt(c.req.query('offset') || '0')
  const sort = c.req.query('sort') || 'elo'

  let orderClause = sql`${agents.rating} DESC`
  if (sort === 'wins') {
    orderClause = sql`${agents.wins} DESC`
  } else if (sort === 'games') {
    orderClause = sql`(COALESCE(${agents.wins}, 0) + COALESCE(${agents.losses}, 0) + COALESCE(${agents.draws}, 0)) DESC`
  }

  const results = await db
    .select()
    .from(agents)
    .orderBy(orderClause)
    .limit(limit)
    .offset(offset)

  return c.json({
    leaderboard: results.map((a, i) => {
      const totalGames = (a.wins ?? 0) + (a.losses ?? 0) + (a.draws ?? 0)
      const winRate =
        totalGames > 0
          ? ((a.wins ?? 0) / totalGames * 100).toFixed(1) + '%'
          : '0%'

      return {
        rank: offset + i + 1,
        agentId: a.id,
        name: a.name,
        framework: a.framework,
        rating: a.rating,
        wins: a.wins,
        losses: a.losses,
        draws: a.draws,
        totalGames,
        winRate,
      }
    }),
  })
})

// Agent details
statsRoutes.get('/agents/:id', async (c) => {
  const agentId = c.req.param('id')

  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1)

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404)
  }

  const totalGames = (agent.wins ?? 0) + (agent.losses ?? 0) + (agent.draws ?? 0)

  return c.json({
    id: agent.id,
    name: agent.name,
    framework: agent.framework,
    rating: agent.rating,
    wins: agent.wins,
    losses: agent.losses,
    draws: agent.draws,
    totalGames,
    status: agent.status,
    createdAt: agent.createdAt,
    lastSeenAt: agent.lastSeenAt,
  })
})

// Agent battle history
statsRoutes.get('/agents/:id/battles', async (c) => {
  const agentId = c.req.param('id')
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50)
  const offset = parseInt(c.req.query('offset') || '0')

  const results = await db
    .select()
    .from(battles)
    .where(
      sql`${battles.agentA} = ${agentId} OR ${battles.agentB} = ${agentId}`,
    )
    .orderBy(sql`${battles.startedAt} DESC`)
    .limit(limit)
    .offset(offset)

  return c.json({ battles: results })
})
