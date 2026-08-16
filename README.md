# ZEN AI V2

这是在现有 ZEN OS V19 AI 通路基础上的升级包。

## 本包包含

- `server.js`：升级后的 Node/Express API
- `ai.html`：独立 ZEN AI V2 页面
- `ai_admin.html`：管理员人设/系统提示词/记忆管理页面
- `index.html`：加入首页独立「ZEN AI」卡片，并点击直达 `ai.html`
- `data/ai_config.json`：AI 默认配置
- `data/ai_memory.json`：服务端长期记忆数据
- `README_ZEN_AI_V2.md`：说明

## Render 环境变量

至少保留：

- `TEAMOROUTER_API_KEY`：你的 AI API Key
- `ADMIN_API_KEY`：管理员密钥（管理中心需要）

可选：

- `AI_BASE_URL`：默认 `https://api.teamorouter.com/v1`
- `AI_MODEL`：默认 `deepseek-v4-flash-free`
- `AI_MAX_INPUT`：默认 4000
- `AI_RATE_LIMIT`：默认每 IP 每分钟 20 次
- `ALLOWED_ORIGIN`：跨域来源

## 上传方式

把本包里的文件覆盖 GitHub 仓库同名文件：

1. `server.js`
2. `ai.html`
3. `ai_admin.html`
4. `index.html`
5. `data/ai_config.json`
6. `data/ai_memory.json`

Render 会自动重新部署。

## 管理 AI 人设

打开独立 ZEN AI 后，右上角 `⚙` 进入管理中心。

输入 Render 中的 `ADMIN_API_KEY`，可以修改：

- AI 名称
- AI 头像
- 性格/人设
- 回答风格
- 完整系统提示词
- 恢复默认配置
- 查看服务端记忆

## 长期记忆

用户在 ZEN AI 页面打开 `🧠`，可以主动保存、删除和清空记忆。

记忆按浏览器生成的 ZEN 用户 ID 隔离，并由服务端保存，不再依赖单纯的浏览器 localStorage。

注意：`data/*.json` 是文件型存储。如果 Render 实例没有持久化磁盘，重新部署/重建实例时服务端文件可能被重置。要做到真正跨部署永久保存，后续应把记忆迁移到数据库。

## 重要变化

独立 ZEN AI 的回答默认**不会再写入公共 ZEN Chat**，避免独立 AI 和公共聊天室串台。

前端同时兼容：

- `reply`
- `content`
- `message.content`

所以不会再出现之前那种“后端已经返回，前端却显示没有内容”的字段不匹配问题。
