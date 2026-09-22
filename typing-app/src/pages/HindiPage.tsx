import type { Route } from '@/lib/routes';
import type { HindiMode, Settings } from '@/types';
import { PracticeHub } from '@/components/PracticeHub';
import { hindiLayouts } from '@/lib/layouts';
import { hindiLessonGroups, hindiWords, hindiSentences, hindiParagraphs, hindiExamPassages } from '@/data/hindi';
import { defaultExamConfig } from '@/data/exam';

interface HindiPageProps {
  route: Route;
  settings: Settings;
  onNavigate: (route: Route) => void;
}

export function HindiPage({ route, settings, onNavigate }: HindiPageProps) {
  const mode: HindiMode =
    route.name === 'hindi-practice' || route.name === 'hindi-test' || route.name === 'hindi-mode'
      ? route.mode
      : 'mangal';

  const layout = hindiLayouts[mode];
  const testPassage = hindiExamPassages[0];

  return (
    <PracticeHub
      language="hindi"
      hindiMode={mode}
      layout={layout}
      lessonGroups={hindiLessonGroups}
      words={hindiWords}
      sentences={hindiSentences}
      paragraphs={hindiParagraphs}
      testConfig={{
        ...defaultExamConfig,
        passage: testPassage,
      }}
      testPassage={testPassage}
      showKeyboard={settings.showKeyboard}
      showFingers={settings.showFingers}
      onBack={() => onNavigate({ name: 'hindi' })}
    />
  );
}
