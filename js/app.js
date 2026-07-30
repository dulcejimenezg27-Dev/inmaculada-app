/* Colegio La Inmaculada — lógica de la app */
(() => {
  "use strict";

  const PSE_URL =
    "https://www.psepagos.co/PSEHostingUI/ShowTicketOffice.aspx?ID=13330";
  const WA_NUMBER = "573216507398";

  const STORAGE = {
    comunicados: "inmaculada_comunicados",
    eventos: "inmaculada_eventos",
  };

  const MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  const MESES_LABEL = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  const seedComunicados = [
    {
      id: "c1",
      titulo: "Bienvenida al año escolar 2026",
      mensaje:
        "Con alegría damos la bienvenida a toda la comunidad educativa. Juntos formamos en valores y desarrollo humano.",
      categoria: "general",
      fecha: "2026-01-20",
    },
    {
      id: "c2",
      titulo: "Entrega de boletines — Primer período",
      mensaje:
        "La entrega de boletines se realizará en la sede principal. Los horarios por grado serán publicados oportunamente.",
      categoria: "academico",
      fecha: "2026-04-10",
    },
    {
      id: "c3",
      titulo: "Recordatorio: pago de pensión",
      mensaje:
        "Recuerda realizar el pago de pensión a tiempo a través del botón PSE disponible en esta aplicación.",
      categoria: "urgente",
      fecha: "2026-07-15",
    },
  ];

  const seedEventos = [
    {
      id: "e1",
      titulo: "Inicio de clases",
      fecha: "2026-01-27",
      hora: "07:00",
      descripcion: "Bienvenida a estudiantes y familias.",
    },
    {
      id: "e2",
      titulo: "Izada de bandera",
      fecha: "2026-08-07",
      hora: "08:00",
      descripcion: "Acto cívico en el patio principal.",
    },
    {
      id: "e3",
      titulo: "Día de la familia",
      fecha: "2026-09-12",
      hora: "09:00",
      descripcion: "Actividades recreativas y formativas.",
    },
    {
      id: "e4",
      titulo: "Reunión de padres de familia",
      fecha: "2026-07-30",
      hora: "14:00",
      descripcion: "Información académica y convivencia.",
    },
  ];

  let comunicados = load(STORAGE.comunicados, seedComunicados);
  let eventos = load(STORAGE.eventos, seedEventos);
  let filtro = "todos";
  let mesActual = new Date();
  mesActual.setDate(1);
  let diaSeleccionado = null;

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return structuredClone(fallback);
      return JSON.parse(raw);
    } catch {
      return structuredClone(fallback);
    }
  }

  function save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function uid(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function formatFecha(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return `${d} de ${MESES[m - 1]} de ${y}`;
  }

  /* Navegación */
  function showView(name) {
    const views = document.querySelectorAll(".view");
    views.forEach((v) => {
      const active = v.id === name;
      v.classList.toggle("is-active", active);
      v.hidden = !active;
    });

    document.querySelectorAll("[data-nav]").forEach((el) => {
      el.classList.toggle("is-active", el.getAttribute("data-nav") === name);
    });

    if (name === "comunicados") renderComunicados();
    if (name === "agenda") renderAgenda();

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function currentHash() {
    const h = (location.hash || "#inicio").replace("#", "");
    return ["inicio", "pagos", "comunicados", "agenda"].includes(h) ? h : "inicio";
  }

  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", (e) => {
      const target = el.getAttribute("data-nav");
      if (!target) return;
      e.preventDefault();
      if (location.hash !== `#${target}`) {
        location.hash = target;
      } else {
        showView(target);
      }
    });
  });

  window.addEventListener("hashchange", () => showView(currentHash()));

  /* Comunicados */
  function renderComunicados() {
    const list = document.getElementById("lista-comunicados");
    const items = comunicados
      .filter((c) => filtro === "todos" || c.categoria === filtro)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));

    if (!items.length) {
      list.innerHTML = `<div class="empty">No hay comunicados en esta categoría.</div>`;
      return;
    }

    list.innerHTML = items
      .map(
        (c) => `
      <article class="feed-item" data-id="${c.id}">
        <div class="feed-item__meta">
          <span class="tag tag--${c.categoria}">${c.categoria}</span>
          <time class="feed-item__date" datetime="${c.fecha}">${formatFecha(c.fecha)}</time>
        </div>
        <h3 class="feed-item__title">${escapeHtml(c.titulo)}</h3>
        <p class="feed-item__body">${escapeHtml(c.mensaje)}</p>
        <div class="feed-item__actions">
          <button type="button" class="btn-link" data-delete-com="${c.id}">Eliminar</button>
        </div>
      </article>`
      )
      .join("");
  }

  document.querySelector(".filters")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-filter]");
    if (!btn) return;
    filtro = btn.getAttribute("data-filter");
    document.querySelectorAll(".chip").forEach((c) => {
      c.classList.toggle("is-active", c === btn);
    });
    renderComunicados();
  });

  document.getElementById("lista-comunicados")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-delete-com]");
    if (!btn) return;
    const id = btn.getAttribute("data-delete-com");
    if (!confirm("¿Eliminar este comunicado?")) return;
    comunicados = comunicados.filter((c) => c.id !== id);
    save(STORAGE.comunicados, comunicados);
    renderComunicados();
  });

  const modalCom = document.getElementById("modal-comunicado");
  const formCom = document.getElementById("form-comunicado");

  document.getElementById("btn-nuevo-comunicado")?.addEventListener("click", () => {
    formCom.reset();
    modalCom.showModal();
  });

  formCom?.addEventListener("submit", (e) => {
    const submitter = e.submitter;
    if (!submitter || submitter.value === "cancel") return;

    e.preventDefault();
    const data = new FormData(formCom);
    const titulo = String(data.get("titulo") || "").trim();
    const mensaje = String(data.get("mensaje") || "").trim();
    const categoria = String(data.get("categoria") || "general");
    if (!titulo || !mensaje) return;

    const hoy = new Date();
    const fecha = hoy.toISOString().slice(0, 10);

    comunicados.unshift({
      id: uid("c"),
      titulo,
      mensaje,
      categoria,
      fecha,
    });
    save(STORAGE.comunicados, comunicados);
    modalCom.close();
    renderComunicados();
  });

  /* Agenda */
  function eventosDelMes() {
    const y = mesActual.getFullYear();
    const m = mesActual.getMonth();
    return eventos.filter((ev) => {
      const [ey, em] = ev.fecha.split("-").map(Number);
      return ey === y && em === m + 1;
    });
  }

  function diasConEvento() {
    const set = new Set(eventosDelMes().map((e) => e.fecha));
    return set;
  }

  function renderCalendario() {
    const cal = document.getElementById("calendario");
    const label = document.getElementById("agenda-mes-label");
    const y = mesActual.getFullYear();
    const m = mesActual.getMonth();
    label.textContent = `${MESES[m]} ${y}`;

    const first = new Date(y, m, 1);
    let startDow = first.getDay(); // 0=dom
    startDow = startDow === 0 ? 6 : startDow - 1; // lunes primero
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const marked = diasConEvento();
    const todayIso = new Date().toISOString().slice(0, 10);

    let html = DOW.map((d) => `<div class="cal-dow">${d}</div>`).join("");

    for (let i = 0; i < startDow; i++) {
      html += `<button type="button" class="cal-day" disabled aria-hidden="true"></button>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const classes = ["cal-day"];
      if (iso === todayIso) classes.push("is-today");
      if (diaSeleccionado === iso) classes.push("is-selected");
      if (marked.has(iso)) classes.push("has-event");
      html += `<button type="button" class="${classes.join(" ")}" data-day="${iso}" aria-label="${d} de ${MESES[m]}">${d}</button>`;
    }

    cal.innerHTML = html;
  }

  function renderListaEventos() {
    const list = document.getElementById("lista-eventos");
    let items = [...eventos].sort((a, b) => a.fecha.localeCompare(b.fecha));

    if (diaSeleccionado) {
      items = items.filter((e) => e.fecha === diaSeleccionado);
    } else {
      const y = mesActual.getFullYear();
      const m = mesActual.getMonth();
      items = items.filter((e) => {
        const [ey, em] = e.fecha.split("-").map(Number);
        return ey === y && em === m + 1;
      });
    }

    if (!items.length) {
      list.innerHTML = `<div class="empty">${
        diaSeleccionado
          ? "No hay eventos en esta fecha."
          : "No hay eventos este mes. Agrega uno con el botón Nuevo."
      }</div>`;
      return;
    }

    list.innerHTML = items
      .map((ev) => {
        const [, , day] = ev.fecha.split("-");
        const mon = MESES[Number(ev.fecha.slice(5, 7)) - 1].slice(0, 3);
        return `
        <article class="event-item" data-id="${ev.id}">
          <div class="event-item__date" aria-hidden="true">
            <span class="event-item__day">${Number(day)}</span>
            <span class="event-item__mon">${mon}</span>
          </div>
          <div>
            <h3 class="event-item__title">${escapeHtml(ev.titulo)}</h3>
            ${ev.descripcion ? `<p class="event-item__desc">${escapeHtml(ev.descripcion)}</p>` : ""}
            ${ev.hora ? `<span class="event-item__time">${ev.hora}</span>` : ""}
          </div>
          <button type="button" class="btn-link" data-delete-ev="${ev.id}">Eliminar</button>
        </article>`;
      })
      .join("");
  }

  function renderAgenda() {
    renderCalendario();
    renderListaEventos();
  }

  document.getElementById("btn-mes-prev")?.addEventListener("click", () => {
    mesActual.setMonth(mesActual.getMonth() - 1);
    diaSeleccionado = null;
    renderAgenda();
  });

  document.getElementById("btn-mes-next")?.addEventListener("click", () => {
    mesActual.setMonth(mesActual.getMonth() + 1);
    diaSeleccionado = null;
    renderAgenda();
  });

  document.getElementById("calendario")?.addEventListener("click", (e) => {
    const day = e.target.closest("[data-day]");
    if (!day) return;
    const iso = day.getAttribute("data-day");
    diaSeleccionado = diaSeleccionado === iso ? null : iso;
    renderAgenda();
  });

  document.getElementById("lista-eventos")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-delete-ev]");
    if (!btn) return;
    const id = btn.getAttribute("data-delete-ev");
    if (!confirm("¿Eliminar este evento?")) return;
    eventos = eventos.filter((ev) => ev.id !== id);
    save(STORAGE.eventos, eventos);
    renderAgenda();
  });

  const modalEv = document.getElementById("modal-evento");
  const formEv = document.getElementById("form-evento");

  document.getElementById("btn-nuevo-evento")?.addEventListener("click", () => {
    formEv.reset();
    const dateInput = formEv.querySelector('[name="fecha"]');
    if (dateInput) {
      dateInput.value = diaSeleccionado || new Date().toISOString().slice(0, 10);
    }
    modalEv.showModal();
  });

  formEv?.addEventListener("submit", (e) => {
    const submitter = e.submitter;
    if (!submitter || submitter.value === "cancel") return;

    e.preventDefault();
    const data = new FormData(formEv);
    const titulo = String(data.get("titulo") || "").trim();
    const fecha = String(data.get("fecha") || "");
    const hora = String(data.get("hora") || "");
    const descripcion = String(data.get("descripcion") || "").trim();
    if (!titulo || !fecha) return;

    eventos.push({
      id: uid("e"),
      titulo,
      fecha,
      hora,
      descripcion,
    });
    save(STORAGE.eventos, eventos);

    const [y, m] = fecha.split("-").map(Number);
    mesActual = new Date(y, m - 1, 1);
    diaSeleccionado = fecha;
    modalEv.close();
    renderAgenda();
  });

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* PWA */
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => reg.update().catch(() => {}))
      .catch(() => {});
  }

  /* Instalación PWA: Android / Windows / iPhone */
  const INSTALL_DISMISS_KEY = "inmaculada_install_dismissed";
  const INSTALL_DONE_KEY = "inmaculada_app_installed";
  let deferredPrompt = null;

  const ua = navigator.userAgent || "";
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isWindows = /Windows/i.test(ua) || /Win64|Win32|Win10|Win11/i.test(ua);
  const isDesktopChrome =
    /Chrome|Edg|Chromium/i.test(ua) && !/Mobile/i.test(ua);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    window.navigator.standalone === true;
  const isFileProtocol = location.protocol === "file:";

  const installBar = document.getElementById("install-bar");
  const btnInstall = document.getElementById("btn-install-app");
  const btnInstallClose = document.getElementById("btn-install-close");
  const installLabel = document.getElementById("install-bar-label");
  const modalIos = document.getElementById("modal-ios-install");
  const modalWin = document.getElementById("modal-win-install");

  function wasDismissed() {
    return sessionStorage.getItem(INSTALL_DISMISS_KEY) === "1";
  }

  function wasInstalled() {
    return localStorage.getItem(INSTALL_DONE_KEY) === "1";
  }

  function markInstalled() {
    localStorage.setItem(INSTALL_DONE_KEY, "1");
    deferredPrompt = null;
    hideInstallBar();
  }

  function shouldOfferInstall() {
    if (isStandalone || wasInstalled() || wasDismissed()) return false;
    return isIos || isAndroid || isWindows || isDesktopChrome;
  }

  function showInstallBar() {
    if (!installBar || !shouldOfferInstall()) return;
    if (isIos && installLabel) installLabel.textContent = "Cómo instalar";
    else if (installLabel) installLabel.textContent = "Instalar App";
    installBar.hidden = false;
    document.body.classList.add("has-install-bar");
  }

  function hideInstallBar() {
    if (!installBar) return;
    installBar.hidden = true;
    document.body.classList.remove("has-install-bar");
  }

  function openWinInstallHelp() {
    const note = document.getElementById("win-install-note");
    if (note) {
      note.textContent = isFileProtocol
        ? "Estás abriendo el archivo directo. Para poder instalar, abre la app con un servidor local (http://localhost) en Chrome o Edge."
        : "Si no ves la opción, recarga con Ctrl+Shift+R y vuelve a intentarlo.";
    }
    modalWin?.showModal();
  }

  // Si ya corre como app instalada, guardar y no mostrar el flotante
  if (isStandalone) {
    localStorage.setItem(INSTALL_DONE_KEY, "1");
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    // Si ya está marcada como instalada, no ofrecer de nuevo
    if (wasInstalled() || isStandalone) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    deferredPrompt = e;
    showInstallBar();
  });

  window.addEventListener("appinstalled", () => {
    markInstalled();
  });

  btnInstall?.addEventListener("click", async () => {
    if (isIos) {
      modalIos?.showModal();
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      try {
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") markInstalled();
      } catch {
        /* ignore */
      }
      deferredPrompt = null;
      return;
    }

    openWinInstallHelp();
  });

  btnInstallClose?.addEventListener("click", () => {
    sessionStorage.setItem(INSTALL_DISMISS_KEY, "1");
    hideInstallBar();
  });

  document.getElementById("btn-cerrar-ios")?.addEventListener("click", () => {
    modalIos?.close();
  });

  document.getElementById("btn-cerrar-win")?.addEventListener("click", () => {
    modalWin?.close();
  });

  if (shouldOfferInstall()) showInstallBar();
  else hideInstallBar();

  /* Soporte de pago por WhatsApp */
  function fillMesPagoSelect() {
    const select = document.getElementById("select-mes-pago");
    if (!select) return;
    const year = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    MESES_LABEL.forEach((label, i) => {
      const opt = document.createElement("option");
      opt.value = `${label} ${year}`;
      opt.textContent = `${label} ${year}`;
      if (i === currentMonth) opt.selected = true;
      select.appendChild(opt);
    });
    // Extra opciones útiles
    const extras = ["Matrícula", "Otros derechos académicos"];
    extras.forEach((ex) => {
      const opt = document.createElement("option");
      opt.value = ex;
      opt.textContent = ex;
      select.appendChild(opt);
    });
  }

  function formatGradoGrupo(grado, grupo) {
    const preescolar = ["Prejardín", "Jardín", "Transición"];
    if (preescolar.includes(grado)) return `${grado}-${grupo}`;
    return `${grado}-${grupo}`;
  }

  function buildWaMessage({ nombre, documento, grado, mes }) {
    return (
      `¡Hola! 👋😉\n` +
      `Envío el *soporte de pago* del Colegio La Inmaculada 🏫✨\n\n` +
      `👤 *Estudiante:* ${nombre}\n` +
      `🪪 *Documento:* ${documento}\n` +
      `📚 *Grado:* ${grado}\n` +
      `📅 *Concepto / mes:* ${mes}\n\n` +
      `Adjunto el comprobante de pago. ¡Gracias! 🙏💚😉`
    );
  }

  document.getElementById("form-soporte")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const nombre = String(data.get("nombre") || "").trim();
    const documento = String(data.get("documento") || "").trim();
    const gradoRaw = String(data.get("grado") || "").trim();
    const grupo = String(data.get("grupo") || "").trim();
    const mes = String(data.get("mes") || "").trim();

    [form.nombre, form.documento, form.grado, form.grupo, form.mes].forEach((el) =>
      el.classList.remove("is-invalid")
    );

    let ok = true;
    if (!nombre) {
      form.nombre.classList.add("is-invalid");
      ok = false;
    }
    if (!documento) {
      form.documento.classList.add("is-invalid");
      ok = false;
    }
    if (!gradoRaw) {
      form.grado.classList.add("is-invalid");
      ok = false;
    }
    if (!grupo) {
      form.grupo.classList.add("is-invalid");
      ok = false;
    }
    if (!mes) {
      form.mes.classList.add("is-invalid");
      ok = false;
    }
    if (!ok) return;

    const grado = formatGradoGrupo(gradoRaw, grupo);
    const text = buildWaMessage({ nombre, documento, grado, mes });
    const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  });

  /* Init */
  const pseBtn = document.getElementById("btn-pse");
  if (pseBtn) pseBtn.href = PSE_URL;

  fillMesPagoSelect();
  showView(currentHash());
})();
