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
  let postsUnsub = null;
  let commentsUnsub = null;
  let openCommentsPostId = null;
  let commentsRaw = [];
  let feedFilters = { rol: "" };
  let replyTarget = null; // { rootId, replyToId, replyToLabel, replyToUid }
  let authHandledUid = undefined; // undefined = aún no; null = sin sesión; string = uid
  let authBusy = false;
  const PERFIL_CACHE_KEY = "inmalink_perfil_cache";

  function cachePerfilLocal(p) {
    try {
      if (!p?.uid || !p?.rol) {
        sessionStorage.removeItem(PERFIL_CACHE_KEY);
        return;
      }
      sessionStorage.setItem(PERFIL_CACHE_KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
  }

  function readCachedPerfil(uid) {
    try {
      const raw = sessionStorage.getItem(PERFIL_CACHE_KEY);
      if (!raw) return null;
      const p = JSON.parse(raw);
      return p?.uid === uid && p?.rol ? p : null;
    } catch {
      return null;
    }
  }

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function firstWord(str) {
    return String(str || "").trim().split(/\s+/).filter(Boolean)[0] || "";
  }

  /** Evita que "7-B" se parta dejando la B sola */
  function glueGrade(str) {
    return String(str || "").replace(/(Transición|[0-9]{1,2})-([AB]\b)/gi, "$1\u2011$2");
  }

  function displayAutorLabel(label) {
    return glueGrade(label);
  }

  function postAutorGrado(perfilData, hijoIndex = 0) {
    if (!perfilData) return "";
    if (perfilData.rol === "estudiante") return String(perfilData.grado || "").trim();
    if (perfilData.rol === "padre" && Array.isArray(perfilData.hijos)) {
      const hijo = perfilData.hijos[hijoIndex] || perfilData.hijos[0];
      return String(hijo?.grado || "").trim();
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

  function inferPostRol(p) {
    return inferCommentRol(p);
  }

  function filteredPosts() {
    const rol = feedFilters.rol;
    if (!rol) return posts;
    return posts.filter((p) => inferPostRol(p) === rol);
  }

  function commentThreadRootId(c) {
    const parent = String(c.parentId || "").trim();
    return parent || c.id;
  }

  function buildCommentThreads(items) {
    const roots = [];
    const repliesByParent = new Map();
    (items || []).forEach((c) => {
      const parent = String(c.parentId || "").trim();
      if (!parent) {
        roots.push(c);
        return;
      }
      if (!repliesByParent.has(parent)) repliesByParent.set(parent, []);
      repliesByParent.get(parent).push(c);
    });
    const byDateAsc = (a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
    const byDateDesc = (a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    roots.sort(byDateDesc);
    roots.forEach((r) => {
      const list = repliesByParent.get(r.id) || [];
      list.sort(byDateAsc);
      r._replies = list;
    });
    // Respuestas huérfanas (padre borrado): mostrarlas como raíz
    repliesByParent.forEach((list, parentId) => {
      if (roots.some((r) => r.id === parentId)) return;
      list.sort(byDateDesc);
      list.forEach((c) => {
        c._replies = [];
        roots.push(c);
      });
    });
    roots.sort(byDateDesc);
    return roots;
  }

  function clearReplyTarget() {
    replyTarget = null;
    const banner = $("#reply-banner");
    if (banner) banner.hidden = true;
    const name = $("#reply-banner-name");
    if (name) name.textContent = "—";
    const label = $("#comment-text-label");
    if (label) label.textContent = "Escribe un comentario";
    const submit = $("#btn-comment-submit");
    if (submit) submit.textContent = "Comentar";
    const text = $("#comment-text");
    if (text) text.placeholder = "Tu comentario…";
  }

  function setReplyTarget(comment) {
    if (!comment) {
      clearReplyTarget();
      return;
    }
    const rootId = commentThreadRootId(comment);
    replyTarget = {
      rootId,
      replyToId: comment.id,
      replyToLabel: comment.autorLabel || "Usuario",
      replyToUid: comment.autorUid || "",
    };
    const banner = $("#reply-banner");
    if (banner) banner.hidden = false;
    const name = $("#reply-banner-name");
    if (name) name.textContent = replyTarget.replyToLabel;
    const label = $("#comment-text-label");
    if (label) label.textContent = "Escribe tu respuesta";
    const submit = $("#btn-comment-submit");
    if (submit) submit.textContent = "Responder";
    const text = $("#comment-text");
    if (text) {
      text.placeholder = `Respuesta a ${replyTarget.replyToLabel}…`;
      text.focus();
    }
  }

  function renderOneComment(c, opts = {}) {
    const esc = M().escapeHtml;
    const uid = user?.uid || "";
    const liked = Array.isArray(c.likedBy) && uid && c.likedBy.includes(uid);
    const disliked = Array.isArray(c.dislikedBy) && uid && c.dislikedBy.includes(uid);
    const mine = c.autorUid === uid;
    const foto = c.autorFotoUrl || (mine ? perfil?.fotoUrl : "") || "";
    const label = c.autorLabel || "Usuario";
    const isReply = !!opts.isReply;
    const replyHint = c.replyToLabel
      ? `<p class="il-comment__reply-to">Respondió a <strong>${esc(c.replyToLabel)}</strong></p>`
      : "";
    return `
      <div class="il-comment${isReply ? " il-comment--reply" : ""}" data-id="${esc(c.id)}">
        <div class="il-comment__top">
          <div class="il-comment__who">
            ${driveAvatarHtml(foto, label, {
              sm: isReply,
              email: c.autorEmail || (mine ? user?.email || perfil?.email : "") || "",
              uid: c.autorUid || "",
            })}
            <div class="il-comment__meta">
                <strong class="il-comment__author">${esc(displayAutorLabel(label))}</strong>
              <time>${esc(formatFecha(c.updatedAt || c.createdAt))}${c.updatedAt && c.updatedAt !== c.createdAt ? " · editado" : ""}</time>
            </div>
          </div>
        </div>
        ${replyHint}
        <p class="il-comment__text" data-ctext="${esc(c.id)}">${esc(c.texto || "")}</p>
        <div class="il-comment__edit" data-cedit-box="${esc(c.id)}" hidden>
          <textarea rows="3" maxlength="500">${esc(c.texto || "")}</textarea>
          <div class="il-comment__edit-actions">
            <button type="button" class="btn btn--ghost btn--sm" data-cedit-cancel="${esc(c.id)}">Cancelar</button>
            <button type="button" class="btn btn--primary btn--sm" data-cedit-save="${esc(c.id)}">Guardar</button>
          </div>
          <p class="il-error il-comment__edit-error" hidden></p>
        </div>
        <div class="il-comment__actions">
          <button type="button" class="il-react il-react--sm il-like ${liked ? "is-active" : ""}" data-clike="${esc(c.id)}" aria-pressed="${liked}" aria-label="Me gusta">
            <span class="il-react__icon">${liked ? "♥" : "♡"}</span>
            <span class="il-react__label">${isReply ? "" : "Me gusta"}</span>
            <span class="il-react__count">${Number(c.likesCount) || 0}</span>
          </button>
          <button type="button" class="il-react il-react--sm il-dislike ${disliked ? "is-active" : ""}" data-cdislike="${esc(c.id)}" aria-pressed="${disliked}" aria-label="No me gusta">
            <span class="il-react__icon">${disliked ? "▾" : "▿"}</span>
            <span class="il-react__label">${isReply ? "" : "No me gusta"}</span>
            <span class="il-react__count">${Number(c.dislikesCount) || 0}</span>
          </button>
          <button type="button" class="btn btn--ghost btn--sm" data-creply="${esc(c.id)}">Responder</button>
          ${
            mine
              ? `<button type="button" class="btn btn--ghost btn--sm" data-cedit="${esc(c.id)}">Editar</button>
          <button type="button" class="btn btn--ghost btn--sm" data-cdelete="${esc(c.id)}">Eliminar</button>`
              : ""
          }
        </div>
      </div>`;
  }

  function renderCommentsList() {
    const list = $("#comments-list");
    if (!list) return;
    const items = commentsRaw;
    if (!items.length) {
      list.innerHTML = `<div class="il-empty">Sé el primero en comentar.</div>`;
      return;
    }
    const threads = buildCommentThreads(items);
    list.innerHTML = threads
      .map((root) => {
        const replies = Array.isArray(root._replies) ? root._replies : [];
        return `
        <div class="il-thread">
          ${renderOneComment(root, { isReply: false })}
          ${
            replies.length
              ? `<div class="il-thread__replies">${replies.map((r) => renderOneComment(r, { isReply: true })).join("")}</div>`
              : ""
          }
        </div>`;
      })
      .join("");
  }

  function driveAvatarHtml(fotoUrl, nombre, opts = {}) {
    const esc = M().escapeHtml;
    const escA = M().escapeAttr;
    const sizeClass = opts.sm ? " il-avatar--sm" : "";
    const btnClass = opts.sm ? " il-avatar-btn--sm" : "";
    const email = String(opts.email || "").trim();
    const uid = String(opts.uid || "").trim();
    const initials = (() => {
      const parts = String(nombre || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      if (!parts.length) return "?";
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    })();
    const meta = ` data-avatar-zoom data-avatar-name="${escA(nombre || "")}" data-avatar-email="${escA(email)}" data-avatar-uid="${escA(uid)}" aria-label="Ver foto de ${escA(nombre || "usuario")}"`;
    const raw = String(fotoUrl || "").trim();
    const candidates = raw && M().driveImageCandidates ? M().driveImageCandidates(raw) : raw ? [raw] : [];
    if (candidates.length) {
      const [first, ...rest] = candidates;
      const large = first.includes("=w")
        ? first.replace(/=w\d+/, "=w1600")
        : first;
      const fb = ` data-fallbacks="${rest.map(escA).join("|")}" data-fi="0" onerror="(function(el){var f=(el.getAttribute('data-fallbacks')||'').split('|').filter(Boolean);var i=+(el.getAttribute('data-fi')||0);if(i&lt;f.length){el.setAttribute('data-fi',String(i+1));el.src=f[i];return;}el.style.display='none';el.setAttribute('hidden','');var n=el.nextElementSibling;if(n){n.removeAttribute('hidden');}})(this)"`;
      return `<button type="button" class="il-avatar-btn${btnClass}"${meta} data-avatar-src="${escA(large)}" data-avatar-fallbacks="${[first, ...rest].map(escA).join("|")}"><img class="il-avatar" src="${escA(first)}" alt="" loading="lazy" referrerpolicy="no-referrer"${fb} /><span class="il-avatar il-avatar--fallback" hidden aria-hidden="true">${esc(initials)}</span></button>`;
    }
    return `<button type="button" class="il-avatar-btn${btnClass}"${meta}><span class="il-avatar il-avatar--fallback${sizeClass}" aria-hidden="true">${esc(initials)}</span></button>`;
  }

  function ensureAvatarZoom() {
    if (document.getElementById("il-avatar-zoom")) return;
    const dialog = document.createElement("dialog");
    dialog.id = "il-avatar-zoom";
    dialog.className = "il-avatar-zoom";
    dialog.style.zIndex = "10000";
    dialog.innerHTML = `
      <div class="il-avatar-zoom__card">
        <button type="button" class="il-avatar-zoom__close" data-avatar-close aria-label="Cerrar">×</button>
        <img class="il-avatar-zoom__img" id="il-avatar-zoom-img" alt="" referrerpolicy="no-referrer" />
        <p class="il-avatar-zoom__name" id="il-avatar-zoom-name"></p>
        <p class="il-avatar-zoom__email" id="il-avatar-zoom-email" hidden></p>
      </div>
    `;
    document.body.appendChild(dialog);
    const img = dialog.querySelector("#il-avatar-zoom-img");
    const nameEl = dialog.querySelector("#il-avatar-zoom-name");
    const emailEl = dialog.querySelector("#il-avatar-zoom-email");
    const close = () => {
      if (dialog.open) dialog.close();
      else dialog.removeAttribute("open");
    };
    const showEmail = (email) => {
      if (!emailEl) return;
      const value = String(email || "").trim();
      if (!value) {
        emailEl.hidden = true;
        emailEl.textContent = "";
        return;
      }
      emailEl.hidden = false;
      emailEl.textContent = value;
    };
    document.addEventListener("click", async (e) => {
      if (e.target.closest("[data-avatar-close]")) {
        e.preventDefault();
        close();
        return;
      }
      const btn = e.target.closest("[data-avatar-zoom]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const src = btn.getAttribute("data-avatar-src") || "";
      const name = btn.getAttribute("data-avatar-name") || "";
      let email = btn.getAttribute("data-avatar-email") || "";
      const uid = btn.getAttribute("data-avatar-uid") || "";
      const fallbacks = (btn.getAttribute("data-avatar-fallbacks") || "")
        .split("|")
        .filter(Boolean);
      const list = [src, ...fallbacks].filter(Boolean);
      if (nameEl) nameEl.textContent = name;
      showEmail(email);
      if (img) {
        if (list.length) {
          img.hidden = false;
          let i = 0;
          img.onerror = () => {
            i += 1;
            if (i < list.length) img.src = list[i];
            else img.hidden = true;
          };
          img.src = list[0];
        } else {
          img.removeAttribute("src");
          img.hidden = true;
        }
      }
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");

      // Si el post es viejo y no trae correo, buscarlo en el perfil
      if (!email && uid && FB()?.getPerfil) {
        try {
          const p = await FB().getPerfil(uid);
          const found = String(p?.email || "").trim();
          if (found && dialog.open) showEmail(found);
        } catch {
          /* ignore */
        }
      }
    });
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) close();
    });
  }

  function syncPerfilFotoPreview() {
    const typed = $("#perfil-foto")?.value.trim() || "";
    const raw = typed || user?.photoURL || "";
    const img = $("#perfil-foto-img");
    const fallback = $("#perfil-foto-fallback");
    if (!img || !fallback) return;
    const names = `${$("#perfil-nombres")?.value || ""} ${$("#perfil-apellidos")?.value || ""}`.trim();
    const parts = names.split(/\s+/).filter(Boolean);
    const initials =
      !parts.length
        ? "?"
        : parts.length === 1
          ? parts[0].slice(0, 2).toUpperCase()
          : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    fallback.textContent = initials;

    const preview = $("#perfil-foto-preview");
    if (!raw) {
      img.hidden = true;
      img.removeAttribute("src");
      fallback.hidden = false;
      if (preview) {
        preview.removeAttribute("data-avatar-zoom");
        preview.removeAttribute("data-avatar-src");
        preview.removeAttribute("data-avatar-fallbacks");
        preview.removeAttribute("data-avatar-name");
        preview.removeAttribute("data-avatar-email");
        preview.removeAttribute("data-avatar-uid");
        preview.removeAttribute("role");
        preview.removeAttribute("tabindex");
        preview.removeAttribute("aria-label");
      }
      return;
    }
    const candidates = typed
      ? M().driveImageCandidates?.(raw) || [raw]
      : [raw];
    let i = 0;
    img.hidden = false;
    fallback.hidden = true;
    img.onerror = () => {
      i += 1;
      if (i < candidates.length) img.src = candidates[i];
      else {
        img.hidden = true;
        fallback.hidden = false;
      }
    };
    img.onload = () => {
      img.hidden = false;
      fallback.hidden = true;
    };
    img.src = candidates[0];
    if (preview) {
      const large = candidates[0].includes("=w")
        ? candidates[0].replace(/=w\d+/, "=w1600")
        : candidates[0];
      preview.setAttribute("data-avatar-zoom", "");
      preview.setAttribute("data-avatar-src", large);
      preview.setAttribute("data-avatar-fallbacks", candidates.join("|"));
      preview.setAttribute("data-avatar-name", names || "Tu foto");
      preview.setAttribute("data-avatar-email", user?.email || "");
      preview.setAttribute("data-avatar-uid", user?.uid || "");
      preview.setAttribute("role", "button");
      preview.setAttribute("tabindex", "0");
      preview.setAttribute("aria-label", "Ver foto ampliada");
    }
  }

  function autorLabel(p, opts = {}) {
    if (!p) return "Usuario InmaLink";
    const nom = firstWord(p.nombres);
    const ape = firstWord(p.apellidos);
    const nombre = [nom, ape].filter(Boolean).join(" ");
    switch (p.rol) {
      case "estudiante":
        return glueGrade(`Estudiante · ${nombre} · ${p.grado || ""}`.trim());
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
        const hijoGrado = glueGrade(String(hijo.grado || "").trim());
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

    const driveFoto = $("#perfil-foto")?.value.trim() || "";
    const base = {
      nombres,
      apellidos,
      rol,
      fotoUrl: driveFoto || user?.photoURL || "",
    };

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
    const meta = $("#ffilter-meta");
    const items = filteredPosts();

    if (meta) {
      meta.textContent = posts.length
        ? `Mostrando ${items.length} de ${posts.length}`
        : "";
    }

    if (!posts.length) {
      list.innerHTML = `<div class="il-empty">Aún no hay publicaciones. ¡Sé el primero en compartir!</div>`;
      return;
    }

    if (!items.length) {
      list.innerHTML = `<div class="il-empty">No hay publicaciones con esos filtros.</div>`;
      return;
    }

    list.innerHTML = items
      .map((p) => {
        const liked = Array.isArray(p.likedBy) && uid && p.likedBy.includes(uid);
        const disliked = Array.isArray(p.dislikedBy) && uid && p.dislikedBy.includes(uid);
        const mine = p.autorUid === uid;
        return `
      <article class="il-post" data-id="${esc(p.id)}">
        <header class="il-post__head">
          <div class="il-post__who">
            ${driveAvatarHtml(p.autorFotoUrl || (mine ? perfil?.fotoUrl : ""), p.autorLabel || "Usuario", {
              email: p.autorEmail || (mine ? user?.email || perfil?.email : "") || "",
              uid: p.autorUid || "",
            })}
            <div>
              <strong class="il-post__author">${esc(displayAutorLabel(p.autorLabel || "Usuario"))}</strong>
              <time class="il-post__date">${esc(formatFecha(p.createdAt))}</time>
            </div>
          </div>
          ${
            mine
              ? `<div class="il-post__owner">
            <button type="button" class="il-icon-btn" data-edit-post="${esc(p.id)}" aria-label="Editar publicación" title="Editar">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M13.2 6.3l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            </button>
            <button type="button" class="il-icon-btn il-icon-btn--danger" data-delete-post="${esc(p.id)}" aria-label="Eliminar publicación" title="Eliminar">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 7h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9 7V5h6v2M7 7l1 13h8l1-13" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            </button>
          </div>`
              : ""
          }
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

  function syncCommentHijoSelect() {
    const wrap = $("#comment-hijo-wrap");
    const sel = $("#comment-hijo");
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

  function openComments(postId) {
    openCommentsPostId = postId;
    commentsRaw = [];
    clearReplyTarget();
    syncCommentHijoSelect();
    const dialog = $("#modal-comments");
    const title = $("#modal-comments-title");
    const post = posts.find((p) => p.id === postId);
    if (title) title.textContent = post?.titulo ? `Comentarios · ${post.titulo}` : "Comentarios";
    $("#comments-list").innerHTML = `<div class="il-empty">Cargando…</div>`;
    if (commentsUnsub) commentsUnsub();
    commentsUnsub = FB().watchComentarios(postId, (items) => {
      commentsRaw = items || [];
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
    clearReplyTarget();
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

  function openPublishModal(post = null) {
    const dialog = $("#modal-publish");
    const form = $("#form-publish");
    const title = $("#modal-publish-title");
    const submit = $("#btn-publish-submit");
    if (!form || !dialog) return;
    form.reset();
    setError("#publish-error", "");
    syncPublishHijoSelect();
    if (post) {
      form.recordId.value = post.id || "";
      form.titulo.value = post.titulo || "";
      form.mensaje.value = post.mensaje || "";
      form.videoYoutube.value = post.videoYoutube || "";
      form.videoDrive.value = post.videoDrive || "";
      form.imagenDrive.value = post.imagenDrive || "";
      if (title) title.textContent = "Editar publicación";
      if (submit) submit.textContent = "Guardar cambios";
    } else {
      form.recordId.value = "";
      if (title) title.textContent = "Nueva publicación";
      if (submit) submit.textContent = "Publicar";
    }
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function openEditCommentInline(commentId) {
    const box = $(`[data-cedit-box="${commentId}"]`);
    const textEl = $(`[data-ctext="${commentId}"]`);
    const c = commentsRaw.find((x) => x.id === commentId);
    if (!box || !c) return;
    // Cierra otras ediciones abiertas
    $$("[data-cedit-box]").forEach((el) => {
      el.hidden = true;
    });
    $$("[data-ctext]").forEach((el) => {
      el.hidden = false;
    });
    const ta = box.querySelector("textarea");
    if (ta) ta.value = c.texto || "";
    const err = box.querySelector(".il-comment__edit-error");
    if (err) {
      err.hidden = true;
      err.textContent = "";
    }
    if (textEl) textEl.hidden = true;
    box.hidden = false;
    ta?.focus();
  }

  function cancelEditCommentInline(commentId) {
    const box = $(`[data-cedit-box="${commentId}"]`);
    const textEl = $(`[data-ctext="${commentId}"]`);
    if (box) box.hidden = true;
    if (textEl) textEl.hidden = false;
  }

  async function saveEditCommentInline(commentId) {
    if (!openCommentsPostId || !commentId) return;
    const box = $(`[data-cedit-box="${commentId}"]`);
    const ta = box?.querySelector("textarea");
    const err = box?.querySelector(".il-comment__edit-error");
    const texto = ta?.value.trim() || "";
    if (!texto) {
      if (err) {
        err.hidden = false;
        err.textContent = "El comentario no puede quedar vacío.";
      }
      return;
    }
    try {
      await FB().updateComentario(openCommentsPostId, commentId, texto);
      cancelEditCommentInline(commentId);
    } catch (e) {
      if (err) {
        err.hidden = false;
        err.textContent = e.message || "No se pudo editar.";
      } else {
        alert(e.message || "No se pudo editar.");
      }
    }
  }

  function openEditCommentModal(commentId) {
    // Compatibilidad: edición en línea dentro del modal de comentarios
    openEditCommentInline(commentId);
  }

  async function enterApp() {
    // Asegura el correo en el perfil (identidad real, no editable)
    if (perfil && user?.email && perfil.email !== user.email) {
      try {
        perfil = await FB().savePerfil(user.uid, { ...perfil, email: user.email });
      } catch (err) {
        console.warn("No se pudo guardar el correo en el perfil", err);
      }
    }
    cachePerfilLocal(perfil);
    $("#user-chip-label").textContent = autorLabel(perfil);
    $("#top-user-name").textContent = `${perfil.nombres || ""} ${perfil.apellidos || ""}`.trim();
    const emailEl = $("#top-user-email");
    if (emailEl) emailEl.textContent = user?.email || "";
    syncComposeAvatar();
    syncPublishHijoSelect();
    showScreen("app");
    if (postsUnsub) {
      postsUnsub();
      postsUnsub = null;
    }
    postsUnsub = FB().watchPosts((items) => {
      posts = items;
      renderFeed();
    });
  }

  function syncComposeAvatar() {
    const wrap = $("#compose-avatar");
    if (!wrap || !perfil) return;
    const name = `${perfil.nombres || ""} ${perfil.apellidos || ""}`.trim() || autorLabel(perfil);
    wrap.innerHTML = driveAvatarHtml(perfil.fotoUrl || "", name, {
      email: user?.email || perfil.email || "",
      uid: user?.uid || perfil.uid || "",
    });
  }

  function syncEditFotoPreview() {
    const typed = $("#edit-foto-url")?.value.trim() || "";
    const raw = typed || user?.photoURL || "";
    const img = $("#edit-foto-img");
    const fallback = $("#edit-foto-fallback");
    if (!img || !fallback) return;
    const names = `${$("#edit-nombres")?.value || perfil?.nombres || ""} ${$("#edit-apellidos")?.value || perfil?.apellidos || ""}`.trim();
    const parts = names.split(/\s+/).filter(Boolean);
    const initials =
      !parts.length
        ? "?"
        : parts.length === 1
          ? parts[0].slice(0, 2).toUpperCase()
          : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    fallback.textContent = initials;

    const preview = $("#edit-foto-preview");
    if (!raw) {
      img.hidden = true;
      img.removeAttribute("src");
      fallback.hidden = false;
      if (preview) {
        preview.removeAttribute("data-avatar-zoom");
        preview.removeAttribute("data-avatar-src");
        preview.removeAttribute("data-avatar-fallbacks");
        preview.removeAttribute("data-avatar-name");
        preview.removeAttribute("data-avatar-email");
        preview.removeAttribute("data-avatar-uid");
      }
      return;
    }
    const candidates = typed
      ? M().driveImageCandidates?.(raw) || [raw]
      : [raw];
    let i = 0;
    img.hidden = false;
    fallback.hidden = true;
    img.onerror = () => {
      i += 1;
      if (i < candidates.length) img.src = candidates[i];
      else {
        img.hidden = true;
        fallback.hidden = false;
      }
    };
    img.onload = () => {
      img.hidden = false;
      fallback.hidden = true;
    };
    img.src = candidates[0];
    if (preview) {
      const large = candidates[0].includes("=w")
        ? candidates[0].replace(/=w\d+/, "=w1600")
        : candidates[0];
      preview.setAttribute("data-avatar-zoom", "");
      preview.setAttribute("data-avatar-src", large);
      preview.setAttribute("data-avatar-fallbacks", candidates.join("|"));
      preview.setAttribute("data-avatar-name", names || "Tu foto");
      preview.setAttribute("data-avatar-email", user?.email || perfil?.email || "");
      preview.setAttribute("data-avatar-uid", user?.uid || perfil?.uid || "");
      preview.setAttribute("role", "button");
      preview.setAttribute("tabindex", "0");
      preview.setAttribute("aria-label", "Ver foto ampliada");
    }
  }

  function syncEditRolFields() {
    const rol = $('input[name="edit-rol"]:checked')?.value || "";
    $$("[data-edit-rol-fields]").forEach((box) => {
      box.hidden = box.getAttribute("data-edit-rol-fields") !== rol;
    });
  }

  function addEditHijoRow(nombre = "", grado = "") {
    const wrap = $("#edit-hijos-list");
    if (!wrap) return;
    const row = document.createElement("div");
    row.className = "il-hijo-row";
    row.innerHTML = `
      <label class="ob-field">Nombre del hijo(a)
        <input type="text" name="editHijoNombre" maxlength="80" value="${M().escapeAttr(nombre)}" placeholder="María Gómez" />
      </label>
      <label class="ob-field">Grado
        <select name="editHijoGrado">
          <option value="">Selecciona</option>
          ${GRADOS.map((g) => `<option value="${g}"${g === grado ? " selected" : ""}>${g}</option>`).join("")}
        </select>
      </label>
      <button type="button" class="btn btn--ghost btn--sm" data-remove-edit-hijo>Quitar</button>
    `;
    wrap.appendChild(row);
  }

  function collectEditPerfil() {
    const nombres = $("#edit-nombres")?.value.trim() || "";
    const apellidos = $("#edit-apellidos")?.value.trim() || "";
    const rol = $('input[name="edit-rol"]:checked')?.value || "";
    if (!nombres || !apellidos) throw new Error("Escribe nombres y apellidos.");
    if (!rol) throw new Error("Elige el tipo de cuenta.");

    const driveFoto = $("#edit-foto-url")?.value.trim() || "";
    const base = {
      nombres,
      apellidos,
      rol,
      fotoUrl: driveFoto || user?.photoURL || "",
      createdAt: perfil?.createdAt || new Date().toISOString(),
    };

    if (rol === "estudiante") {
      const grado = $("#edit-grado")?.value || "";
      if (!grado) throw new Error("El grado es obligatorio.");
      return { ...base, grado };
    }

    if (rol === "docente") {
      const materias = $$('#edit-materias-list input[type="checkbox"]:checked').map((c) => c.value);
      const areaPrincipal = $("#edit-area")?.value || "";
      if (!materias.length) throw new Error("Selecciona al menos una materia.");
      if (!areaPrincipal) throw new Error("Elige el área principal.");
      if (!materias.includes(areaPrincipal)) {
        throw new Error("El área principal debe estar entre las materias seleccionadas.");
      }
      return { ...base, materias, areaPrincipal };
    }

    if (rol === "padre") {
      const parentesco = $('input[name="edit-parentesco"]:checked')?.value || "";
      if (!parentesco) throw new Error("Indica si eres papá o mamá.");
      const hijos = $$("#edit-hijos-list .il-hijo-row")
        .map((row) => ({
          nombre: row.querySelector('[name="editHijoNombre"]')?.value.trim() || "",
          grado: row.querySelector('[name="editHijoGrado"]')?.value || "",
        }))
        .filter((h) => h.nombre && h.grado);
      if (!hijos.length) throw new Error("Agrega al menos un hijo(a) con nombre y grado.");
      return { ...base, parentesco, hijos };
    }

    if (rol === "directivo") {
      const cargo = $("#edit-cargo")?.value || "";
      if (!cargo) throw new Error("Selecciona el cargo.");
      return { ...base, cargo };
    }

    throw new Error("Tipo de cuenta no válido.");
  }

  function openEditPerfilModal() {
    const dialog = $("#modal-edit-perfil");
    if (!dialog || !perfil) return;
    setError("#edit-perfil-error", "");

    $("#edit-nombres").value = perfil.nombres || "";
    $("#edit-apellidos").value = perfil.apellidos || "";

    const current = String(perfil.fotoUrl || "").trim();
    const google = String(user?.photoURL || "").trim();
    $("#edit-foto-url").value = current && current !== google ? current : "";

    const rol = perfil.rol || "";
    $$('input[name="edit-rol"]').forEach((r) => {
      r.checked = r.value === rol;
    });

    if (rol === "estudiante") {
      $("#edit-grado").value = perfil.grado || "";
    }

    if (rol === "docente") {
      const mats = Array.isArray(perfil.materias) ? perfil.materias : [];
      $$('#edit-materias-list input[type="checkbox"]').forEach((c) => {
        c.checked = mats.includes(c.value);
      });
      $("#edit-area").value = perfil.areaPrincipal || "";
    }

    if (rol === "padre") {
      $$('input[name="edit-parentesco"]').forEach((r) => {
        r.checked = r.value === perfil.parentesco;
      });
      const wrap = $("#edit-hijos-list");
      if (wrap) wrap.innerHTML = "";
      const hijos = Array.isArray(perfil.hijos) && perfil.hijos.length ? perfil.hijos : [{ nombre: "", grado: "" }];
      hijos.forEach((h) => addEditHijoRow(h.nombre || "", h.grado || ""));
    }

    if (rol === "directivo") {
      $("#edit-cargo").value = perfil.cargo || "";
    }

    syncEditRolFields();
    syncEditFotoPreview();
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  async function afterAuth(u) {
    const nextUid = u?.uid || null;
    if (authBusy) return;
    // Misma sesión ya lista: no reprocesar (vuelves de la app pública, etc.)
    if (authHandledUid === nextUid && (nextUid === null || perfil?.rol)) {
      if (nextUid && perfil?.rol) showScreen("app");
      else if (!nextUid) showScreen("login");
      return;
    }

    authBusy = true;
    authHandledUid = nextUid;
    user = u;
    try {
      if (!u) {
        perfil = null;
        cachePerfilLocal(null);
        if (postsUnsub) {
          postsUnsub();
          postsUnsub = null;
        }
        showScreen("login");
        return;
      }

      // Sesión restaurada: spinner, nunca el login de Google
      showScreen("boot");
      const cached = readCachedPerfil(u.uid);
      if (cached) {
        perfil = cached;
        await enterApp();
        // Refresca perfil en segundo plano
        FB()
          .getPerfil(u.uid)
          .then((fresh) => {
            if (!fresh?.rol || fresh.uid !== user?.uid) return;
            perfil = fresh;
            cachePerfilLocal(fresh);
            $("#user-chip-label").textContent = autorLabel(perfil);
            $("#top-user-name").textContent = `${perfil.nombres || ""} ${perfil.apellidos || ""}`.trim();
            syncComposeAvatar();
            syncPublishHijoSelect();
          })
          .catch(() => {});
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
        cachePerfilLocal(null);
        $("#perfil-nombres").value = firstWord(u.displayName) || "";
        const parts = String(u.displayName || "").trim().split(/\s+/);
        if (parts.length > 1) $("#perfil-apellidos").value = parts.slice(1).join(" ");
        setOnboardingStep(1);
        updateObPreview();
        syncPerfilFotoPreview();
        showScreen("onboarding");
        return;
      }
      cachePerfilLocal(perfil);
      await enterApp();
    } finally {
      authBusy = false;
    }
  }

  function bind() {
    fillSelect($("#perfil-grado"), GRADOS, "Selecciona el grado");
    fillSelect($("#perfil-area"), MATERIAS, "Área principal");
    fillSelect($("#perfil-cargo"), CARGOS, "Selecciona el cargo");
    fillSelect($("#edit-grado"), GRADOS, "Selecciona el grado");
    fillSelect($("#edit-area"), MATERIAS, "Área principal");
    fillSelect($("#edit-cargo"), CARGOS, "Selecciona el cargo");

    const matList = $("#materias-list");
    if (matList) {
      matList.innerHTML = MATERIAS.map(
        (m) =>
          `<label class="ob-chip"><input type="checkbox" value="${M().escapeAttr(m)}" /><span>${M().escapeHtml(m)}</span></label>`
      ).join("");
    }
    const editMatList = $("#edit-materias-list");
    if (editMatList) {
      editMatList.innerHTML = MATERIAS.map(
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
      el?.addEventListener("input", () => {
        updateObPreview();
        syncPerfilFotoPreview();
      });
      el?.addEventListener("change", () => {
        updateObPreview();
        syncPerfilFotoPreview();
      });
    });
    $("#perfil-foto")?.addEventListener("input", syncPerfilFotoPreview);
    $("#perfil-foto")?.addEventListener("change", syncPerfilFotoPreview);
    $$('input[name="parentesco"]').forEach((r) => r.addEventListener("change", updateObPreview));
    matList?.addEventListener("change", updateObPreview);
    ensureAvatarZoom();
    syncPerfilFotoPreview();

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

    $("#btn-edit-perfil")?.addEventListener("click", () => openEditPerfilModal());
    $("#edit-foto-url")?.addEventListener("input", syncEditFotoPreview);
    $("#edit-foto-url")?.addEventListener("change", syncEditFotoPreview);
    $("#edit-nombres")?.addEventListener("input", syncEditFotoPreview);
    $("#edit-apellidos")?.addEventListener("input", syncEditFotoPreview);
    $$('input[name="edit-rol"]').forEach((r) =>
      r.addEventListener("change", () => {
        syncEditRolFields();
        if (r.value === "padre" && !$("#edit-hijos-list .il-hijo-row")) {
          addEditHijoRow();
        }
      })
    );
    $("#btn-edit-add-hijo")?.addEventListener("click", () => addEditHijoRow());
    $("#edit-hijos-list")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-remove-edit-hijo]");
      if (!btn) return;
      const rows = $$("#edit-hijos-list .il-hijo-row");
      if (rows.length <= 1) return;
      btn.closest(".il-hijo-row")?.remove();
    });
    $("#form-edit-perfil")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      setError("#edit-perfil-error", "");
      if (!user || !perfil) return;
      try {
        const data = collectEditPerfil();
        perfil = await FB().savePerfil(user.uid, data);
        cachePerfilLocal(perfil);
        try {
          await FB().updateOwnAutorMeta({
            fotoUrl: perfil.fotoUrl || "",
            autorLabel: autorLabel(perfil),
            autorRol: perfil.rol || "",
            autorEmail: user?.email || perfil.email || "",
            // Si es padre con varios hijos, cada post puede firmar con un hijo distinto
            rewriteLabel:
              perfil.rol !== "padre" ||
              !Array.isArray(perfil.hijos) ||
              perfil.hijos.length <= 1,
          });
        } catch (err) {
          console.warn("No se pudo actualizar publicaciones previas", err);
        }
        $("#user-chip-label").textContent = autorLabel(perfil);
        $("#top-user-name").textContent = `${perfil.nombres || ""} ${perfil.apellidos || ""}`.trim();
        syncComposeAvatar();
        syncPublishHijoSelect();
        renderFeed();
        if (openCommentsPostId) renderCommentsList();
        const dialog = $("#modal-edit-perfil");
        if (dialog?.open) dialog.close();
        else dialog?.removeAttribute("open");
      } catch (err) {
        setError("#edit-perfil-error", err.message || "No se pudo guardar el perfil.");
      }
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
        cachePerfilLocal(perfil);
        await enterApp();
      } catch (err) {
        setError("#onboarding-error", err.message || "No se pudo guardar el perfil.");
      }
    });

    $("#btn-logout")?.addEventListener("click", async () => {
      if (!confirm("¿Cerrar sesión de Google en InmaLink? Tendrás que volver a entrar con tu correo.")) {
        return;
      }
      try {
        authHandledUid = undefined;
        perfil = null;
        user = null;
        cachePerfilLocal(null);
        if (postsUnsub) {
          postsUnsub();
          postsUnsub = null;
        }
        showScreen("boot");
        await FB().logOut();
      } catch (err) {
        console.error(err);
        alert("No se pudo cerrar la sesión.");
        showScreen("login");
      }
    });

    $("#btn-new-post")?.addEventListener("click", () => {
      openPublishModal(null);
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
      const recordId = form.recordId?.value?.trim() || "";
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
        const payload = {
          titulo,
          mensaje,
          videoYoutube: form.videoYoutube.value.trim(),
          videoDrive: form.videoDrive.value.trim(),
          imagenDrive: form.imagenDrive.value.trim(),
          autorLabel: label,
          autorRol: perfil.rol,
          autorGrado: postAutorGrado(perfil, hijoIndex),
          autorFotoUrl: perfil.fotoUrl || "",
          autorEmail: user?.email || perfil.email || "",
        };
        if (recordId) {
          await FB().updatePost(recordId, payload);
        } else {
          await FB().createPost(payload);
        }
        const dialog = $("#modal-publish");
        if (dialog?.open) dialog.close();
        else dialog?.removeAttribute("open");
        form.reset();
        form.recordId.value = "";
      } catch (err) {
        console.error(err);
        setError("#publish-error", err.message || "No se pudo guardar.");
      }
    });

    $("#form-edit-comment")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      setError("#edit-comment-error", "");
      const commentId = $("#edit-comment-id")?.value || "";
      const texto = $("#edit-comment-text")?.value.trim() || "";
      if (!openCommentsPostId || !commentId) return;
      try {
        await FB().updateComentario(openCommentsPostId, commentId, texto);
        const dialog = $("#modal-edit-comment");
        if (dialog?.open) dialog.close();
        else dialog?.removeAttribute("open");
      } catch (err) {
        setError("#edit-comment-error", err.message || "No se pudo editar.");
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
      const editBtn = e.target.closest("[data-edit-post]");
      if (editBtn) {
        const id = editBtn.getAttribute("data-edit-post");
        const post = posts.find((p) => p.id === id);
        if (post) openPublishModal(post);
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
      const editC = e.target.closest("[data-cedit]");
      if (editC) {
        openEditCommentInline(editC.getAttribute("data-cedit"));
        return;
      }
      const cancelEdit = e.target.closest("[data-cedit-cancel]");
      if (cancelEdit) {
        cancelEditCommentInline(cancelEdit.getAttribute("data-cedit-cancel"));
        return;
      }
      const saveEdit = e.target.closest("[data-cedit-save]");
      if (saveEdit) {
        await saveEditCommentInline(saveEdit.getAttribute("data-cedit-save"));
        return;
      }
      const delC = e.target.closest("[data-cdelete]");
      if (delC) {
        const id = delC.getAttribute("data-cdelete");
        if (!openCommentsPostId || !id) return;
        if (!confirm("¿Eliminar este comentario?")) return;
        try {
          await FB().deleteComentario(openCommentsPostId, id);
          if (replyTarget && (replyTarget.rootId === id || replyTarget.replyToId === id)) {
            clearReplyTarget();
          }
        } catch (err) {
          alert(err.message || "No se pudo eliminar.");
        }
        return;
      }
      const replyBtn = e.target.closest("[data-creply]");
      if (replyBtn) {
        const id = replyBtn.getAttribute("data-creply");
        const comment = commentsRaw.find((x) => x.id === id);
        if (comment) setReplyTarget(comment);
        return;
      }
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

    $("#btn-cancel-reply")?.addEventListener("click", () => clearReplyTarget());

    $("#form-comment")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const texto = $("#comment-text")?.value.trim();
      if (!texto || !openCommentsPostId || !perfil) return;
      try {
        let hijoIndex = 0;
        if (perfil?.rol === "padre") {
          hijoIndex = Number($("#comment-hijo")?.value || 0);
        }
        const meta = {
          autorLabel: autorLabel(perfil, { hijoIndex }),
          autorUid: user.uid,
          autorRol: perfil.rol || "",
          autorGrado: postAutorGrado(perfil, hijoIndex),
          autorNombre: perfil.nombres || "",
          autorApellidos: perfil.apellidos || "",
          autorFotoUrl: perfil.fotoUrl || "",
          autorEmail: user?.email || perfil.email || "",
        };
        if (replyTarget) {
          meta.parentId = replyTarget.rootId;
          meta.replyToLabel = replyTarget.replyToLabel;
          meta.replyToUid = replyTarget.replyToUid;
        }
        await FB().addComentario(openCommentsPostId, texto, meta);
        $("#comment-text").value = "";
        clearReplyTarget();
      } catch (err) {
        alert(err.message || "No se pudo comentar.");
      }
    });

    document.querySelectorAll("[data-ffilter-rol]").forEach((btn) => {
      btn.addEventListener("click", () => {
        feedFilters.rol = btn.getAttribute("data-ffilter-rol") || "";
        $$("[data-ffilter-rol]").forEach((b) => {
          b.classList.toggle("is-active", b === btn);
        });
        renderFeed();
      });
    });

    /* Drive play: video nativo en el feed; iframe en modal grande */
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-drive-play]");
      if (!btn) return;
      e.preventDefault();
      const wrap = btn.closest(".il-media--drive");
      const id = wrap?.getAttribute("data-drive-id");
      if (!wrap || !id) return;
      if (wrap.classList.contains("is-playing") && wrap.querySelector("video")) return;

      const thumb = btn.querySelector(".il-drive-poster__img");
      const posterSrc = thumb?.currentSrc || thumb?.getAttribute("src") || "";
      playInmaDrive(wrap, id, posterSrc);
    });
  }

  function ensureIlDriveModal() {
    let dialog = document.getElementById("il-modal-drive-player");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "il-modal-drive-player";
    dialog.className = "il-modal il-modal--drive-player";
    dialog.innerHTML = `
      <div class="il-drive-player">
        <header class="il-drive-player__head">
          <strong>Video de Drive</strong>
          <button type="button" class="il-drive-player__close" data-il-drive-close aria-label="Cerrar">×</button>
        </header>
        <div class="il-drive-player__frame" id="il-drive-player-frame"></div>
      </div>
    `;
    document.body.appendChild(dialog);
    const close = () => {
      const frame = dialog.querySelector("#il-drive-player-frame");
      if (frame) frame.innerHTML = "";
      if (dialog.open) dialog.close();
      else dialog.removeAttribute("open");
    };
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog || e.target.closest("[data-il-drive-close]")) {
        e.preventDefault();
        close();
      }
    });
    return dialog;
  }

  function openIlDriveModal(id) {
    const dialog = ensureIlDriveModal();
    const frame = dialog.querySelector("#il-drive-player-frame");
    if (!frame || !id) return;
    frame.innerHTML = `<iframe src="https://drive.google.com/file/d/${encodeURIComponent(id)}/preview" title="Video Drive" allow="autoplay; encrypted-media; fullscreen" allowfullscreen loading="eager"></iframe>`;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function ilDrivePosterHtml(id, posterSrc) {
    const img = posterSrc
      ? `<img class="il-drive-poster__img" src="${String(posterSrc).replace(/"/g, "&quot;")}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
      : "";
    return `
      <button type="button" class="il-drive-poster" data-drive-play aria-label="Reproducir video">
        ${img}
        <span class="il-drive-poster__play" aria-hidden="true">▶</span>
        <span class="il-drive-poster__label">Drive · Toca para ver</span>
      </button>
    `;
  }

  function playInmaDrive(wrap, id, posterSrc) {
    const key = window.INMALINK_FIREBASE_CONFIG?.apiKey || "";
    const mediaUrl = key
      ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&key=${encodeURIComponent(key)}`
      : "";

    if (mediaUrl) {
      wrap.classList.add("is-playing");
      wrap.innerHTML = `<video class="il-drive-video" controls autoplay playsinline preload="auto" ${posterSrc ? `poster="${String(posterSrc).replace(/"/g, "&quot;")}"` : ""} src="${mediaUrl}"></video>`;
      const video = wrap.querySelector("video");
      if (!video) return;
      let fellBack = false;
      const fallback = () => {
        if (fellBack) return;
        fellBack = true;
        wrap.classList.remove("is-playing");
        wrap.innerHTML = ilDrivePosterHtml(id, posterSrc);
        openIlDriveModal(id);
      };
      video.addEventListener("error", fallback, { once: true });
      video.play?.()?.catch?.(() => {});
      window.setTimeout(() => {
        if (fellBack) return;
        if (video.readyState >= 2 || video.currentTime > 0) return;
        if (!video.paused && video.readyState >= 1) return;
        fallback();
      }, 4000);
      return;
    }

    wrap.classList.remove("is-playing");
    openIlDriveModal(id);
  }

  async function boot() {
    bind();
    showScreen("boot");
    if (!window.InmaLinkFirebase) {
      await new Promise((resolve) => {
        window.addEventListener("inmalink-firebase-ready", resolve, { once: true });
        window.setTimeout(resolve, 4000);
      });
    }
    if (!FB()?.configured) {
      setError("#login-error", "Firebase de InmaLink no está configurado.");
      showScreen("login");
      return;
    }
    await FB().ready;
    try {
      await FB().authStateReady();
    } catch (err) {
      console.warn(err);
    }
    await FB().handleRedirectResult();
    FB().onAuth(afterAuth);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
