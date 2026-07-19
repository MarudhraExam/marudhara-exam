/**
 * android/js/bridge.js
 *
 * Marudhara Exam — Android Communication Bridge
 * ------------------------------------------------
 * This file is ONLY a communication layer between the website and the
 * native Marudhara Exam Android application. It is loaded by
 * android/js/loader.js after android/css/app.css and before
 * android/js/app.js.
 *
 * Responsibility:
 *   Website  → Android App   (send requests / commands)
 *   Android App → Website    (query state / receive responses)
 *
 * This file must NEVER contain:
 *   - UI code, CSS, or HTML
 *   - DOM modifications
 *   - MutationObserver, setInterval, or setTimeout
 *   - Layout, styling, animation, or responsive logic
 *   - Business logic (auth, payments, mock tests, results, admin, etc.)
 *
 * Only one global is exposed: window.MarudharaAndroidBridge
 */

(function initMarudharaAndroidBridge(window) {
  "use strict";

  // Guard against duplicate initialization of this script itself.
  if (window.MarudharaAndroidBridge && window.MarudharaAndroidBridge.__initialized) {
    return;
  }

  const VERSION = "1.0.0";
  const LOG_PREFIX = "[MarudharaAndroidBridge]";
  const DEFAULT_CALL_TIMEOUT_MS = 10000;

  /**
   * Internal state for the bridge.
   * - initialized: whether initialize() has completed at least once.
   * - connected: whether a native bridge object was found and is usable.
   * - androidDetected: whether the current environment is the Android app.
   * - bridgeAvailable: whether a native bridge object (AndroidBridge/Android)
   *   is currently reachable on window.
   */
  const state = {
    initialized: false,
    connected: false,
    androidDetected: false,
    bridgeAvailable: false,
  };

  /**
   * Logs a message to the console, always prefixed for easy filtering.
   *
   * @param {"log"|"warn"|"error"} level
   * @param {...*} args
   */
  function log(level, ...args) {
    try {
      const method = typeof console[level] === "function" ? level : "log";
      console[method](LOG_PREFIX, ...args);
    } catch (err) {
      // Logging must never throw or break the caller.
    }
  }

  /**
   * Detects whether the current environment is the official
   * Marudhara Exam Android application.
   *
   * @returns {boolean}
   */
  function detectAndroid() {
    try {
      const ua = window.navigator && window.navigator.userAgent;
      if (typeof ua === "string" && ua.indexOf("MarudharaExamAndroidApp") !== -1) {
        return true;
      }
    } catch (err) {
      // navigator.userAgent should always be available, but fail safe.
    }

    if (typeof window.AndroidBridge !== "undefined" && window.AndroidBridge !== null) {
      return true;
    }

    if (typeof window.Android !== "undefined" && window.Android !== null) {
      return true;
    }

    return false;
  }

  /**
   * Resolves the currently available native bridge object, supporting
   * both known native bridge styles:
   *   - window.AndroidBridge
   *   - window.Android
   *
   * @returns {object|null} The native bridge object, or null if none found.
   */
  function resolveNativeBridge() {
    if (typeof window.AndroidBridge !== "undefined" && window.AndroidBridge !== null) {
      return window.AndroidBridge;
    }

    if (typeof window.Android !== "undefined" && window.Android !== null) {
      return window.Android;
    }

    return null;
  }

  /**
   * Attempts to parse a value returned from the native layer as JSON.
   * Native bridges commonly return plain strings; if the string is
   * valid JSON it is parsed, otherwise the raw value is returned as-is.
   *
   * @param {*} value
   * @returns {*}
   */
  function parseNativeResult(value) {
    if (typeof value !== "string") {
      return value;
    }

    try {
      return JSON.parse(value);
    } catch (err) {
      return value;
    }
  }

  /**
   * Safely invokes a method on the native bridge object, supporting a
   * few common calling conventions without assuming a specific native
   * implementation:
   *   1. native[method](payload)      — direct named method
   *   2. native.call(method, payload) — generic dispatcher
   *   3. native.invoke(method, payload) — alternate generic dispatcher
   *
   * @param {object} native - The resolved native bridge object.
   * @param {string} method - The method/action name.
   * @param {*} [payload] - Optional payload to forward.
   * @returns {*} The raw return value from the native call.
   * @throws {Error} If no compatible calling convention is found.
   */
  function invokeNative(native, method, payload) {
    let payloadJson;

    if (payload !== undefined) {
      try {
        payloadJson = JSON.stringify(payload);
      } catch (err) {
        throw new Error("Payload is not JSON serializable.");
      }
    }

    if (typeof native[method] === "function") {
      return payloadJson === undefined ? native[method]() : native[method](payloadJson);
    }

    if (typeof native.call === "function") {
      return native.call(method, payloadJson);
    }

    if (typeof native.invoke === "function") {
      return native.invoke(method, payloadJson);
    }

    throw new Error(`Native method "${method}" is not supported by the bridge.`);
  }

  /**
   * Generic, safe entry point for calling into the native Android layer.
   * Never throws — always resolves or rejects the returned Promise.
   *
   * @param {string} method - The method/action name to invoke natively.
   * @param {*} [payload] - Optional JSON-serializable payload.
   * @param {number} [timeoutMs] - Maximum time to wait for a native
   *   response before rejecting. Defaults to DEFAULT_CALL_TIMEOUT_MS.
   * @returns {Promise<*>} Resolves with the (parsed) native result, or
   *   rejects with a meaningful Error if the bridge is unavailable, the
   *   call fails, or the call times out.
   */
  function call(method, payload, timeoutMs) {
    return new Promise((resolve, reject) => {
      let settled = false;

      const timeoutId = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        reject(new Error("Native bridge call timed out."));
      }, typeof timeoutMs === "number" ? timeoutMs : DEFAULT_CALL_TIMEOUT_MS);

      const settle = (fn, value) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutId);
        fn(value);
      };

      try {
        if (typeof method !== "string" || method.length === 0) {
          settle(reject, new Error("A valid method name is required."));
          return;
        }

        const native = resolveNativeBridge();

        if (!native) {
          settle(reject, new Error(`Native bridge is unavailable. Cannot call "${method}".`));
          return;
        }

        const result = invokeNative(native, method, payload);
        settle(resolve, parseNativeResult(result));
      } catch (err) {
        log("error", `call("${method}") failed:`, err && err.message ? err.message : err);
        settle(reject, err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  /**
   * Initializes the bridge. Detects the Android environment and the
   * native bridge object, and updates internal state accordingly.
   * Safe to call multiple times; subsequent calls are no-ops beyond
   * refreshing availability state.
   *
   * @returns {void}
   */
  function initialize() {
    try {
      state.androidDetected = detectAndroid();
      state.bridgeAvailable = resolveNativeBridge() !== null;
      state.connected = state.androidDetected && state.bridgeAvailable;

      if (!state.initialized) {
        state.initialized = true;
        log("log", `Initialized (v${VERSION}). Android detected: ${state.androidDetected}, bridge available: ${state.bridgeAvailable}.`);
      }
    } catch (err) {
      log("error", "Initialization failed:", err && err.message ? err.message : err);
    }
  }

  /**
   * Public bridge API. Exposed as window.MarudharaAndroidBridge.
   */
  const MarudharaAndroidBridge = {
    /** Internal: guards against re-initialization of this IIFE. */
    __initialized: true,

    /**
     * Whether the current environment is the official Android app.
     *
     * @returns {boolean}
     */
    isAndroid() {
      return state.androidDetected;
    },

    /**
     * Whether a native bridge object is currently reachable.
     *
     * @returns {boolean}
     */
    isBridgeAvailable() {
      return state.bridgeAvailable;
    },

    /**
     * Initializes the bridge. Safe to call multiple times.
     *
     * @returns {Promise<void>}
     */
    initialize() {
      return Promise.resolve(initialize());
    },

    /**
     * Returns a snapshot of the bridge's current state.
     *
     * @returns {{version: string, initialized: boolean, connected: boolean,
     *   androidDetected: boolean, bridgeAvailable: boolean, capabilities: object}}
     */
    status() {
      return {
        version: VERSION,
        initialized: state.initialized,
        connected: state.connected,
        androidDetected: state.androidDetected,
        bridgeAvailable: state.bridgeAvailable,
        capabilities: {
          download: true,
          share: true,
          toast: true,
          copy: true,
          vibrate: true,
          openExternal: true,
          openPdf: true,
          openIntent: true,
          getAppVersion: true,
          getDeviceInfo: true,
          isOnline: true,
        },
      };
    },

    /**
     * Generic method for safely calling into the native Android layer.
     *
     * @param {string} method - The native method/action name.
     * @param {*} [payload] - Optional JSON-serializable payload.
     * @returns {Promise<*>} Resolves with the native result, or rejects
     *   with a meaningful Error if the bridge is unavailable.
     */
    call(method, payload) {
      return call(method, payload);
    },

    /**
     * Requests the Android app to download a file. No browser download
     * logic is performed here — the request is only forwarded natively.
     *
     * @param {string} url - The URL of the file to download.
     * @param {string} filename - The suggested filename.
     * @returns {Promise<*>}
     */
    download(url, filename) {
      return call("download", { url, filename });
    },

    /**
     * Forwards a share request to the native Android share sheet.
     *
     * @param {object} data - Share payload (e.g. { title, text, url }).
     * @returns {Promise<*>}
     */
    share(data) {
      return call("share", data);
    },

    /**
     * Asks the Android app to show a native Toast message.
     *
     * @param {string} message - The message to display.
     * @returns {Promise<*>}
     */
    toast(message) {
      return call("toast", { message });
    },

    /**
     * Copies text to the clipboard via the native layer.
     *
     * @param {string} text - The text to copy.
     * @returns {Promise<*>}
     */
    copy(text) {
      return call("copy", { text });
    },

    /**
     * Asks the Android app to vibrate the device.
     *
     * @param {number} milliseconds - Vibration duration in milliseconds.
     * @returns {Promise<*>}
     */
    vibrate(milliseconds) {
      return call("vibrate", { milliseconds });
    },

    /**
     * Requests the Android app to open a URL outside the WebView,
     * in the device's external browser.
     *
     * @param {string} url - The URL to open externally.
     * @returns {Promise<*>}
     */
    openExternal(url) {
      return call("openExternal", { url });
    },

    /**
     * Requests the Android app to open a URL in the native PDF viewer.
     *
     * @param {string} url - The URL of the PDF document.
     * @returns {Promise<*>}
     */
    openPdf(url) {
      return call("openPdf", { url });
    },

    /**
     * Generic native intent launcher.
     *
     * @param {string} action - The native intent/action identifier.
     * @param {*} [payload] - Optional JSON-serializable payload.
     * @returns {Promise<*>}
     */
    openIntent(action, payload) {
      return call("openIntent", { action, payload });
    },

    /**
     * Retrieves the installed Android app version.
     *
     * @returns {Promise<*>}
     */
    getAppVersion() {
      return call("getAppVersion");
    },

    /**
     * Retrieves native device information.
     *
     * @returns {Promise<*>}
     */
    getDeviceInfo() {
      return call("getDeviceInfo");
    },

    /**
     * Checks whether the device currently has network connectivity,
     * as reported by the native layer.
     *
     * @returns {Promise<*>}
     */
    isOnline() {
      return call("isOnline");
    },
  };

  window.MarudharaAndroidBridge = MarudharaAndroidBridge;

  // Auto-initialize once, immediately upon script execution.
  initialize();
})(window);
