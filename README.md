# ZEN OS V19 API

这是 ZEN OS V19 的公告 API。前端只访问公开 GET 接口；管理写入接口使用 Bearer API Key，密钥只放在服务器环境变量里，绝对不要写进 HTML。

## 本地运行

```bash
npm install
```

设置环境变量：

```bash
ADMIN_API_KEY=你的超长随机密钥
```

然后：

```bash
npm start
```

健康检查：

`GET http://localhost:3000/api/health`

公告：

`GET http://localhost:3000/api/announcements?lang=zh`

## 管理公告

新增：

```bash
curl -X POST http://localhost:3000/api/admin/announcements \
  -H "Authorization: Bearer 你的密钥" \
  -H "Content-Type: application/json" \
  -d '{"title":"测试公告","content":"服务器公告","pinned":true,"isNew":true}'
```

修改：`PUT /api/admin/announcements/:id`

删除：`DELETE /api/admin/announcements/:id`

## 部署

把整个目录部署到支持 Node.js 的云平台。平台通常会自动提供 `PORT`，不要硬编码公网端口。

部署后，把得到的 API 根地址填进 ZEN OS 的“服务器 API”里，例如：

`https://你的-api-域名/api`

## 安全

- 浏览器端不保存 ADMIN_API_KEY。
- 普通用户只能读取 `/api/health` 和 `/api/announcements`。
- `/api/admin/*` 没有密钥无法写入。
- 正式环境建议使用 HTTPS，并把 ALLOWED_ORIGIN 改成你的 ZEN OS 网页实际域名。
