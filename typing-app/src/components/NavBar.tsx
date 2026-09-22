import type { Route } from '@/lib/routes';
import { Keyboard, Type, BookOpen, Settings, History } from 'lucide-react';

interface NavBarProps {
  current: Route;
  onNavigate: (route: Route) => void;
}

export function NavBar({ current, onNavigate }: NavBarProps) {
  const items: { label: string; route: Route; icon: typeof Keyboard }[] = [
    { label: 'Home', route: { name: 'home' }, icon: Keyboard },
    { label: 'English', route: { name: 'english' }, icon: Type },
    { label: 'Hindi', route: { name: 'hindi' }, icon: BookOpen },
    { label: 'History', route: { name: 'history' }, icon: History },
    { label: 'Settings', route: { name: 'settings' }, icon: Settings },
  ];

  const isActive = (route: Route) => {
    if (route.name === 'english' && (current.name === 'english' || current.name === 'english-practice' || current.name === 'english-test')) return true;
    if (route.name === 'hindi' && current.name.startsWith('hindi')) return true;
    return route.name === current.name;
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <button
            onClick={() => onNavigate({ name: 'home' })}
            className="flex items-center gap-2 font-bold text-slate-800"
          >
            <Keyboard className="w-5 h-5 text-blue-600" />
            <span className="hidden sm:inline">Marudhara Exam Typing Tutor</span>
            <span className="sm:hidden">METT</span>
          </button>
          <div className="flex items-center gap-1">
            {items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.route);
              return (
                <button
                  key={item.label}
                  onClick={() => onNavigate(item.route)}
                  className={[
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition',
                    active
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-100',
                  ].join(' ')}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
