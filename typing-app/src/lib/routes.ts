import type { Language, HindiMode } from '@/types';

export type Route =
  | { name: 'home' }
  | { name: 'english' }
  | { name: 'english-practice' }
  | { name: 'english-test' }
  | { name: 'hindi' }
  | { name: 'hindi-mode'; mode: HindiMode }
  | { name: 'hindi-practice'; mode: HindiMode }
  | { name: 'hindi-test'; mode: HindiMode }
  | { name: 'history' }
  | { name: 'settings' };

export interface NavItem {
  label: string;
  route: Route;
}

export const languageLabel: Record<Language, string> = {
  english: 'English',
  hindi: 'Hindi',
};

export const hindiModeLabel: Record<HindiMode, string> = {
  krutidev: 'Kruti Dev 010',
  mangal: 'Mangal Unicode',
  remington: 'Remington Gail',
  inscript: 'InScript',
};
