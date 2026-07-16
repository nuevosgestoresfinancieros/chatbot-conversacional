import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const currentDirectory = path.dirname(
  fileURLToPath(import.meta.url)
);

const databasePath = path.resolve(
  currentDirectory,
  "../data/calls.db"
);

const database = new Database(databasePath);

database.pragma("foreign_keys = ON");
database.pragma("busy_timeout = 5000");

const existingColumns = new Set(
  database
    .prepare("PRAGMA table_info(calls)")
    .all()
    .map(column => column.name)
);

const columns = [
  ["request_id", "TEXT"],
  ["client", "TEXT"],
  ["agent", "TEXT"],
  ["campaign", "TEXT"],
  ["notes", "TEXT"],
  ["admin_user_id", "INTEGER"],
  ["admin_username", "TEXT"]
];

const migrate = database.transaction(() => {
  for (const [name, type] of columns) {
    if (!existingColumns.has(name)) {
      database.exec(
        `ALTER TABLE calls ADD COLUMN ${name} ${type}`
      );
    }
  }

  database.exec(`
    CREATE INDEX IF NOT EXISTS
      idx_calls_request_id
    ON calls(request_id);

    CREATE TABLE IF NOT EXISTS call_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT NOT NULL UNIQUE,
      call_sid TEXT,
      source TEXT NOT NULL,
      requested_number TEXT,
      client TEXT,
      agent TEXT,
      voice TEXT,
      campaign TEXT,
      notes TEXT,
      admin_user_id INTEGER,
      admin_username TEXT,
      status TEXT NOT NULL DEFAULT 'created',
      error_code TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS
      idx_call_attempts_created_at
    ON call_attempts(created_at);

    CREATE INDEX IF NOT EXISTS
      idx_call_attempts_call_sid
    ON call_attempts(call_sid);
  `);
});

try {
  migrate();
  console.log("Migración de llamadas Fase 2 completada");
} finally {
  database.close();
}
