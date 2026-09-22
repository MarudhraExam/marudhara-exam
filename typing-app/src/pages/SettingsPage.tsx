import type { Settings } from '@/types';
import { Keyboard, Hand, Volume2, Type } from 'lucide-react';

interface SettingsPageProps {
  settings: Settings;
  onChange: (settings: Settings) => void;
}

export function SettingsPage({ settings, onChange }: SettingsPageProps) {
  const toggle = (key: keyof Settings) => {
    onChange({ ...settings, [key]: !settings[key] });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Settings</h1>

      <div className="space-y-4">
        {/* Theme */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Theme
          </label>
          <div className="flex gap-2">
            {(['light', 'dark', 'sepia'] as const).map((t) => (
              <button
                key={t}
                onClick={() => onChange({ ...settings, theme: t })}
                className={[
                  'px-4 py-2 rounded-lg text-sm font-medium capitalize transition',
                  settings.theme === t
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                ].join(' ')}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Font scale */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
            <Type className="w-4 h-4" />
            Font Scale: {settings.fontScale.toFixed(1)}x
          </label>
          <input
            type="range"
            min={0.8}
            max={1.5}
            step={0.1}
            value={settings.fontScale}
            onChange={(e) => onChange({ ...settings, fontScale: Number(e.target.value) })}
            className="w-full"
          />
        </div>

        {/* Toggles */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <button
            onClick={() => toggle('showKeyboard')}
            className="flex items-center justify-between w-full"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Keyboard className="w-4 h-4" />
              Show Virtual Keyboard
            </span>
            <span
              className={[
                'w-11 h-6 rounded-full transition relative',
                settings.showKeyboard ? 'bg-blue-600' : 'bg-slate-300',
              ].join(' ')}
            >
              <span
                className={[
                  'absolute top-0.5 w-5 h-5 bg-white rounded-full transition',
                  settings.showKeyboard ? 'left-5' : 'left-0.5',
                ].join(' ')}
              />
            </span>
          </button>

          <button
            onClick={() => toggle('showFingers')}
            className="flex items-center justify-between w-full"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Hand className="w-4 h-4" />
              Show Finger Guidance
            </span>
            <span
              className={[
                'w-11 h-6 rounded-full transition relative',
                settings.showFingers ? 'bg-blue-600' : 'bg-slate-300',
              ].join(' ')}
            >
              <span
                className={[
                  'absolute top-0.5 w-5 h-5 bg-white rounded-full transition',
                  settings.showFingers ? 'left-5' : 'left-0.5',
                ].join(' ')}
              />
            </span>
          </button>

          <button
            onClick={() => toggle('sound')}
            className="flex items-center justify-between w-full"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Volume2 className="w-4 h-4" />
              Sound Effects
            </span>
            <span
              className={[
                'w-11 h-6 rounded-full transition relative',
                settings.sound ? 'bg-blue-600' : 'bg-slate-300',
              ].join(' ')}
            >
              <span
                className={[
                  'absolute top-0.5 w-5 h-5 bg-white rounded-full transition',
                  settings.sound ? 'left-5' : 'left-0.5',
                ].join(' ')}
              />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
