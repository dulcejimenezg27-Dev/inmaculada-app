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
  let commentsRaw = [];
  let commentFilters = { rol: "", usuario: "", grado: "" };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function firstWord(str) {
    return String(str || "").trim().split(/\s+/).filter(Boolean)[0] || "";
  }

  function commentAutorGrado(perfilData) {
    if (!perfilData) return "";
    if (perfilData.rol === "estudiante") return String(perfilData.grado || "").trim();
    if (perfilData.rol === "padre" && Array.isArray(perfilData.hijos) && perfilData.hijos[0]) {
      return String(perfilData.hijos[0].grado || "").trim();
    }
    return "";
  }

  function inferCommentRol(c) {
    const rol = String(c.autorRol || "").trim();
    if (rol) return rol;
    const label = String(c.autorLabel || "");
    if (/^Estudiante\b/i.test(label)) return "estudiante";
    if (/^Docente\b/i.test(label)) return "docente";
    if (/\b(Papá|Mamá)\b/i.test(label)) return "padre";
    if (/^(Rector|Secretaría|Coordinador|Coordinadora|Psicólogo|Psicóloga)\b/i.test(label)) {
      return "directivo";
    }
    return "";
  }

  function inferCommentGrado(c) {
    const g = String(c.autorGrado || "").trim();
    if (g) return g;
    const label = String(c.autorLabel || "");
    const m = label.match(/·\s*([0-9]{1,2}-[AB]|Transición-[AB])\s*$/i);
    return m ? m[1] : "";
  }

  function commentSearchText(c) {
    return [c.autorNombre, c.autorApellidos, c.autorLabel, c.texto]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function filteredComments() {
    const qUser = String(commentFilters.usuario || "").trim().toLowerCase();
    const rol = commentFilters.rol;
    const grado = commentFilters.grado;
    return commentsRaw.filter((c) => {
      if (rol && inferCommentRol(c) !== rol) return false;
      if (grado && inferCommentGrado(c) !== grado) return false;
      if (qUser && !commentSearchText(c).includes(qUser)) return false;
      return true;
    });
  }

  function syncCommentGradoOptions() {
    const sel = $("#cfilter-grado");
    if (!sel) return;
    const current = commentFilters.grado || "";
    const grades = new Set(GRADOS);
    commentsRaw.forEach((c) => {
      const g = inferCommentGrado(c);
      if (g) grades.add(g);
    });
    const list = [...grades];
    sel.innerHTML =
      `<option value="">Todos</option>` +
      list
        .map(
          (g) =>
            `<option value="${M().escapeAttr(g)}"${g === current ? " selected" : ""}>${M().escapeHtml(g)}</option>`
        )
        .join("");
  }

  function renderCommentsList() {
    const list = $("#comments-list");
    const meta = $("#cfilter-meta");
    if (!list) return;
    const esc = M().escapeHtml;
    const uid = user?.uid || "";
    const items = filteredComments();
    if (meta) {
      meta.textContent = commentsRaw.length
        ? `Mostrando ${items.length} de ${commentsRaw.length}`
        : "";
    }
    if (!commentsRaw.length) {
      list.innerHTML = `<div class="il-empty">Sé el primero en comentar.</div>`;
      return;
    }
    if (!items.length) {
      list.innerHTML = `<div class="il-empty">No hay comentarios con esos filtros.</div>`;
      return;
    }
    list.innerHTML = items
      .map((c) => {
        const liked = Array.isArray(c.likedBy) && uid && c.likedBy.includes(uid);
        const disliked = Array.isArray(c.dislikedBy) && uid && c.dislikedBy.includes(uid);
        return `
        <div class="il-comment" data-id="${esc(c.id)}" data-rol="${esc(inferCommentRol(c))}" data-grado="${esc(inferCommentGrado(c))}">
          <strong>${esc(c.autorLabel || "Usuario")}</strong>
          <p>${esc(c.texto || "")}</p>
          <time>${esc(formatFecha(c.createdAt))}</time>
          <div class="il-comment__actions">
            <button type="button" class="il-react il-react--sm il-like ${liked ? "is-active" : ""}" data-clike="${esc(c.id)}" aria-pressed="${liked}" aria-label="Me gusta">
              <span class="il-react__icon">${liked ? "♥" : "♡"}</span>
              <span class="il-react__label">Me gusta</span>
              <span class="il-react__count">${Number(c.likesCount) || 0}</span>
            </button>
            <button type="button" class="il-react il-react--sm il-dislike ${disliked ? "is-active" : ""}" data-cdislike="${esc(c.id)}" aria-pressed="${disliked}" aria-label="No me gusta">
              <span class="il-react__icon">${disliked ? "▾" : "▿"}</span>
              <span class="il-react__label">No me gusta</span>
              <span class="il-react__count">${Number(c.dislikesCount) || 0}</span>
            </button>
          </div>
        </div>`;
      })
      .join("");
  }

  function resetCommentFilters() {
    commentFilters = { rol: "", usuario: "", grado: "" };
    $$("[data-cfilter-rol]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-cfilter-rol") === "");
    });
    const userInput = $("#cfilter-usuario");
    const gradoSel = $("#cfilter-grado");
    if (userInput) userInput.value = "";
    if (gradoSel) gradoSel.value = "";
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
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
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

  let onboardingStep = 1;

  /* —— Onboarding wizard —— */
  function setOnboardingStep(step) {
    onboardingStep = step;
    $$("[data-ob-step]").forEach((pane) => {
      const n = Number(pane.getAttribute("data-ob-step"));
      pane.hidden = n !== step;
      pane.classList.toggle("is-active", n === step);
    });
    $$("[data-ob-dot]").forEach((dot) => {
      const n = Number(dot.getAttribute("data-ob-dot"));
      dot.classList.toggle("is-active", n === step);
      dot.classList.toggle("is-done", n < step);
    });
    const fill = $("#ob-progress-fill");
    const bar = $("#ob-progress");
    if (fill) fill.style.width = `${(step / 3) * 100}%`;
    if (bar) bar.setAttribute("aria-valuenow", String(step));
    syncOnboardingFields();
    updateObPreview();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function syncOnboardingFields() {
    const rol = $('input[name="rol"]:checked')?.value || "";
    $$("[data-rol-fields]").forEach((box) => {
      box.hidden = box.getAttribute("data-rol-fields") !== rol;
    });
    const titles = {
      estudiante: ["Tu grado", "Selecciona el salón en el que estudias."],
      docente: ["Tus materias", "Marca las que dictas y elige el área principal."],
      padre: ["Tu familia", "Indica parentesco e hijos/hijas."],
      directivo: ["Tu cargo", "Así aparecerás al frente de tus publicaciones."],
    };
    const t = titles[rol] || ["Últimos detalles", "Completa la información de tu rol."];
    const titleEl = $("#ob-step3-title");
    const subEl = $("#ob-step3-sub");
    if (titleEl) titleEl.textContent = t[0];
    if (subEl) subEl.textContent = t[1];
  }

  function draftPerfilForPreview() {
    const nombres = $("#perfil-nombres")?.value.trim() || "";
    const apellidos = $("#perfil-apellidos")?.value.trim() || "";
    const rol = $('input[name="rol"]:checked')?.value || "";
    if (!nombres && !apellidos && !rol) return null;
    const draft = { nombres, apellidos, rol };
    if (rol === "estudiante") draft.grado = $("#perfil-grado")?.value || "";
    if (rol === "docente") {
      draft.areaPrincipal = $("#perfil-area")?.value || "";
      draft.materias = $$('#materias-list input:checked').map((c) => c.value);
    }
    if (rol === "padre") {
      draft.parentesco = $('input[name="parentesco"]:checked')?.value || "";
      const row = $("#hijos-list .il-hijo-row");
      draft.hijos = row
        ? [{
            nombre: row.querySelector('[name="hijoNombre"]')?.value.trim() || "",
            grado: row.querySelector('[name="hijoGrado"]')?.value || "",
          }]
        : [];
    }
    if (rol === "directivo") draft.cargo = $("#perfil-cargo")?.value || "";
    return draft;
  }

  function updateObPreview() {
    const chip = $("#ob-preview-chip");
    if (!chip) return;
    const draft = draftPerfilForPreview();
    let text = "Completa tus datos…";
    if (draft?.nombres || draft?.apellidos) {
      try {
        if (draft.rol) text = autorLabel(draft);
        else {
          const nom = [firstWord(draft.nombres), firstWord(draft.apellidos)].filter(Boolean).join(" ");
          text = nom || text;
        }
      } catch {
        text = [draft.nombres, draft.apellidos].filter(Boolean).join(" ") || text;
      }
    }
    if (chip.textContent !== text) {
      chip.textContent = text;
      chip.classList.remove("is-pulse");
      void chip.offsetWidth;
      chip.classList.add("is-pulse");
    }
  }

  function validateOnboardingStep(step) {
    setError("#onboarding-error", "");
    if (step === 1) {
      const nombres = $("#perfil-nombres")?.value.trim() || "";
      const apellidos = $("#perfil-apellidos")?.value.trim() || "";
      if (!nombres || !apellidos) throw new Error("Escribe nombres y apellidos.");
      return;
    }
    if (step === 2) {
      const rol = $('input[name="rol"]:checked')?.value || "";
      if (!rol) throw new Error("Elige cómo formas parte del colegio.");
    }
  }

  function addHijoRow(nombre = "", grado = "") {
    const wrap = $("#hijos-list");
    if (!wrap) return;
    const row = document.createElement("div");
    row.className = "il-hijo-row";
    row.innerHTML = `
      <label class="ob-field">Nombre del hijo(a)
        <input type="text" name="hijoNombre" maxlength="80" value="${M().escapeAttr(nombre)}" placeholder="María Gómez" />
      </label>
      <label class="ob-field">Grado
        <select name="hijoGrado">
          <option value="">Selecciona</option>
          ${GRADOS.map((g) => `<option value="${g}"${g === grado ? " selected" : ""}>${g}</option>`).join("")}
        </select>
      </label>
      <button type="button" class="btn btn--ghost btn--sm" data-remove-hijo>Quitar</button>
    `;
    wrap.appendChild(row);
    row.querySelectorAll("input, select").forEach((el) => {
      el.addEventListener("input", updateObPreview);
      el.addEventListener("change", updateObPreview);
    });
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
    commentsRaw = [];
    resetCommentFilters();
    const dialog = $("#modal-comments");
    const title = $("#modal-comments-title");
    const post = posts.find((p) => p.id === postId);
    if (title) title.textContent = post?.titulo ? `Comentarios · ${post.titulo}` : "Comentarios";
    $("#comments-list").innerHTML = `<div class="il-empty">Cargando…</div>`;
    if (commentsUnsub) commentsUnsub();
    commentsUnsub = FB().watchComentarios(postId, (items) => {
      commentsRaw = items || [];
      syncCommentGradoOptions();
      renderCommentsList();
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
    commentsRaw = [];
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
      setOnboardingStep(1);
      updateObPreview();
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
          `<label class="ob-chip"><input type="checkbox" value="${M().escapeAttr(m)}" /><span>${M().escapeHtml(m)}</span></label>`
      ).join("");
    }

    addHijoRow();
    setOnboardingStep(1);

    $$('input[name="rol"]').forEach((r) =>
      r.addEventListener("change", () => {
        syncOnboardingFields();
        updateObPreview();
      })
    );
    ["perfil-nombres", "perfil-apellidos", "perfil-grado", "perfil-area", "perfil-cargo"].forEach((id) => {
      const el = document.getElementById(id);
      el?.addEventListener("input", updateObPreview);
      el?.addEventListener("change", updateObPreview);
    });
    $$('input[name="parentesco"]').forEach((r) => r.addEventListener("change", updateObPreview));
    matList?.addEventListener("change", updateObPreview);

    document.querySelectorAll("[data-ob-next]").forEach((btn) => {
      btn.addEventListener("click", () => {
        try {
          const next = Number(btn.getAttribute("data-ob-next"));
          validateOnboardingStep(onboardingStep);
          setError("#ob-step-error", "");
          setOnboardingStep(next);
        } catch (err) {
          setError("#ob-step-error", err.message || "Revisa los datos.");
        }
      });
    });
    document.querySelectorAll("[data-ob-prev]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setError("#onboarding-error", "");
        setError("#ob-step-error", "");
        setOnboardingStep(Number(btn.getAttribute("data-ob-prev")));
      });
    });

    $("#btn-add-hijo")?.addEventListener("click", () => addHijoRow());
    $("#hijos-list")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-remove-hijo]");
      if (!btn) return;
      const rows = $$("#hijos-list .il-hijo-row");
      if (rows.length <= 1) return;
      btn.closest(".il-hijo-row")?.remove();
      updateObPreview();
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

    $("#comments-list")?.addEventListener("click", async (e) => {
      const likeBtn = e.target.closest("[data-clike]");
      if (likeBtn) {
        const id = likeBtn.getAttribute("data-clike");
        if (!openCommentsPostId || !id) return;
        try {
          await FB().toggleCommentLike(openCommentsPostId, id);
        } catch (err) {
          alert(err.message || "No se pudo dar me gusta.");
        }
        return;
      }
      const dislikeBtn = e.target.closest("[data-cdislike]");
      if (dislikeBtn) {
        const id = dislikeBtn.getAttribute("data-cdislike");
        if (!openCommentsPostId || !id) return;
        try {
          await FB().toggleCommentDislike(openCommentsPostId, id);
        } catch (err) {
          alert(err.message || "No se pudo registrar no me gusta.");
        }
      }
    });

    $("#form-comment")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const texto = $("#comment-text")?.value.trim();
      if (!texto || !openCommentsPostId || !perfil) return;
      try {
        await FB().addComentario(openCommentsPostId, texto, {
          autorLabel: autorLabel(perfil),
          autorUid: user.uid,
          autorRol: perfil.rol || "",
          autorGrado: commentAutorGrado(perfil),
          autorNombre: perfil.nombres || "",
          autorApellidos: perfil.apellidos || "",
        });
        $("#comment-text").value = "";
      } catch (err) {
        alert(err.message || "No se pudo comentar.");
      }
    });

    document.querySelectorAll("[data-cfilter-rol]").forEach((btn) => {
      btn.addEventListener("click", () => {
        commentFilters.rol = btn.getAttribute("data-cfilter-rol") || "";
        $$("[data-cfilter-rol]").forEach((b) => {
          b.classList.toggle("is-active", b === btn);
        });
        renderCommentsList();
      });
    });
    $("#cfilter-usuario")?.addEventListener("input", (e) => {
      commentFilters.usuario = e.target.value || "";
      renderCommentsList();
    });
    $("#cfilter-grado")?.addEventListener("change", (e) => {
      commentFilters.grado = e.target.value || "";
      renderCommentsList();
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
