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
          <li>Toca <strong>Ver más</strong>.</li>
          <li>Elige <strong>Agregar a Inicio</strong>.</li>
          <li>Confirma con <strong>Agregar</strong> y listo. Quedará como <strong>${appName}</strong>.</li>
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
          <li><strong>Inicio:</strong> logo, accesos rápidos, redes, <strong>InmaLink</strong> y cómo llegar.</li>
          <li><strong>Pagos:</strong> paga con PSE y envía el soporte por WhatsApp.</li>
          <li><strong>Comunicados:</strong> avisos oficiales del colegio (solo lectura).</li>
          <li><strong>Bienestar:</strong> orientación de psicología escolar.</li>
          <li><strong>Personería:</strong> mensajes del gobierno estudiantil.</li>
          <li><strong>Agenda:</strong> eventos del mes en calendario.</li>
          <li><strong>Cuadro de honor:</strong> destacados por salón y período (oro, plata y bronce).</li>
          <li><strong>Símbolos:</strong> bandera, escudo e himno (próximamente).</li>
        </ul>
        <h3 class="ayuda-brand-title">
          <img src="image/InmaLinkLogo-fab.png" alt="" class="ayuda-inline-logo" width="28" height="28" decoding="async" />
          <span>InmaLink</span>
        </h3>
        <p>
          <strong>InmaLink</strong> es la red social de la comunidad educativa (estudiantes, docentes, padres/madres y directivos).
          Entras desde Inicio con el botón circular del logo, debajo de las redes.
        </p>
        <ul>
          <li>Inicias sesión con tu <strong>cuenta de Google</strong>.</li>
          <li>Creas tu perfil (nombre, rol, datos del colegio y foto opcional con enlace de Drive).</li>
          <li>Puedes <strong>publicar</strong>, dar me gusta / no me gusta y comentar.</li>
          <li>También puedes <strong>editar tu perfil</strong> después (nombre, foto y datos del rol).</li>
          <li>El mal uso puede causar <strong>bloqueo definitivo</strong>: cuida el respeto.</li>
          <li>Con <strong>Volver a la App</strong> regresas aquí sin cerrar la sesión de InmaLink.</li>
        </ul>
        <h3>Me gusta</h3>
        <p>En <strong>Comunicados</strong>, <strong>Bienestar</strong> y <strong>Personería</strong> puedes tocar el corazón ♡ para dar me gusta. No necesitas iniciar sesión. En InmaLink los me gusta sí requieren cuenta de Google.</p>
        <h3>Filtros</h3>
        <p>En cada sección de publicaciones puedes filtrar por categoría (urgente, académico, familia, propuestas, etc.). En los comentarios de InmaLink también puedes filtrar por rol, usuario o grado.</p>
        <h3>Otros accesos</h3>
        <p>En Inicio también encuentras <strong>Pruebas parciales</strong>, Instagram, Facebook, el <strong>canal de WhatsApp</strong> del colegio, el botón de <strong>InmaLink</strong> y Google Maps.</p>
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

  function enableFabDrag(btn, onTap) {
    const storageKey = `inmaculada_ayuda_fab_pos_${detectApp()}`;
    const THRESHOLD = 28;
    let active = false;
    let dragged = false;
    let startX = 0;
    let startY = 0;
    let originLeft = 0;
    let originTop = 0;
    let startTime = 0;
    let openLock = false;

    function openHelp() {
      if (openLock) return;
      openLock = true;
      try {
        onTap();
      } finally {
        setTimeout(() => {
          openLock = false;
        }, 450);
      }
    }

    function clamp(left, top) {
      const margin = 8;
      const maxLeft = Math.max(margin, window.innerWidth - btn.offsetWidth - margin);
      const maxTop = Math.max(margin, window.innerHeight - btn.offsetHeight - margin);
      return {
        left: Math.min(maxLeft, Math.max(margin, left)),
        top: Math.min(maxTop, Math.max(margin, top)),
      };
    }

    function applyPos(left, top) {
      const pos = clamp(left, top);
      btn.style.left = `${pos.left}px`;
      btn.style.top = `${pos.top}px`;
      btn.style.right = "auto";
      btn.style.bottom = "auto";
      btn.classList.add("ayuda-fab--moved");
      return pos;
    }

    function restorePos() {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (typeof data.left === "number" && typeof data.top === "number") {
          applyPos(data.left, data.top);
        }
      } catch {
        /* ignore */
      }
    }

    function savePos() {
      const left = parseFloat(btn.style.left);
      const top = parseFloat(btn.style.top);
      if (!Number.isFinite(left) || !Number.isFinite(top)) return;
      try {
        localStorage.setItem(storageKey, JSON.stringify({ left, top }));
      } catch {
        /* ignore */
      }
    }

    btn.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      active = true;
      dragged = false;
      startTime = Date.now();
      const rect = btn.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      originLeft = rect.left;
      originTop = rect.top;
      try {
        btn.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    });

    btn.addEventListener("pointermove", (e) => {
      if (!active) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!dragged && Math.hypot(dx, dy) < THRESHOLD) return;
      dragged = true;
      btn.classList.add("is-dragging");
      applyPos(originLeft + dx, originTop + dy);
    });

    function endPointer(e) {
      if (!active) return;
      active = false;
      btn.classList.remove("is-dragging");
      try {
        if (e?.pointerId != null) btn.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      const dx = (e?.clientX ?? startX) - startX;
      const dy = (e?.clientY ?? startY) - startY;
      const dist = Math.hypot(dx, dy);
      const elapsed = Date.now() - startTime;

      // Toque corto = no es arrastre, aunque haya temblor
      if (elapsed < 280 && dist < 40) {
        dragged = false;
      }

      if (dragged) {
        applyPos(originLeft + dx, originTop + dy);
        savePos();
        return;
      }
      // Abrir aquí y también en click (por si el navegador omite uno en la zona baja)
      openHelp();
    }

    btn.addEventListener("pointerup", endPointer);
    btn.addEventListener("pointercancel", (e) => {
      // Si el sistema cancela el gesto, aún intentar abrir si no hubo arrastre
      endPointer(e);
    });

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (dragged) {
        dragged = false;
        return;
      }
      openHelp();
    });

    restorePos();
    window.addEventListener("resize", () => {
      if (!btn.classList.contains("ayuda-fab--moved")) return;
      const left = parseFloat(btn.style.left);
      const top = parseFloat(btn.style.top);
      if (Number.isFinite(left) && Number.isFinite(top)) applyPos(left, top);
    });
  }

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
    btn.setAttribute("title", "Mantén pulsado y arrastra para mover");
    btn.innerHTML = `<img src="${img}" alt="" width="72" height="72" />`;

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

    const panel = dialog.querySelector(".ayuda-panel");

    const scrollAyudaToTop = () => {
      if (panel) panel.scrollTop = 0;
      dialog.scrollTop = 0;
    };

    const openAyuda = () => {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      scrollAyudaToTop();
      // iPhone a veces enfoca el botón de abajo y deja el scroll abajo
      requestAnimationFrame(() => {
        scrollAyudaToTop();
        try {
          dialog.focus({ preventScroll: true });
        } catch {
          try {
            dialog.focus();
          } catch {
            /* ignore */
          }
        }
        scrollAyudaToTop();
      });
      setTimeout(scrollAyudaToTop, 40);
      setTimeout(scrollAyudaToTop, 120);
    };

    enableFabDrag(btn, openAyuda);

    dialog.setAttribute("tabindex", "-1");
    dialog.addEventListener("close", scrollAyudaToTop);

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
