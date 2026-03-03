import type {
  Action,
  GameMeta,
  GameState,
  IGame,
  Settlement,
  ToolDef,
  TurnResult,
} from './types.js'
import type {
  ActionResponse,
  ForfeitResponse,
  GameStateResponse,
  MetaResponse,
  SettleResponse,
  TerminalResponse,
  CreateGameResponse,
} from './protocol.js'

// ---------------------------------------------------------------------------
// RemoteGame — IGame adapter that talks to an external game server via HTTP
// ---------------------------------------------------------------------------

export class RemoteGame implements IGame {
  private baseUrl: string
  private instanceId: string | null = null
  private _meta: GameMeta | null = null
  private _tools: ToolDef[] | null = null

  constructor(serverUrl: string) {
    // Strip trailing slash
    this.baseUrl = serverUrl.replace(/\/+$/, '')
  }

  // ---- meta & tools (lazy-fetched) ----

  get meta(): GameMeta {
    if (!this._meta) throw new Error('RemoteGame: call fetchMeta() before accessing meta')
    return this._meta
  }

  get tools(): ToolDef[] {
    if (!this._tools) throw new Error('RemoteGame: call fetchMeta() before accessing tools')
    return this._tools
  }

  /** Fetch and cache meta + tools from the remote server. */
  async fetchMeta(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/bout/meta`)
    if (!res.ok) throw new Error(`RemoteGame: GET /bout/meta failed (${res.status})`)
    const data = (await res.json()) as MetaResponse
    this._meta = data.meta
    this._tools = data.tools
  }

  // ---- IGame methods ----

  async initialState(agents: string[], wager: bigint): Promise<GameState> {
    const res = await fetch(`${this.baseUrl}/bout/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agents, wager: wager.toString() }),
    })
    if (!res.ok) throw new Error(`RemoteGame: POST /bout/games failed (${res.status})`)
    const data = (await res.json()) as CreateGameResponse
    this.instanceId = data.instanceId

    // Fetch the initial state
    const stateRes = await fetch(`${this.baseUrl}/bout/games/${this.instanceId}/state`)
    if (!stateRes.ok) throw new Error(`RemoteGame: GET state failed (${stateRes.status})`)
    const stateData = (await stateRes.json()) as GameStateResponse
    return stateData.state
  }

  async currentAgent(_state: GameState): Promise<string> {
    const id = this.requireInstance()
    const res = await fetch(`${this.baseUrl}/bout/games/${id}/state`)
    if (!res.ok) throw new Error(`RemoteGame: GET state failed (${res.status})`)
    const data = (await res.json()) as GameStateResponse
    return data.currentAgent
  }

  async getAgentView(_state: GameState, agentId: string): Promise<GameState> {
    const id = this.requireInstance()
    const res = await fetch(
      `${this.baseUrl}/bout/games/${id}/state?agent=${encodeURIComponent(agentId)}`,
    )
    if (!res.ok) throw new Error(`RemoteGame: GET state failed (${res.status})`)
    const data = (await res.json()) as GameStateResponse
    return data.state
  }

  async applyAction(_state: GameState, agentId: string, action: Action): Promise<TurnResult> {
    const id = this.requireInstance()
    const res = await fetch(`${this.baseUrl}/bout/games/${id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, action }),
    })
    if (!res.ok) throw new Error(`RemoteGame: POST action failed (${res.status})`)
    const data = (await res.json()) as ActionResponse
    return {
      newState: data.state,
      tokenDeltas: Object.fromEntries(
        Object.entries(data.tokenDeltas).map(([k, v]) => [k, BigInt(v)]),
      ),
      events: data.events,
      terminated: data.terminated,
    }
  }

  async isTerminal(_state: GameState): Promise<boolean> {
    const id = this.requireInstance()
    const res = await fetch(`${this.baseUrl}/bout/games/${id}/terminal`)
    if (!res.ok) throw new Error(`RemoteGame: GET terminal failed (${res.status})`)
    const data = (await res.json()) as TerminalResponse
    return data.terminated
  }

  async settle(_state: GameState, wager: bigint, feeBps: number): Promise<Settlement> {
    const id = this.requireInstance()
    const res = await fetch(`${this.baseUrl}/bout/games/${id}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wager: wager.toString(), feeBps }),
    })
    if (!res.ok) throw new Error(`RemoteGame: POST settle failed (${res.status})`)
    const data = (await res.json()) as SettleResponse
    this.instanceId = null // instance cleaned up server-side
    return {
      winner: data.winner,
      amounts: Object.fromEntries(
        Object.entries(data.amounts).map(([k, v]) => [k, BigInt(v)]),
      ),
      protocolFee: BigInt(data.protocolFee),
      builderFee: BigInt(data.builderFee),
    }
  }

  async forfeit(_state: GameState, agentId: string): Promise<GameState> {
    const id = this.requireInstance()
    const res = await fetch(`${this.baseUrl}/bout/games/${id}/forfeit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId }),
    })
    if (!res.ok) throw new Error(`RemoteGame: POST forfeit failed (${res.status})`)
    const data = (await res.json()) as ForfeitResponse
    return data.state
  }

  // ---- helpers ----

  private requireInstance(): string {
    if (!this.instanceId) {
      throw new Error('RemoteGame: no active game instance — call initialState() first')
    }
    return this.instanceId
  }
}
