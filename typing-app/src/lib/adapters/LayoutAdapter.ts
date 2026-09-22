import type { KeyboardLayout } from '@/types';

/**
 * A LayoutAdapter converts raw physical keyboard input into the target
 * script's characters and handles text normalization for comparison.
 *
 * For English (QWERTY) the adapter is identity.
 * For Hindi Unicode layouts (Remington, InScript, Mangal) the adapter
 * maps physical QWERTY keys to Devanagari Unicode characters.
 * For Kruti Dev (legacy ASCII font) the adapter is identity for key
 * mapping but converts Unicode practice text to Kruti Dev ASCII.
 */

export interface LayoutAdapter {
  layout: KeyboardLayout;
  /** Convert a physical key to the target script character. */
  convertKey(physicalKey: string, shift: boolean): string | null;
  /** Find which physical key produces a target character. */
  reverseLookup(targetChar: string): { key: string; shift: boolean } | null;
  /**
   * Convert Unicode practice text to the encoding used by the engine
   * for comparison. Identity for Unicode layouts; Unicode→ASCII for
   * Kruti Dev.
   */
  toTargetText(unicodeText: string): string;
  /**
   * Convert a typed character (in engine encoding) to a Unicode
   * character for display. Identity for Unicode layouts; ASCII→Unicode
   * for Kruti Dev.
   */
  toDisplayChar(ch: string): string;
}

function createEnglishAdapter(layout: KeyboardLayout): LayoutAdapter {
  return {
    layout,
    convertKey(physicalKey: string): string | null {
      if (physicalKey.length !== 1) return null;
      return physicalKey;
    },
    reverseLookup(targetChar: string) {
      return { key: targetChar, shift: false };
    },
    toTargetText(text: string): string {
      return text;
    },
    toDisplayChar(ch: string): string {
      return ch;
    },
  };
}

function createHindiAdapter(
  layout: KeyboardLayout,
  physicalKeyMap: Record<string, { normal: string; shifted?: string }>
): LayoutAdapter {
  const forward = new Map<string, { normal: string; shifted: string }>();
  for (const [phys, val] of Object.entries(physicalKeyMap)) {
    forward.set(phys, { normal: val.normal, shifted: val.shifted ?? val.normal });
  }
  const reverse = new Map<string, { key: string; shift: boolean }>();
  for (const [phys, val] of Object.entries(physicalKeyMap)) {
    reverse.set(val.normal, { key: phys, shift: false });
    if (val.shifted && val.shifted !== val.normal) {
      reverse.set(val.shifted, { key: phys, shift: true });
    }
  }

  return {
    layout,
    convertKey(physicalKey: string, shift: boolean): string | null {
      if (physicalKey === ' ') return ' ';
      const entry = forward.get(physicalKey);
      if (!entry) return null;
      return shift ? entry.shifted : entry.normal;
    },
    reverseLookup(targetChar: string) {
      if (targetChar === ' ') return { key: ' ', shift: false };
      return reverse.get(targetChar) ?? null;
    },
    toTargetText(text: string): string {
      return text;
    },
    toDisplayChar(ch: string): string {
      return ch;
    },
  };
}

/**
 * Kruti Dev adapter: physical keys map to ASCII (identity), but target
 * text is converted from Unicode Devanagari to Kruti Dev ASCII, and
 * typed chars are converted back to Unicode for display.
 */
function createKrutiDevAdapter(
  layout: KeyboardLayout,
  physicalKeyMap: Record<string, { normal: string; shifted?: string }>,
  krutiToUnicodeMap: Record<string, string>,
  unicodeToKrutiMap: Record<string, string>
): LayoutAdapter {
  const base = createHindiAdapter(layout, physicalKeyMap);
  return {
    ...base,
    toTargetText(text: string): string {
      let result = '';
      for (const ch of text) {
        result += unicodeToKrutiMap[ch] ?? ch;
      }
      return result;
    },
    toDisplayChar(ch: string): string {
      return krutiToUnicodeMap[ch] ?? ch;
    },
  };
}

export { createEnglishAdapter, createHindiAdapter, createKrutiDevAdapter };
