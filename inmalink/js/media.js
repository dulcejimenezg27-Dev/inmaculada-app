/* Utilidades de media (YouTube / Drive) para InmaLink */
window.InmaLinkMedia = (() => {
  function escapeAttr(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function extractDriveId(url) {
    const s = String(url || "").trim();
    if (!s) return "";
    const m1 = s.match(/\/file\/d\/([^/]+)/);
    if (m1) return m1[1];
    const m2 = s.match(/[?&]id=([^&]+)/);
    if (m2) return m2[1];
    const m3 = s.match(/\/d\/([^/]+)/);
    if (m3) return m3[1];
    return "";
  }

  function youtubeVideoId(url) {
    if (!url) return "";
    const s = String(url).trim();
    const watch = s.match(/[?&]v=([^&]+)/);
    const short = s.match(/youtu\.be\/([^?&]+)/);
    const embed = s.match(/youtube\.com\/embed\/([^?&]+)/);
    const shorts = s.match(/youtube\.com\/shorts\/([^?&]+)/);
    if (watch) return watch[1];
    if (short) return short[1];
    if (embed) return embed[1];
    if (shorts) return shorts[1];
    return "";
  }

  function isYoutubeShorts(url) {
    return /youtube\.com\/shorts\//i.test(String(url || ""));
  }

  function driveImageCandidates(url) {
    const raw = String(url || "").trim();
    if (!raw) return [];
    if (raw.startsWith("data:")) return [raw];
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
    ];
  }

  function driveVideoThumbCandidates(idOrUrl) {
    const id = extractDriveId(idOrUrl) || String(idOrUrl || "").trim();
    if (!id) return [];
    return [
      `https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w1280`,
      `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1280`,
    ];
  }

  function imgFallbackOnErrorAttr(fallbacks) {
    if (!fallbacks?.length) return "";
    return `data-fallbacks="${fallbacks.map(escapeAttr).join("|")}" data-fi="0" onerror="(function(el){var f=(el.getAttribute('data-fallbacks')||'').split('|').filter(Boolean);var i=+(el.getAttribute('data-fi')||0);if(i&lt;f.length){el.setAttribute('data-fi',String(i+1));el.src=f[i];return;}el.style.display='none';})(this)"`;
  }

  function mediaHtml(post) {
    const parts = [];
    const ytId = youtubeVideoId(post.videoYoutube || "");
    if (ytId) {
      const shorts = isYoutubeShorts(post.videoYoutube || "");
      const yt = `https://www.youtube.com/embed/${ytId}`;
      parts.push(
        `<div class="il-media il-media--youtube${shorts ? " il-media--portrait" : ""}"><iframe src="${escapeAttr(yt)}" title="Video de YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`
      );
    }
    const driveVidId = extractDriveId(post.videoDrive || "");
    if (driveVidId) {
      const thumbs = driveVideoThumbCandidates(driveVidId);
      const [first, ...rest] = thumbs;
      const img = first
        ? `<img class="il-drive-poster__img" src="${escapeAttr(first)}" alt="" loading="lazy" referrerpolicy="no-referrer" ${imgFallbackOnErrorAttr(rest)} />`
        : "";
      parts.push(
        `<div class="il-media il-media--drive" data-drive-id="${escapeAttr(driveVidId)}">
          <button type="button" class="il-drive-poster" data-drive-play aria-label="Reproducir video">
            ${img}
            <span class="il-drive-poster__play" aria-hidden="true">▶</span>
            <span class="il-drive-poster__label">Drive · Toca para ver</span>
          </button>
        </div>`
      );
    }
    const imagenRaw = String(post.imagenDrive || "").trim();
    if (imagenRaw) {
      const candidates = driveImageCandidates(imagenRaw);
      if (candidates.length) {
        const [first, ...rest] = candidates;
        parts.push(
          `<div class="il-media il-media--image"><img src="${escapeAttr(first)}" alt="" loading="lazy" referrerpolicy="no-referrer" ${imgFallbackOnErrorAttr(rest)} /></div>`
        );
      }
    }
    return parts.join("");
  }

  return {
    escapeAttr,
    escapeHtml,
    extractDriveId,
    youtubeVideoId,
    driveImageCandidates,
    mediaHtml,
  };
})();
