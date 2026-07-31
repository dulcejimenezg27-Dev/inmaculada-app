/**
 * Ayuda de navegación — solo la guía de la app actual.
 */
(() => {
  "use strict";

  function detectApp() {
    const fromBody = document.body?.getAttribute("data-ayuda-app");
    if (fromBody) return fromBody;
    const path = (location.pathname || "").toLowerCase();
    if (path.includes("/admin")) return "admin";
    if (path.includes("/docentes")) return "docentes";
    return "publica";
  }

  function imageSrc() {
    const custom = document.body?.getAttribute("data-ayuda-img");
    if (custom) return custom;
    return detectApp() === "publica" ? "image/ayudas.jpeg" : "../image/ayudas.jpeg";
  }

  const INSTALL = {
    publica: "Inmaculada App",
    admin: "Inmaculada Admin",
    docentes: "Inmaculada Docentes",
  };

  function installHtml(appName) {
    return `
        <h3>Instalar en Android</h3>
        <ol>
          <li>Abre la página en <strong>Chrome</strong>.</li>
          <li>Toca el botón <strong>Instalar App</strong> (arriba) o el menú <strong>⋮</strong>.</li>
          <li>Elige <strong>Instalar aplicación</strong> / <strong>Añadir a la pantalla de inicio</strong>.</li>
          <li>Confirma con <strong>Instalar</strong>. Quedará como <strong>${appName}</strong>.</li>
        </ol>
        <h3>Instalar en iPhone</h3>
        <ol>
          <li>Abre la página en <strong>Safari</strong> (no en Chrome ni Instagram).</li>
          <li>Toca <strong>Compartir</strong> (cuadrado con flecha ↑).</li>
          <li>Elige <strong>Añadir a pantalla de inicio</strong>.</li>
          <li>Confirma con <strong>Añadir</strong>. Quedará como <strong>${appName}</strong>.</li>
        </ol>
      `;
  }

  const CONTENT = {
    publica: {
      title: "Ayuda · App pública",
      lead: "Guía rápida para familias y estudiantes.",
      html: `
        <h3>Cómo moverte</h3>
        <p>Usa el menú superior (computador) o la barra inferior (celular).</p>
        <ul>
          <li><strong>Inicio:</strong> logo, accesos rápidos, redes y cómo llegar.</li>
          <li><strong>Pagos:</strong> paga con PSE y envía el soporte por WhatsApp.</li>
          <li><strong>Comunicados:</strong> avisos oficiales del colegio (solo lectura).</li>
          <li><strong>Agenda:</strong> eventos escolares del mes.</li>
          <li><strong>Cuadro de honor:</strong> destacados por salón y período.</li>
          <li><strong>Símbolos:</strong> bandera, escudo e himno (próximamente).</li>
        </ul>
        <h3>Accesos rápidos</h3>
        <p>En Inicio también encuentras Pruebas parciales, Instagram, Facebook y Google Maps.</p>
        ${installHtml(INSTALL.publica)}
      `,
    },
    admin: {
      title: "Ayuda · Administración",
      lead: "Guía del panel completo del colegio.",
      html: `
        <h3>Cómo entrar</h3>
        <p>Inicia sesión con la contraseña de administración.</p>
        <ul>
          <li><strong>Comunicados:</strong> crear, editar o eliminar avisos.</li>
          <li><strong>Agenda:</strong> gestionar eventos (fecha, hora y descripción).</li>
          <li><strong>Cuadro de honor:</strong> publicar top 3 con foto y el resto con nombres.</li>
          <li><strong>Publicar:</strong> descargar o importar <code>contenido.json</code> como respaldo.</li>
        </ul>
        <h3>Consejo</h3>
        <p>Usa <strong>Salir</strong> al terminar. Los docentes publican desde su propia app.</p>
        ${installHtml(INSTALL.admin)}
      `,
    },
    docentes: {
      title: "Ayuda · Docentes",
      lead: "Guía para publicar comunicados y cuadro de honor.",
      html: `
        <h3>Cómo entrar</h3>
        <p>Usa el <strong>correo</strong> y la <strong>contraseña</strong> que te asignó el colegio (creados en Firebase).</p>
        <h3>Qué puedes hacer</h3>
        <ul>
          <li><strong>Comunicados:</strong> publicar avisos (texto y enlaces de YouTube o Drive).</li>
          <li><strong>Cuadro de honor:</strong> publicar por salón y período.</li>
        </ul>
        ${installHtml(INSTALL.docentes)}
      `,
    },
  };

  function build() {
    const app = detectApp();
    const img = imageSrc();
    const info = CONTENT[app] || CONTENT.publica;
    document.body.classList.add(`ayuda-fab--${app}`);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ayuda-fab";
    btn.id = "btn-ayuda-nav";
    btn.setAttribute("aria-label", "Ayuda de navegación");
    btn.innerHTML = `<img src="${img}" alt="" width="56" height="56" />`;

    const dialog = document.createElement("dialog");
    dialog.className = "modal modal--ayuda";
    dialog.id = "modal-ayuda-nav";
    dialog.innerHTML = `
      <div class="ayuda-panel">
        <div class="ayuda-panel__head">
          <img src="${img}" alt="" width="48" height="48" />
          <div>
            <h2>${info.title}</h2>
            <p>${info.lead}</p>
          </div>
        </div>
        <div class="ayuda-section">
          ${info.html}
        </div>
        <div class="ayuda-panel__actions">
          <button type="button" class="btn" data-ayuda-close>Entendido</button>
        </div>
      </div>
    `;

    document.body.appendChild(btn);
    document.body.appendChild(dialog);

    btn.addEventListener("click", () => {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    });

    dialog.querySelector("[data-ayuda-close]")?.addEventListener("click", () => {
      if (dialog.open) dialog.close();
      else dialog.removeAttribute("open");
    });

    dialog.addEventListener("click", (e) => {
      if (e.target === dialog && dialog.open) dialog.close();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
