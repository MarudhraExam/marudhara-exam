import type { KeyboardLayout } from '@/types';

/**
 * InScript (Indian Script) keyboard layout — IS 13194:1991.
 * Government of India standard layout for Devanagari Unicode typing.
 *
 * Differs from Remington in shifted characters:
 * - Shifted number row: Devanagari digits (३ ४ ५ ६ ७ ८ ९ ०)
 * - Shift+Q = औ (not ऊ), Shift+A = ओ, Shift+S = ए
 * - Shift+- = ः, Shift+= = ऋ
 */
export const inscriptLayout: KeyboardLayout = {
  id: 'inscript',
  name: 'InScript',
  language: 'hindi',
  hindiMode: 'inscript',
  rows: [
    {
      keys: [
        { label: 'ौ', shifted: 'औ', finger: 'left-pinky' },
        { label: '1', shifted: 'ऍ', finger: 'left-pinky' },
        { label: '2', shifted: 'ॅ', finger: 'left-ring' },
        { label: '3', shifted: '३', finger: 'left-middle' },
        { label: '4', shifted: '४', finger: 'left-index' },
        { label: '5', shifted: '५', finger: 'left-index' },
        { label: '6', shifted: '६', finger: 'right-index' },
        { label: '7', shifted: '७', finger: 'right-index' },
        { label: '8', shifted: '८', finger: 'right-middle' },
        { label: '9', shifted: '९', finger: 'right-ring' },
        { label: '0', shifted: '०', finger: 'right-pinky' },
        { label: '-', shifted: 'ः', finger: 'right-pinky' },
        { label: '=', shifted: 'ऋ', finger: 'right-pinky' },
      ],
    },
    {
      keys: [
        { label: 'ौ', shifted: 'औ', finger: 'left-pinky' },
        { label: 'ै', shifted: 'ऐ', finger: 'left-ring' },
        { label: 'ा', shifted: 'आ', finger: 'left-middle' },
        { label: 'ी', shifted: 'ई', finger: 'left-index' },
        { label: 'ू', shifted: 'ऊ', finger: 'left-index' },
        { label: 'ब', shifted: 'ब', finger: 'right-index' },
        { label: 'ह', shifted: 'ह', finger: 'right-index' },
        { label: 'ग', shifted: 'ग', finger: 'right-middle' },
        { label: 'द', shifted: 'द', finger: 'right-ring' },
        { label: 'ज', shifted: 'ज', finger: 'right-pinky' },
        { label: 'ड', shifted: 'ड', finger: 'right-pinky' },
        { label: '़', shifted: '़', finger: 'right-pinky' },
      ],
    },
    {
      keys: [
        { label: 'ो', shifted: 'ओ', finger: 'left-pinky' },
        { label: 'े', shifted: 'ए', finger: 'left-ring' },
        { label: '्', shifted: 'अ', finger: 'left-middle' },
        { label: 'ि', shifted: 'इ', finger: 'left-index' },
        { label: 'ु', shifted: 'उ', finger: 'left-index' },
        { label: 'प', shifted: 'प', finger: 'right-index' },
        { label: 'र', shifted: 'र', finger: 'right-index' },
        { label: 'क', shifted: 'क', finger: 'right-middle' },
        { label: 'त', shifted: 'त', finger: 'right-ring' },
        { label: 'च', shifted: 'च', finger: 'right-pinky' },
        { label: 'ट', shifted: 'ट', finger: 'right-pinky' },
      ],
    },
    {
      keys: [
        { label: 'ं', shifted: 'ँ', finger: 'left-pinky' },
        { label: 'म', shifted: 'म', finger: 'left-ring' },
        { label: 'न', shifted: 'न', finger: 'left-middle' },
        { label: 'व', shifted: 'व', finger: 'left-index' },
        { label: 'ल', shifted: 'ल', finger: 'left-index' },
        { label: 'स', shifted: 'स', finger: 'right-index' },
        { label: 'य', shifted: 'य', finger: 'right-index' },
        { label: ',', shifted: ',', finger: 'right-middle' },
        { label: '.', shifted: '.', finger: 'right-ring' },
        { label: '/', shifted: '/', finger: 'right-pinky' },
      ],
    },
    {
      keys: [{ label: ' ', finger: 'thumbs' }],
    },
  ],
};
