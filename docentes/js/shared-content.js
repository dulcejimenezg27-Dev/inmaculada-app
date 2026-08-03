/* Claves y utilidades compartidas entre app pública y administración */
window.InmaculadaContent = (() => {
  const STORAGE = {
    comunicados: "inmaculada_comunicados",
    eventos: "inmaculada_eventos",
    puestos: "inmaculada_puestos",
    meta: "inmaculada_content_meta",
  };

  const GRADOS = [
    "Transición",
    "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11",
  ];
  const GRUPOS = ["A", "B"];

  const PERIODOS_LABEL = {
    1: "Primer período",
    2: "Segundo período",
    3: "Tercer período",
    4: "Cuarto período",
  };

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

  function listaSalones() {
    return GRADOS.flatMap((g) => GRUPOS.map((gr) => `${g}-${gr}`));
  }

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

  function extractDriveId(url) {
    if (!url) return "";
    const s = String(url).trim();
    // Si ya es un enlace lh3/googleusercontent con /d/ID
    const lh = s.match(/googleusercontent\.com\/d\/([^/=?#]+)/i);
    if (lh?.[1]) return lh[1];
    const patterns = [
      /\/file\/d\/([^/]+)/,
      /[?&]id=([^&]+)/,
      /\/thumbnail\?id=([^&]+)/,
      /\/d\/([^/]+)/,
      /\/open\?id=([^&]+)/,
    ];
    for (const re of patterns) {
      const m = s.match(re);
      if (m?.[1]) return m[1];
    }
    // ID “pelado” de Drive (letras, números, - _)
    if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
    return "";
  }

  /** Varias URLs candidatas: /uc ya no sirve para incrustar (403). */
  function driveImageCandidates(url) {
    const raw = String(url || "").trim();
    if (!raw) return [];
    if (raw.startsWith("data:")) return [raw];
    // Logo u otras rutas del sitio
    if (raw.startsWith("/") && !raw.startsWith("//")) {
      try {
        return [new URL(raw, window.location.origin).href];
      } catch {
        return [raw];
      }
    }
    const id = extractDriveId(raw);
    if (!id) {
      if (/^https?:\/\//i.test(raw)) return [raw];
      return [];
    }
    return [
      `https://lh3.googleusercontent.com/d/${id}=w1000`,
      `https://lh3.googleusercontent.com/d/${id}`,
      `https://drive.google.com/thumbnail?id=${id}&sz=w1000`,
      `https://drive.google.com/thumbnail?id=${id}&sz=s1000`,
    ];
  }

  function colegioLogoUrl() {
    try {
      return new URL("/image/logoInmaculada.jpg", window.location.origin).href;
    } catch {
      return "/image/logoInmaculada.jpg";
    }
  }

  function youtubeEmbedUrl(url) {
    if (!url) return "";
    const s = String(url).trim();
    let id = "";
    const watch = s.match(/[?&]v=([^&]+)/);
    const short = s.match(/youtu\.be\/([^?&]+)/);
    const embed = s.match(/youtube\.com\/embed\/([^?&]+)/);
    const shorts = s.match(/youtube\.com\/shorts\/([^?&]+)/);
    if (watch) id = watch[1];
    else if (short) id = short[1];
    else if (embed) id = embed[1];
    else if (shorts) id = shorts[1];
    return id ? `https://www.youtube.com/embed/${id}` : "";
  }

  function drivePreviewUrl(url) {
    const id = extractDriveId(url);
    return id ? `https://drive.google.com/file/d/${id}/preview` : "";
  }

  /** Miniaturas candidatas para video/archivo de Drive (como la de YouTube). */
  function driveVideoThumbCandidates(idOrUrl) {
    const id = extractDriveId(idOrUrl) || String(idOrUrl || "").trim();
    if (!id) return [];
    return [
      `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1280`,
      `https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w1280`,
      `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1000`,
    ];
  }

  function driveImageUrl(url) {
    const list = driveImageCandidates(url);
    return list[0] || "";
  }

  /** URL usable en <img>: Drive convertido o enlace https directo. */
  function resolveFotoUrl(url) {
    return resolveDisplayImage(url);
  }

  /** Resuelve data:, Drive o https para mostrar. */
  function resolveDisplayImage(url) {
    const raw = String(url || "").trim();
    if (!raw) return "";
    if (raw.startsWith("data:")) return raw;
    const list = driveImageCandidates(raw);
    if (list.length) return list[0];
    if (/^https?:\/\//i.test(raw)) return raw;
    return "";
  }

  function escapeAttr(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function escapeHtmlText(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** onerror en <img> para probar URLs alternativas de Drive. */
  function imgFallbackOnErrorAttr(fallbacks) {
    const list = (fallbacks || []).filter(Boolean);
    if (!list.length) {
      return `onerror="this.style.display='none';var n=this.nextElementSibling;if(n){n.hidden=false;n.style.display='';}"`;
    }
    return `data-fallbacks="${list.map(escapeAttr).join("|")}" data-fi="0" onerror="(function(el){var f=(el.getAttribute('data-fallbacks')||'').split('|').filter(Boolean);var i=+(el.getAttribute('data-fi')||0);if(i<f.length){el.setAttribute('data-fi',String(i+1));el.src=f[i];}else{el.style.display='none';var n=el.nextElementSibling;if(n){n.hidden=false;n.style.display='';}}})(this)"`;
  }

  const IMG_SAFE_ATTRS = 'referrerpolicy="no-referrer" decoding="async"';

  /**
   * <img> con reintentos para Drive.
   * @param {string} url
   * @param {{ className?: string, alt?: string, loading?: string }} [opts]
   */
  function driveImgTag(url, opts = {}) {
    const raw = String(url || "").trim();
    if (!raw) return "";
    const cls = opts.className ? ` class="${escapeAttr(opts.className)}"` : "";
    const alt = ` alt="${escapeAttr(opts.alt || "")}"`;
    const loading = opts.loading ? ` loading="${escapeAttr(opts.loading)}"` : ' loading="lazy"';
    if (raw.startsWith("data:")) {
      return `<img${cls} src="${escapeAttr(raw)}"${alt}${loading} ${IMG_SAFE_ATTRS} />`;
    }
    const candidates = driveImageCandidates(raw);
    if (!candidates.length) return "";
    const [first, ...rest] = candidates;
    return `<img${cls} src="${escapeAttr(first)}"${alt}${loading} ${IMG_SAFE_ATTRS} ${imgFallbackOnErrorAttr(rest)} />`;
  }

  /** Asigna src a un <img> probando candidatas de Drive. */
  function setDriveImage(img, url, onFail) {
    if (!img) return;
    const raw = String(url || "").trim();
    if (!raw) {
      if (typeof onFail === "function") onFail();
      return;
    }
    try {
      img.referrerPolicy = "no-referrer";
    } catch {
      /* ignore */
    }
    if (raw.startsWith("data:")) {
      img.onerror = null;
      img.hidden = false;
      img.style.display = "";
      img.src = raw;
      return;
    }
    const candidates = driveImageCandidates(raw);
    if (!candidates.length) {
      if (typeof onFail === "function") onFail();
      return;
    }
    let i = 0;
    img.hidden = false;
    img.style.display = "";
    img.onerror = () => {
      i += 1;
      if (i < candidates.length) img.src = candidates[i];
      else if (typeof onFail === "function") onFail();
    };
    img.onload = () => {
      img.hidden = false;
      img.style.display = "";
    };
    img.src = candidates[0];
  }

  function inicialesNombre(nombre) {
    const parts = String(nombre || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function autorAvatarHtml(autor) {
    const nombre =
      (autor && (autor.nombreCompleto || [autor.nombres, autor.apellidos].filter(Boolean).join(" "))) ||
      "Colegio La Inmaculada";
    const initials = inicialesNombre(nombre);
    let fotoRaw = String(autor?.fotoUrl || "").trim();
    const esColegio =
      !autor ||
      autor.uid === "admin" ||
      /colegio la inmaculada/i.test(nombre);
    if (!fotoRaw && esColegio) fotoRaw = colegioLogoUrl();

    if (fotoRaw) {
      const candidates = driveImageCandidates(fotoRaw);
      if (candidates.length) {
        const [first, ...rest] = candidates;
        const id = extractDriveId(fotoRaw);
        const large = id
          ? `https://lh3.googleusercontent.com/d/${id}=w1600`
          : first;
        // Iniciales solo como respaldo oculto; el CSS [hidden] evita el doble círculo
        return `<button type="button" class="feed-author__avatar-btn" data-avatar-zoom data-avatar-src="${escapeAttr(large)}" data-avatar-fallbacks="${[first, ...rest].map(escapeAttr).join("|")}" data-avatar-name="${escapeAttr(nombre)}" aria-label="Ver foto de ${escapeAttr(nombre)}"><img class="feed-author__avatar" src="${escapeAttr(first)}" alt="" loading="lazy" ${IMG_SAFE_ATTRS} data-fallbacks="${rest.map(escapeAttr).join("|")}" data-fi="0" onerror="(function(el){var f=(el.getAttribute('data-fallbacks')||'').split('|').filter(Boolean);var i=+(el.getAttribute('data-fi')||0);if(i&lt;f.length){el.setAttribute('data-fi',String(i+1));el.src=f[i];return;}el.style.display='none';el.setAttribute('hidden','');var n=el.nextElementSibling;if(n){n.removeAttribute('hidden');n.style.display='inline-flex';}})(this)" /><span class="feed-author__avatar feed-author__avatar--fallback" hidden style="display:none" aria-hidden="true">${escapeHtmlText(initials)}</span></button>`;
      }
    }
    return `<span class="feed-author__avatar feed-author__avatar--fallback" aria-hidden="true">${escapeHtmlText(initials)}</span>`;
  }

  function autorMetaHtml(autor, fechaLabel, categoria) {
    const nombre =
      (autor && (autor.nombreCompleto || [autor.nombres, autor.apellidos].filter(Boolean).join(" "))) ||
      "Colegio La Inmaculada";
    const licencia = String(autor?.cargoLabel || autor?.licenciatura || autor?.cargo || "").trim();
    const tag = categoria
      ? `<span class="tag tag--${escapeAttr(categoria)}">${escapeHtmlText(categoria)}</span>`
      : "";
    return `
      <div class="feed-author">
        ${autorAvatarHtml(autor)}
        <div class="feed-author__info">
          <strong class="feed-author__name">${escapeHtmlText(nombre)}</strong>
          ${licencia ? `<span class="feed-author__role">${escapeHtmlText(licencia)}</span>` : ""}
          <div class="feed-author__meta">
            ${tag}
            ${fechaLabel ? `<time class="feed-item__date">${escapeHtmlText(fechaLabel)}</time>` : ""}
          </div>
        </div>
      </div>`;
  }

  function mediaHtml(comunicado) {
    const parts = [];
    const yt = youtubeEmbedUrl(comunicado.videoYoutube || "");
    if (yt) {
      parts.push(
        `<div class="media-embed media-embed--youtube"><iframe src="${escapeAttr(yt)}" title="Video de YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`
      );
    }
    const driveVidId = extractDriveId(comunicado.videoDrive || "");
    if (driveVidId) {
      const thumbs = driveVideoThumbCandidates(driveVidId);
      const [first, ...rest] = thumbs;
      const img =
        first
          ? `<img class="media-drive-poster__img" src="${escapeAttr(first)}" alt="" loading="lazy" referrerpolicy="no-referrer" decoding="async" ${imgFallbackOnErrorAttr(rest)} />`
          : "";
      parts.push(
        `<div class="media-embed media-embed--drive" data-drive-id="${escapeAttr(driveVidId)}">
          <button type="button" class="media-drive-poster" data-drive-play aria-label="Reproducir video de Drive">
            ${img}
            <span class="media-drive-poster__shade" aria-hidden="true"></span>
            <span class="media-drive-poster__play" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86a1 1 0 00-1.5.86z"/></svg>
            </span>
            <span class="media-drive-poster__label">Video de Drive · Toca para ver</span>
          </button>
        </div>`
      );
    }

    const imagenRaw = String(comunicado.imagenDrive || "").trim();
    const imgId = extractDriveId(imagenRaw);
    const imgTag = imagenRaw ? driveImgTag(imagenRaw, { alt: "Imagen del comunicado", loading: "lazy" }) : "";
    if (imgTag || imgId) {
      const iframeFallback = imgId
        ? `<div class="media-image__frame" hidden><iframe src="https://drive.google.com/file/d/${escapeAttr(imgId)}/preview" title="Imagen de Drive" loading="lazy" allow="autoplay"></iframe></div>`
        : "";
      if (imgTag) {
        parts.push(`<div class="media-image">${imgTag}${iframeFallback}</div>`);
      } else {
        parts.push(
          `<div class="media-image media-image--frame"><iframe src="https://drive.google.com/file/d/${escapeAttr(imgId)}/preview" title="Imagen de Drive" loading="lazy" allow="autoplay"></iframe></div>`
        );
      }
    }
    return parts.join("");
  }

  function getBundle() {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      comunicados: load(STORAGE.comunicados, seedComunicados),
      eventos: load(STORAGE.eventos, seedEventos),
      puestos: load(STORAGE.puestos, {}),
    };
  }

  function applyBundle(bundle) {
    if (!bundle || typeof bundle !== "object") return false;
    if (Array.isArray(bundle.comunicados)) save(STORAGE.comunicados, bundle.comunicados);
    if (Array.isArray(bundle.eventos)) save(STORAGE.eventos, bundle.eventos);
    if (bundle.puestos && typeof bundle.puestos === "object") save(STORAGE.puestos, bundle.puestos);
    save(STORAGE.meta, { updatedAt: bundle.updatedAt || new Date().toISOString() });
    return true;
  }

  async function hydrateFromFile(url) {
    try {
      const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) return false;
      const bundle = await res.json();
      return applyBundle(bundle);
    } catch {
      return false;
    }
  }

  function downloadBundle(filename = "contenido.json") {
    const bundle = getBundle();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /** Más reciente primero: fecha, luego updatedAt/createdAt. */
  function compareNewestFirst(a, b) {
    const byFecha = String(b?.fecha || "").localeCompare(String(a?.fecha || ""));
    if (byFecha) return byFecha;
    const tb = String(b?.updatedAt || b?.createdAt || "");
    const ta = String(a?.updatedAt || a?.createdAt || "");
    const byTime = tb.localeCompare(ta);
    if (byTime) return byTime;
    return String(b?.id || "").localeCompare(String(a?.id || ""));
  }

  function sortNewestFirst(items) {
    return [...(items || [])].sort(compareNewestFirst);
  }

  /** Lightbox de foto de perfil (tipo redes). */
  function ensureAvatarLightbox() {
    if (typeof document === "undefined") return;
    if (document.getElementById("modal-avatar-zoom")) return;

    const dialog = document.createElement("dialog");
    dialog.id = "modal-avatar-zoom";
    dialog.className = "avatar-zoom";
    dialog.innerHTML = `
      <div class="avatar-zoom__card">
        <button type="button" class="avatar-zoom__close" data-avatar-close aria-label="Cerrar">×</button>
        <img class="avatar-zoom__img" id="avatar-zoom-img" alt="" referrerpolicy="no-referrer" />
        <p class="avatar-zoom__name" id="avatar-zoom-name"></p>
      </div>
    `;
    document.body.appendChild(dialog);

    const img = dialog.querySelector("#avatar-zoom-img");
    const nameEl = dialog.querySelector("#avatar-zoom-name");

    function closeZoom() {
      if (dialog.open) dialog.close();
      else dialog.removeAttribute("open");
    }

    function openZoom(src, name, fallbacks) {
      if (!img) return;
      const list = [src, ...(fallbacks || [])].filter(Boolean);
      let i = 0;
      img.onerror = () => {
        i += 1;
        if (i < list.length) img.src = list[i];
      };
      img.src = list[0] || "";
      if (nameEl) nameEl.textContent = name || "";
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }

    document.addEventListener("click", (e) => {
      const closeBtn = e.target.closest("[data-avatar-close]");
      if (closeBtn) {
        e.preventDefault();
        closeZoom();
        return;
      }
      const btn = e.target.closest("[data-avatar-zoom]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const src = btn.getAttribute("data-avatar-src") || "";
      const name = btn.getAttribute("data-avatar-name") || "";
      const fallbacks = (btn.getAttribute("data-avatar-fallbacks") || "")
        .split("|")
        .filter(Boolean);
      if (!src && !fallbacks.length) return;
      openZoom(src || fallbacks[0], name, fallbacks);
    });

    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) closeZoom();
    });
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", ensureAvatarLightbox);
    } else {
      ensureAvatarLightbox();
    }
  }

  return {
    STORAGE,
    GRADOS,
    GRUPOS,
    PERIODOS_LABEL,
    seedComunicados,
    seedEventos,
    listaSalones,
    load,
    save,
    uid,
    youtubeEmbedUrl,
    drivePreviewUrl,
    driveVideoThumbCandidates,
    driveImageUrl,
    driveImageCandidates,
    resolveFotoUrl,
    resolveDisplayImage,
    driveImgTag,
    setDriveImage,
    colegioLogoUrl,
    inicialesNombre,
    autorAvatarHtml,
    autorMetaHtml,
    mediaHtml,
    extractDriveId,
    getBundle,
    applyBundle,
    hydrateFromFile,
    downloadBundle,
    compareNewestFirst,
    sortNewestFirst,
    ensureAvatarLightbox,
  };
})();
