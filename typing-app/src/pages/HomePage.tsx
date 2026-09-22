import type { Route } from '@/lib/routes';
import { Keyboard, Type, BookOpen, GraduationCap, Settings as SettingsIcon, History } from 'lucide-react';

interface HomePageProps {
  onNavigate: (route: Route) => void;
}

export function HomePage({ onNavigate }: HomePageProps) {
  const cards = [
    {
      title: 'English Typing',
      desc: 'Practice English typing with staged lessons, words, sentences, paragraphs, and tests.',
      icon: Type,
      color: 'bg-blue-500',
      route: { name: 'english' as const },
    },
    {
      title: 'Hindi Typing',
      desc: 'Kruti Dev 010, Mangal Unicode, Remington Gail, and InScript keyboard layouts.',
      icon: BookOpen,
      color: 'bg-emerald-500',
      route: { name: 'hindi' as const },
    },
    {
      title: 'Typing Test',
      desc: 'Exam-oriented typing tests with configurable duration, accuracy, and speed.',
      icon: GraduationCap,
      color: 'bg-orange-500',
      route: { name: 'english-test' as const },
    },
    {
      title: 'History',
      desc: 'View your typing history and track progress over time.',
      icon: History,
      color: 'bg-purple-500',
      route: { name: 'history' as const },
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
          <Keyboard className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-2">
          Marudhara Exam Typing Tutor
        </h1>
        <p className="text-slate-500 max-w-xl mx-auto">
          Master typing in English and Hindi with guided lessons, virtual
          keyboards, finger guidance, and exam-oriented practice for Rajasthan
          government typing exams.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.title}
              onClick={() => onNavigate(card.route)}
              className="bg-white border border-slate-200 rounded-xl p-6 text-left hover:shadow-lg hover:border-blue-300 transition group"
            >
              <div className={`inline-flex items-center justify-center w-12 h-12 ${card.color} rounded-xl mb-4`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-blue-600 transition">
                {card.title}
              </h3>
              <p className="text-sm text-slate-500">{card.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
