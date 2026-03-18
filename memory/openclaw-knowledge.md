# OpenClaw 知识库

## 什么是 OpenClaw

OpenClaw 是一个运行在你自己设备上的**个人 AI 助手**。
- 在你已经使用的渠道上回复你（WhatsApp、Telegram、Slack、Discord、Google Chat、Signal、iMessage、飞书等）
- 可以在 macOS/iOS/Android 上说话和聆听
- 可以渲染你控制的实时 Canvas
- Gateway 只是控制平面 —— 产品本身就是助手

## 核心架构

```
WhatsApp / Telegram / Slack / Discord / Google Chat / Signal / iMessage / 飞书 / ...
 │
 ▼
┌───────────────────────────────┐
│ Gateway (控制平面)             │
│ ws://127.0.0.1:18789          │
└──────────────┬────────────────┘
               │
               ├─ Pi agent (RPC)
               ├─ CLI (openclaw …)
               ├─ WebChat UI
               ├─ macOS app
               └─ iOS / Android nodes
```

## 核心概念

### 1. Gateway（网关）
- 本地运行的控制平面
- 管理会话、渠道、工具和事件
- WebSocket 控制平面

### 2. Agent（智能体）
一个完全独立作用域的"大脑"，拥有自己的：
- **工作区**（文件、AGENTS.md/SOUL.md/USER.md、本地笔记、人设规则）
- **状态目录**（`agentDir`）用于认证配置文件、模型注册表
- **会话存储**（聊天历史 + 路由状态）

### 3. Session（会话）
- 主会话（direct chats）
- 群组隔离
- 激活模式、队列模式、回复模式

### 4. Channel（渠道）
支持：WhatsApp、Telegram、Slack、Discord、Google Chat、Signal、iMessage、BlueBubbles、IRC、Microsoft Teams、Matrix、飞书、LINE、Mattermost、Nextcloud Talk、Nostr、Synology Chat、Tlon、Twitch、Zalo、WebChat

### 5. Tools（工具）
- browser - 浏览器控制
- canvas - 画布操作
- nodes - 设备节点控制
- cron - 定时任务
- sessions - 会话工具

### 6. Skills（技能）
- bundled skills（内置）
- managed skills（托管）
- workspace skills（工作区级）

## 多智能体路由

### 什么是"一个智能体"？
- 独立的工作区 + 状态目录 + 会话存储
- 认证配置文件是每智能体独立的
- Skills 通过每个工作区的 `skills/` 文件夹实现独立

### 路由规则（消息如何选择智能体）
1. `peer` 匹配（精确私信/群组/频道 id）
2. `guildId`（Discord）
3. `teamId`（Slack）
4. 渠道的 `accountId` 匹配
5. 渠道级匹配
6. 回退到默认智能体

### 路径映射
- 配置：`~/.openclaw/openclaw.json`
- 状态目录：`~/.openclaw`
- 工作区：`~/.openclaw/workspace`
- 智能体目录：`~/.openclaw/agents/<agentId>/agent`
- 会话：`~/.openclaw/agents/<agentId>/sessions`

## 安全特性

### 沙箱隔离
- `sandbox.mode: "off"` - 无沙箱
- `sandbox.mode: "all"` - 始终沙箱隔离
- `sandbox.scope: "agent"` - 每智能体一个容器

### 工具限制
- 每智能体可以有自己的工具允许/拒绝列表
- `tools.elevated` 是全局的，基于发送者

### DM 策略
- `dmPolicy: "pairing"` - 需要配对码
- `dmPolicy: "open"` - 开放但需要允许列表

## 客户端应用

### macOS
- 菜单栏控制
- Voice Wake + 按键说话
- WebChat + 调试工具
- 远程 Gateway 控制

### iOS
- Canvas 支持
- Voice Wake
- 相机、屏幕录制
- Bonjour 设备配对

### Android
- Connect/Chat/Voice tabs
- Canvas、相机、屏幕录制
- 设备命令（通知/位置/SMS/照片/联系人/日历/运动）

## 语音能力

### Voice Wake
- macOS/iOS 上的唤醒词
- 持续语音（Android）

### Talk Mode
- ElevenLabs TTS
- 系统 TTS 回退

## 安装

```bash
npm install -g openclaw@latest
# 或
pnpm add -g openclaw@latest

openclaw onboard --install-daemon
```

## CLI 命令

```bash
# 发送消息
openclaw message send --to +1234567890 --message "Hello"

# 与助手对话
openclaw agent --message "Ship checklist" --thinking high

# 查看状态
openclaw status

# 配对管理
openclaw pairing approve
```

## 配置示例

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "default": true,
        "workspace": "~/.openclaw/workspace"
      }
    ]
  },
  "channels": {
    "whatsapp": {
      "dmPolicy": "allowlist",
      "allowFrom": ["+1234567890"]
    }
  }
}
```

---
*来源: https://docs.OpenClaw.ai + https://github.com/OpenClaw/OpenClaw*
*学习时间: 2026-03-17*
