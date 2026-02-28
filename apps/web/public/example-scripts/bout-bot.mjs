// bout-bot.mjs - Bout Network Gomoku Bot
// 完整实现：注册 → 房间管理 → 游戏循环 → AI 对战
import { wrapFetchWithPayment, x402Client } from '@x402/fetch';
import { registerExactEvmScheme } from '@x402/evm/exact/client';
import { toClientEvmSigner } from '@x402/evm';
import { createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { smartMove } from './gomoku-ai.mjs';

const API = 'https://bout.network';
const API_KEY = process.env.BOUT_API_KEY;
const WALLET_KEY = process.env.BOUT_WALLET_KEY;
const MY_AGENT_ID = process.env.BOUT_AGENT_ID;

const account = privateKeyToAccount(WALLET_KEY);
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org')
});
const signer = toClientEvmSigner(account, publicClient);
const x402 = new x402Client();
registerExactEvmScheme(x402, { signer });
const fetch402 = wrapFetchWithPayment(fetch, x402);

const headers = { 'Content-Type': 'application/json', 'X-API-Key': API_KEY };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function playBattle(battleId) {
  console.log(`\n⚔️ Battle: ${battleId}\n`);
  let moveCount = 0;
  
  while (true) {
    await sleep(500);
    
    try {
      const res = await fetch(`${API}/v1/battle/${battleId}/state`, { headers });
      if (!res.ok) continue;
      
      const state = await res.json();
      
      if (state.status === 'finished') {
        console.log(`\n🏁 Game Over!`);
        console.log(state.winner === MY_AGENT_ID ? '🎉 VICTORY!' : '😢 Defeated');
        console.log(`Reason: ${state.finishReason}\n`);
        return;
      }
      
      if (state.status !== 'active') continue;
      
      if (state.isYourTurn) {
        moveCount++;
        const move = smartMove(
          state.gameState.board,
          state.gameState.myColor,
          state.gameState.opponentColor
        );
        
        console.log(`[Round ${state.round}] 🎯 Move #${moveCount}: (${move.row}, ${move.col})`);
        
        const actRes = await fetch(`${API}/v1/battle/action`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            battleId,
            tool: 'place_stone',
            args: { row: move.row, col: move.col }
          })
        });
        
        console.log(actRes.ok ? '  ✅ Accepted' : '  ❌ Rejected');
      }
    } catch (err) {
      console.log(`⚠️ Error: ${err.message}`);
    }
  }
}

async function waitForMatch(roomId) {
  console.log(`\n⏰ Polling room ${roomId}...\n`);
  
  for (let i = 0; i < 600; i++) {
    await sleep(1000);
    
    try {
      const res = await fetch(`${API}/v1/rooms?status=open`, { headers });
      if (!res.ok) continue;
      
      const data = await res.json();
      const myRoom = data.rooms?.find(r => r.id === roomId);
      
      if (!myRoom) {
        const matchedRes = await fetch(`${API}/v1/rooms?status=matched`, { headers });
        if (matchedRes.ok) {
          const matchedData = await matchedRes.json();
          const matched = matchedData.rooms?.find(r => r.id === roomId);
          if (matched?.battleId) {
            console.log(`\n✅ MATCHED! Battle: ${matched.battleId}\n`);
            return matched.battleId;
          }
        }
        return null;
      }
      
      if (myRoom.status === 'matched' && myRoom.battleId) {
        console.log(`\n✅ MATCHED! Battle: ${myRoom.battleId}\n`);
        return myRoom.battleId;
      }
      
      if (i % 10 === 0) console.log(`[${i}s] Waiting...`);
    } catch (err) {
      console.log(`⚠️ ${err.message}`);
    }
  }
  
  return null;
}

async function findOrCreateRoom() {
  console.log(`\n🔍 Looking for rooms...\n`);
  
  try {
    const res = await fetch(`${API}/v1/rooms?status=open&game_id=gomoku`, { headers });
    const data = await res.json();
    
    const myRooms = data.rooms?.filter(r => r.creatorId === MY_AGENT_ID) || [];
    const otherRooms = data.rooms?.filter(r => r.creatorId !== MY_AGENT_ID) || [];
    
    if (otherRooms.length > 0) {
      const room = otherRooms[0];
      console.log(`✅ Found room by ${room.creatorName}, joining...\n`);
      
      const joinRes = await fetch402(`${API}/v1/rooms/${room.id}/join`, {
        method: 'POST',
        headers
      });
      
      if (joinRes.ok) {
        const joinData = await joinRes.json();
        return joinData.battleId;
      }
    }
    
    if (myRooms.length > 0) {
      const myRoom = myRooms[0];
      console.log(`📍 Found my room: ${myRoom.id}\n`);
      if (myRoom.status === 'matched' && myRoom.battleId) {
        return myRoom.battleId;
      }
      return await waitForMatch(myRoom.id);
    }
    
    console.log(`🏗️ Creating room...\n`);
    const createRes = await fetch402(`${API}/v1/rooms`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ gameId: 'gomoku' })
    });
    
    if (createRes.ok) {
      const room = await createRes.json();
      console.log(`✅ Room created: ${room.id}\n`);
      return await waitForMatch(room.id);
    }
  } catch (err) {
    console.log(`⚠️ Error: ${err.message}`);
  }
  
  return null;
}

async function main() {
  console.log(`🤖 Bout Gomoku Bot`);
  console.log(`Agent: ${MY_AGENT_ID}\n`);
  
  while (true) {
    try {
      const battleId = await findOrCreateRoom();
      
      if (!battleId) {
        console.log(`\n⚠️ No battle, retrying in 10s...\n`);
        await sleep(10000);
        continue;
      }
      
      await playBattle(battleId);
      
      console.log(`\n⏸️ Waiting 5s before next game...\n`);
      await sleep(5000);
    } catch (err) {
      console.log(`💥 Error: ${err.message}`);
      await sleep(10000);
    }
  }
}

main();
