(() => {
  "use strict";

  const C = window.InmaculadaContent || null;
  const CFG = window.ADMIN_CONFIG || {
    password: "Inmaculada2026Admin",
    sessionKey: "inmaculada_admin_session",
  };
  let FB = window.InmaculadaFirebase || null;

  const MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];

  let comunicados = C ? C.load(C.STORAGE.comunicados, C.seedComunicados) : [];
  let eventos = C ? C.load(C.STORAGE.eventos, C.seedEventos) : [];
  let puestosMap = C ? C.load(C.STORAGE.puestos, {}) : {};
  const fotoCache = { 1: "", 2: "", 3: "" };

  function isLoggedIn() {
    return sessionStorage.getItem(CFG.sessionKey) === "1";
  }

  async function persistLocal() {
    if (!C) return;
    C.save(C.STORAGE.comunicados, comunicados);
    C.save(C.STORAGE.eventos, eventos);
    C.save(C.STORAGE.puestos, puestosMap);
    C.save(C.STORAGE.meta, { updatedAt: new Date().toISOString() });
  }

  async function persist() {
    await persistLocal();
  }

  /** Firestore solo acepta escritura con Auth (docentes). Admin guarda local + export. */
  async function tryCloudWrite(fn) {
    if (!FB?.configured || !FB.auth?.currentUser) return false;
    try {
      await fn();
      return true;
    } catch (err) {
      console.warn(err);
      return false;
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatFecha(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return `${d} de ${MESES[m - 1]} de ${y}`;
  }

  function applyRoleUI() {
    const roleLabel = document.getElementById("admin-role-label");
    const emailLabel = document.getElementById("admin-user-email");
    if (roleLabel) roleLabel.textContent = "Inmaculada Admin";
    if (emailLabel) emailLabel.textContent = "Colegio La Inmaculada";
  }

  async function loadCloudData() {
    FB = window.InmaculadaFirebase || FB;
    if (!FB?.configured) return;
    try {
      const [coms, puestos] = await Promise.all([
        FB.fetchComunicados(),
        FB.fetchPuestosMap(),
      ]);
      if (Array.isArray(coms)) comunicados = coms;
      if (puestos && typeof puestos === "object") puestosMap = puestos;
      await persistLocal();
    } catch (err) {
      console.error(err);
    }
  }

  async function showApp(logged) {
    const login = document.getElementById("login-screen");
    const app = document.getElementById("admin-app");
    if (login) {
      login.hidden = !!logged;
      login.style.display = logged ? "none" : "";
    }
    if (app) {
      app.hidden = !logged;
      app.style.display = logged ? "block" : "none";
    }
    if (logged) {
      applyRoleUI();
      await loadCloudData();
      try {
        fillSalones();
        renderComunicados();
        renderEventos();
        renderHonor();
      } catch (err) {
        console.error(err);
      }
    }
  }

  document.getElementById("btn-toggle-password")?.addEventListener("click", () => {
    const input = document.getElementById("login-password");
    const btn = document.getElementById("btn-toggle-password");
    if (!input || !btn) return;
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    btn.textContent = showing ? "Ver" : "Ocultar";
    btn.setAttribute("aria-label", showing ? "Mostrar contraseña" : "Ocultar contraseña");
    btn.setAttribute("aria-pressed", showing ? "false" : "true");
  });

  document.getElementById("form-login")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const pass = String(document.getElementById("login-password")?.value || "");
    const err = document.getElementById("login-error");
    if (pass === CFG.password) {
      sessionStorage.setItem(CFG.sessionKey, "1");
      if (err) err.hidden = true;
      showApp(true);
    } else {
      if (err) {
        err.hidden = false;
        err.textContent = "Contraseña incorrecta";
      }
    }
  });

  document.getElementById("btn-logout")?.addEventListener("click", () => {
    sessionStorage.removeItem(CFG.sessionKey);
    showApp(false);
  });

  function bindFirebaseReady() {
    FB = window.InmaculadaFirebase || null;
    if (isLoggedIn()) loadCloudData().then(() => {
      renderComunicados();
      renderHonor();
    });
  }

  if (window.InmaculadaFirebase) bindFirebaseReady();
  else window.addEventListener("inmaculada-firebase-ready", bindFirebaseReady);

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-close-modal]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const id = btn.getAttribute("data-close-modal");
    const modal = document.getElementById(id);
    if (modal?.open) modal.close();
  });

  document.querySelectorAll("dialog.modal").forEach((dialog) => {
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.close();
    });
  });

  /* Tabs */
  document.querySelectorAll(".admin-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const name = tab.getAttribute("data-tab");
      document.querySelectorAll(".admin-tab").forEach((t) => {
        t.classList.toggle("is-active", t === tab);
      });
      document.querySelectorAll(".admin-panel").forEach((p) => {
        p.hidden = p.id !== `tab-${name}`;
        p.classList.toggle("is-active", p.id === `tab-${name}`);
      });
    });
  });

  /* Comunicados */
  function renderComunicados() {
    const list = document.getElementById("admin-lista-com");
    if (!list) return;
    const items = [...comunicados].sort((a, b) => b.fecha.localeCompare(a.fecha));
    if (!items.length) {
      list.innerHTML = `<div class="empty">No hay comunicados.</div>`;
      return;
    }
    list.innerHTML = items
      .map((c) => {
        const badges = [];
        if (c.videoYoutube) badges.push("YouTube");
        if (c.videoDrive) badges.push("Video Drive");
        if (c.imagenDrive) badges.push("Imagen Drive");
        return `
      <article class="admin-item">
        <div class="admin-item__meta">
          <span class="tag tag--${c.categoria}">${c.categoria}</span>
          <time>${formatFecha(c.fecha)}</time>
          ${badges.map((b) => `<span class="tag tag--general">${b}</span>`).join("")}
        </div>
        <h3>${escapeHtml(c.titulo)}</h3>
        <p>${escapeHtml(c.mensaje)}</p>
        <div class="admin-item__actions">
          <button type="button" class="btn btn--ghost btn--sm" data-edit-com="${c.id}">Editar</button>
          <button type="button" class="btn-danger" data-del-com="${c.id}">Eliminar</button>
        </div>
      </article>`;
      })
      .join("");
  }

  document.getElementById("btn-nuevo-com")?.addEventListener("click", () => {
    const form = document.getElementById("form-com");
    form.reset();
    form.id.value = "";
    document.getElementById("modal-com-title").textContent = "Nuevo comunicado";
    document.getElementById("modal-com").showModal();
  });

  document.getElementById("admin-lista-com")?.addEventListener("click", (e) => {
    const edit = e.target.closest("[data-edit-com]");
    const del = e.target.closest("[data-del-com]");
    if (edit) {
      const item = comunicados.find((c) => c.id === edit.getAttribute("data-edit-com"));
      if (!item) return;
      const form = document.getElementById("form-com");
      form.id.value = item.id;
      form.titulo.value = item.titulo;
      form.categoria.value = item.categoria;
      form.mensaje.value = item.mensaje;
      form.videoYoutube.value = item.videoYoutube || "";
      form.videoDrive.value = item.videoDrive || "";
      form.imagenDrive.value = item.imagenDrive || "";
      document.getElementById("modal-com-title").textContent = "Editar comunicado";
      document.getElementById("modal-com").showModal();
    }
    if (del) {
      const id = del.getAttribute("data-del-com");
      if (!confirm("¿Eliminar este comunicado?")) return;
      comunicados = comunicados.filter((c) => c.id !== id);
      persistLocal();
      tryCloudWrite(() => FB.removeComunicado(id));
      renderComunicados();
    }
  });

  document.getElementById("form-com")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const id = form.id.value;
    const titulo = form.titulo.value.trim();
    const mensaje = form.mensaje.value.trim();
    const categoria = form.categoria.value;
    const videoYoutube = form.videoYoutube.value.trim();
    const videoDrive = form.videoDrive.value.trim();
    const imagenDrive = form.imagenDrive.value.trim();
    if (!titulo || !mensaje) return;

    let item;
    if (id) {
      item = comunicados.find((c) => c.id === id);
      if (item) {
        item.titulo = titulo;
        item.mensaje = mensaje;
        item.categoria = categoria;
        item.videoYoutube = videoYoutube;
        item.videoDrive = videoDrive;
        item.imagenDrive = imagenDrive;
        item.updatedAt = new Date().toISOString();
        item.updatedBy = "admin";
      }
    } else {
      item = {
        id: C ? C.uid("c") : `c_${Date.now()}`,
        titulo,
        mensaje,
        categoria,
        videoYoutube,
        videoDrive,
        imagenDrive,
        fecha: new Date().toISOString().slice(0, 10),
        createdBy: "admin",
        updatedAt: new Date().toISOString(),
      };
      comunicados.unshift(item);
    }

    await persistLocal();
    await tryCloudWrite(() => FB.saveComunicado(item));
    document.getElementById("modal-com").close();
    renderComunicados();
  });

  /* Agenda */
  function renderEventos() {
    const list = document.getElementById("admin-lista-ev");
    if (!list) return;
    const items = [...eventos].sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (!items.length) {
      list.innerHTML = `<div class="empty">No hay eventos.</div>`;
      return;
    }
    list.innerHTML = items
      .map(
        (ev) => `
      <article class="admin-item">
        <div class="admin-item__meta">
          <time>${formatFecha(ev.fecha)}</time>
          ${ev.hora ? `<span>${ev.hora}</span>` : ""}
        </div>
        <h3>${escapeHtml(ev.titulo)}</h3>
        ${ev.descripcion ? `<p>${escapeHtml(ev.descripcion)}</p>` : ""}
        <div class="admin-item__actions">
          <button type="button" class="btn btn--ghost btn--sm" data-edit-ev="${ev.id}">Editar</button>
          <button type="button" class="btn-danger" data-del-ev="${ev.id}">Eliminar</button>
        </div>
      </article>`
      )
      .join("");
  }

  document.getElementById("btn-nuevo-ev")?.addEventListener("click", () => {
    const form = document.getElementById("form-ev");
    form.reset();
    form.id.value = "";
    form.fecha.value = new Date().toISOString().slice(0, 10);
    document.getElementById("modal-ev-title").textContent = "Nuevo evento";
    document.getElementById("modal-ev").showModal();
  });

  document.getElementById("admin-lista-ev")?.addEventListener("click", (e) => {
    const edit = e.target.closest("[data-edit-ev]");
    const del = e.target.closest("[data-del-ev]");
    if (edit) {
      const item = eventos.find((ev) => ev.id === edit.getAttribute("data-edit-ev"));
      if (!item) return;
      const form = document.getElementById("form-ev");
      form.id.value = item.id;
      form.titulo.value = item.titulo;
      form.fecha.value = item.fecha;
      form.hora.value = item.hora || "";
      form.descripcion.value = item.descripcion || "";
      document.getElementById("modal-ev-title").textContent = "Editar evento";
      document.getElementById("modal-ev").showModal();
    }
    if (del) {
      const id = del.getAttribute("data-del-ev");
      if (!confirm("¿Eliminar este evento?")) return;
      eventos = eventos.filter((ev) => ev.id !== id);
      persist();
      renderEventos();
    }
  });

  document.getElementById("form-ev")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const id = form.id.value;
    const titulo = form.titulo.value.trim();
    const fecha = form.fecha.value;
    const hora = form.hora.value;
    const descripcion = form.descripcion.value.trim();
    if (!titulo || !fecha) return;

    if (id) {
      const item = eventos.find((ev) => ev.id === id);
      if (item) {
        item.titulo = titulo;
        item.fecha = fecha;
        item.hora = hora;
        item.descripcion = descripcion;
      }
    } else {
      eventos.push({ id: C ? C.uid("e") : `e_${Date.now()}`, titulo, fecha, hora, descripcion });
    }
    persist();
    document.getElementById("modal-ev").close();
    renderEventos();
  });

  /* Cuadro de honor */
  function puestosKey(salon, periodo) {
    return `${salon}|${periodo}`;
  }

  function fillSalones() {
    if (!C) return;
    const opts = C.listaSalones()
      .map((s) => `<option value="${s}">${s}</option>`)
      .join("");
    const a = document.getElementById("admin-filtro-salon");
    const b = document.getElementById("form-honor-salon");
    if (a) {
      a.innerHTML = opts;
      a.value = "7-B";
    }
    if (b) b.innerHTML = opts;
  }

  function renderHonor() {
    const board = document.getElementById("admin-honor-board");
    const salon = document.getElementById("admin-filtro-salon")?.value;
    const periodo = document.getElementById("admin-filtro-periodo")?.value;
    if (!board || !salon || !periodo) return;
    const data = puestosMap[puestosKey(salon, periodo)];
    if (!data) {
      board.innerHTML = `<div class="empty">Sin publicación para este salón y período.</div>`;
      return;
    }
    const lines = [
      ...(data.top || []).map((est, i) => ({ ...est, n: i + 1 })),
      ...(data.rest || []).map((est, i) => ({ ...est, n: i + 4 })),
    ];
    board.innerHTML =
      lines
        .map(
          (est) => `
      <div class="honor-line">
        <span class="honor-n">${est.n}°</span>
        ${est.foto ? `<img src="${resolveHonorFoto(est.foto)}" alt="" />` : ""}
        <span>${escapeHtml(est.nombre)}</span>
      </div>`
        )
        .join("") +
      `<div class="admin-item__actions" style="margin-top:0.85rem">
        <button type="button" class="btn btn--ghost btn--sm" id="btn-edit-honor">Editar</button>
        <button type="button" class="btn-danger" id="btn-del-honor">Eliminar</button>
      </div>`;
  }

  document.getElementById("admin-filtro-salon")?.addEventListener("change", renderHonor);
  document.getElementById("admin-filtro-periodo")?.addEventListener("change", renderHonor);

  function compressImage(file, maxSize = 420, quality = 0.72) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("read"));
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = () => reject(new Error("img"));
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function buildHonorTopFields() {
    const wrap = document.getElementById("honor-top-fields");
    wrap.innerHTML = [1, 2, 3]
      .map(
        (n) => `
      <div class="top-row" data-puesto="${n}">
        <span class="medal medal--${n}">${n}°</span>
        <div class="top-body">
          <input type="text" name="nombre${n}" required maxlength="120" placeholder="Nombre y apellidos" />
          <input type="url" name="fotoDrive${n}" placeholder="Link de foto en Drive (opcional)" />
          <label class="photo-pick">
            <input type="file" name="foto${n}" accept="image/*" />
            <span>O subir foto</span>
            <img alt="" hidden />
          </label>
        </div>
      </div>`
      )
      .join("");
  }

  function addRestRow(nombre = "") {
    const wrap = document.getElementById("honor-rest-fields");
    const n = wrap.children.length + 4;
    const row = document.createElement("div");
    row.className = "rest-row";
    row.innerHTML = `
      <span>${n}°</span>
      <input type="text" name="rest[]" maxlength="120" placeholder="Nombre y apellidos" value="${escapeHtml(nombre)}" />
      <button type="button" class="btn-danger" data-remove>Quitar</button>`;
    wrap.appendChild(row);
    renumberRest();
  }

  function renumberRest() {
    document.querySelectorAll("#honor-rest-fields .rest-row").forEach((row, i) => {
      row.querySelector("span").textContent = `${i + 4}°`;
    });
  }

  function isDataFoto(url) {
    return String(url || "").startsWith("data:");
  }

  function resolveHonorFoto(url) {
    if (!url) return "";
    if (isDataFoto(url)) return url;
    if (C?.driveImageUrl) {
      const drive = C.driveImageUrl(url);
      if (drive) return drive;
    }
    return url;
  }

  function openHonorModal(edit) {
    const salon = document.getElementById("admin-filtro-salon")?.value;
    const periodo = document.getElementById("admin-filtro-periodo")?.value;
    const existing = edit ? puestosMap[puestosKey(salon, periodo)] : null;
    const form = document.getElementById("form-honor");
    form.reset();
    fotoCache[1] = fotoCache[2] = fotoCache[3] = "";
    buildHonorTopFields();
    document.getElementById("honor-rest-fields").innerHTML = "";

    const salonSel = document.getElementById("form-honor-salon");
    if (salonSel && salon) salonSel.value = salon;
    form.periodo.value = periodo || "1";

    if (existing) {
      (existing.top || []).forEach((est, i) => {
        const n = i + 1;
        form[`nombre${n}`].value = est.nombre || "";
        const foto = est.foto || "";
        if (foto && !isDataFoto(foto)) {
          form[`fotoDrive${n}`].value = est.fotoDrive || foto;
          const preview = resolveHonorFoto(foto);
          const img = form.querySelector(`[data-puesto="${n}"] img`);
          if (img && preview) {
            img.src = preview;
            img.hidden = false;
          }
        } else if (foto) {
          fotoCache[n] = foto;
          const img = form.querySelector(`[data-puesto="${n}"] img`);
          if (img) {
            img.src = foto;
            img.hidden = false;
          }
        }
      });
      (existing.rest || []).forEach((est) => addRestRow(est.nombre || ""));
    } else {
      addRestRow();
      addRestRow();
    }
    document.getElementById("modal-honor").showModal();
  }

  document.getElementById("btn-nuevo-honor")?.addEventListener("click", () => openHonorModal(true));

  document.getElementById("admin-honor-board")?.addEventListener("click", (e) => {
    if (e.target.closest("#btn-edit-honor")) openHonorModal(true);
    if (e.target.closest("#btn-del-honor")) {
      const salon = document.getElementById("admin-filtro-salon")?.value;
      const periodo = document.getElementById("admin-filtro-periodo")?.value;
      if (!confirm("¿Eliminar este cuadro de honor?")) return;
      delete puestosMap[puestosKey(salon, periodo)];
      persistLocal();
      tryCloudWrite(() => FB.removePuestosEntry(salon, periodo));
      renderHonor();
    }
  });

  document.getElementById("btn-add-rest")?.addEventListener("click", () => addRestRow());

  document.getElementById("honor-rest-fields")?.addEventListener("click", (e) => {
    if (!e.target.closest("[data-remove]")) return;
    e.target.closest(".rest-row")?.remove();
    renumberRest();
  });

  document.getElementById("honor-top-fields")?.addEventListener("change", async (e) => {
    const driveInput = e.target.closest('input[name^="fotoDrive"]');
    if (driveInput) {
      const field = driveInput.closest("[data-puesto]");
      const preview = resolveHonorFoto(driveInput.value.trim());
      const img = field?.querySelector("img");
      if (img && preview) {
        img.src = preview;
        img.hidden = false;
        const n = Number(field.getAttribute("data-puesto"));
        fotoCache[n] = "";
      }
      return;
    }

    const input = e.target.closest('input[type="file"]');
    if (!input?.files?.[0]) return;
    const field = input.closest("[data-puesto]");
    const n = Number(field?.getAttribute("data-puesto"));
    try {
      const dataUrl = await compressImage(input.files[0]);
      fotoCache[n] = dataUrl;
      const driveField = field.querySelector(`input[name="fotoDrive${n}"]`);
      if (driveField) driveField.value = "";
      const img = field.querySelector("img");
      if (img) {
        img.src = dataUrl;
        img.hidden = false;
      }
    } catch {
      alert("No se pudo procesar la foto.");
    }
  });

  document.getElementById("form-honor")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const salon = form.salon.value;
    const periodo = form.periodo.value;
    const n1 = form.nombre1.value.trim();
    const n2 = form.nombre2.value.trim();
    const n3 = form.nombre3.value.trim();
    if (!salon || !periodo || !n1 || !n2 || !n3) {
      alert("Completa salón, período y los tres primeros lugares.");
      return;
    }
    const rest = [...form.querySelectorAll('input[name="rest[]"]')]
      .map((el) => el.value.trim())
      .filter(Boolean)
      .map((nombre) => ({ nombre }));

    function fotoDePuesto(n) {
      const driveLink = String(form[`fotoDrive${n}`]?.value || "").trim();
      if (driveLink) {
        return {
          foto: resolveHonorFoto(driveLink) || driveLink,
          fotoDrive: driveLink,
        };
      }
      return { foto: fotoCache[n] || "", fotoDrive: "" };
    }

    const f1 = fotoDePuesto(1);
    const f2 = fotoDePuesto(2);
    const f3 = fotoDePuesto(3);

    puestosMap[puestosKey(salon, periodo)] = {
      salon,
      periodo,
      top: [
        { nombre: n1, ...f1 },
        { nombre: n2, ...f2 },
        { nombre: n3, ...f3 },
      ],
      rest,
      updatedAt: new Date().toISOString(),
      updatedBy: "admin",
    };

    const entry = puestosMap[puestosKey(salon, periodo)];

    try {
      await persistLocal();
      await tryCloudWrite(() => FB.savePuestosEntry(entry));
    } catch {
      alert("No se pudo guardar. Prueba con fotos más livianas o usa link de Drive.");
      return;
    }

    document.getElementById("admin-filtro-salon").value = salon;
    document.getElementById("admin-filtro-periodo").value = periodo;
    document.getElementById("modal-honor").close();
    renderHonor();
  });

  /* Publicar */
  document.getElementById("btn-exportar")?.addEventListener("click", () => {
    if (!C) {
      alert("No se pudo cargar el módulo de datos.");
      return;
    }
    C.downloadBundle("contenido.json");
    document.getElementById("publish-status").textContent =
      "Archivo descargado. Reemplaza data/contenido.json en el proyecto o hosting.";
  });

  document.getElementById("input-import")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!C) {
      alert("No se pudo cargar el módulo de datos.");
      return;
    }
    try {
      const text = await file.text();
      const bundle = JSON.parse(text);
      if (!C.applyBundle(bundle)) throw new Error("invalid");
      comunicados = C.load(C.STORAGE.comunicados, []);
      eventos = C.load(C.STORAGE.eventos, []);
      puestosMap = C.load(C.STORAGE.puestos, {});
      renderComunicados();
      renderEventos();
      renderHonor();
      document.getElementById("publish-status").textContent = "Contenido importado correctamente.";
    } catch {
      alert("No se pudo importar el archivo JSON.");
    }
    e.target.value = "";
  });

  // Init: sesión local (contraseña)
  showApp(isLoggedIn());

  /* PWA instalación */
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  const INSTALL_DISMISS_KEY = "inmaculada_admin_install_dismissed";
  const INSTALL_DONE_KEY = "inmaculada_admin_installed";
  let deferredPrompt = null;

  const ua = navigator.userAgent || "";
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isWindows = /Windows/i.test(ua) || /Win64|Win32/i.test(ua);
  const isDesktopChrome = /Chrome|Edg|Chromium/i.test(ua) && !/Mobile/i.test(ua);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true;

  const installBar = document.getElementById("install-bar");
  const btnInstall = document.getElementById("btn-install-app");
  const installLabel = document.getElementById("install-bar-label");

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
    else if (installLabel) installLabel.textContent = "Instalar Admin";
    installBar.hidden = false;
  }
  function hideInstallBar() {
    if (!installBar) return;
    installBar.hidden = true;
  }

  if (isStandalone) localStorage.setItem(INSTALL_DONE_KEY, "1");

  window.addEventListener("beforeinstallprompt", (e) => {
    if (wasInstalled() || isStandalone) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    deferredPrompt = e;
    showInstallBar();
  });

  window.addEventListener("appinstalled", () => markInstalled());

  btnInstall?.addEventListener("click", async () => {
    if (isIos) {
      document.getElementById("modal-ios-install")?.showModal();
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
    document.getElementById("modal-win-install")?.showModal();
  });

  document.getElementById("btn-install-close")?.addEventListener("click", () => {
    sessionStorage.setItem(INSTALL_DISMISS_KEY, "1");
    hideInstallBar();
  });

  if (shouldOfferInstall()) showInstallBar();
  else hideInstallBar();
})();
