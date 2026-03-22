#!/bin/bash

# flosidian 自动部署脚本
# 双击或运行 ./deploy.sh 即可自动构建并部署

set -e

echo "🔨 开始构建..."
pnpm build

echo "📦 提交代码..."
git add .
git commit -m "Deploy update $(date '+%Y-%m-%d %H:%M')" || echo "没有需要提交的更改"

echo "🚀 推送到 GitHub..."
git push

echo "✅ 部署完成！Cloudflare 将自动构建并在 1-2 分钟后上线"
