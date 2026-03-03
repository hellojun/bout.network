#!/usr/bin/env npx tsx
/**
 * 端到端测试脚本 — 模拟两个 agent 完整对战流程
 *
 * 前置条件：
 *   1. PostgreSQL + Redis 运行中
 *   2. bout API 运行中:      cd apps/api && pnpm dev
 *   3. Judge worker 运行中:   cd apps/judge && pnpm dev
 *   4. (可选) 五子棋外部服务器: cd ../bout-game-gomoku && npm run dev
 *   5. x402 支付关闭:         REQUIRE_PAYMENT=false
 *
 * 用法：
 *   pnpm test:e2e
 *
 * 流程：
 *   注册 Agent A → 注册 Agent B → A 创建房间 → B 加入房间
 *   → Battle 开始 → 轮流提交走步 → 对战结束
 */

import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------

const API = process.env.API_URL || 'http://localhost:3000'
const GAME_ID = process.env.GAME_ID || 'gomoku'

// 测试用私钥（不要用于真实资金！）
const PRIVATE_KEY_A = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const
const PRIVATE_KEY_B = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as const

// 预设走法 — 黑棋(A)横排五连胜
const MOVES: [string, number, number][] = [
  ['A', 7, 3],
  ['B', 8, 3],
  ['A', 7, 4],
  ['B', 8, 4],
  ['A', 7, 5],
  ['B', 8, 5],
  ['A', 7, 6],
  ['B', 8, 6],
  ['A', 7, 7], // 五连！
]

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

async function api(
  path: string,
  opts: { method?: string; body?: unknown; apiKey?: string } = {},
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.apiKey) headers['X-API-Key'] = opts.apiKey

  const res = await fetch(`${API}${path}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(`${opts.method || 'GET'} ${path} → ${res.status}: ${JSON.stringify(data)}`)
  }
  return data
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// ---------------------------------------------------------------------------
// 注册 Agent（用 viem 签名）
// ---------------------------------------------------------------------------

async function registerAgent(name: string, privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey)
  const timestamp = Math.floor(Date.now() / 1000)
  const message = `bout-register:${name}:${timestamp}`
  const walletProof = await account.signMessage({ message })

  const data = await api('/v1/agent/register', {
    method: 'POST',
    body: {
      name,
      walletAddress: account.address,
      walletProof,
      timestamp,
      framework: 'test-script',
    },
  })

  return { agentId: data.agentId as string, apiKey: data.apiKey as string }
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

async function main() {
  console.log('╔══════════════════════════════════════════╗')
  console.log('║    bout.network 端到端对战测试           ║')
  console.log('╚══════════════════════════════════════════╝')
  console.log()

  // 0. 健康检查
  try {
    await api('/health')
    console.log('✅ API 服务正常')
  } catch {
    console.error('❌ API 服务不可达，请先启动: cd apps/api && REQUIRE_PAYMENT=false pnpm dev')
    process.exit(1)
  }

  // 1. 注册两个 Agent
  console.log()
  console.log('── 步骤 1: 注册 Agent ──')
  const suffix = Date.now().toString(36)
  const agentA = await registerAgent(`test-alice-${suffix}`, PRIVATE_KEY_A)
  console.log(`  Agent A: id=${agentA.agentId}`)
  const agentB = await registerAgent(`test-bob-${suffix}`, PRIVATE_KEY_B)
  console.log(`  Agent B: id=${agentB.agentId}`)

  // 2. Agent A 创建房间
  console.log()
  console.log('── 步骤 2: 创建房间 ──')
  const room = await api('/v1/rooms', {
    method: 'POST',
    apiKey: agentA.apiKey,
    body: { gameId: GAME_ID },
  })
  console.log(`  房间 ID: ${room.id}, 状态: ${room.status}`)

  // 3. Agent B 加入房间
  console.log()
  console.log('── 步骤 3: 加入房间 ──')
  const joinResult = await api(`/v1/rooms/${room.id}/join`, {
    method: 'POST',
    apiKey: agentB.apiKey,
  })
  const battleId = joinResult.battleId
  console.log(`  Battle ID: ${battleId}, 状态: ${joinResult.status}`)

  // 4. 等待 Judge 启动对战
  console.log()
  console.log('── 步骤 4: 等待对战开始 ──')
  let battleStarted = false
  for (let i = 0; i < 30; i++) {
    await sleep(500)
    try {
      const state = await api(`/v1/battles/${battleId}/state`, { apiKey: agentA.apiKey })
      if (state.status === 'active') {
        console.log(`  对战已开始！ 当前轮到: ${state.currentTurnAgentId}`)
        battleStarted = true
        break
      }
      process.stdout.write('.')
    } catch {
      process.stdout.write('.')
    }
  }

  if (!battleStarted) {
    console.error('\n❌ 对战超时未开始，请确认 Judge worker 正在运行: cd apps/judge && pnpm dev')
    process.exit(1)
  }

  // 5. 轮流提交走步
  console.log()
  console.log('── 步骤 5: 对战进行中 ──')

  const agentMap: Record<string, { id: string; apiKey: string }> = {
    A: agentA,
    B: agentB,
  }

  for (const [side, row, col] of MOVES) {
    const agent = agentMap[side]
    const symbol = side === 'A' ? '●' : '○'

    // 等待轮到自己
    for (let i = 0; i < 20; i++) {
      const state = await api(`/v1/battles/${battleId}/state`, { apiKey: agent.apiKey })
      if (state.status === 'finished') {
        console.log(`  游戏已结束 — 胜者: ${state.winner}`)
        break
      }
      if (state.isYourTurn) break
      await sleep(300)
    }

    // 提交走步
    await api('/v1/battle/action', {
      method: 'POST',
      apiKey: agent.apiKey,
      body: { battleId, tool: 'place_stone', args: { row, col } },
    })
    console.log(`  ${side} ${symbol} → (${row}, ${col})`)

    // 短暂等待 Judge 处理
    await sleep(300)
  }

  // 6. 等待对战结束
  console.log()
  console.log('── 步骤 6: 等待结算 ──')
  let finalState: any = null
  for (let i = 0; i < 20; i++) {
    await sleep(500)
    const state = await api(`/v1/battles/${battleId}/state`, { apiKey: agentA.apiKey })
    if (state.status === 'finished') {
      finalState = state
      break
    }
    process.stdout.write('.')
  }

  if (!finalState) {
    // 也检查下 DB 状态
    const battle = await api(`/v1/battles/${battleId}`)
    if (battle.status === 'finished') {
      finalState = battle
    }
  }

  if (finalState) {
    console.log()
    console.log('╔══════════════════════════════════════════╗')
    console.log(`║  游戏结束！                              ║`)
    console.log(`║  胜者: ${(finalState.winner || finalState.winnerId || 'unknown').padEnd(33)}║`)
    console.log(`║  原因: ${(finalState.finishReason || 'terminal').padEnd(33)}║`)
    console.log('╚══════════════════════════════════════════╝')
  } else {
    console.log('\n⚠️  未能获取最终结果，请手动检查')
  }

  console.log()
  console.log('✅ 端到端测试完成！')
}

main().catch((err) => {
  console.error('❌ 测试失败:', err.message || err)
  process.exit(1)
})
