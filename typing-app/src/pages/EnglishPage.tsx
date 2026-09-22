import type { Route } from '@/lib/routes';
import type { Settings } from '@/types';
import { PracticeHub } from '@/components/PracticeHub';
import { englishLayout } from '@/lib/layouts';
import { englishLessonGroups, englishWords, englishSentences, englishParagraphs } from '@/data/english';
import { defaultExamConfig, englishExamPassage } from '@/data/exam';

interface EnglishPageProps {
  route: Route;
  settings: Settings;
  onNavigate: (route: Route) => void;
}

export function EnglishPage({ route, settings, onNavigate }: EnglishPageProps) {
  const isTest = route.name === 'english-test';

  return (
    <PracticeHub
      language="english"
      layout={englishLayout}
      lessonGroups={englishLessonGroups}
      words={englishWords}
      sentences={englishSentences}
      paragraphs={englishParagraphs}
      testConfig={{
        ...defaultExamConfig,
        passage: englishExamPassage,
        passMessage: 'Congratulations! You passed the typing test.',
        failMessage: 'Keep practicing. You will succeed next time.',
      }}
      testPassage={englishExamPassage}
      showKeyboard={settings.showKeyboard}
      showFingers={settings.showFingers}
      onBack={() => onNavigate({ name: 'english' })}
    />
  );
}
