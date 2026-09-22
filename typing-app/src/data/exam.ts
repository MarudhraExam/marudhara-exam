import type { TestConfig } from '@/types';

export const defaultExamConfig: TestConfig = {
  durationMinutes: 10,
  passage:
    'राजस्थान सरकार ने राज्य में डिजिटल साक्षरता बढ़ाने के लिए नई योजना शुरू की है। इस योजना के अंतर्गत ग्रामीण क्षेत्रों में कंप्यूटर शिक्षा दी जाएगी। प्रत्येक पंचायत में एक डिजिटल केंद्र स्थापित किया जाएगा। यह केंद्र नागरिकों को सरकारी सेवाएँ ऑनलाइन उपलब्ध कराएगा। युवाओं को तकनीकी शिक्षा देकर रोजगार के अवसर बढ़ाए जाएँगे।',
  minAccuracy: 90,
  minSpeed: 25,
  passMessage: 'बधाई हो! आप परीक्षा में उत्तीर्ण हुए हैं।',
  failMessage: 'अभ्यास जारी रखें। आप अगली बार सफल होंगे।',
};

export const englishExamPassage =
  'The government has launched a new initiative to promote digital literacy across rural areas. Under this scheme, computer training will be provided in every village. Each panchayat will set up a digital center to offer online services to citizens. The program aims to create employment opportunities for the youth by imparting technical education. This step will bridge the digital divide and empower the rural population.';
