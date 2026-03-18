
# OpenClaw 知识库

## 1. 多智能体路由文档
来源：https://docs.OpenClaw.ai/zh-CN/concepts/multi-agent

### 什么是"一个智能体"？

一个**智能体**是一个完全独立作用域的大脑，拥有自己的：
- **工作区**（文件、AGENTS.md/SOUL.md/USER.md、本地笔记、人设规则）
- **状态目录**（`agentDir`）用于认证配置文件、模型注册表和每智能体配置
- **会话存储**（聊天历史 + 路由状态）位于 `~/.openclaw/agents/&lt;agentId&gt;/sessions` 下

### 路径（快速映射）
* 配置：`~/.openclaw/openclaw.json`（或 `OPENCLAW_CONFIG_PATH`）
* 状态目录：`~/.openclaw`（或 `OPENCLAW_STATE_DIR`）
* 工作区：`~/.openclaw/workspace`（或 `~/.openclaw/workspace-&lt;agentId&gt;`）
* 智能体目录：`~/.openclaw/agents/&lt;agentId&gt;/agent`（或 `agents.list[].agentDir`）
* 会话：`~/.openclaw/agents/&lt;agentId&gt;/sessions`

### 路由规则（消息如何选择智能体）
绑定是**确定性的**，**最具体的优先**：
1. `peer` 匹配（精确私信/群组/频道 id）
2. `guildId`（Discord）
3. `teamId`（Slack）
4. 渠道的 `accountId` 匹配
5. 渠道级匹配（`accountId: "*"`）
6. 回退到默认智能体（`agents.list[].default`，否则列表中的第一个条目，默认：`main`）

---

## 2. GitHub 仓库 README
来源：https://github.com/OpenClaw/OpenClaw/

### OpenClaw 是什么？
OpenClaw 是一个你可以在自己设备上运行的个人 AI 助手。
它可以在你已使用的渠道上回复你（WhatsApp, Telegram, Slack, Discord, Google Chat, Signal, iMessage, BlueBubbles, IRC, Microsoft Teams, Matrix, Feishu, LINE, Mattermost, Nextcloud Talk, Nostr, Synology Chat, Tlon, Twitch, Zalo, Zalo Personal, WebChat）。

### 核心功能
- **多渠道收件箱**：支持众多消息平台
- **多智能体路由**：将入站渠道/账户/对等方路由到隔离的智能体（工作区 + 每智能体会话）
- **语音唤醒 + 通话模式**：在 macOS/iOS 上支持唤醒词，Android 上支持连续语音
- **实时 Canvas**：由智能体驱动的视觉工作区，支持 A2UI
- **一流工具**：浏览器、画布、节点、cron、会话和 Discord/Slack 操作
- **配套应用**：macOS 菜单栏应用 + iOS/Android 节点
- **技能平台**：捆绑、托管和工作区技能，带有安装控制 + UI

### 快速开始
```bash
npm install -g openclaw@latest
# 或：pnpm add -g openclaw@latest

openclaw onboard --install-daemon
```

### 主要命令
- `/status` — 紧凑会话状态
- `/new` 或 `/reset` — 重置会话
- `/compact` — 紧凑会话上下文（摘要）
- `/think` — off|minimal|low|medium|high|xhigh
- `/verbose on|off`
- `/usage off|tokens|full`
- `/restart` — 重启网关（群组中仅所有者可用）
- `/activation mention|always` — 群组激活切换（仅群组）

### 架构概览
```
WhatsApp / Telegram / Slack / Discord / Google Chat / Signal / iMessage / BlueBubbles / IRC / Microsoft Teams / Matrix / Feishu / LINE / Mattermost / Nextcloud Talk / Nostr / Synology Chat / Tlon / Twitch / Zalo / Zalo Personal / WebChat
 │
 ▼
┌───────────────────────────────┐
│ Gateway                       │
│ (control plane)               │
│ ws://127.0.0.1:18789         │
└──────────────┬────────────────┘
               │
        ├─────── Pi agent (RPC)
        ├─────── CLI (openclaw …)
        ├─────── WebChat UI
        ├─────── macOS app
        └─────── iOS / Android nodes
```

