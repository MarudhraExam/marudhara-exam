/**
 * Kruti Dev 010 ↔ Unicode Devanagari converter.
 *
 * Kruti Dev 010 is a legacy non-Unicode font. It uses ASCII code positions
 * to represent Devanagari glyphs. To display Kruti Dev text in a browser
 * without the actual font installed, we convert to Unicode for display.
 *
 * This mapping table covers the common Remington-typed characters.
 * It maps Kruti Dev ASCII characters to their Unicode Devanagari equivalents.
 *
 * The full Kruti Dev 010 encoding has many entries; this covers the core
 * Remington typing set. Additional glyphs can be added to this table
 * without changing the converter logic.
 */

// Kruti Dev ASCII char → Unicode Devanagari
const krutiToUnicode: Record<string, string> = {
  // Consonants
  k: 'क', K: 'क्ष',
  i: 'ग', I: 'घ',
  u: 'ह',
  y: 'ब', Y: 'ब',
  o: 'द', O: 'द',
  p: 'ज', P: 'ज्ञ',
  j: 'र', J: 'ऋ',
  l: 'त', L: 'त्र',
  ';': 'च', ':': 'छ',
  "'": 'ट', '"': 'ठ',
  v: 'व', V: 'व',
  h: 'प', H: 'प',
  x: 'म', X: 'म',
  c: 'न', C: 'ण',
  b: 'ल', B: 'ल',
  n: 'स', N: 'स',
  m: 'य', M: 'य',
  // Vowels and matras
  e: 'ा', E: 'आ',
  r: 'ी', R: 'ई',
  f: 'ि', F: 'इ',
  g: 'ु', G: 'उ',
  t: 'ू', T: 'ऊ',
  a: 'ो', A: 'ओ',
  s: 'े', S: 'ए',
  w: 'ै', W: 'ऐ',
  q: 'ौ', Q: 'औ',
  d: '्', D: 'अ',
  z: 'ं', Z: 'ँ',
  // Special
  '[': 'ड', '{': 'ढ',
  ']': '़', '}': '़',
  // Danda
  '.': '.', '>': '।',
  ',': ',', '<': '॥',
  // Numbers
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
  '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  // Space and punctuation
  ' ': ' ',
  '-': '-', '_': '-',
  '=': '=', '+': '+',
  '/': '/', '?': '?',
};

// Reverse map: Unicode Devanagari → Kruti Dev ASCII
const unicodeToKruti: Record<string, string> = {};
for (const [kruti, uni] of Object.entries(krutiToUnicode)) {
  if (!unicodeToKruti[uni]) unicodeToKruti[uni] = kruti;
}

export function krutiToUnicodeStr(krutiText: string): string {
  let result = '';
  for (const ch of krutiText) {
    result += krutiToUnicode[ch] ?? ch;
  }
  return result;
}

export function unicodeToKrutiStr(unicodeText: string): string {
  let result = '';
  for (const ch of unicodeText) {
    result += unicodeToKruti[ch] ?? ch;
  }
  return result;
}

export function krutiCharToUnicode(ch: string): string {
  return krutiToUnicode[ch] ?? ch;
}

export { krutiToUnicode, unicodeToKruti };
