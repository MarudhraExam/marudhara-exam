/**
 * Kruti Dev 010 key map.
 *
 * Kruti Dev 010 is a legacy non-Unicode font. The text is stored as ASCII
 * characters in specific code positions that the Kruti Dev font renders as
 * Devanagari glyphs. For example, ASCII 'k' in Kruti Dev 010 renders as 'क',
 * 'i' renders as 'ि' (matra), etc.
 *
 * The physical Remington keyboard layout is used: the user types on QWERTY
 * keys and the Kruti Dev font maps those ASCII codes to Devanagari glyphs.
 *
 * For typing practice we store the passage text in the Kruti Dev ASCII
 * encoding (the actual bytes the font expects), and the user's physical
 * keystrokes are compared against that encoding directly — no Unicode
 * conversion needed during typing. The converter is used only to convert
 * Unicode Devanagari lesson text into Kruti Dev encoding for display/storage.
 *
 * The Remington physical key → Kruti Dev ASCII mapping is essentially
 * identity: the user presses 'k' and the character 'k' is stored, which
 * Kruti Dev renders as 'क'. So the key map is:
 *   physical 'k' → kruti char 'k'  (renders as क)
 *   physical 'i' → kruti char 'i'  (renders as ि matra)
 *   etc.
 *
 * However, some keys differ from plain ASCII because Kruti Dev uses
 * special ASCII positions for certain Devanagari characters.
 */

export const krutiDevKeyMap: Record<string, { normal: string; shifted?: string }> = {
  // In Kruti Dev 010 with Remington layout, physical keys map to ASCII chars
  // that the font renders as Devanagari. The mapping is:
  // q→ौ  w→ै  e→ा  r→ी  t→ू  y→ब  u→ह  i→ग  o→द  p→ज
  // a→ो  s→े  d→्  f→ि  g→ु  h→प  j→र  k→क  l→त  ;→च  '→ट
  // z→ं  x→म  c→न  v→व  b→ल  n→स  m→य
  //
  // In Kruti Dev encoding, these physical keys produce ASCII characters:
  // The Kruti Dev font maps ASCII range 0x21-0x7E to Devanagari glyphs.
  // For typing practice, the "kruti char" IS the physical key itself,
  // because Kruti Dev uses the ASCII code of the physical key.
  //
  // So: physical 'k' → kruti 'k' (font renders क)
  //     physical 'f' → kruti 'f' (font renders ि matra)
  //     physical 'd' → kruti 'd' (font renders halant ्)
  //
  // Shifted keys produce uppercase ASCII which maps to different glyphs:
  // Shift+'d' → 'D' (font renders अ)
  // Shift+'f' → 'F' (font renders इ)
  // Shift+'g' → 'G' (font renders उ)

  // Row 1
  q: { normal: 'q', shifted: 'Q' },
  w: { normal: 'w', shifted: 'W' },
  e: { normal: 'e', shifted: 'E' },
  r: { normal: 'r', shifted: 'R' },
  t: { normal: 't', shifted: 'T' },
  y: { normal: 'y', shifted: 'Y' },
  u: { normal: 'u', shifted: 'U' },
  i: { normal: 'i', shifted: 'I' },
  o: { normal: 'o', shifted: 'O' },
  p: { normal: 'p', shifted: 'P' },
  '[': { normal: '[', shifted: '{' },
  ']': { normal: ']', shifted: '}' },
  // Row 2
  a: { normal: 'a', shifted: 'A' },
  s: { normal: 's', shifted: 'S' },
  d: { normal: 'd', shifted: 'D' },
  f: { normal: 'f', shifted: 'F' },
  g: { normal: 'g', shifted: 'G' },
  h: { normal: 'h', shifted: 'H' },
  j: { normal: 'j', shifted: 'J' },
  k: { normal: 'k', shifted: 'K' },
  l: { normal: 'l', shifted: 'L' },
  ';': { normal: ';', shifted: ':' },
  "'": { normal: "'", shifted: '"' },
  // Row 3
  z: { normal: 'z', shifted: 'Z' },
  x: { normal: 'x', shifted: 'X' },
  c: { normal: 'c', shifted: 'C' },
  v: { normal: 'v', shifted: 'V' },
  b: { normal: 'b', shifted: 'B' },
  n: { normal: 'n', shifted: 'N' },
  m: { normal: 'm', shifted: 'M' },
  ',': { normal: ',', shifted: '<' },
  '.': { normal: '.', shifted: '>' },
  '/': { normal: '/', shifted: '?' },
  // Space
  ' ': { normal: ' ', shifted: ' ' },
  // Number row — Kruti Dev uses ASCII digits normally
  '1': { normal: '1', shifted: '!' },
  '2': { normal: '2', shifted: '@' },
  '3': { normal: '3', shifted: '#' },
  '4': { normal: '4', shifted: '$' },
  '5': { normal: '5', shifted: '%' },
  '6': { normal: '6', shifted: '^' },
  '7': { normal: '7', shifted: '&' },
  '8': { normal: '8', shifted: '*' },
  '9': { normal: '9', shifted: '(' },
  '0': { normal: '0', shifted: ')' },
  '-': { normal: '-', shifted: '_' },
  '=': { normal: '=', shifted: '+' },
};
