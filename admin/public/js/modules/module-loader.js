"use strict";

(() => {
  const cache = new Map();

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function getModuleHtml(moduleName) {
    if (cache.has(moduleName)) {
      return cache.get(moduleName);
    }

    const response = await fetch(
      `/admin/module/${encodeURIComponent(
        moduleName
      )}`,
      {
        headers: {
          Accept: "text/html"
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `No se pudo cargar el módulo (${response.status})`
      );
    }

    const html = await response.text();

    cache.set(moduleName, html);

    return html;
  }

  async function load(
    moduleName,
    configuration = {}
  ) {
    const host =
      document.getElementById(
        "dynamicModuleHost"
      );

    if (!host) {
      return;
    }

    host.innerHTML = `
      <article class="glass-card module-loading">
        Cargando módulo...
      </article>
    `;

    try {
      host.innerHTML =
        await getModuleHtml(moduleName);
    } catch (error) {
      host.innerHTML = `
        <article class="glass-card module-error">
          <h2>
            ${escapeHtml(
              configuration.title ||
              "Módulo"
            )}
          </h2>

          <p>
            ${escapeHtml(error.message)}
          </p>
        </article>
      `;
    }
  }

  window.CibermedidaModules = {
    load,
    clearCache() {
      cache.clear();
    }
  };
})();
