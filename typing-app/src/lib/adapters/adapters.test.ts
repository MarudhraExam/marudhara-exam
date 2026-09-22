import { describe, it, expect } from 'vitest';
import { createEnglishAdapter, createHindiAdapter } from '@/lib/adapters/LayoutAdapter';
import { englishLayout } from '@/lib/layouts/english';
import { remingtonGailLayout } from '@/lib/layouts/remington';
import { inscriptLayout } from '@/lib/layouts/inscript';
import { krutiDevLayout } from '@/lib/layouts/krutidev';
import { remingtonGailKeyMap } from '@/lib/adapters/remingtonKeyMap';
import { inscriptKeyMap } from '@/lib/adapters/inscriptKeyMap';
import { krutiDevKeyMap } from '@/lib/layouts/krutidev/keyMap';

describe('English adapter', () => {
  const adapter = createEnglishAdapter(englishLayout);

  it('converts physical keys identically', () => {
    expect(adapter.convertKey('a', false)).toBe('a');
    expect(adapter.convertKey('A', true)).toBe('A');
    expect(adapter.convertKey(' ', false)).toBe(' ');
  });

  it('rejects multi-character keys', () => {
    expect(adapter.convertKey('ab', false)).toBeNull();
  });

  it('reverse-looks-up characters', () => {
    expect(adapter.reverseLookup('a')).toEqual({ key: 'a', shift: false });
  });
});

describe('Remington Gail adapter', () => {
  const adapter = createHindiAdapter(remingtonGailLayout, remingtonGailKeyMap);

  it('maps physical k to Devanagari क', () => {
    expect(adapter.convertKey('k', false)).toBe('क');
  });

  it('maps physical f to matra ि', () => {
    expect(adapter.convertKey('f', false)).toBe('ि');
  });

  it('maps physical d to halant ्', () => {
    expect(adapter.convertKey('d', false)).toBe('्');
  });

  it('maps space to space', () => {
    expect(adapter.convertKey(' ', false)).toBe(' ');
  });

  it('reverse-looks-up क to physical k', () => {
    expect(adapter.reverseLookup('क')).toEqual({ key: 'k', shift: false });
  });

  it('reverse-looks-up space', () => {
    expect(adapter.reverseLookup(' ')).toEqual({ key: ' ', shift: false });
  });
});

describe('InScript adapter', () => {
  const adapter = createHindiAdapter(inscriptLayout, inscriptKeyMap);

  it('maps physical k to Devanagari क', () => {
    expect(adapter.convertKey('k', false)).toBe('क');
  });

  it('differs from Remington on shifted numbers', () => {
    expect(adapter.convertKey('3', true)).toBe('३');
    expect(adapter.convertKey('=', true)).toBe('ऋ');
  });

  it('maps shifted Q to औ (not ऊ like Remington)', () => {
    expect(adapter.convertKey('q', true)).toBe('औ');
  });
});

describe('Kruti Dev adapter', () => {
  const adapter = createHindiAdapter(krutiDevLayout, krutiDevKeyMap);

  it('maps physical k to ASCII k (identity for Kruti Dev)', () => {
    expect(adapter.convertKey('k', false)).toBe('k');
  });

  it('maps physical K (shift+k) to ASCII K', () => {
    expect(adapter.convertKey('k', true)).toBe('K');
  });

  it('reverse-looks-up k to physical k', () => {
    expect(adapter.reverseLookup('k')).toEqual({ key: 'k', shift: false });
  });
});

describe('Kruti Dev converter', () => {
  it('converts Kruti Dev ASCII to Unicode', async () => {
    const { krutiToUnicodeStr } = await import('@/lib/layouts/krutidev/converter');
    expect(krutiToUnicodeStr('k')).toBe('क');
    expect(krutiToUnicodeStr('f')).toBe('ि');
  });

  it('converts Unicode to Kruti Dev ASCII', async () => {
    const { unicodeToKrutiStr } = await import('@/lib/layouts/krutidev/converter');
    expect(unicodeToKrutiStr('क')).toBe('k');
  });
});
