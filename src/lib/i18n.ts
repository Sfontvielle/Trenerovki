import { getLocales } from 'expo-localization';

import { english } from './i18n-en';

// iOS keeps the language per app in Settings, so the choice is read once at launch.
export const language: 'ru' | 'en' = getLocales()[0]?.languageCode === 'ru' ? 'ru' : 'en';
export const locale = language === 'ru' ? 'ru-RU' : 'en-US';

// Russian source text is the key, so screens read naturally and a missing
// translation shows the original instead of an identifier.
export function t(text: string, values?: Record<string, unknown>) {
  const template = language === 'ru' ? text : (english[text] ?? text);
  return values ? template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key])) : template;
}
