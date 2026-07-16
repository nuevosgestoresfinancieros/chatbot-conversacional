import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import {
  findUserByUsername,
  verifyPassword,
  updateLastLogin,
  recordLoginAttempt,
  countRecentFailedAttempts,
  clearFailedAttempts,
  cleanOldLoginAttempts,
  addAuditEntry
} from "../services/auth-service.js";

import {
  getCsrfToken,
  verifyCsrfToken
} from "../middleware/csrf.js";

const router = express.Router();

const currentFile =
  fileURLToPath(import.meta.url);

const currentDirectory =
  path.dirname(currentFile);

const loginTemplatePath =
  path.resolve(
    currentDirectory,
    "../views/login.html"
  );

const maxLoginAttempts = Math.min(
  Math.max(
    Number(
      process.env.ADMIN_MAX_LOGIN_ATTEMPTS
    ) || 5,
    1
  ),
  20
);

const lockMinutes = Math.min(
  Math.max(
    Number(
      process.env.ADMIN_LOCK_MINUTES
    ) || 15,
    1
  ),
  1440
);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderLogin(
  req,
  res,
  {
    status = 200,
    error = ""
  } = {}
) {
  const template =
    fs.readFileSync(
      loginTemplatePath,
      "utf8"
    );

  const csrfToken =
    getCsrfToken(req);

  const errorHtml = error
    ? `<div class="error">${escapeHtml(
        error
      )}</div>`
    : "";

  res
    .status(status)
    .type("html")
    .send(
      template
        .replace(
          "{{CSRF_TOKEN}}",
          escapeHtml(csrfToken)
        )
        .replace(
          "{{ERROR}}",
          errorHtml
        )
    );
}

function getClientIp(req) {
  return String(
    req.ip ||
    req.socket?.remoteAddress ||
    "desconocida"
  );
}

router.get(
  "/login",
  (req, res) => {
    if (req.session?.adminUser?.id) {
      return res.redirect("/admin/");
    }

    return renderLogin(req, res);
  }
);

router.post(
  "/login",
  verifyCsrfToken,
  (req, res) => {
    cleanOldLoginAttempts();

    const username =
      String(
        req.body.username || ""
      ).trim();

    const password =
      String(
        req.body.password || ""
      );

    const ip = getClientIp(req);

    const failedAttempts =
      countRecentFailedAttempts({
        username,
        ip,
        lockMinutes
      });

    if (
      failedAttempts >=
      maxLoginAttempts
    ) {
      addAuditEntry({
        username,
        action: "login-blocked",
        detail: {
          failedAttempts,
          lockMinutes
        },
        ip
      });

      return renderLogin(
        req,
        res,
        {
          status: 429,
          error:
            `Acceso bloqueado temporalmente. Inténtalo de nuevo dentro de ${lockMinutes} minutos.`
        }
      );
    }

    const user =
      findUserByUsername(username);

    const validLogin =
      Boolean(
        user &&
        user.active === 1 &&
        verifyPassword(
          password,
          user.password_hash
        )
      );

    recordLoginAttempt({
      username,
      ip,
      success: validLogin
    });

    if (!validLogin) {
      addAuditEntry({
        userId: user?.id || null,
        username,
        action: "login-failed",
        detail: {
          reason:
            user?.active === 0
              ? "inactive-user"
              : "invalid-credentials"
        },
        ip
      });

      return renderLogin(
        req,
        res,
        {
          status: 401,
          error:
            "Usuario o contraseña incorrectos."
        }
      );
    }

    clearFailedAttempts({
      username,
      ip
    });

    updateLastLogin(user.id);

    req.session.regenerate(
      error => {
        if (error) {
          console.error(
            "Error regenerando sesión:",
            error.message
          );

          return renderLogin(
            req,
            res,
            {
              status: 500,
              error:
                "No se pudo iniciar la sesión."
            }
          );
        }

        req.session.adminUser = {
          id: user.id,
          username: user.username,
          role: user.role,
          active: true
        };

        getCsrfToken(req);

        addAuditEntry({
          userId: user.id,
          username: user.username,
          action: "login-success",
          detail: {
            role: user.role
          },
          ip
        });

        req.session.save(
          saveError => {
            if (saveError) {
              console.error(
                "Error guardando sesión:",
                saveError.message
              );

              return renderLogin(
                req,
                res,
                {
                  status: 500,
                  error:
                    "No se pudo guardar la sesión."
                }
              );
            }

            return res.redirect(
              "/admin/"
            );
          }
        );
      }
    );
  }
);

router.post(
  "/logout",
  verifyCsrfToken,
  (req, res) => {
    const user =
      req.session?.adminUser;

    const ip = getClientIp(req);

    if (user?.id) {
      addAuditEntry({
        userId: user.id,
        username: user.username,
        action: "logout",
        ip
      });
    }

    req.session.destroy(
      error => {
        if (error) {
          console.error(
            "Error cerrando sesión:",
            error.message
          );

          return res.status(500).send(
            "No se pudo cerrar la sesión."
          );
        }

        res.clearCookie(
          "cibermedida_admin"
        );

        return res.redirect(
          "/admin/login"
        );
      }
    );
  }
);

export default router;
