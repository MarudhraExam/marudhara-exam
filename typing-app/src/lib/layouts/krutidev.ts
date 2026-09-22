import type { KeyboardLayout } from '@/types';

/**
 * Kruti Dev 010 virtual keyboard layout.
 *
 * The `label` is the Kruti Dev ASCII character the user types (what appears
 * on the physical keycap). The `display` field (stored in shifted for
 * convenience) shows the Unicode Devanagari equivalent for visual reference.
 *
 * Kruti Dev uses the Remington physical layout — same key positions as
 * Remington Gail, but the stored text is ASCII, not Unicode.
 */
export const krutiDevLayout: KeyboardLayout = {
  id: 'krutidev',
  name: 'Kruti Dev 010',
  language: 'hindi',
  hindiMode: 'krutidev',
  rows: [
    {
      keys: [
        { label: 'q', shifted: 'Q', finger: 'left-pinky' },
        { label: '1', shifted: '!', finger: 'left-pinky' },
        { label: '2', shifted: '@', finger: 'left-ring' },
        { label: '3', shifted: '#', finger: 'left-middle' },
        { label: '4', shifted: '$', finger: 'left-index' },
        { label: '5', shifted: '%', finger: 'left-index' },
        { label: '6', shifted: '^', finger: 'right-index' },
        { label: '7', shifted: '&', finger: 'right-index' },
        { label: '8', shifted: '*', finger: 'right-middle' },
        { label: '9', shifted: '(', finger: 'right-ring' },
        { label: '0', shifted: ')', finger: 'right-pinky' },
        { label: '-', shifted: '_', finger: 'right-pinky' },
        { label: '=', shifted: '+', finger: 'right-pinky' },
      ],
    },
    {
      keys: [
        { label: 'q', shifted: 'Q', finger: 'left-pinky' },
        { label: 'w', shifted: 'W', finger: 'left-ring' },
        { label: 'e', shifted: 'E', finger: 'left-middle' },
        { label: 'r', shifted: 'R', finger: 'left-index' },
        { label: 't', shifted: 'T', finger: 'left-index' },
        { label: 'y', shifted: 'Y', finger: 'right-index' },
        { label: 'u', shifted: 'U', finger: 'right-index' },
        { label: 'i', shifted: 'I', finger: 'right-middle' },
        { label: 'o', shifted: 'O', finger: 'right-ring' },
        { label: 'p', shifted: 'P', finger: 'right-pinky' },
        { label: '[', shifted: '{', finger: 'right-pinky' },
        { label: ']', shifted: '}', finger: 'right-pinky' },
      ],
    },
    {
      keys: [
        { label: 'a', shifted: 'A', finger: 'left-pinky' },
        { label: 's', shifted: 'S', finger: 'left-ring' },
        { label: 'd', shifted: 'D', finger: 'left-middle' },
        { label: 'f', shifted: 'F', finger: 'left-index' },
        { label: 'g', shifted: 'G', finger: 'left-index' },
        { label: 'h', shifted: 'H', finger: 'right-index' },
        { label: 'j', shifted: 'J', finger: 'right-index' },
        { label: 'k', shifted: 'K', finger: 'right-middle' },
        { label: 'l', shifted: 'L', finger: 'right-ring' },
        { label: ';', shifted: ':', finger: 'right-ring' },
        { label: "'", shifted: '"', finger: 'right-pinky' },
      ],
    },
    {
      keys: [
        { label: 'z', shifted: 'Z', finger: 'left-pinky' },
        { label: 'x', shifted: 'X', finger: 'left-ring' },
        { label: 'c', shifted: 'C', finger: 'left-middle' },
        { label: 'v', shifted: 'V', finger: 'left-index' },
        { label: 'b', shifted: 'B', finger: 'left-index' },
        { label: 'n', shifted: 'N', finger: 'right-index' },
        { label: 'm', shifted: 'M', finger: 'right-index' },
        { label: ',', shifted: '<', finger: 'right-middle' },
        { label: '.', shifted: '>', finger: 'right-ring' },
        { label: '/', shifted: '?', finger: 'right-pinky' },
      ],
    },
    {
      keys: [{ label: ' ', finger: 'thumbs' }],
    },
  ],
};
