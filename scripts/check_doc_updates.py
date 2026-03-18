
#!/usr/bin/env python3
"""
OpenClaw 文档更新检查和通知脚本
每天早上 8 点执行
"""

import os
import sys
import json
import hashlib
import requests
from datetime import datetime
from pathlib import Path

# 配置
WORKSPACE_DIR = Path("/root/.openclaw/workspace")
KNOWLEDGE_DIR = WORKSPACE_DIR / "knowledge"
STATE_FILE = KNOWLEDGE_DIR / ".doc-update-state.json"
MULTI_AGENT_URL = "https://docs.OpenClaw.ai/zh-CN/concepts/multi-agent"
GITHUB_REPO_URL = "https://github.com/OpenClaw/OpenClaw/"


def init_directories():
    """初始化目录"""
    KNOWLEDGE_DIR.mkdir(parents=True, exist_ok=True)


def get_content_hash(url):
    """获取URL内容的哈希值"""
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        return hashlib.sha256(response.content).hexdigest(), response.text
    except Exception as e:
        print(f"获取 {url} 失败: {e}")
        return None, None


def load_state():
    """加载上次状态"""
    if STATE_FILE.exists():
        with open(STATE_FILE, 'r') as f:
            return json.load(f)
    return {"multi_agent_hash": "", "github_hash": ""}


def save_state(state):
    """保存状态"""
    state["last_checked"] = datetime.now().isoformat()
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def extract_multi_agent_summary(html_content):
    """从多智能体文档中提取摘要"""
    # 简单的文本提取（实际使用时可能需要更复杂的解析）
    summary = []
    lines = html_content.split('\n')
    
    for i, line in enumerate(lines[:200]):
        if any(keyword in line for keyword in ['什么是', '路径', '路由规则', '示例']):
            summary.append(line.strip())
    
    return '\n'.join(summary[:10])


def extract_github_summary(html_content):
    """从GitHub页面提取摘要"""
    summary = []
    lines = html_content.split('\n')
    
    for i, line in enumerate(lines[:200]):
        if any(keyword in line.lower() for keyword in ['openclaw', 'feature', 'quick', 'install']):
            summary.append(line.strip())
    
    return '\n'.join(summary[:10])


def main():
    print(f"开始检查文档更新: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    init_directories()
    state = load_state()
    
    updates = []
    
    # 检查多智能体文档
    ma_hash, ma_content = get_content_hash(MULTI_AGENT_URL)
    if ma_hash and ma_hash != state.get("multi_agent_hash", ""):
        print("📚 多智能体路由文档有更新!")
        updates.append({
            "type": "multi_agent",
            "url": MULTI_AGENT_URL,
            "hash": ma_hash,
            "content": ma_content
        })
        # 保存原始内容
        with open(KNOWLEDGE_DIR / "multi-agent.raw.html", "w") as f:
            f.write(ma_content)
    
    # 检查 GitHub 仓库
    gh_hash, gh_content = get_content_hash(GITHUB_REPO_URL)
    if gh_hash and gh_hash != state.get("github_hash", ""):
        print("🦞 GitHub 仓库有更新!")
        updates.append({
            "type": "github",
            "url": GITHUB_REPO_URL,
            "hash": gh_hash,
            "content": gh_content
        })
        # 保存原始内容
        with open(KNOWLEDGE_DIR / "github.raw.html", "w") as f:
            f.write(gh_content)
    
    # 处理更新
    if updates:
        # 构建更新摘要
        summary_lines = ["# OpenClaw 文档更新通知\n"]
        
        for update in updates:
            if update["type"] == "multi_agent":
                summary_lines.append(f"## 📚 多智能体路由文档\n")
                summary_lines.append(f"- **来源**: {update['url']}")
                summary_lines.append(f"- **更新时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                summary_lines.append("- **状态**: 已保存原始内容")
            elif update["type"] == "github":
                summary_lines.append(f"\n## 🦞 GitHub 仓库\n")
                summary_lines.append(f"- **来源**: {update['url']}")
                summary_lines.append(f"- **更新时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                summary_lines.append("- **状态**: 已保存原始内容")
            
            summary_lines.append("")
        
        # 更新知识库文档
        docs_content = f"""# OpenClaw 知识库

## 更新记录
- 最后更新: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
- 更新内容: {', '.join([u['type'] for u in updates])}

---

## 1. 多智能体路由文档
来源: https://docs.OpenClaw.ai/zh-CN/concepts/multi-agent

原始内容已保存至: knowledge/multi-agent.raw.html

---

## 2. GitHub 仓库
来源: https://github.com/OpenClaw/OpenClaw/

原始内容已保存至: knowledge/github.raw.html
"""
        
        with open(KNOWLEDGE_DIR / "openclaw-docs.md", "w") as f:
            f.write(docs_content)
        
        # 更新状态
        new_state = state.copy()
        for update in updates:
            if update["type"] == "multi_agent":
                new_state["multi_agent_hash"] = update["hash"]
            elif update["type"] == "github":
                new_state["github_hash"] = update["hash"]
        save_state(new_state)
        
        # 输出更新摘要（用于群通知）
        print("\n" + "="*50)
        print("📢 文档更新摘要")
        print("="*50)
        print('\n'.join(summary_lines))
        
        # 同时保存到临时文件用于通知
        with open(KNOWLEDGE_DIR / ".last-update-summary.md", "w") as f:
            f.write('\n'.join(summary_lines))
        
        return 0  # 有更新
    
    else:
        print("✅ 文档未更新")
        save_state({**state, "last_checked": datetime.now().isoformat()})
        return 1  # 无更新


if __name__ == "__main__":
    sys.exit(main())
