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
  let bienestarPosts = [];
  let personeroPosts = [];
  let eventos = C ? C.load(C.STORAGE.eventos, C.seedEventos) : [];
  let puestosMap = C ? C.load(C.STORAGE.puestos, {}) : {};
  let likesCounts = {};
  let likesMine = new Set();
  let likeBusy = new Set();
  let perfilesByUid = {};
  let filtro = "todos";
  let filtroBienestar = "todos";
  let filtroPersonero = "todos";
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
    const [y, m, d] = String(iso || "")
      .slice(0, 10)
      .split("-")
      .map(Number);
    if (!y || !m || !d) return "";
    return `${d} de ${MESES[m - 1]} de ${y}`;
  }

  function formatHora(iso) {
    if (!iso) return "";
    const s = String(iso).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("es-CO", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function horaPublicacion(item) {
    return formatHora(item?.createdAt || item?.updatedAt || "");
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
  let activeViewName = null;

  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  function showView(name, opts = {}) {
    const allowScroll = opts.scroll !== false;
    const viewChanged = activeViewName !== name;
    activeViewName = name;

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
    if (name === "bienestar") renderBienestar();
    if (name === "personero") renderPersonero();
    if (name === "agenda") renderAgenda();
    if (name === "puestos") renderPuestos();

    // Solo al cambiar sección por navegación del usuario (no al hidratar Firebase)
    if (allowScroll && viewChanged) {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }

  function currentHash() {
    const h = (location.hash || "#inicio").replace("#", "");
    return ["inicio", "pagos", "comunicados", "bienestar", "personero", "agenda", "puestos", "simbolos"].includes(h)
      ? h
      : "inicio";
  }

  /** Cambia de vista al toque; usa history para no forzar scroll al #id del DOM. */
  function navigateTo(target) {
    if (!target) return;
    showView(target);
    const next = `#${target}`;
    if (location.hash !== next) {
      history.pushState(null, "", next);
    }
  }

  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", (e) => {
      const target = el.getAttribute("data-nav");
      if (!target) return;
      e.preventDefault();
      navigateTo(target);
    });
  });

  window.addEventListener("hashchange", () => showView(currentHash()));
  window.addEventListener("popstate", () => showView(currentHash()));

  /* Comunicados (solo lectura + me gusta) */
  function enrichAutor(autor) {
    if (!autor || typeof autor !== "object") return autor;
    const uid = autor.uid;
    const perfil = uid ? perfilesByUid[uid] : null;
    if (!perfil) {
      const cargo = String(autor.cargo || "").trim();
      const rol =
        autor.cargoLabel ||
        autor.licenciatura ||
        (cargo === "coordinador"
          ? "Coordinador"
          : cargo === "rector"
            ? "Rector"
            : cargo === "secretaria"
              ? "Secretaria"
              : cargo);
      return { ...autor, licenciatura: rol, cargoLabel: rol };
    }
    const cargo = String(perfil.cargo || autor.cargo || "").trim();
    const rol =
      (cargo === "coordinador"
        ? "Coordinador"
        : cargo === "rector"
          ? "Rector"
          : cargo === "secretaria"
            ? "Secretaria"
            : "") ||
      perfil.licenciatura ||
      autor.licenciatura ||
      "";
    return {
      ...autor,
      nombres: autor.nombres || perfil.nombres || "",
      apellidos: autor.apellidos || perfil.apellidos || "",
      nombreCompleto:
        autor.nombreCompleto ||
        [perfil.nombres, perfil.apellidos].filter(Boolean).join(" ") ||
        autor.nombreCompleto,
      cargo,
      cargoLabel: rol,
      licenciatura: rol,
      fotoUrl: perfil.fotoUrl || autor.fotoUrl || "",
    };
  }

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
    const playing = snapshotPlayingMedia(list);
    const items = comunicados
      .filter((c) => filtro === "todos" || c.categoria === filtro)
      .sort(C?.compareNewestFirst || ((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || ""))));

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
            ? C.autorMetaHtml(enrichAutor(c.autor), formatFecha(c.fecha), c.categoria, horaPublicacion(c))
            : `<div class="feed-item__meta">
          <span class="tag tag--${c.categoria}">${c.categoria}</span>
          <time class="feed-item__date" datetime="${c.fecha}"><span class="feed-item__date-day">${formatFecha(c.fecha)}</span>${
              horaPublicacion(c)
                ? `<span class="feed-item__date-time">${escapeHtml(horaPublicacion(c))}</span>`
                : ""
            }</time>
        </div>`
        }
        <h3 class="feed-item__title">${escapeHtml(c.titulo)}</h3>
        <p class="feed-item__body">${escapeHtml(c.mensaje)}</p>
        ${C && C.mediaHtml ? C.mediaHtml(c) : ""}
        ${likeButtonHtml(c.id)}
      </article>`
      )
      .join("");
    restorePlayingMedia(list, playing);
    if (C?.applyMediaOrientation) C.applyMediaOrientation(list);
  }

  function applyLikesState(state) {
    if (!state) return;
    likesCounts = state.counts || {};
    likesMine = state.mine instanceof Set ? state.mine : new Set(state.mine || []);
    // Actualizar botones en sitio (no re-pintar el feed: eso reinicia el video)
    document.querySelectorAll("[data-like]").forEach((btn) => {
      const id = btn.getAttribute("data-like");
      if (!id) return;
      const liked = likesMine.has(id);
      const count = likesCounts[id] || 0;
      btn.classList.toggle("is-liked", liked);
      btn.setAttribute("aria-pressed", liked ? "true" : "false");
      btn.setAttribute("aria-label", liked ? "Quitar me gusta" : "Me gusta");
      const heartEl = btn.querySelector(".like-btn__heart");
      const countEl = btn.querySelector(".like-btn__count");
      if (heartEl) heartEl.textContent = liked ? "♥" : "♡";
      if (countEl) countEl.textContent = String(count);
    });
  }

  function renderBienestar() {
    const list = document.getElementById("lista-bienestar");
    if (!list) return;
    const playing = snapshotPlayingMedia(list);
    const items = bienestarPosts
      .filter((c) => filtroBienestar === "todos" || c.categoria === filtroBienestar)
      .sort(C?.compareNewestFirst || ((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || ""))));

    if (!items.length) {
      list.innerHTML = `<div class="empty">No hay publicaciones de bienestar en esta categoría.</div>`;
      return;
    }

    list.innerHTML = items
      .map(
        (c) => `
      <article class="feed-item" data-id="${c.id}">
        ${
          C && C.autorMetaHtml
            ? C.autorMetaHtml(enrichAutor(c.autor), formatFecha(c.fecha), c.categoria, horaPublicacion(c))
            : `<div class="feed-item__meta">
          <span class="tag tag--${c.categoria}">${c.categoria}</span>
          <time class="feed-item__date" datetime="${c.fecha}"><span class="feed-item__date-day">${formatFecha(c.fecha)}</span>${
              horaPublicacion(c)
                ? `<span class="feed-item__date-time">${escapeHtml(horaPublicacion(c))}</span>`
                : ""
            }</time>
        </div>`
        }
        <h3 class="feed-item__title">${escapeHtml(c.titulo)}</h3>
        <p class="feed-item__body">${escapeHtml(c.mensaje)}</p>
        ${C && C.mediaHtml ? C.mediaHtml(c) : ""}
        ${likeButtonHtml(c.id)}
      </article>`
      )
      .join("");
    restorePlayingMedia(list, playing);
    if (C?.applyMediaOrientation) C.applyMediaOrientation(list);
  }

  function renderPersonero() {
    const list = document.getElementById("lista-personero");
    if (!list) return;
    const playing = snapshotPlayingMedia(list);
    const items = personeroPosts
      .filter((c) => filtroPersonero === "todos" || c.categoria === filtroPersonero)
      .sort(C?.compareNewestFirst || ((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || ""))));

    if (!items.length) {
      list.innerHTML = `<div class="empty">No hay publicaciones de personería en esta categoría.</div>`;
      return;
    }

    list.innerHTML = items
      .map(
        (c) => `
      <article class="feed-item" data-id="${c.id}">
        ${
          C && C.autorMetaHtml
            ? C.autorMetaHtml(enrichAutor(c.autor), formatFecha(c.fecha), c.categoria, horaPublicacion(c))
            : `<div class="feed-item__meta">
          <span class="tag tag--${c.categoria}">${c.categoria}</span>
          <time class="feed-item__date" datetime="${c.fecha}"><span class="feed-item__date-day">${formatFecha(c.fecha)}</span>${
              horaPublicacion(c)
                ? `<span class="feed-item__date-time">${escapeHtml(horaPublicacion(c))}</span>`
                : ""
            }</time>
        </div>`
        }
        <h3 class="feed-item__title">${escapeHtml(c.titulo)}</h3>
        <p class="feed-item__body">${escapeHtml(c.mensaje)}</p>
        ${C && C.mediaHtml ? C.mediaHtml(c) : ""}
        ${likeButtonHtml(c.id)}
      </article>`
      )
      .join("");
    restorePlayingMedia(list, playing);
    if (C?.applyMediaOrientation) C.applyMediaOrientation(list);
  }

  document.querySelectorAll("[data-filter-bienestar]").forEach((btn) => {
    btn.addEventListener("click", () => {
      filtroBienestar = btn.getAttribute("data-filter-bienestar") || "todos";
      document.querySelectorAll("[data-filter-bienestar]").forEach((b) => {
        b.classList.toggle("is-active", b === btn);
      });
      renderBienestar();
    });
  });

  document.querySelectorAll("[data-filter-personero]").forEach((btn) => {
    btn.addEventListener("click", () => {
      filtroPersonero = btn.getAttribute("data-filter-personero") || "todos";
      document.querySelectorAll("[data-filter-personero]").forEach((b) => {
        b.classList.toggle("is-active", b === btn);
      });
      renderPersonero();
    });
  });

  async function handleLikeClick(e) {
    const btn = e.target.closest("[data-like]");
    if (!btn) return;
    e.preventDefault();
    const id = btn.getAttribute("data-like");
    if (!id || likeBusy.has(id)) return;

    const FB = window.InmaculadaFirebase;
    if (!FB?.configured || !FB.toggleLike) return;

    const wasLiked = likesMine.has(id);
    const prevCount = likesCounts[id] || 0;
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
  }

  document.getElementById("lista-comunicados")?.addEventListener("click", handleLikeClick);
  document.getElementById("lista-bienestar")?.addEventListener("click", handleLikeClick);
  document.getElementById("lista-personero")?.addEventListener("click", handleLikeClick);

  /* Video Drive / YouTube: miniatura → reproducir (1 toque) */
  function snapshotPlayingMedia(listEl) {
    const map = new Map();
    if (!listEl) return map;
    listEl.querySelectorAll(".media-embed.is-playing").forEach((el) => {
      const key =
        el.getAttribute("data-drive-id") ||
        el.getAttribute("data-yt-src") ||
        "";
      if (!key) return;
      map.set(key, {
        html: el.innerHTML,
        className: el.className,
        orient: el.dataset.orient || "",
        orientLocked: el.dataset.orientLocked || "",
      });
    });
    return map;
  }

  function restorePlayingMedia(listEl, map) {
    if (!listEl || !map?.size) return;
    listEl.querySelectorAll(".media-embed").forEach((el) => {
      const key =
        el.getAttribute("data-drive-id") ||
        el.getAttribute("data-yt-src") ||
        "";
      const saved = key && map.get(key);
      if (!saved) return;
      el.className = saved.className;
      if (saved.orient) el.dataset.orient = saved.orient;
      if (saved.orientLocked) el.dataset.orientLocked = saved.orientLocked;
      el.innerHTML = saved.html;
      const video = el.querySelector("video.media-drive-video");
      if (video) {
        video.play()?.catch?.(() => {});
      }
    });
  }

  function driveCandidateUrls(id) {
    const keys = [
      ...new Set(
        [
          window.FIREBASE_CONFIG?.apiKey,
          window.FIREBASE_CONFIG?.driveApiKey,
          window.INMALINK_FIREBASE_CONFIG?.apiKey,
        ].filter(Boolean)
      ),
    ];
    return keys.map(
      (key) =>
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&key=${encodeURIComponent(key)}`
    );
  }

  function mountDriveIframeInline(wrap, id) {
    wrap.classList.add("is-playing");
    wrap.innerHTML = `
      <iframe
        class="media-drive-frame"
        src="https://drive.google.com/file/d/${encodeURIComponent(id)}/preview"
        title="Video de Drive"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowfullscreen
        loading="eager"
        referrerpolicy="strict-origin-when-cross-origin"
      ></iframe>
    `;
  }

  function tryDriveNative(wrap, url, posterSrc) {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.className = "media-drive-video";
      video.controls = true;
      video.playsInline = true;
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.preload = "metadata";
      if (posterSrc) video.poster = posterSrc;

      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        video.removeEventListener("loadeddata", onOk);
        video.removeEventListener("canplay", onOk);
        video.removeEventListener("error", onErr);
        if (ok) {
          wrap.classList.add("is-playing");
          wrap.innerHTML = "";
          wrap.appendChild(video);
          video.play()?.catch?.(() => {});
          resolve(true);
        } else {
          video.removeAttribute("src");
          try {
            video.load();
          } catch {
            /* ignore */
          }
          resolve(false);
        }
      };
      const onOk = () => finish(true);
      const onErr = () => finish(false);
      const timer = window.setTimeout(() => finish(false), 1800);

      video.addEventListener("loadeddata", onOk, { once: true });
      video.addEventListener("canplay", onOk, { once: true });
      video.addEventListener("error", onErr, { once: true });
      video.src = url;
      video.load();
    });
  }

  async function probeDriveMediaUrl(url) {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Range: "bytes=0-1" },
      });
      if (!res.ok) return false;
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      return (
        ct.includes("video") ||
        ct.includes("octet-stream") ||
        ct.includes("mp4") ||
        ct.includes("webm")
      );
    } catch {
      return false;
    }
  }

  async function playDriveFromPoster(wrap, id, posterSrc) {
    wrap.classList.add("is-playing");
    wrap.innerHTML = `<div class="media-drive-loading" role="status">Cargando video…</div>`;

    const candidates = driveCandidateUrls(id);
    for (const url of candidates) {
      // eslint-disable-next-line no-await-in-loop
      const usable = await probeDriveMediaUrl(url);
      if (!usable) continue;
      // eslint-disable-next-line no-await-in-loop
      const ok = await tryDriveNative(wrap, url, posterSrc);
      if (ok) return;
    }

    mountDriveIframeInline(wrap, id);
  }

  document.getElementById("main")?.addEventListener("click", (e) => {
    const playBtn = e.target.closest("[data-drive-play]");
    if (!playBtn) return;
    e.preventDefault();
    const wrap = playBtn.closest(".media-embed--drive");
    const id = wrap?.getAttribute("data-drive-id");
    if (!wrap || !id || wrap.classList.contains("is-playing")) return;

    const thumb = wrap.querySelector(".media-drive-poster__img, .media-drive-fail img");
    const posterSrc = thumb?.currentSrc || thumb?.getAttribute("src") || "";
    playDriveFromPoster(wrap, id, posterSrc);
  });

  /* Orientación: cuando carga la miniatura (caché o red) */
  document.getElementById("main")?.addEventListener(
    "load",
    (e) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement)) return;
      if (!img.matches(".media-drive-poster__img, .media-yt-poster__img")) return;
      const wrap = img.closest(".media-embed");
      if (!wrap || wrap.dataset.orientLocked === "1") return;
      if (!img.naturalWidth || !img.naturalHeight) return;
      const orient =
        C?.orientationFromSize?.(img.naturalWidth, img.naturalHeight) ||
        (img.naturalWidth / img.naturalHeight < 0.88
          ? "portrait"
          : img.naturalWidth / img.naturalHeight > 1.12
            ? "landscape"
            : "square");
      if (C?.setMediaOrientation) C.setMediaOrientation(wrap, orient);
      else {
        wrap.classList.remove(
          "media-embed--portrait",
          "media-embed--landscape",
          "media-embed--square"
        );
        wrap.classList.add(`media-embed--${orient}`);
        wrap.dataset.orient = orient;
      }
    },
    true
  );

  document.querySelector("#comunicados .filters")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-filter]");
    if (!btn) return;
    filtro = btn.getAttribute("data-filter");
    document.querySelectorAll("#comunicados .chip").forEach((c) => {
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

    const MEDALLAS = {
      1: { key: "oro", label: "Oro" },
      2: { key: "plata", label: "Plata" },
      3: { key: "bronce", label: "Bronce" },
    };

    const topHtml = data.top
      .map((est, i) => {
        const place = i + 1;
        const medal = MEDALLAS[place] || null;
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
        const medalHtml = medal
          ? `<span class="honor-medal honor-medal--${medal.key}" title="${medal.label}" aria-label="${place}° lugar, medalla de ${medal.label}">
              <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
                <circle cx="32" cy="36" r="20" class="honor-medal__disc"/>
                <circle cx="32" cy="36" r="15" class="honor-medal__ring"/>
                <path class="honor-medal__ribbon" d="M22 8 L32 18 L42 8 L38 28 L26 28 Z"/>
                <text x="32" y="42" text-anchor="middle" class="honor-medal__num">${place}</text>
              </svg>
            </span>`
          : "";
        return `
          <article class="puestos-card puestos-card--${place}">
            <div class="puestos-card__media">
              ${photo}
              ${medalHtml}
            </div>
            <span class="puestos-card__place">${place}° lugar · ${medal ? medal.label : ""}</span>
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

  /* PWA: registro e instalación viven en js/pwa-install.js */

  document.getElementById("btn-cerrar-ios")?.addEventListener("click", () => {
    document.getElementById("modal-ios-install")?.close();
  });

  document.getElementById("btn-cerrar-win")?.addEventListener("click", () => {
    document.getElementById("modal-win-install")?.close();
  });

  document.querySelector("[data-close-modal='modal-android-install']")?.addEventListener("click", () => {
    document.getElementById("modal-android-install")?.close();
  });

  /* Comunicados filters already bound above */

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
    // Pintar la vista al instante sin forzar scroll (Android: el usuario puede estar bajando
    // mientras hidrata Firebase; un scrollTo al final lo subía solo).
    showView(currentHash(), { scroll: false });

    if (C?.ensureAvatarLightbox) C.ensureAvatarLightbox();
    if (C) {
      // Agenda y respaldo estático; comunicados/honor los manda Firestore si está activo
      await C.hydrateFromFile("./data/contenido.json");
      reloadFromStorage();
    }

    async function attachFirebase() {
      const FB = window.InmaculadaFirebase;
      if (!FB?.configured) {
        showView(currentHash(), { scroll: false });
        return;
      }

      try {
        if (FB.whenReady) await FB.whenReady();
      } catch (err) {
        console.error(err);
      }

      // Carga inmediata desde la nube (no solo el listener)
      try {
        const [coms, bienestar, personero, puestos, evs, likes, perfiles] = await Promise.all([
          FB.fetchComunicados(),
          FB.fetchBienestar ? FB.fetchBienestar() : Promise.resolve([]),
          FB.fetchPersonero ? FB.fetchPersonero() : Promise.resolve([]),
          FB.fetchPuestosMap(),
          FB.fetchEventos(),
          FB.fetchLikesState ? FB.fetchLikesState() : Promise.resolve(null),
          FB.fetchPerfilesMap ? FB.fetchPerfilesMap() : Promise.resolve({}),
        ]);
        if (Array.isArray(coms)) {
          comunicados = coms;
          if (C) C.save(C.STORAGE.comunicados, comunicados);
        }
        if (Array.isArray(bienestar)) {
          bienestarPosts = bienestar;
        }
        if (Array.isArray(personero)) {
          personeroPosts = personero;
        }
        if (puestos && typeof puestos === "object") {
          puestosMap = puestos;
          if (C) C.save(C.STORAGE.puestos, puestosMap);
        }
        if (Array.isArray(evs)) {
          eventos = evs;
          if (C) C.save(C.STORAGE.eventos, eventos);
        }
        if (perfiles && typeof perfiles === "object") {
          perfilesByUid = perfiles;
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

      if (FB.watchBienestar) {
        FB.watchBienestar((items) => {
          if (!Array.isArray(items)) return;
          bienestarPosts = items;
          if (currentHash() === "bienestar") renderBienestar();
        });
      }

      if (FB.watchPersonero) {
        FB.watchPersonero((items) => {
          if (!Array.isArray(items)) return;
          personeroPosts = items;
          if (currentHash() === "personero") renderPersonero();
        });
      }

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

      if (FB.watchPerfiles) {
        FB.watchPerfiles((map) => {
          if (!map || typeof map !== "object") return;
          perfilesByUid = map;
          if (currentHash() === "comunicados") renderComunicados();
          if (currentHash() === "bienestar") renderBienestar();
          if (currentHash() === "personero") renderPersonero();
        });
      }

      showView(currentHash(), { scroll: false });
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
      showView(currentHash(), { scroll: false });
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
