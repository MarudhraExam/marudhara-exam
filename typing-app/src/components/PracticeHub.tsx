import { useState } from 'react';
import type { LessonGroup, PracticeKind, Language, HindiMode, KeyboardLayout, TestConfig } from '@/types';
import { TypingScreen } from './TypingScreen';
import { BookOpen, Type, AlignLeft, FileText, PenLine, ClipboardCheck } from 'lucide-react';

interface PracticeHubProps {
  language: Language;
  hindiMode?: HindiMode;
  layout: KeyboardLayout;
  lessonGroups: LessonGroup[];
  words: string[];
  sentences: string[];
  paragraphs: string[];
  testConfig: TestConfig;
  testPassage: string;
  showKeyboard: boolean;
  showFingers: boolean;
  onBack: () => void;
}

export function PracticeHub({
  language,
  hindiMode,
  layout,
  lessonGroups,
  words,
  sentences,
  paragraphs,
  testConfig,
  testPassage,
  showKeyboard,
  showFingers,
  onBack,
}: PracticeHubProps) {
  const [activeKind, setActiveKind] = useState<PracticeKind | null>(null);
  const [activeText, setActiveText] = useState('');
  const [activeTitle, setActiveTitle] = useState('');
  const [activeDuration, setActiveDuration] = useState<number | undefined>(undefined);
  const [activeTestConfig, setActiveTestConfig] = useState<TestConfig | undefined>(undefined);
  const [tab, setTab] = useState<PracticeKind>('lessons');
  const [customText, setCustomText] = useState('');
  const [customDuration, setCustomDuration] = useState(5);
  const [testDuration, setTestDuration] = useState(testConfig.durationMinutes);

  const startPractice = (
    kind: PracticeKind,
    text: string,
    title: string,
    duration?: number,
    config?: TestConfig
  ) => {
    setActiveKind(kind);
    setActiveText(text);
    setActiveTitle(title);
    setActiveDuration(duration);
    setActiveTestConfig(config);
  };

  const backToHub = () => {
    setActiveKind(null);
    setActiveText('');
    setActiveTitle('');
    setActiveDuration(undefined);
    setActiveTestConfig(undefined);
  };

  if (activeKind && activeText) {
    return (
      <TypingScreen
        text={activeText}
        layout={layout}
        language={language}
        hindiMode={hindiMode}
        kind={activeKind}
        title={activeTitle}
        durationSeconds={activeDuration}
        testConfig={activeTestConfig}
        showKeyboard={showKeyboard}
        showFingers={showFingers}
        onBack={backToHub}
      />
    );
  }

  const tabs: { kind: PracticeKind; label: string; icon: typeof BookOpen }[] = [
    { kind: 'lessons', label: 'Lessons', icon: BookOpen },
    { kind: 'words', label: 'Words', icon: Type },
    { kind: 'sentences', label: 'Sentences', icon: AlignLeft },
    { kind: 'paragraphs', label: 'Paragraphs', icon: FileText },
    { kind: 'custom', label: 'Custom', icon: PenLine },
    { kind: 'test', label: 'Test', icon: ClipboardCheck },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">
          {layout.name} {language === 'hindi' ? 'टंकण' : 'Typing'}
        </h2>
        <button
          onClick={onBack}
          className="text-slate-500 hover:text-slate-800 text-sm font-medium"
        >
          ← Back
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.kind;
          return (
            <button
              key={t.kind}
              onClick={() => setTab(t.kind)}
              className={[
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition',
                active
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50',
              ].join(' ')}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Lessons tab */}
      {tab === 'lessons' && (
        <div className="space-y-6">
          {lessonGroups.map((group) => (
            <div key={group.id}>
              <h3 className="font-semibold text-slate-700 mb-2">{group.title}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {group.lessons.map((lesson) => (
                  <button
                    key={lesson.id}
                    onClick={() => startPractice('lessons', lesson.text, lesson.title)}
                    className="bg-white border border-slate-200 rounded-lg p-4 text-left hover:border-blue-300 hover:shadow-md transition"
                  >
                    <div className="font-medium text-slate-800">{lesson.title}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      Level {lesson.level} · {Array.from(lesson.text).length} chars
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Words tab */}
      {tab === 'words' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {words.map((w, i) => (
            <button
              key={i}
              onClick={() => startPractice('words', w, `Word: ${w}`)}
              className="bg-white border border-slate-200 rounded-lg p-4 text-center hover:border-blue-300 hover:shadow-md transition"
            >
              <span className="text-lg font-medium text-slate-800">{w}</span>
            </button>
          ))}
          <button
            onClick={() => startPractice('words', words.join(' '), 'All Words')}
            className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center hover:bg-blue-100 transition"
          >
            <span className="text-sm font-medium text-blue-700">Practice All Words</span>
          </button>
        </div>
      )}

      {/* Sentences tab */}
      {tab === 'sentences' && (
        <div className="space-y-3">
          {sentences.map((s, i) => (
            <button
              key={i}
              onClick={() => startPractice('sentences', s, `Sentence ${i + 1}`)}
              className="block w-full bg-white border border-slate-200 rounded-lg p-4 text-left hover:border-blue-300 hover:shadow-md transition"
            >
              <span className="text-slate-700">{s}</span>
            </button>
          ))}
        </div>
      )}

      {/* Paragraphs tab */}
      {tab === 'paragraphs' && (
        <div className="space-y-3">
          {paragraphs.map((p, i) => (
            <button
              key={i}
              onClick={() => startPractice('paragraphs', p, `Paragraph ${i + 1}`)}
              className="block w-full bg-white border border-slate-200 rounded-lg p-4 text-left hover:border-blue-300 hover:shadow-md transition"
            >
              <span className="text-slate-700 text-sm leading-relaxed">{p}</span>
            </button>
          ))}
        </div>
      )}

      {/* Custom tab */}
      {tab === 'custom' && (
        <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-xl p-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Custom Text
          </label>
          <textarea
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Type or paste your practice text here..."
            className="w-full h-32 border border-slate-300 rounded-lg p-3 text-sm focus:outline-none focus:border-blue-500"
            dir="ltr"
          />
          <label className="block text-sm font-medium text-slate-700 mb-2 mt-4">
            Duration (minutes, optional)
          </label>
          <input
            type="number"
            value={customDuration}
            onChange={(e) => setCustomDuration(Number(e.target.value))}
            min={1}
            max={60}
            className="w-24 border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => {
              if (customText.trim()) {
                startPractice(
                  'custom',
                  customText,
                  'Custom Practice',
                  customDuration > 0 ? customDuration * 60 : undefined
                );
              }
            }}
            disabled={!customText.trim()}
            className="mt-4 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            Start Custom Practice
          </button>
        </div>
      )}

      {/* Test tab */}
      {tab === 'test' && (
        <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="font-bold text-slate-800 mb-4">Exam Typing Test</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Test Duration (minutes): {testDuration}
              </label>
              <input
                type="range"
                value={testDuration}
                onChange={(e) => setTestDuration(Number(e.target.value))}
                min={1}
                max={30}
                className="w-full"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Min Accuracy: {testConfig.minAccuracy}%
                </label>
                <input
                  type="range"
                  value={testConfig.minAccuracy}
                  readOnly
                  min={0}
                  max={100}
                  className="w-full opacity-60"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Min Speed: {testConfig.minSpeed} WPM
                </label>
                <input
                  type="range"
                  value={testConfig.minSpeed}
                  readOnly
                  min={0}
                  max={100}
                  className="w-full opacity-60"
                />
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-1">Passage:</div>
              <p className="text-sm text-slate-700 leading-relaxed">{testPassage}</p>
            </div>
            <button
              onClick={() => {
                const config: TestConfig = {
                  ...testConfig,
                  durationMinutes: testDuration,
                  passage: testPassage,
                };
                startPractice('test', testPassage, 'Typing Test', testDuration * 60, config);
              }}
              className="w-full px-5 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
            >
              Start Typing Test
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
