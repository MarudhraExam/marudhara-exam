/**
 * android/js/app.js
 *
 * Marudhara Exam — Android UI Controller
 * ------------------------------------------
 * Loaded by android/js/loader.js, AFTER android/css/app.css and
 * android/js/bridge.js, only inside the official Marudhara Exam Android
 * application.
 *
 * This file is ONLY an Android UI controller. It is NOT the bridge, NOT
 * business logic, NOT Firebase, NOT payment, NOT login. It enhances the
 * existing website's behaviour while running inside the Android WebView
 * by delegating every native action through window.MarudharaAndroidBridge.
 *
 * It never modifies HTML, never injects HTML/CSS, never uses innerHTML,
 * document.write, eval, MutationObserver, or setInterval, and never
 * reloads the page automatically.
 *
 * Only one global is exposed: window.MarudharaAndroidApp
 */

(function initMarudharaAndroidApp(window, document) {
  "use strict";

  // Guard against duplicate initialization of this script itself.
  if (window.MarudharaAndroidApp && window.MarudharaAndroidApp.__initialized) {
    return;
  }

  const VERSION = "1.0.0";
  const LOG_PREFIX = "[MarudharaAndroidApp]";

  /** Time window for the "press back again to exit" gesture. */
  const DOUBLE_BACK_EXIT_WINDOW_MS = 2000;

  /**
   * Internal, private state. Never exposed directly — status() below
   * returns a plain snapshot object instead.
   */
  const state = {
    initialized: false,
    destroyed: false,
    android: false,
    bridgeAvailable: false,
    online: true,
    visibility: "visible",
    theme: "light",
    focused: true,
    updateAvailable: false,
    listenerCount: 0,
    lastBackPressAt: 0,
    keyboardNav: false,
  };

  /** AbortController used to remove every listener in one call on destroy(). */
  let controller = null;

  /** MediaQueryList for prefers-color-scheme, kept so we can re-read it. */
  let themeMediaQuery = null;

  // ===========================================================================
  // Logging — every message is prefixed and never throws.
  // ===========================================================================

  function log(level, ...args) {
    try {
      const method = typeof console[level] === "function" ? level : "log";
      console[method](LOG_PREFIX, ...args);
    } catch (err) {
      // Logging must never break the caller.
    }
  }

  // ===========================================================================
  // Bridge access — app.js NEVER touches window.Android / window.AndroidBridge
  // directly. Every native action goes through window.MarudharaAndroidBridge.
  // ===========================================================================

  function getBridge() {
    return window.MarudharaAndroidBridge || null;
  }

  function refreshBridgeAvailability() {
    const bridge = getBridge();
    state.bridgeAvailable = !!(bridge && typeof bridge.call === "function");
    state.android = !!(bridge && typeof bridge.isAndroid === "function" && bridge.isAndroid());
    return state.bridgeAvailable;
  }

  /**
   * Safely invokes a method on the bridge. Never throws — any failure
   * (missing bridge, native rejection) is caught and logged internally.
   *
   * @param {string} method - Name of the public MarudharaAndroidBridge method.
   * @param {...*} args
   * @returns {Promise<*>}
   */
  function safeBridgeCall(method, ...args) {
    try {
      const bridge = getBridge();
      if (!bridge || typeof bridge[method] !== "function") {
        log("warn", `Bridge method "${method}" is unavailable.`);
        return Promise.resolve(undefined);
      }
      return Promise.resolve(bridge[method](...args)).catch((err) => {
        log("error", `Bridge call "${method}" failed:`, err && err.message ? err.message : err);
        return undefined;
      });
    } catch (err) {
      log("error", `Bridge call "${method}" threw:`, err && err.message ? err.message : err);
      return Promise.resolve(undefined);
    }
  }

  function toast(message) {
    return safeBridgeCall("toast", message);
  }

  // ===========================================================================
  // Listener helper — centralizes passive defaults + AbortController signal
  // so destroy() can remove everything with a single controller.abort().
  // ===========================================================================

  function on(target, type, handler, options) {
    if (!controller || !target || typeof target.addEventListener !== "function") {
      return;
    }
    const opts = Object.assign({ passive: true }, options, { signal: controller.signal });
    try {
      target.addEventListener(type, handler, opts);
      state.listenerCount += 1;
    } catch (err) {
      log("error", `Failed to attach "${type}" listener:`, err && err.message ? err.message : err);
    }
  }

  // ===========================================================================
  // Page helpers
  // ===========================================================================

  /**
   * Home page is served at "/" or "/index.html" (see loader.js detection
   * and the site's root index.html). Every other page (mock-tests, omr,
   * results, admin, downloads, etc.) is not the home page.
   */
  function isHomePage() {
    try {
      const path = window.location.pathname.replace(/\/index\.html$/i, "/");
      return path === "/" || path === "";
    } catch (err) {
      return false;
    }
  }

  function closestAnchor(target) {
    if (!target || typeof target.closest !== "function") {
      return null;
    }
    return target.closest("a[href]");
  }

  function isPdfUrl(href) {
    return /\.pdf(?:[?#].*)?$/i.test(href);
  }

  function isDownloadAnchor(anchor) {
    return (
      anchor.hasAttribute("download") ||
      anchor.classList.contains("download-btn")
    );
  }

  function isSameOrigin(url) {
    try {
      return url.hostname === window.location.hostname;
    } catch (err) {
      return true;
    }
  }

  function guessFilename(url) {
    try {
      const parts = url.pathname.split("/");
      return decodeURIComponent(parts[parts.length - 1] || "download");
    } catch (err) {
      return "download";
    }
  }

  // ===========================================================================
  // Feature 1 — Double Back To Exit (Home page only)
  // ===========================================================================

  function pushBackGuard() {
    try {
      history.pushState({ __marudharaBackGuard: true }, "", window.location.href);
    } catch (err) {
      log("error", "Unable to push back-guard history state:", err && err.message ? err.message : err);
    }
  }

  function handleHomeBackPress() {
    const now = Date.now();

    if (now - state.lastBackPressAt <= DOUBLE_BACK_EXIT_WINDOW_MS) {
      // Second press within the window — exit the app.
      safeBridgeCall("call", "exitApp");
      return;
    }

    // First press — warn and stay on the page.
    state.lastBackPressAt = now;
    toast("Press again to exit");
    pushBackGuard();
  }

  function handlePopState(event) {
    if (!isHomePage()) {
      return;
    }
    if (!event.state || !event.state.__marudharaBackGuard) {
      return;
    }
    handleHomeBackPress();
  }

  /**
   * Some native shells dispatch a DOM CustomEvent instead of relying on
   * browser history (e.g. "androidbackbutton"). Listening for it is a
   * harmless, additive hook: if the native layer never dispatches it,
   * this simply never fires and the popstate-based guard above still
   * handles the gesture.
   */
  function handleNativeBackEvent(event) {
    if (!isHomePage()) {
      return;
    }
    if (typeof event.preventDefault === "function") {
      event.preventDefault();
    }
    handleHomeBackPress();
  }

  function setupDoubleBackToExit() {
    if (!isHomePage()) {
      return;
    }
    pushBackGuard();
    on(window, "popstate", handlePopState, { passive: true });
    on(document, "androidbackbutton", handleNativeBackEvent, { passive: false });
  }

  // ===========================================================================
  // Feature 2/3/4 — External links, PDF links, Downloads
  // Feature 5/6 — Share / Copy buttons (data-attribute hooks)
  // All handled through a single delegated click listener.
  // ===========================================================================

  function handleShareTrigger(el) {
    const payload = {
      title: el.getAttribute("data-share-title") || document.title,
      text: el.getAttribute("data-share-text") || "",
      url: el.getAttribute("data-share-url") || window.location.href,
    };
    safeBridgeCall("share", payload);
  }

  function handleCopyTrigger(el) {
    let text = el.getAttribute("data-android-copy");
    if (!text) {
      const targetId = el.getAttribute("data-copy-target");
      const targetEl = targetId ? document.getElementById(targetId) : null;
      text = targetEl ? targetEl.textContent.trim() : el.textContent.trim();
    }
    safeBridgeCall("copy", text);
  }

  function handleDocumentClick(event) {
    if (event.defaultPrevented || event.button !== 0) {
      return;
    }
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }

    const target = event.target;

    // Share / Copy hooks — these can live on any clickable element, not
    // only anchors, so they are checked before the anchor-only logic.
    const shareEl = target.closest ? target.closest("[data-android-share]") : null;
    if (shareEl) {
      event.preventDefault();
      handleShareTrigger(shareEl);
      return;
    }

    const copyEl = target.closest ? target.closest("[data-android-copy], [data-copy-target]") : null;
    if (copyEl) {
      event.preventDefault();
      handleCopyTrigger(copyEl);
      return;
    }

    const anchor = closestAnchor(target);
    if (!anchor) {
      return;
    }

    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) {
      return;
    }

    let url;
    try {
      url = new URL(href, window.location.href);
    } catch (err) {
      return;
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return;
    }

    // Downloads take priority over generic PDF viewing.
    if (isDownloadAnchor(anchor)) {
      event.preventDefault();
      safeBridgeCall("download", url.href, guessFilename(url));
      return;
    }

    if (isPdfUrl(url.pathname)) {
      event.preventDefault();
      safeBridgeCall("openPdf", url.href);
      return;
    }

    if (!isSameOrigin(url)) {
      event.preventDefault();
      safeBridgeCall("openExternal", url.href);
    }
  }

  function setupLinkInterception() {
    on(document, "click", handleDocumentClick, { passive: false, capture: true });
  }

  // ===========================================================================
  // Feature 7 — Online / Offline
  // ===========================================================================

  function handleOnline() {
    state.online = true;
    toast("Connection Restored");
  }

  function handleOffline() {
    state.online = false;
    toast("No Internet Connection");
  }

  function setupConnectivity() {
    state.online = typeof navigator.onLine === "boolean" ? navigator.onLine : true;
    on(window, "online", handleOnline, { passive: true });
    on(window, "offline", handleOffline, { passive: true });
  }

  // ===========================================================================
  // Feature 8 — Visibility  &  Feature 10 — Android Resume (lightweight only)
  // ===========================================================================

  function handleVisibilityChange() {
    state.visibility = document.visibilityState;
    if (state.visibility === "visible") {
      refreshLightweightUi();
    }
  }

  function handlePageShow(event) {
    state.visibility = "visible";
    if (event.persisted) {
      refreshLightweightUi();
    }
  }

  function handlePageHide() {
    state.visibility = "hidden";
  }

  function setupVisibility() {
    state.visibility = document.visibilityState || "visible";
    on(document, "visibilitychange", handleVisibilityChange, { passive: true });
    on(window, "pageshow", handlePageShow, { passive: true });
    on(window, "pagehide", handlePageHide, { passive: true });
  }

  // ===========================================================================
  // Feature 9 — Focus / Blur
  // ===========================================================================

  function handleWindowFocus() {
    state.focused = true;
  }

  function handleWindowBlur() {
    state.focused = false;
  }

  function setupFocusTracking() {
    on(window, "focus", handleWindowFocus, { passive: true });
    on(window, "blur", handleWindowBlur, { passive: true });
  }

  // ===========================================================================
  // Feature 12 — Theme (status only, never touches CSS)
  // ===========================================================================

  function readTheme() {
    return themeMediaQuery && themeMediaQuery.matches ? "dark" : "light";
  }

  function handleThemeChange() {
    state.theme = readTheme();
  }

  function setupTheme() {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    themeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    state.theme = readTheme();
    on(themeMediaQuery, "change", handleThemeChange, { passive: true });
  }

  // ===========================================================================
  // Feature 13 — Accessibility (keyboard navigation, no HTML modification)
  // Toggles a class on <html> only — the same technique loader.js already
  // uses for "android-app" — so :focus-visible-style rules in app.css can
  // react to keyboard users without ever touching page markup.
  // ===========================================================================

  function handleKeydownForA11y(event) {
    if (event.key === "Tab" && !state.keyboardNav) {
      state.keyboardNav = true;
      document.documentElement.classList.add("android-keyboard-nav");
    }
  }

  function handleMousedownForA11y() {
    if (state.keyboardNav) {
      state.keyboardNav = false;
      document.documentElement.classList.remove("android-keyboard-nav");
    }
  }

  function setupAccessibility() {
    on(document, "keydown", handleKeydownForA11y, { passive: true });
    on(document, "mousedown", handleMousedownForA11y, { passive: true });
  }

  // ===========================================================================
  // Lightweight refresh — re-reads ambient status only. Never reloads,
  // never re-fetches page content, never touches business logic.
  // ===========================================================================

  function refreshLightweightUi() {
    try {
      state.online = typeof navigator.onLine === "boolean" ? navigator.onLine : state.online;
      state.visibility = document.visibilityState || state.visibility;
      state.theme = readTheme();
      refreshBridgeAvailability();
    } catch (err) {
      log("error", "refresh() failed:", err && err.message ? err.message : err);
    }
  }

  // ===========================================================================
  // Public API — window.MarudharaAndroidApp
  // ===========================================================================

  const MarudharaAndroidApp = {
    /** Internal: guards against re-initialization of this IIFE. */
    __initialized: true,

    /**
     * Initializes every Android UI feature exactly once. Safe to call
     * multiple times — subsequent calls are no-ops.
     *
     * @returns {void}
     */
    initialize() {
      if (state.initialized && !state.destroyed) {
        return;
      }

      try {
        controller = new AbortController();
        state.destroyed = false;

        refreshBridgeAvailability();
        setupDoubleBackToExit();
        setupLinkInterception();
        setupConnectivity();
        setupVisibility();
        setupFocusTracking();
        setupTheme();
        setupAccessibility();

        state.initialized = true;
        log("log", `Initialized (v${VERSION}). Android: ${state.android}, bridge: ${state.bridgeAvailable}.`);
      } catch (err) {
        log("error", "Initialization failed:", err && err.message ? err.message : err);
      }
    },

    /**
     * Removes every listener registered by this controller and resets
     * internal state so initialize() can safely run again later.
     *
     * @returns {void}
     */
    destroy() {
      try {
        if (controller) {
          controller.abort();
          controller = null;
        }
        state.initialized = false;
        state.destroyed = true;
        state.listenerCount = 0;
        state.keyboardNav = false;
        document.documentElement.classList.remove("android-keyboard-nav");
        log("log", "Destroyed.");
      } catch (err) {
        log("error", "destroy() failed:", err && err.message ? err.message : err);
      }
    },

    /**
     * Re-reads ambient status (online, visibility, theme, bridge
     * availability) without reloading the page or touching business
     * logic. Intended to be called on Android resume.
     *
     * @returns {void}
     */
    refresh() {
      refreshLightweightUi();
    },

    /**
     * Reserved hook for a future "app update ready" native signal.
     * No behaviour is implemented yet beyond recording the flag and
     * logging — the update UI itself is out of scope for this file.
     *
     * @returns {void}
     */
    notifyUpdateAvailable() {
      state.updateAvailable = true;
      log("log", "Update available notification received.");
    },

    /**
     * Returns a plain snapshot of the controller's current state.
     *
     * @returns {{initialized: boolean, android: boolean, online: boolean,
     *   visibility: string, theme: string, bridgeAvailable: boolean,
     *   listeners: number, version: string}}
     */
    status() {
      return {
        initialized: state.initialized,
        android: state.android,
        online: state.online,
        visibility: state.visibility,
        theme: state.theme,
        bridgeAvailable: state.bridgeAvailable,
        listeners: state.listenerCount,
        version: VERSION,
      };
    },
  };

  window.MarudharaAndroidApp = MarudharaAndroidApp;

  // Automatically initialize once the DOM is ready. If this script is
  // injected after DOMContentLoaded has already fired (the normal case,
  // since loader.js injects it dynamically), initialize immediately.
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => MarudharaAndroidApp.initialize(),
      { once: true }
    );
  } else {
    MarudharaAndroidApp.initialize();
  }
})(window, document);
