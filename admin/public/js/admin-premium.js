"use strict";

const modules = {
  dashboard: {
    title: "Dashboard",
    description:
      "Estado general del agente telefónico.",
    category: "INICIO",
    features: []
  },

  calls: {
    title: "Llamadas",
    description:
      "Historial, estado y seguimiento de llamadas.",
    category: "OPERACIONES",
    features: []
  },

  conversations: {
    title: "Conversaciones",
    description:
      "Transcripciones, mensajes, resúmenes y análisis de conversaciones.",
    category: "OPERACIONES",
    features: [
      {
        icon: "◉",
        title: "Transcripciones",
        text:
          "Consulta el contenido completo de las conversaciones telefónicas."
      },
      {
        icon: "✦",
        title: "Resúmenes IA",
        text:
          "Genera resúmenes y puntos clave de cada llamada."
      },
      {
        icon: "✓",
        title: "Acciones detectadas",
        text:
          "Identifica compromisos, incidencias y tareas pendientes."
      }
    ]
  },

  clients: {
    title: "Clientes",
    description:
      "Gestión de contactos, empresas, teléfonos y actividad.",
    category: "OPERACIONES",
    features: [
      {
        icon: "♙",
        title: "Ficha de cliente",
        text:
          "Información de contacto, empresa, notas y estado."
      },
      {
        icon: "☎",
        title: "Historial de llamadas",
        text:
          "Relación completa de llamadas asociadas al cliente."
      },
      {
        icon: "▥",
        title: "Seguimiento",
        text:
          "Próximas acciones, recordatorios y oportunidades."
      }
    ]
  },

  agents: {
    title: "Agentes IA",
    description:
      "Configuración de modelos, voces, instrucciones y comportamiento.",
    category: "INTELIGENCIA ARTIFICIAL",
    features: [
      {
        icon: "◇",
        title: "Configuración del agente",
        text:
          "Nombre, modelo, voz, idioma y parámetros de conversación."
      },
      {
        icon: "✎",
        title: "Prompt del sistema",
        text:
          "Instrucciones empresariales y reglas de atención."
      },
      {
        icon: "◉",
        title: "Pruebas",
        text:
          "Validación del agente antes de aplicarlo a producción."
      }
    ]
  },

  rag: {
    title: "Documentación (RAG)",
    description:
      "Biblioteca de conocimiento para responder con información empresarial.",
    category: "INTELIGENCIA ARTIFICIAL",
    features: [
      {
        icon: "▤",
        title: "Biblioteca documental",
        text:
          "Carga y organización de PDF, DOCX y archivos de texto."
      },
      {
        icon: "⌕",
        title: "Búsqueda semántica",
        text:
          "Localización de fragmentos relevantes para cada consulta."
      },
      {
        icon: "✓",
        title: "Fuentes y trazabilidad",
        text:
          "Identificación del documento utilizado en cada respuesta."
      }
    ]
  },

  "ai-stats": {
    title: "Estadísticas IA",
    description:
      "Consumo, costes, rendimiento, modelos y latencia.",
    category: "INTELIGENCIA ARTIFICIAL",
    features: [
      {
        icon: "▥",
        title: "Consumo de tokens",
        text:
          "Seguimiento diario y mensual del consumo de modelos."
      },
      {
        icon: "€",
        title: "Costes estimados",
        text:
          "Estimación del coste de OpenAI y servicios asociados."
      },
      {
        icon: "◷",
        title: "Latencia",
        text:
          "Tiempo medio de respuesta y rendimiento del agente."
      }
    ]
  },

  connections: {
    title: "Conexiones",
    description:
      "Centro de integraciones de la plataforma.",
    category: "INTEGRACIONES",
    features: [
      {
        icon: "M",
        title: "Make",
        text:
          "Escenarios, webhooks, eventos y automatizaciones."
      },
      {
        icon: "☎",
        title: "Twilio",
        text:
          "Telefonía, números, llamadas y estados."
      },
      {
        icon: "AI",
        title: "OpenAI",
        text:
          "Modelos Realtime, consumo y configuración."
      }
    ]
  },

  make: {
    title: "Conexiones Make",
    description:
      "Gestiona webhooks, escenarios, eventos y ejecuciones.",
    category: "INTEGRACIONES",
    features: [
      {
        icon: "M",
        title: "Webhooks de Make",
        text:
          "Alta, prueba, activación y desactivación de conexiones."
      },
      {
        icon: "↯",
        title: "Eventos automáticos",
        text:
          "Llamada iniciada, completada, error y transcripción disponible."
      },
      {
        icon: "▤",
        title: "Registro de ejecuciones",
        text:
          "Historial de solicitudes, respuestas y errores."
      }
    ]
  },

  twilio: {
    title: "Conexión Twilio",
    description:
      "Configuración y seguimiento del proveedor telefónico.",
    category: "INTEGRACIONES",
    features: [
      {
        icon: "☎",
        title: "Números",
        text:
          "Gestión de números y asignación a agentes."
      },
      {
        icon: "◉",
        title: "Estado de llamadas",
        text:
          "Seguimiento de llamadas iniciadas, contestadas y completadas."
      },
      {
        icon: "⚙",
        title: "Webhooks Twilio",
        text:
          "Configuración de voz, estado y Media Streams."
      }
    ]
  },

  openai: {
    title: "Conexión OpenAI",
    description:
      "Modelos, voces, consumo y estado de OpenAI.",
    category: "INTEGRACIONES",
    features: [
      {
        icon: "AI",
        title: "Modelo Realtime",
        text:
          "Selección y estado del modelo utilizado por el agente."
      },
      {
        icon: "◖",
        title: "Voces",
        text:
          "Configuración de la voz de conversación."
      },
      {
        icon: "▥",
        title: "Consumo",
        text:
          "Seguimiento de tokens y estimación de costes."
      }
    ]
  },

  webhooks: {
    title: "Webhooks",
    description:
      "Gestión de eventos entrantes y salientes.",
    category: "INTEGRACIONES",
    features: [
      {
        icon: "→",
        title: "Webhooks salientes",
        text:
          "Envío de eventos a Make, CRM y otros servicios."
      },
      {
        icon: "←",
        title: "Webhooks entrantes",
        text:
          "Recepción segura de eventos externos."
      },
      {
        icon: "▤",
        title: "Historial",
        text:
          "Registro de solicitudes, respuestas y reintentos."
      }
    ]
  },

  "external-apis": {
    title: "APIs externas",
    description:
      "Conexiones adicionales con servicios de terceros.",
    category: "INTEGRACIONES",
    features: [
      {
        icon: "＋",
        title: "Nueva conexión",
        text:
          "Configuración de URL, autenticación y cabeceras."
      },
      {
        icon: "✓",
        title: "Prueba de conexión",
        text:
          "Validación controlada antes de activar una integración."
      },
      {
        icon: "⚿",
        title: "Credenciales",
        text:
          "Almacenamiento protegido de claves y tokens."
      }
    ]
  },

  users: {
    title: "Usuarios",
    description:
      "Cuentas administrativas, roles y permisos.",
    category: "ADMINISTRACIÓN",
    features: [
      {
        icon: "♙",
        title: "Cuentas",
        text:
          "Alta, edición, activación y desactivación de usuarios."
      },
      {
        icon: "⚿",
        title: "Roles",
        text:
          "Superadministrador, administrador, operador y lectura."
      },
      {
        icon: "✓",
        title: "Seguridad",
        text:
          "Cambio de contraseña y control de accesos."
      }
    ]
  },

  audit: {
    title: "Auditoría",
    description:
      "Registro de accesos, cambios y operaciones administrativas.",
    category: "ADMINISTRACIÓN",
    features: [
      {
        icon: "✓",
        title: "Accesos",
        text:
          "Inicio de sesión, cierre de sesión e intentos fallidos."
      },
      {
        icon: "✎",
        title: "Cambios",
        text:
          "Registro de modificaciones realizadas desde el panel."
      },
      {
        icon: "⌕",
        title: "Filtros",
        text:
          "Búsqueda por usuario, acción, fecha e IP."
      }
    ]
  },

  settings: {
    title: "Configuración",
    description:
      "Parámetros generales del agente y de Cibermedida.",
    category: "ADMINISTRACIÓN",
    features: [
      {
        icon: "⚙",
        title: "Empresa",
        text:
          "Nombre, correo, teléfono, ubicación y horarios."
      },
      {
        icon: "◇",
        title: "Agente",
        text:
          "Modelo, voz, instrucciones y límites."
      },
      {
        icon: "⚿",
        title: "Seguridad",
        text:
          "Sesiones, bloqueo de accesos y permisos."
      }
    ]
  },

  system: {
    title: "Monitor del sistema",
    description:
      "Estado del servidor, Node, PM2, SQLite y servicios.",
    category: "SISTEMA",
    features: [
      {
        icon: "▣",
        title: "Servidor",
        text:
          "CPU, memoria, almacenamiento y tiempo de actividad."
      },
      {
        icon: "N",
        title: "Node y PM2",
        text:
          "Estado del proceso, reinicios y consumo."
      },
      {
        icon: "DB",
        title: "SQLite",
        text:
          "Estado, tamaño y comprobación de la base de datos."
      }
    ]
  }
};

const navItems =
  document.querySelectorAll(
    "[data-module]"
  );

const adminRole =
  document
    .querySelector(
      'meta[name="admin-role"]'
    )
    ?.getAttribute("content") || "";

if (adminRole !== "admin") {
  document
    .querySelectorAll(
      "[data-admin-only]"
    )
    .forEach(element => {
      element.hidden = true;
    });
}

const dashboardModule =
  document.getElementById(
    "module-dashboard"
  );

const callsModule =
  document.getElementById(
    "module-calls"
  );

const placeholderModule =
  document.getElementById(
    "module-placeholder"
  );

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function hideModules() {
  dashboardModule.classList.remove("active");
  callsModule.classList.remove("active");
  placeholderModule.classList.remove("active");
}

function setActiveNavigation(moduleName) {
  navItems.forEach(item => {
    item.classList.toggle(
      "active",
      item.dataset.module === moduleName
    );
  });
}

function renderFeatureModule(configuration) {
  const featureGrid =
    document.getElementById("featureGrid");

  document.getElementById(
    "placeholderCategory"
  ).textContent =
    configuration.category;

  document.getElementById(
    "placeholderTitle"
  ).textContent =
    configuration.title;

  document.getElementById(
    "placeholderDescription"
  ).textContent =
    configuration.description;

  featureGrid.innerHTML =
    configuration.features
      .map(feature => `
        <article class="feature-card">
          <div class="feature-icon">
            ${escapeHtml(feature.icon)}
          </div>

          <h3>
            ${escapeHtml(feature.title)}
          </h3>

          <p>
            ${escapeHtml(feature.text)}
          </p>

          <span class="feature-status">
            Módulo preparado
          </span>
        </article>
      `)
      .join("");
}

function showModule(moduleName) {
  const configuration =
    modules[moduleName] ||
    modules.dashboard;

  hideModules();
  setActiveNavigation(moduleName);

  document.getElementById(
    "pageTitle"
  ).textContent =
    configuration.title;

  document.getElementById(
    "pageDescription"
  ).textContent =
    configuration.description;

  if (moduleName === "dashboard") {
    dashboardModule.classList.add("active");
    loadDashboard();
  } else if (moduleName === "calls") {
    callsModule.classList.add("active");

    window.CibermedidaCalls?.mount();
  } else {
    placeholderModule.classList.add("active");

    window.CibermedidaModules?.load(
      moduleName,
      configuration
    );
  }

  document.body.classList.remove(
    "sidebar-open"
  );
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

function getStatus(call) {
  return String(
    call.status ||
    call.call_status ||
    call.stream_status ||
    "desconocido"
  );
}

function renderStatus(status) {
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

async function fetchJson(url) {
  const response = await fetch(
    url,
    {
      headers: {
        Accept: "application/json"
      }
    }
  );

  const payload = await response.json();

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

async function loadHealth() {
  const statusElement =
    document.getElementById(
      "serviceStatus"
    );

  const detailElement =
    document.getElementById(
      "serviceDetail"
    );

  const databaseStatus =
    document.getElementById(
      "databaseStatus"
    );

  const databaseDot =
    document.getElementById(
      "databaseDot"
    );

  try {
    const health = await fetchJson(
      "/admin/api/health"
    );

    statusElement.textContent =
      "Operativo";

    detailElement.textContent =
      health.status ||
      health.database ||
      "Servidor disponible";

    databaseStatus.textContent =
      "Operativa";

    databaseDot.className =
      "service-dot green";

    document.getElementById(
      "footerSystemStatus"
    ).textContent =
      "Sistema operativo";
  } catch (error) {
    statusElement.textContent =
      "Sin respuesta";

    detailElement.textContent =
      error.message;

    databaseStatus.textContent =
      "Incidencia";

    databaseDot.className =
      "service-dot red";

    document.getElementById(
      "footerSystemStatus"
    ).textContent =
      "Incidencia detectada";
  }
}

function updateMetrics(metrics) {
  document.getElementById(
    "totalCalls"
  ).textContent =
    String(metrics.totalCalls || 0);

  document.getElementById(
    "completedCalls"
  ).textContent =
    String(metrics.completedCalls || 0);

  document.getElementById(
    "failedCalls"
  ).textContent =
    String(metrics.failedCalls || 0);

  document.getElementById(
    "callsToday"
  ).textContent =
    String(metrics.callsToday || 0);

  document.getElementById(
    "callsThisMonth"
  ).textContent =
    String(metrics.callsThisMonth || 0);

  document.getElementById(
    "averageDuration"
  ).textContent =
    formatDuration(
      metrics.averageDurationSeconds || 0
    );
}

function metricsFromCalls(calls) {
  const now = new Date();
  const durations = calls
    .map(call =>
      Number(call.duration_seconds || 0)
    )
    .filter(duration => duration > 0);

  return {
    totalCalls: calls.length,
    completedCalls:
      calls.filter(call =>
        getStatus(call)
          .toLowerCase()
          .includes("complete")
      ).length,
    failedCalls:
      calls.filter(call => {
        const status =
          getStatus(call).toLowerCase();

        return (
          status.includes("fail") ||
          status.includes("error") ||
          status.includes("cancel") ||
          status.includes("busy") ||
          status.includes("no-answer")
        );
      }).length,
    callsToday:
      calls.filter(call => {
        const date = new Date(
          call.created_at || ""
        );

        return (
          date.getFullYear() ===
            now.getFullYear() &&
          date.getMonth() ===
            now.getMonth() &&
          date.getDate() === now.getDate()
        );
      }).length,
    callsThisMonth:
      calls.filter(call => {
        const date = new Date(
          call.created_at || ""
        );

        return (
          date.getFullYear() ===
            now.getFullYear() &&
          date.getMonth() === now.getMonth()
        );
      }).length,
    averageDurationSeconds:
      durations.length
        ? Math.round(
            durations.reduce(
              (total, duration) =>
                total + duration,
              0
            ) / durations.length
          )
        : 0
  };
}

async function getDashboardData() {
  try {
    return await fetchJson(
      "/admin/api/dashboard"
    );
  } catch (error) {
    const legacyPayload = await fetchJson(
      "/admin/api/calls?limit=100"
    );

    const calls = Array.isArray(
      legacyPayload.calls
    )
      ? legacyPayload.calls
      : [];

    return {
      ok: true,
      metrics: metricsFromCalls(calls),
      calls: calls.slice(0, 8)
    };
  }
}

function renderRecentCalls(calls) {
  const body =
    document.getElementById(
      "recentCallsBody"
    );

  if (!calls.length) {
    body.innerHTML = `
      <tr>
        <td
          colspan="4"
          class="empty-state"
        >
          Todavía no hay llamadas registradas.
        </td>
      </tr>
    `;

    return;
  }

  body.innerHTML =
    calls.slice(0, 8)
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
              call.to_number ||
              call.phone_number ||
              call.to ||
              "—"
            )}
          </td>

          <td>
            ${renderStatus(
              getStatus(call)
            )}
          </td>

          <td>
            ${formatDuration(
              call.duration ||
              call.duration_seconds
            )}
          </td>
        </tr>
      `)
      .join("");
}

async function loadDashboard() {
  await loadHealth();

  try {
    const payload =
      await getDashboardData();

    updateMetrics(payload.metrics || {});
    renderRecentCalls(
      Array.isArray(payload.calls)
        ? payload.calls
        : []
    );
  } catch (error) {
    document.getElementById(
      "recentCallsBody"
    ).innerHTML = `
      <tr>
        <td
          colspan="4"
          class="error-state"
        >
          ${escapeHtml(error.message)}
        </td>
      </tr>
    `;
  }
}

navItems.forEach(item => {
  item.addEventListener(
    "click",
    () => {
      showModule(
        item.dataset.module
      );
    }
  );
});

document.getElementById(
  "menuButton"
)?.addEventListener(
  "click",
  () => {
    document.body.classList.add(
      "sidebar-open"
    );
  }
);

document.getElementById(
  "sidebarClose"
)?.addEventListener(
  "click",
  () => {
    document.body.classList.remove(
      "sidebar-open"
    );
  }
);

document.getElementById(
  "sidebarOverlay"
)?.addEventListener(
  "click",
  () => {
    document.body.classList.remove(
      "sidebar-open"
    );
  }
);

document.getElementById(
  "refreshDashboard"
)?.addEventListener(
  "click",
  loadDashboard
);

loadDashboard();

/* SIDEBAR_DEFINITIVO_CIBERMEDIDA */

const connectionsToggle =
  document.getElementById(
    "connectionsToggle"
  );

const connectionsSubmenu =
  document.getElementById(
    "connectionsSubmenu"
  );

connectionsToggle?.addEventListener(
  "click",
  event => {
    /*
     * El botón también abre el módulo general
     * de conexiones mediante el manejador
     * data-module que ya existe.
     */
    const currentlyOpen =
      connectionsSubmenu.classList.contains(
        "open"
      );

    connectionsSubmenu.classList.toggle(
      "open",
      !currentlyOpen
    );

    connectionsToggle.setAttribute(
      "aria-expanded",
      String(!currentlyOpen)
    );
  }
);
