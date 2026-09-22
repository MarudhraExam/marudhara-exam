import type { KeyboardLayout } from '@/types';
import { fingerColors, fingerNames } from '@/lib/layouts';

interface VirtualKeyboardProps {
  layout: KeyboardLayout;
  expectedChar: string;
  showFingers: boolean;
}

export function VirtualKeyboard({
  layout,
  expectedChar,
  showFingers,
}: VirtualKeyboardProps) {
  const activeFinger = (() => {
    for (const row of layout.rows) {
      for (const key of row.keys) {
        if (key.label === expectedChar || key.shifted === expectedChar) {
          return key.finger;
        }
      }
    }
    return null;
  })();

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      {showFingers && activeFinger && (
        <div className="text-sm font-medium mb-1" style={{ color: fingerColors[activeFinger] }}>
          {fingerNames[activeFinger]}
        </div>
      )}
      <div className="flex flex-col gap-1.5 w-full max-w-3xl mx-auto">
        {layout.rows.map((row, ri) => (
          <div
            key={ri}
            className="flex justify-center gap-1.5"
            style={{ marginLeft: ri > 0 && ri < 4 ? `${ri * 12}px` : 0 }}
          >
            {row.keys.map((key, ki) => {
              const isActive =
                key.label === expectedChar || key.shifted === expectedChar;
              const isSpace = key.label === ' ';
              const fingerColor = fingerColors[key.finger] ?? '#94a3b8';
              return (
                <div
                  key={ki}
                  className={[
                    'relative rounded-md border flex flex-col items-center justify-center',
                    'transition-all duration-150 select-none',
                    isSpace ? 'flex-1 min-w-[200px]' : 'min-w-[36px]',
                    isActive
                      ? 'border-blue-500 bg-blue-50 shadow-md scale-110 z-10'
                      : 'border-slate-300 bg-white',
                  ].join(' ')}
                  style={{
                    height: isSpace ? 36 : 44,
                    borderColor: isActive ? undefined : fingerColor + '55',
                  }}
                >
                  <span
                    className="text-sm font-medium leading-none"
                    style={{ color: '#1e293b' }}
                  >
                    {key.label === ' ' ? 'Space' : key.label}
                  </span>
                  {key.shifted && (
                    <span className="text-[10px] text-slate-400 leading-none mt-0.5">
                      {key.shifted}
                    </span>
                  )}
                  {showFingers && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-1 rounded-b-md"
                      style={{ backgroundColor: fingerColor }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
