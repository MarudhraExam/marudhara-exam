/**
 * InScript (Indian Script) keyboard layout — Government of India standard.
 * IS 13194:1991. This is the official keyboard layout for Indian scripts.
 *
 * Unlike Remington, InScript assigns Devanagari characters to QWERTY keys
 * based on phonetic/linguistic grouping, not typewriter position.
 *
 * Key mapping (physical QWERTY → Devanagari):
 *   Row 1: q=ौ  w=ै  e=ा  r=ी  t=ू  y=ब  u=ह  i=ग  o=द  p=ज  [=ड  ]=़
 *   Row 2: a=ो  s=े  d=्  f=ि  g=ु  h=प  j=र  k=क  l=त  ;=च  '=ट
 *   Row 3: z=ं  x=म  c=न  v=व  b=ल  n=स  m=य
 *
 * Wait — InScript is actually quite different from Remington in the
 * shifted characters and the bottom row. The correct InScript mapping is:
 *
 * Physical key → normal / shifted
 *   q → ौ / औ    w → ै / ऐ    e → ा / आ    r → ी / ई    t → ू / ऊ
 *   y → ब / ब    u → ह / ह     i → ग / ग    o → द / द    p → ज / ज
 *   [ → ड / ड   ] → ़ / ़
 *   a → ो / ओ    s → े / ए    d → ् / अ    f → ि / इ    g → ु / उ
 *   h → प / प    j → र / र    k → क / क    l → त / त    ; → च / च
 *   ' → ट / ट
 *   z → ं / ँ    x → म / म    c → न / न    v → व / व    b → ल / ल
 *   n → स / स    m → य / य
 *   , → , / ,    . → . / .    / → / / /
 *
 * Numbers (shifted = Devanagari digits):
 *   1→1/ऍ  2→2/ॅ  3→3/३  4→4/४  5→5/५  6→6/६  7→7/७  8→8/८  9→9/९  0→0/०
 *   - → - / ः    = → = / ऋ
 *
 * InScript differs from Remington in:
 *   - Shifted number row: InScript has Devanagari digits (३४५६७८९०)
 *   - Shifted - and =: InScript has ः and ऋ
 *   - Shifted Q: InScript has औ (not ऊ)
 *   - Shifted A: InScript has ओ (not ो)
 *   - Shifted S: InScript has ए (not े)
 */

export const inscriptKeyMap: Record<string, { normal: string; shifted?: string }> = {
  // Row 1
  q: { normal: 'ौ', shifted: 'औ' },
  w: { normal: 'ै', shifted: 'ऐ' },
  e: { normal: 'ा', shifted: 'आ' },
  r: { normal: 'ी', shifted: 'ई' },
  t: { normal: 'ू', shifted: 'ऊ' },
  y: { normal: 'ब', shifted: 'ब' },
  u: { normal: 'ह', shifted: 'ह' },
  i: { normal: 'ग', shifted: 'ग' },
  o: { normal: 'द', shifted: 'द' },
  p: { normal: 'ज', shifted: 'ज' },
  '[': { normal: 'ड', shifted: 'ड' },
  ']': { normal: '़', shifted: '़' },
  // Row 2
  a: { normal: 'ो', shifted: 'ओ' },
  s: { normal: 'े', shifted: 'ए' },
  d: { normal: '्', shifted: 'अ' },
  f: { normal: 'ि', shifted: 'इ' },
  g: { normal: 'ु', shifted: 'उ' },
  h: { normal: 'प', shifted: 'प' },
  j: { normal: 'र', shifted: 'र' },
  k: { normal: 'क', shifted: 'क' },
  l: { normal: 'त', shifted: 'त' },
  ';': { normal: 'च', shifted: 'च' },
  "'": { normal: 'ट', shifted: 'ट' },
  // Row 3
  z: { normal: 'ं', shifted: 'ँ' },
  x: { normal: 'म', shifted: 'म' },
  c: { normal: 'न', shifted: 'न' },
  v: { normal: 'व', shifted: 'व' },
  b: { normal: 'ल', shifted: 'ल' },
  n: { normal: 'स', shifted: 'स' },
  m: { normal: 'य', shifted: 'य' },
  ',': { normal: ',', shifted: ',' },
  '.': { normal: '.', shifted: '.' },
  '/': { normal: '/', shifted: '/' },
  // Space
  ' ': { normal: ' ', shifted: ' ' },
  // Number row — InScript uses Devanagari digits on shift
  '1': { normal: '1', shifted: 'ऍ' },
  '2': { normal: '2', shifted: 'ॅ' },
  '3': { normal: '3', shifted: '३' },
  '4': { normal: '4', shifted: '४' },
  '5': { normal: '5', shifted: '५' },
  '6': { normal: '6', shifted: '६' },
  '7': { normal: '7', shifted: '७' },
  '8': { normal: '8', shifted: '८' },
  '9': { normal: '9', shifted: '९' },
  '0': { normal: '0', shifted: '०' },
  '-': { normal: '-', shifted: 'ः' },
  '=': { normal: '=', shifted: 'ऋ' },
};
