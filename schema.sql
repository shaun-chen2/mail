-- D1 (SQLite) 表结构参考。
-- 实际建表由 functions/lib/db.js 的 ensureSchema() 在首次请求时自动执行，
-- 本文件仅作参考与本地手动迁移使用：
--   wrangler d1 execute mail-db --local --file=./schema.sql
--   wrangler d1 execute mail-db --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'user',  -- 'admin' | 'user'
  email       TEXT,                           -- 可选，用作邮件 Reply-To
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS invite_codes (
  code       TEXT PRIMARY KEY,
  created_by INTEGER NOT NULL,
  used_by    INTEGER,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  used_at    INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
