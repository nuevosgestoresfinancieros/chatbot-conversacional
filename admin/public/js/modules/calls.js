"use strict";

(() => {
  const moduleName = "calls";

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function csrfToken() {
    return (
      document
        .querySelector(
          'meta[name="csrf-token"]'
        )
        ?.getAttribute("content") ||
      ""
    );
  }

  async function fetchJson(
    url,
    options = {}
  ) {
    const response = await fetch(
      url,
      {
        ...options,

        headers: {
          Accept: "application/json",
          ...(options.headers || {})
        }
      }
    );

    let payload;

    try {
      payload = await response.json();
    } catch {
      payload = {
        ok: false,
        error:
          `Respuesta no válida (${response.status})`
      };
    }

    if (
      !response.ok ||
      payload.ok === false
    ) {
      throw new Error(
        payload.error ||
        `Error HTTP ${response.status}`
      );
    }

    return payload;
  }

  function formatDate(value) {
    if (!value) {
      return "Sin fecha";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return escapeHtml(value);
    }

    return new Intl.DateTimeFormat(
      "es-ES",
      {
        dateStyle: "short",
        timeStyle: "short"
      }
    ).format(date);
  }

  function formatDuration(value) {
    const seconds = Number(value);

    if (!Number.isFinite(seconds)) {
      return "—";
    }

    const minutes =
      Math.floor(seconds / 60);

    const remaining =
      Math.floor(seconds % 60);

    return `${minutes}:${String(
      remaining
    ).padStart(2, "0")}`;
  }

  function callStatus(call) {
    return String(
      call.status ||
      call.call_status ||
      call.stream_status ||
      "desconocido"
    );
  }

  function statusBadge(status) {
    const normalized =
      String(status).toLowerCase();

    let badgeClass = "badge-info";

    if (
      normalized.includes("complete") ||
      normalized.includes("final")
    ) {
      badgeClass = "badge-success";
    }

    if (
      normalized.includes("fail") ||
      normalized.includes("error") ||
      normalized.includes("cancel")
    ) {
      badgeClass = "badge-danger";
    }

    return `
      <span class="badge ${badgeClass}">
        ${escapeHtml(status)}
      </span>
    `;
  }

  async function loadHistory() {
    const body =
      document.getElementById(
        "callsTableBody"
      );

    if (!body) {
      return;
    }

    body.innerHTML = `
      <tr>
        <td colspan="6">
          Cargando historial...
        </td>
      </tr>
    `;

    try {
      const payload = await fetchJson(
        "/admin/api/calls?limit=100"
      );

      const calls =
        Array.isArray(payload.calls)
          ? payload.calls
          : [];

      if (!calls.length) {
        body.innerHTML = `
          <tr>
            <td
              colspan="6"
              class="empty-state"
            >
              No hay llamadas registradas.
            </td>
          </tr>
        `;

        return;
      }

      body.innerHTML = calls
        .map(call => `
          <tr>
            <td>
              ${formatDate(
                call.created_at ||
                call.started_at ||
                call.updated_at
              )}
            </td>

            <td>
              ${escapeHtml(
                call.call_sid ||
                call.callSid ||
                "—"
              )}
            </td>

            <td>
              ${escapeHtml(
                call.from_number ||
                call.from ||
                "—"
              )}
            </td>

            <td>
              ${escapeHtml(
                call.to_number ||
                call.to ||
                "—"
              )}
            </td>

            <td>
              ${statusBadge(
                callStatus(call)
              )}
            </td>

            <td>
              ${formatDuration(
                call.duration_seconds ||
                call.duration
              )}
            </td>
          </tr>
        `)
        .join("");
    } catch (error) {
      body.innerHTML = `
        <tr>
          <td
            colspan="6"
            class="error-state"
          >
            ${escapeHtml(error.message)}
          </td>
        </tr>
      `;
    }
  }

  function setMessage(
    message,
    type = ""
  ) {
    const element =
      document.getElementById(
        "callOperationMessage"
      );

    if (!element) {
      return;
    }

    element.textContent = message;
    element.className =
      `operation-message ${type}`.trim();
  }

  function bindCallForm() {
    const form =
      document.getElementById(
        "newCallForm"
      );

    if (!form || form.dataset.bound) {
      return;
    }

    form.dataset.bound = "true";

    form.addEventListener(
      "submit",
      async event => {
        event.preventDefault();

        const button =
          document.getElementById(
            "startCallButton"
          );

        const phone =
          document.getElementById(
            "callPhone"
          )?.value.trim();

        const client =
          document.getElementById(
            "callClient"
          )?.value.trim();

        const campaign =
          document.getElementById(
            "callCampaign"
          )?.value.trim();

        const notes =
          document.getElementById(
            "callNotes"
          )?.value.trim();

        if (!phone) {
          setMessage(
            "Debes indicar un número de teléfono.",
            "error"
          );

          return;
        }

        button.disabled = true;
        button.classList.add("loading");

        setMessage(
          "Solicitando la llamada a Twilio...",
          "info"
        );

        try {
          const payload = await fetchJson(
            "/admin/api/calls/start",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                "X-CSRF-Token":
                  csrfToken()
              },

              body: JSON.stringify({
                telefono: phone,
                client,
                campaign,
                notes
              })
            }
          );

          setMessage(
            "La llamada se ha iniciado correctamente.",
            "success"
          );

          const resultCard =
            document.getElementById(
              "callResultCard"
            );

          resultCard.hidden = false;

          document.getElementById(
            "callResultSid"
          ).textContent =
            payload.call_sid || "—";

          document.getElementById(
            "callResultStatus"
          ).textContent =
            payload.status || "solicitada";

          await loadHistory();
        } catch (error) {
          setMessage(
            error.message,
            "error"
          );
        } finally {
          button.disabled = false;
          button.classList.remove(
            "loading"
          );
        }
      }
    );
  }

  async function mount() {
    const host =
      document.getElementById(
        "callsModuleMount"
      );

    if (!host) {
      return;
    }

    host.innerHTML = `
      <article class="glass-card module-loading">
        Cargando centro de llamadas...
      </article>
    `;

    try {
      const response = await fetch(
        `/admin/module/${moduleName}`,
        {
          headers: {
            Accept: "text/html"
          }
        }
      );

      if (!response.ok) {
        throw new Error(
          `No se pudo cargar Llamadas (${response.status})`
        );
      }

      host.innerHTML =
        await response.text();

      bindCallForm();

      document.getElementById(
        "reloadCalls"
      )?.addEventListener(
        "click",
        loadHistory
      );

      await loadHistory();
    } catch (error) {
      host.innerHTML = `
        <article class="glass-card module-error">
          <h2>No se pudo cargar Llamadas</h2>
          <p>${escapeHtml(error.message)}</p>
        </article>
      `;
    }
  }

  window.CibermedidaCalls = {
    mount,
    loadHistory
  };
})();
