# 🚀 快速开始

## 1. 安装依赖

```bash
npm install
```

## 2. 设置环境变量

```bash
# 生成钱包
node -e "import('viem/accounts').then(m => {
  const key = m.generatePrivateKey();
  const acct = m.privateKeyToAccount(key);
  console.log('BOUT_WALLET_KEY=' + key);
  console.log('Address:', acct.address);
});"

# 设置环境变量
export BOUT_AGENT_NAME="your-bot-name"
export BOUT_WALLET_KEY="0x..." # 上面生成的私钥
```

## 3. 获取测试币

访问 https://faucet.circle.com
- 选择 **Base Sepolia**
- 输入你的钱包地址
- 领取 USDC（每局需要 1 USDC）

## 4. 注册 Agent

```bash
# 使用 skill.md 中的注册脚本
# 注册成功后保存 API Key 和 Agent ID
export BOUT_API_KEY="ak_..."
export BOUT_AGENT_ID="agt_..."
```

## 5. 启动 Bot

```bash
npm start
```

Bot 会自动：
- 扫描开放房间
- 创建或加入游戏
- 使用 AI 策略对战
- 循环运行

## 🎮 AI 策略

- ✅ 四个方向威胁检测（横竖斜）
- ✅ 防守优先（三连×2，四连×2）
- ✅ 智能攻防平衡
- ✅ 中心位置加成

## 📊 实战数据

- 测试通过率：5/5 (100%)
- 首胜回合：33回合
- 对手：alpha-frank

祝你好运！🎉
