import { Database } from 'bun:sqlite';
import { ulid } from 'ulid';

let db: Database;

export function initializeDatabase(dbName: string = 'aiprox.sqlite') {
  db = new Database(dbName);

  // Initialize the database
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      login_code TEXT,
      login_code_expires_at INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      timestamp INTEGER,
      request_data TEXT,
      usage_data TEXT
    )
  `);
}

export function generateLoginCode(email: string): string {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes from now

  const userId = ulid();
  db.run('INSERT OR IGNORE INTO users (id, email) VALUES (?, ?)', [
    userId,
    email,
  ]);
  db.run(
    'UPDATE users SET login_code = ?, login_code_expires_at = ? WHERE email = ?',
    [code, expiresAt, email]
  );

  return code;
}

export function validateLoginCode(email: string, code: string): boolean {
  const result = db
    .query(
      'SELECT login_code, login_code_expires_at FROM users WHERE email = ?'
    )
    .get(email) as { login_code: string; login_code_expires_at: number } | null;

  if (!result) return false;

  const { login_code, login_code_expires_at } = result;
  const isValid = login_code === code && login_code_expires_at > Date.now();

  if (isValid) {
    // Clear the login code after successful validation
    db.run(
      'UPDATE users SET login_code = NULL, login_code_expires_at = NULL WHERE email = ?',
      [email]
    );
  }

  return isValid;
}

export function addRequest(email: string, requestData: object): string {
  const user = db.query('SELECT id FROM users WHERE email = ?').get(email) as {
    id: string;
  } | null;
  if (!user) return '';

  const requestId = ulid();
  db.run(
    'INSERT INTO requests (id, user_id, timestamp, request_data) VALUES (?, ?, ?, ?)',
    [requestId, user.id, Date.now(), JSON.stringify(requestData)]
  );

  return requestId;
}

export function updateRequestWithUsageData(
  requestId: string,
  usageData: object
): void {
  db.run('UPDATE requests SET usage_data = ? WHERE id = ?', [
    JSON.stringify(usageData),
    requestId,
  ]);
}

export function getRequestCount(email: string, timeWindowMs: number): number {
  const user = db.query('SELECT id FROM users WHERE email = ?').get(email) as {
    id: string;
  } | null;
  if (!user) return 0;

  const result = db
    .query(
      'SELECT COUNT(*) as count FROM requests WHERE user_id = ? AND timestamp > ?'
    )
    .get(user.id, Date.now() - timeWindowMs) as { count: number };
  return result.count;
}

export function clearOldRequests(timeWindowMs: number): void {
  db.run('DELETE FROM requests WHERE timestamp <= ?', [
    Date.now() - timeWindowMs,
  ]);
}

export function getUserIdByEmail(email: string): string | null {
  const result = db
    .query('SELECT id FROM users WHERE email = ?')
    .get(email) as { id: string } | null;
  return result ? result.id : null;
}

// Initialize the database with the default name
initializeDatabase();
