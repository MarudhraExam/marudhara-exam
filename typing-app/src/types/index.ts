export type Language = 'english' | 'hindi';

export type HindiMode = 'krutidev' | 'mangal' | 'remington' | 'inscript';

export type PracticeKind =
  | 'lessons'
  | 'words'
  | 'sentences'
  | 'paragraphs'
  | 'custom'
  | 'test';

export interface KeyDef {
  label: string;
  shifted?: string;
  finger: string;
}

export interface KeyboardRow {
  keys: KeyDef[];
}

export interface KeyboardLayout {
  id: string;
  name: string;
  language: Language | 'hindi';
  hindiMode?: HindiMode;
  rows: KeyboardRow[];
}

export interface Lesson {
  id: string;
  title: string;
  level: number;
  text: string;
}

export interface LessonGroup {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface TestConfig {
  durationMinutes: number;
  passage: string;
  minAccuracy: number;
  minSpeed: number;
  passMessage: string;
  failMessage: string;
}

export interface TypingResult {
  id: string;
  date: string;
  language: Language;
  hindiMode?: HindiMode;
  kind: PracticeKind;
  wpm: number;
  accuracy: number;
  errors: number;
  backspaces: number;
  correctChars: number;
  wrongChars: number;
  durationSeconds: number;
  passageTitle?: string;
  passed?: boolean;
}

export interface TypingStats {
  wpm: number;
  accuracy: number;
  errors: number;
  backspaces: number;
  correctChars: number;
  wrongChars: number;
  correctWords: number;
  wrongWords: number;
  skippedWords: number;
  progress: number;
  elapsedSeconds: number;
  finished: boolean;
}

export interface Settings {
  theme: 'light' | 'dark' | 'sepia';
  fontScale: number;
  showKeyboard: boolean;
  showFingers: boolean;
  sound: boolean;
}
