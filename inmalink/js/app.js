/* InmaLink — UI principal */
(() => {
  "use strict";

  const M = () => window.InmaLinkMedia;
  const FB = () => window.InmaLinkFirebase;

  const GRADOS = [
    "Transición-A", "Transición-B",
    "1-A", "1-B", "2-A", "2-B", "3-A", "3-B", "4-A", "4-B",
    "5-A", "5-B", "6-A", "6-B", "7-A", "7-B", "8-A", "8-B",
    "9-A", "9-B", "10-A", "10-B", "11-A", "11-B",
  ];

  const MATERIAS = [
    "Matemáticas",
    "Lengua Castellana",
    "Inglés",
    "Ciencias Naturales",
    "Ciencias Sociales",
    "Educación Física",
    "Ética y Valores",
    "Religión",
    "Artística",
    "Tecnología e Informática",
    "Filosofía",
    "Química",
    "Física",
    "Biología",
    "Orientación escolar",
    "Otra",
  ];

  const CARGOS = [
    "Rector",
    "Secretaría",
    "Coordinador",
    "Coordinadora",
    "Psicólogo",
    "Psicóloga",
  ];

  let user = null;
  let perfil = null;
  let posts = [];
  let commentsUnsub = null;
  let openCommentsPostId = null;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function firstWord(str) {
    return String(str || "").trim().split(/\s+/).filter(Boolean)[0] || "";
  }

  function autorLabel(p, opts = {}) {
    if (!p) return "Usuario InmaLink";
    const nom = firstWord(p.nombres);
    const ape = firstWord(p.apellidos);
    const nombre = [nom, ape].filter(Boolean).join(" ");
    switch (p.rol) {
      case "estudiante":
        return `Estudiante · ${nombre} · ${p.grado || ""}`.trim();
      case "docente":
        return `Docente · ${nombre} · ${p.areaPrincipal || (p.materias && p.materias[0]) || ""}`.trim();
      case "padre": {
        const parentesco = p.parentesco === "mama" ? "Mamá" : "Papá";
        const hijos = Array.isArray(p.hijos) ? p.hijos : [];
        const idx = Number(opts.hijoIndex);
        const hijo =
          (Number.isFinite(idx) && hijos[idx]) ||
          hijos.find((h) => h?.nombre) ||
          {};
        const hijoNom = String(hijo.nombre || "").trim() || "su hijo(a)";
        const hijoGrado = String(hijo.grado || "").trim();
        return `${nombre} · ${parentesco} de ${hijoNom}${hijoGrado ? ` · ${hijoGrado}` : ""}`;
      }
      case "directivo":
        return `${p.cargo || "Directivo"} · ${nombre}`.trim();
      default:
        return nombre || "Usuario InmaLink";
    }
  }

  function showScreen(name) {
    $$("[data-screen]").forEach((el) => {
      el.hidden = el.getAttribute("data-screen") !== name;
    });
  }

  function fillSelect(sel, items, placeholder) {
    if (!sel) return;
    sel.innerHTML =
      (placeholder ? `<option value="">${placeholder}</option>` : "") +
      items.map((v) => `<option value="${v}">${v}</option>`).join("");
  }

  function formatFecha(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
    return d.toLocaleDateString("es-CO", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function setError(id, msg) {
    const el = $(id);
    if (!el) return;
    if (!msg) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = msg;
  }

  /* —— Onboarding fields visibility —— */
  function syncOnboardingFields() {
    const rol = $('input[name="rol"]:checked')?.value || "";
    $$("[data-rol-fields]").forEach((box) => {
      box.hidden = box.getAttribute("data-rol-fields") !== rol;
    });
  }

  function addHijoRow(nombre = "", grado = "") {
    const wrap = $("#hijos-list");
    if (!wrap) return;
    const row = document.createElement("div");
    row.className = "il-hijo-row";
    row.innerHTML = `
      <label>Nombre del hijo(a)
        <input type="text" name="hijoNombre" required maxlength="80" value="${M().escapeAttr(nombre)}" placeholder="María Gómez" />
      </label>
      <label>Grado
        <select name="hijoGrado" required>
          ${GRADOS.map((g) => `<option value="${g}"${g === grado ? " selected" : ""}>${g}</option>`).join("")}
        </select>
      </label>
      <button type="button" class="btn btn--ghost btn--sm" data-remove-hijo>Quitar</button>
    `;
    wrap.appendChild(row);
  }

  function collectOnboarding() {
    const nombres = $("#perfil-nombres")?.value.trim() || "";
    const apellidos = $("#perfil-apellidos")?.value.trim() || "";
    const rol = $('input[name="rol"]:checked')?.value || "";
    if (!nombres || !apellidos) throw new Error("Escribe nombres y apellidos.");
    if (!rol) throw new Error("Elige el tipo de cuenta.");

    const base = { nombres, apellidos, rol, fotoUrl: user?.photoURL || "" };

    if (rol === "estudiante") {
      const grado = $("#perfil-grado")?.value || "";
      if (!grado) throw new Error("El grado es obligatorio.");
      return { ...base, grado };
    }

    if (rol === "docente") {
      const materias = $$('#materias-list input[type="checkbox"]:checked').map((c) => c.value);
      const areaPrincipal = $("#perfil-area")?.value || "";
      if (!materias.length) throw new Error("Selecciona al menos una materia.");
      if (!areaPrincipal) throw new Error("Elige el área principal (la que aparece en tus publicaciones).");
      if (!materias.includes(areaPrincipal)) {
        throw new Error("El área principal debe estar entre las materias seleccionadas.");
      }
      return { ...base, materias, areaPrincipal };
    }

    if (rol === "padre") {
      const parentesco = $('input[name="parentesco"]:checked')?.value || "";
      if (!parentesco) throw new Error("Indica si eres papá o mamá.");
      const rows = $$("#hijos-list .il-hijo-row");
      const hijos = rows.map((row) => ({
        nombre: row.querySelector('[name="hijoNombre"]')?.value.trim() || "",
        grado: row.querySelector('[name="hijoGrado"]')?.value || "",
      })).filter((h) => h.nombre && h.grado);
      if (!hijos.length) throw new Error("Agrega al menos un hijo(a) con nombre y grado.");
      return { ...base, parentesco, hijos };
    }

    if (rol === "directivo") {
      const cargo = $("#perfil-cargo")?.value || "";
      if (!cargo) throw new Error("Selecciona el cargo.");
      return { ...base, cargo };
    }

    throw new Error("Tipo de cuenta no válido.");
  }

  /* —— Feed —— */
  function renderFeed() {
    const list = $("#feed-list");
    if (!list) return;
    const esc = M().escapeHtml;
    const uid = user?.uid || "";

    if (!posts.length) {
      list.innerHTML = `<div class="il-empty">Aún no hay publicaciones. ¡Sé el primero en compartir!</div>`;
      return;
    }

    list.innerHTML = posts
      .map((p) => {
        const liked = Array.isArray(p.likedBy) && uid && p.likedBy.includes(uid);
        const disliked = Array.isArray(p.dislikedBy) && uid && p.dislikedBy.includes(uid);
        const mine = p.autorUid === uid;
        return `
      <article class="il-post" data-id="${esc(p.id)}">
        <header class="il-post__head">
          <div>
            <strong class="il-post__author">${esc(p.autorLabel || "Usuario")}</strong>
            <time class="il-post__date">${esc(formatFecha(p.createdAt))}</time>
          </div>
          ${mine ? `<button type="button" class="btn btn--ghost btn--sm" data-delete-post="${esc(p.id)}">Eliminar</button>` : ""}
        </header>
        <h2 class="il-post__title">${esc(p.titulo || "")}</h2>
        <p class="il-post__body">${esc(p.mensaje || "")}</p>
        ${M().mediaHtml(p)}
        <div class="il-post__actions">
          <button type="button" class="il-react il-like ${liked ? "is-active" : ""}" data-like="${esc(p.id)}" aria-pressed="${liked}" aria-label="Me gusta">
            <span class="il-react__icon">${liked ? "♥" : "♡"}</span>
            <span class="il-react__label">Me gusta</span>
            <span class="il-react__count">${Number(p.likesCount) || 0}</span>
          </button>
          <button type="button" class="il-react il-dislike ${disliked ? "is-active" : ""}" data-dislike="${esc(p.id)}" aria-pressed="${disliked}" aria-label="No me gusta">
            <span class="il-react__icon">${disliked ? "▾" : "▿"}</span>
            <span class="il-react__label">No me gusta</span>
            <span class="il-react__count">${Number(p.dislikesCount) || 0}</span>
          </button>
          <button type="button" class="btn btn--ghost btn--sm" data-comments="${esc(p.id)}">
            Comentarios (${Number(p.comentariosCount) || 0})
          </button>
        </div>
      </article>`;
      })
      .join("");
  }

  function openComments(postId) {
    openCommentsPostId = postId;
    const dialog = $("#modal-comments");
    const title = $("#modal-comments-title");
    const post = posts.find((p) => p.id === postId);
    if (title) title.textContent = post?.titulo ? `Comentarios · ${post.titulo}` : "Comentarios";
    $("#comments-list").innerHTML = `<div class="il-empty">Cargando…</div>`;
    if (commentsUnsub) commentsUnsub();
    commentsUnsub = FB().watchComentarios(postId, (items) => {
      const list = $("#comments-list");
      const esc = M().escapeHtml;
      if (!items.length) {
        list.innerHTML = `<div class="il-empty">Sé el primero en comentar.</div>`;
        return;
      }
      list.innerHTML = items
        .map(
          (c) => `
        <div class="il-comment">
          <strong>${esc(c.autorLabel || "Usuario")}</strong>
          <p>${esc(c.texto || "")}</p>
          <time>${esc(formatFecha(c.createdAt))}</time>
        </div>`
        )
        .join("");
    });
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeComments() {
    const dialog = $("#modal-comments");
    if (commentsUnsub) {
      commentsUnsub();
      commentsUnsub = null;
    }
    openCommentsPostId = null;
    if (dialog?.open) dialog.close();
    else dialog?.removeAttribute("open");
  }

  function syncPublishHijoSelect() {
    const wrap = $("#publish-hijo-wrap");
    const sel = $("#publish-hijo");
    if (!wrap || !sel) return;
    if (perfil?.rol !== "padre" || !Array.isArray(perfil.hijos) || !perfil.hijos.length) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    sel.innerHTML = perfil.hijos
      .map(
        (h, i) =>
          `<option value="${i}">${M().escapeHtml(h.nombre)} · ${M().escapeHtml(h.grado)}</option>`
      )
      .join("");
  }

  async function enterApp() {
    $("#user-chip-label").textContent = autorLabel(perfil);
    $("#top-user-name").textContent = `${perfil.nombres || ""} ${perfil.apellidos || ""}`.trim();
    syncPublishHijoSelect();
    showScreen("app");
    FB().watchPosts((items) => {
      posts = items;
      renderFeed();
    });
  }

  async function afterAuth(u) {
    user = u;
    if (!u) {
      perfil = null;
      showScreen("login");
      return;
    }
    try {
      perfil = await FB().getPerfil(u.uid);
    } catch (err) {
      console.error(err);
      setError("#login-error", "No se pudo cargar el perfil. Revisa las reglas de Firestore.");
      showScreen("login");
      return;
    }
    if (!perfil?.rol) {
      $("#perfil-nombres").value = firstWord(u.displayName) || "";
      const parts = String(u.displayName || "").trim().split(/\s+/);
      if (parts.length > 1) $("#perfil-apellidos").value = parts.slice(1).join(" ");
      showScreen("onboarding");
      return;
    }
    await enterApp();
  }

  function bind() {
    fillSelect($("#perfil-grado"), GRADOS, "Selecciona el grado");
    fillSelect($("#perfil-area"), MATERIAS, "Área principal");
    fillSelect($("#perfil-cargo"), CARGOS, "Selecciona el cargo");

    const matList = $("#materias-list");
    if (matList) {
      matList.innerHTML = MATERIAS.map(
        (m) =>
          `<label class="il-check"><input type="checkbox" value="${M().escapeAttr(m)}" /> ${M().escapeHtml(m)}</label>`
      ).join("");
    }

    addHijoRow();

    $$('input[name="rol"]').forEach((r) => r.addEventListener("change", syncOnboardingFields));
    syncOnboardingFields();

    $("#btn-add-hijo")?.addEventListener("click", () => addHijoRow());
    $("#hijos-list")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-remove-hijo]");
      if (!btn) return;
      const rows = $$("#hijos-list .il-hijo-row");
      if (rows.length <= 1) return;
      btn.closest(".il-hijo-row")?.remove();
    });

    $("#btn-google")?.addEventListener("click", async () => {
      setError("#login-error", "");
      try {
        await FB().signInWithGoogle();
      } catch (err) {
        console.error(err);
        setError("#login-error", err.message || "No se pudo iniciar con Google.");
      }
    });

    $("#form-onboarding")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      setError("#onboarding-error", "");
      if (!user) return;
      try {
        const data = collectOnboarding();
        data.createdAt = new Date().toISOString();
        perfil = await FB().savePerfil(user.uid, data);
        await enterApp();
      } catch (err) {
        setError("#onboarding-error", err.message || "No se pudo guardar el perfil.");
      }
    });

    $("#btn-logout")?.addEventListener("click", async () => {
      await FB().logOut();
    });

    $("#btn-new-post")?.addEventListener("click", () => {
      const dialog = $("#modal-publish");
      $("#form-publish")?.reset();
      syncPublishHijoSelect();
      setError("#publish-error", "");
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    });

    $$("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-close-modal");
        const dialog = document.getElementById(id);
        if (id === "modal-comments") closeComments();
        else if (dialog?.open) dialog.close();
        else dialog?.removeAttribute("open");
      });
    });

    $("#form-publish")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      setError("#publish-error", "");
      const form = e.target;
      const titulo = form.titulo.value.trim();
      const mensaje = form.mensaje.value.trim();
      if (!titulo || !mensaje) {
        setError("#publish-error", "Título y mensaje son obligatorios.");
        return;
      }
      try {
        let hijoIndex = 0;
        if (perfil?.rol === "padre") {
          hijoIndex = Number($("#publish-hijo")?.value || 0);
        }
        const label = autorLabel(perfil, { hijoIndex });
        await FB().createPost({
          titulo,
          mensaje,
          videoYoutube: form.videoYoutube.value.trim(),
          videoDrive: form.videoDrive.value.trim(),
          imagenDrive: form.imagenDrive.value.trim(),
          autorLabel: label,
          autorRol: perfil.rol,
        });
        const dialog = $("#modal-publish");
        if (dialog?.open) dialog.close();
        else dialog?.removeAttribute("open");
        form.reset();
      } catch (err) {
        console.error(err);
        setError("#publish-error", err.message || "No se pudo publicar.");
      }
    });

    $("#feed-list")?.addEventListener("click", async (e) => {
      const likeBtn = e.target.closest("[data-like]");
      if (likeBtn) {
        const id = likeBtn.getAttribute("data-like");
        try {
          await FB().toggleLike(id);
        } catch (err) {
          alert(err.message || "No se pudo dar me gusta.");
        }
        return;
      }
      const dislikeBtn = e.target.closest("[data-dislike]");
      if (dislikeBtn) {
        const id = dislikeBtn.getAttribute("data-dislike");
        try {
          await FB().toggleDislike(id);
        } catch (err) {
          alert(err.message || "No se pudo registrar no me gusta.");
        }
        return;
      }
      const comBtn = e.target.closest("[data-comments]");
      if (comBtn) {
        openComments(comBtn.getAttribute("data-comments"));
        return;
      }
      const delBtn = e.target.closest("[data-delete-post]");
      if (delBtn) {
        const id = delBtn.getAttribute("data-delete-post");
        if (!confirm("¿Eliminar esta publicación?")) return;
        try {
          await FB().deleteOwnPost(id, user.uid);
        } catch (err) {
          alert(err.message || "No se pudo eliminar.");
        }
      }
    });

    $("#form-comment")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const texto = $("#comment-text")?.value.trim();
      if (!texto || !openCommentsPostId || !perfil) return;
      try {
        await FB().addComentario(
          openCommentsPostId,
          texto,
          autorLabel(perfil),
          user.uid
        );
        $("#comment-text").value = "";
      } catch (err) {
        alert(err.message || "No se pudo comentar.");
      }
    });

    /* Drive play */
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-drive-play]");
      if (!btn) return;
      const wrap = btn.closest(".il-media--drive");
      const id = wrap?.getAttribute("data-drive-id");
      if (!wrap || !id || wrap.classList.contains("is-playing")) return;
      wrap.classList.add("is-playing");
      const key = window.INMALINK_FIREBASE_CONFIG?.apiKey || "";
      const mediaUrl = key
        ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&key=${encodeURIComponent(key)}`
        : "";
      if (mediaUrl) {
        wrap.innerHTML = `<video class="il-drive-video" controls autoplay playsinline src="${mediaUrl}"></video>`;
        const video = wrap.querySelector("video");
        video?.addEventListener(
          "error",
          () => {
            wrap.innerHTML = `<iframe src="https://drive.google.com/file/d/${id}/preview?autoplay=1" title="Video Drive" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
          },
          { once: true }
        );
        video?.play?.()?.catch?.(() => {});
      } else {
        wrap.innerHTML = `<iframe src="https://drive.google.com/file/d/${id}/preview?autoplay=1" title="Video Drive" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
      }
    });
  }

  async function boot() {
    bind();
    if (!window.InmaLinkFirebase) {
      await new Promise((resolve) => {
        window.addEventListener("inmalink-firebase-ready", resolve, { once: true });
        // por si el evento ya pasó
        window.setTimeout(resolve, 4000);
      });
    }
    if (!FB()?.configured) {
      setError("#login-error", "Firebase de InmaLink no está configurado.");
      showScreen("login");
      return;
    }
    await FB().ready;
    await FB().handleRedirectResult();
    FB().onAuth(afterAuth);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
