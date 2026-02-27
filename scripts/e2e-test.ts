import { createHash } from 'crypto'
import { createWalletClient, http, type Hex } from 'viem'
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

const API_BASE = process.env.API_URL || 'http://localhost:3000'

async function fetchAPI(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  const data = await res.json()
  if (!res.ok && res.status !== 402) {
    throw new Error(`API Error ${res.status}: ${JSON.stringify(data)}`)
  }
  return { data, status: res.status }
}

async function registerAgent(name: string) {
  const privateKey = generatePrivateKey()
  const account = privateKeyToAccount(privateKey)
  const timestamp = Math.floor(Date.now() / 1000)
  const message = `bout-register:${name}:${timestamp}`

  const walletProof = await account.signMessage({ message })

  const { data } = await fetchAPI('/v1/agent/register', {
    method: 'POST',
    body: JSON.stringify({
      name,
      walletAddress: account.address,
      walletProof,
      timestamp,
      framework: 'e2e-test',
    }),
  })

  return { ...data, privateKey, account }
}

async function runE2ETest() {
  console.log('=== Bout MVP End-to-End Test ===\n')

  // 1. Check health
  console.log('Step 1: Health check...')
  const { data: health } = await fetchAPI('/health')
  console.log('  Health:', health.status)
  if (health.status !== 'ok') throw new Error('Health check failed')

  // 2. Register two agents
  console.log('\nStep 2: Registering agents...')
  const agentA = await registerAgent(`e2e-alpha-${Date.now()}`)
  console.log(`  Agent A: ${agentA.agentId} (${agentA.name})`)

  const agentB = await registerAgent(`e2e-beta-${Date.now()}`)
  console.log(`  Agent B: ${agentB.agentId} (${agentB.name})`)

  // 3. Check stats
  console.log('\nStep 3: Checking global stats...')
  const { data: stats } = await fetchAPI('/v1/stats/global')
  console.log('  Stats:', stats)

  // 4. Agent A creates a room
  console.log('\nStep 4: Agent A creates a room...')
  const { data: room } = await fetchAPI('/v1/rooms', {
    method: 'POST',
    headers: { 'X-API-Key': agentA.apiKey },
    body: JSON.stringify({ gameId: 'gomoku', wager: 100 }),
  })
  console.log(`  Room: ${room.id} (wager: ${room.wager})`)

  // 5. List rooms
  console.log('\nStep 5: Listing open rooms...')
  const { data: roomList } = await fetchAPI('/v1/rooms?status=open')
  console.log(`  Open rooms: ${roomList.rooms.length}`)

  // 6. Agent B joins the room (dev mode skips x402 payment)
  console.log('\nStep 6: Agent B joins the room...')
  const { data: joinResult } = await fetchAPI(`/v1/rooms/${room.id}/join`, {
    method: 'POST',
    headers: { 'X-API-Key': agentB.apiKey },
  })
  console.log(`  Battle created: ${joinResult.battleId}`)

  // 7. Wait a moment for the battle to start
  console.log('\nStep 7: Waiting for battle to start...')
  await new Promise((r) => setTimeout(r, 2000))

  // 8. Submit moves (simplified: both agents just play center area)
  console.log('\nStep 8: Submitting moves...')

  const battleId = joinResult.battleId

  // Agent A places at center
  const { data: moveA1 } = await fetchAPI('/v1/battle/action', {
    method: 'POST',
    headers: { 'X-API-Key': agentA.apiKey },
    body: JSON.stringify({
      battleId,
      tool: 'place_stone',
      args: { row: 7, col: 7 },
    }),
  })
  console.log(`  Agent A move [7,7]: ${moveA1.status}`)

  await new Promise((r) => setTimeout(r, 1000))

  // Agent B places nearby
  const { data: moveB1 } = await fetchAPI('/v1/battle/action', {
    method: 'POST',
    headers: { 'X-API-Key': agentB.apiKey },
    body: JSON.stringify({
      battleId,
      tool: 'place_stone',
      args: { row: 7, col: 8 },
    }),
  })
  console.log(`  Agent B move [7,8]: ${moveB1.status}`)

  // 9. Check battle status
  console.log('\nStep 9: Checking battle status...')
  await new Promise((r) => setTimeout(r, 1000))
  const { data: battle } = await fetchAPI(`/v1/battle/${battleId}`)
  console.log(`  Battle status: ${battle.status}`)
  console.log(`  Replay data entries: ${(battle.replayData || []).length}`)

  // 10. Check leaderboard
  console.log('\nStep 10: Checking leaderboard...')
  const { data: leaderboard } = await fetchAPI('/v1/leaderboard')
  console.log(`  Leaderboard entries: ${leaderboard.leaderboard.length}`)

  // 11. Check agent details
  console.log('\nStep 11: Checking agent details...')
  const { data: agentDetail } = await fetchAPI(`/v1/agents/${agentA.agentId}`)
  console.log(`  Agent A rating: ${agentDetail.rating}`)

  console.log('\n=== E2E Test Complete ===')
  console.log('All basic API flows verified successfully!')
}

runE2ETest().catch((err) => {
  console.error('\n=== E2E Test FAILED ===')
  console.error(err)
  process.exit(1)
})
