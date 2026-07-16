import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import {
  listCalls,
  getCallDetails,
  getDatabaseHealth,
  getDashboardMetrics
} from "./database.js";

import {
  getCsrfToken
} from "./admin/middleware/csrf.js";

import {
  requireAdminSession
} from "./admin/middleware/admin-session.js";

const router = express.Router();

const currentFile =
  fileURLToPath(import.meta.url);

const currentDirectory =
  path.dirname(currentFile);

const dashboardTemplatePath =
  path.join(
    currentDirectory,
    "admin/views/dashboard.html"
  );

const adminAssetsDirectory =
  path.join(
    currentDirectory,
    "admin/public"
  );


const moduleViewsDirectory =
  path.join(
    currentDirectory,
    "admin/views/modules"
  );

const allowedAdminModules =
  new Set([
    "calls",
    "conversations",
    "clients",
    "agents",
    "rag",
    "ai-stats",
    "connections",
    "make",
    "twilio",
    "openai",
    "webhooks",
    "external-apis",
    "users",
    "audit",
    "settings",
    "system"
  ]);

const adminOnlyModules =
  new Set([
    "connections",
    "make",
    "twilio",
    "openai",
    "webhooks",
    "external-apis",
    "users",
    "settings"
  ]);


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sanitizeEventData(value) {
  if (!value) {
    return value;
  }

  try {
    const data = JSON.parse(value);

    if (data.streamError) {
      data.streamError =
        "Incidencia de Media Stream";
    }

    return JSON.stringify(data);
  } catch {
    return "Información técnica registrada";
  }
}

function sanitizeCallForAdmin(call) {
  return {
    ...call,
    stream_error: call.stream_error
      ? "Incidencia de Media Stream"
      : null,
    error_message: call.error_message
      ? "La llamada registró un error interno"
      : null,
    events: Array.isArray(call.events)
      ? call.events.map(event => ({
          ...event,
          event_data:
            sanitizeEventData(
              event.event_data
            )
        }))
      : call.events
  };
}

router.use(requireAdminSession);

router.use(
  "/assets",
  express.static(
    adminAssetsDirectory,
    {
      fallthrough: false,
      maxAge:
        process.env.NODE_ENV ===
        "production"
          ? "1h"
          : 0
    }
  )
);


router.get(
  "/module/:moduleName",
  (req, res) => {
    const moduleName =
      String(
        req.params.moduleName || ""
      );

    if (
      !allowedAdminModules.has(
        moduleName
      )
    ) {
      return res.status(404).send(
        "Módulo no encontrado."
      );
    }

    if (
      adminOnlyModules.has(moduleName) &&
      req.session.adminUser.role !== "admin"
    ) {
      return res.status(403).send(
        "No tienes permisos para abrir este módulo."
      );
    }

    const modulePath =
      path.join(
        moduleViewsDirectory,
        `${moduleName}.html`
      );

    if (!fs.existsSync(modulePath)) {
      return res.status(404).send(
        "Vista del módulo no encontrada."
      );
    }

    return res.sendFile(modulePath);
  }
);

router.get("/api/health", (req, res) => {
  try {
    res.json({
      ...getDatabaseHealth(),
      admin: true
    });
  } catch (error) {
    console.error(
      "Error comprobando panel:",
      error.message
    );

    res.status(500).json({
      ok: false,
      error:
        "No se pudo comprobar el estado del panel"
    });
  }
});

router.get(
  "/api/dashboard",
  (req, res) => {
    try {
      res.json({
        ok: true,
        metrics:
          getDashboardMetrics(),
        calls:
          listCalls(8).map(
            sanitizeCallForAdmin
          )
      });
    } catch (error) {
      console.error(
        "Error cargando métricas:",
        error.message
      );

      res.status(500).json({
        ok: false,
        error:
          "No se pudieron cargar las métricas"
      });
    }
  }
);

router.get("/api/calls", (req, res) => {
  try {
    const calls = listCalls(
      req.query.limit || 100
    ).map(sanitizeCallForAdmin);

    res.json({
      ok: true,
      total: calls.length,
      calls
    });
  } catch (error) {
    console.error(
      "Error panel llamadas:",
      error.message
    );

    res.status(500).json({
      ok: false,
      error:
        "No se pudo consultar el historial"
    });
  }
});

router.get(
  "/api/calls/:callSid",
  (req, res) => {
    try {
      const call = getCallDetails(
        req.params.callSid
      );

      if (!call) {
        return res.status(404).json({
          ok: false,
          error:
            "Llamada no encontrada"
        });
      }

      res.json({
        ok: true,
        call:
          sanitizeCallForAdmin(call)
      });
    } catch (error) {
      console.error(
        "Error panel detalle:",
        error.message
      );

      res.status(500).json({
        ok: false,
        error:
          "No se pudo consultar la llamada"
      });
    }
  }
);

router.get("/", (req, res) => {
  try {
    const template =
      fs.readFileSync(
        dashboardTemplatePath,
        "utf8"
      );

    const user =
      req.session.adminUser;

    const username =
      String(
        user.username ||
        "Administrador"
      );

    const role =
      String(
        user.role ||
        "admin"
      );

    const userInitial =
      username
        .trim()
        .charAt(0)
        .toUpperCase() || "A";

    const csrfToken =
      getCsrfToken(req);

    return res
      .type("html")
      .send(
        template
          .replaceAll(
            "{{USERNAME}}",
            escapeHtml(username)
          )
          .replaceAll(
            "{{USER_ROLE}}",
            escapeHtml(role)
          )
          .replaceAll(
            "{{USER_INITIAL}}",
            escapeHtml(userInitial)
          )
          .replaceAll(
            "{{CSRF_TOKEN}}",
            escapeHtml(csrfToken)
          )
      );
  } catch (error) {
    console.error(
      "Error cargando dashboard:",
      error.message
    );

    return res.status(500).send(
      "No se pudo cargar el panel."
    );
  }
});

export default router;
