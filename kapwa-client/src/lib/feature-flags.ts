// KAPWA UI feature toggles.
//
// Analytics is hidden until product validation is done. Re-enable by building
// with `VITE_ENABLE_ANALYTICS=true` (e.g. `VITE_ENABLE_ANALYTICS=true npm run
// build` in kapwa-client) — no code change needed.
export const FEATURE_ANALYTICS_ENABLED =
  import.meta.env.VITE_ENABLE_ANALYTICS === 'true';