import type { KeyboardLayout, HindiMode, Language } from '@/types';
import { englishLayout } from './english';
import { krutiDevLayout } from './krutidev';
import { mangalLayout } from './mangal';
import { remingtonGailLayout } from './remington';
import { inscriptLayout } from './inscript';
import type { LayoutAdapter } from '@/lib/adapters/LayoutAdapter';
import { createEnglishAdapter, createHindiAdapter, createKrutiDevAdapter } from '@/lib/adapters/LayoutAdapter';
import { remingtonGailKeyMap } from '@/lib/adapters/remingtonKeyMap';
import { inscriptKeyMap } from '@/lib/adapters/inscriptKeyMap';
import { krutiDevKeyMap } from '@/lib/layouts/krutidev/keyMap';
import { krutiToUnicode, unicodeToKruti } from '@/lib/layouts/krutidev/converter';

export { englishLayout, krutiDevLayout, mangalLayout, remingtonGailLayout, inscriptLayout };

export const hindiLayouts: Record<HindiMode, KeyboardLayout> = {
  krutidev: krutiDevLayout,
  mangal: mangalLayout,
  remington: remingtonGailLayout,
  inscript: inscriptLayout,
};

export function getLayout(language: Language, mode?: HindiMode): KeyboardLayout {
  if (language === 'hindi' && mode) return hindiLayouts[mode];
  return englishLayout;
}

export const fingerColors: Record<string, string> = {
  'left-pinky': '#ef4444',
  'left-ring': '#f97316',
  'left-middle': '#eab308',
  'left-index': '#22c55e',
  'right-index': '#06b6d4',
  'right-middle': '#3b82f6',
  'right-ring': '#8b5cf6',
  'right-pinky': '#ec4899',
  thumbs: '#64748b',
};

export const fingerNames: Record<string, string> = {
  'left-pinky': 'Left Pinky',
  'left-ring': 'Left Ring',
  'left-middle': 'Left Middle',
  'left-index': 'Left Index',
  'right-index': 'Right Index',
  'right-middle': 'Right Middle',
  'right-ring': 'Right Ring',
  'right-pinky': 'Right Pinky',
  thumbs: 'Thumbs',
};

const englishAdapter = createEnglishAdapter(englishLayout);
const remingtonAdapter = createHindiAdapter(remingtonGailLayout, remingtonGailKeyMap);
const mangalAdapter = createHindiAdapter(mangalLayout, remingtonGailKeyMap);
const inscriptAdapter = createHindiAdapter(inscriptLayout, inscriptKeyMap);
const krutiDevAdapter = createKrutiDevAdapter(
  krutiDevLayout,
  krutiDevKeyMap,
  krutiToUnicode,
  unicodeToKruti
);

const adapterMap: Record<string, LayoutAdapter> = {
  qwerty: englishAdapter,
  krutidev: krutiDevAdapter,
  mangal: mangalAdapter,
  remington: remingtonAdapter,
  inscript: inscriptAdapter,
};

export function getAdapter(language: Language, mode?: HindiMode): LayoutAdapter {
  if (language === 'hindi' && mode) return adapterMap[mode] ?? englishAdapter;
  return adapterMap['qwerty'] ?? englishAdapter;
}
