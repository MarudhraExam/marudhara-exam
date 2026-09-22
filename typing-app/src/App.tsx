import { useEffect, useState } from 'react';
import type { Route } from '@/lib/routes';
import type { Settings } from '@/types';
import { loadSettings, saveSettings } from '@/lib/storage';
import { NavBar } from '@/components/NavBar';
import { HomePage } from '@/pages/HomePage';
import { EnglishPage } from '@/pages/EnglishPage';
import { HindiPage } from '@/pages/HindiPage';
import { HindiModeSelect } from '@/pages/HindiModeSelect';
import { HistoryPage } from '@/pages/HistoryPage';
import { SettingsPage } from '@/pages/SettingsPage';

function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [settings, setSettings] = useState<Settings>(() => loadSettings());

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Apply theme to root
  const themeBg =
    settings.theme === 'dark'
      ? 'bg-slate-900'
      : settings.theme === 'sepia'
        ? 'bg-amber-50'
        : 'bg-slate-50';

  const navigate = (r: Route) => {
    setRoute(r);
    window.scrollTo(0, 0);
  };

  const renderRoute = () => {
    switch (route.name) {
      case 'home':
        return <HomePage onNavigate={navigate} />;
      case 'english':
      case 'english-practice':
      case 'english-test':
        return <EnglishPage route={route} settings={settings} onNavigate={navigate} />;
      case 'hindi':
        return <HindiModeSelect onNavigate={navigate} />;
      case 'hindi-mode':
      case 'hindi-practice':
      case 'hindi-test':
        return <HindiPage route={route} settings={settings} onNavigate={navigate} />;
      case 'history':
        return <HistoryPage />;
      case 'settings':
        return <SettingsPage settings={settings} onChange={setSettings} />;
      default:
        return <HomePage onNavigate={navigate} />;
    }
  };

  return (
    <div className={`min-h-screen ${themeBg}`} style={{ fontSize: `${settings.fontScale}rem` }}>
      <NavBar current={route} onNavigate={navigate} />
      <main>{renderRoute()}</main>
    </div>
  );
}

export default App;
