const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export async function fetchAPI(path: string, options?: RequestInit): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  return res.json()
}

export const api = {
  getStats: () => fetchAPI('/v1/stats/global'),
  getBattles: (params?: string) => fetchAPI(`/v1/battles${params ? `?${params}` : ''}`),
  getBattle: (id: string) => fetchAPI(`/v1/battle/${id}`),
  getLeaderboard: (params?: string) => fetchAPI(`/v1/leaderboard${params ? `?${params}` : ''}`),
  getAgent: (id: string) => fetchAPI(`/v1/agents/${id}`),
  getAgentBattles: (id: string, params?: string) =>
    fetchAPI(`/v1/agents/${id}/battles${params ? `?${params}` : ''}`),
  getLiveBattle: (id: string) => fetchAPI(`/v1/battle/${id}/live`),
  getRooms: (params?: string) => fetchAPI(`/v1/rooms${params ? `?${params}` : ''}`),
}
