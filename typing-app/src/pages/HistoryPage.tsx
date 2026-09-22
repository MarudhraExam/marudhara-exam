import { loadHistory, clearHistory } from '@/lib/storage';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { hindiModeLabel } from '@/lib/routes';

export function HistoryPage() {
  const [history, setHistory] = useState(loadHistory());

  const handleClear = () => {
    clearHistory();
    setHistory([]);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Typing History</h1>
        {history.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          No typing history yet. Complete a practice session to see your results here.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-left">
                <th className="py-2 px-3 font-medium">Date</th>
                <th className="py-2 px-3 font-medium">Language</th>
                <th className="py-2 px-3 font-medium">Mode</th>
                <th className="py-2 px-3 font-medium">Type</th>
                <th className="py-2 px-3 font-medium">WPM</th>
                <th className="py-2 px-3 font-medium">Accuracy</th>
                <th className="py-2 px-3 font-medium">Errors</th>
                <th className="py-2 px-3 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 px-3 text-slate-600">
                    {new Date(r.date).toLocaleDateString()}{' '}
                    {new Date(r.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-2 px-3 capitalize text-slate-700">{r.language}</td>
                  <td className="py-2 px-3 text-slate-600">
                    {r.hindiMode ? hindiModeLabel[r.hindiMode] : '—'}
                  </td>
                  <td className="py-2 px-3 capitalize text-slate-600">{r.kind}</td>
                  <td className="py-2 px-3 font-bold text-blue-600">{r.wpm}</td>
                  <td className="py-2 px-3 font-bold text-green-600">{r.accuracy}%</td>
                  <td className="py-2 px-3 text-red-600">{r.errors}</td>
                  <td className="py-2 px-3">
                    {r.passed === undefined ? (
                      <span className="text-slate-400">—</span>
                    ) : r.passed ? (
                      <span className="text-green-600 font-medium">Pass</span>
                    ) : (
                      <span className="text-red-600 font-medium">Fail</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
