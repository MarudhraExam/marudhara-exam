import type { TypingStats } from '@/types';

interface ResultsPanelProps {
  stats: TypingStats;
  passed?: boolean;
  passMessage?: string;
  failMessage?: string;
  onRestart: () => void;
  onBack: () => void;
}

export function ResultsPanel({
  stats,
  passed,
  passMessage,
  failMessage,
  onRestart,
  onBack,
}: ResultsPanelProps) {
  const cards = [
    { label: 'WPM', value: stats.wpm, color: 'text-blue-600' },
    { label: 'Accuracy', value: `${stats.accuracy}%`, color: 'text-green-600' },
    { label: 'Errors', value: stats.errors, color: 'text-red-600' },
    { label: 'Backspaces', value: stats.backspaces, color: 'text-orange-600' },
    { label: 'Correct', value: stats.correctChars, color: 'text-emerald-600' },
    { label: 'Wrong', value: stats.wrongChars, color: 'text-rose-600' },
    { label: 'Correct Words', value: stats.correctWords, color: 'text-teal-600' },
    { label: 'Wrong Words', value: stats.wrongWords, color: 'text-pink-600' },
    { label: 'Skipped', value: stats.skippedWords, color: 'text-amber-600' },
    { label: 'Time (s)', value: stats.elapsedSeconds, color: 'text-indigo-600' },
  ];

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-center mb-6 text-slate-800">
        Typing Results
      </h2>

      {passed !== undefined && (
        <div
          className={[
            'text-center p-4 rounded-lg mb-6 font-medium',
            passed ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800',
          ].join(' ')}
        >
          {passed ? passMessage ?? 'Passed!' : failMessage ?? 'Keep practicing!'}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
        {cards.map((c) => (
          <div
            key={c.label}
            className="bg-white border border-slate-200 rounded-lg p-3 text-center"
          >
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
            <div className="text-xs text-slate-500 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="mb-6">
        <div className="flex justify-between text-sm text-slate-600 mb-1">
          <span>Progress</span>
          <span>{stats.progress}%</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${stats.progress}%` }}
          />
        </div>
      </div>

      <div className="flex gap-3 justify-center">
        <button
          onClick={onRestart}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
        >
          Try Again
        </button>
        <button
          onClick={onBack}
          className="px-5 py-2.5 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition"
        >
          Back
        </button>
      </div>
    </div>
  );
}
