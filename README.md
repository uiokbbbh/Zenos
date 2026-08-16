# ZEN OS V19 · Full Clean Project

这是整理后的 ZEN OS V19 完整项目包，已去掉重复的历史 HTML 文件。

## 前端
- `index.html`：ZEN OS V19 主桌面，包含 ZEN Chat 入口
- `chat.html`：独立 ZEN Chat 聊天室
- `console.html`：公告与聊天室管理控制台
- `index_personal_center.html`：个人中心

## 服务端
- `server.js`：Render Node.js API，包含公告、聊天室、在线人数、管理员删除消息、Bot 管理
- `data/announcements.json`：公告数据
- `data/chat.json`：聊天与 Bot 数据
- `package.json`：Render/Node.js 依赖与启动命令
- `check.js`：本地检查脚本
- `server.original.backup.js`：原服务端备份

## Render
Build Command:
`npm install`

Start Command:
`npm start`

环境变量：
- `ADMIN_API_KEY`：管理员密钥
- `ALLOWED_ORIGIN`：允许的前端来源；不设置时默认允许跨域

## GitHub Pages
将 `index.html`、`chat.html`、`console.html`、`index_personal_center.html` 放在 Pages 对应分支/目录即可。
前端聊天和公告 API 默认连接：`https://zenos-91.onrender.com/api`
