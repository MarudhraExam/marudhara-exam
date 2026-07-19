/**
 * android/js/loader.js
 *
 * Marudhara Exam — Android App Loader
 * ------------------------------------
 * This file is ONLY a loader. It is responsible for:
 *   1. Detecting whether the site is running inside the official
 *      Marudhara Exam Android application.
 *   2. If detected, marking the document with an "android-app" class
 *      and loading the Android-specific CSS/JS bundle exactly once,
 *      in a fixed order, using Promises.
 *   3. Exposing a single global API: window.MarudharaAndroidLoader
 *
 * It does NOT:
 *   - touch the DOM beyond adding the "android-app" class
 *   - use MutationObserver, setInterval, or any timers
 *   - inject inline CSS/HTML
 *   - depend on any external library
 *
 * Detection priority:
 *   1. navigator.userAgent contains "MarudharaExamAndroidApp"
 *   2. window.AndroidBridge exists (future-proofing for a native bridge)
 *
 * If neither condition is true, the loader stops immediately and does
 * nothing else — no globals besides the (idle) MarudharaAndroidLoader
 * object are created, and no resources are fetched.
 */

(function initMarudharaAndroidLoader(window, document) {
  "use strict";

  // Guard against double-inclusion of this script itself.
  if (window.MarudharaAndroidLoader && window.MarudharaAndroidLoader.__initialized) {
    return;
  }

  const VERSION = "1.0.0";

  /** Base path where the Android-only assets live. */
  const ANDROID_BASE_PATH = "android/";

  /** Assets to load, in required order: CSS first, then bridge, then app. */
  const ASSETS = [
    { type: "css", path: ANDROID_BASE_PATH + "css/app.css" },
    { type: "js", path: ANDROID_BASE_PATH + "js/bridge.js" },
    { type: "js", path: ANDROID_BASE_PATH + "js/app.js" },
  ];

  /**
   * Detects whether the current environment is the official
   * Marudhara Exam Android application.
   *
   * @returns {boolean} true if running inside the Android app shell.
   */
  function detectAndroidApp() {
    try {
      const ua = window.navigator && window.navigator.userAgent;
      if (typeof ua === "string" && ua.indexOf("MarudharaExamAndroidApp") !== -1) {
        return true;
      }
    } catch (err) {
      // navigator.userAgent should always be available, but fail safe.
    }

    // Future-proofing: if a native bridge object is injected by the
    // Android WebView, treat that as a valid detection signal too.
    if (typeof window.AndroidBridge !== "undefined" && window.AndroidBridge !== null) {
      return true;
    }

    return false;
  }

  /**
   * Loads a single CSS file by appending a <link> tag and resolving
   * once it has loaded (or rejecting on error).
   *
   * @param {string} href
   * @returns {Promise<void>}
   */
  function loadCss(href) {
    return new Promise((resolve, reject) => {
      // Prevent duplicate loading if the same stylesheet is already present.
      const existing = document.querySelector(
        `link[rel="stylesheet"][href="${href}"]`
      );
      if (existing) {
        resolve();
        return;
      }

      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;

      link.onload = () => resolve();
      link.onerror = () => reject(new Error(`Failed to load stylesheet: ${href}`));

      document.head.appendChild(link);
    });
  }

  /**
   * Loads a single JS file by appending a <script> tag and resolving
   * once it has executed (or rejecting on error).
   *
   * @param {string} src
   * @returns {Promise<void>}
   */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      // Prevent duplicate loading if the same script is already present.
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = false; // preserve execution order relative to itself

      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));

      document.head.appendChild(script);
    });
  }

  /**
   * Loads a single asset descriptor ({ type, path }) using the
   * appropriate loader function.
   *
   * @param {{type: string, path: string}} asset
   * @returns {Promise<void>}
   */
  function loadAsset(asset) {
    if (asset.type === "css") {
      return loadCss(asset.path);
    }
    return loadScript(asset.path);
  }

  /**
   * Sequentially loads all Android assets in the required order.
   * A failure on any single asset is logged but does not stop the
   * remaining assets from being attempted, and never throws back
   * into the host page.
   *
   * @returns {Promise<void>}
   */
  function loadAssetsInOrder() {
    return ASSETS.reduce((chain, asset) => {
      return chain.then(() =>
        loadAsset(asset).catch((err) => {
          // Log and continue — a single failed resource must not
          // break the rest of the website.
          console.error(`[MarudharaAndroidLoader] ${err.message}`);
        })
      );
    }, Promise.resolve());
  }

  /**
   * Public loader object. Exposed as window.MarudharaAndroidLoader.
   */
  const MarudharaAndroidLoader = {
    /** Loader version. */
    version: VERSION,

    /** Whether the Android bundle has finished its load attempt. */
    loaded: false,

    /** Whether the current environment was detected as the Android app. */
    isAndroid: detectAndroidApp(),

    /** Internal: guards against re-initialization of this IIFE. */
    __initialized: true,

    /** Internal: in-flight load promise, used to prevent duplicate loads. */
    __loadPromise: null,

    /**
     * Loads the Android CSS/JS bundle (app.css, bridge.js, app.js) in
     * order, exactly once. Safe to call multiple times — subsequent
     * calls return the same in-flight/completed promise.
     *
     * @returns {Promise<void>}
     */
    load() {
      if (!this.isAndroid) {
        return Promise.resolve();
      }

      if (this.__loadPromise) {
        return this.__loadPromise;
      }

      document.documentElement.classList.add("android-app");
      document.body.classList.add("android-app");

      this.__loadPromise = loadAssetsInOrder().then(() => {
        this.loaded = true;
      });

      return this.__loadPromise;
    },

    /**
     * Returns a snapshot of the loader's current state.
     *
     * @returns {{version: string, isAndroid: boolean, loaded: boolean}}
     */
    status() {
      return {
        version: this.version,
        isAndroid: this.isAndroid,
        loaded: this.loaded,
      };
    },
  };

  window.MarudharaAndroidLoader = MarudharaAndroidLoader;

  // If not running inside the Android app, stop immediately.
  // Nothing further is done — no DOM changes, no resource loading.
  if (!MarudharaAndroidLoader.isAndroid) {
    return;
  }

  // Kick off the load automatically once detected.
  MarudharaAndroidLoader.load();
})(window, document);
