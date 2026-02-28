// 修复后的五子棋 AI
export function smartMove(board, myColor, opponentColor) {
  const DIRECTIONS = [
    [0, 1],   // 横
    [1, 0],   // 竖
    [1, 1],   // 斜 \
    [1, -1]   // 斜 /
  ];
  
  // 检查某个位置某个方向能形成多少连子
  function countLine(r, c, dr, dc, color) {
    let count = 1; // 包括当前位置
    
    // 正向
    for (let i = 1; i < 5; i++) {
      const nr = r + dr * i;
      const nc = c + dc * i;
      if (nr < 0 || nr >= 15 || nc < 0 || nc >= 15) break;
      if (board[nr][nc] === color) count++;
      else break;
    }
    
    // 反向
    for (let i = 1; i < 5; i++) {
      const nr = r - dr * i;
      const nc = c - dc * i;
      if (nr < 0 || nr >= 15 || nc < 0 || nc >= 15) break;
      if (board[nr][nc] === color) count++;
      else break;
    }
    
    return count;
  }
  
  // 评估某个空位对某种颜色的价值
  function evaluatePosition(r, c, color) {
    if (board[r][c] !== 0) return -1;
    
    let maxScore = 0;
    
    for (const [dr, dc] of DIRECTIONS) {
      // 模拟在这里下子
      board[r][c] = color;
      const count = countLine(r, c, dr, dc, color);
      board[r][c] = 0; // 恢复
      
      // 评分
      let score = 0;
      if (count >= 5) score = 100000;      // 成五
      else if (count === 4) score = 10000; // 活四/冲四
      else if (count === 3) score = 1000;  // 三连
      else if (count === 2) score = 100;   // 二连
      else if (count === 1) score = 10;
      
      maxScore = Math.max(maxScore, score);
    }
    
    return maxScore;
  }
  
  // 查找候选位置
  const candidates = [];
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      if (board[r][c] === 0) {
        let hasNeighbor = false;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < 15 && nc >= 0 && nc < 15 && board[nr][nc] !== 0) {
              hasNeighbor = true;
              break;
            }
          }
          if (hasNeighbor) break;
        }
        
        if (hasNeighbor || (r >= 5 && r <= 9 && c >= 5 && c <= 9)) {
          candidates.push({ r, c });
        }
      }
    }
  }
  
  // 第一手：天元
  if (candidates.length === 224) {
    return { row: 7, col: 7 };
  }
  
  const DEBUG = process.env.DEBUG_AI === '1';
  const debugMoves = [];
  
  let bestMove = null;
  let bestScore = -Infinity;
  
  for (const pos of candidates) {
    const attackScore = evaluatePosition(pos.r, pos.c, myColor);
    const defenseScore = evaluatePosition(pos.r, pos.c, opponentColor);
    
    // 防守优先策略
    let totalScore;
    if (defenseScore >= 10000) {
      totalScore = defenseScore * 2; // 必须挡四
    } else if (defenseScore >= 1000) {
      totalScore = defenseScore * 2 + attackScore; // 三连必须挡！
    } else {
      totalScore = attackScore + defenseScore * 1.2;
    }
    
    const centerBonus = 10 - Math.abs(pos.r - 7) - Math.abs(pos.c - 7);
    const finalScore = totalScore + centerBonus;
    
    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestMove = pos;
    }
    
    if (DEBUG && (attackScore >= 100 || defenseScore >= 100)) {
      debugMoves.push({ pos, attackScore, defenseScore, totalScore, finalScore });
    }
  }
  
  if (DEBUG) {
    debugMoves.sort((a, b) => b.finalScore - a.finalScore);
    console.log('\n🔍 Top 5 评分:');
    for (const m of debugMoves.slice(0, 5)) {
      console.log(`  (${m.pos.r},${m.pos.c}): 攻${m.attackScore} 防${m.defenseScore} → ${m.finalScore.toFixed(0)}`);
    }
  }
  
  return bestMove ? { row: bestMove.r, col: bestMove.c } : { row: 7, col: 7 };
}
