
#!/usr/bin/env bash
# OpenClaw 文档更新检查脚本
# 每天早上 8 点执行，检查官方文档和 GitHub 仓库是否有更新

set -e

WORKSPACE_DIR="/root/.openclaw/workspace"
KNOWLEDGE_DIR="$WORKSPACE_DIR/knowledge"
STATE_FILE="$KNOWLEDGE_DIR/.doc-update-state.json"
MULTI_AGENT_URL="https://docs.OpenClaw.ai/zh-CN/concepts/multi-agent"
GITHUB_REPO_URL="https://github.com/OpenClaw/OpenClaw/"

mkdir -p "$KNOWLEDGE_DIR"

# 读取上次状态
if [ -f "$STATE_FILE" ]; then
    LAST_STATE=$(cat "$STATE_FILE")
else
    LAST_STATE='{"multi_agent_hash": "", "github_hash": ""}'
fi

# 获取当前内容的哈希值
get_url_hash() {
    local url=$1
    curl -sL "$url" | sha256sum | awk '{print $1}'
}

MULTI_AGENT_HASH=$(get_url_hash "$MULTI_AGENT_URL")
GITHUB_HASH=$(get_url_hash "$GITHUB_REPO_URL")

# 解析上次状态
LAST_MULTI_AGENT=$(echo "$LAST_STATE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('multi_agent_hash', ''))")
LAST_GITHUB=$(echo "$LAST_STATE" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('github_hash', ''))")

UPDATE_SUMMARY=""

# 检查多智能体文档更新
if [ "$MULTI_AGENT_HASH" != "$LAST_MULTI_AGENT" ]; then
    UPDATE_SUMMARY+="📚 多智能体路由文档有更新\n"
    UPDATE_SUMMARY+="   来源: $MULTI_AGENT_URL\n"
    UPDATE_SUMMARY+="   更新时间: $(date '+%Y-%m-%d %H:%M:%S')\n\n"
fi

# 检查 GitHub 仓库更新
if [ "$GITHUB_HASH" != "$LAST_GITHUB" ]; then
    UPDATE_SUMMARY+="🦞 GitHub 仓库有更新\n"
    UPDATE_SUMMARY+="   来源: $GITHUB_REPO_URL\n"
    UPDATE_SUMMARY+="   更新时间: $(date '+%Y-%m-%d %H:%M:%S')\n\n"
fi

# 如果有更新，保存新状态
if [ -n "$UPDATE_SUMMARY" ]; then
    # 更新状态文件
    cat &gt; "$STATE_FILE" &lt;&lt;EOF
{
    "multi_agent_hash": "$MULTI_AGENT_HASH",
    "github_hash": "$GITHUB_HASH",
    "last_checked": "$(date '+%Y-%m-%d %H:%M:%S')"
}
EOF

    # 重新获取并更新知识库文件
    python3 &lt;&lt; 'PYTHON'
import requests
import json
from bs4 import BeautifulSoup
import re
import os

KNOWLEDGE_DIR = "/root/.openclaw/workspace/knowledge"
os.makedirs(KNOWLEDGE_DIR, exist_ok=True)

# 1. 获取多智能体文档
multi_agent_url = "https://docs.OpenClaw.ai/zh-CN/concepts/multi-agent"
multi_agent_response = requests.get(multi_agent_url)
multi_agent_content = multi_agent_response.text

# 2. 获取 GitHub README
github_url = "https://github.com/OpenClaw/OpenClaw/"
github_response = requests.get(github_url)
github_content = github_response.text

# 3. 保存原始内容用于分析
with open(f"{KNOWLEDGE_DIR}/multi-agent.raw.html", "w") as f:
    f.write(multi_agent_content)
with open(f"{KNOWLEDGE_DIR}/github.raw.html", "w") as f:
    f.write(github_content)

# 4. 生成更新后的知识库文档
output_content = f"""# OpenClaw 知识库

## 更新记录
- 最后更新: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

---

## 1. 多智能体路由文档
来源: https://docs.OpenClaw.ai/zh-CN/concepts/multi-agent

### 内容摘要
(原始内容已保存至 knowledge/multi-agent.raw.html)

---

## 2. GitHub 仓库
来源: https://github.com/OpenClaw/OpenClaw/

### 内容摘要
(原始内容已保存至 knowledge/github.raw.html)
"""

with open(f"{KNOWLEDGE_DIR}/openclaw-docs.md", "w") as f:
    f.write(output_content)

print("知识库已更新")
PYTHON

    # 输出更新摘要用于发送
    echo "=== DOCUMENT UPDATE SUMMARY ==="
    echo "$UPDATE_SUMMARY"
else
    echo "=== NO DOCUMENT UPDATES ==="
    echo "文档未更新"
fi

