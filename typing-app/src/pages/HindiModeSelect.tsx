import type { Route } from '@/lib/routes';
import type { HindiMode } from '@/types';
import { hindiModeLabel } from '@/lib/routes';
import { BookOpen, ArrowRight } from 'lucide-react';

interface HindiModeSelectProps {
  onNavigate: (route: Route) => void;
}

const modes: { mode: HindiMode; desc: string }[] = [
  { mode: 'krutidev', desc: 'Traditional Kruti Dev 010 font typing — widely used in Rajasthan government exams.' },
  { mode: 'mangal', desc: 'Mangal Unicode Devanagari typing with Remington key mapping.' },
  { mode: 'remington', desc: 'Dedicated Remington Gail layout for Hindi typing practice.' },
  { mode: 'inscript', desc: 'Standard Government of India InScript keyboard layout.' },
];

export function HindiModeSelect({ onNavigate }: HindiModeSelectProps) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500 rounded-2xl mb-3">
          <BookOpen className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2">
          हिंदी टंकण / Hindi Typing
        </h1>
        <p className="text-slate-500">
          Select a keyboard layout to begin Hindi typing practice.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {modes.map((m) => (
          <button
            key={m.mode}
            onClick={() => onNavigate({ name: 'hindi-practice', mode: m.mode })}
            className="bg-white border border-slate-200 rounded-xl p-5 text-left hover:shadow-lg hover:border-emerald-300 transition group"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800 group-hover:text-emerald-600 transition">
                  {hindiModeLabel[m.mode]}
                </h3>
                <p className="text-sm text-slate-500 mt-1">{m.desc}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition flex-shrink-0 mt-1" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
