// 数据库初始化与首个管理员 seeding
import { hashPassword } from './auth.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  username     TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt         TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'user',
  email        TEXT,
  created_at   INTEGER NOT NULL
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
`;

let schemaReady = false;

export async function ensureSchema(env) {
  if (schemaReady) return;
  await env.DB.exec(SCHEMA);
  schemaReady = true;
}

// 若没有任何用户，且配置了 ADMIN_USERNAME / ADMIN_PASSWORD，则自动创建管理员
export async function ensureAdmin(env) {
  await ensureSchema(env);
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) return;
  const row = await env.DB.prepare('SELECT COUNT(*) AS c FROM users').first();
  if (row && row.c === 0) {
    const { salt, hash } = await hashPassword(env.ADMIN_PASSWORD);
    await env.DB.prepare(
      'INSERT INTO users (username, password_hash, salt, role, email, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(env.ADMIN_USERNAME, hash, salt, 'admin', null, Date.now()).run();
  }
}
