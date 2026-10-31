#!/usr/bin/env bash
# 创建一个 SMTP 登录账号（同时也是发信地址）。
# 用法: ./scripts/setup-account.sh <邮箱> <密码>
# 例:   ./scripts/setup-account.sh noreply@example.com "强密码请改掉"
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "用法: $0 <邮箱> <密码>" >&2
  exit 1
fi

EMAIL="$1"
PASS="$2"

echo "== 创建账号 $EMAIL =="
docker exec -i mailserver setup email add "$EMAIL" "$PASS"

echo ""
echo "✅ 账号已创建。请在 Cloudflare Pages 后台（项目 shaun-mailbox → Settings → Environment variables）"
echo "   为 Production 添加以下密钥（SMTP_PASS 勾选 Encrypt）："
echo ""
echo "   SMTP_HOST=mail.${MAIL_DOMAIN:-你的域名}"
echo "   SMTP_PORT=465"
echo "   SMTP_USER=$EMAIL"
echo "   SMTP_PASS=$PASS"
echo ""
echo "   注：SMTP_HOST 也可填你 VPS 的公网 IP（需与证书主机名一致，建议用 mail.域名）。"
