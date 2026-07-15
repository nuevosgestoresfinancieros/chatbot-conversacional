import crypto from "crypto";
import express from "express";

import {
  listCalls,
  getCallDetails,
  getDatabaseHealth
} from "./database.js";

const router = express.Router();

const ADMIN_USERNAME =
  process.env.ADMIN_USERNAME || "";

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "";

function safeCompare(valueA, valueB) {
  const bufferA = Buffer.from(
    String(valueA || "")
  );

  const bufferB = Buffer.from(
    String(valueB || "")
  );

  return (
    bufferA.length === bufferB.length &&
    crypto.timingSafeEqual(
      bufferA,
      bufferB
    )
  );
}

function requireAdmin(req, res, next) {
  /*
   * El formulario nuevo utiliza una sesión
   * administrativa persistente.
   */
  if (
    req.session?.adminUser?.id &&
    req.session.adminUser.active
  ) {
    return next();
  }

  /*
   * HTTP Basic se mantiene temporalmente
   * como acceso de emergencia.
   */
  if (
    !ADMIN_USERNAME ||
    !ADMIN_PASSWORD
  ) {
    return res.status(503).send(
      "El panel de administración no está configurado."
    );
  }

  const authorization =
    req.get("Authorization") || "";

  if (
    !authorization.startsWith("Basic ")
  ) {
    res.set(
      "WWW-Authenticate",
      'Basic realm="Panel Cibermedida"'
    );

    return res.status(401).send(
      "Autenticación necesaria"
    );
  }

  try {
    const encodedCredentials =
      authorization.slice(6);

    const decodedCredentials =
      Buffer
        .from(
          encodedCredentials,
          "base64"
        )
        .toString("utf8");

    const separatorPosition =
      decodedCredentials.indexOf(":");

    if (separatorPosition < 0) {
      throw new Error(
        "Credenciales incorrectas"
      );
    }

    const username =
      decodedCredentials.slice(
        0,
        separatorPosition
      );

    const password =
      decodedCredentials.slice(
        separatorPosition + 1
      );

    if (
      !safeCompare(
        username,
        ADMIN_USERNAME
      ) ||
      !safeCompare(
        password,
        ADMIN_PASSWORD
      )
    ) {
      res.set(
        "WWW-Authenticate",
        'Basic realm="Panel Cibermedida"'
      );

      return res.status(401).send(
        "Credenciales incorrectas"
      );
    }

    next();
  } catch (error) {
    res.set(
      "WWW-Authenticate",
      'Basic realm="Panel Cibermedida"'
    );

    return res.status(401).send(
      "Credenciales incorrectas"
    );
  }
}

router.use(requireAdmin);

router.get("/api/health", (req, res) => {
  try {
    res.json({
      ...getDatabaseHealth(),
      admin: true
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

router.get("/api/calls", (req, res) => {
  try {
    const calls = listCalls(
      req.query.limit || 100
    );

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
        call
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
  res.type("html").send(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >

  <title>Panel de llamadas | Cibermedida</title>

  <style>
    :root {
      color-scheme: dark;
      font-family:
        Inter,
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: #07111f;
      color: #e8eef7;
    }

    header {
      padding: 24px;
      background: #0d1b2d;
      border-bottom: 1px solid #223550;
    }

    header h1 {
      margin: 0 0 6px;
      font-size: 24px;
    }

    header p {
      margin: 0;
      color: #a9b8ca;
    }

    main {
      width: min(1400px, 100%);
      margin: 0 auto;
      padding: 24px;
    }

    .summary {
      display: grid;
      grid-template-columns:
        repeat(
          auto-fit,
          minmax(180px, 1fr)
        );
      gap: 16px;
      margin-bottom: 24px;
    }

    .card {
      background: #101e31;
      border: 1px solid #223550;
      border-radius: 14px;
      padding: 18px;
    }

    .card strong {
      display: block;
      margin-top: 8px;
      font-size: 28px;
    }

    .toolbar {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 18px;
    }

    button,
    input,
    select {
      border: 1px solid #304967;
      border-radius: 9px;
      background: #101e31;
      color: #e8eef7;
      padding: 10px 12px;
    }

    button {
      cursor: pointer;
      background: #1769aa;
      border-color: #1769aa;
      font-weight: 700;
    }

    button:hover {
      filter: brightness(1.12);
    }

    .table-wrapper {
      overflow-x: auto;
      border: 1px solid #223550;
      border-radius: 14px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background: #0d1b2d;
    }

    th,
    td {
      padding: 12px;
      border-bottom: 1px solid #223550;
      text-align: left;
      vertical-align: top;
      white-space: nowrap;
    }

    th {
      background: #101e31;
      color: #b9c8da;
    }

    tbody tr {
      cursor: pointer;
    }

    tbody tr:hover {
      background: #14263c;
    }

    .status {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 999px;
      background: #213955;
      font-size: 13px;
    }

    dialog {
      width: min(900px, 94vw);
      max-height: 86vh;
      padding: 0;
      border: 1px solid #304967;
      border-radius: 14px;
      background: #0d1b2d;
      color: #e8eef7;
    }

    dialog::backdrop {
      background: rgb(0 0 0 / 70%);
    }

    .dialog-header {
      position: sticky;
      top: 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px;
      background: #101e31;
      border-bottom: 1px solid #223550;
    }

    .dialog-content {
      padding: 18px;
      overflow: auto;
    }

    .message {
      margin-bottom: 14px;
      padding: 12px;
      border-radius: 10px;
      background: #14263c;
    }

    .message.assistant {
      border-left: 4px solid #4da3ff;
    }

    .message.user {
      border-left: 4px solid #49c78e;
    }

    .message small {
      display: block;
      margin-bottom: 6px;
      color: #a9b8ca;
    }

    .error {
      color: #ff9b9b;
    }

    @media (max-width: 700px) {
      main {
        padding: 14px;
      }

      header {
        padding: 18px;
      }
    }
  </style>
</head>

<body>
  <header>
    <h1>Panel de llamadas</h1>
    <p>
      Historial y transcripciones de Cibermedida
    </p>
  </header>

  <main>
    <section class="summary">
      <article class="card">
        Total de llamadas
        <strong id="totalCalls">0</strong>
      </article>

      <article class="card">
        Completadas
        <strong id="completedCalls">0</strong>
      </article>

      <article class="card">
        Con errores
        <strong id="errorCalls">0</strong>
      </article>

      <article class="card">
        Duración acumulada
        <strong id="totalDuration">0 min</strong>
      </article>
    </section>

    <section class="toolbar">
      <input
        id="search"
        type="search"
        placeholder="Buscar por Call SID, estado o número"
      >

      <select id="statusFilter">
        <option value="">
          Todos los estados
        </option>

        <option value="completed">
          Completadas
        </option>

        <option value="in-progress">
          En curso
        </option>

        <option value="failed">
          Fallidas
        </option>

        <option value="no-answer">
          Sin respuesta
        </option>
      </select>

      <button id="refreshButton">
        Actualizar
      </button>
    </section>

    <p
      id="message"
      class="error"
    ></p>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Estado</th>
            <th>Destino</th>
            <th>Duración</th>
            <th>Modelo</th>
            <th>Call SID</th>
          </tr>
        </thead>

        <tbody id="callsBody"></tbody>
      </table>
    </div>
  </main>

  <dialog id="callDialog">
    <div class="dialog-header">
      <strong id="dialogTitle">
        Detalle de llamada
      </strong>

      <button id="closeDialog">
        Cerrar
      </button>
    </div>

    <div
      id="dialogContent"
      class="dialog-content"
    ></div>
  </dialog>

  <script>
    const callsBody =
      document.querySelector("#callsBody");

    const totalCalls =
      document.querySelector("#totalCalls");

    const completedCalls =
      document.querySelector("#completedCalls");

    const errorCalls =
      document.querySelector("#errorCalls");

    const totalDuration =
      document.querySelector("#totalDuration");

    const message =
      document.querySelector("#message");

    const search =
      document.querySelector("#search");

    const statusFilter =
      document.querySelector("#statusFilter");

    const callDialog =
      document.querySelector("#callDialog");

    const dialogTitle =
      document.querySelector("#dialogTitle");

    const dialogContent =
      document.querySelector("#dialogContent");

    let calls = [];

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function formatDate(value) {
      if (!value) {
        return "-";
      }

      return new Intl.DateTimeFormat(
        "es-ES",
        {
          dateStyle: "short",
          timeStyle: "medium"
        }
      ).format(new Date(value));
    }

    function formatDuration(seconds) {
      const totalSeconds =
        Number(seconds) || 0;

      const minutes =
        Math.floor(totalSeconds / 60);

      const remainingSeconds =
        totalSeconds % 60;

      return (
        minutes +
        " min " +
        remainingSeconds +
        " s"
      );
    }

    function updateSummary() {
      totalCalls.textContent =
        calls.length;

      completedCalls.textContent =
        calls.filter(
          call =>
            call.status === "completed"
        ).length;

      errorCalls.textContent =
        calls.filter(
          call =>
            call.error_message ||
            call.stream_error ||
            [
              "failed",
              "busy",
              "no-answer",
              "canceled"
            ].includes(call.status)
        ).length;

      const seconds =
        calls.reduce(
          (total, call) =>
            total +
            (
              Number(
                call.duration_seconds
              ) || 0
            ),
          0
        );

      totalDuration.textContent =
        Math.round(seconds / 60) +
        " min";
    }

    function renderCalls() {
      const query =
        search.value
          .trim()
          .toLowerCase();

      const status =
        statusFilter.value;

      const filteredCalls =
        calls.filter(call => {
          const searchable =
            [
              call.call_sid,
              call.status,
              call.from_number,
              call.to_number,
              call.model,
              call.voice
            ]
              .join(" ")
              .toLowerCase();

          const matchesQuery =
            !query ||
            searchable.includes(query);

          const matchesStatus =
            !status ||
            call.status === status;

          return (
            matchesQuery &&
            matchesStatus
          );
        });

      callsBody.innerHTML =
        filteredCalls
          .map(call => \`
            <tr
              data-call-sid="\${escapeHtml(
                call.call_sid
              )}"
            >
              <td>
                \${escapeHtml(
                  formatDate(
                    call.created_at
                  )
                )}
              </td>

              <td>
                <span class="status">
                  \${escapeHtml(
                    call.status || "-"
                  )}
                </span>
              </td>

              <td>
                \${escapeHtml(
                  call.to_number || "-"
                )}
              </td>

              <td>
                \${escapeHtml(
                  formatDuration(
                    call.duration_seconds
                  )
                )}
              </td>

              <td>
                \${escapeHtml(
                  call.model || "-"
                )}
              </td>

              <td>
                \${escapeHtml(
                  call.call_sid
                )}
              </td>
            </tr>
          \`)
          .join("");

      document
        .querySelectorAll(
          "[data-call-sid]"
        )
        .forEach(row => {
          row.addEventListener(
            "click",
            () => {
              loadCallDetails(
                row.dataset.callSid
              );
            }
          );
        });
    }

    async function loadCalls() {
      message.textContent = "";

      try {
        const response =
          await fetch(
            "/admin/api/calls?limit=200"
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
            "No se pudo cargar el historial"
          );
        }

        calls = data.calls || [];

        updateSummary();
        renderCalls();
      } catch (error) {
        message.textContent =
          error.message;
      }
    }

    async function loadCallDetails(
      callSid
    ) {
      dialogTitle.textContent =
        callSid;

      dialogContent.innerHTML =
        "<p>Cargando...</p>";

      callDialog.showModal();

      try {
        const response =
          await fetch(
            "/admin/api/calls/" +
            encodeURIComponent(callSid)
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
            "No se pudo cargar la llamada"
          );
        }

        const call = data.call;

        const messages =
          call.messages || [];

        dialogContent.innerHTML = \`
          <div class="card">
            <p>
              <strong>Estado:</strong>
              \${escapeHtml(
                call.status || "-"
              )}
            </p>

            <p>
              <strong>Destino:</strong>
              \${escapeHtml(
                call.to_number || "-"
              )}
            </p>

            <p>
              <strong>Duración:</strong>
              \${escapeHtml(
                formatDuration(
                  call.duration_seconds
                )
              )}
            </p>

            <p>
              <strong>Modelo:</strong>
              \${escapeHtml(
                call.model || "-"
              )}
            </p>

            <p>
              <strong>Voz:</strong>
              \${escapeHtml(
                call.voice || "-"
              )}
            </p>

            <p>
              <strong>Error:</strong>
              \${escapeHtml(
                call.error_message ||
                call.stream_error ||
                "Ninguno"
              )}
            </p>
          </div>

          <h2>Conversación</h2>

          \${
            messages.length
              ? messages
                  .map(item => \`
                    <div
                      class="message \${escapeHtml(
                        item.speaker
                      )}"
                    >
                      <small>
                        \${escapeHtml(
                          item.speaker ===
                            "assistant"
                            ? "Asistente"
                            : "Usuario"
                        )}
                        ·
                        \${escapeHtml(
                          formatDate(
                            item.created_at
                          )
                        )}
                      </small>

                      \${escapeHtml(
                        item.message
                      )}
                    </div>
                  \`)
                  .join("")
              : "<p>No hay transcripciones guardadas.</p>"
          }
        \`;
      } catch (error) {
        dialogContent.innerHTML =
          '<p class="error">' +
          escapeHtml(error.message) +
          "</p>";
      }
    }

    document
      .querySelector(
        "#refreshButton"
      )
      .addEventListener(
        "click",
        loadCalls
      );

    document
      .querySelector(
        "#closeDialog"
      )
      .addEventListener(
        "click",
        () => callDialog.close()
      );

    search.addEventListener(
      "input",
      renderCalls
    );

    statusFilter.addEventListener(
      "change",
      renderCalls
    );

    loadCalls();
  </script>
</body>
</html>`);
});

export default router;
