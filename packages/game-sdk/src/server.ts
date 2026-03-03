import { Hono } from 'hono'
import { nanoid } from 'nanoid'

import type { GameState, IGame } from './types.js'
import type {
  ActionRequest,
  ActionResponse,
  CreateGameRequest,
  CreateGameResponse,
  ForfeitRequest,
  ForfeitResponse,
  GameStateResponse,
  MetaResponse,
  SettleRequest,
  SettleResponse,
  TerminalResponse,
} from './protocol.js'

// ---------------------------------------------------------------------------
// Internal instance tracking
// ---------------------------------------------------------------------------

type GameInstance = {
  state: GameState
  agents: string[]
  wager: bigint
}

// ---------------------------------------------------------------------------
// createGameServer
// ---------------------------------------------------------------------------

/**
 * Wraps any `IGame` implementation into a Hono HTTP server that speaks
 * the bout Open Game Protocol.
 *
 * Usage:
 * ```ts
 * import { createGameServer } from '@bout/game-sdk/server'
 * const app = createGameServer(MyGame)
 * serve({ fetch: app.fetch, port: 4000 })
 * ```
 */
export function createGameServer(game: IGame): Hono {
  const app = new Hono()
  const instances = new Map<string, GameInstance>()

  // --- GET /bout/meta ---
  app.get('/bout/meta', (c) => {
    const res: MetaResponse = { meta: game.meta, tools: game.tools }
    return c.json(res)
  })

  // --- POST /bout/games ---
  app.post('/bout/games', async (c) => {
    const body = (await c.req.json()) as CreateGameRequest
    const instanceId = nanoid(12)
    const wager = BigInt(body.wager)
    const state = await game.initialState(body.agents, wager)

    instances.set(instanceId, { state, agents: body.agents, wager })

    const res: CreateGameResponse = { instanceId }
    return c.json(res, 201)
  })

  // --- GET /bout/games/:id/state ---
  app.get('/bout/games/:id/state', async (c) => {
    const inst = instances.get(c.req.param('id'))
    if (!inst) return c.json({ error: 'Instance not found' }, 404)

    const agentId = c.req.query('agent')
    const currentAgent = await game.currentAgent(inst.state)
    const terminated = await game.isTerminal(inst.state)
    const state = agentId
      ? await game.getAgentView(inst.state, agentId)
      : inst.state

    const res: GameStateResponse = {
      currentAgent,
      state,
      tools: game.tools,
      terminated,
    }
    return c.json(res)
  })

  // --- POST /bout/games/:id/action ---
  app.post('/bout/games/:id/action', async (c) => {
    const inst = instances.get(c.req.param('id'))
    if (!inst) return c.json({ error: 'Instance not found' }, 404)

    const body = (await c.req.json()) as ActionRequest
    const result = await game.applyAction(inst.state, body.agentId, body.action)
    inst.state = result.newState

    const res: ActionResponse = {
      valid: true,
      events: result.events,
      tokenDeltas: Object.fromEntries(
        Object.entries(result.tokenDeltas).map(([k, v]) => [k, v.toString()]),
      ),
      terminated: result.terminated,
      state: result.newState,
    }
    return c.json(res)
  })

  // --- POST /bout/games/:id/forfeit ---
  app.post('/bout/games/:id/forfeit', async (c) => {
    const inst = instances.get(c.req.param('id'))
    if (!inst) return c.json({ error: 'Instance not found' }, 404)

    const body = (await c.req.json()) as ForfeitRequest

    if (!game.forfeit) {
      return c.json({ error: 'Forfeit not supported by this game' }, 400)
    }

    const newState = await game.forfeit(inst.state, body.agentId)
    inst.state = newState

    const res: ForfeitResponse = { state: newState }
    return c.json(res)
  })

  // --- POST /bout/games/:id/settle ---
  app.post('/bout/games/:id/settle', async (c) => {
    const inst = instances.get(c.req.param('id'))
    if (!inst) return c.json({ error: 'Instance not found' }, 404)

    const body = (await c.req.json()) as SettleRequest
    const settlement = await game.settle(
      inst.state,
      BigInt(body.wager),
      body.feeBps,
    )

    // Clean up after settlement
    instances.delete(c.req.param('id'))

    const res: SettleResponse = {
      winner: settlement.winner,
      amounts: Object.fromEntries(
        Object.entries(settlement.amounts).map(([k, v]) => [k, v.toString()]),
      ),
      protocolFee: settlement.protocolFee.toString(),
      builderFee: settlement.builderFee.toString(),
    }
    return c.json(res)
  })

  // --- GET /bout/games/:id/terminal ---
  app.get('/bout/games/:id/terminal', async (c) => {
    const inst = instances.get(c.req.param('id'))
    if (!inst) return c.json({ error: 'Instance not found' }, 404)

    const terminated = await game.isTerminal(inst.state)
    const res: TerminalResponse = { terminated }
    return c.json(res)
  })

  return app
}
