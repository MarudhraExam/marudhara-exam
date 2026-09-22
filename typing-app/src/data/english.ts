import type { LessonGroup } from '@/types';

export const englishLessonGroups: LessonGroup[] = [
  {
    id: 'home-row',
    title: 'Home Row',
    lessons: [
      { id: 'hr-1', title: 'f j d k', level: 1, text: 'fjdk fjdk fjdk fjdk fjdk' },
      { id: 'hr-2', title: 'a s d f j k l ;', level: 1, text: 'asdf jkl; asdf jkl; asdf jkl;' },
      { id: 'hr-3', title: 'Home row words', level: 1, text: 'sad lad fad dad jak ask dad fad' },
    ],
  },
  {
    id: 'top-row',
    title: 'Top Row',
    lessons: [
      { id: 'tr-1', title: 'e i r u', level: 2, text: 'eiru eiru eiru eiru rieu rieu' },
      { id: 'tr-2', title: 'w o t p', level: 2, text: 'wotp wotp wotp towp towp towp' },
      { id: 'tr-3', title: 'Top row words', level: 2, text: 'tie our two pie top you rip' },
    ],
  },
  {
    id: 'bottom-row',
    title: 'Bottom Row',
    lessons: [
      { id: 'br-1', title: 'v m c x', level: 3, text: 'vmcx vmcx vmcx cxmv cxmv' },
      { id: 'br-2', title: 'z n b /', level: 3, text: 'zn b/ zn b/ nb z/ nb z/' },
      { id: 'br-3', title: 'Bottom row words', level: 3, text: 'bun van cab zoo nib mob' },
    ],
  },
  {
    id: 'common-words',
    title: 'Common Words',
    lessons: [
      { id: 'cw-1', title: 'Short words', level: 4, text: 'the and for are but not you all can had her was one' },
      { id: 'cw-2', title: 'Medium words', level: 4, text: 'people water little called world enough school during' },
      { id: 'cw-3', title: 'Long words', level: 4, text: 'information government education important development' },
    ],
  },
  {
    id: 'sentences',
    title: 'Sentences',
    lessons: [
      { id: 's-1', title: 'Simple sentences', level: 5, text: 'The sun rises in the east and sets in the west.' },
      { id: 's-2', title: 'Medium sentences', level: 5, text: 'Practice typing every day to improve your speed and accuracy.' },
      { id: 's-3', title: 'Longer sentences', level: 5, text: 'The quick brown fox jumps over the lazy dog near the riverbank.' },
    ],
  },
  {
    id: 'paragraphs',
    title: 'Paragraphs',
    lessons: [
      {
        id: 'p-1',
        title: 'Short paragraph',
        level: 6,
        text: 'Typing is a skill that improves with practice. The more you type, the faster and more accurate you become. Set aside time each day to practice.',
      },
      {
        id: 'p-2',
        title: 'Medium paragraph',
        level: 6,
        text: 'The art of typing requires patience and dedication. Beginners should focus on accuracy first, then speed. Over time, muscle memory develops and typing becomes second nature.',
      },
    ],
  },
];

export const englishWords: string[] = [
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it',
  'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this',
  'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or',
  'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so',
];

export const englishSentences: string[] = [
  'The sun rises in the east and sets in the west.',
  'Practice typing every day to improve your speed and accuracy.',
  'The quick brown fox jumps over the lazy dog near the riverbank.',
  'Knowledge is power and learning is a lifelong journey.',
  'A journey of a thousand miles begins with a single step.',
];

export const englishParagraphs: string[] = [
  'Typing is a skill that improves with practice. The more you type, the faster and more accurate you become. Set aside time each day to practice. Focus on accuracy first, then build speed gradually.',
  'The art of typing requires patience and dedication. Beginners should focus on accuracy first, then speed. Over time, muscle memory develops and typing becomes second nature. Consistent practice is the key to mastery.',
];
