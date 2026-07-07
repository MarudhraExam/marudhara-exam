/**
 * Noto Sans Devanagari — reusable Unicode font loader for jsPDF.
 * -----------------------------------------------------------------------
 * This module fetches a genuine Unicode-compatible Devanagari font
 * (Noto Sans Devanagari, served from Google's official static font CDN)
 * and embeds it into any jsPDF document so that Hindi text renders
 * correctly instead of blank boxes (□) or corrupted glyphs.
 *
 * The font is also a full Google "Noto Sans" build, so it includes the
 * Latin character set as well — meaning English text can safely use the
 * same embedded font without any visual mismatch.
 *
 * USAGE (from any page/script in this project):
 *   <script src="fonts/noto-devanagari.js"></script>
 *   ...
 *   const fontAlias = await window.NotoDevanagariFont.embed(docPdfInstance);
 *   docPdfInstance.setFont(fontAlias, 'normal');
 *   docPdfInstance.text('नमस्ते / Hello', x, y);
 *
 * The font bytes are fetched once and cached in memory for the lifetime
 * of the page, so repeated PDF generations (or multiple PDFs on the same
 * page) do not re-download the font.
 *
 * This file has no dependency on any other script on the page other than
 * jsPDF itself (passed in as an argument), so it can be reused by any
 * future PDF feature in this project without modification.
 */
(function (global) {
  'use strict';

  // Official Google Fonts static asset URL for Noto Sans Devanagari
  // (Regular, weight 400). This is Google's permanent, versioned static
  // hosting — the same URL your browser would load if you used
  // `@import url(https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari&display=swap);`
  // in a stylesheet.
  const FONT_URL = 'https://fonts.gstatic.com/s/notosansdevanagari/v30/TuGoUUFzXI5FBtUq5a8bjKYTZjtRU6Sgv3NaV_SNmI0b8QQCQmHn6B2OHjbL_08AlXQly-A.ttf';
  const FONT_VFS_FILENAME = 'NotoSansDevanagari-Regular.ttf';
  const FONT_ALIAS = 'NotoSansDevanagari';

  let cachedBase64 = null;
  let inFlightFetch = null;

  function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000; // avoid call-stack limits on String.fromCharCode
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  function fetchFontBase64() {
    if (cachedBase64) return Promise.resolve(cachedBase64);
    if (inFlightFetch) return inFlightFetch;

    inFlightFetch = fetch(FONT_URL, { mode: 'cors' })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Noto Sans Devanagari font fetch failed with status ' + response.status);
        }
        return response.arrayBuffer();
      })
      .then((buffer) => {
        cachedBase64 = arrayBufferToBase64(buffer);
        inFlightFetch = null;
        return cachedBase64;
      })
      .catch((error) => {
        inFlightFetch = null;
        throw error;
      });

    return inFlightFetch;
  }

  /**
   * Embeds Noto Sans Devanagari into the given jsPDF document instance and
   * registers it under a reusable font alias (both 'normal' and 'bold'
   * styles map to the same regular-weight glyphs, since jsPDF only needs
   * the alias registered under each style it will be asked to use).
   *
   * @param {jsPDF} docPdf - a jsPDF document instance
   * @returns {Promise<string>} resolves with the font alias to pass to setFont()
   */
  async function embed(docPdf) {
    const base64 = await fetchFontBase64();
    docPdf.addFileToVFS(FONT_VFS_FILENAME, base64);
    docPdf.addFont(FONT_VFS_FILENAME, FONT_ALIAS, 'normal');
    docPdf.addFont(FONT_VFS_FILENAME, FONT_ALIAS, 'bold');
    return FONT_ALIAS;
  }

  global.NotoDevanagariFont = {
    embed: embed,
    fontAlias: FONT_ALIAS,
    fontUrl: FONT_URL
  };
})(window);
