(() => {
  "use strict";

  const C = window.InmaculadaContent || null;
  let FB = window.InmaculadaFirebase || null;
  let currentUser = null;
  let isFullAdmin = false;

  const MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];

  let comunicados = C ? C.load(C.STORAGE.comunicados, C.seedComunicados) : [];
  let eventos = C ? C.load(C.STORAGE.eventos, C.seedEventos) : [];
  let puestosMap = C ? C.load(C.STORAGE.puestos, {}) : {};
  let currentPerfil = null;
  let perfilObligatorio = false;
  let likesCounts = {};
  let likesWatchBound = false;
  const fotoCache = { 1: "", 2: "", 3: "" };

  function authErrorMessage(code, fallback) {
    const map = {
      "auth/invalid-email": "Correo no válido",
      "auth/user-disabled": "Usuario deshabilitado",
      "auth/user-not-found": "Usuario no encontrado",
      "auth/wrong-password": "Contraseña incorrecta",
      "auth/invalid-credential": "Correo o contraseña incorrectos",
      "auth/too-many-requests": "Demasiados intentos. Espera un momento",
      "auth/network-request-failed": "Sin conexión a Internet",
    };
    return map[code] || fallback || "No se pudo iniciar sesión";
  }

  function showLoginError(message) {
    const err = document.getElementById("login-error");
    if (!err) return;
    err.hidden = false;
    err.textContent = message;
  }

  function clearLoginError() {
    const err = document.getElementById("login-error");
    if (err) err.hidden = true;
  }

  async function ensureAuthorized(user) {
    if (!user) return false;
    if (!FB?.requireApproval) return true;
    const ok = await FB.isDocenteAuthorized(user.email);
    if (ok) return true;
    try {
      await FB.signOut();
    } catch {
      /* ignore */
    }
    showLoginError(
      "Tu cuenta está pendiente de autorización. Cuando te autoricen podrás entrar."
    );
    return false;
  }

  async function persistLocal() {
    if (!C) return;
    C.save(C.STORAGE.comunicados, comunicados);
    C.save(C.STORAGE.eventos, eventos);
    C.save(C.STORAGE.puestos, puestosMap);
    C.save(C.STORAGE.meta, { updatedAt: new Date().toISOString() });
  }

  async function persistComunicados() {
    await persistLocal();
    if (!FB?.configured) return;
    // Firestore ya se actualiza por operación individual
  }

  async function persist() {
    await persistLocal();
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
    const nombre =
      currentPerfil &&
      [currentPerfil.nombres, currentPerfil.apellidos].filter(Boolean).join(" ").trim();
    if (roleLabel) roleLabel.textContent = nombre || "Inmaculada Docentes";
    if (emailLabel) {
      emailLabel.textContent = currentPerfil?.licenciatura
        ? currentPerfil.licenciatura
        : currentUser?.email || "Colegio La Inmaculada";
    }
  }

  function hasPerfil() {
    return !!(FB?.perfilCompleto ? FB.perfilCompleto(currentPerfil) : false);
  }

  function autorSnapshot() {
    if (FB?.buildAutorFromPerfil) {
      return FB.buildAutorFromPerfil(currentPerfil, currentUser);
    }
    return {
      uid: currentUser?.uid || "",
      email: currentUser?.email || "",
      nombres: currentPerfil?.nombres || "",
      apellidos: currentPerfil?.apellidos || "",
      nombreCompleto: "Docente",
      licenciatura: "",
      fotoUrl: "",
    };
  }

  function updatePerfilPreview() {
    const form = document.getElementById("form-perfil");
    const wrap = document.getElementById("perfil-preview");
    const img = document.getElementById("perfil-preview-img");
    const fallback = document.getElementById("perfil-preview-fallback");
    if (!form || !wrap || !img || !fallback) return;
    const nombres = form.nombres.value.trim();
    const apellidos = form.apellidos.value.trim();
    const nombre = [nombres, apellidos].filter(Boolean).join(" ") || "?";
    const candidates = C?.driveImageCandidates
      ? C.driveImageCandidates(form.fotoUrl.value)
      : C?.resolveFotoUrl
        ? [C.resolveFotoUrl(form.fotoUrl.value)].filter(Boolean)
        : [];
    const initials = C?.inicialesNombre ? C.inicialesNombre(nombre) : "?";
    wrap.hidden = false;
    if (candidates.length) {
      let i = 0;
      img.hidden = false;
      fallback.hidden = true;
      img.onload = () => {
        img.hidden = false;
        fallback.hidden = true;
      };
      img.onerror = () => {
        i += 1;
        if (i < candidates.length) {
          img.src = candidates[i];
          return;
        }
        img.hidden = true;
        fallback.hidden = false;
        fallback.textContent = initials;
      };
      img.src = candidates[0];
    } else {
      img.hidden = true;
      img.removeAttribute("src");
      fallback.hidden = false;
      fallback.textContent = initials;
    }
  }

  function openPerfilModal({ required = false } = {}) {
    const modal = document.getElementById("modal-perfil");
    const form = document.getElementById("form-perfil");
    const title = document.getElementById("modal-perfil-title");
    const lead = document.getElementById("perfil-lead");
    const cancel = document.getElementById("btn-perfil-cancelar");
    const err = document.getElementById("perfil-error");
    if (!modal || !form) return;
    perfilObligatorio = !!required;
    if (err) err.hidden = true;
    form.nombres.value = currentPerfil?.nombres || "";
    form.apellidos.value = currentPerfil?.apellidos || "";
    form.licenciatura.value = currentPerfil?.licenciatura || "";
    form.fotoUrl.value = currentPerfil?.fotoUrl || "";
    if (title) {
      title.textContent = hasPerfil() ? "Editar perfil" : "Crea tu perfil";
    }
    if (lead) {
      lead.textContent = required
        ? "Antes de publicar, completa tu nombre. Así te verán en los comunicados."
        : "Así aparecerás en los comunicados que publiques.";
    }
    if (cancel) cancel.hidden = !!required;
    updatePerfilPreview();
    if (!modal.open) modal.showModal();
  }

  async function loadPerfilForUser(user) {
    if (!user || !FB?.fetchPerfil) {
      currentPerfil = null;
      return null;
    }
    try {
      currentPerfil = await FB.fetchPerfil(user.uid);
    } catch (err) {
      console.error(err);
      currentPerfil = null;
    }
    return currentPerfil;
  }

  function setLoginBusy(busy) {
    const btn = document.getElementById("btn-login-submit");
    const email = document.getElementById("login-email");
    const pass = document.getElementById("login-password");
    if (btn) {
      btn.disabled = !!busy;
      btn.textContent = busy ? "Entrando…" : "Entrar";
      btn.setAttribute("aria-busy", busy ? "true" : "false");
    }
    if (email) email.disabled = !!busy;
    if (pass) pass.disabled = !!busy;
  }

  const PENDING_COMS_KEY = "inmaculada_pending_comunicados";
  const PENDING_DEL_COMS_KEY = "inmaculada_pending_del_comunicados";

  function loadPendingComs() {
    try {
      return JSON.parse(localStorage.getItem(PENDING_COMS_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function savePendingComs(list) {
    localStorage.setItem(PENDING_COMS_KEY, JSON.stringify(list || []));
  }

  function loadPendingDelComs() {
    try {
      return JSON.parse(localStorage.getItem(PENDING_DEL_COMS_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function savePendingDelComs(list) {
    localStorage.setItem(PENDING_DEL_COMS_KEY, JSON.stringify(list || []));
  }

  function queuePendingCom(item) {
    const list = loadPendingComs().filter((c) => c.id !== item.id);
    list.push(item);
    savePendingComs(list);
  }

  function queuePendingDelCom(id) {
    const dels = new Set(loadPendingDelComs());
    dels.add(id);
    savePendingDelComs([...dels]);
    savePendingComs(loadPendingComs().filter((c) => c.id !== id));
  }

  async function flushPendingComs() {
    if (!FB?.configured || !FB.auth?.currentUser) return;
    const pending = loadPendingComs();
    const dels = loadPendingDelComs();
    for (const id of dels) {
      try {
        await FB.removeComunicado(id);
      } catch (err) {
        console.error("Pendiente eliminar:", err);
        return;
      }
    }
    savePendingDelComs([]);
    for (const item of pending) {
      try {
        await FB.saveComunicado(item);
      } catch (err) {
        console.error("Pendiente guardar:", err);
        return;
      }
    }
    savePendingComs([]);
  }

  async function loadCloudData() {
    if (!FB?.configured) return;
    try {
      await flushPendingComs();
      const [coms, puestos] = await Promise.all([
        FB.fetchComunicados(),
        FB.fetchPuestosMap(),
      ]);
      if (Array.isArray(coms)) {
        const pending = loadPendingComs();
        if (pending.length) {
          const map = new Map(coms.map((c) => [c.id, c]));
          pending.forEach((p) => map.set(p.id, p));
          comunicados = [...map.values()].sort((a, b) =>
            String(b.fecha || "").localeCompare(String(a.fecha || ""))
          );
        } else {
          comunicados = coms;
        }
      }
      if (puestos && typeof puestos === "object") puestosMap = puestos;
      await persistLocal();
      if (FB.watchLikes && !likesWatchBound) {
        likesWatchBound = true;
        FB.watchLikes((state) => {
          likesCounts = state?.counts || {};
          renderComunicados();
        });
      } else if (!likesWatchBound && FB.fetchLikesState) {
        const state = await FB.fetchLikesState();
        likesCounts = state?.counts || {};
      }
    } catch (err) {
      console.error(err);
      // Mantener datos locales si la nube falla
    }
  }

  function showApp(logged) {
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
      setLoginBusy(false);
      applyRoleUI();
      try {
        fillSalones();
        renderComunicados();
        renderHonor();
      } catch (err) {
        console.error(err);
      }
    }
  }

  async function enterAs(user) {
    if (!user) {
      currentUser = null;
      currentPerfil = null;
      isFullAdmin = false;
      perfilObligatorio = false;
      setLoginBusy(false);
      showApp(false);
      return;
    }
    FB = window.InmaculadaFirebase || FB;
    const ok = await ensureAuthorized(user);
    if (!ok) {
      currentUser = null;
      currentPerfil = null;
      isFullAdmin = false;
      setLoginBusy(false);
      showApp(false);
      return;
    }
    currentUser = user;
    isFullAdmin = !!(user && FB.isAdminEmail(user.email));
    clearLoginError();
    await loadPerfilForUser(user);
    applyRoleUI();
    showApp(true);
    if (!hasPerfil()) {
      openPerfilModal({ required: true });
    }
    loadCloudData().then(() => {
      renderComunicados();
      renderHonor();
    });
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

  document.getElementById("form-login")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    FB = window.InmaculadaFirebase || FB;
    const email = String(document.getElementById("login-email")?.value || "").trim();
    const pass = String(document.getElementById("login-password")?.value || "").trim();

    if (!FB?.configured) {
      showLoginError("El acceso aún no está disponible. Intenta más tarde.");
      return;
    }

    clearLoginError();
    setLoginBusy(true);
    try {
      if (FB.whenReady) await FB.whenReady();
      const cred = await FB.signIn(email, pass);
      await enterAs(cred.user);
    } catch (ex) {
      setLoginBusy(false);
      showLoginError(authErrorMessage(ex.code, ex.message));
    }
  });

  document.getElementById("btn-logout")?.addEventListener("click", async () => {
    try {
      if (FB?.configured) await FB.signOut();
    } catch {
      /* ignore */
    }
    currentUser = null;
    currentPerfil = null;
    isFullAdmin = false;
    perfilObligatorio = false;
    setLoginBusy(false);
    showApp(false);
  });

  document.getElementById("btn-mi-perfil")?.addEventListener("click", () => {
    openPerfilModal({ required: false });
  });

  document.getElementById("form-perfil")?.addEventListener("input", updatePerfilPreview);

  document.getElementById("form-perfil")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    FB = window.InmaculadaFirebase || FB;
    const form = e.currentTarget;
    const btn = document.getElementById("btn-perfil-guardar");
    const err = document.getElementById("perfil-error");
    if (!FB?.auth?.currentUser) {
      if (err) {
        err.hidden = false;
        err.textContent = "Tu sesión no está activa. Vuelve a entrar.";
      }
      return;
    }
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Guardando…";
    }
    if (err) err.hidden = true;
    try {
      currentPerfil = await FB.savePerfil({
        nombres: form.nombres.value,
        apellidos: form.apellidos.value,
        licenciatura: form.licenciatura.value,
        fotoUrl: form.fotoUrl.value,
      });
      perfilObligatorio = false;
      applyRoleUI();
      document.getElementById("modal-perfil")?.close();
    } catch (ex) {
      console.error(ex);
      if (err) {
        err.hidden = false;
        err.textContent = ex.message || "No se pudo guardar el perfil";
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Guardar perfil";
      }
    }
  });

  function bindAuth() {
    FB = window.InmaculadaFirebase || null;
    if (!FB) return;

    if (!FB.configured) {
      showLoginError("El acceso aún no está disponible. Intenta más tarde.");
      return;
    }

    FB.onAuth(async (user) => {
      // Solo restaurar sesión automática (p. ej. al refrescar).
      // El login manual ya llama enterAs.
      if (user && currentUser?.uid === user.uid) return;
      if (!user && !currentUser) {
        showApp(false);
        return;
      }
      await enterAs(user);
    });
  }

  if (window.InmaculadaFirebase) bindAuth();
  else window.addEventListener("inmaculada-firebase-ready", bindAuth);

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-close-modal]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const id = btn.getAttribute("data-close-modal");
    if (id === "modal-perfil" && perfilObligatorio && !hasPerfil()) return;
    const modal = document.getElementById(id);
    if (modal?.open) modal.close();
  });

  document.querySelectorAll("dialog.modal").forEach((dialog) => {
    dialog.addEventListener("click", (e) => {
      if (e.target !== dialog) return;
      if (dialog.id === "modal-perfil" && perfilObligatorio && !hasPerfil()) return;
      dialog.close();
    });
    dialog.addEventListener("cancel", (e) => {
      if (dialog.id === "modal-perfil" && perfilObligatorio && !hasPerfil()) {
        e.preventDefault();
      }
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
        const autorNombre =
          c.autor?.nombreCompleto ||
          [c.autor?.nombres, c.autor?.apellidos].filter(Boolean).join(" ") ||
          c.createdBy ||
          "";
        return `
      <article class="admin-item">
        ${C?.autorMetaHtml ? C.autorMetaHtml(c.autor || { nombreCompleto: autorNombre || "Docente" }, formatFecha(c.fecha), c.categoria) : `
        <div class="admin-item__meta">
          <span class="tag tag--${c.categoria}">${c.categoria}</span>
          <time>${formatFecha(c.fecha)}</time>
        </div>`}
        ${badges.length ? `<div class="admin-item__meta">${badges.map((b) => `<span class="tag tag--general">${b}</span>`).join("")}</div>` : ""}
        <h3>${escapeHtml(c.titulo)}</h3>
        <p>${escapeHtml(c.mensaje)}</p>
        <div class="like-stat" aria-label="${likesCounts[c.id] || 0} me gusta">
          <span class="like-stat__heart" aria-hidden="true">♥</span>
          <span>${likesCounts[c.id] || 0}</span>
        </div>
        <div class="admin-item__actions">
          <button type="button" class="btn btn--ghost btn--sm" data-edit-com="${c.id}">Editar</button>
          <button type="button" class="btn-danger" data-del-com="${c.id}">Eliminar</button>
        </div>
      </article>`;
      })
      .join("");
  }

  document.getElementById("btn-nuevo-com")?.addEventListener("click", () => {
    if (!hasPerfil()) {
      openPerfilModal({ required: true });
      return;
    }
    const form = document.getElementById("form-com");
    form.reset();
    form.recordId.value = "";
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
      form.recordId.value = item.id;
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
      queuePendingDelCom(id);
      renderComunicados();
      flushPendingComs().catch((err) => {
        console.error(err);
        alert("No se pudo eliminar en la nube. Quedó pendiente y se reintentará.");
      });
    }
  });

  document.getElementById("form-com")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    FB = window.InmaculadaFirebase || FB;
    const form = e.currentTarget;
    const btn = form.querySelector('button[type="submit"]');
    const id = String(form.recordId.value || "").trim();
    const titulo = form.titulo.value.trim();
    const mensaje = form.mensaje.value.trim();
    const categoria = form.categoria.value;
    const videoYoutube = form.videoYoutube.value.trim();
    const videoDrive = form.videoDrive.value.trim();
    const imagenDrive = form.imagenDrive.value.trim();
    if (!titulo || !mensaje) return;

    if (!FB?.auth?.currentUser) {
      alert("Tu sesión no está activa. Cierra sesión y vuelve a entrar.");
      return;
    }

    if (!hasPerfil()) {
      document.getElementById("modal-com")?.close();
      openPerfilModal({ required: true });
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = "Guardando…";
    }

    let item;
    try {
      const autor = autorSnapshot();
      if (id) {
        item = comunicados.find((c) => c.id === id);
        if (item) {
          item.titulo = titulo;
          item.mensaje = mensaje;
          item.categoria = categoria;
          item.videoYoutube = videoYoutube;
          item.videoDrive = videoDrive;
          item.imagenDrive = imagenDrive;
          item.autor = autor;
          item.updatedAt = new Date().toISOString();
          item.updatedBy = currentUser?.email || FB.auth.currentUser.email || "";
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
          autor,
          createdBy: currentUser?.email || FB.auth.currentUser.email || "",
          updatedAt: new Date().toISOString(),
        };
        comunicados.unshift(item);
      }

      if (!item) {
        alert("No se pudo preparar el comunicado.");
        return;
      }

      await persistLocal();
      queuePendingCom(item);
      document.getElementById("modal-com").close();
      renderComunicados();

      try {
        await FB.saveComunicado(item);
        savePendingComs(loadPendingComs().filter((c) => c.id !== item.id));
        // Verificar que la nube lo tiene (así la app pública puede leerlo)
        const remote = await FB.fetchComunicados();
        const ok = Array.isArray(remote) && remote.some((c) => c.id === item.id);
        if (!ok) {
          alert(
            "El comunicado no quedó en la nube. Revisa en Firebase Console → Firestore que exista la colección «comunicados» y que las reglas estén publicadas."
          );
        }
      } catch (err) {
        console.error(err);
        alert(
          "El comunicado quedó en este dispositivo, pero no se subió a la nube.\n" +
            (err?.message || "Revisa conexión y reglas de Firestore.") +
            "\nSe reintentará al volver a entrar."
        );
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Guardar";
      }
    }
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
    if (!form) return;
    form.reset();
    form.recordId.value = "";
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
      if (!form) return;
      form.recordId.value = item.id;
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
    const id = String(form.recordId?.value || "").trim();
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
        ${(() => {
          const raw = honorFotoRaw(est);
          if (!raw) return "";
          if (C?.driveImgTag) return C.driveImgTag(raw, { alt: "", loading: "lazy" });
          return `<img src="${escapeHtml(resolveHonorFoto(raw))}" alt="" />`;
        })()}
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
          <input type="text" name="fotoDrive${n}" inputmode="url" placeholder="Link de foto en Drive (opcional)" />
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
    if (C?.resolveDisplayImage) return C.resolveDisplayImage(url) || url;
    if (C?.driveImageUrl) {
      const drive = C.driveImageUrl(url);
      if (drive) return drive;
    }
    return url;
  }

  function honorFotoRaw(est) {
    if (!est) return "";
    if (isDataFoto(est.foto)) return est.foto;
    return est.fotoDrive || est.foto || "";
  }

  function setHonorPreview(img, url) {
    if (!img) return;
    if (C?.setDriveImage) {
      C.setDriveImage(img, url, () => {
        img.removeAttribute("src");
        img.hidden = true;
      });
      return;
    }
    const preview = resolveHonorFoto(url);
    if (preview) {
      img.hidden = false;
      img.src = preview;
    } else {
      img.removeAttribute("src");
      img.hidden = true;
    }
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
          const driveLink = est.fotoDrive || foto;
          form[`fotoDrive${n}`].value = driveLink;
          const img = form.querySelector(`[data-puesto="${n}"] img`);
          setHonorPreview(img, driveLink);
        } else if (foto) {
          fotoCache[n] = foto;
          const img = form.querySelector(`[data-puesto="${n}"] img`);
          setHonorPreview(img, foto);
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
      if (FB?.configured) {
        FB.removePuestosEntry(salon, periodo).catch((err) => {
          console.error(err);
          alert("No se pudo eliminar en la nube.");
        });
      }
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
      const img = field?.querySelector("img");
      const n = Number(field?.getAttribute("data-puesto"));
      fotoCache[n] = "";
      setHonorPreview(img, driveInput.value.trim());
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
      setHonorPreview(img, dataUrl);
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
          foto: driveLink,
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
      updatedBy: currentUser?.email || "",
    };

    const entry = puestosMap[puestosKey(salon, periodo)];

    try {
      await persistLocal();
      if (FB?.configured) await FB.savePuestosEntry(entry);
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

  // Init: la sesión la controla Firebase Auth
  showApp(false);

  /* PWA instalación */
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./sw.js", { scope: "./" })
      .then((reg) => reg.update().catch(() => {}))
      .catch(() => {});
  }

  const INSTALL_DISMISS_KEY = "inmaculada_docentes_install_dismissed";
  const INSTALL_DONE_KEY = "inmaculada_docentes_installed";
  let deferredPrompt = window.__pwaDeferredPrompt || null;

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
    window.__pwaDeferredPrompt = null;
    hideInstallBar();
  }
  function shouldOfferInstall() {
    if (isStandalone || wasInstalled() || wasDismissed()) return false;
    return isIos || isAndroid || isWindows || isDesktopChrome;
  }
  function syncInstallLabel() {
    if (!installLabel) return;
    if (isIos) installLabel.textContent = "Cómo instalar";
    else if (isAndroid && !deferredPrompt) installLabel.textContent = "Instalar Docentes";
    else installLabel.textContent = "Instalar Docentes";
  }
  function showInstallBar() {
    if (!installBar || !shouldOfferInstall()) return;
    syncInstallLabel();
    installBar.hidden = false;
  }
  function hideInstallBar() {
    if (!installBar) return;
    installBar.hidden = true;
  }

  function capturePrompt(e) {
    if (wasInstalled() || isStandalone) {
      try {
        e.preventDefault();
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      e.preventDefault();
    } catch {
      /* ignore */
    }
    deferredPrompt = e;
    window.__pwaDeferredPrompt = e;
    showInstallBar();
  }

  if (isStandalone) localStorage.setItem(INSTALL_DONE_KEY, "1");

  window.addEventListener("beforeinstallprompt", capturePrompt);
  window.addEventListener("pwa-bip", () => {
    if (window.__pwaDeferredPrompt) {
      deferredPrompt = window.__pwaDeferredPrompt;
      showInstallBar();
    }
  });

  window.addEventListener("appinstalled", () => markInstalled());

  btnInstall?.addEventListener("click", async () => {
    if (isIos) {
      document.getElementById("modal-ios-install")?.showModal();
      return;
    }
    const promptEvent = deferredPrompt || window.__pwaDeferredPrompt;
    if (promptEvent) {
      try {
        promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice.outcome === "accepted") markInstalled();
      } catch {
        /* ignore */
      }
      deferredPrompt = null;
      window.__pwaDeferredPrompt = null;
      return;
    }
    if (isAndroid) {
      document.getElementById("modal-android-install")?.showModal();
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
