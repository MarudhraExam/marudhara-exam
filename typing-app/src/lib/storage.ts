import type { TypingResult, Settings } from '@/types';

const HISTORY_KEY = 'marudhara_history_v1';
const SETTINGS_KEY = 'marudhara_settings_v1';
const PROGRESS_KEY = 'marudhara_progress_v1';

export function loadHistory(): TypingResult[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as TypingResult[]) : [];
  } catch {
    return [];
  }
}

export function saveResult(result: TypingResult): void {
  const all = loadHistory();
  all.unshift(result);
  const trimmed = all.slice(0, 100);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  fontScale: 1,
  showKeyboard: true,
  showFingers: true,
  sound: false,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadProgress(language: string, mode?: string): number {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const key = mode ? `${language}:${mode}` : language;
    return map[key] ?? 0;
  } catch {
    return 0;
  }
}

export function saveProgress(language: string, mode: string | undefined, index: number): void {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const key = mode ? `${language}:${mode}` : language;
    map[key] = index;
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}
