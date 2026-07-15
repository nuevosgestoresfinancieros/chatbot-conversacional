import session from "express-session";
import connectSqlite3 from "connect-sqlite3";
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

const SQLiteStore =
  connectSqlite3(session);

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
      db: "admin-sessions.db",
      dir: path.join(
        projectDirectory,
        "data"
      ),
      table: "admin_sessions"
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
