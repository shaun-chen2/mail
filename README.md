# 我的邮箱 · 网页邮箱（邀请制多用户 + SMTP 发信）

一个部署在 **Cloudflare Pages** 上的轻量网页邮箱：

- **账号系统**：登录 / 注册；密码用 PBKDF2 哈希存储，会话用 HttpOnly Cookie。
- **权限模型**：一个 **管理员**，普通账号必须凭 **邀请码** 注册（邀请码由管理员在后台生成，单次有效）。
- **发信能力**：登录后可通过网页写邮件并发出，**走 SMTP**（在 Cloudflare Worker 运行时用 `cloudflare:sockets` 直连你的 SMTP 服务器，凭据仅存于服务端，绝不暴露给浏览器）。

> 说明：Cloudflare Pages 是静态前端 + Serverless 后端，**不能托管真正接收邮件的 SMTP 服务器（入站 MTA）**。本项目提供「出站发信 + 网页发信界面」。若以后需要收件/收件箱，可再接 Cloudflare Email Routing 或独立邮件服务器。

---

## 架构

```
浏览器 (index.html / admin.html)
        │  HTTPS + JSON
        ▼
Cloudflare Pages Functions (functions/api/*.js)
        ├─ 认证/会话  ──► D1 (SQLite): users / invite_codes / sessions
        └─ 发信       ──► cloudflare:sockets ──► 你的 SMTP 服务器
```

- 存储：**Cloudflare D1**（绑定名 `DB`）。
- 发信模型：系统共用**一个 SMTP 邮箱**（`SMTP_USER`）发信，`From` = 该邮箱，`Reply-To` = 注册用户填写的邮箱。即邀请制多用户共用一个发信邮箱。

---

## 目录结构

```
mail/
├── index.html          首页：登录/注册 + 写邮件
├── admin.html          管理后台：生成/查看邀请码
├── styles.css          样式
├── app.js / admin.js   前端逻辑
├── wrangler.toml       Cloudflare Pages + D1 配置
├── schema.sql          D1 表结构参考
├── functions/
│   ├── _middleware.js  全局安全头
│   ├── lib/            auth.js / db.js / smtp.js / util.js
│   └── api/
│       ├── me.js register.js login.js logout.js send.js
│       └── admin/ invite.js codes.js
└── README.md
```

---

## 部署步骤

### 1. 前置条件

- 一个 [Cloudflare](https://dash.cloudflare.com) 账号（免费即可）。
- 已在 GitHub 上准备好本仓库（见第 5 步推送）。
- 本地安装 Wrangler（用于本地开发与可选的直接部署）：
  ```bash
  npm install -g wrangler
  wrangler login
  ```

### 2. 创建 D1 数据库

```bash
wrangler d1 create mail-db
```

命令会输出一个 `database_id`，把它填进 `wrangler.toml` 的 `database_id` 占位处：

```toml
[[d1_databases]]
binding = "DB"
database_name = "mail-db"
database_id = "这里替换为你的 id"
```

> 表结构会在首次访问时由 `ensureSchema()` 自动创建，无需手动执行 `schema.sql`。

### 3. 配置环境变量 / 密钥

在 **Cloudflare 控制台 → Pages → 你的项目 → Settings → Environment variables** 中，为 Production（以及 Preview，如需要）添加：

| 变量 | 说明 | 是否加密 |
|------|------|----------|
| `SMTP_HOST` | SMTP 服务器地址，如 `smtp.gmail.com` | 否 |
| `SMTP_PORT` | 端口，`465`（隐式 TLS）或 `587`（STARTTLS），默认 465 | 否 |
| `SMTP_USER` | 发信邮箱（同时也是登录 SMTP 的账号） | **加密** |
| `SMTP_PASS` | 该邮箱的密码 / 应用专用密码 | **加密** |
| `ADMIN_USERNAME` | 首个管理员用户名 | 否 |
| `ADMIN_PASSWORD` | 首个管理员密码（仅当无任何用户时使用，用于自动创建管理员） | **加密** |

> Gmail 需开启「应用专用密码」；Outlook / 其他邮箱同理。端口 465 走隐式 TLS，587 走 STARTTLS，代码两种都支持。

### 4. 部署到 Cloudflare Pages

**方式 A（推荐）：连接 GitHub 自动部署**

1. Cloudflare 控制台 → Workers & Pages → 创建 → Pages → 连接到 Git。
2. 选择本仓库，构建设置：
   - Build command：**留空**
   - Build output directory：`.`
3. 部署完成后，在 Settings → Functions → D1 绑定里确认 `DB` 已绑定到 `mail-db`（也可直接在 `wrangler.toml` 配好）。
4. 在 Settings → Environment variables 填好第 3 步的变量。

**方式 B：本地直接部署**

```bash
wrangler pages deploy
```

### 5. 初始化 Git 并推送（首次）

```bash
git init
git add .
git commit -m "init: 网页邮箱 + 邀请制 + SMTP 发信"
gh repo create shaun-chen2/mail --public --source=. --remote=origin --push
```

之后连接 Cloudflare Pages 到该仓库即可。

---

## 首次使用

1. 打开站点，用第 3 步设置的 `ADMIN_USERNAME` / `ADMIN_PASSWORD` **登录**（系统检测到无用户时会自动创建该管理员）。
2. 进入 **管理后台**（`/admin.html`），点击「生成新邀请码」，复制邀请码。
3. 退出管理员，在登录页切到「注册（需邀请码）」，用邀请码注册一个普通账号。
4. 登录普通账号 → 写邮件 → 发送。邮件会从 `SMTP_USER` 邮箱发出，`Reply-To` 为注册时填的邮箱。

---

## 本地开发

```bash
wrangler pages dev
```

本地会使用 wrangler 的本地 D1（`ensureSchema()` 会自动建表）。访问 `http://localhost:8788`。
本地为 HTTP，会话 Cookie 不会带 `Secure` 标记（已由代码按协议自动判断）。

---

## 安全说明

- 密码经 PBKDF2-SHA256（10 万次）加盐哈希，数据库不存明文。
- 会话令牌 32 字节随机值，存 D1，Cookie 为 `HttpOnly; SameSite=Lax`，生产环境自动加 `Secure`。
- SMTP 凭据仅在服务端环境变量中，前端永远拿不到。
- 公开端点 `/api/send` 需登录；`/api/admin/*` 需管理员。
- 建议：在 Cloudflare 控制台为该站点开启 **Rate Limiting** 或 **Access**，防止发信接口被滥用。

## 局限与扩展

- 仅出站发信，无收件箱 / IMAP / 邮件存储。
- 多用户共用同一个发信邮箱；若需「每个账号独立邮箱 + 各自 SMTP」，需改造 `send.js` 让用户自带 SMTP 凭据（模型不同）。
- 可作为后续扩展：邮件历史记录、附件、Cloudflare Email Routing 收件转发。
