import type { KeyboardLayout } from '@/types';

/**
 * Remington Gail keyboard layout for Devanagari Unicode.
 *
 * Remington Gail is the most common layout for Indian government typing exams.
 * It uses the Remington typewriter key positions but with the GAIL variant
 * mapping for Unicode output.
 *
 * Key differences from basic Remington / Mangal:
 * - Shift+Q = ऊ (not औ)
 * - Shift+, = । (danda on shift+comma)
 * - Shift+. = । (danda on shift+period)
 * - Shift+/ = ?
 * The GAIL variant is specifically tuned for Unicode output.
 */
export const remingtonGailLayout: KeyboardLayout = {
  id: 'remington',
  name: 'Remington Gail',
  language: 'hindi',
  hindiMode: 'remington',
  rows: [
    {
      keys: [
        { label: '1', shifted: 'ऍ', finger: 'left-pinky' },
        { label: '2', shifted: 'ॅ', finger: 'left-ring' },
        { label: '3', shifted: 'भ', finger: 'left-middle' },
        { label: '4', shifted: 'झ', finger: 'left-index' },
        { label: '5', shifted: 'घ', finger: 'left-index' },
        { label: '6', shifted: 'छ', finger: 'right-index' },
        { label: '7', shifted: 'ठ', finger: 'right-index' },
        { label: '8', shifted: 'ड', finger: 'right-middle' },
        { label: '9', shifted: 'ण', finger: 'right-ring' },
        { label: '0', shifted: 'ञ', finger: 'right-pinky' },
        { label: '-', shifted: 'ृ', finger: 'right-pinky' },
        { label: '=', shifted: 'श', finger: 'right-pinky' },
      ],
    },
    {
      keys: [
        { label: 'ौ', shifted: 'ऊ', finger: 'left-pinky' },
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
        { label: ',', shifted: '।', finger: 'right-middle' },
        { label: '.', shifted: '।', finger: 'right-ring' },
        { label: '/', shifted: '?', finger: 'right-pinky' },
      ],
    },
    {
      keys: [{ label: ' ', finger: 'thumbs' }],
    },
  ],
};
