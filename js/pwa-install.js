/**
 * Instalación PWA compartida (app pública + paneles).
 * Requiere en <head>: captura temprana de beforeinstallprompt + registro SW.
 * Config vía data-* en <body>:
 *   data-pwa-sw, data-pwa-scope, data-pwa-label,
 *   data-pwa-dismiss-key, data-pwa-done-key
 */
(() => {
  "use strict";

  const body = document.body;
  if (!body) return;

  const swUrl = body.getAttribute("data-pwa-sw") || "/sw.js";
  const swScope = body.getAttribute("data-pwa-scope") || "/";
  const labelDefault = body.getAttribute("data-pwa-label") || "Instalar App";
  const dismissKey =
    body.getAttribute("data-pwa-dismiss-key") || "inmaculada_install_dismissed";
  const doneKey = body.getAttribute("data-pwa-done-key") || "inmaculada_app_installed";

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
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    window.navigator.standalone === true;

  const installBar = document.getElementById("install-bar");
  const btnInstall = document.getElementById("btn-install-app");
  const btnInstallClose = document.getElementById("btn-install-close");
  const installLabel = document.getElementById("install-bar-label");
  const modalIos = document.getElementById("modal-ios-install");
  const modalAndroid = document.getElementById("modal-android-install");
  const modalWin = document.getElementById("modal-win-install");

  let deferredPrompt = window.__pwaDeferredPrompt || null;
  let prompting = false;

  function wasDismissed() {
    try {
      return sessionStorage.getItem(dismissKey) === "1";
    } catch {
      return false;
    }
  }

  function wasInstalled() {
    try {
      return localStorage.getItem(doneKey) === "1";
    } catch {
      return false;
    }
  }

  function markInstalled() {
    try {
      localStorage.setItem(doneKey, "1");
    } catch {
      /* ignore */
    }
    deferredPrompt = null;
    window.__pwaDeferredPrompt = null;
    hideInstallBar();
  }

  function syncLabel() {
    if (!installLabel) return;
    installLabel.textContent = isIos ? "Cómo instalar" : labelDefault;
  }

  function hideInstallBar() {
    if (!installBar) return;
    installBar.hidden = true;
    document.body.classList.remove("has-install-bar");
  }

  function showInstallBar() {
    if (!installBar || isStandalone || wasInstalled() || wasDismissed()) return;
    const already = !installBar.hidden && document.body.classList.contains("has-install-bar");
    const y = window.scrollY || window.pageYOffset || 0;
    syncLabel();
    installBar.hidden = false;
    document.body.classList.add("has-install-bar");
    // Evita que el padding del topbar en Android “suba” el contenido al aparecer la barra
    if (!already) {
      requestAnimationFrame(() => {
        const extra = window.matchMedia("(max-width: 480px)").matches ? 42 : 0;
        window.scrollTo(0, y + extra);
      });
    }
  }

  /** Android/Windows: solo mostrar cuando hay prompt nativo. iOS: siempre (guía). */
  function maybeShowBar() {
    if (isStandalone || wasInstalled() || wasDismissed()) {
      hideInstallBar();
      return;
    }
    if (isIos) {
      showInstallBar();
      return;
    }
    if (!(isAndroid || isWindows || isDesktopChrome)) {
      hideInstallBar();
      return;
    }
    deferredPrompt = deferredPrompt || window.__pwaDeferredPrompt || null;
    if (deferredPrompt) showInstallBar();
    else hideInstallBar();
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
    maybeShowBar();
  }

  function openFallbackHelp() {
    if (isAndroid && modalAndroid?.showModal) {
      modalAndroid.showModal();
      return;
    }
    if (modalWin?.showModal) {
      modalWin.showModal();
      return;
    }
    if (modalAndroid?.showModal) modalAndroid.showModal();
  }

  async function triggerInstall() {
    if (isIos) {
      modalIos?.showModal?.();
      return;
    }

    const promptEvent = deferredPrompt || window.__pwaDeferredPrompt;
    if (!promptEvent || prompting) {
      openFallbackHelp();
      return;
    }

    prompting = true;
    try {
      // Debe llamarse de inmediato en el gesto del usuario
      const maybePromise = promptEvent.prompt();
      if (maybePromise && typeof maybePromise.then === "function") {
        await maybePromise;
      }
      const choice = await promptEvent.userChoice;
      if (choice?.outcome === "accepted") markInstalled();
      else maybeShowBar();
    } catch (err) {
      console.warn("PWA install:", err);
      openFallbackHelp();
    } finally {
      deferredPrompt = null;
      window.__pwaDeferredPrompt = null;
      prompting = false;
    }
  }

  function registerSw() {
    if (!("serviceWorker" in navigator)) return Promise.resolve(null);
    return navigator.serviceWorker
      .register(swUrl, { scope: swScope })
      .then((reg) => {
        reg.update?.().catch(() => {});
        return navigator.serviceWorker.ready.catch(() => reg);
      })
      .catch((err) => {
        console.warn("SW register:", err);
        return null;
      });
  }

  if (isStandalone) markInstalled();

  window.addEventListener("beforeinstallprompt", capturePrompt);
  window.addEventListener("pwa-bip", () => {
    deferredPrompt = window.__pwaDeferredPrompt || deferredPrompt;
    maybeShowBar();
  });
  window.addEventListener("appinstalled", () => markInstalled());

  btnInstall?.addEventListener("click", (e) => {
    e.preventDefault();
    triggerInstall();
  });

  btnInstallClose?.addEventListener("click", () => {
    try {
      sessionStorage.setItem(dismissKey, "1");
    } catch {
      /* ignore */
    }
    hideInstallBar();
  });

  document.getElementById("btn-cerrar-ios")?.addEventListener("click", () => {
    modalIos?.close?.();
  });
  document.getElementById("btn-cerrar-win")?.addEventListener("click", () => {
    modalWin?.close?.();
  });

  // Si el prompt ya llegó antes de este script
  deferredPrompt = window.__pwaDeferredPrompt || deferredPrompt;
  maybeShowBar();

  registerSw().then(() => {
    // Chrome a veces dispara BIP tras controlar la página
    deferredPrompt = window.__pwaDeferredPrompt || deferredPrompt;
    maybeShowBar();
    // Reintento corto por si BIP llega milisegundos después
    setTimeout(() => {
      deferredPrompt = window.__pwaDeferredPrompt || deferredPrompt;
      maybeShowBar();
    }, 1200);
    setTimeout(() => {
      deferredPrompt = window.__pwaDeferredPrompt || deferredPrompt;
      maybeShowBar();
      // Si nunca llegó el prompt, ofrecer guía manual (no nativo)
      if (
        !deferredPrompt &&
        !isIos &&
        !isStandalone &&
        !wasInstalled() &&
        !wasDismissed() &&
        (isAndroid || isWindows || isDesktopChrome) &&
        (modalAndroid || modalWin)
      ) {
        showInstallBar();
      }
    }, 4000);
  });
})();
