# i18n: Filipino Language Support — Design

**Date:** 2026-08-13
**Status:** Approved by user (2026-08-13)
**Scope:** Frontend (kapwa-client) only. All modules.

## Decisions

| Decision | Choice |
|---|---|
| Default language | English; user switches to Filipino via toggle |
| Toggle persistence | `localStorage['kapwa-lang']` (device-level, like theme) |
| Toggle placement | Topbar user menu + Settings page |
| Mechanism | react-i18next (i18next + react-i18next, ~35 KB) |
| Translation scope | UI chrome + client-side status/category display maps. Server notification titles/messages stay English. User-generated content (remarks, notes, chat) never translated |
| Locale resources | TypeScript modules, statically bundled (offline-safe — no runtime fetch) |
| Language detection | Manual only (no auto-detection plugin) |

## Architecture

### Dependencies

- `i18next`
- `react-i18next`

### Directory layout

```
src/i18n/
  index.ts            # i18next init: lng from localStorage, fallbackLng 'en'
  LanguageProvider.tsx# wraps I18nextProvider, syncs document.documentElement.lang
  useLanguage.ts      # { lang, setLang } — changeLanguage + localStorage + lang attr
  locales/
    en/
      index.ts        # merges module namespaces (single ns 'translation')
      nav.ts
      auth.ts
      dashboard.ts
      cases.ts
      beneficiaries.ts
      intake.ts
      tracker.ts
      approvals.ts
      irf.ts
      admin.ts
      settings.ts
      agency.ts
      announcements.ts
      referral.ts
      sync.ts
      statuses.ts     # server-value display maps (status, category, intervention types)
      common.ts       # buttons, dialogs, empty/error states, a11y strings
      errors.ts
    fil/              # same module structure, Filipino translations
      ...
```

- Single namespace (`translation`) with nested keys; modules merged at init.
- Locale files are plain TS objects (`export default { nav: {...} }`) — imported statically, fully offline.
- `en` is the canonical source; `i18next-parser` extracts from English code into `en` files.

### Init behavior

- Boot: `lng = localStorage.getItem('kapwa-lang') ?? 'en'` (validated against `['en','fil']`).
- `fallbackLng: 'en'`; `returnNull: false`; missing keys log to console in dev only.
- `document.documentElement.lang` set to active locale on boot and on every switch.

## Integration Pattern

### String extraction

- `i18next-parser` configured with the English codebase as source; keys written to `en` modules.
- Manual sweep afterwards for strings the parser misses (template literals, `aria-label` props, `title`/`placeholder` attributes, `window.alert`/`confirm`/`toast` calls).
- Key shape: `module.area.element` (e.g. `cases.table.surname`, `nav.dashboard`).

### Server-data display maps

Server sends English values; client maps to display strings:

- Case statuses: `enrolled, assessed, in_review, active, transitioning, closed`
- Client categories: `Children, Youth, Women, PWD, Senior, Indigent, 4Ps, IP, Family`
- Intervention types, referral statuses (`referred/received/actioned/closed/declined`), sync queue statuses (`pending/syncing/failed/conflict`), IRF statuses, announcement categories

Pattern: `t(\`status.${raw}\`, { defaultValue: raw })` — unknown future values pass through untranslated.

### Date/currency formatting

- New helpers in `src/lib/format.ts`: `formatDate`, `formatDateTime`, `formatAge` — locale-aware (`en-PH` vs `fil-PH` month names), timezone `Asia/Manila` preserved.
- Currency stays `₱` with `en-PH`/`fil-PH` grouping (identical).
- Existing inline `toLocaleDateString('en-PH')` calls migrate to helpers (mechanical pass).

### User-generated content

Remarks, notes, chat messages, announcement bodies — displayed as-is, never translated.

## Toggle UI

1. **Topbar user menu** (avatar dropdown): "Language" label + `English` / `Filipino` items with Check icon on active (mirrors the Theme block).
2. **Settings page**: new "Language" section — radio group (English / Filipino) + description.

Both call `setLang('en' | 'fil')`: `changeLanguage` (instant, no reload) + persist + update `document.documentElement.lang`.

## Rollout Order

1. **Scaffold**: add deps; `src/i18n/` init + provider + `useLanguage`; mount in app root; toggle in user menu + Settings; `document.lang` sync.
2. **Extraction**: `i18next-parser` run → canonical `en` modules; manual sweep for missed strings.
3. **Translation**: `fil` modules — human-reviewed Filipino translation (~1,500 keys).
4. **Maps + formats**: status/category display maps; `format.ts` helpers; migrate date calls.
5. **Testing**: existing 445 client tests unaffected (English default); add:
   - locale switch renders Filipino strings (smoke test)
   - persistence: localStorage round-trip
   - `document.documentElement.lang` = `fil` after switch
   - fallback: unknown key/status renders English/raw value
6. **Verification**: full vitest suite, `tsc --noEmit`, `vite build`, axe a11y suite, manual QA on login → dashboard → case → intake flows in both languages.

## Testing Notes

- Tests run with default `en` — existing assertions stay valid; no snapshot churn.
- i18n init is side-effect-free in jsdom; provider included in test render via setup file (or per-file where needed).
- New tests live beside the toggle (`src/components/Topbar.test.tsx`, `src/pages/SettingsPage.test.tsx`) and in `src/i18n/__tests__/`.
