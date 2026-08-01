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
    if (path.includes("/bienestar")) return "bienestar";
    if (path.includes("/personero")) return "personero";
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
    bienestar: "Inmaculada Bienestar",
    personero: "Inmaculada Personero",
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
      title: "Ayuda · Inmaculada App",
      lead: "Guía rápida para familias y estudiantes.",
      html: `
        <h3>Cómo moverte</h3>
        <p>Usa el menú superior (computador) o la barra inferior (celular). En Inicio también hay accesos rápidos.</p>
        <ul>
          <li><strong>Inicio:</strong> logo, accesos rápidos, redes y cómo llegar.</li>
          <li><strong>Pagos:</strong> paga con PSE y envía el soporte por WhatsApp.</li>
          <li><strong>Comunicados:</strong> avisos oficiales del colegio (solo lectura).</li>
          <li><strong>Bienestar:</strong> orientación de psicología escolar.</li>
          <li><strong>Personería:</strong> mensajes del gobierno estudiantil.</li>
          <li><strong>Agenda:</strong> eventos del mes en calendario.</li>
          <li><strong>Cuadro de honor:</strong> destacados por salón y período (oro, plata y bronce).</li>
          <li><strong>Símbolos:</strong> bandera, escudo e himno (próximamente).</li>
        </ul>
        <h3>Me gusta</h3>
        <p>En <strong>Comunicados</strong>, <strong>Bienestar</strong> y <strong>Personería</strong> puedes tocar el corazón ♡ para dar me gusta. No necesitas iniciar sesión.</p>
        <h3>Filtros</h3>
        <p>En cada sección de publicaciones puedes filtrar por categoría (urgente, académico, familia, propuestas, etc.).</p>
        <h3>Otros accesos</h3>
        <p>En Inicio también encuentras <strong>Pruebas parciales</strong>, Instagram, Facebook y Google Maps.</p>
        ${installHtml(INSTALL.publica)}
      `,
    },
    admin: {
      title: "Ayuda · Administración",
      lead: "Panel completo del colegio: perfil, comunicados, agenda y honor.",
      html: `
        <h3>Cómo entrar</h3>
        <p>Inicia sesión con la <strong>contraseña de administración</strong> (no usa correo de Firebase).</p>
        <h3>Tu perfil (importante)</h3>
        <p>Antes de publicar, o con el botón <strong>Mi perfil</strong>, completa:</p>
        <ul>
          <li><strong>Nombres</strong> y <strong>apellidos</strong></li>
          <li><strong>Cargo:</strong> Coordinador, Rector o Secretaria</li>
          <li><strong>Foto:</strong> enlace de Drive (Compartir → cualquiera con el enlace → Visor)</li>
        </ul>
        <p>Así aparecerás como autor en los comunicados de la app pública.</p>
        <h3>Qué puedes hacer</h3>
        <ul>
          <li><strong>Comunicados:</strong> crear, editar o eliminar avisos (texto, YouTube, imagen o video de Drive).</li>
          <li><strong>Agenda:</strong> eventos con fecha, hora y descripción.</li>
          <li><strong>Cuadro de honor:</strong> top 3 con foto (medallas oro/plata/bronce) y demás estudiantes con nombre.</li>
          <li><strong>Publicar:</strong> descargar o importar <code>contenido.json</code> como respaldo local.</li>
        </ul>
        <h3>Consejo</h3>
        <p>Usa <strong>Salir</strong> al terminar. Docentes, Bienestar y Personero publican desde sus propias apps (<code>/docentes/</code>, <code>/bienestar/</code>, <code>/personero/</code>).</p>
        ${installHtml(INSTALL.admin)}
      `,
    },
    docentes: {
      title: "Ayuda · Docentes",
      lead: "Publica comunicados y cuadro de honor con tu perfil.",
      html: `
        <h3>Cómo entrar</h3>
        <p>Usa el <strong>correo</strong> y la <strong>contraseña</strong> que te asignó el colegio (creados en Firebase Authentication).</p>
        <h3>Tu perfil (obligatorio la primera vez)</h3>
        <p>Al entrar te pedirá completar el perfil antes de publicar. También puedes editarlo con <strong>Mi perfil</strong>:</p>
        <ul>
          <li><strong>Nombres</strong> y <strong>apellidos</strong></li>
          <li><strong>Licenciatura</strong> (opcional), ej. Lic. en Matemáticas</li>
          <li><strong>Foto:</strong> enlace de Drive (Compartir → cualquiera con el enlace → Visor)</li>
        </ul>
        <p>Así te verán las familias en los comunicados (nombre, cargo/licenciatura y foto).</p>
        <h3>Qué puedes hacer</h3>
        <ul>
          <li><strong>Comunicados:</strong> publicar, editar o eliminar avisos (texto + YouTube o Drive).</li>
          <li><strong>Cuadro de honor:</strong> por salón y período; top 3 con foto y medallas; el resto solo nombres.</li>
        </ul>
        <h3>Consejo</h3>
        <p>Los avisos salen en la sección <strong>Comunicados</strong> de la app pública. Bienestar y Personero tienen sus propios paneles.</p>
        ${installHtml(INSTALL.docentes)}
      `,
    },
    bienestar: {
      title: "Ayuda · Bienestar",
      lead: "Orientación y psicología escolar para la comunidad.",
      html: `
        <h3>Cómo entrar</h3>
        <p>Correo <strong>psicologia@inmaculada.app</strong> y la contraseña creada en Firebase Authentication.</p>
        <h3>Tu perfil (obligatorio la primera vez)</h3>
        <p>Completa <strong>nombres</strong>, <strong>apellidos</strong>, título (ej. Psicóloga escolar) y foto de Drive. Edítalo cuando quieras con <strong>Mi perfil</strong>.</p>
        <h3>Publicaciones</h3>
        <ul>
          <li>Solo puedes <strong>publicar</strong> (crear, editar o eliminar). No hay bandeja de mensajes.</li>
          <li>Categorías: <strong>general</strong>, <strong>familia</strong>, <strong>emocional</strong>, <strong>convivencia</strong>.</li>
          <li>Multimedia opcional: YouTube, imagen o video de Drive.</li>
        </ul>
        <p>Aparecen en la app pública → sección <strong>Bienestar</strong>, donde las familias pueden dar me gusta.</p>
        ${installHtml(INSTALL.bienestar)}
      `,
    },
    personero: {
      title: "Ayuda · Personero",
      lead: "Voz estudiantil y gobierno escolar.",
      html: `
        <h3>Cómo entrar</h3>
        <p>Correo <strong>personero@inmaculada.app</strong> y la contraseña creada en Firebase Authentication.</p>
        <h3>Tu perfil (obligatorio la primera vez)</h3>
        <p>Completa <strong>nombres</strong>, <strong>apellidos</strong>, título (ej. Personero estudiantil) y foto de Drive. Edítalo con <strong>Mi perfil</strong>.</p>
        <h3>Publicaciones</h3>
        <ul>
          <li>Solo puedes <strong>publicar</strong> (crear, editar o eliminar). No hay bandeja de mensajes.</li>
          <li>Categorías: <strong>general</strong>, <strong>propuestas</strong>, <strong>actividades</strong>, <strong>derechos</strong>.</li>
          <li>Multimedia opcional: YouTube, imagen o video de Drive.</li>
        </ul>
        <p>Aparecen en la app pública → sección <strong>Personería</strong>, con me gusta para la comunidad.</p>
        ${installHtml(INSTALL.personero)}
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
          <img src="${img}" alt="" width="96" height="96" />
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
