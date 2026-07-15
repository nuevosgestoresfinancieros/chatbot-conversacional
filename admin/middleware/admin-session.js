import session from "express-session";
import connectSqlite3 from "connect-sqlite3";
import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const currentFile =
  fileURLToPath(import.meta.url);

const currentDirectory =
  path.dirname(currentFile);

const projectDirectory =
  path.resolve(
    currentDirectory,
    "../.."
  );

const dataDirectory =
  path.join(
    projectDirectory,
    "data"
  );

const sessionDatabasePath =
  path.join(
    dataDirectory,
    "admin-sessions.db"
  );

const SQLiteStore =
  connectSqlite3(session);

/*
 * connect-sqlite3 necesita una conexión
 * sqlite3 inicializada, no una ruta.
 */
const sessionDatabase =
  new sqlite3.Database(
    sessionDatabasePath,
    error => {
      if (error) {
        console.error(
          "Error abriendo base de sesiones:",
          error.message
        );

        return;
      }

      console.log(
        "Base de sesiones SQLite preparada"
      );
    }
  );

const SESSION_SECRET =
  String(
    process.env.SESSION_SECRET || ""
  );

if (!SESSION_SECRET) {
  throw new Error(
    "Falta SESSION_SECRET en .env"
  );
}

const sessionHours = Math.min(
  Math.max(
    Number(
      process.env.ADMIN_SESSION_HOURS
    ) || 8,
    1
  ),
  168
);

export const adminSessionMiddleware =
  session({
    name: "cibermedida_admin",

    secret: SESSION_SECRET,

    resave: false,

    saveUninitialized: false,

    rolling: true,

    store: new SQLiteStore({
      db: sessionDatabase,
      table: "admin_sessions",
      concurrentDB: true
    }),

    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax",

      maxAge:
        sessionHours *
        60 *
        60 *
        1000
    }
  });

export function requireAdminSession(
  req,
  res,
  next
) {
  if (
    req.session?.adminUser?.id &&
    req.session.adminUser.active
  ) {
    return next();
  }

  if (
    req.accepts("html") &&
    !req.path.startsWith("/api/")
  ) {
    return res.redirect(
      "/admin/login"
    );
  }

  return res.status(401).json({
    ok: false,
    error:
      "Sesión administrativa necesaria"
  });
}

export function requireAdminRole(
  ...allowedRoles
) {
  const roles = new Set(
    allowedRoles.map(role =>
      String(role || "").toLowerCase()
    )
  );

  return function checkAdminRole(
    req,
    res,
    next
  ) {
    const role = String(
      req.session?.adminUser?.role || ""
    ).toLowerCase();

    if (roles.has(role)) {
      return next();
    }

    return res.status(403).json({
      ok: false,
      error:
        "No tienes permisos para realizar esta operación"
    });
  };
}
