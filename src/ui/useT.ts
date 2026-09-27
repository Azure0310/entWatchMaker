import { useAppState } from './store';
import { translate, type StringKey } from './i18n';

export function useT(): (key: StringKey, vars?: Record<string, string | number>) => string {
  const { lang } = useAppState();
  return (key, vars) => translate(lang, key, vars);
}
