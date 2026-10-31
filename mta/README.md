# 自托管邮件服务器（MTA）部署指南

本目录提供一套**可一键部署的自有邮件服务器**，配合网页邮箱 app（`../` 的 Cloudflare Pages 项目）使用。
app 本身跑在 Cloudflare Pages（无法托管 SMTP），所以真正的 SMTP 服务器跑在你自己的 **VPS** 上，
app 通过 `cloudflare:sockets` 以 SMTP 连上来发信。

> 一句话：在 VPS 上跑 `docker-mailserver`（Postfix + OpenDKIM），app 把它当 SMTP 服务器用。

---

## 1. 前置条件

| 项目 | 说明 |
|------|------|
| **VPS** | 有公网 IPv4、能装 Docker；**入站**开放 25 / 465 / 587；**出站 25 端口不被封**（否则发不出去，见第 8 节）。 |
| **域名** | 建议把 DNS 托管在 Cloudflare（这样 Let's Encrypt 证书能自动签发，DNS 记录也能顺手配）。 |
| **Docker** | VPS 上安装 Docker 与 Docker Compose v2。 |

> 哪些 VPS 厂商允许出站 25？DigitalOcean / Vultr / Linode / 大部分独立机房通常允许（或工单申请解除）；
> AWS / Google Cloud / Azure 默认封 25，需要申请或改用中继，不推荐新手。

---

## 2. 快速开始

```bash
# 在 VPS 上
git clone <你的仓库> && cd mail/mta
cp .env.example .env
nano .env            # 填 MAIL_DOMAIN / MAIL_HOSTNAME / CF_DNS_API_TOKEN

docker compose up -d          # 启动邮件服务器
docker compose logs -f        # 看启动日志，确认没有报错
```

启动后，服务器会自动：
- 申请 `mail.<域名>` 的 Let's Encrypt 证书（通过 Cloudflare DNS-01）；
- 监听 25 / 465 / 587。

---

## 3. 生成 DKIM 密钥（提升发信送达率，强烈建议）

```bash
docker exec -it mailserver setup config dkim
```

生成的记录在这个文件里：

```
docker-data/dms/config/opendkim/keys/<你的域名>/mail.txt
```

打开它，把里面的内容作为一条 **TXT 记录**加到你的 DNS（Name=`mail._domainkey`，内容即括号内的字符串）。
完成后再让网页 app 发信，对方服务器就能验证 DKIM 签名，大幅降低进垃圾箱概率。

---

## 4. 创建 SMTP 发信账号

```bash
./scripts/setup-account.sh noreply@example.com "这里换成强密码"
```

这会创建一个登录账号 `noreply@example.com`，该账号也即发信地址（`From`）。
脚本会打印出要填到 Cloudflare Pages 的 4 个密钥。

---

## 5. DNS 记录（在 Cloudflare 控制台添加）

假设域名 `example.com`、VPS 公网 IP `1.2.3.4`：

| 类型 | 名称 | 内容 | 说明 |
|------|------|------|------|
| A | `mail` | `1.2.3.4` | 邮件服务器地址 |
| MX | `@` | `mail.example.com`（优先级 10） | 告诉外界邮件发往哪台服务器 |
| TXT | `@` | `v=spf1 a:mail.example.com ~all` | SPF，声明只有这台服务器能代发 |
| TXT | `mail._domainkey` | （第 3 节 DKIM 文件内容） | DKIM 公钥 |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:postmaster@example.com` | DMARC 策略 |
| PTR | （反向 DNS） | `mail.example.com` | **在 VPS 厂商后台设置**，把 IP 指回域名，对送达率至关重要 |

> 如果你有 Cloudflare API 令牌，这些记录我也可以帮你用 API 批量添加（见第 7 节）。

---

## 6. 证书说明（为什么必须是公网 CA 签的）

网页 app 的发信后端用 `cloudflare:sockets` 连接 SMTP，并开启 TLS 校验主机名。
因此 MTA 的 465/587 证书**必须是公网可信 CA 签发**，自签名证书会被 Workers 拒绝连接。
本配置用 Let's Encrypt + Cloudflare DNS-01 自动解决（需 `CF_DNS_API_TOKEN`，仅 DNS:Edit 权限即可）。

如不想用 LE，可改 `SSL_TYPE=self-signed` 仅做本地测试，但**生产必须用有效证书**。

---

## 7. 让网页 app 指向这台 MTA

登录 Cloudflare 控制台 → Pages → `shaun-mailbox` → Settings → Environment variables → Production，添加：

| 变量 | 值 | 加密 |
|------|----|------|
| `SMTP_HOST` | `mail.example.com`（或 VPS 公网 IP） | 否 |
| `SMTP_PORT` | `465` | 否 |
| `SMTP_USER` | `noreply@example.com` | **是** |
| `SMTP_PASS` | 第 4 节创建的密码 | **是 |
| `ADMIN_USERNAME` | 你想设的管理员名 | 否 |
| `ADMIN_PASSWORD` | 管理员密码 | **是** |

保存后等部署完成，即可在网页上登录发信。

---

## 8. 验证发信

**用 openssl 直接测 MTA（在任意能联网的机器）：**

```bash
openssl s_client -connect mail.example.com:465 -crlf
# 连上后手动输入（quit 退出）：
EHLO example.com
AUTH PLAIN <base64("\0账号\0密码")>
MAIL FROM:<noreply@example.com>
RCPT TO:<你的另一个邮箱>
DATA
Subject: 测试
你好
.
QUIT
```

**从网页 app 发：** 登录 → 写邮件 → 发送。若失败，看 app 返回的错误信息（已包含 SMTP 错误原文）。

---

## 9. 运维

- **看日志**：`docker compose logs -f mailserver`，或查 `docker-data/dms/mail-logs/`。
- **更新**：`docker compose pull && docker compose up -d`。
- **列出账号**：`docker exec -it mailserver setup email list`。
- **删除账号**：`docker exec -it mailserver setup email del 账号`。
- **出站 25 被封怎么办**：若 VPS 厂商封了出站 25，可在 `docker-compose.yml` 里加一个
  `RELAY_HOST`（把信先中继到一家允许 25 的服务商，如你的域名注册商邮箱中继），
  或换一家不封 25 的 VPS。入站和 app 提交（465/587）不受影响。

---

## 安全提醒

- `CF_DNS_API_TOKEN` 只给 **Zone:DNS:Edit**，不要用账户全权限令牌。
- `SMTP_PASS` 属于机密，只在 Cloudflare 后台以**加密**形式存储，勿进仓库。
- 暴露 25 端口会被扫，已开启 `fail2ban`；建议 VPS 防火墙仅放行必要端口，并用强密码。
- 证书自动续期由容器负责，无需手动操作。
