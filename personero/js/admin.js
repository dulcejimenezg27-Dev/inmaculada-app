(() => {
  "use strict";

  const C = window.InmaculadaContent || null;
  const CFG = window.PERSONERO_CONFIG || { allowedEmails: [] };
  let FB = window.InmaculadaFirebase || null;
  let currentUser = null;
  let currentPerfil = null;
  let perfilObligatorio = false;
  let posts = [];

  const MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatFecha(iso) {
    const [y, m, d] = String(iso || "").split("-").map(Number);
    if (!y || !m || !d) return iso || "";
    return `${d} de ${MESES[m - 1]} de ${y}`;
  }

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

  function setLoginBusy(busy) {
    const btn = document.getElementById("btn-login-submit");
    const email = document.getElementById("login-email");
    const pass = document.getElementById("login-password");
    if (btn) {
      btn.disabled = !!busy;
      btn.textContent = busy ? "Entrando…" : "Entrar";
    }
    if (email) email.disabled = !!busy;
    if (pass) pass.disabled = !!busy;
  }

  function isPersoneroEmail(email) {
    if (FB?.isPersoneroEmail) return FB.isPersoneroEmail(email);
    const list = (CFG.allowedEmails || []).map((e) => String(e).trim().toLowerCase()).filter(Boolean);
    if (!list.length) return true;
    return list.includes(String(email || "").trim().toLowerCase());
  }

  function hasPerfil() {
    return !!(FB?.perfilCompleto ? FB.perfilCompleto(currentPerfil) : false);
  }

  function autorSnapshot() {
    if (FB?.buildAutorFromPerfil) {
      const a = FB.buildAutorFromPerfil(currentPerfil, currentUser);
      if (!a.licenciatura && !a.cargoLabel) {
        a.licenciatura = "Personero";
        a.cargoLabel = "Personero";
      }
      return a;
    }
    return {
      uid: currentUser?.uid || "",
      email: currentUser?.email || "",
      nombres: currentPerfil?.nombres || "",
      apellidos: currentPerfil?.apellidos || "",
      nombreCompleto: "Personero",
      licenciatura: currentPerfil?.licenciatura || "Personero",
      fotoUrl: currentPerfil?.fotoUrl || "",
    };
  }

  function applyRoleUI() {
    const roleLabel = document.getElementById("admin-role-label");
    const emailLabel = document.getElementById("admin-user-email");
    const nombre =
      currentPerfil &&
      [currentPerfil.nombres, currentPerfil.apellidos].filter(Boolean).join(" ").trim();
    if (roleLabel) roleLabel.textContent = nombre || "Inmaculada Personero";
    if (emailLabel) {
      emailLabel.textContent =
        currentPerfil?.licenciatura || currentUser?.email || "Psicología escolar";
    }
  }

  function updatePerfilPreview() {
    const form = document.getElementById("form-perfil");
    const wrap = document.getElementById("perfil-preview");
    const img = document.getElementById("perfil-preview-img");
    const fallback = document.getElementById("perfil-preview-fallback");
    if (!form || !wrap || !img || !fallback) return;
    const nombre = [form.nombres.value.trim(), form.apellidos.value.trim()].filter(Boolean).join(" ") || "?";
    const initials = C?.inicialesNombre ? C.inicialesNombre(nombre) : "?";
    wrap.hidden = false;
    if (C?.setDriveImage && form.fotoUrl.value.trim()) {
      C.setDriveImage(img, form.fotoUrl.value, () => {
        img.hidden = true;
        fallback.hidden = false;
        fallback.textContent = initials;
      });
      fallback.hidden = true;
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
    form.licenciatura.value = currentPerfil?.licenciatura || "Personero";
    form.fotoUrl.value = currentPerfil?.fotoUrl || "";
    if (title) title.textContent = hasPerfil() ? "Editar perfil" : "Crea tu perfil";
    if (lead) {
      lead.textContent = required
        ? "Antes de publicar, completa tu nombre. Así te verán en Personero."
        : "Así aparecerás en las publicaciones de Personero.";
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
      renderPosts();
    }
  }

  async function loadPosts() {
    FB = window.InmaculadaFirebase || FB;
    if (!FB?.fetchPersonero) return;
    try {
      if (FB.whenReady) await FB.whenReady();
      const items = await FB.fetchPersonero();
      if (Array.isArray(items)) posts = items;
      renderPosts();
    } catch (err) {
      console.error(err);
    }
  }

  function renderPosts() {
    const list = document.getElementById("admin-lista-posts");
    if (!list) return;
    const items = [...posts].sort((a, b) =>
      String(b.fecha || "").localeCompare(String(a.fecha || ""))
    );
    if (!items.length) {
      list.innerHTML = `<div class="empty">No hay publicaciones todavía.</div>`;
      return;
    }
    list.innerHTML = items
      .map((p) => {
        const badges = [];
        if (p.videoYoutube) badges.push("YouTube");
        if (p.videoDrive) badges.push("Video Drive");
        if (p.imagenDrive) badges.push("Imagen Drive");
        return `
      <article class="admin-item">
        ${
          C?.autorMetaHtml
            ? C.autorMetaHtml(p.autor || { nombreCompleto: "Personero" }, formatFecha(p.fecha), p.categoria)
            : `<div class="admin-item__meta"><span class="tag tag--${p.categoria}">${p.categoria}</span><time>${formatFecha(p.fecha)}</time></div>`
        }
        ${badges.length ? `<div class="admin-item__meta">${badges.map((b) => `<span class="tag tag--general">${b}</span>`).join("")}</div>` : ""}
        <h3>${escapeHtml(p.titulo)}</h3>
        <p>${escapeHtml(p.mensaje)}</p>
        <div class="admin-item__actions">
          <button type="button" class="btn btn--ghost btn--sm" data-edit-post="${p.id}">Editar</button>
          <button type="button" class="btn-danger" data-del-post="${p.id}">Eliminar</button>
        </div>
      </article>`;
      })
      .join("");
  }

  async function enterAs(user) {
    if (!user) {
      currentUser = null;
      currentPerfil = null;
      setLoginBusy(false);
      showApp(false);
      return;
    }
    FB = window.InmaculadaFirebase || FB;
    if (!isPersoneroEmail(user.email)) {
      try {
        await FB.signOut();
      } catch {
        /* ignore */
      }
      currentUser = null;
      setLoginBusy(false);
      showLoginError(
        "Este correo no está autorizado para Personero. Usa personero@inmaculada.app o pide al colegio que lo agregue."
      );
      showApp(false);
      return;
    }
    currentUser = user;
    clearLoginError();
    await loadPerfilForUser(user);
    applyRoleUI();
    showApp(true);
    if (!hasPerfil()) openPerfilModal({ required: true });
    loadPosts();
  }

  document.getElementById("btn-toggle-password")?.addEventListener("click", () => {
    const input = document.getElementById("login-password");
    const btn = document.getElementById("btn-toggle-password");
    if (!input || !btn) return;
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    btn.textContent = showing ? "Ver" : "Ocultar";
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
        err.textContent = "Tu sesión no está activa.";
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
        licenciatura: form.licenciatura.value || "Personero",
        fotoUrl: form.fotoUrl.value,
      });
      perfilObligatorio = false;
      applyRoleUI();
      document.getElementById("modal-perfil")?.close();
    } catch (ex) {
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
    if (!FB?.configured) return;
    FB.onAuth(async (user) => {
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
    const id = btn.getAttribute("data-close-modal");
    if (id === "modal-perfil" && perfilObligatorio && !hasPerfil()) return;
    document.getElementById(id)?.close();
  });

  document.querySelectorAll("dialog.modal").forEach((dialog) => {
    dialog.addEventListener("click", (e) => {
      if (e.target !== dialog) return;
      if (dialog.id === "modal-perfil" && perfilObligatorio && !hasPerfil()) return;
      dialog.close();
    });
    dialog.addEventListener("cancel", (e) => {
      if (dialog.id === "modal-perfil" && perfilObligatorio && !hasPerfil()) e.preventDefault();
    });
  });

  document.getElementById("btn-nuevo-post")?.addEventListener("click", () => {
    if (!hasPerfil()) {
      openPerfilModal({ required: true });
      return;
    }
    const form = document.getElementById("form-post");
    form.reset();
    form.recordId.value = "";
    document.getElementById("modal-post-title").textContent = "Nueva publicación";
    document.getElementById("modal-post").showModal();
  });

  document.getElementById("admin-lista-posts")?.addEventListener("click", async (e) => {
    const edit = e.target.closest("[data-edit-post]");
    const del = e.target.closest("[data-del-post]");
    if (edit) {
      const item = posts.find((p) => p.id === edit.getAttribute("data-edit-post"));
      if (!item) return;
      const form = document.getElementById("form-post");
      form.recordId.value = item.id;
      form.titulo.value = item.titulo;
      form.categoria.value = item.categoria || "general";
      form.mensaje.value = item.mensaje;
      form.videoYoutube.value = item.videoYoutube || "";
      form.videoDrive.value = item.videoDrive || "";
      form.imagenDrive.value = item.imagenDrive || "";
      document.getElementById("modal-post-title").textContent = "Editar publicación";
      document.getElementById("modal-post").showModal();
    }
    if (del) {
      const id = del.getAttribute("data-del-post");
      if (!confirm("¿Eliminar esta publicación?")) return;
      try {
        await FB.removePersonero(id);
        posts = posts.filter((p) => p.id !== id);
        renderPosts();
      } catch (err) {
        alert(err.message || "No se pudo eliminar en la nube.");
      }
    }
  });

  document.getElementById("form-post")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    FB = window.InmaculadaFirebase || FB;
    const form = e.currentTarget;
    const btn = form.querySelector('button[type="submit"]');
    if (!hasPerfil()) {
      document.getElementById("modal-post")?.close();
      openPerfilModal({ required: true });
      return;
    }
    if (!FB?.auth?.currentUser) {
      alert("Tu sesión no está activa. Vuelve a entrar.");
      return;
    }
    const id = String(form.recordId.value || "").trim();
    const titulo = form.titulo.value.trim();
    const mensaje = form.mensaje.value.trim();
    const categoria = form.categoria.value;
    const videoYoutube = form.videoYoutube.value.trim();
    const videoDrive = form.videoDrive.value.trim();
    const imagenDrive = form.imagenDrive.value.trim();
    if (!titulo || !mensaje) return;

    if (btn) {
      btn.disabled = true;
      btn.textContent = "Guardando…";
    }

    try {
      const autor = autorSnapshot();
      let item;
      if (id) {
        item = posts.find((p) => p.id === id);
        if (!item) throw new Error("Publicación no encontrada");
        Object.assign(item, {
          titulo,
          mensaje,
          categoria,
          videoYoutube,
          videoDrive,
          imagenDrive,
          autor,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser.email || "",
        });
      } else {
        item = {
          id: C ? C.uid("p") : `p_${Date.now()}`,
          titulo,
          mensaje,
          categoria,
          videoYoutube,
          videoDrive,
          imagenDrive,
          fecha: new Date().toISOString().slice(0, 10),
          autor,
          createdBy: currentUser.email || "",
          updatedAt: new Date().toISOString(),
        };
        posts.unshift(item);
      }
      await FB.savePersonero(item);
      document.getElementById("modal-post").close();
      renderPosts();
    } catch (err) {
      console.error(err);
      alert(err.message || "No se pudo guardar en la nube.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Guardar";
      }
    }
  });
})();
