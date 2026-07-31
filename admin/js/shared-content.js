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
    const patterns = [
      /\/file\/d\/([^/]+)/,
      /[?&]id=([^&]+)/,
      /\/d\/([^/]+)/,
      /\/open\?id=([^&]+)/,
    ];
    for (const re of patterns) {
      const m = s.match(re);
      if (m?.[1]) return m[1];
    }
    return "";
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

  function driveImageUrl(url) {
    const id = extractDriveId(url);
    return id ? `https://drive.google.com/uc?export=view&id=${id}` : "";
  }

  function mediaHtml(comunicado) {
    const parts = [];
    const yt = youtubeEmbedUrl(comunicado.videoYoutube || "");
    if (yt) {
      parts.push(
        `<div class="media-embed"><iframe src="${yt}" title="Video de YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe></div>`
      );
    }
    const driveVid = drivePreviewUrl(comunicado.videoDrive || "");
    if (driveVid) {
      parts.push(
        `<div class="media-embed"><iframe src="${driveVid}" title="Video de Drive" allow="autoplay" allowfullscreen loading="lazy"></iframe></div>`
      );
    }
    const driveImg = driveImageUrl(comunicado.imagenDrive || "");
    if (driveImg) {
      parts.push(
        `<div class="media-image"><img src="${driveImg}" alt="Imagen del comunicado" loading="lazy" /></div>`
      );
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
    driveImageUrl,
    mediaHtml,
    extractDriveId,
    getBundle,
    applyBundle,
    hydrateFromFile,
    downloadBundle,
  };
})();
