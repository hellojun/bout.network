import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { paymentMiddlewareFromConfig } from '@x402/hono'
import { ExactEvmScheme } from '@x402/evm/exact/server'

// BigInt cannot be serialized by JSON.stringify — patch globally
;(BigInt.prototype as any).toJSON = function () {
  return this.toString()
}

import { agentRoutes } from './routes/agents.js'
import { battleRoutes } from './routes/battles.js'
import { roomRoutes } from './routes/rooms.js'
import { statsRoutes } from './routes/stats.js'

const REQUIRE_PAYMENT = process.env.REQUIRE_PAYMENT !== 'false'
const ESCROW_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000'
const USDC_ADDRESS = process.env.USDC_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e'

const app = new Hono()

app.use(
  '*',
  cors({
    origin: '*',
    allowHeaders: [
      'Content-Type',
      'X-API-Key',
      'X-PAYMENT',
      'PAYMENT-SIGNATURE',
      'Access-Control-Expose-Headers',
    ],
    exposeHeaders: ['PAYMENT-REQUIRED', 'PAYMENT-RESPONSE', 'X-PAYMENT-RESPONSE'],
  }),
)

// ---------------------------------------------------------------------------
// x402 payment middleware — gates room creation and joining
// ---------------------------------------------------------------------------
if (REQUIRE_PAYMENT) {
  const wagerPaymentOption = {
    scheme: 'exact' as const,
    network: 'eip155:84532' as const,
    payTo: ESCROW_ADDRESS,
    price: { amount: '1000000', asset: USDC_ADDRESS }, // 1 USDC
    maxTimeoutSeconds: 300,
    extra: { name: 'USDC', version: '2' },
  }

  app.use(
    paymentMiddlewareFromConfig(
      {
        'POST /v1/rooms': {
          accepts: wagerPaymentOption,
          description: 'Bout wager deposit — create room (1 USDC)',
        },
        'POST /v1/rooms/*/join': {
          accepts: wagerPaymentOption,
          description: 'Bout wager deposit — join room (1 USDC)',
        },
      },
      undefined, // default HTTP facilitator (x402.org)
      [{ network: 'eip155:84532', server: new ExactEvmScheme() }],
    ),
  )
}

app.get('/health', (c) =>
  c.json({ status: 'ok', timestamp: new Date().toISOString() }),
)

app.route('/v1/agent', agentRoutes)
app.route('/v1/rooms', roomRoutes)
app.route('/v1/battles', battleRoutes)
app.route('/v1/battle', battleRoutes)
app.route('/v1', statsRoutes)

const port = Number(process.env.PORT || 3000)
const server = serve({ fetch: app.fetch, port })

console.log(`Bout API running on http://localhost:${port}`)
