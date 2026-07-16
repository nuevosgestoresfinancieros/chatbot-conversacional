import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);

const dataDirectory = path.join(
  currentDirectory,
  "data"
);

const databasePath = path.join(
  dataDirectory,
  "calls.db"
);

if (!fs.existsSync(dataDirectory)) {
  fs.mkdirSync(dataDirectory, {
    recursive: true,
    mode: 0o750
  });
}

const database = new Database(databasePath);

database.pragma("journal_mode = WAL");
database.pragma("foreign_keys = ON");
database.pragma("busy_timeout = 5000");

/*
 * Tabla principal de llamadas.
 */
database.exec(`
  CREATE TABLE IF NOT EXISTS calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    call_sid TEXT NOT NULL UNIQUE,

    request_id TEXT,

    stream_sid TEXT,

    direction TEXT DEFAULT 'outbound',

    from_number TEXT,

    to_number TEXT,

    status TEXT DEFAULT 'created',

    started_at TEXT,

    answered_at TEXT,

    completed_at TEXT,

    duration_seconds INTEGER DEFAULT 0,

    model TEXT,

    voice TEXT,

    company_name TEXT,

    client TEXT,

    agent TEXT,

    campaign TEXT,

    notes TEXT,

    admin_user_id INTEGER,

    admin_username TEXT,

    stream_status TEXT,

    stream_error TEXT,

    error_message TEXT,

    created_at TEXT NOT NULL
      DEFAULT CURRENT_TIMESTAMP,

    updated_at TEXT NOT NULL
      DEFAULT CURRENT_TIMESTAMP
  );
`);

/*
 * Intentos de llamada, incluidos los fallos
 * ocurridos antes de recibir un Call SID.
 */
database.exec(`
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

/*
 * Tabla de mensajes y transcripciones.
 */
database.exec(`
  CREATE TABLE IF NOT EXISTS call_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    call_sid TEXT NOT NULL,

    speaker TEXT NOT NULL
      CHECK (
        speaker IN (
          'user',
          'assistant',
          'system'
        )
      ),

    message TEXT NOT NULL,

    created_at TEXT NOT NULL
      DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (call_sid)
      REFERENCES calls(call_sid)
      ON DELETE CASCADE
  );
`);

/*
 * Tabla de eventos técnicos.
 */
database.exec(`
  CREATE TABLE IF NOT EXISTS call_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    call_sid TEXT NOT NULL,

    stream_sid TEXT,

    event_type TEXT NOT NULL,

    event_data TEXT,

    created_at TEXT NOT NULL
      DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (call_sid)
      REFERENCES calls(call_sid)
      ON DELETE CASCADE
  );
`);

/*
 * Índices para acelerar búsquedas.
 */
database.exec(`
  CREATE INDEX IF NOT EXISTS
    idx_calls_status
  ON calls(status);

  CREATE INDEX IF NOT EXISTS
    idx_calls_created_at
  ON calls(created_at);

  CREATE INDEX IF NOT EXISTS
    idx_call_messages_call_sid
  ON call_messages(call_sid);

  CREATE INDEX IF NOT EXISTS
    idx_call_events_call_sid
  ON call_events(call_sid);
`);

const insertCallStatement = database.prepare(`
  INSERT INTO calls (
    call_sid,
    request_id,
    direction,
    from_number,
    to_number,
    status,
    model,
    voice,
    company_name,
    client,
    agent,
    campaign,
    notes,
    admin_user_id,
    admin_username,
    created_at,
    updated_at
  )
  VALUES (
    @callSid,
    @requestId,
    @direction,
    @fromNumber,
    @toNumber,
    @status,
    @model,
    @voice,
    @companyName,
    @client,
    @agent,
    @campaign,
    @notes,
    @adminUserId,
    @adminUsername,
    @createdAt,
    @updatedAt
  )
  ON CONFLICT(call_sid)
  DO UPDATE SET
    direction = excluded.direction,
    from_number = excluded.from_number,
    to_number = excluded.to_number,
    status = excluded.status,
    model = excluded.model,
    voice = excluded.voice,
    company_name = excluded.company_name,
    request_id = excluded.request_id,
    client = excluded.client,
    agent = excluded.agent,
    campaign = excluded.campaign,
    notes = excluded.notes,
    admin_user_id = excluded.admin_user_id,
    admin_username = excluded.admin_username,
    updated_at = excluded.updated_at
`);

const updateCallStatusStatement = database.prepare(`
  UPDATE calls
  SET
    status = @status,

    started_at = CASE
      WHEN @status = 'in-progress'
        AND started_at IS NULL
      THEN @timestamp
      ELSE started_at
    END,

    answered_at = CASE
      WHEN @status = 'in-progress'
        AND answered_at IS NULL
      THEN @timestamp
      ELSE answered_at
    END,

    completed_at = CASE
      WHEN @status IN (
        'completed',
        'failed',
        'busy',
        'no-answer',
        'canceled'
      )
      THEN @timestamp
      ELSE completed_at
    END,

    duration_seconds = CASE
      WHEN @durationSeconds IS NOT NULL
      THEN @durationSeconds
      ELSE duration_seconds
    END,

    updated_at = @timestamp
  WHERE call_sid = @callSid
`);

const updateStreamStatement = database.prepare(`
  UPDATE calls
  SET
    stream_sid = COALESCE(
      @streamSid,
      stream_sid
    ),

    stream_status = COALESCE(
      @streamStatus,
      stream_status
    ),

    stream_error = CASE
      WHEN @streamError != ''
      THEN @streamError
      ELSE stream_error
    END,

    updated_at = @timestamp
  WHERE call_sid = @callSid
`);

const updateCallErrorStatement = database.prepare(`
  UPDATE calls
  SET
    error_message = @errorMessage,
    updated_at = @timestamp
  WHERE call_sid = @callSid
`);

const insertMessageStatement = database.prepare(`
  INSERT INTO call_messages (
    call_sid,
    speaker,
    message,
    created_at
  )
  VALUES (
    @callSid,
    @speaker,
    @message,
    @createdAt
  )
`);

const insertEventStatement = database.prepare(`
  INSERT INTO call_events (
    call_sid,
    stream_sid,
    event_type,
    event_data,
    created_at
  )
  VALUES (
    @callSid,
    @streamSid,
    @eventType,
    @eventData,
    @createdAt
  )
`);

const insertCallAttemptStatement =
  database.prepare(`
    INSERT INTO call_attempts (
      request_id,
      source,
      requested_number,
      client,
      agent,
      voice,
      campaign,
      notes,
      admin_user_id,
      admin_username,
      status,
      created_at,
      updated_at
    ) VALUES (
      @requestId,
      @source,
      @requestedNumber,
      @client,
      @agent,
      @voice,
      @campaign,
      @notes,
      @adminUserId,
      @adminUsername,
      @status,
      @createdAt,
      @updatedAt
    )
  `);

const updateCallAttemptStatement =
  database.prepare(`
    UPDATE call_attempts
    SET
      call_sid = COALESCE(
        @callSid,
        call_sid
      ),
      status = @status,
      error_code = @errorCode,
      error_message = @errorMessage,
      updated_at = @updatedAt
    WHERE request_id = @requestId
  `);

const listCallsStatement = database.prepare(`
  SELECT
    id,
    call_sid,
    request_id,
    stream_sid,
    direction,
    from_number,
    to_number,
    status,
    started_at,
    answered_at,
    completed_at,
    duration_seconds,
    model,
    voice,
    company_name,
    client,
    agent,
    campaign,
    notes,
    admin_user_id,
    admin_username,
    stream_status,
    stream_error,
    error_message,
    created_at,
    updated_at
  FROM calls
  ORDER BY id DESC
  LIMIT ?
`);

const getCallStatement = database.prepare(`
  SELECT *
  FROM calls
  WHERE call_sid = ?
  LIMIT 1
`);

const getMessagesStatement = database.prepare(`
  SELECT
    id,
    speaker,
    message,
    created_at
  FROM call_messages
  WHERE call_sid = ?
  ORDER BY id ASC
`);

const getEventsStatement = database.prepare(`
  SELECT
    id,
    stream_sid,
    event_type,
    event_data,
    created_at
  FROM call_events
  WHERE call_sid = ?
  ORDER BY id ASC
`);

const dashboardMetricsStatement =
  database.prepare(`
    SELECT
      COUNT(*) AS total_calls,
      COALESCE(
        SUM(
          CASE
            WHEN status = 'completed'
            THEN 1
            ELSE 0
          END
        ),
        0
      ) AS completed_calls,
      COALESCE(
        SUM(
          CASE
            WHEN status IN (
              'failed',
              'busy',
              'no-answer',
              'canceled'
            ) OR error_message IS NOT NULL
            THEN 1
            ELSE 0
          END
        ),
        0
      ) AS failed_calls,
      COALESCE(
        SUM(
          CASE
            WHEN date(created_at) =
              date('now')
            THEN 1
            ELSE 0
          END
        ),
        0
      ) AS calls_today,
      COALESCE(
        SUM(
          CASE
            WHEN strftime(
              '%Y-%m',
              created_at
            ) = strftime(
              '%Y-%m',
              'now'
            )
            THEN 1
            ELSE 0
          END
        ),
        0
      ) AS calls_this_month,
      COALESCE(
        AVG(
          CASE
            WHEN duration_seconds > 0
            THEN duration_seconds
          END
        ),
        0
      ) AS average_duration_seconds
    FROM calls
  `);

export function createOrUpdateCall({
  callSid,
  requestId = null,
  direction = "outbound",
  fromNumber = null,
  toNumber = null,
  status = "created",
  model = null,
  voice = null,
  companyName = null,
  client = null,
  agent = null,
  campaign = null,
  notes = null,
  adminUserId = null,
  adminUsername = null
}) {
  if (!callSid) {
    return false;
  }

  const timestamp =
    new Date().toISOString();

  insertCallStatement.run({
    callSid,
    requestId,
    direction,
    fromNumber,
    toNumber,
    status,
    model,
    voice,
    companyName,
    client,
    agent,
    campaign,
    notes,
    adminUserId,
    adminUsername,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  return true;
}

export function createCallAttempt({
  requestId,
  source,
  requestedNumber = null,
  client = null,
  agent = null,
  voice = null,
  campaign = null,
  notes = null,
  adminUserId = null,
  adminUsername = null,
  status = "created"
}) {
  const timestamp =
    new Date().toISOString();

  insertCallAttemptStatement.run({
    requestId,
    source,
    requestedNumber,
    client,
    agent,
    voice,
    campaign,
    notes,
    adminUserId,
    adminUsername,
    status,
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

export function updateCallAttempt({
  requestId,
  callSid = null,
  status,
  errorCode = null,
  errorMessage = null
}) {
  updateCallAttemptStatement.run({
    requestId,
    callSid,
    status,
    errorCode,
    errorMessage,
    updatedAt:
      new Date().toISOString()
  });
}

export function updateCallStatus({
  callSid,
  status,
  durationSeconds = null
}) {
  if (!callSid || !status) {
    return false;
  }

  updateCallStatusStatement.run({
    callSid,
    status,
    durationSeconds,
    timestamp:
      new Date().toISOString()
  });

  return true;
}

export function updateCallStream({
  callSid,
  streamSid = null,
  streamStatus = null,
  streamError = ""
}) {
  if (!callSid) {
    return false;
  }

  updateStreamStatement.run({
    callSid,
    streamSid,
    streamStatus,
    streamError,
    timestamp:
      new Date().toISOString()
  });

  return true;
}

export function updateCallError({
  callSid,
  errorMessage
}) {
  if (!callSid || !errorMessage) {
    return false;
  }

  updateCallErrorStatement.run({
    callSid,
    errorMessage,
    timestamp:
      new Date().toISOString()
  });

  return true;
}

export function addCallMessage({
  callSid,
  speaker,
  message
}) {
  if (
    !callSid ||
    !speaker ||
    !message
  ) {
    return false;
  }

  insertMessageStatement.run({
    callSid,
    speaker,
    message,
    createdAt:
      new Date().toISOString()
  });

  return true;
}

export function addCallEvent({
  callSid,
  streamSid = null,
  eventType,
  eventData = null
}) {
  if (!callSid || !eventType) {
    return false;
  }

  insertEventStatement.run({
    callSid,
    streamSid,
    eventType,
    eventData:
      eventData === null
        ? null
        : JSON.stringify(eventData),
    createdAt:
      new Date().toISOString()
  });

  return true;
}

export function listCalls(
  limit = 50
) {
  const safeLimit = Math.min(
    Math.max(
      Number(limit) || 50,
      1
    ),
    200
  );

  return listCallsStatement.all(
    safeLimit
  );
}

export function getCallDetails(
  callSid
) {
  if (!callSid) {
    return null;
  }

  const call =
    getCallStatement.get(callSid);

  if (!call) {
    return null;
  }

  return {
    ...call,

    messages:
      getMessagesStatement.all(
        callSid
      ),

    events:
      getEventsStatement.all(
        callSid
      )
  };
}

export function getDashboardMetrics() {
  const metrics =
    dashboardMetricsStatement.get();

  return {
    totalCalls:
      Number(metrics.total_calls || 0),
    completedCalls:
      Number(metrics.completed_calls || 0),
    failedCalls:
      Number(metrics.failed_calls || 0),
    callsToday:
      Number(metrics.calls_today || 0),
    callsThisMonth:
      Number(
        metrics.calls_this_month || 0
      ),
    averageDurationSeconds:
      Math.round(
        Number(
          metrics.average_duration_seconds || 0
        )
      )
  };
}

export function getDatabaseHealth() {
  const result = database
    .prepare(`
      SELECT
        1 AS ok
    `)
    .get();

  return {
    ok:
      result?.ok === 1,

    path:
      databasePath
  };
}

export default database;
