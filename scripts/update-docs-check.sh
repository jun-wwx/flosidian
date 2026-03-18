#!/bin/bash
# OpenClaw 文档更新检查脚本
# 每天早上 8 点执行，检查官方文档是否更新
# 更新后发送通知到当前飞书对话

set -e

DOCS_DIR="/root/.openclaw/workspace/docs"
MULTI_AGENT_URL="https://docs.OpenClaw.ai/zh-CN/concepts/multi-agent"
GITHUB_RAW_URL="https://raw.githubusercontent.com/OpenClaw/OpenClaw/main/README.md"
TARGET_CHAT="ou_870e35473e9a01cb39d3c961ae1cb7d2"

echo "=== 开始检查 OpenClaw 文档更新 ==="
date

# 检查是否安装 html2text
if ! command -v html2text > /dev/null; then
    echo "Installing html2text..."
    pip3 install html2text > /dev/null 2>&1 || true
fi

# 检查多智能体文档
echo ""
echo "1. 检查多智能体文档..."
TMP_FILE="/tmp/openclaw-multi-agent-tmp.md"
curl -s -L "$MULTI_AGENT_URL" | python3 -c "
import sys
import html2text
h = html2text.HTML2Text()
h.ignore_links = False
html = sys.stdin.read()
# 提取主要内容
start = html.find('<main')
end = html.find('</main')
if start != -1 and end != -1:
    html = html[start:end+7]
text = h.handle(html)
# 去掉导航和页脚，保留核心文档
lines = text.split('Documentation Index')
if len(lines) >= 2:
    text = lines[1]
lines = text.split('Built with')
if len(lines) >= 2:
    text = lines[0]
print(text.strip())
" > "$TMP_FILE"

mkdir -p "$DOCS_DIR"

# 对比本地文件
if [ -f "$DOCS_DIR/openclaw-multi-agent.md" ] && diff -q "$DOCS_DIR/openclaw-multi-agent.md" "$TMP_FILE" > /dev/null; then
    echo "✅ 多智能体文档无变化"
    MULTI_AGENT_UPDATED=false
else
    echo "🔄 多智能体文档已更新"
    cp "$TMP_FILE" "$DOCS_DIR/openclaw-multi-agent.md"
    MULTI_AGENT_UPDATED=true
fi

# 检查 GitHub README
echo ""
echo "2. 检查 GitHub README..."
TMP_GITHUB="/tmp/openclaw-github-tmp.md"
curl -s -L "$GITHUB_RAW_URL" > "$TMP_GITHUB"

if [ -f "$DOCS_DIR/openclaw-github-readme.md" ] && diff -q "$DOCS_DIR/openclaw-github-readme.md" "$TMP_GITHUB" > /dev/null; then
    echo "✅ GitHub README 无变化"
    GITHUB_UPDATED=false
else
    echo "🔄 GitHub README 已更新"
    cp "$TMP_GITHUB" "$DOCS_DIR/openclaw-github-readme.md"
    GITHUB_UPDATED=true
fi

rm -f "$TMP_FILE" "$TMP_GITHUB"

echo ""
echo "=== 检查完成 ==="

# 如果有更新，生成摘要并发送
if [ "$MULTI_AGENT_UPDATED" = "true" ] || [ "$GITHUB_UPDATED" = "true" ]; then
    echo "检测到更新，发送通知..."
    
    UPDATE_SUMMARY="🔄 **OpenClaw 文档自动更新**\n\n"
    if [ "$MULTI_AGENT_UPDATED" = "true" ]; then
        UPDATE_SUMMARY="$UPDATE_SUMMARY- ✅ 多智能体路由文档已同步\n"
    fi
    if [ "$GITHUB_UPDATED" = "true" ]; then
        UPDATE_SUMMARY="$UPDATE_SUMMARY- ✅ GitHub README 已同步\n"
    fi
    UPDATE_SUMMARY="$UPDATE_SUMMARY\n所有更新已保存到 `/root/.openclaw/workspace/docs/` 本地知识库。"
    
    echo "$UPDATE_SUMMARY"
    
    # 通过 openclaw 发送到当前对话
    if command -v openclaw > /dev/null; then
        openclaw message send --channel feishu --target "$TARGET_CHAT" --message "$UPDATE_SUMMARY"
        echo "通知已发送"
    else
        echo "openclaw not found, skip sending"
        echo "$UPDATE_SUMMARY" > /tmp/openclaw-update-summary.txt
    fi
else
    echo "没有检测到更新。"
fi

echo ""
exit 0
