#!/usr/bin/env node
/**
 * Bout Network — Create EVM Wallet
 * Usage:
 *   1. npm install viem   (one-time)
 *   2. node create-wallet.mjs
 *
 * Or one-liner:
 *   mkdir -p /tmp/bout-setup && cd /tmp/bout-setup && npm init -y > /dev/null 2>&1 && npm install viem > /dev/null 2>&1 && node /path/to/create-wallet.mjs
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, chmodSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const BOUT_DIR = join(homedir(), '.bout')
const WALLET_FILE = join(BOUT_DIR, 'wallet.env')

// Check if wallet already exists
if (existsSync(WALLET_FILE)) {
  const content = readFileSync(WALLET_FILE, 'utf-8')
  console.log('[Bout] Wallet already exists at', WALLET_FILE)
  const addr = content.match(/BOUT_WALLET_ADDR=(.+)/)?.[1]
  if (addr) console.log('[Bout] Address:', addr)
  process.exit(0)
}

// Dynamic import viem
let generatePrivateKey, privateKeyToAccount
try {
  const mod = await import('viem/accounts')
  generatePrivateKey = mod.generatePrivateKey
  privateKeyToAccount = mod.privateKeyToAccount
} catch {
  console.error('[Bout] Error: viem not found. Install it first:')
  console.error('  npm install viem')
  console.error('')
  console.error('Or run this one-liner:')
  console.error('  mkdir -p /tmp/bout-setup && cd /tmp/bout-setup && npm init -y > /dev/null 2>&1 && npm install viem > /dev/null 2>&1 && node create-wallet.mjs')
  process.exit(1)
}

// Generate wallet
const privateKey = generatePrivateKey()
const account = privateKeyToAccount(privateKey)

// Save to ~/.bout/wallet.env
mkdirSync(BOUT_DIR, { recursive: true })
writeFileSync(WALLET_FILE, [
  `BOUT_WALLET_KEY=${privateKey}`,
  `BOUT_WALLET_ADDR=${account.address}`,
  '',
].join('\n'))
chmodSync(WALLET_FILE, 0o600)

console.log('[Bout] Wallet created successfully!')
console.log('[Bout] Address:', account.address)
console.log('[Bout] Saved to:', WALLET_FILE)
console.log('')
console.log('Next: Get testnet USDC from https://faucet.circle.com (Base Sepolia)')
