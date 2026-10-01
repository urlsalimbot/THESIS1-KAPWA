import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sun, Moon, Monitor, Languages, Check } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/theme-context';
import { useLanguage } from '@/i18n/useLanguage';

/** The drawer stretches its triggers to share the row; the desktop row sizes to content. */
const DRAWER_TRIGGER =
  'touch-sm flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-border text-sm text-muted-foreground transition-colors hover:bg-muted';
const DESKTOP_TRIGGER =
  'touch-sm flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted';

interface AppearanceLanguageControlsProps {
  /**
   * `true` in the drawer, where there is room for the visible label. The desktop
   * header has five nav links and a CTA to fit, so it keeps the label as the
   * accessible name only — both placements answer to the same name, which is
   * what the tests and a screen reader rely on.
   */
  showLabel?: boolean;
}

/**
 * The appearance and language switchers.
 *
 * Rendered in two places: inside the mobile drawer, and inline in the header at
 * `md` and up. It has to be both, because the drawer's trigger is `md:hidden` —
 * a drawer-only control is unreachable on a desktop viewport, which is exactly
 * how these went missing. One component rather than two copies so a new theme or
 * language cannot land in only one of the placements.
 */
export function AppearanceLanguageControls({ showLabel = true }: AppearanceLanguageControlsProps) {
  const { t } = useTranslation();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { lang, setLang } = useLanguage();
  // Hydration guard: resolvedTheme is unknown until the browser mounts; the
  // trigger icon falls back to Sun (light) for the first render.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const triggerClass = cn(showLabel ? DRAWER_TRIGGER : DESKTOP_TRIGGER);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={triggerClass} aria-label={t('topbar.theme', 'Theme')}>
            {mounted && resolvedTheme === 'dark' ? (
              <Moon size={16} aria-hidden="true" />
            ) : (
              <Sun size={16} aria-hidden="true" />
            )}
            {showLabel && t('topbar.theme', 'Theme')}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-44">
          <DropdownMenuLabel className="font-semibold">{t('topbar.theme', 'Theme')}</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setTheme('light')}>
            <Sun size={16} className="mr-2" />
            {t('topbar.themeLight', 'Light')}
            {theme === 'light' && <Check size={14} className="ml-auto text-primary" />}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('dark')}>
            <Moon size={16} className="mr-2" />
            {t('topbar.themeDark', 'Dark')}
            {theme === 'dark' && <Check size={14} className="ml-auto text-primary" />}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('system')}>
            <Monitor size={16} className="mr-2" />
            {t('topbar.themeSystem', 'System')}
            {theme === 'system' && <Check size={14} className="ml-auto text-primary" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={triggerClass} aria-label={t('topbar.language', 'Language')}>
            <Languages size={16} aria-hidden="true" />
            {showLabel && t('topbar.language', 'Language')}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-44">
          <DropdownMenuLabel className="font-semibold">{t('topbar.language', 'Language')}</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setLang('en')}>
            <Languages size={16} className="mr-2" />
            {t('nav.english', 'English')}
            {lang === 'en' && <Check size={14} className="ml-auto text-primary" />}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setLang('fil')}>
            <Languages size={16} className="mr-2" />
            {t('nav.filipino', 'Filipino')}
            {lang === 'fil' && <Check size={14} className="ml-auto text-primary" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
