import bcrypt from "bcryptjs";
import database from "../../database.js";

const ADMIN_USERNAME =
  String(process.env.ADMIN_USERNAME || "").trim();

const ADMIN_PASSWORD =
  String(process.env.ADMIN_PASSWORD || "");

const findUserStatement = database.prepare(`
  SELECT
    id,
    username,
    password_hash,
    role,
    active,
    created_at,
    last_login_at
  FROM users
  WHERE username = ?
  LIMIT 1
`);

const insertUserStatement = database.prepare(`
  INSERT INTO users (
    username,
    password_hash,
    role,
    active
  )
  VALUES (?, ?, 'admin', 1)
`);

const updateLastLoginStatement = database.prepare(`
  UPDATE users
  SET last_login_at = CURRENT_TIMESTAMP
  WHERE id = ?
`);

const insertLoginAttemptStatement = database.prepare(`
  INSERT INTO login_attempts (
    username,
    ip,
    success
  )
  VALUES (?, ?, ?)
`);

const countFailedAttemptsStatement = database.prepare(`
  SELECT COUNT(*) AS total
  FROM login_attempts
  WHERE username = ?
    AND ip = ?
    AND success = 0
    AND created_at >= datetime(
      'now',
      ?
    )
`);

const clearFailedAttemptsStatement = database.prepare(`
  DELETE FROM login_attempts
  WHERE username = ?
    AND ip = ?
    AND success = 0
`);

const cleanOldAttemptsStatement = database.prepare(`
  DELETE FROM login_attempts
  WHERE created_at < datetime(
    'now',
    '-7 days'
  )
`);

const insertAuditStatement = database.prepare(`
  INSERT INTO audit_log (
    user_id,
    username,
    action,
    detail,
    ip
  )
  VALUES (
    @userId,
    @username,
    @action,
    @detail,
    @ip
  )
`);

export function ensureInitialAdmin() {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    console.warn(
      "Administrador inicial no configurado en .env"
    );

    return null;
  }

  const existingUser =
    findUserStatement.get(ADMIN_USERNAME);

  if (existingUser) {
    return existingUser;
  }

  const passwordHash =
    bcrypt.hashSync(ADMIN_PASSWORD, 12);

  insertUserStatement.run(
    ADMIN_USERNAME,
    passwordHash
  );

  console.log(
    `Administrador migrado a SQLite: ${ADMIN_USERNAME}`
  );

  return findUserStatement.get(
    ADMIN_USERNAME
  );
}

export function findUserByUsername(
  username
) {
  const normalizedUsername =
    String(username || "").trim();

  if (!normalizedUsername) {
    return null;
  }

  return (
    findUserStatement.get(
      normalizedUsername
    ) || null
  );
}

export function verifyPassword(
  password,
  passwordHash
) {
  if (!password || !passwordHash) {
    return false;
  }

  return bcrypt.compareSync(
    String(password),
    String(passwordHash)
  );
}

export function updateLastLogin(
  userId
) {
  updateLastLoginStatement.run(userId);
}

export function recordLoginAttempt({
  username,
  ip,
  success
}) {
  insertLoginAttemptStatement.run(
    String(username || ""),
    String(ip || ""),
    success ? 1 : 0
  );
}

export function countRecentFailedAttempts({
  username,
  ip,
  lockMinutes = 15
}) {
  const safeMinutes = Math.min(
    Math.max(
      Number(lockMinutes) || 15,
      1
    ),
    1440
  );

  const result =
    countFailedAttemptsStatement.get(
      String(username || ""),
      String(ip || ""),
      `-${safeMinutes} minutes`
    );

  return Number(result?.total || 0);
}

export function clearFailedAttempts({
  username,
  ip
}) {
  clearFailedAttemptsStatement.run(
    String(username || ""),
    String(ip || "")
  );
}

export function cleanOldLoginAttempts() {
  cleanOldAttemptsStatement.run();
}

export function addAuditEntry({
  userId = null,
  username = null,
  action,
  detail = null,
  ip = null
}) {
  if (!action) {
    return false;
  }

  insertAuditStatement.run({
    userId,
    username,
    action,
    detail:
      detail === null
        ? null
        : JSON.stringify(detail),
    ip
  });

  return true;
}
