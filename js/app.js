/* Colegio La Inmaculada — lógica de la app pública (solo lectura de contenidos) */
(() => {
  "use strict";

  const C = window.InmaculadaContent;
  const PSE_URL =
    "https://www.psepagos.co/PSEHostingUI/ShowTicketOffice.aspx?ID=13330";
  const WA_NUMBER = "573216507398";

  const PERIODOS_LABEL = C?.PERIODOS_LABEL || {
    1: "Primer período",
    2: "Segundo período",
    3: "Tercer período",
    4: "Cuarto período",
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

  let comunicados = C
    ? C.load(C.STORAGE.comunicados, C.seedComunicados)
    : [];
  let eventos = C ? C.load(C.STORAGE.eventos, C.seedEventos) : [];
  let puestosMap = C ? C.load(C.STORAGE.puestos, {}) : {};
  let likesCounts = {};
  let likesMine = new Set();
  let likeBusy = new Set();
  let filtro = "todos";
  let mesActual = new Date();
  mesActual.setDate(1);
  let diaSeleccionado = null;

  function reloadFromStorage() {
    if (!C) return;
    comunicados = C.load(C.STORAGE.comunicados, C.seedComunicados);
    eventos = C.load(C.STORAGE.eventos, C.seedEventos);
    puestosMap = C.load(C.STORAGE.puestos, {});
  }

  function formatFecha(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return `${d} de ${MESES[m - 1]} de ${y}`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function uid(prefix) {
    return C ? C.uid(prefix) : `${prefix}_${Date.now()}`;
  }

  function listaSalones() {
    return C ? C.listaSalones() : [];
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
    if (name === "puestos") renderPuestos();

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function currentHash() {
    const h = (location.hash || "#inicio").replace("#", "");
    return ["inicio", "pagos", "comunicados", "agenda", "puestos", "simbolos"].includes(h)
      ? h
      : "inicio";
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

  /* Comunicados (solo lectura + me gusta) */
  function likeButtonHtml(comId) {
    const count = likesCounts[comId] || 0;
    const liked = likesMine.has(comId);
    return `
      <div class="feed-item__actions">
        <button type="button" class="like-btn${liked ? " is-liked" : ""}" data-like="${escapeHtml(comId)}" aria-pressed="${liked ? "true" : "false"}" aria-label="${liked ? "Quitar me gusta" : "Me gusta"}">
          <span class="like-btn__heart" aria-hidden="true">${liked ? "♥" : "♡"}</span>
          <span class="like-btn__count">${count}</span>
        </button>
      </div>`;
  }

  function renderComunicados() {
    const list = document.getElementById("lista-comunicados");
    const items = comunicados
      .filter((c) => filtro === "todos" || c.categoria === filtro)
      .sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")));

    if (!items.length) {
      list.innerHTML = `<div class="empty">No hay comunicados en esta categoría.</div>`;
      return;
    }

    list.innerHTML = items
      .map(
        (c) => `
      <article class="feed-item" data-id="${c.id}">
        ${
          C && C.autorMetaHtml
            ? C.autorMetaHtml(c.autor, formatFecha(c.fecha), c.categoria)
            : `<div class="feed-item__meta">
          <span class="tag tag--${c.categoria}">${c.categoria}</span>
          <time class="feed-item__date" datetime="${c.fecha}">${formatFecha(c.fecha)}</time>
        </div>`
        }
        <h3 class="feed-item__title">${escapeHtml(c.titulo)}</h3>
        <p class="feed-item__body">${escapeHtml(c.mensaje)}</p>
        ${C && C.mediaHtml ? C.mediaHtml(c) : ""}
        ${likeButtonHtml(c.id)}
      </article>`
      )
      .join("");
  }

  function applyLikesState(state) {
    if (!state) return;
    likesCounts = state.counts || {};
    likesMine = state.mine instanceof Set ? state.mine : new Set(state.mine || []);
    if (currentHash() === "comunicados") renderComunicados();
  }

  document.getElementById("lista-comunicados")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-like]");
    if (!btn) return;
    e.preventDefault();
    const id = btn.getAttribute("data-like");
    if (!id || likeBusy.has(id)) return;

    const FB = window.InmaculadaFirebase;
    if (!FB?.configured || !FB.toggleLike) return;

    const wasLiked = likesMine.has(id);
    const prevCount = likesCounts[id] || 0;
    // Optimistic UI
    if (wasLiked) {
      likesMine.delete(id);
      likesCounts[id] = Math.max(0, prevCount - 1);
    } else {
      likesMine.add(id);
      likesCounts[id] = prevCount + 1;
    }
    const countEl = btn.querySelector(".like-btn__count");
    const heartEl = btn.querySelector(".like-btn__heart");
    btn.classList.toggle("is-liked", !wasLiked);
    btn.setAttribute("aria-pressed", !wasLiked ? "true" : "false");
    btn.setAttribute("aria-label", !wasLiked ? "Quitar me gusta" : "Me gusta");
    if (heartEl) heartEl.textContent = !wasLiked ? "♥" : "♡";
    if (countEl) countEl.textContent = String(likesCounts[id] || 0);
    btn.classList.add("is-pulse");
    setTimeout(() => btn.classList.remove("is-pulse"), 280);

    likeBusy.add(id);
    try {
      await FB.toggleLike(id);
    } catch (err) {
      console.error(err);
      // Revert
      if (wasLiked) {
        likesMine.add(id);
        likesCounts[id] = prevCount;
      } else {
        likesMine.delete(id);
        likesCounts[id] = prevCount;
      }
      btn.classList.toggle("is-liked", wasLiked);
      btn.setAttribute("aria-pressed", wasLiked ? "true" : "false");
      btn.setAttribute("aria-label", wasLiked ? "Quitar me gusta" : "Me gusta");
      if (heartEl) heartEl.textContent = wasLiked ? "♥" : "♡";
      if (countEl) countEl.textContent = String(prevCount);
    } finally {
      likeBusy.delete(id);
    }
  });

  document.querySelector(".filters")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-filter]");
    if (!btn) return;
    filtro = btn.getAttribute("data-filter");
    document.querySelectorAll(".chip").forEach((c) => {
      c.classList.toggle("is-active", c === btn);
    });
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
          : "No hay eventos este mes."
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

  /* Cuadro de honor (solo lectura) */
  function puestosKey(salon, periodo) {
    return `${salon}|${periodo}`;
  }

  function fillSalonSelects() {
    const options = listaSalones()
      .map((s) => `<option value="${s}">${s}</option>`)
      .join("");
    const filtroSalon = document.getElementById("filtro-salon");
    if (filtroSalon) {
      filtroSalon.innerHTML = options;
      if (!filtroSalon.value) filtroSalon.value = "7-B";
    }
  }

  function renderPuestos() {
    const board = document.getElementById("puestos-board");
    const salon = document.getElementById("filtro-salon")?.value;
    const periodo = document.getElementById("filtro-periodo")?.value;
    if (!board || !salon || !periodo) return;

    const data = puestosMap[puestosKey(salon, periodo)];
    if (!data || !data.top?.length) {
      board.innerHTML = `
        <div class="empty">
          Aún no hay cuadro de honor publicado para <strong>${escapeHtml(salon)}</strong>
          — ${escapeHtml(PERIODOS_LABEL[periodo] || periodo)}.
        </div>`;
      return;
    }

    const topHtml = data.top
      .map((est, i) => {
        const place = i + 1;
        const rawFoto = est.fotoDrive || est.foto || "";
        let photo = "";
        if (rawFoto && C?.driveImgTag) {
          photo = C.driveImgTag(rawFoto, {
            className: "puestos-card__photo",
            alt: est.nombre || "",
            loading: "lazy",
          });
        } else if (rawFoto) {
          const src =
            C?.resolveDisplayImage?.(rawFoto) ||
            C?.driveImageUrl?.(rawFoto) ||
            rawFoto;
          photo = `<img class="puestos-card__photo" src="${escapeHtml(src)}" alt="${escapeHtml(est.nombre || "")}" loading="lazy" />`;
        }
        if (!photo) {
          photo = `<div class="puestos-card__photo puestos-card__photo--empty" aria-hidden="true">${place}</div>`;
        }
        return `
          <article class="puestos-card puestos-card--${place}">
            ${photo}
            <span class="puestos-card__place">${place}° lugar</span>
            <h3 class="puestos-card__name">${escapeHtml(est.nombre)}</h3>
          </article>`;
      })
      .join("");

    const rest = data.rest || [];
    const restHtml = rest.length
      ? `<ol class="puestos-list">
          ${rest
            .map(
              (est, i) => `
            <li>
              <span class="puestos-list__n">${i + 4}</span>
              <span class="puestos-list__name">${escapeHtml(est.nombre)}</span>
            </li>`
            )
            .join("")}
        </ol>`
      : "";

    board.innerHTML = `
      <p class="puestos-meta">${escapeHtml(salon)} · ${escapeHtml(PERIODOS_LABEL[periodo])}</p>
      <div class="puestos-podium">${topHtml}</div>
      ${restHtml}`;
  }

  document.getElementById("filtro-salon")?.addEventListener("change", renderPuestos);
  document.getElementById("filtro-periodo")?.addEventListener("change", renderPuestos);

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
  fillSalonSelects();

  async function boot() {
    if (C) {
      // Agenda y respaldo estático; comunicados/honor los manda Firestore si está activo
      await C.hydrateFromFile("./data/contenido.json");
      reloadFromStorage();
    }

    async function attachFirebase() {
      const FB = window.InmaculadaFirebase;
      if (!FB?.configured) {
        showView(currentHash());
        return;
      }

      try {
        if (FB.whenReady) await FB.whenReady();
      } catch (err) {
        console.error(err);
      }

      // Carga inmediata desde la nube (no solo el listener)
      try {
        const [coms, puestos, evs, likes] = await Promise.all([
          FB.fetchComunicados(),
          FB.fetchPuestosMap(),
          FB.fetchEventos(),
          FB.fetchLikesState ? FB.fetchLikesState() : Promise.resolve(null),
        ]);
        if (Array.isArray(coms)) {
          comunicados = coms;
          if (C) C.save(C.STORAGE.comunicados, comunicados);
        }
        if (puestos && typeof puestos === "object") {
          puestosMap = puestos;
          if (C) C.save(C.STORAGE.puestos, puestosMap);
        }
        if (Array.isArray(evs)) {
          eventos = evs;
          if (C) C.save(C.STORAGE.eventos, eventos);
        }
        if (likes) applyLikesState(likes);
      } catch (err) {
        console.error("Carga Firestore:", err);
      }

      FB.watchComunicados((items) => {
        if (!Array.isArray(items)) return;
        comunicados = items;
        if (C) C.save(C.STORAGE.comunicados, comunicados);
        if (currentHash() === "comunicados") renderComunicados();
      });

      FB.watchPuestos((map) => {
        if (!map || typeof map !== "object") return;
        puestosMap = map;
        if (C) C.save(C.STORAGE.puestos, puestosMap);
        if (currentHash() === "puestos") renderPuestos();
      });

      FB.watchEventos((items) => {
        if (!Array.isArray(items)) return;
        eventos = items;
        if (C) C.save(C.STORAGE.eventos, eventos);
        if (currentHash() === "agenda") renderAgenda();
      });

      if (FB.watchLikes) {
        FB.watchLikes((state) => applyLikesState(state));
      }

      showView(currentHash());
    }

    if (window.InmaculadaFirebase) {
      await attachFirebase();
    } else {
      window.addEventListener(
        "inmaculada-firebase-ready",
        () => {
          attachFirebase();
        },
        { once: true }
      );
      showView(currentHash());
    }
  }

  window.addEventListener("storage", (e) => {
    if (!e.key || !C) return;
    const keys = Object.values(C.STORAGE);
    if (!keys.includes(e.key)) return;
    reloadFromStorage();
    const view = currentHash();
    if (view === "comunicados") renderComunicados();
    if (view === "agenda") renderAgenda();
    if (view === "puestos") renderPuestos();
  });

  boot();
})();
