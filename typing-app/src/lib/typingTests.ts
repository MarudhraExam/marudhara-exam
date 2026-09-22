// Read-only access to admin-created typing tests stored in Firestore by the
// Admin Typing Test Manager. This module NEVER writes to Firestore — it only
// fetches published/active tests once and caches the result in memory.
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import type { HindiMode, Language } from '@/types';

export interface AdminTypingTest {
  id: string;
  title: string;
  language: string; // raw value as stored by Admin Panel, e.g. "Hindi" / "English"
  hindiMode?: string; // raw value as stored, e.g. "Kruti Dev 010"
  durationMinutes: number;
  minSpeed: number;
  minAccuracy: number;
  passage: string;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Accepted label variants per Hindi keyboard mode, matched against the
// Admin Panel's `hindiMode` field (case/spacing-insensitive).
const HINDI_MODE_LABELS: Record<HindiMode, string[]> = {
  krutidev: ['kruti dev 010', 'kruti dev', 'krutidev', 'krutidev 010', 'kd010', 'kd 010'],
  mangal: ['mangal unicode', 'mangal'],
  remington: ['remington gail', 'remington'],
  inscript: ['inscript'],
};

export function matchesLanguage(rawLanguage: string, language: Language): boolean {
  const n = normalize(rawLanguage);
  return language === 'hindi' ? n === 'hindi' : n === 'english';
}

export function matchesHindiMode(rawHindiMode: string | undefined, mode: HindiMode): boolean {
  if (!rawHindiMode) return false;
  const n = normalize(rawHindiMode);
  return HINDI_MODE_LABELS[mode].includes(n);
}

let cachedTests: AdminTypingTest[] | null = null;
let inFlightRequest: Promise<AdminTypingTest[]> | null = null;

/**
 * Fetches published + active typing tests from the `typingTests` Firestore
 * collection. One-time read (no realtime listener), cached for the session.
 * Resolves to an empty array on any failure so callers can safely fall back
 * to the Typing Tutor's existing default practice test.
 */
export async function fetchPublishedTypingTests(): Promise<AdminTypingTest[]> {
  if (cachedTests) return cachedTests;
  if (inFlightRequest) return inFlightRequest;

  inFlightRequest = (async () => {
    try {
      // Read the collection without a compound Firestore query. This avoids
      // composite-index requirements on the public Typing Tutor client.
      // Published/active filtering is performed locally below.
      const snapshot = await getDocs(collection(db, 'typingTests'));
      const tests: AdminTypingTest[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;

        // Student-side visibility filter: only published + active tests.
        if (data.status !== 'published' || data.isActive !== true) return;

        const title = data.title;
        const language = data.language;
        const passage = data.passage;
        const durationMinutes = data.durationMinutes;
        const minSpeed = data.minSpeed;
        const minAccuracy = data.minAccuracy;

        // Skip malformed documents rather than crashing the Test tab.
        if (
          typeof title === 'string' &&
          typeof language === 'string' &&
          typeof passage === 'string' &&
          typeof durationMinutes === 'number' &&
          typeof minSpeed === 'number' &&
          typeof minAccuracy === 'number'
        ) {
          tests.push({
            id: docSnap.id,
            title,
            language,
            hindiMode: typeof data.hindiMode === 'string' ? data.hindiMode : undefined,
            durationMinutes,
            minSpeed,
            minAccuracy,
            passage,
          });
        }
      });

      cachedTests = tests;
      return tests;
    } catch (err) {
      // Firebase read failed (offline, rules, network, etc.) — the Typing
      // Tutor must keep working with its existing default test.
      console.warn('[typingTests] Failed to load admin tests from Firestore:', err);
      return [];
    } finally {
      inFlightRequest = null;
    }
  })();

  return inFlightRequest;
}
