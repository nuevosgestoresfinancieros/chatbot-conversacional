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
        <td colspan="7">
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
              colspan="7"
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
                call.duration_seconds ??
                call.duration
              )}
            </td>

            <td>
              <button
                class="secondary-button call-detail-button"
                type="button"
                data-call-sid="${escapeHtml(
                  call.call_sid || ""
                )}"
              >
                Ver detalle
              </button>
            </td>
          </tr>
        `)
        .join("");
    } catch (error) {
      body.innerHTML = `
        <tr>
          <td
            colspan="7"
            class="error-state"
          >
            ${escapeHtml(error.message)}
          </td>
        </tr>
      `;
    }
  }

  function renderEventData(value) {
    if (!value) {
      return "—";
    }

    try {
      return JSON.stringify(
        JSON.parse(value),
        null,
        2
      );
    } catch {
      return String(value);
    }
  }

  async function showCallDetail(callSid) {
    const card = document.getElementById(
      "callDetailCard"
    );

    const content = document.getElementById(
      "callDetailContent"
    );

    if (!card || !content || !callSid) {
      return;
    }

    card.hidden = false;
    content.innerHTML = `
      <p class="module-loading">
        Cargando detalle...
      </p>
    `;

    try {
      const payload = await fetchJson(
        `/admin/api/calls/${encodeURIComponent(
          callSid
        )}`
      );

      const call = payload.call || {};
      const events = Array.isArray(call.events)
        ? call.events
        : [];
      const messages = Array.isArray(
        call.messages
      )
        ? call.messages
        : [];

      document.getElementById(
        "callDetailTitle"
      ).textContent =
        call.call_sid || callSid;

      document.getElementById(
        "callDetailSubtitle"
      ).textContent =
        `${call.client || "Sin cliente"} · ${call.campaign || "Sin campaña"}`;

      content.innerHTML = `
        <dl class="call-detail-grid">
          <div><dt>Estado</dt><dd>${statusBadge(
            callStatus(call)
          )}</dd></div>
          <div><dt>Destino</dt><dd>${escapeHtml(
            call.to_number || "—"
          )}</dd></div>
          <div><dt>Agente</dt><dd>${escapeHtml(
            call.agent || "—"
          )}</dd></div>
          <div><dt>Voz</dt><dd>${escapeHtml(
            call.voice || "—"
          )}</dd></div>
          <div><dt>Modelo</dt><dd>${escapeHtml(
            call.model || "—"
          )}</dd></div>
          <div><dt>Duración</dt><dd>${formatDuration(
            call.duration_seconds
          )}</dd></div>
          <div><dt>Creada</dt><dd>${formatDate(
            call.created_at
          )}</dd></div>
          <div><dt>Completada</dt><dd>${formatDate(
            call.completed_at
          )}</dd></div>
        </dl>

        <section class="call-detail-section">
          <h4>Notas</h4>
          <p>${escapeHtml(call.notes || "Sin notas")}</p>
          ${call.error_message
            ? `<p class="error-state">${escapeHtml(
                call.error_message
              )}</p>`
            : ""}
        </section>

        <section class="call-detail-section">
          <h4>Eventos</h4>
          ${events.length
            ? events.map(event => `
                <article class="call-timeline-item">
                  <strong>${escapeHtml(
                    event.event_type
                  )}</strong>
                  <time>${formatDate(
                    event.created_at
                  )}</time>
                  <pre>${escapeHtml(
                    renderEventData(
                      event.event_data
                    )
                  )}</pre>
                </article>
              `).join("")
            : "<p>Sin eventos.</p>"}
        </section>

        <section class="call-detail-section">
          <h4>Mensajes</h4>
          ${messages.length
            ? messages.map(message => `
                <article class="call-message-item">
                  <strong>${escapeHtml(
                    message.speaker
                  )}</strong>
                  <time>${formatDate(
                    message.created_at
                  )}</time>
                  <p>${escapeHtml(
                    message.message
                  )}</p>
                </article>
              `).join("")
            : "<p>Sin mensajes registrados.</p>"}
        </section>
      `;

      card.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    } catch (error) {
      content.innerHTML = `
        <p class="error-state">
          ${escapeHtml(error.message)}
        </p>
      `;
    }
  }

  async function loadOptions() {
    let payload;

    try {
      payload = await fetchJson(
        "/admin/api/calls/options"
      );
    } catch {
      /*
       * Compatibilidad durante el despliegue:
       * conserva las opciones incluidas en la
       * vista hasta que el backend se reinicie.
       */
      return;
    }

    const agentSelect =
      document.getElementById("callAgent");
    const voiceSelect =
      document.getElementById("callVoice");

    if (agentSelect) {
      agentSelect.innerHTML = payload.agents
        .map(agent => `
          <option value="${escapeHtml(agent)}">
            ${escapeHtml(agent)}
          </option>
        `)
        .join("");
      agentSelect.value = payload.defaultAgent;
    }

    if (voiceSelect) {
      voiceSelect.innerHTML = payload.voices
        .map(voice => `
          <option value="${escapeHtml(voice)}">
            ${escapeHtml(voice)}
          </option>
        `)
        .join("");
      voiceSelect.value = payload.defaultVoice;
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

        const agent =
          document.getElementById(
            "callAgent"
          )?.value;

        const voice =
          document.getElementById(
            "callVoice"
          )?.value;

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
                agent,
                voice,
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

      await loadOptions();
      bindCallForm();

      document.getElementById(
        "callsTableBody"
      )?.addEventListener(
        "click",
        event => {
          const button = event.target.closest(
            "[data-call-sid]"
          );

          if (button) {
            showCallDetail(
              button.dataset.callSid
            );
          }
        }
      );

      document.getElementById(
        "closeCallDetail"
      )?.addEventListener(
        "click",
        () => {
          document.getElementById(
            "callDetailCard"
          ).hidden = true;
        }
      );

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
