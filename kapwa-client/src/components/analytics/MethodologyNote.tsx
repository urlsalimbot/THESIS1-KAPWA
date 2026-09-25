import { useTranslation } from 'react-i18next';

export type MethodologyKey =
  | 'analytics.methodology.demographics'
  | 'analytics.methodology.clustering'
  | 'analytics.methodology.concentration'
  | 'analytics.methodology.equity';

/**
 * Small plain-language methodology disclosure rendered per analytics tab.
 * Uses a native <details> disclosure so it stays keyboard/mobile friendly.
 */
export function MethodologyNote({ textKey }: { textKey: MethodologyKey }) {
  const { t } = useTranslation();
  return (
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none font-medium">{t('analytics.methodology.title', 'How this is computed')}</summary>
      <p className="pt-1 leading-relaxed">{t(textKey)}</p>
    </details>
  );
}
