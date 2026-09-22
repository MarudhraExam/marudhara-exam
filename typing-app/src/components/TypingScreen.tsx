import { useEffect, useMemo, useRef } from 'react';
import type { KeyboardLayout, Language, HindiMode, PracticeKind, TestConfig } from '@/types';
import { getAdapter } from '@/lib/layouts';
import { useTypingEngine } from '@/lib/useTypingEngine';
import { VirtualKeyboard } from './VirtualKeyboard';
import { ResultsPanel } from './ResultsPanel';
import { saveResult } from '@/lib/storage';

interface TypingScreenProps {
  text: string;
  layout: KeyboardLayout;
  language: Language;
  hindiMode?: HindiMode;
  kind: PracticeKind;
  title: string;
  durationSeconds?: number;
  testConfig?: TestConfig;
  showKeyboard: boolean;
  showFingers: boolean;
  onBack: () => void;
}

export function TypingScreen({
  text,
  layout,
  language,
  hindiMode,
  kind,
  title,
  durationSeconds,
  testConfig,
  showKeyboard,
  showFingers,
  onBack,
}: TypingScreenProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const savedRef = useRef(false);

  const adapter = useMemo(
    () => getAdapter(language, hindiMode),
    [language, hindiMode]
  );

  const { state, elapsed, start, pause, restart, finish, handleKey } =
    useTypingEngine({
      text,
      adapter,
      durationSeconds,
      onComplete: (stats) => {
        if (!savedRef.current) {
          savedRef.current = true;
          saveResult({
            id: `${Date.now()}`,
            date: new Date().toISOString(),
            language,
            hindiMode,
            kind,
            wpm: stats.wpm,
            accuracy: stats.accuracy,
            errors: stats.errors,
            backspaces: stats.backspaces,
            correctChars: stats.correctChars,
            wrongChars: stats.wrongChars,
            durationSeconds: stats.elapsedSeconds,
            passageTitle: title,
            passed:
              testConfig !== undefined
                ? stats.accuracy >= testConfig.minAccuracy &&
                  stats.wpm >= testConfig.minSpeed
                : undefined,
          });
        }
      },
    });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Convert target text to display form (Unicode) for the passage view.
  // For Unicode layouts this is identity; for Kruti Dev it converts ASCII→Unicode.
  const targetDisplayChars = useMemo(
    () => Array.from(text).map((ch) => adapter.toDisplayChar(adapter.toTargetText(ch))),
    [text, adapter]
  );
  const typedChars = useMemo(() => Array.from(state.typed), [state.typed]);

  const passed =
    testConfig !== undefined
      ? state.accuracy >= testConfig.minAccuracy &&
        state.wpm >= testConfig.minSpeed
      : undefined;

  const handleRestart = () => {
    savedRef.current = false;
    restart();
    inputRef.current?.focus();
    start();
  };

  const remainingSeconds = durationSeconds
    ? Math.max(0, Math.ceil(durationSeconds - elapsed))
    : undefined;

  const expectedPhysicalKey = useMemo(() => {
    if (!state.expectedChar) return null;
    return adapter.reverseLookup(state.expectedChar);
  }, [adapter, state.expectedChar]);

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="text-slate-500 hover:text-slate-800 text-sm font-medium"
            >
              ← Back
            </button>
            <span className="text-slate-300">|</span>
            <span className="font-semibold text-slate-800">{layout.name}</span>
            <span className="text-slate-400 text-sm hidden sm:inline">· {title}</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            {remainingSeconds !== undefined && (
              <div className="font-mono font-bold text-slate-700">
                ⏱ {Math.floor(remainingSeconds / 60)}:
                {(remainingSeconds % 60).toString().padStart(2, '0')}
              </div>
            )}
            <div className="text-blue-600 font-bold">{state.wpm} WPM</div>
            <div className="text-green-600 font-bold">{state.accuracy}%</div>
            <div className="text-red-600 font-bold hidden sm:block">
              {state.errors} err
            </div>
          </div>
        </div>
        <div className="h-1 bg-slate-100">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${state.progress}%` }}
          />
        </div>
      </div>

      {state.finished ? (
        <ResultsPanel
          stats={state}
          passed={passed}
          passMessage={testConfig?.passMessage}
          failMessage={testConfig?.failMessage}
          onRestart={handleRestart}
          onBack={onBack}
        />
      ) : (
        <div className="max-w-5xl mx-auto px-4 pt-6">
          <div
            className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 mb-4 text-lg sm:text-xl cursor-text"
            style={{ lineHeight: 2.2 }}
            onClick={() => inputRef.current?.focus()}
            lang={language === 'hindi' ? 'hi' : 'en'}
          >
            {targetDisplayChars.map((ch, i) => {
              const typed = typedChars[i];
              let cls = 'text-slate-400';
              if (typed !== undefined) {
                cls = typed === ch ? 'text-green-600' : 'text-red-500 bg-red-50 rounded';
              }
              if (i === typedChars.length && !state.finished) {
                cls = 'text-slate-800 border-b-2 border-blue-500';
              }
              return (
                <span key={i} className={cls}>
                  {ch === ' ' && typed !== undefined && typed !== ch ? '·' : ch}
                </span>
              );
            })}
          </div>

          <textarea
            ref={inputRef}
            value={state.typed}
            onChange={() => {}}
            onKeyDown={(e) => {
              if (e.key === 'Backspace') {
                e.preventDefault();
                handleKey('Backspace');
                return;
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                handleKey('\n');
                return;
              }
              if (e.key.length === 1) {
                e.preventDefault();
                handleKey(e.key, e.shiftKey);
              }
            }}
            className="sr-only"
            aria-label="Typing input"
            tabIndex={0}
            readOnly
          />

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
            {[
              { label: 'WPM', value: state.wpm },
              { label: 'Accuracy', value: `${state.accuracy}%` },
              { label: 'Errors', value: state.errors },
              { label: 'Backspace', value: state.backspaces },
              { label: 'Progress', value: `${state.progress}%` },
              { label: 'Time', value: `${state.elapsedSeconds}s` },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-white border border-slate-200 rounded-lg p-2 text-center"
              >
                <div className="text-lg font-bold text-slate-800">{s.value}</div>
                <div className="text-[11px] text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mb-6 justify-center flex-wrap">
            {state.isRunning ? (
              <button
                onClick={pause}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition"
              >
                Pause
              </button>
            ) : (
              <button
                onClick={() => {
                  start();
                  inputRef.current?.focus();
                }}
                className="px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition"
              >
                Start
              </button>
            )}
            <button
              onClick={handleRestart}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition"
            >
              Restart
            </button>
            <button
              onClick={finish}
              className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition"
            >
              Finish Test
            </button>
          </div>

          {showKeyboard && (
            <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4">
              <div className="text-sm text-slate-500 mb-2 text-center">
                Expected key:{' '}
                <span className="font-bold text-blue-600 text-lg">
                  {state.expectedChar === ' '
                    ? 'Space'
                    : expectedPhysicalKey
                      ? `${expectedPhysicalKey.key}${expectedPhysicalKey.shift ? ' (Shift)' : ''}`
                      : state.expectedChar}
                </span>
                {language === 'hindi' && state.expectedChar !== ' ' && (
                  <span className="ml-2 text-slate-400">
                    → {adapter.toDisplayChar(state.expectedChar)}
                  </span>
                )}
              </div>
              <VirtualKeyboard
                layout={layout}
                expectedChar={state.expectedChar}
                showFingers={showFingers}
              />
            </div>
          )}

          <p className="text-center text-xs text-slate-400 mt-4">
            Click the passage area and start typing. The virtual keyboard shows
            the next expected key.
          </p>
        </div>
      )}
    </div>
  );
}
