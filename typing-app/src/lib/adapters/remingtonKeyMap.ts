/**
 * Remington Gail (also called Remington GAIL) physical key mapping.
 *
 * The user types on a physical QWERTY keyboard. Each physical key maps to
 * a Devanagari Unicode character. This is the layout used for Mangal font
 * Unicode typing in most Indian government exams.
 *
 * Key positions follow the standard QWERTY layout:
 *   Row 0: ` 1 2 3 4 5 6 7 8 9 0 - =
 *   Row 1: q w e r t y u i o p [ ]
 *   Row 2: a s d f g h j k l ; '
 *   Row 3: z x c v b n m , . /
 *
 * In Remington Gail, the mapping is:
 *   q=ौ  w=ै  e=ा  r=ी  t=ू  y=ब  u=ह  i=ग  o=द  p=ज  [=ड  ]=़
 *   a=ो  s=े  d=्  f=ि  g=ु  h=प  j=र  k=क  l=त  ;=च  '=ट
 *   z=ं  x=म  c=न  v=व  b=ल  n=स  m=य  ,=  .=  /=
 *   Shift: Q=ऊ W=ऐ E=आ R=ई T=ऊ  Y=ब U=ह I=ग O=द P=ज [{=ड
 *          A=ो  S=े  D=अ F=इ G=उ H=प J=र K=क L=त :=च "=ट
 *          Z=ँ  X=म  C=न  V=व  B=ल N=स M=य
 *
 * Numbers row (Shift):
 *   1=1 2=2 3=3 4=4 5=5 6=6 7=7 8=8 9=9 0=0
 *   Shift: !=ऍ @=ॅ #=भ $=झ %=घ ^=छ &=ठ *=ड (=ण )=ञ _=ृ +=श
 */

export const remingtonGailKeyMap: Record<string, { normal: string; shifted?: string }> = {
  // Row 1 (qwerty row)
  q: { normal: 'ौ', shifted: 'ऊ' },
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
  // Row 2 (asdf row)
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
  // Row 3 (zxcv row)
  z: { normal: 'ं', shifted: 'ँ' },
  x: { normal: 'म', shifted: 'म' },
  c: { normal: 'न', shifted: 'न' },
  v: { normal: 'व', shifted: 'व' },
  b: { normal: 'ल', shifted: 'ल' },
  n: { normal: 'स', shifted: 'स' },
  m: { normal: 'य', shifted: 'य' },
  ',': { normal: ',', shifted: '।' },
  '.': { normal: '.', shifted: '।' },
  '/': { normal: '/', shifted: '?' },
  // Space
  ' ': { normal: ' ', shifted: ' ' },
  // Number row
  '1': { normal: '1', shifted: 'ऍ' },
  '2': { normal: '2', shifted: 'ॅ' },
  '3': { normal: '3', shifted: 'भ' },
  '4': { normal: '4', shifted: 'झ' },
  '5': { normal: '5', shifted: 'घ' },
  '6': { normal: '6', shifted: 'छ' },
  '7': { normal: '7', shifted: 'ठ' },
  '8': { normal: '8', shifted: 'ड' },
  '9': { normal: '9', shifted: 'ण' },
  '0': { normal: '0', shifted: 'ञ' },
  '-': { normal: '-', shifted: 'ृ' },
  '=': { normal: '=', shifted: 'श' },
};
